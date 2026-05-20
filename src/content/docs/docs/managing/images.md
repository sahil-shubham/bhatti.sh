---
title: Images & Tiers
description: Built-in rootfs tiers, custom-image workflows, and how image scoping and sharing work.
---

Sandbox root filesystems are ext4 images. bhatti ships pre-built Ubuntu 24.04 *tier* images out of the box and supports three ways to add your own: pull from a public OCI registry, import a Docker image, or save a configured sandbox as an image.

The full CLI surface is in [Images reference](/docs/reference/cli/images/). This page covers the tier landscape, the typical workflows, and how scoping/sharing work — none of which is in the per-command pages.

## Built-in tiers

bhatti ships four built-in tiers. Each is a pre-built Ubuntu 24.04 rootfs that builds on top of `minimal`:

| Tier | Adds | Size |
| ---- | ---- | ----:|
| [`minimal`](/docs/managing/tiers/) | (base) | ~200 MB |
| [`browser`](/docs/managing/tiers/browser/) | Chromium, Playwright, Node 22 | ~600 MB |
| [`docker`](/docs/managing/tiers/docker/) | Docker Engine, buildx, compose, binfmt | ~550 MB |
| [`computer`](/docs/managing/tiers/computer/) | XFCE, KasmVNC, Chromium, full desktop | ~1.5 GB |

```bash
bhatti create --name scraper --image browser
bhatti create --name ci --image docker
```

The server install prompts for one tier on first run; install more later with `sudo bhatti update --tiers all` (or a comma-separated list). Tiers are auto-discovered from `<data_dir>/images/rootfs-<tier>-<arch>.ext4` — no hardcoded list.

The deep dive for each tier — how its long-running daemons are managed, what env knobs you can pass, sizing, troubleshooting — lives at [Tiers](/docs/managing/tiers/). The rest of this page is about images you build *on top* of those tiers.

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

## Disk usage

A common question when you first look at `/var/lib/bhatti/`: *"how
much disk does each sandbox actually cost?"* The answer depends
heavily on which filesystem the data dir lives on, and the difference
between what `ls -lh` shows and what `du -h` shows is the whole
story.

A fresh sandbox dir looks like this:

```
/var/lib/bhatti/
  images/
    rootfs-computer-amd64.ext4   4.0G   (logical) base image
    rootfs-minimal-amd64.ext4    1.0G
    vmlinux-amd64                 43M
  sandboxes/<id>/
    rootfs.ext4                  1.0G   (logical) per-sandbox CoW
    config.ext4                  1.0M   (logical) env, secrets, mounts
    mem.snap                     1.0G   (logical, only when cold)
    vm.snap                      ~50K   (only when cold)
```

The `.ext4` files are sparse-allocated block devices. `ls -lh` shows
the *logical* size (the maximum the file could be); `du -h` shows
what's actually on disk. The gap can be massive.

On **btrfs** with reflink + zstd:1 compression (the recommended
setup, see
[Filesystem](/docs/self-hosting/#filesystem-recommended-btrfs)),
`compsize` from `btrfs-progs` shows the breakdown explicitly:

```bash
$ sudo compsize /var/lib/bhatti/sandboxes/abc123/
Type       Perc     Disk Usage   Uncompressed   Referenced Size
TOTAL       18%       45M           250M           1.0G
```

"Referenced Size 1.0G" is what `ls -lh` shows: the sandbox sees a
1 GiB block device. "Disk Usage 45M" is what's actually allocated
on disk after reflink-sharing with the base image and zstd
compression of the unique parts. The 95.5% gap is what makes
running many sandboxes from one base affordable.

### The per-sandbox cost

The marginal cost of adding a sandbox depends on the filesystem:

| Filesystem | Base image | Per sandbox (logical) | Per sandbox (physical) | 10 sandboxes total |
|---|---|---|---|---|
| **ext4** | 1.0 GiB | 1.0 GiB | ~232 MiB (sparse copy) | ~3.3 GiB |
| **btrfs** (reflink + zstd:1) | 1.0 GiB | 1.0 GiB | ~5–20 MiB | ~1.1 GiB |

Numbers from `agni-01` (1 GiB base computer-tier rootfs). On ext4
each sandbox is a sparse copy of the base — the *used* extents of
the source, not the full logical size, but still hundreds of MiB per
sandbox. On btrfs the per-sandbox cost is the bytes the sandbox
actually writes (config tweaks, log lines, package installs since
boot), typically single-digit MiB until you do something heavy.

For `mem.snap` files — written when a sandbox goes cold, equal to
the configured memory — the difference is even larger: guest RAM is
dominated by zero pages and highly-compressible kernel/userspace,
so zstd:1 on btrfs hits about 21×. A stopped 1 GiB sandbox occupies
~48 MiB on disk on btrfs vs. ~1 GiB on ext4.

On ext4 the answer to "is there a way to streamline storage?" is
**yes — switch to btrfs.** No bhatti config knob needed; reflink
takes effect automatically as soon as `/var/lib/bhatti` is btrfs.
See [Self-hosting →
Filesystem](/docs/self-hosting/#filesystem-recommended-btrfs) for
the recipe and [Storage → What changes on
ext4](/docs/under-the-hood/storage/#what-changes-on-ext4) for the
full cost-by-filesystem picture.

## Scoping and sharing

Images you create are private to your user — other users can't see them in `image list`, can't reference them by name, can't read the underlying file.

To share an image with a specific user (or list of users):

```bash
sudo bhatti image share my-image --user alice --user bob
```

This command operates directly on the local SQLite database, so it requires running on the server with DB access (`sudo`). It is not an HTTP API call. There's no "share with everyone" mode — sharing is always with named users. Inspect current shares with `--list`; revoke with [`bhatti image unshare`](/docs/reference/cli/images/unshare/).

System tier images (`minimal`, `browser`, …) are visible to everyone on the server automatically; they live under `user_id=""` in the database.

## See also

- [Tiers](/docs/managing/tiers/) — the four built-in starting points, with per-tier deep dives
- [Images reference](/docs/reference/cli/images/) — every command
- [Adding a tier](/docs/contributing/adding-a-tier/) — build a new system tier
