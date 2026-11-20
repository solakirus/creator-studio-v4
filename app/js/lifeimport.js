/* Life tasks — to-dos from your other apps, brought in to be filmed.

   Punch (the house), the car app and Homebase (the family) each keep their own
   list. Each one saves a "life tasks" file; this reads it, tags every task with
   the part of life it came from (Home, Car, Family, …) so Today can show one
   part at a time, and skips anything that is already here.

   A task counts as already here — and is skipped, not imported twice — when:
     1. the same app's same task id was imported before (it carries `src`),
        even if you have since deleted or finished it here;
     2. a task with the same title is already on the same day, from anywhere —
        one you typed in yourself counts too;
     3. it appears twice in the same file.
   An undated task lands on today; it is a duplicate when the same title is
   still open on any day.

   The file (JSON):
     { "format":"life-tasks", "version":1, "app":"Punch", "area":"home",
       "tasks":[ { "id":"t42", "title":"Re-caulk the tub", "date":"2026-11-22",
                   "time":"09:00", "minutes":90, "where":"Bathroom",
                   "project":"Bathroom refresh", "notes":"…", "steps":["…","…"] } ] }
   Several apps can go in one file as an array of those. A CSV works too, with
   the columns app, area, id, title, date, time, minutes, hours, where, project,
   notes, steps (steps separated by semicolons). Only title is required. */
(function(global){

  const FORMAT = 'life-tasks';
  const SEEN_KEY = 'lifeimport:seen';

  /* the parts of life; an app nobody knows gets an area of its own name */
  const AREAS = {
    home:   { label:'Home',   c:'#D9A441' },
    car:    { label:'Car',    c:'#5A8FD6' },
    family: { label:'Family', c:'#E0627A' }
  };
  const slugOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  function guessArea(app){
    const a = String(app || '').toLowerCase();
    if(/punch|house|home(?!base)|diy/.test(a)) return 'home';
    if(/car|vehicle|torque|garage|auto/.test(a)) return 'car';
    if(/homebase|family|chore|hub|kid/.test(a)) return 'family';
    return slugOf(a) || 'other';
  }
  function areaInfo(id){
    if(AREAS[id]) return { id, ...AREAS[id] };
    const label = String(id || 'Other').replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
    return { id: id || 'other', label, c:'#8A8F98' };
  }

  /* titles compare without case, punctuation or doubled spaces */
  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  const isoDate = v => {
    const s = String(v || '').trim();
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);      /* 11/22/2026 */
    if(us) return `${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;
    return '';
  };
  const time24 = v => {
    const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(String(v || '').trim());
    if(!m) return '';
    let h = +m[1]; const mm = m[2] || '00', ap = (m[3] || '').toLowerCase();
    if(ap === 'pm' && h < 12) h += 12;
    if(ap === 'am' && h === 12) h = 0;
    return h > 23 ? '' : `${String(h).padStart(2,'0')}:${mm}`;
  };
  const listOf = v => Array.isArray(v)
    ? v.map(x => typeof x === 'string' ? x : (x && (x.title || x.t || x.text || x.name)) || '').map(x => String(x).trim()).filter(Boolean)
    : String(v || '').split(/[;|\n]/).map(x => x.trim()).filter(Boolean);
  const pick = (o, ...keys) => { for(const k of keys) if(o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return ''; };

  /* one task from any app, in one shape */
  function item(raw, app, area){
    const o = raw || {};
    const title = String(pick(o, 'title', 'name', 'task')).replace(/\s+/g, ' ').trim();
    if(!title || title.startsWith('#')) return null;
    const theApp = String(pick(o, 'app', 'source') || app || 'Other app').trim();
    const theArea = slugOf(pick(o, 'area', 'life') || area) || guessArea(theApp);
    const date = isoDate(pick(o, 'date', 'due', 'day', 'scheduled'));
    const hours = parseFloat(pick(o, 'hours', 'estimate_hours'));
    const mins = parseFloat(pick(o, 'minutes', 'mins', 'duration'));
    const id = String(pick(o, 'id', 'uid', 'key')).trim();
    return {
      app: theApp, area: theArea, title, date,
      time: time24(pick(o, 'time', 'at', 'start')),
      minutes: Math.round(isFinite(mins) && mins > 0 ? mins : isFinite(hours) && hours > 0 ? hours * 60 : 0),
      where: String(pick(o, 'where', 'room', 'location', 'area_detail')).trim(),
      project: String(pick(o, 'project', 'group', 'vehicle', 'job')).trim(),
      notes: String(pick(o, 'notes', 'note', 'description')).trim(),
      steps: listOf(pick(o, 'steps', 'subtasks', 'checklist')),
      /* the key that says "this exact task from this exact app" */
      src: slugOf(theApp) + ':' + (id || norm(title) + '|' + date)
    };
  }

  /* ---------- reading a file ---------- */
  function parseCSV(text){
    const rows = []; let row = [], field = '', q = false;
    for(let i = 0; i < text.length; i++){
      const c = text[i];
      if(q){
        if(c === '"' && text[i+1] === '"'){ field += '"'; i++; }
        else if(c === '"') q = false;
        else field += c;
      } else if(c === '"') q = true;
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else if(c !== '\r') field += c;
    }
    if(field || row.length){ row.push(field); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim()));
  }

  /* text → [item]; `app` names the source when the file itself doesn't */
  function parse(text, app){
    const t = String(text || '').replace(/^﻿/, '').trim();
    if(!t) return [];
    if(t[0] === '{' || t[0] === '['){
      const data = JSON.parse(t);
      const batches = Array.isArray(data)
        ? (data.length && data[0] && Array.isArray(data[0].tasks) ? data : [{ tasks: data }])
        : [data];
      const out = [];
      for(const b of batches){
        const tasks = Array.isArray(b.tasks) ? b.tasks : Array.isArray(b.items) ? b.items : [];
        for(const r of tasks){ const it = item(r, b.app || app, b.area); if(it) out.push(it); }
      }
      return out;
    }
    const rows = parseCSV(t);
    if(rows.length < 2) return [];
    const head = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    return rows.slice(1).map(r => {
      const o = {}; head.forEach((h, i) => o[h] = (r[i] || '').trim());
      return item(o, app);
    }).filter(Boolean);
  }

  /* ---------- what's new and what's already here ----------
     items:    from parse()
     existing: the tasks already in the app (and the deleted ones still kept)
     seen:     src keys imported before
     dayOf:    'YYYY-MM-DD' → program day number (sync)
     today:    today's program day number */
  function classify(items, existing, seen, dayOf, today){
    const srcs = new Set(seen || []);
    const titleDay = new Set(), openTitles = new Set();
    for(const t of existing || []){
      if(!t || !t.title) continue;
      if(t.src) srcs.add(t.src);
      titleDay.add(norm(t.title) + '|' + t.day);
      if(t.view !== 'done' && t.view !== 'skipped') openTitles.add(norm(t.title));
    }
    const add = [], dup = [];
    for(const it of items){
      const day = it.date ? dayOf(it.date) : today;
      const td = norm(it.title) + '|' + day;
      let why = '';
      if(srcs.has(it.src)) why = 'imported before';
      else if(titleDay.has(td)) why = 'already on that day';
      else if(!it.date && openTitles.has(norm(it.title))) why = 'already on your list';
      if(why){ dup.push({ ...it, day, why }); continue; }
      add.push({ ...it, day });
      srcs.add(it.src); titleDay.add(td); openTitles.add(norm(it.title));   /* twice in one file */
    }
    return { add, dup };
  }

  /* the task as Creator Studio keeps it */
  const escHTML = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  function toTask(it, id, shoot){
    const from = [`From ${it.app}`, it.where, it.project].filter(Boolean).join(' · ');
    return {
      id, day: it.day, title: it.title,
      at: it.time || null, mins: it.minutes || 0,
      cad: 'One-off', pri: 'med', prog: '',
      subs: it.steps.map(t => ({ t, done:false })), shots: [], view: 'todo',
      kind: shoot ? 'shoot' : undefined,
      life: it.area, lifeApp: it.app, src: it.src,
      /* `note` is shown above the task as written, so it is escaped here */
      note: escHTML(from) + (it.notes ? '<br>' + escHTML(it.notes) : '')
    };
  }

  /* ---------- in the app ---------- */
  async function dayMapper(items){
    const dates = [...new Set(items.map(i => i.date).filter(Boolean))];
    const map = new Map();
    for(const d of dates){
      try { map.set(d, await Data.dateToDay(new Date(d + 'T09:00').getTime())); } catch(e){}
    }
    return d => map.has(d) ? map.get(d) : null;
  }
  async function seenKeys(){
    try { const v = await Store.get('settings', SEEN_KEY); return Array.isArray(v) ? v : []; }
    catch(e){ return []; }
  }
  async function deletedTasks(){
    try { return (await Store.all('trash')).values.filter(r => r && r.store === 'tasks' && r.value).map(r => r.value); }
    catch(e){ return []; }
  }

  async function preview(text, app){
    const items = parse(text, app);
    const [tasks, gone, seen, today, dayOf] = await Promise.all([
      Data.tasks(), deletedTasks(), seenKeys(), Data.currentDay(), dayMapper(items)]);
    const r = classify(items, tasks.concat(gone), seen, d => { const n = dayOf(d); return n == null ? today : n; }, today);
    r.total = items.length;
    return r;
  }

  async function apply(plan, { shoot = true } = {}){
    for(const it of plan.add) await Store.put('tasks', toTask(it, U.taskId(), shoot));
    /* remember what came in, so deleting it here never brings it back */
    const seen = await seenKeys();
    const all = [...new Set(seen.concat(plan.add.map(i => i.src), plan.dup.map(i => i.src)))];
    try { await Store.put('settings', all.slice(-5000), SEEN_KEY); } catch(e){ console.warn('lifeimport: could not note what came in', e); }
    Data.invalidate('tasks');
    return plan.add.length;
  }

  /* a blank file to fill in by hand or from another app */
  const TEMPLATE = 'app,area,id,title,date,time,minutes,where,project,notes,steps\n' +
    '#Punch,home,t42,Re-caulk the tub,2026-11-22,09:00,90,Bathroom,Bathroom refresh,Film the before and after,Scrape old caulk; Clean; Tape; Caulk; Pull tape\n';

  /* ---------- the sheet: paste or pick → see what's new → bring it in ---------- */
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const fmtDay = d => d ? new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }) : 'Today';

  function open(after){
    let text = '', plan = null, shoot = true;

    const intro = () => `
      <h2>Import from my other apps</h2>
      <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.6">
        Bring in a task file from Punch, the car app, Homebase or any app that saves one.
        Every task is tagged Home, Car or Family so Today can show one at a time.
        Anything already here is skipped — even ones you've since deleted or finished.</p>
      <div class="field"><label for="li-text">Paste it, or choose the file</label>
        <textarea id="li-text" rows="5" placeholder='{"format":"life-tasks","app":"Punch","tasks":[…]}'>${escHTML(text)}</textarea></div>
      <div class="sheetcta">
        <button class="btn-primary" data-li="check">Check for new tasks</button>
        <button class="btn-ghost" data-li="file">Choose file</button>
      </div>
      <button class="btn-ghost" data-li="template" style="width:100%;margin-top:10px">Save a blank template</button>
      <button class="btn-ghost" data-li="cancel" style="width:100%;margin-top:10px">Cancel</button>`;

    const result = () => {
      const groups = new Map();
      plan.add.concat(plan.dup).forEach(it => {
        const g = groups.get(it.area) || { area: areaInfo(it.area), apps: new Set(), add: [], dup: [] };
        g.apps.add(it.app);
        (plan.add.includes(it) ? g.add : g.dup).push(it);
        groups.set(it.area, g);
      });
      const block = g => `
        <div style="border:1px solid var(--line);border-left:4px solid ${g.area.c};border-radius:var(--r);padding:12px 13px;margin:0 0 10px;background:var(--surface-1)">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
            <b style="font-size:15px">${escHTML(g.area.label)} <span style="color:var(--dim);font-weight:500;font-size:12.5px">· ${escHTML([...g.apps].join(', '))}</span></b>
            <span style="font-size:12.5px;color:var(--muted);white-space:nowrap">${g.add.length} new · ${g.dup.length} skipped</span>
          </div>
          ${g.add.length ? `<ul style="margin:8px 0 0;padding:0;list-style:none;font-size:13.5px;line-height:1.7">
            ${g.add.slice(0, 8).map(i => `<li><span style="color:var(--dim);display:inline-block;min-width:92px">${fmtDay(i.date)}</span>${escHTML(i.title)}</li>`).join('')}
            ${g.add.length > 8 ? `<li style="color:var(--dim)">and ${g.add.length - 8} more</li>` : ''}</ul>` : ''}
          ${g.dup.length ? `<details style="margin-top:6px"><summary style="font-size:12.5px;color:var(--dim);cursor:pointer">Skipped as duplicates</summary>
            <ul style="margin:6px 0 0;padding:0;list-style:none;font-size:12.5px;line-height:1.7;color:var(--dim)">
            ${g.dup.slice(0, 20).map(i => `<li>${escHTML(i.title)} — ${i.why}</li>`).join('')}
            ${g.dup.length > 20 ? `<li>and ${g.dup.length - 20} more</li>` : ''}</ul></details>` : ''}
        </div>`;
      return `
        <h2>${plan.add.length ? plural(plan.add.length, 'new task') : 'Nothing new'}</h2>
        <p style="margin:0 0 14px;color:var(--muted);font-size:14px">
          ${plural(plan.total, 'task')} in the file · ${plan.dup.length} already here, skipped</p>
        ${[...groups.values()].map(block).join('')}
        ${plan.add.length ? `
        <label style="display:flex;gap:10px;align-items:center;margin:6px 0 16px;font-size:14.5px">
          <input type="checkbox" data-li="shoot" ${shoot ? 'checked' : ''} style="width:20px;height:20px">
          Film these — mark them as shoot tasks</label>
        <div class="sheetcta">
          <button class="btn-primary" data-li="go">Import ${plural(plan.add.length, 'task')}</button>
          <button class="btn-ghost" data-li="back">Back</button>
        </div>` : `<div class="sheetcta"><button class="btn-primary" data-li="cancel">Done</button>
          <button class="btn-ghost" data-li="back">Back</button></div>`}`;
    };

    App.sheet('', el => {
      el.innerHTML = intro();
      el.addEventListener('change', e => { if(e.target.dataset && e.target.dataset.li === 'shoot') shoot = e.target.checked; });
      el.addEventListener('click', async e => {
        const b = e.target.closest('[data-li]');
        if(!b || b.tagName === 'INPUT') return;
        const act = b.dataset.li;
        if(act === 'cancel') return App.closeSheet();
        if(act === 'back'){ plan = null; el.innerHTML = intro(); return; }
        if(act === 'template'){
          try { await Saver.save('life-tasks-template.csv', TEMPLATE, 'text/csv;charset=utf-8', 'Life tasks template'); }
          catch(err){ U.toast('Could not save the template'); }
          return;
        }
        if(act === 'file'){
          const t = await Transfer.pickFile('.json,.csv,.txt,application/json,text/csv,text/plain');
          if(t) el.querySelector('#li-text').value = t;
          return;
        }
        if(act === 'check'){
          text = el.querySelector('#li-text').value.trim();
          if(!text) return U.toast('Paste a task file or choose one');
          try { plan = await preview(text); }
          catch(err){ console.error(err); return U.toast('That file could not be read'); }
          if(!plan.total) return U.toast('No tasks found in that file');
          el.innerHTML = result();
          return;
        }
        if(act === 'go' && plan){
          b.disabled = true;
          try {
            const n = await apply(plan, { shoot });
            App.closeSheet();
            U.toast(`Imported ${plural(n, 'task')}${plan.dup.length ? ` · skipped ${plan.dup.length} duplicate${plan.dup.length === 1 ? '' : 's'}` : ''}`);
            if(App.refreshTab) App.refreshTab();
            if(after) after();
          } catch(err){ console.error(err); b.disabled = false; U.toast('Import stopped — run it again; what came in won’t double up'); }
        }
      });
    });
  }

  const api = { FORMAT, AREAS, areaInfo, guessArea, norm, parse, classify, toTask, preview, apply, open, TEMPLATE, SEEN_KEY };
  global.LifeImport = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
