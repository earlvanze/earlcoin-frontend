#!/bin/bash
# Quick dev tunnel for earlcoin
# Usage: ./dev-tunnel.sh [port]

PORT=${1:-5173}
echo "Starting Vite dev server on port $PORT..."
npm run dev -- --port $PORT --host 0.0.0.0 &
DEV_PID=$!

sleep 3
echo "Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:$PORT 2>&1 | tee tunnel.log &
TUNNEL_PID=$!

echo ""
echo "=== Dev Server Ready ==="
echo "Vite PID: $DEV_PID"
echo "Tunnel PID: $TUNNEL_PID"
echo "Check tunnel.log for the public URL"
echo "Press Ctrl+C to stop"

trap "kill $DEV_PID $TUNNEL_PID 2>/dev/null; exit" INT TERM
wait
