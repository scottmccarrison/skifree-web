#!/usr/bin/env bash
# Deploy the skidev-api worker to mccarrison.me/skidev.
#
# Safety: refuses to run from main branch (which would deploy a stale,
# pre-multiplayer build to dev). Warns if not on playtest/multiplayer.

set -euo pipefail

cd "$(dirname "$0")/.."

branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$branch" = "main" ]; then
  echo "ERROR: refusing to deploy dev from main branch."
  echo "Switch to playtest/multiplayer (or another feature branch) first."
  exit 1
fi

if [ "$branch" != "playtest/multiplayer" ]; then
  echo "WARNING: deploying dev from branch '$branch' (not playtest/multiplayer)."
  read -r -p "Continue? [y/N] " ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "aborted"; exit 1 ;;
  esac
fi

echo "Deploying skidev-api from branch '$branch'..."
cd worker
npx wrangler deploy --config wrangler.dev.toml
echo
echo "Done. Live at https://mccarrison.me/skidev/"
