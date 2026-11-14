/* v4: Transitions — Eyecandy's techniques, watched by link, placed between shots.

   Nothing is downloaded. Eyecandy (eyecannndy.com) shows each clip as a moving
   picture (an animated WebP on asset.eyecannndy.com); a transition here is that
   picture's address, its title and the technique it came from. The laptop
   reads a technique's page with the grabber's own browser window (the site
   sits behind Cloudflare's check, which a plain request never passes) — the
   same "Find links" scan the Library uses, so no files land on disk — and the
   list syncs to the phone and the iPad like everything else.

   Placing one: a shot carries `tr: { id, n }`, the transition out of it into
   the next shot (shotlist.js extras), so it rides along wherever the shots go
   — the clip, an episode's sequence, a series video, and the shoot task on a
   day. While shooting it stays out of sight (task.js: a "Transitions" button
   shows faint markers); the Edit tab's cut list shows it properly.

     Transitions.all() / get(id) / put(rec) / keep(id, on)
     Transitions.techs() / setTechs(list) / techName(slug) / ALL_TECHS
     Transitions.canRead() / read(slugs, { line(text) }) → { added, found }
     Transitions.addLink(url, title, slug)
     Transitions.watch(list, index, o)      the pop-out player (swipeplayer.js)
     Transitions.assign(rec)                where it goes: a clip / sequence / video, then the gap
     Transitions.pick(o) → rec|null         choose one (the Edit tab's "+ transition")
     Transitions.setGap(t, i, rec|null)     on a host's task-shaped copy
     Transitions.hostsList() / hostFor(key) */
(function(global){
  const esc = s => U.esc(s);
  const SITE = 'https://eyecannndy.com/technique/';

  /* Eyecandy's techniques (the list on every technique page). Their own
     names where the address says something else (crash-transition is "Crash cut"). */
  const ALL_TECHS = ['aerial','anthropomorphism','arc-movement','architexture','as-object','aspect-ratio-switch','bolt-cam','boomerang','breakdown',
    'bullet-time','camera-roll','central-framing','choreo','cinemagraph','close-up','collage','color-shift','conveyor','crash-transition','cut-ins',
    'datamosh','digital-gesture','digital-overlay','distortions','dolly-shot','dolly-zoom','double-dolly','double-exposure','dreamcore','duplication',
    'dutch-angle','dystopian','echo-printing','epiphany-shot','falling','first-person-pov','fisheye','fixed-camera','flash-cut','floating','focal-focus',
    'focal-shift','fourth-wall','fpv-drone','freeze-frame','generative','glitch','ground-shot','halation','hard-light','haze','high-angle','infinite',
    'interview','jump-cut','kaleidoscope','lazy-susan','light-flash','locked-on','low-angle','magnification','masking','match-cut','match-motion',
    'match-split','maximalism','mixed-media','model','morphing','motion-blur','night-vision','object-portal','omnidirectional','over-the-shoulder',
    'overhead','pan','parallax','pass-through','pedestal','photogrammetry','photography','pixel-art','probe-lens','product','profile-shot','projections',
    'quick-cuts','reflections','scale-shift','screen-in-screen','set-transition','shadow-box','shaky-cam','silhouette','slit-scan','slow-motion',
    'snorricam','speed-ramping','split-diopter','split-screen','spotlight','step-printing','stop-motion','stutter','stylistic-suck','surrealism',
    'tableau-shots','thermal','tilt','tilt-shift','tracking','traditional','transformation','transition','trip','trucking','two-shot','typography',
    'ultra-wide-zero-d','undercranking','underwater','vhs','video-game','video-portraits','vignette','void','voyeur','wandering','whip-pan',
    'wide-shot','wierdcore','wigglegram','worms-eye','x-ray','zoetrope','zoom-in'];
  const NAMES = { 'crash-transition':'Crash cut', 'first-person-pov':'First-person POV', 'fpv-drone':'FPV drone', 'vhs':'VHS', 'x-ray':'X-ray',
    'ultra-wide-zero-d':'Ultra wide zero D', 'wierdcore':'Weirdcore', 'worms-eye':'Worm’s eye', 'cut-ins':'Cut-ins', 'set-transition':'Set transition' };
  /* the ones that are a way from one shot to the next */
  const STARTERS = ['transition','crash-transition','match-cut','match-motion','match-split','whip-pan','jump-cut','flash-cut','light-flash',
    'morphing','object-portal','pass-through','set-transition','masking','speed-ramping','freeze-frame','glitch','datamosh'];
  /* Eyecandy lists its techniques A–Z with no grouping; these eight groups
     are the app's own, so 136 of them can be found by what they do */
  const GROUPS = [
    { k:'cuts',   label:'Transitions & cuts', slugs:'transition crash-transition match-cut match-motion match-split whip-pan jump-cut flash-cut light-flash morphing object-portal pass-through set-transition masking quick-cuts cut-ins aspect-ratio-switch transformation as-object' },
    { k:'moves',  label:'Camera moves',       slugs:'arc-movement dolly-shot dolly-zoom double-dolly pan tilt pedestal tracking trucking zoom-in camera-roll locked-on snorricam bolt-cam lazy-susan wandering floating falling shaky-cam fpv-drone aerial omnidirectional conveyor parallax' },
    { k:'angles', label:'Angles & framing',   slugs:'close-up wide-shot high-angle low-angle overhead worms-eye ground-shot dutch-angle over-the-shoulder two-shot profile-shot central-framing tableau-shots first-person-pov fixed-camera interview epiphany-shot voyeur fourth-wall split-diopter' },
    { k:'lens',   label:'Lens & optics',      slugs:'fisheye focal-focus focal-shift tilt-shift probe-lens magnification ultra-wide-zero-d halation haze reflections vignette x-ray thermal night-vision motion-blur' },
    { k:'time',   label:'Time & speed',       slugs:'slow-motion speed-ramping undercranking freeze-frame step-printing stutter boomerang bullet-time stop-motion infinite echo-printing zoetrope slit-scan' },
    { k:'light',  label:'Light & color',      slugs:'hard-light spotlight silhouette color-shift shadow-box projections' },
    { k:'fx',     label:'Effects',            slugs:'double-exposure duplication split-screen screen-in-screen collage mixed-media digital-overlay digital-gesture datamosh glitch distortions kaleidoscope scale-shift typography cinemagraph photogrammetry generative pixel-art video-game vhs wigglegram breakdown' },
    { k:'style',  label:'Style & subject',    slugs:'dreamcore wierdcore dystopian surrealism maximalism stylistic-suck void trip traditional anthropomorphism architexture choreo model product photography video-portraits underwater' }
  ].map(g => ({ ...g, slugs:g.slugs.split(' ') }));
  const groupOf = slug => (GROUPS.find(g => g.slugs.includes(slug)) || { k:'other' }).k;
  const techName = slug => NAMES[slug] || (String(slug || '').charAt(0).toUpperCase() + String(slug || '').slice(1)).replace(/-/g, ' ');
  const slugOf = u => { const m = /eyecannndy\.com\/technique\/([a-z0-9-]+)/i.exec(String(u || '')); return m ? m[1].toLowerCase() : ''; };

  /* ------------------------------------------------------------ the data */
  const TECH_KEY = 'transition-techs';
  async function techs(){
    let v = null;
    try { v = await Store.get('settings', TECH_KEY); } catch(e){}
    const list = Array.isArray(v) ? v : STARTERS.map(slug => ({ slug }));
    return list.filter(x => x && x.slug).map(x => ({ slug:x.slug, name:x.name || techName(x.slug), readAt:x.readAt || 0, n:x.n || 0 }));
  }
  async function setTechs(list){
    await Store.put('settings', list.map(x => ({ slug:x.slug, ...(x.name && x.name !== techName(x.slug) ? { name:x.name } : {}),
      ...(x.readAt ? { readAt:x.readAt } : {}), ...(x.n ? { n:x.n } : {}) })), TECH_KEY);
  }
  async function all(){
    let l = [];
    try { l = (await Store.all('transitions')).values; } catch(e){}
    return (l || []).filter(r => r && r.id && r.img);
  }
  const get = id => Store.get('transitions', id).catch(() => null);
  const put = rec => Store.put('transitions', rec);
  async function keep(id, on){
    const r = await get(id); if(!r) return null;
    if(on) r.kept = Date.now(); else delete r.kept;
    await put(r); return r;
  }
  /* one id per moving picture, the same on every device: its file name */
  function idFor(img){
    const f = String(img || '').split(/[?#]/)[0].split('/').pop().replace(/\.[a-z0-9]+$/i, '');
    return 'ec_' + (/^[\w-]{4,60}$/.test(f) ? f : U.stableId ? U.stableId('u', img).slice(2) : f.replace(/\W/g, '').slice(0, 40));
  }
  async function save(img, title, slug, page){
    const id = idFor(img);
    const had = await get(id);
    const r = had || { id, img, title:'', tech:[], page:'', at:Date.now() };
    if(title && (!r.title || /^untitled/i.test(r.title))) r.title = title;
    if(slug && !r.tech.includes(slug)) r.tech = r.tech.concat(slug);
    if(page && !r.page) r.page = page;
    if(!had || JSON.stringify(had) !== JSON.stringify(r)) await put(r);
    return !had;
  }
  /* a link pasted by hand: a moving picture or clip address, or a technique page */
  async function addLink(url, title, slug){
    const u = String(url || '').trim();
    if(!/^https?:\/\//i.test(u)) throw new Error('That isn’t a link');
    const s = slugOf(u);
    if(s){
      const list = await techs();
      if(!list.some(x => x.slug === s)){ list.push({ slug:s }); await setTechs(list); }
      return { tech:s };
    }
    await save(u, title || 'Transition', slug || 'mine', '');
    return { id:idFor(u) };
  }

  /* ------------------------------------------------------------ reading Eyecandy (the laptop) */
  const canRead = () => !!(global.CS3Lib && CS3Lib.grabRun && CS3Lib.onGrab);
  const isClip = l => l && /asset\.eyecannndy\.com\/media\/clip\//i.test(l.url || '') && /\.(webp|gif|mp4|webm)(\?|$)/i.test(l.url || '');
  /* one page of a technique; Eyecandy shows the first, loads the second as
     you scroll, then wants "Load more" pressed — so the reader asks for
     ?page=2, 3… itself until a page has nothing, or the same as the last
     (custom.js: path + '?sortby=…&page=N') */
  const MAX_PAGES = 40;
  async function readOne(slug, o){
    const url = SITE + slug;
    let added = 0, found = 0, last = '';
    const seen = new Set();
    for(let n = 1; n <= MAX_PAGES; n++){
      if(o.stopped && o.stopped()) break;
      if(n > 1 && o.line) o.line(`Reading ${techName(slug)} · page ${n}…`);
      const clips = (await scanPage(n === 1 ? url : url + '?page=' + n, o)).filter(isClip);
      const sig = clips.map(l => idFor(l.url)).sort().join('|');
      if(!clips.length || sig === last) break;
      last = sig;
      for(const l of clips){
        const id = idFor(l.url);
        if(seen.has(id)) continue;
        seen.add(id); found++;
        if(await save(l.url, String(l.title || '').trim(), slug, url)) added++;
      }
      if(o.page) o.page(slug, n, found);
    }
    return { added, found };
  }
  async function scanPage(url, o){
    const d = global.CS3Lib, links = [];
    const offs = [];
    const done = new Promise(res => offs.push(d.onGrab('done', res)));
    offs.push(d.onGrab('link', l => links.push(l)));
    if(o.line) offs.push(d.onGrab('line', l => o.line(String(l))));
    try {
      const r = await d.grabRun({ mode:'scan', url, max:400, setting:'', cookies:'none' });
      if(!r || !r.ok) throw new Error((r && r.why) || 'The grabber couldn’t start');
      await done;
    } finally { offs.forEach(f => { try { f(); } catch(e){} }); }
    return links;
  }
  /* techniques Eyecandy has added since ALL_TECHS was written: every page
     links to all of them; new ones are kept in the list (settings) */
  async function discover(){
    if(!canRead()) throw new Error('Checking Eyecandy needs the laptop app');
    const links = await scanPage('https://eyecannndy.com/', {});
    const found = [...new Set(links.map(l => slugOf(l.url)).filter(Boolean))];
    const list = await techs(), have = new Set(list.map(t => t.slug));
    const fresh = found.filter(x => !ALL_TECHS.includes(x));
    fresh.forEach(x => ALL_TECHS.push(x));
    const add = found.filter(x => !have.has(x) && fresh.includes(x));
    if(add.length) await setTechs(list.concat(add.map(slug => ({ slug }))));
    return add;
  }
  async function read(slugs, o){
    o = o || {};
    if(!canRead()) throw new Error('Reading Eyecandy needs the laptop app');
    let added = 0, found = 0;
    for(const slug of slugs){
      if(o.stopped && o.stopped()) break;
      if(o.line) o.line(`Reading ${techName(slug)}…`);
      const r = await readOne(slug, o);
      added += r.added; found += r.found;
      const list = await techs();
      const t = list.find(x => x.slug === slug);
      if(t){ t.readAt = Date.now(); t.n = r.found; await setTechs(list); }
      if(o.step) o.step(slug, r);
    }
    return { added, found };
  }

  /* ------------------------------------------------------------ watching */
  function watch(list, index, o){
    o = o || {};
    if(!global.SwipePlayer) return;
    SwipePlayer.open(list.map(r => ({ ...r, url:r.page || '', img:r.img })), index, {
      noun:'transition',
      sourceLabel:'↗ Eyecandy',
      actions: o.actions || [{ k:'assign', label:'Assign to a shot' }, { k:'keep', label: r => r.kept ? '★ Kept' : '☆ Keep' }],
      onAction: async (k, r, redraw) => {
        if(k === 'keep'){ const n = await keep(r.id, !r.kept); if(n){ r.kept = n.kept; if(!n.kept) delete r.kept; } redraw(); if(o.onChange) o.onChange(); return; }
        if(k === 'assign'){ SwipePlayer.close(); await assign(r); if(o.onChange) o.onChange(); return; }
        if(o.onAction) o.onAction(k, r);
      },
      onClose:o.onClose
    });
  }
  /* watch the one a shot points at */
  async function peek(id, name){
    const r = await get(id);
    if(!r) return U.toast(`“${name || 'That transition'}” isn’t on this device yet`);
    watch([r], 0, { actions:[] });
  }

  /* ------------------------------------------------------------ placing one */
  /* where shots live: clips, an episode's sequences, series videos */
  async function hostsList(){
    const out = [];
    const ts = r => r.updatedAt || r.at || r.createdAt || 0;
    let clips = [], vlogs = [], videos = [];
    const vals = async s => { try { return (await Store.all(s)).values || []; } catch(e){ return []; } };
    clips = await vals('clips'); vlogs = await vals('vlogs'); videos = await vals('videos');
    const nShots = r => ShotList.norm(Array.isArray(r.shotList) ? r.shotList : r.shots).length;
    clips.filter(c => c && c.stage !== 'published').forEach(c => out.push({ key:'clip:' + c.id, kind:'Clip', title:c.title || 'Untitled clip', n:nShots(c), t:ts(c) }));
    vlogs.forEach(v => (v.acts || []).forEach(a => (a.beats || []).forEach(b => {
      if(b && b.id) out.push({ key:'beat:' + v.id + ':' + b.id, kind:'Sequence', title:b.title || 'Sequence', sub:v.title || '', n:ShotList.norm(b.shots).length, t:ts(v) });
    })));
    videos.forEach(v => out.push({ key:'video:' + v.id, kind:'Video', title:v.title || 'Untitled', n:nShots(v), t:ts(v) }));
    return out.filter(h => h.n > 1).sort((a, b) => b.t - a.t);
  }
  function hostFor(key){
    const p = String(key).split(':');
    if(p[0] === 'clip') return ShotList.hostClip(p[1]);
    if(p[0] === 'video') return ShotList.hostVideo(p[1]);
    if(p[0] === 'beat') return ShotList.hostBeat(p[1], p[2]);
    return null;
  }
  const slotsOf = t => (t && t.page && t.page.slots) || [];
  const stepOf = (t, i) => (t.subs || []).find(s2 => s2.shot === i) || null;
  /* the transition out of shot i (into i + 1); rec null takes it off */
  function setGap(t, i, rec){
    let s2 = stepOf(t, i);
    if(!s2){ const sl = slotsOf(t)[i] || {}; s2 = { t:sl.text || 'Shot ' + (i + 1), done:false, shot:i, pg:1 }; (t.subs = t.subs || []).push(s2); }
    if(rec) s2.tr = { id:rec.id, n:rec.title || techName((rec.tech || [])[0]) };
    else delete s2.tr;
  }
  const shotName = (t, i) => (slotsOf(t)[i] || {}).text || 'Shot ' + (i + 1);

  async function assign(rec){
    const hosts = await hostsList();
    if(!hosts.length) return U.toast('Nothing has two shots yet — plan the shots of a clip or a sequence first');
    let q = '';
    const listHTML = () => {
      const f = q ? hosts.filter(h => (h.title + ' ' + (h.sub || '')).toLowerCase().includes(q)) : hosts;
      return f.slice(0, 80).map(h => `<button class="trs-host" data-host="${esc(h.key)}"><small>${h.kind}${h.sub ? ' · ' + esc(h.sub) : ''}</small><b>${esc(h.title)}</b><span>${h.n} shots</span></button>`).join('')
        || '<p class="trs-none">Nothing by that name.</p>';
    };
    App.sheet(`<h2 style="margin:0 0 4px">Where does “${esc(rec.title || 'this transition')}” go?</h2>
      <p class="hintline" style="margin:0 0 10px">Pick the clip, sequence or video, then the gap between two shots.</p>
      <input class="trs-q" type="search" placeholder="Find a clip or sequence" aria-label="Find a clip or sequence">
      <div class="trs-hosts">${listHTML()}</div>
      <div class="sheetcta"><button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
      css();
      sh.querySelector('.trs-q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); sh.querySelector('.trs-hosts').innerHTML = listHTML(); });
      sh.addEventListener('click', async e => {
        if(e.target.closest('[data-no]')) return App.closeSheet();
        const b = e.target.closest('[data-host]');
        if(b) gapSheet(rec, b.dataset.host, (hosts.find(h => h.key === b.dataset.host) || {}).title);
      });
    });
  }
  async function gapSheet(rec, key, title){
    const h = hostFor(key);
    let t = h ? await h.load() : null;
    if(!t) return U.toast('That one is gone');
    const draw = () => {
      const sl = slotsOf(t);
      return `<h2 style="margin:0 0 4px">${esc(title || t.title || 'Shots')}</h2>
        <p class="hintline" style="margin:0 0 10px">Tap the gap “${esc(rec.title || 'it')}” goes in.</p>
        <div class="trs-gaps">${sl.map((_, i) => {
          const cur = (stepOf(t, i) || {}).tr;
          return `<div class="trs-shot"><span>${i + 1}</span>${esc(shotName(t, i))}</div>${i < sl.length - 1 ? `
            <button class="trs-gap${cur ? ' has' : ''}${cur && cur.id === rec.id ? ' this' : ''}" data-gap="${i}">${cur
              ? (cur.id === rec.id ? '✓ ' : '⇄ ') + esc(cur.n || 'Transition') + (cur.id === rec.id ? '' : ' · replace') : '+ Between ' + (i + 1) + ' and ' + (i + 2)}</button>` : ''}`;
        }).join('')}</div>
        <div class="sheetcta"><button class="btn-ghost" data-back>Back</button><button class="btn-ghost" data-no>Done</button></div>`;
    };
    App.sheet(draw(), sh => {
      css();
      sh.addEventListener('click', async e => {
        if(e.target.closest('[data-no]')) return App.closeSheet();
        if(e.target.closest('[data-back]')) return assign(rec);
        const g = e.target.closest('[data-gap]');
        if(!g) return;
        const i = +g.dataset.gap, cur = (stepOf(t, i) || {}).tr;
        setGap(t, i, cur && cur.id === rec.id ? null : rec);
        await h.save(t); t = await h.load();
        sh.innerHTML = draw();
        U.toast(cur && cur.id === rec.id ? 'Taken off' : `${rec.title || 'Transition'} · between shot ${i + 1} and ${i + 2}`);
      });
    });
  }

  /* choose one — the Edit tab's "+ transition" between two cuts */
  function pick(o){
    o = o || {};
    return new Promise(async resolve => {
      const recs = await all();
      if(!recs.length){ U.toast('No transitions yet — open Content → Transitions'); return resolve(null); }
      const list = await techs();
      let f = recs.some(r => r.kept) ? 'kept' : 'all';
      const body = () => {
        const show = f === 'kept' ? recs.filter(r => r.kept) : f === 'all' ? recs : recs.filter(r => (r.tech || []).includes(f));
        return `<h2 style="margin:0 0 8px">${esc(o.title || 'Pick a transition')}</h2>
          <div class="trs-pills">${[['kept', '★ Kept'], ['all', 'All']].concat(list.filter(x => recs.some(r => (r.tech || []).includes(x.slug))).map(x => [x.slug, x.name]))
            .map(([k, l]) => `<button data-f="${esc(k)}" aria-pressed="${f === k}">${esc(l)}</button>`).join('')}</div>
          <div class="trs-grid" style="max-height:56vh;overflow:auto">${show.map(r => cellHTML(r, 'data-pick')).join('') || '<p class="trs-none">None here yet.</p>'}</div>
          <div class="sheetcta">${o.current ? '<button class="btn-ghost" data-clear>No transition here</button>' : ''}<button class="btn-ghost" data-no>Cancel</button></div>`;
      };
      App.sheet(body(), sh => {
        css(); wireImgs(sh);
        sh.addEventListener('click', e => {
          const b = e.target.closest('[data-f]');
          if(b){ f = b.dataset.f; sh.innerHTML = body(); wireImgs(sh); return; }
          const p = e.target.closest('[data-pick]');
          if(p){ App.closeSheet(); return resolve(recs.find(r => r.id === p.dataset.pick) || null); }
          if(e.target.closest('[data-clear]')){ App.closeSheet(); return resolve('clear'); }
          if(e.target.closest('[data-no]')){ App.closeSheet(); resolve(null); }
        });
      });
    });
  }

  /* ------------------------------------------------------------ the look */
  /* A grid of a hundred animated WebPs (each 0.6–2 MB, decoded frame by
     frame) froze the laptop. So the grid shows a still of each by default —
     its first frame, drawn once, two at a time, then the moving picture let
     go — kept on this device (transition-stills) so the next visit is
     instant. "Play all" animates only the ones on screen; the player always
     moves. */
  const MOVE_KEY = 'cs4-tr-moving';
  const moving = () => { try { return localStorage.getItem(MOVE_KEY) === '1'; } catch(e){ return false; } };
  const setMoving = on => { try { localStorage.setItem(MOVE_KEY, on ? '1' : '0'); } catch(e){} };
  const stills = new Map();
  const W = 320, H = 180;
  const bad = cell => cell.classList.add('bad');
  function drawCover(cv, im){
    const g = cv.getContext('2d'), iw = im.naturalWidth || W, ih = im.naturalHeight || H;
    const k = Math.max(W / iw, H / ih), w = iw * k, h = ih * k;
    g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  }
  async function stillOf(cell){
    const id = cell.dataset.trid, src = cell.dataset.trsrc;
    const show = url => { const im = cell.querySelector('img'); im.src = url; im.hidden = false; };
    if(stills.has(id)) return show(stills.get(id));
    let saved = null;
    try { saved = await Store.get('transition-stills', id); } catch(e){}
    if(saved){ stills.set(id, saved); return show(saved); }
    await new Promise(done => {
      const im = new Image();
      im.referrerPolicy = 'no-referrer';
      const end = () => { im.onload = im.onerror = null; im.src = ''; done(); };
      im.onerror = () => { bad(cell); end(); };
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        try { drawCover(cv, im); } catch(e){ bad(cell); return end(); }
        let url = null;
        /* without CORS the canvas can be shown but not saved: show it as it is */
        try { url = cv.toDataURL('image/jpeg', 0.72); } catch(e){}
        if(url){ stills.set(id, url); Store.put('transition-stills', url, id).catch(() => {}); show(url); }
        else { cv.className = 'trs-cv'; const old = cell.querySelector('img'); old.hidden = true; cell.insertBefore(cv, old); }
        end();
      };
      im.src = src;
    });
  }
  let queue = [], working = 0;
  function pump(){
    while(working < 2 && queue.length){
      const c = queue.shift();
      if(!c.isConnected) continue;
      working++;
      stillOf(c).catch(() => {}).then(() => { working--; pump(); });
    }
  }
  const observers = new WeakMap();
  /* stills: the mouse over one plays it, and leaving puts the still back */
  function hoverPlay(root){
    if(root._trHover) return; root._trHover = true;
    root.addEventListener('pointerover', e => {
      if(e.pointerType !== 'mouse' || moving()) return;
      const c = e.target.closest('.trs-cell[data-trsrc]');
      if(!c || c._live || c.classList.contains('bad')) return;
      c._live = true;
      const im = c.querySelector('img');
      c._still = im.hidden ? null : im.getAttribute('src');
      const cv = c.querySelector('.trs-cv'); if(cv) cv.hidden = true;
      im.src = c.dataset.trsrc; im.hidden = false;
    });
    root.addEventListener('pointerout', e => {
      const c = e.target.closest('.trs-cell[data-trsrc]');
      if(!c || !c._live || (e.relatedTarget && c.contains(e.relatedTarget))) return;
      c._live = false;
      if(moving()) return;
      const im = c.querySelector('img'), cv = c.querySelector('.trs-cv');
      if(c._still) im.src = c._still; else { im.removeAttribute('src'); im.hidden = true; }
      if(cv) cv.hidden = false;
    });
  }
  /* fill a grid's cells: stills, or the moving pictures while on screen */
  function wireImgs(root){
    hoverPlay(root);
    const cells = [...root.querySelectorAll('.trs-cell[data-trsrc]')];
    const old = observers.get(root); if(old){ old.disconnect(); observers.delete(root); }
    if(!moving()){
      queue = queue.filter(c => c.isConnected).concat(cells);
      pump();
      return;
    }
    if(!('IntersectionObserver' in global)) return cells.forEach(c => { const im = c.querySelector('img'); im.src = c.dataset.trsrc; im.hidden = false; });
    const io = new IntersectionObserver(es => es.forEach(e => {
      const im = e.target.querySelector('img');
      if(e.isIntersecting){ if(im.getAttribute('src') !== e.target.dataset.trsrc){ im.onerror = () => bad(e.target); im.src = e.target.dataset.trsrc; im.hidden = false; } }
      else if(im.getAttribute('src')){ im.removeAttribute('src'); }
    }), { rootMargin:'100px' });
    cells.forEach(c => io.observe(c));
    observers.set(root, io);
  }
  const cellHTML = (r, attr) => `<button class="trs-cell${r.kept ? ' kept' : ''}" ${attr}="${esc(r.id)}" data-trid="${esc(r.id)}" data-trsrc="${esc(r.img)}" title="${esc(r.title || '')}">
      <img alt="" hidden referrerpolicy="no-referrer"><i>Can’t load here</i>
      <span>${r.kept ? '★ ' : ''}${esc(r.title || techName((r.tech || [])[0]))}</span></button>`;
  const CSS = `
  .trs-pills{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}
  .trs-pills button{flex:0 0 auto;height:34px;padding:0 12px;border-radius:var(--r);border:1px solid var(--line);background:var(--surface-1);color:var(--cream);font-size:14px;white-space:nowrap;cursor:pointer}
  .trs-top{overflow:visible;flex-wrap:nowrap;align-items:center}
  .trs-search{flex:1 1 200px;max-width:320px;min-width:0;height:34px;padding:0 11px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit;font-size:14px}
  .trs-search:focus{outline:none;border-color:var(--orange)}
  .trs-row{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:0 0 8px}
  .trs-row button{flex:0 0 auto;height:32px;padding:0 11px;border-radius:16px;border:1px solid var(--line);background:transparent;color:var(--cream);font:inherit;font-size:13.5px;white-space:nowrap;cursor:pointer}
  .trs-row button i{font-style:normal;color:var(--dim);margin-left:5px;font-size:12px}
  .trs-row button[aria-pressed="true"]{background:var(--cream);color:#151515;border-color:var(--cream);font-weight:700}
  .trs-row button[aria-pressed="true"] i{color:#555}
  .trs-row button[aria-expanded="true"]:not([aria-pressed="true"]){border-color:var(--cream)}
  .trs-row button.unread{color:var(--muted);border-style:dashed}
  .trs-row button.edit{color:var(--muted)}
  .trs-techs{margin:-2px 0 2px;padding:8px 0 8px;border-top:1px solid var(--line)}
  @media (min-width:900px){ .trs-row{flex-wrap:wrap;overflow:visible} }
  .trs-selw{position:relative;flex:0 1 auto;min-width:0;display:flex}
  .trs-selw select{height:34px;max-width:min(260px,52vw);padding:0 30px 0 12px;border-radius:var(--r);border:1px solid var(--line);background:var(--surface-1);color:var(--cream);font:inherit;font-size:14px;-webkit-appearance:none;appearance:none;cursor:pointer;text-overflow:ellipsis}
  .trs-selw::after{content:'';position:absolute;right:12px;top:13px;width:7px;height:7px;border:solid var(--muted);border-width:0 2px 2px 0;transform:rotate(45deg);pointer-events:none}
  .trs-selw.on select{background:var(--cream);color:#151515;border-color:var(--cream);font-weight:700}
  .trs-selw.on::after{border-color:#151515}
  .trs-sels{display:flex;gap:6px;margin:0 0 10px}
  .trs-sels .trs-selw{flex:1 1 0;max-width:280px}
  .trs-sels .trs-selw select{width:100%;max-width:none}
  .trs-selw.off select{color:var(--dim);cursor:default}
  .trs-selw select option,.trs-selw select optgroup{background:var(--surface-1);color:var(--cream);font-weight:400}
  .trs-pills button i{font-style:normal;color:var(--dim);margin-left:6px;font-size:12px}
  .trs-pills button[aria-pressed="true"]{background:var(--cream);color:#151515;border-color:var(--cream);font-weight:700}
  .trs-pills button[aria-pressed="true"] i{color:#555}
  .trs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
  .trs-cell{position:relative;padding:0;border:0;background:var(--surface-2);border-radius:4px;overflow:hidden;aspect-ratio:16/9;cursor:pointer}
  .trs-cell img,.trs-cell .trs-cv{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
  .trs-cell img[hidden],.trs-cell .trs-cv[hidden]{display:none}
  .trs-cell > i{display:none;position:absolute;inset:0;align-items:center;justify-content:center;font-style:normal;font-size:12px;color:var(--dim)}
  .trs-cell.bad img,.trs-cell.bad .trs-cv{display:none}.trs-cell.bad > i{display:flex}
  .trs-cell span{position:absolute;left:0;right:0;bottom:0;padding:14px 7px 5px;font-size:11.5px;line-height:1.25;color:#fff;text-align:left;background:linear-gradient(#0000,#000c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .trs-cell.kept{outline:2px solid var(--orange);outline-offset:-2px}
  .trs-bar{display:flex;align-items:center;gap:8px;margin:0 0 10px;min-height:34px}
  .trs-bar span{flex:1;min-width:0;color:var(--muted);font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .trs-bar a.btn-sm{text-decoration:none;display:inline-flex;align-items:center}
  .trs-tl{display:flex;flex-wrap:wrap;gap:6px}
  .trs-tl span{display:inline-flex;align-items:center;gap:2px;height:32px;padding:0 4px 0 11px;border:1px solid var(--line);border-radius:16px;font-size:13.5px}
  .trs-tl span button{width:26px;height:26px;border:0;background:transparent;color:var(--muted);font-size:16px;cursor:pointer}
  .trs-tl.add{max-height:30vh;overflow:auto}
  .trs-tl.add button{height:30px;padding:0 10px;border:1px dashed var(--line);border-radius:15px;background:transparent;color:var(--muted);font-size:13px;cursor:pointer}
  .trs-none{margin:6px 0;color:var(--muted);font-size:14px}
  .trs-q{width:100%;height:40px;margin:0 0 8px;padding:0 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit}
  .trs-hosts{display:flex;flex-direction:column;gap:6px;max-height:52vh;overflow:auto}
  .trs-host{display:grid;grid-template-columns:1fr auto;gap:0 10px;text-align:left;padding:9px 11px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);color:var(--cream);cursor:pointer}
  .trs-host small{grid-column:1/-1;color:var(--muted);font-size:11.5px}
  .trs-host b{font-size:15px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .trs-host span{color:var(--muted);font-size:12.5px;align-self:center}
  .trs-gaps{display:flex;flex-direction:column;max-height:56vh;overflow:auto}
  .trs-shot{display:flex;gap:9px;align-items:center;padding:9px 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);font-size:14.5px}
  .trs-shot span{color:var(--dim);font-size:12px;min-width:16px}
  .trs-gap{margin:4px 0 4px 22px;padding:6px 10px;border:1px dashed var(--line);border-radius:14px;background:transparent;color:var(--muted);font-size:13px;text-align:left;cursor:pointer;align-self:flex-start}
  .trs-gap.has{border-style:solid;color:var(--cream)}
  .trs-gap.this{border-color:var(--orange);color:var(--orange)}`;
  function css(){
    if(document.getElementById('trs-css')) return;
    const st = document.createElement('style'); st.id = 'trs-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  global.Transitions = { ALL_TECHS, STARTERS, GROUPS, groupOf, SITE, techName, slugOf, techs, setTechs, all, get, put, keep, idFor, save, addLink,
    canRead, read, discover, watch, peek, hostsList, hostFor, setGap, assign, pick, cellHTML, wireImgs, moving, setMoving, css };
})(window);
