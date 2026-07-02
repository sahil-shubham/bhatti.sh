---
title: Server & admin
description: Daemon, configuration, version, updates, user management, observability.
sidebar:
  label: Overview
  order: 0
slug: v1/docs/reference/cli/admin
---

Commands that run on the bhatti server itself, plus a couple that work from any client (`setup`, `version`, `completion`, `update`).

## Categories

| | |
| --- | --- |
| **Daemon** | [`serve`](/v1/docs/reference/cli/admin/serve/) |
| **Client config** | [`setup`](/v1/docs/reference/cli/admin/setup/), [`version`](/v1/docs/reference/cli/admin/version/), [`completion`](/v1/docs/reference/cli/admin/completion/) |
| **Updates** | [`update`](/v1/docs/reference/cli/admin/update/) |
| **User management** | [`user create`](/v1/docs/reference/cli/admin/user-create/), [`user list`](/v1/docs/reference/cli/admin/user-list/), [`user rotate-key`](/v1/docs/reference/cli/admin/user-rotate-key/), [`user delete`](/v1/docs/reference/cli/admin/user-delete/) |
| **Observability** | [`admin status`](/v1/docs/reference/cli/admin/admin-status/), [`admin events`](/v1/docs/reference/cli/admin/admin-events/), [`admin metrics`](/v1/docs/reference/cli/admin/admin-metrics/) |

## Server-only commands

`user *` and `admin *` operate **directly on the server's SQLite database** (`/var/lib/bhatti/state.db`). They aren't HTTP API calls — they need filesystem access to the database. Run them on the server, typically with `sudo`.

`serve` runs the daemon. Also server-only by definition (requires KVM and root).

The remaining commands (`setup`, `version`, `update`, `completion`) work from any client.

## Quick patterns

```bash
# Bootstrap a new user (server)
sudo bhatti user create --name alice --max-sandboxes 10

# Check overall health (server)
sudo bhatti admin status

# Find recent thermal pauses (server)
sudo bhatti admin events --type thermal --since 24h

# Update the CLI on a developer machine
bhatti update

# Update everything on the server (CLI, kernel, rootfs, lohar)
sudo bhatti update
```
