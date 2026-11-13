/* electron/claude.js: Claude through the Claude plan (Claude Code's
   `claude -p`), with a stand-in claude program that records how it was run.

     node app/tests/electron/claude-plan.test.js */
const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fakeclaude-'));
const log = path.join(dir, 'log.json');
const WIN = process.platform === 'win32';
const fake = path.join(dir, WIN ? 'claude.cmd' : 'claude');
const js = path.join(dir, 'fake.js');
fs.writeFileSync(js, `
const fs = require('fs'); let input = '';
process.stdin.on('data', d => input += d).on('end', () => {
  const a = process.argv.slice(2);
  if (a[0] === '--version') { console.log('2.1.200 (Claude Code)'); return; }
  fs.writeFileSync(${JSON.stringify(log)}, JSON.stringify({ args: a, cwd: process.cwd(), key: process.env.ANTHROPIC_API_KEY || null, input }));
  if (/SIGNED-OUT/.test(input)) { console.error('Invalid API key · Please run /login'); process.exit(1); }
  if (/LIMIT/.test(input)) { console.log('Claude usage limit reached. Your limit will reset at 3pm'); process.exit(1); }
  if (/SLOW/.test(input)) { setTimeout(() => console.log('late'), 60000); return; }
  console.log('THE IDEA\\nA video about ' + input.slice(0, 20));
});
if (process.argv[2] === '--version') process.stdin.emit('end');`);
fs.writeFileSync(fake, WIN ? `@node "${js}" %*\r\n` : `#!/bin/sh\nexec node "${js}" "$@"\n`);
fs.chmodSync(fake, 0o755);
process.env.CS4_CLAUDE_BIN = fake;
process.env.ANTHROPIC_API_KEY = 'sk-should-not-be-used';
const C = require('../../../electron/claude.js');

(async () => {
  console.log('\n— finding it —');
  const st = await C.status();
  ok(st.found && st.version === '2.1.200', 'status finds claude and its version', JSON.stringify(st));
  const cands = C.candidates();
  ok(cands.some(p => /\.local[\\/]bin[\\/]claude/.test(p)), 'it also looks where the native installer puts it (an app opened before the install has the old PATH)');

  console.log('\n— asking —');
  const long = 'Plan this: ' + 'x'.repeat(40000);
  const r = await C.ask('morning coffee video\n' + long, { model: 'sonnet' });
  const L = JSON.parse(fs.readFileSync(log, 'utf8'));
  ok(r.ok && /^THE IDEA\nA video about morning coffee/.test(r.text), 'the answer comes back', r.text && r.text.slice(0, 40));
  ok(JSON.stringify(L.args) === JSON.stringify(['-p', '--output-format', 'text', '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--model', 'sonnet']),
    'print mode, plain text, no tools or MCP servers, no saved session, the model picked', JSON.stringify(L.args));
  ok(L.input.length > 40000, 'the prompt goes in on stdin, so a long one fits', L.input.length);
  ok(L.key === null, 'no API key reaches it, so the Claude plan is used');
  ok(/cs4-claude-/.test(L.cwd) && !fs.existsSync(L.cwd), 'it runs in an empty folder of its own, removed after', L.cwd);

  console.log('\n— when it can\'t —');
  const s1 = await C.ask('SIGNED-OUT');
  ok(!s1.ok && /isn.t signed in/.test(s1.why) && /type claude/.test(s1.why), 'signed out: says how to sign in', s1.why);
  const s2 = await C.ask('LIMIT');
  ok(!s2.ok && /usage limit/.test(s2.why), 'plan limit reached: says so', s2.why);
  const p3 = C.ask('SLOW'); setTimeout(() => C.stop(), 500);
  const s3 = await p3;
  ok(!s3.ok && s3.stopped, 'Stop stops it');
  process.env.CS4_CLAUDE_BIN = path.join(dir, 'missing');
  const s4 = await C.ask('x');
  ok(!s4.ok, 'no claude program: a plain no, not a crash', s4.why);

  console.log(`\nclaude plan  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
