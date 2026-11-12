/* Browser test: a task's shot page.

   Opens a task with one step, checks the Shot list and Required coverage
   sections are gone, links the nine-shot "Task sequence Â· steps" page from
   the Steps dropdown, checks the step got shot 1, adds the unused shots as
   steps, ticks shots from the list and from the page, hides and shows done
   shots, adds a step with a chosen shot, and opens the page editor.

     node app/tests/browser/taskpage.browser.js <out folder> */
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');
const out = path.resolve(process.argv[2] || '.');
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  /* v4: the laptop (window.CS3Lib, the Electron bridge) — where an empty
     picture spot still picks from the Library */
  await p.addInitScript(() => { if(!window.CS3Lib) window.CS3Lib = { home: async () => '/x', scan: async () => ({ items: [], pages: [], roots: [], errors: [] }),
    pickFolder: async () => null, open: async () => {}, trash: async () => ({}), boardFolder: async () => ({}), shotline: async () => null,
    grabFind: async () => ({ root: 'built in', setUp: true, node: true, builtin: true, ytdlp: true, ffmpeg: true, out: '/x' }),
    grabRun: async () => ({}), grabStop: async () => {}, onGrab: () => () => {} }; });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/'));
  await p.waitForTimeout(1500);
  const shot = async n => { await p.waitForTimeout(700); await p.screenshot({ path: path.join(out, n + '.png') }); };
  const ok = (c, l) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
  const task = () => p.evaluate(async () => Store.get('tasks', 9901));

  await p.evaluate(async () => {
    await ShotTemplates.all();
    await Store.put('tasks', { id: 9901, day: await Data.currentDay(), title: 'Workout', cad: 'One-off', pri: 'med', mins: 0, prog: '', at: null,
      view: 'todo', subs: [{ t: 'Jumping', done: false }], shots: [{ id: 'sh_x', text: 'Jumping', note: '', angles: [] }] });
    Data.invalidate('tasks');
    Screens.push('task', { id: 9901 });
  });
  await p.waitForTimeout(1200);
  const heads = await p.evaluate(() => [...document.querySelectorAll('.block h4')].map(h => h.textContent.trim().toLowerCase()));
  ok(!heads.some(h => h.startsWith('shot list')), 'no Shot list section');
  ok(!heads.some(h => h.startsWith('required coverage')), 'no Required coverage section');
  ok(heads.some(h => h.startsWith('steps')), 'Steps section is there');
  ok(!(await p.$('[data-tostep]')), 'no "add to shot list" button on steps');
  await shot('taskpage-1-before');

  /* no picking: opening the task put the nine-shot task sequence on it */
  let t = await task();
  ok(t.page && t.page.layout === 'steps' && t.page.slots.length === 9, 'task sequence linked by itself on open (9 shots)');
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-pagepick] option')].some(x => /Task shot sequence/.test(x.textContent) && /9 shots/.test(x.textContent))),
    'Change page still offers the task sequence');
  ok(t.subs.length === 10 && t.subs.slice(0, 9).every((s, i) => s.shot === i && s.t === t.page.slots[i].text), 'the steps are the page’s 9 shots, same names, same order');
  ok(t.subs[9].t === 'Jumping' && t.subs[9].shot == null, 'the older step stays, after the shots, not on the page');
  ok(await p.evaluate(() => /Not on the page/.test(document.querySelector('.tks-other')?.textContent || '')), 'older steps are marked "Not on the page"');
  ok(!(await p.$('#newstep')), 'no free "Add a step" box when the steps are the page');
  ok(!!(await p.$('[data-pagecanvas]')), 'page preview drawn');
  await shot('taskpage-2-linked');

  ok(await p.evaluate(() => { const l = document.querySelector('.tkp-left'), r = document.querySelector('.tkp-right'); return l && r && r.getBoundingClientRect().left > l.getBoundingClientRect().right - 1; }), 'steps on the left, shot page on the right');
  ok(!(await p.isVisible('[data-a="unpage"]')), 'extra page buttons are tucked in the More menu');
  ok(!(await p.$('[data-a="fillsteps"]')), 'no "add the unused shots" button: every shot is a step');

  /* only a shot's box ticks it: clicking its name edits the name */
  await p.click('[data-ps="0"] .tk-name');
  await p.waitForTimeout(400);
  t = await task();
  ok(!t.subs[0].done, 'clicking a step’s name does not tick it');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.dataset.pf === 'text:0'), 'clicking a step’s name lets you type in it');
  await p.click('[data-tick="0"]');
  await p.waitForTimeout(600);
  t = await task();
  ok(t.subs[0].done && t.page.slots[0].done, 'ticking step 1’s box ticks shot 1 on the page');
  ok(!(await p.$('[data-ps="0"]')), 'done shot is cleared from the list');
  ok(await p.evaluate(() => document.querySelector('.tk-next')?.dataset.ps === '1'), 'next shot (2) is highlighted');

  /* the page in the task works as in the editor */
  const spotXY = key => p.evaluate(k => { const sp = Notebook.textSpots({ layout:'steps', slots:new Array(9).fill({}) }).find(s => s.key === k); return [(sp.r[0] + sp.r[2]) / 2, (sp.r[1] + sp.r[3]) / 2]; }, key);
  const clickPage = async xy => { await p.$eval('[data-pagecanvas]', c => c.scrollIntoView({ block:'center' })); await p.waitForTimeout(200); const box = await (await p.$('[data-pagecanvas]')).boundingBox(); await p.mouse.click(box.x + xy[0] / 720 * box.width, box.y + xy[1] / 900 * box.height); };
  const pic = await p.evaluate(() => { const [r] = Notebook.stepCells(9)[1]; return [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; });
  await clickPage(pic);
  await p.waitForTimeout(900);
  t = await task();
  ok(!t.subs[1].done && !!(await p.$('.lv-picker')), 'on the laptop, clicking an empty picture spot picks a shot from the Library (no tick)');
  if (await p.$('.lv-picker [data-close]')) { await p.click('.lv-picker [data-close]'); await p.waitForTimeout(400); }
  await clickPage(await spotXY('step:4'));
  await p.waitForTimeout(500);
  ok(await p.isVisible('.tkp-cwrap .pe-edit textarea'), 'clicking a shot’s words on the page lets you type over them');
  await p.fill('.tkp-cwrap .pe-edit textarea', 'Close: the goggles');
  await p.press('.tkp-cwrap .pe-edit textarea', 'Enter');
  await p.waitForTimeout(700);
  t = await task();
  ok(t.page.slots[4].text === 'Close: the goggles' && t.subs[4].t === 'Close: the goggles' && !t.subs[4].done, 'typing on the page renames the step, without ticking it');
  await clickPage(await spotXY('done:1'));
  await p.waitForTimeout(700);
  t = await task();
  ok(t.subs[1].done && t.page.slots[1].done, 'ticking shot 2’s box on the page ticks its step');
  ok(await p.evaluate(() => /^2\/9$/.test(document.querySelector('.tkp-count').textContent)), 'progress reads 2/9');
  await shot('taskpage-3-ticked');

  await p.click('.tk-hidden');
  await p.waitForTimeout(500);
  ok(!!(await p.$('[data-ps="0"]')), 'Show brings done shots back');
  await p.click('.tkp-menu > summary');
  await p.click('[data-a="hidedone"]');
  await p.waitForTimeout(500);

  /* everything the shots section did now happens in the steps */
  const heads2 = await p.evaluate(() => [...document.querySelectorAll('.block h4')].map(h => h.textContent.trim()));
  ok(!heads2.some(h => /^Shots on the page/.test(h)), 'no separate "Shots on the page" section');
  await p.fill('[data-pf="text:2"]', 'Wide: the jump');
  await p.press('[data-pf="text:2"]', 'Enter');
  await p.waitForTimeout(600);
  t = await task();
  ok(t.page.slots[2].text === 'Wide: the jump' && t.subs[2].t === 'Wide: the jump', 'renaming a step renames the shot on the page');
  await p.selectOption('[data-pf="role:2"]', 'Talking');
  await p.waitForTimeout(600);
  await p.click('[data-pf="text:2"]');
  await p.fill('[data-pf="note:2"]', 'from the diving board');
  await p.press('[data-pf="note:2"]', 'Enter');
  await p.waitForTimeout(600);
  t = await task();
  ok(t.page.slots[2].role === 'Talking' && t.subs[2].note === 'from the diving board', 'type (clicked on the tag) and note saved');
  await shot('taskpage-3b-shots');
  await p.click('[data-psmv="up:2"]');
  await p.waitForTimeout(600);
  t = await task();
  ok(t.page.slots[1].text === 'Wide: the jump' && t.subs[1].t === 'Wide: the jump' && t.subs[2].done && t.page.slots[2].done && !t.subs[1].done,
    'moving a shot up moves its step, and the tick stays with its shot');
  await p.click('[data-a="psadd"]');
  await p.waitForTimeout(600);
  await p.fill('[data-pf="text:9"]', 'Bonus underwater');
  await p.press('[data-pf="text:9"]', 'Enter');
  await p.waitForTimeout(600);
  t = await task();
  ok(t.page.slots.length === 10 && t.subs[9].t === 'Bonus underwater' && t.subs[9].shot === 9 && t.subs[10].t === 'Jumping', 'adding a shot adds a step');
  await p.click('[data-psdel="9"]');
  await p.waitForTimeout(600);
  t = await task();
  ok(t.page.slots.length === 9 && t.subs.length === 10 && !t.subs.some(s => s.t === 'Bonus underwater'), 'removing a shot removes its step');

  await p.click('[data-a="openpage"]');
  await p.waitForTimeout(1500);
  ok(!!(await p.$('.pe-page')), 'the page opens in the notebook editor');
  ok(!(await p.$('[data-target]')), 'no Library-target button on a task page');
  await shot('taskpage-4-editor');

  /* add a second page to the task from the full view */
  await p.click('details.lv-menu > summary');
  await p.click('[data-add="0"]');
  await p.waitForTimeout(900);
  t = await task();
  ok(t.morePages && t.morePages.length === 1 && t.page.slots.length === 9, 'a second page is kept with the task, the shot page stays');
  ok(await p.evaluate(() => document.querySelectorAll('.pe-thumb').length === 2 && !!document.querySelector('.pe-thumb.lock')), 'the full view shows both pages, shot page marked');
  await p.click('.pe-thumb.lock');
  await p.waitForTimeout(500);
  ok(!(await p.$('[data-del]')), 'the shot page cannot be deleted from here');

  /* back on the task: arrows slide to the second page, with its own steps */
  await p.evaluate(() => Screens.pop());
  await p.waitForTimeout(1200);
  ok(await p.evaluate(() => /Page 1 of 2/.test(document.querySelector('.tkp-navmid small')?.textContent || '')), 'the task shows arrows: page 1 of 2');
  await p.click('.tkp-arrow[aria-label="Next page"]');
  await p.waitForTimeout(900);
  const second = await p.evaluate(() => ({ nav: document.querySelector('.tkp-navmid small')?.textContent || '', rows: document.querySelectorAll('[data-ps]').length, canvas: !!document.querySelector('[data-pagecanvas]') }));
  t = await task();
  ok(/Page 2 of 2/.test(second.nav) && second.canvas && second.rows === (t.morePages[0].slots || []).length, 'the arrow slides to page 2, with its page and its own steps');
  await shot('taskpage-4b-page2');
  if (second.rows) {
    const before = t.subs.filter(s => s.done).length;
    await p.click('[data-tick="0"]');
    await p.waitForTimeout(600);
    t = await task();
    ok(t.morePages[0].slots[0].done && t.subs.filter(s => s.done).length === before, 'ticking a step on page 2 ticks that page only');
  }
  await p.click('.tkp-arrow[aria-label="Previous page"]');
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => /Page 1 of 2/.test(document.querySelector('.tkp-navmid small')?.textContent || '')), 'the other arrow slides back');

  /* new tasks start with the task sequence; a removed page stays removed */
  const fresh = await p.evaluate(async () => {
    const a = await QuickAdd.add({ title: 'Swim' });
    const b = await QuickAdd.add({ title: 'Edit', subs: [{ t: 'Rough cut', done: false }] });
    return [a, b].map(x => ({ id: x.id, n: x.page && x.page.slots.length, subs: x.subs.length, shot0: x.subs[0] && x.subs[0].shot, name: x.page && x.page.name }));
  });
  ok(fresh[0].n === 9 && fresh[0].subs === 9 && fresh[0].name === 'Shot sequence · Swim', 'a new task with no steps gets the 9 shots as steps');
  ok(fresh[1].n === 9 && fresh[1].subs === 10 && fresh[1].shot0 === 0, 'a new task with steps gets the 9 shots as steps and keeps its own after them');
  await p.evaluate(id => Screens.push('task', { id }), fresh[0].id);
  await p.waitForTimeout(1200);
  await p.locator('.tkp-menu > summary').last().click();
  await p.locator('[data-a="unpage"]').last().click();
  await p.waitForTimeout(300);
  await p.click('[data-yes]');
  await p.waitForTimeout(600);
  await p.evaluate(id => { Screens.pop(); Screens.push('task', { id }); }, fresh[0].id);
  await p.waitForTimeout(1200);
  const off = await p.evaluate(id => Store.get('tasks', id), fresh[0].id);
  ok(!off.page && off.pageOff === true, 'removing the page keeps it off when the task opens again');

  /* Today: the task card opens its pages */
  await p.goto('file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/'));
  await p.waitForTimeout(1800);
  /* v4: a task with a shot page gets one chip — shoot mode — and its pages
     are under its steps ("Open the full 2 pages") */
  const chip = await p.$('.mediacard[data-id="9901"] .tshoot');
  ok(!!chip && /shoot/.test(await chip.textContent()), 'Today card has the shoot chip for its shot page');
  await shot('taskpage-5-today');
  if (chip) { await chip.click(); await p.waitForTimeout(1200); }
  ok(!!(await p.$('.sr-screen .sr')), 'tapping it opens shoot mode');
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(600);
  await p.click('.mediacard[data-id="9901"] .steps'); await p.waitForTimeout(500);
  const full = await p.$('.subs-page[data-pages="9901"]');
  ok(!!full && /2 pages/.test(await full.textContent()), 'its steps open to "Open the full 2 pages"');
  if (full) { await full.click(); await p.waitForTimeout(1500); }
  ok(await p.evaluate(() => document.querySelectorAll('.pe-thumb').length === 2), 'which opens the full pages');
  await shot('taskpage-6-frommenu');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})();
