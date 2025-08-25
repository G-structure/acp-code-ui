#!/bin/bash

# Auto-restart wrapper for Claude Code Web UI
# Restarts the app if it gets killed by external processes

echo "Starting Claude Code Web UI with auto-restart..."
echo "Press Ctrl+C twice to stop"

while true; do
    echo "[$(date)] Starting application..."
    npm run dev
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 130 ] || [ $EXIT_CODE -eq 2 ]; then
        # Ctrl+C was pressed (SIGINT)
        echo "Gracefully stopping..."
        break
    else
        echo "[$(date)] Application exited with code $EXIT_CODE"
        echo "Restarting in 2 seconds..."
        sleep 2
    fi
done