/* Artwork behind a section header.

   Any screen can claim a slot by name and let you drop an image into it. Kept
   generic on purpose — the academy, a course, the streak screen and anything
   added later all share the one mechanism rather than each growing their own. */
(function(global){

  const urls = {};

  async function get(slot){
    if(urls[slot] !== undefined) return urls[slot];
    try {
      const blob = await Store.get('section-art', slot);
      urls[slot] = blob ? URL.createObjectURL(blob) : null;
    } catch(e){ urls[slot] = null; }
    return urls[slot];
  }

  async function set(slot, file){
    await Store.put('section-art', file, slot);
    if(urls[slot]) URL.revokeObjectURL(urls[slot]);
    delete urls[slot];
    return get(slot);
  }

  async function clear(slot){
    try { await Store.del('section-art', slot); } catch(e){}
    if(urls[slot]) URL.revokeObjectURL(urls[slot]);
    delete urls[slot];
  }

  async function map(slots){
    const out = {};
    for(const s of slots) out[s] = await get(s);
    return out;
  }

  /* The banner markup: the image if there is one, a tint if not, and always an
     edit affordance so the slot is discoverable rather than hidden. */
  function banner(slot, opts){
    const o = opts || {};
    const url = o.url;
    return `<div class="sart${url ? ' has' : ''}${o.dark ? ' dark' : ''}"
      data-sart="${slot}" style="${o.tint ? `--tint:${o.tint};` : ''}${
      o.ratio ? `aspect-ratio:${o.ratio};` : ''}">
      ${url ? `<img src="${url}" alt="">` : ''}
      <div class="sart-in">${o.children || ''}</div>
      <button class="sart-edit" data-sartedit="${slot}" aria-label="Change the artwork">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
          stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 6.5l3 3"/></svg>
      </button>
    </div>`;
  }

  /* One handler every screen can delegate to. Returns true if it handled the tap. */
  async function handle(e, onChange){
    const ed = e.target.closest('[data-sartedit]');
    if(!ed) return false;
    e.stopPropagation();
    const slot = ed.dataset.sartedit;

    App.sheet(`
      <h2>Section artwork</h2>
      <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.6">
        Drop in something of your own. A still or an animated GIF both work — it sits behind
        the header with a scrim so the text stays readable.</p>
      <div class="sheetcta">
        <button class="btn-primary" data-pickart>Choose an image</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>
      <button class="btn-ghost" data-clearart style="width:100%;margin-top:10px;color:var(--red);
        border-color:rgba(226,86,74,.4)">Remove what is there</button>`, sheetEl => {
      sheetEl.addEventListener('click', async ev => {
        if(ev.target.closest('[data-cancel]')) return App.closeSheet();
        if(ev.target.closest('[data-clearart]')){
          await clear(slot);
          App.closeSheet();
          onChange && onChange();
          return;
        }
        if(ev.target.closest('[data-pickart]')){
          App.closeSheet();
          App.pickImage(async file => {
            await set(slot, file);
            onChange && onChange();
          });
        }
      });
    });
    return true;
  }

  global.SectionArt = { get, set, clear, map, banner, handle };
})(window);
