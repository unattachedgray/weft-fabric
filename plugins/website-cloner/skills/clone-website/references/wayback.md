# Wayback Machine sources

`extract.js` detects `web.archive.org/web/<timestamp>/<url>` and rewrites it to the `if_` modifier (no toolbar, assets still rewritten so they load). Remaining toolbar elements are stripped after load. `capture.meta.url` holds the original URL, `capture.meta.loadedUrl` the archive URL.

Modifiers: `if_` page without toolbar · `id_` raw original bytes (assets, stylesheets) · `im_` images · `cs_` CSS · `js_` JS.

Rate limits: ~2 page fetches/s, CDX ~60/min. On 429 back off 4 s → 8 s → 16 s; on 503 wait 60 s. The extractor's asset downloads go through the browser context and inherit its pacing; if many assets fail, re-run with fewer breakpoints or download the failed list from `assets/manifest.json › failed` with the `id_` modifier and 500 ms spacing.

Asset fallback chain when a URL is missing at the exact timestamp:
1. exact timestamp + `im_`/`id_` · 2. exact timestamp · 3. `/web/im_/<url>` (closest capture) · 4. `/web/2/<url>` (latest) · 5. the live original URL.

CDX lookup: `https://web.archive.org/cdx/search/cdx?url=<url>&output=json&filter=statuscode:200&fl=timestamp,original,mimetype,length&limit=5`.

Archived stylesheets are cross-origin: `document.styleSheets[n].cssRules` throws, so the extractor injects the captured CSS text as a shadow `<style media="not all">` to read `@font-face`, `@media` and `@keyframes` from it. Check `capture.stylesheets[].readable` and `source`.

Next.js `_next/image?url=…` endpoints are not replayable; decode the `url` parameter and fetch that path from the archive.
