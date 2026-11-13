/* v4: Claude through the person's own Claude plan, no API key.

   Claude Code (the `claude` command), signed in once with the Claude account,
   answers one prompt at a time in print mode (`claude -p`), on the plan's
   usage. Draft and Suggest shots ask through this on the laptop; without it
   they fall back to a prompt to paste into a Claude chat.

   - find(): the claude program — on PATH, or where the native installer,
     WinGet or npm put it (an app started before the install doesn't see the
     new PATH, so the usual places are looked at too)
   - status(): { found, version, path }
   - ask(prompt, o): the answer's text. The prompt goes in on stdin (long
     prompts are too big for a command line), it runs in an empty folder so no
     project is read, and ANTHROPIC_API_KEY is taken out of its environment
     so the plan is used, not a key. */
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WIN = process.platform === 'win32';
const ASK_MS = 4 * 60 * 1000;

function candidates() {
  const home = os.homedir();
  const env = process.env;
  const exe = WIN ? 'claude.exe' : 'claude';
  const list = [];
  for (const d of String(env.PATH || env.Path || '').split(path.delimiter)) if (d) list.push(path.join(d, exe), ...(WIN ? [path.join(d, 'claude.cmd')] : []));
  list.push(path.join(home, '.local', 'bin', exe), path.join(home, '.claude', 'local', exe), path.join(home, '.claude', 'local', 'claude'));
  if (WIN) {
    const la = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const ad = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    list.push(path.join(la, 'Microsoft', 'WinGet', 'Links', 'claude.exe'), path.join(la, 'Programs', 'claude', 'claude.exe'),
      path.join(ad, 'npm', 'claude.cmd'));
  } else {
    list.push('/usr/local/bin/claude', '/usr/bin/claude', path.join(home, '.npm-global', 'bin', 'claude'), '/opt/homebrew/bin/claude');
  }
  return list;
}
let found = undefined;
function find() {
  if (process.env.CS4_CLAUDE_BIN) return process.env.CS4_CLAUDE_BIN;
  if (found !== undefined && (found === null || fs.existsSync(found))) return found;
  found = candidates().find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }) || null;
  return found;
}
const forget = () => { found = undefined; };

function cleanEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_NO_ATTACH_CONSOLE;
  return env;
}
const needsShell = p => WIN && /\.(cmd|bat)$/i.test(p);

function status() {
  forget();
  const p = find();
  if (!p) return Promise.resolve({ found: false });
  return new Promise(resolve => {
    execFile(p, ['--version'], { timeout: 20000, windowsHide: true, env: cleanEnv(), shell: needsShell(p) }, (err, out) => {
      const v = String(out || '').trim().split(/\s+/)[0] || '';
      resolve({ found: !err || !!v, version: v, path: p, why: err && !v ? err.message : '' });
    });
  });
}

/* what went wrong, in words */
function why(text) {
  const t = String(text || '');
  if (/not logged in|please run \/login|invalid api key|authentication|unauthori[sz]ed|oauth/i.test(t))
    return 'Claude on this computer isn’t signed in. Open a terminal, type claude, and sign in with your Claude account (pick the subscription, not an API key).';
  if (/usage limit|rate limit|limit reached|5-hour|weekly limit/i.test(t))
    return 'Your Claude plan’s usage limit is reached for now — try again when it resets.';
  if (/credit balance|billing/i.test(t)) return 'Claude said: ' + t.trim().split('\n').pop().slice(0, 200);
  return (t.trim().split('\n').filter(Boolean).pop() || 'Claude didn’t answer').slice(0, 240);
}

let current = null;
function ask(prompt, o = {}) {
  const p = find();
  if (!p) return Promise.resolve({ ok: false, why: 'Claude Code isn’t installed on this computer.' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs4-claude-'));
  /* an answer, nothing else: no tools, no MCP servers, no saved session */
  const args = ['-p', '--output-format', 'text', '--tools', '', '--strict-mcp-config', '--no-session-persistence'];
  if (o.model) args.push('--model', String(o.model));
  return new Promise(resolve => {
    let out = '', err = '', done = false;
    let child;
    try { child = spawn(p, args, { cwd: dir, env: cleanEnv(), windowsHide: true, shell: needsShell(p) }); }
    catch (e) { return resolve({ ok: false, why: e.message }); }
    current = child;
    const finish = r => {
      if (done) return; done = true; clearTimeout(timer); current = null;
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
      resolve(r);
    };
    const timer = setTimeout(() => { try { child.kill(); } catch (e) {} finish({ ok: false, why: 'Claude took too long to answer — try again.' }); }, o.timeout || ASK_MS);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => finish({ ok: false, why: e.message }));
    child.on('close', code => {
      if (child.__stopped) return finish({ ok: false, stopped: true, why: 'Stopped' });
      const text = out.trim();
      if (code === 0 && text && !/^(error|execution error)/i.test(text)) return finish({ ok: true, text });
      finish({ ok: false, why: why(err + '\n' + out) });
    });
    try { child.stdin.end(String(prompt || '')); } catch (e) {}
  });
}
function stop() { if (current) { current.__stopped = true; try { current.kill(); } catch (e) {} } }

function register(ipcMain) {
  ipcMain.handle('cs4:claude-status', () => status());
  ipcMain.handle('cs4:claude-ask', (e, o) => ask(String(o && o.prompt || ''), { model: o && o.model }));
  ipcMain.handle('cs4:claude-stop', () => { stop(); return true; });
}

module.exports = { find, status, ask, stop, register, why, candidates };
