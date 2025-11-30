#!/bin/bash

# Simple auto-restart wrapper for dev server
# This will automatically restart the server if it crashes

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Zenith WMS Development Server with auto-restart..."
echo "Press Ctrl+C to stop"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    pkill -f "vite|wrangler" 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Kill any existing instances first
pkill -f "vite|wrangler" 2>/dev/null || true
sleep 1

# Main loop with auto-restart
while true; do
    echo "=========================================="
    echo "Starting dev server at $(date)"
    echo "=========================================="
    
    # Clean build artifacts
    rm -rf .wrangler
    
    # Start server
    npm run dev
    
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "Server stopped cleanly"
        break
    else
        echo ""
        echo "Server crashed with exit code $EXIT_CODE"
        echo "Restarting in 3 seconds..."
        echo ""
        sleep 3
    fi
done

cleanup
