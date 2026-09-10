---
name: clone-website
description: "Clone a live web page into an editable codebase with measured fidelity: deterministic Playwright scripts extract computed styles, authored CSS, assets, motion and interaction evidence into a workspace; per-section specs are generated from that evidence; the model builds each section; pixelmatch + structural gates prove the result. Use whenever the user wants to clone, replicate, rebuild, reverse-engineer, copy or 'make a page that looks exactly like' a website or landing page, or asks how a site is built (teardown). Provide one or more URLs; supports Wayback Machine URLs. Not for 'inspired by' designs."
argument-hint: "<url> [<url2> ...] [--stack html|next|vite] [--analyze-only] [--fidelity snapshot|rebuild]"
user-invocable: true
clis: claude, codex, gemini, cursor, dsh
clis-why: "The scripts are plain Node + Playwright and the workspace is files on disk, so every CLI can run the same loop. Claude Code additionally gets the three sub-agents in plugins/website-cloner/agents/; the others run the phases inline."
---
# Clone Website

You are the **foreman**. Deterministic scripts are your hands and eyes: they measure the original, write the evidence to a workspace, generate the builder briefs, and score the result. You read evidence, decide the interaction model, build (or dispatch builders), and repair the worst measured section. Nothing is estimated that could have been measured, and nothing is declared done that was not scored.

The target site **is the spec**. Every visual decision has already been made; your job is to reproduce it and prove it.

## Guardrails (read first)

- Clone for migration, recovery of lost source, prototyping on a page the user owns or is allowed to copy, or learning how a build works.
- Never for phishing or impersonation. If the target looks like it exists to be impersonated (a login, wallet, checkout, bank), stop and ask.
- Logos, wordmarks, photos of people, product screenshots and copy belong to their owners: reproduce them **REAL or PLACEHOLDER**, never generate a look-alike. Downloaded fonts are for local study; say so in the report (see `references/assets.md`).
- Do not capture behind a login wall unless the user armed that session themselves and asked for it.
- Deployment is never implicit. Produce a local build and a review path.

## Pre-flight

1. **Scripts.** `bash <skill>/scripts/setup.sh` once (Node ≥ 18, `npm install`, Chromium for Playwright). Every script prints a structured summary (`STATUS / WORKSPACE / WROTE / KEY_FINDINGS / WARNINGS / NEXT`) on stdout and details on stderr; `STATUS: failed` is a stop-and-fix signal, `partial` means read the warnings before continuing. Never invent a script result.
2. **Browser path.** Two drivers run the same in-page probes and write the same workspace:
   - `extract.js` — headless Chromium inside the scripts. Default: reproducible, three breakpoints, instrumentation preload, hover/focus deltas, interaction states captured, network asset capture.
   - `armed.js` — the **Browser Tunnel** (`firefox-control`), on this machine's Firefox. Two ways in, like the reddit-research skill: a **URL** opens a new armed research tab through the tunnel and closes it afterwards (`--screenshots` opens it focused, because the tunnel can only photograph the foreground tab); an **armed tab name or id** uses the tab the user armed themselves — their logged-in session — and is never navigated, clicked, or closed. Use it when the page renders differently for the user's session, when the user says "I armed X", or when headless Chromium is bot-walled and the user's browser is not. Its evidence is weaker (one breakpoint, no instrumentation, no hover deltas, assets fetched without the session); `references/armed-tab.md` lists the differences.
   Never substitute a fresh browser for a session the user pointed you at, and never quietly fall back to a fetch or a screenshot.
3. **Scope.** Parse the URLs and flags. Defaults: pixel-faithful visual layout, real content and assets, real interactions (menus, tabs, accordions, carousels), responsive at 1440 / 768 / 390; out of scope: backend, auth, real-time data, SEO. The user's explicit instructions override every default.
4. **Output plan** (multi-URL or an existing project): decide `<app-root>` and, per URL, a route and namespaced dirs before writing anything. Rules in `references/build-strategies.md` § Multi-URL. Never overwrite another page's route, spec, or asset namespace; ask when a planned route already exists.
5. **Workspace.** One per page: `clone-workspace/<slug>/` (or the user's dir). Its layout is `references/workspace.md`. Everything goes there, not into the conversation: read summaries and small JSON, never dump `dna.json` or `page.html` into context.

## Phase 1 — Extract (deterministic)

```bash
node <skill>/scripts/extract.js <url> --out <workspace> [--breakpoints 1440,768,390] [--no-states] [--no-contracts]
```

It loads the page with instrumentation preloaded (canvas context types, IntersectionObserver registrations, input listeners), settles lazy content, and writes: a **section census** at every breakpoint with reference screenshots (full page, slices, one crop per section); **dna.json** (per-section DOM tree with non-default computed styles, verbatim text, assets incl. layered compositions, padding chain, interactive elements with hover/focus deltas); **css-rules/** (the authored rules that apply to each section — `:hover`, `@media`, `@keyframes`, custom properties — which computed styles cannot show); **tokens-<w>.json**; **surface-map.json** (DOM vs WebGL/canvas/video/iframe routing); **motion.json** (GSAP/ScrollTrigger/WAAPI/keyframes/Lenis/slider parameters read from the runtime); **scroll-timeline.json**; **interactions.json** (tabs/accordions/menus/carousels, each activated once on the original with its resulting state saved); **assets/** with a manifest (images, fonts, css, media, inline SVGs, and every JSON/GeoJSON/CSV data response under `assets/data/` — a data-driven app's data, not just its look; map tile URL patterns are recorded, not fetched); **capture/page.html** + the stylesheets in cascade order; **capture/network.json** (every request: type, status, size); and an **integrity** verdict (sections present before and after, page height loss).

Read `capture.json` (small) and the summary. Then decide:

- **Integrity failed / bot wall / zero sections** → stop with `failed_with_residuals`; never plan from a partial capture.
- **`routing.hasGpuSurfaces`** → those regions are masked in QA and rebuilt as placeholder mounts or re-embedded libraries (`references/build-strategies.md` § GPU). Say so up front: the DOM will match, the effect is approximated.
- **Platform** (`motion.platform`) shows scoped or utility CSS (`vueScoped`, `cssModules`, `styledComponents`, `tailwind`, `astro`) → the **snapshot fast path** is viable for fidelity.
- `--analyze-only` → write `TEARDOWN.md` from the evidence (`references/teardown.md`) and stop.

## Phase 2 — Baseline and QA calibration (deterministic)

```bash
node <skill>/scripts/snapshot.js <workspace>          # post-hydration HTML + own CSS + local assets, scripts stripped
node <skill>/scripts/compare.js <workspace> <workspace>/build/snapshot
node <skill>/scripts/check.js   <workspace> <workspace>/build/snapshot
```

Do this **before** building anything. It proves the sensor: a static copy of the page must score near 100 % on static sections. Sections that fail here are JS-stateful (hydrated carousels, tab panels, counters) — note them as the sections where the interaction model matters most. `check.js` on the snapshot is expected to fail contracts (scripts are stripped): that failure is the gate working.

If the user wants **fidelity over a maintainable codebase** and the platform check said scoped/utility CSS, the snapshot plus a small behaviour layer rebuilt from `motion.json` and `interactions.json` may be the deliverable (`--fidelity snapshot`). Otherwise continue to a rebuild.

## Phase 3 — Specs (deterministic, then the foreman's judgement)

```bash
node <skill>/scripts/spec.js <workspace> --stack html|next|vite
node <skill>/scripts/tokens.js <workspace>
```

One `specs/NN-slug.spec.md` per section: geometry at every breakpoint, padding chain, the DOM tree with exact computed values, verbatim text, assets with local paths and tiers, hover/focus deltas, scroll-linked changes, runtime animation params, interaction contracts, and the path to the authored CSS. The spec is the contract between measurement and construction; a builder works from it, never from memory of a browser session.

Then do the part only a reader of the screenshots can do, section by section, and edit the spec's **AGENT** lines:

1. **Interaction model.** Open the section screenshot, `scroll-timeline.json`, `motion.json` and `interactions.json`. Decide: static, click-driven, scroll-driven (IntersectionObserver / scroll-timeline / sticky), hover, time-driven. **Scroll before you click** — building click tabs where the original auto-advances on scroll is a rewrite, not a tweak (`references/interaction-model.md`).
2. **Per-state content.** For tabs, carousels and accordions, the extractor saved one activated state per control in `interactions/<id>/`. If more states exist, capture them (Playwright one-liner or the armed tab), and list every state's content in the spec.
3. **Evidence tags.** Anything you inferred from class names rather than measured stays tagged INFERRED. Never upgrade a tag.
4. **Complexity.** One builder per section by default. Split only when a section holds genuinely independent parts (three card variants, a widget). A spec over ~250 lines of tree is a hint to split.

## Phase 4 — Build

**Foundation first, sequentially, yourself:** import `build/tokens.css` (the site's own custom properties are kept verbatim), wire fonts (`@font-face` from `assets/fonts/`, or the same Google/Typekit links), page shell, global behaviours (smooth-scroll library, scroll-snap, theme). Verify the empty shell builds. Substrate choice and layouts per stack: `references/build-strategies.md`.

**Then per section**, in document order, each builder receives its spec **inline** (not "go read the file"), the screenshot paths, the target file, and this contract:

- reproduce every computed value; use `assets/` files, never placeholders for REAL assets; text verbatim;
- root element carries `data-clone-section="<slug>"`; each interaction control `data-clone-interaction="<id>"` and its surface `data-clone-controlled="<id>"`;
- interactions must **work** — a visually similar but inert control fails the gate;
- no source-framework markup or class fingerprints, no hotlinked media;
- verify it compiles (`npx tsc --noEmit` / build) before returning, and return a ≤300-word summary in the protocol format (`references/protocol.md`).

In Claude Code, dispatch `website-cloner:builder` sub-agents (parallel is fine when each writes only its own files; use worktrees when they share files). In other CLIs, build inline, one section at a time. Merge as sections complete and keep the build green after every merge.

## Phase 5 — Measure, repair, gate

```bash
node <skill>/scripts/compare.js <workspace> <clone-url-or-index.html> [--sections 3,4] [--pass 95] [--mask sel]
node <skill>/scripts/check.js   <workspace> <clone-url-or-index.html>
```

`compare.js` reports, per breakpoint: section heights first (a height delta localizes the bug before any pixel), per-section pixelmatch with the worst of 12 bands, full-page slice diffs by y, and an element-level check of every text node's font/size/weight/color/position against `dna.json`. Pass bar is 95 % per section (font anti-aliasing alone costs 2–3 %; do not chase 98). GPU/video/embed surfaces are masked on both images.

`check.js` runs the structural gates in dependency order: sections present → no hotlinks → no fingerprints → every interaction contract that changed on the original changes on the clone.

Repair loop, per failing section, **at most 3 attempts**: read the diff image and the element deltas → decide whether the spec value was wrong (re-measure, fix spec) or the builder ignored a correct spec (fix component) → fix at the source, never with a compensating fudge → re-run compare for that section. After 3 attempts the section becomes a **residual** with its measured value, expected value, evidence paths and the reason you stopped. Never average a red gate away, never waive one silently.

## Phase 6 — Hand off honestly

Terminal states are `ready_for_user_review` (every gate green, every claim has an evidence path) or `failed_with_residuals` (the working artifact plus the residual ledger). Report:

- source → route/file mapping; substrate and fidelity path chosen, and why;
- per breakpoint: sections passed / total, worst section and its %, slice mean/worst, element deltas count;
- gates: sections / hotlinks / fingerprints / contracts;
- assets by tier (REAL / RECONSTRUCT / CAPTURED / PLACEHOLDER), fonts and their licence note;
- GPU/video surfaces and how each was handled; residuals with evidence.

Say "ready for your review", never "pixel-perfect". The user's visual and functional review is the final decision.

## App clones (maps, dashboards, SPAs)

When the page is an application rather than a document: the section census still finds the panels (fixed/absolute overlays and `display: contents` wrappers are sections too), but pixel scores are dominated by the full-viewport canvas, so read `compare.js` for its **element-level deltas** and `check.js` for contracts, and verify the canvas by behaviour. The behaviour spec is the app bundle: beautify the page chunk (`npx js-beautify`) and read layer definitions, state machines and constants from it — Next.js app-router chunks are barely minified. Capture hidden UI states by driving the live page (Playwright: click, read `outerHTML`, screenshot) and lift panel markup from those states. Never reuse the original's API keys (a Mapbox token in the bundle is theirs); swap in an open equivalent (MapLibre + CARTO/OpenFreeMap) and say so. Pass `--wait-for 'body[data-ready]'` to compare/check so the census runs after the data loads.

## Lessons baked in (each cost someone a rebuild)

- Do not eyeball a screenshot for values the browser already computed. Do not eyeball a result the scripts can score.
- Scroll before you click. Capture every state, not the load-time one. SPA frameworks render only the active state.
- Fonts, SVGs and images silently move layout; without the real assets nothing lines up. Layered compositions (background + overlay + icon) are several assets, not one.
- `getComputedStyle` cannot see `:hover`, `@media`, `@keyframes`, or `var()` chains — that is what `css-rules/` is for.
- A `<canvas>` is invisible to the DOM track; mount it, do not paint it in HTML. A looping `<video>` is not a canvas; re-embed it.
- Freeze motion with injected CSS, never `reducedMotion: 'reduce'` (sites branch on it and the original diverges). Never `networkidle` against a dev server.
- Measure both pages the same way (fresh load, scrolled through once, then compared); compare heights before pixels.
- Trigger positions computed at load go stale when lazy images shift layout; refresh on document-height change.
- Plain HTML first, framework second, when the user wants a framework: a rendered page → clean HTML is one hard step, HTML → components is an easy one.
- Fewer, larger builders beat many tiny ones; over-splitting adds merge cost and no fidelity.

## Scripts

| Script | Purpose | Output |
|---|---|---|
| `setup.sh` | one-time deps + Chromium | — |
| `extract.js <url> --out WS` | Phase 1 measurement, headless Chromium | workspace (see `references/workspace.md`) |
| `armed.js <url \| tab> --out WS [--screenshots]` | Phase 1 through the Browser Tunnel (research tab or the user's armed tab) | same workspace, one breakpoint |
| `spec.js WS [--section N] [--stack]` | builder briefs | `specs/*.spec.md` |
| `tokens.js WS` | design tokens | `build/tokens.css`, `tokens.json` |
| `snapshot.js WS` | fidelity fast-path baseline | `build/snapshot/` |
| `compare.js WS <clone> [--wait-for sel] [--wait ms]` | visual QA, exit 2 on fail; `--wait-for` waits for an app-ready selector before measuring | `qa/report.md`, diffs |
| `check.js WS <clone> [--wait-for sel]` | structural/behavioural gates, exit 2 on fail | `qa/check.md` |

References: `workspace.md`, `protocol.md`, `build-strategies.md`, `interaction-model.md`, `visual-qa.md`, `assets.md`, `wayback.md`, `armed-tab.md`, `teardown.md`, `sources.md`.
