# The fleet — how config reaches every machine and CLI

**Read this when something is wired wrong, when adding a machine or a CLI, or
before changing how any of it propagates.** `ARRANGEMENT.md` says *what* the
symlink layout is and why it is owner-governed; this file says *how the layout
gets onto a machine and stays right*.

Built 2026-08-26. Every claim here was verified on a running machine, not
inferred — where something is a known gap it says so.

---

## The one-sentence model

**Everything shared lives in this repo; everything machine-specific lives in
`~/.config/agents/MACHINE.md`; one tool called `wagent` reconciles and reports
the whole fabric, with local convergence running hourly.**

There is deliberately **no separate install path**. The command that sets a
machine up is the same one that keeps it right, so it is exercised constantly
instead of once a year when it has already rotted.

---

## Three planes

| Plane | What it carries | Mechanism | Where it can run |
|---|---|---|---|
| **Content** | principles, skills, tools, CLI wiring rules | this git repo | anywhere |
| **Convergence** | getting content onto a machine and into its CLIs | `scripts/agentsync` + hourly timer | on each machine |
| **Identity** | vault token, rotation, ssh trust | `wtoken` (mint) + ssh | **owner host only** |

The split matters: **the content plane carries no secrets.** That is what lets a
machine configure itself by *pulling*, with the owner host not involved at all —
no inbound ssh, no NAT hole, no key copied by hand. Credentials are a separate,
later, optional step. A machine is fully useful without one.

---

## What lives where

### In this repo

```
principles/AGENTS.md          shared operating principles — byte-identical everywhere
principles/skills/<name>/     portable skills for every CLI
plugins/<name>/               Claude Code marketplace plugins (commit-SHA versioned)
cursor/*.mdc                  Cursor project rules (it has no global file — see below)
cli-targets.json              every CLI's paths, as DATA
tools/                        wsecret, wtask, wmachine, wfleet, updateall
scripts/agentsync             the convergence command
scripts/install-cursor-rule.sh   Cursor's per-project wiring (agentsync runs it)
hooks/pre-commit              SKILL.md validation (agentsync arms it)
install.sh                    one-command bootstrap for a brand-new machine
```

### On a machine

```
~/dev/weft-fabric/                 the clone. One per machine.
~/.config/agents/MACHINE.md          machine-specific facts. NOT in the repo. Never synced.
~/.config/agents/trust-github        opt-in: GitHub accounts whose ssh keys may reach here
~/.config/agents/cursor-roots        opt-in: extra trees to install Cursor rules into
~/.config/agents/owner-host          which host `wtask` tunnels to (default: venge)
~/.local/bin/w*                      symlinks to tools/ in the repo
~/.config/systemd/user/agentsync.*   the hourly timer
```

**`MACHINE.md` is the other half of the pair.** The shared file is identical
everywhere by design, so anything that differs per machine — which tools exist,
which hosts are reachable, which shared rules cannot run locally — belongs
there, and it **overrides** the shared file. Never edit `principles/AGENTS.md`
to accommodate one machine; that breaks the others.

---

## The convergence loop

The public command is `wagent`; `scripts/agentsync` is its internal,
idempotent reconciliation engine.

```
wagent status              truthful health across all enrolled machines
wagent sync                update every reachable machine
wagent sync --local        update only this machine
wagent enroll <host>       completely add a machine
wagent secrets ...         list/provision selected credentials by name
wagent setup [--inspect]   detect, explain, confirm, converge, and verify
wagent doctor              explain this machine's live wiring
wagent version             product version, protocol, and exact Git build
```

### Version and build are separate on purpose

`fabric-release.json` contains the human release (currently `0.0.1`) and the compatibility
protocol. Every live health report also reads the exact Git commit that produced
it. `wagent status` compares all three against the controller and reports what
each machine needs:

- `current` — version, protocol, build, wiring, and timer all match;
- `sync` — same release label but an older exact build;
- a version such as `0.0.2` — release or compatibility upgrade required;
- `repair` — code is current but live wiring drifted;
- `timer` — code and wiring are current but automatic convergence is not active.

Feature and fix releases use small patch increments (`0.0.1` → `0.0.2`). Reserve
larger SemVer increments for a genuine compatibility boundary. Every
commit remains distinguishable even between version bumps, so forgetting a bump
cannot make stale machines appear current.

Each run, in order:

1. **pull** `--ff-only`. **Refuses if the clone is dirty** — a machine mid-edit
   is never clobbered. This is a brake, not a bug (see Troubleshooting).
2. **arm the commit hook** — sets `core.hooksPath=hooks` *and* fixes the
   executable bit.
3. **ensure `MACHINE.md` exists** — writes a stub from detected facts if absent.
4. **for each CLI in `cli-targets.json` that is detected**: link its instruction
   file, link every eligible portable/plugin skill, run structured adapters.
5. **refresh github ssh trust** if opted in.
6. **link `tools/` into `~/.local/bin`**.
7. **refresh the marketplace** if `claude` is present.

Exit 0 = converged (with or without changes). Exit 1 = a step failed. In
`--check` mode, exit 2 means repairable drift was found. JSON protocol version
1 reports detected CLIs, the configuration fingerprint, drift, notes, errors,
and adapter states; controllers consume this instead of recreating the checks.

---

## Adding a CLI — it is data, not code

Add an entry to `cli-targets.json`, commit, done. Every machine wires it up on
its next sync with no local edits. Nothing hardcodes CLI paths.

```jsonc
{
  "name": "codex",
  "detect": ["command -v codex", "test -d $HOME/.codex"],  // ANY exit 0 = present
  "instructions": "$HOME/.codex/AGENTS.md",
  "method": "symlink",        // or "import" for a file that takes @<abs-path> lines
  "machine_local": true,      // also needs MACHINE.md
  "skills_dir": "$HOME/.codex/skills",
  "post": [{
    "name": "project rules",
    "check": "scripts/... --check", // read-only: 0 healthy, nonzero drift
    "apply": "scripts/..."          // idempotent repair
  }]
}
```

Undetected CLIs are **skipped, not failed**. Install a supported CLI whenever
you like and it wires itself on the next hourly run. A new skill is discovered
from the canonical tree and delivered according to its optional `clis:` field;
there is no per-machine link step. Supporting a previously unknown CLI is one
reviewed `cli-targets.json` adapter entry, after which the fleet converges it.

### Per-CLI quirks that cost real debugging time

| CLI | Quirk |
|---|---|
| **Claude Code** | Only one that can `@import`. Gets shared core **and** `MACHINE.md` as two imports, in that order — machine-local must come second so it overrides. |
| **Codex** | **No import mechanism.** Reaches `MACHINE.md` only because `principles/AGENTS.md` has a *Machine-Local Notes* section telling it to read the file. That pointer is load-bearing; do not delete it. |
| **Cursor** | **No global instruction file at all** (probed twice). Walks ancestors for `AGENTS.md`, so `~/AGENTS.md` covers projects under `$HOME` and **nothing outside it**. Projects elsewhere get `cursor/*.mdc` installed per project. |
| **Gemini / dsh** | Plain symlink; dsh reaches skills by folder pointer, not per-skill symlink. |

---

## Adding a machine

### Owner workflow — one handoff

1. Boot the machine and make it reachable with normal SSH or Tailscale SSH.
2. Authorize the owner host's SSH key.
3. Ask an agent to add that host to Weft Fabric.

The agent runs `wagent enroll <host>`. Fabric installs `git` and Python 3 when
they are absent and the target permits non-interactive administration, clones
the one source, wires every CLI already present, installs hourly convergence,
adds optional scoped vault access, registers the machine, and verifies the live
result. If an administrator password is required, that single hidden prompt is
the only human gate. No agent CLI has to be installed first: a supported CLI
installed later is detected and wired automatically.

### Pull-based guided setup (preferred — needs nothing but internet)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/unattachedgray/weft-fabric/main/install.sh)
```

The process-substitution form deliberately preserves the terminal for the
confirmation gate. Fabric detects Git/Python, agent CLIs, SSH client/server,
machine notes, timer state, SSH trust, and only the number of scoped credential
names. It explains what is required, what is optional, and what it will change
before asking once. Then it clones, converges every detected CLI, arms the
hourly timer, writes a `MACHINE.md` stub, and reads the live sensor back.

No CLI or SSH server is a prerequisite. If the owner already prepared them,
Fabric detects and uses them. If not, setup calls them out as optional and they
are automatically wired on a later hourly pass. `wagent setup --inspect` is
read-only; prepared automation must say `--yes` explicitly, because EOF is never
consent.

`TRUST_GITHUB` remains an explicit opt-in that removes the manual key copy: GitHub publishes an
account's public keys at `https://github.com/<user>.keys`, so a brand-new box can
authorize the owner host from a public URL with nobody logged in. It is refreshed
hourly, so **adding a key to GitHub once means every machine trusts it within the
hour**. Keys go in a delimited managed block; hand-added keys are never touched.

> **The trade, stated plainly:** whoever controls that GitHub account can ssh to
> every machine that opted in. Only enable it for an account with 2FA.

### Push-based (from the owner host, also does the vault)

```bash
wagent enroll <ssh-host>          # add --no-vault to skip minting a token
wagent check  <ssh-host>          # read-only: what state is that box in?
wagent discover [--enroll]        # tailnet machines that are not enrolled yet
```

`wmachine discover` uses the tailnet as the machine inventory — there is no
second registry to keep in step. It matches enrolled machines by **resolved
address** (`ssh -G`), not by name, because registry keys are ssh aliases and look
nothing like tailnet hostnames.

---

## Tools

Symlinked into `~/.local/bin` by `agentsync`.

| Tool | Runs where | Does |
|---|---|---|
| `wagent` | any machine | the public Weft Fabric interface: setup, status, sync, enroll, check, discover, doctor |
| `wsecret` | any machine | scoped secret registrar; hidden prompt, mode-0600 scope files, `wsecret run <scope> -- cmd` injects one scope into one child |
| `wtask` | any machine | shared task list. Runs locally if the weft repo is present, else tunnels to the owner host over ssh |
| `wmachine` | **owner host** | enrol / check / discover machines |
| `wfleet` | **owner host** | `wfleet status` — who is converged; `wfleet sync` — converge everyone |
| `updateall` | any machine | one command to update every package manager present — apt, dnf, snap, flatpak, global npm, pipx, brew, fwupd, and a report of a newer distro release. Everything ordinary runs unattended, orphan removal and major npm bumps included. Only a firmware flash or a distro release upgrade is asked about, once, at the end, as a `[y/N]` (`y` or `yes` approve); no answer leaves it undone, and `-f` / `-r` pre-approve. Asks for the sudo password only when sudo needs one. `sudo updateall` needs a one-time `sudo ln -s ~/.local/bin/updateall /usr/local/bin/updateall` per machine, since sudo's `secure_path` excludes `~/.local/bin` |
| `wvault` | any machine | vault client. **Not in this repo** — `wtoken install` ships it privately over ssh, and it carries the vault endpoint and auth header |
| `wtoken` | **owner host only** | mints and revokes vault tokens. Deliberately not distributed |

`agentsync`, `wfleet`, and `wmachine` remain compatibility commands for old
automation. New instructions and human workflows use only `wagent`.

`wfleet` reads the non-secret inventory at `~/.config/agents/fleet.json`.
`wmachine enroll` updates it only after verifying the target. During migration,
`wfleet` also reads machines missing from that file out of the old vault
registry. Vault access is an attribute of a machine, not what makes it a fleet
member.

Each enrollment keeps a mode-0600 progress journal under
`~/.config/agents/enrollments/`. Re-running remains the recovery action; the
journal makes a partial run say where it stopped.

### Credentials after enrollment

Enrollment mints a separately revocable vault leaf when requested, but never
duplicates the general secret store. The optional next step is `wagent secrets
provision <host>`, whose terminal selector displays only credential names and
scopes. For non-interactive use, `--keys NAME,NAME` makes the grant explicit;
`--all` includes only portable LLM-provider credentials. Higher-authority and
machine-specific scopes always require selection by name.

Selected values travel only in SSH standard input—not Git, command arguments,
logs, journals, or chat. The target merges into its mode-0600 scope files,
aborts the entire request if any selected name already exists, and reports only
names and modes on read-back. `--replace` is the explicit overwrite gate.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| A machine stopped converging; `note: clone has uncommitted changes` | `agentsync` refuses to pull over a dirty tree. **Working as designed.** | Commit or stash the changes. Do not force. |
| A CLI is installed but shows as not detected | Non-interactive ssh has a minimal PATH, so `command -v` misses it | `agentsync` widens PATH itself. If it still misses, add a `test -d` fallback to that CLI's `detect` list |
| `SKILL.md` validation never runs | git **silently ignores a non-executable hook** — only a hint on stderr | `agentsync` fixes the mode bit and `core.hooksPath`. Re-run it |
| Cursor knows nothing in a project outside `$HOME` | No global instruction file; ancestor walk cannot reach `~/AGENTS.md` | Add the tree to `~/.config/agents/cursor-roots`, or run `scripts/install-cursor-rule.sh <dir>` |
| Codex knows the shared core but no machine facts | The *Machine-Local Notes* pointer was removed from `principles/AGENTS.md` | Restore it — Codex has no other route to `MACHINE.md` |
| Machine-local rules are being ignored in favour of shared ones | `@import` order inverted in `~/.claude/CLAUDE.md` | Re-run `agentsync`; it rewrites the block shared-first, machine-local second |
| Something you wrote to `~/AGENTS.md` keeps reverting | `cli-targets.json` claims it for Cursor and `agentsync` relinks it hourly | Put the content in `MACHINE.md` instead — that is what it is for |
| Vault calls fail after ~30 days | Token hit TTL; that machine is not in the rotation registry | `wmachine enroll <host>` from the owner host |
| MCP exposes `vault_write` but writes are rejected | **Tool exposure is not authority.** The bridge advertises write tools regardless of the token's grant | Check `wtoken list` — the `w` column is truth. Re-mint with `--write` if needed |
| Timer never fires on a WSL box | `Linger=no`, so user timers only run while WSL is up | Keep WSL running (a Windows scheduled task at boot), or accept best-effort |
| A machine shows online in Tailscale but ssh is refused | On WSL the tailnet node is the *Windows* host; WSL can be down while the node is up | Start WSL. A refused `:22` there means WSL is down, not the machine |
| `tailscale status` returns `Peer: null` | A logged-out tailscaled. A WSL box sees two CLIs and the wrong one answers | `wmachine` picks one whose `BackendState == Running`; check yours the same way |

---

## Invariants — do not break these

- **A copy is a bug.** Everything is a symlink into the repo. `agentsync`
  converts an identical hand-placed copy into a symlink and *refuses* to replace
  one that differs, reporting it instead.
- **Machine-specific facts never enter the repo.** They go in `MACHINE.md`.
- **Convergence pulls; it never commits or pushes.** Publishing stays deliberate.
- **`--ff-only`, and never over a dirty tree.**
- **Secrets never travel through git.** `wsecret` for local scopes and explicit
  name-only SSH provisioning, `wtoken` for vault tokens; neither exposes values
  in command arguments, logs, journals, or chat.
- **Mint authority stays on the owner host.** `wtoken` is not distributed.
- **Drift is reported, not silently repaired.** `agentsync` prints what it
  changed, and post-steps' warnings are surfaced even on success — a repair
  nobody sees is how a machine stays wrong for a month.
- **One sensor owns configuration truth.** Local checks, SSH fleet checks, and
  future UIs consume `agentsync --check --json`. Do not hardcode CLI lists or
  infer live wiring from a Git SHA in a controller.

---

## Known gaps

- **`t430` is untested against this system** — it was offline throughout. It is
  LAN-only on the owner host's network, so it can only be enrolled from there.
- **A private repo would cost the zero-credential bootstrap.** `curl | bash`
  works today because the repo is public and carries no secrets. Going private
  means every machine needs a credential *before* it can configure itself.
  Deploy keys installed at enrolment would work, but it is a real trade.
- **Cursor project slugs under `~/.cursor/projects/` are lossy** — long paths are
  truncated and hashed — so uncovered projects are *reported*, never decoded back
  into paths. Throwaway `/tmp` dirs are filtered out of that report.
- **`wtask`'s store is a file on the owner host**, not the vault. The list is
  shared across machines only because the shim tunnels there.
