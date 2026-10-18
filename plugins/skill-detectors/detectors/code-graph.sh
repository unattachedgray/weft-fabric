#!/usr/bin/env bash
# Detector: code-graph — which code graph a project uses (replaces graphify.sh).
#
# Shared rule (principles/AGENTS.md, "Code Graphs"): one graph per project.
# Graphify for mixed technical projects (much of the meaning in docs, specs,
# PDFs), codebase-memory MCP for pure codebases. A fixed rule over file
# counts, not a model call: the input is measurable and this runs at every
# session start (owner, 2026-10-18).
#
# Order:
#   1. a choice already made is followed, silently:
#      graphify-out/graph.json  -> route to the graphify skill
#      the project's AGENTS.md / CLAUDE.md names one -> that one
#      codebase-memory already indexes the project -> use its tools
#   2. otherwise count code files C and document files D (md, mdx, rst, txt,
#      adoc, org, pdf, docx), pruning dependency and build directories:
#      C + D < CODE_GRAPH_MIN (default 100)        -> nothing (the tree is map enough)
#      D * 10 >= C * CODE_GRAPH_MIXED (default 4)  -> mixed: offer Graphify
#      else, C >= 100                              -> pure code: offer codebase-memory
#
# The 0.4 docs-to-code threshold was set from ~/dev on 2026-10-18: weft-fabric
# (2.4), deepseek-harness (0.48) and unattached (0.41) come out mixed; weft
# (0.23), worldmonitor (0.24), ussropia (0.31), sgj (0.12), fluxcommander,
# strategyacademy and chillpal come out pure code. Counting files, not bytes,
# is a known approximation; tune with the two variables above.

set -u

SCOPE_ROOTS="${SKILL_DETECTOR_SCOPE:-$HOME/dev}"
MIN="${CODE_GRAPH_MIN:-100}"
MIXED="${CODE_GRAPH_MIXED:-4}"
cwd="$PWD"

in_scope=false
IFS=':' read -ra _roots <<< "$SCOPE_ROOTS"
for root in "${_roots[@]}"; do
  case "$cwd" in "$root"|"$root"/*) in_scope=true; break ;; esac
done
$in_scope || exit 0
git -C "$cwd" rev-parse --git-dir >/dev/null 2>&1 || exit 0
[ -f "$cwd/.claude-plugin/marketplace.json" ] && exit 0
[ -f "$cwd/.claude-plugin/plugin.json" ] && exit 0

graphify_route() {
  printf 'SKILL_SIGNAL {"skill":"graphify","action":"route","reason":"%s","prompt":"This project uses Graphify as its code graph: for structural questions read graphify-out/ (graph.json, GRAPH_REPORT.md) through the graphify skill before grepping.","scope":"this repo, this session"}\n' "$1"
}
cbm_route() {
  printf 'SKILL_SIGNAL {"skill":"codebase-memory","action":"constrain","reason":"%s","prompt":"This project uses codebase-memory MCP as its code graph: for structural questions (where is X, who calls Y, what does a change touch) use its search_graph / trace_path / detect_changes tools before grep, and re-index after a large restructure. Do not build a Graphify graph here (one graph per project).","scope":"this repo, this session"}\n' "$1"
}

# 1. a choice already made
if [ -e "$cwd/graphify-out/graph.json" ]; then graphify_route "graphify-out/ exists"; exit 0; fi
for f in AGENTS.md CLAUDE.md .claude/CLAUDE.md; do
  [ -f "$cwd/$f" ] || continue
  sect=$(awk 'tolower($0) ~ /^#+ +code graph/ {on=1; next} on && /^#+ / {exit} on' "$cwd/$f")
  if printf '%s' "$sect" | grep -qi 'codebase-memory'; then cbm_route "recorded in $f"; exit 0; fi
  if printf '%s' "$sect" | grep -qi 'graphify'; then graphify_route "recorded in $f"; exit 0; fi
done
if command -v codebase-memory-mcp >/dev/null 2>&1; then
  roots=$(timeout 3 codebase-memory-mcp cli list_projects '{}' 2>/dev/null \
          | python3 -c 'import json,sys; [print(p["root_path"]) for p in json.load(sys.stdin).get("projects",[])]' 2>/dev/null)
  if printf '%s\n' "$roots" | grep -qxF "$cwd"; then cbm_route "already indexed by codebase-memory"; exit 0; fi
fi

# 2. classify by counts
count() {
  find "$cwd" -maxdepth 6 \( -type d \( -name node_modules -o -name .git -o -name dist -o -name build \
       -o -name __pycache__ -o -name target -o -name venv -o -name .venv -o -name .next -o -name .turbo \
       -o -name graphify-out -o -name .codebase-memory \) -prune \) -o -type f \( "$@" \) -print 2>/dev/null | wc -l
}
C=$(count -name '*.py' -o -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.go' \
         -o -name '*.rs' -o -name '*.java' -o -name '*.c' -o -name '*.cc' -o -name '*.cpp' -o -name '*.h' \
         -o -name '*.hpp' -o -name '*.cs' -o -name '*.rb' -o -name '*.swift' -o -name '*.kt' -o -name '*.lua' \
         -o -name '*.sh' -o -name '*.php' -o -name '*.scala' -o -name '*.zig')
D=$(count -name '*.md' -o -name '*.mdx' -o -name '*.rst' -o -name '*.txt' -o -name '*.adoc' -o -name '*.org' \
         -o -name '*.pdf' -o -name '*.docx')
[ $((C + D)) -ge "$MIN" ] || exit 0

if [ $((D * 10)) -ge $((C * MIXED)) ]; then
  printf 'SKILL_SIGNAL {"skill":"graphify","action":"offer","reason":"mixed project: %s code files, %s documents","prompt":"This project mixes code with a lot of documentation (%s code files, %s documents), so the shared rule picks Graphify as its code graph. Building it is a full /graphify run (model tokens, a few minutes). Build it now, record the choice under a ## Code graph heading in AGENTS.md, and install the post-commit refresh?","on_yes":"Invoke the graphify skill on the current directory, run `graphify hook install`, and add a ## Code graph section to the project AGENTS.md naming Graphify and why.","scope":"this repo, this session"}\n' "$C" "$D" "$C" "$D"
elif [ "$C" -ge 100 ]; then
  printf 'SKILL_SIGNAL {"skill":"codebase-memory","action":"offer","reason":"pure codebase: %s code files, %s documents","prompt":"This is mostly code (%s code files, %s documents), so the shared rule picks codebase-memory MCP as its code graph. Indexing is local and costs no tokens. Index it now and record the choice under a ## Code graph heading in AGENTS.md?","on_yes":"Call the codebase-memory index_repository tool on the project root, then add a ## Code graph section to the project AGENTS.md naming codebase-memory and why.","scope":"this repo, this session"}\n' "$C" "$D" "$C" "$D"
fi
