---
title: Sandbox Commands
description: "create, edit, list, inspect, destroy, stop, start"
---

## bhatti create

Create a new sandbox VM.

```bash
bhatti create --name dev
bhatti create --name ml --cpus 4 --memory 4096
bhatti create --name api --env API_KEY=sk-abc --init "npm install"
bhatti create --name py --image python-3.12
bhatti create --name work --volume workspace:/workspace
bhatti create --name agent --init "hermes gateway" --keep-hot
```

| Flag | Default | Description |
|------|---------|-------------|
| `--name` | auto-generated | Sandbox name |
| `--cpus` | 1 | Number of vCPUs |
| `--memory` | 0 (server default: 512) | Memory in MB |
| `--disk-size` | 0 (image size) | Rootfs disk size in MB |
| `--env` | — | Environment variables (`K=V,K=V`) |
| `--init` | — | Init script (runs as attachable TTY session) |
| `--keep-hot` | false | Prevent thermal transitions |
| `--template` | — | Template name or ID |
| `--image` | — | Rootfs image name |
| `--volume` | — | Persistent volume (`name:mount[:ro]`), repeatable |

Output: `ID  NAME  IP`

## bhatti edit

Update mutable settings on an existing sandbox.

```bash
bhatti edit my-agent --keep-hot
bhatti edit my-agent --allow-cold
```

| Flag | Description |
|------|-------------|
| `--keep-hot` | Prevent thermal transitions |
| `--allow-cold` | Re-enable thermal transitions |

## bhatti list

List sandboxes owned by the authenticated user. Alias: `bhatti ls`.

```bash
bhatti list
bhatti ls --json
```

Shows ID, name, status, thermal state, IP, and published URLs (if any).

## bhatti inspect

Show full sandbox details. Alias: `bhatti info`.

```bash
bhatti inspect dev
bhatti inspect dev --json
```

## bhatti stop

Snapshot and stop a sandbox. The VM's memory, processes, and state are saved to disk.

```bash
bhatti stop dev
```

Stopped sandboxes use zero CPU and memory. Resume with `bhatti start`.

## bhatti start

Resume a stopped sandbox from its snapshot. Continues exactly where it left off.

```bash
bhatti start dev
```

## bhatti destroy

Permanently destroy a sandbox and all its data. Alias: `bhatti rm`.

```bash
bhatti destroy dev
bhatti rm dev
```

Persistent volumes are detached but not deleted.
