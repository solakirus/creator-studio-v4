/* The exercise library.

   Built-ins ship with the app; anything you add or change is stored and merged
   over the top, so the library is yours without you having to type it all in. */
(function(global){

  /* Muscles worth distinguishing when you are planning a week. Finer than this
     and you spend longer tagging than training. */
  const MUSCLES = [
    { id:'chest',      n:'Chest',      c:'#C4613A', region:'upper' },
    { id:'back',       n:'Back',       c:'#5B62A8', region:'upper' },
    { id:'shoulders',  n:'Shoulders',  c:'#B4533A', region:'upper' },
    { id:'biceps',     n:'Biceps',     c:'#7B4FA8', region:'upper' },
    { id:'triceps',    n:'Triceps',    c:'#A8506E', region:'upper' },
    { id:'forearms',   n:'Forearms',   c:'#8A6A2F', region:'upper' },
    { id:'quads',      n:'Quads',      c:'#3F8A88', region:'lower' },
    { id:'hamstrings', n:'Hamstrings', c:'#4B8A57', region:'lower' },
    { id:'glutes',     n:'Glutes',     c:'#C18A2E', region:'lower' },
    { id:'calves',     n:'Calves',     c:'#6E8A3F', region:'lower' },
    { id:'core',       n:'Core',       c:'#E8A33D', region:'core'  },
    { id:'cardio',     n:'Cardio',     c:'#3B9EFF', region:'cardio' }
  ];
  const byMuscle = Object.fromEntries(MUSCLES.map(m => [m.id, m]));

  const EQUIPMENT = ['barbell','dumbbell','machine','cable','bodyweight','kettlebell','bands','other'];

  /* pri = what it is for; sec = what also gets worked */
  const BUILT_IN = [
    /* chest */
    { id:'bench-press',      name:'Bench press',       pri:['chest'], sec:['triceps','shoulders'], eq:'barbell',    kg:50,  reps:8  },
    { id:'incline-press',    name:'Incline press',     pri:['chest'], sec:['shoulders','triceps'], eq:'barbell',    kg:40,  reps:8  },
    { id:'db-press',         name:'Dumbbell press',    pri:['chest'], sec:['triceps'],             eq:'dumbbell',   kg:22,  reps:10 },
    { id:'cable-fly',        name:'Cable fly',         pri:['chest'], sec:[],                      eq:'cable',      kg:15,  reps:12 },
    { id:'push-up',          name:'Push-up',           pri:['chest'], sec:['triceps','core'],      eq:'bodyweight', kg:0,   reps:15 },
    { id:'dips',             name:'Dips',              pri:['chest'], sec:['triceps'],             eq:'bodyweight', kg:0,   reps:10 },

    /* back */
    { id:'deadlift',         name:'Deadlift',          pri:['back'], sec:['hamstrings','glutes','forearms'], eq:'barbell', kg:100, reps:5 },
    { id:'barbell-row',      name:'Barbell row',       pri:['back'], sec:['biceps'],               eq:'barbell',    kg:60,  reps:8  },
    { id:'pull-up',          name:'Pull-up',           pri:['back'], sec:['biceps','core'],        eq:'bodyweight', kg:0,   reps:8  },
    { id:'lat-pulldown',     name:'Lat pulldown',      pri:['back'], sec:['biceps'],               eq:'machine',    kg:50,  reps:10 },
    { id:'seated-row',       name:'Seated row',        pri:['back'], sec:['biceps'],               eq:'machine',    kg:55,  reps:10 },
    { id:'db-row',           name:'Dumbbell row',      pri:['back'], sec:['biceps'],               eq:'dumbbell',   kg:25,  reps:10 },
    { id:'face-pull',        name:'Face pull',         pri:['back'], sec:['shoulders'],            eq:'cable',      kg:20,  reps:15 },

    /* shoulders */
    { id:'overhead-press',   name:'Overhead press',    pri:['shoulders'], sec:['triceps','core'],  eq:'barbell',    kg:35,  reps:5  },
    { id:'db-shoulder-press',name:'DB shoulder press', pri:['shoulders'], sec:['triceps'],         eq:'dumbbell',   kg:16,  reps:10 },
    { id:'lateral-raise',    name:'Lateral raise',     pri:['shoulders'], sec:[],                  eq:'dumbbell',   kg:10,  reps:15 },
    { id:'rear-delt-fly',    name:'Rear delt fly',     pri:['shoulders'], sec:['back'],            eq:'dumbbell',   kg:8,   reps:15 },
    { id:'upright-row',      name:'Upright row',       pri:['shoulders'], sec:['forearms'],        eq:'barbell',    kg:30,  reps:12 },

    /* arms */
    { id:'barbell-curl',     name:'Barbell curl',      pri:['biceps'], sec:['forearms'],           eq:'barbell',    kg:25,  reps:10 },
    { id:'hammer-curl',      name:'Hammer curl',       pri:['biceps'], sec:['forearms'],           eq:'dumbbell',   kg:12,  reps:12 },
    { id:'preacher-curl',    name:'Preacher curl',     pri:['biceps'], sec:[],                     eq:'machine',    kg:20,  reps:12 },
    { id:'tricep-pushdown',  name:'Tricep pushdown',   pri:['triceps'], sec:[],                    eq:'cable',      kg:25,  reps:12 },
    { id:'skull-crusher',    name:'Skull crusher',     pri:['triceps'], sec:[],                    eq:'barbell',    kg:25,  reps:10 },
    { id:'close-grip-bench', name:'Close-grip bench',  pri:['triceps'], sec:['chest'],             eq:'barbell',    kg:45,  reps:8  },
    { id:'farmers-carry',    name:"Farmer's carry",    pri:['forearms'], sec:['core','back'],      eq:'dumbbell',   kg:30,  reps:1  },

    /* legs */
    { id:'back-squat',       name:'Back squat',        pri:['quads'], sec:['glutes','core'],       eq:'barbell',    kg:60,  reps:5  },
    { id:'front-squat',      name:'Front squat',       pri:['quads'], sec:['core','glutes'],       eq:'barbell',    kg:50,  reps:5  },
    { id:'leg-press',        name:'Leg press',         pri:['quads'], sec:['glutes'],              eq:'machine',    kg:120, reps:10 },
    { id:'leg-extension',    name:'Leg extension',     pri:['quads'], sec:[],                      eq:'machine',    kg:45,  reps:12 },
    { id:'romanian-dl',      name:'Romanian deadlift', pri:['hamstrings'], sec:['glutes','back'],  eq:'barbell',    kg:70,  reps:8  },
    { id:'leg-curl',         name:'Leg curl',          pri:['hamstrings'], sec:[],                 eq:'machine',    kg:40,  reps:12 },
    { id:'hip-thrust',       name:'Hip thrust',        pri:['glutes'], sec:['hamstrings'],         eq:'barbell',    kg:80,  reps:10 },
    { id:'walking-lunge',    name:'Walking lunge',     pri:['glutes'], sec:['quads','core'],       eq:'dumbbell',   kg:20,  reps:12 },
    { id:'bulgarian-split',  name:'Bulgarian split squat', pri:['glutes'], sec:['quads'],          eq:'dumbbell',   kg:16,  reps:10 },
    { id:'calf-raise',       name:'Calf raise',        pri:['calves'], sec:[],                     eq:'machine',    kg:60,  reps:15 },

    /* core */
    { id:'plank',            name:'Plank',             pri:['core'], sec:[],                       eq:'bodyweight', kg:0,   reps:60 },
    { id:'hanging-leg-raise',name:'Hanging leg raise', pri:['core'], sec:['forearms'],             eq:'bodyweight', kg:0,   reps:12 },
    { id:'cable-crunch',     name:'Cable crunch',      pri:['core'], sec:[],                       eq:'cable',      kg:30,  reps:15 },
    { id:'ab-wheel',         name:'Ab wheel',          pri:['core'], sec:[],                       eq:'other',      kg:0,   reps:10 },
    { id:'russian-twist',    name:'Russian twist',     pri:['core'], sec:[],                       eq:'other',      kg:8,   reps:20 },

    /* cardio */
    { id:'treadmill',        name:'Treadmill',         pri:['cardio'], sec:[],                     eq:'machine',    kg:0,   reps:20 },
    { id:'rower',            name:'Rower',             pri:['cardio'], sec:['back','legs'],        eq:'machine',    kg:0,   reps:15 },
    { id:'assault-bike',     name:'Assault bike',      pri:['cardio'], sec:[],                     eq:'machine',    kg:0,   reps:10 },
    { id:'jump-rope',        name:'Jump rope',         pri:['cardio'], sec:['calves'],             eq:'bodyweight', kg:0,   reps:10 },
    { id:'incline-walk',     name:'Incline walk',      pri:['cardio'], sec:['calves'],             eq:'machine',    kg:0,   reps:30 },

    /* calisthenics */
    { id:'pike-push-up',     name:'Pike push-up',      pri:['shoulders'], sec:['triceps'],          eq:'bodyweight', kg:0, reps:10 },
    { id:'diamond-push-up',  name:'Diamond push-up',   pri:['triceps'], sec:['chest'],              eq:'bodyweight', kg:0, reps:12 },
    { id:'archer-push-up',   name:'Archer push-up',    pri:['chest'], sec:['triceps','core'],       eq:'bodyweight', kg:0, reps:8  },
    { id:'chin-up',          name:'Chin-up',           pri:['biceps'], sec:['back'],                eq:'bodyweight', kg:0, reps:8  },
    { id:'inverted-row',     name:'Inverted row',      pri:['back'], sec:['biceps'],                eq:'bodyweight', kg:0, reps:12 },
    { id:'pistol-squat',     name:'Pistol squat',      pri:['quads'], sec:['glutes','core'],        eq:'bodyweight', kg:0, reps:6  },
    { id:'nordic-curl',      name:'Nordic curl',       pri:['hamstrings'], sec:['core'],            eq:'bodyweight', kg:0, reps:6  },
    { id:'l-sit',            name:'L-sit hold',        pri:['core'], sec:['quads'],                 eq:'bodyweight', kg:0, reps:20 },
    { id:'hollow-hold',      name:'Hollow hold',       pri:['core'], sec:[],                        eq:'bodyweight', kg:0, reps:30 },
    { id:'burpee',           name:'Burpee',            pri:['cardio'], sec:['chest','quads'],       eq:'bodyweight', kg:0, reps:15 },
    { id:'mountain-climber', name:'Mountain climber',  pri:['core'], sec:['cardio'],                eq:'bodyweight', kg:0, reps:30 },
    { id:'bear-crawl',       name:'Bear crawl',        pri:['core'], sec:['shoulders'],             eq:'bodyweight', kg:0, reps:30 },

    /* mobility and yoga */
    { id:'sun-salutation',   name:'Sun salutation',    pri:['core'], sec:['shoulders'],             eq:'bodyweight', kg:0, reps:5  },
    { id:'downward-dog',     name:'Downward dog',      pri:['hamstrings'], sec:['shoulders'],       eq:'bodyweight', kg:0, reps:60 },
    { id:'warrior-two',      name:'Warrior II',        pri:['quads'], sec:['core'],                 eq:'bodyweight', kg:0, reps:45 },
    { id:'pigeon-pose',      name:'Pigeon pose',       pri:['glutes'], sec:[],                      eq:'bodyweight', kg:0, reps:60 },
    { id:'couch-stretch',    name:'Couch stretch',     pri:['quads'], sec:[],                       eq:'bodyweight', kg:0, reps:60 },
    { id:'thoracic-opener',  name:'Thoracic opener',   pri:['back'], sec:['shoulders'],             eq:'bodyweight', kg:0, reps:45 },

    /* conditioning and sport */
    { id:'shadow-boxing',    name:'Shadow boxing',     pri:['cardio'], sec:['shoulders','core'],    eq:'bodyweight', kg:0, reps:3  },
    { id:'heavy-bag',        name:'Heavy bag rounds',  pri:['cardio'], sec:['shoulders','core'],    eq:'other',      kg:0, reps:3  },
    { id:'jump-squat',       name:'Jump squat',        pri:['quads'], sec:['calves','cardio'],      eq:'bodyweight', kg:0, reps:15 },
    { id:'box-jump',         name:'Box jump',          pri:['quads'], sec:['calves'],               eq:'other',      kg:0, reps:10 },
    { id:'lateral-bound',    name:'Lateral bound',     pri:['glutes'], sec:['quads','calves'],      eq:'bodyweight', kg:0, reps:12 },
    { id:'suicide-run',      name:'Suicide sprints',   pri:['cardio'], sec:['quads'],               eq:'bodyweight', kg:0, reps:6  },
    { id:'ruck-march',       name:'Ruck march',        pri:['cardio'], sec:['back','calves'],       eq:'other',      kg:0, reps:45 },
    { id:'flutter-kick',     name:'Flutter kicks',     pri:['core'], sec:[],                        eq:'bodyweight', kg:0, reps:40 },
    { id:'sit-up',           name:'Sit-up',            pri:['core'], sec:[],                        eq:'bodyweight', kg:0, reps:25 }
  ];

  let cache = null;

  /* Built-ins, with your edits merged over them and your own additions appended. */
  async function all(){
    if(cache) return cache;
    let mine = [];
    try { const { values } = await Store.all('exercises'); mine = values; }
    catch(e){ mine = []; }

    const edits = Object.fromEntries(mine.map(x => [x.id, x]));
    const merged = BUILT_IN
      .filter(b => !(edits[b.id] && edits[b.id].hidden))
      .map(b => ({ ...b, ...(edits[b.id] || {}), builtIn:true }));

    const own = mine.filter(x => !BUILT_IN.some(b => b.id === x.id) && !x.hidden);
    cache = [...merged, ...own].sort((a,b) => a.name.localeCompare(b.name));
    return cache;
  }
  const invalidate = () => { cache = null; };

  async function save(rec){
    const r = {
      id: rec.id || 'ex_' + Date.now().toString(36),
      name: rec.name, pri: rec.pri || [], sec: rec.sec || [],
      eq: rec.eq || 'other', kg: +rec.kg || 0, reps: +rec.reps || 8
    };
    await Store.put('exercises', r);
    invalidate();
    return r;
  }

  /* Built-ins cannot be deleted, only hidden — so a reset can bring them back. */
  async function remove(id){
    const built = BUILT_IN.some(b => b.id === id);
    if(built) await Store.put('exercises', { id, hidden:true });
    else await Store.del('exercises', id);
    invalidate();
  }
  async function restoreAll(){
    const { values } = await Store.all('exercises');
    for(const v of values) if(v.hidden) await Store.del('exercises', v.id);
    invalidate();
  }

  /* Which muscles a set of exercises covers, and how hard. Primary counts double,
     because a bench press is not a shoulder day. */
  function coverage(list){
    const score = {};
    list.forEach(x => {
      (x.pri || []).forEach(m => score[m] = (score[m] || 0) + 2);
      (x.sec || []).forEach(m => score[m] = (score[m] || 0) + 1);
    });
    return MUSCLES
      .map(m => ({ ...m, score: score[m.id] || 0 }))
      .filter(m => m.score > 0)
      .sort((a,b) => b.score - a.score);
  }

  /* A drawn glyph per muscle, so a card grid is scannable without photographs. */
  const GLYPH = {
    /* Read at 30px on a coloured band, so each one is a simple silhouette rather
       than a diagram. A plate-loaded bar reads as lifting; the rest are cues. */
    chest:'M3 9h18M6 9v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9M12 9v9',
    back:'M12 3v18M8 6l4-3 4 3M6 11h12M7 16h10',
    shoulders:'M12 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M4 20a8 8 0 0 1 16 0M7 12l-3 3M17 12l3 3',
    biceps:'M6 20V10a4 4 0 0 1 8 0c0 2 1 3 2.5 3.5S19 16 19 20',
    triceps:'M18 20V10a4 4 0 0 0-8 0c0 2-1 3-2.5 3.5S5 16 5 20',
    forearms:'M4 5h6l10 14M4 5v14h7M14 19h6',
    quads:'M8 3h8M9 3v7l-2 11M15 3v7l2 11M9 10h6',
    hamstrings:'M8 21h8M9 21v-7l-2-11M15 21v-7l2-11M9 14h6',
    glutes:'M12 3v7M5 10a7 7 0 0 0 14 0M5 10c0 6 3 9 7 9s7-3 7-9',
    calves:'M9 3v6c0 5-2 7-2 12M15 3v6c0 5 2 7 2 12M9 9h6',
    core:'M5 4h14v16H5zM5 12h14M12 4v16',
    cardio:'M3 12h4l2-6 3 12 2-6h7'
  };

  const glyph = id => GLYPH[id] || GLYPH.core;

  const label = id => (byMuscle[id] || { n:id }).n;
  const colour = id => (byMuscle[id] || { c:'#7A7268' }).c;

  /* Two images per exercise, because they do different jobs:
     the cover is what you recognise it by in a grid, and the demo is what you
     watch mid-set to check you are not doing it wrong. */
  const urls = {};
  const key = (id, kind) => kind === 'demo' ? id + ':demo' : id;

  async function art(id, kind){
    const k = key(id, kind);
    if(urls[k] !== undefined) return urls[k];
    try {
      const blob = await Store.get('exercise-art', k);
      urls[k] = blob ? URL.createObjectURL(blob) : null;
    } catch(e){ urls[k] = null; }
    return urls[k];
  }
  async function setArt(id, file, kind){
    const k = key(id, kind);
    await Store.put('exercise-art', file, k);
    if(urls[k]) URL.revokeObjectURL(urls[k]);
    delete urls[k];
    return art(id, kind);
  }
  async function clearArt(id, kind){
    const k = key(id, kind);
    try { await Store.del('exercise-art', k); } catch(e){}
    if(urls[k]) URL.revokeObjectURL(urls[k]);
    delete urls[k];
  }
  /* Every cover in one pass, so a grid does not fire 45 separate reads. */
  async function artMap(ids, kind){
    const out = {};
    for(const id of ids) out[id] = await art(id, kind);
    return out;
  }
  /* What to show when someone asks to see the movement: the demo if there is
     one, otherwise the cover, otherwise nothing. */
  async function demoFor(id){
    return (await art(id, 'demo')) || (await art(id));
  }

  global.Exercises = { MUSCLES, EQUIPMENT, BUILT_IN, all, save, remove, restoreAll,
                       invalidate, coverage, label, colour, glyph, byMuscle,
                       art, setArt, clearArt, artMap, demoFor };
})(window);
