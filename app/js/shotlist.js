/* v4: one shot list, everywhere a video is planned.

   A task already had it: its shots as steps, each with its frame (a GIF, clip
   or still), and shoot mode to film them one at a time. Episodes, clips and a
   series' videos each had their own — a list of text lines, or shots with a
   framing tag — and none of them could hold a frame. This is the task's list,
   for all of them:

     a shot   { id, text, note, framing, movement, role, item, done }
              item is a Library uid (db:li_… / h:root|path); the frame travels
              to the phone with whatever holds it (taskframes.js)

     ShotList.mount(host, { get, save, title, swapNote })
              rows with the frame moving beside each line; tap the line to
              edit it, tap the frame to shoot from there (or pick one when it
              has none), hold the frame to swap it; ＋ Add a shot, ＋ From a
              template, ＋ Frames from the Library (laptop), ▶ Shoot
     ShotList.shoot(o, at)   shoot mode over the list (screens/shoot-run.js)
     ShotList.toTask(t, shots, title)
              puts the shots on a task the way a template does: a shot page
              (first 14, with frames) whose shots are the steps; the rest as
              plain steps after them
     ShotList.norm(list)     old lists (plain text lines) become shots
     ShotList.fromTemplate() a template's shots (shot templates with their
              frames, and sequence templates) */
(function(global){
  const esc = s => U.esc(s);
  const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const FRAMING  = ['Wide', 'Medium', 'Close', 'Over-shoulder', 'POV', 'Top-down'];
  const MOVEMENT = ['Static', 'Pan', 'Tilt', 'Push in', 'Pull out', 'Tracking', 'Handheld'];
  const onLaptop = () => !!global.CS3Lib;

  /* ------------------------------------------------------------ the data */
  function norm(list){
    return (Array.isArray(list) ? list : []).map(x => {
      if(x == null) return null;
      if(typeof x === 'string') return x.trim() ? { id:uid(), text:x.trim(), note:'', framing:'', movement:'', role:'', item:'', done:false } : null;
      return { id:x.id || uid(), text:String(x.text || x.label || x.name || x.t || '').trim(), note:x.note || x.notes || '',
        framing:x.framing || '', movement:x.movement || '', role:x.role || '', item:x.item || x.frame || '', done:!!x.done };
    }).filter(s => s && (s.text || s.item));
  }
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
    t.subs = list.slice(0, max).map((s, i) => ({ t:lineOf(s), done:!!s.done, shot:i, pg:1, ...(s.note ? { note:s.note } : {}) }))
      .concat(list.slice(max).map(s => ({ t:lineOf(s), done:!!s.done })), keep);
    if(global.TaskPages) TaskPages.match(t);
    return t;
  }

  /* one shoot task for a clip or video: made the first time, moved and
     refreshed after that (a ticked-off one is left alone and a new one made) */
  async function putOnDay(o){
    let t = o.taskId ? await Store.get('tasks', o.taskId).catch(() => null) : null;
    if(t && t.view === 'done') t = null;
    if(!t) t = { id:U.taskId(), cad:'One-off', pri:'med', at:null, mins:0, prog:'', note:o.note || '', subs:[], view:'todo', kind:'shoot', ...(o.extra || {}) };
    t.day = o.day;
    t.title = 'Shoot — ' + (o.title || 'Untitled');
    toTask(t, o.shots, o.title);
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
        <p class="hintline" style="margin:0 0 12px">A shoot task with ${norm(o.shots).length} shot${norm(o.shots).length === 1 ? '' : 's'} as its steps and its shot page —
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

  /* ------------------------------------------------------------ templates */
  async function templates(){
    const out = [];
    try { (await ShotTemplates.all()).filter(t => (t.shots || []).length)
      .forEach(t => out.push({ id:'st:' + t.id, name:t.name, n:t.shots.length, f:t.shots.filter(s => s.item).length, shots:() => t.shots.map(fromTplShot) })); } catch(e){}
    try { (await SeqLib.all()).forEach(t => out.push({ id:'sq:' + t.id, name:t.name, n:(t.shots || []).length,
      f:norm(t.shots).filter(s => s.item).length, shots:() => norm(t.shots).map(s => ({ ...s, id:uid(), done:false })) })); } catch(e){}
    return out;
  }
  function fromTemplate(title){
    return new Promise(async resolve => {
      const list = await templates();
      if(!list.length){ U.toast('No templates with shots yet'); return resolve(null); }
      App.sheet(`<h2 style="margin:0 0 4px">${esc(title || 'Shots from a template')}</h2>
        <p class="hintline" style="margin:0 0 12px">Its shots go on the end of this list${list.some(x => x.f) ? ', frames and all' : ''}.</p>
        <div class="group compact" style="max-height:56vh;overflow:auto">${list.map(x => `<button class="row" data-tp="${esc(x.id)}">
          <span class="lbl">${esc(x.name)}<small>${x.n} shot${x.n === 1 ? '' : 's'}${x.f ? ` · ${x.f} with frames` : ''}</small></span></button>`).join('')}</div>
        <div class="sheetcta"><button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
        sh.addEventListener('click', e => {
          if(e.target.closest('[data-no]')){ App.closeSheet(); return resolve(null); }
          const b = e.target.closest('[data-tp]');
          if(!b) return;
          const x = list.find(y => y.id === b.dataset.tp);
          App.closeSheet();
          resolve(x ? { name:x.name, shots:x.shots() } : null);
        });
      });
    });
  }

  /* pick one frame: the Library on the laptop, a starred frame on the phone */
  function pickFrame(title, has){
    return new Promise(resolve => {
      if(onLaptop() && global.LibView) return LibView.pick({ title }).then(u => resolve(u || null));
      if(!global.StarPick) return resolve(null);
      StarPick.open({ title, clear:!!has, onPick:u => resolve(u) });
    });
  }

  /* ------------------------------------------------------------ the look */
  const CSS = `
  .sl{margin:0}
  .sl-head{display:flex;align-items:center;gap:8px;margin:0 0 8px}
  .sl-head small{color:var(--muted);font-size:13px;flex:1}
  .sl-shoot{background:var(--orange);color:#151515;border:0;border-radius:var(--r);font-family:var(--display),sans-serif;font-weight:900;font-size:13px;padding:8px 12px;cursor:pointer}
  .sl-row{display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid var(--line)}
  .sl-row:first-of-type{border-top:0}
  .sl-tick{width:26px;height:26px;flex:0 0 26px;border:1.5px solid var(--line);border-radius:6px;background:transparent;color:transparent;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer}
  .sl-row.done .sl-tick{background:var(--green,#5BBE6A);border-color:var(--green,#5BBE6A);color:#151515}
  .sl-tick svg{width:15px;height:15px}
  .sl-th{width:54px;height:66px;flex:0 0 54px;border-radius:5px;overflow:hidden;border:1px solid var(--line);background:var(--surface-1,#1F1C17);padding:0;cursor:pointer;color:var(--dim);font-size:20px;position:relative}
  .sl-th.none{border-style:dashed}
  .sl-th img,.sl-th video{width:100%;height:100%;object-fit:cover;display:block}
  .sl-th i{font-style:normal;font-size:10px;line-height:1.2;padding:2px;display:block}
  .sl-tx{flex:1;min-width:0;text-align:left;background:none;border:0;color:var(--cream);padding:2px 0;cursor:pointer;font:inherit}
  .sl-tx b{display:block;font-weight:600;font-size:15px;line-height:1.3}
  .sl-row.done .sl-tx b{color:var(--muted);text-decoration:line-through;text-decoration-color:var(--dim)}
  .sl-tx small{display:block;color:var(--dim);font-size:12.5px;margin-top:2px}
  .sl-n{font-family:var(--display),sans-serif;font-weight:900;color:var(--orange);font-size:12px;margin-right:4px}
  .sl-foot{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 0}
  .sl-foot button{flex:1 1 140px}
  .sl-empty{color:var(--muted);font-size:14.5px;margin:0 0 4px}
  .sl-strip{display:flex;gap:4px;margin:8px 0 0;overflow:hidden}
  .sl-strip span{width:34px;height:42px;flex:0 0 34px;border-radius:3px;overflow:hidden;background:var(--surface-1,#1F1C17);border:1px solid var(--line)}
  .sl-strip img,.sl-strip video{width:100%;height:100%;object-fit:cover;display:block}
  .shotline .sl-mini{width:28px;height:34px;flex:0 0 28px;border-radius:3px;overflow:hidden;background:var(--surface-1,#1F1C17);border:1px solid var(--line);margin-right:2px}
  .sl-mini img,.sl-mini video{width:100%;height:100%;object-fit:cover;display:block}
  .sl-mini i{display:none}
  .sl-strip em{font-style:normal;color:var(--dim);font-size:12px;align-self:center;margin-left:2px}`;
  function css(){
    if(document.getElementById('sl-css')) return;
    const st = document.createElement('style'); st.id = 'sl-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

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

  /* ------------------------------------------------------------ the list */
  function mount(host, o){
    css();
    host.classList.add('sl');
    const get = () => norm(o.get());
    async function put(list){ await o.save(list); draw(); }

    function draw(){
      const list = get();
      const done = list.filter(s => s.done).length;
      const nf = list.filter(s => s.item).length;
      host.innerHTML = `
        <div class="sl-head"><small>${list.length ? `${done} of ${list.length} taken${nf ? ` · ${nf} with frames` : ''}` : ''}</small>
          ${list.length ? '<button class="sl-shoot" data-sl="shoot">▶ Shoot</button>' : ''}</div>
        ${list.length ? list.map((s, i) => `
          <div class="sl-row${s.done ? ' done' : ''}" data-i="${i}">
            <button class="sl-tick" data-sl="tick" aria-label="Taken">${TICK}</button>
            <button class="sl-th${s.item ? '' : ' none'}" data-sl="pic" ${s.item ? `data-slpic="${esc(s.item)}"` : ''}
              title="${s.item ? 'Tap: shoot from here · Hold: swap the frame' : 'Give it a frame'}" aria-label="Shot ${i + 1} frame">${s.item ? '' : '＋'}</button>
            <button class="sl-tx" data-sl="edit"><b><span class="sl-n">${i + 1}</span>${esc(s.text || 'Shot')}</b>
              ${[s.framing, s.movement, s.note].filter(Boolean).length ? `<small>${esc([s.framing, s.movement, s.note].filter(Boolean).join(' · '))}</small>` : ''}</button>
          </div>`).join('')
        : `<p class="sl-empty">${esc(o.empty || 'No shots yet.')}</p>`}
        <div class="sl-foot">
          <button class="btn-ghost" data-sl="add">＋ Add a shot</button>
          <button class="btn-ghost" data-sl="tpl">＋ From a template</button>
          ${onLaptop() && global.LibView ? '<button class="btn-ghost" data-sl="lib">＋ Frames from the Library</button>' : ''}
        </div>`;
      host.querySelectorAll('[data-sl="pic"]').forEach(b => U.onHold(b, () => swap(+b.closest('[data-i]').dataset.i)));
      fillPics(host);
    }

    async function swap(i){
      const list = get();
      const s = list[i];
      if(!s) return;
      const u = await pickFrame(`Shot ${i + 1} — ${s.item ? 'swap its frame' : 'pick a frame'}`, s.item);
      if(u == null) return;
      s.item = u || '';
      await put(list);
      if(o.swapNote && s.item) U.toast(o.swapNote);
    }

    function edit(i){
      const list = get();
      const isNew = i == null;
      const s = isNew ? { id:uid(), text:'', note:'', framing:'', movement:'', role:'', item:'', done:false } : list[i];
      App.sheet(`
        <h2>${isNew ? 'New shot' : 'Shot ' + (i + 1)}</h2>
        <div class="field"><label for="sl-t">The shot</label>
          <input id="sl-t" type="text" value="${esc(s.text)}" placeholder="Hands on the bar, sunrise behind"></div>
        <div class="field"><label for="sl-n">Note <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="sl-n" type="text" value="${esc(s.note)}" placeholder="Wait for the light"></div>
        <div class="field"><label>Framing</label><div class="opts" data-group="framing">
          ${FRAMING.map(f => `<button type="button" class="opt" data-v="${f}" aria-pressed="${s.framing === f}">${f}</button>`).join('')}</div></div>
        <div class="field"><label>Movement</label><div class="opts" data-group="movement">
          ${MOVEMENT.map(m => `<button type="button" class="opt" data-v="${m}" aria-pressed="${s.movement === m}">${m}</button>`).join('')}</div></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>${isNew ? 'Add shot' : 'Save'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${isNew ? '' : `<div class="sheetcta" style="margin-top:8px">
          ${i > 0 ? '<button class="btn-ghost" data-up>↑ Earlier</button>' : ''}
          ${i < list.length - 1 ? '<button class="btn-ghost" data-down>↓ Later</button>' : ''}
          <button class="btn-ghost" data-del style="color:var(--red);border-color:rgba(226,86,74,.4)">Delete shot</button></div>`}`, sh => {
        sh.addEventListener('click', async e => {
          const opt = e.target.closest('.opt');
          if(opt){
            const was = opt.getAttribute('aria-pressed') === 'true';
            opt.closest('.opts').querySelectorAll('.opt').forEach(x => x.setAttribute('aria-pressed', 'false'));
            opt.setAttribute('aria-pressed', String(!was));
            return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          const move = e.target.closest('[data-up]') ? -1 : e.target.closest('[data-down]') ? 1 : 0;
          if(move){ const [x] = list.splice(i, 1); list.splice(i + move, 0, x); App.closeSheet(); return put(list); }
          if(e.target.closest('[data-del]')){ list.splice(i, 1); App.closeSheet(); return put(list); }
          if(!e.target.closest('[data-save]')) return;
          const t = sh.querySelector('#sl-t').value.trim();
          if(!t && !s.item) return U.toast('Describe the shot');
          const pick = g => { const x = sh.querySelector(`[data-group="${g}"] .opt[aria-pressed="true"]`); return x ? x.dataset.v : ''; };
          s.text = t; s.note = sh.querySelector('#sl-n').value.trim(); s.framing = pick('framing'); s.movement = pick('movement');
          if(isNew) list.push(s);
          App.closeSheet();
          put(list);
        });
        setTimeout(() => { const f = sh.querySelector('#sl-t'); if(f) f.focus(); }, 180);
      });
    }

    host.addEventListener('click', async e => {
      const b = e.target.closest('[data-sl]');
      if(!b || !host.contains(b)) return;
      const row = b.closest('[data-i]');
      const i = row ? +row.dataset.i : null;
      const k = b.dataset.sl;
      if(k === 'tick'){ const list = get(); list[i].done = !list[i].done; return put(list); }
      if(k === 'edit') return edit(i);
      if(k === 'pic'){ const s = get()[i]; return s && s.item ? shoot(o, i) : swap(i); }
      if(k === 'add') return edit(null);
      if(k === 'shoot') return shoot(o);
      if(k === 'tpl'){
        const r = await fromTemplate();
        if(r && r.shots.length){ await put(get().concat(r.shots)); U.toast(`${r.shots.length} shot${r.shots.length === 1 ? '' : 's'} from “${r.name}”`); }
        return;
      }
      if(k === 'lib'){
        const us = await LibView.pick({ multi:true, title:'Frames from the Library — one shot each' });
        if(!us || !us.length) return;
        let lib = null;
        try { lib = await MediaLib.load(); } catch(err){}
        const add = us.map(u => { const it = lib && MediaLib.find(lib, u);
          return { id:uid(), text:(it && (it.label || MediaLib.title(it))) || 'Shot', note:'', framing:'', movement:'', role:'', item:u, done:false }; });
        return put(get().concat(add));
      }
    });
    draw();
    return { draw };
  }

  /* ------------------------------------------------------------ shoot mode */
  function shoot(o, at){
    const list = () => norm(o.get());
    Screens.push('shoot-run', { at, onChange:o.onShootClose, list:{
      title:o.title || 'Shots',
      shots: async () => list().map((s, i) => ({ i, item:s.item || '', role:s.role || '', text:lineOf(s), note:s.note || '', done:!!s.done })),
      setDone: async (i, v) => { const l = list(); if(l[i]){ l[i].done = v; await o.save(l); } },
      setFrame: async (i, u) => { const l = list(); if(l[i]){ l[i].item = u || ''; await o.save(l); } },
      swapNote:o.swapNote || ''
    } });
  }

  /* a shot list on its own screen — for things edited in a sheet (a series'
     video), where the list's own pickers would close the sheet.
       Screens.push('shots-edit', { title, kicker, get, save, onClose }) */
  if(global.Screens && Screens.register) Screens.register('shots-edit', (el, params) => {
    el.innerHTML = Screens.bar({ kicker:params.kicker || 'Shots', title:params.title || 'Shot list' }) +
      `<div class="view"><p class="hintline" style="margin:0 0 12px">${esc(params.hint || 'Each shot with its frame. Tap a frame to shoot from it, hold it to swap it.')}</p><div id="se-list"></div></div>`;
    mount(el.querySelector('#se-list'), { ...params, onShootClose:() => {} });
    if(params.onClose){
      const mo = new MutationObserver(() => { if(!el.isConnected){ mo.disconnect(); try { params.onClose(); } catch(e){} } });
      mo.observe(document.getElementById('screens') || document.body, { childList:true });
    }
  });

  global.ShotList = { mount, shoot, toTask, putOnDay, daySheet, norm, texts, frames, lineOf, fromTemplate, templates, fromTplShot, pickFrame, stripHTML, thumbHTML, fillPics, css, FRAMING, MOVEMENT };
})(window);
