/* A channel, as somewhere to look rather than a row in a settings list.

   Channels have been a name, a colour and a posting schedule, edited in
   Settings and never looked at. But "what is this channel for, and what does
   good look like on it" is a real question — usually asked right before making
   something for it.

   So: what it is for, the handful of videos that set the bar, everything else
   you saved for it, and what you have actually made.

   The bar is deliberately separate from the rest. A swipe file ends up with
   fifty entries for a channel; the three you would point at and say "exactly
   this" stop being useful once they are mixed in with the fifty. One channel
   per benchmark — a video that is the standard for everything is the standard
   for nothing. */
(function(){
  const { ICON } = U;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  async function mount(el, params){
    let ch = null, swipes = [], series = [], clips = [], thumbs = {};

    async function load(){
      const all = await Channels.all();
      ch = all.find(c => c.n === (params && params.name)) || all[0] || null;
      if(!ch) return;

      try {
        const { values } = await Store.all('swipes');
        swipes = values.filter(s => (s.channels || []).includes(ch.n))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      } catch(e){ swipes = []; }

      try { series = (await Data.series()).filter(s => s.channel === ch.n); }
      catch(e){ series = []; }

      try { clips = (await Data.clips()).filter(c => c.channel === ch.n); }
      catch(e){ clips = []; }

      /* covers you uploaded yourself win over an embed, same as the swipe file */
      try {
        const blobs = await Store.allMap('swipe-thumb');
        Object.values(thumbs).forEach(URL.revokeObjectURL);
        thumbs = {};
        Object.entries(blobs).forEach(([k, b]) => thumbs[k] = URL.createObjectURL(b));
      } catch(e){ thumbs = {}; }
    }

    const coverFor = s => thumbs[s.id] ? `url(${thumbs[s.id]})`
      : s.imageUrl ? `url("${String(s.imageUrl).replace(/"/g, '%22')}")`
      : (window.Embed && Embed.poster(s.url)) ? `url(${Embed.poster(s.url)})`
      : U.generatedArt(s.id, s.title || '?', 300, 200);

    function swipeCard(s, isBar){
      const canEmbed = window.Embed && !thumbs[s.id] && !s.imageUrl
        && Embed.can(s.url) && !Embed.poster(s.url);
      return `
        <button class="chswipe${isBar ? ' bar' : ''}" data-swipe="${s.id}">
          <span class="cs-thumb${canEmbed ? ' hasembed' : ''}"
            style="background-image:${coverFor(s)}">
            ${canEmbed ? Embed.html(s.url, { ratio:'100%' }) : ''}
          </span>
          <span class="cs-t">
            <b>${esc(s.title || 'Untitled')}</b>
            <small>${esc(s.source || '')}${s.myAngle ? ' · ' + esc(s.myAngle) : ''}</small>
          </span>
        </button>`;
    }

    /* Editing in place. Pushing the Settings list and landing back in Settings
       was the wrong trip entirely — this is the page the channel lives on. */
    function editSheet(){
      App.sheet(`
        <h2 style="margin:0 0 14px">${esc(ch.n)}</h2>

        <div class="field"><label for="cp-n">Name</label>
          <input id="cp-n" type="text" value="${esc(ch.n)}"></div>

        <div class="field"><label for="cp-about">What it is for</label>
          <textarea id="cp-about" rows="3"
            placeholder="Who it is for and what belongs on it — the reminder you will want in six weeks."
            >${esc(ch.about || '')}</textarea></div>

        <div class="field"><label for="cp-voice">Tone and voice <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <textarea id="cp-voice" rows="2"
            placeholder="How it sounds. Blunt and practical? Warm? Nothing scripted?"
            >${esc(ch.voice || '')}</textarea></div>

        <div class="field"><label for="cp-who">Who watches it <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <textarea id="cp-who" rows="2"
            placeholder="The person on the other end, and what they came for."
            >${esc(ch.who || '')}</textarea></div>

        <div class="field"><label>Colour</label>
          <div class="opts">
            ${Channels.PALETTE.map(c => `<button type="button" class="opt" data-col="${c}"
              aria-pressed="${ch.c === c}"><span style="display:inline-block;width:11px;
              height:11px;border-radius:50%;background:${c}"></span></button>`).join('')}
          </div></div>

        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        <!-- Deleting used to be possible only in the Settings list, which the
             row no longer opens — so a channel had become undeletable from the
             page you actually go to. -->
        <button class="btn-ghost" data-delete style="width:100%;margin-top:10px;
          color:var(--red);border-color:rgba(226,86,74,.4)">Delete channel</button>`, sheet => {
        let colour = ch.c;
        sheet.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();

          if(e.target.closest('[data-delete]')){
            /* What points at a channel points at it by name, so say what is
               about to lose its channel rather than finding out afterwards. */
            const uses = swipes.filter(x => (x.channels || []).includes(ch.n)).length
              + series.length + clips.length;
            App.closeSheet();
            return App.sheet(`
              <h2 style="margin:0 0 3px">Delete ${esc(ch.n)}?</h2>
              <p class="hintline" style="margin:0 0 14px">${uses
                ? `${uses} thing${uses === 1 ? '' : 's'} name this channel — ${
                    series.length} series, ${clips.length} clip${
                    clips.length === 1 ? '' : 's'} and what you saved for it. They stay,
                    but they will no longer belong to a channel.`
                : 'Nothing is using it.'}</p>
              <div class="sheetcta">
                <button class="btn-primary" data-yes
                  style="background:var(--red);border-color:var(--red)">Delete it</button>
                <button class="btn-ghost" data-no>Keep it</button>
              </div>`, s2 => {
              s2.addEventListener('click', async ev => {
                if(ev.target.closest('[data-no]')) return App.closeSheet();
                if(!ev.target.closest('[data-yes]')) return;
                const all = (await Channels.all()).filter(x => x.n !== ch.n);
                await Channels.save(all);
                App.closeSheet();
                if(params.onChange) params.onChange();
                Screens.pop();
              });
            });
          }

          const col = e.target.closest('[data-col]');
          if(col){
            colour = col.dataset.col;
            sheet.querySelectorAll('[data-col]').forEach(b =>
              b.setAttribute('aria-pressed', String(b.dataset.col === colour)));
            return;
          }
          if(!e.target.closest('[data-save]')) return;

          const list = (await Channels.all()).slice();
          const i = list.findIndex(x => x.n === ch.n);
          const was = ch.n;
          const next = {
            ...ch,
            n: sheet.querySelector('#cp-n').value.trim() || ch.n,
            about: sheet.querySelector('#cp-about').value.trim(),
            voice: sheet.querySelector('#cp-voice').value.trim(),
            who: sheet.querySelector('#cp-who').value.trim(),
            c: colour
          };
          if(i === -1) list.push(next); else list[i] = next;
          await Channels.save(list);

          /* Renaming a channel would orphan everything pointing at the old name,
             so the things that name it are brought along. */
          if(next.n !== was) await rename(was, next.n);

          App.closeSheet();
          params.name = next.n;
          await load(); render();
          if(params.onChange) params.onChange();
        });
      });
    }

    /* Everything that refers to a channel does so by name. */
    async function rename(from, to){
      try {
        const { values } = await Store.all('swipes');
        for(const s2 of values){
          let touched = false;
          if((s2.channels || []).includes(from)){
            s2.channels = s2.channels.map(n => n === from ? to : n);
            touched = true;
          }
          if(s2.barFor === from){ s2.barFor = to; touched = true; }
          if(touched) await Store.put('swipes', s2);
        }
      } catch(e){}

      try {
        for(const s2 of await Data.series()){
          if(s2.channel === from) await Data.saveSeries({ ...s2, channel:to });
        }
      } catch(e){}

      try {
        for(const c of await Data.clips()){
          if(c.channel === from) await Data.saveClip({ ...c, channel:to });
        }
      } catch(e){}
    }

    /* Saving a reference from the channel it belongs to. */
    function addSheet(){
      App.sheet(`
        <h2 style="margin:0 0 3px">A reference for ${esc(ch.n)}</h2>
        <p class="hintline" style="margin:0 0 14px">Paste a link. It is saved to the swipe
          file already tagged to this channel, and its preview comes from the platform.</p>
        <input id="cp-url" class="pgname" type="url" placeholder="https://"
          inputmode="url" autocomplete="off">
        <label class="optrow" style="display:flex;align-items:center;gap:10px;margin:12px 0 0">
          <input id="cp-bar" type="checkbox">
          <span>This one is the bar</span>
        </label>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save it</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheet => {
        sheet.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(!e.target.closest('[data-save]')) return;

          const url = sheet.querySelector('#cp-url').value.trim();
          if(!url) return U.toast('Paste a link first');
          const isBar = sheet.querySelector('#cp-bar').checked;

          const rec = { id:'sw_' + Date.now().toString(36), url,
            title:'Untitled swipe', source:'', intent:'Education',
            hook:'', beats:[], why:'', transferable:'', myAngle:'',
            channels:[ch.n], barFor:isBar ? ch.n : null, createdAt:Date.now() };

          /* ask the link what it is, so it arrives named and covered */
          if(window.Thumb){
            try {
              const about = await Thumb.describe(url);
              if(about){
                if(about.title) rec.title = about.title.slice(0, 120);
                if(about.thumb) rec.imageUrl = about.thumb;
              }
            } catch(err){}
          }

          /* one bar per channel: marking this one unmarks the last */
          if(isBar){
            try {
              const { values } = await Store.all('swipes');
              for(const s2 of values){
                if(s2.barFor === ch.n){ s2.barFor = null; await Store.put('swipes', s2); }
              }
            } catch(err){}
          }

          await Store.put('swipes', rec);
          App.closeSheet();
          await load(); render();
        });
        setTimeout(() => { const f = sheet.querySelector('#cp-url'); if(f) f.focus(); }, 180);
      });
    }

    function render(){
      if(!ch){
        el.innerHTML = Screens.bar({ title:'Channel' }) +
          '<div class="view"><div class="empty"><b>No channels yet</b>' +
          'Add them in Settings.</div></div>';
        return;
      }

      const bar = swipes.filter(s => s.barFor === ch.n);
      const rest = swipes.filter(s => s.barFor !== ch.n);
      const live = clips.filter(c => (c.stage || 'idea') === 'published').length;

      el.innerHTML = Screens.bar({ kicker:'Channel', title:ch.n }) + `
        <div class="view">
          <div class="pagehead">
            <h1 class="page-title" style="color:${ch.c}">${esc(ch.n)}</h1>
            <span class="headacts"><button class="headbtn" data-a="edit">EDIT</button></span>
          </div>

          ${ch.about
            ? `<p class="qt-topic">${esc(ch.about)}</p>`
            : `<p class="qt-topic"><i>No description yet — what belongs on this one?</i></p>`}
          ${ch.voice ? `<p class="qt-thru"><b>Voice</b> · ${esc(ch.voice)}</p>` : ''}
          ${ch.who ? `<p class="qt-thru"><b>Who</b> · ${esc(ch.who)}</p>` : ''}

          <div class="metaline" style="margin:12px 0 0">
            <span class="tg">${series.length} series</span>
            <span class="tg">${clips.length} clip${clips.length === 1 ? '' : 's'}</span>
            <span class="tg">${live} published</span>
          </div>

          <div class="sec" style="margin-top:22px"><h2>The bar</h2><div class="rule"></div>
            <span class="alt">${bar.length}</span></div>
          <p class="hintline" style="margin:0 0 12px">The few you would point at and say
            exactly this.</p>
          <button class="btn-ghost" data-a="addref" style="width:100%;margin:0 0 12px">
            Add a reference</button>
          ${bar.length
            ? `<div class="chgrid">${bar.map(s => swipeCard(s, true)).join('')}</div>`
            : `<div class="empty"><b>Nothing marked yet</b>
                Saved ${swipes.length} for this channel${swipes.length ? ' — mark the best of them' : ''}.</div>`}

          ${rest.length ? `
            <div class="sec" style="margin-top:22px"><h2>Also saved</h2><div class="rule"></div>
              <span class="alt">${rest.length}</span></div>
            <div class="chgrid">${rest.map(s => swipeCard(s, false)).join('')}</div>` : ''}

          ${series.length ? `
            <div class="sec" style="margin-top:22px"><h2>Series</h2><div class="rule"></div>
              <span class="alt">${series.length}</span></div>
            ${series.map(s => `
              <button class="noterow" data-series="${s.id}">
                <span class="dot" style="background:${ch.c}"></span>
                <span class="t"><b>${esc(s.title)}</b>
                  <small>${(s.days && s.days.length) ? U.daysLabel(s.days) : (s.cadence || '')}</small></span>
                ${ICON.chevR}
              </button>`).join('')}` : ''}
        </div>`;
    }

    el.addEventListener('click', async e => {
      const sw = e.target.closest('[data-swipe]');
      if(sw) return Screens.push('swipe', { id:sw.dataset.swipe,
        onChange:async () => { await load(); render(); } });

      const sr = e.target.closest('[data-series]');
      if(sr) return Screens.push('series-view', { id:sr.dataset.series,
        onChange:async () => { await load(); render(); } });

      if(e.target.closest('[data-a="edit"]')) return editSheet();

      /* a reference added from here is already tagged to this channel, which is
         the whole reason to add it from here */
      if(e.target.closest('[data-a="addref"]')) return addSheet();
    });

    await load();
    render();
  }

  Screens.register('channel', mount);
})();
