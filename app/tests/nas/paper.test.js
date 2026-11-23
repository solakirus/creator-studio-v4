/* The morning paper (nas/paper) end to end, without nastime:
   a stand-in Sync Hub holding a day of plans, a stand-in IPP printer, and the
   real paper code — pull, edition, words, HTML, Chromium's PDF (when Chromium
   is on this machine), print.

     node app/tests/nas/paper.test.js            (also part of npm test)
     PAPER_KEEP=/some/dir node …                 keep the PDF, HTML and a PNG of each page there */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const root = path.join(__dirname, '..', '..', '..');
const P = p => path.join(root, 'nas', 'paper', p);

let pass = 0, fail = 0;
const t = (n, c, x) => { console.log(`  ${c ? 'ok ' : 'FAIL'}  ${n.padEnd(64)} ${x === undefined ? '' : x}`); c ? pass++ : fail++; };

/* a 16×9 grey PNG and a 2-frame GIF, so frames are real pictures */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAAAAAAeQfPuAAAAEklEQVR4XmNsYEAFTGj8gRIAAFH6AJJygcGuAAAAAElFTkSuQmCC', 'base64');
const GIF = Buffer.from('R0lGODdhBAAEAIEAADw8PAAAAAAAAAAAACwAAAAABAAEAAAICQABCBxIsCCAgAA7', 'base64');

const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-test-'));
  const shotlib = path.join(tmp, 'shotlib');
  fs.mkdirSync(path.join(shotlib, 'Morning', 'coffee'), { recursive: true });
  fs.writeFileSync(path.join(shotlib, 'Morning', 'coffee', 'pour.gif'), GIF);

  /* ---- the day: program day 54 is today ---- */
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 53);
  const D = 54;
  const at = (dd, hh, mm) => { const x = new Date(today); x.setDate(x.getDate() + dd); x.setHours(hh, mm || 0, 0, 0); return x.getTime(); };
  const recs = [];
  const put = (store, key, data) => recs.push({ store, id: JSON.stringify(key), updatedAt: Date.now(), data });
  put('settings', 'program', { start: start.getTime() });
  put('settings', 'name', 'Kris Catten');
  put('routines', 'r1', { id: 'r1', name: 'Push', items: [{ name: 'Bench press', sets: 4, reps: 6 }, { name: 'Overhead press', sets: 3, reps: 8 }] });
  put('tasks', 1, { id: 1, day: D, title: 'Push day', at: '06:00', kind: 'workout', routineId: 'r1', view: 'todo', subs: [] });
  put('tasks', 2, { id: 2, day: D, title: 'Shoot the morning routine', at: '08:30', mins: 45, kind: 'shoot', clipId: 'c1', view: 'todo',
    page: { slots: [{ item: '', text: 'Alarm off' }, { item: 'h:C:/Users/Khale/shot-library|Morning/coffee/pour.gif', text: 'Pour over' }, { item: '', text: 'Out the door' }] },
    subs: [{ t: 'Alarm off', shot: 0, done: true }, { t: 'Pour over', shot: 1 }, { t: 'Out the door', shot: 2 }] });
  put('tasks', 3, { id: 3, day: D, title: 'Garage B-roll', at: '13:00', kind: 'shoot', view: 'todo',
    page: { slots: [{ item: 'db:li_abc', text: 'Wide of the bench' }] }, subs: [{ t: 'Wide of the bench', shot: 0 }] });
  put('task-frames', 'db:li_abc', { uid: 'db:li_abc', kind: 'image', name: 'bench.png', blob: { __blob: 'image/png', b64: PNG.toString('base64') } });
  put('tasks', 4, { id: 4, day: D, title: 'Vlog 12 — act 2', at: '16:00', kind: 'shoot', beatId: 'b1', vlogId: 'v1', cad: 'Vlog 12 · Act 2', view: 'todo',
    subs: [{ t: 'Walk in' }, { t: 'Talk to camera' }] });
  put('vlogs', 'v1', { id: 'v1', title: 'Vlog 12' });
  put('tasks', 5, { id: 5, day: D, title: 'Call about the French drain quote', at: '12:00', life: 'home', note: 'From Punch<br>Ask about gravel', view: 'todo', subs: [] });
  put('tasks', 6, { id: 6, day: D, title: 'Drink water', habitId: 'h2', view: 'todo', subs: [] });
  put('tasks', 7, { id: 7, day: D - 2, title: 'Renew the car tag', view: 'todo', subs: [] });
  put('tasks', 8, { id: 8, day: D + 1, title: 'Plan Vlog 13', at: '09:00', view: 'todo', subs: [] });
  put('tasks', 9, { id: 9, day: D, title: 'Deleted one', view: 'todo', subs: [] });
  recs.push({ store: 'tasks', id: '9', updatedAt: Date.now() + 1, deleted: true });
  put('clips', 'c1', { id: 'c1', title: 'Morning reset in 60 seconds', channel: '1k Soldier of Life', stage: 'editing', scheduledAt: at(0, 18), hook: 'Same alarm, different me.' });
  put('clips', 'c2', { id: 'c2', title: 'Garage tour', channel: 'Fix & Invest', stage: 'planned', scheduledAt: at(2, 9) });
  put('clips', 'c3', { id: 'c3', title: 'Old one', channel: 'Fix & Invest', stage: 'published', scheduledAt: at(1, 9) });
  put('settings', 'habit:h2', { id: 'h2', name: 'Drink water', per: 'day', days: [0, 1, 2, 3, 4, 5, 6], source: { type: 'own' }, createdKey: isoOf(start), order: 1 });
  put('settings', 'habit:h1', { id: 'h1', name: 'Work out', per: 'week', times: 6, days: [0, 1, 2, 3, 4, 5, 6], source: { type: 'kind', kind: 'workout' }, createdKey: isoOf(start), order: 0 });
  put('sessions', 's1', { id: 's1', finishedAt: at(-1, 7) });
  put('swipes', 'x', { id: 'x', big: 'dropped on the way in' });

  const hubMod = require('../helpers/mini-synchub');
  const hubSrv = await hubMod.start({ token: 'tok', page: 7 });
  await fetch(hubSrv.url + '/sync/creator-studio-4', { method: 'POST', headers: { Authorization: 'Bearer tok' }, body: JSON.stringify({ changes: recs }) });

  /* ---- a printer: answers Get-Printer-Attributes and Print-Job ---- */
  const Ipp = require(P('ipp.js'));
  const jobs = [];
  const printer = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', d => chunks.push(d));
    req.on('end', () => {
      const body = Buffer.concat(chunks), op = body.readUInt16BE(2);
      const reply = (attrs) => { const head = Buffer.alloc(8); head[0] = 2; head.writeUInt16BE(0, 2); head.writeUInt32BE(body.readUInt32BE(4), 4);
        res.writeHead(200, { 'Content-Type': 'application/ipp' }); res.end(Buffer.concat([head, Buffer.from([0x01]),
          Ipp.attr(Ipp.VT.charset, 'attributes-charset', 'utf-8'), Ipp.attr(Ipp.VT.lang, 'attributes-natural-language', 'en'), ...attrs, Buffer.from([0x03])])); };
      if (op === 0x000B) return reply([Buffer.from([0x04]), Ipp.attr(Ipp.VT.text, 'printer-make-and-model', 'Brother HL-L2350DW'),
        Ipp.attr(Ipp.VT.enum, 'printer-state', 3), Ipp.attr(Ipp.VT.mime, 'document-format-supported', ['application/octet-stream', 'application/pdf']),
        Ipp.attr(Ipp.VT.keyword, 'sides-supported', ['one-sided', 'two-sided-long-edge'])]);
      const i = body.indexOf(Buffer.from('%PDF'));
      jobs.push({ body, pdf: i >= 0 ? body.subarray(i) : null, duplex: body.includes(Buffer.from('two-sided-long-edge')) });
      reply([Buffer.from([0x02]), Ipp.attr(Ipp.VT.integer, 'job-id', 42)]);
    });
  }).listen(0, '127.0.0.1');
  await new Promise(r => printer.on('listening', r));

  /* ---- the paper, as nastime runs it ---- */
  Object.assign(process.env, { SYNC_HUB: hubSrv.url, SYNC_TOKEN: 'tok', PRINTER: `127.0.0.1:${printer.address().port}`,
    DATA: path.join(tmp, 'paper'), SHOTLIB: shotlib, CLAUDE: 'off', LAT: '', LON: '' });
  delete process.env.PAPER_START;
  const paper = require(P('paper.js'));
  const iso = isoOf(today);

  /* edition */
  const { e } = await paper.edition(iso);
  t('pulls every page from Sync Hub, keeps only the stores it uses', paper.hub.count() > 0 && !paper.hub.all('swipes').length, paper.hub.count());
  t('day label counts from settings.program', e.dayLabel === 'Day 54 of 1,000' && e.weekNo === 8, e.dayLabel);
  t('today: real tasks, by clock, deleted and habits left out', e.today.map(x => x.title).join('|') ===
    'Push day|Shoot the morning routine|Call about the French drain quote|Garage B-roll|Vlog 12 — act 2', e.today.map(x => x.id).join(','));
  t('a life task shows its area and plain note', e.today[2].tag === 'HOME' && e.today[2].note === 'From Punch · Ask about gravel', e.today[2].note);
  t('workout lifts come from its routine', e.workout && e.workout.lifts.length === 2 && e.workout.lifts[0].amount === '4 × 6');
  t('three shoots on the To film page', e.shoots.length === 3, e.shoots.length);
  const s1 = e.shoots[0], s2 = e.shoots[1], s3 = e.shoots[2];
  t('a laptop frame (h:<laptop root>|path) is found in the Shot Library', s1.frame && /pour\.gif$/.test(s1.frame.path), s1.frame && s1.frame.path);
  t('a frame the app copied (task-frames) is used from Sync', s2.frame && /\.png$/.test(s2.frame.path), s2.frame && s2.frame.path);
  t('a shoot with no frames still lists its shots', !s3.frame && s3.total === 2 && /Vlog 12/.test(s3.from), s3.from);
  t('shots and taken counted', s1.total === 3 && s1.taken === 1 && s1.video === 'Morning reset in 60 seconds');
  t('videos by channel: today, coming up; published left out', e.due.length === 2 && e.due[0].items[0].today && !JSON.stringify(e.due).includes('Old one'));
  t('still open from earlier this week', e.openPast.length === 1 && e.openPast[0].ago === 2);
  t('habits from settings, with seven dots', e.habits.length === 2 && e.habits[0].name === 'Work out' && e.habits[0].dots.length === 7);
  t('yesterday’s workout session fills the Work out dot', e.habits[0].dots[5].st === 'done', e.habits[0].dots.map(d => d.st).join(','));
  t('this week has tomorrow’s plan', e.week[0].items[0].title === 'Plan Vlog 13');

  /* words without Claude */
  const W = require(P('write.js'));
  const w = W.rules(e, null);
  t('rules write a headline from the timed anchors', /^Push day at 6\. Shoot the morning routine at 8:30\.$/.test(w.headline), w.headline);
  t('the deck names what posts today', /Morning reset in 60 seconds/.test(w.deck), w.deck);
  t('Claude’s answer is checked before it goes on the page', !W.check({ headline: 'x'.repeat(200), deck: '', story: ['a'] }) && !!W.check({ headline: 'Hi', deck: 'There', story: ['One', 'Two'] }));
  t('the prompt holds the day’s facts only', /Shoot the morning routine/.test(W.prompt(e, null, {})) && !/French drain quote at/.test(W.prompt(e, null, {}).split('Facts:')[0]));

  /* words from Claude: a stand-in `claude` that answers like Claude Code -p */
  if (process.platform !== 'win32') {
    const fake = path.join(tmp, 'claude');
    fs.writeFileSync(fake, `#!/bin/sh\ncat > ${path.join(tmp, 'prompt.txt')}\nprintf '%s' "$FAKE_OUT"\n`, { mode: 0o755 });
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'sk-ant-oat01-test';
    process.env.ANTHROPIC_API_KEY = 'must-not-be-passed';
    process.env.FAKE_OUT = 'Here you go:\n{"headline":"Lift at 6. Film by 9.","deck":"One video posts tonight.","story":["First part.","Second part."]}';
    const cw = await W.words(e, null, { claudeBin: fake });
    t('Claude’s words are used when they fit', cw.by === 'claude' && cw.headline === 'Lift at 6. Film by 9.' && cw.story[1] === 'Second part.', cw.headline);
    t('Claude was given the day on stdin', /Shoot the morning routine/.test(fs.readFileSync(path.join(tmp, 'prompt.txt'), 'utf8')));
    process.env.FAKE_OUT = 'Sorry, I can not help';
    const bad = await W.words(e, null, { claudeBin: fake });
    t('an answer that isn’t the JSON falls back to the rules', bad.by === 'rules' && bad.headline === w.headline && !!bad.note, bad.note);
    const none = await W.words(e, null, { claudeBin: path.join(tmp, 'nope') });
    t('no Claude at all still gives words', none.by === 'rules');
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN; delete process.env.ANTHROPIC_API_KEY; delete process.env.FAKE_OUT;
  }

  /* layout */
  const L = require(P('layout.js'));
  const html = L.html(e, w, null, { paperName: 'The Kris Times', place: 'Plant City, Fla.', src: f => 'file://' + f.path });
  t('two pages: front and To film', (html.match(/class="page"/g) || []).length === 2 && L.pageCount(e) === 2);
  t('the front page carries the headline and the list', html.includes(w.headline.replace(/'/g, '&#39;')) && html.includes('Call about the French drain quote'));
  t('the To film page has each video and its frame', html.includes('TO FILM TODAY') && html.includes('pour.gif') && html.includes('NO FRAME YET'));
  t('text is escaped', !L.html({ ...e, today: [{ ...e.today[0], title: '<script>x</script>' }] }, w, null, {}).includes('<script>x'));
  const six = { ...e, shoots: Array.from({ length: 6 }, (_, i) => ({ ...s3, title: 'Video ' + i })) };
  t('more than five videos go on to an A3', (L.html(six, w, null, {}).match(/class="page"/g) || []).length === 3);

  /* printer */
  const pr = await Ipp.probe(process.env.PRINTER);
  t('the printer check reads model, PDF and two-sided', pr.ok && pr.model === 'Brother HL-L2350DW' && pr.pdf && pr.duplex, JSON.stringify(pr).slice(0, 90));
  t('an address with nothing on it says so', !(await Ipp.probe('127.0.0.1:1')).ok);
  t('target forms', Ipp.parseTarget('192.168.4.50').uri === 'ipp://192.168.4.50:631/ipp/print' &&
    Ipp.parseTarget('raw://10.0.0.2').port === 9100 && Ipp.parseTarget('none').kind === 'none' &&
    Ipp.parseTarget('ipp://cups:631/printers/Brother').path === '/printers/Brother');

  /* the whole run, with Chromium when this machine has it */
  const R = require(P('render.js'));
  if (R.findChrome()) {
    const r = await paper.printDay(iso, 'test');
    t('makes the PDF and prints it', r.ok && jobs.length === 1 && jobs[0].pdf && jobs[0].pdf.subarray(0, 4).toString() === '%PDF', r.message);
    t('two pages go out two-sided', jobs[0] && jobs[0].duplex && r.pages === 2);
    const txt = jobs[0] ? jobs[0].pdf.toString('latin1') : '';
    t('the PDF is two Letter pages', (txt.match(/\/Type\s*\/Page[^s]/g) || []).length === 2 && /612(\.0+)?\s+792/.test(txt));
    t('the history remembers it', paper.state.history[0] && paper.state.history[0].ok);
    if (process.env.PAPER_KEEP) {
      const k = process.env.PAPER_KEEP; fs.mkdirSync(k, { recursive: true });
      fs.copyFileSync(path.join(tmp, 'paper', 'out', iso + '.pdf'), path.join(k, 'paper.pdf'));
      fs.copyFileSync(path.join(tmp, 'paper', 'out', iso + '.html'), path.join(k, 'paper.html'));
    }
  } else console.log('  (no Chromium here — PDF and print checks skipped)');

  /* the HTTP side, as Caddy passes it on */
  await new Promise(r => paper.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${paper.server.address().port}/paper`;
  const st = await (await fetch(base + '/status')).json();
  t('/paper/status', st.sync.ready && st.sync.records > 0 && st.printer.includes('127.0.0.1'));
  const page = await (await fetch(base + '/today.html?screen=1')).text();
  t('/paper/today.html serves frames through /paper/frame', page.includes('/paper/frame?p=') && page.includes('TO FILM TODAY'));
  const fr = await fetch(base + '/frame?p=' + encodeURIComponent(s1.frame.path));
  t('/paper/frame serves a Shot Library picture', fr.ok && fr.headers.get('content-type') === 'image/gif');
  const bad = await fetch(base + '/frame?p=' + encodeURIComponent('/etc/passwd'));
  t('/paper/frame refuses anything outside the library', bad.status === 403);
  t('/paper/ is the paper’s page', /Print it now/.test(await (await fetch(base + '/')).text()));

  /* the morning schedule */
  const at430 = new Date(today); at430.setHours(4, 31);
  paper.state.lastAuto = ''; paper.state.nextTry = 0;
  t('due at 4:31, not at 3:00 or 9:00', paper.due(at430) && !paper.due(new Date(new Date(today).setHours(3))) && !paper.due(new Date(new Date(today).setHours(9))));
  paper.state.lastAuto = iso;
  t('not twice the same morning', !paper.due(at430));

  paper.server.close(); printer.close(); await hubSrv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
