/* The morning paper — a newspaper of your day, printed while you sleep.

   Runs on nastime beside Creator Studio v4 (docker-compose service
   creator-studio-v4-paper). Every morning at PRINT_AT it:
     1. pulls your latest plans from Sync Hub (read only — it never changes them)
     2. works out the day: the list, the shoots, the workout, habits, videos due
     3. has Claude write the headline and story (your Claude plan, no API key;
        plain rules if Claude isn't set up or doesn't answer)
     4. lays it out as Letter pages and prints it on your network printer

   It also answers, through Caddy on :8795:
     GET  /paper/               the paper's page: today's paper, Print now, printer check
     GET  /paper/today.html     today's paper in the browser (?date=YYYY-MM-DD | tomorrow)
     GET  /paper/today.pdf      today's PDF (made if it isn't there yet)
     GET  /paper/pdf/<date>.pdf a day's PDF
     POST /paper/print          make it and print it now   (the app's "Print today's paper")
     POST /paper/make           make the PDF, don't print
     GET  /paper/status         how it's doing, as JSON
     GET  /paper/printer        ask the printer what it can do

   Environment (docker-compose.yml has them all, with what they mean):
     SYNC_HUB, SYNC_TOKEN, PRINTER, PRINT_AT, PRINT_DAYS, DUPLEX, PAPER_NAME,
     MASTHEAD, PLACE, LAT, LON, DAYS_TOTAL, CLAUDE, CLAUDE_CODE_OAUTH_TOKEN,
     CLAUDE_MODEL, DATA, SHOTLIB, PORT, TZ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFile } = require('child_process');
const { Hub } = require('./hub');
const Edition = require('./edition');
const Layout = require('./layout');
const Write = require('./write');
const Render = require('./render');
const Weather = require('./weather');
const Ipp = require('./ipp');

const env = (k, d) => (process.env[k] == null || process.env[k] === '' ? d : process.env[k]);
const cfg = {
  sync: env('SYNC_HUB', 'http://host.docker.internal:8787'),
  token: env('SYNC_TOKEN', ''),
  printer: env('PRINTER', ''),
  at: env('PRINT_AT', '04:30'),
  days: env('PRINT_DAYS', '0123456'),
  duplex: !/^(off|no|0|false)$/i.test(env('DUPLEX', 'on')),
  paperName: env('PAPER_NAME', 'The Kris Times'),
  masthead: /red/i.test(env('MASTHEAD', 'blackletter')) ? 'redhat' : 'blackletter',
  place: env('PLACE', 'Plant City, Fla.'),
  lat: env('LAT', '28.0186'), lon: env('LON', '-82.1129'),
  daysTotal: +env('DAYS_TOTAL', '1000'),
  claude: !/^(off|no|0|false)$/i.test(env('CLAUDE', 'on')),
  claudeModel: env('CLAUDE_MODEL', ''),
  data: path.resolve(env('DATA', '/paper')),
  shotlib: env('SHOTLIB', '/shotlib'),
  port: +env('PORT', '8081'),
  tz: env('TZ', 'America/New_York')
};
const DIR = { data: path.join(cfg.data, 'data'), out: path.join(cfg.data, 'out'), fonts: path.join(cfg.data, 'fonts') };
Object.values(DIR).forEach(d => fs.mkdirSync(d, { recursive: true }));
const STATE = path.join(cfg.data, 'state.json');

const log = (...a) => console.log(new Date().toLocaleString('sv-SE').slice(0, 19), ...a);
const hub = new Hub({ server: cfg.sync, token: cfg.token, dir: DIR.data });

let state = { lastAuto: '', nextTry: 0, history: [] };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE, 'utf8')) }; } catch (e) {}
const saveState = () => { try { fs.writeFileSync(STATE, JSON.stringify(state, null, 1)); } catch (e) {} };

const pad = n => String(n).padStart(2, '0');
const todayISO = (plus) => { const d = new Date(); d.setDate(d.getDate() + (plus || 0)); return Edition.isoOf(d); };
const isISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const dateParam = v => v === 'tomorrow' ? todayISO(1) : isISO(v) ? v : todayISO();

/* ---------------------------------------------------------------- what it needs, installed once */
let deps = null;
function sh(cmd, extra){
  return new Promise(res => execFile('sh', ['-c', cmd], { timeout: 15 * 60000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...(extra || {}) } },
    (err, out, e2) => res({ ok: !err, out: String(out || '') + String(e2 || '') })));
}
function ensure(){
  if (deps) return deps;
  deps = (async () => {
    if (!Render.findChrome()) {
      log('installing Chromium and fonts (first start only, a few minutes)…');
      const r = await sh('command -v apt-get >/dev/null && apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends chromium fonts-noto-core fonts-dejavu-core ca-certificates curl >/dev/null');
      log(r.ok && Render.findChrome() ? 'Chromium is ready' : 'Chromium did not install: ' + r.out.slice(-400));
    }
    if (cfg.claude && process.env.CLAUDE_CODE_OAUTH_TOKEN && !Write.findClaude(cfg)) {
      log('installing Claude Code (first start only)…');
      const r = await sh('curl -fsSL https://claude.ai/install.sh | bash');
      log(Write.findClaude(cfg) ? 'Claude Code is ready' : 'Claude Code did not install: ' + r.out.slice(-400));
    }
    /* Claude Code asks first-time questions in a terminal; there isn't one here */
    try {
      const f = path.join(require('os').homedir(), '.claude.json');
      if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({ hasCompletedOnboarding: true }));
    } catch (e) {}
    try { await Render.fonts(DIR.fonts, Layout.GOOGLE); } catch (e) {}
  })();
  return deps;
}

/* ---------------------------------------------------------------- the words, kept per day */
const wordsFile = iso => path.join(DIR.data, `words-${iso}.json`);
const sigOf = (e, wx) => crypto.createHash('sha1').update(JSON.stringify(Write.facts(e, wx))).digest('hex');
function cachedWords(iso, sig){
  try { const c = JSON.parse(fs.readFileSync(wordsFile(iso), 'utf8')); if (c.sig === sig) return c.words; } catch (e) {}
  return null;
}
async function wordsFor(iso, e, wx, fresh){
  const sig = sigOf(e, wx);
  const have = cachedWords(iso, sig);
  if (have && (have.by === 'claude' || !fresh)) return have;
  if (!fresh) return { ...Write.rules(e, wx), note: 'Preview — Claude writes this part when the paper is made' };
  const w = await Write.words(e, wx, cfg);
  if (w.by === 'claude' || !have) fs.writeFileSync(wordsFile(iso), JSON.stringify({ sig, words: w }));
  if (w.note) log('words:', w.by, '—', w.note);
  return w;
}

/* ---------------------------------------------------------------- the weather, once a day */
const wxCache = new Map();
async function weatherFor(iso){
  if (wxCache.has(iso) && Date.now() - wxCache.get(iso).at < 3 * 3600000) return wxCache.get(iso).v;
  const v = await Weather.forecast({ lat: cfg.lat, lon: cfg.lon, tz: cfg.tz }, iso);
  if (v) wxCache.set(iso, { at: Date.now(), v });
  return v;
}

/* ---------------------------------------------------------------- one edition */
async function edition(iso){
  try { await hub.pull(); } catch (e) { log('sync:', e.message); if (!hub.count()) throw e; }
  const e = Edition.build(hub, iso, { daysTotal: cfg.daysTotal, shotlib: cfg.shotlib, name: '' });
  const wx = await weatherFor(iso);
  return { e, wx };
}
const printedAt = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' ', ' ').toUpperCase().replace('AM', 'A.M.').replace('PM', 'P.M.');

async function makePdf(iso){
  await ensure();
  const { e, wx } = await edition(iso);
  const w = await wordsFor(iso, e, wx, true);
  const fontsCss = await Render.fonts(DIR.fonts, Layout.GOOGLE);
  const html = Layout.html(e, w, wx, { ...cfg, printedAt: printedAt(), fontsCss, src: f => 'file://' + f.path });
  const htmlFile = path.join(DIR.out, `${iso}.html`), pdfFile = path.join(DIR.out, `${iso}.pdf`);
  fs.writeFileSync(htmlFile, html);
  const pdf = await Render.pdf(htmlFile, pdfFile);
  tidy();
  return { e, w, pdf, pdfFile, pages: Layout.pageCount(e) };
}

let busy = Promise.resolve();
function queue(fn){ const p = busy.then(fn, fn); busy = p.catch(() => {}); return p; }

async function printDay(iso, why){
  const started = Date.now();
  let result;
  try {
    const m = await makePdf(iso);
    const p = await Ipp.printPdf(cfg.printer, m.pdf, { title: `${cfg.paperName} — ${iso}`, duplex: cfg.duplex && m.pages > 1 });
    result = { ok: p.ok, printed: p.ok, iso, pages: m.pages, by: m.w.by, wordsNote: m.w.note || '', message: p.message,
               pdf: `/paper/pdf/${iso}.pdf` };
  } catch (err) {
    result = { ok: false, printed: false, iso, message: err.message };
  }
  result.at = new Date().toISOString(); result.why = why; result.ms = Date.now() - started;
  state.history = [result, ...(state.history || [])].slice(0, 30);
  saveState();
  log(`print (${why}) ${iso}:`, result.ok ? 'ok' : 'FAILED', '—', result.message);
  return result;
}

function tidy(){
  const keep = Date.now() - 21 * 86400000;
  for (const d of [DIR.out, DIR.data]) {
    try {
      for (const f of fs.readdirSync(d)) {
        if (!/^(\d{4}-\d{2}-\d{2}\.(pdf|html)|words-\d{4}-\d{2}-\d{2}\.json)$/.test(f)) continue;
        const p = path.join(d, f);
        if (fs.statSync(p).mtimeMs < keep) fs.unlinkSync(p);
      }
    } catch (e) {}
  }
}

/* ---------------------------------------------------------------- every morning */
function minutesOf(hm){ const m = /^(\d{1,2}):(\d{2})/.exec(hm || ''); return m ? +m[1] * 60 + +m[2] : 270; }
function due(now){
  const iso = Edition.isoOf(now);
  if (state.lastAuto === iso) return false;
  if (!cfg.days.includes(String(now.getDay()))) return false;
  const mins = now.getHours() * 60 + now.getMinutes(), at = minutesOf(cfg.at);
  /* nastime was off at print time: still print, up to three hours late */
  if (mins < at || mins > at + 180) return false;
  return Date.now() >= (state.nextTry || 0);
}
async function tick(){
  const now = new Date();
  if (!due(now)) return;
  const iso = Edition.isoOf(now);
  const r = await queue(() => printDay(iso, 'morning'));
  if (r.ok) { state.lastAuto = iso; state.nextTry = 0; }
  else state.nextTry = Date.now() + 15 * 60000;       /* printer asleep or offline: try again */
  saveState();
}

/* ---------------------------------------------------------------- the page and the API */
const allowed = [hub.blobDir, path.resolve(cfg.shotlib)];
function sendFile(res, f, type){
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not there'); }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(f).pipe(res);
  });
}
const TYPES = { gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
function json(res, code, body){
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(JSON.stringify(body));
}

async function status(){
  const claude = cfg.claude ? await Write.claudeStatus(cfg) : { ok: false, message: 'Switched off (CLAUDE=off)' };
  return {
    paper: cfg.paperName, printAt: cfg.at, printDays: cfg.days, tz: cfg.tz,
    printer: cfg.printer ? Ipp.parseTarget(cfg.printer).label || cfg.printer : '',
    sync: { server: cfg.sync, ready: hub.ready(), lastPull: hub.lastPull, records: hub.count(), error: hub.lastError },
    chromium: !!Render.findChrome(), claude,
    lastAuto: state.lastAuto, nextTry: state.nextTry || 0, history: (state.history || []).slice(0, 10)
  };
}

const PAGE = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${Layout.esc(cfg.paperName)}</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#151515;color:#eee}
header{padding:16px 18px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;border-bottom:1px solid #333}
h1{font-size:20px;margin:0 auto 0 0;font-weight:900;letter-spacing:-.01em}
button,a.b{font:inherit;font-weight:700;border:0;border-radius:4px;padding:10px 14px;background:#2a2a2a;color:#eee;text-decoration:none;cursor:pointer;min-height:44px}
button.go{background:#FB6900;color:#111}
#msg{padding:10px 18px;font-size:14px;color:#ccc;min-height:20px}
.wrap{display:flex;flex-wrap:wrap;gap:18px;padding:0 18px 18px}
iframe{flex:999 1 640px;min-width:0;height:1150px;border:0;border-radius:4px;background:#d8d8d8}
aside{flex:1 1 260px;font-size:14px;line-height:1.5}
aside b{color:#fff} .ok{color:#7ad38a} .bad{color:#ff8a6b} li{margin:4px 0}
input{font:inherit;padding:9px;border-radius:4px;border:1px solid #444;background:#1e1e1e;color:#eee}
</style></head><body>
<header><h1>${Layout.esc(cfg.paperName)}</h1>
<input type="date" id="d"><button class="go" id="print">Print it now</button><button id="make">Make the PDF</button><a class="b" id="pdf" href="today.pdf" target="_blank">Open the PDF</a><button id="test">Check the printer</button></header>
<div id="msg"></div>
<div class="wrap"><iframe id="pv" title="Preview of the paper"></iframe><aside id="st">Loading…</aside></div>
<script>
const $=s=>document.querySelector(s), d=$('#d');
const iso=()=>d.value||new Date().toLocaleDateString('sv-SE');
d.value=new Date().toLocaleDateString('sv-SE');
const show=()=>{ $('#pv').src='today.html?screen=1&date='+iso(); $('#pdf').href='today.pdf?date='+iso(); };
d.onchange=show; show();
const say=t=>$('#msg').textContent=t;
async function post(p){ say(p==='print'?'Making the paper and sending it to the printer… (Claude can take a minute)':'Making the PDF…');
  try{ const r=await (await fetch(p+'?date='+iso(),{method:'POST'})).json(); say((r.ok?'✓ ':'✗ ')+r.message+(r.wordsNote?' · words: '+r.wordsNote:'')); show(); load(); }catch(e){ say('✗ '+e.message); } }
$('#print').onclick=()=>post('print'); $('#make').onclick=()=>post('make');
$('#test').onclick=async()=>{ say('Asking the printer…'); try{ const r=await (await fetch('printer')).json();
  say(r.ok?('✓ '+(r.model||'Printer')+' answers'+(r.state?' — '+r.state:'')+(r.pdf===false?' — but it doesn\\'t list PDF; try PRINTER=raw://address:9100':'')+(r.duplex?' — prints both sides':'')):'✗ '+r.message);}catch(e){say('✗ '+e.message);} };
const c=(ok,t)=>'<span class="'+(ok?'ok':'bad')+'">'+t+'</span>';
async function load(){ try{ const s=await (await fetch('status')).json();
  $('#st').innerHTML='<b>Prints</b> every day at '+s.printAt+' ('+s.tz+')<br><b>Printer</b> '+(s.printer||c(0,'not set — PRINTER'))+
  '<br><b>Your plans</b> '+(s.sync.ready?(s.sync.error?c(0,s.sync.error):c(1,s.sync.records+' records')+(s.sync.lastPull?' · '+new Date(s.sync.lastPull).toLocaleString():'')):c(0,'SYNC_TOKEN not set'))+
  '<br><b>Writer</b> '+(s.claude.ok?c(1,'Claude ('+s.claude.version+')'):c(0,s.claude.message))+
  '<br><b>Chromium</b> '+(s.chromium?c(1,'ready'):c(0,'installing…'))+
  '<br><br><b>Recent</b><ul>'+(s.history.map(h=>'<li>'+new Date(h.at).toLocaleString()+' — '+(h.ok?c(1,'✓'):c(0,'✗'))+' '+h.message+(h.by?' · words by '+h.by:'')+'</li>').join('')||'<li>Nothing yet</li>')+'</ul>';
  }catch(e){ $('#st').textContent='Status: '+e.message; } }
load();
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = u.pathname.replace(/^\/paper/, '') || '/';
  try {
    if (req.method === 'OPTIONS') return json(res, 204, {});
    if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); return res.end(PAGE()); }
    if (p === '/status') return json(res, 200, await status());
    if (p === '/health') return json(res, 200, { ok: true });
    if (p === '/printer') return json(res, 200, await Ipp.probe(cfg.printer));
    if (p === '/frame') {
      const f = path.resolve(u.searchParams.get('p') || '');
      if (!allowed.some(a => f.startsWith(a + path.sep))) { res.writeHead(403); return res.end(); }
      return sendFile(res, f, TYPES[path.extname(f).slice(1).toLowerCase()] || 'application/octet-stream');
    }
    if (p === '/today.html') {
      const iso = dateParam(u.searchParams.get('date'));
      const { e, wx } = await queue(() => edition(iso));
      const w = await wordsFor(iso, e, wx, false);
      const html = Layout.html(e, w, wx, { ...cfg, screen: u.searchParams.has('screen'), printedAt: '',
        src: f => '/paper/frame?p=' + encodeURIComponent(f.path) });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
      return res.end(html);
    }
    const pm = /^\/pdf\/(\d{4}-\d{2}-\d{2})\.pdf$/.exec(p);
    if (p === '/today.pdf' || pm) {
      const iso = pm ? pm[1] : dateParam(u.searchParams.get('date'));
      const f = path.join(DIR.out, `${iso}.pdf`);
      if (!fs.existsSync(f)) await queue(() => makePdf(iso));
      return sendFile(res, f, 'application/pdf');
    }
    if (req.method === 'POST' && (p === '/print' || p === '/make')) {
      const iso = dateParam(u.searchParams.get('date'));
      if (p === '/print') return json(res, 200, await queue(() => printDay(iso, 'asked')));
      const m = await queue(() => makePdf(iso));
      return json(res, 200, { ok: true, iso, pages: m.pages, by: m.w.by, wordsNote: m.w.note || '', message: `Made — ${m.pages} page${m.pages === 1 ? '' : 's'}`, pdf: `/paper/pdf/${iso}.pdf` });
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not here');
  } catch (err) {
    log('error:', err.message);
    json(res, 500, { ok: false, message: err.message });
  }
});

if (require.main === module || process.env.PAPER_START) {
  server.listen(cfg.port, () => log(`${cfg.paperName}: listening on ${cfg.port}; prints at ${cfg.at} (${cfg.tz}) to ${cfg.printer || 'no printer yet'}`));
  ensure().then(() => log('ready'));
  hub.pull().then(r => log(`sync: ${r.total} records`)).catch(e => log('sync:', e.message));
  setInterval(() => { tick().catch(e => log('tick:', e.message)); }, 30000);
  setInterval(() => { hub.pull().catch(() => {}); }, 15 * 60000);
  setTimeout(() => tick().catch(() => {}), 5000);
}

module.exports = { server, cfg, makePdf, printDay, due, edition, hub, state };
