/* The day's edition: everything the paper prints, worked out from your
   Creator Studio records with plain rules. No AI here — write.js adds the
   headline and the story on top, and the paper still prints without it.

     build(hub, dateISO, cfg) → edition {
       date, iso, dayLabel, dayNo, weekNo, name,
       today:[item], openPast:[item], week:[{ dow, date, items }],
       workout, habits:[{ name, dots:[st×7], streak }], due:[{ channel, items }],
       shoots:[shoot], counts }
     frameFor(hub, uid, shotlib) → { path, type } or null

   Dates are local (the container runs in TZ, e.g. America/New_York), the same
   way the app counts them: a task's `day` is its number in the program, day 1
   being settings.program.start. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const midnight = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const daysBetween = (a, b) => Math.round((midnight(b) - midnight(a)) / DAY);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/* "<b>From Punch</b><br>Film it" → "From Punch · Film it" */
function plain(html){
  return String(html || '').replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e])
    .replace(/\s+/g, ' ').trim();
}
function timeLabel(at){
  const m = /^(\d{1,2}):(\d{2})/.exec(at || '');
  if (!m) return '';
  const h = +m[1], mi = +m[2], ap = h >= 12 ? 'P.M.' : 'A.M.', hh = ((h + 11) % 12) + 1;
  return `${hh}:${pad(mi)} ${ap}`;
}
const KIND = { shoot: 'SHOOT', edit: 'EDIT', publish: 'POST', workout: 'GYM' };
const AREA = { home: 'HOME', car: 'CAR', family: 'FAMILY' };
const isOut = c => c.stage === 'published' || c.state === 'posted' || !!c.postedAt;
const live = t => t && t.view !== 'deleted' && !t.deletedAt;

/* ------------------------------------------------------------ habits.js, as the app runs it */
let H = null;
function habitsLib(){
  if (H) return H;
  for (const p of [path.join(__dirname, 'habits.js'), path.join(__dirname, '..', '..', 'app', 'js', 'habits.js')]) {
    if (!fs.existsSync(p)) continue;
    const win = {};
    const U = { midnight, hash(s){ let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); } };
    vm.runInNewContext(fs.readFileSync(p, 'utf8'), { window: win, U, console, Date, Math, JSON, Number, String, Array, Object, Set, Map });
    return H = win.Habits;
  }
  return null;
}

/* ------------------------------------------------------------ pictures */
const IMG = /\.(gif|png|jpe?g|webp)$/i;
function frameFor(hub, uid, shotlib){
  if (!uid) return null;
  const tf = hub.get('task-frames', uid);
  if (tf) {
    const f = tf.kind === 'video' ? hub.file(tf.poster) : hub.file(tf.blob);
    if (f && /^image\//.test(f.type || 'image/')) return f;
    if (tf.path && shotlib) { const p = path.join(shotlib, tf.path); if (IMG.test(p) && fs.existsSync(p)) return { path: p, type: '' }; }
  }
  const m = /^h:[^|]*\|(.+)$/.exec(String(uid));
  if (m && shotlib) {
    const rel = m[1].replace(/\\/g, '/').replace(/^\/+/, '');
    if (!rel.split('/').includes('..')) {
      const p = path.join(shotlib, rel);
      if (IMG.test(p) && fs.existsSync(p)) return { path: p, type: '' };
    }
  }
  return null;
}
function refFrame(hub, refId){
  if (!refId) return null;
  const img = hub.file(hub.get('ref-img', refId));
  if (img && /^image\//.test(img.type)) return img;
  return hub.file(hub.get('ref-poster', refId));
}

/* ------------------------------------------------------------ one task as a line */
function item(t){
  const subs = Array.isArray(t.subs) ? t.subs : [];
  const slots = t.page && Array.isArray(t.page.slots) ? t.page.slots : [];
  let note = plain(t.note);
  if (!note && (t.kind === 'shoot' || slots.length)) {
    const n = slots.length || subs.length;
    note = n ? `${n} shot${n === 1 ? '' : 's'} — on the To film page` : '';
  } else if (!note && t.kind === 'workout') note = '';
  else if (!note && subs.length) note = subs.slice(0, 4).map(s => s.t).filter(Boolean).join(' · ');
  if (note.length > 110) note = note.slice(0, 107).replace(/\s+\S*$/, '') + '…';
  return {
    id: t.id, at: t.at || '', time: timeLabel(t.at), title: plain(t.title) || 'Untitled',
    note, tag: AREA[t.life] || KIND[t.kind] || (t.habitId ? 'HABIT' : 'TO-DO'),
    kind: t.kind || '', area: t.life || '', done: t.view === 'done', skipped: t.view === 'skipped',
    pri: t.pri || 'med', mins: +t.mins || 0
  };
}
const byClock = (a, b) => (a.at || '99:99').localeCompare(b.at || '99:99') ||
  ({ high: 0, med: 1, low: 2 }[a.pri] ?? 1) - ({ high: 0, med: 1, low: 2 }[b.pri] ?? 1);

/* ------------------------------------------------------------ the edition */
function build(hub, iso, cfg){
  const c = cfg || {};
  const date = fromISO(iso);
  const program = hub.get('settings', 'program') || {};
  const start = program.start ? +program.start : new Date(date.getFullYear(), 9, 1).getTime();
  const dayNo = daysBetween(start, date) + 1;
  const weekNo = Math.ceil(dayNo / 7);
  const total = +c.daysTotal || 1000;
  const preName = String(program.preName || 'Prep').trim() || 'Prep';
  const dayLabel = dayNo >= 1 ? `Day ${dayNo.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}`
    : `${preName} · ${1 - dayNo} day${1 - dayNo === 1 ? '' : 's'} to Day 1`;
  const name = String(hub.get('settings', 'name') || c.name || '').trim();

  const tasks = hub.all('tasks').filter(live).filter(t => typeof t.day === 'number');
  const on = n => tasks.filter(t => t.day === n);
  const todays = on(dayNo);
  const real = todays.filter(t => !t.habitId);
  const today = real.map(item).sort(byClock);

  const openPast = tasks.filter(t => !t.habitId && t.view === 'todo' && t.day < dayNo && t.day >= dayNo - 7)
    .sort((a, b) => b.day - a.day).map(t => ({ ...item(t), ago: dayNo - t.day }));

  const week = [];
  for (let i = 1; i <= 6; i++) {
    const d = addDays(date, i);
    const items = on(dayNo + i).filter(t => !t.habitId).map(item).sort(byClock);
    week.push({ dow: d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(), iso: isoOf(d), items });
  }

  /* the workout: today's workout task, its lifts from the routine or its steps */
  let workout = null;
  const wt = real.find(t => t.kind === 'workout') || todays.find(t => t.kind === 'workout');
  if (wt) {
    const routine = wt.routineId ? hub.get('routines', wt.routineId) : null;
    let lifts = routine && Array.isArray(routine.items) && routine.items.length
      ? routine.items.map(i => ({ name: plain(i.name), amount: [i.sets, i.reps].filter(Boolean).join(' × ') }))
      : (wt.subs || []).map(s => { const [n, ...rest] = String(s.t || '').split(' · '); return { name: plain(n), amount: rest.join(' · ').replace('×', ' × ') }; });
    lifts = lifts.filter(l => l.name).slice(0, 9);
    workout = { title: plain(wt.title), time: timeLabel(wt.at), lifts, done: wt.view === 'done' };
  }

  /* habits: the last seven days, as the app colours them */
  let habits = [];
  const Hb = habitsLib();
  if (Hb) {
    const list = hub.entries('settings').filter(([k, v]) => String(k).startsWith('habit:') && v && v.id)
      .map(([, v]) => v).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (list.length) {
      const idx = Hb.index({ tasks, sessions: hub.all('sessions'), runs: hub.all('runs'), start });
      const todayKey = Hb.keyOf(date.getTime());
      habits = list.slice(0, 7).map(h => {
        const dots = [];
        for (let i = 6; i >= 0; i--) {
          const k = Hb.keyOf(addDays(date, -i).getTime());
          dots.push({ st: Hb.dayStatus(h, k, idx, todayKey), dow: 'SMTWTFS'[addDays(date, -i).getDay()] });
        }
        let streak = null;
        try { streak = Hb.streak(h, idx, todayKey); } catch (e) {}
        return { name: plain(h.name), goal: h.per === 'week' ? `${h.times}× a week` : '', dots, streak };
      });
    }
  }

  /* videos: posting today, missed, and this week — by channel */
  const clips = hub.all('clips').filter(x => x && !isOut(x));
  const t0 = date.getTime();
  const dueClips = clips.filter(x => x.scheduledAt && midnight(x.scheduledAt) >= t0 - 7 * DAY && midnight(x.scheduledAt) < t0 + 7 * DAY)
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
  const byCh = new Map();
  for (const x of dueClips) {
    const ch = plain(x.channel) || 'No channel';
    const when = midnight(x.scheduledAt), dd = Math.round((when - t0) / DAY);
    const wd = new Date(x.scheduledAt).toLocaleDateString('en-US', { weekday: 'long' });
    const hm = new Date(x.scheduledAt);
    const clock = hm.getHours() || hm.getMinutes() ? ' at ' + timeLabel(pad(hm.getHours()) + ':' + pad(hm.getMinutes())).toLowerCase().replace(/\./g, '').replace(':00', '') : '';
    const whenWords = dd === 0 ? 'posts today' + clock : dd === 1 ? 'posts tomorrow' : dd > 1 ? `posts ${wd}` : `was due ${wd}, not out yet`;
    const stage = { idea: 'still an idea', planned: 'not shot yet', shot: 'shot, needs the edit', editing: 'in editing' }[x.stage] || '';
    if (!byCh.has(ch)) byCh.set(ch, []);
    byCh.get(ch).push({ title: plain(x.title) || 'Untitled', when: whenWords, stage, late: dd < 0, today: dd === 0 });
  }
  const due = [...byCh].map(([channel, items]) => ({ channel, items }));

  /* to film: every shoot on today's list, with one picture from it */
  const shoots = [];
  for (const t of real) {
    const slots = t.page && Array.isArray(t.page.slots) ? t.page.slots : [];
    const subs = Array.isArray(t.subs) ? t.subs : [];
    if (!(t.kind === 'shoot' || slots.length || t.beatId)) continue;
    const clip = t.clipId ? hub.get('clips', t.clipId) : null;
    const vlog = t.vlogId ? hub.get('vlogs', t.vlogId) : null;
    const series = clip && clip.series ? hub.get('series', clip.series) : null;
    const shots = slots.length
      ? slots.map((sl, i) => { const st = subs.find(s => s.shot === i) || {}; return { name: plain(sl.text || st.t) || `Shot ${i + 1}`, done: !!(st.done || sl.done), item: sl.item || '' }; })
      : subs.map(s => ({ name: plain(s.t), done: !!s.done, item: '' })).filter(s => s.name);
    let frame = null;
    for (const s of shots) { if (s.item && (frame = frameFor(hub, s.item, c.shotlib))) break; }
    if (!frame) for (const sh of t.shots || []) {
      for (const a of (sh && sh.angles) || []) for (const r of a.refIds || []) { if (!frame) frame = refFrame(hub, r); }
      if (frame) break;
    }
    if (!frame && clip && clip.page && Array.isArray(clip.page.slots)) {
      for (const sl of clip.page.slots) { if (sl.item && (frame = frameFor(hub, sl.item, c.shotlib))) break; }
    }
    const from = clip ? [plain(clip.channel), series ? plain(series.name || series.title) : ''].filter(Boolean).join(' · ')
      : vlog ? [plain(vlog.title), plain(t.cad).split(' · ').slice(1).join(' · ')].filter(Boolean).join(' · ')
      : plain(t.cad && t.cad !== 'One-off' && t.cad !== 'Daily' ? t.cad : '');
    shoots.push({
      id: t.id, time: timeLabel(t.at), at: t.at || '', title: plain(t.title) || 'Untitled', from,
      video: clip ? plain(clip.title) : '', hook: clip ? plain(clip.hook) : '',
      mins: +t.mins || 0, total: shots.length, taken: shots.filter(s => s.done).length,
      shots: shots.map(s => s.name), frame, done: t.view === 'done'
    });
  }
  shoots.sort(byClock);

  const left = today.filter(x => !x.done && !x.skipped);
  return {
    iso, date: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    dayNo, weekNo, dayLabel, pre: dayNo < 1, name,
    today, openPast, week, workout, habits, due, shoots,
    habitTasks: todays.filter(t => t.habitId).map(item),
    counts: { today: today.length, left: left.length, shoots: shoots.length,
              shots: shoots.reduce((n, s) => n + s.total, 0), posting: dueClips.filter(x => midnight(x.scheduledAt) === t0).length }
  };
}

module.exports = { build, frameFor, plain, timeLabel, isoOf, fromISO };
