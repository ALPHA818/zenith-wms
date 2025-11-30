#!/bin/bash

# Quick status check for dev server

echo "🔍 Zenith WMS Development Server Status"
echo "========================================"
echo ""

# Check if server process is running
if ps aux | grep -E 'vite.*3000' | grep -v grep > /dev/null; then
    echo "✅ Server process: RUNNING"
    PID=$(ps aux | grep -E 'vite.*3000' | grep -v grep | awk '{print $2}' | head -1)
    echo "   PID: $PID"
else
    echo "❌ Server process: NOT RUNNING"
fi

echo ""

# Check if port is accessible
if curl -s -I http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ HTTP connection: OK"
    echo "   URL: http://localhost:3000"
else
    echo "❌ HTTP connection: FAILED"
    echo "   Run: npm run dev:bg"
fi

echo ""

# Check PID file
if [ -f .dev-server.pid ]; then
    BG_PID=$(cat .dev-server.pid)
    if kill -0 $BG_PID 2>/dev/null; then
        echo "✅ Background service: RUNNING"
        echo "   PID: $BG_PID"
    else
        echo "⚠️  Background service: STALE (PID file exists but process is dead)"
        echo "   Run: npm run stop && npm run dev:bg"
    fi
else
    echo "ℹ️  Background service: Not started"
    echo "   Run: npm run dev:bg"
fi

echo ""

# Check log file
if [ -f dev-server.log ]; then
    LOG_SIZE=$(du -h dev-server.log | cut -f1)
    echo "📋 Log file: dev-server.log ($LOG_SIZE)"
    echo "   View: npm run logs"
    echo ""
    echo "   Last 5 lines:"
    tail -5 dev-server.log | sed 's/^/   | /'
else
    echo "📋 Log file: Not found"
fi

echo ""
echo "========================================"
echo "Quick commands:"
echo "  npm run dev:bg    - Start background server"
echo "  npm run stop      - Stop all servers"
echo "  npm run logs      - View live logs"
echo "  npm run status    - Run this check"
