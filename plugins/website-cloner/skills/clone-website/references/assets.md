# Assets — the resolution ladder and the honesty labels

Without real assets a first pass lands around 40 % match; with them 80 %+. The extractor captures assets from the network (every image/font/css/media response), from the DOM (img src/srcset, picture sources, background-image url(), favicons, og:image, video src/poster, @font-face src), and every inline SVG (with `<use>` sprite references resolved, `xmlns` added, fill strategy and a logo/icon/decorative/illustration classification). `assets/manifest.json` maps each URL to its file.

## Tiers — label every asset with the one used

1. **REAL** — the downloaded file. Default. `spec.js` marks these with the local path.
2. **RECONSTRUCT** — cheaply rebuildable: inline SVG, CSS gradient, a divider. License-clean.
3. **CAPTURED** — a screenshot of a *composited* region (live UI over a wallpaper) when the download would give only the wallpaper. Say CAPTURED, not REAL.
4. **PLACEHOLDER** — neutral block or blurhash with the exact aspect ratio, `data-original-src` kept.

Generated substitutes (image models) are allowed only for decorative material — background textures, ambient video, particle sprites — and only with the user's approval; label them GENERATED and log why REAL failed. **Never** for logos, wordmarks, product screenshots, real UI, photos of people, certification marks: those are REAL or PLACEHOLDER.

## Traps

- **Composited mocks.** A hero "image" that is DOM text and buttons layered over a background: `dna.json › layered` lists containers with 2+ stacked images/backgrounds. Reproduce every layer, or CAPTURE the region at the scroll offset where it is fully visible.
- **Reused wallpapers.** Sites reuse one background across several feature blocks; identify a block by its own container rect, never by "the nth img".
- **srcset / picture.** The manifest holds every candidate; use the one matching the rendered width or the largest.
- **Next.js `_next/image` URLs** carry the real source in the `url` query parameter; decode it when a download 404s.
- **Fonts.** `tokens-<w>.json › fontFaces` lists families/weights/sources; `loadedFonts` what actually rendered. Self-host from `assets/fonts/` with `@font-face`, or link the same Google/Typekit stylesheet. Wrong font is the #1 tell. Downloaded font files are for local study; the licence is the user's responsibility — say so in the report.
- **Under 200 bytes** is flagged `suspicious` in the manifest (failed download or tracking pixel).

## Report

Break assets down by tier: N REAL, N RECONSTRUCT, N CAPTURED, N PLACEHOLDER (N GENERATED with approval). A clone that is 95 % REAL with two labelled placeholders is honest; one silently padded with generated brand assets is not.
