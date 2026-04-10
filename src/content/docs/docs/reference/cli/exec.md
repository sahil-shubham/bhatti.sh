---
title: Execution & Shells
description: "exec, shell, ps"
---

## bhatti exec

Run a command inside a sandbox. Everything after `--` is the command.

```bash
bhatti exec dev -- echo hello
bhatti exec dev -- npm install
bhatti exec dev -- sh -c 'echo $API_KEY'
bhatti exec dev -- cat /workspace/data.json | jq .name
```

Exit code is forwarded. Stdout goes to stdout, stderr goes to stderr. Commands run as user `lohar` (uid 1000).

| Flag | Default | Description |
|------|---------|-------------|
| `--env` | — | Per-command environment variables (`K=V,K=V`) |

### Streaming

The CLI streams output by default. When using the API, send `Accept: application/x-ndjson` for streaming:

```bash
curl -N -X POST http://localhost:8080/sandboxes/dev/exec \
  -H "Accept: application/x-ndjson" \
  -d '{"cmd": ["npm", "install"]}'
```

## bhatti shell

Open an interactive terminal. Alias: `bhatti sh`.

```bash
bhatti shell dev
```

Press `Ctrl+\` to detach. The shell keeps running and output is captured in a 64KB scrollback buffer. Reconnect with `bhatti shell dev` — scrollback is replayed, then live I/O continues.

Detaching does *not* send SIGHUP. The child process survives.

## bhatti ps

List active sessions inside a sandbox.

```bash
bhatti ps dev
```

Shows session ID, command, TTY status, running state, and whether a client is attached. The `init` session (from `--init` on create) appears here too.
