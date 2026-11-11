/* Achievements — a wall of tiles, and a card behind each one.

   A locked tile says nothing but "?", which is the whole point: the artwork and
   the words are the reward. The card sets its own artwork behind itself, washed
   out, so every achievement feels like its own place rather than a row in a list. */
(function(){

  const DATE = { month:'long', day:'numeric', year:'numeric' };
  let urls = {};

  async function loadArt(){
    Object.values(urls).forEach(URL.revokeObjectURL);
    urls = {};
    try {
      const blobs = await Store.allMap('award-art');
      Object.entries(blobs).forEach(([k, b]) => urls[k] = URL.createObjectURL(b));
    } catch(e){ console.warn('Award art unavailable', e); }
  }

  /* ---------- the wall ---------- */

  async function mountGrid(el, params){
    el.classList.add('paper');
    let editing = false;

    async function render(){
      const list = await Awards.all();
      await loadArt();
      const got = list.filter(a => a.got).length;

      el.innerHTML = Screens.bar({ title:'Achievements',
        actions:`<button class="btn-sm${editing ? ' accent' : ''}" data-a="edit">${
          editing ? 'Done' : 'Edit'}</button>` }) + `
        <div class="view awv">
          <h1 class="awh">Achievements</h1>
          <p class="awlead">You have unlocked <b>${got}/${list.length} achievements</b></p>

          <div class="awgrid">
            ${editing ? `<button class="awtile new" data-new>
              <span class="q">+</span></button>` : ''}
            ${list.map(a => {
              const art = urls[a.id];
              const on = !!a.got;
              return `<button class="awtile${on ? ' on' : ''}" data-id="${a.id}"
                ${on && art ? `style="background-image:url(${art})"` : ''}>
                ${on ? (art ? '' : `<span class="ini">${initials(a.title)}</span>`)
                     : '<span class="q">?</span>'}
                ${editing ? '<span class="pen">' + U.ICON.pencil + '</span>' : ''}
              </button>`;
            }).join('')}
          </div>
        </div>`;
    }

    const initials = t => String(t || '?').split(/\s+/).slice(0, 2)
      .map(w => w[0]).join('').toUpperCase();

    el.addEventListener('click', async e => {
      if(e.target.closest('[data-a="edit"]')){ editing = !editing; return render(); }
      if(e.target.closest('[data-new]'))
        return Screens.push('award-edit', { onChange:render });

      const tile = e.target.closest('[data-id]');
      if(!tile) return;
      const list = await Awards.all();
      const a = list.find(x => x.id === tile.dataset.id);
      if(!a) return;

      if(editing) return Screens.push('award-edit', { id:a.id, onChange:render });
      if(!a.got) return U.toast('Not unlocked yet');
      Screens.push('award', { id:a.id, onChange:render });
    });

    render();
    if(params && params.onChange) params.onChange();
  }

  /* ---------- one card ---------- */

  async function mountCard(el, params){
    el.classList.add('paper');
    const list = await Awards.all();
    const a = list.find(x => x.id === params.id);
    if(!a){ el.innerHTML = Screens.bar({ title:'Achievement' }); return; }
    await loadArt();
    const art = urls[a.id];

    el.innerHTML = `
      ${art ? `<div class="awwash" style="background-image:url(${art})"></div>` : ''}
      <button class="awclose" data-pop aria-label="Close">&times;</button>
      <div class="view awcard">
        <h1>${a.title}</h1>
        ${art ? `<div class="awart"><img src="${art}" alt=""></div>`
              : `<div class="awart empty"><span>${a.title[0] || '?'}</span></div>`}
        <div class="awquote">
          <p class="q">&ldquo;${a.line}&rdquo;</p>
          ${a.req ? `<p class="r"><svg viewBox="0 0 24 24" fill="currentColor"><path
            d="M12 3.6l2.5 5.1 5.6.8-4 4 .95 5.6L12 16.4l-5.05 2.7L7.9 13.5l-4-4 5.6-.8z"/></svg>
            ${a.req}</p>` : ''}
        </div>
        <p class="awwhen">You unlocked this achievement on</p>
        <p class="awdate">${new Date(a.got.at).toLocaleDateString(undefined, DATE)}</p>
      </div>`;
  }

  /* ---------- writing your own ---------- */

  async function mountEdit(el, params){
    const list = await Awards.all();
    const isNew = !params.id;
    const a = isNew
      ? { id:null, title:'', line:'', req:'', tone:'first', builtin:false }
      : { ...list.find(x => x.id === params.id) };
    if(!a) return Screens.pop();

    await loadArt();

    function render(){
      const art = urls[a.id];
      el.innerHTML = Screens.bar({ kicker:'Achievement', title:isNew ? 'New achievement' : a.title,
        actions:`<button class="btn-sm accent" data-a="save">Save</button>` }) + `
        <div class="view">
          <h3 class="pgh">What is it called?</h3>
          <input id="aw-t" class="pgname" type="text" value="${esc(a.title)}"
            placeholder="First Brilliance" autocomplete="off">
          <p class="err" id="aw-err" hidden>Give it a name.</p>

          <h3 class="pgh">Artwork</h3>
          <button class="awpick${art ? ' has' : ''}" data-a="art"
            ${art ? `style="background-image:url(${art})"` : ''}>
            ${art ? '<span>Change</span>' : '<span>Choose an image</span>'}</button>

          <h3 class="pgh">The quote</h3>
          <textarea id="aw-q" class="pgtext" rows="3"
            placeholder="With endurance and self-belief, I have achieved greatness for the first time."
            >${esc(a.line)}</textarea>

          <h3 class="pgh">What unlocks it?</h3>
          <input id="aw-r" class="pgname" type="text" value="${esc(a.req)}"
            placeholder="Having the first perfect day" autocomplete="off">
          <p class="hintline">${a.builtin
            ? 'The rule behind this one is built in — this is the wording shown on the card.'
            : 'The words on the card. Give it a rule below and it unlocks itself.'}</p>

          ${a.builtin ? '' : `
            <h3 class="pgh">The rule</h3>
            <button class="rtrule" data-a="rule" style="width:100%">
              <span class="t">${a.rule && a.rule.metric
                ? Metrics.describe(a.rule)
                : 'No rule — unlock this one by hand'}<small>${a.rule && a.rule.metric
                ? 'Checked against everything you have already done'
                : 'Tap to pick something the app measures'}</small></span>
            </button>`}

          <h3 class="pgh">Kind</h3>
          <div class="pgchips" data-group="tone">${Object.keys(Awards.TONE).map(k =>
            `<button type="button" data-tone="${k}" aria-pressed="${a.tone === k}"
              style="${a.tone === k ? `background:${Awards.TONE[k].c};border-color:${Awards.TONE[k].c};color:#151515` : ''}"
              >${Awards.TONE[k].label}</button>`).join('')}</div>

          ${a.builtin ? '' : `<button class="btn-ghost" data-a="${a.got ? 'revoke' : 'grant'}"
            style="width:100%;margin:22px 0 0">${
            a.got ? 'Mark as not unlocked' : 'Mark as unlocked now'}</button>`}

          ${isNew ? '' : `<button class="btn-ghost" data-a="del"
            style="width:100%;margin:12px 0 0;color:var(--red);border-color:rgba(226,86,74,.45)">
            ${a.builtin ? 'Hide this achievement' : 'Delete this achievement'}</button>`}
        </div>`;
    }

    const esc2 = s => String(s == null ? '' : s);
    function esc(s){ return esc2(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

    function pull(){
      const t = el.querySelector('#aw-t'), q = el.querySelector('#aw-q'), r = el.querySelector('#aw-r');
      if(t) a.title = t.value.trim();
      if(q) a.line = q.value.trim();
      if(r) a.req = r.value.trim();
    }

    el.addEventListener('click', async e => {
      const tone = e.target.closest('[data-tone]');
      if(tone){ pull(); a.tone = tone.dataset.tone; return render(); }

      const act = e.target.closest('[data-a]');
      if(!act) return;

      if(act.dataset.a === 'rule'){
        pull();
        return RuleSheet.open(a.rule, {}, async out => {
          a.rule = out || null;
          if(!a.req && out) a.req = Metrics.describe(out);
          if(a.id) await Awards.saveDef(a);
          render();
        });
      }

      if(act.dataset.a === 'art'){
        pull();
        return App.pickImage(async file => {
          if(!a.id) a.id = (await Awards.saveDef({ ...a })).id;
          await Store.put('award-art', file, a.id);
          await loadArt();
          render();
        });
      }

      if(act.dataset.a === 'save'){
        pull();
        if(!a.title){ el.querySelector('#aw-err').hidden = false; return; }
        const saved = await Awards.saveDef(a);
        a.id = saved.id;
        params.onChange && params.onChange();
        U.toast('Saved');
        return Screens.pop();
      }

      if(act.dataset.a === 'grant'){
        pull();
        if(!a.title){ el.querySelector('#aw-err').hidden = false; return; }
        const saved = await Awards.saveDef(a);
        a.id = saved.id;
        a.got = await Awards.grant(saved);
        params.onChange && params.onChange();
        U.toast(a.title + ' unlocked');
        return render();
      }
      if(act.dataset.a === 'revoke'){
        await Awards.revoke(a.id);
        a.got = null;
        params.onChange && params.onChange();
        return render();
      }

      if(act.dataset.a === 'del'){
        await Awards.removeDef(a);
        await Store.del('award-art', a.id).catch(() => {});
        params.onChange && params.onChange();
        U.toast(a.builtin ? 'Hidden' : 'Deleted');
        return Screens.pop();
      }
    });

    render();
  }

  Screens.register('awards', mountGrid);
  Screens.register('award', mountCard);
  Screens.register('award-edit', mountEdit);
})();
