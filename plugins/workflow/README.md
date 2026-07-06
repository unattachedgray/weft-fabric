# workflow — project-agnostic development skills

These skills are **layers of one pipeline at different altitudes**, not competitors. Pick by where you are, not by preference.

## When to use which

| You are… | Use | Produces |
|---|---|---|
| Turning a fuzzy idea into a design | **`brainstorming`** | `docs/plans/YYYY-MM-DD-<topic>-design.md` (design doc) |
| Turning a design into an executable plan | **`writing-plans`** | `docs/plans/YYYY-MM-DD-<feature>.md` (TDD, bite-sized) |
| Executing a plan/PRD autonomously | **`build`** | code, story-by-story, with per-story quality gates |
| Making one logical change end-to-end | **`/dev`** | the 7-phase cycle (THINK→…→REFLECT) |
| Changing a high-blast-radius path (auth, migrations, payments) | **`/dev serious`** | 7-phase **+** adversarial review panel **+** Definition-of-Done gate |
| Scaffolding a greenfield app from a sentence | **`app-builder`** | full-stack app from one of 13 stack templates |
| Wanting a focused persona/checklist | **`hats`** | architect · feature-dev · debugger · code-reviewer · security-reviewer |
| QA-ing the skills themselves | **`eval`** | deterministic pass/fail per skill |

**Typical flow for a feature:** `brainstorming` → `writing-plans` → `build` (or `/dev` for a single change).
**Serious work:** run it under `/dev serious`.

## One shared review cast

Adversarial verification is the **same installed agents** everywhere — the `/dev serious` VERIFY panel, `app-builder` Phase 5, and the `hats` heavyweight escalations all use:

- `agent-skills:code-reviewer` — correctness / architecture
- `agent-skills:security-auditor` — the security gate
- `agent-skills:test-engineer` — coverage
- `agent-skills:web-performance-auditor` — web perf

Don't invent per-skill reviewers. `hats` are inline **mindsets**; these agents are the independent **passes**. Same vocabulary, two intensities.

## Conventions

- Plans live in `docs/plans/`. Design docs end `-design.md`; implementation plans don't.
- Size limits are hard: **500 lines/file, 50 lines/function** — split proactively.
- Deterministic-first: if a check can be a script or test, don't eyeball it.
- Layout verification for web UI is centralized in the **`/pretext-layout`** skill — reference it, don't re-specify it.
