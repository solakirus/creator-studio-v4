/* Browser test: Delete month asks what happens to its vlogs (21 Nov 2026).

   October has four vlogs (weeks 1–4). November already has one in its week 2.
   Delete month offers: move them to another month, delete them too, or keep
   them without a month. Moving keeps each one's place (week 1 → week 1); one
   whose week is taken gets the first free week, and one that fits nowhere
   loses the tag. Deleting them puts them in Recently deleted, and one Undo
   brings back the month and its vlogs. A month with no vlogs just asks.

     node app/tests/browser/v4-month-delete.browser.js [outDir] */
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
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  const fresh = async () => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForFunction(() => window.App && window.Months && window.Trash, null, { timeout: 15000 });
    await p.waitForTimeout(700);
    /* October (4 weeks) with a vlog in each week; November (4 weeks) with one in week 2; December, empty */
    await p.evaluate(async () => {
      const oct = await Months.save({ name: 'October', startDate: '2026-10-04', endDate: '2026-10-31' });
      const nov = await Months.save({ name: 'November', startDate: '2026-11-01', endDate: '2026-11-28' });
      await Months.save({ name: 'December', startDate: '2026-12-06', endDate: '2027-01-02' });
      for(const sl of await Months.weeks(oct)) await Months.createEpisode(oct, sl);
      await Months.createEpisode(nov, (await Months.weeks(nov))[1]);
      window.__ids = { oct: oct.id, nov: nov.id };
    });
    return { p, ctx };
  };
  const state = p => p.evaluate(async () => {
    const months = (await Months.all()).map(m => m.name);
    const nov = (await Months.all()).find(m => m.name === 'November');
    const slots = nov ? await Months.weeks(nov) : [];
    const eps = (await Store.all('vlogs')).values;
    const idx = v => { const s = slots.find(sl => sl.week === +v.week); return s ? s.index : null; };
    return { months, total: eps.length,
      inNov: eps.filter(v => nov && v.monthId === nov.id).map(v => `${v.title}→${idx(v)}${v.isVerdict ? '*' : ''}`).sort(),
      untagged: eps.filter(v => !v.monthId).map(v => v.title) };
  });
  const openDelete = async p => {
    await p.evaluate(() => Screens.push('month', { id: window.__ids.oct })); await p.waitForTimeout(1200);
    await p.click('.screen:last-child [data-a="delete"]'); await p.waitForTimeout(500);
  };

  console.log('\n— the choices —');
  let { p, ctx } = await fresh();
  await openDelete(p);
  const sheet = await p.evaluate(() => { const s = document.querySelector('.sheet, #sheet'); return s ? s.textContent.replace(/\s+/g, ' ') : ''; });
  ok(/Delete October\?/.test(sheet) && /It has 4 vlogs/.test(sheet), 'Delete month says how many vlogs it has', sheet.slice(0, 60));
  ok(/Move them to another month/.test(sheet) && /Delete them too/.test(sheet) && /Keep them, without a month/.test(sheet), 'and offers move, delete or keep');
  await p.click('[data-mmove]'); await p.waitForTimeout(300);
  const targets = await p.$$eval('[data-mto] b', x => x.map(e => e.textContent));
  ok(targets.join() === '→ November,→ December', 'Move lists the other months', targets.join(' '));
  await p.screenshot({ path: path.join(out, 'month-delete-sheet.png') });

  console.log('\n— move to November —');
  await p.click(`[data-mto="${await p.evaluate(() => window.__ids.nov)}"]`); await p.waitForTimeout(1200);
  let s = await state(p);
  ok(!s.months.includes('October') && s.total === 5, 'October is gone, every vlog stays', JSON.stringify(s.months));
  ok(JSON.stringify(s.inNov) === JSON.stringify(['November — week 2→2', 'October — week 1→1', 'October — week 2→3', 'October — week 3→4*']),
    'each keeps its week where it can; a taken week moves to the next free one; the last week is the verdict', JSON.stringify(s.inNov));
  ok(JSON.stringify(s.untagged) === '["October — verdict"]', 'the one that didn\'t fit loses the month', JSON.stringify(s.untagged));
  await ctx.close();

  console.log('\n— delete them too —');
  ({ p, ctx } = await fresh());
  await openDelete(p);
  await p.click('[data-mdel="delete"]'); await p.waitForTimeout(1200);
  s = await state(p);
  ok(!s.months.includes('October') && s.total === 1, 'October and its 4 vlogs are deleted (November\'s stays)', `${s.total} left`);
  const tr = await p.evaluate(async () => (await Store.all('trash')).values.map(t => t.store));
  ok(tr.filter(x => x === 'vlogs').length === 4 && tr.includes('months'), 'all in Recently deleted', tr.join(' '));
  await p.click('#undoBar [data-undo]'); await p.waitForTimeout(1200);
  s = await state(p);
  ok(s.months.includes('October') && s.total === 5, 'one Undo brings back the month and its vlogs', JSON.stringify(s.months));
  await ctx.close();

  console.log('\n— keep them —');
  ({ p, ctx } = await fresh());
  await openDelete(p);
  await p.click('[data-mdel="keep"]'); await p.waitForTimeout(1200);
  s = await state(p);
  ok(!s.months.includes('October') && s.total === 5 && s.untagged.length === 4, 'October is gone; its vlogs stay, without a month', JSON.stringify(s.untagged));
  await ctx.close();

  console.log('\n— an empty month —');
  ({ p, ctx } = await fresh());
  await p.evaluate(async () => Screens.push('month', { id: (await Months.all()).find(m => m.name === 'December').id })); await p.waitForTimeout(1200);
  await p.click('.screen:last-child [data-a="delete"]'); await p.waitForTimeout(500);
  const sh2 = await p.evaluate(() => (document.querySelector('.sheet, #sheet') || {}).textContent || '');
  ok(/Delete December\?/.test(sh2) && !/Move/.test(sh2), 'just asks');
  await p.click('[data-mdel="keep"]'); await p.waitForTimeout(1000);
  ok(!(await state(p)).months.includes('December'), 'and deletes it');
  await ctx.close();

  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
