"use strict";
/* node tests/rules_test.js : checks the rules file (no screen needed) */
const assert=require("assert"), R=require("../rules.js"), S=require("../scenario1.js"), AI=require("../ai.js");
let n=0; const t=(name,f)=>{ f(); n++; };
const fresh=()=>{ const s=R.newGame(1); R.startTurn(s); return s; };

t("hex distance",()=>{ assert.strictEqual(R.dist({q:0,r:0},{q:2,r:-1}),2); assert.strictEqual(R.dist({q:0,r:0},{q:0,r:0}),0); assert.strictEqual(R.dist({q:0,r:0},{q:3,r:0}),3); });
t("combat table: roll + Power - Armor",()=>{
  const s=fresh(); for(let i=0;i<200;i++){ const x=R.roll(s,4,3,false); const tot=x.roll+1; assert.strictEqual(x.total,tot); assert.strictEqual(x.result,tot>=5?"destroy":tot>=3?"stun":"none"); }
  for(let i=0;i<200;i++){ const x=R.roll(s,3,3,true); assert.strictEqual(x.result,x.total>=4?"destroy":x.total>=3?"stun":"none"); } });
t("armor: ruins and rubble double infantry, ruins +1 for vehicles",()=>{
  const s=fresh(); let ruins,rubble,clear; for(const [k,v] of s.map){ const [q,r]=k.split(",").map(Number); if(v==="ruins"&&!ruins) ruins={q,r}; if(v==="rubble"&&!rubble) rubble={q,r}; if(v==="clear"&&!clear) clear={q,r}; }
  const i1=R.addUnit(s,"inf",clear.q,clear.r,3), i2=R.addUnit(s,"inf",ruins.q,ruins.r,3), i3=R.addUnit(s,"inf",rubble.q,rubble.r,2), b1=R.addUnit(s,"bulwark",ruins.q,ruins.r), b2=R.addUnit(s,"bulwark",clear.q,clear.r);
  assert.strictEqual(R.armorOf(s,i1),3); assert.strictEqual(R.armorOf(s,i2),6); assert.strictEqual(R.armorOf(s,i3),4); assert.strictEqual(R.armorOf(s,b1),4); assert.strictEqual(R.armorOf(s,b2),3); });
t("tread brackets set the machine's Move",()=>{ const s=fresh(); assert.strictEqual(R.machMove(s),2); s.mach.treads=11; assert.strictEqual(R.machMove(s),2); s.mach.treads=10; assert.strictEqual(R.machMove(s),1); s.mach.treads=0; assert.strictEqual(R.machMove(s),0); });
t("a stun lasts one of the unit's own turns",()=>{
  const s=fresh(); const u=R.addUnit(s,"bulwark",3,3); u.s=2; s.side="h"; R.startTurn(s); assert.strictEqual(u.s,1); R.startTurn(s); assert.strictEqual(u.s,0); });
t("infantry: a stun removes one squad, a destroy removes the stack",()=>{
  const s=fresh(); const u=R.addUnit(s,"inf",3,3,3); s.rng=()=>0.4; /* die 3 */ R.hitUnit(s,u,1); /* 3+1-3=1 none */ assert.strictEqual(u.sq,3);
  s.rng=()=>0.99; /* die 6: 6+3-3=6 destroy */ R.hitUnit(s,u,3); assert.ok(!s.units.includes(u)); });
t("crush: vehicles cost treads, infantry cost none, HQ crush ends the game",()=>{
  const s=fresh(); const m=s.mach; const hq=R.addUnit(s,"hq",m.q+1,m.r-1); const tk=R.addUnit(s,"bulwark",m.q,m.r-1);
  const start=m.treads; R.machWalk(s,[{q:m.q,r:m.r-1}]); assert.strictEqual(m.treads,start-3); assert.ok(!s.units.includes(tk)); assert.ok(s.units.includes(hq)); });
t("the machine can't walk onto a wreck field and pays rubble/ruins costs",()=>{
  const s=fresh(); const path=R.machPath(s,s.mach.q,0); assert.ok(path&&path.length>=s.cfg.H-1); for(const h of path) assert.notStrictEqual(R.terrain(s,h.q,h.r),"wreck"); });
t("combined fire adds Power; tread hits cost boxes",()=>{
  const s=fresh(); s.mach.q=5; s.mach.r=5; const a=R.addUnit(s,"bulwark",5,4), b=R.addUnit(s,"lancer",5,3); s.rng=()=>0.99; const x=R.humanFire(s,[a,b],"treads");
  assert.strictEqual(x.power,7); assert.strictEqual(x.result,"destroy"); assert.strictEqual(s.mach.treads,20-7); assert.ok(a.fired&&b.fired); assert.strictEqual(R.humanFire(s,[a,b],"treads"),null); });
t("a unit out of reach does not fire",()=>{ const s=fresh(); s.mach.q=5; s.mach.r=9; const a=R.addUnit(s,"scout",5,3); assert.ok(!R.unitCanFire(s,a)); });
t("movement: terrain cost, wrecks blocked, stacking limit",()=>{
  const s=fresh(); const u=R.addUnit(s,"scout",6,5); const m=R.reach(s,u); for(const [k,c] of m){ assert.ok(c<=4); const [q,r]=k.split(",").map(Number); assert.notStrictEqual(R.terrain(s,q,r),"wreck"); }
  const i=R.addUnit(s,"inf",6,5,3), j=R.addUnit(s,"inf",7,5,2); assert.ok(!R.reach(s,j).has("6,5")); });
t("victory: HQ destroyed, machine disarmed, machine stuck",()=>{
  let s=fresh(); s.side="h"; R.endTurn(s); assert.strictEqual(s.over&&s.over.winner,"machine");              /* no HQ on the board */
  s=S.newScenario(1,"full"); s.mach.parts.forEach(p=>{ if(p.k!=="ap") p.alive=false; }); R.endTurn(s); assert.strictEqual(s.over.winner,"humans");
  s=S.newScenario(1,"full"); s.mach.treads=0; s.mach.q=7; s.mach.r=11; R.endTurn(s); assert.strictEqual(s.over.winner,"humans"); });
t("whole games finish with a result, both forces",()=>{ for(const f of ["full","minus2"]) for(let i=0;i<50;i++){ const s=S.newScenario(i,f); const o=AI.playGame(s); assert.ok(o&&(o.winner==="machine"||o.winner==="humans")); } });
console.log("rules tests passed:",n);
