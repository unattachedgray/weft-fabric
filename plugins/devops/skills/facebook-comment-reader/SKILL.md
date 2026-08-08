---
name: facebook-comment-reader
description: Analyze local `facebook-rendered-comments/v1` JSON exports from the Browser Tunnel extension. Use when Codex needs to validate, filter, classify, summarize, compare, or turn exported Facebook comments and attached-media metadata into documents or datasets; do not use this skill to crawl or expand Facebook.
---

# Facebook Comment Export Analyzer

Analyze local exports; do not operate Facebook or collect additional data.

## Workflow

1. Receive a local JSON export created by the Browser Tunnel extension's **Export expanded comments** action.
2. Run `scripts/validate_export.py PATH`. Stop if the schema is unsupported or required fields are malformed.
3. Read `summary.completeness` and `summary.remainingExpansionControls` before making completeness claims.
4. Work from `comments[]`:
   - Preserve `author`, `timestamp`, `text`, `reactions`, `permalink`, reply relationship, and `media` provenance.
   - Treat `text` as rendered UI text; remove action labels only in derived prose, never by rewriting the source export.
   - Treat culture/language/country identifications as commenter claims unless independently verified. Label inferences explicitly.
   - Keep attached-media URLs, alt text, dimensions, and any local media manifest linked to the originating comment.
5. Deduplicate by `id`. When comparing multiple exports, prefer the newest nonempty field while retaining capture timestamps and provenance.
6. Produce the requested artifact plus a short data note: capture time, comment count, remaining controls, media count, and limitations.

## Safety and privacy

- Keep exports local unless the user explicitly requests sharing.
- Include commenter names/profile URLs only when relevant to the requested output. Prefer anonymized or attribution-free analysis by default.
- Do not infer sensitive traits from profiles or comments.
- Do not fetch missing comments, call Facebook endpoints, reuse credentials, or bypass access controls.

## References

Read [references/policy-and-design.md](references/policy-and-design.md) only when discussing collection boundaries or completeness.
