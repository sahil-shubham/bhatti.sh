# Operating bhatti as an AI agent

You're an AI assistant helping a user with bhatti — either getting them
set up, or driving sandboxes for them at runtime. This file is voiced
to you, the agent. Send the human to <https://bhatti.sh/docs/quickstart/>
for the user-facing tour.

Canonical reference index: <https://bhatti.sh/llms.txt>


## Three install intents

Don't pre-check the user's platform — `scripts/install.sh` does that
and errors with fixable messages (KVM missing, root needed, unsupported
arch). Your job is to pick the right `--mode` for the user's *intent*.

**A. The user wants to run their own bhatti server (self-host).**

```bash
curl -fsSL bhatti.sh/install | sudo bash -s -- --mode server --tier minimal
```

Works on **Linux (KVM)** or **macOS (Apple Silicon, HVF)** — either can be a dev
box or a server. The script preflights the hypervisor (KVM on Linux, HVF on
Apple Silicon) and dies with a readable message if unsupported. On success it
creates an admin user, writes `~/.bhatti/config.yaml` for `$SUDO_USER`, and
starts the service (systemd on Linux, launchd on macOS). **No `bhatti setup` step
needed afterwards.** Verify with:

```bash
bhatti version && bhatti create dev && bhatti exec dev -- echo ok
```

**B. The user has an API key for someone else's bhatti server.**

```bash
curl -fsSL bhatti.sh/install | bash -s -- --mode cli
bhatti setup --url <URL> --token <KEY>
```

Works on any OS. **Never pipe values into the bare `bhatti setup`
form** — it prompts for both, your script will hang.

**C. The user doesn't know which they want.**

Ask. Don't guess from `uname` or `id -u`. The diagnostic question is
"do you have a Linux box with `sudo` you'd like to host bhatti on, or
do you have an API key from someone else?" If neither, they need to
find one or the other before any install command makes sense.

Tier choice (`--tier`) for case A: `minimal` (default, ~200 MB —
right answer unless you have a reason), `browser` (~600 MB, Chromium
+ Playwright), `docker` (~550 MB, Docker-in-VM), `computer` (~1.5 GB,
XFCE desktop). See Workflow F for when each matters.


## Non-interactive setup fallback (case B)

If `bhatti setup --url --token` isn't available (CLI older than v1.11),
write the config file directly — same effect:

```bash
mkdir -p ~/.bhatti
cat > ~/.bhatti/config.yaml <<EOF
api_url: $URL
auth_token: $TOKEN
EOF
bhatti version    # confirms the CLI loads the config
```

`~/.bhatti/config.yaml` is the user-level config; `/etc/bhatti/config.yaml`
is the daemon's. **Don't write credentials to `/etc/`.**


## The minimum: run one thing in an isolated VM

```bash
bhatti create --name once && bhatti exec once -- <cmd>; bhatti destroy once -y
```

That's the floor. Everything below is a real workflow that strings
multiple primitives together — the kind of thing a per-noun reference
won't pre-join for you.


## Workflows

### A. Preview deployments per pull request (CI)

The canonical bhatti use case. Each PR gets its own Linux VM,
its own URL, and costs nothing while idle (auto-pauses, ~50 ms cold
wake when a reviewer clicks the link).

```bash
# In CI, on PR open / push:
NAME="pr-$PR_NUMBER"

# Create — idempotent: re-running on a new push reuses the sandbox
# (response carries X-Bhatti-Existing: true; safe to retry).
bhatti create --name "$NAME" --image minimal \
  --volume preview-cache:/root/.cache \
  --secret DATABASE_URL

# Inject the build artifact and start the app in the background.
bhatti file write "$NAME" /app/build.tar < ./build.tar
bhatti exec "$NAME" --detach -- bash -c \
  'cd /app && tar xf build.tar && npm start'

# Wait for the port before publishing — publish without a listener gives 502s.
until bhatti ports "$NAME" 2>/dev/null | grep -q 3000; do sleep 0.5; done
bhatti publish "$NAME" -p 3000 -a "$NAME"

echo "preview=https://$NAME.bhatti.example.com" >> "$GITHUB_OUTPUT"
```

On PR close:

```bash
bhatti destroy "pr-$PR_NUMBER" -y
```

Why this shape:

- The shared `preview-cache` volume warms `npm install` across PRs.
- `--detach` returns immediately so CI doesn't hang on the server's lifetime.
- The `until … ports` loop closes the publish-race (502 if the port isn't bound yet).
- Public published URLs have **no auth**. If reviews need to be private, swap `bhatti publish` for `bhatti share "$NAME"` — that returns a single-use web-shell URL with the token in the URL fragment (never sent to the server).

### B. A persistent dev environment that resumes instantly

For when the user wants their own always-ready box. State survives
across days; bhatti pauses it when idle so it doesn't burn resources.

```bash
# First time
bhatti volume create --name dev-home --size 10240
bhatti create --name dev --cpus 4 --memory 4096 \
  --image browser \
  --volume dev-home:/root \
  --secret GITHUB_TOKEN

bhatti shell dev          # work, Ctrl+\ to detach (sandbox keeps running)

# End of session — optional: name a restore point
bhatti snapshot create dev --name $(date +%F)
```

Next day:

```bash
bhatti shell dev          # auto-wakes from cold (~50 ms), scrollback replays
```

Why this shape:

- The volume holds the user's home directory; survives `destroy` and
  `snapshot resume` independently. **It's the only thing that's
  durable in the obvious sense.**
- The sandbox itself auto-pauses when idle, so naming a snapshot is
  only useful as a *named restore point* — the auto-pause/resume
  already handles "I want my session back."
- For pair work: `bhatti share dev` gives a teammate a web-shell URL
  for the same sandbox. The token revokes on the next call to `share`.

### C. Branch a known-good state into N parallel experiments

The agent-shaped killer feature. Every snapshot can be resumed into
its own new sandbox, with the full memory state intact — running
processes, page cache, everything. Real branching of a Linux VM.

```bash
bhatti snapshot create dev --name baseline      # source keeps running

# Fan out three trials in parallel
for i in 1 2 3; do
  bhatti snapshot resume baseline --name "trial-$i" &
done
wait

# Each trial is a separate sandbox. Run different things in each.
bhatti exec trial-1 -- ./strategy-a.sh > /tmp/a.log 2>&1 &
bhatti exec trial-2 -- ./strategy-b.sh > /tmp/b.log 2>&1 &
bhatti exec trial-3 -- ./strategy-c.sh > /tmp/c.log 2>&1 &
wait

# Inspect, keep the winner, destroy the rest
bhatti inspect trial-2
for i in 1 3; do bhatti destroy "trial-$i" -y; done
```

Why this shape:

- **Persistent volumes are NOT included in a snapshot.** If your trial
  needs the source's volume data, you have to copy it (`volume clone`)
  or remount manually — each resumed sandbox starts with no volumes.
- The source sandbox keeps running through the whole thing. Snapshots
  are non-destructive copies.
- This is genuinely cheap: each resume is ~50 ms and a copy-on-write
  rootfs. You can fan out 10+ in parallel without breaking a sweat.

### D. Diagnose a misbehaving sandbox

When something's wrong, this is the order to investigate.

```bash
# What exists, and at what thermal state?
bhatti list

# Full record: IP, image, env, volume mounts, status. Read-only — doesn't wake a cold one.
bhatti inspect api

# What's listening inside? If your published URL gives 502, this is why.
bhatti ports api

# What sessions are alive? Detached exec, init script, attached shell.
bhatti ps api

# Logs from inside
bhatti file read api /var/log/app.log | tail -100

# Drop in for a closer look
bhatti shell api          # Ctrl+\ to detach without killing it

# Server-side: what has the daemon done lately for this sandbox?
sudo bhatti admin events --sandbox api --since 1h
sudo bhatti admin status                       # overall health + last ~10 events
```

Why this shape:

- `inspect` doesn't wake cold sandboxes; safe to run on idle ones.
- `admin events` and `admin status` are **server-local** — they read
  the daemon's SQLite directly, so they need `sudo` and only work on
  the host running `bhatti serve`. Not API calls.
- For "is the proxy itself working?" hit `<api-base>/sandboxes/api/proxy/<port>/`
  with auth before debugging the published URL — that isolates auth/DNS issues.

### E. A reproducible image you can hand to teammates

When the env-setup itself is the value, save it as an image and share.

```bash
# Bring in a base — public OCI registry
bhatti image pull python:3.12 --name py312      # async; returns a task ID

# OR: import from the local Docker daemon (works for private registries —
# bhatti shells out to `docker save` so you don't hand it credentials).
bhatti image import our-registry.com/our-app:latest --name our-app
# Or, for a tarball already on disk:
#   bhatti image import --tar /tmp/our-app.tar --name our-app

# Customize
bhatti create --name build --image py312
bhatti exec build -- pip install -r requirements.txt
bhatti exec build -- ./prepare-data.sh

# Save the customized rootfs as a new image
bhatti image save build --name py312-prepared

# Hand it to teammates
bhatti image share py312-prepared --user alice --user bob
# They now see it in `bhatti image list`; create with --image py312-prepared
```

Why this shape:

- `image pull` is async — returns `202` with a task ID. The CLI polls
  for you; a `--json` invocation gives you the task ID to poll yourself.
- **`image save` captures rootfs only — persistent volumes are not
  included.** The image is what to *boot* with; volumes are mutable
  state attached at create time.
- `image share` is server-local (operates on the host SQLite, not the
  HTTP API). Run it on the server itself with `sudo`. There's no
  HTTP endpoint for sharing — by design.
- System tier images (`minimal`, `browser`, etc.) can't be deleted
  via the API. User-owned images you saved can.

### F. Browser-as-a-service or a desktop the user can see

Two distinct cases that agents conflate.

```bash
# F1. Headless browser automation (Playwright). No display needed.
bhatti create --name scraper --image browser --cpus 2 --memory 2048
bhatti exec scraper -- npx playwright test
bhatti destroy scraper -y

# F2. A real desktop the user (or another agent) interacts with visually.
bhatti create --name desk --image computer --cpus 4 --memory 4096 --keep-hot
bhatti publish desk -p 6901 -a desk-vnc        # public, no auth
# OR for an authenticated session:
bhatti share desk                              # web-shell URL, single-use token
```

Why this shape:

- `browser` tier is ~600 MB: Chromium + Playwright + Node 22, no display server.
- `computer` tier is ~1.5 GB: full XFCE + KasmVNC + Chromium, runs on port 6901.
- `--keep-hot` matters when the network connection itself is the work
  (a VNC session, a long-running remote session). Without it the
  thermal manager will pause the VM during quiet periods, which still
  resumes transparently but breaks active TCP connections.
- `bhatti share` mints a token in the URL **fragment** (`#token=…`),
  which browsers don't send to servers — the token never appears in
  proxy access logs. Each call invalidates the previous token.


## When things break

| Symptom | Likely cause | Fix |
|---|---|---|
| `connection refused` from any command | Daemon down, or wrong `api_url` | Server: `systemctl status bhatti`. Client: `cat ~/.bhatti/config.yaml`. |
| `401 unauthorized` | Bad / missing token | Re-run `bhatti setup`, or rotate via `bhatti user rotate-key <name>` |
| `403 cpus/memory exceeded` | User's per-sandbox cap | Lower `--cpus` / `--memory`; admin: `bhatti user create --max-cpus N --max-memory N` |
| `429 max-sandboxes` | At quota | Destroy an old sandbox, or raise the cap |
| `409 name already exists` | Sandbox/volume name collision | Pick another name, or rely on idempotency: same `POST /sandboxes` returns the existing record with `X-Bhatti-Existing: true` |
| `502 bad gateway` from a published URL | Process inside isn't listening on the port (yet, or any more) | `bhatti ports <name>` to confirm; `bhatti ps <name>` to find a crashed process |
| `404 sandbox not found` | Wrong name, or already destroyed | `bhatti list` |
| `bhatti create` hangs >30 s | Engine stuck or first-time image conversion | Linux: `journalctl -u bhatti -f`; macOS: `tail -f ~/.bhatti/bhatti.log` — watch for `bhatti-vmm` / image errors |
| Exec returns 124 | Hit `--timeout` (default 300 s) | Re-run with a higher `--timeout`, or `--detach` for true long-runners |
| Shell drops mid-stream | Idle PTY auto-disconnect | `bhatti shell <name>` — scrollback replays |
| `501` from any backup endpoint | Server has no `backup:` block configured | Server-side fix; not a client bug |
| `secret list` empty after setting | Per-user scoping; you're authed as a different user | `bhatti version` confirms the active user |


## Mental model in 6 lines

1. A sandbox is a real microVM (krucible, a libkrun fork), not a container — real kernel, real network stack, hardware-isolated (KVM on Linux, HVF on macOS).
2. Sandboxes auto-pause when idle and wake transparently on the next request (~50 ms cold, ~400 µs warm). Most ops *just work* on a paused sandbox.
3. `bhatti` is the host binary (daemon + CLI in one). `lohar` is the guest agent inside every VM (PID 1, talks to the host over vsock).
4. The config drive is baked at create time. `--env`, `--secret`, and `--file` apply only to **new** sandboxes; you can't add them to a running one.
5. Sessions survive detach. `bhatti shell <name>` re-attaches and replays scrollback. `bhatti exec --detach` writes output to a file in the VM you can `file read` later.
6. Destructive ops (`destroy`, `volume delete`, `image delete`, `snapshot delete`, `volume backup-delete`, `user delete`) require `-y` in non-interactive shells. `secret delete` is the exception — no prompt, no flag; double-check the name.


## Where to look next

- <https://bhatti.sh/llms.txt> — full doc index, manifest of everything below
- <https://bhatti.sh/_llms-txt/cli-reference.txt> — every CLI command, dense
- <https://bhatti.sh/_llms-txt/api-reference.txt> — every HTTP endpoint with curl examples
- <https://bhatti.sh/_llms-txt/getting-started.txt> — concepts + quickstart + self-hosting + updating
- <https://bhatti.sh/docs/quickstart/> — human-facing walkthrough; send the user there, not yourself
