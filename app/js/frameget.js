/* Getting the GIFs this device's Library doesn't have.

   A template, task or starred group can point at a frame that lives on another
   device — a folder on the laptop, the app storage of the iPad. The frame may
   show here anyway (a kept copy, taskframes.js), but it isn't in this
   device's Library. FrameGet brings it in, into this device's own place for it:

     the laptop     its Shot Library folder, at the same <library>/<video>/…
                    path (electron/library.js cs3:lib-save)
     iPad, browser  the app's own storage, under the same library and video
                    names (MediaLib.addBlob, remembering where it came from)

   Where it looks, in order:
     1. a kept copy on this device (task-frames) — instant
     2. nastime's Shot Library, by its path inside the library
     3. otherwise it asks the other devices: a 'frame-requests' record (synced).
        The device that has the frame copies it into task-frames on its next
        sync (taskframes.js wants every requested frame); when that copy
        arrives here, fulfil() saves it and takes the request down.

   Only on a device with a Library (the laptop; the iPad reading nastime's).
   The phone has no Library — kept copies are all it needs. */
(function(global){
  const REQ = 'frame-requests';
  const DEV_KEY = 'cs4.dev';
  const esc = s => U.esc(s);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const safe = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'frame';
  const device = () => {
    try { let d = localStorage.getItem(DEV_KEY); if(!d){ d = 'd' + Math.random().toString(36).slice(2, 10); localStorage.setItem(DEV_KEY, d); } return d; }
    catch(e){ return 'here'; }
  };
  const can = () => !!(global.MediaLib && MediaLib.hasLibrary());
  const all = async store => { try { return (await Store.all(store)).values || []; } catch(e){ return []; } };

  /* in this device's own Library? (a kept copy doesn't count) */
  const inLibrary = (lib, uid) => { const it = MediaLib.find(lib, uid); return !!(it && it.src !== 'tf'); };
  async function missing(uids){
    if(!can()) return [];
    const lib = await MediaLib.load();
    return [...new Set(uids || [])].filter(u => u && !inLibrary(lib, u));
  }

  /* where a frame belongs: its path inside a library, and the names */
  async function originOf(uid){
    const kept = await Store.get('task-frames', uid).catch(() => null);
    const path = (kept && kept.path) || (uid.startsWith('h:') ? uid.slice(uid.indexOf('|') + 1) : '');
    const parts = path ? path.split('/') : [];
    let library = kept && kept.library, page = kept && kept.page;
    if(!library && parts.length > 1) library = parts[0];
    if(!page && parts.length > 2){
      const dirs = parts.slice(1, -1);
      if(['gifs', 'videos', 'images', 'stills', 'clips'].includes((dirs[dirs.length - 1] || '').toLowerCase())) dirs.pop();
      page = dirs.join(' / ');
    }
    return { uid, path, kept, library: library || 'From other devices', page: page || 'Fetched',
             name: (kept && kept.name) || parts[parts.length - 1] || 'frame', kind: kept && kept.kind,
             label: (kept && kept.label) || '', caption: (kept && kept.caption) || '' };
  }

  /* nastime's Shot Library list, read once per run */
  async function nasIndex(){
    const base = global.Updater && Updater.nasAddress ? await Updater.nasAddress().catch(() => '') : '';
    if(!base) return null;
    const url = base + 'shotlib-index.json';
    try {
      const d = MediaLib.disk();
      const j = d && d.fetchJson ? await d.fetchJson(url)
        : await (await fetch(url + '?t=' + Date.now(), { cache:'no-store' })).json();
      if(!j || j.format !== 'cs4-shotlib') return null;
      const byPath = new Map(j.items.map(it => [it.path, new URL(it.url, base).href]));
      return { byPath };
    } catch(e){ return null; }
  }

  /* put one frame into this device's Library */
  async function save(o, blob, url){
    const d = MediaLib.disk();
    if(d && d.saveFrame){
      const rel = o.path || [safe(o.library), safe(o.page), safe(o.name)].join('/');
      const r = await d.saveFrame(url ? { path:rel, url } : { path:rel, data: new Uint8Array(await blob.arrayBuffer()) });
      return !!(r && r.ok);
    }
    if(!blob && url){ const r = await fetch(url); if(!r.ok) return false; blob = await r.blob(); }
    if(!blob) return false;
    return !!(await MediaLib.addBlob(blob, { name:o.name, kind:o.kind, label:o.label, caption:o.caption,
      library:o.library, page:o.page, from:o.uid }));
  }

  /* Get these frames. Returns what came in now and what was asked for. */
  async function getAll(uids, onProgress){
    const out = { got:0, asked:0, failed:0 };
    const want = await missing(uids);
    if(!want.length) return out;
    let nas;            /* read only if a frame needs it */
    const mine = device();
    for(let i = 0; i < want.length; i++){
      const uid = want[i];
      if(onProgress) onProgress(i, want.length);
      const o = await originOf(uid);
      let ok = false;
      try {
        if(o.kept && o.kept.blob) ok = await save(o, o.kept.blob);
        if(!ok && o.path){
          if(nas === undefined) nas = await nasIndex();
          const url = nas && nas.byPath.get(o.path);
          if(url) ok = await save(o, null, url);
        }
      } catch(e){ ok = false; }
      if(ok){ out.got++; await Store.del(REQ, uid).catch(() => {}); continue; }
      /* nobody here has it: ask the other devices */
      await Store.put(REQ, { uid, path:o.path, by:mine, at:Date.now() }).catch(() => {});
      out.asked++;
    }
    if(out.got){ await MediaLib.rescan(); }
    if(out.asked && global.Sync && Sync.nudge) Sync.nudge();
    return out;
  }

  /* a requested frame arrived as a kept copy: save it, take the request down */
  let fulfilling = null;
  function fulfil(){
    if(fulfilling || !can()) return fulfilling;
    fulfilling = (async () => {
      const mine = device();
      const reqs = (await all(REQ)).filter(r => r && r.by === mine);
      let n = 0;
      for(const r of reqs){
        const o = await originOf(r.uid);
        if(!(o.kept && o.kept.blob)) continue;
        if(await save(o, o.kept.blob).catch(() => false)){ n++; await Store.del(REQ, r.uid).catch(() => {}); }
      }
      if(n){
        await MediaLib.rescan();
        U.toast(`${plural(n, 'GIF')} you asked for ${n === 1 ? 'is' : 'are'} in this device’s Library now`);
        if(global.Screens && Screens.refreshTop) Screens.refreshTop();
      }
      return n;
    })().finally(() => { fulfilling = null; });
    return fulfilling;
  }
  /* requests other devices made, for taskframes.js wanted() */
  async function requested(){ return (await all(REQ)).map(r => r && r.uid).filter(Boolean); }

  /* "3 GIFs aren't in this device's Library · Get them" at the top of `box` */
  async function bar(box, uids, after){
    if(!box || !can()) return;
    const want = await missing(uids);
    box.querySelectorAll(':scope > .lv-missbar').forEach(x => x.remove());
    if(!want.length || !box.isConnected) return;
    const asked = new Set(await requested());
    const waiting = want.filter(u => asked.has(u)).length;
    const el = document.createElement('div');
    el.className = 'lv-missbar';
    el.innerHTML = `<span>↓ <b>${plural(want.length, 'GIF')}</b> ${want.length === 1 ? 'isn’t' : 'aren’t'} in this device’s Library${
        waiting ? ` <small>· ${waiting} asked for, waiting for the device that has ${waiting === 1 ? 'it' : 'them'}</small>` : ''}</span>
      <button type="button" class="lv-btn sm" data-getall>${want.length === 1 ? 'Get it' : 'Get them all'}</button>`;
    box.prepend(el);
    el.querySelector('[data-getall]').addEventListener('click', async ev => {
      ev.stopPropagation();
      const b = ev.currentTarget; b.disabled = true;
      const r = await getAll(want, (i, n) => { b.textContent = `Getting ${i + 1} of ${n}…`; });
      U.toast([r.got && `${plural(r.got, 'GIF')} added to this device’s Library`,
               r.asked && `${plural(r.asked, 'GIF')} asked for — ${r.asked === 1 ? 'it arrives' : 'they arrive'} when the device that has ${r.asked === 1 ? 'it' : 'them'} syncs`]
        .filter(Boolean).join(' · ') || 'Nothing to get');
      if(after) after(); else if(global.Screens && Screens.refreshTop) Screens.refreshTop();
    });
  }

  /* one frame's own ↓ button (a missing tile) */
  if(typeof document !== 'undefined'){
    document.addEventListener('click', async e => {
      const b = e.target.closest('[data-getone]');
      if(!b) return;
      e.preventDefault(); e.stopPropagation();
      b.disabled = true; b.textContent = 'Getting…';
      const r = await getAll([b.dataset.getone]);
      U.toast(r.got ? 'Added to this device’s Library' : r.asked ? 'Asked for — it arrives when the device that has it syncs' : 'Couldn’t find it');
      if(global.Screens && Screens.refreshTop) Screens.refreshTop();
    }, true);
    if(!global.CS_NO_AUTORUN){
      setTimeout(() => { fulfil(); }, 9000);
      if(global.Sync && Sync.onChange) Sync.onChange(() => { setTimeout(() => fulfil(), 4000); });
    }
  }

  global.FrameGet = { missing, getAll, fulfil, requested, bar, originOf, REQ };
})(window);
