#!/usr/bin/env bash
# Detector: pretext
#
# Fires when the cwd's package.json declares @chenglou/pretext as a
# dependency. Emits a `constrain` signal that pins text-measurement work
# to the pretext APIs instead of DOM measurement or guesses.

set -u

SCOPE_ROOTS="${SKILL_DETECTOR_SCOPE:-$HOME/dev}"

cwd="$PWD"

# 1. Scope check.
in_scope=false
IFS=':' read -ra _roots <<< "$SCOPE_ROOTS"
for root in "${_roots[@]}"; do
  case "$cwd" in
    "$root"|"$root"/*) in_scope=true; break ;;
  esac
done
$in_scope || exit 0

# 2. Need a package.json.
[ -f "$cwd/package.json" ] || exit 0

# 3. Match @chenglou/pretext or chenglou/pretext (be lenient about scope prefix).
grep -Eq '"@?chenglou/pretext"' "$cwd/package.json" || exit 0

# 4. Emit constrain signal.
printf 'SKILL_SIGNAL {"skill":"pretext-layout","action":"constrain","reason":"@chenglou/pretext is a project dependency","prompt":"This project uses @chenglou/pretext. For any text-height, layout, or overflow work, use pretext APIs (e.g. measureTextHeight) — never measure via DOM (getBoundingClientRect, offsetHeight, scrollHeight) and never guess heights. Pretext is ~500x faster and handles Korean keep-all breaking via setLocale(\\"ko\\").","scope":"this repo, this session"}\n'
