#!/usr/bin/env bash
# Release: regen catalog → stage → commit → push.
# Usage: bash scripts/release.sh "commit message here"
#
# This is the canonical way to publish changes to the unatt marketplace.
# It runs the catalog regenerator, stages everything, commits, and pushes —
# so consumers fetch the new commit-SHA at next session start.

set -eu

if [ "$#" -lt 1 ]; then
  echo "usage: bash $0 \"commit message\"" >&2
  exit 1
fi
msg="$*"

repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"

# 1. Regenerate the catalog from current plugin metadata.
bash "$repo/scripts/regen-catalog.sh"

# 2. Anything to publish?
if git diff --quiet HEAD && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "release.sh: nothing to commit."
  exit 0
fi

# 3. Stage everything (intentional — release publishes the whole working tree).
git add -A

# 4. Commit.
git commit -m "$msg"

# 5. Push. Prefer git's configured credentials; fall back to gh-token-in-URL.
if ! git push origin HEAD 2>/dev/null; then
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    remote="$(git config --get remote.origin.url)"
    # Strip any existing auth out of the URL
    clean="${remote#https://*@}"; clean="${clean#https://}"
    user="$(gh api user --jq .login)"
    git push "https://${user}:$(gh auth token)@${clean}" HEAD:main
  else
    echo "release.sh: push failed. Run 'gh auth setup-git' or fix git credentials." >&2
    exit 1
  fi
fi

echo ""
echo "release.sh: published. Consumers will auto-fetch at next session start."
echo "             (or '/plugin marketplace update unatt' to refresh immediately)"
