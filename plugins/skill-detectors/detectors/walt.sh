#!/usr/bin/env bash
# Detector: walt-web-tools
#
# Fires when the cwd already contains a `walt-tools/` directory with at least
# one tool JSON inside, i.e. the user has invested in WALT for this project
# and would benefit from routing web-automation questions through the skill
# instead of through the default /browser skill or hand-written Playwright.

set -u

cwd="$PWD"

# 1. Must have walt-tools/ directory.
[ -d "$cwd/walt-tools" ] || exit 0

# 2. Must have at least one tool JSON anywhere underneath (some users keep
#    nested per-site directories like walt-tools/zillow/search_homes.json).
count=$(find "$cwd/walt-tools" -maxdepth 4 -type f -name '*.json' 2>/dev/null | wc -l)
[ "$count" -ge 1 ] || exit 0

# 3. Emit route signal — no user prompt, just silently prefer the skill for
#    web-automation questions in this repo this session.
printf 'SKILL_SIGNAL {"skill":"walt-web-tools","action":"route","reason":"walt-tools/ directory found with %s tool(s); user has already invested in WALT for this project","prompt":"","scope":"this repo, this session"}\n' "$count"
