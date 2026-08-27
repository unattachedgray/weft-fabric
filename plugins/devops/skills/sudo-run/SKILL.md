---
name: sudo-run
description: Run commands that need sudo (or any interactive password) by spawning a real terminal window for the password prompt, logging all output to a file, and watching for completion. Built for native Ubuntu Linux (ptyxis, gnome-terminal, x-terminal-emulator) with WSL/Windows fallback. Use whenever a task needs sudo or interactive credentials.
clis: claude, codex, gemini, dsh
clis-why: Spawns a real terminal for the password prompt — works anywhere with a desktop session.
---
# sudo-run

The Bash tool runs non-interactively, so any `sudo` that needs a password hangs or
fails. This skill opens a **real terminal window** on Ubuntu (or WSL/Windows) where the
user types their password, runs the commands, streams all output to a log
file, and lets you **watch for completion** and read the log to plan next steps.

## When to use
- Any command needing `sudo` with a password (`apt`, `systemctl`, `mount`, `dd`, `chmod` on system files, etc.).
- Any other interactive secret prompt (`ssh` passphrase, LUKS, etc.) — put the command in `cmd.sh`.
- NOT needed if passwordless sudo (`NOPASSWD`) is configured — just use the Bash tool then.

## Files in this skill
- `runner.sh` — runs inside the new terminal window: authenticates sudo, runs `cmd.sh`, tees to `output.log`, writes `exit_code` when done.
- `launch.sh` — opens the new terminal window (native Ubuntu: `ptyxis`, `gnome-terminal`, `x-terminal-emulator`; WSL fallback: `wt.exe`, `cmd.exe`).

## Procedure

### 1. Create a job dir and write the commands
Pick a short descriptive name. Use a fresh dir per job so logs don't collide.

```bash
SKILL="$HOME/dev/weft-fabric/plugins/devops/skills/sudo-run"
JOB=~/.claude/sudo-jobs/<short-name>-$(date +%s)
mkdir -p "$JOB"
cat > "$JOB/cmd.sh" <<'EOF'
set -e
sudo apt-get update
sudo apt-get install -y <pkg>
echo "RESULT: done"
EOF
echo "$JOB"
```

### 2. Launch the terminal
```bash
bash "$SKILL/launch.sh" "$JOB"
```
A terminal window pops up asking the user for their sudo password. The launcher
must report `runner handshake verified`; any other result is a launch failure,
and `launcher.log` in the job directory contains terminal diagnostics.
**Tell the user a terminal window has opened and to enter their password there.**

### 3. Watch for completion
Run in background (`WaitMsBeforeAsync` / `manage_task` watcher):
```bash
JOB="<paste the job dir path>"
while [ ! -f "$JOB/exit_code" ]; do sleep 2; done
echo "=== EXIT CODE: $(cat "$JOB/exit_code") ==="
cat "$JOB/output.log"
```

### 4. Examine and continue
- Read `EXIT CODE` (0 = success).
- Read `output.log` for details.
