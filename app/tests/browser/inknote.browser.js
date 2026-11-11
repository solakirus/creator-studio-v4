/* Browser test: write a note by hand from Notes — ink saved, shown in the
   list, "Read it" (pasted answer) fills the text, reopening keeps the ink.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/inknote.browser.js /tmp */
const { chromium } = require('playwright-core');
(async () => {
  const out = process.argv[2] || '/tmp';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const p = await b.newPage({ viewport: { width: 412, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html')); await p.waitForTimeout(1500);
  await p.evaluate(() => Screens.push('notes', {})); await p.waitForTimeout(700);
  await p.click('[data-a="write"]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => Screens.topId()) === 'ink-note', 'WRITE opens the pen pad');
  const cv = await p.$('.ink-cv');
  const r = await cv.boundingBox();
  for (const row of [0.2, 0.35]) {
    await p.mouse.move(r.x + 30, r.y + r.height * row); await p.mouse.down();
    for (let i = 0; i < 15; i++) await p.mouse.move(r.x + 30 + i * 14, r.y + r.height * row + Math.sin(i) * 8);
    await p.mouse.up();
  }
  await p.waitForTimeout(900);
  await p.screenshot({ path: out + '/ink-pad.png' });
  await p.click('[data-a="read"]'); await p.waitForTimeout(500);
  await p.fill('#ai-hw', 'Call the gutter guy\nBuy tent stakes'); await p.click('[data-ok]'); await p.waitForTimeout(700);
  await p.click('[data-a="done"]'); await p.waitForTimeout(800);
  const n = await p.evaluate(async () => (await Notes.all()).map(x => ({ text: x.text, strokes: x.ink && x.ink.strokes.length })));
  ok(n.length === 1 && n[0].strokes === 2, 'the ink is saved with the note', n);
  ok(n[0].text === 'Call the gutter guy\nBuy tent stakes', 'Read it puts the words in the text');
  ok(await p.evaluate(() => !!document.querySelector('canvas.ink-thumb[data-ink]')), 'the list shows a picture of the page');
  await p.screenshot({ path: out + '/ink-list.png' });
  await p.click('[data-open]'); await p.waitForTimeout(500);
  await p.click('[data-ink-open]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => Screens.topId()) === 'ink-note', 'the note opens its handwriting again');
  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
