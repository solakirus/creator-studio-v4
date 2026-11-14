/* Swipe identity — one saved video is one swipe, on every device.

   Swipe ids used to be random, so the same Instagram save imported on the
   laptop and again on the phone (before they had synced) became two records
   that sync could only keep side by side. Now a swipe made from a link gets
   an id worked out from the link itself: the same save makes the same id
   wherever it is added, and sync sees one swipe.

     SwipeKey.key(url)     'ig:CODE', 'yt:ID', … — the same video however copied
     SwipeKey.idFor(url)   'swk_…' from the key (a random 'sw_…' with no link)
     SwipeKey.doubles(list)        groups of swipes that are the same video
     await SwipeKey.mergeAll()     each group into one — folders, notes, cover
                                   and every reference to it kept

   The one kept is chosen the same way on every device (oldest, then id), so
   two devices merging at once agree on it. */
(function(global){

  function ytId(url){
    const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  /* Same video, however it was copied: tracking params and trailing slashes
     don't count, and every YouTube form collapses to its 11-char id. */
  function key(url){
    const u = String(url || '').trim();
    if(!u) return '';
    const yt = ytId(u);
    if(yt) return 'yt:' + yt;
    const c = global.SwipeImport && SwipeImport.classify(u);
    if(c) return c.key;
    try {
      const p = new URL(u);
      const host = p.hostname.replace(/^(www\.|m\.)/, '');
      const v = host.includes('facebook') ? (p.searchParams.get('v') || '') : '';
      return (host + p.pathname.replace(/\/+$/, '') + (v ? '?v=' + v : '')).toLowerCase();
    } catch(e){ return u.toLowerCase(); }
  }

  /* two 32-bit FNV-1a passes with different seeds: ~64 bits, plenty for a
     swipe file, and the same on every device */
  function hash(s){
    let a = 0x811c9dc5, b = 0x9747b28c;
    for(let i = 0; i < s.length; i++){
      const c = s.charCodeAt(i);
      a ^= c; a = Math.imul(a, 16777619);
      b ^= c; b = Math.imul(b, 2246822519);
    }
    return (a >>> 0).toString(36) + (b >>> 0).toString(36);
  }
  const random = () => 'sw_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const idFor = url => { const k = key(url); return k ? 'swk_' + hash(k) : random(); };

  function doubles(list){
    const by = {};
    (list || []).forEach(s => { const k = key(s && s.url); if(k) (by[k] = by[k] || []).push(s); });
    return Object.values(by).filter(g => g.length > 1);
  }

  /* oldest first, then id — the same answer on every device */
  const rank = (a, b) => ((a.createdAt || 0) - (b.createdAt || 0)) || String(a.id).localeCompare(String(b.id));
  const blank = v => v == null || v === '' || (Array.isArray(v) && !v.length) || v === 'Untitled swipe';
  const TEXT = ['title', 'hook', 'why', 'transferable', 'myAngle', 'author', 'imageUrl', 'savedAt', 'importedFrom', 'notes'];
  const UNION = ['folders', 'channels', 'targets'];

  function combine(group){
    const [keep, ...rest] = group.slice().sort(rank);
    const out = { ...keep };
    for(const s of rest){
      TEXT.forEach(f => { if(blank(out[f]) && !blank(s[f])) out[f] = s[f]; });
      UNION.forEach(f => { const u = [...new Set([...(out[f] || []), ...(s[f] || [])])]; if(u.length) out[f] = u; });
      if((s.beats || []).length > (out.beats || []).length) out.beats = s.beats;
      Object.keys(s).forEach(f => { if(!(f in out)) out[f] = s[f]; });
    }
    /* filed anywhere means sorted */
    out.inbox = group.every(s => s.inbox) && !(out.folders || []).length;
    if(!out.inbox) delete out.inbox;
    return { keep:out, gone:rest.map(s => s.id) };
  }

  /* point tasks and clips that used a merged-away swipe at the one kept */
  function remap(v, map){
    let changed = false;
    const walk = x => {
      if(Array.isArray(x)){ x.forEach(walk); return; }
      if(!x || typeof x !== 'object') return;
      for(const k of Object.keys(x)){
        if(k === 'swipeId' && map[x[k]]){ x[k] = map[x[k]]; changed = true; }
        else if(k === 'swipeIds' && Array.isArray(x[k]) && x[k].some(id => map[id])){
          x[k] = [...new Set(x[k].map(id => map[id] || id))]; changed = true;
        }
        else if(x[k] && typeof x[k] === 'object') walk(x[k]);
      }
    };
    walk(v);
    return changed;
  }

  async function mergeAll(){
    const list = (await Store.all('swipes')).values;
    const groups = doubles(list);
    if(!groups.length) return { groups:0, removed:0 };
    const map = {};
    let removed = 0;
    for(const g of groups){
      const { keep, gone } = combine(g);
      await Store.put('swipes', keep);
      let thumb = null;
      try { thumb = await Store.get('swipe-thumb', keep.id); } catch(e){}
      for(const id of gone){
        map[id] = keep.id;
        if(!thumb){
          try { const t = await Store.get('swipe-thumb', id); if(t){ await Store.put('swipe-thumb', t, keep.id); thumb = t; } } catch(e){}
        }
        try { await Store.del('swipe-thumb', id); } catch(e){}
        await Store.del('swipes', id);
        removed++;
      }
    }
    for(const st of ['tasks', 'clips', 'videos', 'vlogs']){
      let rows = [];
      try { rows = (await Store.all(st)).values; } catch(e){ continue; }
      for(const r of rows) if(remap(r, map)) await Store.put(st, r);
    }
    try { if(global.Data && Data.invalidate) Data.invalidate(); } catch(e){}
    return { groups:groups.length, removed };
  }

  global.SwipeKey = { key, idFor, doubles, combine, mergeAll, hash };
})(window);
