/* Paper — day, week and month pages you write on, from the laptop Planner.

   js/paper.js draws the pages and keeps the ink (settings "paper:<page>");
   this screen hands it the app's tasks. Paper thinks in dates, the app in
   program days, so tasks are given dates on the way in and turned back into
   days on the way out. Ticking a printed task ticks the real one. Reading
   handwriting goes through ShotAI (your key, or a pasted chat answer).

   Opened from Today (the pen button) and from Planning → Paper, which is the
   way round that suits a laptop. Either way it wants the whole screen, because
   the pen wants the room. */
(function(){

  const pad2 = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  async function mount(el, params){
    const o = params || {};
    /* Hosted inside the Planning tabs, the strip above already names the
       section — a second bar would steal height the page needs. */
    el.innerHTML = (o.embedded ? '' : Screens.bar({ kicker:'Today', title:'Paper' }))
      + '<div class="pp-wrap"></div>';
    const host = el.querySelector('.pp-wrap');

    const start = (await Data.program()).start;
    const isoOfDay = n => { const d = new Date(start); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n - 1); return isoOf(d); };
    let list = [];
    async function load(){
      const tasks = await Data.tasks();
      /* != null, not truthiness: day 0 is the day before Day 1, a real date,
         and a prep-day task was being left off the page entirely. */
      list = tasks.filter(t => t.day != null).map(t => ({ uid: 'task:' + t.id, id: t.id, title: t.title, date: isoOfDay(t.day),
        at: t.at || null, mins: t.mins || 0, kind: t.kind || 'task', done: t.view === 'done' }));
    }
    await load();

    await Paper.mount(host, {
      tasks: (a, b) => list.filter(t => t.date >= a && t.date <= b),
      addTasks: async items => {
        const tasks = await Data.tasks();
        for(const x of items){
          const day = await Data.dateToDay(new Date(x.date + 'T09:00').getTime());
          await Store.put('tasks', { id: U.taskId(), day, title: x.title, at: x.at || null, mins: +x.mins || 0,
            cad:'', pri:'med', prog:'', subs:[], view:'todo' });
        }
        Data.invalidate('tasks'); await load(); Paper.render();
        o.onChange && o.onChange();
      },
      onTick: async (uid, done) => {
        const id = String(uid).replace(/^task:/, '');
        const t = (await Data.tasks()).find(x => String(x.id) === id);
        if(!t) return;
        t.view = done ? 'done' : 'todo';
        await Store.put('tasks', t);
        Data.invalidate('tasks'); await load(); Paper.render();
        o.onChange && o.onChange();
      },
      /* Mindful morning and Evening reflection can land in that day's journal
         entry, which is one record per date. Appended under a heading, never
         overwriting what is already there, and never twice: re-reading the
         same box replaces its own section rather than stacking copies. */
      journal: async (date, heading, text) => {
        const id = date;
        const entry = (await Store.get('journal', id)) ||
          { id, mood:null, text:'', prompt:null, createdAt:Date.now() };
        const head = `## ${heading}`;
        const block = `${head}\n${text}`;
        const had = entry.text || '';
        const re = new RegExp(`(^|\\n)${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n[\\s\\S]*?(?=\\n## |$)`);
        entry.text = re.test(had)
          ? had.replace(re, (m, lead) => `${lead}${block}`)
          : (had.trim() ? `${had.trim()}\n\n${block}` : block);
        await Store.put('journal', entry);
        Data.invalidate && Data.invalidate('journal');
      },
      /* Straight from the page you are planning to that day in the app, and
         back out again — the point is to go to and fro while you lay the day
         out, not to navigate home and dig for it. */
      openDay: async iso => {
        const day = await Data.dateToDay(new Date(iso + 'T09:00').getTime());
        Screens.push('daysheet', { day, onChange: async () => { await load(); Paper.render(); } });
      },
      ai: (prompt, image, label) => ShotAI.readImage(prompt, image, label),
      toast: m => U.toast(m)
    });
    if(o.open) Paper.open(o.open);
  }

  Screens.register('paper', mount);
})();
