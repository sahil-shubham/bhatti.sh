---
title: Images & Tiers
description: Built-in tiers, OCI pulls, Docker imports, and saving sandboxes as images.
---

bhatti ships with pre-built Ubuntu 24.04 images (tiers). You can also pull from OCI registries, import from Docker, or save a sandbox's filesystem as a reusable image.

## Built-in tiers

| Tier | What's in it | Size |
|------|-------------|------|
| `minimal` | Bare Ubuntu + curl + fuse3 | ~200MB |
| `browser` | + Chromium, Playwright, Node 22 | ~600MB |
| `docker` | + Docker Engine | ~550MB |
| `computer` | + Full desktop: XFCE, KasmVNC, Chromium | ~1.5GB |

```bash
bhatti create --name scraper --image browser
bhatti create --name ci --image docker
```

Install additional tiers with `sudo bhatti update --tiers all`. The server auto-discovers tiers from `/var/lib/bhatti/images/`.

## Available images

```bash
bhatti image list
```

```bash
curl http://localhost:8080/images \
  -H "Authorization: Bearer $TOKEN"
```

## Pull from OCI registry

```bash
bhatti image pull ghcr.io/myorg/sandbox-base:latest
```

Pulls an OCI image and extracts it as a rootfs. This is an async operation — use `bhatti image list` to check progress, or the task ID returned by the API.

## Import from Docker

```bash
bhatti image import node:20-slim
```

Exports a Docker image and converts it to a bhatti rootfs. Requires Docker to be running on the host.

## Save from a sandbox

```bash
bhatti image save dev --name my-configured-env
```

Snapshots the current filesystem of a running sandbox as a reusable image. Useful for creating pre-configured environments (installed dependencies, config files, etc.).

## Use an image

```bash
bhatti create --name dev --image my-configured-env
```

```json
{"name": "dev", "image": "my-configured-env"}
```

## Share images

```bash
bhatti image share my-configured-env     # make available to all users
bhatti image unshare my-configured-env   # restrict to owner
```

By default, images are scoped to the user who created them. Sharing makes them available to all users on the server.

## Delete

```bash
bhatti image delete my-configured-env
```

For all parameters, see the [API Reference](/docs/reference/api/) and [CLI Reference: Resources](/docs/reference/cli/resources/).
