---
name: secret-registration
description: Register, scope, inspect, or use local API keys and tokens without exposing their values to an AI chat or placing them in a global environment. Use when the user mentions adding, moving, rotating, wiring, or troubleshooting credentials for CLIs, services, or another machine.
---

# Secret registration

Use the deterministic `wsecret` tool. Never ask the user to paste a secret into
chat, a command argument, Git, the Weft wiki, or a shared `.env`.

## Add a credential

Launch `wsecret add` in a real interactive terminal. It asks for the variable
name and scope, then reads and confirms the value with terminal echo disabled.
The AI may start the registrar, but must not type, capture, retrieve, or repeat
the secret. The user is the only component at this gate.

After entry, run `wsecret doctor` and report only the credential name, scope,
permissions, and validation outcome. Never display file contents.

## Use a credential

Run the narrow consumer through:

```bash
wsecret run <scope>[,<scope>...] -- <command> [args...]
```

This injects only the requested scope into that child. Do not run an entire AI
CLI or general shell with every scope merely for convenience. Prefer native
credential stores or a local capability broker when the consumer supports one.

`wsecret list` shows names and scopes only. A missing credential is a
registration problem; do not search shell history, process memory, browser
storage, logs, or unrelated files for a replacement.

## Another machine

Do not copy the whole store. Register or provision a separate leaf credential
on that machine so it can be revoked independently. Machine deployment uses an
explicit configured SSH target and must verify the remote consumer before the
old path is removed. Provider keys that can remain behind a gateway should not
be exported to the remote machine at all.

The owner controls migration, machine distribution, and rotation. Registration
does not authorize enabling a service, publishing a secret, or widening scope.
