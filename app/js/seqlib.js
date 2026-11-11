/* Sequence templates.

   The same sequences come back every week — a talking-head block is always the
   same three setups, a gym session is always the same six. Typing them out each
   time is the tax that makes weekly planning expensive, so a template is a named
   sequence with its shots already in it, dropped into a day in one tap.

   Distinct from the quarter's week template, which decides what a *week* starts
   with. This is the shape of one sequence, reusable anywhere. */
(function(global){

  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  /* Enough to be useful on day one, all of them editable and deletable. */
  const BUILT_IN = [
    { id:'sq_talking', name:'Talking head block', setup:'talking',
      purpose:'Carry the idea in your own words',
      shots:['Wide, sat down', 'Punch-in for the key line', 'Cutaway — hands or notes'] },

    { id:'sq_intro', name:'Cold open', setup:'phone',
      purpose:'Earn the next ten seconds',
      shots:['The moment itself, no setup', 'Reaction', 'Title card beat'] },

    { id:'sq_gym', name:'Training session', setup:'location',
      purpose:'Show the work, not just the result',
      shots:['Walk in, establishing', 'Working set, side on', 'Close on the weight',
             'Face between sets', 'Leaving, the state you are in'] },

    { id:'sq_build', name:'Build or repair', setup:'location',
      purpose:'Show the effort the result hides',
      shots:['Before, wide', 'Hands on the work', 'Detail of the hard part',
             'Timelapse of the middle', 'Reveal'] },

    { id:'sq_daily', name:'Day in the life beat', setup:'phone',
      purpose:'Move the week forward',
      shots:['Where you are', 'What you are doing', 'One line to camera'] },

    { id:'sq_explain', name:'Screen explainer', setup:'screen',
      purpose:'Show the thing you are talking about',
      shots:['Full screen recording', 'Zoom on the part that matters', 'You reacting to it'] }
  ];

  let cache = null;
  const invalidate = () => cache = null;

  /* Stored templates are edits and additions layered over the built-ins, so a
     built-in you never touch is not copied into the database. */
  async function all(){
    if(cache) return cache;
    let mine = {};
    try { mine = await Store.allMap('seq-template'); } catch(e){ mine = {}; }

    const merged = BUILT_IN
      .map(t => mine[t.id] ? { ...t, ...mine[t.id] } : t)
      .filter(t => !t.hidden);

    Object.values(mine).forEach(t => {
      if(!BUILT_IN.some(b => b.id === t.id) && !t.hidden) merged.push(t);
    });

    cache = merged;
    return cache;
  }

  async function get(id){ return (await all()).find(t => t.id === id) || null; }

  async function save(rec){
    const t = { ...rec };
    if(!t.id) t.id = uid('sq_');
    t.name = (t.name || '').trim() || 'Untitled sequence';
    t.shots = (t.shots || []).map(x => String(x).trim()).filter(Boolean);
    await Store.put('seq-template', t, t.id);
    invalidate();
    return t;
  }

  /* A built-in cannot be deleted outright — it is not in the database to delete.
     Hiding it keeps the list yours without losing the original. */
  async function remove(id){
    if(BUILT_IN.some(b => b.id === id)) await Store.put('seq-template', { id, hidden:true }, id);
    else await Store.del('seq-template', id);
    invalidate();
  }

  async function restore(id){
    try { await Store.del('seq-template', id); } catch(e){}
    invalidate();
  }

  /* What a template becomes once it is in a day. */
  function toSequence(t, day){
    return {
      id: uid('b'),
      title: t.name,
      purpose: t.purpose || '',
      setup: t.setup || 'talking',
      script: '',
      sourceId: null,
      shots: (t.shots || []).map(text => ({ id: uid('s'), text, done:false })),
      day: day || null, at:null, done:false, clipId:null
    };
  }

  /* The other direction: a sequence you have already built, kept for next time. */
  function fromSequence(b){
    return {
      name: b.title || 'Untitled sequence',
      setup: b.setup || 'talking',
      purpose: b.purpose || '',
      shots: (b.shots || []).map(s => s.text || s.name || String(s)).filter(Boolean)
    };
  }

  global.SeqLib = { BUILT_IN, all, get, save, remove, restore, invalidate,
                    toSequence, fromSequence };
})(window);
