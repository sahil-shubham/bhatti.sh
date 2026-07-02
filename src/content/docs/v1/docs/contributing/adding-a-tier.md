---
title: Adding a Tier
description: How to create a new rootfs tier for bhatti.
slug: v1/docs/contributing/adding-a-tier
---

Tiers are pre-built ext4 root filesystem images. Each tier builds on `minimal` and adds specific tooling. The server auto-discovers tiers at startup by globbing `rootfs-*-{arch}.ext4` in the images directory.

## Steps

### 1. Create the tier script

Add `scripts/tiers/<name>.sh`. This runs inside a chroot during the build. It receives `$MOUNT`, `$ARCH`, `$DEB_ARCH`, `$AGENT`, and `$SCRIPT_DIR` as environment variables.

Most tiers source minimal first:

```bash
#!/bin/bash
set -euo pipefail
"$SCRIPT_DIR/tiers/minimal.sh"

chroot "$MOUNT" /bin/bash -c '
    apt-get update -qq
    apt-get install -y --no-install-recommends your-packages
    apt-get clean
    rm -rf /var/lib/apt/lists/*
'
```

### 2. Long-running daemons: ship them as systemd units

If your tier needs a daemon running on boot — a database, a headless browser, a VNC gateway — ship it as a `.service` file and let lohar's [`systemctl` shim](/v1/docs/under-the-hood/lohar-the-blacksmith/) manage it. Don't write `init.sh` (the legacy pattern); don't fork the daemon yourself; don't try to manage PIDs, restarts, or cgroups.

The canonical short example is `headless-chrome.service` from the browser tier:

```ini
[Unit]
Description=Headless Chromium with Chrome DevTools Protocol
After=network.target

[Service]
Type=simple
# Defaults; user-supplied values in /run/bhatti/config-env override.
Environment=CHROME_REMOTE_PORT=9222
Environment=CHROME_FLAGS=
EnvironmentFile=-/run/bhatti/config-env
ExecStart=/usr/local/bin/headless_shell --no-sandbox --disable-gpu \
    --disable-dev-shm-usage \
    --remote-debugging-port=${CHROME_REMOTE_PORT} \
    --remote-debugging-address=0.0.0.0 \
    $CHROME_FLAGS
Restart=on-failure
RestartSec=2s

[Install]
WantedBy=multi-user.target
```

The pattern:

* **`Type=simple`** for daemons that stay in the foreground (the common case). **`Type=notify`** for daemons that speak `sd_notify(3)` and signal `READY=1` once their socket is up (`dockerd`, `postgresql`). **`Type=oneshot`** with `RemainAfterExit=yes` for first-boot setup helpers (password generation, env-file writers).
* **`ExecStart=`** points at the binary directly. No `/bin/sh -c` wrapper. The shim already wraps your command in `/bin/sh -c "exec <ExecStart>"` for variable expansion; nesting another shell is redundant at best.
* **`Restart=on-failure`** + **`RestartSec=2s`** is the right default for long-running daemons. The shim respects the standard `StartLimitBurst` / `StartLimitIntervalSec` so a crash loop gives up cleanly.
* **User-tunable knobs**: declare defaults via `Environment=` and add `EnvironmentFile=-/run/bhatti/config-env`. The leading `-` makes the file optional, so sandboxes with no `--env` flags still boot cleanly. Values passed at create time (`bhatti create --env CHROME_REMOTE_PORT=9333`) override the unit's defaults via the config-env bridge that lohar materialises at boot ([`cmd/lohar/main.go`](https://github.com/sahil-shubham/bhatti/blob/main/cmd/lohar/main.go)).

Drop the unit into `/etc/systemd/system/<name>.service` and symlink it into `multi-user.target.wants/` so lohar's `startEnabledServices` picks it up at boot:

```bash
cat > "$MOUNT/etc/systemd/system/headless-chrome.service" << UNIT
... (unit body above) ...
UNIT

ln -sf /etc/systemd/system/headless-chrome.service \
    "$MOUNT/etc/systemd/system/multi-user.target.wants/headless-chrome.service"
```

That's all. The shim handles cgroup placement (race-free, see [How services are spawned](/v1/docs/under-the-hood/lohar-the-blacksmith/#how-services-are-spawned)), pidfile creation, restart-on-failure, and `journalctl -u` log routing. Your unit just declares what to run.

#### Anti-patterns

Three mistakes will silently break your tier:

* **Don't write `init.sh`.** The legacy pre-v1.11.3 pattern (one shell script in `/etc/bhatti/init.sh` that runs all your daemons in the background) is gone. Daemons started that way escape the shim's lifecycle entirely — no `systemctl status`, no `journalctl -u`, no `Restart=`, no `cgroup.kill` on stop. Existing tiers were converted off `init.sh` in v1.11.7–v1.11.9.
* **Don't wrap `ExecStart=` in `/bin/sh -c '...'` yourself.** The shim does it for you. An inner shell is redundant on a good day; on a bad day (a daemon that double-`fork`s during startup) it introduces a fork the placement helper has to chase. Use `Environment=` and `${VAR}` expansion in the unit file — systemd's parser handles that natively.
* **Don't manage cgroups, pidfiles, or restart loops yourself.** All three live in the shim once your unit is enabled. Writing your own `pkill` cleanup or pidfile parsing means you're fighting the shim, not using it.

You don't need to know about `lohar spawn` to author a unit. The helper sits upstream of `ExecStart=` and is invisible to the unit file — it's how the shim gets the daemon into the right cgroup before any fork. If you find yourself reading [`cmd/lohar/spawn.go`](https://github.com/sahil-shubham/bhatti/blob/main/cmd/lohar/spawn.go) you've probably gone too deep.

### 3. Add size default in `scripts/build-tier.sh`

```bash
case "$TIER" in
    minimal)  SIZE_MB="${SIZE_MB:-512}" ;;
    browser)  SIZE_MB="${SIZE_MB:-2048}" ;;
    new-tier) SIZE_MB="${SIZE_MB:-1024}" ;;  # ← add this
    *) echo "unknown tier: $TIER" >&2; exit 1 ;;
esac
```

### 4. Add to CI release matrix

In `.github/workflows/release.yml`:

```yaml
tier: [minimal, browser, docker, computer, new-tier]
```

### 5. Add to the install script

In `scripts/install.sh`, update the interactive tier prompt and the `ALL_KNOWN_TIERS` variable in `do_server_update()`.

### 6. Verify

The bats test suite (`scripts/install_test.bats`) validates that every tier in `scripts/tiers/` appears in all four places:

```bash
bats scripts/install_test.bats
```

If you miss a registration point, the tier consistency tests catch it.

## Checklist

```
[ ] scripts/tiers/<name>.sh
[ ] scripts/tiers/<name>.sh — .service unit(s) for long-running daemons,
                              symlinked into multi-user.target.wants/
[ ] scripts/build-tier.sh — SIZE_MB case
[ ] .github/workflows/release.yml — matrix.tier
[ ] scripts/install.sh — interactive menu
[ ] scripts/install.sh — ALL_KNOWN_TIERS
[ ] bats tests pass
```
