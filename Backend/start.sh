#!/bin/bash
# Render Start Script
# Starts the PO Token server in the background, then the Python backend

echo "=== Starting PO Token Server on port 4416 ==="
if [ -d "yt-pot-server/server" ]; then
    cd yt-pot-server/server
    echo "Current dir: $(pwd)"
    if [ -f "build/main.js" ]; then
        echo "✅ Found build/main.js, starting server..."
        # We explicitly set PORT=4416 so it doesn't steal the main Render port
        PORT=4416 HOST=127.0.0.1 node build/main.js &
        POT_PID=$!
        echo "PO Token Server started (PID: $POT_PID) on port 4416"
    else
        echo "❌ build/main.js NOT FOUND! Check build logs."
        ls -R
    fi
else
    echo "❌ yt-pot-server/server directory NOT FOUND!"
fi

# Wait for the server to be ready with a robust retry loop
echo "Waiting for PO Token Server to initialize (max 40s)..."
MAX_RETRIES=20
COUNT=0
READY=false

while [ $COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:4416/ping > /dev/null; then
        echo "✅ PO Token Server is ready and responding on http://localhost:4416"
        READY=true
        break
    fi
    COUNT=$((COUNT+1))
    echo "Still waiting ($COUNT/$MAX_RETRIES)..."
    sleep 2
done

if [ "$READY" = false ]; then
    echo "⚠️ PO Token Server health check timed out. Checking PID $POT_PID..."
    ping_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4416/ping || echo "000")
    echo "Last ping status: $ping_status"
    if kill -0 $POT_PID 2>/dev/null; then
        echo "Server process still exists, continuing anyway..."
    else
        echo "❌ Server process died!"
    fi
fi

# Return to root and start the Python app
cd ../..
echo "=== Starting Python Backend ==="
exec python main.py
