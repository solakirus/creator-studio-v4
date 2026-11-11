/* BoardSync — an episode's board and its shots are the same thing.

   On an episode's board, every sequence (the episode's actions — "Put up the
   tent") is a Section, and every shot in it is a shot card inside that
   section. The shots themselves stay in the episode (vlog → acts → beats →
   shots, with the ids from shotids.js); the board only points at them. So:

     episode → board   when the board opens, sections and cards are made for
                       anything new, and existing cards take the shot's
                       current text, framing and progress
     board → episode   editing a card's description or shot type, dragging it
                       to another section or along the row, adding a shot card
                       inside a section, renaming a section, or deleting a card
                       changes the episode

   Progress comes from where Shoot mode records it: the angles on the shoot
   task, once a sequence has been sent to the task list (its twin), or the
   sequence shot's own tick before that.

   The board page (board/board.html) calls this through window.parent. Every
   write goes through one queue, so two quick edits can't overwrite each
   other's copy of the episode. */
(function(global){

  /* Storyboard's shot types ↔ the episode's framing words */
  const TO_CAM = { 'Wide':'Wide', 'Medium':'Medium', 'Close':'Close-up', 'Extreme close':'Extreme close-up',
                   'Over-shoulder':'Over the shoulder', 'POV':'POV', 'Top-down':'Top-down' };
  const FROM_CAM = Object.fromEntries(Object.entries(TO_CAM).map(([k, v]) => [v, k]));
  const toCam = f => TO_CAM[f] || f || '';
  const fromCam = c => FROM_CAM[c] || c || '';

  const sid = () => 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  let queue = Promise.resolve();
  const run = fn => (queue = queue.then(fn, fn));

  let changedT = null;
  const listeners = new Set();
  function changed(){
    clearTimeout(changedT);
    changedT = setTimeout(() => listeners.forEach(fn => { try { fn(); } catch(e){} }), 300);
  }
  const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };

  /* ---------------------------------------------------------- reading */

  async function vlog(video){
    if(!video || video.type !== 'vlog') return null;
    try { return await Store.get('vlogs', video.id); } catch(e){ return null; }
  }
  const beatsOf = v => (v.acts || []).flatMap(a => (a.beats || []).map(b => ({ act:a, beat:b })));
  const findBeat = (v, id) => { const x = beatsOf(v).find(x => x.beat.id === id); return x ? x.beat : null; };
  function findShot(v, shotId){
    for(const { beat } of beatsOf(v)){
      const i = (beat.shots || []).findIndex(s => s.id === shotId);
      if(i >= 0) return { beat, i, shot: beat.shots[i] };
    }
    return null;
  }

  /* shoot-task copies of this episode's shots, by the sequence shot's id */
  async function twins(vlogId){
    const map = new Map();
    let tasks = [];
    try { tasks = await Data.tasks(); } catch(e){}
    tasks.forEach(t => (t.shots || []).forEach(s => {
      if(s && s.src && s.src.shot && (vlogId == null || t.vlogId == null || t.vlogId === vlogId)) map.set(s.src.shot, { task:t, shot:s });
    }));
    return map;
  }
  const doneAngles = s => (s.angles || []).filter(a => a.done).length;

  async function model(video){
    const v = await vlog(video);
    if(!v) return null;
    const tw = await twins(v.id);
    return {
      id: v.id, title: v.title,
      beats: beatsOf(v).map(({ act, beat }) => ({
        /* The day travels with every sequence: its id so the board can be
           asked to show one day, and its title and number so the section can
           say which day it belongs to without a second lookup. */
        id: beat.id, title: beat.title || 'Untitled sequence', act: act.title || '',
        actId: act.id, actDay: act.day != null ? act.day : null,
        shots: (beat.shots || []).map(s => {
          const t = tw.get(s.id);
          const want = t ? ((t.shot.angles || []).length || Coverage.ANGLE_TARGET) : 1;
          const got = t ? doneAngles(t.shot) : (s.done ? 1 : 0);
          return { id: s.id, text: s.text || s.name || '', framing: s.framing || '', cam: toCam(s.framing),
                   refs: s.refs || [], location: s.location || '',
                   sent: !!t, got, want, done: got >= want };
        })
      }))
    };
  }

  /* ---------------------------------------------------------- writing */

  async function write(video, fn){
    return run(async () => {
      const v = await vlog(video);
      if(!v) return null;
      const out = await fn(v);
      if(out === false || out === 'missing') return out;
      await Store.put('vlogs', v);
      changed();
      return out === undefined ? true : out;
    });
  }

  /* The twin on the shoot task follows the sequence's name, so the task screen
     and the board say the same thing. */
  async function renameTwin(shotId, text){
    const tw = await twins(null);
    const t = tw.get(shotId);
    if(!t || t.shot.text === text) return;
    t.shot.text = text;
    await Store.put('tasks', t.task);
    Data.invalidate('tasks');
  }

  function saveShot(video, ref, fields){
    return write(video, async v => {
      const hit = findShot(v, ref && ref.id);
      if(!hit) return 'missing';                 /* deleted in the episode, or an undone delete */
      const f = fields || {};
      let any = false;
      if(f.text != null && f.text !== hit.shot.text){ hit.shot.text = f.text; any = true; }
      if(f.cam != null && fromCam(f.cam) !== (hit.shot.framing || '')){ hit.shot.framing = fromCam(f.cam); any = true; }
      if(!any) return false;
      if(f.text != null) await renameTwin(hit.shot.id, f.text);
    });
  }

  /* A shot card dropped in a section becomes a shot in that sequence. With
     `restore` (an undone delete) it comes back with the id it had. */
  function addShot(video, beatId, fields, restore){
    return write(video, async v => {
      const b = findBeat(v, beatId);
      if(!b) return false;
      b.shots = b.shots || [];
      const id = (restore && restore.id) || sid();
      if(b.shots.some(s => s.id === id)) return id;
      const f = fields || {};
      const shot = restore && restore.shot
        ? restore.shot
        : { id, text: f.text || '', note:'', framing: fromCam(f.cam), movement:'', done:false };
      shot.id = id;
      const at = restore && restore.index != null ? Math.min(restore.index, b.shots.length) : b.shots.length;
      b.shots.splice(at, 0, shot);
      return id;
    });
  }

  function moveShot(video, shotId, toBeatId){
    return write(video, async v => {
      const hit = findShot(v, shotId), to = findBeat(v, toBeatId);
      if(!hit || !to || hit.beat === to) return false;
      hit.beat.shots.splice(hit.i, 1);
      (to.shots = to.shots || []).push(hit.shot);
    });
  }

  /* ids in their order along the section; any shot not on the board keeps
     its place after them */
  function reorder(video, beatId, ids){
    return write(video, async v => {
      const b = findBeat(v, beatId);
      if(!b || !Array.isArray(b.shots)) return false;
      const before = b.shots.map(s => s.id).join();
      const rank = new Map(ids.map((id, i) => [id, i]));
      const on = b.shots.filter(s => rank.has(s.id)).sort((a, c) => rank.get(a.id) - rank.get(c.id));
      const off = b.shots.filter(s => !rank.has(s.id));
      b.shots = [...on, ...off];
      if(b.shots.map(s => s.id).join() === before) return false;
    });
  }

  function renameBeat(video, beatId, title){
    return write(video, async v => {
      const b = findBeat(v, beatId);
      const t = String(title || '').trim();
      if(!b || !t || b.title === t) return false;
      b.title = t;
    });
  }

  /* Deleting a shot card deletes the shot — unless anything of it has been
     filmed. Footage is never thrown away from a board. */
  function removeShot(video, shotId){
    return run(async () => {
      const v = await vlog(video);
      if(!v) return { removed:false, reason:'missing' };
      const hit = findShot(v, shotId);
      if(!hit) return { removed:false, reason:'missing' };
      const tw = await twins(v.id);
      const t = tw.get(shotId);
      if(hit.shot.done || (t && doneAngles(t.shot))) return { removed:false, reason:'footage' };
      const snapshot = { id: shotId, beat: hit.beat.id, index: hit.i, shot: JSON.parse(JSON.stringify(hit.shot)) };
      hit.beat.shots.splice(hit.i, 1);
      await Store.put('vlogs', v);
      if(t){
        t.task.shots = (t.task.shots || []).filter(s => s !== t.shot);
        await Store.put('tasks', t.task);
        Data.invalidate('tasks');
      }
      changed();
      return { removed:true, snapshot };
    });
  }

  /* A still picked for a card also becomes the shot's reference, so the task
     screen and Shoot mode show the same picture. */
  function setStill(video, ref, refId){
    return write(video, async v => {
      const hit = findShot(v, ref && ref.id);
      if(!hit || !refId) return false;
      hit.shot.refs = [refId, ...(hit.shot.refs || []).filter(x => x !== refId)];
      const tw = await twins(v.id);
      const t = tw.get(hit.shot.id);
      if(t){
        t.shot.refs = [refId, ...(t.shot.refs || []).filter(x => x !== refId)];
        await Store.put('tasks', t.task);
        Data.invalidate('tasks');
      }
    });
  }

  /* A reference as a small data URL, for a card to keep. Cards hold their
     picture inline (that is how the canvas stores images), so it is scaled
     down rather than copied whole. */
  async function stillData(refId, max){
    const url = await Refs.thumb(refId);
    if(!url) return null;
    if(/^data:/.test(url)) return url;
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous';
        i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const m = max || 720, k = Math.min(1, m / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', .82);
    } catch(e){ return /^https?:/.test(url) ? url : null; }
  }

  /* ---------------------------------------------------------- clips

     A clip's plan has a flow: an ordered list of lines (clip.plan.beats —
     plain text, no ids). On a clip's board the flow is one section and each
     line a shot card, matched by position. The board is the only other place
     that edits it, so position is enough; every write re-reads the clip. */
  async function clipRec(video){
    if(!video || video.type !== 'clip') return null;
    try { return await Store.get('clips', video.id); } catch(e){ return null; }
  }
  async function writeClip(video, fn){
    return run(async () => {
      const c = await clipRec(video);
      if(!c) return null;
      c.plan = c.plan || {};
      c.plan.beats = Array.isArray(c.plan.beats) ? c.plan.beats : [];
      const out = await fn(c.plan.beats, c);
      if(out === false) return false;
      await Data.saveClip(c);
      changed();
      return out === undefined ? true : out;
    });
  }
  async function clipModel(video){
    const c = await clipRec(video);
    if(!c) return null;
    const lines = ((c.plan && c.plan.beats) || []).map(x => String(x || ''));
    return { id: c.id, title: c.title || 'Untitled clip', lines };
  }
  const clipSetLine = (video, i, text) => writeClip(video, b => { if(i < 0 || i >= b.length || b[i] === text) return false; b[i] = text; });
  const clipAddLine = (video, text) => writeClip(video, b => { b.push(text || ''); return b.length - 1; });
  const clipRemoveLine = (video, i) => writeClip(video, b => { if(i < 0 || i >= b.length) return false; b.splice(i, 1); });
  const clipInsertLine = (video, i, text) => writeClip(video, b => { const at = Math.max(0, Math.min(i, b.length)); b.splice(at, 0, text || ''); return at; });
  /* order: the old positions, in their new order; lines not named keep their place after */
  const clipReorder = (video, order) => writeClip(video, b => {
    const seen = new Set(order);
    const next = [...order.filter(i => i >= 0 && i < b.length).map(i => b[i]), ...b.filter((_, i) => !seen.has(i))];
    if(next.join('\u0000') === b.join('\u0000')) return false;
    b.splice(0, b.length, ...next);
  });

  global.BoardSync = { model, saveShot, addShot, moveShot, reorder, renameBeat, removeShot,
                       setStill, stillData, onChange, toCam, fromCam,
                       clipModel, clipSetLine, clipAddLine, clipRemoveLine, clipInsertLine, clipReorder };
})(window);
