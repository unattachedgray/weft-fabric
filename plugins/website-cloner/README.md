# website-cloner

Clone a live web page into an editable codebase, and prove how close it is.

`/clone-website <url>` runs a measure → spec → build → score loop. Deterministic Node + Playwright scripts do every measurement and every comparison; the model reads the evidence, decides the interaction model, builds each section, and repairs the worst measured one. The output is a workspace on disk with reference screenshots, a per-section DNA of computed values, the authored CSS that applies to each section, runtime animation parameters, interaction contracts, localized assets, builder specs, and a QA report with diff images.

```
skills/clone-website/
├── SKILL.md                 the orchestration (any CLI; Claude Code also gets the agents/)
├── scripts/
│   ├── setup.sh             npm install + Chromium (once)
│   ├── extract.js           Phase 1, headless Chromium — the default
│   ├── armed.js             Phase 1 through the user's armed Firefox tab (Browser Tunnel)
│   ├── spec.js              specs/NN-slug.spec.md from the workspace
│   ├── tokens.js            build/tokens.css (site custom props verbatim + measured tokens)
│   ├── snapshot.js          fidelity fast path: HTML + own CSS + local assets
│   ├── compare.js           heights → per-section pixelmatch → slices → element deltas
│   ├── check.js             sections / hotlinks / fingerprints / interaction-contract replay
│   └── lib/probes.js        the in-page code (runs in Chromium and in the armed Firefox tab)
└── references/              workspace, protocol, build strategies, interaction model, visual QA, assets, wayback, armed tab, teardown, sources
agents/                      extractor · builder · comparator (Claude Code sub-agents)
```

## Install

Through the fabric: `wagent sync --local` links `clone-website` into every CLI's skills dir. Then once:

```bash
bash ~/.claude/skills/clone-website/scripts/setup.sh
```

Requires Node ≥ 18. The armed-tab path also needs the `firefox-control` skill and a Browser Tunnel session.

## Where it came from

Two repositories the owner named — JCodesMore/ai-website-cloner-template (the foreman/spec/dispatch model) and azeembuilds/website-cloner (Playwright scripts, sub-agent protocol, pixelmatch loop) — plus cth9191/site-clone (runtime probes, fast path, QA gotchas), ericshang98/Perfect-Web-Clone (authored-CSS matching, integrity, gate order, honest handoff) and andreasskyt/claude-website-cloner-skill (plain HTML default). What was taken from each, what was left out and why, and the practitioner evidence: `skills/clone-website/references/sources.md`. All MIT.

## Measured

2026-09-05, this machine: playwright.dev snapshot 100 % on 4/4 sections at three breakpoints; a deliberately damaged copy caught at 10.75 % / 30.58 % with the exact element delta named. astro.build: 12 sections, 10/12 pass on the JS-stripped snapshot, 10 of 11 tab contracts correctly failed as inert. Through the tunnel: the 73 KB probe bundle installs by `eval`, the census and tokens match the headless run.
