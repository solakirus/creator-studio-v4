/* Keep on this device — the phone and the iPad keep their own copies of the
   Shot Library folders you pick, so their Library works anywhere, offline.

   The Shot Library lives on nastime. Every device browses it there whenever
   it can reach nastime (medialib.js readRemote), and keeps the folders you
   switch on (Library → Folders → Keep on this device) in the app's own storage
   (MediaLib.addBlob), each copy keeping its path in the Shot Library — so
   templates, shots and tasks made on any device find it here.

   New GIFs in a kept folder: the device notices (at start, coming back to the
   app, every 30 minutes) and asks — "Lifestyle has 12 new GIFs · Download ·
   Not now" — or downloads them by itself if you said so. */
(function(global){
  const KEY = 'phoneKeep';                 /* in the 'library' settings: { libs:[], pages:[] } */
  const EVERY = 30 * 60 * 1000;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  /* the phone app and the iPad (the laptop reads nastime's folder itself) */
  const isPhone = () => !!(global.MediaLib && MediaLib.keeps && MediaLib.keeps());
  const native = () => !!(global.MediaLib && MediaLib.phone && MediaLib.phone());
  const listeners = new Set();
  const tell = st => listeners.forEach(f => { try { f(st); } catch(e){} });

  /* { all, libs, pages } — all: everything on nastime, new folders too, kept in step */
  async function keepList(){ const s = await MediaLib.settings(); const k = s[KEY] || {}; return { all: !!k.all, libs: k.libs || [], pages: k.pages || [] }; }
  async function setKeep(k){ const was = await keepList();
    await MediaLib.setSettings({ [KEY]: { all: k.all !== undefined ? !!k.all : was.all, libs: [...new Set(k.libs || [])], pages: [...new Set(k.pages || [])] } }); }
  const keepsAny = k => k.all || k.libs.length || k.pages.length;

  /* ------------------------------------------------------------ nastime */
  /* outside the page on the phone (no CORS, no mixed-content worries) */
  async function get(url, as){
    const http = global.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;
    if(http && native()){
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
  /* nastime's libraries and videos: [{ name, pages:[{ dir, name, count, items:[…] }] }]
     (the same nastime the Library reads: the page's own address, else Settings) */
  async function catalogue(){
    const j = await MediaLib.readRemote();
    const b = j.base;
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
      if(!keepsAny(k)) return { got:0, failed:0, total:0 };
      let cat;
      try { cat = await catalogue(); } catch(e){ if(!opts.quiet) U.toast('Can’t reach nastime — ' + e.message); return { offline:true, got:0, failed:0, total:0 }; }
      const have = await havePaths();
      const want = wanted(cat, k, have).filter(([, p]) => !opts.lib || p.library === opts.lib);
      let got = 0, failed = 0, next = 0, done = 0;
      /* three at a time; what's already here was left out above */
      const worker = async () => {
        while(next < want.length){
          const [it, p] = want[next++];
          try {
            const blob = await get(it.url, 'blob');
            const name = it.path.split('/').pop();
            if(await MediaLib.addBlob(blob, { name, kind:it.kind, label:it.label, caption:it.caption, link:it.link, tags:it.tags,
                library:p.library, page:p.page, path:it.path, from:it.uid, fresh:true })) got++;
          } catch(e){ failed++; }
          done++;
          if(opts.onProgress) opts.onProgress(done - 1, want.length);
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      const gone = await prune(cat, k);
      if(gone && !opts.quiet) U.toast(`${plural(gone, 'GIF')} gone from nastime — taken off this ${where()} too`);
      lastRun = Date.now();
      if(got){ MediaLib.invalidate && MediaLib.invalidate(); U.toast(`${plural(got, 'GIF')} now on this ${where()}${failed ? ` · ${failed} couldn’t be downloaded` : ''}`); }
      else if(!opts.quiet) U.toast(failed ? `${failed} couldn’t be downloaded` : `Everything you keep is already on this ${where()}`);
      newOnes = await check({ cat });
      return { got, failed, total:want.length };
    })().finally(() => { running = null; });
    return running;
  }

  /* an Android tablet (the Lenovo) runs the phone app too: it's a tablet when its short side is wide */
  const bigScreen = () => { try { return Math.min(screen.width, screen.height) >= 600; } catch(e){ return false; } };
  const where = () => native() ? (bigScreen() ? 'tablet' : 'phone') : /iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 ? 'iPad' : 'device';

  /* what nastime has for the kept folders that this device doesn't, as [item, page] */
  function wanted(cat, k, have){
    const out = [];
    for(const l of cat) for(const p of l.pages)
      if(k.all || k.libs.includes(l.name) || k.pages.includes(p.dir)) for(const it of p.items) if(!have.has(it.path)) out.push([it, p]);
    return out;
  }

  /* ------------------------------------------------------------ "new GIFs" */
  /* { total, libs:[{ name, n }] } — new GIFs on nastime for the kept folders */
  let newOnes = { total:0, libs:[] };
  async function check(o){
    let cat = o && o.cat;
    const k = await keepList();
    if(!keepsAny(k)){ newOnes = { total:0, libs:[] }; tell(newOnes); return newOnes; }
    if(!cat){ try { cat = await catalogue(); } catch(e){ return newOnes; } }
    const by = new Map();
    for(const [, p] of wanted(cat, k, await havePaths())) by.set(p.library, (by.get(p.library) || 0) + 1);
    const libs = [...by].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
    newOnes = { total:libs.reduce((a, l) => a + l.n, 0), libs };
    tell(newOnes);
    return newOnes;
  }
  async function auto(){ return !!(await MediaLib.settings()).keepAuto; }
  async function setAuto(on){ await MediaLib.setSettings({ keepAuto: !!on }); }
  /* "Not now": quiet until more arrive than were offered */
  const snoozeKey = 'cs4.keepSnooze';
  const snoozed = () => { try { return +localStorage.getItem(snoozeKey) || 0; } catch(e){ return 0; } };
  function snooze(){ try { localStorage.setItem(snoozeKey, String(newOnes.total)); } catch(e){} tell(newOnes); }

  /* the background round: look, then download (when told to) or ask */
  async function round(){
    if(!isPhone() || running) return;
    let cat = null;
    try { cat = await catalogue(); } catch(e){ return; }
    const n = await check({ cat });
    lastRun = Date.now();
    const gone = await prune(cat, await keepList()).catch(() => 0);
    if(gone){ MediaLib.invalidate && MediaLib.invalidate(); try { if(global.App && App.refreshTab) App.refreshTab(); } catch(e){} }
    if(!n.total) return;
    if(await auto()) return update({ quiet:true });
    if(n.total > snoozed()) prompt(n);
  }

  /* the prompt, over whatever screen is open */
  function prompt(n){
    if(typeof document === 'undefined' || !document.body) return;
    let el = document.getElementById('keepPrompt');
    if(!el){ el = document.createElement('div'); el.id = 'keepPrompt'; el.className = 'keep-prompt'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = `<span>${promptText(n)}</span>
      <button class="lv-btn sm" data-kp="get">Download</button><button class="lv-btn sm ghost" data-kp="later">Not now</button>`;
    el.onclick = async e => {
      const b = e.target.closest('[data-kp]');
      if(!b) return;
      el.remove();
      if(b.dataset.kp === 'later') return snooze();
      U.toast('Downloading…');
      await update({ onProgress:(i, t) => { if(i && i % 10 === 0) U.toast(`Downloading ${i + 1} of ${t}…`); } });
      try { if(global.App && App.refreshTab) App.refreshTab(); } catch(e){}
    };
  }
  const promptText = n => n.libs.length === 1
    ? `<b>${esc(n.libs[0].name)}</b> has ${plural(n.total, 'new GIF')}`
    : `${plural(n.total, 'new GIF')} in ${n.libs.slice(0, 2).map(l => `<b>${esc(l.name)}</b>`).join(' and ')}${n.libs.length > 2 ? ` and ${n.libs.length - 2} more` : ''}`;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);

  /* in step with nastime: a kept copy whose file is gone from nastime goes
     here too. Only when nastime's list is whole — never when it suddenly
     holds less than half of what this device keeps (a folder not mounted,
     a scan that failed) */
  async function prune(cat, k){
    if(!cat || !keepsAny(k)) return 0;
    const there = new Set();
    let n = 0;
    for(const l of cat) for(const p of l.pages) for(const it of p.items){ there.add(it.path); n++; }
    const recs = (await Store.all('lib-items').catch(() => ({ values:[] }))).values.filter(r => r.path);
    const inScope = r => k.all || k.libs.includes(r.library) || k.pages.some(d => r.path.startsWith(d + '/'));
    const kept = recs.filter(inScope);
    if(!kept.length || n < kept.length / 2) return 0;
    const gone = kept.filter(r => !there.has(r.path));
    if(!gone.length) return 0;
    await MediaLib.remove(gone.map(r => 'db:' + r.id));
    return gone.length;
  }

  /* stop keeping a library or video: its copies leave the phone */
  async function drop(sel){
    const recs = (await Store.all('lib-items').catch(() => ({ values:[] }))).values;
    if(sel.all){
      const gone = recs.filter(r => r.path);
      await setKeep({ all:false, libs:[], pages:[] });
      if(gone.length) await MediaLib.remove(gone.map(r => 'db:' + r.id));
      return gone.length;
    }
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

  /* keep up with nastime by itself */
  if(typeof document !== 'undefined' && !global.CS_NO_AUTORUN){
    setTimeout(() => { round().catch(() => {}); }, 12000);
    setInterval(() => { round().catch(() => {}); }, EVERY);
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible' && Date.now() - lastRun > 10 * 60 * 1000) round().catch(() => {});
    });
  }
  /* ask the device to keep this storage (not clear it when space runs low) */
  if(isPhone() && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  global.PhoneLib = { prune, keepList, setKeep, catalogue, update, drop, onPhone, check, round, auto, setAuto, snooze,
    newOnes: () => newOnes, onNew: f => { listeners.add(f); return () => listeners.delete(f); }, where, promptText, isPhone };
})(window);
