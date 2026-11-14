/* v4: ShotBoard (the "Storyboard" view) — the Templates' shot cards, for a real video's shots.

   Planning a day's sequence reads best as the Templates' Shots tab: a frame
   per shot, its role and length, shot type and move, THEN (how it cuts to the
   next one), notes, and a task sequence of up to nine more shots inside it.
   Until now that layout only existed on a template; an episode's sequence, a
   clip or a series video showed its shots as Steps beside a shot page.

   ShotBoard.mount(box, boardAdapter) shows the same shots that way.
   The adapter is ShotList.board(key) — 'clip:<id>', 'video:<id>' or
   'beat:<vlogId>:<beatId>' — which edits the record's own shot list, so the
   Steps, the Shoot tab, shoot mode and the Edit cut list all see the change.
   THEN is the shot's `tr`: a plain one (Dissolve, J-cut…) or one of your
   Eyecandy transitions (transitions.js), which the Edit tab can play.

   ShotBoard.switchHTML(view) / view() / setView(v): the Steps | Storyboard
   switch, remembered on this device. */
(function(global){
  const esc = s => U.esc(s);
  const VIEW_KEY = 'cs4-shots-view';
  const view = () => { try { return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'steps'; } catch(e){ return 'steps'; } };
  const setView = v => { try { localStorage.setItem(VIEW_KEY, v); } catch(e){} };
  const switchHTML = v => `<div class="sb-switch" role="tablist" aria-label="How the shots are shown">
      <button role="tab" data-sbv="steps" aria-selected="${v !== 'board'}">Steps</button>
      <button role="tab" data-sbv="board" aria-selected="${v === 'board'}">Storyboard</button></div>`;

  const T = () => global.ShotTemplates || { ROLES:['Action', 'Insert', 'B-roll', 'Talking', 'Reaction', 'Transition'],
    SIZES:['—', 'Wide', 'Medium', 'Close-up'], MOVES:['—', 'Static', 'Handheld', 'Pan'], TRANSITIONS:['Cut', 'Dissolve'], DURATIONS:[1, 2, 3, 5, 10] };
  const fmt = s => global.Notebook && Notebook.fmtTime ? Notebook.fmtTime(s) : Math.round(s) + ' s';
  const dash = v => v && v !== '—' ? v : '';
  /* the Library on the laptop (and the iPad reading nastime's); the phone picks from Starred */
  const hasLib = () => !!(global.MediaLib && MediaLib.hasLibrary && MediaLib.hasLibrary() && !(MediaLib.phone && MediaLib.phone()));
  const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  async function mount(box, A, o){
    o = o || {};
    if(!box || !A) return;
    let shots = (await A.load()) || [];
    let tt = 0;
    /* each card shows its frame and words; the rest folds under Details
       (one card at a time, or all of them — remembered on this device) */
    const DET_KEY = 'cs4-sb-details';
    let allOpen = (() => { try { return localStorage.getItem(DET_KEY) === '1'; } catch(e){ return false; } })();
    const opened = new Set();
    const isOpen = s => allOpen || opened.has(s.id);
    const save = async () => { await A.save(shots); shots = (await A.load()) || shots; if(o.onChange) await o.onChange(); };
    const sel = (attr, list, v, title) => `<select class="lv-sel" ${attr} ${title ? `title="${title}"` : ''}>${list.map(x => `<option ${v === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;

    function thenSel(s, i){
      const tr = s.tr;
      const plain = T().TRANSITIONS.filter(x => x !== 'End');
      const cur = tr && tr.id ? 'ec:' + tr.id : tr && tr.n ? tr.n : 'Cut';
      return `<select class="lv-sel" data-then="${i}" title="How it cuts to the next shot">
        ${plain.map(x => `<option value="${esc(x)}" ${cur === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
        ${tr && tr.n && !tr.id && !plain.includes(tr.n) ? `<option value="${esc(tr.n)}" selected>${esc(tr.n)}</option>` : ''}
        ${tr && tr.id ? `<option value="ec:${esc(tr.id)}" selected>⇄ ${esc(tr.n || 'Eyecandy')}</option>` : ''}
        ${global.Transitions ? '<option value="__ec">⇄ From your transitions…</option>' : ''}</select>`;
    }

    function draw(){
      if(!box.isConnected) return;
      const roles = shots.map(s => s.role).filter(Boolean);
      const miss = global.Notebook && Notebook.missingRoles ? Notebook.missingRoles(roles) : [];
      const total = shots.reduce((n, s) => n + (+s.secs || 0), 0);
      let start = 0;
      box.innerHTML = `<div class="sb${o.narrow ? ' narrow' : ''}">
        ${shots.length ? `<p class="hintline sb-sum">${[global.Notebook && Notebook.roleLine && roles.length ? esc(Notebook.roleLine(roles)) : '',
            miss.length ? `<span style="color:var(--red)">missing: ${esc(miss.join(', ').toLowerCase())}</span>` : '', total ? 'total ' + fmt(total) : '',
            `${shots.filter(s => s.done).length} of ${shots.length} filmed`].filter(Boolean).join(' · ')}
          <button class="sb-alldet" data-sballdet aria-pressed="${allOpen}">${allOpen ? 'Hide details' : 'Show all details'}</button></p>` : ''}
        <div class="tp-shots">${shots.map((s, i) => {
          const s0 = start; start += Math.max(0, +s.secs || 0);
          const spec = [dash(s.framing), dash(s.movement)].filter(Boolean).join(' · ');
          const nseq = s.seq && s.seq.slots ? s.seq.slots.length : 0;
          return `<article class="tp-shot${s.done ? ' sb-done' : ''}" draggable="true" data-i="${i}">
            <div class="tp-shead"><b>${String(i + 1).padStart(2, '0')}</b><span class="sp">${esc(spec.toUpperCase())}</span>
              <small>${s.secs ? fmt(s0) + ' · ' + fmt(s.secs) : ''}</small></div>
            <div class="tp-frame${s.item ? '' : ' empty'}" data-sbframe="${i}">
              ${s.item ? `<span class="sb-pic" data-slpic="${esc(s.item)}"></span>` : ''}
              <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
              ${s.role ? `<span class="tp-role">${esc(s.role.toUpperCase())}</span>` : ''}
              <span class="tp-hint">${s.item ? '↻ to change · ✕ to take off' : hasLib() ? 'Pick a frame from the Library' : 'Pick a starred frame'}</span>
              ${s.item ? `<span class="tp-facts"><button class="tp-fbtn" data-sbpick="${i}" title="Pick another frame" aria-label="Pick another frame">↻</button>
                <button class="tp-fbtn" data-sbclear="${i}" title="Take the frame off this shot" aria-label="Take the frame off this shot">✕</button></span>` : ''}
            </div>
            <input class="lv-in" data-sbf="text" data-i="${i}" value="${esc(s.text || '')}" placeholder="What happens in this shot">
            ${!isOpen(s) ? `<div class="sb-fold"><label class="tp-done" title="Filmed"><input type="checkbox" data-sbf="done" data-i="${i}" ${s.done ? 'checked' : ''}></label>
              <span class="sb-facts">${[s.role, s.secs ? fmt(s.secs) : '', s.tr && (s.tr.n || s.tr.id) && i < shots.length - 1 ? '⇄ ' + (s.tr.n || 'Transition') : '',
                nseq ? `▦ ${nseq}` : '', s.note ? '✎' : ''].filter(Boolean).map(esc).join(' · ') || '<i>Nothing set yet</i>'}</span>
              ${nseq && A.host ? `<button class="lv-btn sm ghost" data-sbshoot="${i}" title="Shoot mode from this shot">▶</button>` : ''}
              <button class="lv-btn sm ghost" data-sbmore="${esc(s.id)}" aria-expanded="false">Details ⌄</button></div>` : `
            <div class="sb-more">
            <div class="lv-row"><span class="tp-drag" title="Drag to reorder">⠿</span>
              ${sel(`data-sbf="role" data-i="${i}"`, [''].concat(T().ROLES), s.role || '').replace('<option >', '<option value="">').replace(/<option( selected)?><\/option>/, `<option value=""$1>Role</option>`)}
              <select class="lv-sel" data-sbf="secs" data-i="${i}" title="How long it runs">${!s.secs ? '<option value="0" selected>—</option>' : ''}${T().DURATIONS.map(d => `<option value="${d}" ${+s.secs === d ? 'selected' : ''}>${fmt(d)}</option>`).join('')}
                ${s.secs && !T().DURATIONS.includes(+s.secs) ? `<option value="${s.secs}" selected>${fmt(s.secs)}</option>` : ''}</select>
              <label class="tp-done" title="Filmed"><input type="checkbox" data-sbf="done" data-i="${i}" ${s.done ? 'checked' : ''}></label></div>
            <div class="lv-row">${sel(`data-sbf="framing" data-i="${i}"`, T().SIZES, s.framing || '—', 'Shot type')}
              ${sel(`data-sbf="movement" data-i="${i}"`, T().MOVES, s.movement || '—', 'Move')}</div>
            ${i < shots.length - 1 ? `<div class="lv-row"><span class="tp-then">THEN</span>${thenSel(s, i)}</div>` : ''}
            ${global.PagesEditor && hasLib() ? `<div class="lv-row">${nseq
              ? `<button class="lv-btn sm" data-sbseq="${i}">▦ ${s.seq.slots.filter(x => x.item).length}/${nseq} Open sequence</button>
                 ${A.host ? `<button class="lv-btn sm ghost" data-sbshoot="${i}" title="Shoot mode from this shot: it, then the shots inside it, then the next">▶ Shoot</button>` : ''}
                 <button class="lv-btn sm ghost" data-sbunseq="${i}" title="Back to one picture (the sequence is removed)">✕</button>`
              : `<button class="lv-btn sm ghost" data-sbmkseq="${i}" title="Hold up to nine more shots inside this one">▦ Task sequence</button>`}</div>` : ''}
            <textarea class="lv-in lv-ta" data-sbf="note" data-i="${i}" rows="2" placeholder="Notes: lens, audio, line…">${esc(s.note || '')}</textarea>
            <div class="lv-row tp-sfoot"><small></small>
              ${i > 0 ? `<button class="lv-btn sm ghost" data-sbmv="${i}" data-d="-1" title="Earlier" aria-label="Earlier">←</button>` : ''}
              ${i + 1 < shots.length ? `<button class="lv-btn sm ghost" data-sbmv="${i}" data-d="1" title="Later" aria-label="Later">→</button>` : ''}
              <button class="lv-btn sm ghost" data-sbdup="${i}" title="Duplicate" aria-label="Duplicate">⧉</button>
              <button class="lv-btn sm ghost" data-sbrm="${i}" title="Remove" aria-label="Remove">✕</button>
              ${allOpen ? '' : `<button class="lv-btn sm ghost" data-sbmore="${esc(s.id)}" aria-expanded="true">Fold ⌃</button>`}</div>
            </div>`}
          </article>`; }).join('')}
          ${hasLib() ? `<button class="tp-addcard" data-sbframes><b>＋</b><span>Add frames from the Library</span></button>` : ''}
        </div>
        <div class="lv-row" style="margin-top:12px"><button class="lv-btn ghost" data-sbempty title="Plan a shot you still have to film">＋ Empty shot</button></div>
      </div>`;
      box.querySelectorAll('.lv-ta').forEach(ta => { ta.style.height = 'auto'; ta.style.height = Math.max(46, ta.scrollHeight) + 'px'; });
      if(global.ShotList) ShotList.fillPics(box);
    }

    /* a frame for shot i: the Library on the laptop, Starred on the phone */
    async function pickFor(i){
      if(hasLib() && global.LibView){
        const u = await LibView.pick({ title:'Pick a frame for shot ' + (i + 1) });
        if(!u) return;
        shots[i].item = u;
        if(!shots[i].text && global.MediaLib){ try { const it = MediaLib.find(await MediaLib.load(), u); if(it) shots[i].text = it.label || it.name || ''; } catch(e){} }
        await save(); return draw();
      }
      if(global.StarPick) return StarPick.open({ title:'A frame for shot ' + (i + 1), clear:!!shots[i].item, onPick: async u => { shots[i].item = u || ''; await save(); draw(); } });
      U.toast('Pick frames on the laptop, or star some there first');
    }

    box.addEventListener('click', async e => {
      e.stopPropagation();
      const g = e.target;
      const mo = g.closest('[data-sbmore]');
      if(mo){ const id = mo.dataset.sbmore; opened.has(id) ? opened.delete(id) : opened.add(id); return draw(); }
      if(g.closest('[data-sballdet]')){ allOpen = !allOpen; opened.clear(); try { localStorage.setItem(DET_KEY, allOpen ? '1' : '0'); } catch(err){} return draw(); }
      const pk = g.closest('[data-sbpick]');
      if(pk) return pickFor(+pk.dataset.sbpick);
      const cl = g.closest('[data-sbclear]');
      if(cl){ shots[+cl.dataset.sbclear].item = ''; await save(); return draw(); }
      const fr = g.closest('[data-sbframe]');
      if(fr){
        const s = shots[+fr.dataset.sbframe];
        if(s.seq && s.seq.slots) return openSeq(+fr.dataset.sbframe);
        if(s.item && hasLib() && global.LibView && LibView.view) return LibView.view(s.item);
        return pickFor(+fr.dataset.sbframe);
      }
      if(g.closest('[data-sbframes]')){
        const uids = await LibView.pick({ multi:true });
        if(!uids || !uids.length) return;
        const lib = await MediaLib.load();
        for(const u of uids){
          const it = MediaLib.find(lib, u);
          const ts = it && global.ShotTemplates ? await ShotTemplates.shotFromItem(lib, it) : null;
          shots.push({ id:uid(), text:(it && (it.label || it.name)) || '', note:'', role:ts ? ts.role : 'Action', item:u,
            framing:'', movement:'', done:false, ...(ts && ts.seconds ? { secs:ts.seconds } : {}) });
        }
        await save(); return draw();
      }
      if(g.closest('[data-sbempty]')){ /* named, so it survives a trip through the Steps (a nameless shot isn't one there) */
        shots.push({ id:uid(), text:'Shot ' + (shots.length + 1), note:'', role:'Action', item:'', framing:'Wide', movement:'Static', done:false, secs:3 }); await save(); draw();
        const ins = box.querySelectorAll('[data-sbf="text"]'); if(ins.length){ const f = ins[ins.length - 1]; f.focus(); f.select(); } return; }
      const mv = g.closest('[data-sbmv]');
      if(mv){ const i = +mv.dataset.sbmv, j = i + +mv.dataset.d; [shots[i], shots[j]] = [shots[j], shots[i]]; await save(); return draw(); }
      const dp = g.closest('[data-sbdup]');
      if(dp){ const i = +dp.dataset.sbdup; const c = JSON.parse(JSON.stringify(shots[i])); c.id = uid(); c.done = false; shots.splice(i + 1, 0, c); await save(); return draw(); }
      const rm = g.closest('[data-sbrm]');
      if(rm){
        const i = +rm.dataset.sbrm, was = shots[i];
        shots.splice(i, 1); await save(); draw();
        if(U.toastUndo) U.toastUndo('Shot ' + (i + 1) + ' removed', async () => { shots.splice(i, 0, was); await save(); draw(); });
        return;
      }
      const mk = g.closest('[data-sbmkseq]');
      if(mk){
        const i = +mk.dataset.sbmkseq, s = shots[i];
        const q = Notebook.copyNew(Notebook.stepsPage(s.text || s.role || 'Shot ' + (i + 1)));
        if(s.item && q.slots && q.slots[0]) q.slots[0].item = s.item;
        s.seq = q; await save(); return openSeq(i);
      }
      const sq = g.closest('[data-sbseq]');
      if(sq) return openSeq(+sq.dataset.sbseq);
      const sh = g.closest('[data-sbshoot]');
      if(sh){
        clearTimeout(tt); await A.save(shots);
        return Screens.push('shoot-run', { host:A.host(), at:+sh.dataset.sbshoot, onChange: async () => { shots = (await A.load()) || shots; draw(); if(o.onChange) await o.onChange(); } });
      }
      const us = g.closest('[data-sbunseq]');
      if(us){ delete shots[+us.dataset.sbunseq].seq; await save(); return draw(); }
    });
    box.addEventListener('change', async e => {
      const g = e.target;
      const th = g.closest('[data-then]');
      if(th){
        const i = +th.dataset.then, v = th.value;
        if(v === '__ec'){
          const r = await Transitions.pick({ title:`After shot ${i + 1}`, current:shots[i].tr });
          if(r && r !== 'clear') shots[i].tr = { id:r.id, n:r.title || Transitions.techName((r.tech || [])[0]) };
          else if(r === 'clear') delete shots[i].tr;
        } else if(v.startsWith('ec:')) return;
        else if(v === 'Cut') delete shots[i].tr;
        else shots[i].tr = { id:'', n:v };
        await save(); return draw();
      }
      const f = g.dataset && g.dataset.sbf;
      if(!f) return;
      const s = shots[+g.dataset.i];
      if(!s) return;
      if(f === 'done') s.done = g.checked;
      else if(f === 'secs') s.secs = +g.value || 0;
      else if(f === 'framing' || f === 'movement') s[f] = g.value === '—' ? '' : g.value;
      else s[f] = g.value;
      await save();
      if(['role', 'secs', 'framing', 'movement', 'done'].includes(f)) draw();
    });
    /* words save as you type, without redrawing under you */
    box.addEventListener('input', e => {
      const g = e.target;
      if(!(g.dataset && (g.dataset.sbf === 'text' || g.dataset.sbf === 'note'))) return;
      shots[+g.dataset.i][g.dataset.sbf] = g.value;
      if(g.tagName === 'TEXTAREA'){ g.style.height = 'auto'; g.style.height = Math.max(46, g.scrollHeight) + 'px'; }
      clearTimeout(tt); tt = setTimeout(async () => { await A.save(shots); if(o.onChange) await o.onChange(); }, 500);
    });
    /* drag ⠿ to reorder */
    let from = -1;
    box.addEventListener('dragstart', e => { const c = e.target.closest('.tp-shot'); if(c && !e.target.closest('input,textarea,select')){ from = +c.dataset.i; e.dataTransfer.effectAllowed = 'move'; } });
    box.addEventListener('dragover', e => { const c = e.target.closest('.tp-shot'); if(c && from >= 0){ e.preventDefault(); box.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); c.classList.add('drop'); } });
    box.addEventListener('drop', async e => {
      const c = e.target.closest('.tp-shot');
      if(!c || from < 0) return;
      e.preventDefault();
      const [s] = shots.splice(from, 1); shots.splice(+c.dataset.i, 0, s); from = -1;
      await save(); draw();
    });

    function openSeq(i){
      const s = shots[i];
      Screens.push('shot-seq', { kicker:A.title(), title:s.text || 'Task sequence', page:s.seq,
        put: async page => { const cur = shots.find(x => x.id === s.id); if(cur){ cur.seq = page; await A.save(shots); } },
        onChange: async () => { shots = (await A.load()) || shots; draw(); } });
    }

    draw();
  }

  /* a shot's task sequence on its own page (the Templates' tpl-sequence, for any shot) */
  Screens.register('shot-seq', (el, params) => {
    if(!params.page){ el.innerHTML = Screens.bar({ title:'Task sequence' }) + '<div class="view"><div class="empty"><b>Gone</b>That sequence was removed.</div></div>'; return; }
    el.innerHTML = Screens.bar({ kicker:esc(params.kicker || ''), title:esc(params.title || 'Task sequence') }) + '<div class="view tp-root"><div id="sbSeqHost"></div></div>';
    const sheets = [params.page];
    PagesEditor.mount(el.querySelector('#sbSeqHost'), { sheets, single:true, tid:null, tasks:[], save: async () => {
      await params.put(sheets[0]);
      if(params.onChange) params.onChange();
    } });
  });

  const CSS = `
  .sb-switch{display:inline-flex;gap:2px;padding:2px;margin:0 0 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-1)}
  .sb-switch button{height:30px;padding:0 14px;border:0;border-radius:calc(var(--r) - 2px);background:transparent;color:var(--muted);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
  .sb-switch button[aria-selected="true"]{background:var(--cream);color:#151515}
  .sb-sum{margin:0 0 12px}
  .sb .tp-frame .sb-pic{position:absolute;inset:0}
  .sb .tp-frame .sb-pic img,.sb .tp-frame .sb-pic video{width:100%;height:100%;object-fit:cover;display:block}
  .sb .tp-frame .sb-pic i{display:none}
  .tp-shot.sb-done .tp-shead b{color:var(--green)}
  .sb .tp-shot > .lv-in{flex:0 0 auto}
  .sb-sum{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px}
  .sb-alldet{margin-left:auto;height:26px;padding:0 10px;border:1px solid var(--line);border-radius:13px;background:transparent;color:var(--muted);font:inherit;font-size:12px;cursor:pointer}
  .sb-fold{display:flex;align-items:center;gap:8px;min-height:32px}
  .sb-facts{flex:1;min-width:0;font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sb-facts i{color:var(--dim);font-style:normal}
  .sb-more{display:flex;flex-direction:column;gap:6px}
  .sb.narrow .tp-shots{grid-template-columns:1fr;gap:12px}
  .sb.narrow .tp-addcard{min-height:64px}
  .sb-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .sb-head h4{margin:0}`;
  function css(){ if(document.getElementById('sb-css')) return; const st = document.createElement('style'); st.id = 'sb-css'; st.textContent = CSS; document.head.appendChild(st); }
  css();

  global.ShotBoard = { mount, view, setView, switchHTML };
})(window);
