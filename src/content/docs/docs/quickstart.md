---
title: Quickstart
description: Install bhatti on your own machine, create a sandbox, and run something inside it. About five minutes including the install download.
---

This is the path I recommend for everyone except remote-CLI users
sharing someone else's bhatti server. You'll install the daemon on a
machine you own — a Linux box with KVM **or** a Mac on Apple Silicon —
and from that same box create your first sandbox and run something
inside it.

If you don't have a suitable box in front of you, the
[Self-hosting](/docs/self-hosting/) page covers what you need (a
Raspberry Pi 5, a Hetzner box, any cloud VM with nested virtualization,
or an Apple Silicon Mac).

## Install

```bash
curl -fsSL bhatti.sh/install | sudo bash
```

That's the whole install. The script:

1. Downloads one self-contained runtime bundle — the `bhatti` CLI +
   daemon, the `bhatti-vmm` VMM helper, the `bhatti-netd` gateway, the
   `libkrun` (krucible) library, the lean guest kernel — plus the
   minimal Ubuntu 24.04 rootfs.
2. Installs and starts the service (systemd on Linux, launchd on
   macOS).
3. Creates an `admin` user and writes its API key + endpoint to your
   user's `~/.bhatti/config.yaml`. **You don't need to run `bhatti
   setup` after.** The CLI on this box is already wired up.

The transcript ends with the admin API key printed once. Save it — you'll
want it later for adding teammates or driving the server from another
machine.

## Create a sandbox

```bash
bhatti create --name dev
```

```text
sandbox/dev created (1 vCPU, 1024 MB)
  Shell: bhatti shell dev
```

Defaults are 1 vCPU and 1024 MB. Override with `--cpus` and `--memory`.
See [`bhatti create`](/docs/reference/cli/sandbox/create/) for every
flag.

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
keeps running. Reconnect with `bhatti shell dev` and the scrollback is
replayed.

## Publish a port

If you want to reach a service running inside the sandbox from the
internet:

```bash
bhatti exec dev -- bash -c 'python3 -m http.server 3000 &'
bhatti publish dev -p 3000 -a my-app
# → https://my-app.bhatti.sh
```

That URL is public. The sandbox can be cold and the URL still works —
the first request restores it in well under a second, then serves. See
[Networking](/docs/under-the-hood/networking/) for aliases, custom
domains, and how the wake-then-serve proxy works.

## Clean up

```bash
bhatti destroy dev
```

Or `bhatti destroy dev -y` if you don't want the confirmation prompt.

## What just happened

1. **`bhatti create`** asked the daemon to boot a **krucible** microVM
   — a real Linux VM with its own kernel and filesystem, isolated by
   the CPU's virtualization (KVM on Linux, HVF on macOS).
2. **`bhatti exec`** sent a command over the wire protocol to lohar,
   the guest agent running as PID 1 inside the VM.
3. **`bhatti shell`** opened a WebSocket and attached to a PTY session.
4. **`bhatti destroy`** stopped the VM, tore down its network gateway,
   and removed the sandbox's copy-on-write overlay.

The sandbox was a full Linux environment, not a container. When idle,
it would have paused itself (warm, memory still resident) and, after
longer idle, snapshotted its memory to disk (cold) — then restored
transparently on the next request.

## Next steps

- [Concepts](/docs/concepts/) — sandboxes, thermal states, the binaries
- [Self-hosting](/docs/self-hosting/) — adding teammates, custom
  domains, backups, the rest of the operator path
- [`bhatti exec`](/docs/reference/cli/exec/exec/) — streaming, timeouts,
  detach
- [`bhatti create`](/docs/reference/cli/sandbox/create/) — every flag

---

### Driving a remote bhatti from your laptop

If someone else runs the bhatti daemon and you only need the CLI on
your local machine — or you want to install bhatti on a server and
drive it from your laptop — install the CLI without sudo and point it
at the server:

```bash
# Install the CLI binary
curl -fsSL bhatti.sh/install | bash

# Configure the endpoint and key
bhatti setup --url https://your-server:8080 --token bht_abc...
# or interactively:
bhatti setup
```

`bhatti setup` accepts `--url` and `--token` for non-interactive
configuration (agents, CI, provisioning scripts). Without flags, it
prompts. See [`bhatti setup`](/docs/reference/cli/admin/setup/) for the
full reference.

The server operator gets your API key by running `bhatti user create
--name <you>` once, on the server, and sending you the key. See
[Self-hosting → adding teammates](/docs/self-hosting/#adding-teammates).
