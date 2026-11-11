/* Your rating — and the rule picker both it and achievements use.

   A rule is never typed as code. You pick something the app measures, then a
   threshold. That keeps every rule answerable from history, which is what makes
   a rule you add today unlock against what you did last month. */
(function(){

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  /* ---------- the shared rule sheet ---------- */

  function openRule(rule, opts, onDone){
    const o = opts || {};
    const r = { metric:'perfectBest', value:10, points:10, reps:4, lift:'', mins:60,
                match:'', window:0, ...(rule || {}) };
    const WINDOWS = [[0,'All time'],[1,'Today'],[7,'A week'],[30,'A month'],[90,'90 days']];
    const groups = [...new Set(Metrics.METRICS.map(m => m.group))];

    function body(){
      const m = Metrics.byKey[r.metric] || {};
      return `
        <h3 class="pgh" style="margin-top:4px">What counts?</h3>
        <select id="ru-m" class="pgbar">
          ${groups.map(g => `<optgroup label="${g}">${
            Metrics.METRICS.filter(x => x.group === g).map(x =>
              `<option value="${x.key}" ${x.key === r.metric ? 'selected' : ''}>${x.label}</option>`).join('')
          }</optgroup>`).join('')}
        </select>

        ${m.needsLift ? `
          <h3 class="pgh">Which lift?</h3>
          <input id="ru-lift" class="pgname" type="text" value="${esc(r.lift)}"
            placeholder="Bench press" autocomplete="off">
          <h3 class="pgh">For how many reps?</h3>
          <input id="ru-reps" class="pgbar" type="number" min="1" value="${r.reps || 4}">` : ''}

        ${m.needsMatch ? `
          <h3 class="pgh">Which task?</h3>
          <input id="ru-match" class="pgname" type="text" value="${esc(r.match)}"
            placeholder="Cold call" autocomplete="off">
          <p class="hintline">Any task whose name contains this counts — so a task or
            plan you make later is scored without changing anything here.</p>` : ''}

        ${m.needsMins ? `
          <h3 class="pgh">Inside how many minutes?</h3>
          <input id="ru-mins" class="pgbar" type="number" min="1" value="${r.mins || 60}">` : ''}

        ${m.windowed ? `
          <h3 class="pgh">Over what period?</h3>
          <select id="ru-w" class="pgbar">${WINDOWS.map(([v, l]) =>
            `<option value="${v}" ${+r.window === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}

        <h3 class="pgh">${m.lowerIsBetter ? 'Under what?' : 'How much?'}</h3>
        <div class="pgstep">
          <button type="button" class="bump" data-step="-1">&minus;</button>
          <span class="val"><b id="ru-v">${r.value}</b>${m.unit ? `<i>${m.unit}</i>` : ''}</span>
          <button type="button" class="bump" data-step="1">+</button>
        </div>

        ${o.points ? `
          <h3 class="pgh">Worth how many points?</h3>
          <div class="pgstep">
            <button type="button" class="bump" data-pts="-1">&minus;</button>
            <span class="val"><b id="ru-p">${r.points}</b><i>points</i></span>
            <button type="button" class="bump" data-pts="1">+</button>
          </div>

          <h3 class="pgh">More for going further?</h3>
          <div class="pgseg" data-group="scale">
            <button type="button" data-scale="off" aria-pressed="${!r.scale}">
              <b>Flat</b><small>same either way</small></button>
            <button type="button" data-scale="on" aria-pressed="${!!r.scale}">
              <b>Scaled</b><small>more the further past</small></button>
          </div>
          ${r.scale ? `
            <div style="display:flex;gap:10px;margin:10px 0 0">
              <span style="flex:1"><label class="hintline" style="margin:0 0 5px;display:block">Every</label>
                <input id="ru-per" class="pgbar" type="number" min="1" value="${r.scale.per || 5}"></span>
              <span style="flex:1"><label class="hintline" style="margin:0 0 5px;display:block">adds</label>
                <input id="ru-sp" class="pgbar" type="number" min="1" value="${r.scale.points || 1}"></span>
              <span style="flex:1"><label class="hintline" style="margin:0 0 5px;display:block">up to</label>
                <input id="ru-smax" class="pgbar" type="number" min="1" value="${r.scale.max || 15}"></span>
            </div>` : ''}` : ''}

        <p class="hintline" id="ru-read"></p>`;
    }

    App.sheet(`
      <h2 style="margin:0 0 4px">${rule ? 'Edit the rule' : 'Add a rule'}</h2>
      <div id="ru-body">${body()}</div>
      <div class="sheetcta">
        <button class="btn-primary" data-save>${rule ? 'Save' : 'Add it'}</button>
        ${rule ? '<button class="btn-ghost" data-del style="color:var(--red)">Remove</button>' : ''}
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheet => {

      const $ = q => sheet.querySelector(q);
      let snap = null;
      Metrics.snapshot().then(s => { snap = s; readback(); }).catch(() => {});

      function pull(){
        r.value = +($('#ru-v') || {}).textContent || 0;
        if($('#ru-p')) r.points = +$('#ru-p').textContent || 0;
        if($('#ru-lift')) r.lift = $('#ru-lift').value.trim();
        if($('#ru-reps')) r.reps = +$('#ru-reps').value || 1;
        if($('#ru-match')) r.match = $('#ru-match').value.trim();
        if($('#ru-mins')) r.mins = +$('#ru-mins').value || 60;
        if($('#ru-w')) r.window = +$('#ru-w').value || 0;
        if(r.scale && $('#ru-per')){
          r.scale = { per:+$('#ru-per').value || 1, points:+$('#ru-sp').value || 1,
                      max:+$('#ru-smax').value || 10 };
        }
      }
      function readback(){
        if(!$('#ru-read')) return;
        pull();
        const now = snap ? Metrics.valueOf(snap, r) : null;
        const ok = snap ? Metrics.met(snap, r) : false;
        const extra = snap && o.points ? Metrics.bonus(snap, r) : 0;
        $('#ru-read').innerHTML = Metrics.describe(r) +
          (snap ? ` — you are at <b style="color:${ok ? 'var(--green)' : 'var(--orange)'}">${now}</b>${
            ok ? ', already met' : ''}${extra ? `, worth +${(+r.points || 0) + extra}` : ''}` : '');
      }
      function redraw(){ pull(); $('#ru-body').innerHTML = body(); readback(); }

      sheet.addEventListener('change', e => {
        if(e.target.id === 'ru-m'){ r.metric = e.target.value; return redraw(); }
        readback();
      });

      sheet.addEventListener('click', e => {
        const sc = e.target.closest('[data-scale]');
        if(sc){
          pull();
          r.scale = sc.dataset.scale === 'on' ? (r.scale || { per:5, points:1, max:15 }) : null;
          return redraw();
        }
        const step = e.target.closest('[data-step]');
        if(step){
          pull();
          const m = Metrics.byKey[r.metric] || {};
          const inc = m.unit === 'kg' ? 5 : m.unit === 'km' ? 1 : 1;
          $('#ru-v').textContent = Math.max(0,
            Math.round((r.value + inc * +step.dataset.step) * 10) / 10);
          return readback();
        }
        const pts = e.target.closest('[data-pts]');
        if(pts){
          pull();
          $('#ru-p').textContent = Math.max(0, Math.min(40, r.points + +pts.dataset.pts));
          return readback();
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(e.target.closest('[data-del]')){ App.closeSheet(); return onDone(null); }
        if(!e.target.closest('[data-save]')) return;
        pull();
        App.closeSheet();
        onDone(r);
      });
    });
  }

  /* ---------- the rating screen ---------- */

  async function mountRating(el){
    async function render(){
      const st = await Rating.state();
      const d1 = await Rating.day1();
      const art = await SectionArt.map(['rating']);

      let lv = null;
      try { lv = await Levels.state(); } catch(e){ lv = null; }

      /* The hero: your own artwork behind it, the profile read across it. Tap the
         pencil to change the picture — the same mechanism the Academy header uses. */
      const hero = SectionArt.banner('rating', {
        url: art.rating, dark:true, tint:'#2A2A33', ratio:'4/5',
        children: `
          <p class="rt-kick">Player's analysis · Day ${st.day || ''}</p>
          <h2 class="rt-class">${st.headline}</h2>
          <p class="rt-blurb">${st.blurb}</p>
          <p class="rt-cap">Class profile</p>
          <div class="rt-tiles">${st.rows.slice(0, 5).map(r => `
            <span class="rt-tile" data-id="${r.id}">
              <i style="color:${r.c}">${Rating.glyph(r.glyph)}</i>
              <b>${r.score}</b>
              <small>${r.name}</small>
            </span>`).join('')}</div>
          <button class="rt-deep" data-a="all">All attributes &rarr;</button>` });

      el.innerHTML = Screens.bar({ title:'Your Rating',
        actions:`<button class="btn-sm" data-a="reset">Reset</button>` }) + `
        <div class="view">
          ${hero}

          ${lv ? `<div class="rtlevel">
            <span class="lv"><b>${lv.level}</b><i>Level</i></span>
            <div class="rtl-body">
              <p class="xp"><b>${lv.points}</b><span>XP earned</span></p>
              <div class="rtl-bar">${Array.from({ length:24 }, (_, i) =>
                `<span class="${i < Math.round(lv.pct / 100 * 24) ? 'on' : ''}"></span>`).join('')}</div>
              <p class="to">${lv.toNext} XP to Lvl ${lv.level + 1}</p>
            </div>
          </div>` : ''}

          <div class="sechead"><h2>Attributes</h2>
            <span class="link">${st.total} points${d1 ? ` · since ${
              new Date(d1.at).toLocaleDateString(undefined, { month:'short', day:'numeric' })}` : ''}</span></div>

          ${st.rows.map(r => `
            <button class="rtrow" data-id="${r.id}">
              <span class="ic" style="color:${r.c}">${Rating.glyph(r.glyph)}</span>
              <span class="nm">${r.name}<small>${
                r.of ? `${r.met}/${r.of} rules met · starts at ${r.base}`
                     : `No rules yet · starts at ${r.base}`}</small></span>
              <span class="tr ${r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''}">${
                r.delta > 0 ? '▲' : r.delta < 0 ? '▼' : '—'}</span>
              <span class="sc">${r.score}</span>
            </button>`).join('')}

          <button class="btn-ghost" data-a="add" style="width:100%;margin:16px 0 0">
            Add an attribute</button>
        </div>`;
    }

    el.addEventListener('click', async e => {
      if(await SectionArt.handle(e, render)) return;
      if(e.target.closest('[data-a="all"]')) return;
      if(e.target.closest('[data-a="baseline"]')){
        const d = await Rating.day1();
        return U.toast(d ? 'First reading taken ' +
          new Date(d.at).toLocaleDateString(undefined, { month:'long', day:'numeric' })
          : 'No baseline yet');
      }
      if(e.target.closest('[data-a="reset"]')){
        await Rating.reset();
        U.toast('Baseline reset to today');
        return render();
      }
      if(e.target.closest('[data-a="add"]')){
        await Rating.ensure();
        const a = await Rating.save({ name:'New attribute', c:'#FB6900', rules:[], order:99 });
        return Screens.push('rating-edit', { id:a.id, onChange:render });
      }
      const row = e.target.closest('[data-id]');
      if(row){
        await Rating.ensure();
        Screens.push('rating-edit', { id:row.dataset.id, onChange:render });
      }
    });

    await Rating.ensure();
    render();
  }

  /* ---------- one attribute ---------- */

  async function mountAttr(el, params){
    const all = await Rating.attributes();
    const a = { rules:[], ...all.find(x => x.id === params.id) };
    if(!a.id) return Screens.pop();

    const COLOURS = ['#E2564A','#5BBE6A','#FB6900','#22C7B8','#A855F7','#E8A33D'];

    async function render(){
      const snap = await Metrics.snapshot();
      const scored = Rating.scoreOne(a, snap);

      el.innerHTML = Screens.bar({ kicker:'Rating', title:a.name || 'Attribute',
        actions:`<button class="btn-sm accent" data-a="save">Save</button>` }) + `
        <div class="view">
          <h3 class="pgh" style="margin-top:12px">Name</h3>
          <input id="at-n" class="pgname" type="text" value="${esc(a.name)}"
            placeholder="Consistency" autocomplete="off">

          <h3 class="pgh">Starts at</h3>
          <div class="pgstep">
            <button type="button" class="bump" data-base="-1">&minus;</button>
            <span class="val"><b id="at-b">${scored.base}</b><i>before anything earned</i></span>
            <button type="button" class="bump" data-base="1">+</button>
          </div>
          <p class="hintline">Set this to where you honestly are today. Points from rules
            stack on top, so ${scored.base} + ${scored.points} = ${scored.score}.</p>

          <h3 class="pgh">Icon</h3>
          <div class="glyphs">${Object.keys(Rating.GLYPHS).map(g =>
            `<button type="button" class="gbtn" data-glyph="${g}"
              aria-pressed="${(a.glyph || 'target') === g}">${Rating.glyph(g)}</button>`).join('')}</div>

          <h3 class="pgh">Colour</h3>
          <div class="cwcols">${COLOURS.map(c =>
            `<button type="button" data-col="${c}" aria-pressed="${a.c === c}"
              style="background:${c}"></button>`).join('')}</div>

          <h3 class="pgh">What raises it</h3>
          ${scored.rules.length ? scored.rules.map((r, i) => `
            <button class="rtrule${r.met ? ' met' : ''}" data-rule="${i}">
              <span class="t">${Metrics.describe(r)}<small>now at ${r.now}${
                r.met ? ' · met' : ''}</small></span>
              <span class="p">+${r.points}</span>
            </button>`).join('')
            : `<div class="empty"><b>No rules yet</b>
                 Add one and this attribute starts scoring from what you have already done.</div>`}
          <button class="btn-ghost" data-a="addrule" style="width:100%;margin:10px 0 0">
            Add a rule</button>

          <p class="hintline">${scored.met} of ${scored.rules.length} rules met, worth
            ${scored.points} on top of ${scored.base}.</p>

          <button class="btn-ghost" data-a="del"
            style="width:100%;margin:22px 0 0;color:var(--red);border-color:rgba(226,86,74,.45)">
            Delete this attribute</button>
        </div>`;
    }

    function pull(){
      const n = el.querySelector('#at-n');
      if(n) a.name = n.value.trim() || 'Attribute';
      const b = el.querySelector('#at-b');
      if(b) a.base = +b.textContent || 0;
    }

    el.addEventListener('click', async e => {
      const bump = e.target.closest('[data-base]');
      if(bump){
        pull();
        a.base = Math.max(0, Math.min(Rating.CEILING, (a.base ?? Rating.BASE) + +bump.dataset.base));
        return render();
      }
      const gl = e.target.closest('[data-glyph]');
      if(gl){ pull(); a.glyph = gl.dataset.glyph; return render(); }

      const col = e.target.closest('[data-col]');
      if(col){ pull(); a.c = col.dataset.col; return render(); }

      const rule = e.target.closest('[data-rule]');
      if(rule){
        pull();
        const i = +rule.dataset.rule;
        return openRule(a.rules[i], { points:true }, async out => {
          if(out === null) a.rules.splice(i, 1); else a.rules[i] = out;
          await Rating.save(a);
          params.onChange && params.onChange();
          render();
        });
      }

      const act = e.target.closest('[data-a]');
      if(!act) return;

      if(act.dataset.a === 'addrule'){
        pull();
        return openRule(null, { points:true }, async out => {
          if(!out) return;
          a.rules.push(out);
          await Rating.save(a);
          params.onChange && params.onChange();
          render();
        });
      }
      if(act.dataset.a === 'save'){
        pull();
        await Rating.save(a);
        params.onChange && params.onChange();
        return Screens.pop();
      }
      if(act.dataset.a === 'del'){
        await Rating.remove(a.id);
        params.onChange && params.onChange();
        return Screens.pop();
      }
    });

    render();
  }

  window.RuleSheet = { open: openRule };
  Screens.register('rating', mountRating);
  Screens.register('rating-edit', mountAttr);
})();
