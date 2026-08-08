# Repository map

- Authored HTML: `web/fb/pages-src/<slug>.html`
- Search/manifest sidecar: `web/fb/pages-src/<slug>.md`
- Shared doc additions: `web/fb/pages-src/{reskin.css,makeover.css}`
- Builder: `web/fb/tools/build-page.py`
- Generated artifacts: `web/fb/public/pages/`
- Manifest: `web/fb/public/pages/index.json`
- Document RSS: `web/fb/public/pages/docs.xml`
- Verification: `web/fb/tools/{verify-page,verify-live,verify-spa,check-links}.mjs`
- Format reference: the repository's `docs/doc-pages-template.md`
- Theme handoff reference: the repository's `docs/theming.md`

`verify-page.mjs` may contain historical expectations tied to a flagship
document. Read its assertions before interpreting failures. A new undeployed
slug also makes its canonical live URL fail link checking by definition; this
does not excuse broken external source links.
