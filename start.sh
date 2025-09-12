#!/bin/bash

# Get IP address from first argument, default to localhost
BIND_IP=${1:-localhost}

# Kill any existing processes on ports 3000, 3001, and 3002
echo "🔍 Checking for existing processes..."
echo "🌐 Binding to IP: $BIND_IP"

unset ANTHROPIC_API_KEY
## comment this out if you'd rather use API key tokens instead of a Claude subscription

# Kill processes on port 3001 (backend)
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Found process on port 3001, killing it..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Kill processes on port 3002 (WebSocket)
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Found process on port 3002, killing it..."
    lsof -ti:3002 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Kill processes on port 3000 (frontend)
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Found process on port 3000, killing it..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Also kill any npm/node processes related to this project
pkill -f "claude-code-web-ui" 2>/dev/null || true

echo "✅ Ports cleared!"
echo ""

# Start the backend
echo "🚀 Starting backend on port 3001..."
cd backend
BIND_IP=$BIND_IP npm run dev &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start the frontend
echo "🚀 Starting frontend on port 3000..."
cd ../frontend
BIND_IP=$BIND_IP npm run dev &
FRONTEND_PID=$!

echo ""
echo "✨ Claude Code Web UI is starting!"
echo "   Backend:  http://$BIND_IP:3001 (PID: $BACKEND_PID)"
echo "   WebSocket: ws://$BIND_IP:3002"
echo "   Frontend: http://$BIND_IP:3000 (PID: $FRONTEND_PID)"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to handle cleanup
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    # Also kill any child processes
    pkill -P $BACKEND_PID 2>/dev/null || true
    pkill -P $FRONTEND_PID 2>/dev/null || true
    echo "👋 Goodbye!"
    exit 0
}

# Set up trap to handle Ctrl+C
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
