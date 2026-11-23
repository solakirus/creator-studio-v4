/* A read-only copy of Creator Studio, pulled from Sync Hub.

   The paper reads the same records every device syncs. It only ever PULLS —
   it never sends a change, so it can't touch your data. It keeps the stores
   the paper uses and drops everything else on the way in.

     const hub = new Hub({ server, token, dir });
     await hub.pull()            → { got, total }
     hub.all('tasks')            → [values]
     hub.get('settings', 'program')
     hub.file(value)             → a picture's file on disk, or null

   Pictures arrive inside records as { __blob: type, b64 } (the same shape
   "Export everything" uses). They're written to dir/blobs and the record keeps
   { __file, type } instead, so the copy on disk stays small. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const APP = 'creator-studio-4';
/* bump KEEP_V when KEEP changes: the next pull starts from the beginning so
   the stores it now keeps are filled in */
const KEEP_V = 1;
const KEEP = new Set(['tasks', 'settings', 'clips', 'vlogs', 'series', 'sessions', 'runs', 'routines',
                      'task-frames', 'refs', 'ref-img', 'ref-poster']);
const EXT = { 'image/gif': 'gif', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
              'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };

class Hub {
  constructor(o){
    this.server = String(o.server || '').replace(/\/+$/, '');
    if (this.server && !/^https?:\/\//i.test(this.server)) this.server = 'http://' + this.server;
    this.token = String(o.token || '').trim();
    this.dir = o.dir;
    this.blobDir = path.join(this.dir, 'blobs');
    fs.mkdirSync(this.blobDir, { recursive: true });
    this.file_ = path.join(this.dir, 'records.json');
    this.stores = new Map();
    this.cursor = 0;
    this.lastPull = null;
    this.lastError = '';
    try {
      const s = JSON.parse(fs.readFileSync(this.file_, 'utf8'));
      if (s.keepV === KEEP_V) {
        this.cursor = s.cursor || 0;
        this.lastPull = s.lastPull || null;
        for (const [st, recs] of Object.entries(s.stores || {})) this.stores.set(st, new Map(Object.entries(recs)));
      }
    } catch (e) {}
  }

  ready(){ return !!(this.server && this.token); }

  async call(p){
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000);
    try {
      const r = await fetch(this.server + p, { headers: { Authorization: 'Bearer ' + this.token }, signal: ctl.signal });
      if (r.status === 401) throw new Error('Sync Hub didn’t accept the token (SYNC_TOKEN)');
      if (!r.ok) throw new Error(`Sync Hub answered ${r.status}`);
      return await r.json();
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Sync Hub didn’t answer in time');
      if (e.cause && e.cause.code) throw new Error(`Can’t reach Sync Hub at ${this.server} (${e.cause.code})`);
      throw e;
    } finally { clearTimeout(t); }
  }

  /* everything since last time, 200 at a time */
  async pull(){
    if (!this.ready()) throw new Error('Sync Hub isn’t set up (SYNC_HUB and SYNC_TOKEN)');
    let got = 0, guard = 0;
    try {
      for (;;) {
        const r = await this.call(`/sync/${APP}?since=${this.cursor}`);
        for (const c of r.changes || []) { if (this.apply(c)) got++; }
        if (typeof r.cursor === 'number') this.cursor = r.cursor;
        if (!r.more || ++guard > 5000) break;
      }
      this.lastPull = new Date().toISOString();
      this.lastError = '';
    } catch (e) { this.lastError = e.message; throw e; }
    finally { if (got) this.save(); else this.saveMeta(); }
    return { got, total: this.count() };
  }

  apply(c){
    if (!c || !KEEP.has(c.store)) return false;
    let key;
    try { key = JSON.parse(c.id); } catch (e) { return false; }
    const k = String(key);
    const m = this.stores.get(c.store) || new Map();
    this.stores.set(c.store, m);
    if (c.deleted) { m.delete(k); return true; }
    m.set(k, this.unpack(c.data, c.store + '|' + k));
    return true;
  }

  /* { __blob, b64 } → a file in blobs/, named by its content */
  unpack(v, where){
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(x => this.unpack(x, where));
    if (typeof v.__blob === 'string' && typeof v.b64 === 'string') {
      const buf = Buffer.from(v.b64, 'base64');
      const name = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 20) + '.' + (EXT[v.__blob] || 'bin');
      const f = path.join(this.blobDir, name);
      if (!fs.existsSync(f)) fs.writeFileSync(f, buf);
      return { __file: name, type: v.__blob, bytes: buf.length };
    }
    if (typeof v.__date === 'string' && Object.keys(v).length === 1) return v.__date;
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = this.unpack(x, where);
    return out;
  }

  count(){ let n = 0; for (const m of this.stores.values()) n += m.size; return n; }
  all(store){ const m = this.stores.get(store); return m ? [...m.values()] : []; }
  entries(store){ const m = this.stores.get(store); return m ? [...m.entries()] : []; }
  get(store, key){ const m = this.stores.get(store); return m ? m.get(String(key)) : undefined; }
  file(v){
    if (!v || typeof v !== 'object' || !v.__file) return null;
    const f = path.join(this.blobDir, path.basename(v.__file));
    return fs.existsSync(f) ? { path: f, type: v.type || '' } : null;
  }

  save(){
    const stores = {};
    const used = new Set();
    const walk = v => { if (v && typeof v === 'object') { if (v.__file) used.add(v.__file); else Object.values(v).forEach(walk); } };
    for (const [st, m] of this.stores) { stores[st] = Object.fromEntries(m); m.forEach(walk); }
    const tmp = this.file_ + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ keepV: KEEP_V, cursor: this.cursor, lastPull: this.lastPull, stores }));
    fs.renameSync(tmp, this.file_);
    /* pictures nothing points at any more */
    try { for (const f of fs.readdirSync(this.blobDir)) if (!used.has(f)) fs.unlinkSync(path.join(this.blobDir, f)); } catch (e) {}
  }
  saveMeta(){
    if (!fs.existsSync(this.file_)) return this.save();
    try {
      const s = JSON.parse(fs.readFileSync(this.file_, 'utf8'));
      s.cursor = this.cursor; s.lastPull = this.lastPull;
      fs.writeFileSync(this.file_, JSON.stringify(s));
    } catch (e) { this.save(); }
  }
}

module.exports = { Hub, APP, KEEP };
