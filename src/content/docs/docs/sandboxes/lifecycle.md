---
title: Create & Destroy
description: Create, inspect, stop, start, and destroy sandboxes.
---

A sandbox is a Firecracker microVM — a real Linux virtual machine with its own kernel, filesystem, and network. Sandboxes are created in seconds, accept commands and file operations, and are destroyed when no longer needed. Between creation and destruction, bhatti manages thermal state automatically.

## Create

### CLI

```bash
bhatti create --name dev --cpus 2 --memory 1024
bhatti create --name worker --env API_KEY=sk-abc,NODE_ENV=prod
bhatti create --name builder --init "npm install && npm run build"
```

### API

```bash
curl -X POST http://localhost:8080/sandboxes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "dev", "cpus": 2, "memory_mb": 1024}'
```

All fields are optional. Defaults: 1 vCPU, 512MB RAM, auto-generated name.

### What happens during create

1. An IP is allocated from the host's subnet pool
2. A TAP network device is created and attached to the bridge
3. The base rootfs is copied (CoW when available)
4. A config drive is built with hostname, env vars, secrets, volumes, and init script
5. Firecracker boots the VM with the configured kernel, rootfs, and drives
6. The host polls the guest agent until it responds (~3.5s)
7. If `init` is set, it runs as an attachable TTY session

### Options

| Field | Default | Description |
|-------|---------|-------------|
| `name` | auto-generated | Must match `[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}` |
| `cpus` | 1 | vCPUs (capped by user's per-sandbox limit) |
| `memory_mb` | 512 | Memory in MB |
| `env` | — | Environment variables for all commands |
| `init` | — | Script that runs at boot as an attachable session |
| `keep_hot` | false | Prevent automatic pausing/snapshotting |
| `new_volumes` | — | Volumes to create and attach |
| `volumes` | — | Existing volumes to attach |
| `template_id` | — | Create from a template |
| `image` | — | Rootfs image to use |

For all parameters, see the [API Reference](/docs/reference/api/).

## Inspect and Edit

```bash
bhatti inspect dev          # full sandbox details as JSON
bhatti edit dev --cpus 4    # update mutable properties
```

```bash
# Toggle thermal management
bhatti edit dev --keep-hot
bhatti edit dev --allow-cold
```

## Stop and Start

Manually control thermal state:

```bash
bhatti stop dev     # snapshot to disk, free memory
bhatti start dev    # restore from snapshot
```

Stop creates a memory snapshot (full or diff). Start restores from the snapshot — all processes, memory state, and network connections resume exactly where they left off.

In normal operation, you don't need these — the [thermal manager](/docs/under-the-hood/thermal/) handles transitions automatically.

## Destroy

```bash
bhatti destroy dev
```

```bash
curl -X DELETE http://localhost:8080/sandboxes/dev \
  -H "Authorization: Bearer $TOKEN"
```

Destroy stops the VM, deletes all associated files (rootfs copy, snapshots, config drive), releases the IP address, and removes the TAP device. Attached volumes are detached but not deleted.

## List

```bash
bhatti list
```

```bash
curl http://localhost:8080/sandboxes \
  -H "Authorization: Bearer $TOKEN"
```

Lists sandboxes owned by the authenticated user. Includes thermal state, published URLs, and resource usage. Listing does not wake cold sandboxes.
