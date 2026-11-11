/* Reference library — screenshots filed by scenario, then tagged framing and movement. */
(function(){
  const { ICON } = U;

  const BUILT_IN_SCENARIOS = [
    { id:'new',      n:'New',                 d:'Just imported — filed, but not yet looked at' },
    { id:'talking',  n:'Talking head' },
    { id:'incar',    n:'In-car' },
    { id:'driving',  n:'Driving b-roll' },
    { id:'walking',  n:'Walking & street' },
    { id:'desk',     n:'Desk & screen work' },
    { id:'hands',    n:'Hands & detail' },
    { id:'exterior', n:'Exterior establishing' },
    { id:'job',      n:'On-the-job' },
    { id:'home',     n:'Home & property' },
    { id:'gym',      n:'Gym & training' }
  ];
  /* Built-ins, plus your own, minus any you hid. Kept in one list so every
     dropdown in this screen agrees. */
  let SCENARIOS = BUILT_IN_SCENARIOS.slice();
  async function loadScenarios(){
    let custom = [];
    try { custom = (await Store.get('settings', 'ref-scenarios')) || []; }
    catch(e){ custom = []; }
    const hidden = new Set(custom.filter(c => c.hidden).map(c => c.id));
    SCENARIOS = [
      ...BUILT_IN_SCENARIOS.filter(s2 => !hidden.has(s2.id)),
      ...custom.filter(c => !c.hidden && !BUILT_IN_SCENARIOS.some(b => b.id === c.id))
    ];
  }
  async function saveScenarios(list){
    await Store.put('settings', list, 'ref-scenarios');
    await loadScenarios();
  }
  const customScenarios = async () => {
    try { return (await Store.get('settings', 'ref-scenarios')) || []; }
    catch(e){ return []; }
  };

  const FRAMING  = ['Wide','Medium','Close','Extreme close','Over-shoulder','POV','Top-down'];
  const MOVEMENT = ['Static','Pan','Tilt up','Tilt down','Push in','Pull out','Tracking','Handheld','Orbit','Lock focus'];

  let imgs = {};
  const name = id => (SCENARIOS.find(s => s.id === id) || { n:'Unfiled' }).n;
  let linked = {};

  async function loadImgs(){
    try {
      const blobs = await Store.allMap('ref-img');
      try {
        const posters = await Store.allMap('ref-poster');
        Object.entries(posters).forEach(([k,v]) => { if(v) blobs[k] = v; });
      } catch(e){}
      /* only object urls we made ourselves may be revoked — a linked reference's
         url belongs to the wider web and revoking it would do nothing good */
      Object.entries(imgs).forEach(([k,u]) => { if(!linked[k]) URL.revokeObjectURL(u); });
      imgs = {};
      linked = {};
      Object.entries(blobs).forEach(([k,b]) => imgs[k] = URL.createObjectURL(b));

      /* a linked reference has no blob, so its own url stands in */
      try {
        const { values } = await Store.all('refs');
        values.filter(r => r.url).forEach(r => {
          imgs[r.id] = r.poster || r.url;
          linked[r.id] = true;
        });
      } catch(e){}
    } catch(e){ console.warn('Reference images unavailable', e); }
  }
  const all = async () => {
    const { values } = await Store.all('refs');
    return values.sort((a,b) => b.createdAt - a.createdAt);
  };
  const uid = () => 'rf_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  /* ---------- import ---------- */
  /* Categories are yours: add the ones you shoot, hide the ones you never will.
     Built-ins are hidden rather than deleted, so they can come back. */
  function manageScenarios(after){
    (async () => {
      const custom = await customScenarios();
      const hidden = new Set(custom.filter(c => c.hidden).map(c => c.id));
      const rows = [
        ...BUILT_IN_SCENARIOS.map(b => ({ ...b, builtIn:true, off:hidden.has(b.id) })),
        ...custom.filter(c => !BUILT_IN_SCENARIOS.some(b => b.id === c.id) && !c.hidden)
                 .map(c => ({ ...c, builtIn:false, off:false }))
      ];

      App.sheet(`
        <h2>Categories</h2>
        <div class="field"><label for="sc-new">Add one</label>
          <div style="display:flex;gap:9px">
            <input id="sc-new" type="text" placeholder="Night exteriors" style="flex:1">
            <button class="btn-sm accent" data-addscen style="height:52px;padding:0 16px">Add</button>
          </div>
        </div>
        <div class="group" style="margin:6px 0 0">
          ${rows.map(r2 => `<div class="row" style="cursor:default">
            <span class="lbl"${r2.off ? ' style="color:var(--dim)"' : ''}>${r2.n}
              <small>${r2.builtIn ? (r2.off ? 'hidden' : 'built in') : 'yours'}</small></span>
            <button class="btn-sm" data-scentoggle="${r2.id}" data-built="${r2.builtIn}">${
              r2.off ? 'Show' : (r2.builtIn ? 'Hide' : 'Delete')}</button>
          </div>`).join('')}
        </div>
        <p class="note" style="text-align:left">Hiding a category leaves its references alone —
          they move to Unfiled and you can re-file them.</p>
        <div class="sheetcta"><button class="btn-primary" data-cancel>Done</button></div>`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')){ App.closeSheet(); after && after(); return; }

          if(e.target.closest('[data-addscen]')){
            const input = sheetEl.querySelector('#sc-new');
            const n = input.value.trim();
            if(!n) return U.toast('Name it first');
            const list = await customScenarios();
            list.push({ id:'sc_' + Date.now().toString(36), n });
            await saveScenarios(list);
            App.closeSheet();
            manageScenarios(after);
            return;
          }

          const tg = e.target.closest('[data-scentoggle]');
          if(tg){
            const id = tg.dataset.scentoggle;
            const built = tg.dataset.built === 'true';
            let list = await customScenarios();
            const existing = list.find(c => c.id === id);

            if(built){
              /* built-ins toggle a hidden flag rather than disappearing */
              if(existing) existing.hidden = !existing.hidden;
              else list.push({ id, hidden:true });
            } else {
              list = list.filter(c => c.id !== id);
            }
            await saveScenarios(list);
            App.closeSheet();
            manageScenarios(after);
          }
        });
      });
    })();
  }

  /* Three ways in, because a reference can come from a download, the camera in
     front of you, or a link you found and do not want to save a copy of. */
  function addRef(scenario, after){
    App.sheet(`
      <h2>Add a reference</h2>
      <div class="group" style="margin:0 0 4px">
        <button class="row" data-add="files">
          <span class="lbl">Choose files<small>Stills, GIFs or clips already on the device</small></span></button>
        <button class="row" data-add="camera">
          <span class="lbl">Use the camera<small>Shoot a still or a clip right now</small></span></button>
        <button class="row" data-add="link">
          <span class="lbl">Paste a link<small>Points at it online — nothing is downloaded</small></span></button>
      </div>
      <p class="note" style="text-align:left">Linked references need a connection to show.
        Anything you want on a shoot day with no signal should be a file.</p>`,
    sheetEl => {
      sheetEl.addEventListener('click', e => {
        const b = e.target.closest('[data-add]');
        if(!b) return;
        App.closeSheet();
        if(b.dataset.add === 'files')  return importFiles(scenario, after);
        if(b.dataset.add === 'camera') return importFiles(scenario, after, true);
        if(b.dataset.add === 'link')   return linkRef(scenario, after);
      });
    });
  }

  /* A reference that lives at a URL. Stored as a record with no blob. */
  function linkRef(scenario, after){
    App.sheet(`
      <h2>Paste a link</h2>
      <div class="field"><label for="rl-url">Image, GIF or video URL</label>
        <input id="rl-url" type="url" inputmode="url" autocomplete="off"
          placeholder="https://…/shot.gif"></div>
      <div class="field"><label for="rl-poster">Still for the grid
        <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
        <input id="rl-poster" type="url" inputmode="url" autocomplete="off"
          placeholder="https://…/thumb.jpg"></div>
      <div class="field"><label for="rl-note">Note
        <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
        <input id="rl-note" type="text" placeholder="Why it works"></div>
      <div class="sheetcta">
        <button class="btn-primary" data-save>Add it</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-save]')) return;

        const url = sheetEl.querySelector('#rl-url').value.trim();
        if(!/^https?:\/\//i.test(url)) return U.toast('That needs to be a full http link');

        const id = uid();
        await Store.put('refs', {
          id, scenario: scenario || 'new', framing:'', movement:'',
          note: sheetEl.querySelector('#rl-note').value.trim(),
          kind: Refs.kindOfUrl(url),
          url,
          poster: sheetEl.querySelector('#rl-poster').value.trim() || '',
          createdAt: Date.now()
        });
        Refs.forget(id);
        App.closeSheet();
        await loadImgs();
        U.toast('Linked');
        after && after();
      });
      setTimeout(() => { const f = sheetEl.querySelector('#rl-url'); if(f) f.focus(); }, 180);
    });
  }

  function importFiles(scenario, after, fromCamera){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = !fromCamera;
    /* capture hands you straight to the camera rather than the gallery */
    if(fromCamera) input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const files = [...(input.files || [])];
      input.remove();
      if(!files.length) return;
      let n = 0, clips = 0;
      U.toast(`Importing ${files.length}…`);
      for(const f of files){
        const id = uid();
        const video = /^video\//.test(f.type);
        await Store.put('ref-img', f, id);

        /* a clip needs a still, or the grid has nothing to draw */
        if(video){
          const poster = await Refs.posterFromVideo(f);
          if(poster) await Store.put('ref-poster', poster, id);
          clips++;
        }

        await Store.put('refs', {
          id, scenario: scenario || 'new', framing:'', movement:'', note:'',
          kind: video ? 'video' : (/gif$/i.test(f.type) ? 'gif' : 'image'),
          createdAt: Date.now() + (n++)
        });
      }
      await loadImgs();
      U.toast(`Imported ${files.length} reference${files.length===1?'':'s'}${
        clips ? ` · ${clips} clip${clips===1?'':'s'}` : ''}`);
      after && after();
    });
    input.click();
  }

  /* ---------- scenarios ---------- */
  async function mountLibrary(el){
    await loadScenarios();
    async function render(){
      const rows = await all();
      const counts = {};
      rows.forEach(r => counts[r.scenario] = (counts[r.scenario] || 0) + 1);

      el.innerHTML = Screens.bar({ kicker:'Creator studio', title:'Reference library',
        actions:`<button class="btn-sm" data-a="cats">Categories</button>
                 <button class="btn-sm accent" data-a="import">+ Add</button>` }) + `
      <div class="view">
        <div class="block" style="padding:16px 14px;margin-bottom:14px">
          <h4 style="margin:0 0 6px">Scenarios</h4>
          <p style="margin:0;color:var(--muted);font-size:14.5px">Pick one to see its frames.</p>
        </div>
        <div class="group" style="margin:0">
          ${SCENARIOS.map(s => `<button class="scenrow" data-scen="${s.id}">
            <span class="lbl"><b>${s.n}</b>${s.d ? `<small>${s.d}</small>` : ''}</span>
            <span class="cnt${counts[s.id] ? ' hot' : ''}">${counts[s.id] || 0}</span>
            <span class="chevr" style="color:var(--dim)">${ICON.chevR}</span>
          </button>`).join('')}
        </div>
        <p class="note">${rows.length} reference${rows.length===1?'':'s'} in total.
          Imports land in New until you file them.</p>
      </div>`;
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'cats') return manageScenarios(render);
      if(a && a.dataset.a === 'import') return addRef('new', render);
      const s = e.target.closest('[data-scen]');
      if(s) Screens.push('reference-scenario', { scenario:s.dataset.scen, onChange:render });
    });

    await loadImgs();
    render();
  }

  /* ---------- one scenario ---------- */
  async function mountScenario(el, params){
    await loadScenarios();
    let scenario = params.scenario;
    let framing = '', movement = '', selecting = false;
    const picked = new Set();

    async function render(){
      const rows = (await all()).filter(r =>
        r.scenario === scenario &&
        (!framing  || r.framing  === framing) &&
        (!movement || r.movement === movement));

      el.innerHTML = Screens.bar({ kicker:'Reference library', title:name(scenario),
        actions:`<button class="btn-sm${selecting ? ' accent' : ''}" data-a="select">${selecting ? 'Done' : 'Select'}</button>
                 <button class="btn-sm accent" data-a="import">+ Add</button>` }) + `
      <div class="view">
        <div class="filterwrap">
          <select id="f-scen" class="wide">
            ${SCENARIOS.map(s => `<option value="${s.id}"${scenario===s.id?' selected':''}>${s.n}</option>`).join('')}
          </select>
          <select id="f-framing"><option value="">Framing</option>
            ${FRAMING.map(f => `<option${framing===f?' selected':''}>${f}</option>`).join('')}</select>
          <select id="f-move"><option value="">Movement</option>
            ${MOVEMENT.map(m => `<option${movement===m?' selected':''}>${m}</option>`).join('')}</select>
        </div>

        <div class="sec"><h2>${name(scenario)}</h2><div class="rule"></div>
          <span class="alt">${rows.length} reference${rows.length===1?'':'s'}</span></div>

        ${rows.length ? `<div class="refgrid">${rows.map(r => `
          <button class="refcard${picked.has(r.id) ? ' on' : ''}" data-ref="${r.id}">
            <span class="img" style="background-image:${imgs[r.id] ? `url(${imgs[r.id]})` : U.generatedArt(r.id,'?',300,533)}">
              ${selecting ? `<span class="pick">${ICON.check}</span>` : ''}
              ${r.scenario === 'new' ? `<span class="tag">New</span>` : ''}
            </span>
            <span class="tx">
              <b>${r.framing || '—'}${r.movement ? ' · ' + r.movement : ''}</b>
              <small>${r.note || name(r.scenario)}</small>
            </span>
          </button>`).join('')}</div>`
        : `<div class="empty"><b>Nothing here yet</b>Import screenshots and file them into this scenario.</div>`}

        ${selecting ? `<div class="selbar">
          <span class="cnt">${picked.size ? `${picked.size} selected` : 'Nothing selected'}</span>
          <select id="bulk-scen" style="height:42px;background:var(--bg);border:1px solid var(--line);
            border-radius:var(--r);color:var(--cream);font-size:14.5px;padding:0 9px">
            <option value="">Set scenario…</option>
            ${SCENARIOS.map(s => `<option value="${s.id}">${s.n}</option>`).join('')}
          </select>
          <button class="btn-sm" data-a="all">Select all shown</button>
          <button class="btn-sm" data-a="delete" style="color:var(--red);border-color:rgba(226,86,74,.4)">Delete</button>
        </div>` : ''}
      </div>`;
    }

    /* tagging one frame */
    async function openRef(id){
      const rows = await all();
      const r = rows.find(x => x.id === id);
      if(!r) return;
      App.sheet(`
        <h2>Tag this frame</h2>
        <div style="width:100%;aspect-ratio:9/16;max-height:34vh;border-radius:var(--r);margin:0 0 16px;
          background-size:contain;background-repeat:no-repeat;background-position:center;
          background-color:#151515;border:1px solid var(--line);
          background-image:${imgs[r.id] ? `url(${imgs[r.id]})` : 'none'}"></div>
        <div class="field"><label for="rf-scen">Category</label>
          <select id="rf-scen" class="unit">
            ${SCENARIOS.map(s2 => `<option value="${s2.id}"${r.scenario===s2.id?' selected':''}>${s2.n}</option>`).join('')}
          </select></div>
        <div class="field"><label for="rf-framing">Framing</label>
          <select id="rf-framing" class="unit">
            <option value="">Not set</option>
            ${FRAMING.map(f => `<option${r.framing===f?' selected':''}>${f}</option>`).join('')}
          </select></div>
        <div class="field"><label for="rf-move">Movement</label>
          <select id="rf-move" class="unit">
            <option value="">Not set</option>
            ${MOVEMENT.map(m => `<option${r.movement===m?' selected':''}>${m}</option>`).join('')}
          </select></div>
        <div class="field"><label for="rf-note">Note</label>
          <input id="rf-note" type="text" value="${(r.note||'').replace(/"/g,'&quot;')}" placeholder="use mirror to show a wide reveal"></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        <button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete reference</button>`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          const opt = e.target.closest('.opt');
          if(opt){
            opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
            opt.setAttribute('aria-pressed','true'); return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            await Store.del('refs', r.id);
            try { await Store.del('ref-img', r.id); } catch(e){}
            try { await Store.del('ref-poster', r.id); } catch(e){}
            Refs.forget(r.id);
            App.closeSheet(); params.onChange && params.onChange(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          r.scenario = sheetEl.querySelector('#rf-scen').value;
          r.framing  = sheetEl.querySelector('#rf-framing').value;
          r.movement = sheetEl.querySelector('#rf-move').value;
          r.note = sheetEl.querySelector('#rf-note').value.trim();
          await Store.put('refs', r);
          App.closeSheet(); params.onChange && params.onChange(); render();
        });
      });
    }

    el.addEventListener('change', async e => {
      if(e.target.id === 'f-scen'){ scenario = e.target.value; picked.clear(); return render(); }
      if(e.target.id === 'f-framing'){ framing = e.target.value; return render(); }
      if(e.target.id === 'f-move'){ movement = e.target.value; return render(); }
      if(e.target.id === 'bulk-scen' && e.target.value){
        if(!picked.size){ e.target.value = ''; return U.toast('Nothing selected'); }
        const rows = await all();
        for(const id of picked){
          const r = rows.find(x => x.id === id);
          if(r){ r.scenario = e.target.value; await Store.put('refs', r); }
        }
        U.toast(`Moved ${picked.size} to ${name(e.target.value)}`);
        picked.clear();
        params.onChange && params.onChange();
        render();
      }
    });

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if(a){
        if(a.dataset.a === 'select'){ selecting = !selecting; picked.clear(); return render(); }
        if(a.dataset.a === 'import') return addRef(scenario, () => { params.onChange && params.onChange(); render(); });
        if(a.dataset.a === 'all'){
          const rows = (await all()).filter(r => r.scenario === scenario &&
            (!framing || r.framing === framing) && (!movement || r.movement === movement));
          rows.forEach(r => picked.add(r.id));
          return render();
        }
        if(a.dataset.a === 'delete'){
          if(!picked.size) return U.toast('Nothing selected');
          for(const id of picked){ await Store.del('refs', id); await Store.del('ref-img', id); }
          U.toast(`Deleted ${picked.size}`);
          picked.clear(); await loadImgs();
          params.onChange && params.onChange();
          return render();
        }
      }
      const card = e.target.closest('[data-ref]');
      if(!card) return;
      const id = card.dataset.ref;
      if(selecting){
        picked.has(id) ? picked.delete(id) : picked.add(id);
        return render();
      }
      openRef(id);
    });

    await loadImgs();
    render();
  }

  Screens.register('reference-library', mountLibrary);
  Screens.register('reference-scenario', mountScenario);
})();
