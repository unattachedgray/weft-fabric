#!/usr/bin/env bash
# Prompt-detector: github-url
#
# Receives the user's prompt text on stdin. Extracts GitHub repo references
# and emits one SKILL_SIGNAL_CANDIDATE line per unique repo found. The
# assistant then runs the three-criteria gate from the CLAUDE.md curation
# rule and proposes a detector if it passes.

set -u

prompt="$(cat)"
[ -n "$prompt" ] || exit 0

# Match:
#   https://github.com/owner/repo[/...]
#   http://github.com/owner/repo[/...]
#   github.com/owner/repo[/...]      (bare host)
#   gh:owner/repo                    (shorthand)
# Owner / repo allow letters, digits, dot, underscore, hyphen.
#
# Use grep -Eo to extract just the matches, then awk to normalize to
# `owner/repo` form, dedupe.

repos="$(printf '%s' "$prompt" \
  | grep -Eoi '(https?://github\.com/|github\.com/|gh:)[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+' \
  | sed -E 's#^(https?://)?github\.com/##; s#^gh:##; s#\.git$##; s#/$##' \
  | awk '!seen[$0]++')"

[ -n "$repos" ] || exit 0

while IFS= read -r repo; do
  [ -n "$repo" ] || continue
  printf 'SKILL_SIGNAL_CANDIDATE {"candidate":"github.com/%s","source":"user prompt","instruction":"Evaluate this project against the three-criteria gate in ~/.claude/CLAUDE.md (categorically better; forgettable; cheaply detectable from project state). If all three hold, propose a detector entry before finishing your reply. If not, do not bring it up."}\n' "$repo"
done <<< "$repos"
