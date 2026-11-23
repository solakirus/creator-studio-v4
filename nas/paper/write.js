/* The words at the top of the paper: a headline, a one-line deck and a short
   story about your day.

   Claude writes them when Claude Code is on nastime and signed in with your
   Claude plan (CLAUDE_CODE_OAUTH_TOKEN, made once with `claude setup-token`).
   No API key. When Claude isn't there, or doesn't answer, plain rules write
   them instead — the paper always prints.

     words(edition, weather, cfg) → { headline, deck, story:[p1, p2], by:'claude'|'rules', note }
     rules(edition, weather)      → the same, without Claude
     claudeStatus(cfg)            → { ok, version, message } */
'use strict';
const { spawn, execFile } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

/* ------------------------------------------------------------ plain rules */
const short = (s, n) => { const w = String(s || '').split(/\s+/); return w.length > n ? w.slice(0, n).join(' ') : w.join(' '); };
function clock(at){
  const m = /^(\d{1,2}):(\d{2})/.exec(at || '');
  if (!m) return '';
  const h = +m[1], mi = +m[2], hh = ((h + 11) % 12) + 1;
  return mi ? `${hh}:${String(mi).padStart(2, '0')}` : String(hh);
}
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const say = n => NUM[n] || String(n);
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

function rules(e, w){
  const left = e.today.filter(x => !x.done && !x.skipped);
  const timed = left.filter(x => x.at);
  const rank = x => ({ workout: 0, shoot: 1, publish: 2, edit: 3 }[x.kind] ?? 4);
  const anchors = timed.slice().sort((a, b) => rank(a) - rank(b) || a.at.localeCompare(b.at)).slice(0, 2)
    .sort((a, b) => a.at.localeCompare(b.at));

  let headline;
  if (anchors.length) headline = anchors.map(x => `${cap(short(x.title, 5))} at ${clock(x.at)}.`).join(' ');
  else if (left.length) headline = `${cap(say(left.length))} thing${left.length === 1 ? '' : 's'} on the list today.`;
  else headline = 'A clear day. Nothing on the list.';

  const posting = [];
  e.due.forEach(g => g.items.forEach(i => { if (i.today) posting.push(i.title); }));
  let deck;
  if (posting.length) deck = `${posting.length === 1 ? `“${posting[0]}” posts` : `${cap(say(posting.length))} videos post`} today.`;
  else if (e.shoots.length) deck = `${cap(plural(e.shoots.length, 'video'))} to film today, ${plural(e.counts.shots, 'shot')} in all.`;
  else if (e.openPast.length) deck = `${cap(plural(e.openPast.length, 'thing'))} from earlier in the week still open.`;
  else deck = e.pre ? 'The run-up to Day 1 continues.' : `${e.dayLabel}. Keep the streak going.`;

  const p1 = [], p2 = [];
  if (e.workout) {
    const wn = /day|workout|session|run|lift/i.test(e.workout.title) ? e.workout.title : e.workout.title + ' workout';
    p1.push(`${wn}${e.workout.time ? ` at ${e.workout.time.toLowerCase().replace(/\./g, '').replace(':00', '')}` : ''} ${e.workout.done ? 'is done' : 'opens the day'}${e.workout.lifts.length ? `, ${say(e.workout.lifts.length)} exercise${e.workout.lifts.length === 1 ? '' : 's'}` : ''}.`);
  }
  if (e.shoots.length) {
    const s = e.shoots[0];
    p1.push(e.shoots.length === 1
      ? `On the shoot list: ${s.title}${s.total ? `, ${plural(s.total, 'shot')}` : ''}${s.time ? ` at ${s.time.toLowerCase().replace(/\./g, '')}` : ''}. The frames are on the To film page.`
      : `${cap(say(e.shoots.length))} videos to film, starting with ${s.title}${s.time ? ` at ${s.time.toLowerCase().replace(/\./g, '')}` : ''}. Each one is on the To film page with a frame to aim for.`);
  }
  const others = left.filter(x => !['workout', 'shoot'].includes(x.kind)).slice(0, 3);
  if (others.length) p1.push(`Also on the list: ${list(others.map(x => x.title))}.`);
  if (!p1.length) p1.push(left.length ? `${cap(plural(left.length, 'thing'))} to get through today.` : 'Nothing is planned today. Use it to plan the next shoot.');

  if (posting.length) p2.push(`${posting.length === 1 ? `“${posting[0]}” is` : list(posting.map(t => `“${t}”`)) + ' are'} set to post today.`);
  const late = []; e.due.forEach(g => g.items.forEach(i => { if (i.late) late.push(i.title); }));
  if (late.length) p2.push(`${late.length === 1 ? `“${late[0]}” missed its post date` : `${cap(say(late.length))} videos missed their post dates`} and ${late.length === 1 ? 'isn’t' : 'aren’t'} out yet.`);
  if (e.openPast.length) p2.push(`${cap(plural(e.openPast.length, 'task'))} from earlier this week ${e.openPast.length === 1 ? 'is' : 'are'} still open.`);
  const best = e.habits.filter(h => h.streak && h.streak.n >= 2).sort((a, b) => b.streak.n - a.streak.n)[0];
  if (best) p2.push(`${best.name} is on a ${best.streak.n}-${best.streak.unit.replace(/s$/, '')} streak. Today keeps it going.`);
  if (w && w.words) p2.push(`Weather: ${w.words.toLowerCase()}, high of ${w.high}°${w.sunset ? `, sunset at ${w.sunset.toLowerCase()}` : ''}.`);
  if (!p2.length) p2.push(e.pre ? 'Every day before Day 1 is practice for the thousand after it.' : `${e.dayLabel}. Show up for it.`);

  return { headline, deck, story: [p1.join(' '), p2.join(' ')], by: 'rules' };
}

/* ------------------------------------------------------------ Claude, on your plan */
function findClaude(cfg){
  const c = [cfg && cfg.claudeBin, path.join(os.homedir(), '.local', 'bin', 'claude'), '/usr/local/bin/claude', '/usr/bin/claude'].filter(Boolean);
  for (const p of c) { try { fs.accessSync(p, fs.constants.X_OK); return p; } catch (e) {} }
  return null;
}
const cleanEnv = () => { const e = { ...process.env }; delete e.ANTHROPIC_API_KEY; delete e.ANTHROPIC_AUTH_TOKEN; return e; };

function claudeStatus(cfg){
  return new Promise(res => {
    const p = findClaude(cfg);
    if (!p) return res({ ok: false, message: 'Claude Code isn’t installed on nastime yet' });
    if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) return res({ ok: false, message: 'No CLAUDE_CODE_OAUTH_TOKEN — the paper uses plain rules for its words' });
    execFile(p, ['--version'], { timeout: 20000, env: cleanEnv() }, (err, out) =>
      res(err ? { ok: false, message: 'Claude Code didn’t start: ' + err.message } : { ok: true, version: String(out).trim(), message: '' }));
  });
}

function ask(prompt, cfg){
  return new Promise((resolve, reject) => {
    const p = findClaude(cfg);
    if (!p) return reject(new Error('Claude Code isn’t installed'));
    if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) return reject(new Error('No CLAUDE_CODE_OAUTH_TOKEN'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-'));
    const args = ['-p', '--output-format', 'text', '--tools', '', '--strict-mcp-config', '--no-session-persistence'];
    if (cfg && cfg.claudeModel) args.push('--model', cfg.claudeModel);
    const child = spawn(p, args, { cwd: dir, env: cleanEnv() });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Claude took too long')); }, (cfg && cfg.claudeTimeout) || 180000);
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
      if (code !== 0) return reject(new Error((err || out || `Claude exited with ${code}`).trim().split('\n').slice(-1)[0]));
      resolve(out);
    });
    child.stdin.end(prompt);
  });
}

/* what Claude sees: the facts, nothing else */
function facts(e, w){
  const it = x => [x.time, x.title, x.note, x.done ? '(done)' : ''].filter(Boolean).join(' — ');
  return {
    date: e.date, day: e.dayLabel, week: e.pre ? null : e.weekNo, name: e.name || null,
    today: e.today.map(it),
    toFilm: e.shoots.map(s => ({ title: s.title, time: s.time, video: s.video || null, from: s.from || null, shots: s.total, hook: s.hook || null })),
    workout: e.workout ? { title: e.workout.title, time: e.workout.time, exercises: e.workout.lifts.map(l => l.name) } : null,
    videos: e.due.map(g => ({ channel: g.channel, items: g.items.map(i => `${i.title} — ${i.when}${i.stage ? ' (' + i.stage + ')' : ''}`) })),
    stillOpenFromThisWeek: e.openPast.slice(0, 6).map(x => x.title),
    habits: e.habits.map(h => ({ name: h.name, streak: h.streak ? `${h.streak.n} ${h.streak.unit}` : null })),
    weather: w ? { high: w.high, low: w.low, sky: w.words, sunset: w.sunset } : null
  };
}

function prompt(e, w, cfg){
  return [
    `You write the front page of a one-person morning newspaper called "${(cfg && cfg.paperName) || 'The Kris Times'}".`,
    'The reader is a content creator on a 1,000-day self-improvement journey. He reads this on paper first thing, instead of his phone.',
    'Write from the facts below only. Never invent appointments, numbers, names or events. If a list is empty, say less, not more.',
    'Style: a real newspaper\'s front page — plain, confident, specific, second person ("you"). No hype, no emoji, no exclamation marks, no motivational clichés.',
    '',
    'Return ONLY a JSON object, no code fence, no other words:',
    '{"headline": "...", "deck": "...", "story": ["...", "..."]}',
    '- headline: at most 10 words. The day\'s two most important things, with times if they have them, like "Push day at 6. Morning sequence shot by 10."',
    '- deck: one sentence, at most 20 words: the next most important thing (a video posting, a deadline, a streak).',
    '- story: two short paragraphs, 35 to 60 words each. First: how the day runs, in order. Second: what\'s due, what\'s still open, the streaks, the weather if it matters for filming.',
    '',
    'Facts:',
    JSON.stringify(facts(e, w), null, 1)
  ].join('\n');
}

function check(o){
  if (!o || typeof o !== 'object') return null;
  const s = v => String(v || '').replace(/\s+/g, ' ').trim();
  const headline = s(o.headline), deck = s(o.deck);
  const story = Array.isArray(o.story) ? o.story.map(s).filter(Boolean).slice(0, 2) : [];
  if (!headline || headline.length > 90 || deck.length > 200 || story.length < 1 || story.some(p => p.length > 520)) return null;
  if (story.length === 1) story.push('');
  return { headline, deck, story };
}

async function words(e, w, cfg){
  const fallback = rules(e, w);
  if (cfg && cfg.claude === false) return { ...fallback, note: 'Claude is switched off' };
  try {
    const out = await ask(prompt(e, w, cfg), cfg);
    const m = /\{[\s\S]*\}/.exec(out);
    const got = m ? check(JSON.parse(m[0])) : null;
    if (!got) return { ...fallback, note: 'Claude’s answer didn’t fit the page, so plain rules wrote it' };
    return { ...got, by: 'claude' };
  } catch (err) {
    return { ...fallback, note: err.message };
  }
}

module.exports = { words, rules, claudeStatus, prompt, facts, check, findClaude };
