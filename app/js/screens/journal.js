/* Journal — one entry a day: how it went, and what today proved. */
(function(){
  const { ICON, pad } = U;

  const MOODS = [
    { k:'heavy',  n:'Heavy',  d:'M8.5 9.5v.01M15.5 9.5v.01M8 16c1.1-1.4 2.4-2 4-2s2.9.6 4 2' },
    { k:'flat',   n:'Flat',   d:'M8.5 9.5v.01M15.5 9.5v.01M8.5 15h7' },
    { k:'steady', n:'Steady', d:'M8.5 9.5v.01M15.5 9.5v.01M8 14c1.1 1.4 2.4 2 4 2s2.9-.6 4-2' },
    { k:'light',  n:'Light',  d:'M8.5 9v.01M15.5 9v.01M7.5 13.5c.8 2 2.5 3.2 4.5 3.2s3.7-1.2 4.5-3.2z' },
    { k:'peak',   n:'Peak',   d:'M6.6 8.4l3.4 1.6-3.4 1.6M17.4 8.4L14 10l3.4 1.6M7.5 13.5c.8 2 2.5 3.2 4.5 3.2s3.7-1.2 4.5-3.2z' }
  ];
  const moodOf = k => MOODS.find(m => m.k === k);

  const PROMPTS = [
    "What part of today felt most like the person you're becoming?",
    "What did you avoid today, and what was the avoidance actually about?",
    "Which piece of work today would you show someone?",
    "What took longer than it should have — and why?",
    "What is the one thing that, done tomorrow, makes the rest easier?",
    "Where did you do the work but skip the thinking?",
    "What did today prove that yesterday only suggested?"
  ];
  const dateKey = d => { const x = new Date(d);
    return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`; };
  const face = (k, cls) => {
    const m = moodOf(k) || MOODS[2];
    return `<span class="${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="${m.d}"/></svg></span>`;
  };

  async function mount(el, params){
    /* hosted as a section of Notes — the strip above already names it */
    const embedded = !!(params && params.embedded);
    const today = dateKey(Date.now());
    let entry = null, history = [], media = {}, rec = null, chunks = [], recording = false;

    async function loadMedia(){
      try {
        const blobs = await Store.allMap('journal-media');
        Object.values(media).forEach(URL.revokeObjectURL);
        media = {};
        Object.entries(blobs).forEach(([k,b]) => media[k] = URL.createObjectURL(b));
      } catch(e){ console.warn('Journal media unavailable', e); }
    }
    async function load(){
      entry = (await Store.get('journal', today)) ||
              { id:today, mood:null, text:'', prompt:null, createdAt:Date.now() };
      if(entry.prompt == null){
        entry.prompt = PROMPTS[new Date().getDate() % PROMPTS.length];
      }
      const { values } = await Store.all('journal');
      history = values.filter(x => x.id !== today).sort((a,b) => b.id.localeCompare(a.id));
      await loadMedia();
    }
    const save = async () => { await Store.put('journal', entry); };

    function render(){
      const photo = media[today + ':photo'];
      const audio = media[today + ':audio'];

      el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Creator studio', title:'Journal' })) + `
      <div class="view">
        ${embedded ? `<div class="pagehead"><h1 class="page-title">Journal</h1></div>` : ''}
        <div class="block">
          <h4 class="caps amber" style="color:var(--amber)">Today's reflection</h4>
          <p style="margin:0 0 8px;font-size:17px;line-height:1.4;font-style:italic">"${entry.prompt}"</p>
          <p style="margin:0;color:var(--muted);font-size:14.5px">The little wins are the proof — name one out loud.</p>
        </div>

        <div class="block">
          <h4>How are you feeling?</h4>
          <div class="moodrow">
            ${MOODS.map(m => `<button class="mood" data-mood="${m.k}" aria-pressed="${entry.mood===m.k}">
              ${face(m.k, 'face')}<span>${m.n}</span></button>`).join('')}
          </div>
        </div>

        <div class="block">
          <textarea id="j-text" rows="5" placeholder="What's on your mind tonight?"
            style="width:100%;background:transparent;border:0;color:var(--cream);font-size:17px;
            line-height:1.55;outline:none;resize:vertical;font-family:var(--body),sans-serif">${entry.text || ''}</textarea>

          ${audio ? `<audio controls src="${audio}" style="width:100%;margin:8px 0 14px"></audio>` : ''}

          <div style="display:flex;gap:11px;margin:10px 0 0">
            <button class="photobtn" data-a="photo" aria-label="Add a photo"
              style="${photo ? `background-image:url(${photo})` : ''}">
              ${photo ? '' : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>`}
            </button>
            <button class="recbtn${recording ? ' on' : ''}" data-a="rec">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${recording ? '<rect x="7" y="7" width="10" height="10" rx="2"/>'
                  : '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>'}
              </svg>
              <span><b>${recording ? 'Stop recording' : 'Record your thoughts'}</b>
                <small>${recording ? 'Tap when you are done' : 'Just talk · 30 seconds'}</small></span>
            </button>
          </div>

          <div class="jfoot">
            <span class="daylab"><i></i>${new Date().toLocaleDateString(undefined,{ month:'short', day:'numeric' })}</span>
            ${entry.mood ? `<span class="tick">${ICON.check}</span>` : ''}
            ${(entry.text||'').trim() ? `<span class="tick">${ICON.check}</span>` : ''}
            <button class="btn-sm accent" data-a="save" style="margin-left:auto">Save</button>
          </div>
        </div>

        <div class="sec"><h2>Timeline</h2><div class="rule"></div><span class="alt">${history.length}</span></div>
        ${history.length ? `<div class="block" style="padding:4px 14px">
          ${history.slice(0,20).map(h => `<div class="jrow">
            ${face(h.mood || 'steady', 'm')}
            <span class="b"><b>${new Date(h.id + 'T12:00').toLocaleDateString(undefined,{ weekday:'short', month:'short', day:'numeric' })}</b>
              <p>${(h.text || '').trim() ? h.text.slice(0,160) : 'No note — mood only.'}</p></span>
          </div>`).join('')}
        </div>` : `<div class="empty"><b>No entries yet</b>Tonight's is the first one.</div>`}
      </div>`;
    }

    /* voice note — MediaRecorder, with a clear failure message rather than a dead button */
    async function toggleRec(){
      if(recording){
        rec && rec.stop();
        return;
      }
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
          await Store.put('journal-media', blob, today + ':audio');
          entry.hasAudio = true;
          await save(); await loadMedia(); render();
        };
        rec.start();
        recording = true;
        render();
      } catch(e){
        console.error(e);
        U.toast('Microphone permission was refused');
      }
    }

    el.addEventListener('input', e => {
      if(e.target.id !== 'j-text') return;
      entry.text = e.target.value;
      clearTimeout(el._t);
      el._t = setTimeout(save, 500);
    });

    el.addEventListener('click', async e => {
      const m = e.target.closest('[data-mood]');
      if(m){ entry.mood = entry.mood === m.dataset.mood ? null : m.dataset.mood; await save(); return render(); }
      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'photo'){
        App.pickImage(async file => {
          await Store.put('journal-media', file, today + ':photo');
          entry.hasPhoto = true; await save(); await loadMedia(); render();
        });
      }
      if(a.dataset.a === 'rec') return toggleRec();
      if(a.dataset.a === 'save'){
        entry.createdAt = Date.now();
        await save();
        U.toast('Saved');
        await load(); render();
      }
    });

    await load();
    render();
  }

  Screens.register('journal', mount);
})();
