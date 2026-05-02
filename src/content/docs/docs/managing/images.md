---
title: Images & Tiers
description: Built-in rootfs tiers, custom-image workflows, and how image scoping and sharing work.
---

Sandbox root filesystems are ext4 images. bhatti ships pre-built Ubuntu 24.04 *tier* images out of the box and supports three ways to add your own: pull from a public OCI registry, import a Docker image, or save a configured sandbox as an image.

The full CLI surface is in [Images reference](/docs/reference/cli/images/). This page covers the tier landscape, the typical workflows, and how scoping/sharing work — none of which is in the per-command pages.

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

The server install prompts for one tier on first run; install more later with `sudo bhatti update --tiers all` (or a comma-separated list). Tiers are auto-discovered from `<data_dir>/images/rootfs-<tier>-<arch>.ext4` — no hardcoded list.

## Building custom images

Three workflows depending on where the source lives.

### Pull from a public registry

```bash
bhatti image pull python:3.12
bhatti image pull node:22-slim --name node-22
```

Async, server-side. The CLI shows progress and exits when the image is ready.

### Import from local Docker

```bash
docker pull ghcr.io/myorg/private:latest        # any auth Docker can do
bhatti image import ghcr.io/myorg/private:latest
```

The CLI runs `docker save` locally and streams the tar to the server. This is the recommended path for private registries — Docker handles your existing auth, bhatti just receives bytes.

For tarballs without Docker:

```bash
docker save ubuntu:24.04 > /tmp/ubuntu.tar
bhatti image import --tar /tmp/ubuntu.tar --name ubuntu-24
```

### Save a configured sandbox

```bash
bhatti create --name build --image minimal
bhatti exec build -- apt-get update && apt-get install -y nodejs pnpm
bhatti exec build -- pnpm install -g some-tool

bhatti image save build --name node-stack
```

The captured image now stamps out new sandboxes with everything pre-installed:

```bash
bhatti create --name worker-1 --image node-stack
bhatti create --name worker-2 --image node-stack
```

Only the **rootfs** is captured — persistent volumes are not part of the image. If your stack puts work in a volume, snapshot the volume separately ([`bhatti volume clone`](/docs/reference/cli/volumes/clone/)) and re-attach when stamping.

## Scoping and sharing

Images you create are private to your user — other users can't see them in `image list`, can't reference them by name, can't read the underlying file.

To share an image with a specific user (or list of users):

```bash
sudo bhatti image share my-image --user alice --user bob
```

This command operates directly on the local SQLite database, so it requires running on the server with DB access (`sudo`). It is not an HTTP API call. There's no "share with everyone" mode — sharing is always with named users. Inspect current shares with `--list`; revoke with [`bhatti image unshare`](/docs/reference/cli/images/unshare/).

System tier images (`minimal`, `browser`, …) are visible to everyone on the server automatically; they live under `user_id=""` in the database.

## See also

- [Images reference](/docs/reference/cli/images/) — every command
- [Adding a tier](/docs/contributing/adding-a-tier/) — build a new system tier
