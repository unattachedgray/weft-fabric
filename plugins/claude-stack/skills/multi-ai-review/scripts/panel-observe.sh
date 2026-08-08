#!/usr/bin/env bash
# panel-observe.sh — close the loop with nobody present.
#
#   panel-observe.sh            score what can be scored, refresh yield table
#   panel-observe.sh --yield    print per-kind yield (what the detector reads)
#
# THE PROBLEM THIS SOLVES. panel-score.sh needs a human to say confirmed or
# rejected, and nobody remembers. An unscored ledger is a ledger that never
# teaches anything, so the routing stays a guess forever and the whole flywheel
# is decorative.
#
# THE SIGNAL. A finding that was real gets ACTED ON: the artifact under review
# changes shortly afterwards. A finding that was noise leaves it untouched. So
# instead of asking anyone's opinion, compare the artifact against the git SHA
# recorded when the panel ran. That is measuring outcomes adopted rather than
# activity generated — the same rule this repo applies everywhere else.
#
# HONESTY. Everything written here is marked `auto:true` and is PROVISIONAL. A
# human verdict via panel-score.sh always overwrites it and is never overwritten.
# Adoption is a proxy: an artifact can change for unrelated reasons, and a real
# finding can be deliberately declined. Over many runs the proxy is informative;
# on any single run it is a guess, and the yield table says how much data it has.
set -uo pipefail
LEDGER_DIR="${PANEL_LEDGER_DIR:-$HOME/.claude-skills-panel}"
LEDGER="$LEDGER_DIR/ledger.jsonl"
YIELD="$LEDGER_DIR/yield.json"
STALE_HOURS="${PANEL_STALE_HOURS:-48}"
[ -f "$LEDGER" ] || { echo "no ledger yet"; exit 0; }

if [ "${1:-}" = "--yield" ]; then
  [ -f "$YIELD" ] && jq . "$YIELD" || echo '{}'
  exit 0
fi

TMP="$(mktemp)"; changed=0

while IFS= read -r row; do
  outcome=$(jq -r '.outcome // "null"' <<<"$row")
  auto=$(jq -r '.auto // false'    <<<"$row")
  # Never touch a human verdict.
  if [ "$outcome" != "null" ] && [ "$auto" != "true" ]; then echo "$row" >>"$TMP"; continue; fi

  target=$(jq -r '.target // ""'   <<<"$row")
  base=$(jq -r '.base_sha // ""'   <<<"$row")
  ts=$(jq -r '.ts'                 <<<"$row")
  findings=$(jq -r '.findings // 0'<<<"$row")

  if [ -z "$target" ] || [ -z "$base" ] || [ ! -e "$target" ]; then
    echo "$row" >>"$TMP"; continue          # nothing observable, leave pending
  fi

  dir="$(dirname "$target")"
  # Did the artifact change after the panel saw it?
  if git -C "$dir" log --oneline "$base..HEAD" -- "$target" 2>/dev/null | grep -q .; then
    verdict=confirmed
  else
    age_h=$(( ( $(date -u +%s) - $(date -u -d "$ts" +%s 2>/dev/null || echo 0) ) / 3600 ))
    if [ "$age_h" -ge "$STALE_HOURS" ]; then
      # Long enough untouched to count as not-acted-on. A member that produced
      # NO findings is not wrong for that — score it mixed, not rejected.
      [ "$findings" -eq 0 ] && verdict=mixed || verdict=rejected
    else
      echo "$row" >>"$TMP"; continue        # too soon to judge
    fi
  fi
  jq -c --arg v "$verdict" '.outcome=$v | .auto=true | .scored_at=(now|todate)' <<<"$row" >>"$TMP"
  changed=$((changed+1))
done <"$LEDGER"

mv "$TMP" "$LEDGER"

# ── yield table: does running a panel on this KIND ever pay? ─────────────────
# This is the part that improves the system's own decision-making. If a kind
# never produces an adopted finding, the detector should stop firing on it.
jq -s '
  map(select(.outcome != null))
  | group_by(.kind)
  | map({key: .[0].kind,
         value: {runs: (map(.run)|unique|length),
                 scored: length,
                 confirmed: (map(select(.outcome=="confirmed"))|length),
                 yield: ((map(select(.outcome=="confirmed"))|length) / length)}})
  | from_entries' "$LEDGER" >"$YIELD"

echo "auto-scored $changed row(s). yield -> $YIELD"
jq -r 'to_entries[] | "  \(.key): \(.value.confirmed)/\(.value.scored) confirmed (\((.value.yield*100)|floor)%), \(.value.runs) run(s)"' "$YIELD"
