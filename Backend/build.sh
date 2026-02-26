#!/bin/bash
# Render Build Script
# Installs Python deps + PO Token server for YouTube downloads

set -e

echo "=== Installing Python dependencies ==="
pip install -r requirements.txt

echo "=== Installing Playwright browsers (optional) ==="
playwright install chromium || echo "Playwright browser install failed, continuing..."

echo "=== Setting up PO Token Server (bgutil) ==="
if [ -d "$HOME/bgutil" ]; then
    echo "bgutil already exists, updating..."
    cd $HOME/bgutil/server
    git pull origin 1.2.2 || true
else
    echo "Cloning bgutil..."
    git clone --single-branch --branch 1.2.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git $HOME/bgutil
    cd $HOME/bgutil/server
fi

echo "Installing bgutil Node dependencies..."
npm ci
npx tsc

echo "=== Build complete ==="
