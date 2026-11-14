/* merge.js: two devices' edits to one record, combined.  node app/tests/merge.test.js */
const M = require('../js/merge.js');
let p=0,f=0; const ok=(c,l,x)=>{console.log((c?'ok  ':'FAIL')+' '+l+(x!==undefined?'  '+JSON.stringify(x):''));c?p++:f++;};
const base = { id:'v1', title:'Week 1', acts:[ {id:'a1',title:'Mon',beats:[{id:'b1',title:'Wake',shots:[{id:'s1',text:'alarm'},{id:'s2',text:'coffee'}]}]}, {id:'a2',title:'Tue',beats:[]} ], tags:['x','y'], updatedAt:1 };
const J = o => JSON.parse(JSON.stringify(o));
// phone renames shot s1, laptop adds sequence to Tue and renames title
const phone = J(base); phone.acts[0].beats[0].shots[0].text='alarm 5am'; phone.updatedAt=5;
const lap = J(base); lap.acts[1].beats.push({id:'b2',title:'Gym',shots:[]}); lap.title='Week 1: Show up'; lap.updatedAt=6;
let r = M.merge(base, phone, lap, false);
ok(r.value.acts[0].beats[0].shots[0].text==='alarm 5am' && r.value.acts[1].beats[0].title==='Gym' && r.value.title==='Week 1: Show up' && !r.conflicts.length, 'edits to different parts both stay');
// both rename same shot
const a = J(base); a.acts[0].beats[0].shots[1].text='tea';
const b = J(base); b.acts[0].beats[0].shots[1].text='espresso';
r = M.merge(base, a, b, true);
ok(r.value.acts[0].beats[0].shots[1].text==='tea' && r.conflicts.length===1 && r.conflicts[0].other==='espresso', 'same detail: newer wins, other kept', r.conflicts[0].path);
// deletion on one side, untouched other
const d = J(base); d.acts[0].beats[0].shots.splice(0,1);
r = M.merge(base, d, J(base), false);
ok(r.value.acts[0].beats[0].shots.length===1 && r.value.acts[0].beats[0].shots[0].id==='s2', 'deleted stays deleted');
// add on both sides
const e1 = J(base); e1.acts[0].beats[0].shots.push({id:'s3',text:'shower'});
const e2 = J(base); e2.acts[0].beats[0].shots.splice(1,0,{id:'s4',text:'stretch'});
r = M.merge(base, e1, e2, false);
ok(r.value.acts[0].beats[0].shots.map(s=>s.id).join()==='s1,s4,s2,s3', 'added on both sides: both kept, in place', r.value.acts[0].beats[0].shots.map(s=>s.id));
// tag sets
const t1=J(base); t1.tags=['x','y','z']; const t2=J(base); t2.tags=['y'];
r = M.merge(base,t1,t2,true); ok(r.value.tags.join()==='y,z','tags: added kept, removed gone', r.value.tags);
// no base
r = M.merge(undefined, {id:1,a:1,list:[{id:'p'}]}, {id:1,b:2,list:[{id:'q'}]}, true);
ok(r.value.a===1&&r.value.b===2&&r.value.list.length===2,'no base: everything from both kept');
// noise
r = M.merge(base, {...J(base),updatedAt:9}, {...J(base),updatedAt:8}, true); ok(!r.conflicts.length && r.value.updatedAt===9,'timestamps are not conflicts');
// top-level folder list
const fb=[{id:'f1',name:'Cars'}]; r=M.merge(fb,[...fb,{id:'f2',name:'Gym'}],[...fb,{id:'f3',name:'Food'}],false);
ok(r.value.map(x=>x.id).join()==='f1,f3,f2'||r.value.map(x=>x.id).join()==='f1,f2,f3','folders made on two devices both stay', r.value.map(x=>x.id));
// setAt restore
const rec=J(r.value); M.setAt(rec,['#f2','name'],'Gym!'); ok(rec.find(x=>x.id==='f2').name==='Gym!','a conflict can be put back by its path');
// edit vs delete in list
const ed=J(base); ed.acts[1].title='Tuesday'; const dl=J(base); dl.acts.splice(1,1);
r=M.merge(base,ed,dl,false); ok(r.value.acts.length===2&&r.value.acts[1].title==='Tuesday','edited on one side, deleted on the other: the edit is kept');
r=M.merge({title:'Untitled swipe'},{title:'Untitled swipe',x:1},{title:'Hook study'},true); ok(r.value.title==='Hook study'&&!r.conflicts.length,'a placeholder title never beats a real one');
console.log(`\n${p} passed, ${f} failed`); process.exit(f?1:0);
