# Design taste skill

Design guidance and local tools for any visual surface. `SKILL.md` is what an agent reads; this page is for people maintaining it.

## Layout

| Path | Contents |
|---|---|
| `SKILL.md` | Surface modes, the taste rules, the pre-flight check, and the routing table |
| `references/impeccable/` | 29 task references adapted from Impeccable, with engine commands removed |
| `catalog/worlds.json` | 36 original directions drawn from real subject matter |
| `catalog/taste-skill/` | Directions, palettes, type, heroes, sections, motions and app styles, unchanged |
| `scripts/` | The tools below, plus `test_tools.py` |

## Tools

- `taste-check PATH`: scans source for tells (`slop`, advisory) and problems (`quality`, usually real). Exits 0 clean, 2 with findings, 1 when nothing was scannable.
- `render-check.mjs FILE`: renders in headless Chromium at 1440 and 390 and adds `polish` findings for optional refinements. Options: `--out DIR` for screenshots, `--operate` for app screens, `--no-scripts` for untrusted files, `--allow-remote`, `--no-history`.
- `site-study URL...`: runs the same probe on live sites in Firefox through Browser Tunnel. It uses background tabs, pauses between sites, closes each tab, and keeps numbers only. Sites with a strict content security policy block the probe.
- `deal "<brief>" --mode <mode>`: deals three worlds using BM25 relevance, a seeded choice inside the best band, and recent-deal exclusion. `deal keep|reject <id>` records a verdict that later deals read. `deal --roll N` picks from your own ranked list and never the first.
- `eval-detector FIXTURES RULES.json`: scores both checkers. Fixture file names must begin with the rule id.
- `import-impeccable CLONE`: re-imports the references. Review the diff afterwards.

Run the tests with `/usr/bin/python3 -m unittest test_tools.py` inside `scripts/`. They use a temporary state folder.

## State

`~/.local/state/design-taste/` holds `signatures.jsonl` (past renders), `references.jsonl` (studied sites) and `deals.jsonl` (deals and verdicts). All three store numbers and identifiers, never page text or screenshots. `XDG_STATE_HOME` moves the folder.

## Sources and licences

| Source | Commit | Licence | Taken |
|---|---|---|---|
| [Impeccable](https://github.com/pbakaus/impeccable) | `df3a4ab` | Apache-2.0 | References, plus rule ids and descriptions as the detector's checklist |
| [taste-skill](https://github.com/Leonxlnx/taste-skill) | `12af471` | MIT | Data files and ideas only; its scripts were never run |

Each imported folder carries its licence and notice. Left out on purpose: Impeccable's downloaded engine and remote catalog, taste-skill's `sites.json` and `photos.json`. Fonts in `type.json` resolve to remote CDNs, so self-host them.

## Measurements

Taken on 2026-10-30 against Impeccable's `tests/fixtures/antipatterns`.

| Measure | Result | Caveat |
|---|---|---|
| Canonical fixture recall | 37 of 40 rules, 92% | The rules were written against these files, so this is a fit score |
| Held-out variants | Own rule fired on 57 of 91, 63% | Some variants are negative by design, so this is a rough floor |
| False alarms | Not measured | Six real article pages drew many findings, some likely deliberate |

Misses are `script-error` (fixtures render with scripts off), `first-viewport-column-overflow` and `repeated-container-text`. The four `design-system-*` rules are not implemented.

**Keep findings advisory.** taste-skill's own trials reached zero failures yet won only 4 of 16 briefs against the baseline, under model judges and a small sample. No study we found measures rotation or concept tournaments, so `deal` is a reasoned design, not a proven one.

## Machine notes

Ubuntu 26.04 blocks Chromium's sandbox here, so `render-check` runs with `--no-sandbox` and refuses remote pages unless given `--allow-remote`. It finds the Playwright headless shell in `~/.cache/ms-playwright`; set `CHROME_PATH` to override. Its screenshots show a private headless page, not the desktop.

## Next

- Grow `worlds.json` from real projects, and use `keep` and `reject` so deals learn from the owner.
- Run `site-study` on admired sites, then use those references as a human baseline for the sameness score.
- Measure false alarms on pages the owner rates.
- Consider axe-core as an unmodified dependency, the colour distance from Design Theater (arXiv 2607.22928), and the `design-system-*` rules.
