---
title: Create & Destroy
description: Create, inspect, stop, start, and destroy sandboxes.
---

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

Everything inside the VM — processes, memory, network connections — resumes exactly where it left off.

In normal operation, you don't need these. Idle sandboxes [pause and resume automatically](/docs/under-the-hood/thermal/).

## Destroy

```bash
bhatti destroy dev
```

```bash
curl -X DELETE http://localhost:8080/sandboxes/dev \
  -H "Authorization: Bearer $TOKEN"
```

Removes the VM and all its files. Attached volumes are detached but not deleted.

## List

```bash
bhatti list
```

```bash
curl http://localhost:8080/sandboxes \
  -H "Authorization: Bearer $TOKEN"
```

Lists your sandboxes with their state, resources, and published URLs.
