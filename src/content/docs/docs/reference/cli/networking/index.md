---
title: Networking & sharing
description: Publish ports with public URLs, share browser-based shells.
sidebar:
  label: Overview
  order: 0
---

Expose sandbox services to the world (or a teammate) without an API key on the receiver's side.

| Command | Description |
| ------- | ----------- |
| [`bhatti publish`](/docs/reference/cli/networking/publish/) | Publish a sandbox port at a public URL. Cold sandboxes wake on the first request. |
| [`bhatti unpublish`](/docs/reference/cli/networking/unpublish/) | Remove a published port. |
| [`bhatti share`](/docs/reference/cli/networking/share/) | Generate a one-shot URL that opens an interactive terminal in the browser. |

Both `publish` and `share` produce URLs that don't require an API key. Treat them like any other secret — anyone with the URL has access.

## Quick patterns

```bash
# Publish on a friendly subdomain
bhatti publish dev -p 3000 -a my-app
# → https://my-app.bhatti.sh

# Auto-generated alias (random suffix prevents URL guessing)
bhatti publish dev -p 3000
# → https://dev-k3m9x2.bhatti.sh

# Publish + give a teammate a browser shell in one call
bhatti publish dev -p 3000 -a demo --shell

# Share a sandbox shell over the web
bhatti share dev
# → https://api.bhatti.sh/_shell/<id>#token=...

# Revoke any active share link
bhatti share dev --revoke

# Tear down a published port
bhatti unpublish dev -p 3000
```

## Domain mode vs. path-based

Public URLs at `https://<alias>.<your-zone>` only work when the server is configured with a [custom domain](/docs/managing/custom-domain/). Without one, `bhatti publish` falls back to a path-based proxy:

```text
http://<api-host>/sandboxes/<id>/proxy/<port>/
```

That URL still works, but it requires Bearer auth. Useful for development; not suitable for sharing publicly. See [`bhatti publish`](/docs/reference/cli/networking/publish/) for the exact fallback behaviour.
