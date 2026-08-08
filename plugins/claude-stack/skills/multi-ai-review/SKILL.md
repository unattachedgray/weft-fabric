---
name: multi-ai-review
description: Parallel cross-validation of an important judgment by Gemini and Codex CLI. Use when the user asks for a "second opinion", "cross review", "external review", "peer review", "multi-AI review", or expresses doubt about a Claude-only judgment on architectural / design / long-form decisions. Skip for routine coding, small fixes, or anything involving secrets or PII.
clis: claude, codex, gemini
clis-why: Cross-checks a judgment with the OTHER CLIs, so it assumes they are installed.
---

# Multi-AI Review — parallel external-model cross-validation

Pull in Gemini and Codex (OpenAI) in parallel to stress-test an important Claude judgment. Aggregate **agreement / disagreement / new issues** that single-model judgment would miss.

Ported from [gd452/skills/gd-multi-ai-review](https://github.com/gd452/skills/tree/main/gd-multi-ai-review). The original is Korean.

## When to use

| Situation | Run it? |
|---|---|
| Architecture / system design decision | ✅ strongly recommended |
| Long-form artifact draft (spec, business plan, design doc) | ✅ recommended |
| Hard technical choice (model selection, infra picking, framework call) | ✅ recommended |
| Routine coding, typo fixes, small refactors | ❌ overkill |
| Anything containing secrets, internal source, or PII | ❌ forbidden — external models see the brief |

## Prerequisites

- `gemini` CLI on PATH + `GEMINI_API_KEY` (or ChatGPT-style OAuth). See sibling `gemini` skill.
- `codex` CLI on PATH + `OPENAI_API_KEY` (or ChatGPT OAuth).
- If only one is installed, run that side and tell the user the other is missing — don't refuse.

## Workflow

### Phase 1 — write a self-contained brief

External models have no conversation context. The brief must stand alone.

Include:
1. **Subject** — what's being reviewed (URL, file content, or inline excerpt)
2. **Claude's current judgment** — the conclusion / concerns already reached
3. **Question** — soundness / alternatives / what's missed

Save to `reports/multi-ai-review-{YYYYMMDD-HHMM}-{topic-slug}/brief.md`. The slug is 12–30 lowercase-hyphenated chars (e.g. `harness-design-review`, `auth-rewrite-tradeoffs`). Same-day reviews stay distinguishable just from folder names.

**Sensitivity gate (mandatory):** before sending, explicitly ask the user whether the brief contains secrets, internal-only source, or PII. If yes, stop — these go to external providers.

### Phase 2 — dispatch in parallel

Fire both Bash calls in a **single message** with `run_in_background: true`. Sequential calls double the latency.

**Gemini** (stdin):
```bash
cat {brief-path} | gemini -p "{question}" 2>&1 | tee {reports-dir}/gemini.txt
```

**Codex** (must use `--sandbox read-only` + `--skip-git-repo-check`; `-o` captures the final answer):
```bash
codex exec \
  --sandbox read-only \
  --skip-git-repo-check \
  -o {reports-dir}/codex.txt \
  "$(cat {brief-path})

---

{question}"
```

Record the two task IDs. Wait for completion notifications — do not poll.

### Phase 3 — collect

Read both output files when notifications arrive. Failure mapping:

| Symptom | Cause | Action |
|---|---|---|
| `Not inside a trusted directory` | Codex git-repo check | add `--skip-git-repo-check` and retry |
| `auth required` / 401 | expired key | ask user to refresh |
| timeout (>5 min) | brief too large | shrink brief, retry |
| one side fails | transient | proceed with the surviving side, note the gap |

### Phase 3.5 — multi-round debate (optional)

When a single round leaves big unresolved disagreement, expand to 2–3 rounds. User can request, or you auto-propose when verdicts diverge sharply.

- **Round 1**: independent answers (Phases 2–3)
- **Round 2**: re-prompt each with the other's R1 answer included → rebuttal / concession
- **Round 3** (optional): final positions

R2 prompt template:
```
# Round 2 — read the opposing answer and respond.

## Opposing position (summary):
{other model's R1 summary}

## Questions:
1. Where do you agree, and where do you push back?
2. Does any of your position change in light of this?
```

Outputs: `gemini-r{N}.txt`, `codex-r{N}.txt` in the report dir.

### Phase 4 — synthesize

Produce a single synthesis in `{reports-dir}/synthesis.md` covering:

- **Agreement** — points both models converge on
- **Disagreement** — explicit conflicts, with each side's reasoning
- **New issues** — things neither Claude's brief nor the prompt anticipated
- **Recommendation** — your updated judgment, citing which side(s) you weighted and why

Then surface the synthesis to the user. Don't dump the raw model outputs unless asked — the report dir is the audit trail.

## Why this works

Single-model judgment has a known echo-chamber failure mode: a confident wrong answer in the prompt biases its own follow-up reasoning. Parallel independent answers from different model families surface assumptions and blind spots that a single model — including Claude — won't challenge in itself. The multi-round debate is what catches assumptions that survive round 1 but break under cross-examination.

## Out of scope

- **Secrets / PII / internal source** — never send to external providers, even for "just a quick check"
- **Routine code edits** — the latency and token cost don't pay back on small changes
- **Production rollout decisions** — this skill informs a judgment; it doesn't replace human sign-off on deploys
