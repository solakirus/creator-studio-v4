#!/usr/bin/env bash
# Creator Studio v4 for Linux (Mint/Ubuntu): builds dist/CreatorStudio4-<version>.deb
# and an AppImage from this folder. Needs Node.js (sudo apt install nodejs npm,
# or nodejs.org). Then:  sudo apt install ./dist/CreatorStudio4-*.deb
set -e
cd "$(dirname "$0")"
npm install --no-audit --no-fund
npm run dist:linux
echo
echo "Done. Install it with:  sudo apt install ./dist/$(ls dist | grep -m1 '\.deb$')"
