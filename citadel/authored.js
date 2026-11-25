/* Baegwol Grand Citadel V3 — original authored geometry from HanQ-Baegwol-Citadel.
 * Generated source bundle. Source geometry, units, seeded placement and metadata are preserved.
 * Only the THREE dependency and optional pre-rendered source texture injection are adapted.
 * All geometry is constructed with the game's own THREE instance; no second renderer/library.
 */
(function(global){'use strict';

/* AUTHORED SOURCE: core.js — preserved V3 model geometry. */
/* Baegwol Citadel — authored geometry, one unit ≈ one metre. */
function createCastleContext(root, THREE, textureFactory) {
  const T=THREE, groups={}, geomCache=new Map();
  for(const key of ['terrain','water','fortifications','town','garden','palace','roofs','interiors','underground','details','level0','level1','level2','level3','walls0','walls1','walls2','walls3']){
    const g=new T.Group();g.name=key;root.add(g);groups[key]=g;
  }
  let seed=170624;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // V2: resolution-aware handmade masonry, overlapping slate, and sawn timber.
  // Texture randomness is isolated from scene placement so added surface detail
  // cannot shuffle houses, gardens, or people.
  let ts=87413;const tr=()=>{ts=(Math.imul(ts,1664525)+1013904223)>>>0;return ts/4294967296;};
  function canvasTexture(kind){
    if(textureFactory)return textureFactory(kind,false);
    const c=document.createElement('canvas');c.width=c.height=512;const p=c.getContext('2d');
    if(kind==='stone'){
      p.fillStyle='#a6a89b';p.fillRect(0,0,512,512);
      for(let row=0;row<8;row++)for(let col=-1;col<5;col++){
        const x=col*128+(row%2)*64,y=row*64,v=205+Math.floor(tr()*25);
        p.fillStyle=`rgb(${v+5},${v+3},${v-4})`;p.fillRect(x+2,y+2,124,60);
        p.fillStyle='rgba(255,255,237,.3)';p.fillRect(x+3,y+2,121,2);p.fillRect(x+2,y+3,2,56);
        p.fillStyle='rgba(70,77,68,.18)';p.fillRect(x+3,y+59,122,3);p.fillRect(x+123,y+4,3,56);
        for(let q=0;q<5;q++){p.fillStyle='rgba(110,113,96,.10)';p.fillRect(x+tr()*120+4,y+tr()*52+5,3+tr()*16,1+tr()*4);}
      }
      for(let i=0;i<27000;i++){p.fillStyle=tr()>.5?'rgba(60,72,61,.055)':'rgba(255,253,232,.13)';p.fillRect(tr()*512,tr()*512,.6+tr()*1.7,.5+tr()*1.5);}
      for(let i=0;i<32;i++){let x=tr()*512,y=tr()*512;for(let k=0;k<4;k++){p.fillStyle='rgba(91,102,82,.13)';p.fillRect(x,y,1.2,2+tr()*5);x+=tr()*4-2;y+=3;}}
    }else if(kind==='roof'){
      p.fillStyle='#455b61';p.fillRect(0,0,512,512);
      for(let row=0;row<16;row++)for(let col=-1;col<9;col++){
        const x=col*64+(row%2)*32,y=row*32,v=155+Math.floor(tr()*30);
        p.fillStyle=`rgb(${v-18},${v+2},${v+5})`;p.fillRect(x+1,y+1,62,30);
        p.fillStyle='rgba(32,54,62,.35)';p.fillRect(x+2,y+27,60,4);p.fillRect(x+60,y+3,3,24);
        p.fillStyle='rgba(233,243,231,.24)';p.fillRect(x+2,y+2,60,1.5);
        if(tr()>.55){p.fillStyle='rgba(132,180,157,.21)';p.fillRect(x+4+tr()*30,y+3,8+tr()*17,19);}
      }
      for(let i=0;i<15000;i++){p.fillStyle=tr()>.5?'rgba(255,255,255,.055)':'rgba(19,40,46,.08)';p.fillRect(tr()*512,tr()*512,1,1+tr()*2);}
    }else{
      p.fillStyle='#a58c62';p.fillRect(0,0,512,512);
      for(let col=0;col<8;col++){
        const x=col*64,v=141+Math.floor(tr()*40);p.fillStyle=`rgb(${v+27},${v+9},${v-25})`;p.fillRect(x+2,0,61,512);
        p.fillStyle='rgba(47,33,20,.42)';p.fillRect(x,0,2,512);p.fillStyle='rgba(236,209,152,.2)';p.fillRect(x+3,0,1,512);
        for(let line=0;line<20;line++){
          const off=tr()*59,phase=tr()*6;for(let y=0;y<512;y+=4){p.fillStyle=line%3?'rgba(65,44,25,.10)':'rgba(240,214,172,.13)';p.fillRect(x+3+off+Math.sin(y*.02+phase)*1.9,y,.6+tr(),5);}
        }
      }
    }
    const map=new T.CanvasTexture(c);map.name=kind;map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;return map;
  }
  function normalTexture(map,kind){
    if(textureFactory)return textureFactory(kind,true);
    const c=document.createElement('canvas');c.width=c.height=512;const p=c.getContext('2d'),src=map.image.getContext('2d');
    if(src.getImageData&&p.createImageData&&p.putImageData){
      const data=src.getImageData(0,0,512,512).data,out=p.createImageData(512,512),strength=kind==='wood'?1.6:kind==='roof'?2.6:2.2;
      const height=(x,y)=>{const k=(((y+512)%512)*512+(x+512)%512)*4;return(data[k]+data[k+1]+data[k+2])/765;};
      for(let y=0;y<512;y++)for(let x=0;x<512;x++){
        let nx=(height(x-1,y)-height(x+1,y))*strength,ny=(height(x,y+1)-height(x,y-1))*strength,nz=1;const l=Math.hypot(nx,ny,nz),k=(y*512+x)*4;
        out.data[k]=Math.round((nx/l*.5+.5)*255);out.data[k+1]=Math.round((ny/l*.5+.5)*255);out.data[k+2]=Math.round((nz/l*.5+.5)*255);out.data[k+3]=255;
      }p.putImageData(out,0,0);
    }else{p.fillStyle='#8080ff';p.fillRect(0,0,512,512);}
    const n=new T.CanvasTexture(c);n.name=kind+'_normal';n.colorSpace=T.NoColorSpace;n.wrapS=n.wrapT=T.RepeatWrapping;n.anisotropy=8;return n;
  }
  const stoneTex=canvasTexture('stone'),roofTex=canvasTexture('roof'),woodTex=canvasTexture('wood');
  const stoneNormal=normalTexture(stoneTex,'stone'),roofNormal=normalTexture(roofTex,'roof'),woodNormal=normalTexture(woodTex,'wood');
  // Preserve V1's geometry random seed: its three old texture loops consumed
  // these values before any placement used the scene RNG.
  for(let i=0;i<7500*5*3;i++)rng();
  const colors={stone:0xc6c0ae,stoneLight:0xe1d9c5,stoneDark:0x9c998c,trim:0xe9ddbf,roof:0x235663,roofDark:0x193942,gold:0xb99a52,metal:0x353d3c,wood:0x564332,woodLight:0xa38257,glass:0x14242c,glassBlue:0x1d4050,glassAmber:0x9b7948,burgundy:0x6b2633,carpet:0x732b3b,grass:0x657f58,grassLight:0x84966a,hedge:0x344f3c,leaf:0x3d6450,leafLight:0x6b8060,bark:0x5e4a38,soil:0x797260,path:0xb7ad93,water:0x48818b,foam:0xb3c7bc,rock:0x7e8980,rockDark:0x616e69,emissive:0xffc371,crystal:0x87ccdb,booksRed:0x773844,booksBlue:0x33516b,booksGold:0xc49d57,clay:0xa27559,stoneWarm:0xc3b59b,stoneCool:0xacb6ae,agedStone:0x9f9c87,moss:0x526547,copper:0x698d80,flowerRose:0xa45165,flowerIvory:0xe8d7ae,linen:0xe2d6bb,parchment:0xd2bd8f,leather:0x623f30,stainedRuby:0x6f3043,stainedTeal:0x366e70};
  const mats={};
  for(const [k,color] of Object.entries(colors)){
    mats[k]=new T.MeshStandardMaterial({name:k,color,roughness:k==='gold'?.33:k.startsWith('glass')?.26:k==='water'?.35:.88,metalness:k==='gold'?.62:k==='metal'?.6:.03});
    if(['stone','stoneLight','stoneDark','trim','path','stoneWarm','stoneCool','agedStone'].includes(k)){mats[k].map=stoneTex;mats[k].normalMap=stoneNormal;mats[k].normalScale=new T.Vector2(.65,.65);}
    if(['roof','roofDark','copper'].includes(k)){mats[k].map=roofTex;mats[k].normalMap=roofNormal;mats[k].normalScale=new T.Vector2(.5,.5);}
    if(['wood','woodLight','bark'].includes(k)){mats[k].map=woodTex;mats[k].normalMap=woodNormal;mats[k].normalScale=new T.Vector2(.35,.35);}
    if(k.startsWith('glass')){mats[k].emissive=new T.Color(k==='glassAmber'?0xd9983e:0x31506a);mats[k].emissiveIntensity=.12;}
    if(k==='emissive'||k==='crystal'){mats[k].emissive=new T.Color(color);mats[k].emissiveIntensity=k==='crystal'?.58:1.25;}
    if(k==='water'){mats[k].metalness=.28;mats[k].roughness=.23;}
    if(k.startsWith('stained')){mats[k].emissive=new T.Color(color);mats[k].emissiveIntensity=.17;mats[k].roughness=.22;}
    if(k==='copper'){mats[k].metalness=.52;mats[k].roughness=.55;}
  }
  let primitiveCount=0;
  const mat=(m)=>typeof m==='string'?(mats[m]||mats.stone):m||mats.stone;
  function group(name,parent=groups.details){const g=new T.Group();g.name=name;parent.add(g);return g;}
  function mesh(g,geometry,m,x=0,y=0,z=0,ry=0){const o=new T.Mesh(geometry,mat(m));o.position.set(x,y,z);o.rotation.y=ry;o.castShadow=!['water','foam'].includes(typeof m==='string'?m:'');o.receiveShadow=true;g.add(o);primitiveCount++;return o;}
  function cached(key,fn){if(!geomCache.has(key))geomCache.set(key,fn());return geomCache.get(key);}
  function worldUV(geo,size=5){
    const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;if(!uv||!n)return geo;
    for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));let u,v;if(ny>nx&&ny>nz){u=p.getX(i);v=p.getZ(i);}else if(nx>nz){u=p.getZ(i);v=p.getY(i);}else{u=p.getX(i);v=p.getY(i);}uv.setXY(i,u/size,v/size);}return geo;
  }
  function box(g,x,y,z,w,h,d,m,ry=0){const key=`b${w},${h},${d}`;const geo=cached(key,()=>worldUV(new T.BoxGeometry(w,h,d)));return mesh(g,geo,m,x,y,z,ry);}
  function cyl(g,x,y,z,rt,rb,h,m,seg=16){const key=`c${rt},${rb},${h},${seg}`;const geo=cached(key,()=>{const q=new T.CylinderGeometry(rt,rb,h,seg,1);const uv=q.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.max(rt,rb)*1.25,uv.getY(i)*h/5);return q;});return mesh(g,geo,m,x,y,z);}
  function cone(g,x,y,z,r,h,m,seg=16){return cyl(g,x,y,z,0,r,h,m,seg);}
  function sphere(g,x,y,z,r,m,seg=12){return mesh(g,cached(`s${r},${seg}`,()=>new T.SphereGeometry(r,seg,Math.max(6,Math.floor(seg*.65)))),m,x,y,z);}
  function torus(g,x,y,z,r,t,m,rx=0,ry=0,rz=0){const o=mesh(g,cached(`t${r},${t}`,()=>new T.TorusGeometry(r,t,6,32)),m,x,y,z);o.rotation.set(rx,ry,rz);return o;}
  function beam(g,a,b,r,m,seg=6){const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=new T.Vector3().subVectors(vb,va);const o=cyl(g,...va.clone().add(vb).multiplyScalar(.5).toArray(),r,r,d.length(),m,seg);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
  function arch(g,x,y,z,w,h,d,m,ry=0,th=1){
    const r=w/2,ri=Math.max(.1,r-th),spring=h-r;const s=new T.Shape();s.moveTo(-r,0);s.lineTo(-r,spring);s.absarc(0,spring,r,Math.PI,0,true);s.lineTo(r,0);s.lineTo(ri,0);s.lineTo(ri,spring);s.absarc(0,spring,ri,0,Math.PI,false);s.lineTo(-ri,0);s.closePath();
    const geo=cached(`a${w},${h},${d},${th}`,()=>{const a=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:16});a.translate(0,0,-d/2);return worldUV(a);});return mesh(g,geo,m,x,y,z,ry);
  }
  function pointed(g,x,y,z,w,h,d,m,ry=0){
    const key=`p${w},${h},${d}`;const geo=cached(key,()=>{const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h*.5);s.quadraticCurveTo(w*.48,h*.78,0,h);s.quadraticCurveTo(-w*.48,h*.78,-w/2,h*.5);s.closePath();const a=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:8});a.translate(0,0,-d/2);return worldUV(a);});return mesh(g,geo,m,x,y,z,ry);
  }
  function windowFn(g,x,y,z,w,h,ry=0,glass='glass'){
    const q=group('V2_Carved_Stained_Window',g);q.position.set(x,y,z);q.rotation.y=ry;
    function lead(a,b){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),px=-dy/len*.025,py=dx/len*.025;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([a[0]+px,a[1]+py,.515,a[0]-px,a[1]-py,.515,b[0]-px,b[1]-py,.515,b[0]+px,b[1]+py,.515],3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();mesh(q,geo,'metal');}
    // A real extruded stone ring surrounds a recessed dark pane.
    const ow=w+.92,oh=h+.92,th=.34,d=.7,key=`gothicring${ow},${oh}`;
    const geo=cached(key,()=>{
      const a=new T.Shape();a.moveTo(-ow/2,0);a.lineTo(ow/2,0);a.lineTo(ow/2,oh*.5);a.quadraticCurveTo(ow*.48,oh*.78,0,oh);a.quadraticCurveTo(-ow*.48,oh*.78,-ow/2,oh*.5);a.closePath();
      const iw=ow-2*th,ih=oh-th*2,cut=new T.Path();cut.moveTo(-iw/2,th);cut.lineTo(-iw/2,th+ih*.5);cut.quadraticCurveTo(-iw*.48,th+ih*.78,0,th+ih);cut.quadraticCurveTo(iw*.48,th+ih*.78,iw/2,th+ih*.5);cut.lineTo(iw/2,th);cut.closePath();a.holes.push(cut);
      const r=new T.ExtrudeGeometry(a,{depth:d,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:1,curveSegments:9});r.translate(0,0,-d/2);return worldUV(r);
    });mesh(q,geo,'trim',0,-.3,.35);
    pointed(q,0,0,.27,w+.12,h+.15,.1,'stoneDark');pointed(q,0,.05,.36,w,h,.07,glass);
    box(q,0,-.22,.52,w+1.45,.42,1.2,'stoneLight');box(q,0,-.54,.35,w+1.12,.24,.85,'stoneDark');
    box(q,0,h*.34,.49,.12,h*.68,.13,'metal');box(q,0,h*.31,.49,w,.10,.13,'metal');
    if(w>2){
      // Paired lancets, jewel panes, and fine lead diamonds are modeled, not painted.
      for(const side of [-1,1]){
        const cx=side*w*.235;pointed(q,cx,.22,.46,w*.4,h*.76,.045,side<0?'stainedTeal':glass==='glassAmber'?'glassAmber':'stainedRuby');
        for(let row=0;row<4;row++){
          const yy=.75+row*h*.13,half=w*.165,hh=h*.065;
          lead([cx-half,yy+hh],[cx,yy]);lead([cx,yy],[cx+half,yy+hh]);
          lead([cx-half,yy+hh],[cx,yy+2*hh]);lead([cx,yy+2*hh],[cx+half,yy+hh]);
        }
      }
      torus(q,0,h*.76,.54,w*.145,.095,'trim');sphere(q,0,h*.76,.53,w*.06,'glassAmber',8);
      for(const side of [-1,1]){box(q,side*(w/2+.3),h*.24,.45,.16,h*.48,.2,'stoneLight');sphere(q,side*(w/2+.3),-.85,.35,.18,'trim',8);}
    }else{
      for(let k=1;k<=3;k++)box(q,0,h*k*.18,.48,w,.07,.08,'metal');
    }
    return q;
  }
  function stairs(g,x,z,y0,y1,w,len,m='stone'){
    const n=Math.max(4,Math.ceil((y1-y0)/.48));for(let i=0;i<n;i++){const h=(i+1)*(y1-y0)/n;box(g,x,y0+h/2,z+len/2-(i+.5)*len/n,w,h,len/n+.03,m);}
    return g;
  }
  function roof(g,x,y,z,w,d,h,m='roof',ry=0){
    const p=new Float32Array([-w/2,0,d/2,w/2,0,d/2,0,h,d/2, -w/2,0,-d/2,0,h,-d/2,w/2,0,-d/2, -w/2,0,-d/2,-w/2,0,d/2,0,h,d/2, -w/2,0,-d/2,0,h,d/2,0,h,-d/2, w/2,0,d/2,w/2,0,-d/2,0,h,-d/2, w/2,0,d/2,0,h,-d/2,0,h,d/2]);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(p,3));geo.setAttribute('uv',new T.BufferAttribute(new Float32Array(p.length/3*2),2));geo.computeVertexNormals();worldUV(geo,4);const q=group('Ridged_Roof',g);q.position.set(x,y,z);q.rotation.y=ry;mesh(q,geo,m);
    beam(q,[0,h+.08,-d/2],[0,h+.08,d/2],.14,'gold',6);beam(q,[-w/2,0,d/2],[0,h,d/2],.14,'gold',6);beam(q,[w/2,0,d/2],[0,h,d/2],.14,'gold',6);return q;
  }
  function tree(g,x,y,z,s=1,type='cypress'){
    cyl(g,x,y+1.5*s,z,.23*s,.38*s,3*s,'bark',7);
    if(type==='cypress'){for(let i=0;i<3;i++)cone(g,x,y+(3.4+i*1.6)*s,z,(1.4-i*.27)*s,4.8*s,i%2?'leafLight':'leaf',9);}
    else{for(let i=0;i<3;i++)sphere(g,x+(rng()-.5)*s,y+(3+i*.7)*s,z+(rng()-.5)*s,(2.2-i*.3)*s,i%2?'leafLight':'leaf',9);}
  }
  function flag(g,x,y,z,s=1,ry=0){
    const q=group('Royal_Standard',g);q.position.set(x,y,z);q.rotation.y=ry;cyl(q,0,4*s,0,.08*s,.1*s,8*s,'gold',8);sphere(q,0,8.2*s,0,.2*s,'gold');
    const p=[],idx=[];const n=10;for(let i=0;i<=n;i++){const t=i/n,xx=t*3.9*s,zz=Math.sin(t*Math.PI*2.7)*.28*s;const bottom=5.5*s+(t>.72?(t-.72)*1.2*s:0);p.push(xx,7.7*s-t*.25*s,zz,xx,bottom,zz);if(i<n){let k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setIndex(idx);geo.computeVertexNormals();const burg=mats.burgundy.clone();burg.side=T.DoubleSide;burg.name='Flag_Burgundy';if(!mats.flag)mats.flag=burg;mesh(q,geo,mats.flag);sphere(q,1.05*s,6.7*s,.18*s,.32*s,'gold',8);return q;
  }
  function person(g,x,y,z,s=1,ry=0){
    const q=group('Scale_Guard_1_8m',g);q.position.set(x,y,z);q.rotation.y=ry;
    sphere(q,0,1.56*s,0,.19*s,'stoneLight',8);cone(q,0,1.77*s,0,.23*s,.25*s,'metal',8);box(q,0,1.1*s,0,.45*s,.59*s,.28*s,'burgundy');box(q,0,1.13*s,.16*s,.36*s,.37*s,.07*s,'gold');for(const a of [-1,1]){box(q,a*.12*s,.46*s,0,.17*s,.67*s,.2*s,'metal');beam(q,[a*.22*s,1.3*s,0],[a*.3*s,.9*s,.1*s],.075*s,'metal',6);}beam(q,[.42*s,.05*s,0],[.42*s,2.28*s,0],.028*s,'wood',5);cone(q,.42*s,2.35*s,0,.085*s,.25*s,'metal',5);return q;
  }
  function mergeStatic(top){
    top.updateMatrixWorld(true);const inv=new T.Matrix4().copy(top.matrixWorld).invert(),buckets=new Map(),normalM=new T.Matrix3();
    top.traverse(o=>{if(!o.isMesh)return;const key=o.material.uuid;let b=buckets.get(key);if(!b){b={mat:o.material,pos:[],norm:[],uv:[],idx:[],count:0};buckets.set(key,b);}const geo=o.geometry,m=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld),p=geo.attributes.position,n=geo.attributes.normal,u=geo.attributes.uv;normalM.getNormalMatrix(m);const v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);b.pos.push(v.x,v.y,v.z);if(n){v.fromBufferAttribute(n,i).applyMatrix3(normalM).normalize();b.norm.push(v.x,v.y,v.z);}else b.norm.push(0,1,0);b.uv.push(u?u.getX(i):0,u?u.getY(i):0);}if(geo.index){for(let i=0;i<geo.index.count;i++)b.idx.push(geo.index.getX(i)+b.count);}else{for(let i=0;i<p.count;i++)b.idx.push(i+b.count);}b.count+=p.count;});
    top.clear();for(const b of buckets.values()){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(b.pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(b.norm,3));geo.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));geo.setIndex(b.idx);geo.computeBoundingBox();geo.computeBoundingSphere();const o=new T.Mesh(geo,b.mat);o.name=top.name+'_'+b.mat.name;o.castShadow=top!==groups.water;o.receiveShadow=true;top.add(o);}
  }
  return {THREE:T,root,groups,mats,mat,rng,group,mesh,box,cyl,cone,sphere,torus,beam,arch,pointed,window:windowFn,stairs,roof,tree,flag,person,mergeStatic,get primitiveCount(){return primitiveCount;},disposeCache(){for(const g of geomCache.values())g.dispose();geomCache.clear();}};
}

/* AUTHORED SOURCE: environment.js — preserved V3 model geometry. */
/* Baegwol Citadel: original procedural landscape, fortifications and inhabited wards. */
function buildEnvironment(C) {
  const T=C.THREE, G=C.groups, PI=Math.PI;
  const terrain=C.group('Cliff island and three terraces',G.terrain);
  const water=C.group('Royal moat',G.water);
  const fort=C.group('Outer curtain and South Gate',G.fortifications);
  const inner=C.group('Inner crown wall and processional stairs',G.fortifications);
  const town=C.group('Inhabited lower wards',G.town);
  const garden=C.group('Royal parterre gardens',G.garden);
  function ellipse(g,x,y,z,rx,rz,h,mat,n=64){const q=new T.CylinderGeometry(1,1,h,n,1);q.scale(rx,1,rz);return C.mesh(g,q,mat,x,y,z);}
  // V3: keep the historic southern terrace while opening the northern service basement.
  function southEllipse(g,x,bottom,z,rx,rz,h,mat,cutZ=-119.2){
    let poly=Array.from({length:80},(_,i)=>[x+Math.sin(i*Math.PI/40)*rx,z+Math.cos(i*Math.PI/40)*rz]),out=[];
    for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ai=a[1]>=cutZ,bi=b[1]>=cutZ;if(ai)out.push(a);if(ai!==bi){const t=(cutZ-a[1])/(b[1]-a[1]);out.push([a[0]+t*(b[0]-a[0]),cutZ]);}}
    const shape=new T.Shape();out.forEach((p,i)=>i?shape.lineTo(p[0],-p[1]):shape.moveTo(p[0],-p[1]));shape.closePath();
    const geom=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:1});geom.rotateX(-Math.PI/2);
    const pos=geom.attributes.position,uv=geom.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/5,pos.getZ(i)/5);
    return C.mesh(g,geom,mat,0,bottom,0);
  }
  function disc(g,x,y,z,r,h,mat,n=24){return C.cyl(g,x,y,z,r,r,h,mat,n);}
  function along(g,a,b,y,w,h,mat){let dx=b[0]-a[0],dz=b[1]-a[1];return C.box(g,(a[0]+b[0])/2,y,(a[1]+b[1])/2,w,h,Math.hypot(dx,dz),mat,Math.atan2(dx,dz));}
  function oct(g,x,y,z,r,h,mat){return C.cyl(g,x,y,z,r,r,h,mat,8);}
  function pebble(g,x,y,z,r,mat='rock'){let m=C.mesh(g,new T.DodecahedronGeometry(r,0),mat,x,y,z);m.scale.set(1,.5+C.rng()*.7,.7+C.rng()*.6);m.rotation.y=C.rng()*PI;return m;}
  function band(g,x,y,z,r,h,mat='trim',n=16){return C.cyl(g,x,y,z,r,r,h,mat,n);}
  function circularMasonry(g,x,y,z,r,h,n=16){
    for(let k=0;k<n;k++){let a=2*PI*k/n;C.box(g,x+Math.sin(a)*(r+.07),y,z+Math.cos(a)*(r+.07),.16,h,.12,'stoneDark',a);}
  }
  function wallTower(g,x,z,base,r,h,roof=false,flag=true){
    if(z<-106&&Math.abs(x)<160+r+2)return; // incorporated into the new palace terrace
    const n=12;
    band(g,x,base+1.3,z,r+1.7,2.6,'stoneDark',n);
    C.cyl(g,x,base+h/2,z,r,r+1,h,'stone',n);
    for(let y=base+5;y<base+h-2;y+=6)band(g,x,y,z,r+.32,.48,'trim',n);
    band(g,x,base+h-.5,z,r+1,.9,'trim',n);
    band(g,x,base+h+.25,z,r+1.2,.6,'stoneLight',n);
    for(let k=0;k<8;k++){
      let a=k*PI/4,s=Math.sin(a),c=Math.cos(a);
      if(k%2===0){C.window(g,x+s*(r+.1),base+h*.44,z+c*(r+.1),1.15,3.8,a,'glass');}
      if(!roof)C.box(g,x+s*(r+.75),base+h+2,z+c*(r+.75),2.8,3.4,1.6,'stoneLight',a);
    }
    if(!roof){
      for(let k=0;k<8;k++){let a=(k+.5)*PI/4;C.box(g,x+Math.sin(a)*(r+.7),base+h+1.8,z+Math.cos(a)*(r+.7),2.2,3,1.5,'stone',a);}
      disc(g,x,base+h+.57,z,r-.5,.18,'path',n);
      if(flag)C.flag(g,x,base+h+.5,z,1.25);
    }else{
      C.cone(g,x,base+h+r*1.12,z,r+1.8,r*2.24,'roof',n);
      band(g,x,base+h+.75,z,r+1.85,.35,'gold',n);
      C.cone(g,x,base+h+r*2.24+.6,z,.48,3.4,'gold',8);
      if(flag)C.flag(g,x,base+h+r*2.24+1.4,z,.72);
      // Short raised ribs catch the sun along the conical roof.
      for(let k=0;k<n;k++){let a=k*2*PI/n;C.beam(g,[x+Math.sin(a)*(r+1.8),base+h+.15,z+Math.cos(a)*(r+1.8)],[x,base+h+r*2.24,z],.10,'roofDark',4);}
    }
    circularMasonry(g,x,base+3,z,r+1,3,12);
  }
  function curtain(g,a,b,base,h,width=4.8){
    // Retain only historic wall portions outside the added royal foundation.
    let lo=0,hi=1;const d=[b[0]-a[0],b[1]-a[1]],mins=[-160,-340],maxs=[160,-106];
    for(let k=0;k<2;k++){
      if(Math.abs(d[k])<1e-8){if(a[k]<mins[k]||a[k]>maxs[k])return curtainSegment(g,a,b,base,h,width);}
      else{let u=(mins[k]-a[k])/d[k],v=(maxs[k]-a[k])/d[k];if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);}
    }
    if(hi<=lo)return curtainSegment(g,a,b,base,h,width);
    if(lo>1e-5)curtainSegment(g,a,[a[0]+d[0]*lo,a[1]+d[1]*lo],base,h,width);
    if(hi<1-1e-5)curtainSegment(g,[a[0]+d[0]*hi,a[1]+d[1]*hi],b,base,h,width);
  }
  function curtainSegment(g,a,b,base,h,width=4.8){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),ry=Math.atan2(dx,dz);
    along(g,a,b,base+h/2,width,h,'stone');
    along(g,a,b,base+1,width+1.7,2,'stoneDark');
    along(g,a,b,base+h-.8,width+1.35,1,'trim');
    along(g,a,b,base+h+.12,width+1.5,.85,'path');
    const nx=dz/len,nz=-dx/len;
    for(let side of [-1,1]){
      along(g,[a[0]+nx*(width/2+.15)*side,a[1]+nz*(width/2+.15)*side],[b[0]+nx*(width/2+.15)*side,b[1]+nz*(width/2+.15)*side],base+h+1,1.15,1.6,'stone');
      for(let k=0;k<=Math.floor(len/4);k++){
        let t=(k+.3)/(Math.floor(len/4)+1),x=a[0]+dx*t+nx*(width/2+.12)*side,z=a[1]+dz*t+nz*(width/2+.12)*side;
        C.box(g,x,base+h+2,z,1.3,2.4,2.25,'stoneLight',ry);
      }
    }
    for(let k=1;k<Math.ceil(len/11);k++){
      let t=k/Math.ceil(len/11),x=a[0]+dx*t,z=a[1]+dz*t;
      for(let side of [-1,1])C.box(g,x+nx*(width/2+.45)*side,base+h*.42,z+nz*(width/2+.45)*side,1.2,h*.84,1.8,'stoneDark',ry);
    }
    for(let y=base+4;y<base+h-1;y+=4.4)along(g,a,b,y,width+.08,.15,'stoneDark');
  }
  // A faceted island: topsoil, weathered limestone ledges and darker submerged rock.
  const rings=[{rx:210,rz:227,y:-25},{rx:216,rz:232,y:-14},{rx:205,rz:222,y:-5},{rx:202,rz:218,y:1},{rx:197,rz:213,y:7.3}];
  const ns=80, jitter=Array.from({length:ns},()=>.976+C.rng()*.048);
  for(let l=0;l<rings.length-1;l++){
    let pos=[];const ra=rings[l],rb=rings[l+1];
    for(let k=0;k<ns;k++){
      let k2=(k+1)%ns,a=k*2*PI/ns,b=k2*2*PI/ns;
      let p0=[Math.sin(a)*ra.rx*jitter[k],ra.y,Math.cos(a)*ra.rz*jitter[k]],p1=[Math.sin(b)*ra.rx*jitter[k2],ra.y,Math.cos(b)*ra.rz*jitter[k2]],p2=[Math.sin(a)*rb.rx*jitter[k],rb.y,Math.cos(a)*rb.rz*jitter[k]],p3=[Math.sin(b)*rb.rx*jitter[k2],rb.y,Math.cos(b)*rb.rz*jitter[k2]];
      pos.push(...p0,...p2,...p1,...p1,...p2,...p3);
    }
    let geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(pos,3));geom.computeVertexNormals();C.mesh(terrain,geom,l%2?'rock':'rockDark');
  }
  ellipse(terrain,0,7.65,0,197,213,.7,'grass',80);
  ellipse(terrain,0,7.98,0,183,198,.18,'path',80);
  // Grass crescent between parapet and urban paving.
  for(let i=0;i<42;i++){
    let a=i*2*PI/42;if(Math.abs(a)<.2||Math.abs(a-2*PI)<.2)continue;
    let x=Math.sin(a)*203,z=Math.cos(a)*219;
    pebble(terrain,x,-2-C.rng()*7,z,3+C.rng()*6,i%3?'rock':'rockDark');
  }
  ellipse(water,0,-9.5,4,310,330,1.1,'water',96);
  // Small restrained ripples just outside cliff and bridge piers.
  for(let i=0;i<23;i++){
    const a=.3+i*.263,x=Math.sin(a)*237,z=Math.cos(a)*255;
    const r=3+C.rng()*6;let m=C.torus(water,x,-8.87,z,r,.11,'foam',PI/2);m.scale.set(1,.38,1);
  }
  // Three coherent stepped foundations and retaining-wall articulated bays.
  ellipse(terrain,0,14.9,-32,131,135,13.8,'stoneDark',64);
  southEllipse(terrain,0,21.8,-32,131,135,2.2,'stoneDark');
  southEllipse(terrain,0,23.35,-32,131.4,135.4,.7,'trim');
  southEllipse(terrain,0,24.01,-32,126.7,130.5,.18,'path');
  for(let i=0;i<38;i++){
    let a=.19+i*(2*PI-.38)/37,x=Math.sin(a)*130.7,z=-32+Math.cos(a)*134.7;
    if(z<-119)continue;
    C.box(terrain,x,16,z,2.6,14.7,2.2,'stone',a);
    if(i%2===1)C.pointed(terrain,x,12,z,2.2,6.4,.16,'rockDark',a);
  }
  C.box(terrain,0,32.9,-47,146,17.8,144,'stoneDark');
  C.box(terrain,0,41.5,-47,149,.8,147,'trim');
  C.box(terrain,0,41.92,-47,144,.12,142,'path');
  for(let side of [-1,1]){
    for(let z=-111;z<=18;z+=14){C.box(terrain,side*73.5,32.9,z,2.6,17.6,3,'stone');C.box(terrain,side*74,40.4,z,3,2,3.4,'stoneLight');}
    for(let x=-63;x<=63;x+=14){if(side>0&&Math.abs(x)<22)continue;C.box(terrain,x,32.9,side<0?-119.5:25.5,3,17.6,2.5,'stone');}
  }
  for(let y=11;y<24;y+=4){if(y>21.8)southEllipse(terrain,0,y-.125,-32,131.1,135.1,.25,'stone');else ellipse(terrain,0,y,-32,131.1,135.1,.25,'stone',64);}
  // Main raised approach, true arched bridge rather than solid blocks.
  const bridge=C.group('Three arch bridge and barbican',fort);
  C.box(bridge,0,7.25,253,20,1.5,105,'path');
  for(let z of [214,240,266,292]){
    C.box(bridge,0,-2.5,z,19,19,4.8,'stoneDark');
    C.box(bridge,0,-11.5,z,24,2,8,'stone');
    for(let side of [-1,1])C.cone(bridge,side*11.6,-4.8,z,3.8,10,'stoneDark',4);
  }
  for(let z of [227,253,279])C.arch(bridge,0,-10.7,z,21.2,17.5,18.8,'stone',PI/2,2.2);
  for(let side of [-1,1]){
    C.box(bridge,side*9.7,9.7,253,1.1,3.4,106,'stone');
    C.box(bridge,side*9.7,11.6,253,1.6,.5,107,'trim');
    for(let z=204;z<=304;z+=6){C.box(bridge,side*9.7,12.5,z,1.8,2.2,2.3,'stoneLight');}
    for(let z of [216,238,268,290]){
      C.cyl(bridge,side*9.7,15,z,.19,.25,5.5,'metal',6);
      C.sphere(bridge,side*9.7,17.6,z,.65,'emissive',8);
      C.cone(bridge,side*9.7,18.3,z,.85,1.1,'metal',6);
    }
  }
  C.box(terrain,0,6,310,40,4,28,'rock');
  C.box(terrain,0,8.08,310,35,.15,30,'path');
  for(let side of [-1,1]){
    wallTower(bridge,side*17.5,250,8,6.9,17,true,false);
    C.flag(bridge,side*17.5,8+17+6.9*2.24+2,250,.8);
  }
  C.arch(bridge,0,8,250,19,15,8,'stoneLight',0,1.8);
  C.box(bridge,0,25.5,250,20,4,8,'stone');
  for(let x of [-8,-4,0,4,8])C.box(bridge,x,29,250,2.5,3,8.3,'stoneLight');
  // Outer defensive ring with alternating conical and open crenellated turrets.
  const pts=[];
  for(let i=0;i<=24;i++){let a=(6+348*i/24)*PI/180;pts.push([Math.sin(a)*190,Math.cos(a)*205]);}
  for(let i=0;i<pts.length-1;i++)curtain(fort,pts[i],pts[i+1],8,17,4.9);
  for(let i=1;i<pts.length-1;i++){
    let [x,z]=pts[i],roof=i%3===1;
    wallTower(fort,x,z,8,roof?6.7:7.5,roof?26:21,roof,i%2===0);
  }
  // Imposing main gate: open passage, raised portcullis and broad tower pair.
  for(let side of [-1,1])wallTower(fort,side*24,201,8,10.8,29,true,true);
  C.arch(fort,0,8,201,25,23,12,'stoneLight',0,2);
  C.box(fort,0,34,201,29,7,12,'stone');
  // Fix explicit dimensions: the narrow crest strip extends across the lintel.
  C.box(fort,0,38,201,30,.8,13,'trim');
  C.roof(fort,0,38.4,201,31,14,10,'roof');
  for(let x=-9;x<=9;x+=2.4){C.box(fort,x,28,195,.28,8,.4,'metal');C.cone(fort,x,23.6,195,.36,1.1,'metal',4);}
  for(let y of [25,28,31])C.box(fort,0,y,195,21,.3,.4,'metal');
  for(let side of [-1,1]){
    C.flag(fort,side*11.5,30,207.4,1.5,PI/2);
    C.window(fort,side*7.3,32,207.1,2.7,4.4,0,'glassAmber');
    C.person(fort,side*12.5,8.05,213,1.1,side>0?-.3:.3);
    C.person(fort,side*22,38.4,201,1.05);
  }
  C.pointed(fort,0,32.3,207.4,3.4,4.5,.3,'gold');
  C.torus(fort,0,34.6,207.7,1.0,.15,'roof');
  // Processional paving from gate to inner stairs, with a clear central aisle.
  C.box(town,0,8.14,165,25,.22,73,'stoneLight');
  for(let z=132;z<201;z+=6)C.box(town,0,8.28,z,19,.05,.15,'stoneDark');
  for(let side of [-1,1])C.box(town,side*11.3,8.28,165,.22,.05,73,'gold');
  // Inner crown wall.
  const ip=[];
  for(let i=0;i<=18;i++){let a=(10+340*i/18)*PI/180;ip.push([Math.sin(a)*127,-32+Math.cos(a)*131]);}
  const serviceGates=[];
  for(let i=0;i<ip.length-1;i++){
    const a=ip[i],b=ip[i+1];
    if(i!==4&&i!==13){curtain(inner,a,b,24,10.5,3.5);continue;}
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len,mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
    const left=[mx-ux*5.1,mz-uz*5.1],right=[mx+ux*5.1,mz+uz*5.1];
    curtain(inner,a,left,24,10.5,3.5);curtain(inner,right,b,24,10.5,3.5);
    C.arch(inner,mx,24,mz,11.2,9.4,4.3,'stoneLight',Math.atan2(dx,dz)+PI/2,1.05);
    along(inner,left,right,34,4.8,1.2,'stone');along(inner,left,right,35,4.9,.8,'trim');
    serviceGates.push([mx,mz]);
  }
  for(let i=1;i<ip.length-1;i+=2)wallTower(inner,ip[i][0],ip[i][1],24,6.4,20,i%4===1,true);
  for(let side of [-1,1])wallTower(inner,side*22,97,24,7.1,19,true,false);
  C.arch(inner,0,24,98,26,15.2,9,'stoneLight',0,1.9);
  C.box(inner,0,40.9,98,28,3.1,8,'stone');
  C.box(inner,0,42.8,98,29,.7,9,'trim');
  for(let x=-12;x<=12;x+=4)C.box(inner,x,44,98,2.5,2.8,8.8,'stoneLight');
  C.stairs(inner,0,118,8,24,32,30,'stoneLight');
  C.box(inner,0,24.03,101,32,.18,6,'stoneLight');
  C.stairs(inner,0,39.5,24,42,36,29,'stoneLight');
  // Stair cheek walls accurately slope with the ascent.
  function stairRails(cx,cz,y0,y1,w,len){
    for(let side of [-1,1]){
      const x=cx+side*(w/2+1.2),n=12;
      for(let i=0;i<n;i++){
        const z=cz+len/2-(i+.5)*len/n,y=y0+(y1-y0)*(i+.5)/n;
        C.box(inner,x,(y0+y)/2+1.8,z,2.3,y-y0+3.6,len/n+.03,'stone');
        C.box(inner,x,y+3.7,z,2.7,.35,len/n+.05,'trim');
      }
      for(let t of [0,1]){
        let y=y0+(y1-y0)*t,z=cz+len/2-t*len;
        C.box(inner,x,y+3,z,3.5,6,3.5,'stoneLight');
        C.sphere(inner,x,y+6.6,z,1.2,'gold',10);
      }
    }
  }
  stairRails(0,118,8,24,32,30);stairRails(0,39.5,24,42,36,29);
  C.box(garden,0,24.16,72,35,.18,34,'stoneLight');
  for(let side of [-1,1])for(let z of [62,80]){
    C.cyl(garden,side*25,27,z,1.3,1.8,6,'stone',8);
    C.box(garden,side*25,30.5,z,3.8,1,3.8,'trim');
    C.flag(garden,side*25,31,z,1.5,side>0?0:PI);
  }
  // Exterior service stairs terminate at landings through real side-wall gates.
  // The stairs run alongside the retaining wall, never inside the solid terrace.
  for(const [gx,gz] of serviceGates){
    const side=Math.sign(gx),sx=side*142.5,sz=gz+23.4;
    let service=C.group((side<0?'West':'East')+' service stair',inner);
    C.stairs(service,sx,sz,8,24,8.5,38,'stone');
    C.box(service,side*134.5,24.02,gz,28,.18,8.8,'stoneLight');
    for(let x of [sx-4.9,sx+4.9])for(let j=0;j<10;j++){
      let z=sz+19-(j+.5)*38/10,y=8+16*(j+.5)/10;
      C.box(service,x,y+1.2,z,.6,2.4,38/10+.02,'stone');
    }
    for(let zz of [gz-4.4,gz+4.4]){
      let startX=Math.abs(gx)+3,endX=148.5;
      // The southern landing railing leaves the stair mouth open.
      let end=zz>gz?137:148.5;
      C.box(service,side*(startX+end)/2,25.3,zz,end-startX,2.4,.6,'stone');
    }
  }
  // Urban house kit: stone shop floor, half-timber upper level, eaves, dormers and chimney.
  function house(x,z,w=14,d=20,h=15,rot=0,variant=0){
    if(z<=-100&&Math.abs(x)<160){const side=x<0?-1:1;if(z===-103){x=side*320;z=-70;}else if(z===-141){x=side*340;z=-118;}else if(z===-178){x=side*370;z=-175;}else if(z===-163){x=side*315;z=-230;}else if(z===-187){x=x*1.25;z=-395;}}
    let g=C.group('Town house '+Math.round(x)+' '+Math.round(z),town);g.position.set(x,8,z);g.rotation.y=rot;
    C.box(g,0,.75,0,w+1.2,1.5,d+1.2,'stoneDark');
    C.box(g,0,h/2,0,w,h,d,'stoneLight');
    C.box(g,0,3,0,w+.1,5.6,d+.1,'stone');
    for(let y of [6,h-.6])C.box(g,0,y,0,w+.4,.55,d+.4,'wood');
    for(let sx of [-1,1])for(let sz of [-1,1])C.box(g,sx*(w/2+.03),h/2,sz*(d/2+.03),.55,h,.55,'wood');
    for(let sx of [-1,1]){
      for(let p=1;p<4;p++)C.box(g,sx*(w/2+.03),h/2,-d/2+p*d/4,.48,h,.45,'wood');
      for(let p=1;p<4;p++)C.window(g,sx*(w/2+.12),7.3,-d/2+p*d/4,1.8,3.8,sx*PI/2,variant%3?'glass':'glassAmber');
    }
    for(let zz of [-d/2-.11,d/2+.11]){
      const ry=zz<0?PI:0;
      for(let xx of [-w*.28,w*.28])C.window(g,xx,7.3,zz,1.9,3.8,ry,'glass');
    }
    C.pointed(g,0,.2,d/2+.1,2.5,4.3,.15,'wood');
    C.box(g,0,.18,d/2+.6,4,.35,1.8,'trim');
    C.roof(g,0,h,0,w+2,d+2,w*.52,variant%5===0?'roofDark':'roof');
    C.box(g,w*.27,h+3,-d*.27,1.8,6,2.1,'stoneDark');
    C.box(g,w*.27,h+6.2,-d*.27,2.4,.55,2.6,'trim');
    if(variant%2===0){
      C.box(g,-w*.3,h+1,d*.12,3,3.4,4,'stoneLight');
      C.roof(g,-w*.3,h+2.7,d*.12,4.4,4.8,3,'roof',PI/2);
    }
    // Decorative half-timber diagonals.
    for(let sx of [-1,1])for(let j=0;j<2;j++)C.beam(g,[sx*(w/2+.08),6.4,-d*.4+j*d*.4],[sx*(w/2+.08),h-1.1,-d*.05+j*d*.4],.18,'wood',4);
    if(variant%3===0){
      C.box(g,0,4.5,d/2+1.7,w*.8,.35,3.5,'burgundy',0);
      for(let xx of [-w*.35,w*.35])C.box(g,xx,2.3,d/2+2.8,.22,4.6,.22,'wood');
      C.box(g,0,1.8,d/2+1.6,w*.75,1.5,2.8,'woodLight');
    }
    g.userData.envHouse={w,d,h,variant};
    return g;
  }
  let hi=0;
  for(let side of [-1,1]){
    for(let z of [-103,-69,-35,0,37])house(side*(z<-90?143:(z===-35||z===0)?169:153),z,13+(hi%3)*1.8,20+(hi%2)*3,14+(hi%4)*1.6,side>0?-PI/2:PI/2,hi++);
    house(side*143,80,15,23,17,0,hi++);
    house(side*123,118,15,22,16,side*-.3,hi++);
    house(side*92,142,16,20,16,side*-.4,hi++);
    house(side*60,163,15,18,15,0,hi++);
    house(side*102,-141,15,21,16,side*PI/2,hi++);
    house(side*62,-178,14,20,17,PI,hi++);
    house(side*34,177,13,16,14,0,hi++);
    house(side*91,-163,12,16,14,side*PI/2,hi++);
  }
  // Rear guard cottages outside crown wall.
  for(let x of [-32,0,32])house(x,-187,14,18,14,PI,hi++);
  // Barracks, armory and stable have larger footprints and specific readable details.
  function longHall(name,x,z,w,d,h,rot){let q=house(x,z,w,d,h,rot,1);q.name=name;return q;}
  const barracks=longHall('West barracks and armored drill yard',-115,78,22,32,17,0);
  for(let i=-2;i<=2;i++){
    C.arch(barracks,i*3.7,0,16.1,2.4,4.9,.35,'stoneLight',0,.35);
    C.box(barracks,i*3.7,2,16,1.8,4,.16,'wood');
  }
  C.flag(barracks,-8,18,14,1.4);C.flag(barracks,8,18,14,1.4);
  const stable=longHall('East royal stables',119,79,24,32,11.2,0);
  for(let x of [-8,-3,3,8]){
    C.pointed(stable,x,.1,16.16,3.4,5,.18,'wood');
    C.box(stable,x,2,17.1,3.2,1,1.1,'woodLight');
  }
  for(let side of [-1,1]){
    C.box(town,side*116,8.22,111,29,.22,10,'soil');
    for(let z of [106,115])for(let x=102;x<=132;x+=4){C.box(town,side*x,9.5,z,.28,3,.28,'wood');}
    for(let z of [106,115])C.box(town,side*117,9.9,z,32,.25,.25,'wood');
  }
  // Stable horses, visually small but recognizable from the close camera.
  function horse(x,z,ry=0){let g=C.group('Royal stable horse',town);g.position.set(x,8,z);g.rotation.y=ry;C.box(g,0,1.6,0,1.15,1.1,2.8,'wood');C.box(g,0,2.1,-1.1,.65,1.4,.7,'wood');C.box(g,0,2.7,-1.5,.65,.55,1.2,'wood');for(let xx of [-.4,.4])for(let zz of [-.95,.95])C.box(g,xx,.7,zz,.22,1.4,.25,'bark');C.beam(g,[0,1.9,1.3],[0,.8,2],.13,'bark');C.box(g,0,2.15,0,1.2,.25,1.25,'burgundy');}
  horse(112,111,.5);horse(120,112,-.2);horse(127,109,1);
  // Training yard: palisade, circular targets, sword racks and guard silhouettes.
  C.box(town,-109,8.2,39,30,.2,27,'soil');
  for(let x of [-122,-116,-110]){
    C.box(town,x,10.5,29,.3,5,.3,'wood');
    C.cyl(town,x,12,29,1.8,1.8,.35,'woodLight',16).rotation.x=PI/2;
    C.torus(town,x,12,29.25,1.13,.16,'burgundy');C.sphere(town,x,12,29.3,.25,'burgundy',8);
  }
  for(let z of [37,45,51])C.person(town,-111,8.15,z,1.1,PI);
  C.box(town,-99,10,35,.5,4,10,'wood');
  for(let z=31;z<39;z+=1.3){C.beam(town,[-98.8,8.6,z],[-98.8,12,z-.4],.07,'metal');C.box(town,-98.8,10,z-.18,.1,.12,1.1,'metal');}
  // Front market plaza, stalls and central civic well.
  for(let side of [-1,1]){
    C.box(town,side*55,8.15,129,45,.2,29,'path');
    for(let i=0;i<4;i++){
      let x=side*(34+i*9),z=130+(i%2)*11,mat=i%2?'roof':'burgundy';
      for(let xx of [-2.9,2.9])for(let zz of [-1.9,1.9])C.box(town,x+xx,10.3,z+zz,.22,4.4,.22,'wood');
      C.roof(town,x,12.5,z,7,5,1.2,mat,0);
      C.box(town,x,9.3,z,6,2.1,3.5,'woodLight');
      for(let j=0;j<4;j++)C.sphere(town,x-2+j*1.3,10.6,z,.45,j%2?'booksGold':'clay',8);
    }
    for(let x of [side*32,side*76]){C.tree(town,x,8.2,151,1.2,'cypress');C.box(town,x,8.6,151,6,.9,6,'stone');}
  }
  const well=C.group('Town well',town);well.position.set(50,8,105);
  C.cyl(well,0,1.5,0,3.8,4.1,3,'stone',16);C.cyl(well,0,3.06,0,3.1,3.1,.1,'water',16);C.torus(well,0,3.1,0,3.55,.5,'trim',PI/2);
  for(let x of [-3.8,3.8])C.box(well,x,4.1,0,.4,8.2,.4,'wood');C.roof(well,0,7.7,0,9,7,3.2,'roof');C.beam(well,[-3.6,5.8,0],[3.6,5.8,0],.22,'wood');C.beam(well,[0,5.8,0],[0,2,0],.05,'bark');
  // Carts, barrels, crates and tiny inhabitants provide a convincing occupied scale.
  function barrel(x,z,r=.8){C.cyl(town,x,8+r*1.2,z,r*.86,r*.86,r*2.4,'woodLight',10);for(let y of [8.3,8+r*2.1])C.torus(town,x,y,z,r*.88,.07,'metal',PI/2);}
  for(let i=0;i<26;i++){
    let side=i%2?-1:1,x=side*(131+C.rng()*18),z=-100+C.rng()*203;
    barrel(x,z,.6+C.rng()*.4);
    if(i%3===0)C.box(town,x+2,8.8,z,1.8,1.6,1.8,'woodLight');
  }
  for(let side of [-1,1]){
    let cart=C.group('Supply wagon',town);cart.position.set(side*83,8,118);cart.rotation.y=side*.4;
    C.box(cart,0,1.4,0,3.1,.5,5.3,'wood');for(let x of [-1.6,1.6])C.box(cart,x,2.3,0,.2,1.8,5.5,'woodLight');
    for(let x of [-1.8,1.8])for(let z of [-1.8,1.8]){C.torus(cart,x,1,z,.9,.13,'wood',0,PI/2);for(let j=0;j<6;j++){let a=j*PI/3;C.beam(cart,[x,1,z],[x,1+Math.sin(a)*.85,z+Math.cos(a)*.85],.06,'wood',4);}}
    C.beam(cart,[-1,.9,2.3],[-1,.7,6],.10,'wood');C.beam(cart,[1,.9,2.3],[1,.7,6],.10,'wood');
  }
  for(let i=0;i<34;i++){
    let side=i%2?-1:1,x=side*(28+C.rng()*130),z=102+C.rng()*65;
    if((x/177)**2+(z/188)**2<.9)C.person(town,x,8.25,z,.9+C.rng()*.18,C.rng()*PI*2);
  }
  // Formal gardens on both sides of the palace, bounded hedges and gravel axes.
  function fountain(x,z,y,r=7){
    C.cyl(garden,x,y+.25,z,r+1.5,r+1.8,.5,'stoneDark',24);
    C.cyl(garden,x,y+.85,z,r+1,r+1,1.2,'trim',24);
    C.cyl(garden,x,y+1.47,z,r-.1,r-.1,.08,'water',32);
    C.torus(garden,x,y+1.55,z,r+.4,.55,'stoneLight',PI/2);
    C.cyl(garden,x,y+2.9,z,.7,1.3,4,'stoneLight',12);
    C.cyl(garden,x,y+4.5,z,3.4,1.1,.8,'trim',24);
    C.cyl(garden,x,y+4.95,z,3,3,.1,'water',24);
    C.sphere(garden,x,y+6,z,.9,'gold',12);
    for(let i=0;i<8;i++){
      let a=i*PI/4,b=new T.QuadraticBezierCurve3(new T.Vector3(x,y+5,z),new T.Vector3(x+Math.sin(a)*5,y+7.4,z+Math.cos(a)*5),new T.Vector3(x+Math.sin(a)*5.5,y+1.6,z+Math.cos(a)*5.5));
      C.mesh(garden,new T.TubeGeometry(b,16,.11,4,false),'foam');
    }
  }
  for(let side of [-1,1]){
    const x=side*97;
    C.box(garden,x,24.19,-13,30,.2,98,'grass');
    C.box(garden,x,24.3,-13,4.2,.1,101,'path');
    C.box(garden,x,24.31,-15,32,.1,4.2,'path');
    fountain(x,-15,24.3,6.3);
    for(let z of [-52,22]){
      for(let xx of [x-9,x+9]){
        C.box(garden,xx,24.3,z,10,.35,20,'soil');
        C.box(garden,xx,25,z,10,1.3,.9,'hedge');
        C.box(garden,xx,25,z-9.5,10,1.3,.9,'hedge');
        C.box(garden,xx,25,z+9.5,10,1.3,.9,'hedge');
        for(let s of [-1,1])C.box(garden,xx+s*4.6,25,z,.9,1.3,20,'hedge');
        C.cyl(garden,xx,25.1,z,3.3,3.3,.65,'hedge',16);
        for(let j=0;j<8;j++){let a=j*PI/4;C.sphere(garden,xx+Math.sin(a)*2.1,25.65,z+Math.cos(a)*2.1,.44,j%2?'burgundy':'booksGold',6);}
      }
    }
    for(let z of [-65,-39,12,39,57])for(let off of [-13,13]){
      C.box(garden,x+off,24.6,z,3.6,.9,3.6,'stone');C.tree(garden,x+off,25.1,z,.86,'cypress');
    }
    for(let z of [-35,8,45])for(let off of [-5.6,5.6]){
      C.box(garden,x+off,25.2,z,2.1,.5,5.4,'stoneLight');for(let zz of [-1.7,1.7])C.box(garden,x+off,24.65,z+zz,1.4,1,1,'stone');
    }
  }
  // Lower courtyard fountain and radial ceremonial stones.
  fountain(0,70,24.3,5.9);
  for(let side of [-1,1]){
    C.box(garden,side*50,24.25,66,31,.25,33,'grass');
    for(let xoff of [-14,14])C.box(garden,side*50+xoff,25,66,1.3,1.6,31,'hedge');
    for(let z of [51,81])C.box(garden,side*50,25,z,29,1.6,1.3,'hedge');
    for(let z of [55,76])C.tree(garden,side*50,24.5,z,.9,'cypress');
    C.box(garden,side*50,26.8,66,4.5,5.2,4.5,'stoneDark');
    C.box(garden,side*50,29.7,66,5.3,.7,5.3,'trim');
    // Abstract armored sentinel statue on a stone plinth.
    C.cyl(garden,side*50,31.4,66,.9,1.5,3.5,'stoneLight',8);
    C.sphere(garden,side*50,33.7,66,.9,'stoneLight',10);
    C.cone(garden,side*50,34.6,66,.9,1.2,'stoneLight',8);
    C.beam(garden,[side*50-1.3,30.9,66],[side*50-2.3,32,66],.35,'stoneLight');
    C.beam(garden,[side*50-2.3,29,66],[side*50-2.3,36.5,66],.12,'gold');
    C.cone(garden,side*50-2.3,37,66,.35,1.2,'gold',6);
  }
  // The former rear garden is now the connected grand-palace forecourt.
  for(let side of [-1,1]){
    let q=C.group((side<0?'West':'East')+' garden arcade',garden);q.position.set(side*82,24,-78);
    for(let z=-23;z<=23;z+=7.7){C.cyl(q,0,5,z,.8,1.1,10,'stoneLight',10);C.box(q,0,10,z,2.7,.7,2.7,'trim');}
    for(let z=-19.15;z<=19.15;z+=7.7)C.arch(q,0,6,z,6.7,4.4,1.4,'stoneLight',PI/2,.5);
    C.box(q,0,11.2,0,5.6,1.3,51,'stone');C.roof(q,0,11.8,0,7,52,4.7,'roof');
    C.box(q,0,.15,0,6,.3,52,'stoneLight');
  }
  // Trees in peripheral pockets soften hard walls while preserving all routes.
  for(let side of [-1,1])for(let p of [[173,-70],[177,-24],[174,20],[164,67],[118,145],[300,-260],[330,-180]]){
    C.tree(town,side*p[0],8.1,p[1],1.15,'cypress');
  }
  // Optional environment metadata is consumed by the viewer and exported documentation.
  C.environmentStats={historicTowerCountUpdated:true,townHouseCount:hi+2,bridgeArches:3,terraceHeights:[8,24,42],siteWidth:620,siteDepth:660};
  // V2: architecturally attached details, preserving every route and footprint.
  C.environmentStats.v2DetailPrimitives=buildEnvironmentDetail(C,pts);
  C.environmentStats.detailVersion=2;
}

// V2 — close-view craft detail. Geometry follows existing surfaces and local house frames.
function buildEnvironmentDetail(C,outerPoints){
  const T=C.THREE,G=C.groups,PI=Math.PI,startCount=C.primitiveCount;
  const masonry=C.group('V2_Front_Curtain_Masonry',G.fortifications);
  const gate=C.group('V2_Carved_Gate_and_Drawbridge_Hardware',G.fortifications);
  const plants=C.group('V2_Garden_Flowers_and_Fountain_Carving',G.garden);
  const ivy=C.group('V2_Retaining_Wall_Ivy',G.terrain);
  const cliffs=C.group('V2_Weathered_Cliff_Ledges',G.terrain);
  const stoneKinds=['stoneWarm','stone','stoneCool','agedStone','stone'];
  const ringCache=new Map();
  function torusRing(g,x,y,z,r,t,m,rx=0,ry=0,rz=0){const key=r+','+t;if(!ringCache.has(key))ringCache.set(key,new T.TorusGeometry(r,t,5,20));const o=C.mesh(g,ringCache.get(key),m,x,y,z);o.rotation.set(rx,ry,rz);return o;}
  function wedge(g,xc,yc,zc,rin,rout,a,b,depth,mat){
    const sh=new T.Shape();sh.moveTo(Math.cos(a)*rin,Math.sin(a)*rin);
    sh.lineTo(Math.cos(a)*rout,Math.sin(a)*rout);sh.absarc(0,0,rout,a,b,false);
    sh.lineTo(Math.cos(b)*rin,Math.sin(b)*rin);sh.absarc(0,0,rin,b,a,true);sh.closePath();
    const geo=new T.ExtrudeGeometry(sh,{depth,bevelEnabled:false,curveSegments:2});geo.translate(0,0,-depth/2);C.mesh(g,geo,mat,xc,yc,zc);
  }
  // Individually jointed front blocks; shallow faces retain the original wall walk width.
  for(const i of [0,1,22,23]){
    const a=outerPoints[i],b=outerPoints[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),rot=Math.atan2(dx,dz);
    const g=C.group('V2_Coursed_South_Wall_'+i,masonry);g.position.set((a[0]+b[0])/2,0,(a[1]+b[1])/2);g.rotation.y=rot;
    for(let row=0;row<6;row++){
      const shift=(row%2)*1.7;
      for(let z=-len/2+2.3+shift,k=0;z<len/2-1.3;z+=3.45,k++){
        C.box(g,-2.53,9.5+row*2.38,z,.22,2.19,3.23,stoneKinds[(row*3+k+i)%stoneKinds.length]);
      }
    }
    // Stone hood caps and angled buttress toes give retaining piers a deliberate profile.
    for(let z=-len/2+9;z<len/2-4;z+=11){
      C.box(g,-3.15,14.5,z,1.35,12.5,1.9,'agedStone');
      C.box(g,-3.3,20.9,z,1.7,.5,2.4,'trim');
      const toe=C.box(g,-3.4,10.1,z,1.9,3.8,2.7,'stoneDark');toe.rotation.z=-.10;
      C.box(g,-3.28,21.45,z,1.35,.6,1.95,'stoneWarm');
    }
  }
  // Front tower blocks sit on the tapered cylinder face, clear of the lancet windows.
  for(const side of [-1,1])for(let row=0;row<4;row++)for(let j=0;j<12;j++){
    const a=j*PI/6+(row%2)*PI/12,y=10.4+row*2.4,r=10.8+(37-y)/29+.08;
    C.box(gate,side*24+Math.sin(a)*r,y,201+Math.cos(a)*r,2.7,2.17,.22,stoneKinds[(row+j)%stoneKinds.length],a);
  }
  // Deep-set, open carved arch with radial voussoirs and a projecting keystone.
  for(let k=0;k<19;k++){
    const a=k*PI/19+.016,b=(k+1)*PI/19-.016;
    wedge(gate,0,18.5,207.18,10.35,13.0,a,b,.66,k%4===0?'stoneWarm':'trim');
  }
  for(const side of [-1,1])for(let row=0;row<5;row++){
    C.box(gate,side*11.68,9.1+row*1.9,207.23,2.53,1.73,.7,row%2?'stoneLight':'stoneWarm');
  }
  C.box(gate,0,31.0,207.66,2.3,3.1,.72,'stoneLight');
  C.pointed(gate,0,29.8,208.08,1.25,2.1,.13,'gold');
  for(const side of [-1,1]){
    C.box(gate,side*11.15,13.3,207.76,.22,8.7,.18,'metal');
    for(let y=9.6;y<=17;y+=1.8)C.sphere(gate,side*11.15,y,207.9,.14,'copper',6);
    C.box(gate,side*10.3,24.7,194.8,.3,9.4,.4,'metal');
    C.box(gate,side*10.4,30.9,194.4,2.4,.55,1.1,'wood');
    // Small inset shields belong to the upper facade, well above the clear opening.
    C.pointed(gate,side*11.1,33.2,207.4,1.9,2.7,.18,'copper');
    torusRing(gate,side*11.1,34.5,207.56,.48,.07,'gold');
  }
  // Wooden drawbridge deck with strap iron and taut chains above the side edges.
  for(let i=0;i<16;i++)C.box(gate,-7.5+i,8.26,215,.91,.24,12,'woodLight');
  for(let z of [210.3,214.8,219.5])C.box(gate,0,8.43,z,15.7,.11,.42,'metal');
  for(const side of [-1,1]){
    const from=new T.Vector3(side*8.8,20.8,207.6),to=new T.Vector3(side*8.8,8.8,220.2);
    C.beam(gate,from.toArray(),to.toArray(),.065,'metal',6);
    for(let j=0;j<15;j++){
      const p=from.clone().lerp(to,j/14);const o=torusRing(gate,p.x,p.y,p.z,.23,.055,'metal');
      o.rotation.set(.76,j%2?PI/2:0,0);
    }
    torusRing(gate,side*8.8,20.8,207.65,.45,.1,'copper',0,PI/2);
    C.box(gate,side*8.8,21.1,207.45,.7,1.5,.6,'metal');
  }
  // Four bracket lanterns cast no artificial geometry into the pedestrian passage.
  function lantern(x,y,z){
    C.box(gate,x,y+.1,z-.36,.42,2.3,.28,'metal');
    C.beam(gate,[x,y+.8,z-.24],[x,y+.8,z+1.45],.095,'metal');
    C.beam(gate,[x,y-.55,z-.23],[x,y+.8,z+1.2],.075,'metal');
    torusRing(gate,x,y+.4,z+1.45,.22,.06,'metal');
    C.cyl(gate,x,y-.3,z+1.45,.55,.55,1.3,'glassAmber',6);
    C.cyl(gate,x,y-.98,z+1.45,.72,.58,.22,'copper',6);
    C.cone(gate,x,y+.58,z+1.45,.75,.7,'copper',6);
    for(let k=0;k<6;k++){let a=k*PI/3;C.beam(gate,[x+Math.sin(a)*.56,y-.95,z+1.45+Math.cos(a)*.56],[x+Math.sin(a)*.56,y+.35,z+1.45+Math.cos(a)*.56],.04,'metal',4);}
  }
  for(const side of [-1,1]){lantern(side*24,18.7,212.2);lantern(side*17.5,19.3,257.2);}
  // All details use each building's local frame; rotations and street setbacks stay intact.
  const houses=[];G.town.traverse(o=>{if(o.userData&&o.userData.envHouse)houses.push(o);});
  for(let idx=0;idx<houses.length;idx++){
    const house=houses[idx],{w,d,h,variant}=house.userData.envHouse;
    const g=C.group('V2_Shutters_Shopfront_and_Pottery',house),front=d/2+.3;
    for(const xx of [-w*.28,w*.28])for(const s of [-1,1]){
      const shutter=C.group('Hinged_Shutter',g);shutter.position.set(xx+s*1.4,9.1,front+.13);shutter.rotation.y=-s*.24;
      C.box(shutter,0,0,0,.93,3.45,.18,variant%3===0?'roofDark':'wood');
      C.box(shutter,0,-1.13,.12,.98,.15,.09,'metal');C.box(shutter,0,1.12,.12,.98,.15,.09,'metal');
      C.beam(shutter,[-.34,-1.43,.13],[.34,1.43,.13],.065,'woodLight',4);
    }
    // Crown braces occupy the spandrels above the glazing instead of crossing windows.
    if(h>14.5)for(const xx of [-w*.28,w*.28]){
      C.beam(g,[xx-1.35,12.2,front],[xx,h-.85,front],.12,'wood',4);
      C.beam(g,[xx+1.35,12.2,front],[xx,h-.85,front],.12,'wood',4);
    }
    const sx=w*.39;
    C.beam(g,[sx,5.85,front],[sx,5.85,front+2.1],.08,'metal',6);
    C.beam(g,[sx,4.9,front],[sx,5.85,front+1.9],.07,'metal',6);
    for(let ox of [-.55,.55])C.beam(g,[sx+ox,5.85,front+1.85],[sx+ox,5.3,front+1.85],.035,'metal',4);
    C.box(g,sx,4.8,front+1.85,1.8,1.1,.16,idx%3===0?'burgundy':'woodLight');
    C.box(g,sx,4.8,front+1.96,1.5,.82,.055,idx%3===0?'woodLight':'wood');
    if(idx%3===0){
      torusRing(g,sx,4.8,front+2.02,.28,.07,'gold');C.box(g,sx,4.69,front+2.07,.55,.1,.08,'wood');
    }else if(idx%3===1){
      const loaf=C.sphere(g,sx,4.8,front+2.07,.28,'booksGold',8);loaf.scale.set(1.8,.65,.33);
    }else{
      C.beam(g,[sx-.3,4.53,front+2.07],[sx+.24,5.1,front+2.07],.055,'gold',5);C.box(g,sx+.19,5.04,front+2.07,.36,.15,.09,'gold',-.65);
    }
    // Two hand-thrown vessels create scale without occupying the central doorway.
    for(let j=0;j<2;j++){
      const px=-w*.35-j*.95,pz=front+.8+(j%2)*.35,yy=.15,rr=j?.38:.52,hh=j?.83:1.16;
      C.cyl(g,px,yy+hh*.5,pz,rr*.72,rr*.84,hh,j?'stoneWarm':'clay',10);
      torusRing(g,px,yy+hh,pz,rr*.73,.065,'clay',PI/2);
      C.cyl(g,px,yy+hh-.04,pz,rr*.56,rr*.56,.03,'soil',10);
      if(j===0)C.beam(g,[px,yy+.95,pz],[px+.12,yy+2,pz],.035,'leaf',4);
    }
  }
  // Crates of produce are attached to existing market counters, not scattered in streets.
  const market=C.group('V2_Market_Baskets_and_Produce',G.town);
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const x=side*(34+i*9),z=130+(i%2)*11;
    for(let k=0;k<2;k++){
      const xx=x-1.6+k*3.1;
      C.cyl(market,xx,10.56,z+.35,.76,.63,.45,'woodLight',10);
      torusRing(market,xx,10.8,z+.35,.77,.07,'wood',PI/2);
      for(let j=0;j<5;j++){const a=j*2*PI/5;C.sphere(market,xx+Math.sin(a)*.39,10.94,z+.35+Math.cos(a)*.39,.22,(i+k)%2?'booksGold':'flowerRose',6);}
    }
    const crateX=x+3.7;
    C.box(market,crateX,8.8,z+2.9,1.8,1.2,1.4,'wood');
    for(let y of [8.35,8.7,9.05,9.4])C.box(market,crateX,y,z+3.64,1.94,.24,.12,'woodLight');
    C.beam(market,[crateX-.78,8.32,z+3.75],[crateX+.78,9.43,z+3.75],.08,'woodLight',4);
  }
  // Backed limestone benches match the existing stone seats on the side garden paths.
  for(const side of [-1,1])for(let z of [-35,8,45])for(const off of [-5.6,5.6]){
    const x=side*97+off,back=x+Math.sign(off)*.92;
    C.box(plants,back,26.08,z,.4,1.42,5.3,'stoneWarm');
    C.box(plants,back,26.85,z,.6,.22,5.55,'trim');
    for(let dz of [-2.42,2.42])C.box(plants,x,25.85,z+dz,2.3,.24,.44,'stoneLight');
  }
  function bloom(g,x,y,z,scale,mat){
    C.beam(g,[x,y-.56*scale,z],[x,y+.12*scale,z],.027*scale,'leaf',4);
    for(let k=0;k<4;k++){const a=k*PI/2;const p=C.sphere(g,x+Math.cos(a)*.16*scale,y+.05*scale,z+Math.sin(a)*.16*scale,.22*scale,mat,6);p.scale.set(1,.4,1);}
    C.sphere(g,x,y+.11*scale,z,.1*scale,'booksGold',6);
    const leaf=C.sphere(g,x+.16*scale,y-.27*scale,z,.2*scale,'leafLight',6);leaf.scale.set(1.4,.25,.65);
  }
  // Repeating designed flower clusters at the parterre corners, plus low ground-cover.
  for(const side of [-1,1])for(let z of [-52,22])for(let off of [-9,9]){
    const x=side*97+off;
    for(let j=0;j<4;j++){
      const dx=j%2?3.0:-3.0,dz=j<2?-6.2:6.2;
      const leaf=C.sphere(plants,x+dx,24.85,z+dz,1.2,'leaf',7);leaf.scale.set(1,.32,1.3);
      bloom(plants,x+dx-.24,25.45,z+dz,1.15,(j+side)%2?'flowerRose':'flowerIvory');
      if(j%2===0)bloom(plants,x+dx+.43,25.24,z+dz+.52,.85,'flowerIvory');
    }
    for(const dz of [-8.5,8.5])C.box(plants,x,24.63,z+dz,7.8,.24,.35,'stoneWarm');
  }
  // Masks and rim jets: four readable sculpted faces on each fountain, with arced water.
  for(const spec of [[-97,-15,6.3],[97,-15,6.3],[0,70,5.9]]){
    const [x,z,r]=spec,y=24.3;
    for(let j=0;j<4;j++){
      const a=j*PI/2,s=Math.sin(a),c=Math.cos(a),mx=x+s*(r+.5),mz=z+c*(r+.5);
      const mask=C.sphere(plants,mx,y+1.12,mz,.61,'stoneWarm',9);mask.scale.set(1,.92,.7);mask.rotation.y=a;
      C.sphere(plants,mx+s*.35,y+1.02,mz+c*.35,.21,'copper',8);
      for(const ox of [-.23,.23])C.sphere(plants,mx+Math.cos(a)*ox+s*.36,y+1.28,mz-Math.sin(a)*ox+c*.36,.07,'stoneDark',6);
      const from=new T.Vector3(mx-s*.18,y+1.62,mz-c*.18),mid=new T.Vector3(x+s*r*.67,y+3.4,z+c*r*.67),to=new T.Vector3(x+s*r*.43,y+1.53,z+c*r*.43);
      C.mesh(plants,new T.TubeGeometry(new T.QuadraticBezierCurve3(from,mid,to),12,.075,4,false),'foam');
    }
  }
  // Ivy groups follow only blank retaining-wall bays, avoiding both new side gates.
  const leafShape=new T.Shape();leafShape.moveTo(0,.55);leafShape.lineTo(.29,.11);leafShape.lineTo(.18,-.27);leafShape.lineTo(0,-.42);leafShape.lineTo(-.18,-.27);leafShape.lineTo(-.29,.11);leafShape.closePath();
  const leafGeo=new T.ShapeGeometry(leafShape);
  for(const deg of [23,47,63,119,145,166,194,215,241,298,313,337]){
    const a=deg*PI/180,rx=131.55,rz=135.55,xx=Math.sin(a)*rx,zz=-32+Math.cos(a)*rz;
    const q=C.group('V2_Ivy_Climbing_Bay',ivy);q.position.set(xx,0,zz);q.rotation.y=a;
    for(let k=0;k<3;k++){
      const bx=-1.5+k*1.5,h=7.3+k*1.8;
      C.beam(q,[bx,8.4,.2],[bx+Math.sin(k)*.5,8.4+h,.2],.045,'bark',4);
      for(let j=0;j<7;j++){
        const ly=9+j*h/7,lx=bx+Math.sin(j*2.1+k)*.72;
        const leaf=C.mesh(q,leafGeo,'moss',lx,ly,.3);leaf.rotation.z=Math.sin(j+k)*.7;leaf.scale.setScalar(1.25+(j%3)*.18);
      }
    }
  }
  // Fractured ledges and sparse moss bring the natural island out of its smooth tiers.
  for(let i=0;i<66;i++){
    const a=(i+.5)*2*PI/66;if(Math.cos(a)>.96)continue;
    const row=i%3,y=-9+row*5.2,rx=207+(2-row)*3,rz=222+(2-row)*3;
    const x=Math.sin(a)*rx,z=Math.cos(a)*rz;
    const rock=C.mesh(cliffs,new T.IcosahedronGeometry(1,0),i%3===0?'agedStone':i%2?'rockDark':'rock',x,y,z,a);
    rock.scale.set(5.5+C.rng()*4.5,1.7+C.rng()*3.1,2.1+C.rng()*2.6);
    rock.rotation.z=(C.rng()-.5)*.28;
    if(i%3===0){
      const moss=C.mesh(cliffs,new T.IcosahedronGeometry(1,0),'moss',x,y+1.3,z,a);
      moss.scale.set(3.2,1.1,.28);moss.position.x+=Math.sin(a)*2.1;moss.position.z+=Math.cos(a)*2.1;
    }
  }
  return C.primitiveCount-startCount;
}

/* AUTHORED SOURCE: palace.js — preserved V3 model geometry. */
function buildPalace(C){
  const {THREE:T,groups:G}=C, P=G.palace,R=G.roofs,I=G.interiors,D=G.details;
  const b=C.box,cy=C.cyl,co=C.cone,sp=C.sphere,be=C.beam;
  // Real room slabs remain visible when the outer stone shell is cut away.
  for(const [x,z,w,d,name] of [[0,-30,38,82,'Royal_Nave'],[-44,-40.5,38,49,'West_Library'],[44,-40.5,38,49,'East_Chapel'],[0,-91.5,104,26,'Royal_Gallery']]){
    const g=C.group(name+'_Floor',I);b(g,x,41.5,z,w,.7,d,'stoneLight');
    // Perimeter plinths remain in sectional display, with room entrances clear.
    b(g,x-w/2,42.28,z,.65,.85,d,'stone');b(g,x+w/2,42.28,z,.65,.85,d,'stone');
    if(name==='Royal_Gallery')for(const side of [-1,1])b(g,side*29.5,42.28,z-d/2,45,.85,.65,'stone');
    else b(g,x,42.28,z-d/2,w,.85,.65,'stone');
  }
  // Main palace external shell, with a genuine open southern portal.
  for(const x of [-18.8,18.8])b(P,x,57,-30,1.8,30,82,'stone');
  b(P,0,57,-71,39.4,30,1.8,'stone');
  for(const x of [-13.7,13.7])b(P,x,56.5,11,10.6,29,2.2,'stoneLight');
  C.arch(P,0,42,11.3,18,25,3.2,'trim',0,1.65);b(P,0,71,11,40,3,2.4,'stone');
  // Solid curved spandrel: fill only ABOVE the arch's outer semicircle.
  // x=±8.4 joins the side-wall edges, y=69.5 joins the existing header.
  // The full opening below radius9 at spring y=58 remains genuinely empty.
  {
    const halfGap=8.4,outerRadius=9,spring=58,wallTop=69.5;
    const aLeft=Math.acos(-halfGap/outerRadius),aRight=Math.acos(halfGap/outerRadius),edgeY=Math.sqrt(outerRadius*outerRadius-halfGap*halfGap);
    const shape=new T.Shape();shape.moveTo(-halfGap,wallTop-spring);shape.lineTo(-halfGap,edgeY);shape.absarc(0,0,outerRadius,aLeft,aRight,true);shape.lineTo(halfGap,wallTop-spring);shape.closePath();
    const geo=new T.ExtrudeGeometry(shape,{depth:2.2,bevelEnabled:false,curveSegments:40});geo.translate(0,0,-1.1);
    const pos=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/5,(pos.getY(i)+spring)/5);
    const wall=C.mesh(P,geo,'stoneLight',0,spring,11);wall.name='Solid_Curved_Portal_Spandrel';
  }
  // Open wooden leaves and bronze hinge work do not obstruct the portal.
  for(const s of [-1,1]){const g=C.group('Open_Main_Door',P);g.position.set(s*7.6,42,12.55);g.rotation.y=-s*1.05;g.scale.x=1.45;b(g,s*2.4,7.8,0,4.7,15.6,.45,'wood');for(const yy of [2,7.3,12.8])b(g,s*2.4,yy,.27,4.7,.24,.12,'gold');for(let k=0;k<6;k++)b(g,s*(.4+k*.75),7.8,.24,.06,15,.08,'woodLight');
    for(const yy of [3.8,9.8]){b(g,s*2.4,yy,.29,3.5,4.1,.15,'woodLight');b(g,s*2.4,yy,.39,3.05,3.65,.12,'wood');}
    for(const xx of [.45,4.35])for(let j=0;j<10;j++)sp(g,s*xx,.7+j*1.52,.42,.085,'gold',6);
    C.torus(g,s*3.65,7.9,.61,.32,.075,'gold');b(g,s*3.65,8.25,.42,.2,.55,.2,'metal');
  }
  for(const y of [42.5,47,70.5,73.6]){b(P,0,y,-30,41,y===73.6?1.2:.55,85,'trim');}
  // The cornices are narrow bands; remove horizontal fills above the room.
  // Replace giant decorative boxes with true perimeter cornice pieces.
  const bad=P.children.filter(o=>o.isMesh&&o.geometry.parameters&&o.geometry.parameters.width===41);
  for(const o of bad){
    const y=o.position.y,h=o.geometry.parameters.height;P.remove(o);
    b(P,-19.4,y,-30,1.25,h,85,'trim');b(P,19.4,y,-30,1.25,h,85,'trim');
    if(y<58){
      // Ground/lower string courses stop outside the portal, never across it.
      const gapHalf=9.35,sideWidth=19.5-gapHalf;
      for(const side of [-1,1])b(P,side*(gapHalf+sideWidth/2),y,12.1,sideWidth,h,1.25,'trim');
    }else b(P,0,y,12.1,39,h,1.25,'trim');
    b(P,0,y,-72.1,39,h,1.25,'trim');
  }
  // Repeated Gothic buttresses and tall stained windows on both nave flanks.
  for(const s of [-1,1]){
    for(const z of [-62,-47,-32,-17,-2]){
      b(P,s*20.8,53.2,z,3.2,22.4,2.6,'stone');b(P,s*20.8,64.6,z,3.8,.9,3.2,'trim');co(R,s*20.8,69,z,2.3,8,'roof',8);cy(R,s*20.8,73.6,z,.15,.15,1.2,'gold',6);
      const zz=z+6.4;if(zz<6)C.window(P,s*19.78,49,zz,4.8,16,s>0?Math.PI/2:-Math.PI/2,'glassBlue');
    }
  }
  // The complete south elevation sits ahead of the roof's solid z=13.5 end cap.
  // A narrow spandrel supports the lower rose without obstructing the open portal.
  b(P,0,71.7,13.1,11.5,4.6,1.8,'stoneLight');
  const roseY=75.2;
  C.torus(P,0,roseY,14.55,4.15,.42,'trim');cy(P,0,roseY,14.45,3.76,3.76,.18,'glassBlue',32).rotation.x=Math.PI/2;
  for(let k=0;k<12;k++){let a=k*Math.PI/6;be(P,[Math.cos(a)*.94,roseY+Math.sin(a)*.94,14.7],[Math.cos(a)*3.76,roseY+Math.sin(a)*3.76,14.7],.105,'gold',6);}
  C.torus(P,0,roseY,14.75,.94,.12,'gold');sp(P,0,roseY,14.82,.3,'gold',12);
  // Real stone gable face with world-scale masonry/normal-map UVs.
  const tri=new T.BufferGeometry();tri.setAttribute('position',new T.Float32BufferAttribute([-20,74,14,20,74,14,0,91,14],3));tri.setAttribute('uv',new T.Float32BufferAttribute([-4,14.8,4,14.8,0,18.2],2));tri.computeVertexNormals();const triMat=C.mats.stoneLight.clone();triMat.side=T.DoubleSide;triMat.name='Pediment_Stone';C.mesh(P,tri,triMat);
  be(P,[-20,74,14.5],[0,91,14.5],.42,'trim');be(P,[20,74,14.5],[0,91,14.5],.42,'trim');
  C.window(P,0,84.2,14.3,2.4,5.8,0,'glassAmber');C.roof(R,0,74,-30,43,87,18,'roof');
  // Dormers and bronze ridge cresting make the large roof read at close range.
  for(const s of [-1,1])for(const z of [-60,-40,-20,0]){
    const g=C.group('Roof_Dormer',R);g.position.set(s*13,79,z);g.rotation.y=s>0?Math.PI/2:-Math.PI/2;b(g,0,1.8,0,3.8,3.6,3.2,'stoneLight');C.window(g,0,.4,1.8,2.2,3.5,0,'glassBlue');C.roof(g,0,3.8,0,4.8,4.5,3.2);
  }
  for(let z=-70;z<12;z+=5){be(R,[0,92,z],[0,94,z],.09,'gold',5);sp(R,0,94.1,z,.18,'gold',8);}
  // Side wings: open arcades beneath tall window bays, intersected by flying buttresses.
  for(const s of [-1,1]){
    const x=s*44,w=36,z=-40.5,d=47;
    b(P,x+s*18.2,53,z,1.5,22,d,'stone');b(P,x,53,z-d/2,w,22,1.5,'stone');
    // Front wall has a real three-arch loggia facing the forecourt.
    for(const dx of [-12,0,12])C.arch(P,x+dx,42,z+d/2+.3,11,12,2,'stoneLight',0,1.1);
    b(P,x,59.8,z+d/2,w,11.5,1.5,'stone');
    for(const dx of [-11,0,11])C.window(P,x+dx,55.4,z+d/2+1,4.2,8,0,s<0?'glassAmber':'glassBlue');
    for(const zz of [-56,-43,-30])C.window(P,x+s*19,46.3,zz,4.6,12,s>0?Math.PI/2:-Math.PI/2,s<0?'glassAmber':'glassBlue');
    for(const y of [42.4,54.2,64.5]){b(P,x+s*18.5,y,z,1.8,.55,d+2,'trim');b(P,x,y,z+d/2,w+1,.55,1.7,'trim');}
    C.roof(R,x,65,z,w+3,d+3,13.5,'roof');
    for(const zz of [-56,-38,-20]){
      b(P,x+s*20.5,48.4,zz,2.5,12.8,2.5,'stone');co(R,x+s*20.5,57.5,zz,1.9,5,'roof',8);
      be(P,[s*20.5,63,zz],[s*35,58,zz],.7,'stoneLight',8);be(P,[s*20.5,60,zz],[s*35,54.5,zz],.65,'stoneLight',8);
    }
    // Small exterior terrace at each wing's southern entry.
    b(P,x,42,-9,w+3,.6,14,'stoneLight');for(let k=-3;k<=3;k++){const xx=x+k*5;if(Math.abs(k)>1){b(P,xx,44,-2.5,.45,3.6,.45,'trim');sp(P,xx,46,-2.5,.4,'trim');}}
    for(const side of [-1,1])C.flag(D,x+side*15,43,-5,1.3,side*.5);
  }
  // Rear gallery, royal apartments and rooftop belvedere.
  // V3: the old north gallery has a real 12m-wide connection to the new atrium.
  for(const side of [-1,1])b(P,side*29,51.6,-104.8,46,19.2,1.8,'stone');
  {
    const s=new T.Shape();s.moveTo(-6,10.2);s.lineTo(-6,0);s.absarc(0,0,6,Math.PI,0,true);s.lineTo(6,10.2);s.closePath();
    const geo=new T.ExtrudeGeometry(s,{depth:1.8,bevelEnabled:false,curveSegments:24});geo.translate(0,0,-.9);
    const p=geo.attributes.position,u=geo.attributes.uv;for(let k=0;k<p.count;k++)u.setXY(k,p.getX(k)/5,(p.getY(k)+51)/5);
    const span=C.mesh(P,geo,'stone',0,51,-104.8);span.name='Old_Rear_Portal_Curved_Spandrel';
  }
  C.arch(P,0,42,-105.85,14,16,1,'trim',Math.PI,1);
  for(const x of [-52,52])b(P,x,51.6,-91.5,1.6,19.2,27,'stone');
  for(let x=-44;x<=44;x+=11){if(x!==0)C.window(P,x,46.4,-105.9,4.3,10,Math.PI,'glassAmber');C.arch(P,x,42,-78,9.5,11,1.6,'stoneLight',0,1);}
  b(P,0,59,-78,105,5,1.3,'stone');C.roof(R,0,62,-91.5,30,108,12,'roof',Math.PI/2);
  for(const x of [-48,-24,24,48]){cy(P,x,66,-91.5,3.2,3.9,9,'stone',12);co(R,x,77,-91.5,4.3,14,'roof',12);sp(R,x,84.5,-91.5,.45,'gold');}
  // Multi-stage turret with balcony, lancets, folded roof, gilded ridges.
  function tower(x,z,base,r,h,roofH,primary=false){
    const g=C.group(primary?'Royal_Crown_Spire':'Palace_Tower',P),roof=C.group(primary?'Crown_Spire_Roof':'Turret_Roof',R),seg=primary?16:12;
    cy(g,x,base+1.3,z,r+1.5,r+2.2,2.6,'stoneDark',seg);cy(g,x,base+h/2,z,r,r+.6,h,'stone',seg);
    for(const yy of [base+4,base+h*.45,base+h-4]){cy(g,x,yy,z,r+.6,r+.6,.65,'trim',seg);}
    cy(g,x,base+h-1,z,r+1.2,r+.4,2,'stoneLight',seg);
    for(let k=0;k<8;k++){let a=k*Math.PI/4,xx=x+Math.sin(a)*(r+.3),zz=z+Math.cos(a)*(r+.3);C.window(g,xx,base+h*.42,zz,primary?3.5:2.7,primary?13:9,a,'glassBlue');if(primary)C.window(g,xx,base+h*.14,zz,3.4,9,a,'glassAmber');}
    const top=base+h;
    cy(g,x,top,z,r+2,r+2,1,'trim',seg);
    const gallerySpindle=new T.LatheGeometry([new T.Vector2(.17,0),new T.Vector2(.2,.15),new T.Vector2(.11,.35),new T.Vector2(.2,.75),new T.Vector2(.11,1.1),new T.Vector2(.17,1.4)],6);
    for(let k=0;k<seg;k++){
      const a=k*2*Math.PI/seg,xx=x+Math.sin(a)*(r+1.45),zz=z+Math.cos(a)*(r+1.45);
      b(g,xx,top+1.55,zz,.45,2.2,.45,'trim',a);sp(g,xx,top+2.8,zz,.36,'gold',8);
      // Projecting gallery carried by properly inclined stone corbels.
      be(g,[x+Math.sin(a)*(r+.08),top-3.45,z+Math.cos(a)*(r+.08)],[x+Math.sin(a)*(r+1.7),top-.65,z+Math.cos(a)*(r+1.7)],primary?.38:.29,'stoneWarm',6);
      b(g,x+Math.sin(a)*(r+1.12),top-.9,z+Math.cos(a)*(r+1.12),primary?1.1:.8,.52,1.6,'stoneLight',a);
      const am=a+Math.PI/seg;C.mesh(g,gallerySpindle,'trim',x+Math.sin(am)*(r+1.55),top+.55,z+Math.cos(am)*(r+1.55));
    }
    C.torus(g,x,top+2.08,z,r+1.55,.13,'trim',Math.PI/2);
    C.torus(g,x,top+.69,z,r+1.55,.12,'trim',Math.PI/2);
    // Paired lancets are separated by slender colonettes, capped below the gallery.
    for(let k=0;k<(primary?8:4);k++){
      const a=(k/(primary?8:4))*Math.PI*2+Math.PI/8,rad=r+.14,xx=x+Math.sin(a)*rad,zz=z+Math.cos(a)*rad;
      const yy=base+h*.37,hh=h*.63-5.2;
      cy(g,xx,yy+hh/2,zz,primary?.23:.18,primary?.27:.22,hh,'stoneLight',8);
      cy(g,xx,yy+hh,zz,.4,.26,.5,'trim',8);cy(g,xx,yy,zz,.3,.43,.5,'trim',8);
    }
    if(primary){
      for(let k=0;k<16;k++){
        const a=k*Math.PI/8,q=C.group('Crown_Carved_Sun_Panel',g);q.position.set(x+Math.sin(a)*(r+.78),top-3.35,z+Math.cos(a)*(r+.78));q.rotation.y=a;
        b(q,0,0,0,1.35,1.8,.3,'stoneDark');const diamond=b(q,0,0,.22,.62,.62,.14,'gold');diamond.rotation.z=Math.PI/4;sp(q,0,0,.37,.18,'gold',8);
      }
    }
    cy(roof,x,top+1.3,z,r+1.4,r+1.7,1.1,'roofDark',seg);
    // Two tapered roof stages produce a long graceful concave spire silhouette.
    cy(roof,x,top+roofH*.24,z,r*.48,r+1.55,roofH*.47,'roof',seg);
    co(roof,x,top+roofH*.71,z,r*.51,roofH*.5,'roof',seg);
    // Narrow raised slate courses follow the exact two-stage spire profile.
    for(let j=1;j<7;j++){
      const t=j/7,yy=top+roofH*.47*t,rad=(r+1.55)*(1-t)+r*.48*t;
      cy(roof,x,yy,z,rad+.025,rad+.09,.12,'roofDark',seg);
    }
    if(primary)for(let j=1;j<6;j++){
      const t=j/6,yy=top+roofH*.46+roofH*.5*t,rad=r*.51*(1-t);
      cy(roof,x,yy,z,rad+.018,rad+.055,.1,'roofDark',seg);
    }
    for(let k=0;k<seg;k++){const a=k*2*Math.PI/seg;be(roof,[x+Math.sin(a)*(r+1.55),top+.3,z+Math.cos(a)*(r+1.55)],[x+Math.sin(a)*r*.48,top+roofH*.475,z+Math.cos(a)*r*.48],.09,'gold',5);be(roof,[x+Math.sin(a)*r*.48,top+roofH*.475,z+Math.cos(a)*r*.48],[x,top+roofH*.96,z],.07,'gold',5);}
    cy(roof,x,top+roofH+1.2,z,.13,.18,3.2,'gold',8);sp(roof,x,top+roofH+2.9,z,.43,'gold',10);
    if(primary){C.flag(roof,x,top+roofH+3.2,z,1.45,.35);for(const s of [-1,1]){cy(g,x+s*11,top-10,z,2.3,3.4,13,'stoneLight',10);co(roof,x+s*11,top+3,z,3.5,13,'roof',10);sp(roof,x+s*11,top+9.8,z,.35,'gold');}}
  }
  for(const [x,z,r,h,rh] of [[-28,-71,8.5,39,24],[28,-71,8.5,39,24],[-26,5,7.6,36,23],[26,5,7.6,36,23],[-64,-62,5,28,18],[64,-62,5,28,18],[-64,-17,5.5,31,21],[64,-17,5.5,31,21],[-52,-104,6,31,23],[52,-104,6,31,23]])tower(x,z,42,r,h,rh);
  tower(0,-49,77,11.5,45,43,true);
  // Secondary sanctuary spire behind the crown offers a layered skyline.
  tower(0,-94,62,7.4,40,27,false);
  // Ceremonial approach balustrades, braziers, and standing guards.
  for(const s of [-1,1]){
    b(D,s*23.5,43.2,20,2,2.4,13,'stone');
    for(let k=0;k<6;k++){const z=13+k*2.6;cy(D,s*23.5,45,z,.32,.48,2,'trim',8);sp(D,s*23.5,46.2,z,.34,'trim',8);}
    b(D,s*23.5,46.4,20,1,.45,15,'trim');
    cy(D,s*15,44.4,22,.8,1.2,4.8,'stoneLight',12);cy(D,s*15,47,22,1.3,.6,.8,'gold',12);co(D,s*15,48,22,.56,1.7,'emissive',8);C.person(D,s*8.7,42,16,1.2,-s*.35);
  }
  // === Close-view architectural craftsmanship pass ===
  // Portal archivolts preserve the clear 14.7 m inner opening of the first arch.
  const portal=C.group('Sculpted_Southern_Archivolt',P);
  for(const [w,h,z,d,th,m] of [[19,25.5,12.92,.65,.38,'stoneWarm'],[20.2,26.1,13.12,.55,.36,'trim'],[21.4,26.7,13.28,.44,.38,'stoneLight']])C.arch(portal,0,42,z,w,h,d,m,0,th);
  function ringStone(ri,ro,a0,a1,depth){
    const shape=new T.Shape();shape.moveTo(Math.cos(a0)*ro,Math.sin(a0)*ro);shape.absarc(0,0,ro,a0,a1,false);shape.lineTo(Math.cos(a1)*ri,Math.sin(a1)*ri);shape.absarc(0,0,ri,a1,a0,true);shape.closePath();
    const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:3});geo.translate(0,0,-depth/2);return geo;
  }
  for(let k=0;k<21;k++){
    const a0=k*Math.PI/21+.009,a1=(k+1)*Math.PI/21-.009;
    C.mesh(portal,ringStone(9.12,9.72,a0,a1,.32),k===10?'trim':k%3===0?'stoneWarm':'stoneLight',0,58,13.62);
  }
  C.mesh(portal,ringStone(9.05,10.95,Math.PI/2-.075,Math.PI/2+.075,.62),'trim',0,58,13.78);
  b(portal,0,68.46,14.14,.8,.68,.15,'gold');
  for(const s of [-1,1])for(const dx of [10.05,11.08]){
    const x=s*dx;
    b(portal,x,42.28,13.1,1.22,.56,1.25,'stoneDark');cy(portal,x,42.9,13.1,.51,.61,.68,'trim',12);
    cy(portal,x,50.3,13.1,.3,.34,14.3,'stoneLight',12);
    for(let f=0;f<7;f++){const a=f*2*Math.PI/7;be(portal,[x+Math.sin(a)*.32,43.2,13.1+Math.cos(a)*.32],[x+Math.sin(a)*.32,57.1,13.1+Math.cos(a)*.32],.035,'stoneWarm',5);}
    cy(portal,x,57.56,13.1,.57,.34,.55,'stoneWarm',12);b(portal,x,58.01,13.1,1.32,.36,1.35,'trim');
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])sp(portal,x+Math.sin(a)*.39,57.7,13.1+Math.cos(a)*.39,.17,'trim',8);
  }
  // Front quoin pilasters and carefully spaced cornice dentils.
  for(const s of [-1,1]){
    b(P,s*17.7,56.7,12.45,1.1,28.8,.8,'stoneWarm');
    for(let k=0;k<10;k++)b(P,s*17.7,43.1+k*2.8,12.96,1.55,.48,.45,k%2?'stoneLight':'trim');
    b(P,s*17.7,71.15,12.7,2.2,1,1.25,'trim');
  }
  for(let x=-18;x<=18;x+=1.5)if(Math.abs(x)>4.8)b(P,x,72.85,12.8,.57,.72,.9,'trim');
  function sunMedallion(parent,x,y,z,r,ry=0){
    const q=C.group('Royal_Sun_Medallion',parent);q.position.set(x,y,z);q.rotation.y=ry;
    cy(q,0,0,0,r*1.13,r*1.13,.32,'stoneWarm',24).rotation.x=Math.PI/2;
    C.torus(q,0,0,.23,r,.12,'trim');C.torus(q,0,0,.33,r*.77,.1,'gold');
    cy(q,0,0,.21,r*.68,r*.68,.16,'glassBlue',24).rotation.x=Math.PI/2;
    for(let k=0;k<12;k++){
      const a=k*Math.PI/6,shape=new T.Shape();
      const pts=[[Math.cos(a-.13)*r*.38,Math.sin(a-.13)*r*.38],[Math.cos(a)*r*.9,Math.sin(a)*r*.9],[Math.cos(a+.13)*r*.38,Math.sin(a+.13)*r*.38]];
      shape.moveTo(...pts[0]);shape.lineTo(...pts[1]);shape.lineTo(...pts[2]);shape.closePath();C.mesh(q,new T.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:false}),'gold',0,0,.32);
    }
    sp(q,0,0,.49,r*.28,'gold',10);
  }
  for(const s of [-1,1])sunMedallion(P,s*14,54.5,12.7,1.78);
  // Rhythmic blind-arcade friezes give the loggias a carved upper register.
  for(const s of [-1,1]){
    const x=s*44;
    for(let k=0;k<15;k++){const xx=x-16.1+k*2.3;C.arch(P,xx,62.25,-15.87,1.82,1.66,.28,k%3?'trim':'stoneWarm',0,.17);b(P,xx,64.78,-15.8,.58,.52,.74,'trim');}
    for(let k=0;k<17;k++){const zz=-61.8+k*2.65;C.arch(P,s*63.2,62.2,zz,1.85,1.68,.28,'stoneLight',s*Math.PI/2,.17);b(P,s*63.45,64.78,zz,.65,.52,.65,'trim');}
    for(const zz of [-61,-47,-33,-19]){
      b(P,s*63.35,53.25,zz,.65,18.4,.7,'stoneWarm');
      for(const yy of [44.5,49.8,55.1,60.4])b(P,s*63.65,yy,zz,.5,.4,1.14,'trim');
    }
  }
  // Each sculpted gargoyle projects from a cornice; the center path remains clear.
  function gargoyle(x,y,z,ry){
    const q=C.group('Stone_Cornice_Guardian',P);q.position.set(x,y,z);q.rotation.y=ry;
    b(q,0,-.28,.2,1.55,.52,2,'stoneWarm');const body=sp(q,0,.15,.62,.52,'stoneLight',8);body.scale.set(.85,.7,1.5);
    const head=sp(q,0,.44,1.18,.39,'stoneLight',8);head.scale.set(.9,.9,1.15);b(q,0,.25,1.57,.43,.23,.49,'stoneWarm');
    for(const side of [-1,1]){co(q,side*.24,.91,1.1,.12,.58,'stoneLight',6);sp(q,side*.25,.48,1.47,.065,'stoneDark',6);
      const wing=new T.Shape();wing.moveTo(side*.23,0);wing.lineTo(side*1.32,.7);wing.lineTo(side*.88,-.23);wing.lineTo(side*.23,-.38);wing.closePath();C.mesh(q,new T.ExtrudeGeometry(wing,{depth:.17,bevelEnabled:false}),'stoneWarm',0,.39,.32);
    }
    be(q,[0,.48,.17],[0,.17,-.8],.13,'stoneLight',6);
  }
  for(const s of [-1,1]){gargoyle(s*18.2,73.7,12.5,0);for(const z of [-57,-12])gargoyle(s*21.3,70.9,z,s*Math.PI/2);}
  // Raised slate rows on the focal southern roof planes, all isolated with the roofs.
  function focalSlates(x,z,w,d,h,base,rows,depthSpan,ry=0){
    const q=C.group('Hand_Laid_Front_Slates',R);q.position.set(x,base,z);q.rotation.y=ry;
    const half=w/2,slope=Math.atan2(h,half),slant=Math.hypot(half,h),step=slant/rows,run=2.65;
    for(const side of [-1,1])for(let row=0;row<rows;row++){
      const t=(row+.5)/rows,xx=side*half*(1-t),yy=h*t+.052,offset=(row%2)*run/2;
      for(let zz=d/2-depthSpan+offset;zz<d/2-.45;zz+=run){
        const tile=b(q,xx,yy,zz,step*.98,.1,Math.min(run-.08,d/2-zz+.38),row%5===0?'roofDark':'roof');tile.rotation.z=-side*slope;
      }
    }
  }
  focalSlates(0,-30,43,87,18,74,18,19);
  for(const s of [-1,1])focalSlates(s*44,-40.5,39,50,13.5,65,14,18);
  // Fine fleur-shaped cresting, born from the same original sun-leaf language.
  for(let z=-67;z<12;z+=5){
    const q=C.group('Ridge_Sunleaf_Crest',R);q.position.set(0,93.55,z);q.rotation.y=Math.PI/2;
    C.pointed(q,0,0,0,.44,1.62,.08,'gold');
    for(const side of [-1,1]){const leaf=C.pointed(q,side*.31,.35,0,.42,.91,.08,'gold');leaf.rotation.z=-side*.65;}
  }
  // Continuous turned-stone terrace rails frame the entire royal platform.
  // The 40 m central gate on the south edge stays entirely open.
  const balusterGeo=new T.LatheGeometry([new T.Vector2(.22,0),new T.Vector2(.25,.12),new T.Vector2(.14,.32),new T.Vector2(.13,.7),new T.Vector2(.29,1.15),new T.Vector2(.27,1.4),new T.Vector2(.13,1.92),new T.Vector2(.15,2.35),new T.Vector2(.23,2.55),new T.Vector2(.23,2.7)],8);
  function terraceRail(ax,az,bx,bz){
    const len=Math.hypot(bx-ax,bz-az),q=C.group('Carved_Royal_Terrace_Balustrade',D);q.position.set((ax+bx)/2,0,(az+bz)/2);q.rotation.y=-Math.atan2(bz-az,bx-ax);
    b(q,0,42.7,0,len,.54,1.22,'stoneWarm');b(q,0,45.98,0,len,.45,1.08,'trim');b(q,0,46.26,0,len,.16,1.28,'stoneLight');
    const n=Math.floor(len/2.7);for(let i=1;i<n;i++)C.mesh(q,balusterGeo,i%5?'stoneLight':'stoneWarm',-len/2+i*len/n,43.05,0);
    const posts=Math.ceil(len/12);for(let i=0;i<=posts;i++){
      const xx=-len/2+i*len/posts;b(q,xx,44.5,0,1.1,3.5,1.24,'stoneLight');b(q,xx,46.39,0,1.5,.34,1.55,'trim');cy(q,xx,46.85,0,.38,.46,.56,'stoneWarm',8);sp(q,xx,47.25,0,.42,'trim',8);
    }
  }
  for(const s of [-1,1]){terraceRail(s*72,-118,s*72,24);terraceRail(s*20,24,s*72,24);}terraceRail(-72,-118,-11,-118);terraceRail(11,-118,72,-118);
  // Sculpted stone custodians flank the approach at a deliberate monumental scale.
  function guardianStatue(x,z,mirror){
    const q=C.group(mirror<0?'Western_Archive_Custodian':'Eastern_Sun_Custodian',D);q.position.set(x,42,z);q.rotation.y=mirror*.14;
    b(q,0,.27,0,4.5,.54,4.2,'stoneDark');b(q,0,1.27,0,3.5,1.58,3.4,'stoneWarm');b(q,0,2.2,0,4,.34,3.85,'trim');
    const bodyGeo=new T.LatheGeometry([new T.Vector2(.97,0),new T.Vector2(.86,.3),new T.Vector2(.67,1.65),new T.Vector2(.59,2.12),new T.Vector2(.88,2.68),new T.Vector2(.96,2.97),new T.Vector2(.34,3.27)],12);
    C.mesh(q,bodyGeo,'stoneLight',0,2.39,0);
    const cloak=new T.Shape();cloak.moveTo(-1.05,0);cloak.lineTo(1.05,0);cloak.quadraticCurveTo(.9,1.2,1.16,2.89);cloak.quadraticCurveTo(0,3.5,-1.16,2.89);cloak.quadraticCurveTo(-.9,1.2,-1.05,0);cloak.closePath();C.mesh(q,new T.ExtrudeGeometry(cloak,{depth:.2,bevelEnabled:false,curveSegments:5}),'stoneWarm',0,2.4,-.5);
    cy(q,0,5.78,0,.25,.3,.45,'stoneLight',10);const head=sp(q,0,6.22,.03,.48,'stoneLight',12);head.scale.set(.77,1.08,.83);const hair=sp(q,0,6.38,-.12,.46,'stoneWarm',10);hair.scale.set(.84,.91,.66);
    b(q,0,6.21,.41,.13,.22,.12,'stoneLight');C.torus(q,0,6.34,-.3,.7,.075,'trim');
    for(const s of [-1,1]){be(q,[s*.78,5.18,0],[s*1.03,4.45,.32],.21,'stoneLight',8);be(q,[s*1.03,4.45,.32],[s*.64,4.63,.76],.17,'stoneLight',8);sp(q,s*.63,4.64,.78,.2,'stoneLight',8);}
    for(const f of [-.55,-.27,0,.27,.55])be(q,[f,2.59,.72-Math.abs(f)*.28],[f*.63,4.5,.52],.042,'stoneWarm',5);
    for(const s of [-1,1]){const foot=sp(q,s*.32,2.52,.43,.29,'stoneLight',8);foot.scale.set(.7,.5,1.6);}
    if(mirror<0){const book=C.group('Carved_Open_Archive',q);book.position.set(0,4.66,.83);book.rotation.x=-.32;for(const s of [-1,1]){const leaf=b(book,s*.44,0,0,.83,.17,.92,'stoneLight');leaf.rotation.z=s*.12;for(let k=0;k<4;k++)b(book,s*.44,.1,-.25+k*.16,.55,.025,.024,'stoneWarm');}b(book,0,-.01,0,.1,.24,.98,'stoneWarm');}
    else{be(q,[1.31,2.48,.23],[1.31,7.32,.23],.085,'stoneWarm',8);sunMedallion(q,1.31,7.52,.23,.55);}
    sunMedallion(q,0,1.25,1.77,.58);
  }
  guardianStatue(-45,15,-1);guardianStatue(45,15,1);
}

/* AUTHORED SOURCE: interiors.js — preserved V3 model geometry. */
/* Baegwol Royal Citadel — original detailed interiors. */
function buildInteriors(C) {
  const T=C.THREE, PI=Math.PI;
  const main=C.group('01_Throne_Hall',C.groups.interiors);
  const lib=C.group('02_Royal_Library',C.groups.interiors);
  const chapel=C.group('03_Sun_Chapel',C.groups.interiors);
  const gallery=C.group('04_Royal_Gallery',C.groups.interiors);
  const crypt=C.group('05_Ancient_Undercroft',C.groups.underground);
  const mats=['booksRed','booksBlue','booksGold','woodLight','burgundy'];
  function box(g,x,y,z,w,h,d,m,r=0){return C.box(g,x,y,z,w,h,d,m,r);}
  // Handcrafted close-view details use low-resolution sweeps, relief and textiles.
  function sweep(g,points,r,mat='gold',segments=12,radial=4){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    return C.mesh(g,new T.TubeGeometry(curve,segments,r,radial,false),mat);
  }
  function ring(g,x,y,z,r,t,mat='gold',rx=0,ry=0,rz=0){
    const o=C.mesh(g,new T.TorusGeometry(r,t,4,16),mat,x,y,z);o.rotation.set(rx,ry,rz);return o;
  }
  function clothSurface(g,x,y,z,w,d,amp,mat='linen',ry=0){
    const nx=12,nz=8,p=[],uv=[],idx=[];
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const a=i/nx,b=j/nz,edge=Math.sin(a*PI)*Math.sin(b*PI);
      p.push((a-.5)*w,amp*(.35*Math.sin(a*PI*9+b*2)+edge*.55),(b-.5)*d);uv.push(a,b);
      if(i<nx&&j<nz){let k=j*(nx+1)+i;idx.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}
    }
    const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(p,3));geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geom.setIndex(idx);geom.computeVertexNormals();
    return C.mesh(g,geom,mat,x,y,z,ry);
  }
  function pillow(g,x,y,z,w,h,d,mat='burgundy',ry=0){
    const o=C.mesh(g,new T.SphereGeometry(1,10,6),mat,x,y,z,ry);o.scale.set(w/2,h/2,d/2);return o;
  }
  function curtain(g,x,y,z,w,h,ry=0,fabric='burgundy'){
    const p=[],uv=[],idx=[],nx=12,ny=7;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const a=i/nx,b=j/ny;p.push((a-.5)*w,-b*h,Math.sin(a*PI*8)*.18*(.5+b*.5));uv.push(a,b);
      if(i<nx&&j<ny){let k=j*(nx+1)+i;idx.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}
    }
    const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(p,3));geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geom.setIndex(idx);geom.computeVertexNormals();
    const key='draped_'+fabric;if(!C.mats[key]){C.mats[key]=C.mat(fabric).clone();C.mats[key].side=T.DoubleSide;C.mats[key].name='Draped_'+fabric;}
    return C.mesh(g,geom,C.mats[key],x,y,z,ry);
  }
  function openBook(g,x,y,z,w=1.25,d=.9,ry=0){
    const a=C.group('Open_Illuminated_Manuscript',g);a.position.set(x,y,z);a.rotation.y=ry;
    box(a,0,.035,0,w+.12,.07,d+.12,'leather');
    for(let side of [-1,1]){
      const page=C.group('Curved_Page',a);page.position.set(side*w*.25,.105,0);page.rotation.z=-side*.11;
      box(page,0,0,0,w*.48,.06,d,'parchment');
      for(let j=0;j<6;j++){let len=w*(j===0?.29:.36)-(j%3)*.025;box(page,0,.041,-d*.33+j*d*.115,len,.012,.015,j===0?'booksRed':'wood');}
      box(page,-side*w*.19,.041,0,.015,.012,d*.82,'gold');
    }
    box(a,0,.133,0,.025,.03,d,'burgundy');
    return a;
  }
  function scroll(g,x,y,z,l=1.2,ry=0){
    const a=C.group('Rolled_Parchment_Map',g);a.position.set(x,y,z);a.rotation.y=ry;
    const m=C.cyl(a,0,.13,0,.13,.13,l,'parchment',10);m.rotation.z=PI/2;
    for(let xx of [-l/2,l/2]){const cap=C.cyl(a,xx,.13,0,.085,.085,.018,'woodLight',8);cap.rotation.z=PI/2;}
    ring(a,0,.13,0,.14,.022,'burgundy',0,PI/2);
  }
  function goblet(g,x,y,z,s=1){
    C.cyl(g,x,y+.03*s,z,.25*s,.28*s,.06*s,'gold',10);
    C.cyl(g,x,y+.21*s,z,.045*s,.07*s,.36*s,'gold',8);
    const profile=[[.06,0],[.14,.04],[.24,.18],[.25,.38],[.22,.4],[.2,.35],[.18,.18],[.1,.07]].map(p=>new T.Vector2(p[0]*s,p[1]*s));
    C.mesh(g,new T.LatheGeometry(profile,12),'gold',x,y+.32*s,z);
    C.cyl(g,x,y+.64*s,z,.195*s,.195*s,.012*s,'stainedRuby',12);
  }
  function rosette(g,x,y,z,r,mat='gold',ry=0){
    const a=C.group('Carved_Rosette',g);a.position.set(x,y,z);a.rotation.y=ry;
    for(let k=0;k<6;k++){const ang=k*PI/3;C.beam(a,[Math.sin(ang)*r*.2,Math.cos(ang)*r*.2,0],[Math.sin(ang)*r,Math.cos(ang)*r,0],r*.12,mat,5);}
    C.sphere(a,0,0,.03,r*.25,mat,8);return a;
  }
  function pole(g,x,y,z,h,r=.45,m='stoneLight'){
    C.cyl(g,x,y+.24,z,r*1.7,r*1.85,.48,'stoneDark',12);
    C.cyl(g,x,y+.65,z,r*1.45,r*1.6,.38,'trim',12);
    C.cyl(g,x,y+h/2,z,r,r*1.08,h-1.1,m,16);
    C.cyl(g,x,y+h-.65,z,r*1.5,r*1.2,.52,'trim',12);
    C.cyl(g,x,y+h-.18,z,r*1.85,r*1.85,.36,'gold',12);
    for(let k=0;k<4;k++){let a=k*PI/2;C.beam(g,[x+Math.sin(a)*r*.97,y+1.1,z+Math.cos(a)*r*.97],[x+Math.sin(a)*r*.97,y+h-1,z+Math.cos(a)*r*.97],.055,'trim',4);}
    if(h>=15&&m!=='stoneDark'){
      box(g,x,y+h+.04,z,r*4,.22,r*4,'stoneWarm');
      for(let k=0;k<4;k++){let a=k*PI/2;const q=C.group('Leaf_Carved_Capital',g);q.position.set(x,y+h-1.65,z);q.rotation.y=a;C.pointed(q,0,0,r*1.07,r*1.32,1.35,.12,'gold');C.pointed(q,-r*.65,.35,r*1.03,r*.7,.85,.08,'trim',-.3);C.pointed(q,r*.65,.35,r*1.03,r*.7,.85,.08,'trim',.3);sweep(q,[[-r*.75,1.25,r],[0,.8,r*1.25],[r*.75,1.25,r]],.06,'gold',8,4);}
    }
  }
  function candle(g,x,y,z,s=1){
    C.cyl(g,x,y+.055*s,z,.19*s,.23*s,.11*s,'gold',8);
    C.cyl(g,x,y+.42*s,z,.09*s,.11*s,.75*s,'gold',8);
    C.cyl(g,x,y+.91*s,z,.17*s,.13*s,.28*s,'linen',8);
    C.cone(g,x,y+1.16*s,z,.12*s,.35*s,'emissive',8);
  }
  function candelabrum(g,x,y,z,s=1){
    C.cyl(g,x,y+.1*s,z,.55*s,.7*s,.2*s,'gold',12);
    C.cyl(g,x,y+1.4*s,z,.12*s,.19*s,2.6*s,'gold',10);
    C.sphere(g,x,y+2.55*s,z,.27*s,'gold',10);
    for(let k=0;k<5;k++){
      let a=k*PI*2/5,xx=x+Math.cos(a)*.85*s,zz=z+Math.sin(a)*.85*s;
      C.beam(g,[x,y+2.15*s,z],[xx,y+2.65*s,zz],.07*s,'gold',6);
      candle(g,xx,y+2.65*s,zz,.65*s);
    }
  }
  function chair(g,x,y,z,ry=0,royal=false){
    const a=C.group('Chair',g);a.position.set(x,y,z);a.rotation.y=ry;
    const m=royal?'gold':'wood';
    box(a,0,.8,0,1.25,.22,1.25,m);pillow(a,0,.99,0,1.13,.23,1.1,'burgundy');
    for(const xx of [-.47,.47]) for(const zz of [-.46,.46]) box(a,xx,.38,zz,.13,.76,.13,m);
    box(a,0,1.7,-.52,1.24,1.85,.18,m);box(a,0,1.75,-.4,.93,1.25,.08,'burgundy');
    if(royal){for(const xx of [-.65,.65]){C.cyl(a,xx,1.4,-.5,.09,.12,2.8,'gold',8);C.sphere(a,xx,2.86,-.5,.18,'gold',8);}C.pointed(a,0,2.48,-.5,1.27,.8,.16,'gold');
      for(let side of [-1,1]){C.cyl(a,side*.62,1.25,.34,.055,.07,.7,'gold',8);sweep(a,[[side*.62,1.65,-.43],[side*.68,1.65,.16],[side*.62,1.6,.48]],.065,'gold',8,4);}
      for(let yy of [1.45,1.85,2.25])for(let xx of [-.26,.26])C.sphere(a,xx,yy,-.345,.035,'gold',6);
    }
    return a;
  }
  function rug(g,x,z,w,d,mat='carpet',y=42.11){
    box(g,x,y,z,w,.035,d,'gold');box(g,x,y+.025,z,w-.23,.035,d-.23,mat);
    for(const xx of [x-w/2+.32,x+w/2-.32])box(g,xx,y+.055,z,.045,.018,d-.6,'gold');
    for(let zz=z-d/2+.85;zz<z+d/2-.6;zz+=1.25)for(const xx of [x-w/2+.56,x+w/2-.56])box(g,xx,y+.074,zz,.13,.018,.13,'linen',PI/4);
    for(let xx=x-w/2+.45;xx<x+w/2-.3;xx+=.5)for(let side of [-1,1])box(g,xx,y+.04,z+side*d/2,.06,.025,.28,'linen');
  }
  function banner(g,x,y,z,w,h,ry=0){
    const a=C.group('Embroidered_Royal_Banner',g);a.position.set(x,y,z);a.rotation.y=ry;
    const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,-h+.8);sh.lineTo(w*.18,-h);sh.lineTo(0,-h+.65);sh.lineTo(-w*.18,-h);sh.lineTo(-w/2,-h+.8);sh.closePath();
    C.mesh(a,new T.ExtrudeGeometry(sh,{depth:.08,bevelEnabled:false}),'burgundy');
    C.beam(a,[-w*.62,.1,0],[w*.62,.1,0],.08,'gold',8);
    C.torus(a,0,-h*.36,.1,w*.22,.055,'gold');
    for(let k=0;k<8;k++){let t=k*PI/4;C.beam(a,[Math.cos(t)*w*.26,-h*.36+Math.sin(t)*w*.26,.1],[Math.cos(t)*w*.35,-h*.36+Math.sin(t)*w*.35,.1],.038,'gold',4);}
    for(const xx of [-w*.44,w*.44])box(a,xx,-h*.43,.1,.035,h*.83,.025,'gold');
  }
  function chandelier(g,x,y,z,r){
    C.beam(g,[x,y+8,z],[x,y+.4,z],.055,'metal',6);
    C.torus(g,x,y,z,r,.105,'gold',PI/2);
    C.torus(g,x,y+.35,z,r*.75,.075,'gold',PI/2);
    for(let i=0;i<10;i++){
      let a=i*PI/5,xx=x+r*Math.cos(a),zz=z+r*Math.sin(a);
      C.beam(g,[x,y+2.7,z],[xx,y+.1,zz],.042,'gold',6);candle(g,xx,y,zz,.7);
      C.cone(g,x+r*.76*Math.cos(a),y-.55,z+r*.76*Math.sin(a),.12,.65,'crystal',6);
    }
    C.sphere(g,x,y-1,z,.28,'gold',12);
  }
  function floorGrid(g,x,z,w,d,step,y=42.02){
    box(g,x,y-.08,z,w,.12,d,'stoneLight');
    let cols=Math.floor(w/step),rows=Math.floor(d/step);
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
      if((i+j)%2===0)box(g,x-w/2+step*(i+.5),y,z-d/2+step*(j+.5),step-.07,.04,step-.07,'stone');
    }
    box(g,x-w/2+.2,y+.02,z,.25,.03,d,'gold');box(g,x+w/2-.2,y+.02,z,.25,.03,d,'gold');
    box(g,x,y+.02,z-d/2+.2,w,.03,.25,'gold');box(g,x,y+.02,z+d/2-.2,w,.03,.25,'gold');
  }
  function book(g,x,y,z,w=.25,h=.7,d=.5,m='booksBlue',ry=0){
    box(g,x,y+h/2,z,w,h,d,m,ry);
    // Thin gilt bands read well at close viewing distances.
    if(ry===0){box(g,x,y+h*.21,z+d/2+.012,w*.86,.025,.018,'gold');if(w>.29)box(g,x,y+h*.79,z+d/2+.012,w*.86,.025,.018,'gold');
      if(w>.31){box(g,x,y+h*.5,z+d/2+.028,w*.6,h*.21,.016,'parchment');box(g,x,y+h+.012,z-.015,w*.76,.016,d*.84,'parchment');}
    }
  }
  function shelf(g,x,y,z,w,h,ry=0){
    let a=C.group('Carved_Bookcase',g);a.position.set(x,y,z);a.rotation.y=ry;
    box(a,0,h/2,-.43,w,h,.18,'wood');
    for(let xx of [-w/2,w/2]){box(a,xx,h/2,0,.18,h,1.2,'wood');C.cyl(a,xx,h+.1,0,.15,.19,.3,'gold',8);}
    let n=4;
    for(let j=0;j<=n;j++){
      let sy=.16+j*(h-.28)/n;box(a,0,sy,0,w+.3,.14,1.2,'woodLight');
      if(j<n){let px=-w/2+.2,idx=0;while(px<w/2-.35){let bw=.18+C.rng()*.18,bh=.54+C.rng()*.37;book(a,px+bw/2,sy+.09,.11,bw,bh,.56,mats[(idx+j*2)%mats.length]);px+=bw+.035;idx++;}}
    }
    box(a,0,h+.15,0,w+.55,.25,1.4,'wood');box(a,0,h+.29,.55,w+.42,.08,.08,'gold');
  }
  function studyTable(g,x,y,z,w,d){
    box(g,x,y+1.4,z,w,.24,d,'woodLight');
    for(const xx of [-w*.4,w*.4]) for(const zz of [-d*.35,d*.35])box(g,x+xx,y+.67,z+zz,.18,1.35,.18,'wood');
    openBook(g,x-.45,y+1.54,z,1.3,.9,-.08);box(g,x+.5,y+1.62,z+.35,.42,.08,.6,'booksBlue',.15);
    box(g,x-.5,y+1.62,z-.1,.62,.06,.7,'booksRed',-.2);
    candle(g,x+w*.33,y+1.55,z-d*.18,.7);scroll(g,x+w*.25,y+1.55,z+d*.28,1.1,.1);
  }
  // THE GREAT HALL — clear entry aisle, geometrically tiled stone, gilded dais.
  floorGrid(main,0,-30,33,76,3);
  rug(main,0,-5,5.5,23);rug(main,0,-42,5.5,24);
  for(const x of [-12.8,12.8])for(const z of [0,-10,-20,-30,-40,-50]){
    pole(main,x,42.1,z,19,.65);
    C.arch(main,x,58,z,8,6,.6,'trim',PI/2,.34);
  }
  for(const x of [-15.8,15.8])for(const z of [-5,-25,-45])banner(main,x,62,z,3.9,8.5,x<0?PI/2:-PI/2);
  for(const z of [-7,-29,-48])chandelier(main,0,62.5,z,3.2);
  // Compass rose floor inlay, the original sun emblem of the citadel.
  const roseZ=-23;
  C.cyl(main,0,42.12,roseZ,5.4,5.4,.08,'stoneDark',48);
  C.torus(main,0,42.18,roseZ,5.05,.07,'gold',PI/2);
  C.torus(main,0,42.19,roseZ,4.4,.035,'gold',PI/2);
  C.cyl(main,0,42.22,roseZ,1.18,1.18,.06,'gold',24);
  for(let k=0;k<16;k++){
    let a=k*PI/8,r=k%2?3.5:4.6;
    let sh=new T.Shape();sh.moveTo(0,r);sh.lineTo(.25,1.25);sh.lineTo(0,.9);sh.lineTo(-.25,1.25);sh.closePath();
    let gm=new T.ShapeGeometry(sh);gm.rotateX(-PI/2);gm.rotateY(a);C.mesh(main,gm,k%2?'trim':'gold',0,42.24,roseZ);
  }
  box(main,0,42.35,-59,16,.65,13,'stoneDark');box(main,0,42.85,-59.4,14.5,.5,11.5,'stoneLight');box(main,0,43.28,-59.8,13.2,.36,10.1,'trim');
  C.stairs(main,0,-51.9,42.1,43.46,8.6,4.4,'stoneLight');rug(main,0,-57.8,5.8,9.2,'carpet',43.48);
  let throne=chair(main,0,43.56,-61,0,true);throne.scale.set(1.9,1.9,1.9);
  for(let x of [-5.5,5.5]){pole(main,x,43.46,-62.5,12,.38);C.cone(main,x,56.1,-62.5,.72,2.3,'gold',8);}
  C.arch(main,0,49.6,-63.3,12,9,1.2,'gold',0,.52);
  C.torus(main,0,58.8,-66.8,2.2,.18,'gold');
  C.cyl(main,0,57.4,-66.7,.2,.2,.35,'gold');
  for(let k=0;k<12;k++){let a=k*PI/6;C.beam(main,[Math.cos(a)*2.6,58.8+Math.sin(a)*2.6,-66.8],[Math.cos(a)*3.4,58.8+Math.sin(a)*3.4,-66.8],.11,'gold',6);}
  for(let x of [-7.5,7.5]){banner(main,x,62.5,-67.5,3.3,11);candelabrum(main,x,43.5,-57.4,1.2);}
  for(let x of [-9.6,9.6])for(let z of [-12,-36])candelabrum(main,x,42.1,z,.85);
  // Armored ceremonial sentries are sculpture-scale cues beside the aisle.
  for(let x of [-10,10])for(let z of [-1,-48]){
    C.cyl(main,x,42.25,z,.9,1.1,.35,'stoneDark',12);C.person(main,x,42.45,z,1.2,x>0?-PI/2:PI/2);
    C.beam(main,[x+.8,42.45,z],[x+.8,46,z],.045,'wood',6);C.cone(main,x+.8,46.2,z,.12,.5,'metal',6);
  }
  // WEST LIBRARY — reading floor, banks of carved shelves, a gallery and ladders.
  floorGrid(lib,-44,-40.5,35,46,3);
  rug(lib,-44,-40.3,13.2,31,'burgundy');
  for(let x of [-55.5,-47.7,-39.9,-32.1])shelf(lib,x,42.1,-59,6.7,5.1,0);
  for(let z of [-51.5,-43,-34.5,-26])shelf(lib,-58.6,42.1,z,6.6,5.1,PI/2);
  for(let z of [-53.5,-43,-32.5])shelf(lib,-29.3,42.1,z,7.8,5.1,-PI/2);
  for(let x of [-48.8,-39.2])for(let z of [-32,-44]){
    studyTable(lib,x,42.1,z,5,3);chair(lib,x,42.1,z+2.4,0);chair(lib,x,42.1,z-2.4,PI);
  }
  // Bookshelves at mid-gallery height are kept against the room's north wall.
  box(lib,-44,48.2,-56.5,30.5,.45,6,'wood');
  for(let x=-57;x<=-31;x+=6.5){pole(lib,x,42.1,-54,5.9,.23,'wood');shelf(lib,x,48.5,-59.3,5.7,4.3,0);}
  box(lib,-44,50,-53.6,30.5,.15,.14,'wood');box(lib,-44,49.05,-53.6,30.5,.14,.14,'wood');
  for(let x=-59;x<-28;x+=1.1)C.cyl(lib,x,49.2,-53.6,.055,.055,1.6,'gold',6);
  // A timber access stair and rolling ladder provide visible circulation.
  C.stairs(lib,-55,-49,42.1,48.5,3.1,10,'woodLight');
  for(const zz of [-41,-27]){
    C.beam(lib,[-57.5,42.1,zz-1.3],[-58.5,47.4,zz-1.3],.075,'woodLight');
    C.beam(lib,[-57.5,42.1,zz+1.3],[-58.5,47.4,zz+1.3],.075,'woodLight');
    for(let i=0;i<9;i++){let q=i/8;C.beam(lib,[-57.5-q,42.3+q*4.8,zz-1.3],[-57.5-q,42.3+q*4.8,zz+1.3],.055,'woodLight');}
  }
  C.cyl(lib,-45,43.5,-23.1,.18,.26,2.5,'wood',12);C.sphere(lib,-45,45.05,-23.1,1.15,'glassBlue',20);C.torus(lib,-45,45.05,-23.1,1.28,.055,'gold',0,0,.35);
  chandelier(lib,-44,56.5,-41,2.4);banner(lib,-61,55,-44,3.2,5.8,PI/2);
  // EAST CHAPEL — a bright nave, choir, organ, sun-altar and delicate colonnades.
  floorGrid(chapel,44,-40.5,35,46,2.8);rug(chapel,44,-37.2,4.2,29,'carpet');
  for(let x of [32.5,55.5])for(let z of [-25,-36.5,-48])pole(chapel,x,42.1,z,16,.42);
  for(let z of [-26,-31.3,-36.6,-41.9,-47.2])for(let x of [37.4,50.6]){
    box(chapel,x,42.98,z,6.6,.26,1.1,'wood');box(chapel,x,43.55,z+.55,6.6,1.15,.16,'wood');
    for(let xx of [-2.7,2.7]){box(chapel,x+xx,42.55,z,.16,.9,1,'wood');box(chapel,x+xx,43.25,z, .2,.75,1.4,'woodLight');}
  }
  box(chapel,44,42.4,-55.7,17,.65,10.5,'stoneDark');box(chapel,44,42.9,-56.1,15,.4,8.8,'stoneLight');
  C.stairs(chapel,44,-50.7,42.1,43.15,7.5,3.3,'stoneLight');
  box(chapel,44,44.15,-56,7.6,1.75,2.6,'stoneLight');box(chapel,44,45.12,-56,8.2,.28,3.1,'gold');
  box(chapel,44,45.3,-55.7,5.9,.05,2,'trim');
  for(let x of [41,42,46,47])candle(chapel,x,45.35,-56,.85);
  C.torus(chapel,44,49.7,-59.4,2.5,.11,'gold');
  for(let k=0;k<12;k++){let a=k*PI/6;C.beam(chapel,[44+Math.cos(a)*2.8,49.7+Math.sin(a)*2.8,-59.4],[44+Math.cos(a)*3.45,49.7+Math.sin(a)*3.45,-59.4],.08,'gold',6);}
  C.cyl(chapel,44,46.2,-58.1,.2,.26,2.2,'gold',8);C.sphere(chapel,44,47.5,-58.1,.48,'crystal',12);
  for(let x of [35,53])candelabrum(chapel,x,43.2,-56.1,1.15);
  // Pipe organ sits at the entry end and faces the altar.
  box(chapel,44,43.1,-21.4,10.5,1.9,2.7,'wood');
  for(let i=0;i<15;i++){let xx=44+(i-7)*.56,h=4.5+3.6*(1-Math.abs(i-7)/7);C.cyl(chapel,xx,44.4+h/2,-21.6,.17,.17,h,'metal',10);C.cyl(chapel,xx,44.4+h,-21.6,.22,.22,.12,'gold',10);}
  box(chapel,44,44.3,-23.2,6.2,.25,1.2,'woodLight');for(let i=0;i<28;i++)box(chapel,41.3+i*.2,44.48,-23.4,.17,.06,.65,i%3===0?'metal':'trim');
  chandelier(chapel,44,57.5,-39,2.8);
  // REAR GALLERY — banqueting at the centre, a royal bedchamber and council room.
  floorGrid(gallery,0,-91,98,21,3);
  rug(gallery,0,-91,38,13,'burgundy');
  box(gallery,0,43.5,-91,29,.3,4.8,'woodLight');
  for(let x of [-12,-6,0,6,12]){box(gallery,x,42.75,-91,.55,1.4,3.4,'wood');
    for(let z of [-94.6,-87.4]){chair(gallery,x,42.1,z,z<-91?PI:0,true);C.cyl(gallery,x,43.706,z<-91?-92.2:-89.8,.47,.47,.045,'trim',16);goblet(gallery,x+.7,43.66,z<-91?-92.4:-89.6,.8);}}
  for(let x of [-9,0,9]){candelabrum(gallery,x,43.68,-91,.47);box(gallery,x+2,43.7,-91,1.2,.05,1.1,'trim');C.sphere(gallery,x+2,43.98,-91,.29,'booksRed',8);}
  for(let x of [-17.5,17.5])chair(gallery,x,42.1,-91,x<0?-PI/2:PI/2,true);
  // Open partitions show the rooms without concealing their contents from above.
  for(let x of [-25,25]){for(let z of [-97,-85])box(gallery,x,44.1,z,.55,4,8,'stoneLight');C.arch(gallery,x,42.1,-91,3.5,6.5,.6,'gold',PI/2,.3);}
  rug(gallery,-37,-91,17,15,'carpet');
  box(gallery,-37,42.7,-95,8.1,1.1,7.5,'wood');box(gallery,-37,43.42,-95,7.7,.4,7.1,'trim');box(gallery,-37,43.7,-94,7.7,.2,4.9,'burgundy');
  for(let x of [-40.4,-33.6])for(let z of [-98.2,-91.8]){C.cyl(gallery,x,45.3,z,.12,.18,6.4,'gold',10);C.sphere(gallery,x,48.6,z,.25,'gold',10);}
  for(let zz of [-98.5,-91.5])box(gallery,-37,48.4,zz,8.2,.2,.15,'gold');for(let xx of [-40.8,-33.2])box(gallery,xx,48.4,-95,.15,.2,7.2,'gold');
  pillow(gallery,-38.5,43.91,-97,2.3,.6,1.35,'linen');pillow(gallery,-35.5,43.91,-97,2.3,.6,1.35,'linen');
  for(let x of [-43.8,-30.2]){box(gallery,x,42.8,-96,2,1.4,2,'wood');candle(gallery,x,43.6,-96,.7);}
  studyTable(gallery,-37,42.1,-85.4,6.5,2);chair(gallery,-37,42.1,-87.2,PI);
  C.cyl(gallery,37,43.5,-91,5.4,5.4,.3,'woodLight',32);C.cyl(gallery,37,42.7,-91,1,1.5,1.4,'wood',12);
  C.cyl(gallery,37,43.7,-91,3.4,3.4,.035,'glassBlue',32);C.torus(gallery,37,43.74,-91,3.4,.035,'gold',PI/2);
  for(let k=0;k<8;k++){let a=k*PI/4,xx=37+Math.sin(a)*6.8,zz=-91+Math.cos(a)*6.8;chair(gallery,xx,42.1,zz,a,true);}
  for(let x of [-12,12,37])chandelier(gallery,x,56,-91,2.1);
  // UNDERCROFT — distinct, roofless crypt, treasury and time-vault components.
  const u=-20;
  box(crypt,0,u-.5,-32.5,124,1,105,'rockDark');
  box(crypt,0,u+.02,-33,20,.08,100,'stone');
  for(let x of [-61.5,61.5])box(crypt,x,u+3,-32.5,1,6,104,'stoneDark');
  box(crypt,0,u+3,-84.5,124,6,1,'stoneDark');
  box(crypt,-37,u+3,19.5,49,6,1,'stoneDark');box(crypt,37,u+3,19.5,49,6,1,'stoneDark');
  for(let x of [-13,13])for(let z of [-61,-42,-23,-4,15]){
    pole(crypt,x,u+.1,z,12,.75,'stoneDark');
    C.arch(crypt,x,u+5.3,z-9.4,17,10,1.1,'stone',PI/2,.75);
  }
  for(let z of [-62,-24,14])C.arch(crypt,0,u+3,z,25,14.5,1.5,'stoneDark',0,1);
  // Insets and course lines make underground masonry readable under raking light.
  for(let x of [-60.8,60.8])for(let z=-80;z<17;z+=6){box(crypt,x,u+2,z,.13,.11,5.7,'rock');box(crypt,x,u+4,z+3,.13,.11,5.7,'rock');}
  for(let z of [-67,-47,-27,-7])for(let x of [-9.8,9.8]){
    C.cyl(crypt,x,u+.9,z,.62,.78,1.7,'stoneDark',12);C.cone(crypt,x,u+2.2,z,.55,1.2,'emissive',10);
  }
  // West sepulchres: sarcophagi, carved side panels, upright markers.
  for(let x of [-47,-28])for(let z of [-54,-36,-18]){
    box(crypt,x,u+.3,z,8,.6,12,'stoneDark');box(crypt,x,u+1.3,z,6.2,1.4,9.5,'stone');
    box(crypt,x,u+2.16,z,6.8,.35,10.1,'trim');box(crypt,x,u+2.44,z,5.7,.22,8.8,'stoneLight');
    C.cyl(crypt,x,u+2.7,z-2.4,.75,.75,.35,'stoneDark',12);
    box(crypt,x,u+2.7,z+.5,1.6,.35,4.3,'stoneDark');
    for(let zz of [-2.8,0,2.8]){box(crypt,x-3.12,u+1.3,z+zz,.08,.85,1.8,'gold');box(crypt,x+3.12,u+1.3,z+zz,.08,.85,1.8,'gold');}
    C.pointed(crypt,x,u+.2,z-6.8,4.4,6,.4,'stoneDark');C.torus(crypt,x,u+3.6,z-6.52,.8,.07,'gold');
  }
  for(let z of [-62,-2])C.arch(crypt,-38,u,z,20,10,1.1,'stone',0,.9);
  // East treasury: iron bound timber chests and little heaps of geometrical coins.
  function chest(x,z){
    box(crypt,x,u+1,z,4.4,1.8,3.2,'wood');
    const lid=C.cyl(crypt,x,u+1.9,z,1.65,1.65,4.45,'woodLight',12);lid.rotation.z=PI/2;
    for(let xx of [-1.6,1.6]){box(crypt,x+xx,u+1.3,z, .2,2.2,3.45,'metal');C.torus(crypt,x+xx,u+1.9,z,1.68,.09,'metal',0,PI/2);}
    box(crypt,x,u+1.5,z+1.72,.5,.6,.12,'gold');
  }
  for(let x of [25,43])for(let z of [-50,-34,-18]){
    chest(x,z);for(let n=0;n<14;n++){let xx=x-3+C.rng()*6,zz=z+3+C.rng()*3;C.cyl(crypt,xx,u+.13+C.rng()*.3,zz,.16+C.rng()*.18,.22,.07,'gold',8);}
  }
  box(crypt,47,u+1.05,-65,12,2.1,8,'stone');box(crypt,47,u+2.2,-65,12.7,.2,8.7,'gold');
  for(let n=0;n<9;n++){let x=43+(n%3)*3,z=-67+Math.floor(n/3)*2;C.cyl(crypt,x,u+2.8,z,.4,.6,1,'gold',10);C.sphere(crypt,x,u+3.35,z,.45,'crystal',8);}
  // Visible barred cells and a small guard room near the undercroft entrance.
  for(let x of [-40,40]){
    box(crypt,x,u+.13,9.5,25,.2,17,'stone');
    for(let xx=x-12;xx<=x+12;xx+=1.5)C.cyl(crypt,xx,u+3.1,.5,.085,.085,6.2,'metal',6);
    box(crypt,x,u+5.8,.5,25,.14,.15,'metal');box(crypt,x,u+.5,.5,25,.14,.15,'metal');
    box(crypt,x,u+.7,12,8,.9,3,'wood');box(crypt,x,u+1.23,12,7.6,.12,2.8,'burgundy');
  }
  // Secret stair climbs from the entrance toward the raised service passage.
  const stair=C.group('Undercroft_Service_Stair',crypt);stair.position.set(-56,0,0);stair.rotation.y=PI;
  C.stairs(stair,0,-6,u,u+12,5.4,22,'stone');
  // The ancient portal is an original concentric ring, supported on an octagonal dais.
  const pz=-75;
  C.cyl(crypt,0,u+.5,pz,12,13,1,'stoneDark',8);C.cyl(crypt,0,u+1.2,pz,10.5,11.5,.5,'stone',8);
  C.stairs(crypt,0,-64,u,u+1.5,10,4,'stoneLight');
  C.torus(crypt,0,u+10,pz,7.2,.75,'stone',0,0,PI/8);
  C.torus(crypt,0,u+10,pz+.38,6.58,.19,'gold');C.torus(crypt,0,u+10,pz+.5,6.22,.11,'crystal');
  C.torus(crypt,0,u+10,pz+.55,5.92,.035,'emissive');
  for(let k=0;k<16;k++){
    let a=k*PI/8,x=Math.sin(a)*7.3,y=u+10+Math.cos(a)*7.3;
    const gem=C.cone(crypt,x,y,pz+.8,.33,1.1,'crystal',5);gem.rotation.z=-a;
    C.beam(crypt,[Math.sin(a)*5.4,u+10+Math.cos(a)*5.4,pz+.3],[Math.sin(a)*5.8,u+10+Math.cos(a)*5.8,pz+.3],.055,'emissive',6);
  }
  for(let x of [-10,10]){pole(crypt,x,u+1.45,pz,16,.8,'stoneDark');C.cone(crypt,x,u+18.5,pz,1.25,4,'crystal',6);}
  for(let k=0;k<3;k++)C.torus(crypt,0,u+10,pz+.2+k*.1,2+k*.9,.04,'glassBlue',0,0,k*.4);
  C.sphere(crypt,0,u+10,pz+.5,.7,'crystal',12);
  for(let x of [-54,55])for(let z of [-73,-7]){
    C.cyl(crypt,x,u+.45,z,2,2.4,.9,'rockDark',8);
    for(let j=0;j<4;j++){let a=j*PI/2,rr=1.1;const gem=C.cone(crypt,x+Math.cos(a)*rr,u+1.8+j*.45,z+Math.sin(a)*rr,.55,3+j*.5,'crystal',6);gem.rotation.z=(j-1.5)*.12;}
  }
  // SECOND PASS — visible craftsmanship concentrated where the camera can approach.
  // Open rib vaults carry the Gothic rhythm without hiding the cutaway floor plan.
  for(let zz of [-7,-29,-48])for(let side of [-1,1]){
    sweep(main,[[side*12.8,60.8,zz],[side*9.8,67.1,zz],[side*4.4,70.5,zz],[0,71.3,zz]],.18,'stoneWarm',18,4);
    sweep(main,[[side*12.8,61.1,zz-3.2],[side*8,67.3,zz-1.8],[0,71.3,zz]],.095,'gold',14,4);
  }
  sweep(main,[[0,71.3,-7],[0,71.7,-28],[0,71.3,-48]],.16,'stoneLight',18,4);
  for(let zz of [-7,-29,-48])C.sphere(main,0,71.15,zz,.38,'gold',8);
  // A narrow fretted canopy and gathered velvet frame the throne, with an open front.
  for(let side of [-1,1]){
    curtain(main,side*5.15,55.9,-62.6,3.4,8.2,side<0?PI/2:-PI/2);
    sweep(main,[[side*5.2,55.8,-64.3],[side*4.2,57.2,-63.2],[side*1.6,58.1,-62.8],[0,58.4,-63]],.12,'gold',14,5);
    C.beam(main,[side*5.15,51.2,-64.2],[side*5.15,51.2,-61.1],.065,'gold',6);
    pillow(main,side*.9,45.6,-60.8,.9,.44,.78,'burgundy');
  }
  for(let xx of [-3.9,-1.95,0,1.95,3.9])C.pointed(main,xx,55.5,-63.2,1.45,2.05,.12,'gold');
  rosette(main,0,55.9,-63.08,.52,'stainedTeal');
  for(let k=0;k<32;k++){
    const a=k*PI/16;box(main,Math.sin(a)*4.78,42.3,roseZ+Math.cos(a)*4.78,.18,.025,.18,k%2?'stoneCool':'stainedTeal',a+PI/4);
  }
  // Library craft: a reading lectern, bound map scrolls and an armillary sphere.
  const lectern=C.group('Carved_Library_Lectern',lib);lectern.position.set(-52.4,42.1,-23.6);lectern.rotation.y=-.25;
  C.cyl(lectern,0,.18,0,.85,1.2,.36,'wood',8);C.cyl(lectern,0,1.5,0,.22,.4,2.7,'wood',8);
  const top=C.group('Sloping_Reading_Desk',lectern);top.position.set(0,2.8,0);top.rotation.x=.2;
  box(top,0,0,0,2.8,.18,1.9,'woodLight');openBook(top,0,.14,0,1.85,1.25);box(top,0,.19,.92,2.8,.18,.13,'gold');
  scroll(lib,-50.2,43.7,-31.5,1.25,.15);scroll(lib,-40.6,43.7,-43.4,1.2,-.25);
  for(let a of [0,PI/3,-PI/3])ring(lib,-45,45.05,-23.1,1.35,.032,'gold',PI/2,a,.28);
  ring(lib,-45,45.05,-23.1,1.52,.045,'copper',0,PI/2,.35);
  for(let yy of [-.5,.5])ring(lib,-45,45.05+yy,-23.1,1.04,.026,'gold',PI/2);
  C.beam(lib,[-45.62,43.63,-23.1],[-44.38,46.47,-23.1],.05,'gold',6);
  for(let zz of [-41,-27]){
    for(let dz of [-1.3,1.3]){let wheel=C.cyl(lib,-57.32,42.3,zz+dz,.23,.23,.16,'metal',10);wheel.rotation.z=PI/2;}
    C.beam(lib,[-58.65,47.7,zz-2],[-58.65,47.7,zz+2],.07,'metal',8);
  }
  C.beam(lib,[-59.2,47.85,-52],[-59.2,47.85,-22],.075,'copper',8);
  for(let xx of [-55.5,-47.7,-39.9,-32.1])rosette(lib,xx,47.45,-58.33,.28,'gold');
  // Chapel tracery, linen altar fall and the mouths/feet of all organ pipes.
  for(let xx of [41.3,44,46.7]){
    C.pointed(chapel,xx,43.5,-54.62,1.7,1.3,.07,'stainedTeal');
    C.arch(chapel,xx,43.5,-54.54,1.9,1.45,.1,'gold',0,.1);
  }
  curtain(chapel,44,45.32,-54.35,2.7,1.3,0,'linen');
  for(let xx of [39.2,48.8]){
    C.pointed(chapel,xx,46,-59.22,2,5.1,.15,'stoneWarm');
    C.pointed(chapel,xx,46.3,-59.08,1.55,4.55,.08,'stainedTeal');
    C.beam(chapel,[xx,46.4,-58.98],[xx,50.4,-58.98],.045,'gold',6);
    ring(chapel,xx,49.3,-58.94,.48,.045,'gold');
  }
  for(let i=0;i<15;i++){
    let xx=44+(i-7)*.56;box(chapel,xx,45.3,-21.795,.16,.28,.025,'roofDark');
    C.cyl(chapel,xx,44.65,-21.6,.195,.195,.16,'copper',10);
  }
  for(let xx of [38.6,49.4]){box(chapel,xx,47.1,-21.4,.38,9.8,2.8,'wood');C.pointed(chapel,xx,51.8,-21.4,.75,1.6,.45,'gold');}
  for(let xx of [34.2,53.8])for(let zz of [-26,-47.2])rosette(chapel,xx,43.75,zz+.67,.27,'woodLight');
  // Banquet: proper hollow goblets, metal cutlery, folded linen and food platters.
  clothSurface(gallery,0,43.7,-91,28.5,1.15,.04,'linen');
  for(let xx of [-12,-6,0,6,12])for(let side of [-1,1]){
    const zz=-91+side*1.2;
    C.cyl(gallery,xx,43.675,zz,.62,.62,.045,'gold',16);
    box(gallery,xx-.84,43.69,zz,.055,.045,.7,'metal');box(gallery,xx-.84,43.72,zz-side*.25,.12,.025,.23,'metal');
    box(gallery,xx+.85,43.69,zz,.045,.045,.62,'metal');
    pillow(gallery,xx+.85,43.72,zz-side*.29,.18,.055,.23,'metal');
    box(gallery,xx-1.15,43.68,zz,.5,.035,.5,'linen',PI/4);
  }
  for(let xx of [-6,6]){
    let plate=C.cyl(gallery,xx,43.76,-91,1.55,1.55,.13,'stoneLight',20);plate.scale.z=.63;
    for(let k=0;k<3;k++){pillow(gallery,xx+(k-1)*.7,44.05,-91,.78,.5,.6,'woodLight',.2*k);C.beam(gallery,[xx+(k-1)*.7-.18,44.29,-91.18],[xx+(k-1)*.7+.18,44.29,-90.82],.018,'parchment',4);}
  }
  C.cyl(gallery,0,43.78,-91,1.4,1.05,.18,'gold',16);
  for(let k=0;k<6;k++){let a=k*PI/3;C.sphere(gallery,Math.sin(a)*.75,44.07,-91+Math.cos(a)*.75,.26,k%2?'stainedRuby':'flowerIvory',8);}
  // The bed has a visible folded counterpane and open canopy rails instead of a solid lid.
  clothSurface(gallery,-37,43.88,-94,7.6,4.8,.095,'burgundy');
  for(let side of [-1,1]){
    curtain(gallery,-37+side*3.8,43.88,-94,4.8,.8,side<0?PI/2:-PI/2);
    curtain(gallery,-37+side*3.8,48.32,-95,7.1,.66,side<0?PI/2:-PI/2);
  }
  for(let xx of [-40.4,-33.6])for(let zz of [-98.2,-91.8]){
    sweep(gallery,[[xx+.12,44.1,zz],[xx-.1,45.1,zz+.1],[xx+.1,46.1,zz-.1],[xx,47.7,zz]],.028,'gold',12,4);
  }
  box(gallery,-37,44.65,-98.6,7.2,2.1,.22,'wood');rosette(gallery,-37,44.8,-98.43,.6,'gold');
  // Crypt carving: chisel marks, coffin inscriptions and engraved treasure fittings.
  for(let xx of [-47,-28])for(let zz of [-54,-36,-18]){
    for(let side of [-1,1]){
      C.beam(crypt,[xx+side*2.3,u+2.59,zz-3.7],[xx+side*2.3,u+2.59,zz+3.7],.035,'agedStone',4);
      for(let j=0;j<4;j++){let zc=zz-2.7+j*1.8;C.beam(crypt,[xx+side*1.85,u+2.59,zc-.3],[xx+side*2.3,u+2.59,zc],.03,'agedStone',4);C.beam(crypt,[xx+side*2.3,u+2.59,zc],[xx+side*1.85,u+2.59,zc+.3],.03,'agedStone',4);}
    }
    C.beam(crypt,[xx-1.8,u+2.59,zz+3.6],[xx+1.8,u+2.59,zz+3.6],.035,'gold',4);
  }
  for(let xx of [25,43])for(let zz of [-50,-34,-18]){
    for(let side of [-1,1])for(let yy of [.6,1.4,2.25])C.sphere(crypt,xx+side*1.6,u+yy,zz+1.79,.095,'gold',6);
    ring(crypt,xx,u+1.5,zz+1.82,.16,.035,'gold');
    C.mesh(crypt,new T.OctahedronGeometry(.27,0),'stainedRuby',xx,u+1.5,zz+1.9);
  }
  for(let n=0;n<9;n++)C.mesh(crypt,new T.OctahedronGeometry(.24,0),n%2?'stainedRuby':'stainedTeal',43+(n%3)*3,u+3.66,-67+Math.floor(n/3)*2);
  for(let xx of [-13,13])for(let zz of [-54,-35,-16]){
    let side=xx>0?-1:1;
    C.pointed(crypt,xx+side*.85,u+4.8,zz,.65,1.25,.12,'metal',side*PI/2);
    C.beam(crypt,[xx+side*.9,u+5,zz],[xx+side*1.6,u+5.4,zz],.08,'metal',6);
    C.cone(crypt,xx+side*1.6,u+5.75,zz,.3,.85,'emissive',8);
    C.cyl(crypt,xx+side*1.6,u+5.25,zz,.32,.18,.35,'copper',8);
  }
  // Individually carved keystones give the ancient portal a constructed stone ring.
  for(let k=0;k<16;k++){
    let a=k*PI/8;const st=C.group('Portal_Carved_Rune_Stone',crypt);st.position.set(Math.sin(a)*7.25,u+10+Math.cos(a)*7.25,pz+.72);st.rotation.z=-a;
    box(st,0,0,0,1.14,1.2,.3,k%3?'agedStone':'stoneCool');
    C.beam(st,[-.3,-.35,.18],[.3,.35,.18],.032,'crystal',4);
    C.beam(st,[-.3,.25,.18],[.3,.25,.18],.032,'crystal',4);
    if(k%2)C.beam(st,[.1,-.35,.18],[.1,.2,.18],.032,'crystal',4);
  }
  // Model metadata is useful to DCC importers and scene inspection.
  main.userData={room:'Throne hall',floorY:42,area:'33 × 76 m suggested scale'};
  lib.userData={room:'Royal library',floorY:42,levels:2};
  chapel.userData={room:'Sun chapel',floorY:42};
  gallery.userData={room:'Banquet / council / royal chamber',floorY:42};
  crypt.userData={room:'Crypt / treasury / ancient portal',floorY:-20,display:'isolated cutaway, no navigation physics'};
}

/* AUTHORED SOURCE: expansion_environment.js — preserved V3 model geometry. */
/* V3 — authored annular outer city. Original island, wet moat and palace reserve remain open. */
function buildExpansionEnvironment(C){
  const T=C.THREE,G=C.groups,PI=Math.PI,TAU=2*PI,start=C.primitiveCount;
  const land=C.group('V3_Annular_Outer_Island',G.terrain),sea=C.group('V3_Expanded_Moat_Outer_Surface',G.water);
  const wall=C.group('V3_Great_Outer_Curtain',G.fortifications),town=C.group('V3_Artisan_City_and_South_Wards',G.town);
  const military=C.group('V3_Eastern_Military_District',G.town),gardens=C.group('V3_Northern_Palace_Gardens',G.garden);
  const stats={wallTowers:0,gateTowers:0,houses:0,civicBuildings:0,militaryBuildings:0,tents:0,orchardTrees:0};
  function planeRing(rx,rz,cz,irx,irz,icz){const s=new T.Shape();s.absellipse(0,-cz,rx,rz,0,TAU,false);const hole=new T.Path();hole.absellipse(0,-icz,irx,irz,0,TAU,true);s.holes.push(hole);return s;}
  function line(g,a,b,y,w,h,mat){const dx=b[0]-a[0],dz=b[1]-a[1];return C.box(g,(a[0]+b[0])/2,y,(a[1]+b[1])/2,w,h,Math.hypot(dx,dz),mat,Math.atan2(dx,dz));}
  function flatDisc(g,x,y,z,r,mat){return C.cyl(g,x,y,z,r,r,.18,mat,20);}
  function lightWindow(g,x,y,z,w,h,ry=0){const q=C.group('V3_Light_Window',g);q.position.set(x,y,z);q.rotation.y=ry;C.box(q,0,h/2,0,w+.38,h+.38,.22,'trim');C.box(q,0,h/2,.14,w,h,.10,'glass');C.box(q,0,h/2,.22,.08,h,.10,'woodLight');return q;}
  function coneTree(g,x,y,z,s=1){C.cyl(g,x,y+1.7*s,z,.25*s,.4*s,3.4*s,'bark',6);C.cone(g,x,y+4.1*s,z,2*s,6.8*s,'leaf',7);C.cone(g,x,y+6.9*s,z,1.5*s,4.2*s,'leafLight',7);}
  function roundTree(g,x,y,z,s=1,fruit=false){C.cyl(g,x,y+2.2*s,z,.3*s,.6*s,4.4*s,'bark',7);const q=C.mesh(g,new T.IcosahedronGeometry(2.8*s,0),'leaf',x,y+5*s,z);q.scale.set(1,1.12,1);if(fruit){for(let i=0;i<3;i++){const a=i*TAU/3;C.sphere(g,x+Math.sin(a)*2*s,y+4.5*s,z+Math.cos(a)*2*s,.27*s,'booksGold',6);}}}
  // The extrusion has a real elliptical hole, rather than a full disk hiding the old moat.
  const islandShape=planeRing(450,490,-20,260,300,0);
  const islandGeo=new T.ExtrudeGeometry(islandShape,{depth:27.9,bevelEnabled:false,curveSegments:48});islandGeo.rotateX(-PI/2);
  C.mesh(land,islandGeo,'rock',0,-20,0);
  const topGeo=new T.ShapeGeometry(islandShape,72);topGeo.rotateX(-PI/2);C.mesh(land,topGeo,'grass',0,7.94,0);
  // Exclude the old water disk (rx310,rz330,z4), avoiding coplanar overlapping water.
  const waterGeo=new T.ShapeGeometry(planeRing(570,620,-35,310,330,4),96);waterGeo.rotateX(-PI/2);C.mesh(sea,waterGeo,'water',0,-8.95,0);
  // Geological teeth along the outer shore; deliberately low polygon, broad visible forms.
  for(let i=0;i<44;i++){
    const a=(i+.4)*TAU/44;if(Math.abs(Math.sin(a))<.075&&Math.cos(a)>.8)continue;
    const x=Math.sin(a)*454,z=-20+Math.cos(a)*494;
    const rock=C.mesh(land,new T.IcosahedronGeometry(1,0),i%3?'rock':'rockDark',x,-3.7+(i%3)*1.9,z,a);
    rock.scale.set(8+(i%4)*2,4.7+(i%3),5.3);rock.rotation.z=(i%3-1)*.12;
  }
  // Inner cliff promenade. Northern palace reservation and the south bridge mouth stay clear.
  const promenadePoints=[];
  for(let i=0;i<=48;i++){const a=i*TAU/48;promenadePoints.push([Math.sin(a)*272,Math.cos(a)*312]);}
  for(let i=0;i<48;i++){
    const a=promenadePoints[i],b=promenadePoints[i+1],mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
    if(Math.abs(mx)<169&&mz<-105)continue;
    line(town,a,b,8.08,9,.2,'path');
    if(Math.abs(mx)<24&&mz>290)continue;
    const ai=i*TAU/48,bi=(i+1)*TAU/48,aa=[Math.sin(ai)*261.5,Math.cos(ai)*301.5],bb=[Math.sin(bi)*261.5,Math.cos(bi)*301.5];
    line(wall,aa,bb,8.8,1.1,1.8,'stone');line(wall,aa,bb,9.85,1.5,.3,'trim');
    for(const p of [aa,bb])C.box(wall,p[0],10.05,p[1],1.7,2.7,1.7,'stoneLight');
  }
  // Processional road directly connects the old bridge ending z325 to the new gate.
  C.box(town,0,8.14,390,29,.22,162,'path');
  for(const x of [-13.5,13.5])C.box(town,x,8.3,390,.45,.10,162,'stoneLight');
  for(let z=316;z<=452;z+=11)C.box(town,0,8.3,z,26,.08,.24,'stoneDark');
  C.box(town,0,8.18,323,37,.24,18,'stoneLight');
  // Side gate avenues meet the inhabited district streets, stopping at the scenic moat walk.
  for(const side of [-1,1]){
    C.box(town,side*349,8.12,-20,174,.2,20,'path');
    for(const z of [-29,-11])C.box(town,side*349,8.28,z,174,.08,.35,'stoneLight');
  }
  function curtain(a,b){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=dz/len,nz=-dx/len,ry=Math.atan2(dx,dz);
    line(wall,a,b,15.5,5,15,'stone');line(wall,a,b,8.7,6.4,1.4,'stoneDark');line(wall,a,b,22.9,6.6,.8,'trim');
    for(const side of [-1,1]){
      const aa=[a[0]+nx*2.7*side,a[1]+nz*2.7*side],bb=[b[0]+nx*2.7*side,b[1]+nz*2.7*side];
      line(wall,aa,bb,24,1.1,1.7,'stone');
      const n=Math.ceil(len/7.9);for(let j=0;j<n;j++){const t=(j+.45)/n;C.box(wall,aa[0]+dx*t,25.4,aa[1]+dz*t,1.4,2.3,3.3,'stoneLight',ry);}
    }
    for(let t=.22;t<.94;t+=.28){C.box(wall,a[0]+dx*t-nx*3.4,14.5,a[1]+dz*t-nz*3.4,1.8,13,3.4,'stoneDark',ry);}
  }
  function tower(g,x,z,base=8,r=7.3,h=25,roof=true,flag=false){
    C.cyl(g,x,base+1,z,r+1.4,r+1.7,2,'stoneDark',10);
    C.cyl(g,x,base+h/2,z,r,r+.7,h,'stone',10);
    C.cyl(g,x,base+h*.43,z,r+.45,r+.45,.65,'trim',10);
    C.cyl(g,x,base+h-.5,z,r+1,r+1,1.1,'stoneLight',10);
    for(let j=0;j<4;j++){const a=j*PI/2;lightWindow(g,x+Math.sin(a)*(r+.15),base+11,z+Math.cos(a)*(r+.15),1.5,4.8,a);}
    if(roof){C.cone(g,x,base+h+r*1.13,z,r+1.7,r*2.26,'roof',10);C.cyl(g,x,base+h+.5,z,r+1.75,r+1.75,.4,'copper',10);C.cone(g,x,base+h+r*2.26+1.1,z,.48,3,'gold',6);}
    else{C.cyl(g,x,base+h+.3,z,r+1.4,r+1.4,.6,'trim',10);for(let j=0;j<10;j++){const a=j*TAU/10;C.box(g,x+Math.sin(a)*(r+.45),base+h+1.9,z+Math.cos(a)*(r+.45),2.8,2.6,1.7,'stoneLight',a);}}
    if(flag)C.flag(g,x,base+h+(roof?r*2.26+1.7:1),z,1.1,.2);
  }
  // Three precisely delimited openings, never closed by a curtain-wall segment.
  const intervals=[[2.5,87.8],[92.2,267.8],[272.2,357.5]],wallNodes=[];
  for(const [d0,d1] of intervals){
    const n=Math.ceil((d1-d0)/12),pts=[];
    for(let i=0;i<=n;i++){const a=(d0+(d1-d0)*i/n)*PI/180;pts.push([Math.sin(a)*433,-20+Math.cos(a)*473]);}
    for(let i=0;i<n;i++)curtain(pts[i],pts[i+1]);
    for(let i=1;i<n;i++){const [x,z]=pts[i];tower(wall,x,z,8,i%3===0?8.2:7.1,i%3===0?27:23,i%3!==0,i%4===0);stats.wallTowers++;wallNodes.push([x,z]);}
  }
  function gateway(name,cx,cz,ry,width,major=false){
    const q=C.group(name,wall);q.position.set(cx,0,cz);q.rotation.y=ry;
    const rr=major?10.2:8.2,tx=width/2+rr+2,hh=major?32:25;
    for(const s of [-1,1]){tower(q,s*tx,0,8,rr,hh,true,true);stats.gateTowers++;}
    C.arch(q,0,8,0,width+4,major?23:18,10,'stoneLight',0,1.7);
    C.box(q,0,major?33.3:28.6,0,width+7,major?5.2:4,9.5,'stone');
    C.box(q,0,major?36.3:31,0,width+8,.8,10.6,'trim');
    C.roof(q,0,major?36.7:31.4,0,width+10,12,major?10:7,'roof');
    for(const xx of [-width*.28,width*.28])lightWindow(q,xx,major?31.5:26.8,5.1,2.3,3.3);
    // Raised portcullis ends many metres above the entrance floor.
    const y=major?27:23;for(let x=-width/2+1.5;x<=width/2-1.5;x+=2.5)C.box(q,x,y,-4.8,.24,5,.3,'metal');
    C.box(q,0,y+1.2,-4.8,width-2,.25,.4,'metal');
    for(const s of [-1,1])C.flag(q,s*(width/2+1),major?30:25,6.3,1.3,s*.5);
    return q;
  }
  gateway('V3_Grand_South_Gate',0,452.6,0,29,true);
  gateway('V3_East_Gate',432.7,-20,PI/2,24,false);
  gateway('V3_West_Gate',-432.7,-20,-PI/2,24,false);
  // Arrival spans point away from the castle; decks remain open through all three gates.
  function approachBridge(name,cx,cz,ry,len){
    const q=C.group(name,wall);q.position.set(cx,0,cz);q.rotation.y=ry;
    C.box(q,0,7.5,len/2,23,1,len,'path');
    const n=Math.floor(len/24);for(let i=0;i<n;i++){
      const z=(i+.5)*len/n;C.arch(q,0,-10,z,len/n-2,17,21,'stone',PI/2,2.1);
    }
    for(let i=0;i<=n;i++)C.box(q,0,-1.7,i*len/n,22,18.2,4.5,'stoneDark');
    for(const s of [-1,1]){
      C.box(q,s*11,9.6,len/2,1.3,3.2,len,'stone');C.box(q,s*11,11.3,len/2,1.8,.35,len,'trim');
      for(let z=4;z<len;z+=12)C.box(q,s*11,11.8,z,2.1,2.2,2.6,'stoneLight');
    }
    C.box(q,0,7.5,len+7,32,1,16,'stoneDark');C.box(q,0,8.08,len+7,30,.16,16,'path');
  }
  approachBridge('V3_South_Arrival_Bridge',0,469,0,90);
  approachBridge('V3_East_Arrival_Bridge',450,-20,PI/2,90);
  approachBridge('V3_West_Arrival_Bridge',-450,-20,-PI/2,90);
  // Distant town architecture is lighter than the detailed old castle, with readable roof rhythm.
  function house(g,name,x,z,w,d,h,ry=0,kind=0){
    const q=C.group(name,g);q.position.set(x,8,z);q.rotation.y=ry;
    C.box(q,0,h/2,0,w,h,d,kind===2?'stone':'stoneLight');
    C.box(q,0,1,0,w+1,2,d+1,'stoneDark');C.box(q,0,h-.5,0,w+.4,.6,d+.4,'wood');
    if(kind!==2){C.box(q,0,h*.48,0,w+.3,.5,d+.3,'wood');for(const s of [-1,1])C.box(q,s*(w/2-.2),h/2,d/2+.1,.5,h,.4,'wood');}
    C.roof(q,0,h,0,w+2,d+2,w*.55,kind===1?'roofDark':'roof');
    for(const sx of [-1,1])lightWindow(q,sx*w*.27,h*.55,d/2+.25,2.1,3.4);
    lightWindow(q,w/2+.25,h*.55,0,2.1,3.4,PI/2);
    C.pointed(q,0,.05,d/2+.2,2.8,4.5,.2,'wood');
    C.box(q,w*.26,h+2.8,-d*.26,1.8,6,2.1,'stoneDark');C.box(q,w*.26,h+5.9,-d*.26,2.4,.5,2.7,'trim');
    q.userData.expansionBuilding=true;
    return q;
  }
  // Western artisan blocks: consistent setbacks leave alleys between every block.
  for(let row=0;row<7;row++)for(let col=0;col<3;col++){
    let z=[-190,-140,-90,45,95,145,195][row],x=[-394,-353,-312][col];
    if(col===2&&(row===4||row===5))continue;
    // Space around the eleven preserved houses relocated by the root integration.
    const moves={'0,0':[-237,-235],'0,1':[-278,-200],'1,1':[-285,-123],'1,2':[-286,-162],'2,1':[-408,-93],'2,2':[-283,-63],'5,0':[-388,145],'6,0':[-276,227]};
    if(moves[row+','+col])[x,z]=moves[row+','+col];
    house(town,'V3_Artisan_House_'+row+'_'+col,x,z,15+(row%2)*2,22+(col%2)*4,15+(row%3)*2,0,(row+col)%2);stats.houses++;
  }
  for(const [x,z] of [[-230,-303],[-231,-342],[-274,-331],[-340,-280],[-220,-365]]){house(town,'V3_Northwest_Craftsman',x,z,17,22,17,PI/2,0);stats.houses++;}
  C.box(town,-372,8.08,110,12,.16,200,'path');C.box(town,-332,8.08,112,10,.16,205,'path');
  for(const z of [70,120,170])C.box(town,-351,8.09,z,113,.16,9,'path');
  // A distinct guild hall and compact bell tower mark the civic district.
  const guild=house(town,'V3_Artisans_Guild_Hall',-266,-278,44,33,24,PI/2,2);stats.civicBuildings++;
  C.box(guild,0,1.3,18.8,38,2.6,5.5,'stoneLight');
  for(const x of [-14,-7,0,7,14])C.arch(guild,x,0,17.2,5.6,8.5,1.5,'trim',0,.7);
  tower(town,-298,-280,8,6.3,37,true,true);
  // West market square: clear central axis with stalls around its perimeter.
  C.box(town,-307,8.16,128,66,.22,69,'path');
  flatDisc(town,-307,8.35,128,8,'stoneDark');C.cyl(town,-307,9.4,128,4.7,5.2,2,'stone',16);C.cyl(town,-307,10.45,128,4.25,4.25,.08,'water',20);
  for(const [x,z] of [[-331,105],[-331,128],[-331,151],[-283,105],[-283,128],[-283,151],[-307,103],[-307,154]]){
    for(const s of [-1,1])C.box(town,x+s*4,11,z,.28,6,.28,'wood');
    C.roof(town,x,13.6,z,10.5,8,2.1,z%2?'burgundy':'linen');C.box(town,x,9.7,z,8.2,2.7,3.4,'woodLight');
    for(let i=0;i<3;i++)C.cyl(town,x-2.5+i*2.5,11.35,z,.8,.6,.5,i%2?'clay':'wood',8);
  }
  // South residential terraces keep an uninterrupted 29 m-wide ceremonial approach.
  for(const side of [-1,1])for(const [x,z,w,d] of [[77,399,19,25],[126,385,19,26],[177,355,21,27],[219,310,20,27],[90,348,18,24],[150,320,19,25]]){
    house(town,'V3_South_Residential_Ward',side*x,z,w,d,17+(x%3),side*.12,0);stats.houses++;
  }
  for(const side of [-1,1]){
    C.box(town,side*82,8.15,437,57,.2,24,'path');
    for(const x of [side*55,side*109])coneTree(town,x,8.2,439,1.3);
    C.box(town,side*82,9.4,438,12,2.5,3,'stoneLight');
    for(let z of [343,373,413]){coneTree(town,side*25,8.1,z,1.3);C.box(town,side*25,8.8,z,5.5,1.2,5.5,'stone');}
  }
  // Eastern garrison: long roofs, drill court and a separate supply/tent quarter.
  for(const [x,z] of [[308,-298],[374,-104],[374,75],[374,145]]){house(military,'V3_Garrison_Barracks',x,z,25,42,18,0,2);stats.militaryBuildings++;}
  for(const [x,z,w,d,h] of [[310,-163,26,40,15],[310,105,25,37,16],[310,172,27,42,12],[374,24,25,31,15]]){house(military,'V3_Armory_Stable_or_Quartermaster',x,z,w,d,h,0,2);stats.militaryBuildings++;}
  C.box(military,258,8.13,-205,60,.22,55,'soil');
  for(const x of [229,287])C.box(military,x,8.4,-205,.6,.5,55,'stoneLight');
  for(const z of [-232,-178])C.box(military,258,8.4,z,58,.5,.6,'stoneLight');
  C.box(military,357,8.08,15,6,.16,360,'path');
  for(let i=0;i<7;i++){
    const x=235+i*7.5;C.box(military,x,10.8,-228,.35,5.6,.35,'wood');
    const target=C.cyl(military,x,12.3,-228,1.8,1.8,.35,'linen',12);target.rotation.x=PI/2;
    const bull=C.cyl(military,x,12.3,-227.78,.58,.58,.05,'burgundy',10);bull.rotation.x=PI/2;
  }
  for(const x of [240,257,274])for(const z of [-211,-195]){
    C.cyl(military,x,9.9,z,.18,.26,3.8,'wood',6);C.beam(military,[x-1.5,11,z],[x+1.5,11,z],.18,'wood',6);C.sphere(military,x,12.1,z,.58,'linen',7);
  }
  for(const x of [235,250,265,280])C.person(military,x,8.2,-181,1.15,PI);
  // Timber siege machines use historically appropriate silhouettes, no modern weaponry.
  function trebuchet(x,z){
    const q=C.group('V3_Timber_Trebuchet',military);q.position.set(x,8,z);
    C.box(q,0,1,0,7,1.1,11,'wood');
    for(const sx of [-1,1]){
      for(const zz of [-4.1,4.1]){const wh=C.cyl(q,sx*4,.9,zz,1.15,1.15,.55,'wood',10);wh.rotation.z=PI/2;}
      C.beam(q,[sx*3,.5,-3.5],[sx*2,9,0],.32,'wood',6);C.beam(q,[sx*3,.5,3.5],[sx*2,9,0],.32,'wood',6);
    }
    C.beam(q,[-2.4,9,0],[2.4,9,0],.42,'woodLight',8);
    C.beam(q,[0,6,-4],[0,16,10],.42,'woodLight',6);
    C.box(q,0,5.2,-4.6,4.5,3.6,3.5,'stoneDark');
    C.beam(q,[0,16,10],[0,11.5,14],.055,'bark',4);C.beam(q,[0,11.5,14],[0,11.2,16],.055,'bark',4);
    C.box(q,0,11.2,15,1.6,.25,2.6,'leather');
  }
  C.box(military,311,8.12,36,89,.2,64,'soil');for(const x of [282,312,341])trebuchet(x,27);
  for(const rawX of [285,315,345])for(const z of [220,253]){
    const x=rawX===345&&z===253?333:rawX;
    C.roof(military,x,8,z,14,18,7.4,'linen');C.pointed(military,x,8.1,z+9.1,3.1,5,.1,'wood');stats.tents++;
    C.beam(military,[x-9,8,z],[x-7,12,z],.035,'bark',4);C.beam(military,[x+9,8,z],[x+7,12,z],.035,'bark',4);
  }
  // Formal northern gardens remain outside the palace-reserved rectangle (z < -340).
  C.box(gardens,0,8.12,-450,190,.2,60,'path');
  // Paths split around the three preserved garden cottages at z-395.
  for(const side of [-1,1]){
    line(gardens,[0,-354],[side*24,-368],8.24,8,.12,'stoneLight');
    C.box(gardens,side*24,8.24,-395,8,.12,60,'stoneLight');
    line(gardens,[side*24,-425],[0,-430],8.24,8,.12,'stoneLight');
  }
  C.box(gardens,0,8.24,-450,10,.12,60,'stoneLight');C.box(gardens,0,8.24,-450,190,.12,8,'stoneLight');
  for(const side of [-1,1])for(const z of [-446]){
    const x=side*58;C.box(gardens,x,8.3,z,66,.25,37,'grassLight');
    for(const dx of [-31,31])C.box(gardens,x+dx,9.1,z,1.8,1.5,36,'hedge');
    for(const dz of [-17,17])C.box(gardens,x,9.1,z+dz,62,1.5,1.8,'hedge');
    C.cyl(gardens,x,9.2,z,9,9,1,'hedge',16);
    for(const dx of [-21,21])for(const dz of [-8,8]){C.sphere(gardens,x+dx,9.3,z+dz,3,'leaf',7);C.sphere(gardens,x+dx,10.35,z+dz,1.3,'flowerIvory',7);}
  }
  C.cyl(gardens,0,8.7,-450,15,16,1,'stoneDark',32);C.cyl(gardens,0,9.65,-450,13.6,14,1.1,'trim',32);C.cyl(gardens,0,10.25,-450,12.7,12.7,.08,'water',32);
  C.cyl(gardens,0,12.8,-450,1.8,2.5,6,'stoneLight',12);C.cyl(gardens,0,15.7,-450,5.5,1.7,.9,'trim',24);C.cyl(gardens,0,16.2,-450,5,5,.08,'water',24);C.sphere(gardens,0,18,-450,1.3,'gold',10);
  for(let j=0;j<8;j++){const a=j*PI/4,curve=new T.QuadraticBezierCurve3(new T.Vector3(0,16.3,-450),new T.Vector3(Math.sin(a)*7.2,20,-450+Math.cos(a)*7.2),new T.Vector3(Math.sin(a)*11.5,10.4,-450+Math.cos(a)*11.5));C.mesh(gardens,new T.TubeGeometry(curve,12,.13,4,false),'foam');}
  for(const side of [-1,1]){
    for(const x of [180,210,240])for(const z of [-347,-378,-408]){
      roundTree(gardens,side*x,8,z,1.2,true);stats.orchardTrees++;
    }
    for(const z of [-359,-409,-459])coneTree(gardens,side*126,8,z,1.25);
    C.box(gardens,side*187,8.13,-424,90,.2,8,'path');
    for(const z of [-425,-473]){C.box(gardens,side*22,9.2,z,4,.7,13,'stoneLight');C.box(gardens,side*23.8,10.3,z,.6,1.9,13,'stoneWarm');}
    // Open garden pavilion, rather than another enclosed keep copy.
    const p=C.group('V3_North_Garden_Pavilion',gardens);p.position.set(side*146,8,-445);
    C.cyl(p,0,.5,0,10.5,11,1,'stone',8);
    for(let j=0;j<8;j++){const a=j*PI/4;C.cyl(p,Math.sin(a)*8,6,Math.cos(a)*8,.45,.6,11,'stoneLight',8);}
    C.cone(p,0,15,0,11.5,7.5,'roof',8);C.cone(p,0,19.5,0,.4,2.3,'gold',6);
    stats.civicBuildings++;
  }
  // Sparse district trees soften street corners, without scattering into road clearances.
  for(const side of [-1,1])for(const [x,z] of [[254,264],[290,282],[351,179],[403,29],[390,-58],[352,-211],[190,-318]])coneTree(town,side*x,8.1,z,1.2);
  C.expansionEnvironmentStats={
    version:3,landOuter:{rx:450,rz:490,center:[0,-20],top:7.94},wetInnerMoat:{rx:260,rz:300,center:[0,0]},waterBounds:{width:1140,depth:1240,centerZ:-35},
    ...stats,buildingCount:stats.houses+stats.civicBuildings+stats.militaryBuildings+stats.tents,
    permanentBuildingCount:stats.houses+stats.civicBuildings+stats.militaryBuildings,civicBellTowers:1,newTowerCount:stats.wallTowers+stats.gateTowers+1,newGateCount:3,
    newLandSize:[900,980],innerMoatHoleSize:[520,600],
    gates:[{id:'south',center:[0,8,452.6],clearWidth:29},{id:'east',center:[432.7,8,-20],clearWidth:24},{id:'west',center:[-432.7,8,-20],clearWidth:24}],
    districts:[
      {id:'artisan',name:'서부 장인 거리와 시장',center:[-333,15,64],eye:[-635,230,300]},
      {id:'garrison',name:'동부 군영과 공성 훈련장',center:[322,25,-35],eye:[670,285,330]},
      {id:'northGarden',name:'북부 대정원과 과수원',center:[0,18,-430],eye:[-410,310,-745]},
      {id:'southArrival',name:'신도시 남문과 대로',center:[0,25,389],eye:[220,159,680]}
    ],
    mainApproach:{clearWidth:29,from:[0,8,452.6],to:[0,8,325]},palaceReservation:{minX:-160,maxX:160,minZ:-340,maxZ:-106},
    preservedHouseClearanceCenters:[[-320,-70],[320,-70],[-340,-118],[340,-118],[-370,-175],[370,-175],[-315,-230],[315,-230],[-40,-395],[0,-395],[40,-395]],
    addedPrimitives:C.primitiveCount-start
  };
  C.expansionEnvironment=C.expansionEnvironmentStats;
}

/* AUTHORED SOURCE: expansion_palace.js — preserved V3 model geometry. */
/* V3 grand palace shell. Interior slabs, partitions and courtyard paving belong
 * to expansion_interiors.js. Every ground portal below is an actual arch void. */
function buildExpansionPalace(C){
  const {THREE:T,groups:G}=C,P=G.palace,R=G.roofs,F=G.terrain,D=G.details;
  const b=C.box,cy=C.cyl,co=C.cone,sp=C.sphere,be=C.beam,PI=Math.PI;
  const shell=C.group('V3_Grand_Courtyard_Palace_Shell',P),roofs=C.group('V3_Grand_Palace_Roofscape',R),base=C.group('V3_Hollow_Palace_Foundation',F);
  const detail=C.group('V3_Grand_Palace_Terraces',D),windowCache=new Map();
  const portals=[],facades=[];
  function worldUV(geo,y0=0){const p=geo.attributes.position,n=geo.attributes.normal,u=geo.attributes.uv;for(let i=0;i<p.count;i++){const a=Math.abs(n.getZ(i));u.setXY(i,(a>.5?p.getX(i):p.getZ(i))/5,(p.getY(i)+y0)/5);}return geo;}
  // A light repeated window kit keeps the vastly larger facade affordable.
  // Focal openings below retain the full fine window kit from core.js.
  function lancet(parent,x,y,z,w,h,ry=0,tint='glassBlue'){
    const g=C.group('V3_Slim_Stone_Lancet',parent);g.position.set(x,y,z);g.rotation.y=ry;
    const key=w+','+h;let geo=windowCache.get(key);
    if(!geo){
      const ow=w+.8,oh=h+.72,th=.32,s=new T.Shape();s.moveTo(-ow/2,0);s.lineTo(ow/2,0);s.lineTo(ow/2,oh*.58);s.quadraticCurveTo(ow*.47,oh*.82,0,oh);s.quadraticCurveTo(-ow*.47,oh*.82,-ow/2,oh*.58);s.closePath();
      const iw=ow-2*th,ih=oh-2*th,p=new T.Path();p.moveTo(-iw/2,th);p.lineTo(-iw/2,th+ih*.58);p.quadraticCurveTo(-iw*.47,th+ih*.82,0,th+ih);p.quadraticCurveTo(iw*.47,th+ih*.82,iw/2,th+ih*.58);p.lineTo(iw/2,th);p.closePath();s.holes.push(p);
      geo=new T.ExtrudeGeometry(s,{depth:.48,bevelEnabled:false,curveSegments:6});geo.translate(0,0,-.2);worldUV(geo);windowCache.set(key,geo);
    }
    C.mesh(g,geo,'trim',0,-.25,.18);C.pointed(g,0,0,.31,w,h,.055,tint);
    b(g,0,h*.38,.39,.11,h*.76,.09,'metal');b(g,0,h*.34,.39,w,.1,.09,'metal');
    b(g,0,-.37,.22,w+1.15,.35,1,'stoneLight');if(w>=4.7)b(g,0,h*.74,.4,.48,.48,.08,'gold',PI/4);
    return g;
  }
  function carvedSun(parent,x,y,z,r,ry=0){
    const g=C.group('V3_Sun_Sigil',parent);g.position.set(x,y,z);g.rotation.y=ry;
    cy(g,0,0,0,r*1.12,r*1.12,.3,'stoneWarm',24).rotation.x=PI/2;
    C.torus(g,0,0,.22,r,.12,'trim');C.torus(g,0,0,.35,r*.75,.085,'gold');sp(g,0,0,.35,r*.25,'gold',10);
    for(let k=0;k<12;k++){const a=k*PI/6;be(g,[Math.cos(a)*r*.36,Math.sin(a)*r*.36,.33],[Math.cos(a)*r*.86,Math.sin(a)*r*.86,.33],.065,'gold',5);}
  }
  function wall(name,x,z,len,ry,doorSpecs,court=false){
    const g=C.group(name,shell);g.position.set(x,42,z);g.rotation.y=ry;
    const h=63,thick=2.4,ds=doorSpecs.slice().sort((a,b)=>a.at-b.at),s=new T.Shape();s.moveTo(-len/2,0);
    for(const d of ds){const rr=d.width/2,sy=d.height-rr;s.lineTo(d.at-rr,0);s.lineTo(d.at-rr,sy);s.absarc(d.at,sy,rr,PI,0,true);s.lineTo(d.at+rr,0);}
    s.lineTo(len/2,0);s.lineTo(len/2,h);s.lineTo(-len/2,h);s.closePath();
    const geo=new T.ExtrudeGeometry(s,{depth:thick,bevelEnabled:false,curveSegments:12});geo.translate(0,0,-thick/2);worldUV(geo,42);
    const mesh=C.mesh(g,geo,'stone');mesh.name=name+'_Solid_Arch_Voids';
    for(const d of ds){
      C.arch(g,d.at,0,1.53,d.width+2.2,d.height+1.1,1.05,'stoneLight',0,1.1);
      C.arch(g,d.at,-.02,1.86,d.width+2.8,d.height+1.4,.45,'trim',0,.28);
      for(const side of [-1,1]){const xx=d.at+side*(d.width/2+1.2);b(g,xx,.42,1.58,1.9,.84,1.6,'stoneDark');cy(g,xx,(d.height-d.width/2)/2,1.6,.27,.36,d.height-d.width/2,'stoneLight',10);b(g,xx,d.height-d.width/2+.13,1.58,1.6,.45,1.65,'trim');}
      const center=new T.Vector3(d.at,0,0).applyAxisAngle(new T.Vector3(0,1,0),ry).add(new T.Vector3(x,42,z));
      portals.push({id:name+'_door_'+d.at,center:center.toArray(),width:d.width,height:d.height,springY:42+d.height-d.width/2,normal:[Math.sin(ry),0,Math.cos(ry)],kind:court?'courtyard_arcade':'exterior_portal'});
    }
    const bays=Math.max(3,Math.floor(len/(court?16:16.5))),pitch=len/bays;
    for(let j=0;j<bays;j++){
      const xx=-len/2+(j+.5)*pitch;
      for(let floor=0;floor<3;floor++){
        if(court&&floor===0)continue;
        if(floor===0&&ds.some(d=>Math.abs(xx-d.at)<d.width/2+4.2))continue;
        const y=[4.5,26,46.2][floor],hh=[12.8,12.2,12.2][floor];
        lancet(g,xx,y,1.24,court?4.5:4.8,hh,0,(j+floor)%5===0?'glassAmber':(j%3===0?'stainedRuby':'glassBlue'));
      }
    }
    for(let j=0;j<=bays;j++){
      const xx=-len/2+j*pitch;if(ds.some(d=>Math.abs(xx-d.at)<d.width/2+1.75))continue;
      b(g,xx,31.35,1.42,1.28,62.7,.82,'stoneWarm');b(g,xx,.8,1.64,2.05,1.6,1.5,'stoneLight');b(g,xx,62.2,1.65,2.2,1.3,1.6,'trim');
      for(const yy of [21.7,41.7])b(g,xx,yy,1.78,1.9,.52,1.2,'trim');
    }
    for(const yy of [21.8,41.8,62.8])b(g,0,yy,1.34,len+1,.6,1.05,'trim');
    // Lower plinth courses are split at every portal, leaving no crossbars.
    let cursor=-len/2;for(const d of ds){const end=d.at-d.width/2-1.6;if(end>cursor)b(g,(cursor+end)/2,.4,1.37,end-cursor,.6,.95,'stoneLight');cursor=d.at+d.width/2+1.6;}if(cursor<len/2)b(g,(cursor+len/2)/2,.4,1.37,len/2-cursor,.6,.95,'stoneLight');
    for(let xx=-len/2+2;xx<len/2-1;xx+=4.15)b(g,xx,61.85,1.72,.7,.82,1.05,'trim');
    facades.push({name,origin:[x,42,z],length:len,height:h,rotationY:ry,courtyard:court});
    return g;
  }
  // Perimeter walls: three true storeys, individually articulated at 42/64/84.
  wall('V3_South_Grand_Front',0,-120,264,0,[{at:0,width:14,height:18}]);
  wall('V3_North_Garden_Front',0,-328,264,PI,[{at:0,width:10,height:14}]);
  wall('V3_West_Outer_Front',-132,-224,208,-PI/2,[{at:-36,width:8,height:13},{at:24,width:8,height:13}]);
  wall('V3_East_Outer_Front',132,-224,208,PI/2,[{at:-24,width:8,height:13},{at:36,width:8,height:13}]);
  // Courtyard cloister has real open arcades, not black rectangles on solid walls.
  const sideArches=[-48,-30,-12,12,30,48].map(at=>({at,width:10,height:16}));
  wall('V3_West_Courtyard_Arcade',-68,-230,124,PI/2,sideArches,true);
  wall('V3_East_Courtyard_Arcade',68,-230,124,-PI/2,sideArches,true);
  wall('V3_South_Courtyard_Arcade',0,-168,136,PI,[{at:-51,width:10,height:16},{at:-26,width:10,height:16},{at:0,width:18,height:19},{at:26,width:10,height:16},{at:51,width:10,height:16}],true);
  wall('V3_North_Courtyard_Arcade',0,-292,136,0,[{at:-48,width:10,height:16},{at:-24,width:10,height:16},{at:0,width:12,height:16},{at:24,width:10,height:16},{at:48,width:10,height:16}],true);
  // High ceremonial portal: no central post, sill or furnishing crosses its path.
  for(const side of [-1,1]){
    b(shell,side*12.5,73.4,-117.85,2.1,62.8,1.35,'stoneLight');b(shell,side*12.5,104.3,-117.7,3.1,1.1,2,'trim');
    for(const yy of [43,63.6,83.6])b(shell,side*12.5,yy,-117.5,3,.75,2.1,'stoneWarm');
  }
  carvedSun(shell,0,64.9,-117.3,2.2);
  C.window(shell,0,69,-118.55,5.6,11.2,0,'glassAmber');C.window(shell,0,88.3,-118.55,5.6,11.2,0,'glassBlue');
  for(const side of [-1,1]){C.flag(detail,side*21.5,42,-113,1.7,side*.2);cy(detail,side*9.8,44.1,-115,.75,1.05,4.2,'stoneLight',12);cy(detail,side*9.8,46.5,-115,1.15,.65,.65,'gold',12);co(detail,side*9.8,47.5,-115,.48,1.5,'emissive',8);}
  // Ring-shaped foundations preserve the entire service basement volume.
  const foundationY=(-8+41.85)/2,foundationH=49.85;
  for(const side of [-1,1])b(base,side*157.4,foundationY,-223,2.8,foundationH,234,'stoneDark');
  for(const zz of [-337.4,-108.6])b(base,0,foundationY,zz,312,foundationH,2.8,'stoneDark');
  // Frame decks occupy only the area OUTSIDE the contracted room footprint.
  for(const side of [-1,1])b(base,side*146,40.85,-223,28,2,234,'path');
  b(base,0,40.85,-334,264,2,12,'path');b(base,0,40.85,-113,264,2,14,'path');
  for(const side of [-1,1]){
    for(let zz=-326;zz<=-118;zz+=26){b(base,side*156,16,zz,7,46,5,'stone');b(base,side*156,39.8,zz,8,2.2,7,'trim');}
    for(const yy of [9.5,21.8,38.9])b(base,side*159.65,yy,-223,.7,.72,234,'stoneWarm');
  }
  for(const zz of [-337.45,-108.55]){
    for(let xx=-140;xx<=140;xx+=28){b(base,xx,16,zz,5,46,4.3,'stone');b(base,xx,39.8,zz,7,2.2,5.1,'trim');}
    for(const yy of [9.5,21.8,38.9])b(base,0,yy,zz<-200?-339.64:-106.36,320,.72,.72,'stoneWarm');
  }
  // Foundation apron crenels and walks have a clear southern central connection.
  function parapet(ax,az,bx,bz){
    const len=Math.hypot(bx-ax,bz-az),g=C.group('V3_Terrace_Parapet',detail);g.position.set((ax+bx)/2,42,(az+bz)/2);g.rotation.y=-Math.atan2(bz-az,bx-ax);
    b(g,0,.65,0,len,1.3,1.4,'stone');b(g,0,1.4,0,len,.22,1.7,'trim');
    for(let xx=-len/2+1.1;xx<len/2;xx+=4.6){b(g,xx,2.18,0,1.8,1.35,1.4,'stoneLight');b(g,xx,2.91,0,2.05,.22,1.65,'trim');}
  }
  parapet(-158,-337.4,158,-337.4);for(const side of [-1,1]){parapet(side*158,-337.4,side*158,-108.4);parapet(side*12,-108.4,side*158,-108.4);}
  // Existing gallery -> new atrium bridge: one exterior slab, not an interior fill.
  const connector=C.group('V3_Old_Gallery_Connection',base);b(connector,0,41.6,-112.5,20,.8,16.2,'stoneLight');
  for(const side of [-1,1]){b(connector,side*9.8,43.05,-112.5,.6,2.1,14.6,'stone');b(connector,side*9.8,44.23,-112.5,1,.25,14.6,'trim');}
  // All new roof surfaces are independent of the walls and can be removed together.
  C.roof(roofs,0,105,-144,50,268,21,'roof',PI/2);C.roof(roofs,0,105,-310,38,268,18,'roof',PI/2);
  for(const side of [-1,1])C.roof(roofs,side*100,105,-230,68,128,20.5,'roof');
  function dormer(x,y,z,ry){
    const q=C.group('V3_Grand_Roof_Dormer',roofs);q.position.set(x,y,z);q.rotation.y=ry;
    b(q,0,2.5,0,5.5,5,7,'stoneLight');lancet(q,0,.45,3.58,3.35,4.1,0,'glassAmber');C.roof(q,0,5,0,6.8,8,3.6,'roof');
  }
  for(const xx of [-108,-72,-36,36,72,108]){dormer(xx,111.7,-130,0);dormer(xx,110.3,-319,PI);}
  for(const side of [-1,1])for(const zz of [-185,-215,-245,-275])dormer(side*124,108.7,zz,side*PI/2);
  // Roof ridges are long, so ornament cadence is sparse and deliberate.
  for(const zz of [-144,-310])for(let xx=-120;xx<=120;xx+=12){const yy=zz===-144?126:123;cy(roofs,xx,yy+1,zz,.095,.12,2,'gold',6);sp(roofs,xx,yy+2.16,zz,.25,'gold',8);}
  function turret(x,z,y,r,h,rh,name){
    const g=C.group(name,shell),rr=C.group(name+'_Roof',roofs),seg=12;
    cy(g,x,y+1,z,r+.9,r+1.2,2,'stoneDark',seg);cy(g,x,y+h/2,z,r,r+.2,h,'stone',seg);
    for(const yy of [y+2,y+h*.32,y+h*.64,y+h-.8])cy(g,x,yy,z,r+.45,r+.45,.65,'trim',seg);
    for(const yy of [y+6,y+27,y+47])if(yy+10<y+h)for(let k=0;k<6;k++){const a=k*PI/3;lancet(g,x+Math.sin(a)*(r+.2),yy,z+Math.cos(a)*(r+.2),2.7,9.8,a,k%3?'glassBlue':'glassAmber');}
    cy(g,x,y+h,z,r+1.2,r+.5,1.7,'stoneLight',seg);
    for(let k=0;k<seg;k++){const a=k*2*PI/seg;be(g,[x+Math.sin(a)*(r+.1),y+h-3,z+Math.cos(a)*(r+.1)],[x+Math.sin(a)*(r+1.1),y+h-.35,z+Math.cos(a)*(r+1.1)],.24,'stoneWarm',5);}
    C.torus(g,x,y+h+1.75,z,r+.95,.12,'trim',PI/2);
    for(let k=0;k<seg;k++){const a=k*2*PI/seg;cy(g,x+Math.sin(a)*(r+.95),y+h+.95,z+Math.cos(a)*(r+.95),.1,.15,1.8,'trim',6);}
    cy(rr,x,y+h+rh*.225,z,r*.47,r+1.1,rh*.45,'roof',seg);co(rr,x,y+h+rh*.7,z,r*.5,rh*.54,'roof',seg);
    for(let k=0;k<seg;k++){const a=k*2*PI/seg;be(rr,[x+Math.sin(a)*(r+1.1),y+h,z+Math.cos(a)*(r+1.1)],[x+Math.sin(a)*r*.47,y+h+rh*.45,z+Math.cos(a)*r*.47],.07,'gold',5);}
    cy(rr,x,y+h+rh+1,z,.1,.14,2.4,'gold',6);sp(rr,x,y+h+rh+2.3,z,.3,'gold',8);
  }
  for(const side of [-1,1]){for(const zz of [-128,-320])turret(side*140,zz,42,7.5,71,28,'V3_Outer_Corner_Turret');turret(side*140,-224,42,6.6,65,25,'V3_Outer_Gallery_Turret');}
  for(const side of [-1,1])for(const zz of [-168,-292])turret(side*68,zz,105,4.2,16,17,'V3_Courtyard_Attic_Turret');
  // North observatory is supported ABOVE the roof: no cylinder fills any room.
  const observatory=C.group('V3_Northern_Observatory_Shaft_Above_105',shell),obsRoof=C.group('V3_Observatory_Crown',roofs);
  cy(observatory,0,106.8,-310,18.2,19,3.6,'stoneDark',20);cy(observatory,0,130,-310,15,17,46,'stone',20);
  for(const yy of [110,130,151.7])cy(observatory,0,yy,-310,17.5,17.5,.9,'trim',20);
  for(let k=0;k<10;k++){const a=k*PI/5;lancet(observatory,Math.sin(a)*16.4,115,-310+Math.cos(a)*16.4,4.3,13,a,k%2?'glassAmber':'glassBlue');lancet(observatory,Math.sin(a)*15.55,135,-310+Math.cos(a)*15.55,4.1,12,a,'glassBlue');}
  cy(observatory,0,153.6,-310,19.5,17.2,2.5,'stoneLight',20);
  for(let k=0;k<20;k++){const a=k*PI/10,xx=Math.sin(a)*18,zz=-310+Math.cos(a)*18;
    be(observatory,[Math.sin(a)*16,149,-310+Math.cos(a)*16],[xx,153,zz],.4,'stoneWarm',6);cy(observatory,xx,158.8,zz,.35,.48,8.1,'stoneLight',8);cy(observatory,xx,163.05,zz,.66,.4,.5,'trim',8);
  }
  C.torus(observatory,0,156.3,-310,18,.16,'trim',PI/2);C.torus(observatory,0,163.4,-310,18,.18,'trim',PI/2);
  cy(observatory,0,164,-310,16.8,18.9,1.6,'trim',20);cy(observatory,0,175,-310,12,12,22,'stone',16);
  for(let k=0;k<8;k++){const a=k*PI/4;C.window(observatory,Math.sin(a)*12.15,168,-310+Math.cos(a)*12.15,3.5,12,a,'glassAmber');}
  cy(observatory,0,186,-310,13.6,11,2.1,'stoneLight',16);
  cy(obsRoof,0,194,-310,6.5,14.3,14,'copper',16);co(obsRoof,0,212,-310,6.7,24,'roof',16);
  for(let k=0;k<16;k++){const a=k*PI/8;be(obsRoof,[Math.sin(a)*14.3,187,-310+Math.cos(a)*14.3],[Math.sin(a)*6.5,201,-310+Math.cos(a)*6.5],.09,'gold',5);be(obsRoof,[Math.sin(a)*6.5,201,-310+Math.cos(a)*6.5],[0,224,-310],.07,'gold',5);}
  cy(obsRoof,0,226,-310,.13,.2,4,'gold',8);sp(obsRoof,0,228.4,-310,.45,'gold',10);
  be(obsRoof,[-2,226.4,-310],[2,226.4,-310],.08,'gold',6);C.flag(obsRoof,0,225,-310,.42,.2);
  // Connector metadata is separate from room metadata authored by interiors.
  C.expansionShellLayout={name:'Grand Courtyard Palace',outerBounds:{min:[-132,42,-328],max:[132,105,-120]},courtyard:{min:[-68,42,-292],max:[68,105,-168]},foundation:{min:[-160,-8,-340],max:[160,41.85,-106],serviceBasementUnfilled:true},storeySurfaces:[42,64,84],roofBase:105,observatoryTop:228.85,facades,portals,connection:{oldPortal:[0,42,-104.8],newPortal:[0,42,-120],bridgeBounds:{min:[-10,41.2,-120.6],max:[10,42,-104.4]},oldBypassPaths:[[[11,42,-79],[11,42,-83],[22,42,-83],[22,42,-101],[0,42,-101],[0,42,-120]],[[-11,42,-79],[-11,42,-83],[-22,42,-83],[-22,42,-101],[0,42,-101],[0,42,-120]]]},notes:['No new interior floor slabs in shell module.','No foundation solid fills the service basement.','Ground facade portals are genuine curved voids.']};
}

/* AUTHORED SOURCE: expansion_interiors.js — preserved V3 model geometry. */
/* Baegwol V3 — connected four-storey palace interiors. Authored metres, Y up.
 * Source of truth for room, doorway, stair and slab geometry: C.expansionLayout.
 * No collision controller is implied. Architectural passages are geometrically open.
 */
function buildExpansionInteriors(C){
  const T=C.THREE, PI=Math.PI, FY=[22,42,64,84], NEXT=[42,64,84,105];
  const L=FY.map((_,i)=>C.groups['level'+i]), W=FY.map((_,i)=>C.groups['walls'+i]);
  if(L.some(x=>!x)||W.some(x=>!x))throw new Error('V3 needs level0..level3 and walls0..walls3 groups');
  const M=C.expansionLayout={version:3,units:'suggested metres',floors:FY.map((y,i)=>({floor:i,y,name:['B1 서비스층','1F 의례·공공층','2F 학술·접객층','3F 왕실층'][i]})),rooms:[],portals:[],stairs:[],paths:[],voids:[],slabs:[],wallSegments:[],furniture:[],clearancePolicy:{mainCorridors:8,minimumPlannedWalkWidth:3,doorHeight:8.5,lowerPartitionHeight:4.5}};
  const B=(g,x,y,z,w,h,d,m='stoneLight',ry=0)=>C.box(g,x,y,z,w,h,d,m,ry);
  const minY=22;
  function noteRoom(floor,id,name,x,z,w,d,kind,extra={}){
    const room={id,name,floor,x,z,w,d,kind,y:FY[floor],...extra};M.rooms.push(room);return room;
  }
  function path(floor,id,points,width=4,extra={}){M.paths.push({id,floor,points,width,...extra});}
  function rect(x0,x1,z0,z1){return{x0,x1,z0,z1};}
  function subtract(a,b){
    const x0=Math.max(a.x0,b.x0),x1=Math.min(a.x1,b.x1),z0=Math.max(a.z0,b.z0),z1=Math.min(a.z1,b.z1);
    if(x1<=x0||z1<=z0)return[a];const out=[];
    if(a.z0<z0)out.push(rect(a.x0,a.x1,a.z0,z0));if(z1<a.z1)out.push(rect(a.x0,a.x1,z1,a.z1));
    if(a.x0<x0)out.push(rect(a.x0,x0,z0,z1));if(x1<a.x1)out.push(rect(x1,a.x1,z0,z1));return out;
  }
  function slab(floor,b,id,thickness=.7,material){
    const w=b.x1-b.x0,d=b.z1-b.z0;if(w<=0||d<=0)return;
    const y=FY[floor],x=(b.x0+b.x1)/2,z=(b.z0+b.z1)/2;
    B(L[floor],x,y-thickness/2,z,w,thickness,d,material||['agedStone','stoneLight','stoneCool','trim'][floor]);
    M.slabs.push({id,floor,x,z,w,d,topY:y,bottomY:y-thickness});
  }
  const WINGS=[{id:'south',r:rect(-132,132,-168,-120)},{id:'west',r:rect(-132,-68,-292,-168)},{id:'east',r:rect(68,132,-292,-168)},{id:'north',r:rect(-132,132,-328,-292)}];
  const ATRIUM={id:'central-atrium',x:0,z:-143,w:68,d:34}, SERVICE={id:'service-stair',x:-114,z:-142.5,w:24,d:25};
  const SIDEVOID=[{id:'west-royal-stair',x:-105,z:-279,w:34,d:18},{id:'east-royal-stair',x:105,z:-279,w:34,d:18}];
  const CUTS=[[],[SERVICE],[ATRIUM],[ATRIUM,...SIDEVOID]];
  for(let f=0;f<4;f++){
    for(const c of CUTS[f])M.voids.push({id:c.id+'-F'+f,floor:f,x:c.x,z:c.z,w:c.w,d:c.d,y:FY[f],reason:c.id==='central-atrium'?'open four-storey light well':'stair headroom and landing'});
    for(const wing of WINGS){let parts=[wing.r];for(const h of CUTS[f])parts=parts.flatMap(p=>subtract(p,rect(h.x-h.w/2,h.x+h.w/2,h.z-h.d/2,h.z+h.d/2)));parts.forEach((p,i)=>slab(f,p,'F'+f+'-'+wing.id+'-slab-'+i));}
  }
  function portal(floor,id,x,z,width,axis,between,height=8.5,extra={}){const p={id,floor,x,z,width,axis,between,y:FY[floor],height,...extra};M.portals.push(p);return p;}
  // Parallel-to-X wall: axis x, fixed z. Parallel-to-Z wall: axis z, fixed x.
  // Lower and upper boxes are split on the same exact doorway intervals.
  function wall(floor,id,axis,fixed,from,to,doors=[],mat='stoneWarm',thick=.65){
    const y=FY[floor],h=NEXT[floor]-y-.7;
    const ds=doors.map(d=>({...d,start:d.at-d.width/2,end:d.at+d.width/2})).sort((a,b)=>a.start-b.start);
    function piece(a,b,lo,hi,group,kind){
      if(b-a<.001||hi-lo<.001)return;
      const x=axis==='x'?(a+b)/2:fixed,z=axis==='x'?fixed:(a+b)/2,w=axis==='x'?b-a:thick,d=axis==='x'?thick:b-a;
      B(group,x,y+(lo+hi)/2,z,w,hi-lo,d,mat);
      M.wallSegments.push({id:id+'-'+kind+'-'+M.wallSegments.length,floor,x,z,w,d,bottomY:y+lo,topY:y+hi,owner:id});
    }
    let at=from;
    for(const d of ds){
      if(d.start<from-.001||d.end>to+.001||d.start<at-.001)throw new Error('Invalid V3 doorway interval '+id);
      piece(at,d.start,0,4.5,L[floor],'low');piece(at,d.start,4.5,h,W[floor],'high');
      piece(d.start,d.end,d.height||8.5,h,W[floor],'lintel');
      const x=axis==='x'?d.at:fixed,z=axis==='x'?fixed:d.at;
      portal(floor,d.id||id+'-door-'+d.at,x,z,d.width,axis,d.between||[],d.height||8.5);
      // Frame is wholly outside the declared clear aperture; it never fills the hole.
      for(const edge of [d.start-.18,d.end+.18]){
        const fx=axis==='x'?edge:fixed,fz=axis==='x'?fixed:edge;
        B(L[floor],fx,y+2.25,fz,axis==='x'?.28:thick+.16,4.5,axis==='x'?thick+.16:.28,'trim');
        B(W[floor],fx,y+(4.5+(d.height||8.5))/2,fz,axis==='x'?.28:thick+.16,(d.height||8.5)-4.5,axis==='x'?thick+.16:.28,'trim');
      }
      B(W[floor],x,y+(d.height||8.5)+.18,z,axis==='x'?d.width+.65:thick+.18,.3,axis==='x'?thick+.18:d.width+.65,'trim');
      at=d.end;
    }
    piece(at,to,0,4.5,L[floor],'low');piece(at,to,4.5,h,W[floor],'high');
  }
  function rail(floor,a,b,{g=L[floor],y=FY[floor],height=1.35,mat='gold'}={}){
    const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2.2));
    C.beam(g,[a[0],y+height,a[1]],[b[0],y+height,b[1]],.075,mat,6);
    C.beam(g,[a[0],y+.3,a[1]],[b[0],y+.3,b[1]],.045,mat,5);
    for(let i=0;i<=n;i++){let t=i/n;C.cyl(g,a[0]+(b[0]-a[0])*t,y+height/2,a[1]+(b[1]-a[1])*t,.05,.075,height,mat,6);}
  }
  // Split round columns leave only the lower portion in the sectioned floor group.
  function column(floor,x,z,h=15,r=.65){
    const y=FY[floor];C.cyl(L[floor],x,y+.25,z,r*1.6,r*1.8,.5,'stoneCool',12);
    C.cyl(L[floor],x,y+2.45,z,r,r*1.12,4.1,'stoneLight',12);
    if(h>4.5)C.cyl(W[floor],x,y+(4.5+h)/2,z,r*.94,r,h-4.5,'stoneLight',12);
    C.cyl(W[floor],x,y+h+.2,z,r*1.7,r*1.4,.4,'trim',12);B(W[floor],x,y+h+.55,z,r*3.6,.35,r*3.6,'gold');
  }
  // All corridor plans are uninterrupted, at least 8m wide except the 6m front gallery.
  for(let f=0;f<4;f++){
    noteRoom(f,'F'+f+'-south-corridor','남쪽 연결 회랑',0,-164,264,8,'corridor');
    noteRoom(f,'F'+f+'-front-gallery','정면 갤러리',0,-123,264,6,'corridor');
    noteRoom(f,'F'+f+'-west-corridor','서쪽 중정 회랑',-74,-230,12,124,'corridor');
    noteRoom(f,'F'+f+'-east-corridor','동쪽 중정 회랑',74,-230,12,124,'corridor');
    noteRoom(f,'F'+f+'-north-gallery','북쪽 장회랑',0,-298,264,12,'corridor');
    noteRoom(f,'F'+f+'-atrium-west','대계단 서측 회랑',-38,-143,8,42,'corridor');
    noteRoom(f,'F'+f+'-atrium-east','대계단 동측 회랑',38,-143,8,42,'corridor');
    path(f,'F'+f+'-courtyard-loop',[[-74,-164],[74,-164],[74,-298],[-74,-298],[-74,-164]],4,{role:'continuous four-sided corridor'});
    path(f,'F'+f+'-front-connector',[[-124,-123],[124,-123]],3.5);
    path(f,'F'+f+'-atrium-west-route',[[-38,-123],[-38,-164]],4);
    path(f,'F'+f+'-atrium-east-route',[[38,-123],[38,-164]],4);
  }
  const SOUTH_NAMES=[
    [['서비스 계단실','stairs'],['세탁·피복실','laundry'],['식료품 저장실','pantry'],['수선·금속 공방','workshop']],
    [['서비스 계단실','stairs'],['알현 대기실','reception'],['근위병 접견실','guard'],['왕립 치료실','infirmary']],
    [['서쪽 손님 침실','guest'],['악기·음악실','music'],['태피스트리 전시실','gallery'],['근위대 숙소','barracks']],
    [['왕실 목욕실','bath'],['왕실 의상실','wardrobe'],['비밀 서재','study'],['동쪽 손님 침실','guest']]
  ];
  const SIDE_NAMES=[
    [['궁정 대주방','kitchen'],['포도주·곡물 창고','cellar'],['목공·운반 공방','workshop'],['저수조 관리실','cistern']],
    [['대연회장','banquet'],['왕실 기록보관소','archive'],['군사 작전실','war'],['무기·근위대 전시실','armory']],
    [['지도 제작실','maps'],['학자 연구실','study'],['외교관 회의실','council'],['회화 복원실','art']],
    [['왕의 침실','royalbed'],['왕실 집무실','study'],['왕실 손님 접객실','guest'],['가족 음악실','music']]
  ];
  const NORTH_NAMES=[
    [['귀중품 보관실','treasury'],['서고·장부실','archive'],['숙직·경비 휴게실','barracks']],
    [['왕립 대도서관','library'],['국정 회의실','council'],['초상화 장랑','gallery']],
    [['북쪽 손님 아파트','guest'],['항해·천문 연구실','astronomy'],['조각·유물 전시실','gallery']],
    [['왕실 개인 도서관','library'],['상층 천문 연구실','astronomy'],['왕관·보물 전시실','treasury']]
  ];
  const functional=[];
  for(let f=0;f<4;f++){
    const southDefs=[[-112,40],[-67,50],[67,50],[112,40]];
    for(let i=0;i<4;i++){
      let [x,w]=southDefs[i],[name,kind]=SOUTH_NAMES[f][i],id='F'+f+'-south-'+i;
      const r=noteRoom(f,id,name,x,-143,w,34,kind,{placement:'south',clearAxisX:x});functional.push(r);
      if(kind!=='stairs')path(f,id+'-walk',[[x,-164],[x,-128]],3.5,{room:id});
    }
    // South block room walls preserve both the north corridor and front gallery.
    for(let side of [-1,1]){
      const lo=side<0?-132:42,hi=side<0?-42:132,indices=side<0?[0,1]:[2,3];
      const doors=indices.map(i=>({at:i===0&&f<2?-114:southDefs[i][0],width:i===0&&f<2?20:8,id:'F'+f+'-south-'+i+'-north-door',between:['F'+f+'-south-'+i,'F'+f+'-south-corridor']}));
      wall(f,'F'+f+'-southblock-'+side+'-north','x',-160,lo,hi,doors);
      wall(f,'F'+f+'-southblock-'+side+'-front','x',-126,lo,hi,doors.map((d,i)=>({...d,id:d.id.replace('north','front'),between:[d.between[0],'F'+f+'-front-gallery']})));
      const inner=side*42,middle=side*92;
      wall(f,'F'+f+'-southblock-'+side+'-inner','z',inner,-160,-126,[{at:-143,width:8,between:['F'+f+'-south-'+(side<0?1:2),'F'+f+'-atrium-'+(side<0?'west':'east')]}]);
      wall(f,'F'+f+'-southblock-'+side+'-divider','z',middle,-160,-126,[{at:-144,width:6,between:['F'+f+'-south-'+indices[0],'F'+f+'-south-'+indices[1]]}]);
    }
    if(f===0){
      functional.push(noteRoom(f,'F0-delivery','반입·배식 준비실',0,-143,68,34,'delivery',{placement:'south',clearAxisX:0}));
      path(0,'F0-delivery-spine',[[0,-123],[0,-164]],5);
    }else if(f===1){
      noteRoom(f,'F1-grand-atrium','쌍갈래 대계단 홀',0,-143,68,34,'atrium');
      path(1,'F1-entry-to-atrium',[[0,-120],[0,-126],[0,-130]],5);
      path(1,'F1-atrium-bypass-west',[[0,-126],[-18,-126],[-18,-158],[-18,-164]],4);
      path(1,'F1-atrium-bypass-east',[[0,-126],[18,-126],[18,-158],[18,-164]],4);
    }
    for(let side of [-1,1]){
      const x=side*106,xmin=side<0?-132:80,xmax=side<0?-80:132,cor='F'+f+'-'+(side<0?'west':'east')+'-corridor';
      const i=side<0?0:2,idS='F'+f+'-'+(side<0?'west':'east')+'-south',idN='F'+f+'-'+(side<0?'west':'east')+'-north';
      let [nameS,kindS]=SIDE_NAMES[f][i],[nameN,kindN]=SIDE_NAMES[f][i+1];
      functional.push(noteRoom(f,idS,nameS,x,-199,52,62,kindS,{placement:'side',crossZ:-200,side}));
      functional.push(noteRoom(f,idN,nameN,x,f<2?-261:-248,52,f<2?62:36,kindN,{placement:'side',crossZ:-260,side}));
      let doorList=[{at:-200,width:8,between:[idS,cor]},{at:-260,width:8,between:[idN,cor]}];
      if(f>=2){let stairId='F'+f+'-'+(side<0?'west':'east')+'-stair-gallery';noteRoom(f,stairId,(side<0?'서':'동')+'쪽 왕실 계단실',x,-279,52,26,'stairs');doorList.push({at:-279,width:16,between:[stairId,cor]});
        wall(f,stairId+'-front-wall','x',-266,xmin,xmax,[{at:x,width:7,between:[idN,stairId]}]);
        path(f,stairId+'-corridor-link',[[side*74,-279],[side*84,-279],[side*84,-298]],3.5);
      }
      wall(f,'F'+f+'-'+side+'-corridor-wall','z',side*80,-292,-168,doorList);
      wall(f,idS+'-south-end','x',-168,xmin,xmax,[{at:x,width:8,between:[idS,'F'+f+'-south-corridor']}]);
      wall(f,idS+'-north-divider','x',-230,xmin,xmax,[{at:x,width:7,between:[idS,idN]}]);
      wall(f,idN+'-north-end','x',-292,xmin,xmax,[{at:f<2?x:side*85,width:8,between:[f<2?idN:'F'+f+'-'+(side<0?'west':'east')+'-stair-gallery','F'+f+'-north-gallery']}]);
      path(f,idS+'-crosswalk',[[side*74,-200],[side*128,-200]],4,{room:idS});
      path(f,idN+'-crosswalk',[[side*74,-260],[side*128,-260]],4,{room:idN});
      path(f,idS+'-inner-aisle',[[side*86,-174],[side*86,-226]],3.5,{room:idS});
      if(f<2)path(f,idN+'-inner-aisle',[[side*86,-234],[side*86,-286]],3.5,{room:idN});
    }
    for(let i=0;i<3;i++){
      const x=(i-1)*88,[name,kind]=NORTH_NAMES[f][i],id='F'+f+'-north-'+i;
      functional.push(noteRoom(f,id,name,x,-316,88,24,kind,{placement:'north',clearAxisX:x}));
      path(f,id+'-walk',[[x,-298],[x,-324]],4,{room:id});
    }
    wall(f,'F'+f+'-north-room-fronts','x',-304,-132,132,[-88,0,88].map((x,i)=>({at:x,width:10,between:['F'+f+'-north-'+i,'F'+f+'-north-gallery']})));
    for(let x of [-44,44])wall(f,'F'+f+'-north-room-divider-'+x,'z',x,-328,-304,[]);
  }
  // The B1 enclosure is deliberately independent of the shell, which begins at y42.
  for(let x of [-132,132])wall(0,'B1-outer-side-'+x,'z',x,-328,-120,[],'agedStone');
  for(let z of [-328,-120])wall(0,'B1-outer-end-'+z,'x',z,-132,132,[],'agedStone');
  for(let x of [-68,68])wall(0,'B1-courtyard-side-'+x,'z',x,-292,-168,[],'agedStone');
  for(let z of [-292,-168])wall(0,'B1-courtyard-end-'+z,'x',z,-68,68,[],'agedStone');
  // Agreed shell apertures: same coordinates as expansion_palace.js, no duplicate meshes.
  portal(1,'main-south-portal',0,-120,14,'x',['old-keep-bridge','F1-grand-atrium'],18,{owner:'palace-shell'});
  portal(1,'north-exterior-portal',0,-328,10,'x',['F1-north-1','outer-garden'],14,{owner:'palace-shell'});
  for(let side of [-1,1])for(let z of [-200,-260])portal(1,'side-exterior-'+side+'-'+z,side*132,z,8,'z',['F1-'+(side<0?'west':'east')+'-'+(z===-200?'south':'north'),'outer-garden'],13,{owner:'palace-shell'});
  portal(1,'courtyard-south-portal',0,-168,18,'x',['F1-south-corridor','courtyard'],19,{owner:'palace-shell'});
  portal(1,'courtyard-north-portal',0,-292,12,'x',['F1-north-gallery','courtyard'],16,{owner:'palace-shell'});
  for(let side of [-1,1])for(let z of [-182,-200,-218,-242,-260,-278])portal(1,'courtyard-side-'+side+'-'+z,side*68,z,10,'z',['F1-'+(side<0?'west':'east')+'-corridor','courtyard'],16,{owner:'palace-shell'});
  // Stair geometry: true stepped flights and thin landings, not room-sized filler blocks.
  function flight(floor,id,a,b,width,mat='stoneLight'){
    const g=C.group(id,L[floor]),dx=b[0]-a[0],dz=b[2]-a[2],run=Math.hypot(dx,dz),rise=b[1]-a[1],n=Math.ceil(rise/.28),ux=dx/run,uz=dz/run;
    if(rise<=0||((dx===0)===(dz===0)))throw new Error('V3 stair must be ascending and axis aligned');
    for(let i=0;i<n;i++){const t=(i+.5)/n,h=(i+1)*rise/n;B(g,a[0]+dx*t,a[1]+h/2,a[2]+dz*t,dx?run/n+.015:width,h,dz?run/n+.015:width,mat);}
    for(let side of [-1,1]){
      const ox=-uz*side*(width/2-.18),oz=ux*side*(width/2-.18);
      C.beam(g,[a[0]+ox,a[1]+1.35,a[2]+oz],[b[0]+ox,b[1]+1.35,b[2]+oz],.07,'gold',6);
      const posts=Math.ceil(run/2.2);for(let i=0;i<=posts;i++){let t=i/posts,y=a[1]+rise*t;C.cyl(g,a[0]+dx*t+ox,y+.65,a[2]+dz*t+oz,.045,.065,1.3,'gold',6);}
    }
    return{start:a,end:b,width,rise,run,risers:n,riserHeight:rise/n,treadDepth:run/n};
  }
  function landing(floor,id,x,y,z,w,d){B(L[floor],x,y-.35,z,w,.7,d,'stoneLight');return{id,x,y,z,w,d};}
  const serviceFlights=[flight(0,'Service_Stair_Lower',[-120,22,-130],[-120,32,-150],6.5,'stone'),flight(0,'Service_Stair_Upper',[-108,32,-150],[-108,42,-130],6.5,'stone')];
  const serviceLanding=landing(0,'service-mid-landing',-114,32,-152.5,20,5);
  rail(0,[-124,-155],[-104,-155],{y:32});rail(0,[-124,-155],[-124,-150],{y:32});rail(0,[-104,-155],[-104,-150],{y:32});
  M.stairs.push({id:'service-B1-1F',name:'남서 서비스 계단',fromFloor:0,toFloor:1,start:[-120,22,-130],end:[-108,42,-130],width:6.5,voids:[{floor:1,...SERVICE}],path:[[-120,22,-130],[-120,32,-150],[-120,32,-152],[-108,32,-152],[-108,32,-150],[-108,42,-130]],flights:serviceFlights,landings:[serviceLanding]});
  path(0,'B1-service-stair-approach',[[-120,-123],[-120,-130]],4);path(1,'F1-service-stair-exit',[[-108,-130],[-108,-123]],4);
  for(const[a,b]of[[[-126,-155],[-102,-155]],[[-126,-155],[-126,-130]],[[-102,-155],[-102,-130]],[[-126,-130],[-112,-130]],[[-104,-130],[-102,-130]]])rail(1,a,b);
  const mainTrunk=flight(1,'Grand_Stair_Central',[0,42,-130],[0,53,-147],9);
  const mainLanding=landing(1,'grand-mid-landing',0,53,-151.5,16,9);
  rail(1,[-8,-156],[8,-156],{y:53});
  for(let side of [-1,1]){
    const branch=flight(1,'Grand_Stair_'+(side<0?'West':'East'),[side*8,53,-151.5],[side*34,64,-151.5],7);
    M.stairs.push({id:'grand-'+(side<0?'west':'east'),name:'쌍갈래 대계단 '+(side<0?'서측':'동측'),fromFloor:1,toFloor:2,start:[0,42,-130],end:[side*34,64,-151.5],width:7,voids:[{floor:2,...ATRIUM}],path:[[0,42,-130],[0,53,-147],[0,53,-151.5],[side*8,53,-151.5],[side*34,64,-151.5]],flights:[mainTrunk,branch],landings:[mainLanding]});
    path(2,'grand-'+side+'-exit',[[side*34,-151.5],[side*38,-151.5],[side*38,-164]],3.5);
    C.cyl(L[1],side*23,49.1,-151.5,.55,.8,14.2,'stoneLight',12);
  }
  for(let side of [-1,1]){
    const a=[side*88,64,-283],b=[side*112,74,-283],c=[side*112,74,-275],d=[side*88,84,-275];
    const f1=flight(2,(side<0?'West':'East')+'_Royal_Stair_Lower',a,b,6),f2=flight(2,(side<0?'West':'East')+'_Royal_Stair_Upper',c,d,6);
    const land=landing(2,'royal-mid-'+side,side*116,74,-279,8,14);
    rail(2,[side*120,-286],[side*120,-272],{y:74});
    M.stairs.push({id:(side<0?'west':'east')+'-royal-2F-3F',name:(side<0?'서':'동')+'쪽 왕실 계단',fromFloor:2,toFloor:3,start:a,end:d,width:6,voids:[{floor:3,...SIDEVOID[side<0?0:1]}],path:[a,b,[side*116,74,-283],[side*116,74,-275],c,d],flights:[f1,f2],landings:[land]});
    path(2,'royal-'+side+'-start',[[side*74,-283],[side*88,-283]],3.5);path(3,'royal-'+side+'-end',[[side*88,-275],[side*74,-275]],3.5);
    const outer=side*122,inner=side*88;
    rail(3,[outer,-288],[outer,-270]);rail(3,[inner,-288],[outer,-288]);rail(3,[inner,-270],[outer,-270]);
    rail(3,[inner,-288],[inner,-278.8]);rail(3,[inner,-271.2],[inner,-270]);
  }
  for(let f of [2,3]){
    rail(f,[-34,-160],[34,-160]);rail(f,[-34,-126],[34,-126]);
    for(let x of [-34,34])if(f===2){rail(f,[x,-160],[x,-155.5]);rail(f,[x,-147.5],[x,-126]);}else rail(f,[x,-160],[x,-126]);
  }
  // Compact reusable furniture is authored at human scale; large rooms get distinct uses.
  let propN=0;const propGroups=[];
  function prop(floor,kind,x,z,fn,ry=0,blocksWalk=true){
    const id='F'+floor+'-'+kind+'-'+(++propN),g=C.group(id,L[floor]);g.position.set(x,FY[floor],z);g.rotation.y=ry;fn(g);
    g.userData={expansionProp:true,floor,kind,blocksWalk};propGroups.push({id,floor,kind,g,blocksWalk});return g;
  }
  function chair(g,x,z,ry=0,royal=false){
    const q=C.group('Chair',g);q.position.set(x,0,z);q.rotation.y=ry;
    B(q,0,.83,0,1.2,.19,1.15,royal?'gold':'wood');B(q,0,1.5,-.5,1.2,1.45,.14,royal?'burgundy':'woodLight');
    for(let xx of [-.44,.44])for(let zz of [-.42,.42])B(q,xx,.38,zz,.13,.76,.13,royal?'gold':'wood');
    if(royal)B(q,0,.99,0,1.06,.13,1,'burgundy');
  }
  function table(f,x,z,w=8,d=3,kind='desk',chairs=4,ry=0){
    return prop(f,kind,x,z,g=>{
      B(g,0,1.25,0,w,.25,d,'woodLight');for(let xx of [-w*.42,w*.42])for(let zz of [-d*.35,d*.35])B(g,xx,.6,zz,.23,1.2,.23,'wood');
      const diningXs=kind==='banquet'?Array.from({length:10},(_,i)=>(i-4.5)*2.05):[-w*.34,0,w*.34];
      if(chairs===4){chair(g,-w/2-1,0,-PI/2);chair(g,w/2+1,0,PI/2);chair(g,0,-d/2-1,PI);chair(g,0,d/2+1,0);}
      else if(chairs===2){chair(g,0,-d/2-1,PI);chair(g,0,d/2+1,0);}
      else if(chairs>4){for(let xx of diningXs)for(let side of [-1,1])chair(g,xx,side*(d/2+1),side<0?PI:0,kind==='council');}
      if(kind==='banquet'){
        B(g,0,1.4,0,w*.92,.04,.7,'linen');
        for(let xx of diningXs)for(let side of [-1,1]){C.cyl(g,xx,1.4,side*d*.28,.38,.38,.05,'trim',10);C.cyl(g,xx+.48,1.57,side*d*.3,.1,.065,.38,'gold',8);}
        for(let xx of [-w*.22,w*.22]){C.cyl(g,xx,1.42,0,.65,.65,.08,'gold',12);C.sphere(g,xx,1.7,0,.28,'flowerRose',8);}
      }else if(kind==='map-table'||kind==='council'){
        B(g,0,1.4,0,w*.65,.03,d*.72,'parchment');for(let k=0;k<7;k++)B(g,(k%4-1.5)*w*.13,1.45,(Math.floor(k/4)-.5)*d*.24,.25,.09,.2,k%2?'stainedRuby':'stainedTeal');
      }else{B(g,-1,1.43,0,1.1,.12,.8,'booksRed');B(g,.5,1.4,0,1.2,.04,.8,'parchment');C.cyl(g,1.45,1.55,.35,.16,.18,.32,'metal',8);}
    },ry);
  }
  function bookcase(f,x,z,w=6,h=4.5,ry=0){
    return prop(f,'bookcase',x,z,g=>{
      B(g,0,h/2,-.68,w,h,.18,'wood');for(let xx of [-w/2,w/2])B(g,xx,h/2,0,.22,h,1.7,'wood');
      for(let j=0;j<4;j++){
        let yy=.18+j*(h-.35)/3;B(g,0,yy,0,w+.25,.13,1.7,'woodLight');
        if(j<3)for(let k=0;k<8;k++){let bh=.6+((k+j)%4)*.12;B(g,-w/2+.5+k*(w-1)/7,yy+bh/2+.09,.12,.35,bh,.85,['booksBlue','booksRed','booksGold','leather'][(k+j)%4]);}
      }
      B(g,0,h+.15,0,w+.5,.22,1.9,'wood');
    },ry);
  }
  function bed(f,x,z,royal=false,ry=0){
    return prop(f,royal?'royal-bed':'bed',x,z,g=>{
      const w=royal?4.8:3.3,d=royal?7.2:5.3;
      B(g,0,.55,0,w,1.1,d,'wood');B(g,0,1.18,0,w-.2,.25,d-.2,'linen');B(g,0,1.37,.7,w-.25,.15,d*.64,'burgundy');
      for(let xx of [-(w*.25),w*.25]){const p=C.sphere(g,xx,1.55,-d*.32,.7,'linen',8);p.scale.set(1,.36,.58);}
      B(g,0,1.9,-d/2,w+.3,2.6,.2,'woodLight');
      if(royal){for(let xx of [-w/2,w/2])for(let zz of [-d/2,d/2]){C.cyl(g,xx,2.7,zz,.085,.12,5.4,'gold',8);C.sphere(g,xx,5.5,zz,.18,'gold',8);}for(let xx of [-w/2,w/2])C.beam(g,[xx,5.25,-d/2],[xx,5.25,d/2],.08,'gold',6);for(let zz of [-d/2,d/2])C.beam(g,[-w/2,5.25,zz],[w/2,5.25,zz],.08,'gold',6);}
    },ry);
  }
  function cabinet(f,x,z,w=5,kind='cabinet',ry=0){
    return prop(f,kind,x,z,g=>{
      B(g,0,2,0,w,4,1.7,'wood');B(g,0,4.15,0,w+.35,.25,1.9,'woodLight');
      for(let xx of [-w*.25,w*.25]){B(g,xx,2,.91,w*.44,3.55,.09,'woodLight');C.cyl(g,xx+(xx<0?.25:-.25),2,.99,.06,.06,.35,'gold',8);}
      if(kind==='wardrobe')for(let xx of [-w*.25,w*.25])B(g,xx,2.7,1.0,w*.28,.6,.06,xx<0?'burgundy':'booksBlue');
    },ry);
  }
  function barrel(f,x,z,ry=0){
    return prop(f,'barrel',x,z,g=>{
      C.cyl(g,0,1.05,0,.8,.8,2.1,'woodLight',12);for(let yy of [.25,1.75])C.cyl(g,0,yy,0,.85,.85,.12,'metal',12);C.cyl(g,0,2.13,0,.72,.72,.04,'wood',12);
    },ry);
  }
  function crates(f,x,z){
    return prop(f,'supply-crates',x,z,g=>{
      for(let i=0;i<4;i++){let xx=(i%2-.5)*2.2,zz=(Math.floor(i/2)-.5)*2.2;B(g,xx,.85,zz,2,1.7,2,'wood');B(g,xx,1.76,zz,2,.12,2,'woodLight');B(g,xx,.85,zz+1.03,1.7,.12,.08,'metal');}B(g,.4,2.6,.2,1.8,1.65,1.8,'woodLight');
    });
  }
  function basin(f,x,z,w=10,d=6,kind='bath'){return prop(f,kind,x,z,g=>{
    B(g,0,.18,0,w,.36,d,'stoneCool');for(let side of [-1,1]){B(g,side*(w/2-.2),.85,0,.4,1.3,d,'stoneLight');B(g,0,.85,side*(d/2-.2),w-.8,1.3,.4,'stoneLight');}B(g,0,.65,0,w-.85,.08,d-.85,'water');
    if(kind==='bath'){C.cyl(g,w*.28,1.5,-d/2,.08,.08,1,'copper',8);C.beam(g,[w*.28,1.95,-d/2],[w*.28,1.95,-d/2+.9],.09,'copper',8);}
  });}
  function stove(f,x,z){return prop(f,'medieval-hearth',x,z,g=>{
    B(g,0,1.25,0,6,2.5,3,'agedStone');B(g,0,2.7,0,6.3,.35,3.3,'metal');
    for(let xx of [-1.8,0,1.8]){C.cyl(g,xx,3.15,0,.66,.5,.65,'copper',12);C.cyl(g,xx,3.55,0,.7,.7,.08,'metal',12);}
    for(let xx of [-1.75,1.75]){B(g,xx,1.1,1.54,1.3,1.2,.1,'roofDark');C.cone(g,xx,.95,1.65,.32,.75,'emissive',8);}
    B(g,0,4,-1.2,3.2,2.4,.8,'stone');
  });}
  function rack(f,x,z,kind='armor',ry=0){return prop(f,kind+'-rack',x,z,g=>{
    B(g,0,.2,0,7,.4,2.4,'wood');for(let xx of [-3,3])B(g,xx,2.3,0,.18,4.6,.18,'wood');B(g,0,4.5,0,6.5,.16,.18,'woodLight');
    for(let k=0;k<5;k++){let xx=(k-2)*1.1;if(kind==='armor'){B(g,xx,2.7,0,.65,1,.25,'metal');C.sphere(g,xx,3.65,0,.3,'metal',8);}else{C.beam(g,[xx,.5,0],[xx,4,0],.045,'woodLight',6);C.cone(g,xx,4.2,0,.13,.45,'metal',6);}}
  },ry);}
  function artwork(f,x,z,ry=0,kind='painting'){return prop(f,kind,x,z,g=>{
    B(g,0,2.4,0,3.6,4.8,.25,'wood');B(g,0,2.5,.16,3.2,4.25,.1,'gold');B(g,0,2.5,.23,2.9,3.95,.05,kind==='tapestry'?'burgundy':'stainedTeal');
    C.cyl(g,0,1.3,.3,.36,.7,1.3,'stoneLight',8);C.sphere(g,0,2.2,.33,.55,'trim',8);C.cone(g,0,3.25,.32,.9,1.35,'gold',6);
  },ry);}
  function statue(f,x,z,kind='statue'){return prop(f,kind,x,z,g=>{
    C.cyl(g,0,.5,0,1.2,1.5,1,'stoneCool',10);C.cyl(g,0,2.5,0,.55,1.1,3,'trim',10);C.sphere(g,0,4.5,0,.65,'stoneLight',10);C.beam(g,[-.25,3.3,0],[-1.35,3.5,.4],.18,'stoneLight',6);C.beam(g,[.25,3.3,0],[1.35,3.5,.4],.18,'stoneLight',6);
  });}
  function chest(f,x,z,ry=0){return prop(f,'treasure-chest',x,z,g=>{
    B(g,0,.9,0,3.6,1.8,2.4,'wood');B(g,0,1.96,0,3.7,.3,2.5,'woodLight');for(let xx of [-1.25,1.25])B(g,xx,1.05,0,.18,2.1,2.6,'gold');B(g,0,1.2,1.32,.35,.5,.1,'gold');
  },ry);}
  function bench(f,x,z,ry=0){return prop(f,'bench',x,z,g=>{
    B(g,0,.8,0,4.8,.25,1.25,'woodLight');B(g,0,1.35,-.5,4.8,1,.14,'wood');for(let xx of [-1.8,1.8])B(g,xx,.4,0,.22,.8,1,'wood');
  },ry);}
  function armillary(f,x,z){return prop(f,'armillary-sphere',x,z,g=>{
    C.cyl(g,0,.2,0,1.5,1.9,.4,'stoneLight',12);C.cyl(g,0,1.4,0,.2,.45,2.3,'gold',10);C.sphere(g,0,3.1,0,.7,'glassBlue',12);
    for(let i=0;i<3;i++){const q=C.mesh(g,new T.TorusGeometry(1.6,.055,4,20),'gold',0,3.1,0);q.rotation.set(i===0?PI/2:.3,i*PI/3,.3);}
    C.beam(g,[-.8,1.6,0],[.8,4.6,0],.05,'gold',6);
  });}
  function rug(f,x,z,w,d,color='carpet'){return prop(f,'woven-rug',x,z,g=>{
    B(g,0,.04,0,w,.07,d,'gold');B(g,0,.085,0,w-.2,.02,d-.2,color);
    for(let xx of [-w/2+.4,w/2-.4])B(g,xx,.106,0,.05,.015,d-.6,'linen');
  },0,false);}
  function spots(r){
    if(r.placement==='north')return[[r.x-r.w*.28,r.z],[r.x+r.w*.28,r.z]];
    if(r.placement==='side')return r.d>50?[[r.x-10,r.crossZ-17],[r.x+10,r.crossZ-17],[r.x-10,r.crossZ+17],[r.x+10,r.crossZ+17]]:[[r.x-10,-247],[r.x+10,-247]];
    return[[r.x-r.w*.27,r.z-7],[r.x+r.w*.27,r.z-7],[r.x-r.w*.27,r.z+7],[r.x+r.w*.27,r.z+7]];
  }
  for(const r of functional){
    const f=r.floor,p=spots(r),a=p[0],b=p[1],c=p[2]||[a[0],a[1]+5],d=p[3]||[b[0],b[1]+5];
    switch(r.kind){
      case'stairs':break;
      case'library':case'archive':{
        const xs=r.placement==='north'?[r.x-31,r.x-18,r.x+18,r.x+31]:[r.x-12,r.x+10];
        const bz=r.placement==='north'?r.z-8:r.crossZ-20;
        for(let x of xs)bookcase(f,x,bz,7,4.8);
        table(f,a[0],r.placement==='north'?r.z+2:r.crossZ+16,8,3,'desk',2);
        table(f,b[0],r.placement==='north'?r.z+2:r.crossZ+16,8,3,'desk',2);break;
      }
      case'maps':case'study':case'council':case'war':{
        table(f,a[0],a[1],r.kind==='war'?11:8,4,r.kind==='council'?'council':'map-table',4);
        table(f,b[0],b[1],8,3,'desk',2);bookcase(f,c[0],c[1]+(r.placement==='north'?-7:0),6,4.4);
        if(r.placement==='side'&&r.d>50)rack(f,d[0],d[1],r.kind==='war'?'spears':'armor');break;
      }
      case'banquet':{
        table(f,r.x,r.crossZ-17,22,3.3,'banquet',20);table(f,r.x,r.crossZ+17,22,3.3,'banquet',20);
        cabinet(f,r.x-20,r.crossZ-20,5);cabinet(f,r.x-20,r.crossZ+20,5);break;
      }
      case'kitchen':{
        stove(f,r.x-7,r.crossZ-19);stove(f,r.x+9,r.crossZ-19);table(f,r.x,r.crossZ+17,18,4,'prep-table',0);
        for(let i=0;i<4;i++)barrel(f,r.x-17+i*3.5,r.crossZ+23);break;
      }
      case'pantry':case'cellar':{
        for(let x of [a[0],b[0]])for(let z of [a[1]-3,a[1]+3,c[1]])barrel(f,x,z);
        crates(f,c[0],c[1]+5);crates(f,d[0],d[1]+5);break;
      }
      case'workshop':{
        table(f,a[0],a[1],8,3,'workbench',0);table(f,b[0],b[1],8,3,'workbench',0);rack(f,c[0],c[1],'spears');crates(f,d[0],d[1]);break;
      }
      case'cistern':{basin(f,r.x,r.crossZ-17,22,11,'cistern');basin(f,r.x,r.crossZ+17,22,11,'cistern');break;}
      case'bath':{basin(f,a[0],r.z,7,9);basin(f,b[0],r.z,7,9);bench(f,a[0],r.z+11);cabinet(f,b[0],r.z-12,5,'linen-cabinet');break;}
      case'laundry':{basin(f,a[0],a[1],6,5,'wash-basin');table(f,b[0],b[1],8,3,'laundry-table',0);cabinet(f,c[0],c[1],6,'linen-cabinet');cabinet(f,d[0],d[1],6,'linen-cabinet');break;}
      case'wardrobe':{
        for(let x of [a[0],b[0]])for(let z of [r.z-10,r.z+10])cabinet(f,x,z,6,'wardrobe',z<r.z?0:PI);bench(f,a[0],r.z);bench(f,b[0],r.z);break;
      }
      case'royalbed':{
        bed(f,r.x+9,r.crossZ-18,true);rug(f,r.x+9,r.crossZ-18,12,14);table(f,r.x+8,r.crossZ+17,8,3,'desk',4);cabinet(f,r.x-16,r.crossZ-20,7,'wardrobe');cabinet(f,r.x-16,r.crossZ+20,7,'wardrobe');break;
      }
      case'guest':{
        bed(f,a[0],a[1],false);bed(f,b[0],b[1],false);
        cabinet(f,a[0],a[1]+8,5,'wardrobe');cabinet(f,b[0],b[1]+8,5,'wardrobe');break;
      }
      case'barracks':case'infirmary':{
        for(let q of p){bed(f,q[0],q[1],false);if(r.placement==='north')bed(f,q[0]+7,q[1],false);}
        cabinet(f,r.placement==='north'?r.x-10:c[0],r.placement==='north'?r.z-8:c[1]+5,5,r.kind==='infirmary'?'medicine-cabinet':'equipment-cabinet');break;
      }
      case'reception':case'guard':{
        table(f,a[0],a[1],8,3,r.kind==='guard'?'map-table':'reception-table',4);bench(f,c[0],c[1]);bench(f,d[0],d[1]);if(r.kind==='guard')rack(f,b[0],b[1],'armor');else statue(f,b[0],b[1]);break;
      }
      case'armory':{
        for(let q of p)rack(f,q[0],q[1],q===a||q===d?'armor':'spears');table(f,r.x+9,r.crossZ+24,7,3,'workbench',0);break;
      }
      case'treasury':{
        for(let q of p){chest(f,q[0]-3,q[1]);chest(f,q[0]+3,q[1]);}
        for(let q of [a,b])prop(f,'jewel-display',q[0],q[1]+6,g=>{B(g,0,.8,0,3,1.6,3,'stoneCool');B(g,0,1.7,0,3.2,.15,3.2,'gold');C.mesh(g,new T.OctahedronGeometry(.7,0),'stainedRuby',0,2.6,0);});break;
      }
      case'astronomy':{armillary(f,a[0],a[1]);armillary(f,b[0],b[1]);table(f,a[0]+9,a[1],6,3,'map-table',2);bookcase(f,b[0]+10,b[1]-8,6,4);break;}
      case'gallery':case'art':{
        for(let q of p){artwork(f,q[0],q[1],0,r.placement==='south'?'tapestry':'painting');statue(f,q[0]+5,q[1]);}break;
      }
      case'music':{
        prop(f,'court-harp',a[0],a[1],g=>{B(g,0,.2,0,3.6,.4,2,'wood');C.beam(g,[-1.4,.4,0],[-.8,4.8,0],.16,'gold',8);C.beam(g,[1.3,.4,0],[1.3,4.2,0],.16,'woodLight',8);C.beam(g,[-.8,4.8,0],[1.3,4.2,0],.16,'gold',8);for(let i=0;i<7;i++){let x=-.7+i*.28;C.beam(g,[x,.5,0],[x,4.75-i*.08,0],.014,'gold',4);}});
        table(f,b[0],b[1],7,3,'music-desk',4);bench(f,c[0],c[1]+4);break;
      }
      case'delivery':{crates(f,a[0],a[1]);crates(f,b[0],b[1]);table(f,c[0],c[1],11,4,'prep-table',0);table(f,d[0],d[1],11,4,'prep-table',0);break;}
    }
  }
  // Readable scale and rested circulation: furniture stays at the edge of corridors.
  for(let f=0;f<4;f++){
    for(let side of [-1,1]){
      bench(f,side*77.8,-215,side<0?PI/2:-PI/2);bench(f,side*77.8,-246,side<0?PI/2:-PI/2);
      bench(f,side*118,-301.9,0);artwork(f,side*57,-302.8,0,'tapestry');
      column(f,side*121,-295,NEXT[f]-FY[f]-2,.55);
    }
  }
  for(let x of [-26,26]){statue(1,x,-132);column(1,x,-157,19,.7);}
  // Courtyard ground paths are separate non-overlapping slabs; upper floors never span it.
  const court=C.group('Courtyard_Garden_And_Cloister_Floor',L[1]),courtAreas=[];
  function courtPlate(id,x0,x1,z0,z1,mat='path',top=42){B(court,(x0+x1)/2,top-.28,(z0+z1)/2,x1-x0,.56,z1-z0,mat);courtAreas.push(rect(x0,x1,z0,z1));const data={id:'courtyard-'+id,floor:1,x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,topY:top,bottomY:top-.56,courtyard:true};if(top===42)M.slabs.push(data);else(M.landscape||(M.landscape=[])).push({...data,walkable:false});}
  courtPlate('west-cloister',-68,-58,-292,-168);courtPlate('east-cloister',58,68,-292,-168);
  courtPlate('south-cloister',-58,58,-178,-168);courtPlate('north-cloister',-58,58,-292,-282);
  courtPlate('north-axis',-6,6,-282,-244);courtPlate('south-axis',-6,6,-216,-178);
  courtPlate('west-axis',-58,-14,-236,-224);courtPlate('east-axis',14,58,-236,-224);courtPlate('fountain-square',-14,14,-244,-216,'stoneLight');
  for(let side of [-1,1])for(let zi=0;zi<2;zi++){
    const x0=side<0?-55:16,x1=side<0?-16:55,z0=zi===0?-279:-221,z1=zi===0?-239:-181;
    courtPlate('garden-'+side+'-'+zi,x0,x1,z0,z1,'soil',41.8);
    for(let xx of [x0+.4,x1-.4])B(court,xx,42.6,(z0+z1)/2,.8,1.2,z1-z0,'hedge');
    for(let zz of [z0+.4,z1-.4])B(court,(x0+x1)/2,42.6,zz,x1-x0-1.6,1.2,.8,'hedge');
    for(let xx of [x0+8,x1-8])for(let zz of [z0+9,z1-9]){
      C.tree(court,xx,41.8,zz,.8,'cypress');
      for(let k=0;k<4;k++){let a=k*PI/2;C.sphere(court,xx+Math.cos(a)*1.8,42.1,zz+Math.sin(a)*1.8,.35,k%2?'flowerRose':'flowerIvory',7);}
    }
    C.cyl(court,(x0+x1)/2,42.5,(z0+z1)/2,3,3.4,1.4,'stoneLight',16);
    C.cyl(court,(x0+x1)/2,43.22,(z0+z1)/2,2.65,2.65,.1,'grassLight',16);
  }
  // Fill the remaining garden ground with disjoint lawn panels; no floating benches or coplanar overlaps.
  let lawns=[rect(-68,68,-292,-168)];for(const occupied of courtAreas)lawns=lawns.flatMap(p=>subtract(p,occupied));lawns.forEach((r,i)=>courtPlate('lawn-'+i,r.x0,r.x1,r.z0,r.z1,'grassLight'));
  // The fountain leaves an 8m+ walk around its rim inside a 28m square.
  C.cyl(court,0,42.35,-230,6,6.4,.7,'stoneCool',32);C.cyl(court,0,42.75,-230,5.5,5.5,.12,'water',32);
  C.cyl(court,0,43.2,-230,.8,1.3,1.7,'trim',16);C.cyl(court,0,44.15,-230,2.8,1.6,.45,'stoneLight',24);C.cyl(court,0,44.4,-230,2.5,2.5,.08,'water',24);
  C.cyl(court,0,45.25,-230,.35,.7,1.7,'gold',12);C.sphere(court,0,46.35,-230,.6,'gold',12);
  for(let k=0;k<8;k++){let a=k*PI/4;C.beam(court,[Math.cos(a)*2.2,44.35,-230+Math.sin(a)*2.2],[Math.cos(a)*3.1,42.85,-230+Math.sin(a)*3.1],.055,'foam',5);}
  for(let x of [-11,11])for(let z of [-255,-205])bench(1,x,z,x<0?PI/2:-PI/2);
  noteRoom(1,'courtyard','사계 정원·열주 회랑',0,-230,136,124,'courtyard');
  path(1,'F1-courtyard-entry',[[0,-164],[0,-168]],5);
  path(1,'courtyard-perimeter',[[-63,-173],[63,-173],[63,-287],[-63,-287],[-63,-173]],4);
  path(1,'courtyard-central-route',[[0,-168],[0,-216],[9,-216],[9,-244],[0,-244],[0,-292]],4);
  path(1,'courtyard-cross-route',[[-63,-230],[-14,-230],[-14,-221],[14,-221],[14,-230],[63,-230]],4);
  for(let z of [-200,-260])for(let side of [-1,1])path(1,'courtyard-side-access-'+side+'-'+z,[[side*74,z],[side*63,z]],4);
  // Collect actual authored prop bounds after placement, for root's route QA.
  C.root.updateMatrixWorld(true);
  for(const p of propGroups){const b=new T.Box3().setFromObject(p.g);M.furniture.push({id:p.id,floor:p.floor,kind:p.kind,blocksWalk:p.blocksWalk,min:b.min.toArray(),max:b.max.toArray(),x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,w:b.max.x-b.min.x,d:b.max.z-b.min.z});}
  M.summary={functionalRooms:M.rooms.filter(r=>!['corridor','courtyard','stairs','atrium'].includes(r.kind)).length,stairConnections:M.stairs.length,courtyardOpenAbove:42,atriumOpenFrom:64,hasGameplayPhysics:false};
}

  global.HanQCitadelAuthored={version:'baegwol-v3',
    createContext:function(THREE,root,textureFactory){return createCastleContext(root,THREE,textureFactory);},
    stages:[
      {label:'성벽과 구시가를 복원하는 중',build:buildEnvironment},
      {label:'구왕성과 첨탑을 복원하는 중',build:buildPalace},
      {label:'구왕성의 실내를 복원하는 중',build:buildInteriors},
      {label:'확장 성곽과 도시를 복원하는 중',build:buildExpansionEnvironment},
      {label:'백월 대왕궁을 복원하는 중',build:buildExpansionPalace},
      {label:'지하층과 왕실 회랑을 연결하는 중',build:buildExpansionInteriors}
    ]
  };
})(window);
