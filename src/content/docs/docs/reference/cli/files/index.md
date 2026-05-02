---
title: File operations
description: Read, write, and list files inside sandboxes.
sidebar:
  label: Overview
  order: 0
---

Move bytes in and out of a sandbox without opening a shell. Useful for scripted setup, fetching results, and inspecting state.

| Command | Description |
| ------- | ----------- |
| [`bhatti file read`](/docs/reference/cli/files/read/) | Read a file from a sandbox to stdout. |
| [`bhatti file write`](/docs/reference/cli/files/write/) | Write a file from stdin into a sandbox. Atomic. |
| [`bhatti file ls`](/docs/reference/cli/files/ls/) | List directory contents inside a sandbox. |

The CLI exposes the simplest forms — read whole files, write whole files. The underlying API supports partial reads (`offset`, `limit`, `max_bytes`), permission control (`mode`), and HEAD-style stat requests; reach for it directly when you need those. See the [API reference](/docs/reference/api/#files) for the full surface.

## Quick patterns

```bash
bhatti file read   dev /workspace/app.js
echo 'config' | bhatti file write dev /etc/config
bhatti file ls     dev /workspace/
bhatti file read   dev /workspace/data.json | jq .
```

## Limits

- Writes are capped at **100 MB** per request.
- Directory listings are capped at **10 000 entries**; a sentinel entry indicates truncation.
- Writes are atomic — temp file, fsync, rename. Concurrent readers never see a partial file.
