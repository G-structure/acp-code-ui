#!/bin/bash

echo "🛑 Stopping Claude Code Web UI..."

# Kill processes on port 3001 (backend)
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   Stopping backend on port 3001..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
fi

# Kill processes on port 3000 (frontend)
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   Stopping frontend on port 3000..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

# Also kill any npm/node processes related to this project
pkill -f "claude-code-web-ui" 2>/dev/null || true

echo "✅ All services stopped!"