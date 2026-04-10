---
title: Web Shell
description: Shareable browser-based terminals with bhatti share.
---

Generate a URL that opens an interactive terminal in the browser — no CLI install or API key needed. Useful for sharing sandbox access with teammates or embedding in dashboards.

## CLI

```bash
bhatti share dev
# → Shell: https://api.bhatti.sh/shell/dev?token=abc123...
```

Each call generates a fresh token. The previous token is immediately invalidated — only one share link is active at a time.

### Revoke access

```bash
bhatti share dev --revoke
```

Disables the shell URL. The token is deleted and the URL stops working.

## How it works

The share URL opens a web-based terminal (xterm.js) that connects to the sandbox via WebSocket. The connection is authenticated by the token in the URL — no API key needed.

The web shell is a full PTY session, identical to `bhatti shell`. Detach by closing the browser tab; the session keeps running and scrollback is preserved. Reopen the URL to reattach.

## Security

- **One token at a time.** Each `bhatti share` call invalidates the previous token.
- **Token in URL.** Anyone with the URL has shell access. Share carefully.
- **Revocable.** `--revoke` immediately kills the token.
- **Scoped to one sandbox.** The token only grants access to the specific sandbox, not your API key or other sandboxes.

For all flags, see [CLI Reference: Networking & Sharing](/docs/reference/cli/publish/).
