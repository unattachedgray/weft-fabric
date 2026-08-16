#!/usr/bin/env bash
# deploy-output-styles.sh — link this repo's Claude Code output styles into
# ~/.claude/output-styles/. Idempotent and reversible; symlinks, never copies.
#
#   deploy-output-styles.sh              install
#   deploy-output-styles.sh --uninstall  remove only the symlinks this script created
#
# Output styles are a Claude-Code-only feature — Codex, Antigravity and Cursor have
# no equivalent, so nothing is linked for them. A style ships beside the skill that
# documents it (ste-partial.md beside plugins/content/skills/ste), because the style
# points the reader at that skill for its word list and worked examples; splitting
# them lets one drift from the other.
#
# Selecting a style is still a per-machine choice (`/output-style`, stored in
# ~/.claude/settings.json). This script only makes the style available.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/.claude/output-styles"

# Every output style tracked in this repo. Add a line per new style.
STYLES="$REPO/plugins/content/skills/ste/output-styles/ste-partial.md"

if [ "${1:-}" = "--uninstall" ]; then
  for src in $STYLES; do
    l="$DEST/$(basename "$src")"
    [ -L "$l" ] && rm -v "$l" || true
  done
  echo "uninstalled."; exit 0
fi

mkdir -p "$DEST"
echo "output styles -> $DEST:"
for src in $STYLES; do
  [ -f "$src" ] || { echo "missing output style: $src" >&2; exit 1; }
  ln -sfn "$src" "$DEST/$(basename "$src")"
  echo "  $DEST/$(basename "$src") -> $src"
done
echo "done. (select one with /output-style inside Claude Code.)"
