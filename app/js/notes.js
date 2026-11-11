/* Notes — everything Quick capture caught, sorted into the parts of your life.

   Capture stays fast and dumb on purpose: one tap, thought out of your head,
   no decisions. Deciding is a different job and it happens here — give a note an
   area, tag it, and when it is ready, turn it into a task on a day.

   It reads the same `inbox` store Quick capture writes to, so nothing has to be
   moved across and anything already captured is already here. */
(function(global){

  const DEFAULT_AREAS = [
    { k:'household', label:'Household', c:'#E8A33D' },
    { k:'personal',  label:'Personal',  c:'#3B9EFF' },
    { k:'content',   label:'Content',   c:'#FB6900' },
    { k:'work',      label:'Work',      c:'#A855F7' },
    { k:'money',     label:'Money',     c:'#5BBE6A' },
    { k:'errands',   label:'Errands',   c:'#22C7B8' }
  ];

  let areaCache = null;

  async function areas(){
    if(areaCache) return areaCache;
    let stored = null;
    try { stored = await Store.get('settings', 'note-areas'); } catch(e){ stored = null; }
    areaCache = (stored && stored.length) ? stored : DEFAULT_AREAS.slice();
    return areaCache;
  }
  async function saveAreas(list){
    areaCache = list;
    try { await Store.put('settings', list, 'note-areas'); } catch(e){}
  }
  const invalidate = () => areaCache = null;

  const areaOf = (list, k) => list.find(a => a.k === k) || null;

  async function all(){
    try {
      const { values } = await Store.all('inbox');
      return values.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch(e){ return []; }
  }

  async function save(note){
    const n = { ...note };
    n.tags = (n.tags || []).map(t => String(t).trim()).filter(Boolean);
    await Store.put('inbox', n);
    if(global.Data && Data.invalidate) Data.invalidate('inbox');
    return n;
  }

  async function remove(id){
    await Store.del('inbox', id);
    try { await Store.del('inbox-media', id + ':photo'); } catch(e){}
    try { await Store.del('inbox-media', id + ':audio'); } catch(e){}
    if(global.Data && Data.invalidate) Data.invalidate('inbox');
  }

  /* A note becomes a task and stops being a note — otherwise the same thing sits
     in two places and you tick it off in one of them. */
  async function toTask(note, day){
    const title = String(note.text || '').split('\n')[0].slice(0, 80) || 'Untitled';
    const rest = String(note.text || '').split('\n').slice(1).join('\n').trim();
    const area = areaOf(await areas(), note.area);

    const task = await QuickAdd.add({
      day, title,
      note: note.desc || rest,
      subs: (note.subs || []).map(x => ({ t:x.t || x, done:false })),
      source: area ? area.label : '',
      pri: note.pri || 'med'
    });
    await remove(note.id);
    return task;
  }

  const tagsOf = list => [...new Set((list || []).flatMap(n => n.tags || []))].sort();

  function counts(list, areaList){
    const out = { all:(list || []).length, unfiled:0 };
    (areaList || []).forEach(a => out[a.k] = 0);
    (list || []).forEach(n => {
      if(!n.area) out.unfiled++;
      else out[n.area] = (out[n.area] || 0) + 1;
    });
    return out;
  }

  global.Notes = { DEFAULT_AREAS, areas, saveAreas, invalidate, areaOf,
                   all, save, remove, toTask, tagsOf, counts };
})(window);
