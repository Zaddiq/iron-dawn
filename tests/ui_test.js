"use strict";
/* node tests/ui_test.js [screenshot.png] : loads index.html headless, plays a few clicks, checks nothing throws */
const {chromium}=require("playwright"), path=require("path");
(async()=>{
  const b=await chromium.launch(), p=await b.newPage({viewport:{width:1100,height:760}}), errs=[];
  p.on("pageerror",e=>errs.push(String(e))); p.on("console",m=>{ if(m.type()==="error") errs.push(m.text()); });
  await p.goto("file://"+path.resolve(__dirname,"../index.html"));
  const ok=(c,m)=>{ if(!c){ console.error("FAIL:",m); process.exitCode=1; } };
  ok(await p.locator("polygon[data-q]").count()===180,"180 hexes");
  ok(await p.locator("g[data-u]").count()>=8,"units drawn");
  ok((await p.locator("#log div").count())>=1,"log has lines");
  /* select a movable unit and move it */
  const ids=await p.evaluate(()=>S.units.filter(u=>u.t==="scout").map(u=>u.id)); await p.locator(`circle[data-u="${ids[0]}"]`).click({force:true});
  const n=await p.evaluate(()=>hexes?hexes.size:0); ok(n>1,"reachable hexes shown: "+n);
  const dest=await p.evaluate(()=>{ for(const k of hexes.keys()){ const [q,r]=k.split(",").map(Number); if(q!==sel.q||r!==sel.r) return {q,r}; } });
  await p.locator(`polygon[data-q="${dest.q}"][data-r="${dest.r}"]`).click({force:true});
  ok(await p.evaluate(id=>{ const u=S.units.find(x=>x.id===id); return u.moved; },ids[0]),"unit moved");
  await p.click("#bFire"); ok(await p.evaluate(()=>phase==="fire"),"fire phase");
  await p.click("#bEnd"); await p.waitForTimeout(800);
  ok(await p.evaluate(()=>S.side==="h"||S.over),"machine turn done, back to humans");
  /* play whole game with end-turn clicks */
  for(let i=0;i<20;i++){ if(await p.evaluate(()=>!!S.over)) break; if(await p.evaluate(()=>S.side==="h"&&!busy)){ await p.click("#bFire"); await p.evaluate(()=>{ const sh=S.units.filter(u=>inReach(u)); }); const t=p.locator("button[data-t]:not([disabled])").first(); if(await t.count()) await t.click(); if(await p.evaluate(()=>!S.over)) await p.click("#bEnd"); } await p.waitForTimeout(700); }
  if(process.argv[2]) await p.screenshot({path:process.argv[2]});
  ok(errs.length===0,"page errors: "+errs.join(" | "));
  console.log("ui test done; game over:",await p.evaluate(()=>S.over&&S.over.why), "turn",await p.evaluate(()=>S.turn));
  await b.close();
})();
