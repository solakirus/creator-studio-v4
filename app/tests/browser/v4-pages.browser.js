/* Browser test: shoot mode across a task's pages and on to the next task.

   A shoot task with its shot page (3 shots) and a second page kept beside it
   (2 shots), and another shoot task later today. Shoot mode shows
   "Page 1 of 2", › past the last shot goes on to page 2 and ‹ comes back;
   finishing page 1 offers Next page, which opens page 2 on its first shot not
   taken; ticks on page 2 land on that page; finishing it offers the next
   shoot task, which opens in its place; ⏭ Next task is there all along.
   From the task screen on page 2, Shoot mode starts on page 2. A clip with
   two pages does the same through its host. Phone size.

     node app/tests/browser/v4-pages.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(url); await p.waitForFunction(() => window.App && window.ShootRun && window.Notebook, null, { timeout: 15000 });
  await p.waitForTimeout(800);

  head('a task with two pages, and another one later today');
  const ids = await p.evaluate(async () => {
    const mk = (name, names) => { const P = Notebook.stepsPage(name); P.name = name; P.slots = names.map(n => ({ item:'', tone:'', text:n, role:'Action', done:false })); return P; };
    const day = await Data.todayDay();
    const a = { id: 9001, title: 'Morning shoot', day, at: '07:00', kind: 'shoot', view: 'todo', cad: 'One-off', pri: 'med', subs: [],
      page: mk('Shot sequence · Morning', ['Alarm off', 'Curtains', 'Kettle']), morePages: [mk('Coffee close-ups', ['Pour', 'First sip'])] };
    TaskPages.match(a);
    const c = { id: 9002, title: 'Gym shoot', day, at: '18:00', kind: 'shoot', view: 'todo', cad: 'One-off', pri: 'med', subs: [],
      page: mk('Shot sequence · Gym', ['Walk in', 'First set']) };
    TaskPages.match(c);
    await Store.put('tasks', a); await Store.put('tasks', c); Data.invalidate('tasks');
    return { a: a.id, c: c.id };
  });
  const T = id => p.evaluate(id => Store.get('tasks', id), id);
  const S = () => p.evaluate(() => ({ n: (document.querySelector('.sr-n') || {}).textContent, pages: ((document.querySelector('.sr-pages span') || {}).textContent || '').trim(),
    t: (document.querySelector('.sr-t') || {}).textContent, ttl: (document.querySelector('.sr-ttl') || {}).textContent, all: !!document.querySelector('.sr-all'),
    next: ((document.querySelector('.sr-next') || {}).textContent || '').trim(), skip: !!document.querySelector('.sr-top [data-nexttask]') }));

  await p.evaluate(id => Screens.push('shoot-run', { id }), ids.a); await p.waitForTimeout(900);
  let s = await S();
  ok(s.pages === 'Page 1 of 2 · Shot sequence · Morning' && s.n === '1 / 3', 'shoot mode says which page, and how many', s.pages);
  ok(s.skip, '⏭ Next task is up top');
  await p.click('[data-next]'); await p.waitForTimeout(300); await p.click('[data-next]'); await p.waitForTimeout(400);
  s = await S();
  ok(/Up next · 1\. Alarm off · › for Coffee close-ups/.test(s.next), 'on a page\'s last shot it says › goes to the next page', s.next);
  await p.click('[data-next]'); await p.waitForTimeout(500);
  s = await S();
  ok(s.pages.startsWith('Page 2 of 2') && s.t === 'Pour' && s.n === '1 / 2', '› past the last shot goes on to page 2', `${s.pages} · ${s.t}`);
  await p.click('[data-prev]'); await p.waitForTimeout(500);
  s = await S();
  ok(s.pages.startsWith('Page 1 of 2') && s.t === 'Kettle', '‹ from page 2\'s first shot comes back to page 1\'s last', s.t);

  await p.evaluate(async id => { const t = await Store.get('tasks', id); t.subs.forEach(x => { if(x.shot < 2) x.done = true; }); await Store.put('tasks', t); }, ids.a);
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);
  await p.evaluate(id => Screens.push('shoot-run', { id }), ids.a); await p.waitForTimeout(900);
  s = await S();
  ok(s.t === 'Kettle' && /Then the next page · Coffee close-ups/.test(s.next), 'the last shot left on a page: next comes the next page', s.next);
  await p.evaluate(async id => { const t = await Store.get('tasks', id); t.subs.forEach(x => { x.done = false; }); t.page.slots.forEach(x => { x.done = false; }); await Store.put('tasks', t); }, ids.a);
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);
  await p.evaluate(id => Screens.push('shoot-run', { id }), ids.a); await p.waitForTimeout(900);

  head('finish page 1, then Next page');
  await p.click('[data-pgprev]').catch(() => {}); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.sr-dots i[data-go="0"]').click()); await p.waitForTimeout(300);
  for(let k = 0; k < 3; k++){ await p.click('[data-got]'); await p.waitForTimeout(500); }
  s = await S();
  const card = await p.evaluate(() => [...document.querySelectorAll('.sr-all button')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(s.all && /Next page →Coffee close-ups · 2 to take/.test(card[0]) && card.some(x => /Next shoot task →Gym shoot/.test(x)), 'page 1 done: Next page first, then the next shoot task', card.join(' | '));
  let t = await T(ids.a);
  ok(t.subs.every(x => x.done) && t.view === 'done', 'page 1\'s ticks are the task\'s steps, as before');
  await p.click('[data-nextpage]'); await p.waitForTimeout(500);
  s = await S();
  ok(!s.all && s.pages.startsWith('Page 2 of 2') && s.t === 'Pour', 'Next page opens page 2 on its first shot not taken');
  await p.click('[data-got]'); await p.waitForTimeout(500);
  t = await T(ids.a);
  ok(t.morePages[0].slots[0].done === true && t.morePages[0].slots[1].done === false, 'a tick on page 2 lands on that page');
  await p.click('[data-got]'); await p.waitForTimeout(500);
  s = await S();
  const card2 = await p.evaluate(() => [...document.querySelectorAll('.sr-all button')].map(x => x.className + ':' + x.textContent.replace(/\s+/g, ' ').trim()));
  ok(s.all && /^sr-go:Next shoot task →Gym shoot/.test(card2[0]) && !card2.some(x => /Next page/.test(x)), 'everything done: the next shoot task comes first', card2.join(' | '));
  await p.screenshot({ path: path.join(out, 'pages-done.png') });
  await p.click('.sr-all [data-nexttask]'); await p.waitForTimeout(1200);
  s = await S();
  ok(s.ttl === 'Gym shoot' && s.n === '1 / 2' && !s.pages, 'Next shoot task opens it in shoot mode', s.ttl);
  ok(await p.evaluate(() => document.querySelectorAll('.sr-screen').length) === 1, 'in place of the last one, not on top of it');
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(500);

  head('from the task screen on page 2');
  await p.evaluate(async id => { const t = await Store.get('tasks', id); t.morePages[0].slots.forEach(x => x.done = false); t.hideDone = false; await Store.put('tasks', t); }, ids.a);
  await p.evaluate(id => Screens.push('task', { id }), ids.a); await p.waitForTimeout(1500);
  await p.click('.screen:last-child [data-pg="1"]'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !!document.querySelector('.screen:last-child [data-a="shootmode"]')), 'Shoot mode is offered on page 2 too');
  await p.click('.screen:last-child [data-a="shootmode"]'); await p.waitForTimeout(900);
  s = await S();
  ok(s.pages.startsWith('Page 2 of 2') && s.t === 'Pour', 'and starts on page 2', s.pages);
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);

  head('a clip with two pages');
  const cid = await p.evaluate(async () => {
    const c = await Data.saveClip({ title: 'Two-page clip', state: 'raw', stage: 'planned', shotList: [{ text: 'Wide' }, { text: 'Close' }] });
    const h = ShotList.hostClip(c.id); const t = await h.load();
    const P = Notebook.stepsPage('B-roll page'); P.name = 'B-roll page'; P.slots = [{ item:'', tone:'', text:'Hands', role:'Insert', done:false }];
    t.morePages = [P]; await h.save(t); return c.id;
  });
  await p.evaluate(id => Screens.push('shoot-run', { host: ShotList.hostClip(id) }), cid); await p.waitForTimeout(900);
  await p.click('[data-pgnext]'); await p.waitForTimeout(500);
  s = await S();
  ok(s.pages === 'Page 2 of 2 · B-roll page' && s.t === 'Hands', 'the clip\'s pages page the same way');
  await p.click('[data-got]'); await p.waitForTimeout(700);
  const c = await p.evaluate(id => Store.get('clips', id), cid);
  ok(c.morePages[0].slots[0].done === true, 'and the tick is kept on the clip');
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(300);

  head('errors');
  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
