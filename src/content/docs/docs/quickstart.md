---
title: Quickstart
description: Install the CLI, configure it, create a sandbox, and run your first command in two minutes.
---

Install the CLI, point it at a server, create a sandbox, run something inside it.

## Install

```bash
curl -fsSL bhatti.sh/install | bash
```

On macOS this installs the CLI binary. On Linux the same command auto-detects whether you want a CLI-only install or a full self-hosted server (use `sudo` for the server path). See [Self-hosting](/docs/self-hosting/) if you want to run your own.

## Configure

```bash
bhatti setup
```

Prompts for the API endpoint and your API key, writes them to `~/.bhatti/config.yaml`, and verifies the connection by listing your sandboxes.

If you don't have a key, ask whoever runs the bhatti server you're connecting to. The server operator runs [`bhatti user create --name <you>`](/docs/reference/cli/admin/user-create/) and shares the resulting key once.

## Create a sandbox

```bash
bhatti create --name dev
```

```text
sandbox/dev created (1 vCPU, 1024 MB)
  IP:    192.168.137.42
  Shell: bhatti shell dev
```

The defaults are 1 vCPU and 1024 MB — enough for most things. Override with `--cpus` and `--memory`. See [`bhatti create`](/docs/reference/cli/sandbox/create/) for the full flag list.

## Run a command

```bash
bhatti exec dev -- echo hello
# → hello
```

Anything after `--` runs verbatim inside the sandbox. The `--` is optional when there's no ambiguity:

```bash
bhatti exec dev uname -a
```

## Open a shell

```bash
bhatti shell dev
```

Interactive PTY, full keyboard. Press `Ctrl+\` to detach — the shell keeps running. Reconnect with `bhatti shell dev` and the scrollback is replayed.

## Clean up

```bash
bhatti destroy dev
```

(Or `bhatti destroy dev -y` if you don't want the confirmation prompt.)

## Updating

```bash
bhatti update
```

On a CLI-only host this updates the binary. On a server, run `sudo bhatti update` to pick up new server components too. See [Updating & uninstalling](/docs/updating/) for the details.

## What just happened

1. **`bhatti create`** asked the server to boot a Firecracker microVM — a real Linux VM with its own kernel, filesystem, and network interface.
2. **`bhatti exec`** sent a command over the wire protocol to lohar, the guest agent running as PID 1 inside the VM.
3. **`bhatti shell`** opened a WebSocket connection and attached a PTY session.
4. **`bhatti destroy`** stopped the VM and cleaned up the rootfs, TAP device, and IP.

The sandbox was a full Linux environment, not a container. When idle, it would have been paused automatically — and resumed on the next request in microseconds.

## Next steps

- [Concepts](/docs/concepts/) — sandboxes, thermal states, the two binaries
- [`bhatti exec`](/docs/reference/cli/exec/exec/) — streaming, timeouts, detach
- [`bhatti create`](/docs/reference/cli/sandbox/create/) — every flag
- [Self-hosting](/docs/self-hosting/) — run your own bhatti server
