---
name: pdf-ops
description: Reorder, merge, split, rotate, and stamp PDF pages.
license: MIT
metadata:
  hermes:
    tags: [pdf, documents, page-ops]
    category: productivity
    related_skills: [pdf, infographic]
---
# PDF Ops Skill

Deterministic structural operations on PDF pages — merge, split, extract, delete,
rotate, reorder, and text-stamp — via a single `bun` script. Output lands in the
shared Weft workspace so the result opens directly in the dashboard's visual PDF
editor.

## When to Use

Use for **structural page operations** on existing PDFs: combining files, pulling
or dropping page ranges, fixing rotation, reordering, or stamping a watermark.

Do **not** use this for text/table **extraction**, **OCR**, form-filling, or
building a PDF from scratch — use the `pdf` skill for those. This skill never reads
page *content*; it only rearranges and annotates pages.

## Prerequisites

- `bun` on PATH (Weft ships it at `~/.bun/bin/bun`).
- Dependencies are vendored in this skill dir (`@cantoo/pdf-lib`); no install step.
- Output defaults to `~/.hermes/weft/pdf/` (override with `WEFT_PDF_DIR` or `-o`).

## How to Run

Run the script with `bun` via the `terminal` tool. Each command prints the
absolute output path on stdout — surface that path verbatim in your reply so the
chat renders a `PdfCard` linking to the editor.

```bash
bun ~/.claude/skills/pdf-ops/scripts/pdf_ops.ts <verb> [args]
```

## Quick Reference

| Verb | Form | Notes |
|---|---|---|
| `info` | `info <file>` | JSON: page count, sizes, rotations, title |
| `merge` | `merge <a.pdf> <b.pdf> [...]` | concatenate, in order |
| `split` | `split <file> [--out-dir DIR]` | one file per page |
| `extract` | `extract <file> <pages>` | keep only these pages |
| `delete` | `delete <file> <pages>` | drop these pages |
| `rotate` | `rotate <file> <pages\|all> <deg>` | deg ∈ 90, 180, 270, -90 (additive) |
| `reorder` | `reorder <file> <order>` | full 1-based permutation, e.g. `3,1,2` |
| `stamp` | `stamp <file> "<text>" [--pages all] [--pos bottom-right] [--size 24] [--opacity .35]` | text watermark |

`<pages>` is a 1-based spec: `"1,3,5-8"` or `"all"`. Add `-o OUT` to any verb to
choose the output path.

## Procedure

1. If unsure of the page layout, run `info <file>` first to read page count and
   current rotations.
2. Run the verb. Page numbers are **1-based** and match what the user sees.
3. Read the printed output path and include it in your reply (e.g. "Saved →
   `~/.hermes/weft/pdf/20260528-...-merge-report.pdf`"). The chat turns
   that path into a card with an "Open in editor" button.
4. Chain ops by feeding one command's output path into the next.

## Pitfalls

- `reorder` requires a **complete** permutation of all pages — a partial list
  errors. To move a few pages, compute the full new order first.
- `rotate` is **additive** and normalized mod 360 — rotating 90° twice yields 180°.
- `delete` refuses to remove every page.
- Operations never modify the source file; they always write a new file.

## Verification

```bash
bun ~/.claude/skills/pdf-ops/scripts/pdf_ops.ts info <output>   # confirm page count
cd ~/.claude/skills/pdf-ops && bun test                          # unit tests
```
