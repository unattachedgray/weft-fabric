#!/usr/bin/env bash
# Opens a NEW terminal window that runs runner.sh for the given job dir.
# Prefers Windows Terminal (wt.exe); falls back to a classic console (cmd start).
# Returns immediately — the window runs detached.
#
# Usage: launch.sh <job_dir>
set -euo pipefail

JOB_DIR="${1:?usage: launch.sh <job_dir>}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$SKILL_DIR/runner.sh"

[ -f "$JOB_DIR/cmd.sh" ] || { echo "missing $JOB_DIR/cmd.sh" >&2; exit 1; }

# Auto-prune old job dirs so they don't accumulate. Only ever touches dirs
# inside a ".../sudo-jobs" root (safety guard), never the current job, and only
# those older than 1 day. This keeps recent logs around for inspection while
# stopping the folder from growing forever.
JOBS_ROOT="$(cd "$(dirname "$JOB_DIR")" && pwd)"
case "$JOBS_ROOT" in
  */sudo-jobs)
    CURRENT="$(basename "$JOB_DIR")"
    find "$JOBS_ROOT" -mindepth 1 -maxdepth 1 -type d \
      ! -name "$CURRENT" -mtime +0 -exec rm -rf {} + 2>/dev/null || true
    ;;
esac

# Command executed inside the new WSL shell.
# IMPORTANT: keep this free of ';' — Windows Terminal treats ';' as its own
# tab/pane separator and would spawn a stray extra tab. runner.sh keeps the
# window open itself (it ends with a "Press Enter to close" prompt), so no
# trailing 'exec bash' is needed. The real TTY lets sudo read the password.
INNER="bash '$RUNNER' '$JOB_DIR'"

if command -v wt.exe >/dev/null 2>&1; then
  wt.exe new-tab --title "claude-sudo" wsl.exe -e bash -lc "$INNER" >/dev/null 2>&1
  echo "Launched in Windows Terminal (tab: claude-sudo)."
elif command -v cmd.exe >/dev/null 2>&1; then
  cmd.exe /c start "claude-sudo" wsl.exe -e bash -lc "$INNER" >/dev/null 2>&1
  echo "Launched in a new console window."
else
  echo "No wt.exe or cmd.exe found to open a terminal." >&2
  exit 1
fi
