"use strict";
/* rules.js: the Iron Dawn rules, no screen code (works in a browser page and in node for tests and the balance simulation).
   Original rules and numbers for this project; every tunable number lives in CFG so the simulator can adjust them.
   Coordinates are axial {q,r} like phone-map.js. Row r=0 is the north edge (the humans' end), r=H-1 the south edge (the machine's start). */
(function(root,factory){ if(typeof module==="object"&&module.exports) module.exports=factory(); else root.Rules=factory(); })(this,function(){

const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const key=(q,r)=>q+","+r;
const dist=(a,b)=>{ const dq=a.q-b.q, dr=a.r-b.r; return (Math.abs(dq)+Math.abs(dr)+Math.abs(dq+dr))/2; };
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

/* every tunable number */
const CFG={
  W:15, H:12, mapSeed:7,
  /* terrain */
  cost:{clear:1,rubble:2,ruins:2},          /* move cost for vehicles; infantry pay 1 everywhere (wreck fields are blocked for all) */
  mapMix:{ruins:0.18,rubble:0.14,wreck:0.06},
  /* combat */
  stunAt:3, killAt:5, stunnedKillAt:4,       /* roll + Power - Armor */
  treadArmor:1, hqArmor:4, ruinsVehicleBonus:1,
  /* the Prowler */
  treadBoxes:20, treadBrackets:[[11,2],[1,1]],   /* [min boxes, Move]: Move 2 while 11+ boxes are left, 1 below that, 0 when none */
  parts:[ {k:"main",n:1,power:5,reach:3,armor:4}, {k:"side",n:3,power:3,reach:2,armor:3}, {k:"missile",n:2,power:5,reach:5,armor:2,ammo:1}, {k:"ap",n:6,power:1,reach:1,armor:1,infOnly:true} ],
  crushCost:{bulwark:3,lancer:2,scout:1,skimmer:1,longgun:1,inf:0,hq:0},
  maxTurns:14
};
const PARTNAME={main:"main cannon",side:"side gun",missile:"missile",ap:"anti-troop gun"};
const TYPES={
  bulwark:{name:"Bulwark",power:4,reach:2,armor:3,move:3,value:6},
  scout:{name:"Scout",power:2,reach:2,armor:2,move:4,value:3},
  lancer:{name:"Lancer",power:3,reach:4,armor:2,move:2,value:6},
  skimmer:{name:"Skimmer",power:2,reach:2,armor:2,move:5,value:3},
  longgun:{name:"Long Gun",power:6,reach:6,armor:1,move:0,value:8},
  inf:{name:"Rifle Squads",power:1,reach:1,armor:1,move:2,value:2},
  hq:{name:"Field HQ",power:0,reach:0,armor:0,move:0,value:30}
};

function buildMap(cfg){
  const rng=mulberry32(cfg.mapSeed), t=new Map();
  for(let r=0;r<cfg.H;r++) for(let c=0;c<cfg.W;c++){
    const q=c-Math.floor(r/2), x=rng(); let k="clear", a=0;
    for(const n of ["ruins","rubble","wreck"]){ a+=cfg.mapMix[n]; if(x<a){ k=n; break; } }
    t.set(key(q,r),k);
  }
  const mid=Math.floor(cfg.W/2);                         /* a clear lane up the middle, the machine's road; the HQ sits in ruins */
  for(let r=0;r<cfg.H;r++){ const q=mid-Math.floor(r/2); if(r===1) t.set(key(q,r),"ruins"); else if(t.get(key(q,r))==="wreck") t.set(key(q,r),"clear"); }
  t.set(key(mid-Math.floor((cfg.H-1)/2),cfg.H-1),"clear");
  return t;
}
const onMap=(s,q,r)=>s.map.has(key(q,r));
const terrain=(s,q,r)=>s.map.get(key(q,r));

function newGame(seed,cfgOver){
  const cfg=Object.assign({},CFG,cfgOver||{});
  const s={cfg,rng:mulberry32(seed|0),map:buildMap(cfg),turn:1,side:"m",units:[],nextId:1,log:[],over:null};
  const mid=Math.floor(cfg.W/2);
  s.mach={q:mid-Math.floor((cfg.H-1)/2),r:cfg.H-1,treads:cfg.treadBoxes,parts:[]};
  for(const p of cfg.parts) for(let i=0;i<p.n;i++) s.mach.parts.push({id:p.k+i,k:p.k,power:p.power,reach:p.reach,armor:p.armor,infOnly:!!p.infOnly,ammo:p.ammo||0,alive:true,s:0,fired:false});
  return s;
}
function addUnit(s,type,q,r,sq){ const u={id:s.nextId++,t:type,q,r,sq:type==="inf"?(sq||1):0,s:0,fired:false,moved:false}; s.units.push(u); return u; }

const note=(s,t)=>{ s.log.push(t); };
const NAME=u=>u.t==='inf'?'Rifle Squads':TYPES[u.t].name;
const die=s=>1+Math.floor(s.rng()*6);
const unitsAt=(s,q,r)=>s.units.filter(u=>u.q===q&&u.r===r);
const isInf=u=>u.t==="inf";

function armorOf(s,u){
  const tr=terrain(s,u.q,u.r);
  if(isInf(u)) return u.sq*((tr==="ruins"||tr==="rubble")?2:1);
  const base=u.t==="hq"?s.cfg.hqArmor:TYPES[u.t].armor;
  return base+(tr==="ruins"?s.cfg.ruinsVehicleBonus:0);
}
const powerOf=u=>isInf(u)?u.sq:TYPES[u.t].power;

/* one attack roll. Returns {roll,total,result:"none"|"stun"|"destroy"} */
function roll(s,power,armor,alreadyStunned){
  const r=die(s), total=r+power-armor, c=s.cfg;
  const kill=alreadyStunned?c.stunnedKillAt:c.killAt;
  return {roll:r,total,result:total>=kill?"destroy":total>=c.stunAt?"stun":"none"};
}
function hitUnit(s,u,power){
  const x=roll(s,power,armorOf(s,u),u.s>0);
  if(x.result==="destroy") remove(s,u);
  else if(x.result==="stun"){ if(isInf(u)){ u.sq--; if(u.sq<=0) remove(s,u); } else u.s=2; }
  if(u.t==="hq"&&x.result==="destroy") s.over={winner:"machine",why:"The Field HQ was destroyed."};
  return x;
}
function hitPart(s,p,power){
  const x=roll(s,power,p.armor,p.s>0);
  if(x.result==="destroy") p.alive=false; else if(x.result==="stun") p.s=2;
  return x;
}
function hitTreads(s,power){
  const x=roll(s,power,s.cfg.treadArmor,false);
  const lost=x.result==="destroy"?power:x.result==="stun"?Math.floor(power/2):0;
  s.mach.treads=Math.max(0,s.mach.treads-lost); x.lost=lost; return x;
}
function remove(s,u){ const i=s.units.indexOf(u); if(i>=0) s.units.splice(i,1); }

/* ---------- the machine ---------- */
function machMove(s){ const t=s.mach.treads; for(const [min,mv] of s.cfg.treadBrackets) if(t>=min) return mv; return 0; }
const partFires=p=>p.alive&&p.s===0&&!p.fired&&(p.k!=="missile"||p.ammo>0);
function machWeapons(s){ return s.mach.parts.filter(partFires); }
function machDefeated(s){ return !s.mach.parts.some(p=>p.alive&&(p.k==="main"||p.k==="side"||(p.k==="missile"&&p.ammo>0))); }

/* the cheapest way for the machine from its hex to (tq,tr); crossing a human vehicle costs extra (it loses treads). Returns an array of hexes (without the start) */
function machPath(s,tq,tr){
  const start={q:s.mach.q,r:s.mach.r}, best=new Map([[key(start.q,start.r),0]]), prev=new Map(), todo=[[0,start]];
  while(todo.length){
    todo.sort((a,b)=>a[0]-b[0]); const [c,h]=todo.shift(); if(c>best.get(key(h.q,h.r))) continue;
    if(h.q===tq&&h.r===tr) break;
    for(const d of DIRS){ const q=h.q+d[0], r=h.r+d[1]; if(!onMap(s,q,r)) continue; const tn=terrain(s,q,r); if(tn==="wreck") continue;
      let n=c+s.cfg.cost[tn]; for(const u of unitsAt(s,q,r)) n+=2*(s.cfg.crushCost[u.t]||0);
      if(n<(best.has(key(q,r))?best.get(key(q,r)):1e9)){ best.set(key(q,r),n); prev.set(key(q,r),h); todo.push([n,{q,r}]); } }
  }
  const path=[]; let h={q:tq,r:tr}; if(!best.has(key(tq,tr))) return null;
  while(!(h.q===start.q&&h.r===start.r)){ path.unshift(h); h=prev.get(key(h.q,h.r)); }
  return path;
}
/* walk the path as far as the machine's Move allows (at least one hex if it has any Move); crush whatever is in the hexes. Returns the steps taken */
function machWalk(s,path){
  let pts=machMove(s), n=0; if(pts<1||!path) return 0;
  for(const h of path){
    const c=s.cfg.cost[terrain(s,h.q,h.r)]; if(n>0&&c>pts) break; pts-=c; n++;
    s.mach.q=h.q; s.mach.r=h.r;
    for(const u of unitsAt(s,h.q,h.r).slice()){ s.mach.treads=Math.max(0,s.mach.treads-(s.cfg.crushCost[u.t]||0)); remove(s,u); note(s,"The Prowler crushes "+NAME(u)+(s.cfg.crushCost[u.t]?" and loses "+s.cfg.crushCost[u.t]+" tread boxes.":".")); if(u.t==="hq") s.over={winner:"machine",why:"The Prowler crushed the Field HQ."}; }
    if(s.over||pts<=0||machMove(s)<1) break;
  }
  if(n) note(s,"The Prowler moves "+n+" hex"+(n>1?"es":"")+".");
  return n;
}
/* fire the listed parts together at a human unit (or at nothing) */
function machFire(s,parts,u){
  let power=0; for(const p of parts){ if(!partFires(p)) continue; if(p.infOnly&&!isInf(u)) continue; if(dist(s.mach,u)>p.reach) continue; power+=p.power; p.fired=true; if(p.k==="missile") p.ammo--; }
  if(power<=0) return null; const x=Object.assign({power},hitUnit(s,u,power));
  note(s,"The Prowler fires (Power "+power+") at "+NAME(u)+": rolled "+x.roll+", total "+x.total+" = "+(x.result==="destroy"?(isInf(u)?"stack destroyed":"destroyed"):x.result==="stun"?(isInf(u)?"one squad lost":"stunned"):"no effect")+".");
  return x;
}

/* ---------- the humans ---------- */
function unitCanFire(s,u){ return u.t!=="hq"&&u.s===0&&!u.fired&&TYPES[u.t].reach>0&&dist(u,s.mach)<=TYPES[u.t].reach; }
/* fire the listed units together at one machine target: a part, or "treads" */
function humanFire(s,units,target){
  let power=0; for(const u of units){ if(!unitCanFire(s,u)) continue; power+=powerOf(u); u.fired=true; }
  if(power<=0) return null;
  const x=Object.assign({power},target==="treads"?hitTreads(s,power):hitPart(s,target,power));
  note(s,"Your fire (Power "+power+") at the Prowler's "+(target==="treads"?"treads":PARTNAME[target.k]+(target.k==="side"||target.k==="missile"||target.k==="ap"?" "+(+target.id.slice(target.k.length)+1):""))+": rolled "+x.roll+", total "+x.total+" = "+(target==="treads"?(x.lost?x.lost+" tread boxes lost":"no effect"):x.result==="destroy"?"destroyed":x.result==="stun"?"jammed for a turn":"no effect")+".");
  return x;
}
/* hexes a unit may reach this turn: {hex key -> cost}. Friends can be passed through, not ended on if full. */
function reach(s,u){
  const mv=TYPES[u.t].move, out=new Map([[key(u.q,u.r),0]]), todo=[[0,{q:u.q,r:u.r}]];
  while(todo.length){ todo.sort((a,b)=>a[0]-b[0]); const [c,h]=todo.shift(); if(c>out.get(key(h.q,h.r))) continue;
    for(const d of DIRS){ const q=h.q+d[0], r=h.r+d[1]; if(!onMap(s,q,r)||(q===s.mach.q&&r===s.mach.r)) continue; const tn=terrain(s,q,r); if(tn==="wreck") continue;
      const n=c+(isInf(u)?1:s.cfg.cost[tn]); if(n>mv) continue;
      if(n<(out.has(key(q,r))?out.get(key(q,r)):1e9)){ out.set(key(q,r),n); todo.push([n,{q,r}]); } } }
  for(const k of [...out.keys()]){ const [q,r]=k.split(",").map(Number); if(q===u.q&&r===u.r) continue; const there=unitsAt(s,q,r);
    const full=isInf(u)?(there.some(x=>!isInf(x))||there.filter(isInf).reduce((a,x)=>a+x.sq,0)+u.sq>3):there.length>0; if(full) out.delete(k); }
  return out;
}
function humanMove(s,u,q,r){ if(u.s>0||!reach(s,u).has(key(q,r))) return false; u.q=q; u.r=r; u.moved=true; return true; }

/* ---------- turns ---------- */
/* start of a side's turn: its stunned units count down, weapons and shots are reset. */
function startTurn(s){
  const hum=s.side==="h";
  for(const u of s.units){ if(hum){ u.fired=false; u.moved=false; if(u.s>0) u.s--; } }
  if(!hum){ for(const p of s.mach.parts){ p.fired=false; if(p.s>0) p.s--; } }
}
function endTurn(s){
  if(s.over) return;
  if(s.side==="h"){ s.turn++; s.side="m"; } else s.side="h";
  const hqs=s.units.some(u=>u.t==="hq");
  if(!hqs&&!s.over) s.over={winner:"machine",why:"The Field HQ was destroyed."};
  if(!s.over&&machDefeated(s)) s.over={winner:"humans",why:"The Prowler lost its heavy weapons."};
  if(!s.over&&s.mach.treads<1){ const hq=s.units.find(u=>u.t==="hq"), far=!hq||!s.mach.parts.some(p=>p.alive&&!p.infOnly&&(p.k!=="missile"||p.ammo>0)&&p.reach>=dist(s.mach,hq));
    if(far) s.over={winner:"humans",why:"The Prowler is stuck and cannot reach the Field HQ."}; }
  if(!s.over&&s.turn>s.cfg.maxTurns) s.over={winner:"humans",why:"The Prowler ran out of time."};
  if(!s.over) startTurn(s);
}

return {CFG,TYPES,PARTNAME,NAME,note,DIRS,key,dist,mulberry32,buildMap,newGame,addUnit,die,unitsAt,isInf,armorOf,powerOf,terrain,onMap,roll,hitUnit,hitPart,hitTreads,remove,
  machMove,partFires,machWeapons,machDefeated,machPath,machWalk,machFire,unitCanFire,humanFire,reach,humanMove,startTurn,endTurn};
});
