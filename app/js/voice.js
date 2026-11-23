/* Voice — the app reads your day out loud (23 Nov 2026).

   Voice.brief()      says today's briefing: the day and week, what's left on
                      the list and what's next, habits, anything still open
                      from the past week, what's being filmed, the workout,
                      meal prep, and the videos — posting today, missed, coming
                      up this week, in editing — and the next shoot day.
   Voice.briefing()   the same as text, without speaking (tests, the preview).
   Voice.speak(text)  / Voice.stop() / Voice.toggle() / Voice.speaking()
   Voice.onChange(fn) told when speech starts and stops (the Today button).

   Where the voice comes from:
     phone     the CSSpeak plugin (native/CSSpeakPlugin.java) — Android's own
               text-to-speech. Offline, free, no key. Needs an APK built on or
               after 23 Nov 2026; an older APK falls back to the browser voice,
               which an Android WebView often doesn't have, so it says so.
     laptop    the browser's speechSynthesis — Windows' own voices in the
               Electron app; on Linux it goes through speech-dispatcher.
     iPad      Safari's speechSynthesis.

   The words are built from your data with plain rules, not AI, so they are
   instant and the same every time.

   Settings → Voice (per device, kept in localStorage 'cs4:voice').
   Nothing talks unless you ask it to (23 Nov 2026, v:2):
     on        the main switch. Off: the app never talks and the speaker
               buttons go away. Default on — on its own it only speaks when
               you tap a speaker.
     morning   read the briefing the first time the app opens each day,
               before noon. Default OFF. Phone only: a browser won't talk
               until you tap.
     calls     shoot mode: 'off' · 'tap' (default — tap 🔊 to hear the shot
               you're on) · 'auto' (says each shot by itself)
     rate      0.85 · 1 · 1.15
   Prefs saved before v:2 had morning and callouts on by default; those two
   are dropped so nothing starts talking that you didn't switch on. */
(function(global){

  const KEY = 'cs4:voice';
  const DAY = 86400000;

  /* ---------------------------------------------------------------- prefs */
  function prefs(){
    let p = {};
    try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e){}
    const v2 = p.v === 2;
    return { on: p.on !== false,
             morning: v2 ? !!p.morning : false,
             calls: v2 && ['off', 'tap', 'auto'].includes(p.calls) ? p.calls : 'tap',
             rate: +p.rate || 1, lastAuto: p.lastAuto || '' };
  }
  function setPrefs(patch){
    const p = { ...prefs(), ...patch, v: 2 };
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch(e){}
    return p;
  }

  /* ---------------------------------------------------------------- engine */
  const plugin = () =>
    (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.CSSpeak) || null;
  const webSpeech = () => ('speechSynthesis' in global) && typeof global.SpeechSynthesisUtterance === 'function';
  const available = () => !!plugin() || webSpeech();
  /* there is a voice on this device and you've left it switched on */
  const enabled = () => available() && prefs().on;
  const isNative = () => !!plugin();

  let talking = false;
  const listeners = new Set();
  function setTalking(v){
    if(talking === v) return;
    talking = v;
    listeners.forEach(fn => { try { fn(v); } catch(e){} });
  }
  const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  const speaking = () => talking;

  /* the native side tells us when it has finished */
  (function listen(){
    const p = plugin();
    if(!p || !p.addListener) return;
    try {
      p.addListener('speakDone', () => setTalking(false));
      p.addListener('speakError', () => setTalking(false));
    } catch(e){}
  })();

  /* A voice that sounds like a person where there is one: Windows' "Natural"
     voices and Google's are far better than the robotic defaults. */
  function pickVoice(){
    if(!webSpeech()) return null;
    const vs = global.speechSynthesis.getVoices() || [];
    const en = vs.filter(v => /^en(-|_|$)/i.test(v.lang || ''));
    const pool = en.length ? en : vs;
    const rank = v => {
      const n = v.name || '';
      let s = 0;
      if(/natural|neural|online/i.test(n)) s += 6;
      if(/google/i.test(n)) s += 4;
      if(/aria|jenny|guy|davis|andrew|samantha|alex/i.test(n)) s += 2;
      if(/en[-_]US/i.test(v.lang || '')) s += 1;
      if(v.localService === false) s += 1;
      return s;
    };
    return pool.slice().sort((a, b) => rank(b) - rank(a))[0] || null;
  }
  /* voices load late in Chromium; asking once early warms the list */
  try { if(webSpeech()) { global.speechSynthesis.getVoices(); global.speechSynthesis.onvoiceschanged = () => {}; } } catch(e){}

  /* Long text in one utterance gets cut off in Chromium after ~15 seconds, so
     it goes a sentence or two at a time. */
  function chunks(text){
    const parts = String(text).match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [String(text)];
    const out = [];
    let cur = '';
    parts.forEach(s => {
      if((cur + s).length > 220 && cur){ out.push(cur.trim()); cur = ''; }
      cur += s;
    });
    if(cur.trim()) out.push(cur.trim());
    return out;
  }

  async function speak(text){
    text = String(text || '').trim();
    if(!text || !prefs().on) return false;
    await stop();
    const rate = prefs().rate;
    const p = plugin();
    if(p && p.speak){
      try {
        setTalking(true);
        await p.speak({ text, rate });
        return true;
      } catch(e){
        setTalking(false);
        console.warn('Voice: native speech failed', e);
        if(!webSpeech()){ toast('Couldn\'t start the phone\'s voice — check Text-to-speech in Android settings'); return false; }
      }
    }
    if(!webSpeech()){
      toast(global.Capacitor ? 'Voice needs the newest APK — rebuild with build.bat' : 'This browser can\'t speak');
      return false;
    }
    const synth = global.speechSynthesis;
    const voice = pickVoice();
    const list = chunks(text);
    setTalking(true);
    list.forEach((s, i) => {
      const u = new SpeechSynthesisUtterance(s);
      if(voice){ u.voice = voice; u.lang = voice.lang; }
      u.rate = rate;
      if(i === list.length - 1){ u.onend = () => setTalking(false); }
      u.onerror = () => setTalking(false);
      synth.speak(u);
    });
    return true;
  }

  async function stop(){
    const p = plugin();
    if(p && p.stop){ try { await p.stop(); } catch(e){} }
    if(webSpeech()){ try { global.speechSynthesis.cancel(); } catch(e){} }
    setTalking(false);
  }

  function toast(m){ try { if(global.U && U.toast) U.toast(m); } catch(e){} }

  /* --------------------------------------------------------------- words */
  const pl = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const NUM = ['no','one','two','three','four','five','six','seven','eight','nine','ten'];
  const say = n => n >= 0 && n <= 10 ? NUM[n] : String(n);
  const sayPl = (n, one, many) => `${say(n)} ${n === 1 ? one : (many || one + 's')}`;
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

  /* "and" before the last of a list */
  function listOf(xs){
    xs = xs.filter(Boolean);
    if(xs.length <= 1) return xs[0] || '';
    return xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  }

  /* Titles are read, not shown: emoji, hashtags and stray symbols out. */
  function clean(s){
    return String(s || '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
      .replace(/#/g, '')
      .replace(/\s*[—–|·•]\s*/g, ', ')
      .replace(/&/g, ' and ')
      .replace(/\s+/g, ' ')
      .replace(/^[,\s]+|[,\s]+$/g, '')
      .trim() || 'Untitled';
  }

  /* "14:30" → "2:30 PM", "09:00" → "9 AM" */
  function sayTime(hm){
    const m = /^(\d{1,2}):(\d{2})/.exec(hm || '');
    if(!m) return '';
    let h = +m[1]; const mi = +m[2];
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return mi ? `${h}:${String(mi).padStart(2, '0')} ${ap}` : `${h} ${ap}`;
  }

  function ordinal(n){
    const s = ['th','st','nd','rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  const weekday = ts => new Date(ts).toLocaleDateString('en-US', { weekday:'long' });
  const dateWords = ts => {
    const d = new Date(ts);
    return `${weekday(ts)}, ${d.toLocaleDateString('en-US', { month:'long' })} ${ordinal(d.getDate())}`;
  };
  const midnight = ts => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };

  /* "Monday" for this week, "today", "tomorrow" */
  function whenWords(ts, today){
    const diff = Math.round((midnight(ts) - today) / DAY);
    if(diff === 0) return 'today';
    if(diff === 1) return 'tomorrow';
    if(diff === -1) return 'yesterday';
    if(diff > 1 && diff < 7) return weekday(ts);
    return new Date(ts).toLocaleDateString('en-US', { month:'long', day:'numeric' });
  }

  const STAGE = { idea:'still an idea', planned:'planned but not shot', shot:'shot, waiting for the edit',
                  editing:'in editing', published:'out' };
  const isOut = c => c.stage === 'published' || c.state === 'posted' || !!c.postedAt;

  async function briefing(){
    const lines = [];
    const now = Date.now();
    const today = midnight(now);
    const h = new Date(now).getHours();

    /* ---- hello and the day ---- */
    let name = '';
    try { name = String((await Store.get('settings', 'name')) || '').trim().split(/\s+/)[0] || ''; } catch(e){}
    const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    lines.push(`${hello}${name ? ', ' + name : ''}.`);

    const day = await Data.currentDay();
    if(day > 0) lines.push(`It's ${dateWords(now)}. Day ${day}, week ${Data.weekOf(day)}.`);
    else if(day === 0) lines.push(`It's ${dateWords(now)}. Your program starts tomorrow.`);
    else lines.push(`It's ${dateWords(now)}. ${pl(Math.abs(day) + 1, 'day')} until your program starts.`);

    /* ---- the list ---- */
    const all = await Data.tasks();
    const todays = all.filter(t => t.day === day);
    const habits = todays.filter(t => t.habitId);
    const real = todays.filter(t => !t.habitId);
    const left = real.filter(t => t.view !== 'done' && t.view !== 'skipped');
    const done = real.filter(t => t.view === 'done');

    let snap = null;
    try { snap = global.Widget && Widget.snapshot ? (await Widget.snapshot()).snapshot : null; } catch(e){}

    if(!real.length) lines.push('Nothing is on your to-do list today.');
    else if(!left.length) lines.push(`Everything on today's list is done — all ${say(done.length)}. Nice work.`);
    else {
      lines.push(`You've got ${sayPl(left.length, 'thing')} left to do today` +
        (done.length ? `, and ${say(done.length)} already done.` : '.'));
      /* in the order you'd meet them: timed first by clock, then the rest */
      const byTime = (a, b) => (a.at || '99:99').localeCompare(b.at || '99:99');
      const order = left.slice().sort(byTime);
      const nowHM = new Date(now).toTimeString().slice(0, 5);
      const late = order.filter(t => t.at && t.at < nowHM);
      const up = order.filter(t => !(t.at && t.at < nowHM));
      const one = t => clean(t.title) + (t.at ? ` at ${sayTime(t.at)}` : '');
      const next = up.slice(0, 3);
      if(next.length) lines.push(`Next up: ${listOf(next.map(one))}.`);
      const more = up.length - next.length;
      if(more > 0) lines.push(`Plus ${sayPl(more, 'more')} after that.`);
      if(late.length) lines.push(late.length === 1
        ? `${clean(late[0].title)} was set for ${sayTime(late[0].at)} and isn't ticked yet.`
        : `${cap(sayPl(late.length, 'timed task'))} earlier today aren't ticked yet.`);
    }
    const habitsLeft = habits.filter(t => t.view !== 'done' && t.view !== 'skipped');
    if(habitsLeft.length) lines.push(`${cap(sayPl(habitsLeft.length, 'habit'))} to tick off.`);

    /* ---- still open from the past week ---- */
    const old = all.filter(t => !t.habitId && t.view === 'todo' && typeof t.day === 'number' && t.day < day && t.day >= day - 7);
    if(old.length) lines.push(old.length === 1
      ? `One task from earlier this week is still open: ${clean(old[0].title)}.`
      : `${cap(sayPl(old.length, 'task'))} from earlier this week are still open.`);

    /* ---- filming, workout, meal prep (the same picture the widgets draw) ---- */
    if(snap){
      const film = (snap.filming || []).filter(f => !(f.total && f.got >= f.total));
      if(film.length){
        const f = film[0];
        lines.push(`On camera today: ${clean(f.title)}` +
          (f.total ? `, ${say(f.got)} of ${pl(f.total, 'shot')} done.` : '.') +
          (film.length > 1 ? ` And ${sayPl(film.length - 1, 'more thing')} to film.` : ''));
      }
      const w = snap.workout;
      if(w && !w.done){
        const sub = String(w.sub || '').split(' · ').filter(x => x && x !== w.title).join(', ');
        lines.push(`Workout: ${clean(w.title)}${w.at ? ` at ${sayTime(w.at)}` : ''}${sub ? ', ' + sub : ''}.`);
      }
      if(snap.meals && snap.meals.prep) lines.push(`${clean(snap.meals.prep)}.`);
    }

    /* ---- videos ---- */
    let clips = [];
    try { clips = (await Data.clips()).filter(c => !isOut(c)); } catch(e){}
    const dated = clips.filter(c => c.scheduledAt);
    const postToday = dated.filter(c => midnight(c.scheduledAt) === today);
    const missed = dated.filter(c => midnight(c.scheduledAt) < today);
    const soon = dated.filter(c => { const d = midnight(c.scheduledAt); return d > today && d < today + 7 * DAY; })
      .sort((a, b) => a.scheduledAt - b.scheduledAt);

    postToday.forEach(c => {
      const st = STAGE[c.stage] || '';
      lines.push(`${clean(c.title)} is set to post today${st ? ` — it's ${st}` : ''}.`);
    });
    if(missed.length) lines.push(missed.length === 1
      ? `${clean(missed[0].title)} missed its post date, ${whenWords(missed[0].scheduledAt, today)}, and isn't out yet.`
      : `${cap(sayPl(missed.length, 'video'))} missed their post dates and aren't out yet.`);
    if(soon.length){
      const bits = soon.slice(0, 3).map(c => `${clean(c.title)} ${whenWords(c.scheduledAt, today) === 'tomorrow' ? 'tomorrow' : 'on ' + whenWords(c.scheduledAt, today)}`);
      lines.push(`Posting this week: ${listOf(bits)}${soon.length > 3 ? `, and ${sayPl(soon.length - 3, 'more')}` : ''}.`);
    }
    const editing = clips.filter(c => c.stage === 'editing');
    const shotWaiting = clips.filter(c => c.stage === 'shot');
    if(editing.length || shotWaiting.length){
      const bits = [];
      if(editing.length) bits.push(`${sayPl(editing.length, 'video')} in editing`);
      if(shotWaiting.length) bits.push(`${say(shotWaiting.length)} shot and waiting to be edited`);
      lines.push(cap(listOf(bits)) + '.');
    }

    /* ---- the next shoot day, if it isn't today ---- */
    const filmingToday = left.some(t => t.kind === 'shoot') || (snap && (snap.filming || []).length);
    if(!filmingToday){
      const nextShoot = all.filter(t => t.kind === 'shoot' && t.view === 'todo' && t.day > day && t.day <= day + 7)
        .sort((a, b) => a.day - b.day || (a.at || '99').localeCompare(b.at || '99'))[0];
      if(nextShoot){
        const ts = await Data.dayToDate(nextShoot.day);
        const w = whenWords(ts, today);
        lines.push(`Next shoot is ${w === 'tomorrow' ? 'tomorrow' : 'on ' + w}: ${clean(nextShoot.title)}.`);
      }
    }

    lines.push(h < 17 ? "That's your day. Let's get it." : "That's where things stand.");
    return lines.join(' ');
  }

  async function brief(){
    try { return await speak(await briefing()); }
    catch(e){ console.warn('Voice: briefing failed', e); toast('Couldn\'t put the briefing together'); return false; }
  }

  async function toggle(){
    if(talking){ await stop(); return false; }
    return brief();
  }

  /* ---------------------------------------------------- morning read-out */
  const isoDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  let autoTimer = null;
  function morning(){
    clearTimeout(autoTimer);
    autoTimer = setTimeout(async () => {
      const p = prefs();
      if(!p.on || !p.morning || !isNative() || document.hidden) return;
      const h = new Date().getHours();
      if(h < 4 || h >= 12 || p.lastAuto === isoDay()) return;
      setPrefs({ lastAuto: isoDay() });
      brief();
    }, 2500);   /* after start-up and a sync have had a moment */
  }
  try {
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', morning);
    else morning();
    document.addEventListener('visibilitychange', () => { if(!document.hidden) morning(); else if(talking && !isNative()) stop(); });
  } catch(e){}

  global.Voice = { available, enabled, isNative, speak, stop, toggle, brief, briefing, speaking, onChange,
                   prefs, setPrefs, chunks, sayTime, clean };
})(window);
