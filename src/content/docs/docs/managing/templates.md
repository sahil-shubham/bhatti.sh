---
title: Templates
description: Reusable sandbox configurations.
---

Save a sandbox configuration — CPU, memory, env vars, init script, volumes, image — and stamp out sandboxes from it.

:::note
There's no CLI for templates yet. Use the API directly.
:::

## API

### Create a template

```bash
curl -X POST http://localhost:8080/templates \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "node-dev",
    "cpus": 2,
    "memory_mb": 1024,
    "env": {"NODE_ENV": "development"},
    "init": "cd /workspace && npm install"
  }'
```

### Create a sandbox from a template

```bash
curl -X POST http://localhost:8080/sandboxes \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"template_id": "tmpl-abc123", "name": "dev"}'
```

Template fields are used as defaults. Fields specified in the create request override the template.

### List templates

```bash
curl http://localhost:8080/templates \
  -H "Authorization: Bearer $TOKEN"
```

### Delete a template

```bash
curl -X DELETE http://localhost:8080/templates/tmpl-abc123 \
  -H "Authorization: Bearer $TOKEN"
```

For all parameters, see the [API Reference](/docs/reference/api/).
