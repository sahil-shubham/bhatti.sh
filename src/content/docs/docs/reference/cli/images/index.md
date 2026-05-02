---
title: Images
description: Manage rootfs images. Pull from public OCI registries, import from Docker, save sandboxes as reusable images.
sidebar:
  label: Overview
  order: 0
---

Images are ext4 filesystem snapshots used as sandbox root filesystems. bhatti ships pre-built tier images (`minimal`, `browser`, `docker`, `computer`); you can also pull from public OCI registries, import from Docker, or save a running sandbox's filesystem as an image.

| Command | Description |
| ------- | ----------- |
| [`bhatti image list`](/docs/reference/cli/images/list/) | List available images. |
| [`bhatti image pull`](/docs/reference/cli/images/pull/) | Pull from a public OCI registry. Async; returns a task ID. |
| [`bhatti image import`](/docs/reference/cli/images/import/) | Import a local Docker image, or a tarball with `--tar`. |
| [`bhatti image save`](/docs/reference/cli/images/save/) | Save a running sandbox's rootfs as a reusable image. |
| [`bhatti image delete`](/docs/reference/cli/images/delete/) | Delete an image. |
| [`bhatti image share`](/docs/reference/cli/images/share/) | Share an image with specific users (server-only). |
| [`bhatti image unshare`](/docs/reference/cli/images/unshare/) | Revoke image access from users (server-only). |

## Built-in tiers

| Tier | What's in it | Size |
| ---- | ------------ | ---- |
| `minimal` | Bare Ubuntu 24.04 + curl + fuse3 | ~200 MB |
| `browser` | + Chromium, Playwright, Node 22 | ~600 MB |
| `docker` | + Docker Engine | ~550 MB |
| `computer` | + XFCE desktop, KasmVNC, Chromium | ~1.5 GB |

```bash
bhatti create --name scraper --image browser
bhatti create --name ci --image docker
```

The server auto-discovers tiers from `/var/lib/bhatti/images/`. Install more with `sudo bhatti update --tiers all`.

## Image scoping

Each image is owned by the user who created it (or by the system, for built-in tiers). Other users can't see or use your custom images by default.

To share with a specific user: [`sudo bhatti image share <image> --user alice`](/docs/reference/cli/images/share/). The command operates directly on the local SQLite database, so it requires running on the server with DB access — it isn't an API call you can make remotely.

Use `--list` to inspect current shares; pass `--user alice --user bob` to share with multiple users in one call. [`unshare`](/docs/reference/cli/images/unshare/) revokes access by user.
