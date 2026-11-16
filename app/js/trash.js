/* Recently deleted — 30 days to change your mind, on every device.

   Whatever deletes a video, episode, clip, series, template, sequence, swipe
   or task goes through Store.del. Just before it does, a copy goes into the
   'trash' store, which syncs like everything else — so a delete on the iPad
   can be undone on the laptop, and the other way round.

   - Deletes within a few seconds of each other are one group (an episode
     and its shoot tasks): Restore brings the whole group back.
   - A delete that reaches this device from another one (sync.js apply) keeps
     this device's version too when it's different — the edit the phone made
     before the offline iPad's delete reached it, say — so neither is lost.
   - Tasks the app makes and remakes on its own (habits, routines, the plan)
     aren't kept.
   - Older than 30 days: gone for good, on every device.

     Trash.list() → groups · Trash.restore(group) · Trash.forget(group) */
(function(global){
  const STORE = 'trash';
  const KEEP_DAYS = 30;
  const GROUP_MS = 4000;
  /* what's worth keeping, most important first (the group's name comes from the first) */
  const KINDS = { vlogs:'Episode', videos:'Video', series:'Series', clips:'Clip', 'shot-templates':'Template',
    'seq-template':'Sequence', months:'Month', quarters:'Quarter', challenges:'Challenge', swipes:'Swipe',
    transitions:'Transition', refs:'Reference', inbox:'Capture', 'my-shots':'Shot', tasks:'Task' };
  const ORDER = Object.keys(KINDS);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* tasks the app makes and clears by itself */
  const madeByApp = t => !!(t && (t.habitId || t.slotKey || (typeof t.series === 'string' && t.series) || t.routineId || t.planId || t.auto));
  const worth = (store, v) => v !== undefined && v !== null && (store !== 'tasks' || !madeByApp(v));
  const idOf = (store, key) => store + '|' + JSON.stringify(key);
  const titleOf = v => {
    if(!v || typeof v !== 'object') return '';
    const t = v.title || v.name || v.label || v.hook || v.text || v.caption || '';
    return String(t).replace(/\s+/g, ' ').trim().slice(0, 90);
  };
  const device = () => {
    if(global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) return 'phone';
    if(global.CS3Lib) return 'computer';
    if(/iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) return 'iPad';
    return 'browser';
  };

  let group = null, groupAt = 0;
  const groupNow = () => {
    const now = Date.now();
    if(!group || now - groupAt > GROUP_MS) group = 'g' + now.toString(36) + Math.random().toString(36).slice(2, 6);
    groupAt = now;
    return group;
  };

  async function keep(store, key, value, extra){
    const rec = { id: idOf(store, key) + (extra && extra.suffix ? '|' + extra.suffix : ''), store, key, value,
      at: Date.now(), group: (extra && extra.group) || groupNow(), on: device(), title: titleOf(value),
      note: (extra && extra.note) || '' };
    await Store.put(STORE, rec);
    return rec;
  }

  /* every delete the app makes */
  const del0 = Store.del;
  let quiet = 0;   /* Restore and Forget delete without keeping */
  Store.del = async function(store, key){
    if(!quiet && KINDS[store] && store !== STORE){
      try {
        const v = await Store.get(store, key);
        if(worth(store, v)){ const r = await keep(store, key, v); offerUndo(r); }
      } catch(e){ console.warn('trash: could not keep a copy', e); }
    }
    return del0(store, key);
  };

  /* sync.js: another device's delete is about to land here */
  async function fromElsewhere(store, key, mine){
    if(!KINDS[store] || !worth(store, mine)) return;
    try {
      const there = await Store.get(STORE, idOf(store, key));
      const same = there && global.Merge ? Merge.same(there.value, mine) : there && JSON.stringify(there.value) === JSON.stringify(mine);
      if(same) return;
      await keep(store, key, mine, { suffix: 'here-' + device(), group: there ? there.group : undefined,
        note: there ? `this ${device()}’s version — it had changes the other device’s copy didn’t` : '' });
    } catch(e){ console.warn('trash: could not keep this device’s version', e); }
  }

  async function entries(){
    let recs = [];
    try { recs = (await Store.all(STORE)).values; } catch(e){ recs = []; }
    return recs.filter(r => r && r.store && r.group);
  }

  /* groups, newest first: [{ group, at, on, lead, items:[…], kinds }]. Things
     that are back already (an edit elsewhere won over the delete) are left out. */
  async function list(){
    const all = await entries();
    const live = await Promise.all(all.map(r => Store.get(r.store, r.key).then(v => v !== undefined).catch(() => false)));
    const by = new Map();
    all.forEach((r, i) => {
      if(live[i]) return;
      if(!by.has(r.group)) by.set(r.group, []);
      by.get(r.group).push(r);
    });
    const out = [...by].map(([g, items]) => {
      items.sort((a, b) => ORDER.indexOf(a.store) - ORDER.indexOf(b.store) || a.at - b.at);
      /* the same record twice (from two devices) and identical: once */
      const seen = new Map();
      items = items.filter(r => {
        const k = idOf(r.store, r.key), was = seen.get(k);
        if(was && (global.Merge ? Merge.same(was.value, r.value) : JSON.stringify(was.value) === JSON.stringify(r.value))) return false;
        if(!was) seen.set(k, r);
        return true;
      });
      const lead = items[0];
      return { group:g, at:Math.max(...items.map(x => x.at)), on:lead.on, lead, items,
        title: lead.title || KINDS[lead.store], kind: KINDS[lead.store],
        versions: items.filter(x => /\|here-/.test(x.id)) };
    });
    return out.sort((a, b) => b.at - a.at);
  }
  async function count(){ return (await list()).length; }

  const invalidate = stores => {
    try { if(global.Data && Data.invalidate) [...new Set(stores)].forEach(s => Data.invalidate(s)); } catch(e){}
    try { if(global.App && App.refreshTab) App.refreshTab(); } catch(e){}
  };

  /* bring a group back. `pick` chooses which version of a record that has two
     (default: the newest kept) */
  async function restore(g, pick){
    const grp = typeof g === 'string' ? (await list()).find(x => x.group === g) : g;
    if(!grp) return 0;
    const kp = await layout();
    const chosen = new Map();
    for(const r of grp.items){
      const k = idOf(r.store, r.key);
      if(pick && pick[k]){ if(r.id === pick[k]) chosen.set(k, r); continue; }
      const was = chosen.get(k);
      if(!was || r.at > was.at) chosen.set(k, r);
    }
    let n = 0;
    for(const r of chosen.values()){
      if(await Store.get(r.store, r.key).catch(() => undefined) !== undefined) continue;
      if(kp[r.store]) await Store.put(r.store, r.value); else await Store.put(r.store, r.value, r.key);
      n++;
    }
    quiet++;
    try { for(const r of grp.items) await Store.del(STORE, r.id); } finally { quiet--; }
    invalidate(grp.items.map(r => r.store));
    return n;
  }
  async function forget(g){
    const grp = typeof g === 'string' ? (await list()).find(x => x.group === g) : g;
    if(!grp) return 0;
    quiet++;
    try { for(const r of grp.items) await Store.del(STORE, r.id); } finally { quiet--; }
    return grp.items.length;
  }
  /* 30 days on: gone for good (and entries for things that are back) */
  async function sweep(){
    const cut = Date.now() - KEEP_DAYS * 86400000;
    let n = 0;
    quiet++;
    try {
      for(const r of await entries()){
        if(r.at < cut){ await Store.del(STORE, r.id); n++; }
      }
    } finally { quiet--; }
    return n;
  }
  let kp0 = null;
  async function layout(){
    if(kp0) return kp0;
    const d = await Store.db(), names = [...d.objectStoreNames], out = {};
    if(names.length){ const t = d.transaction(names, 'readonly'); names.forEach(n => { out[n] = t.objectStore(n).keyPath || null; }); }
    return kp0 = out;
  }

  /* "Deleted “Morning routine” · Undo", for a few seconds after a delete */
  let undoTimer = null, undoGroup = null;
  let undoRank = 99;
  function offerUndo(rec){
    if(typeof document === 'undefined' || !document.body) return;
    const rank = ORDER.indexOf(rec.store);
    /* one bar per group, named after its most important thing (the episode, not its tasks) */
    if(undoGroup === rec.group && rank >= undoRank) return;
    undoGroup = rec.group; undoRank = rank;
    let el = document.getElementById('undoBar');
    if(!el){ el = document.createElement('div'); el.id = 'undoBar'; el.className = 'undo-bar'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = `<span>Deleted ${rec.title ? `“${esc(rec.title)}”` : 'a ' + KINDS[rec.store].toLowerCase()}</span><button class="lv-btn sm" data-undo>Undo</button>`;
    el.classList.add('on');
    const g = rec.group;
    el.onclick = async e => {
      if(!e.target.closest('[data-undo]')) return;
      el.classList.remove('on');
      const n = await restore(g);
      if(global.U) U.toast(n ? 'Brought back' : 'Nothing to bring back');
    };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => { el.classList.remove('on'); undoGroup = null; undoRank = 99; }, 7000);
  }

  const ago = t => { const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };

  /* the sheet: Settings → Recently deleted */
  async function open(after){
    const groups = await list();
    const card = g => `<div class="tr-item" data-g="${esc(g.group)}">
        <div class="tr-main"><b>${esc(g.title)}</b>
          <small>${esc(g.kind)}${g.items.length > 1 ? ` · ${plural(g.items.length - 1, 'linked item')}` : ''} · deleted ${ago(g.at)} on the ${esc(g.on)}</small>
          ${g.versions.length ? `<small class="tr-two">⚠ Two versions: the deleted one and ${g.versions.map(v => `the ${esc(v.on)}’s`).join(', ')} (it had changes the other didn’t). Restore brings back the newest; pick below.</small>` : ''}</div>
        <div class="tr-acts"><button class="btn-primary sm" data-restore>Restore</button><button class="btn-ghost sm" data-forget aria-label="Delete for good">✕</button></div>
        ${g.versions.length ? `<div class="tr-vers">${g.items.filter(x => x.store === g.lead.store && JSON.stringify(x.key) === JSON.stringify(g.lead.key)).map(x =>
          `<button class="btn-ghost sm" data-ver="${esc(x.id)}">Restore the ${esc(x.on)}’s (${ago(x.at)})</button>`).join('')}</div>` : ''}
      </div>`;
    App.sheet(`<h2 style="margin:0 0 6px">Recently deleted</h2>
      <p class="hintline" style="margin:0 0 12px">Videos, episodes, clips, series, templates, sequences, swipes and tasks you deleted on any device — kept ${KEEP_DAYS} days, then gone for good. Restore brings back everything that was deleted with it.</p>
      <div class="tr-list">${groups.length ? groups.map(card).join('') : '<p class="hintline">Nothing deleted in the last 30 days.</p>'}</div>`, sh => {
      sh.addEventListener('click', async e => {
        const it = e.target.closest('[data-g]');
        if(!it) return;
        const g = groups.find(x => x.group === it.dataset.g);
        if(!g) return;
        const ver = e.target.closest('[data-ver]');
        if(e.target.closest('[data-restore]') || ver){
          const pick = ver ? { [idOf(g.lead.store, g.lead.key)]: ver.dataset.ver } : null;
          const n = await restore(g, pick);
          U.toast(n ? `Restored “${g.title}”${n > 1 ? ` and ${plural(n - 1, 'linked item')}` : ''}` : 'It’s back already');
          it.remove(); after && after(); return;
        }
        if(e.target.closest('[data-forget]')){
          if(!confirm(`Delete “${g.title}” for good? It can’t be brought back after this, on any device.`)) return;
          await forget(g); it.remove(); after && after();
        }
      });
    });
  }

  if(typeof document !== 'undefined' && !global.CS_NO_AUTORUN) setTimeout(() => { sweep().catch(() => {}); }, 15000);

  global.Trash = { list, count, restore, forget, sweep, open, fromElsewhere, KINDS, KEEP_DAYS, _keep: keep };
})(window);
