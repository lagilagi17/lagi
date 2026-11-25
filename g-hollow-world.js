/* HanQ — 흑철 심연. Native-game scenery and grounded navigation.
 * Local coordinates use X / vertical Y / Z; all objects are owned by root.
 * The host supplies its existing THREE and scene and controls root's transform.
 * No renderer, camera, avatar, input handler, DOM UI, network or global lighting
 * settings are created. Construction runs once, on the host's lazy-load path.
 */
(function (global) {
  'use strict';

  function createContext(T, scene) {
    const roots = {};
    ['surface', 'industry', 'city', 'mines', 'ruins', 'gate'].forEach(function (name) {
      const group = new T.Group(); group.name = 'hollow-' + name;
      roots[name] = group; scene.add(group);
    });
    const lighting = new T.Group(); lighting.name = 'hollow-lighting'; scene.add(lighting);
    const hemi = new T.HemisphereLight(0xb5d2e1, 0x5b6559, 1.65); lighting.add(hemi);
    const ambient = new T.AmbientLight(0x7393a5, .52); lighting.add(ambient);
    const sun = new T.DirectionalLight(0xffd6a2, 2.1); sun.position.set(140, 310, 290);
    const rim = new T.DirectionalLight(0x5ea5c8, 1.2); rim.position.set(-160, -80, 100);
    const back = new T.DirectionalLight(0x829a87, .55); back.position.set(30, -550, -200);
    // A directional target must share the root transform with its light.
    [sun, rim, back].forEach(function (light) { lighting.add(light, light.target); });
    [[0,-158,-30,0xffae6a,1700,230],[-100,-320,35,0x6bd8d6,1700,190],
     [0,-588,0,0x80edd9,2200,165],[65,-460,-30,0xe4b16b,1600,185]].forEach(function (spec) {
      const light = new T.PointLight(spec[3], spec[4], spec[5], 2);
      light.position.set(spec[0], spec[1], spec[2]); lighting.add(light);
    });
  const batches=new Map(),geos=new Map(),mats=new Map(),dummy=new T.Object3D();let placed=0,direct=0,seed=742169;
  const unitBox=new T.BoxGeometry(1,1,1);
  function geometry(key,build){if(!geos.has(key))geos.set(key,build());return geos.get(key)}
  function add(parent,geo,material,x,y,z,sx=1,sy=1,sz=1,rotation=null,quaternion=null,reference=null){
    const key=parent.uuid+':'+geo.uuid+':'+material.uuid;
    if(!batches.has(key))batches.set(key,{parent,geo,material,matrices:[],references:[]});
    const batch=batches.get(key);
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,0,0);
    if(rotation)dummy.rotation.set(rotation[0],rotation[1],rotation[2]);
    if(quaternion)dummy.quaternion.copy(quaternion);
    dummy.updateMatrix();const matrix=dummy.matrix.clone();
    if(reference){reference.index=reference.instanceId=batch.matrices.length;reference.matrix=matrix;batch.references.push(reference);}
    batch.matrices.push(matrix);placed++;
    return reference;
  }
  const H={
    rand(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296},
    mat(name,color,emissive=0,extra={}){
      const key=name+':'+color+':'+emissive+':'+JSON.stringify(extra);
      if(!mats.has(key))mats.set(key,new T.MeshStandardMaterial({color,emissive,roughness:.86,metalness:.12,...extra}));
      return mats.get(key);
    },
    box(parent,x,y,z,w,h,d,material,ry=0,reference=null){return add(parent,unitBox,material,x,y,z,w,h,d,[0,ry,0],null,reference)},
    cyl(parent,x,y,z,rt,rb,height,material,segments=12){
      const scale=Math.max(rt,rb,.0001),ratioTop=rt/scale,ratioBottom=rb/scale;
      const key='cyl:'+ratioTop+':'+ratioBottom+':'+segments;
      const geo=geometry(key,()=>new T.CylinderGeometry(ratioTop,ratioBottom,1,segments));
      add(parent,geo,material,x,y,z,scale,height,scale);
    },
    beam(parent,a,b,radius,material){
      const p=new T.Vector3(...a),q=new T.Vector3(...b),dir=q.clone().sub(p),len=dir.length();if(len<.00001)return;
      const geo=geometry('beam',()=>new T.CylinderGeometry(1,1,1,6));
      const mid=p.add(q).multiplyScalar(.5),rot=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());
      add(parent,geo,material,mid.x,mid.y,mid.z,radius,len,radius,null,rot);
    },
    torus(parent,x,y,z,r,tube,material,rx=0,ry=0,rz=0){
      const geo=geometry('torus:'+r+':'+tube,()=>new T.TorusGeometry(r,tube,6,Math.max(24,Math.min(72,Math.round(r*3)))));
      add(parent,geo,material,x,y,z,1,1,1,[rx,ry,rz]);
    },
    mesh(parent,geo,material,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);direct++;return m;},
    finalize(){
      let n=0;
      for(const {parent,geo,material,matrices,references} of batches.values()){
        const instance=new T.InstancedMesh(geo,material,matrices.length);
        matrices.forEach((m,i)=>instance.setMatrixAt(i,m));
        for(const reference of references)reference.mesh=instance;
        instance.instanceMatrix.needsUpdate=true;
        instance.computeBoundingSphere();
        instance.name='static-'+n++;parent.add(instance);
      }
      batches.clear();return {instances:placed,batches:n,direct};
    }
  };
  const fx=new T.Group();fx.name='hollow-atmosphere';scene.add(fx);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
  const gx=glowCanvas.getContext('2d'),grad=gx.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0,'rgba(255,255,245,.9)');grad.addColorStop(.13,'rgba(220,244,231,.34)');grad.addColorStop(.42,'rgba(140,195,195,.075)');grad.addColorStop(1,'rgba(90,130,145,0)');gx.fillStyle=grad;gx.fillRect(0,0,128,128);
  const glowMap=new T.CanvasTexture(glowCanvas);
  const glows=[];
  function glow(x,y,z,size,color,opacity){const m=new T.SpriteMaterial({map:glowMap,color,opacity,transparent:true,depthWrite:false,blending:T.AdditiveBlending});const s=new T.Sprite(m);s.position.set(x,y,z);s.scale.set(size,size,1);fx.add(s);glows.push({s,base:opacity});return s}
  [[-105,-73,0,48,0x87cecf,.4],[15,-188,-62,58,0xf2c28c,.3],[110,-207,38,44,0x9ce1d9,.3],[-112,-340,14,49,0xa0bfa9,.38],[0,-592,-24,84,0x7be0da,.4],[77,-472,-24,50,0xd2b17a,.29]].forEach(x=>glow(...x));
  const particleCount=500,pPos=new Float32Array(particleCount*3);
  for(let i=0;i<particleCount;i++){pPos[i*3]=(H.rand()-.5)*310;pPos[i*3+1]=H.rand()*655-630;pPos[i*3+2]=(H.rand()-.5)*245;}
  const pGeo=new T.BufferGeometry();pGeo.setAttribute('position',new T.BufferAttribute(pPos,3));
  const particles=new T.Points(pGeo,new T.PointsMaterial({color:0xa6b5a6,size:.7,transparent:true,opacity:.35,depthWrite:false,sizeAttenuation:true}));fx.add(particles);
  function updateFX(time,dt){for(let i=0;i<particleCount;i++){pPos[i*3+1]+=dt*(.4+(i%7)*.14);if(pPos[i*3+1]>12)pPos[i*3+1]=-630}pGeo.attributes.position.needsUpdate=true;glows.forEach((o,i)=>o.s.material.opacity=o.base*(.94+.06*Math.sin(time*.45+i)))}
    return {THREE:T, scene, roots, H, lights:{hemi,ambient,sun,rim,back}, lighting, fx, updateFX,
      ownedGeometries:geos, ownedMaterials:mats, unitBox};
  }

// Capture selected authored wall instances without adding geometry or changing
// instance order. Floors, roofs, machinery and other supports never enter these
// refs; the host binds only the few wall instances touched by an impact.
function structuralBox(H,parent,surfaces,id,center,size,material,protectedBands=[]) {
  const reference={kind:'mass'};
  H.box(parent,...center,...size,material,0,reference);
  const surface={id,center,size,collisionSize:size.slice(),yaw:0,baseY:center[1]-size[1]/2,
    visualHalfExtents:size.map(value=>value/2),protectedBands,refs:[reference]};
  surfaces.push(surface);return surface;
}

/* HANQ — THE HOLLOW BELOW / procedural city and surface geometry. */
function buildCity(ctx) {
  const {THREE, scene, roots:R, H} = ctx;
  const V = a => new THREE.Vector3(a[0],a[1],a[2]);
  const M = {
    stone:H.mat('cave-rock',0x26343b,0,{roughness:1,flatShading:true}),
    darkStone:H.mat('cave-shadow',0x17242c,0,{roughness:1,flatShading:true}),
    strata:H.mat('cave-strata',0x3f4a4c,0,{roughness:1,flatShading:true}),
    floor:H.mat('urban-deck',0x485451,0,{roughness:0.9}),
    edge:H.mat('urban-deck-edge',0x303b3c,0,{roughness:0.93}),
    concrete:H.mat('concrete',0x66726e,0,{roughness:.95}),
    concrete2:H.mat('concrete-worn',0x4a5e5e,0,{roughness:.98}),
    plaster:H.mat('plaster-tan',0x887f68,0,{roughness:1}),
    plaster2:H.mat('plaster-olive',0x6d7762,0,{roughness:1}),
    rust:H.mat('oxide-metal',0x6a4031,0,{roughness:.8,metalness:.35}),
    metal:H.mat('city-metal',0x26383d,0,{metalness:.6,roughness:.56}),
    steel:H.mat('city-steel',0x5c7376,0,{metalness:.72,roughness:.44}),
    black:H.mat('city-black',0x101c22,0,{roughness:.85}),
    amber:H.mat('lit-amber',0xffbb63,0xffa43d,{emissiveIntensity:1.5,roughness:.5}),
    amberDim:H.mat('lit-amber-dim',0xb2763e,0x7b491b,{emissiveIntensity:.6}),
    cyan:H.mat('lit-cyan',0x86d2cf,0x34b6bd,{emissiveIntensity:1.25}),
    red:H.mat('signal-red',0xf47d55,0xbc2915,{emissiveIntensity:1.4}),
    white:H.mat('city-markings',0xc4c6b6,0,{roughness:.7}),
    cloth:H.mat('cloth-teal',0x2e6565,0,{side:THREE.DoubleSide,roughness:1}),
    cloth2:H.mat('cloth-rust',0x8c563c,0,{side:THREE.DoubleSide,roughness:1}),
    wood:H.mat('city-wood',0x6f5740,0,{roughness:1}),
    sand:H.mat('surface-dirt',0x4f4f40,0,{roughness:1}),
    water:H.mat('cistern-water',0x163c42,0x0b303b,{transparent:true,opacity:.78,roughness:.18,metalness:.65}),
  };
  const shell = new THREE.Group(); shell.name='cavern-shell'; scene.add(shell);
  const props = new THREE.Group(); props.name='city-small-details'; R.city.add(props);
  const anchors=[],buildingSurfaces=[],structuralSurfaces=[];
  let buildingCount=0, lightCount=0;
  function b(g,x,y,z,w,h,d,m,ry=0){return H.box(g,x,y,z,w,h,d,m,ry);}
  function beam(g,a,c,r,m=M.steel){H.beam(g,a,c,r,m);}
  function c(g,x,y,z,rt,rb,h,m,s=12){return H.cyl(g,x,y,z,rt,rb,h,m,s);}
  function tor(g,x,y,z,r,t,m,rx=0,ry=0,rz=0){return H.torus(g,x,y,z,r,t,m,rx,ry,rz);}
  function mesh(g,geo,m,x=0,y=0,z=0){return H.mesh(g,geo,m,x,y,z);}
  function railing(g,a,c1,height=2.1,mat=M.steel,spacing=5){
    const av=V(a),bv=V(c1),dist=av.distanceTo(bv),n=Math.max(1,Math.ceil(dist/spacing));
    beam(g,[a[0],a[1]+height,a[2]],[c1[0],c1[1]+height,c1[2]],.17,mat);
    beam(g,[a[0],a[1]+height*.46,a[2]],[c1[0],c1[1]+height*.46,c1[2]],.1,mat);
    for(let i=0;i<=n;i++){const p=av.clone().lerp(bv,i/n);beam(g,p.toArray(),[p.x,p.y+height,p.z],.18,mat);}
  }
  function path(g,a,cb,width=5,mat=M.floor,rails=true){
    const av=V(a),bv=V(cb),mid=av.clone().add(bv).multiplyScalar(.5),len=av.distanceTo(bv);
    const geo=new THREE.BoxGeometry(width,1.1,len);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),bv.clone().sub(av).normalize());
    geo.applyQuaternion(q); mesh(g,geo,mat,mid.x,mid.y-.55,mid.z);
    const side=new THREE.Vector3(-(bv.z-av.z),0,bv.x-av.x).normalize().multiplyScalar(width*.48);
    if(rails) for(const k of [-1,1])railing(g,[av.x+side.x*k,av.y,av.z+side.z*k],[bv.x+side.x*k,bv.y,bv.z+side.z*k],1.7,M.steel,5);
  }
  function stairs(g,a,cb,width=5){
    const av=V(a),bv=V(cb),n=Math.max(4,Math.ceil(Math.abs(cb[1]-a[1])/.65));
    const dv=bv.clone().sub(av),flat=Math.hypot(dv.x,dv.z),ang=Math.atan2(dv.x,dv.z);
    for(let i=0;i<n;i++){const p=av.clone().lerp(bv,(i+.5)/n);b(g,p.x,p.y-.36,p.z,width,.72,flat/n+0.12,M.floor,ang);}
    const side=new THREE.Vector3(-dv.z,0,dv.x).normalize().multiplyScalar(width*.5);
    for(const k of [-1,1])railing(g,[av.x+side.x*k,av.y,av.z+side.z*k],[bv.x+side.x*k,bv.y,bv.z+side.z*k],1.8,M.steel,7);
    path(g,[a[0],a[1]-1.6,a[2]],[cb[0],cb[1]-1.6,cb[2]],width*.8,M.metal,false);
  }
  function ringDeck(g,y,ri,ro,start,end,thick=6,mat=M.floor){
    const segments=Math.ceil((end-start)*17),p=[],cols=[];
    function tri(a,bb,cc){p.push(...a,...cc,...bb);}
    for(let j=0;j<segments;j++){
      const aa=start+(end-start)*j/segments,ab=start+(end-start)*(j+1)/segments;
      const a=[Math.sin(aa)*ri,y,Math.cos(aa)*ri],bb=[Math.sin(ab)*ri,y,Math.cos(ab)*ri],cc=[Math.sin(ab)*ro,y,Math.cos(ab)*ro],d=[Math.sin(aa)*ro,y,Math.cos(aa)*ro];
      tri(a,bb,d);tri(bb,cc,d);
      const al=[a[0],y-thick,a[2]],bl=[bb[0],y-thick,bb[2]],cl=[cc[0],y-thick,cc[2]],dl=[d[0],y-thick,d[2]];
      tri(a,al,bb);tri(bb,al,bl);tri(d,cc,dl);tri(cc,cl,dl);tri(al,dl,bl);tri(bl,dl,cl);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.computeVertexNormals();mesh(g,geo,mat);
    for(let j=0;j<segments;j++){
      const a=start+(end-start)*j/segments,bb=start+(end-start)*(j+1)/segments;
      const pa=[Math.sin(a)*ri,y,Math.cos(a)*ri],pb=[Math.sin(bb)*ri,y,Math.cos(bb)*ri];railing(g,pa,pb,2,M.steel,8);
      if(j%2===0)b(g,pa[0],y-1.4,pa[2],1.6,.28,1.6,M.cyan);
    }
  }
  function label(g,text,x,y,z,w=12,h=3,ry=0,color='#c9dfd7',bg='#152d31'){
    const cv=document.createElement('canvas');cv.width=768;cv.height=192;
    const cc=cv.getContext('2d');cc.fillStyle=bg;cc.fillRect(0,0,768,192);cc.strokeStyle=color;cc.lineWidth=5;cc.strokeRect(9,9,750,174);cc.fillStyle=color;cc.textAlign='center';cc.textBaseline='middle';cc.font='700 74px sans-serif';cc.fillText(text,384,96,718);
    const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=4;
    const ma=new THREE.MeshBasicMaterial({map:tx,side:THREE.DoubleSide,toneMapped:false});
    const ob=mesh(g,new THREE.PlaneGeometry(w,h),ma,x,y,z);ob.rotation.y=ry;
    return ob;
  }
  function lamp(g,x,y,z,warm=true){
    c(g,x,y+3,z,.14,.2,6,M.metal,6);b(g,x,y+6,z,2,.28,.6,M.steel);b(g,x,y+5.8,z,1.8,.15,.5,warm?M.amber:M.cyan);lightCount++;
  }
  function person(g,x,y,z,ry=0){
    c(g,x,y+1.6,z,.37,.36,.72,M.plaster,8);b(g,x,y+.87,z,.77,1.2,.5,M.cloth,ry);
    const sx=Math.cos(ry)*.22,sz=-Math.sin(ry)*.22;
    beam(g,[x-sx,y,z-sz],[x-sx,y+.65,z-sz],.14,M.black);beam(g,[x+sx,y,z+sz],[x+sx,y+.65,z+sz],.14,M.black);
  }
  function crate(g,x,y,z,size=2.6){
    b(g,x,y+size*.5,z,size,size,size,M.wood);
    b(g,x,y+size*.5,z+size*.5+.03,size*.08,size,.1,M.black);
    for(const dy of [.12,.85])b(g,x,y+size*dy,z+size*.5+.04,size,.18,.12,M.metal);
  }
  function vent(g,x,y,z,w=3){
    b(g,x,y,z,w,2,1.2,M.metal);for(let j=0;j<5;j++)b(g,x,y-.65+j*.32,z+.64,w*.85,.12,.12,M.steel);
  }
  function building(x,y,z,w,d,floors,ry=0,type=0){
    const g=R.city,hh=6.4,floorH=floors*hh,co=Math.cos(ry),si=Math.sin(ry),wall=[M.concrete,M.concrete2,M.plaster,M.plaster2][type%4];buildingCount++;
    // Stable authored IDs match the navigation proxy. Capture only façade
    // instances inside the existing material batches; supports and equipment
    // never become render targets. Dimensions use building-local axes.
    const surface={id:'building-'+x+'-'+z,center:[x,y+floorH/2,z],size:[w,floorH,d],collisionSize:[w+1,floorH,d+1],yaw:ry,baseY:y,floors,floorHeight:hh,
      visualHalfExtents:[w/2,floorH/2,d/2],protectedBands:[{min:y-.21,max:y+2}],refs:[]};
    for(let f=1;f<floors;f++)surface.protectedBands.push({min:y+f*hh-.21,max:y+f*hh+.21});
    surface.protectedBands.push({min:y+floorH-.21,max:y+floorH+1.6});buildingSurfaces.push(surface);
    const pos=(lx,ly,lz)=>[x+lx*co+lz*si,y+ly,z-lx*si+lz*co];
    const B=(lx,ly,lz,bw,bh,bd,ma,kind=null)=>{
      const p=pos(lx,ly,lz),reference=kind?{kind}:null;H.box(g,...p,bw,bh,bd,ma,ry,reference);
      if(reference){surface.refs.push(reference);const extent=[Math.abs(lx)+bw/2,Math.abs(ly-floorH/2)+bh/2,Math.abs(lz)+bd/2];for(let axis=0;axis<3;axis++)surface.visualHalfExtents[axis]=Math.max(surface.visualHalfExtents[axis],extent[axis]);}
    };
    B(0,floorH/2,0,w,floorH,d,wall,'mass');B(0,1,0,w+1,2,d+1,M.edge);
    for(let k=0;k<=floors;k++) B(0,k*hh,0,w+.8,.42,d+.8,M.edge);
    for(const side of [-1,1]) B(side*(w*.5-.4),floorH*.5,d*.5+.25,.5,floorH,.55,M.metal);
    const nw=Math.max(2,Math.floor(w/5.3));
    for(let f=0;f<floors;f++)for(let q=0;q<nw;q++){
      const lx=(q-(nw-1)*.5)*(w/(nw+.3)),ly=f*hh+3.5;
      B(lx,ly,d*.5+.14,3.15,3.3,.36,M.black,'facade');
      B(lx,ly,d*.5+.37,2.5,2.75,.12,H.rand()>.31?M.amberDim:M.black,'facade');
      if(H.rand()>.44)B(lx,ly,d*.5+.47,.14,2.9,.14,M.metal,'facade');
      B(lx,ly-1.7,d*.5+.4,3.6,.24,.9,M.steel);
      if(f>0&&q===0&&type%3===0){
        B(lx,ly-1.9,d*.5+1.8,5.1,.35,3.8,M.floor);
        const aa=pos(lx-2.5,ly-1.7,d*.5+3.7),bb=pos(lx+2.5,ly-1.7,d*.5+3.7);railing(g,aa,bb,1.7,M.metal,2.5);
      }
    }
    // Street level doorway, awning and plaster repairs.
    B(w*.24,2.1,d*.5+.2,3.3,4.2,.5,M.black,'facade');B(w*.24,2.1,d*.5+.5,2.6,3.7,.1,M.wood,'facade');
    B(w*.24,4.35,d*.5+.7,4.1,.22,.6,M.amber);
    B(-w*.15,5.25,d*.5+2.4,w*.72,.22,4.6,type%2?M.cloth:M.cloth2);
    for(const ss of [-1,1]){const a=pos(-w*.15+ss*w*.33,0,d*.5+4.2);const cb=pos(-w*.15+ss*w*.33,5.2,d*.5+4.2);beam(g,a,cb,.13,M.metal);}
    B(0,floorH+.6,0,w+1,1.3,d+1.2,M.metal);
    B(0,floorH+1.2,-d*.5+.3,w,.8,.6,M.steel);
    const tankp=pos(w*.25,floorH+3.1,-d*.14);c(g,...tankp,2.2,2.4,4.2,M.rust,10);tor(g,tankp[0],tankp[1]+1.4,tankp[2],2.3,.12,M.steel,Math.PI/2);
    B(-w*.25,floorH+2.1,-d*.2,4.4,2.2,3.6,M.metal);
    // Vertical utilities and warm strips under cornices.
    const pa=pos(-w*.5-.48,.5,d*.28),pb=pos(-w*.5-.48,floorH+3,d*.28);beam(g,pa,pb,.32,M.rust);
    for(let fl=1;fl<floors;fl+=2)B(w*.5+.05,fl*hh+1.1,d*.05,.12,2.1,d*.8,M.concrete2,'facade');
    B(0,floorH-.8,d*.5+.45,w*.7,.16,.2,type%3?M.amberDim:M.cyan);
    if(type%4===0){const p=pos(-w*.15,5.8,d*.5+4.5);label(g,['주거 03','광부 식당','잔향 시장','급수소'][Math.floor(type/4)%4],...p,w*.78,2,ry);}
  }

  // The cavern is a cutaway: a tall, irregular back wall and layered side ribs.
  {
    const p=[],colors=[],rows=20,segs=45,start=Math.PI*.46,end=Math.PI*1.56;
    const grid=[];
    for(let j=0;j<=rows;j++){const row=[];for(let i=0;i<=segs;i++){
      const angle=start+(end-start)*i/segs;
      const rr=176+Math.sin(i*1.7+j*.8)*7+H.rand()*10;
      row.push([Math.sin(angle)*rr,35-j*35+H.rand()*4,Math.cos(angle)*rr]);
    }grid.push(row);}
    function tri(a,bb,cc,tint){p.push(...a,...bb,...cc);for(let k=0;k<3;k++)colors.push(tint[0],tint[1],tint[2]);}
    for(let j=0;j<rows;j++)for(let i=0;i<segs;i++){
      const q=.76+H.rand()*.3,cl=[.25*q,.31*q,.33*q];
      tri(grid[j][i],grid[j+1][i],grid[j][i+1],cl);tri(grid[j][i+1],grid[j+1][i],grid[j+1][i+1],cl);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    mesh(shell,geo,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,flatShading:true,roughness:1,side:THREE.DoubleSide}));
    for(let j=0;j<26;j++){
      const angle=start+(end-start)*j/25,rr=167,xx=Math.sin(angle)*rr,zz=Math.cos(angle)*rr;
      const geo2=new THREE.CylinderGeometry(3+H.rand()*4,8+H.rand()*7,110+H.rand()*160,5,1);
      const yy=-100-H.rand()*410;const ob=mesh(shell,geo2,j%2?M.stone:M.darkStone,xx,yy,zz);ob.rotation.z=(H.rand()-.5)*.09;
    }
    for(const yy of [-72,-188,-305,-428,-566])for(let j=0;j<22;j++){
      const aa=start+(end-start)*(j+.3)/22,xx=Math.sin(aa)*166,zz=Math.cos(aa)*166;
      b(shell,xx,yy+Math.sin(j*1.8)*2,zz,23,1.4,8,M.strata,aa+Math.PI/2);
    }
    // Glowing mineral veins are sparse, following crevices in the back cliff.
    for(let i=0;i<24;i++){
      const aa=2.15+H.rand()*2,rr=163,xx=Math.sin(aa)*rr,zz=Math.cos(aa)*rr,yy=-80-H.rand()*510;
      beam(shell,[xx,yy,zz],[xx+5-H.rand()*10,yy-10-H.rand()*20,zz+2],.12,M.cyan);
    }
  }

  // GROUND / rear fortified access. A horizontal road arrives from the battlefield.
  {
    const g=R.surface;
    // Open stairwell in the bunker: the playable route descends into the facility.
    for(const x of [-55,55])b(g,x,-5,-96,100,10,100,M.sand);
    b(g,0,-5,-115,10,10,62,M.sand);
    b(g,0,-5,-51,10,10,10,M.sand);
    for(const x of [-10.25,10.25])b(g,x,-.4,-20,10.5,.8,100,M.edge);
    b(g,0,-.4,-13,10,.8,86,M.edge);
    for(let z=-57;z<31;z+=13)b(g,0,.06,z,.65,.08,6.2,M.white);
    for(let x=-14;x<=14;x+=28)for(let z=-53;z<30;z+=17)b(g,x,.1,z,.65,.1,7,M.amberDim);
    // Heavy bunker: open rectangular doorway, deep shadow and offset blast doors.
    b(g,-26,12,-72,23,24,33,M.concrete2);b(g,26,12,-72,23,24,33,M.concrete2);
    b(g,0,25,-72,76,8,38,M.concrete2);b(g,0,29.4,-72,79,.8,40,M.edge);
    b(g,0,12,-90,31,23,2,M.black);
    for(const k of [-1,1]){
      b(g,k*12.8,10,-56,5.7,20,2,M.metal);for(let j=0;j<7;j++)b(g,k*12.8,2+j*2.6,-54.8,5.5,.55,.5,M.steel);
      b(g,k*20,5,-54.9,3,1.1,.5,M.red);
      for(let h=8;h<22;h+=4)b(g,k*25,h,-54.8,11,1.4,.3,M.edge);
      c(g,k*39,10,-63,2.1,2.1,20,M.metal,10);
      b(g,k*39,20,-63,3,.3,3,M.cyan);
      for(let zz=-122;zz<-57;zz+=9){c(g,k*72,4,zz,.23,.23,8,M.steel,6);beam(g,[k*72,7,zz],[k*72,7,zz+9],.08,M.steel);beam(g,[k*72,4.5,zz],[k*72,4.5,zz+9],.08,M.steel);}
    }
    label(g,'흑철 성채 · 봉쇄갱',0,24.8,-52.8,31,4.9,0,'#d6ccb2','#222f32');
    label(g,'RESTRICTED / 07',0,18.5,-55.8,18,2.3,0,'#c3c7b4','#26332f');
    // Guard turrets, stairs and rooftop equipment.
    for(const k of [-1,1]){
      b(g,k*54,8,-75,15,16,17,M.edge);b(g,k*54,17,-75,18,3,20,M.concrete);
      for(let j=-1;j<=1;j++)b(g,k*54+j*4,18,-64.9,2.5,1.2,.2,M.amberDim);
      b(g,k*54,20,-75,22,2,23,M.metal);
      c(g,k*54,27,-75,.18,.18,12,M.steel,6);
      beam(g,[k*54-5,26,-75],[k*54+5,26,-75],.14,M.steel);
      for(let n=0;n<7;n++){
        const xx=k*(27+n*5.1),zz=-36;
        b(g,xx,1,zz,4.7,2,2.2,M.plaster2);
        if(n%2===0)b(g,xx,2.8,zz,4.2,1.6,2.2,M.plaster2);
      }
      for(let n=0;n<3;n++){crate(g,k*(38+n*5),0,-100,3.8);}
      lamp(g,k*18,0,-22,false);
    }
    b(g,-61,1,-119,30,2,15,M.metal);
    for(let j=0;j<5;j++)b(g,-61,1.1,-124+j*2.3,27,.13,.22,M.white);
    // Open throat: railing around the visible lip emphasizes the depth.
    path(g,[-14,0,-40],[-38,0,4],8,M.floor,true);
    b(g,-48,-1,8,32,2,22,M.floor);
    railing(g,[-64,0,19],[-32,0,19]);railing(g,[-64,0,-3],[-32,0,-3]);
    label(g,'정지 승강기 · 계단 이용',-48,5,20,19,2.8);
    person(g,-36,0,12);person(g,14,0,-22);
    anchors.push({label:'적 후방 · 봉쇄갱',position:[0,24,-55]});
  }

  // B1 / suspension and ore-handling infrastructure.
  {
    const g=R.industry;ringDeck(g,-90,83,154,Math.PI*.49,Math.PI*1.47,7,M.edge);
    b(g,-99,-93,-13,78,6,75,M.floor);
    b(g,-99,-90,-13,60,.2,53,M.metal);
    for(let k=-3;k<=3;k++)b(g,-99+k*8,-89.8,-13,.18,.12,52,M.steel);
    // Twin structural hoist towers. The same shafts link ground, works and city.
    for(const x of [-74,-111]){
      for(const z of [-13,12]){
        b(g,x,-107,z,1.8,230,1.8,M.steel);
        for(let yy=-213;yy<5;yy+=19){beam(g,[x,yy,z],[x+(x===-74?-37:37),yy+19,z],.36,M.metal);}
      }
      for(let yy=-217;yy<5;yy+=19)beam(g,[x,yy,-13],[x,yy+19,12],.32,M.metal);
    }
    for(let x=-109;x<=-75;x+=34){
      tor(g,x,9,0,6.3,.85,M.rust,0,Math.PI/2);
      for(let k=0;k<8;k++){const aa=k*Math.PI/4;beam(g,[x,9,0],[x,9+Math.cos(aa)*6,Math.sin(aa)*6],.3,M.steel);}
      for(const z of [-5.5,5.5])beam(g,[x,8,z],[x,-223,z],.11,M.steel);
    }
    // Lift carriage sits at the industrial depot in this design preview.
    b(g,-92,-91,0,24,2,20,M.metal);b(g,-92,-75,0,25,1,21,M.metal);
    for(const x of [-103,-81])for(const z of [-9,9])b(g,x,-83,z,.8,16,.8,M.steel);
    for(const xx of [-102,-82])for(let z=-8;z<9;z+=2.2)b(g,xx,-84,z,.18,14,.18,M.metal);
    label(g,'LIFT 07',-92,-76.5,10.6,14,2.6,0,'#ffd08c');
    // Turbines, tanks and a winding house.
    const winding=structuralBox(H,g,structuralSurfaces,'structure-winding-house',[74,-76,-106],[65,28,37],M.concrete2,
      [{min:-90.01,max:-88},{min:-62.21,max:-59.99}]);
    b(g,74,-61,-106,69,2,40,M.metal);
    for(let j=0;j<7;j++){
      const frame={kind:'facade'},glass={kind:'facade'};
      H.box(g,48+j*8,-75,-86.9,5.5,10,.4,M.black,0,frame);
      H.box(g,48+j*8,-73,-86.5,4.8,5,.2,M.amberDim,0,glass);
      winding.refs.push(frame,glass);
    }
    winding.visualHalfExtents[2]=19.6;
    label(g,'권양기실',74,-64,-85.5,23,4);
    for(let i=0;i<3;i++){
      const x=30+i*27;c(g,x,-73,-139,9,9,34,M.rust,16);tor(g,x,-63,-139,9.2,.25,M.steel,Math.PI/2);tor(g,x,-82,-139,9.2,.25,M.steel,Math.PI/2);
      c(g,x,-55,-139,3,8.9,4,M.metal,12);beam(g,[x,-55,-139],[x,-40,-139],.7,M.steel);
    }
    for(let i=0;i<3;i++){beam(g,[-35,-92+i*3,-125],[35,-92+i*3,-125],1.1,M.rust);}
    for(const x of [-25,-15,-5]){c(g,x,-81,-110,6,6,17,M.metal,12);tor(g,x,-80,-103.7,4,.35,M.steel);}
    // overhead deck crossing from works into the opposite machinery galleries
    path(g,[-60,-90,-36],[65,-90,-50],8,M.metal,true);
    for(let i=0;i<8;i++){const x=-53+i*16;beam(g,[x,-91,-36],[x+8,-102,-40],.5,M.steel);beam(g,[x+8,-102,-40],[x+16,-91,-36],.5,M.steel);}
    for(let x=-132;x<122;x+=28)lamp(g,x,-90,-70,x<0);
    for(let i=0;i<7;i++)crate(g,-122+i*5,-90,-38,3.2);
    // The navigation module builds separated flights and real landings here.
    anchors.push({label:'권양기 수직갱',position:[-92,-73,11]});
  }

  // B2 / the large buried settlement wrapped around a black vertical void.
  {
    const g=R.city;
    ringDeck(g,-220,69,160,Math.PI*.37,Math.PI*1.64,8,M.floor);
    // Raised rear district permits two rows of houses, not a flat slab of boxes.
    ringDeck(g,-207,115,160,Math.PI*.64,Math.PI*1.37,6,M.edge);
    for(let i=0;i<11;i++){
      const x=-124+i*24.8,z=-103+Math.cos(i*.6)*7;building(x,-220,z,19.5,20,3+(i%4),0,i);
    }
    for(let i=0;i<7;i++)building(-89+i*29.7,-207,-139,22,20,3+(i%3),0,i+11);
    for(let i=0;i<5;i++){
      building(-131,-220,-55+i*23,21,22,3+(i%3),.45,i+18);
      if(i<4)building(132,-220,-52+i*25,20,21,3+((i+1)%3),-.48,i+23);
    }
    // Underpinning of the outer residential decks, visible far below their floor.
    for(let j=0;j<17;j++){
      const aa=Math.PI*.43+j/16*Math.PI*1.16;
      const a=[Math.sin(aa)*145,-220,Math.cos(aa)*145],bb=[Math.sin(aa)*165,-273,Math.cos(aa)*165];
      beam(g,a,bb,1.2,M.steel);if(j!==13)beam(g,[Math.sin(aa)*79,-220,Math.cos(aa)*79],bb,.65,M.metal);
      b(g,Math.sin(aa)*98,-222,Math.cos(aa)*98,4,.35,3,M.amberDim,aa);
    }
    // Northern access stair between levels of the settlement.
    stairs(g,[-42,-220,-80],[-42,-207,-118],7);stairs(g,[54,-220,-82],[54,-207,-118],7);
    // Clock-and-signal tower / town landmark.
    b(g,-57,-194,-68,13,52,13,M.concrete2);b(g,-57,-165,-68,17,6,17,M.metal);
    b(g,-57,-157,-68,11,11,11,M.plaster);b(g,-57,-150,-68,15,3,15,M.rust);
    c(g,-57,-144,-68,.3,.7,9,M.steel,8);
    const face=mesh(g,new THREE.CircleGeometry(4.1,32),M.black,-57,-157,-62.4);
    tor(g,-57,-157,-62.2,4.25,.3,M.amberDim);
    for(let j=0;j<12;j++){const aa=j/12*Math.PI*2; b(g,-57+Math.sin(aa)*3.35,-157+Math.cos(aa)*3.35,-62.1,.22,.55,.14,M.white);}
    beam(g,[-57,-157,-61.9],[-56,-154.8,-61.9],.16,M.white);beam(g,[-57,-157,-61.8],[-59.4,-157.8,-61.8],.13,M.white);
    label(g,'잔향구',-57,-177,-60.9,10,3.2,0,'#e5d4b2');
    // Central bridges give people a physical crossing and reveal the depth below.
    path(g,[-105,-220,34],[97,-220,34],6.2,M.floor,true);
    for(let x=-95;x<96;x+=19){beam(g,[x,-221,31],[x+9.5,-232,31],.45,M.steel);beam(g,[x+9.5,-232,31],[x+19,-221,31],.45,M.steel);}
    for(const x of [-77,74])beam(g,[x,-223,35],[x,-277,23],1.2,M.metal);
    path(g,[-58,-220,-61],[-32,-220,-8],5,M.floor,true);
    path(g,[-32,-220,-8],[31,-220,-8],5,M.floor,true);
    path(g,[31,-220,-8],[57,-220,-62],5,M.floor,true);
    // Small octagonal service plaza hangs over the gap.
    c(g,0,-221,-7,18,18,2,M.floor,8);
    c(g,0,-218.5,-7,4.8,6.5,3,M.concrete2,12);c(g,0,-216.9,-7,4.4,4.4,.15,M.water,24);
    c(g,0,-214,-7,.6,.6,5,M.steel,8);c(g,0,-211.6,-7,2.1,.4,.8,M.cyan,12);
    for(let j=0;j<8;j++){const aa=j*Math.PI/4;lamp(g,Math.sin(aa)*15,-220,-7+Math.cos(aa)*15,j%2===0);}
    // Market on the near-left bank, with stall canopies and hanging utilities.
    for(let i=0;i<5;i++){
      const x=-112+i*8.3,z=2;
      b(g,x,-218.4,z,6,3.2,3.3,M.wood);b(g,x,-214.6,z,7.6,.25,6.5,i%2?M.cloth:M.cloth2);
      for(const dx of [-3.1,3.1])for(const dz of [-2.8,2.8])beam(g,[x+dx,-220,z+dz],[x+dx,-214.3,z+dz],.13,M.steel);
      for(let q=0;q<3;q++)b(g,x-2+q*2,-216.4,z+.2,1.5,.7,1.6,q%2?M.plaster:M.plaster2);
      crate(g,x,-220,z-5,2.1);
    }
    label(g,'잔향 시장',-95,-210,3.4,20,3.5,0,'#ffcf8b','#483522');
    // A stacked public cistern and pressure lines establish a working city.
    const tx=96,tz=-51;
    for(const dx of [-7,7])for(const dz of [-7,7])beam(g,[tx+dx,-220,tz+dz],[tx+dx,-197,tz+dz],.5,M.steel);
    c(g,tx,-189,tz,11.5,11.5,17,M.rust,20);c(g,tx,-179,tz,2,11.7,3,M.metal,20);
    for(const yy of [-196,-190,-183])tor(g,tx,yy,tz,11.7,.25,M.steel,Math.PI/2);
    beam(g,[tx,-190,tz+12],[tx,-224,tz+12],.8,M.steel);
    label(g,'WATER 04',tx,-188,tz+11.8,11,3,0,'#d2d9c5','#414942');
    // Lamps, handrails, benches, small residents, hanging wires and suspended flags.
    for(let j=0;j<20;j++){
      const aa=Math.PI*.42+j/19*Math.PI*1.16,rad=82;lamp(g,Math.sin(aa)*rad,-220,Math.cos(aa)*rad,j%3!==0);
      if(j%2===0)person(props,Math.sin(aa)*(rad+5),-220,Math.cos(aa)*(rad+5),aa);
    }
    for(let j=0;j<7;j++){person(props,-70+j*22,-220,34,j*.8);}
    for(let j=0;j<4;j++){
      const xa=-104+j*51,xb=xa+49,zz=-75;
      beam(g,[xa,-185,zz],[xa+24.5,-189,zz+3],.09,M.metal);beam(g,[xa+24.5,-189,zz+3],[xb,-185,zz],.09,M.metal);
      for(let k=0;k<5;k++){
        const px=xa+6+k*8.8,py=-185-Math.sin((k+1)/6*Math.PI)*4;
        const ge=new THREE.BufferGeometry();ge.setAttribute('position',new THREE.Float32BufferAttribute([px,py,zz+2,px+3,py,zz+2,px+1.5,py-4,zz+2.5],3));ge.computeVertexNormals();mesh(g,ge,k%2?M.cloth:M.cloth2);
      }
    }
    for(let i=0;i<6;i++){const x=-116+i*43;b(g,x,-218.6,-68,5,.5,2,M.wood);for(const dx of [-1.8,1.8])b(g,x+dx,-219.2,-68,.25,1.4,1.5,M.metal);}
    // Service pipeline spans the lower edge and drops toward the mines.
    beam(g,[120,-225,16],[120,-329,16],1.25,M.rust);beam(g,[126,-225,16],[126,-334,16],.62,M.steel);
    for(let y=-236;y>-330;y-=14){tor(g,120,y,16,1.5,.15,M.steel,Math.PI/2);b(g,123,y,16,10,.4,1.5,M.metal);}
    // The navigation module supplies the nonoverlapping descent to the mines.
    path(g,[110,-350,9],[98,-350,0],7,M.floor,true);
    anchors.push({label:'잔향구 · 지하 거주도시',position:[-57,-148,-62]});
    anchors.push({label:'시장의 공중교',position:[0,-214,34]});
  }

  // Deep rock roots frame the lower ruins without obscuring the mine railway.
  {
    const g=shell;
    for(const k of [-1,1]){
      const geo=new THREE.ConeGeometry(19,115,7);const ob=mesh(g,geo,M.stone,k*153,-584,-62);ob.rotation.z=k*.08;
      const geo2=new THREE.ConeGeometry(13,58,6);const ob2=mesh(g,geo2,M.darkStone,k*145,-367,-89);ob2.rotation.z=k*.11;
    }
    for(let j=0;j<10;j++){
      const aa=2+j*.26;const xx=Math.sin(aa)*158,zz=Math.cos(aa)*158;
      const geo=new THREE.ConeGeometry(3+H.rand()*5,24+H.rand()*20,5);
      const ob=mesh(g,geo,M.darkStone,xx,-420-H.rand()*70,zz);ob.rotation.z=Math.PI;
    }
  }
  return {shell,stats:{buildings:buildingCount,lamps:lightCount},anchors,buildingSurfaces,structuralSurfaces};
};

/* HANQ · 심연의 문 — mine railway, buried ruins, and chronological gate. */
function buildRailRuins(ctx) {
  'use strict';
  const {THREE:T,scene,roots,H} = ctx;
  const structuralSurfaces=[];
  const V = (x,y,z) => new T.Vector3(x,y,z);
  const mats = {
    iron: H.mat('rail-iron',0x243e45,0,{roughness:.69,metalness:.55}),
    edge: H.mat('rail-steel',0x8ca6a8,0,{roughness:.36,metalness:.79}),
    wood: H.mat('rail-sleeper',0x493a2b,0,{roughness:.95}),
    ochre: H.mat('rail-ochre',0xa96c28,0,{roughness:.72,metalness:.32}),
    coal: H.mat('rail-coal',0x142326,0,{roughness:1}),
    concrete: H.mat('rail-concrete',0x526268,0,{roughness:.96}),
    pale: H.mat('rail-pale',0x98b0ac,0,{roughness:.8}),
    cyan: H.mat('rail-cyan',0x69f2df,0x1aa69d,{emissiveIntensity:1.4,roughness:.3}),
    amber: H.mat('rail-amber',0xffcf77,0xff9b2c,{emissiveIntensity:1.35,roughness:.4}),
    red: H.mat('rail-red',0x7d342b,0,{roughness:.82}),
    stone: H.mat('ruin-stone',0x657878,0,{roughness:.98}),
    stoneLight: H.mat('ruin-stone-light',0x8c9f98,0,{roughness:.95}),
    moss: H.mat('ruin-moss',0x3a6255,0,{roughness:1}),
    gold: H.mat('gate-bronze',0xb88c49,0,{roughness:.42,metalness:.68}),
    dark: H.mat('gate-basalt',0x263a3e,0,{roughness:.85}),
    rune: H.mat('gate-rune',0xa1ffec,0x41dfd4,{emissiveIntensity:2.4,roughness:.2}),
    orange: H.mat('gate-fire',0xffd09d,0xff8736,{emissiveIntensity:2,roughness:.4})
  };
  const rx0=155, rz0=118, a0=.23, turns=3;
  const points=[];
  for(let i=0;i<=240;i++){
    const t=i/240, a=a0+t*Math.PI*2*turns;
    // The first descent skirts the city slab instead of cutting through its edge.
    const clear=1-T.MathUtils.smoothstep(t,0,.11);
    const rx=rx0-17*t+20*clear, rz=rz0-13*t+15*clear;
    points.push(V(Math.cos(a)*rx,-218-260*t,Math.sin(a)*rz));
  }
  const route = new T.CatmullRomCurve3(points,false,'centripetal');
  route.arcLengthDivisions=2200;
  const routeLength=route.getLength();
  const up=V(0,1,0), forward=V(0,0,1);
  function sampleTrain(t){
    if(t<0){
      const direction=route.getTangentAt(0).normalize();
      return {position:route.getPointAt(0).addScaledVector(direction,t*routeLength),direction};
    }
    if(t>1){
      const direction=route.getTangentAt(1).normalize();
      return {position:route.getPointAt(1).addScaledVector(direction,(t-1)*routeLength),direction};
    }
    return {position:route.getPointAt(t),direction:route.getTangentAt(t).normalize()};
  }
  const railRoot = new T.Group();railRoot.name='Rack mine railway';roots.mines.add(railRoot);
  const left=[],right=[],rack=[];
  const railSegments=1080;
  const railLead=34/routeLength,railTail=6/routeLength;
  for(let i=0;i<=railSegments;i++){
    const s=sampleTrain(-railLead+(1+railLead+railTail)*i/railSegments), side=new T.Vector3().crossVectors(s.direction,up).normalize();
    left.push(s.position.clone().addScaledVector(side,-1.55));
    right.push(s.position.clone().addScaledVector(side,1.55));
    rack.push(s.position.clone().add(V(0,-.07,0)));
  }
  for(const list of [left,right]){
    const c=new T.CatmullRomCurve3(list,false,'centripetal');
    H.mesh(railRoot,new T.TubeGeometry(c,railSegments,.18,5,false),mats.edge);
  }
  H.mesh(railRoot,new T.TubeGeometry(new T.CatmullRomCurve3(rack),railSegments,.12,4,false),mats.ochre);
  const ties=Math.ceil((routeLength+40)/2.8);
  for(let i=0;i<=ties;i++){
    const t=-railLead+(1+railLead+railTail)*i/ties, s=sampleTrain(t);
    const yaw=Math.atan2(s.direction.x,s.direction.z);
    H.box(railRoot,s.position.x,s.position.y-.28,s.position.z,4.6,.32,.58,mats.wood,yaw);
    if(i%3===0)H.box(railRoot,s.position.x,s.position.y+.06,s.position.z,.48,.18,.2,mats.edge,yaw);
    if(i%15===0){
      const side=new T.Vector3().crossVectors(s.direction,up).normalize();
      const p=s.position.clone().addScaledVector(side,2.5);
      H.beam(railRoot,p.toArray(),p.clone().add(V(0,2.6,0)).toArray(),.12,mats.iron);
      H.box(railRoot,p.x,p.y+2.7,p.z,.52,.5,.52,i%30===0?mats.cyan:mats.amber);
    }
  }
  for(const t of [-railLead,1+railTail]){
    const s=sampleTrain(t),yaw=Math.atan2(s.direction.x,s.direction.z);
    H.box(railRoot,s.position.x,s.position.y+1.05,s.position.z,3.5,1.4,.7,mats.ochre,yaw);
    H.box(railRoot,s.position.x,s.position.y+.25,s.position.z,4.1,.35,2.4,mats.iron,yaw);
  }
  // A terminal lead accommodates all three cars when the locomotive is parked at t=0.
  for(let i=1;i<=3;i++){
    const s=sampleTrain(-railLead*i/3);
    H.box(railRoot,s.position.x,s.position.y-1,s.position.z,5,1.5,8,mats.iron,Math.atan2(s.direction.x,s.direction.z));
    H.beam(railRoot,s.position.clone().add(V(0,-1.5,0)).toArray(),s.position.clone().add(V(0,-17,0)).toArray(),.7,mats.iron);
  }
  // The trestles read as the bones of a much larger, abandoned industrial city.
  for(let i=0;i<=84;i++){
    const s=sampleTrain(i/84), side=new T.Vector3().crossVectors(s.direction,up).normalize();
    const inward=V(-s.position.x,0,-s.position.z).normalize();
    const p1=s.position.clone().addScaledVector(side,-2.7),p2=s.position.clone().addScaledVector(side,2.7);
    const foot=s.position.clone().addScaledVector(inward,-9).add(V(0,-18,0));
    H.beam(railRoot,p1.clone().add(V(0,-.7,0)).toArray(),p2.clone().add(V(0,-.7,0)).toArray(),.36,mats.iron);
    H.beam(railRoot,p1.toArray(),foot.toArray(),.48,mats.iron);
    H.beam(railRoot,p2.toArray(),foot.toArray(),.48,mats.iron);
    H.box(railRoot,foot.x,foot.y-1.2,foot.z,4,3,4,mats.concrete);
    if(i<84){
      const next=sampleTrain((i+1)/84);
      H.beam(railRoot,s.position.clone().add(V(0,-3.6,0)).toArray(),next.position.clone().add(V(0,-3.6,0)).toArray(),.35,mats.iron);
    }
  }
  // Short sections retain their tunnel ribs; open sections reveal the depth.
  for(let i=0;i<8;i++){
    const base=.135+i*.117;
    if(base>.94)break;
    for(let j=0;j<5;j++){
      const s=sampleTrain(base+j*.0025), side=new T.Vector3().crossVectors(s.direction,up).normalize();
      const a=s.position.clone().addScaledVector(side,-3.4),b=s.position.clone().addScaledVector(side,3.4);
      H.beam(railRoot,a.clone().add(V(0,-1,0)).toArray(),a.clone().add(V(0,4.4,0)).toArray(),.35,mats.iron);
      H.beam(railRoot,b.clone().add(V(0,-1,0)).toArray(),b.clone().add(V(0,4.4,0)).toArray(),.35,mats.iron);
      H.beam(railRoot,a.clone().add(V(0,4.4,0)).toArray(),b.clone().add(V(0,4.4,0)).toArray(),.35,mats.iron);
    }
  }
  let mineStationT=.5;
  {
    let lo=0,hi=1;
    for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(sampleTrain(mid).position.y>-348)lo=mid;else hi=mid;}
    mineStationT=(lo+hi)/2;
  }
  const stations=[
    {name:'침강도시역',short:'도시역',t:0,depth:220},
    {name:'심층채굴역',short:'채굴역',t:mineStationT,depth:350},
    {name:'발굴성역역',short:'유적역',t:1,depth:480}
  ];
  function station(spec){
    const pose=sampleTrain(spec.t),p=pose.position,dir=pose.direction;
    const side=new T.Vector3().crossVectors(dir,up).normalize();
    const inward=V(-p.x,0,-p.z).normalize();
    const q=p.clone().addScaledVector(inward,8.2), yaw=Math.atan2(dir.x,dir.z);
    spec.position=p.toArray(); spec.cameraTarget=q.clone().add(V(0,2,0)).toArray();
    H.box(railRoot,q.x,p.y-1.4,q.z,11,1.8,27,mats.concrete,yaw);
    H.box(railRoot,q.x,p.y-.38,q.z,11.1,.18,27.1,mats.pale,yaw);
    const local=(dx,dz,dy)=>q.clone().addScaledVector(side,dx).addScaledVector(dir,dz).add(V(0,dy,0));
    for(const dz of [-10,0,10]){
      for(const dx of [-4.4,4.4]){
        const c=local(dx,dz,0);H.box(railRoot,c.x,p.y+3.7,c.z,.46,8,.46,mats.iron,yaw);
      }
    }
    H.box(railRoot,q.x,p.y+7.7,q.z,13,.55,29,mats.iron,yaw);
    H.box(railRoot,q.x,p.y+7.35,q.z,9,.2,26,mats.ochre,yaw);
    for(const dz of [-8,8]){
      const c=local(0,dz,0);H.box(railRoot,c.x,p.y+7.1,c.z,7,.2,.34,mats.amber,yaw);
      const e=local(2,dz,0);H.box(railRoot,e.x,p.y+.45,e.z,2.2,1.1,3,mats.wood,yaw);
    }
    // Yellow platform edge and repeated hazard slashes.
    for(let i=0;i<14;i++){
      const c=local(-4.8,-12+i*1.8,0);
      H.box(railRoot,c.x,p.y-.2,c.z,.5,.09,.8,i%2?mats.ochre:mats.coal,yaw);
    }
  }
  stations.forEach(station);
  // City terminus approach: the rail has a visible connection to the upper city.
  const s0=sampleTrain(0).position;
  const approachEnd=s0.x-11,approachStart=95;
  H.box(roots.city,(approachEnd+approachStart)/2,-220,s0.z,approachEnd-approachStart,2.1,8,mats.concrete);
  H.box(roots.city,98,-220,(s0.z+34)/2,8,2.1,Math.abs(s0.z-34)+8,mats.concrete);
  H.beam(roots.city,[97,-218,s0.z+3.7],[approachEnd,-218,s0.z+3.7],.15,mats.iron);
  H.beam(roots.city,[97,-218,s0.z-3.7],[approachEnd,-218,s0.z-3.7],.15,mats.iron);

  // Deep mining quarter, with the remnant of an enormous extraction works.
  const mines=roots.mines;
  const corridorSamples=[];
  for(let i=0;i<=1700;i++)corridorSamples.push(sampleTrain(i/1700).position);
  function cutSlab(parent,x,y,z,w,h,d,material){
    // The descending railway passes through an excavated slot, never a solid floor.
    const relevant=corridorSamples.filter(p=>p.y>=y-h/2-4.4&&p.y<=y+h/2+.2);
    const nx=Math.ceil(w/5),nz=Math.ceil(d/5),sx=w/nx,sz=d/nz;
    const clearance=2+Math.hypot(sx,sz)/2+.8;
    for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
      const px=x-w/2+(ix+.5)*sx,pz=z-d/2+(iz+.5)*sz;
      if(relevant.some(p=>Math.hypot(p.x-px,p.z-pz)<clearance))continue;
      H.box(parent,px,y,pz,sx+.025,h,sz+.025,material);
    }
  }
  cutSlab(mines,-119,-352,-45,65,7,75,mats.concrete);
  H.box(mines,119,-353,-65,67,8,67,mats.concrete);
  cutSlab(mines,-119,-348.3,-43,62,.3,73,mats.iron);
  function bunker(x,y,z,w,d,index){
    const id='structure-mine-bunker-'+index+'-';
    structuralBox(H,mines,structuralSurfaces,id+'left',[x-w/2,y+6,z],[2,12,d],mats.concrete,[{min:y+11,max:y+13.01}]);
    structuralBox(H,mines,structuralSurfaces,id+'right',[x+w/2,y+6,z],[2,12,d],mats.concrete,[{min:y+11,max:y+13.01}]);
    H.box(mines,x,y+12,z,w+3,2,d,mats.concrete);
    structuralBox(H,mines,structuralSurfaces,id+'back',[x,y+5,z-d/2+1],[w,10,2],mats.coal);
    for(let i=0;i<7;i++){
      const r=3+H.rand()*4;
      H.mesh(mines,new T.IcosahedronGeometry(r,0),mats.coal,x+(H.rand()-.5)*w*.75,y+r*.65,z+(H.rand()-.5)*d*.6);
    }
    H.box(mines,x,y+13.2,z+d/2+.1,w*.8,.5,.2,mats.amber);
  }
  bunker(-128,-348,-60,22,23,0);bunker(-100,-348,-61,18,23,1);bunker(112,-349,-77,25,25,2);
  // East gantry / ore handling crane.
  for(const x of [100,135])for(const z of [-78,-39]){
    H.box(mines,x,-329,z,1.8,40,1.8,mats.ochre);
    H.box(mines,x,-348,z,6,1.5,6,mats.iron);
  }
  for(const z of [-78,-39]){
    H.box(mines,117.5,-308,z,38,3.4,3.4,mats.ochre);
    H.beam(mines,[100,-345,z],[135,-310,z],.4,mats.iron);
  }
  H.box(mines,117.5,-307,-58.5,5,2,45,mats.iron);
  H.box(mines,117.5,-309,-52,7,4,8,mats.ochre);
  H.beam(mines,[117.5,-311,-52],[117.5,-336,-52],.14,mats.edge);
  H.torus(mines,117.5,-336.5,-52,1.8,.35,mats.iron,0,0,0);
  for(let i=0;i<7;i++){
    const x=-139+i*7;
    H.cyl(mines,x,-344,-19,1.8,1.8,7,mats.ochre,12);
    H.cyl(mines,x,-340.5,-19,1.85,1.85,.35,mats.iron,12);
  }
  // Four massive ventilation pipes climb from the excavated city.
  for(let i=0;i<4;i++){
    const x=-110+i*5;
    H.beam(mines,[x,-350,-90],[x,-285,-90],1.2,mats.iron);
    for(let y=-340;y<-285;y+=10)H.cyl(mines,x,y,-90,1.5,1.5,.45,mats.edge,10);
  }
  // Short branching ore galleries communicate a labyrinth, not one corridor.
  for(let k=0;k<3;k++){
    const x=-125+k*24;
    cutSlab(mines,x,-351,-100,17,2,38,mats.concrete);
    for(let j=0;j<5;j++){
      const z=-83-j*7;
      H.box(mines,x-7,-341,z,.8,20,.8,mats.wood);
      H.box(mines,x+7,-341,z,.8,20,.8,mats.wood);
      H.box(mines,x,-331,z,15,1,1,mats.wood);
      if(j%2===0)H.box(mines,x,-332,z,.5,.8,.5,mats.amber);
    }
  }

  // Vehicle: a rack locomotive, one open inspection/crew wagon and two ore cars.
  const trainRoot=new T.Group();trainRoot.name='Mine locomotive / crew wagon / two ore cars';scene.add(trainRoot);
  const cars=[],wheelPivots=[];
  const dbox=(g,x,y,z,w,h,d,m)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o);return o;};
  const dcyl=(g,x,y,z,rt,rb,h,m,n=12)=>{const o=new T.Mesh(new T.CylinderGeometry(rt,rb,h,n),m);o.position.set(x,y,z);g.add(o);return o;};
  // Parts fixed to one moving parent share draw calls without freezing articulation.
  function mergeImmediate(group){
    const batches=new Map();
    for(const o of [...group.children]){
      if(!o.isMesh||Array.isArray(o.material))continue;
      const key=o.material.uuid;
      if(!batches.has(key))batches.set(key,{material:o.material,objects:[]});
      batches.get(key).objects.push(o);
    }
    for(const {material,objects} of batches.values()){
      if(objects.length<2)continue;
      const parts=[];
      for(const o of objects){
        o.updateMatrix();
        const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
        g.applyMatrix4(o.matrix);parts.push(g);
      }
      const geometry=new T.BufferGeometry();
      for(const key of ['position','normal','uv']){
        if(parts.some(p=>!p.getAttribute(key)))continue;
        const size=parts[0].getAttribute(key).itemSize,total=parts.reduce((n,p)=>n+p.getAttribute(key).array.length,0);
        const array=new Float32Array(total);let offset=0;
        for(const p of parts){const a=p.getAttribute(key).array;array.set(a,offset);offset+=a.length;}
        geometry.setAttribute(key,new T.BufferAttribute(array,size));
      }
      geometry.computeBoundingSphere();
      for(const o of objects){group.remove(o);o.geometry.dispose();}
      parts.forEach(p=>p.dispose());group.add(new T.Mesh(geometry,material));
    }
  }
  function wheels(g,z){
    for(const x of [-1.65,1.65]){
      const pivot=new T.Group();pivot.position.set(x,.62,z);g.add(pivot);
      const tire=dcyl(pivot,0,0,0,.64,.64,.35,mats.coal,12);tire.rotation.z=Math.PI/2;
      const rim=dcyl(pivot,x<0?-.22:.22,0,0,.34,.34,.12,mats.edge,10);rim.rotation.z=Math.PI/2;
      dbox(pivot,x<0?-.3:.3,0,0,.1,.45,.09,mats.ochre);
      wheelPivots.push(pivot);
    }
    const axle=dcyl(g,0,.62,z,.15,.15,3.5,mats.edge,8);axle.rotation.z=Math.PI/2;
  }
  const locomotive=new T.Group();cars.push(locomotive);trainRoot.add(locomotive);
  dbox(locomotive,0,1.1,0,3.3,.6,7.8,mats.iron);
  dbox(locomotive,0,2.2,1.1,2.9,1.9,4.4,mats.ochre);
  dbox(locomotive,0,3.12,1.1,3.05,.18,4.55,mats.ochre);
  dbox(locomotive,0,2.6,-2,3.1,2.5,2.8,mats.iron);
  const glass=H.mat('train-glass',0x275b68,0x0b2428,{roughness:.28,metalness:.35});
  dbox(locomotive,0,3.2,-.51,2.3,1.1,.08,glass);
  for(const x of [-1.58,1.58]){
    dbox(locomotive,x,3.15,-2,.09,1.1,1.8,glass);
    dbox(locomotive,x,1.66,-1.9,.12,.16,2.4,mats.ochre);
    for(let j=0;j<6;j++)dbox(locomotive,x,2.3,.1+j*.5,.09,1.05,.12,mats.iron);
  }
  dbox(locomotive,0,4,-2,3.6,.22,3.25,mats.ochre);
  dbox(locomotive,0,3.34,2.35,.9,.5,.9,mats.iron);
  dbox(locomotive,0,3.34,2.82,.63,.28,.1,mats.amber);
  dcyl(locomotive,1,3.6,.4,.2,.24,1.7,mats.coal,8);
  dbox(locomotive,0,.82,4.05,3.65,1,.5,mats.ochre);
  for(let j=0;j<7;j++)dbox(locomotive,-1.3+j*.43,.83,4.33,.22,.8,.08,j%2?mats.ochre:mats.coal);
  for(const z of [-2.5,2.5])wheels(locomotive,z);
  const headBeamGeo=new T.ConeGeometry(3,22,16,1,true);
  const headBeamMat=new T.MeshBasicMaterial({color:0xffd7a0,transparent:true,opacity:.065,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
  const headBeam=new T.Mesh(headBeamGeo,headBeamMat);headBeam.rotation.x=-Math.PI/2;headBeam.position.set(0,3.3,13.8);locomotive.add(headBeam);
  const cartOffsets=[0,9.6,18,26.4];
  for(let i=0;i<3;i++){
    const cart=new T.Group();trainRoot.add(cart);cars.push(cart);
    dbox(cart,0,1.1,0,3.3,.55,6.7,mats.iron);
    dbox(cart,0,1.55,0,2.9,.35,6.2,mats.ochre);
    cart.name=i===0?'Open inspection and crew wagon':'Ore car '+i;
    if(i===0){
      // Waist-high sides leave a standing passenger visible above the 1.725m deck.
      for(const x of [-1.45,1.45]){
        dbox(cart,x,1.96,0,.18,.46,6.3,mats.ochre);
        dbox(cart,x,2.49,0,.14,.12,6.3,mats.edge);
        for(let j=-2;j<=2;j++)dbox(cart,x,2.14,j*1.35,.12,.82,.14,mats.iron);
      }
      for(const z of [-3,3]){
        dbox(cart,0,2.05,z,3.1,.64,.18,mats.ochre);
        dbox(cart,0,2.49,z,3.1,.12,.13,mats.edge);
        for(const x of [-1.35,1.35])dbox(cart,x,2.14,z,.12,.82,.14,mats.iron);
      }
      // A low side bench leaves the central standing area clear.
      dbox(cart,-1.03,2.07,0,.52,.18,3.8,mats.wood);
      for(const z of [-1.45,1.45])dbox(cart,-1.03,1.88,z,.16,.32,.24,mats.iron);
      dbox(cart,1.55,2.03,0,.08,.42,1.25,mats.cyan);
      dbox(cart,0,1.92,3.12,.9,.28,.08,mats.pale);
      // Consume the former ore RNG calls so all later scenery stays identical.
      for(let j=0;j<48;j++)H.rand();
    }else{
      for(const x of [-1.45,1.45]){
        const p=dbox(cart,x,2.5,0,.22,2,6.3,mats.ochre);p.rotation.z=x<0?-.1:.1;
        for(let j=-2;j<=2;j++)dbox(cart,x*1.07,2.5,j*1.1,.16,2.1,.17,mats.iron);
      }
      for(const z of [-3,3])dbox(cart,0,2.5,z,3.1,2,.22,mats.ochre);
      for(let j=0;j<12;j++){
        const rock=new T.Mesh(new T.IcosahedronGeometry(.55+H.rand()*.55,0),j%4===0?mats.stone:mats.coal);
        rock.position.set((H.rand()-.5)*2,2.4+H.rand()*.7,(H.rand()-.5)*4.8);cart.add(rock);
      }
    }
    for(const z of [-2.25,2.25])wheels(cart,z);
    for(const z of [-3.85,3.85])dbox(cart,0,1.1,z,.35,.28,1.4,mats.edge);
    if(i===2){
      dbox(cart,-1.2,1.65,-3.25,.3,.3,.12,mats.orange);
      dbox(cart,1.2,1.65,-3.25,.3,.3,.12,mats.orange);
    }
  }
  cars.forEach(mergeImmediate);
  let progress=0,lastProgress=0,positioned=false;
  // Borrowed cached vectors; callers must not mutate them. No curve sampling in getter.
  const passengerState={position:V(0,0,0),direction:V(0,0,1),feetPosition:V(0,0,0),floorHeight:1.73,offsetDistance:9.6,progress:0};
  function passengerPose(){return passengerState;}
  function setProgress(t){
    const next=Math.max(0,Math.min(1,Number.isFinite(t)?t:0));
    // Simulation, passenger sync and render can request the same position.
    // Only a changed route position needs curve samples and car transforms.
    if(positioned&&next===progress)return;
    progress=next;positioned=true;
    cars.forEach((g,i)=>{
      const pose=sampleTrain(progress-cartOffsets[i]/routeLength);
      g.position.copy(pose.position);
      // Heading plus grade keeps wagon roofs upright through every hairpin.
      g.rotation.set(-Math.asin(T.MathUtils.clamp(pose.direction.y,-1,1)),Math.atan2(pose.direction.x,pose.direction.z),0,'YXZ');
      if(i===1){passengerState.position.copy(pose.position);passengerState.direction.copy(pose.direction);passengerState.feetPosition.set(0,passengerState.floorHeight,0).applyQuaternion(g.quaternion).add(pose.position);passengerState.progress=progress;}
    });
    const delta=(progress-lastProgress)*routeLength;
    wheelPivots.forEach(w=>w.rotation.x+=delta/.64);
    lastProgress=progress;
  }
  function getTrainPose(){return {...sampleTrain(progress),progress,eyeHeight:3.7};}
  setProgress(0);

  // Ancient strata: fractured stone avenues circling a black, open void.
  const ruins=roots.ruins;
  function arcPlatform(parent,y,rOuter,rInner,start,end,mat,thick=3){
    const shape=new T.Shape();
    shape.absarc(0,0,rOuter,start,end,false);
    shape.lineTo(Math.cos(end)*rInner,Math.sin(end)*rInner);
    shape.absarc(0,0,rInner,end,start,true);shape.closePath();
    const geo=new T.ExtrudeGeometry(shape,{depth:thick,bevelEnabled:false,curveSegments:48});
    geo.rotateX(-Math.PI/2);
    H.mesh(parent,geo,mat,0,y-thick,0);
  }
  arcPlatform(ruins,-480,140,83,-.22,Math.PI-.16,mats.stone,5);
  H.box(ruins,-102,-482,11,64,5,25,mats.stone);
  H.box(ruins,102,-482,9,64,5,27,mats.stone);
  H.box(ruins,0,-482,-100,86,5,47,mats.stone);
  H.box(ruins,18,-481,-39,9,3,122,mats.stoneLight);
  H.box(ruins,-30,-481,-11,107,3,9,mats.stoneLight);
  // Repeated paving breaks broad surfaces into an inhabitable scale.
  for(let i=0;i<26;i++){
    const a=Math.PI+.25+i/25*(Math.PI-.5),r=112;
    H.box(ruins,Math.cos(a)*r,-479.65,Math.sin(a)*r,13,.35,7,mats.stoneLight,-a+Math.PI/2);
  }
  function ruinArch(parent,x,y,z,width,height,depth,material){
    const thick=1.8;
    H.box(parent,x-width/2,y+(height-width/2)/2,z,thick,height-width/2,depth,material);
    H.box(parent,x+width/2,y+(height-width/2)/2,z,thick,height-width/2,depth,material);
    const curvePoints=[];
    for(let i=0;i<=24;i++){
      const a=i/24*Math.PI;
      curvePoints.push(V(x+Math.cos(a)*width/2,y+height-width/2+Math.sin(a)*width/2,z));
    }
    H.mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(curvePoints),24,1.15,4,false),material);
    H.box(parent,x,y+height+.1,z,2.4,2.7,depth+.8,mats.stoneLight);
  }
  for(let i=0;i<10;i++){
    const a=Math.PI+.22+i/9*(Math.PI-.44),r=122;
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    const h=20+(i%3)*6;
    H.cyl(ruins,x,-480+h/2,z,3.3,4,h,mats.stone,8);
    H.cyl(ruins,x,-479,z,5,5,2,mats.stoneLight,8);
    H.cyl(ruins,x,-480+h,z,4.5,4.5,1.4,mats.stoneLight,8);
    H.box(ruins,x+.1,-480+h*.5,z+3.4,.5,h*.6,.2,mats.moss);
  }
  for(const x of [-80,-40,0,40,80])ruinArch(ruins,x,-480,-96,19,24,5,mats.stone);
  // Buried streets, dead ends, cross passages, and scattered lintels.
  const walls=[[-100,-42,31,3],[-78,-51,3,28],[-50,-63,30,3],[-36,-80,3,23],[48,-61,28,3],[64,-43,3,27],[88,-55,3,23],[-88,-75,17,3],[32,-88,3,16],[103,-65,25,3]];
  walls.forEach((w,i)=>{
    const h=7+i%4*2;
    structuralBox(H,ruins,structuralSurfaces,'structure-ruin-wall-'+i,[w[0],-480+h/2,w[1]],[w[2],h,w[3]],i%3?mats.stone:mats.moss,
      [{min:-480.01,max:-479.5},{min:-480+h-.35,max:-480+h+.36}]);
    H.box(ruins,w[0],-480+h,w[1],w[2]+.4,.7,w[3]+.4,mats.stoneLight);
  });
  for(let i=0;i<36;i++){
    const x=-112+H.rand()*224,z=-116+H.rand()*92;
    if(Math.abs(x)<18&&z>-75)continue;
    H.box(ruins,x,-478.9,z,1.5+H.rand()*3,1.5+H.rand()*2,1.6+H.rand()*3,mats.stone,H.rand()*Math.PI);
  }
  for(const x of [-74,72]){
    H.cyl(ruins,x,-478,-26,4.4,5,4,mats.dark,10);
    H.cyl(ruins,x,-474.5,-26,3,3.8,1.5,mats.gold,10);
    H.mesh(ruins,new T.IcosahedronGeometry(2,1),mats.orange,x,-472.3,-26);
  }
  // A visible four-flight ceremonial descent reaches the final court.
  const stairStarts=[[150,-480,28],[80,-515,38],[150,-550,48],[80,-585,58]];
  const stairEnds=[[80,-515,28],[150,-550,38],[80,-585,48],[150,-620,58]];
  const stairRoot=new T.Group();stairRoot.name='Four descending ceremonial flights';roots.gate.add(stairRoot);
  for(let k=0;k<4;k++){
    const a=V(...stairStarts[k]),b=V(...stairEnds[k]),n=100;
    const z=a.z;
    for(let i=0;i<n;i++){
      const p=a.clone().lerp(b,(i+.5)/n);
      H.box(stairRoot,p.x,p.y-.25,p.z,.75,.5,5.4,mats.stoneLight);
      if(i%10===0){
        for(const dz of [-2.7,2.7])H.box(stairRoot,p.x,p.y+1,p.z+dz,.18,2.6,.18,mats.gold);
      }
    }
    for(const dz of [-2.8,2.8]){
      H.beam(stairRoot,a.clone().add(V(0,2,dz)).toArray(),b.clone().add(V(0,2,dz)).toArray(),.13,mats.gold);
      H.beam(stairRoot,a.clone().add(V(0,-1.2,dz)).toArray(),b.clone().add(V(0,-1.2,dz)).toArray(),.45,mats.dark);
    }
    if(k<3){
      H.box(stairRoot,b.x,b.y-.4,b.z+5,8,1,15,mats.stone);
      H.box(stairRoot,b.x,b.y-8,b.z+5,3,15,3,mats.dark);
    }
  }
  // Playable descent: the nav module supplies a side approach without covering the first stair flight.
  // The final approach stays at court level, leaving the portal silhouette clear.
  H.box(stairRoot,150,-620.5,58,10,1,10,mats.stone);
  H.box(stairRoot,150,-626,58,6,12,6,mats.dark);
  H.box(stairRoot,107.5,-620.55,58,85,1.1,6,mats.stoneLight);
  for(const z of [55.2,60.8]){
    H.beam(stairRoot,[65,-618,z],[150,-618,z],.13,mats.gold);
    for(let i=0;i<=10;i++)H.box(stairRoot,65+i*8.5,-619,z,.18,2.8,.18,mats.gold);
  }
  H.box(stairRoot,110,-626,58,3.5,12,3.5,mats.dark);

  // The final chamber: bronze instruments built around something much older.
  const gate=roots.gate;
  H.cyl(gate,0,-623,0,95,101,6,mats.dark,80);
  H.cyl(gate,0,-619.8,0,91,91,.4,mats.stone,80);
  H.cyl(gate,0,-619.5,-13,42,44,.65,mats.dark,64);
  H.box(gate,0,-618.9,38,16,.9,89,mats.stoneLight);
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2;
    H.box(gate,Math.cos(a)*70,-619.3,Math.sin(a)*70,10,.8,7,mats.stoneLight,-a);
  }
  H.torus(gate,0,-619.1,-13,44,.25,mats.gold,Math.PI/2,0,0);
  H.torus(gate,0,-618.95,-13,39,.12,mats.rune,Math.PI/2,0,0);
  // Three calibration altars / environmental puzzle sockets.
  const altarPositions=[[-44,-618,10],[44,-618,10],[0,-618,65]];
  altarPositions.forEach((p,i)=>{
    H.cyl(gate,p[0],p[1]+1.5,p[2],3.2,4.3,4,mats.dark,8);
    H.cyl(gate,p[0],p[1]+3.8,p[2],2.8,3.5,.7,mats.gold,8);
    H.mesh(gate,new T.OctahedronGeometry(2.1,0),mats.rune,p[0],p[1]+5.6,p[2]);
  });
  const pc=V(0,-592,-34);
  const portal=new T.Group();portal.name='Chronological gate';portal.position.copy(pc);gate.add(portal);
  const outer=new T.Mesh(new T.TorusGeometry(22,1.35,10,80),mats.gold);portal.add(outer);
  const inner=new T.Mesh(new T.TorusGeometry(18.6,.36,8,80),mats.rune);portal.add(inner);
  const ringA=new T.Group(),ringB=new T.Group();portal.add(ringA,ringB);
  for(let i=0;i<48;i++){
    const a=i/48*Math.PI*2;
    const m=new T.Mesh(new T.BoxGeometry(i%4===0?1.3:.7,i%4===0?3.4:1.7,1),i%4===0?mats.gold:mats.dark);
    m.position.set(Math.sin(a)*22,Math.cos(a)*22,.3);m.rotation.z=-a;ringA.add(m);
    if(i%2===0){
      const r=new T.Mesh(new T.BoxGeometry(.22,1.6,.13),mats.rune);
      r.position.set(Math.sin(a)*20.4,Math.cos(a)*20.4,1.1);r.rotation.z=-a;ringB.add(r);
    }
  }
  mergeImmediate(ringA);mergeImmediate(ringB);
  const backing=new T.Mesh(new T.CircleGeometry(18.6,80),H.mat('portal-depth',0x041b22,0,{roughness:1}));backing.position.z=-.45;portal.add(backing);
  const portalUniforms={uTime:{value:0},uActive:{value:.35}};
  const portalMaterial=new T.ShaderMaterial({
    uniforms:portalUniforms,transparent:true,depthWrite:false,side:T.DoubleSide,
    blending:T.AdditiveBlending,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float uTime;uniform float uActive;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      void main(){vec2 p=(vUv-.5)*2.;float r=length(p);if(r>1.)discard;float a=atan(p.y,p.x);
        float ring=pow(max(0.,1.-abs(r-.91)*9.),3.);
        float wave=sin(r*51.-uTime*2.7+sin(a*5.+uTime*.15)*2.);wave=pow(max(0.,wave),5.);
        float swirl=sin(a*9.+r*31.-uTime*1.1)*.5+.5;
        float heart=pow(max(0.,1.-r),2.);
        vec2 cells=floor(p*140.);float stars=step(.995,hash(cells))*pow(sin(uTime+hash(cells)*6.)*.5+.5,2.);
        vec3 c=vec3(.045,.38,.39)*(wave*.35+swirl*.07)+vec3(.15,.87,.73)*ring;
        c+=vec3(.55,.9,1.)*stars*(1.-r);c+=vec3(.05,.22,.26)*heart;
        c*=.5+uActive*.8;float alpha=(.34+ring*.55+wave*.16)*(1.-smoothstep(.97,1.,r));
        gl_FragColor=vec4(c,alpha);}`
  });
  const veil=new T.Mesh(new T.PlaneGeometry(37.2,37.2),portalMaterial);veil.position.z=.15;portal.add(veil);
  // Black-stone supports and the carved mechanism built around the luminous ring.
  for(const x of [-29,29]){
    H.box(gate,x,-593,-37,8,54,10,mats.dark);
    H.box(gate,x,-565,-37,12,3,14,mats.stoneLight);
    H.box(gate,x,-619,-37,14,3,17,mats.stoneLight);
    H.box(gate,x,-590,-31.8,1,40,.2,mats.gold);
    for(let i=0;i<8;i++)H.box(gate,x,-610+i*5,-31.6,4.2,.32,.18,mats.rune);
    H.beam(gate,[x,-615,-29],[x*1.7,-619,-3],2.5,mats.dark);
  }
  H.box(gate,0,-561,-37,69,5,13,mats.dark);
  H.box(gate,0,-557.6,-37,75,1.5,17,mats.stoneLight);
  for(let i=0;i<7;i++){
    const a=Math.PI*.1+i/6*Math.PI*.8,r=74;
    const x=Math.cos(a)*r,z=-Math.sin(a)*54-24;
    H.cyl(gate,x,-602,z,3.8,4.6,34,mats.stone,10);
    H.cyl(gate,x,-619,z,6,6,2,mats.stoneLight,10);
    H.cyl(gate,x,-584,z,5.4,5.4,2,mats.stoneLight,10);
  }
  // Water is a deep, translucent plane below the court, without an expensive reflector.
  const waterMat=new T.MeshStandardMaterial({color:0x10373e,roughness:.24,metalness:.55,transparent:true,opacity:.8});
  const water=new T.Mesh(new T.CircleGeometry(178,96),waterMat);water.rotation.x=-Math.PI/2;water.position.y=-623.15;gate.add(water);
  for(const r of [106,127,151])H.torus(gate,0,-623,0,r,.09,mats.cyan,Math.PI/2,0,0);
  const floatStones=[];
  for(let i=0;i<17;i++){
    const a=i/17*Math.PI*2,r=26+(i%3)*3;
    const g=new T.Mesh(new T.IcosahedronGeometry(.9+H.rand()*1.7,0),i%4?mats.stone:mats.gold);
    g.position.set(Math.sin(a)*r,Math.cos(a)*r,-1-H.rand()*3);g.rotation.set(H.rand(),H.rand(),H.rand());portal.add(g);
    floatStones.push({mesh:g,base:g.position.clone(),phase:H.rand()*Math.PI*2});
  }
  const particlePositions=new Float32Array(210*3),particleBase=[];
  for(let i=0;i<210;i++){
    const a=H.rand()*Math.PI*2,r=5+H.rand()*37;
    const p=[Math.sin(a)*r,Math.cos(a)*r,(H.rand()-.5)*12];
    particlePositions.set(p,i*3);particleBase.push(p);
  }
  const particleGeo=new T.BufferGeometry();particleGeo.setAttribute('position',new T.BufferAttribute(particlePositions,3));
  const particles=new T.Points(particleGeo,new T.PointsMaterial({color:0xa0fff2,size:.35,transparent:true,opacity:.72,depthWrite:false,blending:T.AdditiveBlending}));portal.add(particles);
  let portalActive=false;
  function setPortalActive(value){portalActive=!!value;}
  function update(time,dt,options){
    const delta=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.1));
    portalUniforms.uTime.value=time;
    portalUniforms.uActive.value=T.MathUtils.damp(portalUniforms.uActive.value,portalActive?1:.35,2,delta);
    ringA.rotation.z=Math.sin(time*.07)*.06;
    ringB.rotation.z=time*(portalActive?.1:.026);
    particles.rotation.z=-time*.025;
    inner.scale.setScalar(1+Math.sin(time*1.1)*.008);
    for(const f of floatStones){
      f.mesh.position.y=f.base.y+Math.sin(time*.55+f.phase)*.8;
      f.mesh.rotation.x+=delta*.08;
      f.mesh.rotation.z+=delta*.03;
    }
    waterMat.color.setHSL(.53,.49,.12+Math.sin(time*.4)*.006);
    if(options&&Number.isFinite(options.progress))setProgress(options.progress);
  }

  // A small destination vignette; never presented as the complete historical map.
  const pastGroup=new T.Group();pastGroup.name='Ha-yeon historical arrival vignette';scene.add(pastGroup);
  const pm={
    grass:H.mat('past-grass',0x737b4c,0,{roughness:1}),
    earth:H.mat('past-earth',0x91806b,0,{roughness:1}),
    wall:H.mat('past-wall',0xadad91,0,{roughness:1}),
    tile:H.mat('past-tile',0x354d4d,0,{roughness:.85}),
    wood:H.mat('past-wood',0x624535,0,{roughness:.95}),
    banner:H.mat('past-banner',0x8e4434,0,{roughness:.8}),
    leaf:H.mat('past-leaf',0x566647,0,{roughness:1}),
    mist:H.mat('past-mountain',0x7d8d7a,0,{roughness:1})
  };
  H.cyl(pastGroup,0,-624,-10,133,139,8,pm.grass,72);
  H.box(pastGroup,0,-619.8,20,17,.4,100,pm.earth);
  // Defensive wall with a central gate and tiled watch pavilions.
  for(const x of [-55,55]){
    H.box(pastGroup,x,-610,-43,79,20,9,pm.wall);
    H.box(pastGroup,x,-599,-43,82,2,11,pm.wall);
    for(let i=0;i<10;i++)H.box(pastGroup,x-36+i*8,-596,-43,5,5,9,pm.wall);
    for(let row=0;row<5;row++)for(let i=0;i<10;i++){
      H.box(pastGroup,x-36+i*8+(row%2?1:0),-617+row*3.7,-38.43,7.5,.09,.15,pm.earth);
    }
  }
  function roof(parent,x,y,z,w,d,mat){
    const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(-w*.32,2.4);shape.lineTo(0,6.5);shape.lineTo(w*.32,2.4);shape.lineTo(w/2,0);shape.lineTo(w*.42,-.7);shape.lineTo(0,4.8);shape.lineTo(-w*.42,-.7);shape.closePath();
    const g=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);
    H.mesh(parent,g,mat,x,y,z);
    H.box(parent,x,y+6.6,z,.6,.65,d+1,pm.tile);
    for(let i=0;i<11;i++)H.box(parent,x-w*.4+i*w*.08,y+.1,z, .18,.18,d+.6,pm.tile);
  }
  function pavilion(x,z,w=24,d=18){
    for(const dx of [-w*.34,w*.34])for(const dz of [-d*.33,d*.33])H.box(pastGroup,x+dx,-592,z+dz,1.3,13,1.3,pm.wood);
    H.box(pastGroup,x,-596,z,w*.8,4,d*.8,pm.wall);
    roof(pastGroup,x,-585,z,w,d,pm.tile);
  }
  for(const x of [-86,86]){
    H.box(pastGroup,x,-608,-43,21,24,23,pm.wall);pavilion(x,-43,30,25);
  }
  H.box(pastGroup,-11,-607,-43,7,26,16,pm.wall);H.box(pastGroup,11,-607,-43,7,26,16,pm.wall);
  H.box(pastGroup,0,-593,-43,29,4,16,pm.wall);pavilion(0,-43,37,27);
  H.box(pastGroup,-4.7,-611,-35.1,8.4,18,1.5,pm.wood);H.box(pastGroup,4.7,-611,-35.1,8.4,18,1.5,pm.wood);
  for(const x of [-8,-2,2,8])for(const y of [-617,-613,-609,-605])H.box(pastGroup,x,y,-34.2,.35,.35,.25,mats.gold);
  for(const x of [-27,27]){
    H.box(pastGroup,x,-607,-21,.35,26,.35,pm.wood);
    H.box(pastGroup,x+2.8,-599,-21,5.5,9,.14,pm.banner);
    H.box(pastGroup,x+2.8,-598.7,-20.9,.5,5,.05,mats.gold);
  }
  for(let k=0;k<4;k++){
    const x=k<2?-50:50,z=10+(k%2)*27;
    H.box(pastGroup,x,-615,z,22,9,17,pm.earth);
    roof(pastGroup,x,-610.5,z,27,21,pm.tile);
    H.box(pastGroup,x,-616,z+8.6,5,7,.3,pm.wood);
  }
  for(let i=0;i<20;i++){
    const a=i/20*Math.PI*2,r=100+H.rand()*17,x=Math.sin(a)*r,z=Math.cos(a)*r-15;
    if(z<-40&&Math.abs(x)<95)continue;
    const h=13+H.rand()*10;
    H.cyl(pastGroup,x,-620+h*.3,z,.7,1,h*.6,pm.wood,7);
    H.mesh(pastGroup,new T.ConeGeometry(5+H.rand()*3,h*.8,7),pm.leaf,x,-620+h*.74,z);
  }
  for(let i=0;i<6;i++){
    H.mesh(pastGroup,new T.ConeGeometry(37+H.rand()*14,42+H.rand()*45,5),pm.mist,-120+i*48,-603,-118-H.rand()*16);
  }
  // A small arch on this side makes the arrival point legible in the vignette.
  ruinArch(pastGroup,0,-620,64,17,23,4,pm.wall);
  H.box(pastGroup,0,-619,64,26,2,14,pm.wall);
  pastGroup.visible=false;
  const pastCamera={position:[103,-553,127],target:[0,-606,-23]};
  return {
    route,routeLength,railRoot,trainRoot,portal,pastGroup,pastCamera,stations,structuralSurfaces,
    sampleTrain,setProgress,getTrainPose,passengerPose,update,setPortalActive,
    stats:{trainCars:4,crewCars:1,oreCars:2,routeLengthMeters:Math.round(routeLength),stations:3,railTurns:3,gateDepth:620},
    anchors:[
      {label:'심층 채굴장',position:[-117,-336,-39]},
      {label:'380년의 지층',position:[0,-453,-96]},
      {label:'시간의 문',position:[0,-566,-34]}
    ]
  };
};

/* Grounded navigation for THE HOLLOW BELOW. Coordinates are character feet. */
function createHollowNavigation(ctx) {
  'use strict';
  const {THREE:T,roots,H,rail}=ctx;
  const V=(a)=>a&&a.isVector3?a.clone():new T.Vector3(...a);
  const UP=new T.Vector3(0,1,0),stepPrevious=new T.Vector3(),CELL=16,EPS=.025;
  const constants=Object.freeze({radius:.42,height:1.8,walkSpeed:5.4,runSpeed:7.4,gravity:22,jumpSpeed:7.1,maxStep:.65});
  const surfaces=[],colliders=[],surfaceGrid=new Map(),wallGrid=new Map();
  const checkpoints=[],waypoints=[],stationPoints=[];
  const stats={surfaces:0,colliders:0,visibleSteps:0,visibleConnectors:0};
  let currentEra='present',battlefield=null,surfacePolicy=null,serial=0;
  const navMaterials={
    floor:H.mat('walk-service-deck',0x526467,0,{roughness:.82,metalness:.2}),
    stone:H.mat('walk-ancient-stone',0x85958e,0,{roughness:.92}),
    rail:H.mat('walk-service-railing',0x4c6466,0,{roughness:.55,metalness:.55}),
    lamp:H.mat('walk-guidance',0xffce8e,0xd88935,{emissiveIntensity:.85,roughness:.5})
  };
  const visuals={};
  for(const name of ['surface','industry','city','mines','ruins','gate']){
    const g=new T.Group();g.name='walkable-'+name;roots[name].add(g);visuals[name]=g;
  }
  const indexes={surface:surfaceGrid,wall:wallGrid};
  function gridInsert(map,item){
    const x0=Math.floor(item.minX/CELL),x1=Math.floor(item.maxX/CELL),z0=Math.floor(item.minZ/CELL),z1=Math.floor(item.maxZ/CELL);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
      const key=x+','+z;if(!map.has(key))map.set(key,[]);map.get(key).push(item);
    }
  }
  const emptyCell=Object.freeze([]);
  function nearby(map,x,z,r=0){
    const x0=Math.floor((x-r)/CELL),x1=Math.floor((x+r)/CELL),z0=Math.floor((z-r)/CELL),z1=Math.floor((z+r)/CELL);
    // Buckets contain each collider once and callers only read them. Most
    // foot, bullet and camera probes stay in one cell, so borrow that bucket.
    if(x0===x1&&z0===z1)return map.get(x0+','+z0)||emptyCell;
    const out=[],seen=new Set();
    for(let gx=x0;gx<=x1;gx++)for(let gz=z0;gz<=z1;gz++){
      for(const item of map.get(gx+','+gz)||[]){if(!seen.has(item)){seen.add(item);out.push(item);}}
    }return out;
  }
  function registerSurface(s){
    s.id=s.id||'surface-'+(++serial);s.era=s.era||'present';surfaces.push(s);gridInsert(surfaceGrid,s);stats.surfaces=surfaces.length;return s;
  }
  function addRect(o){
    const x=o.x||0,z=o.z||0,w=o.width,d=o.depth,y=o.y,ry=o.rotationY||o.ry||0,c=Math.cos(ry),s=Math.sin(ry);
    const hx=w/2,hz=d/2,ex=Math.abs(c)*hx+Math.abs(s)*hz,ez=Math.abs(s)*hx+Math.abs(c)*hz;
    return registerSurface({id:o.id,era:o.era,type:'rect',minX:x-ex,maxX:x+ex,minZ:z-ez,maxZ:z+ez,minY:y,maxY:y,
      heightAt(px,pz){const dx=px-x,dz=pz-z,lx=c*dx-s*dz,lz=s*dx+c*dz;return Math.abs(lx)<=hx+EPS&&Math.abs(lz)<=hz+EPS?y:null;}});
  }
  function addRamp(o){
    const a=V(o.a),b=V(o.b),dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,L=Math.sqrt(l2),w=o.width;
    if(L<.001)return addRect({id:o.id,era:o.era,x:a.x,z:a.z,y:a.y,width:w,depth:w});
    const sx=-dz/L*w/2,sz=dx/L*w/2;
    return registerSurface({id:o.id,era:o.era,type:'ramp',a,b,width:w,minX:Math.min(a.x,b.x)-Math.abs(sx),maxX:Math.max(a.x,b.x)+Math.abs(sx),minZ:Math.min(a.z,b.z)-Math.abs(sz),maxZ:Math.max(a.z,b.z)+Math.abs(sz),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y),
      heightAt(x,z){const px=x-a.x,pz=z-a.z,t=(px*dx+pz*dz)/l2,side=(-dz*px+dx*pz)/L;return t>=-EPS/L&&t<=1+EPS/L&&Math.abs(side)<=w/2+EPS?a.y+(b.y-a.y)*T.MathUtils.clamp(t,0,1):null;}});
  }
  function addCircle(o){return registerSurface({id:o.id,era:o.era,type:'circle',minX:o.x-o.radius,maxX:o.x+o.radius,minZ:o.z-o.radius,maxZ:o.z+o.radius,minY:o.y,maxY:o.y,heightAt(x,z){return Math.hypot(x-o.x,z-o.z)<=o.radius+EPS?o.y:null;}});}
  function addSector(o){
    const pi2=Math.PI*2,normalize=a=>(a%pi2+pi2)%pi2,start=normalize(o.start),extent=o.end-o.start;
    return registerSurface({id:o.id,era:o.era,type:'sector',minX:-o.outer,maxX:o.outer,minZ:-o.outer,maxZ:o.outer,minY:o.y,maxY:o.y,
      heightAt(x,z){const r=Math.hypot(x,z),a=normalize(Math.atan2(x,z)-start);return r>=o.inner-EPS&&r<=o.outer+EPS&&a<=extent+EPS/Math.max(r,1)?o.y:null;}});
  }
  function addBox(o){
    const center=o.center?V(o.center):new T.Vector3(o.x,o.y,o.z),size=o.size||[o.hx*2,o.hy*2,o.hz*2];
    const ry=o.rotationY!==undefined?o.rotationY:o.ry||0,c=Math.cos(ry),s=Math.sin(ry),hx=size[0]/2,hy=size[1]/2,hz=size[2]/2;
    const ex=Math.abs(c)*hx+Math.abs(s)*hz,ez=Math.abs(s)*hx+Math.abs(c)*hz;
    const box={id:o.id||'wall-'+(++serial),label:o.label||'',type:'obb',era:o.era||'present',x:center.x,y:center.y,z:center.z,hx,hy,hz,ry,c,s,minX:center.x-ex,maxX:center.x+ex,minY:center.y-hy,maxY:center.y+hy,minZ:center.z-ez,maxZ:center.z+ez};
    colliders.push(box);gridInsert(wallGrid,box);stats.colliders=colliders.length;
    if(o.walkableTop)addRect({id:box.id+'-top',era:box.era,x:center.x,z:center.z,y:box.maxY,width:hx*2,depth:hz*2,rotationY:ry});
    return box;
  }
  function sampleGround(x,z,referenceY=Infinity,maxStep=constants.maxStep){
    let best=null;const ceiling=referenceY+maxStep;
    for(const s of nearby(surfaceGrid,x,z)){
      if(s.era!==currentEra||s.minY>ceiling+.001)continue;
      const y=s.heightAt(x,z);if(y===null||!Number.isFinite(y)||y>ceiling+.001)continue;
      if(!best||y>best.height)best={height:y,id:s.id,type:s.type,surface:s};
    }
    // A capsule can contact a curb before its center crosses the rectangle edge.
    // Support uses the real foot disk, allowing source-game low platforms to step up.
    for(const box of nearby(wallGrid,x,z,constants.radius)){
      if(box.era!==currentEra||box.maxY>ceiling+.001||best&&box.maxY<=best.height)continue;
      const dx=x-box.x,dz=z-box.z,lx=box.c*dx-box.s*dz,lz=box.s*dx+box.c*dz;
      const ex=Math.max(0,Math.abs(lx)-box.hx),ez=Math.max(0,Math.abs(lz)-box.hz);
      if(ex*ex+ez*ez<(constants.radius+.015)**2)best={height:box.maxY,id:box.id+'-top',type:'box',surface:box};
    }
    if(currentEra==='present'&&battlefield&&battlefield.getHeight){
      const raw=battlefield.getHeight(x,z,referenceY,maxStep),y=typeof raw==='number'?raw:raw&&raw.height;
      if(Number.isFinite(y)&&y<=ceiling+.001&&(!best||y>best.height))best={height:y,id:'battlefield-terrain',type:'terrain',surface:null};
    }
    return best;
  }
  function groundAt(x,z,referenceY=Infinity,maxStep=constants.maxStep){const s=sampleGround(x,z,referenceY,maxStep);return s?s.height:null;}
  function setEra(era){currentEra=era==='past'?'past':'present';return currentEra;}
  // The host may subtract accepted façade cuts only after these original OBB
  // tests succeed. Undefined answers retain the native collision. Support
  // heights never consult this policy, so floor/roof selection stays intact.
  function setSurfacePolicy(value){surfacePolicy=value&&typeof value==='object'?value:null;}
  function surfaceBodyBlocked(box,x,y,z,r,height){return surfacePolicy?.bodyBlocked?.(box,x,y,z,r,height)!==false;}
  function setBattlefield(b){
    if(!b||battlefield===b)return;
    battlefield=b;
    for(const c of b.colliders||[])addBox({...c,walkableTop:false,era:'present'});
    if(Array.isArray(b.waypoints)&&b.waypoints.length){
      const prefix=b.waypoints.map((p,i)=>({id:p.id||'battlefield-'+i,label:p.label||'전장 진입로',position:p.position.slice(),era:'present'}));
      waypoints.unshift(...prefix);
      const first=prefix[0];if(!checkpoints.some(c=>c.id==='battlefield'))checkpoints.unshift({id:'battlefield',label:'적 후방 진입로',position:first.position.slice(),era:'present'});
    }
  }
  function overlapsXZ(box,p,r=constants.radius){
    const dx=p.x-box.x,dz=p.z-box.z,lx=box.c*dx-box.s*dz,lz=box.s*dx+box.c*dz;
    const qx=T.MathUtils.clamp(lx,-box.hx,box.hx),qz=T.MathUtils.clamp(lz,-box.hz,box.hz);
    return (lx-qx)**2+(lz-qz)**2<r*r;
  }
  function refineSurfaceContact(box,p,velocity,previous,r,height){
    if(!previous)return false;
    const overlaps=(x,y,z)=>box.maxY>y+.075&&box.minY<y+height-.015&&overlapsXZ(box,{x,z},r);
    if(!overlaps(p.x,p.y,p.z)||surfacePolicy?.bodyBlocked?.(box,p.x,p.y,p.z,r,height)!==true)return false;
    const blocked=(x,y,z)=>overlaps(x,y,z)&&surfaceBodyBlocked(box,x,y,z,r,height);
    if(blocked(previous.x,previous.y,previous.z))return false;
    const dx=p.x-previous.x,dy=p.y-previous.y,dz=p.z-previous.z;
    // Only a damaged collider whose preceding substep pose was clear reaches
    // this branch. Stop at its retained crater material, rather than pushing
    // all the way back to the original building's outer OBB face.
    let lo=0,hi=1;
    for(let i=0;i<10;i++){const t=(lo+hi)/2;if(blocked(previous.x+dx*t,previous.y+dy*t,previous.z+dz*t))hi=t;else lo=t;}
    p.x=previous.x+dx*lo;p.y=previous.y+dy*lo;p.z=previous.z+dz*lo;
    const distance2=dx*dx+dy*dy+dz*dz,dot=velocity.x*dx+velocity.y*dy+velocity.z*dz;
    if(distance2>1e-16&&dot>0){const k=dot/distance2;velocity.x-=dx*k;velocity.y-=dy*k;velocity.z-=dz*k;}
    return true;
  }
  function resolveWalls(p,velocity,r=constants.radius,height=constants.height,previous=null){
    let damaged=null;
    for(let pass=0;pass<3;pass++){
      let moved=false;
      for(const box of nearby(wallGrid,p.x,p.z,r+.1)){
        if(box.era!==currentEra||box.maxY<=p.y+.075||box.minY>=p.y+height-.015)continue;
        const dx=p.x-box.x,dz=p.z-box.z,lx=box.c*dx-box.s*dz,lz=box.s*dx+box.c*dz;
        const qx=T.MathUtils.clamp(lx,-box.hx,box.hx),qz=T.MathUtils.clamp(lz,-box.hz,box.hz);
        let nx=lx-qx,nz=lz-qz,dist=Math.hypot(nx,nz),push=0;
        if(dist>=r)continue;
        const mask=surfacePolicy?.bodyBlocked?.(box,p.x,p.y,p.z,r,height);
        if(typeof mask==='boolean'){if(!damaged)damaged=[box];else if(!damaged.includes(box))damaged.push(box);}
        if(mask===false)continue;
        if(mask===true&&refineSurfaceContact(box,p,velocity,previous,r,height)){moved=true;continue;}
        if(dist>.00001){nx/=dist;nz/=dist;push=r-dist+.001;}
        else {const ex=box.hx-Math.abs(lx),ez=box.hz-Math.abs(lz);if(ex<ez){nx=lx>=0?1:-1;nz=0;push=r+ex+.001;}else{nx=0;nz=lz>=0?1:-1;push=r+ez+.001;}}
        const wx=box.c*nx+box.s*nz,wz=-box.s*nx+box.c*nz;
        p.x+=wx*push;p.z+=wz*push;
        const dot=velocity.x*wx+velocity.z*wz;if(dot<0){velocity.x-=dot*wx;velocity.z-=dot*wz;}moved=true;
      }
      if(!moved)break;
    }
    return damaged;
  }
  function bodyClear(x,y,z,r=constants.radius,height=constants.height){
    if(![x,y,z,r,height].every(Number.isFinite))return false;
    for(const box of nearby(wallGrid,x,z,r)){
      if(box.era!==currentEra||box.maxY<=y+.025||box.minY>=y+height-.015)continue;
      if(overlapsXZ(box,{x,z},Math.max(0,r-.004))&&surfaceBodyBlocked(box,x,y,z,r,height))return false;
    }
    // A raised surface may have no OBB (curved decks and ramps). Its visible
    // skin must still not pass through a restored standing body.
    for(const surface of nearby(surfaceGrid,x,z)){
      if(surface.era!==currentEra||surface.maxY<=y+.025||surface.minY-.4>=y+height-.015)continue;
      const floor=surface.heightAt(x,z);
      if(Number.isFinite(floor)&&floor>y+.025&&floor-.4<y+height-.015)return false;
    }
    return true;
  }
  function step(state,input={},dt=1/60){
    if(!state.position)state.position=new T.Vector3(0,0,-80);
    if(!state.velocity)state.velocity=new T.Vector3();
    const p=state.position,v=state.velocity;state.landedSpeed=0;
    const move=input.worldVelocity||input.move||{x:0,z:0};
    let mx=Number(move.x)||0,mz=Number(move.z)||0;
    const mag=Math.hypot(mx,mz),speed=input.worldVelocity?1:(Number.isFinite(input.speed)?input.speed:(input.run?constants.runSpeed:constants.walkSpeed))*(Number.isFinite(input.speedScale)?input.speedScale:1);
    if(!input.worldVelocity&&mag>1){mx/=mag;mz/=mag;}
    const desiredX=mx*speed,desiredZ=mz*speed;
    const jump=!!input.jump&&!state._jumpHeld;state._jumpHeld=!!input.jump;
    if(jump&&state.grounded){v.y=constants.jumpSpeed;state.grounded=false;state._jumpStarted=true;}
    const elapsed=T.MathUtils.clamp(Number.isFinite(dt)?dt:1/60,0,.12),count=Math.max(1,Math.ceil(elapsed/(1/90))),h=elapsed/count;
    for(let n=0;n<count;n++){
      const wasGrounded=!!state.grounded,oldY=p.y;
      stepPrevious.copy(p);
      const blend=1-Math.exp(-(wasGrounded?18:6)*h);
      v.x+=(desiredX-v.x)*blend;v.z+=(desiredZ-v.z)*blend;
      p.x+=v.x*h;p.z+=v.z*h;
      let ground=sampleGround(p.x,p.z,oldY,constants.maxStep);
      if(wasGrounded&&v.y<=0&&ground&&ground.height>=oldY-.85){p.y=ground.height;v.y=0;}
      const damaged=resolveWalls(p,v,constants.radius,constants.height,stepPrevious);
      ground=sampleGround(p.x,p.z,oldY,constants.maxStep);
      if(wasGrounded&&v.y<=0&&ground&&ground.height>=oldY-.85){
        p.y=ground.height;v.y=0;state.grounded=true;state.floorId=ground.id;
      }else{
        state.grounded=false;v.y-=constants.gravity*h;
        let nextY=oldY+v.y*h;
        if(v.y>0){
          for(const box of nearby(wallGrid,p.x,p.z,constants.radius)){
            if(box.era!==currentEra||box.minY<oldY+constants.height-.015||box.minY>nextY+constants.height||!overlapsXZ(box,p))continue;
            nextY=Math.min(nextY,box.minY-constants.height-.01);v.y=0;
          }
        }
        const below=sampleGround(p.x,p.z,oldY,.08);
        if(v.y<=0&&below&&nextY<=below.height&&oldY>=below.height-.1){
          state.landedSpeed=Math.max(state.landedSpeed,-v.y);p.y=below.height;v.y=0;state.grounded=true;state.floorId=below.id;
        }else p.y=nextY;
      }
      // Reuse only damaged boxes already encountered above. This closes the
      // vertical part of the same accepted substep without another grid scan
      // or adding crater floors to the authored support-height system.
      if(damaged)for(const box of damaged)refineSurfaceContact(box,p,v,stepPrevious,constants.radius,constants.height);
      if(state.grounded){
        if(!state.safePosition)state.safePosition=p.clone();else state.safePosition.copy(p);
        state.fallStartY=p.y;state.fallDistance=0;
      }else{
        if(!Number.isFinite(state.fallStartY))state.fallStartY=oldY;
        state.fallDistance=Math.max(0,state.fallStartY-p.y);
      }
    }
    state.speed=Math.hypot(v.x,v.z);state.era=currentEra;state.needsRespawn=p.y<-680||!Number.isFinite(p.y);
    return state;
  }
  // Indexed projectile/contact lookup. OBB tests include the optional sphere
  // radius; floor tests use the walkable surface under the query point and a
  // 0.4-metre skin matching the visible decks (no invisible shaft-wide floor).
  function pointSolid(x,y,z,r=0){
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return null;
    const radius=Number.isFinite(r)?Math.max(0,r):0;
    for(const box of nearby(wallGrid,x,z,radius)){
      if(box.era!==currentEra||y<box.minY-radius||y>box.maxY+radius)continue;
      const dx=x-box.x,dz=z-box.z,lx=box.c*dx-box.s*dz,lz=box.s*dx+box.c*dz;
      const ex=Math.max(0,Math.abs(lx)-box.hx),ey=Math.max(0,Math.abs(y-box.y)-box.hy),ez=Math.max(0,Math.abs(lz)-box.hz);
      if(ex*ex+ey*ey+ez*ez<=radius*radius+1e-10&&surfacePolicy?.pointSolid?.(box,x,y,z,radius)!==false)return box;
    }
    for(const surface of nearby(surfaceGrid,x,z)){
      if(surface.era!==currentEra||y>surface.maxY+radius||y<surface.minY-.4-radius)continue;
      const floor=surface.heightAt(x,z);
      if(floor!==null&&Number.isFinite(floor)&&y<=floor+radius&&y>=floor-.4-radius)return surface;
    }
    return null;
  }
  function cameraDistance(target,desired,radius=.2){
    const a=V(target),b=V(desired),d=b.clone().sub(a),length=d.length();if(length<.001)return 0;
    const candidates=new Set();
    for(let gx=Math.floor((Math.min(a.x,b.x)-radius)/CELL);gx<=Math.floor((Math.max(a.x,b.x)+radius)/CELL);gx++)for(let gz=Math.floor((Math.min(a.z,b.z)-radius)/CELL);gz<=Math.floor((Math.max(a.z,b.z)+radius)/CELL);gz++)for(const box of wallGrid.get(gx+','+gz)||[])candidates.add(box);
    let closest=1;
    for(const box of candidates){
      if(box.era!==currentEra)continue;
      const dx=a.x-box.x,dz=a.z-box.z,origin=[box.c*dx-box.s*dz,a.y-box.y,box.s*dx+box.c*dz];
      const delta=[box.c*d.x-box.s*d.z,d.y,box.s*d.x+box.c*d.z],half=[box.hx+radius,box.hy+radius,box.hz+radius];
      let lo=0,hi=closest,valid=true;
      for(let k=0;k<3;k++){
        if(Math.abs(delta[k])<1e-9){if(Math.abs(origin[k])>half[k]){valid=false;break;}}
        else{let q0=(-half[k]-origin[k])/delta[k],q1=(half[k]-origin[k])/delta[k];if(q0>q1)[q0,q1]=[q1,q0];lo=Math.max(lo,q0);hi=Math.min(hi,q1);if(lo>hi){valid=false;break;}}
      }
      if(valid&&lo>=0&&lo<closest){
        const hit=surfacePolicy?.cameraHit?.(box,a,b,radius,lo,hi);
        if(hit===null)continue;
        closest=Number.isFinite(hit)&&hit>=lo&&hit<=hi?hit:lo;
      }
    }
    return Math.max(.55,length*closest-.12);
  }
  function checkpoint(id,label,position,era='present'){const c={id,label,position:position.slice(),era};checkpoints.push(c);return c;}
  function waypoint(position,id,label){waypoints.push({id:id||'walk-'+waypoints.length,label:label||'하강 통로',position:position.slice(),era:'present'});}
  function teleport(state,id){
    const c=typeof id==='string'?checkpoints.find(c=>c.id===id):id;if(!c)return false;
    setEra(c.era);state.position=state.position||new T.Vector3();state.velocity=state.velocity||new T.Vector3();state.position.set(...c.position);state.velocity.set(0,0,0);state.grounded=true;state.safePosition=state.position.clone();state.fallStartY=state.position.y;state.fallDistance=0;state.needsRespawn=false;state._jumpHeld=false;return true;
  }
  function wallSegment(a,b,height=1.35,thickness=.18,era='present'){
    const av=V(a),bv=V(b),delta=bv.clone().sub(av),flat=Math.hypot(delta.x,delta.z),n=Math.max(1,Math.ceil(flat/6));
    for(let i=0;i<n;i++){
      const p=av.clone().lerp(bv,i/n),q=av.clone().lerp(bv,(i+1)/n),m=p.clone().add(q).multiplyScalar(.5);
      addBox({center:[m.x,m.y+height/2,m.z],size:[thickness,height+Math.abs(q.y-p.y),flat/n+.08],rotationY:Math.atan2(delta.x,delta.z),era});
    }
  }
  function visiblePath(parent,a,b,width=6,options={}){
    const av=V(a),bv=V(b),dv=bv.clone().sub(av),flat=Math.hypot(dv.x,dv.z),length=dv.length(),yaw=Math.atan2(dv.x,dv.z),mat=options.stone?navMaterials.stone:navMaterials.floor;
    if(length<.001)return;
    if(options.steps&&Math.abs(dv.y)>.2){
      const n=Math.max(2,Math.ceil(Math.abs(dv.y)/.31));
      for(let i=0;i<n;i++){const p=av.clone().lerp(bv,(i+.5)/n);H.box(parent,p.x,p.y-.18,p.z,width,.36,flat/n+.08,mat,yaw);}
      stats.visibleSteps+=n;
    }else{
      const geo=new T.BoxGeometry(width,.6,length+.05),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),dv.clone().normalize());geo.applyQuaternion(q);
      const mid=av.clone().add(bv).multiplyScalar(.5);H.mesh(parent,geo,mat,mid.x,mid.y-.3,mid.z);
    }
    addRamp({id:options.id,a,b,width:width-.15,era:options.era});stats.visibleConnectors++;
    if(options.rails!==false){
      const side=new T.Vector3(-dv.z,0,dv.x).normalize().multiplyScalar(width/2-.08);
      for(const sign of [-1,1]){
        // Set rails back from junctions so an adjoining path is genuinely open.
        const inset=Math.min(width*.55,flat*.2),fraction=inset/Math.max(flat,.001);
        const p=av.clone().lerp(bv,fraction).addScaledVector(side,sign),q=bv.clone().lerp(av,fraction).addScaledVector(side,sign);
        H.beam(parent,[p.x,p.y+1.35,p.z],[q.x,q.y+1.35,q.z],.11,navMaterials.rail);
        const n=Math.max(1,Math.ceil((flat-inset*2)/5));
        for(let i=0;i<=n;i++){const x=p.clone().lerp(q,i/n);H.box(parent,x.x,x.y+.67,x.z,.15,1.5,.15,navMaterials.rail);}
        wallSegment(p.toArray(),q.toArray(),1.4,.16,options.era||'present');
      }
    }
  }
  function landing(parent,x,y,z,w,d,stone=false){
    H.box(parent,x,y-.4,z,w,.8,d,stone?navMaterials.stone:navMaterials.floor);addRect({x,z,y,width:w,depth:d});
  }
  function visibleSwitchback(parent,{xMin,xMax,yTop,yBottom,zStart,flights,width=6,stepZ=8,idPrefix,stone=false}){
    const dy=(yBottom-yTop)/flights;let last=null;
    for(let j=0;j<flights;j++){
      const leftFirst=j%2===0,a=[leftFirst?xMax:xMin,yTop+dy*j,zStart+j*stepZ],b=[leftFirst?xMin:xMax,yTop+dy*(j+1),zStart+j*stepZ];
      if(j===0)waypoint(a,idPrefix+'-top');
      visiblePath(parent,a,b,width,{steps:true,stone,id:idPrefix+'-'+j});waypoint(b,idPrefix+'-'+j);
      const outward=leftFirst?-1:1,landingX=b[0]+outward*3;
      // Keep a one-metre shoulder past the flight end. The native controller
      // retains horizontal momentum while turning; a flush six-metre landing
      // let a returning runner overshoot the support by a few centimetres.
      landing(parent,landingX,b[1],b[2]+stepZ/2,8,Math.abs(stepZ)+width,stone);
      const corner=[b[0]+outward*2,b[1],b[2]+stepZ/2],next=[b[0],b[1],b[2]+stepZ];
      waypoint(corner);waypoint(next);last=next;
    }return last;
  }
  function existingFlight(parent,a,b,width,lead=4.9,stone=false){
    const av=V(a),bv=V(b),flat=Math.hypot(bv.x-av.x,bv.z-av.z),t=Math.min(.22,lead/flat),mid=av.clone().lerp(bv,t);mid.y=av.y;
    visiblePath(parent,a,mid.toArray(),width,{rails:false,stone});
    visiblePath(parent,mid.toArray(),b,width,{steps:true,stone});
    waypoint(a);waypoint(mid.toArray());waypoint(b);
  }

  // Existing surface and fort entrance.
  for(const x of [-55,55]){addRect({x,z:-96,width:100,depth:100,y:0});addBox({center:[x,-5,-96],size:[100,10,100]});}
  addRect({x:0,z:-115,width:10,depth:62,y:0});addRect({x:0,z:-51,width:10,depth:10,y:0});
  addBox({center:[0,-5,-115],size:[10,10,62]});addBox({center:[0,-5,-51],size:[10,10,10]});
  for(const x of [-10.25,10.25])addRect({x,z:-20,width:10.5,depth:100,y:0});
  addRect({id:'surface-road',x:0,z:-13,width:10,depth:86,y:0});
  addRamp({a:[-14,0,-40],b:[-38,0,4],width:8});addRect({x:-48,z:8,width:32,depth:22,y:0});
  // The diagonal access deck met the rectangular entrance only at an angle.
  // Close the exposed metre-wide seam with a real, visible junction slab;
  // its matching volume also supports old saves located over that seam.
  H.box(visuals.surface,-14,-.3,-40,9,.6,8,navMaterials.floor);
  addBox({id:'surface-access-junction',center:[-14,-.3,-40],size:[9,.6,8],walkableTop:true});
  for(const x of [-26,26])addBox({center:[x,12,-72],size:[23,24,33]});
  for(const x of [-54,54])addBox({center:[x,8,-75],size:[15,16,17]});
  addBox({center:[0,12,-90],size:[31,23,2]});addBox({center:[0,25,-72],size:[76,8,38]});
  for(const x of [-12.8,12.8])addBox({center:[x,10,-56],size:[5.7,20,2]});
  checkpoint('entrance','봉쇄갱 입구',[0,0,-52]);
  [[0,0,-52],[0,0,-56],[0,-14,-80],[-66,-14,-80],[-60,-14,26]].forEach(p=>waypoint(p));
  visiblePath(visuals.surface,[0,0,-56],[0,-14,-80],8,{steps:true});
  visiblePath(visuals.surface,[0,-14,-80],[-66,-14,-80],6);
  visiblePath(visuals.surface,[-66,-14,-80],[-60,-14,26],6);
  landing(visuals.surface,-63,-14,26,6,6);
  const firstEnd=visibleSwitchback(visuals.industry,{xMin:-106,xMax:-66,yTop:-14,yBottom:-90,zStart:26,flights:6,width:6,stepZ:-8,idPrefix:'access'});
  visiblePath(visuals.industry,firstEnd,[-130,-90,-22],6);
  visiblePath(visuals.industry,[-130,-90,-22],[-130,-90,18],6);
  waypoint([-130,-90,-22]);waypoint([-130,-90,18]);

  // B1 decks and collision volumes, followed by the existing six stair flights.
  addSector({id:'industry-ring',y:-90,inner:83,outer:154,start:Math.PI*.49,end:Math.PI*1.47});
  addRect({x:-99,z:-13,width:78,depth:75,y:-90});addRect({x:-99,z:-13,width:60,depth:53,y:-89.9});
  addRamp({a:[-60,-90,-36],b:[65,-90,-50],width:8});
  addBox({center:[74,-76,-106],size:[65,28,37]}).hollowSurfaceId='structure-winding-house';
  for(const x of [-74,-111])for(const z of [-13,12])addBox({center:[x,-107,z],size:[1.8,230,1.8]});
  for(const x of [-103,-81])for(const z of [-9,9])addBox({center:[x,-83,z],size:[.8,16,.8]});
  checkpoint('industry','권양기 갱도',[-96,-90,27]);
  waypoint([-130,-90,18]);waypoint([-96,-90,18]);
  visiblePath(visuals.industry,[-96,-90,18],[-96,-90,27],6);
  landing(visuals.industry,-99,-90,27,6,6);
  waypoint([-96,-90,27]);waypoint([-102,-90,27]);
  const industryEnd=visibleSwitchback(visuals.industry,{xMin:-130,xMax:-102,yTop:-90,yBottom:-220,zStart:27,flights:6,width:6,stepZ:8,idPrefix:'industry-descent'});
  visiblePath(visuals.city,industryEnd,[-105,-220,34],6);

  // City support follows the visible crescent, streets and suspended bridges.
  addSector({id:'city-ring',y:-220,inner:69,outer:160,start:Math.PI*.37,end:Math.PI*1.64});
  addSector({id:'city-rear',y:-207,inner:115,outer:160,start:Math.PI*.64,end:Math.PI*1.37});
  addRamp({a:[-105,-220,34],b:[97,-220,34],width:6.2});
  for(const [a,b] of [[[-58,-220,-61],[-32,-220,-8]],[[-32,-220,-8],[31,-220,-8]],[[31,-220,-8],[57,-220,-62]],[[-42,-220,-80],[-42,-207,-118]],[[54,-220,-82],[54,-207,-118]]])addRamp({a,b,width:6});
  addCircle({id:'city-plaza',x:0,z:-7,y:-220,radius:18});addBox({center:[0,-218.5,-7],size:[13,3,13],walkableTop:true});
  const building=(x,y,z,w,d,floors,ry=0)=>addBox({id:'building-'+x+'-'+z,center:[x,y+floors*3.2,z],size:[w+1,floors*6.4,d+1],rotationY:ry});
  for(let i=0;i<11;i++)building(-124+i*24.8,-220,-103+Math.cos(i*.6)*7,19.5,20,3+i%4);
  for(let i=0;i<7;i++)building(-89+i*29.7,-207,-139,22,20,3+i%3);
  for(let i=0;i<5;i++){building(-131,-220,-55+i*23,21,22,3+i%3,.45);if(i<4)building(132,-220,-52+i*25,20,21,3+(i+1)%3,-.48);}
  addBox({center:[-57,-194,-68],size:[13,52,13]});
  for(let i=0;i<5;i++)addBox({center:[-112+i*8.3,-218.4,2],size:[6,3.2,3.3]});
  [[-105,-220,34],[-25,-220,34],[86,-220,34]].forEach(p=>waypoint(p));
  checkpoint('city','잔향구 공중교',[-25,-220,34]);
  // Access to the raised station approach is an actual short flight of steps.
  const firstStation=rail&&rail.stations&&rail.stations[0],railStart=firstStation?V(firstStation.position):new T.Vector3(170.3916,-218,30.321);
  const approachEnd=railStart.x-11,approachZ=railStart.z;
  addBox({id:'city-station-approach',center:[(approachEnd+95)/2,-220,approachZ],size:[approachEnd-95,2.1,8],walkableTop:true});
  addBox({id:'city-station-approach-turn',center:[98,-220,(approachZ+34)/2],size:[8,2.1,Math.abs(approachZ-34)+8],walkableTop:true});
  visiblePath(visuals.city,[86,-220,34],[94,-218.95,34],5.8,{steps:true});
  waypoint([94,-218.95,34]);waypoint([100,-218.95,34]);
  visiblePath(visuals.city,[102,-218.95,37],[107,-220,43],6,{steps:true});
  visiblePath(visuals.city,[107,-220,43],[144,-220,55],6);
  visiblePath(visuals.city,[144,-220,55],[144,-220,65],6);
  landing(visuals.city,141,-220,65,6,5.8);
  waypoint([102,-218.95,37]);waypoint([107,-220,43]);waypoint([144,-220,55]);waypoint([144,-220,65]);waypoint([138,-220,65]);
  // Precise station platforms; these also provide grounded boarding locations.
  if(rail&&rail.stations)for(let i=0;i<rail.stations.length;i++){
    const s=rail.stations[i],p=V(s.position),pose=rail.sampleTrain(s.t),inward=new T.Vector3(-p.x,0,-p.z).normalize(),q=p.clone().addScaledVector(inward,8.2),yaw=Math.atan2(pose.direction.x,pose.direction.z),floor=p.y-.29;
    // Match both rendered blocks: the concrete body and its thin wearing course.
    // A support-only rectangle let a body enter the high platform from the side.
    addBox({id:'station-'+i+'-body',center:[q.x,p.y-1.4,q.z],size:[11,1.8,27],rotationY:yaw});
    addBox({id:'station-'+i,center:[q.x,p.y-.38,q.z],size:[11.1,.18,27.1],rotationY:yaw,walkableTop:true});
    stationPoints.push({id:'station-'+i,name:s.name,t:s.t,position:[q.x,floor,q.z],trainPosition:p.toArray(),radius:12});
    checkpoint('station-'+i,s.name,[q.x,floor,q.z]);
    if(i===0)visiblePath(visuals.city,[153,-218.95,approachZ],[159,floor,approachZ],5.5,{steps:true,rails:false});
  }
  const cityEnd=visibleSwitchback(visuals.city,{xMin:110,xMax:138,yTop:-220,yBottom:-350,zStart:65,flights:7,width:5.8,stepZ:-8,idPrefix:'city-descent'});
  addRamp({a:[110,-350,9],b:[98,-350,0],width:7});
  visiblePath(visuals.mines,cityEnd,[98,-350,0],7);waypoint([98,-350,0]);

  // Mine yard supports reproduce the excavated rail slot, rather than filling it.
  const corridor=[];
  if(rail)for(let i=0;i<=1700;i++)corridor.push(rail.sampleTrain(i/1700).position);
  function cutSupport(x,y,z,w,h,d){
    const relevant=corridor.filter(p=>p.y>=y-h/2-4.4&&p.y<=y+h/2+.2),nx=Math.ceil(w/5),nz=Math.ceil(d/5),sx=w/nx,sz=d/nz,clearance=2+Math.hypot(sx,sz)/2+.8;
    for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
      const px=x-w/2+(ix+.5)*sx,pz=z-d/2+(iz+.5)*sz;
      if(relevant.some(p=>Math.hypot(p.x-px,p.z-pz)<clearance))continue;
      addRect({x:px,z:pz,y:y+h/2,width:sx+.025,depth:sz+.025});
    }
  }
  cutSupport(-119,-352,-45,65,7,75);cutSupport(-119,-348.3,-43,62,.3,73);
  addRect({x:119,z:-65,width:67,depth:67,y:-349});
  for(let k=0;k<3;k++)cutSupport(-125+k*24,-351,-100,17,2,38);
  for(const [index,[x,z,w,d]] of [[-128,-60,22,23],[-100,-61,18,23],[112,-77,25,25]].entries()){
    const y=x>0?-349:-348;
    const id='structure-mine-bunker-'+index+'-';
    addBox({center:[x-w/2,y+6,z],size:[2,12,d]}).hollowSurfaceId=id+'left';
    addBox({center:[x+w/2,y+6,z],size:[2,12,d]}).hollowSurfaceId=id+'right';
    addBox({center:[x,y+5,z-d/2+1],size:[w,10,2]}).hollowSurfaceId=id+'back';
  }
  for(let i=0;i<7;i++)addBox({center:[-139+i*7,-344,-19],size:[3.6,7,3.6]});
  visiblePath(visuals.mines,[98,-350,0],[98,-350,-25],6);
  visiblePath(visuals.mines,[98,-350,-25],[98,-349,-34],6,{steps:true});
  visiblePath(visuals.mines,[98,-350,0],[-125,-348.15,-10],6.4);
  waypoint([-125,-348.15,-10]);waypoint([-121.5,-348.15,-26]);
  const mineStop=stationPoints[1]||{position:[-134.57,-348.29,-23.98]};
  waypoint([-134.5,-348.15,-26],'mine-platform','심층채굴역');
  checkpoint('mines','심층 채굴장',[-121.5,-348.15,-26]);
  // Optional walking route to the ruins, independent of riding the mine train.
  waypoint([-121.5,-348.15,-26]);waypoint([-121.5,-348.15,-10]);waypoint([-125,-348.15,-10]);
  visiblePath(visuals.mines,[-125,-348.15,-10],[-135,-348.15,-10],6);
  visiblePath(visuals.mines,[-135,-348.15,-10],[-135,-348.15,4],6);
  visiblePath(visuals.mines,[-135,-348.15,4],[-70,-348.15,4],6);
  visiblePath(visuals.mines,[-70,-348.15,4],[-70,-348.15,12],6);
  landing(visuals.mines,-73,-348.15,12,6,6,true);
  waypoint([-135,-348.15,-10]);waypoint([-135,-348.15,4]);waypoint([-70,-348.15,4]);waypoint([-70,-348.15,12]);waypoint([-76,-348.15,12]);
  const lowerEnd=visibleSwitchback(visuals.mines,{xMin:-116,xMax:-76,yTop:-348.15,yBottom:-480,zStart:12,flights:6,width:6,stepZ:8,idPrefix:'mine-descent',stone:true});
  visiblePath(visuals.ruins,lowerEnd,[-76,-480,68],7,{stone:true});
  visiblePath(visuals.ruins,[-76,-480,68],[-105,-480,68],7,{stone:true});
  visiblePath(visuals.ruins,[-105,-480,68],[-102,-479.5,20],7,{stone:true});
  waypoint([-76,-480,68]);waypoint([-105,-480,68]);waypoint([-102,-479.5,20]);

  // Ruins: real fragmentary slabs and bridges, not a full invisible floor.
  addSector({id:'ruins-crescent',y:-480,inner:83,outer:140,start:Math.PI/2-.22,end:Math.PI*1.5-.16});
  addRect({x:-102,z:11,width:64,depth:25,y:-479.5});addRect({x:102,z:9,width:64,depth:27,y:-479.5});addRect({x:0,z:-100,width:86,depth:47,y:-479.5});
  addRect({x:18,z:-39,width:9,depth:122,y:-479.5});addRect({x:-30,z:-11,width:107,depth:9,y:-479.5});
  const ruinWalls=[[-100,-42,31,3],[-78,-51,3,28],[-50,-63,30,3],[-36,-80,3,23],[48,-61,28,3],[64,-43,3,27],[88,-55,3,23],[-88,-75,17,3],[32,-88,3,16],[103,-65,25,3]];
  ruinWalls.forEach((w,i)=>{const h=7+i%4*2;addBox({center:[w[0],-480+h/2,w[1]],size:[w[2],h,w[3]]}).hollowSurfaceId='structure-ruin-wall-'+i;});
  visiblePath(visuals.ruins,[-102,-479.5,20],[-102,-480,-25],7,{stone:true});
  visiblePath(visuals.ruins,[-102,-480,-25],[-70,-479.5,-11],7,{stone:true});
  [[-102,-480,-25],[-70,-479.5,-11],[18,-479.5,-11],[18,-479.5,20]].forEach(p=>waypoint(p));
  visiblePath(visuals.ruins,[18,-479.5,20],[105,-479.5,20],7,{stone:true});
  if(stationPoints[2])visiblePath(visuals.ruins,[116,-479.5,20],[122,stationPoints[2].position[1],21.8],4.5,{steps:true,stone:true});
  visiblePath(visuals.ruins,[105,-479.5,20],[105,-480,42],7,{stone:true});
  visiblePath(visuals.ruins,[105,-480,42],[154,-480,42],7,{stone:true});
  visiblePath(visuals.ruins,[154,-480,42],[154,-480,28],7,{stone:true});
  landing(visuals.ruins,154,-480,28,8,7,true);
  [[105,-479.5,20],[105,-480,42],[154,-480,42],[154,-480,28],[150,-480,28]].forEach(p=>waypoint(p));
  checkpoint('ruins','발굴 성역',[18,-479.5,-11]);
  // The old ceremonial flights retain their outline, with tread overlays at landings.
  const ga=[[150,-480,28],[80,-515,38],[150,-550,48],[80,-585,58]],gb=[[80,-515,28],[150,-550,38],[80,-585,48],[150,-620,58]];
  for(let k=0;k<4;k++){
    existingFlight(visuals.gate,ga[k],gb[k],5.25,k===0?0:4.4,true);
    if(k<3){addRect({x:gb[k][0],z:gb[k][2]+5,y:gb[k][1]+.1,width:8,depth:15});waypoint([gb[k][0],gb[k][1]+.1,gb[k][2]+10]);}
  }
  addRect({x:150,z:58,y:-620,width:10,depth:10});addRect({x:107.5,z:58,y:-620,width:85,depth:6});
  // Exit beside the final flight; the old straight bridge lies directly below it.
  visiblePath(visuals.gate,[154,-620,58],[154,-620,70],6,{stone:true});
  visiblePath(visuals.gate,[154,-620,70],[58,-619.6,65],6,{stone:true});
  waypoint([150,-620,58]);waypoint([154,-620,58]);waypoint([154,-620,70]);waypoint([58,-619.6,65]);

  // Final court and a physical stair leading into the circular time aperture.
  addCircle({id:'gate-court',x:0,z:0,y:-619.6,radius:91});
  addCircle({id:'gate-dais',x:0,z:-13,y:-619.175,radius:42});
  addBox({id:'gate-raised-walkway',center:[0,-618.9,38],size:[16,.9,89],walkableTop:true});
  for(const x of [-29,29])addBox({center:[x,-593,-37],size:[8,54,10]});
  for(const [x,z] of [[-44,10],[44,10],[0,65]])addBox({center:[x,-615.8,z],size:[7,7,7]});
  visiblePath(visuals.gate,[14,-619.6,48],[8,-618.45,48],5,{steps:true,stone:true});
  [[14,-619.6,48],[8,-618.45,48],[0,-618.45,40],[0,-618.45,-5]].forEach(p=>waypoint(p));
  visiblePath(visuals.gate,[0,-618.45,-5],[0,-610.2,-31],11,{steps:true,stone:true});
  landing(visuals.gate,0,-610.2,-34,13,7,true);
  waypoint([0,-610.2,-31],'portal','시간의 문');
  checkpoint('gate','시간문 광장',[35,-619.6,45]);checkpoint('portal','시간문 문턱',[0,-610.2,-31]);

  // Historical arrival miniature: grounded courtyard, obstacles, and exit steps.
  addCircle({id:'past-ground',era:'past',x:0,z:-10,y:-620,radius:133});
  addRect({id:'past-road',era:'past',x:0,z:20,y:-619.6,width:17,depth:100});
  addRect({id:'past-arch-floor',era:'past',x:0,z:64,y:-618,width:26,depth:14});
  for(const x of [-55,55])addBox({center:[x,-610,-43],size:[79,20,9],era:'past'});
  for(const x of [-86,86])addBox({center:[x,-608,-43],size:[21,24,23],era:'past'});
  for(const x of [-11,11])addBox({center:[x,-607,-43],size:[7,26,16],era:'past'});
  addBox({center:[0,-611,-35.1],size:[18,18,1.5],era:'past'});
  for(let k=0;k<4;k++)addBox({center:[k<2?-50:50,-615,10+k%2*27],size:[22,9,17],era:'past'});
  if(rail&&rail.pastGroup){
    visiblePath(rail.pastGroup,[0,-619.6,50],[0,-618,57],9,{steps:true,stone:true,era:'past'});
  }
  checkpoint('past','하연의 옛 성문',[0,-618,64],'past');
  if(ctx.battlefield)setBattlefield(ctx.battlefield);
  return {constants,stats,step,groundAt,sampleGround,setEra,getEra:()=>currentEra,setBattlefield,setSurfacePolicy,addRect,addRamp,addCircle,addSector,addBox,checkpoints,waypoints,stationPoints,colliders,surfaces,pointSolid,bodyClear,cameraDistance,teleport,visuals,
    getCheckpoint:id=>checkpoints.find(c=>c.id===id)||null};
};


  function create(options) {
    const T = options && options.THREE;
    const parent = options && options.scene;
    if (!T || !T.Group || !parent || typeof parent.add !== 'function') {
      throw new Error('HanQHollowWorld.create requires the host THREE and scene.');
    }
    const root = new T.Group(); root.name = 'HanQ — 흑철 심연'; root.visible = false;
    const world = createContext(T, root);
    const city = buildCity(world);
    const rail = buildRailRuins(world);
    const nav = createHollowNavigation({...world, rail});
    const H = world.H;
    // Close the inspection cutaway for normal third-person play. Both access
    // shafts stay open; the native surface entry handles the outside terrain.
    const enclosure = new T.Group(); enclosure.name = 'hollow-front-enclosure'; root.add(enclosure);
    const rock = H.mat('walk-enclosure', 0x273d45, 0, {roughness:1, flatShading:true});
    for (let i=0; i<9; i++) {
      const angle=-1.28+i*2.56/8;
      H.box(enclosure,Math.sin(angle)*202,-325,Math.cos(angle)*188,65,620,28,rock,angle);
      nav.addBox({id:'cavern-front-'+i,center:[Math.sin(angle)*202,-325,Math.cos(angle)*188],size:[65,620,28],rotationY:angle});
    }
    const roof=H.mat('cavern-ceiling',0x293f43,0,{roughness:1,side:T.DoubleSide});
    H.box(enclosure,0,-6,-120,350,4,80,roof);
    H.box(enclosure,0,-6,85,350,4,50,roof);
    nav.addBox({id:'cavern-rear-ceiling',center:[0,-6,-120],size:[350,4,80]});
    nav.addBox({id:'cavern-front-ceiling',center:[0,-6,85],size:[350,4,50]});
    const stats = H.finalize();
    stats.city = {...city.stats}; stats.rail = {...rail.stats}; stats.navigation = nav.stats;
    let era = 'present', disposed = false, effectsEnabled = true;
    function setEra(value) {
      era = value === 'past' ? 'past' : 'present';
      const present = era === 'present';
      nav.setEra(era);
      Object.values(world.roots).forEach(function (group) { group.visible = present; });
      city.shell.visible = present; enclosure.visible = present;
      rail.trainRoot.visible = present; rail.pastGroup.visible = !present;
      world.fx.visible = present && effectsEnabled;
      return era;
    }
    function setEffectsEnabled(value) {
      effectsEnabled = value !== false; world.fx.visible = era === 'present' && effectsEnabled;
    }
    function update(time, dt, options) {
      if (disposed || !root.visible) return;
      const seconds = Number.isFinite(time) ? time : 0;
      const delta = Number.isFinite(dt) ? Math.max(0, Math.min(dt, .1)) : 0;
      rail.update(seconds, delta, options);
      if (world.fx.visible) world.updateFX(seconds, delta);
    }
    function dispose() {
      if (disposed) return;
      disposed = true; nav.setSurfacePolicy(null);root.removeFromParent();
      const geometries = new Set(world.ownedGeometries.values()); geometries.add(world.unitBox);
      const materials = new Set(world.ownedMaterials.values()), textures = new Set();
      root.traverse(function (object) {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(function (m) { materials.add(m); });
      });
      materials.forEach(function (material) {
        Object.keys(material).forEach(function (key) { const value=material[key]; if (value && value.isTexture) textures.add(value); });
        if (material.uniforms) Object.values(material.uniforms).forEach(function (uniform) { if (uniform && uniform.value && uniform.value.isTexture) textures.add(uniform.value); });
      });
      textures.forEach(function (texture) { texture.dispose(); });
      materials.forEach(function (material) { material.dispose(); });
      geometries.forEach(function (geometry) { geometry.dispose(); });
      root.clear();
    }
    setEra('present'); parent.add(root);
    return {root, roots:world.roots, H, city, rail, nav, buildingSurfaces:city.buildingSurfaces,
      structuralSurfaces:[...city.structuralSurfaces,...rail.structuralSurfaces], enclosure, lighting:world.lighting,
      lights:world.lights, fx:world.fx, stats, setEra, getEra:()=>era,
      setEffectsEnabled, update, dispose, get disposed(){return disposed;}};
  }
  global.HanQHollowWorld = Object.freeze({version:'hollow-world-1', create});
})(typeof window !== 'undefined' ? window : globalThis);
