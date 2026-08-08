#!/usr/bin/env bash
# skill-detectors UserPromptSubmit entry point.
#
# Reads the UserPromptSubmit hook payload on stdin, extracts the user's
# prompt text, and pipes it as stdin to every detector under
# ./prompt-detectors. Each detector either exits silently or prints one
# or more
#   SKILL_SIGNAL_CANDIDATE <json>
# lines. Aggregated output is wrapped in the additionalContext envelope.

set -u

self_dir="$(cd "$(dirname "$0")" && pwd)"
detectors_dir="$self_dir/prompt-detectors"
[ -d "$detectors_dir" ] || exit 0

payload="$(cat)"
[ -n "$payload" ] || exit 0

# Extract the user's prompt text. Hook variants use slightly different
# field names — try common ones in order.
prompt_text=""
if command -v python3 >/dev/null 2>&1; then
  prompt_text="$(printf '%s' "$payload" | python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read())
except Exception:
    sys.exit(0)
for key in ("prompt", "user_message", "message", "input", "text"):
    v = d.get(key)
    if isinstance(v, str) and v.strip():
        print(v)
        sys.exit(0)
for v in d.values():
    if isinstance(v, dict):
        for key in ("prompt", "user_message", "message", "text", "content"):
            inner = v.get(key)
            if isinstance(inner, str) and inner.strip():
                print(inner)
                sys.exit(0)
')"
fi

[ -n "$prompt_text" ] || prompt_text="$payload"

# Run each prompt-detector with the extracted prompt text on stdin.
output=""
for script in "$detectors_dir"/*.sh; do
  [ -f "$script" ] || continue
  result="$(printf '%s' "$prompt_text" | bash "$script" 2>/dev/null)"
  [ -n "$result" ] || continue
  if [ -n "$output" ]; then
    output="${output}
${result}"
  else
    output="$result"
  fi
done

[ -z "$output" ] && exit 0

if command -v python3 >/dev/null 2>&1; then
  printf '%s' "$output" | python3 -c '
import json, sys
ctx = sys.stdin.read()
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": ctx,
    }
}))
'
else
  printf '%s\n' "$output"
fi
