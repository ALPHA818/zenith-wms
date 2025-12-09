#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/home/h/Documents/zenith-wms"
UNPACKED_DIR="$APP_DIR/dist/linux-unpacked"
EXECUTABLE="$UNPACKED_DIR/zenith-wms-r-ypkuxpwxsnrzjvm_fit"

if [[ -x "$EXECUTABLE" ]]; then
  exec "$EXECUTABLE" "$@"
else
  # Fallback: run from source with production build
  cd "$APP_DIR"
  if [[ ! -d "$APP_DIR/dist" ]]; then
    npm run build
  fi
  NODE_ENV=production electron . "$@"
fi
