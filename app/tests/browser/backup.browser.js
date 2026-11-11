/* Browser test: full backup round trip, photos on and off, a v2 (version 1) file, and the
   Settings export/restore sheets. Needs playwright-core and Chromium; build the preview first:
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/backup.browser.js /tmp
   Writes screenshots and the exported file into the folder given. */
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html')); await p.waitForTimeout(2000);
  const r = await p.evaluate(async () => {
    const png = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).blob();
    await Store.put('tasks', { id: 9001, day: 3, title: 'Put up the tent', subs:[{t:'Stake corners',done:false}], shots:[{name:'Wide', angles:[{type:'wide',done:true}]}], when: new Date('2026-10-11T09:00:00Z') });
    await Store.put('vlogs', { id: 'v1', title: 'Week 2', acts:[{id:'a1', beats:[{id:'b1', title:'Hook', shots:[{text:'Tent reveal'}]}]}] });
    await Store.put('quarters', { id: 'q1', topic: 'Camping', startDate: 1, endDate: 2 });
    await Store.put('months', { id: 'm1', quarterId: 'q1', start: '2026-10-04' });
    await Store.put('seq-template', { name: 'Setup', shots: ['a','b'] }, 'tpl1');
    await Store.put('task-media', png, '9001:0');
    await Store.put('toolicon', { preset: null, blob: png }, 'shots');
    await Store.put('settings', { on: true }, 'reminders');
    const snap = async () => { const o = await Transfer.exportAll({ photos: true }); delete o.exportedAt; delete o.stats; return JSON.stringify(o); };
    const first = await snap();
    const full = JSON.parse(first);
    const noPhotos = await Transfer.exportAll({ photos: false });
    for (const s of Store.names()) await Store.clear(s);
    const n = await Transfer.importAll(full, 'replace');
    const second = await snap();
    const blob = await Store.get('task-media', '9001:0');
    const task = await Store.get('tasks', 9001);
    // version 1 file, as Creator Studio v2 writes it
    await Transfer.importAll({ format:'creator-studio', version:1, data:{ tasks:[{id:9002,title:'From v2',day:1}], vlogs:[] }, keyed:{ settings:[['palette','ember']] } }, 'merge');
    return {
      stores: Store.names().length,
      inBackup: Object.keys(full.data).length + Object.keys(full.keyed).length,
      roundTripIdentical: first === second, imported: n, report: Transfer.report(),
      blobBack: blob instanceof Blob && blob.size, dateBack: task.when instanceof Date,
      noPhotos: { hasBlob: JSON.stringify(noPhotos).includes('__blob'), stats: noPhotos.stats, toolicon: noPhotos.keyed.toolicon, taskMedia: noPhotos.keyed['task-media'] },
      v1: (await Store.get('tasks', 9002) || {}).title, v1kept: !!(await Store.get('tasks', 9001)), palette: await Store.get('settings','palette')
    };
  });
  console.log(JSON.stringify(r, null, 1));
  // UI: Profile -> Settings -> Export everything
  await p.evaluate(() => Screens.push('settings', {})); await p.waitForTimeout(600);
  await p.click('[data-go="backup"]'); await p.waitForTimeout(400);
  await p.screenshot({ path: process.argv[2] + '/export-sheet.png' });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#sheet [data-go]')]);
  const file = process.argv[2] + '/' + dl.suggestedFilename(); await dl.saveAs(file);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log('UI export:', dl.suggestedFilename(), 'version', j.version, 'stores', Object.keys(j.data).length + Object.keys(j.keyed).length);
  await p.waitForTimeout(500);
  await p.click('[data-go="restore"]'); await p.waitForTimeout(400);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#sheet [data-go]')]);
  await fc.setFiles(file); await p.waitForTimeout(600);
  console.log('toast:', await p.evaluate(() => (document.querySelector('.toast') || {}).textContent));
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
