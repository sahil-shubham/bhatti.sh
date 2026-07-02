---
title: Docker tier
description: Run Docker Engine inside a microVM. Multi-arch buildx, compose, and
  the operator UX.
slug: v1/docs/managing/tiers/docker
---

The `docker` tier ships Docker Engine, the buildx and compose plugins, containerd, and the kernel-side bits for cross-arch builds (`binfmt_misc` mounted at PID 1, qemu-user emulation available on demand). It's the right starting point for anything that wants Docker-in-VM — CI runners, image builds, compose stacks, sandboxed `docker run` experiments.

```bash
bhatti create --name ci --image docker --cpus 4 --memory 4096
bhatti exec ci -- docker run hello-world
```

That's the entire setup. There is no `docker setup`, no daemon to start by hand, no socket permission dance — the tier wires all of it at build time.

## What's in it

| Component | Version | Source |
|---|---|---|
| Docker Engine (`dockerd`, `docker` CLI) | 29.x | `docker-ce` from Docker's apt repo |
| `containerd` | latest stable | `containerd.io` from Docker's apt repo |
| `docker buildx` plugin | 0.34.x | `docker-buildx-plugin` |
| `docker compose` plugin | latest | `docker-compose-plugin` |
| `iptables-legacy` | from Ubuntu | configured as the default |
| `binfmt_misc` filesystem | kernel feature | mounted by lohar at PID 1 |

The custom bhatti kernel enables every flag dockerd needs at runtime — bridge networking, veth, overlayfs, netfilter conntrack and security tables, and `BINFMT_MISC` for cross-arch emulation. See [Kernel](/v1/docs/contributing/kernel/) for the full list and rationale.

## How dockerd is managed

The tier doesn't ship its own `docker.service`. It reuses the one that comes with the `docker-ce` package and customises two things via a drop-in at `/etc/systemd/system/docker.service.d/bhatti.conf`:

```ini
[Service]
# Replace upstream `-H fd://` (which requires systemd socket activation
# lohar's shim deliberately doesn't implement) with a direct socket bind.
ExecStart=
ExecStart=/usr/bin/dockerd -H unix:///var/run/docker.sock --containerd=/run/containerd/containerd.sock

# Pick up `bhatti create --env DOCKER_*=...` overrides.
EnvironmentFile=-/run/bhatti/config-env

# Widen the socket so `bhatti exec` (uid 1000, no supplementary groups)
# can reach it. Safe inside an isolated single-user microVM.
ExecStartPost=/bin/chmod 666 /var/run/docker.sock

Restart=on-failure
RestartSec=2s
```

And `/etc/docker/daemon.json`:

```json
{ "exec-opts": ["native.cgroupdriver=cgroupfs"] }
```

Both overrides exist because the shim is **not** real systemd. Two specific gaps, both deliberate per [Decisions & learnings](/v1/docs/under-the-hood/decisions/):

> **Why `-H fd://` is replaced.** Real `docker.service` listens via a paired `docker.socket` unit; systemd binds the socket and hands the fd to dockerd. The shim doesn't implement socket activation ("a lot of code for marginal benefit — services start fast in our VMs anyway"). The drop-in tells dockerd to bind the socket itself.

> **Why `cgroupfs` instead of `systemd`.** Docker 29 defaults to `native.cgroupdriver=systemd`, which talks to systemd over D-Bus during every container create. The microVM has no D-Bus (libpam-systemd is pinned out of the rootfs to keep snapshot/restore safe). Without the override, every `docker run` dies in `runc` with `dial unix /run/systemd/private: connect: no such file`.

You don't need to think about any of this in normal use. The drop-in is in place from boot one.

## The operator UX

```bash
bhatti exec dev -- systemctl status docker
# ● docker.service - Docker Application Container Engine
#      Active: active (running, PID 310)
#      …

bhatti exec dev -- journalctl -u docker -n 50
bhatti exec dev -- journalctl -u docker -f      # follow

bhatti exec dev -- systemctl restart docker
bhatti exec dev -- systemctl is-active docker   # exits 0 if active
bhatti exec dev -- systemctl is-failed docker   # exits 0 if failed
```

If dockerd crashes, the shim restarts it (`Restart=on-failure`, 2 s back-off). The failure shows up in `journalctl -u docker`. There is no separate logs file you have to remember; everything daemon-level is in the journal.

`docker logs <container>` (per-container application logs) is unchanged from upstream Docker — those flow through containerd, not the shim.

## Environment knobs

dockerd inherits anything you pass to `bhatti create --env`. The bridge happens through `/run/bhatti/config-env`, which lohar writes from the config drive at boot and the unit reads via `EnvironmentFile=`.

```bash
bhatti create --name reg --image docker \
    --env "DOCKER_REGISTRY_MIRROR=https://mirror.example.com,DOCKER_OPTS=--debug"
```

`--env` takes a **single comma-separated list** (`K=V,K=V`), not a repeated flag.

Recognised env vars today:

| Variable | Effect |
|---|---|
| Anything starting with `DOCKER_` | Visible in `dockerd`'s environment; useful for env-driven docker hooks |

The drop-in deliberately doesn't translate env vars into dockerd flags. If you need to change daemon flags themselves, write a second drop-in or edit `/etc/docker/daemon.json` inside the sandbox and `systemctl restart docker`.

## Socket permissions

`/var/run/docker.sock` is `0666` after boot — anyone in the sandbox can talk to dockerd. This is the world-writable workaround mentioned in the drop-in. The reasoning:

* `bhatti exec` runs as uid 1000 (the `lohar` user) without supplementary group membership, so the standard `docker` group ACL doesn't apply.
* The VM is the security boundary, not the docker group. Inside, it's a single-user sandbox.
* Hardening this further would require lohar to preserve supplementary groups across exec, which is a separate change that hasn't shipped yet.

If you re-mount the rootfs read-write and tighten the socket yourself, expect to also write a unit that wraps `bhatti exec` with `sg docker -c '…'`.

## Multi-arch builds with buildx

Same-arch builds are native and need no setup:

```bash
bhatti exec dev -- docker buildx build -t me/app:latest .
```

Cross-arch builds need one extra command — `tonistiigi/binfmt --install all` — to populate the kernel's `binfmt_misc` handler table with qemu-user interpreters:

```bash
bhatti exec dev -- docker run --privileged --rm tonistiigi/binfmt --install all
bhatti exec dev -- docker buildx create --use --name xb --driver docker-container
bhatti exec dev -- docker buildx build --platform linux/amd64,linux/arm64 \
    -t me/app:multi --push .
```

### What that one extra command actually does

Three layers have to line up for cross-arch builds to work:

| Layer | Provided by | State on a fresh docker sandbox |
|---|---|---|
| `CONFIG_BINFMT_MISC=y` in the kernel | bhatti kernel | ✅ on |
| `/proc/sys/fs/binfmt_misc` filesystem mounted | lohar at PID 1 | ✅ mounted |
| Per-arch handler registrations + qemu interpreters | `tonistiigi/binfmt` container | ❌ empty until you run it |

The kernel knows it could dispatch foreign-arch ELFs to a userspace interpreter, but it has no interpreters and no mapping yet. The `tonistiigi/binfmt` image carries pre-built static qemu binaries (`qemu-aarch64`, `qemu-arm`, `qemu-riscv64`, …) and uses the kernel's **fix-binary (`F`) flag** when registering, which makes the kernel open the interpreter and keep an fd to it. After registration the container exits, the qemu binaries are gone, the kernel's open fds keep working.

You run the command once per sandbox. Registrations survive snapshot/restore (they live in kernel state, not on disk).

### Performance: when emulation is fine, when it isn't

qemu-user emulation is correct but slow — typically 5–20× slower than native for CPU-bound work. Reasonable rules of thumb:

| Workload | Cross-arch emulation | Native-per-arch |
|---|---|---|
| Single-image dev builds, occasional cross-arch validation | 👍 fine | overkill |
| CI pushing release images on every merge | 😬 painful (multi-minute) | 👍 right answer |
| Heavily CPU-bound layers (compilers, native deps, ML) | ❌ avoid | 👍 right answer |
| `apt-get install`-heavy layers (mostly disk + network) | 👌 acceptable | 👍 faster |

For real CI, run one bhatti sandbox per native arch and stitch them with buildx:

```bash
# Driver machine — orchestrates two remote builders.
docker buildx create --name xb --platform linux/amd64 ssh://user@amd64-sandbox-host
docker buildx create --append --name xb --platform linux/arm64 ssh://user@arm64-sandbox-host
docker buildx use xb
docker buildx build --platform linux/amd64,linux/arm64 --push -t me/app:x .
```

(Server-side requires either an SSH driver or a TCP-listening dockerd that you publish via `bhatti publish`.) Each platform builds natively on a matching host; buildx writes the multi-arch manifest. bhatti's [warm-wake](/v1/docs/under-the-hood/thermal-states/) (~4 ms) makes this cheap to leave idle between runs.

## Compose

`docker-compose-plugin` is installed, so `docker compose up` works as you'd expect. There's no extra wiring.

```bash
bhatti create --name stack --image docker --cpus 4 --memory 4096
bhatti file write stack /workspace/compose.yaml < ./compose.yaml
bhatti exec stack -- docker compose -f /workspace/compose.yaml up -d
bhatti publish stack -p 8080         # if compose exposes :8080 on the host
```

For long-running compose stacks, consider `--keep-hot` on `bhatti create` so the [thermal manager](/v1/docs/under-the-hood/thermal-states/) doesn't pause the VM during idle periods (TCP connections from the public preview URL survive pause, but new connections during pause cost a wake).

## Networking

The bhatti kernel ships `iptables-legacy` (not nft). Docker's bridge driver expects either, and the tier sets the legacy alternatives at build time. If you install a package that switches the alternatives back to nft, dockerd will fail to set up bridge networking. To recover:

```bash
bhatti exec dev -- sudo update-alternatives --set iptables /usr/sbin/iptables-legacy
bhatti exec dev -- sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy
bhatti exec dev -- sudo systemctl restart docker
```

Inside the sandbox, dockerd creates its own `docker0` bridge. Container-to-container networking, port publishing inside the VM (`docker run -p 8080:80 ...`), and DNS for container names all work normally. The bhatti-level publish (`bhatti publish dev -p 8080`) targets the sandbox's host-side port; if a container binds to `0.0.0.0:8080` inside, it's reachable.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `docker run` hangs / `dial unix /run/systemd/private` in logs | daemon.json missing or wrong cgroup driver | `cat /etc/docker/daemon.json` should say `cgroupfs`; if not, write it and `systemctl restart docker` |
| `docker buildx: unknown command` | `docker-buildx-plugin` not installed (very old image) | `sudo apt-get install -y docker-buildx-plugin` or `sudo bhatti update --tiers docker` on the server |
| `tonistiigi/binfmt --install all` reports success but cross-arch builds fail | `/proc/sys/fs/binfmt_misc` not mounted (very old lohar) | Verify with `mount | grep binfmt_misc`; if missing, server is on bhatti \< v1.11.8 — `sudo bhatti update` |
| `permission denied` on `/var/run/docker.sock` from `bhatti exec` | socket mode regressed after `systemctl restart docker` and ExecStartPost didn't fire | `systemctl status docker` to confirm active; if active but socket is `0660`, the drop-in is missing — check `/etc/systemd/system/docker.service.d/bhatti.conf` |
| `docker run …` fails with iptables errors | alternatives switched to nft | re-set to legacy (see [Networking](#networking)) |
| Cross-arch container runs but exits with `exec format error` | qemu handler not registered for that arch | re-run `tonistiigi/binfmt --install all`; check `ls /proc/sys/fs/binfmt_misc/` for `qemu-<arch>` |
| `docker.service` repeatedly entering "activating" | `dockerd` not sending `READY=1` (Type=notify) — usually a containerd issue | `systemctl status containerd`; check `journalctl -u containerd` |

## Resource sizing

| Workload | `--cpus` | `--memory` |
|---|---:|---:|
| `docker run` of small images (`hello-world`, alpine tools) | 2 | 2048 |
| Light compose stacks (3–5 small services) | 2–4 | 2048–4096 |
| `buildx build` of a typical app image | 4 | 4096 |
| Cross-arch `buildx build` with qemu emulation | 4 | 4096–8192 |
| Heavy CI builds (large dependency graphs, native compilation) | 8 | 8192+ |

Memory matters more than CPU for most builds — overlayfs page cache, build context, and intermediate layers all live in the guest. dockerd itself runs comfortably in 256 MB; anything above that is your workload.

## See also

* [Tiers overview](/v1/docs/managing/tiers/) — what each tier is for
* [Adding a tier](/v1/docs/contributing/adding-a-tier/) — build your own
* [Kernel](/v1/docs/contributing/kernel/) — flags enabled for Docker, why
* [Lohar: systemctl shim](/v1/docs/under-the-hood/lohar-the-blacksmith/) — how unit files are managed without real systemd
* [Decisions & learnings](/v1/docs/under-the-hood/decisions/) — why no socket activation, why no D-Bus
* [Thermal states](/v1/docs/under-the-hood/thermal-states/) — `--keep-hot` and what idle behaviour to expect for long-running stacks
