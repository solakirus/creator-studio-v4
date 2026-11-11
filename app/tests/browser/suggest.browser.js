/* Browser test: Suggest shots, the no-key route (copy the prompt, paste the
   answer), from the sequence screen and from a section on the board. And an
   API key never leaves the device in a backup.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/suggest.browser.js /tmp */
const { chromium } = require('playwright-core');
(async () => {
  const out = process.argv[2] || '/tmp';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const p = await b.newPage({ viewport: { width: 412, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html')); await p.waitForTimeout(1500);
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };
  const answer = `Sure! Here you go:\n\`\`\`json\n[{"text":"Bag on the grass","framing":"Wide","movement":"Static","location":"Backyard","note":"Establish the space"},
{"text":"Poles snap together","framing":"close","movement":"Handheld","location":"Backyard","note":""},
{"text":"Tent rises","framing":"Medium","movement":"Push in","location":"Backyard","note":"Time-lapse if alone"}]\n\`\`\``;
  await p.evaluate(() => Store.put('vlogs', { id: 'v1', title: 'Backyard camp-out', acts: [{ id: 'a1', title: 'Saturday', beats: [{ id: 'b1', title: 'Put up the tent', purpose: 'Show the build', shots: [{ id: 's1', text: 'Lay out parts' }] }] }] }));

  console.log('\nsequence screen');
  await p.evaluate(() => Screens.push('vlog-beat', { vlogId: 'v1', beatId: 'b1' })); await p.waitForTimeout(700);
  await p.click('[data-a="suggestshots"]'); await p.waitForTimeout(500);
  const prompt = await p.evaluate(() => ShotAI.prompt({ title: 'Put up the tent', have: ['Lay out parts'] }));
  ok(/do not repeat them\): Lay out parts/.test(prompt), 'the prompt lists shots already planned');
  await p.fill('#ai-answer', answer); await p.click('[data-read]'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/suggest-list.png' });
  await p.uncheck('[data-i="2"]');
  ok(await p.textContent('[data-add]') === 'Add 2 shots', 'untick one, the button counts');
  await p.click('[data-add]'); await p.waitForTimeout(800);
  let shots = await p.evaluate(async () => (await Store.get('vlogs', 'v1')).acts[0].beats[0].shots.map(s => [s.text, s.framing, s.movement, s.location]));
  ok(shots.length === 3 && shots[1][0] === 'Bag on the grass' && shots[2][1] === 'Close', 'kept shots added, framing matched', shots);
  ok(await p.evaluate(() => document.querySelector('#screens').innerText.includes('Poles snap together')), 'the screen shows them');
  await p.screenshot({ path: out + '/suggest-added.png' });
  await p.evaluate(() => App.goBack()); await p.waitForTimeout(300);

  console.log('\nboard section');
  await p.evaluate(() => BoardLink.open({ type: 'vlog', id: 'v1', name: 'Backyard camp-out' })); await p.waitForTimeout(400);
  const fr = await p.$$('iframe.bd-frame'); const f = await fr[fr.length - 1].contentFrame();
  await f.waitForFunction(() => window.CS3Board && CS3Board.current() === 'vb-vlog-v1'); await p.waitForTimeout(900);
  ok(await f.evaluate(() => !!document.querySelector('.cs3-suggest')), 'the section has Suggest shots');
  await f.click('.cs3-suggest'); await p.waitForTimeout(500);
  await p.fill('#ai-answer', '[{"text":"Zip the door","framing":"Medium"}]'); await p.click('[data-read]'); await p.waitForTimeout(300);
  await p.click('[data-add]'); await p.waitForTimeout(1500);
  ok(await f.evaluate(() => CS3Board._.cardsOf(CS3Board.current()).some(c => c.type === 'shot' && c.data.desc === 'Zip the door' && c.data.ref)), 'the new shot appears on the board as a linked card');

  console.log('\nkeys stay on the device');
  await p.evaluate(() => Store.put('settings', { key: 'sk-ant-test', model: 'claude-sonnet-5-5' }, 'secret:ai'));
  const bk = await p.evaluate(async () => JSON.stringify(await Transfer.exportAll({ photos: false })));
  ok(!bk.includes('sk-ant-test'), 'not in Export everything');
  await p.evaluate(async b => { await Transfer.importAll(JSON.parse(b), 'replace'); }, bk);
  ok(await p.evaluate(async () => ((await Store.get('settings', 'secret:ai')) || {}).key) === 'sk-ant-test', 'and Restore (replace) keeps the one already here');

  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
