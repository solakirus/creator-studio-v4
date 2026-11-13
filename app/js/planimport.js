/* Import a phase plan (phase1.json): months and their episodes, created and
   linked in one go.

   It only ever adds. A month is skipped when one already starts on the same
   Sunday; an episode is skipped when it was imported before, or when an episode
   already films that week. Nothing existing is changed. You see what will be
   created and skipped before anything is written, and a report after.

   An episode's week is worked out from its filmStart against your program start,
   so the dates are what count; the plan's own weekNumber is only checked. */
(function(global){

  const FORMAT = 'creator-studio-phase-plan';

  function parse(text){
    let obj;
    try { obj = JSON.parse(text); } catch(e){ throw new Error("That file isn't valid JSON."); }
    return check(obj);
  }
  /* A plan file, or any JSON carrying series and their videos — a file of just
     series ideas imports the same way, with no months or episodes in it. */
  function check(obj){
    if(obj && obj.format === 'creator-studio') throw new Error("That's a backup, not a plan — use Restore from backup for it.");
    const has = k => obj && Array.isArray(obj[k]) && obj[k].length;
    /* v4: "videos" — the plan Claude writes in chat: each video with its
       series (or none), hook, idea and shots. The same as seriesEpisodes. */
    if(obj && has('videos')) obj.seriesEpisodes = (Array.isArray(obj.seriesEpisodes) ? obj.seriesEpisodes : []).concat(obj.videos);
    if(!obj || (obj.format !== FORMAT && !has('series') && !has('seriesEpisodes') && !has('months') && !has('episodes') && !has('quarters')))
      throw new Error("That isn't a plan or a list of series.");
    obj.quarters = Array.isArray(obj.quarters) ? obj.quarters : (obj.quarter && typeof obj.quarter === 'object' ? [obj.quarter] : []);
    obj.months = Array.isArray(obj.months) ? obj.months : [];
    obj.episodes = Array.isArray(obj.episodes) ? obj.episodes : [];
    obj.series = Array.isArray(obj.series) ? obj.series : [];
    obj.seriesEpisodes = Array.isArray(obj.seriesEpisodes) ? obj.seriesEpisodes : [];
    if(!obj.quarters.length && !obj.months.length && !obj.episodes.length && !obj.series.length && !obj.seriesEpisodes.length)
      throw new Error('There is nothing in that file to import.');
    return obj;
  }

  /* A spreadsheet of series ideas, one video per row:
       series, channel, title, idea (or notes), timing (or when), order, parts
     Only series and title are needed. Parts are split on semicolons. The series
     are gathered from the rows, so a sheet with 40 rows over 4 series makes 4
     series with their 40 videos. */
  const slug = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function fromCSV(text){
    const rows = Transfer.toObjects(text);
    if(!rows.length) throw new Error('That sheet has no rows under its header.');
    const pick = (r, ...ks) => { for(const k of ks){ if(r[k] !== undefined && String(r[k]).trim() !== '') return String(r[k]).trim(); } return ''; };
    const series = [], ideas = [], byKey = {};
    rows.forEach((r, i) => {
      const name = pick(r, 'series', 'series name', 'show');
      const title = pick(r, 'title', 'video', 'episode', 'name');
      if(!name || !title) return;
      const channel = pick(r, 'channel');
      const key = slug(channel) + '--' + slug(name);
      if(!byKey[key]){
        byKey[key] = { id:'s-' + key, channel, name, n:0 };
        series.push({ id:'s-' + key, channel, name });
      }
      const sr = byKey[key]; sr.n++;
      const order = +pick(r, 'order', '#', 'number') || sr.n;
      const parts = pick(r, 'parts').split(';').map(x => x.trim()).filter(Boolean);
      ideas.push({ id:`${sr.id}-${String(order).padStart(2, '0')}`, seriesId:sr.id, channel, series:name, order,
                   title, idea:pick(r, 'idea', 'notes', 'description'), timing:pick(r, 'timing', 'when') || null,
                   status:'idea', ...(parts.length ? { parts } : {}) });
    });
    if(!ideas.length) throw new Error('No rows had both a series and a title.');
    return check({ series, seriesEpisodes:ideas });
  }

  /* Whatever was picked: a plan or series JSON, or a CSV of series ideas. */
  function parseAny(text){
    /* pasted from chat: the code block's fences, or words around the JSON */
    let t = String(text || '').trim().replace(/^```[\w-]*\s*\n?|\n?```\s*$/g, '').trim();
    if(!/^[{\[]/.test(t) && /[{\[]/.test(t)){
      const a = t.search(/[{\[]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
      if(b > a){ const inner = t.slice(a, b + 1); try { JSON.parse(inner); t = inner; } catch(e){} }
    }
    if(t.startsWith('{') || t.startsWith('[')){
      let obj;
      try { obj = JSON.parse(t); } catch(e){ throw new Error("That file isn't valid JSON."); }
      if(Array.isArray(obj)) obj = { seriesEpisodes: obj };
      return check(obj);
    }
    return fromCSV(t);
  }

  const str = v => (v === null || v === undefined) ? '' : String(v);
  const beats = b => ({ intro:str(b && b.intro), history:str(b && b.history), wisdom:str(b && b.wisdom),
                        science:str(b && b.science), backToMe:str(b && b.backToMe) });

  /* ---- v4: a video's planned fields: what a plan sets and an update compares ---- */
  const STAGE_KEYS = ['idea', 'planned', 'shot', 'editing', 'published'];
  const PLATS = { yt:'youtube', youtube:'youtube', shorts:'shorts', ig:'instagram', insta:'instagram', instagram:'instagram',
                  reels:'instagram', tiktok:'tiktok', tt:'tiktok', facebook:'facebook', fb:'facebook', x:'x' };
  /* a video's shoot day is a date ("2026-11-20") or nothing */
  const dayOf = v => (v.day == null || v.day === '') ? null : v.day;
  const isDay = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  /* only the fields the plan item actually has */
  function planFields(pi){
    const f = {};
    if(pi.title != null) f.title = str(pi.title).trim();
    if(pi.hook != null) f.hook = str(pi.hook);
    const parts = Array.isArray(pi.parts) ? pi.parts.map(str).filter(Boolean) : [];
    if(pi.idea != null || pi.notes != null || pi.timing || parts.length){
      f.notes = [str(pi.idea != null ? pi.idea : pi.notes),
        pi.timing ? `When: ${pi.timing}` : '',
        parts.length ? `Parts:\n${parts.map((x, i) => `${i + 1}. ${x}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
    }
    if(parts.length) f.parts = parts;
    if(Array.isArray(pi.tags)) f.tags = pi.tags.map(t => str(t).trim()).filter(Boolean);
    if(pi.stage != null && STAGE_KEYS.includes(String(pi.stage).toLowerCase())) f.stage = String(pi.stage).toLowerCase();
    const pl = pi.platform || pi.plat;
    if(pl && PLATS[String(pl).toLowerCase()]) f.plat = PLATS[String(pl).toLowerCase()];
    if(pi.day !== undefined || pi.date !== undefined || pi.shootDay !== undefined){
      const d = pi.day !== undefined ? pi.day : pi.date !== undefined ? pi.date : pi.shootDay;
      f.day = isDay(d) ? d : null;
    }
    if(Array.isArray(pi.shots) && global.ShotList) f.shotList = ShotList.norm(pi.shots);
    /* a shoot day makes it planned (Videos.schedule does the same) */
    if(f.day && (f.stage || 'idea') === 'idea') f.stage = 'planned';
    return f;
  }
  /* those fields as the video stores them */
  function stored(f){
    const o = { ...f };
    delete o.parts;
    if(o.shotList) o.shots = o.shotList.map(x => x.text || 'Shot');
    return o;
  }
  const shotKey = l => (Array.isArray(l) ? l : []).map(x => [x.text, x.framing, x.movement, x.note,
    JSON.stringify(x.lines || []), x.editNote || ''].join('¦')).join('\n');
  const listOf = v => global.ShotList ? ShotList.norm(Array.isArray(v.shotList) ? v.shotList : v.shots) : [];
  const same = (k, v, f) => {
    if(k === 'shotList') return shotKey(listOf(v)) === shotKey(f.shotList);
    if(k === 'tags') return JSON.stringify(v.tags || []) === JSON.stringify(f.tags);
    if(k === 'day') return dayOf(v) === (f.day == null ? null : f.day);
    return str(v[k]) === str(f[k]);
  };
  const LABEL = { title:'title', hook:'hook', notes:'idea', tags:'tags', stage:'stage', plat:'platform', day:'shoot day', shotList:'shots' };
  function changed(v, f){ return Object.keys(LABEL).filter(k => k in f && !same(k, v, f)); }
  /* a fingerprint of the planned fields as they stand, kept on the video at
     import: if it no longer matches, the video was changed in the app */
  function sigOf(v){
    const t = [v.title, v.hook, v.notes, JSON.stringify(v.tags || []), v.stage, v.plat, v.day || '', shotKey(listOf(v))].join('\u0001');
    let h = 5381; for(let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /* ---- v4: what a plan can set on a quarter, a month, an episode ---- */
  const Q_KEYS = ['name', 'topic', 'throughline', 'challenge'];
  const M_KEYS = ['name', 'challenge', 'reward', 'notes', 'quarterTheme'];
  const E_KEYS = ['title', 'skill', 'weeklyChallenge', 'passLine'];
  const pick = (o, keys) => { const f = {}; keys.forEach(k => { if(o && o[k] != null) f[k] = str(o[k]); }); return f; };
  /* an episode's acts (the days, or parts) and their sequences, from a plan:
       acts:[{ title, sequences:[{ title, purpose, setup, script, shots }] }]
     (or "beats" for sequences). None given: the usual seven days. */
  const SETUP_KEYS = ['talking', 'vlog', 'phone', 'location', 'transition', 'screen', 'broll'];
  const vid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function actsFrom(pe){
    if(!Array.isArray(pe.acts) || !pe.acts.length) return null;
    return pe.acts.map((a, i) => ({
      id: vid('a'), title: str(a.title || a.day || a.name) || `Part ${i + 1}`, day:null, open: i === 0,
      beats: (Array.isArray(a.sequences) ? a.sequences : Array.isArray(a.beats) ? a.beats : []).map((b, j) => ({
        id: vid('b'), title: str(b.title || b.name) || `Sequence ${j + 1}`, purpose: str(b.purpose),
        setup: SETUP_KEYS.includes(String(b.setup || '').toLowerCase()) ? String(b.setup).toLowerCase() : 'vlog',
        script: str(b.script), sourceId:null, day:null, at:null, done:false, clipId:null,
        shots: (Array.isArray(b.shots) ? b.shots : []).map(raw => {
          const x = global.ShotList ? ShotList.norm([raw])[0] : null;
          if(!x) return null;
          return { id:x.id, text:x.text, note:x.note || '', framing:x.framing || '', movement:x.movement || '',
            location: raw && typeof raw === 'object' ? str(raw.location) : '', done:false, ...(x.lines ? { lines:x.lines } : {}) };
        }).filter(Boolean)
      }))
    }));
  }
  const actsKey = acts => JSON.stringify((acts || []).map(a => [a.title, (a.beats || []).map(b => [b.title, b.purpose || '', b.script || '',
    (b.shots || []).map(x => x.text)])]));
  /* a plan's acts over the episode's own: a sequence of the same name keeps its
     id, frames, ticks and clip; a shot of the same words keeps its frame */
  function mergeActs(old, next){
    const flat = (old || []).flatMap(a => a.beats || []);
    return next.map(a => {
      const oa = (old || []).find(x => String(x.title).toLowerCase() === String(a.title).toLowerCase());
      return { ...a, id: oa ? oa.id : a.id, day: oa ? oa.day : null, beats: a.beats.map(b => {
        const ob = flat.find(x => String(x.title).toLowerCase() === String(b.title).toLowerCase());
        if(!ob) return b;
        return { ...ob, ...b, id: ob.id, day: ob.day, at: ob.at, done: ob.done, clipId: ob.clipId, sourceId: ob.sourceId,
          shots: b.shots.map(x => { const os = (ob.shots || []).find(y => String(y.text).toLowerCase() === String(x.text).toLowerCase());
            return os ? { ...x, id: os.id, item: os.item || x.item, done: os.done } : x; }) };
      }) };
    });
  }
  const recSig = (r, keys) => {
    const t = keys.map(k => k === 'acts' ? actsKey(r.acts) : str(r[k])).join('\u0001');
    let h = 5381; for(let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  /* changed here since it came in? With no record of coming in, only when a
     field the plan changes already has something written in it */
  /* what the app writes by itself: a quarter's "Q6", an episode's "Discipline — week 2" */
  const AUTO = /^(Q\d+|Untitled.*|Week \d+|.* — week \d+|.* — verdict)$/;
  const editedSince = (r, keys, changes) => r.imported && r.imported.sig ? r.imported.sig !== recSig(r, keys)
    : changes.some(k => k === 'acts' ? (r.acts || []).some(a => (a.beats || []).some(b => (b.shots || []).length || b.purpose || b.script))
      : str(r[k]).trim() !== '' && !((k === 'name' || k === 'title') && AUTO.test(str(r[k]).trim())));

  /* Work out what would happen, without writing anything. */
  async function preview(obj){
    const existingMonths = await Months.all();
    let existingEps = [];
    try { existingEps = (await Store.all('vlogs')).values; } catch(e){}
    const warnings = [];

    /* ---- v4: quarters ----
       Quarters are made by the app (thirteen project weeks each), so a plan
       never adds one: it fills in the one on those dates (or that number) —
       its name, topic, throughline and challenge. */
    const quarters = [];
    let allQ = [];
    try { if(global.Quarters){ await Quarters.ensureThrough(new Date().getFullYear() + 1); allQ = await Quarters.all(); } } catch(e){}
    for(const pq of obj.quarters){
      const at = pq.startDate ? Months.ts(pq.startDate) : null;
      const q = allQ.find(x => pq.id && x.id === pq.id) || allQ.find(x => pq.n && +x.n === +pq.n)
        || (at ? allQ.find(x => x.startDate && at >= x.startDate - 4 * 864e5 && at <= x.endDate) : null);
      const f = pick(pq, Q_KEYS);
      if(!q){ quarters.push({ action:'skip', plan:pq, rec:{ name:str(pq.name) || 'A quarter' }, reason:'no quarter on those dates' }); continue; }
      const changes = Q_KEYS.filter(k => k in f && str(q[k]) !== str(f[k]));
      if(!changes.length){ quarters.push({ action:'skip', plan:pq, rec:q, reason:'no changes' }); continue; }
      quarters.push({ action:'update', kind:'quarter', plan:pq, rec:q, patch:f, changes, edited:editedSince(q, Q_KEYS, changes) });
    }

    /* months: a new one, or the one already starting that Sunday is updated */
    const monthIdMap = {};          /* plan month id → the id it will have in the app */
    const months = obj.months.map(pm => {
      const rec = Months.normalise({
        name:str(pm.name), quarter:str(pm.quarter), quarterTheme:str(pm.quarterTheme),
        challenge:str(pm.challenge), startDate:pm.startDate, endDate:pm.endDate,
        verdictReleaseDate:pm.verdictReleaseDate || null, reward:str(pm.reward),
        penaltyOptions:Array.isArray(pm.penaltyOptions) ? pm.penaltyOptions : [],
        result:(pm.result === 'W' || pm.result === 'L') ? pm.result : null, notes:str(pm.notes)
      });
      if(rec.startDate !== pm.startDate || rec.endDate !== pm.endDate)
        warnings.push(`${rec.name}: dates snapped to ${rec.startDate} – ${rec.endDate}`);
      /* the quarter its first week falls in */
      const qq = allQ.find(x => x.startDate && Months.ts(rec.startDate) >= x.startDate - 864e5 && Months.ts(rec.startDate) <= x.endDate);
      if(qq) rec.quarterId = qq.id;
      const same = existingMonths.find(m => pm.id && m.id === pm.id) || existingMonths.find(m => m.startDate === rec.startDate);
      const key = pm.id || pm.name || rec.startDate;
      if(same){
        monthIdMap[key] = same.id;
        const f = pick(pm, M_KEYS);
        const changes = M_KEYS.filter(k => k in f && str(same[k]) !== str(f[k]));
        if(!changes.length) return { action:'skip', plan:pm, rec:same, reason:`${same.name || 'A month'} already starts ${Months.label(rec.startDate)}` };
        return { action:'update', kind:'month', plan:pm, rec:same, patch:f, changes, edited:editedSince(same, M_KEYS, changes) };
      }
      rec.id = pm.id || ('mo_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      monthIdMap[key] = rec.id;
      return { action:'create', plan:pm, rec };
    });
    const plannedMonths = months.map(x => x.rec);
    /* the month an episode's week falls in: the plan's, or one you have */
    const monthFor = (pe, weekStart) => {
      if(pe.monthId && monthIdMap[pe.monthId]) return monthIdMap[pe.monthId];
      if(pe.month && monthIdMap[pe.month]) return monthIdMap[pe.month];
      if(!weekStart) return null;
      const t = Months.ts(weekStart);
      const m = plannedMonths.concat(existingMonths).find(x => x.startDate && x.endDate && t >= Months.ts(x.startDate) && t <= Months.ts(x.endDate));
      return m ? m.id : null;
    };

    /* episodes: a new one, or the one already in that week (or with that id) is updated */
    const byWeek = new Map(existingEps.filter(v => Months.hasWeek(v)).map(v => [+v.week, v]));
    const byEpId = new Map(existingEps.map(v => [v.id, v]));
    const episodes = [];
    for(const pe of obj.episodes){
      let week = null;
      const sun = pe.filmStart || pe.weekOf || pe.week_of || null;
      try { week = sun ? await Data.weekNumber(Months.ts(Months.snapSunday(sun))) : null; } catch(e){}
      if(week === null && pe.weekNumber) week = +pe.weekNumber;
      if(pe.weekNumber && week !== null && +pe.weekNumber !== week)
        warnings.push(`${pe.title}: the plan says week ${pe.weekNumber}, but ${sun} is week ${week} with your program start — using week ${week}`);

      const auto = pe.filmEnd ? Months.thursdayAfter(pe.filmEnd) : null;
      const acts = actsFrom(pe);
      const rec = {
        id: pe.id || null,
        title: str(pe.title) || `Week ${week}`,
        format:'weekly', length:'15', seriesId:null, week,
        monthId: monthFor(pe, sun ? Months.snapSunday(sun) : null),
        skill:str(pe.skill), weeklyChallenge:str(pe.weeklyChallenge || pe.challenge), passLine:str(pe.passLine),
        /* the release is only stored when it isn't the usual Thursday */
        releaseDate: pe.releaseDate && pe.releaseDate !== auto ? pe.releaseDate : null,
        isVerdict: !!pe.isVerdict,
        result: (pe.result === 'W' || pe.result === 'L') ? pe.result : null,
        scriptBeats: beats(pe.scriptBeats),
        ...(acts ? { acts } : {})
      };
      if((pe.monthId || pe.month) && !rec.monthId) warnings.push(`${rec.title}: its month isn't in the plan — it will come in untagged`);

      const have = (rec.id && byEpId.get(rec.id)) || (week !== null ? byWeek.get(week) : null);
      if(have){
        const f = pick({ ...pe, weeklyChallenge: pe.weeklyChallenge != null ? pe.weeklyChallenge : pe.challenge }, E_KEYS);
        if(acts) f.acts = acts;
        const changes = E_KEYS.filter(k => k in f && str(have[k]) !== str(f[k]));
        if(acts && actsKey(have.acts) !== actsKey(acts)) changes.push('acts');
        if(!changes.length){ episodes.push({ action:'skip', plan:pe, rec:have, reason:'no changes' }); continue; }
        episodes.push({ action:'update', kind:'episode', plan:pe, rec:have, patch:f, changes,
          edited:editedSince(have, E_KEYS.concat('acts'), changes) });
        continue;
      }
      if(week !== null) byWeek.set(week, rec);   /* two plan episodes in one week: the first wins */
      if(rec.id) byEpId.set(rec.id, rec);
      episodes.push({ action:'create', plan:pe, rec });
    }

    /* ---- channel series and their episode ideas ----
       A series lands in the Series tab (drafting, not live); each idea becomes a
       video at the Idea stage inside it, in the plan's order. A series is
       skipped when one with the same name already exists on that channel — its
       ideas then go into yours. An idea is skipped when that series already has
       a video with the same title. */
    let existingSeries = [], existingVideos = [], channels = [];
    try { existingSeries = await Data.series(); } catch(e){}
    try { existingVideos = await Videos.all(); } catch(e){}
    let chanList = [];
    try { chanList = await Channels.all(); channels = chanList.map(c => c.n); } catch(e){}
    const low = t => String(t || '').trim().toLowerCase();
    /* a channel written differently from yours ("Can I Get A Ride" for your
       "Can i get ride") is filed under yours, so it doesn't turn up twice */
    const chan = name => {
      const m = name && Channels.match ? Channels.match(name, chanList) : null;
      return m ? m.n : str(name);
    };

    const planSeries = (Array.isArray(obj.series) ? obj.series : []).slice();
    const planIdeas = Array.isArray(obj.seriesEpisodes) ? obj.seriesEpisodes : [];
    /* ideas whose series isn't listed bring it with them, from their own
       series name and channel */
    planIdeas.forEach(pi => {
      if(!pi.seriesId && pi.series) pi.seriesId = 's-' + slug(pi.channel) + '--' + slug(pi.series);
      if(pi.seriesId && pi.series && !planSeries.some(x => x.id === pi.seriesId))
        planSeries.push({ id:pi.seriesId, channel:pi.channel || '', name:pi.series });
    });
    const seriesIdMap = {};
    const series = planSeries.map(ps => {
      const rec = { id: ps.id || null, title: str(ps.name || ps.title), channel: chan(ps.channel),
                    cadence:'Weekly', days:[], state:'draft', active:false, nextDrop:null,   /* the app's own default for a new series */
                    total: Math.max(1, planIdeas.filter(x => x.seriesId === ps.id).length) };
      const same = existingSeries.find(x => ps.id && x.id === ps.id)
        || existingSeries.find(x => low(x.title) === low(rec.title) && low(chan(x.channel)) === low(rec.channel));
      if(same){
        seriesIdMap[ps.id] = same.id;
        return { action:'skip', plan:ps, rec, reason:`${same.title} already exists${same.channel ? ' on ' + same.channel : ''}` };
      }
      seriesIdMap[ps.id] = rec.id;
      return { action:'create', plan:ps, rec };
    });
    const unknownChans = [...new Set(series.filter(x => x.action === 'create' && x.rec.channel
      && channels.length && !channels.includes(x.rec.channel)).map(x => x.rec.channel))];
    if(unknownChans.length) warnings.push(`Not one of your channels yet: ${unknownChans.join(', ')} — the series keep the name`);

    const ideas = [];
    const byKey = new Map(existingVideos.map(v => [(v.seriesId || '') + '|' + low(v.title), v]));
    const byId = new Map(existingVideos.map(v => [v.id, v]));
    const now = Date.now();
    for(const pi of planIdeas){
      const sid = seriesIdMap[pi.seriesId] || null;
      const pf = planFields(pi, chan);
      const rec = { id: pi.id || null, title: pf.title || 'Untitled video', channel: chan(pi.channel), seriesId: sid,
                    plat:'youtube', stage:'idea', day:null, tags:[], hook:'', notes:'', shots:[], taskId:null,
                    order: +pi.order || 0, ...(pf.parts ? { parts:pf.parts } : {}),
                    ...stored(pf),
                    /* newest first is how videos list, so the plan's order reads top to bottom */
                    createdAt: now - (+pi.order || 0) };
      const key = (sid || '') + '|' + low(rec.title);
      /* v4: the same video again (its id, or its title in that series): an
         update, so a plan refined in chat can be pasted back over itself */
      const have = (rec.id && byId.get(rec.id)) || byKey.get(key);
      if(have){
        const changes = changed(have, pf);
        if(!changes.length){ ideas.push({ action:'skip', plan:pi, rec:have, reason:'no changes' }); continue; }
        /* changed here since it came in (or made here by hand): yours wins unless you tick it */
        const edited = !have.imported || have.imported.sig !== sigOf(have);
        ideas.push({ action:'update', plan:pi, rec:have, pf, changes, edited }); continue;
      }
      byKey.set(key, rec); if(rec.id) byId.set(rec.id, rec);
      ideas.push({ action:'create', plan:pi, rec, pf });
    }

    return { obj, quarters, months, episodes, series, ideas, warnings };
  }

  /* Write what preview said it would create — nothing else. */
  async function apply(pv){
    const made = { months:0, episodes:0 };
    for(const m of pv.months.filter(x => x.action === 'create')){
      const exists = m.rec.id ? await Store.get('months', m.rec.id) : null;
      if(exists) continue;
      await Months.save({ ...m.rec, id:m.rec.id || null, createdAt:Date.now() });
      made.months++;
    }
    for(const e of pv.episodes.filter(x => x.action === 'create')){
      const id = e.rec.id || ('v_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6));
      if(await Store.get('vlogs', id)) continue;
      const ep = { ...e.rec, id, acts: e.rec.acts || Months.weeklyActs(), segments: Months.defaultSegments(), createdAt: Date.now() };
      ep.imported = { at:Date.now(), sig:recSig(ep, E_KEYS.concat('acts')) };
      await Store.put('vlogs', ep);
      made.episodes++;
    }
    /* v4: updates to quarters, months and episodes you ticked */
    made.updated = 0;
    for(const x of (pv.quarters || []).filter(y => y.action === 'update' && y.apply)){
      const q = await Quarters.get(x.rec.id); if(!q) continue;
      const nq = { ...q, ...x.patch }; nq.imported = { at:Date.now(), sig:recSig(nq, Q_KEYS) };
      await Quarters.save(nq); made.updated++;
    }
    for(const x of pv.months.filter(y => y.action === 'update' && y.apply)){
      const m = await Store.get('months', x.rec.id); if(!m) continue;
      const nm = { ...m, ...x.patch }; nm.imported = { at:Date.now(), sig:recSig(nm, M_KEYS) };
      await Months.save(nm); made.updated++;
    }
    for(const x of pv.episodes.filter(y => y.action === 'update' && y.apply)){
      const v = await Store.get('vlogs', x.rec.id); if(!v) continue;
      const patch = { ...x.patch };
      if(patch.acts) patch.acts = mergeActs(v.acts, patch.acts);
      const nv = { ...v, ...patch }; nv.imported = { at:Date.now(), sig:recSig(nv, E_KEYS.concat('acts')) };
      await Store.put('vlogs', nv); made.updated++;
    }
    for(const m of pv.months.filter(x => x.action === 'create')){ /* stamped after Months.save above */
      const r = await Store.get('months', m.rec.id); if(r && !r.imported){ r.imported = { at:Date.now(), sig:recSig(r, M_KEYS) }; await Store.put('months', r); }
    }
    Months.invalidate();

    made.series = 0; made.ideas = 0;
    if(pv.includeSeries !== false){
      for(const x of (pv.series || []).filter(y => y.action === 'create')){
        if(x.rec.id && (await Data.series()).some(y => y.id === x.rec.id)) continue;
        await Data.saveSeries({ ...x.rec, id: x.rec.id || undefined });
        made.series++;
      }
      for(const x of (pv.ideas || []).filter(y => y.action === 'create')){
        if(x.rec.id && await Videos.get(x.rec.id)) continue;
        const day = x.rec.day; delete x.rec.day;
        let v = await Videos.save({ ...x.rec, id: x.rec.id || null });
        if(day && Videos.schedule){ try { v = (await Videos.schedule(v, day)) || v; } catch(e){} }
        await stamp(v.id);
        made.ideas++;
      }
      for(const x of (pv.ideas || []).filter(y => y.action === 'update' && y.apply)){
        const v = await Videos.get(x.rec.id);
        if(!v) continue;
        const f = stored(x.pf);
        /* a shot that stays keeps its frame, its tick and its id */
        if(f.shotList){
          const old = listOf(v);
          f.shotList = f.shotList.map(s => { const o = old.find(y => y.text.toLowerCase() === s.text.toLowerCase());
            return o ? { ...s, id:o.id, item:s.item || o.item, done:o.done } : s; });
          f.shots = f.shotList.map(s => s.text || 'Shot');
        }
        const day = 'day' in f ? f.day : undefined; delete f.day;
        let nv = await Videos.save({ ...v, ...f });
        if(day !== undefined && day !== dayOf(v)){
          if(day && Videos.schedule){ try { nv = (await Videos.schedule(nv, day)) || nv; } catch(e){} }
          else if(!day) nv = await Videos.save({ ...nv, day:null });
        }
        await stamp(nv.id);
        made.updated++;
      }
    }
    return made;
  }
  /* remember how a video looked when it came in, so the next import can tell
     whether you've changed it since */
  async function stamp(id){
    const v = await Videos.get(id);
    if(!v) return;
    await Store.put('videos', { ...v, imported:{ at:Date.now(), sig:sigOf(v) } });
    if(global.Data && Data.invalidate) Data.invalidate('videos');
  }

  /* ---- v4: the plan as it stands, to paste into chat and refine there ----
     Series and their videos that aren't out yet, with ids, so pasting the
     refined plan back updates them instead of adding copies. */
  async function exportPlan(o = {}){
    let series = [], videos = [];
    try { series = await Data.series(); } catch(e){}
    try { videos = await Videos.all(); } catch(e){}
    if(!o.published) videos = videos.filter(v => v.stage !== 'published');
    if(o.seriesId) videos = videos.filter(v => v.seriesId === o.seriesId);
    const used = new Set(videos.map(v => v.seriesId).filter(Boolean));
    const sById = new Map(series.map(x => [x.id, x]));
    const out = {
      format: FORMAT, version: 2, made: new Date().toISOString().slice(0, 10),
      note: 'Creator Studio plan. Keep each id so importing this back updates those videos; leave id out for a new one.',
      series: series.filter(x => used.has(x.id)).map(x => ({ id:x.id, channel:x.channel || '', name:x.title })),
      videos: videos.sort((a, b) => (a.seriesId || '').localeCompare(b.seriesId || '') || (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0))
        .map(v => {
          const sr = v.seriesId && sById.get(v.seriesId);
          const shots = listOf(v).map(s => {
            const x = { text:s.text };
            ['framing', 'movement', 'note', 'editNote'].forEach(k => { if(s[k]) x[k] = s[k]; });
            if(s.lines && s.lines.length) x.lines = s.lines;
            return Object.keys(x).length === 1 ? s.text : x;
          });
          const r = { id:v.id, title:v.title };
          if(sr){ r.seriesId = sr.id; r.series = sr.title; }
          if(v.channel) r.channel = v.channel;
          if(v.order) r.order = v.order;
          r.stage = v.stage || 'idea';
          if(v.plat) r.platform = v.plat;
          if(v.day) r.day = v.day;
          r.hook = v.hook || '';
          r.idea = v.notes || '';
          if((v.tags || []).length) r.tags = v.tags;
          r.shots = shots;
          return r;
        })
    };
    return out;
  }

  global.PlanImport = { FORMAT, parse, parseAny, fromCSV, preview, apply, exportPlan, sigOf };
})(window);
