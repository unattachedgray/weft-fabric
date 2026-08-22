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

# NOTE: Do NOT add a `sudo -n true` keepalive loop here.
# Ubuntu 25.10+ ships sudo-rs, which allocates a pty and seizes terminal state on
# EVERY invocation. A periodic sudo in this process group hands the terminal back
# and forth; the relaying sudo eventually lands in a background process group,
# takes SIGTTOU on its next write, stops, and forwards the stop down to the job.
# The symptom is a job frozen in state T that a plain SIGCONT resumes to a clean
# exit. If a long job outlives the sudo timestamp, sudo just reprompts in this
# visible window, which is the behaviour we want anyway.

echo "### START $(date -Iseconds)" | tee -a "$LOG"
set -o pipefail
bash "$CMD" 2>&1 | tee -a "$LOG"
ec=${PIPESTATUS[0]}
echo "### END $(date -Iseconds) (exit code: $ec)" | tee -a "$LOG"

# Write exit_code LAST and atomically so the watcher never sees a partial file.
printf '%s\n' "$ec" > "$JOB_DIR/exit_code.tmp" && mv "$JOB_DIR/exit_code.tmp" "$JOB_DIR/exit_code"

echo
echo "Finished with exit code $ec. Safe to close."
read -rp "Press Enter to close this window... "
exit "$ec"
