/* v4: Edit — the whole episode laid out in one line, for cutting it.

   Every shot of the week, left to right: by day, then sequence, then shot,
   each a block as wide as it runs (its frame in it), the transition between
   blocks, shorts as green blocks. Under a block: filmed (green) or not yet
   (dashed), still on the card (amber dot) or on the computer, the device it
   was shot on. Tap a block for its panel: description, the words over it,
   THEN, edit note, device, where the file is, and ✓ Filmed / ✂ Cut / On the
   computer. Select several (a day, a sequence, a device, what's still on a
   card, or by hand) to mark them on the computer, set their device or their
   folder in one go. Drag a sequence's label to cut it in another order
   (v.editOrder); the days stay as they were filmed.

   Shot fields (shotlist.js extras, so they ride through the Steps):
     dev   device it was shot on      off   on the computer
     loc   folder / file              cut   cut in the edit
   Episode: v.footFolder (the episode's folder), v.editOrder ([beat ids]).
   Devices: Devices.list() / edit() — settings 'devices', yours to change.

     EditLine.mount(host, { vlogId, openBeat(beatId), onChange() })
     EditLine.markers(v) → text (Copy as markers) */
(function(global){
  const esc = s => U.esc(s);
  const DEF_SECS = 3;                      /* a shot with no length counts as this */
  const ZOOMS = [6, 10, 16, 26, 40];       /* px per second */

  /* ------------------------------------------------------------ devices */
  const DEV_KEY = 'devices';
  const DEFAULT_DEVICES = ['Canon R6', 'DJI Pocket 3', 'iPhone', 'Android phone'];
  const Devices = {
    async list(){
      let v = null;
      try { v = await Store.get('settings', DEV_KEY); } catch(e){}
      return Array.isArray(v) && v.length ? v.filter(Boolean) : DEFAULT_DEVICES.slice();
    },
    async save(list){ await Store.put('settings', list.map(x => String(x).trim()).filter(Boolean), DEV_KEY); },
    last(){ try { return localStorage.getItem('cs4-last-dev') || ''; } catch(e){ return ''; } },
    setLast(d){ try { localStorage.setItem('cs4-last-dev', d || ''); } catch(e){} },
    /* short label for a block: "R6", "P3", "iP" */
    short(d){
      const s = String(d || '').trim();
      if(!s) return '';
      const m = /([A-Za-z]*\d+)\s*$/.exec(s);
      if(m) return m[1].length <= 4 ? m[1] : m[1].slice(-3);
      return s.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase() || s.slice(0, 2);
    },
    /* the sheet to change the list: rename, reorder, add, remove */
    edit(onDone){
      (async () => {
        let list = await Devices.list();
        const draw = () => `<h2 style="margin:0 0 4px">Devices</h2>
          <p class="hintline" style="margin:0 0 10px">What you shoot on. Shots keep the name they were given; renaming here changes the list.</p>
          <div class="el-devs">${list.map((d, i) => `<div class="el-dev">
            <input value="${esc(d)}" data-dv="${i}" aria-label="Device ${i + 1}">
            <button data-dvmv="${i}:-1" ${i === 0 ? 'disabled' : ''} aria-label="Up">↑</button>
            <button data-dvmv="${i}:1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Down">↓</button>
            <button data-dvrm="${i}" aria-label="Remove ${esc(d)}">✕</button></div>`).join('')}</div>
          <div style="display:flex;gap:6px;margin:10px 0 0"><input class="el-in" data-dvnew placeholder="Add a device — Sony FX3, GoPro…" style="flex:1"><button class="btn-sm" data-dvadd>Add</button></div>
          <div class="sheetcta"><button class="btn-primary" data-dvok>Done</button></div>`;
        App.sheet(draw(), sh => {
          css();
          const redraw = () => { sh.innerHTML = draw(); };
          sh.addEventListener('input', e => { const f = e.target.closest('[data-dv]'); if(f) list[+f.dataset.dv] = f.value; });
          sh.addEventListener('click', async e => {
            const mv = e.target.closest('[data-dvmv]');
            if(mv){ const [i, d] = mv.dataset.dvmv.split(':').map(Number); [list[i], list[i + d]] = [list[i + d], list[i]]; return redraw(); }
            const rm = e.target.closest('[data-dvrm]');
            if(rm){ list.splice(+rm.dataset.dvrm, 1); return redraw(); }
            if(e.target.closest('[data-dvadd]')){ const v = sh.querySelector('[data-dvnew]').value.trim(); if(v){ list.push(v); redraw(); } return; }
            if(e.target.closest('[data-dvok]')){ await Devices.save(list); App.closeSheet(); if(onDone) onDone(); }
          });
        });
      })();
    },
    /* pick one: resolves to the name, '' for none, null if cancelled */
    pick(title, current){
      return new Promise(async resolve => {
        const list = await Devices.list();
        App.sheet(`<h2 style="margin:0 0 10px">${esc(title || 'Shot on')}</h2>
          <div class="trs-plain">${list.map(d => `<button data-dvp="${esc(d)}" aria-pressed="${d === current}">${esc(d)}</button>`).join('')}</div>
          <div class="sheetcta">${current ? '<button class="btn-ghost" data-dvnone>No device</button>' : ''}<button class="btn-ghost" data-dvedit>Edit the list</button><button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
          if(global.Transitions) Transitions.css();
          sh.addEventListener('click', e => {
            const b = e.target.closest('[data-dvp]');
            if(b){ App.closeSheet(); return resolve(b.dataset.dvp); }
            if(e.target.closest('[data-dvnone]')){ App.closeSheet(); return resolve(''); }
            if(e.target.closest('[data-dvedit]')){ return Devices.edit(async () => resolve(await Devices.pick(title, current))); }
            if(e.target.closest('[data-no]')){ App.closeSheet(); resolve(null); }
          });
        });
      });
    }
  };

  /* ------------------------------------------------------------ the order */
  /* sequences in cut order: v.editOrder first (the ones still there), then
     anything not in it, in day order */
  function ordered(v){
    const all = [];
    (v.acts || []).forEach(a => (a.beats || []).forEach(b => all.push({ act:a, beat:b })));
    const ord = Array.isArray(v.editOrder) ? v.editOrder : [];
    const by = new Map(all.map(x => [x.beat.id, x]));
    const out = ord.map(id => by.get(id)).filter(Boolean);
    all.forEach(x => { if(!out.includes(x)) out.push(x); });
    return out;
  }
  const shotsOf = b => (Array.isArray(b.shots) ? b.shots : []).filter(s => s && typeof s === 'object' && (s.text || s.item || s.clip));
  const secsOf = s => +s.secs > 0 ? +s.secs : DEF_SECS;
  function tc(sec){ sec = Math.round(sec); const m = Math.floor(sec / 60), s2 = sec % 60; return `${m}:${String(s2).padStart(2, '0')}`; }

  /* "0:05 Coffee pour · Close-up · Whip pan →" — one line a shot, to paste beside the editor */
  function markers(v){
    let t = 0;
    const lines = [`${v.title || 'Episode'} — edit markers`];
    ordered(v).forEach(({ act, beat }) => {
      lines.push('', `## ${act.title} · ${beat.title || 'Sequence'}`);
      shotsOf(beat).forEach((s, i) => {
        const bits = [s.text || 'Shot ' + (i + 1), s.framing, s.dev, s.loc ? '[' + s.loc + ']' : '', s.editNote ? '— ' + s.editNote : ''].filter(Boolean);
        lines.push(`${tc(t)}  ${bits.join(' · ')}${s.tr && (s.tr.n || s.tr.id) ? `  ⇄ ${s.tr.n || 'Transition'} →` : ''}`);
        t += secsOf(s);
      });
    });
    lines.push('', `Total about ${tc(t)}`);
    return lines.join('\n');
  }

  /* ------------------------------------------------------------ the screen */
  async function mount(host, o){
    css();
    let v = null, sel = new Set(), focus = null, picking = false;
    let zoom = (() => { try { const z = +localStorage.getItem('cs4-el-zoom'); return ZOOMS.includes(z) ? z : 16; } catch(e){ return 16; } })();
    const key = (bid, i) => bid + ':' + i;
    const load = async () => { v = await Store.get('vlogs', o.vlogId); };
    const find = k => { const [bid, i] = k.split(':'); for(const a of v.acts || []) for(const b of a.beats || []) if(b.id === bid) return { act:a, beat:b, shot:shotsOf(b)[+i], i:+i }; return null; };
    /* every change goes on the episode; the Steps rebuild their page from it */
    async function save(beats){
      (beats || []).forEach(b => { b.shotsSig = ''; });
      await Store.put('vlogs', v);
      if(global.Data && Data.invalidate) Data.invalidate();
      if(o.onChange) await o.onChange();
    }

    function draw(){
      if(!host.isConnected || !v) return;
      const seqs = ordered(v);
      const flat = [];
      seqs.forEach(x => shotsOf(x.beat).forEach((s, i) => flat.push({ ...x, s, i, k:key(x.beat.id, i) })));
      const total = flat.reduce((n, x) => n + secsOf(x.s), 0);
      const guessed = flat.some(x => !(+x.s.secs > 0));
      const filmed = flat.filter(x => x.s.done).length, off = flat.filter(x => x.s.off).length, cut = flat.filter(x => x.s.cut).length;
      const devs = [...new Set(flat.map(x => x.s.dev).filter(Boolean))];
      const W = s => Math.max(30, Math.round(secsOf(s) * zoom));
      /* the bands: a day run, a sequence run, then the blocks, with ⇄ between */
      let days = [], t = 0, blocks = '', seqBands = '';
      seqs.forEach(({ act, beat }) => {
        const sh = shotsOf(beat);
        if(!sh.length) return;
        let w = 0;
        const html = sh.map((s, i) => {
          const k = key(beat.id, i), last = i === sh.length - 1;
          const bw = W(s); w += bw + 3;
          const trW = s.tr && (s.tr.n || s.tr.id) ? 18 : 0; w += trW;
          return `<button class="el-b${s.done ? ' filmed' : ''}${s.cut ? ' cut' : ''}${s.clip ? ' short' : ''}${sel.has(k) ? ' sel' : ''}${focus === k ? ' focus' : ''}" data-elk="${esc(k)}" style="width:${bw}px" title="${esc(s.text || '')}">
              ${s.item ? `<span class="el-pic" data-slpic="${esc(s.item)}"></span>` : ''}
              <span class="el-n">${String(i + 1).padStart(2, '0')}</span>
              <span class="el-t">${esc(s.clip ? '▶ ' + (s.text || 'Short') : s.text || '')}</span>
              <span class="el-f">${s.dev ? `<i class="dv">${esc(Devices.short(s.dev))}</i>` : ''}${s.done && !s.off ? '<i class="card" title="Still on the card"></i>' : ''}${s.off ? '<i class="pc" title="On the computer">▣</i>' : ''}${s.cut ? '<i class="ct" title="Cut">✂</i>' : ''}</span>
            </button>${trW ? `<span class="el-tr" title="${esc(s.tr.n || 'Transition')}"${s.tr.id ? ` data-eltr="${esc(s.tr.id)}" data-trn="${esc(s.tr.n || '')}"` : ''}>⇄</span>` : ''}${last ? '<span class="el-gap"></span>' : ''}`;
        }).join('');
        w += 10;
        blocks += html;
        seqBands += `<div class="el-seq" draggable="true" data-elseq="${esc(beat.id)}" style="width:${w - 3}px" title="Drag to cut it in another order · tap to select its shots">${esc(beat.title || 'Sequence')}</div>`;
        const lastDay = days[days.length - 1];
        if(lastDay && lastDay.act === act) lastDay.w += w; else days.push({ act, w });
        t += sh.reduce((n, s) => n + secsOf(s), 0);
      });
      const ticks = [];
      for(let s2 = 0; s2 <= total + 30; s2 += zoom >= 26 ? 10 : zoom >= 10 ? 30 : 60) ticks.push(s2);
      const f = focus ? find(focus) : null;
      host.innerHTML = `<div class="el">
        <div class="el-top">
          <span class="el-stat"><b>${guessed ? 'about ' : ''}${tc(total)}</b> runtime · ${filmed}/${flat.length} filmed · ${off}/${flat.length} on the computer · ${cut}/${flat.length} cut</span>
          <span class="el-acts">
            <button class="btn-sm" data-elz="-1" ${zoom === ZOOMS[0] ? 'disabled' : ''} aria-label="Zoom out">−</button>
            <button class="btn-sm" data-elz="1" ${zoom === ZOOMS[ZOOMS.length - 1] ? 'disabled' : ''} aria-label="Zoom in">+</button>
            <button class="btn-sm" data-elcopy>Copy as markers</button>
            <button class="btn-sm" data-eldevs>Devices</button></span>
        </div>
        <label class="el-folder"><span>Footage folder</span><input class="el-in" data-elfolder value="${esc(v.footFolder || '')}" placeholder="D:\\Footage\\${esc(v.title || 'Week')}"></label>
        <div class="el-selbar">
          <span>Select</span>
          <button data-elsel="all">All</button>
          <button data-elsel="card">Still on a card</button>
          <button data-elsel="nodev">No device</button>
          ${devs.map(d => `<button data-elsel="dev:${esc(d)}">${esc(d)}</button>`).join('')}
          <button data-elpick aria-pressed="${picking}" title="Tap blocks to add or take them off the selection">${picking ? '✓ Picking blocks' : 'Pick blocks'}</button>
          ${sel.size ? `<button data-elsel="none">Clear</button>` : ''}
        </div>
        ${sel.size ? `<div class="el-mass"><b>${sel.size} shot${sel.size === 1 ? '' : 's'}</b>
          <button class="btn-sm accent" data-elmass="off">On the computer ✓</button>
          <button class="btn-sm" data-elmass="card">Back to the card</button>
          <button class="btn-sm" data-elmass="dev">Device…</button>
          <button class="btn-sm" data-elmass="loc">Folder…</button>
          <button class="btn-sm" data-elmass="filmed">Filmed ✓</button>
          <button class="btn-sm" data-elmass="cut">Cut ✓</button></div>` : ''}
        ${flat.length ? `<div class="el-track">
          <div class="el-row el-days">${days.map(d => `<div class="el-day" style="width:${d.w - 3}px" data-elday="${esc(d.act.id)}" title="Tap to select this day">${esc(d.act.title)}</div>`).join('')}</div>
          <div class="el-row el-seqs">${seqBands}</div>
          <div class="el-row el-blocks">${blocks}</div>
          <div class="el-ruler" style="width:${Math.round((total + 30) * zoom)}px">${ticks.map(s2 => `<span style="left:${s2 * zoom}px">${tc(s2)}</span>`).join('')}</div>
        </div>
        <p class="el-key">Green line: filmed · dashed: not yet · amber dot: still on the card · ▣ on the computer · ✂ cut · ⇄ a transition (tap to watch) · green block: a short · drag a sequence's label to reorder</p>`
          : `<div class="empty"><b>No shots yet</b>Plan the days' sequences on the Plan tab — they line up here.</div>`}
        ${f && f.shot ? panelHTML(f) : ''}
      </div>`;
      if(global.ShotList) ShotList.fillPics(host);
    }

    function panelHTML(f){
      const s = f.shot, beat = f.beat;
      let start = 0;
      for(const x of ordered(v)){ if(x.beat === beat){ start += shotsOf(beat).slice(0, f.i).reduce((n, y) => n + secsOf(y), 0); break; } start += shotsOf(x.beat).reduce((n, y) => n + secsOf(y), 0); }
      const lines = (s.lines || []).filter(l => String(l.t || '').trim());
      const last = f.i === shotsOf(beat).length - 1;
      return `<section class="el-panel">
        <div class="el-ph"><b>${String(f.i + 1).padStart(2, '0')} · ${esc(s.text || 'Shot')}</b>
          <small>${esc(f.act.title)} · ${esc(beat.title || 'Sequence')} · ${tc(start)}–${tc(start + secsOf(s))}${+s.secs > 0 ? '' : ' (no length set)'}</small>
          <span class="el-pacts">
            <button class="el-tg${s.done ? ' on' : ''}" data-eltg="done">✓ Filmed</button>
            <button class="el-tg${s.off ? ' on' : ''}" data-eltg="off">▣ On the computer</button>
            <button class="el-tg${s.cut ? ' on' : ''}" data-eltg="cut">✂ Cut</button></span></div>
        <div class="el-grid">
          <label>Description<input class="el-in" data-elf="desc" value="${esc(s.desc || '')}" placeholder="What we see in it"></label>
          <label>Edit note<input class="el-in" data-elf="editNote" value="${esc(s.editNote || '')}" placeholder="Take, trim, effect…"></label>
          <label>Shot on<button class="el-in el-pickbtn" data-eldev>${esc(s.dev || 'Pick a device…')}</button></label>
          <label>Where the file is<input class="el-in" data-elf="loc" value="${esc(s.loc || '')}" placeholder="${esc(beat.footFolder || v.footFolder || 'Folder or file name')}"></label>
          ${last ? '<span></span>' : `<label>Then<button class="el-in el-pickbtn" data-elthen>${esc(s.tr && (s.tr.n || s.tr.id) ? '⇄ ' + (s.tr.n || 'Transition') : 'Cut')}</button></label>`}
          <label>Length<span class="el-ro">${+s.secs > 0 ? s.secs + ' s' : 'not set — the Storyboard sets it'}</span></label>
        </div>
        ${lines.length ? `<div class="el-lines">${lines.map(l => `<p><i>${esc((ShotList.LINE_KINDS || {})[l.k] || 'VO')}</i>${esc(l.t)}</p>`).join('')}</div>` : ''}
        <div class="el-pfoot">${s.tr && s.tr.id ? `<button class="btn-sm" data-eltr="${esc(s.tr.id)}" data-trn="${esc(s.tr.n || '')}">▶ Watch the transition</button>` : ''}
          ${s.clip ? `<button class="btn-sm" data-elclip="${esc(s.clip)}">▶ Open the short</button>` : ''}
          <button class="btn-sm" data-elbeat="${esc(beat.id)}">Open the sequence</button></div>
      </section>`;
    }

    /* selections */
    function select(pred){ sel = new Set(); ordered(v).forEach(({ act, beat }) => shotsOf(beat).forEach((s, i) => { if(pred(s, act, beat)) sel.add(key(beat.id, i)); })); }
    async function mass(fn){
      const beats = new Set();
      [...sel].forEach(k => { const f = find(k); if(f && f.shot){ fn(f.shot, f); beats.add(f.beat); } });
      await save([...beats]); draw();
    }

    host.addEventListener('click', async e => {
      const g = e.target;
      const z = g.closest('[data-elz]');
      if(z){ const i = ZOOMS.indexOf(zoom) + +z.dataset.elz; if(ZOOMS[i]){ zoom = ZOOMS[i]; try { localStorage.setItem('cs4-el-zoom', zoom); } catch(err){} draw(); } return; }
      if(g.closest('[data-elcopy]')){
        const txt = markers(v);
        try { await navigator.clipboard.writeText(txt); U.toast('Markers copied — paste them beside the edit'); }
        catch(err){ App.sheet(`<h2>Markers</h2><textarea class="el-in" style="width:100%;height:50vh;font-family:var(--mono,monospace)">${esc(txt)}</textarea><div class="sheetcta"><button class="btn-ghost" data-no>Close</button></div>`, sh => sh.addEventListener('click', ev => { if(ev.target.closest('[data-no]')) App.closeSheet(); })); }
        return;
      }
      if(g.closest('[data-eldevs]')) return Devices.edit(() => draw());
      const tr = g.closest('[data-eltr]');
      if(tr && global.Transitions) return Transitions.peek(tr.dataset.eltr, tr.dataset.trn);
      const cl = g.closest('[data-elclip]');
      if(cl) return Screens.push('clip', { id:cl.dataset.elclip });
      const ob = g.closest('[data-elbeat]');
      if(ob) return o.openBeat && o.openBeat(ob.dataset.elbeat);
      const ss = g.closest('[data-elsel]');
      if(ss){
        const w = ss.dataset.elsel;
        if(w === 'none') sel = new Set();
        else if(w === 'all') select(() => true);
        else if(w === 'card') select(s => !s.off);
        else if(w === 'nodev') select(s => !s.dev);
        else if(w.startsWith('dev:')) select(s => s.dev === w.slice(4));
        return draw();
      }
      if(g.closest('[data-elpick]')){ picking = !picking; return draw(); }
      const dy = g.closest('[data-elday]');
      if(dy){ select((s, act) => act.id === dy.dataset.elday); return draw(); }
      const sq = g.closest('[data-elseq]');
      if(sq){ select((s, act, beat) => beat.id === sq.dataset.elseq); return draw(); }
      const ms = g.closest('[data-elmass]');
      if(ms){
        const m = ms.dataset.elmass;
        if(m === 'off') return mass(s => { s.off = true; });
        if(m === 'card') return mass(s => { delete s.off; });
        if(m === 'filmed') return mass(s => { s.done = true; });
        if(m === 'cut') return mass(s => { s.cut = true; });
        if(m === 'dev'){ const d = await Devices.pick(`Shot on — ${sel.size} shot${sel.size === 1 ? '' : 's'}`, ''); if(d === null) return; return mass(s => { if(d) s.dev = d; else delete s.dev; }); }
        if(m === 'loc'){
          App.sheet(`<h2 style="margin:0 0 4px">Where these ${sel.size} are</h2><p class="hintline" style="margin:0 0 10px">A folder (or file) on the computer.</p>
            <input class="el-in" data-locin style="width:100%" value="${esc(v.footFolder || '')}" placeholder="D:\\Footage\\Week 2\\Pocket 3">
            <div class="sheetcta"><button class="btn-primary" data-locok>Set it</button><button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
            sh.addEventListener('click', async ev => {
              if(ev.target.closest('[data-no]')) return App.closeSheet();
              if(ev.target.closest('[data-locok]')){ const val = sh.querySelector('[data-locin]').value.trim(); App.closeSheet(); await mass(s => { if(val) s.loc = val; else delete s.loc; }); }
            });
          });
          return;
        }
        return;
      }
      /* the panel */
      const tg = g.closest('[data-eltg]');
      if(tg && focus){ const f = find(focus); if(f && f.shot){ const k = tg.dataset.eltg; if(f.shot[k]) delete f.shot[k]; else f.shot[k] = true; await save([f.beat]); draw(); } return; }
      if(g.closest('[data-eldev]') && focus){
        const f = find(focus); if(!f || !f.shot) return;
        const d = await Devices.pick('Shot on', f.shot.dev || ''); if(d === null) return;
        if(d) f.shot.dev = d; else delete f.shot.dev; await save([f.beat]); return draw();
      }
      if(g.closest('[data-elthen]') && focus && global.Transitions){
        const f = find(focus); if(!f || !f.shot) return;
        const r = await Transitions.pick({ title:`After shot ${f.i + 1}`, current:f.shot.tr });
        if(!r) return;
        if(r === 'clear') delete f.shot.tr; else f.shot.tr = { id:r.id || '', n:r.title || Transitions.techName((r.tech || [])[0]) };
        await save([f.beat]); return draw();
      }
      const b = g.closest('[data-elk]');
      if(b){
        const k = b.dataset.elk;
        if(picking || e.shiftKey || e.ctrlKey || e.metaKey){ sel.has(k) ? sel.delete(k) : sel.add(k); }
        else focus = focus === k ? null : k;
        draw();
        if(focus === k){ const p = host.querySelector('.el-panel'); if(p && p.scrollIntoView) p.scrollIntoView({ block:'nearest', behavior:'smooth' }); }
      }
    });
    /* words in the panel save as you type; the folder too */
    let tt = 0;
    host.addEventListener('input', e => {
      const g = e.target;
      if(g.matches('[data-elfolder]')){ v.footFolder = g.value; clearTimeout(tt); tt = setTimeout(() => save([]), 500); return; }
      const fld = g.dataset && g.dataset.elf;
      if(!fld || !focus) return;
      const f = find(focus); if(!f || !f.shot) return;
      f.shot[fld] = g.value;
      clearTimeout(tt); tt = setTimeout(() => save([f.beat]), 500);
    });
    /* drag a sequence's label to cut it elsewhere */
    let from = null;
    host.addEventListener('dragstart', e => { const s = e.target.closest('[data-elseq]'); if(s){ from = s.dataset.elseq; e.dataTransfer.effectAllowed = 'move'; } });
    host.addEventListener('dragover', e => { const s = e.target.closest('[data-elseq]'); if(s && from){ e.preventDefault(); host.querySelectorAll('.el-seq.drop').forEach(x => x.classList.remove('drop')); s.classList.add('drop'); } });
    host.addEventListener('drop', async e => {
      const s = e.target.closest('[data-elseq]');
      if(!s || !from) return;
      e.preventDefault();
      const ids = ordered(v).map(x => x.beat.id).filter(id => id !== from);
      ids.splice(ids.indexOf(s.dataset.elseq), 0, from);
      v.editOrder = ids; from = null;
      await save([]); draw();
    });

    await load();
    draw();
    return { refresh: async () => { await load(); draw(); } };
  }

  const CSS = `
  .el-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px}
  .el-stat{flex:1;min-width:0;color:var(--muted);font-size:13.5px}.el-stat b{color:var(--cream);font-size:16px}
  .el-acts{display:flex;gap:6px;flex-wrap:wrap}
  @media (max-width:700px){ .el-top{flex-direction:column;align-items:stretch} .el-stat{flex:none} .el-acts .btn-sm{height:34px} }
  .el-folder{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:12.5px;color:var(--muted)}
  .el-folder .el-in{flex:1}
  .el-in{height:36px;padding:0 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit;font-size:14px;min-width:0;box-sizing:border-box}
  .el-pickbtn{text-align:left;cursor:pointer;width:100%}
  .el-selbar{display:flex;align-items:center;gap:6px;overflow-x:auto;scrollbar-width:none;padding:0 0 8px}
  .el-selbar > span{color:var(--dim);font-size:12px;flex:0 0 auto}
  .el-selbar button{flex:0 0 auto;height:28px;padding:0 10px;border:1px solid var(--line);border-radius:14px;background:transparent;color:var(--cream);font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
  .el-selbar button[aria-pressed="true"]{border-color:var(--orange);color:var(--orange)}
  .el-mass{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 8px;padding:8px 10px;border:1px solid var(--orange);border-radius:var(--r);background:var(--surface-2)}
  .el-mass b{margin-right:4px;font-size:13.5px}
  .el-track{position:relative;overflow-x:auto;padding:8px 8px 22px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-1)}
  .el-row{display:flex;align-items:stretch;width:max-content}
  .el-days{margin:0 0 3px}
  .el-day{flex:0 0 auto;margin-right:3px;padding:3px 6px;border-left:2px solid var(--muted);font-family:var(--display),sans-serif;font-weight:900;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--cream);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;box-sizing:border-box}
  .el-seqs{margin:0 0 5px}
  .el-seq{flex:0 0 auto;margin-right:13px;padding:3px 6px;border-radius:3px;background:rgba(251,105,0,.16);color:#F4B07A;font-size:11.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:grab;box-sizing:border-box}
  .el-seq:nth-child(3n+2){background:rgba(29,158,117,.18);color:#7FD3B4}
  .el-seq:nth-child(3n){background:rgba(167,139,250,.18);color:#C9B8FF}
  .el-seq.drop{outline:2px solid var(--orange)}
  .el-blocks{height:74px}
  .el-b{position:relative;flex:0 0 auto;margin-right:3px;padding:0;border:1px dashed #4A453C;border-radius:4px;background:var(--surface-2);overflow:hidden;cursor:pointer;text-align:left;color:var(--cream);font:inherit}
  .el-b.filmed{border-style:solid;border-color:#2F2C26;box-shadow:inset 0 -3px 0 var(--green)}
  .el-b.short{background:rgba(91,190,106,.16)}
  .el-b.cut .el-t{text-decoration:line-through;text-decoration-color:var(--green)}
  .el-b.sel{outline:2px solid var(--orange);outline-offset:-2px}
  .el-b.focus{outline:2px solid #6FA8F5;outline-offset:-2px}
  .el-pic{position:absolute;inset:0;opacity:.55}
  .el-pic img,.el-pic video{width:100%;height:100%;object-fit:cover;display:block}.el-pic i{display:none}
  .el-n{position:absolute;left:4px;top:3px;font-size:10px;font-weight:800;color:var(--orange);text-shadow:0 1px 2px #000}
  .el-t{position:absolute;left:4px;right:4px;top:16px;font-size:10.5px;line-height:1.2;max-height:26px;overflow:hidden;text-shadow:0 1px 2px #000}
  .el-f{position:absolute;left:3px;right:3px;bottom:5px;display:flex;align-items:center;gap:3px}
  .el-f i{font-style:normal;font-size:9.5px;line-height:1}
  .el-f .dv{padding:1px 3px;border-radius:2px;background:#000a;color:#ddd;font-weight:700}
  .el-f .card{width:7px;height:7px;border-radius:50%;background:#F59E0B}
  .el-f .pc{color:#7FB6F5}.el-f .ct{color:var(--green)}
  .el-tr{flex:0 0 15px;margin-right:3px;display:flex;align-items:center;justify-content:center;color:#C9B8FF;font-size:12px;cursor:pointer}
  .el-gap{flex:0 0 10px}
  .el-ruler{position:relative;height:14px;margin-top:4px}
  .el-ruler span{position:absolute;top:0;font-size:10px;color:var(--dim);transform:translateX(-2px);white-space:nowrap}
  .el-key{margin:6px 0 12px;color:var(--dim);font-size:11.5px}
  .el-panel{margin:4px 0 0;padding:12px 14px;border:1px solid #6FA8F555;border-radius:var(--r);background:var(--surface-2)}
  .el-ph{display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap;margin:0 0 10px}
  .el-ph b{font-size:15px}.el-ph small{color:var(--muted);font-size:12.5px}
  .el-pacts{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
  .el-tg{height:30px;padding:0 10px;border:1px solid var(--line);border-radius:var(--r);background:transparent;color:var(--muted);font:inherit;font-size:12.5px;cursor:pointer}
  .el-tg.on{border-color:var(--green);color:var(--green);background:rgba(91,190,106,.1)}
  .el-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px 12px}
  .el-grid label{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--muted)}
  .el-ro{height:36px;display:flex;align-items:center;color:var(--cream);font-size:14px}
  .el-lines{margin:10px 0 0;padding:8px 10px;border-left:2px solid var(--orange);background:var(--bg)}
  .el-lines p{margin:0 0 4px;font-size:14px}.el-lines i{font-style:normal;font-size:10px;font-weight:800;color:var(--orange);margin-right:6px}
  .el-pfoot{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 0}
  .el-devs{display:flex;flex-direction:column;gap:6px}
  .el-dev{display:flex;gap:6px}
  .el-dev input{flex:1;height:36px;padding:0 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit}
  .el-dev button{width:34px;border:1px solid var(--line);border-radius:var(--r);background:transparent;color:var(--muted);cursor:pointer}
  .el-dev button:disabled{opacity:.3}`;
  function css(){ if(document.getElementById('el-css')) return; const st = document.createElement('style'); st.id = 'el-css'; st.textContent = CSS; document.head.appendChild(st); }

  global.Devices = Devices;
  global.EditLine = { mount, markers, ordered };
})(window);
