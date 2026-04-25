---
title: Preview URLs
description: Publish sandbox ports with public URLs and auto-wake.
---

Give anyone access to a port inside a sandbox — no API key needed. Useful for sharing previews, demos, and webhook endpoints.

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

Published URLs work even when the sandbox is sleeping. The first request wakes it (~50ms), then everything is instant.

## Behavior

- **No auth.** Published URLs are public. Anyone with the URL can access the port.
- **HTTP and WebSocket.** Both are supported through the proxy. WebSocket connections get a 10-minute idle timeout.
- **Cleanup.** Publish rules are automatically removed when a sandbox is destroyed.
- **Rate limiting.** Per-alias and global rate limiting protect against abuse.
- **Body limit.** 50MB per request.

For all parameters, see the [API Reference](/docs/reference/api/).
