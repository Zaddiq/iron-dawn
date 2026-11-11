"use strict";
/* scenario1.js: "The Long Street" setup. One Prowler comes up the middle from the south edge; the humans set up in the north and middle of the map.
   setupHumans places a force on the map; the placement is the computer's own (a human player would choose hexes). */
(function(root,factory){ if(typeof module==="object"&&module.exports) module.exports=factory(require("./rules.js")); else root.Scenario1=factory(root.Rules); })(this,function(R){

const FORCE={
  full:[["bulwark"],["bulwark"],["lancer"],["scout"],["scout"],["skimmer"],["longgun"],["inf",3],["inf",3],["inf",3],["inf",2]],
  minus2:[["bulwark"],["lancer"],["scout"],["scout"],["skimmer"],["longgun"],["inf",3],["inf",3],["inf",3],["inf",2]]   /* two armor units fewer: the handicap the rulebook suggests for evenly matched players */
};

function setupHumans(s,force){
  const cfg=s.cfg, mid=Math.floor(cfg.W/2), q0=r=>mid-Math.floor(r/2);
  s.hq=R.addUnit(s,"hq",q0(1),1);
  const free=(q,r)=>R.onMap(s,q,r)&&R.terrain(s,q,r)!=="wreck"&&R.unitsAt(s,q,r).length===0;
  for(const [type,sq] of FORCE[force||"full"]){
    let best=null, bs=-1e9;
    for(let r=(type==="longgun"?2:3);r<=(type==="longgun"?4:8);r++) for(let c=0;c<cfg.W;c++){
      const q=c-Math.floor(r/2); if(!free(q,r)) continue; const tn=R.terrain(s,q,r);
      let sc=(tn==="ruins"?2:tn==="rubble"?1:0)+s.rng()*1.5-Math.abs(c-mid)*0.12;
      if(type!=="longgun"&&type!=="inf") sc-=Math.abs(r-6)*0.2;
      if(sc>bs){ bs=sc; best={q,r}; } }
    R.addUnit(s,type,best.q,best.r,sq);
  }
  return s;
}
function newScenario(seed,force,cfgOver){ const s=R.newGame(seed,cfgOver); setupHumans(s,force); R.startTurn(s); return s; }
return {FORCE,setupHumans,newScenario};
});
