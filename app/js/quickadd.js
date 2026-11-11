/* Writing a single task from somewhere that is not the planner.

   The add form lives inside the Today view and depends on that view being
   mounted. Anything else that wants to create a task — a lesson's exercise, and
   whatever comes next — goes through here instead: read the store, take the next
   id, write, and tell Data something changed so the view underneath refreshes. */
(function(global){

  async function add(seed){
    const s = seed || {};
    let tasks = [];
    try { tasks = Object.values(await Store.allMap('tasks')); } catch(e){ tasks = []; }

    let day = s.day;
    if(!day){
      try { day = await Data.currentDay(); } catch(e){ day = 1; }
    }

    const task = {
      id: U.taskId(),
      day,
      title: (s.title || 'Untitled').trim(),
      cad: s.cad || 'One-off',
      pri: s.pri || 'med',
      at: s.at || null,
      mins: s.mins || 0,
      prog: s.prog || '',
      note: s.note || '',
      subs: s.subs || [],
      view: 'todo'
    };
    if(s.kind) task.kind = s.kind;
    if(s.source) task.source = s.source;
    /* every new task starts with the task sequence shot page (taskpages.js) */
    if(global.TaskPages) await TaskPages.attachDefault(task);

    await Store.put('tasks', task);
    if(global.Data && Data.invalidate) Data.invalidate('tasks');
    return task;
  }

  global.QuickAdd = { add };
})(window);
