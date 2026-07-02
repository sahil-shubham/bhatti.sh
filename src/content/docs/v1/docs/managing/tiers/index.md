---
title: Tiers
description: Built-in rootfs tiers, the per-tier operational story, and which one to pick.
slug: v1/docs/managing/tiers
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

## Units shipped by each tier

What's actually running inside each tier, post-boot. Every unit listed here is managed by lohar's [`systemctl` shim](/v1/docs/under-the-hood/lohar-the-blacksmith/) — no real systemd anywhere — and the same three commands (`systemctl status`, `journalctl -u`, `systemctl restart`) work the same way regardless of tier.

| Tier | Unit | `Type=` | What it does |
|------|------|---------|--------------|
| `minimal` | (none shipped) | — | Provides the shim infrastructure. Anything you `apt install` (openssh-server, postgresql, nginx) becomes shim-managed on first boot. |
| `browser` | `headless-chrome.service` | `simple` | `headless_shell` with `--remote-debugging-port=9222`. Long-running, no PIDFile, restarted on crash. |
| `docker` | `docker.service` | `notify` | `dockerd` from upstream `docker-ce`. Drop-in binds the socket directly (no `fd://` socket activation) and chmods it for the `lohar` user. |
| `computer` | `kasmvnc-firstboot.service` | `oneshot` | Generates a per-sandbox VNC password on first boot. `RemainAfterExit=yes` so dependent units' `After=` clauses are satisfied. |
| `computer` | `kasmvnc.service` | `simple` | `Xkasmvnc` — X server + RFB→WebSocket gateway, the endpoint on `:6080`. After `kasmvnc-firstboot.service`. |
| `computer` | `xfce-session.service` | `simple` | XFCE desktop session. `Requires=kasmvnc.service` so killing kasmvnc cascades. |
| `computer` | `bhatti-display-env.service` | `oneshot` | Writes `DISPLAY=:99` into the env file `bhatti exec` reads, so `screenshot` and `xdotool` Just Work without per-call env. |

If a tier's daemon crashes, the shim's `Restart=on-failure` policy brings it back; you see the crash and the restart in `journalctl -u <unit>`. If you edit a config file, `systemctl restart <unit>` picks it up. Every unit in this table is `Restart=on-failure` (long-running daemons) or `oneshot` (firstboot helpers). The cgroup-placement mechanism that makes `systemctl stop` reliable for forking daemons like `Xkasmvnc` is documented at [How services are spawned](/v1/docs/under-the-hood/lohar-the-blacksmith/#how-services-are-spawned).

## The common operator story

Every long-running process in every built-in tier is managed by lohar's **`systemctl` shim** ([lohar internals](/v1/docs/under-the-hood/lohar-the-blacksmith/)). The same three commands — `systemctl status`, `journalctl -u`, `systemctl restart` — work the same way regardless of which tier you started from:

```bash
bhatti exec dev -- systemctl status docker
bhatti exec dev -- journalctl -u docker -n 50
bhatti exec dev -- systemctl restart docker
```

If a managed daemon crashes, the shim's `Restart=on-failure` policy brings it back; you see the crash in `journalctl`. If you edit a config file, `systemctl restart <unit>` picks it up. The shape is the same on every tier — that's the point of having one shim instead of one bespoke init script per tier.

A few practical points the shim deliberately doesn't try to replicate from real systemd, because they cost more than they're worth in a microVM sandbox:

* **No socket activation.** Daemons that ship with `ExecStart=… -H fd://` need a drop-in to bind the socket directly. The docker tier does this for `docker.service`; you only need to know if you write your own units.
* **No D-Bus.** Daemons that default to the `systemd` cgroup driver (notably dockerd) need a config override to use `cgroupfs`. Again — the docker tier handles this; flagged only because the failure mode is opaque (`dial unix /run/systemd/private: …`) if you build a tier from scratch.
* **No `loginctl`, no `journald` binary format.** Single-user sandbox, plain-text per-unit logs in `/var/log/bhatti/`. `journalctl -u <unit>` reads those files; `-f` follows.

The deeper rationale is in [Decisions & learnings](/v1/docs/under-the-hood/decisions/) under "Why no real systemd."

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

* You're going to install everything yourself anyway.
* You want the smallest possible rootfs for snapshot/restore latency.
* You're building a custom image with [`bhatti image save`](/v1/docs/reference/cli/images/save/) and want to start from clean.

The `lohar` user (uid 1000) has passwordless sudo. `bhatti exec` runs as this user. The shim's `systemctl` / `journalctl` symlinks are wired in at this layer, so any service-aware package you install (openssh-server, postgresql, redis-server, nginx) Just Works under the shim.

```bash
bhatti create --name dev --image minimal
bhatti exec dev -- sudo apt-get update
bhatti exec dev -- sudo apt-get install -y postgresql redis-server
bhatti exec dev -- systemctl status postgresql redis-server
```

## Adding a tier

If your team has a stack that's repeated often, you can ship a tier of your own. See [Adding a tier](/v1/docs/contributing/adding-a-tier/) for the build script convention, CI matrix entry, and install-flow integration.

## See also

* [Images & custom builds](/v1/docs/managing/images/) — pull from OCI, import from Docker, save a configured sandbox
* [Adding a tier](/v1/docs/contributing/adding-a-tier/) — build a new system tier from scratch
* [Lohar: the agent inside every VM](/v1/docs/under-the-hood/lohar-the-blacksmith/) — how the `systemctl` shim works
* [Decisions & learnings](/v1/docs/under-the-hood/decisions/) — why no real systemd, what's intentionally out of scope
