# Weft Fabric

The shared agent environment: one source keeps user principles, accumulated
operating experience, skills, tools, and machine-local context available to
Claude Code, Codex, Gemini, Cursor, dsh, and future CLIs across every enrolled
machine. It also contains the `unatt` Claude Code plugin marketplace.

> **New machine, new CLI, or something wired wrong?** See **[FLEET.md](FLEET.md)** — how config reaches every machine, and how to fix it.

Daily use is one tool: `wagent status`, `wagent sync`, `wagent enroll <host>`,
`wagent doctor`, and `wagent version`. Schemas, adapters, compatibility commands, vault
separation, and recovery journals stay behind it.

`wagent status` identifies every machine by Fabric version and exact build, and
says whether it is current or needs a sync, repair, timer repair, or compatibility
upgrade.

For a new machine, make SSH reachable and tell an agent to add it. `wagent
enroll` handles prerequisites, Fabric installation, registration, CLI/skill
linking, scheduled updates, and a separately revocable vault credential. General
credentials are never copied implicitly. After enrollment, `wagent secrets
provision <host>` presents a key-name-only selector; automation can use `--keys
NAME,NAME` or `--all` for all portable provider keys. Machine identities and
high-authority scopes are excluded from bulk selection and require explicit names.
Values travel only through SSH standard input,
existing target names are preserved unless `--replace` is explicit, and read-back
reports only names and private file modes.

## Fresh machine (one command)

The repo is public, so no auth is needed. Clone it, then run `bootstrap.sh` — it syncs the shared
[operating principles](#cross-agent-principles) into every agent CLI **and** registers this skills
marketplace so you can install skills on demand:

```
git clone https://github.com/unattachedgray/weft-fabric ~/dev/weft-fabric \
  && ~/dev/weft-fabric/bootstrap.sh
```

Re-run `bootstrap.sh` any time to pull the latest and re-sync. Skills that depend on a specific
agent/tool simply stay inert until that tool is installed — safe to share and carry everywhere.

### Consolidating a machine that already has its own principles

`bootstrap.sh` / `deploy-principles.sh` are **non-destructive** — they add the `@import` line at the
top of `~/.claude/CLAUDE.md` and never delete what's already there. A machine with its own
hand-written principles keeps them: the shared core (imported) first, its local content below. This
is **not** meant to overwrite any machine's principles — it layers on top, then you reconcile.

To fold that machine's principles into the single source of truth:

1. **See what's local** — everything below the import line is that machine's own content:
   ```
   awk 'f; /^@.*AGENTS\.md/{f=1}' ~/.claude/CLAUDE.md
   ```
2. **Decide per item** (let Claude do the semantic reconcile — open both files and ask:
   *"reconcile my local CLAUDE.md principles with AGENTS.md — which are universal, which are
   machine-specific, which are duplicates?"*):
   - **Universal & missing from the core** → promote it *up* into `principles/AGENTS.md`, then
     `bash scripts/release.sh "principles: add <x>"` so every machine gets it on next session.
   - **Genuinely machine-specific** (local paths, this box's quirks) → leave it below the import.
   - **Already in the core** (duplicate) → delete the local copy.

Nothing is overwritten; *you* choose what graduates to the shared core versus stays machine-local.

## Install (skills only)

Add the marketplace once per machine:

```
/plugin marketplace add unattachedgray/weft-fabric
```

Then install plugins selectively (see [Plugins](#plugins) below for what each covers):

```
/plugin install skill-detectors@unatt
/plugin install catalog@unatt
/plugin install workflow@unatt
/plugin install frontend@unatt
# ...
```

Always-recommended foundation: `skill-detectors` + `catalog`. The rest depends on what each machine actually does.

Reload after install:

```
/reload-plugins
```

## Updating

Plugins use commit-SHA versioning — every push to this repo bumps the version of every plugin. Claude Code auto-fetches at session start. Force-refresh now:

```
/plugin marketplace update unatt
/reload-plugins
```

## Plugins

| Plugin | Skills | What it covers |
|---|---|---|
| [`skill-detectors`](plugins/skill-detectors/) | 1 + hooks | Surfaces context-conditional skills automatically — SessionStart emits `SKILL_SIGNAL` markers from disk state, UserPromptSubmit emits `SKILL_SIGNAL_CANDIDATE` markers from chat content. See [Skill detectors](#skill-detectors). |
| [`catalog`](plugins/catalog/) | 1 | Auto-regenerated index of every skill across every plugin in this marketplace. Install on every machine so Claude knows what's available even if uninstalled. |
| [`workflow`](plugins/workflow/) | 7 | Project-agnostic dev lifecycle, builds, evals, persona switching, planning, brainstorming, full-stack scaffolding from natural language. |
| [`frontend`](plugins/frontend/) | 10 | React + Next.js, Tailwind v4, design systems, mobile-first, browser automation, theme application, accessibility/WIG, text-aware layout via pretext. |
| [`backend`](plugins/backend/) | 8 | Node.js / TypeScript microservices, system architecture, schema design, API integration, type-level TS, JS fundamentals, Bun. |
| [`devops`](plugins/devops/) | 6 | Authenticated Firefox control and Reddit research, Facebook comment exports, LAN and sudo access, setup wizards, and deployment tooling. |
| [`claude-stack`](plugins/claude-stack/) | 3 | Anthropic ecosystem — Claude API / Agent SDK, MCP servers, Gemini CLI for big-context review, advanced prompt engineering. |
| [`ai-agents`](plugins/ai-agents/) | 5 | Building autonomous agents: architecture, memory, multi-agent orchestration, local CLI agent management, AGENTS.md/CLAUDE.md refactoring. |
| [`ai-ml`](plugins/ai-ml/) | 3 | Data science, data engineering, LangChain for LLM apps with agents/RAG/tool calling. |
| [`review`](plugins/review/) | 3 | Code quality, security review (auth/secrets/vulnerabilities), security audit (secrets/ports/DB integrity). |
| [`content`](plugins/content/) | 4 | PDF manipulation, local-file NotebookLM-style analysis (FTS5+MCP), Google NotebookLM via browser, meme generation. |
| [`business`](plugins/business/) | 5 | CEO advisory, marketing ideas, App Store Optimization, UX research, email systems. |
| [`automation`](plugins/automation/) | 3 | Jira workflows, metric watchers/alerts, Zapier orchestration via MCP + webhooks. |
| [`wordpress`](plugins/wordpress/) | 1 | Comprehensive WordPress development — block themes, custom blocks (apiVersion 3, Block Bindings, Pattern Overrides, Section Styles), plugins, REST API, Interactivity API, performance, security, a11y (WCAG 2.2 AA), wp.org compliance, wp-env + wp-scripts. |
| [`skill-management`](plugins/skill-management/) | 3 | Discover, create, and propagate skills across your library. |

For the live skill-by-skill catalog, install `catalog@unatt` and read `/catalog:browse-skills` — it's regenerated on every push.

## Cross-agent principles

[`principles/AGENTS.md`](principles/AGENTS.md) is the **agent-neutral** single source of truth for operating principles — think-before-coding, the simplicity ladder + surgical edits, goal-driven verification, iterate-independently, and the full flywheel lens — shared across **Claude Code, Codex, and Antigravity**. [`scripts/deploy-principles.sh`](scripts/deploy-principles.sh) wires it into each agent's global instruction path (Codex `~/.codex/AGENTS.md` and Antigravity `~/.gemini/AGENTS.md` as symlinks to the one file they read natively; Claude Code via an absolute-path `@import` written into `~/.claude/CLAUDE.md`, leaving each machine's local notes below the import untouched) and deploys the portable [`flywheel-audit`](principles/skills/flywheel-audit/) skill to each agent's skills dir. One source of truth, every agent. Run it (or `--uninstall`) once per machine; the symlinks + import keep every agent on the latest after a `git pull`.

## Skill detectors

The `skill-detectors` plugin addresses the *forgetting problem*: you install a categorically-better tool, you know it exists, and you still reach for the default every time because habit fires faster than memory. Two hooks invert that:

| Hook | Watches | Fires | Marker |
|---|---|---|---|
| `SessionStart` → `run-all.sh` → `detectors/*.sh` | Project state on disk | Once per session | `SKILL_SIGNAL` |
| `UserPromptSubmit` → `run-prompt-detectors.sh` → `prompt-detectors/*.sh` | The user's prompt text | On every user message | `SKILL_SIGNAL_CANDIDATE` |

Existing detectors:

| Detector | Type | Fires when |
|---|---|---|
| `detectors/graphify.sh` | disk | Git repo with ≥30 source files and no `graphify-out/` — offers `/graphify .` |
| `detectors/pretext.sh` | disk | `package.json` declares `@chenglou/pretext` — constrains text-height work to pretext APIs |
| `detectors/ast-grep.sh` | disk | `ast-grep` on PATH in a code project — routes structural pattern queries to ast-grep |
| `prompt-detectors/github-url.sh` | chat | Prompt contains a GitHub repo reference — emits a candidate signal |

Adding a detector: drop a new `.sh` file under `plugins/skill-detectors/detectors/` (disk) or `plugins/skill-detectors/prompt-detectors/` (chat). Contract:

- Exit `0` with no output when no match. Emit one or more single-line JSON markers prefixed with `SKILL_SIGNAL ` (disk) or `SKILL_SIGNAL_CANDIDATE ` (chat).
- Be cheap — under 100ms (disk) or 50ms (chat).
- Self-contained. No shared state between detectors.

See `plugins/skill-detectors/skills/skill-detectors/SKILL.md` for the full marker schema and the three-criteria gate Claude uses to evaluate candidates.

## Adding or modifying skills

Skills live at `plugins/<plugin>/skills/<skill-name>/SKILL.md` — auto-discovered by Claude Code (no manifest listing required).

To add a new skill to an existing plugin:

```
mkdir -p plugins/<plugin>/skills/<new-skill>
$EDITOR plugins/<plugin>/skills/<new-skill>/SKILL.md
bash scripts/release.sh "add <new-skill>"
```

To add a whole new plugin: also create `plugins/<plugin>/.claude-plugin/plugin.json` and add a row in `.claude-plugin/marketplace.json`.

`scripts/release.sh` does the whole publish cycle: regenerates the catalog, stages everything, commits with your message, and pushes. After the push, every consumer machine auto-fetches at next session start (or run `/plugin marketplace update unatt` to refresh now).

## How plugins work

Each plugin is a directory with:

```
plugins/<name>/
├── .claude-plugin/
│   └── plugin.json       # manifest (name, description, author)
├── skills/               # auto-discovered, prefixed as /<plugin>:<skill>
│   └── <skill>/SKILL.md
└── hooks/                # optional — declared in plugin.json or auto-discovered
    └── hooks.json
```

Skills get namespaced slash commands like `/frontend:senior-frontend`, `/wordpress:wordpress-development`. Triggered by typing the slash command, or auto-loaded when the skill's `description` matches the user's request.

## Recent Changes

- **Phase 2 — flat-to-plugin restructure.** Moved all 60 surviving flat skills into 13 concern-based plugins (`workflow`, `frontend`, `backend`, `devops`, `claude-stack`, `ai-agents`, `ai-ml`, `review`, `content`, `business`, `automation`, `wordpress`, `skill-management`). Marketplace now lists 15 plugins total (with `skill-detectors` + `catalog`). Catalog auto-regenerates on every push.
- **Curation pass 1.** Dropped 15 flat skills (specialist ML/CV/audio, niche platforms, WSL-irrelevant Windows-specific, and consolidated overlaps). Beefed up `wordpress-development` with Block Bindings API, Pattern Overrides, Section Styles, Interactivity API store, `register_rest_field`, `%i` SQL placeholder, Action Scheduler, `wp-env`, and `wp-scripts` internals.
- **Converted to a Claude Code plugin marketplace** (`unatt`). Added `.claude-plugin/marketplace.json` and initial plugins. First-class Claude Code support, auto-updates via commit-SHA versioning.

## License

MIT
