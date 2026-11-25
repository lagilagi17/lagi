/* Exact Hayeon geometry navigation. Native metres, Y up.
 * Two broadphases: 64m instance buckets, then 3m local template triangle buckets.
 * Repeated buildings share collision data; no frame scans the whole world.
 * Ground follows actual floor/stair triangles and authored terrain heightAt.
 */
(function(global){'use strict';
  const EPS=1e-6, WORLD_CELL=64;
  global.HanQPastNavigation={create:function(T){
    const templates=new Map(),instances=[],worldGrid=new Map(),pending=new WeakMap();
    let terrain=null,querySerial=0,disposed=false;
    const stats={templates:0,instances:0,triangles:0,solidBoxes:0,queries:0,candidates:0,triangleTests:0,maxQueryCandidates:0,maxQueryTriangles:0};
    const constants={radius:.42,height:1.8,walkSpeed:5.4,runSpeed:7.4,gravity:22,jumpSpeed:7.1,maxStep:.65};
    const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),p0=new T.Vector3(),p1=new T.Vector3(),closest=new T.Vector3(),segPoint=new T.Vector3(),triPoint=new T.Vector3();
    const triangle=new T.Triangle(),ray=new T.Ray(),normal=new T.Vector3(),u=new T.Vector3(),v=new T.Vector3(),w=new T.Vector3();
    const tmp=new T.Vector3(),tmp2=new T.Vector3(),local=new T.Vector3();
    const gridKey=(x,z)=>x+','+z;
    function put(grid,cell,minX,minZ,maxX,maxZ,value){
      for(let ix=Math.floor(minX/cell);ix<=Math.floor(maxX/cell);ix++)for(let iz=Math.floor(minZ/cell);iz<=Math.floor(maxZ/cell);iz++){
        const key=gridKey(ix,iz);let list=grid.get(key);if(!list)grid.set(key,list=[]);list.push(value);
      }
    }
    function makeTemplate(group,key,cell=3,skipOwned=false){
      group.updateMatrixWorld(true);
      const inverse=group.matrixWorld.clone().invert(),vertices=[],boxes=[],apertures=[];
      function visit(o,excluded){
        if(o!==group&&(skipOwned&&o.userData.pastNavOwned||o.userData.detailEnhancement||o.userData.label))return;
        if(o.userData.opening?.kind==='door'){
          const q=o.userData.opening,m=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld),center=new T.Vector3(q.center[0],q.bottom,0).applyMatrix4(m),top=new T.Vector3(q.center[0],q.bottom+q.height-.065,0).applyMatrix4(m);
          apertures.push({center:center.toArray(),top:top.y,width:q.clearWidth,height:top.y-center.y});
        }
        if(o.isMesh&&!o.userData.label){
          const geo=o.geometry,pos=geo&&geo.attributes.position;
          const mat=Array.isArray(o.material)?o.material[0]:o.material;
          if(pos&&!(mat&&mat.map&&mat.transparent)){
            const base=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld),ix=geo.index,matrices=[];
            if(o.isInstancedMesh){for(let i=0;i<o.count;i++){const im=new T.Matrix4();o.getMatrixAt(i,im);matrices.push(base.clone().multiply(im));}}else matrices.push(base);
            for(const m of matrices){
            for(let i=0;i<(ix?ix.count:pos.count);i+=3){
              a.fromBufferAttribute(pos,ix?ix.getX(i):i).applyMatrix4(m);
              b.fromBufferAttribute(pos,ix?ix.getX(i+1):i+1).applyMatrix4(m);
              c.fromBufferAttribute(pos,ix?ix.getX(i+2):i+2).applyMatrix4(m);
              u.subVectors(b,a);v.subVectors(c,a);normal.crossVectors(u,v);
              if(normal.lengthSq()<1e-14)continue;
              vertices.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
            }
            const sourceBoxes=geo.userData.pastBoxes||[];
            if(geo.type==='BoxGeometry'){
              geo.computeBoundingBox();
              const bm=m.clone(),bb=geo.boundingBox.clone().applyMatrix4(bm);
              boxes.push({matrix:bm.clone(),inverse:bm.invert(),min:geo.boundingBox.min.clone(),max:geo.boundingBox.max.clone(),bounds:bb});
            }
            for(const q of sourceBoxes){
              const bm=m.clone().multiply(new T.Matrix4().fromArray(q.matrix)),bb=new T.Box3(new T.Vector3().fromArray(q.min),new T.Vector3().fromArray(q.max)).applyMatrix4(bm);
              boxes.push({matrix:bm.clone(),inverse:bm.invert(),min:new T.Vector3().fromArray(q.min),max:new T.Vector3().fromArray(q.max),bounds:bb});
            }
            }
          }
        }
        for(const child of o.children)visit(child,excluded);
      }
      visit(group,false);
      const verts=new Float64Array(vertices),count=verts.length/9,grid=new Map(),boxGrid=new Map(),ny=new Float32Array(count),mins=new Float64Array(count),maxs=new Float64Array(count),marks=new Uint32Array(count),boxMarks=new Uint32Array(boxes.length);
      const bounds=new T.Box3();
      for(let n=0;n<count;n++){
        const i=n*9; a.fromArray(verts,i);b.fromArray(verts,i+3);c.fromArray(verts,i+6);
        bounds.expandByPoint(a);bounds.expandByPoint(b);bounds.expandByPoint(c);
        normal.crossVectors(u.subVectors(b,a),v.subVectors(c,a)).normalize();ny[n]=normal.y;
        mins[n]=Math.min(a.y,b.y,c.y);maxs[n]=Math.max(a.y,b.y,c.y);
        put(grid,cell,Math.min(a.x,b.x,c.x),Math.min(a.z,b.z,c.z),Math.max(a.x,b.x,c.x),Math.max(a.z,b.z,c.z),n);
      }
      boxes.forEach((q,n)=>put(boxGrid,cell,q.bounds.min.x,q.bounds.min.z,q.bounds.max.x,q.bounds.max.z,n));
      for(const [key,list]of grid)grid.set(key,new Uint32Array(list));
      for(const [key,list]of boxGrid)boxGrid.set(key,new Uint32Array(list));
      const result={key,verts,grid,boxGrid,boxes,cell,ny,mins,maxs,marks,boxMarks,bounds,count,apertures,detail:group.userData.detail?JSON.parse(JSON.stringify(group.userData.detail)):null};
      templates.set(key,result);stats.templates++;stats.triangles+=count;stats.solidBoxes+=boxes.length;
      return result;
    }
    function capture(group,spec){
      const key=spec.assetId+'|'+(spec.pruneBoat?1:0)+(spec.kind==='life-prop'?'|'+spec.id:'');
      if(!templates.has(key)){const template=makeTemplate(group,key);if(spec.structural)template.viewRoot=group.clone(true);}
      group.userData.pastNavOwned=true;pending.set(group,key);
    }
    function addInstance(template,matrix,record){
      if(!template||!template.count)return;
      const bounds=template.bounds.clone().applyMatrix4(matrix),scale=new T.Vector3(),pos=new T.Vector3(),q=new T.Quaternion();
      matrix.decompose(pos,q,scale);
      const item={id:record.id,template,matrix:matrix.clone(),inverse:matrix.clone().invert(),bounds,scale,position:pos,record,_seen:0};
      instances.push(item);put(worldGrid,WORLD_CELL,bounds.min.x,bounds.min.z,bounds.max.x,bounds.max.z,item);stats.instances=instances.length;
      return item;
    }
    function place(group,record){
      const key=pending.get(group);if(!key)return;
      group.updateMatrixWorld(true);addInstance(templates.get(key),group.matrixWorld,record);
    }
    function captureExtras(root,groups){
      root.updateMatrixWorld(true);
      for(const key of ['roads','buildings','ships']){
        const group=groups[key];if(!group)continue;
        const t=makeTemplate(group,'world-extras-'+key,16,true);
        addInstance(t,group.matrixWorld,{id:'past-'+key});
      }
    }
    function addObject(group,id){
      group.updateMatrixWorld(true);const t=makeTemplate(group,id,3);return addInstance(t,group.matrixWorld,{id});
    }
    function eachInstance(x,z,r,fn){
      const mark=(++querySerial)>>>0||(++querySerial),near=[];
      for(let ix=Math.floor((x-r)/WORLD_CELL);ix<=Math.floor((x+r)/WORLD_CELL);ix++)for(let iz=Math.floor((z-r)/WORLD_CELL);iz<=Math.floor((z+r)/WORLD_CELL);iz++)for(const item of worldGrid.get(gridKey(ix,iz))||[]){
        if(item._seen===mark)continue;item._seen=mark;
        if(x+r<item.bounds.min.x||x-r>item.bounds.max.x||z+r<item.bounds.min.z||z-r>item.bounds.max.z)continue;
        near.push(item);
      }
      stats.queries++;stats.candidates+=near.length;stats.maxQueryCandidates=Math.max(stats.maxQueryCandidates,near.length);
      for(const item of near)if(fn(item)===false)return false;
      return true;
    }
    function eachTriangle(item,x,z,r,minY,maxY,fn){
      const t=item.template;
      local.set(x,(minY+maxY)*.5,z).applyMatrix4(item.inverse);
      const lx=local.x,lz=local.z,lr=r/Math.max(.0001,Math.min(Math.abs(item.scale.x),Math.abs(item.scale.z)));
      const low=(minY-item.position.y)/item.scale.y,high=(maxY-item.position.y)/item.scale.y,mark=(++querySerial)>>>0||(++querySerial);
      let tested=0;
      for(let ix=Math.floor((lx-lr)/t.cell);ix<=Math.floor((lx+lr)/t.cell);ix++)for(let iz=Math.floor((lz-lr)/t.cell);iz<=Math.floor((lz+lr)/t.cell);iz++)for(const n of t.grid.get(gridKey(ix,iz))||[]){
        if(t.marks[n]===mark)continue;t.marks[n]=mark;
        if(t.maxs[n]<low-EPS||t.mins[n]>high+EPS)continue;
        tested++;if(fn(t,n,lx,lz)===false){stats.triangleTests+=tested;stats.maxQueryTriangles=Math.max(stats.maxQueryTriangles,tested);return false;}
      }
      stats.triangleTests+=tested;stats.maxQueryTriangles=Math.max(stats.maxQueryTriangles,tested);return true;
    }
    function worldTriangle(item,t,n){const i=n*9;a.fromArray(t.verts,i).applyMatrix4(item.matrix);b.fromArray(t.verts,i+3).applyMatrix4(item.matrix);c.fromArray(t.verts,i+6).applyMatrix4(item.matrix);}
    function baryHeight(t,n,x,z){
      const i=n*9,V=t.verts,ax=V[i],az=V[i+2],bx=V[i+3],bz=V[i+5],cx=V[i+6],cz=V[i+8];
      const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-12)return null;
      const wa=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,wb=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den;
      if(wa<-.00001||wb<-.00001||wa+wb>1.00001)return null;
      return wa*V[i+1]+wb*V[i+4]+(1-wa-wb)*V[i+7];
    }
    function diskHeight(t,n,x,z,r,item){
      const centre=baryHeight(t,n,x,z);if(centre!==null||r<=0)return centre;
      const i=n*9,V=t.verts,sx2=item.scale.x**2,sz2=item.scale.z**2;let best=Infinity,height=null;
      for(const [aa,bb]of [[i,i+3],[i+3,i+6],[i+6,i]]){
        const dx=V[bb]-V[aa],dz=V[bb+2]-V[aa+2],den=dx*dx*sx2+dz*dz*sz2;
        const f=den?Math.max(0,Math.min(1,((x-V[aa])*dx*sx2+(z-V[aa+2])*dz*sz2)/den)):0;
        const ex=V[aa]+dx*f-x,ez=V[aa+2]+dz*f-z,d=ex*ex*sx2+ez*ez*sz2;
        if(d<best&&d<=(r+.018)**2){best=d;height=V[aa+1]+(V[bb+1]-V[aa+1])*f;}
      }
      return height;
    }
    function sampleGround(x,z,referenceY=Infinity,maxStep=constants.maxStep,footRadius=0){
      const ceiling=Number.isFinite(referenceY)?referenceY+maxStep:1000;
      let best=null,ground=terrain?terrain.heightAt(x,z):-25;
      if(Number.isFinite(ground)&&ground<=ceiling+.001&&ground>=-.3)best={height:ground,id:'past-terrain',type:'terrain'};
      eachInstance(x,z,footRadius,item=>{
        if(item.bounds.min.y>ceiling+.001||best&&item.bounds.max.y<=best.height)return;
        eachTriangle(item,x,z,footRadius,-30,ceiling+.001,(t,n,lx,lz)=>{
          if(t.ny[n]<.35)return;
          {
            const ly=diskHeight(t,n,lx,lz,footRadius,item);if(ly===null)return;
            const y=ly*item.scale.y+item.position.y;
            if(y<=ceiling+.002&&(!best||y>best.height))best={height:y,id:item.id,type:'mesh',instance:item};
          }
        });
      });
      return best;
    }
    function groundAt(x,z,referenceY=Infinity,maxStep=constants.maxStep){const q=sampleGround(x,z,referenceY,maxStep);return q?q.height:null;}
    const fixtures={entrances:[],stairs:[],ladders:[]},stairGrid=new Map();
    function makeFixtures(world){
      const records=new Map(world.interiorIndex.map(r=>[r.id,r]));
      for(const item of instances){
        const record=records.get(item.id),detail=item.template.detail;if(!record||!detail)continue;
        const transform=p=>new T.Vector3().fromArray(p).applyMatrix4(item.matrix).toArray();
        const e=record.sourceId==='watchtower'?[0,.12,2.3]:detail.entrance||[0,0,0],side=record.sourceId==='market-stall'?[-1,0,0]:record.sourceId==='grain-store'?[-1,0,0]:record.assetId==='life-stall'?[0,0,-1]:[0,0,1];
        const outside=transform([e[0]+side[0]*1.8,e[1],e[2]+side[2]*1.8]),inside=transform([e[0]-side[0]*1.1,e[1],e[2]-side[2]*1.1]);
        const position=transform(e);
        for(const p of [outside,inside,position]){const support=sampleGround(p[0],p[2],p[1],.75,constants.radius);if(support&&Math.abs(support.height-p[1])<2)p[1]=support.height;}
        let aperture=null,nearest=Infinity;
        for(const q of item.template.apertures){const d=Math.hypot(q.center[0]-e[0],q.center[2]-e[2])+Math.abs(q.center[1]-e[1])*.3;if(d<nearest){nearest=d;aperture=q;}}
        if(!aperture&&detail.portals?.length){const q=detail.portals.reduce((best,q)=>Math.hypot(q.center[0]-e[0],q.center[2]-e[2])<Math.hypot(best.center[0]-e[0],best.center[2]-e[2])?q:best);aperture={width:q.width,top:q.center[1]+q.height,height:q.height};}
        const clearance=aperture?{width:aperture.width*Math.min(item.scale.x,item.scale.z),height:aperture.top*item.scale.y+item.position.y-position[1],capsuleHeight:constants.height,capsuleDiameter:constants.radius*2}:null;
        const limited=clearance?(clearance.width<constants.radius*2+.015||clearance.height<constants.height+.015):Math.min(...record.scale)<.6;
        let path=[outside,position,inside];
        if(record.sourceId==='watchtower')path=[transform([1.5,.12,4.8]),transform([1.5,.12,2.95]),transform([0,.12,2.95]),position,inside];
        fixtures.entrances.push({id:record.id,assetId:record.assetId,position,outside:path[0],inside,path,scaleLimited:limited,clearance,accessKind:record.sourceId==='watchtower'?'ladder':'door',scale:record.scale.slice()});
        const stairs=(detail.circulation||[]).filter(s=>s.type==='stair'&&s.position&&s.arrival).map(s=>({start:s.position,end:s.arrival,landing:s.landing,steps:s.steps,rise:s.rise,width:s.width,subtype:s.subtype,geometry:s.geometry,routeAfterArrival:s.routeAfterArrival}));
        for(const s of detail.stairs||[])if(s.start&&s.end)stairs.push(s);
        for(let i=0;i<stairs.length;i++){
          const s=stairs[i],start=transform(s.start),end=transform(s.end),points=[start];
          for(let n=1;n<=(s.steps||12);n++){const k=n/(s.steps||12);points.push(start.map((p,j)=>p+(end[j]-p)*k));}
          if(s.landing)points.push(transform(s.landing));for(const p of s.routeAfterArrival||[])points.push(transform(p));
          const row={id:record.id+'-stair-'+i,assetId:record.assetId,instanceId:record.id,points,runStart:start.slice(),runEnd:end.slice(),width:(s.width||s.clearWidth||1.2)*Math.min(item.scale.x,item.scale.z),rise:(s.rise||0)*item.scale.y,scaleLimited:limited,subtype:s.subtype,geometry:s.geometry||s.name};
          if(s.subtype==='ladder')fixtures.ladders.push(row);else{
            for(const point of points){const support=sampleGround(point[0],point[2],point[1],Math.max(constants.maxStep,row.rise+.06),constants.radius);if(support&&Math.abs(support.height-point[1])<1.5)point[1]=support.height;}
            fixtures.stairs.push(row);const radius=row.width/2+constants.radius;put(stairGrid,WORLD_CELL,Math.min(start[0],end[0])-radius,Math.min(start[2],end[2])-radius,Math.max(start[0],end[0])+radius,Math.max(start[2],end[2])+radius,row);
          }
        }
      }
      return fixtures;
    }
    function stepHeightAt(x,y,z){
      let height=constants.maxStep;
      // Explicit authored stairs can have taller treads when the original map
      // scaled a gate; only their narrow physical run gets that step allowance.
      for(const s of stairGrid.get(gridKey(Math.floor(x/WORLD_CELL),Math.floor(z/WORLD_CELL)))||[]){
        if(s.rise<=height)continue;const a=s.runStart,b=s.runEnd;if(y<Math.min(a[1],b[1])-1||y>Math.max(a[1],b[1])+.7)continue;
        const dx=b[0]-a[0],dz=b[2]-a[2],den=dx*dx+dz*dz,q=den?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/den)):0;
        if(Math.hypot(x-a[0]-dx*q,z-a[2]-dz*q)<s.width/2+constants.radius)height=Math.max(height,s.rise+.055);
      }
      return height;
    }
    function pointInBox(item,x,y,z,r){
      const t=item.template;local.set(x,y,z).applyMatrix4(item.inverse);
      const lx=local.x,ly=local.y,lz=local.z,lr=r/Math.max(.001,Math.min(...item.scale.toArray().map(Math.abs))),mark=(++querySerial)>>>0||(++querySerial);
      for(let ix=Math.floor((lx-lr)/t.cell);ix<=Math.floor((lx+lr)/t.cell);ix++)for(let iz=Math.floor((lz-lr)/t.cell);iz<=Math.floor((lz+lr)/t.cell);iz++)for(const n of t.boxGrid.get(gridKey(ix,iz))||[]){
        if(t.boxMarks[n]===mark)continue;t.boxMarks[n]=mark;
        const box=t.boxes[n];if(ly<box.bounds.min.y-lr||ly>box.bounds.max.y+lr)continue;
        tmp.set(lx,ly,lz).applyMatrix4(box.inverse);
        const e=box.inverse.elements,ex=lr*Math.hypot(e[0],e[4],e[8]),ey=lr*Math.hypot(e[1],e[5],e[9]),ez=lr*Math.hypot(e[2],e[6],e[10]);
        if(tmp.x>=box.min.x-ex&&tmp.x<=box.max.x+ex&&tmp.y>=box.min.y-ey&&tmp.y<=box.max.y+ey&&tmp.z>=box.min.z-ez&&tmp.z<=box.max.z+ez){
          tmp.clamp(box.min,box.max).applyMatrix4(box.matrix).applyMatrix4(item.matrix);
          if((tmp.x-x)**2+(tmp.y-y)**2+(tmp.z-z)**2>r*r+1e-10)continue;
          return {id:item.id,minY:box.bounds.min.y*item.scale.y+item.position.y,maxY:box.bounds.max.y*item.scale.y+item.position.y,type:'box'};
        }
      }
      return null;
    }
    function pointSolid(x,y,z,r=0){
      if(![x,y,z].every(Number.isFinite))return null;
      r=Math.max(0,Number(r)||0);let hit=null;
      eachInstance(x,z,r,item=>{
        if(y+r<item.bounds.min.y||y-r>item.bounds.max.y)return;
        hit=pointInBox(item,x,y,z,r);if(hit)return false;
        eachTriangle(item,x,z,r,y-r-.002,y+r+.002,(t,n)=>{
          worldTriangle(item,t,n);triangle.set(a,b,c);tmp.set(x,y,z);triangle.closestPointToPoint(tmp,closest);
          if(closest.distanceToSquared(tmp)>(r+.002)**2)return;
          hit={id:item.id,minY:Math.min(a.y,b.y,c.y),maxY:Math.max(a.y,b.y,c.y),type:'triangle'};return false;
        });
        if(hit)return false;
      });
      if(hit)return hit;
      const y0=terrain?terrain.heightAt(x,z):-25;
      if(y0>=0&&y-r<=y0&&y+r>=y0-.5)return {id:'past-terrain',minY:y0-.5,maxY:y0,heightAt:()=>y0,type:'terrain'};
      return null;
    }
    // Closest points between two finite segments. No allocations per triangle.
    function closestSegments(p,q,r,s,outP,outQ){
      const ux=q.x-p.x,uy=q.y-p.y,uz=q.z-p.z,vx=s.x-r.x,vy=s.y-r.y,vz=s.z-r.z,wx=p.x-r.x,wy=p.y-r.y,wz=p.z-r.z;
      const aa=ux*ux+uy*uy+uz*uz,bb=ux*vx+uy*vy+uz*vz,cc=vx*vx+vy*vy+vz*vz,dd=ux*wx+uy*wy+uz*wz,ee=vx*wx+vy*wy+vz*wz,den=aa*cc-bb*bb;
      let sn=den<1e-12?0:(bb*ee-cc*dd)/den;sn=Math.max(0,Math.min(1,sn));
      let tn=cc>1e-12?(bb*sn+ee)/cc:0;
      if(tn<0){tn=0;sn=aa>1e-12?Math.max(0,Math.min(1,-dd/aa)):0;}else if(tn>1){tn=1;sn=aa>1e-12?Math.max(0,Math.min(1,(bb-dd)/aa)):0;}
      outP.set(p.x+ux*sn,p.y+uy*sn,p.z+uz*sn);outQ.set(r.x+vx*tn,r.y+vy*tn,r.z+vz*tn);
      return outP.distanceToSquared(outQ);
    }
    function capsuleTriangleDistance(){
      triangle.set(a,b,c);let best=Infinity;
      // Plane intersection handles the middle of a large wall face.
      tmp2.subVectors(p1,p0);const length=tmp2.length();ray.set(p0,tmp2.multiplyScalar(1/(length||1)));
      const intersection=ray.intersectTriangle(a,b,c,false,closest);
      if(intersection&&closest.distanceToSquared(p0)<=length*length+1e-9){segPoint.copy(closest);triPoint.copy(closest);return 0;}
      for(const end of [p0,p1]){triangle.closestPointToPoint(end,closest);const d=closest.distanceToSquared(end);if(d<best){best=d;segPoint.copy(end);triPoint.copy(closest);}}
      for(const edge of [[a,b],[b,c],[c,a]]){const d=closestSegments(p0,p1,edge[0],edge[1],tmp,tmp2);if(d<best){best=d;segPoint.copy(tmp);triPoint.copy(tmp2);}}
      return best;
    }
    function resolveWalls(p,velocity){
      const r=constants.radius,height=constants.height;
      for(let pass=0;pass<3;pass++){
        let moved=false;
        eachInstance(p.x,p.z,r+.08,item=>{
          if(item.bounds.max.y<=p.y+.06||item.bounds.min.y>=p.y+height)return;
          eachTriangle(item,p.x,p.z,r+.08,p.y+.06,p.y+height-.025,(t,n)=>{
            if(Math.abs(t.ny[n])>.72)return;
            worldTriangle(item,t,n);
            if(Math.max(a.y,b.y,c.y)<=p.y+.065)return;
            p0.set(p.x,p.y+r,p.z);p1.set(p.x,p.y+height-r,p.z);
            const distance2=capsuleTriangleDistance();if(distance2>=r*r)return;
            let nx=segPoint.x-triPoint.x,nz=segPoint.z-triPoint.z,flat=Math.hypot(nx,nz),distance=Math.sqrt(distance2);
            if(flat<1e-7){normal.crossVectors(u.subVectors(b,a),v.subVectors(c,a)).normalize();nx=normal.x;nz=normal.z;flat=Math.hypot(nx,nz);if(flat<.01)return;if(nx*velocity.x+nz*velocity.z>0){nx=-nx;nz=-nz;}}
            const vertical=segPoint.y-triPoint.y,actualFlat=Math.hypot(segPoint.x-triPoint.x,segPoint.z-triPoint.z);
            nx/=flat;nz/=flat;const push=Math.min(.7,Math.sqrt(Math.max(0,r*r-vertical*vertical))-actualFlat+.001);
            if(typeof stats.onContact==='function')stats.onContact({id:item.id,triangle:n,position:p.toArray(),vertices:[a.toArray(),b.toArray(),c.toArray()],distance,ny:t.ny[n],push});
            p.x+=nx*push;p.z+=nz*push;const dot=velocity.x*nx+velocity.z*nz;if(dot<0){velocity.x-=dot*nx;velocity.z-=dot*nz;}moved=true;
          });
        });
        if(!moved)break;
      }
    }
    function ceilingAt(x,z,oldTop,newTop){
      let hit=Infinity;
      eachInstance(x,z,constants.radius,item=>{
        eachTriangle(item,x,z,constants.radius,oldTop-.025,newTop+.025,(t,n)=>{
          if(t.ny[n]>-.35)return;
          local.set(x,0,z).applyMatrix4(item.inverse);const ly=baryHeight(t,n,local.x,local.z);if(ly===null)return;
          const y=ly*item.scale.y+item.position.y;if(y>=oldTop-.025&&y<=newTop+.025)hit=Math.min(hit,y);
        });
      });return hit;
    }
    function bodyClear(x,y,z,r=constants.radius,height=constants.height){
      if(![x,y,z,r,height].every(Number.isFinite))return false;
      // Terrain is a closed support volume, even while the actor is airborne.
      // Mesh-only clearance accepted legacy saves with their feet underground.
      const terrainY=terrain?terrain.heightAt(x,z):-25;
      if(terrainY>=0&&terrainY>y+.025)return false;
      let clear=true;
      eachInstance(x,z,r,item=>{
        if(item.bounds.max.y<=y+.025||item.bounds.min.y>=y+height)return;
        if(pointInBox(item,x,y+height*.5,z,Math.min(r,.3))){clear=false;return false;}
        eachTriangle(item,x,z,r,y+.025,y+height,(t,n)=>{
          worldTriangle(item,t,n);if(Math.max(a.y,b.y,c.y)<=y+.025)return;
          p0.set(x,y+r,z);p1.set(x,y+height-r,z);
          if(capsuleTriangleDistance()<(r-.004)**2){clear=false;return false;}
        });
        if(!clear)return false;
      });return clear;
    }
    function headClear(x,y,z){
      const ceiling=ceilingAt(x,z,y+.1,y+constants.height-.015);return !Number.isFinite(ceiling);
    }
    const checkpoints=[],waypoints=[];
    function teleport(state,value){
      const cp=typeof value==='string'?checkpoints.find(q=>q.id===value):value;if(!cp||!Array.isArray(cp.position))return false;
      state.position=state.position||new T.Vector3();state.velocity=state.velocity||new T.Vector3();
      state.position.fromArray(cp.position);state.velocity.set(0,0,0);state.grounded=true;state.safePosition=state.position.clone();state.fallStartY=state.position.y;state.fallDistance=0;state.needsRespawn=false;state._jumpHeld=false;state.era='past';state.waterRescue=false;state.checkpointId=cp.id||state.checkpointId;
      return true;
    }
    function step(state,input={},dt=1/60){
      if(disposed)throw Error('Past navigation disposed');
      if(Number.isFinite(dt)&&dt<=0)return state;
      state.position=state.position||new T.Vector3();state.velocity=state.velocity||new T.Vector3();const p=state.position,vel=state.velocity;
      state.waterRescue=false;state.landedSpeed=0;
      const movement=input.worldVelocity||input.move||{x:0,z:0};let mx=Number(movement.x)||0,mz=Number(movement.z)||0;
      const mag=Math.hypot(mx,mz),speed=input.worldVelocity?1:(Number.isFinite(input.speed)?input.speed:input.run?constants.runSpeed:constants.walkSpeed)*(Number.isFinite(input.speedScale)?input.speedScale:1);
      if(!input.worldVelocity&&mag>1){mx/=mag;mz/=mag;}
      const jump=!!input.jump&&!state._jumpHeld;state._jumpHeld=!!input.jump;
      if(jump&&state.grounded){vel.y=constants.jumpSpeed;state.grounded=false;}
      const elapsed=Math.max(0,Math.min(.12,Number.isFinite(dt)?dt:1/60)),count=Math.max(1,Math.ceil(elapsed/(1/90))),h=elapsed/count;
      for(let n=0;n<count;n++){
        const wasGrounded=!!state.grounded,oldY=p.y,oldX=p.x,oldZ=p.z,blend=1-Math.exp(-(wasGrounded?18:6)*h);
        vel.x+=(mx*speed-vel.x)*blend;vel.z+=(mz*speed-vel.z)*blend;
        p.x+=vel.x*h;p.z+=vel.z*h;
        const stepHeight=stepHeightAt(p.x,oldY,p.z),drop=Math.max(.8,stepHeight+.12);
        let ground=sampleGround(p.x,p.z,oldY,stepHeight,constants.radius);
        // A cliff is not a stair. Reject horizontal ascent if terrain exceeds
        // the step height; the source terrain is never flattened for gameplay.
        const th=terrain?terrain.heightAt(p.x,p.z):-25;
        const airborneY=oldY+(vel.y-constants.gravity*h)*h;
        if(th>=0&&(wasGrounded?th>oldY+constants.maxStep+.01:th>Math.max(oldY,airborneY)+.025)){
          p.x=oldX;p.z=oldZ;vel.x=vel.z=0;ground=sampleGround(p.x,p.z,oldY,constants.maxStep,constants.radius);
        }
        if(wasGrounded&&vel.y<=0&&ground&&ground.height>=oldY-drop){p.y=ground.height;vel.y=0;}
        resolveWalls(p,vel);
        // Sideways entry under a low ceiling is as solid as jumping into it.
        // Only actual downward-facing floor/roof triangles restrict headroom.
        if(!headClear(p.x,p.y,p.z)&&headClear(oldX,oldY,oldZ)){p.x=oldX;p.y=oldY;p.z=oldZ;vel.x=vel.z=0;}
        ground=sampleGround(p.x,p.z,oldY,stepHeight,constants.radius);
        if(wasGrounded&&vel.y<=0&&ground&&ground.height>=oldY-drop){p.y=ground.height;vel.y=0;state.grounded=true;state.floorId=ground.id;}
        else{
          state.grounded=false;vel.y-=constants.gravity*h;let nextY=oldY+vel.y*h;
          if(vel.y>0){const roof=ceilingAt(p.x,p.z,oldY+constants.height,nextY+constants.height);if(Number.isFinite(roof)){nextY=roof-constants.height-.025;vel.y=0;}}
          const below=sampleGround(p.x,p.z,oldY,.08,constants.radius);
          if(vel.y<=0&&below&&nextY<=below.height&&oldY>=below.height-.1){state.landedSpeed=Math.max(state.landedSpeed,-vel.y);p.y=below.height;vel.y=0;state.grounded=true;state.floorId=below.id;}else p.y=nextY;
        }
        // Wall resolution or the descending half of a jump can move the feet
        // below a steep heightfield after the first horizontal terrain check.
        // Keep the vertical arc but reject that horizontal approach; never let
        // the reference-height cutoff turn the uphill ground into empty space.
        const finalTerrain=terrain?terrain.heightAt(p.x,p.z):-25;
        const oldTerrain=terrain?terrain.heightAt(oldX,oldZ):-25;
        if(finalTerrain>=0&&finalTerrain>p.y+.025&&oldTerrain<=oldY+.025){
          p.x=oldX;p.z=oldZ;vel.x=vel.z=0;
          const support=sampleGround(p.x,p.z,oldY,.08,constants.radius);
          if(vel.y<=0&&support&&p.y<=support.height&&oldY>=support.height-.1){
            state.landedSpeed=Math.max(state.landedSpeed,-vel.y);p.y=support.height;vel.y=0;state.grounded=true;state.floorId=support.id;
          }else if(oldTerrain>p.y){p.y=oldY;vel.y=0;state.grounded=false;}
        }
        if(state.grounded){state.safePosition=state.safePosition||new T.Vector3();state.safePosition.copy(p);state.fallStartY=p.y;state.fallDistance=0;}
        else{if(!Number.isFinite(state.fallStartY))state.fallStartY=oldY;state.fallDistance=Math.max(0,state.fallStartY-p.y);}
        if(p.y<-.8&&(!terrain||terrain.heightAt(p.x,p.z)<.1)){
          const fallback=state.safePosition&&state.safePosition.y>.1?state.safePosition.toArray():(checkpoints.find(q=>q.id===state.checkpointId)||checkpoints[0])?.position;
          if(fallback){p.fromArray(fallback);vel.set(0,0,0);state.grounded=true;state.waterRescue=true;state.fallDistance=0;state.fallStartY=p.y;break;}
        }
      }
      state.speed=Math.hypot(vel.x,vel.z);state.era='past';state.needsRespawn=![p.x,p.y,p.z].every(Number.isFinite)||p.y<-40||Math.abs(p.x)>6500||Math.abs(p.z)>5000;return state;
    }
    function cameraDistance(from,to,r=.2){
      const start=Array.isArray(from)?new T.Vector3().fromArray(from):from,end=Array.isArray(to)?new T.Vector3().fromArray(to):to;
      const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z,len=Math.hypot(dx,dy,dz);if(len<.001)return 0;
      // Segment sampling is bounded by camera reach, each sample spatially indexed.
      const n=Math.max(1,Math.ceil(len/.16));
      for(let i=1;i<=n;i++){const f=i/n;if(pointSolid(start.x+dx*f,start.y+dy*f,start.z+dz*f,r))return Math.max(.55,len*(i-1)/n-.08);}
      return len;
    }
    function setTerrain(value){terrain=value;}
    function dispose(){disposed=true;templates.clear();instances.length=0;worldGrid.clear();stairGrid.clear();}
    return {capture,place,captureExtras,addObject,setTerrain,groundAt,sampleGround,pointSolid,cameraDistance,bodyClear,step,teleport,makeFixtures,fixtures,
      getCheckpoint:id=>checkpoints.find(c=>c.id===id),getEra:()=> 'past',checkpoints,waypoints,constants,stats,instances,templates,dispose};
  }};
})(window);
