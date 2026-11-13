/* Creator Studio — storage layer.
   One database, one version, every store declared in one place. */
(function(global){
  const DB_NAME = global.CS_DB_NAME || 'creator-studio-4';   /* tests set CS_DB_NAME so they never touch real data */
  const DB_VERSION = 38;
  const STORES = {
    art:            {},                  // task card images, keyed by item slug
    focal:          {},                  // {x,y} focal point per item slug
    toolicon:       {},                  // {preset} | {blob} per tool slug
    'exercise-art': {},                  // exercise images
    sessions:       { keyPath:'id' },    // finished workout sessions
    tasks:          { keyPath:'id' },     // planner tasks
    series:         { keyPath:'id' },     // content series
    clips:          { keyPath:'id' },     // captured clips
    settings:       {},                   // loose key/value app settings
    meals:          { keyPath:'id' },     // saved meals — the base unit
    'meal-photo':   {},                   // meal photos, keyed by meal id
    templates:      { keyPath:'id' },     // one day of meals, reusable
    planner:        { keyPath:'id' },     // one record per ISO week
    grocery:        { keyPath:'id' },     // ticks + hand-added items, per week
    pantry:         { keyPath:'id' },     // what you already have
    prep:           { keyPath:'id' },     // meal prep sessions
    swipes:         { keyPath:'id' },     // swipe file entries
    'swipe-thumb':  {},                   // swipe cover images, keyed by swipe id
    refs:           { keyPath:'id' },     // reference library frames
    'ref-img':      {},                   // reference stills and clips, keyed by ref id
    'ref-poster':   {},                   // a still pulled from a clip, so a grid stays cheap
    'section-art':  {},                   // your own artwork behind any section header
    loads:          { keyPath:'id' },     // the working weight you are currently using
    routines:       { keyPath:'id' },     // saved workouts you can run again
    courses:        { keyPath:'id' },     // reading you imported yourself
    journal:        { keyPath:'id' },     // one entry per day, keyed YYYY-MM-DD
    'journal-media':{},                   // photos and voice notes, keyed by entry id
    vlogs:          { keyPath:'id' },     // vlog outlines and their beat timelines
    inbox:          { keyPath:'id' },     // quick captures waiting to be filed
    'inbox-media':  {},                   // photos and voice notes for captures
    'task-media':   {},                   // photos pinned to a task, keyed <taskId>:<n>
    challenges:     { keyPath:'id' },     // the arc, the month, and the weekly milestones
    runs:           { keyPath:'id' },     // runs: distance, time, pace
    awards:         { keyPath:'id' },     // what has been unlocked, and when
    'profile-photo':{},                   // the photo at the top of the profile
    'avatar-art':   {},                   // the artwork, keyed by avatar id
    avatars:        { keyPath:'id' },     // the ladder you are climbing
    exercises:      { keyPath:'id' },     // your own exercises, and edits to the built-ins
    plans:          { keyPath:'id' },     // program plans: recurring work that ramps
    presets:        { keyPath:'id' },     // your own sample tasks, and edits to the built-ins
    'award-art':    {},                   // achievement artwork, keyed by award id
    'award-def':    { keyPath:'id' },     // your own achievements, and edits to the built-ins
    rating:         { keyPath:'id' },     // rating attributes and the rules that feed them
    videos:         { keyPath:'id' },     // one-off videos: not a series, not an episode
    'seq-template': {},                   // reusable sequences: a name and its shots
    quarters:       { keyPath:'id' },     // the research unit: one topic, twelve weeks
    sources:        { keyPath:'id' },     // what is true and who said it
    physique:       { keyPath:'id' },     // weight and photo log
    'physique-photo': {},                 // the photos themselves, keyed by entry id
    months:         { keyPath:'id' },     // challenge months: whole weeks, one challenge, its stakes
    'board-items':  { keyPath:'id' },     // boards, cards, lines and ink from the canvas (board/board.html)
    /* Library and Templates, carried over from Shotline */
    'lib-items':    { keyPath:'id' },     // GIFs, clips and stills you added: name, kind, library, page
    'lib-blob':     {},                   // the files themselves, keyed by item id
    'lib-poster':   {},                   // a still from each clip, so a grid stays cheap
    'lib-boards':   { keyPath:'id' },     // boards: a name, a group and the frames on it
    'shot-templates': { keyPath:'id' },   // Shotline templates: shots, tasks, look, notebook pages
    'nb-music':     {},                   // music attached to a notebook page, keyed by its own id
    /* v4: the frames a task or video uses, copied out of the Library so they
       travel to the phone without it. Keyed by the Library uid they came from.
       taskframes.js keeps and clears them (21 days after the task's date). */
    'task-frames':  { keyPath:'uid' },
    /* v4: starred groups — frames picked on the laptop that live on every
       device, always (taskframes.js keeps them; they're never swept) */
    'star-groups':  { keyPath:'id' },
    /* v4: frames a device asked the others for (frameget.js): whoever has
       one copies it into task-frames, and the asker saves it into its Library */
    'frame-requests': { keyPath:'uid' }
  };

  let dbp = null;
  function db(){
    if(dbp) return dbp;
    dbp = new Promise((res,rej)=>{
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        Object.entries(STORES).forEach(([name,opts]) => {
          if(!d.objectStoreNames.contains(name)) d.createObjectStore(name, opts);
        });
      };
      r.onsuccess = () => res(r.result);
      r.onerror  = e => {
        /* The phone already has a NEWER database than this code knows about
           (a later build bumped DB_VERSION). Asking for an older version is an
           error that would take the whole app down — open it as it is instead.
           Nothing is lost; stores this build doesn't know are simply unused.

           This is here because of 5 Oct 2026: a build made from a stale copy
           went onto the phone and the app would not open at all. */
        if(r.error && r.error.name === 'VersionError'){
          e.preventDefault && e.preventDefault();
          const r2 = indexedDB.open(DB_NAME);
          r2.onsuccess = () => res(r2.result);
          r2.onerror = () => rej(r2.error);
          return;
        }
        rej(r.error);
      };
    });
    return dbp;
  }

  async function get(store, key){
    const d = await db();
    return new Promise((res,rej)=>{
      const r = d.transaction(store,'readonly').objectStore(store).get(key);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function all(store){
    const d = await db();
    return new Promise((res,rej)=>{
      const t = d.transaction(store,'readonly'), st = t.objectStore(store);
      const kr = st.getAllKeys(), vr = st.getAll();
      t.oncomplete = () => res({ keys:kr.result, values:vr.result });
      t.onerror = () => rej(t.error);
    });
  }
  async function allMap(store){
    const { keys, values } = await all(store);
    const out = {}; keys.forEach((k,i) => out[k] = values[i]); return out;
  }
  async function put(store, value, key){
    const d = await db();
    return new Promise((res,rej)=>{
      const t = d.transaction(store,'readwrite');
      key === undefined ? t.objectStore(store).put(value) : t.objectStore(store).put(value, key);
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  }
  async function del(store, key){
    const d = await db();
    return new Promise((res,rej)=>{
      const t = d.transaction(store,'readwrite');
      t.objectStore(store).delete(key);
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  }

  async function clear(store){
    const d = await db();
    return new Promise((res,rej)=>{
      const t = d.transaction(store,'readwrite');
      t.objectStore(store).clear();
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  }
  const names = () => Object.keys(STORES);

  global.Store = { db, get, all, allMap, put, del, clear, names };
})(window);
