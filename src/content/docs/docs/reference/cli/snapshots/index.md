---
title: Snapshots
description: Named VM snapshots that capture memory, CPU, and disk. Resume into a new sandbox at any time.
sidebar:
  label: Overview
  order: 0
---

A snapshot captures the entire VM state at a point in time — memory, CPU registers, disk, running processes, open file descriptors, network connections. Resume restores all of it, exactly. The new sandbox picks up where the original left off.

| Command | Description |
| ------- | ----------- |
| [`bhatti snapshot create`](/docs/reference/cli/snapshots/create/) | Checkpoint a running sandbox. |
| [`bhatti snapshot list`](/docs/reference/cli/snapshots/list/) | List your snapshots. |
| [`bhatti snapshot resume`](/docs/reference/cli/snapshots/resume/) | Resume from a snapshot into a new sandbox. |
| [`bhatti snapshot delete`](/docs/reference/cli/snapshots/delete/) | Delete a snapshot. |

## How is this different from `bhatti stop`?

`bhatti stop` snapshots the *current* sandbox to disk and freezes it; `bhatti start` resumes that same sandbox. The sandbox doesn't go away — it's just paused.

`bhatti snapshot create` saves a **named** copy of the VM state. The original sandbox keeps running. `bhatti snapshot resume` later creates a **new** sandbox from that state, with a new name and new IP. You can resume from the same snapshot multiple times to stamp out copies.

| | `stop`/`start` | snapshot |
| --- | --- | --- |
| Original sandbox affected? | Yes — paused | No — keeps running |
| Result of resume | Same sandbox awake | A *new* sandbox |
| Multiple uses? | Once (it pairs with the stop) | Many — fork as often as you want |
| Captures volumes? | No (volumes are detached) | No (rootfs + memory only) |

## Quick patterns

```bash
# Checkpoint before a risky experiment
bhatti snapshot create dev --name dev-pre-experiment

# Fork: same VM state, multiple copies
bhatti snapshot resume dev-pre-experiment --name copy-1
bhatti snapshot resume dev-pre-experiment --name copy-2

# Clean up
bhatti snapshot delete dev-pre-experiment -y
```

## What's *not* in a snapshot

- **Persistent volumes.** Snapshots only capture the rootfs and memory; volumes are detached when you resume into a new sandbox. Re-attach them on the resumed sandbox if you need them.
- **External state.** TCP connections to *other* hosts may be in an awkward state on resume — kernel state is preserved, but the remote peer doesn't know the sandbox stopped and resumed.
