---
title: CLI Reference
description: Complete command reference for the bhatti CLI.
---

`bhatti` is a single binary — `bhatti serve` starts the daemon, everything else is a CLI client that talks to the daemon's HTTP API.

All sandbox commands accept sandbox name or ID interchangeably.

## Global flags

| Flag | Description |
|------|-------------|
| `--url` | API endpoint (overrides config) |
| `--token` | API key (overrides config) |
| `--json` | Output as JSON |
| `--timing` | Show request timing breakdown |
| `--data-dir` | Data directory containing state.db (for user/admin commands) |

## Command groups

- [Sandbox Commands](/docs/reference/cli/sandbox/) — `create`, `edit`, `list`, `inspect`, `destroy`, `stop`, `start`
- [Execution & Shells](/docs/reference/cli/exec/) — `exec`, `shell`, `ps`
- [File Operations](/docs/reference/cli/files/) — `file read`, `file write`, `file ls`
- [Networking & Sharing](/docs/reference/cli/publish/) — `publish`, `unpublish`, `share`
- [Resources](/docs/reference/cli/resources/) — `image`, `volume`, `secret`, `snapshot`
- [Server & Admin](/docs/reference/cli/admin/) — `serve`, `setup`, `user`, `admin`, `update`, `completion`
