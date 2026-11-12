/* Reading a Shot Library folder into frames and pages (library.rs's index).
   Plain Node, no Electron: the laptop app (electron/library.js) and nastime's
   helper (nas/helper.js, which serves the Library to the iPad) both use it. */
'use strict';
const fs = require('fs');
const path = require('path');

/* library.rs kind_of */
function kindOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  if (!m) return null;
  const e = m[1].toLowerCase();
  if (e === 'gif') return 'gif';
  if (['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(e)) return 'video';
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'jfif'].includes(e)) return 'image';
  return null;
}

/* library.rs is_animated_webp: VP8X with the animation flag, or an ANIM chunk */
function animatedWebp(abs) {
  try {
    const fd = fs.openSync(abs, 'r');
    const b = Buffer.alloc(64);
    const n = fs.readSync(fd, b, 0, 64, 0);
    fs.closeSync(fd);
    if (n < 21 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return false;
    if (b.toString('latin1', 12, 16) === 'VP8X' && (b[20] & 0x02)) return true;
    return b.slice(0, n).includes(Buffer.from('ANIM'));
  } catch (e) { return false; }
}

const SKIP = ['_Shotlists', '_Boards', '_logs', '_Deleted', '_Shotline'];
const MAX_FILES = 60000;

function walk(dir, rel, depth, files, manifests) {
  if (depth > 6 || files.length > MAX_FILES) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP.includes(e.name)) continue;
    const p = rel ? rel + '/' + e.name : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, p, depth + 1, files, manifests);
    else if (e.name === 'manifest.json') {
      try { manifests.push([p, JSON.parse(fs.readFileSync(abs, 'utf8'))]); } catch (err) { /* not JSON */ }
    } else if (kindOf(e.name)) {
      let size = 0;
      try { size = fs.statSync(abs).size; } catch (err) { /* gone */ }
      files.push([p, size]);
    }
  }
}

const str = (v, k) => (v && typeof v[k] === 'string') ? v[k] : '';

/* library.rs add_source: pages from manifests, else from the folder a file sits in */
/* `as` names the folder the frames belong to when they're read from its copy:
   the uids stay the same, so tasks, boards and stars still find them. */
function scanRoot(root, as) {
  const files = [], manifests = [];
  walk(root, '', 0, files, manifests);
  const src = 'h:' + (as || root);
  const rootName = path.basename(root);
  const pages = new Map();
  const meta = new Map();
  for (const [p, j] of manifests) {
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    const parts = dir.split('/');
    const site = str(j, 'site');
    const at = site ? parts.indexOf(site) : -1;
    const collection = at > 0 ? parts.slice(0, at).join(' / ') : (site || parts[0] || rootName);
    const uid = src + '|' + dir;
    pages.set(uid, {
      uid, root, dir, collection,
      site: site || parts[0] || '',
      page: str(j, 'page') || parts[parts.length - 1] || '',
      title: str(j, 'title'), heading: str(j, 'heading'), source: str(j, 'source'),
      grabbed: str(j, 'grabbedAt'), counts: [0, 0, 0]
    });
    for (const it of (Array.isArray(j.items) ? j.items : [])) {
      const f = str(it, 'file');
      if (f) meta.set(dir ? dir + '/' + f : f, [it, uid]);
    }
  }
  const items = [];
  for (const [p, size] of files) {
    let kind = kindOf(p);
    const abs = path.join(root, ...p.split('/'));
    if (kind === 'image' && /\.webp$/i.test(p) && animatedWebp(abs)) kind = 'gif';
    const parts = p.split('/');
    const m = meta.get(p);
    let pageUid;
    if (m) pageUid = m[1];
    else {
      const parent = parts.slice(0, -1);
      const last = (parent[parent.length - 1] || '').toLowerCase();
      if (['gifs', 'videos', 'images', 'stills', 'clips'].includes(last)) parent.pop();
      const dir = parent.join('/');
      pageUid = src + '|' + dir;
      if (!pages.has(pageUid)) pages.set(pageUid, {
        uid: pageUid, root, dir,
        collection: parent[0] || rootName, site: parent[0] || rootName,
        page: parent.length > 1 ? parent.slice(1).join(' / ') : (parent[0] || rootName),
        title: '', heading: '', source: '', grabbed: '', counts: [0, 0, 0]
      });
    }
    const mv = m ? m[0] : null;
    items.push({
      uid: src + '|' + p, src: 'h', root, path: p, kind,
      name: parts[parts.length - 1],
      label: str(mv, 'label'), caption: str(mv, 'caption'),
      link: str(mv, 'link') || str(mv, 'url'),
      /* grabbed from a popup: the bigger GIF, the original video and tags */
      big: str(mv, 'big'), source: str(mv, 'source'),
      tags: mv && Array.isArray(mv.tags) ? mv.tags.filter(x => typeof x === 'string').slice(0, 20) : [],
      order: mv && typeof mv.order === 'number' ? mv.order : 9999,
      bytes: size, page: pageUid,
      url: 'cs3lib://f/' + encodeURIComponent(abs)
    });
  }
  items.sort((a, b) => a.page < b.page ? -1 : a.page > b.page ? 1 : (a.order - b.order) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const it of items) {
    const pg = pages.get(it.page);
    if (pg) pg.counts[it.kind === 'gif' ? 0 : it.kind === 'video' ? 1 : 2]++;
  }
  return { items, pages: [...pages.values()].filter(p => p.counts[0] + p.counts[1] + p.counts[2] > 0) };
}

module.exports = { kindOf, animatedWebp, walk, scanRoot, SKIP };
