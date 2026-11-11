/* The video sheet, on its own.

   It used to live inside the Videos board, which meant a series could link to a
   video but never open one. Same sheet, called from either place — one editor,
   so the two can never drift apart. */
(function(global){

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  async function open(v, opts){
    const o = opts || {};
    const done = o.onDone || (async () => {});

    let today = 1, chans = [], runs = [];
    try { today = await Data.currentDay(); } catch(e){ today = 1; }
    try { chans = await Channels.all(); } catch(e){ chans = []; }
    try { runs = await Data.series(); } catch(e){ runs = []; }

    const isNew = !v.id;
    const r = { ...Videos.blank(), ...v };
    /* opened from a series, it belongs to that series before you type anything */
    if(o.seriesId && !r.seriesId) r.seriesId = o.seriesId;

    /* A series runs on one channel, so a video in a series takes the series'
       channel rather than being asked again — two answers to the same question
       can only ever disagree. */
    const seriesOf = id => runs.find(x => x.id === id) || null;
    const channelFor = id => { const sr = seriesOf(id); return sr ? (sr.channel || '') : null; };

    App.sheet(`
      <h2 style="margin:0 0 14px">${isNew ? 'New video' : 'Edit video'}</h2>
      <input id="vd-t" class="pgname" type="text" value="${esc(r.title)}"
        placeholder="Bench rebuild — the reveal" autocomplete="off">
      <p class="err" id="vd-err" hidden>Give it a title.</p>

      <h3 class="pgh">Part of a series?</h3>
      <select id="vd-sr" class="pgbar">
        <option value="">A one-off</option>
        ${runs.map(sr => `<option value="${sr.id}" ${r.seriesId === sr.id ? 'selected' : ''}
          >${esc(sr.title)}</option>`).join('')}
      </select>

      <div id="vd-chan"></div>

      <h3 class="pgh">Where is it up to?</h3>
      <div class="pgseg">${Videos.STAGES.slice(0, 3).map(s =>
        `<button type="button" data-st="${s.k}" aria-pressed="${r.stage === s.k}">
          <b>${s.label}</b><small>${s.d}</small></button>`).join('')}</div>
      <div class="pgseg" style="margin:6px 0 0">${Videos.STAGES.slice(3).map(s =>
        `<button type="button" data-st="${s.k}" aria-pressed="${r.stage === s.k}">
          <b>${s.label}</b><small>${s.d}</small></button>`).join('')}</div>

      <h3 class="pgh">The hook</h3>
      <textarea id="vd-h" class="pgtext" rows="2"
        placeholder="What makes someone stay past three seconds.">${esc(r.hook)}</textarea>

      <h3 class="pgh">Shot list</h3>
      <textarea id="vd-s" class="pgtext" rows="4"
        placeholder="Wide of the bench&#10;Hands on the drill&#10;Reveal, slow push in">${esc((r.shots || []).join('\n'))}</textarea>
      <p class="hintline">One per line. These become the steps on the task when you give it a day.</p>

      <h3 class="pgh">Tags</h3>
      <input id="vd-g" class="pgname" type="text" value="${esc((r.tags || []).join(', '))}"
        placeholder="build, tools, long-form" autocomplete="off">

      <h3 class="pgh">Shoot day</h3>
      <div class="pgchips" data-group="when">
        <button type="button" data-when="today" aria-pressed="false">Today</button>
        <button type="button" data-when="tomorrow" aria-pressed="false">Tomorrow</button>
        <button type="button" data-when="pick" aria-pressed="false">Pick a date</button>
        <button type="button" data-when="none" aria-pressed="false">Not yet</button>
      </div>
      <div id="vd-when"></div>
      <p class="hintline" id="vd-read">${r.day
        ? `On your list for day ${r.day}.`
        : 'Not on your days yet.'}</p>

      <div class="sheetcta">
        <button class="btn-primary" data-save>Save</button>
        ${r.taskId ? '<button class="btn-ghost" data-unsched>Take it off my days</button>' : ''}
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>
      ${isNew ? '' : `<button class="btn-ghost" data-del
        style="width:100%;margin:12px 0 0;color:var(--red);border-color:rgba(226,86,74,.45)">
        Delete this video</button>`}`, sheet => {

      const $ = q => sheet.querySelector(q);

      /* the day it is shot, chosen as a date — a program-day counter is
         unreadable once the numbers get large, and the date is the thing you
         actually think in */
      let chosen = r.day ?? null;

      function readBack(){
        const line = $('#vd-read');
        if(!line) return;
        if(!chosen){ line.textContent = 'Not on your days yet.'; return; }
        Promise.resolve(Data.dayToDate(chosen)).then(ts => {
          line.textContent = 'Shooting ' + new Date(ts).toLocaleDateString(undefined,
            { weekday:'long', day:'numeric', month:'long' }) +
            (chosen === today ? ' — today' : chosen === today + 1 ? ' — tomorrow' : '');
        }).catch(() => { line.textContent = `On your list for day ${chosen}.`; });
      }

      async function pickWhen(kind, el2){
        sheet.querySelectorAll('[data-when]').forEach(b =>
          b.setAttribute('aria-pressed', String(b === el2)));

        if(kind === 'today'){ chosen = today; $('#vd-when').innerHTML = ''; }
        else if(kind === 'tomorrow'){ chosen = today + 1; $('#vd-when').innerHTML = ''; }
        else if(kind === 'none'){ chosen = null; $('#vd-when').innerHTML = ''; }
        else {
          let value = '';
          if(chosen){
            try { value = new Date(await Data.dayToDate(chosen)).toISOString().slice(0,10); }
            catch(e){ value = ''; }
          }
          $('#vd-when').innerHTML = `<div class="pgdatewrap">
            <input id="vd-date" class="pgbar pgdate" type="date" value="${value}"></div>`;
          const d = $('#vd-date');
          d.addEventListener('click', () => { if(d.showPicker) try { d.showPicker(); } catch(err){} });
          d.addEventListener('change', async () => {
            if(!d.value) return;
            try { chosen = await Data.dateToDay(new Date(d.value + 'T12:00').getTime()); }
            catch(err){ chosen = today; }
            readBack();
          });
        }
        readBack();
      }

      /* the channel question only exists for a one-off */
      function paintChannel(){
        const host = $('#vd-chan');
        if(!host) return;
        const fromSeries = channelFor(r.seriesId);

        if(r.seriesId){
          host.innerHTML = `<p class="hintline" style="margin:10px 0 0">
            ${fromSeries
              ? `Goes out on <b style="color:var(--cream)">${esc(fromSeries)}</b>, from the series.`
              : 'That series has no channel set yet — set it on the series and this follows.'}</p>`;
          return;
        }
        host.innerHTML = `
          <h3 class="pgh">Which channel?</h3>
          <select id="vd-c" class="pgbar">
            <option value="">No channel yet</option>
            ${chans.map(c => `<option value="${esc(c.n)}" ${r.channel === c.n ? 'selected' : ''}
              >${esc(c.n)}</option>`).join('')}
          </select>`;
      }
      paintChannel();

      sheet.addEventListener('change', e => {
        if(e.target.id !== 'vd-sr') return;
        r.seriesId = e.target.value || null;
        paintChannel();
      });

      function pull(){
        r.title = $('#vd-t').value.trim();
        r.seriesId = $('#vd-sr').value || null;
        /* in a series it follows the series; on its own it is whatever you picked */
        const inherited = channelFor(r.seriesId);
        r.channel = r.seriesId
          ? (inherited || '')
          : ($('#vd-c') ? $('#vd-c').value : r.channel);
        r.hook = $('#vd-h').value.trim();
        r.shots = $('#vd-s').value.split('\n').map(x => x.trim()).filter(Boolean);
        r.tags = $('#vd-g').value.split(',').map(x => x.trim()).filter(Boolean);
        r.day = chosen;
      }
      readBack();

      sheet.addEventListener('click', async e => {
        const wn = e.target.closest('[data-when]');
        if(wn) return pickWhen(wn.dataset.when, wn);
        const st = e.target.closest('[data-st]');
        if(st){
          r.stage = st.dataset.st;
          sheet.querySelectorAll('[data-st]').forEach(b =>
            b.setAttribute('aria-pressed', String(b === st)));
          return;
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();

        if(e.target.closest('[data-del]')){
          await Videos.remove(r.id);
          App.closeSheet();
          await done();
          return U.toast('Deleted');
        }
        if(e.target.closest('[data-unsched]')){
          pull();
          await Videos.unschedule(r);
          App.closeSheet();
          await done();
          return U.toast('Off your days');
        }
        if(!e.target.closest('[data-save]')) return;

        pull();
        if(!r.title){ $('#vd-err').hidden = false; return; }
        const saved = await Videos.save(r);
        /* no day chosen means it stays unplanned rather than landing on today */
        if(chosen) await Videos.schedule(saved, chosen);
        else if(saved.taskId) await Videos.unschedule(saved);
        App.closeSheet();
        await done();
        U.toast(chosen ? `${saved.title} — scheduled` : `${saved.title} — saved`);
      });

      setTimeout(() => { const f = $('#vd-t'); if(f) f.focus(); }, 180);
    });
  }


  global.VideoSheet = { open };
})(window);
