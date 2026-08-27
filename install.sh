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

YES=0
INSPECT=0
SETUP_ARGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --yes) YES=1 ;;
    --inspect) INSPECT=1 ;;
    --no-timer) SETUP_ARGS+=(--no-timer) ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

echo "== checking prerequisites =="
missing=""
for t in git python3; do have "$t" || missing="$missing $t"; done
detected=""
add_detected() { detected="${detected}${detected:+, }$1"; }
{ have claude || [ -d "$HOME/.claude" ]; } && add_detected claude
{ have codex || [ -d "$HOME/.codex" ]; } && add_detected codex
{ have gemini || have agy || [ -d "$HOME/.gemini" ]; } && add_detected gemini
{ have cursor-agent || have cursor || [ -d "$HOME/.cursor" ]; } && add_detected cursor
{ have dsh || [ -d "$HOME/.dsh" ]; } && add_detected dsh
ssh_bits="none"
have ssh && ssh_bits="client"
have sshd && ssh_bits="${ssh_bits/client/client + server}"
echo "  Required: ${missing:+missing$missing}${missing:-git and Python present}"
echo "  Agent CLIs: ${detected:-none (optional; Fabric wires them when added)}"
echo "  SSH: $ssh_bits (server is optional for local setup)"
echo
echo "== proposed =="
echo "  • ${missing:+install$missing, then }clone or update $REPO_DIR"
echo "  • configure only the detected CLIs; leave absent CLIs untouched"
echo "  • create machine-local notes and install hourly convergence"
if [ -n "${TRUST_GITHUB:-}" ]; then
  echo "  • trust public SSH keys published by github.com/$TRUST_GITHUB (explicit opt-in)"
else
  echo "  • do not change SSH trust or credentials"
fi

if [ "$INSPECT" -eq 1 ]; then
  echo "inspection only; nothing changed"
  exit 0
fi
if [ "$YES" -ne 1 ]; then
  [ -t 0 ] && [ -t 1 ] || die "confirmation requires a terminal; use --inspect first and --yes only in prepared automation"
  printf "Apply this plan? [y/N] "
  read -r answer
  case "$answer" in y|Y|yes|YES) ;; *) die "nothing changed" ;; esac
fi

if [ -n "$missing" ]; then
  prefix=()
  if [ "$(id -u)" -ne 0 ]; then
    have sudo || die "administrator access is needed to install:$missing, but sudo is unavailable"
    prefix=(sudo)
  fi
  if have apt-get; then "${prefix[@]}" apt-get update -qq; "${prefix[@]}" apt-get install -y git python3
  elif have dnf; then "${prefix[@]}" dnf install -y git python3
  elif have pacman; then "${prefix[@]}" pacman -Sy --noconfirm git python
  elif have zypper; then "${prefix[@]}" zypper --non-interactive install git python3
  else die "no supported package manager found for:$missing"; fi
fi
have git && have python3 || die "prerequisite installation did not produce git and python3"
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
# The human already confirmed the complete install plan above. Do not ask the
# same question again inside the post-clone setup stage.
exec "$REPO_DIR/bootstrap.sh" --yes "${SETUP_ARGS[@]}"
