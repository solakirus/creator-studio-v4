/* v4: the task's Steps + Shot page, everywhere a video is planned.

   A task has its shots as steps beside a shot page (a notebook page with a
   frame — GIF, clip or still — in each spot), Next up, and shoot mode. An
   episode's sequence, a clip and a series video now have exactly that: they
   lend the task screen a task-shaped copy of themselves and take it back on
   save (a "host"), so it is the same Steps block, not a look-alike.

     ShotList.hostBeat(vlogId, beatId) / hostClip(id) / hostVideo(id)
              { kicker, load() → { title, page, subs, pageFrom, morePages },
                save(t) }. Each record keeps page + subs, and a plain shot
              list beside them (beat.shots, clip/video .shotList + .shots) for
              everything that reads shots (Shots, board, counts, search).
              When something else changes that list (the board, ✦ Suggest
              shots, a tick on the day screen) the page is rebuilt from it.
     ShotList.embed(container, host, onChange)
              the Steps block inside another screen (screens/task.js)
     ShotList.toTask(t, shots, title)
              shots → a shot page (first 14, with frames) whose shots are the
              steps; the rest as plain steps
     ShotList.putOnDay / daySheet   one shoot task for a clip or video
     ShotList.norm(list)     old lists (plain text lines) become shots
     ShotList.thumbHTML / stripHTML / fillPics   small frames in lists */
(function(global){
  const esc = s => U.esc(s);
  const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ------------------------------------------------------------ the data */
  function norm(list){
    return (Array.isArray(list) ? list : []).map(x => {
      if(x == null) return null;
      if(typeof x === 'string') return x.trim() ? { id:uid(), text:x.trim(), note:'', framing:'', movement:'', role:'', item:'', done:false } : null;
      const o = { id:x.id || uid(), text:String(x.text || x.label || x.name || x.t || '').trim(), note:x.note || x.notes || '',
        framing:x.framing || '', movement:x.movement || '', role:x.role || '', item:x.item || x.frame || '', done:!!x.done };
      return extras(o, x);
    }).filter(s => s && (s.text || s.item));
  }
  /* what a shot carries besides its name and frame: the script lines said over
     it ([{ k:'vo'|'cam'|'txt', t, hook? }]), the note for the edit, and which
     beat of the structure it belongs to (structures.js) */
  function extras(o, x){
    if(Array.isArray(x.lines) && x.lines.length) o.lines = x.lines.map(l => ({ k:LINE_KINDS[l.k] ? l.k : 'vo', t:String(l.t || ''), ...(l.hook ? { hook:true } : {}) }));
    if(x.editNote) o.editNote = String(x.editNote);
    if(x.beat != null && x.beat !== '' && !isNaN(+x.beat)) o.beat = +x.beat;
    /* v4: the transition out of this shot into the next ({ id, n }: transitions.js) */
    if(x.tr && x.tr.id) o.tr = { id:String(x.tr.id), n:String(x.tr.n || '') };
    return o;
  }
  const LINE_KINDS = { vo:'VO', cam:'On cam', txt:'Text' };
  const texts = shots => norm(shots).map(s => s.text || 'Shot');
  const frames = shots => norm(shots).filter(s => s.item).length;
  const lineOf = s => [s.text || 'Shot', s.framing, s.movement].filter(Boolean).join(' — ');

  /* a shot template's shot (shottemplates.js) as a shot here */
  const dash = v => v && v !== '—' ? v : '';
  const fromTplShot = s => ({ id:uid(), text:s.label || s.name || s.role || 'Shot', note:s.notes || '', framing:dash(s.size),
    movement:dash(s.movement), role:s.role || '', item:s.item || '', done:false });

  /* the shots onto a task: a shot page (≤ 14) + its steps, the rest as steps */
  function toTask(t, shots, title){
    const list = norm(shots);
    if(!list.length || !global.Notebook) return t;
    const max = Notebook.MAX_STEPS || 14;
    const P = Notebook.stepsPage(title || t.title || 'Shots');
    P.name = 'Shot sequence · ' + (title || t.title || 'Shots');
    P.fields = { ...P.fields, task:'task — ' + (t.title || title || '') };
    P.slots = list.slice(0, max).map(s => ({ item:s.item || '', tone:'', text:lineOf(s), role:s.role || '', note:s.note || '', done:!!s.done }));
    t.page = P;
    delete t.pageOff;
    const keep = (t.subs || []).filter(s2 => s2 && s2.shot == null && !list.some(s => lineOf(s) === s2.t || s.text === s2.t));
    t.subs = list.slice(0, max).map((s, i) => extras({ t:lineOf(s), done:!!s.done, shot:i, pg:1, ...(s.note ? { note:s.note } : {}) }, s))
      .concat(list.slice(max).map(s => extras({ t:lineOf(s), done:!!s.done }, s)), keep);
    if(global.TaskPages) TaskPages.match(t);
    return t;
  }

  /* a copy of a host's page + steps for a task */
  function copyPage(t, src){
    t.page = global.Notebook && Notebook.copyNew ? Notebook.copyNew(src.page) : JSON.parse(JSON.stringify(src.page));
    (t.page.slots || []).forEach((sl, i) => { sl.done = false; });
    t.subs = (src.subs || []).map(x => ({ ...x, done:false }));
    if(src.pageFrom) t.pageFrom = src.pageFrom;
    if(Array.isArray(src.morePages) && src.morePages.length) t.morePages = src.morePages.map(x => global.Notebook && Notebook.copyNew ? Notebook.copyNew(x) : x);
    delete t.pageOff;
    if(global.TaskPages) TaskPages.match(t);
    return t;
  }

  /* one shoot task for a clip or video: made the first time, moved and
     refreshed after that (a ticked-off one is left alone and a new one made).
     o.page (+ o.subs): the clip's own shot page goes on as it is. */
  async function putOnDay(o){
    let t = o.taskId ? await Store.get('tasks', o.taskId).catch(() => null) : null;
    if(t && t.view === 'done') t = null;
    if(!t) t = { id:U.taskId(), cad:'One-off', pri:'med', at:null, mins:0, prog:'', note:o.note || '', subs:[], view:'todo', kind:'shoot', ...(o.extra || {}) };
    t.day = o.day;
    t.title = 'Shoot — ' + (o.title || 'Untitled');
    if(o.page){ t.subs = []; copyPage(t, o); }
    else toTask(t, o.shots, o.title);
    if(Array.isArray(o.beatNames) && o.beatNames.length) t.beatNames = o.beatNames.slice(); else delete t.beatNames;
    await Store.put('tasks', t);
    if(global.Data && Data.invalidate) Data.invalidate('tasks');
    return t;
  }
  /* the sheet that asks which day — resolves to the task, null if taken off,
     undefined if cancelled */
  function daySheet(o){
    return new Promise(async resolve => {
      const had = o.taskId ? await Store.get('tasks', o.taskId).catch(() => null) : null;
      const field = await U.dayField('sl-day', (had && had.day) || await Data.currentDay());
      App.sheet(`<h2 style="margin:0 0 4px">${had ? 'Move the shoot' : 'Put the shoot on a day'}</h2>
        <p class="hintline" style="margin:0 0 12px">A shoot task with its ${o.page ? (o.page.slots || []).length : norm(o.shots).length} shots as its steps and its shot page —
          frames, shoot mode, and on your phone.</p>
        ${field}
        <div class="sheetcta"><button class="btn-primary" data-ok>${had ? 'Save' : 'Put it on that day'}</button>
          ${had ? '<button class="btn-ghost" data-off>Take it off my days</button>' : ''}
          <button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
        U.wireDayField(sh, 'sl-day');
        sh.addEventListener('click', async e => {
          if(e.target.closest('[data-no]')){ App.closeSheet(); return resolve(undefined); }
          if(e.target.closest('[data-off]')){
            try { await Store.del('tasks', had.id); } catch(err){}
            if(global.Data && Data.invalidate) Data.invalidate('tasks');
            App.closeSheet(); return resolve(null);
          }
          if(!e.target.closest('[data-ok]')) return;
          const day = await U.readDayField(sh, 'sl-day');
          if(day == null) return U.toast('Pick a day');
          const t = await putOnDay({ ...o, day });
          App.closeSheet();
          resolve(t);
        });
      });
    });
  }

  /* ------------------------------------------------------------ the look */
  const CSS = `
  .sl-strip{display:flex;gap:4px;margin:8px 0 0;overflow:hidden}
  .sl-strip span{width:34px;height:42px;flex:0 0 34px;border-radius:3px;overflow:hidden;background:var(--surface-1,#1F1C17);border:1px solid var(--line)}
  .sl-strip img,.sl-strip video{width:100%;height:100%;object-fit:cover;display:block}
  .shotline .sl-mini{width:28px;height:34px;flex:0 0 28px;border-radius:3px;overflow:hidden;background:var(--surface-1,#1F1C17);border:1px solid var(--line);margin-right:2px}
  .sl-mini img,.sl-mini video{width:100%;height:100%;object-fit:cover;display:block}
  .sl-mini i{display:none}
  .sl-strip em{font-style:normal;color:var(--dim);font-size:12px;align-self:center;margin-left:2px}
  .sl-dropchip{cursor:pointer;white-space:nowrap}
  .sl-dropchip .chev svg{width:12px;height:12px;vertical-align:-1px;margin-left:3px;transition:transform .15s}
  .sl-dropchip.open .chev svg{transform:rotate(180deg)}
  .sl-dropnone{margin:0;padding:10px 13px;color:var(--muted);font-size:14px}
  .tk-host.embedded > .block{margin:0;border:0;background:transparent;padding:0}
  .tk-host.embedded > .block > h4{display:none}`;
  function css(){
    if(document.getElementById('sl-css')) return;
    const st = document.createElement('style'); st.id = 'sl-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* fill every [data-slpic] under host with its frame, moving */
  async function fillPics(host){
    css();
    const cells = [...host.querySelectorAll('[data-slpic]')];
    if(!cells.length || !global.MediaLib) return;
    let lib = null;
    try { lib = await MediaLib.load(); } catch(e){ return; }
    for(const c of cells){
      const it = MediaLib.find(lib, c.dataset.slpic);
      const u = it ? await MediaLib.url(it).catch(() => null) : null;
      if(!c.isConnected) continue;
      c.innerHTML = !u ? '<i>on its way</i>' : it.kind === 'video'
        ? `<video src="${esc(u)}" muted loop autoplay playsinline preload="metadata"></video>` : `<img src="${esc(u)}" alt="" loading="lazy">`;
    }
  }

  /* a shot line's frame, small (episode screens' .shotline rows) */
  const thumbHTML = s => s && s.item ? `<span class="sl-mini" data-slpic="${esc(s.item)}"></span>` : '';

  /* a row of small frames — for a list's summary (a day, a card) */
  function stripHTML(shots, max){
    const f = norm(shots).filter(s => s.item);
    if(!f.length) return '';
    const n = max || 8;
    return `<div class="sl-strip">${f.slice(0, n).map(s => `<span data-slpic="${esc(s.item)}"></span>`).join('')}${f.length > n ? `<em>+${f.length - n}</em>` : ''}</div>`;
  }

  /* ------------------------------------------------------------ hosts */
  /* page + steps → a plain shot list, in page order, then the other steps */
  function fromTask(t){
    const out = [], P = t.page, subs = t.subs || [];
    const n = P && Array.isArray(P.slots) ? P.slots.length : 0;
    for(let i = 0; i < n; i++){
      const sl = P.slots[i] || {}, mine = subs.filter(x => x.shot === i);
      out.push(extras({ text:sl.text || '', role:sl.role || '', item:sl.item || '', note:(mine[0] || {}).note || sl.note || '',
        done:mine.length ? mine.every(x => x.done) : !!sl.done }, mine[0] || sl));
    }
    subs.filter(x => !(x.shot != null && x.shot >= 0 && x.shot < n)).forEach(x => out.push(extras({ text:x.t || '', note:x.note || '', role:'', item:'', done:!!x.done }, x)));
    return out;
  }
  /* what a shot list looks like, so a change made elsewhere is noticed */
  const sigOf = list => JSON.stringify(norm(list).map(x => [x.text, x.item, !!x.done]));

  function host(o){
    let rec = null;
    return {
      kicker:o.kicker,
      async load(){
        rec = await o.get();
        if(!rec) return null;
        const title = o.title(rec);
        const t = { id:o.key, title, kind:'shoot', page:rec.page || null, subs:(rec.subs || []).map(x => ({ ...x })),
          pageFrom:rec.pageFrom || null, morePages:rec.morePages, hideDone:rec.hideDone, pageOff:rec.pageOff, swipeIds:[] };
        /* the structure's beats, so the steps can show where each one starts (shown, never saved back) */
        const bn = o.beats ? o.beats(rec) : null;
        if(bn && bn.length) t.beatNames = bn.slice();
        const shots = o.shots(rec);
        /* no page yet, or its shot list was changed somewhere else: build it from the list */
        if(!t.page || (rec.shotsSig != null && rec.shotsSig !== sigOf(shots))){
          const old = t.page;
          t.page = null; t.subs = [];
          if(norm(shots).length) toTask(t, shots, title);
          else if(global.Notebook && !rec.pageOff){
            t.page = Notebook.stepsPage(title);
            t.page.name = 'Shot sequence · ' + title;
            t.page.slots = [];
          }
          if(old && t.page){ t.page.fields = { ...(t.page.fields || {}), ...(old.fields || {}) }; if(old.name) t.page.name = old.name; }
        }
        return t;
      },
      async save(t){
        rec = (await o.get()) || rec;
        if(!rec) return;
        rec.page = t.page || null;
        rec.subs = t.subs || [];
        if(t.pageFrom) rec.pageFrom = t.pageFrom; else delete rec.pageFrom;
        if(Array.isArray(t.morePages) && t.morePages.length) rec.morePages = t.morePages; else delete rec.morePages;
        if(t.hideDone !== undefined) rec.hideDone = t.hideDone;
        if(t.pageOff) rec.pageOff = true; else delete rec.pageOff;
        const list = fromTask(t);
        o.mirror(rec, list);
        rec.shotsSig = sigOf(o.shots(rec));
        await o.put(rec);
      }
    };
  }

  /* an episode's sequence (a beat inside vlogs) */
  function hostBeat(vlogId, beatId){
    let v = null;
    return host({ key:'beat:' + beatId, kicker:'Sequence',
      get: async () => { v = await Store.get('vlogs', vlogId); for(const a of (v && v.acts) || []) for(const b of a.beats || []) if(b.id === beatId) return b; return null; },
      put: async () => { await Store.put('vlogs', v); },
      title: b => b.title || 'Sequence',
      shots: b => b.shots || [],
      /* the beat's shots keep their ids, so a task or a board pointing at one still does */
      mirror: (b, list) => { const old = b.shots || [];
        b.shots = list.map((s, i) => extras({ id:(old[i] && old[i].id) || uid(), text:s.text, note:s.note, role:s.role, item:s.item, done:s.done }, s)); }
    });
  }
  const listHost = (key, kicker, get, put, beats) => host({ key, kicker, get, put, beats,
    title: r => r.title || 'Untitled',
    shots: r => Array.isArray(r.shotList) ? r.shotList : (r.shots || []),
    /* v4: the page only holds a shot's words and frame, so what else a shot
       carries (framing, movement, the lines said over it) is kept from the
       shot of the same words — saving the steps doesn't strip a plan's detail */
    mirror: (r, list) => {
      const old = norm(Array.isArray(r.shotList) ? r.shotList : r.shots);
      r.shotList = list.map(s => {
        const t = String(s.text || '').toLowerCase();
        /* the page writes a shot as "Grinder — Close-up — Push in" (lineOf) */
        const o = old.find(x => x.text && x.text.toLowerCase() === t) || old.find(x => x.text && lineOf(x).toLowerCase() === t);
        if(!o) return s;
        const m = { ...s };
        if(lineOf(o).toLowerCase() === t && o.text.toLowerCase() !== t){ m.text = o.text; m.framing = o.framing; m.movement = o.movement; }
        if(o.id && !m.id) m.id = o.id;
        ['framing', 'movement', 'editNote'].forEach(k => { if(!m[k] && o[k]) m[k] = o[k]; });
        if(!(m.lines && m.lines.length) && o.lines && o.lines.length) m.lines = o.lines;
        if(m.beat == null && o.beat != null) m.beat = o.beat;
        if(!m.note && o.note) m.note = o.note;
        return m;
      });
      r.shots = r.shotList.map(s => s.text || 'Shot');
    }
  });
  /* a clip */
  const hostClip = id => listHost('clip:' + id, 'Clip', () => Store.get('clips', id).catch(() => null), r => Data.saveClip(r),
    r => (r.plan && r.plan.beats) || []);
  /* a series' video */
  const hostVideo = id => listHost('video:' + id, 'Video', () => Store.get('videos', id).catch(() => null), r => Videos.save(r),
    r => r.beats || []);

  /* ------------------------------------------------------------ the drop-down
     The steps under a card, like a task's on Today: "1 / 6 shots ⌄" opens
     them; the box ticks one (crossed out), the words are edited in place.
     Saved through the record's host, so the page and its steps stay one. */
  function counts(rec){
    if(rec && rec.page && (rec.subs || []).length){
      return { d:rec.subs.filter(x => x.done).length, n:rec.subs.length };
    }
    const l = norm(rec && (Array.isArray(rec.shotList) ? rec.shotList : rec.shots));
    return { d:l.filter(x => x.done).length, n:l.length };
  }
  const CHEVD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  /* the chip in a card's meta line — key: 'clip:<id>' or 'video:<id>' */
  function dropChip(rec, key, open){
    const c = counts(rec);
    return `<span class="steps sl-dropchip${open ? ' open' : ''}" data-sldrop="${esc(key)}" role="button" tabindex="0" aria-expanded="${!!open}">${
      c.n ? `${c.d} / ${c.n} shots` : 'no shots yet'}<span class="chev">${CHEVD}</span></span>`;
  }
  const hostOf = key => { const [k, id] = String(key).split(':'); return k === 'clip' ? hostClip(id) : k === 'video' ? hostVideo(id) : null; };
  /* fill an open drop-down: <div class="subs" data-sldrop-body="key"></div> */
  async function fillDrop(box, onChange){
    css();
    const h = hostOf(box.dataset.sldropBody);
    if(!h) return;
    let t = await h.load();
    const draw = () => {
      if(!box.isConnected) return;
      const subs = (t && t.subs) || [];
      box.innerHTML = subs.length ? subs.map((x, i) => `
        <div class="sub${x.done ? ' done' : ''}" data-sub="${i}">
          <button class="box" data-subtick="${i}" aria-label="Tick shot ${i + 1}" aria-pressed="${!!x.done}">${TICK}</button>
          <input class="subname" data-subname="${i}" value="${esc(x.t || '')}" aria-label="Shot ${i + 1}" enterkeyhint="done">
        </div>`).join('') : '<p class="sl-dropnone">No shots yet — open it to add them.</p>';
    };
    const save = async () => { if(global.TaskPages && t.page) TaskPages.match(t); await h.save(t); t = await h.load(); draw(); if(onChange) onChange(counts({ page:t.page, subs:t.subs })); };
    if(!box._sl){
      box._sl = true;
      /* taps in here belong to the steps, never to the card underneath */
      box.addEventListener('click', async e => {
        e.stopPropagation();
        const b = e.target.closest('[data-subtick]');
        if(!b) return;
        const s2 = t.subs[+b.dataset.subtick];
        if(!s2) return;
        s2.done = !s2.done;
        if(t.page && s2.shot != null && t.page.slots && t.page.slots[s2.shot])
          t.page.slots[s2.shot].done = t.subs.filter(x => x.shot === s2.shot).every(x => x.done);
        await save();
      });
      box.addEventListener('keydown', e => {
        const f = e.target.closest('[data-subname]');
        if(!f) return;
        if(e.key === 'Enter'){ e.preventDefault(); f.blur(); }
        if(e.key === 'Escape'){ e.stopPropagation(); f.value = f.defaultValue; f.blur(); }
      });
      box.addEventListener('change', async e => {
        const f = e.target.closest('[data-subname]');
        if(!f) return;
        const s2 = t.subs[+f.dataset.subname];
        const v = f.value.trim();
        if(!s2 || !v || v === s2.t){ if(!v && s2) f.value = s2.t; return; }
        s2.t = v;
        if(t.page && s2.shot != null && t.page.slots && t.page.slots[s2.shot]) t.page.slots[s2.shot].text = v;
        await save();
      });
    }
    draw();
  }
  /* wire a list: chips toggle, open drop-downs fill. `open` is the caller's Set of keys. */
  function wireDrops(host, open, redraw){
    host.querySelectorAll('[data-sldrop-body]').forEach(box => fillDrop(box, c => {
      const chip = host.querySelector(`[data-sldrop="${box.dataset.sldropBody}"]`);
      if(chip && chip.firstChild) chip.firstChild.textContent = c.n ? `${c.d} / ${c.n} shots` : 'no shots yet';
    }));
  }
  /* a chip tap: true when it was one (the caller then redraws) */
  function toggleDrop(e, open){
    const chip = e.target.closest && e.target.closest('[data-sldrop]');
    if(!chip) return false;
    e.stopPropagation();
    const k = chip.dataset.sldrop;
    open.has(k) ? open.delete(k) : open.add(k);
    return true;
  }

  /* the Steps block of the task screen, inside another screen */
  function embed(container, h, onChange){
    css();
    if(!container || !global.Screens) return false;
    return Screens.mountInto('task', container, { host:h, embedded:true, onChange });
  }

  global.ShotList = { LINE_KINDS, extras, hostBeat, hostClip, hostVideo, embed, counts, dropChip, fillDrop, wireDrops, toggleDrop, fromTask, toTask, copyPage, putOnDay, daySheet, norm, texts, frames, lineOf,
    fromTplShot, stripHTML, thumbHTML, fillPics, css };
})(window);
