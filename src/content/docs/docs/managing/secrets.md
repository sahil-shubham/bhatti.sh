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
3. The plaintext is written into the sandbox's config drive (`config.ext4`) as part of the env-var bundle.
4. lohar reads the config drive at boot and exports `API_KEY=<plaintext>` to every command run inside the sandbox.

The config drive is unmounted after boot so the value isn't readable from the running rootfs without lohar's help.

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
