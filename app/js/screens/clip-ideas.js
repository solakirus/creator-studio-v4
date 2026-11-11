/* Clip ideas — pitch angles, let it suggest, keep the good ones, draft a clip.
   Reached from the top of Content → Clips. See js/clipideas.js. */
(function(){

  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  async function mount(el, params){
    const o = params || {};
    let channels = [], series = [], pitched = [], kept = [];
    let form = { channel: '', series: '', topic: '' };

    async function load(){
      channels = (await Channels.all()).filter(c => !/^new channel$/i.test(c.n));
      series = await Data.series();
      kept = await ClipIdeas.saved();
      if(!form.channel && channels[0]) form.channel = channels[0].n;
    }

    const card = (x, isKept) => `
      <article class="ci-card">
        <b>${esc(x.title)}</b>
        <small>${esc(x.channel)}${x.series ? ' · ' + esc(x.series) : ''}${x.specificity ? ` · specificity ${x.specificity}/10` : ''}</small>
        ${x.angle ? `<p>${esc(x.angle)}</p>` : ''}
        ${x.hook ? `<p class="ci-hook">Hook — ${esc(x.hook)}</p>` : ''}
        ${x.why ? `<p class="ci-why">${esc(x.why)}</p>` : ''}
        <div class="ci-acts">
          <button class="btn-sm accent" data-draft="${x.id}">Draft the clip</button>
          ${isKept ? `<button class="btn-sm" data-drop="${x.id}">Remove</button>`
                   : `<button class="btn-sm" data-keep="${x.id}">Keep</button>`}
        </div>
      </article>`;

    function render(){
      const chSeries = series.filter(s => (s.channel || '').toLowerCase() === form.channel.toLowerCase());
      el.innerHTML = Screens.bar({ kicker:'Clips', title:'Ideas' }) + `
      <div class="view">
        <p class="hintline" style="margin:0 0 14px">Angles that only your channel could make — built from the
          channel's about, audience and voice, what's already on it, and what's on your days for the next three weeks.</p>
        <div class="field"><label for="ci-ch">Channel</label>
          <select id="ci-ch" class="pgbar">${channels.map(c => `<option ${c.n === form.channel ? 'selected' : ''}>${esc(c.n)}</option>`).join('')}</select></div>
        <div class="field"><label for="ci-se">Series (optional)</label>
          <input id="ci-se" class="pgname" list="ci-sl" value="${esc(form.series)}" placeholder="Any, or a one-off" autocomplete="off">
          <datalist id="ci-sl">${chSeries.map(s => `<option value="${esc(s.title)}">`).join('')}</datalist></div>
        <div class="field"><label for="ci-tp">Your idea or topic (optional)</label>
          <textarea id="ci-tp" class="pgtext" rows="2" placeholder="e.g. putting up the tent in the backyard">${esc(form.topic)}</textarea></div>
        <div class="sheetcta" style="margin:0 0 20px">
          <button class="btn-primary" data-a="pitch">Pitch angles</button>
          <button class="btn-ghost" data-a="suggest">Suggest for me</button>
        </div>
        ${pitched.length ? `<div class="sec"><h2>Just pitched</h2><div class="rule"></div><span class="alt">${pitched.length}</span></div>
          ${pitched.map(x => card(x, false)).join('')}` : ''}
        <div class="sec"><h2>Kept</h2><div class="rule"></div><span class="alt">${kept.length}</span></div>
        ${kept.length ? kept.map(x => card(x, true)).join('') : '<p class="hintline">Keep an idea and it waits here until you draft it.</p>'}
      </div>`;
    }

    const pull = () => {
      const q = s => el.querySelector(s);
      if(q('#ci-ch')) form.channel = q('#ci-ch').value;
      if(q('#ci-se')) form.series = q('#ci-se').value.trim();
      if(q('#ci-tp')) form.topic = q('#ci-tp').value.trim();
    };
    const find = id => pitched.find(x => x.id === id) || kept.find(x => x.id === id);

    el.addEventListener('change', e => { if(e.target.id === 'ci-ch'){ pull(); form.series = ''; render(); } });
    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if(a && (a.dataset.a === 'pitch' || a.dataset.a === 'suggest')){
        pull();
        try {
          const got = await ClipIdeas.pitch(a.dataset.a === 'suggest' ? { suggest:true } : { ...form });
          if(!got) return;
          if(!got.length) return U.toast('Nothing specific enough came back — try a topic');
          pitched = got; render();
        } catch(err){ U.toast(err.message || 'Could not read that answer'); }
        return;
      }
      const k = e.target.closest('[data-keep]');
      if(k){ const x = find(k.dataset.keep); if(x){ await ClipIdeas.keep(x); pitched = pitched.filter(p => p !== x); kept = await ClipIdeas.saved(); render(); U.toast('Kept'); } return; }
      const d = e.target.closest('[data-drop]');
      if(d){ await ClipIdeas.drop(d.dataset.drop); kept = await ClipIdeas.saved(); return render(); }
      const dr = e.target.closest('[data-draft]');
      if(dr){
        const x = find(dr.dataset.draft); if(!x) return;
        try {
          const clip = await ClipIdeas.draftToClip(x);
          if(!clip) return;
          if(kept.some(y => y.id === x.id)) await ClipIdeas.drop(x.id);
          pitched = pitched.filter(p => p !== x); kept = await ClipIdeas.saved(); render();
          o.onChange && o.onChange();
          U.toast('Drafted — it is in Clips');
          Screens.push('clip', { id: clip.id });
        } catch(err){ U.toast(err.message || 'Could not read that answer'); }
      }
    });

    await load(); render();
  }

  Screens.register('clip-ideas', mount);
})();
