/* Builds Creator Studio 3's Android project from Creator Studio v2's, without
   touching v2.

   v2's android\ folder holds native work that isn't anywhere else: the live
   notification plugin, share-in, widgets, shortcuts, icons. Rather than
   rebuild that, this copies it once and gives the copy a new identity, so it
   installs beside v2 as a separate app.

   What changes in the copy (v2's folder is only read):
     applicationId        com.creatorstudio.v2  -> com.solakirus.creatorstudio3
     app name             Creator Studio        -> Creator Studio 3
     link scheme          com.creatorstudio.v2  -> cs3
     file provider        hard-coded authority  -> ${applicationId}.fileprovider
     widgets, shortcuts   re-copied from native\ with the new links

   The Java package (com.creatorstudio.v2 in the source folders) is left as is.
   Android tells apps apart by applicationId, not by Java package, and renaming
   the package means moving every source file — risk for no gain.

   Usage:
     node scripts/android-setup.js [path\to\creator-studio-v2]   first time
     node scripts/android-setup.js --patch-only                   after every cap sync
   Safe to run again and again. */
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const ANDROID = path.join(ROOT, 'android');
const NATIVE = path.join(ROOT, 'native');
const OLD_ID = 'com.creatorstudio.v2';
const NEW_ID = 'com.solakirus.creatorstudio3';
const SCHEME = 'cs3';
const LABEL = 'Creator Studio 3';

const args = process.argv.slice(2);
const patchOnly = args.includes('--patch-only');
const V2 = args.find(a => !a.startsWith('--')) || 'C:\\Users\\Khale\\Projects\\creator-studio-v2';

const log = m => console.log('[android] ' + m);
const fail = m => { console.error('[android] ' + m); process.exit(1); };
const read = f => fs.readFileSync(f, 'utf8');
const write = (f, s) => fs.writeFileSync(f, s);

/* ---------------------------------------------------------- 1. copy v2's project */

const SKIP_DIRS = new Set(['build', '.gradle', '.idea', '.cxx']);
function copyTree(from, to){
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (a.endsWith(path.join('assets', 'public'))) continue;     /* web files come from www/ */
    if (e.isDirectory()) copyTree(a, b); else fs.copyFileSync(a, b);
  }
}

/* v2's Capacitor plugins have to be in this package.json too, or cap sync
   quietly drops them from the Android build. Its @capacitor versions win, so
   the copied project and the plugins agree. */
function mergePackages(){
  const theirs = path.join(V2, 'package.json');
  if (!fs.existsSync(theirs)) { log('No package.json in v2 — keeping this one as is.'); return; }
  const v2 = JSON.parse(read(theirs));
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(read(pkgPath));
  const added = [];
  for (const field of ['dependencies', 'devDependencies']) {
    for (const [name, ver] of Object.entries(v2[field] || {})) {
      if (/^(electron|electron-builder)$/.test(name)) continue;
      const mine = (pkg.dependencies || {})[name] || (pkg.devDependencies || {})[name];
      if (mine && !name.startsWith('@capacitor/')) continue;
      const into = (pkg.devDependencies || {})[name] ? 'devDependencies' : field;
      pkg[into] = pkg[into] || {};
      if (pkg[into][name] !== ver) { pkg[into][name] = ver; added.push(`${name}@${ver}`); }
    }
  }
  /* Capacitor plugins must share the core's major version. Ones v2 never had
     (filesystem, share, local-notifications) are pinned to v2's major. */
  const core = (v2.dependencies || {})['@capacitor/core'] || '';
  const major = (core.match(/(\d+)/) || [])[1];
  if (major) {
    for (const field of ['dependencies', 'devDependencies']) {
      for (const name of Object.keys(pkg[field] || {})) {
        if (!name.startsWith('@capacitor/')) continue;
        const v = pkg[field][name];
        if ((v.match(/(\d+)/) || [])[1] !== major) { pkg[field][name] = `^${major}.0.0`; added.push(`${name}@^${major}.0.0`); }
      }
    }
  }
  write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  log(added.length ? 'Took from v2: ' + added.join(', ') : 'package.json already matches v2');
}

if (!patchOnly && !fs.existsSync(ANDROID)) {
  const src = path.join(V2, 'android');
  if (!fs.existsSync(src)) fail(`Could not find ${src}. Pass the v2 folder: node scripts/android-setup.js "C:\\path\\to\\creator-studio-v2"`);
  log(`Copying ${src} (v2 is only read, never changed)`);
  copyTree(src, ANDROID);
  mergePackages();
} else if (!patchOnly) {
  log('android\\ already exists — not copying again, just checking the identity.');
  mergePackages();
}

if (!fs.existsSync(ANDROID)) fail('No android\\ folder yet. Run: node scripts/android-setup.js "C:\\path\\to\\creator-studio-v2"');

/* ---------------------------------------------------------- 2. new identity */

const MAIN = path.join(ANDROID, 'app', 'src', 'main');

/* applicationId — this is what makes it a separate app */
const gradle = path.join(ANDROID, 'app', 'build.gradle');
if (fs.existsSync(gradle)) {
  let g = read(gradle);
  const before = g;
  g = g.replace(/applicationId\s+["'][^"']+["']/, `applicationId "${NEW_ID}"`);
  if (g !== before) { write(gradle, g); log(`applicationId -> ${NEW_ID}`); }
  if (!g.includes(`applicationId "${NEW_ID}"`)) fail('Could not set applicationId in android\\app\\build.gradle');

  /* A fresh versionCode on every build (minutes since 2024). Capacitor uses it
     to tell that a new APK was installed and, when it was, drops any web
     update it downloaded so the new APK's own files run. With the same number
     every build, a reinstalled APK could sit behind an older download. */
  const code = Math.floor((Date.now() - Date.UTC(2024, 0, 1)) / 60000);
  const g2 = g.replace(/versionCode\s+\d+/, `versionCode ${code}`);
  if (g2 !== g) { write(gradle, g2); g = g2; log(`versionCode -> ${code}`); }
}

/* name, package name, link scheme */
const strings = path.join(MAIN, 'res', 'values', 'strings.xml');
if (fs.existsSync(strings)) {
  let s = read(strings);
  const set = (key, val) => {
    const re = new RegExp(`(<string name="${key}">)[^<]*(</string>)`);
    if (re.test(s)) s = s.replace(re, `$1${val}$2`);
  };
  set('app_name', LABEL);
  set('title_activity_main', LABEL);
  set('package_name', NEW_ID);
  set('custom_url_scheme', SCHEME);
  write(strings, s);
  log(`strings.xml: "${LABEL}", scheme ${SCHEME}://`);
}

/* Manifest: a hard-coded provider authority would collide with v2 and Android
   would refuse to install the second app. */
const manifest = path.join(MAIN, 'AndroidManifest.xml');
if (fs.existsSync(manifest)) {
  let m = read(manifest);
  const before = m;
  m = m.replace(new RegExp(`android:authorities="${OLD_ID.replace(/\./g, '\\.')}`, 'g'), 'android:authorities="${applicationId}');
  m = m.replace(new RegExp(`android:scheme="${OLD_ID.replace(/\./g, '\\.')}"`, 'g'), `android:scheme="${SCHEME}"`);
  if (m !== before) { write(manifest, m); log('AndroidManifest.xml: provider authority and scheme updated'); }
}

/* Where MainActivity lives — the widget classes go beside it */
const findFile = (dir, name) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? findFile(path.join(dir, e.name), name) : e.name === name ? [path.join(dir, e.name)] : []);
const [activity] = findFile(path.join(MAIN, 'java'), 'MainActivity.java');
if (!activity) fail('MainActivity.java not found under android\\app\\src\\main\\java');
const javaDir = path.dirname(activity);

/* Widgets and shortcuts: copy the cs3 versions from native\ over v2's */
const RES = {
  'cs_widget.xml': 'layout', 'cs_widget_small.xml': 'layout', 'cs_widget_shoot.xml': 'layout',
  'cs_widget_bg.xml': 'drawable',
  'cs_widget_info.xml': 'xml', 'cs_widget_small_info.xml': 'xml', 'cs_widget_shoot_info.xml': 'xml',
  'shortcuts.xml': 'xml'
};
let copied = 0;
for (const f of fs.readdirSync(NATIVE)) {
  const from = path.join(NATIVE, f);
  if (f.endsWith('.java')) { fs.copyFileSync(from, path.join(javaDir, f)); copied++; }
  else if (RES[f]) {
    const dir = path.join(MAIN, 'res', RES[f]);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(from, path.join(dir, f)); copied++;
  }
}
log(`${copied} widget and shortcut files copied from native\\`);

/* Any other Java that builds a v2 link (the live-notification plugin may) */
for (const f of walk(path.join(MAIN, 'java'))) {
  if (!f.endsWith('.java')) continue;
  const j = read(f);
  const k = j.split(`"${OLD_ID}://`).join(`"${SCHEME}://`);
  if (k !== j) { write(f, k); log(`${path.basename(f)}: links now ${SCHEME}://`); }
}
function walk(dir){
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

/* ---------------------------------------------------------- 3. check */

const leftovers = [];
for (const f of walk(MAIN)) {
  if (!/\.(xml|java|json|gradle)$/.test(f)) continue;
  read(f).split(/\r?\n/).forEach((line, i) => {
    if (!line.includes(OLD_ID)) return;
    if (/^\s*(package|import)\s/.test(line)) return;                 /* Java package: kept on purpose */
    if (/targetClass="com\.creatorstudio\.v2\./.test(line)) return;  /* points at the Java class: correct */
    if (/namespace/.test(line)) return;
    leftovers.push(`${path.relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
  });
}
if (fs.existsSync(gradle)) {
  read(gradle).split(/\r?\n/).forEach((line, i) => {
    if (line.includes(OLD_ID) && !/namespace/.test(line)) leftovers.push(`android/app/build.gradle:${i + 1}: ${line.trim()}`);
  });
}
if (leftovers.length) {
  log('Still mentions the old app id — check these:');
  leftovers.forEach(l => console.log('    ' + l));
} else {
  log(`Ready: installs as "${LABEL}" (${NEW_ID}) beside v2.`);
}
