/* Quick capture — get the thought out of your head in one tap, file it later.
   Text, a photo, or a voice note; triaged into a task, a shot, a swipe or a clip. */
(function(){
  const { ICON } = U;

  const uid = () => 'ib_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  const ago = ts => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if(m < 1) return 'just now';
    if(m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if(h < 24) return h + 'h ago';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  };

  async function mount(el){
    let items = [], media = {}, rec = null, chunks = [], recording = false, pendingPhoto = null;

    async function loadMedia(){
      try {
        const blobs = await Store.allMap('inbox-media');
        Object.values(media).forEach(URL.revokeObjectURL);
        media = {};
        Object.entries(blobs).forEach(([k,b]) => media[k] = URL.createObjectURL(b));
      } catch(e){ console.warn('Capture media unavailable', e); }
    }
    async function load(){
      const { values } = await Store.all('inbox');
      items = values.sort((a,b) => b.createdAt - a.createdAt);
      await loadMedia();
    }

    function render(){
      el.innerHTML = Screens.bar({ kicker:'Creator studio', title:'Quick capture',
        actions:`<button class="btn-sm" data-a="notes">Notes</button>` }) + `
      <div class="view">
        <div class="qc-box">
          <textarea id="qc-text" placeholder="What's the idea? Say it badly — you can fix it later."></textarea>
          <div class="qc-tools">
            <button class="t${pendingPhoto ? '' : ''}" data-a="photo" aria-label="Add a photo"
              style="${pendingPhoto ? `background-image:url(${pendingPhoto.url})` : ''}">
              ${pendingPhoto ? '' : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h4l1.5-2h7L17 7h4v12H3z"/><circle cx="12" cy="13" r="3.4"/></svg>`}
            </button>
            <button class="t${recording ? ' on' : ''}" data-a="rec" aria-label="Record a voice note">
              ${recording
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>'}
            </button>
            <button class="save" data-a="save">Capture</button>
          </div>
        </div>

        ${items.length ? `<div class="sec"><h2>Inbox</h2><div class="rule"></div>
          <span class="alt">${items.length}</span></div>` : ''}

        ${items.length ? items.map(it => {
          const first = String(it.text || '').split('\n')[0] || 'No note';
          const extra = [];
          if(String(it.text || '').split('\n').length > 1 || it.desc) extra.push('note');
          if((it.subs || []).length) extra.push((it.subs || []).length + ' steps');
          if(media[it.id + ':photo']) extra.push('photo');
          if(media[it.id + ':audio']) extra.push('audio');
          return `
          <button class="noterow" data-open="${it.id}">
            ${media[it.id + ':photo']
              ? `<span class="thumb" style="background-image:url(${media[it.id + ':photo']})"></span>`
              : '<span class="dot" style="background:var(--dim)"></span>'}
            <span class="t">
              <b>${first}</b>
              <small>${ago(it.createdAt)}${extra.length ? ' · ' + extra.join(' · ') : ''}</small>
            </span>
            ${ICON.chevR}
          </button>`;
        }).join('')
        : `<div class="empty"><b>Nothing waiting</b>Catch the thought here and sort it out when you're at a desk.</div>`}
      </div>`;

      const ta = el.querySelector('#qc-text');
      if(ta) setTimeout(() => ta.focus(), 120);
    }

    async function saveCapture(){
      const ta = el.querySelector('#qc-text');
      const text = ta ? ta.value.trim() : '';
      if(!text && !pendingPhoto) return U.toast('Write something, or add a photo');
      const id = uid();
      await Store.put('inbox', { id, text, createdAt: Date.now() });
      if(pendingPhoto){
        await Store.put('inbox-media', pendingPhoto.file, id + ':photo');
        pendingPhoto = null;
      }
      await load();
      U.toast('Captured');
      render();
    }

    async function toggleRec(){
      if(recording){ rec && rec.stop(); return; }
      if(!navigator.mediaDevices || !window.MediaRecorder)
        return U.toast('Recording is not available on this device');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
        rec = new MediaRecorder(stream);
        chunks = [];
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          recording = false;
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          const ta = el.querySelector('#qc-text');
          const id = uid();
          await Store.put('inbox', { id, text:(ta ? ta.value.trim() : ''), createdAt:Date.now() });
          await Store.put('inbox-media', blob, id + ':audio');
          await load();
          U.toast('Voice note captured');
          render();
        };
        rec.start();
        recording = true;
        render();
      } catch(e){
        console.error(e);
        U.toast('Microphone permission was refused');
      }
    }

    /* ---- filing ---- */
    async function fileIt(kind, id, onDay){
      const it = items.find(x => x.id === id);
      if(!it) return;
      const text = (it.text || '').trim() || 'Captured idea';

      if(kind === 'task'){
        const day = onDay || await Data.currentDay();
        const tasks = await Data.tasks();
        const newId = U.taskId();
        const rest = text.split('\n').slice(1).join('\n').trim();
        await Store.put('tasks', { id:newId, day, title:text.split('\n')[0].slice(0,80),
          cad:'One-off', pri:'med', at:null, prog:'',
          note: it.desc || rest || '',
          subs: (it.subs || []).map(x => ({ t:x.t || x, done:false })),
          shots:[], view:'todo' });
        Data.invalidate('tasks');
        await drop(id);
        return U.toast(`On day ${day}`);
      }

      if(kind === 'shot'){
        const tasks = (await Data.tasks()).filter(t => t.view !== 'done')
          .sort((a,b) => a.day - b.day).slice(0, 15);
        if(!tasks.length) return U.toast('No open tasks to add it to');
        App.sheet(`<h2>Add as a shot</h2>
          <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px">Which task is it for?</p>
          <div class="group compact" style="margin:0">
            ${tasks.map(t => `<button class="row" data-t="${t.id}">
              <span class="lbl">${t.title}<small>Day ${t.day}</small></span>${ICON.chevR}</button>`).join('')}
          </div>
          <div class="sheetcta"><button class="btn-ghost" data-cancel style="flex:1">Cancel</button></div>`,
        sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            const b = ev.target.closest('[data-t]');
            if(!b) return;
            const map = await Store.allMap('tasks');
            const task = Object.values(map).find(x => x.id === +b.dataset.t);
            task.shots = task.shots || [];
            task.shots.push({ id:'sh_' + Date.now().toString(36), text:text.split('\n')[0].slice(0,80),
              note:'', angles: Coverage.DEFAULT_PLAN.map(type => ({ type, done:false })) });
            await Store.put('tasks', task);
            Data.invalidate('tasks');
            App.closeSheet();
            await drop(id);
            U.toast('Added to the shot list');
          });
        });
        return;
      }

      if(kind === 'swipe'){
        const first = text.split('\n')[0].slice(0,80);
        const urlMatch = text.match(/https?:\/\/\S+/);
        await Store.put('swipes', {
          id:'sw_' + Date.now().toString(36), url:urlMatch ? urlMatch[0] : '',
          source:'reel', title:first, hook:'', beats:[], why:'', transferable:'',
          myAngle:urlMatch ? text : '', intent:'Education', channels:[], targets:[],
          createdAt:Date.now()
        });
        await drop(id);
        return U.toast('In the swipe file');
      }

      if(kind === 'clip'){
        await Data.saveClip({ title:text.split('\n')[0].slice(0,80), plat:'youtube',
          state:'raw', seriesId:null, dur:'0:00' });
        await drop(id);
        return U.toast('Added to Clips as raw');
      }
    }

    async function drop(id){
      await Store.del('inbox', id);
      await Store.del('inbox-media', id + ':photo');
      await Store.del('inbox-media', id + ':audio');
      await load();
      render();
    }

    /* One capture, opened. The five things you can do with it sit on a single
       row at the bottom rather than under every item in the list — five buttons
       per capture is what made the inbox unreadable after a busy day. */
    function openItem(it){
      const r = { ...it, subs: it.subs || [] };

      App.sheet(`
        <h2 style="margin:0 0 3px">Note</h2>
        <p class="hintline" style="margin:0 0 14px">Captured ${ago(it.createdAt)}</p>
        <textarea id="qi-x" class="pgtext" rows="3"
          placeholder="The thought">${(r.text || '').replace(/</g,'&lt;')}</textarea>

        ${media[it.id + ':photo'] ? `<div class="qi-media"
          style="background-image:url(${media[it.id + ':photo']})"></div>` : ''}
        ${media[it.id + ':audio'] ? `<audio controls src="${media[it.id + ':audio']}"
          style="width:100%;margin:10px 0 0"></audio>` : ''}

        <h3 class="pgh">Description</h3>
        <textarea id="qi-d" class="pgtext" rows="3"
          placeholder="Anything you want to remember when you get to it."
          >${(r.desc || '').replace(/</g,'&lt;')}</textarea>

        <h3 class="pgh">Steps</h3>
        <textarea id="qi-s" class="pgtext" rows="4"
          placeholder="Clear the counter&#10;Scrub the grout&#10;Wipe down"
          >${r.subs.map(x => x.t || x).join('\n').replace(/</g,'&lt;')}</textarea>
        <p class="hintline">One per line. These become the steps on the task card.</p>

        <h3 class="pgh">Send it somewhere</h3>
        <div class="qi-acts">
          <button data-go="task">Task</button>
          <button data-go="shot">Shot</button>
          <button data-go="swipe">Swipe</button>
          <button data-go="clip">Clip</button>
          <button class="rm" data-go="del">Delete</button>
        </div>

        <div class="sheetcta">
          <button class="btn-primary" data-keep>Save and keep it here</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheet => {

        const $ = q => sheet.querySelector(q);
        const pull = () => {
          r.text = $('#qi-x').value.trim();
          r.desc = $('#qi-d').value.trim();
          r.subs = $('#qi-s').value.split('\n').map(x => x.trim()).filter(Boolean)
            .map(t => ({ t, done:false }));
        };

        sheet.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();

          if(e.target.closest('[data-keep]')){
            pull();
            await Store.put('inbox', r);
            App.closeSheet();
            await load(); render();
            return U.toast('Saved');
          }

          const go = e.target.closest('[data-go]');
          if(!go) return;
          pull();
          await Store.put('inbox', r);
          /* fileIt reads the in-memory list, so refresh it before filing or the
             description and steps just typed would be dropped */
          await load();
          App.closeSheet();

          /* a task needs a day; everything else has nowhere to go but its own list */
          if(go.dataset.go === 'task') return setTimeout(() => askWhen(r.id), 60);

          await fileIt(go.dataset.go, r.id);
          await load(); render();
        });
      });
    }

    /* Which day the task lands on. Same three choices as Notes, so the answer to
       "when" is the same question wherever it is asked. */
    async function askWhen(id){
      let today = 1;
      try { today = await Data.currentDay(); } catch(e){ today = 1; }
      let chosen = null;

      App.sheet(`
        <h2 style="margin:0 0 3px">Put it on a day</h2>
        <p class="hintline" style="margin:0 0 16px">Just a day on your list — nothing to do
          with a program plan.</p>
        <div class="pgchips" data-group="when">
          <button type="button" data-when="today" aria-pressed="false">Today</button>
          <button type="button" data-when="tomorrow" aria-pressed="false">Tomorrow</button>
          <button type="button" data-when="pick" aria-pressed="false">Pick a date</button>
        </div>
        <div id="qw-when"></div>
        <div class="sheetcta">
          <button class="btn-primary" data-send disabled>Send it</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheet => {

        const $ = q => sheet.querySelector(q);
        const arm = () => { const b = $('[data-send]'); if(b) b.disabled = chosen === null; };

        sheet.addEventListener('click', async e => {
          const wn = e.target.closest('[data-when]');
          if(wn){
            sheet.querySelectorAll('[data-when]').forEach(b =>
              b.setAttribute('aria-pressed', String(b === wn)));

            if(wn.dataset.when === 'today'){ chosen = today; $('#qw-when').innerHTML = ''; }
            else if(wn.dataset.when === 'tomorrow'){ chosen = today + 1; $('#qw-when').innerHTML = ''; }
            else {
              chosen = null;
              $('#qw-when').innerHTML = `<div class="pgdatewrap">
                <input id="qw-date" class="pgbar pgdate" type="date"
                  min="${new Date().toISOString().slice(0,10)}"></div>`;
              const d = $('#qw-date');
              d.addEventListener('click', () => { if(d.showPicker) try { d.showPicker(); } catch(err){} });
              d.addEventListener('change', async () => {
                if(!d.value) return;
                try { chosen = await Data.dateToDay(new Date(d.value + 'T12:00').getTime()); }
                catch(err){ chosen = today; }
                arm();
              });
            }
            return arm();
          }

          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(!e.target.closest('[data-send]') || chosen === null) return;

          App.closeSheet();
          await fileIt('task', id, chosen);
          await load(); render();
        });
      });
    }

    el.addEventListener('click', async e => {
      const open = e.target.closest('[data-open]');
      if(open){
        const it = items.find(x => x.id === open.dataset.open);
        if(it) return openItem(it);
      }

      /* the pile lives in Notes; this is just the door to it */
      if(e.target.closest('[data-a="notes"]'))
        return Screens.push('notes', { onChange:render });

      const act = e.target.closest('[data-act]');
      if(act){
        const [kind, id] = act.dataset.act.split(':');
        if(kind === 'del') return drop(id);
        return fileIt(kind, id);
      }
      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'save') return saveCapture();
      if(a.dataset.a === 'rec') return toggleRec();
      if(a.dataset.a === 'photo'){
        App.pickImage(file => {
          pendingPhoto = { file, url:URL.createObjectURL(file) };
          const ta = el.querySelector('#qc-text');
          const keep = ta ? ta.value : '';
          render();
          const ta2 = el.querySelector('#qc-text');
          if(ta2) ta2.value = keep;
        });
      }
    });

    await load();
    render();
  }

  Screens.register('quick-capture', mount);
})();
