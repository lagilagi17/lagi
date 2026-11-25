/* Hayeon era entry point. Only this small loader is loaded with the main game.
 * Authored models and lossless terrain data load on first portal use. */
(function(global){'use strict';
  const BASE='past/',VERSION='20261124-airborne-terrain-contact';
  let scriptsPromise=null;
  function progress(fn,value,label){if(typeof fn==='function')fn({progress:value,label});}
  function timeout(promise,label,ms=45000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' 시간이 초과되었습니다. 포탈에서 다시 시도해 주세요.')),ms);})]).finally(()=>clearTimeout(timer));}
  function script(path){return new Promise((resolve,reject)=>{
    const element=document.createElement('script');element.src=BASE+path+'?v='+VERSION;element.async=true;
    let finished=false;const timer=setTimeout(()=>{if(finished)return;finished=true;element.remove?.();reject(Error('과거 세계 모듈 연결 시간이 초과되었습니다. 다시 시도해 주세요.'));},45000);
    element.onload=()=>{if(finished)return;finished=true;clearTimeout(timer);resolve();};
    element.onerror=()=>{if(finished)return;finished=true;clearTimeout(timer);element.remove?.();reject(Error('과거 세계 모듈을 불러오지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.'));};
    (document.head||document.body).appendChild(element);
  });}
  function ready(){
    if(global.HanQPastRuntime&&global.HanQPastNavigation)return Promise.resolve();
    if(!scriptsPromise)scriptsPromise=Promise.all([script('runtime.js'),script('navigation.js')]).catch(e=>{scriptsPromise=null;throw e;});
    return scriptsPromise;
  }
  async function json(path){
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=setTimeout(()=>controller?.abort(),45000);
    try{const response=await timeout(fetch(BASE+path+'?v='+VERSION,controller?{signal:controller.signal}:{}),'과거 세계 자료 연결');if(!response.ok)throw Error('과거 세계 자료 요청 실패 ('+response.status+')');return await timeout(response.json(),'과거 세계 자료 읽기');}
    finally{clearTimeout(timer);}
  }
  function base64(text){
    if(typeof atob==='function'){const binary=atob(text),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',bytes=new Uint8Array(Math.floor(text.length*3/4)-(text.endsWith('==')?2:text.endsWith('=')?1:0));let bit=0,acc=0,n=0;
    for(const ch of text){if(ch==='=')break;const v=chars.indexOf(ch);if(v<0)continue;acc=(acc<<6)|v;bit+=6;if(bit>=8){bit-=8;bytes[n++]=(acc>>bit)&255;}}
    return bytes;
  }
  async function hash(bytes){if(!global.crypto?.subtle)return null;const h=new Uint8Array(await global.crypto.subtle.digest('SHA-256',bytes));return Array.from(h,b=>b.toString(16).padStart(2,'0')).join('');}
  async function loadData(onProgress){
    if(typeof DecompressionStream!=='function')throw Error('이 브라우저는 과거 지도 압축 해제를 지원하지 않습니다. 최신 Chrome, Edge, Firefox 또는 Safari에서 다시 열어 주세요.');
    const manifest=await json('world-data.manifest.json');
    if(manifest.format!=='hanq-past-gzip-json/1'||!Array.isArray(manifest.chunks)||!manifest.chunks.length)throw Error('과거 지도 형식이 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.');
    const chunks=new Array(manifest.chunks.length);let next=0,done=0;
    async function worker(){while(next<manifest.chunks.length){const i=next++,spec=manifest.chunks[i],chunk=await json(spec.file);const bytes=base64(chunk.data);if(bytes.length!==spec.bytes)throw Error('과거 지도 조각이 손상되었습니다. 다시 시도해 주세요.');const actual=await hash(bytes);if(actual&&actual!==spec.sha256)throw Error('과거 지도 무결성 확인에 실패했습니다. 다시 시도해 주세요.');chunks[i]=bytes;done++;progress(onProgress,.08+.5*done/chunks.length,'과거 지도 지형을 불러오는 중');}}
    await Promise.all(Array.from({length:Math.min(4,chunks.length)},worker));
    const compressed=new Uint8Array(manifest.compressedBytes);let offset=0;for(const bytes of chunks){compressed.set(bytes,offset);offset+=bytes.length;}
    if(offset!==compressed.length)throw Error('과거 지도 크기가 맞지 않습니다.');
    progress(onProgress,.62,'원래 지형과 건물 배치를 복원하는 중');
    const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const raw=new Uint8Array(await timeout(new Response(stream).arrayBuffer(),'과거 지도 압축 해제'));
    const actual=await hash(raw);if(raw.byteLength!==manifest.bytes||actual&&actual!==manifest.sha256)throw Error('과거 지도의 원본 확인에 실패했습니다.');
    const data=JSON.parse(new TextDecoder().decode(raw));return {data,manifest};
  }
  function makeWorld(T,data,scene,manifest,onProgress,uiRoot){
    const nav=global.HanQPastNavigation.create(T),built=global.HanQPastRuntime.create(T,data,nav),world=built.world,K=built.kit,root=world.root;
    nav.setTerrain(world.terrain);nav.makeFixtures(world);root.name='HANQ_PAST_HAYEON_GAME';root.visible=false;
    // Source geography and all original plot centres remain untouched.
    const additions=new T.Group();additions.name='Chronicle_Return_Network';root.add(additions);
    const stone=new T.MeshStandardMaterial({color:0x777b69,roughness:.95}),dark=new T.MeshStandardMaterial({color:0x343e38,roughness:.88}),wood=new T.MeshStandardMaterial({color:0x775637,roughness:.9}),metal=new T.MeshStandardMaterial({color:0xceb16b,roughness:.55,metalness:.55}),glow=new T.MeshStandardMaterial({color:0x63e6d3,emissive:0x2d8c80,emissiveIntensity:1.3,transparent:true,opacity:.6,side:T.DoubleSide});
    const portalMeshes=[],travelNodes=[],checkpoints=nav.checkpoints,waypoints=nav.waypoints;
    function box(parent,name,x,y,z,w,h,d,mat){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
    function label(parent,text,x,y,z,size=.65){return K.text(parent,text,[x,y,z],size,'#f0e2b2');}
    function checkpoint(id,name,position,region){const c={id,label:name,position:position.slice(),era:'past',region};checkpoints.push(c);return c;}
    function pointFree(x,z,size=12){
      const heights=[];
      for(const dx of [-size/2,0,size/2])for(const dz of [-size/2,0,size/2]){const h=world.terrain.heightAt(x+dx,z+dz);if(!Number.isFinite(h)||h<.8||h>280)return null;heights.push(h);}
      const floor=Math.max(...heights)+.34;if(Math.max(...heights)-Math.min(...heights)>1.4)return null;
      for(const item of nav.instances){if(item.id.startsWith('past-'))continue;const b=item.bounds;if(x+size/2+2>b.min.x&&x-size/2-2<b.max.x&&z+size/2+2>b.min.z&&z-size/2-2<b.max.z)return null;}
      for(const dx of [-size/2,0,size/2])for(const dz of [-size/2,0,size/2])if(nav.pointSolid(x+dx,floor+1,z+dz,.5))return null;
      return floor;
    }
    function safeSite(x,z,size){
      for(let ring=0;ring<23;ring++){const count=ring?16:1,radius=ring*12;for(let n=0;n<count;n++){const angle=n/count*Math.PI*2,xx=x+Math.sin(angle)*radius,zz=z+Math.cos(angle)*radius;const y=pointFree(xx,zz,size);if(y!==null)return [xx,y,zz];}}
      throw Error('과거 세계 이동 거점의 안전한 지면을 찾지 못했습니다.');
    }
    function pad(id,name,position,width=12,depth=10){
      const g=new T.Group();g.name=id;additions.add(g);const [x,y,z]=position;
      let min=Infinity;for(const dx of [-width/2,width/2])for(const dz of [-depth/2,depth/2])min=Math.min(min,world.terrain.heightAt(x+dx,z+dz));
      box(g,'stone-arrival-foundation',x,(y+min-.4)/2,z,width,y-min+.4,depth,stone);
      for(const side of [-1,1]){box(g,'arrival-edge-post',x+side*(width/2-.45),y+1.1,z-depth/2+.45,.5,2.2,.5,wood);box(g,'brass-route-marker',x+side*(width/2-.45),y+2.22,z-depth/2+.45,.68,.2,.68,metal);}
      // Exact rendered treads, extending to the original terrain without modifying it.
      const endZ=z+depth/2+6,endY=world.terrain.heightAt(x,endZ),steps=Math.max(3,Math.ceil((y-endY)/.27)),run=6/steps;
      for(let i=0;i<steps;i++){const top=y+(endY-y)*(i+1)/steps,zz=z+depth/2+run*(i+.5);box(g,'access-step-'+i,x,top-.2,zz,4,.4,run+.025,stone);}
      label(g,name,x,y+3.0,z-depth/2+.4,.85);
      nav.addObject(g,id);waypoints.push({id:id+'-ground',label:name+' 접근로',position:[x,endY,endZ+.6],era:'past'});
      for(let i=steps-1;i>=0;i--){const zz=z+depth/2+run*(i+.5),top=y+(endY-y)*(i+1)/steps;waypoints.push({id:id+'-step-'+i,label:name+' 계단',position:[x,top,zz],era:'past'});}
      waypoints.push({id:id+'-landing',label:name,position:position.slice(),era:'past'});
      return g;
    }
    function routeMarker(id,name,position,target){
      const g=new T.Group();g.name=id;additions.add(g);const [x,y,z]=position;
      box(g,'route-sign-post',x,y+1,z,.25,2,.25,wood);box(g,'route-sign-face',x,y+1.65,z+.03,2.8,.9,.16,dark);
      label(g,name,x,y+1.7,z+.13,.45);label(g,'E · 이동',x,y+.9,z+.15,.25);
      const ring=new T.Mesh(new T.TorusGeometry(.55,.06,6,24),metal);ring.rotation.x=-Math.PI/2;ring.position.set(x,y+.065,z+1.05);g.add(ring);
      nav.addObject(g,id);travelNodes.push({id,label:name,position:[x,y,z+1.05],radius:3,targetCheckpoint:target,detail:'시간의 흔적이 이어진 역참과 나루로 이동'});
    }
    progress(onProgress,.86,'귀환문과 지역 이동 거점을 연결하는 중');
    const arrivalPos=safeSite(1132,318,26),arrival=checkpoint('past-arrival','하연 · 귀환의 뜰',arrivalPos,'main');
    const arrivalPad=pad('past-arrival-plaza','하연 · 시간의 귀환문',arrivalPos,30,24),[ax,ay,az]=arrivalPos;
    // Returning to the labyrinth never depends on a quest or a consumable.
    const portalGroup=new T.Group();portalGroup.name='Past_Return_Portal';additions.add(portalGroup);
    box(portalGroup,'portal-pillar-left',ax-3.1,ay+3.4,az-7,.8,6.8,1.1,dark);box(portalGroup,'portal-pillar-right',ax+3.1,ay+3.4,az-7,.8,6.8,1.1,dark);box(portalGroup,'portal-crown',ax,ay+6.7,az-7,7,.8,1.3,stone);
    const membrane=new T.Mesh(new T.PlaneGeometry(5.4,5.6),glow);membrane.position.set(ax,ay+2.9,az-7);portalGroup.add(membrane);portalMeshes.push(membrane);
    // The membrane is an interaction, not an invisible wall; capture only stone.
    membrane.userData.label=true;label(portalGroup,'지하미궁으로 귀환',ax,ay+7.5,az-7,.9);nav.addObject(portalGroup,'past-return-arch');
    const returnPortal={id:'past-return',label:'현재의 지하미궁으로 귀환',position:[ax,ay,az-5.6],radius:4.5};checkpoint('past-return','지하미궁 귀환문',returnPortal.position,'main');
    const destinations=[
      ['past-capital','하연성 역참',864,1205,'main'],['past-west','청수항 나루',-860,1108,'west'],
      ['past-north','회조성 기록탑',974,-322,'north'],['past-east','동부 군영 역참',2223,2900,'east'],
      ['past-harbor','수군 승선 나루',1048,330,'main']
    ];
    for(let i=0;i<destinations.length;i++){
      const [id,name,x,z,region]=destinations[i],position=safeSite(x,z,12);checkpoint(id,name,position,region);pad(id+'-pad',name,position);
      routeMarker(id+'-return','귀환의 뜰', [position[0]+(id==='past-harbor'?0:-4),position[1],position[2]-(id==='past-harbor'?4:2.5)], 'past-arrival');
      const side=i<3?-1:1,index=i<3?i:i-3;
      routeMarker('past-arrival-route-'+i,name,[ax+side*11,ay,az-7+index*7],id);
    }
    // The capital's existing safe platform is the palace approach. The full
    // kilometre-scale district streams across this ordinary gate; original
    // plots, terrain, buildings and the real time portal remain unchanged.
    const capital=checkpoints.find(c=>c.id==='past-capital'),[cx,cy,cz]=capital.position;
    const palaceGateRoot=new T.Group();palaceGateRoot.name='Hayeon_Baegwol_Palace_Gate';additions.add(palaceGateRoot);
    for(const side of [-1,1]){
      box(palaceGateRoot,'palace-gate-pier',cx+3+side*1.85,cy+2.65,cz-.3,.6,5.3,1.05,stone);
      box(palaceGateRoot,'palace-gate-brass-inlay',cx+3+side*1.85,cy+3.1,cz+.25,.16,3.7,.08,metal);
    }
    box(palaceGateRoot,'palace-gate-lintel',cx+3,cy+5.2,cz-.3,4.7,.6,1.3,stone);
    box(palaceGateRoot,'palace-gate-coping',cx+3,cy+5.65,cz-.3,5.1,.3,1.6,dark);
    label(palaceGateRoot,'백월 대왕성',cx+3,cy+6.4,cz+.3,.7);
    label(palaceGateRoot,'왕궁 입장 · E / F',cx+3,cy+4.45,cz+.3,.3);
    nav.addObject(palaceGateRoot,'past-citadel-approach');
    const citadelGate={id:'past-citadel-gate',kind:'citadel-entry',label:'하연성 왕궁 — 백월 대왕성',position:[cx+3,cy,cz+1.4],radius:2.5};
    checkpoint('past-citadel-gate','백월 대왕성 입구',[cx+3,cy,cz+3.6],'main');
    // Every authored command-ship cabin has a boarding stop, including isolated
    // northern and eastern ships. Deck points are derived from real triangles.
    const cabins=world.interiorIndex.filter(r=>r.shipCabin),harbor=checkpoints.find(c=>c.id==='past-harbor');
    for(let i=0;i<cabins.length;i++){
      const cabin=cabins[i],pos=cabin.position,entrance=world.kitCatalog.find(k=>'kit-'+k.id===cabin.assetId)?.detail?.entrance||[0,0,cabin.localBounds.max[2]+1];
      const matrix=new T.Matrix4().fromArray(cabin.pick.matrix);let landing=null;
      for(const delta of [2,3,4,5,7]){
        const p=new T.Vector3(entrance[0],entrance[1],entrance[2]+delta).applyMatrix4(matrix),gy=nav.groundAt(p.x,p.z,pos[1]+7,.6);
        if(gy!==null&&!nav.pointSolid(p.x,gy+.6,p.z,.4)&&!nav.pointSolid(p.x,gy+1.5,p.z,.4)){landing=[p.x,gy,p.z];break;}
      }
      if(!landing)continue;
      const id='past-ship-'+i,name=(cabin.region==='north'?'북쪽':'동해')+' 수군선 '+(i+1);checkpoint(id,name,landing,cabin.region);
      routeMarker(id+'-return','승선 나루로', [landing[0]+2,landing[1],landing[2]],'past-harbor');
      // A broad quay of adjacent signs gives access to all seven distinct ships.
      const side=i<4?-1:1,row=i%4;routeMarker('past-board-'+i,name,[harbor.position[0]+side*4.5,harbor.position[1],harbor.position[2]-3.5+row*2.2],id);
    }
    // The original watchtowers have ladders, not walkable stair ramps. Their
    // authored top boards are used as safe interact-to-climb destinations.
    let ladderStops=0;
    for(const ladder of nav.fixtures.ladders){
      if(ladder.scaleLimited)continue;
      const item=nav.instances.find(i=>i.id===ladder.instanceId),bottom=new T.Vector3(0,.12,5.1).applyMatrix4(item.matrix).toArray(),top=new T.Vector3(0,6.12,1.7).applyMatrix4(item.matrix).toArray();
      for(const p of [bottom,top]){const y=nav.groundAt(p[0],p[2],p[1],.08);if(y!==null)p[1]=y;}
      if([bottom,top].some(p=>nav.groundAt(p[0],p[2],p[1],.05)===null||!nav.bodyClear(p[0],p[1],p[2])))continue;
      const low=checkpoint(ladder.id+'-bottom','망루 사다리 아래',bottom,'main'),high=checkpoint(ladder.id+'-top','망루 감시 마루',top,'main');
      travelNodes.push({id:ladder.id+'-up',label:'망루 사다리 오르기',position:bottom,radius:2.1,targetCheckpoint:high.id,detail:'원래 사다리를 따라 감시 마루로 이동',kind:'ladder'});
      travelNodes.push({id:ladder.id+'-down',label:'망루 사다리 내려가기',position:top,radius:2.1,targetCheckpoint:low.id,detail:'사다리 아래 접근판으로 이동',kind:'ladder'});ladderStops++;
    }
    // Native equipment metadata only: the era adapter owns collection, saved
    // availability and the shared approved weapon meshes. Y is the floor, not
    // a floating model centre; all placements use existing walkable platforms.
    const weaponPickups=[];
    function placeWeapon(id,weaponId,label,checkpointId,dx,dz,sourceId){
      const anchor=checkpoints.find(cp=>cp.id===checkpointId),x=anchor.position[0]+dx,z=anchor.position[2]+dz;
      const y=nav.groundAt(x,z,anchor.position[1]+.03,.08);
      if(y===null||Math.abs(y-anchor.position[1])>.12||!nav.bodyClear(x,y+.025,z))throw Error('과거 무기 배치의 안전한 지면을 찾지 못했습니다: '+id);
      const position=[x,y,z];
      for(const action of [returnPortal,citadelGate,...travelNodes])if(Math.hypot(x-action.position[0],y-action.position[1],z-action.position[2])<(action.radius||3)+.2)throw Error('과거 무기 배치가 이동 표지와 겹칩니다: '+id);
      weaponPickups.push({id,weaponId,label,position,radius:2.4,checkpointId,...(sourceId?{sourceId}:{})});
    }
    // Preserve each original p01..p32 identity. New pickup IDs intentionally do
    // not inherit the consumed state of the earlier generic melee placements.
    function placeArmory(sourceId,label,checkpointId,dx,dz){placeWeapon('past-armory-'+sourceId,'past_'+sourceId,label,checkpointId,dx,dz,sourceId);}
    placeArmory('p01','환두 · 성루의 검','past-arrival',-4,4);
    placeArmory('p09','현월 굽이도','past-arrival',4,4);
    placeArmory('p21','적송 장궁','past-arrival',-7,1);
    placeArmory('p25','흑림 원방패','past-arrival',7,1);
    placeArmory('p03','쌍월 유엽도','past-capital',-4.2,3.4);
    placeArmory('p11','백호 장창','past-capital',-.8,3.4);
    placeArmory('p23','성채 목노','past-capital',0,-3.8);
    placeArmory('p29','흑송 화승총','past-capital',3,-3.8);
    placeArmory('p02','흑송 환도','past-west',-3,3);
    placeArmory('p08','흑연 쌍구검','past-west',3,3);
    placeArmory('p22','흑각 반궁','past-west',0,-3.2);
    placeArmory('p32','적동 단화승총','past-west',3,-3.2);
    placeArmory('p04','철조 파수대검','past-north',-3,3);
    placeArmory('p15','흑조 협도','past-north',3,3);
    placeArmory('p17','산성 파문도끼','past-north',0,-3.2);
    placeArmory('p19','운문 유성추','past-north',3,-3.2);
    placeArmory('p05','적사 장도','past-east',-3,3);
    placeArmory('p12','청월 언월도','past-east',3,3);
    placeArmory('p20','뇌문 전투망치','past-east',0,-3.2);
    placeArmory('p31','성문 대형화승총','past-east',3,-3.2);
    placeArmory('p14','해문 삼첨차','past-harbor',0,1);
    placeArmory('p28','월영 사슬낫','past-harbor',0,4);
    const ambient=new T.HemisphereLight(0xf7eaca,0x536a57,2.2);ambient.name='Past_Sky_Light';root.add(ambient);
    const sun=new T.DirectionalLight(0xfff1ce,2.1);sun.position.set(ax-180,ay+320,az-150);sun.target.position.set(ax,ay,az);root.add(sun,sun.target);
    // Distance culling measures each real bounding box, never the object's origin.
    root.updateMatrixWorld(true);const renderMeshes=[];
    root.traverse(o=>{if(o.isMesh&&o!==membrane){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();if(o.isInstancedMesh)o.computeBoundingBox();const bounds=(o.isInstancedMesh?o.boundingBox:o.geometry.boundingBox).clone().applyMatrix4(o.matrixWorld);renderMeshes.push({mesh:o,bounds,triangles:(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1),wasVisible:o.visible});}});
    const bounds={minX:-2200,maxX:5300,minZ:-900,maxZ:3500,minY:-30,maxY:340};
    for(const cp of checkpoints){const floor=nav.groundAt(cp.position[0],cp.position[2],cp.position[1],.02);if(floor===null||Math.abs(floor-cp.position[1])>.08||nav.pointSolid(cp.position[0],cp.position[1]+.55,cp.position[2],.25)||nav.pointSolid(cp.position[0],cp.position[1]+1.5,cp.position[2],.25))throw Error('과거 세계 안전 거점 검사 실패: '+cp.id);}
    const pois=world.pois.map(p=>({id:p.id,label:p.name,position:[p.x,p.y,p.z],kind:p.region,detail:p.story}));
    pois.push({...citadelGate,detail:'사라진 대피 명령 · 왕실 기록관과 네 곳의 기록 조사'});
    const pairs=points=>points.map(p=>[p.x??p[0],p.z??p[1]]);
    const mapData={shorelines:world.terrain.shorelines.map(s=>({region:s.region,closed:s.closed,points:pairs(s.points)})),roads:world.routes.map(r=>({width:r.width,points:pairs(r.points)}))};
    const stats={...world.stats,originalPlots:world.mapping.length,buildings:world.interiorIndex.length,navigation:nav.stats,travelNodes:travelNodes.length,shipStops:checkpoints.filter(c=>c.id.startsWith('past-ship-')).length,ladderStops,numericRoundTrip:manifest?.numericRoundTrip||null,visibleMeshes:0,visibleTriangles:0,culling:'actual-world-AABB-distance; architecture batched in 96m cells'};
    const inspectionRoot=new T.Group();inspectionRoot.name='Past_Selected_Interior';inspectionRoot.position.set(0,600,0);inspectionRoot.visible=false;root.add(inspectionRoot);
    const inspectable=new Map(world.interiorIndex.map(r=>[r.id,r]));
    const inspectionInstances=new Map(nav.instances.filter(i=>inspectable.has(i.id)).map(i=>[i.id,i]));
    let inspection=null,inspectionPanel=null,inspectionView=null;const inspectionMaterials=new Set();
    function interactionAt(position){
      if(inspection)return {kind:'inspect',id:inspection.id,label:'실내 보기 닫기',position:position.slice?position.slice():[position.x,position.y,position.z],radius:1};
      const x=Array.isArray(position)?position[0]:position.x,y=Array.isArray(position)?position[1]:position.y,z=Array.isArray(position)?position[2]:position.z;let best=null;
      for(const fixture of nav.fixtures.entrances){const item=inspectionInstances.get(fixture.id),bounds=item.bounds,dx=Math.max(bounds.min.x-x,0,x-bounds.max.x),dz=Math.max(bounds.min.z-z,0,z-bounds.max.z),distance=Math.hypot(dx,dz);if(distance>5||y<bounds.min.y-3||y>bounds.max.y+3)continue;if(!best||distance<best.distance)best={kind:'inspect',id:fixture.id,label:inspectable.get(fixture.id).name+' · 실내 보기',position:fixture.position.slice(),radius:5,distance};}
      return best;
    }
    function clearInspectionGeometry(){inspectionRoot.traverse(o=>{if(o.isMesh)o.geometry.dispose();if(o.isInstancedMesh)o.dispose();});inspectionRoot.clear();inspectionMaterials.forEach(m=>m.dispose());inspectionMaterials.clear();}
    function closeInspection(){clearInspectionGeometry();inspection=null;inspectionView=null;inspectionRoot.visible=false;if(inspectionPanel){inspectionPanel.remove();inspectionPanel=null;}}
    function setInspection(id,floorIndex=0){
      if(!id){closeInspection();return true;}
      const record=inspectable.get(id),item=inspectionInstances.get(id),source=item?.template.viewRoot,detail=item?.template.detail;if(!record||!source||!detail)return false;
      clearInspectionGeometry();const floors=detail.floors?.length?detail.floors:[{id:'all',name:'전체 구조',y:item.template.bounds.min.y,top:item.template.bounds.max.y}];
      floorIndex=((floorIndex%floors.length)+floors.length)%floors.length;const floor=floors[floorIndex],level=Number.isFinite(floor.y)?floor.y:item.template.bounds.min.y,top=Number.isFinite(floor.top)?floor.top:level+4;
      const view=source.clone(true);view.position.set(0,0,0);view.rotation.set(0,0,0);view.scale.set(1,1,1);view.updateMatrixWorld(true);
      // Authored landmark floors and stair treads are InstancedMesh batches.
      // Expand only this one inspection clone so floor slicing uses every
      // instance's real transform, while the live world's batches stay intact.
      const instanceGroups=[];view.traverse(o=>{if(o.isInstancedMesh)instanceGroups.push(o);});
      const tintMaterials=new Map();
      for(const original of instanceGroups){
        const replacement=new T.Group();replacement.name=original.name;replacement.position.copy(original.position);replacement.quaternion.copy(original.quaternion);replacement.scale.copy(original.scale);replacement.userData={...original.userData};
        for(let i=0;i<original.count;i++){
          let material=original.material;if(original.instanceColor&&!Array.isArray(material)){const color=new T.Color();original.getColorAt(i,color);const key=material.uuid+'|'+color.getHexString();if(!tintMaterials.has(key)){const tinted=material.clone();tinted.color.multiply(color);tintMaterials.set(key,tinted);inspectionMaterials.add(tinted);}material=tintMaterials.get(key);}
          const mesh=new T.Mesh(original.geometry,material),matrix=new T.Matrix4();original.getMatrixAt(i,matrix);matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);replacement.add(mesh);
        }
        original.parent.add(replacement);original.removeFromParent();original.dispose();
      }
      view.updateMatrixWorld(true);
      // Slice each real mesh by authored floor heights. Geometry is copied only
      // for the inspected model; the live map and its collisions never change.
      const vector=new T.Vector3(),owned=[];
      view.traverse(o=>{
        if(!o.isMesh)return;let roof=false;for(let p=o;p&&p!==view;p=p.parent)if(p.userData.cutaway&&(p.userData.cutawayRole||p.userData.role||'roof')==='roof')roof=true;
        const original=o.geometry,g=original.clone(),pos=original.attributes.position,old=original.index,indices=[];
        for(let n=0;n<(old?old.count:pos.count);n+=3){
          const ids=[old?old.getX(n):n,old?old.getX(n+1):n+1,old?old.getX(n+2):n+2];let min=Infinity,max=-Infinity;
          for(const index of ids){vector.fromBufferAttribute(pos,index).applyMatrix4(o.matrixWorld);min=Math.min(min,vector.y);max=Math.max(max,vector.y);}
          if(!roof&&min<top-.04&&max>=level-.26)indices.push(...ids);
        }
        g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();o.geometry=g;o.visible=indices.length>0;o.castShadow=false;owned.push(g);
      });
      inspectionRoot.add(view);inspectionRoot.visible=true;
      const bb=item.template.bounds,size=bb.getSize(new T.Vector3()),center=bb.getCenter(new T.Vector3()),distance=Math.max(11,size.x,size.z)*.95;
      const target=new T.Vector3(center.x,600+level+Math.min(1.1,(top-level)*.28),center.z),eye=target.clone().add(new T.Vector3(distance*.65,distance*1.08,distance*.85)),dir=target.clone().sub(eye).normalize();
      inspectionView={x:eye.x,y:eye.y,z:eye.z,dx:dir.x,dy:dir.y,dz:dir.z,scope:false};inspection={id,label:record.name,floorIndex,floor:floor.name||floor.id,rooms:(detail.rooms||[]).filter(r=>r.floor===floor.id).map(r=>r.name),originalScale:record.scale.slice()};
      if(inspectionPanel)inspectionPanel.remove();
      inspectionPanel=document.createElement('div');inspectionPanel.id='hanq-past-inspection';inspectionPanel.style.cssText='position:fixed;z-index:140;left:50%;bottom:90px;transform:translateX(-50%);max-width:620px;width:calc(100% - 40px);padding:16px 18px;border:1px solid #b79b5c;border-radius:12px;background:rgba(22,34,30,.95);color:#f5e5b9;font-family:system-ui,sans-serif;box-shadow:0 8px 32px #0009;pointer-events:auto';
      const title=document.createElement('div');title.textContent=record.name;title.style.cssText='font-weight:700;font-size:17px;margin-bottom:5px';inspectionPanel.appendChild(title);
      const subtitle=document.createElement('div');subtitle.textContent=(floor.name||floor.id)+' · '+(floorIndex+1)+' / '+floors.length+'층';subtitle.style.cssText='color:#81d9c6;margin-bottom:6px';inspectionPanel.appendChild(subtitle);
      const rooms=document.createElement('div');rooms.textContent=inspection.rooms.join(' · ')||'바닥·벽·문·계단의 실제 구조';rooms.style.cssText='font-size:12px;line-height:1.6;color:#d6d4bd;margin-bottom:10px';inspectionPanel.appendChild(rooms);
      const controls=document.createElement('div');controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap';inspectionPanel.appendChild(controls);
      function button(text,action){const b=document.createElement('button');b.textContent=text;b.type='button';b.style.cssText='border:1px solid #7c8d71;border-radius:7px;background:#2b453e;color:#fff0ca;padding:9px 14px;cursor:pointer;font:inherit';b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();action();});controls.appendChild(b);}
      if(floors.length>1){button('이전 층',()=>setInspection(id,floorIndex-1));button('다음 층',()=>setInspection(id,floorIndex+1));}
      button('닫기 · E / 이동',closeInspection);for(const event of ['pointerdown','pointerup','mousedown','touchstart'])inspectionPanel.addEventListener(event,e=>e.stopPropagation());(uiRoot||document.body).appendChild(inspectionPanel);
      return true;
    }
    let disposed=false,lastCullX=Infinity,lastCullZ=Infinity,lastQuality='';
    function update(time,dt,context={}){
      if(disposed)return;const p=context.position||arrival.position,x=Array.isArray(p)?p[0]:p.x,z=Array.isArray(p)?p[2]:p.z;
      glow.opacity=.5+.12*Math.sin((Number(time)||0)*1.7);
      const quality=context.quality||'low',distance=quality==='high'?850:quality==='medium'?550:350;
      if(quality===lastQuality&&Math.hypot(x-lastCullX,z-lastCullZ)<16)return;lastCullX=x;lastCullZ=z;lastQuality=quality;
      let meshes=0,triangles=0;
      for(const row of renderMeshes){const b=row.bounds,dx=Math.max(b.min.x-x,0,x-b.max.x),dz=Math.max(b.min.z-z,0,z-b.max.z);const near=dx*dx+dz*dz<distance*distance;row.mesh.visible=row.wasVisible&&near;if(row.mesh.visible){meshes++;triangles+=row.triangles;}}
      stats.visibleMeshes=meshes;stats.visibleTriangles=triangles;stats.cullDistance=distance;
    }
    function dispose(){
      if(disposed)return;disposed=true;closeInspection();root.removeFromParent();const geometries=new Set(),materials=new Set(),textures=new Set(),instanced=new Set();
      function resources(o){if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)instanced.add(o);for(const mat of(Array.isArray(o.material)?o.material:o.material?[o.material]:[])){materials.add(mat);for(const value of Object.values(mat))if(value?.isTexture)textures.add(value);}}
      root.traverse(resources);for(const template of nav.templates.values())template.viewRoot?.traverse(resources);
      instanced.forEach(o=>o.dispose());
      textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.clear();renderMeshes.length=0;nav.dispose();
    }
    update(0,0,{position:arrival.position});if(scene)scene.add(root);progress(onProgress,1,'하연으로 이어진 시간이 열렸습니다');
    return {root,nav,arrival,returnPortal,citadelGate,checkpoints,travelNodes,weaponPickups,bounds,pois,mapData,sourceWorld:world,stats,update,dispose,interactionAt,setInspection,inspectionCamera:()=>inspectionView,get inspection(){return inspection;},get disposed(){return disposed;}};
  }
  global.HanQPastWorld={version:VERSION,load:async function(options={}){
    if(!options.THREE)throw Error('기존 게임의 THREE가 필요합니다.');
    progress(options.onProgress,.02,'과거 세계를 여는 중');if(!options.modulesReady)await ready();
    const loaded=options.data?{data:options.data,manifest:null}:await loadData(options.onProgress);
    progress(options.onProgress,.72,'209개 원본 필지의 건물과 실내를 연결하는 중');await new Promise(resolve=>setTimeout(resolve,0));
    return makeWorld(options.THREE,loaded.data,options.scene,loaded.manifest,options.onProgress,options.uiRoot);
  }};
})(window);
