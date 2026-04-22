---
title: Kernel
description: Custom kernel configuration and build process for Firecracker microVMs.
---

bhatti uses a custom-built Linux 6.1.x kernel (currently 6.1.155) optimized for Firecracker microVMs. The base config starts from Firecracker's CI config. The kernel is minimal — only the features needed for sandbox workloads are enabled.

## Building

```bash
# Clone the kernel source
git clone --depth 1 --branch v6.1.155 https://github.com/torvalds/linux.git
cd linux

# Apply the bhatti config
cp /path/to/bhatti/kernel/.config .config

# Build
make -j$(nproc) vmlinux
```

The output `vmlinux` is an uncompressed kernel binary — Firecracker loads it directly.

## Key config choices

The kernel config enables:

- **virtio** — virtio-blk (rootfs, config drive, volumes), virtio-net (networking), vsock (host↔guest)
- **ext4** — filesystem for rootfs and volumes
- **devtmpfs** — required for `/dev` device nodes
- **PTY** — for interactive shell sessions
- **process namespaces** — for process isolation within the VM
- **network** — TCP/IP stack, bridge support

The kernel config disables everything unnecessary for a sandbox environment: USB, sound, most filesystems, most network drivers, hardware-specific drivers.

## Architecture support

Two kernel configs are maintained:

- `vmlinux-arm64` — for Raspberry Pi 5, Graviton, and other ARM64 hosts
- `vmlinux-amd64` — for x86_64 bare metal and cloud instances

The correct kernel is selected automatically based on the host architecture.
