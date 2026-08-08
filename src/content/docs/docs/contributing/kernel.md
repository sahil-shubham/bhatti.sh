---
title: Kernel
description: The lean external guest kernel — how it's configured, built, and loaded on the krucible boot path.
---

bhatti v2 boots guests on a custom-built **lean Linux kernel** — a minimal 6.12.94 with only the features a sandbox workload needs. It's an *external* kernel: krucible loads it directly with `krun_set_kernel`, which bypasses the kernel bundled inside `libkrunfw`. Skipping libkrunfw's driver/subsystem init is worth roughly **2× on cold-start** — boot→agent lands at ~312ms on HVF versus ~610ms with the stock bundled kernel.

## Building

The kernel is built reproducibly inside Docker so the macOS dev box and Linux CI produce the same binary:

```bash
# Build for the host architecture (default), output to dist/kernel/
scripts/build-lean-kernel.sh

# Or name the target arch explicitly
scripts/build-lean-kernel.sh aarch64
scripts/build-lean-kernel.sh x86_64
```

The script pulls the pinned kernel.org source (`KERNEL_VERSION`, default `6.12.94`), copies our in-repo config over it, runs `make olddefconfig`, and builds the image:

- **arm64** → `arch/arm64/boot/Image` → `dist/kernel/Image-lean-<version>-<arch>`
- **x86_64** → `vmlinux` → `dist/kernel/vmlinux-lean-<version>-<arch>`

Override the version with `KERNEL_VERSION=<x.y.z>` (must be a `linux-stable` tag). There's no libkrunfw in this path — the external kernel replaces it entirely.

## How it's loaded

The daemon **autodetects** the lean kernel: if a `dist/kernel/*-lean-*` image exists it's used automatically; if not, krucible falls back to the `libkrunfw` bundle (slower, but keeps things working before you've built one). You can also point the daemon at a specific image with the `krucible_kernel_image` config field. `bhatti-vmm` passes the image to `krun_set_kernel` along with an arch-aware kernel command line, and `krun_start_enter` then skips libkrunfw entirely.

## Key config choices

The config under `scripts/lean-kernel/` (`config-lean_aarch64`, `config-lean_x86_64`) is deliberately lean — ~998 `=y` symbols versus ~1433 in the libkrunfw-equivalent config. Fewer subsystems to initialize means a faster boot and a smaller footprint. It enables exactly what block-root microVM guests use:

- **virtio** — virtio-blk (root overlay, config drive, volumes), virtio-net (the netd link), virtio-vsock (host↔guest control), virtio-console, virtio-mmio, balloon
- **ext4** — filesystem for the root image, config drive, and volumes; plus **overlayfs** and **virtio-fs**
- **devtmpfs** — required for `/dev` device nodes (auto-mounted)
- **TTY/PTY** — for interactive shell sessions
- **block layer** — the loop device and block-integrity bits the CoW image stack relies on

Everything unnecessary for a sandbox is turned off: USB, sound, most filesystems, most network drivers, 9p, initrd/initramfs support (guests are block-root, so there's no ramdisk boot), and hardware-specific drivers.

## Architecture support

Two configs are maintained, one per target arch:

- `config-lean_aarch64` — Raspberry Pi 5, Graviton, Apple Silicon, and other arm64 hosts (produces `Image-lean-*`)
- `config-lean_x86_64` — x86_64 bare metal and cloud instances (produces `vmlinux-lean-*`)

The build script selects the source config and the make target from the arch argument, and the daemon selects the matching image for the host architecture at runtime.
