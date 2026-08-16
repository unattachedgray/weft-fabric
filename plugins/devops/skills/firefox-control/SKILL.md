---
name: firefox-control
description: Inspect and interact with the user's explicitly armed Firefox tab through Weft's local browser tunnel (looking_glass.py + the Browser Tunnel extension). Use when Claude must view an authenticated page as rendered in Firefox, capture its DOM and screenshot, execute diagnostic JavaScript, click or type into elements, or navigate the armed tab while debugging a live web app or browser extension.
clis: claude, codex, gemini, cursor
clis-why: "THE capability no CLI or model has natively — a live, authenticated Firefox tab. Not redundant with any built-in browser tool: those drive a fresh throwaway browser with no session. Link it into every CLI."
---

# Firefox Control

Control only the Firefox tab the user explicitly armed with the Browser Tunnel toolbar
button (or Alt+Shift+T). This is the same local relay Codex uses (`~/.codex/skills/firefox-control`)
— adapted here so Claude Code can drive it too.

## Workflow

1. Check that `~/.hermes/tunnel/enabled` exists. Do not create it unless the user has
   authorized browser control.
2. Confirm `looking_glass.py` is running locally on `127.0.0.1:8770`
   (`ps aux | grep looking_glass.py`; it lives at `~/dev/weft/scripts/weft/looking_glass.py`
   and is normally supervised by pm2) and that `BROWSER_TUNNEL_TOKEN` is set in `~/.env`.
3. Run commands through `scripts/firefox-control`; it sources `~/.env` for the token
   without printing it.
4. **Start with `tabs`, not `snapshot`.** It lists every open tab with its title, URL and
   which one is armed, so you can name the exact tab the user should arm instead of
   guessing. If nothing is armed, tell them once which tab to click.
5. Then `snapshot`. Read its header block before the payload — it names the tab that
   answered. **A screenshot is only returned when the armed tab is the visible one.**
   `chrome.tabs.captureVisibleTab` can only photograph the foreground tab, so when the
   armed tab is in the background the extension now refuses to capture rather than
   returning a different page's image labelled as the armed one (which it used to do).
   `shotSkipped` explains why; the DOM is still the armed tab's and is usually enough.
   Use `snapshot --save DIR` to write `page.html` + `shot.png` for inspection.
6. Prefer read-only `eval` expressions while diagnosing — e.g. read `chrome.runtime.lastError`,
   inspect extension storage, check `console` state via injected probes. Use `click`, `type`,
   or `navigate` only within the user's request.
7. Verify fixes in the real rendered page after rebuilding/reloading the extension or app.

If no tab is armed, do not ask the user to become the iteration loop — tell them once to
click the Browser Tunnel toolbar button on the tab you need, or arm it yourself only if
they've asked you to. For pages that do not require the user's live authenticated session,
launch a throwaway Playwright/Firefox instance instead. Reserve the armed-tab path for
authenticated state (like a logged-in facebook.com session) that cannot be reproduced safely
another way.

## Commands

```bash
scripts/firefox-control tabs                 # list every open tab, marking the armed one
scripts/firefox-control snapshot
scripts/firefox-control eval 'document.title'
scripts/firefox-control click '#selector'
scripts/firefox-control type '#selector' 'text'
scripts/firefox-control navigate 'https://example.com'
```

**`eval` fails on the /doc/ pages** — they ship a strict CSP without `unsafe-eval`, so
`eval()` is blocked outright. Use `snapshot` and parse the returned DOM instead.

`eval` runs in the page's MAIN world via `chrome.scripting.executeScript`, so it sees
page globals but not an extension's isolated-world content-script state directly. To
debug an extension's isolated-world script (e.g. a content script's closures), instead
have that script expose a small message-based debug hook (see `facebook-comment-reader`-
style patterns) or read `chrome://extensions` in a snapshot for load/permission errors.

**Never `navigate` the armed tab into another extension's `moz-extension://` page.**
`chrome.tabs.update` to a foreign extension's privileged URL appears to never resolve in
Firefox, and since Browser Tunnel's poll loop awaits each command serially, this hangs
the whole loop — every subsequent command times out until the user reloads or re-arms
the tab. To inspect another extension's own state (storage, scheduled alarms, last-run
results), read its files instead: the extension's UUID lives in
`<profile>/prefs.js` under `extensions.webextensions.uuids`, and `chrome.storage.local`
values can often be found in `<profile>/storage/default/moz-extension+++<uuid>/`. Prefer
that, or a purpose-built debug message handler in the target extension's own background
script, over hijacking the armed tab's navigation.

The relay queues one command at a time and times out (~60s) when no tab is armed. Never
bypass the armed-tab gate or expose `BROWSER_TUNNEL_TOKEN` in output.
