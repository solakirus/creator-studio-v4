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
  async function readOne(slug, o){
    const d = global.CS3Lib, links = [], url = SITE + slug;
    const offs = [];
    const done = new Promise(res => offs.push(d.onGrab('done', res)));
    offs.push(d.onGrab('link', l => links.push(l)));
    if(o.line) offs.push(d.onGrab('line', l => o.line(String(l))));
    try {
      const r = await d.grabRun({ mode:'scan', url, max:400, setting:'', cookies:'none' });
      if(!r || !r.ok) throw new Error((r && r.why) || 'The grabber couldn’t start');
      await done;
    } finally { offs.forEach(f => { try { f(); } catch(e){} }); }
    let added = 0, found = 0;
    for(const l of links.filter(isClip)){
      found++;
      if(await save(l.url, String(l.title || '').trim(), slug, url)) added++;
    }
    return { added, found };
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
  /* a moving picture that won't load here says so, instead of a blank box */
  function wireImgs(root){
    root.querySelectorAll('img[data-trimg]').forEach(im => {
      if(im._w) return; im._w = 1;
      im.addEventListener('error', () => { const c = im.closest('.trs-cell'); if(c) c.classList.add('bad'); }, { once:true });
    });
  }
  const cellHTML = (r, attr) => `<button class="trs-cell${r.kept ? ' kept' : ''}" ${attr}="${esc(r.id)}" title="${esc(r.title || '')}">
      <img data-trimg src="${esc(r.img)}" alt="" loading="lazy" referrerpolicy="no-referrer"><i>Can’t load here</i>
      <span>${r.kept ? '★ ' : ''}${esc(r.title || techName((r.tech || [])[0]))}</span></button>`;
  const CSS = `
  .trs-pills{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}
  .trs-pills button{flex:0 0 auto;height:34px;padding:0 12px;border-radius:var(--r);border:1px solid var(--line);background:var(--surface-1);color:var(--cream);font-size:14px;white-space:nowrap;cursor:pointer}
  @media (min-width:900px){ #trHost .trs-pills{flex-wrap:wrap;overflow:visible} }
  .trs-pills button i{font-style:normal;color:var(--dim);margin-left:6px;font-size:12px}
  .trs-pills button[aria-pressed="true"]{background:var(--cream);color:#151515;border-color:var(--cream);font-weight:700}
  .trs-pills button[aria-pressed="true"] i{color:#555}
  .trs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
  .trs-cell{position:relative;padding:0;border:0;background:var(--surface-2);border-radius:4px;overflow:hidden;aspect-ratio:16/9;cursor:pointer}
  .trs-cell img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
  .trs-cell > i{display:none;position:absolute;inset:0;align-items:center;justify-content:center;font-style:normal;font-size:12px;color:var(--dim)}
  .trs-cell.bad img{display:none}.trs-cell.bad > i{display:flex}
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

  global.Transitions = { ALL_TECHS, STARTERS, SITE, techName, slugOf, techs, setTechs, all, get, put, keep, idFor, save, addLink,
    canRead, read, watch, peek, hostsList, hostFor, setGap, assign, pick, cellHTML, wireImgs, css };
})(window);
