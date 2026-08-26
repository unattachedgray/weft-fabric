---
name: firefox-control
description: Inspect and interact with the user's explicitly armed Firefox session through Weft's local browser tunnel (looking_glass.py + the Browser Tunnel extension). Use when an agent must view an authenticated page as rendered in Firefox, open or navigate background tabs, capture DOM and screenshots, execute diagnostic JavaScript, click or type into elements, or debug a live web app or browser extension.
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
   and is normally supervised by pm2) and that `wsecret list` reports
   `BROWSER_TUNNEL_TOKEN` in the `browser` scope.
3. Run commands through `scripts/firefox-control`; it injects only the `browser`
   scope into `tunnel_cmd.py` without printing the token.
4. **Start with `armed`, not `tabs` and never `snapshot`.** `armed` reads the relay's
   registry: every armed tab, in every Firefox profile, each with a name. It touches
   no tab, so it cannot act on the wrong one while you are still working out which
   one you want.

   ```
   2 armed tab(s) across 2 profile(s):

     work/civitai      tab5   active      Civitai
                       https://civitai.com/images
     personal/studio   tab9   background  Studio
                       http://127.0.0.1:8765/studio
   ```

   **More than one tab can be armed at once, including across two Firefox profiles
   logged into different accounts.** So a command must say which tab it means:

   ```bash
   scripts/firefox-control --tab work/civitai snapshot
   ```

   The bare site name (`civitai`) works when it is unique. With several armed and no
   `--tab`, the relay refuses and lists the candidates — it will not pick one for you,
   because acting on the wrong logged-in profile is worse than a failed command.

   `tabs` still lists every OPEN tab, but it has to be executed by a tab, so it can
   only describe the one profile that answered. Use it to find a tab for the user to
   arm; use `armed` to find a tab to command.

   If nothing is armed, tell them once which tab to click.
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
7. `open URL` creates and arms a new background tab. It can arrive through an armed
   carrier tab, or bootstrap through a Firefox profile where the owner enabled “Allow
   research tabs” for the current browser session. The bootstrap capability permits
   HTTPS `open` only; every page action still requires the newly created armed tab.
   Use `--focus` only when the task genuinely needs the rendered screenshot.
8. Close tabs created for the task with `--tab NAME close` when they are no longer needed.
   Do not close the tab the owner originally armed unless they explicitly asked for it.
9. Verify fixes in the real rendered page after rebuilding/reloading the extension or app.

If no tab is armed, do not ask the user to become the iteration loop — tell them once to
click the Browser Tunnel toolbar button on the tab you need, or arm it yourself only if
they've asked you to. For pages that do not require the user's live authenticated session,
launch a throwaway Playwright/Firefox instance instead. Reserve the armed-tab path for
authenticated state (like a logged-in facebook.com session) that cannot be reproduced safely
another way.

## Commands

```bash
scripts/firefox-control armed                # every armed tab, every profile, named
scripts/firefox-control tabs                 # every open tab in the answering profile
scripts/firefox-control snapshot
scripts/firefox-control eval 'document.title'
scripts/firefox-control click '#selector'
scripts/firefox-control type '#selector' 'text'
scripts/firefox-control navigate 'https://example.com'
scripts/firefox-control open 'https://example.com' # new armed background tab
scripts/firefox-control open 'https://example.com' --focus
scripts/firefox-control --tab example close       # close a tab this tool opened

# --tab goes before the action and works on all of them
scripts/firefox-control --tab civitai snapshot
scripts/firefox-control --tab personal/studio eval 'document.title'
```

`open` is tab-agnostic. With one research-enabled profile it routes there automatically;
with several, target the profile label. Otherwise any armed tab can carry the command.
The created tab becomes its own named target. `navigate` does not activate a background
target, so it is safe for non-disruptive research once the new tab exists.

**Names come from the host.** `civitai.com` is `civitai`, `docs.google.com` is
`docs.google`, `127.0.0.1:8765` is `local-8765`. Two profiles with the same site
open are told apart by the profile label (`work/civitai`, `personal/civitai`),
which the owner sets in the extension popup. Two tabs on the same site in the
SAME profile get a number appended. A tab id also works as a target.

**Each Firefox profile is a separate client.** The extension gives every profile
a persistent id and registers its armed tabs; the relay routes each command to
one client's queue. Before this, a single global command slot went to whichever
profile polled first — with two profiles running, commands landed at random in
whichever browser answered, against whichever account was logged in there.

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
