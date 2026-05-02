---
title: Sandbox commands
description: Lifecycle commands for sandbox VMs — create, list, inspect, edit, stop, start, destroy.
sidebar:
  label: Overview
  order: 0
---

Sandboxes are isolated Linux VMs. These commands cover the full lifecycle: create them, look at them, change mutable settings, pause and resume them on disk, and tear them down.

| Command | Description |
| ------- | ----------- |
| [`bhatti create`](/docs/reference/cli/sandbox/create/) | Create a new sandbox VM. Optional flags cover CPU, memory, env vars, init scripts, volumes, secrets, and file injection. |
| [`bhatti list`](/docs/reference/cli/sandbox/list/) | List your sandboxes (alias: `ls`). `-o wide` adds resource columns. |
| [`bhatti inspect`](/docs/reference/cli/sandbox/inspect/) | Show full details for one sandbox (alias: `info`) — kubectl-`describe` style. |
| [`bhatti edit`](/docs/reference/cli/sandbox/edit/) | Toggle mutable settings. Currently only `--keep-hot` / `--allow-cold`. |
| [`bhatti stop`](/docs/reference/cli/sandbox/stop/) | Snapshot to disk and free memory. |
| [`bhatti start`](/docs/reference/cli/sandbox/start/) | Resume from snapshot. Continues exactly where it left off. |
| [`bhatti destroy`](/docs/reference/cli/sandbox/destroy/) | Permanently destroy a sandbox (alias: `rm`). Volumes are detached, not deleted. |

All commands accept either the sandbox name or its ID. Names are easier; IDs are stable across renames.

## Quick patterns

```bash
bhatti create --name dev --cpus 2 --memory 1024
bhatti ls -o wide
bhatti inspect dev
bhatti exec dev -- npm install
bhatti stop dev                       # save state, free memory
bhatti start dev                      # resume from where it stopped
bhatti destroy dev -y
```

In normal operation you don't need `stop` and `start` — idle sandboxes are paused and resumed automatically. See [Thermal states](/docs/under-the-hood/thermal-states/) for the engineering. Use them to control thermal state explicitly when you know a sandbox will be idle for a while.

## See also

- [Execution & shells](/docs/reference/cli/exec/) — `exec`, `shell`, `ps`, `ports`
- [Files](/docs/reference/cli/files/) — read/write files inside a sandbox
- [Networking & sharing](/docs/reference/cli/networking/) — `publish`, `share`
- [API: `POST /sandboxes`](/docs/reference/api/#create-a-sandbox)
