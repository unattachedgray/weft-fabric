#!/usr/bin/env bash
# deploy-principles.sh — wire the agent-neutral operating principles + portable skills into
# every agent CLI on this machine (Claude Code, Codex, Antigravity). Idempotent and reversible;
# uses symlinks so a repo update propagates to all agents.
#
#   deploy-principles.sh              install
#   deploy-principles.sh --uninstall  remove only the symlinks this script created
#
# Single source of truth: principles/agent-principles.md in this repo.
# Why per-agent glue: Codex can't @import (reads ~/.codex/AGENTS.md as a real file → symlink);
# Antigravity reads ~/.gemini/AGENTS.md natively (v1.20.3+); Claude Code already carries the full
# principles in ~/.claude/CLAUDE.md (to also pin the shared core, add an absolute-path @import —
# never the @~/ form, which silently fails: anthropics/claude-code#8765).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
CANON="$REPO/principles/agent-principles.md"
SKILLS_SRC="$REPO/principles/skills"

link() { ln -sfn "$1" "$2"; echo "  $2 -> $1"; }

if [ "${1:-}" = "--uninstall" ]; then
  for f in "$HOME/.codex/AGENTS.md" "$HOME/.gemini/AGENTS.md"; do
    [ -L "$f" ] && rm -v "$f" || true
  done
  for d in "$HOME/.codex/skills" "$HOME/.gemini/config/skills"; do
    [ -d "$SKILLS_SRC" ] && for sk in "$SKILLS_SRC"/*/; do
      l="$d/$(basename "$sk")"; [ -L "$l" ] && rm -v "$l" || true
    done
  done
  echo "uninstalled."; exit 0
fi

[ -f "$CANON" ] || { echo "canonical principles file missing: $CANON" >&2; exit 1; }

echo "principles -> agent global-instruction files:"
mkdir -p "$HOME/.codex" "$HOME/.gemini"
link "$CANON" "$HOME/.codex/AGENTS.md"    # Codex (native, no @import)
link "$CANON" "$HOME/.gemini/AGENTS.md"   # Antigravity (native AGENTS.md)
echo "  Claude Code: already carries the full principles via ~/.claude/CLAUDE.md (no action needed)."

echo "portable skills -> codex + antigravity skills dirs (Claude already has them):"
for d in "$HOME/.codex/skills" "$HOME/.gemini/config/skills"; do
  mkdir -p "$d"
  for sk in "$SKILLS_SRC"/*/; do
    link "$sk" "$d/$(basename "$sk")"
  done
done
echo "done. (re-run after a repo update; symlinks already point at the latest.)"
