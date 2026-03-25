#!/bin/bash
FTP_HOST="157.173.209.157"
FTP_USER="u847403612.app.earlco.in"
FTP_PASS="$HOSTINGER_FTP_PW"
REMOTE_DIR="/public_html"

cd dist

# Upload files
for file in $(find . -type f); do
    echo "Uploading $file..."
    curl -T "$file" "ftp://${FTP_HOST}${REMOTE_DIR}/${file}" --user "${FTP_USER}:${FTP_PASS}" --ssl-reqd
done

echo "Deploy complete!"
