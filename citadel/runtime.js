/* Native Baegwol district. Original metres / Y-up, one shared game THREE.
 * Render geometry is losslessly merged by floor/material and 256 m outdoor cells.
 * Collision captures structural source triangles BEFORE render merging; detached
 * local groups preserve BoxGeometry solid volumes and the real stair risers.
 */
(function(global){'use strict';
  const CELL=64,RENDER_CELL=256,VERSION='20261123-original-armory32';
  const floorY=[22,42,64,84];
  const APPROACH_ROUTE=[
    [0,8.16,560],[0,8.16,453],[0,8.25,439],[0,8.16,323],[0,8.16,201],[0,8.16,134],
    [0,24,102],[0,24,90],[12,24,90],[12,24,54],[0,24,54],[0,41.98,25],
    [0,42.1,-42],[11.4,42.1,-42],[11,42,-68],[11,42,-79],[11,42,-83],
    [22,42,-83],[22,42,-101],[0,42,-101],[0,42,-124]
  ];
  const nextTurn=()=>new Promise(resolve=>setTimeout(resolve,0));
  const emit=(fn,progress,label)=>{if(typeof fn==='function')fn({progress,label});};
  function disposeTree(root){
    const geometries=new Set(),materials=new Set(),textures=new Set();
    root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)materials.add(m);});
    for(const m of materials)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
    for(const t of textures)t.dispose();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();
    root.removeFromParent();root.clear();
  }
  async function sourceTextures(T,options){
    if(options.textures===false){
      const textures=new Map();return{name:'cpu-materials',textures,factory:(kind,normal)=>{
        const key=kind+(normal?'_normal':'');if(!textures.has(key)){const t=new T.DataTexture(new Uint8Array(normal?[128,128,255,255]:[255,255,255,255]),1,1);t.name=key;t.needsUpdate=true;textures.set(key,t);}return textures.get(key);
      }};
    }
    const textures=new Map(),loader=new T.TextureLoader();let failed=false;
    try{
      await Promise.all(['stone','roof','wood','stone_normal','roof_normal','wood_normal'].map(name=>new Promise((resolve,reject)=>{
        let done=false;const timer=setTimeout(()=>{if(done)return;done=true;reject(Error('왕궁 재질 연결 시간이 초과되었습니다. 다시 입장해 주세요.'));},45000);
        loader.load('citadel/textures/'+name+'.png?v='+VERSION,t=>{if(done||failed){done=true;clearTimeout(timer);t.dispose();resolve();return;}done=true;clearTimeout(timer);t.name=name;t.colorSpace=name.endsWith('_normal')?T.NoColorSpace:T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;textures.set(name,t);resolve();},undefined,()=>{if(done)return;done=true;clearTimeout(timer);reject(Error('왕궁의 원본 재질을 불러오지 못했습니다. 다시 입장해 주세요.'));});
      })));
    }catch(e){failed=true;for(const t of textures.values())t.dispose();throw e;}
    return{name:'authored-png',textures,factory:(kind,normal)=>textures.get(kind+(normal?'_normal':''))};
  }
  function connectHistoricHall(C){
    // The display model's throne hall had a sealed rear wall. Open two visible
    // processional passages aligned with its existing rear-gallery arches. This
    // changes the rendered masonry and collision together; no invisible doorway.
    const T=C.THREE,P=C.groups.palace,F=C.groups.interiors.getObjectByName('Royal_Nave_Floor');
    const removed=[],added=[],before=C.primitiveCount;
    function remove(mesh){if(!mesh)throw Error('구왕성 회랑 접합부를 찾을 수 없습니다.');removed.push(mesh);mesh.removeFromParent();}
    const wall=P.children.find(o=>o.isMesh&&o.position.x===0&&o.position.y===57&&o.position.z===-71&&o.geometry.parameters?.width===39.4);
    remove(wall);
    const g=C.group('Native_Rear_Hall_Passages',P),gaps=[[-14.6,-7.4],[7.4,14.6]];
    function intervals(min,max){const out=[];let at=min;for(const[a,b]of gaps){if(a>at)out.push([at,a]);at=b;}if(at<max)out.push([at,max]);return out;}
    for(const[a,b]of intervals(-19.7,19.7))C.box(g,(a+b)/2,57,-71,b-a,30,1.8,'stone');
    for(const x of [-11,11]){
      C.box(g,x,62,-71,7.2,20,1.8,'stone');
      C.arch(g,x,42,-71,7.2,10,1.8,'stone',0,.6);
      const shape=new T.Shape();shape.moveTo(-3.6,10);shape.lineTo(-3.6,6.4);shape.absarc(0,6.4,3.6,Math.PI,0,true);shape.lineTo(3.6,10);shape.closePath();
      const geo=new T.ExtrudeGeometry(shape,{depth:1.8,bevelEnabled:false,curveSegments:16});geo.translate(0,0,-.9);
      const pos=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+x)/5,(pos.getY(i)+42)/5);
      C.mesh(g,geo,'stone',x,42,-71);
      C.arch(g,x,42,-69.85,7.8,10.3,.45,'trim',0,.25);
    }
    for(const course of P.children.filter(o=>o.isMesh&&o.position.x===0&&o.position.z===-72.1&&o.position.y<52&&o.geometry.parameters?.width===39)){
      const q=course.geometry.parameters,y=course.position.y;remove(course);
      for(const[a,b]of intervals(-19.5,19.5))C.box(g,(a+b)/2,y,-72.1,b-a,q.height,q.depth,course.material);
    }
    const sill=F?.children.find(o=>o.isMesh&&o.position.x===0&&o.position.z===-71&&o.geometry.parameters?.height===.85);
    remove(sill);
    for(const[a,b]of intervals(-19,19))added.push(C.box(F,(a+b)/2,42.28,-71,b-a,.85,.65,'stone'));
    g.traverse(o=>{if(o.isMesh)added.push(o);});
    const removedTriangles=removed.reduce((n,o)=>n+(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0);
    const addedTriangles=added.reduce((n,o)=>n+(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0);
    return{kind:'visible-rear-hall-passages',replacedMeshes:removed.length,removedTriangles,addedPrimitives:C.primitiveCount-before,addedTriangles,
      passages:[-11,11].map(x=>({position:[x,42,-71],clearWidth:6,clearHeight:9.4,connects:['old-throne-hall','old-rear-gallery']}))};
  }
  function addStoryProps(C,story){
    const group=C.group('Citadel_Chronicle_Props',C.groups.details),points=(story?.anchors||[]).map(p=>({...p,position:p.position.slice(),era:'past'}));
    for(const p of points){
      if(p.kind==='npc')continue;
      const at=p.displayPosition||[p.position[0]-1.5,p.position[1],p.position[2]],g=C.group('Chronicle_'+p.id,group);g.userData.citadelStoryId=p.id;g.position.fromArray(at);
      C.box(g,0,.1,0,1.25,.2,1.05,'stoneCool');C.cyl(g,0,.65,0,.14,.23,1,'wood',8);
      const desk=C.box(g,0,1.18,0,1.1,.13,.78,'woodLight');desk.rotation.x=-.19;
      const paper=C.box(g,0,1.28,.01,.86,.035,.62,'parchment');paper.rotation.x=-.19;
      for(let i=0;i<4;i++)C.box(g,0,1.3+i*.019,-.2+i*.12,.62,.012,.018,'wood');
      C.sphere(g,.38,1.35,.13,.065,'booksRed',7);
    }
    for(const actor of story?.actors||[]){
      const at=actor.position;if(!Array.isArray(at))continue;
      const g=C.group('Chronicle_Actor_'+actor.id,group);g.position.fromArray(at);g.userData.citadelActorId=actor.id;
      C.cyl(g,0,.73,0,.27,.4,1.35,'burgundy',9);C.sphere(g,0,1.56,0,.18,'stoneLight',10);
      C.box(g,0,1.06,.29,.48,.42,.09,'parchment');
      C.beam(g,[-.25,1.28,0],[-.24,1.05,.31],.075,'woodLight',7);C.beam(g,[.25,1.28,0],[.24,1.05,.31],.075,'woodLight',7);
      C.cone(g,0,1.78,0,.2,.22,'roof',8);
    }
    return points;
  }
  function collidable(mesh,layer,bounds){
    if(layer==='water'||layer==='underground')return false;
    let n=mesh;
    while(n){
      // Lead tracery, book lettering and hanging flags are visual detail on
      // already-solid walls/props. Their complete original geometry is rendered.
      if(/Carved_Stained_Window|Light_Window|Royal_Standard|Scale_Guard|Open_Illuminated_Manuscript|Curved_Page|Rolled_Parchment_Map|Roof_Dormer|Grand_Roof_Dormer/.test(n.name))return false;
      if(n.userData.expansionProp&&n.userData.blocksWalk===false)return false;
      n=n.parent;
    }
    const mat=mesh.material?.name||'';
    if(/^(water|foam|leaf|leafLight|flowerRose|flowerIvory|booksRed|booksBlue|booksGold|parchment|linen|emissive|crystal|Flag_|Draped_)/.test(mat))return false;
    const w=bounds.max.x-bounds.min.x,h=bounds.max.y-bounds.min.y,d=bounds.max.z-bounds.min.z;
    if(bounds.min.y>108)return false;
    // Ignore minute applied carvings, never slabs, walls or full-size rails.
    if(Math.max(w,h,d)<.65&&Math.min(w,h,d)<.16)return false;
    return true;
  }
  function separateMounts(T,C){
    // These are the three original saddled stable horses, not replacement art.
    // Remove them before static render/collision batching so moving one cannot
    // leave a second horse or an invisible obstacle behind in the stable.
    const groups=[];C.groups.town.traverse(o=>{if(o.name==='Royal stable horse')groups.push(o);});
    return groups.map((root,index)=>{
      let triangles=0,vertices=0,meshes=0;const legs=[];
      root.traverse(o=>{if(!o.isMesh)return;o.geometry=o.geometry.clone();meshes++;vertices+=o.geometry.attributes.position.count;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
      for(const mesh of root.children.slice())if(mesh.isMesh&&Math.abs(mesh.position.y-.7)<.001&&mesh.geometry.parameters?.height===1.4){
        const pivot=new T.Group();pivot.position.set(mesh.position.x,1.4,mesh.position.z);root.add(pivot);pivot.add(mesh);mesh.position.set(0,-.7,0);legs.push(pivot);
      }
      root.removeFromParent();
      const id='citadel-horse-'+(index+1);root.userData.citadelMountId=id;
      return {id,label:'왕실 마구간 말 '+(index+1),root,legs,position:root.position.toArray(),yaw:-root.rotation.y-Math.PI/2,
        seatOffset:1.4,home:null,triangles,vertices,meshes};
    });
  }
  function connectMounts(T,root,nav,mounts){
    const byId=new Map(mounts.map(m=>[m.id,m])),finitePosition=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)&&Math.abs(p[0])<560&&Math.abs(p[2])<580&&p[1]>-20&&p[1]<220;
    function obstacle(position,radius=.42,excludeId=null,height=1.8){
      for(const m of mounts){
        if(m.id===excludeId||!m.home)continue;
        const p=m.position,dy=position[1]-p[1];if(dy>3.1||dy+height<.1)continue;
        const dx=position[0]-p[0],dz=position[2]-p[2],co=Math.cos(m.yaw),si=Math.sin(m.yaw);
        const forward=dx*co+dz*si,side=-dx*si+dz*co;
        if(Math.hypot(Math.max(Math.abs(forward)-1.45,0),Math.max(Math.abs(side)-.58,0))<=radius)return m;
      }
      return null;
    }
    function clear(id,position,yaw,others=true){
      if(!byId.has(id)||!finitePosition(position)||!Number.isFinite(yaw))return false;
      const [x,y,z]=position,co=Math.cos(yaw),si=Math.sin(yaw);
      // Three overlapping capsules cover the original body, neck and rider.
      // All supports and headroom still come from the authored native nav.
      for(const forward of [-1.15,0,1.4]){
        const px=x+co*forward,pz=z+si*forward,h=nav.groundAt(px,pz,y,.7);
        if(h===null||Math.abs(h-y)>.7||!nav.bodyClear(px,h+.025,pz,.67,3.3))return false;
        if(others&&obstacle([px,h,pz],.67,id))return false;
      }
      return true;
    }
    function pose(id,position,yaw){
      const m=byId.get(id);if(!m||!finitePosition(position)||!Number.isFinite(yaw))return false;
      m.position=position.slice();m.yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));
      m.root.position.fromArray(m.position);m.root.rotation.y=-m.yaw-Math.PI/2;m.root.updateMatrixWorld(true);return true;
    }
    // The source put two horses inside a later town-house footprint. Keep the
    // first usable pose and find the nearest supported space in this same yard.
    const placed=[];
    for(const m of mounts){
      root.add(m.root);const original=m.position.slice(),candidates=[];
      for(let x=99;x<=115;x++)for(let z=108;z<=113;z++)candidates.push([x,original[1],z]);
      candidates.sort((a,b)=>Math.hypot(a[0]-original[0],a[2]-original[2])-Math.hypot(b[0]-original[0],b[2]-original[2]));
      candidates.unshift(original);let found=null;
      for(const candidate of candidates){
        const y=nav.groundAt(candidate[0],candidate[2],9,.5);if(y===null)continue;
        const p=[candidate[0],y,candidate[2]];
        for(const yaw of [m.yaw,-Math.PI/2,0]){
          if(!clear(m.id,p,yaw)||placed.some(q=>Math.hypot(q.position[0]-p[0],q.position[2]-p[2])<3.5))continue;
          // A mounting pose also needs a safe place to stand on either side.
          const side=[p[0]-Math.sin(yaw)*1.9,p[1],p[2]+Math.cos(yaw)*1.9],sideY=nav.groundAt(side[0],side[2],p[1],.7);
          if(sideY===null||Math.abs(sideY-p[1])>.7||!nav.bodyClear(side[0],sideY+.025,side[2]))continue;
          found={position:p,yaw};break;
        }
        if(found)break;
      }
      if(!found)throw Error('왕실 마구간 말의 안전한 탑승 자리를 찾지 못했습니다: '+m.id);
      pose(m.id,found.position,found.yaw);m.home={position:m.position.slice(),yaw:m.yaw};placed.push(m);
    }
    function exit(id){
      const m=byId.get(id);if(!m)return null;
      for(const side of [1.9,-1.9,2.5,-2.5])for(const forward of [0,-1,1]){
        const co=Math.cos(m.yaw),si=Math.sin(m.yaw),x=m.position[0]+co*forward-si*side,z=m.position[2]+si*forward+co*side;
        const y=nav.groundAt(x,z,m.position[1],.7);if(y===null||Math.abs(y-m.position[1])>.8||!nav.bodyClear(x,y+.025,z)||obstacle([x,y,z],.42,id))continue;
        const ownDistance=Math.hypot(x-m.position[0],z-m.position[2]);
        if(mounts.some(other=>other!==m&&Math.hypot(x-other.position[0],z-other.position[2])<ownDistance+.1))continue;
        const a=new T.Vector3(m.position[0],m.position[1]+1.3,m.position[2]),b=new T.Vector3(x,y+1.3,z);
        if(nav.cameraDistance(a,b,.1)<a.distanceTo(b)-.15)continue;
        return [x,y,z];
      }
      return null;
    }
    function save(){return mounts.map(m=>({id:m.id,position:m.position.slice(),yaw:m.yaw}));}
    function restore(records){
      if(!Array.isArray(records))return;
      for(const m of mounts)pose(m.id,m.home.position,m.home.yaw);
      const seen=new Set();
      for(const row of records.slice(0,3)){
        if(!row||seen.has(row.id)||!byId.has(row.id)||!clear(row.id,row.position,row.yaw,false))continue;
        seen.add(row.id);pose(row.id,row.position,row.yaw);
      }
      for(const m of mounts)if(!clear(m.id,m.position,m.yaw))pose(m.id,m.home.position,m.home.yaw);
    }
    function animate(time,ridingId,speed=0){
      for(const m of mounts){const k=m.id===ridingId?Math.min(1,Math.abs(speed)/8):0;
        for(let i=0;i<m.legs.length;i++)m.legs[i].rotation.x=Math.sin(time*11+(i===0||i===3?0:Math.PI))*.36*k;
      }
    }
    return {mounts,mountClear:clear,mountPose:pose,mountExit:exit,mountObstacle:obstacle,saveMounts:save,restoreMounts:restore,animateMounts:animate};
  }
  async function partition(T,C,nav,onProgress){
    C.root.updateMatrixWorld(true);
    const buckets=new Map(),navGroups=new Map(),sourceGeometries=new Set(),bounds=new T.Box3(),centre=new T.Vector3();
    let sourceMeshes=0,sourceTriangles=0,sourceVertices=0,collisionMeshes=0;
    for(const[layer,group]of Object.entries(C.groups))group.traverse(o=>{
      if(!o.isMesh)return;
      const geo=o.geometry,p=geo.attributes.position;if(!p)return;
      if(!geo.boundingBox)geo.computeBoundingBox();bounds.copy(geo.boundingBox).applyMatrix4(o.matrixWorld);bounds.getCenter(centre);
      const cell=Math.floor(centre.x/CELL)+','+Math.floor(centre.z/CELL);
      // Small render cells multiply one draw call for every material. Keep the
      // compact palace/floors in material batches; only the extensive outdoor
      // wards need spatial render batches. Collision retains independent 64m cells.
      const renderCell=['fortifications','town','garden','details'].includes(layer)?Math.floor(centre.x/RENDER_CELL)+','+Math.floor(centre.z/RENDER_CELL):'whole';
      const key=layer+'|'+renderCell+'|'+o.material.uuid;
      let bucket=buckets.get(key);if(!bucket)buckets.set(key,bucket={key,layer,material:o.material,meshes:[],vertices:0,indices:0,bounds:new T.Box3()});
      bucket.meshes.push(o);bucket.vertices+=p.count;bucket.indices+=geo.index?geo.index.count:p.count;bucket.bounds.union(bounds);
      sourceMeshes++;sourceTriangles+=(geo.index?geo.index.count:p.count)/3;sourceVertices+=p.count;sourceGeometries.add(geo);
      if(collidable(o,layer,bounds)){
        const nk=layer+'|'+cell+'|'+Math.floor(centre.y/24);let g=navGroups.get(nk);
        if(!g){g=new T.Group();g.name='Citadel_collision_'+nk;navGroups.set(nk,g);}
        const m=new T.Mesh(geo,o.material);m.matrixAutoUpdate=false;m.matrix.copy(o.matrixWorld);g.add(m);collisionMeshes++;
      }
    });
    let done=0;
    for(const[key,g]of navGroups){
      nav.addObject(g,'citadel:'+key);g.clear();
      if(++done%12===0){emit(onProgress,.58+.18*done/navGroups.size,'문·바닥·계단의 실제 충돌을 연결하는 중');await nextTurn();}
    }
    navGroups.clear();
    const chunks=[],normalMatrix=new T.Matrix3(),v=new T.Vector3();done=0;
    for(const bucket of buckets.values()){
      const positions=new Float32Array(bucket.vertices*3),normals=new Float32Array(bucket.vertices*3),uvs=new Float32Array(bucket.vertices*2),indices=new(bucket.vertices>65535?Uint32Array:Uint16Array)(bucket.indices);
      let offset=0,indexOffset=0;
      for(const o of bucket.meshes){
        const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,m=o.matrixWorld;normalMatrix.getNormalMatrix(m);
        for(let i=0;i<p.count;i++){
          v.fromBufferAttribute(p,i).applyMatrix4(m);const j=(offset+i)*3;positions[j]=v.x;positions[j+1]=v.y;positions[j+2]=v.z;
          if(n)v.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();else v.set(0,1,0);
          normals[j]=v.x;normals[j+1]=v.y;normals[j+2]=v.z;uvs[(offset+i)*2]=u?u.getX(i):0;uvs[(offset+i)*2+1]=u?u.getY(i):0;
        }
        if(g.index)for(let i=0;i<g.index.count;i++)indices[indexOffset++]=offset+g.index.getX(i);
        else for(let i=0;i<p.count;i++)indices[indexOffset++]=offset+i;
        offset+=p.count;
      }
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('normal',new T.BufferAttribute(normals,3));geo.setAttribute('uv',new T.BufferAttribute(uvs,2));geo.setIndex(new T.BufferAttribute(indices,1));geo.computeBoundingBox();geo.computeBoundingSphere();
      const mesh=new T.Mesh(geo,bucket.material);mesh.name=bucket.key;mesh.castShadow=bucket.layer!=='water';mesh.receiveShadow=true;mesh.frustumCulled=true;mesh.userData.citadelLayer=bucket.layer;
      chunks.push({mesh,layer:bucket.layer,bounds:bucket.bounds.clone(),triangles:indices.length/3,skyline:bucket.bounds.max.y>95});
      bucket.meshes.length=0;
      if(++done%80===0){emit(onProgress,.76+.17*done/buckets.size,'원본 디테일을 공간별로 정리하는 중');await nextTurn();}
    }
    for(const group of Object.values(C.groups))group.clear();
    for(const chunk of chunks)C.groups[chunk.layer].add(chunk.mesh);
    for(const geometry of sourceGeometries)geometry.dispose();C.disposeCache();
    // The original crypt is an isolated model cutaway, not another era portal.
    C.groups.underground.visible=false;
    return{chunks,stats:{sourceMeshes,sourceTriangles,sourceVertices,collisionMeshes,renderChunks:chunks.length,navTemplates:nav.stats.templates,navTriangles:nav.stats.triangles}};
  }
  function mapData(){
    return{shorelines:[{region:'citadel',closed:true,points:Array.from({length:72},(_,i)=>{const a=i*Math.PI/36;return[Math.sin(a)*450,-20+Math.cos(a)*490];})}],roads:[
      {width:22,points:APPROACH_ROUTE.slice(0,7).map(p=>[p[0],p[2]])},
      {width:6,points:APPROACH_ROUTE.slice(6).map(p=>[p[0],p[2]])},
      {width:8,points:[[-74,-164],[74,-164],[74,-298],[-74,-298],[-74,-164]]},
      {width:12,points:[[-433,-20],[-269,-20]]},{width:12,points:[[269,-20],[433,-20]]}
    ]};
  }
  global.HanQCitadelRuntime={version:VERSION,create:async function(options){
    const T=options.THREE,scene=options.scene,progress=options.onProgress;
    if(!T||!global.HanQCitadelAuthored||!global.HanQPastNavigation)throw Error('왕궁 모듈이 준비되지 않았습니다.');
    const root=new T.Group();root.name='HANQ_PAST_BAEGWOL_CITADEL';root.visible=false;
    const nav=global.HanQPastNavigation.create(T);let C,loadedTextures;
    try{
      emit(progress,.06,'백월 대왕성의 원본 재질을 불러오는 중');loadedTextures=await sourceTextures(T,options);
      C=global.HanQCitadelAuthored.createContext(T,root,loadedTextures.factory);
      const stages=global.HanQCitadelAuthored.stages;
      for(let i=0;i<stages.length;i++){emit(progress,.12+i*.065,stages[i].label);await nextTurn();stages[i].build(C);}
      const authoredPrimitives=C.primitiveCount,authoredStats={primitives:authoredPrimitives,meshes:0,triangles:0,vertices:0};
      root.traverse(o=>{if(o.isMesh){authoredStats.meshes++;authoredStats.vertices+=o.geometry.attributes.position.count;authoredStats.triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;}});
      const mountModels=separateMounts(T,C);
      const accessAdaptation=connectHistoricHall(C);
      const storyPoints=addStoryProps(C,options.story||global.HanQCitadelStory);
      emit(progress,.54,'왕궁의 통행 가능한 구조를 준비하는 중');await nextTurn();
      const built=await partition(T,C,nav,progress),chunks=built.chunks;
      const mountRuntime=connectMounts(T,root,nav,mountModels);
      for(const m of mountModels){built.stats.sourceMeshes+=m.meshes;built.stats.sourceTriangles+=m.triangles;built.stats.sourceVertices+=m.vertices;}
      // The native era adapter hides unrelated scene roots, including current-era
      // lights. This district therefore owns its daylight and releases it with root.
      const sky=new T.HemisphereLight(0xe7edf1,0x777e62,2.05);sky.name='Citadel_Sky_Light';root.add(sky);
      const sun=new T.DirectionalLight(0xffe5bc,2.65);sun.name='Citadel_Sun';sun.position.set(-240,390,220);sun.target.position.set(0,30,-90);root.add(sun,sun.target);
      const rim=new T.DirectionalLight(0xb8cfdf,.65);rim.name='Citadel_North_Fill';rim.position.set(240,180,-350);root.add(rim);
      const checkpoints=nav.checkpoints,waypoints=nav.waypoints;
      function checkpoint(id,label,position){
        const y=nav.groundAt(position[0],position[2],position[1],.7);
        if(y===null||!nav.bodyClear(position[0],y+.025,position[2]))throw Error('왕궁 안전 위치 검증 실패: '+id);
        const cp={id,label,position:[position[0],y,position[2]],era:'past',region:'citadel'};checkpoints.push(cp);waypoints.push({...cp});return cp;
      }
      const arrival=checkpoint('citadel-arrival','백월 대왕성 남쪽 접근교',[0,8.16,560]);
      checkpoint('citadel-south-gate','대왕성 남문',[0,8.3,439]);
      checkpoint('citadel-old-court','구왕성 상부 뜰',[0,42,19]);
      checkpoint('citadel-atrium','백월궁 대계단 홀',[0,42,-124]);
      checkpoint('citadel-service','B1 서비스층',[-120,22,-123]);
      checkpoint('citadel-scholars','2F 학술 회랑',[-74,64,-164]);
      checkpoint('citadel-royal','3F 왕실 회랑',[-74,84,-298]);
      const returnPortal={id:'citadel-return',kind:'citadel-exit',label:'하연성 역참으로 돌아가기',position:[0,arrival.position[1],567],radius:4.6,era:'past',region:'citadel'};
      // Collection and approved shared meshes belong to the era adapter. Keep
      // this district's descriptors in authored XYZ with Y at the real floor.
      const weaponPickups=[];
      function placeWeapon(id,weaponId,label,checkpointId,dx,dz,sourceId){
        const anchor=checkpoints.find(cp=>cp.id===checkpointId),x=anchor.position[0]+dx,z=anchor.position[2]+dz;
        const y=nav.groundAt(x,z,anchor.position[1]+.03,.08);
        if(y===null||Math.abs(y-anchor.position[1])>.12||!nav.bodyClear(x,y+.025,z))throw Error('왕궁 무기 배치의 안전한 지면을 찾지 못했습니다: '+id);
        const position=[x,y,z];
        for(const action of [returnPortal,...storyPoints])if(Math.hypot(x-action.position[0],y-action.position[1],z-action.position[2])<(action.radius||3)+.2)throw Error('왕궁 무기 배치가 기록 조사 지점과 겹칩니다: '+id);
        weaponPickups.push({id,weaponId,label,position,radius:2.4,checkpointId,...(sourceId?{sourceId}:{})});
      }
      // One representative of each existing melee type keeps its stable pickup
      // ID and position. The ten original armory items have independent IDs.
      placeWeapon('citadel-loot-arrival-dagger','dagger','단검','citadel-arrival',-3.5,0);
      placeWeapon('citadel-loot-arrival-sword','arming_sword','장검','citadel-arrival',3.5,0);
      placeWeapon('citadel-loot-gate-katana','katana','일본도','citadel-south-gate',-4,6);
      placeWeapon('citadel-loot-gate-hammer','war_hammer','워해머','citadel-south-gate',4,6);
      placeWeapon('citadel-loot-court-longsword','longsword','롱소드','citadel-old-court',-4,3);
      placeWeapon('citadel-loot-service-machete','machete','마체테','citadel-service',0,-3);
      function placeArmory(sourceId,label,checkpointId,dx,dz){placeWeapon('past-armory-'+sourceId,'past_'+sourceId,label,checkpointId,dx,dz,sourceId);}
      placeArmory('p07','비취 장식비수','citadel-arrival',-4,3);
      placeArmory('p26','청동 연방패','citadel-arrival',4,3);
      placeArmory('p13','봉황 삼지극','citadel-south-gate',-4,3);
      placeArmory('p24','철목 중노','citadel-south-gate',4,3);
      placeArmory('p16','쌍월 철극','citadel-old-court',4,3);
      placeArmory('p18','철문 팔릉철퇴','citadel-old-court',-4,-3);
      placeArmory('p27','철두 귀면곤봉','citadel-service',3,-3);
      placeArmory('p10','매화 철선','citadel-scholars',0,3);
      placeArmory('p06','왕성 문장검','citadel-royal',0,3);
      placeArmory('p30','학익 문양화승총','citadel-royal',3,0);
      const pois=[...checkpoints.map(cp=>({...cp,kind:'citadel',detail:cp.label})),...storyPoints.map(p=>({...p,detail:p.label||p.id}))];
      const bounds={minX:-570,maxX:570,minZ:-655,maxZ:585,minY:-25,maxY:229};
      const stats={...built.stats,authoredPrimitives,authoredTriangles:authoredStats.triangles,authoredVertices:authoredStats.vertices,visibleMeshes:0,visibleTriangles:0,cullDistance:0,originalUnits:'metres',sourceTextureMode:loadedTextures.name};
      let disposed=false,lastX=Infinity,lastZ=Infinity,lastQuality='',frame=0;
      function update(time,dt,context={}){
        if(disposed)return;
        const p=context.position||arrival.position,x=p.x??p[0],z=p.z??p[2],quality=context.quality||'high';
        if(Math.hypot(x-lastX,z-lastZ)<10&&lastQuality===quality&&frame++)return;
        lastX=x;lastZ=z;lastQuality=quality;frame=1;
        const distance=quality==='low'?330:quality==='medium'?520:850;let meshes=0,triangles=0;
        for(const q of chunks){
          const b=q.bounds,dx=Math.max(b.min.x-x,0,x-b.max.x),dz=Math.max(b.min.z-z,0,z-b.max.z),range=q.skyline?1350:distance;
          const visible=q.layer!=='underground'&&dx*dx+dz*dz<=range*range;q.mesh.visible=visible;
          if(visible){meshes++;triangles+=q.triangles;}
        }
        stats.visibleMeshes=meshes;stats.visibleTriangles=triangles;stats.cullDistance=distance;
      }
      function dispose(){
        if(disposed)return;disposed=true;nav.dispose();disposeTree(root);
        // sourceWorld exposes semantic groups for the map/debug adapter. Empty
        // those retained groups as well, so a disposed handle cannot retain the
        // large CPU vertex buffers after the GPU resources have been released.
        for(const group of Object.values(C.groups))group.clear();
        chunks.length=0;loadedTextures.textures.clear();C=null;loadedTextures=null;
      }
      if(scene)scene.add(root);update(0,0,{position:arrival.position,quality:options.quality||'high'});
      emit(progress,1,'하연성 왕궁 — 백월 대왕성');
      return{id:'past-citadel',area:'citadel',label:'하연성 왕궁 — 백월 대왕성',root,nav,arrival,returnPortal,checkpoints,travelNodes:[],weaponPickups,waypoints,bounds,pois,mapData:mapData(),stats,...mountRuntime,
        layout:C.expansionLayout,shell:C.expansionShellLayout,environment:C.expansionEnvironment,storyPoints,authoredStats,accessAdaptation,approachRoute:APPROACH_ROUTE.map(p=>p.slice()),
        sourceWorld:{root,name:'백월 대왕성',groups:C.groups,layout:C.expansionLayout},
        update,dispose,interactionAt:()=>null,setInspection:()=>false,inspectionCamera:()=>null,
        get inspection(){return null;},get disposed(){return disposed;}};
    }catch(error){nav.dispose();if(C)C.disposeCache();disposeTree(root);for(const t of loadedTextures?.textures?.values()||[])t.dispose();throw error;}
  }};
})(window);
