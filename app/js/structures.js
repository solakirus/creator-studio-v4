/* v4: structures — the beats a video is built on, and the script said over
   each shot.

   A structure is a named run of beats (Hook → Open the loop → Context → Build
   → Payoff → Call to action), each with a line on what it is for and a first
   shot to suggest. Pick one on a clip or a series video and its beats become
   the flow; the shots sit under the beat they belong to (sub.beat), each with
   its script lines ([{ k:'vo'|'cam'|'txt', t, hook? }] on the step, see
   shotlist.js). The same lines show under each step on the Shoot tab, behind
   a reveal in shoot mode, and beside each cut on the Edit tab.

     Structures.all() / custom() / saveCustom(list) / get(id)
     Structures.script(container, opts)   the beats with their shots and lines
     Structures.cuts(container, opts)     the Edit tab's cut list
       opts: { host,                      a ShotList host (hostClip / hostVideo)
               plan: () => object,        where beats, beatGuide, structure, hook live
               savePlan: async () => {},  write that object now
               onChange: async () => {},  after the shots were saved (pull them back)
               onStats: s => {},          { shots, withLines, words, secs }
               taken: i => bool|null }    cuts: whether shot i is filmed
     Structures.pick(opts)                the sheet to choose / make / edit one
     Structures.setHook(opts, text)       the hook is shot 1's first line */
(function(global){
  const esc = s => U.esc(s);
  const KEY = 'structures';
  const KINDS = [['vo', 'VO'], ['cam', 'On cam'], ['txt', 'Text']];
  const KIND_NAME = { vo:'VO', cam:'On cam', txt:'Text' };

  const B = (n, g, role, shot) => ({ n, g, role, shot });
  const BUILTIN = [
    { id:'b-loop', n:'Open loop', d:'Hook them, tease the payoff, make them wait for it', beats:[
      B('Hook', 'Stop the scroll in three seconds — the result or the boldest line first.', 'Action', 'The result, first'),
      B('Open the loop', 'Tease what is coming without giving it away.', 'Talking', 'Tease the payoff'),
      B('Context', 'Why it matters to them, in a line or two.', 'B-roll', 'Set the scene'),
      B('Build', 'The steps or the escalation, each a little bigger than the last.', 'Action', 'The build'),
      B('Payoff', 'Close the loop you opened. Deliver the promise.', 'Reaction', 'The payoff'),
      B('Call to action', 'One ask, said plainly.', 'Talking', 'The ask') ] },
    { id:'b-problem', n:'Problem → solution', d:'Name the pain, make it hurt, fix it, prove it', beats:[
      B('Hook', 'Name the pain in their words.', 'Talking', 'Say the problem'),
      B('Problem', 'Show it happening.', 'Action', 'The problem, on camera'),
      B('Twist the knife', 'What it costs them if nothing changes.', 'B-roll', 'What it costs'),
      B('Solution', 'The fix, shown — not described.', 'Action', 'The fix'),
      B('Proof', 'Before and after, or the result.', 'Insert', 'The proof'),
      B('Call to action', 'One ask, said plainly.', 'Talking', 'The ask') ] },
    { id:'b-story', n:'Story arc', d:'Start in the middle, then how you got there', beats:[
      B('Cold open', 'Drop them in the middle of the action.', 'Action', 'The middle of it'),
      B('Setup', 'Who, where, and what is at stake.', 'Talking', 'Where we are'),
      B('Conflict', 'What goes wrong.', 'Action', 'It goes wrong'),
      B('Turn', 'The moment it changes.', 'Reaction', 'The turn'),
      B('Resolution', 'How it ends.', 'B-roll', 'How it ends'),
      B('Lesson', 'What it means for them.', 'Talking', 'What it means') ] },
    { id:'b-list', n:'Countdown list', d:'Promise a number, keep the best for last', beats:[
      B('Hook', 'Promise the list and what they get from it.', 'Talking', 'Promise the list'),
      B('Number 3', 'The good one.', 'Action', 'Number 3'),
      B('Number 2', 'The better one.', 'Action', 'Number 2'),
      B('Number 1', 'The best one, last.', 'Action', 'Number 1'),
      B('Bonus', 'One they did not see coming.', 'Insert', 'The bonus'),
      B('Call to action', 'One ask, said plainly.', 'Talking', 'The ask') ] },
    { id:'b-transform', n:'Before → after', d:'Show the after, then earn it', beats:[
      B('Hook', 'The after, first.', 'Action', 'The after'),
      B('Before', 'How it was.', 'B-roll', 'How it was'),
      B('Process', 'The work, in fast cuts.', 'Insert', 'The work'),
      B('Reveal', 'The after, properly this time.', 'Reaction', 'The reveal'),
      B('Call to action', 'One ask, said plainly.', 'Talking', 'The ask') ] },
    { id:'b-tutorial', n:'Tutorial', d:'The result, the steps, the result again', beats:[
      B('Hook', 'Show the finished result.', 'Action', 'The finished result'),
      B('What you need', 'Tools and parts, laid out.', 'Insert', 'What you need'),
      B('Step 1', '', 'Action', 'Step 1'),
      B('Step 2', '', 'Action', 'Step 2'),
      B('Step 3', '', 'Action', 'Step 3'),
      B('Result', 'Back to the result — now they know how.', 'B-roll', 'The result'),
      B('Call to action', 'One ask, said plainly.', 'Talking', 'The ask') ] },
    { id:'b-vlog', n:'Day in the life', d:'For a vlog or an episode', beats:[
      B('Cold open', 'The best moment of the day, first.', 'Action', 'The best moment'),
      B('Morning', 'How the day starts.', 'B-roll', 'Morning'),
      B('The main thing', 'What the day is really about.', 'Action', 'The main thing'),
      B('Quiet moment', 'A reflection, to camera.', 'Talking', 'A quiet moment'),
      B('Wrap up', 'What tomorrow brings.', 'Talking', 'Wrap up') ] }
  ];

  async function custom(){ try { return (await Store.get('settings', KEY)) || []; } catch(e){ return []; } }
  async function saveCustom(list){ await Store.put('settings', list, KEY); }
  async function all(){ return BUILTIN.concat(await custom()); }
  async function get(id){ return (await all()).find(x => x.id === id) || null; }

  /* ------------------------------------------------------------ the shots */
  const MAX = () => (global.Notebook && Notebook.MAX_STEPS) || 14;
  const slots = t => (t && t.page && t.page.slots) || [];
  const stepOf = (t, i) => (t.subs || []).find(x => x.shot === i) || null;
  function ensureStep(t, i){
    let s2 = stepOf(t, i);
    if(!s2){ s2 = { t:(slots(t)[i] || {}).text || `Shot ${i + 1}`, done:false, shot:i, pg:1 }; t.subs = (t.subs || []).concat(s2); }
    return s2;
  }
  /* the beat each shot is in: its own, else the one before it, else the first */
  function beatsOf(t, nBeats){
    let cur = 0;
    return slots(t).map((_, i) => {
      const s2 = stepOf(t, i);
      if(s2 && s2.beat != null && s2.beat >= 0 && s2.beat < nBeats) cur = s2.beat;
      return nBeats ? cur : -1;
    });
  }
  const words = s => (String(s || '').trim().match(/\S+/g) || []).length;
  function stats(t){
    const sl = slots(t);
    let w = 0, withLines = 0;
    sl.forEach((_, i) => {
      const ls = (stepOf(t, i) || {}).lines || [];
      if(ls.some(l => String(l.t || '').trim())) withLines++;
      ls.forEach(l => { if(l.k !== 'txt') w += words(l.t); });
    });
    return { shots:sl.length, withLines, words:w, secs:Math.round(w / 150 * 60) };
  }
  const secsLabel = s => s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /* a fresh shot on the page (and its step) — at the end, in beat b */
  function addShot(t, b, text, role){
    if(!t.page){
      if(!global.Notebook) return -1;
      t.page = Notebook.stepsPage(t.title || 'Shots');
      t.page.name = 'Shot sequence · ' + (t.title || 'Shots');
      t.page.slots = [];
      delete t.pageOff;
    }
    if(slots(t).length >= MAX()) return -1;
    t.page.slots.push({ item:'', tone:'', text:text || '', role:role || '', done:false });
    const i = t.page.slots.length - 1;
    t.subs = (t.subs || []).concat({ t:text || `Shot ${i + 1}`, done:false, shot:i, pg:1, ...(b != null && b >= 0 ? { beat:b } : {}) });
    return i;
  }

  /* the hook line: the first line of the first shot in story order */
  function hookLine(t){
    for(let i = 0; i < slots(t).length; i++){
      const ls = (stepOf(t, i) || {}).lines || [];
      const h = ls.find(l => l.hook);
      if(h) return { i, l:h };
    }
    return null;
  }
  function firstInStory(t, nBeats){
    const bo = beatsOf(t, nBeats);
    let best = -1;
    bo.forEach((b, i) => { if(best < 0 || (nBeats && b < bo[best])) best = i; });
    return best;
  }
  /* put the hook on its shot; returns true when the shots changed */
  function placeHook(t, text, nBeats){
    const v = String(text || '').trim();
    const h = hookLine(t);
    if(h){
      if(!v){ const s2 = stepOf(t, h.i); s2.lines = s2.lines.filter(l => l !== h.l); return true; }
      if(h.l.t === v) return false;
      h.l.t = v; return true;
    }
    if(!v) return false;
    const i = firstInStory(t, nBeats);
    if(i < 0) return false;
    const s2 = ensureStep(t, i);
    s2.lines = [{ k:'vo', t:v, hook:true }].concat(s2.lines || []);
    return true;
  }

  /* ------------------------------------------------------------ the look */
  const CSS = `
  .st-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px}
  .st-head .k,.st .k{font-family:var(--display),sans-serif;font-weight:900;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .st-head b{font-size:15px;flex:1;min-width:120px}
  .st-jump{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
  .st-jump button{height:32px;padding:0 11px;border:1px solid var(--line);border-radius:16px;background:transparent;color:var(--cream);font:inherit;font-size:13px;cursor:pointer}
  .st-jump button i{font-style:normal;color:var(--muted);margin-left:5px}
  .st-jump button:hover{border-color:var(--orange)}
  .st-beat{border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);margin:0 0 10px;scroll-margin-top:60px}
  .st-bh{display:flex;align-items:center;gap:8px;padding:9px 10px 6px}
  .st-bh .n{width:24px;height:24px;flex:0 0 24px;border-radius:50%;background:var(--orange);color:#151515;font-family:var(--display),sans-serif;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center}
  .st-bn{flex:1;min-width:0;padding:3px 6px;border:1px solid transparent;border-radius:var(--r);background:transparent;color:var(--cream);font-family:var(--display),sans-serif;font-weight:900;font-size:16px;outline:none}
  .st-bn:hover{border-color:var(--line)}.st-bn:focus{border-color:var(--orange);background:var(--bg)}
  .st-bh .cnt{color:var(--muted);font-size:12.5px;white-space:nowrap}
  .st-bh .mini{width:30px;height:30px;flex:0 0 30px;padding:0;border:1px solid var(--line);border-radius:var(--r);background:transparent;color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center}
  .st-bh .mini svg{width:14px;height:14px}
  .st-bh .mini:disabled{opacity:.3;cursor:default}
  .st-guide{margin:0 12px 8px 42px;color:var(--muted);font-size:13px;line-height:1.45}
  .st-shots{display:flex;flex-direction:column;gap:6px;padding:0 10px 10px}
  .st-shot{display:flex;gap:10px;padding:10px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg)}
  .st-shot .side{display:flex;flex-direction:column;align-items:center;gap:5px;flex:0 0 44px}
  .st-shot .no{color:var(--dim);font-size:12px}
  .st-pic{width:44px;height:54px;border-radius:3px;overflow:hidden;border:1px solid var(--line);background:var(--surface-2);display:block}
  .st-pic img,.st-pic video{width:100%;height:100%;object-fit:cover;display:block}
  .st-pic.none{border-style:dashed}
  .st-pic i{display:none}
  .st-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
  .st-sh{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .st-role{font-family:var(--display),sans-serif;font-weight:900;font-size:10px;letter-spacing:.09em;text-transform:uppercase;padding:3px 7px;border-radius:3px;background:rgba(237,229,210,.1);color:var(--cream)}
  .st-sn{flex:1;min-width:140px;padding:3px 6px;border:1px solid transparent;border-radius:var(--r);background:transparent;color:var(--cream);font:inherit;font-size:14.5px;font-weight:700;outline:none}
  .st-sn:hover{border-color:var(--line)}.st-sn:focus{border-color:var(--orange);background:var(--surface-2)}
  .st-mv{height:28px;max-width:150px;padding:0 6px;border:1px solid var(--line);border-radius:var(--r);background:transparent;color:var(--muted);font:inherit;font-size:12px}
  .st-ln{display:flex;align-items:flex-start;gap:6px}
  .st-lk{height:26px;flex:0 0 auto;padding:0 4px;border:0;border-radius:3px;font-family:var(--display),sans-serif;font-weight:900;font-size:10px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;margin-top:2px}
  .st-lk.vo,.tk-lk.vo{background:#3A2A14;color:#F2C27A}.st-lk.cam,.tk-lk.cam{background:#1E3324;color:#7FD08C}.st-lk.txt,.tk-lk.txt{background:#22283A;color:#9DB5E8}
  .st-lk option{background:var(--surface-2);color:var(--cream)}
  .st-hook{font-family:var(--display),sans-serif;font-weight:900;font-size:9.5px;letter-spacing:.08em;background:var(--orange);color:#151515;padding:3px 5px;border-radius:3px;margin-top:4px;flex:0 0 auto}
  .st-lt{flex:1;min-width:0;min-height:30px;resize:none;overflow:hidden;padding:4px 7px;border:1px solid transparent;border-radius:var(--r);background:transparent;color:var(--cream);font:inherit;font-size:14.5px;line-height:1.45;outline:none}
  .st-lt:hover{border-color:var(--line)}.st-lt:focus{border-color:var(--orange);background:var(--surface-2)}
  .st-lrm{width:26px;height:26px;flex:0 0 26px;padding:0;border:0;background:none;color:var(--dim);font-size:17px;cursor:pointer;margin-top:2px}
  .st-lrm:hover{color:var(--red)}
  .st-add{align-self:flex-start;height:28px;padding:0 10px;border:1px solid var(--line);border-radius:var(--r);background:transparent;color:var(--muted);font:inherit;font-size:12.5px;cursor:pointer}
  .st-add:hover{border-color:var(--orange);color:var(--cream)}
  .st-none{margin:0;color:var(--dim);font-size:13px}
  .st-foot{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
  .st-foot .btn-ghost{flex:1 1 220px;margin:0}
  .st-cut{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.4fr) minmax(0,1fr);gap:12px;padding:10px;border-top:1px solid var(--line);align-items:start}
  .st-cut:first-child{border-top:0}
  .st-cut .who{display:flex;gap:9px;align-items:flex-start;min-width:0}
  .st-cut .who b{display:block;font-size:14px;font-weight:600;line-height:1.3}
  .st-cut .taken{font-size:12px;color:var(--green)}.st-cut .taken.no{color:var(--dim)}
  .st-cut .said{display:flex;flex-direction:column;gap:5px;font-size:14px;line-height:1.45}
  .st-cut .said .l{display:flex;gap:7px;align-items:baseline}
  .st-tag{font-family:var(--display),sans-serif;font-weight:900;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-radius:3px;flex:0 0 auto}
  .st-tag.vo{background:#3A2A14;color:#F2C27A}.st-tag.cam{background:#1E3324;color:#7FD08C}.st-tag.txt{background:#22283A;color:#9DB5E8}
  .st-en{width:100%;min-height:36px;resize:none;overflow:hidden;padding:7px 9px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit;font-size:13.5px;line-height:1.4;outline:none;box-sizing:border-box}
  .st-en:focus{border-color:var(--orange)}
  .st-cuthead{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.4fr) minmax(0,1fr);gap:12px;padding:0 10px 6px}
  @media (max-width:700px){ .st-cut,.st-cuthead{grid-template-columns:1fr} .st-cuthead span:not(:first-child){display:none} }
  .st-pick{display:flex;gap:8px;align-items:stretch;margin:0 0 7px}
  .st-pick .vt-pick{flex:1;margin:0}
  .st-pick .vt-pick em{display:block;font-style:normal;margin-top:5px;font-size:12px;color:var(--orange);line-height:1.4}
  .st-ed{display:flex;flex-direction:column;gap:6px;padding:9px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);margin:0 0 7px}
  .st-ed .r{display:flex;gap:6px;align-items:center}
  .st-ed input,.st-ed select{height:36px;min-width:0;padding:0 8px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit;font-size:14px}
  .st-ed input.nm{flex:1;font-weight:700}
  .st-ed button{width:34px;height:34px;flex:0 0 34px;padding:0;border:1px solid var(--line);border-radius:var(--r);background:transparent;color:var(--muted);cursor:pointer}`;
  function css(){
    if(document.getElementById('st-css')) return;
    const st = document.createElement('style'); st.id = 'st-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
  const DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  const kindSel = (cls, attr, k) => `<select class="${cls} ${k}" ${attr} aria-label="What kind of line">${KINDS.map(([v, n]) => `<option value="${v}" ${k === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  const pic = sl => sl.item ? `<span class="st-pic" data-slpic="${esc(sl.item)}"></span>` : '<span class="st-pic none"></span>';
  const grow = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };

  /* ------------------------------------------------------------ the views */
  function view(container, opts, mode){
    css(); if(global.ShotList) ShotList.css();
    let t = null;
    let uidp = 'st' + Math.random().toString(36).slice(2, 7);
    const P = () => opts.plan() || {};
    const beats = () => { const p = P(); if(!Array.isArray(p.beats)) p.beats = []; return p.beats; };
    const guides = () => { const p = P(); if(!Array.isArray(p.beatGuide)) p.beatGuide = []; return p.beatGuide; };

    async function load(){
      t = await opts.host.load();
      if(!t) return;
      /* the hook and shot 1's hook line are one: whichever was written last */
      if(mode === 'script'){
        const h = hookLine(t), p = P();
        if(h && h.l.t !== (p.hook || '')){
          /* the line was changed on the shot (here, or under a step) after the box: the box follows */
          if((h.l.at || 0) > (p.hookT || 0)){ p.hook = h.l.t; await opts.savePlan(); }
          else if(placeHook(t, p.hook, beats().length)) await persist(false);
        }
        else if(!h && (p.hook || '').trim() && placeHook(t, p.hook, beats().length)) await persist(false);
      }
    }
    async function persist(redraw){
      if(opts.flush) await opts.flush();
      if(global.TaskPages && t.page) TaskPages.match(t);
      await opts.host.save(t);
      t = await opts.host.load();
      if(opts.onChange) await opts.onChange();
      if(redraw !== false) draw();
      else stat();
    }
    function stat(){ if(opts.onStats && t) opts.onStats(stats(t)); }

    function lineRow(i, j, l){
      return `<div class="st-ln">${kindSel('st-lk', `data-lk="${i}:${j}"`, l.k || 'vo')}${l.hook ? '<span class="st-hook" title="The hook — the same words as the Hook box">HOOK</span>' : ''}
        <textarea class="st-lt" rows="1" data-lt="${i}:${j}" placeholder="${l.k === 'txt' ? 'Words on screen' : 'What is said over this shot'}">${esc(l.t || '')}</textarea>
        <button class="st-lrm" data-lrm="${i}:${j}" aria-label="Remove this line">×</button></div>`;
    }
    function shotCard(i, n){
      const sl = slots(t)[i] || {}, s2 = stepOf(t, i) || {};
      const ls = s2.lines || [];
      const bn = beats();
      return `<div class="st-shot" data-shot="${i}">
        <span class="side"><span class="no">${String(i + 1).padStart(2, '0')}</span>${pic(sl)}</span>
        <div class="st-body">
          <div class="st-sh">${sl.role ? `<span class="st-role">${esc(sl.role)}</span>` : ''}
            <input class="st-sn" data-sn="${i}" value="${esc(sl.text || '')}" placeholder="Shot ${i + 1} — name it" aria-label="Shot ${i + 1} name">
            ${bn.length > 1 ? `<select class="st-mv" data-sbeat="${i}" aria-label="Which beat this shot is in">${bn.map((b, k) =>
              `<option value="${k}" ${n === k ? 'selected' : ''}>${esc(b || 'Beat ' + (k + 1))}</option>`).join('')}</select>` : ''}
          </div>
          ${ls.length ? ls.map((l, j) => lineRow(i, j, l)).join('') : '<p class="st-none">No lines yet — fine if this shot is sound or picture only.</p>'}
          <button class="st-add" data-ladd="${i}">+ Add a line</button>
        </div></div>`;
    }
    function cutRow(i){
      const sl = slots(t)[i] || {}, s2 = stepOf(t, i) || {};
      const ls = (s2.lines || []).filter(l => String(l.t || '').trim());
      const tk = opts.taken ? opts.taken(i) : !!s2.done;
      return `<div class="st-cut" data-shot="${i}">
        <div class="who"><span class="side" style="display:flex;flex-direction:column;align-items:center;gap:4px"><span class="no" style="color:var(--dim);font-size:12px">${String(i + 1).padStart(2, '0')}</span>${pic(sl)}</span>
          <span style="min-width:0">${sl.role ? `<span class="st-role">${esc(sl.role)}</span>` : ''}<b>${esc(sl.text || 'Shot ' + (i + 1))}</b>
          <span class="taken${tk ? '' : ' no'}">${tk ? '✓ Taken' : 'Not taken yet'}</span></span></div>
        <div class="said">${ls.length ? ls.map(l => `<span class="l"><span class="st-tag ${l.k || 'vo'}">${KIND_NAME[l.k] || 'VO'}</span><span>${esc(l.t)}</span></span>`).join('')
          : '<span style="color:var(--dim);font-size:13px">No words — let it breathe</span>'}</div>
        <textarea class="st-en" rows="1" data-en="${i}" placeholder="Note for the edit — take, trim, effect…" aria-label="Edit note for shot ${i + 1}">${esc(s2.editNote || '')}</textarea>
      </div>`;
    }

    function draw(){
      if(!container.isConnected) return;
      if(!t){ container.innerHTML = '<p class="st-none">This one is gone.</p>'; return; }
      const bn = beats(), gd = guides(), n = slots(t).length;
      const bo = beatsOf(t, bn.length);
      const groups = bn.map((_, k) => bo.map((b, i) => b === k ? i : -1).filter(i => i >= 0));
      const p = P();
      if(mode === 'cuts'){
        container.innerHTML = !n ? '<p class="st-none">No shots yet — add them on the Plan or Shoot tab.</p>' : `
          <div class="st-cuthead"><span class="k">The shot</span><span class="k">Over this cut</span><span class="k">Edit note</span></div>
          ${bn.length ? bn.map((b, k) => groups[k].length ? `<p class="k" style="margin:12px 10px 4px;color:var(--orange)">${k + 1} · ${esc(b || 'Beat ' + (k + 1))}</p>
            <div>${groups[k].map(i => cutRow(i)).join('')}</div>` : '').join('') : `<div>${slots(t).map((_, i) => cutRow(i)).join('')}</div>`}`;
        container.querySelectorAll('.st-en').forEach(grow);
        if(global.ShotList) ShotList.fillPics(container);
        return stat();
      }
      container.innerHTML = `<div class="st">
        <div class="st-head"><span class="k">Structure</span>
          <b>${p.structure && p.structure.name ? esc(p.structure.name) : bn.length ? 'Your own beats' : 'None yet'}</b>
          <button class="btn-sm" data-st="pick">${bn.length ? 'Change' : 'Pick a structure'}</button></div>
        ${bn.length ? `<div class="st-jump">${bn.map((b, k) => `<button data-stjump="${k}">${esc(b || 'Beat ' + (k + 1))}<i>${groups[k].length}</i></button>`).join('')}</div>` : ''}
        ${bn.length ? bn.map((b, k) => `
          <section class="st-beat" id="${uidp}-${k}">
            <div class="st-bh"><span class="n">${k + 1}</span>
              <input class="st-bn" data-bn="${k}" value="${esc(b)}" placeholder="Beat ${k + 1}" aria-label="Beat ${k + 1} name">
              <span class="cnt">${groups[k].length} shot${groups[k].length === 1 ? '' : 's'}</span>
              <button class="mini" data-bmv="${k}:-1" ${k === 0 ? 'disabled' : ''} aria-label="Move this beat up">${UP}</button>
              <button class="mini" data-bmv="${k}:1" ${k === bn.length - 1 ? 'disabled' : ''} aria-label="Move this beat down">${DOWN}</button>
              <button class="mini" data-brm="${k}" aria-label="Remove this beat">×</button></div>
            ${gd[k] ? `<p class="st-guide">${esc(gd[k])}</p>` : ''}
            <div class="st-shots">${groups[k].map(i => shotCard(i, k)).join('')}
              <button class="st-add" data-sadd="${k}">+ Add a shot to ${esc(b || 'this beat')}</button></div>
          </section>`).join('')
        : `<div class="st-shots" style="padding:0">${slots(t).map((_, i) => shotCard(i, -1)).join('') || '<p class="st-none">No shots yet.</p>'}
            <button class="st-add" data-sadd="-1">+ Add a shot</button></div>`}
        <div class="st-foot">
          <button class="btn-ghost" data-st="addbeat">+ Add a beat</button>
          <button class="btn-ghost" data-st="paste">Paste a whole script — split it across the shots</button>
        </div></div>`;
      container.querySelectorAll('.st-lt').forEach(grow);
      if(global.ShotList) ShotList.fillPics(container);
      stat();
    }

    /* a beat removed or moved: every shot's beat follows */
    function remapBeats(fn){
      const bo = beatsOf(t, beats().length);
      slots(t).forEach((_, i) => { const s2 = ensureStep(t, i); s2.beat = fn(bo[i]); });
    }

    container.addEventListener('click', async e => {
      e.stopPropagation();
      const a = e.target.closest('[data-st]');
      if(a){
        if(a.dataset.st === 'pick') return pick({ ...opts, apply:applyTpl, saveFrom: () => ({ beats:beats().slice(), guides:guides().slice(),
          shots:beats().map((_, k) => { const i = beatsOf(t, beats().length).indexOf(k); return i >= 0 ? (slots(t)[i] || {}) : {}; }) }) });
        if(a.dataset.st === 'addbeat'){
          beats().push(''); guides().length = Math.min(guides().length, beats().length);
          await opts.savePlan(); draw();
          const ins = container.querySelectorAll('.st-bn'); if(ins.length) ins[ins.length - 1].focus();
          return;
        }
        if(a.dataset.st === 'paste') return pasteSheet();
      }
      const jp = e.target.closest('[data-stjump]');
      if(jp){ const sec = container.querySelector(`#${uidp}-${jp.dataset.stjump}`); if(sec) sec.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
      const sa = e.target.closest('[data-sadd]');
      if(sa){
        const k = +sa.dataset.sadd;
        const i = addShot(t, k, '', '');
        if(i < 0) return U.toast(`The shot page holds ${MAX()} shots at most`);
        await persist();
        const f = container.querySelector(`[data-sn="${i}"]`); if(f) f.focus();
        return;
      }
      const la = e.target.closest('[data-ladd]');
      if(la){
        const i = +la.dataset.ladd, s2 = ensureStep(t, i);
        s2.lines = (s2.lines || []).concat({ k:'vo', t:'' });
        await persist();
        const f = container.querySelector(`[data-lt="${i}:${s2.lines.length - 1}"]`); if(f) f.focus();
        return;
      }
      const lr = e.target.closest('[data-lrm]');
      if(lr){
        const [i, j] = lr.dataset.lrm.split(':').map(Number), s2 = stepOf(t, i);
        if(!s2 || !s2.lines) return;
        const gone = s2.lines.splice(j, 1)[0];
        if(gone && gone.hook){ P().hook = ''; await opts.savePlan(); }
        return persist();
      }
      const bm = e.target.closest('[data-bmv]');
      if(bm){
        const [k, d] = bm.dataset.bmv.split(':').map(Number), j = k + d, bn = beats(), gd = guides();
        if(j < 0 || j >= bn.length) return;
        remapBeats(b => b === k ? j : b === j ? k : b);
        [bn[k], bn[j]] = [bn[j], bn[k]];
        while(gd.length < bn.length) gd.push('');
        [gd[k], gd[j]] = [gd[j], gd[k]];
        await opts.savePlan();
        return persist();
      }
      const br = e.target.closest('[data-brm]');
      if(br){
        const k = +br.dataset.brm, bn = beats(), gd = guides();
        const n = beatsOf(t, bn.length).filter(b => b === k).length;
        if(n && !confirm(`Remove “${bn[k] || 'this beat'}”? Its ${n} shot${n === 1 ? '' : 's'} stay, in the beat before it.`)) return;
        remapBeats(b => b === k ? Math.max(0, k - 1) : b > k ? b - 1 : b);
        bn.splice(k, 1); gd.splice(k, 1);
        if(!bn.length){ slots(t).forEach((_, i) => { const s2 = stepOf(t, i); if(s2) delete s2.beat; }); P().structure = null; }
        await opts.savePlan();
        return persist();
      }
    });
    container.addEventListener('input', e => {
      if(e.target.matches('.st-lt,.st-en')) grow(e.target);
    });
    container.addEventListener('keydown', e => {
      if(e.target.matches('.st-sn,.st-bn') && e.key === 'Enter'){ e.preventDefault(); e.target.blur(); }
    });
    container.addEventListener('change', async e => {
      e.stopPropagation();
      const f = e.target;
      if(f.dataset.bn != null){ beats()[+f.dataset.bn] = f.value.trim(); await opts.savePlan(); return; }
      if(f.dataset.sn != null){
        const i = +f.dataset.sn, sl = slots(t)[i];
        if(!sl) return;
        sl.text = f.value.trim();
        const s2 = ensureStep(t, i); s2.t = sl.text || `Shot ${i + 1}`;
        return persist(false);
      }
      if(f.dataset.sbeat != null){ ensureStep(t, +f.dataset.sbeat).beat = +f.value; return persist(); }
      if(f.dataset.lk != null){
        const [i, j] = f.dataset.lk.split(':').map(Number), s2 = stepOf(t, i);
        if(!s2 || !s2.lines || !s2.lines[j]) return;
        s2.lines[j].k = f.value; f.className = 'st-lk ' + f.value;
        return persist(false);
      }
      if(f.dataset.lt != null){
        const [i, j] = f.dataset.lt.split(':').map(Number), s2 = stepOf(t, i);
        if(!s2 || !s2.lines || !s2.lines[j]) return;
        s2.lines[j].t = f.value.trim();
        if(s2.lines[j].hook){ s2.lines[j].at = Date.now(); P().hook = s2.lines[j].t; P().hookT = s2.lines[j].at; await opts.savePlan(); if(opts.onHook) opts.onHook(P().hook); }
        return persist(false);
      }
      if(f.dataset.en != null){
        const s2 = ensureStep(t, +f.dataset.en), v = f.value.trim();
        if(v) s2.editNote = v; else delete s2.editNote;
        return persist(false);
      }
    });

    /* a structure picked: its beats become the flow. No shots yet → one per
       beat, from the structure. Shots already here → spread across the beats
       in order (move any of them with its beat menu). */
    async function applyTpl(tpl){
      const p = P(), n = slots(t).length;
      if(beats().filter(Boolean).length && !confirm(`Use “${tpl.n}”? Its beats take the place of the ${beats().length} here; your shots and lines stay.`)) return false;
      p.beats = tpl.beats.map(b => b.n);
      p.beatGuide = tpl.beats.map(b => b.g || '');
      p.structure = { id:tpl.id, name:tpl.n };
      if(!n){
        tpl.beats.forEach((b, k) => addShot(t, k, b.shot || b.n, b.role || ''));
      } else {
        const B2 = p.beats.length;
        slots(t).forEach((_, i) => { ensureStep(t, i).beat = Math.min(B2 - 1, Math.floor(i * B2 / n)); });
      }
      if((p.hook || '').trim()){ const h = hookLine(t); if(h){ const s2 = stepOf(t, h.i); s2.lines = s2.lines.filter(l => !l.hook); } placeHook(t, p.hook, p.beats.length); }
      await opts.savePlan();
      await persist();
      U.toast(n ? `${tpl.n} — your ${n} shots are spread across its beats` : `${tpl.n} — a shot for each beat`);
      return true;
    }

    /* a whole script pasted (or the old one kept on the clip): split at blank
       lines, one piece per shot, in story order; more pieces than shots make
       new shots */
    function pasteSheet(){
      const old = P().script || '';
      App.sheet(`<h2 style="margin:0 0 4px">Split a script across the shots</h2>
        <p class="hintline" style="margin:0 0 10px">Leave a blank line between the parts — each part goes on the next shot. A line starting “TEXT:” goes on screen, “CAM:” is said to camera, the rest is voiceover.</p>
        <textarea class="cp-script" data-paste style="min-height:220px">${esc(old)}</textarea>
        <div class="sheetcta"><button class="btn-primary" data-ok>Split it</button><button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
        sh.addEventListener('click', async ev => {
          if(ev.target.closest('[data-no]')) return App.closeSheet();
          if(!ev.target.closest('[data-ok]')) return;
          const text = sh.querySelector('[data-paste]').value;
          const parts = text.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
          if(!parts.length) return U.toast('Nothing to split');
          const bo = beatsOf(t, beats().length);
          let order = slots(t).map((_, i) => i);
          if(beats().length) order.sort((a2, b2) => bo[a2] - bo[b2] || a2 - b2);
          let made = 0, full = false;
          parts.forEach((part, m) => {
            let i = order[m];
            if(i == null){ i = addShot(t, beats().length ? beats().length - 1 : -1, '', ''); if(i < 0){ full = true; return; } order.push(i); made++; }
            const s2 = ensureStep(t, i);
            const add = part.split('\n').map(x => x.trim()).filter(Boolean).map(x => {
              const mt = x.match(/^\[?(text|on screen|cam|on cam)\]?\s*:?\s*/i);
              if(mt){ const w = mt[1].toLowerCase(); return { k:w.includes('cam') ? 'cam' : 'txt', t:x.slice(mt[0].length).trim() }; }
              return { k:'vo', t:x.replace(/^\[(vo|hook|beat[^\]]*|b-roll[^\]]*)\]\s*:?\s*/i, '') };
            }).filter(l => l.t);
            s2.lines = (s2.lines || []).concat(add);
          });
          App.closeSheet();
          await persist();
          U.toast(`${parts.length} part${parts.length === 1 ? '' : 's'} on the shots${made ? ` · ${made} new shot${made === 1 ? '' : 's'}` : ''}${full ? ' · the page was full, some were left out' : ''}`);
        });
      });
    }

    const api = {
      async refresh(){ await load(); draw(); },
      async setHook(text){ if(!t) return; if(placeHook(t, text, beats().length)) await persist(mode === 'script'); },
      get task(){ return t; }
    };
    container._st = api;
    (async () => { await load(); draw(); })();
    return api;
  }

  const script = (container, opts) => view(container, opts, 'script');
  const cuts = (container, opts) => view(container, opts, 'cuts');

  /* ------------------------------------------------------------ the sheet */
  async function pick(opts){
    css();
    let list = await all();
    const draw = sh => {
      sh.querySelector('[data-list]').innerHTML = list.map(s => `<div class="st-pick">
        <button class="vt-pick" data-use="${esc(s.id)}"><b>${esc(s.n)}</b><small>${esc(s.d || '')}</small>
          <em>${s.beats.map(b => esc(b.n)).join(' → ')}</em></button>
        ${s.id.startsWith('u') ? `<button class="btn-sm" data-edit="${esc(s.id)}" aria-label="Edit">Edit</button>` : ''}
      </div>`).join('');
    };
    App.sheet(`<h2 style="margin:0 0 4px">Structures</h2>
      <p class="hintline" style="margin:0 0 12px">The beats a video is built on. Pick one and its beats become this one’s flow, with your shots under them.</p>
      <div data-list></div>
      <div class="sheetcta" style="flex-wrap:wrap">
        <button class="btn-ghost" data-new>+ Make your own</button>
        ${opts && opts.saveFrom ? '<button class="btn-ghost" data-savefrom>Save these beats as a structure</button>' : ''}
        <button class="btn-ghost" data-no>Close</button></div>`, sh => {
      draw(sh);
      sh.addEventListener('click', async e => {
        if(e.target.closest('[data-no]')) return App.closeSheet();
        const u = e.target.closest('[data-use]');
        if(u){
          const s = list.find(x => x.id === u.dataset.use);
          if(!s || !opts || !opts.apply) return;
          App.closeSheet();
          return opts.apply(s);
        }
        const ed = e.target.closest('[data-edit]');
        if(ed){ App.closeSheet(); return editor(list.find(x => x.id === ed.dataset.edit), opts); }
        if(e.target.closest('[data-new]')){ App.closeSheet(); return editor(null, opts); }
        if(e.target.closest('[data-savefrom]')){
          const f = opts.saveFrom();
          if(!f.beats.filter(Boolean).length) return U.toast('No beats to save yet');
          App.closeSheet();
          return editor({ id:null, n:'', d:'', beats:f.beats.map((b, k) => ({ n:b, g:f.guides[k] || '', role:(f.shots[k] || {}).role || '', shot:(f.shots[k] || {}).text || '' })) }, opts);
        }
      });
    });
  }

  /* make or change one of your own */
  function editor(s, opts){
    const roles = (global.Notebook && Notebook.ROLES) || [];
    const d = s ? JSON.parse(JSON.stringify(s)) : { id:null, n:'', d:'', beats:[{ n:'Hook', g:'', role:'', shot:'' }] };
    const rows = () => d.beats.map((b, k) => `<div class="st-ed" data-k="${k}">
        <div class="r"><input class="nm" data-f="n" value="${esc(b.n)}" placeholder="Beat ${k + 1} — e.g. Open loop">
          <button data-mv="-1" aria-label="Move up" ${k === 0 ? 'disabled' : ''}>↑</button><button data-mv="1" aria-label="Move down" ${k === d.beats.length - 1 ? 'disabled' : ''}>↓</button>
          <button data-rm aria-label="Remove">×</button></div>
        <input data-f="g" value="${esc(b.g || '')}" placeholder="What it is for — shown under the beat">
        <div class="r"><select data-f="role" aria-label="Its first shot's type"><option value="">Shot type</option>${roles.map(r => `<option ${b.role === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
          <input data-f="shot" value="${esc(b.shot || '')}" placeholder="Its first shot" style="flex:1"></div>
      </div>`).join('');
    App.sheet(`<h2 style="margin:0 0 10px">${s && s.id ? 'Change your structure' : 'Make a structure'}</h2>
      <input class="cp-hook" data-name value="${esc(d.n)}" placeholder="Name it — e.g. Mystery reveal" style="min-height:0;height:44px;margin:0 0 8px">
      <input class="cp-hook" data-desc value="${esc(d.d || '')}" placeholder="One line on when to use it" style="min-height:0;height:44px;margin:0 0 12px">
      <div data-rows>${rows()}</div>
      <button class="btn-ghost" data-addb style="width:100%;margin:4px 0 0">+ Add a beat</button>
      <div class="sheetcta"><button class="btn-primary" data-ok>Save</button>
        ${s && s.id ? '<button class="btn-ghost" data-del style="color:var(--red)">Delete</button>' : ''}
        <button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
      const read = () => {
        d.n = sh.querySelector('[data-name]').value.trim();
        d.d = sh.querySelector('[data-desc]').value.trim();
        sh.querySelectorAll('.st-ed').forEach(r => { const b = d.beats[+r.dataset.k]; if(!b) return;
          r.querySelectorAll('[data-f]').forEach(f => { b[f.dataset.f] = f.value.trim(); }); });
      };
      const redraw = () => { sh.querySelector('[data-rows]').innerHTML = rows(); };
      sh.addEventListener('click', async e => {
        if(e.target.closest('[data-no]')) return App.closeSheet();
        const r = e.target.closest('.st-ed');
        if(e.target.closest('[data-addb]')){ read(); d.beats.push({ n:'', g:'', role:'', shot:'' }); redraw(); const ins = sh.querySelectorAll('.st-ed .nm'); ins[ins.length - 1].focus(); return; }
        if(r && e.target.closest('[data-rm]')){ read(); if(d.beats.length > 1) d.beats.splice(+r.dataset.k, 1); return redraw(); }
        const mv = e.target.closest('[data-mv]');
        if(r && mv){ read(); const k = +r.dataset.k, j = k + +mv.dataset.mv; if(j < 0 || j >= d.beats.length) return; [d.beats[k], d.beats[j]] = [d.beats[j], d.beats[k]]; return redraw(); }
        if(e.target.closest('[data-del]')){
          if(!confirm(`Delete “${d.n || 'this structure'}”? Videos that used it keep their beats.`)) return;
          await saveCustom((await custom()).filter(x => x.id !== d.id));
          App.closeSheet(); U.toast('Deleted');
          return pick(opts);
        }
        if(e.target.closest('[data-ok]')){
          read();
          d.beats = d.beats.filter(b => b.n);
          if(!d.n) return U.toast('Give it a name');
          if(!d.beats.length) return U.toast('Add at least one beat');
          const mine = await custom();
          if(d.id){ const k = mine.findIndex(x => x.id === d.id); if(k >= 0) mine[k] = d; else mine.push(d); }
          else { d.id = 'u' + Date.now().toString(36); mine.push(d); }
          await saveCustom(mine);
          App.closeSheet();
          U.toast('Saved — it shows on every clip and video');
          return pick(opts);
        }
      });
    });
  }

  /* the hook box changed: its words go on shot 1 (one view on screen is enough) */
  async function setHook(container, text){ if(container && container._st) await container._st.setHook(text); }

  global.Structures = { BUILTIN, KINDS, KIND_NAME, all, custom, saveCustom, get, script, cuts, pick, editor, setHook, stats, beatsOf, placeHook, hookLine, secsLabel };
})(window);
