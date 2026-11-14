/* One day of an episode.

   A day is a container — Monday is not something you can shoot. It holds the
   sequences: "Roller skating intro", "Working in the yard transition". Each of
   those holds the shots. This is the screen you open on the day itself, so the
   only thing in front of you is what you are filming today. */
(function(){
  const { ICON } = U;

  const esc = s => U.esc(s);   /* shared: util.js */

  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  async function mount(el, params){
    let v = null, act = null, startDate = null, today = 1;

    const dayLabel = n => {
      if(!startDate) return `Day ${n}`;
      const d = new Date(startDate);
      d.setDate(d.getDate() + (n - 1));
      return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    };

    async function load(){
      v = await Store.get('vlogs', params.vlogId);
      act = v ? (v.acts || []).find(a => a.id === params.actId) : null;
      try { startDate = (await Data.program()).start; } catch(e){ startDate = null; }
      try { today = await Data.currentDay(); } catch(e){ today = 1; }
    }

    const save = async () => {
      await Store.put('vlogs', v);
      if(params.onChange) params.onChange();
    };

    /* What kind of thing this is to film, as a label you can see from the list —
       knowing it is a talking head before you open it is what lets you decide
       what to shoot next without reading every one. */
    function setupTag(b){
      if(!(window.Quarters && Quarters.setupOf)) return '';
      const st = Quarters.setupOf(b.setup || 'talking');
      return `<span class="setuptag" style="color:${st.c};border-color:${st.c}55;
        background:${st.c}14">${st.label}</span>`;
    }

    /* which sequences are open: the first one not finished, until you choose */
    let opened = null;
    const DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M6 9l6 6 6-6"/></svg>';
    function isOpen(b){
      if(!opened){
        const seqs = (act && act.beats) || [];
        const first = seqs.find(x => !(x.shots || []).length || (x.shots || []).some(s => !s.done)) || seqs[0];
        opened = new Set(first ? [first.id] : []);
      }
      return opened.has(b.id);
    }
    /* "06:30" → "6:30 AM" */
    const fmtT = at => { const m = /^(\d{1,2}):(\d{2})/.exec(String(at || '')); if(!m) return ''; const h = +m[1]; return `${(h % 12) || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`; };
    /* v4: when it's shot — a chip on each sequence; Today puts it at that hour */
    const timeChip = b => `<button class="dc-time${b.at ? ' has-t' : ''}" data-seqtime="${b.id}" title="When you shoot it — Today puts it at that time">${b.at ? '🕘 ' + fmtT(b.at) : '＋ Time'}</button>`;
    function countLine(b){
      const sh = b.shots || [], done = sh.filter(s => s.done).length, fr = sh.filter(s => s.item).length;
      return [sh.length ? `${done} of ${sh.length} shots${fr ? ` · ${fr} with frames` : ''}` : 'no shots yet',
        b.day ? dayLabel(b.day) : 'no day yet', b.taskId ? 'on your days' : ''].filter(Boolean).join(' · ');
    }
    const SEQ_CSS = `
      .seqcard .sc-row{display:flex;align-items:center;gap:8px}
      .seqcard .sc-row .sc-head{flex:1;min-width:0}
      .seqcard .sc-cv{display:inline-flex;width:18px;color:var(--dim);flex:0 0 18px}
      .seqcard .sc-shoot{flex:0 0 auto;height:40px;padding:0 14px;margin-right:10px;border:0;border-radius:var(--r);background:var(--orange);color:#151515;font-family:var(--display),sans-serif;font-weight:900;font-size:13.5px;cursor:pointer}
      .seqcard .sc-host{padding:4px 12px 8px;border-top:1px solid var(--line)}
      .dc-time{height:26px;padding:0 9px;border:1px dashed var(--line);border-radius:13px;background:transparent;color:var(--muted);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;flex:0 0 auto}
      .dc-time.has-t{border-style:solid;border-color:var(--orange);color:var(--cream)}
      .seqcard .sc-row .dc-time{margin-right:8px}
      .dc-tin{width:100%;height:46px;padding:0 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit;font-size:18px;color-scheme:dark}
      .dcols{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(300px,1fr);gap:12px;overflow-x:auto;padding:0 0 8px;scroll-snap-type:x mandatory}
      .dcol{scroll-snap-align:start;min-width:0;background:var(--surface-2);border:1px solid #2B2822;border-radius:var(--r);display:flex;flex-direction:column}
      .dcol.all{border-color:rgba(91,190,106,.45)}
      .dc-h{padding:10px 12px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:5px;position:sticky;top:0;background:var(--surface-2);z-index:1;border-radius:var(--r) var(--r) 0 0}
      .dc-pos{font-family:var(--display),sans-serif;font-weight:900;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--orange)}
      .dc-t{padding:0;border:0;background:none;color:var(--cream);text-align:left;cursor:pointer;font:inherit}
      .dc-t b{font-size:17px}
      .dc-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .dc-meta small{color:var(--muted);font-size:12.5px}
      .dc-acts{display:flex;gap:6px;flex-wrap:wrap}
      .dc-acts button{height:30px;padding:0 10px;border:1px solid var(--line);border-radius:var(--r);background:transparent;color:var(--muted);font:inherit;font-size:12.5px;cursor:pointer}
      .dc-acts .dc-shoot{background:var(--orange);border-color:var(--orange);color:#151515;font-weight:800}
      .dcol .sc-host{padding:10px 12px 12px}
      .dcol .tp-frame{max-height:230px}
      @media (max-width:700px){ .dcols{grid-auto-columns:86vw} }`;

    function render(){
      if(!act){
        el.innerHTML = Screens.bar({ title:'Day' }) +
          '<div class="view"><div class="empty"><b>Not found</b>That day is gone.</div></div>';
        return;
      }

      const seqs = act.beats || [];
      const shots = seqs.reduce((n, b) => n + (b.shots || []).length, 0);
      const got = seqs.reduce((n, b) => n + (b.shots || []).filter(s => s.done).length, 0);
      /* one deliberately on another date is fine; it should just be visible */
      const offDay = act.day ? seqs.filter(b => b.day && b.day !== act.day).length : 0;

      el.innerHTML = Screens.bar({ kicker:v.title || 'Vlog', title:act.title }) + `
        <div class="view">
          <div class="pagehead"><h1 class="page-title">${esc(act.title)}</h1></div>
          <p class="hintline" style="margin:0 0 12px">${seqs.length
            ? `${seqs.length} sequence${seqs.length === 1 ? '' : 's'}${
                shots ? ` · ${got} of ${shots} shots captured` : ' · no shots listed yet'}`
            : 'Nothing planned for this day yet.'}</p>

          <!-- The date belongs to the day, not to each sequence inside it. Three
               sequences filmed on Sunday are all filmed on Sunday; setting that
               three times was work the app was inventing. -->
          <button class="dayrow" data-a="setdate" style="margin:0 0 16px">
            <span class="dr-t">
              <b>${act.day ? dayLabel(act.day) : 'No date yet'}</b>
              <small>${act.day
                ? `Every sequence here is filmed on this day${
                    offDay ? ` · ${offDay} set to a different one` : ''}`
                : 'Set it once and every sequence here takes it'}</small>
            </span>
            ${ICON.chevR}
          </button>

          ${seqs.length && window.ShotBoard ? `<div class="sb-head" style="margin:0 0 4px"><small style="color:var(--muted);font-size:12.5px">Shots as</small>${ShotBoard.switchHTML(ShotBoard.view())}${ShotBoard.view() === 'board' && window.ShotList && ShotList.motionBtn && seqs.some(b => (b.shots || []).some(x => x && x.item)) ? `<span style="margin-left:auto">${ShotList.motionBtn()}</span>` : ''}</div>` : ''}
          ${window.ShotBoard && ShotBoard.view() === 'board' && seqs.length ? `
          <!-- v4: the Storyboard reads across: one column per sequence, the
               day's beginning, middle and end side by side, each one's shots
               running down it like a shot list -->
          <div class="dcols">${seqs.map((b, k) => {
            const sh = b.shots || [];
            const all = sh.length > 0 && sh.every(s => s.done);
            const pos = seqs.length < 2 ? '' : k === 0 ? 'Beginning' : k === seqs.length - 1 ? 'End' : 'Middle';
            return `<section class="dcol${all ? ' all' : ''}">
              <div class="dc-h">
                ${pos ? `<span class="dc-pos">${k + 1} · ${pos}</span>` : ''}
                <button class="dc-t" data-seq="${b.id}" title="Open the sequence"><b>${esc(b.title)}</b></button>
                <div class="dc-meta">${timeChip(b)}${setupTag(b)}<small data-count="${b.id}">${countLine(b)}</small></div>
                <div class="dc-acts">${sh.length ? `<button class="dc-shoot" data-shootseq="${b.id}">▶ Shoot it</button>` : ''}
                  <button data-moveto="${b.id}">Move</button>${sh.length ? `<button data-keep="${b.id}">Save as template</button>` : ''}</div>
              </div>
              <div class="sc-host" data-host="${b.id}"></div>
            </section>`;
          }).join('')}</div>` : seqs.map(b => {
            const sh = b.shots || [];
            const done = sh.filter(s => s.done).length;
            const fr = sh.filter(s => s.item).length;
            const all = sh.length > 0 && done === sh.length;
            const open = isOpen(b);
            /* v4: each sequence opens right here into the task's Steps + Shot
               page, so the day's shots are planned inside the day; the others
               stay folded to one line */
            return `
              <article class="seqcard${all ? ' all' : ''}${open ? ' open' : ''}">
                <div class="sc-row">
                  <button class="sc-head" data-seqfold="${b.id}" aria-expanded="${open}">
                    <span class="sc-cv">${open ? DOWN : ICON.chevR}</span>
                    <span class="t">
                      <b>${esc(b.title)}</b>
                      ${setupTag(b)}
                      <small data-count="${b.id}">${countLine(b)}</small></span>
                  </button>
                  ${timeChip(b)}
                  ${sh.length ? `<button class="sc-shoot" data-shootseq="${b.id}">▶ Shoot it</button>` : ''}
                </div>
                ${open ? `<div class="sc-host" data-host="${b.id}" data-selectable="1"></div>` : ''}
                <div class="sc-foot">
                  <button data-seq="${b.id}">Open the sequence</button>
                  <button data-moveto="${b.id}">Move to another day</button>
                  ${sh.length ? `<button data-keep="${b.id}">Save as a template</button>` : ''}
                </div>
              </article>`;
          }).join('')}

          ${(() => {
            /* Everything on this day, onto your task list, in one press — the
               point of planning a day is to be able to work it on the day. */
            const items = seqs.map(b => ({ act, beat:b }));
            const c = VlogTasks.counts(items);
            if(!c.total) return '';
            return `<div class="daytasks">
              <span class="dt-t"><b>${c.onTasks} of ${c.total} on your days</b>
                <small>${c.scheduled < c.total
                  ? `${c.total - c.scheduled} still need a date`
                  : 'Every sequence here has a date'}</small></span>
              <button class="btn-sm${c.onTasks < c.scheduled ? ' accent' : ''}"
                data-a="totasks">Add to my tasks</button>
            </div>`;
          })()}

          <button class="btn-primary" data-a="add" style="width:100%;margin:14px 0 0">
            Add a sequence to ${esc(act.title)}</button>
          <p class="note">A sequence is one thing you film — name it for what it is,
            not for the day it sits on.</p>
        </div>`;
      ShotList.fillPics(el);
      if(!document.getElementById('seq-css')){ const st = document.createElement('style'); st.id = 'seq-css'; st.textContent = SEQ_CSS; document.head.appendChild(st); }
      el.querySelectorAll('[data-host]').forEach(c => {
        const id = c.dataset.host;
        /* v4: the day's sequences as a Storyboard, when that's the view (shotboard.js) */
        if(window.ShotBoard && ShotBoard.view() === 'board') return ShotBoard.mount(c, ShotList.board('beat:' + v.id + ':' + id), { narrow:true, motion:false, onChange: async () => {
          await load(); const b = ((act && act.beats) || []).find(x => x.id === id);
          const line = b && el.querySelector(`[data-count="${id}"]`); if(line) line.textContent = countLine(b); } });
        ShotList.embed(c, ShotList.hostBeat(v.id, id), async () => {
          /* keep this screen's copy fresh, so its own saves don't undo the steps */
          await load();
          const b = ((act && act.beats) || []).find(x => x.id === id);
          const line = b && el.querySelector(`[data-count="${id}"]`);
          if(line) line.textContent = countLine(b);
        });
      });
    }

    /* A template is a named sequence with its shots already in it — the same
       block comes back every week, and typing it out each time is the tax that
       makes weekly planning expensive. */
    async function addSheet(){
      const templates = await SeqLib.all();
      /* v4: the Library's shot templates too — their shots come with frames */
      let shotTpls = [];
      try { shotTpls = (await ShotTemplates.all()).filter(t => (t.shots || []).length); } catch(e){ shotTpls = []; }

      App.sheet(`
        <h2 style="margin:0 0 3px">Add to ${esc(act.title)}</h2>
        <p class="hintline" style="margin:0 0 14px">Start from a template, or an empty one
          you name yourself.</p>

        <div class="group compact" style="margin:0 0 12px;max-height:46vh;overflow-y:auto">
          ${templates.map(t => `
            <button class="row" data-tpl="${t.id}">
              <span class="lbl">${esc(t.name)}
                <small>${(t.shots || []).length} shot${(t.shots || []).length === 1 ? '' : 's'}${
                  (window.Quarters && Quarters.setupOf) ? ' · ' + Quarters.setupOf(t.setup || 'talking').label : ''}</small></span>
              ${ICON.chevR}
            </button>`).join('')}
        </div>

        ${shotTpls.length ? `<h3 class="pgh" style="margin:4px 0 6px">Shot templates — with frames</h3>
        <div class="group compact" style="margin:0 0 12px;max-height:30vh;overflow-y:auto">
          ${shotTpls.map(t => `
            <button class="row" data-stpl="${t.id}">
              <span class="lbl">${esc(t.name)}
                <small>${t.shots.length} shot${t.shots.length === 1 ? '' : 's'} · ${t.shots.filter(x => x.item).length} with frames</small></span>
              ${ICON.chevR}
            </button>`).join('')}
        </div>` : ''}

        <button class="btn-ghost" data-manage style="width:100%;margin:0 0 10px">
          Edit these templates</button>

        <div class="sheetcta">
          <button class="btn-ghost" data-blank>Empty sequence</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheet => {
        sheet.addEventListener('click', async ev => {
          if(ev.target.closest('[data-cancel]')) return App.closeSheet();

          if(ev.target.closest('[data-manage]')){
            App.closeSheet();
            return Screens.push('seq-templates', { onChange:() => {} });
          }

          if(ev.target.closest('[data-blank]')){
            const b = { id:uid('b'), title:`Sequence ${(act.beats || []).length + 1}`,
                        purpose:'', setup:'talking', script:'', sourceId:null, shots:[],
                        day:act.day ?? null, at:null, done:false, clipId:null };
            act.beats.push(b);
            await save();
            App.closeSheet();
            return Screens.push('vlog-beat', { vlogId:v.id, beatId:b.id,
              onChange:async () => { await load(); render(); } });
          }

          const st = ev.target.closest('[data-stpl]');
          if(st){
            const t = shotTpls.find(x => x.id === st.dataset.stpl);
            if(!t) return;
            act.beats.push({ id:uid('b'), title:t.name, purpose:t.description || '', setup:'talking', script:'', sourceId:null,
              shots:t.shots.map(ShotList.fromTplShot), day:act.day ?? null, at:null, done:false, clipId:null });
            await save();
            App.closeSheet();
            await load(); render();
            return U.toast(`${t.name} · ${t.shots.length} shots`);
          }

          const pick = ev.target.closest('[data-tpl]');
          if(!pick) return;
          const t = await SeqLib.get(pick.dataset.tpl);
          if(!t) return;
          /* the day's date, so it is scheduled the moment it lands */
          act.beats.push(SeqLib.toSequence(t, act.day));
          await save();
          App.closeSheet();
          await load(); render();
          U.toast(`${t.name} · ${(t.shots || []).length} shots`);
        });
      });
    }

    /* hold a sequence to pick several and remove them from this day */
    if(window.Select) Select.enable(el, {
      itemSelector: '.seqcard',
      noun: 'sequence',
      idOf: n => {
        const head = n.querySelector('[data-seq]');
        return head ? head.dataset.seq : null;
      },
      warning: 'Their shots go with them. Any task already on your days is removed too.',
      onDelete: async ids => {
        for(const id of ids){
          const b = (act.beats || []).find(x => x.id === id);
          if(b && b.taskId){
            try { await Store.del('tasks', b.taskId); } catch(err){}
          }
        }
        act.beats = (act.beats || []).filter(x => !ids.includes(x.id));
        await save();
        try { Data.invalidate && Data.invalidate('tasks'); } catch(err){}
      },
      onDone: async () => { await load(); render(); }
    });

    el.addEventListener('click', async e => {
      /* the Steps + Shot page block handles its own taps (screens/task.js) */
      if(e.target.closest && e.target.closest('.tk-host')) return;
      const tm = e.target.closest('[data-seqtime]');
      if(tm){
        const b = (act.beats || []).find(x => x.id === tm.dataset.seqtime);
        if(!b) return;
        App.sheet(`<h2 style="margin:0 0 4px">When do you shoot ${esc(b.title)}?</h2>
          <p class="hintline" style="margin:0 0 12px">${b.day ? esc(dayLabel(b.day)) + ' · ' : ''}Today shows it at this time, and Shoot today goes in time order.</p>
          <input type="time" class="dc-tin" value="${esc(b.at || '')}" aria-label="Time">
          <div class="sheetcta"><button class="btn-primary" data-tok>Set the time</button>${b.at ? '<button class="btn-ghost" data-toff>No time</button>' : ''}<button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
          const f = sh.querySelector('.dc-tin'); setTimeout(() => { try { f.focus(); } catch(err){} }, 50);
          sh.addEventListener('click', async ev => {
            if(ev.target.closest('[data-no]')) return App.closeSheet();
            const off = ev.target.closest('[data-toff]'), okb = ev.target.closest('[data-tok]');
            if(!off && !okb) return;
            const val = off ? null : (f.value || null);
            b.at = val;
            await save();
            /* the shoot task on your days moves with it */
            if(b.taskId){ try { const t = await Store.get('tasks', b.taskId); if(t){ t.at = val; await Store.put('tasks', t); if(window.Data && Data.invalidate) Data.invalidate('tasks'); } } catch(err){} }
            App.closeSheet(); render();
            U.toast(val ? `${b.title} · ${fmtT(val)}` : `${b.title} · no set time`);
          });
        });
        return;
      }
      /* v4: Steps | Storyboard for every sequence on the day */
      const sbv = e.target.closest('.sb-switch [data-sbv]');
      if(sbv){ if(sbv.getAttribute('aria-selected') !== 'true'){ ShotBoard.setView(sbv.dataset.sbv); render(); } return; }
      /* ticking a shot must win over opening the sequence it sits in */
      const sh = e.target.closest('[data-shot]');
      if(sh){
        const [seqId, shotId] = sh.dataset.shot.split(':');
        const b = (act.beats || []).find(x => x.id === seqId);
        const shot = b && (b.shots || []).find(x => x.id === shotId);
        if(!shot) return;
        shot.done = !shot.done;
        /* the sequence is captured once every shot in it is */
        if((b.shots || []).every(x => x.done)) b.done = true;
        else b.done = false;
        await save();
        return render();
      }

      /* Picking the day from a list beats dragging a dozen cards around. */
      /* v4: the one shoot mode — one shot at a time, full screen */
      /* shoot it: on its task when it's on your days (the ticks land there),
         otherwise over the sequence's own shots */
      const ss = e.target.closest('[data-shootseq]');
      if(ss){
        const b = (act.beats || []).find(x => x.id === ss.dataset.shootseq);
        if(!b) return;
        const after = async () => { await load(); render(); };
        const task = b.taskId ? await Store.get('tasks', b.taskId).catch(() => null) : null;
        if(task) return Screens.push('shoot-run', { id:task.id, onChange:after });
        return Screens.push('shoot-run', { host:ShotList.hostBeat(v.id, b.id), onChange:after });
      }
      const mv = e.target.closest('[data-moveto]');
      if(mv){
        const b = (act.beats || []).find(x => x.id === mv.dataset.moveto);
        if(!b) return;

        App.sheet(`
          <h2 style="margin:0 0 3px">${esc(b.title)}</h2>
          <p class="hintline" style="margin:0 0 14px">Which day are you filming this?</p>
          <div class="group compact" style="margin:0 0 14px;max-height:48vh;overflow-y:auto">
            ${(v.acts || []).map(a => `
              <button class="row" data-to="${a.id}">
                <span class="lbl">${esc(a.title)}
                  <small>${(a.beats || []).length} sequence${
                    (a.beats || []).length === 1 ? '' : 's'}${
                    a.id === act.id ? ' · where it is now' : ''}</small></span>
                ${a.id === act.id ? '<span class="tg">here</span>' : ICON.chevR}
              </button>`).join('')}
          </div>
          <div class="sheetcta"><button class="btn-ghost" data-cancel>Cancel</button></div>`,
        sheet => {
          sheet.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            const to = ev.target.closest('[data-to]');
            if(!to) return;
            const target = (v.acts || []).find(a => a.id === to.dataset.to);
            if(!target || target.id === act.id) return App.closeSheet();

            act.beats = act.beats.filter(x => x.id !== b.id);
            b.day = target.day ?? b.day ?? null;
            target.beats.push(b);

            await save();
            App.closeSheet();
            U.toast(`Moved to ${target.title}`);
            await load(); render();
          });
        });
        return;
      }

      const fo = e.target.closest('[data-seqfold]');
      if(fo){
        isOpen({ id:'' });
        const id = fo.dataset.seqfold;
        if(opened.has(id)) opened.delete(id); else opened.add(id);
        return render();
      }

      const open = e.target.closest('[data-seq]');
      if(open){
        return Screens.push('vlog-beat', { vlogId:v.id, beatId:open.dataset.seq,
          onChange:async () => { await load(); render(); } });
      }

      if(e.target.closest('[data-a="setdate"]')){
        const field = await U.dayField('dd', act.day ?? today);
        /* taking a date off has to take its tasks with it, or you are left with
           shoot tasks on a day nothing is scheduled for any more */
        const onTasks = (act.beats || []).filter(b => b.taskId).length;
        App.sheet(`
          <h2 style="margin:0 0 3px">${esc(act.title)}</h2>
          <p class="hintline" style="margin:0 0 14px">The day you are filming these.
            All ${(act.beats || []).length} sequence${
              (act.beats || []).length === 1 ? '' : 's'} here take it.</p>
          ${field}
          <div class="field"><label for="dda">Time <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
            <input id="dda" type="time" value="${(act.beats || []).find(b => b.at)
              ? (act.beats || []).find(b => b.at).at : ''}"></div>
          <div class="sheetcta">
            <button class="btn-primary" data-save>Set the day</button>
            <button class="btn-ghost" data-cancel>Cancel</button>
          </div>
          ${act.day != null ? `<button class="btn-ghost" data-clear
            style="width:100%;margin:12px 0 0;color:var(--red);border-color:rgba(226,86,74,.45)">
            Take the date off</button>
          <p class="note">They go back to "no day yet" and leave the shoot days.${
            onTasks ? ` The ${onTasks} already on your task list ${
              onTasks === 1 ? 'is' : 'are'} removed too.` : ''}</p>` : ''}`, sheet => {
          U.wireDayField(sheet, 'dd');
          sheet.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();

            if(ev.target.closest('[data-clear]')){
              let removed = 0;
              for(const b of (act.beats || [])){
                if(b.taskId){
                  try { await Store.del('tasks', b.taskId); removed++; } catch(e){}
                  b.taskId = null;
                }
                b.day = null; b.at = null;
              }
              act.day = null;
              await save();
              try { Data.invalidate && Data.invalidate('tasks'); } catch(e){}
              App.closeSheet();
              U.toast(removed ? `Date cleared · ${removed} task${removed === 1 ? '' : 's'} removed`
                              : 'Date cleared');
              await load(); render();
              return;
            }

            if(!ev.target.closest('[data-save]')) return;

            const n = await U.readDayField(sheet, 'dd');
            if(!n) return U.toast('Pick a date');
            const at = sheet.querySelector('#dda').value || null;

            act.day = n;
            (act.beats || []).forEach(b => { b.day = n; if(at) b.at = at; });

            /* anything already on your task list moves with it, rather than
               sitting on the day you changed your mind about */
            let moved = 0;
            for(const b of (act.beats || [])){
              if(!b.taskId) continue;
              try {
                const map = await Store.allMap('tasks');
                const t = map[b.taskId];
                if(t){ t.day = n; if(at) t.at = at; await Store.put('tasks', t); moved++; }
              } catch(e){}
            }
            if(moved){ try { Data.invalidate && Data.invalidate('tasks'); } catch(e){} }

            await save();
            App.closeSheet();
            U.toast(`${act.title} · ${dayLabel(n)}`);
            await load(); render();
          });
        });
        return;
      }

      if(e.target.closest('[data-a="totasks"]')){
        return VlogTasks.sheet(v, { scope: act.id, dayLabel,
          onDone: async () => { await load(); render(); } });
      }

      if(e.target.closest('[data-a="add"]')) return addSheet();

      /* keep one you have built, for next week */
      const keep = e.target.closest('[data-keep]');
      if(keep){
        const b = (act.beats || []).find(x => x.id === keep.dataset.keep);
        if(!b) return;
        await SeqLib.save(SeqLib.fromSequence(b));
        return U.toast(`"${b.title}" saved as a template`);
      }
    });

    await load();
    render();
  }

  Screens.register('vlog-day', mount);
})();
