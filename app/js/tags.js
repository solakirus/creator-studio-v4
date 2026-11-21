/* v4 (21 Nov 2026): tags on Library frames — Activity, Location, Genre, Shot
   and any categories you add — so a shot can be found by what is in it.

   Where they live
     'frame-tags' store, one small record per frame: { id:<frame key>, t:[tag ids] }.
     The key is the frame's path inside the Shot Library ("Gym/gifs/squat.gif"),
     the same thing boards match on, so a frame tagged on the laptop (its own
     folder), on the iPad (nastime) or on the phone (a kept copy) is one record.
     Frames added in the app without a path use their own uid. Synced.
     Categories and their tags: settings 'tag-cats' (synced):
       [{ id:'activity', name:'Activity', tags:[{ id:'activity:gym', name:'Gym' }] }]
     A tag's id is made from its category and name when it is made, so two
     devices making "Gym" agree; renaming or moving it keeps the id.

   Finding frames
     Within a category any pick matches (Gym or Kitchen); across categories
     every category picked has to (Gym and Close-up). "Untagged" = no tags.

     Tags.cats() / saveCats(list) / map() → Map(key → Set(ids))
     Tags.keyOf(item) / of(map, item) → [ids] / names(map, cats, item)
     Tags.match(map, cats, item, ids, untagged)
     Tags.set(items, id, on) / addTag(catId, name) / renameTag / moveTag /
       mergeTag(from, into) / deleteTag / addCat / renameCat / moveCat / deleteCat
     Tags.fromBoards()       once: each board's frames get a tag named after it
     Tags.sheet(uids, after) the Tag sheet (several frames at once)
     Tags.filterHTML(state, counts) / Tags.manage(after) */
(function(global){
  const STORE = 'frame-tags', CATS_KEY = 'tag-cats';
  const esc = s => global.U && U.esc ? U.esc(s) : String(s == null ? '' : s);
  const slug = s => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
  const tagId = (catId, name) => catId + ':' + slug(name);
  const mk = (id, name, tags) => ({ id, name, tags: tags.map(n => ({ id: tagId(id, n), name: n })) });
  const DEFAULTS = [
    mk('activity', 'Activity', ['Gym', 'Driving', 'Cooking', 'Grooming', 'Working', 'Walking', 'Cleaning']),
    mk('location', 'Location', ['Car', 'Gym', 'Kitchen', 'Bathroom', 'Bedroom', 'Living room', 'Outside', 'City']),
    mk('genre', 'Genre', ['Cinematic', 'Lifestyle', 'Moody', 'Hype', 'Funny']),
    mk('shot', 'Shot', ['Wide', 'Medium', 'Close-up', 'POV', 'Overhead', 'Slow-mo', 'Drone', 'Transition'])
  ];

  /* ------------------------------------------------------------ categories */
  /* read fresh each time: another device's changes arrive straight into the store */
  async function cats(){
    let c = null;
    try { c = await Store.get('settings', CATS_KEY); } catch(e){}
    return Array.isArray(c) && c.length ? c : JSON.parse(JSON.stringify(DEFAULTS));
  }
  async function saveCats(list){ await Store.put('settings', list, CATS_KEY); changed(); }
  const allTags = cs => cs.flatMap(c => c.tags.map(t => ({ ...t, cat: c.id, catName: c.name })));
  const catOf = (cs, id) => cs.find(c => c.tags.some(t => t.id === id)) || null;
  const nameOf = (cs, id) => { for(const c of cs){ const t = c.tags.find(x => x.id === id); if(t) return t.name; } return ''; };

  /* ------------------------------------------------------------ frames */
  const plainOf = u => { u = String(u || ''); return u.startsWith('h:') && u.includes('|') ? u.slice(u.indexOf('|') + 1) : ''; };
  function keyOf(it){
    if(!it) return '';
    if(typeof it === 'string') return plainOf(it) || it;
    return it.path || plainOf(it.from) || plainOf(it.uid) || it.uid || '';
  }
  async function map(){
    const m = new Map();
    try { const { values } = await Store.all(STORE); values.forEach(r => { if(r && r.id && Array.isArray(r.t) && r.t.length) m.set(r.id, new Set(r.t)); }); } catch(e){}
    return m;
  }
  const of = (m, it) => [...(m.get(keyOf(it)) || [])];
  const names = (m, cs, it) => of(m, it).map(id => nameOf(cs, id)).filter(Boolean);
  function match(m, cs, it, ids, untagged){
    const mine = m.get(keyOf(it));
    if(untagged) return !mine || !mine.size;
    if(!ids || !ids.length) return true;
    if(!mine || !mine.size) return false;
    /* any within a category, all across categories */
    const byCat = new Map();
    for(const id of ids){ const c = catOf(cs, id); const k = c ? c.id : '?'; if(!byCat.has(k)) byCat.set(k, []); byCat.get(k).push(id); }
    for(const list of byCat.values()) if(!list.some(id => mine.has(id))) return false;
    return true;
  }
  async function writeKey(key, ids){
    const t = [...new Set(ids)];
    if(t.length) await Store.put(STORE, { id: key, t });
    else { try { if(await Store.get(STORE, key)) await Store.del(STORE, key); } catch(e){} }
  }
  /* on: true adds to every frame, false takes off every one */
  async function set(items, id, on){
    const m = await map();
    const keys = [...new Set(items.map(keyOf).filter(Boolean))];
    let n = 0;
    for(const k of keys){
      const cur = new Set(m.get(k) || []);
      const had = cur.has(id);
      if(on && !had){ cur.add(id); n++; } else if(!on && had){ cur.delete(id); n++; } else continue;
      await writeKey(k, [...cur]);
    }
    changed();
    return n;
  }
  /* every frame record that has a tag, rewritten by fn(set) */
  async function rewrite(fn){
    const m = await map();
    for(const [k, s] of m){ const before = [...s].join(); const next = fn(new Set(s)); if([...next].join() !== before) await writeKey(k, [...next]); }
  }

  /* ------------------------------------------------------------ editing tags */
  async function addTag(catId, name){
    name = String(name || '').trim().slice(0, 40);
    if(!name) return null;
    const cs = await cats();
    const c = cs.find(x => x.id === catId);
    if(!c) return null;
    const have = c.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if(have) return have.id;
    let id = tagId(catId, name), k = 2;
    while(allTags(cs).some(t => t.id === id)) id = tagId(catId, name) + '-' + k++;
    c.tags.push({ id, name });
    await saveCats(cs);
    return id;
  }
  async function renameTag(id, name){
    name = String(name || '').trim().slice(0, 40);
    const cs = await cats();
    for(const c of cs){ const t = c.tags.find(x => x.id === id); if(t && name){ t.name = name; await saveCats(cs); return true; } }
    return false;
  }
  async function moveTag(id, toCat){
    const cs = await cats();
    const from = catOf(cs, id), to = cs.find(c => c.id === toCat);
    if(!from || !to || from === to) return false;
    const t = from.tags.find(x => x.id === id);
    from.tags = from.tags.filter(x => x.id !== id);
    to.tags.push(t);
    await saveCats(cs);
    return true;
  }
  async function mergeTag(fromId, intoId){
    if(fromId === intoId) return false;
    await rewrite(s => { if(s.has(fromId)){ s.delete(fromId); s.add(intoId); } return s; });
    const cs = await cats();
    cs.forEach(c => { c.tags = c.tags.filter(t => t.id !== fromId); });
    await saveCats(cs);
    await boardsDrop([fromId], intoId);
    return true;
  }
  async function deleteTag(id){
    await rewrite(s => { s.delete(id); return s; });
    const cs = await cats();
    cs.forEach(c => { c.tags = c.tags.filter(t => t.id !== id); });
    await saveCats(cs);
    await boardsDrop([id]);
    return true;
  }
  async function addCat(name){
    name = String(name || '').trim().slice(0, 30);
    if(!name) return null;
    const cs = await cats();
    const have = cs.find(c => c.name.toLowerCase() === name.toLowerCase());
    if(have) return have.id;
    let id = slug(name), k = 2;
    while(cs.some(c => c.id === id)) id = slug(name) + '-' + k++;
    cs.push({ id, name, tags: [] });
    await saveCats(cs);
    return id;
  }
  async function renameCat(id, name){
    name = String(name || '').trim().slice(0, 30);
    const cs = await cats(); const c = cs.find(x => x.id === id);
    if(!c || !name) return false;
    c.name = name; await saveCats(cs); return true;
  }
  async function moveCat(id, d){
    const cs = await cats(); const i = cs.findIndex(c => c.id === id), j = i + d;
    if(i < 0 || j < 0 || j >= cs.length) return false;
    [cs[i], cs[j]] = [cs[j], cs[i]]; await saveCats(cs); return true;
  }
  async function deleteCat(id){
    const cs = await cats(); const c = cs.find(x => x.id === id);
    if(!c) return false;
    const gone = new Set(c.tags.map(t => t.id));
    await rewrite(s => { gone.forEach(g => s.delete(g)); return s; });
    await saveCats(cs.filter(x => x.id !== id));
    await boardsDrop([...gone]);
    return true;
  }
  /* smart boards that used a tag that's gone (or merged) */
  async function boardsDrop(ids, into){
    if(!global.MediaLib) return;
    for(const b of await MediaLib.allBoards({ raw: true })){
      if(!Array.isArray(b.smart) || !b.smart.some(x => ids.includes(x))) continue;
      const next = [...new Set(b.smart.map(x => ids.includes(x) ? into : x).filter(Boolean))];
      await MediaLib.saveBoard({ ...b, smart: next });
    }
  }

  /* ------------------------------------------------------------ your boards, as tags */
  const GROUP_CAT = { Activity: 'activity', Location: 'location', Mood: 'genre', Subject: 'Subject', Other: 'Other' };
  async function fromBoards(force){
    /* once across every device (a synced flag), so a tag you took off a
       frame isn't put back when another device opens the Library */
    const FLAG = 'tags:fromboards';
    try { if(!force && await Store.get('settings', FLAG)) return 0; } catch(e){}
    if(!global.MediaLib) return 0;
    const boards = (await MediaLib.allBoards({ raw: true })).filter(b => !Array.isArray(b.smart) && (b.items || []).length);
    let n = 0;
    if(boards.length){
      const lib = await MediaLib.load();
      for(const b of boards){
        let cat = GROUP_CAT[b.group] || 'Other';
        const cs = await cats();
        if(!cs.some(c => c.id === cat)) cat = await addCat(cat);
        const id = await addTag(cat, b.name);
        if(!id) continue;
        const its = b.items.map(u => MediaLib.find(lib, u) || { uid: u });
        n += await set(its, id, true);
      }
    }
    try { await Store.put('settings', Date.now(), FLAG); } catch(e){}
    return n;
  }

  /* ------------------------------------------------------------ redraws */
  const listeners = new Set();
  function changed(){ listeners.forEach(f => { try { f(); } catch(e){} }); }
  function invalidate(){}

  /* ------------------------------------------------------------ UI */
  const CSS = `
  .tg-rows{display:flex;flex-direction:column;gap:2px;margin:0 0 10px}
  .tg-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:5px 0;border-bottom:1px solid var(--line)}
  .tg-row:last-child{border-bottom:0}
  .tg-k{flex:0 0 84px;font-family:var(--display),sans-serif;font-weight:900;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .tg-chip{height:28px;padding:0 10px;border:1px solid var(--line);border-radius:14px;background:transparent;color:var(--cream);font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
  .tg-chip small{color:var(--muted);margin-left:4px}
  .tg-chip[aria-pressed="true"]{background:var(--cream);border-color:var(--cream);color:#151515;font-weight:700}
  .tg-chip[aria-pressed="true"] small{color:#5A544B}
  .tg-chip.some{border-color:var(--cream);border-style:dashed}
  .tg-chip.zero{opacity:.45}
  .tg-new{height:28px;width:110px;padding:0 9px;border:1px dashed var(--line);border-radius:14px;background:transparent;color:var(--cream);font:inherit;font-size:12.5px;outline:none}
  .tg-new:focus{border-color:var(--orange);border-style:solid}
  .tg-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 8px}
  .tg-bar .lv-sel{height:34px}
  .tg-on{display:flex;gap:6px;flex-wrap:wrap;flex:1;min-width:0}
  .tg-on .tg-chip{background:var(--cream);color:#151515;border-color:var(--cream);font-weight:700}
  .tg-sec{grid-column:1/-1;display:flex;align-items:baseline;gap:10px;margin:10px 0 2px;font-family:var(--display),sans-serif;font-weight:900;font-size:14px;letter-spacing:.06em;text-transform:uppercase}
  .tg-sec small{color:var(--muted);font-size:12px;letter-spacing:0}
  .tg-sheet .tg-k{flex-basis:90px}
  .lv-vtags{margin:10px 0 4px}
  .tg-vrows .tg-row{padding:4px 0}
  .tg-vrows .tg-k{flex-basis:100%;margin:2px 0 0}
  .tg-vrows .tg-chip{height:26px;padding:0 9px;font-size:12px}
  .lv-ptags{padding:0 14px 6px;max-height:34vh;overflow:auto}
  .tg-man{display:flex;flex-direction:column;gap:14px}
  .tg-mcat{border:1px solid var(--line);border-radius:var(--r);padding:10px}
  .tg-mhead{display:flex;gap:6px;align-items:center;margin:0 0 8px}
  .tg-mhead input{flex:1;min-width:0;height:34px;padding:0 9px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit;font-weight:700}
  .tg-mtag{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:6px;align-items:center;padding:4px 0}
  .tg-mtag input{height:32px;min-width:0;padding:0 9px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit;font-size:13.5px}
  .tg-mtag select{height:32px;max-width:120px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit;font-size:12.5px}
  .tg-mtag small{color:var(--muted);font-size:12px;min-width:30px;text-align:right}
  .tg-x{width:32px;height:32px;border:1px solid var(--line);border-radius:var(--r);background:transparent;color:var(--muted);cursor:pointer}
  @media (max-width:560px){ .tg-k{flex-basis:100%} .tg-mtag{grid-template-columns:minmax(0,1fr) auto auto} .tg-mtag small{display:none} }`;
  function css(){ if(document.getElementById('tg-css')) return; const s = document.createElement('style'); s.id = 'tg-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* counts: Map(tag id → n); state: { tags:[ids], untagged } */
  function counts(m, cs, items){
    const n = new Map(); let none = 0;
    for(const it of items){ const s = m.get(keyOf(it)); if(!s || !s.size){ none++; continue; } s.forEach(id => n.set(id, (n.get(id) || 0) + 1)); }
    n.set('__none', none);
    return n;
  }
  /* the filter rows: a row per category, a chip per tag with how many have it */
  function filterHTML(cs, state, n, opt){
    const withManage = !(opt && opt.manage === false);
    const on = new Set(state.tags || []);
    return `<div class="tg-rows">${cs.map(c => `<div class="tg-row"><span class="tg-k">${esc(c.name)}</span>${c.tags.map(t => {
        const k = n ? (n.get(t.id) || 0) : null;
        return `<button class="tg-chip${k === 0 && !on.has(t.id) ? ' zero' : ''}" data-tgf="${esc(t.id)}" aria-pressed="${on.has(t.id)}">${esc(t.name)}${k !== null ? `<small>${k}</small>` : ''}</button>`;
      }).join('') || '<span class="hintline" style="margin:0">No tags yet — add some in Manage tags</span>'}</div>`).join('')}
      ${opt && opt.left === false ? '' : `<div class="tg-row"><span class="tg-k">Left</span><button class="tg-chip" data-tguntag aria-pressed="${!!state.untagged}">Untagged${n ? `<small>${n.get('__none') || 0}</small>` : ''}</button>
        ${withManage ? '<button class="tg-chip" data-tgmanage>Manage tags…</button>' : ''}</div>`}</div>`;
  }
  /* the picked ones in one line, each with an × */
  function activeHTML(cs, state){
    const ids = state.tags || [];
    return `${state.untagged ? '<button class="tg-chip" data-tguntag aria-pressed="true">Untagged ×</button>' : ''}${ids.map(id =>
      `<button class="tg-chip" data-tgf="${esc(id)}" aria-pressed="true">${esc(nameOf(cs, id) || id)} ×</button>`).join('')}`;
  }
  /* a click on a filter chip: changes state, returns true if it was one */
  function onFilterClick(e, state, after){
    const f = e.target.closest('[data-tgf]');
    if(f){ const id = f.dataset.tgf; state.untagged = false;
      state.tags = (state.tags || []).includes(id) ? state.tags.filter(x => x !== id) : [...(state.tags || []), id]; after(); return true; }
    if(e.target.closest('[data-tguntag]')){ state.untagged = !state.untagged; if(state.untagged) state.tags = []; after(); return true; }
    if(e.target.closest('[data-tgmanage]')){ manage(after); return true; }
    return false;
  }

  /* Tag sheet: several frames at once. A chip lit = every one has it; dashed =
     some do. Tap: all get it (or, if all had it, none do). Type a new one in a
     row and press Enter: made, and put on them. */
  async function sheet(uids, after){
    css();
    const lib = await MediaLib.load();
    const items = uids.map(u => MediaLib.find(lib, u) || { uid: u });
    const draw = async sh => {
      const cs = await cats(), m = await map();
      const has = id => items.filter(it => (m.get(keyOf(it)) || new Set()).has(id)).length;
      sh.querySelector('[data-tgbody]').innerHTML = cs.map(c => `<div class="tg-row"><span class="tg-k">${esc(c.name)}</span>${c.tags.map(t => {
          const h = has(t.id);
          return `<button class="tg-chip${h && h < items.length ? ' some' : ''}" data-tgset="${esc(t.id)}" aria-pressed="${h === items.length}" title="${h} of ${items.length}">${esc(t.name)}</button>`;
        }).join('')}<input class="tg-new" data-tgnew="${esc(c.id)}" placeholder="＋ New" aria-label="New ${esc(c.name)} tag"></div>`).join('');
    };
    App.sheet(`<div class="tg-sheet"><h2 style="margin:0 0 3px">Tag ${items.length === 1 ? 'this frame' : items.length + ' frames'}</h2>
      <p class="hintline" style="margin:0 0 10px">Tap a tag to put it on ${items.length === 1 ? 'it' : 'all of them'} — tap again to take it off. Dashed: some have it.</p>
      <div class="tg-rows" data-tgbody></div>
      <div class="sheetcta" style="margin-top:12px"><button class="btn-primary" data-tgdone style="flex:1">Done</button>
        <button class="btn-ghost" data-tgmanage>Manage tags…</button></div></div>`, async sh => {
      await draw(sh);
      sh.addEventListener('click', async e => {
        if(e.target.closest('[data-tgdone]')){ App.closeSheet(); if(after) after(); return; }
        if(e.target.closest('[data-tgmanage]')){ App.closeSheet(); return manage(after); }
        const b = e.target.closest('[data-tgset]');
        if(!b) return;
        const all = b.getAttribute('aria-pressed') === 'true';
        await set(items, b.dataset.tgset, !all);
        await draw(sh);
      });
      sh.addEventListener('keydown', async e => {
        const inp = e.target.closest('[data-tgnew]');
        if(!inp || e.key !== 'Enter') return;
        e.preventDefault();
        const id = await addTag(inp.dataset.tgnew, inp.value);
        if(!id) return;
        await set(items, id, true);
        await draw(sh);
        const again = sh.querySelector(`[data-tgnew="${inp.dataset.tgnew}"]`); if(again) again.focus();
      });
    });
  }

  /* Manage tags: rename, move, merge, delete; add / rename / reorder / delete categories */
  async function manage(after){
    css();
    const draw = async sh => {
      const cs = await cats(), m = await map();
      const n = new Map(); m.forEach(s => s.forEach(id => n.set(id, (n.get(id) || 0) + 1)));
      sh.querySelector('[data-tgman]').innerHTML = cs.map((c, i) => `<section class="tg-mcat" data-cat="${esc(c.id)}">
          <div class="tg-mhead"><input data-catname="${esc(c.id)}" value="${esc(c.name)}" aria-label="Category name">
            <button class="tg-x" data-catmv="${esc(c.id)}:-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
            <button class="tg-x" data-catmv="${esc(c.id)}:1" ${i === cs.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
            <button class="tg-x" data-catdel="${esc(c.id)}" aria-label="Delete this category">×</button></div>
          ${c.tags.map(t => `<div class="tg-mtag">
            <input data-tagname="${esc(t.id)}" value="${esc(t.name)}" aria-label="Tag name">
            <small title="frames with it">${n.get(t.id) || 0}</small>
            <select data-tagdo="${esc(t.id)}" aria-label="Move or merge">
              <option value="">Move / merge…</option>
              ${cs.filter(x => x.id !== c.id).length ? `<optgroup label="Move to">${cs.filter(x => x.id !== c.id).map(x => `<option value="move:${esc(x.id)}">→ ${esc(x.name)}</option>`).join('')}</optgroup>` : ''}
              <optgroup label="Merge into">${allTags(cs).filter(x => x.id !== t.id).map(x => `<option value="merge:${esc(x.id)}">${esc(x.catName)}: ${esc(x.name)}</option>`).join('')}</optgroup>
            </select>
            <button class="tg-x" data-tagdel="${esc(t.id)}" aria-label="Delete this tag">×</button></div>`).join('')}
          <input class="tg-new" data-tgnew="${esc(c.id)}" placeholder="＋ New tag" style="margin-top:6px;width:160px"></section>`).join('') +
        `<div class="tg-row" style="border:0"><input class="tg-new" data-catnew placeholder="＋ New category" style="width:200px">
          <button class="tg-chip" data-frombd title="Each board's frames get a tag with the board's name">Copy my boards into tags</button></div>`;
    };
    App.sheet(`<div class="tg-sheet"><h2 style="margin:0 0 3px">Manage tags</h2>
      <p class="hintline" style="margin:0 0 12px">Rename a tag and every frame and smart board follows. Merge joins two into one. Changes reach every device.</p>
      <div class="tg-man" data-tgman></div>
      <div class="sheetcta" style="margin-top:12px"><button class="btn-primary" data-tgdone style="flex:1">Done</button></div></div>`, async sh => {
      await draw(sh);
      const redraw = () => draw(sh);
      sh.addEventListener('click', async e => {
        if(e.target.closest('[data-tgdone]')){ App.closeSheet(); if(after) after(); return; }
        const mv = e.target.closest('[data-catmv]');
        if(mv){ const [id, d] = mv.dataset.catmv.split(':'); await moveCat(id, +d); return redraw(); }
        const cd = e.target.closest('[data-catdel]');
        if(cd){ const cs = await cats(); const c = cs.find(x => x.id === cd.dataset.catdel);
          if(c && confirm(`Delete the ${c.name} category and its ${c.tags.length} tag${c.tags.length === 1 ? '' : 's'}? Frames keep their other tags.`)){ await deleteCat(c.id); redraw(); } return; }
        const td = e.target.closest('[data-tagdel]');
        if(td){ const cs = await cats(); const nm = nameOf(cs, td.dataset.tagdel);
          if(confirm(`Delete “${nm}”? It comes off every frame.`)){ await deleteTag(td.dataset.tagdel); redraw(); } return; }
        if(e.target.closest('[data-frombd]')){ const k = await fromBoards(true); U.toast(k ? `Tagged ${k} frame${k === 1 ? '' : 's'} from your boards` : 'Nothing new to copy'); return redraw(); }
      });
      sh.addEventListener('change', async e => {
        const cn = e.target.closest('[data-catname]');
        if(cn){ await renameCat(cn.dataset.catname, cn.value); return; }
        const tn = e.target.closest('[data-tagname]');
        if(tn){ await renameTag(tn.dataset.tagname, tn.value); return; }
        const sel = e.target.closest('[data-tagdo]');
        if(sel && sel.value){
          const [act, to] = sel.value.split(/:(.+)/);
          if(act === 'move') await moveTag(sel.dataset.tagdo, to);
          if(act === 'merge'){ const cs = await cats();
            if(!confirm(`Merge “${nameOf(cs, sel.dataset.tagdo)}” into “${nameOf(cs, to)}”? Every frame with the first gets the second.`)){ sel.value = ''; return; }
            await mergeTag(sel.dataset.tagdo, to); }
          return redraw();
        }
      });
      sh.addEventListener('keydown', async e => {
        if(e.key !== 'Enter') return;
        const nt = e.target.closest('[data-tgnew]');
        if(nt){ e.preventDefault(); if(await addTag(nt.dataset.tgnew, nt.value)) redraw(); return; }
        if(e.target.closest('[data-catnew]')){ e.preventDefault(); if(await addCat(e.target.value)) redraw(); return; }
        if(e.target.closest('[data-catname], [data-tagname]')){ e.preventDefault(); e.target.blur(); }
      });
    });
  }

  /* a smart board: a name, a group, and the tags its frames carry */
  async function smartBoard(board, after){
    css();
    const lib = await MediaLib.load();
    const st = { tags: [...((board && board.smart) || [])], untagged: false };
    const groups = MediaLib.BOARD_GROUPS;
    App.sheet(`<div class="tg-sheet"><h2 style="margin:0 0 3px">${board ? 'Edit smart board' : 'New smart board'}</h2>
      <p class="hintline" style="margin:0 0 10px">It fills itself: every frame with these tags, now and as you tag more. Two in one row = either; across rows = both.</p>
      <div style="display:flex;gap:8px;margin:0 0 10px"><input class="lv-in" data-sbname placeholder="Gym close-ups" value="${esc((board && board.name) || '')}" style="flex:1">
        <select class="lv-sel" data-sbgroup>${groups.map(g => `<option ${((board && board.group) || 'Other') === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
      <div data-sbrows></div>
      <p class="hintline" data-sbn style="margin:8px 0 0"></p>
      <div class="sheetcta" style="margin-top:12px"><button class="btn-primary" data-sbsave style="flex:1">${board ? 'Save' : 'Make it'}</button>
        <button class="btn-ghost" data-sbno>Cancel</button></div></div>`, async sh => {
      const draw = async () => {
        const cs = await cats(), m = await map();
        sh.querySelector('[data-sbrows]').innerHTML = filterHTML(cs, st, counts(m, cs, lib.items), { manage: false, left: false });
        const n = st.tags.length ? lib.items.filter(it => match(m, cs, it, st.tags)).length : 0;
        sh.querySelector('[data-sbn]').textContent = st.tags.length ? `${n} frame${n === 1 ? '' : 's'} match right now` : 'Pick at least one tag';
      };
      await draw();
      sh.addEventListener('click', async e => {
        if(e.target.closest('[data-sbno]')) return App.closeSheet();
        const f = e.target.closest('[data-tgf]');
        if(f){ const id = f.dataset.tgf; st.tags = st.tags.includes(id) ? st.tags.filter(x => x !== id) : [...st.tags, id]; return draw(); }
        if(!e.target.closest('[data-sbsave]')) return;
        if(!st.tags.length) return U.toast('Pick at least one tag');
        const cs = await cats();
        const name = sh.querySelector('[data-sbname]').value.trim() || st.tags.map(id => nameOf(cs, id)).join(' + ');
        const rec = await MediaLib.saveBoard({ ...(board || {}), name, group: sh.querySelector('[data-sbgroup]').value, smart: st.tags });
        App.closeSheet();
        U.toast(board ? 'Smart board saved' : `Smart board “${rec.name}” made`);
        if(after) after(rec);
      });
    });
  }

  /* the viewer's tag rows for one frame */
  async function viewerHTML(it){
    css();
    const cs = await cats(), m = await map();
    const mine = new Set(of(m, it));
    return `<div class="tg-rows tg-vrows">${cs.map(c => `<div class="tg-row"><span class="tg-k">${esc(c.name)}</span>${c.tags.map(t =>
      `<button class="tg-chip" data-vtag="${esc(t.id)}" aria-pressed="${mine.has(t.id)}">${esc(t.name)}</button>`).join('')}</div>`).join('')}</div>`;
  }

  global.Tags = { DEFAULTS, cats, saveCats, invalidate, map, keyOf, of, names, nameOf, allTags, catOf, match, set, counts,
    addTag, renameTag, moveTag, mergeTag, deleteTag, addCat, renameCat, moveCat, deleteCat, fromBoards,
    css, filterHTML, activeHTML, onFilterClick, sheet, manage, viewerHTML, smartBoard,
    onChange: f => { listeners.add(f); return () => listeners.delete(f); } };
})(window);
