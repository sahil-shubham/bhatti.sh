---
title: Interactive Shell
description: PTY sessions, detach/reattach, and scrollback.
---

## CLI

```bash
bhatti shell dev
```

Opens an interactive terminal inside the sandbox. The default shell is `/bin/zsh`.

### Detach and reattach

Press `Ctrl+\` to detach — the shell keeps running, output is captured in a 64KB scrollback buffer. Reconnect:

```bash
bhatti shell dev
```

On reattach, you get the scrollback (recent output since you disconnected) followed by live I/O. If you detach during `npm install`, reconnecting shows you what happened while you were away, then continues with live output.

### What happens on disconnect

The session *does not* receive SIGHUP. The child process keeps running. The PTY master stays open. Output flows into the scrollback ring buffer. This is different from SSH, where disconnecting kills the shell.

If another client connects to the same session, the previous client is disconnected.

## API (WebSocket)

```
GET /sandboxes/:id/ws
```

Upgrade to WebSocket. Auth via query param (`?token=...`) or `Authorization` header.

- **Terminal → WebSocket:** binary messages containing raw terminal output
- **WebSocket → Terminal:** binary messages forwarded as keystrokes; text messages with JSON `{"type":"resize","rows":N,"cols":N}` trigger terminal resize

## Sessions

Every TTY exec creates a *session*. Sessions have IDs, persist across disconnects, and are visible in `bhatti ps`.

The `init` script from sandbox creation also runs as a session (ID: `"init"`). You can attach to it to watch progress:

```bash
bhatti ps dev
# SESSSION   CMD                  TTY   RUNNING  ATTACHED
# init       npm install          yes   yes      no
# s1         /bin/zsh -li         yes   yes      yes
```

### Idle sessions

Sessions without an attached client and no recent activity are cleaned up by an idle timer. Active sessions (producing output or receiving input) are never killed.

For CLI flags and all parameters, see [CLI Reference: Execution](/docs/reference/cli/exec/) and the [API Reference](/docs/reference/api/).
