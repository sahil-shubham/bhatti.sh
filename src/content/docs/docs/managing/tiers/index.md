---
title: Tiers
description: Built-in rootfs tiers, the per-tier operational story, and which one to pick.
---

A *tier* is a pre-built Ubuntu 24.04 rootfs that ships as a starting point for sandboxes. bhatti has four. Each builds on `minimal` and adds tooling for a specific workload.

```bash
bhatti create --name dev --image docker
bhatti create --name scraper --image browser
bhatti create --name desk --image computer --cpus 2 --memory 4096
```

Pick the one closest to what you're doing — every tier is a real Ubuntu, so you can always `apt-get install` more on top.

## The four tiers

| Tier | Adds on top of `minimal` | Approx size | Typical use |
|------|--------------------------|------------:|-------------|
| [`minimal`](#minimal) | (nothing — bare base) | ~200 MB | Custom builds, anything CLI-first |
| [`browser`](./browser/) | Chromium, Playwright, Node 22 | ~600 MB | Scraping, CDP automation, headless tests |
| [`docker`](./docker/) | Docker Engine, buildx, compose, binfmt | ~550 MB | Docker-in-VM, OCI builds, **multi-arch** |
| [`computer`](./computer/) | XFCE, KasmVNC, Chromium, full desktop | ~1.5 GB | Visual / agent-driven desktop sessions |

The server install prompts for one tier on first run. Install more later:

```bash
sudo bhatti update --tiers all
# or pick: --tiers docker,browser
```

The server auto-discovers any `rootfs-<tier>-<arch>.ext4` it finds in its images directory, so installing a tier is just a download — no config changes, no daemon restart logic to think about.

## The common operator story

Every long-running process inside a tier is managed by lohar's **`systemctl` shim** ([lohar internals](/docs/under-the-hood/lohar-the-blacksmith/)). The mental model and commands are exactly what you'd type on a real systemd box:

```bash
bhatti exec dev -- systemctl status docker
bhatti exec dev -- journalctl -u docker -n 50
bhatti exec dev -- systemctl restart docker
```

If a managed daemon crashes, the shim's `Restart=on-failure` policy brings it back; you see the crash in `journalctl`. If you edit a config file, `systemctl restart <unit>` picks it up. The shape is the same on every tier.

A few practical points the shim deliberately doesn't try to replicate from real systemd, because they cost more than they're worth in a microVM sandbox:

- **No socket activation.** Daemons that ship with `ExecStart=… -H fd://` need a drop-in to bind the socket directly. The docker tier does this for `docker.service`; you only need to know if you write your own units.
- **No D-Bus.** Daemons that default to the `systemd` cgroup driver (notably dockerd) need a config override to use `cgroupfs`. Again — the docker tier handles this; flagged only because the failure mode is opaque (`dial unix /run/systemd/private: …`) if you build a tier from scratch.
- **No `loginctl`, no `journald` binary format.** Single-user sandbox, plain-text per-unit logs in `/var/log/bhatti/`. `journalctl -u <unit>` reads those files; `-f` follows.

The deeper rationale is in [Decisions & learnings](/docs/under-the-hood/decisions/) under "Why no real systemd."

## Sizing and resources

| Tier | Minimum sensible | Comfortable |
|------|------------------|-------------|
| `minimal` | 1 vCPU / 256 MB | 1 / 512 |
| `browser` | 1 / 1024 | 2 / 2048 |
| `docker` | 2 / 2048 | 4 / 4096 |
| `computer` | 2 / 2048 | 4 / 4096 |

KasmVNC's encoder thread count is sized to `nproc - 1`, so `--cpus 2` is the practical floor for the computer tier (any less and the encoder, X server, XFCE, and Chromium all share one core). For the docker tier, anything memory-intensive (large `buildx` builds, multi-container compose stacks) wants 4+ GB.

## Minimal

The base. Bare Ubuntu 24.04 with curl, sudo, ca-certificates, fuse3, and the `systemd-resolved` apt pin so package installs don't accidentally pull in a real systemd. lohar is PID 1.

Useful when:

- You're going to install everything yourself anyway.
- You want the smallest possible rootfs for snapshot/restore latency.
- You're building a custom image with [`bhatti image save`](/docs/reference/cli/images/save/) and want to start from clean.

The `lohar` user (uid 1000) has passwordless sudo. `bhatti exec` runs as this user. The shim's `systemctl` / `journalctl` symlinks are wired in at this layer, so any service-aware package you install (openssh-server, postgresql, redis-server, nginx) Just Works under the shim.

```bash
bhatti create --name dev --image minimal
bhatti exec dev -- sudo apt-get update
bhatti exec dev -- sudo apt-get install -y postgresql redis-server
bhatti exec dev -- systemctl status postgresql redis-server
```

## Adding a tier

If your team has a stack that's repeated often, you can ship a tier of your own. See [Adding a tier](/docs/contributing/adding-a-tier/) for the build script convention, CI matrix entry, and install-flow integration.

## See also

- [Images & custom builds](/docs/managing/images/) — pull from OCI, import from Docker, save a configured sandbox
- [Adding a tier](/docs/contributing/adding-a-tier/) — build a new system tier from scratch
- [Lohar: the agent inside every VM](/docs/under-the-hood/lohar-the-blacksmith/) — how the `systemctl` shim works
- [Decisions & learnings](/docs/under-the-hood/decisions/) — why no real systemd, what's intentionally out of scope
