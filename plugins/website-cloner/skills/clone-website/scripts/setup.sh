#!/usr/bin/env bash
# One-time setup for the clone-website scripts: npm deps + a Chromium build.
# Idempotent. Prints what it checked; exits non-zero when something is missing.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"
if ! command -v node >/dev/null; then echo "node is not installed (need >= 18)" >&2; exit 1; fi
major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$major" -lt 18 ]; then echo "node $major is too old (need >= 18)" >&2; exit 1; fi
if [ ! -d node_modules/playwright ] || [ ! -d node_modules/pixelmatch ] || [ ! -d node_modules/pngjs ] || [ ! -d node_modules/jpeg-js ]; then
  echo "[setup] npm install"; npm install --no-audit --no-fund
else
  echo "[setup] npm deps present"
fi
# Chromium for this playwright version (no-op when already cached)
echo "[setup] playwright install chromium"; npx playwright install chromium
node -e 'require("playwright"); require("pixelmatch"); require("pngjs"); require("jpeg-js"); console.log("[setup] ok: playwright " + require("playwright/package.json").version)'
