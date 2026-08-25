---
name: diagnostic-loop
description: Build a measurement loop you can trust before hunting a bug. Use when a symptom is reported that you cannot yet reproduce or measure — especially visual, timing, or intermittent ones, or any bug where your first sensor came back empty.
---

# Diagnostic Loop

For hunting a defect, not for deciding an adoption (that is `flywheel-audit`).

The failure this exists to prevent: **an unvalidated instrument returns silence,
you read silence as absence, and you spend the session building more sensitive
versions of the same wrong instrument.** Iteration speed makes that worse, not
better. Validity comes before cadence.

## Step 0 — Can the user reproduce it and you cannot?

Then the harness IS the task. Build injection/observation first, before any
hypothesis. Do not ask them to reproduce it more than once; a second ask means
you are the bottleneck (`AGENTS.md` → Iterate Independently).

State what the harness will consume — screen, keyboard, machine, quota — before
you run it. A loop that occupies the user's desktop is not free.

## Step 1 — Name the observable, in units

What changes, measured in what, at what resolution?

| symptom | valid observable | classic wrong choice |
|---|---|---|
| visual flicker / jump | pixels, frames, geometry | DOM mutations (reflow mutates nothing) |
| "it's slow" | wall-clock at the boundary | log lines |
| intermittent failure | event log with timestamps | a snapshot after the fact |
| state is wrong | the store, read directly | the rendered view |

If the observable sits a layer away from what the user perceives, it cannot see
their symptom. Sampling rate must beat the phenomenon: two writes inside one
frame are invisible to a per-frame sampler *by construction*.

## Step 1a — Ten ways to build the loop (pick the highest that reaches the bug)

A menu, in rough order of preference (adapted from mattpocock/skills
`diagnosing-bugs`, MIT). Spend disproportionate effort here; a tight loop is
most of the fix.

1. **Failing test** at whatever seam reaches the bug — unit, integration, e2e.
2. **Curl/HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** asserting on DOM/console/network.
5. **Replay a captured trace** — save a real payload/event log, replay it through the code path in isolation.
6. **Throwaway harness** — a minimal subset (one service, mocked deps) exercising the bug path in one call.
7. **Property/fuzz loop** — for "sometimes wrong output", 1000 random inputs, look for the failure mode.
8. **Bisection harness** — if the bug appeared between two known states, automate "boot at X, check" so `git bisect run` works.
9. **Differential loop** — same input through old vs new (or two configs), diff outputs.
10. **Structured HITL script** — last resort; if a human must click, drive *them* with a script so the loop stays structured and its output feeds back.

Then **tighten it**: faster (cache setup, narrow scope), sharper (assert the
specific symptom, not "didn't crash"), more deterministic (pin time, seed RNG,
freeze network). A 2-second deterministic loop is a superpower; a 30-second
flaky one is barely better than none. Non-deterministic bugs: raise the
reproduction *rate* (loop the trigger 100×, parallelise, stress, narrow timing).

**Completion criterion:** you can name one command — a script path, a test
invocation, a curl — that you have already run at least once and seen go red
on *this* bug. Until then, Step 1 is not done. The steps below then make that
loop *trustworthy*; a red loop wired to the wrong code is still a false sensor.

## Step 1b — Prove the sensor is WIRED to the right code, not just honest

Controls prove an instrument is honest about what it watches. They cannot tell
you it watches the right thing. Establish coverage from the code, not from
memory:

- Enumerate every writer/path with a **semantic query**, not a guess —
  `codebase-memory` MCP (`search_graph`, `query_graph`, `trace_path`) or, at
  minimum, `git grep` for every mutation site of the thing you measure.
- List them explicitly, then state which your sensor observes. Pass the gap to
  `sensor-kit` as `coverage.unobserved` — a run with a known-unwatched writer
  **refuses to report**, because a null cannot eliminate a path nobody watched.
- Re-run the query when the hypothesis moves. A sensor aimed at yesterday's
  suspect is a confident source of false negatives.

Worth the 30 seconds: in the worked example below, "what writes
`textarea.style.height`" would have returned **two** sites — a `useLayoutEffect`
*and* an inline `onCompositionEnd` handler. Only one was ever instrumented, and
the other was the one running per Korean syllable.

## Step 2 — Controls, before any hypothesis

A sensor must rule on the outcome **either way**. Four cells, two controls:

|                | phenomenon present | phenomenon absent |
|----------------|--------------------|-------------------|
| sensor fires   | true positive      | **false positive** ← negative control |
| sensor silent  | **false negative** ← positive control | true negative |

- **Positive control** — make the instrument fire on a known real instance,
  reached **through the real path**. Validating an IME sensor with synthetic
  input events validates nothing, because the real path is the one you skipped.
- **Negative control** — prove it stays silent when the phenomenon is absent.
  This is what makes a later null mean something.

**Both controls, or a null is uninterpretable.** `sensor-kit.js` in this
directory enforces it: `report()` throws unless both passed, and it keeps
re-checking the wiring during the run — a node replaced by a re-render, a page
reload, or a lapsed precondition **taints the window** rather than quietly
degrading into a false negative.

Why this specific rigour is worth it: **a trustworthy negative is the only
thing that lets you eliminate an avenue.** Without one you cannot bisect, so
you are reduced to trying every hypothesis until one happens to work. That is
not a loop, it is a lottery.

## Step 2b — Pre-register the decision rule

Write the falsifiable prediction **before** the run: *"if the composer is the
cause, writes > 0."* `sensor-kit`'s `expect(claim, predicate)` requires it and
returns CONFIRMED / REFUTED rather than a bare number. Deciding what a number
would mean after seeing it is how five plausible fixes shipped against an
un-localised cause.

## Step 3 — Preconditions as gates

Encode every assumption so a violated run **aborts** instead of printing a
plausible number: liveness/heartbeat, required mode, cleared state, focus,
and `sent == received`. Discipline is what already failed; make the runner
refuse.

## Step 4 — Localize before you change

**Never use a code edit as a probe.** Instruments observe; edits commit — to a
live system, with regression risk, and they poison attribution for every
reading that follows.

Bisect with the detector: disable, stub, or swap components until the signal
moves. Only then change code.

## Step 5 — Report honestly

- Separate **"found a real defect"** from **"fixed the reported symptom"**.
  A verified improvement that does not kill the symptom is *not* the fix; say so
  in the same breath, or the next reader re-litigates it.
- If a change did not kill the symptom, **revert it** unless it stands on its
  own evidence.
- A null result is reported as *"instrument X, validated by control Y, saw
  nothing"* — never as a bare "nothing happened".

## Stop rule

Decide N before you start. After N rounds with no localization, change
**approach** — a different observable, a different layer, or an explicit
"this is below our stack" conclusion. Repeating the same shape at higher
sensitivity is the trap.

## Worked example — the one that produced this skill

Korean-IME flicker, 2026-08-09. Eight rounds, hours, no fix. One error repeated:

- MutationObserver for a *layout* problem → reflow produces no mutations.
- rAF sampler for *intra-frame* style writes → blind by construction.
- Synthetic `input` events for the *IME* branch → never reached it.
- `window.T2 || {}` → turned "sensor missing" into "recorded zero".
- Typed Latin while reporting Korean; box never cleared, so a stale draft
  supplied the "evidence".
- Cached DOM nodes went stale after remount — three separate times.
- One speculative fix ("scrollHeight already knows, skip the collapse") broke
  auto-grow entirely: that textarea computes `overflow-y: visible`, where
  `scrollHeight === clientHeight` always.

What would have collapsed it to one round: a **pixel/frame** detector with a
positive control, then bisecting with it — instead of five code changes shipped
against an un-localized cause.
