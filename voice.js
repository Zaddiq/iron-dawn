"use strict";
/* voice.js: talk to the other players over the Colosseum table (browser-to-browser audio, WebRTC).
   The table's Firebase node only carries the small setup messages; the sound goes straight between the devices.
   Layout (see database.rules.json):
     rooms/CODE/vc/peers/UID   {t}            "I am in the voice chat" (that device writes it)
     rooms/CODE/vc/sig/TO/FROM {k,sdp,n}      one setup message from FROM to TO (FROM writes it, TO reads it)
   Everybody in the voice chat connects to everybody else (up to four players, so at most three connections each). The device whose uid sorts
   first makes the offer. A device with the microphone off still listens. Nothing starts until the person taps the button.
   Voice.mount(el,getCode,opts) draws the little control (Join voice / Mute / Leave) into el. */
(function(){
const ICE={iceServers:[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]}]};
const S={code:null,on:false,mic:false,muted:false,stream:null,pcs:{},pt:{},offs:[],audio:{},status:"",listeners:new Set(),waitIce:3500};
const say=t=>{ S.status=t; S.listeners.forEach(f=>{ try{ f(); }catch(e){} }); };
const sigPath=(to,from)=>"rooms/"+S.code+"/vc/sig/"+to+(from?"/"+from:"");
const peersPath=u=>"rooms/"+S.code+"/vc/peers"+(u?"/"+u:"");
const iceDone=pc=>new Promise(res=>{ if(pc.iceGatheringState==="complete") return res(); const t=setTimeout(done,S.waitIce); function done(){ clearTimeout(t); pc.removeEventListener("icegatheringstatechange",chk); res(); } function chk(){ if(pc.iceGatheringState==="complete") done(); } pc.addEventListener("icegatheringstatechange",chk); });
function audioFor(u){ if(S.audio[u]) return S.audio[u]; const a=document.createElement("audio"); a.autoplay=true; a.setAttribute("playsinline",""); a.style.display="none"; document.body.appendChild(a); return S.audio[u]=a; }
function newPc(u){
  closePc(u); const pc=new RTCPeerConnection(ICE); S.pcs[u]={pc,n:0,seen:0};
  pc.ontrack=e=>{ const a=audioFor(u); a.srcObject=e.streams[0]||new MediaStream([e.track]); const p=a.play(); if(p&&p.catch) p.catch(()=>{}); };
  pc.onconnectionstatechange=()=>{ const st=pc.connectionState; if(S.pcs[u]&&S.pcs[u].pc===pc){ S.pcs[u].state=st; count(); if(st==="failed"){ closePc(u); retry(u); } } };
  if(S.stream) S.stream.getTracks().forEach(t=>pc.addTrack(t,S.stream)); else pc.addTransceiver("audio",{direction:"recvonly"});
  return pc; }
function closePc(u){ const x=S.pcs[u]; if(x){ try{ x.pc.close(); }catch(e){} delete S.pcs[u]; } const a=S.audio[u]; if(a){ a.srcObject=null; a.remove(); delete S.audio[u]; } }
function count(){ const ok=Object.values(S.pcs).filter(x=>x.state==="connected").length, all=Object.keys(S.pcs).length; say(!S.on?"":all===0?"In voice. Waiting for others to join the voice chat.":ok===all?`Connected to ${ok} ${ok===1?"person":"people"}.`:`Connecting… (${ok} of ${all})`); }
const retryT={}; function retry(u){ if(!S.on||retryT[u]) return; retryT[u]=setTimeout(()=>{ delete retryT[u]; if(S.on&&S.known&&S.known.has(u)) link(u); },2500); }
/* the first uid (alphabetically) starts the call; the other one waits for the offer */
const mine=()=>Net.uid, leads=u=>mine()<u;
async function link(u){
  if(!S.on||u===mine()||!leads(u)) return;
  const pc=newPc(u), x=S.pcs[u]; x.n=Date.now();
  try{ await pc.setLocalDescription(await pc.createOffer()); await iceDone(pc); if(S.pcs[u]!==x) return;
    await Net.b.set(sigPath(u,mine()),{k:"offer",sdp:pc.localDescription.sdp,n:x.n}); count(); }catch(e){ say("Voice problem: "+e.message); }
}
async function onSig(from,m){
  if(!S.on||!m||!m.sdp) return;
  if(m.k==="offer"){ const x0=S.pcs[from]; if(x0&&x0.seen===m.n) return;
    const pc=newPc(from), x=S.pcs[from]; x.seen=m.n;
    try{ await pc.setRemoteDescription({type:"offer",sdp:m.sdp}); await pc.setLocalDescription(await pc.createAnswer()); await iceDone(pc); if(S.pcs[from]!==x) return;
      await Net.b.set(sigPath(from,mine()),{k:"answer",sdp:pc.localDescription.sdp,n:m.n}); count(); }catch(e){ say("Voice problem: "+e.message); } }
  else if(m.k==="answer"){ const x=S.pcs[from]; if(!x||x.n!==m.n||x.pc.signalingState!=="have-local-offer") return;
    try{ await x.pc.setRemoteDescription({type:"answer",sdp:m.sdp}); }catch(e){ say("Voice problem: "+e.message); } }
}
function onPeers(v){
  if(!S.on) return; v=v||{}; const now=new Set(Object.keys(v).filter(u=>u!==mine())); S.known=now;
  for(const u of Object.keys(S.pcs)) if(!now.has(u)){ closePc(u); delete S.pt[u]; }
  for(const u of now){ const t=v[u]&&v[u].t; if(S.pt[u]!==t){ S.pt[u]=t; if(leads(u)) link(u); } else if(!S.pcs[u]&&leads(u)) link(u); }
  count();
}
const Voice=window.Voice={
  get on(){ return S.on; }, get muted(){ return S.muted; }, get mic(){ return S.mic; }, get status(){ return S.status; },
  async rxBytes(){ let n=0; for(const x of Object.values(S.pcs)){ try{ (await x.pc.getStats()).forEach(r=>{ if(r.type==="inbound-rtp"&&r.kind==="audio") n+=r.bytesReceived||0; }); }catch(e){} } return n; },   /* for the tests: audio bytes that arrived */
  peers(){ return Object.fromEntries(Object.entries(S.pcs).map(([u,x])=>[u,x.state||"new"])); },
  onChange(f){ S.listeners.add(f); return ()=>S.listeners.delete(f); },
  async start(code,opts){
    opts=opts||{}; if(S.on) await Voice.stop();
    if(!window.RTCPeerConnection) throw new Error("This browser cannot do voice chat.");
    await Net.start(); S.code=code; S.mic=opts.mic!==false; S.muted=false; S.stream=null; S.known=new Set(); S.pt={};
    if(S.mic){ try{ S.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}); }
      catch(e){ S.mic=false; say("No microphone ("+(e.name==="NotAllowedError"?"permission refused":e.message)+"): listening only."); } }
    S.on=true; try{ await Net.b.remove(sigPath(Net.uid)); }catch(e){}   /* old setup messages are no use now */
    await Net.b.set(peersPath(Net.uid),{t:Date.now()});
    try{ Net.b.onDisc(peersPath(Net.uid),null); }catch(e){}
    S.offs=[Net.b.on(peersPath(),onPeers),Net.b.on(sigPath(Net.uid),v=>{ for(const f of Object.keys(v||{})) onSig(f,v[f]); })];
    count(); S.listeners.forEach(f=>f());
  },
  async stop(){
    const c=S.code, was=S.on; S.on=false; S.offs.forEach(o=>{ try{ o(); }catch(e){} }); S.offs=[];
    for(const u of Object.keys(S.pcs)) closePc(u);
    if(S.stream){ S.stream.getTracks().forEach(t=>t.stop()); S.stream=null; }
    if(was&&c){ try{ await Net.b.cancelDisc(peersPath(Net.uid)); }catch(e){} try{ await Net.b.remove(peersPath(Net.uid)); await Net.b.remove(sigPath(Net.uid)); }catch(e){} }
    S.known=null; say(""); S.listeners.forEach(f=>f());
  },
  mute(m){ S.muted=!!m; if(S.stream) S.stream.getAudioTracks().forEach(t=>t.enabled=!S.muted); S.listeners.forEach(f=>f()); },
  /* the little control: Join voice / Mute / Leave (the table code comes from getCode()) */
  mount(el,getCode,opts){
    opts=opts||{}; el.innerHTML=`<div class="mut vcLine">${esc0(opts.label||"Voice")}: <span class="vcSt">off</span></div><div class="vcRow"><button class="vcJoin">Join voice</button><button class="vcListen">Listen only</button><button class="vcMute" style="display:none">Mute</button><button class="vcLeave" style="display:none">Leave voice</button></div><div class="mut vcHelp" style="font-size:13px">${esc0(opts.help||"Use this when you are not in the same room as the others. Use headphones to avoid echo.")}</div>`;
    const q=s=>el.querySelector(s), st=q(".vcSt");
    const draw=()=>{ const on=Voice.on; q(".vcJoin").style.display=on?"none":""; q(".vcListen").style.display=on?"none":""; q(".vcLeave").style.display=on?"":"none"; q(".vcMute").style.display=on&&Voice.mic?"":"none"; q(".vcMute").textContent=Voice.muted?"Unmute":"Mute";
      st.textContent=on?(Voice.status||"on")+(Voice.mic?(Voice.muted?" (your mic is muted)":" (your mic is on)"):" (listening only)"):(Voice.status||"off"); };
    const go=async mic=>{ const c=getCode(); if(!c){ st.textContent="Open the table first."; return; } try{ await Voice.start(c,{mic}); }catch(e){ st.textContent=e.message; return; } draw(); };
    q(".vcJoin").onclick=()=>go(true); q(".vcListen").onclick=()=>go(false); q(".vcLeave").onclick=()=>Voice.stop(); q(".vcMute").onclick=()=>Voice.mute(!Voice.muted);
    Voice.onChange(draw); draw(); return {draw};
  }
};
const esc0=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
})();
