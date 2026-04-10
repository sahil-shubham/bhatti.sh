---
title: File Operations
description: "file read, file write, file ls"
---

## bhatti file read

Read a file from a sandbox.

```bash
bhatti file read dev /workspace/app.js
bhatti file read dev /workspace/app.js --json
```

Outputs raw file content to stdout. Pipe to other commands:

```bash
bhatti file read dev /workspace/data.json | jq .
```

## bhatti file write

Write content from stdin to a file inside a sandbox.

```bash
echo 'console.log("hello")' | bhatti file write dev /workspace/app.js
cat local-file.js | bhatti file write dev /workspace/app.js
```

Writes are atomic — concurrent readers never see partial content. Capped at 100MB per operation.

## bhatti file ls

List directory contents inside a sandbox.

```bash
bhatti file ls dev /workspace/
bhatti file ls dev /workspace/ --json
```

Output includes name, size, permissions, type (file/directory), and modification time. Capped at 10,000 entries.
