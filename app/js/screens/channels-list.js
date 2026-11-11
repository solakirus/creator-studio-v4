/* Every channel, as a way into each one.

   The channel pages existed but were only reachable by tapping a name you
   happened to be looking at — from Settings, a clip badge, a series card. If
   you just wanted to see what your channels are, there was nowhere to go.

   This is that place: what each one is for, what is on it, and how much of it
   you have actually made. */
(function(){
  const { ICON } = U;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  async function mount(el, params){
    const embedded = !!(params && params.embedded);
    let chans = [], series = [], clips = [], swipes = [];

    async function load(){
      try { chans = await Channels.all(); } catch(e){ chans = []; }
      try { series = await Data.series(); } catch(e){ series = []; }
      try { clips = await Data.clips(); } catch(e){ clips = []; }
      try {
        const { values } = await Store.all('swipes');
        swipes = values;
      } catch(e){ swipes = []; }
    }

    function render(){
      const rows = chans.map(c => {
        const mine = clips.filter(x => x.channel === c.n);
        return {
          c,
          series: series.filter(s => s.channel === c.n).length,
          clips: mine.length,
          live: mine.filter(x => (x.stage || 'idea') === 'published').length,
          refs: swipes.filter(s => (s.channels || []).includes(c.n)).length,
          /* whether the standard is set is the useful thing to see at a glance */
          bar: swipes.some(s => s.barFor === c.n)
        };
      });

      el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Creator studio', title:'Channels' })) + `
        <div class="view">
          ${embedded ? `<div class="pagehead"><h1 class="page-title">Channels</h1></div>` : ''}
          <p class="hintline" style="margin:0 0 14px">What each one is for, and what is on it.</p>

          ${rows.length ? rows.map(r => `
            <button class="chanrow" data-chan="${esc(r.c.n)}">
              <span class="cr-dot" style="background:${r.c.c}"></span>
              <span class="cr-t">
                <b>${esc(r.c.n)}</b>
                <small>${r.c.about ? esc(r.c.about) : 'No description yet'}</small>
                <span class="cr-n">${r.series} series · ${r.clips} clip${
                  r.clips === 1 ? '' : 's'} · ${r.live} published${
                  r.refs ? ` · ${r.refs} saved` : ''}</span>
              </span>
              ${r.bar ? '<span class="cr-bar">BAR SET</span>' : ''}
              ${ICON.chevR}
            </button>`).join('')
            : `<div class="empty"><b>No channels yet</b>
                Add them in Settings and they show here.</div>`}
        </div>`;
    }

    el.addEventListener('click', e => {
      const c = e.target.closest('[data-chan]');
      if(!c) return;
      Screens.push('channel', { name:c.dataset.chan,
        onChange:async () => { await load(); render(); } });
    });

    await load();
    render();
  }

  Screens.register('channels-list', mount);
})();
