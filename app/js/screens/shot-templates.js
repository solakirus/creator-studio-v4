/* Templates — Shotline's Templates section inside Creator Studio.

   Reusable shot structures, task lists, looks and notebook pages. The list is
   grouped by kind; an open template has four tabs — Pages, Shots, Tasks, Look —
   and can make a new video, be put on a day, or take the Library's ＋.
   Port of Shotline's ui_videos.rs templates_page and ui_plan.rs editors. */
(function(){
  const esc = s => U.esc(s);   /* shared: util.js */
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const T = () => window.ShotTemplates;

  let openId = null, tab = null;

  async function mount(el, params){
    const embedded = !!(params && params.embedded);
    if(params && params.id){ openId = params.id; tab = null; }
    el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Content', title:'Templates' })) +
      '<div class="view tp-root" id="tpHost"></div>';
    const host = el.querySelector('#tpHost');
    let t = null;
    let saveTimer = null, pending = null;
    const save = (now) => {
      clearTimeout(saveTimer);
      pending = t;
      const go = () => { const rec = pending; pending = null; return rec ? T().save(rec) : null; };
      if(now) return go();
      saveTimer = setTimeout(go, 250);
    };
    /* never reload over an edit that hasn't been written yet */
    const flush = async () => { clearTimeout(saveTimer); if(pending){ const rec = pending; pending = null; await T().save(rec); } };

    async function render(){
      await flush();
      const list = await T().all();
      if(openId && !list.some(x => x.id === openId)) openId = null;
      t = openId ? JSON.parse(JSON.stringify(list.find(x => x.id === openId))) : null;
      if(t && !tab) tab = t.sheets.length ? 'pages' : 'shots';
      host.innerHTML = `
        <div class="pagehead"><h1 class="page-title">Templates</h1><span class="count">${list.length}</span>
          <div class="headacts"><button class="headbtn" data-new>＋ NEW</button></div></div>
        <p class="hintline" style="margin:-8px 0 16px">Reusable shot structures, task lists, looks and notebook pages for your videos and days.</p>
        <div class="tp-split${t ? ' has-open' : ''}">
          <aside class="tp-list">${T().KINDS.map(k => {
            const items = list.filter(x => x.kind === k || (k === 'Task list' && !T().KINDS.includes(x.kind)));
            return items.length ? `<p class="lv-group">${esc(k)}</p>` + items.map(x => `
              <button class="tp-item${t && t.id === x.id ? ' on' : ''}" data-open="${x.id}">
                <span class="tp-sw" style="background:${esc(x.color)}"></span>
                <span class="t"><b>${esc(x.name)}</b>
                  <small>${x.sheets.length ? `${plural(x.sheets.length, 'page')} · ${plural(x.tasks.length, 'task')}` : `${plural(x.shots.length, 'shot')} · ${plural(x.tasks.length, 'task')}`}</small>
                  ${x.description ? `<small class="d">${esc(x.description)}</small>` : ''}</span>
              </button>`).join('') : '';
          }).join('')}
          ${list.length ? '' : '<div class="empty"><b>No templates yet.</b>Templates hold a shot structure, a task list and a look. Use one for a new video, or put it on a day.</div>'}
          </aside>
          <section class="tp-open">${t ? editorHtml(t) : `<div class="empty tp-pick"><b>Pick a template</b>Open one on the left to edit its pages, shots, tasks and look — or make a new one.</div>`}</section>
        </div>`;
      if(t) await mountTab();
    }

    function editorHtml(t){
      return `
        <button class="lv-btn sm ghost tp-back" data-back>← All templates</button>
        <div class="tp-head">
          <input type="color" data-color value="${esc(String(t.color).toLowerCase())}" title="Colour">
          <input class="tp-name" data-tname value="${esc(t.name)}">
        </div>
        <div class="lv-row">
          <select class="lv-sel" data-kind>${T().KINDS.map(k => `<option ${t.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
          <select class="lv-sel" data-format>${Object.entries(T().FORMATS).map(([k, v]) => `<option value="${k}" ${t.format === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
        </div>
        <input class="lv-in" data-desc value="${esc(t.description)}" placeholder="What this template is for" style="width:100%;margin:8px 0">
        <div class="lv-row tp-acts">
          <button class="lv-btn" data-tvideo>＋ New video from this</button>
          <button class="lv-btn ghost" data-tday>Put on a day…</button>
          <button class="pill sm" data-useadd aria-pressed="false" title="Frames you add with ＋ in the Library land in this template's shots">Use as Library “＋ adds to”</button>
          <button class="lv-btn ghost sm" data-tdup>Duplicate</button>
          <button class="lv-btn ghost sm danger" data-deltpl>Delete</button>
        </div>
        <div class="segrow tp-tabs" role="tablist">${[['pages', 'Pages'], ['shots', 'Shots'], ['tasks', 'Tasks'], ['look', 'Look']].map(([k, l]) =>
          `<button class="seg" data-tab="${k}" aria-selected="${tab === k}">${l}${k === 'pages' && t.sheets.length ? ` <span class="n">${t.sheets.length}</span>` : ''}${
            k === 'shots' && t.shots.length ? ` <span class="n">${t.shots.length}</span>` : ''}${k === 'tasks' && t.tasks.length ? ` <span class="n">${t.tasks.length}</span>` : ''}</button>`).join('')}</div>
        <div id="tpTab"></div>`;
    }

    async function mountTab(){
      const box = host.querySelector('#tpTab');
      const tg = await MediaLib.target();
      const ua = host.querySelector('[data-useadd]');
      if(ua && tg && tg.tid === t.id && tg.kind === 'shots'){ ua.setAttribute('aria-pressed', 'true'); ua.textContent = '✔ Library ＋ adds here'; }
      if(tab === 'pages'){
        const inner = document.createElement('div');
        box.appendChild(inner);
        PagesEditor.mount(inner, { sheets:t.sheets, tasks:t.tasks.map(x => x.title), tid:t.id, save:() => save() });
        return;
      }
      if(tab === 'tasks') return tasksTab(box);
      if(tab === 'look') return lookTab(box);
      return shotsTab(box);
    }

    /* ---------------------------------------------------------- Shots (ui_plan.rs storyboard) */
    async function shotsTab(box){
      const lib = await MediaLib.load();
      const roles = t.shots.map(s => s.role);
      const miss = Notebook.missingRoles(roles);
      const per = T().FORMATS[t.format] ? T().FORMATS[t.format].shot : 4;
      let start = 0;
      const sel = (cls, list, v, ph) => `<select class="lv-sel ${cls}">${ph ? `<option value="">${ph}</option>` : ''}${list.map(x => `<option ${v === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
      box.innerHTML = `
        <p class="hintline" style="margin:0 0 8px">Shots with a frame bring that frame along; empty ones are slots to fill when you use the template.</p>
        ${t.shots.length ? `<p class="hintline" style="margin:0 0 12px">${esc(Notebook.roleLine(roles))}${miss.length ? ` <span style="color:var(--red)">· missing: ${esc(miss.join(', ').toLowerCase())}</span>` : ''}
          · total ${Notebook.fmtTime(T().totalSeconds(t))}</p>` : ''}
        <div class="tp-shots">${t.shots.map((s, i) => {
          const s0 = start; start += Math.max(0, s.seconds || 0);
          const spec = [s.size, s.movement].filter(x => x && x !== '—').join(' · ');
          const it = s.item ? MediaLib.find(lib, s.item) : null;
          return `<article class="tp-shot" draggable="true" data-i="${i}">
            <div class="tp-shead"><b>${String(i + 1).padStart(2, '0')}</b><span class="sp">${esc(spec.toUpperCase())}</span>
              <small>${Notebook.fmtTime(s0)} · ${Notebook.fmtTime(s.seconds || per)}</small></div>
            <div class="tp-frame${s.item ? '' : ' empty'}" data-frame="${i}">
              ${s.sequence ? `<div class="tp-mosaic">${s.sequence.slots.slice(0, 9).map(x => x.item ? LibView.tile(MediaLib.find(lib, x.item), { badge:false }) : '<div class="lv-tile lv-blank"></div>').join('')}</div>`
                : s.item ? LibView.tile(it, { badge:false }) : ''}
              <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
              ${s.role ? `<span class="tp-role">${esc(s.role.toUpperCase())}</span>` : ''}
              <span class="tp-hint">${s.sequence ? 'Open the task sequence' : s.item ? 'Click to view · right-click to change' : 'Pick a frame from the Library'}</span>
            </div>
            <div class="lv-row"><span class="tp-drag" title="Drag to reorder">⠿</span>
              ${sel('w-role', T().ROLES, s.role).replace('class="lv-sel w-role"', `class="lv-sel w-role" data-s="role" data-i="${i}"`)}
              <select class="lv-sel" data-s="seconds" data-i="${i}">${T().DURATIONS.map(d => `<option value="${d}" ${+s.seconds === d ? 'selected' : ''}>${Notebook.fmtTime(d)}</option>`).join('')}
                ${s.seconds && !T().DURATIONS.includes(+s.seconds) ? `<option value="${s.seconds}" selected>${Notebook.fmtTime(s.seconds)}</option>` : ''}${!s.seconds ? '<option value="0" selected>—</option>' : ''}</select>
              <label class="tp-done" title="Filmed / done"><input type="checkbox" data-s="done" data-i="${i}" ${s.done ? 'checked' : ''}></label></div>
            <input class="lv-in" data-s="label" data-i="${i}" value="${esc(s.label)}" placeholder="${esc(s.name || 'What happens in this shot')}">
            <div class="lv-row">${sel('', ShotTemplates.SIZES, s.size || '—').replace('<select class="lv-sel ">', `<select class="lv-sel" data-s="size" data-i="${i}" title="Shot type">`)}
              ${sel('', ShotTemplates.MOVES, s.movement || '—').replace('<select class="lv-sel ">', `<select class="lv-sel" data-s="movement" data-i="${i}" title="Move">`)}</div>
            <div class="lv-row"><span class="tp-then">THEN</span>${sel('', ShotTemplates.TRANSITIONS, s.transition || 'Cut').replace('<select class="lv-sel ">', `<select class="lv-sel" data-s="transition" data-i="${i}">`)}</div>
            <div class="lv-row">${s.sequence
              ? `<button class="lv-btn sm" data-seq="${i}">▦ ${s.sequence.slots.filter(x => x.item).length}/${s.sequence.slots.length} Open sequence</button>
                 <button class="lv-btn sm ghost" data-unseq="${i}" title="Back to one picture (the sequence is removed)">✕</button>`
              : `<button class="lv-btn sm ghost" data-mkseq="${i}" title="Hold several shots / subtasks in this one">▦ Task sequence</button>`}
              ${s.music ? `<button class="lv-btn sm ghost" data-smplay="${i}">♪ ▶</button><span class="tp-music">${esc(s.music_name || Notebook.musicName(s))}</span>
                <button class="lv-btn sm ghost" data-smoff="${i}" title="Take the music off">✕</button>`
              : `<button class="lv-btn sm ghost" data-smadd="${i}" title="Attach the track for this shot">♪ Add music</button>`}</div>
            ${s.music ? `<input class="lv-in" data-s="music_note" data-i="${i}" value="${esc(s.music_note)}" placeholder="Note: “the drop on the cut”">` : ''}
            <textarea class="lv-in lv-ta" data-s="notes" data-i="${i}" rows="2" placeholder="Notes: lens, audio, line…">${esc(s.notes)}</textarea>
            <div class="lv-row tp-sfoot"><small>${esc(s.page || '')}</small>
              ${i > 0 ? `<button class="lv-btn sm ghost" data-mvs="${i}" data-d="-1" title="Earlier">←</button>` : ''}
              ${i + 1 < t.shots.length ? `<button class="lv-btn sm ghost" data-mvs="${i}" data-d="1" title="Later">→</button>` : ''}
              <button class="lv-btn sm ghost" data-dups="${i}" title="Duplicate">⧉</button>
              <button class="lv-btn sm ghost" data-rms="${i}" title="Remove">✕</button></div>
          </article>`; }).join('')}
          <button class="tp-addcard" data-addframes><b>＋</b><span>Add frames from the Library</span></button>
        </div>
        <div class="lv-row" style="margin-top:12px"><button class="lv-btn ghost" data-emptyshot title="Plan a shot you still have to film">＋ Empty shot</button>
          <input type="file" data-smfile accept="audio/*,.mp3,.m4a,.wav,.ogg" hidden></div>`;
      LibView.hydrate(box, lib);
      let musicFor = -1;
      box.addEventListener('click', async e => {
        const g = e.target;
        const fr = g.closest('[data-frame]');
        if(fr){
          const s = t.shots[+fr.dataset.frame];
          if(s.sequence) return openSequence(+fr.dataset.frame);
          if(!s.item) return pickFor(+fr.dataset.frame);
          return LibView.view(s.item);
        }
        if(g.closest('[data-addframes]')){
          const uids = await LibView.pick({ multi:true });
          if(!uids.length) return;
          for(const u of uids){ const it = MediaLib.find(lib, u); if(it) t.shots.push(await T().shotFromItem(lib, it)); }
          await save(true); return render();
        }
        if(g.closest('[data-emptyshot]')){ t.shots.push(T().shot({ size:'Wide', movement:'Static', role:'Action', seconds:per })); await save(true); return render(); }
        const mv = g.closest('[data-mvs]');
        if(mv){ const i = +mv.dataset.mvs, j = i + +mv.dataset.d; [t.shots[i], t.shots[j]] = [t.shots[j], t.shots[i]]; await save(true); return render(); }
        const dp = g.closest('[data-dups]');
        if(dp){ const i = +dp.dataset.dups; t.shots.splice(i + 1, 0, T().copyShot(t.shots[i])); await save(true); return render(); }
        const rm = g.closest('[data-rms]');
        if(rm){ t.shots.splice(+rm.dataset.rms, 1); await save(true); return render(); }
        const mk = g.closest('[data-mkseq]');
        if(mk){
          const i = +mk.dataset.mkseq, s = t.shots[i];
          const q = Notebook.copyNew(Notebook.stepsPage(s.label || s.role || 'Task'));
          if(s.item) q.slots[0].item = s.item;
          s.sequence = q; await save(true); return openSequence(i);
        }
        const sq = g.closest('[data-seq]');
        if(sq) return openSequence(+sq.dataset.seq);
        const us = g.closest('[data-unseq]');
        if(us){ t.shots[+us.dataset.unseq].sequence = null; await save(true); return render(); }
        const ma = g.closest('[data-smadd]');
        if(ma){ musicFor = +ma.dataset.smadd; return box.querySelector('[data-smfile]').click(); }
        const mo = g.closest('[data-smoff]');
        if(mo){ const s = t.shots[+mo.dataset.smoff]; s.music = ''; s.music_name = ''; await save(true); return render(); }
        const mp = g.closest('[data-smplay]');
        if(mp){ const a = await Notebook.playerFor(t.shots[+mp.dataset.smplay]); if(a){ a.paused ? a.play() : a.pause(); } }
      });
      box.addEventListener('contextmenu', e => {
        const fr = e.target.closest('[data-frame]');
        if(fr){ e.preventDefault(); pickFor(+fr.dataset.frame); }
      });
      box.addEventListener('change', async e => {
        const g = e.target;
        if(g.matches('[data-smfile]')){
          const f = g.files && g.files[0];
          if(f && musicFor >= 0){ await Notebook.attachMusic(t.shots[musicFor], f); await save(true); render(); }
          return;
        }
        if(!g.dataset.s) return;
        const s = t.shots[+g.dataset.i];
        s[g.dataset.s] = g.type === 'checkbox' ? g.checked : g.dataset.s === 'seconds' ? +g.value : g.value;
        save();
        if(['role', 'size', 'movement', 'seconds'].includes(g.dataset.s)) { await save(true); render(); }
      });
      /* drag ⠿ to reorder */
      let from = -1;
      box.addEventListener('dragstart', e => { const c = e.target.closest('.tp-shot'); if(c){ from = +c.dataset.i; e.dataTransfer.effectAllowed = 'move'; } });
      box.addEventListener('dragover', e => { const c = e.target.closest('.tp-shot'); if(c && from >= 0){ e.preventDefault(); box.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); c.classList.add('drop'); } });
      box.addEventListener('drop', async e => {
        const c = e.target.closest('.tp-shot');
        if(!c || from < 0) return;
        e.preventDefault();
        const to = +c.dataset.i;
        const [s] = t.shots.splice(from, 1);
        t.shots.splice(to, 0, s);
        from = -1;
        await save(true); render();
      });
    }

    async function pickFor(i){
      const u = await LibView.pick({ title:'Pick a frame for shot ' + (i + 1) });
      if(!u) return;
      t.shots[i] = await T().fillShot(t.shots[i], u);
      await save(true); render();
    }

    function openSequence(i){
      Screens.push('tpl-sequence', { tid:t.id, shotId:t.shots[i].id, onChange:() => render() });
    }

    /* ---------------------------------------------------------- Tasks */
    function tasksTab(box){
      box.innerHTML = `${t.tasks.map((x, i) => `<div class="lv-row tp-task">
          <input type="checkbox" data-tdone="${i}" ${x.done ? 'checked' : ''}>
          <input class="lv-in${x.done ? ' done' : ''}" data-ttitle="${i}" value="${esc(x.title)}">
          ${i > 0 ? `<button class="lv-btn sm ghost" data-tmv="${i}" data-d="-1">↑</button>` : ''}
          ${i + 1 < t.tasks.length ? `<button class="lv-btn sm ghost" data-tmv="${i}" data-d="1">↓</button>` : ''}
          <button class="lv-btn sm ghost" data-trm="${i}">✕</button></div>`).join('')}
        <div class="lv-row tp-task"><input class="lv-in" data-tnew placeholder="Add a task and press Enter" style="flex:1">
          <button class="lv-btn sm" data-tadd>Add</button></div>
        <p class="hintline">Put on a day, each task becomes a task on that date.</p>`;
      const add = async () => {
        const inp = box.querySelector('[data-tnew]');
        const v = inp.value.trim();
        if(!v) return;
        t.tasks.push({ id:Math.random().toString(36).slice(2, 10), title:v, done:false });
        await save(true);
        tasksTab(box);
        box.querySelector('[data-tnew]').focus();
      };
      box.onclick = async e => {
        if(e.target.closest('[data-tadd]')) return add();
        const mv = e.target.closest('[data-tmv]');
        if(mv){ const i = +mv.dataset.tmv, j = i + +mv.dataset.d; [t.tasks[i], t.tasks[j]] = [t.tasks[j], t.tasks[i]]; await save(true); return tasksTab(box); }
        const rm = e.target.closest('[data-trm]');
        if(rm){ t.tasks.splice(+rm.dataset.trm, 1); await save(true); return tasksTab(box); }
      };
      box.onkeydown = e => { if(e.key === 'Enter' && e.target.matches('[data-tnew]')){ e.preventDefault(); add(); } };
      box.onchange = e => {
        const d = e.target.closest('[data-tdone]');
        if(d){ t.tasks[+d.dataset.tdone].done = d.checked; save(); return tasksTab(box); }
        const ti = e.target.closest('[data-ttitle]');
        if(ti){ t.tasks[+ti.dataset.ttitle].title = ti.value; save(); }
      };
    }

    /* ---------------------------------------------------------- Look (ui_plan.rs look_editor) */
    async function lookTab(box){
      const lib = await MediaLib.load();
      const l = t.look;
      const row = (k, label, hint) => `<label class="lv-lab">${label}<input class="lv-in" data-l="${k}" value="${esc(l[k])}" placeholder="${hint}"></label>`;
      box.innerHTML = `
        <label class="tp-check"><input type="checkbox" data-uselook ${t.use_look ? 'checked' : ''}> Videos made from this template take this look</label>
        <p class="lv-group">Palette</p>
        <div class="lv-row tp-pal">${l.palette.map((c, i) => `<input type="color" data-pal="${i}" value="${esc(String(c).toLowerCase())}" title="Right-click to remove">`).join('')}
          ${l.palette.length < 8 ? '<button class="lv-btn sm ghost" data-paladd title="Add a colour (right-click a colour to remove it)">＋</button>' : ''}</div>
        <div class="tp-lookgrid">
          ${row('mood', 'Mood', 'e.g. warm, calm, a bit cinematic')}
          ${row('grade', 'Colour grade', 'e.g. soft contrast, warm highlights, teal shadows')}
          ${row('music', 'Music', 'e.g. lo-fi, acoustic, one upbeat montage track')}
          ${row('transitions', 'Transitions', 'e.g. whip pans between days')}
          ${row('titles', 'Titles + text', 'e.g. small lowercase titles, bottom left')}
        </div>
        <label class="lv-lab">Reference link<div class="lv-row"><input class="lv-in" data-l="reference" value="${esc(l.reference)}" placeholder="Instagram / YouTube / any page" style="flex:1">
          <button class="lv-btn sm ghost" data-ref ${/^https?:/.test(l.reference) ? '' : 'disabled'}>Open ↗</button>
          ${MediaLib.disk() ? `<button class="lv-btn sm ghost" data-grabref ${/^https?:/.test(l.reference) ? '' : 'disabled'} title="Adds the link to Grab media">Grab into Library</button>` : ''}</div></label>
        <p class="lv-group">Reference frames</p>
        <div class="tp-refs">${l.refs.map((u, i) => `<div class="tp-ref">${LibView.tile(MediaLib.find(lib, u), { badge:false })}
          <button class="lv-btn sm ghost" data-unref="${i}" title="Remove from the look">✕</button></div>`).join('')}
          <button class="tp-addcard sm" data-addref><b>＋</b><span>frames</span></button>
          <button class="pill sm" data-reftarget>Make Library ＋ add here</button></div>`;
      LibView.hydrate(box, lib);
      box.onclick = async e => {
        const g = e.target;
        if(g.closest('[data-paladd]')){ l.palette.push('#C8C8D2'); await save(true); return lookTab(box); }
        if(g.closest('[data-ref]')) return window.open(l.reference, '_blank');
        if(g.closest('[data-grabref]')){
          const s = await MediaLib.settings();
          if(!(s.links || '').includes(l.reference)) await MediaLib.setSettings({ links:((s.links || '').trim() + '\n' + l.reference).trim() + '\n' });
          return U.toast('Added to the links list in Library → Add & grab');
        }
        const ur = g.closest('[data-unref]');
        if(ur){ l.refs.splice(+ur.dataset.unref, 1); await save(true); return lookTab(box); }
        if(g.closest('[data-addref]')){
          const uids = await LibView.pick({ multi:true, title:'Frames that show the look' });
          uids.forEach(u => { if(!l.refs.includes(u)) l.refs.push(u); });
          await save(true); return lookTab(box);
        }
        if(g.closest('[data-reftarget]')){ await MediaLib.setTarget({ kind:'look', tid:t.id, label:'🎨 Look of ' + t.name }); return U.toast('The Library’s ＋ now adds to this look'); }
        const tl = g.closest('.lv-tile[data-uid]');
        if(tl) LibView.view(tl.dataset.uid);
      };
      box.oncontextmenu = async e => {
        const p = e.target.closest('[data-pal]');
        if(p){ e.preventDefault(); l.palette.splice(+p.dataset.pal, 1); await save(true); lookTab(box); }
      };
      box.onchange = e => {
        const g = e.target;
        if(g.matches('[data-uselook]')) t.use_look = g.checked;
        else if(g.matches('[data-pal]')) l.palette[+g.dataset.pal] = g.value.toUpperCase();
        else if(g.matches('[data-l]')) l[g.dataset.l] = g.value;
        else return;
        save();
      };
    }

    /* ---------------------------------------------------------- the frame around it */
    function dayDialog(){
      U.dayField('tp-day', null).then(field => {
        App.sheet(`<h2 style="margin:0 0 6px">Put “${esc(t.name)}” on a day</h2>
          <p class="hintline" style="margin:0 0 12px">Its tasks become tasks on that date, and its shots become the steps of one shoot task.</p>
          ${field}
          <div class="sheetcta"><button class="btn-primary" data-yes>Put it on</button><button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
          U.wireDayField(sh, 'tp-day');
          sh.addEventListener('click', async e => {
            if(e.target.closest('[data-no]')) return App.closeSheet();
            if(!e.target.closest('[data-yes]')) return;
            const v = sh.querySelector('#tp-day').value;
            const ts = new Date(v + 'T09:00').getTime();
            if(isNaN(ts)) return U.toast('Pick a date');
            const n = await T().putOnDay(t.id, ts);
            App.closeSheet();
            U.toast(`Put on ${new Date(ts).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })} · ${plural(n, 'task')}`);
          });
        });
      });
    }

    host.addEventListener('click', async e => {
      const g = e.target;
      if(g.closest('[data-new]')){
        const n = await T().create({ name:'New template', kind:'Vlog day', format:'Long', color:'#D8432A' });
        openId = n.id; tab = 'shots'; return render();
      }
      const op = g.closest('[data-open]');
      if(op){ openId = op.dataset.open; tab = null; return render(); }
      if(g.closest('[data-back]')){ openId = null; return render(); }
      const tb = g.closest('[data-tab]');
      if(tb && host.contains(tb) && tb.closest('.tp-tabs')){ tab = tb.dataset.tab; return render(); }
      if(!t) return;
      if(g.closest('[data-tvideo]')){
        await save(true);
        const v = await T().newVideo(t.id);
        if(!v) return U.toast('Videos are not available');
        App.sheet(`<h2 style="margin:0 0 8px">Video made</h2><p class="hintline">“${esc(v.title)}” is in Videos with ${plural((v.shots || []).length, 'shot')}${t.use_look ? ', the look' : ''} and the tasks in its notes.</p>
          <div class="sheetcta"><button class="btn-primary" data-go>Open Videos</button><button class="btn-ghost" data-no>Stay here</button></div>`, sh => sh.addEventListener('click', ev => {
            if(ev.target.closest('[data-no]')) return App.closeSheet();
            if(ev.target.closest('[data-go]')){ App.closeSheet(); Screens.push('videos'); }
          }));
        return;
      }
      if(g.closest('[data-tday]')){ await save(true); return dayDialog(); }
      if(g.closest('[data-useadd]')){
        const tg = await MediaLib.target();
        if(tg && tg.tid === t.id && tg.kind === 'shots') await MediaLib.setTarget(null);
        else await MediaLib.setTarget({ kind:'shots', tid:t.id, label:'▦ ' + t.name });
        return render();
      }
      if(g.closest('[data-tdup]')){ await save(true); const c = await T().duplicate(t.id); openId = c.id; return render(); }
      if(g.closest('[data-deltpl]')){
        App.sheet(`<h2 style="margin:0 0 10px">Delete “${esc(t.name)}”?</h2><p class="hintline">Your library files aren’t touched.</p>
          <div class="sheetcta"><button class="btn-primary" data-yes style="background:var(--red)">Delete</button><button class="btn-ghost" data-no>Cancel</button></div>`, sh =>
          sh.addEventListener('click', async ev => {
            if(ev.target.closest('[data-no]')) return App.closeSheet();
            if(!ev.target.closest('[data-yes]')) return;
            await T().remove(t.id); openId = null; App.closeSheet(); render();
          }));
      }
    });
    host.addEventListener('change', async e => {
      if(!t) return;
      const g = e.target;
      if(g.matches('[data-tname]')) t.name = g.value.trim() || 'Template';
      else if(g.matches('[data-color]')) t.color = g.value.toUpperCase();
      else if(g.matches('[data-kind]')) t.kind = g.value;
      else if(g.matches('[data-format]')) t.format = g.value;
      else if(g.matches('[data-desc]')) t.description = g.value;
      else return;
      await save(true);
      const list = host.querySelector('.tp-list');
      if(list){ const keep = list.scrollTop; await render(); const l2 = host.querySelector('.tp-list'); if(l2) l2.scrollTop = keep; }
    });

    await render();
  }

  /* A shot's task sequence, as its own page (Shotline: clicking the mosaic opens it) */
  async function mountSequence(el, params){
    const t = await ShotTemplates.get(params.tid);
    const s = t && t.shots.find(x => x.id === params.shotId);
    if(!s || !s.sequence){ el.innerHTML = Screens.bar({ title:'Task sequence' }) + '<div class="view"><div class="empty"><b>Gone</b>That sequence was removed.</div></div>'; return; }
    el.innerHTML = Screens.bar({ kicker:t.name, title:s.label || 'Task sequence' }) + '<div class="view tp-root"><div id="seqHost"></div></div>';
    const sheets = [s.sequence];
    PagesEditor.mount(el.querySelector('#seqHost'), { sheets, single:true, tid:t.id, tasks:[], save:async () => {
      const fresh = await ShotTemplates.get(params.tid);
      const sh = fresh && fresh.shots.find(x => x.id === params.shotId);
      if(!sh) return;
      sh.sequence = sheets[0];
      await ShotTemplates.save(fresh);
      if(params.onChange && window.Data && Data.invalidate) Data.invalidate();
    } });
  }

  Screens.register('shot-templates', mount);
  Screens.register('tpl-sequence', mountSequence);
})();
