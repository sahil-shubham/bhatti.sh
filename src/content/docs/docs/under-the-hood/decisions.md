---
title: Design Decisions
description: Key architectural decisions with context, alternatives, and rationale.
---

The decisions that shaped the system — the ones worth discussing because they have non-obvious tradeoffs.

## TCP over TAP instead of vsock after snapshot/restore

Firecracker exposes vsock as the primary host↔guest channel. It works perfectly during normal operation. After snapshot/restore, it breaks — the guest kernel's vsock state is stale, and connections complete the host-side handshake but never reach the guest agent.

Tested with kernel 5.10, 6.1, and Firecracker 1.6.0 through 1.14.0. This is a known Firecracker limitation — vsock state doesn't survive snapshot/restore (see Firecracker issue tracker).

**Decision:** Lohar listens on both vsock and TCP on ports 1024/1025. Cold boot uses vsock (slightly faster). After restore, a new `AgentClient` uses TCP over the TAP network. Virtio-net survives snapshot/restore cleanly.

**Tradeoff:** TCP over TAP adds ~0.1ms latency compared to vsock. Negligible.

## No Firecracker Go SDK

The official `firecracker-go-sdk` is ~15,000 lines of generated code. bhatti talks directly to Firecracker's Unix socket HTTP API with ~20 lines of helpers. The SDK abstracts away what's actually happening behind layers of generated types, pulls in heavy dependencies that complicate cross-compilation, and doesn't help with the hard parts — snapshot/restore sequencing, TAP management, thermal state machines.

**Tradeoff:** Manually constructed JSON strings for API calls. Less type-safe, but the API surface is small (~8 endpoints) and stable. Typos show up immediately in integration tests.

## Lohar as PID 1 (no systemd)

The rootfs is Ubuntu 24.04 with systemd. The conventional approach is to let systemd start as PID 1 and run the agent as a service. Instead, lohar *is* PID 1 — `init=/usr/local/bin/lohar`.

**Why:** Determinism. Systemd's boot sequence starts dozens of services, has dependency ordering, generates machine IDs, manages cgroups, handles device hotplug — all unnecessary inside a controlled microVM. Systemd adds 1-2 seconds to boot time and introduces failure modes we don't need.

**Tradeoff:** Lohar must handle everything PID 1 is responsible for: mounting filesystems and signal handling. Zombie reaping is intentionally omitted — Go's runtime manages `SIGCHLD` for `exec.Command` processes. Orphan zombies are acceptable because the VM is short-lived.

## Exec is sessions

Every TTY exec is a session. Sessions have IDs, scrollback buffers, and survive host disconnects. There's no separate "shell" concept — a shell is just a TTY exec of `/bin/zsh`. Non-TTY exec (piped) is the only path that doesn't create a session.

This fell out of a real problem: SSH connections to the Pi would drop (Wi-Fi, laptop sleep), killing running `npm install` commands. With sessions, the process keeps running on disconnect, output goes to the 64KB ring buffer, and reconnection replays scrollback.

**Tradeoff:** Every TTY session allocates 64KB. With 100 concurrent sessions per VM, that's 6.4MB.

## Atomic file writes

Lohar writes to a temp file, fsyncs, then renames over the target atomically. `rename()` is atomic on POSIX — concurrent readers see either the old file or the new file, never partial content. The `fsync()` before rename ensures data is on disk, not just in the page cache — critical because the host might snapshot the VM immediately after the write completes.

## Server-side file truncation

AI coding agents always truncate file reads — typically to 2000 lines or 50KB. Without server-side truncation, a 100MB log file transfers entirely through the wire protocol, then the agent discards 99.95%. Added `offset`, `limit`, and `max_bytes` to `FILE_READ_REQ`. Truncated reads of a 10K-line file are 4.5x faster at p50.

## Content-negotiated streaming exec

The exec endpoint supports two modes via `Accept: application/x-ndjson`. Without the header, buffered JSON. With it, NDJSON events flushed immediately. Chose NDJSON over WebSocket (works with `curl -N`, no upgrade handshake) and SSE (simpler, no `data:` prefixes).

## Per-VM mutex with capture-and-release

Each VM has its own `stateMu sync.Mutex`. Operations capture the `Agent` reference under lock, release the lock, then call the agent. Shell and Tunnel calls can last hours — holding the lock would block the thermal manager and all other operations. The `Agent` pointer is safe after release because it's only replaced during `Start()`, which acquires the same lock.

## Host-side activity cache

The thermal manager needs to know which sandboxes are idle. The guest agent is the authoritative source, but querying it means 50 TCP connections every 10 seconds. The server maintains a `sync.Map` updated on every API request. If a sandbox had API activity within the warm timeout, the agent query is skipped. Only truly idle sandboxes get queried.

## Pure-Go SQLite

Uses `modernc.org/sqlite` (pure-Go translation of SQLite's C) instead of `mattn/go-sqlite3` (requires CGO). This enables cross-compilation from macOS to Linux ARM64 with `CGO_ENABLED=0`. ~10% slower and ~3MB larger binary — irrelevant for metadata CRUD.

## Bridge networking with kernel ip=

Shared bridge (`brbhatti0`) on `192.168.137.0/24` with one masquerade rule. Guest IP configured via kernel `ip=` command-line parameter — processed during early boot before init runs. This solves the chicken-and-egg problem: the host needs to reach the agent to tell it what IP to use, but the agent can't start until the network is up. Kernel `ip=` means the network is ready before lohar executes.
