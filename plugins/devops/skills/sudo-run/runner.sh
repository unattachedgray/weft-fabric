#!/usr/bin/env bash
# Runs INSIDE the newly-opened terminal window.
# Authenticates sudo interactively (visible password prompt), runs the job's
# cmd.sh, tees all output to output.log, and writes exit_code when finished.
#
# Usage: runner.sh <job_dir>
#   <job_dir>/cmd.sh      -> the commands to run (may use `sudo` freely)
#   <job_dir>/output.log  <- live combined stdout+stderr (created here)
#   <job_dir>/exit_code   <- created ONLY when finished; contains the code
set -u

JOB_DIR="${1:?usage: runner.sh <job_dir>}"
LOG="$JOB_DIR/output.log"
CMD="$JOB_DIR/cmd.sh"
: > "$LOG"

clear 2>/dev/null || true
echo "==============================================="
echo "  Claude sudo runner"
echo "  Job dir : $JOB_DIR"
echo "  Log     : $LOG"
echo "==============================================="
echo "  You'll be asked for your sudo password below."
echo

# Authenticate once (interactive prompt is visible in this window).
if ! sudo -v; then
  echo "sudo authentication failed." | tee -a "$LOG"
  echo "126" > "$JOB_DIR/exit_code"
  echo
  read -rp "Press Enter to close this window... "
  exit 126
fi

# Keep the sudo timestamp fresh for long-running jobs.
( while kill -0 "$$" 2>/dev/null; do sudo -n true 2>/dev/null; sleep 30; done ) &
KEEPALIVE=$!

echo "### START $(date -Iseconds)" | tee -a "$LOG"
set -o pipefail
bash "$CMD" 2>&1 | tee -a "$LOG"
ec=${PIPESTATUS[0]}
echo "### END $(date -Iseconds) (exit code: $ec)" | tee -a "$LOG"

kill "$KEEPALIVE" 2>/dev/null

# Write exit_code LAST and atomically so the watcher never sees a partial file.
printf '%s\n' "$ec" > "$JOB_DIR/exit_code.tmp" && mv "$JOB_DIR/exit_code.tmp" "$JOB_DIR/exit_code"

echo
echo "Finished with exit code $ec. Safe to close."
read -rp "Press Enter to close this window... "
exit "$ec"
