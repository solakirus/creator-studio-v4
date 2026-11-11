/* Creator Studio — paper planner. Day, week and month pages you write on.

   Shared by the laptop Planner and (next) the phone app. Each app hands in a
   few hooks — where its tasks live, how to add one, how to ask the AI — and
   this draws the pages, takes the pen, and keeps the ink.

   Pages are drawn when you open them, for any date. Nothing is made ahead of
   time; only a page you write on is saved, as settings key "paper:<page>":
     paper:day:2026-10-10   paper:week:2026-10-05 (its Monday)   paper:month:2026-10
   A page = { v:1, L:ink, R:ink, typed:{zone:text}, rating, mood, glance:{n:true} }
   ink    = { v:1, W:1000, H:1400, strokes:[{ c, s, p:[x,y,pressure,…], h? }] }  (h = highlighter)
   Ticks on printed tasks live in "paper-meta".done, by task uid.

   Every page is laid out on a fixed 1000 × 1400 sheet and scaled to the
   screen, so ink lines up the same on the laptop, the iPad and the phone. */
(function(global){

  const PW = 1000, PH = 1400;
  const INKS = ['#1F3B73', '#2A2620', '#C24F00', '#3E8E4E'];
  const HL = '#FFD23F';
  const SIZES = { fine: 2.6, med: 4.2, bold: 7 };
  const KCOL = { shoot: '#FB6900', edit: '#E8A33D', publish: '#5BBE6A' };
  const ROW = 52;                                   /* ruled line height on the sheet */

  /* ---------------------------------------------------------- dates */
  const pad2 = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const dOf = iso => new Date(iso + 'T12:00');
  const today = () => isoOf(new Date());
  const addDays = (iso, n) => { const d = dOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
  const addMonths = (iso, n) => { const d = dOf(iso.slice(0, 7) + '-01'); d.setMonth(d.getMonth() + n); return isoOf(d); };
  const mondayOf = iso => { const d = dOf(iso); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoOf(d); };
  const isoWeek = iso => {
    const d = dOf(iso); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const y = new Date(d.getFullYear(), 0, 4, 12);
    return 1 + Math.round(((d - y) / 864e5 - 3 + (y.getDay() + 6) % 7) / 7);
  };
  const fmt = (iso, o) => dOf(iso).toLocaleDateString(undefined, o);
  const daysIn = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  const toMin = at => { const m = /^(\d{1,2}):(\d{2})/.exec(at || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const fromMin = m => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
  const atLabel = at => { const m = toMin(at); if(m === null) return '';
    const h = Math.floor(m / 60), mm = m % 60; return `${(h + 11) % 12 + 1}${mm ? ':' + pad2(mm) : ''}${h < 12 ? 'am' : 'pm'}`; };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  /* ---------------------------------------------------------- state */
  let H = null, host = null, ro = null;
  const st = { mode: 'day', date: today(), spread: null, side: 'L', tool: 'pen', colour: INKS[0], size: 'med', finger: false,
    fit: 'page' };     /* 'page' = the whole sheet, 'width' = fill the width */
  let meta = { done: {}, idx: {} };
  let rec = null, key = null, scale = 1, penSeen = false, keyWired = false;
  const cache = {}, pending = {};
  let undo = [];
  let skipClick = false;

  const blankInk = () => ({ v: 1, W: PW, H: PH, strokes: [] });
  const blankRec = () => ({ v: 1, L: blankInk(), R: blankInk(), typed: {}, rating: 0, mood: 0, glance: {} });
  const keyFor = () => st.mode === 'day' ? 'day:' + st.date
    : st.mode === 'week' ? 'week:' + mondayOf(st.date) : 'month:' + st.date.slice(0, 7);

  async function loadMeta(){
    try { const m = await Store.get('settings', 'paper-meta'); if(m) meta = { done: m.done || {}, idx: m.idx || {}, ...m }; } catch(e){}
    if(meta.prefs){ Object.assign(st, { colour: meta.prefs.colour || st.colour, size: meta.prefs.size || st.size,
      finger: !!meta.prefs.finger, spread: meta.prefs.spread === undefined ? null : meta.prefs.spread,
      fit: meta.prefs.fit === 'width' ? 'width' : 'page' });
      /* Once you have written with a stylus you are a stylus user next time
         too. Without this, the first palm of every session got through. */
      if(meta.prefs.penSeen) penSeen = true; }
  }
  async function loadRec(k){
    if(cache[k]) return cache[k];
    let r = null;
    try { r = await Store.get('settings', 'paper:' + k); } catch(e){}
    r = r && r.L ? r : blankRec();
    r.typed = r.typed || {}; r.glance = r.glance || {};
    return (cache[k] = r);
  }
  function saveMeta(){
    meta.prefs = { colour: st.colour, size: st.size, finger: st.finger, spread: st.spread, fit: st.fit, penSeen };
    Store.put('settings', meta, 'paper-meta').catch(e => console.error(e));
  }
  /* each page saves a moment after you lift the pen */
  function saveRec(k, r){
    k = k || key; r = r || rec;
    clearTimeout(pending[k]);
    pending[k] = setTimeout(() => {
      delete pending[k];
      meta.idx[k] = Date.now();
      Store.put('settings', r, 'paper:' + k).catch(e => { console.error(e); toast('Could not save the page — is storage full?'); });
      saveMeta();
    }, 400);
  }
  function flush(){ Object.keys(pending).forEach(k => { clearTimeout(pending[k]); delete pending[k];
    meta.idx[k] = Date.now(); Store.put('settings', cache[k], 'paper:' + k).catch(() => {}); }); saveMeta(); }

  const toast = m => H && H.toast ? H.toast(m) : console.log(m);
  const tasksIn = (a, b) => (H.tasks(a, b) || []).slice()
    .sort((x, y) => (x.date + (x.at || '99')).localeCompare(y.date + (y.at || '99')));
  const isDone = t => !!(meta.done[t.uid] || t.done);

  /* ---------------------------------------------------------- page parts */
  const LABEL = { tasks: '✦ Make tasks', sched: '✦ Add to schedule', cal: '✦ Add to calendar', text: '✦ Type it' };

  function zone(z, title, kind, body, o){
    o = o || {};
    const typed = rec.typed[z];
    return `<section class="pp-z${o.cls ? ' ' + o.cls : ''}" data-z="${z}" data-kind="${kind}"${o.date ? ` data-date="${o.date}"` : ''}${o.journal ? ` data-journal="${o.journal}"` : ''} style="${o.style || ''}">
      <header class="pp-zh">${o.head || `<span>${title}</span>`}${o.tag ? `<i class="pp-tag">${o.tag}</i>` : ''}
        <span class="pp-grow"></span>
        ${typed ? `<button type="button" class="pp-zb-btn pp-typed" data-pa="typed" data-z="${z}" title="See the typed version">Aa ✓</button>` : ''}
        ${o.noConv ? '' : `<button type="button" class="pp-zb-btn" data-pa="conv" data-z="${z}" title="Read the handwriting in this box">${o.label || LABEL[kind]}</button>`}
      </header>
      <div class="pp-zbody${o.ruled === false ? '' : ' ruled'}">${body || ''}</div>
    </section>`;
  }
  const blankRows = (n, numbered) => [...Array(Math.max(0, n))].map((_, i) =>
    `<div class="pp-row">${numbered ? `<span class="pp-num">${i + 1}</span>` : '<span class="pp-box"></span>'}</div>`).join('');
  function printRow(t, o){
    o = o || {};
    const d = isDone(t);
    return `<div class="pp-row${d ? ' done' : ''}">
      <span class="pp-box pp-tap" data-tick="${t.uid}" role="checkbox" aria-checked="${d}" aria-label="${esc(t.title)}">${d ? '✓' : ''}</span>
      <i class="pp-k" style="--k:${KCOL[t.kind] || '#8C826F'}"></i>
      <span class="pp-print">${esc(t.title || 'Untitled')}</span>
      <span class="pp-meta">${[o.day ? fmt(t.date, { weekday: 'short' }) : '', atLabel(t.at), t.kind && KCOL[t.kind] ? t.kind : ''].filter(Boolean).join(' · ')}</span>
    </div>`;
  }
  function pill(t){
    const d = isDone(t);
    return `<span class="pp-pill${d ? ' done' : ''}" style="--k:${KCOL[t.kind] || '#8C826F'}">
      <span class="pp-pbox pp-tap" data-tick="${t.uid}" aria-label="Tick ${esc(t.title)}">${d ? '✓' : ''}</span>${esc(t.title || 'Untitled')}</span>`;
  }
  function thermo(done, total){
    const pct = total ? Math.round(done / total * 100) : 0;
    return `<div class="pp-thermo"><b>PROGRESS</b><div class="pp-tube"><i style="height:${pct}%"></i></div>
      <span class="pp-pct">${pct}%</span><small>${done} of ${total} ticked</small></div>`;
  }
  function rating(label){
    return zone('rate', label, 'text', `<div class="pp-rate">${[1, 2, 3, 4, 5].map(n =>
      `<span class="pp-tap${rec.rating === n ? ' on' : ''}" data-rate="${n}" role="radio" aria-checked="${rec.rating === n}">${n}</span>`).join('')}</div>`,
      { ruled: false, noConv: true });
  }
  function head(big, sub, right){
    return `<div class="pp-head"><div><div class="pp-big">${big}</div><div class="pp-sub">${sub}</div></div>${right || ''}</div>`;
  }
  function miniCal(ym, mark){
    const first = ym + '-01', start = mondayOf(first), n = daysIn(ym);
    let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span class="h">${d}</span>`).join('');
    for(let i = 0; i < 42; i++){
      const iso = addDays(start, i);
      if(i % 7 === 0 && iso.slice(0, 7) !== ym && i) break;
      const inM = iso.slice(0, 7) === ym;
      cells += `<span class="${inM ? 'pp-tap' : 'off'}${mark(iso) ? ' on' : ''}${iso === today() ? ' now' : ''}"${inM ? ` data-go="day:${iso}"` : ''}>${dOf(iso).getDate()}</span>`;
    }
    return `<div class="pp-mini"><b>${fmt(first, { month: 'long', year: 'numeric' }).toUpperCase()}</b><div class="g">${cells}</div></div>`;
    /* n is only here so a 28-day February still ends its grid early */
  }

  /* ---------------------------------------------------------- the pages */
  function dayL(){
    const iso = st.date, list = tasksIn(iso, iso);
    const moods = ['Great', 'Good', 'Okay', 'Low'];
    const right = `<div class="pp-mood"><b>MOOD</b>${moods.map((m, i) =>
      `<span class="pp-tap${rec.mood === i + 1 ? ' on' : ''}" data-mood="${i + 1}">${m}</span>`).join('')}</div>`;
    const todoRows = 13;
    const printed = list.slice(0, todoRows);
    const more = list.length - printed.length;
    return `
      ${head(fmt(iso, { weekday: 'long' }).toUpperCase(), `${fmt(iso, { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()} · WEEK ${isoWeek(iso)}`, right)}
      ${zone('focus', 'Main focus', 'text', '', { style: 'height:112px', tag: 'day goal' })}
      <div class="pp-cols" style="height:758px">
        ${zone('todo', 'To-do', 'tasks', printed.map(t => printRow(t)).join('') +
          (more > 0 ? `<div class="pp-row pp-more">+${more} more on the board</div>` : blankRows(todoRows - printed.length)),
          { style: 'flex:1.15', tag: 'printed = from the app' })}
        <div class="pp-stack">
          ${zone('prio', 'Top 3 priorities', 'tasks', blankRows(3, true), { style: 'height:216px;flex:none' })}
          ${zone('notes', 'Notes', 'text', '', { style: 'flex:1' })}
        </div>
      </div>
      <div class="pp-cols" style="height:280px">
        ${zone('morning', 'Mindful morning', 'text', `<span class="pp-prompt" style="top:2px">GRATEFUL FOR</span><span class="pp-prompt" style="top:106px">TODAY I WILL</span>`, { style: 'flex:1', tag: 'journal', journal: 'Mindful morning' })}
        ${zone('evening', 'Evening reflection', 'text', `<span class="pp-prompt" style="top:2px">WIN OF THE DAY</span><span class="pp-prompt" style="top:106px">TOMORROW</span>`, { style: 'flex:1', tag: 'journal', journal: 'Evening reflection' })}
      </div>`;
  }

  const HOURS = [...Array(18)].map((_, i) => 6 + i);           /* 6 AM … 11 PM */
  const HR = 66;
  function dayR(){
    const iso = st.date, list = tasksIn(iso, iso);
    const blocks = list.filter(t => toMin(t.at) !== null).map(t => {
      const m = toMin(t.at), top = Math.max(0, (m - 360) / 60 * HR), mins = Math.max(+t.mins || 60, 30);
      const h = Math.max(30, Math.min(mins / 60 * HR, HOURS.length * HR - top) - 4);
      const d = isDone(t);
      return `<div class="pp-blk${d ? ' done' : ''}" style="top:${top + 2}px;height:${h}px;--k:${KCOL[t.kind] || '#8C826F'}">
        <span class="pp-pbox pp-tap" data-tick="${t.uid}">${d ? '✓' : ''}</span>
        <b>${t.kind && KCOL[t.kind] ? t.kind.toUpperCase() + ' · ' : ''}${esc(t.title || 'Untitled')}</b>
        <span>${atLabel(t.at)}${t.mins ? '–' + atLabel(fromMin(m + +t.mins)) : ''}</span></div>`;
    }).join('');
    const rows = HOURS.map(h => `<div class="pp-hr" data-guide="${(h + 11) % 12 + 1} ${h < 12 ? 'AM' : 'PM'}"><span>${(h + 11) % 12 + 1} ${h < 12 ? 'AM' : 'PM'}</span></div>`).join('');
    return zone('sched', 'Schedule', 'sched', `<div class="pp-hours">${rows}<div class="pp-blocks">${blocks}</div></div>`,
      { style: 'flex:1', ruled: false, tag: 'dark = from the app' });
  }

  function weekL(){
    const mon = mondayOf(st.date), sun = addDays(mon, 6), list = tasksIn(mon, sun);
    const inWeek = today() >= mon && today() <= sun;
    return `
      ${head('WEEK ' + isoWeek(mon), `${fmt(mon, { month: 'short', day: 'numeric' }).toUpperCase()} – ${fmt(sun, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()} · PLAN &amp; REFLECTION`)}
      ${zone('goal', 'Main goal for the week', 'text', '', { style: 'height:112px' })}
      <div class="pp-cols" style="height:640px">
        <div class="pp-stack" style="flex:1">
          ${zone('steps', 'Top 5 action steps', 'tasks', blankRows(5, true), { style: 'height:318px;flex:none', date: inWeek ? today() : mon })}
          ${zone('todo', 'To-do', 'tasks', blankRows(5), { style: 'flex:1', date: inWeek ? today() : mon })}
        </div>
        ${thermo(list.filter(isDone).length, list.length)}
      </div>
      <div class="pp-cols" style="flex:1">
        ${zone('wins', 'Wins &amp; achievements', 'text', '', { style: 'flex:1' })}
        ${zone('didnt', "What didn't quite work", 'text', '', { style: 'flex:1' })}
      </div>
      <div class="pp-cols" style="height:170px">
        ${zone('carry', 'Carry over to next week', 'tasks', blankRows(2), { style: 'flex:1.6', date: addDays(mon, 7) })}
        ${rating('Rate the week')}
      </div>`;
  }

  function weekR(){
    const mon = mondayOf(st.date), sun = addDays(mon, 6);
    const days = [...Array(7)].map((_, i) => addDays(mon, i));
    const box = (iso, i) => {
      const list = tasksIn(iso, iso);
      const hd = `<span class="pp-tap pp-go" data-go="day:${iso}">${fmt(iso, { weekday: 'long' }).toUpperCase()}</span>
        <i class="pp-tag">${fmt(iso, { month: 'short', day: 'numeric' })}</i>`;
      return zone('d' + i, '', 'tasks', `<div class="pp-pills">${list.slice(0, 4).map(pill).join('')}${list.length > 4 ? `<span class="pp-meta">+${list.length - 4} more</span>` : ''}</div>`,
        { head: hd, date: iso, ruled: false, label: '✦ Tasks', cls: iso === today() ? 'now' : '' });
    };
    return `
      <div class="pp-head" style="height:220px;align-items:flex-start">
        <div><div class="pp-big">WEEK OVERVIEW</div><div class="pp-sub">${fmt(mon, { month: 'long', year: 'numeric' }).toUpperCase()} · WEEK ${isoWeek(mon)}</div></div>
        ${miniCal(mon.slice(0, 7), iso => iso >= mon && iso <= sun)}
      </div>
      <div class="pp-grid2">
        ${days.map(box).join('')}
        ${zone('doodles', 'Notes &amp; doodles', 'text', '', { ruled: false })}
      </div>`;
  }

  function monthL(){
    const ym = st.date.slice(0, 7), first = ym + '-01', last = ym + '-' + pad2(daysIn(ym));
    const list = tasksIn(first, last), pubs = list.filter(t => t.kind === 'publish').slice(0, 5);
    const doneDays = new Set(list.filter(isDone).map(t => +t.date.slice(8)));
    const inMonth = today().slice(0, 7) === ym;
    const glance = [...Array(daysIn(ym))].map((_, i) => {
      const n = i + 1, on = rec.glance[n] || doneDays.has(n);
      return `<span class="pp-tap${on ? ' on' : ''}" data-glance="${n}">${n}</span>`;
    }).join('');
    return `
      ${head(fmt(first, { month: 'long' }).toUpperCase(), `MONTHLY PLAN · ${ym.slice(0, 4)}`)}
      ${zone('goal', 'Main goal for the month', 'text', '', { style: 'height:112px' })}
      <div class="pp-cols" style="height:500px">
        <div class="pp-stack" style="flex:1">
          ${zone('steps', 'Top 5 action steps', 'tasks', pubs.map(t => printRow(t)).join('') + blankRows(5 - pubs.length, true),
            { style: 'height:318px;flex:none', tag: 'publish dates print here', date: inMonth ? today() : first })}
          ${zone('todo', 'To-do', 'tasks', blankRows(2), { style: 'flex:1', date: inMonth ? today() : first })}
        </div>
        ${thermo(list.filter(isDone).length, list.length)}
      </div>
      ${zone('glance', 'Month at a glance', 'text', `<div class="pp-glance">${glance}</div>
        <small class="pp-hint">Shaded = a day with something ticked off. Tap a day to shade it yourself.</small>`, { style: 'height:320px', ruled: false, noConv: true })}
      <div class="pp-cols" style="flex:1">
        ${zone('wins', 'Win &amp; achievement board', 'text', '', { style: 'flex:1.6' })}
        ${rating('Rate the month')}
      </div>`;
  }

  function monthR(){
    const ym = st.date.slice(0, 7), first = ym + '-01', start = mondayOf(first);
    const last = ym + '-' + pad2(daysIn(ym));
    const weeks = []; for(let w = start; w <= last; w = addDays(w, 7)) weeks.push(w);
    const list = tasksIn(start, addDays(weeks[weeks.length - 1], 6));
    const rowH = Math.floor((960 - 44) / weeks.length);
    let cells = '<span class="h">WK</span>' + ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => `<span class="h">${d}</span>`).join('');
    weeks.forEach(w => {
      cells += `<span class="wk pp-tap" data-go="week:${w}" title="Open week ${isoWeek(w)}">${isoWeek(w)}</span>`;
      for(let i = 0; i < 7; i++){
        const iso = addDays(w, i), inM = iso.slice(0, 7) === ym, ts = list.filter(t => t.date === iso);
        cells += `<div class="c${inM ? '' : ' off'}${iso === today() ? ' now' : ''}"${inM ? ` data-guide="${+iso.slice(8)}"` : ''}>
          <span class="pp-tap n" data-go="day:${iso}">${dOf(iso).getDate()}</span>
          ${ts.slice(0, 3).map(t => `<span class="pp-cpill${isDone(t) ? ' done' : ''}" style="--k:${KCOL[t.kind] || '#8C826F'}">${esc(t.title)}</span>`).join('')}
          ${ts.length > 3 ? `<span class="pp-meta">+${ts.length - 3}</span>` : ''}</div>`;
      }
    });
    return `
      ${head(fmt(first, { month: 'long', year: 'numeric' }).toUpperCase(), 'CALENDAR · TAP A DATE OR WEEK TO OPEN IT')}
      ${zone('cal', 'Calendar', 'cal', `<div class="pp-cal" style="grid-template-rows:44px repeat(${weeks.length},${rowH}px)">${cells}</div>`,
        { style: 'height:1026px;flex:none', ruled: false, tag: 'write on any day' })}
      ${zone('notes', 'Notes', 'text', '', { style: 'flex:1' })}`;
  }

  const PAGES = {
    day:   { L: dayL,   R: dayR,   names: ['Plan', 'Schedule'] },
    week:  { L: weekL,  R: weekR,  names: ['Plan & reflection', 'Overview'] },
    month: { L: monthL, R: monthR, names: ['Monthly plan', 'Calendar'] }
  };

  function title(){
    if(st.mode === 'day') return fmt(st.date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    if(st.mode === 'week'){ const m = mondayOf(st.date);
      return `Week ${isoWeek(m)} · ${fmt(m, { month: 'short', day: 'numeric' })} – ${fmt(addDays(m, 6), { month: 'short', day: 'numeric' })}`; }
    return fmt(st.date.slice(0, 7) + '-01', { month: 'long', year: 'numeric' });
  }

  /* ---------------------------------------------------------- render */
  const IC = {
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg>',
    hl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 15l-3 3v2h6l2-2M9 15l6-10 4 3-6 10z"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 20h12M5 15l8-8 5 5-6 6H8z"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 013 0V11m0-5.5V4a1.5 1.5 0 013 0v7m0-5a1.5 1.5 0 013 0v7c0 4-2.5 7-6 7s-5-1.5-7-5l-1.5-3a1.5 1.5 0 012.5-1.5L8 13"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg>'
  };

  const spreadOn = () => st.spread === null ? (host.clientWidth || 1200) >= 900 : st.spread;

  async function render(){
    if(!host) return;
    key = keyFor();
    rec = await loadRec(key);
    if(keyFor() !== key) return;                     /* moved on while loading */
    const two = spreadOn(), P = PAGES[st.mode];
    const sides = two ? ['L', 'R'] : [st.side];
    const tb = (t, label, ic) => `<button type="button" class="pp-b${st.tool === t ? ' on' : ''}" data-pa="tool" data-t="${t}" aria-label="${label}" aria-pressed="${st.tool === t}" title="${label}">${ic}</button>`;
    host.innerHTML = `
      <div class="pp-bar" role="toolbar" aria-label="Paper planner">
        <div class="pp-grp">
          <button type="button" class="pp-b" data-pa="prev" aria-label="Previous">${IC.left}</button>
          <button type="button" class="pp-b pp-txt" data-pa="today">Today</button>
          <button type="button" class="pp-b" data-pa="next" aria-label="Next">${IC.right}</button>
        </div>
        <div class="pp-grp pp-seg" role="group" aria-label="Page">
          ${['day', 'week', 'month'].map(m => `<button type="button" class="pp-b pp-txt${st.mode === m ? ' on' : ''}" data-pa="mode" data-m="${m}" aria-pressed="${st.mode === m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}
        </div>
        <b class="pp-title">${esc(title())}</b>
        <span class="pp-grow"></span>
        <div class="pp-grp">
          ${tb('pen', 'Pen', IC.pen)}${tb('hl', 'Highlighter', IC.hl)}${tb('eraser', 'Eraser — touch a stroke to remove it', IC.eraser)}${tb('hand', 'Hand — tap, scroll and click without writing', IC.hand)}
        </div>
        <div class="pp-grp">
          ${INKS.map(c => `<button type="button" class="pp-sw${st.colour === c ? ' on' : ''}" data-pa="colour" data-c="${c}" style="--c:${c}" aria-label="Ink colour"></button>`).join('')}
          <select class="pp-size" aria-label="Pen size">${Object.keys(SIZES).map(s => `<option value="${s}"${st.size === s ? ' selected' : ''}>${{ fine: 'Fine', med: 'Medium', bold: 'Bold' }[s]}</option>`).join('')}</select>
          <button type="button" class="pp-b" data-pa="undo" aria-label="Undo" title="Undo">${IC.undo}</button>
        </div>
        <div class="pp-grp">
          <button type="button" class="pp-b pp-txt${st.finger ? ' on' : ''}" data-pa="finger" aria-pressed="${st.finger}" title="Off: once a pen is used, fingers scroll. On: fingers write too.">Finger writes</button>
          <button type="button" class="pp-b pp-txt" data-pa="pages" title="One page or the two-page spread">${two ? '1 page' : '2 pages'}</button>
          <button type="button" class="pp-b pp-txt" data-pa="fit"
            title="Whole page: see all of it at once. Fill width: bigger, better to write at."
            >${st.fit === 'width' ? 'Fill width' : 'Whole page'}</button>
          <!-- Typing a task beats writing one and hoping it reads: same
               result, no handwriting step, and it works on the schedule
               where the boxes are too small to write in comfortably. -->
          <button type="button" class="pp-b pp-txt" data-pa="newtask"
            title="Add a task to this day, with a time">+ Task</button>
          ${H.openDay ? `<button type="button" class="pp-b pp-txt" data-pa="day"
            title="Open this day in the app, with its tasks and shots">Day view</button>` : ''}
          <button type="button" class="pp-b pp-txt" data-pa="full"
            title="${st.full ? 'Leave full view (Esc)' : 'Full view — just the planner, arrow keys turn the pages'}"
            >${st.full ? '✕ Close' : 'Full view'}</button>
        </div>
      </div>
      ${two ? '' : `<div class="pp-sides" role="tablist">${['L', 'R'].map((s, i) =>
        `<button type="button" role="tab" class="pp-b pp-txt${st.side === s ? ' on' : ''}" data-pa="side" data-s="${s}" aria-selected="${st.side === s}">${P.names[i]}</button>`).join('')}</div>`}
      <div class="pp-stage">
        <!-- Turning a page: a wide strip down each edge rather than a small
             button, so it works like the edge of a book. Arrow keys do the
             same. Hidden from screen readers — the toolbar's ‹ › are the
             labelled way to do it. -->
        <button type="button" class="pp-turn prev" data-pa="prev" aria-hidden="true" tabindex="-1">${IC.left}</button>
        <div class="pp-spread">
          <div class="pp-scale" style="width:${PW * sides.length}px">
            ${sides.map(s => `<div class="pp-page pp-${s}" data-side="${s}">${P[s]()}<canvas class="pp-ink" data-side="${s}" aria-label="Writing area"></canvas></div>`).join('')}
          </div>
        </div>
        <button type="button" class="pp-turn next" data-pa="next" aria-hidden="true" tabindex="-1">${IC.right}</button>
      </div>`;
    host.classList.toggle('pp-handmode', st.tool === 'hand');
    host.querySelectorAll('.pp-ink').forEach(wireCanvas);
    fit();
  }

  /* How big to draw the sheet.

     Sizing by width alone is right on a phone, where the screen is portrait
     and so is the page. On a laptop the window is landscape and the page is
     not, so width-only gives you a tall sheet you scroll through instead of a
     page you can see — which is not what a paper planner is for. So "Whole
     page" fits both ways and is the default; "Fill width" is the old
     behaviour, kept because it is the better one to write at. */
  /* ---------------------------------------------------- palm rejection

     Two things make a palm awkward: it lands FIRST, and the only proof it was
     a palm is the pen turning up a moment later. So the last touch-started
     stroke is remembered, and a pen landing within half a second retracts it.
     Half a second is about the gap between the hand settling and the tip
     touching; much longer and a deliberate finger stroke would start
     disappearing under the next pen mark. */
  let lastTouch = null;      /* { side, stroke, at } */

  /* Before any pen has been seen there is nothing to judge by but the contact
     patch. A fingertip is small; the side of a hand is not. Safari reports
     these for touch; where it does not, this simply never fires. */
  const isBroad = e => (e.width && e.width > 38) || (e.height && e.height > 38);

  function dropPalm(side){
    if(!lastTouch || lastTouch.side !== side) return;
    if(Date.now() - lastTouch.at > 500){ lastTouch = null; return; }
    const ink = rec && rec[side];
    if(ink){
      const i = ink.strokes.indexOf(lastTouch.stroke);
      if(i >= 0){ ink.strokes.splice(i, 1); redraw(side); }
    }
    lastTouch = null;
  }

  function fit(){
    const stage = host && host.querySelector('.pp-stage'); if(!stage) return;
    const n = host.querySelectorAll('.pp-page').length;
    const byW = (stage.clientWidth || 1000) / (PW * n);

    if(st.fit === 'width'){
      scale = Math.min(2, byW);
    } else {
      /* the room left under the toolbar, measured rather than assumed. In full
         view the toolbar floats over the bottom of the page, so its height is
         not in the layout and has to be kept clear by hand. */
      const hb = host.getBoundingClientRect(), sb = stage.getBoundingClientRect();
      const room = hb.bottom - sb.top - (st.full ? 104 : 16);
      scale = room > 120 ? Math.min(byW, room / PH) : byW;
    }
    scale = Math.max(.08, scale);
    const sp = host.querySelector('.pp-spread'), sc = host.querySelector('.pp-scale');
    sp.style.width = PW * n * scale + 'px'; sp.style.height = PH * scale + 'px';
    sc.style.transform = `scale(${scale})`;
    const dpr = global.devicePixelRatio || 1;
    host.querySelectorAll('.pp-ink').forEach(cv => {
      cv.width = Math.round(PW * scale * dpr); cv.height = Math.round(PH * scale * dpr);
      redraw(cv.dataset.side);
    });

    /* The page-turn strips live in the margin beside the sheet, never over it:
       a pen stroke down the edge of the page must stay a pen stroke. If there
       is no margin to put them in — filling the width — they go away, and the
       toolbar arrows and the keyboard still turn the page. */
    const margin = Math.floor(((stage.clientWidth || 0) - PW * n * scale) / 2);
    const room = margin >= 34;
    host.querySelectorAll('.pp-turn').forEach(b => {
      b.style.width = room ? margin + 'px' : '0px';
      b.style.visibility = room ? '' : 'hidden';
      b.disabled = !room;
    });
  }

  /* ---------------------------------------------------------- ink */
  function paint(g, strokes, s, mono){
    g.lineCap = 'round'; g.lineJoin = 'round';
    strokes.filter(x => x.h).forEach(x => {                     /* highlighter first, under the ink */
      if(mono) return;
      const p = x.p; g.save(); g.globalAlpha = .38; g.strokeStyle = x.c; g.lineWidth = x.s * s;
      g.beginPath(); g.moveTo(p[0] * s, p[1] * s);
      for(let i = 3; i < p.length; i += 3) g.lineTo(p[i] * s, p[i + 1] * s);
      if(p.length === 3) g.lineTo(p[0] * s + .1, p[1] * s);
      g.stroke(); g.restore();
    });
    strokes.filter(x => !x.h).forEach(x => {
      const p = x.p; g.strokeStyle = g.fillStyle = mono || x.c;
      if(p.length === 3){ g.beginPath(); g.arc(p[0] * s, p[1] * s, x.s * s * .6, 0, Math.PI * 2); g.fill(); return; }
      for(let i = 3; i < p.length; i += 3){
        g.lineWidth = Math.max(.6, x.s * s * (.55 + (p[i + 2] || 50) / 100 * .9));
        g.beginPath(); g.moveTo(p[i - 3] * s, p[i - 2] * s); g.lineTo(p[i] * s, p[i + 1] * s); g.stroke();
      }
    });
  }
  function redraw(side){
    const cv = host.querySelector(`.pp-ink[data-side="${side}"]`); if(!cv) return;
    const g = cv.getContext('2d'), dpr = global.devicePixelRatio || 1;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(g, rec[side].strokes, scale);
  }
  const bbox = x => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    for(let i = 0; i < x.p.length; i += 3){ a = Math.min(a, x.p[i]); b = Math.min(b, x.p[i + 1]); c = Math.max(c, x.p[i]); d = Math.max(d, x.p[i + 1]); }
    return { x: a, y: b, w: c - a, h: d - b, cx: (a + c) / 2, cy: (b + d) / 2 }; };

  /* Undo used to JSON.stringify every stroke on the page at the start of each
     new one. That is O(everything written so far), on the pen-down, on the main
     thread — so the more you wrote the more each stroke hitched before it
     began. On a schedule page it was the difference between writing and
     fighting.

     Adding a stroke only needs to remember how many there were: undoing it is
     a truncate. The eraser still takes a full snapshot, because it removes
     strokes from anywhere in the list and there is nothing cheaper to record —
     but erasing is one action, not every stroke. */
  function pushUndo(side){
    undo.push({ k: key, side, len: rec[side].strokes.length });
    if(undo.length > 80) undo.shift();
  }
  function pushUndoFull(side){
    undo.push({ k: key, side, s: JSON.stringify(rec[side].strokes) });
    if(undo.length > 80) undo.shift();
  }

  function underneath(cx, cy){
    const list = document.elementsFromPoint(cx, cy);
    for(const el of list){
      if(el.classList.contains('pp-ink')) continue;
      const t = el.closest('[data-tick],[data-go],[data-glance],[data-rate],[data-mood],[data-pa]');
      if(t && host.contains(t)) return t;
    }
    return null;
  }

  function wireCanvas(cv){
    const side = cv.dataset.side;
    let pid = null, cur = null, t0 = 0, erasing = false;
    cv.style.touchAction = penSeen && !st.finger ? 'pan-x pan-y pinch-zoom' : 'none';
    const at = e => { const r = cv.getBoundingClientRect(), s = r.width / PW;
      return [Math.round((e.clientX - r.left) / s), Math.round((e.clientY - r.top) / s)]; };
    const pr = e => Math.round(((e.pointerType === 'pen' && e.pressure) ? e.pressure : .5) * 100);
    const eraseAt = (x, y) => {
      const ink = rec[side], before = ink.strokes.length;
      ink.strokes = ink.strokes.filter(k => { const p = k.p, r = k.h ? k.s / 2 + 6 : 14;
        for(let j = 0; j < p.length; j += 3) if(Math.abs(p[j] - x) < r && Math.abs(p[j + 1] - y) < r) return false; return true; });
      if(ink.strokes.length !== before) redraw(side);
    };

    cv.addEventListener('pointerdown', e => {
      if(st.tool === 'hand') return;

      if(e.pointerType === 'pen'){
        /* The pen always wins, even if something else got here first. Writing
           with a stylus means the heel of your hand lands BEFORE the tip, so
           the palm would otherwise take the pointer and `pid !== null` would
           then turn the actual pen stroke away — palm draws, pen does not,
           which is precisely the wrong way round. */
        dropPalm(side);
        if(pid !== null){
          try { cv.releasePointerCapture(pid); } catch(_){}
          pid = null; cur = null; erasing = false;
        }
        if(!penSeen){
          penSeen = true;
          saveMeta();                 /* remembered, so the next launch starts knowing */
          host.querySelectorAll('.pp-ink').forEach(c => {
            c.style.touchAction = st.finger ? 'none' : 'pan-x pan-y pinch-zoom'; });
        }
      }

      if(e.pointerType === 'touch' && !st.finger){
        if(penSeen) return;                       /* a pen user: this is a palm */
        /* Before any pen has been seen there is nothing to go on but the
           contact itself. A fingertip is small; the side of a hand is not. */
        if(isBroad(e)) return;
      }
      if(pid !== null) return;
      e.preventDefault();
      pid = e.pointerId; try { cv.setPointerCapture(pid); } catch(_){}
      const [x, y] = at(e);
      /* the eraser takes strokes out from anywhere, so only a snapshot can put
         them back; drawing just appends, so a count is enough */
      if(st.tool === 'eraser'){ pushUndoFull(side); erasing = true; eraseAt(x, y); return; }
      pushUndo(side);
      t0 = Date.now();
      cur = st.tool === 'hl' ? { c: HL, s: 24, h: 1, p: [x, y, 50] } : { c: st.colour, s: SIZES[st.size], p: [x, y, pr(e)] };
      rec[side].strokes.push(cur);
      /* keep a handle on it: if a pen arrives in the next half second this was
         a palm, and dropPalm() takes it back out again */
      lastTouch = e.pointerType === 'touch' ? { side, stroke: cur, at: Date.now() } : null;
      redraw(side);
    });
    cv.addEventListener('pointermove', e => {
      if(e.pointerId !== pid) return;
      e.preventDefault();
      let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if(!evs.length) evs = [e];
      if(erasing){ evs.forEach(ev => { const [x, y] = at(ev); eraseAt(x, y); }); return; }
      if(!cur) return;
      evs.forEach(ev => { const [x, y] = at(ev), p = cur.p;
        if(Math.abs(p[p.length - 3] - x) + Math.abs(p[p.length - 2] - y) >= 2) p.push(x, y, pr(ev)); });
      if(cur.h) return redraw(side);
      const p = cur.p, n = p.length;
      if(n >= 6){
        const g = cv.getContext('2d'), dpr = global.devicePixelRatio || 1;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.lineCap = 'round'; g.strokeStyle = cur.c;
        g.lineWidth = Math.max(.6, cur.s * scale * (.55 + p[n - 1] / 100 * .9));
        g.beginPath(); g.moveTo(p[n - 6] * scale, p[n - 5] * scale); g.lineTo(p[n - 3] * scale, p[n - 2] * scale); g.stroke();
      }
    });
    const end = e => {
      if(e.pointerId !== pid) return;
      pid = null; skipClick = true; setTimeout(() => { skipClick = false; }, 400);
      if(erasing){ erasing = false; saveRec(); return; }
      if(!cur) return;
      const b = bbox(cur), quick = Date.now() - t0 < 450, done = cur; cur = null;
      /* a tap, or a small tick over a box, presses the thing under the pen */
      let target = null;
      if(b.w < 30 && b.h < 30 && quick) target = underneath(e.clientX, e.clientY);
      if(!target && b.w < 80 && b.h < 80 && !done.h){
        const r = cv.getBoundingClientRect(), s = r.width / PW;
        const t = underneath(r.left + b.cx * s, r.top + b.cy * s);
        if(t && t.matches('[data-tick],[data-glance],[data-rate],[data-mood]')) target = t;
      }
      if(target){
        rec[side].strokes = rec[side].strokes.filter(x => x !== done); undo.pop();
        redraw(side); activate(target); return;
      }
      redraw(side); saveRec();
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }

  /* ---------------------------------------------------------- actions */
  function go(where){
    const [m, iso] = where.split(':');
    st.mode = m; st.date = iso; if(!spreadOn()) st.side = m === 'day' ? 'L' : st.side;
    render();
  }
  /* Full view: the planner and nothing else, with the page turns on the
     keyboard. It is a class on the host rather than the Fullscreen API,
     because the pen, the dialogs and the toolbar all have to keep working,
     and a real fullscreen request would put the dialogs behind the page. */
  let homeParent = null, homeNext = null, watchingExit = false;

  /* Leaving the planner while it is full — the back arrow, a swipe, a deep
     link — would otherwise leave it sitting in <body> over the whole app with
     no way back, because the screen that owned it is gone and taking its own
     container with it does not take this one. */
  function watchForExit(){
    if(watchingExit || !global.Screens || !Screens.onChange) return;
    watchingExit = true;
    Screens.onChange(() => {
      if(!st.full || !homeParent) return;
      /* pop() announces straight away but removes the screen 280ms later, once
         it has slid out — so checking now would always find it still attached */
      setTimeout(() => {
        if(st.full && homeParent && !homeParent.isConnected) setFull(false);
      }, 320);
    });
  }

  function setFull(on){
    st.full = !!on;
    if(!host) return;

    /* Full means the whole window, and position:fixed cannot promise that: any
       ancestor with a transform, a filter or containment becomes the containing
       block, and "fixed" then means fixed to that. On a laptop the left rail
       did exactly this, so full view stopped 92px short of the edge. Moving the
       planner to <body> for the duration is the only version of this that is
       true on every screen. */
    if(st.full){
      if(!homeParent && host.parentNode){
        homeParent = host.parentNode;
        homeNext = host.nextSibling;
        document.body.appendChild(host);
        watchForExit();
      }
    } else if(homeParent){
      /* Put it back where it came from — unless the screen that owned it has
         been closed, in which case there is nowhere to go and it should
         simply leave. */
      if(homeParent.isConnected){
        if(homeNext && homeNext.parentNode === homeParent) homeParent.insertBefore(host, homeNext);
        else homeParent.appendChild(host);
      } else if(host.parentNode){
        host.parentNode.removeChild(host);
      }
      homeParent = homeNext = null;
    }

    host.classList.toggle('pp-full', st.full);
    if(st.full){
      if(!keyWired){
        keyWired = true;
        global.addEventListener('keydown', onKey);
      }
    } else if(keyWired){
      keyWired = false;
      global.removeEventListener('keydown', onKey);
    }
    render();
  }

  /* Arrow keys turn the page, Escape leaves. Not while something is being
     typed into, or a dialog is open — those want their own keys. */
  function onKey(e){
    if(!st.full) return;
    if(e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    if(document.querySelector('dialog[open]')) return;
    if(e.key === 'Escape'){ e.preventDefault(); return setFull(false); }
    if(e.key === 'ArrowLeft'  || e.key === 'PageUp'  ){ e.preventDefault(); return step(-1); }
    if(e.key === 'ArrowRight' || e.key === 'PageDown'){ e.preventDefault(); return step(1); }
  }

  function step(n){
    if(st.mode === 'day') st.date = addDays(st.date, n);
    else if(st.mode === 'week') st.date = addDays(mondayOf(st.date), 7 * n);
    else st.date = addMonths(st.date, n);
    render();
  }

  function activate(el){
    if(el.dataset.tick){
      const u = el.dataset.tick; meta.done[u] = !meta.done[u]; if(!meta.done[u]) delete meta.done[u];
      saveMeta(); H.onTick && H.onTick(u, !!meta.done[u]); return render();
    }
    if(el.dataset.go) return go(el.dataset.go);
    if(el.dataset.glance){ const n = el.dataset.glance; rec.glance[n] = !rec.glance[n]; if(!rec.glance[n]) delete rec.glance[n]; saveRec(); return render(); }
    if(el.dataset.rate){ const n = +el.dataset.rate; rec.rating = rec.rating === n ? 0 : n; saveRec(); return render(); }
    if(el.dataset.mood){ const n = +el.dataset.mood; rec.mood = rec.mood === n ? 0 : n; saveRec(); return render(); }
    const a = el.dataset.pa;
    if(a === 'prev') return step(-1);
    if(a === 'next') return step(1);
    if(a === 'today'){ st.date = today(); return render(); }
    if(a === 'mode'){ st.mode = el.dataset.m; return render(); }
    if(a === 'side'){ st.side = el.dataset.s; return render(); }
    if(a === 'pages'){ st.spread = !spreadOn(); saveMeta(); return render(); }
    /* only the drawn size changes, so re-fit rather than redraw the page */
    if(a === 'fit'){ st.fit = st.fit === 'width' ? 'page' : 'width'; saveMeta(); return render(); }
    if(a === 'full') return setFull(!st.full);
    if(a === 'newtask') return newTaskDialog();
    if(a === 'day'){
      /* the day the page is showing, not today — you plan Thursday on
         Wednesday evening and want Thursday */
      if(H.openDay) H.openDay(defaultDate());
      return;
    }
    if(a === 'finger'){ st.finger = !st.finger; saveMeta(); return render(); }
    if(a === 'tool'){ st.tool = el.dataset.t; return render(); }
    if(a === 'colour'){ st.colour = el.dataset.c; if(st.tool !== 'pen') st.tool = 'pen'; saveMeta(); return render(); }
    if(a === 'undo') return doUndo();
    if(a === 'conv') return convert(el.dataset.z);
    if(a === 'typed') return showTyped(el.dataset.z);
  }

  function doUndo(){
    const i = undo.map(u => u.k).lastIndexOf(key);
    if(i < 0) return toast('Nothing to undo on this page');
    const u = undo.splice(i, 1)[0];
    /* a marker undoes by truncating; a snapshot by restoring */
    if(u.s !== undefined) rec[u.side].strokes = JSON.parse(u.s);
    else rec[u.side].strokes.length = Math.min(rec[u.side].strokes.length, u.len);
    redraw(u.side); saveRec();
  }

  /* ---------------------------------------------------------- reading handwriting */
  const PROMPT = {
    text: `This image is handwriting from one box of a paper planner. Transcribe it exactly as written:
keep line breaks, lists and numbers. Fix nothing, add nothing, no commentary. Ignore the grey printed labels.
Where a word is unreadable, write [?]. Reply with only the text.`,
    tasks: `This image is a handwritten to-do list from a paper planner. Write each item on its own line, exactly as
written, without bullets, numbers or checkboxes. Leave out anything crossed out. Reply with only the lines.`,
    sched: `This image is one day of a paper planner. The grey boxes are hours, each labelled in its top-left corner
(6 AM to 11 PM). The handwriting is what's planned. An entry inside one hour box starts at that hour and lasts an hour.
A bracket, arrow or line stretching across several boxes means it lasts that long. Ignore the grey labels themselves.
Reply with only a JSON array, 24-hour times, like [{"title":"Gym — legs","start":"17:00","end":"18:00"}]`,
    cal: `This image is a month calendar from a paper planner. Each grey box is one day, its date number in the
top-left corner. Read the handwriting in each box. Ignore the grey numbers themselves. Reply with only a JSON array,
one entry per handwritten item, like [{"day":12,"title":"Mike's birthday"}]`
  };

  function rectIn(el, page){
    const r = el.getBoundingClientRect(), p = page.getBoundingClientRect(), s = p.width / PW;
    return { x: (r.left - p.left) / s, y: (r.top - p.top) / s, w: r.width / s, h: r.height / s };
  }
  const inside = (b, r) => b.cx >= r.x && b.cx <= r.x + r.w && b.cy >= r.y && b.cy <= r.y + r.h;

  function crop(strokes, r, guides){
    const pad = 20, c = document.createElement('canvas');
    c.width = Math.round(r.w + pad * 2); c.height = Math.round(r.h + pad * 2);
    const g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height);
    g.translate(pad - r.x, pad - r.y);
    guides.forEach(q => {
      g.strokeStyle = '#C8C8C8'; g.lineWidth = 1.5; g.strokeRect(q.x, q.y, q.w, q.h);
      g.fillStyle = '#9A9A9A'; g.font = '600 18px sans-serif'; g.fillText(q.label, q.x + 6, q.y + 20);
    });
    paint(g, strokes, 1, '#111111');
    return c.toDataURL('image/png');
  }

  async function convert(z){
    const zEl = host.querySelector(`[data-z="${z}"]`); if(!zEl) return;
    const page = zEl.closest('.pp-page'), side = page.dataset.side, kind = zEl.dataset.kind;
    const r = rectIn(zEl, page);
    const strokes = rec[side].strokes.filter(x => !x.h && inside(bbox(x), r));
    if(!strokes.length) return toast('Write in this box first');
    const guides = [...zEl.querySelectorAll('[data-guide]')].map(q => ({ ...rectIn(q, page), label: q.dataset.guide }));
    const image = crop(strokes, r, guides);
    const k0 = key, rec0 = rec;
    let text;
    try { text = await H.ai(PROMPT[kind], image, kind === 'text' ? 'Reading your handwriting…' : 'Reading your list…'); }
    catch(e){ return toast(e.message || 'Could not read it'); }
    if(text == null) return;
    text = String(text).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```\w*\n?|```\s*$/g, '').trim();
    if(!text) return toast('Nothing came back');
    const ctx = { z, side, kind, strokes, k: k0, r: rec0, date: zEl.dataset.date || defaultDate(),
      journal: zEl.dataset.journal || '' };
    if(kind === 'text') return typedDialog(ctx, text);
    let items = [];
    if(kind === 'tasks'){
      items = text.split('\n').map(l => l.replace(/^\s*(?:[-*•▪◦]|\d+[.)]|\[\s?[xX✓]?\s?\]|[☐☑✓])\s*/, '').trim()).filter(Boolean)
        .map(title => ({ title, date: ctx.date, at: '', mins: '' }));
    } else {
      let arr = [];
      try { arr = JSON.parse((text.match(/\[[\s\S]*\]/) || ['[]'])[0]); } catch(e){ return toast('That answer could not be read — try again'); }
      if(kind === 'sched') items = arr.filter(x => x && x.title).map(x => {
        const a = toMin(x.start), b = toMin(x.end);
        return { title: String(x.title), date: st.date, at: a === null ? '' : fromMin(a), mins: a !== null && b !== null && b > a ? b - a : 60 };
      });
      if(kind === 'cal'){ const ym = st.date.slice(0, 7);
        items = arr.filter(x => x && x.title && +x.day >= 1 && +x.day <= daysIn(ym))
          .map(x => ({ title: String(x.title), date: `${ym}-${pad2(+x.day)}`, at: '', mins: '' })); }
    }
    if(!items.length) return toast('No items found in that box');
    reviewDialog(ctx, items);
  }

  function defaultDate(){
    const t = today();
    if(st.mode === 'day') return st.date;
    if(st.mode === 'week'){ const m = mondayOf(st.date); return t >= m && t <= addDays(m, 6) ? t : m; }
    return t.slice(0, 7) === st.date.slice(0, 7) ? t : st.date.slice(0, 7) + '-01';
  }

  function dialog(html, wire){
    const d = document.createElement('dialog');
    d.className = 'pl-dlg pp-dlg'; d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    wire(d); d.showModal(); return d;
  }

  function eraseFrom(ctx){
    const r = ctx.r;
    r[ctx.side].strokes = r[ctx.side].strokes.filter(x => !ctx.strokes.includes(x));
    saveRec(ctx.k, r);
  }

  function reviewDialog(ctx, items){
    const timed = ctx.kind === 'sched';
    dialog(`<h2>${ctx.kind === 'sched' ? 'Add to the schedule' : ctx.kind === 'cal' ? 'Add to the calendar' : 'Make tasks'}</h2>
      <p class="pp-dnote">Here's what your handwriting says. Fix any word, untick what you don't want.</p>
      <div class="pp-rv">${items.map((x, i) => `
        <div class="pp-rvrow">
          <input type="checkbox" checked data-i="${i}" aria-label="Keep">
          <input class="pp-in" data-f="title" value="${esc(x.title)}" aria-label="Title">
          <input class="pp-in" type="date" data-f="date" value="${x.date}" aria-label="Date">
          ${timed ? `<input class="pp-in" type="time" data-f="at" value="${x.at}" aria-label="Start">
            <input class="pp-in pp-mins" type="number" min="0" step="15" data-f="mins" value="${x.mins}" aria-label="Minutes">` : ''}
        </div>`).join('')}</div>
      <label class="pp-chk"><input type="checkbox" id="pp-erase" checked> Clear the handwriting from the box once they're added</label>
      <div class="pp-acts"><span class="pp-grow"></span>
        <button type="button" class="pp-btn" data-x>Cancel</button>
        <button type="button" class="pp-btn pri" data-ok>Add</button></div>`, d => {
      d.querySelector('[data-x]').onclick = () => d.close();
      d.querySelector('[data-ok]').onclick = () => {
        const out = [...d.querySelectorAll('.pp-rvrow')].filter(row => row.querySelector('[data-i]').checked).map(row => {
          const v = f => { const i = row.querySelector(`[data-f="${f}"]`); return i ? i.value : ''; };
          return { title: v('title').trim(), date: v('date') || ctx.date, at: v('at') || null, mins: +v('mins') || 0 };
        }).filter(x => x.title);
        if(!out.length){ d.close(); return; }
        H.addTasks(out);
        if(d.querySelector('#pp-erase').checked) eraseFrom(ctx);
        d.close();
        toast(`Added ${out.length} ${out.length === 1 ? 'task' : 'tasks'}`);
        render();
      };
    });
  }

  /* Add a task by typing it. The handwriting route still exists, but it needs
     a reading step that can be wrong, and the hour boxes on the schedule are
     too small to write in comfortably anyway. This is the same destination by
     a road that cannot misread you. */
  function newTaskDialog(){
    const date = defaultDate();
    const mine = (H.tasks ? H.tasks(date, date) : []).slice()
      .sort((a, b) => String(a.at || '~').localeCompare(String(b.at || '~')));
    const pretty = iso => { const d = dOf(iso);
      return d.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' }); };

    dialog(`<h2>Add a task</h2>
      <p class="pp-dnote">On ${esc(pretty(date))}. Leave the time empty and it
        simply belongs to the day.</p>
      <input class="pp-in" id="nt-title" placeholder="What needs doing" autocomplete="off">
      <div class="pp-row2" style="display:flex;gap:10px;margin-top:10px">
        <label style="flex:1">
          <span class="pp-dnote" style="display:block;margin:0 0 4px">Time</span>
          <input class="pp-in" id="nt-at" type="time" step="300">
        </label>
        <label style="width:108px">
          <span class="pp-dnote" style="display:block;margin:0 0 4px">Minutes</span>
          <input class="pp-in" id="nt-mins" type="number" min="0" step="15" placeholder="60">
        </label>
      </div>
      ${mine.length ? `<p class="pp-dnote" style="margin-top:12px">Already on this day:
        ${mine.slice(0, 8).map(t => esc((t.at ? t.at + ' ' : '') + t.title)).join(' · ')}${
          mine.length > 8 ? ' …' : ''}</p>` : ''}
      <div class="pp-acts">
        <span class="pp-grow"></span>
        <button type="button" class="pp-btn" data-x>Cancel</button>
        <button type="button" class="pp-btn pri" data-ok>Add it</button>
      </div>`, d => {
      const title = d.querySelector('#nt-title');
      setTimeout(() => title && title.focus(), 50);
      const add = async () => {
        const v = (title.value || '').trim();
        if(!v){ title.focus(); return; }
        const at = (d.querySelector('#nt-at').value || '').trim();
        const mins = +(d.querySelector('#nt-mins').value || 0) || (at ? 60 : 0);
        d.close();
        await H.addTasks([{ title: v, date, at: at || '', mins }]);
        toast(at ? `Added at ${at}` : 'Added to the day');
      };
      d.querySelector('[data-x]').onclick = () => d.close();
      d.querySelector('[data-ok]').onclick = add;
      title.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); add(); } });
    });
  }

  function typedDialog(ctx, text){
    /* A journal box keeps its handwriting on the page and can also put the
       words in that day's journal entry, which is where you would go looking
       for them weeks later. Off unless asked, and it appends under a heading
       rather than overwriting whatever is already there. */
    const jr = ctx.journal && H.journal;
    dialog(`<h2>Typed version</h2>
      <p class="pp-dnote">Saved with this page so it can be searched later. Your handwriting stays as it is.</p>
      <textarea class="pp-in pp-ta" rows="8">${esc(text)}</textarea>
      ${jr ? `<label class="pp-chk" style="margin-top:10px"><input type="checkbox" id="pp-jr" checked>
        <span>Also add to ${esc(ctx.date)}'s journal, under “${esc(ctx.journal)}”</span></label>` : ''}
      <div class="pp-acts">
        ${ctx.r.typed[ctx.z] ? '<button type="button" class="pp-btn" data-del>Remove typed copy</button>' : ''}
        <span class="pp-grow"></span>
        <button type="button" class="pp-btn" data-x>Cancel</button>
        <button type="button" class="pp-btn pri" data-ok>Save</button></div>`, d => {
      d.querySelector('[data-x]').onclick = () => d.close();
      const del = d.querySelector('[data-del]');
      if(del) del.onclick = () => { delete ctx.r.typed[ctx.z]; saveRec(ctx.k, ctx.r); d.close(); render(); };
      d.querySelector('[data-ok]').onclick = async () => {
        const v = d.querySelector('textarea').value.trim();
        if(v) ctx.r.typed[ctx.z] = v; else delete ctx.r.typed[ctx.z];
        saveRec(ctx.k, ctx.r);
        const jbox = d.querySelector('#pp-jr');
        d.close(); render();
        if(v && jbox && jbox.checked){
          try { await H.journal(ctx.date, ctx.journal, v); toast('Added to the journal'); }
          catch(e){ toast('Saved on the page, but the journal could not be written'); }
        }
      };
    });
  }
  function showTyped(z){
    const zEl = host.querySelector(`[data-z="${z}"]`); if(!zEl) return;
    typedDialog({ z, side: zEl.closest('.pp-page').dataset.side, kind: 'text', strokes: [], k: key, r: rec,
      date: zEl.dataset.date || defaultDate(), journal: zEl.dataset.journal || '' }, rec.typed[z] || '');
  }

  /* ---------------------------------------------------------- mount */
  let wired = false;
  async function mount(el, hooks){
    H = hooks || {};
    if(host && host !== el) host.innerHTML = '';
    host = el; host.classList.add('pp-host');
    if(!wired){ wired = true; await loadMeta(); global.addEventListener('beforeunload', flush); }
    if(!host.dataset.ppWired){
      host.dataset.ppWired = '1';
      host.addEventListener('click', e => {
        if(e.target.classList.contains('pp-ink')){
          if(skipClick) return;                    /* the pen already handled it */
          const t = underneath(e.clientX, e.clientY); if(t) activate(t); return;
        }
        const t = e.target.closest('[data-tick],[data-go],[data-glance],[data-rate],[data-mood],[data-pa]');
        if(t && host.contains(t)) activate(t);
      });
      host.addEventListener('change', e => { if(e.target.classList.contains('pp-size')){ st.size = e.target.value; if(st.tool !== 'pen') st.tool = 'pen'; saveMeta(); render(); } });
      host.addEventListener('keydown', e => {
        const t = e.target.closest && e.target.closest('[data-tick],[data-go],[data-glance],[data-rate],[data-mood]');
        if(t && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); activate(t); }
      });
    }
    if(ro) ro.disconnect();
    let lastW = 0;
    ro = global.ResizeObserver ? new ResizeObserver(() => {
      const w = host.clientWidth; if(Math.abs(w - lastW) < 2) return; lastW = w;
      const two = host.querySelectorAll('.pp-page').length === 2;
      if(st.spread === null && two !== spreadOn()) render(); else fit();
    }) : null;
    if(ro) ro.observe(host);
    await render();
  }

  global.Paper = {
    mount, render: () => render(), flush,
    open(where){ go(where); },
    /* for sending later: every page you've written on */
    async pages(){ flush(); const out = {};
      for(const k of Object.keys(meta.idx)){ out[k] = cache[k] || await Store.get('settings', 'paper:' + k); } return out; },
    meta: () => meta
  };
})(window);
