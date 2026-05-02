---
title: API Reference
description: Every HTTP endpoint with a runnable curl example, the response shape, and notable status codes.
---

The bhatti server exposes a REST API over HTTP. Every authenticated endpoint requires a Bearer token; unauthenticated endpoints are limited to `/health` and `/_shell/<id>` (the embedded web-shell page).

This page is the canonical hand-curated reference. Each endpoint shows a runnable `curl` and the response shape. Anything not in the curl example uses the documented default. The OpenAPI spec lives at [`docs/openapi.yaml`](https://github.com/sahil-shubham/bhatti/blob/main/docs/openapi.yaml) for tooling.

## Base URL

| Mode | API base | Public proxy |
| ---- | -------- | ------------ |
| Default (`listen: :8080`) | `http://localhost:8080` | path-based at `/sandboxes/<id>/proxy/<port>/` |
| Path-based public proxy (`public_proxy_listen: :8443`) | `http://localhost:8080` | `http://<host>:8443/<alias>/` |
| Domain mode (`domain.api_host`, `domain.proxy_zone`) | `https://api.<your-domain>` | `https://<alias>.<your-domain>` |

## Authentication

All endpoints except `/health` and `/_shell/...` require a Bearer token in the `Authorization` header:

```http
Authorization: Bearer bht_abc123def456...
```

Tokens come from [`bhatti user create`](/docs/reference/cli/admin/user-create/). The CLI loads them from `~/.bhatti/config.yaml`.

**WebSocket endpoints use the same Bearer header.** There is no `?token=…` query-param auth — leaving the token out of URLs eliminates accidental logging in proxy access logs.

The web shell is the exception: the URL contains `#token=…` in the **fragment** (never sent to the server), and the embedded page extracts the token client-side and uses it as a Bearer header on the WebSocket connection.

## Response shape

JSON for every endpoint. Errors use `{"error": "...", "request_id": "..."}`:

```json
{"error": "sandbox not found", "request_id": "req_a1b2c3d4"}
```

`request_id` is included on every error response; quote it when reporting bugs.

## Status codes

| Code | Meaning |
| ---- | ------- |
| `200` | OK. |
| `201` | Created. Used for resource-creation endpoints. |
| `202` | Accepted. Used for async tasks (image pull) — body contains a `task_id`. |
| `204` | No content. Used by `unpublish`. |
| `400` | Validation error. Body has `{"error": "..."}`. |
| `401` | Missing or invalid Bearer token. |
| `403` | Forbidden — typically a per-sandbox cap (CPU, memory) being exceeded. |
| `404` | Resource not found. |
| `409` | Conflict — name already exists, or volume is attached when an op needs it detached. |
| `413` | Request too large (file write > 100 MB). |
| `429` | Rate-limited or quota exceeded (`max-sandboxes`, `max-cpus`, etc). |
| `500` | Internal server error. |
| `501` | Endpoint exists but the server isn't configured for it (e.g. backups without an `s3_*` config). |
| `502` | Bad gateway from the reverse proxy — the sandbox process isn't listening on the requested port. |

## Response headers

The server stamps every response with:

- `X-Bhatti-Version` — server version. CLI clients use this to detect server upgrades.
- `X-Bhatti-Min-CLI` — the minimum CLI version the server requires. Clients older than this should upgrade.
- `X-Bhatti-Existing: true` — set on `POST /sandboxes` when the request was idempotent (a sandbox with that name already existed).

## Async tasks

Long-running operations like `POST /images/pull` return immediately with `202 Accepted` and a body like:

```json
{"task_id": "tsk_abc123", "status": "running"}
```

Poll `GET /tasks/:id` until `status` is `completed` or `failed`. The `progress` field, when present, contains a human-readable progress string the CLI can display.

---

# System

## Health check

```http
GET /health
```

No auth required. Lightweight check.

```bash
curl http://localhost:8080/health
```

```json
{"status": "ok", "uptime": "2h15m30s"}
```

---

# Sandboxes

## List sandboxes

```http
GET /sandboxes
```

Returns sandboxes owned by the authenticated user, enriched with thermal state and any published URLs. Listing does **not** wake cold sandboxes.

```bash
curl http://localhost:8080/sandboxes \
  -H "Authorization: Bearer $TOKEN"
```

```json
[
  {
    "id": "a1b2c3d4",
    "name": "dev",
    "status": "running",
    "thermal": "hot",
    "ip": "192.168.137.2",
    "cpus": 2,
    "memory_mb": 1024,
    "image": "minimal",
    "created_at": "2026-04-29T15:21:48Z",
    "urls": ["https://dev-k3m9x2.bhatti.sh"]
  }
]
```

## Create a sandbox

```http
POST /sandboxes
```

```bash
curl -X POST http://localhost:8080/sandboxes \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "dev",
    "cpus": 2,
    "memory_mb": 1024,
    "env": {"NODE_ENV": "production"},
    "init": "cd /workspace && npm install",
    "image": "minimal",
    "persistent_volumes": [
      {"name": "workspace", "mount": "/workspace", "auto_create": false}
    ],
    "secrets": ["OPENAI_KEY"],
    "files": [
      {"guest_path": "/etc/app/config.json", "content": "<base64>", "mode": "0644"}
    ]
  }'
```

**Request fields:**

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `name` | string | auto | Pattern: `[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}`. |
| `cpus` | float | `1` | Fractional values allowed. Capped at user's `max_cpus_per_sandbox`. |
| `memory_mb` | int | `1024` | Capped at user's `max_memory_mb_per_sandbox`. |
| `disk_size_mb` | int | image size | Resize the rootfs at create time. |
| `env` | object | — | Env vars baked into the config drive. |
| `init` | string | — | Boot-time script. Runs as a session named `init`. |
| `keep_hot` | bool | `false` | Disables the thermal manager for this sandbox. |
| `hugepages` | bool | `false` | 2 MB hugepages. Faster boot, no diff snapshots. |
| `image` | string | `minimal` | Image name from `GET /images`. |
| `template_id` | string | — | Create from a template. |
| `persistent_volumes` | array | — | `[{name, mount, auto_create, read_only, size_mb}]`. |
| `secrets` | array | — | Names of stored secrets to inject as env vars. **Ignored when `template_id` is set.** |
| `files` | array | — | `[{guest_path, content (base64), mode}]`. **Ignored when `template_id` is set.** |
| `new_volumes` | array | — | **Legacy** equivalent of `persistent_volumes`. The CLI no longer sends these. |
| `volumes` | array | — | **Legacy** equivalent. |

**Responses:**

- `201 Created` with the sandbox object.
- `200 OK` + `X-Bhatti-Existing: true` if a non-destroyed sandbox with that name already exists. Idempotent — safe to retry from scripts.
- `400` for invalid name / size / etc.
- `403` if `cpus` or `memory_mb` exceed the user's per-sandbox cap.
- `429` if the user is at their `max-sandboxes` cap.

## Get a sandbox

```http
GET /sandboxes/:id
```

```bash
curl http://localhost:8080/sandboxes/dev \
  -H "Authorization: Bearer $TOKEN"
```

Returns the full sandbox record. Both name and ID work as `:id`.

## Update a sandbox

```http
PATCH /sandboxes/:id
```

Currently only `keep_hot` is mutable. All other fields (cpus, memory, image) are immutable after creation — destroy and recreate.

```bash
curl -X PATCH http://localhost:8080/sandboxes/dev \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"keep_hot": true}'
```

Setting `keep_hot: true` on a stopped sandbox immediately wakes it.

## Destroy a sandbox

```http
DELETE /sandboxes/:id
```

```bash
curl -X DELETE http://localhost:8080/sandboxes/dev \
  -H "Authorization: Bearer $TOKEN"
```

```json
{"status": "destroyed"}
```

Persistent volumes attached to the sandbox are detached (not deleted). Published URLs are cleaned up.

## Stop a sandbox

```http
POST /sandboxes/:id/stop
```

Snapshot to disk and free memory. Resume with `POST /sandboxes/:id/start`. The first stop creates a full snapshot; subsequent stops create diff snapshots (dirty pages only).

```bash
curl -X POST http://localhost:8080/sandboxes/dev/stop \
  -H "Authorization: Bearer $TOKEN"
```

## Start a sandbox

```http
POST /sandboxes/:id/start
```

Restore from snapshot.

```bash
curl -X POST http://localhost:8080/sandboxes/dev/start \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"force": true}'
```

`force: true` retries even if the sandbox is in `unknown` state from a previously failed restore.

---

# Execution & shells

## Run a command

```http
POST /sandboxes/:id/exec
```

```bash
curl -X POST http://localhost:8080/sandboxes/dev/exec \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cmd": ["echo", "hello"]}'
```

```json
{"exit_code": 0, "stdout": "hello\n", "stderr": ""}
```

**Request fields:**

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `cmd` | array | (required) | Command and arguments. |
| `timeout_sec` | int | `300` | Max `86400` (24h). |
| `detach` | bool | `false` | Fire-and-forget. Returns `{pid, output_file, detached: true}` immediately. |
| `output_file` | string | auto | When `detach: true`, the guest path to redirect output to. |

This endpoint does **not** accept an `env` field. Env vars are baked into the sandbox's config drive at creation time (`--env`, `--secret`). To pass per-call env vars, use the WebSocket exec path below.

### Streaming output

Set `Accept: application/x-ndjson`:

```bash
curl -N -X POST http://localhost:8080/sandboxes/dev/exec \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/x-ndjson" \
  -d '{"cmd":["npm","install"]}'
```

```json
{"type":"stdout","data":"Installing dependencies...\n"}
{"type":"stderr","data":"npm warn deprecated...\n"}
{"type":"exit","exit_code":0}
```

Each line is flushed immediately. `type` is `stdout`, `stderr`, `exit`, or `error`.

Cold sandboxes wake automatically before executing.

## Interactive shell (WebSocket)

```http
GET /sandboxes/:id/ws
```

Upgrade to WebSocket. Authentication via `Authorization: Bearer ...` header on the upgrade request.

| Query param | Description |
| --- | --- |
| `session=<id>` | Reattach to an existing session by ID. |
| `new=true` | Force a new session even if one is currently attached. |

**Wire protocol:**
- **Server → client (binary):** raw terminal output.
- **Server → client (text):** initial `{"type":"session","session_id":"s1"}` message; thereafter only on session events.
- **Client → server (binary):** keystrokes (forwarded to the PTY).
- **Client → server (text JSON):** `{"type":"resize","rows":N,"cols":N}` or `{"cmd":[...], "env":{}, "max_idle_sec":N}` (first message of a non-attached session — this is where per-call env injection lives).

Detach by closing the connection. The session keeps running.

## List sessions

```http
GET /sandboxes/:id/sessions
```

```bash
curl http://localhost:8080/sandboxes/dev/sessions \
  -H "Authorization: Bearer $TOKEN"
```

```json
[
  {"session_id": "init", "argv": "npm install", "running": true, "attached": false, "created_at": 1761792000},
  {"session_id": "s1", "argv": "/bin/zsh -li", "running": true, "attached": true, "created_at": 1761792100}
]
```

## List listening ports (one sandbox)

```http
GET /sandboxes/:id/ports
```

```bash
curl http://localhost:8080/sandboxes/dev/ports \
  -H "Authorization: Bearer $TOKEN"
```

```json
[
  {"sandbox_id": "a1b2c3d4", "container_port": 3000, "proxy_url": "/sandboxes/a1b2c3d4/proxy/3000/"}
]
```

The `proxy_url` is path-relative; prepend the API base URL for a full reachable URL.

## List listening ports (all sandboxes)

```http
GET /ports
```

Same row shape as above; covers every sandbox the authenticated user owns.

---

# Files

All file operations target the same path with query parameters.

## Read a file

```http
GET /sandboxes/:id/files?path=/path
```

Returns raw file content with `Content-Type: application/octet-stream`. The `X-File-Size` header always carries the total size (so clients can detect truncation).

```bash
curl "http://localhost:8080/sandboxes/dev/files?path=/workspace/app.js" \
  -H "Authorization: Bearer $TOKEN" \
  -o app.js
```

**Server-side truncation:**

```bash
curl "http://localhost:8080/sandboxes/dev/files?path=/var/log/agent.log&offset=1&limit=2000&max_bytes=51200" \
  -H "Authorization: Bearer $TOKEN"
```

| Param | Type | Description |
| --- | --- | --- |
| `path` | string | Absolute path inside the sandbox. |
| `offset` | int | 1-indexed line number to start from. |
| `limit` | int | Max lines to return. |
| `max_bytes` | int | Max bytes to return. |

Whichever limit hits first stops the read.

## List a directory

```http
GET /sandboxes/:id/files?path=/dir&ls=true
```

```bash
curl "http://localhost:8080/sandboxes/dev/files?path=/workspace&ls=true" \
  -H "Authorization: Bearer $TOKEN"
```

```json
[
  {"name": "app.js", "size": 1234, "mode": "0644", "is_dir": false, "mtime": 1761792345},
  {"name": "node_modules", "size": 4096, "mode": "0755", "is_dir": true, "mtime": 1761792500}
]
```

Capped at 10 000 entries; a sentinel row indicates truncation if hit.

## Stat a file

```http
HEAD /sandboxes/:id/files?path=/path
```

```bash
curl -I "http://localhost:8080/sandboxes/dev/files?path=/workspace/app.js" \
  -H "Authorization: Bearer $TOKEN"
```

Response headers:

| Header | Description |
| --- | --- |
| `X-File-Size` | Size in bytes. |
| `X-File-Mode` | Octal mode, e.g. `0644`. |
| `X-File-IsDir` | `true` or `false`. |

## Write a file

```http
PUT /sandboxes/:id/files?path=/path[&mode=0644]
```

Body is the raw content. `Content-Length` is required (chunked transfer-encoding is rejected).

```bash
curl -X PUT "http://localhost:8080/sandboxes/dev/files?path=/workspace/app.js&mode=0644" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Length: 25" \
  --data-binary 'console.log("hello world")'
```

```json
{"status": "ok"}
```

Writes are atomic (temp file + fsync + rename). 100 MB hard cap.

---

# Networking

## Reverse proxy

```http
ANY /sandboxes/:id/proxy/:port/*path
```

Tunnels HTTP and WebSocket through the engine into the sandbox. The path after `/proxy/<port>/` is forwarded verbatim to `localhost:<port>` inside the VM. Bearer auth required.

Useful for development. For public, auth-free URLs, use [`publish`](#publish-a-port).

```bash
curl http://localhost:8080/sandboxes/dev/proxy/3000/api/users \
  -H "Authorization: Bearer $TOKEN"
```

`502` is returned if no process is listening on the port.

## Publish a port

```http
POST /sandboxes/:id/publish
```

```bash
curl -X POST http://localhost:8080/sandboxes/dev/publish \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"port": 3000, "alias": "my-app"}'
```

```json
{
  "id": "pub_a1b2c3d4",
  "sandbox_id": "a1b2c3d4",
  "port": 3000,
  "alias": "my-app",
  "url": "https://my-app.bhatti.sh",
  "created_at": "2026-04-30T17:00:00Z"
}
```

If `alias` is omitted, an alias is auto-generated as `<sandbox-name>-<6-hex>`. `409` is returned on alias collision.

The `url` value depends on the server config:

| Server config | URL format |
| --- | --- |
| `domain.proxy_zone: bhatti.sh` | `https://my-app.bhatti.sh` |
| `public_proxy_listen: :8443` only | `http://<host>:8443/my-app/` |
| Neither | `(no public proxy configured) alias: my-app` — the CLI surfaces a hint to use the proxy URL. |

## List published ports

```http
GET /sandboxes/:id/publish
```

Returns an array of publish rules with their generated URLs.

## Unpublish a port

```http
DELETE /sandboxes/:id/publish/:port
```

```bash
curl -X DELETE http://localhost:8080/sandboxes/dev/publish/3000 \
  -H "Authorization: Bearer $TOKEN"
```

`204 No Content`.

## Mint a shell token

```http
POST /sandboxes/:id/shell-token
```

Generates a new web-shell token bound to this sandbox. Each call invalidates the previous token — only one is active at a time.

```bash
curl -X POST http://localhost:8080/sandboxes/dev/shell-token \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "url": "https://api.bhatti.sh/_shell/a1b2c3d4#token=k3m9x2qr...",
  "token": "k3m9x2qr..."
}
```

The token is in the URL **fragment** (`#token=...`); fragments are not sent to the server. The `_shell` page extracts the token client-side and uses it as a Bearer header on the WebSocket.

## Revoke a shell token

```http
DELETE /sandboxes/:id/shell-token
```

The previously-active token (if any) is invalidated immediately.

---

# Templates

Templates are reusable sandbox blueprints. The CLI doesn't expose them yet; reach for the API directly.

```http
GET /templates
POST /templates
GET /templates/:id
DELETE /templates/:id
```

```bash
curl -X POST http://localhost:8080/templates \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "node-dev",
    "cpus": 2,
    "memory_mb": 1024,
    "image": "minimal",
    "env": {"NODE_ENV": "development"},
    "user_data": "cd /workspace && npm install",
    "secrets": ["OPENAI_KEY"]
  }'
```

Use `template_id` in `POST /sandboxes` to create a sandbox from a template. Template fields are defaults; per-request fields override them. **Note:** the template path silently drops request-side `secrets` and `files` arrays — set them on the template instead, or don't use a template.

---

# Secrets

Encrypted at rest with [age](https://age-encryption.org/), scoped per user.

## List secrets

```http
GET /secrets
```

Returns an array of `{name, created_at, updated_at}`. Values are never returned.

## Create or update a secret

```http
POST /secrets
```

```bash
curl -X POST http://localhost:8080/secrets \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "OPENAI_KEY", "value": "sk-..."}'
```

Re-posting with an existing name updates the value silently.

## Delete a secret

```http
DELETE /secrets/:name
```

```bash
curl -X DELETE http://localhost:8080/secrets/OPENAI_KEY \
  -H "Authorization: Bearer $TOKEN"
```

---

# Volumes

Persistent ext4 volumes. Several operations require the volume to be detached (no active sandbox attachments) and return `409` otherwise: `delete`, `resize`, `clone` (snapshot), `restore`.

## List volumes

```http
GET /volumes
```

Returns an array of volume records including current attachments.

## Create a volume

```http
POST /volumes
```

```bash
curl -X POST http://localhost:8080/volumes \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "workspace", "size_mb": 5120}'
```

`429` if the user is over their storage quota.

## Get a volume

```http
GET /volumes/:name
```

## Delete a volume

```http
DELETE /volumes/:name
```

`409` if attached.

## Resize a volume

```http
POST /volumes/:name/resize
```

```bash
curl -X POST http://localhost:8080/volumes/workspace/resize \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"size_mb": 10240}'
```

`new_size > current_size` only — shrinking is not supported. `409` if attached.

## Clone a volume

```http
POST /volumes/:name/snapshot
```

Independent point-in-time copy. Source must be detached.

```bash
curl -X POST http://localhost:8080/volumes/workspace/snapshot \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "workspace-pre-upgrade"}'
```

---

# Backups

Volume backups to S3-compatible storage. Requires a `backup` block in the server config; otherwise every endpoint returns `501`.

## List backups for a volume

```http
GET /volumes/:name/backups
```

## Trigger a backup

```http
POST /volumes/:name/backups
```

Compresses (zstd) and uploads. Does not require the volume to be detached, but writes in flight at backup time may produce an inconsistent snapshot — stop the sandbox first if consistency matters.

## Restore from a backup

```http
POST /volumes/:name/backups/restore
```

```bash
curl -X POST http://localhost:8080/volumes/workspace/backups/restore \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"backup_id": "bk_a1b2c3d4"}'
```

`409` if attached.

## Delete a backup

```http
DELETE /volumes/:name/backups/:backup_id
```

---

# Images

## List images

```http
GET /images
```

Returns user-owned, system tier, and shared images.

## Get an image

```http
GET /images/:name
```

## Delete an image

```http
DELETE /images/:name
```

System tier images can't be deleted via this endpoint.

## Pull an OCI image

```http
POST /images/pull
```

Async — returns `202` with a task ID. Poll `/tasks/<id>` until it completes.

```bash
curl -X POST http://localhost:8080/images/pull \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"ref": "python:3.12", "name": "python-3.12"}'
```

```json
{"task_id": "tsk_abc123", "status": "running"}
```

Optional `auth: "user:token"` for simple HTTP basic auth. For real private registries with rotating credentials, prefer `image import` after a local `docker pull`.

If the same image was already pulled with the same content digest, returns `200` immediately with the existing record.

## Import an image

```http
POST /images/import?name=<name>
```

Body is a `docker save`-style tarball streamed as `Content-Type: application/x-tar`. The CLI uses this for `bhatti image import`.

```bash
docker save python:3.12 | curl -X POST \
  "http://localhost:8080/images/import?name=python-3.12" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/x-tar" \
  --data-binary @-
```

```json
{"name": "python-3.12", "size_mb": 284}
```

## Save a sandbox as an image

```http
POST /sandboxes/:id/save-image
```

```bash
curl -X POST http://localhost:8080/sandboxes/dev/save-image \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "my-stack"}'
```

The sandbox keeps running. Only the rootfs is captured; persistent volumes are not part of the image.

---

# Snapshots

Named VM snapshots — memory + CPU + disk + processes.

## List snapshots

```http
GET /snapshots
```

## Get a snapshot

```http
GET /snapshots/:name
```

## Delete a snapshot

```http
DELETE /snapshots/:name
```

## Create a snapshot

```http
POST /sandboxes/:id/checkpoint
```

```bash
curl -X POST http://localhost:8080/sandboxes/dev/checkpoint \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "pre-experiment"}'
```

The source sandbox keeps running.

## Resume from a snapshot

```http
POST /snapshots/:name/resume
```

Creates a **new** sandbox from the snapshot.

```bash
curl -X POST http://localhost:8080/snapshots/pre-experiment/resume \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "dev-restored"}'
```

`name` is optional — auto-generated from the source sandbox name if omitted. Persistent volumes are not re-attached.

---

# Tasks

Async operations get a task ID; poll its status here.

## Get task status

```http
GET /tasks/:id
```

```json
{
  "id": "tsk_abc123",
  "status": "running",
  "progress": "downloading layers (45 MB / 142 MB)",
  "error": "",
  "result": ""
}
```

`status` is `running`, `completed`, or `failed`.

## Cancel a task

```http
DELETE /tasks/:id
```

Best-effort cancel. Some operations are uncancellable past a certain point (e.g. a finalizing image conversion).

---

# Image sharing

There's no HTTP API for image sharing. It's a local SQLite operation done with [`bhatti image share --user <name>`](/docs/reference/cli/images/share/) on the server itself, using `--data-dir` to point at the data directory. This is an intentional restriction — image visibility is controlled at the database level, not via the API.
