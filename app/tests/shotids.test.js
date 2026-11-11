/* Shot ids: stamping is stable, copies get their own id, saved ids never move,
   and a shoot task's copied shots point back at the sequence's.
     node app/tests/shotids.test.js */
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '..') + '/';
global.window = global;
new Function(fs.readFileSync(A + 'js/shotids.js', 'utf8'))();
const S = global.ShotIds;
let fails = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x ? '   ' + x : ''}`); if (!c) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));

console.log('\nstamping');
const task = { id: 12, shots: [ { name: 'Wide', angles: [{ type: 'wide' }, { type: 'close' }] }, { name: 'Stake corners' } ] };
const a = clone(task), b = clone(task);
S.stampTask(a); S.stampTask(b);
ok(a.shots.every(s => /^sh_/.test(s.id)), 'every shot gets an id', a.shots.map(s => s.id).join(' '));
ok(a.shots[0].angles.every(x => /^an_/.test(x.id)), 'every angle gets an id');
ok(JSON.stringify(a) === JSON.stringify(b), 'same old shot, same id — read and write agree');
ok(new Set(a.shots.map(s => s.id)).size === 2, 'ids differ within a task');

console.log('\nsaved ids stay put');
const c = clone(a);
c.shots.reverse(); c.shots[0].name = 'Renamed';
const before = c.shots.map(s => s.id).join();
ok(!S.stampTask(c) && c.shots.map(s => s.id).join() === before, 'reorder and rename change nothing');

console.log('\na duplicate gets its own id');
const d = clone(a); d.shots.push(clone(d.shots[0]));
S.stampTask(d);
ok(new Set(d.shots.map(s => s.id)).size === 3, 'three shots, three ids', d.shots.map(s => s.id).join(' '));
ok(d.shots[0].id === a.shots[0].id, 'the original keeps its id');

console.log('\nepisodes');
const v = { id: 'v1', acts: [{ id: 'a1', beats: [{ id: 'b1', title: 'Tent', shots: [{ text: 'Lay out parts' }, { text: 'Stake corners' }] }] }] };
S.stampVlog(v);
const bs = v.acts[0].beats[0].shots;
ok(bs.every(s => /^sh_/.test(s.id)), 'sequence shots get ids');
const shoot = { id: 40, beatId: 'b1', vlogId: 'v1', shots: [{ name: 'Lay out parts', angles: [{ n: 'Wide' }] }, { name: 'Stake corners' }] };
S.stampTask(shoot);
ok(S.linkTask(shoot, { v1: v }), 'shoot task linked to its sequence');
ok(shoot.shots[0].src.shot === bs[0].id && shoot.shots[1].src.shot === bs[1].id, 'each copy points at its original');
ok(shoot.shots[0].id !== bs[0].id, 'the copy keeps its own id');
const renamed = { id: 41, beatId: 'b1', vlogId: 'v1', shots: [{ name: 'Something else' }] };
S.stampTask(renamed);
ok(!S.linkTask(renamed, { v1: v }), 'no link when the names disagree');

console.log('\none shape');
const old = { id: 50, shots: [{ name: 'Lay out parts', angles: [{ n: 'Wide' }, { n: 'Close-up' }, { n: 'Push in' }] }] };
S.stampTask(old);
ok(old.shots[0].text === 'Lay out parts' && !('name' in old.shots[0]), 'name becomes text, the field the task screen reads');
ok(old.shots[0].angles.map(a => a.type).join() === 'wide,close,push-in', 'angle labels become types coverage can count', old.shots[0].angles.map(a => a.type).join());
const keep = { id: 51, shots: [{ id: 'sh_x', text: 'Mine', name: 'Other', angles: [{ type: 'detail', n: 'Whatever' }] }] };
S.stampTask(keep);
ok(keep.shots[0].text === 'Mine' && keep.shots[0].angles[0].type === 'detail', 'existing text and type are never overwritten');

console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
process.exit(fails ? 1 : 0);
