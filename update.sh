#!/usr/bin/env bash
# Creator Studio v4 — one command for every update (the Linux twin of update.bat).
#
#   ./update.sh                    the newest cs4-update-*.zip in ~/Downloads not
#                                  used yet, else whatever is new on GitHub
#   ./update.sh path/to/update.zip that zip
#
# Sends it to GitHub (phone, laptop and nastime pick it up from there), copies it
# to nastime straight away if this computer can reach it, and rebuilds +
# reinstalls the Linux app ONLY when the update changed the app itself
# (electron/, android/, package.json). Most updates don't — every device
# downloads them on its own and offers "Restart now".
set -u
cd "$(dirname "$0")"

echo
echo " ===== Creator Studio v4 - update ====="
echo

command -v git >/dev/null || { echo " Git is not installed:  sudo apt install git"; exit 1; }
command -v node >/dev/null || { echo " Node.js is not installed:  sudo apt install nodejs npm"; exit 1; }
command -v unzip >/dev/null || { echo " unzip is not installed:  sudo apt install unzip"; exit 1; }

if [ ! -d .git ]; then
  echo " First run: starting this folder's history..."
  git init -q -b main && git add -A && git -c user.name="Kris Catten" -c user.email="solakirus@gmail.com" commit -q -m "Creator Studio v4"
fi
git config user.name >/dev/null || git config user.name "Kris Catten"
git config user.email >/dev/null || git config user.email "solakirus@gmail.com"
git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/solakirus/creator-studio-v4.git

# anything changed by hand here is kept as its own step first
git add -A && { git diff --cached --quiet || git commit -q -m "Changes made on this computer"; }
OLD="$(git rev-parse HEAD)"

# --- 1. the update: first whatever is new on GitHub (what Claude pushed), then a zip
if git ls-remote --exit-code origin main >/dev/null 2>&1; then
  if git pull -q --ff-only origin main 2>/dev/null; then
    [ "$(git rev-parse HEAD)" != "$OLD" ] && echo " Got what was new on GitHub."
  else
    echo
    echo " GitHub has changes this folder can't simply add on top of."
    echo " Nothing was changed. Paste this window to Claude."
    exit 1
  fi
else
  echo " GitHub isn't set up yet (or no internet) - see PUT IT ON GITHUB.txt. Carrying on."
fi

ZIP="${1:-}"
if [ -z "$ZIP" ]; then
  for f in $(ls -t "$HOME"/Downloads/cs4-update-*.zip 2>/dev/null); do
    grep -qxF "$(basename "$f")" .applied-updates.txt 2>/dev/null || { ZIP="$f"; break; }
  done
fi
if [ -n "$ZIP" ]; then
  echo " Using $(basename "$ZIP")"
  unzip -oq "$ZIP" -d . || { echo " Could not open the zip."; exit 1; }
  basename "$ZIP" >> .applied-updates.txt
  chmod +x ./*.sh 2>/dev/null
  git add -A
  if git diff --cached --quiet; then echo " That zip had nothing new."; else git commit -q -m "Update: $(basename "$ZIP")"; fi
fi

NEW="$(git rev-parse HEAD)"
[ "$OLD" = "$NEW" ] && { echo; echo " Already up to date - nothing new to send."; }
SHELLCHANGE="$(git diff --name-only "$OLD" "$NEW" -- electron android native package.json)"

# --- 2. out to GitHub and nastime
echo
echo " Sending to GitHub..."
if git rev-parse -q --verify origin/main >/dev/null && [ -z "$(git log origin/main..HEAD --oneline)" ]; then
  echo " GitHub already has it."
elif git push -q -u origin main 2>/dev/null; then
  echo " GitHub has it. Phone, laptop and nastime update from there in a few minutes."
else
  echo " Could not send to GitHub - not set up yet, or no internet. Carrying on;"
  echo " run this again later and it sends it then."
fi
echo
echo " Copying to nastime..."
./publish-nas.sh --quiet

# --- 3. only when the app itself changed
if [ -n "$SHELLCHANGE" ]; then
  echo
  echo " This update changes the app itself, so the Linux app is being rebuilt."
  npm install --no-audit --no-fund && npm run dist:linux || { echo " The build failed - paste this window to Claude."; exit 1; }
  DEB="$(ls -t dist/*.deb | head -n1)"
  echo " Installing $DEB (asks for your password)..."
  sudo apt install -y "./$DEB"
else
  echo
  echo " Nothing to install. Every device downloads this on its own within 30"
  echo " minutes and offers Restart now - or Settings > App updates > Check now."
fi
echo
