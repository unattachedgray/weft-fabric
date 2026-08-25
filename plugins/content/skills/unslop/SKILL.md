---
name: unslop
description: Remove AI-cliche style from PUBLISHED prose (articles, news, docs pages) and give it a human voice. Use before shipping any public-facing text, or when the user says "unslop", "AI 문체 제거", or complains text "reads like AI". Not for terminal replies, code comments, or commit messages.
---

# Unslop — published prose only

Two halves. The removal half is deterministic — run the linter. The voice half
is judgment — apply the checklist while rewriting. Adapted from pstack
(Lauren Tan, cursor/plugins) and mattpocock/skills (MIT); Korean lexicon is
ours, grown from our own output.

## 1. Run the linter (deterministic, no model call)

```bash
python3 "$(dirname "$0")/scripts/unslop-lint.py" <files>     # from the skill dir
python3 ~/.claude/skills/unslop/scripts/unslop-lint.py FILE.html   # stable path
```

- Default: findings + exit 1 → treat as a gate for articles and /doc/ pages.
- `--report` never fails the build (use for news, where volume is daily).
- `--stats` over a corpus shows which lexicon entries actually fire. **An entry
  that never fires is a prune candidate; a cliche you keep seeing that isn't
  listed gets added.** The lexicon lives in the script, one place.

Fix every finding by rewriting, not by synonym-swapping: cut puffery and state
what happened; replace "serves as/stands as/boasts" with is/has; break
"not just X but Y" into the point itself; kill em dashes with periods or commas.

Owner's rulings (2026-08-23), encoded in the linter:
- **Exempt**: quote-attribution lines (start with a dash); short heading/label
  lines (≤45 chars de-tagged); <table> and <blockquote> content; text inside
  quote marks on a line (「」 『』 “” "" '') — someone else's words keep their
  punctuation, including cited headlines and book titles; digit·digit dates
  (3·1 운동, 5·16, 12·12 — that 가운뎃점 IS the standard orthography); official
  proper names in the KDOT_PROPER allowlist (기념·도서관, 제재·부과금 — grow it
  only with a verified official form). HTML entities (&mdash; &middot;) are
  decoded first — the entity is the same tell as the character.
- **Flagged**: mid-sentence dashes in prose, and **가운뎃점(·/ㆍ) in prose** —
  LLM Korean uses · as a comma substitute; rewrite to 쉼표, 와/과, or restructure
  (배우·소품·생애권 → 배우, 소품, 생애권; Russell·Kilmer → Russell과 Kilmer).

## 2. Add voice (articles and blog only — never news)

- Have opinions: react to facts instead of neutrally listing pros and cons.
- Vary rhythm: short sentences, then longer ones. Uniform cadence reads machine-made.
- Acknowledge complexity: "impressive but also unsettling" beats "impressive".
- Be specific: not "this is concerning" but the concrete image that concerns.
- First person is allowed where the page has an author's voice.
- Let some mess in. Perfect parallel structure is a tell.

News keeps a neutral register: apply the removal half only.

## 3. Self-audit

Before shipping, ask once: "what makes this obviously AI-generated?" and fix
what you find, even if the linter is clean — the linter catches the lexicon,
not the register.
