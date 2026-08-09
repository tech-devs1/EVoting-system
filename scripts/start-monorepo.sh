#!/bin/sh
set -e

echo "=========================================="
echo "⚡ Starting HTU Elect Production Monorepo"
echo "=========================================="

# Set internal backend URL for Next.js API proxying
export BACKEND_URL="http://127.0.0.1:5000"

# 1. Launch Express Backend API on loopback port 5000
echo "🚀 Starting Express Backend Server on 127.0.0.1:5000..."
PORT=5000 node backend/server.js &

# 2. Brief pause for backend initialization & MySQL connection pool setup
sleep 3

# 3. Launch Next.js Frontend Web App on Railway container PORT
RAILWAY_PORT=${PORT:-3000}
echo "🎨 Starting Next.js Frontend Server on port ${RAILWAY_PORT}..."
exec npx next start frontend -p ${RAILWAY_PORT} -H 0.0.0.0
