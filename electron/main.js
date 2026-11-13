/* Creator Studio v4 — Windows shell.

   Runs the same www/ the Android app runs. The web layer was written against
   Capacitor, so preload.js hands it a small Capacitor-shaped bridge and this
   file does the native half: HTTP without cross-site limits, saving files,
   reminders, and cs4:// deep links. Anything the bridge doesn't offer
   (widgets, live notification, share-in, GPS) is simply absent, and the web
   code already treats an absent plugin as "not on this device". */
const { app, BrowserWindow, protocol, net, shell, Menu, ipcMain, dialog,
        Notification, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

const SCHEME = 'cs4';                  /* deep links: cs4://go/today */
const NAME = 'Creator Studio v4';

/* The page is served from app://cs3/ rather than file://, so IndexedDB,
   fetch and clipboard behave like a real site and the origin never changes
   when the install folder does. */
protocol.registerSchemesAsPrivileged([{ scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  /* Library: GIFs, clips and stills that live in folders on this computer
     (Shot Library and any folder you add). Only files under those folders are
     served — see library.js. */
  { scheme: 'cs3lib',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

/* --screenshot <file.png> [--view library|templates]: open without taking
   focus, draw, save a picture of the window and quit. It runs on a profile of
   its own so it never touches your real data or registers anything. */
const argAfter = flag => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
const SHOT = argAfter('--screenshot');
const SHOT_VIEW = argAfter('--view');
if (SHOT) app.setPath('userData', path.join(app.getPath('temp'), 'creator-studio-v4-screenshot'));

if (!app.requestSingleInstanceLock()) { app.quit(); }

/* Register cs4:// with Windows. In development the exe is electron.exe, so it
   needs the script path passed along. */
if (SHOT) {
  /* a picture for a check: register nothing */
} else if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(SCHEME);
}

const linkIn = argv => (argv || []).find(a => typeof a === 'string' && a.startsWith(SCHEME + '://')) || null;
let launchUrl = linkIn(process.argv);
let win = null;
/* v4: the Planner — the same app showing only planning (week board, months,
   episodes, series, clips, templates, Library) and a Send to phone button.
   `--planner` opens it (the "Creator Studio Planner" shortcuts); started while
   the app is open, it opens as a second window on the same data. */
const PLANNER_NAME = 'Creator Studio Planner';
const wantsPlanner = argv => (argv || []).includes('--planner');
const plannerWins = new Set();

function open(planner){
  const w = new BrowserWindow({
    width: 1440, height: 900, minWidth: 380, minHeight: 600,
    backgroundColor: '#151515', title: planner ? PLANNER_NAME : NAME, autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    /* a screenshot run never shows the window, so it can't take focus */
    show: !SHOT,
    webPreferences: {
      contextIsolation: true, sandbox: true, spellcheck: true,
      backgroundThrottling: !SHOT,
      /* Sync talks to nastime at a plain http:// address on the home network.
         The app itself is served from a secure scheme, so without this the
         request is blocked as mixed content. Nothing here loads remote pages. */
      allowRunningInsecureContent: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  w.loadURL('app://cs3/index.html' + (planner ? '?planner=1' : ''));
  if (!win) win = w;
  if (planner){ plannerWins.add(w); w.on('page-title-updated', e => e.preventDefault()); }
  w.on('closed', () => {
    plannerWins.delete(w);
    if (win === w) win = BrowserWindow.getAllWindows().find(x => !x.isDestroyed()) || null;
  });
  if (SHOT) takeScreenshot(w);

  const external = url => /^(https?:|mailto:|tel:)/i.test(url);
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (external(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('app://')) return;
    e.preventDefault();
    if (external(url)) shell.openExternal(url);
  });
  return w;
}

/* The Planner's own shortcuts, made once: Desktop and Start menu on Windows,
   the app menu on Linux. They start this same app with --planner. */
function plannerShortcuts(){
  if (SHOT || process.defaultApp) return;
  const flag = path.join(app.getPath('userData'), 'planner-shortcuts-v1');
  if (fs.existsSync(flag)) return;
  try {
    if (process.platform === 'win32') {
      const icon = process.execPath;
      const lnk = { target: process.execPath, args: '--planner', description: 'Plan videos — the minimal Creator Studio', icon, iconIndex: 0,
                    appUserModelId: 'com.solakirus.creatorstudio4' };
      shell.writeShortcutLink(path.join(app.getPath('desktop'), PLANNER_NAME + '.lnk'), 'create', lnk);
      const menu = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
      if (fs.existsSync(menu)) shell.writeShortcutLink(path.join(menu, PLANNER_NAME + '.lnk'), 'create', lnk);
    } else if (process.platform === 'linux') {
      const dir = path.join(os.homedir(), '.local', 'share', 'applications');
      fs.mkdirSync(dir, { recursive: true });
      const exec = (process.env.APPIMAGE || process.execPath).replace(/"/g, '\\"');
      fs.writeFileSync(path.join(dir, 'creator-studio-planner.desktop'), [
        '[Desktop Entry]', 'Type=Application', 'Name=' + PLANNER_NAME, 'Comment=Plan videos — the minimal Creator Studio',
        `Exec="${exec}" --planner %U`, 'Icon=creator-studio-v4', 'Terminal=false', 'Categories=Office;Video;', 'StartupWMClass=Creator Studio v4', ''].join('\n'));
    }
    fs.mkdirSync(path.dirname(flag), { recursive: true });
    fs.writeFileSync(flag, new Date().toISOString());
  } catch (e) { console.warn('planner shortcuts', e); }
}

function focus(){
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

app.on('second-instance', (e, argv) => {
  /* the Planner shortcut while the app is open: its own window (or the one already open) */
  if (wantsPlanner(argv)) {
    const pw = [...plannerWins].find(x => !x.isDestroyed());
    if (pw) { if (pw.isMinimized()) pw.restore(); pw.show(); pw.focus(); } else open(true);
    return;
  }
  focus();
  const url = linkIn(argv);
  if (url && win) win.webContents.send('cs3:link', url);
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  app.setAppUserModelId('com.solakirus.creatorstudio4');   /* Windows needs this for notifications */

  const root = WebUpdate.choose();
  protocol.handle('app', req => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  /* YouTube embeds refuse to play without a referrer. */
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*', '*://*.ytimg.com/*', '*://*.googlevideo.com/*'] },
    (details, cb) => { details.requestHeaders['Referer'] = 'https://creatorstudio3.app/'; cb({ requestHeaders: details.requestHeaders }); });

  protocol.handle('cs3lib', req => Library.serve(req));

  open(wantsPlanner(process.argv));
  plannerShortcuts();
  /* look for a newer version once the window is up; it loads next launch */
  setTimeout(() => WebUpdate.check().catch(err => console.warn('update check', err)), 8000);
  /* and again every 30 minutes while it's open, so a push reaches a laptop left running */
  setInterval(() => WebUpdate.check().catch(() => {}), 30 * 60 * 1000);
});
app.on('window-all-closed', () => app.quit());

/* ---------------------------------------------------------- screenshot
   Waits for the page, lets it draw (about 120 frames), saves the window and
   quits. A hidden window still paints; if the picture comes back empty the
   window is shown without focus and tried again. */
function takeScreenshot(w) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  w.webContents.once('did-finish-load', async () => {
    try {
      await wait(1500);
      if (SHOT_VIEW) {
        await w.webContents.executeJavaScript(`(async () => {
          const v = ${JSON.stringify(SHOT_VIEW)};
          if (v === 'library' || v === 'templates' || v === 'library-grab') {
            App.go('series');
            await new Promise(r => setTimeout(r, 400));
            const b = document.querySelector('.ctnav [data-v="' + v.replace('-grab', '') + '"]');
            if (b) b.click();
            if (v === 'library-grab') {
              await new Promise(r => setTimeout(r, 600));
              const t = document.querySelector('.lv-tabs [data-tab="add"]');
              if (t) t.click();
              await new Promise(r => setTimeout(r, 900));
              const g = [...document.querySelectorAll('.lv-card h3')].find(h => /Grab media/.test(h.textContent));
              if (g) g.scrollIntoView();
            }
          } else if (window.App) App.go(v);
        })()`, true).catch(() => {});
      }
      await wait(2200);
      let img = await w.webContents.capturePage();
      if (img.isEmpty()) {
        w.showInactive();
        await wait(1500);
        img = await w.webContents.capturePage();
      }
      fs.mkdirSync(path.dirname(path.resolve(SHOT)), { recursive: true });
      fs.writeFileSync(path.resolve(SHOT), img.toPNG());
    } catch (e) {
      console.error('Screenshot failed', e);
    }
    app.exit(0);
  });
}

/* ---------------------------------------------------------- Library on disk */
const Library = require('./library');
Library.wire({ ipcMain, dialog, shell, net, app, getWin: () => win });

/* ---------------------------------------------------------- self-update
   The Windows twin of app/js/updater.js. The web files (www/) are the same
   ones GitHub Pages publishes for the iPad, so rather than reinstall for every
   change, this downloads new versions of them from there into the user's own
   app-data folder and serves those instead — through the same app://cs3/
   origin, so the database and settings never move.

   New versions are downloaded in the background and used from the next
   launch. Only files whose SHA-256 changed are downloaded; every file is
   checked before it is used. A version that fails to open three times is
   dropped for the one before it. Running a new installer always starts from
   that installer's copy. */
const WebUpdate = (() => {
  const REMOTE = process.env.CS_UPDATE_REMOTE || 'https://solakirus.github.io/creator-studio-v4/';   /* tests point it elsewhere */
  const crypto = require('crypto');
  const shipped = path.join(__dirname, '..', 'www');
  const base = () => path.join(app.getPath('userData'), 'web');
  const stateFile = () => path.join(base(), 'state.json');
  const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
  const load = () => readJSON(stateFile()) || {};
  const save = s => { fs.mkdirSync(base(), { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(s, null, 1)); };
  const manifestOf = dir => readJSON(path.join(dir, 'update.json'));
  let active = shipped, status = { state: 'idle' };

  function choose(){
    const s = load(); s.bad = s.bad || [];
    const ship = manifestOf(shipped);
    /* A new installer was run: start from its copy, like Android does with a
       new APK. Anything newer online is fetched again by check(). */
    if (ship && s.shipped !== ship.build) { s.shipped = ship.build; s.active = null; s.ready = null; s.pending = null; }
    const usable = b => b && !s.bad.includes(b) && fs.existsSync(path.join(base(), b, 'update.json'));
    let pick = null;
    if (usable(s.ready)) { s.pending = { build: s.ready, tries: 0, prev: s.active || null }; pick = s.ready; s.ready = null; }
    else if (usable(s.active)) pick = s.active;

    if (pick && s.pending && s.pending.build === pick) {
      s.pending.tries = (s.pending.tries || 0) + 1;
      if (s.pending.tries > 3) {                     /* it never came up: go back */
        s.bad.push(pick); pick = usable(s.pending.prev) ? s.pending.prev : null; s.pending = null;
      }
    }
    s.active = pick; save(s);
    active = pick ? path.join(base(), pick) : shipped;
    return active;
  }

  function ok(){
    const s = load();
    if (s.pending && s.pending.build === s.active) { s.pending = null; save(s); }
    /* keep what is running, what came before it and what is waiting */
    const keep = new Set([s.active, s.ready, s.pending && s.pending.prev].filter(Boolean));
    try {
      for (const d of fs.readdirSync(base(), { withFileTypes: true })) {
        if (d.isDirectory() && !keep.has(d.name)) fs.rmSync(path.join(base(), d.name), { recursive: true, force: true });
      }
    } catch (e) {}
  }

  /* v4: GitHub Pages and nastime (the page tells us its address — see
     setSources) are both asked; the newest update.json (`made`) wins, and
     nothing older than what is running is ever taken. */
  const madeAt = m => (m && Date.parse(m.made)) || 0;
  function setSources(list){
    const s = load();
    s.sources = (Array.isArray(list) ? list : []).filter(u => typeof u === 'string' && /^https?:\/\//i.test(u)).slice(0, 3)
      .map(u => u.endsWith('/') ? u : u + '/');
    save(s);
    return s.sources;
  }
  async function readRemote(base){
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await net.fetch(base + 'update.json?t=' + Date.now(), { cache: 'no-store', signal: ctl.signal });
      const m = r.ok ? await r.json() : null;
      return m && m.format === 'cs3-web' && Array.isArray(m.files) ? m : null;
    } catch (e) { return null; } finally { clearTimeout(t); }
  }
  let checking = null;
  function check(){ return checking || (checking = run().finally(() => { checking = null; })); }
  async function run(){
    const cur = manifestOf(active);
    if (!cur) return (status = { state: 'error', reason: 'This copy has no update.json' });
    status = { state: 'checking' };
    const s = load();
    const ship = manifestOf(shipped);
    const bases = [REMOTE, ...(s.sources || []).filter(b => b !== REMOTE)];
    const seen = await Promise.all(bases.map(async base => ({ base, m: await readRemote(base) })));
    if (!seen.some(x => x.m)) return (status = { state: 'error', reason: 'Could not reach GitHub or nastime' });
    const good = seen.filter(x => x.m && !(s.bad || []).includes(x.m.build)).sort((a, b) => madeAt(b.m) - madeAt(a.m));
    const best = good[0];
    if (!best || best.m.build === cur.build || madeAt(best.m) <= madeAt(cur)) return (status = { state: 'current', build: cur.build });
    const remote = best.m, BASE = best.base;
    const from = BASE === REMOTE ? 'GitHub' : 'nastime';
    if (remote.native > ((ship && ship.native) || 1))
      return (status = { state: 'error', needsApk: true, reason: 'This update changes the app itself — run update.bat (or build-linux.sh)' });
    if (s.ready === remote.build) return (status = { state: 'ready', build: remote.build, from });

    const have = new Map(cur.files.map(f => [f[0], f[1]]));
    const tmp = path.join(base(), remote.build + '.part'), dest = path.join(base(), remote.build);
    fs.rmSync(tmp, { recursive: true, force: true });
    status = { state: 'downloading', done: 0, total: remote.files.length };
    try {
      for (const [p, hash] of remote.files) {
        let buf;
        if (have.get(p) === hash) buf = fs.readFileSync(path.join(active, p));
        else {
          const r = await net.fetch(BASE + p + '?b=' + remote.build, { cache: 'no-store' });
          if (!r.ok) throw new Error(p + ': ' + r.status);
          buf = Buffer.from(await r.arrayBuffer());
        }
        if (crypto.createHash('sha256').update(buf).digest('hex') !== hash) throw new Error(p + ' did not match its fingerprint');
        const out = path.join(tmp, p);
        if (!out.startsWith(tmp)) throw new Error('bad path ' + p);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, buf);
        status.done++;
      }
      fs.writeFileSync(path.join(tmp, 'update.json'), JSON.stringify(remote));
      fs.rmSync(dest, { recursive: true, force: true });
      fs.renameSync(tmp, dest);
      const s2 = load(); s2.ready = remote.build; save(s2);
      status = { state: 'ready', build: remote.build, from };
      if (win) win.webContents.send('cs3:update-ready', remote.build);
    } catch (e) {
      fs.rmSync(tmp, { recursive: true, force: true });
      status = { state: 'error', reason: e.message || String(e) };
    }
    return status;
  }

  return { choose, ok, check, setSources, status: () => status, current: () => manifestOf(active), sources: () => load().sources || [] };
})();

ipcMain.on('cs3:web-ok', () => WebUpdate.ok());
ipcMain.handle('cs3:web-check', () => WebUpdate.check());
ipcMain.handle('cs3:web-sources', (e, list) => WebUpdate.setSources(list));
/* "Restart now" after an update has downloaded: open again on the new version */
ipcMain.on('cs3:web-restart', () => { app.relaunch(); app.exit(0); });
ipcMain.handle('cs3:web-info', () => {
  const m = WebUpdate.current();
  return { available: true, build: m && m.build, made: m && m.made, status: WebUpdate.status(), sources: WebUpdate.sources() };
});

/* ---------------------------------------------------------- bridge: App */

ipcMain.handle('cs3:launch-url', () => { const u = launchUrl; launchUrl = null; return u; });
ipcMain.on('cs3:quit', () => app.quit());

/* ---------------------------------------------------------- bridge: HTTP
   Same job as CapacitorHttp on the phone: a request made outside the page, so
   Instagram, TikTok and YouTube metadata can be read without CORS. */
ipcMain.handle('cs3:http', async (e, o) => {
  const opts = o || {};
  const ms = Math.max(opts.connectTimeout || 0, opts.readTimeout || 0) || 15000;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    let url = opts.url;
    if (opts.params) {
      const u = new URL(url);
      Object.entries(opts.params).forEach(([k, v]) => u.searchParams.set(k, v));
      url = u.toString();
    }
    const r = await net.fetch(url, {
      method: opts.method || 'GET', headers: opts.headers || {}, signal: ctl.signal,
      body: opts.data == null ? undefined : (typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data))
    });
    const headers = {};
    r.headers.forEach((v, k) => { headers[k] = v; headers[k.replace(/(^|-)\w/g, s => s.toUpperCase())] = v; });
    const type = r.headers.get('content-type') || '';
    let data;
    if (opts.responseType === 'blob' || opts.responseType === 'arraybuffer') {
      data = Buffer.from(await r.arrayBuffer()).toString('base64');
    } else {
      const text = await r.text();
      data = text;
      if (opts.responseType === 'json' || (!opts.responseType && /json/i.test(type))) {
        try { data = JSON.parse(text); } catch (err) { data = text; }
      }
    }
    return { status: r.status, headers, url: r.url || url, data };
  } finally { clearTimeout(t); }
});

/* ---------------------------------------------------------- bridge: files
   writeFile + share is how the phone saves a backup or CSV. Here "share"
   becomes a Save As dialog, so the file lands wherever you choose. */
const docsDir = () => path.join(app.getPath('documents'), NAME);
const cacheDir = () => path.join(app.getPath('temp'), 'creator-studio-v4');

ipcMain.handle('cs3:fs-write', async (e, o) => {
  const dir = o.directory === 'DOCUMENTS' ? docsDir() : cacheDir();
  const file = path.normalize(path.join(dir, o.path));
  if (!file.startsWith(dir)) throw new Error('Bad path');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = o.encoding ? Buffer.from(String(o.data), 'utf8') : Buffer.from(String(o.data), 'base64');
  fs.writeFileSync(file, buf);
  return { uri: file };
});

/* The three the backup sweep needs, so Windows walks the same code path as the
   phone rather than having a second implementation to keep in step. Each is
   confined to the same two directories as the write above. */
const underDir = (directory, p) => {
  const dir = directory === 'DOCUMENTS' ? docsDir() : cacheDir();
  const file = path.normalize(path.join(dir, p || ''));
  if (!file.startsWith(dir)) throw new Error('Bad path');
  return file;
};

ipcMain.handle('cs3:fs-stat', async (e, o) => {
  const file = underDir(o.directory, o.path);
  const s = fs.statSync(file);
  return { size: s.size, mtime: s.mtimeMs, type: s.isDirectory() ? 'directory' : 'file' };
});

ipcMain.handle('cs3:fs-readdir', async (e, o) => {
  const dir = underDir(o.directory, o.path);
  if (!fs.existsSync(dir)) return { files: [] };
  return { files: fs.readdirSync(dir, { withFileTypes: true }).map(d => ({
    name: d.name, type: d.isDirectory() ? 'directory' : 'file' })) };
});

ipcMain.handle('cs3:fs-delete', async (e, o) => {
  const file = underDir(o.directory, o.path);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return {};
});

ipcMain.handle('cs3:share', async (e, o) => {
  const src = (o.files || [])[0];
  if (!src || !fs.existsSync(src)) throw new Error('Nothing to save');
  const r = await dialog.showSaveDialog(win, {
    title: o.dialogTitle || o.title || 'Save',
    defaultPath: path.join(app.getPath('downloads'), path.basename(src))
  });
  if (r.canceled || !r.filePath) throw new Error('Share canceled');
  fs.copyFileSync(src, r.filePath);
  return {};
});

/* ---------------------------------------------------------- bridge: reminders
   Fire while the app is open (or minimised). Windows has no equivalent of
   Android's alarm that wakes a closed app, so a reminder due while CS3 is
   closed is skipped — the phone still gets it. */
const pending = new Map();      /* id → { n, timer } */

ipcMain.handle('cs3:notif-schedule', (e, list) => {
  (list || []).forEach(n => {
    const at = n.schedule && n.schedule.at ? new Date(n.schedule.at).getTime() : Date.now();
    const wait = at - Date.now();
    if (wait < 0 || wait > 0x7fffffff) return;
    if (pending.has(n.id)) clearTimeout(pending.get(n.id).timer);
    const timer = setTimeout(() => {
      pending.delete(n.id);
      if (!Notification.isSupported()) return;
      const note = new Notification({ title: n.title || NAME, body: n.body || '',
                                      icon: path.join(__dirname, '..', 'build', 'icon.png') });
      note.on('click', focus);
      note.show();
    }, wait);
    pending.set(n.id, { n: { id: n.id, title: n.title, body: n.body, schedule: { at: new Date(at) } }, timer });
  });
  return {};
});
ipcMain.handle('cs3:notif-pending', () => ({ notifications: [...pending.values()].map(p => p.n) }));
ipcMain.handle('cs3:notif-cancel', (e, ids) => {
  (ids || []).forEach(id => { const p = pending.get(id); if (p) { clearTimeout(p.timer); pending.delete(id); } });
  return {};
});

/* for tests/webupdate.e2e.js */
module.exports = { WebUpdate };
