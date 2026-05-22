"""
LLM API Benchmark refresher.

Three-stage pipeline:
  1. Extract: Gemini Flash-Lite scrapes pricing pages → structured JSON.
  2. Validate: each extracted model name must appear verbatim on the source page,
     and prices must fall in plausible ranges. Anti-hallucination gate.
  3. Generate: Claude Haiku 4.5 rewrites references/benchmark.md from validated data.

Environment:
  GOOGLE_API_KEY    — Google AI Studio key (stage 1)
  ANTHROPIC_API_KEY — Anthropic key (stage 3)

Usage:
  python scripts/update_benchmark.py
  python scripts/update_benchmark.py --dry-run

Architecture ported from gd452/skills/gd-api-select. This is a scaffold —
flesh out the PRICING_SOURCES dict and PRICE_RANGES bounds before running
in production.
"""

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

BENCHMARK_PATH = Path(__file__).parent.parent / "references" / "benchmark.md"
WARNINGS_PATH = Path(__file__).parent.parent / ".benchmark_warnings.json"
PRICING_DATA_PATH = Path(__file__).parent.parent / ".benchmark_pricing_data.json"

PRICING_SOURCES = {
    "gemini": "https://ai.google.dev/gemini-api/docs/pricing",
    "claude": "https://docs.claude.com/en/docs/about-claude/models/overview",
    "openai": "https://openai.com/api/pricing/",
    "deepseek": "https://api-docs.deepseek.com/quick_start/pricing",
}

PRICE_RANGES = {
    "input_per_1m": (0.0, 100.0),
    "output_per_1m": (0.0, 500.0),
    "batch_input": (0.0, 100.0),
    "batch_output": (0.0, 500.0),
}


def fetch_pricing_pages() -> dict[str, str]:
    import requests
    from bs4 import BeautifulSoup

    headers = {"User-Agent": "Mozilla/5.0 (compatible; llm-api-pricing-refresher/1.0)"}
    out = {}
    for name, url in PRICING_SOURCES.items():
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for el in soup(["script", "style", "noscript"]):
            el.decompose()
        out[name] = soup.get_text(separator="\n", strip=True)
    return out


def extract_with_gemini(pages: dict[str, str]) -> dict:
    """Stage 1: structured JSON extraction. Use Gemini Flash-Lite — free tier covers this."""
    from google import genai

    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    schema_hint = (
        "Return JSON: {provider: [{model, input_per_1m, output_per_1m, "
        "batch_input, batch_output, free_tier_notes}]}. Numbers only for prices. "
        "If a price isn't listed, use null. Do not invent model names."
    )
    result = {}
    for provider, text in pages.items():
        prompt = f"Extract pricing for {provider} from this page:\n\n{text[:50000]}\n\n{schema_hint}"
        resp = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        result[provider] = json.loads(resp.text)
    return result


def validate(extracted: dict, pages: dict[str, str]) -> tuple[dict, list[str]]:
    """Stage 2: drop any model whose name doesn't appear in its source page or whose
    prices fall outside plausible ranges. Return (cleaned_data, warnings)."""
    warnings = []
    cleaned = {}
    for provider, payload in extracted.items():
        page_text = pages.get(provider, "")
        kept = []
        for row in payload.get(provider, []):
            name = row.get("model", "")
            if not name or name not in page_text:
                warnings.append(f"{provider}: model '{name}' not verbatim in source page — dropped")
                continue
            ok = True
            for field, (lo, hi) in PRICE_RANGES.items():
                v = row.get(field)
                if v is not None and not (lo <= v <= hi):
                    warnings.append(f"{provider}: {name} {field}={v} out of range [{lo}, {hi}] — dropped")
                    ok = False
                    break
            if ok:
                kept.append(row)
        cleaned[provider] = kept
    return cleaned, warnings


def generate_with_claude(validated: dict) -> str:
    """Stage 3: Claude Haiku rewrites benchmark.md from validated data."""
    import anthropic

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    today = date.today().isoformat()
    prompt = (
        "Rewrite the LLM API benchmark markdown using only the validated pricing data below. "
        f"Set 'Last updated' to {today}. Preserve the existing structure of the file "
        "(at-a-glance table, free tiers, cost-reduction levers, per-task tables, code snippets). "
        "Use only models present in the data; do not invent rows.\n\n"
        f"Validated data:\n{json.dumps(validated, indent=2)}"
    )
    resp = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Stop after validation, print warnings")
    args = parser.parse_args()

    pages = fetch_pricing_pages()
    extracted = extract_with_gemini(pages)
    PRICING_DATA_PATH.write_text(json.dumps(extracted, indent=2), encoding="utf-8")

    validated, warnings = validate(extracted, pages)
    WARNINGS_PATH.write_text(json.dumps(warnings, indent=2), encoding="utf-8")
    if warnings:
        print("Validation warnings:", file=sys.stderr)
        for w in warnings:
            print(f"  - {w}", file=sys.stderr)

    if args.dry_run:
        print(f"Dry run — wrote {PRICING_DATA_PATH} and {WARNINGS_PATH}")
        return

    rewritten = generate_with_claude(validated)
    BENCHMARK_PATH.write_text(rewritten, encoding="utf-8")
    print(f"Wrote {BENCHMARK_PATH}")


if __name__ == "__main__":
    main()
