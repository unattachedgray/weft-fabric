---
name: session-recall
description: Recall what past sessions learned, from ANY CLI on this machine — the shared weft vault (wiki/procedures, via wrecall/wnote) and the raw Claude Code transcripts (via the session-recall script). Use when the user names a project/tool you have no context for, before re-deriving a decision, or when your own memory layer comes up empty. Also use to WRITE a durable fact back so every other CLI's next session finds it.
---

# Session recall — the shared memory layers on this machine

Per-CLI memory is siloed by vendor and working directory. The layers below are
shared across Claude Code, Codex, Antigravity/Gemini, Cursor, and dsh — every
CLI reads and writes the same files with the same credentials (shared .env).

## 1. Vault first (weft LLM wiki) — cheapest, distilled

```bash
bash ~/dev/weft/scripts/weft/wrecall --brief "<project/topic words>"   # ~25ms, no LLM
bash ~/dev/weft/scripts/weft/wrecall "질문"                            # grounded answer, 8–16s
```

`--brief` answers the only question that matters up front: does the vault
already know this, and in which tier (wiki / procedures / sessions). Spend the
full call only when `--brief` shows there is something to ask for. Answers are
leads to verify, not findings.

## 2. Write back what this session established

```bash
bash ~/dev/weft/scripts/weft/wnote <slug> "본문"                  # upsert '지금 사실'
bash ~/dev/weft/scripts/weft/wnote <slug> --section 기록 --append "- 2026-XX-XX — …"
```

Upsert, not append: the topic page states what is true NOW; narrative goes in
기록. When a session establishes a durable fact about a project, write it —
that is how the next session (of ANY CLI) starts warm instead of blind.

## 3. Raw transcripts — when the vault has nothing

```bash
python3 "$(dirname "$0")/scripts/session-recall" --help
```

Searches every past Claude Code session across every project silo. Memory
files are an index; the transcripts are the corpus. Use it when work was split
across directories and the context lives in another silo.

## Rules

- Do not print secret values these tools may touch; they read shared .env
  files themselves.
- The vault is the durable layer; transcripts are the fallback corpus.
- If resolving a name took more than one command, bank it (wnote) before
  moving on — the lookup gets skipped exactly when you feel certain.
