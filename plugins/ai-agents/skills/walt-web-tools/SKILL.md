---
name: walt-web-tools
description: Auto-discover and reuse browser automation "tools" for any website using WALT (Salesforce Web Agents that Learn Tools). Use when the user wants to repeatedly interact with a specific website — scrape data, fill forms, search listings, book things, navigate flows — and would benefit from a reusable, parameterized tool definition rather than recomputing the click-path every session. Especially valuable when a `walt-tools/` directory already exists in cwd, or when the same site will be hit many times. For one-shot browser tasks, prefer the `browser` skill instead.
---

# WALT — Web Agents that Learn Tools

WALT (Salesforce AI Research, [arxiv:2510.01524](https://www.arxiv.org/abs/2510.01524)) lets an LLM agent **discover reusable tools from any website**. Point it at a site once, and it produces JSON tool definitions (with deterministic + agentic steps) that any future agent run can invoke parameterically — no need to re-explore the DOM every session.

Repo: [SalesforceAIResearch/WALT](https://github.com/SalesforceAIResearch/WALT). License: MIT.

## When to use

| Situation | WALT? |
|---|---|
| Repeated automation on the same site (scrape listings weekly, monitor prices, fill forms) | ✅ — discover once, reuse forever |
| Building a Claude-Code-native MCP for a site (`walt serve` exposes tools over MCP) | ✅ — its sweet spot |
| Site needs login, you can capture a Playwright `storage_state.json` | ✅ — use `--auth-file` |
| One-shot scrape, never again | ❌ — use `/browser` (Chrome extension) or `curl`/`requests` |
| Site has a real API (REST/GraphQL) | ❌ — the API is more stable than DOM selectors |
| Site behind heavy bot detection (Cloudflare, etc.) | ⚠️ — try, but be ready to fall back |

## Installation check

```bash
walt --version || {
  echo "WALT not installed. Install with:"
  echo "  uv venv && source .venv/bin/activate"
  echo "  uv pip install sfr-walt"
  echo "  playwright install chromium"
  echo "  walt init   # creates .env with API key slots"
}
```

WALT needs an LLM API key (OpenAI / Anthropic / Google — `walt init` scaffolds `.env`). Default model is `gpt-5-mini`; override with `--llm`.

## Decision tree

Ask: **do I already know what tool I need?**

- **Yes, one specific thing** → `walt generate` (fast, focused, single tool)
- **No, explore the site** → `walt discover` (slow, broad, many tools)
- **I have a human demo I want to replay** → `walt record` (one-shot recording)

Ask: **does the site require login?**

- **No** → omit `--auth-file`
- **Yes** → capture a Playwright `storage_state.json` first (see "Auth pattern" below) and pass `--auth-file .auth/state.json`

## Core workflows

### 1. Generate one focused tool (most common)

```bash
walt generate \
  --url https://zillow.com \
  --goal "Search for homes with filters (location, price range, bedrooms)" \
  -o walt-tools/zillow/
```

Output: `walt-tools/zillow/search_homes.json` (or similar) with input schema + steps.

### 2. Discover all tools on a site (exploratory)

```bash
walt discover --url https://example.com --output walt-tools/example/ --max-processes 8
```

This is slow (minutes to hours) and burns a lot of LLM tokens. Use sparingly — usually you want `generate` for the 2-3 things you actually need.

### 3. Record a human demo

```bash
walt record https://example.com --name book_appointment
```

Chromium opens — perform the flow once. WALT converts it into a parameterized tool.

### 4. Run an agent with the tools

```bash
walt agent "find the cheapest 2-bedroom in Austin" \
  --tools walt-tools/zillow/ \
  --start-url https://www.zillow.com \
  --llm gpt-5-mini \
  --max-steps 50
```

Use `--save-gif kayak_search.gif` to record the run as an animated GIF (useful for debugging tool quality).

### 5. Serve tools over MCP (the integration sweet spot)

```bash
walt serve walt-tools/zillow/ --port 8000
```

Then add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "zillow": {
      "command": "walt",
      "args": ["serve", "walt-tools/zillow/", "--stdio"]
    }
  }
}
```

(Use `--stdio` if MCP client expects stdio rather than HTTP; check `walt serve --help` for your version.)

Now Claude Code's MCP layer can invoke `zillow.search_homes(...)` like any other MCP tool — no per-session DOM re-discovery.

## Tool format

WALT tools are JSON with two kinds of steps:

```json
{
  "name": "search_products",
  "description": "Search for products on the site",
  "inputs": {
    "query": {"type": "string", "description": "Search query", "required": true}
  },
  "steps": [
    {"type": "navigation", "url": "https://example.com"},
    {"type": "input", "cssSelector": "#search-box", "text": "{query}"},
    {"type": "click", "cssSelector": "#search-button"},
    {"type": "extract_page_content", "goal": "Extract search results"}
  ]
}
```

- **Deterministic steps** — `navigation`, `click`, `input`, `select_change`, `key_press`, `scroll`. Fast, cheap, no LLM call.
- **Agentic steps** — `extract_page_content`, `wait_for_page_load`. Use an LLM to interpret the page; slower, costs tokens.

When fixing a broken tool: prefer adding more deterministic steps, only fall back to agentic when the page genuinely needs interpretation.

## Auth pattern (login-required sites)

WALT itself doesn't log in for you. Capture a Playwright session first:

```python
# capture_auth.py
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    ctx = browser.new_context()
    page = ctx.new_page()
    page.goto("https://example.com/login")
    input("Log in manually, then press Enter…")
    ctx.storage_state(path=".auth/state.json")
    browser.close()
```

Then:

```bash
walt generate --url https://example.com --goal "..." --auth-file .auth/state.json
walt agent "..." --tools walt-tools/example/ --auth-file .auth/state.json
```

`.auth/state.json` is sensitive — gitignore it.

## Cost / speed tradeoffs

| Knob | Effect |
|---|---|
| `--llm gpt-5-mini` (default) | cheap, good for routine discovery |
| `--llm gpt-5` | better tool quality on complex pages, ~10× cost |
| `--llm gemini-2.5-flash` | cheapest, free tier available |
| `--max-processes N` | parallel exploration during `discover`; raise for speed, lower for rate-limited sites |
| `discover` vs `generate` | discover = minutes-hours + many tools; generate = ~1-3 min + one tool |
| `--headless` (on `walt agent`) | faster but harder to debug; off when iterating |

## Failure modes & fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Tool clicks the wrong element | CSS selector changed | Re-run `walt generate` with same goal; or hand-edit the JSON |
| `extract_page_content` returns garbage | Page is JS-heavy and not loaded yet | Insert `{"type": "wait_for_page_load"}` before extraction |
| 403 / Cloudflare challenge | Bot detection | Use authenticated `--auth-file` session; or fall back to `/browser` extension which uses real Chrome |
| Login expires mid-run | `storage_state.json` is stale | Re-capture auth |
| Agent loops forever | Goal too ambiguous | Tighten the goal string; add `--max-steps 30` |

## Relationship to other skills

- **`/browser`** (`frontend` plugin) — one-shot Chrome-extension automation. Use for ad-hoc browsing where building a reusable tool isn't worth it.
- **`mcp-development`** (`claude-stack` plugin) — for understanding the MCP server that `walt serve` exposes.
- **`advanced-agents`** (this plugin) — broader multi-agent / computer-use patterns; WALT is the "give the agent reusable web tools" piece.

## Where to keep tools in a project

```
your-project/
  walt-tools/
    zillow/
      search_homes.json
      view_property.json
    airbnb/
      search_listings.json
  .auth/
    state.json   # gitignored
  .mcp.json      # points at walt serve for each site
```

Commit `walt-tools/` — they're the artifact. Gitignore `.auth/`.
