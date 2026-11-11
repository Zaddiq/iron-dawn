"use strict";
/* ai.js: simple, readable computer players for both sides (used by the balance simulation, and later for the computer-run machine). */
(function(root,factory){ if(typeof module==="object"&&module.exports) module.exports=factory(require("./rules.js")); else root.AI=factory(root.Rules); })(this,function(R){
const {TYPES,dist,key}=R;

/* chance of each result for a given total Power against an Armor (one d6) */
function odds(s,power,armor,stunned){
  const c=s.cfg, kill=stunned?c.stunnedKillAt:c.killAt; let d=0,st=0;
  for(let r=1;r<=6;r++){ const t=r+power-armor; if(t>=kill) d++; else if(t>=c.stunAt) st++; }
  return {d:d/6,st:st/6};
}

/* ---- machine turn ---- */
function machineTurn(s){
  const hq=s.units.find(u=>u.t==="hq");
  if(hq){ const path=R.machPath(s,hq.q,hq.r); R.machWalk(s,path); }
  if(s.over) return;
  /* fire: pick the best target for all the weapons that can reach it, repeat until nothing is left to shoot */
  for(let guard=0;guard<30;guard++){
    const ws=R.machWeapons(s); if(!ws.length) break;
    let best=null, bv=0;
    for(const u of s.units){
      let power=0, inReach=[]; for(const p of ws){ if(p.infOnly&&!R.isInf(u)) continue; if(dist(s.mach,u)>p.reach) continue; power+=p.power; inReach.push(p); }
      if(!inReach.length) continue;
      const o=odds(s,power,R.armorOf(s,u),u.s>0), val=R.isInf(u)?u.sq*TYPES.inf.value:TYPES[u.t].value;
      /* a missile is a one-shot: only spend it where it makes a real difference */
      const useful=inReach.filter(p=>p.k!=="missile"||o.d>=0.5);
      const v=(o.d+0.35*o.st)*val/(1+0.1*useful.length);
      if(v>bv&&useful.length){ bv=v; best={u,parts:useful}; }
    }
    if(!best) break;
    R.machFire(s,best.parts,best.u); if(s.over) return;
  }
}

/* ---- human turn ---- */
function humanTurn(s){
  const maxM=Math.max(0,...s.mach.parts.filter(p=>p.alive&&!p.infOnly&&p.k!=="missile").map(p=>p.reach));
  const order=s.units.filter(u=>u.t!=="hq"&&u.s===0&&TYPES[u.t].move>0).sort((a,b)=>TYPES[b.t].reach-TYPES[a.t].reach);
  for(const u of order){
    let best=null, bv=-1e9;
    for(const k of R.reach(s,u).keys()){ const [q,r]=k.split(",").map(Number), t=R.terrain(s,q,r), d=dist({q,r},s.mach);
      const can=d<=TYPES[u.t].reach, cover=t==="ruins"?(R.isInf(u)?2:1):t==="rubble"&&R.isInf(u)?1.5:0;
      let v=(can?6:0)+2*cover+0.15*Math.min(d,6)+(d===0?-99:0);
      if(!R.isInf(u)&&d<=maxM) v-=4;           /* a vehicle stays out of reach of the big guns when it can */
      if(R.isInf(u)&&d<=1) v-=2;
      if(Math.abs(q-u.q)+Math.abs(r-u.r)===0) v+=0.5;
      if(v>bv){ bv=v; best={q,r}; } }
    if(best) R.humanMove(s,u,best.q,best.r);
  }
  /* fire: choose the machine part that is worth the most to attack with everything in range, repeat */
  const m=s.mach;
  for(let guard=0;guard<20;guard++){
    const shooters=s.units.filter(u=>R.unitCanFire(s,u)); if(!shooters.length) break;
    let best=null, bv=0;
    const targets=m.parts.filter(p=>p.alive).map(p=>({t:p,armor:p.armor,val:p.k==="main"?6:p.k==="side"?3.2:p.k==="missile"?(p.ammo>0?4:0):0.4,st:p.s>0}));
    if(m.treads>0) targets.push({t:"treads",armor:s.cfg.treadArmor,val:0});
    for(const tg of targets){
      const power=shooters.reduce((a,u)=>a+R.powerOf(u),0); if(power<=0) continue;
      const o=odds(s,power,tg.armor,tg.st);
      let v;
      if(tg.t==="treads"){ const lost=(o.d*power+o.st*Math.floor(power/2)); v=lost*0.42*(m.treads<=15?1.4:1); }
      else v=(o.d+0.35*o.st)*tg.val;
      if(v>bv){ bv=v; best=tg; }
    }
    if(!best) break;
    if(!R.humanFire(s,shooters,best.t)) break;
    if(R.machDefeated(s)) break;
  }
}

function playGame(s){
  for(let guard=0;guard<80&&!s.over;guard++){
    if(s.side==="m") machineTurn(s); else humanTurn(s);
    R.endTurn(s);
  }
  return s.over;
}
return {odds,machineTurn,humanTurn,playGame};
});
