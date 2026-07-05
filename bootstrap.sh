#!/usr/bin/env bash
# bootstrap.sh — onboard a fresh machine in one command:
#   1. sync the shared operating principles into every agent CLI (Claude Code, Codex, Antigravity)
#   2. register the `unatt` skills marketplace so you can install skills on demand
#
# Fresh machine (repo not cloned yet) — the repo is PUBLIC, so no auth needed:
#   git clone https://github.com/unattachedgray/claude-skills ~/dev/claude-skills \
#     && ~/dev/claude-skills/bootstrap.sh
#
# Already cloned: just run  ./bootstrap.sh  — re-run any time to pull latest + re-sync.
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"

echo "== 1/3  update marketplace repo =="
git pull --ff-only 2>/dev/null && echo "  pulled latest" || echo "  (skipped pull — offline, or local edits present)"

echo "== 2/3  principles -> every agent CLI (idempotent) =="
bash "$REPO/scripts/deploy-principles.sh"

echo "== 3/3  register the skills marketplace with Claude Code =="
if command -v claude >/dev/null 2>&1; then
  if claude plugin marketplace list 2>/dev/null | grep -qiE 'unatt|claude-skills'; then
    echo "  marketplace already registered; refreshing to latest…"
    claude plugin marketplace update unatt 2>/dev/null || true
  else
    claude plugin marketplace add unattachedgray/claude-skills && echo "  added marketplace 'unatt'"
  fi
  cat <<'NEXT'

  Skills are now a command away. Examples:
     claude plugin install workflow@unatt      # dev lifecycle, planning, orchestration
     claude plugin install review@unatt        # code review + security
     claude plugin install engineering@unatt   # deep-module design, TDD, ADRs
  See everything available (even uninstalled):
     claude plugin install catalog@unatt       # then ask Claude "what skills are available?"
NEXT
else
  echo "  'claude' CLI not found — install Claude Code, then run:"
  echo "     claude plugin marketplace add unattachedgray/claude-skills"
fi

echo
echo "done — principles active in every CLI; skills an install away."
