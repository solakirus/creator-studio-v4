/* Research — the library of quotes, studies, experiments and examples.

   It is the same `sources` store the quarter and the episode page already use,
   so anything logged there is here too; this adds the research view of it:
   which script segment an item is for, whether it has been checked, and
   whether it has made it into an episode.

     type    → `kind`      (Book, Quote, Study, Experiment, History, Pop culture —
                            and the older Article, Video, Podcast still read fine)
     item    → `passage`   (the quote, the finding, the example itself)
     source  → `work` / `author` / `url`
     useIn   → `useIn`     (intro | history | wisdom | science | backToMe), optional
     episode → `vlogId`    (null = unassigned)
     status  → `status`    (idea | verified | used), missing reads as idea */
(function(global){

  const TYPES = [
    { k:'book',       label:'Book' },
    { k:'quote',      label:'Quote' },
    { k:'study',      label:'Study' },
    { k:'experiment', label:'Experiment' },
    { k:'history',    label:'History' },
    { k:'popculture', label:'Pop culture' }
  ];
  const OLDER = [{ k:'article', label:'Article' }, { k:'video', label:'Video' }, { k:'podcast', label:'Podcast' }];
  const typeLabel = k => ([...TYPES, ...OLDER].find(t => t.k === k) || { label:'Note' }).label;

  const USE_IN = [
    { k:'intro',    label:'Intro' },
    { k:'history',  label:'History' },
    { k:'wisdom',   label:'Wisdom' },
    { k:'science',  label:'Science' },
    { k:'backToMe', label:'Back to me' }
  ];
  const useLabel = k => (USE_IN.find(u => u.k === k) || { label:'Not placed' }).label;

  const STATUS = [
    { k:'idea',     label:'Idea',     c:'var(--muted)' },
    { k:'verified', label:'Verified', c:'#F59E0B' },
    { k:'used',     label:'Used',     c:'var(--green)' }
  ];
  const statusOf = r => STATUS.find(s => s.k === (r && r.status)) || STATUS[0];

  const esc = t => String(t == null ? '' : t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const isUrl = t => /^https?:\/\/\S+$/i.test(String(t || '').trim());

  async function all(){
    try {
      const { values } = await Store.all('sources');
      return values.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    } catch(e){ return []; }
  }
  const forEpisode = async id => (await all()).filter(r => r.vlogId === id);
  const unassigned = async () => (await all()).filter(r => !r.vlogId);

  /* Saved through the quarter's own writer, so the record keeps the shape the
     rest of the app expects. */
  async function save(rec){
    const r = { ...rec };
    r.status = statusOf(r).k;
    if(r.useIn && !USE_IN.some(u => u.k === r.useIn)) r.useIn = null;
    return Quarters.saveSource(r);
  }
  const remove = id => Quarters.removeSource(id);

  /* one line saying where it came from */
  function sourceLine(r){
    const bits = [];
    if(r.author) bits.push(r.author);
    if(r.work) bits.push(r.work);
    if(r.year) bits.push(r.year);
    if(!bits.length && r.url) bits.push(r.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40));
    return bits.join(' · ');
  }
  /* what it is, for a list row: the passage, or the work if that is all there is */
  const itemText = r => (r.passage || r.work || r.url || 'Untitled').trim();

  async function episodes(){
    try {
      const { values } = await Store.all('vlogs');
      return values.sort((a, b) => ((b.week || 0) - (a.week || 0)) || ((b.createdAt || 0) - (a.createdAt || 0)));
    } catch(e){ return []; }
  }

  const CSS = `
  .rs-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 4px}
  .rs-chips button{padding:7px 11px;border:1px solid var(--line);border-radius:999px;background:none;
    color:var(--muted);font-size:13px;cursor:pointer}
  .rs-chips button[aria-pressed="true"]{background:var(--cream);border-color:var(--cream);color:#151515;font-weight:700}
  .rs-row{display:block;width:100%;text-align:left;cursor:pointer;margin:0 0 8px;padding:11px 12px;
    border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);color:var(--cream)}
  .rs-row .top{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.1em;
    text-transform:uppercase;color:var(--muted)}
  .rs-row .top .st{margin-left:auto}
  .rs-row .it{margin:6px 0 3px;font-size:15px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;
    -webkit-box-orient:vertical;overflow:hidden}
  .rs-row small{display:block;font-size:12.5px;color:var(--muted)}
  .rs-row small.ep{color:var(--orange)}
  .rs-filters{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:0 0 14px}
  .rs-group{margin:14px 0 6px;font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
    color:var(--muted)}
  `;
  function injectCSS(){
    if(document.getElementById('rs-css')) return;
    const st = document.createElement('style');
    st.id = 'rs-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function rowHTML(r, opts){
    const o = opts || {};
    const st = statusOf(r);
    return `<button class="rs-row" data-rs="${r.id}">
      <div class="top"><span>${esc(typeLabel(r.kind))}</span>
        ${r.useIn ? `<span>· ${esc(useLabel(r.useIn))}</span>` : ''}
        <span class="st" style="color:${st.c}">${st.label}</span></div>
      <p class="it">${esc(itemText(r))}</p>
      ${sourceLine(r) && r.passage ? `<small>${esc(sourceLine(r))}</small>` : ''}
      ${o.epTitle !== undefined ? `<small class="${o.epTitle ? 'ep' : ''}">${
        o.epTitle ? esc(o.epTitle) : 'Unassigned'}</small>` : ''}
    </button>`;
  }

  /* The add / edit sheet. Quick when new: type, what it is, where from, and
     optionally which segment — enough to log it the moment you find it. The
     rest (status, the episode, author and year) is there when you edit. */
  async function sheet(rec, opts){
    injectCSS();
    const o = opts || {};
    const isNew = !(rec && rec.id);
    const r = { kind:'quote', passage:'', work:'', author:'', year:'', url:'', useIn:null,
                status:'idea', vlogId:null, ...(rec || {}), ...(isNew && o.vlogId ? { vlogId:o.vlogId } : {}) };
    const eps = isNew && !o.full ? [] : await episodes();
    const chips = (group, list, cur) => `<div class="rs-chips" data-group="${group}">
      ${list.map(x => `<button type="button" data-v="${x.k}" aria-pressed="${cur === x.k}">${x.label}</button>`).join('')}
    </div>`;
    const typeList = TYPES.some(t => t.k === r.kind) ? TYPES : [...TYPES, ...OLDER.filter(t => t.k === r.kind)];

    App.sheet(`
      <h2>${isNew ? 'Log research' : 'Research'}</h2>
      <div class="field"><label>Type</label>${chips('kind', typeList, r.kind)}</div>
      <div class="field"><label for="rs-item">What is it</label>
        <textarea id="rs-item" rows="3" placeholder="The quote, the finding, the example — the bit you'd say on camera"
          >${esc(r.passage)}</textarea></div>
      <div class="field"><label for="rs-src">Where it's from</label>
        <input id="rs-src" type="text" value="${esc(r.work || r.url)}"
          placeholder="Book title, person, or paste a link" autocomplete="off"></div>
      ${isNew && !o.full ? '' : `
        <div class="mo-dates" style="display:grid;grid-template-columns:2fr 1fr;gap:10px">
          <div class="field"><label for="rs-auth">Author</label>
            <input id="rs-auth" type="text" value="${esc(r.author)}" autocomplete="off"></div>
          <div class="field"><label for="rs-year">Year</label>
            <input id="rs-year" type="text" value="${esc(r.year)}" autocomplete="off"></div>
        </div>
        ${r.work && r.url ? `<div class="field"><label for="rs-url">Link</label>
          <input id="rs-url" type="url" value="${esc(r.url)}"></div>` : ''}`}
      <div class="field"><label>Use it in <small style="color:var(--dim);text-transform:none;letter-spacing:0">optional</small></label>
        ${chips('useIn', USE_IN, r.useIn)}</div>
      ${isNew && !o.full ? '' : `
        <div class="field"><label>Status</label>${chips('status', STATUS, statusOf(r).k)}</div>
        <div class="field"><label for="rs-ep">Episode</label>
          <select id="rs-ep"><option value="">Unassigned</option>
            ${eps.map(v => `<option value="${v.id}" ${r.vlogId === v.id ? 'selected' : ''}>${
              v.week ? `Ep ${v.week} · ` : ''}${esc(v.title || 'Untitled episode')}</option>`).join('')}
          </select></div>`}
      <div class="sheetcta">
        <button class="btn-primary" data-save>${isNew ? 'Log it' : 'Save'}</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>
      ${isNew ? '' : `<button class="btn-ghost" data-del style="width:100%;margin-top:10px;color:var(--red);
        border-color:rgba(226,86,74,.4)">Delete</button>`}`, el => {
      const $ = s => el.querySelector(s);
      el.addEventListener('click', async e => {
        const chip = e.target.closest('.rs-chips button');
        if(chip){
          const grp = chip.closest('.rs-chips');
          const on = chip.getAttribute('aria-pressed') === 'true';
          grp.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
          /* "use in" can be cleared by tapping it again; type and status always have one */
          if(!(on && grp.dataset.group === 'useIn')) chip.setAttribute('aria-pressed', 'true');
          return;
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(e.target.closest('[data-del]')){
          if(!confirm('Delete this from your research?')) return;
          await remove(r.id);
          App.closeSheet(); U.toast('Deleted');
          return o.onSaved && o.onSaved(null);
        }
        if(!e.target.closest('[data-save]')) return;
        const item = $('#rs-item').value.trim();
        const src = $('#rs-src').value.trim();
        if(!item && !src) return U.toast('Write what it is first');
        const pick = g => { const b = el.querySelector(`[data-group="${g}"] button[aria-pressed="true"]`); return b ? b.dataset.v : null; };
        const out = { ...r, kind:pick('kind') || r.kind, passage:item, useIn:pick('useIn') };
        /* a pasted link is the link; anything else is the work it came from */
        if(isUrl(src)){ out.url = src; if(r.url === r.work) out.work = ''; }
        else {
          out.work = src;
          if($('#rs-url')) out.url = $('#rs-url').value.trim();
        }
        if($('#rs-auth')) out.author = $('#rs-auth').value.trim();
        if($('#rs-year')) out.year = $('#rs-year').value.trim();
        if(el.querySelector('[data-group="status"]')) out.status = pick('status') || 'idea';
        if($('#rs-ep')) out.vlogId = $('#rs-ep').value || null;
        const saved = await save(out);
        App.closeSheet();
        U.toast(isNew ? (out.vlogId ? 'Logged to this episode' : 'Logged — unassigned') : 'Saved');
        o.onSaved && o.onSaved(saved);
      });
      setTimeout(() => { if(isNew) $('#rs-item').focus(); }, 180);
    });
  }
  const quickAdd = opts => sheet(null, opts);
  const edit = (rec, opts) => sheet(rec, { ...(opts || {}), full:true });

  /* Pick unassigned items to attach to an episode. */
  async function pickFor(vlogId, onDone){
    injectCSS();
    const list = await unassigned();
    App.sheet(`
      <h2>Link research</h2>
      <p style="margin:0 0 12px;color:var(--muted);font-size:14px">Unassigned items. Tap any to attach it to this episode.</p>
      ${list.length ? `<div style="max-height:58vh;overflow:auto">${list.map(r => rowHTML(r)).join('')}</div>`
        : `<div class="empty"><b>Nothing unassigned</b>Everything you've logged is already on an episode.</div>`}
      <div class="sheetcta"><button class="btn-ghost" data-cancel>Done</button></div>`, el => {
      el.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')){ App.closeSheet(); return onDone && onDone(); }
        const b = e.target.closest('[data-rs]');
        if(!b) return;
        const r = list.find(x => x.id === b.dataset.rs);
        if(!r) return;
        await save({ ...r, vlogId });
        b.remove();
        U.toast('Linked');
        if(!el.querySelector('[data-rs]')){ App.closeSheet(); onDone && onDone(); }
      });
    });
  }

  /* An episode's research, grouped by the segment it is for. */
  function groupedHTML(items){
    injectCSS();
    if(!items.length) return '';
    const groups = [...USE_IN.map(u => u.k), null];
    return groups.map(k => {
      const here = items.filter(r => (r.useIn || null) === k);
      if(!here.length) return '';
      return `<p class="rs-group">${esc(useLabel(k))}</p>${here.map(r => rowHTML(r)).join('')}`;
    }).join('');
  }

  global.Research = { TYPES, USE_IN, STATUS, typeLabel, useLabel, statusOf, all, forEpisode, unassigned,
                      save, remove, quickAdd, edit, pickFor, rowHTML, groupedHTML, sourceLine, itemText,
                      episodes, injectCSS };
})(window);
