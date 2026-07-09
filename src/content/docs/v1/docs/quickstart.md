---
title: Quickstart
description: Install bhatti on your own Linux box, create a sandbox, and run
  something inside it. About five minutes including the install download.
slug: v1/docs/quickstart
---

:::caution[bhatti v1 (Firecracker) is frozen]
Active development moved to **v2 (krucible)**, a self-owned VMM that also runs on
macOS — see the [current docs](/docs/quickstart/). These v1 pages are preserved
for existing Firecracker users. **`bhatti.sh/install` now installs v2**, so the
commands below are pinned to the frozen v1 release.
:::

This is the path I recommend for everyone except remote-CLI users
sharing someone else's bhatti server. You'll install the daemon on a
Linux box you own, and from that same box you'll create your first
sandbox and run something inside it.

If you don't have a Linux box with KVM in front of you, the
[Self-hosting](/v1/docs/self-hosting/) page covers what you need (a
Raspberry Pi 5, a Hetzner AX, or any cloud VM with nested
virtualization is enough).

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/sahil-shubham/bhatti/firecracker/scripts/install.sh | sudo BHATTI_VERSION=v1.11.12 bash
```

That's the whole install (pinned to the frozen v1.11.12 release). The script:

1. Downloads `bhatti`, `lohar`, Firecracker, the kernel, and the
   minimal Ubuntu 24.04 rootfs (~200 MB total).
2. Sets up the systemd service and starts the daemon.
3. Creates an `admin` user and writes its API key + endpoint to your
   user's `~/.bhatti/config.yaml`. **You don't need to run `bhatti
   setup` after.** The CLI on this box is already wired up.

The transcript ends with the admin API key printed once. Save it
somewhere — you'll want it later for adding teammates or driving the
server from a different machine.

## Create a sandbox

```bash
bhatti create --name dev
```

```text
sandbox/dev created (1 vCPU, 1024 MB)
  IP:    10.0.1.42
  Shell: bhatti shell dev
```

Defaults are 1 vCPU and 1024 MB. Override with `--cpus` and
`--memory`. See [`bhatti create`](/v1/docs/reference/cli/sandbox/create/)
for every flag.

## Run a command

```bash
bhatti exec dev -- echo hello
# → hello
```

Anything after `--` runs verbatim inside the sandbox. The `--` is
optional when there's no ambiguity:

```bash
bhatti exec dev uname -a
```

## Open a shell

```bash
bhatti shell dev
```

Interactive PTY, full keyboard. Press `Ctrl+\` to detach — the shell
keeps running. Reconnect with `bhatti shell dev` and the scrollback
is replayed.

## Publish a port

If you want to reach a service running inside the sandbox from the
internet:

```bash
bhatti exec dev -- bash -c 'python3 -m http.server 3000 &'
bhatti publish dev -p 3000 -a my-app
# → https://my-app.bhatti.sh
```

That URL is public. The sandbox can be cold and the URL still works
— the first request wakes it (~42 ms p50 on Hetzner). See
[Preview URLs](/v1/docs/sandboxes/preview-urls/) for aliases, custom
domains, and auth.

## Clean up

```bash
bhatti destroy dev
```

Or `bhatti destroy dev -y` if you don't want the confirmation prompt.

## What just happened

1. **`bhatti create`** asked the daemon to boot a Firecracker
   microVM — a Linux VM with its own kernel, filesystem, and
   network interface.
2. **`bhatti exec`** sent a command over the wire protocol to lohar,
   the guest agent running as PID 1 inside the VM.
3. **`bhatti shell`** opened a WebSocket and attached to a PTY
   session.
4. **`bhatti destroy`** stopped the VM and cleaned up the rootfs,
   TAP device, and IP.

The sandbox was a full Linux environment, not a container. When idle,
it would have paused itself automatically and resumed on the next
request in milliseconds.

## Next steps

* [Concepts](/v1/docs/concepts/) — sandboxes, thermal states, the two
  binaries
* [Self-hosting](/v1/docs/self-hosting/) — adding teammates, custom
  domains, backups, the rest of the operator path
* [`bhatti exec`](/v1/docs/reference/cli/exec/exec/) — streaming,
  timeouts, detach
* [`bhatti create`](/v1/docs/reference/cli/sandbox/create/) — every flag

***

### Driving a remote bhatti from your laptop

If someone else runs the bhatti daemon and you only need the CLI on
your local machine — or you want to install bhatti on a server and
drive it from your laptop — install the CLI without sudo and point
it at the server:

```bash
# Install the v1 CLI binary
curl -fsSL https://raw.githubusercontent.com/sahil-shubham/bhatti/firecracker/scripts/install.sh | BHATTI_VERSION=v1.11.12 bash

# Configure the endpoint and key
bhatti setup --url https://your-server:8080 --token bht_abc...
# or interactively:
bhatti setup
```

`bhatti setup` accepts `--url` and `--token` for non-interactive
configuration (agents, CI, provisioning scripts). Without flags, it
prompts. See [`bhatti setup`](/v1/docs/reference/cli/admin/setup/) for
the full reference.

The server operator gets your API key by running `bhatti user create --name <you>` once, on the server, and sending you the key. See
[Self-hosting → adding teammates](/v1/docs/self-hosting/#adding-teammates).
