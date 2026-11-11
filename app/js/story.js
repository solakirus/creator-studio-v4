/* Structure for a weekly vlog.

   A week of footage is not a film. What turns one into the other is a spine:
   a question asked early, complications that make it hard, and an answer that
   costs something. These are the tools for laying that out before you shoot,
   so the edit has something to cut toward. */
(function(global){

  /* What a beat is doing. Naming the job stops every beat becoming "stuff that
     happened on Tuesday". */
  const FUNCTIONS = [
    { id:'hook',       n:'Hook',        c:'#FB6900', d:'Stops the scroll. Often a moment from later.' },
    { id:'promise',    n:'Promise',     c:'#E8A33D', d:'What this episode is going to be about.' },
    { id:'setup',      n:'Setup',       c:'#5B62A8', d:'What we need to know for the rest to land.' },
    { id:'inciting',   n:'Inciting',    c:'#C4613A', d:'The thing that starts the week properly.' },
    { id:'rising',     n:'Rising',      c:'#A8506E', d:'It gets harder, or more interesting.' },
    { id:'complication',n:'Complication',c:'#E2564A',d:'It goes wrong. This is the part people watch for.' },
    { id:'turn',       n:'Turn',        c:'#7B4FA8', d:'The realisation, decision, or change of approach.' },
    { id:'payoff',     n:'Payoff',      c:'#5BBE6A', d:'The promise delivered.' },
    { id:'reflection', n:'Reflection',  c:'#3F6FA0', d:'What it meant. Short, or it drags.' },
    { id:'button',     n:'Button',      c:'#22C7B8', d:'The last beat. A laugh, a tease, a door closing.' },
    { id:'breather',   n:'Breather',    c:'#8A6A2F', d:'A quiet moment so the next hit lands.' }
  ];
  const fn = id => FUNCTIONS.find(f => f.id === id) || null;

  /* Shapes a week can take. Each is a spine of acts and the beats that carry
     their function — a starting point to cut against, not a rule. */
  const SHAPES = [
    { id:'classic', n:'Cinematic week', d:'Cold open, a build, something goes wrong, a payoff.',
      acts:[
        { title:'Cold open', beats:[
          ['Pull a moment from Thursday', 'hook'],
          ['Say what the week is for', 'promise'] ] },
        { title:'Act I — The plan', beats:[
          ['Where things stand on Monday', 'setup'],
          ['The thing that kicks it off', 'inciting'] ] },
        { title:'Act II — The work', beats:[
          ['Getting into it', 'rising'],
          ['The part that does not go to plan', 'complication'],
          ['Quiet moment', 'breather'] ] },
        { title:'Act III — The turn', beats:[
          ['Working out what to do instead', 'turn'],
          ['It comes together', 'payoff'] ] },
        { title:'Outro', beats:[
          ['What it actually cost', 'reflection'],
          ['Sign-off with a tease', 'button'] ] }
      ] },

    { id:'build', n:'Build and reveal', d:'For a project week — a thing exists by Friday that did not on Monday.',
      acts:[
        { title:'Cold open', beats:[
          ['The finished thing, three seconds of it', 'hook'],
          ['Rewind: here is what we started with', 'promise'] ] },
        { title:'The state of things', beats:[
          ['Why this needs doing', 'setup'],
          ['What could go wrong', 'rising'] ] },
        { title:'The build', beats:[
          ['First real progress', 'rising'],
          ['The setback', 'complication'],
          ['The fix', 'turn'] ] },
        { title:'The reveal', beats:[
          ['It works', 'payoff'],
          ['Honest verdict', 'reflection'],
          ['What is next', 'button'] ] }
      ] },

    { id:'question', n:'One question', d:'Ask something in the first ten seconds and spend the week answering it.',
      acts:[
        { title:'The question', beats:[
          ['Ask it plainly', 'hook'],
          ['Why it is worth asking', 'promise'] ] },
        { title:'Looking for the answer', beats:[
          ['First attempt', 'setup'],
          ['That did not work', 'complication'],
          ['A better idea', 'turn'] ] },
        { title:'The answer', beats:[
          ['Here is what I found', 'payoff'],
          ['What surprised me', 'reflection'],
          ['Over to you', 'button'] ] }
      ] },

    { id:'daybyday', n:'Day by day', d:'A straight week. Keep the function tags so it still has a shape.',
      /* Sunday first, and a full seven — a vlog week runs Sunday to Saturday,
         and lumping two days into "Weekend" loses one of them. */
      acts:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => ({
        title:d,
        /* a day is a container; these are the sequences inside it, to rename */
        beats:[1,2,3].map(n => [`Sequence ${n}`,
          i === 0 ? 'setup' : i === 4 ? 'complication' : i === 6 ? 'payoff' : 'rising'])
      })) }
  ];

  /* Does this episode have a spine, or is it a pile of footage?
     Weighted so the things that make people watch matter most. */
  function check(ep){
    const beats = (ep.acts || []).flatMap(a => a.beats || []);
    const has = id => beats.some(b => b.fn === id);
    const gaps = [];

    if(!ep.premise || !ep.premise.trim())
      gaps.push({ k:'premise', t:'No through-line — what is this week about?', w:3 });
    if(!has('hook'))
      gaps.push({ k:'hook', t:'Nothing marked as the hook', w:3 });
    if(!ep.question || !ep.question.trim())
      gaps.push({ k:'question', t:'No question for the viewer to want answered', w:2 });
    if(!has('promise'))
      gaps.push({ k:'promise', t:'Nothing promises what the episode delivers', w:2 });
    if(!has('complication'))
      gaps.push({ k:'complication', t:'No complication — nothing goes wrong', w:3 });
    if(!has('payoff'))
      gaps.push({ k:'payoff', t:'No payoff — the promise is never delivered', w:3 });
    if(!has('button'))
      gaps.push({ k:'button', t:'No ending beat', w:1 });
    if(beats.length && beats.filter(b => !b.fn).length > beats.length / 2)
      gaps.push({ k:'fns', t:'Most beats have no job yet', w:2 });
    if(beats.length && !beats.some(b => (b.shots || []).length))
      gaps.push({ k:'shots', t:'No shots planned against any beat', w:2 });

    const total = 21;
    const lost = gaps.reduce((a,g) => a + g.w, 0);
    return { gaps, score: Math.max(0, Math.round(((total - lost) / total) * 100)) };
  }

  /* The emotional shape, as a number per beat, so it can be drawn.
     Rough on purpose — the point is seeing a flat line, not precision. */
  const LEVEL = {
    hook:0.8, promise:0.5, setup:0.3, inciting:0.55, rising:0.65,
    complication:0.95, turn:0.7, payoff:0.9, reflection:0.4, button:0.55, breather:0.2
  };
  function arc(ep){
    return (ep.acts || []).flatMap(a =>
      (a.beats || []).map(b => ({
        title: b.title, act: a.title,
        fn: b.fn || null,
        level: b.fn && LEVEL[b.fn] !== undefined ? LEVEL[b.fn] : 0.35
      })));
  }

  /* Applying a shape to an episode, keeping anything already written. */
  function applyShape(shapeId, uid){
    const shape = SHAPES.find(s => s.id === shapeId);
    if(!shape) return null;
    return shape.acts.map(a => ({
      id: uid('a'), title: a.title, day: null, open: true,
      beats: a.beats.map(([title, f]) => ({
        id: uid('b'), title, fn: f, purpose: (fn(f) || {}).d || '', shots: []
      }))
    }));
  }

  global.Story = { FUNCTIONS, SHAPES, fn, check, arc, applyShape, LEVEL };
})(window);
