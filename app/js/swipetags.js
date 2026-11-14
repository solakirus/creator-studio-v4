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
     SwipeTags.matches(swipe, f)        f = { tags:[], match:'all'|'any', src, angle, nofolder, when }
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
  const invalidate = () => { cache = null; vcache = null; };
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

  /* ---- filters ---- */
  const DAY = 86400000;
  const WHEN = { week:['This week', 7], month:['This month', 30], quarter:['Last 3 months', 91], older:['Older', 0] };
  const blank = () => ({ tags:[], match:'all', src:'', angle:'', nofolder:false, when:'' });
  const active = f => !!f && (f.tags.length || f.src || f.angle || f.nofolder || f.when);
  function matches(s, f, folderIds){
    if(!f) return true;
    const mine = s.tagIds || [];
    if(f.tags.length){
      const ok = f.match === 'any' ? f.tags.some(t => mine.includes(t)) : f.tags.every(t => mine.includes(t));
      if(!ok) return false;
    }
    if(f.src && s.source !== f.src) return false;
    if(f.angle === 'none' && (s.myAngle || '').trim()) return false;
    if(f.angle === 'has' && !(s.myAngle || '').trim()) return false;
    if(f.nofolder && (s.folders || []).some(id => !folderIds || folderIds.has(id))) return false;
    if(f.when){
      const at = s.savedAt || s.createdAt || 0, age = Date.now() - at;
      if(f.when === 'older' ? age < 91 * DAY : age > WHEN[f.when][1] * DAY) return false;
    }
    return true;
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
    const keep = { tags:f.tags.slice(), match:f.match, src:f.src, angle:f.angle, nofolder:!!f.nofolder, when:f.when };
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

  global.SwipeTags = { COLORS, WHEN, all, byId, save, invalidate, addGroup, renameGroup, removeGroup, addTag, editTag,
    removeTag, apply, blank, active, matches, views, saveView, removeView, starters };
})(window);
