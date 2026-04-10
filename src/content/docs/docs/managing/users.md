---
title: Users & Auth
description: Creating users, API keys, rotation, and per-user resource limits.
---

User management operates directly on the local SQLite database. Requires access to the server's data directory.

## Create a user

```bash
sudo bhatti user create --name alice --max-sandboxes 5 --max-cpus 4 --max-memory 4096
# → API key: bht_...  (shown once, save it)
```

| Flag | Default | Description |
|------|---------|-------------|
| `--name` | required | Username (must be unique) |
| `--max-sandboxes` | 5 | Maximum concurrent sandboxes |
| `--max-cpus` | 4 | Maximum vCPUs per sandbox |
| `--max-memory` | 4096 | Maximum memory (MB) per sandbox |

Give the user the API key. They run `bhatti setup` and enter it.

## List users

```bash
sudo bhatti user list
```

## Rotate API key

```bash
sudo bhatti user rotate-key alice
# → New API key: bht_...  (old key immediately invalidated)
```

The old key stops working instantly. The user needs to run `bhatti setup` again with the new key.

## Delete a user

```bash
sudo bhatti user delete alice
```

Fails if the user has active sandboxes. Destroy them first.

## Authentication

All API requests require `Authorization: Bearer <token>` except `/health`. The token is the API key from `user create`.

```bash
curl http://localhost:8080/sandboxes \
  -H "Authorization: Bearer bht_abc123..."
```

CLI users configure their key with `bhatti setup`, which saves it to `~/.bhatti/config.yaml`.

## Resource limits

Each user has per-sandbox limits for vCPUs, memory, and total sandbox count. When a user tries to create a sandbox that exceeds their limits, the request is rejected with a 403.

Limits are enforced at creation time. Existing sandboxes are not affected if limits are lowered.

## Sandbox scoping

Each user only sees their own sandboxes. `GET /sandboxes` returns only sandboxes created by the authenticated user. Users cannot access, exec into, or destroy another user's sandbox.

For all CLI flags, see [CLI Reference: Server & Admin](/docs/reference/cli/admin/).
