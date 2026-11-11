/* Academy — the course list, a course, and the reader. */
(function(){
  const { ICON } = U;

  const ico = c => `<span class="ac-ico" style="--cc:${c.c}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
      stroke-linecap="round" stroke-linejoin="round"><path d="${c.glyph}"/></svg></span>`;

  /* ---------- the shelf ---------- */
  async function mountAcademy(el){
    el.classList.add('paper');       /* set before any content is written */

    async function render(){
      const courses = await Academy.all();
      const rows = [];
      for(const c of courses) rows.push({ c, p: await Academy.courseProgress(c.id) });
      const totalDone = await Academy.totalDone();
      const art = await SectionArt.map(['academy', ...courses.map(c => 'course:' + c.id)]);

      el.innerHTML = Screens.bar({ title:'Academy',
        actions:`<button class="btn-sm accent" data-a="write">Write one</button>` }) + `
      <div class="view ac">
        ${SectionArt.banner('academy', { url:art.academy, tint:'#4B8A57', ratio:'16/7',
          children:`<p class="kick">Habit academy</p>
            <h2>Learn it once,<br>use it for years</h2>` })}

        <p class="ac-lead">Short courses on the things this app is for. Start anywhere —
          progress saves per course.${totalDone ? ` You have read ${totalDone} of ${Academy.totalLessons()} lessons.` : ''}</p>

        ${rows.map(({ c, p }) => `
          <button class="ac-card" data-course="${c.id}" style="--cc:${c.c}">
            ${art['course:' + c.id]
              ? `<span class="ac-ico" style="background-image:url(${art['course:' + c.id]});
                   background-size:cover;background-position:center"></span>`
              : ico(c)}
            <span class="ac-meat">
              <b>${c.n}</b>
              <p>${c.d}</p>
              <span class="sub">${c.lessons.length} lessons · ${Academy.minutes(c)} min</span>
            </span>
            <span class="ac-ring${p.n === p.of ? ' full' : ''}">${p.n}/${p.of}</span>
          </button>`).join('')}

        <p class="ac-lead" style="margin-top:6px">Every chapter ends with one thing to try.
          The trying is the part that works.</p>
      </div>`;
    }

    el.addEventListener('click', async e => {
      if(await SectionArt.handle(e, render)) return;
      if(e.target.closest('[data-a="write"]'))
        return Screens.push('course-edit', { onChange: () => { Academy.invalidate(); render(); } });
      const c = e.target.closest('[data-course]');
      if(c) Screens.push('course', { id:c.dataset.course, onChange:render });
    });

    render();
  }

  /* ---------- one course ---------- */
  async function mountCourse(el, params){
    el.classList.add('paper');
    await Academy.all();
    let c = Academy.byId(params.id);
    if(!c){ el.innerHTML = Screens.bar({ title:'Course' }) + '<div class="view ac"></div>'; return; }

    async function render(){
      const p = await Academy.courseProgress(c.id);
      const flags = [];
      for(let i = 0; i < c.lessons.length; i++) flags.push(await Academy.isDone(c.id, i));
      const art = await SectionArt.get('course:' + c.id);

      el.innerHTML = Screens.bar({ kicker:'Academy', title:c.n,
        actions: c.own ? `<button class="btn-sm accent" data-a="edit">Edit</button>` : '' }) + `
      <div class="view ac" style="--cc:${c.c}">
        ${SectionArt.banner('course:' + c.id, { url:art, tint:c.c, ratio:'16/8',
          children:`<p class="kick">${c.lessons.length} chapters · ${Academy.minutes(c)} min</p>
            <h2>${c.n}</h2>` })}
        <p class="ac-lead">${c.d}</p>

        <div class="ac-prog"><i style="width:${Math.round(p.n / p.of * 100)}%"></i></div>
        <p class="ac-lead" style="margin:8px 0 18px;font-size:13.5px">
          ${p.n} of ${p.of} read · ${Academy.minutes(c)} min in total</p>

        ${c.lessons.map((l, i) => `
          <button class="ac-chap${flags[i] ? ' done' : ''}" data-lesson="${i}">
            <span class="num">${flags[i] ? '✓' : String(i + 1).padStart(2,'0')}</span>
            <span class="tx"><b>${l.t}</b><span>${l.min} min read</span></span>
            <span class="go">${ICON.chevR}</span>
          </button>`).join('')}

        <div style="height:24px"></div>
      </div>`;
    }

    el.addEventListener('click', async e => {
      if(await SectionArt.handle(e, () => { render(); params.onChange && params.onChange(); })) return;
      if(e.target.closest('[data-a="edit"]'))
        return Screens.push('course-edit', { id:c.id, onChange: async () => {
          Academy.invalidate();
          const all = await Academy.all();
          const fresh = all.find(x => x.id === c.id);
          if(fresh) c = fresh;
          render();
          params.onChange && params.onChange();
        } });
      const l = e.target.closest('[data-lesson]');
      if(l) Screens.push('lesson', { course:c.id, i:+l.dataset.lesson, onChange:render });
    });

    render();
  }

  /* ---------- the reader ---------- */
  async function mountLesson(el, params){
    el.classList.add('paper');
    await Academy.all();
    const c = Academy.byId(params.course);
    const i = params.i;
    const l = c && c.lessons[i];
    if(!l){ el.innerHTML = Screens.bar({ title:'Lesson' }) + '<div class="view ac"></div>'; return; }

    let isDone = await Academy.isDone(c.id, i);

    /* The exercise at the end of a chapter is the only part of a lesson you are
       meant to do rather than read, so it can become a task on your day: the
       heading is the title, the paragraph rides along as the note. */
    /* Academy.rich escapes first and then decorates, so a chapter you wrote is
       text that gets formatted rather than markup that gets trusted. */
    const R = Academy.rich;

    function block(b, n){
      if(b[0] === 'h') return `<h2>${R(b[1])}</h2>`;
      if(b[0] === 'p') return `<p>${R(b[1])}</p>`;
      if(b[0] === 'ul') return `<ul class="rdlist">${
        (b[1] || []).map(x => `<li>${R(x)}</li>`).join('')}</ul>`;
      if(b[0] === 'q') return `<blockquote class="rdquote">${R(b[1])}</blockquote>`;
      if(b[0] === 'try') return `<div class="try">
        <span class="tag">Try this · ${R(b[2])}</span>
        <b>${R(b[1])}</b>
        <p>${R(b[3])}</p>
        <button class="tryadd" data-try="${n}">Add this to my day</button>
      </div>`;
      return '';
    }

    function render(){
      el.innerHTML = Screens.bar({ kicker:`Chapter ${String(i + 1).padStart(2,'0')} · ${l.min} min read`,
        title:l.t }) + `
      <div class="rd-bar"><i id="rdProg" style="width:0%"></i></div>
      <div class="view ac" style="--cc:${c.c}">
        <div class="rd">
          ${l.body.map((b, n) => block(b, n)).join('')}

          <div class="keys">
            <p class="cap">Key takeaways</p>
            ${l.keys.map((k, n) => `<div class="k"><i>${String(n + 1).padStart(2,'0')}</i>
              <span>${k}</span></div>`).join('')}
          </div>

          <button class="rd-done${isDone ? ' on' : ''}" data-done>
            ${isDone ? '✓ Read' : 'Mark as read'}</button>
          ${c.lessons[i + 1]
            ? `<button class="rd-next" data-next>Next: ${c.lessons[i + 1].t} →</button>`
            : `<button class="rd-next" data-back>Back to the course</button>`}
          <div style="height:26px"></div>
        </div>
      </div>`;

      /* how far down the page you are, as a thin rule under the header */
      const view = el.querySelector('.view');
      const prog = el.querySelector('#rdProg');
      if(view && prog){
        view.addEventListener('scroll', () => {
          const max = view.scrollHeight - view.clientHeight;
          prog.style.width = max > 0 ? `${Math.min(100, (view.scrollTop / max) * 100)}%` : '0%';
        });
      }
    }

    el.addEventListener('click', async e => {
      const tryBtn = e.target.closest('[data-try]');
      if(tryBtn){
        const b = l.body[+tryBtn.dataset.try];
        if(!b) return;
        App.sheet(`
          <h2>${b[1]}</h2>
          <p style="margin:0 0 8px;color:var(--orange);font-size:13px;
            font-family:var(--display),sans-serif;font-weight:900;letter-spacing:.1em;
            text-transform:uppercase">Try this · ${b[2]}</p>
          <p style="margin:0 0 18px;color:var(--muted);font-size:15px;line-height:1.6">${b[3]}</p>
          <div class="sheetcta">
            <button class="btn-primary" data-add>Add to my day</button>
            <button class="btn-ghost" data-cancel>Not now</button>
          </div>`, sheet => {
          sheet.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-add]')) return;
            await QuickAdd.add({ title:b[1], note:b[3], source:`${c.n} · ${l.t}` });
            App.closeSheet();
            U.toast(b[1] + ' — added to today');
          });
        });
        return;
      }
      if(e.target.closest('[data-done]')){
        isDone = !isDone;
        await Academy.complete(c.id, i, isDone);
        params.onChange && params.onChange();
        render();
        if(isDone){
          U.toast('Marked as read');
          Celebrate.showAwards();
        }
        return;
      }
      if(e.target.closest('[data-next]')){
        Screens.pop();
        setTimeout(() => Screens.push('lesson',
          { course:c.id, i:i + 1, onChange: params.onChange }), 120);
        return;
      }
      if(e.target.closest('[data-back]')) Screens.pop();
    });

    render();
  }

  Screens.register('academy', mountAcademy);
  Screens.register('course', mountCourse);
  Screens.register('lesson', mountLesson);
})();
