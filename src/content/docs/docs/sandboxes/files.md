---
title: Files
description: Read, write, list, and stat files inside sandboxes.
---

## CLI

```bash
bhatti file read dev /workspace/app.js
echo 'console.log("hello")' | bhatti file write dev /workspace/app.js
bhatti file ls dev /workspace/
```

## API

### Read

```bash
curl http://localhost:8080/sandboxes/dev/files?path=/workspace/app.js \
  -H "Authorization: Bearer $TOKEN"
```

Returns raw file content with `Content-Type: application/octet-stream`.

**Server-side truncation** — avoid transferring large files:

```bash
curl "http://localhost:8080/sandboxes/dev/files?path=/app.log&offset=1&limit=2000&max_bytes=51200" \
  -H "Authorization: Bearer $TOKEN"
```

| Param | Description |
|-------|-------------|
| `offset` | 1-indexed line number to start from |
| `limit` | Max lines to return |
| `max_bytes` | Max bytes to return |

Whichever limit hits first stops the read. The `X-File-Size` response header always contains the total file size so you can detect truncation.

### Write

```bash
curl -X PUT "http://localhost:8080/sandboxes/dev/files?path=/workspace/app.js" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Length: 25" \
  --data-binary 'console.log("hello world")'
```

`Content-Length` header is required (rejects chunked/unknown). Optional query: `mode=0644` (default: `0644`). Max 100MB per write.

**Writes are atomic.** Lohar writes to a temp file, fsyncs, then renames over the target. Concurrent readers never see partial content.

### Stat

```bash
curl -I "http://localhost:8080/sandboxes/dev/files?path=/workspace/app.js" \
  -H "Authorization: Bearer $TOKEN"
```

Response headers: `X-File-Size`, `X-File-Mode`, `X-File-IsDir`.

### List directory

```bash
curl "http://localhost:8080/sandboxes/dev/files?path=/workspace&ls=true" \
  -H "Authorization: Bearer $TOKEN"
```

```json
[
  {"name": "app.js", "size": 1234, "mode": "0644", "is_dir": false, "mtime": 1711100000},
  {"name": "node_modules", "size": 4096, "mode": "0755", "is_dir": true, "mtime": 1711100000}
]
```

Capped at 10,000 entries. If truncated, a sentinel entry indicates the total count.

## Performance

Measured on Raspberry Pi 5 (ARM64, NVMe). For Hetzner AX102 (x86_64) numbers, see the landing page benchmarks.

| Operation | p50 | p95 |
|-----------|-----|-----|
| 1KB file read | 472µs | 826µs |
| 1KB file write | 809µs | 1.1ms |
| 5 parallel reads | 1.9ms | 2.3ms |
| Truncated read (100 lines from 10K-line file) | 4.5x faster than full read | — |

For all parameters, see the [API Reference](/docs/reference/api/).
