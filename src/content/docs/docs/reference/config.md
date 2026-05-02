---
title: Configuration
description: Server and CLI config files, layered loading, environment variables, and the data directory layout.
---

bhatti has a single YAML config file. The same file format is used by the daemon and the CLI client; the daemon ignores the client-only fields, the client ignores the daemon-only ones.

## Layered loading

The config is loaded from multiple paths and merged. Higher rows override lower rows:

| Source | Loaded? | Used for |
| --- | --- | --- |
| `$BHATTI_CONFIG` (path) | If set, **only** this is loaded — no merging. | Override everything; useful for tests. |
| `/etc/bhatti/config.yaml` | First match wins. | Server settings — engine paths, listen address, data dir. |
| `~/.bhatti/config.yaml` | Always — fills in only `api_url` and `auth_token` if still empty. | CLI client credentials. |

This means a developer machine that's also running a server can have the server config in `/etc/bhatti/config.yaml` (with no client credentials) and the CLI's API key in `~/.bhatti/config.yaml` (without disturbing the server config). Both files are read, neither overwrites the other.

The deprecated location `/var/lib/bhatti/config.yaml` is still honoured as a fallback; the daemon prints a stderr warning when it loads from there. Migrate to `/etc/bhatti/config.yaml`.

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `BHATTI_CONFIG` | both | Override the config file path. When set, layered loading is bypassed. |
| `BHATTI_LOG_LEVEL` | server | `debug`, `info` (default), `warn`, `error`. |
| `BHATTI_URL` | CLI | API endpoint. Falls back when `--url` and `api_url:` aren't set. |
| `BHATTI_TOKEN` | CLI | API key. Same fallback semantics. |
| `BHATTI_FORCE_STREAM` | CLI | Force NDJSON streaming output even when stdout isn't a TTY. |

The CLI's value precedence is: `--flag` > config file > env var > built-in default.

## Server config

A typical server config (the one written by `curl -fsSL bhatti.sh/install | sudo bash`) looks like:

```yaml
engine: firecracker
listen: :8080
data_dir: /var/lib/bhatti

firecracker_bin: /usr/local/bin/firecracker
firecracker_jailer: /usr/local/bin/jailer
jail_uid: 10000
jail_gid: 10000
firecracker_kernel: /var/lib/bhatti/images/vmlinux-arm64
firecracker_rootfs: /var/lib/bhatti/images/rootfs-minimal-arm64.ext4
```

### Top-level fields

| Field | Default | Description |
| --- | --- | --- |
| `engine` | `firecracker` | Engine backend. Only `firecracker` is implemented. |
| `listen` | `:8080` | Address for the HTTP API. |
| `data_dir` | `~/.bhatti` (CLI) or whatever the install script writes (typically `/var/lib/bhatti` on a server) | Root directory for state — DB, images, sandboxes, snapshots, jails. |
| `firecracker_bin` | — | Absolute path to the `firecracker` binary. |
| `firecracker_kernel` | — | Path to the `vmlinux` kernel image. |
| `firecracker_rootfs` | — | Path to the default rootfs image (used when `bhatti create` is called without `--image`). |
| `firecracker_jailer` | — | Path to the `jailer` binary. **Empty** = bare mode (no jailer; less isolation). When set, `jail_uid` / `jail_gid` apply. |
| `jail_uid` | `0` | UID Firecracker runs as inside the jail. Production: a non-root UID like `10000`. |
| `jail_gid` | `0` | GID. Same shape. |
| `public_proxy_listen` | — | When set (e.g. `:8443`), the daemon also exposes a path-based public proxy at this address. URLs are `http://<host>:8443/<alias>/`. Skip this and use [domain mode](#domain-mode) for production. |
| `api_url` | — | CLI-only field. Put it in `~/.bhatti/config.yaml`, not `/etc/bhatti/config.yaml`. |
| `auth_token` | — | CLI-only. Same. |
| `domain` | — | Optional. Enables [domain mode](#domain-mode) — host-based routing + TLS. |
| `backup` | — | Optional. Enables [volume backups](#backup) to S3-compatible storage. |

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

When domain mode is on, the daemon listens on `:443` (TLS, both API and proxy by Host header), `:80` (ACME challenges + HTTPS redirect), and `127.0.0.1:8080` (internal API for health checks).

You must set either `tls_cert`+`tls_key` or `acme_email`. A wildcard cert is the right answer for any setup that creates more than a handful of aliases per week. See [Custom domain](/docs/managing/custom-domain/) for the full setup walk-through.

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
| `api_url` | Bhatti API endpoint. |
| `auth_token` | The user's API key from `bhatti user create`. |

## Data directory layout

```
data_dir/
├── state.db                   SQLite database (WAL mode)
├── age.key                    Secret-encryption key (auto-generated on first secret set)
├── id_ed25519, id_ed25519.pub SSH keypair (auto-generated on first start; for guest agent identity)
├── .latest-version            Cache for `bhatti version`'s GitHub-release check (~/.bhatti only)
├── images/
│   ├── vmlinux-<arch>         Kernel
│   ├── rootfs-minimal-<arch>.ext4
│   ├── rootfs-browser-<arch>.ext4
│   └── ... (other tier images)
├── sandboxes/<id>/
│   ├── rootfs.ext4            CoW copy of the base image
│   ├── config.ext4            Config drive (env, secrets, files; ~1 MB)
│   ├── vol-<name>.ext4        Hard-linked attached volumes (jailer mode only)
│   ├── firecracker.sock       FC API socket
│   ├── mem.snap               Memory snapshot (when stopped)
│   └── vm.snap                VM state snapshot (when stopped)
├── volumes/<user_id>/
│   └── <name>.ext4            Standalone volume images
├── snapshots/<user_id>/
│   └── <name>/                Named-snapshot bundle (rootfs copy + mem.snap + vm.snap)
├── jails/firecracker/<id>/    Jailer chroots, when `firecracker_jailer` is set
└── certs/                     ACME certificate cache (when `domain.acme_email` is set, no wildcard cert)
```

`<arch>` is `arm64` on aarch64 hosts, `amd64` on x86_64.

## Validating a config

The daemon prints which file it loaded on startup:

```
config loaded path=/etc/bhatti/config.yaml
```

If the path is empty, no config file was found and built-in defaults are used. The CLI client doesn't print this; check with `bhatti version` (which uses the loaded `api_url`).
