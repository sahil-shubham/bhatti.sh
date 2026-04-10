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
curl -fsSL bhatti.sh/install | bash
```

On Linux, the installer prompts for CLI-only or full server install. Choose server.

## Configure

Create `/var/lib/bhatti/config.yaml`:

```yaml
listen: ":8080"
data_dir: /var/lib/bhatti
```

See [Configuration Reference](/docs/reference/config/) for all options.

## Start the server

```bash
sudo bhatti serve
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

## Run as a service

```bash
sudo tee /etc/systemd/system/bhatti.service << 'EOF'
[Unit]
Description=bhatti sandbox orchestrator
After=network.target

[Service]
ExecStart=/usr/local/bin/bhatti serve
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now bhatti
```

## Next steps

- [Users & Auth](/docs/managing/users/) — API key rotation, per-user limits
- [Concepts](/docs/concepts/) — mental model for sandboxes and thermal states
- [Configuration](/docs/reference/config/) — all server config options
