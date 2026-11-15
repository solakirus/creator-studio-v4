/* v4: Content → Transitions — Eyecandy's techniques to watch and place.

   A row of techniques (Crash cut, Match cut, Whip pan…), the moving pictures
   for the one picked, and the pop-out player to step through them. In the
   player: Assign to a shot (a clip, a sequence or a video, then the gap
   between two shots) and Keep (★, a short list of the ones you actually use).
   The laptop reads a technique from Eyecandy (transitions.js); the phone and
   the iPad get what it read through sync. Nothing is downloaded. */
(function(){
  const esc = s => U.esc(s);
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + 's'}`;
  const PICK_KEY = 'cs4-tr-pick';

  async function mount(el, params){
    Transitions.css();
    const embedded = !!(params && params.embedded);
    el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Content', title:'Transitions' })) + '<div class="view" id="trHost"></div>';
    const host = el.querySelector('#trHost');
    let pick = (() => { try { return localStorage.getItem(PICK_KEY) || 'all'; } catch(e){ return 'all'; } })();
    let busy = false, status = '', stopped = false, q = '';
    const OPEN_KEY = 'cs4-tr-group';
    let openG = (() => { try { return localStorage.getItem(OPEN_KEY) || ''; } catch(e){ return ''; } })();
    const setOpen = v => { openG = v; try { localStorage.setItem(OPEN_KEY, v); } catch(e){} };
    const techsIn = (techs, k) => techs.filter(t => Transitions.groupOf(t.slug) === k);
    const setPick = v => { pick = v; try { localStorage.setItem(PICK_KEY, v); } catch(e){} };

    /* pick: 'kept' | 'all' | 'g:<group>' | a technique; q narrows any of them
       by the clip's title or its technique's name */
    async function shown(){
      const recs = await Transitions.all();
      recs.sort((a, b) => (b.kept ? 1 : 0) - (a.kept ? 1 : 0) || (a.at || 0) - (b.at || 0));
      const g = pick.startsWith('g:') ? pick.slice(2) : '';
      let list = pick === 'kept' ? recs.filter(r => r.kept) : pick === 'all' ? recs
        : g ? recs.filter(r => (r.tech || []).some(x => Transitions.groupOf(x) === g)) : recs.filter(r => (r.tech || []).includes(pick));
      if(q){
        const words = q.toLowerCase().split(/\s+/).filter(Boolean);
        list = list.filter(r => { const hay = [r.title || ''].concat((r.tech || []).map(Transitions.techName)).join(' ').toLowerCase(); return words.every(w => hay.includes(w)); });
      }
      return { recs, list };
    }

    /* your own swipes about how to do a transition — tagged Transition (under
       Technique, or the older Use it for) — in a section of their own */
    async function mySwipes(){
      if(!window.SwipeTags) return [];
      const tg = await SwipeTags.byId();
      const ids = new Set(Object.keys(tg).filter(id => /^transitions?$/i.test(tg[id].tag.name)));
      if(!ids.size) return [];
      let all = [];
      try { all = (await Store.all('swipes')).values || []; } catch(e){}
      let list = all.filter(x => x && !x.deleted && (x.tagIds || []).some(id => ids.has(id)));
      if(q){ const words = q.toLowerCase().split(/\s+/).filter(Boolean); list = list.filter(x => { const hay = [x.title || '', x.hook || '', x.why || ''].join(' ').toLowerCase(); return words.every(w => hay.includes(w)); }); }
      return list.sort((a, b) => (b.savedAt || b.createdAt || 0) - (a.savedAt || a.createdAt || 0));
    }
    const swCover = async x => {
      try { const b = await Store.get('swipe-thumb', x.id); if(b) return `url(${URL.createObjectURL(b)})`; } catch(e){}
      if(x.imageUrl) return `url('${String(x.imageUrl).replace(/'/g, '%27').replace(/"/g, '%22')}')`;
      const po = window.Embed ? Embed.poster(x.url) : null;
      return po ? `url(${po})` : U.generatedArt(x.id, x.title || '?', 300, 375);
    };

    async function render(){
      if(!host.isConnected) return;
      const techs = await Transitions.techs();
      const gk = pick.startsWith('g:') ? pick.slice(2) : '';
      if(!['all', 'kept', 'swipes'].includes(pick) && !gk && !techs.some(t => t.slug === pick)) setPick('all');
      const sws = await mySwipes();
      const { recs, list } = await shown();
      const count = slug => recs.filter(r => (r.tech || []).includes(slug)).length;
      const kept = recs.filter(r => r.kept).length;
      const cur = techs.find(t => t.slug === pick);
      const groups = Transitions.GROUPS.concat({ k:'other', label:'Other' }).map(g => {
        const ts = techsIn(techs, g.k);
        return { ...g, ts, clips:recs.filter(r => (r.tech || []).some(x => Transitions.groupOf(x) === g.k)).length };
      }).filter(g => g.ts.length);
      if(openG && !groups.some(g => g.k === openG)) setOpen('');
      const og = groups.find(g => g.k === openG);
      const can = Transitions.canRead();
      /* what Read reads: this technique, the open group's unread ones, or every unread one */
      const unread = (gk ? techsIn(techs, gk) : techs).filter(t => !t.readAt);
      const readBtn = !can ? '' : busy ? '<button class="btn-sm" data-a="stop">Stop</button>'
        : cur ? `<button class="btn-sm${cur.readAt ? '' : ' accent'}" data-a="read">${cur.readAt ? 'Read it again' : 'Read from Eyecandy'}</button>`
        : pick !== 'kept' && unread.length ? `<button class="btn-sm accent" data-a="readall">Read ${plural(unread.length, 'technique')}${gk ? '' : ' from Eyecandy'}</button>` : '';
      const gname = gk ? (groups.find(g => g.k === gk) || {}).label || '' : '';
      const sel = document.activeElement && document.activeElement.matches && document.activeElement.matches('.trs-search');
      host.innerHTML = `<div class="pagehead"><h1 class="page-title">Transitions</h1><span class="count">${recs.length}</span></div>
        <div class="trs-pills trs-top">
          <input class="trs-search" type="search" value="${esc(q)}" placeholder="Search — whip, zoom, match…" aria-label="Search transitions">
          <button data-p="kept" aria-pressed="${pick === 'kept'}">★ Kept<i>${kept}</i></button>
          <button data-p="all" aria-pressed="${pick === 'all'}">All<i>${recs.length}</i></button>
          <button data-p="swipes" aria-pressed="${pick === 'swipes'}">✂ My swipes<i>${sws.length}</i></button>
        </div>
        ${pick === 'swipes' ? `<p class="trs-swnote">Your own swipe-file videos on how to do a transition — anything tagged <b>Transition</b>. Tap one to open it.</p>
          ${sws.length ? `<div class="trs-swgrid">${(await Promise.all(sws.map(async x => `<button class="trs-sw" data-swopen="${esc(x.id)}">
              <i style="background-image:${await swCover(x)}"></i><b>${esc(x.title || 'Untitled swipe')}</b>${x.hook ? `<small>${esc(x.hook.slice(0, 90))}</small>` : ''}</button>`))).join('')}</div>`
            : `<div class="empty"><b>${q ? `No swipes match “${esc(q)}”` : 'No transition swipes yet'}</b>In the swipe file, tag a video <i>Technique → Transition</i> and it shows up here.</div>`}` : `
        <div class="trs-sels">
          <label class="trs-selw${og ? ' on' : ''}"><select data-type aria-label="Type">
            <option value="" ${og ? '' : 'selected'}>All types</option>
            ${groups.map(g => `<option value="${g.k}" ${g.k === openG ? 'selected' : ''}>${esc(g.label)} · ${g.clips ? plural(g.clips, 'clip') : plural(g.ts.length, 'type')}</option>`).join('')}
            <option value="__edit">＋ Add or remove techniques…</option>
          </select></label>
          <label class="trs-selw${cur ? ' on' : ''}${og ? '' : ' off'}"><select data-tech aria-label="Technique" ${og ? '' : 'disabled'}>
            ${og ? `<option value="" ${cur ? '' : 'selected'}>All ${esc(og.label.toLowerCase())}</option>
              ${og.ts.slice().sort((a, b) => a.name.localeCompare(b.name)).map(t => `<option value="${esc(t.slug)}" ${pick === t.slug ? 'selected' : ''}>${esc(t.name)} · ${t.readAt ? count(t.slug) : 'not read'}</option>`).join('')}`
              : '<option>Pick a type first</option>'}
          </select></label>
        </div>
        <div class="trs-bar"><span>${status ? esc(status) : q ? `${plural(list.length, 'match', 'matches')} for “${esc(q)}”`
            : cur ? `${esc(cur.name)} · ${plural(list.length, 'clip')}${cur.readAt ? '' : ' · not read yet'}`
            : gk ? `${esc(gname)} · ${plural(list.length, 'clip')}${unread.length ? ` · ${unread.length} not read yet` : ''}`
            : pick === 'kept' ? 'The ones you keep coming back to' : plural(recs.length, 'clip') + ' from ' + plural(techs.filter(t => t.readAt).length, 'technique')}</span>
          ${list.length ? `<button class="btn-sm" data-a="move" aria-pressed="${Transitions.moving()}">${Transitions.moving() ? '❚❚ Stop all' : '▶ Play all'}</button>` : ''}
          ${cur ? `<a class="btn-sm" href="${esc(Transitions.SITE + cur.slug)}" target="_blank" rel="noopener">↗ Eyecandy</a>` : ''}${readBtn}</div>
        ${list.length ? `<div class="trs-grid">${list.map(r => Transitions.cellHTML(r, 'data-w')).join('')}</div>`
          : q ? `<div class="empty"><b>Nothing matches “${esc(q)}”</b>${pick === 'all' ? 'Try another word.' : 'Try All, or another word.'}</div>`
          : `<div class="empty"><b>${pick === 'kept' ? 'Nothing kept yet' : cur ? 'Not read yet' : 'No transitions yet'}</b>${
              pick === 'kept' ? 'Open one and tap ☆ Keep — the ones you use go here.'
              : can ? `Tap “${cur ? 'Read from Eyecandy' : 'Read …'}” and the app looks at ${cur ? 'its page' : 'their pages'} for you — links only, nothing is downloaded.`
              : 'Open the Transitions tab on the laptop and read them from Eyecandy there. They show up here on their own.'}</div>`}`}`;
      Transitions.wireImgs(host);
      if(sel){ const f = host.querySelector('.trs-search'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    }

    async function readList(slugs){
      if(busy || !slugs.length) return;
      busy = true; stopped = false; status = 'Opening Eyecandy…'; render();
      try {
        const r = await Transitions.read(slugs, {
          line: l => { const m = /^\s*(✗.*|.*found.*|Reading .*|.*check.*)$/.exec(l); if(m){ status = m[1].trim(); const s = host.querySelector('.trs-bar span'); if(s) s.textContent = status; } },
          step: () => render(), stopped: () => stopped,
          page: (slug, n, found) => { status = `${Transitions.techName(slug)} · page ${n} · ${found} clips so far`; render(); }
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
          <p class="k" style="margin:14px 0 6px;color:var(--muted);font-size:12px">Add from Eyecandy${rest.length ? ` · ${rest.length} more` : ''}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px">${rest.length ? `<button class="btn-sm accent" data-addall>＋ Add all ${rest.length}</button>` : ''}
            ${Transitions.canRead() ? '<button class="btn-sm" data-a="discover">Check Eyecandy for new ones</button>' : ''}</div>
          <div class="trs-tl add">${rest.map(s => `<button data-add="${esc(s)}">＋ ${esc(Transitions.techName(s))}</button>`).join('')}</div>
          <p class="k" style="margin:14px 0 6px;color:var(--muted);font-size:12px">Or paste a link — a technique page or one moving picture</p>
          <div style="display:flex;gap:6px"><input class="trs-q" style="margin:0" data-link placeholder="https://eyecannndy.com/technique/…" aria-label="Link">
            <button class="btn-sm" data-a="paste">Add</button></div>
          <div class="sheetcta"><button class="btn-ghost" data-no>Done</button></div>`, sh => {
          sh.addEventListener('click', async e => {
            if(e.target.closest('[data-no]')){ App.closeSheet(); return render(); }
            if(e.target.closest('[data-addall]')){
              const l = await Transitions.techs(), have2 = new Set(l.map(t => t.slug));
              await Transitions.setTechs(l.concat(Transitions.ALL_TECHS.filter(x => !have2.has(x)).map(slug => ({ slug }))));
              U.toast('All of Eyecandy’s techniques added — read them under All');
              setPick('all'); App.closeSheet(); return render();
            }
            if(e.target.closest('[data-a="discover"]')){
              e.target.closest('[data-a="discover"]').textContent = 'Looking…';
              try {
                const n = await Transitions.discover();
                U.toast(n.length ? `${plural(n.length, 'new technique')} found: ${n.map(Transitions.techName).join(', ')}` : 'No new techniques — you have the full list');
              } catch(err){ U.toast(err.message || 'That didn’t work'); }
              App.closeSheet(); techSheet(); return;
            }
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

    /* two drop-downs: the type, then the exact technique within it */
    host.addEventListener('change', e => {
      const ty = e.target.closest('[data-type]'), te = e.target.closest('[data-tech]');
      if(ty){
        if(ty.value === '__edit'){ ty.value = openG; return techSheet(); }
        if(ty.value){ setOpen(ty.value); setPick('g:' + ty.value); } else { setOpen(''); setPick('all'); }
        return render();
      }
      if(te){ setPick(te.value || 'g:' + openG); return render(); }
    });
    let qt = 0;
    host.addEventListener('input', e => {
      if(!e.target.matches('.trs-search')) return;
      clearTimeout(qt);
      qt = setTimeout(() => { q = e.target.value.trim(); render(); }, 220);
    });
    host.addEventListener('click', async e => {
      const so = e.target.closest('[data-swopen]');
      if(so) return Screens.push('swipe', { id:so.dataset.swopen, onChange:render });
      const p = e.target.closest('[data-p]');
      if(p){ setPick(p.dataset.p); setOpen(''); return render(); }
      const a = e.target.closest('[data-a]');
      if(a){
        if(a.dataset.a === 'techs') return techSheet();
        if(a.dataset.a === 'move'){ Transitions.setMoving(!Transitions.moving()); return render(); }
        if(a.dataset.a === 'read') return readList([pick]);
        if(a.dataset.a === 'readall'){ const all = await Transitions.techs(), g = pick.startsWith('g:') ? pick.slice(2) : '';
          return readList((g ? techsIn(all, g) : all).filter(t => !t.readAt).map(t => t.slug)); }
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
