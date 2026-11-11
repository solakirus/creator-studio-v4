/* Clip ideas — the laptop Planner's AI clip studio, on your own channels.

   Ideas that are about YOUR channel, not the topic: every prompt carries the
   channel's about / audience / voice, its series, every clip title already on
   it (so nothing repeats), and what is actually on your days for the next
   three weeks. Pitch angles for a request, or let it suggest; keep the good
   ones in a backlog; any of them drafts a whole clip — plan, hook, flow,
   script — that lands in Clips ready to shoot. A clip that already exists can
   have its empty plan fields drafted too (nothing you wrote is replaced).

   Asks through ShotAI.askText: your key, or a pasted chat answer. */
(function(global){

  const KEY = 'clip-ideas';
  const sid = () => 'idea_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const str = (v, n) => String(v == null ? '' : v).slice(0, n || 4000);
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  async function saved(){ try { return (await Store.get('settings', KEY)) || []; } catch(e){ return []; } }
  async function setSaved(list){ await Store.put('settings', list, KEY); }
  async function keep(idea){ const l = await saved(); l.unshift({ ...idea, id: idea.id || sid(), savedAt: Date.now() }); await setSaved(l); }
  async function drop(id){ await setSaved((await saved()).filter(x => x.id !== id)); }

  /* ---------------------------------------------------------- context */

  async function channelContext(name){
    const [chs, series, clips, ideas] = await Promise.all([Channels.all(), Data.series(), Data.clips(), saved()]);
    const ch = chs.find(c => norm(c.n) === norm(name)) || { n: name };
    const mySeries = series.filter(s => norm(s.channel) === norm(ch.n)).map(s => s.title).filter(Boolean);
    const titles = clips.filter(c => norm(c.channel) === norm(ch.n)).map(c => c.title).filter(Boolean).slice(-40);
    const kept = ideas.filter(x => norm(x.channel) === norm(ch.n)).map(x => x.title).slice(-30);
    return `CHANNEL: ${ch.n}
What it is about: ${ch.about || '(not written)'}
Who watches: ${ch.who || '(not written)'}
Voice: ${ch.voice || '(not written)'}
Series on it: ${mySeries.length ? mySeries.join('; ') : 'none (one-offs only)'}
Already planned or posted here (never repeat or near-repeat): ${titles.join(' | ') || 'none'}
Already saved as ideas: ${kept.join(' | ') || 'none'}`;
  }

  async function lifeContext(){
    let tasks = [], vlogs = [], today = 1;
    try { [tasks, today] = await Promise.all([Data.tasks(), Data.currentDay()]); vlogs = (await Store.all('vlogs')).values; } catch(e){}
    const soon = tasks.filter(t => t.day >= today && t.day <= today + 20).sort((a, b) => a.day - b.day)
      .map(t => `Day ${t.day} ${t.kind || 'task'}: ${t.title}`);
    const eps = vlogs.filter(v => v.title).slice(-4).map(v => `Episode "${v.title}"${v.premise ? ' — ' + v.premise : ''}`);
    return `WHAT IS ACTUALLY HAPPENING IN THE CREATOR'S LIFE (next 3 weeks):
${[...eps, ...soon].slice(0, 40).join('\n') || '(nothing planned yet — draw only on the channel)'}`;
  }

  const RULES = `RULES FOR EVERY IDEA:
- Hyper-specific to THIS channel and this creator's real life. If any channel on the topic could make it, it fails — drop it.
- Grounded in something the creator actually does, owns, knows or is going through. Prefer ideas tied to the next 3 weeks.
- Never repeat an existing title or idea.
- Score each idea's specificity 1-10 honestly (10 = could only exist on this channel). Only return ideas scoring 7+.`;

  const ids = k => JSON.stringify(((global.ClipCraft && ClipCraft.SETS[k]) || []).map(o => o.v));

  async function pitchPrompt(o){
    const chs = await Channels.all();
    const names = o.channel ? [o.channel] : chs.map(c => c.n).filter(n => !/^new channel$/i.test(n)).slice(0, 4);
    const ctx = (await Promise.all(names.map(channelContext))).join('\n\n');
    return `You are the content strategist for a multi-channel creator. ${o.suggest
      ? 'Proactively suggest what he should make next.' : 'Pitch video angles for the request below.'}

${ctx}

${await lifeContext()}

${o.suggest ? `TASK: Suggest ${o.count || 6} ideas across ${names.length > 1 ? 'these channels' : 'this channel'}, each a different angle. Favour series with little planned and things happening in the next 3 weeks.`
  : `REQUEST:
- Channel: ${o.channel}
- Series: ${o.series || 'any, or a one-off'}
${o.topic ? `- His idea / topic: "${o.topic}" — sharpen THIS into angles that fit the channel; if it can't fit, say so in "why".` : ''}
TASK: Pitch ${o.count || 5} distinct angles.`}

${RULES}

Reply with ONLY a JSON array, no prose, no code fences. Each item:
{"title": working title, "angle": 1-2 sentences on exactly what the video is,
 "channel": exact channel name, "series": exact series name or "",
 "hook": the opening line or shot, "why": one line on why this, why now, "specificity": 1-10}`;
  }

  async function draftPrompt(idea){
    return `You are the content strategist and scriptwriter for this creator. Develop ONE video idea into a complete, shoot-ready clip plan.

${await channelContext(idea.channel || '')}

${await lifeContext()}

THE IDEA:
Title: ${idea.title}
${idea.angle ? 'Angle: ' + idea.angle : ''}
Series: ${idea.series || 'one-off'}
${idea.hook ? 'Hook idea: ' + idea.hook : ''}
${idea.notes ? 'What he has so far: ' + idea.notes : ''}

${RULES}
- Write in the channel's voice. Specific beats from his real life, not generic advice.

Reply with ONLY one JSON object, no prose, no code fences:
{"title": string, "titles": [3 title options, each under 70 characters],
 "purpose": one of ${ids('purpose')}, "contentType": one of ${ids('type')},
 "audience": string, "promise": string, "payoff": string,
 "hookStyle": one of ${ids('hookStyle')}, "hook": the first 3 seconds,
 "beats": [4-8 flow beats in order — each one thing the camera sees], "retain": one of ${ids('retain')},
 "ctaType": one of ${ids('ctaType')}, "cta": exactly what he says,
 "thumb": thumbnail idea, "keywords": comma-separated search phrases,
 "metric": one of ${ids('metric')}, "length": one of ["short","mid","long"],
 "script": full spoken script in his voice, "caption": string, "tags": "#tag #tag"}`;
  }

  /* ---------------------------------------------------------- answers */

  function jsonFrom(text, open, close){
    const raw = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '');
    const a = raw.indexOf(open), b = raw.lastIndexOf(close);
    if(a < 0 || b < a) throw new Error('No answer in the expected shape.');
    try { return JSON.parse(raw.slice(a, b + 1)); } catch(e){ throw new Error('That answer was not valid JSON.'); }
  }
  async function parseIdeas(text, fallbackChannel){
    const arr = jsonFrom(text, '[', ']');
    if(!Array.isArray(arr)) throw new Error('Expected a list of ideas.');
    const known = (await Channels.all()).map(c => c.n);
    return arr.filter(x => x && x.title).map(x => ({
      id: sid(), title: str(x.title, 100), angle: str(x.angle, 400),
      channel: known.find(n => norm(n) === norm(x.channel)) || fallbackChannel || '',
      series: str(x.series, 80), hook: str(x.hook, 240), why: str(x.why, 240),
      specificity: Math.max(0, Math.min(10, +x.specificity || 0))
    })).filter(x => !x.specificity || x.specificity >= 6).slice(0, 10);
  }
  function parseDraft(text){
    const o = jsonFrom(text, '{', '}');
    const pick = (set, v) => global.ClipCraft && ClipCraft.SETS[set] && ClipCraft.SETS[set].some(x => x.v === v) ? v : '';
    const titles = (Array.isArray(o.titles) ? o.titles : []).map(t => str(t, 100)).slice(0, 3);
    while(titles.length < 3) titles.push('');
    return { title: str(o.title || titles[0], 120), plan: {
      titles, purpose: pick('purpose', o.purpose), type: pick('type', o.contentType),
      audience: str(o.audience), promise: str(o.promise), payoff: str(o.payoff),
      hookStyle: pick('hookStyle', o.hookStyle), hook: str(o.hook),
      beats: (Array.isArray(o.beats) ? o.beats : []).map(b => str(b, 300)).filter(Boolean).slice(0, 12),
      retain: pick('retain', o.retain), ctaType: pick('ctaType', o.ctaType), cta: str(o.cta),
      thumb: str(o.thumb), keywords: str(o.keywords), metric: pick('metric', o.metric),
      length: ['short', 'mid', 'long'].includes(o.length) ? o.length : 'short',
      script: str(o.script, 20000), caption: str(o.caption), tags: str(o.tags) } };
  }

  /* ---------------------------------------------------------- doing it */

  async function pitch(o){
    const text = await ShotAI.askText(await pitchPrompt(o), o.suggest ? 'Suggesting ideas…' : 'Pitching angles…', 3000);
    if(!text) return null;
    return parseIdeas(text, o.channel);
  }

  /* An idea becomes a clip in Clips, plan filled in, at the idea stage. */
  async function draftToClip(idea){
    const text = await ShotAI.askText(await draftPrompt(idea), 'Drafting the clip…', 8000);
    if(!text) return null;
    const d = parseDraft(text);
    const series = (await Data.series()).find(s => norm(s.title) === norm(idea.series));
    const clip = await Data.saveClip({ title: d.title || idea.title, channel: idea.channel || '', seriesId: series ? series.id : null,
      plat: 'youtube', stage: 'idea', createdAt: Date.now(), plan: d.plan });
    return clip;
  }

  /* An existing clip: fill what is empty, keep what is written. */
  async function draftInto(clip){
    const p = clip.plan || {};
    const have = ['hook', 'promise', 'audience', 'cta', 'script'].filter(k => String(p[k] || '').trim()).map(k => `${k}: ${p[k]}`);
    if((p.beats || []).filter(Boolean).length) have.push('flow: ' + p.beats.filter(Boolean).join(' / '));
    const text = await ShotAI.askText(await draftPrompt({ title: clip.title, channel: clip.channel, notes: have.join('\n') }), 'Drafting the plan…', 8000);
    if(!text) return null;
    const d = parseDraft(text);
    const filled = [];
    const next = { ...p };
    Object.entries(d.plan).forEach(([k, v]) => {
      const empty = Array.isArray(next[k]) ? !next[k].filter(x => String(x || '').trim()).length : !String(next[k] || '').trim();
      const hasNew = Array.isArray(v) ? v.filter(Boolean).length : String(v || '').trim();
      if(empty && hasNew){ next[k] = v; filled.push(k); }
    });
    return { plan: next, filled };
  }

  global.ClipIdeas = { saved, keep, drop, pitch, draftToClip, draftInto, pitchPrompt, draftPrompt, parseIdeas, parseDraft };
})(window);
