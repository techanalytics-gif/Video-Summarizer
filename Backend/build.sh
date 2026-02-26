#!/bin/bash
# Render Build Script
# Installs Python deps + PO Token server for YouTube downloads

set -e

echo "=== Installing Python dependencies ==="
pip install -r requirements.txt

echo "=== Installing Playwright browsers (optional) ==="
playwright install chromium || echo "Playwright browser install failed, continuing..."

echo "=== Setting up PO Token Server (bgutil) ==="
if [ -d "./yt-pot-server" ]; then
    echo "yt-pot-server already exists."
else
    echo "Cloning bgutil into project directory..."
    git clone --single-branch --branch 1.2.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git ./yt-pot-server
fi
cd ./yt-pot-server/server

echo "Installing bgutil Node dependencies..."
npm install
echo "Building bgutil (npx tsc)..."
npx tsc || echo "TSC failed, checking if build/main.js already exists..."

if [ -f "build/main.js" ]; then
    echo "✅ build/main.js created successfully"
else
    echo "❌ build/main.js NOT found! Building might have failed."
fi
cd ../..

echo "=== Fixing line endings for cookies.txt ==="
sed -i 's/\r$//' utils/cookies.txt || echo "sed failed, continuing..."

echo "=== Build complete ==="
