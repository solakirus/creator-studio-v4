/* Versions — one shoot, many posts.

   A clip can hold a checklist of versions cut from the same footage: the
   original, a tutorial voiceover, a story voiceover, an ASMR cut, a carousel…
   Each version moves todo → edited → posted, and the clip shows how far the
   whole concept has got without putting a task for every version in Today.

   Templates fill the checklist in one tap. The built-ins come from the
   "one shoot, ten posts" idea; your own are saved in settings. */
(function(global){

  const PLATS = [
    { k:'ig', n:'IG' },
    { k:'yt', n:'Shorts' },
    { k:'tt', n:'TikTok' }
  ];

  /* g: what to do with the footage.  shoot: what the shoot has to capture for
     this version to be possible later.  repeat: fine to have several. */
  const FORMATS = {
    original: { n:'Original', icon:'🎬',
      g:'The aesthetic cut. Quick cuts paired to music, no talking. This is the version the others are built from.' },
    tutorial: { n:'Tutorial', icon:'🎓',
      g:'Same footage. Swap the music for a voiceover that teaches one thing, step by step. The footage becomes the demo.',
      shoot:'Film every step clearly and in order' },
    story:    { n:'Story', icon:'🗣️',
      g:'Same footage, new voiceover. Tell a personal story or reflection your audience can see themselves in.' },
    asmr:     { n:'ASMR', icon:'🎧',
      g:'Go through the raw footage for the best natural sounds and build the cut around them. No music, no voice.',
      shoot:'Record clean sound — mic close, no music playing' },
    carousel: { n:'Carousel', icon:'🖼️',
      g:'Screenshot the key moments and turn them into slides. Pull the slide text from the tutorial or story voiceover.',
      shoot:'Hold still on the key moments so the frames grab clean' },
    bloopers: { n:'Bloopers', icon:'😅',
      g:'The raw mistakes. People love seeing the unpolished side.',
      shoot:'Keep recording through mistakes' },
    bts:      { n:'Behind the scenes', icon:'🎥',
      g:'The relatable creator moments — the awkward second before you start talking, the retakes. People like backing someone who is still figuring it out.',
      shoot:'Start rolling before you are ready and keep the retakes' },
    snippet:  { n:'Aesthetic clip + quote', icon:'✨', repeat:true,
      g:'Your most aesthetic 6–7 seconds with a motivational quote or text on screen. A vlog usually has several of these — make one per moment.' },
    vs:       { n:'Final vs attempts', icon:'🎯',
      g:'Show the shot you were going for, then the failed attempts and bloopers that led to it.',
      shoot:'Keep every failed attempt' },
    custom:   { n:'Custom', icon:'➕', repeat:true, g:'' }
  };

  const BUILTIN = [
    { id:'roll10', n:'Camera roll ×10', d:'One shoot, ten posts — every version in the idea',
      f:['original','tutorial','story','asmr','carousel','bloopers','bts','snippet','snippet','vs'] },
    { id:'duo',    n:'Voiceover pair', d:'Original plus a tutorial and a story voiceover',
      f:['original','tutorial','story'] },
    { id:'raw',    n:'Raw extras', d:'Squeeze the leftovers — bloopers, BTS, final vs attempts',
      f:['bloopers','bts','vs'] },
    { id:'snips',  n:'Aesthetic pack', d:'Three short quote clips from the best moments',
      f:['snippet','snippet','snippet'] }
  ];

  const KEY = 'version-templates';
  async function customTemplates(){
    try { return (await Store.get('settings', KEY)) || []; } catch(e){ return []; }
  }
  async function saveCustomTemplates(list){ await Store.put('settings', list, KEY); }
  async function templates(){ return BUILTIN.concat(await customTemplates()); }

  const vid = () => 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

  /* A new version. Repeats get numbered so "Aesthetic clip + quote 2" is
     distinguishable from the first. */
  function make(f, list, name){
    const fmt = FORMATS[f] || FORMATS.custom;
    let n = name || fmt.n;
    if(!name && list){
      const same = list.filter(v => v.f === f).length;
      if(same) n = `${fmt.n} ${same + 1}`;
    }
    return { id:vid(), f, name:n, note:'', state:'todo', plats:PLATS.map(p => p.k), swipeId:null };
  }

  function fromTemplate(t, list){
    const out = list || [];
    (t.f || []).forEach((f, i) => {
      out.push(make(f, out, t.names && t.names[i] ? t.names[i] : null));
    });
    return out;
  }

  function progress(list){
    const total = (list || []).length;
    const posted = list.filter(v => v.state === 'posted').length;
    const edited = list.filter(v => v.state === 'edited' || v.state === 'posted').length;
    const posts = list.reduce((n, v) => n + (v.plats || []).length, 0);
    return { total, edited, posted, posts,
             pctEdited: total ? Math.round(edited / total * 100) : 0,
             pctPosted: total ? Math.round(posted / total * 100) : 0 };
  }

  const NEXT = { todo:'edited', edited:'posted', posted:'todo' };
  const cycle = s => NEXT[s] || 'edited';

  /* What the shoot has to capture for the versions on this clip. */
  function shootNeeds(list){
    return [...new Set((list || []).map(v => (FORMATS[v.f] || {}).shoot).filter(Boolean))];
  }

  /* Which tab of the Clips list a clip sits on. The stage itself is the app's
     lifecycle (idea → planned → shot → editing → published); the four tabs are
     the jobs: plan it, shoot it, cut it, get it out. "Editing" is past the cut
     and on its way out, so it sits under Post with the published ones. */
  const STAGES = ['plan','shoot','edit','post'];
  const STAGE_NAME = { plan:'Plan', shoot:'Shoot', edit:'Edit', post:'Post' };
  const TAB_OF_STAGE = { idea:'plan', planned:'shoot', shot:'edit', editing:'post', published:'post' };
  function lifeStage(c){
    if(!c) return 'idea';
    if(c.stage) return c.stage;
    const L = global.Lifecycle;
    return (L && L.FROM_CLIP[c.state]) || 'idea';
  }
  const stageOf = c => TAB_OF_STAGE[lifeStage(c)] || 'plan';
  const isPublished = c => lifeStage(c) === 'published';

  global.Versions = { PLATS, FORMATS, BUILTIN, templates, customTemplates, saveCustomTemplates,
                      make, fromTemplate, progress, cycle, shootNeeds, STAGES, STAGE_NAME, stageOf,
                      lifeStage, isPublished };
})(window);
