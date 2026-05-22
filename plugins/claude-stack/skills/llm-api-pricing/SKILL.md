---
name: llm-api-pricing
description: Bundled LLM API pricing reference for picking models by task and computing usage costs. Use when the user asks "which model should I use for X", "how much does Y cost", "what's the cheapest model for translation / summarization / image gen / OCR / TTS / transcription", or when implementing per-request cost tracking. Reads from `references/benchmark.md` (refreshed monthly via the bundled pipeline) — does NOT guess prices from training data.
allowed-tools: Read, Glob, WebSearch, WebFetch, Bash
---

# LLM API Pricing — model selection + cost tracking

Self-contained pricing reference. Use it to pick a model for a task and to wire usage-based cost tracking into code. The `references/benchmark.md` file is the source of truth — its refresh pipeline is bundled, so the data stays current without external dependencies.

Architecture borrowed from [gd452/skills/gd-api-select](https://github.com/gd452/skills/tree/main/gd-api-select).

## Triggers

Use this skill when any of:
- **Engine selection** — "which model should I use for {task}"
- **Price lookup** — "what does {model} cost per token / per image / per minute"
- **Cost-tracking implementation** — extract usage, compute spend, accumulate

Skip for: prompting / fine-tuning / output-format questions (those belong to `senior-prompt-engineer` or `claude-api`).

## Procedure

### A. Engine selection

1. Clarify the task: translation, summarization, image generation, audio transcription, OCR, TTS, etc.
2. Read `references/benchmark.md` and find the task section.
3. Check the "value pick" vs "quality pick" recommendation and the free-tier column.
4. Share the plan with the user — get approval before writing integration code.

### B. Price lookup / cost tracking

1. Look up the model's per-unit price in `references/benchmark.md`.
2. If the project already has a price constant, reconcile against the benchmark — update if stale.
3. Wire usage extraction. SDK-specific patterns:

   **Anthropic Python SDK:**
   ```python
   resp = client.messages.create(...)
   usage = resp.usage  # input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
   cost = (usage.input_tokens * PRICE_IN + usage.output_tokens * PRICE_OUT) / 1_000_000
   ```

   **OpenAI Python SDK:**
   ```python
   resp = client.responses.create(...)
   usage = resp.usage  # input_tokens, output_tokens
   cost = (usage.input_tokens * PRICE_IN + usage.output_tokens * PRICE_OUT) / 1_000_000
   ```

   **Google Gemini Python SDK:**
   ```python
   resp = client.models.generate_content(...)
   usage = resp.usage_metadata  # prompt_token_count, candidates_token_count
   cost = (usage.prompt_token_count * PRICE_IN + usage.candidates_token_count * PRICE_OUT) / 1_000_000
   ```

4. Accumulate per request to a JSON ledger (file or DB), tagged by `model`, `request_id`, `feature`. This gives per-feature spend visibility — the most common ask after "what does X cost".

### Freshness check

If `references/benchmark.md` is more than 3 months old, either:
- Run `scripts/update_benchmark.py` (requires `GOOGLE_API_KEY` + `ANTHROPIC_API_KEY`)
- Or WebSearch the provider's pricing page directly and update the relevant rows in `benchmark.md` by hand

A monthly GitHub Action template is in `scripts/update-benchmark.yml.example` — copy it into your `.github/workflows/` to automate.

## The 3-stage refresh pipeline (architecture)

The bundled refresh is deliberately three stages because LLM-based extraction hallucinates model names if left unchecked.

1. **Extract** — Gemini Flash-Lite scrapes 4 provider pricing pages (Gemini, Claude, OpenAI, DeepSeek) and emits structured JSON. Cheap (~$0 with the free tier).
2. **Validate** — cross-reference each extracted model name against the source HTML and sanity-check price ranges. Any model that doesn't appear verbatim on the source page is dropped. This is the anti-hallucination gate.
3. **Generate** — Claude Haiku 4.5 takes the validated JSON and rewrites `references/benchmark.md`. ~$0.06 per run.

The split matters: a single-pass "scrape and rewrite" hallucinates ~10% of rows. The separate validation pass between extract and generate kills almost all of those.

## Why bundle, not fetch live

- Pricing pages reformat constantly — a runtime scraper breaks at the worst moment
- Most provider pricing pages are heavily JavaScript-rendered — fragile to parse
- Monthly cadence is the right granularity: providers change prices ~quarterly, model lineups ~monthly
- A bundled markdown file is greppable and reviewable; a runtime tool call is not
