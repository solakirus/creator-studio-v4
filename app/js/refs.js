/* The reference library, as something other screens can borrow from.

   A reference is a still or a short clip you collected because it looked good.
   Shots on a task point at them by id, so the picture lives in one place and a
   shot only ever holds a reference to it. */
(function(global){

  const urls = {}, posters = {};

  async function all(){
    try {
      const { values } = await Store.all('refs');
      return values.sort((a,b) => b.createdAt - a.createdAt);
    } catch(e){ return []; }
  }
  async function get(id){
    try { return await Store.get('refs', id); } catch(e){ return null; }
  }

  /* The full asset. Most references are files held on the device; a linked one
     is just a URL, which costs nothing to store but needs a connection to show. */
  async function src(id, ref){
    if(urls[id] !== undefined) return urls[id];
    const r = ref || await get(id);
    if(r && r.url){ urls[id] = r.url; return urls[id]; }
    try {
      const blob = await Store.get('ref-img', id);
      urls[id] = blob ? URL.createObjectURL(blob) : null;
    } catch(e){ urls[id] = null; }
    return urls[id];
  }

  /* What a grid should show: the poster for a clip, the image itself otherwise.
     Grids must never load a pile of video files just to draw thumbnails. */
  async function thumb(id){
    if(posters[id] !== undefined) return posters[id];
    try {
      const p = await Store.get('ref-poster', id);
      if(p){ posters[id] = URL.createObjectURL(p); return posters[id]; }
    } catch(e){}
    const r = await get(id);
    /* a linked video has no local frame to pull, so fall back to its own poster
       field if one was given, and otherwise to the link itself */
    if(r && r.url && r.poster){ posters[id] = r.poster; return posters[id]; }
    posters[id] = await src(id, r);
    return posters[id];
  }

  function forget(id){
    [urls, posters].forEach(map => {
      if(map[id]) URL.revokeObjectURL(map[id]);
      delete map[id];
    });
  }

  /* Grab a frame from a video so the library has something to show at a glance.
     Runs entirely locally — the file never leaves the device. */
  function posterFromVideo(file, atSeconds){
    return new Promise(resolve => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      const url = URL.createObjectURL(file);
      let done = false;

      const finish = blob => {
        if(done) return;
        done = true;
        URL.revokeObjectURL(url);
        resolve(blob || null);
      };

      v.onloadeddata = () => {
        /* a frame from a moment in, since frame zero is often black */
        const target = Math.min(atSeconds === undefined ? 0.6 : atSeconds,
                                Math.max(0, (v.duration || 1) - 0.1));
        const grab = () => {
          try {
            const c = document.createElement('canvas');
            const w = v.videoWidth || 720, h = v.videoHeight || 1280;
            const scale = Math.min(1, 720 / Math.max(w, h));
            c.width = Math.round(w * scale);
            c.height = Math.round(h * scale);
            c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
            c.toBlob(b => finish(b), 'image/jpeg', 0.82);
          } catch(e){ finish(null); }
        };
        if(Math.abs(v.currentTime - target) < 0.05) grab();
        else { v.onseeked = grab; v.currentTime = target; }
      };
      v.onerror = () => finish(null);
      setTimeout(() => finish(null), 6000);   /* never hang the import */
      v.src = url;
    });
  }

  const isVideo = ref => ref && (ref.kind === 'video' || ref.kind === 'gif');
  const isLinked = ref => !!(ref && ref.url);

  /* What a pasted link points at, judged by its extension. Anything we cannot
     place is treated as an image, which fails visibly rather than silently. */
  function kindOfUrl(u){
    const clean = String(u).split('?')[0].toLowerCase();
    if(/\.(mp4|webm|mov|m4v)$/.test(clean)) return 'video';
    if(/\.gif$/.test(clean)) return 'gif';
    return 'image';
  }

  global.Refs = { all, get, src, thumb, forget, posterFromVideo, isVideo, isLinked, kindOfUrl };
})(window);

/* ---- picking and viewing, shared by every screen that links references ---- */
(function(global){

  /* A sheet of the whole library, multi-select, returning the chosen ids. */
  async function pick(current, onDone){
    const list = await Refs.all();
    if(!list.length){
      U.toast('Import some references first');
      return;
    }
    let chosen = [...(current || [])];
    const thumbs = {};
    for(const r of list) thumbs[r.id] = await Refs.thumb(r.id);

    const grid = () => list.map(r => `
      <button type="button" class="refpick${chosen.includes(r.id) ? ' on' : ''}" data-ref="${r.id}">
        ${thumbs[r.id] ? `<img src="${thumbs[r.id]}" alt="">` : ''}
        ${r.kind === 'video' ? '<span class="vid">CLIP</span>'
          : r.kind === 'gif' ? '<span class="vid">GIF</span>' : ''}
        ${Refs.isLinked(r) ? '<span class="lnk">↗</span>' : ''}
        <span class="tick">${U.ICON.check}</span>
      </button>`).join('');

    App.sheet(`
      <h2>Link references</h2>
      <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.55">
        Pick the shots you are aiming at. They stay in the library — this only points at them.</p>
      <div class="refgrid">${grid()}</div>
      <div class="sheetcta">
        <button class="btn-primary" data-save>Link <span data-n>${chosen.length}</span></button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', e => {
        const b = e.target.closest('[data-ref]');
        if(b){
          const id = b.dataset.ref;
          chosen.includes(id) ? chosen = chosen.filter(x => x !== id) : chosen.push(id);
          b.classList.toggle('on');
          const n = sheetEl.querySelector('[data-n]');
          if(n) n.textContent = chosen.length;
          return;
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(e.target.closest('[data-save]')){
          App.closeSheet();
          onDone(chosen);
        }
      });
    });
  }

  /* Full screen, with arrows when a shot has several. */
  async function view(ids, startAt){
    const host = document.getElementById('refview');
    if(!host || !ids || !ids.length) return;
    let at = Math.max(0, Math.min(startAt || 0, ids.length - 1));

    async function draw(){
      const id = ids[at];
      const [ref, url] = await Promise.all([Refs.get(id), Refs.src(id)]);
      /* a GIF animates as an image; only real video needs a player */
      const video = ref && ref.kind === 'video';
      const bits = [ref && ref.framing, ref && ref.movement].filter(Boolean).join(' · ');

      host.innerHTML = `
        ${url
          ? (video
              ? `<video src="${url}" autoplay loop muted playsinline controls></video>`
              : `<img src="${url}" alt="">`)
          : `<p style="color:var(--muted)">That reference is missing its image.</p>`}
        <div class="meta">
          ${bits ? `<b>${bits}</b>` : ''}
          ${ref && ref.note ? `<p>${ref.note}</p>` : ''}
          ${Refs.isLinked(ref) ? `<p style="color:var(--dim);font-size:13px;margin-top:8px">
            Linked — needs a connection to load</p>` : ''}
        </div>
        <div class="nav">
          ${ids.length > 1 ? `<button data-step="-1">‹ Prev</button>` : ''}
          <span class="count">${at + 1} of ${ids.length}</span>
          ${ids.length > 1 ? `<button data-step="1">Next ›</button>` : ''}
        </div>
        <div class="nav"><button data-close style="min-width:180px">Close</button></div>`;
    }

    host.onclick = async e => {
      const step = e.target.closest('[data-step]');
      if(step){
        at = (at + (+step.dataset.step) + ids.length) % ids.length;
        return draw();
      }
      if(e.target.closest('[data-close]') || e.target === host) hide();
    };

    await draw();
    host.classList.add('on');
  }

  function hide(){
    const host = document.getElementById('refview');
    if(!host) return;
    host.classList.remove('on');
    setTimeout(() => { host.innerHTML = ''; }, 220);
  }

  Refs.pick = pick;
  Refs.view = view;
  Refs.hideView = hide;
})(window);
