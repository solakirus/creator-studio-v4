/* The marketing layer on a clip: the decisions that decide whether it works,
   made before the camera comes out rather than after it flops. */
(function(global){

  /* Why this exists. A video with no job is the most common reason one fails. */
  const PURPOSE = [
    { v:'reach',  n:'Reach',   d:'Get in front of people who have never seen you' },
    { v:'trust',  n:'Trust',   d:'Prove you know the thing — for people already watching' },
    { v:'convert',n:'Convert', d:'Move someone toward a link, product or list' },
    { v:'test',   n:'Test',    d:'Try a format or idea cheaply and read the result' }
  ];

  /* What the viewer gets out of it. Most pieces are one of these. */
  const TYPE = [
    { v:'educate',   n:'Educate',   d:'They leave able to do something' },
    { v:'entertain', n:'Entertain', d:'They leave having enjoyed it' },
    { v:'inspire',   n:'Inspire',   d:'They leave wanting to act' },
    { v:'inform',    n:'Inform',    d:'They leave knowing what happened' }
  ];

  /* How the first three seconds work. */
  const HOOK = [
    { v:'result',   n:'Result first', d:'Show the finished thing, then rewind' },
    { v:'claim',    n:'Bold claim',   d:'Say something they want to argue with' },
    { v:'question', n:'Question',     d:'Name the thing they already wonder' },
    { v:'problem',  n:'Problem',      d:'Show the pain before the fix' },
    { v:'visual',   n:'Visual',       d:'A shot strange enough to stop a thumb' }
  ];

  /* What you want at the end. One only — two asks gets you neither. */
  const CTA = [
    { v:'follow',  n:'Follow',     d:'For more of this specific thing' },
    { v:'comment', n:'Comment',    d:'Ask something they have an opinion about' },
    { v:'next',    n:'Watch next', d:'Point at one specific video' },
    { v:'link',    n:'Link',       d:'Somewhere off-platform' },
    { v:'none',    n:'Nothing',    d:'Let it end clean — valid for reach pieces' }
  ];

  /* Retention devices. Naming one makes you actually build it in. */
  const RETAIN = [
    { v:'loop',    n:'Open loop',     d:'Ask early, answer late' },
    { v:'stakes',  n:'Stakes',        d:'Say what happens if it goes wrong' },
    { v:'pace',    n:'Hard cuts',     d:'No shot outstays its welcome' },
    { v:'reveal',  n:'Held reveal',   d:'The good bit is not at the start' },
    { v:'list',    n:'Numbered list', d:'They stay to see number one' }
  ];

  /* What "it worked" means, decided before you can rationalise it after. */
  const METRIC = [
    { v:'retention', n:'Retention',  d:'Held past the first third' },
    { v:'views',     n:'Views',      d:'Reached beyond your usual' },
    { v:'comments',  n:'Comments',   d:'People had something to say' },
    { v:'saves',     n:'Saves',      d:'Worth coming back to' },
    { v:'clicks',    n:'Clicks',     d:'They went where you pointed' }
  ];

  const SETS = { purpose:PURPOSE, type:TYPE, hookStyle:HOOK, ctaType:CTA, retain:RETAIN, metric:METRIC };

  /* What is missing, in the order it costs you the most. */
  function gaps(plan){
    const p = plan || {};
    const out = [];
    if(!p.hook || !p.hook.trim())      out.push({ k:'hook',    t:'No hook written', w:3 });
    if(!p.promise || !p.promise.trim())out.push({ k:'promise', t:'No promise — what do they get?', w:3 });
    if(!p.purpose)                     out.push({ k:'purpose', t:'No purpose set', w:2 });
    if(!p.audience || !p.audience.trim()) out.push({ k:'audience', t:'No one specific in mind', w:2 });
    if(!(p.beats || []).filter(b => b.trim()).length) out.push({ k:'beats', t:'No flow yet', w:2 });
    if(!p.hookStyle)                   out.push({ k:'hookStyle', t:'Hook style not chosen', w:1 });
    if(!p.retain)                      out.push({ k:'retain', t:'Nothing holding the middle', w:2 });
    if(!p.ctaType)                     out.push({ k:'ctaType', t:'No call to action decided', w:1 });
    if(!(p.titles || []).filter(t => t.trim()).length) out.push({ k:'titles', t:'No title options', w:1 });
    if(!p.thumb || !p.thumb.trim())    out.push({ k:'thumb', t:'No thumbnail idea', w:1 });
    if(!p.metric)                      out.push({ k:'metric', t:'No way to tell if it worked', w:1 });
    return out;
  }

  /* A readiness read, weighted so the hook counts for more than hashtags. */
  function readiness(plan){
    const total = 20;
    const lost = gaps(plan).reduce((a, g) => a + g.w, 0);
    return Math.max(0, Math.round(((total - lost) / total) * 100));
  }

  const label = (set, v) => {
    const s = SETS[set] || [];
    const hit = s.find(x => x.v === v);
    return hit ? hit.n : null;
  };

  global.ClipCraft = { PURPOSE, TYPE, HOOK, CTA, RETAIN, METRIC, SETS, gaps, readiness, label };
})(window);
