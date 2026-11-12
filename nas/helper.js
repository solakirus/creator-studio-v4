/* nastime's helper for Creator Studio v4 — one small Node process beside Caddy.

   1. Keeps www/ current from GitHub (mirror.js, every few minutes).
   2. Serves the Shot Library's index to the iPad (and any browser) at
      /shotlib-index.json, through Caddy, which serves the files themselves
      from /shotlib/. The Library on the iPad reads the same folder the laptop
      does — nothing is copied.

   Environment:
     LIB     the Shot Library inside the container   (default /shotlib)
     PORT    where the index is served               (default 8080)
     plus mirror.js's SOURCE, SITE, EVERY

   The index is read again when it's asked for and is more than 20 seconds
   old, so a new grab shows on the iPad when the Library is next opened.
   Plain Node, nothing to install. */
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');

const LIB = path.resolve(process.env.LIB || '/shotlib');   /* never /lib: that is where Alpine keeps its system libraries */
const PORT = +process.env.PORT || 8080;
const FRESH = 20 * 1000;
const log = (...a) => console.log(new Date().toISOString().slice(0, 19).replace('T', ' '), ...a);

/* libscan.js sits beside this file on nastime (publish-nas copies it there);
   in the repo it lives in electron/ */
const scanRoot = (() => {
  for (const p of ['./libscan', '../electron/libscan']) { try { return require(p).scanRoot; } catch (e) {} }
  throw new Error('libscan.js is missing next to helper.js — run publish-nas from the laptop');
})();

/* the folder's frames, with addresses the browser can open (/shotlib/<path>) */
function index(){
  const t0 = Date.now();
  const r = scanRoot(LIB, 'nastime');
  const enc = p => p.split('/').map(encodeURIComponent).join('/');
  const items = r.items.map(it => {
    const { root, url, ...rest } = it;          /* no server paths leave nastime */
    return { ...rest, url: '/shotlib/' + enc(it.path) };
  });
  const pages = r.pages.map(({ root, ...p }) => p);
  return { format: 'cs4-shotlib', made: new Date().toISOString(), items, pages, ms: Date.now() - t0 };
}

let cached = null, cachedAt = 0, body = null;
function current(){
  if (!cached || Date.now() - cachedAt > FRESH) {
    if (!fs.existsSync(LIB)) return null;
    cached = index(); cachedAt = Date.now(); body = JSON.stringify(cached);
  }
  return body;
}

function serve(port){
  const srv = http.createServer((q, r) => {
    const p = q.url.split('?')[0];
    if (p === '/shotlib-index.json' || p === '/') {
      let out = null;
      try { out = current(); } catch (e) { log('index failed:', e.message); }
      if (!out) { r.writeHead(503, { 'content-type': 'application/json' }); return r.end('{"error":"The Shot Library folder is not there"}'); }
      r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
      return r.end(out);
    }
    r.writeHead(404); r.end();
  });
  return new Promise(res => srv.listen(port, () => res(srv)));
}

module.exports = { index, serve };

if (require.main === module) {
  serve(PORT).then(() => {
    log(`Shot Library ${LIB}${fs.existsSync(LIB) ? '' : ' (not found — check the compose volume)'} — index on :${PORT}`);
    try { const i = JSON.parse(current() || '{}'); if (i.items) log(`${i.items.length} frames in ${i.pages.length} pages (${i.ms} ms)`); } catch (e) {}
  });
  /* and keep www/ current from GitHub, as mirror.js did on its own */
  try {
    const { look } = require('./mirror');
    const EVERY = Math.max(1, +process.env.EVERY || 5) * 60 * 1000;
    const loop = () => look().catch(e => log('mirror error:', e.message)).finally(() => setTimeout(loop, EVERY));
    loop();
  } catch (e) { log('mirror.js is missing — www/ is not kept current from GitHub'); }
}
