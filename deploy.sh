#!/bin/bash
# Build + FTP deploy + Cloudflare cache purge
set -e

echo "=== EarlCoin Deployment ==="
echo ""

# Build
echo "1. Building production bundle..."
npm run build

# Deploy
echo ""
echo "2. Deploying to Hostinger FTP..."
cd dist
for file in $(find . -type f -not -name ".*"); do
  filepath="${file#./}"
  curl -T "$file" "ftp://157.173.209.157:21/${filepath}" --user "u847403612.app.earlco.in:$HOSTINGER_FTP_PW" -s -o /dev/null && echo "✓ $filepath" || echo "✗ $filepath"
done
cd ..

# Cache purge
echo ""
echo "3. Purging Cloudflare cache..."
if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
  RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/691a9c53ce375755cd4e766e07507c82/purge_cache" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}')
  
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
