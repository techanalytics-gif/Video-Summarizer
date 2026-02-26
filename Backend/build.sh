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
    echo "yt-pot-server already exists, updating..."
    cd ./yt-pot-server/server
    git pull origin 1.2.2 || true
else
    echo "Cloning bgutil into project directory..."
    git clone --single-branch --branch 1.2.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git ./yt-pot-server
    cd ./yt-pot-server/server
fi

echo "Installing bgutil Node dependencies..."
npm install
echo "Building bgutil..."
npm run build || echo "Build failed, might already be built or not needed"
cd ../..

echo "=== Fixing line endings for cookies.txt ==="
sed -i 's/\r$//' utils/cookies.txt || echo "sed failed, continuing..."

echo "=== Build complete ==="
