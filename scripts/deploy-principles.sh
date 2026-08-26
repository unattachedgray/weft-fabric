#!/usr/bin/env bash
# deploy-principles.sh — compatibility shim.
#
# The per-CLI paths this script used to hardcode now live in cli-targets.json,
# and the linking is done by scripts/agentsync. Keeping two implementations was
# the real risk: one of them silently rots, and you cannot tell which ran.
#
#   deploy-principles.sh              -> agentsync --no-pull
#   deploy-principles.sh --uninstall  -> remove only the links we created
#
# Add support for a new CLI by adding an entry to cli-targets.json, not by
# editing shell here. Every machine picks it up on its next sync.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"

if [ "${1:-}" = "--uninstall" ]; then
  CANON="$REPO/principles/AGENTS.md"
  SKILLS_SRC="$REPO/principles/skills"
  # Only ever remove symlinks, and only ones pointing into this repo.
  python3 - "$REPO" <<'PY'
import json, os, sys
from pathlib import Path
repo = Path(sys.argv[1])
manifest = json.loads((repo / "cli-targets.json").read_text())
removed = []
for cli in manifest["clis"]:
    for key in ("instructions", "skills_dir", "output_styles_dir"):
        raw = cli.get(key)
        if not raw:
            continue
        p = Path(os.path.expandvars(raw)).expanduser()
        targets = [p] if key == "instructions" else (list(p.iterdir()) if p.is_dir() else [])
        for t in targets:
            try:
                if t.is_symlink() and repo in t.resolve().parents:
                    t.unlink(); removed.append(str(t))
            except OSError:
                pass
for t in (Path.home() / ".local/bin").glob("*"):
    try:
        if t.is_symlink() and repo in t.resolve().parents:
            t.unlink(); removed.append(str(t))
    except OSError:
        pass
print(f"removed {len(removed)} symlink(s) into {repo}")
for r in removed:
    print("  ", r)
print("machine-local content (~/.claude/CLAUDE.md, ~/.config/agents/MACHINE.md) was left alone.")
PY
  exit 0
fi

exec "$REPO/scripts/agentsync" --no-pull "$@"
