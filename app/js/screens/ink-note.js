/* Write a note by hand — pen, finger or mouse — from the Notes screen.

   The ink is kept as strokes (js/inkpad.js, the same pad the laptop Planner
   used), so it redraws sharp anywhere and stays small. "Read it" sends a
   picture of the page to Claude (your key, or paste a chat's answer) and puts
   the words in the note's text, so the note is searchable and can become a
   task like any other. The ink stays with the note either way. */
(function(){

  const PROMPT = `This image is a page of handwritten notes. Transcribe it exactly as written:
keep the line breaks, lists, numbers and phone numbers. Fix nothing, add nothing, no commentary.
Where a word is unreadable, write [?]. Reply with only the transcribed text.`;

  async function mount(el, params){
    const o = params || {};
    let note = o.id ? (await Notes.all()).find(n => n.id === o.id) : null;
    if(!note) note = { id: 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                       text: '', ink: null, area: null, tags: [], createdAt: Date.now() };
    InkPad.css();
    el.innerHTML = Screens.bar({ kicker:'Notes', title: o.id ? 'Handwriting' : 'Write a note',
      actions:`<button class="btn-sm" data-a="read">Read it</button>
               <button class="btn-sm accent" data-a="done">Done</button>` }) +
      `<div class="view"><div class="ink-host"></div>
        ${note.text ? `<p class="hintline" style="margin:12px 0 0">Text so far: ${String(note.text).slice(0, 140).replace(/</g, '&lt;')}${note.text.length > 140 ? '…' : ''}</p>` : ''}
      </div>`;
    let saveT = null;
    const save = async () => { await Notes.save(note); o.onChange && o.onChange(); };
    const pad = InkPad.mount(el.querySelector('.ink-host'), note.ink, ink => {
      note.ink = ink;
      clearTimeout(saveT); saveT = setTimeout(save, 600);    /* a moment after the pen lifts */
    });

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'done'){
        clearTimeout(saveT);
        note.ink = pad.get();
        if(InkPad.isEmpty(note.ink) && !note.text) return Screens.pop();
        await save();
        U.toast('Saved to Notes');
        return Screens.pop();
      }
      if(a.dataset.a === 'read'){
        note.ink = pad.get();
        if(InkPad.isEmpty(note.ink)) return U.toast('Write something first');
        const text = await ShotAI.readImage(PROMPT, pad.png(), 'Reading your handwriting…');
        if(!text) return;
        const clean = String(text).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```\w*\n?|```\s*$/g, '').trim();
        if(!clean) return U.toast('Nothing came back');
        note.text = note.text ? `${note.text}\n${clean}` : clean;
        await save();
        U.toast('Added to the note as text');
      }
    });
  }

  Screens.register('ink-note', mount);
})();
