/* Sending sequences to your task list.

   The episode screen owned this, which meant a day screen could not do it — and
   "add this day's sequences to my tasks" is the thing you actually want on the
   morning you are filming them. Same flow, callable from either.

   A sequence with a day becomes a shoot task on that day, carrying its shots as
   steps, so ticking the last shot finishes the task. */
(function(global){

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  /* One task per sequence. Anything already sent is skipped rather than
     duplicated — pressing this twice is safe. */
  async function write(v, items){
    const existing = await Data.tasks();

    for(const x of items){
      const b = x.beat;
      const task = {
        id: U.taskId(), day: b.day,
        title: b.title,
        cad: `${v.title} · ${x.act.title}`,
        pri: 'med',
        at: b.at || null,
        mins: b.mins || 0,
        prog: b.purpose || '',
        view: 'todo',
        kind: 'shoot',
        beatId: b.id, vlogId: v.id,
        /* what Pipeline reads to move the piece on when this is ticked off */
        clipId: b.clipId || null,
        /* the sequence is the task; its shots are the steps inside it */
        subs: (b.shots || []).map(sh => ({
          t: sh.text || sh.name || String(sh), done: false
        })).filter(s => s.t),
        shots: (b.shots || []).map(sh => ({
          text: sh.text || sh.name || 'Shot',
          /* the same shot as the sequence's — Board and Shots show them as one */
          src: sh.id ? { beat: b.id, shot: sh.id } : undefined,
          angles: [{ n: sh.framing || 'Wide' }, { n: 'Medium' }, { n: sh.movement || 'Close' }]
            .map(a => ({ type: ShotIds.angleType(a.n), n: a.n, done: false }))
        }))
      };
      await Store.put('tasks', task);
      b.taskId = task.id;
    }
    Data.invalidate('tasks');
    return items.length;
  }

  /* Ask first, because it puts things on days you will have to deal with.
     `scope` is an act id to send one day only, or null for the whole week. */
  function sheet(v, opts){
    const { scope = null, dayLabel = n => `Day ${n}`, fmtTime = t => t,
            onDone = () => {} } = opts || {};

    const all = (v.acts || []).flatMap(a => (a.beats || []).map(b => ({ act:a, beat:b })));
    const inScope = all.filter(x => x.beat.day && (!scope || x.act.id === scope));
    const already = inScope.filter(x => x.beat.taskId).length;
    const todo = inScope.filter(x => !x.beat.taskId);
    const where = scope ? ((v.acts || []).find(a => a.id === scope) || {}).title : null;

    /* Nothing scheduled is a different problem from everything already sent, and
       they need different advice. */
    if(!inScope.length){
      const unscheduled = all.filter(x => !x.beat.day).length;
      return U.toast(unscheduled
        ? 'Give these a day first'
        : (scope ? 'Nothing on this day yet' : 'No sequences yet'));
    }

    App.sheet(`
      <h2 style="margin:0 0 3px">Add to my tasks</h2>
      <p class="hintline" style="margin:0 0 14px">${
        where ? `Everything on ${esc(where)}.` : 'Everything with a day.'}
        Each sequence becomes a shoot task carrying its shots, so it swipes,
        blocks time and counts toward the day like anything else.</p>

      ${already ? `<p style="margin:0 0 14px;padding:11px 12px;border-radius:var(--r);
        background:rgba(251,105,0,.08);border:1px solid rgba(251,105,0,.3);font-size:13.5px;
        color:var(--muted);line-height:1.5">${already} already on your days — skipped.</p>` : ''}

      <div class="group compact" style="margin:0 0 14px;max-height:40vh;overflow-y:auto">
        ${todo.length ? todo.map(x => `<div class="row" style="cursor:default">
            <span class="lbl">${esc(x.beat.title)}<small>${dayLabel(x.beat.day)}${
              x.beat.at ? ' · ' + fmtTime(x.beat.at) : ''}${
              (x.beat.shots || []).length ? ` · ${x.beat.shots.length} shots` : ''}</small></span>
          </div>`).join('')
        : `<p style="padding:14px 0;color:var(--dim);font-size:14px">
            Everything here is already on your days.</p>`}
      </div>

      <div class="sheetcta">
        <button class="btn-primary" data-go ${todo.length ? '' : 'disabled'}>
          Add ${todo.length} task${todo.length === 1 ? '' : 's'}</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {

      sheetEl.addEventListener('click', async ev => {
        if(ev.target.closest('[data-cancel]')) return App.closeSheet();
        if(!ev.target.closest('[data-go]')) return;

        const n = await write(v, todo);
        await Store.put('vlogs', v);
        App.closeSheet();
        U.toast(`${n} task${n === 1 ? '' : 's'} added`);
        onDone();
      });
    });
  }

  /* how many of a set are on your days — what the counts on a day row read */
  function counts(items){
    const scheduled = items.filter(x => (x.beat || x).day);
    return { total: items.length,
             scheduled: scheduled.length,
             onTasks: scheduled.filter(x => (x.beat || x).taskId).length };
  }

  global.VlogTasks = { sheet, write, counts };
})(window);
