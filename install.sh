#!/usr/bin/env bash
# install.sh — stand up a new machine with one command, pulling everything.
#
#   curl -fsSL https://raw.githubusercontent.com/unattachedgray/weft-fabric/main/install.sh | bash
#
# Optionally seed SSH trust at the same time, so the owner host can reach this
# box afterwards without anyone copying a key around:
#
#   curl -fsSL .../install.sh | TRUST_GITHUB=unattachedgray bash
#
# Why this can be pull-based at all: the config layer carries NO secrets. The
# principles, the skills, the tools and every CLI's wiring are public content,
# so a machine can fetch and apply all of it with nothing but internet access.
# Credentials (the vault token) are a separate, later, optional step — a machine
# is fully useful without one.
#
# Safe to re-run. It converges rather than installs.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/unattachedgray/weft-fabric}"
REPO_DIR="${REPO_DIR:-$HOME/dev/weft-fabric}"

die() { echo "install: $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

echo "== checking prerequisites =="
missing=""
for t in git python3; do have "$t" || missing="$missing $t"; done
[ -z "$missing" ] || die "missing:$missing — install them first, then re-run"
echo "  git $(git --version | cut -d' ' -f3), python $(python3 -c 'import sys;print(".".join(map(str,sys.version_info[:3])))')"

echo
echo "== fetching the shared repo =="
if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" pull --ff-only --quiet 2>/dev/null || echo "  (local changes — pull skipped)"
  echo "  updated $REPO_DIR"
else
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone --quiet "$REPO_URL" "$REPO_DIR"
  echo "  cloned into $REPO_DIR"
fi

# Opt in to GitHub-published SSH trust BEFORE the first sync, so the very first
# agentsync run also authorizes the owner host. That is what removes the manual
# "copy your key over" step for a brand-new machine.
if [ -n "${TRUST_GITHUB:-}" ]; then
  echo
  echo "== seeding ssh trust from github.com/$TRUST_GITHUB =="
  mkdir -p "$HOME/.config/agents"
  printf '%s\n' "$TRUST_GITHUB" > "$HOME/.config/agents/trust-github"
  echo "  anyone holding a key on that account can ssh here — that is the trade"
fi

echo
exec "$REPO_DIR/bootstrap.sh"
