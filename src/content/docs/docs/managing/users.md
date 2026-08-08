---
title: Users & Auth
description: Multi-tenant model — per-user API keys, resource caps, network isolation, sandbox scoping.
---

bhatti is multi-tenant by default. Every user gets:

- An API key (`bht_<64-hex>`).
- Their own network: each user's sandboxes get a dedicated `bhatti-netd` gateway, so sandboxes from different users never share a network.
- Per-user caps on sandbox count, per-sandbox CPU, and per-sandbox memory.
- Their own secrets, volumes, snapshots, and images.

Users are created server-side, with `sudo bhatti user create`. The CLI commands all live in [Server & admin](/docs/reference/cli/admin/) — this page covers the model, not the surface.

You won't usually run `user create` for yourself. The install script (`curl -fsSL bhatti.sh/install | sudo bash`) creates an `admin` user during setup and writes its API key to your `~/.bhatti/config.yaml`. The first manual `user create` you run is for adding a teammate — see [Self-hosting → adding teammates](/docs/self-hosting/#adding-teammates).

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

User isolation isn't a host firewall — it's enforced at two layers. The API layer scopes every query to the authenticated user (see [Sandbox scoping](#sandbox-scoping) above). And at the data plane, each user's sandboxes get their own [`bhatti-netd`](/docs/under-the-hood/networking/) gateway — a per-owner userspace gVisor netstack — so cross-user traffic never shares a network in the first place. There are no host bridges or iptables rules to reason about.

A user's own sandboxes *can* reach each other (e.g. an agent sandbox can curl a worker sandbox), because they share one gateway; that traffic is still mediated and policed by netd rather than flowing peer-to-peer.

The `subnet` index you may see in some CLI output is vestigial — it survives from the v1 per-user-bridge design and now just picks a private address octet for the gateway. It isn't a Linux bridge and you don't need to think about it.

## See also

- [`bhatti user create`](/docs/reference/cli/admin/user-create/), [`list`](/docs/reference/cli/admin/user-list/), [`rotate-key`](/docs/reference/cli/admin/user-rotate-key/), [`delete`](/docs/reference/cli/admin/user-delete/)
- [Networking](/docs/under-the-hood/networking/) — the per-owner `bhatti-netd` gateway, policed egress, and host isolation
