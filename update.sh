#!/usr/bin/env bash
# Publish to GitHub — the Linux twin of update.bat.
#
#   ./update.sh                 asks what changed
#   ./update.sh "what changed"  says it up front
#
# Commits everything in this folder and pushes it. GitHub Pages rebuilds the
# web app, and the iPad picks it up next time it has signal. It does NOT build
# the phone APK or the Windows app.
set -u
cd "$(dirname "$0")"

echo
echo " ===== Publish to GitHub ====="
echo

command -v git >/dev/null || { echo " Git is not installed:  sudo apt install git"; exit 1; }
[ -d .git ] || { echo " This folder is not a git repository. Extract the zip OVER your"
                 echo " existing creator-studio-3 folder so its .git folder is kept."; exit 1; }

# a zip extracted over the folder can take the remote with it — put it back
git remote get-url origin >/dev/null 2>&1 || {
  echo " Setting the GitHub address, which this folder had lost..."
  git remote add origin https://github.com/solakirus/creator-studio-3.git
}

if [ -z "$(git status --porcelain)" ]; then
  echo " Nothing has changed since the last publish."
  read -r -p " Push anyway, in case the last one did not finish? [y/N] " a
  [[ "$a" =~ ^[Yy] ]] || exit 0
else
  echo " $(git status --porcelain | wc -l) file(s) changed."
  msg="${1:-}"
  [ -n "$msg" ] || read -r -p " What changed? (Enter for 'Update') " msg
  git add -A && git commit -q -m "${msg:-Update}" || { echo " Commit failed — scroll up."; exit 1; }
fi

echo
echo " Sending to GitHub..."
if ! git push -u origin main; then
  echo
  echo " Push failed. If it says the remote has work you do not have, something"
  echo " changed on GitHub that this computer has not seen. Do NOT force past it —"
  echo " paste the message to Claude."
  exit 1
fi

echo
echo " Done. GitHub is building it now — about a minute."
echo "   Watch it:  https://github.com/solakirus/creator-studio-3/actions"
echo "   The app:   https://solakirus.github.io/creator-studio-3/"
echo
