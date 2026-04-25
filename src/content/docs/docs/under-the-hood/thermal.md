---
title: Thermal States & Snapshots
description: "Hot, warm, and cold — the state machine, full snapshots, and why diff snapshots are disabled."
---

Every sandbox appears to be running. Behind the scenes, idle VMs shed resources progressively and restore transparently when needed. The API consumer never sees this — `exec` on a cold sandbox just works, with ~50ms extra latency on the first call.

## The three states

```
             idle 30s              idle 30min
    Hot ──────────────► Warm ──────────────► Cold
     ▲     ~400µs        ▲     ~50ms          │
     │                    │                    │
     └────────────────────┴────────────────────┘
              any API request (ensureHot)
```

| State | Firecracker | vCPUs | Host RAM | Resume |
|-------|------------|-------|----------|--------|
| **Hot** | alive | running | allocated | — |
| **Warm** | alive | paused | allocated | ~400µs |
| **Cold** | dead | — | freed | ~50ms |

**Hot → Warm.** No attached sessions and idle for 30 seconds → vCPUs paused. The Firecracker process stays alive, memory stays allocated, zero CPU cost. Resume is a single `PATCH /vm` call — under 400 microseconds.

**Warm → Cold.** Idle for 30 minutes → full memory snapshot to disk, Firecracker process killed, host RAM freed. A 512MB VM writes ~512MB to disk in ~4.4 seconds on a Pi 5 with NVMe.

**Cold → Hot.** Any API request targeting a cold sandbox triggers `ensureHot()`: start a new Firecracker process, load the snapshot, resume vCPUs. All processes, memory state, TCP connections, and file descriptors inside the VM are restored. ~50ms total. The original request then executes normally.

## Why all snapshots are full

Firecracker supports diff snapshots — only writing pages modified since the last snapshot. For an idle VM that's been paused, the diff would be tiny (10-50MB instead of 512MB). We had this enabled.

Then a snapshot restored with a corrupted virtio ring buffer. The guest agent was unreachable, the VM was stuck, and the only recovery was destroying it and losing the user's state. The root cause: dirty page tracking missed some host-side virtio writes. Firecracker's `track_dirty_pages` operates at the KVM level, but certain device-model writes happen in Firecracker's userspace and don't trigger KVM's dirty page bitmap.

All snapshots are now full. `track_dirty_pages: false`. It's slower (4.4s vs 52ms for a 512MB VM), but every snapshot is a complete, self-consistent image. The reliability tradeoff is clear — we'll re-enable diff snapshots when Firecracker's dirty page tracking covers all write paths.

| Type | Data | Time (Pi 5, NVMe) |
|------|------|-------------------|
| Full snapshot (512MB VM) | 512MB | ~4.4s |
| ~~Diff snapshot~~ (disabled) | ~~10-50MB~~ | ~~52ms~~ |

## The thermal cycle

A background goroutine ticks every 10 seconds. Checking every sandbox's idle state by querying its guest agent over TCP would mean 50 connections every 10 seconds for 50 sandboxes. That's expensive and unnecessary — most sandboxes on a busy server have had recent API activity.

The solution is a two-tier activity check:

1. **Host-side cache.** The server records the last API timestamp per sandbox in a `sync.Map`. If a sandbox had API activity within the warm timeout, it's skipped — no TCP connection opened.
2. **Agent query.** Only sandboxes with no recent API activity get queried. The agent tracks every exec and stdin event as an atomic int64 timestamp.
3. **Transition.** Based on the idle duration and current state: pause (hot→warm) or snapshot (warm→cold).

If the agent query fails 10 times in a row (agent hung, network issue), the thermal manager force-pauses the VM rather than leaving it hot and unresponsive. This is a circuit breaker — it prevents a single broken VM from consuming resources indefinitely.

## Opting out

`keep_hot: true` prevents automatic pausing and snapshotting. Use it for sandboxes that maintain persistent external connections — a WebSocket to Slack, a long-running dev server, an agent that needs to respond instantly.

```bash
bhatti create --name agent --keep-hot
bhatti edit agent --allow-cold         # re-enable thermal management
```

## After snapshot/restore: why TCP, not vsock

Firecracker exposes vsock as the primary host↔guest channel. It works during normal operation. After snapshot/restore, it breaks — the guest kernel's vsock state is stale, and connections complete the host-side handshake but never reach the guest agent.

This was tested with kernel 5.10, 6.1, and Firecracker 1.6.0 through 1.14.0. It's a known limitation.

The workaround: lohar listens on both vsock and TCP (ports 1024 and 1025). After restore, a new TCP connection is established over the virtio-net device (the TAP network interface), which survives snapshot/restore cleanly. The added latency is ~0.1ms — negligible.

All connections now use TCP, including cold boot. The vsock listener is still configured in Firecracker but never used by the agent client.
