---
title: Updating & Uninstalling
description: Keep bhatti up to date or remove it cleanly.
---

## Updating

```bash
# CLI (any machine)
bhatti update

# Server (updates all components)
sudo bhatti update

# Server + install additional rootfs tiers
sudo bhatti update --tiers all
```

Only changed components are downloaded — if the kernel and rootfs haven't changed since your last update, they're skipped automatically.

Or re-run the install command:

```bash
curl -fsSL bhatti.sh/install | bash          # CLI
curl -fsSL bhatti.sh/install | sudo bash     # server
```

:::note
`bhatti update` updating all server components (not just the CLI binary) requires v1.7.3 or later. On older versions, use the curl command above.
:::

### Check for updates

```bash
bhatti version
```

Shows the installed version and checks GitHub for the latest release. Update notices also appear in `bhatti admin status`.

## Uninstalling

### Keep data (reinstallable)

```bash
curl -fsSL bhatti.sh/uninstall | sudo bash
```

Removes binaries and the systemd service. Keeps `/var/lib/bhatti` (images, volumes, snapshots, secrets, database) so you can reinstall later without losing state.

### Remove everything

```bash
curl -fsSL bhatti.sh/uninstall | sudo bash -s -- --purge
```

Removes all data including volumes, snapshots, and the encryption key.

### CLI only

```bash
sudo rm /usr/local/bin/bhatti
rm -rf ~/.bhatti
```
