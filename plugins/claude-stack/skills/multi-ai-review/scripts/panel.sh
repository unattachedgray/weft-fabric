#!/usr/bin/env bash
# panel.sh — send one artifact/judgment to N *different* agent CLIs for independent
# review, normalise to one JSON array, surface disagreement.
#
#   usage: panel.sh <prompt-file> [outdir]
#   env:   PANEL_TIMEOUT (default 300), PANEL_MEMBERS (default "codex agy cursor")
#
# Verified 2026-08-08 on: claude 2.1.226, codex-cli 0.147.0, agy 1.1.11,
# cursor-agent 2026.08.04. Every flag below was arrived at by hitting the failure.
set -uo pipefail

PROMPT_FILE="${1:?usage: panel.sh <prompt-file> [outdir]}"
OUT="${2:-$(mktemp -d -t panel-XXXX)}"; mkdir -p "$OUT"
TIMEOUT="${PANEL_TIMEOUT:-300}"
MEMBERS="${PANEL_MEMBERS:-codex agy cursor}"

# MODEL SELECTION. Each CLI defaults to its own house architecture — codex to
# OpenAI, agy to Gemini, cursor to Composer — so the default panel already gives
# four distinct architectures against a Claude generator. Leave it alone unless
# you have a reason.
#
# But know that cursor-agent and agy are multi-vendor GATEWAYS, not vendors.
# cursor can serve gpt-5.3-codex, grok-4.5 or claude-opus-5-thinking (1M ctx);
# agy can serve claude-sonnet-4-6, claude-opus-4-6 or gpt-oss-120b. Two
# consequences:
#   · Pinning a member to a Claude model DESTROYS the diversity premise — you
#     would be reviewing Claude's work with Claude. Never do it for review.
#   · Doing exactly that is CORRECT when the job is capacity or context rather
#     than diversity: PANEL_CURSOR_MODEL=claude-opus-5-thinking-high buys a 1M
#     window on Cursor's quota instead of the Claude subscription's.
# Whatever is used is recorded in the ledger, so a panel can never silently
# become one architecture wearing three hats.
PANEL_AGY_MODEL="${PANEL_AGY_MODEL:-}"        # empty = agy's own default (Gemini)
PANEL_CURSOR_MODEL="${PANEL_CURSOR_MODEL:-}"  # empty = cursor's own default (Composer)
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA="$HERE/schema-strict.json"   # OpenAI strict: additionalProperties:false + all props required

PROMPT="$(cat "$PROMPT_FILE")

Respond with ONLY a JSON object matching:
{\"verdict\":\"agree\"|\"disagree\"|\"partial\",\"confidence\":0-1,
 \"findings\":[{\"severity\":\"high\"|\"medium\"|\"low\",\"claim\":\"...\",\"evidence\":\"...\"}],
 \"missed\":\"what the original analysis did not consider\"}"

run() {
  local name="$1" t0=$SECONDS rc
  # GOTCHA (all): codex exec blocks forever on an open inherited stdin
  # ("Reading additional input from stdin..."). </dev/null is mandatory.
  case "$name" in
    claude) timeout "$TIMEOUT" claude -p --permission-mode plan --output-format json \
              "$PROMPT" ;;
    # --output-schema needs an OpenAI *strict* schema (additionalProperties:false at
    # every level, every property listed in required) or you get a 400 + turn.failed.
    codex)  timeout "$TIMEOUT" codex exec --sandbox read-only --skip-git-repo-check \
              --output-schema "$SCHEMA" -o "$OUT/$name.txt" "$PROMPT" ;;
    # GOTCHA: agy uses Go flag parsing — flags MUST precede -p and the prompt is -p's
    # value, else `agy -p --mode plan "..."` silently makes "--mode" the prompt.
    # GOTCHA: --mode plan + --dangerously-skip-permissions => status:"ERROR".
    # Without skip-permissions it auto-denies tools and returns status:"SUCCESS"
    # with an EMPTY response and exit 0. --json-schema only binds under stream-json.
    agy)    timeout "$TIMEOUT" agy --output-format stream-json --dangerously-skip-permissions \
              ${PANEL_AGY_MODEL:+--model "$PANEL_AGY_MODEL"} \
              --json-schema "$SCHEMA" -p "$PROMPT" ;;
    # GOTCHA: hard-fails ("Workspace Trust Required") in any untrusted dir without --trust.
    cursor) timeout "$TIMEOUT" cursor-agent -p --trust --mode ask --output-format json \
              ${PANEL_CURSOR_MODEL:+--model "$PANEL_CURSOR_MODEL"} \
              "$PROMPT" ;;
  esac </dev/null >"$OUT/$name.raw" 2>"$OUT/$name.err"
  rc=$?

  case "$name" in
    claude|cursor) jq -r '.result   // empty' <"$OUT/$name.raw" >"$OUT/$name.txt" 2>/dev/null ;;
    agy)           jq -rs 'map(select(.event=="result"))|last.result.response // empty' \
                      <"$OUT/$name.raw" >"$OUT/$name.txt" 2>/dev/null ;;
    codex)         : ;;  # already written via -o
  esac

  # Agents prepend narration before the JSON, so take the LAST balanced {...}
  # that actually carries a verdict rather than parsing the whole body.
  python3 -c '
import json,sys,re
try: t=open(sys.argv[1]).read()
except OSError: t=""
t=re.sub(r"^```\w*$","",t,flags=re.M); best=None
for i in (m.start() for m in re.finditer(r"\{",t)):
    try: o,_=json.JSONDecoder().raw_decode(t[i:])
    except ValueError: continue
    if isinstance(o,dict) and "verdict" in o: best=o
print(json.dumps(best))' "$OUT/$name.txt" >"$OUT/$name.json" 2>/dev/null || echo null >"$OUT/$name.json"

  printf '%-8s rc=%-3s %3ss  %s\n' "$name" "$rc" "$((SECONDS-t0))" \
    "$(jq -r 'if .==null then "UNPARSEABLE" else "\(.verdict) conf=\(.confidence) findings=\(.findings|length)" end' <"$OUT/$name.json")" >&2
}

for m in $MEMBERS; do run "$m" & done
wait

for m in $MEMBERS; do jq -c --arg m "$m" '{member:$m} + (.//{verdict:"error"})' <"$OUT/$m.json"; done \
  | jq -s '{panel:.,
            verdicts:(map(.verdict)|unique),
            split:((map(.verdict)|unique|length)>1),
            high:[.[]|.findings//[]|.[]|select(.severity=="high")|.claim]}' >"$OUT/panel.json"

echo "--- $OUT/panel.json ---" >&2
jq '{verdicts,split,high}' "$OUT/panel.json" >&2

# ── ledger ──────────────────────────────────────────────────────────────────
# One row per member per run, appended to ~/.claude-skills-panel/ledger.jsonl.
# `outcome` is intentionally left null: nothing here records whether a finding
# was TRUE. That is scored afterwards by the generator, against evidence, via
# `panel-score.sh`. Counting raw findings would reward whichever member is most
# talkative, which is the failure mode this whole harness exists to avoid.
LEDGER_DIR="${PANEL_LEDGER_DIR:-$HOME/.claude-skills-panel}"; mkdir -p "$LEDGER_DIR"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
KIND="${PANEL_KIND:-unclassified}"
# Baseline for automatic scoring. PANEL_TARGET is the artifact under review; if
# the findings were real it gets CHANGED afterwards, and if they were noise it
# does not. That is an outcome, not an opinion — the same reason this repo
# measures outcomes adopted rather than activity generated. panel-observe.sh
# reads these two fields later and needs no human present.
TARGET="${PANEL_TARGET:-}"
BASE_SHA=""
if [ -n "$TARGET" ] && [ -e "$TARGET" ]; then
  BASE_SHA="$(cd "$(dirname "$TARGET")" && git rev-parse HEAD 2>/dev/null || echo "")"
  TARGET="$(readlink -f "$TARGET")"
fi
for m in $MEMBERS; do
  jq -c --arg run "$RUN_ID" --arg m "$m" --arg kind "$KIND" --arg out "$OUT" \
     --arg model "$(case $m in
        agy)    echo "${PANEL_AGY_MODEL:-default(gemini)}" ;;
        cursor) echo "${PANEL_CURSOR_MODEL:-default(composer)}" ;;
        codex)  echo "default(openai)" ;; *) echo default ;; esac)" \
     --arg target "$TARGET" --arg base "$BASE_SHA" \
     '{run:$run, ts:(now|todate), kind:$kind, member:$m, model:$model, outdir:$out,
       target:$target, base_sha:$base,
       verdict:(.verdict//"error"), confidence:(.confidence//null),
       findings:((.findings//[])|length),
       high:((.findings//[])|map(select(.severity=="high"))|length),
       claims:((.findings//[])|map(.claim)), outcome:null}' \
     <"$OUT/$m.json" >>"$LEDGER_DIR/ledger.jsonl"
done
echo "ledger: $LEDGER_DIR/ledger.jsonl  run=$RUN_ID  (score it with panel-score.sh $RUN_ID)" >&2
