/* Starts the morning paper and keeps its code current from GitHub.

   docker-compose runs a two-line starter that downloads this file, then this
   file downloads the rest beside it and starts paper.js. Every 6 hours it
   looks again; when anything changed it saves the new files and exits, and
   Docker (restart: unless-stopped) starts it again on the new code. So a fix
   Claude pushes to GitHub reaches nastime by itself — nothing to copy.

   CODE_FROM   where the files come from (default: the repo's main branch);
               "off" runs whatever is already here. */
'use strict';
const fs = require('fs'), path = require('path');

const FROM = process.env.CODE_FROM || 'https://raw.githubusercontent.com/solakirus/creator-studio-v4/main/';
const FILES = {
  'boot.js': 'nas/paper/boot.js', 'paper.js': 'nas/paper/paper.js', 'hub.js': 'nas/paper/hub.js',
  'edition.js': 'nas/paper/edition.js', 'layout.js': 'nas/paper/layout.js', 'write.js': 'nas/paper/write.js',
  'render.js': 'nas/paper/render.js', 'weather.js': 'nas/paper/weather.js', 'ipp.js': 'nas/paper/ipp.js',
  'habits.js': 'app/js/habits.js'
};
const DIR = __dirname;
const log = (...a) => console.log(new Date().toLocaleString('sv-SE').slice(0, 19), 'boot:', ...a);

async function get(rel){
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(FROM + rel + '?t=' + Date.now(), { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`${rel}: ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

/* all or nothing: a half-updated set of files never runs */
async function update(){
  if (/^off$/i.test(FROM)) return [];
  const got = {};
  for (const [name, rel] of Object.entries(FILES)) got[name] = await get(rel);
  const changed = Object.keys(got).filter(n => { try { return fs.readFileSync(path.join(DIR, n), 'utf8') !== got[n]; } catch (e) { return true; } });
  for (const n of changed) { const f = path.join(DIR, n); fs.writeFileSync(f + '.new', got[n]); }
  for (const n of changed) { const f = path.join(DIR, n); fs.renameSync(f + '.new', f); }
  return changed;
}

(async () => {
  try { const c = await update(); if (c.length) log('updated', c.join(', ')); }
  catch (e) { log('couldn’t check GitHub (' + e.message + ') — starting with the files already here'); }
  if (!fs.existsSync(path.join(DIR, 'paper.js'))) { log('paper.js isn’t here yet and GitHub can’t be reached — trying again in a minute'); setTimeout(() => process.exit(1), 60000); return; }
  process.env.PAPER_START = '1';
  require('./paper.js');
  setInterval(async () => {
    try {
      const c = await update();
      if (c.length) { log('new version (' + c.join(', ') + ') — restarting'); setTimeout(() => process.exit(0), 2000); }
    } catch (e) {}
  }, 6 * 3600000);
})();
