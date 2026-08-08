---
title: Secrets
description: How encryption, scoping, and env-var injection work for sandbox secrets.
---

Secrets are values you'd rather not put on a command line. bhatti stores them encrypted, scoped per user, and injects them as environment variables when a sandbox boots.

The CLI surface lives in [Secrets reference](/docs/reference/cli/secrets/). This page covers the *model* — what's encrypted, what isn't, and the rules for which env var wins when multiple sources set the same name.

## Encryption at rest

On first start the daemon generates an [age](https://age-encryption.org/) keypair at `<data_dir>/age.key`. Every secret you set is encrypted under this key. Plaintext is never written to disk on the server — not in the database, not in temp files.

The age key file is the only thing that decrypts your secrets. Back it up alongside the database; lose either and the secrets become unrecoverable.

## Scoping

Secrets are per-user. Other users can't list, read, or reference them by name. There's no shared / global secret store.

`secret list` returns names + timestamps but never the encrypted blob — once a value is set, you can replace it with `secret set NAME new-value` but you can't read it back.

## How injection works

When a sandbox is created with `--secret API_KEY`:

1. The server fetches the encrypted blob from the secrets table for that user.
2. It decrypts under the age key.
3. The plaintext is written into the sandbox's config drive as part of the env-var bundle.
4. lohar reads the config drive at boot and exports `API_KEY=<plaintext>` to every command run inside the sandbox.

The config drive is unmounted after boot so the value isn't readable from the running rootfs without lohar's help.

## What happens on wake

Nothing secret-related. Decryption happens exactly once, at sandbox
*create*, when the daemon reads the ciphertext from SQLite, decrypts
it with the age key on disk, and writes the plaintext into the
config drive. From that moment on, the secret lives
as bytes in guest RAM and is captured into the memory image
(`memory.img`) on snapshot.

When a [cold sandbox wakes](/docs/under-the-hood/thermal-states/#cold--hot):

- The server does **not** re-read from SQLite.
- It does **not** load the age key.
- It does **not** rewrite the config drive.
- It restores the memory image into a fresh krucible VM and resumes.
  The env vars are already in the guest's process memory.

The age key (`<data_dir>/age.key`) is only loaded on an explicit
encrypt or decrypt call — `bhatti secret set` or
`bhatti create --secret`. It is **not** kept in long-lived daemon
memory.

This matters for latency: a cold wake doesn't pay any
secret-reconstruction cost. The 360 ms p50 number on the homepage
is dominated by the memory-image disk read, not by anything
secret-handling — see [Storage → Cold wake and the page
cache](/docs/under-the-hood/storage/#cold-wake-and-the-page-cache).

### Threat model

- **Stolen `state.db`**: safe (ciphertext only, no key).
- **Cross-tenant access**: safe (per-user scoping + auth).
- **Stolen `state.db` + `age.key` together**: not safe; both files
  live in `<data_dir>` and an attacker with filesystem access has
  everything.
- **Host root compromise**: not safe.
- **Memory-image exfiltration**: not safe; secrets are env vars in
  guest RAM and the memory image (`memory.img`) is unencrypted on disk.

The host root is the trust boundary, same as Vault-on-a-box. If you
need to weaken that — wrap `age.key` in KMS/HSM. We do not
currently support that; it's an open design question.

## Env var priority inside a sandbox

When a command runs, env vars resolve in this order — later wins:

```
1. defaults                (PATH, HOME, TERM, LANG)
       ↓
2. secrets                 (--secret NAME at create time)
       ↓
3. sandbox env             (--env K=V at create time)
```

There is **no** per-`bhatti exec` env override. The `POST /sandboxes/:id/exec` endpoint doesn't accept an `env` field — anything passed there is silently ignored. To inject env vars at exec time, use the WebSocket exec path (which does take an `env` map on the initial JSON command spec). For most use cases, set them at create time and accept that they apply to every command.

## Caveat: `--template` ignores `--secret`

Creating a sandbox from a template silently drops request-side `--secret` and `--file` flags. Only the secrets pre-configured on the template are honoured. If you need request-time secrets, create directly without `--template`.

## See also

- [Secrets reference](/docs/reference/cli/secrets/) — `set`, `list`, `delete`
- [`bhatti create --secret`](/docs/reference/cli/sandbox/create/) — inject at sandbox boot
