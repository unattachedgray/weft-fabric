#!/usr/bin/env bash
# deploy-principles.sh — wire the agent-neutral operating principles + portable skills into
# every agent CLI on this machine (Claude Code, Codex, Antigravity, Cursor). Idempotent and
# reversible; uses symlinks so a repo update propagates to all agents.
#
#   deploy-principles.sh              install
#   deploy-principles.sh --uninstall  remove only the symlinks this script created
#
# Single source of truth: principles/AGENTS.md in this repo.
# Why per-agent glue: Codex can't @import (reads ~/.codex/AGENTS.md as a real file → symlink);
# Antigravity reads ~/.gemini/AGENTS.md natively (v1.20.3+); Claude Code pins the shared core with
# an absolute-path @import written into ~/.claude/CLAUDE.md (never the @~/ form, which silently
# fails: anthropics/claude-code#8765) — machine-local notes live below the import, untouched.
# Cursor Agent walks ancestors for AGENTS.md, so ~/AGENTS.md covers every project under $HOME.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
CANON="$REPO/principles/AGENTS.md"
SKILLS_SRC="$REPO/principles/skills"

link() { ln -sfn "$1" "$2"; echo "  $2 -> $1"; }

if [ "${1:-}" = "--uninstall" ]; then
  for f in "$HOME/.codex/AGENTS.md" "$HOME/.gemini/AGENTS.md" "$HOME/AGENTS.md"; do
    [ -L "$f" ] && rm -v "$f" || true
  done
  for d in "$HOME/.codex/skills" "$HOME/.gemini/config/skills"; do
    [ -d "$SKILLS_SRC" ] && for sk in "$SKILLS_SRC"/*/; do
      l="$d/$(basename "$sk")"; [ -L "$l" ] && rm -v "$l" || true
    done
  done
  CC="$HOME/.claude/CLAUDE.md"; IMPORT="@$CANON"
  if [ -f "$CC" ] && grep -qxF "$IMPORT" "$CC"; then
    tmp="$(mktemp)"; grep -vxF "$IMPORT" "$CC" > "$tmp"; mv "$tmp" "$CC"
    echo "  removed @import from $CC (machine-local content kept)"
  fi
  echo "uninstalled."; exit 0
fi

[ -f "$CANON" ] || { echo "canonical principles file missing: $CANON" >&2; exit 1; }

echo "principles -> agent global-instruction files:"
mkdir -p "$HOME/.codex" "$HOME/.gemini" "$HOME/.claude"
link "$CANON" "$HOME/.codex/AGENTS.md"    # Codex (native, no @import)
link "$CANON" "$HOME/.gemini/AGENTS.md"   # Antigravity (native AGENTS.md)
link "$CANON" "$HOME/AGENTS.md"           # Cursor Agent (ancestor walk from any $HOME project)

# Claude Code: @import the shared core (absolute path; @~/ silently fails, #8765). Idempotent —
# add the import once, at the top, preserving any machine-local content already in CLAUDE.md.
CC="$HOME/.claude/CLAUDE.md"; IMPORT="@$CANON"
if [ -f "$CC" ] && grep -qxF "$IMPORT" "$CC"; then
  echo "  $CC already imports the shared core."
elif [ -f "$CC" ]; then
  # Existing CLAUDE.md without the import: prepend ONLY the import line (imports resolve from
  # anywhere). Don't add another header/marker — that accretes on repeated install runs.
  tmp="$(mktemp)"; { printf '%s\n\n' "$IMPORT"; cat "$CC"; } > "$tmp"; mv "$tmp" "$CC"
  echo "  added @import atop existing $CC — nothing deleted."
  echo "    This machine had its own principles; CONSOLIDATE them with the shared core"
  echo "    (promote universal ones up into AGENTS.md, keep machine-specific below, drop dups)."
  echo "    See README → 'Consolidating a machine that already has its own principles'."
else
  # No CLAUDE.md yet: create the thin scaffold.
  printf '# CLAUDE.md — machine-local (imports the shared core; add machine-specific notes below)\n\n%s\n\n<!-- machine-local additions below are never synced -->\n' "$IMPORT" > "$CC"
  echo "  created $CC -> $IMPORT"
fi

# "Claude already has them" was false. Claude Code only sees a skill that is
# installed as a plugin or symlinked into ~/.claude/skills, and this script did
# neither — so flywheel-audit was unreachable from Claude Code while the
# AGENTS.md loaded into EVERY Claude session ended by pointing at it. Claude is
# now linked alongside the other two.
echo "portable skills -> claude + codex + antigravity skills dirs:"
for d in "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.gemini/config/skills"; do
  mkdir -p "$d"
  for sk in "$SKILLS_SRC"/*/; do
    link "$sk" "$d/$(basename "$sk")"
  done
done
echo "done. (re-run after a repo update; symlinks already point at the latest.)"
