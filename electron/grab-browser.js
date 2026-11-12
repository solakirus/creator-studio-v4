/* Creator Studio 3 — grabbing a page the way a person sees it.

   Many sites build their pages with scripts, load pictures only as you
   scroll, keep loading more at the bottom, and sit behind Cloudflare's
   "Just a moment…" check, so a plain download sees an empty page. Shot
   Library's old grabber drove a real Chrome window for this; here the app's
   own browser (Electron) does it:

   1. open the page in a window of its own (a saved profile, so a passed check
      is remembered); if the site asks "verify you are human", the window
      shows itself so the person can tick the box;
   2. scroll to the bottom until nothing new loads (lazy pictures, infinite
      scroll), up to SCROLL_MAX times;
   3. collect every GIF, clip and picture: what the page shows (img/srcset/
      data-src, video/source, background images) and every picture or video
      the browser downloaded meanwhile;
   4. a thumbnail that opens a popup or a detail page (hx-get, data-url, a
      link around it) is followed to find its bigger GIF or clip;
   5. download with the window's own cookies, so the files come too.

   Each thumbnail becomes one Library item named after its title, with its
   bigger GIF (when there is one) and a link to it. Numbers in MECHANICS.md
   ("Grabbing pages in a browser"). */
const path = require('path');
const fs = require('fs');

let E = null;
try { const e = require('electron'); if (e && typeof e === 'object' && e.BrowserWindow) E = e; } catch (err) { /* plain node: no browser */ }

const PARTITION = 'persist:cs3-grab';
const CHECK_WAIT_MS = 20000;      /* how long the check may solve itself before the window shows */
const HUMAN_WAIT_MS = 180000;     /* how long the person has to tick it */
const SCROLL_MAX = 40, SCROLL_PAUSE_MS = 1300;
const MIN_SIDE = 120;             /* smaller pictures are icons and logos */
const BIG_MAX = 400;              /* most popups opened per page */
const MAX_FILES = 600, MAX_BYTES = 200 * 1024 * 1024;
const EXTRA_MIN_BYTES = 20 * 1024;  /* smaller "extra" GIFs are blur-up placeholders */

const SIGNIN_WAIT_MS = 300000;   /* how long the person has to sign in */

const wait = ms => new Promise(r => setTimeout(r, ms));
/* v4: sites that only show their posts to someone signed in. Signed out,
   Instagram shows a login wall whose links (Log In, Sign Up, followers) are
   all the page has — the person signs in once in the app's own window, and
   the saved profile (PARTITION) remembers it for scans and downloads. */
const SIGNIN_SITES = /(^|\.)(instagram\.com|tiktok\.com|facebook\.com|x\.com|twitter\.com|threads\.net)$/i;
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\.|^m\./, ''); } catch (e) { return ''; } };
const siteName = u => ({ 'instagram.com':'Instagram', 'tiktok.com':'TikTok', 'facebook.com':'Facebook', 'x.com':'X', 'twitter.com':'X', 'threads.net':'Threads' })[hostOf(u)] || hostOf(u);
/* true while the page is a sign-in wall: a login address, a password box, or
   a sign-in dialog over the page */
const WALLED = `(() => {
  if (/\\/(accounts\\/login|login|signin|i\\/flow\\/login)/i.test(location.pathname)) return true;
  const vis = el => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  if ([...document.querySelectorAll('input[type=password]')].some(vis)) return true;
  return [...document.querySelectorAll('[role=dialog]')].some(d => vis(d) && /(log ?in|sign ?in|sign up)/i.test(d.textContent || '') && d.querySelector('a[href*="login"],button,input'));
})()`;
const challenged = t => /just a moment|attention required|verify you are human|checking your browser/i.test(t || '');
const kindOf = u => {
  const e = ((/\.([a-z0-9]{2,5})(?:$|[?#])/i.exec(String(u).split('#')[0]) || [])[1] || '').toLowerCase();
  if (e === 'gif') return 'gif';
  if (['mp4', 'webm', 'mov', 'm4v'].includes(e)) return 'video';
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'jfif'].includes(e)) return 'image';
  return null;
};
/* the bigger of two candidates: GIF over clip over picture; a cached/resized
   copy ("CACHE", "thumb", "small") loses to the original */
const rank = u => {
  const k = kindOf(u);
  let r = k === 'gif' ? 30 : k === 'video' ? 20 : k === 'image' ? 10 : 0;
  if (/thumb|small|preview|poster|_s\.|-s\./i.test(u)) r -= 5;
  return r;
};

function available() { return !!(E && E.app && E.app.isReady && E.app.isReady()); }

function session() {
  const ses = E.session.fromPartition(PARTITION);
  /* look like the Chrome it is, without the app's own name in it */
  const ua = ses.getUserAgent().replace(/\s(Electron|creator-studio-[\w-]+|Creator ?Studio ?v?\d)\/\S+/gi, '');
  ses.setUserAgent(ua);
  return ses;
}

function makeWindow(ses) {
  return new E.BrowserWindow({
    show: false, width: 1440, height: 1000, title: 'Grabbing…',
    autoHideMenuBar: true,
    webPreferences: { session: ses, contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false }
  });
}

/* load a page and get past the "Just a moment…" check, with the person's help if needed */
async function open(win, url, job) {
  try { await win.loadURL(url); } catch (e) { /* a redirect or the check aborts the first load: fine */ }
  const title = () => { try { return win.webContents.getTitle(); } catch (e) { return ''; } };
  let t0 = Date.now();
  while (challenged(title()) && Date.now() - t0 < CHECK_WAIT_MS && !job.stopped) await wait(500);
  if (challenged(title())) {
    job.emit('  The site wants a quick check — tick “Verify you are human” in the window that just opened.');
    win.show(); win.focus();
    t0 = Date.now();
    while (challenged(title()) && Date.now() - t0 < HUMAN_WAIT_MS && !job.stopped) await wait(700);
    win.hide();
    if (challenged(title())) return false;
    job.emit('  ✓ check passed — the app remembers it for next time');
  }
  await wait(1500);
  if (SIGNIN_SITES.test(hostOf(url)) && await signIn(win, url, job) === false) return false;
  return true;
}

const isWalled = async win => { try { return !!(await win.webContents.executeJavaScript(WALLED)); } catch (e) { return false; } };

/* A sign-in wall: show the window so the person can sign in, wait, then go
   back to the page they asked for. Once is enough — the profile keeps it. */
async function signIn(win, url, job) {
  await wait(1200);
  if (!(await isWalled(win))) return true;
  const name = siteName(url);
  job.emit(`  ${name} wants you signed in. Sign in once in the window that just opened — the app remembers it after that.`);
  try { win.setTitle(`Sign in to ${name} — then this closes by itself`); } catch (e) {}
  win.show(); win.focus();
  const t0 = Date.now();
  let left = 0;
  while (Date.now() - t0 < SIGNIN_WAIT_MS && !job.stopped) {
    await wait(1500);
    if (!(await isWalled(win))) { if (++left >= 2) break; } else left = 0;
  }
  if (await isWalled(win)) { win.hide(); job.emit(`  ✗ Not signed in to ${name}, so its posts can't be seen.`); return false; }
  job.emit(`  ✓ signed in to ${name} — the app remembers it`);
  try { await win.loadURL(url); } catch (e) {}
  win.hide();
  await wait(2500);
  return true;
}

/* the post and reel links on a profile, gathered while scrolling: these grids
   drop rows as they scroll, so one look at the end would miss most of them */
const POSTS = `(() => [...document.querySelectorAll('a[href]')].map(a => {
  let u = ''; try { u = new URL(a.getAttribute('href'), location.href).href; } catch (e) {}
  const im = a.querySelector('img');
  return { url: u, title: ((im && im.getAttribute('alt')) || a.getAttribute('aria-label') || a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120) };
}).filter(l => /^https?:/.test(l.url)))()`;
async function postLinks(job, url, keep, max) {
  const ses = session();
  const win = makeWindow(ses);
  try {
    if (!(await open(win, url, job))) return null;
    const found = new Map();
    let last = 0, same = 0;
    for (let i = 0; i < SCROLL_MAX * 2 && !job.stopped && found.size < max; i++) {
      let links = [];
      try { links = await win.webContents.executeJavaScript(POSTS); } catch (e) { break; }
      for (const l of links) { const k = keep(l.url); if (k && !found.has(k.url)) found.set(k.url, { ...k, title: k.title || l.title }); }
      if (i % 5 === 4) job.emit(`  ${found.size} found so far…`);
      let h = 0;
      try { h = await win.webContents.executeJavaScript('window.scrollBy(0, Math.round(innerHeight * 0.9)); Math.round(scrollY + innerHeight) + "/" + document.documentElement.scrollHeight'); } catch (e) { break; }
      await wait(SCROLL_PAUSE_MS);
      const [at, total] = String(h).split('/').map(Number);
      const n = found.size;
      if (at >= total - 4 && n === last) { if (++same >= 3) break; } else same = 0;
      last = n;
    }
    return [...found.values()].slice(0, max);
  } catch (e) { return null; } finally { try { win.destroy(); } catch (e) {} }
}

/* the app window's own sign-in for a site, as a cookies.txt yt-dlp can read,
   so a reel the person can see signed in also downloads. null when there are none. */
async function cookieFile(url, dir) {
  if (!available()) return null;
  const host = hostOf(url);
  if (!host) return null;
  let list = [];
  try { list = await session().cookies.get({ domain: host }); } catch (e) { return null; }
  if (!list.length) return null;
  const lines = ['# Netscape HTTP Cookie File'];
  for (const c of list) {
    const dom = c.domain.startsWith('.') || !c.hostOnly ? (c.domain.startsWith('.') ? c.domain : '.' + c.domain) : c.domain;
    lines.push([dom, dom.startsWith('.') ? 'TRUE' : 'FALSE', c.path || '/', c.secure ? 'TRUE' : 'FALSE',
      Math.floor(c.expirationDate || 0), c.name, c.value].join('\t'));
  }
  const file = path.join(dir, 'cookies.txt');
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

const COLLECT = `(() => {
  const abs = u => { try { return new URL(u, location.href).href; } catch (e) { return ''; } };
  const best = set => (set || '').split(',').map(s => s.trim().split(/\\s+/)).filter(x => x[0])
    .sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0)).map(x => abs(x[0]))[0] || '';
  const out = [];
  const popupOf = el => {
    for (let n = el, i = 0; n && i < 4; n = n.parentElement, i++) {
      const g = n.getAttribute && (n.getAttribute('hx-get') || n.getAttribute('data-url') || n.getAttribute('data-href') || n.getAttribute('data-full') || n.getAttribute('data-gif') || n.getAttribute('data-original'));
      if (g) return abs(g);
      if (n.tagName === 'A' && n.getAttribute('href') && !/^(#|javascript:)/i.test(n.getAttribute('href'))) return abs(n.getAttribute('href'));
    }
    return '';
  };
  document.querySelectorAll('img').forEach(im => {
    const w = im.naturalWidth || im.width || +im.getAttribute('width') || 0;
    const h = im.naturalHeight || im.height || +im.getAttribute('height') || 0;
    const src = abs(im.getAttribute('data-src') || im.getAttribute('data-lazy-src') || '') || im.currentSrc || abs(im.getAttribute('src') || '');
    out.push({ src, set: best(im.getAttribute('srcset') || im.getAttribute('data-srcset')), w, h,
      title: (im.getAttribute('title') || im.getAttribute('alt') || '').trim(), popup: popupOf(im), tag: 'img' });
  });
  document.querySelectorAll('video').forEach(v => {
    const s = v.currentSrc || abs(v.getAttribute('src') || '') || [...v.querySelectorAll('source')].map(x => abs(x.getAttribute('src') || ''))[0] || '';
    out.push({ src: s, w: v.videoWidth || v.clientWidth, h: v.videoHeight || v.clientHeight, title: v.getAttribute('title') || '', popup: popupOf(v), poster: abs(v.getAttribute('poster') || ''), tag: 'video' });
  });
  document.querySelectorAll('[style*="background"]').forEach(el => {
    const m = /url\\(["']?([^"')]+)["']?\\)/.exec(el.getAttribute('style') || '');
    if (m && el.clientWidth >= ${MIN_SIDE} && el.clientHeight >= ${MIN_SIDE}) out.push({ src: abs(m[1]), w: el.clientWidth, h: el.clientHeight, title: el.getAttribute('title') || el.getAttribute('aria-label') || '', popup: popupOf(el), tag: 'bg' });
  });
  document.querySelectorAll('a[href]').forEach(a => {
    const u = abs(a.getAttribute('href'));
    if (/\\.(gif|mp4|webm|mov)(\\?|$)/i.test(u)) out.push({ src: u, w: 999, h: 999, title: (a.textContent || '').trim().slice(0, 120), popup: '', tag: 'a' });
  });
  const links = [...document.querySelectorAll('a[href]')].map(a => ({ url: abs(a.getAttribute('href')), title: (a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120) }))
    .filter(l => /^https?:/.test(l.url));
  return { title: document.title, url: location.href, items: out, links };
})()`;

/* scroll until the page stops growing (lazy pictures, infinite scroll) */
async function scrollAll(win, job) {
  let last = 0, same = 0;
  for (let i = 0; i < SCROLL_MAX && !job.stopped; i++) {
    let h = 0;
    try { h = await win.webContents.executeJavaScript('window.scrollTo(0, document.documentElement.scrollHeight); document.documentElement.scrollHeight'); } catch (e) { break; }
    await wait(SCROLL_PAUSE_MS);
    if (h <= last) { if (++same >= 2) break; } else { same = 0; last = h; }
  }
  try { await win.webContents.executeJavaScript('window.scrollTo(0, 0)'); } catch (e) {}
  await wait(600);
}

/* the media named in a popup or detail page's HTML */
function mediaIn(html, base) {
  const found = new Set();
  const add = u => { try { const a = new URL(u.replace(/&amp;/g, '&'), base).href; if (kindOf(a)) found.add(a); } catch (e) {} };
  for (const m of html.matchAll(/(?:src|data-src|href|data-gif|data-full|poster|content)\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/https?:\/\/[^"'\s<>)]+?\.(?:gif|mp4|webm|webp|jpe?g|png)(?:\?[^"'\s<>)]*)?/gi)) add(m[0]);
  return [...found];
}

/* A download link often carries the real file's address inside it, base64
   encoded (eyecannndy: /downloads/<base64 of …_1080p_….gif>/<name>/). */
function decodedIn(href, base) {
  let u; try { u = new URL(href.replace(/&amp;/g, '&'), base); } catch (e) { return ''; }
  for (const seg of u.pathname.split('/')) {
    if (seg.length < 16 || !/^[A-Za-z0-9_\-+=%]+$/.test(seg)) continue;
    try {
      const s = Buffer.from(decodeURIComponent(seg).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      if (/^https?:\/\/\S+$/.test(s) && kindOf(s)) return s;
    } catch (e) { /* not base64 */ }
  }
  return kindOf(u.href) ? u.href : '';
}
const textOf = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/* what a thumbnail's popup or detail page says: its bigger GIF or clip, and
   the clip's title, credits, original source and tags */
async function bigFor(win, popupWin, popup, thumb, job) {
  const none = { big: '' };
  if (!popup || popup === thumb) return none;
  let html = '';
  /* first as the page itself would ask (htmx sends HX-Request), with its cookies */
  try {
    html = await win.webContents.executeJavaScript(`fetch(${JSON.stringify(popup)}, { credentials: 'include', headers: { 'HX-Request': 'true' } })
      .then(r => r.ok ? r.text() : '').catch(() => '')`);
  } catch (e) { html = ''; }
  /* if the check stops that, open it as a page */
  if (!html || challenged(html.slice(0, 2000))) {
    try {
      await popupWin.loadURL(popup);
      const t0 = Date.now();
      while (challenged(popupWin.webContents.getTitle()) && Date.now() - t0 < 8000) await wait(400);
      html = await popupWin.webContents.executeJavaScript('document.documentElement.outerHTML');
    } catch (e) { html = ''; }
  }
  if (!html || challenged(html.slice(0, 2000))) return none;
  const info = {};
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1) info.title = textOf(h1[1]);
  const credits = [];
  for (const m of html.matchAll(/<li[^>]*>\s*([A-Za-z][A-Za-z ]{1,30}?)\s*-\s*<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const k = textOf(m[1]), v = textOf(m[3]);
    if (/original source|source/i.test(k)) { try { info.source = new URL(m[2], popup).href; } catch (e) {} }
    else if (k && v) credits.push(`${k}: ${v}`);
  }
  if (credits.length) info.credits = credits.join(' · ');
  const tags = [...html.matchAll(/href\s*=\s*["'][^"']*\/search\/\?q=([^"'&]+)["']/gi)].map(m => decodeURIComponent(m[1]).trim()).filter(Boolean);
  if (tags.length) info.tags = [...new Set(tags)].filter(x => !(info.title || '').startsWith(x)).slice(0, 20);
  /* 1. a download link with the file inside it; 2. the biggest other GIF or clip named */
  const downloads = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']*download[^"']*)["']/gi)].map(m => decodedIn(m[1], popup)).filter(Boolean);
  downloads.sort((a, b) => rank(b) - rank(a));
  if (downloads[0]) return { big: downloads[0], ...info };
  const cands = mediaIn(html, popup).filter(u => u !== thumb && !/spinner|loading|logo|icon|avatar|favicon/i.test(u));
  cands.sort((a, b) => rank(b) - rank(a));
  return { big: cands[0] || '', ...info };
}
async function download(ses, url, file, referer) {
  const doFetch = ses.fetch ? (u, i) => ses.fetch(u, i) : (u, i) => E.net.fetch(u, { ...i, session: ses });
  const r = await doFetch(url, { referrer: referer, credentials: 'include' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const len = +r.headers.get('content-length') || 0;
  if (len > MAX_BYTES) throw new Error('too big');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 1024) throw new Error('too small');
  fs.writeFileSync(file, buf);
  return buf.length;
}

/* grab one page; returns { n, links } or null when the page couldn't be opened */
async function grabPage(job, url, outRoot, o, h) {
  const ses = session();
  const seen = new Map();   /* url -> mime, everything the browser loaded */
  ses.webRequest.onCompleted({ urls: ['http://*/*', 'https://*/*'] }, d => {
    const ct = ((d.responseHeaders || {})['content-type'] || (d.responseHeaders || {})['Content-Type'] || [''])[0] || '';
    if (d.statusCode === 200 && (/^(image\/gif|video\/|image\/webp)/i.test(ct) || /\.(gif|mp4|webm)(\?|$)/i.test(d.url))) seen.set(d.url, ct);
  });
  const win = makeWindow(ses), popupWin = makeWindow(ses);
  try {
    if (!(await open(win, url, job))) { job.emit('  ✗ The site’s check wasn’t passed, so the page couldn’t be read'); return null; }
    job.emit('  scrolling the page so everything loads…');
    await scrollAll(win, job);
    const page = await win.webContents.executeJavaScript(COLLECT);
    const pageUrl = page.url || url;

    /* one entry per thumbnail: drop icons, keep the first of repeats */
    const items = [], have = new Set();
    for (const it of page.items) {
      const src = it.set && rank(it.set) >= rank(it.src) ? it.set : it.src;
      if (!src || !/^https?:/.test(src) || have.has(src)) continue;
      if (it.tag !== 'a' && it.w && it.h && (it.w < MIN_SIDE || it.h < MIN_SIDE)) continue;
      if (/spinner|loading\.gif|logo|favicon|avatar|sprite|pixel/i.test(src)) continue;
      if (!kindOf(src) && it.tag !== 'video') continue;
      have.add(src);
      items.push({ src, title: it.title, popup: it.popup && it.popup !== pageUrl && !kindOf(it.popup) ? it.popup : '', direct: kindOf(it.popup) ? it.popup : '' });
    }
    /* GIFs and clips the browser loaded that no thumbnail names (opened popups, hover previews) */
    const extra = [...seen.keys()].filter(u => !have.has(u) && !/spinner|loading|logo|favicon/i.test(u));

    const gifsOnPage = items.filter(i => kindOf(i.src) === 'gif' || /\.webp(\?|$)/i.test(i.src)).length;
    job.emit(`  found ${items.length} thumbnails (${gifsOnPage} GIFs or moving pictures)${extra.length ? ` and ${extra.length} more GIFs/clips the page loaded` : ''}`);

    const site = h.safeName(h.siteOf(pageUrl));
    const pname = h.safeName(page.title) || h.safeName(new URL(pageUrl).pathname.split('/').filter(Boolean).pop()) || 'page';
    const dir = path.join(outRoot, site, pname);
    const out = [];
    const counts = { gif: 0, video: 0, image: 0, big: 0, linked: 0 };
    let bigTried = 0;
    /* an animated WebP is a GIF in all but name: it goes with the GIFs */
    const movingWebp = file => {
      try {
        const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(4096); const n = fs.readSync(fd, b, 0, 4096, 0); fs.closeSync(fd);
        if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return false;
        return (b.toString('latin1', 12, 16) === 'VP8X' && (b[20] & 0x02) !== 0) || b.slice(0, n).includes(Buffer.from('ANIM'));
      } catch (e) { return false; }
    };
    const saveOne = async (u, i, label, minBytes) => {
      let k = kindOf(u) || (/video/.test(seen.get(u) || '') ? 'video' : /gif/.test(seen.get(u) || '') ? 'gif' : 'image');
      const ext = ((/\.([a-z0-9]{2,5})(?:$|\?)/i.exec(new URL(u).pathname) || [])[1] || (k === 'gif' ? 'gif' : k === 'video' ? 'mp4' : 'jpg')).toLowerCase();
      const base = h.safeName(label).slice(0, 50) || h.safeName(path.basename(new URL(u).pathname, '.' + ext)).slice(0, 40) || k;
      const name = `${h.pad(i + 1)}-${base}.${ext}`;
      const tmp = path.join(dir, '.part-' + name);
      fs.mkdirSync(dir, { recursive: true });
      const bytes = await download(ses, u, tmp, pageUrl);
      if (minBytes && bytes < minBytes) { try { fs.unlinkSync(tmp); } catch (e) {} throw new Error('placeholder'); }
      if (ext === 'webp' && movingWebp(tmp)) k = 'gif';
      const sub = k === 'gif' ? 'gifs' : k === 'video' ? 'videos' : 'images';
      fs.mkdirSync(path.join(dir, sub), { recursive: true });
      fs.renameSync(tmp, path.join(dir, sub, name));
      counts[k]++;
      return { file: sub + '/' + name, k };
    };
    /* "link" (default): keep the moving thumbnail and link its bigger GIF;
       "download": keep the bigger GIF itself; "off": thumbnails only */
    const mode = o.bigGifs || 'link';

    for (let i = 0; i < items.length && out.length < MAX_FILES && !job.stopped; i++) {
      const it = items[i];
      let info = { big: it.direct || '' };
      if (!info.big && it.popup && mode !== 'off' && bigTried < BIG_MAX) {
        bigTried++;
        info = await bigFor(win, popupWin, it.popup, it.src, job);
      }
      const big = info.big || '';
      const label = info.title || it.title || '';
      const meta = { label, link: big || it.src, order: i };
      const cap = [info.credits, big ? 'Bigger GIF: ' + big : ''].filter(Boolean).join(' · ');
      if (cap) meta.caption = cap;
      if (big) meta.big = big;
      if (info.source) meta.source = info.source;
      if (info.tags) meta.tags = info.tags;
      if (it.popup) meta.page = it.popup;
      try {
        const useBig = big && mode === 'download';
        const f = await saveOne(useBig ? big : it.src, i, label);
        if (useBig) counts.big++; else if (big) counts.linked++;
        out.push({ file: f.file, ...meta });
      } catch (e) {
        if (big && mode === 'download') {
          try { const f = await saveOne(it.src, i, label); counts.linked++; out.push({ file: f.file, ...meta }); } catch (e2) { /* skipped */ }
        }
      }
      if ((i + 1) % 10 === 0) job.emit(`  … ${i + 1} of ${items.length}`);
    }
    /* what else the page loaded: kept unless it's a tiny placeholder */
    for (let j = 0; j < extra.length && out.length < MAX_FILES && !job.stopped; j++) {
      try { const f = await saveOne(extra[j], items.length + j, '', EXTRA_MIN_BYTES); out.push({ file: f.file, label: '', link: extra[j], order: items.length + j }); } catch (e) { /* skipped */ }
    }
    try { fs.readdirSync(dir).filter(n => n.startsWith('.part-')).forEach(n => fs.unlinkSync(path.join(dir, n))); } catch (e) {}
    if (!out.length) { job.emit('  ✗ Nothing on that page could be downloaded'); return { n: 0, links: page.links }; }
    h.writeManifest(dir, { site, page: pname, title: page.title, source: pageUrl, grabbedAt: new Date().toISOString(), items: out });
    job.emit(`  ✓ ${counts.gif} GIFs, ${counts.video} clips, ${counts.image} pictures${counts.big ? ` · ${counts.big} saved as the bigger GIF` : ''}${counts.linked ? ` · ${counts.linked} linked to their bigger GIF` : ''} → ${dir}`);
    return { n: out.length, links: page.links, url: pageUrl };
  } catch (e) {
    job.emit('  ✗ ' + e.message);
    return null;
  } finally {
    ses.webRequest.onCompleted(null);
    try { popupWin.destroy(); } catch (e) {}
    try { win.destroy(); } catch (e) {}
  }
}

/* the links on a page as it shows in the browser (for Find links) */
async function pageLinks(job, url) {
  const ses = session();
  const win = makeWindow(ses);
  try {
    if (!(await open(win, url, job))) return null;
    await scrollAll(win, job);
    return await win.webContents.executeJavaScript(COLLECT);
  } catch (e) { return null; } finally { try { win.destroy(); } catch (e) {} }
}

module.exports = { available, grabPage, pageLinks, postLinks, cookieFile, mediaIn, rank, kindOf, challenged,
  SIGNIN_SITES, WALLED, POSTS, CHECK_WAIT_MS, SCROLL_MAX, MIN_SIDE, BIG_MAX };
