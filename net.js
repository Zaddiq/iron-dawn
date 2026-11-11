"use strict";
/* net.js: the table transport for the Colosseum (host tablet <-> player phones).
   Two backends with the same small API:
   - "firebase": Firebase Realtime Database + anonymous sign-in (the real thing; config in firebase-config.js)
   - "mem": a fake kept in localStorage so several tabs of one browser can play together (tests; add ?net=mem to both pages)
   Room layout (see database.rules.json):
     rooms/CODE/host            uid of the tablet
     rooms/CODE/pub             what everybody may read (host writes): {open, seats:{uid:{p,name,fighter}}}
     rooms/CODE/join/UID        a phone asks to join: {name, on, t}   (that phone writes, the host reads)
     rooms/CODE/priv/UID        host -> one phone (later: that player's secret options)
     rooms/CODE/cmd/UID         one phone -> host (later: that player's picks) */
(function(){
const SDK="https://www.gstatic.com/firebasejs/10.12.2/";
const ALPHA="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   /* no I, O, 0, 1: easy to read out loud */
const loadScript=src=>new Promise((ok,bad)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>bad(new Error("Could not load "+src+" (no internet?)")); document.head.appendChild(s); });
const parts=p=>String(p).split("/").filter(Boolean);

function firebaseBackend(cfg){
  let db,auth;
  const ref=p=>db.ref(parts(p).join("/"));
  return {
    kind:"firebase", uid:null,
    async init(){
      if(!cfg||!cfg.apiKey) throw new Error("firebase-config.js is missing or empty.");
      if(!window.firebase) for(const f of ["app","auth","database"]) await loadScript(SDK+"firebase-"+f+"-compat.js");
      if(!firebase.apps.length) firebase.initializeApp(cfg);
      auth=firebase.auth(); db=firebase.database();
      let u=await new Promise(r=>{ const off=auth.onAuthStateChanged(x=>{ off(); r(x); }); });   /* a returning phone keeps its old identity */
      if(!u){ try{ u=(await auth.signInAnonymously()).user; }catch(e){ throw new Error("Anonymous sign-in failed ("+(e.code||e.message)+"). In the Firebase console, turn on Authentication > Sign-in method > Anonymous."); } }
      this.uid=u.uid;
    },
    get:async p=>(await ref(p).once("value")).val(),
    set:(p,v)=>ref(p).set(v),
    update:(p,v)=>ref(p).update(v),
    remove:p=>ref(p).remove(),
    on(p,cb){ const r=ref(p), h=r.on("value",s=>cb(s.val()),e=>cb(undefined,e)); return ()=>r.off("value",h); },
    async create(p,v){ const res=await ref(p).transaction(cur=>cur===null?v:undefined); return !!res.committed; },   /* write only if empty */
    onDisc:(p,v)=>ref(p).onDisconnect().set(v),
    cancelDisc:p=>ref(p).onDisconnect().cancel()
  };
}

function memBackend(){
  const K="netmem-tree", subs=new Set(), disc=[];
  let uid; try{ uid=sessionStorage.getItem("netmem-uid"); if(!uid){ uid="m"+Math.random().toString(36).slice(2,12); sessionStorage.setItem("netmem-uid",uid); } }catch(e){ uid="m"+Math.random().toString(36).slice(2,12); }
  const load=()=>{ try{ return JSON.parse(localStorage.getItem(K)||"{}")||{}; }catch(e){ return {}; } };
  const save=t=>localStorage.setItem(K,JSON.stringify(t));
  const getIn=(t,ps)=>{ for(const k of ps){ if(t==null||typeof t!=="object") return null; t=t[k]; } return t===undefined?null:t; };
  const setIn=(t,ps,v)=>{ if(!ps.length) return v==null?{}:v; let o=t; for(let i=0;i<ps.length-1;i++){ if(o[ps[i]]==null||typeof o[ps[i]]!=="object") o[ps[i]]={}; o=o[ps[i]]; } if(v==null) delete o[ps[ps.length-1]]; else o[ps[ps.length-1]]=v; return t; };
  const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
  const fire=()=>{ const t=load(); for(const s of [...subs]){ const v=clone(getIn(t,s.ps)), j=JSON.stringify(v); if(j!==s.last){ s.last=j; s.cb(v); } } };
  window.addEventListener("storage",e=>{ if(e.key===K) fire(); });
  window.addEventListener("pagehide",()=>{ for(const d of disc){ const t=load(); setIn(t,d.ps,d.v); save(t); } });
  return {
    kind:"mem", uid,
    async init(){ this.uid=uid; },
    async get(p){ return clone(getIn(load(),parts(p))); },
    async set(p,v){ const t=load(); setIn(t,parts(p),clone(v)); save(t); fire(); },
    async update(p,v){ for(const k of Object.keys(v)) await this.set(p+"/"+k,v[k]); },
    async remove(p){ await this.set(p,null); },
    on(p,cb){ const s={ps:parts(p),cb,last:undefined}; subs.add(s); setTimeout(()=>{ const v=clone(getIn(load(),s.ps)); s.last=JSON.stringify(v); cb(v); },0); return ()=>subs.delete(s); },
    async create(p,v){ const t=load(); if(getIn(t,parts(p))!=null) return false; setIn(t,parts(p),clone(v)); save(t); fire(); return true; },
    onDisc(p,v){ disc.push({ps:parts(p),v:clone(v)}); },
    cancelDisc(p){ const k=parts(p).join("/"); for(let i=disc.length-1;i>=0;i--) if(disc[i].ps.join("/")===k) disc.splice(i,1); }
  };
}

const Net={
  b:null, uid:null, kind:null,
  /* which backend this page uses: ?net=mem for the test fake, otherwise Firebase */
  wanted(){ return /[?&]net=mem\b/.test(location.search)?"mem":"firebase"; },
  async start(){ if(this.b) return this.uid; const k=this.wanted(); const b=k==="mem"?memBackend():firebaseBackend(window.FIREBASE_CONFIG); await b.init(); this.b=b; this.uid=b.uid; this.kind=k; return this.uid; },
  code(){ let s=""; for(let i=0;i<5;i++) s+=ALPHA[Math.floor(Math.random()*ALPHA.length)]; return s; },
  clean(c){ return String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12); },   /* a table name: 3 to 12 letters and digits, any case */
  STALE:24*3600*1000,   /* a table nobody has touched for a day can be taken over by another tablet */
  /* host side */
  /* open (or reopen) a table. name = "" gives a random code; a chosen name like STEVE is reused every time.
     Reopening your own table keeps the phones in it; a name held by another tablet is refused unless that table has been idle for a day. */
  async openRoom(name){
    const want=this.clean(name);
    if(!want){ for(let i=0;i<8;i++){ const c=this.code(); if(await this.b.create("rooms/"+c+"/host",this.uid)){ await this.b.set("rooms/"+c+"/pub",{open:true,t:Date.now()}); return c; } } throw new Error("Could not make a table code, try again."); }
    if(want.length<3) throw new Error("A table name needs 3 to 12 letters or digits.");
    if(await this.b.create("rooms/"+want+"/host",this.uid)){ await this.b.set("rooms/"+want+"/pub",{open:true,t:Date.now()}); return want; }
    const h=await this.b.get("rooms/"+want+"/host");
    if(h===this.uid) return want;
    const pub=await this.b.get("rooms/"+want+"/pub");
    if(!pub||!pub.t||Date.now()-pub.t>this.STALE){   /* an abandoned table: take it over and clear what was left in it */
      await this.b.set("rooms/"+want+"/host",this.uid);
      for(const k of ["join","priv","cmd","res","vc"]) await this.b.remove("rooms/"+want+"/"+k);
      await this.b.set("rooms/"+want+"/pub",{open:true,t:Date.now()});
      return want;
    }
    throw new Error("The name "+want+" is in use by another tablet. Pick a different table name.");
  },
  publish(c,pub){ return this.b.set("rooms/"+c+"/pub",pub); },
  watchJoins(c,cb){ return this.b.on("rooms/"+c+"/join",cb); },
  async closeRoom(c){ await this.b.remove("rooms/"+c+"/pub"); await this.b.remove("rooms/"+c+"/join"); await this.b.remove("rooms/"+c+"/priv"); await this.b.remove("rooms/"+c+"/cmd"); await this.b.remove("rooms/"+c+"/res"); await this.b.remove("rooms/"+c+"/vc"); await this.b.remove("rooms/"+c+"/host"); },
  kick(c,uid){ return this.b.remove("rooms/"+c+"/join/"+uid); },
  /* phone side */
  async joinRoom(c,name,fj){
    const host=await this.b.get("rooms/"+c+"/host"); if(!host) throw new Error("There is no table with the code "+c+".");
    const pub=await this.b.get("rooms/"+c+"/pub"); if(!pub||!pub.open) throw new Error("That table is closed.");
    if(pub.locked&&!(await this.b.get("rooms/"+c+"/join/"+this.uid))) throw new Error("The table "+c+" is locked: no new phones can join. Ask the host to unlock it.");
    const me={name:String(name).slice(0,20),on:true,t:Date.now()}; if(fj) me.fj=fj;
    await this.b.set("rooms/"+c+"/join/"+this.uid,me);
    this.b.onDisc("rooms/"+c+"/join/"+this.uid+"/on",false);
    return host;
  },
  setFighter(c,fj){ return this.b.set("rooms/"+c+"/join/"+this.uid+"/fj",fj||null); },   /* the character this phone brings (a JSON string, see phone.html) */
  setOn(c,on){ return this.b.set("rooms/"+c+"/join/"+this.uid+"/on",!!on); },
  async leaveRoom(c){ try{ await this.b.cancelDisc("rooms/"+c+"/join/"+this.uid+"/on"); }catch(e){} return this.b.remove("rooms/"+c+"/join/"+this.uid); },
  watchMe(c,cb){ return this.b.on("rooms/"+c+"/join/"+this.uid,cb); },
  /* host <-> one phone: the host writes priv/UID (what that player may see), the phone writes cmd/UID (what they chose) */
  sendPriv(c,uid,obj){ return this.b.set("rooms/"+c+"/priv/"+uid,obj); },
  watchCmds(c,cb){ return this.b.on("rooms/"+c+"/cmd",cb); },
  watchPriv(c,cb){ return this.b.on("rooms/"+c+"/priv/"+this.uid,cb); },
  sendCmd(c,obj){ return this.b.set("rooms/"+c+"/cmd/"+this.uid,obj); },
  /* host -> one phone: experience results to be saved in that phone's own roster */
  sendRes(c,uid,obj){ return this.b.set("rooms/"+c+"/res/"+uid,obj); },
  watchRes(c,cb){ return this.b.on("rooms/"+c+"/res/"+this.uid,cb); },
  watchPub(c,cb){ return this.b.on("rooms/"+c+"/pub",cb); }
};
window.Net=Net;
})();
