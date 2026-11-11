/* Rating — attributes you define, scored by what you have actually done.

   An attribute is a name and a colour. Under it sit rules, each worth points:
   "twenty perfect days in a row" is worth 12 toward Consistency, "bench 150kg
   for 4+ reps" is worth 15 toward Strength. A rule that is currently true adds
   its points; one that is not adds nothing. The score is therefore a plain
   function of history — nothing to keep in sync, and it can go down if a streak
   breaks, which is the honest behaviour.

   Day 1 is a snapshot taken the first time you look, so the arrows have
   something to compare against. */
(function(global){

  /* Where an attribute sits before anything is earned. This is only the default
     for a new one — each carries its own `base`, so you can start Strength at 61
     because that is where you actually are, and let it climb from there. */
  const BASE = 40;
  const CEILING = 99;

  const SHIPPED = [
    { id:'strength',    name:'Strength',    c:'#E2564A', glyph:'barbell' },
    { id:'stamina',     name:'Stamina',     c:'#5BBE6A', glyph:'run' },
    { id:'consistency', name:'Consistency', c:'#FB6900', glyph:'flame' },
    { id:'focus',       name:'Focus',       c:'#22C7B8', glyph:'target' },
    { id:'wisdom',      name:'Wisdom',      c:'#A855F7', glyph:'brain' }
  ];

  /* small line glyphs, so an attribute reads at a glance the way the tiles do */
  const GLYPHS = {
    barbell:'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
    run:'M13 4.5a1.4 1.4 0 1 0 0-.1M11 21l1.5-5.5L9 13l1-5 4 2 3 1M8.5 21l2-4',
    flame:'M12 3c3 4 5 5.5 5 9a5 5 0 0 1-10 0c0-2 1-3.2 2-4.6.6 1.2 1.2 1.8 2 2 0-2.4.8-4.4 1-6.4z',
    target:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    brain:'M9 5a3 3 0 0 0-3 3 2.6 2.6 0 0 0-.5 5A3 3 0 0 0 9 19h6a3 3 0 0 0 3.5-6 2.6 2.6 0 0 0-.5-5 3 3 0 0 0-3-3zM12 5v14',
    shield:'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
    book:'M4 4.5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 4.5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z',
    camera:'M2.5 7h12v10h-12zM14.5 11l6-3v8l-6-3z',
    money:'M12 3v18M8 7.5h6a2.5 2.5 0 0 1 0 5h-4a2.5 2.5 0 0 0 0 5h6'
  };
  const glyph = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${
    GLYPHS[k] || GLYPHS.target}"/></svg>`;

  const uid = () => 'at_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  async function attributes(){
    let mine = [];
    try { const { values } = await Store.all('rating'); mine = values; }
    catch(e){ mine = []; }
    if(mine.length) return mine.sort((a,b) => (a.order || 0) - (b.order || 0));

    /* nothing set up yet: the five above, with no rules until you write them */
    return SHIPPED.map((a, i) => ({ ...a, order:i, base:BASE, rules:[] }));
  }

  async function save(attr){
    const a = { ...attr };
    if(!a.id) a.id = uid();
    if(!a.rules) a.rules = [];
    await Store.put('rating', a);
    return a;
  }
  async function remove(id){ await Store.del('rating', id); }

  /* seed the store so the shipped five can be edited like any other */
  async function ensure(){
    const { values } = await Store.all('rating').catch(() => ({ values:[] }));
    if(values.length) return values;
    for(const [i, a] of SHIPPED.entries())
      await Store.put('rating', { ...a, order:i, base:BASE, rules:[] });
    return (await Store.all('rating')).values;
  }

  /* ---- scoring ---- */

  function scoreOne(attr, snap){
    const rules = attr.rules || [];
    const met = rules.filter(r => Metrics.met(snap, r));
    /* base points for clearing the bar, plus whatever the scale adds for going
       further past it */
    const points = met.reduce((n, r) => n + (+r.points || 0) + Metrics.bonus(snap, r), 0);
    const base = typeof attr.base === 'number' ? attr.base : BASE;
    return {
      id: attr.id, name: attr.name, c: attr.c, glyph: attr.glyph || 'target', base,
      score: Math.min(CEILING, base + points),
      points,
      met: met.length, of: rules.length,
      rules: rules.map(r => ({ ...r, met: Metrics.met(snap, r), now: Metrics.valueOf(snap, r),
                               earned: (Metrics.met(snap, r) ? (+r.points || 0) : 0) + Metrics.bonus(snap, r) }))
    };
  }

  async function state(){
    const [attrs, snap] = await Promise.all([attributes(), Metrics.snapshot()]);
    const rows = attrs.map(a => scoreOne(a, snap));
    const first = await baseline(rows);
    rows.forEach(r => {
      const was = first[r.id];
      r.was = typeof was === 'number' ? was : r.score;
      r.delta = r.score - r.was;
    });
    const total = rows.reduce((n, r) => n + r.points, 0);

    /* The headline is just your strongest attribute, named. No personality
       typing — it reads off the same numbers you can see under it. */
    const top = rows.slice().sort((a, b) => b.score - a.score)[0];
    const earned = rows.filter(r => r.met > 0).length;
    const headline = top && top.points > 0 ? top.name.toUpperCase() : 'UNWRITTEN';
    const blurb = !top || !top.points
      ? 'No rules are earning yet. Add one and this starts reading off your own work.'
      : `${top.name} is carrying you at ${top.score}. ${
          earned > 1 ? `${earned} attributes are moving.` : 'One attribute is moving so far.'}`;

    let day = 1;
    try { day = await Data.currentDay(); } catch(e){ day = 1; }

    return { rows, total, snap, headline, blurb, day };
  }

  /* The first reading is kept so the arrows mean something. It is written once
     and never rewritten, except by a reset. */
  async function baseline(rows){
    let stored = null;
    try { stored = await Store.get('settings', 'rating-day1'); } catch(e){ stored = null; }
    if(stored && stored.scores) return stored.scores;

    const scores = Object.fromEntries(rows.map(r => [r.id, r.score]));
    try { await Store.put('settings', { at:Date.now(), scores }, 'rating-day1'); } catch(e){}
    return scores;
  }

  /* Which rules were already met last time we looked. Comparing against it is
     how a boost knows it just happened rather than having been true all along. */
  const ruleKey = (attr, r) => attr.id + '|' + r.metric + '|' + (r.lift || '') + '|' +
    (r.reps || '') + '|' + r.value;

  async function newlyMet(){
    const [attrs, snap] = await Promise.all([attributes(), Metrics.snapshot()]);

    let seen = [];
    try { seen = (await Store.get('settings', 'rating-met')) || []; } catch(e){ seen = []; }
    const had = new Set(seen);

    const now = [], fresh = [];
    attrs.forEach(a => {
      (a.rules || []).forEach(r => {
        if(!Metrics.met(snap, r)) return;
        const k = ruleKey(a, r);
        now.push(k);
        if(!had.has(k)) fresh.push({
          attr:a.name, colour:a.c, points:(+r.points || 0) + Metrics.bonus(snap, r),
          rule:Metrics.describe(r), score:scoreOne(a, snap).score
        });
      });
    });

    try { await Store.put('settings', now, 'rating-met'); } catch(e){}
    return fresh;
  }

  /* On a fresh install everything already true would pop at once. Called once
     to write the baseline quietly. */
  async function primeMet(){
    const [attrs, snap] = await Promise.all([attributes(), Metrics.snapshot()]);
    const now = [];
    attrs.forEach(a => (a.rules || []).forEach(r => {
      if(Metrics.met(snap, r)) now.push(ruleKey(a, r));
    }));
    try { await Store.put('settings', now, 'rating-met'); } catch(e){}
    return now.length;
  }

  async function reset(){
    try { await Store.del('settings', 'rating-day1'); } catch(e){}
  }

  async function day1(){
    try { return await Store.get('settings', 'rating-day1'); } catch(e){ return null; }
  }

  global.Rating = { attributes, save, remove, ensure, state, reset, day1,
                    newlyMet, primeMet, scoreOne, glyph, GLYPHS, SHIPPED, BASE, CEILING };
})(window);
