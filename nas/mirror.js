/* nastime keeps itself current from GitHub.

   Runs in its own small container beside Caddy (nas/docker-compose.yml).
   Every few minutes it reads update.json from GitHub Pages; when GitHub has a
   NEWER version than the www/ folder here (update.json's `made`), it builds the
   new version beside it — unchanged files copied from what's here, the rest
   downloaded and checked against their SHA-256 — then swaps the folders in one
   step. So a push to GitHub (by Claude or by update.bat) reaches nastime, and
   the iPad, without anyone copying files.

   A version published straight to nastime from the laptop (publish-nas /
   update.bat) is newer than GitHub's until GitHub catches up, so it is never
   overwritten by an older one.

   Environment:
     SOURCE  where to read from     (default https://solakirus.github.io/creator-studio-v4/)
     SITE    the folder Caddy serves from (default /site/www)
     EVERY   minutes between looks  (default 5)

   Plain Node, nothing to install. `node mirror.js --once` looks once and exits. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const SOURCE = (process.env.SOURCE || 'https://solakirus.github.io/creator-studio-v4/').replace(/\/?$/, '/');
const SITE = path.resolve(process.env.SITE || '/site/www');
const EVERY = Math.max(1, +process.env.EVERY || 5) * 60 * 1000;
const NEXT = SITE + '.next', OLD = SITE + '.old';
/* files it writes can be replaced later from the laptop over the network share
   (publish-nas), whichever user that share writes as */
process.umask(0);

const log = (...a) => console.log(new Date().toISOString().slice(0, 19).replace('T', ' '), ...a);
const madeAt = m => (m && Date.parse(m.made)) || 0;
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

async function get(url, ms = 30000){
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'cache-control': 'no-cache' } });
    if (!r.ok) throw new Error(url + ' answered ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  } finally { clearTimeout(t); }
}

async function look(){
  let remote;
  try { remote = JSON.parse((await get(SOURCE + 'update.json?t=' + Date.now(), 15000)).toString('utf8')); }
  catch (e) { log('GitHub not reachable:', e.message); return 'unreachable'; }
  if (!remote || remote.format !== 'cs3-web' || !Array.isArray(remote.files)) { log('no update information at', SOURCE); return 'none'; }
  const here = readJSON(path.join(SITE, 'update.json'));
  if (here && (here.build === remote.build || madeAt(here) >= madeAt(remote))) return 'current';

  log(`GitHub has ${remote.build} (${remote.made}); here ${here ? here.build + ' (' + here.made + ')' : 'nothing'} — fetching`);
  const have = new Map(((here && here.files) || []).map(f => [f[0], f[1]]));
  fs.rmSync(NEXT, { recursive: true, force: true });
  let fetched = 0;
  try {
    for (const [p, hash] of remote.files) {
      const out = path.join(NEXT, p);
      if (!out.startsWith(NEXT + path.sep)) throw new Error('bad path ' + p);
      let buf = null;
      if (have.get(p) === hash) { try { buf = fs.readFileSync(path.join(SITE, p)); } catch (e) { buf = null; } }
      if (!buf || sha(buf) !== hash) { buf = await get(SOURCE + p + '?b=' + remote.build); fetched++; }
      if (sha(buf) !== hash) throw new Error(p + ' did not match its fingerprint');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, buf);
    }
    fs.writeFileSync(path.join(NEXT, 'update.json'), JSON.stringify(remote));
  } catch (e) {
    fs.rmSync(NEXT, { recursive: true, force: true });
    log('update failed, nothing changed:', e.message);
    return 'failed';
  }
  /* the swap: two renames, a moment apart */
  fs.rmSync(OLD, { recursive: true, force: true });
  if (fs.existsSync(SITE)) fs.renameSync(SITE, OLD);
  fs.renameSync(NEXT, SITE);
  fs.rmSync(OLD, { recursive: true, force: true });
  log(`now serving ${remote.build} (${fetched} file${fetched === 1 ? '' : 's'} downloaded)`);
  return 'updated';
}

module.exports = { look };

if (require.main === module) {
  if (process.argv.includes('--once')) look().then(r => { console.log(r); process.exit(r === 'failed' ? 1 : 0); });
  else {
    log(`watching ${SOURCE} every ${EVERY / 60000} min for ${SITE}`);
    const loop = () => look().catch(e => log('error:', e.message)).finally(() => setTimeout(loop, EVERY));
    loop();
  }
}
