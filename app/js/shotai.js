/* Suggest shots — break one action into the shots that cut it together.

   "Put up the tent" becomes laying out the parts, staking the corners, the
   poles going in, the tarp over: each a shot you can tick off, so on the day
   you don't forget an angle. Comes from the laptop Planner's AI shot
   breakdown, reshaped for a sequence's shots (one framing each — angles are
   planned once a sequence is sent to the task list).

   Two routes, as in the Planner:
     - your own Anthropic API key (Settings → AI shot suggestions), kept on
       this device and never written into a backup or plan pack
     - no key: copy the prompt, paste it into a Claude chat, paste the answer back

   ShotAI.suggest(ctx, onAdd) opens the sheet; onAdd(list) gets the shots you
   kept: [{ text, framing, movement, location, note }]. */
(function(global){

  const KEY = 'secret:ai';                /* Transfer leaves 'secret:' settings out of backups */
  const MODELS = [['claude-sonnet-5-5', 'Sonnet 5.5 — balanced'], ['claude-haiku-5-5', 'Haiku 5.5 — fastest'],
                  ['claude-opus-5-5', 'Opus 5.5 — most thorough']];
  const FRAMING  = ['Wide','Medium','Close','Over-shoulder','POV','Top-down'];
  const MOVEMENT = ['Static','Pan','Tilt','Push in','Pull out','Tracking','Handheld'];

  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  async function cfg(){ try { return (await Store.get('settings', KEY)) || {}; } catch(e){ return {}; } }
  async function setCfg(c){ await Store.put('settings', c, KEY); }

  function prompt(ctx){
    const c = ctx || {};
    return `You are a documentary/vlog director of photography helping a solo creator plan coverage.

Break this ONE action into the individual shots needed to cut it together well, in the order they happen.

${c.episode ? `Episode: ${c.episode}\n` : ''}${c.act ? `Part: ${c.act}\n` : ''}Action: ${c.title}
${c.purpose ? `What it does for the story: ${c.purpose}\n` : ''}${c.script ? `What is said over it: ${c.script}\n` : ''}${c.setup ? `How it is shot: ${c.setup}\n` : ''}${(c.locations || []).length ? `Locations already in use: ${c.locations.join(', ')}\n` : ''}${(c.have || []).length ? `Shots already planned for this action (do not repeat them): ${c.have.join('; ')}\n` : ''}
Rules:
- 4 to 8 shots. Each shot is one moment of the action a viewer needs to see.
- Mix framings so it edits: an establishing or wide, mediums, close-ups of hands/faces, details, and one creative shot.
- The creator often shoots alone, sometimes with a second camera. Keep shots achievable.
- Short shot names in plain words (e.g. "Stake the corners").

Reply with ONLY a JSON array, no prose, no code fences. Each item:
{"text": string, "framing": one of ${JSON.stringify(FRAMING)},
 "movement": one of ${JSON.stringify(MOVEMENT)} or "",
 "location": string, "note": string (one short tip, may be "")}`;
  }

  /* forgiving: strips fences and prose, keeps only values the app knows */
  function parse(text){
    const raw = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '');
    const a = raw.indexOf('['), b = raw.lastIndexOf(']');
    if(a < 0 || b < a) throw new Error('No list of shots found in that answer.');
    let arr;
    try { arr = JSON.parse(raw.slice(a, b + 1)); } catch(e){ throw new Error('That answer was not valid JSON.'); }
    if(!Array.isArray(arr) || !arr.length) throw new Error('The answer had no shots in it.');
    const pick = (v, list) => list.find(x => x.toLowerCase() === String(v || '').toLowerCase()) || '';
    return arr.slice(0, 12).filter(x => x && (x.text || x.name)).map(x => ({
      text: String(x.text || x.name).slice(0, 80),
      framing: pick(x.framing || (x.angles && x.angles[0] && x.angles[0].type), FRAMING),
      movement: pick(x.movement, MOVEMENT),
      location: String(x.location || '').slice(0, 40),
      note: String(x.note || '').slice(0, 160)
    }));
  }

  /* p is the prompt text, or a full content array (text plus an image) */
  async function ask(p, c, signal){
    const res = await fetch('https://api.anthropic.com/v1/messages', { signal, method:'POST',
      headers:{ 'content-type':'application/json', 'x-api-key': c.key, 'anthropic-version':'2023-06-01',
                'anthropic-dangerous-direct-browser-access':'true' },
      body: JSON.stringify({ model: c.model || MODELS[0][0], max_tokens: 2000,
                             messages:[{ role:'user', content: p }] }) });
    const j = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error((j.error && j.error.message) || `Claude answered ${res.status}`);
    return (j.content || []).map(x => x.text || '').join('');
  }

  /* ---------------------------------------------------------- the sheet */

  async function suggest(ctx, onAdd){
    const c = await cfg();
    const p = prompt(ctx);
    let list = null, busy = false, err = '';
    let ctl = null;

    const pickList = () => `
      <div class="ai-list">${list.map((s, i) => `
        <label class="ai-row"><input type="checkbox" data-i="${i}" checked>
          <span><b>${esc(s.text)}</b><small>${[s.framing, s.movement, s.location].filter(Boolean).map(esc).join(' · ')}${
            s.note ? ` — ${esc(s.note)}` : ''}</small></span></label>`).join('')}</div>
      <div class="sheetcta">
        <button class="btn-primary" data-add>Add ${list.length} shot${list.length === 1 ? '' : 's'}</button>
        <button class="btn-ghost" data-again>Ask again</button>
      </div>`;

    const html = () => `
      <h2>Suggest shots</h2>
      <p class="hintline" style="margin:0 0 12px">${esc(ctx.title)} — broken into the shots that cut it together.</p>
      ${err ? `<p style="margin:0 0 12px;color:var(--red);font-size:14px">${esc(err)}</p>` : ''}
      ${list ? pickList()
        : busy ? `<p class="ai-busy">Asking Claude…</p>
                  <div class="sheetcta"><button class="btn-ghost" data-stop>Stop</button></div>`
        : c.key ? `<div class="sheetcta"><button class="btn-primary" data-run>Suggest</button>
                     <button class="btn-ghost" data-cancel>Cancel</button></div>`
        : `<p class="hintline" style="margin:0 0 10px">No API key on this device, so this goes through a
             Claude chat: copy the prompt, paste it into a chat, then paste the answer here.
             (Or add a key in Settings → AI shot suggestions.)</p>
           <div class="sheetcta" style="margin:0 0 12px"><button class="btn-primary" data-copy>Copy prompt</button></div>
           <textarea id="ai-answer" rows="5" placeholder="Paste Claude's answer"
             style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
             color:var(--cream);font-size:14px;padding:10px;outline:none;resize:vertical"></textarea>
           <div class="sheetcta"><button class="btn-primary" data-read>Read the answer</button>
             <button class="btn-ghost" data-cancel>Cancel</button></div>`}`;

    App.sheet(html(), sheetEl => {
      const draw = () => { sheetEl.innerHTML = html(); };
      const run = async () => {
        busy = true; err = ''; list = null; draw();
        ctl = new AbortController();
        try { list = parse(await ask(p, c, ctl.signal)); }
        catch(e){ if(e.name !== 'AbortError') err = e.message || 'Could not reach Claude'; }
        busy = false; draw();
      };
      sheetEl.addEventListener('click', async e => {
        const t = e.target;
        if(t.closest('[data-cancel]')) return App.closeSheet();
        if(t.closest('[data-run]') || t.closest('[data-again]')){
          if(c.key) return run();
          list = null; err = ''; return draw();
        }
        if(t.closest('[data-stop]')){ if(ctl) ctl.abort(); return; }
        if(t.closest('[data-copy]')){
          try { await navigator.clipboard.writeText(p); U.toast('Prompt copied'); }
          catch(e2){ U.toast('Could not copy'); }
          return;
        }
        if(t.closest('[data-read]')){
          try { list = parse(sheetEl.querySelector('#ai-answer').value); err = ''; }
          catch(e2){ err = e2.message; }
          return draw();
        }
        if(t.closest('[data-add]')){
          const keep = [...sheetEl.querySelectorAll('[data-i]')].filter(x => x.checked).map(x => list[+x.dataset.i]);
          App.closeSheet();
          if(keep.length) await onAdd(keep);
          U.toast(`${keep.length} shot${keep.length === 1 ? '' : 's'} added`);
        }
      });
      sheetEl.addEventListener('change', e => {
        if(!e.target.matches('[data-i]')) return;
        const n = sheetEl.querySelectorAll('[data-i]:checked').length;
        const b = sheetEl.querySelector('[data-add]');
        if(b) b.textContent = `Add ${n} shot${n === 1 ? '' : 's'}`;
      });
      if(c.key) run();
    });
  }

  /* Settings → AI shot suggestions */
  async function openSettings(){
    const c = await cfg();
    App.sheet(`
      <h2>AI shot suggestions</h2>
      <p class="hintline" style="margin:0 0 12px">With your own Anthropic API key, Suggest shots asks Claude
        directly. The key stays on this device — it is left out of backups and plan packs. Without one,
        Suggest shots gives you a prompt to paste into a Claude chat instead.</p>
      <div class="field"><label for="ai-key">API key</label>
        <input id="ai-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(c.key || '')}"></div>
      <div class="field"><label>Model</label><div class="opts" data-group="setmodel">
        ${MODELS.map(([id, n]) => `<button type="button" class="opt" data-v="${id}" aria-pressed="${(c.model || MODELS[0][0]) === id}">${n}</button>`).join('')}
      </div></div>
      <div class="sheetcta">
        <button class="btn-primary" data-save>Save</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        const opt = e.target.closest('.opt');
        if(opt){ opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed', 'false'));
                 opt.setAttribute('aria-pressed', 'true'); return; }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-save]')) return;
        const key = sheetEl.querySelector('#ai-key').value.trim();
        const model = sheetEl.querySelector('[data-group="setmodel"] .opt[aria-pressed="true"]').dataset.v;
        await setCfg({ key, model });
        App.closeSheet();
        U.toast(key ? 'Saved — Suggest shots will ask Claude directly' : 'Key removed');
      });
    });
  }

  /* An episode's sequence: suggest, then add the kept shots to it. */
  async function forBeat(vlogId, beatId, after){
    const v = await Store.get('vlogs', vlogId);
    if(!v) return;
    let act = null, b = null;
    (v.acts || []).forEach(a => (a.beats || []).forEach(x => { if(x.id === beatId){ act = a; b = x; } }));
    if(!b) return;
    const locs = [...new Set((v.acts || []).flatMap(a => (a.beats || []).flatMap(x => (x.shots || []).map(s => s.location))).filter(Boolean))];
    return suggest({ title: b.title, episode: v.title, act: act && act.title, purpose: b.purpose, script: b.script,
                     have: (b.shots || []).map(s => s.text).filter(Boolean), locations: locs }, async keep => {
      const fresh = await Store.get('vlogs', vlogId);
      let beat = null;
      (fresh.acts || []).forEach(a => (a.beats || []).forEach(x => { if(x.id === beatId) beat = x; }));
      if(!beat) return;
      beat.shots = beat.shots || [];
      keep.forEach(s => beat.shots.push({ id: 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        text: s.text, note: s.note || '', framing: s.framing || '', movement: s.movement || '', location: s.location || '', done: false }));
      await Store.put('vlogs', fresh);
      if(after) await after(fresh);
    });
  }

  /* Reading a picture (handwriting on a Paper page). With a key it asks
     Claude directly; without one it shows the picture with steps to do it in
     a chat, and waits for the pasted answer. Resolves to text, or null. */
  async function readImage(text, image, label){
    const c = await cfg();
    if(c.key){
      U.toast(label || 'Reading…');
      try {
        const [, mime, b64] = String(image).match(/^data:([^;]+);base64,(.*)$/) || [];
        return await ask([{ type:'image', source:{ type:'base64', media_type: mime || 'image/png', data: b64 } },
                          { type:'text', text }], c);
      } catch(e){ U.toast(e.message || 'Could not reach Claude — paste it instead'); }
    }
    return new Promise(resolve => {
      let answer = null;
      App.sheet(`
        <h2>Read handwriting</h2>
        <p class="hintline" style="margin:0 0 10px">Save the picture, drop it into a Claude chat with the prompt,
          then paste the answer here. (With an API key in Settings this happens by itself.)</p>
        <img src="${image}" alt="Your handwriting" style="max-width:100%;max-height:30vh;background:#fff;border-radius:var(--r);margin:0 0 10px">
        <div class="sheetcta" style="margin:0 0 10px">
          <a class="btn-ghost" href="${image}" download="handwriting.png" style="text-align:center">1 · Save image</a>
          <button class="btn-ghost" data-copy>2 · Copy prompt</button>
        </div>
        <textarea id="ai-hw" rows="5" placeholder="3 · Paste Claude's answer"
          style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
          color:var(--cream);font-size:14px;padding:10px;outline:none;resize:vertical"></textarea>
        <div class="sheetcta"><button class="btn-primary" data-ok>Use this answer</button>
          <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-copy]')){
            try { await navigator.clipboard.writeText(text); U.toast('Prompt copied'); } catch(err){ U.toast('Could not copy'); }
            return;
          }
          if(e.target.closest('[data-cancel]')){ App.closeSheet(); return resolve(null); }
          if(e.target.closest('[data-ok]')){
            answer = sheetEl.querySelector('#ai-hw').value.trim();
            App.closeSheet(); resolve(answer || null);
          }
        });
      });
    });
  }

  /* Any text job: with a key it asks Claude directly; without one it shows the
     prompt to copy into a chat and waits for the pasted answer. Text or null. */
  async function askText(text, label, maxTokens){
    const c = await cfg();
    if(c.key){
      U.toast(label || 'Asking Claude…');
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', { method:'POST',
          headers:{ 'content-type':'application/json', 'x-api-key': c.key, 'anthropic-version':'2023-06-01',
                    'anthropic-dangerous-direct-browser-access':'true' },
          body: JSON.stringify({ model: c.model || MODELS[0][0], max_tokens: maxTokens || 4000,
                                 messages:[{ role:'user', content: text }] }) });
        const j = await res.json().catch(() => ({}));
        if(!res.ok) throw new Error((j.error && j.error.message) || `Claude answered ${res.status}`);
        return (j.content || []).map(x => x.text || '').join('');
      } catch(e){ U.toast(e.message || 'Could not reach Claude — paste it instead'); }
    }
    return new Promise(resolve => {
      App.sheet(`
        <h2>${esc(label || 'Ask Claude')}</h2>
        <p class="hintline" style="margin:0 0 10px">Copy the prompt into a Claude chat, then paste the whole
          answer here. (With an API key in Settings → Planning help this happens by itself.)</p>
        <div class="sheetcta" style="margin:0 0 10px"><button class="btn-primary" data-copy>Copy prompt</button></div>
        <textarea id="ai-tx" rows="6" placeholder="Paste Claude's answer"
          style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
          color:var(--cream);font-size:14px;padding:10px;outline:none;resize:vertical"></textarea>
        <div class="sheetcta"><button class="btn-primary" data-ok>Use this answer</button>
          <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-copy]')){
            try { await navigator.clipboard.writeText(text); U.toast('Prompt copied'); } catch(err){ U.toast('Could not copy'); }
            return;
          }
          if(e.target.closest('[data-cancel]')){ App.closeSheet(); return resolve(null); }
          if(e.target.closest('[data-ok]')){
            const a = sheetEl.querySelector('#ai-tx').value.trim();
            App.closeSheet(); resolve(a || null);
          }
        });
      });
    });
  }

  global.ShotAI = { suggest, forBeat, openSettings, prompt, parse, readImage, askText, MODELS };
})(window);
