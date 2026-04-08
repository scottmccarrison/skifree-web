#!/usr/bin/env bash
# Deploy the skidev-api worker to mccarrison.me/skidev.
#
# Safety: refuses to run from main branch. Any other branch is fine -
# /skidev is the playtest endpoint and the current playtest branch is
# whatever you're working on.

set -euo pipefail

cd "$(dirname "$0")/.."

branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$branch" = "main" ]; then
  echo "ERROR: refusing to deploy dev from main branch."
  echo "Switch to a playtest branch first."
  exit 1
fi

echo "Deploying skidev-api from branch '$branch'..."
cd worker
npx wrangler deploy --config wrangler.dev.toml
echo
echo "Done. Live at https://mccarrison.me/skidev/"
