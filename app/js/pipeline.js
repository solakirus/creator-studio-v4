/* Turning a publishing commitment into work.
   A slot is a promise to publish. Everything else is derived from it:
   an edit day a couple of days before, and a shoot day the week before that
   — with every shoot due on the same day collected into one task. */
(function(global){

  const DEFAULTS = { shootLead:6, editLead:2, weeks:4, shootTime:'09:00', editTime:'19:00' };
  let cfg = null;

  async function config(){
    if(!cfg) cfg = { ...DEFAULTS, ...((await Store.get('settings','pipeline')) || {}) };
    return cfg;
  }
  async function setConfig(patch){
    cfg = { ...(await config()), ...patch };
    await Store.put('settings', cfg, 'pipeline');
    return cfg;
  }

  const midnight = ts => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };
  const DAY = 86400000;

  /* Every publish slot in a window, from each channel's cadence. */
  async function slots(fromTs, weeks){
    const channels = await Channels.all();
    const c = await config();
    const span = (weeks || c.weeks) * 7;
    const start = midnight(fromTs || Date.now());
    const out = [];

    for(let i = 0; i < span; i++){
      const when = start + i * DAY;
      const dow = new Date(when).getDay();
      channels.forEach(ch => {
        const s = ch.schedule;
        if(!s || !s.days || !s.days.includes(dow)) return;
        for(let n = 0; n < (s.perDay || 1); n++){
          out.push({
            channel: ch.n, colour: ch.c,
            platform: s.platform || 'youtube',
            publishAt: when,
            time: s.time || '18:00',
            index: n + 1,
            of: s.perDay || 1
          });
        }
      });
    }
    return out.sort((a,b) => a.publishAt - b.publishAt);
  }

  /* What already exists, so planning twice does not double everything. */
  async function existing(){
    const tasks = await Data.tasks();
    return new Set(tasks.map(t => t.slotKey).filter(Boolean));
  }
  const slotKey = s => `${s.channel}|${s.publishAt}|${s.index}`;

  /* Where a piece actually gets shot.
     If the channel has real shoot days — the days you are already doing the thing —
     use the latest one that leaves enough time to edit, and respect its capacity.
     Otherwise fall back to the fixed lead. */
  function findShootDay(slot, channel, c, load){
    const s = channel && channel.schedule;
    const latest = slot.publishAt - c.editLead * DAY;        /* must be shot before the edit */
    const earliest = slot.publishAt - Math.max(c.shootLead, 21) * DAY;

    if(s && s.shootDays && s.shootDays.length){
      const cap = Math.max(1, s.maxPerShoot || 3);
      for(let at = latest; at >= earliest; at -= DAY){
        if(!s.shootDays.includes(new Date(at).getDay())) continue;
        const key = `${channel.n}|${at}`;
        if((load[key] || 0) >= cap) continue;                /* that day is full */
        load[key] = (load[key] || 0) + 1;
        return { at, batched:true };
      }
    }
    return { at: slot.publishAt - c.shootLead * DAY, batched:false };
  }

  /* Build the plan without writing it, so it can be previewed first. */
  async function plan(fromTs, weeks){
    const c = await config();
    const [list, have, program, channels] =
      await Promise.all([slots(fromTs, weeks), existing(), Data.program(), Channels.all()]);
    const dayOf = ts => Math.floor((midnight(ts) - midnight(program.start)) / DAY) + 1;
    const byName = Object.fromEntries(channels.map(ch => [ch.n, ch]));

    const shootDays = {};       /* date -> [slots] */
    const items = [];
    const load = {};            /* channel|date -> how many already assigned */
    let overflow = 0;

    for(const s of list){
      const key = slotKey(s);
      if(have.has(key)) continue;
      const ch = byName[s.channel];
      const found = findShootDay(s, ch, c, load);
      const shootAt = found.at;
      const editAt  = s.publishAt - c.editLead * DAY;
      if(dayOf(shootAt) < 1) continue;      /* before the program started */
      if(ch && ch.schedule && (ch.schedule.shootDays || []).length && !found.batched) overflow++;

      (shootDays[shootAt] = shootDays[shootAt] || []).push(s);
      items.push({ slot:s, key, shootAt, editAt, publishAt:s.publishAt, batched:found.batched });
    }

    return { items, shootDays, cfg:c, dayOf, overflow };
  }

  /* Write it: one shoot task per shoot day, an edit task and a publish task per slot. */
  async function apply(fromTs, weeks){
    const { items, shootDays, cfg:c, dayOf } = await plan(fromTs, weeks);
    if(!items.length) return { shoots:0, edits:0, posts:0, clips:0 };

    const tasks = await Data.tasks();
    let shoots = 0, edits = 0, posts = 0, clips = 0;

    /* one shoot task per day, carrying every piece due from it */
    for(const [at, group] of Object.entries(shootDays)){
      const when = +at;
      const names = group.map(s => `${s.channel}${s.of > 1 ? ` #${s.index}` : ''}`);
      const chans = [...new Set(group.map(s => s.channel))];
      await Store.put('tasks', {
        id: U.taskId(), day: dayOf(when),
        title: chans.length === 1
          ? `Shoot · ${chans[0]} · ${group.length} piece${group.length === 1 ? '' : 's'}`
          : `Shoot day · ${group.length} pieces`,
        cad:'Shoot day', pri:'high', at:c.shootTime, kind:'shoot',
        channel: chans.length === 1 ? chans[0] : null,
        prog:'', view:'todo',
        /* A slot is a future publishing slot from a channel's schedule — there is
           no clip and no shot list yet, so one step per piece is all there is
           to say. Shots arrive when a real piece is scheduled from the vlog. */
        subs: names.map(n => ({ t:`Shoot for ${n}`, done:false })),
        shots: [],
        slotKey: `shoot|${when}`
      });
      shoots++;
    }

    for(const it of items){
      const s = it.slot;
      const label = `${s.channel}${s.of > 1 ? ` #${s.index}` : ''}`;

      /* a clip to carry the piece through raw, queued and posted */
      const clip = await Data.saveClip({
        title: `${label} · ${new Date(s.publishAt).toLocaleDateString(undefined,{ month:'short', day:'numeric' })}`,
        plat: s.platform, state:'raw', seriesId:null, dur:'0:00',
        scheduledAt: new Date(s.publishAt).setHours(
          +String(s.time).split(':')[0], +String(s.time).split(':')[1], 0, 0)
      });
      clips++;

      await Store.put('tasks', {
        id: U.taskId(), day: dayOf(it.editAt),
        title: `Edit · ${label}`,
        cad:'One-off', pri:'med', at:c.editTime, prog:'', view:'todo',
        kind:'edit', channel:s.channel,
        subs:[{ t:'Cut', done:false }, { t:'Audio and colour', done:false },
              { t:'Titles and thumbnail', done:false }],
        shots:[], clipId:clip.id, slotKey: it.key
      });
      edits++;

      await Store.put('tasks', {
        id: U.taskId(), day: dayOf(it.publishAt),
        title: `Publish · ${label}`,
        cad:'One-off', pri:'high', at:s.time, prog:'', view:'todo',
        kind:'publish', channel:s.channel,
        subs:[], shots:[], clipId:clip.id, slotKey: `post|${it.key}`
      });
      posts++;
    }

    Data.invalidate('tasks');
    Data.invalidate('clips');
    return { shoots, edits, posts, clips };
  }

  /* Taking a piece back out. A slot is a chain — clip, edit task, publish task, and a
     line inside a shared shoot task — so removing it has to unpick all four, and the
     shoot day only disappears once nothing is left to shoot. */
  async function removeSlot(key){
    const tasks = await Data.tasks();
    let clipId = null;

    for(const t of tasks){
      if(t.slotKey === key || t.slotKey === `post|${key}`){
        clipId = clipId || t.clipId || null;
        await Store.del('tasks', t.id);
      }
    }

    /* the piece's line in its shoot day */
    const label = key.split('|')[0];
    for(const t of tasks){
      if(!t.slotKey || !t.slotKey.startsWith('shoot|')) continue;
      const subs = (t.subs || []).filter(x => !x.t.includes(label));
      if(subs.length === (t.subs || []).length) continue;
      if(!subs.length) await Store.del('tasks', t.id);
      else {
        const keep = { ...t, subs,
          title: t.title.replace(/· \d+ pieces?$/, `· ${subs.length} piece${subs.length===1?'':'s'}`) };
        await Store.put('tasks', keep);
      }
    }

    if(clipId) await Store.del('clips', clipId);
    Data.invalidate('tasks');
    Data.invalidate('clips');
  }

  /* Everything planned from a date forward, undone. Anything already done is left alone. */
  async function clearPlan(fromTs){
    const from = midnight(fromTs || Date.now());
    const tasks = await Data.tasks();
    const program = await Data.program();
    const dateOf = d => midnight(program.start) + (d - 1) * DAY;

    let removed = 0;
    const clipIds = new Set();
    for(const t of tasks){
      if(!t.slotKey) continue;
      if(dateOf(t.day) < from) continue;
      if(t.view === 'done') continue;        /* work already finished stays on the record */
      if(t.clipId) clipIds.add(t.clipId);
      await Store.del('tasks', t.id);
      removed++;
    }
    for(const id of clipIds){
      const c = await Store.get('clips', id);
      if(c && c.state === 'raw') await Store.del('clips', id);
    }
    Data.invalidate('tasks');
    Data.invalidate('clips');
    return removed;
  }

  /* What a clip is tied to, so the calendar can offer to unpick the whole chain. */
  async function chainFor(clipId){
    const tasks = await Data.tasks();
    return tasks.filter(t => t.clipId === clipId && t.slotKey);
  }

  /* Completing the work moves the piece along, so the clip library is a record
     that maintains itself rather than a second thing to keep up to date. */
  /* finishing a task is what moves a piece along — the one place the app
     updates a stage without being asked */
  const ADVANCE = Lifecycle.ADVANCE;
  const ORDER = Lifecycle.ORDER;

  async function taskCompleted(task){
    if(!task || !task.kind) return null;
    const target = ADVANCE[task.kind];
    if(!target) return null;

    /* a shoot day covers several pieces at once, so collect all of them */
    let ids = task.clipId ? [task.clipId] : [];
    if(task.kind === 'shoot' && task.slotKey && task.slotKey.startsWith('shoot|')){
      const tasks = await Data.tasks();
      const when = task.slotKey.slice(6);
      ids = tasks.filter(t => t.kind === 'edit' && t.clipId &&
        String(t.slotKey || '').includes('|')).map(t => t.clipId);
    }
    if(!ids.length) return null;

    let moved = null;
    for(const id of ids){
      const c = await Store.get('clips', id);
      if(!c) continue;
      const now = c.stage || Lifecycle.FROM_CLIP[c.state] || 'idea';
      if(!Lifecycle.ahead(now, target)) continue;                    /* never go backwards */
      await Data.saveClip({ ...c, stage:target,
        postedAt: target === 'posted' ? Date.now() : c.postedAt });
      moved = target;
    }
    if(moved) Data.invalidate('clips');
    return moved;
  }

  global.Pipeline = { config, setConfig, slots, plan, apply, slotKey,
                      removeSlot, clearPlan, chainFor, taskCompleted, DEFAULTS };
})(window);
