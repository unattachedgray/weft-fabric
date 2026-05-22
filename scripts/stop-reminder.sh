#!/usr/bin/env bash
# Stop-hook reminder: surfaces uncommitted changes in claude-skills so the
# user (or assistant) is reminded to run `scripts/release.sh` before
# wandering off.
#
# Wired via this repo's .claude/settings.json. Quiet on clean trees.

set -u

cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0
[ -d .git ] || exit 0

# Quiet exit if working tree is clean.
if git diff --quiet HEAD 2>/dev/null && [ -z "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
  exit 0
fi

n="$(git status --porcelain | wc -l | tr -d ' ')"
ahead="$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)"

# Build a one-line note for the user.
parts=""
if [ "$n" -gt 0 ]; then
  parts="$n uncommitted file(s)"
fi
if [ "$ahead" -gt 0 ]; then
  if [ -n "$parts" ]; then
    parts="$parts, $ahead unpushed commit(s)"
  else
    parts="$ahead unpushed commit(s)"
  fi
fi
[ -n "$parts" ] || exit 0

if command -v python3 >/dev/null 2>&1; then
  python3 -c "
import json
print(json.dumps({
    'systemMessage': '📦 claude-skills: $parts. Publish with: bash scripts/release.sh \"<message>\"'
}))
"
else
  printf '{"systemMessage":"claude-skills: %s. Publish with: bash scripts/release.sh \\"<message>\\""}\n' "$parts"
fi
