---
name: design-taste-frontend
description: Anti-slop frontend skill for landing pages, portfolios, and redesigns. The agent reads the brief, infers the right design direction, and ships interfaces that do not look templated. Real design systems when applicable, audit-first on redesigns, strict pre-flight check.
---
# Anti-slop frontend

For landing pages, portfolios, marketing sites and redesigns. Not for dashboards, data tables, multi-step forms, editors or native mobile: say so, use the fitting design system, and apply only the parts that fit. Every rule yields to an explicit brief.

## 1. Read the brief first

Read page kind, vibe words, references, audience, existing brand assets, and quiet constraints (accessibility, public sector, regulated, trust-first, children). Quiet constraints override aesthetics. The audience picks the aesthetic, not your taste.

State one line before any code: **"Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <system or aesthetic>."**

If the read truly diverges, ask exactly one question. Otherwise declare it and proceed.

## 2. Set three dials

`DESIGN_VARIANCE` (1 symmetry, 10 chaos), `MOTION_INTENSITY` (1 static, 10 cinematic), `VISUAL_DENSITY` (1 gallery, 10 cockpit). Baseline `8 / 6 / 4`.

| Read | V | M | D |
|---|---|---|---|
| Minimal, calm, editorial, Linear-style | 5-6 | 3-4 | 2-3 |
| Premium consumer, luxury | 7-8 | 5-7 | 3-4 |
| Playful, agency, experimental | 9-10 | 8-10 | 3-4 |
| Developer portfolio | 6 | 5 | 4 |
| Public sector, regulated, accessibility-critical | 3-4 | 2-3 | 4-5 |
| Redesign, preserve | match | +1 | match |
| Redesign, overhaul | +2 | +2 | match |

Above variance 4, asymmetric layouts collapse to one column under 768px, declared per section. If motion is claimed above 4, the page must actually move; if working motion is out of scope, drop to 3 and ship clean static.

## 3. Foundation

If the brief reads as a real system, install the official package and do not recreate its CSS: Fluent (`@fluentui/react-components`), Material (`@material/web`), Carbon (`@carbon/react`), Polaris, Atlaskit, Primer, `govuk-frontend`, `uswds`, Bootstrap 5.3, Radix Themes, shadcn/ui (never in its default state). One system per project.

An aesthetic is not a system. Glass, bento, brutalism, editorial, aurora and kinetic type are native CSS plus Tailwind. Apple Liquid Glass has no official web package: label any web version an approximation, with a solid fallback under `prefers-reduced-transparency`.

Default stack: Next.js or React with Server Components, Tailwind v4 (`@tailwindcss/postcss` or the Vite plugin), Motion from `motion/react`, self-hosted fonts. Check `package.json` before importing anything.

- Isolate motion, scroll and pointer code in `'use client'` leaves.
- Never put continuous input (mouse, scroll) in `useState`. Use `useMotionValue`, `useTransform`, `useScroll`.
- Never use `window.addEventListener('scroll')`, `window.scrollY` in state, or rAF loops touching state.
- Prefer `whileInView` for simple reveals. Use GSAP only for real pin or scrub, with `start: "top top"`, and do not mix GSAP or Three.js with Motion in one tree.
- Use `min-h-[100dvh]`, never `h-screen`. Use CSS Grid, not flex percentage math.
- Animate only `transform` and `opacity`. Grain goes on fixed `pointer-events-none` layers only. Keep z-index systemic.

Icons: Phosphor, HugeIcons, Radix or Tabler. Lucide only on request. Never hand-draw icon SVGs. One family, one stroke width. No emoji unless the brief is playful.

## 4. Typography and colour

- **Inter is not the default.** Reach for Geist, Outfit, Cabinet Grotesk or Satoshi. Inter is fine for neutral or public-sector briefs.
- **Serif is not the default**, and "creative" is not a reason. It needs a brand that names one, or a truly editorial, luxury or heritage identity you can justify. Never default to Fraunces or Instrument Serif, and do not reuse a serif across consecutive projects.
- Emphasis inside a headline uses italic or bold of the same family, never a mixed-in family.
- Italic display words with `y g j p q` need `leading-[1.1]` minimum and `pb-1`.
- One accent, used across the whole page, saturation under 80%. One neutral family. One corner-radius system. One theme: sections do not flip light and dark.
- No AI purple-blue glow unless the brand is purple.
- **Premium-consumer ban:** warm cream, brass, clay, oxblood and espresso is the LLM default for cookware, wellness and artisan briefs. Do not reach for it unless the brand names it. Rotate instead: cold silver, forest and amber, black and tan, cobalt and cream, terracotta and slate, olive and brick, or monochrome with one pop.
- No pure `#000` or `#fff`. Design both modes unless the brief is print-like, and test both. WCAG AA everywhere, including buttons, placeholders, focus rings and ghost buttons over photos.

## 5. Layout

- **Hero:** fits the first viewport. Headline at most 2 lines, subtext at most 20 words, CTA visible, top padding at most `pt-24`. At most 4 text elements: optional eyebrow, headline, subtext, CTAs. No tagline, trust strip, pricing teaser or logo wall inside it. Plan type and image size together; a 4-line headline is a font-size error. Centered heroes only for manifesto or launch briefs above variance 4.
- **Nav:** one line on desktop, at most 80px tall.
- **Sections:** each layout family at most once per page; 8 sections need at least 4 families. No three equal feature cards. At most 2 consecutive image-text splits. No left-headline, right-explainer split header unless the right column carries something real.
- **Eyebrows:** at most one per three sections, hero included. Check mechanically: count `uppercase tracking` labels; the count must be at most ceil(sections / 3).
- **Bento:** N items, N cells, no blanks. Varied composition, and 2-3 cells with real visual variation.
- **Cards:** only when elevation means hierarchy. Tint shadows to the background.
- **CTAs:** one line at desktop, 3 words at most. One label per intent across the page.
- **Long lists:** over 5 items, use a different component. Spec sheets become card grids, grouped chunks or featured tiles, not hairlines under every row. No data dumps on marketing pages.
- **Forms:** label above, error below, no placeholder-as-label.
- **States:** loading skeletons, empty, error and `:active` feedback, all built.

## 6. Images and content

Landing pages are visual products. Order: image-generation tool if available, then real or `picsum.photos/seed/<descriptive>/w/h` images, then labelled TODO slots reported at the end. A text-only page is incomplete, not minimal. Even restrained pages need 2-3 real images.

- No div-built fake screenshots, dashboards or terminals. Use a real capture, a generated image, a real component, or nothing.
- Logo walls use real marks (Simple Icons, devicon) and nothing else: no labels under logos. They sit below the hero. Invented brands get a simple SVG monogram.
- Default section shape: headline up to 8 words, sub-paragraph up to 25 words, one asset or CTA.
- Quotes at most 3 lines, attributed by name and role.
- No invented precise numbers: real, or labelled mock.
- No generic names (Jane Doe, Acme, Nexus) and no filler verbs (elevate, seamless, unleash).
- One copy register per page.
- **Copy self-audit:** re-read every visible string. Replace anything broken, unclear, cute-but-wrong or mock-poetic with a plain sentence. Boring beats fake-clever.

## 7. Motion

Every animation must answer "what does this communicate?": hierarchy, sequence, feedback or state change. "It looked cool" fails. At most one marquee per page. Not every card needs a loop. Spring physics over linear easing. Honour `prefers-reduced-motion` above intensity 3, collapsing loops, parallax and hijacks to static. `useEffect` animations need cleanup.

Targets: LCP under 2.5s, INP under 200ms, CLS under 0.1. Run Lighthouse before calling a page done.

## 8. Banned tells

Unless the brief calls for them:

- **Em-dashes and en-dash separators anywhere visible.** Zero. Use a period, comma, colon, or hyphen.
- Neon glows, gradient headline text, custom cursors, crosshair decoration lines, vertical rotated text.
- Version labels in the hero (`V0.6`, `BETA`), version footers, fake status lines, `Brand · No. 01` meta.
- Section-number eyebrows (`001 · Capabilities`), `01 / 4` pagination, `Stage 1` step labels. Use the verb.
- Middle-dot chains, decorative status dots.
- Scroll cues. Locale, time and weather strips unless the place is the point.
- Pills over images, decorative photo credits, stock counters as decoration.
- Bottom-of-hero strips (`BRAND. MOTION. SPATIAL.`), floating corner sub-text in headers.
- "Quietly trusted by", "Field notes", "On our desks", and micro-sentences under headings.
- Scoring bars with filled tracks.

## 9. Redesigns

Detect the mode first; if unclear, ask once: preserve or start visually fresh?

Audit before touching: brand tokens, information architecture, content blocks, patterns to keep, tells to retire, the current dial reading, and the SEO baseline (the largest migration risk).

Levers, in order, stopping when satisfied: typography, spacing, colour, motion, recomposed hero and key sections, full block replacement. Sound IA and SEO mean targeted evolution; structural debt means full redesign with content preserved.

Never change without approval: URL slugs, primary nav labels, form field names or order, logo or wordmark, legal or consent copy. Preserve copy voice, accessibility wins and analytics hooks.

## 10. Pre-flight

The page is not done until each is honestly true:

- [ ] Design read and dials stated; system chosen or aesthetic labelled.
- [ ] Zero em-dashes visible.
- [ ] One theme, one accent, one radius system, one icon family.
- [ ] Contrast passes on every button, form and photo overlay.
- [ ] Hero fits: 2 lines, 20 words, CTA visible, 4 text elements, `pt-24`.
- [ ] Eyebrow count passes; nav on one line; CTAs on one line, one label per intent.
- [ ] No repeated section family, no 3+ image-text splits, bento cells exact.
- [ ] Real images, no fake UI, logo wall below the hero and logos only.
- [ ] Copy self-audit done; no invented numbers.
- [ ] Every animation justified; reduced motion honoured; cleanup present.
- [ ] Both modes tested; mobile collapse explicit; empty, loading and error states built.
- [ ] No tell from section 8.
