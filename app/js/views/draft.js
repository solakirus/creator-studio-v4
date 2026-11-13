/* v4: Draft — plan anything by describing it, with Claude, then bring it in.

   The Planner's first tab. Write what you have; Claude works out what kind of
   plan it is — a weekly vlog (its days, sequences and shots), a series, a
   single video, a month, or a quarter — and gives the gist at that level. Push
   back until it's right, then Make the plan turns it into a plan
   (planimport.js format) shown in the same Import preview as a pasted one, so
   it lands where it belongs: Quarters, Months, the weekly vlog, Series.
   Fine-tune it there, then Send to phone.

   Big ideas first, one at a time: a quarter's months each get "Plan this
   month", a month's weeks "Plan this episode" — a new draft that already knows
   what sits above it. Brain dump takes a pile of ideas and only sorts them into
   drafts; nothing is planned until you open one.

   Claude is reached the way Suggest shots reaches it (shotai.js): on the laptop
   through the Claude plan (Claude Code), else an API key, else a prompt to
   paste into a Claude chat. Drafts stay on this device (settings 'plan-drafts').

   PlanDraft.start({ kind, title, idea, weekOf, monthStart, quarterId, parent })
   opens a new draft from anywhere (Months, a quarter, an episode). */
(function(global){
  const esc = s => U.esc(s);
  const KEY = 'plan-drafts';
  const uid = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const KINDS = [
    { k:'auto',    label:'Work it out' },
    { k:'vlog',    label:'Weekly vlog' },
    { k:'series',  label:'Series' },
    { k:'video',   label:'One video' },
    { k:'month',   label:'Month' },
    { k:'quarter', label:'Quarter' }
  ];
  const kindLabel = k => (KINDS.find(x => x.k === k) || KINDS[0]).label;
  const PLATS = [['instagram', 'Instagram'], ['youtube', 'YouTube'], ['shorts', 'YouTube Shorts'], ['tiktok', 'TikTok'], ['facebook', 'Facebook']];
  const FRAMING = ['Wide', 'Medium', 'Close', 'Over-shoulder', 'POV', 'Top-down'];
  const MOVEMENT = ['Static', 'Pan', 'Tilt', 'Push in', 'Pull out', 'Tracking', 'Handheld'];
  const SETUPS = ['talking', 'vlog', 'phone', 'location', 'transition', 'screen', 'broll'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let drafts = null, current = null, busy = '';

  async function load(){
    if(drafts) return drafts;
    try { drafts = (await Store.get('settings', KEY)) || []; } catch(e){ drafts = []; }
    if(!Array.isArray(drafts)) drafts = [];
    drafts.forEach(d => { if(!d.kind) d.kind = 'auto'; });
    return drafts;
  }
  async function persist(){ try { await Store.put('settings', drafts, KEY); } catch(e){ console.warn('Drafts not saved', e); } }
  const blank = o => ({ id:uid(), kind:'auto', idea:'', channel:'', series:'', platform:'instagram', count:1, day:'',
    weekOf:'', monthStart:'', monthEnd:'', quarterId:'', parent:null, title:'',
    thread:[], plan:null, planned:null, importedAt:0, createdAt:Date.now(), updatedAt:Date.now(), ...(o || {}) });
  const firstLine = (t, head) => { const m = new RegExp(head + '[^\\n]*\\n+([^\\n]+)', 'i').exec(t || ''); return m ? m[1] : ''; };
  const titleOf = d => {
    const g = d.thread.filter(x => x.role === 'gist').pop();
    const t = (g && firstLine(g.text, 'THE (?:IDEA|EPISODE|SERIES|MONTH|QUARTER)')) || d.title || d.idea || 'New idea';
    return t.replace(/^[-•*\s]+/, '').trim().slice(0, 70) || 'New idea';
  };

  /* ---------------------------------------------------------- what's around it */
  const iso = t => Months.iso(t);
  async function calendar(){
    const out = { weeks:[], months:[], quarters:[], episodes:[] };
    try { out.months = await Months.all(); } catch(e){}
    try { if(global.Quarters){ await Quarters.ensureThrough(new Date().getFullYear() + 1); out.quarters = await Quarters.all(); } } catch(e){}
    try { out.episodes = (await Store.all('vlogs')).values; } catch(e){}
    /* this week and the next eleven, with their project week and what's in them */
    const sun0 = Months.snapSunday(Date.now());
    for(let i = 0; i < 12; i++){
      const s = Months.addDays(sun0, i * 7);
      let n = null; try { n = await Data.weekNumber(Months.ts(s)); } catch(e){}
      const ep = n != null ? out.episodes.find(v => Months.hasWeek(v) && +v.week === n) : null;
      out.weeks.push({ sun:s, n, ep });
    }
    return out;
  }
  const qLabel = q => `${q.name && !/^Untitled/.test(q.name) ? q.name : 'Quarter ' + (q.n || '')} · ${Quarters.rangeLabel(q)}`;
  /* a month's natural span from a Sunday: to the last Saturday of the calendar
     month its first week lands in (months.js does the same) */
  function monthEndFor(start){
    const firstSat = Months.addDays(Months.snapSunday(start), 6);
    const d = new Date(Months.ts(firstSat));
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const lastSat = Months.addDays(iso(lastDay.getTime()), -((lastDay.getDay() + 1) % 7));
    return lastSat < firstSat ? firstSat : lastSat;
  }
  const sundaysBetween = (a, b) => { const out = []; for(let s = Months.snapSunday(a); s <= b; s = Months.addDays(s, 7)) out.push(s); return out; };
  function quarterMonths(q){
    /* the app's own rule: a week belongs to the month its Saturday falls in
       (Jan: Dec 27 – Jan 30, Feb: Jan 31 – Feb 27, Mar: Feb 28 – Mar 27) */
    const end = iso(q.endDate), out = [];
    let s = Months.snapSunday(iso(q.startDate));
    for(let i = 0; i < 3 && s <= end; i++){
      const e = i === 2 || monthEndFor(s) > end ? end : monthEndFor(s);
      out.push({ startDate:s, endDate:e });
      s = Months.addDays(e, 1);
    }
    return out;
  }

  /* ---------------------------------------------------------- what's already there
     A draft can add to something already in the Planner: picked from its
     page (✦ Plan), or found by what the draft is for — the week's episode, the
     month on that Sunday, the series of that name, the quarter picked. Claude
     sees it, keeps it, and adds; the import adds to it (Add to what's there). */
  async function existingFor(d, cal){
    const ex = d.extend || null;
    try {
      if(d.kind === 'vlog'){
        const v = ex && ex.kind === 'vlog' ? cal.episodes.find(x => x.id === ex.id)
          : (cal.weeks.find(w => w.sun === d.weekOf) || {}).ep;
        if(v) return { kind:'vlog', id:v.id, label:`the episode "${v.title || 'Week ' + v.week}"`, text: episodeText(v) };
      }
      if(d.kind === 'month'){
        const m = ex && ex.kind === 'month' ? cal.months.find(x => x.id === ex.id) : cal.months.find(x => x.startDate === d.monthStart);
        if(m){
          const eps = cal.episodes.filter(v => v.monthId === m.id).sort((a, b) => (a.week || 0) - (b.week || 0));
          return { kind:'month', id:m.id, label:`the month "${m.name || 'Untitled'}"`, text:[`Month: ${m.name || ''}`, m.challenge ? `Challenge: ${m.challenge}` : '',
            m.reward ? `Reward: ${m.reward}` : '', m.notes ? `Notes: ${m.notes}` : '',
            eps.length ? 'Weekly episodes:\n' + eps.map(v => `- week ${v.week}: ${v.title || ''}${v.weeklyChallenge ? ' — ' + v.weeklyChallenge : ''}`).join('\n') : ''].filter(Boolean).join('\n') };
        }
      }
      if(d.kind === 'quarter'){
        const q = cal.quarters.find(x => x.id === (ex && ex.kind === 'quarter' ? ex.id : d.quarterId));
        if(q && (q.topic || q.challenge || q.throughline || cal.months.some(m => m.quarterId === q.id))){
          const ms = cal.months.filter(m => m.quarterId === q.id);
          return { kind:'quarter', id:q.id, label:`the quarter "${q.name || ''}"`, text:[q.topic ? `Topic: ${q.topic}` : '', q.throughline ? `Throughline: ${q.throughline}` : '',
            q.challenge ? `Challenge: ${q.challenge}` : '', ms.length ? 'Months:\n' + ms.map(m => `- ${m.name}${m.challenge ? ' — ' + m.challenge : ''}`).join('\n') : ''].filter(Boolean).join('\n') };
        }
      }
      if(d.kind === 'series' && (d.series || (ex && ex.kind === 'series'))){
        const all = await Data.series();
        const sr = ex && ex.kind === 'series' ? all.find(x => x.id === ex.id) : all.find(x => sameName(x.title, d.series));
        if(sr){
          const parts = global.ClipFlow ? await ClipFlow.parts(sr.id) : [];
          return { kind:'series', id:sr.id, label:`the series "${sr.title}"`, text:[`Series: ${sr.title}`,
            parts.length ? 'Episodes so far:\n' + parts.map((c, i) => `${i + 1}. ${c.title}${c.plan && c.plan.hook ? ' — hook: ' + c.plan.hook : ''}`).join('\n') : 'No episodes yet'].join('\n') };
        }
      }
    } catch(e){}
    return null;
  }
  const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  function episodeText(v){
    const real = b => !(/^Sequence \d+$/.test(b.title || '') && !(b.shots || []).length && !b.purpose && !b.script);
    const days = (v.acts || []).map(a => ({ a, bs:(a.beats || []).filter(real) })).filter(x => x.bs.length);
    return [`Episode: ${v.title || ''}`, v.weeklyChallenge ? `Challenge: ${v.weeklyChallenge}` : '', v.passLine ? `Pass line: ${v.passLine}` : '',
      days.length ? 'Days and sequences:\n' + days.map(x => `- ${x.a.title}: ` + x.bs.map(b => `${b.title}${(b.shots || []).length ? ` (${b.shots.map(s => s.text).join('; ')})` : ''}`).join(' | ')).join('\n')
        : 'No sequences yet'].filter(Boolean).join('\n');
  }

  /* ---------------------------------------------------------- prompts */
  function where(d, cal){
    const L = [];
    if(d.kind === 'series' || d.kind === 'video' || d.kind === 'auto'){
      L.push(`Channel: ${d.channel || 'not picked yet'}`, `Platform: ${(PLATS.find(p => p[0] === d.platform) || [0, d.platform])[1]}`);
      if(d.kind !== 'video') L.push(`Series: ${d.series || 'none yet'}`);
      if(d.kind === 'series') L.push(`How many videos: ${d.count || 3}`);
      if(d.day) L.push(`Shoot day: ${d.day}`);
    }
    if(d.kind === 'vlog' && d.weekOf){
      const w = cal.weeks.find(x => x.sun === d.weekOf);
      L.push(`The week: ${Months.label(d.weekOf, { month:'short', day:'numeric' })} (Sunday) to ${Months.label(Months.addDays(d.weekOf, 6), { month:'short', day:'numeric' })}${w && w.n != null ? `, project week ${w.n}` : ''}`);
      const m = cal.months.find(x => x.startDate && d.weekOf >= x.startDate && d.weekOf <= x.endDate);
      if(m) L.push(`It falls in the month "${m.name}"${m.challenge ? ` — challenge: ${m.challenge}` : ''}`);
    }
    if(d.kind === 'month' && d.monthStart) L.push(`The month runs ${d.monthStart} (Sunday) to ${d.monthEnd || monthEndFor(d.monthStart)} (Saturday): ${sundaysBetween(d.monthStart, d.monthEnd || monthEndFor(d.monthStart)).length} weeks`);
    if(d.kind === 'quarter'){
      const q = cal.quarters.find(x => x.id === d.quarterId);
      if(q) L.push(`The quarter: ${qLabel(q)} (13 weeks)${q.topic ? ` — topic so far: ${q.topic}` : ''}`);
    }
    if(d.parent) L.push(`This sits inside ${d.parent.label}${d.parent.text ? '\n' + d.parent.text : ''}`);
    return L.join('\n');
  }
  const GIST = {
    vlog: `THE EPISODE (one line)\nTHE WEEK'S CHALLENGE (what he tries this week, and the pass line)\nHOOKS (three options, numbered)\nTHE DAYS (each day or part, with its sequences in order — one line per sequence)\nWHAT TO FILM (the key shots, short)\nOPEN QUESTIONS (or "None")`,
    series: `THE SERIES (one line)\nWHY IT WORKS\nTHE FORMAT (what every episode has)\nEPISODES (numbered: title — one line)\nOPEN QUESTIONS (or "None")`,
    video: `THE IDEA\nWHY IT WORKS\nHOOKS (three options, one line each, numbered)\nSTRUCTURE (the beats in order, one line each)\nWHAT TO FILM (the shots, grouped under each beat, short)\nOPEN QUESTIONS (or "None")`,
    month: `THE MONTH (one line)\nTHE CHALLENGE (what he commits to this month)\nWHY IT WORKS\nTHE WEEKS (one line per week: episode title — that week's challenge)\nREWARD AND STAKES\nOPEN QUESTIONS (or "None")`,
    quarter: `THE QUARTER (one line)\nTOPIC\nTHROUGHLINE (what ties the 13 weeks together)\nTHE CHALLENGE\nTHE MONTHS (one line each: name — challenge)\nOPEN QUESTIONS (or "None")`
  };
  /* the thread since the last "start over" (the older overviews are kept) */
  const live = d => { const i = d.thread.map(x => x.role).lastIndexOf('reset'); return i < 0 ? d.thread : d.thread.slice(i + 1); };
  function gistPrompt(d, cal){
    const th = live(d);
    const last = th.filter(x => x.role === 'gist').pop();
    const notes = last ? th.slice(th.lastIndexOf(last) + 1).filter(x => x.role === 'note') : [];
    const earlier = last ? th.filter(x => x.role === 'note' && th.indexOf(x) < th.lastIndexOf(last)) : th.filter(x => x.role === 'note');
    const ex = d.__existing;
    const auto = d.kind === 'auto';
    return `You're helping Kris, a solo content creator documenting a long personal journey on a weekly vlog plus channel series, plan ${auto ? 'something' : 'a ' + kindLabel(d.kind).toLowerCase()} before it goes into his planner app. Work from what he gives you; don't invent facts about him or his life. Big ideas first — this is the overview, not the detail.

${where(d, cal)}

${ex ? `Already in his planner — ${ex.label}. Keep all of it; your overview builds on it and says what's new:
<<<
${ex.text}
>>>
` : ''}
What he has:
<<<
${d.idea.trim() || '(nothing yet)'}
>>>
${!last && earlier.length ? `\nMore he added:\n${earlier.map(n => '- ' + n.text).join('\n')}\n` : ''}${last ? `
Your last overview:
<<<
${last.text}
>>>

His changes and additions (newest last):
${notes.map(n => '- ' + n.text).join('\n')}
Rewrite the overview with these in. Keep everything he didn't ask to change — add to it, don't start over.
` : ''}
${auto ? `First decide what this is. Start your reply with one line:
KIND: vlog | series | video | month | quarter
(vlog = one week's episode of his weekly vlog; series = a run of videos for a channel series; video = one video; month = a month's challenge and its weekly episodes; quarter = a 13-week block of months.)
Then give the overview with the headings for that kind, each on its own line:
${Object.entries(GIST).map(([k, v]) => `— for ${k}:\n${v}`).join('\n')}`
  : `Give him the gist — a short overview he can react to. Plain text with exactly these headings, each on its own line:\n${GIST[d.kind]}`}
Under 320 words. No JSON, no tables.`;
  }

  const SHOT = `{ "text": "short shot name", "framing": one of ${JSON.stringify(FRAMING)}, "movement": one of ${JSON.stringify(MOVEMENT)} or "", "note": "one short tip or \\"\\"", "lines": [ { "k": "vo" | "cam" | "txt", "t": "what is said or shown" } ] }`;
  function planPrompt(d, cal){
    const last = live(d).filter(x => x.role === 'gist').pop();
    const ex = d.__existing;
    const head = `Turn this agreed overview into a plan for Kris's planner app.

${where(d, cal)}
${ex ? `\nAlready in the planner — ${ex.label} (it is kept; the import only adds what's new, so include the new parts, and repeat existing names exactly where you add to them):\n<<<\n${ex.text}\n>>>\n` : ''}
The overview:
<<<
${last ? last.text : d.idea}
>>>

Reply with ONLY this JSON (no prose, no code fences):
`;
    if(d.kind === 'vlog'){
      const week = d.weekOf || (cal.weeks[1] || {}).sun || Months.snapSunday(Date.now());
      return head + `{
  "plan": "short name",
  "episodes": [ {
    "title": "the episode's title",
    "filmStart": ${JSON.stringify(week)},
    "skill": "the skill or theme of the week",
    "weeklyChallenge": "what he tries this week",
    "passLine": "what counts as passing",
    "acts": [ { "title": "a day (${DAYS.join(', ')}) or a part", "sequences": [
      { "title": "short sequence name", "purpose": "what it does for the story", "setup": one of ${JSON.stringify(SETUPS)},
        "script": "what is said, short (or \\"\\")", "shots": [ ${SHOT} ] } ] } ]
  } ]
}
Rules: the days or parts from THE DAYS, in order; 1 to 4 sequences each; 3 to 8 shots per sequence; only give "lines" where something is said or shown. Achievable for one person filming alone.`;
    }
    if(d.kind === 'month'){
      const s = d.monthStart, e = d.monthEnd || monthEndFor(s);
      const weeks = sundaysBetween(s, e);
      return head + `{
  "plan": "short name",
  "months": [ { "name": "the month's name", "startDate": ${JSON.stringify(s)}, "endDate": ${JSON.stringify(e)},
    "challenge": "the month's challenge", "reward": "the reward", "notes": "two or three lines: why, and the stakes" } ],
  "episodes": [ ${weeks.map((w, i) => `{ "title": "week ${i + 1}'s episode title", "filmStart": ${JSON.stringify(w)}, "weeklyChallenge": "that week's challenge", "skill": "its skill or theme"${i === weeks.length - 1 ? ', "isVerdict": true' : ''} }`).join(',\n    ')} ]
}
Rules: exactly these ${weeks.length} weeks, with these filmStart dates. The last week is the verdict. No sequences yet — those are planned week by week.`;
    }
    if(d.kind === 'quarter'){
      const q = cal.quarters.find(x => x.id === d.quarterId) || cal.quarters[0];
      const ms = q ? quarterMonths(q) : [];
      return head + `{
  "plan": "short name",
  "quarters": [ { "n": ${q ? q.n : 1}, "name": "the quarter's name", "topic": "its topic", "throughline": "what ties it together", "challenge": "the quarter's challenge" } ],
  "months": [ ${ms.map((m, i) => `{ "name": "month ${i + 1}'s name", "startDate": ${JSON.stringify(m.startDate)}, "endDate": ${JSON.stringify(m.endDate)}, "challenge": "its challenge", "notes": "one or two lines" }`).join(',\n    ')} ]
}
Rules: exactly these ${ms.length} months with these dates. No weekly episodes yet — those are planned month by month.`;
    }
    /* a series or one video */
    const n = d.kind === 'series' ? (d.count || 3) : 1;
    return head + `{
  "plan": "short name",
  "videos": [ {
    "title": "the video's working title",
    ${d.kind === 'series' || d.series ? `"series": ${JSON.stringify(d.series || 'the series name')},\n    ` : ''}"channel": ${JSON.stringify(d.channel || '')},
    "platform": ${JSON.stringify(d.platform || 'instagram')},
    "order": 1,
    "hook": "the best hook",
    "idea": "two or three lines: the idea and the beats in order",
    ${d.day ? `"day": ${JSON.stringify(d.day)},\n    ` : ''}"postDay": "YYYY-MM-DD when it goes out, if the overview says (else leave it out)",
    "tags": [],
    "shots": [ ${SHOT} ]
  } ]
}
Rules: exactly ${n} video${n === 1 ? '' : 's'}${n > 1 ? ', in order, one per episode in EPISODES' : ''}. 5 to 12 shots each, in shooting order. Only give "lines" where something is said or shown. Achievable for one person filming alone.`;
  }

  /* the plan Claude sent back, held to what was picked here */
  function readPlan(text, d, cal){
    const obj = PlanImport.parseAny(text);
    if(d.kind === 'vlog'){
      if(!obj.episodes.length) throw new Error('That answer had no episode in it — try again.');
      obj.episodes = obj.episodes.slice(0, 1);
      if(d.weekOf) obj.episodes[0].filmStart = d.weekOf;
      obj.seriesEpisodes = []; obj.months = []; obj.quarters = [];
    } else if(d.kind === 'month'){
      if(!obj.months.length) throw new Error('That answer had no month in it — try again.');
      obj.months = obj.months.slice(0, 1);
      if(d.monthStart){ obj.months[0].startDate = d.monthStart; obj.months[0].endDate = d.monthEnd || monthEndFor(d.monthStart); }
      obj.episodes.forEach(e => { delete e.acts; delete e.monthId; delete e.month; });
      obj.seriesEpisodes = []; obj.quarters = [];
    } else if(d.kind === 'quarter'){
      if(!obj.quarters.length && !obj.months.length) throw new Error('That answer had no quarter in it — try again.');
      const q = cal.quarters.find(x => x.id === d.quarterId);
      if(q && obj.quarters[0]){ obj.quarters = obj.quarters.slice(0, 1); obj.quarters[0].n = q.n; obj.quarters[0].id = q.id; delete obj.quarters[0].startDate; }
      obj.episodes = []; obj.seriesEpisodes = [];
    } else {
      const vids = obj.seriesEpisodes || [];
      if(!vids.length) throw new Error('That answer had no videos in it — try again.');
      vids.forEach((v, i) => {
        if(d.channel && !v.channel) v.channel = d.channel;
        if(d.series && !v.series) v.series = d.series;
        if(d.kind === 'video' && !d.series){ delete v.series; delete v.seriesId; }
        if(d.platform && !v.platform) v.platform = d.platform;
        if(d.day && v.day === undefined) v.day = d.day;
        if(!v.order) v.order = i + 1;
        delete v.id;    /* new videos; a re-run matches them by title in the series */
      });
      obj.months = []; obj.episodes = []; obj.quarters = [];
    }
    const out = { format:PlanImport.FORMAT, plan:obj.plan || titleOf(d) };
    ['quarters', 'months', 'episodes'].forEach(k => { if(obj[k].length) out[k] = obj[k]; });
    if((obj.seriesEpisodes || []).length) out.videos = obj.seriesEpisodes;
    return out;
  }

  /* plain text with HEADINGS and lists, as the overview comes back */
  function gistHTML(t){
    const lines = String(t || '').replace(/\r/g, '').split('\n');
    let html = '', list = false;
    const close = () => { if(list){ html += '</ul>'; list = false; } };
    for(let l of lines){
      l = l.replace(/\*\*/g, '').trimEnd();
      if(!l.trim() || /^KIND:/i.test(l.trim())){ close(); continue; }
      const h = /^#+\s*(.+)$/.exec(l) || (/^[A-Z][A-Z '’&/()-]{3,}:?\s*(\(.*\))?$/.test(l.trim()) ? [0, l.trim()] : null);
      if(h){ close(); html += `<h4>${esc(h[1].replace(/:$/, ''))}</h4>`; continue; }
      const li = /^\s*(?:[-•*]|\d+[.)])\s+(.*)$/.exec(l);
      if(li){ if(!list){ html += '<ul>'; list = true; } html += `<li>${esc(li[1])}</li>`; continue; }
      close(); html += `<p>${esc(l)}</p>`;
    }
    close();
    return html;
  }
  const kindFrom = t => { const m = /^\s*KIND:\s*(vlog|series|video|month|quarter)/im.exec(t || ''); return m ? m[1].toLowerCase() : null; };

  /* the plan's pieces that can be planned one level down, once it's in */
  function children(d){
    const p = d.planned;
    if(!p) return [];
    if(d.kind === 'quarter'){
      const q = (p.quarters || [])[0] || {};
      return (p.months || []).map(m => ({ label:`${m.name || 'Month'} — ${m.challenge || ''}`, verb:'Plan this month',
        seed:{ kind:'month', monthStart:m.startDate, monthEnd:m.endDate, title:m.name || '',
          idea:`${m.name || ''}: ${m.challenge || ''}\n${m.notes || ''}`.trim(),
          parent:{ label:`the quarter "${q.name || titleOf(d)}"`, text:[q.topic ? 'Topic: ' + q.topic : '', q.throughline ? 'Throughline: ' + q.throughline : '',
            q.challenge ? 'Quarter challenge: ' + q.challenge : ''].filter(Boolean).join('\n') } } }));
    }
    if(d.kind === 'month'){
      const m = (p.months || [])[0] || {};
      return (p.episodes || []).map((e, i) => ({ label:`Week ${i + 1} · ${e.title || ''}`, verb:'Plan this episode',
        seed:{ kind:'vlog', weekOf:Months.snapSunday(e.filmStart), title:e.title || '',
          idea:`${e.title || ''}\nThis week's challenge: ${e.weeklyChallenge || ''}${e.skill ? '\nSkill: ' + e.skill : ''}`,
          parent:{ label:`the month "${m.name || titleOf(d)}"`, text:m.challenge ? 'Month challenge: ' + m.challenge : '' } } }));
    }
    return [];
  }

  (function css(){
    if(document.getElementById('drf-css')) return;
    const st = document.createElement('style'); st.id = 'drf-css';
    st.textContent = `
      .drf{display:grid;grid-template-columns:260px minmax(0,1fr);gap:22px;padding:18px 22px 120px;max-width:1300px}
      @media (max-width: 899px){ .drf{grid-template-columns:1fr;padding:12px 14px 120px} .drf-side{order:2} }
      .drf-side h3{margin:0 0 10px;font-family:var(--display),sans-serif;font-weight:900;letter-spacing:.06em;text-transform:uppercase;font-size:13px;color:var(--muted)}
      .drf-list{display:flex;flex-direction:column;gap:6px;margin:10px 0 0}
      .drf-item{display:block;width:100%;text-align:left;padding:10px 12px;border-radius:var(--r);border:1px solid var(--line);background:transparent;color:var(--cream);font:inherit;cursor:pointer}
      .drf-item[aria-current]{border-color:var(--orange);background:rgba(255,106,0,.08)}
      .drf-item small{display:block;color:var(--muted);font-size:12px;margin-top:3px}
      .drf-main{min-width:0}
      .drf-title{font-family:var(--display),sans-serif;font-weight:900;font-size:26px;margin:0 0 4px;text-transform:uppercase}
      .drf-sub{color:var(--muted);font-size:14px;margin:0 0 14px;line-height:1.5}
      .drf-kinds{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
      .drf-kinds button{height:32px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--muted);font:inherit;font-size:13.5px;cursor:pointer}
      .drf-kinds button[aria-pressed="true"]{border-color:var(--orange);color:var(--cream);background:rgba(255,106,0,.12)}
      .drf-parent{margin:0 0 12px;padding:8px 12px;border:1px dashed var(--line);border-radius:var(--r);color:var(--muted);font-size:13.5px}
      .drf-box{width:100%;min-height:150px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);color:var(--cream);font:inherit;font-size:15px;line-height:1.5;padding:12px;resize:vertical;outline:none}
      .drf-box:focus{border-color:var(--orange)}
      .drf-row{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
      .drf-row label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);letter-spacing:.04em}
      .drf-row select,.drf-row input{height:36px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);color:var(--cream);font:inherit;font-size:14px;padding:0 10px;min-width:150px}
      .drf-row input[type=number]{min-width:70px;width:80px}
      .drf-acts{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 0;align-items:center}
      .drf-acts .btn-primary,.drf-acts .btn-ghost{width:auto;flex:0 0 auto;padding-left:20px;padding-right:20px;margin:0}
      .drf-side .btn-primary,.drf-side .btn-ghost{width:100%}
      .drf-card{border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;margin:16px 0 0;background:var(--surface-1,rgba(255,255,255,.02))}
      .drf-card h4{margin:12px 0 4px;font-family:var(--display),sans-serif;font-weight:900;letter-spacing:.08em;font-size:12.5px;color:var(--orange);text-transform:uppercase}
      .drf-card h4:first-child{margin-top:0}
      .drf-card p,.drf-card li{margin:2px 0;font-size:14.5px;line-height:1.5;color:var(--cream)}
      .drf-card ul{margin:2px 0;padding-left:20px}
      .drf-note{margin:12px 0 0;padding:8px 12px;border-left:3px solid var(--orange);color:var(--muted);font-size:14px}
      .drf-old summary{cursor:pointer;color:var(--muted);font-size:13px;margin:14px 0 0}
      .drf-busy{color:var(--muted);font-size:14px}
      .drf-child{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line);font-size:14px}
      .drf-done{color:#5BBE6A;font-weight:700}
      .drf-empty{color:var(--muted);font-size:14px;line-height:1.5}`;
    document.head.appendChild(st);
  })();

  /* the plan, readably, before it goes in */
  function planSummary(p){
    const li = [];
    const sub = t => t ? `<br><small style="color:var(--muted)">${esc(t)}</small>` : '';
    (p.quarters || []).forEach(q => li.push(`<li><b>Quarter</b> · ${esc(q.name || '')}${sub(q.topic)}</li>`));
    const day = t => { try { return Months.label(t, { month:'short', day:'numeric' }); } catch(e){ return t || ''; } };
    (p.months || []).forEach(m => li.push(`<li><b>Month</b> · ${esc(m.name || '')} · ${esc(day(m.startDate))} – ${esc(day(m.endDate))}${sub(m.challenge)}</li>`));
    (p.episodes || []).forEach(e => {
      const acts = e.acts || [];
      const seqs = acts.reduce((n, a) => n + ((a.sequences || a.beats || []).length), 0);
      const shots = acts.reduce((n, a) => n + (a.sequences || a.beats || []).reduce((m, b) => m + (b.shots || []).length, 0), 0);
      li.push(`<li><b>Weekly vlog</b> · ${esc(e.title || '')} · week of ${esc(day(e.filmStart))}${acts.length ? sub(`${acts.length} days · ${seqs} sequences · ${shots} shots`) : sub(e.weeklyChallenge)}</li>`);
    });
    (p.videos || []).forEach(v => li.push(`<li><b>${v.series ? esc(v.series) : 'Video'}</b> · ${esc(v.title || 'Untitled')} — ${(v.shots || []).length} shots${sub(v.hook)}</li>`));
    return `<ul>${li.join('')}</ul>`;
  }

  const ViewDraft = {
    async mount(el){
      await load();
      if(!current || !drafts.find(d => d.id === current)) current = drafts[0] ? drafts[0].id : null;
      let channels = [], seriesAll = [], via = 'paste', cal = { weeks:[], months:[], quarters:[], episodes:[] };
      try { channels = (await Channels.all()).map(c => c.n).filter(Boolean); } catch(e){}
      try { seriesAll = await Data.series(); } catch(e){}
      try { via = (await ShotAI.route()).kind; } catch(e){}
      cal = await calendar();

      const d = () => drafts.find(x => x.id === current) || null;
      const seriesFor = ch => seriesAll.filter(s => !ch || !s.channel || s.channel === ch);
      /* fill in what a kind needs, from the calendar */
      function defaults(x){
        if(x.kind === 'vlog' && !x.weekOf){ const free = cal.weeks.slice(1).find(w => !w.ep) || cal.weeks[1]; if(free) x.weekOf = free.sun; }
        if(x.kind === 'month' && !x.monthStart){
          const last = cal.months.filter(m => m.endDate).slice(-1)[0];
          let next = Months.addDays(Months.snapSunday(Date.now()), 7);
          /* not much of this calendar month left: the next one */
          if(sundaysBetween(next, monthEndFor(next)).length < 3) next = Months.addDays(monthEndFor(next), 1);
          x.monthStart = last && Months.addDays(last.endDate, 1) >= next ? Months.addDays(last.endDate, 1) : next;
        }
        if(x.kind === 'month' && x.monthStart && !x.monthEnd) x.monthEnd = monthEndFor(x.monthStart);
        if(x.kind === 'quarter' && !x.quarterId){
          const now = Date.now();
          const q = cal.quarters.find(q2 => now >= q2.startDate && now <= q2.endDate) || cal.quarters.find(q2 => q2.startDate > now);
          if(q) x.quarterId = q.id;
        }
        if(x.kind === 'series' && !(x.count > 1)) x.count = 3;
      }
      drafts.forEach(x => { if(x.kind !== 'auto') defaults(x); });

      function fields(cur){
        const sers = seriesFor(cur.channel);
        const ch = `<label>Channel<select data-f="channel"><option value="">—</option>${channels.map(n => `<option ${n === cur.channel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
        const pl = `<label>Platform<select data-f="platform">${PLATS.map(([v, l]) => `<option value="${v}" ${v === cur.platform ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
        if(cur.kind === 'vlog') return `<label>Week of<select data-f="weekOf">${cal.weeks.map(w => `<option value="${w.sun}" ${w.sun === cur.weekOf ? 'selected' : ''}>${
          Months.label(w.sun, { month:'short', day:'numeric' })}${w.n != null ? ' · week ' + w.n : ''}${w.ep ? ' · has “' + esc((w.ep.title || '').slice(0, 30)) + '”' : ''}</option>`).join('')}</select></label>`;
        if(cur.kind === 'month') return `<label>Starts (Sunday)<input data-f="monthStart" type="date" value="${esc(cur.monthStart || '')}"></label>
          <label>Ends (Saturday)<input data-f="monthEnd" type="date" value="${esc(cur.monthEnd || '')}"></label>`;
        if(cur.kind === 'quarter') return `<label>Quarter<select data-f="quarterId">${cal.quarters.filter(q => q.endDate > Date.now() - 864e5 * 120).slice(0, 8).map(q =>
          `<option value="${q.id}" ${q.id === cur.quarterId ? 'selected' : ''}>${esc(qLabel(q))}</option>`).join('')}</select></label>`;
        if(cur.kind === 'series') return ch + `<label>Series<input data-f="series" list="drf-series" value="${esc(cur.series)}" placeholder="a name"><datalist id="drf-series">${sers.map(s => `<option value="${esc(s.title)}">`).join('')}</datalist></label>` +
          pl + `<label>Videos<input data-f="count" type="number" min="1" max="8" value="${cur.count || 3}"></label>`;
        if(cur.kind === 'video') return ch + pl + `<label>Shoot day<input data-f="day" type="date" value="${esc(cur.day || '')}"></label>`;
        return ch + pl;
      }

      function draw(){
        const cur = d();
        const gists = cur ? cur.thread.filter(x => x.role === 'gist') : [];
        const last = gists[gists.length - 1];
        let plan = null; try { plan = cur && cur.plan ? JSON.parse(cur.plan) : null; } catch(e){}
        const kids = cur ? children(cur) : [];
        el.innerHTML = `<div class="drf">
          <aside class="drf-side">
            <h3>Drafts</h3>
            <button class="btn-primary" data-new style="width:100%">+ New idea</button>
            <button class="btn-ghost" data-dump style="width:100%;margin-top:8px">Brain dump…</button>
            <div class="drf-list">${drafts.map(x => `<button class="drf-item" data-open="${x.id}" ${x.id === current ? 'aria-current="true"' : ''}>
              ${esc(titleOf(x))}<small>${x.kind === 'auto' ? '' : kindLabel(x.kind) + ' · '}${x.importedAt ? 'In the Planner' : x.plan ? 'Plan ready' : x.thread.some(t => t.role === 'gist') ? 'Overview' : 'Idea'} · ${
              new Date(x.updatedAt).toLocaleDateString([], { month:'short', day:'numeric' })}</small></button>`).join('')}</div>
            <p class="drf-empty" style="margin-top:14px" data-via>${via === 'plan' ? 'Claude answers through your Claude plan on this computer.'
              : via === 'key' ? 'Claude answers through your API key.'
              : 'Each step gives you a prompt to paste into a Claude chat. On the laptop, set up Claude Code once (Settings → Claude for planning) and it answers here by itself, on your Claude plan.'}</p>
          </aside>
          <section class="drf-main">${!cur ? `
            <h2 class="drf-title">Plan with Claude</h2>
            <p class="drf-sub">Describe it — a weekly vlog, a series, one video, a month or a quarter. Get the gist back, push on it until it's right, then send it into the Planner. Fine-tune it there and Send to phone.</p>
            <button class="btn-primary" data-new>Start with an idea</button>` : `
            <h2 class="drf-title">${esc(titleOf(cur))}</h2>
            <p class="drf-sub">1 · Describe it → 2 · The gist → 3 · Make the plan → 4 · Import, fine-tune, Send to phone</p>
            ${cur.parent ? `<div class="drf-parent">Inside ${esc(cur.parent.label)}</div>` : ''}
            <div class="drf-kinds" role="group" aria-label="What it is">${KINDS.map(k => `<button data-kind="${k.k}" aria-pressed="${cur.kind === k.k}">${k.label}</button>`).join('')}</div>
            <textarea class="drf-box" data-idea placeholder="Describe it — the idea, notes, a reference link, how you want it to feel…">${esc(cur.idea)}</textarea>
            <div class="drf-row">${fields(cur)}</div>
            ${cur._ex ? `<div class="drf-parent" data-existing>Adds to ${esc(cur._ex.label)} — already in the Planner. Claude keeps what's there and builds on it; importing adds the new parts.</div>` : ''}
            <div class="drf-acts">
              ${busy ? `<span class="drf-busy">${esc(busy)}</span>`
                : `<button class="btn-primary" data-gist>${last ? 'Start the gist over' : 'Get the gist'}</button>
                   <button class="btn-ghost" data-del>Delete draft</button>`}
            </div>
            ${gists.length > 1 ? `<details class="drf-old"><summary>${gists.length - 1} earlier overview${gists.length === 2 ? '' : 's'}</summary>
              ${cur.thread.slice(0, cur.thread.lastIndexOf(last)).map(threadItem).join('')}</details>` : ''}
            ${last ? `<div class="drf-card" data-gistcard>${gistHTML(last.text)}</div>
              ${cur.thread.slice(cur.thread.lastIndexOf(last) + 1).map(threadItem).join('')}
              ${cur.thread.slice(cur.thread.lastIndexOf(last) + 1).some(t => t.role === 'note') ? `<p class="drf-sub" style="margin:8px 0 0">Waiting to go in — press <b>Refine the gist</b> to fold ${
                cur.thread.slice(cur.thread.lastIndexOf(last) + 1).filter(t => t.role === 'note').length === 1 ? 'it' : 'them'} in.</p>` : ''}
              <textarea class="drf-box" data-change style="min-height:80px;margin-top:14px" placeholder="What to change — “hook 2 but punchier”, “drop week 3”, answers to its questions…"></textarea>
              ${busy ? '' : `<div class="drf-acts"><button class="btn-ghost" data-refine>Refine the gist</button>
                <button class="btn-primary" data-plan>${cur.plan ? 'Make the plan again' : 'Make the plan →'}</button></div>`}` : ''}
            ${plan ? `<div class="drf-card"><h4>The plan</h4>${planSummary(plan)}
              <div class="drf-acts">${cur.importedAt
                ? `<span class="drf-done">✓ In the Planner</span><button class="btn-ghost" data-where>Fine-tune it</button>
                   <button class="btn-primary" data-send>Send to phone</button><button class="btn-ghost" data-import>Import again</button>`
                : `<button class="btn-primary" data-import>Import into the Planner</button>`}
                <button class="btn-ghost" data-copyplan>Copy the plan</button></div>
              ${kids.length ? `<h4 style="margin-top:16px">Next, one at a time</h4>${kids.map((c, i) => `<div class="drf-child"><span>${esc(c.label)}</span>
                <button class="btn-sm" data-child="${i}">${c.verb} →</button></div>`).join('')}` : ''}</div>` : ''}`}
          </section></div>`;
      }

      async function save(){ const cur = d(); if(!cur) return; cur.updatedAt = Date.now(); await persist(); }
      const threadItem = t => t.role === 'gist' ? `<div class="drf-card">${gistHTML(t.text)}</div>`
        : t.role === 'reset' ? `<p class="drf-sub" style="margin:12px 0 0">— started over —</p>`
        : `<div class="drf-note">${t.added ? 'Added' : 'You'}: ${esc(t.text)}</div>`;
      /* what this draft adds to, shown under its fields */
      async function noteExisting(){
        const cur = d(); if(!cur) return;
        const ex = await existingFor(cur, cal);
        const was = cur._ex ? cur._ex.id : null;
        cur._ex = ex ? { kind:ex.kind, id:ex.id, label:ex.label } : null;
        if((ex ? ex.id : null) !== was) draw();
      }
      async function ask(prompt, label){
        const cur = d();
        busy = label; draw();
        let text = null;
        try { text = await ShotAI.askText(prompt, label, 6000); }
        finally { busy = ''; }
        if(!text || !d() || d().id !== cur.id){ draw(); return null; }
        return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }

      el.oninput = e => {
        const cur = d(); if(!cur) return;
        if(e.target.matches('[data-idea]')){ cur.idea = e.target.value; clearTimeout(el._t); el._t = setTimeout(save, 400); }
      };
      el.onchange = async e => {
        const cur = d(); if(!cur) return;
        const f = e.target.dataset.f;
        if(!f) return;
        cur[f] = f === 'count' ? Math.max(1, Math.min(8, +e.target.value || 1)) : e.target.value.trim();
        if(f === 'monthStart' && cur.monthStart){ cur.monthStart = Months.snapSunday(cur.monthStart); cur.monthEnd = monthEndFor(cur.monthStart); }
        if(f === 'monthEnd' && cur.monthEnd) cur.monthEnd = Months.snapSaturday(cur.monthEnd);
        await save();
        if(['channel', 'monthStart', 'monthEnd'].includes(f)) draw();
        noteExisting();
      };
      el.onclick = async e => {
        const t = e.target;
        if(t.closest('[data-new]')){
          const prev = d();
          const nd = blank(prev ? { channel:prev.channel, platform:prev.platform } : {});
          drafts.unshift(nd); current = nd.id; await persist(); draw();
          const box = el.querySelector('[data-idea]'); if(box) box.focus();
          return;
        }
        if(t.closest('[data-dump]')) return brainDump(() => { draw(); noteExisting(); }, cal);
        const op = t.closest('[data-open]');
        if(op){ current = op.dataset.open; draw(); return noteExisting(); }
        const cur = d(); if(!cur) return;
        const kb = t.closest('[data-kind]');
        if(kb){ cur.kind = kb.dataset.kind; defaults(cur); cur.plan = null; cur.planned = null; await save(); draw(); return noteExisting(); }
        if(t.closest('[data-del]')){
          if(!confirm('Delete this draft? What was imported stays in the Planner.')) return;
          drafts = drafts.filter(x => x.id !== cur.id); current = drafts[0] ? drafts[0].id : null; await persist(); return draw();
        }
        if(t.closest('[data-gist]')){
          if(!cur.idea.trim()) return U.toast('Describe it first');
          /* starting over keeps the old overviews (under "earlier") */
          if(cur.thread.some(x => x.role === 'gist')) cur.thread.push({ role:'reset', at:Date.now() });
          cur.__existing = await existingFor(cur, cal);
          const a = await ask(gistPrompt(cur, cal), 'Getting the gist…');
          delete cur.__existing;
          if(a){
            const k = cur.kind === 'auto' ? kindFrom(a) : null;
            if(k){ cur.kind = k; defaults(cur); noteExisting(); }
            cur.thread.push({ role:'gist', text:a, at:Date.now() }); cur.plan = null; cur.planned = null; await save();
          }
          return draw();
        }
        if(t.closest('[data-refine]')){
          const box = el.querySelector('[data-change]');
          const note = box ? box.value.trim() : '';
          const lastG = cur.thread.map(x => x.role).lastIndexOf('gist');
          const waiting = cur.thread.slice(lastG + 1).some(x => x.role === 'note');
          if(!note && !waiting) return U.toast('Say what to change or add first');
          if(note) cur.thread.push({ role:'note', text:note, at:Date.now() });
          await save();
          cur.__existing = await existingFor(cur, cal);
          const a = await ask(gistPrompt(cur, cal), 'Refining…');
          delete cur.__existing;
          if(a){ cur.thread.push({ role:'gist', text:a, at:Date.now() }); cur.plan = null; cur.planned = null; }
          else if(note) cur.thread.pop();     /* nothing came back: the note waits in the box */
          await save(); draw();
          if(!a){ const b2 = el.querySelector('[data-change]'); if(b2) b2.value = note; }
          return;
        }
        if(t.closest('[data-plan]')){
          const box = el.querySelector('[data-change]');
          if(box && box.value.trim()) return U.toast('Refine the gist with your change first — or clear the box');
          if(cur.kind === 'auto') cur.kind = 'video';
          defaults(cur);
          cur.__existing = await existingFor(cur, cal);
          const a = await ask(planPrompt(cur, cal), 'Making the plan…');
          delete cur.__existing;
          if(!a) return draw();
          try {
            cur.plan = JSON.stringify(readPlan(a, cur, cal), null, 2);
            cur.importedAt = 0; cur.planned = null;
            await save();
          } catch(err){ U.toast(err.message || 'That answer wasn’t a plan — try again'); }
          return draw();
        }
        if(t.closest('[data-import]')){
          if(!global.PlanImportUI || !PlanImportUI.preview) return U.toast('Import is not available');
          return PlanImportUI.preview(cur.plan, async () => {
            const x = drafts.find(y => y.id === cur.id);
            if(x){ x.importedAt = Date.now(); x.updatedAt = Date.now(); try { x.planned = JSON.parse(x.plan); } catch(e2){} await persist(); }
            try { seriesAll = await Data.series(); } catch(e2){}
            cal = await calendar();
            draw();
          });
        }
        const chb = t.closest('[data-child]');
        if(chb){
          const c = children(cur)[+chb.dataset.child];
          if(c){ await start(c.seed); return draw(); }
          return;
        }
        if(t.closest('[data-copyplan]')){
          try { await navigator.clipboard.writeText(cur.plan); U.toast('Plan copied'); } catch(err){ U.toast('Could not copy'); }
          return;
        }
        if(t.closest('[data-where]')) return App.go(['vlog', 'month', 'quarter'].includes(cur.kind) ? 'weekly' : 'series');
        if(t.closest('[data-send]')) return App.sendToPhone && App.sendToPhone(t.closest('[data-send]'));
      };
      ViewDraft._draw = () => { draw(); noteExisting(); };
      draw(); noteExisting();
    }
  };

  /* Brain dump: a pile of ideas in. Each idea either adds to something that's
     already there — a draft you have, or a month, series, quarter or week's
     episode in the Planner — or becomes a new draft. Nothing is planned and
     nothing is wiped: an idea for a draft lands under it, waiting for Refine. */
  function brainDump(after, cal){
    App.sheet(`
      <h2>Brain dump</h2>
      <p class="hintline" style="margin:0 0 10px">Everything on your mind — vlog ideas, series, one-offs, what next month is about. An idea that belongs with
        something you already have is added to it; the rest become new drafts. Nothing gets planned until you open one.</p>
      <textarea id="drf-dump" rows="10" style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);color:var(--cream);font:inherit;font-size:14.5px;padding:10px;resize:vertical"
        placeholder="One idea per line, or just write…"></textarea>
      <div class="sheetcta"><button class="btn-primary" data-sort>Sort it</button><button class="btn-ghost" data-cancel>Cancel</button></div>`, sh => {
      sh.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-sort]')) return;
        const text = sh.querySelector('#drf-dump').value.trim();
        if(!text) return U.toast('Write something first');
        App.closeSheet();
        await load();
        let series = []; try { series = await Data.series(); } catch(err){}
        const now = Date.now();
        const have = [
          ...drafts.slice(0, 40).map(x => `draft ${x.id} · ${kindLabel(x.kind)} · ${titleOf(x)}`),
          ...(cal.months || []).filter(m => m.endDate && Months.ts(m.endDate) >= now - 864e5 * 7).map(m => `month ${m.id} · ${m.name}${m.challenge ? ' — ' + m.challenge : ''}`),
          ...(cal.quarters || []).filter(q => q.endDate >= now && (q.topic || q.challenge)).map(q => `quarter ${q.id} · ${q.name}${q.topic ? ' — ' + q.topic : ''}`),
          ...series.slice(0, 40).map(x => `series ${x.id} · ${x.title}`),
          ...(cal.weeks || []).filter(w => w.ep).map(w => `episode ${w.ep.id} · week of ${w.sun} · ${w.ep.title || ''}`)
        ];
        const a = await ShotAI.askText(`Sort Kris's brain dump for his content planner. Don't plan anything, don't add ideas, keep his words.
Kinds: vlog (one week's episode of his weekly vlog), series (a run of videos for a channel series), video (one video), month (a month's challenge), quarter (a 13-week block).

What he already has (type id · what it is):
${have.length ? have.join('\n') : '(nothing yet)'}

If an idea clearly belongs with one of those, add it there: set "addTo" to that type and id. Otherwise leave "addTo" out and it becomes a new draft.

The brain dump:
<<<
${text}
>>>

Reply with ONLY a JSON array, no prose, no code fences:
[ { "kind": "vlog" | "series" | "video" | "month" | "quarter", "title": "a few words", "idea": "his words for this idea", "addTo": { "type": "draft" | "month" | "quarter" | "series" | "episode", "id": "…" } } ]`, 'Sorting your ideas…', 3000);
        if(!a) return;
        let arr = null;
        try { const raw = a.replace(/```(?:json)?/gi, ''); arr = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)); } catch(err){}
        if(!Array.isArray(arr) || !arr.length) return U.toast('That answer wasn’t a list of ideas — try again');
        await load();
        const KIND_OF = { month:'month', quarter:'quarter', series:'series', episode:'vlog' };
        let made = 0, added = 0, firstId = null;
        for(const x of arr.filter(y => y && (y.idea || y.title)).slice(0, 40)){
          const words = String(x.idea || x.title || '').trim();
          const to = x.addTo && typeof x.addTo === 'object' ? x.addTo : null;
          /* an idea for a draft you have: under it, waiting for Refine */
          let target = to && to.type === 'draft' ? drafts.find(dd => dd.id === to.id) : null;
          /* for something in the Planner: the draft already adding to it, or a new one that does */
          if(!target && to && KIND_OF[to.type]) target = drafts.find(dd => dd.extend && dd.extend.id === to.id) || null;
          if(target){
            target.idea = (target.idea.trim() ? target.idea.trim() + '\n\n' : '') + words;
            if(target.thread.some(t => t.role === 'gist')) target.thread.push({ role:'note', text:words, added:true, at:Date.now() });
            target.updatedAt = Date.now(); added++; firstId = firstId || target.id;
            continue;
          }
          const seed = { kind: KINDS.some(k => k.k === x.kind) ? x.kind : 'auto', title:String(x.title || '').slice(0, 70), idea:words };
          if(to && KIND_OF[to.type]){
            seed.kind = KIND_OF[to.type]; seed.extend = { kind:seed.kind, id:to.id };
            if(to.type === 'month'){ const m = (cal.months || []).find(mm => mm.id === to.id); if(m){ seed.monthStart = m.startDate; seed.monthEnd = m.endDate; } }
            if(to.type === 'quarter') seed.quarterId = to.id;
            if(to.type === 'series'){ const sr = series.find(ss => ss.id === to.id); if(sr){ seed.series = sr.title; seed.channel = sr.channel || ''; } }
            if(to.type === 'episode'){ const w = (cal.weeks || []).find(ww => ww.ep && ww.ep.id === to.id); if(w) seed.weekOf = w.sun; }
          }
          const nd = blank(seed);
          drafts.unshift(nd); made++; firstId = firstId || nd.id;
        }
        if(firstId) current = firstId;
        await persist();
        U.toast([made ? `${made} new draft${made === 1 ? '' : 's'}` : '', added ? `${added} added to what you have` : ''].filter(Boolean).join(' · ') || 'Nothing to sort');
        if(after) after();
      });
    });
  }

  /* a new draft from anywhere, already knowing what it is and what's above it */
  async function start(seed){
    await load();
    const nd = blank(seed || {});
    drafts.unshift(nd); current = nd.id;
    await persist();
    const onDraft = App.planner && document.querySelector('.tabbar [data-tab="draft"][aria-current]');
    if(onDraft && ViewDraft._draw) ViewDraft._draw();
    else if(App.planner) App.go('draft');
    else Screens.push('plan-draft', {});
    return nd;
  }
  /* "✦ Plan with Claude" on a quarter, a month, an episode or the Months list:
     data-plan-claude holds the seed; an episode gives its week number */
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-plan-claude]');
    if(!b) return;
    e.preventDefault(); e.stopPropagation();
    let seed = {};
    try { seed = JSON.parse(b.dataset.planClaude || '{}'); } catch(err){}
    if(seed.week != null && !seed.weekOf){ try { seed.weekOf = Months.snapSunday(await Data.weekStartOf(+seed.week)); } catch(err){} }
    delete seed.week;
    if(App.planner) while(Screens.depth && Screens.depth()) Screens.pop();   /* the Planner: over to the Draft tab */
    start(seed);
  }, true);

  /* the full app: Draft as a screen (the Plan with Claude buttons) */
  if(global.Screens && Screens.register) Screens.register('plan-draft', async el => {
    el.innerHTML = Screens.bar({ kicker:'Plan with Claude', title:'Draft' }) + '<div class="drf-host" style="flex:1;overflow:auto"></div>';
    await ViewDraft.mount(el.querySelector('.drf-host'));
  });

  global.ViewDraft = ViewDraft;
  global.PlanDraft = { start, gistPrompt, planPrompt, readPlan, gistHTML, kindFrom, children, quarterMonths, monthEndFor, brainDump, existingFor, KINDS };
})(window);
