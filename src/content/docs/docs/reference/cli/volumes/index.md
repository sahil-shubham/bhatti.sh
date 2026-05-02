---
title: Volumes
description: Persistent ext4 volumes that survive sandbox destruction. Resize, clone, back up, restore.
sidebar:
  label: Overview
  order: 0
---

Persistent volumes are ext4 filesystems that survive sandbox destruction. Create one, attach it at sandbox creation with `--volume name:/mount`, destroy the sandbox — the data stays.

| Command | Description |
| ------- | ----------- |
| [`bhatti volume create`](/docs/reference/cli/volumes/create/) | Create a persistent volume. |
| [`bhatti volume list`](/docs/reference/cli/volumes/list/) | List your volumes and current attachments. |
| [`bhatti volume delete`](/docs/reference/cli/volumes/delete/) | Delete a volume. Requires it to be detached. |
| [`bhatti volume resize`](/docs/reference/cli/volumes/resize/) | Grow a volume. Cannot shrink. |
| [`bhatti volume clone`](/docs/reference/cli/volumes/clone/) | Point-in-time copy. Source must be detached. |
| [`bhatti volume backup`](/docs/reference/cli/volumes/backup/) | Back up to S3-compatible storage. Requires server S3 config. |
| [`bhatti volume backup-list`](/docs/reference/cli/volumes/backup-list/) | List backups for a volume. |
| [`bhatti volume restore`](/docs/reference/cli/volumes/restore/) | Restore from a backup. Volume must be detached. |
| [`bhatti volume backup-delete`](/docs/reference/cli/volumes/backup-delete/) | Delete a backup. |

## Detached state

Four operations require the volume to be **detached** from any sandbox before they'll run: `delete`, `resize`, `clone`, and `restore` all return a `409 Conflict` if the volume is currently attached.

Detach by either destroying the sandbox using the volume, or stopping it with [`bhatti stop`](/docs/reference/cli/sandbox/stop/) (which also detaches volumes).

`backup` does **not** check for attached state — it can run while the sandbox is mounted, but be aware the snapshot may be inconsistent if writes are in flight at backup time. Stop the sandbox first if you need a guaranteed-consistent backup.

## Quick patterns

```bash
# Create + attach in one workflow
bhatti volume create --name workspace --size 5120
bhatti create --name dev --volume workspace:/workspace

# Grow on the fly
bhatti volume resize workspace --size 10240

# Snapshot before a risky operation
bhatti volume clone workspace --name workspace-pre-upgrade

# Off-site backup (requires `backup` config block on server)
bhatti volume backup workspace
bhatti volume backup-list workspace
```

## Backup configuration

`backup`, `restore`, `backup-list`, and `backup-delete` require an S3-compatible storage backend configured on the server. Without it, they return `501 Not Implemented` with the message `backup not configured — add backup section to config.yaml`. See [Configuration: backup](/docs/reference/config/#backup).
