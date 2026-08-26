---
name: reddit-research
description: Research a technical question on Reddit through the owner's own logged-in browser, at a human pace, and return distilled findings with the load-bearing caveats. Use when a question is about practitioner experience — what settings people actually use, what broke for them, which tool won — rather than documentation.
---
# Reddit research

Reddit holds a class of knowledge that documentation does not: what people who
actually ran the thing found out. Settings they measured, the workflow that was
quietly broken, the correction in the comments that the author conceded.

**This machine cannot reach Reddit any other way.** Measured 2026-08-22:

| Route | Result |
|---|---|
| `www.reddit.com/….json`, generic UA | **403** |
| `www.reddit.com/….json`, descriptive UA | **403** |
| `old.reddit.com` | **403** |
| `r.jina.ai` text proxy | **403** |
| `https://www.reddit.com/api/v1/access_token` | **401 — reachable** |
| The owner's armed Firefox tab | **works** |

So there are exactly two viable paths, and one of them needs credentials that do
not exist yet. Do not waste a round discovering this again.

## Which path to use

**1. Browser Tunnel (works today, no Reddit API setup).** Read through `firefox-control`.
Handles logged-in-only content and anything Reddit gates. Costs: HTML parsing,
lazy-loaded comments, and Reddit's CSP blocks `eval` — use `snapshot` and parse
the DOM, never `eval`. An already armed tab can carry the first `open`, or the
owner can enable “Allow research tabs” once for the current Firefox session so
the sweep bootstraps and arms its own disposable tabs. Inside tabs it created,
the skill may run searches, navigate results, inspect rendered post bodies and
comments, and follow relevant comment continuation links without another click.

**2. The OAuth API (better, needs a one-time app).** The token endpoint answers,
so a script-type app at reddit.com/prefs/apps plus `REDDIT_CLIENT_ID` /
`REDDIT_CLIENT_SECRET` in `~/.env` would give complete comment trees as JSON
with no scraping. **Anonymous MCP servers will not work here** — they hit the
same 403 endpoints. Only credentialed ones can.

## Arrive from Google, not Reddit's search

Reddit's own search is poor and rate-limits hard. Google indexes the threads
properly, and arriving from a search engine is what a person does:

    https://www.google.com/search?q=<terms>+site:reddit.com

Then pull the `reddit.com/r/*/comments/*` permalinks out of the results page and
visit them.

When the question depends on matching language inside comments rather than post
topics, use Reddit's rendered comment-search view from an agent-created tab as a
second discovery angle. Open promising results as separate armed tabs and read
their surrounding thread context; a search-result excerpt alone is not evidence.

## Pace it

Never fire pages back to back. Identical intervals from one session are the
pattern that gets a browser challenged, and being challenged costs the owner
their session, not just the run.

    9–14 s   after a navigate, before the snapshot
    16–30 s  between threads
    20–40 s  between search queries

`scripts/sweep` implements this. It takes queries, does the Google hop, visits
up to two threads per query, and saves each page. Expect a five-query sweep to
take **fifteen to twenty-five minutes**. Say so up front, then do other work
while it runs — the gaps are working time, not waiting.

## Open your own tabs

Browser Tunnel 0.3.1 added `open`, which creates a NEW tab and arms it:

    scripts/firefox-control open 'https://www.reddit.com/r/x/comments/y/'
    scripts/firefox-control --tab reddit-1 snapshot --save DIR
    scripts/firefox-control close --tab 267        # by ID, not name

**Close by tab id, never by name.** Names are derived from the host and are
disambiguated only while they collide: close `reddit-1` and the remaining
`reddit-2` immediately renames itself to `reddit`, so a script that closes by
name gets one tab and then fails on the next. `open` returns the tab id in its
result — keep it and use it. Names are for a person choosing a tab; ids are for
a script that made one.

This does **not** remove the human gate. The command can arrive through a tab the
owner already armed or through the session-scoped research-tab grant, and
`~/.hermes/tunnel/enabled` must still be set. The grant permits opening an HTTPS
tab only; subsequent actions require that new tab to be armed. Prefer `open`
over `navigate` so the owner's own tab is never taken away from them.

Close what you opened.

## Reading a thread

Post body and comments live in predictable containers:

    post:     <div id="t3_…-post-rtjson-content">
    comments: <div id="…-comment-rtjson-content">

Strip tags, dedupe, and drop anything under ~60 characters — that filters
Reddit's chrome without losing content.

## Read the surface layer first

One page gives the top-level comments and the first reply of each branch —
measured at **79 of them** on a busy thread, against **38** "More replies" links
leading to separate continuation pages. `?limit=500` does not help: it returned
*fewer* (72) with the same 37 links.

The surface layer is the default because every finding that changed a decision
in the measured runs appeared there. Following all 38 continuations costs about
**fifteen minutes per thread** at a safe pace. Do not expand everything. Search
comments independently when useful, and follow a continuation when a specific
branch is likely to answer the research question. Record why that branch earned
the extra request.

Note for driving the page: Reddit's CSP blocks `eval`, but `click` works —
`executeScript` with a function is injected, not eval'd. It does not help with
"More replies" though, because those are `<a href>` links, not expanders.

## What to bring back

**The comments outrank the post.** On the two threads researched this way, every
finding that changed a decision came from the comments:

- an author's own explanation refuted with a source link, which he conceded
- a published workflow still shipping a stray test LoRA the article said was removed
- practitioners' denoise range differing from the article's by half
- "i2i is lacking with z-image, so consistency is not good" — a frank assessment
  of a technique, from someone who used it, that exists in no README

So: read the comments, and rank a specific claim with evidence above a confident
summary.

**Verify what you can, locally.** A Reddit claim about a tool you have installed
is checkable. The "ComfyUI downscales to 1MP with AREA" claim was confirmed by
reading `comfy_extras/nodes_qwen.py` on disk — that turned a rumour into a fact
and found a real defect in the owner's own pipeline. Always prefer this to
repeating the post.

**Separate read from inferred.** If a linked page could not be opened, say so
rather than letting a linked file stand in for it. Both failures happened here.

## Governor

- Never post, vote, or comment. Read only.
- Search, click, type, navigate, and expand only inside tabs the skill created;
  an existing user tab remains a carrier or an explicitly armed target, never
  an autonomous research surface.
- Never send the owner's credentials or session anywhere.
- If a page 403s or challenges, stop the sweep. Do not retry harder.
