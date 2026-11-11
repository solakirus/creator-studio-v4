/* A stand-in for Sync Hub, for tests only. Speaks the protocol app/js/sync.js
   uses — the real server on nastime is not in this repo:

     GET  /stats                     → [{ app, total, deleted }]
     POST /sync/<app>  {changes:[…]} → { accepted:[{store,id}], rejected:[{store,id,reason,current}] }
     GET  /sync/<app>?since=N        → { changes:[…], cursor, more }

   Newest updatedAt wins; on an exact tie an edit beats a delete. Every record
   kept gets the next sequence number, and a pull returns records past `since`
   in that order, 200 at a time. Also serves files under /f/ (a stand-in for
   the laptop's folders) with CORS, so a page can fetch them.

     const hub = await require('./mini-synchub').start({ token:'t', files:{ 'a.gif': buf } });
     hub.url, hub.close() */
const http = require('http');

function start(opts = {}){
  const token = opts.token || 'test-token';
  const files = opts.files || {};
  const apps = new Map();          /* app → Map(store\u0001id → rec) */
  let seq = 0;
  const PAGE = opts.page || 200;

  const recs = app => { if(!apps.has(app)) apps.set(app, new Map()); return apps.get(app); };
  const send = (res, code, body, type) => {
    res.writeHead(code, { 'Content-Type': type || 'application/json', 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
    res.end(type ? body : JSON.stringify(body));
  };

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if(req.method === 'OPTIONS') return send(res, 204, '', 'text/plain');
    if(u.pathname.startsWith('/f/')){
      const f = files[decodeURIComponent(u.pathname.slice(3))];
      if(!f) return send(res, 404, 'no', 'text/plain');
      return send(res, 200, f.data, f.type || 'application/octet-stream');
    }
    if((req.headers.authorization || '') !== 'Bearer ' + token) return send(res, 401, { error:'token' });
    if(req.method === 'GET' && u.pathname === '/stats'){
      return send(res, 200, [...apps].map(([app, m]) => ({ app, total:m.size, deleted:[...m.values()].filter(r => r.deleted).length })));
    }
    const m = /^\/sync\/([^/]+)$/.exec(u.pathname);
    if(!m) return send(res, 404, { error:'path' });
    const map = recs(decodeURIComponent(m[1]));
    if(req.method === 'GET'){
      const since = +u.searchParams.get('since') || 0;
      const all = [...map.values()].filter(r => r.seq > since).sort((a, b) => a.seq - b.seq);
      const page = all.slice(0, PAGE);
      const cursor = page.length ? page[page.length - 1].seq : since;
      return send(res, 200, { changes:page.map(({ seq, ...c }) => c), cursor, more:all.length > PAGE });
    }
    if(req.method === 'POST'){
      let body = '';
      req.on('data', d => body += d);
      req.on('end', () => {
        let changes = [];
        try { changes = JSON.parse(body).changes || []; } catch(e){ return send(res, 400, { error:'json' }); }
        const accepted = [], rejected = [];
        for(const c of changes){
          const k = c.store + '\u0001' + c.id, cur = map.get(k);
          const newer = !cur || c.updatedAt > cur.updatedAt || (c.updatedAt === cur.updatedAt && cur.deleted && !c.deleted);
          if(newer){ map.set(k, { ...c, seq:++seq }); accepted.push({ store:c.store, id:c.id }); }
          else { const { seq:_s, ...current } = cur; rejected.push({ store:c.store, id:c.id, reason:'older', current }); }
        }
        send(res, 200, { accepted, rejected });
      });
      return;
    }
    send(res, 405, { error:'method' });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + server.address().port;
    r({ url, token, apps, close: () => new Promise(z => server.close(z)) });
  }));
}
module.exports = { start };
