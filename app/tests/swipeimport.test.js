/* Swipe import — reading saved videos out of Instagram, Facebook and TikTok
   data exports.

   The fixtures are shaped like the real files (field names, nesting, the way
   Instagram lists a collection's name and then its posts). The cases that
   matter: only saves come through, never TikTok's watch history or likes;
   collections survive; dates are the day you saved it; the same video twice
   is one swipe; and a zip is read without being unpacked first. */
const path = require('path'), zlib = require('zlib');
const S = require(path.join(__dirname, '..', 'js', 'swipeimport.js'));

let pass = 0, fail = 0;
const t = (n, c, x) => { console.log(`  ${c ? 'ok ' : 'FAIL'}  ${n.padEnd(62)} ${x === undefined ? '' : x}`); c ? pass++ : fail++; };

/* ---- Instagram ---- */
const igSaved = { saved_saved_media: [
  { title:'carthrottle', string_map_data:{ 'Saved on':{ href:'https://www.instagram.com/reel/C1abcDEF12/', timestamp:1704067200 } } },
  { title:'driftking', string_map_data:{ 'Saved on':{ href:'https://www.instagram.com/p/C2xyzXYZ34/?igsh=abc', timestamp:1706745600 } } },
  { title:'someone', string_map_data:{ 'Saved on':{ href:'https://www.instagram.com/someone/', timestamp:1706745600 } } }
] };
const igCols = { saved_saved_collections: [
  { title:'Collection', string_map_data:{ Name:{ value:'Drift' }, 'Creation Time':{ timestamp:1700000000 } } },
  { title:'driftking', string_map_data:{ Name:{ href:'https://www.instagram.com/p/C2xyzXYZ34/', value:'driftking' }, 'Added Time':{ timestamp:1706745600 } } },
  { title:'Collection', string_map_data:{ Name:{ value:'Morning routine' }, 'Creation Time':{ timestamp:1700000000 } } },
  { title:'coffeeguy', string_map_data:{ Name:{ href:'https://www.instagram.com/reel/C3morning56/', value:'coffeeguy' }, 'Added Time':{ timestamp:1707000000 } } }
] };

let r = S.parseOne('saved_posts.json', JSON.stringify(igSaved));
t('Instagram: saved posts read, profile link ignored', r.length === 2, r.length);
t('Instagram: creator from the entry', r[0].author === 'carthrottle', r[0].author);
t('Instagram: save date in ms', r[0].savedAt === 1704067200000, r[0].savedAt);
t('Instagram: tracking tail dropped', r[1].url === 'https://www.instagram.com/p/C2xyzXYZ34/', r[1].url);

r = S.parseOne('saved_collections.json', JSON.stringify(igCols));
t('Instagram collections: posts carry their collection', r.length === 2 && r[0].collection === 'Drift' && r[1].collection === 'Morning routine',
  r.map(x => x.collection).join(','));

let m = S.merge([...S.parseOne('saved_posts.json', JSON.stringify(igSaved)), ...S.parseOne('saved_collections.json', JSON.stringify(igCols))]);
t('Instagram: post in saves + a collection is one item', m.length === 3, m.length);
t('Instagram: the merged one keeps its collection', (m.find(x => x.key === 'ig:C2xyzXYZ34') || {}).collections.join() === 'Drift');

/* ---- Facebook ---- */
const fbSaved = { saves_v2: [
  { timestamp:1709251200, title:"Khaleem Catten saved Donut Media's video.",
    attachments:[{ data:[{ external_context:{ name:'The fastest Miata', url:'https://www.facebook.com/donutmedia/videos/1234567890123/' } }] }] },
  { timestamp:1709337600, title:'Khaleem Catten saved a reel from Hoonigan.',
    attachments:[{ data:[{ external_context:{ url:'https://www.facebook.com/reel/987654321012345' } }] }] },
  { timestamp:1709337600, title:'Khaleem Catten saved a listing.',
    attachments:[{ data:[{ external_context:{ url:'https://www.facebook.com/marketplace/item/555555555' } }] }] },
  { timestamp:1709337600, title:'Khaleem Catten saved a link.',
    attachments:[{ data:[{ external_context:{ url:'https://www.example.com/article' } }] }] }
] };
r = S.parseOne('your_saved_items.json', JSON.stringify(fbSaved));
t('Facebook: videos and reels in, Marketplace and articles out', r.length === 2, r.length);
t('Facebook: creator read from the sentence', r[0].author === 'Donut Media' && r[1].author === 'Hoonigan', r.map(x => x.author).join('|'));
const fbCols = { collections_v2: [
  { timestamp:1709400000, title:'Khaleem Catten added a video to your Car builds collection.',
    attachments:[{ data:[{ external_context:{ url:'https://www.facebook.com/watch/?v=1122334455&ref=sharing' } }] }] }
] };
r = S.parseOne('collections.json', JSON.stringify(fbCols));
t('Facebook collections: name from "to your X collection"', r.length === 1 && r[0].collection === 'Car builds', r[0] && r[0].collection);
t('Facebook: watch link reduced to its v=', r[0].url === 'https://www.facebook.com/watch/?v=1122334455', r[0].url);

/* ---- TikTok ---- */
const tt = {
  'Your Activity': {
    'Favorite Videos': { FavoriteVideoList: [
      { Date:'2024-03-02 18:22:01', Link:'https://www.tiktokv.com/share/video/7341234567890123456/' },
      { Date:'2024-02-01 08:00:00', Link:'https://www.tiktokv.com/share/video/7331234567890123456/' }
    ] },
    'Like List': { ItemFavoriteList: [ { date:'2024-01-01 00:00:00', link:'https://www.tiktokv.com/share/video/7001111111111111111/' } ] },
    'Watch History': { VideoList: [ { Date:'2024-01-01 00:00:00', Link:'https://www.tiktokv.com/share/video/7002222222222222222/' } ] }
  }
};
r = S.parseOne('user_data_tiktok.json', JSON.stringify(tt));
t('TikTok: only Favorites — not likes or watch history', r.length === 2, r.length);
t('TikTok: date parsed', r[0].savedAt === Date.UTC(2024, 2, 2, 18, 22, 1), new Date(r[0].savedAt).toISOString());
t('TikTok: keyed on the video id', r[0].key === 'tt:7341234567890123456', r[0].key);

const txt = `Favorite Videos:\n\nDate: 2024-03-02 18:22:01\nLink: https://www.tiktokv.com/share/video/7341234567890123456/\n\nDate: 2024-02-01 08:00:00\nLink: https://www.tiktokv.com/share/video/7331234567890123456/\n`;
r = S.parseOne('Favorite Videos.txt', txt);
t('TikTok txt export: Favorites read', r.length === 2, r.length);
r = S.parseOne('Watch History.txt', `Date: 2024-01-01 00:00:00\nLink: https://www.tiktokv.com/share/video/7002222222222222222/\n`);
t('TikTok txt export: Watch History ignored', r.length === 0, r.length);

/* ---- HTML (Meta's other export format) ---- */
const html = `<html><body><h2>Drift</h2><div class="_3-95"><a href="https://www.instagram.com/reel/C9htmlAAA1/">driftking</a><div>Jan 5, 2024 3:00 pm</div></div>
  <h2>Food</h2><div class="_3-95"><a href="https://www.instagram.com/p/C9htmlBBB2/">chef</a></div></body></html>`;
r = S.parseOne('saved_collections.html', html);
t('HTML: links and their collection headings', r.length === 2 && r[0].collection === 'Drift' && r[1].collection === 'Food',
  r.map(x => x.collection).join(','));

/* ---- a real zip, read the way the app reads it ---- */
function zip(files){
  const locals = [], centrals = []; let off = 0;
  for(const [name, text, store] of files){
    const nb = Buffer.from(name), data = Buffer.from(text);
    const comp = store ? data : zlib.deflateRawSync(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(store ? 0 : 8, 8);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(store ? 0 : 8, 10);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nb, comp); centrals.push(ch, nb); off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10);
  e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, e]);
}

(async () => {
  const z = zip([
    ['your_instagram_activity/saved/saved_posts.json', JSON.stringify(igSaved)],
    ['your_instagram_activity/saved/saved_collections.json', JSON.stringify(igCols), true],
    ['media/posts/202401/huge_photo.jpg', 'x'.repeat(5000)],
    ['your_instagram_activity/messages/inbox/someone/message_1.json', JSON.stringify({ link:'https://www.instagram.com/reel/SHOULDNOT1/' })]
  ]);
  const file = new File([z], 'instagram-kris-2026-11-12.zip', { type:'application/zip' });
  const res = await S.read([file]);
  t('Zip: saves read straight out of the export', res.items.length === 3, res.items.length);
  t('Zip: photos and messages not opened', res.files.length === 2 && !res.items.some(x => /SHOULDNOT/.test(x.url)), res.files.join(','));
  t('Zip: newest save first', res.items[0].savedAt >= res.items[1].savedAt);

  const ttz = zip([['TikTok_Data/user_data_tiktok.json', JSON.stringify(tt)]]);
  const res2 = await S.read([new File([ttz], 'TikTok_Data_1731.zip')]);
  t('Zip: TikTok export gives only its Favorites', res2.items.length === 2, res2.items.length);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
