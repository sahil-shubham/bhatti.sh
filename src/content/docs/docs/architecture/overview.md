---
title: Architecture Overview
description: System diagram, component map, and data flow.
---

bhatti has two binaries. **bhatti** runs on the host — it's the daemon, the CLI, the HTTP server, the thermal manager, and the engine that talks to Firecracker. **lohar** runs inside every microVM as PID 1 — it handles exec, file operations, PTY sessions, and port forwarding.

They communicate over TCP using a [binary framing protocol](/docs/reference/wire-protocol/).

```
┌───────────────────────────────────────────────────────────────┐
│  Host  (Pi 5 / Graviton / x86_64 bare metal)                 │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  bhatti serve                                           │  │
│  │                                                         │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ REST/WS  │  │ Engine       │  │ Store (SQLite)   │  │  │
│  │  │ API      │  │              │  │ sandboxes,       │  │  │
│  │  │ :8080    │──│ Create/Stop  │  │ secrets,         │  │  │
│  │  │          │  │ Exec/Shell   │  │ templates,       │  │  │
│  │  │ Proxy    │  │ File ops     │  │ volumes,         │  │  │
│  │  │ Thermal  │  │ Pause/Resume │  │ FC state         │  │  │
│  │  │ Manager  │  │ Snapshot     │  └──────────────────┘  │  │
│  │  └──────────┘  └──────┬───────┘                        │  │
│  │                        │ TCP over TAP                   │  │
│  └────────────────────────┼────────────────────────────────┘  │
│  ┌────────────────────────┼────────────────────────────────┐  │
│  │  Sandbox (Firecracker microVM)                          │  │
│  │                        │                                │  │
│  │  vmlinux   rootfs.ext4   config.ext4   vol-*.ext4       │  │
│  │                        │                                │  │
│  │  ┌─────────────────────▼──────────────────────────┐     │  │
│  │  │  lohar (PID 1)                                 │     │  │
│  │  │  TCP :1024 (control)   :1025 (forward)         │     │  │
│  │  │  sessions, files, scrollback, port forwarding   │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  │  tapXXXX ── brbhatti0 (bridge) ── iptables NAT          │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## The Engine Interface

The Firecracker engine and Docker engine implement the same Go interface. Docker exists as a development fallback on macOS (no KVM). The Firecracker engine is the production path.

The core interface covers: `Create`, `Destroy`, `Stop` (snapshot), `Start` (restore), `Exec`, `Shell`, `ListeningPorts`, and `Tunnel`. The Firecracker engine extends this with thermal management (`Pause`, `Resume`, `EnsureHot`), file operations, streaming exec, sessions, and state persistence — discovered at runtime via interface assertions.

## Sandbox Lifecycle

From the API consumer's perspective, there are two operations: create and destroy. Everything between is bhatti's job.

Behind the API, each VM moves through three [thermal states](/docs/sandboxes/thermal/):

```
Hot ◄──~400µs──► Warm ◄──~50ms──► Cold
 ▲                                   │
 └──────── any API request ──────────┘
```

| State | FC process | vCPUs | Host RAM | Resume |
|-------|-----------|-------|----------|--------|
| **Hot** | alive | running | allocated | — |
| **Warm** | alive | paused | allocated | ~400µs |
| **Cold** | dead | — | freed | ~50ms |

Transitions are automatic. Any API request calls `ensureHot()` which transparently restores the VM before executing. Metadata queries (list, status) don't wake VMs.

## Data Flow: Exec

The complete path of `bhatti exec dev -- echo hello`:

```
CLI                  Server              Engine              Lohar
 │                     │                   │                   │
 ├─POST /sandboxes/    │                   │                   │
 │  {id}/exec ────────►│                   │                   │
 │                     ├─ensureHot() ─────►│                   │
 │                     ├─Exec() ──────────►│                   │
 │                     │                   ├─capture Agent ref │
 │                     │                   ├─release lock      │
 │                     │                   ├─TCP dial :1024───►│
 │                     │                   │                   ├─fork/exec
 │                     │                   │◄──STDOUT frame────┤
 │                     │                   │◄──EXIT frame──────┤
 │                     │◄──ExecResult──────┤                   │
 │◄──JSON response─────┤                   │                   │
```

With `Accept: application/x-ndjson`, each stdout/stderr frame is flushed to the client as an NDJSON line in real time.

## Concurrency Model

Each VM has a `stateMu sync.Mutex` protecting its mutable fields. The engine-level `sync.RWMutex` protects only the VM map.

Operations follow a capture-and-release pattern: hold `stateMu`, validate state, capture the `Agent` reference, release the lock, then call the agent. This lets long-lived operations (Shell, Tunnel — can last hours) proceed without blocking other operations or the thermal manager.

## Recovery

On startup, `recoverVMs()` reads all sandboxes from SQLite and restores them to the engine's in-memory map. Stopped sandboxes with valid snapshots become resumable. Running sandboxes whose Firecracker process died (crash, reboot) are marked stopped if a snapshot exists, or unknown if not. Orphaned TAP devices from previous crashes are cleaned up.

## Disk Layout

```
/var/lib/bhatti/
├── config.yaml               daemon config
├── state.db                   SQLite (WAL mode)
├── age.key                    secret encryption key
├── images/
│   ├── vmlinux-arm64          kernel
│   └── rootfs-minimal-arm64.ext4
└── sandboxes/<id>/
    ├── rootfs.ext4            CoW copy of base rootfs
    ├── config.ext4            config drive (1MB)
    ├── vol-<name>.ext4        attached volumes
    ├── firecracker.sock       FC API socket
    ├── mem.snap               memory snapshot (when cold)
    └── vm.snap                VM state snapshot (when cold)
```
