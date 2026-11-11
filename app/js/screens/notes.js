/* Notes — the pile, with the unfiled ones put in front of you first. */
(function(){

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  const AGO = ts => {
    const d = Math.floor((Date.now() - (ts || 0)) / 86400000);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
  };

  /* The journal was its own tile, which put two kinds of writing in two places.
     It is a section here now: same screen, hosted, sharing the page. */
  async function mountHost(el, params){
    const embedded = !!(params && params.embedded);
    let section = (params && params.section) || 'notes';

    /* The tabs cannot sit in their own .view: a .view is flex:1 and scrolls, so
       two of them stacked fight for the height and one collapses. They sit in a
       fixed strip above the host, using the same control as Clips. */
    function shell(){
      el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Creator studio',
        title: section === 'journal' ? 'Journal' : 'Notes' })) + `
        <div class="sectabs">
          <div class="segmented" role="tablist">
            <button role="tab" data-sec="notes"
              aria-selected="${section === 'notes'}">Notes</button>
            <button role="tab" data-sec="journal"
              aria-selected="${section === 'journal'}">Journal</button>
          </div>
        </div>
        <div id="notesHost"></div>`;
    }

    async function show(){
      shell();
      const host = el.querySelector('#notesHost');
      if(section === 'journal'){
        const ok = Screens.mountInto
          ? Screens.mountInto('journal', host, { embedded:true })
          : null;
        if(!ok) host.innerHTML = '<div class="view"><div class="empty">' +
          '<b>Not available</b>The journal could not be opened.</div></div>';
        return;
      }
      await mount(host, { embedded:true });
    }

    if(!el.dataset.wiredNotesHost){
      el.dataset.wiredNotesHost = '1';
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-sec]');
        if(!b || b.dataset.sec === section) return;
        section = b.dataset.sec;
        show();
      });
    }
    await show();
  }

  async function mount(el, params){
    const embedded = !!(params && params.embedded);
    let list = [], areas = [], filter = 'all', today = 1;

    async function load(){
      list = await Notes.all();
      areas = await Notes.areas();
      try { today = await Data.currentDay(); } catch(e){ today = 1; }
    }

    function row(n){
      const a = Notes.areaOf(areas, n.area);
      const inked = n.ink && window.InkPad && !InkPad.isEmpty(n.ink);
      const first = String(n.text || '').split('\n')[0] || (inked ? 'Handwritten note' : '(no text)');
      const more = String(n.text || '').split('\n').length > 1;
      return `
        <button class="noterow${n.area ? '' : ' unfiled'}" data-open="${n.id}">
          <span class="dot" style="background:${a ? a.c : 'var(--dim)'}"></span>
          <span class="t">
            <b>${esc(first)}</b>
            <small>${a ? a.label : 'Unfiled'} · ${AGO(n.createdAt)}${more ? ' · more' : ''}</small>
            ${(n.tags || []).length ? `<span class="tg">${
              n.tags.map(t => `<i>#${esc(t)}</i>`).join('')}</span>` : ''}
            ${inked ? `<canvas class="ink-thumb" data-ink="${n.id}"></canvas>` : ''}
          </span>
          ${U.ICON.chevR}
        </button>`;
    }

    function render(){
      const n = Notes.counts(list, areas);
      const tags = Notes.tagsOf(list);
      const shown = filter === 'all' ? list
        : filter === 'unfiled' ? list.filter(x => !x.area)
        : filter.startsWith('#') ? list.filter(x => (x.tags || []).includes(filter.slice(1)))
        : list.filter(x => x.area === filter);

      const unfiled = list.filter(x => !x.area);

      /* Both actions live in the page head rather than the screen bar, so they
         are still there when this is hosted inside another screen. */
      el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Creator studio', title:'Notes' })) + `
        <div class="view">
          <div class="pagehead"><h1 class="page-title">Notes</h1>
            <span class="headacts" style="display:flex;gap:8px;align-items:center">
              <button class="headbtn" data-a="areas">AREAS</button>
              <button class="headbtn" data-a="write" aria-label="Write a note by hand" title="Write by hand"
                style="padding:0 10px"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/></svg></button>
              <button class="headbtn" data-a="capture">CAPTURE</button>
            </span></div>

          ${unfiled.length && filter === 'all' ? `<div class="notehint">
            <b>${unfiled.length} unfiled</b>
            Tap one to say which part of your life it belongs to.</div>` : ''}

          <div class="vidfilters">
            <button class="opt" data-f="all" aria-pressed="${filter === 'all'}">All ${n.all}</button>
            <button class="opt" data-f="unfiled" aria-pressed="${filter === 'unfiled'}">Unfiled ${n.unfiled}</button>
            ${areas.map(a => `<button class="opt" data-f="${a.k}" aria-pressed="${filter === a.k}"
              style="${filter === a.k ? `background:${a.c};border-color:${a.c};color:#151515` : ''}"
              >${a.label} ${n[a.k] || 0}</button>`).join('')}
            ${tags.map(t => `<button class="opt" data-f="#${t}"
              aria-pressed="${filter === '#' + t}">#${esc(t)}</button>`).join('')}
          </div>

          <div class="sec"><h2>${filter === 'all' ? 'Everything'
            : filter === 'unfiled' ? 'Unfiled'
            : filter.startsWith('#') ? filter
            : (Notes.areaOf(areas, filter) || {}).label}</h2>
            <div class="rule"></div><span class="alt">${shown.length}</span></div>

          ${shown.length ? shown.map(row).join('')
            : `<div class="empty"><b>${list.length ? 'Nothing here' : 'No notes yet'}</b>
                ${list.length ? 'Nothing matches that filter.'
                  : 'Catch a thought with Quick capture and it lands here waiting to be filed.'}</div>`}
        </div>`;
      /* handwritten notes: a small picture of the page */
      el.querySelectorAll('canvas[data-ink]').forEach(cv => {
        const n2 = list.find(x => x.id === cv.dataset.ink);
        if(n2 && n2.ink) InkPad.preview(cv, n2.ink, 220);
      });
    }

    /* ---------- one note ---------- */

    function open(note){
      const r = { ...note, tags: note.tags || [] };

      App.sheet(`
        <h2 style="margin:0 0 14px">Note</h2>
        ${r.ink && !InkPad.isEmpty(r.ink) ? `<button type="button" class="ink-open" data-ink-open>
            <canvas class="ink-thumb big" data-ink-sheet></canvas><span>Open the handwriting</span></button>` : ''}
        <textarea id="nt-x" class="pgtext" rows="4">${esc(r.text)}</textarea>

        <h3 class="pgh">Which part of your life?</h3>
        <div class="pgchips" data-group="area">
          ${areas.map(a => `<button type="button" data-area="${a.k}"
            aria-pressed="${r.area === a.k}"
            style="${r.area === a.k ? `background:${a.c};border-color:${a.c};color:#151515` : ''}"
            >${a.label}</button>`).join('')}
          <button type="button" data-area="" aria-pressed="${!r.area}">Unfiled</button>
        </div>

        <h3 class="pgh">Description</h3>
        <textarea id="nt-desc" class="pgtext" rows="2"
          placeholder="Anything worth remembering when you get to it."
          >${esc(r.desc || '')}</textarea>

        <h3 class="pgh">Steps</h3>
        <textarea id="nt-s" class="pgtext" rows="3"
          placeholder="Clear the counter&#10;Scrub the grout">${
            esc((r.subs || []).map(x => x.t || x).join('\n'))}</textarea>
        <p class="hintline">One per line. These show as steps on the task card.</p>

        <h3 class="pgh">Tags</h3>
        <input id="nt-g" class="pgname" type="text" value="${esc(r.tags.join(', '))}"
          placeholder="bathroom, weekend" autocomplete="off">

        <h3 class="pgh">Make it a task?</h3>
        <div class="pgchips" data-group="when">
          <button type="button" data-when="today" aria-pressed="false">Today</button>
          <button type="button" data-when="tomorrow" aria-pressed="false">Tomorrow</button>
          <button type="button" data-when="pick" aria-pressed="false">Pick a date</button>
        </div>
        <div id="nt-when"></div>
        <p class="hintline">This is just a day on your list — nothing to do with a program
          plan. Sending it takes the note out of Notes, so the same thing is never in
          two places.</p>

        <div class="sheetcta">
          <button class="btn-primary" data-task disabled>Send it</button>
          <button class="btn-ghost" data-save>Just save</button>
        </div>
        <button class="btn-ghost" data-del
          style="width:100%;margin:12px 0 0;color:var(--red);border-color:rgba(226,86,74,.45)">
          Delete this note</button>`, sheet => {

        const $ = q => sheet.querySelector(q);
        const pull = () => {
          r.text = $('#nt-x').value.trim();
          r.desc = $('#nt-desc').value.trim();
          r.subs = $('#nt-s').value.split('\n').map(x => x.trim()).filter(Boolean)
            .map(t => ({ t, done:false }));
          r.tags = $('#nt-g').value.split(',').map(x => x.trim()).filter(Boolean);
        };

        /* which day it goes on, in program days, since that is what a task uses */
        let chosen = null;
        function armSend(){
          const b = $('[data-task]');
          if(b) b.disabled = chosen === null;
        }
        async function pickWhen(kind){
          sheet.querySelectorAll('[data-when]').forEach(b =>
            b.setAttribute('aria-pressed', String(b.dataset.when === kind)));

          if(kind === 'today'){ chosen = today; $('#nt-when').innerHTML = ''; }
          else if(kind === 'tomorrow'){ chosen = today + 1; $('#nt-when').innerHTML = ''; }
          else {
            chosen = null;
            $('#nt-when').innerHTML = `<div class="pgdatewrap">
              <input id="nt-date" class="pgbar pgdate" type="date"
                min="${new Date().toISOString().slice(0,10)}"></div>`;
            const d = $('#nt-date');
            d.addEventListener('click', () => { if(d.showPicker) try { d.showPicker(); } catch(err){} });
            d.addEventListener('change', async () => {
              if(!d.value) return;
              try { chosen = await Data.dateToDay(new Date(d.value + 'T12:00').getTime()); }
              catch(err){ chosen = today; }
              armSend();
            });
          }
          armSend();
        }

        const inkCv = sheet.querySelector('[data-ink-sheet]');
        if(inkCv) InkPad.preview(inkCv, r.ink, Math.min(520, sheet.clientWidth - 40));
        sheet.addEventListener('click', async e => {
          if(e.target.closest('[data-ink-open]')){
            App.closeSheet();
            return Screens.push('ink-note', { id: r.id, onChange: async () => { await load(); render(); } });
          }
          const wn = e.target.closest('[data-when]');
          if(wn) return pickWhen(wn.dataset.when);
          const a = e.target.closest('[data-area]');
          if(a){
            pull();
            r.area = a.dataset.area || null;
            sheet.querySelectorAll('[data-area]').forEach(b => {
              const on = b === a;
              b.setAttribute('aria-pressed', String(on));
              const ar = Notes.areaOf(areas, b.dataset.area);
              b.setAttribute('style', on && ar
                ? `background:${ar.c};border-color:${ar.c};color:#151515` : '');
            });
            return;
          }

          if(e.target.closest('[data-del]')){
            await Notes.remove(r.id);
            App.closeSheet();
            await load(); render();
            return U.toast('Deleted');
          }
          if(e.target.closest('[data-save]')){
            pull();
            await Notes.save(r);
            App.closeSheet();
            await load(); render();
            return U.toast('Saved');
          }
          if(!e.target.closest('[data-task]')) return;

          if(chosen === null) return;
          pull();
          await Notes.save(r);
          await Notes.toTask(r, chosen);
          App.closeSheet();
          await load(); render();
          U.toast(chosen === today ? 'On today'
            : chosen === today + 1 ? 'On tomorrow' : `On day ${chosen}`);
        });
      });
    }

    /* ---------- the areas themselves ---------- */

    function editAreas(){
      App.sheet(`
        <h2 style="margin:0 0 6px">Parts of your life</h2>
        <p class="hintline" style="margin:0 0 14px">These are yours. One per line — a note
          keeps its area even if you rename the rest.</p>
        <textarea id="ar-x" class="pgtext" rows="7">${areas.map(a => a.label).join('\n')}</textarea>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheet => {
        sheet.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(!e.target.closest('[data-save]')) return;
          const names = sheet.querySelector('#ar-x').value
            .split('\n').map(x => x.trim()).filter(Boolean);
          const palette = ['#E8A33D','#3B9EFF','#FB6900','#A855F7','#5BBE6A','#22C7B8','#E2564A','#9AA0A6'];
          const next = names.map((label, i) => {
            const existing = areas.find(a => a.label.toLowerCase() === label.toLowerCase());
            return existing || { k:label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                                 label, c:palette[i % palette.length] };
          });
          await Notes.saveAreas(next);
          App.closeSheet();
          await load(); render();
        });
      });
    }

    el.addEventListener('click', async e => {
      const f = e.target.closest('[data-f]');
      if(f){ filter = f.dataset.f; return render(); }

      const act = e.target.closest('[data-a]');
      if(act && act.dataset.a === 'areas') return editAreas();
      /* a handwritten note (Creator Studio 3) */
      if(act && act.dataset.a === 'write')
        return Screens.push('ink-note', { onChange: async () => { await load(); render(); } });
      if(act && act.dataset.a === 'capture')
        return Screens.push('quick-capture', { onChange: async () => { await load(); render(); } });

      const o = e.target.closest('[data-open]');
      if(o){
        const n = list.find(x => x.id === o.dataset.open);
        if(n) open(n);
      }
    });

    await load();
    render();
  }

  /* 'notes' is the host with both sections; 'notes-list' is the list alone. */
  Screens.register('notes', mountHost);
  Screens.register('notes-list', mount);
})();
