---
title: API Reference
description: HTTP API endpoints for sandboxes, exec, files, sessions, templates, images, and volumes.
---

The bhatti server exposes a REST API on the configured listen address (default `:8080`). All endpoints require an `Authorization: Bearer <token>` header unless otherwise noted.

Responses are JSON unless otherwise specified. Errors return `{"error": "message"}` with an appropriate HTTP status code.

## Sandboxes

### Create sandbox

```http
POST /sandboxes
```

```json
{
  "name": "dev",
  "cpus": 2,
  "memory_mb": 1024,
  "env": {"NODE_ENV": "production", "API_KEY": "sk-abc"},
  "init": "npm install && npm run dev",
  "keep_hot": false,
  "new_volumes": [{"name": "data", "size_mb": 256, "mount": "/data"}],
  "volumes": ["existing-vol"],
  "template_id": "tmpl-abc123",
  "image": "my-image"
}
```

All fields are optional. Defaults: 1 vCPU, 512 MB RAM, auto-generated name.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | auto | Must match `[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}` |
| `cpus` | int | `1` | vCPUs (capped by user's per-sandbox limit) |
| `memory_mb` | int | `512` | Memory in MB |
| `env` | object | `{}` | Environment variables for all commands |
| `init` | string | — | Script that runs at boot as an attachable session |
| `keep_hot` | bool | `false` | Prevent automatic pausing/snapshotting |
| `new_volumes` | array | — | Volumes to create and attach |
| `volumes` | array | — | Existing volume names to attach |
| `template_id` | string | — | Create from a template |
| `image` | string | — | Rootfs image to use |

**Response:** `201 Created` with the sandbox object.

### List sandboxes

```http
GET /sandboxes
```

Returns all sandboxes owned by the authenticated user. Includes thermal state, published URLs, and resource usage. Listing does not wake cold sandboxes.

### Inspect sandbox

```http
GET /sandboxes/:id
```

Returns full sandbox details as JSON.

### Edit sandbox

```http
PATCH /sandboxes/:id
```

```json
{
  "cpus": 4,
  "keep_hot": true
}
```

Update mutable properties of a sandbox.

### Destroy sandbox

```http
DELETE /sandboxes/:id
```

Stops the VM, deletes all associated files, releases the IP, and removes the TAP device. Attached volumes are detached but not deleted.

### Stop sandbox

```http
POST /sandboxes/:id/stop
```

Snapshot to disk and free memory.

### Start sandbox

```http
POST /sandboxes/:id/start
```

Restore from snapshot — all processes, memory, and network connections resume.

---

## Exec

### Run a command

```http
POST /sandboxes/:id/exec
```

```json
{
  "cmd": ["echo", "hello"],
  "env": {"MY_VAR": "value"}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `cmd` | array | Command and arguments |
| `env` | object | Per-request env vars (override sandbox env) |

#### Buffered response (default)

```json
{"exit_code": 0, "stdout": "hello\n", "stderr": ""}
```

#### Streaming response

Send `Accept: application/x-ndjson` to get real-time output:

```json
{"type":"stdout","data":"Installing dependencies...\n"}
{"type":"stderr","data":"npm warn deprecated ...\n"}
{"type":"exit","exit_code":0}
```

Each line is flushed immediately. Cold sandboxes wake automatically before executing.

### List sessions

```http
GET /sandboxes/:id/sessions
```

Returns all active sessions (init scripts, shells, background processes) with session IDs, commands, and whether a client is attached.

### Kill session

```http
DELETE /sandboxes/:id/sessions/:session_id
```

Sends `SIGKILL` to the process group of the specified session.

---

## Files

All file operations use the same base path with query parameters.

### Read file

```http
GET /sandboxes/:id/files?path=/workspace/app.js
```

Returns raw file content with `Content-Type: application/octet-stream`.

| Param | Type | Description |
|-------|------|-------------|
| `path` | string | Absolute path inside the sandbox |
| `offset` | int | 1-indexed line number to start from |
| `limit` | int | Max lines to return |
| `max_bytes` | int | Max bytes to return |

Whichever limit hits first stops the read. `X-File-Size` response header contains the total file size.

### Write file

```http
PUT /sandboxes/:id/files?path=/workspace/app.js&mode=0644
```

Body: raw file content.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | string | — | Absolute path inside the sandbox |
| `mode` | string | `0644` | File permissions (octal) |

`Content-Length` header is required. Max 100 MB per write. Writes are atomic — temp file, fsync, rename.

### Stat file

```http
HEAD /sandboxes/:id/files?path=/workspace/app.js
```

Response headers: `X-File-Size`, `X-File-Mode`, `X-File-IsDir`.

### List directory

```http
GET /sandboxes/:id/files?path=/workspace&ls=true
```

```json
[
  {"name": "app.js", "size": 1234, "mode": "0644", "is_dir": false, "mtime": 1711100000},
  {"name": "node_modules", "size": 4096, "mode": "0755", "is_dir": true, "mtime": 1711100000}
]
```

Capped at 10,000 entries. A sentinel entry indicates truncation if the cap is hit.

---

## Publish (Preview URLs)

### Publish a port

```http
POST /sandboxes/:id/publish
```

```json
{"port": 3000, "alias": "my-app"}
```

| Field | Type | Description |
|-------|------|-------------|
| `port` | int | Port inside the sandbox to publish |
| `alias` | string | Optional. URL alias → `<alias>.bhatti.sh`. Auto-generated if omitted. |

Published URLs are public (no auth required). Cold sandboxes wake on first request.

### Unpublish a port

```http
DELETE /sandboxes/:id/publish
```

```json
{"port": 3000}
```

---

## Templates

### Create template

```http
POST /templates
```

```json
{
  "sandbox_id": "sandbox-abc",
  "name": "my-template"
}
```

Creates a template from an existing sandbox's current state.

### List templates

```http
GET /templates
```

### Delete template

```http
DELETE /templates/:id
```

### Create sandbox from template

Use `template_id` in the [Create sandbox](#create-sandbox) request. Template fields are used as defaults; fields in the create request override them.

---

## Images

### List images

```http
GET /images
```

### Share image

```http
POST /images/:name/share
```

Makes the image available to all users on the server.

### Unshare image

```http
DELETE /images/:name/share
```

### Delete image

```http
DELETE /images/:name
```

---

## Volumes

### Create volume

```http
POST /volumes
```

```json
{"name": "data", "size_mb": 256}
```

### List volumes

```http
GET /volumes
```

### Delete volume

```http
DELETE /volumes/:name
```

### Backup volume

```http
POST /volumes/:name/backup
```

### List backups

```http
GET /volumes/:name/backups
```

### Restore from backup

```http
POST /volumes/:name/restore
```

```json
{"backup_id": "backup-abc"}
```

### Delete backup

```http
DELETE /volumes/:name/backups/:backup_id
```

---

## Authentication

All requests require `Authorization: Bearer <token>`. Tokens are configured via `bhatti setup` or the `BHATTI_TOKEN` environment variable.

```bash
curl http://localhost:8080/sandboxes \
  -H "Authorization: Bearer bht_your_key_here"
```

Invalid or missing tokens return `401 Unauthorized`.

---

## Error responses

All errors follow the same shape:

```json
{"error": "sandbox not found"}
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request (invalid parameters) |
| `401` | Unauthorized (missing or invalid token) |
| `404` | Resource not found |
| `409` | Conflict (e.g., name already taken) |
| `413` | Payload too large (file write > 100 MB) |
| `500` | Internal server error |
