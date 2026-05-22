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

# 4. Count source files in graphify-supported languages, capped depth, pruning
#    common heavy dirs.
count=$(find "$cwd" -maxdepth 6 \
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

[ "$count" -ge "$THRESHOLD" ] || exit 0

# 5. Emit signal — single line of JSON.
printf 'SKILL_SIGNAL {"skill":"graphify","action":"offer","reason":"git repo with %s source files under SKILL_DETECTOR_SCOPE; no graphify-out/ yet","prompt":"This repo looks like a Graphify candidate (%s source files, no knowledge graph yet). Want me to build the graph (/graphify .) and install the git hook so commits keep it fresh?","on_yes":"Invoke the graphify skill on the current directory, then run `graphify hook install` to wire post-commit refresh.","scope":"this repo, this session"}\n' "$count" "$count"
