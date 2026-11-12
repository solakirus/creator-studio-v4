/* The shots drop-down on clip cards and series video cards, as on a task: the box ticks, the words edit in place. node app/tests/browser/v4-drops.browser.js */
const pw=require('/opt/npm-tools/node_modules/playwright');const fs=require('fs');
let pass=0,fail=0;const ok=(c,l,x)=>{console.log(`  ${c?'ok  ':'FAIL'}  ${l}${x!==undefined?'   '+x:''}`);c?pass++:fail++;};
(async()=>{const b=await pw.chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args:['--allow-file-access-from-files']});
const errs=[];
for(const phone of [true,false]){
const ctx=await b.newContext(phone?{viewport:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:2}:{viewport:{width:1280,height:900}});
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///' + require('path').resolve(__dirname, '../../index.html').replace(/\\/g, '/'));await p.waitForFunction(()=>window.App&&window.ShotList,null,{timeout:15000});await p.waitForTimeout(800);
const ids=await p.evaluate(async()=>{
  const c=await Data.saveClip({title:'Morning ritual, part 1',plat:'youtube',stage:'idea',channel:'',seriesId:null,dur:'0:00',shots:['Alarm off','Curtains open','Kettle on']});
  await Store.put('series',{id:'sr_m',title:'Morning ritual',channel:'',createdAt:Date.now()});Data.invalidate&&Data.invalidate('series');
  const v=await Videos.save({title:'Part 2 — the commute',seriesId:'sr_m',shots:['Seatbelt on','Keys off the hook']});
  await ClipFlow.migrate();
  return {clip:c.id,video:ClipFlow.idFor(v.id)};});
// clips
await p.evaluate(()=>App.go('series'));await p.waitForTimeout(500);
await p.click('.ctnav [data-v="clips"]');await p.waitForTimeout(1200);
const chip=`[data-sldrop="clip:${ids.clip}"]`;
ok(/0 \/ 3 shots/.test(await p.textContent(chip)),(phone?'phone':'laptop')+': a clip card has the shots chip',await p.textContent(chip));
await p.click(chip);await p.waitForTimeout(1200);
let n=await p.evaluate(id=>document.querySelectorAll(`[data-sldrop-body="clip:${id}"] .sub`).length,ids.clip);
ok(n===3&&!(await p.$('.screen:last-child .cp-head')),'it drops down its 3 shots, without opening the clip',n);
await p.click(`[data-sldrop-body="clip:${ids.clip}"] [data-subtick="0"]`);await p.waitForTimeout(800);
await p.fill(`[data-sldrop-body="clip:${ids.clip}"] [data-subname="1"]`,'Curtains open, light hits');await p.press(`[data-sldrop-body="clip:${ids.clip}"] [data-subname="1"]`,'Enter');await p.waitForTimeout(800);
let c=await p.evaluate(async id=>{const x=await Store.get('clips',id);return {d:x.shotList[0].done,t:x.shotList[1].text,slot:x.page.slots[1].text,chip:document.querySelector(`[data-sldrop="clip:${id}"]`).textContent.trim(),cls:document.querySelector(`[data-sldrop-body="clip:${id}"] [data-sub="0"]`).classList.contains('done')}},ids.clip);
ok(c.d&&c.cls,'the box ticks a shot and crosses it out');
ok(c.t==='Curtains open, light hits'&&c.slot===c.t,'editing renames the shot and its spot on the page',c.t);
ok(/1 \/ 3 shots/.test(c.chip),'the chip counts it',c.chip);

await p.evaluate(id=>Screens.push('clip',{id,tab:'shoot'}),ids.clip);await p.waitForTimeout(1500);
const rows=await p.evaluate(()=>({n:document.querySelectorAll('.screen:last-child #clipShots .tk-ps').length,hidden:(document.querySelector('.screen:last-child #clipShots .tk-hidden')||{}).textContent||''}));
ok(rows.n===2&&/1 done/.test(rows.hidden),'the clip\'s Steps agree',JSON.stringify(rows));
await p.evaluate(()=>Screens.pop());await p.waitForTimeout(400);
// series
await p.evaluate(()=>Screens.push('series-view',{id:'sr_m'}));await p.waitForTimeout(1500);
const vchip=`.screen:last-child [data-sldrop="clip:${ids.video}"]`;
const has=await p.$(vchip);
ok(!!has,'a series video card has the chip');
if(has){await p.click(vchip);await p.waitForTimeout(1200);
 n=await p.evaluate(id=>document.querySelectorAll(`.screen:last-child [data-sldrop-body="clip:${id}"] .sub`).length,ids.video);
 ok(n===2&&(await p.evaluate(()=>document.querySelector('.screen:last-child').dataset.screen))==='series-view','it drops down its shots, without opening the video',n);
 await p.click(`.screen:last-child [data-sldrop-body="clip:${ids.video}"] [data-subtick="1"]`);await p.waitForTimeout(800);
 const v=await p.evaluate(async id=>(await Store.get('clips',id)).shotList[1].done,ids.video);
 ok(v,'ticking lands on the video');
 
 await p.click(`.screen:last-child [data-video="${ids.video}"] h3`);await p.waitForTimeout(1200);
 ok((await p.evaluate(()=>document.querySelector('.screen:last-child').dataset.screen))==='clip','the rest of the card still opens the video, on the clip page');}
await ctx.close();}
ok(!errs.length,'no errors',errs.join('|'));console.log(`${pass} ok, ${fail} failed`);await b.close();process.exit(fail?1:0);})();
