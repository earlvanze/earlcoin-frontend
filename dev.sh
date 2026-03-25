#!/bin/bash
# Quick dev server with Cloudflare Tunnel
# Usage: ./dev.sh [port]

PORT=${1:-5173}

echo "=== Starting EarlCoin Dev Server ==="
echo "Port: $PORT"
echo ""

# Start Vite dev server
echo "Starting Vite..."
npm run dev -- --port $PORT --host 0.0.0.0 2>&1 &
DEV_PID=$!

# Wait for Vite to start
sleep 3

# Start Cloudflare quick tunnel
echo "Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:$PORT 2>&1 | grep -o "https://[a-z.-]*.trycloudflare.com" | head -1 > /tmp/earlcoin-tunnel-url &
TUNNEL_PID=$!

# Wait for tunnel URL
sleep 5
TUNNEL_URL=$(cat /tmp/earlcoin-tunnel-url 2>/dev/null)

if [ -n "$TUNNEL_URL" ]; then
  echo ""
  echo "=== Dev Server Ready ==="
  echo "Local: http://localhost:$PORT"
  echo "Tunnel: $TUNNEL_URL"
  echo ""
  echo "PIDs: Vite=$DEV_PID Tunnel=$TUNNEL_PID"
  echo "Press Ctrl+C to stop"
else
  echo "Tunnel URL not found. Check tunnel logs."
fi

trap "kill $DEV_PID $TUNNEL_PID 2>/dev/null; exit" INT TERM
wait
