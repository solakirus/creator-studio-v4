/* Ready-made workouts.

   Starting points rather than prescriptions — pick one, it becomes a routine you
   own, and you edit it from there. Sets and reps are conservative on purpose;
   the weight comes from whatever you are currently lifting. */
(function(global){

  /* Every workout carries the type it belongs to — that is what the page filters
     on. Several workouts share a type on purpose: a push day with a barbell and
     a push day on the floor are the same intent, different equipment. */
  const TYPES = [
    /* ---- push ---- */
    { id:'push-barbell', n:'Barbell push', type:'Push', c:'#C4613A',
      d:'Chest, shoulders and triceps with a bar. The classic press day.',
      items:[['bench-press',4,8],['db-shoulder-press',3,10],['incline-press',3,10],
             ['lateral-raise',3,15],['tricep-pushdown',3,12],['close-grip-bench',3,8]] },
    { id:'push-dumbbell', n:'Dumbbell push', type:'Push', c:'#C4613A',
      d:'Same day, dumbbells only. Kinder on the shoulders, harder to stabilise.',
      items:[['db-press',4,10],['db-shoulder-press',4,10],['lateral-raise',3,15],
             ['rear-delt-fly',3,15],['skull-crusher',3,10],['dips',3,10]] },
    { id:'push-cal', n:'Calisthenics push', type:'Push', c:'#A8506E',
      d:'Pressing strength with nothing but the floor and a pair of bars.',
      items:[['push-up',4,15],['pike-push-up',3,10],['dips',3,10],
             ['archer-push-up',3,8],['diamond-push-up',3,12],['hollow-hold',3,30]] },

    /* ---- pull ---- */
    { id:'pull-barbell', n:'Barbell pull', type:'Pull', c:'#5B62A8',
      d:'Back and biceps. Everything that comes toward you.',
      items:[['barbell-row',4,8],['lat-pulldown',3,10],['seated-row',3,10],
             ['face-pull',3,15],['barbell-curl',3,10],['hammer-curl',3,12]] },
    { id:'pull-heavy', n:'Heavy pull', type:'Pull', c:'#5B62A8',
      d:'Built around the deadlift. Low reps, long rests, leave something in the tank.',
      items:[['deadlift',5,5],['barbell-row',4,6],['pull-up',4,6],
             ['face-pull',3,15],['farmers-carry',3,1]] },
    { id:'pull-cal', n:'Calisthenics pull', type:'Pull', c:'#5B62A8',
      d:'Everything hanging from a bar.',
      items:[['pull-up',4,8],['chin-up',3,8],['inverted-row',3,12],
             ['hanging-leg-raise',3,12],['l-sit',3,20],['farmers-carry',3,1]] },

    /* ---- legs ---- */
    { id:'legs-barbell', n:'Barbell legs', type:'Legs', c:'#3F8A88',
      d:'Quads, hamstrings, glutes and calves in one sitting.',
      items:[['back-squat',4,6],['romanian-dl',3,8],['leg-press',3,10],
             ['leg-curl',3,12],['walking-lunge',3,12],['calf-raise',4,15]] },
    { id:'legs-posterior', n:'Posterior chain', type:'Legs', c:'#4B8A57',
      d:'Hamstrings and glutes. The half most people skip.',
      items:[['romanian-dl',4,8],['hip-thrust',4,10],['leg-curl',3,12],
             ['nordic-curl',3,6],['bulgarian-split',3,10],['calf-raise',3,20]] },
    { id:'legs-cal', n:'Calisthenics legs', type:'Legs', c:'#4B8A57',
      d:'Lower body without a rack in sight.',
      items:[['pistol-squat',3,6],['jump-squat',3,15],['walking-lunge',3,16],
             ['nordic-curl',3,6],['calf-raise',4,20],['bear-crawl',3,30]] },

    /* ---- full body ---- */
    { id:'full-weights', n:'Full body', type:'Full body', c:'#8A6A2F',
      d:'One session that touches everything. Good when time is short.',
      items:[['back-squat',3,8],['bench-press',3,8],['barbell-row',3,8],
             ['overhead-press',3,10],['romanian-dl',3,10],['plank',3,45]] },
    { id:'full-upper', n:'Upper body', type:'Full body', c:'#B4533A',
      d:'Push and pull together, for training three days a week.',
      items:[['bench-press',4,8],['barbell-row',4,8],['overhead-press',3,8],
             ['lat-pulldown',3,10],['barbell-curl',3,12],['tricep-pushdown',3,12]] },
    { id:'full-cal', n:'Full body calisthenics', type:'Full body', c:'#A8506E',
      d:'A whole session on a bar and the floor.',
      items:[['pull-up',4,8],['push-up',4,15],['pistol-squat',3,6],
             ['dips',3,10],['hanging-leg-raise',3,12],['burpee',3,12]] },

    /* ---- calisthenics as its own discipline ---- */
    { id:'cal-skills', n:'Skill work', type:'Calisthenics', c:'#A8506E',
      d:'Holds and control rather than reps. Stop each set well short of failure.',
      items:[['l-sit',5,20],['hollow-hold',4,30],['archer-push-up',3,8],
             ['pistol-squat',3,6],['bear-crawl',3,30]] },
    { id:'cal-volume', n:'Volume day', type:'Calisthenics', c:'#A8506E',
      d:'High reps, short rests. Builds the work capacity everything else sits on.',
      items:[['push-up',5,20],['inverted-row',5,15],['jump-squat',4,20],
             ['mountain-climber',4,30],['flutter-kick',4,40]] },

    /* ---- boxing ---- */
    { id:'boxing-bag', n:'Bag work', type:'Boxing', c:'#E2564A',
      d:'Rounds on the bag, footwork, and the core work that holds it together.',
      items:[['jump-rope',3,3],['shadow-boxing',3,3],['heavy-bag',6,3],
             ['mountain-climber',3,30],['russian-twist',3,20],['plank',3,60]] },
    { id:'boxing-conditioning', n:'Fight conditioning', type:'Boxing', c:'#E2564A',
      d:'No bag needed. Built to make three-minute rounds feel shorter.',
      items:[['jump-rope',5,3],['shadow-boxing',5,3],['burpee',4,12],
             ['sit-up',4,25],['flutter-kick',4,40],['suicide-run',4,1]] },

    /* ---- military ---- */
    { id:'military-pt', n:'Military PT', type:'Military', c:'#6E8A3F',
      d:'Press-ups, sit-ups and distance. The test everyone remembers.',
      items:[['push-up',5,20],['sit-up',5,25],['flutter-kick',4,40],
             ['pull-up',4,8],['ruck-march',1,45],['burpee',3,15]] },
    { id:'military-ruck', n:'Ruck and carry', type:'Military', c:'#6E8A3F',
      d:'Load-bearing work. Slow, dull, and the thing that actually carries over.',
      items:[['ruck-march',1,60],['farmers-carry',5,1],['bear-crawl',4,30],
             ['sit-up',4,25],['push-up',4,20]] },

    /* ---- sport ---- */
    { id:'basketball', n:'Basketball athleticism', type:'Basketball', c:'#FB6900',
      d:'Vertical, lateral movement, and the engine to keep using them.',
      items:[['box-jump',4,8],['lateral-bound',3,12],['jump-squat',3,12],
             ['suicide-run',6,1],['calf-raise',3,20],['hanging-leg-raise',3,12]] },
    { id:'basketball-strength', n:'Court strength', type:'Basketball', c:'#FB6900',
      d:'The gym half. Single-leg strength and landing control.',
      items:[['bulgarian-split',4,8],['romanian-dl',3,8],['box-jump',4,6],
             ['lateral-bound',3,12],['nordic-curl',3,6],['plank',3,60]] },

    /* ---- conditioning ---- */
    { id:'hiit', n:'HIIT circuit', type:'Conditioning', c:'#E8A33D',
      d:'Short, unpleasant, over quickly. Run it as rounds rather than sets.',
      items:[['burpee',4,12],['mountain-climber',4,30],['jump-squat',4,15],
             ['push-up',4,15],['flutter-kick',4,30]] },
    { id:'run-support', n:'Runner support', type:'Conditioning', c:'#3B9EFF',
      d:'The strength work that keeps you running without getting injured.',
      items:[['romanian-dl',3,10],['bulgarian-split',3,10],['calf-raise',4,20],
             ['nordic-curl',3,6],['plank',3,45],['hip-thrust',3,12]] },
    { id:'engine', n:'Engine builder', type:'Conditioning', c:'#3B9EFF',
      d:'Longer intervals. Built for the last round rather than the first.',
      items:[['rower',5,5],['assault-bike',5,3],['jump-rope',4,3],['burpee',3,15]] },

    /* ---- core ---- */
    { id:'core-short', n:'Core', type:'Core', c:'#E8A33D',
      d:'Ten minutes that make everything else feel steadier.',
      items:[['plank',3,60],['hanging-leg-raise',3,12],['russian-twist',3,20],
             ['hollow-hold',3,30],['ab-wheel',3,10]] },
    { id:'core-hard', n:'Hard core', type:'Core', c:'#E8A33D',
      d:'Longer holds and slower reps. Quality over count.',
      items:[['l-sit',5,20],['ab-wheel',4,10],['hollow-hold',4,45],
             ['cable-crunch',4,15],['flutter-kick',4,40]] },

    /* ---- yoga and mobility ---- */
    { id:'yoga-flow', n:'Yoga flow', type:'Yoga', c:'#7B4FA8',
      d:'A short flow for hips, hamstrings and the upper back. Held, not counted.',
      items:[['sun-salutation',3,5],['downward-dog',3,60],['warrior-two',2,45],
             ['pigeon-pose',2,60],['couch-stretch',2,60],['thoracic-opener',2,45]] },
    { id:'yoga-morning', n:'Morning flow', type:'Yoga', c:'#7B4FA8',
      d:'Ten minutes to wake the spine up before anything else happens.',
      items:[['sun-salutation',5,5],['downward-dog',3,45],['thoracic-opener',3,45]] },
    { id:'mobility-reset', n:'Mobility reset', type:'Mobility', c:'#3F6FA0',
      d:'Twenty minutes to undo a week at a desk.',
      items:[['thoracic-opener',3,45],['couch-stretch',3,60],['downward-dog',3,45],
             ['pigeon-pose',2,60],['hollow-hold',3,30]] },
    { id:'mobility-legs', n:'Leg day recovery', type:'Mobility', c:'#3F6FA0',
      d:'For the day after squats, when walking downstairs is a decision.',
      items:[['couch-stretch',3,60],['pigeon-pose',3,60],['downward-dog',3,60],
             ['warrior-two',2,45]] }
  ];

  /* The filter chips, in the order they should appear. */
  const CATS = ['Push','Pull','Legs','Full body','Calisthenics','Core',
                'Conditioning','Boxing','Military','Basketball','Yoga','Mobility'];

  /* Fill in names and muscles from the library, dropping anything unrecognised
     so a renamed or hidden exercise cannot break a template. */
  async function expand(type){
    const lib = await Exercises.all();
    const items = type.items.map(([id, sets, reps]) => {
      const x = lib.find(e => e.id === id);
      if(!x) return null;
      const cardio = (x.pri || []).includes('cardio');
      return { id, name:x.name, sets, reps, rest: cardio ? 60 : 150,
               pri:x.pri || [], sec:x.sec || [] };
    }).filter(Boolean);
    return { ...type, items };
  }

  const byId = id => TYPES.find(t => t.id === id);

  global.WorkoutTypes = { TYPES, CATS, expand, byId };
})(window);
