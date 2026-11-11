/* A catalogue of shot types to pick from, so a coverage kit is chosen rather than typed.
   Editable: anything you add here is available everywhere afterwards. */
(function(global){
  const CATALOGUE = [
    /* framing */
    { id:'establish',  label:'Establishing',   group:'Framing',  hint:'Where we are' },
    { id:'wide',       label:'Wide',           group:'Framing',  hint:'The whole action' },
    { id:'medium',     label:'Medium',         group:'Framing',  hint:'Subject and context' },
    { id:'close',      label:'Close-up',       group:'Framing',  hint:'Face, hands, reaction' },
    { id:'extreme',    label:'Extreme close',  group:'Framing',  hint:'One detail, filling frame' },
    { id:'detail',     label:'Detail',         group:'Framing',  hint:'The small thing that sells it' },
    { id:'twoshot',    label:'Two shot',       group:'Framing',  hint:'Both people in frame' },
    { id:'ots',        label:'Over-the-shoulder', group:'Framing', hint:'From behind the subject' },
    { id:'pov',        label:'POV',            group:'Framing',  hint:'What they see' },
    { id:'topdown',    label:'Top-down',       group:'Framing',  hint:'Straight down on the work' },
    { id:'lowangle',   label:'Low angle',      group:'Framing',  hint:'Looking up — makes it bigger' },
    { id:'highangle',  label:'High angle',     group:'Framing',  hint:'Looking down — makes it smaller' },
    { id:'dutch',      label:'Dutch angle',    group:'Framing',  hint:'Tilted — unease or energy' },

    /* movement */
    { id:'static',     label:'Static',         group:'Movement', hint:'Locked off' },
    { id:'pan',        label:'Pan',            group:'Movement', hint:'Sweep across' },
    { id:'tilt',       label:'Tilt',           group:'Movement', hint:'Up or down the subject' },
    { id:'pushin',     label:'Push in',        group:'Movement', hint:'Move toward — builds focus' },
    { id:'pullout',    label:'Pull out',       group:'Movement', hint:'Move away — reveals' },
    { id:'tracking',   label:'Tracking',       group:'Movement', hint:'Travel alongside' },
    { id:'orbit',      label:'Orbit',          group:'Movement', hint:'Circle the subject' },
    { id:'handheld',   label:'Handheld',       group:'Movement', hint:'Deliberately loose' },
    { id:'whip',       label:'Whip pan',       group:'Movement', hint:'Fast — good for cuts' },
    { id:'rackfocus',  label:'Rack focus',     group:'Movement', hint:'Shift attention within one shot' },

    /* the ones that make it feel like yours */
    { id:'creative',   label:'Creative',       group:'Flavour',  hint:'The one you have to think about' },
    { id:'reflection', label:'Reflection',     group:'Flavour',  hint:'Mirror, window, puddle' },
    { id:'silhouette', label:'Silhouette',     group:'Flavour',  hint:'Shape against light' },
    { id:'foreground', label:'Foreground frame', group:'Flavour', hint:'Shoot through something' },
    { id:'transition', label:'Transition',     group:'Flavour',  hint:'Built to cut out of' },
    { id:'timelapse',  label:'Timelapse',      group:'Flavour',  hint:'Compress the boring part' },
    { id:'slowmo',     label:'Slow motion',    group:'Flavour',  hint:'Stretch the good bit' },
    { id:'broll',      label:'B-roll',         group:'Flavour',  hint:'Cover the talking' },
    { id:'reaction',   label:'Reaction',       group:'Flavour',  hint:'The face when it works' },
    { id:'beforeafter',label:'Before / after', group:'Flavour',  hint:'Same frame, two moments' }
  ];

  const GROUPS = ['Framing','Movement','Flavour','Yours'];

  let cache = null;
  async function all(){
    if(cache) return cache;
    const stored = await Store.get('settings', 'shot-library');
    if(stored && stored.length){ cache = stored; return cache; }
    /* first run, or upgrading from the old extras-only store */
    const extra = (await Store.get('settings', 'shot-library-extra')) || [];
    cache = [...CATALOGUE, ...extra];
    return cache;
  }
  async function save(list){
    cache = list;
    await Store.put('settings', list, 'shot-library');
    return list;
  }
  async function add(rec){
    const list = (await all()).slice();
    list.push(rec);
    await save(list);
    return rec;
  }
  async function reset(){
    cache = CATALOGUE.slice();
    await Store.put('settings', cache, 'shot-library');
    return cache;
  }
  const invalidate = () => cache = null;

  /* Pick shot types from the library. onPick gets [{id,label,hint,target}]. */
  async function pick(opts){
    const o = opts || {};
    const lib = await all();
    const chosen = new Map((o.existing || []).map(k => [k.id, k.target]));
    let q = '';

    const body = () => {
      const rows = lib.filter(k => !q || (k.label + ' ' + (k.hint||'')).toLowerCase().includes(q));
      const groups = {};
      rows.forEach(k => { (groups[k.group] = groups[k.group] || []).push(k); });
      return `
        <h2>${o.title || 'Shot types'}</h2>
        <div class="field" style="margin-bottom:14px">
          <input id="slq" type="text" placeholder="Search the library…" value="${q}">
        </div>
        ${Object.entries(groups).map(([g, items]) => `
          <p class="caps muted" style="font-size:11.5px;margin:16px 0 8px">${g}</p>
          <div class="group compact" style="margin:0">
            ${items.map(k => {
              const on = chosen.has(k.id);
              return `<button class="row" data-pick="${k.id}">
                <span class="lbl">${k.label}${k.hint ? `<small>${k.hint}</small>` : ''}</span>
                ${on ? `<span style="display:flex;align-items:center;gap:7px">
                    <button class="mini" data-t="-:${k.id}" ${chosen.get(k.id) <= 1 ? 'disabled' : ''}>−</button>
                    <b style="font-family:var(--display),sans-serif;font-weight:900;min-width:20px;text-align:center;color:var(--orange)">${chosen.get(k.id)}</b>
                    <button class="mini" data-t="+:${k.id}">+</button>
                  </span>`
                  : `<span style="width:26px;height:26px;border-radius:var(--r);border:1px solid var(--line);
                      color:var(--dim);display:flex;align-items:center;justify-content:center">+</span>`}
              </button>`;
            }).join('')}
          </div>`).join('')}
        ${rows.length ? '' : `<div class="empty" style="padding:26px 8px"><b>Nothing matches</b>Add it as your own below.</div>`}
        <div class="field" style="margin-top:18px"><label for="sln">Not in the list?</label>
          <div style="display:flex;gap:9px">
            <input id="sln" type="text" placeholder="Name a new shot type" style="flex:1">
            <button class="btn-sm" data-new style="width:52px;justify-content:center">+</button>
          </div>
        </div>
        <div class="sheetcta">
          <button class="btn-primary" data-done>Use ${chosen.size} type${chosen.size===1?'':'s'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`;
    };

    App.sheet(body(), sheetEl => {
      const redraw = () => {
        const pos = sheetEl.scrollTop;
        sheetEl.innerHTML = body();
        sheetEl.scrollTop = pos;
        const qi = sheetEl.querySelector('#slq');
        if(q) { qi.focus(); qi.setSelectionRange(q.length, q.length); }
      };

      sheetEl.addEventListener('input', e => {
        if(e.target.id !== 'slq') return;
        q = e.target.value.trim().toLowerCase();
        redraw();
      });

      sheetEl.addEventListener('click', async e => {
        const t = e.target.closest('[data-t]');
        if(t){
          e.stopPropagation();
          const [sign, id] = t.dataset.t.split(':');
          chosen.set(id, Math.max(1, chosen.get(id) + (sign === '+' ? 1 : -1)));
          return redraw();
        }
        const p = e.target.closest('[data-pick]');
        if(p){
          const id = p.dataset.pick;
          chosen.has(id) ? chosen.delete(id) : chosen.set(id, 2);
          return redraw();
        }
        if(e.target.closest('[data-new]')){
          const label = sheetEl.querySelector('#sln').value.trim();
          if(!label) return U.toast('Name the shot type');
          const rec = { id:U.slug(label), label, group:'Yours', hint:'' };
          await add(rec);
          lib.push(rec);
          chosen.set(rec.id, 2);
          q = '';
          return redraw();
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-done]')) return;

        const out = [...chosen.entries()].map(([id, target]) => {
          const k = lib.find(x => x.id === id) || { id, label:id, hint:'' };
          return { id, label:k.label, hint:k.hint || '', target };
        });
        App.closeSheet();
        o.onPick && o.onPick(out);
      });
    });
  }

  global.ShotLib = { all, add, save, reset, invalidate, pick, CATALOGUE, GROUPS };
})(window);
