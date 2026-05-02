---
title: CLI Reference
description: Every bhatti command, global flags, environment variables, output formats, and exit codes.
---

`bhatti` is a single binary. `bhatti serve` runs the daemon; everything else is a CLI client that talks to the daemon's HTTP API. All sandbox commands accept the sandbox name or ID interchangeably.

```bash
bhatti setup                          # configure endpoint + API key
bhatti create --name dev              # create a sandbox
bhatti exec dev -- echo hello         # run a command
bhatti shell dev                      # interactive shell (Ctrl+\ to detach)
bhatti destroy dev                    # clean up
```

## Operations

| Command | Syntax | Description |
| ------- | ------ | ----------- |
| **Core** | | |
| [`create`](/docs/reference/cli/sandbox/create/) | `bhatti create [flags]` | Create a new sandbox VM |
| [`destroy`](/docs/reference/cli/sandbox/destroy/) | `bhatti destroy <sandbox> [-y]` | Destroy a sandbox (alias: `rm`) |
| [`edit`](/docs/reference/cli/sandbox/edit/) | `bhatti edit <sandbox> [--keep-hot \| --allow-cold]` | Update mutable settings |
| [`exec`](/docs/reference/cli/exec/exec/) | `bhatti exec <sandbox> [--] <command...>` | Run a command in a sandbox |
| [`inspect`](/docs/reference/cli/sandbox/inspect/) | `bhatti inspect <sandbox>` | Show sandbox details (alias: `info`) |
| [`list`](/docs/reference/cli/sandbox/list/) | `bhatti list [-o wide]` | List sandboxes (alias: `ls`) |
| [`ports`](/docs/reference/cli/exec/ports/) | `bhatti ports <sandbox>` | List listening ports inside a sandbox |
| [`ps`](/docs/reference/cli/exec/ps/) | `bhatti ps <sandbox>` | List active sessions in a sandbox |
| [`share`](/docs/reference/cli/networking/share/) | `bhatti share <sandbox> [--revoke]` | Generate a web shell URL |
| [`shell`](/docs/reference/cli/exec/shell/) | `bhatti shell <sandbox> [--new]` | Open an interactive shell (alias: `sh`) |
| [`start`](/docs/reference/cli/sandbox/start/) | `bhatti start <sandbox> [--force]` | Resume a stopped sandbox |
| [`stop`](/docs/reference/cli/sandbox/stop/) | `bhatti stop <sandbox>` | Snapshot and stop a sandbox |
| **Files** | | |
| [`file read`](/docs/reference/cli/files/read/) | `bhatti file read <sandbox> <path>` | Read a file from a sandbox |
| [`file write`](/docs/reference/cli/files/write/) | `bhatti file write <sandbox> <path>` | Write a file (reads from stdin) |
| [`file ls`](/docs/reference/cli/files/ls/) | `bhatti file ls <sandbox> <path>` | List directory contents |
| **Networking** | | |
| [`publish`](/docs/reference/cli/networking/publish/) | `bhatti publish <sandbox> -p <port> [-a <alias>] [--shell]` | Publish a port with a public URL |
| [`unpublish`](/docs/reference/cli/networking/unpublish/) | `bhatti unpublish <sandbox> -p <port>` | Remove a published port |
| **Images** | | |
| [`image list`](/docs/reference/cli/images/list/) | `bhatti image list` | List available rootfs images |
| [`image pull`](/docs/reference/cli/images/pull/) | `bhatti image pull <ref> [--name N] [--auth U:T]` | Pull from a public OCI registry |
| [`image import`](/docs/reference/cli/images/import/) | `bhatti image import <docker-ref> \| --tar <path> [--name N]` | Import a Docker image or tarball |
| [`image save`](/docs/reference/cli/images/save/) | `bhatti image save <sandbox> --name <image>` | Save a sandbox's filesystem as an image |
| [`image delete`](/docs/reference/cli/images/delete/) | `bhatti image delete <name> [-y]` | Delete an image |
| [`image share`](/docs/reference/cli/images/share/) | `bhatti image share <name> --user <u>...` | Share an image with specific users |
| [`image unshare`](/docs/reference/cli/images/unshare/) | `bhatti image unshare <name> --user <u>...` | Revoke image access from users |
| **Volumes** | | |
| [`volume create`](/docs/reference/cli/volumes/create/) | `bhatti volume create --name <v> --size <MB>` | Create a persistent volume |
| [`volume list`](/docs/reference/cli/volumes/list/) | `bhatti volume list` | List volumes |
| [`volume delete`](/docs/reference/cli/volumes/delete/) | `bhatti volume delete <name> [-y]` | Delete a volume |
| [`volume resize`](/docs/reference/cli/volumes/resize/) | `bhatti volume resize <name> --size <MB>` | Resize a volume (grow only) |
| [`volume clone`](/docs/reference/cli/volumes/clone/) | `bhatti volume clone <src> --name <new>` | Clone a volume (point-in-time copy) |
| [`volume backup`](/docs/reference/cli/volumes/backup/) | `bhatti volume backup <name>` | Back up a volume to S3 |
| [`volume backup-list`](/docs/reference/cli/volumes/backup-list/) | `bhatti volume backup-list <name>` | List backups for a volume |
| [`volume restore`](/docs/reference/cli/volumes/restore/) | `bhatti volume restore <name> --backup-id <id>` | Restore a volume from a backup |
| [`volume backup-delete`](/docs/reference/cli/volumes/backup-delete/) | `bhatti volume backup-delete <name> <id> [-y]` | Delete a volume backup |
| **Secrets** | | |
| [`secret set`](/docs/reference/cli/secrets/set/) | `bhatti secret set <name> <value>` | Create or update a secret |
| [`secret list`](/docs/reference/cli/secrets/list/) | `bhatti secret list` | List secret names |
| [`secret delete`](/docs/reference/cli/secrets/delete/) | `bhatti secret delete <name>` | Delete a secret |
| **Snapshots** | | |
| [`snapshot create`](/docs/reference/cli/snapshots/create/) | `bhatti snapshot create <sandbox> --name <snap>` | Checkpoint a running sandbox |
| [`snapshot list`](/docs/reference/cli/snapshots/list/) | `bhatti snapshot list` | List snapshots |
| [`snapshot resume`](/docs/reference/cli/snapshots/resume/) | `bhatti snapshot resume <snap> [--name <new>]` | Resume from a snapshot into a new sandbox |
| [`snapshot delete`](/docs/reference/cli/snapshots/delete/) | `bhatti snapshot delete <name> [-y]` | Delete a snapshot |
| **Server & admin** | | |
| [`serve`](/docs/reference/cli/admin/serve/) | `bhatti serve` | Start the bhatti daemon |
| [`setup`](/docs/reference/cli/admin/setup/) | `bhatti setup` | Configure CLI endpoint and API key |
| [`version`](/docs/reference/cli/admin/version/) | `bhatti version` | Print version and check for updates |
| [`update`](/docs/reference/cli/admin/update/) | `bhatti update [--cli-only] [--tiers <list>]` | Update bhatti |
| [`completion`](/docs/reference/cli/admin/completion/) | `bhatti completion <bash\|zsh\|fish>` | Generate shell completion script |
| [`user create`](/docs/reference/cli/admin/user-create/) | `bhatti user create --name <u> [--max-...]` | Create a user (server-only) |
| [`user list`](/docs/reference/cli/admin/user-list/) | `bhatti user list` | List users (server-only) |
| [`user rotate-key`](/docs/reference/cli/admin/user-rotate-key/) | `bhatti user rotate-key <name>` | Rotate a user's API key (server-only) |
| [`user delete`](/docs/reference/cli/admin/user-delete/) | `bhatti user delete <name> [-y]` | Delete a user (server-only) |
| [`admin status`](/docs/reference/cli/admin/admin-status/) | `bhatti admin status` | One-shot system overview (server-only) |
| [`admin events`](/docs/reference/cli/admin/admin-events/) | `bhatti admin events [--type T] [--since 24h]` | Query the event log (server-only) |
| [`admin metrics`](/docs/reference/cli/admin/admin-metrics/) | `bhatti admin metrics [--since 1h]` | Query metrics snapshots (server-only) |

## Global flags

These flags are accepted by every command.

| Flag | Description |
| ---- | ----------- |
| `--url <url>` | API endpoint (overrides config and `BHATTI_URL`). |
| `--token <key>` | API key (overrides config and `BHATTI_TOKEN`). |
| `--data-dir <path>` | Path to the server's data directory. Required for `bhatti user *` and `bhatti admin *` since those operate directly on the local SQLite database. |
| `--json` | Print machine-readable JSON instead of the default human format. Universally supported. |
| `--timing` | Print a per-request timing breakdown (DNS, connect, TLS, server, transfer, total) to stderr after the command runs. |
| `-h`, `--help` | Show help for any command. |

## Environment variables

| Variable | Used by | Description |
| -------- | ------- | ----------- |
| `BHATTI_URL` | CLI | API endpoint. Falls back when `--url` is not set and the config file has no `api_url`. |
| `BHATTI_TOKEN` | CLI | API key. Same fallback semantics as `BHATTI_URL`. |
| `BHATTI_CONFIG` | CLI + server | Override path to the config file. When set, layered loading is bypassed and only this file is read. |
| `BHATTI_LOG_LEVEL` | server (`bhatti serve`) | `debug`, `info` (default), `warn`, `error`. |
| `BHATTI_FORCE_STREAM` | CLI (`bhatti exec`) | Set to `1` to force NDJSON streaming output even when stdout is not a TTY. Useful in CI logs where you want real-time progress. |

## Configuration precedence

Per-call flag → config file → environment variable → built-in default.

```
--url <x>            (highest)
api_url: <x>         (in config file)
BHATTI_URL=<x>       (env var)
http://localhost:8080 (default, lowest)
```

The config file is the primary source — `bhatti setup` writes it and most users never touch the rest. Environment variables are the fallback for CI pipelines and scripts.

See [Configuration](/docs/reference/config/) for the file format and layered loading rules (`/etc/bhatti/config.yaml` for system settings, `~/.bhatti/config.yaml` for client credentials).

## Output formats

**Human (default).** Compact, TTY-friendly. `bhatti list` prints columns; `bhatti inspect` prints kubectl-`describe`-style details with live disk usage on running VMs.

**`--json`.** Universally supported. Drops all human formatting; emits the raw API response (for queries) or a small status object (for mutations).

**`bhatti list -o wide`.** Adds CPUs, memory, disk, and image columns to `list`. Equivalent to `kubectl get -o wide`.

**Streaming exec output.** `bhatti exec` auto-detects how to format its output:

- Stdout is a TTY → NDJSON streaming, line-by-line, flushed immediately.
- Stdout is a pipe or `--json` is set → buffered JSON with `{exit_code, stdout, stderr}`.
- Override with `BHATTI_FORCE_STREAM=1` to force streaming when piping.

## Exit codes

| Code | Meaning |
| ---- | ------- |
| `0` | Success. |
| `1` | CLI or API error (see stderr for details and recovery hints). |
| `<n>` | `bhatti exec` only — the child process's exit code is forwarded verbatim, so a script's `$?` reflects the command's true status. |

Most destructive commands (`destroy`, `volume delete`, `image delete`, `snapshot delete`, `volume backup-delete`, `user delete`) require confirmation. Pass `-y` / `--yes` to skip the prompt; without `-y` in a non-interactive shell, the command exits `1`.

`secret delete` is the exception — it doesn't prompt. Make sure you have the right name.

## Shell completion

```bash
bhatti completion bash > /etc/bash_completion.d/bhatti
bhatti completion zsh  > "${fpath[1]}/_bhatti"
bhatti completion fish > ~/.config/fish/completions/bhatti.fish
```

Sandbox-name completion uses a local cache (`/tmp/bhatti-completions-<uid>`) updated by `create`, `destroy`, and `list`. It never hits the network — instant, works offline.
