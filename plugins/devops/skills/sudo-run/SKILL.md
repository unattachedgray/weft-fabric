---
name: sudo-run
description: Run commands that need sudo (or any interactive password) by spawning a real terminal window for the password prompt, logging all output to a file, and watching for completion. Use whenever a task needs `sudo`, an interactive passphrase, or anything the non-interactive Bash tool can't type a password into. Works on WSL/Windows (wt.exe or cmd.exe) — the Bash tool cannot answer interactive prompts itself.
---

# sudo-run

The Bash tool runs non-interactively, so any `sudo` that needs a password hangs or
fails. This skill works around that: it opens a **real terminal window** where the
user types their password, runs the commands there, streams all output to a log
file, and lets you **watch for completion** and then read the log to plan next steps.

## When to use
- Any command needing `sudo` with a password (apt, systemctl, mount, dd, chmod on system files…).
- Any other interactive secret prompt (ssh passphrase, LUKS, etc.) — put the command in `cmd.sh`.
- NOT needed if passwordless sudo (`NOPASSWD`) is configured — just use the Bash tool then.

## Files in this skill
- `runner.sh` — runs inside the new window: authenticates sudo, runs `cmd.sh`, tees to `output.log`, writes `exit_code` when done.
- `launch.sh` — opens the new terminal (Windows Terminal, falling back to a console window).

## Procedure

### 1. Create a job dir and write the commands
Pick a short descriptive name. Use a fresh dir per job so logs don't collide.

```bash
# Resolve where this skill lives — works whether it's installed as a marketplace
# plugin (CLAUDE_PLUGIN_ROOT set) or as a personal ~/.claude/skills skill.
SKILL="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/sudo-run}"
SKILL="${SKILL:-$HOME/.claude/skills/sudo-run}"
JOB=~/.claude/sudo-jobs/<short-name>-$(date +%s)
mkdir -p "$JOB"
cat > "$JOB/cmd.sh" <<'EOF'
# Commands to run. Use `sudo` freely — auth is already primed.
# Print clear markers so the log is easy to parse afterward.
set -e
sudo apt-get update
sudo apt-get install -y <pkg>
echo "RESULT: done"
EOF
echo "$JOB"   # note this path — you need it below
```

Tips for `cmd.sh`:
- Keep `set -e` so a failure stops and is visible in the log.
- Echo a recognizable final marker (e.g. `RESULT: done`) so you can confirm success.
- Avoid commands that themselves open pagers/prompts; add flags like `-y`, `--no-pager`.

### 2. Launch the terminal
```bash
bash "$SKILL/launch.sh" "$JOB"
```
A window pops up titled `claude-sudo` asking the user for their sudo password.
**Tell the user a window has opened and to enter their password there.**

### 3. Watch for completion (run in background so you're re-invoked when it finishes)
Run this with the Bash tool's `run_in_background: true`. It blocks until the job
writes `exit_code`, then prints the result and the full log — and the harness
re-invokes you automatically when it exits. Use the real `$JOB` path:

```bash
JOB="<paste the job dir path>"
while [ ! -f "$JOB/exit_code" ]; do sleep 2; done
echo "=== EXIT CODE: $(cat "$JOB/exit_code") ==="
cat "$JOB/output.log"
```

(The Bash tool blocks foreground `sleep`, so this MUST be `run_in_background: true`.
Do not poll in a tight foreground loop.)

### 4. Examine and continue
When the background watcher returns:
- Read the printed `EXIT CODE` (0 = success).
- Read `output.log` for what happened and decide next steps.
- The log also lives at `$JOB/output.log` if you need to re-read it later.

## Notes
- `launch.sh` auto-prunes job dirs older than 1 day (only inside a `.../sudo-jobs` root, never the current job), so logs stay around briefly for inspection but don't accumulate forever. Recent jobs are kept; nothing else needs manual cleanup.
- `runner.sh` keeps the sudo timestamp alive (re-primes every 30s) so long jobs don't re-prompt.
- The window stays open after finishing (`Press Enter to close`) so the user can see results.
- If auth fails, `exit_code` is `126`.
- One job = one window. For a multi-step plan where a later step depends on an earlier
  result, either put it all in one `cmd.sh`, or run a second job after reading the first log.
