---
title: Self-Hosting
description: Install the bhatti server on your hardware, add teammates, set a custom domain, back up the data directory.
---

The [Quickstart](/docs/quickstart/) covers the install in a few lines
and gets you to your first sandbox. This page is the longer version
— what's actually happening on your server, how to add teammates,
and the operational details I've picked up running bhatti on real
hardware.

## Requirements

bhatti v2 (krucible) self-hosts on two platforms:

- **Linux with KVM** — `/dev/kvm` must exist and be readable. The
  daemon runs under systemd (as root by default; it needs KVM). Any
  aarch64 or x86_64 box works.
- **macOS on Apple Silicon** — HVF (Hypervisor.framework). No root, no
  KVM; the shipped `bhatti-vmm` is Developer-ID signed and notarized,
  carries the hypervisor entitlement, and runs under launchd. Intel
  Macs are not supported.

1 GB+ RAM; NVMe recommended for snapshot performance.

I run on two Raspberry Pi 5s with NVMe HATs (home, integration tests),
a Hetzner box, and my own Mac laptop. Anything in that ballpark or
stronger works.

## Storage — no special filesystem needed

Unlike v1, **v2 has no btrfs/reflink requirement.** Copy-on-write lives
at the disk-image-format layer: each sandbox gets a thin **qcow2
overlay** over a shared read-only base image, so create-from-image is
instant and one base is shared by many sandboxes' overlays — on
**ext4, xfs, btrfs, and APFS alike**. The overhead is ~0.5% on typical
agent/dev workloads. There's nothing to pre-provision; `/var/lib/bhatti`
on your normal root filesystem is fine.

(btrfs/xfs still give you transparent compression on the base images if
you want it, but it's an optimization, not a prerequisite. If you have
a v1 install on a btrfs loopback, you don't need to carry it forward —
v2 is a fresh install, not an in-place upgrade.)

## Install

```bash
curl -fsSL bhatti.sh/install | sudo bash
```

The script will:

1. **Detect your platform** (`linux`/`darwin`, `arm64`/`amd64`).
2. **Prompt for a rootfs tier** (or pass `--tier <name>` to skip the
   prompt; see below).
3. **Download one self-contained runtime bundle** — the `bhatti` CLI +
   daemon, the `bhatti-vmm` VMM helper, the `bhatti-netd` gateway, the
   `libkrun` (krucible) shared library, and the lean guest kernel —
   plus the rootfs tier. It's laid down as a relocatable prefix under
   `<data_dir>/runtime/`; the binaries resolve `libkrun` via a relative
   rpath, so there's no system-library pollution.
4. **Install a service** — a systemd unit at
   `/etc/systemd/system/bhatti.service` on Linux, or a LaunchDaemon at
   `/Library/LaunchDaemons/sh.bhatti.plist` on macOS — and start the
   daemon.
5. **Create an `admin` user**, save its API key to the invoking user's
   `~/.bhatti/config.yaml` (so the CLI on the same box works without an
   explicit `bhatti setup`).
6. **Print the admin API key once** — save it. Anyone with this key can
   do anything on this server.

### Rootfs tiers

| Tier | What's in it | Size |
|------|-------------|------|
| `minimal` | Bare Ubuntu 24.04 | ~200 MB |
| `browser` | + Chromium, Playwright, Node 22 | ~600 MB |
| `docker` | + Docker Engine | ~550 MB |
| `computer` | + Full desktop: XFCE, KasmVNC, Chromium | ~1.5 GB |

You pick one tier as the *default* for `bhatti create` (used when you
don't pass `--image`). Other tiers are still installable later and can
be selected per sandbox with `--image <tier>`.

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

`--tier` (singular) sets the *default* tier — what `bhatti create` uses
when no `--image` is passed. `--tiers` (plural, comma-separated list or
`all`) installs additional tiers alongside the default.

## Verifying the install

From the same box where you ran the install, no setup needed:

```bash
bhatti create --name test
bhatti exec test -- uname -a
bhatti destroy test
```

If the create succeeds, the daemon is healthy, the VMM has hypervisor
access (KVM or HVF), the agent is reachable, and the CLI's config was
written correctly.

## Adding teammates

The remote-CLI flow. On the server:

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
sandboxes she creates. Each user is isolated at the API layer (scoped
queries), and each user's sandboxes get their own `bhatti-netd` gateway
so cross-user traffic never shares a network — see
[Networking](/docs/under-the-hood/networking/).

For driving bhatti from agents, CI, or provisioning scripts, use the
non-interactive form: `bhatti setup --url ... --token ...`. The auth
test always runs and the command exits non-zero on failure, so your
provisioner picks up bad credentials immediately.

## Custom domain (optional but recommended)

By default `bhatti publish` generates URLs at
`<alias>.<your-server-ip>.nip.io` or similar — fine for testing, ugly
for sharing. To get URLs like `my-app.yourdomain.com` with TLS, see
[Custom domain](/docs/managing/custom-domain/).

## Backups

What to back up:

- `<data_dir>/state.db` — every sandbox/user/secret/template/volume
  row. The daemon writes WAL, so back up `state.db` + `state.db-wal` +
  `state.db-shm` together, or run `sqlite3 .backup` for a clean copy.
- `<data_dir>/age.key` — **the encryption key for every secret.** Lose
  it and every encrypted secret on the server is unrecoverable. Treat
  it like a TLS private key.
- `<data_dir>/volumes/` — standalone volumes (the ones created with
  `bhatti volume create`). Real ext4 images.
- Per-sandbox files under `<data_dir>/sandboxes/` are usually not worth
  backing up — sandboxes are reproducible from images and init scripts.
  For state you care about, take a named snapshot
  (`bhatti snapshot create <name>`), which writes a self-contained
  bundle under `<data_dir>/snapshots/`.

You do **not** need to back up `<data_dir>/runtime/` — it's the
relocatable binary/library/kernel bundle, re-laid on every install and
update, not user data.

For S3-compatible volume backups, see
[Volumes → backups](/docs/managing/volumes/#backups).

## Updating

```bash
sudo bhatti update                # refresh the whole runtime bundle + tiers
sudo bhatti update --tiers all    # also pull additional rootfs tiers
```

Or just re-run the install:

```bash
curl -fsSL bhatti.sh/install | sudo bash
```

The install script is idempotent — it skips components that haven't
changed and updates the rest. Note that a `bhatti update` within v2 is
safe; crossing from a v1 (Firecracker) install is **blocked** (different
VMM, different on-disk layout) — install v2 fresh instead.

## Uninstalling

```bash
# Remove binaries + service, keep <data_dir> so you can reinstall
curl -fsSL bhatti.sh/uninstall | sudo bash

# Remove everything, including all sandbox state, volumes, and age.key
curl -fsSL bhatti.sh/uninstall | sudo bash -s -- --purge
```

`--purge` is destructive and unreversible — it deletes the encryption
key, every secret, every sandbox, every volume.

## Where each thing lives

The full layout is in the
[Configuration reference](/docs/reference/config/#data-directory-layout).
Short version:

- `<data_dir>/state.db` — SQLite, the source of truth
- `<data_dir>/age.key` — secret encryption key (back this up)
- `<data_dir>/runtime/` — the VMM/gateway/libkrun/kernel bundle (not user data)
- `<data_dir>/images/` — read-only base rootfs templates
- `<data_dir>/sandboxes/<id>/` — per-sandbox: CoW overlay, config drive, snapshot bits
- `<data_dir>/volumes/` — standalone volumes
- `<data_dir>/snapshots/` — named snapshots from `bhatti snapshot create`
- `/etc/bhatti/config.yaml` — daemon config (engine, runtime paths, listen, domain)

## Next steps

- [Users & Auth](/docs/managing/users/) — API key rotation, per-user
  limits, deleting users
- [Custom domain](/docs/managing/custom-domain/) — TLS for `bhatti
  publish`, ACME, wildcard DNS
- [Concepts](/docs/concepts/) — mental model for sandboxes and thermal
  states
- [Architecture](/docs/under-the-hood/architecture/) — what each process
  does and how state flows
