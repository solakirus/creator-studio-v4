/* The avatar ladder. You set these up once in Settings, each with the level it
   unlocks at, and then they arrive on their own as you climb. */
(function(global){

  let cache = null;
  const uid = () => 'av_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  async function all(){
    if(cache) return cache;
    try {
      const { values } = await Store.all('avatars');
      cache = values.sort((a,b) => a.level - b.level);
    } catch(e){ cache = []; }
    return cache;
  }
  const invalidate = () => { cache = null; };

  async function save(rec){
    const r = { id: rec.id || uid(), name: rec.name || '', level: Math.max(1, +rec.level || 1) };
    await Store.put('avatars', r);
    if(rec.file) await Store.put('avatar-art', rec.file, r.id);
    invalidate();
    /* tell the shell something moved, so the profile underneath redraws */
    if(global.Data && Data.invalidate) Data.invalidate('avatars');
    return r;
  }

  async function remove(id){
    await Store.del('avatars', id);
    try { await Store.del('avatar-art', id); } catch(e){}
    invalidate();
    if(global.Data && Data.invalidate) Data.invalidate('avatars');
  }

  async function art(id){
    try {
      const blob = await Store.get('avatar-art', id);
      return blob ? URL.createObjectURL(blob) : null;
    } catch(e){ return null; }
  }

  /* The one you have earned: the highest whose level you have passed. */
  async function current(level){
    const list = await all();
    const got = list.filter(a => a.level <= level);
    return got.length ? got[got.length - 1] : null;
  }

  /* The next one to come, so the profile can dangle it. */
  async function next(level){
    const list = await all();
    return list.find(a => a.level > level) || null;
  }

  /* Did climbing to this level earn a new one? */
  async function unlockedAt(level){
    const list = await all();
    return list.find(a => a.level === level) || null;
  }

  global.Avatars = { all, save, remove, art, current, next, unlockedAt, invalidate };
})(window);
