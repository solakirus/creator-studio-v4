/* Browser test: clip ideas (no-key route — paste the answers): pitch, keep,
   draft a clip into Clips; and drafting into an existing clip only fills
   what is empty.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/ideas.browser.js /tmp */
const { chromium } = require('playwright-core');
(async () => {
  const out = process.argv[2] || '/tmp';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const p = await b.newPage({ viewport: { width: 412, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html')); await p.waitForTimeout(1500);
  const paste = async text => { await p.waitForSelector('#ai-tx'); await p.fill('#ai-tx', text); await p.click('#sheet [data-ok]'); await p.waitForTimeout(700); };
  await p.evaluate(async () => { const c = await Channels.all(); c[0].about = 'Discipline, fitness and building a life after the Army'; c[0].who = 'Veterans in their 30s'; c[0].voice = 'Blunt, funny'; await Channels.save(c); });

  await p.click('#tabbar .tab:nth-child(4)'); await p.waitForTimeout(600);
  await p.click('.ctnav [data-v="clips"]'); await p.waitForTimeout(600);
  await p.click('[data-ideas]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => Screens.topId()) === 'clip-ideas', 'Ideas opens from the top of Clips');
  const prompt = await p.evaluate(() => ClipIdeas.pitchPrompt({ channel: '1k Soldier of Life', topic: 'tent in the backyard' }));
  ok(/Veterans in their 30s/.test(prompt) && /tent in the backyard/.test(prompt), "the prompt carries the channel's audience and your topic");
  await p.fill('#ci-tp', 'tent in the backyard');
  await p.click('[data-a="pitch"]'); await p.waitForTimeout(500);
  await paste('[{"title":"I slept in the yard for a week","angle":"Seven nights in a tent, ten feet from my bed.","channel":"1k Soldier of Life","series":"","hook":"Day 1. My wife thinks this is a phase.","why":"Tent is going up this week","specificity":9},{"title":"Generic camping tips","angle":"x","channel":"1k Soldier of Life","specificity":3}]');
  const cards = await p.evaluate(() => [...document.querySelectorAll('.ci-card b')].map(b => b.textContent));
  ok(cards.length === 1 && cards[0] === 'I slept in the yard for a week', 'low-specificity ideas are dropped', cards);
  await p.screenshot({ path: out + '/ideas.png' });
  await p.click('[data-keep]'); await p.waitForTimeout(500);
  ok((await p.evaluate(() => ClipIdeas.saved())).length === 1, 'Keep puts it in the backlog');
  await p.click('[data-draft]'); await p.waitForTimeout(500);
  await paste(JSON.stringify({ title: 'I slept in the yard for a week', titles: ['I slept in the yard for a week', 'Tent life, 10 feet from my bed', 'Day 1 of 7'],
    purpose: 'reach', contentType: 'entertain', audience: 'Veterans', promise: 'You will see if it changes anything', hookStyle: 'claim', hook: 'Day 1. My wife thinks this is a phase.',
    beats: ['Tent goes up', 'First night', 'Rain', 'Day 7 verdict'], ctaType: 'follow', cta: 'Follow for night 8', length: 'mid', script: 'Day one...' }));
  await p.waitForTimeout(800);
  const clip = await p.evaluate(async () => (await Data.clips()).find(c => /slept in the yard/.test(c.title)));
  ok(clip && clip.plan.hook === 'Day 1. My wife thinks this is a phase.' && clip.plan.beats.length === 4 && clip.plan.purpose === 'reach', 'Draft the clip lands it in Clips with its plan', clip && { hook: clip.plan.hook, beats: clip.plan.beats, purpose: clip.plan.purpose });
  ok(await p.evaluate(() => Screens.topId()) === 'clip', 'and opens it');
  ok((await p.evaluate(() => ClipIdeas.saved())).length === 0, 'a drafted idea leaves the backlog');
  await p.screenshot({ path: out + '/ideas-clip.png' });

  console.log('\ndraft into an existing clip');
  await p.evaluate(() => Data.saveClip({ id: 'c9', title: 'Morning ruck', channel: '1k Soldier of Life', stage: 'idea', createdAt: Date.now(), plan: { hook: 'My own hook', beats: [] } }));
  await p.evaluate(() => { while (Screens.depth()) Screens.pop(); }); await p.waitForTimeout(400);
  await p.evaluate(() => Screens.push('clip', { id: 'c9' })); await p.waitForTimeout(700);
  await p.click('[data-a="aidraft"]'); await p.waitForTimeout(500);
  await paste('{"title":"Morning ruck","hook":"AI hook","beats":["Pack","Step out","Mile 3","Coffee"],"cta":"Ruck with me","purpose":"trust"}');
  await p.waitForTimeout(800);
  const c9 = await p.evaluate(async () => (await Store.get('clips', 'c9')).plan);
  ok(c9.hook === 'My own hook', 'what you wrote is kept', c9.hook);
  ok(c9.beats.length === 4 && c9.cta === 'Ruck with me' && c9.purpose === 'trust', 'empty parts are filled', { beats: c9.beats, cta: c9.cta });

  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
