---
title: Execution & shells
description: Run commands, open shells, list active sessions, and discover listening ports inside sandboxes.
sidebar:
  label: Overview
  order: 0
---

Commands that drive execution inside a running sandbox: one-shot commands, interactive shells, and visibility into what's currently running and listening.

| Command | Description |
| ------- | ----------- |
| [`bhatti exec`](/docs/reference/cli/exec/exec/) | Run a command. Streaming or buffered output, optional timeout, optional detach. |
| [`bhatti shell`](/docs/reference/cli/exec/shell/) | Open an interactive shell with detach/reattach semantics (alias: `sh`). |
| [`bhatti ps`](/docs/reference/cli/exec/ps/) | List active sessions in a sandbox (init scripts, shells, detached execs). |
| [`bhatti ports`](/docs/reference/cli/exec/ports/) | List listening ports detected inside a sandbox. |

All commands wake cold sandboxes transparently — you don't need to start the sandbox first.

## Quick patterns

```bash
bhatti exec dev -- npm install                      # one-shot command
bhatti exec dev -- bash -c 'echo $API_KEY'          # shell expansion via /bin/bash
bhatti exec dev --timeout 60 -- long-running.sh     # cap runtime at 60s
bhatti exec dev --detach -- ./worker.sh             # run in background, return PID

bhatti shell dev                                    # interactive (Ctrl+\ to detach)
bhatti shell dev --new                              # don't reattach to a running session

bhatti ps dev                                       # what's running inside?
bhatti ports dev                                    # what's listening?
```

## See also

- [Sandbox commands](/docs/reference/cli/sandbox/) — create/list/destroy
- [Files](/docs/reference/cli/files/) — read and write files inside sandboxes
- [API: `POST /sandboxes/:id/exec`](/docs/reference/api/#run-a-command) — the underlying HTTP endpoint, streaming and detach modes
