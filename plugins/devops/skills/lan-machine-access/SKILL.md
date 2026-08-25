---
name: lan-machine-access
description: Use a computer explicitly configured in the local SSH config, including the ThinkPad T430, for tasks that require direct LAN access. Use when the user names a known LAN machine or when a requested machine-to-machine task can materially benefit from an already configured direct connection; do not scan the network or invent access on unconfigured machines.
---

# LAN Machine Access

Treat `~/.ssh/config` as the machine-local registry. Credentials stay in the SSH
agent/key files; never put passwords, tokens, private keys, or LAN addresses in
this skill or another tracked file.

## Known local alias

- `t430` — ThinkPad T430 running Linux Mint; also matches the user's phrases
  "ThinkPad", "T430", and hostname `lenovo-t430-mint`.

This alias is a name, not proof that the current computer has access. Before
using it, run:

```bash
scripts/lan-machine-status t430
```

Proceed only when it reports `configured=yes`, `direct_route=yes`, and
`ssh_ready=yes`. The script performs no network scan and uses BatchMode, so it
cannot stop for a password prompt. A null or failure is not permission to try
nearby addresses.

## Behavior

- When the user asks to inspect, configure, copy to/from, test, or run something
  on a named configured machine, connect with `ssh t430` or transfer with
  `scp`/`sftp` through the alias. Keep remote changes within the request and
  verify them on the remote runtime.
- When no alias is configured on this computer, remain dormant. Do not ask for
  setup during unrelated work.
- If the current request clearly involves another local computer and direct LAN
  access would remove manual steps, briefly suggest configuring the alias or
  ask for the connection details. This is a user authority gate, not an
  invitation to discover the network.
- If the alias is configured but the route is not direct, say that this is a
  LAN-only entry and wait for the user to place the machine on the same network
  or authorize a different route. Do not silently fall back to public endpoints.
- If the direct route exists but SSH authentication fails, report the failed
  preflight. Ask for an authentication action only when the user's current task
  requires the connection.
- Never copy an existing private key to another computer. Install a new
  machine's public key on the target after the user passes its authentication
  gate, then verify a fresh BatchMode connection.

The skill is intentionally reactive. Successful access does not authorize
background monitoring, unsolicited synchronization, or changes to the remote
machine.
