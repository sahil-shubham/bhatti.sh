---
title: Volumes
description: Persistent ext4 volumes that survive sandbox destruction.
---

Persistent storage that survives sandbox destruction. Create a volume, attach it to a sandbox, destroy the sandbox — the data is still there.

## CLI

```bash
bhatti volume create --name work --size 256
bhatti volume list
bhatti volume delete work
bhatti volume resize work --size 512
```

## API

```bash
# Create
curl -X POST http://localhost:8080/volumes \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "work", "size_mb": 256}'

# List
curl http://localhost:8080/volumes \
  -H "Authorization: Bearer $TOKEN"

# Delete (fails if attached to a sandbox)
curl -X DELETE http://localhost:8080/volumes/work \
  -H "Authorization: Bearer $TOKEN"

# Resize
curl -X POST http://localhost:8080/volumes/work/resize \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"size_mb": 512}'
```

## Attaching volumes

Attach volumes at sandbox creation:

```bash
bhatti create --name dev --volume work:/workspace
```

```json
{
  "name": "dev",
  "volumes": [{"name": "work", "mount": "/workspace"}]
}
```

Or create and attach in one step:

```json
{
  "name": "dev",
  "new_volumes": [{"name": "work", "size_mb": 256, "mount": "/workspace"}]
}
```

### Mount path restrictions

Mount paths must be absolute and cannot overlay system paths (`/proc`, `/sys`, `/dev`, `/etc`, `/usr`, etc.). Volumes are mounted inside the VM by lohar during boot.

## Backups

Volumes can be backed up to S3-compatible storage:

```bash
bhatti volume backup work
bhatti volume backup-list work
bhatti volume restore work --backup-id <id>
bhatti volume backup-delete work <backup-id>
```

For all parameters, see the [API Reference](/docs/reference/api/) and [CLI Reference: Resources](/docs/reference/cli/resources/).
