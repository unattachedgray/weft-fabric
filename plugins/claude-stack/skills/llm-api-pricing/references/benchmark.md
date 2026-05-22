# LLM API Benchmark

> **Status:** placeholder — populate by running `scripts/update_benchmark.py` or edit by hand.
> **Last updated:** never (initial scaffold)

This file holds per-task model recommendations and pricing. The skill's `SKILL.md` reads from this file to answer model-selection and cost-tracking questions.

The structure below is the contract — fill in the rows when you refresh.

## At a glance

| Task | Value pick | Price | Quality pick | Price |
|---|---|---|---|---|
| Text translation | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Text summarization | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Image generation | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Audio transcription | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Text-to-speech | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Image analysis / OCR | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Free tiers

| Provider | Free quota |
|---|---|
| Google AI Studio | Gemini Flash / Lite free |
| OpenAI | _TBD_ |
| Anthropic | _TBD_ |
| DeepSeek | _TBD_ |

## Cost-reduction levers

- **Batch API** — most providers offer ~50% off for async batch processing.
- **Prompt caching** — up to ~90% off on repeated prompt prefixes (Anthropic, OpenAI, Gemini all support this; pricing differs).
- **Model downgrade** — Flash Lite / mini-tier models for routine tasks; reserve flagship models for hard ones.
- **Single-call composition** — OCR + translate in one call is cheaper than chaining two specialist models.

---

# Detailed per-task tables

## Text translation

| Model | $/1M tokens (in → out) | Quality | Latency | Free tier |
|---|---|---|---|---|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Text summarization

| Model | $/1M tokens (in → out) | Quality | Context | Free tier |
|---|---|---|---|---|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Image generation

| Model | $/image | Quality | Resolution | Free tier |
|---|---|---|---|---|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Audio transcription

| Model | $/minute | Quality | Free tier |
|---|---|---|---|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Text-to-speech

| Model | Price | Quality | Free tier |
|---|---|---|---|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Image analysis / OCR

| Model | $/image | Quality | Free tier |
|---|---|---|---|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

---

# Cost-tracking code snippets

## Anthropic Python SDK

```python
import anthropic

client = anthropic.Anthropic()
resp = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    messages=[{"role": "user", "content": "..."}],
)

PRICE_IN_PER_1M = 15.00   # update from benchmark
PRICE_OUT_PER_1M = 75.00  # update from benchmark
usage = resp.usage
cost = (usage.input_tokens * PRICE_IN_PER_1M + usage.output_tokens * PRICE_OUT_PER_1M) / 1_000_000
```

## OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI()
resp = client.responses.create(model="gpt-4o-mini", input="...")

PRICE_IN_PER_1M = 0.15
PRICE_OUT_PER_1M = 0.60
usage = resp.usage
cost = (usage.input_tokens * PRICE_IN_PER_1M + usage.output_tokens * PRICE_OUT_PER_1M) / 1_000_000
```

## Google Gemini Python SDK

```python
from google import genai

client = genai.Client()
resp = client.models.generate_content(model="gemini-2.5-flash", contents="...")

PRICE_IN_PER_1M = 0.30
PRICE_OUT_PER_1M = 2.50
usage = resp.usage_metadata
cost = (usage.prompt_token_count * PRICE_IN_PER_1M + usage.candidates_token_count * PRICE_OUT_PER_1M) / 1_000_000
```
