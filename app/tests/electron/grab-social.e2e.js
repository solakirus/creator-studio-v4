/* The Library's "Find links" on a social profile, end to end against a mock
   Instagram, with the real electron/grab-builtin.js and grab-browser.js.

   Electron isn't needed: a stand-in 'electron' module gives grab-browser.js a
   BrowserWindow that drives a real Chromium page (Playwright), and a session
   whose cookies are that browser's. The mock site:
     - signed out, the profile is a login wall: a sign-in dialog with a
       password box, and only the page's own links (Log In, Sign Up,
       followers, Explore) — what the old scanner listed as "videos";
     - signed in, a grid of 48 posts and reels that keeps only the rows near
       the screen, like Instagram's, so one look at the end misses most.
   "Signing in" happens when the window is shown, as the person would.

     node app/tests/electron/grab-social.e2e.js */
const http = require('http'), path = require('path'), fs = require('fs'), Module = require('module'), os = require('os');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));

let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };

/* ---- the mock site (all hosts resolve here; see --host-resolver-rules) */
const POSTS = Array.from({ length: 48 }, (_, i) => i % 3 === 2 ? { k: 'reel', id: 'RL' + i } : { k: 'p', id: 'PO' + i });
const page = body => `<!doctype html><html><head><meta charset="utf-8"><title>Instagram</title>
  <style>body{margin:0;font:14px sans-serif}nav a{margin:6px}.grid{position:relative}.row{position:absolute;left:0;right:0;height:300px;display:flex;gap:4px}
  .row a{flex:1;background:#ccc;display:block}.row img{width:100%;height:100%;object-fit:cover}</style></head><body>${body}</body></html>`;
const NAV = `<nav><a href="/">Instagram</a><a href="/accounts/login/">Log In</a><a href="/accounts/emailsignup/">Sign Up</a>
  <a href="/bryanhynes/followers/">392K followers</a><a href="/explore/">Explore</a><a href="/bryanhynes/reels/">Reels</a></nav>`;
const server = http.createServer((req, res) => {
  const signed = /sessionid=\w/.test(req.headers.cookie || '');
  const send = (h, code) => { res.writeHead(code || 200, { 'Content-Type': 'text/html' }); res.end(h); };
  /* a tiny picture for the grid's thumbnails */
  if (req.url.startsWith('/thumb/')) { res.writeHead(200, { 'Content-Type': 'image/gif' });
    return res.end(Buffer.from('R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=', 'base64')); }
  /* a Reels tab like Instagram's now: no words on the tiles, only counters
     ("37.1K38KPinned post iconView Count Icon628K"), the picture as a
     background, the site's own Reels menu pointing at someone else's reel,
     other people's reels below the grid — and signed out, a log-in box over
     the grid once you scroll past the first 12 */
  /* a profile that, signed out, shows 12 and simply stops: no log-in box */
  if (req.url.startsWith('/quiet/')) {
    const n = signed ? 40 : 12;
    return send(page(`<h1>quiet</h1><div style="display:grid;grid-template-columns:1fr 1fr 1fr">${Array.from({ length: n }, (_, i) =>
      `<a href="/quiet/reel/QR${i}/" style="height:300px;display:block"><span>${i}</span><svg aria-label="View Count Icon"></svg><span>${i}K</span></a>`).join('')}</div>`));
  }
  if (req.url.startsWith('/mid/')) {
    const n = signed ? 30 : 12;
    const tiles = Array.from({ length: n }, (_, i) => `<a href="/mid/reel/MR${i}/"><div style="height:300px;background-image:url(&quot;https://scontent.cdninstagram.com/thumb/MR${i}.gif&quot;)"></div>
      <span>${i === 0 ? '37.1K</span><span>38K</span><svg aria-label="Pinned post icon"><title>Pinned post icon</title></svg>' : '180</span><span>342</span>'}
      <svg aria-label="View Count Icon"><title>View Count Icon</title></svg><span>${i === 0 ? '628K' : (i + 1) * 1000}</span></a>`).join('');
    const nav = `<nav><a href="/reels/NAVREEL1/">Reels</a><a href="/explore/">Explore</a></nav>`;
    const more = `<h3>More from Instagram</h3><a href="/someoneelse/reel/OTHER1/"><span>9</span></a><a href="/another/reel/OTHER2/"><span>12</span></a>`;
    return send(page(nav + `<h1>mid</h1><div id="g" style="display:grid;grid-template-columns:1fr 1fr 1fr">${tiles}</div>${signed ? more : ''}
      ${signed ? '' : `<script>addEventListener('scroll',()=>{if(scrollY>400&&!document.querySelector('[role=dialog]'))
        document.body.insertAdjacentHTML('beforeend','<div role="dialog"><h2>Log in to see more</h2><input type="password"><a href="/accounts/login/">Log in</a></div>')});</script>`}`));
  }
  if (req.url.startsWith('/bryanhynes')) {
    if (!signed) return send(page(NAV + `<h1>bryanhynes</h1><div role="dialog"><h2>Log in to Instagram</h2>
      <input name="username"><input type="password" name="password"><a href="/accounts/login/">Log in</a></div>`));
    /* signed in: rows of 3, only those within a screen of the view are in the page */
    return send(page(NAV + `<h1>bryanhynes</h1><div class="grid" id="g" style="height:${Math.ceil(POSTS.length / 3) * 304}px"></div>
      <script>const P=${JSON.stringify(POSTS)};const g=document.getElementById('g');
      function draw(){const top=scrollY-innerHeight,bot=scrollY+2*innerHeight;g.innerHTML='';
        for(let r=0;r*3<P.length;r++){const y=r*304;if(y<top||y>bot)continue;
          g.insertAdjacentHTML('beforeend','<div class="row" style="top:'+y+'px">'+P.slice(r*3,r*3+3).map(p=>
            '<a href="/bryanhynes/'+p.k+'/'+p.id+'/"><img alt="Post '+p.id+'" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></a>').join('')+'</div>');}}
      addEventListener('scroll',draw);draw();</script>`));
  }
  send(page(NAV + '<p>elsewhere</p>'));
});

/* ---- a stand-in electron, backed by one Chromium */
let browser, ctx;
const shows = [];
let scrolledShown = 0;
let flow = 'plain';   /* scrolling a window that was shown and hidden: Electron stops drawing those */
class BrowserWindow {
  constructor(o){ this.o = o; this.p = null; this.webContents = {
    executeJavaScript: async js => { await this.ready(); if (this.shownEver && /scrollBy/.test(js)) scrolledShown++; return this.p.evaluate(js); },
    getTitle: () => this.title || ''
  }; }
  async ready(){ if(!this.p) this.p = await ctx.newPage(); return this.p; }
  async loadURL(u){ await this.ready(); await this.p.goto(u, { waitUntil: 'domcontentloaded' }); this.title = await this.p.title(); }
  on(ev, f){ (this.ls = this.ls || {})[ev] = f; } removeListener(ev){ if(this.ls) delete this.ls[ev]; }
  show(){ shows.push(Date.now()); this.shownEver = true;
    /* the person gives up and closes the window */
    if (flow === 'close') return setTimeout(() => this.ls && this.ls.close && this.ls.close({ preventDefault(){} }), 1000);
    /* after the password: a picture puzzle on /challenge/ for a few seconds, no sign-in yet */
    if (flow === 'challenge') setTimeout(() => this.p.goto('https://www.instagram.com/challenge/', { waitUntil: 'domcontentloaded' }), 300);
    /* the person signs in: the site sets its cookie and sends them back */
    setTimeout(async () => { await ctx.addCookies([{ name: 'sessionid', value: 'ok', domain: 'www.instagram.com', path: '/', expires: Math.floor(Date.now() / 1000) + 86400 * 90, secure: true }]);
      await this.p.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' }); }, flow === 'challenge' ? 6000 : 800); }
  hide(){} focus(){} setTitle(t){ this.title = t; } destroy(){ if(this.p) this.p.close().catch(() => {}); }
}
const fakeElectron = {
  BrowserWindow,
  app: { isReady: () => true },
  session: { fromPartition: () => ({ fetch: (u, o) => { const x = new URL(u); return fetch(`http://127.0.0.1:${server.address().port}${x.pathname}`, o); }, getUserAgent: () => 'Mozilla/5.0 Chrome/131 Electron/30', setUserAgent(){},
    cookies: { set: async c => ctx.addCookies([{ name: c.name, value: c.value, domain: c.domain || new URL(c.url).hostname, path: c.path || '/',
        expires: c.expirationDate || -1, secure: !!c.secure, httpOnly: !!c.httpOnly }]),
      get: async ({ domain }) => (await ctx.cookies()).filter(c => c.domain.replace(/^\./, '').endsWith(domain))
      .map(c => ({ ...c, expirationDate: c.expires > 0 ? c.expires : undefined, hostOnly: !c.domain.startsWith('.') })) } }) }
};
const resolve = Module._resolveFilename;
Module._resolveFilename = function(req, ...a){ return req === 'electron' ? 'electron' : resolve.call(this, req, ...a); };
require.cache.electron = { id: 'electron', filename: 'electron', loaded: true, exports: fakeElectron };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  browser = await pw.chromium.launch({ executablePath: exe, headless: true,
    args: [`--host-resolver-rules=MAP * 127.0.0.1:${port}`, '--ignore-certificate-errors'] });
  /* https on a plain http server: rewrite every request to http on the port */
  ctx = await browser.newContext();
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    const r = await fetch(`http://127.0.0.1:${port}${u.pathname}${u.search}`, { headers: { cookie: (await ctx.cookies(u.origin)).map(c => c.name + '=' + c.value).join('; ') } });
    route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'text/html' }, body: await r.text() });
  });

  const Builtin = require('../../../electron/grab-builtin.js');
  const job = () => { const lines = []; return { lines, stopped: false, emit: l => lines.push(l), run: async () => ({ code: 1, err: '' }) }; };

  console.log('\n— a profile, signed out —');
  const j1 = job(), found = [];
  const code = await Builtin.scan(j1, { ytdlp: '/no/yt-dlp', ffmpeg: null }, 'https://www.instagram.com/bryanhynes/', 200, l => found.push(l));
  ok(code === 0, 'the scan finishes', j1.lines[j1.lines.length - 1]);
  ok(shows.length === 1, 'the login wall opens the window to sign in, once');
  ok(j1.lines.some(l => /Instagram wants you signed in/.test(l)) && j1.lines.some(l => /signed in to Instagram/.test(l)), 'and says so, then that it worked');
  ok(found.length === POSTS.length, 'every post and reel on the profile is found, though the grid only shows a few rows at a time', `${found.length} of ${POSTS.length}`);
  const junk = found.filter(l => /login|signup|followers|explore|\/reels\/$|instagram\.com\/$/i.test(l.url));
  ok(!junk.length, 'none of the page\'s own links (Log In, Sign Up, followers, Explore)', junk.map(l => l.url).join(' '));
  ok(found.filter(l => l.kind === 'video').length === 16 && found.filter(l => l.kind === 'post').length === 32, 'reels say video, posts say post');
  ok(found.every(l => /^https:\/\/www\.instagram\.com\/(p|reel)\/[A-Z]{2}\d+\/$/.test(l.url)), 'links are tidied to the post itself', found[0] && found[0].url);
  ok(found.every(l => /^Post /.test(l.title)), 'titled from the picture\'s own text', found[0] && found[0].title);

  console.log('\n— the same profile again —');
  const j2 = job(), again = [];
  await Builtin.scan(j2, { ytdlp: null }, 'https://www.instagram.com/bryanhynes/', 10, l => again.push(l));
  ok(shows.length === 1, 'already signed in: no window this time');
  ok(again.length === 10, 'and the limit is kept', again.length);

  console.log('\n— downloads use that sign-in —');
  const Browser = require('../../../electron/grab-browser.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jar-'));
  const jar = await Browser.cookieFile('https://www.instagram.com/reel/RL2/', dir);
  const txt = jar ? fs.readFileSync(jar, 'utf8') : '';
  ok(!!jar && /^# Netscape HTTP Cookie File/.test(txt), 'a cookies.txt yt-dlp can read is written');
  ok(/www\.instagram\.com\tFALSE\t\/\tTRUE\t\d+\tsessionid\tok/.test(txt), 'holding the Instagram sign-in', txt.split('\n')[1]);
  ok(await Browser.cookieFile('https://www.tiktok.com/@x/video/1', dir) === null, 'and nothing for a site never signed in to');

  console.log('\n— a Reels tab whose log-in box only shows after scrolling —');
  await ctx.clearCookies();
  const before = shows.length, j3 = job(), reels = [];
  await Builtin.scan(j3, { ytdlp: null }, 'https://www.instagram.com/mid/reels/', 200, l => reels.push(l));
  ok(shows.length === before + 1, 'the log-in box that appears mid-scroll opens the sign-in window');
  ok(reels.length === 30, 'so every reel is found, not just the first 12 shown signed out', reels.length);
  ok(reels.every(l => /\/reel\/MR\d+\/$/.test(l.url)), 'only this profile\'s reels — not the menu\'s Reels link or other people\'s below the grid',
    reels.filter(l => !/MR\d/.test(l.url)).map(l => l.url).join(' '));
  const t0 = reels.find(l => /MR0\//.test(l.url)), t5 = reels.find(l => /MR5\//.test(l.url));
  ok(!reels.some(l => /icon/i.test(l.title)), 'no "View Count Icon" junk in the names', t0 && t0.title);
  ok(t0 && t0.title === 'Reel · MR0 · 628K views · pinned', 'a reel is named by its code, views and pinned', t0 && t0.title);
  ok(t5 && t5.title === 'Reel · MR5 · 6000 views', 'and the others by code and views', t5 && t5.title);
  ok(reels.every(l => /^data:image\/gif;base64,/.test(l.thumb || '')), 'each carries its grid picture, copied so the app can show it', (t0 && t0.thumb || '').slice(0, 30));

  ok(scrolledShown === 0, 'after signing in, the scan carries on in a fresh window (a shown-then-hidden one stops loading at 12)', scrolledShown);

  console.log('\n— signed out, a profile that just stops at 12 —');
  await ctx.clearCookies();
  const b4 = shows.length, j4 = job(), quiet = [];
  await Builtin.scan(j4, { ytdlp: null }, 'https://www.instagram.com/quiet/reels/', 200, l => quiet.push(l));
  ok(shows.length === b4 + 1 && j4.lines.some(l => /only shows the first few posts to someone signed out/.test(l)), 'no log-in box, but signed out: it opens Instagram\'s sign-in page');
  ok(quiet.length === 40, 'and once signed in, finds them all', quiet.length);
  ok(scrolledShown === 0, 'again in a fresh window');
  const j5 = job(), again2 = [];
  const b5 = shows.length;
  await Builtin.scan(j5, { ytdlp: null }, 'https://www.instagram.com/quiet/reels/', 200, l => again2.push(l));
  ok(shows.length === b5 && again2.length === 40, 'signed in already: no window, all 40', again2.length);

  console.log('\n— signing in goes on to a picture puzzle —');
  await ctx.clearCookies(); flow = 'challenge';
  const j6 = job(), pz = [];
  await Builtin.scan(j6, { ytdlp: null }, 'https://www.instagram.com/quiet/reels/', 200, l => pz.push(l));
  ok(!j6.lines.some(l => /Not signed in/.test(l)) && j6.lines.some(l => /signed in to Instagram/.test(l)), 'the window stays open through the puzzle until the sign-in is really done');
  ok(pz.length === 40, 'then every reel is found', pz.length);

  console.log('\n— closing the sign-in window —');
  await ctx.clearCookies(); flow = 'close';
  const j7 = job(), t7 = Date.now();
  await Builtin.scan(j7, { ytdlp: null }, 'https://www.instagram.com/quiet/reels/', 200, () => {});
  ok(Date.now() - t7 < 20000, 'closing it ends the wait instead of sitting there for 5 minutes', ((Date.now() - t7) / 1000).toFixed(1) + 's');
  ok(j7.lines.some(l => /Not signed in to Instagram/.test(l)), 'and says it isn\'t signed in');
  flow = 'plain';

  console.log('\n— using Firefox\'s sign-in —');
  const tmpd = fs.mkdtempSync(path.join(os.tmpdir(), 'fakeytdlp-'));
  const fake = (name, body) => { const f = path.join(tmpd, name); fs.writeFileSync(f, '#!/usr/bin/env node\n' + body); fs.chmodSync(f, 0o755); return f; };
  const goodYt = fake('yt-ok', `const a=process.argv; const jar=a[a.indexOf('--cookies')+1]; require('fs').writeFileSync(jar,
    '# Netscape HTTP Cookie File\\n.instagram.com\\tTRUE\\t/\\tTRUE\\t' + (Math.floor(Date.now()/1000)+86400) + '\\tsessionid\\tfromfirefox\\n.google.com\\tTRUE\\t/\\tTRUE\\t' + (Math.floor(Date.now()/1000)+86400) + '\\tSID\\tgoogle\\n');
    process.stdout.write(a.join(' ')); process.exit(1);`);
  const lockedYt = fake('yt-locked', `console.error('ERROR: Failed to decrypt with DPAPI. See https://github.com/yt-dlp/yt-dlp/issues/10927'); process.exit(1);`);
  await ctx.clearCookies();
  const j8 = Builtin.makeJob(() => {}), l8 = [], ff = [];
  j8.emit = l => l8.push(l);
  const b8 = shows.length;
  await Builtin.scan(j8, { ytdlp: goodYt }, 'https://www.instagram.com/quiet/reels/', 200, l => ff.push(l), { cookies: 'firefox' });
  ok(l8.some(l => /using Firefox's sign-in for instagram\.com/.test(l)), 'it borrows Firefox\'s Instagram sign-in', l8.find(l => /Firefox/.test(l)));
  ok(shows.length === b8 && ff.length === 40, 'so no sign-in window, and every reel', ff.length);
  const ck = await ctx.cookies();
  ok(ck.some(c => c.name === 'sessionid' && c.value === 'fromfirefox') && !ck.some(c => /google/.test(c.domain)), 'only Instagram\'s cookies come over, not the rest of Firefox\'s');

  console.log('\n— Chrome\'s sign-ins locked away —');
  await ctx.clearCookies();
  const j9 = Builtin.makeJob(() => {}), l9 = [], cr = [];
  j9.emit = l => l9.push(l);
  const b9 = shows.length;
  await Builtin.scan(j9, { ytdlp: lockedYt }, 'https://www.instagram.com/quiet/reels/', 200, l => cr.push(l), { cookies: 'chrome' });
  ok(l9.some(l => /Chrome keeps its sign-ins locked away/.test(l)), 'it says Chrome\'s can\'t be borrowed and suggests Firefox', l9.find(l => /Chrome/.test(l)));
  ok(shows.length === b9 + 1 && cr.length === 40, 'then falls back to the app\'s own sign-in window', cr.length);

  await browser.close(); server.close();
  console.log(`\nsocial profiles  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
