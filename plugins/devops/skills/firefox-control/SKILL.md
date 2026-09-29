---
name: firefox-control
description: "Inspect and interact with the user's explicitly armed Firefox session through the Browser Tunnel extension and its local native host (legacy: weft's looking_glass.py relay). Use when an agent must view an authenticated page as rendered in Firefox, open or navigate background tabs, capture DOM and screenshots, execute diagnostic JavaScript, click or type into elements, or debug a live web app or browser extension."
clis: claude, codex, gemini, cursor, dsh
clis-why: "THE capability no CLI or model has natively — a live, authenticated Firefox tab. Not redundant with any built-in browser tool: those drive a fresh throwaway browser with no session. Link it into every CLI."
---
# Firefox Control

Control explicitly armed tabs or research tabs the extension creates under the
owner-authorized persistent automatic-research grant. This is the same local tunnel Codex uses (`~/.codex/skills/firefox-control`)
— adapted here so Claude Code can drive it too.

## Workflow

1. Check that `~/.hermes/tunnel/enabled` exists. Do not create it unless the user has
   authorized browser control.
2. Confirm the transport. **Browser Tunnel >= 0.4 (native, the default):**
   `~/dev/browser-tunnel/install.sh --check` reports the native host and CLI installed.
   Firefox starts the host per profile; each listens on a 0600 socket in
   `$XDG_RUNTIME_DIR/browser-tunnel/`. No relay, service or token is involved, so a
   machine needs only the extension plus `install.sh` — nothing from another machine.
   **0.3 profiles (legacy):** they poll `looking_glass.py` on `127.0.0.1:8770`
   (pm2 on the owner host) with `BROWSER_TUNNEL_TOKEN` from `wsecret`'s `browser`
   scope. The 0.4 CLI reaches both at once when that token exists, and `armed` marks
   relay-only tabs `[relay]`.
3. Run commands through `scripts/firefox-control`. It prefers the native CLI
   (`~/.local/lib/browser-tunnel/tunnel_cmd.py`), injecting the `browser` scope only
   when this machine holds the token; without the native CLI it falls back to the
   weft relay client exactly as before.
4. **Start with `armed`, not `tabs` and never `snapshot`.** `armed` reads every
   profile's registry: every armed tab, in every Firefox profile, each with a name. It touches
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
   `--tab`, the CLI refuses and lists the candidates — it will not pick one for you,
   because acting on the wrong logged-in profile is worse than a failed command.

   `tabs` still lists every OPEN tab, but it has to be executed by a tab, so it can
   only describe the one profile that answered. Use it to find a tab for the user to
   arm; use `armed` to find a tab to command.

   For research, no pre-armed tab is needed: use `open` through the persistent
   research grant. Do not ask the owner to arm a carrier first.
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
   research tabs” until revoked. The bootstrap capability permits
   HTTPS `open` only; every page action still requires the newly created armed tab.
   Do not use `--focus` during autonomous research or tests.
8. Close tabs created for the task with `--tab NAME close` when they are no longer needed.
   Do not close the tab the owner originally armed unless they explicitly asked for it.
9. Verify fixes in the real rendered page after rebuilding/reloading the extension or app.

The owner authorized automatic Reddit research setup on 2026-09-10. All such
browser access still passes through this extension and its native host (or the legacy relay). Use `open` to
create task-owned tabs; do not substitute a separate browser automation channel.
Browser Tunnel 0.3.5 shows a notice on the controlled page (host, tab ID, action,
and Stop access), with toolbar/popup indicators for restricted browser pages.
This browser notice replaces per-command CLI announcements and per-use approval.
Report setup failures in the CLI. Persistent grant revocation and the disabled
host-side tunnel remain authoritative; never silently override them.
Existing unrelated tabs still require the owner's explicit targeting/arming.

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
a persistent id and registers its armed tabs; the CLI routes each command to
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

The tunnel queues one command at a time and times out (~60s) when no tab is armed. Never
bypass the armed-tab gate or expose `BROWSER_TUNNEL_TOKEN` in output.

## Sight and network without focus (tunnel 0.3.10, 2026-09-21)

`shot --save DIR` photographs the ARMED tab itself, visible or not (Firefox
`tabs.captureTab`), so an autonomous run can look at what it did without raising a
window. `snapshot` now carries the same image beside the DOM. `capture start
[--match SUBSTR]` records the responses that tab receives (default match
`/api/graphql`), `capture read --save DIR` hands them over as `resp-NNNN.json` +
`index.json`, `capture stop` ends it. This is the JSON a page actually received —
paginated feed data never lands in the DOM as text, so a scroll-then-snapshot
loop cannot see it; capture can. Buffers are bounded (200 responses / 40 MB per
tab) and dropped when the tab closes. Both are read-only observation; neither
changes the page.

## The tunnel manages its own tabs (0.3.13, owner rule 2026-09-21)

`open` puts every research tab into ONE research window that the extension creates
once, unfocused, and reuses; the tab is active there, so the page is visible and
feeds paginate, while the owner's window is never touched and focus is returned to
it immediately (`focusReturnedTo` in the result). A second `open` of the same URL
reuses that tab (`reused: true`). Tabs nobody commanded for 10 minutes are closed
by the extension; `close --all` closes everything it opened, and the window closes
with its last tab. A script must call `close --all` when it finishes or fails.
Never create windows or tabs yourself.

## Preserve browser focus

Owner instruction (2026-09-10): never bring browser windows/tabs to the foreground
for autonomous research or testing. Open background tabs; use DOM snapshots and
background assertions. Do not use `--focus` or activate a tab merely to obtain a
screenshot. Foreground visual verification requires an explicit owner request.
Do not switch tabs, restart the browser, or use keyboard shortcuts that steal
focus during tests. If a restricted page needs foreground interaction, stop that
path and report the limitation.

Browser Tunnel 0.3.6 adds a green idle / amber armed toolbar icon and a badge
counting armed tabs in the profile, visible without switching the current tab.
The popup and tooltip identify the tabs. The host, legacy relay and extension force `open`
to remain in the background. Use this indicator, not foreground tests or desktop
notifications, to make tunnel access visible.
