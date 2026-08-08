---
name: unattached-article
description: Turn user-provided research, notes, DOCX files, or prior drafts into a newly written, visually rich long-form document for the unattached.me `/doc/` collection and a shorter copy-ready Facebook text derivative at finalization. Use when Codex must author, redesign, build, publish, or verify an Unattached issue with an original narrative, evidence-led opening statistics, chapter-specific licensed photography or charts, exact issue-frame parity, source preservation, repository-native validation, and social-post handoff.
---

# Build an Unattached article

Work in the site repository containing `web/fb/pages-src/` and
`web/fb/tools/build-page.py`. Treat supplied research as evidence, not copy;
treat current published sources as the design authority.

## Workflow

1. Read repository instructions, `docs/doc-pages-template.md`, and
   `docs/theming.md`. Inspect the newest photo-rich issues and compare their
   opening frames, statistics, visual density, references, and mobile behavior.
2. Extract every supplied source before drafting. For DOCX, run
   `scripts/extract_docx.py INPUT.docx OUTPUT.md`; inspect headings, prose,
   tables, hyperlinks, and embedded media separately. Ignore stale Word page
   metadata.
3. Find the central question and narrative arc. Group evidence by what it
   proves, then write every title, transition, paragraph, caption, and
   conclusion anew. Do not preserve the source's order or wording unless a
   necessary primary passage is explicitly quoted.
4. Run a paragraph-value edit before design. Keep a paragraph only if it adds
   at least one of: a consequential fact, a defensible inference tied to named
   evidence, a distinction that prevents a likely misunderstanding, or a
   connection that explains cause, mechanism, scale, or consequence. Merge,
   rewrite, or delete scene-setting and transitions that merely sound serious.
   Apply the same test to titles, ledes, statistic labels, captions, and the
   conclusion.
5. Classify stable facts, time-sensitive facts, interpretation, and unresolved
   assertions. Recheck consequential or unstable claims with primary or
   authoritative sources. Preserve uncertainty and date every number.
6. Choose the slug, issue, series, `mark`, summary, tags, and provenance. Create
   both `pages-src/<slug>.html` and `<slug>.md`.
7. Copy the exact current issue-frame contract from a recent document: issue
   stamp, series, reading time, report meta, title, lede, evidence band,
   executive summary, TOC, section-wrapped chapters, references, and footer.
   Verify the frame visually against at least two existing issues.
8. Make the opening statistics tell a miniature argument. Use 4-5 consequential
   findings, not document metadata such as chapter/source counts. Give each
   figure a date, source, and limitation. Make one statistic dominant and let
   supporting figures establish mechanism, dependence, and consequence.
9. Give at least 80% of substantive chapters an evidence-bearing visual. Use a
   specific licensed photo of the central person, institution, place, artifact,
   or event; otherwise use a sourced chart, timeline, ownership map, flow
   diagram, or scale comparison. Symbolic imagery is a fallback, never filler.
   Read `references/editorial-pattern.md` before composing visuals.
10. Record descriptive alt text and analytical captions containing the subject,
   relevance, creator, and license. Avoid generic newsroom, laptop, skyline,
   microphone, or newspaper imagery.
11. Optimize embedded photographs before building. Run
    `scripts/optimize_images.sh OUTPUT_DIR INPUT...`, then embed the optimized
    copies. Compare the final page size with recent flagship documents; treat a
    multi-megabyte jump as a regression requiring review.
12. Build with the repository environment:
    `.venv/bin/python web/fb/tools/build-page.py <slug>`.
13. Run `verify-page.mjs`, `check-links.mjs`, and current SPA/card checks.
    Inspect screenshots in light and dark themes. Distinguish genuine failures
    from known historical or live-only assertions and fix real contrast,
    overflow, broken-source, CSP, or rendering problems.
14. When finalizing an article for upload, create
    `pages-src/<slug>-facebook.txt` from the verified article. Make it a
    self-contained, text-only Facebook post rather than an abstract or list of
    chapter summaries. Use a short methodological opening followed by
    `━━━━━━━━━━━━━━━━━━━━` dividers and descriptive bracketed section labels.
    Preserve the strongest dated figures, names, mechanisms, and limitations;
    distinguish ownership or exposure from proven editorial intervention. Keep
    it materially shorter than the article, apply the paragraph-value test, and
    add no Markdown syntax. Validate UTF-8 text, absence of tabs and trailing
    spaces, and a final newline so the whole file is directly copy/pasteable.
    Generate the document automatically; do not publish it to Facebook without
    separate authorization.
15. Stop before deployment unless publishing is authorized. After an authorized
    deploy, run `verify-live.mjs <slug>` and confirm the manifest, permalink,
    theme handoff, fonts, contrast, and iframe sandbox. Treat the Facebook text
    document as part of the completed upload handoff even when it is not a
    deployed site asset.

## Quality bar

- Build a coherent journey with escalating stakes, not a research inventory.
- Give every chapter one claim it exists to prove.
- Lead with evidence and structure, not chronology or document metadata.
- Reject manufactured profundity. Do not use an aphorism, rhetorical contrast,
  portentous fragment, or sweeping claim to lend importance to thin material.
  Never claim that something is hidden, decisive, inevitable, or newly revealed
  unless the reporting establishes that exact proposition.
- Make every paragraph earn its place through informational value, not tone.
  Concrete, surprising, or explanatory beats solemn. If removing a paragraph
  loses no fact, inference, distinction, mechanism, or consequence, remove it.
- Audit the opening twice: first for what each sentence literally says, then for
  whether its emphasis is proportional to the evidence. Prefer a precise title
  and useful lede over mystery, grandeur, or a promise to reveal a great truth.
- Distinguish legal ownership, practical control, editorial intervention, and
  social influence.
- Match current responsive, print, theme, accessibility, CSP, SEO, and issue-
  frame behavior.
- Never add drafting-process notes to the published narrative. Put provenance
  and update cautions in the designated method/reference surface.

Read `references/repository-map.md` for file and verifier orientation.
