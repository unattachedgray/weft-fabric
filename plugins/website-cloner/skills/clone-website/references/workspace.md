# Workspace layout

One workspace per page. It is the source of truth; agents write files here and return summaries. Resume by reading `capture.json` and the last summary, never by re-extracting unless `capture.json` is missing.

```
clone-workspace/<slug>/
├── capture.json            small: meta, sections per breakpoint, integrity, routing, motion summary, tokens digest, warnings
├── dna.json                per-section truth at the primary breakpoint: tree (computed styles), text, assets, layered, alignment, interactive (+ hover/focus deltas)
├── layout-<w>.json         per-section rect / alignment / shallow tree at the other breakpoints
├── tokens-<w>.json         frequency-ranked palette, type scale, spacing, radii, shadows, z-layers, @font-face, breakpoints, :root custom props
├── surface-map.json        canvas (WEBGL1/2, WEBGPU, CANVAS2D), video, opaque iframes, animated SVG, lottie → routing + mask selectors
├── motion.json             runtime animation params: GSAP tweens + ScrollTriggers, WAAPI, @keyframes, scroll-timelines, Lenis, sliders, IO registrations, listeners
├── scroll-timeline.json    elements whose computed style changed while scrolling, with the first scrollY and the property deltas, classified
├── interactions.json       interaction contracts (tabs / accordion / menu / carousel) with the observed change on activation
├── interactions/<id>/      before.html, after.html, after.png for each activated control
├── css-rules/NN-slug.css   authored CSS applying to each section: :root vars used, @font-face, base rules (incl. :hover/:focus), @keyframes, @media
├── capture/page.html       post-hydration DOM
├── capture/css/NN.css      stylesheets in cascade order (network capture, fetched, or inline)
├── capture/network.json    every request seen while loading: url, type, status, size; tile URL patterns
├── references/<w>/         full-page.png, above-fold.png, slice-NNNNN.png (900px viewport slices), section-NN-slug.png
├── assets/                 images/ fonts/ css/ media/ favicons/ svg/ svg-inline/ data/ (JSON/GeoJSON/CSV responses) + manifest.json (url → file; `data`, `tilePatterns`)
├── specs/NN-slug.spec.md   builder briefs (spec.js)
├── build/tokens.css        tokens (tokens.js) · build/snapshot/ (snapshot.js) · build/site/ or the chosen substrate
├── qa/                     report.md/json, <w>/section-*-diff.png, slice diffs, check.md/json
└── errors/                 one file per failed script run (root cause, stack, recovery hint)
```

## Section identity

Sections are found by the census in `lib/probes.js`: fixed chrome (header/nav), fixed/absolute overlays ≥ 40×120 px under the band root (timeline bars, side panels, dialogs), and the bands under the page's band root, with tall wrappers split up to three levels. `display: contents` wrappers (React portals/fragments) are looked through. Each has an index, a slug (`NN-<id|aria-label|heading|class|tag>`), a robust selector, a rect in page coordinates, and a fingerprint (tag, id, heading, child count) used by the integrity check.

The same census runs on the clone in `compare.js` / `check.js`. Matching prefers `data-clone-section="<slug>"` hooks, then heading text, then order. Put the hooks in — without them the section gate is count-only.

## Sizes

A marketing page yields 10–40 MB (screenshots dominate). `dna.json` is 0.3–3 MB: read it with a script or `spec.js`, never into context whole.
