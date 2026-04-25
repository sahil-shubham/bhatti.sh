---
title: Custom Domain
description: Set up a domain so bhatti publish creates real URLs like alias.yourdomain.com.
---

By default, `bhatti publish` generates URLs using the server's IP or hostname. With a custom domain, published sandboxes get proper URLs like `my-app.yourdomain.com` with TLS.

## What you need

- A domain (e.g. `yourdomain.com`)
- DNS access to create A and wildcard records
- Either a wildcard TLS certificate or an email for Let's Encrypt

## DNS records

Point your API hostname and a wildcard for published sandboxes to your server:

```
A    api.yourdomain.com     → <your-server-ip>
A    *.yourdomain.com       → <your-server-ip>
```

The wildcard record is what makes `my-app.yourdomain.com` work — every published alias becomes a subdomain.

## Server configuration

Add the `domain` block to `/etc/bhatti/config.yaml`:

### Option A: Wildcard certificate (recommended)

If you have a wildcard cert (from your DNS provider, Cloudflare Origin CA, or `certbot --manual` with DNS challenge):

```yaml
domain:
  api_host: api.yourdomain.com
  proxy_zone: yourdomain.com
  tls_cert: /etc/bhatti/wildcard.pem
  tls_key: /etc/bhatti/wildcard-key.pem
```

### Option B: Let's Encrypt (automatic per-alias certs)

If you don't have a wildcard cert, bhatti can issue individual certificates via Let's Encrypt:

```yaml
domain:
  api_host: api.yourdomain.com
  proxy_zone: yourdomain.com
  acme_email: you@example.com
```

:::caution
Let's Encrypt has a rate limit of 50 new certificates per week per registered domain. If you create and publish many sandboxes rapidly (e.g. per-PR previews in CI), you'll hit this limit. Use a wildcard cert for production preview environments.
:::

## What changes in domain mode

Without `domain` config, bhatti listens on `:8080` for everything.

With `domain` config, bhatti starts three listeners:

| Port | Purpose |
|------|---------|
| `:443` | API (`api.yourdomain.com`) + proxy (`*.yourdomain.com`) with TLS |
| `:80` | ACME challenges + HTTPS redirect |
| `127.0.0.1:8080` | Internal API (localhost only — health checks, admin) |

Routing is by `Host` header: requests to `api.yourdomain.com` go through normal API auth. Requests to `anything-else.yourdomain.com` go to the public proxy (no auth — this is the published URL).

## Restart

```bash
sudo systemctl restart bhatti
```

Check the logs for:

```
bhatti listening (domain mode)
  api: https://api.yourdomain.com
  proxy: https://*.yourdomain.com
```

## Verify

```bash
bhatti create --name test
bhatti publish test -p 8080 -a hello
# → https://hello.yourdomain.com
```

## Updating CLI config

Remote CLI users should update their endpoint:

```bash
bhatti setup
# API endpoint: https://api.yourdomain.com
# API key: ****
```

## Getting a wildcard certificate

### Cloudflare (if your DNS is on Cloudflare)

Origin CA certificates are free and last 15 years. Create one in the Cloudflare dashboard → SSL/TLS → Origin Server → Create Certificate. Select `*.yourdomain.com` and `yourdomain.com`. Download the PEM files.

### certbot with DNS challenge

```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d "*.yourdomain.com" -d "yourdomain.com"
```

This asks you to create a DNS TXT record to prove domain ownership. After validation, certs are saved to `/etc/letsencrypt/live/yourdomain.com/`. Renew every 90 days.

### acme.sh (lightweight alternative)

```bash
acme.sh --issue -d "*.yourdomain.com" -d "yourdomain.com" --dns dns_cf
```

Supports automatic DNS API integration with most providers. See [acme.sh DNS API](https://github.com/acmesh-official/acme.sh/wiki/dnsapi).
