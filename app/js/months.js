/* Months — the challenge month, made of whole weeks.

   A challenge month is not a calendar month. It runs from a Sunday to a
   Saturday, and a week belongs to the month its Saturday falls in. Each month
   has one big challenge, its stakes, and a verdict episode released the
   Thursday after it ends.

   Episodes stay in the `vlogs` store and keep their `week` number as the one
   source of truth for when they film; everything with a date is worked out from
   it, so a date can never disagree with the week it belongs to.

   Dates here are plain "YYYY-MM-DD" strings: they read cleanly in a backup and
   cannot shift with a time zone. */
(function(global){

  const uid = () => 'mo_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  /* ---- dates ---- */

  const pad = n => String(n).padStart(2, '0');
  /* a timestamp or a Date to "YYYY-MM-DD", read in local time */
  function iso(t){
    if(t === null || t === undefined || t === '') return null;
    if(typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const d = new Date(t);
    if(isNaN(d)) return null;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  /* "YYYY-MM-DD" to local midnight, as a timestamp */
  function ts(s){
    if(!s) return null;
    if(typeof s === 'number') return s;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
    if(!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  }
  function addDays(s, n){
    const d = new Date(ts(s));
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  const weekday = s => new Date(ts(s)).getDay();          /* 0 = Sunday */

  /* any date to the Sunday that starts its week, or the Saturday that ends it */
  const snapSunday   = s => addDays(iso(s), -weekday(iso(s)));
  const snapSaturday = s => addDays(iso(s), 6 - weekday(iso(s)));
  /* episodes and verdicts release the Thursday after the week they film */
  const thursdayAfter = sat => addDays(snapSaturday(sat), 5);

  function label(s, opts){
    const t = ts(s);
    return t ? new Date(t).toLocaleDateString(undefined, opts || { month:'short', day:'numeric' }) : '';
  }

  /* ---- months ---- */

  function blank(){
    return { id:null, name:'', quarter:'', quarterTheme:'', quarterId:null, challenge:'',
             startDate:null, endDate:null, verdictReleaseDate:null,
             reward:'', penaltyOptions:[], result:null, notes:'', createdAt:null,
             habits:null };   /* the habits tracked this month; null = all of them */
  }

  /* Whatever was typed, stored the one way: the start on a Sunday, the end on a
     Saturday after it, and the verdict the Thursday after that unless you set
     your own. */
  function normalise(rec){
    const m = { ...blank(), ...rec };
    if(m.startDate) m.startDate = snapSunday(m.startDate);
    if(m.endDate)   m.endDate   = snapSaturday(m.endDate);
    if(m.startDate && m.endDate && ts(m.endDate) < ts(m.startDate))
      m.endDate = addDays(m.startDate, 6);
    if(m.endDate && !m.verdictReleaseDate) m.verdictReleaseDate = thursdayAfter(m.endDate);
    m.penaltyOptions = (Array.isArray(m.penaltyOptions) ? m.penaltyOptions : [])
      .map(x => String(x || '').trim()).filter(Boolean);
    m.result = (m.result === 'W' || m.result === 'L') ? m.result : null;
    if(Array.isArray(m.habits)) m.habits = m.habits.filter(h => ['vlog','training','german'].includes(h));
    else m.habits = null;
    m.name = String(m.name || '').trim();
    return m;
  }

  let cache = null;
  async function all(){
    if(cache) return cache;
    let values = [];
    try { values = (await Store.all('months')).values; } catch(e){ values = []; }
    cache = values.sort((a,b) => (ts(a.startDate) || 0) - (ts(b.startDate) || 0));
    return cache;
  }
  const invalidate = () => { cache = null; };
  async function get(id){ return id ? (await all()).find(m => m.id === id) || null : null; }

  async function save(rec){
    const m = normalise(rec);
    if(!m.id){ m.id = uid(); m.createdAt = Date.now(); }
    await Store.put('months', m);
    invalidate();
    return m;
  }

  /* Deleting a month never deletes an episode: the ones tagged to it just lose
     the tag, and keep everything else. */
  async function remove(id){
    const eps = await episodes();
    for(const v of eps.filter(x => x.monthId === id)){
      const rec = await Store.get('vlogs', v.id);
      if(rec){ rec.monthId = null; await Store.put('vlogs', rec); }
    }
    await Store.del('months', id);
    invalidate();
  }

  /* The month whose weeks contain a date — for suggesting a tag. */
  async function forDate(s){
    const t = ts(iso(s));
    if(t === null) return null;
    return (await all()).find(m => m.startDate && m.endDate
      && t >= ts(m.startDate) && t <= ts(m.endDate)) || null;
  }

  /* One slot per Sunday–Saturday week, worked out from the dates alone, with
     the project week number each one is. */
  async function weeks(m){
    if(!m || !m.startDate || !m.endDate) return [];
    const out = [];
    let sun = m.startDate, i = 1;
    while(ts(sun) <= ts(m.endDate) && i <= 8){
      const sat = addDays(sun, 6);
      let week = null;
      try { week = await Data.weekNumber(ts(sun)); } catch(e){}
      out.push({ index:i, sunday:sun, saturday:sat, release:thursdayAfter(sat), week,
                 last: ts(sat) >= ts(m.endDate) });
      sun = addDays(sun, 7); i++;
    }
    return out;
  }

  /* ---- episodes, read with their new fields ---- */

  /* the edit order every new episode starts from */
  const DEFAULT_SEGMENTS = [
    ['cold-open',         'Cold open'],
    ['topic-intro',       'Topic intro'],
    ['day-chapters',      'Day chapters'],
    ['explainer-history', 'Explainer: History'],
    ['explainer-wisdom',  'Explainer: Wisdom'],
    ['explainer-science', 'Explainer: Science'],
    ['back-to-me',        'Back to me'],
    ['verdict',           'Verdict'],
    ['stat-card',         'Stat card'],
    ['next-week',         'Next week']
  ];
  const defaultSegments = () => DEFAULT_SEGMENTS.map(([key, label]) => ({ key, label, status:'todo' }));
  const SEG_NEXT = { todo:'shot', shot:'done', done:'todo' };

  /* An episode with every new field present. Nothing is written back — an
     episode made before months existed reads exactly as it was stored, with
     the new fields empty. */
  function withExtras(v){
    if(!v) return v;
    return {
      ...v,
      monthId:         v.monthId || null,
      skill:           v.skill || '',
      weeklyChallenge: v.weeklyChallenge || '',
      passLine:        v.passLine || '',
      releaseDate:     v.releaseDate || null,
      isVerdict:       !!v.isVerdict,
      result:          (v.result === 'W' || v.result === 'L') ? v.result : null,
      segments:        Array.isArray(v.segments) ? v.segments : [],
      scriptBeats:     { intro:'', history:'', wisdom:'', science:'', backToMe:'', ...(v.scriptBeats || {}) }
    };
  }

  /* The dates an episode films and releases, from its week. The release is the
     Thursday after, unless one was set by hand. */
  async function datesOf(v){
    if(!v || v.week === null || v.week === undefined || v.week === '') return null;
    const from = iso(await Data.weekStartOf(+v.week));
    const to = addDays(from, 6);
    return { filmStart:from, filmEnd:to, releaseDate: v.releaseDate || thursdayAfter(to) };
  }

  async function episodes(){
    try { return (await Store.all('vlogs')).values; } catch(e){ return []; }
  }

  /* The episodes tagged to a month, and its weekly win/loss record. */
  async function linked(m){
    if(!m) return [];
    return (await episodes()).filter(v => v.monthId === m.id).map(withExtras);
  }
  function record(eps){
    return { w: eps.filter(v => v.result === 'W').length,
             l: eps.filter(v => v.result === 'L').length };
  }

  /* ---- linking episodes to week slots ---- */

  const hasWeek = v => v && v.week !== null && v.week !== undefined && v.week !== '';

  /* The episode already filling a month's week, if any — one per week. */
  async function slotHolder(m, week, exceptId){
    if(!m || week === null || week === undefined) return null;
    return (await episodes()).find(v => v.monthId === m.id && v.id !== exceptId
      && hasWeek(v) && +v.week === +week) || null;
  }

  /* The weekly episode shape the Episodes tab makes: a day per act, each with
     three sequences to rename. Kept in step with vlog.js's "Week, day by day". */
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const vid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  function weeklyActs(){
    return DAYS.map((d, i) => ({
      id: vid('a'), title:d, day:null, open:i === 0,
      beats:[1,2,3].map(n => ({ id:vid('b'), title:`Sequence ${n}`, purpose:'', setup:'talking',
        script:'', sourceId:null, shots:[], day:null, at:null, done:false, clipId:null }))
    }));
  }

  /* Create the episode for an empty week slot: tagged, dated by its week, with
     the default segments, and marked as the verdict if it is the last week. */
  async function createEpisode(m, slot){
    const taken = await slotHolder(m, slot.week);
    if(taken) return { ok:false, reason:'taken', holder:taken };
    const rec = {
      id: vid('v'),
      title: slot.last ? `${m.name || 'Month'} — verdict` : `${m.name || 'Month'} — week ${slot.index}`,
      format:'weekly', length:'15', seriesId:null, week:slot.week,
      acts: weeklyActs(),
      monthId: m.id, isVerdict: !!slot.last, result:null,
      skill:'', weeklyChallenge:'', passLine:'',
      segments: defaultSegments(),
      scriptBeats:{ intro:'', history:'', wisdom:'', science:'', backToMe:'' },
      createdAt: Date.now()
    };
    await Store.put('vlogs', rec);
    return { ok:true, episode:rec };
  }

  /* Link an existing episode into a slot: it takes the month tag and the slot's
     week. Nothing else about it changes. */
  async function linkEpisode(id, m, slot){
    const v = await Store.get('vlogs', id);
    if(!v) return { ok:false, reason:'missing' };
    const taken = await slotHolder(m, slot.week, id);
    if(taken) return { ok:false, reason:'taken', holder:taken };
    v.monthId = m.id;
    v.week = slot.week;
    v.isVerdict = !!slot.last;
    if(!Array.isArray(v.segments) || !v.segments.length) v.segments = defaultSegments();
    await Store.put('vlogs', v);
    return { ok:true, episode:v };
  }

  /* Episodes a slot could take: untagged ones, the ones filming that week first. */
  async function linkable(slot){
    const list = (await episodes()).filter(v => !v.monthId);
    const here = v => hasWeek(v) && +v.week === +slot.week;
    return list.sort((a,b) => (here(b) - here(a)) || ((b.createdAt || 0) - (a.createdAt || 0)))
      .map(v => ({ v, here:here(v) }));
  }

  /* For the episode page: is this week in the month's range, is it the last
     week, and is anyone else already in it. */
  async function fitFor(v, m){
    if(!m) return { inRange:false, last:false, holder:null };
    const slots = await weeks(m);
    const slot = hasWeek(v) ? slots.find(sl => sl.week === +v.week) : null;
    return { inRange:!!slot, last:!!(slot && slot.last), slot,
             holder: slot ? await slotHolder(m, slot.week, v.id) : null };
  }

  global.Months = {
    iso, ts, addDays, snapSunday, snapSaturday, thursdayAfter, label,
    blank, normalise, all, get, save, remove, invalidate, forDate, weeks,
    DEFAULT_SEGMENTS, defaultSegments, SEG_NEXT, withExtras, datesOf, linked, record,
    slotHolder, createEpisode, linkEpisode, linkable, fitFor, hasWeek, weeklyActs
  };
})(window);
