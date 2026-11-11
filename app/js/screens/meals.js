/* Saved Meals — grid, detail, and the editor. Meals are the base unit. */
(function(){
  const { ICON } = U;
  let photos = {};

  async function loadPhotos(){
    try {
      const blobs = await Store.allMap('meal-photo');
      Object.values(photos).forEach(URL.revokeObjectURL);
      photos = {};
      Object.entries(blobs).forEach(([k,b]) => photos[k] = URL.createObjectURL(b));
    } catch(e){ console.warn('Meal photos unavailable', e); }
  }
  /* An uploaded photo wins; then a thumbnail from wherever it was saved, which
     imageUrl has held all along and nothing ever read; then generated art. */
  const photoFor = m =>
    photos[m.id] ? `url(${photos[m.id]})`
    : m.imageUrl ? `url("${String(m.imageUrl).replace(/"/g, '%22')}")`
    : U.generatedArt(m.id, m.title, 360, 250);

  /* ---------- list ---------- */
  async function mountList(el){
    let cat = 'All', sort = 'new', root = el;

    async function render(){
      const all = await Nutrition.meals();
      const cats = ['All', ...new Set(all.map(m => m.category).filter(Boolean))];
      const tags = [...new Set(all.flatMap(m => m.tags || []))];
      let rows = all.filter(m => cat === 'All' || m.category === cat || (m.tags || []).includes(cat));
      rows.sort((a,b) => sort === 'new' ? b.createdAt - a.createdAt : a.title.localeCompare(b.title));

      root.innerHTML = Screens.bar({ kicker:'Nutrition', title:'Saved meals',
        actions:`<button class="btn-sm accent" data-a="new">+ Save meal</button>` }) + `
      <div class="view">
        <div class="chiplist">
          ${[...cats, ...tags].map(c =>
            `<button class="cpill" data-cat="${c}" aria-pressed="${cat===c}">${c}</button>`).join('')}
        </div>
        <div class="chiplist"><button class="cpill" data-a="sort">${sort === 'new' ? '↓ Newest first' : '↓ A–Z'}</button></div>
        ${rows.length ? `<div class="mealgrid">${rows.map(m => `
          <button class="mealcard" data-open="${m.id}">
            <span class="ph" style="background-image:${photoFor(m)}"></span>
            <span class="tx">
              <h3>${m.title}</h3>
              <span class="tagline">
                ${m.category ? `<span class="tg">${m.category}</span>` : ''}
                <span class="tg count">${(m.ingredients||[]).length} ingredients</span>
              </span>
              ${m.source ? `<p class="srcline">${m.source}</p>` : ''}
            </span>
          </button>`).join('')}</div>`
        : `<div class="empty"><b>No meals yet</b>Save one and it becomes available to the planner.</div>`}
      </div>`;
    }

    el.addEventListener('click', async e => {
      const c = e.target.closest('[data-cat]');
      if(c){ cat = c.dataset.cat; return render(); }
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'sort'){ sort = sort === 'new' ? 'az' : 'new'; return render(); }
      if(a && a.dataset.a === 'new') return openEditor(null, render);
      const o = e.target.closest('[data-open]');
      if(o) Screens.push('meal', { id:o.dataset.open, onChange:render });
    });

    await loadPhotos();
    render();
  }

  /* ---------- detail ---------- */
  async function mountDetail(el, params){
    let meal;
    async function render(){
      const all = await Nutrition.meals();
      meal = all.find(m => m.id === params.id);
      if(!meal){ Screens.pop(); return; }

      el.innerHTML = Screens.bar({ kicker:'Saved meals', title:meal.title,
        actions:`<button class="btn-sm" data-a="edit">Edit</button>` }) + `
      <div class="view">
        <div class="mealhero" style="background-image:${photoFor(meal)}"></div>
        <div class="metaline">
          ${meal.category ? `<span class="tg">${meal.category}</span>` : ''}
          <span class="tg count">${(meal.ingredients||[]).length} ingredients</span>
          <span class="tg count">${(meal.steps||[]).length} steps</span>
          ${meal.source && !meal.url ? `<span class="srcbtn">↗ ${meal.source}</span>` : ''}
        </div>

        ${meal.url ? `
          <!-- The video you saved it from. Worth a real row rather than a tag:
               halfway through cooking, "what did they do next" is the question
               you actually have, and it is the only thing that answers it. -->
          <a class="noterow" href="${meal.url}" target="_blank" rel="noopener">
            <span class="dot" style="background:var(--orange)"></span>
            <span class="t"><b>Watch it again</b>
              <small>${meal.source || meal.url.replace(/^https?:\/\//, '').slice(0, 44)}</small></span>
            ${U.ICON.chevR}
          </a>` : ''}

        ${meal.note ? `<p class="hintline" style="margin:10px 0 0">${meal.note}</p>` : ''}
        <div class="metaline">
          <button class="btn-sm" data-a="photo">Change photo</button>
          ${photos[meal.id] ? `<button class="btn-sm" data-a="rmphoto">Remove</button>` : ''}
          ${meal.url && window.Thumb && !photos[meal.id]
            ? `<button class="btn-sm" data-a="grab">Use the video's thumbnail</button>` : ''}
        </div>
        <div class="block">
          <h4>Ingredients</h4>
          ${(meal.ingredients||[]).length
            ? (meal.ingredients||[]).map(i =>
                `<div class="ingrow"><span>${i.n}</span><span class="q">${i.q || ''} ${i.u || ''}</span></div>`).join('')
            : `<p style="color:var(--muted);margin:0">None listed.</p>`}
        </div>
        <div class="block">
          <h4>Directions</h4>
          ${(meal.steps||[]).length
            ? `<ol class="steplist">${meal.steps.map(s => `<li>${s}</li>`).join('')}</ol>`
            : `<p style="color:var(--muted);margin:0">No steps listed.</p>`}
        </div>
      </div>`;
    }

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]'); if(!a) return;
      if(a.dataset.a === 'edit') return openEditor(meal, async () => { await render(); params.onChange && params.onChange(); });
      if(a.dataset.a === 'grab'){
        U.toast('Looking…');
        const got = await Thumb.attach(meal, 'meal-photo');
        if(!got){
          /* say which platform rather than a generic failure — it is the
             difference between "try again" and "this will never work" */
          return U.toast(Thumb.isTikTok(meal.url)
            ? 'TikTok did not answer — try again later'
            : 'No thumbnail available from that link');
        }
        meal.imageUrl = got.imageUrl;
        await Nutrition.save('meals', meal);
        /* a downloaded thumbnail lands in the same store as an uploaded photo,
           so the cache of object urls has to be rebuilt before drawing */
        await loadPhotos();
        await render();
        return U.toast(got.stored ? 'Saved the thumbnail' : 'Using the thumbnail');
      }

      if(a.dataset.a === 'photo'){
        App.pickImage(async file => {
          await Store.put('meal-photo', file, meal.id);
          await loadPhotos(); render(); params.onChange && params.onChange();
        });
      }
      if(a.dataset.a === 'rmphoto'){
        await Store.del('meal-photo', meal.id);
        await loadPhotos(); render(); params.onChange && params.onChange();
      }
    });

    await loadPhotos();
    render();
  }

  /* ---------- editor ---------- */
  function openEditor(meal, after){
    const m = meal || { title:'', category:'Entrees', source:'', url:'', tags:[], ingredients:[], steps:[] };
    const ingText = (m.ingredients || []).map(i => `${i.q || ''}${i.u ? ' ' + i.u : ''} ${i.n}`.trim()).join('\n');
    const stepText = (m.steps || []).join('\n');

    App.sheet(`
      <h2>${meal ? 'Edit meal' : 'New meal'}</h2>
      <div class="field"><label for="m-title">Title</label>
        <input id="m-title" type="text" value="${m.title.replace(/"/g,'&quot;')}" placeholder="Chicken & Rice Bowl">
        <p class="err" id="m-err" hidden>Give the meal a title first.</p></div>
      <div class="field"><label>Category</label><div class="opts" data-group="cat">
        ${Nutrition.CATS.map(c => `<button type="button" class="opt" data-v="${c}" aria-pressed="${m.category===c}">${c}</button>`).join('')}
      </div></div>
      <div class="field"><label for="m-ing">Ingredients <span style="text-transform:none;letter-spacing:0;font-weight:400">(one per line — "300 g chicken breast")</span></label>
        <textarea id="m-ing" rows="5" placeholder="300 g chicken breast&#10;1 cup jasmine rice">${ingText}</textarea></div>
      <div class="field"><label for="m-steps">Directions <span style="text-transform:none;letter-spacing:0;font-weight:400">(one per line)</span></label>
        <textarea id="m-steps" rows="5">${stepText}</textarea></div>
      <div class="field"><label for="m-src">Source <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
        <input id="m-src" type="text" value="${(m.source||'').replace(/"/g,'&quot;')}" placeholder="wholefully.com"></div>
      <div class="field"><label for="m-url">Link <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
        <input id="m-url" type="url" value="${(m.url||'').replace(/"/g,'&quot;')}"
          placeholder="https://" inputmode="url"></div>
      <div class="sheetcta">
        <button class="btn-primary" data-save>${meal ? 'Save' : 'Save meal'}</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>
      ${meal ? `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete meal</button>` : ''}
    `, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        const opt = e.target.closest('.opt');
        if(opt){
          opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
          opt.setAttribute('aria-pressed','true'); return;
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(e.target.closest('[data-delete]')){
          await Nutrition.remove('meals', meal.id);
          await Store.del('meal-photo', meal.id);
          App.closeSheet(); U.toast('Meal deleted');
          Screens.pop(); after && after(); return;
        }
        if(!e.target.closest('[data-save]')) return;

        const title = sheetEl.querySelector('#m-title').value.trim();
        if(!title){ sheetEl.querySelector('#m-err').hidden = false; return; }

        /* "300 g chicken breast" -> { q:300, u:'g', n:'chicken breast' } */
        const ingredients = sheetEl.querySelector('#m-ing').value.split('\n')
          .map(l => l.trim()).filter(Boolean).map(line => {
            const mt = line.match(/^([\d.\/]+)\s*([a-zA-Z]+)?\s+(.*)$/);
            if(!mt) return { n:line, q:null, u:'' };
            const q = mt[1].includes('/')
              ? mt[1].split('/').reduce((a,b) => a / b)
              : parseFloat(mt[1]);
            return { q, u:mt[2] || '', n:mt[3] };
          });

        await Nutrition.save('meals', {
          ...(meal || {}), title,
          category: sheetEl.querySelector('[data-group="cat"] .opt[aria-pressed="true"]').dataset.v,
          source: sheetEl.querySelector('#m-src').value.trim(),
          url: sheetEl.querySelector('#m-url').value.trim(),
          ingredients,
          steps: sheetEl.querySelector('#m-steps').value.split('\n').map(s => s.trim()).filter(Boolean)
        }, 'm');

        App.closeSheet();
        after && after();
      });
      setTimeout(() => { const f = sheetEl.querySelector('#m-title'); if(f) f.focus(); }, 180);
    });
  }

  Screens.register('meals', mountList);
  Screens.register('meal', mountDetail);
})();
