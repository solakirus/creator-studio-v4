/* Swipe folders — collections, the way social apps keep saved posts.

   One level deep. A swipe can sit in as many folders as fit ("Back pain" and
   "Morning routine" at once), so folders behave like tags but look and read
   like folders. Deleting a folder never deletes what's in it.

   The folder list lives in settings ('swipe-folders'); each swipe remembers its
   own folder ids in `folders`. Both are already in the backup. */
(function(global){

  const KEY = 'swipe-folders';
  const EMOJI = ['📁','💪','🧘','🩹','📚','✏️','🎨','🧸','🍳','🏠','🔧','🚗','🎬','🎤','🎧','🇩🇪','💼','💡','❤️','⭐'];

  const uid = () => 'fd_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  let cache = null;
  async function all(){
    if(cache) return cache;
    let list = null;
    try { list = await Store.get('settings', KEY); } catch(e){}
    cache = Array.isArray(list) ? list : [];
    return cache;
  }
  /* pinned first, then the order you set, then newest */
  async function sorted(){
    return (await all()).slice().sort((a, b) =>
      ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || ((a.order ?? 1e9) - (b.order ?? 1e9)) ||
      ((b.createdAt || 0) - (a.createdAt || 0)));
  }
  async function save(list){ cache = list; await Store.put('settings', list, KEY); }
  async function get(id){ return (await all()).find(f => f.id === id) || null; }

  async function create(name, emoji){
    const n = String(name || '').trim();
    if(!n) return null;
    const list = (await all()).slice();
    const same = list.find(f => f.name.toLowerCase() === n.toLowerCase());
    if(same) return same;
    const f = { id:uid(), name:n, emoji:emoji || '📁', pinned:false, order:null, createdAt:Date.now() };
    list.push(f);
    await save(list);
    return f;
  }
  async function update(id, patch){
    const list = (await all()).map(f => f.id === id ? { ...f, ...patch } : f);
    await save(list);
    return list.find(f => f.id === id);
  }

  async function swipes(){
    try { return (await Store.all('swipes')).values; } catch(e){ return []; }
  }
  /* the folder goes; the swipes in it stay and just lose the folder */
  async function remove(id){
    for(const s of (await swipes()).filter(x => (x.folders || []).includes(id)))
      await Store.put('swipes', { ...s, folders:s.folders.filter(f => f !== id) });
    await save((await all()).filter(f => f.id !== id));
  }

  async function addTo(ids, fid){
    let n = 0;
    for(const id of ids){
      const s = await Store.get('swipes', id);
      if(!s || (s.folders || []).includes(fid)) continue;
      await Store.put('swipes', { ...s, folders:(s.folders || []).concat(fid) });
      n++;
    }
    return n;
  }
  async function removeFrom(ids, fid){
    let n = 0;
    for(const id of ids){
      const s = await Store.get('swipes', id);
      if(!s || !(s.folders || []).includes(fid)) continue;
      await Store.put('swipes', { ...s, folders:s.folders.filter(f => f !== fid) });
      n++;
    }
    return n;
  }

  /* what each folder holds, for the tiles */
  async function contents(){
    const list = await swipes();
    const out = { __none:[] };
    (await all()).forEach(f => { out[f.id] = []; });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).forEach(s => {
      const fs = (s.folders || []).filter(id => out[id]);
      if(!fs.length) out.__none.push(s);
      fs.forEach(id => out[id].push(s));
    });
    return out;
  }

  global.SwipeFolders = { EMOJI, all, sorted, save, get, create, update, remove, addTo, removeFrom, contents,
                          invalidate: () => { cache = null; } };
})(window);
