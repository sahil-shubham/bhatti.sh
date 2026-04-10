---
title: Preview URLs
description: Publish sandbox ports with public URLs and auto-wake.
---

Publish a port inside a sandbox as a public URL. No authentication required to access the URL — useful for sharing previews, demos, or webhook endpoints.

## CLI

```bash
bhatti publish dev -p 3000                  # auto-generated alias
bhatti publish dev -p 3000 -a my-app        # explicit alias → my-app.bhatti.sh
```

```bash
bhatti unpublish dev -p 3000
```

### How aliases work

With `-a my-app`, the URL is `https://my-app.bhatti.sh`. Without `-a`, an alias is generated from the sandbox name with a random suffix (e.g., `dev-k3m9x2.bhatti.sh`) to prevent URL guessing.

## API

```bash
# Publish
curl -X POST http://localhost:8080/sandboxes/dev/publish \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"port": 3000, "alias": "my-app"}'

# List published ports
curl http://localhost:8080/sandboxes/dev/publish \
  -H "Authorization: Bearer $TOKEN"

# Unpublish
curl -X DELETE http://localhost:8080/sandboxes/dev/publish/3000 \
  -H "Authorization: Bearer $TOKEN"
```

## Auto-wake

Published URLs work even when the sandbox is cold (snapshotted to disk). When a request arrives:

1. The proxy looks up the alias in an in-memory LRU cache (10K entries)
2. If the sandbox is cold, `ensureHot()` restores it (~50ms)
3. Concurrent requests to the same cold sandbox share one wake via `singleflight`
4. The request is proxied to the port inside the VM

From the visitor's perspective, the first request to a cold sandbox takes ~50ms extra. Subsequent requests are instant.

## Behavior

- **No auth.** Published URLs are public. Anyone with the URL can access the port.
- **HTTP and WebSocket.** Both are supported through the proxy. WebSocket connections get a 10-minute idle timeout.
- **Cleanup.** Publish rules are automatically removed when a sandbox is destroyed.
- **Rate limiting.** Per-alias and global rate limiting protect against abuse.
- **Body limit.** 50MB per request.

For all parameters, see the [API Reference](/docs/reference/api/).
