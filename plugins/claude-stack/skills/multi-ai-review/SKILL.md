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

## How it gets invoked

**Automatically, by default.** The `skill-detectors` plugin runs
`prompt-detectors/high-stakes-review.sh` on every prompt. It matches four
families of stakes marker — irreversibility/blast radius, security and trust
boundaries, shared surfaces many agents read, and externally published work —
and suppresses on obviously small work (typo, rename, lint, bump).

Three modes via `REVIEW_DETECTOR_MODE`:

| Mode | Behaviour |
|---|---|
| `auto` **(default)** | Do the work, then run the panel against the result and report the union of findings **before** treating it as done |
| `suggest` | Mention that a panel is warranted; the user decides |
| `off` | Silent |

The hook emits a directive rather than executing, because `UserPromptSubmit` has
a **5-second timeout** and a panel takes 30–90 s. That split is also the safer
one: the assistant still applies the second gate — *can the reviewers observe
something Claude cannot?* — which no keyword match can judge, and still honours
the never-send-secrets rule that a blind exec would trample.

**Manually**, just ask: *"get a second opinion on this"*, *"cross-check that"*,
*"have the other CLIs look at it"*. Those phrases are matched explicitly, and
the skill description routes them here anyway.

Turn it down for a session with `REVIEW_DETECTOR_MODE=suggest` (or `off`), or
permanently in `~/.claude/settings.json` under the plugin's env.

## Running it

```bash
scripts/panel run <prompt-file> [outdir]   # dispatch, collect verdicts
scripts/panel observe | yield              # auto-score from adoption
scripts/panel score <run> <member> <c|r|m> # human verdict (always wins)
scripts/panel report [kind] | pending | route <kind>
scripts/panel detect                       # prompt on stdin
# env: PANEL_MEMBERS PANEL_TIMEOUT PANEL_KIND PANEL_TARGET PANEL_*_MODEL
```

**One file.** This was four scripts across two plugins plus state in `$HOME`,
with the detector in one plugin reading a yield file written by the observer in
another through a hardcoded path — uninstall either and the other failed
silently. To port it now: copy `scripts/panel`, and drop a two-line shim
wherever the host's hook mechanism wants one (see
`skill-detectors/prompt-detectors/high-stakes-review.sh`).

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

## Learning which reviewer is good at what

The panel records itself, so routing improves instead of staying a guess.

```bash
PANEL_KIND=script-review scripts/panel run brief.md      # tag the run
scripts/panel-score.sh --pending                        # what awaits scoring
scripts/panel-score.sh <run> <member> confirmed|rejected|mixed "why"
scripts/panel-score.sh --report [kind]                  # confirmed-rate per member
```

Three properties make this a flywheel rather than a leaderboard:

**Scoring is manual and post-hoc.** `panel.sh` writes `outcome:null` on purpose.
A finding counts only after someone checked it against evidence. Ranking by raw
finding count would reward whichever member talks most — and on 2026-08-08 the
two most confident claims in an audit were both wrong, while a quiet structural
observation was the one that mattered.

**The report reorders attention, never membership.** A low-scoring member is
read last, not evicted. The measured value of a panel is the *lone* finding
nobody else had — one 6.7B model uniquely solved 26 bugs no other model touched
([2510.21513](https://arxiv.org/abs/2510.21513)) — and dropping members is
precisely how you lose it. This is the governor; without it the ledger would
re-create the majority filter the harness exists to avoid.

**The ranking is perishable.** It is per-`kind`, needs ~12 scored rows per
member to mean anything, and must be re-checked after any CLI version bump.
The report says so itself when the sample is thin.

### The loop, and why it turns without you

Nobody remembers to score runs. So the loop closes on evidence instead of
memory:

```
  detector fires ──► panel runs ──► you act on what was real
        ▲                                      │
        │                                      ▼
   yield table ◄── panel-observe.sh ◄── did the artifact change?
   (fire or not)     (SessionStart)        (git, no human)
```

`panel run` records `PANEL_TARGET` and the git SHA at run time.
`panel observe` — fired from the `SessionStart` hook, so it needs no
invocation — later checks whether that artifact changed. Acted on ⇒
`confirmed`. Untouched for 48 h ⇒ `rejected` (or `mixed` if the member produced
no findings at all, which is not the same as being wrong). Every automatic row
is stamped `auto:true` and is **provisional**; a human verdict always wins and
is never overwritten.

**Two signals, deliberately kept apart.** This distinction was learned by
watching the auto-scorer get it wrong:

| Signal | Question | Source |
|---|---|---|
| **Kind yield** | Is a panel worth running on this *kind* of work? | Automatic — adoption |
| **Member routing** | Who should I read first? | **Human only** |

Adoption cannot answer the second. When a panel finds a real bug the artifact
changes *once*, which says nothing about which member found it — observed live,
where an auto-score credited all three members for a bug one of them missed
entirely. So `--report` and `--route` ignore `auto` rows. Member routing stays
honest and slow; kind yield moves on its own.

**The feedback that makes it a flywheel rather than a log:** the yield table is
read by the prompt-detector. A kind whose panels keep producing nothing that
anyone acts on gets demoted from `auto` to `suggest` — the system stops
spending panels where panels do not pay. Two brakes stop it disabling itself:
suppression needs **≥6 scored rows**, and demotion goes to `suggest`, never
`off`, so a kind can always earn its way back.

Verified end to end: a kind at 0% over 8 rows demotes; the same kind at 3 rows
does not.

### The road map: this system develops by being used

Nothing here is finished. The routing is supposed to get better, and the only
way it does is by running panels, scoring them honestly, and letting evidence
accumulate per task kind.

```bash
scripts/panel route <kind>     # what the ledger says about order
```

It currently refuses to answer:

```
kind=script-review: 3 scored rows — NOT ENOUGH. Run all members;
routing is not earned yet.
```

That refusal is the design, not a gap. Three deliberate properties:

- **Routing is advisory and never wired into dispatch.** `panel.sh` does not
  read the ledger. Auto-demoting a member on thin evidence would rebuild the
  majority filter this whole harness exists to avoid.
- **It orders attention, never membership.** Every member always runs. The lone
  finding nobody else had is the product.
- **It is per-kind and perishable.** `script-review` and `architecture-review`
  will not rank the same, and any ranking dies at the next CLI version bump.

So the honest state today: **capability routing is a hypothesis with three data
points.** Tag every run with `PANEL_KIND`, score it, and revisit when a kind
crosses a dozen rows. What we know so far is only that Codex and Cursor both
caught a real `ln -sfn` clobber that Antigravity missed — one run, on one kind
of artifact. That is an anecdote, and the tool says so rather than dressing it
up as a routing table.

### Worked example — the first two scored runs

Run 1 asked whether every skill was reachable by every CLI that needed it. All
three said *disagree*; the top finding was correct and caught three skills
tagged `clis: codex, gemini` that were linked nowhere.

Run 2 (`kind=script-review`) asked whether `install-cursor-rule.sh` was safe to
re-run. Codex and Cursor both found that `ln -sfn` force-replaces whatever is at
the target path, so a project with its own authored rule of the same name would
lose it silently. Verified, guard added, and the guard tested against a real
file. Antigravity returned three findings, none of them that one — scored
`mixed`, which is the honest record and the beginning of a routing signal rather
than a verdict about the model.

Two runs, two real defects, both in code written earlier the same day.

## Economics on this machine

The constrained resource is **Claude**, not the panel. Nearly all work runs
through Claude Code on a Max subscription; the Codex, Antigravity and Cursor
subscriptions sit largely idle. So a panel run does not spend the scarce budget
— it **spends the spare one and spares the scarce one.**

That inverts the usual framing. The costs that remain are real but small: a few
minutes of wall clock, and your attention to reconcile the findings. There is no
token-budget argument against running it on anything genuinely important.

What still gates it is the second condition in *The gate* — different vantage
points. A panel that can only restate what you already know is waste at any
price.

## Three reasons to reach for another CLI

Review is only one of them, and the harness serves all three:

1. **Verification** — an artifact is high-stakes and the others can observe
   something you cannot. This is the panel's main job.
2. **Capacity** — offload work that would otherwise burn the Claude budget.
   Nothing about this needs architectural diversity; it is pure billing.
3. **Capability** — another CLI has a feature the task requires. This is the
   one that gets forgotten.

### Know what each one actually is

`codex`, `agy` and `cursor-agent` each default to their own house architecture
— OpenAI, Gemini and Composer respectively — so the default panel already gives
four distinct architectures with Claude as generator. Leave the defaults alone
for review work.

But **`cursor-agent` and `agy` are multi-vendor gateways, not vendors**:

| Gateway | Also serves |
|---|---|
| `cursor-agent` | `gpt-5.3-codex` (4 effort tiers), `gpt-5.2`, `cursor-grok-4.5`, **`claude-opus-5-thinking-high` — 1M context** |
| `agy` | `gemini-3.6-flash`, `gemini-3.1-pro`, `claude-sonnet-4-6`, `claude-opus-4-6`, `gpt-oss-120b` |

Two consequences, and they point opposite ways:

- **For review, never pin a member to a Claude model.** You would be reviewing
  Claude's work with Claude, which the self-preference evidence above says is
  worth roughly nothing. A panel of "three different CLIs" can silently become
  one architecture in three hats.
- **For capacity or context, pinning to Claude is exactly right.**
  `PANEL_CURSOR_MODEL=claude-opus-5-thinking-high` buys a **1M-token window on
  Cursor's quota** rather than the Claude subscription's — a capability the Max
  plan does not otherwise give you here.

The ledger records the model used on every row, so a panel can never quietly
lose its diversity without leaving evidence.
