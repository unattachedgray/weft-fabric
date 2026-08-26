#!/usr/bin/env bash
# bootstrap.sh — onboard a fresh machine in one command.
#
# Fresh machine (repo not cloned yet) — the repo is PUBLIC, so no auth needed:
#   git clone https://github.com/unattachedgray/claude-skills ~/dev/claude-skills \
#     && ~/dev/claude-skills/bootstrap.sh
#
# Already cloned: just run ./bootstrap.sh — it is idempotent, so re-run any time.
#
# There is no separate "install" path any more. Bootstrap is agentsync plus a
# timer, and agentsync is what runs hourly afterwards — so the code that sets a
# machine up is the same code that keeps it right, exercised constantly instead
# of once. If you are enrolling a machine you can reach over ssh, prefer doing
# it from the owner host instead, which also handles the vault:
#
#   wmachine enroll <ssh-host>
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"

echo "== 1/3  converge this machine with the repo =="
"$REPO/scripts/agentsync"

echo
echo "== 2/3  keep it converged (hourly) =="
"$REPO/scripts/agentsync" --install-timer || \
  echo "  no systemd --user here — schedule 'scripts/agentsync --quiet' with this platform's scheduler"

echo
echo "== 3/3  next steps =="
cat <<'NEXT'
  Machine-local notes:  ~/.config/agents/MACHINE.md   (a stub was created if absent)
  Check the fleet:      wfleet status
  Enrol another box:    wmachine enroll <ssh-host>     (from the owner host)

  Skills are a command away:
     claude plugin install catalog@unatt       # index of everything available
     claude plugin install workflow@unatt      # dev lifecycle, planning
     claude plugin install review@unatt        # code review + security
NEXT
echo
echo "done — principles, skills and tools active in every detected CLI."
