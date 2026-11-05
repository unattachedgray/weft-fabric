---
name: multi-ai-review
description: Cross-architecture review — send a high-stakes artifact or judgment to the other agent CLIs for INDEPENDENT inspection, then reconcile the union of their findings. Use only when accuracy matters more than cost and the reviewers can each observe something you cannot. Not a vote.
clis: claude, codex, gemini, cursor, dsh, pi
clis-why: Dispatches to the sibling CLIs, so it assumes they are installed. Only Claude runs it as the generator.
---
# Cross-architecture review

Send one artifact to architecturally different agents, let each inspect it with its own tools, and reconcile what they find. This is not a jury and the output is not a verdict.

## The gate: both conditions, or skip and say so

1. **High stakes.** Long-lived, wide blast radius, expensive to get wrong: a shared config, a migration, a security boundary, a published document.
2. **Different vantage points.** Each reviewer can observe something you cannot: its own tool access, its own behaviour, different state. Measured here: on a question answerable from general knowledge, three vendors returned the same answer. That is pure cost.

**Never send** secrets, credentials, PII, or internal source you would not paste into a third-party product. Ask before dispatching such material, every time. Point reviewers at paths they can already read.

## What the evidence says

- Claude reviewing Codex added 18.1 pp; Codex reviewing Claude cost 8.6 pp, with 13 regressions against 3 fixes ([2607.21656](https://arxiv.org/abs/2607.21656)). A reviewer's opinion of Claude's reasoning is the direction that goes negative. Claude generates; others observe.
- Models favour their own output ([2404.13076](https://arxiv.org/abs/2404.13076)). Never pin a reviewer to a Claude model.
- Different vendor does not mean independent: a 9-judge panel gave about 2.18 effective votes ([2605.29800](https://arxiv.org/abs/2605.29800)).
- Voting destroys complementarity: consensus collapsed 112 solved problems to 22-25 ([2510.21513](https://arxiv.org/abs/2510.21513)).

So **prize observation, discount judgment.** Cursor's best audit finding was what it saw of its own discovery surface; when it judged reasoning it was wrong twice.

## Rules

1. Send the system, not a summary. Point at real files.
2. Report the union of findings, never a majority. One evidenced finding outranks three vague agreements.
3. Require evidence per claim. Verify the load-bearing ones yourself before acting.
4. Land results in a durable artifact, not chat.
5. A deterministic checker beats another model.

## Running it

```bash
scripts/panel run <prompt-file> [outdir]   # dispatch, collect verdicts
scripts/panel observe | yield              # auto-score from adoption
scripts/panel score <run> <member> <c|r|m> # human verdict, always wins
scripts/panel report [kind] | pending | route <kind>
scripts/panel detect                       # prompt on stdin
# env: PANEL_MEMBERS PANEL_TIMEOUT PANEL_KIND PANEL_TARGET PANEL_*_MODEL
```

Always set `PANEL_KIND` and `PANEL_TARGET`. Default members are `codex grok`. The owner removed Antigravity, and Cursor is barred since 2026-09-20; both stay callable only by explicit `PANEL_MEMBERS`. Write the prompt to point at real paths, e.g. *"Audit `~/dev/weft-fabric` on disk. Report what you find, with evidence."* A prompt that must reach Grok has to carry its content or use paths outside `/tmp`, because Grok's sandbox has a private `/tmp`.

| CLI | Command | Extract |
|---|---|---|
| `claude` | `claude -p --permission-mode plan --output-format json` | `.result` |
| `codex` | `codex exec --sandbox read-only --skip-git-repo-check --output-schema S -o F` | `F` |
| `agy` | `agy --output-format stream-json --dangerously-skip-permissions --json-schema S -p` | last `.result.response` |
| `cursor-agent` | `cursor-agent -p --trust --mode ask --output-format json` | `.result` |
| `grok` | `bwrap --ro-bind / / … --bind ~/.grok ~/.grok grok -p … --output-format json` | `.text` |

Traps, each of which cost a failure:

- `codex exec` hangs on an open inherited stdin: `</dev/null` is mandatory.
- `codex --output-schema` needs a strict schema (`scripts/schema-strict.json`): `additionalProperties: false` at every level, every property required.
- `grok --permission-mode plan` does not block writes. Read-only comes from the bubblewrap.
- `agy` flags must precede `-p`. `--mode plan` is unusable headless; check for an empty body. `--json-schema` binds only under `stream-json`.
- `cursor-agent -p` needs `--trust`, and it alone can write with no permission flag.

## How it is invoked

The `skill-detectors` plugin runs `prompt-detectors/high-stakes-review.sh` on every prompt. It matches explicit asks and four stakes families, suppresses small work, and ignores background-task notifications. `REVIEW_DETECTOR_MODE` is `auto` (default: do the work, run the panel, report before calling it done), `suggest`, or `off`. The hook only emits a directive, because a panel outlasts the hook timeout and you must still apply the second gate.

## The ledger

Runs land in `~/.claude-skills-panel/`. `panel observe` runs at session start and scores by whether the artifact changed: acted on means `confirmed`, 48 hours untouched means `rejected` or `mixed`. Automatic rows are provisional, and a human verdict always wins.

Two signals stay apart. **Kind yield** (is a panel worth running on this kind of work?) is automatic, and the detector demotes a kind to `suggest` below 15% yield over at least 6 rows, never to `off`. **Member routing** (who to read first?) is human-only, because adoption cannot say which member found the bug.

Routing is advisory, per-kind, perishable at each CLI version bump, and never wired into dispatch. It orders attention, not membership: the lone finding nobody else had is the product.

## Other reasons to reach for a CLI

- **Capacity:** the constrained resource is Claude, so a panel spends spare subscriptions. No token argument against running one on something important; the gate above still applies.
- **Capability:** another CLI has a feature the task needs. `cursor-agent` and `agy` are multi-vendor gateways, so `PANEL_*_MODEL` can pin a model. Never pin to Claude for review.
