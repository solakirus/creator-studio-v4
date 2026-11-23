/* Browser test: the voice — today's briefing read out loud (23 Nov 2026).

   js/voice.js builds a briefing from your data (the day, what's left and
   what's next, habits, last week's leftovers, filming, workout, videos posting
   today / missed / this week, editing, the next shoot) and speaks it through
   the CSSpeak plugin on the phone or speechSynthesis elsewhere. Today has a
   speaker button beside the day's arrows; Settings has a Voice section.

     node app/tests/browser/v4-voice.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true,
    args: ['--allow-file-access-from-files', '--no-sandbox', '--disable-component-update'] });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });
  /* a phone with the CSSpeak plugin, recording what it is asked to say */
  await ctx.addInitScript(() => {
    localStorage.setItem('cs4:voice', JSON.stringify({ morning: false }));
    window.__sp = { said: [], stops: 0, listeners: {} };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
      CSSpeak: {
        speak: async (o) => { window.__sp.said.push(o); },
        stop: async () => { window.__sp.stops++; },
        available: async () => ({ ready: true }),
        addListener: (n, fn) => { window.__sp.listeners[n] = fn; return Promise.resolve({ remove(){} }); },
      } } };
  });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(url); await p.waitForFunction(() => window.App && window.Voice && window.Widget, null, { timeout: 20000 });
  await p.waitForTimeout(800);

  await p.evaluate(async () => {
    const day = await Data.currentDay();
    const at = h => { const d = new Date(); d.setHours(h, 0, 0, 0); return d; };
    const hm = d => String(d.getHours()).padStart(2, '0') + ':00';
    const later = new Date(Math.min(Date.now() + 2 * 3600000, at(23).getTime()));
    await Store.put('settings', 'Kris Catten', 'name');
    await Store.put('tasks', { id: 701, day, title: 'Call the doctor 📞', at: hm(later), view: 'todo', subs: [] });
    await Store.put('tasks', { id: 702, day, title: 'Film the opener — kitchen', kind: 'shoot', view: 'todo', subs: [],
      page: { slots: [{ done: true }, { done: false }, { done: false }] } });
    await Store.put('tasks', { id: 703, day, title: 'Edit Clip 12', kind: 'edit', view: 'done', subs: [] });
    await Store.put('tasks', { id: 704, day, title: 'Drink water', habitId: 'h1', view: 'todo', subs: [] });
    await Store.put('tasks', { id: 705, day: day - 2, title: 'Clean the gutters', view: 'todo', subs: [] });
    await Store.put('tasks', { id: 706, day: day - 30, title: 'Ancient thing', view: 'todo', subs: [] });
    await Store.put('tasks', { id: 707, day: day + 1, title: 'Tomorrow thing', view: 'todo', subs: [] });
    const today = new Date(); today.setHours(18, 0, 0, 0);
    await Data.saveClip({ id: 'c1', title: 'Datacenter tour', stage: 'editing', scheduledAt: today.getTime(), plan: {} });
    await Data.saveClip({ id: 'c2', title: 'Morning routine', stage: 'shot', scheduledAt: today.getTime() + 3 * 86400000, plan: {} });
    await Data.saveClip({ id: 'c3', title: 'Old post', stage: 'planned', scheduledAt: today.getTime() - 2 * 86400000, plan: {} });
    await Data.saveClip({ id: 'c4', title: 'Already out', stage: 'published', scheduledAt: today.getTime() - 86400000, plan: {} });
    Data.invalidate();
  });

  console.log('\n— the words —');
  const text = await p.evaluate(() => Voice.briefing());
  console.log('     ' + text);
  ok(/^Good (morning|afternoon|evening), Kris\./.test(text), 'greets by first name');
  ok(/Day -?\d+, week -?\d+\.|program starts/.test(text), 'says the day and week');
  ok(/two things left to do today, and one already done/.test(text), 'counts what is left and done (habits apart)');
  ok(/Next up: .*Call the doctor at \d{1,2}( |:\d\d )?[AP]M/.test(text) && !/📞/.test(text), 'next up, with the time, emoji gone');
  ok(/One habit to tick off/.test(text), 'habits counted on their own');
  ok(/One task from earlier this week is still open: Clean the gutters\./.test(text) && !/Ancient/.test(text), 'last week\'s leftover, not last month\'s');
  ok(/On camera today: Film the opener, kitchen, one of 3 shots done\./.test(text), 'filming with shots got');
  ok(/Datacenter tour is set to post today — it's in editing\./.test(text), 'posting today, with its stage');
  ok(/Old post missed its post date/.test(text) && !/Already out/.test(text), 'missed post named; published ones left out');
  ok(/Posting this week: Morning routine on \w+day\./.test(text), 'coming up this week');
  ok(/One video in editing and one shot and waiting to be edited\./.test(text), 'editing and waiting counts');
  ok(!/Tomorrow thing/.test(text), 'tomorrow\'s tasks not read as today\'s');
  ok(!/undefined|NaN|null/.test(text), 'no undefined / NaN in the words');

  console.log('\n— the button on Today —');
  const btn = await p.$('.voicebtn');
  ok(!!btn, 'speaker button beside the day arrows');
  await p.screenshot({ path: path.join(out, 'voice-today.png') });
  await btn.click(); await p.waitForTimeout(500);
  let sp = await p.evaluate(() => window.__sp);
  ok(sp.said.length === 1 && /Good (morning|afternoon|evening)/.test(sp.said[0].text) && sp.said[0].rate === 1, 'tap reads the briefing through the phone\'s voice');
  ok(await p.evaluate(() => document.querySelector('.voicebtn').classList.contains('on')), 'button shows it is talking');
  await p.click('.voicebtn'); await p.waitForTimeout(200);
  sp = await p.evaluate(() => window.__sp);
  ok(sp.said.length === 1 && sp.stops >= 2, 'second tap stops it');
  ok(await p.evaluate(() => !document.querySelector('.voicebtn').classList.contains('on')), 'button back to the speaker');
  await p.click('.voicebtn'); await p.waitForTimeout(400);
  await p.evaluate(() => window.__sp.listeners.speakDone && window.__sp.listeners.speakDone({}));
  await p.waitForTimeout(100);
  ok(await p.evaluate(() => !document.querySelector('.voicebtn').classList.contains('on')), 'speakDone from the phone resets the button');

  console.log('\n— Settings → Voice —');
  await p.evaluate(() => Screens.push('settings')); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!document.querySelector('[data-go="voicebrief"]') && !!document.querySelector('[data-voicemorning]')), 'Voice section with Play and the morning switch');
  await p.click('[data-vrate="1.15"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => Voice.prefs().rate === 1.15 && window.__sp.said.slice(-1)[0].rate === 1.15), 'Fast saved and heard at that speed');
  await p.click('[data-voicemorning]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => Voice.prefs().morning === true), 'morning switch saved');
  const sec = await p.$('[data-go="voicebrief"]'); await sec.scrollIntoViewIfNeeded();
  await p.screenshot({ path: path.join(out, 'voice-settings.png') });

  console.log('\n— morning read-out —');
  const auto = await p.evaluate(async () => {
    localStorage.setItem('cs4:voice', JSON.stringify({ morning: true, rate: 1, lastAuto: '' }));
    const before = window.__sp.said.length;
    const h = new Date().getHours();
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r => setTimeout(r, 3200));
    const after1 = window.__sp.said.length;
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r => setTimeout(r, 3200));
    return { h, first: after1 - before, second: window.__sp.said.length - after1 };
  });
  if(auto.h >= 4 && auto.h < 12) ok(auto.first === 1 && auto.second === 0, 'reads once in the morning, not again that day', JSON.stringify(auto));
  else ok(auto.first === 0, 'outside the morning it stays quiet', JSON.stringify(auto));

  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
