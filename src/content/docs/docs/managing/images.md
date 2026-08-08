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
much disk does each sandbox actually cost?"* The short answer in v2 is
**the bytes the sandbox has written since boot** — and it's the same
answer on any filesystem, because copy-on-write lives in the disk-image
format, not in the filesystem.

A fresh sandbox dir looks like this:

```
/var/lib/bhatti/
  images/
    rootfs-computer-arm64.ext4   1.5G   (logical) read-only base image
    rootfs-minimal-arm64.ext4    ~200M
  sandboxes/<id>/
    root.qcow2                   (qcow2 CoW overlay over the base — the sandbox's write deltas)
    config.ext4                  ~1M    (logical) env, secrets, file drops
    bundle/                      (only while cold: memory image + VM state + overlay copy + volumes)
```

Each sandbox's `root.qcow2` is a thin overlay *over* one of the base
images — a metadata-only header at create time that only allocates
blocks as the guest writes them. `ls -lh` shows the *logical* device
size the guest sees; `du -h` shows what's actually on disk. The gap is
usually enormous, and it's the whole reason many sandboxes off one base
are affordable:

```bash
$ du -sh /var/lib/bhatti/sandboxes/abc123/
45M     /var/lib/bhatti/sandboxes/abc123/
$ ls -lh /var/lib/bhatti/sandboxes/abc123/root.qcow2
-rw------- 1 root root 1.0G ...   # logical device size, not real allocation
```

### The per-sandbox cost

The marginal cost of adding a sandbox is the bytes it writes over the
shared base — config tweaks, log lines, packages installed since boot —
typically single-digit MiB until you do something heavy. The base image
is stored once and shared by every sandbox's overlay; the OS page cache
likewise holds one copy of the read-only base pages in RAM across all
of them. Overhead of the qcow2 indirection is ~0.5%.

This is **filesystem-independent**. ext4, xfs, btrfs, and APFS all get
instant create-from-base and shared-base dedup — there's no ext4
penalty and no btrfs requirement (that was v1). If you *want* to shrink
the data dir further, btrfs and xfs can transparently compress the base
images and cold bundles, but that's an optional optimization, not a
prerequisite. See [Self-hosting → Storage, no special filesystem
needed](/docs/self-hosting/#storage--no-special-filesystem-needed) and
[Storage](/docs/under-the-hood/storage/) for the full picture, including
the `KRUCIBLE_ROOT_RAW=1` opt-out for a plain raw ext4 root.

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
