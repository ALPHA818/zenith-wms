#!/bin/bash

# Zenith WMS Development Server Manager
# This script ensures the dev server stays running

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Log file
LOG_FILE="$SCRIPT_DIR/dev-server.log"
PID_FILE="$SCRIPT_DIR/.dev-server.pid"

# Function to cleanup on exit
cleanup() {
    echo "$(date): Shutting down dev server..." | tee -a "$LOG_FILE"
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        kill $PID 2>/dev/null || true
        rm -f "$PID_FILE"
    fi
    pkill -f "vite|wrangler" || true
    exit 0
}

# Trap signals
trap cleanup SIGINT SIGTERM

# Kill any existing instances
echo "$(date): Stopping any existing dev servers..." | tee -a "$LOG_FILE"
pkill -f "vite|wrangler" || true
sleep 2

# Clean up old build artifacts
echo "$(date): Cleaning build artifacts..." | tee -a "$LOG_FILE"
rm -rf .wrangler

# Start the dev server
echo "$(date): Starting dev server..." | tee -a "$LOG_FILE"
npm run dev 2>&1 | tee -a "$LOG_FILE" &
DEV_PID=$!

# Save PID
echo $DEV_PID > "$PID_FILE"

echo "$(date): Dev server started with PID $DEV_PID" | tee -a "$LOG_FILE"
echo "Server should be available at http://localhost:3000"
echo "Logs are being written to: $LOG_FILE"
echo "Press Ctrl+C to stop the server"

# Monitor the process
while kill -0 $DEV_PID 2>/dev/null; do
    sleep 5
done

echo "$(date): Dev server process ended unexpectedly" | tee -a "$LOG_FILE"
cleanup
