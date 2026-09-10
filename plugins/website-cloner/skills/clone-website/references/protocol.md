# Agent protocol

Applies to the three sub-agents in Claude Code (`extractor`, `builder`, `comparator`) and to any CLI running the phases inline: the same inputs, the same outputs, the same summary shape the scripts print.

## Input

One JSON object in the prompt:

```json
{ "workspace": "/abs/path", "target_url": "https://…", "section": "03-astro-islands", "stack": "html", "notes": "hero is scroll-driven; see qa/report.md band 7" }
```

`workspace` and `target_url` are required. `section` is required for builder/comparator. `notes` carries the orchestrator's fix targets on a re-dispatch (top 2–5 deltas from the comparator, plus the report path). Missing required input → `STATUS: failed` with one root-cause line.

## Output

1. **Files in the workspace** — the deliverable. Never return file bodies.
2. **A summary ≤ 300 words**, exactly this shape (the scripts print the same):

```
STATUS: ok | partial | failed
WORKSPACE: <abs path>
WROTE:
  - <relative path> (<size or count>)
KEY_FINDINGS:
  - <2–6 one-line bullets>
WARNINGS: none | <list>
NEXT: <one sentence: what to dispatch or check next>
```

`ok` = everything requested exists. `partial` = deliverable exists with caveats the orchestrator must read. `failed` = deliverable missing or unusable; a file in `errors/` explains why.

## Rules

- Read and write inside the workspace only (plus the target project directory for builders).
- Never dispatch other agents; only the skill orchestrates.
- Detailed logs go to `workspace/agent-log-<name>-<timestamp>.md`, not into the summary.
- A builder returns only after its file compiles / the build passes; a comparator returns only after the diff artifacts exist.
- Re-dispatch a builder with `notes` at most 3 times per section; the fourth failure is a residual.

## Builder contract (what every builder receives inline)

- the full spec text, the screenshot paths, the target file path, the stack;
- which shared pieces to import (tokens, icons, primitives);
- the hooks to emit: `data-clone-section`, `data-clone-interaction`, `data-clone-controlled`;
- the rule: measured values reproduced, real assets, verbatim text, working interactions, no source fingerprints, no hotlinks.

## Comparator contract

Runs `compare.js --sections <index>` and `check.js` and reads `qa/report.json`; returns pass/fail, the worst band, the top element deltas, and the diff image path in `KEY_FINDINGS`. Diagnoses only; the builder fixes.
