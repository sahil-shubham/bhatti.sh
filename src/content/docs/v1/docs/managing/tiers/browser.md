---
title: Browser tier
description: Headless Chromium with the Chrome DevTools Protocol exposed on :9222.
slug: v1/docs/managing/tiers/browser
---

The `browser` tier ships Chromium (via Playwright's `headless_shell` build), Playwright itself, and Node 22. Chromium starts at boot with CDP exposed on `:9222` ready to drive — no display server, no X, no VNC. The right tier for scraping, programmatic CDP control, headless tests, and PDF / screenshot rendering.

```bash
bhatti create --name scraper --image browser --cpus 2 --memory 2048
bhatti exec scraper -- curl -s http://localhost:9222/json/version | jq .Browser
# "Chrome/<version>"
```

## What's in it

| Component | Source |
|---|---|
| Chromium (`headless_shell` binary) | Playwright's pinned download (`~/.cache/ms-playwright/chromium-*/`) |
| Playwright | `npm install -g playwright` |
| Node 22 | NodeSource apt repo |
| Chromium runtime deps | `npx playwright install-deps chromium` |

Playwright's `headless_shell` is used rather than full Chrome — it's the dedicated headless build with reliable CDP. The full Chrome binary has known CDP-attach issues in headless mode that show up as silent stream hangs.

## How Chromium is started

Managed by lohar's `systemctl` shim as `headless-chrome.service` (since v1.11.9). The unit ships with these defaults:

```ini
[Service]
Type=simple
Environment=CHROME_REMOTE_PORT=9222
Environment=CHROME_FLAGS=
EnvironmentFile=-/run/bhatti/config-env
ExecStart=/root/.cache/ms-playwright/chromium_headless_shell-<rev>/chrome-linux/headless_shell \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --remote-debugging-port=${CHROME_REMOTE_PORT} \
    --remote-debugging-address=0.0.0.0 \
    $CHROME_FLAGS
Restart=on-failure
RestartSec=2s
```

The path to `headless_shell` is resolved at build time by the tier script (Playwright stamps a version-suffixed directory) and baked into the unit. Operator UX is the same as every other tier:

```bash
bhatti exec scraper -- systemctl status headless-chrome
bhatti exec scraper -- journalctl -u headless-chrome -n 50
bhatti exec scraper -- systemctl restart headless-chrome
```

If Chromium crashes, the shim restarts it after 2 s. The crash + restart show up in `journalctl -u headless-chrome`.

## Driving it from outside the sandbox

CDP is HTTP + WebSocket. Publish the port and connect from anywhere:

```bash
bhatti publish scraper -p 9222
# → https://scraper-abc123.bhatti.sh
```

From your host, point any CDP client at the published URL. Playwright on the host:

```js
const browser = await chromium.connectOverCDP('https://scraper-abc123.bhatti.sh');
```

Puppeteer:

```js
const browser = await puppeteer.connect({
    browserWSEndpoint: 'wss://scraper-abc123.bhatti.sh/devtools/browser/…'
});
```

You can fetch the WebSocket endpoint from `/json/version`:

```bash
curl -s https://scraper-abc123.bhatti.sh/json/version | jq -r .webSocketDebuggerUrl
```

## Driving it from inside the sandbox

`bhatti exec` runs as uid 1000 with Node and Playwright already in `$PATH`. The fastest agent loop is to write your script as a file and exec it:

```bash
bhatti file write scraper /workspace/scrape.js < ./scrape.js
bhatti exec scraper -- node /workspace/scrape.js
```

The Playwright globals (`chromium`, `firefox`, `webkit`) all work, but only Chromium has a running browser to attach to via CDP. To launch fresh Chromium instances from your script (rather than the boot-time one), use `chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-*/chrome-linux/headless_shell' })` — the boot-time instance is a convenience, not a requirement.

## Tunables

Set at create time via `bhatti create --env K=V,K=V`. The values flow into the unit through lohar's [config-env bridge](/v1/docs/under-the-hood/lohar-the-blacksmith/#config-env-bridge):

| Variable | Default | Effect |
|---|---|---|
| `CHROME_REMOTE_PORT` | `9222` | CDP port to listen on |
| `CHROME_FLAGS` | `""` | Extra space-separated flags appended to ExecStart (`--user-agent=…`, `--proxy-server=…`, `--lang=…`, etc.) |

```bash
bhatti create --name scraper --image browser \
    --env "CHROME_FLAGS=--user-agent=Mozilla/5.0 (compatible; bhatti-bot/1.0)"
```

To edit flags on a running sandbox, drop a unit override and restart:

```bash
bhatti exec scraper -- sudo mkdir -p /etc/systemd/system/headless-chrome.service.d
bhatti exec scraper -- sudo tee /etc/systemd/system/headless-chrome.service.d/custom.conf <<'EOF'
[Service]
Environment=CHROME_FLAGS=--proxy-server=http://my-proxy:3128
EOF
bhatti exec scraper -- sudo systemctl restart headless-chrome
```

## Sizing

| Workload | `--cpus` | `--memory` |
|---|---:|---:|
| Single-page scrapes, CDP drive | 1 | 1024 |
| Concurrent Playwright tests | 2 | 2048 |
| PDF rendering at scale | 2–4 | 2048–4096 |

Chromium is memory-hungry — 512 MB will OOM on any non-trivial page. The 1 GB default minimum is a real floor.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `curl /json/version` returns connection refused | Chromium failed to start at boot | `systemctl status headless-chrome`; `journalctl -u headless-chrome` for the crash reason |
| Chromium crashed mid-session | crash recovered via `Restart=on-failure`, but flapping if it crashes repeatedly | `systemctl status headless-chrome` shows `(activating)` if currently restarting, `(failed)` if start-limit hit; `journalctl -u headless-chrome` for the underlying error |
| Pages OOM with `Aw, Snap!` | Memory too low | bump `--memory` to 2048+ |
| `chrome-sandbox` permission errors | `--no-sandbox` got dropped from a custom drop-in | check `/etc/systemd/system/headless-chrome.service.d/` — the upstream unit always passes `--no-sandbox` |
| CHROME\_FLAGS not picked up | `--env` syntax: must be comma-separated, not repeated `--env` flags | `bhatti create --env "K1=V1,K2=V2"` (single string, comma-separated) |

## See also

* [Tiers overview](/v1/docs/managing/tiers/)
* [Docker tier](./docker/) — when you'd combine Docker + headless Chromium
* [Computer tier](./computer/) — when you need a *visible* browser (KasmVNC + Chromium UI)
* [`bhatti publish`](/v1/docs/reference/cli/networking/publish/) — exposing :9222 publicly
