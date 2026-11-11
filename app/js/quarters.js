/* The quarter — the unit the research actually lives in.

   Twelve weeks of experiments draw on one body of reading. Doing that reading
   once per quarter rather than once per week is the whole reason a year of this
   is survivable: the weekly job becomes "which slice of what I already know does
   this week show", which is ten minutes, not a fresh dig.

   Above it: nothing. Below it: months carry the goal, weeks carry the experiment. */
(function(global){

  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  /* A source is what is true and who said it — distinct from the reference
     library, which is how to shoot something, and the swipe file, which is why
     someone else's video worked. */
  const KINDS = [
    { k:'book',    label:'Book' },
    { k:'article', label:'Article' },
    { k:'study',   label:'Study' },
    { k:'quote',   label:'Quote' },
    { k:'video',   label:'Video' },
    { k:'podcast', label:'Podcast' },
    /* the research library's own kinds: what you ran, what happened, what everyone knows */
    { k:'experiment', label:'Experiment' },
    { k:'history',    label:'History' },
    { k:'popculture', label:'Pop culture' }
  ];
  const kindOf = k => KINDS.find(x => x.k === k) || KINDS[0];

  /* The skeleton a week starts from. Editable per quarter, so the format can
     change with the topic without anyone editing code. */
  const DEFAULT_TEMPLATE = [
    { title:'Cold open',        setup:'phone',   note:'The best three seconds of the week' },
    { title:'The essay block',  setup:'talking', note:'History, mechanism, why it matters now' },
    { title:'Day one',          setup:'phone',   note:'Starting the experiment, honestly' },
    { title:'The wobble',       setup:'phone',   note:'Where it gets hard — the part people watch for' },
    { title:'What I found out', setup:'talking', note:'What the research says about what just happened' },
    { title:'The verdict',      setup:'talking', note:'Did it hold. What you would tell someone else' }
  ];

  /* What it takes to shoot a thing, which is what decides what can be batched.
     The setup, not the topic — two segments share a setup when they can be shot
     back to back without changing anything. */
  const SETUPS = [
    { k:'talking',    label:'Talking head', c:'#3B9EFF', d:'Sat down, camera on a tripod' },
    { k:'vlog',       label:'Vlog style',   c:'#FB6900', d:'Camera in hand, talking as you go' },
    { k:'phone',      label:'In the moment',c:'#E8A33D', d:'Phone, as it happens' },
    { k:'location',   label:'On location',  c:'#5BBE6A', d:'Somewhere you have to go' },
    { k:'transition', label:'Transition',   c:'#B07CE8', d:'The move between two things' },
    { k:'screen',     label:'Screen record',c:'#9AA0A6', d:'Showing something on a display' },
    { k:'broll',      label:'B-roll',       c:'#7A736A', d:'Cutaways, no talking' }
  ];
  const setupOf = k => SETUPS.find(x => x.k === k) || SETUPS[0];

  /* ---- quarters ---- */

  function blank(){
    return { id:null, name:'', topic:'', throughline:'', challenge:'',
             startMonth:monthKey(new Date()),
             template: DEFAULT_TEMPLATE.map(t => ({ ...t })), createdAt: Date.now() };
  }

  const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  /* the three months a quarter covers, from the one it starts in */
  /* ---------- the quarters of the project ----------

     A quarter is thirteen project weeks. Not a calendar quarter: nothing in
     this project resets on January 1st, and the months underneath are whole
     weeks, Sunday to Saturday. Deriving three calendar months from a YYYY-MM
     field put the quarter's dates and its months' dates permanently out of
     step — Q1 runs Sep 27 to Dec 26, which is thirteen weeks and not three
     calendar months.

     The calendar is not lost, it is just a label: a quarter knows its dates, so
     which calendar quarters it covers is worked out rather than stored. */

  const WEEKS_PER_QUARTER = 13;
  const DAY = 864e5;

  /* Q1 begins on the Sunday of project week 1. */
  async function projectStart(){
    try {
      const d = await Data.weekStartOf(1);
      const x = new Date(d); x.setHours(0, 0, 0, 0);
      return x.getTime();
    } catch(e){ return null; }
  }

  function boundsOf(start, n){
    const from = start + (n - 1) * WEEKS_PER_QUARTER * 7 * DAY;
    return { startDate:from, endDate:from + (WEEKS_PER_QUARTER * 7 - 1) * DAY };
  }

  /* "spans Q4 2026" — or two of them, when it straddles a calendar boundary */
  function calendarSpan(q){
    if(!q || !q.startDate || !q.endDate) return '';
    const label = t => {
      const d = new Date(t);
      return 'Q' + (Math.floor(d.getMonth() / 3) + 1) + ' ' + d.getFullYear();
    };
    const a = label(q.startDate), b = label(q.endDate);
    return a === b ? a : a + ' – ' + b;
  }

  const fmt = t => new Date(t).toLocaleDateString(undefined,
    { month:'short', day:'numeric' });
  const rangeLabel = q => (q && q.startDate && q.endDate)
    ? fmt(q.startDate) + ' – ' + fmt(q.endDate) : '';

  /* Fill in the quarters from week one up to the end of `throughYear`.
     Existing quarters are adopted by their dates rather than replaced, so
     nothing already written is touched. */
  async function ensureThrough(throughYear){
    const start = await projectStart();
    if(!start) return { made:0, adopted:0 };

    const have = await all();
    const end = new Date(throughYear, 11, 31).getTime();
    let made = 0, adopted = 0;

    for(let n = 1; n <= 80; n++){
      const b = boundsOf(start, n);
      if(b.startDate > end) break;

      /* One that already covers this window keeps everything written on it and
         gains the dates and number it was missing. A quarter made before this
         existed has neither — it is matched by the month it says it starts in,
         or it would be duplicated rather than adopted. */
      const firstKey = monthKey(new Date(b.startDate));
      const lastKey = monthKey(new Date(b.endDate));
      const existing = have.find(q => {
        if(q.startDate) return Math.abs(q.startDate - b.startDate) < 4 * DAY;
        if(q.n) return q.n === n;
        return q.startMonth === firstKey || q.startMonth === lastKey;
      });

      if(existing){
        if(existing.startDate !== b.startDate || existing.endDate !== b.endDate
           || existing.n !== n){
          await save({ ...existing, n, startDate:b.startDate, endDate:b.endDate });
          adopted++;
        }
        continue;
      }

      await save({ ...blank(), id:null, n,
        name: 'Q' + n,
        startDate: b.startDate, endDate: b.endDate,
        startMonth: monthKey(new Date(b.startDate)) });
      made++;
    }
    return { made, adopted };
  }

  /* The quarter a date falls in. */
  async function forDate(t){
    const when = t == null ? Date.now() : t;
    return (await all()).find(q => q.startDate && q.endDate
      && when >= q.startDate && when <= q.endDate) || null;
  }

  function months(q){
    if(!q || !q.startMonth) return [];
    const [y, m] = q.startMonth.split('-').map(Number);
    return [0, 1, 2].map(i => {
      const d = new Date(y, (m - 1) + i, 1);
      return monthKey(d);
    });
  }

  function covers(q, key){ return months(q).includes(key); }

  async function all(){
    try {
      const { values } = await Store.all('quarters');
      return values.sort((a, b) => String(b.startMonth).localeCompare(String(a.startMonth)));
    } catch(e){ return []; }
  }

  async function get(id){ return (await all()).find(q => q.id === id) || null; }

  /* whichever quarter contains a month — how a week finds its research */
  async function forMonth(key){
    return (await all()).find(q => covers(q, key)) || null;
  }
  async function current(){ return forMonth(monthKey(new Date())); }

  async function save(rec){
    const q = { ...blank(), ...rec };
    if(!q.id) q.id = uid('qt_');
    q.name = (q.name || '').trim() || 'Untitled quarter';
    await Store.put('quarters', q);
    if(global.Data && Data.invalidate) Data.invalidate('quarters');
    return q;
  }

  async function remove(id){
    /* the sources go with it — they only ever meant something here */
    for(const s of await sources(id)) await Store.del('sources', s.id);
    await Store.del('quarters', id);
    if(global.Data && Data.invalidate) Data.invalidate('quarters');
  }

  /* ---- the months inside a quarter ----

     A month's theme and goal were only reachable from the calendar, which meant
     the ladder — quarter topic, monthly goal, weekly experiment — was spread
     across three screens and nothing showed it as one thing. Same records, read
     and written from the quarter too. */
  const themeKey = key => 'month-theme:' + key;

  async function monthGoals(q){
    const out = [];
    for(const key of months(q)){
      let rec = null;
      try { rec = await Store.get('settings', themeKey(key)); } catch(e){ rec = null; }
      out.push({ key, theme:(rec && rec.theme) || '', goal:(rec && rec.goal) || '' });
    }
    return out;
  }

  async function saveMonthGoal(key, theme, goal){
    await Store.put('settings', { theme:(theme || '').trim(), goal:(goal || '').trim() },
                    themeKey(key));
  }

  /* ---- sources ---- */

  async function sources(quarterId){
    try {
      const { values } = await Store.all('sources');
      return values
        .filter(s => !quarterId || s.quarterId === quarterId)
        .filter(s => !s.vlogId)          /* a week's own reading is not the quarter's */
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    } catch(e){ return []; }
  }

  /* A week's own reading. The quarter carries what the whole twelve weeks draws
     on; a single episode has its own — one week is calorie tracking, the next is
     form over speed, and those cite different things. Keeping them on the week
     means you are not digging through a quarter's pile to find this week's. */
  async function sourcesForVlog(vlogId){
    if(!vlogId) return [];
    try {
      const { values } = await Store.all('sources');
      return values.filter(s => s.vlogId === vlogId)
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    } catch(e){ return []; }
  }

  /* What a sequence can cite: this week's first, then the quarter's pool. */
  async function citable(vlogId, quarterId){
    const [mine, pool] = await Promise.all([sourcesForVlog(vlogId), sources(quarterId)]);
    return { mine, pool };
  }

  async function saveSource(rec){
    const s = { kind:'book', author:'', work:'', year:'', url:'', passage:'', tags:[],
                addedAt: Date.now(), ...rec };
    if(!s.id) s.id = uid('src_');
    s.tags = (s.tags || []).map(t => String(t).trim()).filter(Boolean);
    await Store.put('sources', s);
    return s;
  }

  async function removeSource(id){ await Store.del('sources', id); }

  /* how it reads in a description, or under a quote on screen */
  function cite(s){
    if(!s) return '';
    const bits = [];
    if(s.author) bits.push(s.author);
    if(s.work) bits.push(`*${s.work}*`);
    if(s.year) bits.push(`(${s.year})`);
    return bits.join(', ');
  }

  global.Quarters = { ensureThrough, forDate, calendarSpan, rangeLabel, boundsOf,
    WEEKS_PER_QUARTER, KINDS, kindOf, SETUPS, setupOf, DEFAULT_TEMPLATE,
                      blank, all, get, save, remove, months, covers, forMonth, current,
                      monthKey, monthGoals, saveMonthGoal,
                      sources, sourcesForVlog, citable,
                      saveSource, removeSource, cite };
})(window);
