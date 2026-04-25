---
title: Thermal States & Snapshots
description: "Hot, warm, and cold — the state machine, diff snapshots, and what went wrong."
---

bhatti manages VM resources automatically through three thermal states. From the API's perspective, every sandbox is always "running." Behind the scenes, idle VMs progressively release resources and transparently restore when needed.

## The Three States

```
             idle 30s              idle 30min
    Hot ──────────────► Warm ──────────────► Cold
     ▲     ~400µs        ▲     ~50ms          │
     │                    │                    │
     └────────────────────┴────────────────────┘
              any API request (ensureHot)
```

| State | FC process | vCPUs | Host RAM | Resume | When |
|-------|-----------|-------|----------|--------|------|
| **Hot** | alive | running | allocated | — | actively used |
| **Warm** | alive | paused | allocated | ~400µs | idle < 30 min |
| **Cold** | dead | — | freed | ~50ms | idle > 30 min |

### Hot → Warm

When no sessions are attached and the VM has been idle for 30 seconds, the thermal manager pauses all vCPUs. The Firecracker process stays alive, memory stays allocated, but the VM consumes zero CPU cycles. Resume is under 400 microseconds.

### Warm → Cold

After 30 minutes idle, the thermal manager creates a memory snapshot (diff if possible — only dirty pages, typically 10-50MB for an idle VM), then kills the Firecracker process. Host RAM is freed completely.

### Cold → Hot

When any API request targets a cold VM, a new Firecracker process starts, loads the snapshot, and resumes. All processes, memory, and network state inside the VM are restored. Total: ~50ms. The caller sees nothing.

## Opting out

Sandboxes with `keep_hot: true` are never paused or snapshotted. Use this for sandboxes maintaining persistent external connections (WebSocket to Slack, long-running servers).

```bash
bhatti create --name agent --keep-hot
bhatti edit agent --keep-hot         # enable
bhatti edit agent --allow-cold       # disable
```

```bash
curl -X PATCH http://localhost:8080/sandboxes/agent \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"keep_hot": true}'
```

## Diff snapshots

The first `Stop()` creates a full snapshot (all memory pages). Subsequent stops create diff snapshots — only pages modified since the last snapshot. For an idle 512MB VM, this is 10-50MB instead of 512MB.

| Type | Data written | Time (Pi 5, NVMe) |
|------|-------------|-------------------|
| Full snapshot (512MB VM) | 512MB | ~4.4s |
| Diff snapshot (idle VM) | ~10-50MB | ~52ms |

The thermal manager's warm → cold transition uses diff snapshots. Since the VM has been paused with no activity, the diff is minimal.

## How the cycle works

A background goroutine ticks every 10 seconds and evaluates each sandbox:

1. **Host-side cache check.** The server records the last API activity per sandbox. If a sandbox had API activity within the warm timeout, it's skipped — no need to query the guest agent.
2. **Agent query.** For truly idle sandboxes, the thermal cycle asks the guest agent for its last activity timestamp (the agent tracks every exec and stdin as an atomic int64).
3. **Transition.** Based on the idle duration and current state, the cycle pauses or snapshots the VM.

This two-tier approach avoids opening TCP connections to active sandboxes. With 50 sandboxes, only the idle ones get queried.

For architecture details, see [Firecracker Engine](/docs/under-the-hood/engine/).
