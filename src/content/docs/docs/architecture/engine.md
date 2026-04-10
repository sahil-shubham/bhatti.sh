---
title: Firecracker Engine
description: VM lifecycle, snapshot/restore, thermal state machine, and networking internals.
---

The Firecracker engine is the production backend. It manages VMs through Firecracker's HTTP API over a Unix socket, handles snapshot/restore for thermal management, and provides the networking layer.

## VM Creation

`Create()` performs these steps:

1. **Allocate IP** from the `192.168.137.0/24` pool
2. **Create TAP device** and attach to `brbhatti0` bridge
3. **Copy rootfs** — CoW copy (`cp --reflink=auto`) of the base image
4. **Build config drive** — 1MB ext4 with hostname, env vars, secrets, volumes, init script
5. **Format volumes** — create ext4 images for any `new_volumes`
6. **Start Firecracker** — configure machine, drives, network, vsock, then `InstanceStart`
7. **Wait for agent** — poll with `exec true` until lohar responds (~3.5s on Pi 5)
8. **Create AgentClient** — TCP connection to guest port 1024

## Snapshot/Restore

### Stop (VM → disk)

1. Pause vCPUs (`PATCH /vm {"state":"Paused"}`)
2. Create snapshot — full (first time) or diff (subsequent)
3. Kill the Firecracker process
4. Free host memory

First full snapshot: ~4.4s for 512MB VM (writes all memory pages). Subsequent diff snapshots: ~52ms (only dirty pages). The `track_dirty_pages` and `enable_diff_snapshots` Firecracker features make this possible.

If the base snapshot file is missing (corruption, manual deletion), `Stop()` falls back to a full snapshot automatically.

### Start (disk → VM)

1. Start new Firecracker process
2. Load snapshot with `PUT /snapshot/load` (with `enable_diff_snapshots: true`)
3. Resume vCPUs
4. Create new TCP-based `AgentClient` (vsock is broken after restore)
5. Wait for agent response

Total: ~50ms. All processes, memory, TCP connections, and file descriptors inside the VM are preserved.

### Why TCP after restore

Vsock breaks after snapshot/restore — the guest kernel's vsock state is stale. Connections complete the host-side handshake but never reach the guest agent. This is a known Firecracker limitation. Virtio-net (the virtual NIC) survives cleanly, so lohar listens on both vsock and TCP. Post-restore always uses TCP. See [Design Decisions](/docs/architecture/decisions/) for details.

## Thermal State Machine

A background goroutine ticks every 10 seconds:

```
Hot ──(idle 30s, no attached sessions)──► Warm ──(idle 30min)──► Cold
 ▲                                          ▲                      │
 └──────────────────────────────────────────┴──────────────────────┘
                       ensureHot() on any API request
```

The cycle checks a host-side activity cache first (updated on every API request). Only truly idle sandboxes get an agent query over TCP. Sandboxes with `keep_hot: true` are skipped entirely.

## Networking

### Bridge architecture

All VMs share one bridge (`brbhatti0`) at `192.168.137.1/24` with a single iptables masquerade rule. VMs get IPs from `.2` through `.254` (253 max concurrent VMs). Guest IPs are configured via the kernel `ip=` boot parameter — the network is up before lohar starts.

### TAP lifecycle

TAP devices are created during `Create()` and destroyed during `Destroy()`. They are **not** destroyed during `Stop()` — the snapshot contains virtio-net state that references the TAP. Destroying and recreating it would break networking after restore. Orphaned TAPs from crashes are cleaned up on engine startup.

### Post-snapshot networking

- **Virtio-net** works immediately after restore
- **Vsock** does not work (see above)
- **Guest-initiated TCP** may be slow initially due to stale conntrack entries — the host's iptables conntrack table has stale entries for the guest IP

## Port Scanning

A background goroutine polls running sandboxes every 3 seconds for listening ports. New ports get automatic TCP forwards through the proxy. Stale forwards are cleaned up. Port scanning skips non-hot VMs — it won't wake a warm or cold sandbox just to check ports.
