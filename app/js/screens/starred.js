/* Starred — the everyday frames, on the phone.

   The groups are made on the laptop (Library → ★ Starred); every starred frame
   is copied to every device and never ages out (taskframes.js). Here they are
   to look through while filming — tap one for full screen, swipe through its
   group — and to pick from: StarPick.open() lets a task's shot take one.

     Screens.push('starred')
     StarPick.open({ title, onPick(uid) }) */
(function(global){
  const esc = s => U.esc(s);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const CSS = `
  .st-pills{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}
  .st-pills button{flex:0 0 auto;height:34px;padding:0 12px;border-radius:var(--r);border:1px solid var(--line);background:var(--surface-1);color:var(--cream);font-size:14px;white-space:nowrap}
  .st-pills button[aria-pressed="true"]{background:var(--cream);color:#151515;border-color:var(--cream);font-weight:700}
  .st-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:6px}
  .st-cell{position:relative;padding:0;border:0;background:var(--surface-2);border-radius:3px;overflow:hidden;padding-top:125%;cursor:pointer}
  .st-cell img,.st-cell video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
  .st-cell span{position:absolute;left:0;right:0;bottom:0;padding:14px 6px 5px;font-size:11px;line-height:1.25;color:#fff;text-align:left;background:linear-gradient(#0000,#000c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .st-miss{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:11px;padding:6px;text-align:center}
  .st-meta{color:var(--muted);font-size:13px;margin:0 0 10px}
  .st-view{position:fixed;inset:0;z-index:200;background:#000;display:flex;flex-direction:column;color:#EDE5D2}
  .st-vtop{display:flex;align-items:center;gap:10px;padding:calc(var(--sat,0px) + 10px) 12px 8px}
  .st-vtop button{width:42px;height:42px;border:1px solid #ffffff33;border-radius:var(--r);background:#0006;color:#EDE5D2;font-size:20px}
  .st-vtop b{flex:1;font-family:var(--display),sans-serif;font-weight:900}
  .st-vtop small{color:#FB6900;font-family:var(--display),sans-serif;font-weight:900}
  .st-vpic{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;touch-action:pan-y}
  .st-vpic img,.st-vpic video{width:100%;height:100%;object-fit:contain}
  .st-vcap{padding:10px 16px calc(var(--sab,0px) + 16px);font-size:16px;background:#151515}
  .st-vbar{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 16px calc(var(--sab,0px) + 14px);background:#151515}
  .st-vbar button{height:52px;border-radius:var(--r);border:1px solid #2F2C26;background:#1F1C17;color:#EDE5D2;font-size:22px}`;
  function css(){ if(!document.getElementById('st-css')){ const s = document.createElement('style'); s.id = 'st-css'; s.textContent = CSS; document.head.appendChild(s); } }

  /* the groups, each with its frames as they are on this device */
  async function load(){
    const groups = await MediaLib.allStars();
    let lib = null;
    try { lib = await MediaLib.load(); } catch(e){}
    return { lib, groups: groups.map(g => ({ ...g, frames: g.items.map(u => ({ uid:u, it: lib && MediaLib.find(lib, u) })) })) };
  }
  async function cellsHTML(frames, attr){
    const out = await Promise.all(frames.map(async f => {
      const u = f.it ? await MediaLib.url(f.it).catch(() => null) : null;
      const name = f.it ? MediaLib.title(f.it) : '';
      const pic = !u ? `<i class="st-miss">on its way from the laptop</i>`
        : f.it.kind === 'video' ? `<video src="${esc(u)}" muted loop autoplay playsinline preload="metadata"></video>` : `<img src="${esc(u)}" alt="" loading="lazy">`;
      return `<button class="st-cell" ${attr}="${esc(f.uid)}">${pic}${name ? `<span>${esc(name)}</span>` : ''}</button>`;
    }));
    return out.join('');
  }

  /* full screen, swiping through one group */
  async function viewer(frames, at, title){
    const ok = frames.filter(f => f.it);
    if(!ok.length) return;
    let i = Math.max(0, ok.findIndex(f => f.uid === at));
    const box = document.createElement('div');
    box.className = 'st-view';
    document.body.appendChild(box);
    const draw = async () => {
      const f = ok[i];
      const u = await MediaLib.url(f.it).catch(() => null);
      box.innerHTML = `<div class="st-vtop"><button data-x aria-label="Close">✕</button><b>★ ${esc(title)}</b><small>${i + 1} / ${ok.length}</small></div>
        <div class="st-vpic">${!u ? '' : f.it.kind === 'video' ? `<video src="${esc(u)}" muted loop autoplay playsinline></video>` : `<img src="${esc(u)}" alt="">`}</div>
        <div class="st-vcap">${esc(MediaLib.title(f.it))}</div>
        <div class="st-vbar"><button data-p aria-label="Previous">‹</button><button data-n aria-label="Next">›</button></div>`;
    };
    const go = d => { i = (i + d + ok.length) % ok.length; draw(); };
    box.addEventListener('click', e => {
      if(e.target.closest('[data-x]')) return box.remove();
      if(e.target.closest('[data-p]')) return go(-1);
      if(e.target.closest('[data-n]')) return go(1);
    });
    let sx = null;
    box.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive:true });
    box.addEventListener('touchend', e => { if(sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if(Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); }, { passive:true });
    const key = e => { if(!box.isConnected) return document.removeEventListener('keydown', key);
      if(e.key === 'Escape') box.remove(); else if(e.key === 'ArrowRight') go(1); else if(e.key === 'ArrowLeft') go(-1); };
    document.addEventListener('keydown', key);
    await draw();
  }

  async function mount(el, params){
    css();
    const embedded = !!(params && params.embedded);
    el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Content', title:'Starred' })) + '<div class="view" id="stHost"></div>';
    const host = el.querySelector('#stHost');
    let pick = 'all';
    async function render(){
      const { groups } = await load();
      const all = groups.flatMap(g => g.frames);
      const here = new Set(all.filter(f => f.it).map(f => f.uid)).size;
      if(!groups.length){
        host.innerHTML = `<div class="pagehead"><h1 class="page-title">Starred</h1></div>
          <div class="empty"><b>Nothing starred yet</b>On the laptop: Library → ★ Starred. Make groups for the shots you make every day — Walking, Car work, Transitions — and star frames into them. They show up here and stay.</div>`;
        return;
      }
      const g = groups.find(x => x.id === pick);
      const frames = g ? g.frames : all.filter((f, k, a) => a.findIndex(x => x.uid === f.uid) === k);
      host.innerHTML = `<div class="pagehead"><h1 class="page-title">Starred</h1><span class="count">${here}</span></div>
        <div class="st-pills">${[['all', 'All']].concat(groups.map(x => [x.id, '★ ' + x.name])).map(([id, l]) =>
          `<button data-g="${esc(id)}" aria-pressed="${pick === id}">${esc(l)}</button>`).join('')}</div>
        <p class="st-meta">${g ? plural(g.items.length, 'frame') : plural(here, 'frame') + ' in ' + plural(groups.length, 'group')} · tap one for full screen</p>
        <div class="st-grid">${await cellsHTML(frames, 'data-f')}</div>`;
    }
    host.addEventListener('click', async e => {
      const b = e.target.closest('[data-g]');
      if(b){ pick = b.dataset.g; return render(); }
      const f = e.target.closest('[data-f]');
      if(f){
        const { groups } = await load();
        const g = groups.find(x => x.id === pick);
        const frames = g ? g.frames : groups.flatMap(x => x.frames);
        return viewer(frames, f.dataset.f, g ? g.name : 'Starred');
      }
    });
    await render();
  }

  /* pick a starred frame — for a task's shot on the phone */
  async function open(o){
    o = o || {};
    css();
    const { groups } = await load();
    if(!groups.length) return U.toast('Nothing starred yet — star frames on the laptop (Library → ★ Starred)');
    let pick = groups[0].id;
    const body = async () => {
      const g = groups.find(x => x.id === pick);
      return `<h2 style="margin:0 0 10px">${esc(o.title || 'Pick a starred frame')}</h2>
        <div class="st-pills">${groups.map(x => `<button data-g="${esc(x.id)}" aria-pressed="${pick === x.id}">★ ${esc(x.name)}</button>`).join('')}</div>
        <div class="st-grid" style="max-height:58vh;overflow:auto">${await cellsHTML(g.frames.filter(f => f.it), 'data-pick')}</div>
        ${o.clear ? `<div class="sheetcta"><button class="btn-ghost" data-clearframe>No frame for this shot</button></div>` : ''}`;
    };
    App.sheet(await body(), sh => {
      sh.addEventListener('click', async e => {
        const b = e.target.closest('[data-g]');
        if(b){ pick = b.dataset.g; const html = await body(); sh.innerHTML = html; return; }
        const p = e.target.closest('[data-pick]');
        if(p){ App.closeSheet(); if(o.onPick) o.onPick(p.dataset.pick); return; }
        if(e.target.closest('[data-clearframe]')){ App.closeSheet(); if(o.onPick) o.onPick(''); }
      });
    });
  }

  Screens.register('starred', mount);
  global.StarPick = { open, viewer };
})(window);
