#!/usr/bin/env bash
# Creator Studio v4 for Linux (Mint/Ubuntu): builds dist/CreatorStudio4-<version>.deb
# and an AppImage from this folder. Needs Node.js (sudo apt install nodejs npm,
# or nodejs.org). Then:  sudo apt install ./dist/CreatorStudio4-*.deb
set -e
cd "$(dirname "$0")"
npm install --no-audit --no-fund
npm run dist:linux
echo
DEB="$(ls dist | grep -m1 '\.deb$')"
echo "Built dist/$DEB"
echo
# install it straight away (asks for your password)
read -r -p "Install it on this computer now? [Y/n] " a
if [[ ! "$a" =~ ^[Nn] ]]; then sudo apt install -y "./dist/$DEB"; fi
echo
# and the copy on nastime that the iPad and browsers open
read -r -p "Update the web app on nastime too? [Y/n] " a
if [[ ! "$a" =~ ^[Nn] ]]; then ./publish-nas.sh; fi
