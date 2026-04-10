---
title: Networking & Sharing
description: "publish, unpublish, share"
---

## bhatti publish

Publish a sandbox port with a public URL.

```bash
bhatti publish dev -p 3000                  # auto-generated alias
bhatti publish dev -p 3000 -a my-app        # explicit alias → my-app.bhatti.sh
```

| Flag | Description |
|------|-------------|
| `-p, --port` | Port to publish (required) |
| `-a, --alias` | Custom alias (optional, auto-generated if omitted) |

With `-a`, the alias is used directly (`my-app.bhatti.sh`). Without it, an alias is generated from the sandbox name with a random suffix to prevent URL guessing.

Published URLs are publicly accessible without authentication. Cold sandboxes wake automatically when a request arrives.

## bhatti unpublish

Remove a published port. The URL stops working immediately.

```bash
bhatti unpublish dev -p 3000
```

| Flag | Description |
|------|-------------|
| `-p, --port` | Port to unpublish (required) |

## bhatti share

Generate a shareable web shell URL for a sandbox.

```bash
bhatti share dev
# → Shell: https://api.bhatti.sh/shell/dev?token=abc123...
```

Each call generates a fresh token — the previous token is immediately invalidated.

```bash
bhatti share dev --revoke    # disable shell access
bhatti share dev --json      # output URL as JSON
```

| Flag | Description |
|------|-------------|
| `--revoke` | Disable shell access (invalidate token) |

The URL opens a browser-based terminal (xterm.js) connected via WebSocket. No API key needed — the token in the URL provides access to that specific sandbox only.
