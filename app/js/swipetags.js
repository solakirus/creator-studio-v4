/* Swipe tags — your own way of sorting the swipe file.

   The fixed filters (intent, channel, target) didn't fit how swipes get used,
   so the sorting is yours: groups you name ("Use it for", "Vibe", "Format"),
   each with tags you add, rename, recolour and remove. A swipe keeps the ids
   of its tags in `tagIds`.

   Stored in settings 'swipe-tags' as one list, which syncs. Ids come from the
   names (U.stableId), so a group or tag made on two devices at once is one,
   and sync's merge (merge.js) combines lists by id. Until you change
   anything, every device shows the same starters without saving them — so a
   starter you delete can't come back from a device that never had the list.

   Smart views: a set of filters saved under a name (settings 'swipe-views').

     await SwipeTags.all()              [{ id, name, tags:[{ id, name, color }] }]
     await SwipeTags.byId()             { tagId: { tag, group } }
     SwipeTags.addGroup / renameGroup / removeGroup / addTag / editTag / removeTag
     await SwipeTags.apply(swipeIds, tagId, on)
     SwipeTags.matches(swipe, f)        f = { sel:{ groupId: tagId }, src, angle, when, nofolder, intent, channel, target }
     await SwipeTags.views() / saveView(name, f) / removeView(id)          */
(function(global){
  const KEY = 'swipe-tags', VIEWS = 'swipe-views';
  const COLORS = ['#E8853A', '#E2564A', '#D4537E', '#7F77DD', '#378ADD', '#1D9E75', '#97C459', '#EF9F27', '#B4B2A9'];
  const sid = (...p) => U.stableId(...p);

  function starters(){
    const g = (name, tags) => {
      const id = sid('tg', name);
      return { id, name, tags: tags.map((t, i) => ({ id: sid('tag', id, t), name: t, color: COLORS[i % COLORS.length] })) };
    };
    return [
      g('Use it for', ['Hook', 'B-roll idea', 'Edit style', 'Thumbnail', 'Transition']),
      g('Vibe', ['Funny', 'Cinematic', 'Motivational']),
      g('Format', ['Talking head', 'Voiceover', 'Day in the life'])
    ];
  }

  let cache = null;
  async function all(){
    if(cache) return cache;
    let list;
    try { list = await Store.get('settings', KEY); } catch(e){}
    cache = Array.isArray(list) ? list : starters();
    return cache;
  }
  const invalidate = () => { cache = null; vcache = null; bcache = null; };
  async function save(list){ cache = list; await Store.put('settings', list, KEY); return list; }
  const clone = v => JSON.parse(JSON.stringify(v));
  async function byId(){
    const out = {};
    (await all()).forEach(group => group.tags.forEach(tag => { out[tag.id] = { tag, group }; }));
    return out;
  }

  async function addGroup(name){
    const n = String(name || '').trim(); if(!n) return null;
    const list = clone(await all());
    const same = list.find(g => g.name.toLowerCase() === n.toLowerCase());
    if(same) return same;
    let id = sid('tg', n); if(list.some(g => g.id === id)) id = sid('tg', n, Date.now());
    const g = { id, name:n, tags:[] };
    list.push(g); await save(list); return g;
  }
  async function renameGroup(id, name){
    const n = String(name || '').trim(); if(!n) return;
    const list = clone(await all()); const g = list.find(x => x.id === id); if(!g) return;
    g.name = n; await save(list);
  }
  /* a removed tag just stops showing: swipes keep the id, which matches nothing */
  async function removeGroup(id){ await save(clone(await all()).filter(g => g.id !== id)); }
  async function addTag(groupId, name, color){
    const n = String(name || '').trim(); if(!n) return null;
    const list = clone(await all()); const g = list.find(x => x.id === groupId); if(!g) return null;
    const same = g.tags.find(t => t.name.toLowerCase() === n.toLowerCase());
    if(same) return same;
    let id = sid('tag', g.id, n); if(g.tags.some(t => t.id === id)) id = sid('tag', g.id, n, Date.now());
    const t = { id, name:n, color: color || COLORS[g.tags.length % COLORS.length] };
    g.tags.push(t); await save(list); return t;
  }
  async function editTag(id, patch){
    const list = clone(await all());
    for(const g of list){ const t = g.tags.find(x => x.id === id); if(t){ Object.assign(t, patch); break; } }
    await save(list);
  }
  async function removeTag(id){
    const list = clone(await all());
    list.forEach(g => { g.tags = g.tags.filter(t => t.id !== id); });
    await save(list);
  }

  /* on: add to every swipe; off: take off every one */
  async function apply(ids, tagId, on){
    let n = 0;
    for(const id of ids){
      const s = await Store.get('swipes', id); if(!s) continue;
      const has = (s.tagIds || []).includes(tagId);
      if(on === has) continue;
      s.tagIds = on ? (s.tagIds || []).concat(tagId) : s.tagIds.filter(x => x !== tagId);
      await Store.put('swipes', s); n++;
    }
    return n;
  }

  /* ---- filters ----
     The swipe file's row of dropdowns: one per group above (pick an option
     to show swipes with that tag), and the built-in ones you switch on or
     off in Edit filters. f = { sel:{ groupId: tagId }, src, angle, when,
     nofolder, intent, channel, target }. */
  const DAY = 86400000;
  const WHEN = { week:['This week', 7], month:['This month', 30], quarter:['Last 3 months', 91], older:['Older than 3 months', 0] };
  const BUILTINS = [
    { k:'src',     label:'Where it\'s from', on:true },
    { k:'angle',   label:'My angle' },
    { k:'when',    label:'When I saved it' },
    { k:'folder',  label:'Folders' },
    { k:'intent',  label:'Intent' },
    { k:'channel', label:'Channel', on:true },
    { k:'target',  label:'Target platform' }
  ];
  const blank = () => ({ sel:{}, src:'', angle:'', when:'', nofolder:false, intent:'', channel:'', target:'' });
  /* views saved before the dropdowns came back kept a list of tags */
  function norm(f){
    const o = { ...blank(), ...(f || {}) };
    o.sel = { ...(o.sel || {}) };
    if(Array.isArray(f && f.tags)) f.tags.forEach((t, i) => { o.sel['_' + i] = t; });
    delete o.tags; delete o.match;
    return o;
  }
  const active = f => !!f && (Object.values(f.sel || {}).some(Boolean) || f.src || f.angle || f.when || f.nofolder || f.intent || f.channel || f.target);
  function matches(s, f, folderIds){
    if(!f) return true;
    const mine = s.tagIds || [];
    for(const t of Object.values(f.sel || {})) if(t && !mine.includes(t)) return false;
    if(f.src && s.source !== f.src) return false;
    if(f.angle === 'none' && (s.myAngle || '').trim()) return false;
    if(f.angle === 'has' && !(s.myAngle || '').trim()) return false;
    if(f.nofolder && (s.folders || []).some(id => !folderIds || folderIds.has(id))) return false;
    if(f.when){
      const at = s.savedAt || s.createdAt || 0, age = Date.now() - at;
      if(f.when === 'older' ? age < 91 * DAY : age > WHEN[f.when][1] * DAY) return false;
    }
    if(f.intent && s.intent !== f.intent) return false;
    if(f.channel && !(s.channels || []).includes(f.channel)) return false;
    if(f.target && !(s.targets || []).includes(f.target)) return false;
    return true;
  }

  /* which built-in dropdowns show: settings 'swipe-filter-builtins' (synced) */
  let bcache = null;
  async function builtins(){
    if(bcache) return bcache;
    let b; try { b = await Store.get('settings', 'swipe-filter-builtins'); } catch(e){}
    bcache = {};
    BUILTINS.forEach(x => { bcache[x.k] = b && typeof b[x.k] === 'boolean' ? b[x.k] : !!x.on; });
    return bcache;
  }
  async function setBuiltin(k, on){
    const b = { ...(await builtins()), [k]: !!on };
    bcache = b; await Store.put('settings', b, 'swipe-filter-builtins');
  }

  let vcache = null;
  async function views(){
    if(vcache) return vcache;
    let v; try { v = await Store.get('settings', VIEWS); } catch(e){}
    return (vcache = Array.isArray(v) ? v : []);
  }
  async function saveView(name, f, id){
    const n = String(name || '').trim(); if(!n) return null;
    const list = clone(await views());
    const keep = JSON.parse(JSON.stringify(norm(f)));
    let v = list.find(x => x.id === id) || list.find(x => x.name.toLowerCase() === n.toLowerCase());
    if(v){ v.name = n; v.f = keep; }
    else { v = { id: sid('sv', n), name:n, f:keep }; list.push(v); }
    vcache = list; await Store.put('settings', list, VIEWS);
    return v;
  }
  async function removeView(id){
    const list = (await views()).filter(v => v.id !== id);
    vcache = list; await Store.put('settings', list, VIEWS);
  }

  global.SwipeTags = { COLORS, WHEN, BUILTINS, all, byId, save, invalidate, addGroup, renameGroup, removeGroup, addTag, editTag,
    removeTag, apply, blank, norm, active, matches, builtins, setBuiltin, views, saveView, removeView, starters };
})(window);
