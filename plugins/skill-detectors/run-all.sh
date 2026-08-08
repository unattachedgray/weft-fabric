#!/usr/bin/env bash
# skill-detectors SessionStart entry point.
#
# Iterates every detector under ./detectors and surfaces their combined output
# to the session as `additionalContext`. Always prepends the marker
# interpretation rules so Claude knows how to act on the signals regardless
# of whether the skill's SKILL.md is loaded.
#
# Detectors run with cwd = project directory. Resolves the project directory
# from $CLAUDE_PROJECT_DIR (set by Claude Code) → $PWD.

set -u

project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$project_dir" 2>/dev/null || exit 0

self_dir="$(cd "$(dirname "$0")" && pwd)"
detectors_dir="$self_dir/detectors"
[ -d "$detectors_dir" ] || exit 0

# Collect detector output. Invoke via `bash` rather than relying on the exec
# bit — cloud-synced filesystems and plugin cache copies may not preserve mode.
signals=""
for script in "$detectors_dir"/*.sh; do
  [ -f "$script" ] || continue
  result="$(bash "$script" 2>/dev/null)"
  [ -n "$result" ] || continue
  if [ -n "$signals" ]; then
    signals="${signals}
${result}"
  else
    signals="$result"
  fi
done

# Nothing to surface — exit silently.
[ -z "$signals" ] && exit 0

# Always prepend the marker interpretation preamble so Claude can act on the
# signals even if the SKILL.md hasn't loaded into context.
read -r -d '' preamble <<'EOF' || true
# skill-detectors signals (always read these rules first)

You will see one or more SKILL_SIGNAL or SKILL_SIGNAL_CANDIDATE lines below. Interpret them as follows:

SKILL_SIGNAL <json> — fields: skill, action (offer|route|constrain), reason, prompt, optional on_yes, optional scope.
  offer:     ask the user the prompt verbatim early in your first reply; batch multiple offers into one numbered question; one ask per skill per session; never run on_yes without explicit user confirmation.
  route:     silently prefer the named skill over default tools for questions in scope.
  constrain: treat the prompt as a hard session-wide preference, priority above defaults.

SKILL_SIGNAL_CANDIDATE <json> — fields: candidate, source, instruction. The user mentioned something that may warrant adding to the detector framework. Evaluate against the three-criteria gate: (1) categorically better than defaults, (2) forgettable in practice, (3) cheaply detectable from project state. If all three hold, propose a detector AT THE END of your reply — never block the foreground task. If any fails, ignore silently and don't bring it up.

One ask per skill per session. Candidate evaluation never blocks the foreground task.

---
EOF

output="${preamble}
${signals}"

# Wrap in the SessionStart hook JSON envelope.
if command -v python3 >/dev/null 2>&1; then
  printf '%s' "$output" | python3 -c '
import json, sys
ctx = sys.stdin.read()
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": ctx,
    }
}))
'
else
  printf '%s\n' "$output"
fi

# Close the multi-ai-review loop unattended. Auto-scores any panel run whose
# artifact has since changed (or gone 48h untouched) and refreshes the per-kind
# yield table the prompt-detector reads. Cheap, silent, and the only reason the
# routing ever improves — nobody remembers to score runs by hand.
PANEL="$HOME/dev/claude-skills/plugins/claude-stack/skills/multi-ai-review/scripts/panel"
[ -x "$PANEL" ] && timeout 8 bash "$PANEL" observe >/dev/null 2>&1 || true
