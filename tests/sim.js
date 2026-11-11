"use strict";
/* balance simulation: node tests/sim.js [games] [force] [key=value ...]   e.g. node tests/sim.js 2000 full treadBoxes=40
   The computer plays both sides with ai.js. Prints how often each side wins. */
const R=require("../rules.js"), S=require("../scenario1.js"), AI=require("../ai.js");
function run(n,force,over){
  let m=0,h=0,turns=0; const why={};
  for(let i=0;i<n;i++){ const s=S.newScenario((over.seed0||1000)+i,force,over); const o=AI.playGame(s); if(o.winner==="machine") m++; else h++; turns+=s.turn; why[o.why]=(why[o.why]||0)+1; }
  return {machine:m/n,humans:h/n,avgTurns:turns/n,why};
}
module.exports=run;
if(require.main===module){
  const n=+process.argv[2]||1000, force=process.argv[3]||"full", over={};
  for(const a of process.argv.slice(4)){ const [k,v]=a.split("="); over[k]=JSON.parse(v); }
  const r=run(n,force,over); console.log(force,JSON.stringify(r,null,1));
}
