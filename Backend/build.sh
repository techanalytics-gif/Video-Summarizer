#!/bin/bash
# Render Build Script
# Installs Python deps + PO Token server for YouTube downloads

set -e

echo "=== Installing Python dependencies ==="
pip install -r requirements.txt

echo "=== Installing Playwright browsers ==="
playwright install chromium
playwright install-deps chromium

echo "=== Setting up PO Token Server (bgutil) ==="
if [ -d "/opt/render/project/bgutil" ]; then
    echo "bgutil already exists, updating..."
    cd /opt/render/project/bgutil/server
    git pull origin 1.2.2 || true
else
    echo "Cloning bgutil..."
    git clone --single-branch --branch 1.2.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/render/project/bgutil
    cd /opt/render/project/bgutil/server
fi

echo "Installing bgutil Node dependencies..."
npm ci
npx tsc

echo "=== Build complete ==="
