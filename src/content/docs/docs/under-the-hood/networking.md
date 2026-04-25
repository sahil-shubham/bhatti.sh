---
title: "Networking: Bridges, TAP, and kernel ip="
description: "Per-user bridges, L2 isolation, TAP lifecycle, and how the guest network is up before PID 1 runs."
---

Every sandbox gets its own TAP device, IP address, and internet access. Users are isolated at L2 — VMs belonging to different users are on different bridges and cannot see each other's traffic.

## Per-user bridges

Each user gets their own Linux bridge and /24 subnet, allocated by `subnetFromIndex()` based on the user's index in the database:

```
User 1 (alice)                          User 2 (bob)
Internet ◄──NAT── brbhatti1            Internet ◄──NAT── brbhatti2
                  192.168.128.1/24                       192.168.129.1/24
                       │                                      │
                  ┌────┴────┐                            ┌────┴────┐
                  tap0001  tap0002                       tap0003  tap0004
                  │        │                             │        │
                  VM-a1    VM-a2                         VM-b1    VM-b2
                  .128.2   .128.3                        .129.2   .129.3
```

Alice's VMs can talk to each other (same bridge). They cannot reach Bob's VMs — different bridges, different subnets, iptables rules block cross-bridge forwarding.

Each bridge gets:
- One masquerade rule (NAT for internet access)
- FORWARD rules allowing traffic within the bridge
- A default DROP on cross-bridge traffic

Bridges are created on first sandbox for a user, destroyed when the user's last sandbox is destroyed.

## Why per-user bridges

The original design used a single shared bridge (`brbhatti0`). All VMs could see each other at L2. This was fine for single-user setups but broke the multi-tenant isolation model — VM A (alice) could ARP-scan and reach VM B (bob) on the same subnet.

Per-user bridges solve this at the network layer. Even if a VM is compromised, it can only see its owner's other VMs. The isolation is enforced by the kernel's bridge forwarding, not by application-level rules.

## TAP lifecycle

TAP devices are created during `Create()` and destroyed during `Destroy()`.

They are **not** destroyed during `Stop()` (snapshot to disk). The snapshot contains virtio-net state that references the TAP device. Destroying and recreating it would break networking after restore — the guest kernel would have a stale device reference.

Orphaned TAPs from crashes (server killed mid-operation) are cleaned up on engine startup by scanning for TAP devices matching the naming pattern that don't correspond to any known sandbox.

## Guest configuration: kernel ip=

The guest IP is configured via the kernel `ip=` command-line parameter at boot:

```
ip=192.168.128.2::192.168.128.1:255.255.255.0::eth0:off
```

This is processed during early kernel boot, before any userspace runs. By the time lohar starts as PID 1, the network interface is up, the route is set, and the gateway is reachable.

This solves a chicken-and-egg problem: the host needs to reach the agent to configure it, but the agent can't start without a network. Kernel `ip=` means no DHCP, no agent-side configuration, no race conditions.

DNS resolvers are injected separately via the config drive (a 1MB ext4 image mounted at boot).

## Reaching services inside sandboxes

Two proxy paths:

**Authenticated proxy** — for API users who have a token:
```
GET /sandboxes/:id/proxy/:port/*path
```

**Public proxy** — for [published preview URLs](/docs/sandboxes/preview-urls/) that work without authentication.

Both support HTTP and WebSocket. The proxy connects to the VM's IP over the bridge — no port forwarding rules needed, just direct TCP to the guest.
