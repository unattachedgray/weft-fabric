#!/usr/bin/env bash
# Detector: graphify
#
# Fires when the cwd looks like a code project that doesn't yet have a
# Graphify knowledge graph. Emits an `offer` signal asking the user whether
# to build one + install the git hook so it stays fresh.

set -u

SCOPE_ROOTS="${SKILL_DETECTOR_SCOPE:-$HOME/dev}"
THRESHOLD="${GRAPHIFY_FILE_THRESHOLD:-30}"

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

[ "$code_count" -ge "$THRESHOLD" ] || exit 0

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

count="$code_count"

# 7. Emit signal — single line of JSON.
printf 'SKILL_SIGNAL {"skill":"graphify","action":"offer","reason":"git repo with %s source files under SKILL_DETECTOR_SCOPE; no graphify-out/ yet","prompt":"This repo looks like a Graphify candidate (%s source files, no knowledge graph yet). Want me to build the graph (/graphify .) and install the git hook so commits keep it fresh?","on_yes":"Invoke the graphify skill on the current directory, then run `graphify hook install` to wire post-commit refresh.","scope":"this repo, this session"}\n' "$count" "$count"
