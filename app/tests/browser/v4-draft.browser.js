/* Browser test: Draft — describe it, get the gist from Claude, refine, make
   the plan, import it, zoom in one level, and the brain dump. Claude is a
   stand-in (window.CS4Claude, as the laptop app provides through Claude Code)
   that answers from what the prompt asks for and records every prompt.

     node app/tests/browser/v4-draft.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = t => console.log('\n— ' + t + ' —');

/* the stand-in Claude: reads the dates and kind the prompt gives, answers in shape */
const FAKE = () => {
  window.__prompts = [];
  const between = (p, a) => (new RegExp(a + '\\s*([0-9-]{10})').exec(p) || [])[1];
  window.CS4Claude = {
    status: async () => ({ found: true, version: '2.1.300' }),
    stop: async () => true,
    ask: async ({ prompt }) => {
      __prompts.push(prompt);
      await new Promise(r => setTimeout(r, 60));
      if(/Reply with exactly: ready/.test(prompt)) return { ok: true, text: 'ready' };
      if(/brain dump/i.test(prompt) && /SECOND DUMP/.test(prompt)){
        const dr = (/draft (\S+) · Month · /.exec(prompt) || [])[1], ep = (/episode (\S+) · week of/.exec(prompt) || [])[1];
        return { ok: true, text: JSON.stringify([
          { kind: 'month', title: 'No phone in bed', idea: 'no phone in bed all month', addTo: { type: 'draft', id: dr } },
          { kind: 'vlog', title: 'Evening wind-down', idea: 'add an evening wind-down to the alarm week', addTo: { type: 'episode', id: ep } },
          { kind: 'video', title: 'Lens test', idea: 'test my new lens' }]) };
      }
      if(/brain dump/i.test(prompt)) return { ok: true, text: JSON.stringify([
        { kind: 'vlog', title: 'Cold plunge week', idea: 'a week of cold plunges' },
        { kind: 'series', title: 'Garage builds', idea: 'build things in the garage, one per video' },
        { kind: 'video', title: 'Desk tour', idea: 'my desk setup' }]) };
      if(/Give him the gist|First decide what this is/.test(prompt)){
        const kind = /First decide/.test(prompt) ? (/discipline month/i.test(prompt) ? 'month' : 'video') : null;
        const refine = /His changes/.test(prompt);
        if(kind === 'month' || /exactly these headings[\s\S]*THE MONTH/.test(prompt))
          return { ok: true, text: `${kind ? 'KIND: month\n' : ''}THE MONTH\nDiscipline month${refine ? ' (no sugar)' : ''}\nTHE CHALLENGE\nUp at 5 every day\nWHY IT WORKS\nSimple and visible\nTHE WEEKS\n1. Week one — alarm across the room\n2. Week two — cold shower\nREWARD AND STAKES\nNew lens\nOPEN QUESTIONS\nNone` };
        if(/THE EPISODE/.test(prompt)) return { ok: true, text: `THE EPISODE\nAlarm across the room\nTHE WEEK'S CHALLENGE\nUp at 5, pass is 6 of 7\nHOOKS\n1. I put my alarm in the kitchen\nTHE DAYS\n- Sunday: the setup\n- Monday: the first 5am\nWHAT TO FILM\n- alarm, kitchen walk\nOPEN QUESTIONS\nNone` };
        if(/THE QUARTER/.test(prompt)) return { ok: true, text: `THE QUARTER\nBuilding the base\nTOPIC\nHabits\nTHROUGHLINE\nSmall wins stack\nTHE CHALLENGE\n90 days of 5am\nTHE MONTHS\n1. Discipline — up at 5\n2. Fuel — cook every meal\n3. Body — train daily\nOPEN QUESTIONS\nNone` };
        if(/THE SERIES/.test(prompt)) return { ok: true, text: `THE SERIES\nGarage builds\nWHY IT WORKS\nMaking things\nTHE FORMAT\nOne build per video\nEPISODES\n1. Workbench — the start\n2. Shelf — storage\n3. Stool — small win\nOPEN QUESTIONS\nNone` };
        return { ok: true, text: `KIND: video\nTHE IDEA\nDesk tour\nWHY IT WORKS\nPeople like desks\nHOOKS\n1. My desk\nSTRUCTURE\n- wide\nWHAT TO FILM\n- wide\nOPEN QUESTIONS\nNone` };
      }
      if(/Turn this agreed overview/.test(prompt)){
        if(/"months": \[ \{ "name": "the month's name"/.test(prompt)){
          const s = between(prompt, '"startDate": "'), e2 = between(prompt, '"endDate": "');
          const weeks = [...prompt.matchAll(/"filmStart": "([0-9-]{10})"/g)].map(m => m[1]);
          return { ok: true, text: '```json\n' + JSON.stringify({ plan: 'Discipline', months: [{ name: 'Discipline', startDate: s, endDate: e2, challenge: 'Up at 5 every day', reward: 'New lens', notes: 'Simple' }],
            episodes: weeks.map((w, i) => ({ title: `Discipline week ${i + 1}`, filmStart: w, weeklyChallenge: `Challenge ${i + 1}`, skill: 'Waking', isVerdict: i === weeks.length - 1 })) }) + '\n```' };
        }
        if(/"episodes": \[ \{\s*"title": "the episode's title"/.test(prompt) && /Already in the planner[\s\S]*First 5am/.test(prompt)){
          const w = between(prompt, '"filmStart": "');
          return { ok: true, text: JSON.stringify({ plan: 'Wind-down', episodes: [{ title: 'Alarm across the room', filmStart: w,
            acts: [{ title: 'Monday', sequences: [{ title: 'First 5am', shots: ['Dark hallway', 'Bed at 9'] }, { title: 'Evening wind-down', setup: 'phone', shots: ['Lamp off', 'Book'] }] }] }] }) };
        }
        if(/"episodes": \[ \{\s*"title": "the episode's title"/.test(prompt)){
          const w = between(prompt, '"filmStart": "');
          return { ok: true, text: JSON.stringify({ plan: 'Alarm week', episodes: [{ title: 'Alarm across the room', filmStart: w, skill: 'Waking', weeklyChallenge: 'Up at 5', passLine: '6 of 7',
            acts: [{ title: 'Sunday', sequences: [{ title: 'The setup', purpose: 'Why', setup: 'talking', script: 'This week…', shots: [{ text: 'Alarm on the counter', framing: 'Close', movement: 'Static' }, 'Kitchen walk'] }] },
                   { title: 'Monday', sequences: [{ title: 'First 5am', purpose: 'The test', setup: 'phone', shots: ['Dark hallway', { text: 'Alarm off', framing: 'Close', lines: [{ k: 'vo', t: 'Day one.' }] }] },
                                                  { title: 'Coffee', setup: 'vlog', shots: ['Pour'] }] }] }] }) };
        }
        if(/"quarters": \[/.test(prompt)){
          const n = +(/"n": (\d+)/.exec(prompt) || [])[1];
          const ms = [...prompt.matchAll(/"startDate": "([0-9-]{10})", "endDate": "([0-9-]{10})"/g)];
          return { ok: true, text: JSON.stringify({ plan: 'Base', quarters: [{ n, name: 'Building the base', topic: 'Habits', throughline: 'Small wins stack', challenge: '90 days of 5am' }],
            months: ms.map((m, i) => ({ name: ['Q-Discipline', 'Q-Fuel', 'Q-Body'][i], startDate: m[1], endDate: m[2], challenge: ['Up at 5', 'Cook every meal', 'Train daily'][i] })) }) };
        }
        const n = +(/exactly (\d+) video/.exec(prompt) || [0, 1])[1];
        return { ok: true, text: JSON.stringify({ plan: 'Builds', videos: Array.from({ length: n }, (_, i) => ({ title: ['Workbench', 'Shelf', 'Stool'][i] || 'Video ' + i, order: i + 1, hook: 'Build it', idea: 'x',
          shots: ['Wide of garage', { text: 'Saw cut', framing: 'Close' }] })) }) };
      }
      return { ok: false, why: 'unexpected prompt' };
    }
  };
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(FAKE);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/') + '?planner');
  await p.waitForFunction(() => window.App && window.PlanDraft, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  const txt = s => p.textContent(s).catch(() => '');
  const lastPrompt = () => p.evaluate(() => __prompts[__prompts.length - 1] || '');
  const importIt = async () => { await p.click('[data-import]'); await p.waitForTimeout(800); const go = await txt('[data-go]'); await p.click('[data-go]'); await p.waitForTimeout(1200); return go; };

  head('the Draft tab');
  const tabs = await p.$$eval('.tabbar .tab', x => x.map(e => e.getAttribute('aria-label')));
  ok(tabs[0] === 'Draft', 'Draft is first on the Planner\'s sidebar', tabs.join(' · '));
  await p.click('.tabbar [data-tab="draft"]'); await p.waitForTimeout(900);
  ok(/Claude answers through your Claude plan/.test(await txt('[data-via]')), 'it says Claude answers through the Claude plan here (no key)');

  head('describe it — Claude works out it\'s a month');
  await p.click('.drf-main [data-new]'); await p.waitForTimeout(400);
  await p.fill('[data-idea]', 'a discipline month where I get up at 5 every day'); await p.waitForTimeout(500);
  await p.click('[data-gist]'); await p.waitForTimeout(900);
  ok(/First decide what this is/.test(await lastPrompt()), 'with "Work it out", Claude is asked what kind it is');
  ok(await p.$eval('[data-kind="month"]', e => e.getAttribute('aria-pressed')) === 'true', 'its answer (KIND: month) picks Month');
  ok(!!(await p.$('[data-f="monthStart"]')) && /Discipline month/.test(await txt('[data-gistcard]')) && !/KIND/.test(await txt('[data-gistcard]')), 'the month\'s dates show, and the gist reads without the KIND line');
  await p.screenshot({ path: path.join(out, 'draft-gist.png') });
  await p.fill('[data-change]', 'no sugar too'); await p.click('[data-refine]'); await p.waitForTimeout(900);
  const rp = await lastPrompt();
  ok(/His changes[\s\S]*no sugar too/.test(rp) && /Your last overview/.test(rp), 'Refine sends the last overview and your change');
  ok(/no sugar/.test(await txt('[data-gistcard]')) && /1 earlier overview/.test(await txt('.drf-old summary')), 'the new gist shows, the old one folds away');

  head('make the plan, import it');
  await p.click('[data-plan]'); await p.waitForTimeout(900);
  const pp = await lastPrompt();
  const weeks = [...pp.matchAll(/"filmStart": "([0-9-]{10})"/g)].length;
  ok(/exactly these \d+ weeks/.test(pp) && weeks >= 4, 'the plan prompt gives the month\'s exact weeks', weeks + ' weeks');
  ok(/Month · Discipline/.test(await txt('.drf-card:last-of-type')) && (await p.$$eval('.drf-card:last-of-type li', x => x.length)) === weeks + 1, 'the plan shows the month and its weekly vlogs');
  const go1 = await importIt();
  ok(/Import 1 month, \d+ vlogs/.test(go1), 'the import preview offers the month and its vlogs', go1);
  const mo = await p.evaluate(async () => { const m = (await Months.all()).find(x => x.name === 'Discipline'); const eps = (await Store.all('vlogs')).values.filter(v => v.monthId === (m && m.id)); return { m, n: eps.length, titles: eps.map(v => v.title) }; });
  ok(mo.m && mo.m.challenge === 'Up at 5 every day' && mo.n === weeks, 'the month is in, with its weekly vlogs tagged to it', mo.n + ' episodes');
  ok(/In the Planner/.test(await txt('.drf-done')), 'the draft says it\'s in the Planner');
  const kids = await p.$$eval('[data-child]', x => x.length);
  ok(kids === weeks, 'each week offers "Plan this episode"', kids);
  await p.screenshot({ path: path.join(out, 'draft-imported.png') });

  head('zoom in: plan week 1\'s episode');
  await p.click('[data-child="0"]'); await p.waitForTimeout(900);
  ok(await p.$eval('[data-kind="vlog"]', e => e.getAttribute('aria-pressed')) === 'true' && /Inside the month "Discipline"/.test(await txt('.drf-parent')), 'a new Weekly vlog draft, inside the month');
  await p.click('[data-gist]'); await p.waitForTimeout(900);
  ok(/sits inside the month "Discipline"[\s\S]*Month challenge: Up at 5/.test(await lastPrompt()), 'Claude is told what sits above it');
  await p.click('[data-plan]'); await p.waitForTimeout(900);
  ok(/2 days · 3 sequences · 5 shots/.test(await txt('.drf-card:last-of-type')), 'the plan has its days, sequences and shots');
  const go2 = await importIt();
  ok(/update 1/.test(go2), 'importing updates that week\'s episode (made by the month), ticked', go2);
  const ep = await p.evaluate(async () => (await Store.all('vlogs')).values.find(v => v.title === 'Alarm across the room'));
  ok(ep && ep.acts.length === 2 && ep.acts[1].beats.length === 2 && ep.acts[1].beats[0].shots[1].lines[0].t === 'Day one.', 'the episode now has the days, sequences, shots and lines');
  ok(ep && ep.weeklyChallenge === 'Up at 5' && ep.passLine === '6 of 7', 'and its challenge and pass line');

  head('a quarter');
  await p.click('.drf-side [data-new]'); await p.waitForTimeout(300);
  await p.click('[data-kind="quarter"]'); await p.waitForTimeout(300);
  ok(!!(await p.$('[data-f="quarterId"]')), 'Quarter offers the quarters to pick from');
  await p.fill('[data-idea]', 'build the base'); await p.waitForTimeout(450);
  await p.click('[data-gist]'); await p.waitForTimeout(800);
  await p.click('[data-plan]'); await p.waitForTimeout(800);
  ok(/exactly these 3 months/.test(await lastPrompt()), 'the plan prompt gives the quarter\'s three months');
  const go3 = await importIt();
  ok(/update 1/.test(go3) && /3 months/.test(go3), 'the import fills in the quarter and adds its months', go3);
  const qq = await p.evaluate(async () => (await Quarters.all()).find(q => q.topic === 'Habits'));
  ok(qq && qq.throughline === 'Small wins stack' && qq.challenge === '90 days of 5am', 'the quarter has its topic, throughline and challenge');
  ok((await p.$$eval('[data-child]', x => x.map(e => e.textContent))).every(t => /Plan this month/.test(t)), 'each month offers "Plan this month"');

  head('a series');
  await p.click('.drf-side [data-new]'); await p.waitForTimeout(300);
  await p.click('[data-kind="series"]'); await p.waitForTimeout(300);
  await p.fill('[data-f="series"]', 'Garage builds'); await p.dispatchEvent('[data-f="series"]', 'change');
  await p.fill('[data-idea]', 'build things in the garage'); await p.waitForTimeout(450);
  await p.click('[data-gist]'); await p.waitForTimeout(800); await p.click('[data-plan]'); await p.waitForTimeout(800);
  ok(/exactly 3 videos/.test(await lastPrompt()), 'three videos by default');
  const go4 = await importIt();
  ok(/1 series, 3 videos/.test(go4), 'the series and its videos come in', go4);

  head('brain dump');
  const before = await p.$$eval('.drf-item', x => x.length);
  await p.click('[data-dump]'); await p.waitForTimeout(300);
  await p.fill('#drf-dump', 'cold plunge week\ngarage builds series\ndesk tour'); await p.click('[data-sort]'); await p.waitForTimeout(900);
  const items = await p.$$eval('.drf-item', x => x.map(e => e.textContent.replace(/\s+/g, ' ')));
  ok(items.length === before + 3 && items.some(t => /Cold plunge week.*Weekly vlog · Idea/.test(t)), 'three new drafts, labelled, nothing planned', items.slice(0, 3).join(' | '));

  head('more ideas later: they add to what you have');
  const nDrafts = await p.$$eval('.drf-item', x => x.length);
  await p.click('[data-dump]'); await p.waitForTimeout(300);
  await p.fill('#drf-dump', 'SECOND DUMP\nno phone in bed\nevening wind-down for the alarm week\nlens test'); await p.click('[data-sort]'); await p.waitForTimeout(900);
  const dp = await p.evaluate(() => __prompts.find(x => /SECOND DUMP/.test(x)) || '');
  ok(/draft \S+ · Month · /.test(dp) && /episode \S+ · week of/.test(dp), 'Claude sees your drafts and what\'s in the Planner');
  ok((await p.$$eval('.drf-item', x => x.length)) === nDrafts + 2, 'one idea joins the month draft; the other two become drafts', `${nDrafts} → ${await p.$$eval('.drf-item', x => x.length)}`);
  const md = await p.evaluate(async () => (await Store.get('settings', 'plan-drafts')).find(x => x.kind === 'month' && /discipline month/.test(x.idea)));
  ok(md && /no phone in bed all month/.test(md.idea) && md.thread.filter(t => t.role === 'gist').length >= 2 && md.thread.slice(-1)[0].added, 'the month draft keeps its overviews and gets the idea, waiting to go in');

  head('a draft that adds to an episode already planned');
  const wd = await p.evaluate(async () => (await Store.get('settings', 'plan-drafts')).find(x => x.extend && x.kind === 'vlog'));
  ok(!!wd, 'the wind-down idea became a draft that adds to the alarm episode');
  await p.click(`[data-open="${wd.id}"]`); await p.waitForTimeout(700);
  ok(/Adds to the episode "Alarm across the room"/.test(await txt('[data-existing]')), 'the draft says what it adds to');
  await p.click('[data-gist]'); await p.waitForTimeout(800);
  ok(/Already in his planner — the episode "Alarm across the room"[\s\S]*First 5am \(Dark hallway; Alarm off\)/.test(await lastPrompt()), 'Claude is shown the episode\'s sequences and shots, to keep');
  await p.click('[data-plan]'); await p.waitForTimeout(800);
  const go5 = await importIt();
  const ep2 = await p.evaluate(async () => (await Store.all('vlogs')).values.find(v => v.title === 'Alarm across the room'));
  const mon = ep2 && ep2.acts.find(a => a.title === 'Monday');
  ok(/update 1/.test(go5), 'the import adds to the episode', go5);
  ok(ep2 && ep2.acts.length === 2 && ep2.acts[0].title === 'Sunday' && ep2.acts[0].beats[0].title === 'The setup', 'Sunday and its sequence are still there');
  ok(mon && mon.beats.map(b => b.title).join('|') === 'First 5am|Coffee|Evening wind-down', 'Monday keeps its sequences and gets the new one after them', mon && mon.beats.map(b => b.title).join('|'));
  ok(mon && mon.beats[0].shots.map(x => x.text).join('|') === 'Dark hallway|Alarm off|Bed at 9' && mon.beats[0].shots[1].lines[0].t === 'Day one.', 'a sequence keeps its shots and lines and gets the new shot');

  head('Refine folds the added idea in; starting over keeps the old overviews');
  await p.click(`[data-open="${md.id}"]`); await p.waitForTimeout(700);
  ok(/Waiting to go in/.test(await txt('.drf-main')), 'the added idea shows, waiting to go in');
  await p.click('[data-refine]'); await p.waitForTimeout(800);
  ok(/His changes and additions[\s\S]*no phone in bed all month[\s\S]*add to it, don't start over/.test(await lastPrompt()), 'Refine with an empty box sends the waiting idea, to add to the overview');
  const before2 = await p.evaluate(async () => (await Store.get('settings', 'plan-drafts')).find(x => x.id === document.querySelector('.drf-item[aria-current]').dataset.open).thread.filter(t => t.role === 'gist').length);
  await p.click('[data-gist]'); await p.waitForTimeout(800);
  const th = await p.evaluate(async () => (await Store.get('settings', 'plan-drafts')).find(x => x.id === document.querySelector('.drf-item[aria-current]').dataset.open).thread);
  ok(th.filter(t => t.role === 'gist').length === before2 + 1 && th.some(t => t.role === 'reset'), 'Start the gist over keeps the old overviews', `${before2} → ${th.filter(t => t.role === 'gist').length}`);
  ok(!/Your last overview/.test(await lastPrompt()), 'and the new gist starts from the description');

  head('from a month\'s page');
  await p.click('.tabbar [data-tab="weekly"]'); await p.waitForTimeout(600);
  await p.evaluate(async () => { const m = (await Months.all()).find(x => x.name === 'Discipline'); Screens.push('month', { id: m.id }); }); await p.waitForTimeout(800);
  const btn = await p.$('[data-plan-claude]');
  ok(!!btn, 'a month\'s page has ✦ Plan with Claude');
  if(btn){ await btn.click(); await p.waitForTimeout(900); }
  ok(await p.$eval('.tabbar [data-tab="draft"]', e => e.getAttribute('aria-current')) === 'page' && await p.$eval('[data-kind="month"]', e => e.getAttribute('aria-pressed')) === 'true',
    'it opens a Month draft on the Draft tab');
  ok((await p.inputValue('[data-f="monthStart"]')) === (await p.evaluate(async () => (await Months.all()).find(x => x.name === 'Discipline').startDate)), 'with that month\'s dates');

  head('Settings → Claude for planning');
  await p.evaluate(() => ShotAI.openSettings()); await p.waitForTimeout(600);
  const st = await txt('#sheet');
  ok(/Claude Code 2\.1\.300/.test(st) && /your Claude plan through Claude Code/.test(st), 'it shows Claude Code is here, using the Claude plan');
  await p.click('[data-test]'); await p.waitForTimeout(500);
  ok(/✓ Claude answered/.test(await txt('[data-planmsg]')), 'Test asks Claude and says it answered', await txt('[data-planmsg]'));
  await p.click('#sheet [data-cancel]'); await p.waitForTimeout(300);

  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
