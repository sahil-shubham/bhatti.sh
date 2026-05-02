---
title: Secrets
description: Encrypted secrets injected into sandboxes as environment variables.
sidebar:
  label: Overview
  order: 0
---

Secrets are key-value pairs encrypted at rest with [age](https://age-encryption.org/) and scoped to your user. Reference them by name when creating a sandbox; they're decrypted server-side and injected as environment variables at boot.

| Command | Description |
| ------- | ----------- |
| [`bhatti secret set`](/docs/reference/cli/secrets/set/) | Create or update a secret. |
| [`bhatti secret list`](/docs/reference/cli/secrets/list/) | List secret names (values are never returned). |
| [`bhatti secret delete`](/docs/reference/cli/secrets/delete/) | Delete a secret. |

## Quick patterns

```bash
# Store
bhatti secret set OPENAI_KEY sk-...
bhatti secret set DATABASE_URL "postgres://user:pass@db.internal/app"

# Reference at create
bhatti create --name agent --secret OPENAI_KEY --secret DATABASE_URL

# List names (no values)
bhatti secret list

# Update (set with the same name overwrites)
bhatti secret set OPENAI_KEY sk-...new-value

# Delete (no confirmation prompt — be careful)
bhatti secret delete OPENAI_KEY
```

## How secrets work

1. **Encryption at rest.** Values are encrypted with an age key the server stores at `/var/lib/bhatti/age.key`. The key is generated on first server start. Plaintext is never written to disk.
2. **Scoped per user.** Each user has their own secrets. Other users can't see them, list them, or reference them by name.
3. **Names only in `list`.** `bhatti secret list` returns metadata (name, created/updated timestamps). The encrypted value is never serialized to JSON output.
4. **Inject by name.** `bhatti create --secret API_KEY` decrypts `API_KEY` and adds it to the sandbox's environment as `API_KEY=<plaintext>`.
5. **Update is idempotent.** Re-running `bhatti secret set NAME value` overwrites the previous value with no error.

## Env var priority inside a sandbox

When a command runs inside a sandbox, env vars are resolved in this order (later wins):

```
defaults (PATH, TERM, HOME, LANG)
    ↓ overridden by
secrets (--secret on create)
    ↓ overridden by
sandbox env (--env on create)
```

There is **no** per-`bhatti exec` env override. The exec endpoint doesn't accept an `env` field; the env passed in the request is silently ignored. To inject env vars, do it at create time.

## Caveat: `--template` ignores `--secret`

When creating from a template, the server uses only the template's pre-configured secret list. Request-side `--secret` flags are silently dropped. See [`bhatti create`](/docs/reference/cli/sandbox/create/) for the workaround.
