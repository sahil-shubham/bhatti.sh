---
title: Secrets
description: Encrypted secret management with age encryption at rest.
---

Secrets are key-value pairs encrypted at rest with [age](https://age-encryption.org/). They're scoped to the authenticated user and automatically injected as environment variables into every command.

## CLI

```bash
bhatti secret set API_KEY sk-abc123def
bhatti secret list
bhatti secret delete API_KEY
```

## API

```bash
# Set
curl -X POST http://localhost:8080/secrets \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "API_KEY", "value": "sk-abc123def"}'

# List (names only, values are never returned)
curl http://localhost:8080/secrets \
  -H "Authorization: Bearer $TOKEN"

# Delete
curl -X DELETE http://localhost:8080/secrets/API_KEY \
  -H "Authorization: Bearer $TOKEN"
```

## How secrets work

1. **Encryption at rest.** Values are encrypted with an age key stored at `/var/lib/bhatti/age.key`. The key is generated on first server start.
2. **Injected as env vars.** When a sandbox executes a command, secrets are decrypted and passed as environment variables. They override defaults but can be overridden by per-request env vars.
3. **Scoped to user.** Each user has their own secrets. Users cannot see or modify another user's secrets.
4. **Names only in list.** `secret list` returns secret names but never values. This is a security measure — once set, a secret's value can only be replaced, not read back.

## Secret priority

Environment variables in a command are resolved in this order (last wins):

```
defaults (PATH, TERM, HOME, LANG)
    ↓ overridden by
secrets (from bhatti secret set)
    ↓ overridden by
sandbox env (from create --env)
    ↓ overridden by
per-request env (from exec --env or API body)
```
