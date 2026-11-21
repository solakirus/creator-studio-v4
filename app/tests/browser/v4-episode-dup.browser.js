/* Browser test: picking vlogs to delete or duplicate, and Duplicate episode
   (21 Nov 2026).

   Content → Vlog has a Select button, in the Cards and the List view (holding
   a card still works). The bar
   offers Duplicate and Delete. An episode's Plan has ⧉ Duplicate episode and
   Delete episode at the bottom. A copy keeps the plan — days, sequences,
   scripts, shots, a grabbed reference clip, the cover — with new ids, no
   week, and none of the original's run: done ticks, tasks, scheduled days,
   the edit walkthrough. The original is untouched; deletes land in Recently
   deleted.

     node app/tests/browser/v4-episode-dup.browser.js [outDir] */
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
const top = '.screen:last-child';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for(const [w, h, name] of [[1440, 900, 'laptop'], [400, 860, 'phone']]){
    console.log(`\n— ${name} —`);
    const ctx = await b.newContext(w < 600 ? { viewport: { width: w, height: h }, hasTouch: true, isMobile: true } : { viewport: { width: w, height: h } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForFunction(() => window.App && window.Select && window.Trash, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    await p.evaluate(async () => {
      const wk = await Data.currentWeek();
      await Store.put('ref-clips', { id: 'rc1', url: 'https://youtube.com/watch?v=x', start: 10, end: 20, clip: new Blob(['mp4'], { type: 'video/mp4' }), gif: new Blob(['gif'], { type: 'image/gif' }) });
      await Store.put('art', new Blob(['cover'], { type: 'image/png' }), Cover.key('vlog', 'v1'));
      await Store.put('vlogs', { id: 'v1', title: 'Backyard camp-out', week: wk, monthId: 'm1', format: 'weekly', createdAt: 1,
        editSteps: [{ id: 'import', done: true, at: 5 }],
        acts: [{ id: 'a1', title: 'Saturday', day: 12, open: true, beats: [
          { id: 'b1', title: 'Put up the tent', setup: 'talking', script: 'We pitch it before dark.', done: true, taskId: 40, day: 12, at: '09:00', clipId: 'c9',
            order: ['s2', 's1'],
            shots: [{ id: 's1', text: 'Lay out parts', framing: 'Wide', done: true, vref: { url: 'https://youtube.com/watch?v=x', start: 10, end: 20, clip: 'rc:rc1:clip', gif: 'rc:rc1:gif' } },
                    { id: 's2', text: 'Stake corners', framing: 'Close' }] },
          { id: 'b2', title: 'Campfire', setup: 'talking', shots: [] }] }] });
      await Store.put('vlogs', { id: 'v2', title: 'Garage day', week: wk + 1, format: 'weekly', createdAt: 2, acts: [{ id: 'a9', title: 'Sunday', beats: [] }] });
      await Store.put('tasks', { id: 40, day: 12, title: 'Put up the tent', kind: 'shoot', beatId: 'b1', vlogId: 'v1', view: 'todo', subs: [], cad: '', pri: 'med' });
      Data.invalidate();
      /* the computer picks in the List view (the view picker), the phone in Cards */
      localStorage.setItem('cs4-lay-vlog', innerWidth >= 900 ? 'list' : 'cards');
      App.go('series');
    });
    await p.waitForTimeout(600);
    await p.click('.ctnav [data-v="episodes"]'); await p.waitForTimeout(1000);

    /* the Select button */
    const sel = '[data-a="select"]';
    ok(!!(await p.$(sel)), 'the Vlog list has a Select button');
    if(name === 'laptop') ok(!!(await p.$('[data-lay-host="vlog"].lay-list')), 'in the List view');
    await p.click(sel); await p.waitForTimeout(300);
    const bar0 = await p.evaluate(() => { const b = document.querySelector('.selbar'); return b && { n: b.querySelector('.sb-n').textContent,
      btns: [...b.querySelectorAll('button')].map(x => x.textContent + (x.disabled ? '(off)' : '')) }; });
    ok(bar0 && bar0.n === 'Tap vlogs to pick them' && bar0.btns.join() === 'Cancel,Duplicate(off),Delete(off)', 'it opens the bar with nothing picked yet', JSON.stringify(bar0));
    await p.click('.mediacard [data-open="v1"]'); await p.waitForTimeout(300);
    ok(await p.textContent('.selbar .sb-n') === '1 vlog selected' && !(await p.$('.screen [data-screen="vlog"]')), 'tapping a card picks it (it doesn\'t open)');
    await p.screenshot({ path: path.join(out, `${name}-select.png`) });
    await p.click('.selbar [data-extra="0"]'); await p.waitForTimeout(1200);

    const after = await p.evaluate(async () => {
      const all = (await Store.all('vlogs')).values;
      const c = all.find(x => x.id !== 'v1' && x.id !== 'v2');
      return { n: all.length, orig: all.find(x => x.id === 'v1'), c, rc: c && c.acts[0].beats[0].shots[0].vref && c.acts[0].beats[0].shots[0].vref.clip,
        art: c && !!(await Store.get('art', Cover.key('vlog', c.id))), bar: !!document.querySelector('.selbar'),
        groups: [...document.querySelectorAll('.view .sec h2')].map(h => h.textContent),
        cards: [...document.querySelectorAll('.mediacard h3')].map(h => h.textContent) };
    });
    const c = after.c || { acts: [{ beats: [{ shots: [{}, {}] }, {}] }] };
    const cb = c.acts[0].beats[0];
    ok(after.n === 3 && c.title === 'Backyard camp-out (copy)', 'Duplicate makes a copy, named so', c.title);
    ok(c.week === null && c.monthId === null && after.groups.includes('No week set') && after.cards.includes('Backyard camp-out (copy)'), 'with no week (it doesn\'t take the original\'s)', after.groups.join(' | '));
    ok(c.acts.length === 1 && c.acts[0].beats.length === 2 && cb.script === 'We pitch it before dark.' && cb.shots.map(s => s.text).join() === 'Lay out parts,Stake corners',
      'the days, sequences, scripts and shots come across');
    const ids = [c.id, c.acts[0].id, cb.id, c.acts[0].beats[1].id, ...cb.shots.map(s => s.id)];
    ok(!ids.some(x => ['v1', 'a1', 'b1', 'b2', 's1', 's2'].includes(x)) && new Set(ids).size === ids.length, 'every act, sequence and shot has a new id', ids.join(' '));
    ok(JSON.stringify(cb.order) === JSON.stringify([cb.shots[1].id, cb.shots[0].id]), 'and what pointed at them follows', JSON.stringify(cb.order));
    ok(!cb.done && !('taskId' in cb) && cb.day === null && cb.at === null && cb.clipId === null && c.acts[0].day === null && !cb.shots[0].done && !c.editSteps,
      'none of the original\'s run: ticks, task, scheduled day, linked clip, edit walkthrough');
    ok(/^rc:rc_/.test(after.rc || '') && await p.evaluate(async id => !!(await Store.get('ref-clips', id)), (after.rc || '::').split(':')[1]), 'the grabbed reference clip is copied for it', after.rc);
    ok(after.art, 'and the cover picture');
    const o = after.orig;
    ok(o.title === 'Backyard camp-out' && o.acts[0].beats[0].done && o.acts[0].beats[0].taskId === 40 && o.acts[0].beats[0].shots[0].vref.clip === 'rc:rc1:clip', 'the original is untouched');
    ok(!after.bar, 'the bar closes after');

    /* delete with the bar: the copy */
    await p.click(sel); await p.waitForTimeout(300);
    await p.click(`.mediacard [data-open="${c.id}"]`); await p.waitForTimeout(300);
    await p.click('.selbar .sb-del'); await p.waitForTimeout(500);
    const sheet = await p.evaluate(() => (document.querySelector('.sheet, #sheet') || {}).textContent || '');
    ok(/Delete 1 vlog\?/.test(sheet) && /Recently deleted/.test(sheet), 'Delete asks first, and says where it can come back from');
    await p.click('[data-yes]'); await p.waitForTimeout(1200);
    const del = await p.evaluate(async id => ({ gone: !(await Store.get('vlogs', id)), trash: (await Store.all('trash')).values.some(t => t.store === 'vlogs' && t.key === id) }), c.id);
    ok(del.gone && del.trash, 'it\'s deleted, into Recently deleted', JSON.stringify(del));

    /* holding still works (right-click on a computer) */
    await p.click('.mediacard [data-open="v2"]', { button: 'right' }); await p.waitForTimeout(300);
    ok(await p.textContent('.selbar .sb-n') === '1 vlog selected', 'holding a card still starts picking');
    await p.click('.selbar .sb-x'); await p.waitForTimeout(300);

    /* the episode's own buttons */
    await p.click('.mediacard [data-open="v1"] h3'); await p.waitForTimeout(1500);
    ok(!!(await p.$(`${top} [data-a="duplicate"]`)) && !!(await p.$(`${top} .epfoot [data-a="delete"]`)), 'an episode\'s Plan has Duplicate episode and Delete episode');
    await p.evaluate(() => document.querySelector('.screen:last-child .epfoot').scrollIntoView());
    await p.screenshot({ path: path.join(out, `${name}-episode-foot.png`) });
    await p.click(`${top} [data-a="duplicate"]`); await p.waitForTimeout(1800);
    const opened = await p.evaluate(() => (document.querySelector('.screen:last-child .topbar, .screen:last-child') || {}).textContent || '');
    ok(/Backyard camp-out \(copy\)/.test(opened), 'Duplicate episode opens the copy');
    const copyId = await p.evaluate(async () => (await Store.all('vlogs')).values.find(x => / \(copy\)$/.test(x.title)).id);
    await p.click(`${top} .epfoot [data-a="delete"]`); await p.waitForTimeout(1200);
    ok(await p.evaluate(async id => !(await Store.get('vlogs', id)) && !!(await Store.get('vlogs', 'v1')), copyId), 'Delete episode deletes that one (the original stays)');
    await ctx.close();
  }
  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
