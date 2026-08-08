#!/usr/bin/env bash
# panel-score.sh — close the loop on a panel run, and read the routing signal.
#
#   panel-score.sh <run-id> <member> confirmed|rejected|mixed [note]
#   panel-score.sh --report [kind]
#   panel-score.sh --pending
#
# WHY SCORING IS MANUAL. panel.sh deliberately records `outcome:null`. A finding
# counts only once someone has CHECKED it against evidence. Counting raw
# findings would rank whichever member talks most — and the two most confident
# claims in the 2026-08-08 audit (an invocation column that was structurally
# zero, and a keep defended on the wrong grounds) were both wrong. Volume is
# not signal; verified findings are.
#
# THE GOVERNOR. This report reorders attention, never membership. Do not drop a
# member because it scores low: the measured value of a panel is the LONE
# finding nobody else had (one 6.7B model uniquely solved 26 bugs no other
# touched — arXiv 2510.21513), and a majority filter is exactly what loses it.
# A low-scoring member is read last, not evicted.
set -uo pipefail
LEDGER_DIR="${PANEL_LEDGER_DIR:-$HOME/.claude-skills-panel}"
LEDGER="$LEDGER_DIR/ledger.jsonl"
[ -f "$LEDGER" ] || { echo "no ledger yet: $LEDGER" >&2; exit 1; }

case "${1:-}" in
  --pending)
    jq -r 'select(.outcome==null) | "\(.run)  \(.kind)  \(.member)  findings=\(.findings)"' "$LEDGER" \
      | sort -u
    exit 0 ;;

  --report)
    KIND="${2:-}"
    echo "confirmed-rate by member${KIND:+ (kind=$KIND)} — scored runs only"
    echo
    jq -s --arg kind "$KIND" '
      map(select(.outcome != null))
      | map(select($kind == "" or .kind == $kind))
      | group_by(.member)
      | map({member: .[0].member,
             scored:  length,
             confirmed: (map(select(.outcome=="confirmed"))|length),
             mixed:     (map(select(.outcome=="mixed"))|length),
             rejected:  (map(select(.outcome=="rejected"))|length),
             findings:  (map(.findings)|add)})
      | map(. + {rate: (if .scored==0 then 0
                        else (((.confirmed + (.mixed*0.5)) / .scored)*100|floor) end)})
      | sort_by(-.rate)
      | .[] | "  \(.member|.[0:8]|. + "        "|.[0:8])  rate \(.rate)%   scored \(.scored)  (confirmed \(.confirmed), mixed \(.mixed), rejected \(.rejected))  raw findings \(.findings)"
    ' "$LEDGER" -r
    echo
    n=$(jq -s 'map(select(.outcome!=null))|length' "$LEDGER")
    if [ "$n" -lt 12 ]; then
      echo "  ⚠ only $n scored rows. Treat this as anecdote, not routing signal."
      echo "    Rule of thumb: 12+ scored rows per member before it means anything,"
      echo "    and re-check after any CLI version bump — the ranking is perishable."
    fi
    echo "  Reorder attention with this. Never drop a member: the lone finding is the point."
    exit 0 ;;
esac

RUN="${1:?usage: panel-score.sh <run-id> <member> confirmed|rejected|mixed [note]}"
MEMBER="${2:?member required}"
OUTCOME="${3:?confirmed|rejected|mixed}"
NOTE="${4:-}"
case "$OUTCOME" in confirmed|rejected|mixed) ;; *) echo "bad outcome: $OUTCOME" >&2; exit 1 ;; esac

TMP="$(mktemp)"
jq -c --arg run "$RUN" --arg m "$MEMBER" --arg o "$OUTCOME" --arg n "$NOTE" \
  'if .run==$run and .member==$m then .outcome=$o | .note=$n | .scored_at=(now|todate) else . end' \
  "$LEDGER" >"$TMP" && mv "$TMP" "$LEDGER"
echo "scored $RUN/$MEMBER = $OUTCOME"
