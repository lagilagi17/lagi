/* HanQ — 흑철 심연 native-game adapter. Same actor, controls, inventory and save codec.
 * Dungeon local X/Y(up)/Z -> native x=2965-X, y=2875-Z, h=158.584+Y.
 * Hayeon's past uses its original world XYZ: native x=X, y=Z, h=Y.
 * Only the entrance doorway changes scene; every underground level is walked.
 */
(function (host) {
  'use strict';
  const VERSION = 3;
  const ENTRANCE_RANGE = 280;
  const ENTRY = Object.freeze({x:2965,y:2927,h:158.584});
  const ORIGIN = Object.freeze({x:2965,y:158.584,z:2875});
  const EXIT = Object.freeze({x:2965,y:2922,h:158.584});
  const PORTAL = Object.freeze([0,-610.2,-31]);
  const BANDS = [
    {id:'entrance',label:'봉쇄갱 진입로',y:0},
    {id:'industry',label:'B1 · 동력 설비층',y:-90},
    {id:'city',label:'B2 · 잔향구 지하 도시',y:-220},
    {id:'mines',label:'B3 · 심층 채굴장',y:-350},
    {id:'ruins',label:'B4 · 발굴 성역',y:-480},
    {id:'gate',label:'B5 · 시간의 문',y:-620}
  ];
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const finite3 = a => Array.isArray(a) && a.length===3 && a.every(Number.isFinite);
  const validPosition = a => finite3(a) && Math.abs(a[0])<235 && Math.abs(a[2])<245 && a[1]>=-665 && a[1]<=3;
  const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  function create(options) {
    const getState=options.getState, getThree=options.getThree;
    const getT=()=>options.getTHREE?.() || options.THREE;
    const api=()=>options.getApi?.();
    const player=()=>getState()?.ents?.[0];
    const say=(message,color='#d8c79c')=>options.say?.(message,color);
    let model=null, pastModel=null, citadelModel=null, entrance=null, navState=null, active=false, disposed=false;
    let era='present', area='hayeon', loadingArea='hayeon', checkpoint='entrance', savedPosition=[0,0,-52];
    let loading=false, loadProgress=0, loadError=null, loadToken=0, loadPromise=null, pendingPastRestore=null;
    let frame=0, stepped=-1, jumpPending=false, lastNearby=0, visualTime=0;
    let restoreFrame=null, discovered=false, visited=new Set(), rescueAt=0;
    let renderStyle=null,renderStyleT=null;
    let weaponPickups={hayeon:{},citadel:{}};
    const pickupWorlds=new Map();
    const legacyPastWeaponIds=new Set(['dagger','arming_sword','longsword','katana','machete','war_hammer']);
    const pastWeaponIds=new Set([...legacyPastWeaponIds,...Object.keys(host.HanQPastArsenal?.nativeWeaponDefinitions||{})]);
    const train={progress:0,direction:1,target:0,station:0,speed:0,dwell:0,riding:false,calling:false};
    let ridingId=null,mountRecords=[];
    const SURFACE_REGION='hollow:present',SURFACE_PREFIX=SURFACE_REGION+':';
    // Authored IDs are independent of navigation's serial IDs. Keep this
    // bounded codec usable before the lazy world model has been constructed.
    const STRUCTURAL_SURFACE_IDS=new Set(['structure-winding-house',
      ...[0,1,2].flatMap(i=>['left','right','back'].map(side=>'structure-mine-bunker-'+i+'-'+side)),
      ...Array.from({length:10},(_,i)=>'structure-ruin-wall-'+i)]);
    const SURFACE_SAVE_RECORD_LIMIT=47,SURFACE_SAVE_CUT_LIMIT=376;
    let surfaceRuntime=null,surfaceModel=null,surfaceRestorePending=false,impactRayMesh=null,impactRaycaster=null;
    const surfaceSpecs=new Map(),surfaceOwners=new Map(),surfaceDamage=new Map();
    let configuredSurfaceOwners=new WeakSet();

    function surfaceActive(){return !disposed&&inside()&&era==='present'&&!!model;}
    function nativeSurfacePoint(x,y,z){return{x:ORIGIN.x-x,y:ORIGIN.y+y,z:ORIGIN.z-z};}
    function surfaceKey(block){const id=typeof block==='string'?block:block?.hollowSurfaceId||block?.id;return typeof id==='string'?(id.startsWith(SURFACE_PREFIX)?id:SURFACE_PREFIX+id):null;}
    function surfaceRuntimeFor(create=false){
      if(!create)return surfaceRuntime;
      const next=options.getSurfaceDestruction?.();if(!next)return null;
      if(next!==surfaceRuntime){surfaceRuntime=next;surfaceOwners.clear();configuredSurfaceOwners=new WeakSet();surfaceRestorePending=surfaceDamage.size>0;}
      return next;
    }
    function rememberSurface(owner){
      if(!owner?.cuts.length){if(owner)surfaceDamage.delete(owner.id);return;}
      surfaceDamage.set(owner.id,{id:owner.id,cuts:owner.cuts.map(c=>({min:c.min.toArray(),max:c.max.toArray()}))});
    }
    function readSurfaceDamage(records){
      surfaceDamage.clear();let cuts=0;
      if(Array.isArray(records))for(const record of records.slice(0,SURFACE_SAVE_RECORD_LIMIT)){
        if(typeof record?.id!=='string'||record.id.length>128)continue;
        const known=/^hollow:present:building-[0-9.e+\-]+-[0-9.e+\-]+$/.test(record.id)||
          record.id.startsWith(SURFACE_PREFIX)&&STRUCTURAL_SURFACE_IDS.has(record.id.slice(SURFACE_PREFIX.length));
        if(!known||surfaceDamage.has(record.id)||!Array.isArray(record.cuts)||!record.cuts.length||record.cuts.length>8)continue;
        if(record.cuts.some(c=>!finite3(c?.min)||!finite3(c?.max)||c.min.some((v,i)=>c.max[i]<=v||c.max[i]-v>4.25)))continue;
        if(cuts+record.cuts.length>SURFACE_SAVE_CUT_LIMIT)break;cuts+=record.cuts.length;
        surfaceDamage.set(record.id,{id:record.id,cuts:record.cuts.map(c=>({min:c.min.slice(),max:c.max.slice()}))});
      }
      surfaceRestorePending=surfaceDamage.size>0;
    }
    function serializeSurfaceDamage(){return [...surfaceDamage.values()].map(record=>({id:record.id,cuts:record.cuts.map(c=>({min:c.min.slice(),max:c.max.slice()}))}));}
    function surfacePlanes(center,yaw,half){
      const co=Math.cos(yaw),si=Math.sin(yaw),planes=[];
      for(const [normal,extent]of[[{x:co,y:0,z:-si},half[0]],[{x:0,y:1,z:0},half[1]],[{x:si,y:0,z:co},half[2]]]){
        const d=normal.x*center.x+normal.y*center.y+normal.z*center.z;
        planes.push({normal,constant:d+extent+.002},{normal:{x:-normal.x,y:-normal.y,z:-normal.z},constant:-d+extent+.002});
      }return planes;
    }
    function getSurfaceOwner(block,create=false){
      const spec=surfaceSpecs.get(surfaceKey(block));if(!spec)return null;
      const shared=surfaceRuntimeFor(create);if(!shared)return null;
      let owner=shared.getOwner(spec.id);
      if(owner&&!configuredSurfaceOwners.has(owner)){
        if(owner.region!==SURFACE_REGION||['min','max'].some(side=>['x','y','z'].some(axis=>Math.abs(owner.bounds[side][axis]-spec.bounds[side][axis])>.005)))return null;
        if(!shared.setProtectedHeightBands?.(owner,spec.protectedHeightBands)||!shared.setVisualClipPlanes?.(owner,spec.visualClipPlanes)||shared.setSolidClipPlanes&&!shared.setSolidClipPlanes(owner,spec.solidClipPlanes))return null;
        configuredSurfaceOwners.add(owner);
      }
      if(!owner&&create){owner=shared.register({...spec,visible:surfaceActive()});if(owner)configuredSurfaceOwners.add(owner);}
      if(owner)surfaceOwners.set(owner.id,owner);
      return owner;
    }
    function surfaceHitBounds(block){return surfaceSpecs.get(surfaceKey(block))?.bounds||null;}
    function overlapsSurfaceBounds(a,b){return a.max.x>=b.min.x&&a.min.x<=b.max.x&&a.max.y>=b.min.y&&a.min.y<=b.max.y&&a.max.z>=b.min.z&&a.min.z<=b.max.z;}
    function bindSurfaceOwner(owner,spec,cuts){
      const refs=spec.refs.filter(ref=>cuts.some(cut=>overlapsSurfaceBounds(ref.bounds,cut)));
      return !!refs.length&&surfaceRuntime.bindVisuals(owner,refs)&&!owner.visualUnsupported&&!!owner.visuals.size;
    }
    function releaseEmptySurface(owner){if(owner&&!owner.cuts.length){surfaceRuntime?.unregisterEmpty?.(owner);surfaceOwners.delete(owner.id);}}
    function restoreSurfaceDamage(){
      if(!surfaceRestorePending||!surfaceModel||!surfaceDamage.size)return;
      const shared=surfaceRuntimeFor(true);if(!shared)return;surfaceRestorePending=false;
      const apply=()=>{for(const record of [...surfaceDamage.values()]){
        const spec=surfaceSpecs.get(record.id);if(!spec){surfaceDamage.delete(record.id);continue;}
        const cuts=record.cuts.map(c=>({min:{x:c.min[0],y:c.min[1],z:c.min[2]},max:{x:c.max[0],y:c.max[1],z:c.max[2]}}));
        if(!cuts.every(c=>overlapsSurfaceBounds(c,spec.bounds))){surfaceDamage.delete(record.id);continue;}
        const owner=getSurfaceOwner(record.id,true);if(!owner)continue;
        if(!bindSurfaceOwner(owner,spec,cuts)||!shared.restoreCuts(owner,record.cuts)){releaseEmptySurface(owner);continue;}
        rememberSurface(owner);if(!owner.cuts.length)releaseEmptySurface(owner);
      }};
      if(shared.batch)shared.batch(apply);else apply();
    }
    function surfaceBodyBlocked(block,x,y,z,radius,height){
      const owner=getSurfaceOwner(block);if(!owner?.cuts.length)return undefined;
      const p=nativeSurfacePoint(x,y,z),r=Math.max(1e-6,radius),bounds=owner.bounds;
      return surfaceRuntime.bodyBlocked(owner,{min:{x:Math.max(bounds.min.x,p.x-r),y:Math.max(bounds.min.y,p.y+.025),z:Math.max(bounds.min.z,p.z-r)},
        max:{x:Math.min(bounds.max.x,p.x+r),y:Math.min(bounds.max.y,p.y+height-.015),z:Math.min(bounds.max.z,p.z+r)}});
    }
    function surfacePointSolid(block,x,y,z,radius){
      const owner=getSurfaceOwner(block);if(!owner?.cuts.length)return true;
      const p=nativeSurfacePoint(x,y,z);
      if(!(radius>0))return surfaceRuntime.isPointSolid(owner,p);
      const b=owner.bounds,probe={min:{x:Math.max(b.min.x,p.x-radius),y:Math.max(b.min.y,p.y-radius),z:Math.max(b.min.z,p.z-radius)},
        max:{x:Math.min(b.max.x,p.x+radius),y:Math.min(b.max.y,p.y+radius),z:Math.min(b.max.z,p.z+radius)}};
      // The native sphere test includes tangency. A zero-volume clipped box
      // cannot represent that contact in the strict body-volume query below.
      if(probe.max.x-probe.min.x<=1e-7||probe.max.y-probe.min.y<=1e-7||probe.max.z-probe.min.z<=1e-7){
        const dx=x-block.x,dz=z-block.z,lx=clamp(block.c*dx-block.s*dz,-block.hx,block.hx),lz=clamp(block.s*dx+block.c*dz,-block.hz,block.hz);
        const contact=nativeSurfacePoint(block.x+block.c*lx+block.s*lz,clamp(y,block.minY,block.maxY),block.z-block.s*lx+block.c*lz);
        contact.x=clamp(contact.x,b.min.x,b.max.x);contact.y=clamp(contact.y,b.min.y,b.max.y);contact.z=clamp(contact.z,b.min.z,b.max.z);
        return surfaceRuntime.isPointSolid(owner,contact);
      }
      return surfaceRuntime.bodyBlocked(owner,probe);
    }
    function surfaceCameraHit(block,from,to,radius,enter,exit){
      const owner=getSurfaceOwner(block);if(!owner?.cuts.length)return undefined;
      const a=nativeSurfacePoint(from.x,from.y,from.z),b=nativeSurfacePoint(to.x,to.y,to.z),intervals=[];
      for(const cut of owner.cuts){let lo=enter,hi=exit,valid=true;
        for(const axis of ['x','y','z']){
          const min=cut.min[axis]+radius,max=cut.max[axis]-radius,delta=b[axis]-a[axis];if(max<min){valid=false;break;}
          if(Math.abs(delta)<1e-10){if(a[axis]<min||a[axis]>max){valid=false;break;}}
          else {let x=(min-a[axis])/delta,y=(max-a[axis])/delta;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi){valid=false;break;}}
        }if(valid)intervals.push([lo,hi]);
      }
      intervals.sort((a,b)=>a[0]-b[0]);let cursor=enter;
      for(const [lo,hi]of intervals){if(lo>cursor+1e-8)break;if(hi>=cursor)cursor=hi+1e-8;if(cursor>exit-1e-8)return null;}
      return Math.min(exit,cursor);
    }
    function prepareSurfaceModel(world){
      if(surfaceModel!==world){
        surfaceModel=world;surfaceSpecs.clear();world.root.updateMatrixWorld(true);const T=getT();
        for(const d of [...(world.buildingSurfaces||[]),...(world.structuralSurfaces||[])]){
          const id=SURFACE_PREFIX+d.id,center=nativeSurfacePoint(...d.center),yaw=(d.yaw||0)+Math.PI,co=Math.cos(yaw),si=Math.sin(yaw);
          const half=d.collisionSize.map(n=>n/2),ex=Math.abs(co)*half[0]+Math.abs(si)*half[2],ez=Math.abs(si)*half[0]+Math.abs(co)*half[2];
          const protectedHeightBands=d.protectedBands.map(b=>({min:ORIGIN.y+b.min-.015,max:ORIGIN.y+b.max+.015}));
          const intervals=[];let low=center.y-half[1];for(const band of protectedHeightBands){if(band.min>low)intervals.push([low,Math.min(band.min,center.y+half[1])]);low=Math.max(low,band.max);}if(low<center.y+half[1])intervals.push([low,center.y+half[1]]);
          const refs=[];for(const ref of d.refs||[]){const mesh=ref.mesh,index=ref.index??ref.instanceId;if(!mesh?.geometry||!Number.isInteger(index)||!ref.matrix)continue;
            if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
            const matrix=ref.matrix.clone(),worldMatrix=new T.Matrix4().multiplyMatrices(mesh.matrixWorld,matrix),bounds=mesh.geometry.boundingBox.clone().applyMatrix4(worldMatrix);
            refs.push({mesh,index,matrix,worldMatrix,bounds});
          }
          surfaceSpecs.set(id,{id,region:SURFACE_REGION,kind:'wall',solidVolume:true,center,yaw,source:d,refs,intervals,
            bounds:{min:{x:center.x-ex,y:center.y-half[1],z:center.z-ez},max:{x:center.x+ex,y:center.y+half[1],z:center.z+ez}},
            protectedHeightBands,visualClipPlanes:surfacePlanes(center,yaw,d.visualHalfExtents),solidClipPlanes:surfacePlanes(center,yaw,d.size.map(n=>n/2))});
        }
        world.nav.setSurfacePolicy?.({pointSolid:surfacePointSolid,bodyBlocked:surfaceBodyBlocked,cameraHit:surfaceCameraHit});
        surfaceRestorePending=surfaceDamage.size>0;
      }
      if(surfaceRuntime&&options.getSurfaceDestruction)surfaceRuntimeFor(true);
      restoreSurfaceDamage();
    }
    function setSurfaceVisible(visible){
      const shared=surfaceRuntime;if(!shared)return;const shown=!!visible&&surfaceActive();
      for(const [id,owner]of surfaceOwners){if(owner.retired||shared.getOwner(id)!==owner){surfaceOwners.delete(id);continue;}shared.setOwnerVisible?.(owner,shown);}
      shared.syncVisuals?.();
    }
    function surfaceGroup(){return surfaceRuntime?.group||null;}
    function unbindSurfaceModel(){
      const shared=surfaceRuntime;surfaceModel?.nav.setSurfacePolicy?.(null);
      if(shared){const apply=()=>{for(const owner of surfaceOwners.values()){shared.unbindVisuals(owner);shared.setOwnerVisible?.(owner,false);}};if(shared.batch)shared.batch(apply);else apply();}
      surfaceOwners.clear();surfaceSpecs.clear();surfaceModel=null;surfaceRestorePending=surfaceDamage.size>0;
    }
    function closestSurfaceWall(spec,point){
      const co=Math.cos(spec.yaw),si=Math.sin(spec.yaw),dx=point.x-spec.center.x,dz=point.z-spec.center.z,x=co*dx-si*dz,z=si*dx+co*dz;
      const hx=spec.source.size[0]/2,hz=spec.source.size[2]/2;let best=null;
      for(const [low,high]of spec.intervals){if(!(high>low))continue;const y=clamp(point.y,low,high);
        for(const [lx,lz]of[[-hx,clamp(z,-hz,hz)],[hx,clamp(z,-hz,hz)],[clamp(x,-hx,hx),-hz],[clamp(x,-hx,hx),hz]]){
          const p={x:spec.center.x+co*lx+si*lz,y,z:spec.center.z-si*lx+co*lz},distance=Math.hypot(p.x-point.x,p.y-point.y,p.z-point.z);
          if(!best||distance<best.distance)best={point:p,distance};
        }
      }return best;
    }
    function surfaceExposed(spec,point,closest){
      const length=Math.hypot(closest.x-point.x,closest.y-point.y,closest.z-point.z);if(length<.025)return true;
      const steps=Math.max(1,Math.ceil((length-.015)/.06));
      for(let i=0;i<=steps;i++){const f=(length-.015)*i/steps/length,x=point.x+(closest.x-point.x)*f,y=point.y+(closest.y-point.y)*f,z=point.z+(closest.z-point.z)*f;
        const hit=model.nav.pointSolid(ORIGIN.x-x,y-ORIGIN.y,ORIGIN.z-z,0);if(!hit)continue;
        if(surfaceKey(hit)!==spec.id||spec.protectedHeightBands.some(b=>y>=b.min&&y<=b.max))return false;
      }return true;
    }
    function damageSurfaces(point,radius=6,amount=100){
      const report={changed:false,broken:0,walls:0,floors:0,refused:0,ids:[]};
      if(!surfaceActive()||!point||![point.x,point.y,point.z,radius,amount].every(Number.isFinite)||radius<=0||amount<=0||!volume(point.x,point.z,point.y))return report;
      const r=clamp(radius*.31,1.05,2.1),candidates=[];
      for(const spec of surfaceSpecs.values()){const nearest=closestSurfaceWall(spec,point);if(nearest&&nearest.distance<=r&&surfaceExposed(spec,point,nearest.point))candidates.push({spec,distance:nearest.distance});}
      if(!candidates.length)return report;const shared=surfaceRuntimeFor(true);if(!shared)return report;
      restoreSurfaceDamage();candidates.sort((a,b)=>a.distance-b.distance);
      const cut={min:{x:point.x-r,y:point.y-r,z:point.z-r},max:{x:point.x+r,y:point.y+r,z:point.z+r}};
      const apply=()=>{for(const {spec}of candidates.slice(0,8)){
        const owner=getSurfaceOwner(spec.id,true);if(!owner){report.refused++;continue;}
        if(!bindSurfaceOwner(owner,spec,[cut])){releaseEmptySurface(owner);report.refused++;continue;}
        const hit=shared.damage(owner,point,r,null,{local:true});
        if(hit.changed){rememberSurface(owner);shared.setOwnerVisible?.(owner,true);report.changed=true;report.broken++;report.walls++;report.ids.push(owner.id);}
        else releaseEmptySurface(owner);
      }};
      if(shared.batch)shared.batch(apply);else apply();return report;
    }
    function projectSurfaceImpact(block,point,direction){
      const spec=surfaceSpecs.get(surfaceKey(block)),T=getT();if(!spec||!T||!point||!direction)return null;
      const length=Math.hypot(direction.x,direction.y,direction.z);if(!Number.isFinite(length)||length<1e-8)return null;
      if(!spec.refs.length)return null;
      if(!impactRayMesh){impactRayMesh=new T.Mesh(spec.refs[0].mesh.geometry,spec.refs[0].mesh.material);impactRayMesh.matrixAutoUpdate=false;impactRaycaster=new T.Raycaster();}
      const dir=new T.Vector3(direction.x/length,direction.y/length,direction.z/length),origin=new T.Vector3(point.x,point.y,point.z).addScaledVector(dir,-1);
      impactRaycaster.set(origin,dir);impactRaycaster.near=0;impactRaycaster.far=2.3;const owner=getSurfaceOwner(block),hits=[];
      for(const ref of spec.refs){
        if(!impactRaycaster.ray.intersectsBox(ref.bounds))continue;
        const target=owner&&[...owner.visuals].find(target=>target.mesh===ref.mesh&&target.index===ref.index);
        if(target?.proxy){target.proxy.updateWorldMatrix(true,false);target.proxy.raycast(impactRaycaster,hits);}
        else {impactRayMesh.geometry=ref.mesh.geometry;impactRayMesh.material=ref.mesh.material;impactRayMesh.matrixWorld.copy(ref.worldMatrix);const start=hits.length;impactRayMesh.raycast(impactRaycaster,hits);for(let i=start;i<hits.length;i++)hits[i].surfaceMatrix=ref.worldMatrix;}
      }
      if(owner?.cap)owner.cap.raycast(impactRaycaster,hits);hits.sort((a,b)=>a.distance-b.distance);const hit=hits[0];if(!hit?.face)return null;
      const normal=hit.face.normal.clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(hit.surfaceMatrix||hit.object.matrixWorld)).normalize();
      return{point:{x:hit.point.x,y:hit.point.y,z:hit.point.z},normal:{x:normal.x,y:normal.y,z:normal.z},surfaceOwner:owner,surfaceHost:owner?surfaceRuntime.surfaceToken(owner):null,surfaceObject:block};
    }

    function inside(e=player()) { return !!(active && e && e===player() && e.hollow); }
    function pastWorld() { return area==='citadel'?citadelModel:pastModel; }
    function currentModel() { return era==='past'?pastWorld():model; }
    const mounted=()=>player()?.alive&&era==='past'&&area==='citadel'?pastWorld()?.mounts?.find(m=>m.id===ridingId)||null:null;
    function mountState(){
      if(citadelModel&&!citadelModel.disposed&&era==='past'&&area==='citadel'&&!loading&&!pendingPastRestore)mountRecords=citadelModel.saveMounts?.()||mountRecords;
      return {ridingId:player()?.alive?ridingId:null,horses:mountRecords.map(m=>({id:m.id,position:m.position.slice(),yaw:m.yaw}))};
    }
    function restoreMountState(saved){
      ridingId=typeof saved?.ridingId==='string'&&/^citadel-horse-[1-3]$/.test(saved.ridingId)?saved.ridingId:null;
      const seen=new Set();mountRecords=[];
      for(const m of (Array.isArray(saved?.horses)?saved.horses:[]).slice(0,3)){
        if(!m||!/^citadel-horse-[1-3]$/.test(m.id)||seen.has(m.id)||!finite3(m.position)||!Number.isFinite(m.yaw))continue;
        if(Math.abs(m.position[0])>=560||Math.abs(m.position[2])>=580||m.position[1]<=-20||m.position[1]>=220)continue;
        seen.add(m.id);mountRecords.push({id:m.id,position:m.position.slice(),yaw:m.yaw});
      }
      if(!seen.has(ridingId))ridingId=null;
    }
    function localArray() { return navState ? navState.position.toArray() : savedPosition.slice(); }
    function contains(x,y) {
      if(!active)return false;
      if(era!=='past')return Math.abs(x-ORIGIN.x)<238 && Math.abs(y-ORIGIN.z)<248;
      const b=pastWorld()?.bounds;
      return !!b&&x>=b.minX&&x<=b.maxX&&y>=b.minZ&&y<=b.maxZ;
    }
    function volume(x,y,h) {
      if(!active || !contains(x,y) || !Number.isFinite(h))return false;
      if(era==='past')return h>=(pastWorld().bounds.minY??-1000)-100&&h<=(pastWorld().bounds.maxY??1200)+100;
      const ly=h-ORIGIN.y;
      return ly>=-680 && ly<=30;
    }
    function base(e) { return inside(e) ? (era==='past'?0:ORIGIN.y)+(navState?.position.y??savedPosition[1])+(mounted()?.seatOffset||0) : undefined; }
    function worldPoint(x,y,h) { return era==='past'?[x,h,y]:[ORIGIN.x-x,h-ORIGIN.y,ORIGIN.z-y]; }
    function clearProjectiles() {
      const s=getState();if(!s)return;
      for(const k of ['bullets','sbullets','projs','equipmentProjectiles','pastProjectiles'])if(Array.isArray(s[k]))s[k].length=0;
    }
    function sanitizeWeaponPickup(value) {
      if(value===null)return null;
      const saved=typeof value==='string'?{weaponId:value}:value;
      if(!saved||typeof saved!=='object'||Array.isArray(saved)||!pastWeaponIds.has(saved.weaponId))return undefined;
      const id=saved.weaponId;
      // The six original melee pickups have no per-item ammunition or wear.
      // Keep their compact legacy save representation while passing an object
      // to the inventory callback below.
      if(legacyPastWeaponIds.has(id))return id;
      const def=host.HanQPastArsenal?.nativeWeaponDefinitions?.[id];if(!def)return undefined;
      const amount=(n,max)=>Number.isFinite(n)?clamp(n,0,Number.isFinite(max)?Math.max(0,max):0):0;
      const count=(n,max)=>Math.floor(amount(n,max));
      if(def.pastKind==='shield')return {weaponId:id,durability:amount(saved.durability,def.maxDurability),raised:false};
      // Missing fields (including a historical ranged ID in an older string
      // save) mean zero, never a fresh magazine or an ammunition refill.
      return {weaponId:id,mag:count(saved.mag,def.mag),pastReserve:count(saved.pastReserve,def.initialReserve)};
    }
    function serializeWeaponPickups() {
      const result={hayeon:{},citadel:{}};
      for(const district of ['hayeon','citadel'])for(const [id,value]of Object.entries(weaponPickups[district]))
        result[district][id]=value&&typeof value==='object'?{...value}:value;
      return result;
    }
    function restoreWeaponPickups(saved) {
      weaponPickups={hayeon:{},citadel:{}};
      for(const district of ['hayeon','citadel']){
        const entries=saved?.[district];if(!entries||typeof entries!=='object'||Array.isArray(entries))continue;
        for(const [id,value]of Object.entries(entries).slice(0,128)){
          if(!/^[a-z0-9][a-z0-9_-]{0,95}$/.test(id)||id==='constructor'||id==='prototype')continue;
          // A malformed saved replacement is empty, not an authored fresh
          // supply. Ignoring it would incorrectly refill its ammunition.
          weaponPickups[district][id]=sanitizeWeaponPickup(value)??null;
        }
      }
    }
    function pickupWeaponId(item,district=area) {
      const changed=weaponPickups[district];
      const value=Object.prototype.hasOwnProperty.call(changed,item.id)?changed[item.id]:item.weaponId;
      return value&&typeof value==='object'?value.weaponId:value;
    }
    function pickupState(item,district=area) {
      const changed=weaponPickups[district];
      if(!Object.prototype.hasOwnProperty.call(changed,item.id))return undefined;
      const value=changed[item.id];
      return typeof value==='string'?{weaponId:value}:value?{...value}:null;
    }
    function releasePickup(record) {
      record.root.removeFromParent();
      // The approved hand-held models share reference-counted materials with
      // the actor. Never let a district's general dispose traverse own them.
      options.disposeWeaponPickup?.(record.weapon);
      record.ring.geometry.dispose();record.ring.material.dispose();
    }
    function clearPickupWorld(world) {
      const records=pickupWorlds.get(world);if(!records)return;
      for(const record of records.values())releasePickup(record);
      pickupWorlds.delete(world);
    }
    function renderWeaponPickups(world) {
      const T=getT();if(!T||!options.createWeaponPickup)return;
      let records=pickupWorlds.get(world);
      if(!records){
        records=new Map();pickupWorlds.set(world,records);
        const dispose=world.dispose;
        world.dispose=function(...args){clearPickupWorld(world);return dispose?.apply(world,args);};
      }
      const pos=localArray(),shown=new Set();
      for(const item of world.weaponPickups||[]){
        if(!finite3(item.position))continue;
        const id=pickupWeaponId(item);
        if(!pastWeaponIds.has(id)||distance(pos,item.position)>65)continue;
        shown.add(item.id);let record=records.get(item.id);
        if(record&&record.weaponId!==id){releasePickup(record);records.delete(item.id);record=null;}
        if(!record){
          const weapon=options.createWeaponPickup(id);if(!weapon)continue;
          const root=new T.Group();root.name='Past_Weapon_Pickup_'+item.id;
          root.userData.pastWeaponPickup=item.id;root.userData.weaponId=id;
          const groundRotation=weapon.userData?.groundRotation,kind=host.HanQPastArsenal?.get(id)?.kind;
          if(finite3(groundRotation))weapon.rotation.set(...groundRotation);
          else if(kind)weapon.rotation.set(kind==='crossbow'||kind==='matchlock'?0:Math.PI/2,0,0);
          else weapon.rotation.set(0,0,Math.PI/2);
          const bounds=new T.Box3().setFromObject(weapon),center=bounds.getCenter(new T.Vector3());
          weapon.position.set(-center.x,.06-bounds.min.y,-center.z);
          const ring=new T.Mesh(new T.TorusGeometry(.6,.018,5,28),new T.MeshBasicMaterial({color:0xeac879}));
          ring.rotation.x=-Math.PI/2;ring.position.y=.035;
          root.add(weapon,ring);root.position.set(...item.position);world.root.add(root);
          record={root,weapon,ring,weaponId:id};records.set(item.id,record);
        }
        record.root.visible=!world.inspection;
      }
      for(const [id,record]of records)if(!shown.has(id)){releasePickup(record);records.delete(id);}
    }
    function nearWeaponPickup(pos=localArray()) {
      if(era!=='past'||!player()?.alive)return null;
      const world=pastWorld(),T=getT();let nearest=null,best=Infinity;
      for(const item of world?.weaponPickups||[]){
        const weaponId=pickupWeaponId(item);
        if(!finite3(item.position)||!pastWeaponIds.has(weaponId))continue;
        const d=distance(pos,item.position);if(d>=(item.radius||2.4)||d>=best)continue;
        const a=new T.Vector3(pos[0],pos[1]+1,pos[2]),b=new T.Vector3(item.position[0],item.position[1]+.45,item.position[2]);
        if(world.nav.cameraDistance&&world.nav.cameraDistance(a,b,.06)<a.distanceTo(b)-.18)continue;
        best=d;nearest={...item,weaponId,pickupState:pickupState(item),label:options.weaponName?.(weaponId)||item.label||weaponId};
      }
      return nearest;
    }
    function collectWeapon(item) {
      const result=options.pickupWeapon?.(item.weaponId,item.pickupState);
      if(!result||result.ok===false){say('무기를 집을 수 없어요. 잠시 후 다시 시도하세요.','#e6c6a1');return false;}
      const candidate=typeof result==='object'?(Object.prototype.hasOwnProperty.call(result,'replacedPickup')?result.replacedPickup:result.replacedWeaponId):null;
      const replaced=sanitizeWeaponPickup(candidate)??null;
      weaponPickups[area][item.id]=replaced;
      const record=pickupWorlds.get(pastWorld())?.get(item.id);
      if(record){releasePickup(record);pickupWorlds.get(pastWorld()).delete(item.id);}
      getState().mapDirty=true;resetTransitionInput();
      say(item.label+' 획득'+(replaced?' · 기존 무기는 바닥에 내려놓았습니다':''),'#f3d596');return true;
    }
    function clearMotion(p) {
      p.alt=0;p.floor=0;p.jz=0;p.vz=0;p.vx=0;p.vy=0;p.air=false;
      p.plat=null;p.climb=null;p.vault=null;p.roll=null;
      const s=getState();if(!s)return;
      s.camBase=null;s.camState=null;s.moveDir=null;s.aimNade=null;
      s.pickPrompt=s.vehPrompt=s.ladderPrompt=s.vaultPrompt=s.craftPrompt=null;
      if(s.input){s.input.fire=false;s.input.ads=false;s.input.adsToggle=false;s.input.move=null;}
    }
    function resetTransitionInput() {clearMotion(player());options.clearInput?.();jumpPending=false;}
    function syncPlayer() {
      const p=player();if(!active||!p)return;
      const v=navState?.velocity;
      savedPosition=localArray();
      p.hollow=true;p.x=era==='past'?savedPosition[0]:ORIGIN.x-savedPosition[0];p.y=era==='past'?savedPosition[2]:ORIGIN.z-savedPosition[2];
      p.floor=0;p.alt=0;p.jz=0;p.vz=v?.y||0;
      const sign=era==='past'?1:-1;
      p.vx=sign*(v?.x||0);p.vy=sign*(v?.z||0);p.air=train.riding?false:navState?!navState.grounded:false;
      p.hollowHeight=(era==='past'?0:ORIGIN.y)+savedPosition[1];
      if(mounted()){p.hollowMountId=ridingId;p.hollowHeight+=mounted().seatOffset;p.crouch=false;}
      else delete p.hollowMountId;
      p.hollowEra=era;
      p.hollowArea=era==='past'?area:'hollow';
    }
    function validPastPosition(a,world=pastWorld()) {
      const b=world?.bounds;
      return finite3(a)&&!!b&&a[0]>=b.minX&&a[0]<=b.maxX&&a[2]>=b.minZ&&a[2]<=b.maxZ&&a[1]>=(b.minY??-1000)-20&&a[1]<=(b.maxY??1200)+20;
    }
    function makeNavState(world,id,position,isPast) {
      const T=getT(),nav=world.nav;
      const candidate=nav.getCheckpoint(id),expectedEra=isPast?'past':'present';
      const c=candidate&&(!candidate.era||candidate.era===expectedEra)?candidate:(isPast?world.arrival:nav.getCheckpoint('entrance'));
      if(!c||!finite3(c.position))throw new Error('World arrival is unavailable');
      const state={position:new T.Vector3(),velocity:new T.Vector3(),grounded:true};
      nav.teleport(state,c);
      const valid=isPast?validPastPosition(position,world):validPosition(position);
      if(valid){
        const floor=nav.groundAt(position[0],position[2],position[1],.7);
        const supported=Number.isFinite(floor)&&position[1]-floor>=-.7&&position[1]-floor<5.5;
        const blocked=nav.bodyClear?.(position[0],position[1],position[2])===false||isPast&&(nav.pointSolid(position[0],position[1]+.55,position[2],.25)||nav.pointSolid(position[0],position[1]+1.5,position[2],.25));
        if((!isPast&&train.riding)||supported&&!blocked){
          state.position.set(...position);state.grounded=Number.isFinite(floor)&&Math.abs(position[1]-floor)<.65;
          state.safePosition=state.position.clone();state.fallStartY=position[1];
        }
      }
      return {state,checkpoint:c.id};
    }
    function ensure() {
      if(disposed)return null;
      const T=getT(),t3=getThree();if(!T||!t3?.scene||!host.HanQHollowWorld)return null;
      if([model,pastModel,citadelModel].some(world=>world&&world.root.parent!==t3.scene))disposeModel();
      // A renderer recreation can discard GPU resources while the save is still
      // in Hayeon. Keep that destination and wait safely at the current portal.
      if(era==='past'&&!pastWorld()){
        pendingPastRestore={version:VERSION,era:'past',area,position:localArray(),checkpoint};
        era='present';area='hayeon';checkpoint='portal';savedPosition=PORTAL.slice();navState=null;
      }
      if(era==='present'&&!model){
        model=host.HanQHollowWorld.create({THREE:T,scene:t3.scene});
        model.root.position.set(ORIGIN.x,ORIGIN.y,ORIGIN.z);model.root.rotation.y=Math.PI;
        model.root.name='HanQ_Hollow_Native';model.setEra('present');model.root.visible=false;
        model.rail.setProgress(train.progress);
      }
      if(model)prepareSurfaceModel(model);
      const world=currentModel();
      if(world&&!navState){
        const restored=makeNavState(world,checkpoint,savedPosition,era==='past');
        navState=restored.state;checkpoint=restored.checkpoint;
        if(train.riding&&era==='present')syncPassenger();
      }
      if(pendingPastRestore&&!loading&&!loadError&&active&&era==='present')beginPastTransition();
      return world;
    }
    function setCheckpoint(id) {
      const world=currentModel();if(!world)return false;
      const c=world.nav.getCheckpoint(id);if(!c||c.era&&c.era!==era)return false;
      checkpoint=c.id;world.nav.teleport(navState,c);
      savedPosition=c.position.slice();jumpPending=false;stepped=frame;syncPlayer();return true;
    }
    function install(saved) {
      if(disposed)return false;
      const p=player();if(!p||getState()?.mode!=='open')return false;
      ++loadToken;loading=false;loadProgress=0;loadError=null;loadPromise=null;pendingPastRestore=null;navState=null;
      surfaceRuntime?.resetRegion?.(SURFACE_REGION);surfaceOwners.clear();configuredSurfaceOwners=new WeakSet();
      readSurfaceDamage(saved?.version===1||saved?.version===2||saved?.version===VERSION?saved.surfaceDamage:null);
      restoreWeaponPickups(saved?.weaponPickups);
      restoreMountState(saved?.mounts);delete p.hollowMountId;
      if(saved?.version===1||saved?.version===2||saved?.version===VERSION){
        discovered=!!saved.discovered;
        visited=new Set((Array.isArray(saved.visited)?saved.visited:[]).filter(v=>typeof v==='string').slice(0,128));
        checkpoint=typeof saved.checkpoint==='string'?saved.checkpoint:'entrance';
        era=saved.era==='past'?'past':'present';
        area=saved.version===VERSION&&saved.area==='citadel'?'citadel':'hayeon';
        active=!!saved.inside;
        if(era==='past'&&active){
          // Version 1 used a small vignette underneath the dungeon. Those local
          // coordinates are deliberately migrated to the new safe arrival.
          pendingPastRestore={version:VERSION,era:'past',area,position:saved.version>=2&&finite3(saved.position)?saved.position.slice():null,
            checkpoint:saved.version>=2?checkpoint:'past-arrival'};
          era='present';area='hayeon';checkpoint='portal';savedPosition=PORTAL.slice();
        }else{
          era='present';savedPosition=validPosition(saved.position)?saved.position.slice():[0,0,-52];
          if(!validPosition(saved.position))checkpoint='entrance';
        }
        const tr=saved.train||{};
        train.progress=clamp(Number.isFinite(tr.progress)?tr.progress:0,0,1);
        train.direction=tr.direction===-1?-1:1;
        train.target=Number.isInteger(tr.target)?clamp(tr.target,0,2):0;
        train.station=Number.isInteger(tr.station)?clamp(tr.station,0,2):0;
        train.speed=clamp(Number.isFinite(tr.speed)?tr.speed:0,0,24);
        train.dwell=clamp(Number.isFinite(tr.dwell)?tr.dwell:0,0,7);
        train.riding=active&&!pendingPastRestore&&!!tr.riding;
        train.calling=active&&!pendingPastRestore&&!!tr.calling;
        if(active){
          p.hollow=true;clearMotion(p);
          if(model){model.setEra('present');model.rail.setProgress(train.progress);}
          ensure();syncPlayer();
        }
        else {delete p.hollow;delete p.hollowHeight;delete p.hollowEra;delete p.hollowArea;}
      }else{
        // Older saves have no Hollow payload. Never alter their native spawn.
        active=false;era='present';area='hayeon';checkpoint='entrance';savedPosition=[0,0,-52];train.riding=false;train.calling=false;
        delete p.hollow;delete p.hollowHeight;delete p.hollowEra;delete p.hollowArea;
      }
      return true;
    }
    function serialize() {
      if(inside()&&pendingPastRestore)return {version:VERSION,inside:true,era:'past',area:pendingPastRestore.area||'hayeon',position:pendingPastRestore.position?.slice()||null,
        checkpoint:pendingPastRestore.checkpoint,discovered,visited:[...visited],weaponPickups:serializeWeaponPickups(),surfaceDamage:serializeSurfaceDamage(),mounts:mountState(),train:{...train,riding:false,calling:false,speed:0}};
      return {version:VERSION,inside:inside(),era,area:era==='past'?area:'hollow',position:localArray(),checkpoint,
        discovered,visited:[...visited],weaponPickups:serializeWeaponPickups(),surfaceDamage:serializeSurfaceDamage(),mounts:mountState(),train:{...train}};
    }
    function entranceAction() {
      const p=player();if(active||!p?.alive||getState()?.mode!=='open'||p.vehicle||p.craft||p.mortar||p.railPassenger||p.alt>0)return false;
      if(Math.hypot(p.x-ENTRY.x,p.y-ENTRY.y)>4.5)return false;
      const h=(options.getTerrain?.(p.x,p.y)||0)+(p.floor||0)+(p.jz||0);
      return Math.abs(h-ENTRY.h)<3.5;
    }
    function nearStation() {
      if(!model||!active||era!=='present'||train.riding)return -1;
      const a=localArray();let best=-1,bestD=14;
      for(let i=0;i<model.nav.stationPoints.length;i++){
        const q=model.nav.stationPoints[i].position;
        const d=Math.hypot(a[0]-q[0],a[2]-q[2]);
        if(Math.abs(a[1]-q[1])<3.2&&d<bestD){best=i;bestD=d;}
      }
      return best;
    }
    function stoppedAt(i) {
      const st=model?.rail.stations[i];return !!st&&Math.abs(train.progress-st.t)<1e-5&&train.speed<.05;
    }
    function nearPastPortal(pos=localArray()) {
      const portal=pastWorld()?.returnPortal;
      return !!portal&&distance(pos,portal.position)<(portal.radius||4.5);
    }
    function nearTravelNode(pos=localArray()) {
      if(era!=='past')return null;
      let best=null,bestD=Infinity;
      for(const node of pastWorld()?.travelNodes||[]){
        if(!finite3(node.position))continue;
        const d=distance(pos,node.position);
        if(d<(node.radius||4.5)&&d<bestD){best=node;bestD=d;}
      }
      return best;
    }
    function nearCitadelGate(pos=localArray()) {const gate=pastWorld()?.citadelGate;return !!gate&&distance(pos,gate.position)<(gate.radius||4.5);}
    function nearStoryPoint(pos=localArray()) {
      let best=null,bestD=Infinity;
      for(const point of pastWorld()?.storyPoints||[]){const d=distance(pos,point.position);if(d<(point.radius||3.5)&&d<bestD){best=point;bestD=d;}}
      return best;
    }
    function nearMount(pos=localArray()){
      if(!inside()||era!=='past'||area!=='citadel'||ridingId||!player()?.alive||!navState?.grounded)return null;
      const world=pastWorld(),T=getT();let nearest=null,best=3.2;
      for(const m of world?.mounts||[]){
        const d=Math.hypot(pos[0]-m.position[0],pos[2]-m.position[2]);
        if(d>=best||Math.abs(pos[1]-m.position[1])>=1.2||!world.mountClear(m.id,m.position,m.yaw))continue;
        const a=new T.Vector3(pos[0],pos[1]+1.3,pos[2]),b=new T.Vector3(m.position[0],m.position[1]+2.15,m.position[2]);
        if(world.nav.cameraDistance(a,b,.08)<a.distanceTo(b)-.15)continue;
        nearest=m;best=d;
      }
      return nearest;
    }
    function boardMount(m){
      if(!m||nearMount()?.id!==m.id)return false;
      ridingId=m.id;pastWorld().nav.teleport(navState,{id:checkpoint,position:m.position.slice()});
      resetTransitionInput();syncPlayer();getState().yaw=m.yaw;getState().pitch=.09;
      say(m.label+' 탑승 · 이동 키 / 스틱으로 이동 · E / F 하차','#f3d596');return true;
    }
    function leaveMount(){
      const m=mounted();if(!m)return false;
      const exit=pastWorld().mountExit(m.id);
      if(!exit){say('주변에 내릴 공간이 필요해요','#e6c6a1');return true;}
      ridingId=null;pastWorld().nav.teleport(navState,{id:checkpoint,position:exit});resetTransitionInput();syncPlayer();
      say(m.label+' 하차','#b9d9c6');return true;
    }
    function loadingLabel() {return (loadingArea==='citadel'?'백월 대왕성 연결 중':'과거의 하연 연결 중')+(loadProgress>0?' · '+Math.round(loadProgress*100)+'%':'…');}
    function prompt() {
      if(entranceAction())return '봉쇄갱 입장 · 흑철 심연';
      if(!inside())return null;
      if(loading)return loadingLabel();
      const pos=localArray();
      if(mounted())return mounted().label+' 하차';
      if(era==='past'){
        if(pastWorld()?.inspection)return '실내 보기 닫기 · E / F 또는 이동';
        if(nearPastPortal(pos))return area==='citadel'?'왕궁 정문 · 하연성 역참으로':'귀환 시간문 · 현재의 지하미궁으로';
        if(nearCitadelGate(pos))return loadError?'왕궁 연결 재시도 · 백월 대왕성':'왕궁 입장 · 백월 대왕성';
        const record=nearStoryPoint(pos);if(record)return record.prompt||record.label||'왕궁 기록 조사';
        const node=nearTravelNode(pos);
        if(node)return node.kind==='ladder'?node.label:'길잡이 표지 · '+node.label;
        const mount=nearMount(pos);if(mount)return mount.label+' 탑승';
        const weapon=nearWeaponPickup(pos);if(weapon)return weapon.label+' 줍기 · E / F';
        const action=pastWorld()?.interactionAt?.(pos);
        return action?.kind==='inspect'?action.label:null;
      }
      if(train.riding){
        if(train.speed<.05&&stoppedAt(train.station))return '광산 열차 하차 · '+(model?.rail.stations[train.station]?.short||'정차역');
        return '광산 열차 이동 중 · 다음 역에서 하차';
      }
      if(distance(pos,[0,0,-52])<5.2)return '전장으로 나가기';
      if(distance(pos,PORTAL)<8)return pendingPastRestore?.area==='citadel'?'백월 대왕성 · 저장 위치 복원 재시도':loadError?'시간문 연결 재시도 · 과거의 하연':'시간문 통과 · 과거의 하연';
      const station=nearStation();
      if(station>=0){
        if(stoppedAt(station))return '광산 열차 탑승 · 다음 역까지 이동';
        if(train.calling&&train.target===station)return '광산 열차 접근 중';
        return '광산 열차 호출';
      }
      return null;
    }
    function enter() {
      if(!entranceAction()||!ensure())return false;
      active=true;era='present';train.riding=false;
      discovered=true;visited.add('entrance');
      const p=player();p.hollow=true;resetTransitionInput();setCheckpoint('entrance');
      const s=getState();s.yaw=Math.PI/2;s.pitch=.14;
      // Native projectiles belong to the departing scene; do not carry them through rock.
      clearProjectiles();
      say('흑철 심연 · 계단으로 전 층 이동 / M 지하 지도','#f3d596');return true;
    }
    function leave() {
      if(!inside())return false;
      const p=player();train.riding=false;train.calling=false;train.speed=0;
      ++loadToken;loading=false;loadPromise=null;pendingPastRestore=null;loadError=null;
      active=false;delete p.hollow;delete p.hollowHeight;delete p.hollowEra;delete p.hollowArea;
      setSurfaceVisible(false);
      resetTransitionInput();p.x=EXIT.x;p.y=EXIT.y;
      clearProjectiles();
      const g=options.getTerrain?.(EXIT.x,EXIT.y);p.floor=Number.isFinite(g)?Math.max(0,EXIT.h-g):0;
      getState().yaw=-Math.PI/2;getState().pitch=.12;
      if(model)model.root.visible=false;
      if(pastModel)pastModel.root.visible=false;
      if(citadelModel)citadelModel.root.visible=false;
      afterRender();say('흑철 성채 후방으로 복귀','#b9d9c6');return true;
    }
    function syncPassenger() {
      if(!model||!navState)return;
      model.rail.setProgress(train.progress);
      const q=model.rail.passengerPose();navState.position.copy(q.feetPosition);
      navState.velocity.set(0,0,0);navState.grounded=true;syncPlayer();
    }
    function board(i) {
      if(!model||!stoppedAt(i))return false;
      train.riding=true;train.calling=false;train.station=i;train.speed=0;train.dwell=3.5;
      if(i===0)train.direction=1;if(i===2)train.direction=-1;
      train.target=i+train.direction;checkpoint='station-'+i;visited.add(checkpoint);
      clearMotion(player());syncPassenger();say('탑승 완료 · 각 역 정차 시 E / F로 하차','#f3d596');return true;
    }
    function disembark() {
      if(!train.riding||!stoppedAt(train.station))return false;
      train.riding=false;train.calling=false;train.dwell=0;train.target=train.station;
      setCheckpoint('station-'+train.station);clearMotion(player());syncPlayer();
      say(model.rail.stations[train.station].name+' · 하차','#b9d9c6');return true;
    }
    function beginPastTransition(targetArea='hayeon',restoreOverride=null) {
      if(disposed||!inside())return false;
      if(loading)return true;
      mountState();
      const restore=restoreOverride||pendingPastRestore;
      const fromEra=era,changesEra=fromEra!=='past'&&!restore;
      const nextArea=(restore?.area||targetArea)==='citadel'?'citadel':'hayeon';
      const T=getT(),scene=getThree()?.scene,loader=nextArea==='citadel'?host.HanQCitadelWorld:host.HanQPastWorld;
      const name=nextArea==='citadel'?'백월 대왕성':'과거의 하연';
      if(!T||!scene||!loader?.load){
        loadError='unavailable';say(name+'을 불러오지 못했어요. 입구에서 E / F로 다시 시도하세요.','#e6c6a1');return false;
      }
      const token=++loadToken,owner=player(),ownerState=getState();
      loading=true;loadingArea=nextArea;loadProgress=0;loadError=null;
      resetTransitionInput();navState?.velocity.set(0,0,0);syncPlayer();
      say(name+' · 연결 중','#a8e2d7');
      const previous=nextArea==='citadel'?citadelModel:pastModel;
      const cached=previous?.root.parent===scene?previous:null;
      const current=()=>token===loadToken&&!disposed&&inside()&&player()===owner&&getState()===ownerState&&getThree()?.scene===scene;
      // Keep the departing world and save location until destination navigation
      // has been validated. A failed district load never strands the actor.
      loadPromise=Promise.resolve().then(()=>{
        if(!current())return null;
        return cached||loader.load({THREE:T,scene,uiRoot:api()?.stage,onProgress:value=>{
          if(token!==loadToken)return;
          const n=typeof value==='number'?value:value?.progress;
          if(Number.isFinite(n))loadProgress=clamp(n,0,1);
        }});
      }).then(world=>{
        if(!current()){
          if(world!==pastModel&&world!==citadelModel)world?.dispose?.();
          if(token===loadToken&&!disposed){loading=false;loadProgress=0;loadError='interrupted';}
          return false;
        }
        if(!world?.root||!world.nav||!finite3(world.arrival?.position)||!finite3(world.returnPortal?.position)||!world.bounds){
          if(world!==pastModel&&world!==citadelModel)world?.dispose?.();throw new Error('Past district is incomplete');
        }
        let restored;
        try{if(nextArea==='citadel')world.restoreMounts?.(mountRecords);restored=makeNavState(world,restore?.checkpoint||world.arrival.id,restore?.position||null,true);}
        catch(error){if(world!==pastModel&&world!==citadelModel)world.dispose();throw error;}
        afterRender();pastWorld()?.setInspection?.(null);
        if(nextArea==='citadel')citadelModel=world;else pastModel=world;
        for(const item of [model,pastModel,citadelModel])if(item)item.root.visible=false;
        era='past';area=nextArea;checkpoint=restored.checkpoint;navState=restored.state;
        setSurfaceVisible(false);
        if(ridingId){const m=mounted(),savedMount=mountRecords.find(q=>q.id===ridingId);
          if(!m||!savedMount||!restore?.position||distance(m.position,savedMount.position)>.02||distance(localArray(),m.position)>.3||!world.mountClear(m.id,m.position,m.yaw))ridingId=null;}
        // Each detailed district has substantial CPU/GPU geometry. Keep the old
        // scene for rollback only while loading, then release the inactive one.
        if(nextArea==='citadel'&&pastModel){pastModel.dispose();pastModel=null;}
        else if(nextArea==='hayeon'&&citadelModel){mountState();ridingId=null;citadelModel.dispose();citadelModel=null;}
        train.riding=false;train.calling=false;train.speed=0;
        visited.add(checkpoint);pendingPastRestore=null;loading=false;loadProgress=1;loadError=null;
        resetTransitionInput();stepped=frame;syncPlayer();
        getState().yaw=Number.isFinite(world.arrival.yaw)?world.arrival.yaw:(nextArea==='citadel'?-Math.PI/2:Math.PI/2);getState().pitch=.09;
        if(changesEra){restoreWeaponPickups(null);options.onEraChange?.({from:fromEra,to:'past'});}
        clearProjectiles();say(name+(changesEra?' · 무기 전량 소멸 · 주변의 무기를 주우세요':restore?.position?' · 탐험 위치 복원':' · 도착'),'#a8e2d7');
        return true;
      }).catch(()=>{
        if(token!==loadToken||disposed)return false;
        loading=false;loadError='load-failed';loadProgress=0;
        say(name+' 연결에 실패했어요. 현재 입구에서 E / F로 다시 시도하세요.','#e6c6a1');
        return false;
      });
      return true;
    }
    function travelEra(next) {
      if(next==='past')return beginPastTransition();
      if(next!=='present'||!inside()||loading||era!=='past')return false;
      // Validate the present destination before committing the era or loadout.
      const T=getT(),scene=getThree()?.scene;
      if(!T||!scene||!host.HanQHollowWorld)return false;
      let destination=model,created=false,restored;
      try{
        if(!destination){
          destination=host.HanQHollowWorld.create({THREE:T,scene});created=true;
          destination.root.position.set(ORIGIN.x,ORIGIN.y,ORIGIN.z);destination.root.rotation.y=Math.PI;
          destination.root.name='HanQ_Hollow_Native';destination.setEra('present');destination.root.visible=false;
        }
        prepareSurfaceModel(destination);
        restored=makeNavState(destination,'portal',PORTAL,false);
      }catch(error){if(created)destination?.dispose?.();say('현재 시간문을 불러오지 못했어요. 다시 시도하세요.','#e6c6a1');return false;}
      afterRender();
      pastWorld()?.setInspection?.(null);
      if(pastModel)pastModel.root.visible=false;
      if(citadelModel)citadelModel.root.visible=false;
      train.riding=false;train.calling=false;train.speed=0;
      model=destination;era='present';area='hayeon';checkpoint=restored.checkpoint;savedPosition=PORTAL.slice();navState=restored.state;
      visited.add('portal');resetTransitionInput();syncPlayer();
      getState().yaw=-Math.PI/2;getState().pitch=.09;
      options.onEraChange?.({from:'past',to:'present'});
      clearProjectiles();say('현재의 시간문 광장으로 복귀 · 무기 전량 소멸','#a8e2d7');return true;
    }
    function interact() {
      if(!active)return enter();
      if(!inside()||!ensure())return false;
      if(loading)return true;
      if(mounted())return leaveMount();
      if(train.riding){if(!disembark())say('열차가 다음 역에 정차하면 내릴 수 있어요');return true;}
      const pos=localArray();
      if(era==='past'){
        if(pastWorld()?.inspection){pastWorld().setInspection(null);resetTransitionInput();return true;}
        if(nearPastPortal(pos)){if(area==='citadel')beginPastTransition('hayeon',{area:'hayeon',checkpoint:'past-citadel-gate'});else travelEra('present');}
        else if(nearCitadelGate(pos))beginPastTransition('citadel');
        else if(nearStoryPoint(pos)){options.onStoryAction?.(nearStoryPoint(pos).id);resetTransitionInput();}
        else {
          const node=nearTravelNode(pos);
          if(node&&setCheckpoint(node.targetCheckpoint)){
            visited.add(checkpoint);resetTransitionInput();syncPlayer();clearProjectiles();
            say(node.label+' · 도착','#a8e2d7');
          }else if(!node){
            const mount=nearMount(pos);if(mount)return boardMount(mount);
            const weapon=nearWeaponPickup(pos);
            if(weapon){collectWeapon(weapon);return true;}
            const action=pastWorld()?.interactionAt?.(pos);
            if(action?.kind==='inspect'&&pastWorld().setInspection?.(action.id)){
              resetTransitionInput();navState.velocity.set(0,0,0);syncPlayer();
              options.onInspectionOpen?.();
            }
          }
        }
        return true;
      }
      if(distance(pos,[0,0,-52])<5.2)return leave();
      if(distance(pos,PORTAL)<8){travelEra('past');return true;}
      const station=nearStation();
      if(station>=0){
        if(stoppedAt(station))return board(station);
        train.target=station;train.calling=true;train.dwell=0;
        say(model.rail.stations[station].name+'로 열차를 호출했어요','#f3d596');
      }
      // Interior E/F must never operate an exterior soldier, ladder or vehicle at the same XY.
      return true;
    }
    function rememberCheckpoint() {
      const world=currentModel();if(!world||train.riding||!navState?.grounded)return;
      const pos=localArray();let nearest=9;
      for(const c of world.nav.checkpoints){
        if(c.era!==era||Math.abs(pos[1]-c.position[1])>2.5)continue;
        const d=distance(pos,c.position);
        if(d<9){visited.add(c.id);if(era==='present'||d<nearest){checkpoint=c.id;nearest=d;}}
      }
      if(era==='past')navState.checkpointId=checkpoint;
    }
    function step(e,mx,my,speed,dt) {
      if(!inside(e)||!ensure())return false;
      if(loading||options.isStoryOpen?.()){navState?.velocity.set(0,0,0);stepped=frame;syncPlayer();return true;}
      if(era==='past'&&pastWorld()?.inspection){
        if(Math.hypot(mx||0,my||0)>.01)pastWorld().setInspection(null);
        else {stepped=frame;syncPlayer();return true;}
      }
      if(train.riding){syncPassenger();stepped=frame;return true;}
      const mount=mounted();
      if(mount){
        const world=pastWorld(),nav=world.nav,elapsed=clamp(Number.isFinite(dt)?dt:0,0,.12),count=Math.max(1,Math.ceil(elapsed*90));
        let yaw=Math.hypot(mx,my)>.01?Math.atan2(my,mx):mount.yaw;
        const canTurn=world.mountClear(mount.id,localArray(),yaw);
        if(!canTurn){yaw=mount.yaw;mx=my=0;}
        const pace=Math.min(12,Math.max(0,Number.isFinite(speed)?speed:0)*1.85);
        for(let i=0;i<count;i++){
          const before=navState.position.clone();
          nav.step(navState,{move:{x:mx,z:my},speed:pace,jump:false},elapsed/count);
          if(!navState.grounded||!world.mountClear(mount.id,navState.position.toArray(),yaw)){
            navState.position.copy(before);navState.velocity.set(0,0,0);navState.grounded=true;navState.safePosition=before.clone();navState.fallDistance=0;break;
          }
          world.mountPose(mount.id,navState.position.toArray(),yaw);
        }
        jumpPending=false;stepped=frame;e.crouch=false;e.roll=e.vault=null;syncPlayer();rememberCheckpoint();return true;
      }
      const sign=era==='past'?1:-1,input={move:{x:sign*mx,z:sign*my},speed:Math.max(0,Number.isFinite(speed)?speed:0),jump:jumpPending};
      const before=navState.position.clone();jumpPending=false;currentModel().nav.step(navState,input,dt);stepped=frame;
      if(pastWorld()?.mountObstacle?.(navState.position.toArray())&&!pastWorld().mountObstacle(before.toArray())){navState.position.copy(before);navState.velocity.set(0,0,0);}
      e.step=(e.step||0)+Math.max(0,dt)*Math.hypot(navState.velocity.x,navState.velocity.z)*1.6;
      if(navState.needsRespawn||navState.fallDistance>28){
        if(!setCheckpoint(checkpoint))setCheckpoint(era==='past'?pastWorld().arrival.id:'entrance');
        if(visualTime-rescueAt>2){say('깊은 추락 · 마지막 도착 지점에서 재개','#e6c6a1');rescueAt=visualTime;}
      }
      syncPlayer();rememberCheckpoint();return true;
    }
    function move(e,mx,my,speed,dt) {return step(e,mx,my,speed,dt);}
    function vertical(e,dt) {
      if(!inside(e))return false;
      if(api()?.state!=='playing'||getState()?.mapOpen||!e.alive)return true;
      if(stepped!==frame)step(e,0,0,0,dt);
      if(e.rollCd>0)e.rollCd=Math.max(0,e.rollCd-dt);return true;
    }
    function resolve(e) {if(!inside(e))return false;ensure();syncPlayer();return true;}
    function jump(e) {
      if(!inside(e))return false;
      if(mounted())return true;
      if(era==='past'&&pastWorld()?.inspection){pastWorld().setInspection(null);return true;}
      if(!loading&&!options.isStoryOpen?.()&&!train.riding&&navState?.grounded)jumpPending=true;return true;
    }
    function respawn(e=player()) {
      if(!active||e!==player())return false;
      train.riding=false;train.calling=false;train.speed=0;ridingId=null;delete e.hollowMountId;e.hollow=true;
      pastWorld()?.setInspection?.(null);
      ensure();resetTransitionInput();if(!setCheckpoint(checkpoint))setCheckpoint(era==='past'?pastWorld()?.arrival.id:'entrance');syncPlayer();return true;
    }
    function tick(dt) {
      if(disposed)return;frame++;visualTime+=Math.max(0,dt||0);
      const p=player();if(!p)return;
      if(!p.alive&&ridingId){ridingId=null;delete p.hollowMountId;}
      const near=Math.hypot(p.x-ENTRY.x,p.y-ENTRY.y)<ENTRANCE_RANGE;
      if(near)lastNearby=visualTime;
      if(!active){
        if((model||pastModel||citadelModel||entrance)&&visualTime-lastNearby>25)disposeModel();
        return;
      }
      if(!ensure())return;
      if(loading||options.isStoryOpen?.()){options.clearInput?.();return;}
      if(era==='past'&&pastWorld()?.inspection){
        if(getState()?.mapOpen)pastWorld().setInspection(null);
        options.clearCombatInput?.();
        const s=getState();if(s.input){s.input.fire=false;s.input.ads=false;s.input.adsToggle=false;}
        s.aimNade=null;s.snipeHeld=false;s.snipeQ=0;
      }
      if(api()?.state!=='playing'||getState()?.mapOpen||!p.alive)return;
      const seconds=clamp(Number.isFinite(dt)?dt:0,0,.12);
      if(era==='present'&&(train.riding||train.calling)){
        if(train.dwell>0){train.dwell=Math.max(0,train.dwell-seconds);}
        else {
          const target=model.rail.stations[train.target].t,remaining=Math.abs(target-train.progress)*model.rail.routeLength;
          if(remaining<.035){
            train.progress=target;train.speed=0;train.station=train.target;
            if(train.riding){
              if(train.station===0)train.direction=1;if(train.station===2)train.direction=-1;
              train.target=train.station+train.direction;train.dwell=6;
              checkpoint='station-'+train.station;visited.add(checkpoint);
              say(model.rail.stations[train.station].name+' 정차 · E / F 하차','#f3d596');
            }else train.calling=false;
          }else{
            const wanted=Math.min(24,Math.sqrt(2*7*remaining));
            train.speed=train.speed<wanted?Math.min(wanted,train.speed+7*seconds):Math.max(wanted,train.speed-9*seconds);
            const advance=Math.min(remaining,Math.max(.2,train.speed)*seconds)/model.rail.routeLength;
            train.progress+=Math.sign(target-train.progress)*advance;
            model.rail.setProgress(train.progress);
          }
        }
        if(train.riding)syncPassenger();
      }
    }
    function ground(x,y,h) {
      if(!volume(x,y,h)||!ensure())return undefined;
      const p=worldPoint(x,y,h),g=currentModel().nav.groundAt(p[0],p[2],p[1],.06);
      return g===null?-1e4:(era==='past'?0:ORIGIN.y)+g;
    }
    function solid(x,y,h) {
      if(!volume(x,y,h)||!ensure())return undefined;
      const p=worldPoint(x,y,h),mount=pastWorld()?.mountObstacle?.(p,.02,ridingId,0);
      if(mount)return {kind:'citadelHorse',hgt:mount.position[1]+3.1,hollow:true};
      const q=currentModel().nav.pointSolid(p[0],p[1],p[2],0);
      if(!q)return null;
      const top=(q.heightAt?.(p[0],p[2])??q.maxY)+(era==='past'?0:ORIGIN.y);
      const surfaceId=surfaceKey(q);
      return {id:q.id,kind:'hollowStone',hgt:top,floorTop:top,hollow:true,...(era==='present'&&surfaceSpecs.has(surfaceId)?{hollowSurfaceId:surfaceId}:{})};
    }
    function camera(view={}) {
      if(!inside()||!ensure())return null;
      if(era==='past'){
        const inspection=pastWorld()?.inspectionCamera?.();if(inspection)return inspection;
      }
      const p=player(),s=getState();
      const yaw=Number.isFinite(view.yaw)?view.yaw:s.yaw,pitch=Number.isFinite(view.pitch)?view.pitch:s.pitch;
      const ads=clamp(Number.isFinite(view.ads)?view.ads:s.adsK||0,0,1);
      const dx=Math.cos(pitch)*Math.cos(yaw),dy=-Math.sin(pitch),dz=Math.cos(pitch)*Math.sin(yaw);
      const feet=base(p),crouch=view.crouch??p.crouch;
      if(view.scope)return{x:p.x+Math.cos(yaw)*.1,y:feet+(crouch?1.15:1.6),z:p.y+Math.sin(yaw)*.1,dx,dy,dz,scope:true};
      const shoulder=.85-.35*ads,dist=mounted()?5.4-2*ads:train.riding?5.4:3.6-2.1*ads;
      const tx=p.x-Math.sin(yaw)*shoulder,tz=p.y+Math.cos(yaw)*shoulder,ty=feet+(crouch?1.3:1.85-.17*ads);
      const T=getT(),nav=currentModel().nav,a=new T.Vector3(...worldPoint(tx,tz,ty));
      const b=new T.Vector3(...worldPoint(tx-dx*dist,tz-dz*dist,ty-dy*dist));
      let length=Math.min(dist,nav.cameraDistance(a,b,.2));
      // A shoulder camera also needs the thin walkable slabs. Wall-only clipping
      // would let an upward look put the camera beneath stairs and city decks.
      for(let d=.25;d<length;d+=.08){
        const f=d/dist;
        if(nav.pointSolid(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f,a.z+(b.z-a.z)*f,.18)){
          length=Math.max(.25,d-.12);break;
        }
      }
      return{x:tx-dx*length,y:ty-dy*length,z:tz-dz*length,dx,dy,dz,scope:false};
    }
    function makeEntrance() {
      const T=getT(),t3=getThree();if(!T||!t3?.scene)return;
      if(entrance?.parent===t3.scene)return;
      if(entrance)disposeEntrance();
      entrance=new T.Group();entrance.name='HanQ_Hollow_Fortress_Entrance';entrance.position.set(ENTRY.x,ENTRY.h,ENTRY.y);
      const stone=new T.MeshStandardMaterial({color:0x364647,roughness:.88,metalness:.2});
      const iron=new T.MeshStandardMaterial({color:0x1b282b,roughness:.5,metalness:.72});
      const gold=new T.MeshStandardMaterial({color:0xb88642,emissive:0x6b4419,emissiveIntensity:.65});
      const dark=new T.MeshBasicMaterial({color:0x020708});
      const add=(x,y,z,w,h,d,mat)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);entrance.add(m);return m;};
      add(-3.1,2.7,0,1.4,5.4,1.8,stone);add(3.1,2.7,0,1.4,5.4,1.8,stone);
      add(0,5.15,0,7.6,1.1,2,stone);add(0,2.3,.87,4.8,4.6,.12,dark);
      add(-2.25,2.3,-.9,.14,4.6,.12,gold);add(2.25,2.3,-.9,.14,4.6,.12,gold);
      add(0,.035,-1.6,7.6,.07,4.5,iron);add(0,4.6,-1,4.6,.14,.1,gold);
      if(typeof document!=='undefined'){
        const c=document.createElement('canvas');c.width=768;c.height=192;
        const ctx=c.getContext('2d');
        if(ctx){ctx.fillStyle='#101f24';ctx.fillRect(0,0,768,192);ctx.strokeStyle='#b99556';ctx.lineWidth=8;ctx.strokeRect(4,4,760,184);
          ctx.textAlign='center';ctx.fillStyle='#f1d9ac';ctx.font='bold 66px sans-serif';ctx.fillText('봉쇄갱 · 흑철 심연',384,88);
          ctx.font='32px sans-serif';ctx.fillStyle='#b3d9d2';ctx.fillText('지하 도시 / 광산 철도 / 시간의 문',384,148);
          const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
          const sign=new T.Mesh(new T.PlaneGeometry(7.3,1.825),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
          sign.position.set(0,6.2,-1.02);sign.rotation.y=Math.PI;entrance.add(sign);
        }
      }
      const light=new T.PointLight(0xf5c879,22,13,2);light.position.set(0,3,-2);entrance.add(light);
      // Sparse wayfinding stones along the verified inner-courtyard approach.
      const points=[[2923,2746],[2923,2840],[2965,2840],[2965,2922]];
      for(let i=0;i<points.length-1;i++){
        const a=points[i],b=points[i+1],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
        for(let d=4;d<length;d+=12){
          const f=d/length,x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f;
          const h=options.getTerrain?.(x,z);if(!Number.isFinite(h))continue;
          add(x-ENTRY.x,h-ENTRY.h+.09,z-ENTRY.y,.55,.12,.55,gold);
        }
      }
      t3.scene.add(entrance);
    }
    function restoreVisibility() {
      if(!restoreFrame)return;
      const r=restoreFrame;restoreFrame=null;
      for(const [node,visible]of r.nodes)node.visible=visible;
      r.scene.background=r.background;r.scene.fog=r.fog;r.scene.environment=r.environment;
    }
    function render(dt,cameraObject) {
      afterRender();
      const t3=getThree(),p=player(),T=getT();if(disposed||!t3?.scene||!p||!T)return;
      const near=getState()?.mode==='open'&&Math.hypot(p.x-ENTRY.x,p.y-ENTRY.y)<ENTRANCE_RANGE;
      if(near&&!active)makeEntrance();
      if(entrance)entrance.visible=near&&!active;
      if(!inside()){setSurfaceVisible(false);for(const item of [model,pastModel,citadelModel])if(item)item.root.visible=false;return;}
      if(!ensure())return;
      setSurfaceVisible(era==='present');
      const world=currentModel(),seconds=!loading&&api()?.state==='playing'&&!getState()?.mapOpen?dt:0;
      if(model)model.root.visible=era==='present';
      if(pastModel)pastModel.root.visible=era==='past'&&area==='hayeon';
      if(citadelModel)citadelModel.root.visible=era==='past'&&area==='citadel';
      if(era==='present'){
        model.setEra('present');model.setEffectsEnabled(true);
        model.rail.setPortalActive(distance(localArray(),PORTAL)<35);
        model.update(visualTime,seconds,{progress:train.progress});
      }else {
        world.update?.(visualTime,seconds,{position:navState.position,quality:options.getQuality?.()||'medium'});renderWeaponPickups(world);
        world.animateMounts?.(visualTime,ridingId,Math.hypot(navState.velocity.x,navState.velocity.z));
        if(mounted()&&p.alive){
          const ch=t3.chars?.get(p.id);
          if(ch){for(let i=0;i<2;i++){ch.legs[i].rotation.set(i===0?.9:-.9,0,.45);ch.knees[i].rotation.z=-.9;
            ch.prem?.hips?.[i]?.quaternion.copy(ch.legs[i].quaternion);ch.prem?.knees?.[i]?.quaternion.copy(ch.knees[i].quaternion);}}
        }
      }
      const scene=t3.scene,keep=new Set([world.root]);
      const keepRoot=node=>{if(!node)return;while(node.parent&&node.parent!==scene)node=node.parent;if(node.parent===scene)keep.add(node);};
      keepRoot(t3.chars?.get(p.id)?.group);
      if(surfaceActive()){keepRoot(surfaceGroup());keepRoot(options.getSurfaceMarkGroup?.());}
      keepRoot(t3.points);keepRoot(t3.boomLight);keepRoot(t3.tracerMesh);keepRoot(t3.pastProjectileRoot);
      for(const key of ['tracerMeshes','flashSprites','fireSprites','scorchMeshes','nadeMeshes','rocketMeshes','rocketGlows','smokeSprites'])for(const node of t3[key]||[])keepRoot(node.group||node);
      const nodes=[];
      for(const node of scene.children){
        if(keep.has(node)||node.isCamera)continue;
        nodes.push([node,node.visible]);node.visible=false;
      }
      restoreFrame={scene,nodes,background:scene.background,fog:scene.fog,environment:scene.environment};
      if(!renderStyle||renderStyleT!==T){
        renderStyleT=T;renderStyle={present:{background:new T.Color(0x071215),fog:new T.Fog(0x071215,38,310)},
          past:{background:new T.Color(0xb7c8bd),fog:new T.Fog(0xb7c8bd,320,2100)}};
      }
      scene.background=renderStyle[era].background;scene.fog=renderStyle[era].fog;
      scene.environment=null;
    }
    function afterRender() {restoreVisibility();}
    function status() {
      const pos=localArray();let band=BANDS[0];
      for(const b of BANDS)if(pos[1]<=b.y+34)band=b;
      const c=era==='past'?pastWorld()?.nav.getCheckpoint(checkpoint):null;
      const inspection=era==='past'?pastWorld()?.inspection:null;
      return {inside:inside(),era,area:era==='past'?area:'hollow',position:pos,checkpoint,depth:era==='past'?null:Math.max(0,-pos[1]),
        label:inspection?'실내 관찰 · '+inspection.label:era==='past'?(area==='citadel'?'백월 대왕성 · ':'과거의 하연 · ')+(c?.label||'시공 관문'):band.label,
        detail:loading?loadingLabel():inspection?'화면의 층 선택 · E / F 또는 이동으로 닫기':era==='past'?(area==='citadel'?'M 왕궁 지도 · E / F 기록 조사 · 계단으로 층 이동':'M 지역 지도 · E / F 길잡이 표지와 귀환 시간문'):null,
        entrance:ENTRY,discovered,visited:[...visited],riding:train.riding,train:{...train},mountId:mounted()?.id||null,
        mount:mounted()?{id:mounted().id,label:mounted().label,position:mounted().position.slice(),yaw:mounted().yaw,seatOffset:mounted().seatOffset}:null,
        modelReady:!!currentModel(),pastReady:!!pastModel,citadelReady:!!citadelModel,loading,loadProgress,loadError,inspection:inspection?{...inspection}:null,
        geometry:currentModel()?.stats||null,prompt:prompt()};
    }
    function drawPastMap(c,rect={}) {
      const world=pastWorld();if(!world)return false;
      const x=rect.x||0,y=rect.y||0,w=rect.w||rect.width||200,h=rect.h||rect.height||200,mini=!!rect.mini;
      const pos=localArray(),palace=area==='citadel',insidePalace=palace&&Math.abs(pos[0])<150&&pos[2]<-108&&pos[2]>-345;
      const levels=world.layout?.floors||[],level=levels.reduce((best,row)=>pos[1]>=row.y-.8?row:best,levels[0]);
      const b=insidePalace&&!mini?{minX:-150,maxX:150,minZ:-345,maxZ:-106}:world.bounds,pad=mini?10:30,top=mini?23:66;
      const centerX=mini?pos[0]:(b.minX+b.maxX)/2,centerZ=mini?pos[2]:(b.minZ+b.maxZ)/2;
      const rangeX=mini?(insidePalace?120:420):b.maxX-b.minX,rangeZ=mini?(insidePalace?120:420):b.maxZ-b.minZ;
      const scale=Math.min((w-pad*2)/rangeX,(h-top-pad)/rangeZ);
      const mx=v=>x+w/2+(v-centerX)*scale,mz=v=>y+top+(h-top-pad)/2+(v-centerZ)*scale;
      const visible=(px,pz)=>px>=x+pad&&px<=x+w-pad&&pz>=y+top&&pz<=y+h-pad;
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.fillStyle='#102c34';c.fillRect(x,y,w,h);
      const path=points=>{c.beginPath();for(let i=0;i<points.length;i++){const q=points[i];if(i)c.lineTo(mx(q[0]),mz(q[1]));else c.moveTo(mx(q[0]),mz(q[1]));}};
      for(const shore of world.mapData?.shorelines||[]){
        if(!shore.points?.length)continue;
        path(shore.points);if(shore.closed){c.closePath();c.fillStyle='#344b42';c.fill();}
        c.strokeStyle='#6b8877';c.lineWidth=mini?1:1.4;c.stroke();
      }
      for(const road of world.mapData?.roads||[]){
        if(!road.points?.length)continue;
        path(road.points);c.strokeStyle='#987f55';c.lineWidth=clamp((road.width||5)*scale,mini?1:1.1,mini?3:4);c.stroke();
      }
      if(insidePalace){
        for(const room of world.layout?.rooms||[]){
          if(room.floor!==level?.floor)continue;
          const rx=mx(room.x-room.w/2),rz=mz(room.z-room.d/2),rw=room.w*scale,rh=room.d*scale;
          c.fillStyle=room.kind==='corridor'?'#526654':'#354c43';c.fillRect(rx,rz,rw,rh);c.strokeStyle='#aa9769';c.lineWidth=.8;c.strokeRect(rx,rz,rw,rh);
          if(!mini&&room.kind!=='corridor'&&rw>36){c.fillStyle='#d9d3b8';c.font='10px sans-serif';c.textAlign='center';c.fillText(room.name,mx(room.x),mz(room.z),rw-4);}
        }
      }
      c.textAlign='left';c.textBaseline='middle';c.font=(mini?'9':'11')+'px sans-serif';
      const labels=[];
      for(const poi of world.pois||[]){
        if(!finite3(poi.position))continue;
        if(insidePalace&&Math.abs(poi.position[1]-(level?.y||0))>8)continue;
        const px=mx(poi.position[0]),pz=mz(poi.position[2]);if(!visible(px,pz))continue;
        c.fillStyle='#d0bb89';c.beginPath();c.arc(px,pz,mini?2:3,0,Math.PI*2);c.fill();
        if(mini&&Math.hypot(pos[0]-poi.position[0],pos[2]-poi.position[2])>120)continue;
        if(labels.some(q=>Math.abs(q[0]-px)<86&&Math.abs(q[1]-pz)<15))continue;
        labels.push([px,pz]);c.fillStyle='#f0ddba';c.fillText(poi.label||poi.id,px+6,pz,mini?80:140);
      }
      for(const node of world.travelNodes||[]){
        if(!finite3(node.position))continue;
        const px=mx(node.position[0]),pz=mz(node.position[2]);if(!visible(px,pz))continue;
        c.fillStyle='#9acdbc';c.fillRect(px-2.5,pz-2.5,5,5);
      }
      if(palace)for(const marker of options.getStory?.()?.markers?.('citadel')||[]){
        if(insidePalace&&marker.floor!==level?.floor)continue;
        const px=mx(marker.position[0]),pz=mz(marker.position[2]);if(!visible(px,pz))continue;
        c.fillStyle=marker.active?'#ffe092':marker.read?'#80cdb4':'#d6a96f';c.strokeStyle='#122b2d';c.lineWidth=2;c.beginPath();c.arc(px,pz,marker.active?7:4,0,Math.PI*2);c.fill();c.stroke();
        if(!mini&&marker.active){c.textAlign='left';c.fillText('조사 목표',px+10,pz-9,100);}
      }
      const gate=world.returnPortal,px=mx(gate.position[0]),pz=mz(gate.position[2]);
      if(visible(px,pz)){
        c.strokeStyle='#8ef4e2';c.lineWidth=2;c.beginPath();c.arc(px,pz,mini?6:8,0,Math.PI*2);c.stroke();
        if(!mini){c.fillStyle='#b8fff0';c.fillText(palace?'하연성 역참으로':'현재로 돌아가는 시간문',px+12,pz-12,180);}
      }
      const ux=mx(pos[0]),uz=mz(pos[2]),yaw=getState().yaw;
      c.fillStyle='#fff2c4';c.strokeStyle='#14282c';c.lineWidth=2;c.beginPath();c.arc(ux,uz,mini?4:6,0,Math.PI*2);c.fill();c.stroke();
      c.strokeStyle='#fff2c4';c.beginPath();c.moveTo(ux,uz);c.lineTo(ux+Math.cos(yaw)*16,uz+Math.sin(yaw)*16);c.stroke();
      c.fillStyle='#10272c';c.fillRect(x,y,w,top-5);
      c.textAlign='left';c.textBaseline='top';c.fillStyle='#eed7ad';c.font='bold '+(mini?10:18)+'px sans-serif';
      c.fillText(palace?'백월 대왕성'+(insidePalace?' / '+(level?.name||'왕궁 내부'):mini?' · 주변':' / 궁성 지도'):mini?'과거의 하연 · 주변 지도':'과거의 하연  /  시대 지도',x+pad,y+(mini?6:17));
      if(!mini){c.fillStyle='#a9c5bb';c.font='12px sans-serif';c.fillText(palace?'금색: 조사 목표 · 청록: 읽은 기록 / 출구 · 계단으로 층 이동 · M 닫기':'청록 원: 현재 귀환  ·  사각 표지: 지역 이동  ·  E / F 상호작용  ·  M 닫기',x+pad,y+43,w-pad*2);}
      c.restore();return true;
    }
    function drawMap(c,rect={}) {
      if(!inside()||!ensure())return false;
      if(era==='past'){
        if(!rect.mini&&pastWorld()?.inspection)pastWorld().setInspection(null);
        return drawPastMap(c,rect);
      }
      const x=rect.x||0,y=rect.y||0,w=rect.w||rect.width||200,h=rect.h||rect.height||200,mini=!!rect.mini;
      const st=status(),pos=localArray();c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
      c.fillStyle='#081519';c.fillRect(x,y,w,h);
      const pad=mini?12:32,top=mini?24:62,usableW=w-(mini?0:Math.min(145,w*.24));
      const scale=Math.min((usableW-pad*2)/390,(h-top-pad)/360);
      const mx=v=>x+usableW/2+v*scale,mz=v=>y+top+(h-top-pad)/2+v*scale;
      if(era==='present'){
        const points=model.nav.waypoints;
        for(let i=1;i<points.length;i++){
          const a=points[i-1].position,b=points[i].position,near=Math.abs((a[1]+b[1])/2-pos[1])<60;
          if(mini&&!near)continue;
          c.strokeStyle=near?'#e2b975':'#284044';c.globalAlpha=near?1:.58;c.lineWidth=near?3:1.4;
          c.beginPath();c.moveTo(mx(a[0]),mz(a[2]));c.lineTo(mx(b[0]),mz(b[2]));c.stroke();
        }
        c.globalAlpha=1;
        for(const q of model.nav.checkpoints){
          if(q.era!=='present'||Math.abs(q.position[1]-pos[1])>65)continue;
          c.fillStyle=visited.has(q.id)?'#8ed3c6':'#8e9a97';c.beginPath();c.arc(mx(q.position[0]),mz(q.position[2]),mini?2.5:4,0,Math.PI*2);c.fill();
        }
      }
      c.globalAlpha=1;c.fillStyle='#f7e6bf';c.strokeStyle='#132429';c.lineWidth=2;
      c.beginPath();c.arc(mx(pos[0]),mz(pos[2]),mini?4:6,0,Math.PI*2);c.fill();c.stroke();
      const yaw=getState().yaw;c.strokeStyle='#f7e6bf';c.beginPath();c.moveTo(mx(pos[0]),mz(pos[2]));c.lineTo(mx(pos[0])-Math.cos(yaw)*14,mz(pos[2])-Math.sin(yaw)*14);c.stroke();
      c.textAlign='left';c.textBaseline='top';c.fillStyle='#e5d5b5';c.font='bold '+(mini?10:18)+'px sans-serif';
      c.fillText(mini?Math.round(st.depth)+'m · '+st.label:'흑철 심연  /  '+st.label,x+pad,y+(mini?6:18));
      if(!mini){
        c.fillStyle='#90aca8';c.font='12px sans-serif';c.fillText('계단으로 전 층 왕복 · 역에서 E / F 탑승 · M 닫기',x+pad,y+43);
        const rx=x+usableW+22,ry=y+90,dh=h-140;
        c.strokeStyle='#355452';c.lineWidth=2;c.beginPath();c.moveTo(rx,ry);c.lineTo(rx,ry+dh);c.stroke();
        c.font='11px sans-serif';
        for(const band of BANDS){const yy=ry+-band.y/620*dh;c.fillStyle='#c2b18e';c.beginPath();c.arc(rx,yy,3,0,Math.PI*2);c.fill();c.fillText(band.label.split(' · ')[0],rx+9,yy-5);}
        c.fillStyle='#8ce0d3';c.beginPath();c.arc(rx,ry+clamp(st.depth/620,0,1)*dh,6,0,Math.PI*2);c.fill();
      }
      c.restore();return true;
    }
    function disposeEntrance() {
      if(!entrance)return;
      entrance.removeFromParent();const resources=new Set();
      entrance.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});
      resources.forEach(r=>r.dispose());entrance=null;
    }
    function disposeModel() {
      afterRender();savedPosition=localArray();
      mountState();
      ++loadToken;loading=false;loadPromise=null;loadProgress=0;
      unbindSurfaceModel();
      model?.dispose();pastModel?.dispose();citadelModel?.dispose();model=null;pastModel=null;citadelModel=null;navState=null;disposeEntrance();
    }
    function dispose() {if(disposed)return;disposeModel();surfaceRuntime?.resetRegion?.(SURFACE_REGION);surfaceDamage.clear();disposed=true;active=false;}
    return {install,dispose,disposeModel,inside,base,move,vertical,resolve,jump,interact,prompt,
      tick,render,afterRender,serialize,camera,solid,volume,ground,contains,status,respawn,drawMap,
      surfaceActive,damageSurfaces,getSurfaceOwner,surfaceHitBounds,projectSurfaceImpact,setSurfaceVisible,surfaceGroup,
      inspectionActive:()=>inside()&&(!!options.isStoryOpen?.()||era==='past'&&!!pastWorld()?.inspection),
      blocksCombat:()=>inside()&&(loading||options.isStoryOpen?.()||era==='past'&&!!pastWorld()?.inspection),
      whenReady:()=>loadPromise||Promise.resolve(era==='past'&&!!pastWorld())};
  }
  host.HanQHollow=Object.freeze({version:VERSION,entrance:ENTRY,create});
})(typeof window!=='undefined'?window:globalThis);
