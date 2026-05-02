---
title: Self-Hosting
description: Install the bhatti server, create users, and start the daemon.
---

Run bhatti on your own hardware. Requires a Linux machine with KVM support.

:::note
This guide is for operators setting up a bhatti server. If you already have an API key, see the [Quickstart](/docs/quickstart/).
:::

## Requirements

- Linux with KVM (`/dev/kvm` must exist)
- Root access (Firecracker requires it)
- 1GB+ RAM, NVMe recommended for snapshot performance

Tested on: Raspberry Pi 5, Hetzner AX-series, any x86_64/aarch64 with KVM.

## Install

```bash
curl -fsSL bhatti.sh/install | sudo bash
```

The installer prompts for a rootfs tier:

| Tier | What's in it | Size |
|------|-------------|------|
| `minimal` | Bare Ubuntu 24.04 | ~200MB |
| `browser` | + Chromium, Playwright, Node 22 | ~600MB |
| `docker` | + Docker Engine | ~550MB |
| `computer` | + Full desktop: XFCE, KasmVNC, Chromium | ~1.5GB |

It downloads all components (Firecracker, kernel, rootfs, bhatti, lohar), installs the systemd service, prints an admin API key (shown once — save it), and offers to start the daemon. Components that haven't changed since a previous install are skipped automatically.

You can also install non-interactively with flags:

```bash
# Specific tier
curl -fsSL bhatti.sh/install | sudo bash -s -- --tier browser

# All tiers at once
curl -fsSL bhatti.sh/install | sudo bash -s -- --tier all
```

## Create a user

```bash
sudo bhatti user create --name alice --max-sandboxes 5 --max-cpus 4 --max-memory 4096
# → API key: bht_...  (shown once, save it)
```

Give Alice the API key. She runs `bhatti setup` on her machine and enters the key.

## Verify

From Alice's machine:

```bash
bhatti create --name test
bhatti exec test -- echo "it works"
bhatti destroy test
```

## Updating

```bash
sudo bhatti update               # updates all components
sudo bhatti update --tiers all   # also pull additional tiers
```

Or re-run the install command:

```bash
curl -fsSL bhatti.sh/install | sudo bash
```

## Uninstalling

```bash
# Remove binaries + service, keep data
curl -fsSL bhatti.sh/uninstall | sudo bash

# Remove everything including data
curl -fsSL bhatti.sh/uninstall | sudo bash -s -- --purge
```

## Next steps

- [Users & Auth](/docs/managing/users/) — API key rotation, per-user limits
- [Concepts](/docs/concepts/) — mental model for sandboxes and thermal states
- [Images](/docs/managing/images/) — custom images, OCI pulls, tier management
