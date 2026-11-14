/* v4: the edit walkthrough — the steps from footage to posted, and the stage.

   Every episode and every short gets a checklist to work down while editing:
   import, label and organize, rough cut … export, thumbnail, post. Each step
   can carry a line on how you do it. The stage is the first step not done
   ("Rough cut · 3 of 12"), shown on the episode's card and on the short.

   The list is yours: rename, reorder, add or remove steps on this video, and
   "Make this my default" for vlogs or shorts (settings 'edit-steps-vlog' /
   'edit-steps-short'); a new video starts from your default.

     EditSteps.mount(host, { kind:'vlog'|'short', get() → rec, put(rec), onChange() })
     EditSteps.stage(rec) → { n, of, name, done } | null (not started) */
(function(global){
  const esc = s => U.esc(s);
  const rid = () => 'es' + Math.random().toString(36).slice(2, 9);
  const S = (n, how) => ({ n, how });
  const DEFAULTS = {
    vlog: [
      S('Import all footage', 'Every card and phone into the episode folder; check nothing is left on a card (Edit → Still on a card).'),
      S('Label and organize', 'Bins by day and sequence; rename the keepers; mark the best takes.'),
      S('Rough cut', 'Lay the sequences in order, story first — no polish.'),
      S('Fine cut', 'Tighten every cut, trim the air, check the pacing.'),
      S('Transitions', 'Build the THENs between shots — the Eyecandy ones have a ▶ in Edit.'),
      S('Sound effects', 'Whooshes on the transitions, foley on the inserts.'),
      S('Music', 'Pick the tracks, cut to the beat, duck under talking.'),
      S('Color', 'Match the cameras, then the look.'),
      S('Titles and captions', 'Lower thirds, on-screen text, captions.'),
      S('Export', 'The master, then any cut-downs.'),
      S('Thumbnail', ''),
      S('Post', 'Title, description, tags, schedule.')
    ],
    short: [
      S('Import the footage', ''),
      S('Rough cut', 'Hook in the first second.'),
      S('Captions', ''),
      S('Music and sound effects', ''),
      S('Color', ''),
      S('Export', 'Vertical, 1080×1920.'),
      S('Post', '')
    ]
  };
  const KEY = kind => 'edit-steps-' + (kind === 'short' ? 'short' : 'vlog');
  async function template(kind){
    let t = null;
    try { t = await Store.get('settings', KEY(kind)); } catch(e){}
    return (Array.isArray(t) && t.length ? t : DEFAULTS[kind === 'short' ? 'short' : 'vlog']).map(x => ({ n:x.n, how:x.how || '' }));
  }
  const fresh = list => list.map(x => ({ id:rid(), n:x.n, how:x.how || '', done:false }));
  function stage(rec){
    const L = rec && Array.isArray(rec.editSteps) ? rec.editSteps : null;
    if(!L || !L.length) return null;
    const i = L.findIndex(x => !x.done);
    const n = L.filter(x => x.done).length;
    return { n, of:L.length, name:i < 0 ? 'Done' : L[i].n, done:i < 0, started:n > 0 };
  }
  const stageLine = st => !st ? '' : st.done ? `Edit done · ${st.of} of ${st.of}` : `${st.name} · ${st.n} of ${st.of}`;

  async function mount(host, o){
    css();
    let rec = await o.get(), editing = false, openHow = new Set();
    if(!rec) return;
    if(!Array.isArray(rec.editSteps) || !rec.editSteps.length){ rec.editSteps = fresh(await template(o.kind)); }
    const save = async () => { await o.put(rec); if(o.onChange) await o.onChange(rec); };
    function draw(){
      if(!host.isConnected) return;
      const L = rec.editSteps, st = stage(rec);
      const cur = L.findIndex(x => !x.done);
      const pct = Math.round(st.n / st.of * 100);
      host.innerHTML = `<div class="es">
        <div class="es-head"><span class="es-stage">${st.done ? '✓ Edit done' : esc(st.name)}</span><small>${st.n} of ${st.of} steps</small>
          <button class="btn-sm" data-esedit aria-pressed="${editing}">${editing ? 'Done editing' : 'Edit the list'}</button></div>
        <div class="es-bar"><i style="width:${pct}%"></i></div>
        <ol class="es-list">${L.map((x, i) => editing ? `<li class="es-e">
            <input class="es-in" data-esn="${i}" value="${esc(x.n)}" aria-label="Step ${i + 1}">
            <input class="es-in how" data-esh="${i}" value="${esc(x.how || '')}" placeholder="How you do it (optional)">
            <span class="es-mv"><button data-esmv="${i}:-1" ${i === 0 ? 'disabled' : ''} aria-label="Up">↑</button><button data-esmv="${i}:1" ${i === L.length - 1 ? 'disabled' : ''} aria-label="Down">↓</button>
              <button data-esrm="${i}" aria-label="Remove ${esc(x.n)}">✕</button></span></li>`
          : `<li class="es-i${x.done ? ' done' : ''}${i === cur ? ' cur' : ''}">
            <button class="es-tick" data-estick="${i}" aria-pressed="${x.done}" aria-label="${x.done ? 'Undo' : 'Tick'} ${esc(x.n)}">${x.done ? '✓' : i + 1}</button>
            <span class="es-n">${esc(x.n)}${i === cur ? '<em>now</em>' : ''}</span>
            ${x.how ? `<button class="es-howb" data-eshow="${esc(x.id)}" aria-expanded="${openHow.has(x.id) || i === cur}">how ⌄</button>` : ''}
            ${x.how && (openHow.has(x.id) || i === cur) ? `<p class="es-how">${esc(x.how)}</p>` : ''}</li>`).join('')}</ol>
        ${editing ? `<div class="es-add"><input class="es-in" data-esnew placeholder="Add a step — Sound mix, B-roll pass…"><button class="btn-sm" data-esadd>Add</button></div>
          <div class="es-tpl"><button class="btn-sm" data-esdefault>Make this my default for ${o.kind === 'short' ? 'shorts' : 'vlogs'}</button>
            <button class="btn-sm" data-esreset>Start over from my default</button></div>` : ''}
      </div>`;
    }
    host.addEventListener('click', async e => {
      const g = e.target;
      if(g.closest('[data-esedit]')){ editing = !editing; if(!editing) await save(); return draw(); }
      const tk = g.closest('[data-estick]');
      if(tk){ const x = rec.editSteps[+tk.dataset.estick]; x.done = !x.done; if(x.done) x.at = Date.now(); else delete x.at; await save(); return draw(); }
      const hw = g.closest('[data-eshow]');
      if(hw){ const id = hw.dataset.eshow; openHow.has(id) ? openHow.delete(id) : openHow.add(id); return draw(); }
      const mv = g.closest('[data-esmv]');
      if(mv){ const [i, d] = mv.dataset.esmv.split(':').map(Number); const L = rec.editSteps; [L[i], L[i + d]] = [L[i + d], L[i]]; await save(); return draw(); }
      const rm = g.closest('[data-esrm]');
      if(rm){ rec.editSteps.splice(+rm.dataset.esrm, 1); await save(); return draw(); }
      if(g.closest('[data-esadd]')){ const f = host.querySelector('[data-esnew]'); const n = f.value.trim(); if(!n) return; rec.editSteps.push({ id:rid(), n, how:'', done:false }); await save(); draw(); const f2 = host.querySelector('[data-esnew]'); if(f2) f2.focus(); return; }
      if(g.closest('[data-esdefault]')){
        await Store.put('settings', rec.editSteps.map(x => ({ n:x.n, how:x.how || '' })), KEY(o.kind));
        return U.toast(`Your default for ${o.kind === 'short' ? 'shorts' : 'vlogs'} — new ones start from it`);
      }
      if(g.closest('[data-esreset]')){
        const was = rec.editSteps;
        rec.editSteps = fresh(await template(o.kind)).map(x => ({ ...x, done:!!(was.find(y => y.n === x.n) || {}).done }));
        await save(); return draw();
      }
    });
    let tt = 0;
    host.addEventListener('input', e => {
      const n = e.target.closest('[data-esn]'), h = e.target.closest('[data-esh]');
      if(n) rec.editSteps[+n.dataset.esn].n = n.value;
      else if(h) rec.editSteps[+h.dataset.esh].how = h.value;
      else return;
      clearTimeout(tt); tt = setTimeout(save, 600);
    });
    host.addEventListener('keydown', e => { if(e.key === 'Enter' && e.target.matches('[data-esnew]')){ e.preventDefault(); host.querySelector('[data-esadd]').click(); } });
    draw();
  }

  const CSS = `
  .es-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .es-stage{font-family:var(--display),sans-serif;font-weight:900;font-size:18px;color:var(--cream)}
  .es-head small{flex:1;color:var(--muted);font-size:13px}
  .es-bar{height:6px;margin:8px 0 10px;border-radius:3px;background:var(--surface-1);overflow:hidden}
  .es-bar i{display:block;height:100%;background:var(--green)}
  .es-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
  .es-i{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;padding:6px 8px;border-radius:var(--r)}
  .es-i.cur{background:var(--surface-1);border:1px solid rgba(251,105,0,.45)}
  .es-tick{width:28px;height:28px;flex:0 0 28px;border-radius:50%;border:2px solid #4A453C;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:800;cursor:pointer}
  .es-i.done .es-tick{background:var(--green);border-color:var(--green);color:#151515}
  .es-i.cur .es-tick{border-color:var(--orange);color:var(--orange)}
  .es-n{flex:1;min-width:0;font-size:15px}
  .es-i.done .es-n{color:var(--muted);text-decoration:line-through}
  .es-n em{margin-left:8px;font-style:normal;font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--orange)}
  .es-howb{height:24px;padding:0 8px;border:1px solid var(--line);border-radius:12px;background:transparent;color:var(--muted);font:inherit;font-size:11.5px;cursor:pointer}
  .es-how{flex:1 1 100%;margin:0 0 2px 38px;color:var(--muted);font-size:13.5px;line-height:1.45}
  .es-e{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) auto;gap:6px;align-items:center}
  @media (max-width:700px){ .es-e{grid-template-columns:1fr auto} .es-e .how{grid-column:1/-1;grid-row:2} }
  .es-in{height:36px;padding:0 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit;font-size:14px;min-width:0}
  .es-mv{display:flex;gap:4px}
  .es-mv button{width:32px;height:32px;border:1px solid var(--line);border-radius:var(--r);background:transparent;color:var(--muted);cursor:pointer}
  .es-mv button:disabled{opacity:.3}
  .es-add{display:flex;gap:6px;margin:10px 0 0}.es-add .es-in{flex:1}
  .es-tpl{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 0}`;
  function css(){ if(document.getElementById('es-css')) return; const st = document.createElement('style'); st.id = 'es-css'; st.textContent = CSS; document.head.appendChild(st); }

  global.EditSteps = { mount, stage, stageLine, template, DEFAULTS };
})(window);
