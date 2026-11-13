/* Browser test: importing saves into the Inbox, then Quick sort.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/v4-swipe-inbox.browser.js /tmp
   Picks a real zip through the Import sheet, the way you would on the phone. */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path'), zlib = require('zlib');

function zip(files){
  const locals = [], centrals = []; let off = 0;
  for(const [name, text] of files){
    const nb = Buffer.from(name), data = Buffer.from(text), comp = zlib.deflateRawSync(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nb, comp); centrals.push(ch, nb); off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(centrals), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10);
  e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, e]);
}

(async () => {
  const out = process.argv[2] || '/tmp';
  const saved = { saved_saved_media: Array.from({ length: 6 }, (_, i) => ({ title: i < 3 ? 'carthrottle' : 'coffeeguy',
    string_map_data: { 'Saved on': { href: `https://www.instagram.com/reel/C${i}abcdefgh/`, timestamp: 1704067200 + i * 86400 } } })) };
  const cols = { saved_saved_collections: [
    { title: 'Collection', string_map_data: { Name: { value: 'Drift' }, 'Creation Time': { timestamp: 1700000000 } } },
    { title: 'driftking', string_map_data: { Name: { href: 'https://www.instagram.com/p/DRIFTxx001/', value: 'driftking' }, 'Added Time': { timestamp: 1706745600 } } }
  ] };
  const tt = { 'Your Activity': { 'Favorite Videos': { FavoriteVideoList: [
    { Date: '2024-03-02 18:22:01', Link: 'https://www.tiktokv.com/share/video/7341234567890123456/' } ] },
    'Watch History': { VideoList: [ { Date: '2024-01-01 00:00:00', Link: 'https://www.tiktokv.com/share/video/7002222222222222222/' } ] } } };
  const igZip = path.join(out, 'instagram-kris-2026-11-12.zip');
  fs.writeFileSync(igZip, zip([['your_instagram_activity/saved/saved_posts.json', JSON.stringify(saved)],
                               ['your_instagram_activity/saved/saved_collections.json', JSON.stringify(cols)]]));
  const ttFile = path.join(out, 'user_data_tiktok.json');
  fs.writeFileSync(ttFile, JSON.stringify(tt));

  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false,
    args: ['--disable-component-update', '--no-sandbox'] });
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  /* no network here: the platforms' players stay blank, which is fine */
  await p.route(/^https?:\/\//, r => r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../../../creator-studio-preview.html')); await p.waitForTimeout(1500);

  await p.evaluate(async () => {
    await SwipeFolders.create('Cars', '🚗'); await SwipeFolders.create('Morning routine', '☕');
    await Store.put('swipes', { id: 'sw_old', url: 'https://www.instagram.com/reel/C0abcdefgh/', title: 'Already had this',
      source: 'reel', createdAt: 1, folders: [] });
    Screens.push('swipe-file');
  });
  await p.waitForTimeout(800);

  console.log('\nImport');
  await p.click('[data-a="import"]'); await p.waitForTimeout(400);
  await p.click('[data-imp="saves"]'); await p.waitForTimeout(500);
  await p.setInputFiles('#si-file', [igZip, ttFile]); await p.waitForTimeout(800);
  const sum = await p.textContent('#si-sum');
  ok(/7 new saves/.test(sum), 'zip + TikTok file: 7 new (one already in the file, watch history ignored)', sum.replace(/\s+/g, ' ').trim());
  ok(/Drift \(1\)/.test(sum), 'the Drift collection is offered as a folder');
  await p.screenshot({ path: path.join(out, 'si-sheet.png') });
  await p.click('[data-go]'); await p.waitForTimeout(1200);
  const st = await p.evaluate(async () => { const { values } = await Store.all('swipes');
    const f = await SwipeFolders.sorted();
    return { inbox: values.filter(s => s.inbox).length, drift: values.filter(s => (s.folders || []).includes((f.find(x => x.name === 'Drift') || {}).id)).length,
      tt: values.filter(s => s.source === 'tiktok').map(s => s.url), authors: values.filter(s => s.author === 'carthrottle').length,
      tab: document.querySelector('[data-view="inbox"]').getAttribute('aria-selected') }; });
  ok(st.inbox === 6 && st.drift === 1, '6 in the Inbox, the collection post in Drift', st);
  ok(st.authors === 2, 'creator carried over from the export (2 new carthrottle)', st.authors);
  ok(st.tab === 'true', 'lands on the Inbox tab');
  await p.screenshot({ path: path.join(out, 'si-inbox.png') });

  console.log('\nSearch, then file them all');
  await p.fill('#q', 'carthrottle'); await p.waitForTimeout(400);
  ok(await p.$('[data-a="fileall"]') !== null, 'searching the Inbox offers "Put all N in a folder"', await p.textContent('[data-a="fileall"]'));
  await p.click('[data-a="fileall"]'); await p.waitForTimeout(400);
  await p.click('.sheet [data-pickf] >> text=Cars'); await p.waitForTimeout(600);
  const st2 = await p.evaluate(async () => (await Store.all('swipes')).values.filter(s => s.inbox).length);
  ok(st2 === 4, 'two carthrottle swipes filed in one go, out of the Inbox', st2);

  console.log('\nQuick sort');
  await p.click('[data-view="inbox"]'); await p.waitForTimeout(300);
  await p.click('[data-a="quicksort"]'); await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(out, 'qs-1.png') });
  ok(/4 left/.test(await p.textContent('.qs-prog')), '4 left to sort', await p.textContent('.qs-prog'));
  const first = await p.evaluate(() => document.querySelector('.qs-t b').textContent);
  await p.click('.qs-f[data-f] >> nth=1'); await p.waitForTimeout(500);       /* Morning routine */
  ok(/3 left/.test(await p.textContent('.qs-prog')), 'tap a folder → filed, next one up');
  await p.click('[data-q="undo"]'); await p.waitForTimeout(500);
  ok(/4 left/.test(await p.textContent('.qs-prog')) && await p.textContent('.qs-t b') === first, 'Undo brings the same one back');
  /* hold: add to Cars, stay */
  const box = await p.locator('.qs-f[data-f] >> nth=0').boundingBox();
  await p.mouse.move(box.x + 20, box.y + 20); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(300);
  ok(/4 left/.test(await p.textContent('.qs-prog')) && await p.getAttribute('.qs-f[data-f] >> nth=0', 'aria-pressed') === 'true',
    'hold a folder → added, still on this one');
  await p.click('.qs-f[data-f] >> nth=1'); await p.waitForTimeout(500);
  const two = await p.evaluate(async () => { const f = await SwipeFolders.sorted();
    return (await Store.all('swipes')).values.filter(s => (s.folders || []).length === 2 && !s.inbox).length; });
  ok(two === 1, '…then tap a second → in both folders', two);
  await p.keyboard.press('k'); await p.waitForTimeout(400);
  await p.keyboard.press('s'); await p.waitForTimeout(400);
  await p.keyboard.press('d'); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(out, 'qs-2.png') });
  await p.keyboard.press('1'); await p.waitForTimeout(500);
  const end = await p.textContent('.qs .empty');
  ok(/Inbox zero/.test(end), 'keys K / S / D / 1 work and it ends at Inbox zero', end.replace(/\s+/g, ' '));
  await p.screenshot({ path: path.join(out, 'qs-done.png') });
  await p.click('[data-q="undo"]'); await p.waitForTimeout(500);
  ok(await p.$('.qs-t') !== null, 'Undo from Inbox zero brings the last one back');
  await p.keyboard.press('1'); await p.waitForTimeout(400);
  const fin = await p.evaluate(async () => { const v = (await Store.all('swipes')).values; return { n: v.length, inbox: v.filter(s => s.inbox).length }; });
  ok(fin.n === 7 && fin.inbox === 0, 'one deleted, none left in the Inbox', fin);

  ok(!errs.length, 'no page errors', errs);
  await b.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
