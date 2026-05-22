#!/usr/bin/env bash
# Detector: ast-grep
#
# Fires when ast-grep is installed AND the cwd looks like a code project.
# Emits a `route` signal so structural code searches and multi-file
# pattern rewrites prefer ast-grep over `rg`/`grep`+sed.

set -u

SCOPE_ROOTS="${SKILL_DETECTOR_SCOPE:-$HOME/dev}"

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

# 2. Tool must be on PATH.
command -v ast-grep >/dev/null 2>&1 || exit 0

# 3. cwd should look like code — sgconfig.yml is a strong signal; otherwise
#    require at least one source file in a supported language within
#    shallow depth.
has_code=false
if [ -e "$cwd/sgconfig.yml" ] || [ -e "$cwd/sgconfig.yaml" ]; then
  has_code=true
else
  if find "$cwd" -maxdepth 3 \
    \( -type d \( \
         -name node_modules -o -name .git -o -name __pycache__ \
      -o -name target -o -name dist -o -name build \
      -o -name venv -o -name .venv -o -name .next -o -name .turbo \
    \) -prune \) -o \
    -type f \( \
         -name '*.ts'   -o -name '*.tsx' -o -name '*.js'  -o -name '*.jsx' \
      -o -name '*.py'   -o -name '*.go'  -o -name '*.rs'  -o -name '*.java' \
      -o -name '*.c'    -o -name '*.cc'  -o -name '*.cpp' -o -name '*.h' \
      -o -name '*.hpp'  -o -name '*.rb'  -o -name '*.kt'  -o -name '*.swift' \
      -o -name '*.cs'   -o -name '*.scala' -o -name '*.php' -o -name '*.lua' \
    \) -print -quit 2>/dev/null | grep -q .; then
    has_code=true
  fi
fi
$has_code || exit 0

# 4. Emit route signal.
printf 'SKILL_SIGNAL {"skill":"ast-grep","action":"route","reason":"ast-grep on PATH in a code project; structural pattern queries should prefer it over regex grep","prompt":"For AST-shape queries or multi-file structural rewrites in this repo (matches that depend on syntax-tree shape, not surface text — e.g. find/rewrite call sites, await/.then() conversions, dead branches by AST kind), prefer `ast-grep` over `rg`/`grep`+`sed`. Keep using `rg` for plain text search. See ~/.claude/skills/ast-grep/SKILL.md for the cheat sheet.","scope":"this repo, this session"}\n'
