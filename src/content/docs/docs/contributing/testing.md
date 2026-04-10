---
title: Testing
description: "Test philosophy, categories, and how to run ~11,000 lines of tests."
---

~11,000 lines of tests across 25 test files. Zero mocks for VM tests — all Firecracker integration tests run on real microVMs.

## Philosophy

**Test at the real boundary.** The server tests use real Docker/Firecracker engines, not mocks. Mocks silently accept any input and hide broken behavior.

**Test the protocol without VMs.** Lohar has a test mode that listens on Unix sockets instead of vsock/TCP. The entire protocol handler test suite (40+ tests) runs on macOS in under 2 seconds without root or KVM.

**Test performance with percentiles.** Tests report p50/p95/p99, not averages. Assertions are on p99 to catch regressions.

## Running tests

### Protocol and agent tests (macOS/Linux, no root)

```bash
go test ./pkg/agent/proto/    # frame encoding, round-trips
go test ./cmd/lohar/           # agent handlers via Unix socket
go test ./pkg/agent/           # host-side client
```

### Server tests (requires Docker)

```bash
go test ./pkg/server/          # API, proxy, streaming, thermal
```

### Firecracker integration tests (Linux, KVM, root)

```bash
sudo go test ./pkg/engine/firecracker/ -count=1
```

### Performance tests

```bash
sudo go test ./pkg/engine/firecracker/ -run TestPerf -count=1
```

## Test categories

| Category | Location | Requires | Count |
|----------|----------|----------|-------|
| Protocol | `pkg/agent/proto/` | Nothing | ~15 |
| Agent | `cmd/lohar/` | Nothing | ~40 |
| Client | `pkg/agent/` | Nothing | ~10 |
| Server | `pkg/server/` | Docker | ~30 |
| Engine | `pkg/engine/firecracker/` | KVM, root | ~25 |
| Performance | `pkg/engine/firecracker/` | KVM, root | ~8 |
| CLI | `cmd/bhatti/` | Firecracker | ~11 |
| Recovery | `cmd/bhatti/` | Nothing | ~8 |

### What each category covers

- **Protocol tests** — binary framing: round-trips, EOF handling, max frame size, concurrent writes
- **Agent tests** — exec (exit codes, env vars, kill, process groups), TTY sessions (detach/reattach, scrollback, resize), files (read/write/stat/ls, truncation, atomicity)
- **Server tests** — API endpoints, auth, streaming exec (NDJSON), proxy, thermal cycle, volume management
- **Engine tests** — full VM lifecycle, snapshot/restore, diff snapshots, networking (bridge, cross-VM), TAP cleanup
- **Performance tests** — exec latency, file I/O, concurrent operations, warm→exec, snapshot timings
- **CLI tests** — end-to-end: create → exec → file → shell → destroy
- **Recovery tests** — daemon restart scenarios: crashed VMs, missing snapshots, orphaned state
