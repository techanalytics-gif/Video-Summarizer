#!/bin/bash
# Render Build Script
# Installs Python deps + cleans cookies for YouTube downloads

set -e

echo "=== Installing Python dependencies ==="
pip install -r requirements.txt

echo "=== Installing Playwright browsers (optional) ==="
playwright install chromium || echo "Playwright browser install failed, continuing..."

echo "=== Fixing line endings for cookies.txt ==="
if [ -f "utils/cookies.txt" ]; then
    sed -i 's/\r$//' utils/cookies.txt || echo "sed failed, continuing..."
fi

echo "=== Build complete ==="
