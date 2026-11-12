/* Desktop updates from GitHub OR nastime, newest wins (electron/main.js WebUpdate).

   Two stand-in servers: "GitHub" and "nastime". Checks: nastime with a newer
   version is used (files fetched from nastime); GitHub newer → GitHub; an
   older version anywhere is never taken; one place down → the other still works.

     node app/tests/webupdate-sources.e2e.js */
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), Module = require('module'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'srcupd-')), user = path.join(T, 'userData');
cp.execFileSync('node', [ROOT + '/scripts/copy-web.js'], { stdio: 'ignore' });
const shipped = JSON.parse(fs.readFileSync(ROOT + '/www/update.json'));
const { write } = require(ROOT + '/scripts/web-manifest');
function site(name, tag, madeOffsetMin){
  const d = path.join(T, name); fs.rmSync(d, { recursive: true, force: true });
  fs.cpSync(ROOT + '/www', d, { recursive: true });
  fs.appendFileSync(d + '/js/quickadd.js', `\n/* ${tag} */\n`);
  const m = write(d); m.made = new Date(Date.parse(shipped.made) + madeOffsetMin * 60000).toISOString();
  fs.writeFileSync(d + '/update.json', JSON.stringify(m)); return m;
}
const hits = { gh: [], nas: [] }, down = { gh: false, nas: false };
const serve = (k) => http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split('?')[0]); hits[k].push(p);
  const f = path.join(T, k, p);
  if (down[k] || !fs.existsSync(f)) { r.statusCode = down[k] ? 503 : 404; return r.end(); }
  r.end(fs.readFileSync(f));
});
let pass = 0, fail = 0; const t = (n, c, x = '') => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${n} ${x}`); c ? pass++ : fail++; };
const gh = serve('gh').listen(18931), nas = serve('nas').listen(18932);
setTimeout(async () => {
  process.env.CS_UPDATE_REMOTE = 'http://127.0.0.1:18931/';
  const electron = { app: { requestSingleInstanceLock: () => true, quit(){}, setAsDefaultProtocolClient(){}, on(){},
      whenReady: () => new Promise(() => {}), getPath: () => user, setAppUserModelId(){}, relaunch(){}, exit(){} },
    protocol: { registerSchemesAsPrivileged(){}, handle(){} }, net: { fetch: (u, o) => fetch(u, o) },
    shell: {}, Menu: { setApplicationMenu(){} }, ipcMain: { handle(){}, on(){} }, dialog: {}, Notification: function(){}, session: {}, BrowserWindow: function(){} };
  const orig = Module._load; Module._load = function(req, ...a){ return req === 'electron' ? electron : orig.call(this, req, ...a); };
  const fresh = () => { delete require.cache[require.resolve(ROOT + '/electron/main.js')]; return require(ROOT + '/electron/main.js').WebUpdate; };
  const clear = () => { hits.gh.length = 0; hits.nas.length = 0; };
  const files = k => hits[k].filter(h => h !== '/update.json');

  /* GitHub a little newer than the install, nastime newer still (published from the laptop) */
  site('gh', 'github', 5); const nasM = site('nas', 'nastime', 10);
  let W = fresh(); W.choose();
  t('the nastime address is kept', JSON.stringify(W.setSources(['http://127.0.0.1:18932'])) === '["http://127.0.0.1:18932/"]');
  clear(); let s = await W.check();
  t('nastime\'s newer version is taken', s.state === 'ready' && s.build === nasM.build && s.from === 'nastime', JSON.stringify(s));
  t('its files came from nastime, not GitHub', files('nas').join() === '/js/quickadd.js' && !files('gh').length, files('nas').join() + ' | ' + files('gh').join());
  W = fresh(); W.choose(); W.ok();
  t('it runs next launch', fs.readFileSync(path.join(user, 'web', nasM.build, 'js/quickadd.js'), 'utf8').includes('nastime'));
  W = fresh(); W.choose();
  s = await W.check();
  t('GitHub\'s older version is never taken over it', s.state === 'current', JSON.stringify(s));

  /* Claude pushes to GitHub: newer than everything */
  const ghM = site('gh', 'github-2', 20);
  clear(); s = await W.check();
  t('a newer GitHub version wins', s.state === 'ready' && s.build === ghM.build && s.from === 'GitHub', JSON.stringify(s));
  t('fetched from GitHub', files('gh').join() === '/js/quickadd.js', files('gh').join());

  /* nastime unreachable (away from home): GitHub still works */
  W = fresh(); W.choose(); W.ok();
  const gh3 = site('gh', 'github-3', 30); down.nas = true;
  s = await W.check();
  t('away from home, GitHub alone still updates it', s.state === 'ready' && s.build === gh3.build, JSON.stringify(s));
  down.gh = true;
  W = fresh(); W.choose(); W.ok();
  s = await W.check();
  t('with neither in reach it says so', s.state === 'error' && /GitHub or nastime/.test(s.reason), JSON.stringify(s));

  gh.close(); nas.close(); fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
}, 200);
