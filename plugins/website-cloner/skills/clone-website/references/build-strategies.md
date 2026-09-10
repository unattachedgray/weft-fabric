# Build strategies

## Two fidelity paths — choose after Phase 2, say which in the report

**Snapshot (fast path).** `build/snapshot/` = post-hydration HTML + the site's own stylesheets + assets rewritten to local files, scripts stripped. On sites that ship scope-attributed or utility CSS (Vue `data-v-*`, CSS Modules, styled-components, Tailwind, Astro) the DOM layer matches at 0–0.1 % in one pass (measured 100 % on a Docusaurus page in this repo's test run). What it loses: everything JavaScript did after load — hydrated carousels, tab panels, counters, menus. Rebuild those as a small behaviour layer from `motion.json` and `interactions.json`; do not re-add the source bundle. Choose it when the user wants fidelity or a starting point, not a codebase to keep developing.

**Rebuild.** Clean components from the specs. Lands at 1–3 % after fix rounds on most marketing pages; the result is maintainable and free of source fingerprints. Choose it when the user wants a codebase, a different stack, or must not ship the source's markup.

Both start from the same workspace; compare.js scores both the same way.

## Substrate — the lightest thing that fits

| Situation | Substrate | Layout |
|---|---|---|
| default, static/marketing page | **plain HTML + CSS** (`build/site/index.html`, `styles.css`, `sections/`, optional `behaviour.js`) | one file per section, concatenated or included; opens from `file://` |
| user asked for React / component codebase, app-like page | **Vite + React (+ Tailwind)** | `src/sections/<Name>.tsx`, `src/styles/tokens.css` |
| user asked for Next.js, needs routing/SSR, multi-page | **Next.js App Router + Tailwind v4 (+ shadcn)** | see below |
| user specified a stack | honour it | — |

Rendered page → clean HTML is one hard step; HTML → components is an easy one. When a framework is requested and the page is complex, build the HTML clone first, prove it with compare.js, then convert.

### Next.js layout (from ai-website-cloner-template, kept for multi-URL work)

```
src/app/<route>/page.tsx                           one route per source pathname
src/components/sites/<site-key>/<page-key>/*.tsx   section components
src/components/sites/<site-key>/shared/icons.tsx   deduplicated SVG icons
public/sites/<site-key>/<page-key>/                assets   (shared/ for same-site shared)
docs/research/<site-key>/<page-key>/               the workspace (or a symlink to it)
```

`<site-key>` = origin slug + first 8 hex of SHA-256(origin); `<page-key>` = pathname slug + first 8 hex of SHA-256(pathname + stateful query/fragment), `root-<hash>` for `/`. Collision-resistant by construction.

## Multi-URL

- Fix the output plan before extraction: every URL's route, workspace, component and asset namespace. Verify every planned path is unique.
- Same origin: build the shared foundation once, sequentially, then pages in parallel.
- Different origins: ask whether the user wants separate app roots (recommended) or a combined app with route-scoped styling. Never mix global foundations silently.
- An existing project: inventory existing routes first; never replace a non-scaffold route without explicit approval; if the planned route exists, ask (update / other route / skip).
- URLs differing only by query or fragment share a route; resolve their state behaviour explicitly.

## GPU surfaces (surface-map.json)

- `WEBGL1/2`, `WEBGPU`, animated `CANVAS2D`: the DOM track leaves a **placeholder mount** — a positioned empty container with the same id, size, `z-index` and `pointer-events` from the surface map. Then, in order of fidelity: reuse the library when the bundle fingerprints one (`@paper-design`, Unicorn Studio, Spline, Rive, Lottie, R3F — install the same package, pass the same props: SOURCE fidelity); else an approximation from the captured poster; else the poster image. Label SOURCE / PARTIAL / approximate and never upgrade the label.
- `VIDEO`: re-embed the `<video>` with the localized file, same autoplay/loop/muted/poster.
- `LOTTIE`: re-embed the player with the localized JSON.
- `IFRAME_OPAQUE`: re-embed the `src`; contents are not inspectable.
- Mount contract: canvas buffer = css size × DPR, resize on container resize, `pointer-events: none` for backgrounds, `loseContext()` on unmount, respect `prefers-reduced-motion`.

## Behaviours to rebuild from evidence, not from memory

- `motion.json › scrollTrigger` entries carry start/end/scrub/pin verbatim; `waapi` carries keyframes and easing; `keyframes` the CSS bodies; `lenis.options` the lerp/duration; `sliders` the Swiper/Splide params.
- `scroll-timeline.json › classified` gives each scroll-linked element its first change position and the property deltas (sticky-on, reveal, transform-scrubbed, style-flip). Sample ±50 px around a flip before implementing; a flip is often binary where you assumed scrubbed, and the trigger is often a different element than the one that changes.
- `css-rules/` contains the `:hover`/`:focus` rules and `@media` breakpoints verbatim — prefer them over re-deriving.
- Include the height-refresh guard for scroll triggers (lazy images shift layout after load):

```js
let lastH = 0, t; new ResizeObserver(() => { const h = document.documentElement.scrollHeight; if (h === lastH) return; lastH = h; clearTimeout(t); t = setTimeout(() => window.__refreshTriggers && window.__refreshTriggers(), 120); }).observe(document.body);
```
