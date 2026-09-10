# Cloning through the Browser Tunnel (`armed.js`)

`scripts/armed.js` runs Phase 1 through `firefox-control` instead of headless Chromium. Same in-page probes (`lib/probes.js` installs `window.__clone` by `eval` — the 73 KB bundle passes through the tunnel fine), same workspace shape, so `spec.js`, `tokens.js`, `snapshot.js`, `compare.js` and `check.js` work unchanged.

```bash
node scripts/armed.js https://example.com/ --out WS --screenshots   # opens a focused research tab, closes it at the end (--keep to leave it)
node scripts/armed.js https://example.com/ --out WS                 # background research tab: DOM, styles, assets — no screenshots
node scripts/armed.js work/civitai --out WS --screenshots           # the tab the user armed: their session; never navigated, never closed
```

## Two ways in (mirrors the reddit-research skill)

- **URL** → `firefox-control open URL [--focus]` creates a new armed research tab (needs "Allow research tabs" for the Firefox session, or an armed carrier tab). The script works in that tab and closes it by **id** when done. Use this for public pages when the user wants the tunnel, or when headless Chromium hits a bot wall the user's browser does not.
- **Armed tab name or id** → the user's own tab. The script only reads (`eval` of read-only probes, `snapshot`) and scrolls; it never clicks, types, navigates or closes. Use it for pages that render differently logged in.

## What is weaker than `extract.js`, and how it shows

| Headless | Tunnel |
|---|---|
| three breakpoints | one: the tab's real viewport width (`capture.meta.breakpoints = [w]`) |
| instrumentation preload (canvas context types, IO registrations, listeners) | none — `motion.instrumented: false`; canvases classified post-hoc |
| hover/focus deltas measured | not sampled |
| interaction states captured by activating controls | contracts **listed only**; activate yourself with `firefox-control click` if the user allows |
| assets from network capture with the session | fetched again without the session: public assets succeed, gated ones land in `manifest.failed` → PLACEHOLDER or capture them from the tab |
| screenshots at DPR 1, full page | `captureVisibleTab` JPEG tiles of the foreground tab, stitched into `references/<w>/full-page.png`, slices and section crops (converted to PNG). Background tab → DOM only, and the summary says so |
| pre/post integrity census | single census |

Tag evidence from this path OBSERVED where the headless path would say CONFIRMED, and say in the report that the references are Firefox renders at the tab's DPR (compare.js pads on size mismatch; cross-browser font rendering costs a few percent).

## Tunnel facts the script encodes

- `eval` cannot return a Promise ("non-structured-clonable data"); pauses live in Node between synchronous evals.
- Strict-CSP pages block `eval` outright: the probe install fails fast; fall back to `snapshot` + DOM parsing and say the workspace is partial.
- Facebook Container: navigating a non-Facebook armed tab to facebook.com disarms it silently; arm a tab already on that domain.
- Close by tab **id**, never by name (names re-derive when a sibling closes).
- Never point the armed tab at another extension's `moz-extension://` page (hangs the tunnel loop).
