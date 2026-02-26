#!/bin/bash
# Render Start Script
# Starts the PO Token server in the background, then the Python backend

echo "=== Starting PO Token Server on localhost:4416 ==="
cd yt-pot-server/server
node build/main.js --address 127.0.0.1 &
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

# Return to root and start the Python app
cd ../..
echo "=== Starting Python Backend ==="
exec python main.py
