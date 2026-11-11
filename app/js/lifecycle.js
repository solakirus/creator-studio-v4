/* What a clip is, and where it is in its life.

   There used to be two models for the same thing. A "clip" belonged to a series
   and moved raw → queued → posted; a "video" belonged to a channel and moved
   idea → planned → shot → editing → published. Same object, two vocabularies,
   and nothing linking them — you could make the same piece twice.

   This is the one vocabulary, and the map from both old ones. Nothing is
   rewritten on disk: records are upgraded as they are read, so an app that has
   not opened in a month still makes sense. */
(function(global){

  /* Five stages, because the two extra ones are real: an idea that is not yet
     planned, and footage that is shot but not yet cut. */
  const STAGES = [
    { k:'idea',      label:'Idea',      c:'#9AA0A6', d:'Written down, nothing planned' },
    { k:'planned',   label:'Planned',   c:'#3B9EFF', d:'Shot list ready, day set' },
    { k:'shot',      label:'Shot',      c:'#E8A33D', d:'Footage is in, not cut yet' },
    { k:'editing',   label:'Editing',   c:'#FB6900', d:'On the timeline' },
    { k:'published', label:'Published', c:'#5BBE6A', d:'Out in the world' }
  ];
  const ORDER = STAGES.map(s => s.k);
  const stage = k => STAGES.find(s => s.k === k) || STAGES[0];
  const at = k => ORDER.indexOf(k);

  /* A stage only ever moves forward. Completing a shoot task on something you
     already published should not drag it backwards. */
  const ahead = (from, to) => at(to) > at(from);

  /* the old words, in both directions */
  const FROM_CLIP = { raw:'shot', queued:'editing', posted:'published' };
  const TO_CLIP   = { idea:'raw', planned:'raw', shot:'raw', editing:'queued', published:'posted' };

  /* What finishing a task does to the piece it belongs to. */
  const ADVANCE = { shoot:'shot', edit:'editing', publish:'published' };

  /* ---- reading an old record ---- */

  /* A clip from before: state, plat, seriesId, and a plan. */
  function fromClip(c){
    if(!c) return null;
    if(c.stage) return c;                       /* already upgraded */
    const st = FROM_CLIP[c.state] || 'idea';
    return {
      ...c,
      stage: st,
      channel: c.channel || '',
      tags: c.tags || [],
      hook: (c.plan && c.plan.hook) || c.hook || '',
      shots: c.shots || [],
      /* what actually gets published, one per platform */
      cuts: c.cuts || [{
        id: (c.id || 'c') + ':cut1',
        plat: c.plat || 'youtube',
        dur: c.dur || '',
        state: st,
        postedAt: c.postedAt || null
      }]
    };
  }

  /* A video from the other model: stage, channel, tags, hook, shots. */
  function fromVideo(v){
    if(!v) return null;
    return {
      id: v.id,
      title: v.title || '',
      stage: v.stage || 'idea',
      channel: v.channel || '',
      seriesId: v.seriesId || null,
      tags: v.tags || [],
      hook: v.hook || '',
      shots: v.shots || [],
      day: v.day ?? null,
      taskId: v.taskId || null,
      plat: v.plat || 'youtube',
      dur: '',
      state: TO_CLIP[v.stage || 'idea'] || 'raw',     /* so old readers still work */
      createdAt: v.createdAt || Date.now(),
      cuts: v.cuts || [{
        id: (v.id || 'v') + ':cut1',
        plat: v.plat || 'youtube',
        dur: '',
        state: v.stage || 'idea',
        postedAt: null
      }]
    };
  }

  /* ---- writing one back ---- */

  /* Keep the old field in step, so anything still reading `state` — the publish
     queue, the month calendar — carries on working during the changeover. */
  function normalise(c){
    const out = { ...c };
    out.stage = out.stage || FROM_CLIP[out.state] || 'idea';
    out.state = TO_CLIP[out.stage] || 'raw';
    out.cuts = (out.cuts && out.cuts.length) ? out.cuts : [{
      id: (out.id || 'c') + ':cut1', plat: out.plat || 'youtube',
      dur: out.dur || '', state: out.stage, postedAt: out.postedAt || null
    }];
    return out;
  }

  /* ---- cuts ---- */

  /* One shoot, several deliverables: the long-form, the Short, the Reel. Each
     has its own platform and its own life, which is why a Short can still be
     editing while the long-form is out. */
  function addCut(c, plat){
    const cuts = (c.cuts || []).slice();
    cuts.push({ id: (c.id || 'c') + ':cut' + (cuts.length + 1),
                plat: plat || 'shorts', dur:'', state: c.stage || 'idea', postedAt:null });
    return { ...c, cuts };
  }

  const cutsOut = c => (c.cuts || []).filter(x => x.state === 'published').length;

  /* The piece is as far along as its furthest cut — you have published it if any
     version of it is out, but it is only finished when they all are. */
  function stageOf(c){
    const cuts = c.cuts || [];
    if(!cuts.length) return c.stage || 'idea';
    return cuts.reduce((m, x) => ahead(m, x.state || 'idea') ? (x.state || 'idea') : m,
                       cuts[0].state || 'idea');
  }

  function counts(list){
    const out = {};
    ORDER.forEach(k => out[k] = 0);
    (list || []).forEach(c => { const k = c.stage || 'idea'; out[k] = (out[k] || 0) + 1; });
    return out;
  }

  global.Lifecycle = { STAGES, ORDER, stage, at, ahead, ADVANCE,
                       FROM_CLIP, TO_CLIP, fromClip, fromVideo, normalise,
                       addCut, cutsOut, stageOf, counts };
})(window);
