---
name: jev-audit
description: "Audit a codebase for places that should use a typed decision model (TypeSafe Jev) instead of an LLM or hand-written heuristics: find LLM calls that are really decisions (classify, route, score, verify, gate), check their real traffic, and plan and measure the migration. Use when the owner asks for a Jev audit, asks which parts of a project should use Jev, wants to cut LLM latency, cost or quota, or when adding or reviewing an LLM call whose output is a label, yes/no, score or choice."
---
# Jev audit

Answer one question for a codebase: **where should a typed decision (Jev) replace an LLM call or a brittle heuristic, and is it worth it?**

Jev takes a `state` plus typed questions and returns probabilities: `noul` (yes/no), `choice` (1 of ≤255 options) or `score` (2–10 ordered levels). It never generates text. Measured on the owner's machine: about 0.2 s per call, flat from 1 to 30 questions, against 5–8 s for an LLM or subscription CLI.

**Owner rule (2026-09-27):** when Jev can answer a decision, call Jev, not an LLM. This includes subscription CLIs: they cost no extra dollars but spend protected quota, are slow, and hit usage holds.

This skill builds on **MagicBeansAI/jev-audit** (MIT, vendored in `upstream/`): its tiering, its report template and its architecture notes. It adds what that audit lacks: gateway and CLI call detection, a traffic check, a measured A/B before cutover, and the pitfalls learned from migrations on this machine.

## Before you start

- **Read** `upstream/jev-reference.md`: the API, primitives and limits.
- **For deeper patterns and pitfalls, read the vault page `jev-field-guide`.** It has the use-case catalogue, the "semantic sensors" architecture, and measured failure modes. Get it with `wrecall "jev field guide"` or the vault tools, where available.
- **Know how this machine calls Jev.** On the owner host, call apicascade `POST http://127.0.0.1:8090/v1/systemone` with a v1 `routing` block. The gateway picks the engine, and `DECISIONS_MODE=jev-only` is set. Elsewhere, check `~/.config/agents/MACHINE.md`. Never paste a key; credentials go through the `secret-registration` skill.

## Step 1: Inventory, deterministically

```bash
python3 <this-skill-dir>/scan.py <repo-path>          # ranked by decision cues; --all lists everything
```

The scanner finds HTTP endpoints, SDKs, the local gateway (`:8090`), local model servers (`:1234`, `:11434`) and subscription CLIs (`claude -p`, `codex exec`, `gemini -p`, agy, grok). It ranks each file by label, verdict, score and route cues near the call. A high score is a lead. Only reading the code gives a verdict.

Also look for **judgment the software lacks today**. These are places with no model at all, where Jev may still belong:
- keyword or regex lists trying to capture meaning ("urgent", "refund", `re.compile(r"(cancel|quit|…)")`);
- long if-chains over free text;
- manual review queues and "ask the human" prompts that exist only because the code cannot judge;
- TODOs such as "classify later" or "needs AI".

## Step 2: Read each site and tier it

For each site, record: the job, how the output is consumed (does code branch on it, or show it?), the model, the input size, and failure handling. JSON parsing of LLM output is a strong sign of a decision in disguise. Then assign one tier:

| Tier | When |
|---|---|
| **Replace** | yes/no, pick-one, level on a rubric, or several scores weighted in code |
| **Split, then replace** | the label rides inside a generation call; the label moves out only if the generation call can shrink or be skipped |
| **Hybrid** | Jev decides first, and an LLM writes only the branch that needs prose; or the LLM writes and Jev verifies each claim |
| **Keep LLM** | generation, summaries, code, translation, open reasoning, more than 255 options that cannot be tiered |
| **Pure code** | arithmetic, counting, dates, exact matching, permissions, anything a written rule decides (deterministic beats any model) |
| **Leave alone** | no real traffic (Step 3), so a migration buys nothing |

Anything you cannot tier with confidence goes under "needs owner judgment". Never guess it into Replace.

## Step 3: Check real traffic before recommending work

**This step changed most verdicts in the first real audit.** Of 17 decision-shaped call sites in weft, the four "strong" candidates had almost no traffic, and the high-volume jobs carried their label inside a generation call that must still run.

- **On the owner host:** count by job in `~/.hermes/weft/routing-events.jsonl` (and `.1`). The job label is `routing.job`.
- **Elsewhere:** logs, queue metrics, cron schedules or request counts.
- **Record** calls per day, and success versus failure. A failing or dead path is its own finding.

Rank by value, not by fit: `calls/day × (latency saved + premium quota saved + $ saved)`. Dollars alone understate the gain, because subscription CLIs cost quota and seconds, not dollars.

## Step 4: Design the questions (per candidate)

Follow `upstream/architecture.md` for the target layers (code → Jev → LLM), and apply these rules:

- **One judgment per question, answerable in about a second.**
  - Each noul is phrased so that a high value means yes.
  - Each choice has the full option list **plus an escape option** ("none", "insufficient information").
  - Each score describes every level as a concrete situation.
- **Compute features in code first:** counts, dates, differences. Filter the state to what the question needs. Batch all questions about one state into one call.
- **Keep the old path as the fallback,** behind an env opt-out. Jev failures return `None` and the old path runs.
- **Pin the model version** once thresholds are tuned, and log `response.model`.
- **Privacy:** the state goes to TypeSafe, and zero retention is enterprise-only. Keep secrets and sensitive personal content out, or use a local engine (Laya via AMM).

**Decomposition is not automatically better.** On 20 driving scenes, one holistic choice scored 17/20. Six narrow sensors with hand-set thresholds scored 12/20. Split a decision into several sensors only when each sensor is defined so it does not overlap the others, and the combiner is **fitted on labelled outcomes**. Several Jev sensors reading the same state have correlated errors; they are not independent votes.

## Step 5: Measure before cutover

The weft eval rule applies to every project: an LLM-behaviour change needs a before/after score.

1. **Real inputs:** take them from logs or history, never synthetic, unless you build a fixed-evidence set on purpose.
2. **Gold labels:** write the labelling rule down first. Do not trust proxy labels (a lane pick is not "needs tools"). Keep the labels in a checked-in file with its rule.
3. **Run both legs on identical inputs:** before (the shipped call) and after (the Jev call through the production code path). Report accuracy, **per-class recall**, p50 and p95 latency, and cost. The harness `~/dev/weft/evals/jev_ab/` does this, and a new site adapter is about 50 lines.
4. **When both legs score ≥95%, the set is too easy.** Add hard items: near-miss numbers, negation, two-part claims, abstain cases.
5. **Switch only if Jev ties or wins on accuracy and clearly wins on latency, quota or cost.** A layer that adds 2 of 117 items, measured on the same data it was written from, is noise.

## Step 6: Report

Fill `upstream/REPORT_TEMPLATE.md` into `JEV_AUDIT.md` at the repo root. Add:
- a traffic column in the inventory table;
- the A/B results for each migrated site;
- a "leave alone" section explaining why.

In chat, give the owner the site count per tier, the best quick win by value, and what you measured. Mark estimates as estimates.

## Real-time and safety placement (when the project controls something)

- **Jev is supervisory, not an inner loop.** It suits mode selection and semantic flags at about 1–5 Hz. It is too slow and jittery for a control loop: p99 about 0.3 s, and spikes and 529s happen.
- **A safer-state transition must never wait on Jev.** A timeout means a cautious mode, a stale reading expires, and a low-confidence reading never lifts a restriction.
- **Use asymmetric hysteresis:** escalate on one strong reading, and de-escalate only after M-of-N calm readings of *new* observations.
- **Jev is text-only.** A deterministic adapter turns sensor or perception output into a text state first.
