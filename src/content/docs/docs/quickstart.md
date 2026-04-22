---
title: Quickstart
description: Install the CLI, create a sandbox, and run your first command in 2 minutes.
---

Install the CLI, create a sandbox, and run your first command.

## Install

```bash
curl -fsSL bhatti.sh/install | bash
```

## Configure

```bash
bhatti setup
```

Prompts for your API endpoint and API key, saves to `~/.bhatti/config.yaml`, tests the connection.

## Create a sandbox

```bash
bhatti create --name dev --cpus 2 --memory 1024
```

## Run a command

```bash
bhatti exec dev -- echo hello
# → hello
```

## Open a shell

```bash
bhatti shell dev
```

Press `Ctrl+\` to detach — the shell keeps running. Reconnect with `bhatti shell dev`.

## Clean up

```bash
bhatti destroy dev
```

## What just happened

1. `bhatti create` asked the server to boot a Firecracker microVM — a real Linux VM with its own kernel, filesystem, and network interface.
2. `bhatti exec` sent a command over the wire protocol to the guest agent (lohar) running as PID 1 inside the VM.
3. `bhatti shell` opened a WebSocket connection and attached a PTY session.
4. `bhatti destroy` stopped the VM and cleaned up all resources.

The sandbox was a full Linux environment — not a container. It had its own kernel, its own `/proc`, its own network stack. When idle, it would have been automatically paused and snapshotted to disk, resuming in under 50ms when you needed it again.

## Next steps

- [Self-Hosting](/docs/self-hosting/) — run your own bhatti server
- [Concepts](/docs/concepts/) — understand sandboxes, thermal states, and the two binaries
- [Running Commands](/docs/sandboxes/exec/) — streaming exec, environment variables, exit codes
