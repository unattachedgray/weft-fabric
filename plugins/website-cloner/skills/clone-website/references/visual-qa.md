# Visual QA — measured, not eyeballed

`compare.js` implements this; read it to understand the numbers it prints.

## Order of evidence

1. **Heights first.** Page height and every section's height and top offset, reference vs clone. A zero delta down the list means the layout is right and any remaining diff is behaviour, timing or paint. A delta localizes the bug to one section before any pixel is compared.
2. **Per-section pixelmatch** (`threshold 0.1`, anti-aliasing ignored), pass at **≥ 95 %**. Font rendering alone costs 2–3 %; chasing 98 means chasing anti-aliasing ghosts. The worst of 12 horizontal bands says *where* inside the section.
3. **Slices**: 900 px viewport slices of the whole page, mean and worst mismatch, listed by `y`. A header bug shows as "every slice fails a little"; a section bug as one bad `y`.
4. **Elements**: every text node's font, size, weight, line-height, color and position against `dna.json` (primary breakpoint). This is the checklist that turns "10 % off" into "h1 is 48px, should be 60px".

## Apps that load data after `load`

`--wait-for '<selector>'` (e.g. `body[data-ready="1"]`) and `--wait <ms>` delay the census until the app has rendered its data; without them the clone is measured half-built (counts at 0, empty lists) and every text node reads as missing.

## Masks

GPU canvases, videos, lottie, opaque iframes and anything time-driven (marquees, counters) are painted over on **both** images before diffing — they are verified separately (renders, animates, responds), never diffed. Selectors come from `surface-map.json › routingSummary.maskSelectors` plus `--mask`.

## Gotchas the harness already avoids — keep avoiding them in your own captures

- Never `reducedMotion: 'reduce'` in the context: sites branch on it and the *original* diverges. Motion is frozen with injected CSS (`animation-play-state: paused; transition: none`).
- Never `waitUntil: 'networkidle'` against a dev server (HMR socket never idles). Use `domcontentloaded` + settle.
- Measure both pages the same way: fresh load, scrolled top→bottom→top once (lazy images, fonts), then capture. Reference screenshots were taken that way at extract time.
- Headless Chromium on a desktop GPU may render real shaders — mask them anyway.
- `deviceScaleFactor: 1`, scrollbars hidden, viewport 900 tall, same locale.
- Full-page rasters are capped at 16 384 px; taller pages get slices only.

## Reading a failure

- Section height differs → missing/extra element or wrong margin; check the DOM tree in the spec against the build.
- Section height equal, worst band at the top → header/nav overlap or padding-top.
- Uniform low-level noise across the section → font substitution (compare `loadedFonts` in `tokens-<w>.json`) or colour off by a few units.
- Element deltas listing `position` only → a preceding element is the wrong size.
- Everything shifted horizontally by a constant → container max-width or padding chain (spec § Padding chain).

Fix at the source (spec wrong → re-measure and fix spec; spec right → fix component). Never a compensating fudge.
