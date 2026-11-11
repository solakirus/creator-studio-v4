/* One series, opened.

   Tapping a series used to go straight to its edit form, which meant the run
   itself — the thing you actually want to look at before a shoot — had nowhere
   to be seen. This is that: what is in it, grouped by where each piece stands. */
(function(){

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  const CLIP_STAGE = [
    { k:'raw',    label:'Shot, needs editing', c:'#E8A33D' },
    { k:'queued', label:'Edited, needs posting', c:'#FB6900' },
    { k:'posted', label:'Out', c:'#5BBE6A' }
  ];

  async function mount(el, params){
    let run = null, vids = [], clips = [], chans = [], today = 1;
    let swipes = [], thumbs = {};
    let vq = '', vstage = 'all';   /* the filter over this series' videos */

    async function load(){
      const list = await Data.seriesWithProgress();
      run = list.find(s => s.id === params.id) || null;
      try { vids = await Videos.forSeries(params.id); } catch(e){ vids = []; }
      /* numbered ideas read in their order; anything unnumbered stays newest first after them */
      vids.sort((a, b) => ((+a.order || 1e9) - (+b.order || 1e9)) || ((b.createdAt || 0) - (a.createdAt || 0)));
      try { clips = (await Data.clips()).filter(c => c.seriesId === params.id); }
      catch(e){ clips = []; }
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

    function videoCard(v){
      const st = Videos.stage(v.stage);
      const i = Videos.STAGES.findIndex(x => x.k === v.stage);
      const pct = Math.round(((i + 1) / Videos.STAGES.length) * 100);
      const when = v.day != null ? (v.day === today ? 'today' : v.day < today
        ? `day ${v.day} · passed` : `day ${v.day}`) : 'no day yet';
      return `
        <article class="mediacard"><div class="card" data-video="${v.id}">
          <div class="art" style="background-image:${U.generatedArt(v.id, v.title)}"></div>
          <span class="state" style="background:${st.c};color:#151515">${st.label}</span>
          <div class="body"><h3>${esc(v.title)}</h3>
            <div class="meta"><span class="st">${when}</span>
              ${(v.tags || []).length ? `<span class="sep">|</span>
                <span class="st">${v.tags.map(t => '#' + esc(t)).join(' ')}</span>` : ''}
            </div>
          </div>
          <div class="progress"><i style="width:${pct}%"></i></div>
        </div></article>`;
    }

    /* search looks in the title and the notes; the stage narrows it further */
    function shownVids(){
      const t = vq.trim().toLowerCase();
      return vids.filter(v => (vstage === 'all' || (v.stage || 'idea') === vstage) &&
        (!t || `${v.title || ''} ${v.notes || ''} ${(v.tags || []).join(' ')}`.toLowerCase().includes(t)));
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

      const byStage = k => clips.filter(c => c.state === k);
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
              ${Videos.STAGES.map(st => { const n = vids.filter(v => (v.stage || 'idea') === st.k).length;
                return n ? `<option value="${st.k}" ${vstage === st.k ? 'selected' : ''}>${st.label} · ${n}</option>` : ''; }).join('')}
            </select>
          </div>` : ''}
          ${vids.length
            ? (shownVids().length ? `<div class="list" id="sv-list">${shownVids().map(videoCard).join('')}</div>`
               : `<div class="empty" id="sv-list"><b>Nothing matches</b>Try another word or stage.</div>`)
            : `<div class="empty"><b>Nothing planned yet</b>
                Make a video and set its series to this one, and it shows here.</div>`}

          ${clips.length ? `
            <div class="sec"><h2>Footage</h2><div class="rule"></div>
              <span class="alt">${clips.length}</span></div>
            ${CLIP_STAGE.map(st => {
              const mine = byStage(st.k);
              if(!mine.length) return '';
              return `<p class="hintline" style="margin:12px 0 6px;color:${st.c}">${st.label} · ${mine.length}</p>
                ${mine.map(c => `<button class="noterow" data-clip="${c.id}">
                  <span class="dot" style="background:${st.c}"></span>
                  <span class="t"><b>${esc(c.title)}</b>
                    <small>${esc(c.plat || '')}${c.dur ? ' · ' + esc(c.dur) : ''}</small></span>
                  ${U.ICON.chevR}
                </button>`).join('')}`;
            }).join('')}` : ''}

          <button class="btn-ghost" data-a="newvideo" style="width:100%;margin:18px 0 0">
            Add a video to this series</button>
          <button class="btn-ghost" data-a="bulkideas" style="width:100%;margin:8px 0 0">
            Add several ideas at once</button>
        </div>`;
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
      if(e.target.closest('[data-a="newvideo"]'))
        return VideoSheet.open(Videos.blank(), { seriesId: params.id, onDone: refresh });

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
              await Videos.save({ title, notes:note, seriesId:params.id, channel:(run && run.channel) || '',
                                  stage:'idea', order, createdAt: now - order });
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

      /* and an existing one opens the same sheet, edited in place */
      const v = e.target.closest('[data-video]');
      if(v){
        const rec = vids.find(x => x.id === v.dataset.video);
        if(rec) return VideoSheet.open(rec, { seriesId: params.id, onDone: refresh });
        return;
      }

      const clip = e.target.closest('[data-clip]');
      if(clip) return Screens.push('clip', { id:clip.dataset.clip });
    });

    await load();
    render();
  }

  Screens.register('series-view', mount);
})();
