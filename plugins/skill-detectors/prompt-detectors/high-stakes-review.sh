#!/usr/bin/env bash
# Prompt-detector: high-stakes-review
#
# Fires multi-ai-review when a prompt carries stakes markers.
#
# TWO MODES, set by REVIEW_DETECTOR_MODE:
#   auto     (DEFAULT) run the panel, then report findings with the answer
#   suggest            mention it and let the user decide
#   off                emit nothing
#
# Why the hook cannot simply run it: UserPromptSubmit has a 5s timeout and a
# panel takes 30-90s. So this emits a DIRECTIVE and the assistant executes it.
# That is also the safer split — the assistant can still apply the skill's
# second gate (can the others observe something Claude cannot?), which no
# keyword match can judge, and can honour the never-send-secrets rule that a
# blind exec would trample.
#
# Deliberately conservative on triggering. A false positive on `auto` costs a
# minute of spare-subscription capacity; a habit of firing at routine work would
# get the mechanism ignored, which is how these die.
set -u
MODE="${REVIEW_DETECTOR_MODE:-auto}"
[ "$MODE" = "off" ] && exit 0

prompt="$(cat)"
[ -n "$prompt" ] || exit 0
low="$(printf '%s' "$prompt" | tr '[:upper:]' '[:lower:]')"

hit() { printf '%s' "$low" | grep -Eq "$1"; }

# --- explicit asks: the user is already requesting it -----------------------
if hit 'second opinion|cross[- ]?check|cross[- ]?review|peer review|multi[- ]?ai|other (cli|model|agent)s?|another (model|agent) (to )?(check|review|verify)|sanity[- ]?check this'; then
  if [ "$MODE" = "auto" ]; then
    echo "SKILL_SIGNAL: multi-ai-review — the request explicitly asks for outside verification. RUN scripts/panel.sh now, then report the union of findings alongside your answer."
  else
    echo "SKILL_SIGNAL_CANDIDATE: multi-ai-review — the request explicitly asks for outside verification."
  fi
  exit 0
fi

# --- irreversibility / blast radius ----------------------------------------
BLAST='migrat(e|ion)|irreversible|cannot be undone|one[- ]way door|breaking change|schema change|data loss|destructive|force[- ]push|rewrite history|drop (table|database)|delete (all|every)|production|prod deploy|cutover|rollout to (all|every)'
# --- security / trust boundaries -------------------------------------------
SEC='security (review|boundary|model)|auth(entication|orization)? (change|rewrite|boundary)|permission (model|boundary)|credential|secret rotation|token scope|sandbox escape|privilege'
# --- shared, always-loaded, or cross-CLI surfaces ---------------------------
SHARED='agents\.md|claude\.md|arrangement\.md|every (session|agent|cli)|all (four )?clis|shared (config|library|instruction)|loaded into every|marketplace'
# --- published / external-facing artifacts ---------------------------------
PUB='publish|deploy to (prod|live)|goes public|external(ly)? (facing|visible)|customer[- ]facing|press|announcement'

reasons=""
hit "$BLAST"  && reasons="$reasons irreversible-or-wide-blast-radius"
hit "$SEC"    && reasons="$reasons security-or-trust-boundary"
hit "$SHARED" && reasons="$reasons shared-surface-many-agents-read"
hit "$PUB"    && reasons="$reasons published-externally"

[ -n "$reasons" ] || exit 0

# Suppress when the prompt is plainly small — stakes words appear constantly in
# ordinary conversation about this machine, and a nudge on every mention of
# "production" is noise.
if hit 'typo|rename|comment|whitespace|lint|format(ting)?|bump version|just (a|one) (quick|small)'; then
  exit 0
fi

GATE="Stakes are necessary but NOT sufficient: the other CLIs must be able to OBSERVE something Claude cannot. If they could only restate what you already know, skip and say so. Never send secrets, credentials, PII, or internal source — point reviewers at paths on disk instead of pasting content."

if [ "$MODE" = "auto" ]; then
  echo "SKILL_SIGNAL: multi-ai-review —${reasons// / }. Do the work, then RUN scripts/panel.sh against the result and report the union of findings before treating it as done. $GATE"
else
  echo "SKILL_SIGNAL_CANDIDATE: multi-ai-review —${reasons// / }. $GATE"
fi
