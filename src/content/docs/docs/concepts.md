---
title: Concepts
description: Sandboxes, thermal states, and the binaries — the mental model for bhatti.
---

## What a sandbox is

A sandbox is a real Linux microVM — its own kernel, its own filesystem, its own network stack. Not a container: process isolation is hardware-enforced by the CPU's virtualization, via **KVM** on Linux and **HVF** (Hypervisor.framework) on Apple Silicon. bhatti boots it with **krucible**, its own VMM (a fork of [libkrun](https://github.com/containers/libkrun)) — so the same sandbox model runs on a Linux server and on a macOS laptop.

Sandboxes are created in well under a second and destroyed instantly. When idle, they're automatically paused — and eventually their whole memory image is snapshotted to disk and the RAM is freed — then restored transparently on the next request.

## The binaries

**bhatti** runs on the host. It's both the server daemon (`bhatti serve`) and the CLI client (`bhatti create`, `bhatti exec`, …). The daemon is pure Go and never links the VMM. Instead it spawns, per sandbox, a small helper:

- **bhatti-vmm** — the cgo helper that *is* the VM. It links krucible (libkrun) and boots the guest; the daemon drives it (pause, resume, snapshot, restore) out-of-band over a control socket, because the libkrun entry call blocks for the life of the VM.
- **bhatti-netd** — a per-owner network gateway (a userspace [gVisor](https://gvisor.dev/) netstack). It gives the guest policed egress, isolates it from the host, and lets same-owner sandboxes reach each other — with no host TAP devices, bridges, or iptables rules. It's on by default.

**lohar** runs *inside* the VM as PID 1. It's the guest agent — a static binary with zero dependencies (no systemd, no libc, no initramfs). It handles command execution, file operations, and PTY sessions, and talks to the host over vsock using a custom [wire protocol](/docs/under-the-hood/wire-protocol/).

The names: *bhatti* (भट्टी) means furnace. *lohar* (लोहार) means blacksmith.

## Thermal states

Every sandbox is in one of three thermal states:

| State | What's happening | Resume latency | Memory cost |
|-------|-----------------|----------------|-------------|
| **Hot** | VM is running, vCPUs active | — | Full |
| **Warm** | vCPUs paused, memory still allocated | ~4 ms | Full |
| **Cold** | Memory snapshotted to disk, VM stopped | sub-second (~380 ms measured on Apple Silicon) | Zero |

The thermal manager transitions sandboxes automatically based on activity: hot → warm after 30 s idle, warm → cold after 30 min. From the API consumer's perspective, every sandbox appears to be running — a request to a cold sandbox triggers a transparent restore before the operation executes.

You can opt out with `keep_hot: true` on sandbox creation or update, which prevents automatic pausing. Useful for sandboxes maintaining persistent external connections.

## Architecture at a glance

```
CLI / API client
      │
      ▼ HTTP (TCP or unix socket)
┌──────────────┐
│ bhatti serve │  ← host daemon: REST API, thermal manager, proxy (pure Go)
└──────┬───────┘
       │ spawns per sandbox / per owner, drives over a control socket
       ├───────────────┐
       ▼               ▼
┌──────────────┐  ┌──────────────┐
│  bhatti-vmm  │  │  bhatti-netd │  ← krucible (libkrun) VMM + gVisor net gateway
└──────┬───────┘  └──────────────┘
       │ vsock
       ▼
┌──────────────┐
│    lohar     │  ← PID 1 inside the VM: exec, files, PTY sessions
└──────────────┘
```

For the full picture, see [Architecture Overview](/docs/under-the-hood/architecture/).
