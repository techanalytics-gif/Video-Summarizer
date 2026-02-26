#!/bin/bash
# Render Start Script
# Starts the PO Token server in the background, then the Python backend

echo "=== Starting PO Token Server on port 4416 ==="
if [ -d "yt-pot-server/server" ]; then
    cd yt-pot-server/server
    echo "Current dir: $(pwd)"
    if [ -f "build/main.js" ]; then
        echo "✅ Found build/main.js, starting server..."
        HOST=127.0.0.1 node build/main.js &
        POT_PID=$!
        echo "PO Token Server started (PID: $POT_PID)"
    else
        echo "❌ build/main.js NOT FOUND in $(pwd)"
        echo "Dir content:"
        ls -R
    fi
else
    echo "❌ yt-pot-server/server directory NOT FOUND!"
fi

# Wait a moment for the server to be ready
sleep 5

# Verify it's answering
if curl -s http://127.0.0.1:4416/ping > /dev/null; then
    echo "✅ PO Token Server is responding on http://127.0.0.1:4416"
else
    echo "⚠️ PO Token Server not answering yet — check if it crashed"
    # Try one more check
    sleep 5
    curl -v http://127.0.0.1:4416/ping || echo "❌ Server health check failed"
fi

# Return to root and start the Python app
cd ../..
echo "=== Starting Python Backend ==="
exec python main.py
