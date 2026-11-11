"use strict";
/* phone-map.js: the hex map on the phone (Colosseum online table, item 4).
   The tablet sends a small scene (sc): board hexes bd [[q,r,entrance?]], created objects ob [[q,r,"f|w|s|l"]], figures u
   [{c:[[q,r]..],f,k,L,z,d,v,s}], optional tappable hexes hl [[q,r,cost]] of kind hk ("go", "dest" or "ret"), and fc {q,r,f} for the facing circles.
   Drawing only: the rules stay on the tablet. Tapping calls o.onHex(key,kind) or o.onFace(d). Geometry matches colosseum.html. */
(function(){
const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]], SCR=[120,60,0,-60,-120,180];
const pt=(q,r)=>[-(0.866*q+1.732*r),1.5*q];
const corner=(c,i)=>{ const a=Math.PI/180*(60*i+90); return [c[0]+Math.cos(a),c[1]+Math.sin(a)]; };
const poly=c=>[0,1,2,3,4,5].map(i=>corner(c,i).map(v=>v.toFixed(2)).join(",")).join(" ");
const COL=["var(--me)","var(--foe)","var(--p3)","var(--p4)","var(--mob)"];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const vang=f=>{ const a=DIRS[f],b=DIRS[(f+1)%6],v=pt(a[0]+b[0],a[1]+b[1]); return Math.atan2(v[1],v[0])*180/Math.PI; };   /* the way a big figure points */
const OBJ={f:["#e8590c",.5,"🔥"],w:["#6b7280",.92,"▦"],s:["#111",.5,""],l:["#38bdf8",.5,""],x:["#6b7280",.5,""]};

/* the area worth showing: my figure, the hexes I may tap, and the circles; the whole board when nothing is asked of me */
function bounds(sc,all){
  const pts=[]; const add=(q,r)=>pts.push(pt(q,r));
  if(!all){
    const me=sc.u.find(u=>u.s); if(me) me.c.forEach(x=>add(x[0],x[1])); if(sc.fc) add(sc.fc.q,sc.fc.r);
    if(sc.hl&&sc.hl.length<=14) sc.hl.forEach(h=>add(h[0],h[1]));   /* a short list of hexes is the action; a long one (a free walk, Teleport) is not */
    else if(sc.hl&&me){ const m=pt(me.c[0][0],me.c[0][1]); let best=null, bd=1e9;   /* so show me and the nearest other figure */
      for(const u of sc.u) if(u!==me){ const c=pt(u.c[0][0],u.c[0][1]), d=Math.hypot(c[0]-m[0],c[1]-m[1]); if(d<bd){ bd=d; best=u; } }
      if(best) best.c.forEach(x=>add(x[0],x[1])); }
  }
  const focus=pts.length>0;
  if(!focus) for(const h of sc.bd) add(h[0],h[1]);
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]), m=focus?2.4:1.4;
  let x0=Math.min(...xs)-m, x1=Math.max(...xs)+m, y0=Math.min(...ys)-m, y1=Math.max(...ys)+m;
  if(focus){ const w=Math.max(x1-x0,9), h=Math.max(y1-y0,9); const cx=(x0+x1)/2, cy=(y0+y1)/2; x0=cx-w/2; x1=cx+w/2; y0=cy-h/2; y1=cy+h/2; }
  return [x0,y0,x1-x0,y1-y0,focus];
}

function render(el,sc,o){
  o=o||{}; if(!sc||!sc.bd){ el.innerHTML=""; return {focus:false}; }
  const C=(q,r)=>pt(q,r), sel=o.sel||"";
  let s=""; for(const h of sc.bd) s+=`<polygon points="${poly(C(h[0],h[1]))}" fill="var(${h[2]?"--hexend":"--hex"})" stroke="var(--line)" stroke-width=".05"/>`;
  for(const b of sc.ob||[]){ const c=C(b[0],b[1]), k=OBJ[b[2]]||OBJ.x; s+=`<polygon points="${poly(c)}" fill="${k[0]}" fill-opacity="${k[1]}" stroke="${k[0]}" stroke-width=".06" pointer-events="none"/>${k[2]?`<text x="${c[0]}" y="${c[1]+.3}" text-anchor="middle" font-size=".8" pointer-events="none">${k[2]}</text>`:""}`; }
  /* tappable hexes under the figures, so a figure never blocks a tap on its own hex */
  const kind=sc.hk||"";
  if(o.mega){ const g=new Map(sc.bd.map(h=>[h[0]+","+h[1],h[3]])); let e="";   /* the megahex outlines: a heavy line wherever the next hex belongs to another megahex (or none) */
    for(const h of sc.bd){ const c=C(h[0],h[1]); for(let d=0;d<6;d++){ const k=(h[0]+DIRS[d][0])+","+(h[1]+DIRS[d][1]);
      if(!g.has(k)||g.get(k)!==h[3]){ const a0=Math.PI/180*(SCR[d]-30), a1=Math.PI/180*(SCR[d]+30);
        e+=`<line x1="${(c[0]+Math.cos(a0)).toFixed(2)}" y1="${(c[1]+Math.sin(a0)).toFixed(2)}" x2="${(c[0]+Math.cos(a1)).toFixed(2)}" y2="${(c[1]+Math.sin(a1)).toFixed(2)}" stroke="var(--acc)" stroke-width=".16" stroke-linecap="round" pointer-events="none"/>`; } } }
    s+=e; }
  for(const h of sc.hl||[]){ const c=C(h[0],h[1]), k=h[0]+","+h[1], on=k===sel;
    s+=`<polygon data-h="${k}" points="${poly(c)}" fill="var(--acc)" fill-opacity="${on?.6:.28}" stroke="var(--acc)" stroke-width="${on?.16:.07}" style="cursor:pointer"/>`;
    if(kind==="go"&&h[2]>0&&!o.mega) s+=`<text x="${c[0]}" y="${c[1]+.22}" text-anchor="middle" font-size=".6" font-weight="700" fill="var(--acc)" pointer-events="none">${h[2]}</text>`; }
  for(const u of sc.u){ const col=COL[u.k<0?4:u.k]||COL[4], op=u.v&&u.d<2?.4:u.d===1?.6:1;
    if(u.z>1){ for(const x of u.c) s+=`<polygon points="${poly(C(x[0],x[1]))}" fill="var(--card)" stroke="${col}" stroke-width=".1" opacity="${op}" pointer-events="none"/>`;
      const cs=u.c.map(x=>C(x[0],x[1])), cx=cs.reduce((a,v)=>a+v[0],0)/cs.length, cy=cs.reduce((a,v)=>a+v[1],0)/cs.length, rot=vang(u.f);
      s+=`<g transform="translate(${cx.toFixed(2)},${cy.toFixed(2)})" pointer-events="none" opacity="${op}"><g transform="rotate(${rot.toFixed(1)})"><path d="M-.9 -.3 L.3 -.3 L.3 -.7 L1.3 0 L.3 .7 L.3 .3 L-.9 .3 Z" fill="${col}" opacity=".85"/></g><text x="-.2" y=".2" font-size=".6" font-weight="700" fill="var(--card)" text-anchor="middle">${esc(u.L)}</text></g>`; continue; }
    const c=C(u.c[0][0],u.c[0][1]), a=SCR[u.f]*Math.PI/180, tx=Math.cos(a), ty=Math.sin(a);
    if(u.im&&u.d!==2&&/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(u.im)){   /* the player's own picture: the top of the art is the way the figure faces */
      s+=`<g transform="translate(${c[0].toFixed(2)},${c[1].toFixed(2)}) rotate(${SCR[u.f]+90})" pointer-events="none" opacity="${op}">${u.s?`<circle r=".84" fill="none" stroke="${col}" stroke-width=".07" stroke-dasharray=".2 .14"/>`:""}<rect x="-.52" y="-.52" width="1.04" height="1.04" rx=".12" fill="var(--card)"/><image href="${u.im}" x="-.5" y="-.5" width="1" height="1" preserveAspectRatio="xMidYMid slice"/><rect x="-.52" y="-.52" width="1.04" height="1.04" rx=".12" fill="none" stroke="${col}" stroke-width=".1"/><circle cx="-.33" cy=".33" r=".22" fill="${col}"/><text x="-.33" y=".33" dy=".115" font-size=".34" font-weight="700" fill="var(--card)" text-anchor="middle" transform="rotate(${-(SCR[u.f]+90)} -.33 .33)">${esc(u.L)}</text></g>`; continue; }
    s+=`<g pointer-events="none" opacity="${op}">${u.s?`<circle cx="${c[0]}" cy="${c[1]}" r=".84" fill="none" stroke="${col}" stroke-width=".07" stroke-dasharray=".2 .14"/>`:""}`
      +`<rect x="${(c[0]-.5).toFixed(2)}" y="${(c[1]-.5).toFixed(2)}" width="1" height="1" rx=".14" fill="var(--card)" stroke="${col}" stroke-width=".1"/>`
      +(u.d===2?`<path d="M${c[0]-.3} ${c[1]-.3} L${c[0]+.3} ${c[1]+.3} M${c[0]-.3} ${c[1]+.3} L${c[0]+.3} ${c[1]-.3}" stroke="${col}" stroke-width=".12" stroke-linecap="round"/>`:`<text x="${c[0]}" y="${c[1]+.22}" text-anchor="middle" font-size=".66" font-weight="700" fill="${col}">${esc(u.L)}</text>`)
      /* the facing: a triangle on the side the figure looks toward */
      +`<polygon points="${(c[0]+tx*.9).toFixed(2)},${(c[1]+ty*.9).toFixed(2)} ${(c[0]+tx*.52-ty*.3).toFixed(2)},${(c[1]+ty*.52+tx*.3).toFixed(2)} ${(c[0]+tx*.52+ty*.3).toFixed(2)},${(c[1]+ty*.52-tx*.3).toFixed(2)}" fill="${col}"/></g>`; }
  if(sc.fc){ const c=C(sc.fc.q,sc.fc.r);
    for(let d=0;d<6;d++){ const a=SCR[d]*Math.PI/180, x=(c[0]+Math.cos(a)*1.05).toFixed(2), y=(c[1]+Math.sin(a)*1.05).toFixed(2);
      s+=`<circle cx="${x}" cy="${y}" r=".26" fill="${d===sc.fc.f?"var(--acc)":"var(--card)"}" stroke="var(--acc)" stroke-width=".09" pointer-events="none"/><circle data-f="${d}" cx="${x}" cy="${y}" r=".5" fill="transparent" style="cursor:pointer"/>`; } }
  const b=bounds(sc,!!o.all);
  el.setAttribute("viewBox",b[0].toFixed(2)+" "+b[1].toFixed(2)+" "+b[2].toFixed(2)+" "+b[3].toFixed(2));
  el.innerHTML=s;
  el.querySelectorAll("[data-h]").forEach(e=>e.onclick=()=>{ if(o.onHex) o.onHex(e.dataset.h,kind); });
  el.querySelectorAll("[data-f]").forEach(e=>e.onclick=()=>{ if(o.onFace) o.onFace(+e.dataset.f); });
  return {focus:b[4]};
}
window.PhoneMap={render};
})();
