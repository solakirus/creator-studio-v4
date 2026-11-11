/* Undo must stay O(1) per stroke AND still undo correctly. */
const fs=require('fs');
const src=fs.readFileSync('app/js/paper.js','utf8');
let pass=0,fail=0; const t=(n,c,x)=>{console.log(`  ${c?'ok ':'FAIL'}  ${n.padEnd(48)} ${x||''}`);c?pass++:fail++;};

console.log('\n— drawing no longer serialises the page —');
t('a stroke records a count, not a snapshot', /undo\.push\(\{ k: key, side, len: rec\[side\]\.strokes\.length \}\)/.test(src));
t('the snapshot version is kept for the eraser', /function pushUndoFull/.test(src));
t('and only the eraser uses it', /st\.tool === 'eraser'\)\{ pushUndoFull\(side\)/.test(src));
t('drawing does not stringify', !/pushUndo\(side\);\s*\n\s*if\(st\.tool === 'eraser'/.test(src));

console.log('\n— and undo still works both ways —');
t('a snapshot restores', /if\(u\.s !== undefined\) rec\[u\.side\]\.strokes = JSON\.parse\(u\.s\)/.test(src));
t('a count truncates', /strokes\.length = Math\.min\(rec\[u\.side\]\.strokes\.length, u\.len\)/.test(src));

/* the truncate semantics, run for real */
console.log('\n— truncating is the right undo for an append —');
const strokes=[{id:1},{id:2},{id:3}];
const mark={len:strokes.length};
strokes.push({id:4});
strokes.length=Math.min(strokes.length,mark.len);
t('the new stroke goes',strokes.length===3&&!strokes.some(s=>s.id===4),JSON.stringify(strokes.map(s=>s.id)));
t('and the earlier ones stay',strokes.map(s=>s.id).join()==='1,2,3');
/* a marker taken when the page was longer must never grow it back */
const short=[{id:1}]; const stale={len:5};
short.length=Math.min(short.length,stale.len);
t('a stale marker cannot resurrect strokes',short.length===1,'min() guards it');

console.log(`\n${fail?'FAILED':'undo is cheap and still correct'}  (${pass} ok, ${fail} failed)\n`);
process.exit(fail?1:0);
