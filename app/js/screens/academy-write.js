/* Writing your own reading.

   A course you write is stored in the same shape as the shipped ones, so the
   reader, the progress tracking and the exercise-to-task button all work on it
   without knowing the difference. The only thing that is different is that you
   can edit it. */
(function(){

  const COLOURS = ['#4B8A57', '#C4613A', '#3C7FA8', '#7B4FA8', '#C18A2E', '#5A6270'];

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- the course ---------- */

  async function mountCourseEdit(el, params){
    let c = null;
    const isNew = !params || !params.id;

    if(isNew){
      c = { n:'', d:'', c:COLOURS[0], glyph:'M12 3a6 6 0 0 0-6 6c0 2 1 3 1 5v3h10v-3c0-2 1-3 1-5a6 6 0 0 0-6-6zM9 20h6', lessons:[] };
    } else {
      const all = await Academy.all();
      const found = all.find(x => x.id === params.id);
      c = found ? JSON.parse(JSON.stringify(found)) : null;
      if(!c){
        el.innerHTML = Screens.bar({ title:'Not found' }) + '<div class="view"></div>';
        return;
      }
    }

    function render(){
      el.innerHTML = Screens.bar({ kicker:'Academy', title: isNew ? 'New reading' : 'Edit reading',
        actions:`<button class="btn-sm accent" data-a="save">Save</button>` }) + `
      <div class="view">
        <h3 class="pgh">What is it called?</h3>
        <input id="cw-n" class="pgname" type="text" value="${esc(c.n)}"
          placeholder="Notes on Deep Work" autocomplete="off">
        <p class="err" id="cw-err" hidden>Give it a name.</p>

        <h3 class="pgh">One line about it</h3>
        <textarea id="cw-d" class="pgtext" rows="2"
          placeholder="What this is, and why you kept it.">${esc(c.d)}</textarea>

        <h3 class="pgh">Colour</h3>
        <div class="cwcols">${COLOURS.map(col =>
          `<button type="button" data-col="${col}" aria-pressed="${c.c === col}"
            style="background:${col}"></button>`).join('')}</div>

        <h3 class="pgh">Chapters ${c.lessons.length ? `<span class="cwn">${c.lessons.length}</span>` : ''}</h3>
        ${c.lessons.length ? c.lessons.map((l, i) => `
          <div class="cwrow">
            <span class="i">${String(i + 1).padStart(2, '0')}</span>
            <span class="t"><b>${esc(l.t || 'Untitled')}</b><small>${
              l.min || Academy.readMinutes(l.body)} min · ${(l.body || []).length} blocks</small></span>
            <button class="btn-sm" data-edit="${i}" aria-label="Edit">${U.ICON.pencil}</button>
            <button class="btn-sm" data-del="${i}" aria-label="Remove">${U.ICON.trash}</button>
          </div>`).join('')
          : `<div class="empty"><b>No chapters yet</b>Add one and start writing.</div>`}

        <button class="btn-ghost" data-a="add" style="width:100%;margin:16px 0 0">Add a chapter</button>

        ${isNew ? '' : `<button class="btn-ghost" data-a="delcourse"
          style="width:100%;margin:22px 0 0;color:var(--red);border-color:rgba(226,86,74,.45)">
          Delete this reading</button>`}
      </div>`;
    }

    function pull(){
      c.n = el.querySelector('#cw-n').value.trim();
      c.d = el.querySelector('#cw-d').value.trim();
    }

    el.addEventListener('click', async e => {
      const col = e.target.closest('[data-col]');
      if(col){
        c.c = col.dataset.col;
        el.querySelectorAll('[data-col]').forEach(x =>
          x.setAttribute('aria-pressed', String(x === col)));
        return;
      }

      const ed = e.target.closest('[data-edit]');
      if(ed){
        pull();
        return Screens.push('lesson-edit', {
          lesson: c.lessons[+ed.dataset.edit],
          onSave: l => { c.lessons[+ed.dataset.edit] = l; render(); }
        });
      }

      const rm = e.target.closest('[data-del]');
      if(rm){
        pull();
        c.lessons.splice(+rm.dataset.del, 1);
        return render();
      }

      const a = e.target.closest('[data-a]');
      if(!a) return;

      if(a.dataset.a === 'add'){
        pull();
        return Screens.push('lesson-edit', {
          lesson:{ t:'', body:[], keys:[] },
          onSave: l => { c.lessons.push(l); render(); }
        });
      }

      if(a.dataset.a === 'delcourse'){
        App.sheet(`
          <h2>Delete ${esc(c.n) || 'this reading'}?</h2>
          <p style="margin:0 0 18px;color:var(--muted);font-size:15px;line-height:1.6">
            ${c.lessons.length} chapter${c.lessons.length === 1 ? '' : 's'} would go with it.
            Anything you added to your days stays.</p>
          <div class="sheetcta">
            <button class="btn-primary" data-yes style="background:var(--red)">Delete</button>
            <button class="btn-ghost" data-no>Keep it</button>
          </div>`, sheet => {
          sheet.addEventListener('click', async ev => {
            if(ev.target.closest('[data-no]')) return App.closeSheet();
            if(!ev.target.closest('[data-yes]')) return;
            await Academy.deleteCourse(c.id);
            App.closeSheet();
            U.toast('Deleted');
            Screens.pop();
            params.onChange && params.onChange();
          });
        });
        return;
      }

      if(a.dataset.a === 'save'){
        pull();
        if(!c.n){ el.querySelector('#cw-err').hidden = false; return; }
        const saved = await Academy.saveCourse(c);
        c.id = saved.id;
        U.toast('Saved');
        params && params.onChange && params.onChange();
        Screens.pop();
      }
    });

    render();
  }

  /* ---------- one chapter ---------- */

  async function mountLessonEdit(el, params){
    const l = JSON.parse(JSON.stringify(params.lesson || { t:'', body:[], keys:[] }));
    let text = Academy.bodyToText(l.body, l.keys);
    let showing = 'write';

    function preview(){
      const { body } = Academy.parseBody(el.querySelector('#lw-body').value);
      const R = Academy.rich;
      return `<div class="rd">${body.map(b =>
        b[0] === 'h' ? `<h2>${R(b[1])}</h2>`
        : b[0] === 'p' ? `<p>${R(b[1])}</p>`
        : b[0] === 'ul' ? `<ul class="rdlist">${(b[1] || []).map(x => `<li>${R(x)}</li>`).join('')}</ul>`
        : b[0] === 'q' ? `<blockquote class="rdquote">${R(b[1])}</blockquote>`
        : `<div class="try"><span class="tag">Try this · ${R(b[2])}</span>
            <b>${R(b[1])}</b><p>${R(b[3])}</p></div>`).join('')
        || '<p>Nothing written yet.</p>'}</div>`;
    }

    function render(){
      el.innerHTML = Screens.bar({ kicker:'Chapter', title: l.t || 'Untitled',
        actions:`<button class="btn-sm accent" data-a="done">Done</button>` }) + `
      <div class="view${showing === 'read' ? ' ac paper' : ''}">
        ${showing === 'write' ? `
          <h3 class="pgh">Chapter title</h3>
          <input id="lw-t" class="pgname" type="text" value="${esc(l.t)}"
            placeholder="You are not your willpower" autocomplete="off">

          <div class="cwtabs">
            <button class="btn-sm accent" data-a="write">Write</button>
            <button class="btn-sm" data-a="read">Preview</button>
          </div>

          <textarea id="lw-body" class="cwbody" rows="18"
            placeholder="# A heading&#10;&#10;Write a paragraph. A blank line starts the next one.&#10;&#10;try: The autopilot audit | 24 hours&#10;What to actually go and do.&#10;&#10;* A key point for the end of the chapter">${esc(text)}</textarea>

          <details class="cwhelp">
            <summary>How to format it</summary>
            <p><b># </b> at the start of a line makes a heading.</p>
            <p>Anything else is a paragraph. A blank line starts a new one, and
              lines that wrap are joined back together.</p>
            <p><b>- </b> a bullet. Put them on consecutive lines for a list.</p>
            <p><b>&gt; </b> a line set apart from the rest.</p>
            <p><b>**bold**</b>, <b>*italic*</b> and <b>&#96;code&#96;</b> work inside
              any paragraph, bullet or heading.</p>
            <p><b>try: </b>Title<b> | </b>how long — an exercise, with the lines under it as its
              instructions. It gets the button that adds it to your day.</p>
            <p><b>* </b> a key point, collected at the end of the chapter.</p>
          </details>`
        : `<div class="cwtabs" style="margin:0 0 16px">
             <button class="btn-sm" data-a="write">Write</button>
             <button class="btn-sm accent" data-a="read">Preview</button>
           </div>
           ${preview()}`}
      </div>`;
    }

    function pull(){
      const t = el.querySelector('#lw-t');
      const b = el.querySelector('#lw-body');
      if(t) l.t = t.value.trim();
      if(b) text = b.value;
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if(!a) return;

      if(a.dataset.a === 'write' || a.dataset.a === 'read'){
        pull();
        showing = a.dataset.a;
        return render();
      }

      if(a.dataset.a === 'done'){
        pull();
        const { body, keys } = Academy.parseBody(text);
        l.body = body;
        l.keys = keys;
        l.min = Academy.readMinutes(body);
        params.onSave && params.onSave(l);
        Screens.pop();
      }
    });

    render();
  }

  Screens.register('course-edit', mountCourseEdit);
  Screens.register('lesson-edit', mountLessonEdit);
})();
