---
title: "Networking: Bridges, TAP, and kernel ip="
description: "Per-user bridges, IP allocation, TAP lifecycle, and how the guest network is up before PID 1 runs."
---

Every sandbox gets its own network interface, IP address, and internet access through a shared bridge on the host.

## How it works

```
Internet ◄──NAT──── brbhatti0 (bridge, 192.168.137.1/24)
                         │
                    ┌────┴────┬────────┐
                    tap0001   tap0002  tap0003
                    │         │        │
                    VM1       VM2      VM3
                    .137.2    .137.3   .137.4
```

All VMs share one bridge (`brbhatti0`) and one iptables masquerade rule. VMs can reach the internet and each other. The bridge is created automatically on server startup.

### IP allocation

253 addresses available in `192.168.137.0/24` (`.2` through `.254`). Allocated sequentially, released on sandbox destroy. This limits a single host to 253 concurrent VMs — memory is the real bottleneck long before you hit this.

### Guest configuration

The guest IP is configured via the kernel `ip=` command-line parameter at boot. The network is up before lohar starts as PID 1 — no DHCP, no race conditions. DNS resolvers are injected via the config drive.

## Reverse proxy

Two proxy paths exist for reaching services running inside sandboxes:

### Authenticated proxy (API users)

```
GET /sandboxes/:id/proxy/:port/*path
```

HTTP requests and WebSocket connections are tunneled through the engine into the sandbox. No direct network access to the VM is required.

```bash
# Proxy to port 3000 inside sandbox "dev"
curl http://localhost:8080/sandboxes/dev/proxy/3000/ \
  -H "Authorization: Bearer $TOKEN"
```

### Public proxy (published ports)

Published ports get public URLs that work without authentication. See [Preview URLs](/docs/sandboxes/preview-urls/).

For architecture details, see [Firecracker Engine](/docs/under-the-hood/engine/) and [Design Decisions](/docs/under-the-hood/decisions/).
