/* Months — the list of challenge months, and a month's own page.

   Hosted under the Calendar tab (views/month.js) as its Months section. A month
   is whole weeks, Sunday to Saturday; the form snaps whatever date you pick to
   the right weekday and shows you the result before you save. */
(function(){

  const esc = t => String(t == null ? '' : t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const CSS = `
  .mo-list{display:flex;flex-direction:column;gap:10px}
  .rs-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 4px}
  .rs-chips button{padding:7px 11px;border:1px solid var(--line);border-radius:999px;background:none;
    color:var(--muted);font-size:13px;cursor:pointer}
  .rs-chips button[aria-pressed="true"]{background:var(--cream);border-color:var(--cream);color:#151515;font-weight:700}
  .ep5-hab{display:flex;align-items:center;gap:10px;padding:8px 11px;margin:0 0 6px;border:1px solid var(--line);
    border-radius:var(--r);background:var(--surface-2)}
  .ep5-hab .lb{flex:1;font-size:14.5px}
  .ep5-hab .dots{display:flex;gap:3px}
  .ep5-hab .dots i{width:9px;height:9px;border-radius:2px;background:var(--line)}
  .ep5-hab .dots i.on{background:var(--orange)}
  .ep5-hab button{width:32px;height:32px;border:1px solid var(--line);border-radius:var(--r);background:none;
    color:var(--cream);font-size:18px;cursor:pointer}
  .ep5-hab b{width:34px;text-align:center;font-size:15px}
  .mo-card{display:block;width:100%;text-align:left;cursor:pointer;padding:14px 15px 13px;
    border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);color:var(--cream)}
  .mo-card .top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
  .mo-card .nm{font-family:var(--display),sans-serif;font-weight:900;font-size:21px;line-height:1.15}
  .mo-card .q{margin-top:3px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .mo-card .ch{margin:9px 0 10px;font-size:15px;line-height:1.45}
  .mo-card .ch.empty{color:var(--dim)}
  .mo-card .meta{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:var(--muted)}
  .mo-card .meta b{color:var(--cream);font-weight:700}
  .mo-res{flex:0 0 auto;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
    padding:5px 9px;border-radius:4px;border:1px solid var(--line);color:var(--muted)}
  .mo-res.W{background:var(--green);border-color:var(--green);color:#151515}
  .mo-res.L{background:var(--red);border-color:var(--red);color:#151515}
  .mo-res.now{border-color:var(--orange);color:var(--orange)}
  .mo-prev{margin:-4px 0 14px;padding:10px 12px;border:1px dashed var(--line);border-radius:var(--r);
    font-size:13.5px;line-height:1.5;color:var(--muted)}
  .mo-prev b{color:var(--cream)}
  .mo-prev.warn{border-color:var(--orange);color:var(--orange)}
  .mo-dates{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .mo-head .nm{font-family:var(--display),sans-serif;font-weight:900;font-size:30px;line-height:1.1;margin:0}
  .mo-head .q{margin:6px 0 0;font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .mo-head .ch{margin:12px 0 0;font-size:17px;line-height:1.45}
  .mo-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}
  .mo-facts div{padding:10px 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2)}
  .mo-facts small{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .mo-facts b{display:block;margin-top:3px;font-size:15px}
  .mo-seg{display:flex;gap:6px;margin:14px 0 0}
  .mo-seg button{flex:1;padding:9px 6px;border:1px solid var(--line);border-radius:var(--r);background:none;
    color:var(--muted);font-weight:800;font-size:13px;letter-spacing:.06em;cursor:pointer}
  .mo-seg button[aria-pressed="true"]{background:var(--cream);border-color:var(--cream);color:#151515}
  .mo-seg button.W[aria-pressed="true"]{background:var(--green);border-color:var(--green)}
  .mo-seg button.L[aria-pressed="true"]{background:var(--red);border-color:var(--red)}
  .mo-h{display:flex;align-items:center;gap:10px;margin:24px 0 10px}
  .mo-h span{font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
  .mo-h i{flex:1;height:1px;background:var(--line)}
  .mo-h em{font-style:normal;font-size:12px;color:var(--dim)}
  .mo-stakes{padding:12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2)}
  .mo-stakes label{display:block;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
    color:var(--muted);margin:0 0 6px}
  .mo-stakes input{width:100%;box-sizing:border-box}
  .mo-pen{display:flex;gap:6px;margin:0 0 6px}
  .mo-pen input{flex:1}
  .mo-pen button{flex:0 0 38px;border:1px solid var(--line);border-radius:var(--r);background:none;
    color:var(--muted);font-size:18px;cursor:pointer}
  .mo-ladder{display:flex;flex-direction:column;gap:8px}
  .mo-slot{position:relative;padding:12px 13px;border:1px solid var(--line);border-radius:var(--r);
    background:var(--surface-2)}
  .mo-slot.empty{background:none;border-style:dashed}
  .mo-slot.filled{cursor:pointer}
  .mo-slot .wk{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;
    letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:800}
  .mo-slot .wk .v{color:var(--orange)}
  .mo-slot .t{margin:6px 0 2px;font-size:16.5px;font-weight:700;color:var(--cream)}
  .mo-slot .sk{font-size:14px;color:var(--muted)}
  .mo-slot .row{display:flex;align-items:center;gap:10px;margin-top:9px;font-size:12.5px;color:var(--muted)}
  .mo-slot .bar{flex:1;height:5px;border-radius:3px;background:var(--surface-1);overflow:hidden}
  .mo-slot .bar i{display:block;height:100%;background:var(--green)}
  .mo-slot .acts{display:flex;gap:8px;margin-top:10px}
  .mo-slot .acts button{flex:1}
  .mo-chip{font-size:10.5px;font-weight:800;letter-spacing:.1em;padding:3px 7px;border-radius:3px;
    border:1px solid var(--line);color:var(--muted)}
  .mo-chip.W{background:var(--green);border-color:var(--green);color:#151515}
  .mo-chip.L{background:var(--red);border-color:var(--red);color:#151515}
  .mo-verdict{margin:14px 0 0;padding:12px 14px;border-radius:var(--r);border:1px solid var(--orange);
    font-size:14.5px;line-height:1.5}
  .mo-verdict b{color:var(--orange)}
  /* the Month field on the episode page */
  .epmonth{display:flex;align-items:center;gap:8px;margin:0 0 14px;padding:10px 12px;
    border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2)}
  .epmonth.empty{background:none;border-style:dashed}
  .epmonth .epm-open{flex:1;min-width:0;display:block;text-align:left;padding:0;border:0;background:none;
    color:var(--cream);cursor:pointer}
  .epmonth .k{display:block;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .epmonth b{display:block;margin-top:2px;font-size:15.5px}
  .epmonth small{display:block;margin-top:2px;font-size:12.5px;color:var(--muted);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .epmonth small.warn{color:var(--orange)}
  /* the episode panel: skill, dates, result, verdict, segments, script beats */
  .ep5{margin:0 0 16px}
  .ep5 .epmonth{margin-bottom:10px}
  .ep5-grid{display:grid;grid-template-columns:1fr;gap:8px}
  .ep5-grid label,.ep5-beats label{display:block;font-size:11px;font-weight:800;letter-spacing:.12em;
    text-transform:uppercase;color:var(--muted)}
  .ep5-grid input,.ep5-beats textarea{display:block;width:100%;box-sizing:border-box;margin-top:5px;
    font-size:15px;letter-spacing:0;text-transform:none;font-weight:400}
  .ep5-dates{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 0}
  .ep5-dates > div{padding:9px 11px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2)}
  .ep5-dates small{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .ep5-dates b{display:block;margin-top:3px;font-size:14.5px}
  .ep5-dates input[type=date]{width:100%;box-sizing:border-box;padding:2px 0;border:0;background:none;
    color:var(--cream);font:inherit;font-weight:700}
  .ep5-link{margin-top:4px;padding:0;border:0;background:none;color:var(--orange);font-size:12.5px;cursor:pointer}
  .ep5-h{display:flex;align-items:center;gap:10px;margin:18px 0 8px}
  .ep5-h span{font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
  .ep5-h i{flex:1;height:1px;background:var(--line)}
  .ep5-h em{font-style:normal;font-size:12px;color:var(--dim)}
  .ep5-verdict{display:flex;flex-direction:column;gap:5px;margin:12px 0 0;padding:12px 13px;
    border:1px solid var(--orange);border-radius:var(--r)}
  .ep5-verdict .k{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--orange)}
  .ep5-verdict > b{font-size:16px;line-height:1.4}
  .ep5-verdict small{font-size:13.5px;color:var(--muted);line-height:1.45}
  .ep5-verdict small b{color:var(--cream)}
  .ep5-segs{display:flex;flex-direction:column;gap:5px}
  .ep5-seg{display:flex;align-items:center;gap:10px;width:100%;padding:9px 11px;text-align:left;cursor:pointer;
    border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);color:var(--cream)}
  .ep5-seg .dot{flex:0 0 12px;height:12px;border-radius:50%;border:2px solid var(--dim)}
  .ep5-seg.shot .dot{background:#F59E0B;border-color:#F59E0B}
  .ep5-seg.done .dot{background:var(--green);border-color:var(--green)}
  .ep5-seg .lb{flex:1;font-size:14.5px}
  .ep5-seg.done .lb{color:var(--muted)}
  .ep5-seg .st{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  .ep5-seg.shot .st{color:#F59E0B}
  .ep5-seg.done .st{color:var(--green)}
  .ep5-beats{margin:14px 0 0;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r)}
  .ep5-beats summary{cursor:pointer;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;
    color:var(--muted);display:flex;justify-content:space-between}
  .ep5-beats summary em{font-style:normal;letter-spacing:0;text-transform:none;color:var(--dim);font-weight:400}
  .ep5-beats label{margin-top:12px}
  `;
  function injectCSS(){
    if(document.getElementById('mo-css')) return;
    const st = document.createElement('style');
    st.id = 'mo-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  const RES_LABEL = { W:'Won', L:'Lost' };
  function resultChip(m){
    if(m.result) return `<span class="mo-res ${m.result}">${RES_LABEL[m.result]}</span>`;
    const today = Months.iso(Date.now());
    const running = m.startDate && m.endDate && today >= m.startDate && today <= m.endDate;
    return `<span class="mo-res${running ? ' now' : ''}">${running ? 'Running' : 'Pending'}</span>`;
  }

  /* ---------- the list ---------- */
  async function mountList(el, params){
    injectCSS();
    const embedded = !!(params && params.embedded);

    async function render(){
      const months = await Months.all();
      const rows = [];
      for(const m of months){
        const eps = await Months.linked(m);
        const slots = await Months.weeks(m);
        const filled = slots.filter(sl => eps.some(v => v.week !== null && v.week !== undefined
          && v.week !== '' && +v.week === sl.week)).length;
        rows.push({ m, rec:Months.record(eps), weeks:slots.length, linked:filled });
      }
      const head = Screens.bar({ kicker:'Calendar', title:'Months',
        actions:`<button class="btn-sm" data-a="import">Import plan</button>
                 <button class="btn-sm accent" data-a="new">+ New month</button>` });

      el.innerHTML = (embedded ? '' : head) + `
      <div class="view">
        ${embedded ? `<div class="pagehead"><h1 class="page-title">Months</h1>
          <span class="headacts" style="display:flex;gap:8px;align-items:center">
            <button class="headbtn" data-a="import">IMPORT PLAN</button>
            <button class="headbtn" data-a="new">NEW MONTH</button>
          </span></div>` : ''}
        ${rows.length ? `<div class="mo-list">${rows.map(({ m, rec, weeks, linked }) => `
          <button class="mo-card" data-month="${m.id}">
            <div class="top">
              <div><div class="nm">${esc(m.name) || 'Untitled month'}</div>
                ${m.quarter || m.quarterTheme ? `<div class="q">${esc([m.quarter, m.quarterTheme].filter(Boolean).join(' · '))}</div>` : ''}
              </div>
              ${resultChip(m)}
            </div>
            <p class="ch${m.challenge ? '' : ' empty'}">${esc(m.challenge) || 'No challenge set yet'}</p>
            <div class="meta">
              <span>Record <b>${rec.w}W · ${rec.l}L</b></span>
              <span><b>${linked}</b> of ${weeks} episodes</span>
              <span>${Months.label(m.startDate)} – ${Months.label(m.endDate)}</span>
              ${m.verdictReleaseDate ? `<span>Verdict <b>${Months.label(m.verdictReleaseDate, { weekday:'short', month:'short', day:'numeric' })}</b></span>` : ''}
            </div>
          </button>`).join('')}</div>`
        : `<div class="empty"><b>No months yet</b>A challenge month is whole weeks — one big challenge,
            4–5 weekly episodes and a verdict. Tap New month to set up the first one.</div>`}
      </div>`;
    }

    if(!el.dataset.wiredMonths){
      el.dataset.wiredMonths = '1';
      el.addEventListener('click', async e => {
        const card = e.target.closest('[data-month]');
        if(card) return Screens.push('month', { id:card.dataset.month, onChange:render });
        const a = e.target.closest('[data-a]');
        if(a && a.dataset.a === 'import') return importPlan(render);
        if(a && a.dataset.a === 'new') return openForm(null, async saved => {
          await render();
          Screens.push('month', { id:saved.id, onChange:render });
        });
      });
    }
    await render();
  }

  /* ---------- importing a phase plan ---------- */

  /* Pick the file, show exactly what would be created and skipped, and only
     write after you say so. The file picker takes any file: Android labels JSON
     several ways and greys out whatever a filter doesn't match. */
  async function importPlan(after){
    const text = await Transfer.pickFile('');
    if(!text) return;
    let pv;
    try { pv = await PlanImport.preview(PlanImport.parseAny(text)); }
    catch(err){ return U.toast(err.message || "Couldn't read that plan"); }

    const mC = pv.months.filter(x => x.action === 'create'), mS = pv.months.filter(x => x.action === 'skip');
    const eC = pv.episodes.filter(x => x.action === 'create'), eS = pv.episodes.filter(x => x.action === 'skip');
    const sC = (pv.series || []).filter(x => x.action === 'create'), sS = (pv.series || []).filter(x => x.action === 'skip');
    const iC = (pv.ideas || []).filter(x => x.action === 'create'), iS = (pv.ideas || []).filter(x => x.action === 'skip');
    const hasSeries = (pv.series || []).length || (pv.ideas || []).length;
    /* the series by channel, for a readable summary */
    const byChan = {};
    sC.forEach(x => { (byChan[x.rec.channel || 'No channel'] = byChan[x.rec.channel || 'No channel'] || []).push(x.rec.title); });
    const list = (rows, fn) => rows.length ? `<ul style="margin:6px 0 0;padding-left:18px;font-size:13.5px;
      line-height:1.55;color:var(--muted)">${rows.map(fn).join('')}</ul>` : '';
    const full = { month:'short', day:'numeric' };

    const planish = pv.months.length || pv.episodes.length;
    App.sheet(`
      <h2>${planish ? 'Import plan' : 'Import series'}</h2>
      <p style="margin:0 0 12px;color:var(--muted);font-size:14px;line-height:1.5">${esc(pv.obj.project || '')}${
        pv.obj.phase ? ` · Phase ${esc(pv.obj.phase)}` : ''} — nothing is written until you tap Import.</p>
      <div class="mo-facts" style="margin:0 0 12px">
        ${planish ? `<div><small>Months</small><b>${mC.length} new · ${mS.length} skipped</b></div>
        <div><small>Episodes</small><b>${eC.length} new · ${eS.length} skipped</b></div>` : ''}
        ${hasSeries ? `<div><small>Channel series</small><b>${sC.length} new · ${sS.length} skipped</b></div>
        <div><small>Series video ideas</small><b>${iC.length} new · ${iS.length} skipped</b></div>` : ''}
      </div>
      ${hasSeries ? `<label style="display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:14.5px;cursor:pointer">
        <input type="checkbox" id="pi-series" checked style="width:20px;height:20px">
        Include the channel series and their video ideas</label>` : ''}
      ${mC.length ? `<p class="mo-group" style="margin:10px 0 0;font-weight:800;font-size:12px;letter-spacing:.12em;
        text-transform:uppercase;color:var(--muted)">New months</p>${list(mC, x => `<li>${esc(x.rec.name)} ·
        ${Months.label(x.rec.startDate, full)} – ${Months.label(x.rec.endDate, full)} · ${esc(x.rec.challenge)}</li>`)}` : ''}
      ${mS.length ? `<p style="margin:12px 0 0;font-weight:800;font-size:12px;letter-spacing:.12em;text-transform:uppercase;
        color:var(--muted)">Skipped months</p>${list(mS, x => `<li>${esc(x.rec.name)} — ${esc(x.reason)}</li>`)}` : ''}
      ${eS.length ? `<p style="margin:12px 0 0;font-weight:800;font-size:12px;letter-spacing:.12em;text-transform:uppercase;
        color:var(--muted)">Skipped episodes</p>${list(eS, x => `<li>${esc(x.rec.title)} — ${esc(x.reason)}</li>`)}` : ''}
      ${pv.warnings.length ? `<div class="mo-prev warn" style="margin:12px 0 0">${pv.warnings.map(esc).join('<br>')}</div>` : ''}
      ${sC.length ? `<div id="pi-slist"><p style="margin:12px 0 0;font-weight:800;font-size:12px;letter-spacing:.12em;
        text-transform:uppercase;color:var(--muted)">New series</p>${list(Object.entries(byChan), ([ch, names]) =>
        `<li><b style="color:var(--cream)">${esc(ch)}</b> — ${names.map(esc).join(', ')}</li>`)}
        <p class="note" style="text-align:left;margin:8px 0 0">Series come in as drafts in the Series tab; each idea is a
          video at the Idea stage inside its series, in the plan's order.</p></div>` : ''}
      ${sS.length ? `<p style="margin:12px 0 0;font-weight:800;font-size:12px;letter-spacing:.12em;text-transform:uppercase;
        color:var(--muted)">Skipped series</p>${list(sS, x => `<li>${esc(x.rec.title)} — ${esc(x.reason)}</li>`)}` : ''}
      <div class="sheetcta">
        <button class="btn-primary" data-go></button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      const cb = sheetEl.querySelector('#pi-series');
      const withSeries = () => !cb || cb.checked;
      const goBtn = sheetEl.querySelector('[data-go]');
      /* the button says exactly what Import will do */
      function label(){
        const bits = [];
        if(mC.length) bits.push(`${mC.length} month${mC.length === 1 ? '' : 's'}`);
        if(eC.length) bits.push(`${eC.length} episode${eC.length === 1 ? '' : 's'}`);
        if(withSeries() && sC.length) bits.push(`${sC.length} series`);
        if(withSeries() && iC.length) bits.push(`${iC.length} idea${iC.length === 1 ? '' : 's'}`);
        goBtn.disabled = !bits.length;
        goBtn.textContent = bits.length ? `Import ${bits.join(', ')}` : 'Nothing new to import';
        const sl = sheetEl.querySelector('#pi-slist'); if(sl) sl.style.opacity = withSeries() ? '1' : '.4';
      }
      if(cb) cb.addEventListener('change', label);
      label();
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        const go = e.target.closest('[data-go]');
        if(!go || go.disabled) return;
        go.disabled = true; go.textContent = 'Importing…';
        try {
          pv.includeSeries = withSeries();
          const made = await PlanImport.apply(pv);
          App.closeSheet();
          const skipped = mS.length + eS.length + (pv.includeSeries ? sS.length + iS.length : 0);
          const n = (k, one, many) => made[k] ? `${made[k]} ${made[k] === 1 ? one : many}` : '';
          const got = [n('months','month','months'), n('episodes','episode','episodes'),
                       pv.includeSeries ? n('series','series','series') : '', pv.includeSeries ? n('ideas','idea','ideas') : '']
            .filter(Boolean);
          U.toast(`${got.length ? 'Created ' + got.join(', ') : 'Nothing new created'}${skipped ? ` · skipped ${skipped}` : ''}`);
          after && after();
        } catch(err){
          console.error(err);
          U.toast('The import stopped partway — run it again; what was created is skipped');
          go.disabled = false; go.textContent = 'Try again';
        }
      });
    });
  }

  /* ---------- the new / edit form ---------- */

  /* Where a new month most likely starts: the Sunday after the last one ends,
     or the week the program starts in, or this coming Sunday. */
  async function suggestStart(){
    const months = await Months.all();
    const last = months.filter(m => m.endDate).slice(-1)[0];
    if(last) return Months.addDays(last.endDate, 1);
    try {
      const w1 = Months.iso(await Data.weekStartOf(1));
      if(w1 >= Months.snapSunday(Date.now())) return w1;
    } catch(e){}
    const s = Months.snapSunday(Date.now());
    return s === Months.iso(Date.now()) ? s : Months.addDays(s, 7);
  }
  /* A week belongs to the month its Saturday falls in, so the natural end is
     the last Saturday of the calendar month the first week lands in. */
  function suggestEnd(start){
    const firstSat = Months.addDays(Months.snapSunday(start), 6);
    const d = new Date(Months.ts(firstSat));
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const lastSat = Months.addDays(Months.iso(lastDay), -((lastDay.getDay() + 1) % 7));
    return lastSat < firstSat ? firstSat : lastSat;
  }
  const monthName = start => new Date(Months.ts(Months.addDays(Months.snapSunday(start), 6)))
    .toLocaleDateString(undefined, { month:'long' });

  /* `seed` lets another screen open this with fields already filled in — the
     quarter page adds a month that belongs to it, rather than sending you to a
     list and hoping you pick the right quarter from the dropdown. */
  async function openForm(rec, after, seed){
    const start0 = rec ? rec.startDate
      : (seed && seed.startDate) || await suggestStart();
    const m = rec ? { ...rec } : { ...Months.blank(), startDate:start0, endDate:suggestEnd(start0),
                                   name:monthName(start0), ...(seed || {}) };
    let quarters = [];
    try { quarters = (await Quarters.all()) || []; } catch(e){ quarters = []; }
    const others = (await Months.all()).filter(x => x.id !== m.id);

    App.sheet(`
      <h2>${rec ? 'Edit month' : 'New month'}</h2>
      <div class="field"><label for="mo-name">Name</label>
        <input id="mo-name" type="text" value="${esc(m.name)}" placeholder="October" autocomplete="off"></div>
      <div class="mo-dates">
        <div class="field"><label for="mo-start">Starts (Sunday)</label>
          <input id="mo-start" type="date" value="${m.startDate || ''}"></div>
        <div class="field"><label for="mo-end">Ends (Saturday)</label>
          <input id="mo-end" type="date" value="${m.endDate || ''}"></div>
      </div>
      <div class="mo-prev" id="mo-prev"></div>
      <div class="field"><label for="mo-challenge">The challenge</label>
        <textarea id="mo-challenge" rows="2" placeholder="Run 100 miles this month">${esc(m.challenge)}</textarea></div>
      ${quarters.length ? `<div class="field"><label for="mo-qlink">Quarter</label>
        <select id="mo-qlink"><option value="">Not linked to a quarter</option>
          ${quarters.map(q => `<option value="${q.id}" ${m.quarterId === q.id ? 'selected' : ''}>${esc(q.name)}</option>`).join('')}
        </select></div>` : ''}
      <div class="mo-dates">
        <div class="field"><label for="mo-q">Quarter label</label>
          <input id="mo-q" type="text" value="${esc(m.quarter)}" placeholder="Q1" autocomplete="off"></div>
        <div class="field"><label for="mo-qt">Quarter theme</label>
          <input id="mo-qt" type="text" value="${esc(m.quarterTheme)}" placeholder="Foundations" autocomplete="off"></div>
      </div>
      ${window.Scoreboard ? `<div class="field"><label>Habits tracked this month</label>
        <div class="rs-chips" id="mo-habits">${Scoreboard.HABITS.map(h => `<button type="button" data-h="${h.k}"
          aria-pressed="${Scoreboard.activeHabits(m).includes(h.k)}">${h.label}</button>`).join('')}</div></div>` : ''}
      <div class="field"><label for="mo-reward">Reward if you win</label>
        <input id="mo-reward" type="text" value="${esc(m.reward)}" placeholder="A new lens" autocomplete="off"></div>
      <div class="field"><label for="mo-pen">Penalty options if you lose — one per line</label>
        <textarea id="mo-pen" rows="3" placeholder="Ice bath on camera&#10;Donate $100">${esc((m.penaltyOptions || []).join('\n'))}</textarea></div>
      <div class="field"><label for="mo-notes">Notes</label>
        <textarea id="mo-notes" rows="2">${esc(m.notes)}</textarea></div>
      <div class="sheetcta">
        <button class="btn-primary" data-save>${rec ? 'Save' : 'Create month'}</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      const $ = s => sheetEl.querySelector(s);
      let nameTouched = !!rec;
      $('#mo-name').addEventListener('input', () => { nameTouched = true; });

      /* show what will actually be saved: the snapped days, the weeks, the verdict */
      function preview(){
        const s = $('#mo-start').value, en = $('#mo-end').value;
        const box = $('#mo-prev');
        if(!s || !en){ box.className = 'mo-prev'; box.innerHTML = 'Pick a start and an end.'; return null; }
        const n = Months.normalise({ startDate:s, endDate:en });
        const weeks = Math.round((Months.ts(n.endDate) - Months.ts(n.startDate)) / 864e5 + 1) / 7;
        const clash = others.find(o => o.startDate && o.endDate &&
          !(n.endDate < o.startDate || n.startDate > o.endDate));
        const full = { weekday:'short', month:'short', day:'numeric' };
        box.className = 'mo-prev' + (clash ? ' warn' : '');
        box.innerHTML = `<b>${Months.label(n.startDate, full)} → ${Months.label(n.endDate, full)}</b> ·
          ${weeks} week${weeks === 1 ? '' : 's'} · verdict releases <b>${Months.label(n.verdictReleaseDate, full)}</b>
          ${s !== n.startDate || en !== n.endDate ? '<br>Snapped to whole Sunday–Saturday weeks.' : ''}
          ${clash ? `<br>Overlaps ${esc(clash.name || 'another month')} — a week can only be in one month.` : ''}`;
        return { n, clash };
      }
      $('#mo-start').addEventListener('change', () => {
        const s = $('#mo-start').value;
        if(s && !rec){
          $('#mo-end').value = suggestEnd(s);
          if(!nameTouched) $('#mo-name').value = monthName(s);
        }
        preview();
      });
      $('#mo-end').addEventListener('change', preview);
      const ql = $('#mo-qlink');
      if(ql) ql.addEventListener('change', () => {
        const q = quarters.find(x => x.id === ql.value);
        if(q && !$('#mo-qt').value.trim()) $('#mo-qt').value = q.topic || q.name || '';
      });
      preview();

      sheetEl.addEventListener('click', async e => {
        const hb = e.target.closest('#mo-habits [data-h]');
        if(hb){ hb.setAttribute('aria-pressed', hb.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); return; }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-save]')) return;
        const pv = preview();
        if(!pv) return U.toast('Pick a start and an end');
        if(pv.clash && !confirm(`These weeks overlap ${pv.clash.name || 'another month'}. Save anyway?`)) return;
        const saved = await Months.save({
          ...m,
          name: $('#mo-name').value.trim() || monthName($('#mo-start').value),
          startDate: $('#mo-start').value,
          endDate: $('#mo-end').value,
          /* a changed end moves the verdict with it, unless it was set by hand */
          verdictReleaseDate: rec && rec.endDate === Months.snapSaturday($('#mo-end').value)
            ? rec.verdictReleaseDate : null,
          challenge: $('#mo-challenge').value.trim(),
          quarterId: ql ? (ql.value || null) : (m.quarterId || null),
          quarter: $('#mo-q').value.trim(),
          quarterTheme: $('#mo-qt').value.trim(),
          reward: $('#mo-reward').value.trim(),
          penaltyOptions: $('#mo-pen').value.split('\n'),
          notes: $('#mo-notes').value.trim(),
          habits: $('#mo-habits') ? [...sheetEl.querySelectorAll('#mo-habits [data-h][aria-pressed="true"]')]
            .map(b => b.dataset.h) : (m.habits || null)
        });
        App.closeSheet();
        U.toast(rec ? 'Month saved' : 'Month created');
        after && after(saved);
      });
    });
  }

  /* ---------- a month's page ---------- */
  async function mountMonth(el, params){
    injectCSS();
    let m = null, slots = [];

    /* An episode fills a week slot when it is tagged to this month and films
       that week. The week number is the one source of truth for when. */
    const inSlot = (eps, slot) => eps.filter(v => v.week !== null && v.week !== undefined
      && v.week !== '' && +v.week === slot.week);

    async function render(){
      Months.invalidate();
      m = await Months.get(params && params.id);
      if(!m){
        el.innerHTML = Screens.bar({ kicker:'Months', title:'Not found' }) +
          `<div class="view"><div class="empty"><b>This month is gone</b>It may have been deleted.</div></div>`;
        return;
      }
      const keep = el.querySelector('.view') ? el.querySelector('.view').scrollTop : 0;
      const eps = await Months.linked(m);
      const rec = Months.record(eps);
      slots = await Months.weeks(m);
      let mt = null;
      if(window.Scoreboard){ try { mt = await Scoreboard.monthTotals(m); } catch(e){ mt = null; } }
      const full = { weekday:'short', month:'short', day:'numeric' };
      const placed = new Set();
      const filled = slots.filter(sl => inSlot(eps, sl).length).length;

      const ladder = slots.map(slot => {
        const here = inSlot(eps, slot);
        here.forEach(v => placed.add(v.id));
        const v = here[0];
        const head = `<div class="wk"><span>Week ${slot.index}${slot.week !== null ? ` · project week ${slot.week}` : ''}</span>
          ${slot.last ? '<span class="v">Verdict week</span>' : ''}</div>`;
        const dates = `${Months.label(slot.sunday)} – ${Months.label(slot.saturday)} · releases ${Months.label(slot.release, full)}`;
        if(!v) return `<div class="mo-slot empty">
          ${head}
          <p class="sk" style="margin:6px 0 0">${dates}</p>
          <div class="acts">
            <button class="btn-sm accent" data-create="${slot.index}">Create episode</button>
            <button class="btn-sm" data-link="${slot.index}">Link existing</button>
          </div>
        </div>`;
        const segs = v.segments || [];
        const done = segs.filter(x => x.status === 'done').length;
        return `<div class="mo-slot filled" data-ep="${v.id}">
          ${head}
          <p class="t">${esc(v.title) || 'Untitled episode'}</p>
          <p class="sk">${v.skill ? esc(v.skill) : '<span style="color:var(--dim)">No skill set</span>'}</p>
          <div class="row">
            <span>${dates}</span>
          </div>
          <div class="row">
            <span class="mo-chip${v.result ? ' ' + v.result : ''}">${v.result ? (v.result === 'W' ? 'WIN' : 'LOSS') : 'PENDING'}</span>
            ${segs.length ? `<span class="bar"><i style="width:${Math.round(done / segs.length * 100)}%"></i></span>
              <span>${done}/${segs.length}</span>` : '<span>No segments yet</span>'}
          </div>
          ${here.length > 1 ? `<p class="sk" style="margin:8px 0 0;color:var(--orange)">
            ${here.length} episodes are in this week — only one should be.</p>` : ''}
        </div>`;
      }).join('');

      /* tagged to this month but filming outside its weeks — shown, never hidden */
      const stray = eps.filter(v => !placed.has(v.id));

      el.innerHTML = Screens.bar({ kicker:'Month', title:esc(m.name) || 'Month',
        actions:`<button class="btn-sm" data-a="edit">Edit</button>` }) + `
      <div class="view">
        <div class="mo-head">
          <p class="nm">${esc(m.name) || 'Untitled month'}</p>
          <!-- the quarter reads as a label but is the way back up: a month page
               that names its quarter and cannot open it is a dead end -->
          ${m.quarter || m.quarterTheme
            ? `<p class="q"${m.quarterId ? ` data-toq="${m.quarterId}" role="button"
                style="cursor:pointer;text-decoration:underline;text-underline-offset:3px"` : ''}
               >${esc([m.quarter, m.quarterTheme].filter(Boolean).join(' · '))}</p>`
            : ''}
          <p class="ch">${esc(m.challenge) || '<span style="color:var(--dim)">No challenge set — tap Edit</span>'}</p>
          <div class="mo-seg" role="group" aria-label="Month result">
            <button data-res="W" class="W" aria-pressed="${m.result === 'W'}">WON</button>
            <button data-res="" aria-pressed="${!m.result}">PENDING</button>
            <button data-res="L" class="L" aria-pressed="${m.result === 'L'}">LOST</button>
          </div>
        </div>

        <div class="mo-facts">
          <div><small>Weeks</small><b>${Months.label(m.startDate)} – ${Months.label(m.endDate)}</b></div>
          <div><small>Weekly record</small><b>${rec.w}W · ${rec.l}L · ${filled}/${slots.length} weeks</b></div>
        </div>

        ${mt ? `<div class="mo-h"><span>Month totals</span><i></i><em>${mt.xp.toLocaleString()} XP earned</em></div>
        <div class="mo-facts" style="margin:0">
          <div><small>Habit days</small><b>${mt.days}${mt.possible ? ` / ${mt.possible * mt.habits.length}` : ''}</b></div>
          <div><small>Weekly record</small><b>${mt.wins}W · ${mt.losses}L</b></div>
          ${mt.habits.map(h => `<div><small>${Scoreboard.habitLabel(h)}</small><b>${mt.per[h]}${
            mt.possible ? ` / ${mt.possible}` : ''} days</b></div>`).join('')}
        </div>` : ''}

        <div class="mo-h"><span>Stakes</span><i></i></div>
        <div class="mo-stakes">
          <label for="mo-rw">Reward if you win</label>
          <input id="mo-rw" type="text" value="${esc(m.reward)}" placeholder="A new lens" autocomplete="off"
            style="margin-bottom:14px">
          <label>Penalty options if you lose</label>
          ${(m.penaltyOptions || []).map((p, i) => `<div class="mo-pen">
            <input type="text" data-pen="${i}" value="${esc(p)}" autocomplete="off">
            <button data-pendel="${i}" aria-label="Remove">×</button></div>`).join('')}
          <button class="cp-add" data-a="penadd" style="margin-top:2px">+ Add a penalty option</button>
        </div>

        <div class="mo-h"><span>Weeks</span><i></i><em>${filled} of ${slots.length} filled</em></div>
        <div class="mo-ladder">${ladder || '<div class="empty"><b>No weeks</b>Set a start and end date.</div>'}</div>

        ${stray.length ? `<div class="mo-h"><span>Tagged, outside these weeks</span><i></i></div>
          <div class="mo-ladder">${stray.map(v => `<div class="mo-slot filled" data-ep="${v.id}">
            <div class="wk"><span>${v.week !== null && v.week !== undefined && v.week !== '' ? `Project week ${v.week}` : 'No week set'}</span></div>
            <p class="t">${esc(v.title) || 'Untitled episode'}</p></div>`).join('')}</div>` : ''}

        <div class="mo-verdict">Verdict episode releases <b>${
          Months.label(m.verdictReleaseDate, { weekday:'long', month:'long', day:'numeric' }) || '—'}</b></div>

        ${m.notes ? `<p class="note" style="text-align:left;margin-top:14px">${esc(m.notes)}</p>` : ''}
        <button class="btn-ghost" data-a="delete" style="width:100%;margin-top:22px;color:var(--red);
          border-color:rgba(226,86,74,.4)">Delete month</button>
      </div>`;
      const view = el.querySelector('.view');
      if(view && keep) view.scrollTop = keep;
    }

    /* Untagged episodes, the ones already filming this week first. Linking one
       gives it this month and this week; if it was set to another week it asks
       before moving it. */
    async function pickEpisode(slot){
      const list = await Months.linkable(slot);
      const full = { weekday:'short', month:'short', day:'numeric' };
      App.sheet(`
        <h2>Link an episode</h2>
        <p style="margin:0 0 12px;color:var(--muted);font-size:14px;line-height:1.5">
          Week ${slot.index} · ${Months.label(slot.sunday, full)} – ${Months.label(slot.saturday, full)}${
          slot.last ? ' · the verdict week' : ''}</p>
        ${list.length ? `<div style="max-height:56vh;overflow:auto">${list.map(({ v, here }) => `
          <button class="vt-pick" data-pick="${v.id}" style="display:block;width:100%;text-align:left;
            margin:0 0 7px;padding:11px 12px;border:1px solid ${here ? 'var(--orange)' : 'var(--line)'};
            border-radius:var(--r);background:var(--surface-2);color:var(--cream);cursor:pointer">
            <b style="display:block;font-size:15px">${esc(v.title) || 'Untitled episode'}</b>
            <small style="display:block;margin-top:3px;font-size:12.5px;color:${here ? 'var(--orange)' : 'var(--muted)'}">${
              here ? 'Films this week' : Months.hasWeek(v) ? `Set to project week ${v.week}` : 'No week set'}</small>
          </button>`).join('')}</div>`
        : `<div class="empty"><b>Nothing to link</b>Every episode already belongs to a month. Create one for this week instead.</div>`}
        <div class="sheetcta"><button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
        sheetEl.addEventListener('click', async ev => {
          if(ev.target.closest('[data-cancel]')) return App.closeSheet();
          const b = ev.target.closest('[data-pick]');
          if(!b) return;
          const hit = list.find(x => x.v.id === b.dataset.pick);
          if(hit && Months.hasWeek(hit.v) && !hit.here &&
             !confirm(`"${hit.v.title}" is set to project week ${hit.v.week}. Move it to week ${slot.week}?`)) return;
          const r = await Months.linkEpisode(b.dataset.pick, m, slot);
          if(!r.ok){
            return U.toast(r.reason === 'taken' ? `Week ${slot.index} already has "${r.holder.title}"` : 'That episode is gone');
          }
          App.closeSheet();
          params && params.onChange && params.onChange();
          await render();
          U.toast(`Linked to week ${slot.index}`);
        });
      });
    }

    async function saveMonth(patch, rerender){
      m = await Months.save({ ...m, ...patch });
      params && params.onChange && params.onChange();
      if(rerender) await render();
    }

    /* typing in the stakes saves as you go; the list only redraws on add/remove */
    el.addEventListener('change', async e => {
      if(e.target.id === 'mo-rw') return saveMonth({ reward:e.target.value.trim() });
      const pi = e.target.dataset.pen;
      if(pi !== undefined){
        const list = (m.penaltyOptions || []).slice();
        list[+pi] = e.target.value;
        return saveMonth({ penaltyOptions:list }, !e.target.value.trim());
      }
    });

    el.addEventListener('click', async e => {

      const toq = e.target.closest('[data-toq]');

      if(toq) return Screens.push('quarter', { id:toq.dataset.toq,

        onChange:async () => { await load(); render(); } });

      const r = e.target.closest('[data-res]');
      if(r){
        await saveMonth({ result:r.dataset.res || null }, true);
        if(window.Celebrate && Celebrate.checkLevel) Celebrate.checkLevel();   /* a monthly win is XP */
        return;
      }

      const ep = e.target.closest('[data-ep]');
      if(ep) return Screens.push('vlog', { id:ep.dataset.ep, onChange:render });

      const pd = e.target.closest('[data-pendel]');
      if(pd){
        const list = (m.penaltyOptions || []).filter((_, i) => i !== +pd.dataset.pendel);
        return saveMonth({ penaltyOptions:list }, true);
      }
      const cr = e.target.closest('[data-create]');
      if(cr){
        const slot = slots.find(x => x.index === +cr.dataset.create);
        if(!slot) return;
        const r = await Months.createEpisode(m, slot);
        if(!r.ok) return U.toast(`Week ${slot.index} already has "${r.holder.title}"`);
        params && params.onChange && params.onChange();
        await render();
        U.toast(slot.last ? 'Verdict episode created' : `Week ${slot.index} episode created`);
        return Screens.push('vlog', { id:r.episode.id, onChange:render });
      }
      const ln = e.target.closest('[data-link]');
      if(ln){
        const slot = slots.find(x => x.index === +ln.dataset.link);
        if(slot) return pickEpisode(slot);
        return;
      }

      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'penadd'){
        const t = (prompt('A penalty option') || '').trim();
        if(!t) return;
        return saveMonth({ penaltyOptions:(m.penaltyOptions || []).concat(t) }, true);
      }
      if(a.dataset.a === 'edit') return openForm(m, async () => {
        await render(); params && params.onChange && params.onChange();
      });
      if(a.dataset.a === 'delete'){
        const n = (await Months.linked(m)).length;
        if(!confirm(`Delete ${m.name || 'this month'}?${n ? ` Its ${n} episode${n === 1 ? '' : 's'} stay — they just lose the month tag.` : ''}`)) return;
        await Months.remove(m.id);
        params && params.onChange && params.onChange();
        U.toast('Month deleted');
        Screens.pop();
      }
    });

    await render();
  }

  /* the episode page shows the Month field too, and may open before this tab has */
  injectCSS();

  /* the same import, reachable from the Series tab for a file of series ideas */
  window.PlanImportUI = { fromFile: importPlan };

  /* so a quarter can add a month that already belongs to it */
  window.MonthsUI = { openForm };

  Screens.register('months', mountList);
  Screens.register('month', mountMonth);
})();
