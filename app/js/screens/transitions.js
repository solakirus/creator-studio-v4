/* v4: Content → Transitions — Eyecandy's techniques to watch and place.

   A row of techniques (Crash cut, Match cut, Whip pan…), the moving pictures
   for the one picked, and the pop-out player to step through them. In the
   player: Assign to a shot (a clip, a sequence or a video, then the gap
   between two shots) and Keep (★, a short list of the ones you actually use).
   The laptop reads a technique from Eyecandy (transitions.js); the phone and
   the iPad get what it read through sync. Nothing is downloaded. */
(function(){
  const esc = s => U.esc(s);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const PICK_KEY = 'cs4-tr-pick';

  async function mount(el, params){
    Transitions.css();
    const embedded = !!(params && params.embedded);
    el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Content', title:'Transitions' })) + '<div class="view" id="trHost"></div>';
    const host = el.querySelector('#trHost');
    let pick = (() => { try { return localStorage.getItem(PICK_KEY) || 'all'; } catch(e){ return 'all'; } })();
    let busy = false, status = '', stopped = false;
    const setPick = v => { pick = v; try { localStorage.setItem(PICK_KEY, v); } catch(e){} };

    async function shown(){
      const recs = await Transitions.all();
      recs.sort((a, b) => (b.kept ? 1 : 0) - (a.kept ? 1 : 0) || (a.at || 0) - (b.at || 0));
      return { recs, list: pick === 'kept' ? recs.filter(r => r.kept) : pick === 'all' ? recs : recs.filter(r => (r.tech || []).includes(pick)) };
    }

    async function render(){
      if(!host.isConnected) return;
      const techs = await Transitions.techs();
      if(!['all', 'kept'].includes(pick) && !techs.some(t => t.slug === pick)) setPick('all');
      const { recs, list } = await shown();
      const count = slug => recs.filter(r => (r.tech || []).includes(slug)).length;
      const kept = recs.filter(r => r.kept).length;
      const cur = techs.find(t => t.slug === pick);
      const can = Transitions.canRead();
      const unread = techs.filter(t => !t.readAt);
      const readBtn = !can ? '' : busy ? '<button class="btn-sm" data-a="stop">Stop</button>'
        : cur ? `<button class="btn-sm${cur.readAt ? '' : ' accent'}" data-a="read">${cur.readAt ? 'Read it again' : 'Read from Eyecandy'}</button>`
        : unread.length ? `<button class="btn-sm accent" data-a="readall">Read ${plural(unread.length, 'technique')} from Eyecandy</button>` : '';
      host.innerHTML = `<div class="pagehead"><h1 class="page-title">Transitions</h1><span class="count">${recs.length}</span></div>
        <div class="trs-pills">
          <button data-p="kept" aria-pressed="${pick === 'kept'}">★ Kept<i>${kept}</i></button>
          <button data-p="all" aria-pressed="${pick === 'all'}">All<i>${recs.length}</i></button>
          ${techs.map(t => `<button data-p="${esc(t.slug)}" aria-pressed="${pick === t.slug}">${esc(t.name)}<i>${count(t.slug) || (t.readAt ? 0 : '·')}</i></button>`).join('')}
          <button data-a="techs" aria-label="Add or remove techniques">＋ Technique</button>
        </div>
        <div class="trs-bar"><span>${status ? esc(status) : cur ? `${esc(cur.name)} · ${plural(list.length, 'clip')}${cur.readAt ? '' : ' · not read yet'}`
            : pick === 'kept' ? 'The ones you keep coming back to' : plural(recs.length, 'clip') + ' from ' + plural(techs.filter(t => t.readAt).length, 'technique')}</span>
          ${cur ? `<a class="btn-sm" href="${esc(Transitions.SITE + cur.slug)}" target="_blank" rel="noopener">↗ Eyecandy</a>` : ''}${readBtn}</div>
        ${list.length ? `<div class="trs-grid">${list.map(r => Transitions.cellHTML(r, 'data-w')).join('')}</div>`
          : `<div class="empty"><b>${pick === 'kept' ? 'Nothing kept yet' : cur ? 'Not read yet' : 'No transitions yet'}</b>${
              pick === 'kept' ? 'Open one and tap ☆ Keep — the ones you use go here.'
              : can ? `Tap “${cur ? 'Read from Eyecandy' : 'Read … from Eyecandy'}” and the app looks at ${cur ? 'its page' : 'their pages'} for you — links only, nothing is downloaded.`
              : 'Open the Transitions tab on the laptop and read them from Eyecandy there. They show up here on their own.'}</div>`}`;
      Transitions.wireImgs(host);
    }

    async function readList(slugs){
      if(busy || !slugs.length) return;
      busy = true; stopped = false; status = 'Opening Eyecandy…'; render();
      try {
        const r = await Transitions.read(slugs, {
          line: l => { const m = /^\s*(✗.*|.*found.*|Reading .*|.*check.*)$/.exec(l); if(m){ status = m[1].trim(); const s = host.querySelector('.trs-bar span'); if(s) s.textContent = status; } },
          step: () => render(), stopped: () => stopped
        });
        status = '';
        U.toast(r.found ? `${plural(r.found, 'clip')} found${r.added ? ` · ${r.added} new` : ''}` : 'Nothing found — is the page behind a check? Try again.');
      } catch(e){ status = ''; U.toast(e.message || 'That didn’t work'); }
      busy = false; render();
    }

    function techSheet(){
      (async () => {
        const list = await Transitions.techs();
        const have = new Set(list.map(t => t.slug));
        const rest = Transitions.ALL_TECHS.filter(s => !have.has(s));
        App.sheet(`<h2 style="margin:0 0 4px">Techniques</h2>
          <p class="hintline" style="margin:0 0 10px">Yours, then the rest of Eyecandy’s. Tap × to drop one (its clips stay under All).</p>
          <div class="trs-tl">${list.map(t => `<span>${esc(t.name)}<button data-rm="${esc(t.slug)}" aria-label="Remove ${esc(t.name)}">×</button></span>`).join('')}</div>
          <p class="k" style="margin:14px 0 6px;color:var(--muted);font-size:12px">Add from Eyecandy</p>
          <div class="trs-tl add">${rest.map(s => `<button data-add="${esc(s)}">＋ ${esc(Transitions.techName(s))}</button>`).join('')}</div>
          <p class="k" style="margin:14px 0 6px;color:var(--muted);font-size:12px">Or paste a link — a technique page or one moving picture</p>
          <div style="display:flex;gap:6px"><input class="trs-q" style="margin:0" data-link placeholder="https://eyecannndy.com/technique/…" aria-label="Link">
            <button class="btn-sm" data-a="paste">Add</button></div>
          <div class="sheetcta"><button class="btn-ghost" data-no>Done</button></div>`, sh => {
          sh.addEventListener('click', async e => {
            if(e.target.closest('[data-no]')){ App.closeSheet(); return render(); }
            const rm = e.target.closest('[data-rm]'), ad = e.target.closest('[data-add]');
            if(rm || ad){
              const l = await Transitions.techs();
              const next = rm ? l.filter(t => t.slug !== rm.dataset.rm) : l.concat({ slug:ad.dataset.add });
              await Transitions.setTechs(next);
              if(ad) setPick(ad.dataset.add);
              App.closeSheet(); techSheet(); return;
            }
            if(e.target.closest('[data-a="paste"]')){
              const v = sh.querySelector('[data-link]').value;
              try {
                const r = await Transitions.addLink(v);
                if(r.tech) setPick(r.tech);
                U.toast(r.tech ? `${Transitions.techName(r.tech)} added` : 'Added under All');
                App.closeSheet(); render();
              } catch(err){ U.toast(err.message); }
            }
          });
        });
      })();
    }

    host.addEventListener('click', async e => {
      const p = e.target.closest('[data-p]');
      if(p){ setPick(p.dataset.p); return render(); }
      const a = e.target.closest('[data-a]');
      if(a){
        if(a.dataset.a === 'techs') return techSheet();
        if(a.dataset.a === 'read') return readList([pick]);
        if(a.dataset.a === 'readall') return readList((await Transitions.techs()).filter(t => !t.readAt).map(t => t.slug));
        if(a.dataset.a === 'stop'){ stopped = true; try { await CS3Lib.grabStop(); } catch(err){} return; }
      }
      const w = e.target.closest('[data-w]');
      if(w){
        const { list } = await shown();
        Transitions.watch(list, Math.max(0, list.findIndex(r => r.id === w.dataset.w)), { onChange:render, onClose:render });
      }
    });
    await render();
  }

  Screens.register('transitions', mount);
})();
