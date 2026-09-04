---
name: flywheel-audit
description: Decide whether/how to adopt a new tool, library, idea, or pattern. Use before adding a dependency, integrating a service, or committing to an approach — applies flywheel-first criteria and returns a verdict.
---
# Flywheel Audit

Run this before you **adopt, absorb, or build on** any new tool, library, idea, or pattern.
Decide *flywheel-first* — does it compound, or is it just a tool — and let the answer shape
*how* you wire it in. (Background: `AGENTS.md` → The flywheel lens.)

## Step 1 — Is there a flywheel angle? Ask all three
- **(a) Does it already HAVE a compounding loop?** Each use makes the next better.
- **(b) Can we CREATE one as we adopt it?** Instrument its output to feed the next input.
- **(c) Can it IMPROVE a loop we already run?** Cut friction, raise gain, or add a missing governor.

Adopt *because of* a/b/c — and let which one applies decide *how* you integrate it.

## Step 2 — If there's an angle, pressure-test the loop
- **Friction** — what momentum is lost per cycle? Is it removable?
- **Governor** — what's the brake? **An ungoverned reinforcing loop is a reject — add the brake first** (human gate / pruning / safety check / no-auto-merge).
- **Human node** — is the human uniquely needed here, low-effort, and motivated? Keep them at the gate, not in the loop.

## Step 2a — Reject stale wheels

A loop diagram is not evidence that the wheel turns. Trace one real event through every edge:

`signal → durable record → reader → decision → treatment → measured outcome → changed next cycle`

Name the concrete writer and reader at each handoff. A dashboard, log, diagnostic export, report,
or queued recommendation is a **terminal sink** until something consumes it. “An agent can inspect
this later” is still a broken edge when a person must remember to summon the agent.

Treat either condition as a stale wheel:

- the same manual restoration happens twice without automatically entering the learning path; or
- a decision/outcome is recorded but no later cycle reads it to alter detection, treatment, routing,
  prioritisation, or the evidence gathered next time.

When stale, close the smallest missing edge now. Preserve the governor: automate capture, recovery,
dispatch, measurement, and candidate generation; keep novel/destructive/high-stakes adoption behind
review. Define a freshness observable appropriate to the loop, usually **manual interventions per
episode**, **time from signal to verified recovery**, and **repeat rate by incident signature**.
Re-audit after ordinary use: the wheel is performing only when those outcomes improve, not merely
when more artifacts are produced.

## Step 3 — If there's NO angle (the honest fallback)
Still adopt if it's genuinely useful, cheap, and reversible — but as a **plain tool, honestly labelled**. Don't fake a loop; don't reject a useful thing just for lacking one.

## Step 4 — Always check fit
Highest layer that hosts it · reversible · respects the project's rules.

## Verdict — pick one, with one line of why (tied to a/b/c), the traced loop, and its freshness observable
**adopt+absorb · use-don't-absorb · borrow-the-pattern · adopt-as-plain-tool · skip**
