/* One day of an episode.

   A day is a container — Monday is not something you can shoot. It holds the
   sequences: "Roller skating intro", "Working in the yard transition". Each of
   those holds the shots. This is the screen you open on the day itself, so the
   only thing in front of you is what you are filming today. */
(function(){
  const { ICON } = U;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

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

      el.innerHTML = Screens.bar({ kicker:v.title || 'Episode', title:act.title }) + `
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

          ${seqs.map(b => {
            const sh = b.shots || [];
            const done = sh.filter(s => s.done).length;
            const all = sh.length > 0 && done === sh.length;
            return `
              <article class="seqcard${all ? ' all' : ''}">
                <button class="sc-head" data-seq="${b.id}">
                  <span class="dot" style="background:${b.day != null ? 'var(--orange)' : 'var(--dim)'}"></span>
                  <span class="t">
                    <b>${esc(b.title)}</b>
                    ${setupTag(b)}
                    <small>${[
                      b.day ? dayLabel(b.day) : 'no day yet',
                      b.script ? 'scripted' : ''
                    ].filter(Boolean).join(' · ')}</small></span>
                  ${ICON.chevR}
                </button>

                ${sh.length ? `
                  <details class="seqshots"${done && !all ? ' open' : ''}>
                    <summary>
                      <span class="sq-n">${done}/${sh.length} shots</span>
                      <span class="sq-go">${ICON.chevR}</span>
                    </summary>
                    <div class="sq-list">
                      ${sh.map(s => `<div class="shotline${s.done ? ' done' : ''}"
                        data-shot="${b.id}:${s.id}">
                        <span class="bx">${ICON.check}</span>
                        <span class="tx">${esc(s.text)}</span>
                        ${s.framing ? `<span class="tag">${esc(s.framing)}</span>` : ''}
                      </div>`).join('')}
                    </div>
                  </details>`
                  : `<p class="sc-none">No shots listed yet — open it to add them.</p>`}
                <div class="sc-foot">
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
    }

    /* A template is a named sequence with its shots already in it — the same
       block comes back every week, and typing it out each time is the tax that
       makes weekly planning expensive. */
    async function addSheet(){
      const templates = await SeqLib.all();

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
