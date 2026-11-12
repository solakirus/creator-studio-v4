/* Templates — Shotline's templates inside Creator Studio.

   A template holds a shot structure (a storyboard: frames from the Library or
   empty slots to fill), a task list, a look (palette, mood, grade, music,
   transitions, titles, reference link and frames) and notebook pages. Use one
   for a new video, put it on a day, or make it where the Library's ＋ adds.

   Kinds (model.rs TEMPLATE_KINDS): Notebook pages, Weekly video, Short,
   Vlog day, Task list. The shot vocabulary is Shotline's (model.js). */
(function(global){

  const KINDS = ['Notebook pages', 'Weekly video', 'Short', 'Vlog day', 'Task list'];
  const ROLES = ['Action', 'Insert', 'B-roll', 'Talking', 'Reaction', 'Transition'];
  const SIZES = ['—', 'Wide', 'Medium', 'Close-up', 'Extreme close-up', 'Overhead', 'Low angle', 'High angle', 'POV', 'Over the shoulder', 'Insert'];
  const MOVES = ['—', 'Static', 'Handheld', 'Pan', 'Tilt', 'Push in', 'Pull out', 'Tracking', 'Orbit', 'Slow motion', 'Speed ramp'];
  const TRANSITIONS = ['Cut', 'Match cut', 'Jump cut', 'Whip pan', 'Speed ramp', 'Dissolve', 'J-cut', 'L-cut', 'End'];
  const DURATIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30];
  const FORMATS = { Long:{ label:'Weekly video · 16:9', shot:4 }, Short:{ label:'Short · 9:16', shot:2 } };
  const DEFAULT_PALETTE = ['#181A21', '#8B7CFF', '#FF9F5A', '#ECE7DE', '#40C4AA'];

  const rid = () => Math.random().toString(36).slice(2, 10);
  const nearestDuration = d => DURATIONS.reduce((best, x) => Math.abs(x - d) < Math.abs(best - d) ? x : best, DURATIONS[0]);
  const rgbHex = c => Array.isArray(c) ? '#' + c.map(x => (x | 0).toString(16).padStart(2, '0')).join('').toUpperCase() : (c || '#C2341F');

  function shot(o){
    return { id:rid(), item:'', name:'', kind:'', role:'Action', size:'—', movement:'—', seconds:0, label:'', notes:'',
      source:'', page:'', done:false, transition:'Cut', music:'', music_note:'', music_in:0, music_out:0, sequence:null, ...(o || {}) };
  }
  const slot = (role, label, size, movement, seconds) => shot({ role, label, size, movement, seconds });
  const task = title => ({ id:rid(), title, done:false });
  const look = o => ({ palette:DEFAULT_PALETTE.slice(), mood:'', grade:'', music:'', transitions:'', titles:'', reference:'', refs:[], ...(o || {}) });

  function blank(){
    return { id:rid(), name:'New template', kind:'Vlog day', format:'Long', description:'', color:'#D8432A',
      shots:[], tasks:[], look:look(), use_look:false, sheets:[], created:Date.now() };
  }

  /* model.rs Store::sample and sheet.rs notebook_templates */
  function samples(){
    const t = (o) => ({ ...blank(), ...o });
    const out = [
      t({ name:'Weekly vlog', kind:'Weekly video', format:'Long', description:'Cold open, intro, three day chapters and a wrap-up.', color:'#8B7CFF',
        shots:[slot('Action', 'Cold open: best moment of the week', 'Close-up', 'Handheld', 4), slot('Action', 'Title card over a wide establishing shot', 'Wide', 'Static', 3),
          slot('Transition', 'Whip pan into day one', '—', 'Pan', 1), slot('B-roll', 'Morning routine montage', 'Medium', 'Tracking', 8),
          slot('Talking', 'Talking to camera: plan for the week', 'Medium', 'Static', 20), slot('Transition', 'Match cut between days', '—', 'Speed ramp', 1),
          slot('B-roll', 'Work / training cutaways', 'Insert', 'Handheld', 10), slot('Action', 'Sunset wide + outro line', 'Wide', 'Pull out', 6)],
        tasks:['Charge batteries + clear cards', 'Write the hook', 'Pick music', 'Shoot', 'Edit rough cut', 'Colour + sound', 'Thumbnail + title', 'Upload + schedule'].map(task),
        look:look({ mood:'Warm, honest, a bit cinematic', grade:'Soft contrast, warm highlights, teal shadows', music:'Lo-fi / indie',
          palette:['#221E1C', '#E8AA6E', '#467882', '#F0E8DC', '#965A3C'] }), use_look:true }),
      t({ name:'Short: 3-shot hook', kind:'Short', format:'Short', description:'Fast vertical: hook, payoff, loop back.', color:'#FF9F5A',
        shots:[slot('Action', 'Pattern break in the first second', 'Close-up', 'Push in', 1.5), slot('Action', 'The payoff', 'Medium', 'Handheld', 5),
          slot('Transition', 'Loop cut back to the start', '—', 'Pan', 0.5)], tasks:['Film vertical', 'Captions', 'Post'].map(task) }),
      t({ name:'Gym day', kind:'Vlog day', format:'Long', description:'Training day chapter.', color:'#40C4AA',
        shots:[slot('Action', 'Walking in, bag over shoulder', 'Wide', 'Tracking', 3), slot('Insert', 'Chalk / straps close-up', 'Extreme close-up', 'Static', 2),
          slot('B-roll', 'Main lift, low angle', 'Medium', 'Static', 6), slot('Talking', 'Talk between sets', 'Medium', 'Handheld', 12)],
        tasks:['Pack tripod + mic', 'Film the main lift', 'Log PRs'].map(task) }),
      t({ name:'Self-care / slow day', kind:'Vlog day', format:'Long', description:'Soft, slower pacing.', color:'#EC96BE',
        shots:[slot('Action', 'Light through the window', 'Wide', 'Static', 3), slot('B-roll', 'Coffee / skincare inserts', 'Close-up', 'Tracking', 6),
          slot('Talking', 'Voice-over thoughts', 'Medium', 'Static', 15)], tasks:['Clean the set', 'Film routines', 'Record voice-over'].map(task) }),
      t({ name:'Post day', kind:'Task list', format:'Long', description:'Everything that happens after filming.', color:'#78A0FF',
        tasks:['Back up footage', 'Edit', 'Colour', 'Sound + music', 'Thumbnail', 'Title + description', 'Schedule', 'Cut 2 Shorts'].map(task) })
    ];
    const nbLook = look({ palette:Notebook.FRAMES_PALETTE.slice(0, 5), mood:'Quiet, cold, cinematic — a director\'s notebook',
      grade:'Blue tones dominant; crushed shadows; accents kept in red and green', music:'One score that sets the pace',
      transitions:'One page at a time, the frames moving inside', titles:'Hand-written marker titles, a red dot on top, red sign-off' });
    out.unshift(t({ name:'Behind the film · notebook carousel', kind:'Notebook pages', format:'Short', color:'#E23840',
      description:'All eight pages: frames, before & after, character, focal lengths, soundtrack, sign-off. 4:5.',
      tasks:['Pick nine frames that sum up the video', 'Pick a palette from them', 'Grade a before & after pair', 'Shoot the turnaround: front, 3/4, side, back',
        'Film one walk on two focal lengths', 'Choose the soundtrack', 'Sign it off', 'Save every page as a video and post the carousel'].map(task),
      look:nbLook, use_look:true, sheets:Notebook.carousel() }));
    const about = ['Nine frames, the palette they make and the lenses used. 4:5.', 'The same shot graded and ungraded, with notes. 4:5.',
      'Four turnaround pictures and the person\'s details. 4:5.', 'One walk on two focal lengths, with notes. 4:5.',
      'The track, the composer and a waveform. 4:5.', 'Before & after: graded for a silhouette. 4:5.',
      'Before & after: B-roll, close then wide. 4:5.', 'Title, a black & white portrait and a signature. 4:5.'];
    Notebook.carousel().forEach((s, i) => out.splice(1 + i, 0, t({ name:s.name, kind:'Notebook pages', format:'Short', color:'#E23840', description:about[i], sheets:[s] })));
    out.splice(9, 0, t({ name:'Task sequence · steps', kind:'Notebook pages', format:'Short', color:'#E23840',
      description:'A task\'s steps in order, each with its picture or GIF; tick them off while you shoot. 4:5.', sheets:[Notebook.stepsPage('Task')] }));
    out.forEach((x, i) => { x.created = Date.now() + i; });
    /* v4: the same ids on every device, so the laptop and the phone each making
       the samples end up with one set between them, not two */
    out.forEach((x, i) => { x.id = 'sample-' + String(i + 1).padStart(2, '0') + '-' +
      x.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); });
    return out;
  }

  /* ------------------------------------------------------------ storage */
  let cache = null;
  async function all(){
    if(cache) return cache;
    let list = [];
    try { list = (await Store.all('shot-templates')).values; } catch(e){ list = []; }
    let seeded = null;
    try { seeded = await Store.get('settings', 'shot-templates-seeded'); } catch(e){}
    if(!seeded && !list.length){
      list = samples();
      /* Written past sync (Store.raw): each device makes its own samples, so
         a phone opening for the first time can't push fresh samples over ones
         already edited on the laptop. Once edited, a sample syncs like any. */
      const w = (Store.raw && Store.raw.put) ? Store.raw : Store;
      for(const t of list) await w.put('shot-templates', t);
      await w.put('settings', true, 'shot-templates-seeded');
    }
    cache = list.sort((a, b) => (a.created || 0) - (b.created || 0));
    return cache;
  }
  const get = async id => (await all()).find(t => t.id === id) || null;
  async function save(t){
    const rec = { ...blank(), ...t, look:{ ...look(), ...(t.look || {}) } };
    await Store.put('shot-templates', rec);
    cache = null;
    return rec;
  }
  async function remove(id){ await Store.del('shot-templates', id); cache = null; const tg = await MediaLib.target(); if(tg && tg.tid === id) await MediaLib.setTarget(null); }
  const copyShot = s => ({ ...JSON.parse(JSON.stringify(s)), id:rid(), done:false, sequence:s.sequence ? Notebook.copyNew(s.sequence) : null });
  async function duplicate(id){
    const t = await get(id);
    if(!t) return null;
    return save({ ...JSON.parse(JSON.stringify(t)), id:rid(), name:t.name + ' copy', created:Date.now(),
      shots:t.shots.map(copyShot), sheets:t.sheets.map(Notebook.copyNew) });
  }
  async function create(o){ return save({ ...blank(), created:Date.now(), ...(o || {}) }); }

  /* ------------------------------------------------------------ frames → plans */
  /* app.rs shot_from_item: a GIF is a transition, a still lasts 3 s, a clip 2 s
     until its own length is known (then the nearest offered length) */
  async function shotFromItem(lib, it){
    const pg = lib.pageIdx.get(it.page);
    const s = shot({ item:it.uid, name:it.name, kind:it.kind, role:it.kind === 'gif' ? 'Transition' : 'Action',
      seconds:it.kind === 'image' ? 3 : 2, label:it.label || it.caption || '', source:pg ? pg.source : '',
      page:pg ? pg.collection + ' / ' + MediaLib.pageLabel(pg) : '' });
    const secs = await clipSeconds(lib, it);
    if(secs) s.seconds = nearestDuration(secs);
    return s;
  }
  async function clipSeconds(lib, it){
    if(it.kind === 'gif') return Notebook.gifSeconds(lib, it.uid);
    if(it.kind !== 'video') return 0;
    if(it.src === 'db'){ try { const r = await Store.get('lib-items', it.id); if(r && r.dur) return r.dur; } catch(e){} }
    try { const m = await Notebook.mediaFor(lib, it.uid); return m && m.el && m.el.duration || 0; } catch(e){ return 0; }
  }
  /* fill one shot with a frame, keeping what was planned for it */
  async function fillShot(shotRec, uid){
    const lib = await MediaLib.load();
    const it = MediaLib.find(lib, uid);
    if(!it) return shotRec;
    const fresh = await shotFromItem(lib, it);
    return { ...shotRec, item:fresh.item, name:fresh.name, kind:fresh.kind, source:fresh.source, page:fresh.page,
      seconds:(it.kind !== 'image' ? fresh.seconds : shotRec.seconds || fresh.seconds), label:shotRec.label || fresh.label };
  }

  /* where the Library's ＋ puts frames (app.rs add_items):
       { kind:'shots', tid }       a template's storyboard
       { kind:'sheet', tid, sid }  a notebook page: fills its empty spots in order
       { kind:'look',  tid }       the look's reference frames */
  async function addToTarget(tg, uids){
    if(!tg) return 0;
    const t = await get(tg.tid);
    if(!t) return 0;
    const lib = await MediaLib.load();
    const items = uids.map(u => MediaLib.find(lib, u)).filter(Boolean);
    if(!items.length) return 0;
    let n = 0;
    if(tg.kind === 'sheet'){
      const sh = findSheet(t, tg.sid);
      if(!sh) return 0;
      const had = new Set(sh.slots.map(x => x.item));
      const queue = items.filter(i => !had.has(i.uid));
      for(const sl of sh.slots.filter(x => !x.item)){ const i = queue.shift(); if(!i) break; sl.item = i.uid; n++; }
    } else if(tg.kind === 'look'){
      for(const i of items){ if(!t.look.refs.includes(i.uid)){ t.look.refs.push(i.uid); n++; } }
    } else {
      for(const i of items){ t.shots.push(await shotFromItem(lib, i)); n++; }
    }
    if(n) await save(t);
    return n;
  }
  /* a page anywhere in a template: its pages, or a shot's task sequence */
  function findSheet(t, sid){
    return t.sheets.find(s => s.id === sid) || (t.shots.find(s => s.sequence && s.sequence.id === sid) || {}).sequence || null;
  }

  /* ------------------------------------------------------------ using a template */
  const lookLine = l => [l.mood && 'Mood: ' + l.mood, l.grade && 'Grade: ' + l.grade, l.music && 'Music: ' + l.music,
    l.transitions && 'Transitions: ' + l.transitions, l.titles && 'Titles: ' + l.titles, l.reference && 'Reference: ' + l.reference]
    .filter(Boolean).join('\n');
  const shotLine = s => [s.label || s.name || s.role, [s.size, s.movement].filter(x => x && x !== '—').join(' · '),
    s.seconds ? Notebook.fmtTime(s.seconds) : ''].filter(Boolean).join(' — ');

  /* v4: a template's shots as one task-sequence page — each spot holds the
     shot's GIF, clip or still and its line — so the task (and the phone) shows
     the frame beside every step. A page holds 14 spots; shots past that stay
     as steps without a picture. A template with no shots uses its first
     steps or frames page as it is. Returns null when there's nothing to show. */
  function pageFrom(t){
    if(!global.Notebook) return null;
    const shots = (t.shots || []).filter(s => s.item || s.label || s.name);
    if(shots.length){
      const P = Notebook.stepsPage(t.name);
      P.name = 'Shot sequence · ' + t.name;
      P.slots = shots.slice(0, Notebook.MAX_STEPS).map(s => ({ item:s.item || '', tone:'', text:shotLine(s), role:s.role || '', done:false }));
      return P;
    }
    const sh = (t.sheets || []).find(x => x.layout === 'steps') || (t.sheets || [])[0];
    return sh ? Notebook.copyNew(sh) : null;
  }
  /* pages beside the shot page: the template's notebook pages, when its shots made the shot page */
  const otherPages = (t, main) => (t.shots || []).some(s => s.item || s.label || s.name)
    ? (t.sheets || []).map(x => Notebook.copyNew(x)) : (t.sheets || []).filter(x => !main || x.id !== main.id).map(x => Notebook.copyNew(x));

  /* ui_videos.rs project_from_template → a Creator Studio video carrying its
     shot list, with the look and tasks in its notes */
  /* v4: a one-off video is a Clip (Content → Clips, starting in Plan). It
     carries the template's shot list, notes and shot page (frames included). */
  async function newClip(id){
    const t = await get(id);
    if(!t || !global.Data || !Data.saveClip) return null;
    const notes = [t.description, t.use_look ? lookLine(t.look) : '', t.tasks.length ? 'Tasks:\n' + t.tasks.map(x => '• ' + x.title).join('\n') : '']
      .filter(Boolean).join('\n\n');
    const shots = t.shots.length ? t.shots.map(shotLine)
      : t.sheets.flatMap(s => s.layout === 'steps' ? s.slots.map(x => x.text).filter(Boolean) : [s.name]);
    const page = pageFrom(t);
    const clip = await Data.saveClip({ title:t.name, plat:t.format === 'Short' ? 'shorts' : 'youtube', stage:'idea',
      channel:'', seriesId:null, dur:'0:00', pct:(Data.PCT_FOR || {}).raw || 0,
      plan:{ hook:t.description || '', notes }, shots, tags:[t.kind], template:t.id,
      page, pageFrom: page ? { tid:t.id, sid:page.id, template:t.name } : null });
    if(Data.invalidate) Data.invalidate('clips');
    return clip;
  }

  /* ui_week.rs apply_template_to_day → real tasks on that date: the template's
     tasks, and one shoot task whose steps are its shots */
  async function putOnDay(id, ts){
    const t = await get(id);
    if(!t || !global.QuickAdd) return 0;
    const day = await Data.dateToDay(ts);
    let n = 0;
    if(t.shots.length || t.sheets.length){
      const page = pageFrom(t);
      /* shots past what one page holds stay as plain steps after the page's */
      const extra = t.shots.length > Notebook.MAX_STEPS ? t.shots.slice(Notebook.MAX_STEPS).map(shotLine) : [];
      const subs = page ? extra.map(x => ({ t:x, done:false }))
        : (t.shots.length ? t.shots.map(shotLine)
          : t.sheets.flatMap(s => s.layout === 'steps' ? s.slots.map(x => x.text).filter(Boolean) : [s.name])).map(x => ({ t:x, done:false }));
      await QuickAdd.add({ day, title:'Shoot — ' + t.name, kind:'shoot', note:[t.description, t.use_look ? lookLine(t.look) : ''].filter(Boolean).join('\n\n'), subs,
        page, pageFrom: page ? { tid:t.id, sid:page.id, template:t.name } : null, morePages: page ? otherPages(t, page) : [] });
      n++;
    }
    for(const x of t.tasks){ await QuickAdd.add({ day, title:x.title }); n++; }
    if(global.Data && Data.invalidate) Data.invalidate('tasks');
    return n;
  }

  /* Shotline's own templates (Shot Library/_Shotline/plan.json, laptop) */
  async function importShotline(list){
    const mine = await all();
    let n = 0;
    for(const s of (list || [])){
      if(mine.some(x => x.id === s.id)) continue;
      const lk = s.look || {};
      await save({ ...blank(), id:s.id || rid(), name:s.name || 'Template', kind:KINDS.includes(s.kind) ? s.kind : 'Task list',
        format:s.format === 'Short' ? 'Short' : 'Long', description:s.description || '', color:rgbHex(s.color),
        shots:(s.shots || []).map(x => shot({ ...x, sequence:x.sequence ? convSheet(x.sequence) : null })),
        tasks:(s.tasks || []).map(x => ({ id:x.id || rid(), title:x.title || '', done:!!x.done })),
        look:look({ ...lk, palette:(lk.palette || []).map(rgbHex), refs:lk.refs || [] }), use_look:!!s.use_look,
        sheets:(s.sheets || []).map(convSheet), created:Date.now() + n });
      n++;
    }
    return n;
  }
  const convSheet = s => ({ id:s.id || rid(), layout:s.layout || 'cover', name:s.name || 'Page', fields:s.fields || {},
    slots:(s.slots || []).map(x => ({ item:x.item || '', tone:x.tone || '', text:x.text || '', role:x.role || '', done:!!x.done })),
    palette:(s.palette || []).map(rgbHex), seconds:s.seconds || 5, music:/^https?:/i.test(s.music || '') ? s.music : '',
    music_note:s.music_note || '', music_in:0, music_out:0 });

  const totalSeconds = t => t.shots.reduce((a, s) => a + (s.seconds > 0 ? s.seconds : FORMATS[t.format] ? FORMATS[t.format].shot : 4), 0);

  global.ShotTemplates = {
    KINDS, ROLES, SIZES, MOVES, TRANSITIONS, DURATIONS, FORMATS,
    all, get, save, remove, duplicate, create, blank, shot, copyShot,
    shotFromItem, fillShot, addToTarget, findSheet, nearestDuration, totalSeconds,
    newClip, putOnDay, importShotline, pageFrom, invalidate:() => { cache = null; }
  };
})(window);
