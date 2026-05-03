#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FTP_HOST="157.173.209.157"
FTP_USER="u847403612.app.earlco.in"
FTP_PASS="${HOSTINGER_FTP_PW:-}"

if [ -z "$FTP_PASS" ]; then
  echo "HOSTINGER_FTP_PW not set" >&2
  exit 1
fi

# Build frontend
echo "Building frontend..."
cd "$ROOT_DIR/frontend"
npm ci
npm run build

# Deploy from frontend/dist
cd "$ROOT_DIR/frontend/dist"

echo "Cleaning stale remote assets..."
current_assets=$(find assets -maxdepth 1 -type f -printf '%f\n' 2>/dev/null | sort)
remote_assets=$(curl "ftp://${FTP_HOST}/assets/" \
  --user "${FTP_USER}:${FTP_PASS}" \
  --ssl-reqd --insecure --silent --show-error 2>/dev/null \
  | awk '/^-/{print $NF}' | sort || true)

while IFS= read -r asset; do
  [ -n "$asset" ] || continue
  if ! printf '%s\n' "$current_assets" | grep -Fxq "$asset"; then
    echo "Deleting stale assets/$asset..."
    curl "ftp://${FTP_HOST}/" \
      --user "${FTP_USER}:${FTP_PASS}" \
      --ssl-reqd --insecure --silent --show-error \
      -Q "DELE assets/$asset" >/dev/null || true
  fi
done <<< "$remote_assets"

while IFS= read -r -d '' file; do
  clean_file="${file#./}"
  echo "Uploading $clean_file..."
  curl -T "$file" "ftp://${FTP_HOST}/${clean_file}" \
    --user "${FTP_USER}:${FTP_PASS}" \
    --ssl-reqd --insecure --ftp-create-dirs --silent --show-error >/dev/null
  echo "✓ $clean_file"
done < <(find . -type f -print0)

echo "Deploy complete!"
