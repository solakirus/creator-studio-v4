/* Compare — two days, side by side.

   The log is the input; this is the output. Scrolling a list hides the change,
   which is exactly why people stop at week three. Day one against today, front
   against front, is where it becomes obvious. */
(function(){

  async function mount(el, params){
    const embedded = !!(params && params.embedded);
    let list = [], urls = {}, unit = 'kg';
    let aId = null, bId = null, picking = null;   /* 'a' or 'b' while choosing */

    const disp = kg => kg == null ? null : Math.round(Units.toDisplay(kg, unit) * 10) / 10;
    const shotUrl = (e, pose) => urls[Physique.photoKey(e.id, pose)];

    async function load(){
      list = (await Physique.all()).slice().sort((a, b) => a.at - b.at);
      try { unit = await Units.get(); } catch(e){ unit = 'kg'; }

      Object.values(urls).forEach(URL.revokeObjectURL);
      urls = {};
      const blobs = await Physique.photos();
      list.forEach(e => {
        const mine = Physique.posesOf(e, blobs);
        Object.entries(mine).forEach(([pose, b]) =>
          urls[Physique.photoKey(e.id, pose)] = URL.createObjectURL(b));
      });

      /* the comparison you want nine times in ten: the first and the latest */
      const withShots = list.filter(e => Physique.POSES.some(p => shotUrl(e, p.k)));
      const pool = withShots.length >= 2 ? withShots : list;
      if(!aId || !pool.some(e => e.id === aId)) aId = pool.length ? pool[0].id : null;
      if(!bId || !pool.some(e => e.id === bId)) bId = pool.length ? pool[pool.length - 1].id : null;
    }

    const entry = id => list.find(e => e.id === id) || null;
    const when = e => new Date(e.at).toLocaleDateString(undefined,
      { day:'numeric', month:'short', year:'numeric' });

    function side(e, label){
      if(!e) return `<div class="cmpside"><p class="cap">${label}</p>
        <div class="empty" style="margin:0"><b>Nothing to show</b>Log a day first.</div></div>`;
      return `
        <div class="cmpside">
          <button class="cap" data-pick="${label === 'Before' ? 'a' : 'b'}">
            ${label}<small>${when(e)} ${U.ICON.chevD}</small></button>
          <div class="cmpshots">
            ${Physique.POSES.map(p => shotUrl(e, p.k)
              ? `<span style="background-image:url(${shotUrl(e, p.k)})"></span>`
              : `<span class="miss">${p.label}</span>`).join('')}
          </div>
          <p class="cmpkg">${e.kg != null ? disp(e.kg) + ' ' + unit : '—'}</p>
        </div>`;
    }

    function render(){
      const a = entry(aId), b = entry(bId);
      const c = a && b ? Physique.compare(a, b) : null;

      el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Physique', title:'Compare' })) + `
        <div class="view">
          <div class="pagehead"><h1 class="page-title">Compare</h1>
            ${c ? `<span class="headacts" style="display:flex;gap:8px;align-items:center">
              <button class="headbtn" data-a="export">EXPORT</button>
            </span>` : ''}</div>

          ${list.length < 2
            ? `<div class="empty"><b>Two days needed</b>
                Log another day and this shows you what changed between them.</div>`
            : `
              ${c ? `<div class="cmphead">
                <b>${c.days} day${c.days === 1 ? '' : 's'}</b>
                ${c.kg != null ? `<span class="${c.kg < 0 ? 'down' : c.kg > 0 ? 'up' : ''}">${
                  c.kg > 0 ? '+' : ''}${disp(c.kg)} ${unit}</span>` : '<span class="none">no weights</span>'}
                ${c.perWeek != null ? `<small>${c.perWeek > 0 ? '+' : ''}${
                  disp(c.perWeek)} ${unit} a week</small>` : ''}
              </div>` : ''}

              <div class="cmppair">${side(a, 'Before')}${side(b, 'After')}</div>

              ${picking ? `<div class="sec"><h2>Pick a day</h2><div class="rule"></div>
                  <span class="alt">${list.length}</span></div>
                <div class="cmplist">${list.slice().reverse().map(e => `
                  <button class="noterow" data-use="${e.id}">
                    ${Physique.POSES.map(p => shotUrl(e, p.k)).find(Boolean)
                      ? `<span class="thumb" style="background-image:url(${
                          Physique.POSES.map(p => shotUrl(e, p.k)).find(Boolean)})"></span>`
                      : '<span class="dot" style="background:var(--dim)"></span>'}
                    <span class="t"><b>${when(e)}</b>
                      <small>${e.kg != null ? disp(e.kg) + ' ' + unit : 'no weight'} · ${
                        Physique.POSES.filter(p => shotUrl(e, p.k)).length} of 4 angles</small></span>
                  </button>`).join('')}</div>` : ''}
            `}
        </div>`;
    }

    el.addEventListener('click', async e => {
      const pick = e.target.closest('[data-pick]');
      if(pick){ picking = picking === pick.dataset.pick ? null : pick.dataset.pick; return render(); }

      const use = e.target.closest('[data-use]');
      if(use){
        if(picking === 'a') aId = use.dataset.use;
        else if(picking === 'b') bId = use.dataset.use;
        picking = null;
        return render();
      }

      if(e.target.closest('[data-a="export"]')){
        const a = entry(aId), b = entry(bId);
        if(!a || !b) return;
        U.toast('Building it — photos take a moment');
        const html = await Physique.card(a, b, { unit });
        const days = Physique.compare(a, b).days;
        return Transfer.download(`physique-${days}-days.html`, html, 'text/html');
      }
    });

    await load();
    render();
  }

  Screens.register('physique-compare', mount);
})();
