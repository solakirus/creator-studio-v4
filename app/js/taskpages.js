/* A task's shot page: which Templates page a task starts with, and how a page
   is put on a task.

   Every new task starts with the nine-shot task sequence ("Sequence · Task",
   Shotline sheet.rs TASK_STEPS) from Templates, so nobody has to pick a page
   each time. A task whose page was removed (t.pageOff) is left alone, and
   picking another page from the Steps dropdown still works as before.

   Used by the Today add form, the Month/Week/Day add form (TaskForm),
   QuickAdd, and the task screen (for tasks made before this or elsewhere). */
(function(global){
  const DEFAULT_NAME = /^Sequence · Task$/;

  /* every steps page in Templates, the default one first */
  async function stepsPages(){
    if(!global.ShotTemplates || !global.Notebook) return [];
    let tpls = [];
    try { tpls = await ShotTemplates.all(); } catch(e){ return []; }
    const out = [];
    tpls.forEach(tp => {
      (tp.sheets || []).forEach(sh => { if(sh.layout === 'steps') out.push({ tp, sh }); });
      (tp.shots || []).forEach(s2 => { if(s2.sequence && s2.sequence.layout === 'steps') out.push({ tp, sh:s2.sequence }); });
    });
    out.sort((a, b) => (DEFAULT_NAME.test(b.sh.name) ? 1 : 0) - (DEFAULT_NAME.test(a.sh.name) ? 1 : 0));
    return out;
  }
  async function defaultSource(){ return (await stepsPages())[0] || null; }

  const shotName = (page, i) => {
    const sl = (page.slots || [])[i] || {};
    return sl.text || (page.layout === 'frames' ? `Frame ${i + 1}` : `Shot ${i + 1}`);
  };

  /* The steps ARE the page's shots: one step per shot, in page order, named
     after the shot (the person asked for the two to match). Steps that stand
     for no shot (typed before the page came, or made by a clip's pipeline)
     stay, after the shots. A step that stood for a shot under another name
     keeps that name as its note, once (s.pg marks steps already matched, so
     renaming a shot later doesn't turn the old name into a note). Several
     steps on one shot become one, done when all of them were.
     Returns true when anything changed. */
  function match(t){
    if(!t || !t.page || !Array.isArray(t.page.slots)) return false;
    const n = t.page.slots.length;
    const old = Array.isArray(t.subs) ? t.subs : [];
    const before = JSON.stringify(old);
    const onPage = s2 => s2 && s2.shot != null && s2.shot >= 0 && s2.shot < n;
    const norm = v => String(v || '').trim().toLowerCase();
    const steps = t.page.slots.map((sl, i) => {
      const mine = old.filter(s2 => onPage(s2) && s2.shot === i);
      const name = shotName(t.page, i);
      const notes = [];
      mine.forEach(s2 => {
        String(s2.note || '').split(' · ').forEach(x => { if(x.trim() && !notes.includes(x.trim())) notes.push(x.trim()); });
        if(!s2.pg && s2.t && norm(s2.t) !== norm(name) && !notes.includes(s2.t)) notes.push(s2.t);
      });
      const step = { ...(mine[0] || {}), t:name, done:mine.length ? mine.every(s2 => s2.done) : !!sl.done, shot:i, pg:1 };
      if(notes.length) step.note = notes.join(' · '); else delete step.note;
      return step;
    });
    const rest = old.filter(s2 => s2 && !onPage(s2)).map(s2 => { const c = { ...s2 }; delete c.shot; delete c.pg; return c; });
    t.subs = steps.concat(rest);
    return JSON.stringify(t.subs) !== before;
  }

  /* Put a copy of `src` (a sheet of template `tp`) on task t; its shots become
     the steps (match). Returns how many steps were made and linked. */
  function attach(t, tp, src){
    t.page = Notebook.copyNew(src);
    t.page.slots.forEach(sl => { sl.done = false; });
    if(t.page.layout === 'steps'){
      t.page.fields = { ...t.page.fields, task:'task — ' + t.title };
      if(DEFAULT_NAME.test(t.page.name)) t.page.name = 'Shot sequence · ' + t.title;
    }
    t.pageFrom = { tid:tp.id, sid:src.id, template:tp.name };
    delete t.pageOff;
    const n = t.page.slots.length;
    t.subs = t.subs || [];
    t.subs.forEach(s2 => { if(s2.shot != null && !(s2.shot >= 0 && s2.shot < n)) delete s2.shot; });
    match(t);
    return { made:n, linked:0 };
  }

  /* the default page on a task that has none and never had it removed */
  async function attachDefault(t){
    if(!t || t.page || t.pageOff) return false;
    const d = await defaultSource();
    if(!d) return false;
    attach(t, d.tp, d.sh);
    return true;
  }

  global.TaskPages = { stepsPages, defaultSource, attach, attachDefault, match, DEFAULT_NAME };
})(window);
