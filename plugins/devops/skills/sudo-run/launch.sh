#!/usr/bin/env bash
# Opens a NEW terminal window that runs runner.sh for the given job dir.
# Native Ubuntu Linux support (ptyxis, gnome-terminal, x-terminal-emulator, xterm).
# Falls back to Windows Terminal / WSL (wt.exe, cmd.exe) if running under WSL.
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
# those older than 1 day.
JOBS_ROOT="$(cd "$(dirname "$JOB_DIR")" && pwd)"
case "$JOBS_ROOT" in
  */sudo-jobs)
    CURRENT="$(basename "$JOB_DIR")"
    find "$JOBS_ROOT" -mindepth 1 -maxdepth 1 -type d \
      ! -name "$CURRENT" -mtime +0 -exec rm -rf {} + 2>/dev/null || true
    ;;
esac

LAUNCH_LOG="$JOB_DIR/launcher.log"
: > "$LAUNCH_LOG"

# A terminal client's exit status is not proof that the terminal opened (both
# Ptyxis and GNOME Terminal are D-Bus/GApplication clients).  runner.sh creates
# output.log before prompting, so use that as the startup handshake.
wait_for_runner() {
  local launcher_pid="$1"
  local attempt
  for attempt in {1..50}; do
    [ -e "$JOB_DIR/output.log" ] && return 0
    if ! kill -0 "$launcher_pid" 2>/dev/null; then
      wait "$launcher_pid" 2>/dev/null || true
      [ -e "$JOB_DIR/output.log" ] && return 0
    fi
    sleep 0.1
  done
  return 1
}

launch_and_verify() {
  local label="$1"
  shift
  rm -f "$JOB_DIR/output.log"
  "$@" >>"$LAUNCH_LOG" 2>&1 &
  local launcher_pid=$!
  if wait_for_runner "$launcher_pid"; then
    echo "Launched in $label (runner handshake verified)."
    return 0
  fi
  echo "$label did not start the runner; trying the next terminal." >>"$LAUNCH_LOG"
  return 1
}

# 1. Native Ubuntu Linux Terminal Emulators
if command -v ptyxis >/dev/null 2>&1 && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
  launch_and_verify "ptyxis" ptyxis --new-window --title "sudo-runner" -- bash "$RUNNER" "$JOB_DIR" && exit 0
fi
if command -v gnome-terminal >/dev/null 2>&1 && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
  launch_and_verify "gnome-terminal" gnome-terminal --window --title="sudo-runner" -- bash "$RUNNER" "$JOB_DIR" && exit 0
fi
if command -v x-terminal-emulator >/dev/null 2>&1 && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
  launch_and_verify "x-terminal-emulator" x-terminal-emulator -e bash "$RUNNER" "$JOB_DIR" && exit 0
fi
if command -v xterm >/dev/null 2>&1 && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
  launch_and_verify "xterm" xterm -title "sudo-runner" -e bash "$RUNNER" "$JOB_DIR" && exit 0
# 2. Windows / WSL Fallbacks
fi
if command -v wt.exe >/dev/null 2>&1; then
  launch_and_verify "Windows Terminal" wt.exe new-tab --title "sudo-runner" wsl.exe -e bash "$RUNNER" "$JOB_DIR" && exit 0
fi
if command -v cmd.exe >/dev/null 2>&1; then
  launch_and_verify "Windows console" cmd.exe /c start "sudo-runner" wsl.exe -e bash "$RUNNER" "$JOB_DIR" && exit 0
fi

echo "No terminal successfully started sudo-runner. See $LAUNCH_LOG" >&2
exit 1
