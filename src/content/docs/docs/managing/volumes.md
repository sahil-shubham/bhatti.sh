---
title: Volumes
description: Persistent ext4 volumes — attach semantics, mount restrictions, and the detached-state requirement.
---

Persistent volumes are ext4 filesystems that survive sandbox destruction. Create one, attach it to a sandbox, destroy the sandbox — the data is still there.

The CLI surface is in [Volumes reference](/docs/reference/cli/volumes/). This page covers the rules — when you can attach, what mount paths are allowed, and which operations require the volume to be unattached.

## Attaching at create time

Volumes are mounted by lohar during sandbox boot. Specify them with `--volume` (repeatable):

```bash
bhatti volume create --name workspace --size 5120
bhatti create --name dev --volume workspace:/workspace
```

The format is `<name>:<mount>[:ro]`:

```bash
bhatti create --name reader --volume workspace:/data:ro
```

`:ro` mounts read-only. Multiple sandboxes can mount the same volume read-only at the same time — useful for shared base data. Read-write attachment is exclusive: only one sandbox can have it as read-write at any moment.

You can attach more than one volume per sandbox by repeating `--volume`.

## Mount path restrictions

Mount paths must be **absolute**. The guest agent rejects anything else.

You also can't shadow system paths. Specifically, the following are blocked:

```
/proc /sys /dev /etc /usr /bin /sbin /lib /lib64 /run /var/run
```

Use a fresh subtree like `/workspace`, `/data`, `/srv/<app>` — anywhere outside the system hierarchy.

## Detached state

Four operations require the volume to be **detached** (no active sandbox attachments):

- [`bhatti volume delete`](/docs/reference/cli/volumes/delete/)
- [`bhatti volume resize`](/docs/reference/cli/volumes/resize/)
- [`bhatti volume clone`](/docs/reference/cli/volumes/clone/)
- [`bhatti volume restore`](/docs/reference/cli/volumes/restore/)

The server returns `409 Conflict` if any sandbox has the volume mounted. To detach, either destroy the sandbox or [`bhatti stop`](/docs/reference/cli/sandbox/stop/) it (stopping detaches volumes; starting reattaches).

[`bhatti volume backup`](/docs/reference/cli/volumes/backup/) is the exception — it works while the volume is attached. The trade-off is consistency: writes in flight at backup time may be captured mid-update. For a guaranteed-clean backup, stop the sandbox first.

## Backups

Volume backups go to S3-compatible storage (AWS, Backblaze B2, R2, MinIO, etc.). They require a `backup` block in the server config; without it, backup-related commands return `501`.

```bash
bhatti volume backup workspace
bhatti volume backup-list workspace
bhatti volume restore workspace --backup-id bk_a1b2c3d4
```

Schedule regular backups with retention via the `backup.schedule` config — see [Configuration](/docs/reference/config/#backup).

## See also

- [Volumes reference](/docs/reference/cli/volumes/) — every command
- [`bhatti create --volume`](/docs/reference/cli/sandbox/create/) — attach syntax
- [Configuration: backup](/docs/reference/config/#backup) — S3 setup
