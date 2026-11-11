/* The task library — the things you actually do, ready to pick.

   Picking one only prefills the add form; nothing here is special once a task
   exists. Edit or extend the list freely: a preset is just a name, a category,
   a default amount and a glyph. */
(function(global){

  const CATS = [
    { k:'all',        label:'All' },
    { k:'body',       label:'Body' },
    { k:'mind',       label:'Mind' },
    { k:'create',     label:'Create' },
    { k:'work',       label:'Work' },
    { k:'discipline', label:'Discipline' }
  ];

  /* Glyphs are single paths so they inherit colour and never need a second file. */
  const G = {
    barbell:'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
    run:'M13 4.5a1.4 1.4 0 1 0 0-.1M11 21l1.5-5.5L9 13l1-5 4 2 3 1M8.5 21l2-4',
    walk:'M13.5 4.2a1.3 1.3 0 1 0 0-.1M12 21v-6l-2.5-2 1-5.5 3.5 2 2.5.8M9 21l1.6-4',
    bike:'M6.5 18.5a3 3 0 1 0 0-.1M17.5 18.5a3 3 0 1 0 0-.1M9 18.5l3.5-7 3 4h3M12 7.5h3',
    swim:'M3 17c2-1.4 3.5-1.4 5.5 0s3.5 1.4 5.5 0 3.5-1.4 5.5 0M8 11.5l4-2.5 3.5 2M16.5 6.5a1.2 1.2 0 1 0 0-.1',
    shower:'M12 3v5M7.5 10.5A4.5 4.5 0 0 1 16.5 10.5zM8 15v1.5M12 15.5v2M16 15v1.5M10 19v1.5M14 19v1.5',
    water:'M7 4h10l-1 16H8zM7.5 10h9',
    plate:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM8.5 9.5h7M8.5 13h4',
    bed:'M3 18v-7h13a4 4 0 0 1 4 4v3M3 18h18M6.5 11V8.5h6V11',
    book:'M4 4.5h6a2.5 2.5 0 0 1 2 2 2.5 2.5 0 0 1 2-2h6v13h-6a2.5 2.5 0 0 0-2 2 2.5 2.5 0 0 0-2-2H4z',
    pen:'M4 20l4.5-1.2L19 8.2a2.2 2.2 0 0 0-3.2-3.2L5.2 15.5zM14.8 6.2l3 3',
    brain:'M9 5a3 3 0 0 0-3 3 2.6 2.6 0 0 0-.5 5A3 3 0 0 0 9 19h6a3 3 0 0 0 3.5-6 2.6 2.6 0 0 0-.5-5 3 3 0 0 0-3-3zM12 5v14',
    lang:'M4 6h10M9 4v2c0 4-2.5 7-5 8M7 11c1.5 2.5 3.5 4 6 4.5M13 20l4-9 4 9M14.5 17h5',
    camera:'M2.5 7h12v10h-12zM14.5 11l6-3v8l-6-3z',
    mic:'M12 4a2.4 2.4 0 0 1 2.4 2.4v5a2.4 2.4 0 0 1-4.8 0v-5A2.4 2.4 0 0 1 12 4zM6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3.5',
    scissors:'M6.5 5.5l11 11M17.5 5.5l-11 11M6 18.5a2.2 2.2 0 1 0 0-.1M6 5.5a2.2 2.2 0 1 0 0-.1',
    upload:'M12 19V5M6 11l6-6 6 6',
    idea:'M9.5 17h5M10 20h4M12 3a6 6 0 0 0-3.5 10.8V16h7v-2.2A6 6 0 0 0 12 3z',
    money:'M12 3v18M8 7.5h6a2.5 2.5 0 0 1 0 5h-4a2.5 2.5 0 0 0 0 5h6',
    mail:'M3 6h18v12H3zM3 6l9 7 9-7',
    code:'M9 8l-5 4 5 4M15 8l5 4-5 4',
    call:'M6 4h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.7 1.5C10 17.8 6.2 14 5 7.7A1.5 1.5 0 0 1 6.5 6z',
    clean:'M14 3l2 2-6.5 6.5-2-2zM7 12l5 5-4 4H4v-4z',
    sun:'M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M6.7 17.3l1.4-1.4M15.9 8.1l1.4-1.4M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    moon:'M19 14.5A8 8 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z',
    phone:'M7 3h10v18H7zM10.5 18.5h3',
    no:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM6.5 6.5l11 11',
    pray:'M12 4v8M9 8h6M8.5 20c0-3 1.5-5 3.5-5s3.5 2 3.5 5z',
    people:'M9 8.5a3 3 0 1 0 0-.1M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a2.6 2.6 0 1 1 0 5.2M17 19h3.5a4.5 4.5 0 0 0-3-4.2'
  };

  /* name, category, glyph, and what one go usually is */
  const TASKS = [
    /* body */
    { name:'Workout',            cat:'body', g:'barbell', amount:45, unit:'min', kind:'workout', rec:true },
    { name:'Run',                cat:'body', g:'run',     amount:3,  unit:'km',  rec:true },
    { name:'Walk',               cat:'body', g:'walk',    amount:30, unit:'min' },
    { name:'Cycle',              cat:'body', g:'bike',    amount:10, unit:'km' },
    { name:'Swim',               cat:'body', g:'swim',    amount:25, unit:'min' },
    { name:'Push-ups',           cat:'body', g:'barbell', amount:50, unit:'reps', rec:true },
    { name:'Stretch',            cat:'body', g:'walk',    amount:10, unit:'min' },
    { name:'Cold shower',        cat:'body', g:'shower',  amount:null, unit:'' },
    { name:'Drink water',        cat:'body', g:'water',   amount:2,  unit:'L',  rec:true },
    { name:'Hit protein',        cat:'body', g:'plate',   amount:150, unit:'g' },
    { name:'Meal prep',          cat:'body', g:'plate',   amount:60, unit:'min' },
    { name:'Hours slept',        cat:'body', g:'bed',     amount:8,  unit:'hr' },

    /* mind */
    { name:'Read',               cat:'mind', g:'book',    amount:20, unit:'pages', rec:true },
    { name:'Journal',            cat:'mind', g:'pen',     amount:null, unit:'' },
    { name:'Meditate',           cat:'mind', g:'brain',   amount:15, unit:'min' },
    { name:'Language practice',  cat:'mind', g:'lang',    amount:20, unit:'min' },
    { name:'Study',              cat:'mind', g:'book',    amount:45, unit:'min' },
    { name:'Pray',               cat:'mind', g:'pray',    amount:null, unit:'' },
    { name:'Plan tomorrow',      cat:'mind', g:'idea',    amount:10, unit:'min' },

    /* create */
    { name:'Shoot B-roll',       cat:'create', g:'camera', amount:null, unit:'', kind:'shoot', rec:true },
    { name:'Film a vlog',        cat:'create', g:'camera', amount:null, unit:'', kind:'shoot', rec:true },
    { name:'Record voiceover',   cat:'create', g:'mic',    amount:null, unit:'', kind:'shoot' },
    { name:'Edit a clip',        cat:'create', g:'scissors', amount:1, unit:'clips', kind:'edit', rec:true },
    { name:'Cut a short',        cat:'create', g:'scissors', amount:1, unit:'clips', kind:'edit' },
    { name:'Write a script',     cat:'create', g:'pen',    amount:500, unit:'words' },
    { name:'Thumbnail',          cat:'create', g:'idea',   amount:1, unit:'' },
    { name:'Publish',            cat:'create', g:'upload', amount:1, unit:'', kind:'publish', rec:true },
    { name:'Idea capture',       cat:'create', g:'idea',   amount:3, unit:'' },
    { name:'Engage with comments', cat:'create', g:'people', amount:20, unit:'min' },

    /* work */
    { name:'Deep work block',    cat:'work', g:'code',   amount:90, unit:'min', rec:true },
    { name:'Clear the inbox',    cat:'work', g:'mail',   amount:null, unit:'' },
    { name:'Client call',        cat:'work', g:'call',   amount:30, unit:'min' },
    { name:'Study for a cert',   cat:'work', g:'book',   amount:45, unit:'min' },
    { name:'Invoice and admin',  cat:'work', g:'money',  amount:30, unit:'min' },
    { name:'Tidy the workspace', cat:'work', g:'clean',  amount:15, unit:'min' },

    /* discipline */
    { name:'Wake up early',      cat:'discipline', g:'sun',   amount:null, unit:'', rec:true },
    { name:'No phone in bed',    cat:'discipline', g:'phone', amount:null, unit:'' },
    { name:'Screen time under',  cat:'discipline', g:'phone', amount:4, unit:'hr' },
    { name:'No junk food',       cat:'discipline', g:'no',    amount:null, unit:'' },
    { name:'No alcohol',         cat:'discipline', g:'no',    amount:null, unit:'' },
    { name:'In bed by',          cat:'discipline', g:'moon',  amount:null, unit:'' },
    { name:'Budget check',       cat:'discipline', g:'money', amount:10, unit:'min' }
  ];

  const icon = g => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round"><path d="${G[g] || G.idea}"/></svg>`;

  /* The list you actually see: the built-ins above, plus your edits on top.

     An edit is stored against the built-in's id rather than replacing the list,
     so the shipped ones can improve later without wiping what you changed, and
     hiding one is reversible. */
  const idOf = name => 'b_' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  let cache = null;

  async function load(){
    let edits = {};
    try { edits = await Store.allMap('presets'); } catch(e){ edits = {}; }

    const out = [];
    TASKS.forEach(t => {
      const id = idOf(t.name);
      const e = edits[id];
      if(e && e.hidden) return;
      out.push(Object.assign({ id, builtin:true }, t, e || {}));
    });
    Object.values(edits).forEach(e => {
      if(e.hidden || String(e.id).startsWith('b_')) return;
      out.push(Object.assign({ builtin:false }, e));
    });
    cache = out;
    return out;
  }

  const list = () => cache || TASKS.map(t => Object.assign({ id:idOf(t.name), builtin:true }, t));

  async function save(rec){
    const r = Object.assign({}, rec);
    if(!r.id) r.id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
    await Store.put('presets', r);
    await load();
    return r;
  }

  /* Removing a built-in hides it; removing one of yours deletes it. */
  async function remove(rec){
    if(rec.builtin) await Store.put('presets', { id:rec.id, hidden:true });
    else await Store.del('presets', rec.id);
    await load();
  }

  async function restoreHidden(){
    let edits = {};
    try { edits = await Store.allMap('presets'); } catch(e){ edits = {}; }
    for(const e of Object.values(edits)) if(e.hidden) await Store.del('presets', e.id);
    await load();
  }

  /* Substring match on the name, so "push" finds Push-ups and "wa" finds Walk
     and Drink water. Category 'all' means no filter. */
  function find(query, cat){
    const q = (query || '').trim().toLowerCase();
    return list().filter(t =>
      (!cat || cat === 'all' || t.cat === cat) &&
      (!q || t.name.toLowerCase().includes(q)));
  }

  /* What the add form should start with when a preset is picked. */
  function prefill(t){
    return {
      title: t.name,
      target: t.amount == null ? '' : (t.unit ? t.amount + ' ' + t.unit : String(t.amount)),
      kind: t.kind || null
    };
  }

  const UNITS = ['reps','min','hr','km','pages','L','g','words','clips'];

  global.TaskLib = { CATS, TASKS, UNITS, icon, find, prefill, G,
                     load, list, save, remove, restoreHidden, idOf };
})(window);
