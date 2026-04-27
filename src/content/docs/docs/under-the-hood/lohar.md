---
title: "Lohar: PID 1 Inside Every VM"
description: "The guest agent that replaces systemd — boot sequence, PTY sessions, scrollback, and process management."
---

The rootfs is Ubuntu 24.04 with systemd. The conventional approach is to let systemd start as PID 1 and run the agent as a service. Instead, lohar *is* PID 1 — `init=/usr/local/bin/lohar`.

Why? Determinism. Systemd's boot sequence starts dozens of services, generates machine IDs, manages cgroups, handles device hotplug — none of which matter inside a controlled microVM. Systemd adds 1-2 seconds to boot time and introduces failure modes we don't need. Lohar boots the VM in ~270ms total (kernel + init + agent ready).

Single static Go binary. No libc, no initramfs, no dynamic linking. Cross-compiled from macOS with `CGO_ENABLED=0`.

## Boot Sequence

The kernel boots with `init=/usr/local/bin/lohar`. Lohar is the first and only userspace process:

1. **Mount essential filesystems** — `/proc`, `/sys`, `/dev`, `/dev/pts`, `/tmp`, `/run`. The kernel provides a bare rootfs with none of these.
2. **Bring up loopback** — raw ioctl: `SIOCGIFFLAGS` → set `IFF_UP` → `SIOCSIFFLAGS`.
3. **Load config drive** (`/dev/vdb`) — 1MB ext4 image with hostname, token, env vars, files, volumes, DNS, init script.
4. **Apply configuration** — set hostname, write DNS resolvers, decode and write config files (chowned to uid 1000), mount volumes.
5. **Start listeners** — TCP on ports 1024 (control) and 1025 (forward).
6. **Run init script** — if configured, starts as an attachable TTY session with ID `"init"`.
7. **Block forever** — PID 1 must never exit.

Boot to agent-ready takes ~3.5 seconds on a Pi 5. The host polls with `exec true` until it gets a response.

## Config Drive

A 1MB ext4 image attached as `/dev/vdb`, mounted read-only at `/run/bhatti/config`. Contains a single `config.json`:

```json
{
  "sandbox_id": "a1b2c3d4e5f6",
  "hostname": "dev",
  "token": "deadbeef...",
  "env": {"API_KEY": "sk-...", "NODE_ENV": "development"},
  "files": {
    "/workspace/.env": {"content": "base64...", "mode": "0600"}
  },
  "volumes": [
    {"device": "/dev/vdc", "mount": "/workspace", "fs": "ext4"}
  ],
  "init": "cd /workspace && npm install",
  "dns": ["1.1.1.1", "8.8.8.8"]
}
```

Built on the host during `Create()` using `mkfs.ext4` + mount + write + umount. Attached to Firecracker as a read-only virtio-blk drive before boot.

The config drive avoids the exec-after-boot pattern for configuration injection. Everything — hostname, environment variables, secrets, volumes, DNS, init scripts — is available before the agent starts listening. No race conditions, no retries.

## Session Model

Every TTY exec creates a *session* — a persistent handle to a running process with scrollback.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Host Client  │────►│   Session    │────►│  PTY Master  │────► child process
│ (attached)   │◄────│ s1           │◄────│              │◄────  /bin/zsh
└──────────────┘     │ scrollback:  │     └──────────────┘
                     │  64KB ring   │
                     │ idle timer   │
                     └──────────────┘
```

**Disconnect doesn't kill.** When the host client disconnects (network drop, `Ctrl+\`), the session detaches. The child process keeps running. Output continues flowing into the 64KB scrollback ring buffer.

**Reattach replays scrollback.** When a client reconnects, it receives the scrollback buffer contents (up to 64KB of recent output) followed by live I/O. The previous client (if still connected) is disconnected.

**Init scripts are sessions.** The `init` field from the config drive runs as a TTY session with ID `"init"`. The host can attach to monitor progress.

### Scrollback Ring Buffer

A fixed-size ring buffer (64KB) per session. Writes wrap around, overwriting the oldest data. `Bytes()` returns contents in order — oldest first.

## PTY Allocation

Lohar allocates PTYs using raw syscalls (no `creack/pty`, no cgo):

1. Open `/dev/ptmx` (the PTY multiplexor)
2. `TIOCGPTN` ioctl to get the slave PTY number
3. `TIOCSPTLCK` ioctl to unlock the slave
4. Open `/dev/pts/<N>` as the slave

The child process starts with `Setsid: true` and `Setctty: true` to create a new session and make the slave PTY its controlling terminal. Window size is applied via `TIOCSWINSZ` ioctl when the host sends `RESIZE` frames.

## Piped Exec (Non-TTY)

For one-shot commands (`bhatti exec dev -- npm install`):

1. Create `exec.Command` with `Setpgid: true` (own process group)
2. Create stdin/stdout/stderr pipes
3. Start the child, fan out stdout/stderr as frames via a serializing channel
4. Wait for I/O goroutines to drain, *then* `cmd.Wait()` (ensures all output is sent before the exit code)
5. `syscall.Sync()` — flush filesystem writes before the host might snapshot
6. Send `EXIT` frame

The ordering matters: I/O before Wait ensures complete output. Sync before EXIT ensures files written by the command are on the virtual disk, not just in the page cache.

## Process Group Kill

Piped exec runs children with `Setpgid: true`. Kill sends `SIGKILL` to the negative PID:

```go
syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
```

This kills the entire process tree. Without it, `npm install` (which spawns node → dozens of child processes) would leave orphans.

TTY sessions use `SIGTERM` instead — allowing the shell to clean up and preserving the reattach model.

## Environment Variables

Every exec inherits a merged environment:

```
defaults (PATH, TERM, HOME, LANG)
    ↓ overridden by
config drive env (secrets, API keys)
    ↓ overridden by
per-request env (from EXEC_REQ)
```

## Testing Without VMs

Lohar has a test mode (`LOHAR_TEST=1`) that listens on Unix sockets instead of vsock/TCP. The agent test suite (40+ tests) starts lohar as a subprocess, connects via Unix socket, and exercises every protocol handler. All tests run on macOS with `go test`, no VM or root required.
