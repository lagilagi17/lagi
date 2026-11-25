'use strict';
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root?.document)api.install(root);})(typeof window!=='undefined'?window:globalThis,function(){
 const VERSION='carrier-manual-boats-20261120-v4',clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0)),smooth=t=>t*t*(3-2*t),d2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function install(g){if(!g||g.__HANQ_CARRIER_TRANSIT__)return g?.HanQNorthCoastTransit;const C=g.HanQNorthCoast;if(!C?.create)throw Error('HanQNorthCoast required');g.__HANQ_CARRIER_TRANSIT__=1;
  function wrap(rt,options={}){let s=null;const lastSafe=new WeakMap();const O={attach:rt.attach.bind(rt),tick:rt.tick.bind(rt),near:rt.nearbyAction.bind(rt),act:rt.performAction.bind(rt),surf:rt.surfaceAt.bind(rt),block:rt.pointBlocked.bind(rt),solid:rt.solidAt.bind(rt),resolve:rt.resolve.bind(rt),map:rt.mapData.bind(rt),points:rt.transportPoints?.bind(rt)};
   const sea=rt.spec.seaLevel||0,service={...rt.fromCarrier(44.5,-104),height:sea+5.2,layer:'service'},serviceDoor={...rt.fromCarrier(35.5,-80),height:sea+5.2,layer:'service'},engineDoor={...rt.fromCarrier(18,-78),height:sea+2.8,layer:'engine'},engineStairs={...rt.fromCarrier(0,25),height:sea+2.8,layer:'engine'},hangarStairs={...rt.fromCarrier(15,42),height:sea+11.36,layer:'hangar'};
   const EDGE=Object.freeze({kind:'northCoastTransitEdge',northCoast:true,indestructible:true,hgt:1000}),WALL=Object.freeze({kind:'northCoastTransitWall',northCoast:true,indestructible:true,hgt:8});
   // Local x/z, visual half extents, top above sea and walking clearance.
   // The four meshes start at sea + 2.7; weapons and cameras share their solids.
   const MACHINERY=[[-10.5,-45,4,20,6.2,.1],[10.5,-45,4,20,6.2,.1],[-11,10,4,10,5.5,0],[11,10,4,10,5.5,0]];
   const rect=(p,x0,x1,z0,z1,r=0)=>p.x>=x0+r&&p.x<=x1-r&&p.z>=z0+r&&p.z<=z1-r,near=(e,p,r=5)=>e&&p&&d2(e,p)<=r;
   function st(){
    if(!s?.northCoast)return null;
    let t=s.northCoast.transit;
    if(!t||typeof t!=='object'||Array.isArray(t))t=s.northCoast.transit={};
    t.active=!!t.active;t.progress=clamp(t.progress,0,1);return t;
   }
   const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
   function boats(){return s?.open?.crafts?.filter(b=>b.ncTransitFerry)||[];}
   function installBoats(){
    if(!s?.open||!s.northCoast)return;
    s.open.crafts??=[];
    if(!Array.isArray(s.northCoast.boatIds))s.northCoast.boatIds=[];
    const ids=s.northCoast.boatIds,p=pts();
    for(const dock of ['carrier','mainland','island']){
     if(!p[dock])continue;
     const id=dock==='carrier'?'northcoast:transit:ferry':'northcoast:transit:'+dock;
     let b=s.open.crafts.find(x=>x.id===id);
     if(!b&&!ids.includes(id)){
      const q=water(dock,p[dock]);
      b={id,kind:'ship',ncTransitFerry:true,ncDockHome:dock,x:q.x,y:q.y,h:sea,gy:sea,yaw:q.yaw,v:0,thr:0,rudder:0,roll:0,hp:720,maxHp:720,gunT:0,torps:0,torpT:0,turret:q.yaw,elev:0,dead:false,deadT:0,flash:0,pilot:false,westportSpeed:27};
      s.open.crafts.push(b);
     }
     if(b){b.ncTransitFerry=true;b.ncManualBoat=true;b.ncDockHome??=dock;b.westportLength=9.9;b.torps=0;b.torpT=0;}
     if(!ids.includes(id))ids.push(id);
    }
   }
   // The native HUD, camera, damage and projectile code all use war.me as the
   // authoritative occupied craft. Keep that reference paired with player.craft.
   function claim(e,b){
    e.craft=b;b.pilot=true;
    if(s.war){s.war.me=b;s.war.vehicle=b.kind;s.war.aimPt=null;}
   }
   function release(e,b){
    if(b){b.pilot=false;b.v=b.thr=b.rudder=0;}
    if(e?.craft===b)e.craft=null;
    if(s.war?.me===b){s.war.me=null;s.war.vehicle=null;s.war.aimPt=null;}
   }
   function cancel(e,b){const t=st();if(t)t.active=false;release(e,b);}
   // Old automatic-voyage saves may contain a boat inside an obsolete pier.
   // This path is used only to repair that saved position once, never to steer.
   function plan(A,B){
    if(!finitePoint(A)||!finitePoint(B))return null;
    const clear=(a,b)=>{
     const n=Math.max(1,Math.ceil(d2(a,b)/2));
     for(let i=0;i<=n;i++){
      const k=i/n,x=a.x+(b.x-a.x)*k,y=a.y+(b.y-a.y)*k;
      if(rt.waterBlocked(x,y,9))return false;
      const h=rt.groundAt?.(x,y)??options.getNativeGround?.(x,y);
      if(Number.isFinite(h)&&h>sea+.1)return false;
     }
     return true;
    };
    const nodes=[{x:A.x,y:A.y},{x:B.x,y:B.y},...[-50,50].flatMap(x=>[-190,0,190].map(z=>rt.fromCarrier(x,z)))];
    const dist=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),used=new Set();dist[0]=0;
    for(let pass=0;pass<nodes.length;pass++){
     let i=-1;for(let j=0;j<nodes.length;j++)if(!used.has(j)&&(i<0||dist[j]<dist[i]))i=j;
     if(i<0||!Number.isFinite(dist[i]))break;if(i===1)break;used.add(i);
     for(let j=0;j<nodes.length;j++)if(!used.has(j)&&clear(nodes[i],nodes[j])){
      const cost=dist[i]+d2(nodes[i],nodes[j]);if(cost<dist[j]){dist[j]=cost;prev[j]=i;}
     }
    }
    if(!Number.isFinite(dist[1]))return null;
    const points=[];for(let i=1;i>=0;i=prev[i])points.unshift(nodes[i]);return points;
   }
   function pathLength(path){let total=0;for(let i=1;i<path.length;i++)total+=d2(path[i-1],path[i]);return total;}
   function tripReady(t){
    if(!t||!finitePoint(t.start)||!finitePoint(t.end)||!finitePoint(t.land)||!Number.isFinite(t.land.height)||!Number.isFinite(t.duration)||t.duration<=0)return false;
    if(!Array.isArray(t.path)||t.path.length<2||!t.path.every(finitePoint)){
     // Earlier island berths were inside the pier. Replanning those saved
     // coordinates fails before the boat can resume, so migrate known route
     // endpoints to their current water berths while retaining trip progress.
     const docks=pts(),A=docks[t.from],B=docks[t.to];
     const start=A?water(t.from,A):t.start,end=B?water(t.to,B):t.end,path=plan(start,end);
     if(!path)return false;
     t.start={x:start.x,y:start.y};t.end={x:end.x,y:end.y};t.path=path;
     t.duration=clamp(pathLength(path)/25,7.5,40);
     if(B)t.land={x:B.x,y:B.y,height:B.height??B.h??sea,layer:B.layer||null};
    }
    return true;
   }
   // The island boarding point is the dry end of its existing pier, not the
   // inland timetable marker. All three boats remain where the player parks them.
   // Dock prompts run every frame. Read only the live dock positions instead
   // of rebuilding the complete coastline polygons, roads and map markers.
   function pts(){const p=O.points?O.points():O.map().transportPoints,is=p?.island;return{mainland:s?.northCoast?.mainlandAccess||p?.mainland||null,island:is?{...is,x:is.x+2,y:is.y+14,height:is.height??is.h,layer:'island'}:null,carrier:service};}
   function water(id,p){if(id==='carrier'){const q=rt.fromCarrier(54.5,-104);return{...q,yaw:Math.PI/2-rt.spec.carrier.yaw+Math.PI};}return id==='island'?{x:p.x,y:p.y+18,yaw:Math.PI/2}:{x:p.x,y:p.y-18,yaw:-Math.PI/2};}
   function route(e){
    if(!e||!e.alive||e.vehicle||e.craft||e.climb||e.air||e.mortar||e.alt>.15||e.jz>.4)return null;
    for(const [dock,p]of Object.entries(pts())){
     if(!p||!near(e,p,7)||(dock==='carrier'&&e.ncLayer!=='service')||(dock!=='carrier'&&['deck','hangar','service','engine'].includes(e.ncLayer)))continue;
     const q=water(dock,p),b=boats().filter(b=>!b.dead&&!b.pilot&&Math.abs(b.v||0)<3&&near(b,q,16)&&near(b,p,26)).sort((a,b)=>d2(a,p)-d2(b,p))[0];
     if(b)return{id:'manual-boat-'+b.id,kind:'ferry',label:'연락정 직접 조종 · W/S 속도 · A/D 조타',boatId:b.id,dock};
    }
    return null;
   }
   function begin(e,a){
    const current=route(e),b=boats().find(b=>b.id===a.boatId);
    if(!current||current.boatId!==a.boatId||!b)return{handled:true,message:'가까이 정박한 연락정에 탑승해 주세요.'};
    Object.assign(st(),{version:2,manual:true,active:false,boatId:b.id,from:current.dock});
    b.v=b.thr=b.rudder=0;claim(e,b);e.vehicle=null;e.x=b.x;e.y=b.y;e.floor=e.alt=e.jz=e.vz=e.vx=e.vy=0;e.air=false;
    e.roll=e.vault=e.climb=e.plat=null;e.crouch=false;e.healT=e.reloadT=0;delete e.ncLayer;
    s.pitch=.2;s.open.craftIn={fwd:0,side:0};
    if(s.input){s.input.fire=s.input.ads=s.input.adsToggle=false;s.input.heli=null;}
    return{handled:true,kind:'ferry',message:'연락정 직접 조종 · W/S 전진·감속·후진 · A/D 조타 · 접안 후 F 하선',aim:b.yaw};
   }
   function landing(b){
    if(!b||b.kind!=='ship'||b.dead||b.ncBoatStowed)return null;
    for(const [dock,p]of Object.entries(pts())){
     if(!p||!near(b,water(dock,p),16)||!near(b,p,26))continue;
     const height=p.height??p.h??sea,probe={ncLayer:p.layer||undefined};
     const surface=dock==='carrier'?csurf(probe,p.x,p.y,.32):O.surf(probe,p.x,p.y,.32);
     const blocked=dock==='carrier'?cblock(p.x,p.y,probe,.32):O.block(p.x,p.y,probe,.32);
     if(blocked||surface===null)continue;
     return{x:p.x,y:p.y,height,layer:p.layer||null,dock};
    }
    return null;
   }
   function legacyPosition(t,b){
    const length=pathLength(t.path);let remaining=smooth(t.progress)*length,at=t.path[t.path.length-1],yaw=b.yaw;
    for(let i=1;i<t.path.length;i++){
     const a=t.path[i-1],q=t.path[i],span=d2(a,q);
     if(remaining<=span||i===t.path.length-1){const k=span?clamp(remaining/span,0,1):1;at={x:a.x+(q.x-a.x)*k,y:a.y+(q.y-a.y)*k};yaw=Math.atan2(q.y-a.y,q.x-a.x);break;}
     remaining-=span;
    }
    Object.assign(b,{x:at.x,y:at.y,h:sea,yaw,v:0,thr:0,rudder:0});
   }
   function restoreManual(createdLegacyBoat=false){
    const t=st(),p=s?.ents?.[0],old=s?.open?.crafts?.find(b=>b.id==='northcoast:transit:ferry');
    if(!t)return;
    const occupied=p?.craft?.ncTransitFerry?p.craft:s.war?.me?.ncTransitFerry?s.war.me:null;
    if(t.active&&!t.manual&&p?.alive&&old&&!old.dead&&tripReady(t)){
     const h=finitePoint(old)?rt.groundAt?.(old.x,old.y)??options.getNativeGround?.(old.x,old.y):Infinity;
     if(createdLegacyBoat||!finitePoint(old)||rt.waterBlocked(old.x,old.y,6)||(Number.isFinite(h)&&h>sea+.1))legacyPosition(t,old);
     old.v=old.thr=old.rudder=0;claim(p,old);
     Object.assign(p,{x:old.x,y:old.y,floor:0,alt:0,jz:0,vz:0,vx:0,vy:0,air:false});delete p.ncLayer;t.boatId=old.id;
    }else if(occupied&&p?.alive&&!occupied.dead){claim(p,occupied);t.boatId=occupied.id;}
    else if(t.active||occupied)cancel(p,occupied||old);
    Object.assign(t,{version:2,manual:true,active:false});
   }
   function syncManual(){
    const p=s?.ents?.[0],t=st();if(!t)return;
    t.active=false;
    for(const b of boats()){
     if(p?.craft===b&&p.alive&&!b.dead){claim(p,b);t.boatId=b.id;}
     else if(b.pilot||p?.craft===b||s.war?.me===b)release(p,b);
    }
   }
   // Keep the maintenance stairs clear of the original hangar/deck lift at (15,30).
   function inside(e){if(!e||e.alive===false||e.vehicle||e.craft||e.climb||e.mortar||e.air||e.alt>.15||e.jz>.4||e.indoorPenta||Number.isInteger(e.pentaFloor)||Number.isInteger(e.deepFloor))return null;if(e.ncLayer==='service'&&near(e,serviceDoor,4))return{id:'carrier-service-engine',kind:'transfer',label:'방수문 · 하부 기계실로'};if(e?.ncLayer==='engine'&&near(e,engineDoor,4))return{id:'carrier-engine-service',kind:'transfer',label:'방수문 · 외부 정비 통로로'};if(e?.ncLayer==='engine'&&near(e,engineStairs,4))return{id:'carrier-engine-hangar',kind:'transfer',label:'기관실 계단 · 격납고로'};if(e?.ncLayer==='hangar'&&near(e,hangarStairs,4))return{id:'carrier-hangar-engine',kind:'transfer',label:'정비 계단 · 하부 기계실로'};return null;}
   function move(e,id){if(inside(e)?.id!==id)return{handled:false};let q,msg;if(id==='carrier-service-engine')q=engineDoor,msg='항공모함 하부 기계실 도착';else if(id==='carrier-engine-service')q=serviceDoor,msg='항공모함 외부 정비 통로 도착';else if(id==='carrier-engine-hangar')q=hangarStairs,msg='항공모함 격납고 정비 구역 도착';else if(id==='carrier-hangar-engine')q=engineStairs,msg='항공모함 하부 기계실 도착';else return{handled:false};Object.assign(e,{x:q.x,y:q.y,ncLayer:q.layer,floor:q.height-(rt.groundAt?.(q.x,q.y)??0),alt:0,jz:0,vx:0,vy:0,vz:0,air:false,roll:null,vault:null,climb:null,plat:null});return{handled:true,kind:'transfer',message:msg};}
   function csurf(e,x=e?.x,y=e?.y,r=0){if(!Number.isFinite(x)||!Number.isFinite(y))return undefined;const p=rt.toCarrier(x,y);if(e?.ncLayer==='service')return rect(p,33.5,47.5,-119,-69,r)?{height:sea+5.2,layer:'service',region:'carrier',id:'service_catwalk',walkable:true}:null;if(e?.ncLayer==='engine')return rect(p,-20,20,-90,31,r)?{height:sea+2.8,layer:'engine',region:'carrier',id:'engine_room',walkable:true}:null;return undefined;}
   function cblock(x,y,e,r=.32){const p=rt.toCarrier(x,y);if(e?.ncLayer==='service')return rect(p,33.5,47.5,-119,-69)?null:EDGE;if(e?.ncLayer==='engine'){if(!rect(p,-20,20,-90,31))return EDGE;for(const b of MACHINERY)if(Math.abs(p.x-b[0])<=b[2]+b[5]+r&&Math.abs(p.z-b[1])<=b[3]+r)return WALL;return null;}return undefined;}
   function csolid(x,y,h){const p=rt.toCarrier(x,y),H=h-sea;if(rect(p,33.5,47.5,-119,-69)&&H>=5.03&&H<=5.26)return WALL;if(rect(p,-20,20,-90,31)){if((H>=2.62&&H<=2.82)||(H>=8.35&&H<=8.58))return WALL;if((Math.abs(Math.abs(p.x)-20)<.22||Math.abs(p.z+90)<.22||Math.abs(p.z-31)<.22)&&H>=2.7&&H<=8.55)return WALL;if(H>=2.7)for(const b of MACHINERY)if(H<=b[4]&&Math.abs(p.x-b[0])<=b[2]&&Math.abs(p.z-b[1])<=b[3])return WALL;}return null;}
   rt.attach=x=>{s=x;const v=O.attach(x),createdLegacyBoat=!s.open?.crafts?.some(b=>b.id==='northcoast:transit:ferry');installBoats();restoreManual(createdLegacyBoat);return v;};rt.tick=(dt,E)=>{const v=O.tick(dt,E);syncManual();return v;};rt.nearbyAction=(e,o={})=>inside(e)||route(e)||((x=>x?.id?.startsWith('ferry-')?null:x)(O.near(e,o)));rt.performAction=(e,a)=>a?.kind==='ferry'?begin(e,a):/^carrier-(?:service-engine|engine-service|engine-hangar|hangar-engine)$/.test(a?.id||'')?move(e,a.id):O.act(e,a);rt.transitLanding=landing;rt.transitBerths=()=>Object.fromEntries(Object.entries(pts()).filter(([,p])=>p).map(([id,p])=>[id,water(id,p)]));rt.surfaceAt=(e,x,y,r)=>{const v=csurf(e,x,y,r);return v===undefined?O.surf(e,x,y,r):v;};rt.pointBlocked=(x,y,e,r)=>{const v=cblock(x,y,e,r);return v===undefined?O.block(x,y,e,r):v;};rt.solidAt=(x,y,h)=>csolid(x,y,h)||O.solid(x,y,h);rt.resolve=(e,p,r=.32)=>{
    if(e?.ncLayer!=='service'&&e?.ncLayer!=='engine')return O.resolve(e,p,r);
    const q=csurf(e,e.x,e.y,r),b=cblock(e.x,e.y,e,r);
    if(q&&!b){e.floor=q.height-(rt.groundAt?.(e.x,e.y)??0);lastSafe.set(e,{x:e.x,y:e.y,layer:e.ncLayer});return true;}
    const old=p||lastSafe.get(e),oldSurface=old&&csurf(e,old.x,old.y,r);
    const validOld=oldSurface&&!cblock(old.x,old.y,e,r)&&(!old.layer||old.layer===e.ncLayer);
    const z=validOld?{x:old.x,y:old.y,height:oldSurface.height}:e.ncLayer==='service'?service:engineDoor;
    Object.assign(e,{x:z.x,y:z.y,vx:0,vy:0,floor:z.height-(rt.groundAt?.(z.x,z.y)??0)});
    lastSafe.set(e,{x:e.x,y:e.y,layer:e.ncLayer});return true;
   };rt.mapData=()=>{const m=O.map(),p=pts();m.transportPoints={...m.transportPoints,island:p.island,carrier:{...service},serviceDoor:{...serviceDoor},engineRoom:{...engineDoor}};m.markers=[...(m.markers||[]).filter(x=>x.id!=='carrier_ferry'),{id:'carrier_service_access',x:service.x,y:service.y,label:'항모 외부 정비 통로 · 연락정',color:'#e4c778'},{id:'carrier_engine_room',x:engineDoor.x,y:engineDoor.y,label:'항모 하부 기계실',color:'#d98d65'}];if(p.island)m.markers.push({id:'island_coast_landing',x:p.island.x,y:p.island.y,label:'섬 해안 선착장 · 연락정',color:'#92d4e2'});return m;};rt.transitPoints=()=>({serviceDock:{...service},serviceDoor:{...serviceDoor},engineDoor:{...engineDoor},engineStairs:{...engineStairs},hangarStairs:{...hangarStairs}});return rt;}
  g.HanQNorthCoast=Object.freeze({...C,version:`${C.version||2}+transit`,create:o=>wrap(C.create(o),o)});
  const A=g.HanQNorthCoastAssets;if(A?.build)g.HanQNorthCoastAssets=Object.freeze({...A,build(T,o){const sc=A.build(T,o),G=new T.Group();G.name='carrier_service_engine_room';sc.regions.carrier.add(G);const owned=[];const M=new T.MeshStandardMaterial({color:0x465259,roughness:.72,metalness:.55}),D=new T.MeshStandardMaterial({color:0x263236,roughness:.78,metalness:.5}),L=new T.MeshStandardMaterial({color:0xd9a85b,emissive:0xa65d1c,emissiveIntensity:.8});owned.push(M,D,L);const box=(n,a,b,c,x,y,z,m=D)=>{const q=new T.BoxGeometry(a,b,c);owned.push(q);const v=new T.Mesh(q,m);v.name=n;v.position.set(x,y,z);v.castShadow=v.receiveShadow=true;G.add(v);return v;};box('service_catwalk',14,.28,50,40.5,5.08,-94,M);for(const x of[34,47])box('service_rail',.1,1.2,50,x,5.75,-94,M);box('engine_floor',40,.35,121,0,2.62,-29.5,M);box('engine_ceiling',40,.25,121,0,8.55,-29.5,D);for(const x of[-20,20])box('engine_wall',.25,6,121,x,5.6,-29.5,M);for(const x of[-10.5,10.5])box('main_engine',8,3.5,40,x,4.45,-45,D);for(const x of[-11,11])box('generator',8,2.8,20,x,4.1,10,D);for(const z of[-78,-38,2,22])box('engine_light',1.3,.15,.35,0,8.25,z,L);
    const ship=(n,s,e)=>{const q=new T.Group();q.name=n;sc.root.add(q);const add=(a,b,c,x,y,z,m=M)=>{const z0=new T.BoxGeometry(a,b,c);owned.push(z0);const v=new T.Mesh(z0,m);v.position.set(x,y,z);v.castShadow=true;q.add(v);};add(e?12:7,e?2.6:1.7,e?46:22,0,1,0);add(e?10:6,.35,e?35:18,0,2.35,0,D);add(e?6:3.5,e?4.5:2.8,e?8:5,0,4.2,e?-5:-2);q.scale.setScalar(s);return q;},F=[[ship('AEGIS_ESCORT_01',1,1),145,82,.2,.02],[ship('AEGIS_ESCORT_02',.94,1),155,96,3.25,.018],[ship('AEGIS_PATROL_01',.72,0),96,142,1.15,.032],[ship('AEGIS_PATROL_02',.66,0),112,126,4.1,.035],[ship('AEGIS_PATROL_03',.7,0),82,160,5.35,.029]],up=sc.update.bind(sc),dispose=sc.dispose.bind(sc);sc.update=x=>{up(x);const t=Number(x.time)||0,c=sc.metadata.placement.carrier;for(const f of F){const a=f[3]+t*f[4];f[0].position.set(c[0]+Math.cos(a)*f[1],c[1],c[2]+Math.sin(a)*f[2]);f[0].rotation.y=a+Math.PI/2;}};sc.dispose=()=>{if(sc.disposed)return;for(const f of F)f[0].removeFromParent();G.removeFromParent();for(const x of owned)x.dispose();dispose();};sc.metadata.transit={fleetCount:5,serviceDock:[44.5,5.2,-104],engineRoom:true};return sc;}});
  return g.HanQNorthCoastTransit=Object.freeze({version:VERSION});}
 return{version:VERSION,install};
});
