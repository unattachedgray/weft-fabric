#!/usr/bin/env bash
# Give Cursor the shared-library contract in a project.
#
# Cursor has NO global instruction file — verified 2026-08-08 by probing a
# scratch dir: ~/.cursor/AGENTS.md and ~/.cursor/rules/*.mdc are both invisible,
# while project-level AGENTS.md, .cursorrules and .cursor/rules/*.mdc all load.
# So the contract has to be installed per project.
#
# We use .cursor/rules/ rather than AGENTS.md because several of these repos
# already have an AGENTS.md that belongs to another tool (weft's diverges from
# upstream Hermes and is rebase-sensitive) — this adds a Cursor-only file and
# touches nothing else. It is a SYMLINK, per the arrangement's no-copies rule:
# edit the canonical file and every project follows.
#
#   scripts/install-cursor-rule.sh ~/dev/foo ~/dev/bar
#   scripts/install-cursor-rule.sh --all      # every git repo directly under ~/dev
set -euo pipefail
CANON="/home/julian/dev/claude-skills/cursor/shared-skill-library.mdc"
[ -f "$CANON" ] || { echo "missing canonical rule: $CANON" >&2; exit 1; }

targets=()
if [ "${1:-}" = "--all" ]; then
  for d in "$HOME"/dev/*/; do [ -d "$d/.git" ] && targets+=("${d%/}"); done
else
  targets=("$@")
fi
[ ${#targets[@]} -gt 0 ] || { echo "usage: $0 <project-dir>... | --all" >&2; exit 1; }

for t in "${targets[@]}"; do
  [ -d "$t" ] || { echo "  skip (not a dir): $t"; continue; }
  mkdir -p "$t/.cursor/rules"
  link="$t/.cursor/rules/shared-skill-library.mdc"
  if [ -L "$link" ] && [ "$(readlink "$link")" = "$CANON" ]; then
    echo "  ok:   $t"
  elif [ -e "$link" ] && [ ! -L "$link" ]; then
    # Refuse to clobber a real file. `ln -sfn` force-replaces whatever is at the
    # path, so a project that had authored its own rule of the same name would
    # have lost it silently. Found by a cross-architecture panel run, 2026-08-08.
    echo "  SKIP: $t — $link exists and is a regular file, not our symlink." >&2
    echo "        Move or delete it, then re-run." >&2
  else
    ln -sfn "$CANON" "$link"
    echo "  linked: $t"
  fi
done
