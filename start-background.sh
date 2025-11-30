#!/bin/bash

# Keep-alive script for development server
# Runs in background and auto-restarts on failure

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/dev-server.log"
PID_FILE="$SCRIPT_DIR/.dev-server.pid"

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 $OLD_PID 2>/dev/null; then
        echo "Dev server already running with PID $OLD_PID"
        echo "Use 'npm run stop' to stop it first"
        exit 1
    fi
    rm -f "$PID_FILE"
fi

# Start in background with nohup
echo "Starting dev server in background..."
echo "Logs: $LOG_FILE"

nohup bash -c '
    cd "'$SCRIPT_DIR'"
    while true; do
        echo "========================================" >> "'$LOG_FILE'"
        echo "Starting at $(date)" >> "'$LOG_FILE'"
        echo "========================================" >> "'$LOG_FILE'"
        
        rm -rf .wrangler
        npm run dev >> "'$LOG_FILE'" 2>&1
        
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 0 ]; then
            echo "Server stopped cleanly at $(date)" >> "'$LOG_FILE'"
            break
        fi
        
        echo "Server crashed at $(date), restarting in 3s..." >> "'$LOG_FILE'"
        sleep 3
    done
' > /dev/null 2>&1 &

BACKGROUND_PID=$!
echo $BACKGROUND_PID > "$PID_FILE"

sleep 2

if kill -0 $BACKGROUND_PID 2>/dev/null; then
    echo "✅ Dev server started successfully (PID: $BACKGROUND_PID)"
    echo "🌐 Server available at: http://localhost:3000"
    echo "📋 Logs: tail -f $LOG_FILE"
    echo "🛑 Stop: npm run stop"
else
    echo "❌ Failed to start dev server"
    rm -f "$PID_FILE"
    exit 1
fi
