# Interaction model — decide it before building

The most expensive mistake in cloning: building click-switched tabs when the original auto-advances on scroll, or static CSS when the original runs a smooth-scroll library. Changing it later is a rewrite.

## Evidence, in the order to read it

1. `interactions.json` — controls the extractor found (ARIA tablists, `details>summary`, `aria-expanded`, carousels, `aria-haspopup`) and whether activating each one changed the DOM (`observed.changed`). `interactions/<id>/after.html|png` holds the state after one activation.
2. `scroll-timeline.json › classified` — elements whose computed style changed while scrolling: `sticky-on` (header becomes fixed at `firstChangeY`), `reveal` (opacity 0→1), `transform-scrubbed` (parallax, progress), `style-flip` (background/shadow change).
3. `motion.json` — `scrollTrigger` (GSAP: trigger, start, end, scrub, pin, toggleActions), `waapi` with `timeline: ScrollTimeline|ViewTimeline` (CSS scroll-driven), `intersectionObservers` (instrumented: options + targets), `listeners` (which inputs drive the page), `lenis`, `sliders`, `splitText`.
4. `surface-map.json › scroll` — Lenis / Locomotive / scroll-timeline CSS / scroll-snap / `scroll-behavior: smooth`.
5. Your own sweep (Playwright one-liner or the armed tab): scroll slowly first, watch what changes on its own; only then click; then hover.

## Verdicts to write into the spec

`INTERACTION MODEL: static` · `click-driven (tabs, aria-selected)` · `scroll-driven (IntersectionObserver threshold 0.5)` · `scroll-driven (position: sticky + content swap)` · `hover (transition 0.2s ease)` · `time-driven (autoplay carousel 4000 ms)` · combinations.

## Signatures

- **Lenis**: `Lenis` global, `html.lenis`, `data-lenis-prevent`. Reproduce with Lenis and the same `lerp`/`duration`; do not fake scroll with transforms.
- **Locomotive**: `data-scroll`, `data-scroll-container`, `data-scroll-speed`. Current versions sit on Lenis.
- **CSS scroll-driven animations**: `animation-timeline` ≠ `auto`, `scroll-timeline-name`, `view-timeline-name`. Rebuild with the same timeline, not a JS scroll listener.
- **AOS / ScrollReveal**: `data-aos` attributes; reproduce the attribute set or an IO with the same threshold.
- **Pinned sections**: `.pin-spacer` in the DOM (GSAP) or `position: sticky` with a tall parent.
- **Sticky sidebar with auto-active items**: IntersectionObserver, NOT click handlers.
- **Theme flip by section**: a class toggled on `<body>`/`<html>` by IO or ScrollTrigger; check for CSS-variable drivers (`color-mix(… var(--progress))`) before assuming a class toggle does anything.
- **Marquee**: `@keyframes translateX(-50%)` on a duplicated track.
- **Custom cursor / magnetic buttons**: `mousemove` listener + `gsap.quickTo`; note lerps.

## Capturing hidden states

SPA frameworks render only the active state; inactive tab panels do not exist in `page.html`. For each stateful widget, activate each state on the original and save its `innerHTML` and a screenshot; list every state's content in the spec's **Per-state content**. For scroll-pinned sequences, capture the paired visual at the scroll offset where it is fully composited and record the offset.

## Hooks the build must carry

`data-clone-interaction="<id>"` on each control, `data-clone-controlled="<id>"` on its surface. `check.js` replays each contract on the clone and fails inert look-alikes.
