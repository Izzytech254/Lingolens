#!/usr/bin/env bash
set -euo pipefail

# Start a local tunnel exposing port 3001 using localtunnel (npx localtunnel)
# Requires: node and npx available. Installs localtunnel transiently via npx.
# Usage:
#   ./scripts/start-tunnel.sh
# Example output: your url is: https://abcd.loca.lt

PORT=${1:-3001}

echo "Starting localtunnel for port ${PORT}..."

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found. Please install Node.js (which provides npx)." >&2
  exit 1
fi

# Run localtunnel; it prints the public URL to stdout. We forward whatever it prints.
# If you prefer ngrok, run `ngrok http ${PORT}` instead.
npx localtunnel --port ${PORT}
