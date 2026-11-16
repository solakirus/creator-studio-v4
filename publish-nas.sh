#!/usr/bin/env bash
# Creator Studio v4 — publish the web app to nastime (the Linux twin of
# publish-nas.bat).
#
#   ./publish-nas.sh
#
# Builds the web app and copies it to the NAS, where the iPad and any browser
# open it (http://192.168.4.23:8795, or your Tailscale https address). The
# phone and desktop apps are not changed — build-linux.sh / build.bat do those.
#
# Where it copies to is asked once and kept in nas-target.txt. Either:
#   a mounted share   e.g. the folder Files shows after opening
#                     smb://nastime.local/creator-studio-v4 (or its IP)
#   or SSH            e.g.  kris@nastime.local:/DATA/AppData/Projects/creator-studio-v4
# When nastime's IP changed, it tries nastime.local and nastime by itself.
set -u
cd "$(dirname "$0")"
QUIET=0; [ "${1:-}" = "--quiet" ] && QUIET=1   # from update.sh: no questions

echo
echo " ===== Creator Studio v4 on nastime ====="
echo

command -v node >/dev/null || { echo " Node.js is not installed:  sudo apt install nodejs npm"; exit 1; }

DEST=""
[ -f nas-target.txt ] && DEST="$(tr -d '\r' < nas-target.txt | head -n1)"
# a Windows path from publish-nas.bat is no use here
case "$DEST" in \\\\*|[A-Za-z]:\\*) DEST="";; esac
if [ -z "$DEST" ] && [ "$QUIET" = 1 ]; then
  echo " nastime: not set up on this computer yet - run ./publish-nas.sh once."; exit 0
fi
if [ -z "$DEST" ]; then
  echo " Where is the creator-studio-v4 folder on the NAS?"
  echo
  echo "  - A share mounted in Files (Files > Other Locations > Connect to Server:"
  echo "    smb://192.168.4.23/creator-studio-v4), then paste the folder path."
  echo "    Files mounts it under /run/user/$(id -u)/gvfs/ - drag the folder into"
  echo "    this terminal to paste its path."
  echo "  - Or over SSH:  you@192.168.4.23:/DATA/AppData/Projects/creator-studio-v4"
  echo
  read -r -p " Folder: " DEST
fi
DEST="${DEST%/}"
DEST="${DEST#\'}"; DEST="${DEST%\'}"
[ -n "$DEST" ] || exit 1

SSH=0
case "$DEST" in *@*:*|*:/*) [ -d "$DEST" ] || SSH=1;; esac

# nastime moved to a new IP? Try the same folder by its name (nastime.local,
# nastime). A share from Files: mount it again (it unmounts after a restart).
gvfs_mount() {   # path under gvfs/smb-share:server=H,share=S → gio mount smb://H/S
  local sv sh
  sv="$(printf '%s' "$1" | sed -n 's#.*smb-share:server=\([^,]*\),share=\([^/]*\).*#\1#p')"
  sh="$(printf '%s' "$1" | sed -n 's#.*smb-share:server=\([^,]*\),share=\([^/]*\).*#\2#p')"
  [ -n "$sv" ] && [ -n "$sh" ] && command -v gio >/dev/null && gio mount "smb://$sv/$sh" </dev/null >/dev/null 2>&1
}
if [ "$SSH" = 0 ] && [ ! -d "$DEST" ]; then
  gvfs_mount "$DEST"
  if [ ! -d "$DEST" ]; then
    OLDH="$(printf '%s' "$DEST" | sed -n 's#.*smb-share:server=\([^,]*\),.*#\1#p')"
    for h in nastime.local nastime; do
      [ -n "$OLDH" ] || break
      TRY="${DEST/server=$OLDH,/server=$h,}"
      gvfs_mount "$TRY"
      if [ -d "$TRY" ]; then echo " $OLDH didn't answer - found the share at $h and switched to that."; DEST="$TRY"; break; fi
    done
  fi
fi
if [ "$SSH" = 1 ]; then
  SSHH="${DEST%%:*}"
  if ! ssh -o BatchMode=yes -o ConnectTimeout=4 "$SSHH" true 2>/dev/null; then
    U=""; case "$SSHH" in *@*) U="${SSHH%%@*}@";; esac
    for h in nastime.local nastime; do
      if ssh -o BatchMode=yes -o ConnectTimeout=4 "$U$h" true 2>/dev/null; then
        echo " ${SSHH#*@} didn't answer - found nastime at $h and switched to that."; DEST="$U$h:${DEST#*:}"; break
      fi
    done
  fi
fi

if [ "$SSH" = 0 ] && [ ! -d "$DEST" ]; then
  echo
  echo " Can't reach $DEST"
  echo " Open the share in Files first (it unmounts after a restart), or check"
  echo " this computer is on the home network. To pick another folder, delete"
  echo " nas-target.txt and run this again."
  exit 1
fi
printf '%s\n' "$DEST" > nas-target.txt

echo " Building the web app..."
node scripts/copy-web.js || { echo " The build failed — scroll up."; exit 1; }

echo
echo " Copying to $DEST/www ..."
if [ "$SSH" = 1 ]; then
  command -v rsync >/dev/null || { echo " Needs rsync:  sudo apt install rsync  (and rsync on the NAS)"; exit 1; }
  rsync -rz --delete --checksum www/ "$DEST/www/" && rsync -z nas/Caddyfile nas/mirror.js nas/helper.js electron/libscan.js "$DEST/" \
    || { echo " Copy failed — check the SSH login and the path."; exit 1; }
elif command -v rsync >/dev/null; then
  # a Samba share can refuse file times, so compare by content, not time
  rsync -r --delete --checksum --no-times --no-perms --no-owner --no-group www/ "$DEST/www/" \
    && cp -f nas/Caddyfile nas/mirror.js nas/helper.js electron/libscan.js "$DEST/" || { echo " Copy failed — scroll up."; exit 1; }
else
  mkdir -p "$DEST/www" && rm -rf "$DEST/www/"* && cp -r www/. "$DEST/www/" \
    && cp -f nas/Caddyfile nas/mirror.js nas/helper.js electron/libscan.js "$DEST/" || { echo " Copy failed — scroll up."; exit 1; }
fi

echo
echo " Done. Open Creator Studio from the NAS (iPad or browser) — it picks up the"
echo " new version on its own the next time it opens. If the Caddyfile changed,"
echo " restart the creator-studio-v4 app in CasaOS once."
