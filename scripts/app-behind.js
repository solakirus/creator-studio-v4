/* Is the installed laptop app behind this folder?

   update.bat / update.sh used to decide that from .built-from alone ("I built
   this version"). That note can be right while the installed app is still old:
   the installer was cancelled, put it somewhere else, or the copy you open is a
   different one. So the app now writes what it really is on every start
   (installed.json in its settings folder: grabber build and where it ran from),
   and this compares that with the grabber in this folder.

     node scripts/app-behind.js     prints why and exits 0 when it's behind,
                                    exits 1 when the installed app is current.
     node scripts/app-behind.js --installed
                                    update.bat/.sh just installed this build.

   No installed.json means an app from before this check (so: behind) — unless
   update.bat just installed this build and the app hasn't been opened since
   (.install-pending), which isn't a reason to build it a second time. */
const fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(__dirname, '..');

const src = fs.readFileSync(path.join(root, 'electron', 'grab-builtin.js'), 'utf8');
const want = (src.match(/const BUILD = '([^']+)'/) || [])[1] || '';

const NAME = 'Creator Studio v4';
const dataDir = process.platform === 'win32'
  ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), NAME)
  : process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', NAME)
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), NAME);

if (process.argv.includes('--installed')) { if (want) fs.writeFileSync(path.join(root, '.install-pending'), want + '\n'); process.exit(0); }

let have = null;
try { have = JSON.parse(fs.readFileSync(path.join(dataDir, 'installed.json'), 'utf8')); } catch (e) {}
let pending = '';
try { pending = fs.readFileSync(path.join(root, '.install-pending'), 'utf8').trim(); } catch (e) {}

const behind = (msg) => { console.log(' ' + msg); process.exit(0); };
if (!want) process.exit(1);
if (have && String(have.build || '') >= want) process.exit(1);
if (have) behind(`The installed app's grabber is from ${have.build || 'before Nov 20'}; this folder has ${want}` +
  (have.exe ? `.\n It last ran from: ${have.exe}` : '.'));
if (pending === want) process.exit(1);
behind(`The installed app is from before Nov 20 (it doesn't say which version it is); this folder has ${want}.`);
