#!/usr/bin/env bash
# Detector: graphify
#
# Graphify costs ~$10-20 in tokens per run and takes 3-5 min. The value comes
# from cross-file structural insight, which only pays off in genuinely large
# codebases. This detector is deliberately strict — it should fire on real
# monorepos and large applications, not on every git repo above some line count.
#
# Two qualifying tiers:
#   1. Raw scale: >= GRAPHIFY_RAW_SCALE source files (default 500). Big enough
#      that the directory tree alone isn't a useful map.
#   2. Scale + structure: >= GRAPHIFY_MIN_SCALE files (default 200) AND a
#      multi-package layout (packages/, services/, apps/, modules/, libs/,
#      crates/). Monorepo signal — cross-package relationships are the
#      payoff.
#
# Always skips: skill marketplaces, plugin manifests, docs-only repos,
# docs-heavy ratios, and repos that already have a graphify-out/ graph.

set -u

SCOPE_ROOTS="${SKILL_DETECTOR_SCOPE:-$HOME/dev}"
RAW_SCALE="${GRAPHIFY_RAW_SCALE:-500}"
MIN_SCALE="${GRAPHIFY_MIN_SCALE:-200}"

cwd="$PWD"

# 1. Scope check — only fire under configured roots.
in_scope=false
IFS=':' read -ra _roots <<< "$SCOPE_ROOTS"
for root in "${_roots[@]}"; do
  case "$cwd" in
    "$root"|"$root"/*) in_scope=true; break ;;
  esac
done
$in_scope || exit 0

# 2. Must be a git repo.
git -C "$cwd" rev-parse --git-dir >/dev/null 2>&1 || exit 0

# 3. Skip if a graph already exists (graphify is in charge from here).
[ -e "$cwd/graphify-out/graph.json" ] && exit 0

# 4. Skip docs-heavy meta-repos where graphify earns nothing the directory
#    tree doesn't already tell you:
#      - Claude Code skill marketplaces (.claude-plugin/marketplace.json)
#      - individual plugins (.claude-plugin/plugin.json)
#      - docs-only repos: book / docs / wiki / handbook / playbook
[ -f "$cwd/.claude-plugin/marketplace.json" ] && exit 0
[ -f "$cwd/.claude-plugin/plugin.json" ] && exit 0
case "$(basename "$cwd")" in
  docs|book|handbook|playbook|wiki|website|blog) exit 0 ;;
esac

# 5. Count source files in graphify-supported languages, capped depth, pruning
#    common heavy dirs.
prune_args='-type d ( -name node_modules -o -name .git -o -name dist -o -name build -o -name __pycache__ -o -name target -o -name venv -o -name .venv -o -name .next -o -name .turbo -o -name graphify-out ) -prune'

code_count=$(find "$cwd" -maxdepth 6 \
  \( -type d \( \
       -name node_modules -o -name .git -o -name dist -o -name build \
    -o -name __pycache__ -o -name target -o -name venv -o -name .venv \
    -o -name .next -o -name .turbo -o -name graphify-out \
  \) -prune \) -o \
  -type f \( \
       -name '*.py'    -o -name '*.ts'   -o -name '*.tsx'  -o -name '*.js' \
    -o -name '*.jsx'   -o -name '*.go'   -o -name '*.rs'   -o -name '*.java' \
    -o -name '*.cpp'   -o -name '*.cc'   -o -name '*.c'    -o -name '*.h' \
    -o -name '*.hpp'   -o -name '*.rb'   -o -name '*.swift'-o -name '*.kt' \
    -o -name '*.cs'    -o -name '*.scala'-o -name '*.php'  -o -name '*.lua' \
    -o -name '*.ex'    -o -name '*.exs'  -o -name '*.zig'  -o -name '*.jl' \
  \) -print 2>/dev/null | wc -l)

# Below the minimum-scale floor, never fire.
[ "$code_count" -ge "$MIN_SCALE" ] || exit 0

# 6. Docs-heavy guard — when there's substantially more markdown than code,
#    graphify isn't the right tool (the user wants ripgrep, not a knowledge
#    graph). Threshold: skip if md_count > 1.5 * code_count.
md_count=$(find "$cwd" -maxdepth 6 \
  \( -type d \( \
       -name node_modules -o -name .git -o -name dist -o -name build \
    -o -name __pycache__ -o -name target -o -name venv -o -name .venv \
    -o -name .next -o -name .turbo -o -name graphify-out \
  \) -prune \) -o \
  -type f \( -name '*.md' -o -name '*.mdx' \) -print 2>/dev/null | wc -l)

# Integer math: skip when 2*md > 3*code (i.e. md/code > 1.5).
if [ $(( md_count * 2 )) -gt $(( code_count * 3 )) ]; then
  exit 0
fi

# 7. Apply qualifying tiers. Either raw scale (huge codebase, structure
#    irrelevant) or scale-plus-multi-package (monorepo signal).
qualifies=false
tier=""

if [ "$code_count" -ge "$RAW_SCALE" ]; then
  qualifies=true
  tier="raw-scale ($code_count source files)"
fi

# Multi-package detection: canonical monorepo layout directories with
# at least 2 children. Presence of any one is enough.
if ! $qualifies; then
  for d in packages services apps modules libs crates; do
    if [ -d "$cwd/$d" ] && [ "$(find "$cwd/$d" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)" -ge 2 ]; then
      qualifies=true
      tier="multi-package layout ($code_count source files, $d/ workspace)"
      break
    fi
  done
fi

$qualifies || exit 0

# 8. Emit signal — single line of JSON. The prompt is explicit about cost so
#    the user knows what they are agreeing to.
printf 'SKILL_SIGNAL {"skill":"graphify","action":"offer","reason":"%s; no graphify-out/ yet","prompt":"This repo qualifies as a Graphify candidate: %s. A full run is ~$10-20 in tokens and 3-5 min wall time, and produces a queryable knowledge graph + interactive HTML. Worth it for codebases where cross-file structure is not obvious from the tree. Build it now (/graphify .) + install the post-commit hook?","on_yes":"Invoke the graphify skill on the current directory, then run `graphify hook install` to wire post-commit refresh.","scope":"this repo, this session"}\n' "$tier" "$tier"
