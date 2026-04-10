---
title: Resources
description: "image, volume, secret, and snapshot commands"
---

## Images

### bhatti image list

```bash
bhatti image list
```

### bhatti image pull

Pull an image from an OCI registry.

```bash
bhatti image pull ghcr.io/myorg/sandbox-base:latest
```

Async operation — returns a task ID. Check progress with `bhatti image list`.

### bhatti image import

Import a Docker image as a bhatti rootfs.

```bash
bhatti image import node:20-slim
```

Requires Docker to be running on the host.

### bhatti image save

Save a sandbox's current filesystem as a reusable image.

```bash
bhatti image save dev --name my-configured-env
```

| Flag | Description |
|------|-------------|
| `--name` | Name for the saved image (required) |

### bhatti image delete

```bash
bhatti image delete my-configured-env
```

### bhatti image share / unshare

Control image visibility across users.

```bash
bhatti image share my-configured-env     # available to all users
bhatti image unshare my-configured-env   # restrict to owner
```

---

## Volumes

### bhatti volume create

```bash
bhatti volume create --name work --size 256
```

| Flag | Default | Description |
|------|---------|-------------|
| `--name` | required | Volume name |
| `--size` | required | Size in MB |

### bhatti volume list

```bash
bhatti volume list
```

### bhatti volume delete

```bash
bhatti volume delete work
```

Fails if the volume is attached to a sandbox.

### bhatti volume resize

```bash
bhatti volume resize work --size 512
```

| Flag | Description |
|------|-------------|
| `--size` | New size in MB (must be larger than current) |

### bhatti volume backup

```bash
bhatti volume backup work
```

Back up volume to S3-compatible storage.

### bhatti volume backup-list

```bash
bhatti volume backup-list work
```

### bhatti volume restore

```bash
bhatti volume restore work --backup-id <id>
```

| Flag | Description |
|------|-------------|
| `--backup-id` | Backup ID to restore from (required) |

### bhatti volume backup-delete

```bash
bhatti volume backup-delete work <backup-id>
```

---

## Secrets

### bhatti secret set

```bash
bhatti secret set API_KEY sk-abc123def
```

Creates or updates a secret. Values are encrypted at rest with age.

### bhatti secret list

```bash
bhatti secret list
```

Returns names only — values are never shown.

### bhatti secret delete

```bash
bhatti secret delete API_KEY
```

---

## Snapshots

Named VM snapshots that capture the complete state — memory, CPU registers, disk, and running processes.

### bhatti snapshot create

```bash
bhatti snapshot create dev --name before-experiment
```

| Flag | Description |
|------|-------------|
| `--name` | Snapshot name (required) |

### bhatti snapshot list

```bash
bhatti snapshot list
```

### bhatti snapshot resume

Create a new sandbox from a named snapshot.

```bash
bhatti snapshot resume before-experiment
```

The restored sandbox is a new instance with all state from the snapshot — running processes, open files, network connections.

### bhatti snapshot delete

```bash
bhatti snapshot delete before-experiment
```
