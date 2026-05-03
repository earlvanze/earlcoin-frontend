#!/bin/bash
# Build + FTP deploy + Cloudflare cache purge
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

load_build_env() {
  while IFS='=' read -r key _; do
    if [[ "$key" == VITE_* ]]; then
      unset "$key"
    fi
  done < <(env)

  set -a
  [ -f "$ROOT_DIR/.env" ] && . "$ROOT_DIR/.env"
  [ -f "$ROOT_DIR/.env.local" ] && . "$ROOT_DIR/.env.local"
  set +a
}

echo "=== EarlCoin Deployment ==="
echo ""

echo "1. Building production bundle..."
load_build_env
npm run build

echo ""
echo "2. Deploying to Hostinger FTP..."
"$ROOT_DIR/deploy-ftp.sh"

echo ""
echo "3. Purging Cloudflare cache..."
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/691a9c53ce375755cd4e766e07507c82/purge_cache"     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"     -H "Content-Type: application/json"     --data '{"purge_everything":true}')

  if echo "$RESULT" | grep -q '"success":true'; then
    echo "✓ Cache purged successfully"
  else
    echo "⚠ Cache purge failed (check API token)"
    echo "$RESULT" | head -5
  fi
else
  echo "⚠ CLOUDFLARE_API_TOKEN not set"
fi

echo ""
echo "=== Deploy Complete ==="
echo "Site: https://app.earlco.in"
echo "Build: $(ls -t dist/assets/*.js | head -1 | xargs basename)"
