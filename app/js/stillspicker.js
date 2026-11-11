/* Stills picker — the pop-out for putting a reference still on a shot.

   Browse a folder (a Reference Library scenario), step through its stills one
   at a time in a big frame, and pick one. Built for flipping fast on a phone:
   swipe or arrows, a filmstrip underneath, framing filters on top. "From
   files" is there for a picture that isn't in the library yet.

     StillsPicker.open({ title }) → Promise of
       { refId } — a reference was chosen
       { file:true } — use a file instead (the caller opens its own chooser)
       null — closed */
(function(global){

  /* the Reference Library's built-in folders; your own come from settings */
  const BUILT_IN = { new:'New', talking:'Talking head', incar:'In-car', driving:'Driving b-roll',
    walking:'Walking & street', desk:'Desk & screen work', hands:'Hands & detail',
    exterior:'Exterior establishing', job:'On-the-job', home:'Home & property', gym:'Gym & training' };

  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  async function folders(list){
    let custom = [];
    try { custom = (await Store.get('settings', 'ref-scenarios')) || []; } catch(e){}
    const names = { ...BUILT_IN };
    custom.forEach(c => { if(c && c.id) names[c.id] = c.n || c.id; });
    const counts = {};
    list.forEach(r => { const k = r.scenario || 'new'; counts[k] = (counts[k] || 0) + 1; });
    return Object.keys(counts).map(id => ({ id, n: names[id] || 'Unfiled', count: counts[id] }))
      .sort((a, b) => a.n.localeCompare(b.n));
  }

  function open(opts){
    const o = opts || {};
    return new Promise(async resolve => {
      const all = (await Refs.all()).filter(r => r.kind !== 'video' || true);
      const dirs = await folders(all);
      let folder = '', framing = '', at = 0;
      const thumbs = {};

      const host = document.createElement('div');
      host.className = 'sp-host';
      host.setAttribute('role', 'dialog');
      host.setAttribute('aria-label', 'Pick a still');
      document.body.appendChild(host);

      const list = () => all.filter(r => (!folder || (r.scenario || 'new') === folder) && (!framing || r.framing === framing));
      const framings = () => [...new Set(all.filter(r => !folder || (r.scenario || 'new') === folder)
        .map(r => r.framing).filter(Boolean))];

      function close(result){
        host.classList.remove('on');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => host.remove(), 200);
        resolve(result);
      }
      function onKey(e){
        if(e.key === 'Escape') close(null);
        if(e.key === 'ArrowRight') step(1);
        if(e.key === 'ArrowLeft') step(-1);
        if(e.key === 'Enter'){ const r = list()[at]; if(r) close({ refId: r.id }); }
      }
      document.addEventListener('keydown', onKey);

      async function thumb(id){
        if(thumbs[id] === undefined) thumbs[id] = await Refs.thumb(id);
        return thumbs[id];
      }

      async function render(){
        const items = list();
        at = Math.max(0, Math.min(at, items.length - 1));
        const cur = items[at];
        const big = cur ? (cur.kind === 'video' ? await Refs.src(cur.id) : await thumb(cur.id)) : null;
        const strip = await Promise.all(items.map(async (r, i) => {
          const t = await thumb(r.id);
          return `<button type="button" class="sp-th${i === at ? ' on' : ''}" data-at="${i}" aria-label="Still ${i + 1}">
            ${t ? `<img src="${t}" alt="" loading="lazy">` : ''}</button>`;
        }));
        const fr = framings();
        host.innerHTML = `
          <div class="sp-top">
            <div class="sp-title"><small>Pick a still</small><b>${esc(o.title || 'Reference')}</b></div>
            <button type="button" class="sp-x" data-close aria-label="Close">${U.ICON.x || '×'}</button>
          </div>
          <div class="sp-chips">
            <button type="button" class="sp-chip${!folder ? ' on' : ''}" data-folder="">All · ${all.length}</button>
            ${dirs.map(d => `<button type="button" class="sp-chip${folder === d.id ? ' on' : ''}" data-folder="${esc(d.id)}">${esc(d.n)} · ${d.count}</button>`).join('')}
          </div>
          ${fr.length ? `<div class="sp-chips sp-sub">
            <button type="button" class="sp-chip${!framing ? ' on' : ''}" data-framing="">Any framing</button>
            ${fr.map(f => `<button type="button" class="sp-chip${framing === f ? ' on' : ''}" data-framing="${esc(f)}">${esc(f)}</button>`).join('')}
          </div>` : ''}
          <div class="sp-stage">
            ${cur
              ? (cur.kind === 'video' && big
                  ? `<video src="${big}" autoplay loop muted playsinline></video>`
                  : big ? `<img src="${big}" alt="">` : `<p class="sp-empty">This still is missing its picture.</p>`)
              : `<p class="sp-empty">${all.length ? 'Nothing here with that framing.' : 'Your Reference Library is empty. Import stills under Tools → Shots → References, or pick a file.'}</p>`}
            ${items.length > 1 ? `<button type="button" class="sp-nav prev" data-step="-1" aria-label="Previous">‹</button>
              <button type="button" class="sp-nav next" data-step="1" aria-label="Next">›</button>` : ''}
          </div>
          <div class="sp-meta">${cur ? `<span>${at + 1} of ${items.length}</span>${
            [cur.framing, cur.movement].filter(Boolean).map(t => `<span class="sp-tag">${esc(t)}</span>`).join('')}${
            cur.note ? `<span class="sp-note">${esc(cur.note)}</span>` : ''}` : ''}</div>
          <div class="sp-strip">${strip.join('')}</div>
          <div class="sp-cta">
            <button type="button" class="btn-primary" data-use ${cur ? '' : 'disabled'}>Use this still</button>
            <button type="button" class="btn-ghost" data-file>From files…</button>
          </div>`;
        const on = host.querySelector('.sp-th.on');
        if(on) on.scrollIntoView({ block:'nearest', inline:'center' });
      }

      function step(d){
        const n = list().length;
        if(!n) return;
        at = (at + d + n) % n;
        render();
      }

      host.addEventListener('click', e => {
        const t = e.target;
        if(t.closest('[data-close]')) return close(null);
        if(t.closest('[data-use]')){ const r = list()[at]; if(r) close({ refId: r.id }); return; }
        if(t.closest('[data-file]')) return close({ file: true });
        const s = t.closest('[data-step]'); if(s) return step(+s.dataset.step);
        const th = t.closest('[data-at]'); if(th){ at = +th.dataset.at; return render(); }
        const f = t.closest('[data-folder]'); if(f){ folder = f.dataset.folder; framing = ''; at = 0; return render(); }
        const g = t.closest('[data-framing]'); if(g){ framing = g.dataset.framing; at = 0; return render(); }
      });

      /* swipe across the big frame */
      let sx = null;
      host.addEventListener('pointerdown', e => { if(e.target.closest('.sp-stage')) sx = e.clientX; });
      host.addEventListener('pointerup', e => {
        if(sx == null) return;
        const dx = e.clientX - sx; sx = null;
        if(Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      });

      await render();
      requestAnimationFrame(() => host.classList.add('on'));
    });
  }

  global.StillsPicker = { open };
})(window);
