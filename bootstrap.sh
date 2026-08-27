#!/usr/bin/env bash
# bootstrap.sh — onboard a fresh machine in one command.
#
# Fresh machine (repo not cloned yet) — the repo is PUBLIC, so no auth needed:
#   git clone https://github.com/unattachedgray/weft-fabric ~/dev/weft-fabric \
#     && ~/dev/weft-fabric/bootstrap.sh
#
# Already cloned: just run ./bootstrap.sh — it is idempotent, so re-run any time.
#
# There is no separate convergence path. The guided setup confirms a plan, then
# calls agentsync, which is also what runs hourly afterwards. If you are
# enrolling a machine you can reach over ssh, prefer doing
# it from the owner host instead, which also handles the vault:
#
#   wmachine enroll <ssh-host>
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"
exec "$REPO/tools/wsetup" "$@"
