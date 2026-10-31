---
name: design-taste-frontend
description: Design taste for any visual surface - websites, apps, dashboards, tools, GTK desktop panels, iOS and Android screens, documents and decks. Use when designing, redesigning, critiquing, auditing, polishing, simplifying or hardening an interface, or making one bolder or quieter. Reads the brief, sets the surface mode, avoids templated AI defaults, and verifies the rendered result.
---
# Design taste

For any visual surface. Work as a design director: production-grade result, a clear point of view, complete deliverable.

**The brief wins.** Honour pinned aesthetics, eras, materials, fonts and palettes even against a rule here. Redirecting a clear brief toward your taste is failure. Reaching for a banned default when the brief is silent means you were not deciding.

**Verify by looking.** Check the rendered result at the sizes it ships at, and batch the checks: fix what one look shows before looking again. Use a browser tab, a headless render or a private display. Capturing the owner's actual desktop needs their explicit confirmation every time.

## 0. Surface mode

The mode names what the visitor's success looks like. Choose it from the surface, not the product: a tool's landing page is Persuade, a fashion house's docs are Read.

| Mode | Surfaces | Ambition |
|---|---|---|
| **Persuade** | Landing, marketing, pricing, campaigns | Full commitment. The design is the product. The visitor can act from the opening. |
| **Operate** | Apps, dashboards, editors, settings, tools, trainers, admin | Precision. Familiar controls and scanability outrank expression. The world lends only type, palette, density and one signature move, never the layout or controls. |
| **Read** | Docs, articles, guides, changelogs | The world owns the frame; the reading column stays calm, 60-75 characters. |
| **Experience** | Portfolios, galleries, showcases, games | The artifact leads and the interface recedes. |

Sections 4 to 8 are written for Persuade and Experience on the web. On Operate and Read keep their intent, and let `references/impeccable/mode-operate.md`, `mode-read.md` and `operate.md` decide where they differ. **Test for Operate:** could a category-fluent user trust it at once? The failure is strangeness without purpose, not plainness.

Native surfaces use the platform's own controls: `ios.md`, `android.md`, `adapt.native.md`, `audit.native.md`. GTK panels follow the GNOME conventions and system theme unless the brief says otherwise.

**Refinement preserves; redesign replaces.** Refinement keeps identity, behaviour, copy and everything out of scope. Redesign keeps product truth, content and function, but treats the old look as evidence. Never split the difference into polish on a discarded look.

**Specificity test:** could an unrelated product use this unchanged? If yes, it is not designed yet. With every check green, spend the surface on the committed world; when torn between refined and committed, commit.

## Before designing

Generic rules are not what fixes generic output. Practitioners report that stacked skills still converge on one landing page when no layer carries anything specific to the project. So gather that first:

1. **Real material:** the product's actual content, data, names, assets, and sites the owner admires.
2. **A direction from outside the category:** `scripts/deal "<brief>" --mode <mode>` deals three worlds. Or rank your own list and let `scripts/deal --roll N` choose; your first idea is what every run would ship. Offer the owner three visibly different options, and record their answer with `scripts/deal keep|reject <id>`, which later deals read.
3. **Rules in code, not prose:** turn the direction into tokens the project uses. A `DESIGN.md` is a router to those tokens and components, not a substitute.
4. **One section at a time.** Never add an effect nobody asked for.

Take the world's palette, type and signature move, never its props. On Operate surfaces it lends those three things and density only. `catalog/worlds.json` is original and meant to grow; `catalog/taste-skill/` holds directions, palettes, type, heroes, sections, motions and app styles to adapt, not copy. Reusable lists become the next tells, so add worlds from each real project.

## 1. Read the brief first

Read page kind, vibe words, references, audience, existing brand assets, and quiet constraints (accessibility, public sector, regulated, trust-first, children). Quiet constraints override aesthetics. The audience picks the aesthetic, not your taste.

State one line before any code: **"Reading this as: <mode> surface, <kind> for <audience>, with a <vibe> language, leaning toward <system or aesthetic>."**

Read `DESIGN.md` or the project's tokens and components first when they exist; a coherent identity in code is inherited, even undocumented. Record a durable new decision there.

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
| Operate surface | 2-4 | 2-3 | 5-8 |
| Read surface | 3-5 | 2-3 | 3-4 |

Above variance 4, asymmetric layouts collapse to one column under 768px, declared per section. If motion is claimed above 4, the page must actually move; if working motion is out of scope, drop to 3 and ship clean static.

## 3. Foundation

On the web, if the brief reads as a real system, install the official package and do not recreate its CSS: Fluent (`@fluentui/react-components`), Material (`@material/web`), Carbon (`@carbon/react`), Polaris, Atlaskit, Primer, `govuk-frontend`, `uswds`, Bootstrap 5.3, Radix Themes, shadcn/ui (never in its default state). One system per project.

An aesthetic is not a system. Glass, bento, brutalism, editorial, aurora and kinetic type are native CSS plus Tailwind. Apple Liquid Glass has no official web package: label any web version an approximation, with a solid fallback under `prefers-reduced-transparency`.

Default web stack: Next.js or React with Server Components, Tailwind v4 (`@tailwindcss/postcss` or the Vite plugin), Motion from `motion/react`, self-hosted fonts. Check `package.json` before importing anything.

- Isolate motion, scroll and pointer code in `'use client'` leaves.
- Never put continuous input (mouse, scroll) in `useState`. Use `useMotionValue`, `useTransform`, `useScroll`.
- Never use `window.addEventListener('scroll')`, `window.scrollY` in state, or rAF loops touching state.
- Prefer `whileInView` for simple reveals. Use GSAP only for real pin or scrub, with `start: "top top"`, and do not mix GSAP or Three.js with Motion in one tree.
- Use `min-h-[100dvh]`, never `h-screen`. Use CSS Grid, not flex percentage math.
- Start with `transform` and `opacity`. Blur, `backdrop-filter`, `clip-path`, mask and shadow are allowed when they stay smooth on the target hardware. Grain goes on fixed `pointer-events-none` layers only. Keep z-index systemic.

Icons: Phosphor, HugeIcons, Radix or Tabler. Lucide only on request. Never hand-draw icon SVGs. One family, one stroke width. No emoji unless the brief is playful.

## 4. Typography and colour

- **Inter is not the default.** Reach for Geist, Outfit, Cabinet Grotesk or Satoshi. Inter is fine for neutral or public-sector briefs.
- **Serif is not the default**, and "creative" is not a reason. It needs a brand that names one, or a truly editorial, luxury or heritage identity you can justify. Never default to Fraunces or Instrument Serif, and do not reuse a serif across consecutive projects.
- Emphasis inside a headline uses italic or bold of the same family, never a mixed-in family.
- Italic display words with `y g j p q` need `leading-[1.1]` minimum and `pb-1`.
- Choose a colour strategy first: Restrained (tinted neutrals, one accent), Committed (one saturated colour carries 30-60%), or a full palette. On Operate, colour does real jobs: state, data, selection, a shell that is not plain grey.
- One accent, used across the whole page, saturation under 80%. One neutral family. One corner-radius system. One theme: sections do not flip light and dark.
- No AI purple-blue glow unless the brand is purple.
- **Premium-consumer ban:** warm cream, brass, clay, oxblood and espresso is the LLM default for cookware, wellness and artisan briefs. Do not reach for it unless the brand names it. Rotate instead: cold silver, forest and amber, black and tan, cobalt and cream, terracotta and slate, olive and brick, or monochrome with one pop.
- No pure `#000` or `#fff`. Pick light or dark from the use scene (who, where, what ambient light), not the category. Ship both on Operate and Read, or when the brief asks, and test both. WCAG AA everywhere, including buttons, placeholders, focus rings and ghost buttons over photos.

## 5. Layout

- **Hero:** fits the first viewport. Headline at most 2 lines, subtext at most 20 words, CTA visible, top padding at most `pt-24`. At most 4 text elements: optional eyebrow, headline, subtext, CTAs. No tagline, trust strip, pricing teaser or logo wall inside it. Plan type and image size together; a 4-line headline is a font-size error. Centered heroes only for manifesto or launch briefs above variance 4.
- **Nav:** one line on desktop, at most 80px tall.
- **Sections:** each layout family at most once per page; 8 sections need at least 4 families. No three equal feature cards. At most 2 consecutive image-text splits. No left-headline, right-explainer split header unless the right column carries something real.
- **Eyebrows:** none by default; a heading carries its own weight. The hard ceiling is one per three sections, hero included. Check mechanically: count `uppercase tracking` labels; the count must be at most ceil(sections / 3).
- **Bento:** N items, N cells, no blanks. Varied composition, and 2-3 cells with real visual variation.
- **Cards:** only when elevation means hierarchy, never nested. Tint shadows to the background. Declare elevation once, border or shadow.
- **Modals:** only when a task needs interruption or protected focus.
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

One authored moment, not scattered effects or the same entrance on every section. Every animation must answer "what does this communicate?": hierarchy, sequence, feedback or state change. "It looked cool" fails. At most one marquee per page. Not every card needs a loop. Spring physics over linear easing. Honour `prefers-reduced-motion` above intensity 3, collapsing loops, parallax and hijacks to static. `useEffect` animations need cleanup.

Targets: LCP under 2.5s, INP under 200ms, CLS under 0.1. Run Lighthouse before calling a page done.

## 8. Banned tells

Unless the brief calls for them:

- **Em-dashes and en-dash separators anywhere visible.** Zero. Use a period, comma, colon, or hyphen.
- Coloured side stripes above 1px on cards and alerts, hard offset shadows outside a real neobrutalist world, the hero-metric template, monospace as a costume for "technical", emoji or Unicode as icons, sparklines and rings standing in for content.
- Decorative emblems tied to militarism, supremacy or hate movements, however well they suit the subject. Documenting one as fact is fine.
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

## 10. Browser surfaces

The parts you did not draw still carry the design: text selection, caret, scrollbars, focus rings, underline offset, tabular numerals. Theme them from the palette. It is the cheapest sign of a built page, and the one models skip.

## 11. Pre-flight

Not done until each is honestly true. Skip the ones the mode rules out:

- [ ] Mode, design read and dials stated; system chosen or aesthetic labelled.
- [ ] Rendered and looked at, at shipping sizes. Specificity test passes.
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

## 12. Check the result

Run these after building, and treat the output as evidence, not a verdict. Passing proves little: taste-skill's own trials had its checker reach zero failures while judges still often preferred the baseline. Never use a clean report as the argument that a design is good.

| Tool | Use |
|---|---|
| `scripts/taste-check PATH` | Source tells. `quality` findings are usually real; `slop` findings are advisory. |
| `scripts/render-check.mjs file.html --out DIR` | Renders at 1440 and 390 in headless Chromium: contrast, overflow, hierarchy, composition. `polish` findings are optional. Add `--operate` for app screens. |
| `scripts/site-study URL...` | Runs the same probe on live sites in Firefox background tabs through Browser Tunnel, keeping numbers only. Use it on sites the owner admires. |
| `scripts/eval-detector` | Scores both checkers on a labelled fixture folder. Run it after changing a rule. |

`render-check` reports the most similar past render from its history. A high score means this looks like earlier work, which is the sameness a rule cannot catch. Headless Chromium has no sandbox on this machine, so it refuses remote pages unless you pass `--allow-remote`; use `site-study` for those, and `--no-scripts` for untrusted local files. Its screenshots show a private headless page, not the owner's desktop.

## 13. Task references

Read the one that fits, in `references/impeccable/`, adapted from [Impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0, see `NOTICE.md`). The brief and sections 0 to 11 outrank them where they differ.

| Task | Read |
|---|---|
| Floor and bans before any UI edit | `craft-floor.md` |
| New surface or replaced identity | `new-work.md`, the fitting `mode-*.md` |
| Plan UX before building | `shape.md` |
| Operate depth | `operate.md` |
| Make it bolder, quieter, simpler | `bolder.md`, `quieter.md`, `distill.md` |
| Colour, type, layout, motion | `colorize.md`, `typeset.md`, `layout.md`, `animate.md` |
| Copy, labels, errors | `clarify.md` |
| First run, empty states | `onboard.md` |
| Personality, ambitious effects | `delight.md`, `overdrive.md` |
| Errors, i18n, edge cases | `harden.md` |
| Screen sizes, performance | `adapt.md`, `optimize.md` |
| Technical check, final pass | `audit.md`, `polish.md` |
| Reusable tokens and components | `extract.md` |

**Critique:** run two independent assessments so one does not anchor the other. One is a design review: specificity, hierarchy, Nielsen heuristics scored 0-4, cognitive load and persona checks from `critique.md`. The other is evidence from the render and tests. Then synthesise strengths and 3-5 priority issues.

Update with `scripts/import-impeccable <clone>`, then review the diff.
