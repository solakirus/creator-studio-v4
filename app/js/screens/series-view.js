/* One series, opened.

   Tapping a series used to go straight to its edit form, which meant the run
   itself — the thing you actually want to look at before a shoot — had nowhere
   to be seen. This is that: what is in it, grouped by where each piece stands. */
(function(){

  const esc = s => U.esc(s);   /* shared: util.js */


  async function mount(el, params){
    let run = null, vids = [], clips = [], chans = [], today = 1;
    let swipes = [], thumbs = {};
    let vq = '', vstage = 'all';   /* the filter over this series' videos */
    const dropOpen = new Set();     /* v4: videos whose shots drop-down is open */

    async function load(){
      const list = await Data.seriesWithProgress();
      run = list.find(s => s.id === params.id) || null;
      /* v4: a series' videos are clips in it (clipflow.js) — the old video
         records are turned into clips first, once */
      try { if(window.ClipFlow) await ClipFlow.migrate(); } catch(e){}
      try { vids = window.ClipFlow ? await ClipFlow.parts(params.id) : []; } catch(e){ vids = []; }
      clips = vids;
      try { chans = await Channels.all(); } catch(e){ chans = []; }

      /* the references marked as this series' bar, and any covers uploaded for
         them — the same two stores the swipe file reads */
      try {
        const r = await Store.all('swipes');
        swipes = r.values;
      } catch(e){ swipes = []; }
      try {
        const blobs = await Store.allMap('swipe-thumb');
        Object.values(thumbs).forEach(URL.revokeObjectURL);
        thumbs = {};
        Object.entries(blobs).forEach(([k, b]) => thumbs[k] = URL.createObjectURL(b));
      } catch(e){ thumbs = {}; }
      try { today = await Data.currentDay(); } catch(e){ today = 1; }
    }

    const chanColour = name => {
      const c = chans.find(x => x.n === name);
      return c && c.c ? c.c : 'var(--muted)';
    };

    /* one of the series' videos — a clip, opened on the clip page */
    const stageK = c => c.stage || Lifecycle.FROM_CLIP[c.state] || 'idea';
    function videoCard(v){
      const k = stageK(v);
      const st = Lifecycle.stage(k);
      const i = Lifecycle.ORDER.indexOf(k);
      const pct = Math.round(((i + 1) / Lifecycle.ORDER.length) * 100);
      const n = vids.indexOf(v) + 1;
      const p = v.plan || {};
      return `
        <article class="mediacard"><div class="card" data-video="${v.id}">
          <div class="art" style="background-image:${U.generatedArt(v.id, v.title)}"></div>
          <span class="state" style="background:${st.c};color:#151515">${st.label}</span>
          <div class="body"><h3>${esc(v.title)}</h3>
            <div class="meta"><span class="st">Part ${n}</span>
              ${p.structure && p.structure.name ? `<span class="sep">|</span><span class="st">${esc(p.structure.name)}</span>` : ''}
              ${window.ShotList ? `<span class="sep">|</span>${ShotList.dropChip(v, 'clip:' + v.id, dropOpen.has('clip:' + v.id))}` : ''}
            </div>
          </div>
          <div class="progress"><i style="width:${pct}%"></i></div>
        </div>${dropOpen.has('clip:' + v.id) ? `<div class="subs" data-sldrop-body="clip:${v.id}"></div>` : ''}</article>`;
    }

    /* search looks in the title and the notes; the stage narrows it further */
    function shownVids(){
      const t = vq.trim().toLowerCase();
      return vids.filter(v => (vstage === 'all' || stageK(v) === vstage) &&
        (!t || `${v.title || ''} ${(v.plan || {}).notes || ''} ${(v.plan || {}).hook || ''} ${(v.plan || {}).tags || ''}`.toLowerCase().includes(t)));
    }

    /* A series can have its own standard, separate from the channel's: the
       channel is the brand, a series is one format inside it. */
    const refsFor = () => swipes.filter(x => x.barSeries === (run && run.id));

    const refCover = x => thumbs[x.id] ? `url(${thumbs[x.id]})`
      : x.imageUrl ? `url('${String(x.imageUrl).replace(/'/g, '%27').replace(/"/g, '%22')}')`
      : (window.Embed && Embed.poster(x.url)) ? `url(${Embed.poster(x.url)})`
      : U.generatedArt(x.id, x.title || '?', 300, 200);

    const refCard = x => {
      const canEmbed = window.Embed && !thumbs[x.id] && !x.imageUrl
        && Embed.can(x.url) && !Embed.poster(x.url);
      return `<button class="chswipe bar" data-swipe="${x.id}">
        <span class="cs-thumb${canEmbed ? ' hasembed' : ''}"
          style="background-image:${refCover(x)}">
          ${canEmbed ? Embed.html(x.url, { ratio:'100%' }) : ''}
        </span>
        <span class="cs-t"><b>${esc(x.title || 'Untitled')}</b>
          <small>${esc(x.source || '')}</small></span>
      </button>`;
    };

    function render(){
      if(!run){
        el.innerHTML = Screens.bar({ title:'Series' }) +
          '<div class="view"><div class="empty"><b>Not found</b>That series is gone.</div></div>';
        return;
      }

      const refs = refsFor();

      el.innerHTML = Screens.bar({ kicker:'Series', title:run.title,
        actions:`<button class="btn-sm accent" data-a="edit">Edit</button>` }) + `
        <div class="view">
          <div class="pagehead"><h1 class="page-title">${esc(run.title)}</h1></div>
          <p class="hintline" style="margin:0 0 16px">
            ${run.channel ? `<b style="color:${chanColour(run.channel)}">${esc(run.channel)}</b> · ` : ''}
            ${run.cadence} · ${run.done} of ${run.total} out</p>

          ${run.about || (run.kinds || []).length || run.format ? `<div style="margin:0 0 16px">
            ${run.about ? `<p style="margin:0 0 10px;font-size:15.5px;line-height:1.55">${esc(run.about)}</p>` : ''}
            ${(run.kinds || []).length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px">${run.kinds.map(k =>
              `<span class="cp-pill">${esc(k)}</span>`).join('')}</div>` : ''}
            ${run.format ? `<p class="hintline" style="margin:4px 0 0">${esc(run.format)}</p>` : ''}
          </div>` : `<button class="btn-ghost" data-a="edit" style="width:100%;margin:0 0 16px">
            + Describe this series and its type of videos</button>`}

          <div class="phstats">
            <div><b>${vids.length}</b><small>videos</small></div>
            <div><b>${run.raw || 0}</b><small>to edit</small></div>
            <div><b>${run.queued || 0}</b><small>to post</small></div>
            <div><b>${run.done || 0}</b><small>published</small></div>
          </div>

          <!-- What this series is and what good looks like, under the numbers.
               The status tells you where it stands; this tells you what you
               were trying to make. -->
          ${run.about
            ? `<p class="qt-topic">${esc(run.about)}</p>`
            : `<p class="qt-topic"><i>No description yet — what is this series about?</i></p>`}
          ${run.voice ? `<p class="qt-thru"><b>Voice</b> · ${esc(run.voice)}</p>` : ''}

          <div class="sec" style="margin-top:20px"><h2>The bar</h2><div class="rule"></div>
            <span class="alt">${refs.length}</span></div>
          <p class="hintline" style="margin:0 0 12px">The videos this one should feel like.</p>
          ${refs.length
            ? `<div class="chgrid">${refs.map(refCard).join('')}</div>`
            : `<div class="empty"><b>Nothing marked yet</b>
                Add a reference and it shows here.</div>`}
          <button class="btn-ghost" data-a="addref" style="width:100%;margin:10px 0 18px">
            Add a reference</button>

          <div class="sec"><h2>Videos in this series</h2><div class="rule"></div>
            <span class="alt">${shownVids().length === vids.length ? vids.length : `${shownVids().length} of ${vids.length}`}</span></div>
          ${vids.length > 1 ? `<div class="vidbar" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin:0 0 12px">
            <input id="sv-q" class="pgbar" type="search" placeholder="Search these videos…" value="${esc(vq)}" autocomplete="off">
            <select id="sv-s" class="pgbar">
              <option value="all" ${vstage === 'all' ? 'selected' : ''}>Every stage</option>
              ${Lifecycle.STAGES.map(st => { const n = vids.filter(v => stageK(v) === st.k).length;
                return n ? `<option value="${st.k}" ${vstage === st.k ? 'selected' : ''}>${st.label} · ${n}</option>` : ''; }).join('')}
            </select>
          </div>` : ''}
          ${vids.length
            ? (shownVids().length ? `<div class="list" id="sv-list">${shownVids().map(videoCard).join('')}</div>`
               : `<div class="empty" id="sv-list"><b>Nothing matches</b>Try another word or stage.</div>`)
            : `<div class="empty"><b>Nothing planned yet</b>
                Add a video below — it opens on its Plan, like a clip.</div>`}

          <button class="btn-ghost" data-a="newvideo" style="width:100%;margin:18px 0 0">
            Add a video to this series</button>
          <button class="btn-ghost" data-a="bulkideas" style="width:100%;margin:8px 0 0">
            Add several ideas at once</button>
        </div>`;
      if(window.ShotList){ ShotList.fillPics(el); ShotList.wireDrops(el, dropOpen); }
    }

    const refresh = async () => { await load(); render(); if(params.onChange) params.onChange(); };

    /* typing redraws only the list, so the keyboard stays up */
    el.addEventListener('input', e => {
      if(e.target.id !== 'sv-q') return;
      vq = e.target.value;
      const list = el.querySelector('#sv-list'), n = shownVids();
      const html = n.length ? `<div class="list" id="sv-list">${n.map(videoCard).join('')}</div>`
        : `<div class="empty" id="sv-list"><b>Nothing matches</b>Try another word or stage.</div>`;
      if(list) list.outerHTML = html;
      if(window.ShotList){ ShotList.fillPics(el); ShotList.wireDrops(el, dropOpen); }
      const alt = el.querySelector('.sec .alt');
      if(alt) alt.textContent = n.length === vids.length ? vids.length : `${n.length} of ${vids.length}`;
    });
    el.addEventListener('change', e => {
      if(e.target.id === 'sv-s'){ vstage = e.target.value; render(); }
    });

    /* A reference saved here belongs to this series, and to its channel — the
       swipe file is one place, so it should still be findable there. */
    function addRefSheet(){
      App.sheet(`
        <h2 style="margin:0 0 3px">A reference for ${esc(run.title)}</h2>
        <p class="hintline" style="margin:0 0 14px">Paste a link. It is saved to the swipe
          file, marked as the bar for this series.</p>
        <input id="sv-url" class="pgname" type="url" placeholder="https://"
          inputmode="url" autocomplete="off">
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save it</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheet => {
        sheet.addEventListener('click', async ev => {
          if(ev.target.closest('[data-cancel]')) return App.closeSheet();
          if(!ev.target.closest('[data-save]')) return;

          const url = sheet.querySelector('#sv-url').value.trim();
          if(!url) return U.toast('Paste a link first');

          const rec = { id:'sw_' + Date.now().toString(36), url,
            title:'Untitled swipe', source:'', intent:'Education',
            hook:'', beats:[], why:'', transferable:'', myAngle:'',
            channels: run.channel ? [run.channel] : [],
            barSeries: run.id, createdAt:Date.now() };

          await Store.put('swipes', rec);
          App.closeSheet();
          U.toast('Fetching details…');
          /* the swipe file's own lookup names it and finds its cover */
          if(window.LinkMeta){
            try {
              const m = await LinkMeta.get(url);
              if(m){
                if(m.title) rec.title = m.title;
                if(m.author) rec.author = m.author;
                if(m.image) rec.imageUrl = m.image;
                await Store.put('swipes', rec);
              }
            } catch(err){}
          }
          await load(); render();
        });
        setTimeout(() => { const f = sheet.querySelector('#sv-url'); if(f) f.focus(); }, 180);
      });
    }

    el.addEventListener('click', async e => {
      if(e.target.closest('[data-a="addref"]')) return addRefSheet();

      const swc = e.target.closest('[data-swipe]');
      if(swc) return Screens.push('swipe', { id:swc.dataset.swipe,
        onChange:async () => { await load(); render(); } });

      /* the series form, opened right here: it used to just go back to the list */
      if(e.target.closest('[data-a="edit"]')){
        if(!window.ViewSeries || !ViewSeries.edit) return Screens.pop();
        return ViewSeries.edit(params.id, async r => {
          if(r && r.deleted) return Screens.pop();
          await refresh();
        });
      }

      /* a new video opens already belonging to this series */
      if(e.target.closest('[data-a="newvideo"]')){
        App.sheet(`<h2 style="margin:0 0 4px">A video for ${esc(run.title)}</h2>
          <p class="hintline" style="margin:0 0 12px">It opens on its Plan — purpose, script and shots — and goes Plan → Shoot → Edit → Post like any clip.</p>
          <input id="sv-nt" class="pgname" type="text" placeholder="What is it called?" autocomplete="off" enterkeyhint="done">
          <div class="sheetcta"><button class="btn-primary" data-go>Make it</button><button class="btn-ghost" data-cancel>Cancel</button></div>`, sh => {
          const go = async () => {
            const title = sh.querySelector('#sv-nt').value.trim();
            if(!title) return U.toast('Give it a name');
            const order = Math.max(0, ...vids.map(x => +x.order || 0)) + 1;
            const c = await Data.saveClip({ title, seriesId:params.id, channel:(run && run.channel) || '', state:'raw', stage:'idea',
              order, plan:{ tab:'plan' } });
            App.closeSheet();
            await refresh();
            Screens.push('clip', { id:c.id, tab:'plan' });
          };
          sh.addEventListener('click', ev => { if(ev.target.closest('[data-cancel]')) return App.closeSheet(); if(ev.target.closest('[data-go]')) go(); });
          sh.querySelector('#sv-nt').addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); go(); } });
          setTimeout(() => sh.querySelector('#sv-nt').focus(), 180);
        });
        return;
      }

      /* A list pasted in, one video idea per line, each becoming a video at the
         Idea stage in this series. "Title — note" or "Title | note" keeps a note. */
      if(e.target.closest('[data-a="bulkideas"]')){
        App.sheet(`<h2>Add ideas</h2>
          <div class="field"><label for="bi-list">One idea per line</label>
            <textarea id="bi-list" rows="9" placeholder="What is a datacenter?&#10;How the internet gets to your phone — start with the fibre&#10;Build a homelab for $200 | parts list in the description"></textarea></div>
          <p style="margin:-4px 0 14px;color:var(--muted);font-size:13.5px;line-height:1.5">Add a note after
            <b>—</b> or <b>|</b>. Titles already in this series are skipped.</p>
          <div class="sheetcta"><button class="btn-primary" data-go>Add</button>
            <button class="btn-ghost" data-cancel>Cancel</button></div>`, sh => {
          const ta = sh.querySelector('#bi-list'), go = sh.querySelector('[data-go]');
          const lines = () => ta.value.split('\n').map(x => x.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);
          ta.addEventListener('input', () => { const n = lines().length; go.textContent = n > 1 ? `Add ${n} ideas` : 'Add'; });
          sh.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-go]')) return;
            const list = lines();
            if(!list.length) return U.toast('Write at least one idea');
            const have = new Set(vids.map(x => String(x.title || '').trim().toLowerCase()));
            let order = Math.max(0, ...vids.map(x => +x.order || 0));
            const now = Date.now();
            let added = 0, skipped = 0;
            for(const line of list){
              const m = /^(.*?)\s+(?:—|\|)\s+(.*)$/.exec(line);
              const title = (m ? m[1] : line).trim(), note = m ? m[2].trim() : '';
              if(!title || have.has(title.toLowerCase())){ skipped++; continue; }
              have.add(title.toLowerCase()); order++;
              await Data.saveClip({ title, seriesId:params.id, channel:(run && run.channel) || '', state:'raw',
                                  stage:'idea', order, createdAt: now + order, plan:{ notes:note } });
              added++;
            }
            App.closeSheet();
            U.toast(`Added ${added} idea${added === 1 ? '' : 's'}${skipped ? ` · ${skipped} already here` : ''}`);
            refresh();
          });
          setTimeout(() => ta.focus(), 180);
        });
        return;
      }

      /* v4: the shots drop-down, as on a task */
      if(window.ShotList && ShotList.toggleDrop(e, dropOpen)) return render();
      /* v4: a series' video is a clip — it opens on the clip page */
      const v = e.target.closest('[data-video]');
      if(v) return Screens.push('clip', { id:v.dataset.video, onChange: refresh });
    });

    await load();
    render();
  }

  Screens.register('series-view', mount);
})();
