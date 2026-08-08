---
name: multi-ai-review
description: Cross-architecture review — send a high-stakes artifact or judgment to the other agent CLIs (Codex, Antigravity, Cursor) for INDEPENDENT inspection, then reconcile the union of their findings. Use only when accuracy matters more than cost and the reviewers can each observe something you cannot. Not a vote.
clis: claude, codex, gemini, cursor
clis-why: Dispatches to the sibling CLIs, so it assumes they are installed. Only Claude runs it as the generator.
---

# Cross-architecture review

Send one artifact to several **architecturally different** agents, let each
inspect it with its own tools, and reconcile what they find. Reserved for work
where being wrong is expensive.

**This is not a jury and the output is not a verdict.** The evidence below is
emphatic that voting destroys the very thing this is for.

## The gate — both conditions, or don't run it

1. **High stakes.** Long-lived, wide blast radius, expensive to get wrong — a
   shared config, a migration, a security boundary, a published document.
2. **Genuinely different vantage points.** Each reviewer can observe something
   you cannot: different tool access, different state, a different view of the
   same system.

Fail (2) and you buy expensive consensus. Measured on this machine: asked a
question answerable from general knowledge, three vendors returned the same
answer in 4.6 s. Three agents agreeing on something any one of them knew is
pure cost.

**Never send:** secrets, credentials, PII, or internal source you would not
paste into a third-party product. Ask before dispatching, every time.

## What the evidence says — read before designing a variant

Cross-model review is real, but almost every intuitive way to use it is wrong.

**Do not let a model review itself.** Self-preference is measured and
capability-linked: GPT-4 favours its own answers by ~10 pp, Claude by ~25 pp,
and self-recognition ability *causes* the preference
([2404.13076](https://arxiv.org/abs/2404.13076),
[2306.05685](https://arxiv.org/abs/2306.05685)).

**Direction is load-bearing — a weaker reviewer damages a stronger generator.**
From a controlled cross-model code-review study
([2607.21656](https://arxiv.org/abs/2607.21656), July 2026):

| Setup | Δ pass rate | fixes / regressions |
|---|---|---|
| Claude reviews Codex | **+18.1 pp** | 26 / 5 |
| Codex self-reviews | +12.9 pp | 21 / 6 |
| Claude self-reviews | 0.0 pp | 3 / 3 |
| **Codex reviews Claude** | **−8.6 pp** | 3 / **13** |

**Different vendor ≠ independent.** A 9-judge panel yields only **n_eff ≈ 2.18**
effective votes; Claude×Gemini correlate at φ=0.603 — *higher* than a
within-OpenAI pair — and deliberately picking one judge per vendor **lowered**
n_eff to 1.93 ([2605.29800](https://arxiv.org/abs/2605.29800)). Stronger models
have *more* correlated errors, not fewer
([2506.07962](https://arxiv.org/abs/2506.07962), 350 models).

**Voting destroys the complementarity it is meant to harvest.** Model
complementarity is large — an oracle gap of +83% on Defects4J, with one 6.7B
model uniquely solving 26 bugs no other touched — but consensus selection
collapsed that from 112 solved problems to 22–25. The lone correct answer is
exactly what a majority filters out
([2510.21513](https://arxiv.org/abs/2510.21513)). Self-MoA beats mixed MoA by
6.6 pp ([2502.00674](https://arxiv.org/abs/2502.00674)); multi-agent debate
loses to plain self-consistency at matched compute
([2310.01798](https://arxiv.org/abs/2310.01798)).

### The reconciliation of that evidence with why this still works

The papers measure agents **judging each other's reasoning**. That is the
direction that goes negative.

What pays is agents **observing what the others structurally cannot.** In the
2026-08-08 skills audit, Cursor's single best finding — that it reads the union
of all three skill directories, so per-CLI aliases cost double — was available
to it only because it was looking at its own discovery surface from inside
itself. No brief could have carried it, because the generator did not know it.
In the same exchange, when Cursor judged *reasoning* rather than observing
state, it was wrong twice (citing invocation counts that were structurally zero,
and proposing a trim that would have gutted three CLIs' only review path).

So: **prize observation, discount judgment.** A reviewer's report of what it
sees outranks its opinion of what you concluded.

## Design rules that follow

1. **Never send a summary when you can send the system.** A self-contained brief
   throws away the reviewer's vantage point, which is the entire asset. Point
   them at the real files, the real machine, the real artifact.
2. **Report the union of findings; never a majority verdict.** One specific,
   evidence-bearing finding from one reviewer outranks three vague agreements.
   "2 of 3 agree" is nearly worthless — n_eff ≈ 2 no matter how many you add.
3. **Require evidence per claim, and rebut.** Every finding needs something
   checkable. Verify the load-bearing ones yourself before acting. In the audit
   above, both sides' most confident claims were the ones that collapsed.
4. **Claude generates, the others review.** Not the reverse — see the table.
5. **Land it in a durable artifact.** Findings that stay in chat evaporate. The
   audit's four rules went into `skill-audit`; that is the deliverable, not the
   transcript.
6. **A deterministic checker beats another model.** The strongest diversity
   result in the code literature is LLM + static analyzer
   ([2407.16235](https://arxiv.org/abs/2407.16235)) — errors uncorrelated by
   construction. Prefer a linter, a test, or a script over a fourth opinion.

## Running it

```bash
scripts/panel.sh <prompt-file> [outdir]
# env: PANEL_MEMBERS="codex agy cursor"   PANEL_TIMEOUT=300
```

Dispatches in parallel, normalises to one JSON array of
`{member, verdict, confidence, findings[], missed}`, and prints the
disagreement surface. Measured: 3 vendors, ~33 s wall clock.

Write the prompt to point at real paths rather than pasting content, e.g.
*"Audit `~/dev/claude-skills` on disk. Report what you find, with evidence."*

### CLI invocations — every flag here cost a failure to find

| CLI | Command | Extract |
|---|---|---|
| `claude` | `claude -p --permission-mode plan --output-format json` | `.result` |
| `codex` | `codex exec --sandbox read-only --skip-git-repo-check --output-schema S -o F` | `F` |
| `agy` | `agy --output-format stream-json --dangerously-skip-permissions --json-schema S -p` | last `.result.response` |
| `cursor-agent` | `cursor-agent -p --trust --mode ask --output-format json` | `.result` |

- **`codex exec` hangs forever on an open inherited stdin** — `</dev/null` is
  mandatory. Any naive parallel fan-out deadlocks without it.
- **`codex --output-schema` needs an OpenAI *strict* schema**:
  `additionalProperties: false` at every level, every property in `required`,
  else HTTP 400 and `turn.failed`. See `scripts/schema-strict.json`.
- **`agy` uses Go flag parsing** — flags must precede `-p`, and the prompt is
  `-p`'s value. `agy -p --mode plan "…"` silently makes `"--mode"` the prompt
  and returns a plausible-looking help essay.
- **`agy --mode plan` is unusable headless**: alone it auto-denies tools and
  returns `status:"SUCCESS"` with an *empty* body and exit 0; with
  `--dangerously-skip-permissions` it returns `status:"ERROR"`. Drop it, and
  always check for an empty body.
- **`agy --json-schema` only binds under `--output-format stream-json`** — under
  `json` it silently emits markdown prose instead.
- **`cursor-agent -p` hard-fails in an untrusted directory** without `--trust`,
  and is the only one of the four that can write files with no permission flag.

## Cost

Several minutes of wall clock and real tokens across three vendors. It earned
its keep once on this machine — for a config loaded into every session of every
CLI. It would not pay for a routine refactor. If you cannot name what makes this
artifact expensive to get wrong, don't run it.
