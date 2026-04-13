#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FTP_HOST="157.173.209.157"
FTP_USER="u847403612.app.earlco.in"
FTP_PASS="${HOSTINGER_FTP_PW:-}"

if [ -z "$FTP_PASS" ]; then
  echo "HOSTINGER_FTP_PW not set" >&2
  exit 1
fi

cd "$ROOT_DIR/dist"

while IFS= read -r -d '' file; do
  clean_file="${file#./}"
  echo "Uploading $clean_file..."
  curl -T "$file" "ftp://${FTP_HOST}/${clean_file}"     --user "${FTP_USER}:${FTP_PASS}"     --ssl-reqd --insecure --ftp-create-dirs --silent --show-error >/dev/null
  echo "✓ $clean_file"
done < <(find . -type f -print0)

echo "Deploy complete!"
