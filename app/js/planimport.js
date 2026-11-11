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
    if(!obj || (obj.format !== FORMAT && !has('series') && !has('seriesEpisodes')))
      throw new Error("That isn't a plan or a list of series.");
    obj.months = Array.isArray(obj.months) ? obj.months : [];
    obj.episodes = Array.isArray(obj.episodes) ? obj.episodes : [];
    obj.series = Array.isArray(obj.series) ? obj.series : [];
    obj.seriesEpisodes = Array.isArray(obj.seriesEpisodes) ? obj.seriesEpisodes : [];
    if(!obj.months.length && !obj.episodes.length && !obj.series.length && !obj.seriesEpisodes.length)
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
    const t = String(text || '').trim();
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

  /* Work out what would happen, without writing anything. */
  async function preview(obj){
    const existingMonths = await Months.all();
    let existingEps = [];
    try { existingEps = (await Store.all('vlogs')).values; } catch(e){}
    const warnings = [];

    /* months: skip one that already starts on the same Sunday */
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
      const same = existingMonths.find(m => m.startDate === rec.startDate)
        || existingMonths.find(m => pm.id && m.id === pm.id);
      if(same){
        monthIdMap[pm.id] = same.id;
        return { action:'skip', plan:pm, rec, reason:`${same.name || 'A month'} already starts ${Months.label(rec.startDate)}` };
      }
      rec.id = pm.id || null;       /* keep the plan's id, so a second import recognises it */
      monthIdMap[pm.id] = rec.id;
      return { action:'create', plan:pm, rec };
    });

    /* episodes: skip one imported before, or a week that already has an episode */
    const takenWeeks = new Map(existingEps.filter(v => Months.hasWeek(v)).map(v => [+v.week, v]));
    const seenIds = new Set(existingEps.map(v => v.id));
    const episodes = [];
    for(const pe of obj.episodes){
      let week = null;
      try { week = pe.filmStart ? await Data.weekNumber(Months.ts(Months.snapSunday(pe.filmStart))) : null; } catch(e){}
      if(week === null && pe.weekNumber) week = +pe.weekNumber;
      if(pe.weekNumber && week !== null && +pe.weekNumber !== week)
        warnings.push(`${pe.title}: the plan says week ${pe.weekNumber}, but ${pe.filmStart} is week ${week} with your program start — using week ${week}`);

      const auto = pe.filmEnd ? Months.thursdayAfter(pe.filmEnd) : null;
      const rec = {
        id: pe.id || null,
        title: str(pe.title) || `Week ${week}`,
        format:'weekly', length:'15', seriesId:null, week,
        monthId: monthIdMap[pe.monthId] || null,
        skill:str(pe.skill), weeklyChallenge:str(pe.weeklyChallenge), passLine:str(pe.passLine),
        /* the release is only stored when it isn't the usual Thursday */
        releaseDate: pe.releaseDate && pe.releaseDate !== auto ? pe.releaseDate : null,
        isVerdict: !!pe.isVerdict,
        result: (pe.result === 'W' || pe.result === 'L') ? pe.result : null,
        scriptBeats: beats(pe.scriptBeats)
      };
      if(pe.monthId && !monthIdMap[pe.monthId]) warnings.push(`${rec.title}: its month isn't in the plan — it will come in untagged`);

      if(rec.id && seenIds.has(rec.id)){
        episodes.push({ action:'skip', plan:pe, rec, reason:'already imported' }); continue;
      }
      const holder = week !== null ? takenWeeks.get(week) : null;
      if(holder){
        episodes.push({ action:'skip', plan:pe, rec, reason:`week ${week} already has "${holder.title || 'an episode'}"` });
        continue;
      }
      if(week !== null) takenWeeks.set(week, rec);   /* two plan episodes in one week: the first wins */
      if(rec.id) seenIds.add(rec.id);
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
    const takenIdea = new Set(existingVideos.map(v => (v.seriesId || '') + '|' + low(v.title)));
    const seenVid = new Set(existingVideos.map(v => v.id));
    const now = Date.now();
    for(const pi of planIdeas){
      const sid = seriesIdMap[pi.seriesId] || null;
      const parts = Array.isArray(pi.parts) ? pi.parts.map(str).filter(Boolean) : [];
      const notes = [str(pi.idea),
        pi.timing ? `When: ${pi.timing}` : '',
        parts.length ? `Parts:\n${parts.map((x, i) => `${i + 1}. ${x}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
      const rec = { id: pi.id || null, title: str(pi.title), channel: chan(pi.channel), seriesId: sid,
                    plat:'youtube', stage:'idea', day:null, tags:[], hook:'', notes, shots:[], taskId:null,
                    order: +pi.order || 0, parts,
                    /* newest first is how videos list, so the plan's order reads top to bottom */
                    createdAt: now - (+pi.order || 0) };
      const key = (sid || '') + '|' + low(rec.title);
      if((rec.id && seenVid.has(rec.id)) || takenIdea.has(key)){
        ideas.push({ action:'skip', plan:pi, rec, reason:'already in that series' }); continue;
      }
      takenIdea.add(key); if(rec.id) seenVid.add(rec.id);
      ideas.push({ action:'create', plan:pi, rec });
    }

    return { obj, months, episodes, series, ideas, warnings };
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
      await Store.put('vlogs', {
        ...e.rec, id,
        acts: Months.weeklyActs(),
        segments: Months.defaultSegments(),
        createdAt: Date.now()
      });
      made.episodes++;
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
        await Videos.save({ ...x.rec, id: x.rec.id || null });
        made.ideas++;
      }
    }
    return made;
  }

  global.PlanImport = { FORMAT, parse, parseAny, fromCSV, preview, apply };
})(window);
