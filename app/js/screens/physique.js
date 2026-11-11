/* Weight and photos over time — the thing the Progress tiles always promised. */
(function(){

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  async function mount(el, params){
    const embedded = !!(params && params.embedded);
    let list = [], urls = {}, unit = 'kg', tab = 'all';

    const disp = kg => kg == null ? null : Math.round(Units.toDisplay(kg, unit) * 10) / 10;

    async function load(){
      list = await Physique.all();
      try { unit = await Units.get(); } catch(e){ unit = 'kg'; }

      Object.values(urls).forEach(URL.revokeObjectURL);
      urls = {};
      const blobs = await Physique.photos();
      /* keyed entryId:pose, with the old single-photo key folded in as the front */
      list.forEach(e => {
        const mine = Physique.posesOf(e, blobs);
        Object.entries(mine).forEach(([pose, b]) =>
          urls[Physique.photoKey(e.id, pose)] = URL.createObjectURL(b));
      });
    }

    function summary(){
      const s = Physique.stats(list);
      if(!s.n) return `<div class="empty"><b>Nothing logged yet</b>
        Log your weight, a photo, or both. The two together are the only honest
        record of a transformation.</div>`;

      const arrow = s.trend == null ? '' : s.trend > 0.1 ? '▲' : s.trend < -0.1 ? '▼' : '—';
      return `
        <div class="phstats">
          <div><b>${disp(s.last.kg)}</b><small>now · ${unit}</small></div>
          <div><b>${s.change > 0 ? '+' : ''}${disp(s.change)}</b><small>since day one</small></div>
          <div><b>${disp(s.lo.kg)}</b><small>lightest</small></div>
          <div><b>${disp(s.hi.kg)}</b><small>heaviest</small></div>
        </div>
        ${s.trend == null ? '' : `<p class="hintline" style="margin:10px 0 0">
          ${arrow} ${Math.abs(disp(s.trend))} ${unit} against the week before.</p>`}`;
    }

    /* a plain sparkline, so the shape is visible without a chart library */
    function spark(){
      const s = Physique.stats(list);
      if(s.n < 2) return '';
      const pts = s.series;
      const lo = Math.min(...pts.map(p => p.kg)), hi = Math.max(...pts.map(p => p.kg));
      const span = (hi - lo) || 1;
      const d = pts.map((p, i) => {
        const x = (i / (pts.length - 1)) * 100;
        const y = 30 - ((p.kg - lo) / span) * 26 - 2;
        return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ');
      return `<div class="phspark"><svg viewBox="0 0 100 30" preserveAspectRatio="none">
        <path d="${d}" fill="none" stroke="var(--orange)" stroke-width="1.6"
          vector-effect="non-scaling-stroke"/></svg>
        <span>${disp(lo)}</span><span class="r">${disp(hi)}</span></div>`;
    }

    const shotUrl = (e, pose) => urls[Physique.photoKey(e.id, pose)];
    const shotCount = e => Physique.POSES.filter(p => shotUrl(e, p.k)).length;

    function row(e){
      const d = new Date(e.at);
      const n = shotCount(e);
      const lead = Physique.POSES.map(p => shotUrl(e, p.k)).find(Boolean);
      return `
        <button class="noterow" data-open="${e.id}">
          ${lead ? `<span class="thumb" style="background-image:url(${lead})"></span>`
                 : '<span class="dot" style="background:var(--dim)"></span>'}
          <span class="t">
            <b>${d.toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' })}</b>
            <small>${e.kg != null ? disp(e.kg) + ' ' + unit : 'no weight'} · ${
              n ? `${n} of 4 angles` : 'no photos'}${
              e.note ? ' · ' + esc(e.note).slice(0, 30) : ''}</small>
          </span>
          ${U.ICON.chevR}
        </button>`;
    }

    function render(){
      const withPhoto = list.filter(e => shotCount(e) > 0);
      const shown = tab === 'photos' ? withPhoto : list;

      el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Workout', title:'Physique' })) + `
        <div class="view">
          <div class="pagehead"><h1 class="page-title">Physique</h1>
            <span class="headacts" style="display:flex;gap:8px;align-items:center">
              <button class="headbtn" data-a="add">LOG</button>
            </span></div>

          ${summary()}
          ${spark()}

          <div class="vidfilters" style="margin-top:16px">
            <button class="opt" data-t="all" aria-pressed="${tab === 'all'}">All ${list.length}</button>
            <button class="opt" data-t="photos" aria-pressed="${tab === 'photos'}">Photos ${withPhoto.length}</button>
          </div>

          ${tab === 'photos' && withPhoto.length
            ? withPhoto.map(e => `
                <div class="phday">
                  <div class="phhead">
                    <b>${new Date(e.at).toLocaleDateString(undefined,
                      { weekday:'short', day:'numeric', month:'short' })}</b>
                    ${e.kg != null ? `<span>${disp(e.kg)} ${unit}</span>` : ''}
                    <button class="btn-sm" data-open="${e.id}">Edit</button>
                  </div>
                  <div class="phrow">${Physique.POSES.map(p => shotUrl(e, p.k)
                    ? `<button class="phcell" data-open="${e.id}"
                        style="background-image:url(${shotUrl(e, p.k)})"><span>${p.label}</span></button>`
                    : `<span class="phcell miss">${p.label}</span>`).join('')}</div>
                </div>`).join('')
            : shown.length ? shown.map(row).join('')
            : `<div class="empty"><b>Nothing here yet</b>
                ${tab === 'photos' ? 'No photos logged yet.' : 'Tap LOG to start.'}</div>`}

          ${list.length ? `<div class="exportbar" style="margin-top:18px">
            <button class="xbtn2" data-x="page">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              Export with photos</button>
            <button class="xbtn2" data-x="csv">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M8 8l4-4 4 4M4 20h16"/></svg>
              Weights as CSV</button>
          </div>
          <p class="note">The export is one file with the photos inside it — it opens in any
            browser and nothing is left behind on the device.</p>` : ''}
        </div>`;
    }

    /* ---------- logging one ---------- */

    async function editor(entry){
      const isNew = !entry.id;
      const r = { ...entry };
      /* what you weighed last time, to start the stepper from */
      let lastKg = null;
      try { lastKg = await Physique.lastKgBefore(r.at || Date.now()); } catch(e){ lastKg = null; }
      /* one file per angle, only for the ones you actually change */
      const picked = {};
      const shown = {};
      Physique.POSES.forEach(p => shown[p.k] = r.id ? shotUrl(r, p.k) || null : null);

      App.sheet(`
        <h2 style="margin:0 0 3px">${isNew ? 'Log a day' : 'Entry'}</h2>
        <p class="hintline" style="margin:0 0 12px">Photos taken on a day you forgot to log
          still belong to that day — set the date to when you actually took them.</p>
        <input id="ph-d" class="pgbar" type="date" style="margin:0 0 6px"
          value="${Physique.dayISO(r.at || Date.now())}" max="${Physique.dayISO(Date.now())}">

        <h3 class="pgh" style="margin-top:4px">The four angles</h3>
        <div class="phslots">
          ${Physique.POSES.map(p => `
            <div class="phslot">
              <button class="pad${shown[p.k] ? ' has' : ''}" data-pose="${p.k}"
                ${shown[p.k] ? `style="background-image:url(${shown[p.k]})"` : ''}>
                ${shown[p.k] ? '' : '<span class="plus">+</span>'}
              </button>
              <span class="lbl">${p.label}</span>
              ${shown[p.k] ? `<button class="drop" data-drop="${p.k}">Remove</button>` : ''}
            </div>`).join('')}
        </div>
        <p class="hintline">Same spot, same light, same time of day — that is what makes
          the run watchable later.</p>

        <h3 class="pgh">Weight</h3>
        <div class="pgstep">
          <button type="button" class="bump" data-w="-1">&minus;</button>
          <span class="val"><input id="ph-w" class="valnum" type="number" inputmode="decimal"
            step="0.1" min="0" value="${
              r.kg != null ? disp(r.kg) : (lastKg != null ? disp(lastKg) : 0)}"><i>${unit}</i></span>
          <button type="button" class="bump" data-w="1">+</button>
        </div>
        <p class="hintline">${r.kg == null && lastKg != null
          ? `Starting from your last reading, ${disp(lastKg)} ${unit} — nudge it rather than
             typing it. Set it to zero to log a photo only.`
          : 'Leave it at zero to log a photo only.'}</p>

        <h3 class="pgh">Note</h3>
        <textarea id="ph-n" class="pgtext" rows="2"
          placeholder="Fasted, morning, after the long run — whatever changes how to read it."
          >${esc(r.note || '')}</textarea>

        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${isNew ? '' : `<button class="btn-ghost" data-del
          style="width:100%;margin:12px 0 0;color:var(--red);border-color:rgba(226,86,74,.45)">
          Delete this entry</button>`}`, sheet => {

        const $ = q => sheet.querySelector(q);

        sheet.addEventListener('click', async e => {
          const w = e.target.closest('[data-w]');
          if(w){
            const step = unit === 'kg' ? 0.5 : 1;
            const now = +$('#ph-w').value || 0;
            $('#ph-w').value = Math.max(0, Math.round((now + step * +w.dataset.w) * 10) / 10);
            return;
          }

          const pose = e.target.closest('[data-pose]');
          if(pose){
            const k = pose.dataset.pose;
            return App.pickImage(file => {
              picked[k] = file;
              const url = URL.createObjectURL(file);
              shown[k] = url;
              pose.classList.add('has');
              pose.style.backgroundImage = `url(${url})`;
              const plus = pose.querySelector('.plus');
              if(plus) plus.remove();
            });
          }

          const drop = e.target.closest('[data-drop]');
          if(drop){
            const k = drop.dataset.drop;
            delete picked[k];
            shown[k] = null;
            if(r.id) await Physique.removePhoto(r.id, k);
            App.closeSheet();
            await load(); render();
            return;
          }

          if(e.target.closest('[data-cancel]')) return App.closeSheet();

          if(e.target.closest('[data-del]')){
            await Physique.remove(r.id);
            App.closeSheet();
            await load(); render();
            return U.toast('Deleted');
          }
          if(!e.target.closest('[data-save]')) return;

          const onScale = +$('#ph-w').value || 0;

          /* The date you set wins. Midday local time, so the entry cannot drift
             into the day before or after when it is read back. */
          const picked_date = ($('#ph-d') && $('#ph-d').value) || '';
          let at = r.at || Date.now();
          if(picked_date){
            const [y, m, d] = picked_date.split('-').map(Number);
            at = new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
          }

          /* One entry per day still holds: moving this onto a day that already
             has one edits that day rather than making a second. */
          if(!r.id || Physique.dayKey(at) !== Physique.dayKey(r.at || at)){
            const existing = await Physique.forDay(at);
            if(existing && existing.id !== r.id){
              r.id = existing.id;
              r.poses = [...new Set([...(existing.poses || []), ...(r.poses || [])])];
            }
          }

          await Physique.save({
            id: r.id, at,
            kg: onScale > 0 ? Units.toKg(onScale, unit) : null,
            note: $('#ph-n').value,
            poses: r.poses || []
          }, picked);

          App.closeSheet();
          await load(); render();
          U.toast(isNew ? 'Logged' : 'Saved');
        });
      });
    }

    el.addEventListener('click', async e => {
      const t = e.target.closest('[data-t]');
      if(t){ tab = t.dataset.t; return render(); }

      const x = e.target.closest('[data-x]');
      if(x){
        const stamp = new Date().toISOString().slice(0, 10);
        if(x.dataset.x === 'csv')
          return Transfer.download(`physique-${stamp}.csv`, await Physique.csv(), 'text/csv');
        U.toast('Building it — photos take a moment');
        return Transfer.download(`physique-${stamp}.html`, await Physique.page(), 'text/html');
      }

      if(e.target.closest('[data-a="add"]')){
        /* one entry per day: a second log today opens today rather than doubling up */
        const already = await Physique.forDay(Date.now());
        return editor(already || { at: Date.now() });
      }

      const open = e.target.closest('[data-open]');
      if(open){
        const entry = list.find(x2 => x2.id === open.dataset.open);
        if(entry) editor(entry);
      }
    });

    await load();
    render();
  }

  Screens.register('physique', mount);
})();
