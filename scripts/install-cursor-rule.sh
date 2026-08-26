#!/usr/bin/env bash
# Give Cursor the shared-library contract in a project.
#
# Cursor has NO global instruction file — verified 2026-08-08 by probing a
# scratch dir, and re-confirmed 2026-08-26 by probing cursor-agent directly:
# ~/.cursor/AGENTS.md and ~/.cursor/rules/*.mdc are both invisible, while
# project-level AGENTS.md, .cursorrules and .cursor/rules/*.mdc all load.
#
# Cursor DOES walk ancestors for AGENTS.md, so ~/AGENTS.md already covers every
# project under $HOME. Probed from outside $HOME, it returned NONE — that is the
# gap this fills, along with repos whose own AGENTS.md belongs to another tool
# (weft's diverges from upstream Hermes and is rebase-sensitive).
#
# We use .cursor/rules/ rather than AGENTS.md so nothing else is touched, and it
# is a SYMLINK per the arrangement's no-copies rule: edit the canonical file and
# every project follows.
#
#   scripts/install-cursor-rule.sh ~/dev/foo ~/dev/bar
#   scripts/install-cursor-rule.sh --all      # every git repo under the roots
#
# Roots for --all come from ~/.config/agents/cursor-roots (one path per line),
# defaulting to ~/dev. That file is machine-local on purpose: which trees exist
# is exactly the kind of fact that differs per machine.
set -euo pipefail

# Derive the canonical path from this script, never hardcode it — a fleet has
# other users and other checkout locations.
REPO="$(cd "$(dirname "$0")/.." && pwd)"
RULES_DIR="$REPO/cursor"
ROOTS_FILE="$HOME/.config/agents/cursor-roots"
[ -d "$RULES_DIR" ] || { echo "missing canonical rules dir: $RULES_DIR" >&2; exit 1; }

targets=()
if [ "${1:-}" = "--all" ]; then
  roots=()
  if [ -f "$ROOTS_FILE" ]; then
    while IFS= read -r line; do
      case "$line" in ''|'#'*) continue ;; esac
      roots+=("$(eval echo "$line")")
    done < "$ROOTS_FILE"
  fi
  [ ${#roots[@]} -gt 0 ] || roots=("$HOME/dev")
  for root in "${roots[@]}"; do
    [ -d "$root" ] || continue
    for d in "$root"/*/; do [ -d "$d/.git" ] && targets+=("${d%/}"); done
    # A root can BE the project — Cursor gets opened straight in a home dir as
    # often as in a repo under one. Only claim it if Cursor has actually been
    # used there, so we never litter a tree nobody opens.
    slug="$(printf '%s' "${root#/}" | tr '/' '-')"
    [ -d "$HOME/.cursor/projects/$slug" ] && targets+=("$root")
  done
else
  targets=("$@")
fi
[ ${#targets[@]} -gt 0 ] || { echo "usage: $0 <project-dir>... | --all" >&2; exit 1; }

covered=""
for t in "${targets[@]}"; do
  [ -d "$t" ] || { echo "  skip (not a dir): $t"; continue; }
  mkdir -p "$t/.cursor/rules"
  for canon in "$RULES_DIR"/*.mdc; do
    [ -f "$canon" ] || continue
    link="$t/.cursor/rules/$(basename "$canon")"
    if [ -L "$link" ] && [ "$(readlink "$link")" = "$canon" ]; then
      continue
    elif [ -e "$link" ] && [ ! -L "$link" ]; then
      # Refuse to clobber a real file. `ln -sfn` force-replaces whatever is at
      # the path, so a project that had authored its own rule of the same name
      # would have lost it silently. Cross-architecture panel run, 2026-08-08.
      echo "  SKIP: $t — $link exists and is a regular file, not our symlink." >&2
      echo "        Move or delete it, then re-run." >&2
      continue
    fi
    ln -sfn "$canon" "$link"
    echo "  linked: $t/$(basename "$canon")"
  done
  covered="$covered$(printf '%s' "${t#/}" | tr '/' '-')
"
done

# Surface projects Cursor is actually used in that no root covers. Cursor slugs
# are lossy (long paths get truncated and hashed), so we do not try to decode
# them back into paths — we report them, which is honest, rather than guessing.
if [ -d "$HOME/.cursor/projects" ]; then
  uncovered=""
  for p in "$HOME/.cursor/projects"/*/; do
    [ -d "$p" ] || continue
    slug="$(basename "$p")"
    case "$slug" in
      home-"$(basename "$HOME")"|home-"$(basename "$HOME")"-*) continue ;;  # under $HOME: ancestor walk covers it
      # Throwaway dirs an agent worked in once. Reporting them hourly buries the
      # real signal, which is the whole point of reporting at all.
      tmp|tmp-*|var-tmp*|run-*|proc-*) continue ;;
    esac
    printf '%s' "$covered" | grep -qxF "$slug" && continue
    uncovered="$uncovered  $slug
"
  done
  if [ -n "$uncovered" ]; then
    echo "  note: Cursor has been used in these projects, which no root covers and" >&2
    echo "        which are outside \$HOME, so they load no shared principles:" >&2
    printf '%s' "$uncovered" >&2
    echo "        Add their parent dir to $ROOTS_FILE, or run this script on them." >&2
  fi
fi
