// Copies the web app (app/) into www/, which is what Capacitor and Electron load.
// tests/ stays behind. Edit files in app/ only; www/ is rebuilt every time.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'app'), dst = path.join(root, 'www');
const SKIP = new Set(['tests', 'build-preview.sh', 'update.json']);   /* same as what Pages publishes */
fs.rmSync(dst, { recursive: true, force: true });
let n = 0;
(function copy(from, to){
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (from === src && SKIP.has(e.name)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copy(a, b); else { fs.copyFileSync(a, b); n++; }
  }
})(src, dst);
console.log(`[web] app/ -> www/ (${n} files)`);

/* Stamp the service worker and write update.json exactly as the Pages build
   does, so the copy inside the APK / Windows app knows which build it is and
   an update downloads only the files that really changed. */
require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'build-sw.js'), dst], { stdio: 'inherit' });
