---
title: Browser tier
description: Headless Chromium with the Chrome DevTools Protocol exposed on :9222.
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

Today, by `/etc/bhatti/init.sh` at boot, which backgrounds `headless_shell` with these flags:

```sh
--no-sandbox
--disable-gpu
--disable-dev-shm-usage
--remote-debugging-port=9222
--remote-debugging-address=0.0.0.0
```

After launching, init.sh polls `http://127.0.0.1:9222/json/version` for up to 5 seconds; if CDP isn't accepting connections, it logs a warning but doesn't fail boot.

:::caution
This tier still uses the legacy `init.sh` boot path. The [docker tier](./docker/) and [computer tier](./computer/) (partially) have been moved to lohar's `systemctl` shim — `headless-chrome.service` will join them in a subsequent patch. When that lands, the user-visible behaviour is unchanged (`http://localhost:9222` still works the same way) but you'll be able to `systemctl status headless-chrome` and `systemctl restart headless-chrome` like every other managed daemon, and `Restart=on-failure` will resurrect Chromium after a crash. Until then, a crashed Chromium stays dead — you can manually restart with `bhatti exec <name> -- /etc/bhatti/init.sh`.
:::

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

Today, none — flags are baked into `init.sh`. After the systemd-unit conversion, the planned env knobs are:

| Variable | Default | Effect |
|---|---|---|
| `CHROME_REMOTE_PORT` | 9222 | CDP port to listen on |
| `CHROME_FLAGS` | "" | Extra space-separated flags appended to ExecStart (e.g. `--user-agent=…`, `--proxy-server=…`) |

If you need custom flags today, edit `/etc/bhatti/init.sh` inside the sandbox and re-run it, or `bhatti exec --env CHROME_FLAGS=…` after invoking `headless_shell` yourself.

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
| `curl /json/version` returns connection refused | Chromium failed to start at boot (zombie pid file, OOM, missing deps) | `bhatti exec <name> -- ps -ef | grep headless`. If missing, rerun `/etc/bhatti/init.sh`. |
| Chromium crashed mid-session | currently no auto-restart on this tier | re-run `/etc/bhatti/init.sh`; will become `systemctl restart headless-chrome` after the unit conversion |
| Pages OOM with `Aw, Snap!` | Memory too low | bump `--memory` to 2048+ |
| `chrome-sandbox` permission errors | `--no-sandbox` not on; rare since it's baked in | confirm init.sh hasn't been edited |

## See also

- [Tiers overview](/docs/managing/tiers/)
- [Docker tier](./docker/) — when you'd combine Docker + headless Chromium
- [Computer tier](./computer/) — when you need a *visible* browser (KasmVNC + Chromium UI)
- [`bhatti publish`](/docs/reference/cli/networking/publish/) — exposing :9222 publicly
