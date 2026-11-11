/* Every importable and exportable dataset, described once.

   The point of the description is that an export is also a template: even with
   nothing in the app, exporting gives you the full column list and one worked
   example row, so a spreadsheet can be filled in and brought straight back.

   Example rows start with a # in the first column and are skipped on import,
   so a file can be round-tripped without the sample turning into real data.

   Pictures travel as URLs. A CSV cannot carry a binary, so an `*_url` column is
   stored as a link — the same way a linked reference works — and anything you
   would rather hold locally can be swapped for a file afterwards. */
(function(global){

  const SKIP = v => String(v || '').trim().startsWith('#');
  const list = v => String(v || '').split(/[;|]/).map(x => x.trim()).filter(Boolean);
  const joinList = a => (a || []).join('; ');
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

  /* A spreadsheet holds dates, not "day 412". These convert between the two, and
     fall back to leaving the cell blank rather than writing a wrong date. */
  async function isoOfDay(n){
    try {
      const ts = await Data.dayToDate(n);
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    } catch(e){ return ''; }
  }
  async function dayOfISO(str){
    const t = Date.parse(String(str).trim() + 'T12:00');
    if(isNaN(t)) return null;
    try { return await Data.dateToDay(t); } catch(e){ return null; }
  }


  /* a date column accepts YYYY-MM-DD, or a plain program day number */
  async function dayFrom(value, fallback){
    const raw = String(value || '').trim();
    if(!raw) return fallback;
    if(/^\d+$/.test(raw)) return +raw;
    const ts = new Date(raw + 'T09:00').getTime();
    if(isNaN(ts)) return fallback;
    try { return await Data.dateToDay(ts); } catch(e){ return fallback; }
  }

  const DATASETS = [

    /* ---------------------------------------------------------------- tasks */
    { id:'tasks', n:'Tasks', d:'A month of work in one sheet, dated and repeating.',
      cols:['title','date','time','minutes','cadence','priority','repeat_days','repeat_weeks',
            'steps','target','workout','kind'],
      example:['#Shoot the intro','2026-10-06','09:00','120','Shoot day','high',
               'Mon; Thu','4','Set up lights; Wide; Close','3 clips','','shoot'],
      help:'date is YYYY-MM-DD or a day number. repeat_days like "Mon; Thu" makes it recur for repeat_weeks. workout matches a saved workout by name. kind is blank, shoot, edit, publish or workout.',
      async count(){ return (await Data.tasks()).length; },
      async rows(){
        const tasks = await Data.tasks();
        const out = [];
        for(const t of tasks){
          let date = '';
          try { date = new Date(await Data.dayToDate(t.day)).toISOString().slice(0,10); } catch(e){}
          out.push([t.title, date, t.at || '', t.mins || '', t.cad || '', t.pri || '',
                    '', '', joinList((t.subs || []).map(s => s.t)),
                    (t.prog || '').split(' / ')[1] || '', '', t.kind || '']);
        }
        return out;
      },
      async load(rows){
        const today = await Data.currentDay();
        const routines = (global.Routines ? await Routines.all() : []);
        const DOW = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
        const existing = await Data.tasks();
        let made = 0;

        for(const r of rows){
          if(SKIP(r.title) || !r.title) continue;
          const day = await dayFrom(r.date, today);
          const rt = r.workout
            ? routines.find(x => x.name.toLowerCase() === String(r.workout).trim().toLowerCase())
            : null;

          const steps = list(r.steps).map(t => ({ t, done:false }));
          const base = {
            title: r.title.trim(),
            cad: r.cadence || 'One-off',
            pri: (r.priority || 'med').toLowerCase(),
            at: r.time || null,
            mins: num(r.minutes) || 0,
            prog: r.target ? `0 / ${r.target}` : '',
            subs: steps.length ? steps
              : rt ? rt.items.map(i => ({ t:`${i.name} · ${i.sets}×${i.reps}`, done:false })) : [],
            shots: [], view:'todo',
            kind: (r.kind || (rt ? 'workout' : '')).toLowerCase() || undefined,
            routineId: rt ? rt.id : undefined
          };

          const days = list(r.repeat_days)
            .map(x => DOW[x.slice(0,3).toLowerCase()])
            .filter(x => x !== undefined);

          if(!days.length){
            await Store.put('tasks', { ...base, id:U.taskId(), day });
            made++;
            continue;
          }

          const weeks = Math.max(1, num(r.repeat_weeks) || 4);
          const seriesKey = `im_${Date.now().toString(36)}_${made}`;
          const startTs = await Data.dayToDate(day);
          const start = new Date(startTs); start.setHours(0,0,0,0);
          for(let i = 0; i < weeks * 7; i++){
            const d = new Date(start); d.setDate(start.getDate() + i);
            if(!days.includes(d.getDay())) continue;
            await Store.put('tasks', { ...base, id:U.taskId(), day: day + i, series:seriesKey,
              subs: base.subs.map(x => ({ ...x, done:false })) });
            made++;
          }
        }
        Data.invalidate('tasks');
        return made;
      }
    },

    /* ---------------------------------------------------------------- meals */
    { id:'meals', n:'Saved meals', d:'Recipes with ingredients, steps and macros.',
      cols:['title','category','slot','kcal','protein','carbs','fat','ingredients','steps','tags','image_url','link'],
      example:['#Chicken and rice bowl','Entrees','lunch','620','48','62','18',
               '300 g chicken breast; 1 cup rice; 1 tbsp olive oil',
               'Cook rice; Grill chicken; Combine','high protein; meal prep','',
               'https://www.instagram.com/p/abc123/'],
      help:'ingredients as "300 g chicken breast; 1 cup rice" — quantity, unit, then the name. slot is breakfast, lunch, dinner or snacks.',
      async count(){ return (await Nutrition.meals()).length; },
      async rows(){
        return (await Nutrition.meals()).map(m => [
          m.title, m.category || '', m.slot || '', m.kcal || '', m.protein || '',
          m.carbs || '', m.fat || '',
          joinList((m.ingredients || []).map(i => `${i.q || ''}${i.u ? ' ' + i.u : ''} ${i.n}`.trim())),
          joinList(m.steps), joinList(m.tags), m.imageUrl || '', m.url || ''
        ]);
      },
      async load(rows){
        let n = 0;
        for(const r of rows){
          if(SKIP(r.title) || !r.title) continue;
          await Nutrition.save('meals', {
            title:r.title.trim(), category:r.category || 'Entrees', slot:(r.slot || '').toLowerCase(),
            kcal:num(r.kcal), protein:num(r.protein), carbs:num(r.carbs), fat:num(r.fat),
            ingredients:list(r.ingredients).map(parseIngredient),
            steps:list(r.steps), tags:list(r.tags),
            imageUrl: r.image_url || '',
            /* the video it came from, so a saved recipe keeps its source */
            url: r.link || ''
          }, 'm');
          n++;
        }
        return n;
      }
    },

    /* --------------------------------------------------------------- pantry */
    { id:'pantry', n:'Pantry', d:'What is in the cupboards, by the container.',
      cols:['item','qty','unit','group'],
      example:['#Jasmine rice','2','bag','Grains & bread'],
      help:'unit is what the shelf holds — bag, box, can, jar, gallon, pcs. Leave group blank and it is guessed.',
      async count(){ return (await Nutrition.pantry()).length; },
      async rows(){
        return (await Nutrition.pantry()).map(p => [
          p.name, p.qty || '', p.unit || '', FoodGroups.label(FoodGroups.of(p))
        ]);
      },
      async load(rows){
        let n = 0;
        for(const r of rows){
          if(SKIP(r.item) || !r.item) continue;
          const raw = String(r.group || '').trim().toLowerCase();
          const hit = FoodGroups.GROUPS.find(g => g.id === raw || g.n.toLowerCase() === raw);
          await Nutrition.save('pantry', {
            name:r.item.trim(), qty:num(r.qty),
            unit:Shopping.normaliseStock(r.unit || ''),
            group: hit ? hit.id : FoodGroups.guess(r.item)
          }, 'p');
          n++;
        }
        return n;
      }
    },

    /* ------------------------------------------------------------- workouts */
    { id:'routines', n:'Workouts', d:'Saved routines you can run again.',
      cols:['name','type','note','exercises'],
      example:['#Barbell push','Push','Heavy day — long rests',
               'Bench press x4x8; Incline press x3x10; Lateral raise x3x15'],
      help:'exercises as "Name x SETS x REPS", separated by semicolons. Names are matched against the exercise library.',
      async count(){ return (await Routines.all()).length; },
      async rows(){
        return (await Routines.all()).map(r => [
          r.name, r.type || '', r.note || '',
          joinList(r.items.map(i => `${i.name} x${i.sets}x${i.reps}`))
        ]);
      },
      async load(rows){
        const lib = await Exercises.all();
        let n = 0;
        for(const r of rows){
          if(SKIP(r.name) || !r.name) continue;
          const items = list(r.exercises).map(spec => {
            const m = spec.match(/^(.*?)\s*x\s*(\d+)\s*x\s*(\d+)$/i);
            const name = (m ? m[1] : spec).trim();
            const x = lib.find(e => e.name.toLowerCase() === name.toLowerCase());
            if(!x) return null;
            const cardio = (x.pri || []).includes('cardio');
            return { id:x.id, name:x.name, sets:m ? +m[2] : 3, reps:m ? +m[3] : 8,
                     rest: cardio ? 60 : 150, pri:x.pri || [], sec:x.sec || [] };
          }).filter(Boolean);
          if(!items.length) continue;
          await Routines.save({ name:r.name.trim(), type:r.type || '', note:r.note || '', items });
          n++;
        }
        return n;
      }
    },

    /* ------------------------------------------------------------ exercises */
    { id:'exercises', n:'Exercises', d:'The lift library, with artwork links.',
      cols:['name','primary','secondary','equipment','default_kg','default_reps','cover_url','demo_url'],
      example:['#Incline dumbbell press','chest','shoulders; triceps','dumbbell','22','10','',''],
      help:'primary and secondary are muscle names, semicolon separated. demo_url can be a GIF — it plays over a workout.',
      async count(){ return (await Exercises.all()).length; },
      async rows(){
        return (await Exercises.all()).map(x => [
          x.name, joinList((x.pri || []).map(Exercises.label)),
          joinList((x.sec || []).map(Exercises.label)),
          x.eq || '', x.kg || 0, x.reps || 8, x.coverUrl || '', x.demoUrl || ''
        ]);
      },
      async load(rows){
        const ids = m => {
          const want = String(m || '').trim().toLowerCase();
          const hit = Exercises.MUSCLES.find(x => x.id === want || x.n.toLowerCase() === want);
          return hit ? hit.id : null;
        };
        let n = 0;
        for(const r of rows){
          if(SKIP(r.name) || !r.name) continue;
          const pri = list(r.primary).map(ids).filter(Boolean);
          if(!pri.length) continue;
          const saved = await Exercises.save({
            name:r.name.trim(), pri, sec:list(r.secondary).map(ids).filter(Boolean),
            eq:(r.equipment || 'other').toLowerCase(),
            kg:num(r.default_kg), reps:num(r.default_reps) || 8
          });
          /* artwork links are kept as urls so a sheet can carry them */
          if(r.cover_url || r.demo_url){
            await Store.put('exercises', { ...saved,
              coverUrl:r.cover_url || '', demoUrl:r.demo_url || '' });
            Exercises.invalidate();
          }
          n++;
        }
        return n;
      }
    },

    /* ------------------------------------------------------ vlog sequences */
    /* One row per sequence, so a week can be planned in a spreadsheet and brought
       back. The episode and day are named rather than referenced by id — you are
       going to type these, and an id is not something anyone types. */
    { id:'sequences', n:'Vlog sequences', d:'A week of filming, one row per sequence.',
      cols:['episode','day','sequence','setup','date','line','shots','purpose'],
      /* the leading # is what marks a row as a sample, so the example you export
         does not import itself back as a real sequence */
      example:['#Week 12','Sunday','Roller skating intro','phone','2026-10-04',
               'This is the part nobody films','Wide of the street; Skates lacing up','Cold open'],
      help:'shots separated by semicolons. setup is talking, phone, location, screen or broll. ' +
           'A matching episode and day are updated; anything new is created.',
      async count(){
        const { values } = await Store.all('vlogs');
        return values.reduce((n, v) => n + (v.acts || [])
          .reduce((m, a) => m + (a.beats || []).length, 0), 0);
      },
      async rows(){
        const { values } = await Store.all('vlogs');
        const out = [];
        for(const v of values.sort((a, b) => (a.week || 0) - (b.week || 0))){
          for(const a of (v.acts || [])){
            for(const b of (a.beats || [])){
              out.push([
                v.title || (v.week ? `Week ${v.week}` : 'Untitled'),
                a.title || '',
                b.title || '',
                b.setup || 'talking',
                b.day ? await isoOfDay(b.day) : '',
                b.script || '',
                (b.shots || []).map(x => x.text || x.name || String(x)).join('; '),
                b.purpose || ''
              ]);
            }
          }
        }
        return out;
      },
      async load(rows){
        const uid = p2 => p2 + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
        const { values } = await Store.all('vlogs');
        const byTitle = {};
        values.forEach(v => byTitle[(v.title || '').toLowerCase()] = v);

        let n = 0;
        for(const r of rows){
          if(SKIP(r.episode) || !r.sequence) continue;

          const key = String(r.episode || '').trim().toLowerCase();
          let v = byTitle[key];
          if(!v){
            v = { id:uid('vl_'), title:String(r.episode).trim(), acts:[], createdAt:Date.now() };
            byTitle[key] = v;
          }

          const dayName = String(r.day || 'Unsorted').trim();
          let act = (v.acts || []).find(a => (a.title || '').toLowerCase() === dayName.toLowerCase());
          if(!act){ act = { id:uid('a'), title:dayName, day:null, beats:[] }; (v.acts = v.acts || []).push(act); }

          const shots = String(r.shots || '').split(';').map(x => x.trim()).filter(Boolean)
            .map(text => ({ id:uid('s'), text, done:false }));
          const day = r.date ? await dayOfISO(r.date) : null;

          /* the same sequence twice is an edit, not a second one */
          const existing = (act.beats || []).find(b =>
            (b.title || '').toLowerCase() === String(r.sequence).trim().toLowerCase());

          if(existing){
            existing.setup = r.setup || existing.setup || 'talking';
            existing.script = r.line || existing.script || '';
            existing.purpose = r.purpose || existing.purpose || '';
            if(shots.length) existing.shots = shots;
            if(day) existing.day = day;
          } else {
            act.beats.push({ id:uid('b'), title:String(r.sequence).trim(),
              setup: r.setup || 'talking', script: r.line || '', purpose: r.purpose || '',
              sourceId:null, shots, day: day ?? act.day ?? null, at:null,
              done:false, clipId:null });
          }
          n++;
        }

        for(const v of Object.values(byTitle)) await Store.put('vlogs', v);
        if(global.Data && Data.invalidate) Data.invalidate('vlogs');
        return n;
      }
    },

    /* ----------------------------------------------------------------- runs */
    { id:'runs', n:'Runs', d:'Distance, time and pace.',
      cols:['distance','unit','time','date','note'],
      example:['#3.1','mi','28:30','2026-10-04','easy, humid'],
      help:'time as mm:ss or h:mm:ss. unit is mi or km.',
      async count(){ const { values } = await Store.all('runs'); return values.length; },
      async rows(){
        const { values } = await Store.all('runs');
        return values.sort((a,b) => b.at - a.at).map(r => {
          const s = r.sec || 0;
          const t = s >= 3600
            ? `${Math.floor(s/3600)}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
            : `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
          return [(r.km * 0.621371).toFixed(2), 'mi', t,
                  new Date(r.at).toISOString().slice(0,10), r.note || ''];
        });
      },
      async load(rows){
        let n = 0;
        for(const r of rows){
          if(SKIP(r.distance) || !r.distance) continue;
          const d = num(r.distance);
          if(!d) continue;
          const km = String(r.unit || 'mi').toLowerCase().startsWith('k') ? d : d / 0.621371;
          const parts = String(r.time || '').split(':').map(Number).filter(x => !isNaN(x));
          const sec = parts.length === 3 ? parts[0]*3600 + parts[1]*60 + parts[2]
                    : parts.length === 2 ? parts[0]*60 + parts[1] : parts[0] || 0;
          const when = r.date ? new Date(r.date + 'T09:00').getTime() : Date.now() - n * 86400000;
          await Store.put('runs', { id:'rn_' + Date.now().toString(36) + n,
            km, sec, note:r.note || '', at: isNaN(when) ? Date.now() : when });
          n++;
        }
        return n;
      }
    },

    /* ---------------------------------------------------------------- clips */
    { id:'clips', n:'Clips', d:'Pieces of content, with the plan attached.',
      cols:['title','channel','stage','platform','series','publish_date','hook','shots',
            'beats','cta','caption','tags'],
      example:['#Datacenter tour','Fix & Invest','planned','youtube','','2026-10-09',
               'You have never seen inside one of these',
               'Walk in, wide; The cold aisle; Rack close-up',
               'Walk in; The cold aisle; The thing nobody expects','Follow for part two',
               'Inside a live datacenter','#datacenter; #homelab'],
      help:'stage is idea, planned, shot, editing or published. shots and beats are ' +
           'semicolon separated — shots are what you film, beats are how it is cut.',
      async count(){ return (await Data.clips()).length; },
      async rows(){
        return (await Data.clips()).map(c => [
          c.title, c.channel || '', c.stage || 'idea', c.plat || '', c.seriesName || '',
          c.scheduledAt ? new Date(c.scheduledAt).toISOString().slice(0,10) : '',
          c.hook || (c.plan && c.plan.hook) || '',
          joinList((c.shots || []).map(x => x.text || x.name || String(x))),
          joinList((c.plan && c.plan.beats) || []),
          (c.plan && c.plan.cta) || '', (c.plan && c.plan.caption) || '',
          (c.plan && c.plan.tags) || ''
        ]);
      },
      async load(rows){
        let n = 0;
        for(const r of rows){
          if(SKIP(r.title) || !r.title) continue;
          const when = r.publish_date ? new Date(r.publish_date + 'T18:00').getTime() : null;
          /* an unknown stage becomes an idea rather than breaking the row */
          const stage = Lifecycle.ORDER.includes(String(r.stage || '').toLowerCase())
            ? String(r.stage).toLowerCase() : 'idea';

          await Data.saveClip({
            title:r.title.trim(),
            channel:(r.channel || '').trim(),
            plat:(r.platform || 'youtube').toLowerCase(),
            stage, dur:'0:00',
            scheduledAt: when && !isNaN(when) ? when : null,
            shots: list(r.shots).map(text => ({ id:'s' + Math.random().toString(36).slice(2,7),
                                                text, done:false })),
            hook: r.hook || '',
            plan:{ hook:r.hook || '', beats:list(r.beats), cta:r.cta || '',
                   caption:r.caption || '', tags:r.tags || '',
                   titles:['','',''], length:'short' }
          });
          n++;
        }
        return n;
      }
    },

    /* -------------------------------------------------------------- reading */
    { id:'courses', n:'Reading', d:'Your own courses, chapters and takeaways.',
      cols:['course','course_note','chapter','minutes','body','try_title','try_when','try_body','takeaways','cover_url'],
      example:['#Deep Work','Cal Newport, condensed','Chapter one: attention residue','6',
               'Switching leaves a residue…|A fragmented two hours…',
               'One unbroken block','This week','Protect a single hour with the phone elsewhere.',
               'Switching has a cost; Protect blocks not hours',''],
      help:'One row per chapter; repeat the course name across its rows. Separate body paragraphs with a pipe |.',
      async count(){
        try { const { values } = await Store.all('courses'); return values.length; }
        catch(e){ return 0; }
      },
      async rows(){
        try {
          const { values } = await Store.all('courses');
          const out = [];
          values.forEach(c => (c.lessons || []).forEach(l => out.push([
            c.n, c.d || '', l.t, l.min || 5,
            (l.body || []).filter(b => b[0] === 'p').map(b => b[1]).join('|'),
            (l.body || []).filter(b => b[0] === 'try').map(b => b[1])[0] || '',
            (l.body || []).filter(b => b[0] === 'try').map(b => b[2])[0] || '',
            (l.body || []).filter(b => b[0] === 'try').map(b => b[3])[0] || '',
            joinList(l.keys), c.coverUrl || ''
          ])));
          return out;
        } catch(e){ return []; }
      },
      async load(rows){
        const byCourse = {};
        for(const r of rows){
          if(SKIP(r.course) || !r.course || !r.chapter) continue;
          const key = r.course.trim();
          if(!byCourse[key]) byCourse[key] = {
            id:'uc_' + key.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
            n:key, d:r.course_note || '', c:'#3F6FA0',
            glyph:'M4 5h16v14H4zM8 5v14', coverUrl:r.cover_url || '', lessons:[]
          };

          const body = String(r.body || '').split('|').map(x => x.trim()).filter(Boolean)
            .map(p => ['p', p]);
          if(r.try_title) body.push(['try', r.try_title, r.try_when || '', r.try_body || '']);

          byCourse[key].lessons.push({
            t:r.chapter.trim(), min:num(r.minutes) || 5,
            body, keys:list(r.takeaways)
          });
        }
        let n = 0;
        for(const c of Object.values(byCourse)){
          await Store.put('courses', c);
          n += c.lessons.length;
        }
        if(global.Academy) Academy.invalidate();
        return n;
      }
    },

    /* ------------------------------------------------------------- episodes */
    /* ---- planning a run of months up front ---- */

    { id:'months', n:'Month themes', d:'What each month is about, and the goal under it.',
      cols:['month','theme','goal'],
      example:['#2026-10','Build the shop','Bench rebuild published by the 31st'],
      help:'month is YYYY-MM. The theme is what the month is about; the goal is the concrete thing each week is a step toward.',
      async count(){
        try {
          const map = await Store.allMap('settings');
          return Object.keys(map).filter(k => k.startsWith('month-theme:')).length;
        } catch(e){ return 0; }
      },
      async rows(){
        try {
          const map = await Store.allMap('settings');
          return Object.entries(map)
            .filter(([k]) => k.startsWith('month-theme:'))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k.slice('month-theme:'.length), (v && v.theme) || '', (v && v.goal) || '']);
        } catch(e){ return []; }
      },
      async load(rows){
        let n = 0;
        for(const r of rows){
          const key = String(r.month || '').trim();
          if(!/^\d{4}-\d{2}$/.test(key)) continue;
          await Store.put('settings', { theme:r.theme || '', goal:r.goal || '' }, 'month-theme:' + key);
          n++;
        }
        return n;
      }
    },

    { id:'series', n:'Series', d:'Short-form runs, each belonging to one channel.',
      cols:['title','channel','days','total','state','purpose'],
      example:['#Garage to gym','Fix & Invest','Mon; Wed; Fri','8','live','Show the whole build start to finish'],
      help:'channel is which of yours it runs on. days are which weekday one lands on — ' +
           'Mon; Wed; Fri — semicolon separated. total is how many you are planning.',
      async count(){ try { return (await Data.series()).length; } catch(e){ return 0; } },
      async rows(){
        try {
          return (await Data.series()).map(s2 => [s2.title || '', s2.channel || '',
            (s2.days && s2.days.length) ? s2.days.map(n => U.DOW_FULL[n].slice(0,3)).join('; ')
              : (s2.cadence || ''),
            s2.total || '', s2.state || '', s2.purpose || '']);
        } catch(e){ return []; }
      },
      async load(rows){
        let n = 0;
        for(const r of rows){
          if(!r.title) continue;
          await Store.put('series', {
            id:'sr_' + Date.now().toString(36) + n,
            title:r.title, channel:(r.channel || '').trim(),
            /* words in the sheet, day numbers in the app */
            days: String(r.days || '').split(';').map(x => x.trim()).filter(Boolean)
              .map(x => Object.keys(U.DOW_FULL).find(k =>
                U.DOW_FULL[k].toLowerCase().startsWith(x.toLowerCase().slice(0,3))))
              .filter(x => x != null).map(Number),
            cadence:r.cadence || 'Weekly', total:Math.max(1, +r.total || 8),
            state:r.state || 'live', purpose:r.purpose || '', createdAt: Date.now() - n
          });
          n++;
        }
        if(global.Data && Data.invalidate) Data.invalidate('series');
        return n;
      }
    },



    /* ----------------------------------------------------------- references */
    /* --------------------------------------------------------- swipe file */
    /* Why someone else's video worked, and what you would take from it. A link
       and a hook, not a shot — the reference library is the one for shots. */
    { id:'swipes', n:'Swipe file', d:'Videos you saved, and what you would take from them.',
      cols:['title','url','source','intent','hook','why','transferable','my_angle',
            'channels','targets'],
      example:['#The cold open that stops you','https://www.tiktok.com/@x/video/1','TikTok',
               'Education','No setup — straight into the mess',
               'It answers a question you did not know you had',
               'Open on the worst state of the thing','Use it for the pool screen job',
               'Fix & Invest','shorts'],
      help:'intent is what it is doing — Education, Story, Proof, Hook study. ' +
           'channels and targets are semicolon separated.',
      async count(){
        try { const { values } = await Store.all('swipes'); return values.length; }
        catch(e){ return 0; }
      },
      async rows(){
        const { values } = await Store.all('swipes');
        return values
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .map(s2 => [
            s2.title || '', s2.url || '', s2.source || '', s2.intent || '',
            s2.hook || '', s2.why || '', s2.transferable || '', s2.myAngle || '',
            joinList(s2.channels || []), joinList(s2.targets || [])
          ]);
      },
      async load(rows){
        const uid = p2 => p2 + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
        let n = 0;
        for(const r of rows){
          if(SKIP(r.title) || !(r.title || r.url)) continue;
          await Store.put('swipes', {
            id: uid('sw_'),
            title: (r.title || r.url).trim(),
            url: (r.url || '').trim(),
            source: (r.source || '').trim(),
            intent: (r.intent || 'Education').trim(),
            hook: r.hook || '',
            why: r.why || '',
            transferable: r.transferable || '',
            myAngle: r.my_angle || '',
            channels: list(r.channels),
            targets: list(r.targets),
            beats: [],
            createdAt: Date.now() - n
          });
          n++;
        }
        return n;
      }
    },

    { id:'refs', n:'Reference library', d:'Shots you collected, as links.',
      cols:['category','framing','movement','note','image_url'],
      example:['#In-car','Close','Static','dash reflection catches the light',
               'https://example.com/shot.jpg'],
      help:'image_url can be a still, a GIF or an mp4 — it is linked rather than downloaded.',
      async count(){ return (await Refs.all()).length; },
      async rows(){
        const all = await Refs.all();
        return all.map(r => [r.scenario || '', r.framing || '', r.movement || '',
                             r.note || '', r.url || '']);
      },
      async load(rows){
        let n = 0;
        for(const r of rows){
          if(SKIP(r.category) || !r.image_url) continue;
          const id = 'rf_' + Date.now().toString(36) + n;
          await Store.put('refs', {
            id, scenario:(r.category || 'new').toLowerCase(),
            framing:r.framing || '', movement:r.movement || '', note:r.note || '',
            kind: Refs.kindOfUrl(r.image_url), url:r.image_url,
            poster:'', createdAt: Date.now() + n
          });
          n++;
        }
        return n;
      }
    }
  ];

  /* "300 g chicken breast" -> { q, u, n } with the unit normalised */
  function parseIngredient(line){
    const m = String(line).match(/^([\d.\/]+)\s*(fl\s?oz|[a-zA-Z]+)?\.?\s+(.*)$/i);
    if(!m) return { n:String(line).trim(), q:null, u:'' };
    const q = m[1].includes('/') ? m[1].split('/').reduce((a,b) => a / b) : parseFloat(m[1]);
    const raw = (m[2] || '').replace(/\.$/, '');
    const unit = raw ? Shopping.normalise(raw) : '';
    return unit || !raw ? { q, u:unit, n:m[3].trim() } : { q, u:'', n:`${raw} ${m[3]}`.trim() };
  }

  const byId = id => DATASETS.find(d => d.id === id);

  /* Export: always the header row, always an example, then whatever exists. */
  async function toCSV(id){
    const d = byId(id);
    if(!d) return '';
    let rows = [];
    try { rows = await d.rows(); } catch(e){ console.warn('Export failed for ' + id, e); }
    const esc = v => {
      const s = String(v === undefined || v === null ? '' : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    return [d.cols, d.example, ...rows].map(r => r.map(esc).join(',')).join('\n');
  }

  global.Datasets = { DATASETS, byId, toCSV, parseIngredient };
})(window);
