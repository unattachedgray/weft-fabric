# The shared skill library — how this is wired, and why

**Read this before changing anything about skills, and do not change the
arrangement unilaterally.** This repo is not one agent's config. It is the
shared library for **Claude Code, Codex, Gemini/Antigravity and Cursor** on this
machine.

## 0. Every edit here is global, whichever CLI makes it

There is **one copy of everything** and every CLI is symlinked to it. So:

- Editing `principles/AGENTS.md` from Codex changes what **Claude and Gemini**
  load on their very next session.
- Editing a `SKILL.md` from Claude Code changes the skill **Codex** runs.
- Deleting a skill removes it from **every** CLI at once.
- Re-pointing a symlink changes behaviour for that CLI **silently** — nothing
  logs it, nothing reviews it, and the next agent inherits it as if it were
  always so.

There is no per-CLI copy, no staging, and no review step. The blast radius of
any change is *all four agents*, immediately.

**So treat these as shared, owner-governed files.** Fix an outright bug (a
broken path, a dangling symlink, a stale command) freely. But adding, retiring,
restructuring, or re-linking — and any edit to `principles/AGENTS.md`, which is
loaded into every session of every CLI — is a decision for the owner, not one
to make inside a single session because it looked right from there.

A change that is obviously right for one CLI is frequently wrong for another,
and the failure is silent: nobody notices a skill went missing from a CLI they
weren't using that day. That has already happened twice — see §2 and §1.

Canonical location: `/home/julian/dev/claude-skills`
Remote: `github.com/unattachedgray/claude-skills`

---

## 1. One copy. Every CLI reaches it by symlink.

```
/home/julian/dev/claude-skills/
├── plugins/<plugin>/skills/<name>/SKILL.md     the skills
├── principles/AGENTS.md                        the shared operating principles
└── principles/skills/<name>/SKILL.md           portable skills for every CLI

~/.claude/skills/<name>   ─┐
~/.codex/skills/<name>    ─┼─► symlinks into the above. NEVER copies.
~/.gemini/config/skills/  ─┘
```

**A copy is a bug.** It drifts from the repo silently and it is unbacked. This
has already happened: Codex held 11 copies, 8 of them byte-identical duplicates
of repo skills under renamed directories, and **3 that existed nowhere else at
all** — one `rm -rf ~/.codex` from permanent loss. A fourth had quietly drifted
to a stale version of a skill that had since been fixed.

Check for regressions:

```bash
for d in ~/.claude/skills ~/.codex/skills ~/.gemini/config/skills; do
  for f in "$d"/*/; do [ -L "${f%/}" ] || echo "COPY (fix this)  $f"; done
done
```

The same directory may be linked under a different name per CLI (Codex calls
`design-taste-frontend` "taste-skill"). That is fine — the *target* is what
matters.

## 2. The CLIs do not have the same features

This is the rule most likely to be broken by a well-meaning agent.

| | Claude Code | Codex | Gemini/Antigravity | Cursor |
|---|---|---|---|---|
| Built-in code review | `/code-review`, `/simplify` | — | — | — |
| Built-in security review | `/security-review` | — | — | — |
| Built-in browser control | `claude-in-chrome` | — | — | — |
| Plugin marketplace | yes (`unatt` registered) | no | no | no |
| Skill discovery | marketplace + `~/.claude/skills` | `~/.codex/skills` | `~/.gemini/config/skills` | `~/.cursor/skills-cursor` — **managed, do not link** |
| Loads `principles/AGENTS.md` | via `@import` in `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` symlink | `~/.gemini/AGENTS.md` symlink | not wired (per-project `AGENTS.md` only) |

**A skill is only redundant if it is redundant everywhere.** `security-review`
and `code-quality` duplicate Claude Code commands — and are the *only*
implementation Codex and Gemini have. They were deleted once on Claude-only
reasoning and had to be restored.

When a skill's value is conditional, say so in its frontmatter rather than
leaving the next reader to work it out:

```yaml
clis: codex, gemini, cursor
clis-why: Claude Code ships its own /security-review; this covers the rest.
```

Absent `clis:`, a skill is assumed to apply everywhere.

### Cursor is the exception — do not symlink into it

`~/.cursor/skills-cursor/` is **Cursor's own managed directory**. It carries a
`.sync-manifest.json` with a `lastSyncedAt` per skill and holds Cursor's shipped
skills (`babysit`, `canvas`, `create-hook`, `create-rule`, `create-skill`,
`create-subagent`, `loop`, `migrate-to-skills`, `rename-chat`, `review`, …).
Cursor re-syncs it, so anything symlinked in is liable to be clobbered — and the
copies there are Cursor's to manage, not drift for us to "fix".

If this library should reach Cursor, do it through a per-project `AGENTS.md`
rather than by writing into that directory. Ask the owner first; it is not
wired today and that may be deliberate.

## 3. What earns a place here

A skill is worth keeping only if it carries something **the model does not
already know**. The models improve every few months; skills do not. Three
things qualify:

1. **This machine** — paths, ports, service names, which binary is the right one,
   what breaks and why. `firefox-control` and `sudo-run` are the shape to copy:
   short instructions wrapped around a real script.
2. **Volatile facts** the model would get wrong from memory — prices, model IDs,
   API shapes. `llm-api-pricing` ships a data file and refuses to answer from
   training data.
3. **A procedure with real judgment in it** that would otherwise be improvised
   inconsistently.

Everything else is filler however well written. A 400–850 line `SKILL.md` with
no bundled files is a tutorial, not a tool. 27 such skills (11,788 lines) were
retired on 2026-08-08 for this reason, and the same diet was applied to
`principles/AGENTS.md` (161 → 23 lines) and to weft's `CLAUDE.md`.

This matters mechanically, not just aesthetically: skills are progressive
disclosure — the body loads on invoke, but **every name and description sits in
the discovery surface of every session**, competing for attention.

## 4. Adding a skill

```bash
mkdir -p plugins/<plugin>/skills/<name>
$EDITOR plugins/<plugin>/skills/<name>/SKILL.md   # name + description frontmatter
python3 validate-skills.py
bash scripts/regen-catalog.sh
git commit && git push
```

- A **new plugin** also needs `plugins/<plugin>/.claude-plugin/plugin.json` and a
  row in `.claude-plugin/marketplace.json`.
- Claude Code reaches it through the registered marketplace (local path, so repo
  edits are live with no push cycle). Codex/Gemini need a symlink:
  `ln -s /home/julian/dev/claude-skills/plugins/<plugin>/skills/<name> ~/.codex/skills/<name>`
- Anything under `principles/skills/` is deployed to **all** CLIs by
  `bash scripts/deploy-principles.sh`.

## 5. Retiring a skill

Delete it — git holds the history. Do not create a `deprecated/` folder; that
just means auditing the graveyard too. **Before deleting, check §2**: confirm it
is redundant on every CLI, not just the one you happen to be running in.

The periodic maintenance pass is the `skill-audit` skill, which ships the
detection commands (size/bundling inventory, broken internal references,
duplicate-under-a-different-name, and genuine invocation counts). Its companion
`flywheel-audit` decides what to *adopt*. Intake and pruning.

One trap it records: measuring usage by grepping the skill name across
transcripts is wrong — a deleted filler skill scored 52 "uses" from prose
mentions alone. The Skill tool writes `"skill":"<name>"`; match that.

## 6. Things that were broken and are load-bearing now

Do not "clean up" these without understanding them:

- **`scripts/deploy-principles.sh` links into `~/.claude/skills` too.** It used
  not to, on a comment reading "Claude already has them" — which was false, so
  `flywheel-audit` was unreachable from Claude Code while the AGENTS.md loaded
  into every Claude session ended by pointing at it.
- **`validate-skills.py` globs `plugins/*/skills/**/SKILL.md` plus
  `principles/skills/*`.** The old non-recursive glob silently skipped three
  real files.
- **The marketplace is registered against the local path**, not the GitHub
  remote. That is deliberate: edits are live without a push cycle.
- **The remote holds history this clone once lost.** The local clone was
  disconnected with a flattened one-commit history; it was grafted back on top
  of `origin/main`. **Never `push --force`** here.

## 7. Open question, deliberately left open

The `principles/AGENTS.md` diet dropped **§6 "Desktop Screenshots Need
Confirmation"** — a security guardrail requiring confirmation before capturing
the desktop, and vetting of any new skill/plugin/MCP that can screenshot, read
the clipboard, capture mic/webcam, decrypt browser cookies, harvest `.env`, or
run autonomously from session-start hooks.

That is precisely the rule that would gate installing a marketplace. It was
removed without a commit message explaining why. Restoring it is the owner's
call — flagged here so it is not lost again silently. An agent should not
decide this one alone.
