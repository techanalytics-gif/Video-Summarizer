#!/bin/bash
# Render Start Script
# Starts the PO Token server in the background, then the Python backend

echo "=== Starting PO Token Server on port 4416 ==="
cd $HOME/bgutil/server
node build/main.js &
POT_PID=$!
echo "PO Token Server started (PID: $POT_PID)"

# Wait a moment for the server to be ready
sleep 3

# Verify it's running
if kill -0 $POT_PID 2>/dev/null; then
    echo "✅ PO Token Server is running on http://127.0.0.1:4416"
else
    echo "⚠️ PO Token Server failed to start — YouTube downloads may fail"
fi

# Return to the backend directory and start the Python app
cd $HOME/src/Backend
echo "=== Starting Python Backend ==="
exec python main.py
