---
title: Running Commands
description: Execute commands inside sandboxes — buffered, streaming, environment variables, and exit codes.
---

## CLI

```bash
bhatti exec dev -- echo hello
bhatti exec dev -- npm install
bhatti exec dev -- sh -c 'echo $API_KEY'
```

Everything after `--` is the command. Exit code is forwarded. Stdout goes to stdout, stderr goes to stderr. You can pipe output:

```bash
bhatti exec dev -- cat /workspace/data.json | jq .name
```

Commands run as user `lohar` (uid 1000), not root. Use `sudo` inside the sandbox for root access.

## API

### Buffered (default)

```bash
curl -X POST http://localhost:8080/sandboxes/dev/exec \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cmd": ["echo", "hello"]}'
```

```json
{"exit_code": 0, "stdout": "hello\n", "stderr": ""}
```

### Streaming

Send `Accept: application/x-ndjson` to get real-time output:

```bash
curl -N -X POST http://localhost:8080/sandboxes/dev/exec \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/x-ndjson" \
  -d '{"cmd": ["npm", "install"]}'
```

```json
{"type":"stdout","data":"Installing dependencies...\n"}
{"type":"stderr","data":"npm warn deprecated ...\n"}
{"type":"stdout","data":"added 847 packages in 12s\n"}
{"type":"exit","exit_code":0}
```

Each line is flushed immediately — useful for long-running commands.

### Environment variables

```bash
curl -X POST http://localhost:8080/sandboxes/dev/exec \
  -d '{"cmd": ["env"], "env": {"MY_VAR": "hello"}}'
```

Per-request env vars override config drive env vars, which override defaults. Secrets set via `bhatti secret set` are automatically available as env vars.

## Behavior

- **Cold sandboxes wake transparently.** If a sandbox is sleeping, `exec` wakes it automatically. You don't need to know about thermal states.
- **Process cleanup.** When a command is killed or times out, all its child processes are cleaned up too (e.g., npm's sub-processes).
- **Writes are durable.** Files written by a command are fsynced to disk before the exit code is returned.

## Process list

```bash
bhatti ps dev
```

```bash
curl http://localhost:8080/sandboxes/dev/sessions \
  -H "Authorization: Bearer $TOKEN"
```

Shows all active sessions (init scripts, shells, background processes) with session IDs, commands, and whether a client is attached.

For all exec parameters, see the [API Reference](/docs/reference/api/).
