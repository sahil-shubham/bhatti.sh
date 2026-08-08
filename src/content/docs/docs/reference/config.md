---
title: Configuration
description: Server and CLI config files, layered loading, environment variables, and the data directory layout.
---

bhatti has a single YAML config file. The same format is used by the daemon and the CLI client; the daemon ignores the client-only fields, the client ignores the daemon-only ones.

## Layered loading

The config is loaded from multiple paths and merged. Higher rows override lower rows:

| Source | Loaded? | Used for |
| --- | --- | --- |
| `$BHATTI_CONFIG` (path) | If set, **only** this is loaded — no merging. | Override everything; useful for tests and running a second daemon. |
| `/etc/bhatti/config.yaml` | First match wins. | Server settings — engine, runtime paths, listen address, data dir. |
| `~/.bhatti/config.yaml` | Always — fills in only `api_url` and `auth_token` if still empty. | CLI client credentials. |

This means a developer machine that's also running a server can keep the server config in `/etc/bhatti/config.yaml` (no client credentials) and the CLI's API key in `~/.bhatti/config.yaml` (without disturbing the server config). Both files are read, neither overwrites the other.

The deprecated location `/var/lib/bhatti/config.yaml` is still honoured as a fallback; the daemon prints a stderr warning when it loads from there. Migrate to `/etc/bhatti/config.yaml`.

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `BHATTI_CONFIG` | both | Override the config file path. When set, layered loading is bypassed. |
| `BHATTI_LOG_LEVEL` | server | `debug`, `info` (default), `warn`, `error`. |
| `BHATTI_URL` | CLI | API endpoint. |
| `BHATTI_TOKEN` | CLI | API key. |
| `BHATTI_FORCE_STREAM` | CLI | Force NDJSON streaming output even when stdout isn't a TTY. |

The CLI's endpoint precedence is: `--flag` → env var (`BHATTI_URL`/`BHATTI_TOKEN`) → config file → the daemon's local unix socket → built-in default. Env overrides the config file (12-factor: point an already-configured CLI at another daemon without editing `~/.bhatti/config.yaml`). When neither an endpoint flag nor `api_url`/`BHATTI_URL` is set, the CLI talks to the daemon's local control socket (`<data_dir>/api.sock`), which is not reachable from inside a sandbox.

## Server config

bhatti v2 runs the **krucible** engine (libkrun). The daemon itself is pure Go; it spawns a per-sandbox `bhatti-vmm` helper (the VMM) and a per-owner `bhatti-netd` gateway, both shipped in the release bundle under `<data_dir>/runtime/`. A typical server config (the one written by `curl -fsSL bhatti.sh/install | sudo bash`) looks like:

```yaml
engine: krucible
listen: :8080
data_dir: /var/lib/bhatti

# Secure per-owner network gateway (bhatti-netd) is ON by default: the guest is
# isolated from the host, egress is policed, same-owner siblings are reachable.
# Set 'krucible_net_backend: false' for the legacy shared-netstack (TSI) path.
krucible_vmm: /var/lib/bhatti/runtime/bin/bhatti-vmm
krucible_netd: /var/lib/bhatti/runtime/bin/bhatti-netd
krucible_libdir: /var/lib/bhatti/runtime/lib
krucible_kernel_image: /var/lib/bhatti/runtime/kernel/Image-lean-6.12.94-aarch64
krucible_base_image: /var/lib/bhatti/images/rootfs-minimal-arm64.ext4
```

### Top-level fields

| Field | Default | Description |
| --- | --- | --- |
| `engine` | `krucible` | Engine backend. v2 is `krucible` (libkrun). (v1 Firecracker lives on the `firecracker` branch.) |
| `listen` | `:8080` | Address for the TCP control API. Empty = unix socket only. |
| `api_socket` | `<data_dir>/api.sock` | Local control-API unix socket. Never reachable from a sandbox. |
| `data_dir` | `~/.bhatti` (CLI) or whatever the install script writes (typically `/var/lib/bhatti` on a server) | Root directory for state — DB, runtime bundle, images, sandboxes, volumes, snapshots. |
| `krucible_vmm` | next to the binary / `PATH` | Path to the `bhatti-vmm` helper (the per-sandbox VMM). |
| `krucible_netd` | next to the binary / `PATH` | Path to the `bhatti-netd` network gateway helper. |
| `krucible_libdir` | autodetect | Directory holding `libkrun` (and, on the non-lean path, `libkrunfw`). The install lays this under `runtime/lib`. |
| `krucible_kernel_image` | autodetect | The lean external guest kernel (`Image-lean-*` on arm64, `vmlinux-lean-*` on x86_64). ~2× faster cold-start; boots the block-root path. Empty falls back to the bundled libkrunfw kernel. |
| `krucible_base_image` | — | Prebuilt ext4 base rootfs used when `bhatti create` is called without `--image`. Each sandbox gets a copy-on-write overlay over it. |
| `krucible_block_root` | implied when `krucible_base_image` is set | Boot from a CoW block image (required for the cold tier). |
| `krucible_net_backend` | `true` | Per-owner `bhatti-netd` gateway (policed egress, host isolation, sibling reachability). `false` = legacy TSI (guest can reach the host loopback — not recommended). |
| `krucible_socket_dir` | `/tmp/bhatti-kr` | Short directory for vsock/control unix sockets (paths must stay short — `sun_path` caps at 104/108 bytes). |
| `public_proxy_listen` | — | When set (e.g. `:8443`), the daemon exposes a path-based public proxy at this address. Skip this and use [domain mode](#domain-mode) for production. |
| `api_url` | — | CLI-only field. Put it in `~/.bhatti/config.yaml`, not `/etc/bhatti/config.yaml`. |
| `auth_token` | — | CLI-only. Same. |
| `domain` | — | Optional. Enables [domain mode](#domain-mode) — host-based routing + TLS. |
| `backup` | — | Optional. Enables [volume backups](#backup) to S3-compatible storage. |

There is no host TAP/bridge/iptables configuration and no jailer in v2 — krucible owns networking (via `bhatti-netd`/TSI) and boots the VMM as an ordinary host process. (The FC-era `firecracker_*` and `jail_*` fields belong to v1.)

### Domain mode

For host-based routing with TLS — `https://api.<your-domain>` for the API, `https://<alias>.<your-domain>` for published sandboxes.

```yaml
domain:
  api_host: api.bhatti.sh
  proxy_zone: bhatti.sh
  tls_cert: /etc/bhatti/wildcard.pem
  tls_key: /etc/bhatti/wildcard-key.pem
```

| Field | Description |
| --- | --- |
| `api_host` | Hostname for the API. Requests to this host go through normal Bearer auth. |
| `proxy_zone` | Zone for published sandboxes. `<alias>.<proxy_zone>` is the URL `bhatti publish` generates. |
| `tls_cert`, `tls_key` | Paths to a wildcard cert covering `*.<proxy_zone>` and `<api_host>`. **Recommended.** |
| `acme_email` | Fallback: per-alias Let's Encrypt certificates. **Rate-limited** to 50 new aliases per registered domain per week — fine for stable subdomains, fast to hit if you're stamping out preview environments. |

When domain mode is on, the daemon listens on `:443` (TLS, both API and proxy by Host header), `:80` (ACME challenges + HTTPS redirect), and the local control socket for internal health checks. HTTP/2 is disabled on the TLS listener so WebSocket upgrades work behind a proxy.

You must set either `tls_cert`+`tls_key` or `acme_email`. A wildcard cert is the right answer for any setup that creates more than a handful of aliases per week. See [Custom domain](/docs/managing/custom-domain/) for the full walk-through.

### Backup

For volume backups to S3-compatible storage. Enables [`bhatti volume backup`](/docs/reference/cli/volumes/backup/), `restore`, `backup-list`, and `backup-delete`. Without this block, those endpoints return `501`.

```yaml
backup:
  s3_endpoint: https://s3.eu-central-003.backblazeb2.com
  s3_region: eu-central-003
  s3_bucket: bhatti-backups
  s3_access_key: ...
  s3_secret_key: ...
  schedule:
    - volume: workspace
      cron: "0 3 * * *"
      retention: 7
```

| Field | Description |
| --- | --- |
| `s3_endpoint` | S3-compatible endpoint URL. Backblaze B2, AWS S3, MinIO, R2, etc. |
| `s3_region` | Region. Required by AWS-compatible APIs even when irrelevant. |
| `s3_bucket` | Bucket name. Must already exist. |
| `s3_access_key`, `s3_secret_key` | Credentials with read/write/delete on the bucket. |
| `schedule` | Optional. Array of automatic backup schedules. Each entry has `volume`, `cron` (5-field cron expression), and `retention` (keep last N backups for that volume). |

Schedules run inside the daemon — no external cron required. Retention is enforced after each scheduled backup.

## CLI client config

Lives at `~/.bhatti/config.yaml`. `bhatti setup` writes it for you.

```yaml
api_url: https://api.bhatti.sh
auth_token: bht_abc123def456...
```

| Field | Description |
| --- | --- |
| `api_url` | bhatti API endpoint. |
| `auth_token` | The user's API key from `bhatti user create`. |

## Data directory layout

```
data_dir/
├── state.db                   SQLite database (WAL mode)
├── age.key                    Secret-encryption key (auto-generated on first secret set)
├── id_ed25519, id_ed25519.pub SSH keypair (auto-generated on first start; guest agent identity)
├── api.sock                   Local control-API unix socket
├── .latest-version            Cache for `bhatti version`'s GitHub-release check (~/.bhatti only)
├── runtime/                   Relocatable v2 runtime bundle (re-laid on every install/update)
│   ├── bin/                   bhatti-vmm, bhatti-netd
│   ├── lib/                   libkrun (the krucible VMM shared lib) + symlinks
│   └── kernel/                Image-lean-<ver>-<arch> (arm64) / vmlinux-lean-<ver>-<arch> (x86_64)
├── images/
│   └── rootfs-<tier>-<arch>.ext4   Base rootfs images (CoW-overlaid per sandbox)
├── sandboxes/<id>/
│   ├── <CoW root overlay>     qcow2 overlay over the base image (the sandbox's disk deltas)
│   ├── config drive           env, secrets, files, per-sandbox token (~1 MB ext4, /dev/vdb)
│   ├── state.json             recovery metadata (helper PID, sockets, bundle ref)
│   └── (when cold)            memory image + VM state + attached volumes + manifest.json
├── volumes/<user_id>/         Standalone persistent volumes
└── snapshots/<user_id>/<name>/  Named-snapshot bundles (self-contained)
```

`<arch>` is `arm64` on aarch64 hosts, `amd64` on x86_64. There are no `jails/` or `firecracker.sock` entries in v2 — those are v1/Firecracker.

## Validating a config

The daemon prints which file it loaded on startup:

```
config loaded path=/etc/bhatti/config.yaml
```

If the path is empty, no config file was found and built-in defaults are used. The CLI client doesn't print this; check with `bhatti version` (which reports the loaded endpoint).
