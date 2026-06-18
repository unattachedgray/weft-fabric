---
name: research-first
description: Use before executing a serious or novel task — check the knowledge wiki for prior research first, then research multi-source (GitHub/Reddit/official docs) and bank the distilled findings, labeled.
---

# Research-First

Before executing a **serious or novel** task (a real feature, an architecture decision, adopting a
new tool/library, anything you'd otherwise guess at), run this loop — it compounds: each pass makes
the next one cheaper.

**Where it lives:** the one LLM wiki at `~/.hermes/weftbase/default/wiki/*.md` (plain markdown,
`kind: wiki` + `tags:` frontmatter). Claude Code reads/writes it **directly** (filesystem) — label
research notes with the **`research`** tag so they're discernable from personal notes (that label is
what lets both live in one wiki). Check existing research with
`grep -rli '<topic>' ~/.hermes/weftbase/default/wiki/` (or the grounded-RAG `/api/wiki/ask`).

## 1. Check the wiki FIRST
Grounded-RAG ask the LLM wiki (`/api/wiki/ask`) for the topic, filtered to the **research/technical**
label (or read the bootstrap seed `weft/docs/research-bank.md`). If it's covered, start from the
banked conclusions + sources — **do not re-research**.

## 2. On a miss, research multi-source (not one source, not your priors)
Sweep in parallel, then keep the conclusions, not the dumps:
- **GitHub** — reference implementations; copy the proven version, don't reinvent it.
- **Reddit / HN / forums** — real-world gotchas, what breaks, what people actually use.
- **Official docs / specs** — authoritative behavior.

Prefer primary / high-signal sources over SEO spam. Delegate to parallel sub-agents for breadth.

## 3. Bank the distilled findings — LABELED
*Distill, don't dump.* Write a tight note into the one LLM wiki, **labeled `research`/`technical`**
(so it's discernable from personal notes — that label is what lets the two live in one wiki):
the question · the load-bearing findings · the top primary sources · **what you built from it**.
`[[link]]` related notes; date-stamp it.

## 4. Execute, then mature
Build from the banked research. Periodically **elevate / mature / distill** the accumulating
research notes — the same Raw → Wiki → Schema move the personal wiki uses (Karpathy's compounding
LLM-wiki, here covering technical knowledge too).

**Governor:** distill not dump; re-verify before relying (sources drift, so date-stamp); the human
prunes. Skip this loop for trivial/known tasks — it's for the serious, novel, or guess-prone ones.
