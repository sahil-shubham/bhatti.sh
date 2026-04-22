---
title: Concepts
description: Sandboxes, thermal states, and the two binaries — the mental model for bhatti.
---

## What a sandbox is

A sandbox is a [Firecracker](https://firecracker-microvm.github.io/) microVM. Not a container — a real virtual machine with its own Linux kernel, its own filesystem, and its own network stack. Process isolation is hardware-enforced by KVM, not namespace-based.

Sandboxes are created in seconds and destroyed instantly. When idle, they're automatically paused — their entire memory state is snapshotted to disk — and resumed in under 50ms when needed. Warm VMs (vCPUs paused, memory still allocated) resume in ~400µs.

## The two binaries

**bhatti** runs on the host. It's both the server daemon (`bhatti serve`) and the CLI client (`bhatti create`, `bhatti exec`, etc.). The server manages Firecracker VMs via its HTTP API over a Unix socket.

**lohar** runs inside the VM as PID 1. It's the guest agent — a static binary with zero dependencies (no systemd, no libc, no initramfs). It handles command execution, file operations, PTY sessions, and communicates with the host over a vsock connection using a custom [wire protocol](/docs/reference/wire-protocol/).

The names: *bhatti* (भट्टी) means furnace. *lohar* (लोहार) means blacksmith.

## Thermal states

Every sandbox is in one of three thermal states:

| State | What's happening | Resume latency | Memory cost |
|-------|-----------------|----------------|-------------|
| **Hot** | VM is running, vCPUs active | — | Full |
| **Warm** | vCPUs paused, memory still allocated | ~400µs | Full |
| **Cold** | Memory snapshotted to disk, VM stopped | ~50ms | Zero |

The thermal manager transitions sandboxes automatically based on activity. From the API consumer's perspective, every sandbox appears to be running — requests to cold sandboxes trigger a transparent wake before the operation executes.

You can opt out with `keep_hot: true` on sandbox creation or update, which prevents automatic pausing. Useful for sandboxes maintaining persistent external connections.

## Architecture at a glance

```
CLI / API client
      │
      ▼ HTTP
┌─────────────┐
│ bhatti serve │  ← host process: REST API, thermal manager, proxy
└──────┬──────┘
       │ Firecracker API (Unix socket)
       ▼
┌─────────────┐
│ Firecracker  │  ← VMM: boots the microVM
└──────┬──────┘
       │ vsock
       ▼
┌─────────────┐
│    lohar     │  ← PID 1 inside VM: exec, files, PTY sessions
└─────────────┘
```

For the full picture, see [Architecture Overview](/docs/architecture/overview/).
