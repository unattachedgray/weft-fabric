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
              --json-schema "$SCHEMA" -p "$PROMPT" ;;
    # GOTCHA: hard-fails ("Workspace Trust Required") in any untrusted dir without --trust.
    cursor) timeout "$TIMEOUT" cursor-agent -p --trust --mode ask --output-format json \
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
