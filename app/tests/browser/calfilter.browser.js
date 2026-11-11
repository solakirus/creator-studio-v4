/* Browser test: the month grid should start near the top of the screen with
   nine channels in the database, and the filter should still work from its
   one row. The pill list pushed the grid below the fold on a phone. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium',
    headless: true, args:['--no-sandbox', '--disable-dev-shm-usage',
      '--disable-component-update', '--disable-background-networking',
      '--disable-sync', '--disable-default-apps', '--no-first-run',
      '--disable-features=OptimizationHints,Translate'] });
  /* a phone, because that is where the chips hurt */
  const ctx = await b.newContext({ viewport:{ width:412, height:915 }, hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html'));
  await p.waitForTimeout(1600);
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if(!c) fails++; };

  /* nine channels, the number he actually has, plus a clip on each so the
     filter has something to hide */
  const names = ['Plant City','Gym','Cooking','Tech','Cars','Family','Music','Travel','Shorts'];
  /* channels are one settings record, not a store of their own */
  await p.evaluate(async ns => {
    await Channels.save(ns.map((n, i) => ({ id:'ch' + i, n, c:'#FB6900' })));
    Channels.invalidate && Channels.invalidate();
    for(let i = 0; i < ns.length; i++)
      await Store.put('clips', { id:'cl' + i, title:'Clip ' + i, channel:ns[i],
        plat:'youtube', state:'idea', scheduledAt:null });
    Data.invalidate();
  }, names);

  await p.evaluate(() => Screens.push('calendar', {}));
  await p.waitForTimeout(900);

  console.log('one row, not nine pills');
  ok(await p.locator('.chiplist').count() === 0, 'the chip list is gone');
  ok(await p.locator('.calfilter').count() === 1, 'one filter row');
  const rowH = await p.evaluate(() => {
    const r = document.querySelector('.calfilter');
    return r ? Math.round(r.getBoundingClientRect().height) : -1;
  });
  ok(rowH > 0 && rowH <= 56, 'it is one row tall', rowH + 'px');
  ok((await p.locator('.cf-pick').textContent()).includes('All channels'),
    'and it says All channels at rest');

  console.log('\nthe grid is above the fold');
  const gridTop = await p.evaluate(() => {
    const g = document.querySelector('.calgrid');
    return g ? Math.round(g.getBoundingClientRect().top) : -1;
  });
  ok(gridTop > 0 && gridTop < 400, 'the grid starts in the first screen', gridTop + 'px of 915');
  const gridVisible = await p.evaluate(() => {
    const g = document.querySelector('.calgrid').getBoundingClientRect();
    return Math.round(Math.min(g.bottom, innerHeight) - Math.max(g.top, 0));
  });
  ok(gridVisible > 250, 'and a usable amount of it is on screen', gridVisible + 'px');

  console.log('\nthe theme moved below the grid');
  const order = await p.evaluate(() => {
    const g = document.querySelector('.calgrid').getBoundingClientRect().top;
    const th = [...document.querySelectorAll('[data-a="theme"]')][0];
    return { grid: Math.round(g), theme: th ? Math.round(th.getBoundingClientRect().top) : -1 };
  });
  ok(order.theme > order.grid, 'the theme button is under it', order);

  console.log('\nthe picker opens and filters');
  await p.locator('[data-a="chans"]').click();
  await p.waitForTimeout(450);
  const chRows = await p.locator('#sheet [data-ch]').count();
  ok(chRows === names.length + 1, 'every channel plus All channels', chRows);

  /* tick two */
  await p.locator('#sheet [data-ch="Gym"]').click();
  await p.waitForTimeout(250);
  await p.locator('#sheet [data-ch="Cars"]').click();
  await p.waitForTimeout(250);

  const tick = await p.evaluate(() =>
    document.querySelector('#sheet [data-ch="Gym"] .cf-tick').textContent.trim());
  ok(tick === '✓', 'the row ticks', tick);
  const stillOpen = await p.evaluate(() =>
    document.getElementById('sheet').classList.contains('open'));
  ok(stillOpen, 'and the sheet stayed up');
  /* the sheet must not be rebuilt on each tick — a fresh node re-animates */
  const slid = await p.evaluate(() =>
    getComputedStyle(document.getElementById('sheet')).transform);
  ok(slid === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(slid),
    'it is not mid-slide, so it was not rebuilt', slid);

  await p.locator('#sheet [data-cancel]').click();
  await p.waitForTimeout(400);
  ok(!(await p.evaluate(() => document.getElementById('sheet').classList.contains('open'))),
    'Done closes it');

  const label = await p.locator('.cf-pick').textContent();
  ok(label.includes('2 channels'), 'the row now counts them', label.trim());
  ok(await p.locator('[data-a="allchans"]').count() === 1, 'and a Clear appeared');

  console.log('\nthe filter actually filters');
  const shown = await p.evaluate(() => document.querySelectorAll('.cday .ev').length);
  await p.locator('[data-a="allchans"]').click();
  await p.waitForTimeout(500);
  const all = await p.evaluate(() => document.querySelectorAll('.cday .ev').length);
  ok(await p.locator('[data-a="allchans"]').count() === 0, 'Clear removes itself');
  ok((await p.locator('.cf-pick').textContent()).includes('All channels'),
    'and the row goes back to All channels');
  ok(all >= shown, 'clearing shows at least as much as the filter did', { filtered: shown, all });

  console.log('\na long channel name does not wrap the row');
  await p.evaluate(async () => {
    const list = await Channels.all();
    await Channels.save([...list, { id:'chlong',
      n:'Made in Plant City — the long one that would wrap', c:'#FB6900' }]);
    Channels.invalidate && Channels.invalidate();
    Data.invalidate();
  });
  await p.evaluate(() => Screens.pop());
  await p.waitForTimeout(300);
  await p.evaluate(() => Screens.push('calendar', {}));
  await p.waitForTimeout(800);
  await p.locator('[data-a="chans"]').click();
  await p.waitForTimeout(400);
  await p.locator('#sheet [data-ch="Made in Plant City — the long one that would wrap"]').click();
  await p.waitForTimeout(250);
  await p.locator('#sheet [data-cancel]').click();
  await p.waitForTimeout(400);
  const h2 = await p.evaluate(() => Math.round(document.querySelector('.calfilter').getBoundingClientRect().height));
  ok(h2 <= 56, 'the row is still one row tall', h2 + 'px');
  const clipped = await p.evaluate(() => {
    const s = document.querySelector('.cf-pick > span');
    return s.scrollWidth > s.clientWidth;
  });
  ok(clipped, 'the name is truncated rather than wrapped');

  console.log('\nnothing threw');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));

  console.log(fails ? `\nFAILED (${fails})\n` : '\nthe filter is one row and the grid is above the fold\n');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
