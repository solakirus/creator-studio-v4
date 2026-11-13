/* Cover pictures for episodes (vlogs), series and clips.

   Your own artwork in place of the generated pattern on a card. Kept in the
   'art' store (the one Today's card images already use, so it syncs to the
   phone with no new store to wait for), keyed  cover:<kind>:<id>.
   A clip with no cover of its own shows its series' cover.

     await Cover.ready()                       before drawing a list
     Cover.bg('clip', id, fallback, ['series', sid])   a background-image value
     Cover.btn('clip', id)                     the hover button that sets it

   Big phone photos are shrunk to 1600px on the long side before they are
   kept, so they travel quickly. A change fires window 'cs-cover'. */
(function(global){
  const PFX = 'cover:';
  const key = (kind, id) => PFX + kind + ':' + id;
  let urls = {}, sizes = {};

  async function load(){
    let blobs = {};
    try { blobs = await Store.allMap('art'); } catch(e){ return; }
    const next = {}, nextSize = {};
    Object.entries(blobs).forEach(([k, b]) => {
      if(!k.startsWith(PFX) || !b || !b.size) return;
      /* the same picture keeps its URL, so nothing on screen blinks */
      next[k] = (urls[k] && sizes[k] === b.size) ? urls[k] : URL.createObjectURL(b);
      nextSize[k] = b.size;
    });
    Object.keys(urls).forEach(k => { if(urls[k] !== next[k]) URL.revokeObjectURL(urls[k]); });
    urls = next; sizes = nextSize;
  }
  /* Re-read on every list mount: a cover may have come in from another device.
     One read at a time, in order — two overlapping reads let the older one
     finish last and throw away a picture that had just been saved. */
  let chain = Promise.resolve();
  function reload(){ chain = chain.then(load, load); return chain; }
  function ready(){ return global.Store ? reload() : Promise.resolve(); }

  const has = (kind, id) => !!urls[key(kind, id)];
  function url(kind, id, also){
    if(urls[key(kind, id)]) return urls[key(kind, id)];
    if(also && also[1] && urls[key(also[0], also[1])]) return urls[key(also[0], also[1])];
    return null;
  }
  const bg = (kind, id, fallback, also) => { const u = url(kind, id, also); return u ? `url(${u})` : fallback; };

  const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/>
    <path d="M21 15.5l-5-5-9 9"/></svg>`;
  const btn = (kind, id) => `<button type="button" class="cvbtn" data-cover="${kind}|${String(id).replace(/"/g, '&quot;')}"
    aria-label="Cover picture" title="${has(kind, id) ? 'Change or remove the cover' : 'Add a cover picture'}">${ICON}</button>`;

  async function shrink(file){
    const MAX = 1600;
    try {
      const im = await createImageBitmap(file);
      const s = Math.min(1, MAX / Math.max(im.width, im.height));
      if(s === 1 && file.size < 900000) return file;
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const out = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
      return out && out.size ? out : file;
    } catch(e){ return file; }
  }

  function changed(kind, id){
    global.dispatchEvent(new CustomEvent('cs-cover', { detail:{ kind, id } }));
  }
  async function set(kind, id, file){
    const b = await shrink(file);
    await Store.put('art', b, key(kind, id));
    await reload(); changed(kind, id);
  }
  async function remove(kind, id){
    await Store.del('art', key(kind, id));
    await reload(); changed(kind, id);
  }

  function pick(kind, id){
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if(!f) return;
      try { await set(kind, id, f); U.toast('Cover saved'); }
      catch(e){ console.error(e); U.toast("Couldn't save that picture"); }
    });
    inp.click();
  }

  /* a cover already there: change it or take it off */
  function menu(b, kind, id){
    closeMenu();
    const m = document.createElement('div');
    m.className = 'cvmenu';
    m.innerHTML = `<button type="button" data-cv="change">Change picture…</button>
      <button type="button" data-cv="remove">Remove cover</button>`;
    document.body.appendChild(m);
    const r = b.getBoundingClientRect();
    m.style.top = Math.min(innerHeight - m.offsetHeight - 8, r.bottom + 6) + 'px';
    m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px';
    m.addEventListener('click', async e => {
      const a = e.target.closest('[data-cv]'); if(!a) return;
      closeMenu();
      if(a.dataset.cv === 'change') pick(kind, id);
      else { await remove(kind, id); U.toast('Cover removed'); }
    });
  }
  function closeMenu(){ document.querySelectorAll('.cvmenu').forEach(m => m.remove()); }

  /* Capture, and stopped: the button sits on a card whose own click opens it */
  document.addEventListener('click', e => {
    if(!e.target.closest) return;
    if(!e.target.closest('.cvmenu')) closeMenu();
    const b = e.target.closest('[data-cover]');
    if(!b) return;
    e.preventDefault(); e.stopPropagation();
    const [kind, ...rest] = b.dataset.cover.split('|'), id = rest.join('|');
    if(has(kind, id)) menu(b, kind, id); else pick(kind, id);
  }, true);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeMenu(); });

  global.Cover = { ready, has, url, bg, btn, set, remove, pick, key };
})(window);
