---
title: Self-Hosting
description: Install the bhatti server on your hardware, add teammates, set a custom domain, back up the data directory.
---

The [Quickstart](/docs/quickstart/) covers the install in three lines
and gets you to your first sandbox. This page is the longer version
— what's actually happening on your server, how to add teammates,
and the operational details I've picked up running bhatti on real
hardware.

## Requirements

- Linux with KVM (`/dev/kvm` must exist and be readable)
- Root access (Firecracker requires it; the daemon runs as root by
  default and Firecracker drops to an unprivileged UID per VM via
  the jailer — see
  [Architecture → jailer mode](/docs/under-the-hood/architecture/#3-jailer-mode-is-the-production-path))
- 1 GB+ RAM, NVMe recommended for snapshot performance

I run on:

- Two Raspberry Pi 5s with NVMe HATs (home, integration tests)
- A Hetzner AX102 (Ryzen 9, NVMe — my main box)

Both are linked from the homepage benchmark. Anything in that
ballpark or stronger works.

## Install

```bash
curl -fsSL bhatti.sh/install | sudo bash
```

The script will:

1. **Detect your architecture** (`arm64` or `amd64`) and the OS.
2. **Prompt for a rootfs tier** (or pass `--tier <name>` to skip
   the prompt; see below).
3. **Download the components** (`bhatti`, `lohar`, Firecracker +
   jailer, kernel, rootfs). Components that haven't changed since
   a previous install are skipped automatically.
4. **Install a systemd unit** at `/etc/systemd/system/bhatti.service`
   and start the daemon.
5. **Create an `admin` user** with high resource caps, save its API
   key to `/root/.bhatti/config.yaml`, and **also save it to your
   user's `~/.bhatti/config.yaml`** if you ran with `sudo` (so the
   CLI on the same box works without an explicit `bhatti setup`).
6. **Print the admin API key once** — save it. Anyone with this key
   can do anything on this server.

### Rootfs tiers

| Tier | What's in it | Size |
|------|-------------|------|
| `minimal` | Bare Ubuntu 24.04 | ~200 MB |
| `browser` | + Chromium, Playwright, Node 22 | ~600 MB |
| `docker` | + Docker Engine | ~550 MB |
| `computer` | + Full desktop: XFCE, KasmVNC, Chromium | ~1.5 GB |

You pick one tier as the *default* for `bhatti create` (used when
you don't pass `--image`). Other tiers are still installable later
and can be selected per sandbox with `--image <tier>`.

### Non-interactive install

For Ansible / packer / CI, skip the tier prompt with flags. The
`bash -s -- ...` syntax passes flags through `curl | bash`:

```bash
# Specific tier as the default
curl -fsSL bhatti.sh/install | sudo bash -s -- --tier browser

# Default minimal, plus install every other tier
curl -fsSL bhatti.sh/install | sudo bash -s -- --tiers all

# Default docker, plus also install browser
curl -fsSL bhatti.sh/install | sudo bash -s -- --tier docker --tiers browser
```

`--tier` (singular) sets the *default* tier — what `bhatti create`
uses when no `--image` is passed. `--tiers` (plural, comma-separated
list or `all`) installs additional tiers alongside the default.

## Verifying the install

From the same box where you ran the install, no setup needed:

```bash
bhatti create --name test
bhatti exec test -- uname -a
bhatti destroy test
```

If the create succeeds, the daemon is healthy, the engine has KVM
access, the agent is reachable, and the CLI's config was written
correctly.

## Adding teammates

The remote-CLI flow that used to be Quickstart lives here.

On the server:

```bash
sudo bhatti user create --name alice --max-sandboxes 5 --max-cpus 4 --max-memory 4096
# → API key: bht_...  (shown once, save it)
```

Send Alice the key over a secure channel (1Password, Signal, encrypted
email — not Slack, not GitHub Issues). On her machine:

```bash
# CLI only, no sudo
curl -fsSL bhatti.sh/install | bash

# Wire it up. Either interactive or via flags.
bhatti setup --url https://your-server:8080 --token bht_...
# or:
bhatti setup
```

Now Alice can `bhatti create`, `bhatti exec`, etc. — but only against
sandboxes she creates. Each user is isolated at the API layer
(scoped queries) and at L2 (per-user bridge — see
[Networking](/docs/under-the-hood/networking/)).

For driving bhatti from agents, CI, or provisioning scripts, use the
non-interactive form: `bhatti setup --url ... --token ...`. The auth
test always runs and the command exits non-zero on failure, so your
provisioner picks up bad credentials immediately.

## Custom domain (optional but recommended)

By default `bhatti publish` generates URLs at
`<alias>.<your-server-ip>.nip.io` or similar — fine for testing,
ugly for sharing. To get URLs like `my-app.yourdomain.com` with TLS,
see [Custom domain](/docs/managing/custom-domain/).

## Backups

What to back up:

- `/var/lib/bhatti/state.db` — every sandbox/user/secret/template/volume
  row. The daemon writes WAL, so a hot snapshot of just `state.db` may
  be missing recent commits; back up `state.db` + `state.db-wal` +
  `state.db-shm` together, or run `sqlite3 .backup` for a clean copy.
- `/var/lib/bhatti/age.key` — **the encryption key for every secret.**
  Lose it and every encrypted secret on the server is unrecoverable.
  Treat it the same way you'd treat a TLS private key.
- `/var/lib/bhatti/volumes/` — standalone volumes (the ones created
  with `bhatti volume create`). These are real ext4 images.
- Per-sandbox files under `/var/lib/bhatti/sandboxes/` are usually
  not worth backing up — sandboxes are reproducible from images and
  init scripts. The exception is sandboxes whose state you actually
  care about; for those, take a named snapshot
  (`bhatti snapshot create <name> --label keep`) which writes a
  self-contained copy under `/var/lib/bhatti/snapshots/`.

For S3-compatible volume backups, see
[Volumes → backups](/docs/managing/volumes/#backups).

## Updating

```bash
sudo bhatti update                # bhatti + lohar + kernel + jailer
sudo bhatti update --tiers all    # also pull additional rootfs tiers
```

Or just re-run the install:

```bash
curl -fsSL bhatti.sh/install | sudo bash
```

The install script is idempotent — it skips components that haven't
changed and updates the rest.

## Uninstalling

```bash
# Remove binaries + service, keep /var/lib/bhatti so you can reinstall
curl -fsSL bhatti.sh/uninstall | sudo bash

# Remove everything, including all sandbox state, volumes, and age.key
curl -fsSL bhatti.sh/uninstall | sudo bash -s -- --purge
```

`--purge` is destructive and unreversible — it deletes the encryption
key, every secret, every sandbox, every volume.

## Where each thing lives

The full layout is on the
[Architecture page](/docs/under-the-hood/architecture/#where-state-lives).
Short version:

- `/var/lib/bhatti/state.db` — SQLite, the source of truth
- `/var/lib/bhatti/age.key` — secret encryption key (back this up)
- `/var/lib/bhatti/images/` — read-only base rootfs templates + kernel
- `/var/lib/bhatti/sandboxes/<id>/` — per-sandbox: rootfs, config drive, snapshots
- `/var/lib/bhatti/volumes/` — standalone volumes
- `/var/lib/bhatti/snapshots/` — named snapshots from `bhatti snapshot create`
- `/var/lib/bhatti/jails/` — jailer chroots (one per running sandbox)
- `/etc/bhatti/config.yaml` — daemon config (engine, listen, domain)

## Next steps

- [Users & Auth](/docs/managing/users/) — API key rotation, per-user
  limits, deleting users
- [Custom domain](/docs/managing/custom-domain/) — TLS for `bhatti
  publish`, ACME, wildcard DNS
- [Concepts](/docs/concepts/) — mental model for sandboxes and
  thermal states
- [Architecture](/docs/under-the-hood/architecture/) — what each
  process does and how state flows
