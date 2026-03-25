#!/bin/bash
# One-time setup for named Cloudflare Tunnel at dev.earlco.in

echo "=== Named Tunnel Setup for dev.earlco.in ==="
echo ""

# Step 1: Login to Cloudflare
echo "Step 1: Authenticate with Cloudflare"
cloudflared login

if [ $? -ne 0 ]; then
  echo "Login failed. Please run 'cloudflared login' manually."
  exit 1
fi

# Step 2: Create tunnel (skip if exists)
echo ""
echo "Step 2: Checking for existing tunnel..."
TUNNEL_ID=$(cloudflared tunnel list --name earlcoin-dev 2>/dev/null | grep earlcoin-dev | awk '{print $1}')

if [ -z "$TUNNEL_ID" ]; then
  echo "Creating new tunnel 'earlcoin-dev'..."
  TUNNEL_ID=$(cloudflared tunnel create earlcoin-dev 2>&1 | grep -oP '\b[0-9a-f]{36}\b' | head -1)
  if [ -z "$TUNNEL_ID" ]; then
    echo "Failed to create tunnel."
    exit 1
  fi
  echo "✓ Tunnel created: $TUNNEL_ID"
else
  echo "✓ Tunnel already exists: $TUNNEL_ID"
fi

# Step 3: Configure tunnel routing (idempotent)
echo ""
echo "Step 3: Configuring DNS route..."
cloudflared tunnel route dns earlcoin-dev dev.earlco.in 2>&1 | grep -q "already exists" && echo "✓ DNS route already configured" || echo "✓ DNS route added"

# Step 4: Create config file
echo ""
echo "Step 4: Creating tunnel config..."
mkdir -p $HOME/.cloudflared
cat > $HOME/.cloudflared/earlcoin-dev.yml << YMLEOF
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: dev.earlco.in
    service: http://localhost:5173
  - service: http_status:404
YMLEOF

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To run the tunnel:"
echo "  cloudflared tunnel run earlcoin-dev"
echo ""
echo "Dev URL: https://dev.earlco.in"
