---
title: Users & Auth
description: Multi-tenant model — per-user API keys, resource caps, network isolation, sandbox scoping.
---

bhatti is multi-tenant by default. Every user gets:

- An API key (`bht_<64-hex>`).
- A `/24` bridge network of their own; sandboxes from different users cannot reach each other on layer 2.
- Per-user caps on sandbox count, per-sandbox CPU, and per-sandbox memory.
- Their own secrets, volumes, snapshots, and images.

Users are created server-side, with `sudo bhatti user create`. The CLI commands all live in [Server & admin](/docs/reference/cli/admin/) — this page covers the model, not the surface.

## How keys work

The server stores only the SHA-256 hash of each API key. The plaintext is shown once at creation and once on rotation; if the user loses it, [`rotate-key`](/docs/reference/cli/admin/user-rotate-key/) is the only path back. There's no recovery.

Auth is `Authorization: Bearer <token>` on every API request except `/health` and `/_shell/<id>`. WebSocket connections use the same header. There's no `?token=…` query-param auth — keys never end up in URLs (and therefore not in proxy logs).

The web shell is the one place a token appears in a URL — embedded in the **fragment** (`#token=…`), which never leaves the browser. The page extracts it client-side and uses it as a Bearer header on the WebSocket.

## Resource caps

Every user has three per-user limits:

| Limit | Meaning |
| ----- | ------- |
| `max_sandboxes` | Concurrent (non-destroyed) sandboxes the user can own. |
| `max_cpus_per_sandbox` | Cap on `--cpus` at create time. |
| `max_memory_mb_per_sandbox` | Cap on `--memory` at create time. |

Lowering a cap doesn't affect existing sandboxes. New ones are rejected with `403` if they exceed the cap, or `429` if the user is at their `max_sandboxes`.

Storage is not currently capped per-user — disk usage grows freely until the host fills up. Track per-user volume size with `bhatti volume list` and the relevant `--data-dir`.

## Sandbox scoping

The API enforces strict per-user isolation:

- `GET /sandboxes` returns only sandboxes the authenticated user created.
- Looking up someone else's sandbox by ID returns `404` (intentional — the existence isn't leaked).
- The user can't exec, file-read, or destroy a sandbox they don't own.

This is consistent across every endpoint that takes a sandbox ID.

## Network isolation

Each user's sandboxes share a private bridge (`bhatti-<subnet-index>`) on a `/24` subnet. Cross-user traffic is blocked at the iptables layer. A user's own sandboxes can talk to each other (e.g. an agent sandbox can curl a worker sandbox at its private IP).

The subnet index is assigned on `user create` and shown in `bhatti user list`. You don't need to think about it; it just shows up in `bhatti inspect` output.

## See also

- [`bhatti user create`](/docs/reference/cli/admin/user-create/), [`list`](/docs/reference/cli/admin/user-list/), [`rotate-key`](/docs/reference/cli/admin/user-rotate-key/), [`delete`](/docs/reference/cli/admin/user-delete/)
- [Networking](/docs/under-the-hood/networking/) — bridge layout, iptables rules, IP allocation
