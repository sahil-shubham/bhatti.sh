---
title: Server & Admin
description: "serve, setup, user, admin, update, completion"
---

## bhatti serve

Start the bhatti daemon. Requires root, KVM, and a config at the data directory.

```bash
sudo bhatti serve
```

Starts the HTTP API, thermal manager, port scanner, and public proxy. Recovers VMs from the database on startup.

## bhatti setup

Interactive configuration for CLI users.

```bash
bhatti setup
```

Prompts for API endpoint and API key. Saves to `~/.bhatti/config.yaml`. Tests the connection.

## bhatti version

```bash
bhatti version
# → bhatti v1.0.0
# → api: https://api.bhatti.sh
```

---

## User management

User commands operate directly on the local SQLite database. Requires access to the data directory (typically root on the server).

### bhatti user create

```bash
sudo bhatti user create --name alice --max-sandboxes 5 --max-cpus 4 --max-memory 4096
# → API key: bht_...  (shown once)
```

| Flag | Default | Description |
|------|---------|-------------|
| `--name` | required | Username (must be unique) |
| `--max-sandboxes` | 5 | Maximum concurrent sandboxes |
| `--max-cpus` | 4 | Maximum vCPUs per sandbox |
| `--max-memory` | 4096 | Maximum memory (MB) per sandbox |

### bhatti user list

```bash
sudo bhatti user list
```

### bhatti user rotate-key

```bash
sudo bhatti user rotate-key alice
```

Old key is immediately invalidated.

### bhatti user delete

```bash
sudo bhatti user delete alice
```

Fails if the user has active sandboxes.

---

## Admin commands

Observability commands that operate directly on the local SQLite database. Run on the server.

### bhatti admin status

One-shot system overview.

```bash
sudo bhatti admin status
sudo bhatti admin status --json
```

Shows sandbox counts, user counts, API request totals, host load, and memory.

### bhatti admin events

Query the event log.

```bash
sudo bhatti admin events
sudo bhatti admin events --type thermal --since 24h
```

| Flag | Description |
|------|-------------|
| `--type` | Filter by event type |
| `--since` | Time window (e.g., `24h`, `7d`) |
| `--limit` | Maximum events to return |

### bhatti admin metrics

Query metrics snapshots.

```bash
sudo bhatti admin metrics --since 1h
```

| Flag | Description |
|------|-------------|
| `--since` | Time window |

---

## bhatti update

Self-update the bhatti binary.

```bash
bhatti update
```

Downloads the latest release and replaces the current binary.

## bhatti completion

Generate shell completion scripts.

```bash
bhatti completion bash > /etc/bash_completion.d/bhatti
bhatti completion zsh > "${fpath[1]}/_bhatti"
bhatti completion fish > ~/.config/fish/completions/bhatti.fish
```

Supports `bash`, `zsh`, and `fish`. Sandbox name completion uses a local cache (updated by `create`, `destroy`, and `list`) — never hits the network.
