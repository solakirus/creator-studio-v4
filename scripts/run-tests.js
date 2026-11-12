// Runs every harness in app/tests. Exit code 1 if any fails.
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'app', 'tests');
let failed = 0;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort()
  .concat(fs.readdirSync(path.join(dir, 'electron')).filter(f => f.endsWith('.test.js')).sort().map(f => 'electron/' + f));
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const bad = r.status !== 0 || /\bFAIL\b/.test(out);
  if (bad) failed++;
  console.log(`${bad ? 'FAIL' : 'ok  '}  ${f}`);
  if (bad) console.log(out.split('\n').filter(l => /FAIL|Error/.test(l)).slice(0, 10).map(l => '      ' + l).join('\n'));
}
console.log(failed ? `\n${failed} test file(s) failed` : '\nall tests pass');
process.exit(failed ? 1 : 0);
