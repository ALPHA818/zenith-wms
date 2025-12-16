#!/usr/bin/env bash
set -euo pipefail

# Start Vite dev server (with Cloudflare plugin) and then launch Electron
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export VITE_ENABLE_CF_PLUGIN=true
 # Use strict CSP during Electron dev to avoid 'unsafe-eval' warning in Electron
 export VITE_CSP="default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http: https: ws: wss:; worker-src 'self' blob:; frame-src 'self'"

# Stop any previous servers
npm run stop >/dev/null 2>&1 || true

# Start background dev server (auto-restart + logs)
npm run dev:bg

# Small wait to let the server boot
sleep 3

# Launch Electron using robust CJS entry that auto-detects dev port
export NODE_ENV=development
exec npx electron electron/main.cjs
