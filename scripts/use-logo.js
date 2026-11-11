/* Puts one of the logos in branding/ into the app: Android launcher icons and
   splash screens, the Windows icon, and the iPad/web icons.

     node scripts/use-logo.js clapbolt      (the default)
     node scripts/use-logo.js rec4
     node scripts/use-logo.js viewfinder

   Then run build.bat as usual. Only copies files — nothing to install. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const pick = (process.argv[2] || 'clapbolt').toLowerCase();
const sets = fs.readdirSync(path.join(ROOT, 'branding')).filter(d => d.startsWith('icons-'));
const set = sets.find(d => d.includes(pick));
if(!set){ console.error(`No logo called "${pick}". Choose one of: ${sets.map(s => s.replace(/^icons-[a-z]-/, '')).join(', ')}`); process.exit(1); }
const from = path.join(ROOT, 'branding', set);
const copy = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); n++; };
let n = 0;

for(const f of ['icon-192.png', 'icon-512.png', 'icon-maskable.png', 'apple-touch-icon.png'])
  copy(path.join(from, f), path.join(ROOT, 'app', 'icons', f));
copy(path.join(from, 'icon.png'), path.join(ROOT, 'build', 'icon.png'));
copy(path.join(from, 'icon.ico'), path.join(ROOT, 'build', 'icon.ico'));

const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const andr = path.join(from, 'android');
if(fs.existsSync(RES)){
  for(const d of fs.readdirSync(andr)) for(const f of fs.readdirSync(path.join(andr, d)))
    copy(path.join(andr, d, f), path.join(RES, d, f));
  /* the adaptive icon's back layer: the logo's own near-black, not white */
  const bg = path.join(RES, 'values', 'ic_launcher_background.xml');
  if(fs.existsSync(bg)) fs.writeFileSync(bg, fs.readFileSync(bg, 'utf8').replace(/#[0-9A-Fa-f]{6,8}/, '#151515'));
}
console.log(`Logo "${set.replace(/^icons-[a-z]-/, '')}" is in: ${n} files. Run build.bat to see it on the phone and laptop.`);
