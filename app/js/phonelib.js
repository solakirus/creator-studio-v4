/* The phone keeps its own copies of the GIFs you pick, so its Library works
   anywhere, offline.

   Two ways in, both into the app's own storage (MediaLib.addBlob), each copy
   keeping its path in the Shot Library — so templates and tasks made on the
   laptop or the iPad find it here:

   1. From nastime, on its own. You pick libraries or videos to keep
      (Library → On this phone). When the phone can reach nastime (home Wi-Fi,
      or Tailscale) it downloads what's new for them: at start, coming back to
      the app, every 30 minutes, and on "Update now".
   2. From a file the laptop or the Linux desktop makes: Library → Deck →
      "⇩ For the phone" writes a .cs4lib file (a plain zip: the files at their
      Shot Library paths and a cs4lib.json list). Move it to the phone
      (Syncthing, Drive, a cable) and "Import a file".

   Also here: making that file (exportFile), which any device with a Library
   can do. */
(function(global){
  const KEY = 'phoneKeep';                 /* in the 'library' settings: { libs:[], pages:[] } */
  const EVERY = 30 * 60 * 1000;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const isPhone = () => !!(global.MediaLib && MediaLib.phone && MediaLib.phone());

  async function keepList(){ const s = await MediaLib.settings(); const k = s[KEY] || {}; return { libs: k.libs || [], pages: k.pages || [] }; }
  async function setKeep(k){ await MediaLib.setSettings({ [KEY]: { libs: [...new Set(k.libs)], pages: [...new Set(k.pages)] } }); }

  /* ------------------------------------------------------------ nastime */
  /* outside the page on the phone (no CORS, no mixed-content worries) */
  async function get(url, as){
    const http = global.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;
    if(http && isPhone()){
      const r = await http.request({ url, method:'GET', responseType: as === 'json' ? 'json' : 'blob', readTimeout:60000, connectTimeout:6000 });
      if(r.status && r.status >= 400) throw new Error('answered ' + r.status);
      if(as === 'json') return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      const bin = atob(String(r.data || ''));
      const bytes = new Uint8Array(bin.length);
      for(let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      return new Blob([bytes]);
    }
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), as === 'json' ? 6000 : 60000);
    try {
      const r = await fetch(url, { cache:'no-store', signal:ctl.signal });
      if(!r.ok) throw new Error('answered ' + r.status);
      return as === 'json' ? r.json() : r.blob();
    } finally { clearTimeout(t); }
  }
  async function base(){ return global.Updater && Updater.nasAddress ? await Updater.nasAddress().catch(() => '') : ''; }

  /* nastime's libraries and videos: [{ name, pages:[{ dir, name, count, items:[…] }] }] */
  async function catalogue(){
    const b = await base();
    if(!b) throw new Error('No nastime address — set up Sync, or Settings → App updates');
    const j = await get(b + 'shotlib-index.json?t=' + Date.now(), 'json');
    if(!j || j.format !== 'cs4-shotlib') throw new Error('nastime has no Shot Library list');
    const pageOf = new Map(j.pages.map(p => [p.uid, p]));
    const libs = new Map();
    for(const it of j.items){
      const p = pageOf.get(it.page);
      if(!p) continue;
      if(!libs.has(p.collection)) libs.set(p.collection, new Map());
      const pages = libs.get(p.collection);
      if(!pages.has(p.dir)) pages.set(p.dir, { dir:p.dir, name:p.heading || p.title || p.page, page:p.page, library:p.collection, items:[] });
      pages.get(p.dir).items.push({ ...it, url: new URL(it.url, b).href });
    }
    return [...libs].sort((a, b2) => a[0].localeCompare(b2[0])).map(([name, pages]) => ({ name, pages:[...pages.values()] }));
  }

  /* what this phone already has, by path */
  async function havePaths(){
    const recs = (await Store.all('lib-items').catch(() => ({ values:[] }))).values;
    return new Map(recs.filter(r => r.path).map(r => [r.path, r]));
  }

  let running = null, lastRun = 0;
  /* download what's new for the kept libraries and videos */
  function update(o){
    if(running) return running;
    running = (async () => {
      const opts = o || {};
      const k = await keepList();
      if(!k.libs.length && !k.pages.length) return { got:0, failed:0, total:0 };
      let cat;
      try { cat = await catalogue(); } catch(e){ if(!opts.quiet) U.toast('Can’t reach nastime — ' + e.message); return { offline:true, got:0, failed:0, total:0 }; }
      const have = await havePaths();
      const want = [];
      for(const l of cat) for(const p of l.pages)
        if(k.libs.includes(l.name) || k.pages.includes(p.dir)) for(const it of p.items) if(!have.has(it.path)) want.push([it, p]);
      let got = 0, failed = 0;
      for(let i = 0; i < want.length; i++){
        const [it, p] = want[i];
        if(opts.onProgress) opts.onProgress(i, want.length);
        try {
          const blob = await get(it.url, 'blob');
          const name = it.path.split('/').pop();
          if(await MediaLib.addBlob(blob, { name, kind:it.kind, label:it.label, caption:it.caption, link:it.link, tags:it.tags,
              library:p.library, page:p.page, path:it.path, from:it.uid })) got++;
        } catch(e){ failed++; }
      }
      lastRun = Date.now();
      if(got){ MediaLib.invalidate && MediaLib.invalidate(); if(!opts.quiet || got) U.toast(`${plural(got, 'GIF')} now on this phone${failed ? ` · ${failed} couldn’t be downloaded` : ''}`); }
      else if(!opts.quiet) U.toast(failed ? `${failed} couldn’t be downloaded` : 'Everything you keep is already on this phone');
      return { got, failed, total:want.length };
    })().finally(() => { running = null; });
    return running;
  }

  /* stop keeping a library or video: its copies leave the phone */
  async function drop(sel){
    const recs = (await Store.all('lib-items').catch(() => ({ values:[] }))).values;
    const gone = recs.filter(r => r.path && (sel.lib ? r.library === sel.lib : r.path.startsWith(sel.dir + '/')));
    const k = await keepList();
    await setKeep({ libs: k.libs.filter(x => x !== sel.lib), pages: k.pages.filter(x => x !== sel.dir) });
    if(gone.length) await MediaLib.remove(gone.map(r => 'db:' + r.id));
    return gone.length;
  }

  /* what's on the phone, grouped: [{ library, pages:[{ page, count, bytes, dir }] }] */
  async function onPhone(){
    const recs = (await Store.all('lib-items').catch(() => ({ values:[] }))).values;
    const libs = new Map();
    for(const r of recs){
      const lib = r.library || 'My library', pg = r.page || 'Added';
      if(!libs.has(lib)) libs.set(lib, new Map());
      const m = libs.get(lib);
      if(!m.has(pg)) m.set(pg, { page:pg, count:0, bytes:0, dir: r.path ? r.path.split('/').slice(0, -1).join('/').replace(/\/(gifs|videos|images|stills|clips)$/i, '') : '' });
      const x = m.get(pg); x.count++; x.bytes += r.bytes || 0;
    }
    return [...libs].map(([library, m]) => ({ library, pages:[...m.values()] }));
  }

  /* ------------------------------------------------------------ the file */
  /* CRC-32, for the zip */
  const CRC = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for(let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const enc = new TextEncoder();

  /* a .cs4lib: a zip with nothing compressed (GIFs and clips are compressed already) */
  async function exportFile(items, title, onProgress){
    const parts = [], central = [];
    let off = 0, n = 0;
    const list = [];
    const add = (name, u8) => {
      const nm = enc.encode(name), crc = crc32(u8);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, u8.length, true); h.setUint32(22, u8.length, true);
      h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, nm, u8);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, u8.length, true); c.setUint32(24, u8.length, true);
      c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      central.push(c.buffer, nm);
      off += 30 + nm.length + u8.length; n++;
    };
    const l = await MediaLib.load();
    for(let i = 0; i < items.length; i++){
      const it = items[i];
      if(onProgress) onProgress(i, items.length);
      const blob = await MediaLib.blobOf(it).catch(() => null);
      if(!blob) continue;
      const pg = l.pageIdx.get(it.page);
      const library = (pg && pg.collection) || 'My library', page = (pg && pg.page) || 'Added';
      const path = it.path || [library, page, it.name].map(x => String(x).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'x').join('/');
      add('files/' + path, new Uint8Array(await blob.arrayBuffer()));
      list.push({ path, uid:it.uid, kind:it.kind, name:it.name, label:it.label || '', caption:it.caption || '', link:it.link || '',
                  tags:it.tags || [], library, page });
    }
    add('cs4lib.json', enc.encode(JSON.stringify({ format:'cs4lib', made:new Date().toISOString(), title:title || '', items:list })));
    const cdSize = central.reduce((a, b) => a + b.byteLength, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, n, true); e.setUint16(10, n, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    const file = new Blob([...parts, ...central, e.buffer], { type:'application/zip' });
    const name = (String(title || 'Shot Library').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Shot Library') + '.cs4lib';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    return { count:list.length, bytes:file.size, name };
  }

  /* read a .cs4lib without loading it all: the zip's list, then each file */
  async function importFile(file, onProgress){
    const tail = new DataView(await file.slice(Math.max(0, file.size - 65557)).arrayBuffer());
    let eo = -1;
    for(let i = tail.byteLength - 22; i >= 0; i--) if(tail.getUint32(i, true) === 0x06054b50){ eo = i; break; }
    if(eo < 0) throw new Error('That isn’t a Creator Studio library file');
    const count = tail.getUint16(eo + 10, true), cdSize = tail.getUint32(eo + 12, true), cdOff = tail.getUint32(eo + 16, true);
    const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
    const dec = new TextDecoder();
    const entries = new Map();
    for(let p = 0, i = 0; i < count; i++){
      if(cd.getUint32(p, true) !== 0x02014b50) break;
      const method = cd.getUint16(p + 10, true), size = cd.getUint32(p + 20, true);
      const nl = cd.getUint16(p + 28, true), xl = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true), lo = cd.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nl));
      entries.set(name, { method, size, lo });
      p += 46 + nl + xl + cl;
    }
    const read = async e => {
      const h = new DataView(await file.slice(e.lo, e.lo + 30).arrayBuffer());
      const start = e.lo + 30 + h.getUint16(26, true) + h.getUint16(28, true);
      return file.slice(start, start + e.size);
    };
    const man = entries.get('cs4lib.json');
    if(!man) throw new Error('That isn’t a Creator Studio library file');
    const list = JSON.parse(await (await read(man)).text());
    const have = await havePaths();
    let got = 0, same = 0;
    for(let i = 0; i < list.items.length; i++){
      const it = list.items[i];
      if(onProgress) onProgress(i, list.items.length);
      if(have.has(it.path)){ same++; continue; }
      const e = entries.get('files/' + it.path);
      if(!e || e.method !== 0) continue;
      const type = { gif:'image/gif', video:'video/mp4' }[it.kind] || '';
      const blob = new Blob([await read(e)], type ? { type } : {});
      if(await MediaLib.addBlob(blob, { name:it.name, kind:it.kind, label:it.label, caption:it.caption, link:it.link, tags:it.tags,
          library:it.library, page:it.page, path:it.path, from:it.uid })) got++;
    }
    MediaLib.invalidate && MediaLib.invalidate();
    return { got, same, total:list.items.length, title:list.title || '' };
  }

  /* on the phone: keep up to date with nastime by itself */
  if(typeof document !== 'undefined' && !global.CS_NO_AUTORUN){
    setTimeout(() => { if(isPhone()) update({ quiet:true }).catch(() => {}); }, 12000);
    setInterval(() => { if(isPhone()) update({ quiet:true }).catch(() => {}); }, EVERY);
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible' && isPhone() && Date.now() - lastRun > 10 * 60 * 1000) update({ quiet:true }).catch(() => {});
    });
  }
  /* the phone asks Android to keep its storage (not clear it under pressure) */
  if(isPhone() && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  global.PhoneLib = { keepList, setKeep, catalogue, update, drop, onPhone, exportFile, importFile, crc32 };
})(window);
