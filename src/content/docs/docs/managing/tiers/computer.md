---
title: Computer tier
description: A full XFCE desktop in a microVM, served over KasmVNC on a single web port.
---

The `computer` tier is a full graphical Linux desktop: KasmVNC + XFCE + Chromium, served over one HTTP/WebSocket port (`6080`) as a browser-based web client. The right tier for visual agent-driven work (a model that sees a real desktop), demos, and any scenario where "open a browser and look at it" is the interface.

```bash
bhatti create --name desk --image computer --cpus 2 --memory 4096 --disk-size 8192
bhatti publish desk -p 6080
bhatti exec desk -- vnc-creds          # username + password
# Open the URL printed by `publish` in your browser, log in.
```

## Why `--cpus 2` is the practical floor

KasmVNC's encoder thread count is sized to the guest's vCPUs (`nproc - 1`, leaving one core for the desktop itself). On `--cpus 1` the encoder, the X server, XFCE, and Chromium all share one core — expect &lt;10 fps and laggy input. Two cores is usable; four is comfortable.

## What's in it

| Component | Role |
|---|---|
| **KasmVNC** (`Xkasmvnc`) | Combined X server + RFB → WebSocket gateway. Replaces the older Xvfb + x11vnc + noVNC + websockify stack with one binary, one port. |
| **XFCE** (`startxfce4`) | Lightweight desktop environment. Window manager, panel, file manager, app launcher. |
| **Chromium** | The browser. `chromium-browser <url>` wrapper applies sane flags (`--no-sandbox` because we're in a VM, `--test-type` to suppress nags). |
| `xdotool`, `scrot`, `xdpyinfo` | Mouse/keyboard input, screenshots, display introspection. Used by the agent-helper scripts below. |

## Credentials

A random 16-character password is generated **on first boot of each sandbox** (not at image-bake time):

- Hashed into `/root/.kasmpasswd` for KasmVNC.
- Stored cleartext in `/root/.vnc/cleartext` (root-only, mode `0600`) for the `vnc-creds` helper.
- Each sandbox gets its own; the published rootfs image carries no shared secret.
- Snapshot/resume preserves the password (the file already exists; firstboot generation is skipped).

Retrieve them anytime:

```bash
bhatti exec desk -- vnc-creds          # human-readable
bhatti exec desk -- vnc-creds --json   # for scripts/agents
```

:::caution
[`bhatti image save`](/docs/reference/cli/images/save/) on a running computer-tier sandbox **bakes the current password into the saved image**. Treat saved-from-running images like any other secret-bearing artifact. If you share such an image, anyone with it has VNC access to every sandbox stamped from it. The clean alternative is to delete `/root/.kasmpasswd` and `/root/.vnc/cleartext` before saving, so firstboot regen kicks in on every new sandbox.
:::

## Tunables

Pass at create time with `--env` (comma-separated):

| Variable | Default | What it controls |
|---|---|---|
| `DISPLAY_WIDTH` | `1280` | X server geometry width |
| `DISPLAY_HEIGHT` | `720` | X server geometry height |
| `DISPLAY_DEPTH` | `24` | Colour depth (16 / 24 / 32) |
| `KASM_FRAMERATE` | `60` | Max frames/sec the encoder will emit (matches KasmVNC's upstream default) |
| `KASM_THREADS` | `nproc - 1` | Encoder thread count; default leaves one vCPU for the desktop |

```bash
bhatti create --name desk --image computer --cpus 4 --memory 4096 \
    --env "DISPLAY_WIDTH=1920,DISPLAY_HEIGHT=1080,KASM_FRAMERATE=30"
```

`KASM_FRAMERATE=30` is worth setting on low-bandwidth links — encoder load drops roughly linearly with framerate, and 30 fps is more than enough for desktop work.

## Beyond the env knobs

KasmVNC has dozens of options bhatti deliberately doesn't surface (dynamic quality bounds, video-mode thresholds, scaling algorithms, DLP/clipboard policy, etc.). For those, edit `/etc/kasmvnc/kasmvnc.yaml` inside the sandbox and reconnect. The upstream docs are authoritative:

- [Video rendering options](https://github.com/kasmtech/KasmVNC/wiki/Video-Rendering-Options)
- [Stats / control API](https://github.com/kasmtech/KasmVNC/wiki/API)
- [Browser-side tuning](https://github.com/kasmtech/KasmVNC/wiki/Browser-Support)

## Agent helpers

Run any of these via `bhatti exec`. `DISPLAY=:99` is pre-set (lohar writes it to `/run/bhatti/env` so exec inherits it), so X-talking helpers just work.

| Helper | Purpose |
|---|---|
| `vnc-creds [--json]` | Print the username and password for this sandbox |
| `screenshot [--base64]` | Capture the current display as PNG |
| `screen-size` | Print the current X resolution |
| `active-window` / `list-windows` | Inspect window state |
| `xdotool …` | Drive mouse/keyboard input |
| `chromium-browser <url>` | Launch Chromium with sane flags |

The typical agent loop:

```bash
bhatti exec desk -- chromium-browser https://example.com &
sleep 2
bhatti exec desk -- screenshot --base64 > frame.b64
bhatti exec desk -- xdotool key Return
bhatti exec desk -- xdotool type "hello world"
```

## How the desktop is started

Managed by lohar's `systemctl` shim as four units (since v1.11.9), replacing the monolithic `init.sh`:

| Unit | Type | Purpose |
|---|---|---|
| `kasmvnc-firstboot.service` | `oneshot` | Per-sandbox password generation + dynamic `KASM_THREADS` default. `ConditionPathExists=!/root/.kasmpasswd` makes it idempotent on snapshot/resume. |
| `kasmvnc.service` | `simple` | `Xkasmvnc :99` — combined X server + RFB-over-WebSocket gateway. Listens on port 6080. `After=kasmvnc-firstboot.service`. `Restart=on-failure`. |
| `xfce-session.service` | `simple` | `startxfce4` desktop session. `After=` + `Requires=kasmvnc.service` so killing the X server cascades. `Restart=on-failure`. |
| `bhatti-display-env.service` | `oneshot` | Writes `DISPLAY=:99` to `/run/bhatti/env` so `bhatti exec` inherits it. |

Activation order at boot: `kasmvnc-firstboot` and `bhatti-display-env` start in the first wave (no `After=`), then `kasmvnc.service`, then `xfce-session.service`.

Operator UX:

```bash
bhatti exec desk -- systemctl status kasmvnc xfce-session
bhatti exec desk -- journalctl -u kasmvnc -n 50
bhatti exec desk -- systemctl restart kasmvnc      # cascades: xfce restarts too
bhatti exec desk -- systemctl restart xfce-session # just the desktop, X server stays
```

### What's deliberately not running

The pre-v1.11.9 `init.sh` started a system `dbus-daemon`, an orphan session bus via `dbus-launch`, and `pulseaudio`. None of those are started in the systemd-unit model. The reasoning:

- **`dbus-daemon --system`** keeps long-lived inotify watches on `/etc/dbus-1/`, an epoll on its listening socket, and per-connection timers. microVM snapshot/restore doesn't preserve all kernel-side poller state cleanly on ARM64 — the same reason lohar runs as PID 1 instead of real systemd ([Decisions & learnings](/docs/under-the-hood/decisions/)).
- **`dbus-launch`** in the original init.sh ran a session bus tied to the boot shell's scope, leaked its address into the `startxfce4` env, and orphaned when init.sh exited. A bug, not a feature. Modern XFCE (4.16+) launches its own per-session bus on demand when it actually needs one.
- **`pulseaudio`** wasn't connected to any sink and no documented agent flow uses audio.

The `dbus` and `dbus-x11` packages stay installed (libdbus links from XFCE / Chromium), they're just not auto-started as a system bus. Practical fallout: a few `xfsettingsd` warnings on first XFCE start, Thunar's D-Bus activation paths are skipped, Chromium's notifications and password-manager features are unavailable. The desktop still loads.

If you need a system dbus for an app that depends on it, the narrowest fix is to scope it to xfce-session's lifecycle rather than running at multi-user.target — so the snapshot-risk window is only "while xfce is up":

```ini
# /etc/systemd/system/dbus-system.service (drop in via the sandbox)
[Unit]
Description=System bus for xfce
Before=xfce-session.service

[Service]
Type=forking
PIDFile=/run/dbus/pid
ExecStartPre=/bin/mkdir -p /run/dbus
ExecStart=/usr/bin/dbus-daemon --system --fork
```

Then `systemctl enable --now dbus-system.service`. We don't ship this by default.

## Sizing

| Workload | `--cpus` | `--memory` |
|---|---:|---:|
| Light interactive use, agent loops with screenshots | 2 | 2048 |
| Browser + agent + occasional video | 4 | 4096 |
| Multiple Chromium tabs + multimedia | 4 | 4096–6144 |
| Heavy multimedia / many open apps | 6+ | 8192+ |

`--disk-size 8192` is the recommended floor — Chromium's cache and any web content you accumulate during a session can easily hit 4–5 GB.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| KasmVNC web client loads, then shows a red `No password configured for VNC Auth` banner | `-SecurityTypes=None` flag missing from `Xkasmvnc` invocation; image is pre-fix | `sudo bhatti update --tiers computer` on the server |
| HTTP Basic auth challenge appears but the password is wrong | Sandbox was saved-from-image with stale creds | `bhatti exec desk -- sudo rm /root/.kasmpasswd && sudo /etc/bhatti/init.sh` to regen |
| Black screen, no XFCE panel | `startxfce4` failed (usually D-Bus). Check `journalctl -u bhatti` (host side) or `~/.xsession-errors` (guest) | Restart desktop: `bhatti exec desk -- /etc/bhatti/init.sh` |
| Mouse input lags by seconds | Encoder is CPU-starved | Bump `--cpus`; lower `KASM_FRAMERATE`; check `top` inside the sandbox |
| `xdotool` does nothing | `DISPLAY` not set in the exec environment | `bhatti exec desk -- env | grep DISPLAY` — should show `:99`. If empty, re-run init.sh to repopulate `/run/bhatti/env`. |

## See also

- [Tiers overview](/docs/managing/tiers/)
- [`bhatti publish`](/docs/reference/cli/networking/publish/) — exposing port 6080 with a public URL
- [`bhatti share`](/docs/reference/cli/networking/share/) — single-use authenticated session URLs (useful for VNC handoff)
- [Thermal states](/docs/under-the-hood/thermal-states/) — `--keep-hot` for active sessions, to prevent the VM from pausing under your feet
