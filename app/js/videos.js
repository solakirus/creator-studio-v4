/* Videos — a single video for one channel, belonging to nothing above it.

   A series is a run with a cadence and an episode is an outline with acts. This
   is the third thing: the one-off you thought of, will shoot on a day, and will
   publish. It carries its own shot list, so it can be scheduled onto a day and
   show up in Today with the shots as its steps. */
(function(global){

  const STAGES = [
    { k:'idea',      label:'Idea',      c:'#9AA0A6', d:'Written down, nothing planned' },
    { k:'planned',   label:'Planned',   c:'#3B9EFF', d:'Shot list ready, date set' },
    { k:'shot',      label:'Shot',      c:'#E8A33D', d:'Footage is in' },
    { k:'editing',   label:'Editing',   c:'#FB6900', d:'On the timeline' },
    { k:'published', label:'Published', c:'#5BBE6A', d:'Out in the world' }
  ];
  const stage = k => STAGES.find(s => s.k === k) || STAGES[0];

  const uid = () => 'vid_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  function blank(){
    return { id:null, title:'', channel:'', seriesId:null, plat:'youtube', stage:'idea',
             day:null, tags:[], hook:'', notes:'', shots:[], taskId:null,
             createdAt:Date.now() };
  }

  async function all(){
    try {
      const { values } = await Store.all('videos');
      return values.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch(e){ return []; }
  }

  async function get(id){ return (await all()).find(v => v.id === id) || null; }

  async function save(rec){
    const v = { ...blank(), ...rec };
    if(!v.id) v.id = uid();
    v.title = String(v.title || '').trim() || 'Untitled video';
    v.tags = (v.tags || []).map(t => String(t).trim()).filter(Boolean);
    await Store.put('videos', v);
    if(global.Data && Data.invalidate) Data.invalidate('videos');
    return v;
  }

  async function remove(id){
    const v = await get(id);
    if(v && v.taskId){ try { await Store.del('tasks', v.taskId); } catch(e){} }
    await Store.del('videos', id);
    if(global.Data && Data.invalidate) Data.invalidate('videos');
  }

  /* Putting it on a day writes a real task, so it turns up where you already
     look rather than only inside this screen. Re-scheduling moves the same task
     rather than leaving a trail of them. */
  async function schedule(video, day){
    const v = { ...video, day };

    if(v.taskId){
      try {
        const map = await Store.allMap('tasks');
        const t = map[v.taskId];
        if(t && t.view === 'todo'){
          t.day = day;
          t.title = 'Shoot — ' + v.title;
          t.subs = (v.shots || []).map(s => ({ t:s, done:false }));
          await Store.put('tasks', t);
          if(global.Data && Data.invalidate) Data.invalidate('tasks');
          return save({ ...v, stage: v.stage === 'idea' ? 'planned' : v.stage });
        }
      } catch(e){ /* fall through and write a fresh one */ }
    }

    const task = await QuickAdd.add({
      day,
      title: 'Shoot — ' + v.title,
      kind: 'shoot',
      note: v.hook || v.notes || '',
      source: v.channel || '',
      subs: (v.shots || []).map(s => ({ t:s, done:false }))
    });
    return save({ ...v, taskId: task.id, stage: v.stage === 'idea' ? 'planned' : v.stage });
  }

  async function unschedule(video){
    if(video.taskId){
      try { await Store.del('tasks', video.taskId); } catch(e){}
      if(global.Data && Data.invalidate) Data.invalidate('tasks');
    }
    return save({ ...video, taskId:null, day:null });
  }

  /* everything belonging to one run, newest first */
  async function forSeries(seriesId){
    if(!seriesId) return [];
    return (await all()).filter(v => v.seriesId === seriesId);
  }

  /* every tag in use, so the filter row is built from your own work */
  async function tags(){
    const list = await all();
    return [...new Set(list.flatMap(v => v.tags || []))].sort();
  }

  function counts(list){
    const out = {};
    STAGES.forEach(s => out[s.k] = 0);
    (list || []).forEach(v => { out[v.stage] = (out[v.stage] || 0) + 1; });
    return out;
  }

  global.Videos = { STAGES, stage, blank, all, get, save, remove, forSeries,
                    schedule, unschedule, tags, counts };
})(window);
