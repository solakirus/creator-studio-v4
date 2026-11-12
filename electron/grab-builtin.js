/* Creator Studio 3 — the grabber built into the laptop app.

   Shotline and the first CS3 Library ran an outside "grabber kit"
   (grabber/grab.mjs + Playwright) that isn't on this laptop. This does the
   same job with two free tools most video people already have, yt-dlp and
   ffmpeg (winget install yt-dlp.yt-dlp brings both):

   - a video link (YouTube, Instagram, TikTok, Vimeo, X, Facebook… anything
     yt-dlp knows) is downloaded at up to 720p, cut at every shot change
     (ffmpeg's scene score), and each shot gives a still and a short GIF;
   - any other page is read for its pictures, GIFs and clips (img, srcset,
     og:image, video/source, links to media files), which are downloaded.

   Files land the way Shot Library lays them out, so the Library reads them
   with no extra work: <out>/<site>/<page>/{gifs,videos,images} and a
   manifest.json (site, page, title, source, grabbedAt, items[]).
   Numbers are in MECHANICS.md ("The built-in grabber"). */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const Browser = require('./grab-browser');

/* ---------------------------------------------------------------- the tools */
/* lstat, not exists: Windows' app shortcuts (WindowsApps\winget.exe) are
   reparse points that fs.existsSync reports as missing */
const there = p => { try { fs.lstatSync(p); return true; } catch (e) { return false; } };
function onPath(exe) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps'));
  for (const d of dirs) {
    if (!d) continue;
    const p = path.join(d.replace(/^"|"$/g, ''), exe);
    if (there(p)) return p;
  }
  return null;
}
/* winget puts its tools under %LOCALAPPDATA%\Microsoft\WinGet: Links\ when
   it can, Packages\<id>\…\ always. A Start-menu launch may not see the PATH a
   fresh install set, so look there too. */
function inWinget(exe) {
  const base = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet') : null;
  if (!base) return null;
  const link = path.join(base, 'Links', exe);
  if (fs.existsSync(link)) return link;
  const pk = path.join(base, 'Packages');
  let dirs = [];
  try { dirs = fs.readdirSync(pk); } catch (e) { return null; }
  const find = (dir, depth) => {
    if (depth > 4) return null;
    let es = [];
    try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
    for (const e of es) if (e.isFile() && e.name.toLowerCase() === exe.toLowerCase()) return path.join(dir, e.name);
    for (const e of es) if (e.isDirectory()) { const r = find(path.join(dir, e.name), depth + 1); if (r) return r; }
    return null;
  };
  for (const d of dirs.filter(x => /yt-dlp|ffmpeg|gyan/i.test(x))) {
    const r = find(path.join(pk, d), 0);
    if (r) return r;
  }
  return null;
}
function findTool(name, setting) {
  if (setting && fs.existsSync(setting)) return setting;
  const exe = process.platform === 'win32' ? name + '.exe' : name;
  const extra = process.platform === 'win32' ? [] : ['/opt/homebrew/bin/' + name, '/usr/local/bin/' + name, '/usr/bin/' + name];
  return onPath(exe) || (process.platform === 'win32' ? inWinget(exe) : null) || extra.find(p => fs.existsSync(p)) || null;
}
function tools(s) {
  s = s || {};
  return { ytdlp: findTool('yt-dlp', s.ytdlpPath), ffmpeg: findTool('ffmpeg', s.ffmpegPath),
    winget: process.platform === 'win32' ? findTool('winget') : null };
}

/* ---------------------------------------------------------------- the rules */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|vimeo\.com|twitter\.com|x\.com|facebook\.com|fb\.watch|dailymotion\.com|twitch\.tv|reddit\.com|v\.redd\.it|pinterest\.[a-z.]+|streamable\.com|bilibili\.com)$/i;
/* ffmpeg scene score a cut must pass, by the "Cut sensitivity" setting */
const SCENE = { high: 0.2, normal: 0.3, low: 0.45 };
const MIN_SHOT = 0.6;        /* s: shorter "shots" are flashes, not cuts */
const GIF_FPS = 12, GIF_W = 480, GIF_COLOURS = 128;
const STILL_W = 1280;
const VIDEO_FORMAT = 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]/b';
const MAX_PAGE_FILES = 300, MAX_FILE_BYTES = 200 * 1024 * 1024;

const safeName = s => String(s || '').replace(/[\u0000-\u001f\\/:*?"<>|#%]/g, ' ').split(/\s+/).filter(Boolean).join(' ').slice(0, 80).replace(/[. ]+$/, '');
const siteOf = u => { try { return new URL(u).hostname.replace(/^www\.|^m\./, ''); } catch (e) { return 'web'; } };
const isVideoLink = u => VIDEO_HOSTS.test(siteOf(u));
const kindOfUrl = u => {
  const m = /\.([a-z0-9]{2,5})(?:$|[?#])/i.exec(String(u).split('?')[0] + '?');
  const e = m ? m[1].toLowerCase() : '';
  if (e === 'gif') return 'gif';
  if (['mp4', 'webm', 'mov', 'm4v'].includes(e)) return 'video';
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'jfif'].includes(e)) return 'image';
  return null;
};
/* v4: on a social profile, only these are worth grabbing — the posts and
   reels themselves, never the page's own links (Log In, Sign Up, followers,
   Explore). Returns { url, kind } with the url tidied, or null. */
const POST_RULES = [
  [/(^|\.)instagram\.com$/i, /^\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/i,
    m => ({ url:`https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/`, kind:m[1] === 'p' ? 'post' : 'video' })],
  [/(^|\.)tiktok\.com$/i, /^\/(@[\w.-]+)\/(video|photo)\/(\d+)/i,
    m => ({ url:`https://www.tiktok.com/${m[1]}/${m[2]}/${m[3]}`, kind:m[2] === 'photo' ? 'post' : 'video' })],
  [/(^|\.)(x|twitter)\.com$/i, /^\/(\w+)\/status\/(\d+)/i,
    m => ({ url:`https://x.com/${m[1]}/status/${m[2]}`, kind:'post' })],
  [/(^|\.)facebook\.com$/i, /^\/(?:[\w.]+\/)?(reel|videos|watch)\b/i, null],
  [/(^|\.)threads\.net$/i, /^\/@[\w.]+\/post\/[\w-]+/i, null]
];
const isSocial = u => POST_RULES.some(([h]) => h.test(siteOf(u)));
function postLink(u){
  let x; try { x = new URL(u); } catch (e) { return null; }
  const host = x.hostname.replace(/^www\.|^m\./, '');
  for (const [h, path, tidy] of POST_RULES){
    if (!h.test(host)) continue;
    const m = path.exec(x.pathname);
    if (!m) return null;
    return tidy ? tidy(m) : { url:x.origin + x.pathname + x.search, kind:'video' };
  }
  return null;
}

const pad = n => String(n).padStart(3, '0');
const stamp = s => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };

/* ---------------------------------------------------------------- a job */
function makeJob(emit) {
  let child = null, stopped = false;
  const run = (program, args, onLine) => new Promise((resolve) => {
    if (stopped) return resolve({ code: -1, out: '', err: '' });
    let out = '', err = '';
    try { child = spawn(program, args, { windowsHide: true }); }
    catch (e) { return resolve({ code: -1, out: '', err: e.message }); }
    const feed = (buf, which) => d => {
      const s = d.toString();
      if (which === 'out') out += s; else err += s;
      if (onLine) s.split(/\r?\n|\r/).forEach(l => { if (l.trim()) onLine(l, which); });
    };
    child.stdout.on('data', feed(out, 'out'));
    child.stderr.on('data', feed(err, 'err'));
    child.on('error', e => { err += e.message; });
    child.on('close', code => { child = null; resolve({ code, out, err }); });
  });
  return {
    run, emit,
    get stopped() { return stopped; },
    stop() { stopped = true; if (child) { try { child.kill(); } catch (e) {} } }
  };
}

function writeManifest(dir, m) {
  const file = path.join(dir, 'manifest.json');
  let old = null;
  try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* new */ }
  const items = (old && Array.isArray(old.items) ? old.items : []).filter(it => !m.items.some(x => x.file === it.file));
  fs.writeFileSync(file, JSON.stringify({ ...m, items: items.concat(m.items) }, null, 2));
}

/* ---------------------------------------------------------------- videos */
async function cutTimes(job, ffmpeg, video, o) {
  const dur = await duration(job, ffmpeg, video);
  let starts = [0];
  if (+o.ytEvery > 0) {
    for (let t = +o.ytEvery; t < dur - 0.2; t += +o.ytEvery) starts.push(t);
  } else {
    const th = SCENE[o.ytSens] || SCENE.normal;
    const r = await job.run(ffmpeg, ['-hide_banner', '-nostats', '-i', video, '-an', '-sn',
      '-vf', `scale=320:-2,select='gt(scene,${th})',showinfo`, '-f', 'null', '-']);
    for (const m of r.err.matchAll(/pts_time:([\d.]+)/g)) {
      const t = +m[1];
      if (t - starts[starts.length - 1] >= MIN_SHOT) starts.push(t);
    }
  }
  return starts.map((s, i) => ({ start: s, end: i + 1 < starts.length ? starts[i + 1] : Math.max(s + 0.1, dur) }));
}
async function duration(job, ffmpeg, video) {
  const r = await job.run(ffmpeg, ['-hide_banner', '-i', video]);
  const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(r.err);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0;
}

async function grabVideo(job, t, url, outRoot, o) {
  const site = siteOf(url);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs3-grab-'));
  job.emit(`▶ ${url}`);
  const args = ['--no-playlist', '--no-part', '--no-mtime', '--newline', '--restrict-filenames',
    '-f', VIDEO_FORMAT, '--merge-output-format', 'mp4', '--ffmpeg-location', path.dirname(t.ffmpeg),
    '-o', path.join(tmp, 'video.%(ext)s'),
    '--print', 'before_dl:@@T %(title)s', '--print', 'after_move:@@F %(filepath)s', '--no-simulate'];
  if (o.cookies && o.cookies !== 'none') args.push('--cookies-from-browser', o.cookies);
  else if (isSocial(url)) {
    /* v4: the sign-in made in the app's own window (grab-browser.js) */
    const jar = await Browser.cookieFile(url, tmp).catch(() => null);
    if (jar) args.push('--cookies', jar);
  }
  args.push(url);
  let title = '', file = '', last = 0;
  const r = await job.run(t.ytdlp, args, l => {
    if (l.startsWith('@@T ')) title = l.slice(4).trim();
    else if (l.startsWith('@@F ')) file = l.slice(4).trim();
    else if (/\[download\]\s+[\d.]+%/.test(l)) { const now = Date.now(); if (now - last > 1500) { last = now; job.emit('  ' + l.replace(/^\[download\]\s*/, 'downloading ')); } }
    else if (/^ERROR|WARNING: .*(sign in|login|cookies|private)/i.test(l)) job.emit('  ' + l);
  });
  if (!file || !fs.existsSync(file)) {
    const any = fs.readdirSync(tmp).find(f => /\.(mp4|webm|mkv|mov)$/i.test(f));
    if (any) file = path.join(tmp, any);
  }
  if (job.stopped) return 0;
  if (r.code !== 0 || !file) {
    const why = (r.err.match(/ERROR:.*$/m) || [''])[0];
    job.emit(`  ✗ Couldn't download it${why ? ': ' + why.replace(/^ERROR:\s*/, '') : ''}`);
    if (/no video|there is no video/i.test(r.err) && isSocial(url) && Browser.available()) {
      /* a photo post or carousel: take its pictures the way a page is taken */
      job.emit('  a photo post — taking its pictures instead');
      const g = await Browser.grabPage(job, url, outRoot, o, { safeName, siteOf, pad, writeManifest }).catch(() => null);
      return g ? g.n : 0;
    }
    if (/sign in|login|cookies|rate.?limit|private/i.test(r.err)) job.emit('  Tip: this site wants you signed in. Scan the profile once with Find links and sign in in the window that opens — or pick a browser under settings.');
    return 0;
  }
  const page = safeName(title) || safeName(new URL(url).pathname.split('/').filter(Boolean).pop()) || 'video';
  const dir = path.join(outRoot, safeName(site), page);
  for (const k of ['gifs', 'images', 'videos']) fs.mkdirSync(path.join(dir, k), { recursive: true });
  job.emit(`  ✓ downloaded “${title || page}” — finding the cuts…`);

  const shots = (await cutTimes(job, t.ffmpeg, file, o)).slice(0, Math.max(1, o.ytMax | 0 || 200));
  if (job.stopped) return 0;
  job.emit(`  ${shots.length} shot${shots.length === 1 ? '' : 's'}`);
  const items = [];
  const what = o.ytWhat || 'both';
  const gifSecs = Math.max(1, Math.min(15, +o.gifSecs || 3));
  const gifMax = Math.max(1, o.gifMax | 0 || 200);
  let gifs = 0, stills = 0;
  for (let i = 0; i < shots.length && !job.stopped; i++) {
    const s = shots[i], len = s.end - s.start;
    const label = `Shot ${i + 1} · ${stamp(s.start)}`;
    if (what !== 'gifs') {
      const name = `still-${pad(i + 1)}.jpg`;
      const at = s.start + Math.min(len / 2, 1.0);
      const r2 = await job.run(t.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', at.toFixed(2), '-i', file,
        '-frames:v', '1', '-vf', `scale='min(${STILL_W},iw)':-2`, '-q:v', '3', path.join(dir, 'images', name)]);
      if (r2.code === 0) { stills++; items.push({ file: 'images/' + name, label, link: url, order: i * 2 }); }
    }
    if (what !== 'stills' && gifs < gifMax && len >= MIN_SHOT) {
      const name = `gif-${pad(i + 1)}.gif`;
      const d = o.gifMode === 'span' ? gifSecs : Math.min(gifSecs, len);
      const r3 = await job.run(t.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', s.start.toFixed(2), '-t', d.toFixed(2), '-i', file,
        '-filter_complex', `fps=${GIF_FPS},scale='min(${GIF_W},iw)':-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=${GIF_COLOURS}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
        '-loop', '0', path.join(dir, 'gifs', name)]);
      if (r3.code === 0) { gifs++; items.push({ file: 'gifs/' + name, label, link: url, order: i * 2 + 1 }); }
    }
    if ((i + 1) % 10 === 0) job.emit(`  … ${i + 1} of ${shots.length} shots`);
  }
  if (o.keepVideo && !job.stopped) {
    const name = 'video.mp4';
    try { fs.copyFileSync(file, path.join(dir, 'videos', name)); items.push({ file: 'videos/' + name, label: 'Whole video', link: url, order: -1 }); } catch (e) { /* skip */ }
  }
  for (const k of ['gifs', 'images', 'videos']) { try { if (!fs.readdirSync(path.join(dir, k)).length) fs.rmdirSync(path.join(dir, k)); } catch (e) {} }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  writeManifest(dir, { site: safeName(site), page, title, source: url, grabbedAt: new Date().toISOString(), items });
  job.emit(`  ✓ ${stills} still${stills === 1 ? '' : 's'}, ${gifs} GIF${gifs === 1 ? '' : 's'}${o.keepVideo ? ', the video' : ''} → ${dir}`);
  return items.length;
}

/* ---------------------------------------------------------------- pages */
async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' }, redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return { html: await r.text(), url: r.url || url };
}
const decode = s => String(s).replace(/&amp;/g, '&').replace(/&#x2F;/gi, '/').replace(/&#47;/g, '/').replace(/&quot;/g, '"');
function mediaOn(html, base) {
  const out = new Map();
  const add = (u, kind) => {
    if (!u || /^data:|^blob:|^javascript:/i.test(u)) return;
    let abs; try { abs = new URL(decode(u.trim()), base).href; } catch (e) { return; }
    const k = kind || kindOfUrl(abs);
    if (k && !out.has(abs)) out.set(abs, k);
  };
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = /\s(?:data-src|data-original|src)\s*=\s*["']([^"']+)["']/i.exec(tag);
    const set = /\ssrcset\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (set) {
      /* the widest picture in the set */
      const best = set[1].split(',').map(x => x.trim().split(/\s+/)).sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0))[0];
      if (best) add(best[0], kindOfUrl(best[0]) || 'image');
    } else if (src) add(src[1], kindOfUrl(src[1]) || 'image');
  }
  for (const m of html.matchAll(/<(?:video|source)\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)) add(m[1], kindOfUrl(m[1]) || 'video');
  for (const m of html.matchAll(/<meta\b[^>]*(?:og:image|og:video|twitter:image)[^>]*content\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/<a\b[^>]*\shref\s*=\s*["']([^"']+\.(?:gif|mp4|webm|jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)) add(m[1]);
  return [...out.entries()].map(([url, kind]) => ({ url, kind }));
}
function linksOn(html, base) {
  const out = new Map();
  for (const m of html.matchAll(/<a\b[^>]*\shref\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u; try { u = new URL(decode(m[1]), base); } catch (e) { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const txt = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!out.has(u.href)) out.set(u.href, txt);
  }
  return [...out.entries()].map(([url, title]) => ({ url, title }));
}
const titleOf = html => decode(((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '').replace(/\s+/g, ' ').trim());

async function download(url, file, referer) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': referer || url }, redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const len = +r.headers.get('content-length') || 0;
  if (len > MAX_FILE_BYTES) throw new Error('too big');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 2048) throw new Error('too small');
  fs.writeFileSync(file, buf);
  return { type: r.headers.get('content-type') || '', bytes: buf.length };
}

async function grabPage(job, t, url, outRoot, o) {
  job.emit(`▶ ${url}`);
  /* inside the app: read the page in a real browser window (scripts, lazy
     pictures, infinite scroll, Cloudflare's check, popups with bigger GIFs) */
  if (Browser.available()) {
    const r = await Browser.grabPage(job, url, outRoot, o, { safeName, siteOf, pad, writeManifest });
    if (r && r.n === 0 && t.ytdlp && t.ffmpeg && !job.stopped) { job.emit('  no pictures on the page itself — trying it as a video'); return grabVideo(job, t, url, outRoot, o); }
    if (r && o.follow && !job.stopped) {
      const host = siteOf(r.url || url);
      const more = [...new Set(r.links.map(l => l.url.split('#')[0]))].filter(u => siteOf(u) === host && u !== (r.url || url) && !kindOfUrl(u)).slice(0, Math.max(1, o.maxPages | 0 || 20));
      job.emit(`  following ${more.length} page${more.length === 1 ? '' : 's'} on ${host}`);
      let n = r.n;
      for (const u of more) { if (job.stopped) break; n += await grabPage(job, t, u, outRoot, { ...o, follow: false }); }
      return n;
    }
    return r ? r.n : 0;
  }
  let page;
  try { page = await fetchText(url); } catch (e) { job.emit(`  ✗ Couldn't open the page: ${e.message}`); return 0; }
  const title = titleOf(page.html);
  const media = mediaOn(page.html, page.url).slice(0, MAX_PAGE_FILES);
  if (!media.length) {
    if (t.ytdlp && t.ffmpeg) { job.emit('  no pictures on the page itself — trying it as a video'); return grabVideo(job, t, url, outRoot, o); }
    job.emit('  ✗ No pictures, GIFs or clips found on that page'); return 0;
  }
  const site = siteOf(page.url);
  const pname = safeName(title) || safeName(new URL(page.url).pathname.split('/').filter(Boolean).pop()) || 'page';
  const dir = path.join(outRoot, safeName(site), pname);
  const items = [];
  const counts = { gif: 0, video: 0, image: 0 };
  for (let i = 0; i < media.length && !job.stopped; i++) {
    const m = media[i];
    const sub = m.kind === 'gif' ? 'gifs' : m.kind === 'video' ? 'videos' : 'images';
    let ext = (/\.([a-z0-9]{2,5})(?:$|\?)/i.exec(new URL(m.url).pathname) || [])[1] || (m.kind === 'gif' ? 'gif' : m.kind === 'video' ? 'mp4' : 'jpg');
    ext = ext.toLowerCase();
    const name = `${pad(i + 1)}-${safeName(path.basename(new URL(m.url).pathname, '.' + ext)).slice(0, 40) || m.kind}.${ext}`;
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
    try {
      await download(m.url, path.join(dir, sub, name), page.url);
      counts[m.kind]++;
      items.push({ file: sub + '/' + name, label: '', link: m.url, order: i });
    } catch (e) { /* skipped: icons, broken, too big */ }
  }
  if (!items.length) { job.emit('  ✗ Nothing on that page could be downloaded'); return 0; }
  writeManifest(dir, { site: safeName(site), page: pname, title, source: page.url, grabbedAt: new Date().toISOString(), items });
  job.emit(`  ✓ ${counts.gif} GIFs, ${counts.video} clips, ${counts.image} pictures → ${dir}`);
  if (o.follow) {
    const host = siteOf(page.url);
    const more = linksOn(page.html, page.url).filter(l => siteOf(l.url) === host && l.url !== page.url).slice(0, Math.max(1, o.maxPages | 0 || 20));
    job.emit(`  following ${more.length} page${more.length === 1 ? '' : 's'} on ${host}`);
    for (const l of more) { if (job.stopped) break; await grabPage(job, t, l.url, outRoot, { ...o, follow: false }); }
  }
  return items.length;
}

/* ---------------------------------------------------------------- entry points */
async function grab(job, t, links, outRoot, o) {
  let n = 0, ok = 0;
  for (const url of links) {
    if (job.stopped) break;
    const got = (isVideoLink(url) || kindOfUrl(url) === 'video') && t.ytdlp && t.ffmpeg
      ? await grabVideo(job, t, url, outRoot, o)
      : await grabPage(job, t, url, outRoot, o);
    if (got) ok++;
    n += got;
  }
  job.emit(`Done: ${n} file${n === 1 ? '' : 's'} from ${ok} of ${links.length} link${links.length === 1 ? '' : 's'}.`);
  return ok ? 0 : 1;
}

async function scan(job, t, url, max, link) {
  job.emit(`Looking for links on ${url}…`);
  /* v4: a profile on Instagram, TikTok, X… — yt-dlp can't list those, and a
     plain look at the page signed out sees only its login wall. Open it in
     the app's window (signing in once if asked), scroll, keep posts and reels. */
  if (isSocial(url) && !postLink(url) && Browser.available()) {
    const list = await Browser.postLinks(job, url, postLink, max);
    if (!list) { job.emit('✗ The page couldn’t be opened'); return 1; }
    for (const l of list) link({ url: l.url, title: l.title || l.url.replace(/^https:\/\/(www\.)?/, ''), kind: l.kind });
    job.emit(list.length ? `${list.length} post${list.length === 1 ? '' : 's'} and reel${list.length === 1 ? '' : 's'} found`
      : 'No posts found — is the profile private, or did the sign-in not finish?');
    return list.length ? 0 : 1;
  }
  if (isVideoLink(url) && t.ytdlp) {
    let n = 0;
    await job.run(t.ytdlp, ['--flat-playlist', '--playlist-end', String(max), '--print', '@@L %(url)s\t%(title)s', url], l => {
      if (!l.startsWith('@@L ')) return;
      const [u, title] = l.slice(4).split('\t');
      if (/^https?:/.test(u)) { n++; link({ url: u, title: title && title !== 'NA' ? title : u, kind: 'video' }); }
    });
    if (n) { job.emit(`${n} video link${n === 1 ? '' : 's'} found`); return 0; }
  }
  if (Browser.available()) {
    const p = await Browser.pageLinks(job, url);
    if (!p) { job.emit('✗ The page couldn’t be opened'); return 1; }
    const host = siteOf(p.url || url);
    const seen = new Set();
    let n = 0;
    for (const it of p.items) {
      const u = it.src;
      if (n >= max || !u || seen.has(u) || !(kindOfUrl(u) === 'gif' || kindOfUrl(u) === 'video' || /\.webp(\?|$)/i.test(u))) continue;
      seen.add(u); n++; link({ url: u, title: it.title || u.split('/').pop(), kind: kindOfUrl(u) || 'gif' });
    }
    for (const l of p.links) {
      const u = l.url.split('#')[0];
      if (n >= max || seen.has(u) || !(siteOf(u) === host || isVideoLink(u))) continue;
      /* on a social site, its own links (Log In, Sign Up, Explore) aren't videos */
      const post = isSocial(u) ? postLink(u) : null;
      if (isSocial(u) && !post) continue;
      seen.add(u); n++; link({ url: post ? post.url : u, title: l.title || u, kind: post ? post.kind : (isVideoLink(u) ? 'video' : 'page') });
    }
    job.emit(`${n} link${n === 1 ? '' : 's'} found`);
    return 0;
  }
  try {
    const p = await fetchText(url);
    const host = siteOf(p.url);
    const media = mediaOn(p.html, p.url).filter(m => m.kind !== 'image');
    const pages = linksOn(p.html, p.url).filter(l => siteOf(l.url) === host || isVideoLink(l.url));
    let n = 0;
    for (const m of media) { if (n >= max) break; n++; link({ url: m.url, title: m.url.split('/').pop(), kind: m.kind }); }
    for (const l of pages) { if (n >= max) break; n++; link({ url: l.url, title: l.title || l.url, kind: isVideoLink(l.url) ? 'video' : 'page' }); }
    job.emit(`${n} link${n === 1 ? '' : 's'} found`);
    return 0;
  } catch (e) { job.emit('✗ ' + e.message); return 1; }
}

/* install yt-dlp (winget brings ffmpeg with it) */
async function setup(job, t) {
  if (process.platform !== 'win32') { job.emit('Install yt-dlp and ffmpeg with your package manager (brew install yt-dlp ffmpeg), then press Check again.'); return 1; }
  if (!t.winget) { job.emit('winget (App Installer) isn\'t on this PC. Install “App Installer” from the Microsoft Store, or get yt-dlp from github.com/yt-dlp/yt-dlp and ffmpeg from ffmpeg.org.'); return 1; }
  const steps = [];
  if (!t.ytdlp) steps.push('yt-dlp.yt-dlp');
  if (!t.ffmpeg) steps.push('yt-dlp.FFmpeg');
  let code = 0;
  for (const id of steps) {
    job.emit(`Installing ${id} with winget…`);
    const r = await job.run(t.winget, ['install', '-e', '--id', id, '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity'], l => {
      if (/[a-z]/i.test(l) && !/^[\s\-\\|/█▒]+$/.test(l)) job.emit('  ' + l.trim());
    });
    if (r.code !== 0) code = r.code;
  }
  return code;
}

module.exports = { tools, grab, scan, setup, makeJob, isVideoLink, isSocial, postLink, mediaOn, cutTimes, SCENE, GIF_FPS, GIF_W, MIN_SHOT };
