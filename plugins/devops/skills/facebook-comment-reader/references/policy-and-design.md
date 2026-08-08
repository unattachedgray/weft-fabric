# Policy and design notes

Verified 2026-08-03.

## Load-bearing findings

- Facebook Terms prohibit automated collection without prior permission and prohibit bypassing technical controls: https://www.facebook.com/terms
- Meta's separate Automated Data Collection Terms state that accepting the terms is not permission: https://www.facebook.com/legal/automated_data_collection_terms
- Meta removed the Groups API on 2024-04-22: https://developers.facebook.com/blog/post/2024/01/23/introducing-facebook-graph-and-marketing-api-v19/
- Page APIs can apply to managed/approved Pages, but do not provide general access to arbitrary visible posts: https://developers.facebook.com/docs/pages-api/overview/
- Facebook's supported UI exposes an ordering control such as Most relevant / All comments: https://www.facebook.com/help/539680519386145/

## Adopted implementation pattern

Use a user-triggered, visible, single-post assistant. Separate browser interaction from deterministic local extraction. Prefer semantic roles and accessible labels within a tightly scoped post/dialog; treat hashed CSS classes as ephemeral. Click one control, wait for DOM growth/loading to settle, snapshot, parse, deduplicate, and checkpoint.

Completion means **all comments rendered and accessible in this session after UI exhaustion**, not all comments that ever existed. Deleted, hidden, moderated, privacy-restricted, or unavailable comments can make the displayed count unattainable.

## Rejected patterns

- Private endpoint/GraphQL replay
- Stealth browser modifications or randomized behavior intended to evade detection
- Proxy/VPN rotation
- Infinite retries or attempting to pass a checkpoint
- Credential storage in scripts
- Unbounded feed scrolling

Useful public implementation patterns include cursor pagination with stable-ID deduplication for authorized APIs, and role/text-based expansion with hard caps for visible UI. Facebook's changing DOM makes unattended class-based scrapers brittle.
