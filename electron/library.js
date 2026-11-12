/* Creator Studio 3 — the Library's laptop half.

   The Library keeps GIFs, clips and stills. On the phone they live inside the
   app. On the laptop it can also show folders on disk, the way Shotline does:
   ~/Shot Library (<library>/<site>/<page>/{gifs,videos,images} + manifest.json)
   and any folder you add. This file reads those folders with Shotline's rules,
   serves their files to the page (cs3lib://), moves deleted ones into
   _Deleted, copies a board into a folder, and runs Shot Library's grabber.

   Rules carried over from Shotline's library.rs / grab.rs; see MECHANICS.md. */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const Builtin = require('./grab-builtin');

const home = () => process.env.SHOT_LIBRARY_HOME || os.homedir();
const defaultRoot = () => path.join(home(), 'Shot Library');

/* folders the page may read from: Shot Library plus whatever it told us */
const roots = new Set();
const allowed = file => {
  const f = path.resolve(file).toLowerCase();
  return [defaultRoot(), ...roots].some(r => {
    const base = path.resolve(r).toLowerCase();
    return f === base || f.startsWith(base + path.sep);
  });
};

/* library.rs kind_of */
function kindOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  if (!m) return null;
  const e = m[1].toLowerCase();
  if (e === 'gif') return 'gif';
  if (['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(e)) return 'video';
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'jfif'].includes(e)) return 'image';
  return null;
}

/* library.rs is_animated_webp: VP8X with the animation flag, or an ANIM chunk */
function animatedWebp(abs) {
  try {
    const fd = fs.openSync(abs, 'r');
    const b = Buffer.alloc(64);
    const n = fs.readSync(fd, b, 0, 64, 0);
    fs.closeSync(fd);
    if (n < 21 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return false;
    if (b.toString('latin1', 12, 16) === 'VP8X' && (b[20] & 0x02)) return true;
    return b.slice(0, n).includes(Buffer.from('ANIM'));
  } catch (e) { return false; }
}

const SKIP = ['_Shotlists', '_Boards', '_logs', '_Deleted', '_Shotline'];
const MAX_FILES = 60000;

function walk(dir, rel, depth, files, manifests) {
  if (depth > 6 || files.length > MAX_FILES) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP.includes(e.name)) continue;
    const p = rel ? rel + '/' + e.name : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, p, depth + 1, files, manifests);
    else if (e.name === 'manifest.json') {
      try { manifests.push([p, JSON.parse(fs.readFileSync(abs, 'utf8'))]); } catch (err) { /* not JSON */ }
    } else if (kindOf(e.name)) {
      let size = 0;
      try { size = fs.statSync(abs).size; } catch (err) { /* gone */ }
      files.push([p, size]);
    }
  }
}

const str = (v, k) => (v && typeof v[k] === 'string') ? v[k] : '';

/* library.rs add_source: pages from manifests, else from the folder a file sits in */
/* `as` names the folder the frames belong to when they're read from its copy:
   the uids stay the same, so tasks, boards and stars still find them. */
function scanRoot(root, as) {
  const files = [], manifests = [];
  walk(root, '', 0, files, manifests);
  const src = 'h:' + (as || root);
  const rootName = path.basename(root);
  const pages = new Map();
  const meta = new Map();
  for (const [p, j] of manifests) {
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    const parts = dir.split('/');
    const site = str(j, 'site');
    const at = site ? parts.indexOf(site) : -1;
    const collection = at > 0 ? parts.slice(0, at).join(' / ') : (site || parts[0] || rootName);
    const uid = src + '|' + dir;
    pages.set(uid, {
      uid, root, dir, collection,
      site: site || parts[0] || '',
      page: str(j, 'page') || parts[parts.length - 1] || '',
      title: str(j, 'title'), heading: str(j, 'heading'), source: str(j, 'source'),
      grabbed: str(j, 'grabbedAt'), counts: [0, 0, 0]
    });
    for (const it of (Array.isArray(j.items) ? j.items : [])) {
      const f = str(it, 'file');
      if (f) meta.set(dir ? dir + '/' + f : f, [it, uid]);
    }
  }
  const items = [];
  for (const [p, size] of files) {
    let kind = kindOf(p);
    const abs = path.join(root, ...p.split('/'));
    if (kind === 'image' && /\.webp$/i.test(p) && animatedWebp(abs)) kind = 'gif';
    const parts = p.split('/');
    const m = meta.get(p);
    let pageUid;
    if (m) pageUid = m[1];
    else {
      const parent = parts.slice(0, -1);
      const last = (parent[parent.length - 1] || '').toLowerCase();
      if (['gifs', 'videos', 'images', 'stills', 'clips'].includes(last)) parent.pop();
      const dir = parent.join('/');
      pageUid = src + '|' + dir;
      if (!pages.has(pageUid)) pages.set(pageUid, {
        uid: pageUid, root, dir,
        collection: parent[0] || rootName, site: parent[0] || rootName,
        page: parent.length > 1 ? parent.slice(1).join(' / ') : (parent[0] || rootName),
        title: '', heading: '', source: '', grabbed: '', counts: [0, 0, 0]
      });
    }
    const mv = m ? m[0] : null;
    items.push({
      uid: src + '|' + p, src: 'h', root, path: p, kind,
      name: parts[parts.length - 1],
      label: str(mv, 'label'), caption: str(mv, 'caption'),
      link: str(mv, 'link') || str(mv, 'url'),
      /* grabbed from a popup: the bigger GIF, the original video and tags */
      big: str(mv, 'big'), source: str(mv, 'source'),
      tags: mv && Array.isArray(mv.tags) ? mv.tags.filter(x => typeof x === 'string').slice(0, 20) : [],
      order: mv && typeof mv.order === 'number' ? mv.order : 9999,
      bytes: size, page: pageUid,
      url: 'cs3lib://f/' + encodeURIComponent(abs)
    });
  }
  items.sort((a, b) => a.page < b.page ? -1 : a.page > b.page ? 1 : (a.order - b.order) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const it of items) {
    const pg = pages.get(it.page);
    if (pg) pg.counts[it.kind === 'gif' ? 0 : it.kind === 'video' ? 1 : 2]++;
  }
  return { items, pages: [...pages.values()].filter(p => p.counts[0] + p.counts[1] + p.counts[2] > 0) };
}

const isDir = p => { try { return !!p && fs.statSync(p).isDirectory(); } catch (e) { return false; } };
const inside = (a, b) => {
  const x = path.resolve(a).toLowerCase(), y = path.resolve(b).toLowerCase();
  return x === y || x.startsWith(y + path.sep) || y.startsWith(x + path.sep);
};

/* v4: every folder the Library reads. A folder can have a copy (on this computer,
   say, for one on the NAS): when the folder can't be reached its copy is read
   in its place, under the folder's own name. */
function scanAll(list, mirrors) {
  roots.clear();
  const out = { items: [], pages: [], roots: [], errors: [], fallback: [] };
  const all = [defaultRoot(), ...(list || [])].filter((r, i, a) => r && a.indexOf(r) === i);
  const copies = mirrors && typeof mirrors === 'object' ? mirrors : {};
  for (const r of all) {
    const copy = typeof copies[r] === 'string' && copies[r] && !inside(copies[r], r) ? copies[r] : '';
    if (copy && isDir(copy)) roots.add(copy);
    let from = r;
    if (!isDir(r)) {
      if (copy && isDir(copy)) { from = copy; out.fallback.push({ root: r, copy }); }
      else { if (r !== defaultRoot()) out.errors.push('No folder at ' + r); continue; }
    }
    roots.add(from);
    out.roots.push(r);
    try { const s = scanRoot(from, r); out.items.push(...s.items); out.pages.push(...s.pages); }
    catch (err) { out.errors.push(r + ': ' + err.message); }
  }
  return out;
}

/* v4: keep a copy of a folder. New and changed files go across (same size and
   not newer = already there). Nothing in the copy is ever deleted, so losing
   or emptying one side can't empty the other. */
const COPY_SKIP = ['_Deleted', '_logs'];
async function mirrorCopy(from, to, onStep) {
  if (!isDir(from)) throw new Error('No folder at ' + from);
  if (inside(from, to)) throw new Error('The copy can’t be inside the folder (or the other way round)');
  const fsp = fs.promises;
  const st = { copied: 0, same: 0, failed: 0, bytes: 0, errors: [] };
  let seen = 0;
  async function dir(src, dst, depth) {
    if (depth > 12) return;
    let entries = [];
    try { entries = await fsp.readdir(src, { withFileTypes: true }); } catch (e) { st.failed++; st.errors.push(src + ': ' + e.message); return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name.endsWith('.cs4part') || (depth === 0 && COPY_SKIP.includes(e.name))) continue;
      const a = path.join(src, e.name), b = path.join(dst, e.name);
      if (e.isDirectory()) { await dir(a, b, depth + 1); continue; }
      if (!e.isFile()) continue;
      try {
        const sa = await fsp.stat(a);
        let sb = null;
        try { sb = await fsp.stat(b); } catch (err) { sb = null; }
        if (sb && sb.size === sa.size && sa.mtimeMs - sb.mtimeMs < 2000) st.same++;
        else {
          await fsp.mkdir(dst, { recursive: true });
          const part = b + '.cs4part';
          await fsp.copyFile(a, part);
          await fsp.rename(part, b);
          /* keep the time where the share allows it (some SMB mounts don't) */
          try { await fsp.utimes(b, sa.atime, sa.mtime); } catch (err) { /* the size check still works */ }
          st.copied++; st.bytes += sa.size;
        }
      } catch (err) {
        st.failed++;
        if (st.errors.length < 20) st.errors.push(a + ': ' + err.message);
      }
      if (onStep && ++seen % 50 === 0) onStep(st);
    }
  }
  await fsp.mkdir(to, { recursive: true });
  await dir(from, to, 0);
  return st;
}

/* the safe name library.rs gives a folder or file */
const safeName = s => String(s || '').replace(/[\u0000-\u001f\\/:*?"<>|]/g, ' ').split(/\s+/).filter(Boolean).join(' ').slice(0, 120);

function serve(req, net) {
  try {
    const u = new URL(req.url);
    const abs = decodeURIComponent(u.pathname.replace(/^\//, ''));
    if (!abs || !allowed(abs) || !fs.existsSync(abs)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(abs).toString(), { headers: req.headers });
  } catch (e) {
    return new Response('Bad request', { status: 400 });
  }
}

/* ---------------------------------------------------------- the grabber (grab.rs) */
function findNode() {
  const exe = process.platform === 'win32' ? 'node.exe' : 'node';
  for (const d of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(d, exe);
    if (d && fs.existsSync(p)) return p;
  }
  for (const p of ['C:\\Program Files\\nodejs\\node.exe', '/usr/local/bin/node', '/usr/bin/node', '/opt/homebrew/bin/node']) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const isGrabRoot = p => !!p && fs.existsSync(path.join(p, 'grabber', 'grab.mjs'));
const isSetUp = p => fs.existsSync(path.join(p, 'node_modules', 'playwright'));
function findGrabber(setting) {
  if (setting && isGrabRoot(setting.trim())) return setting.trim();
  const c = [path.join(home(), 'Documents', 'Craft Anything', 'eyecannndy-com', 'app'),
             path.join(defaultRoot(), 'grabber-kit'),
             path.join(process.cwd(), 'grabber-kit')];
  return c.find(p => isGrabRoot(p) && isSetUp(p)) || c.find(isGrabRoot) || null;
}

let job = null;

function wire({ ipcMain, dialog, shell, net, getWin }) {
  module.exports.serve = req => serve(req, net);
  const send = (ch, v) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, v); };

  ipcMain.handle('cs3:lib-home', () => ({ path: defaultRoot(), exists: fs.existsSync(defaultRoot()) }));

  ipcMain.handle('cs3:lib-scan', (e, list, mirrors) => scanAll(list, mirrors));

  /* copy each folder into its copy, one after another */
  let copying = false;
  ipcMain.handle('cs3:lib-mirror', async (e, pairs) => {
    if (copying) return { ok: false, why: 'A copy is already running' };
    copying = true;
    const results = [];
    try {
      for (const [from, to] of (Array.isArray(pairs) ? pairs : [])) {
        if (!from || !to) continue;
        if (!isDir(from)) { results.push({ from, to, skipped: 'not reachable' }); continue; }
        roots.add(to);
        try {
          const st = await mirrorCopy(from, to, s => send('cs3:lib-mirror-step', Object.assign({ from, to }, s)));
          results.push(Object.assign({ from, to }, st));
        } catch (err) { results.push({ from, to, error: err.message }); }
      }
    } finally { copying = false; }
    send('cs3:lib-mirror-done', results);
    return { ok: true, results };
  });

  ipcMain.handle('cs3:lib-pick-folder', async () => {
    const r = await dialog.showOpenDialog(getWin(), { properties: ['openDirectory'], defaultPath: home() });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('cs3:lib-open', (e, target) => {
    const t = String(target || '');
    if (/^https?:\/\//i.test(t)) return shell.openExternal(t);
    if (allowed(t)) return shell.openPath(t);
    return 'not allowed';
  });

  /* "delete" moves into Shot Library/_Deleted, keeping the folders (library.rs trash) */
  ipcMain.handle('cs3:lib-trash', (e, list) => {
    let n = 0;
    const deleted = path.join(defaultRoot(), '_Deleted');
    for (const it of (list || [])) {
      const abs = path.join(it.root, ...String(it.path).split('/'));
      if (!allowed(abs) || !fs.existsSync(abs)) continue;
      const sub = path.resolve(it.root) === path.resolve(defaultRoot()) ? '' : safeName(path.basename(it.root));
      const dest = path.join(deleted, sub, ...String(it.path).split('/'));
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        try { fs.renameSync(abs, dest); } catch (err) { fs.copyFileSync(abs, dest); fs.unlinkSync(abs); }
        n++;
      } catch (err) { /* left where it was */ }
    }
    return n;
  });

  /* a board as a folder: Shot Library/_Boards/<group>/<board> (ui_lib.rs "Make folder") */
  ipcMain.handle('cs3:lib-board-folder', (e, o) => {
    const dest = path.join(defaultRoot(), '_Boards', safeName(o.group) || 'Other', safeName(o.name) || 'Board');
    fs.mkdirSync(dest, { recursive: true });
    let n = 0;
    for (const f of (o.files || [])) {
      try {
        if (f.abs) {
          if (!allowed(f.abs) || !fs.existsSync(f.abs)) continue;
          fs.copyFileSync(f.abs, path.join(dest, safeName(f.name) || path.basename(f.abs)));
        } else if (f.b64) {
          fs.writeFileSync(path.join(dest, safeName(f.name) || 'file'), Buffer.from(f.b64, 'base64'));
        } else continue;
        n++;
      } catch (err) { /* skip that one */ }
    }
    shell.openPath(dest);
    return { n, dest };
  });

  /* Shotline's own plan and the boards Shot Library shares */
  ipcMain.handle('cs3:lib-shotline', () => {
    const read = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
    const plan = read(path.join(defaultRoot(), '_Shotline', 'plan.json'));
    const boards = read(path.join(defaultRoot(), '_boards.json'));
    return { templates: (plan && plan.templates) || [], boards: (boards && boards.boards) || [] };
  });

  /* An outside grabber kit (grab.mjs) is used only when one is set up; otherwise
     the grabber built into the app (grab-builtin.js: yt-dlp + ffmpeg). */
  const kitReady = setting => { const root = findGrabber(setting); return root && isSetUp(root) && findNode() ? root : null; };
  ipcMain.handle('cs3:grab-find', (e, setting) => {
    const kit = kitReady(setting);
    const t = Builtin.tools();
    return { root: kit || (t.ytdlp && t.ffmpeg ? 'built in' : null), setUp: kit ? true : !!(t.ytdlp && t.ffmpeg), node: kit ? findNode() : true,
      builtin: !kit, ytdlp: t.ytdlp, ffmpeg: t.ffmpeg, winget: !!t.winget, out: defaultRoot() };
  });

  ipcMain.handle('cs3:grab-run', (e, o) => {
    if (job) return { ok: false, why: 'A grab is already running' };
    if (!kitReady(o.setting)) {
      const t = Builtin.tools();
      const wantsVideo = o.mode === 'grab' ? (o.links || []).some(Builtin.isVideoLink) : o.mode === 'scan' && Builtin.isVideoLink(o.url || '');
      if (wantsVideo && !(t.ytdlp && t.ffmpeg))
        return { ok: false, why: 'yt-dlp isn’t installed yet — press “Install yt-dlp and ffmpeg”' };
      const b = Builtin.makeJob(l => send('cs3:grab-line', l));
      job = { kill: () => b.stop() };
      let work;
      if (o.mode === 'setup') work = Builtin.setup(b, t);
      else if (o.mode === 'scan') work = Builtin.scan(b, t, o.url, Math.max(1, Math.min(2000, o.max | 0 || 200)), l => send('cs3:grab-link', l));
      else {
        const s = o.opts || {};
        const out = s.out ? (path.isAbsolute(s.out) ? s.out : path.join(defaultRoot(), safeName(s.out))) : defaultRoot();
        fs.mkdirSync(out, { recursive: true });
        roots.add(out);
        work = Builtin.grab(b, t, (o.links || []).filter(l => /^https?:\/\//i.test(l)), out, s);
      }
      Promise.resolve(work).catch(err => { send('cs3:grab-line', '✗ ' + err.message); return 1; })
        .then(code => { job = null; send('cs3:grab-done', { code: b.stopped ? 1 : (code | 0) }); });
      return { ok: true, builtin: true };
    }
    const root = findGrabber(o.setting);
    const node = findNode();
    if (!root || !node) return { ok: false, why: !node ? 'Node.js was not found' : 'The grabber was not found' };
    let program = node, args;
    const script = path.join(root, 'grabber', 'grab.mjs');
    if (o.mode === 'setup') {
      program = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      args = ['install', '--no-audit', '--no-fund'];
    } else if (o.mode === 'scan') {
      args = [script, '--scan', '--scan-max', String(Math.max(1, Math.min(2000, o.max | 0 || 200))), o.url];
    } else {
      const s = o.opts || {};
      const out = s.out ? (path.isAbsolute(s.out) ? s.out : path.join(defaultRoot(), safeName(s.out))) : defaultRoot();
      args = [script, '--out', out];
      if (s.follow) args.push('--follow', '--max', String(Math.max(1, Math.min(500, s.maxPages | 0 || 20))));
      args.push('--yt-every', String(Math.max(0, Math.min(600, +s.ytEvery || 0))),
        '--yt-max', String(Math.max(1, Math.min(10000, s.ytMax | 0 || 200))),
        '--yt-sens', s.ytSens || 'normal', '--yt-mode', s.ytMode || 'download',
        '--yt-what', s.ytWhat || 'both', '--gif-secs', String(Math.max(0, Math.min(15, +s.gifSecs || 3))),
        '--gif-mode', s.gifMode || 'shot', '--gif-max', String(Math.max(1, Math.min(5000, s.gifMax | 0 || 200))));
      if (!s.keepVideo) args.push('--no-video');
      args.push(...(o.links || []).filter(l => /^https?:\/\//i.test(l)));
      roots.add(out);
    }
    const env = Object.assign({}, process.env, { PATH: path.dirname(node) + path.delimiter + (process.env.PATH || '') });
    try {
      job = spawn(program, args, { cwd: root, env, shell: o.mode === 'setup' && process.platform === 'win32' });
    } catch (err) {
      job = null;
      return { ok: false, why: err.message };
    }
    const lines = stream => {
      let buf = '';
      stream.on('data', d => {
        buf += d.toString();
        const parts = buf.split(/\r?\n/);
        buf = parts.pop();
        for (const l of parts) {
          if (!l.trim()) continue;
          if (l.startsWith('@@LINK ')) {
            try { send('cs3:grab-link', JSON.parse(l.slice(7))); } catch (err) { /* not a link */ }
          } else send('cs3:grab-line', l);
        }
      });
    };
    lines(job.stdout); lines(job.stderr);
    job.on('close', code => { job = null; send('cs3:grab-done', { code }); });
    job.on('error', err => { send('cs3:grab-line', '✗ Could not start: ' + err.message); });
    return { ok: true };
  });

  ipcMain.handle('cs3:grab-stop', () => { if (job) { try { job.kill(); } catch (e) {} } return true; });
}

module.exports = { wire, serve: () => new Response('Not ready', { status: 503 }), scanRoot, scanAll, mirrorCopy, allowed, kindOf };
