---
title: Adding a Tier
description: How to create a new rootfs tier for bhatti.
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

### 2. Add size default in `scripts/build-tier.sh`

```bash
case "$TIER" in
    minimal)  SIZE_MB="${SIZE_MB:-512}" ;;
    browser)  SIZE_MB="${SIZE_MB:-2048}" ;;
    new-tier) SIZE_MB="${SIZE_MB:-1024}" ;;  # ← add this
    *) echo "unknown tier: $TIER" >&2; exit 1 ;;
esac
```

### 3. Add to CI release matrix

In `.github/workflows/release.yml`:

```yaml
tier: [minimal, browser, docker, computer, new-tier]
```

### 4. Add to the install script

In `scripts/install.sh`, update the interactive tier prompt and the `ALL_KNOWN_TIERS` variable in `do_server_update()`.

### 5. Verify

The bats test suite (`scripts/install_test.bats`) validates that every tier in `scripts/tiers/` appears in all four places:

```bash
bats scripts/install_test.bats
```

If you miss a registration point, the tier consistency tests catch it.

## Checklist

```
[ ] scripts/tiers/<name>.sh
[ ] scripts/build-tier.sh — SIZE_MB case
[ ] .github/workflows/release.yml — matrix.tier
[ ] scripts/install.sh — interactive menu
[ ] scripts/install.sh — ALL_KNOWN_TIERS
[ ] bats tests pass
```
