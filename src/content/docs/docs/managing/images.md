---
title: Images
description: Rootfs images from OCI registries, Docker, or sandbox snapshots.
---

Images are rootfs filesystems used as the base for new sandboxes. bhatti ships with a minimal Ubuntu 24.04 image. You can pull additional images from OCI registries, import from Docker, or save a sandbox's filesystem as a reusable image.

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
