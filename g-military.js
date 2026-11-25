'use strict';
/* Original KESTREL and TEMPEST GLB visuals. Metres; +X forward, +Y up, +Z right.
 * Rendering-only state lives here. Simulation, damage, ammo and saved vehicle IDs stay in g-royale.
 */
(function(global){
  const VERSION='military-20261118-v1';
  const WHEELS=['Wheel_FL','Wheel_FR','Wheel_ML1','Wheel_MR1','Wheel_ML2','Wheel_MR2','Wheel_RL','Wheel_RR'];
  const defs=Object.freeze({
    helicopter:Object.freeze({kind:'helicopter',name:'KESTREL K-27',assetPath:'vehicles/military/kestrel_heli_lod1.glb',
      groundOffset:0,driverSeat:Object.freeze({forward:1.18,left:.44,height:1.43}),
      driverPose:Object.freeze({scale:.92,recline:.08,hipDrop:0}),cameraDistance:13.5,cameraHeight:4.0,
      wheelRadius:0,requiredNodes:['Main_Rotor','Tail_Rotor','Seat_Driver']}),
    mlrs:Object.freeze({kind:'mlrs',name:'TEMPEST M-12',assetPath:'vehicles/military/tempest_mlrs_lod1.glb',
      groundOffset:.002,driverSeat:Object.freeze({forward:2.72,left:.58,height:1.85}),
      driverPose:Object.freeze({scale:.92,recline:.08,hipDrop:0}),cameraDistance:11.0,cameraHeight:3.7,
      wheelRadius:.60,requiredNodes:['Launcher_Yaw','Launcher_Pitch','Seat_Driver',...WHEELS,...Array.from({length:12},(_,i)=>'Muzzle_'+String(i).padStart(2,'0'))]})
  });
  const definition=kind=>typeof kind==='string'&&Object.prototype.hasOwnProperty.call(defs,kind)?defs[kind]:null;
  const caches=new WeakMap();
  function template(T,def,loadGLB){
    let cache=caches.get(T);if(!cache){cache=new Map();caches.set(T,cache);}
    if(!cache.has(def.kind))cache.set(def.kind,Promise.resolve().then(()=>loadGLB(def.assetPath)).then(result=>{
      const scene=result?.scene||result;
      if(!scene?.isObject3D)throw Error('Invalid military GLB: '+def.kind);
      for(const name of def.requiredNodes)if(!scene.getObjectByName(name))throw Error('Missing military rig node: '+name);
      scene.traverse(o=>{
        if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
        for(const mat of Array.isArray(o.material)?o.material:[o.material]){
          if(mat.isMeshStandardMaterial)mat.envMapIntensity=.85;
          if(mat.transparent){mat.depthWrite=false;o.castShadow=false;}
        }
      });
      return scene;
    }));
    return cache.get(def.kind);
  }
  function fallback(T,def){
    const group=new T.Group();group.name='Military_Proxy_'+def.kind;
    const geometries=[],materials=[],paint=new T.MeshLambertMaterial({vertexColors:true});materials.push(paint);
    const color=new T.Color(),matrix=new T.Matrix4(),quaternion=new T.Quaternion(),axisZ=new T.Vector3(0,0,1);
    const parts=[];
    function part(geometry,x,y,z,sx,sy,sz,tint,rotation=0){
      quaternion.setFromAxisAngle(axisZ,rotation);matrix.compose(new T.Vector3(x,y,z),quaternion,new T.Vector3(sx,sy,sz));
      parts.push([geometry,matrix.clone(),tint]);
    }
    function box(x,y,z,w,h,d,tint){part(new T.BoxGeometry(1,1,1),x,y,z,w,h,d,tint);}
    function batch(parent,name){
      const pos=[],nor=[],colors=[];
      for(const [source,m,tint]of parts){
        const g=source.index?source.toNonIndexed():source.clone();g.applyMatrix4(m);color.set(tint);
        const p=g.attributes.position,n=g.attributes.normal;
        for(let i=0;i<p.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));nor.push(n.getX(i),n.getY(i),n.getZ(i));colors.push(color.r,color.g,color.b);}
        g.dispose();source.dispose();
      }
      parts.length=0;
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(nor,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeBoundingSphere();geometries.push(geo);
      const mesh=new T.Mesh(geo,paint);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
    }
    const rigs={};
    if(def.kind==='helicopter'){
      part(new T.SphereGeometry(1,12,8),.05,1.75,0,3.65,.90,1.12,'#536971');
      part(new T.SphereGeometry(1,10,6),2.38,1.87,0,1.25,.70,.97,'#234654');
      part(new T.ConeGeometry(1,1,8),-4.75,2.1,0,.40,5.8,.45,'#536971',Math.PI/2);
      box(-7.13,2.82,0,.47,1.8,.13,'#536971');box(-6.13,2.08,0,.85,.12,2.6,'#536971');
      for(const side of[-1,1]){
        box(-.52,2.85,side*.55,2.7,.58,.67,'#35474b');box(-.02,.18,side*1.25,5.9,.16,.16,'#28343a');
        for(const x of[-1.6,1.35])box(x,.69,side*1.03,.14,1.0,.14,'#28343a');
      }
      box(-.55,3.28,0,.18,.8,.18,'#414b50');batch(group,'Helicopter_Proxy_Body');
      const main=new T.Group();main.position.set(-.55,3.76,0);group.add(main);rigs.main=main;
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2,c=Math.cos(a),s=Math.sin(a);
        const geo=new T.BoxGeometry(3.9,.055,.26),m=new T.Matrix4().makeRotationY(a);m.setPosition(c*2.35,0,-s*2.35);parts.push([geo,m,'#26323a']);
      }
      batch(main,'Helicopter_Proxy_Main_Rotor');
      const tail=new T.Group();tail.position.set(-7.05,2.90,.46);group.add(tail);rigs.tail=tail;
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2,m=new T.Matrix4().makeRotationZ(a);m.setPosition(Math.cos(a)*.49,Math.sin(a)*.49,0);parts.push([new T.BoxGeometry(.94,.10,.04),m,'#26323a']);
      }
      batch(tail,'Helicopter_Proxy_Tail_Rotor');
    }else{
      box(0,1.05,0,8.15,.75,2.68,'#48584d');box(2.65,2.05,0,2.40,1.80,2.62,'#60705c');
      box(3.87,2.40,0,.035,.70,2.12,'#233c47');box(0,1.36,0,7.25,.22,2.88,'#34413a');
      box(-.35,1.60,1.38,2.0,.72,.25,'#65715a');box(-.35,1.60,-1.38,2.0,.72,.25,'#65715a');
      for(const x of[-3.15,-1.65,1.45,2.95])for(const z of[-1.38,1.38]){
        const m=new T.Matrix4().makeRotationX(Math.PI/2);m.setPosition(x,.60,z);parts.push([new T.CylinderGeometry(.60,.60,.40,12),m,'#1f2528']);
      }
      batch(group,'MLRS_Proxy_Chassis');
      const yaw=new T.Group();yaw.position.set(-1.45,1.88,0);group.add(yaw);rigs.yaw=yaw;
      const pitch=new T.Group();pitch.position.x=-1.55;yaw.add(pitch);rigs.pitch=pitch;
      box(1.75,.15,0,3.8,.30,2.45,'#303d38');
      for(let row=0;row<3;row++)for(let col=0;col<4;col++){
        const y=.52+row*.48,z=(col-1.5)*.55;
        box(1.72,y,z,3.55,.43,.49,'#59674f');box(3.506,y,z,.025,.30,.35,'#121e23');
      }
      batch(pitch,'MLRS_Proxy_Launcher');
    }
    return {group,rigs,dispose(){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
  }
  function create(T,kind,options={}){
    const def=definition(kind);if(!def)throw Error('Unknown military model: '+kind);
    const group=new T.Group();group.name=def.name;group.userData.alliedKind=kind;
    const proxy=fallback(T,def);group.add(proxy.group);
    const originals=new Map(),axisY=new T.Vector3(0,1,0),axisZ=new T.Vector3(0,0,1),q=new T.Quaternion();
    let ownedWreck=null;const wreck=options.wreckMaterial||(ownedWreck=new T.MeshLambertMaterial({color:0x3e3c37}));
    let alive=true,detailed=null,rig={},far=false,lastDead=null;
    const state={rotor:0,wheelTravel:0,steer:0,aimYaw:0,aimElevation:.16,dead:false};
    function rotation(item,axis,angle){if(item)item.node.quaternion.copy(item.rest).multiply(q.setFromAxisAngle(axis,angle));}
    function apply(){
      if(kind==='helicopter'){
        proxy.rigs.main.rotation.y=state.rotor;proxy.rigs.tail.rotation.z=-state.rotor*2.8;
        rotation(rig.main,axisY,state.rotor);rotation(rig.tail,axisZ,-state.rotor*2.8);
      }else{
        proxy.rigs.yaw.rotation.y=state.aimYaw;proxy.rigs.pitch.rotation.z=state.aimElevation;
        rotation(rig.yaw,axisY,state.aimYaw);rotation(rig.pitch,axisZ,state.aimElevation);
        for(const wheel of rig.wheels||[]){
          wheel.node.quaternion.copy(wheel.rest);
          if(wheel.front)wheel.node.quaternion.multiply(q.setFromAxisAngle(axisY,-state.steer*.35));
          wheel.node.quaternion.multiply(q.setFromAxisAngle(axisZ,-state.wheelTravel/def.wheelRadius));
        }
      }
      if(detailed)detailed.visible=!far;proxy.group.visible=!detailed||far;
      if(lastDead!==state.dead){group.traverse(o=>{if(!o.isMesh)return;if(!originals.has(o))originals.set(o,o.material);o.material=state.dead?wreck:originals.get(o);});lastDead=state.dead;}
    }
    const api={group,kind,definition:def,status:'loading',ready:null,
      update(input={}){
        if(!alive)return;
        for(const name of['rotor','wheelTravel','steer','aimYaw','aimElevation'])if(Number.isFinite(input[name]))state[name]=input[name];
        // MLRS launchers follow the computed upward ballistic launch angle;
        // both detailed and proxy rigs share it, even for a nearby landing point.
        state.steer=Math.max(-1,Math.min(1,state.steer));state.aimElevation=Math.max(-.55,Math.min(kind==='mlrs'?Math.PI/2:.65,state.aimElevation));state.dead=!!input.dead;
        if(Number.isFinite(input.distance)){const limit=input.quality==='low'?110:180;far=input.distance>limit+(far?-12:12);}
        apply();
      },
      getAnchor(name,target=new T.Vector3()){
        if(!detailed)return null;const node=detailed.getObjectByName(name);if(!node)return null;
        group.updateWorldMatrix(true,true);return node.getWorldPosition(target);
      },
      dispose(){
        if(!alive)return;alive=false;api.status='disposed';group.removeFromParent();group.clear();proxy.dispose();if(ownedWreck)ownedWreck.dispose();originals.clear();detailed=null;rig={};
      }
    };
    api.ready=(typeof options.loadGLB==='function'?template(T,def,options.loadGLB):Promise.reject(Error('No military GLB loader'))).then(scene=>{
      if(!alive)return false;
      detailed=scene.clone(true);detailed.name='Military_Detail';detailed.position.y+=def.groundOffset;group.add(detailed);
      const bind=name=>{const node=detailed.getObjectByName(name);return {node,rest:node.quaternion.clone()};};
      if(kind==='helicopter')rig={main:bind('Main_Rotor'),tail:bind('Tail_Rotor')};
      else rig={yaw:bind('Launcher_Yaw'),pitch:bind('Launcher_Pitch'),wheels:WHEELS.map((name,i)=>({...bind(name),front:i<4}))};
      lastDead=null;api.status='ready';apply();return true;
    }).catch(error=>{if(!alive)return false;api.status='fallback';api.error=String(error?.message||error);if(typeof options.onError==='function')options.onError(error);return false;});
    return api;
  }
  global.HanQMilitary=Object.freeze({version:VERSION,defs,definition,create});
})(typeof window!=='undefined'?window:globalThis);

