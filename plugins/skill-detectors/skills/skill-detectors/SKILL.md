---
name: skill-detectors
description: When SKILL_SIGNAL or SKILL_SIGNAL_CANDIDATE markers appear in additionalContext (emitted by this plugin's SessionStart and UserPromptSubmit hooks), you MUST follow the marker interpretation rules below. Also use when the user introduces a new third-party tool, GitHub project, or library you should evaluate for the detector framework. Do not ignore these markers — they are how this plugin surfaces context-conditional skills the user would otherwise forget to invoke.
---

# skill-detectors

A framework for the *forgetting problem*: the user has installed something clever — a knowledge-graph builder, a precise text-measurement library, a structural code search tool — and still forgets to invoke it every single time, because the default habit (grep, DOM measurement, eyeballing it) fires faster than the memory of the better tool. Skill descriptions in a registry are passive. Memory rules are passive. Both lose to muscle memory.

Detectors invert that. Each detector watches for the *project condition* that makes a particular skill relevant. When the condition fires, a structured signal lands in the session as `additionalContext`, and the assistant takes action — ask, route, or enforce — before the wrong default ever gets the chance.

## Two legs

| Leg | Hook | Watches | Fires | Marker |
|---|---|---|---|---|
| **Disk** | `SessionStart` → `run-all.sh` → `detectors/*.sh` | Project state on disk (files, manifests, env) | Once per session | `SKILL_SIGNAL` |
| **Chat** | `UserPromptSubmit` → `run-prompt-detectors.sh` → `prompt-detectors/*.sh` | The user's prompt text (URLs, package names, evaluation phrases) | On every user message | `SKILL_SIGNAL_CANDIDATE` |

## How to interpret markers

### `SKILL_SIGNAL <json>` (from SessionStart / disk detectors)

Fields: `skill`, `action` (`offer` | `route` | `constrain`), `reason`, `prompt`, optional `on_yes`, optional `scope`.

- **`offer`** — ask the user the `prompt` verbatim early in your first reply. If multiple `offer` signals fire, batch them into one numbered question. Wait for confirmation before doing the `on_yes` actions. If the user declines, do not re-ask this session.
- **`route`** — silently prefer the named skill over default tools when handling questions in the signal's scope. No user prompt.
- **`constrain`** — treat the `prompt` as a hard session-wide preference; obey it as if it were a memory rule with the highest priority.

### `SKILL_SIGNAL_CANDIDATE <json>` (from UserPromptSubmit / prompt detectors)

Fields: `candidate`, `source`, `instruction`.

A candidate is a *thing the user just mentioned* that may warrant adding to the framework — a GitHub URL, a package name, etc. The hook does the *trigger detection* deterministically so you can't miss it; the *evaluation* is still your job. When you see one:

1. Read the `instruction` field — it points to the three-criteria gate below.
2. Run the gate. If all three hold, propose a detector AT THE END of your reply (don't interrupt the foreground task). If any fails, ignore the candidate silently.
3. Never propose a detector twice for the same candidate in one session.

### Rules of engagement (both marker types)

- One ask per skill per session. Track answers in working memory; don't re-ask.
- Never auto-run `on_yes` actions without explicit user confirmation.
- Candidate evaluation never blocks the foreground task — the user's actual question comes first.
- If a signal contradicts an existing memory or CLAUDE.md rule, prefer the more specific guidance.

## When to propose a new detector

Whenever the user asks about, shares, or introduces a new project — especially a GitHub link, library, CLI tool, or skill they're considering — examine whether it belongs in this framework before finishing your reply. The framework is for *context-conditional* tools: useful in some projects, not in every one. That is exactly the kind of thing the user would otherwise forget to invoke.

A tool qualifies when ALL of:

1. **Categorically better, not marginal.** It's the right answer ~all the time when its niche applies — not a slight improvement over the default.
2. **Forgettable.** The user (or you, by habit) will reach for the default tool first unless something interrupts. Existing skill descriptions don't already pull it in reliably.
3. **Cheaply detectable from project state.** A file, a manifest entry, a directory, an env var. Under 100ms.

If all three hold, propose a detector: name the trigger condition, the action (`offer` / `route` / `constrain`), and the prompt text. Wait for the user's go-ahead before writing the detector script. Never add detectors silently — the user curates the framework.

If any criterion fails, don't bring it up — just answer the user's actual question.

## Architecture

```
skill-detectors/
├── .claude-plugin/plugin.json    # plugin manifest (declares hooks file)
├── hooks/hooks.json              # SessionStart + UserPromptSubmit wiring
├── skills/skill-detectors/SKILL.md  # this file
├── run-all.sh                    # SessionStart entry point
├── run-prompt-detectors.sh       # UserPromptSubmit entry point
├── detectors/                    # disk-state detectors (one *.sh each)
│   ├── graphify.sh               # offers /graphify when repo has no graphify-out/
│   ├── pretext.sh                # constrains text-measurement to pretext APIs
│   └── ast-grep.sh               # routes structural queries to ast-grep
└── prompt-detectors/             # chat-content detectors
    └── github-url.sh             # emits candidate on GitHub URL mentions
```

## Disk-detector contract (`detectors/*.sh`)

Each detector is a shell script invoked via `bash` (no exec-bit dependency). It SHOULD:

- Exit `0` with no output when no signal applies (the common case).
- Print one or more lines, each starting with `SKILL_SIGNAL ` followed by a single-line JSON object, when a signal applies.
- Be cheap (target < 100ms). Cap `find` depths, prune `node_modules`, etc.
- Honor `SKILL_DETECTOR_SCOPE` env var (colon-separated roots; default: `$HOME/dev`).

Signal schema:

| field    | required | meaning                                                                                          |
|----------|----------|--------------------------------------------------------------------------------------------------|
| `skill`  | yes      | The skill name to invoke or reference.                                                           |
| `action` | yes      | One of `offer`, `route`, `constrain`.                                                            |
| `reason` | yes      | Why the signal fired — shown to the user when relevant.                                          |
| `prompt` | yes      | For `offer`: the question to ask the user. For `route`/`constrain`: the rule the assistant follows. |
| `on_yes` | offer    | Shell-equivalent description of what to run if the user accepts.                                 |
| `scope`  | optional | Rough applicability (e.g. "this repo, this session").                                            |

## Prompt-detector contract (`prompt-detectors/*.sh`)

Each prompt detector reads the user's prompt text on stdin. It SHOULD:

- Exit `0` with no output when nothing matches.
- Print one or more lines, each starting with `SKILL_SIGNAL_CANDIDATE ` followed by a single-line JSON object.
- Be very cheap (< 50ms) — runs on every user message.
- Match conservatively. False positives are noise; better to miss a candidate than to flood context.

Candidate schema: `candidate`, `source`, `instruction`.

## Adding a detector

1. Drop a new `*.sh` under `detectors/` (disk) or `prompt-detectors/` (chat).
2. Commit + push.
3. On each machine, next session start auto-fetches via commit-SHA versioning.

No exec-bit handling needed — entry scripts invoke detectors via `bash "$script"`.
