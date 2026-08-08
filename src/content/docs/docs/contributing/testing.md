---
title: Testing
description: "Test philosophy, categories, and how to run bhatti's ~25,000 lines of tests."
---

~25,000 lines of tests across ~95 test files. Zero mocks for VM tests — all krucible integration tests run on real microVMs, on real KVM (Linux) or HVF (Apple Silicon).

## Philosophy

**Test at the real boundary.** The engine tests drive a real krucible VM — a real `bhatti-vmm`, a real lohar guest — not a mock. Mocks silently accept any input and hide broken behavior; a real boot doesn't.

**Test the protocol without VMs.** lohar has a test mode (`runTestMode`) that listens on Unix sockets instead of vsock. The whole protocol/handler surface runs on macOS or Linux in seconds, without root or a hypervisor.

**Test performance against budgets.** Timing-sensitive paths (cold restore, warm resume, boot→agent) assert on a measured latency budget, not a comment — so a regression that doubles cold-restore time fails a test instead of quietly shipping.

## Running tests

### Protocol and agent tests (macOS/Linux, no root)

```bash
go test ./pkg/agent/proto/    # frame encoding, round-trips
go test ./cmd/lohar/           # agent handlers via Unix socket (test mode)
go test ./pkg/agent/           # host-side client
```

These need no hypervisor — they exercise lohar over Unix sockets and the wire protocol directly.

### krucible engine tests (real VMs)

The full VM suite is behind the `krucible` build tag and needs a hypervisor (KVM or HVF):

```bash
go test -tags krucible ./pkg/engine/krucible/ -count=1
```

On macOS (Apple Silicon), build the fork and the VMM helper first, then run the suite locally on HVF:

```bash
make krucible          # build libkrun (our fork) + assemble the link prefix
make vmm               # build & sign bhatti-vmm (cgo against libkrun)
go test -tags krucible ./pkg/engine/krucible/ -count=1
```

Build the lean guest kernel too (`scripts/build-lean-kernel.sh`) for the faster external-kernel boot path — the daemon autodetects it. If a hypervisor isn't available, the VM suites self-skip via `hasHypervisor()`.

### Cross-engine behavior

VMM-agnostic behavior assertions live in `pkg/engine/enginetest` — the core an engine must satisfy (status/list, exec exit codes and stdout, the file API). krucible's tests wire these suites to a real engine, so the same behavior contract is checked against the running VMM rather than bespoke per-engine scripts.

## Continuous integration

Two workflows cover the engine:

- **`ci.yml` → `krucible-build`** (GitHub-hosted, no `/dev/kvm`). Builds the Rust fork (`make krucible`), the cgo helper (`make vmm`), and the `-tags krucible` Go, then runs the pure-unit tests (bundle, capability, recovery, state). The VM suites self-skip here — there's no hypervisor on a hosted runner — so this is the build/link + unit gate.
- **`krucible-integration.yml`** (self-hosted `arc-runner-set`, real KVM). Brings up libkrun + `bhatti-vmm` + `bhatti-netd`, builds lohar, boots a real release-tier rootfs, and runs the full `-tags krucible` suite on actual hardware (arm64 and x86). This is the canonical parity gate for v2, and it touches no host networking — netd/TSI keep everything in userspace.

## Test categories

| Category | Location | Requires |
|----------|----------|----------|
| Protocol | `pkg/agent/proto/` | Nothing |
| Agent (guest) | `cmd/lohar/` | Nothing (Unix-socket test mode) |
| Client | `pkg/agent/` | Nothing |
| Cross-engine | `pkg/engine/enginetest/` | Hypervisor (via krucible) |
| Engine | `pkg/engine/krucible/` | libkrun + KVM/HVF |
| Server | `pkg/engine/krucible/` | libkrun + KVM/HVF |
| CLI | `cmd/bhatti/` | libkrun + KVM/HVF |
| Recovery | `cmd/bhatti/`, `pkg/engine/krucible/` | Mixed (unit vs VM) |

### What each category covers

- **Protocol tests** — binary framing: round-trips, EOF handling, max frame size, concurrent writes
- **Agent tests** — exec (exit codes, env vars, kill, process groups), TTY sessions (detach/reattach, scrollback, resize), files (read/write/stat/ls, truncation, atomicity), and the PID-1 lohar shims (systemctl/journalctl over the in-guest Unix socket)
- **Client tests** — the host-side agent client against lohar in test mode
- **Cross-engine tests** — the VMM-agnostic behavior contract every engine must satisfy
- **Engine tests** — full VM lifecycle on a real krucible boot: create/exec/destroy, full snapshot/restore, fork (CoW memory clone), cold-tier restore, qcow2 overlays and mounts, volumes, and networking through `bhatti-netd` (egress policing, same-owner sibling reachability, vsock forward/tunnel)
- **Server tests** — the full daemon stack (HTTP API + store + thermal manager) over a real engine, including the wake-on-request path (exec against a cold sandbox transparently cold-restores it)
- **CLI tests** — end-to-end: create → exec → file → shell → destroy
- **Recovery tests** — daemon restart scenarios: adopting live helpers by PID/cmdline, crashed VMs, missing snapshots, orphaned state
