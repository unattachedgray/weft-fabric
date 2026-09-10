# TEARDOWN.md — the human-readable blueprint (deliverable of `--analyze-only`)

Write it from the workspace evidence. Every claim carries a tag: **CONFIRMED** (read from a runtime object or computed style — `motion.json`, `dna.json`, `tokens-*.json`), **OBSERVED** (seen during the scroll/hover sweep or in `scroll-timeline.json`), **INFERRED** (guessed from class names or markup). Never upgrade a tag.

```markdown
# Teardown: {site}
**URL** {url} · **Analyzed** {date} @ {breakpoints} · **Platform** {motion.platform + generator} · **Surfaces** {N} DOM sections, {N} GPU, {N} video

## Stack (from runtime)
| Layer | What | Evidence |
| Framework | … | motion.libraries |
| CSS | scoped / modules / tailwind / plain | motion.libraries.* |
| Animation | GSAP x.y + ScrollTrigger (n triggers, n pinned, scrub on n) / WAAPI / keyframes | motion.summary.animationStack |
| Scroll | Lenis lerp … / native | motion.lenis |
| GPU | three.js / unicorn / none | surface-map.json |
| Sliders | Swiper params … | motion.sliders |
| Fonts | families (display / text), self-hosted or Google | tokens.fontFaces, loadedFonts |

## Design system (measured)
palette top values with roles · type scale @1440 (h1/h2/body/label) and what changes @768/@390 · spacing rhythm · radii · shadows · max-widths · authored breakpoints · the site's own custom properties

## Sections (top → bottom)
| # | slug | height | interaction model | effects | assets |

## Effects — how the impressive ones work
one block per Med/High effect: what it looks like · what it is (the "oh, that's all") · exact params (paste the motion.json entry) · rebuild note

## Assets by tier
## Build plan
substrate · packages · order · known gaps (cross-origin sheets unread, un-instrumented IO, CANVAS_UNKNOWN, premium plugins)
```

Common reveals to name when the signature shows: image sequence on scroll (many sibling imgs + scrub), SplitText reveal (`.char/.word` wrappers), parallax layers (sibling tweens with different y), scrub (`scrub: number` = lerp), pinned section (`pin: true`, long `end`), CSS-var driven progress, Lenis smooth scroll, page transitions (barba/swup + overlay), grain overlay (fixed div, feTurbulence, blend mode), custom cursor (fixed dot + ring, quickTo), marquee (translateX −50 % keyframes), magnetic buttons, reveal-on-scroll (IO threshold 0.1–0.3), theme flip by section, text scramble/counter (rAF writing textContent — OBSERVED only).
