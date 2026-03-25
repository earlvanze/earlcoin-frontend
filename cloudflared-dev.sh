#!/bin/bash
# Dev server with Cloudflare Tunnel
PORT=${1:-5173}
TUNNEL_NAME="earlcoin-dev"

# Start Vite dev server in background
npm run dev -- --port $PORT --host 0.0.0.0 &
DEV_PID=$!

# Start Cloudflare Tunnel to local dev server
cloudflared tunnel --url http://localhost:$PORT --hostname dev.earlco.in 2>&1 &
TUNNEL_PID=$!

echo "Dev server running on port $PORT"
echo "Tunnel PID: $TUNNEL_PID"
echo "Dev PID: $DEV_PID"

trap "kill $DEV_PID $TUNNEL_PID 2>/dev/null" EXIT
wait
