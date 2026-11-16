/* Tools → Shots: This week · My shots · Core references (shotbank.js).

   This week     every shot due this week across episodes and clips, plus your
                 Anytime shots, grouped by where you have to be — tick here and
                 it's ticked in its video
   My shots      your own shots and your templates, filed by place
   Core refs     the few videos that define the vlog's look (refclip.js — the
                 grabbed section plays on every device) */
(function(){
  const esc = s => U.esc(s);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const dayName = async d => { try { return new Date(await Data.dayToDate(d)).toLocaleDateString(undefined, { weekday:'short' }); } catch(e){ return 'day ' + d; } };

  /* ---------------------------------------------------------------- This week */
  async function weekScreen(el){
    let scope = 'week', show = 'todo', dev = '', rows = [], days = {};
    async function load(){
      rows = (await ShotBank.week({ scope })).rows;
      const ds = [...new Set(rows.map(r => r.day).filter(d => d != null))];
      for(const d of ds) days[d] = await dayName(d);
    }
    function render(){
      const devs = [...new Set(rows.map(r => r.dev).filter(Boolean))].sort();
      const vis = rows.filter(r => (show === 'all' || (show === 'todo' ? !r.done : r.done)) && (!dev || r.dev === dev));
      const groups = new Map();
      vis.forEach(r => { const k = r.place || ''; if(!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
      const order = [...groups.keys()].sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b));
      const left = rows.filter(r => !r.done).length;
      el.innerHTML = Screens.bar({ kicker:'Shots', title:'This week' }) + `
      <div class="view sbw">
        <div class="sl-hero"><div class="top"><b>${left}</b><span>still to<br>get</span></div>
          <div class="sl-bar"><i style="width:${rows.length ? Math.round((rows.length - left) / rows.length * 100) : 0}%"></i></div>
          <p class="hintline" style="margin:10px 0 0">${scope === 'week' ? 'Every shot on a day this week, in every episode and clip — and your Anytime shots — grouped by where you need to be.' : scope === 'nodate' ? 'Shots in a video that isn’t on a day yet.' : 'Every shot in every video.'}</p></div>
        <div class="mrail">
          <button class="pill" data-scope="week" aria-pressed="${scope === 'week'}">This week</button>
          <button class="pill" data-scope="nodate" aria-pressed="${scope === 'nodate'}">No day yet</button>
          <button class="pill" data-scope="all" aria-pressed="${scope === 'all'}">Everything</button>
        </div>
        <div class="mrail" style="margin-top:6px">
          <button class="pill" data-show="todo" aria-pressed="${show === 'todo'}">To get</button>
          <button class="pill" data-show="got" aria-pressed="${show === 'got'}">Got</button>
          <button class="pill" data-show="all" aria-pressed="${show === 'all'}">All</button>
          ${devs.length > 1 || dev ? `<span class="sb-gap"></span><button class="pill" data-dev="" aria-pressed="${!dev}">Any camera</button>${devs.map(d => `<button class="pill" data-dev="${esc(d)}" aria-pressed="${dev === d}">${esc(d)}</button>`).join('')}` : ''}
        </div>
        ${order.length ? order.map(k => {
          const g = groups.get(k);
          return `<div class="sl-loc"><b>${k ? '📍 ' + esc(k) : 'No place set'}</b><i></i><span class="n">${plural(g.filter(r => !r.done).length, 'shot')} to get</span></div>
            ${g.map(r => `<div class="sbw-row${r.done ? ' got' : ''}" data-row="${esc(r.key)}">
              <button class="bx" data-tick aria-pressed="${r.done}" aria-label="${r.done ? 'Not got' : 'Got it'}">${U.ICON.check}</button>
              ${r.item ? `<span class="sb-pic" data-slpic="${esc(r.item)}"></span>` : ''}
              <span class="tx"><b>${esc(r.name)}</b><small>${r.anytime ? '⏱ Anytime' : esc(r.video)}${r.part ? ' · ' + esc(r.part) : ''}${r.day != null && days[r.day] ? ' · ' + esc(days[r.day]) : ''}${r.dev ? ' · ' + esc(r.dev) : ''}${r.bank && !r.anytime ? ' · ★ My shot' : ''}</small></span>
              <button class="btn-sm sbw-pl" data-place title="Where it’s shot">${r.place ? '📍' : '＋ Place'}</button>
            </div>`).join('')}`;
        }).join('') : `<div class="empty"><b>${show === 'todo' && rows.length ? 'All got' : 'Nothing here'}</b>${scope === 'week'
          ? 'Put an episode’s day or a clip on a day this week, or mark shots in My shots as Anytime.' : 'No shots yet.'}</div>`}
      </div>`;
      ShotList.fillPics(el);
    }
    el.addEventListener('click', async e => {
      const s = e.target.closest('[data-scope]'); if(s){ scope = s.dataset.scope; await load(); return render(); }
      const w = e.target.closest('[data-show]'); if(w){ show = w.dataset.show; return render(); }
      const d = e.target.closest('[data-dev]'); if(d){ dev = d.dataset.dev; return render(); }
      const row = e.target.closest('[data-row]');
      if(!row) return;
      const r = rows.find(x => x.key === row.dataset.row);
      if(!r) return;
      if(e.target.closest('[data-tick]')){
        await ShotBank.tick(r, !r.done); r.done = !r.done;
        U.toast(r.done ? `Got “${r.name}”` : 'Not got');
        return render();
      }
      if(e.target.closest('[data-place]')){
        const pl = await ShotBank.places();
        App.sheet(`<h2 style="margin:0 0 6px">${esc(r.name)}</h2><p class="hintline" style="margin:0 0 10px">Where it’s shot — This week groups by it.</p>
          <div class="field">${ShotBank.placeSelect('wkPlace', pl, r.place)}</div>
          <div class="sheetcta"><button class="btn-primary" data-ok>Save</button><button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
          sh.addEventListener('click', async ev => {
            if(ev.target.closest('[data-no]')) return App.closeSheet();
            if(!ev.target.closest('[data-ok]')) return;
            const p = await ShotBank.readPlace(sh.querySelector('#wkPlace'));
            await ShotBank.setPlace(r, p); App.closeSheet(); await load(); render();
          });
        });
        return;
      }
      if(r.kind === 'episode'){ const [, vid] = r.host.split(':'); return Screens.push('vlog', { id:vid }); }
      if(r.kind === 'clip') return Screens.push('clip', { id:r.host.split(':')[1] });
      if(r.anytime){ const b = await ShotBank.get(r.id); if(b) await ShotBank.edit(b); await load(); return render(); }
    });
    await load(); render();
  }

  /* ---------------------------------------------------------------- My shots */
  async function bankScreen(el){
    let place = '';
    async function render(){
      const [bank, tpls, pl, use] = await Promise.all([ShotBank.all(), ShotBank.templates(), ShotBank.places(), ShotBank.usage()]);
      const tp = tpls.filter(t => !place || (t.place || '') === place), bk = bank.filter(b => !place || (b.place || '') === place);
      const when = t => t > 1 ? new Date(t).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }) : '';
      el.innerHTML = Screens.bar({ kicker:'Shots', title:'My shots', actions:`<button class="btn-sm accent" data-newshot>＋ Shot</button>` }) + `
      <div class="view sbb">
        <p class="hintline" style="margin:0 0 10px">Your own shots and templates, filed by place. Assign them to any episode or clip — or add them from the video (＋ Template on a sequence).</p>
        <div class="mrail"><button class="pill" data-pl="" aria-pressed="${!place}">Everywhere</button>${pl.map(p => `<button class="pill" data-pl="${esc(p)}" aria-pressed="${place === p}">${esc(p)}</button>`).join('')}
          <button class="pill" data-newplace>＋ Place</button></div>
        <div class="sec"><h2>Templates</h2><div class="rule"></div><span class="alt">${tp.length}</span></div>
        ${tp.length ? `<div class="sbb-tpls">${tp.map(t => `<div class="sbb-tpl" data-tid="${esc(t.id)}">
            <div class="sbb-th"><b>${esc(t.name || 'Template')}</b><small>${plural(t.shots.length, 'shot')}</small>
              <button class="btn-sm" data-tplace>${t.place ? '📍 ' + esc(t.place) : '＋ Place'}</button></div>
            ${ShotList.stripHTML(t.shots.map(x => ({ text:x.label || 'Shot', item:x.item })), 6) || `<p class="hintline">${esc(t.shots.map(x => x.label || 'Shot').slice(0, 4).join(' · '))}</p>`}
            <div class="sbb-acts"><button class="btn-sm accent" data-tassign>Assign to…</button><button class="btn-sm" data-topen>Edit</button></div></div>`).join('')}</div>`
          : `<p class="hintline">No templates${place ? ' for ' + esc(place) : ''} yet. In the Library, Select the shots you want → <b>▦ Make a template</b>.</p>`}
        <div class="sec"><h2>Shots</h2><div class="rule"></div><span class="alt">${bk.length}</span></div>
        ${bk.length ? `<div class="sbb-grid">${bk.map(b => { const u = use.get(b.id); return `<button class="sbb-card" data-bid="${esc(b.id)}">
            ${b.item ? `<span class="sb-pic card" data-slpic="${esc(b.item)}"></span>` : '<span class="sb-pic card none">🎥</span>'}
            <b>${esc(b.name)}</b>
            <small>${[b.place && '📍 ' + esc(b.place), b.dev && esc(b.dev), b.anytime && '⏱ Anytime'].filter(Boolean).join(' · ')}</small>
            ${(b.tags || []).length ? `<span class="sbb-tags">${b.tags.map(t => `<i>${esc(t)}</i>`).join('')}</span>` : ''}
            <small class="sbb-use">${u && u.n ? `In ${plural(u.videos.size, 'video')}` : 'Not in a video yet'}${u && u.last > 1 ? ` · got ${esc(when(u.last))}` : ''}</small>
          </button>`; }).join('')}</div>`
          : `<div class="empty"><b>No shots${place ? ' for ' + esc(place) : ''} yet</b>Add the shots you set up again and again — the gym from the phone, the kitchen overhead, the daily vlog shots.</div>`}
      </div>`;
      ShotList.fillPics(el);
    }
    el.addEventListener('click', async e => {
      const p = e.target.closest('[data-pl]'); if(p){ place = p.dataset.pl; return render(); }
      if(e.target.closest('[data-newplace]')){ const n = await ShotBank.addPlace(prompt('New place — Gym, Kitchen, Car…')); if(n){ place = n; } return render(); }
      if(e.target.closest('[data-newshot]')){ await ShotBank.edit({ place }); return render(); }
      const bc = e.target.closest('[data-bid]');
      if(bc){ const b = await ShotBank.get(bc.dataset.bid); if(b) await ShotBank.edit(b); return render(); }
      const tc = e.target.closest('[data-tid]');
      if(!tc) return;
      const t = (await ShotBank.templates()).find(x => x.id === tc.dataset.tid);
      if(!t) return;
      if(e.target.closest('[data-tassign]')) return ShotBank.assign({ name:t.name || 'Template', place:t.place || '', shots:ShotBank.tplShots(t) });
      if(e.target.closest('[data-topen]')) return Screens.push('shot-templates', { id:t.id, onChange:() => { ShotTemplates.invalidate(); render(); } });
      if(e.target.closest('[data-tplace]')){
        const pl = await ShotBank.places();
        App.sheet(`<h2 style="margin:0 0 6px">${esc(t.name || 'Template')}</h2><p class="hintline" style="margin:0 0 10px">Where it’s shot. Its shots land in This week under it.</p>
          <div class="field">${ShotBank.placeSelect('tpPlace', pl, t.place || '')}</div>
          <div class="sheetcta"><button class="btn-primary" data-ok>Save</button><button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
          sh.addEventListener('click', async ev => {
            if(ev.target.closest('[data-no]')) return App.closeSheet();
            if(!ev.target.closest('[data-ok]')) return;
            const pv = await ShotBank.readPlace(sh.querySelector('#tpPlace'));
            await ShotTemplates.save({ ...t, place:pv }); App.closeSheet(); render();
          });
        });
      }
    });
    await render();
  }

  /* ---------------------------------------------------------------- Core references */
  const CORE_KEY = 'core-refs';
  async function coreList(){ try { return (await Store.get('settings', CORE_KEY)) || []; } catch(e){ return []; } }
  const coreSave = list => Store.put('settings', list, CORE_KEY);
  async function coreScreen(el){
    async function render(){
      if(RefClip.css) RefClip.css();
      const list = await coreList();
      el.innerHTML = Screens.bar({ kicker:'Shots', title:'Core references', actions:`<button class="btn-sm accent" data-addref>＋ Reference</button>` }) + `
      <div class="view sbc">
        <p class="hintline" style="margin:0 0 12px">The few videos that define how your vlog looks and moves. ${RefClip.canGrab() ? 'Grab the section and it plays on every device, offline.' : 'Grabbed on the laptop, they play here offline.'}</p>
        ${list.length ? list.map((r, i) => `<div class="sbc-item" data-i="${i}">
            <button class="rc-play sbc-play" data-play>${r.gif ? `<span class="rc-gif" data-slpic="${esc(r.gif)}"></span>` : '▶ '}${esc(r.title || RefClip.site(r.url))}</button>
            <small>${esc(RefClip.site(r.url))} · ${esc(RefClip.label(r))}${r.clip ? ' · grabbed' : ''}${r.n ? ' — ' + esc(r.n) : ''}</small>
            <div class="sbb-acts">${RefClip.canGrab() ? `<button class="btn-sm" data-grab>${r.clip ? '⟳ Grab again' : '⬇ Grab'}</button>` : ''}<button class="btn-sm" data-edit>Edit</button><button class="btn-sm" data-del>Remove</button></div>
          </div>`).join('') : '<div class="empty"><b>None yet</b>Add the videos you keep going back to — the openers, the pacing, the look.</div>'}
      </div>`;
      ShotList.fillPics(el);
    }
    el.addEventListener('click', async e => {
      const list = await coreList();
      if(e.target.closest('[data-addref]')){
        const title = prompt('What is it? — “Casey’s morning opener”');
        if(title === null) return;
        const r = await RefClip.edit({}, title);
        if(!r || r === 'clear') return;
        let rec = { ...r, title:title.trim() || RefClip.site(r.url) };
        list.push(rec); await coreSave(list); render();
        if(r.grabNow) grab(list.length - 1);
        return;
      }
      const it = e.target.closest('[data-i]');
      if(!it) return;
      const i = +it.dataset.i, r = list[i];
      if(!r) return;
      if(e.target.closest('[data-play]')) return RefClip.play(r, r.title);
      if(e.target.closest('[data-grab]')) return grab(i);
      if(e.target.closest('[data-edit]')){
        const nr = await RefClip.edit(r, r.title);
        if(!nr) return;
        if(nr === 'clear'){ if(r.clip || r.gif) await RefClip.drop(r); list.splice(i, 1); }
        else { const moved = nr.url !== r.url || nr.start !== r.start || nr.end !== r.end; const base = moved && (r.clip || r.gif) ? await RefClip.drop(r) : r;
          list[i] = { ...base, ...nr, title:r.title }; }
        await coreSave(list); render();
        if(nr !== 'clear' && nr.grabNow) grab(i);
        return;
      }
      if(e.target.closest('[data-del]')){
        if(!confirm(`Remove “${r.title}”?`)) return;
        if(r.clip || r.gif) await RefClip.drop(r);
        list.splice(i, 1); await coreSave(list); return render();
      }
    });
    async function grab(i){
      const list = await coreList(), r = list[i];
      if(!r) return;
      U.toast('Grabbing that section…');
      try { const base = r.clip || r.gif ? await RefClip.drop(r) : r; list[i] = { ...(await RefClip.grab(base, r.title)), title:r.title }; await coreSave(list); U.toast('Grabbed — it plays on every device'); }
      catch(err){ U.toast(err.message || 'Couldn’t grab it'); }
      render();
    }
    await render();
  }

  Screens.register('shots-week', weekScreen);
  Screens.register('shot-bank', bankScreen);
  Screens.register('core-refs', coreScreen);
})();
