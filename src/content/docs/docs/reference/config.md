---
title: Configuration
description: Server config.yaml reference and environment variables.
---

The bhatti server reads configuration from `/var/lib/bhatti/config.yaml` (or the path specified by `--data-dir`).

## Example

```yaml
listen: ":8080"
data_dir: /var/lib/bhatti
```

## Fields

| Field | Default | Description |
|-------|---------|-------------|
| `listen` | `:8080` | Address and port for the HTTP API |
| `data_dir` | `/var/lib/bhatti` | Root directory for all state (DB, images, sandboxes) |

## CLI configuration

CLI users configure their client with `bhatti setup` or manually:

### Config file

`~/.bhatti/config.yaml`:

```yaml
api_url: https://api.bhatti.sh
auth_token: bht_your_key_here
```

### Environment variables

```bash
export BHATTI_URL=https://api.bhatti.sh
export BHATTI_TOKEN=bht_your_key_here
```

### Priority

`--flag` > environment variable > config file > default.

The config file is the primary source. Environment variables are a fallback for CI and scripts.

## Data directory layout

```
/var/lib/bhatti/
├── config.yaml           daemon config
├── state.db              SQLite database (WAL mode)
├── age.key               secret encryption key (generated on first start)
├── id_ed25519 / .pub     SSH keypair
├── images/               kernel and rootfs images
└── sandboxes/            per-sandbox directories
```

See [Architecture Overview](/docs/architecture/overview/) for the full disk layout.
