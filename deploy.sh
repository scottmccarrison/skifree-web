#!/usr/bin/env bash
# Deploy skifree-web to brain EC2 (served via nginx).
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-scott@100.105.131.123}"
REMOTE_PATH="${REMOTE_PATH:-/var/www/skifree-web}"

cd "$(dirname "$0")"

rsync -avz --delete \
  --exclude '.git' \
  --exclude 'deploy.sh' \
  --exclude 'README.md' \
  --exclude 'infra' \
  ./ "$REMOTE_HOST:$REMOTE_PATH/"

echo "Deployed to $REMOTE_HOST:$REMOTE_PATH"
