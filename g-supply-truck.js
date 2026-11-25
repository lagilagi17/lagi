/* FIELDLINE 6x6 — native ammunition and medical support truck.
 * Original procedural artwork. Metres, +X forward, Y up. Three.js r160.
 * Shared immutable geometry, owner-local materials and a bounded distant LOD.
 */
(function (host) {
  'use strict';
  const REVISION = 'supply-truck-20261124-v1';
  const DEFINITION = Object.freeze({
    kind:'truck', name:'보급트럭', label:'탄약·의료 보급트럭', groundOffset:0, groundPlaneY:0,
    cameraDistance:14, cameraHeight:5.3, collisionRadius:2.01, collisionOffset:2.61,
    hitHeight:3.55, wheelRadius:.70,
    driverSeat:Object.freeze({forward:2.71,height:2.015,left:.745}),
    driverPose:Object.freeze({scale:1,recline:.06,hipDrop:0})
  });
  const CACHE = new WeakMap();
  const C = Object.freeze({
    paint:0x50645b, edge:0x738275, dark:0x27342f, steel:0x8d9990, black:0x18201e,
    rubber:0x202625, tread:0x303632, canvas:0x788174, canvasDark:0x59665b,
    glass:0x4e7783, wood:0x8c7651, strap:0xb1a384, cream:0xe0e5d6,
    teal:0x54c5b1, tealDark:0x246c63, amber:0xefb867, red:0xb5493c, lamp:0xf4e8c3
  });
  const finite = (v, fallback=0) => Number.isFinite(v) ? v : fallback;

  function buildCache(T) {
    const raw = new Set(), geometries = new Set(), partCounts = Object.create(null);
    const keep = g => (raw.add(g), g);
    const boxGeo=keep(new T.BoxGeometry(1,1,1)), cylinderGeo=keep(new T.CylinderGeometry(1,1,1,16,1)),
      fineCylinder=keep(new T.CylinderGeometry(1,1,1,24,1)), lowCylinder=keep(new T.CylinderGeometry(1,1,1,10,1)),
      torusGeo=keep(new T.TorusGeometry(.54,.13,7,24)), steeringGeo=keep(new T.TorusGeometry(.22,.025,6,16));
    const transform=new T.Object3D(), color=new T.Color(), v=new T.Vector3(), normal=new T.Vector3(), normalMatrix=new T.Matrix3();
    function builder() {
      const buckets=new Map();
      function add(geometry, material, tint, x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,name='') {
        let out=buckets.get(material);
        if(!out){out={position:[],normal:[],color:[]};buckets.set(material,out);}
        transform.position.set(x,y,z);transform.scale.set(sx,sy,sz);transform.rotation.set(rx,ry,rz);transform.updateMatrix();
        normalMatrix.getNormalMatrix(transform.matrix);color.setHex(tint);
        const p=geometry.attributes.position,n=geometry.attributes.normal,sourceColor=geometry.attributes.color,ix=geometry.index,count=ix?ix.count:p.count;
        for(let i=0;i<count;i++){
          const k=ix?ix.getX(i):i;
          v.fromBufferAttribute(p,k).applyMatrix4(transform.matrix);
          normal.fromBufferAttribute(n,k).applyNormalMatrix(normalMatrix);
          out.position.push(v.x,v.y,v.z);out.normal.push(normal.x,normal.y,normal.z);
          // Restrained baked variation keeps the large canvas and body readable
          // without extra maps, lights, decals or per-frame surface work.
          const shade=material==='light'||material==='glass'?1:.94+.04*Math.sin(v.x*7.1+v.y*3.6+v.z*4.3)+Math.max(0,normal.y)*.035;
          out.color.push(sourceColor?sourceColor.getX(k)*color.r:color.r*shade,sourceColor?sourceColor.getY(k)*color.g:color.g*shade,sourceColor?sourceColor.getZ(k)*color.b:color.b*shade);
        }
        if(name)partCounts[name]=(partCounts[name]||0)+1;
      }
      const box=(name,material,tint,x,y,z,l,h,w,rx=0,ry=0,rz=0)=>add(boxGeo,material,tint,x,y,z,l,h,w,rx,ry,rz,name);
      function cylinder(name,material,tint,x,y,z,r,length,axis='y',low=false){
        add(low?lowCylinder:cylinderGeo,material,tint,x,y,z,r,length,r,axis==='z'?Math.PI/2:0,0,axis==='x'?Math.PI/2:0,name);
      }
      function beam(name,material,tint,a,b,r=.03){
        const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);
        const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize()),e=new T.Euler().setFromQuaternion(q);
        add(cylinderGeo,material,tint,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,d.length(),r,e.x,e.y,e.z,name);
      }
      function panel(name,material,tint,points){
        const positions=[];
        for(let i=1;i<points.length-1;i++)positions.push(...points[0],...points[i],...points[i+1]);
        const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
        add(geometry,material,tint,0,0,0,1,1,1,0,0,0,name);geometry.dispose();
      }
      function finish(prefix){
        return [...buckets].map(([material,data])=>{
          const geometry=new T.BufferGeometry();
          for(const key of ['position','normal','color'])geometry.setAttribute(key,new T.Float32BufferAttribute(data[key],3));
          geometry.computeBoundingBox();geometry.computeBoundingSphere();
          geometry.userData={supplyTruckShared:true,revision:REVISION};geometries.add(geometry);
          return {name:prefix+'_'+material,material,geometry};
        });
      }
      return {add,box,cylinder,beam,panel,finish};
    }
    function canopy(b,detail){
      const points=[[-1.39,2.12],[-1.39,2.72],[-1.16,3.16],[-.67,3.39],[0,3.46],[.67,3.39],[1.16,3.16],[1.39,2.72],[1.39,2.12]];
      const rear=-3.61,front=1.01;
      for(let i=0;i<points.length-1;i++){
        const [za,ya]=points[i],[zb,yb]=points[i+1];
        b.panel('canvas_cover','canvas',i%2?C.canvas:C.canvasDark,[[rear,ya,za],[front,ya,za],[front,yb,zb],[rear,yb,zb]]);
      }
      b.panel('canvas_front','canvas',C.canvasDark,points.map(([z,y])=>[front,y,z]));
      b.cylinder('rolled_rear_cover','canvas',C.canvas,-3.63,3.29,0,.115,2.59,'z');
      if(detail)for(const x of [-3.60,-2.45,-1.3,-.15,1]){
        for(let i=0;i<points.length-1;i++){
          const [za,ya]=points[i],[zb,yb]=points[i+1];
          b.beam('canopy_ribs','metal',C.canvasDark,[x,ya+.015,za*1.008],[x,yb+.015,zb*1.008],.018);
        }
      }
    }
    function medCross(b,x,y,z,onSide=false,scale=1){
      // Generic teal first-aid symbol. No protected red-cross insignia.
      b.box('medical_symbol','paint',C.teal,x,y,z,onSide?.47*scale:.018,.13*scale,onSide?.018:.47*scale);
      b.box('medical_symbol','paint',C.teal,x,y,z,onSide?.13*scale:.019,.47*scale,onSide?.019:.13*scale);
    }
    function cargoCase(b,x,z,medical,detail,stack=0){
      const y=1.99+stack*.61,base=medical?C.cream:C.paint;
      b.box(medical?'medical_case':'ammunition_crate','paint',base,x,y,z,1.13,.55,.76);
      b.box('case_lid','paint',medical?0xf0f0de:C.edge,x,y+.27,z,1.17,.085,.8);
      b.box('case_reinforcement','metal',C.dark,x-.43,y,z, .055,.57,.79);
      b.box('case_reinforcement','metal',C.dark,x+.43,y,z, .055,.57,.79);
      if(medical)medCross(b,x-.575,y,z,false,.67);
      else b.box('ammunition_band','paint',C.amber,x-.574,y,z,.018,.12,.48);
      if(detail){
        for(const side of [-1,1]){
          b.box('case_carry_handle','metal',C.black,x,y+.05,z+side*.398,.32,.07,.035);
          for(const at of [-.36,.36])b.box('case_latch','metal',C.steel,x+at,y+.2,z+side*.41,.07,.17,.025);
        }
      }
    }
    function body(detail){
      const b=builder();
      const {box,cylinder,beam,panel}=b;
      // Six-wheel ladder chassis, springs and exposed rear step.
      box('chassis','metal',C.dark,0,.97,0,7.7,.32,2.22);
      for(const z of [-.91,.91])box('chassis_rail','metal',C.black,0,.88,z,7.72,.27,.16);
      for(const x of [2.58,-.88,-2.72]){
        cylinder('axle','metal',C.dark,x,.70,0,.13,2.94,'z',!detail);
        if(detail){box('differential','metal',C.black,x,.69,0,.4,.32,.4);for(const z of [-.91,.91])for(let i=0;i<3;i++)box('leaf_spring','metal',C.steel,x,.8+i*.037,z,1.18-i*.18,.035,.12);}
      }
      if(detail){
        cylinder('drive_shaft','metal',C.steel,-.06,.76,0,.075,5.3,'x');
        for(const x of [-3.3,-1.7,.5,1.9])box('chassis_crossmember','metal',C.dark,x,1.1,0,.12,.12,2.33);
        box('fuel_tank','metal',C.edge,.25,1.12,-1.18,1.35,.55,.45);
        for(const x of [-.22,.7])box('tank_strap','metal',C.steel,x,1.12,-1.415,.08,.57,.027);
        box('underbed_toolbox','paint',C.dark,.15,1.12,1.18,1.4,.55,.45);
        box('toolbox_handle','metal',C.steel,.15,1.23,1.42,.28,.05,.035);
      }
      // Cab-over layout retains the ordinary truck's driver and exit anchors.
      box('cab_floor','paint',C.paint,2.65,1.34,0,2.5,.35,2.79);
      box('cab_rear','paint',C.paint,1.48,2.17,0,.13,1.66,2.79);
      box('cab_front','paint',C.paint,3.80,1.84,0,.28,.68,2.64);
      box('cab_roof','paint',C.edge,2.49,3.08,0,2.24,.17,2.89);
      for(const side of [-1,1]){
        box('cab_door','paint',C.paint,2.51,1.89,side*1.405,1.92,.78,.075);
        box('door_sill','metal',C.dark,2.50,2.29,side*1.444,1.98,.065,.045);
        panel('side_window','glass',C.glass,[[1.59,2.36,side*1.45],[3.46,2.36,side*1.45],[3.48,2.89,side*1.45],[1.59,2.96,side*1.45]]);
        beam('windshield_pillar','paint',C.edge,[3.86,2.17,side*1.25],[3.50,3.03,side*1.31],.055);
        box('step','metal',C.steel,2.3,1.08,side*1.53,1.31,.105,.43);
        if(detail){
          for(const x of [1.85,2.08,2.31,2.54,2.77])box('step_grip','rubber',C.black,x,1.137,side*1.53,.055,.016,.35);
          box('door_handle','metal',C.black,1.86,2.15,side*1.46,.28,.065,.046);
          box('faction_marker','paint',C.teal,2.64,1.98,side*1.45,.53,.12,.02);
          box('faction_marker','paint',C.cream,2.88,2.13,side*1.451,.09,.12,.021);
          beam('mirror_stalk','metal',C.dark,[3.04,2.64,side*1.40],[3.04,2.64,side*1.81],.025);
          box('mirror_frame','metal',C.black,3.04,2.55,side*1.84,.15,.35,.13);
          box('mirror_glass','glass',C.glass,2.956,2.55,side*1.84,.018,.29,.104);
        }
      }
      const wind=(side)=>[[3.886,2.20,side*.07],[3.886,2.20,side*1.19],[3.519,2.987,side*1.24],[3.519,2.987,side*.07]];
      panel('windshield','glass',C.glass,wind(-1));panel('windshield','glass',C.glass,wind(1));
      beam('windshield_center','metal',C.dark,[3.9,2.18,0],[3.52,3.01,0],.04);
      box('dash','metal',C.dark,3.37,1.99,0,.54,.23,2.49);
      for(const z of [-.7,.7]){box('seat_base','rubber',C.black,2.57,1.77,z,.66,.19,.64);box('seat_back','rubber',C.black,2.22,2.13,z,.15,.72,.64,0,0,-.06);}
      box('front_grille','rubber',C.black,3.954,1.82,0,.055,.43,1.35);
      if(detail){
        for(let i=0;i<6;i++)box('grille_louver','metal',C.steel,3.99,1.66+i*.065,0,.035,.018,1.28);
        for(const side of [-1,1])beam('windscreen_wiper','rubber',C.black,[3.83,2.30,side*.23],[3.66,2.64,side*.88],.018);
        b.add(steeringGeo,'rubber',C.black,3.10,2.17,-.745,1,1,1,0,Math.PI/2,.2, 'steering_wheel');
        beam('steering_column','metal',C.dark,[3.30,1.81,-.745],[3.10,2.17,-.745],.035);
        for(const z of [-.11,.11])box('roof_vent','metal',C.dark,2.24,3.173,z,.7,.016,.045);
      }
      box('front_bumper','metal',C.dark,4.06,1.15,0,.20,.25,2.54);
      for(const side of [-1,1]){
        box('headlight_housing','metal',C.dark,3.98,1.74,side*1.04,.07,.31,.46);
        box('headlight','light',C.lamp,4.025,1.77,side*1.04,.025,.18,.31);
        box('indicator','light',C.amber,4.027,1.53,side*1.16,.025,.08,.17);
        cylinder('amber_service_beacon','light',C.amber,2.66,3.25,side*.64,.12,.17);
        if(detail){
          box('lamp_guard','metal',C.dark,4.046,1.77,side*1.04,.023,.035,.35);
          cylinder('beacon_base','metal',C.dark,2.66,3.175,side*.64,.14,.05);
        }
      }
      // The open rear presents distinct medical cases and ammunition crates.
      box('cargo_bed','paint',C.paint,-1.28,1.52,0,5.28,.23,2.9);
      box('cargo_floor','canvas',C.wood,-1.28,1.67,0,5.12,.065,2.72);
      for(const side of [-1,1]){
        box('cargo_sideboard','paint',C.paint,-1.28,1.92,side*1.445,5.27,.52,.085);
        box('cargo_top_rail','metal',C.edge,-1.28,2.20,side*1.46,5.3,.055,.06);
        if(detail){
          for(const x of [-3.78,-2.52,-1.26,0,1.2])box('cargo_stake','metal',C.edge,x,1.97,side*1.5,.068,.62,.06);
          for(const x of [-3.19,-1.91,-.63,.65])box('tie_down','metal',C.steel,x,1.66,side*1.51,.17,.065,.03);
          box('service_marking_panel','paint',C.cream,-1.65,1.95,side*1.5,1.03,.36,.025);
          medCross(b,-1.65,1.95,side*1.52,true,.55);
        }
      }
      box('tailgate','paint',C.paint,-3.93,1.91,0,.07,.48,2.86);
      if(detail){
        for(const z of [-1.12,1.12]){
          box('tailgate_hinge','metal',C.steel,-3.981,1.69,z,.04,.08,.22);
          box('tailgate_latch','metal',C.dark,-3.98,2.08,z,.045,.17,.09);
        }
        for(const z of [-1.11,-.56,0,.56,1.11])box('bed_plank_seam','canvas',C.strap,-1.28,1.709,z,5.04,.012,.014);
      }
      cargoCase(b,-2.93,.64,true,detail);cargoCase(b,-2.93,-.64,false,detail);
      cargoCase(b,-2.93,.64,true,detail,1);cargoCase(b,-2.93,-.64,false,detail,1);
      cargoCase(b,-1.55,-.65,false,detail);cargoCase(b,-.19,-.65,false,detail);
      cargoCase(b,-.19,-.65,false,detail,1);
      if(detail){
        box('medical_cooler','paint',C.cream,-1.48,2.1,.65,1.1,.77,.72);
        box('medical_cooler_lid','paint',C.tealDark,-1.48,2.5,.65,1.14,.09,.76);
        medCross(b,-2.044,2.17,.65,false,.65);
        for(const z of [.42,.86]){box('water_can','paint',C.tealDark,-.13,2.05,z,.62,.67,.36);box('water_can_handle','metal',C.dark,-.13,2.415,z,.26,.06,.18);}
        for(const z of [.99,1.19])beam('folded_stretcher','metal',C.steel,[-2.60,3.1,z],[-.45,3.1,z],.027);
        box('folded_stretcher_canvas','canvas',C.strap,-1.52,3.1,1.09,1.97,.06,.2);
      }
      canopy(b,detail);
      for(const z of [-.79,.79])box('rear_step_support','metal',C.dark,-4.07,1.07,z,.085,.95,.08);
      for(const y of [.59,.94,1.28])box('rear_step','metal',C.steel,-4.12,y,0,.22,.065,1.68);
      for(const side of [-1,1]){
        box('rear_light_housing','metal',C.dark,-3.99,1.28,side*1.12,.08,.25,.42);
        box('rear_lamp','light',C.red,-4.04,1.30,side*1.17,.025,.12,.17);
        box('rear_indicator','light',C.amber,-4.04,1.30,side*.97,.025,.12,.12);
        box('mudflap','rubber',C.black,-3.52,.67,side*1.53,.07,.53,.46);
      }
      return b;
    }
    function wheelParts(detail){
      const b=builder();
      b.add(detail?fineCylinder:lowCylinder,'rubber',C.rubber,0,0,0,.665,.43,.665,Math.PI/2,0,0);
      if(detail){
        b.add(torusGeo,'rubber',C.rubber,0,0,.115);b.add(torusGeo,'rubber',C.rubber,0,0,-.115);
        for(let i=0;i<24;i++){
          const angle=i*Math.PI/12;
          b.box('tyre_tread','rubber',i%2?C.rubber:C.tread,Math.cos(angle)*.665,Math.sin(angle)*.665,0,.07,.18,.45,0,0,angle);
        }
      }
      for(const side of [-1,1]){
        b.add(detail?cylinderGeo:lowCylinder,'metal',C.edge,0,0,side*.228,.397,.045,.397,Math.PI/2,0,0);
        b.add(lowCylinder,'metal',C.steel,0,0,side*.265,.15,.065,.15,Math.PI/2,0,0);
        if(detail)for(let i=0;i<6;i++){
          const a=i*Math.PI/3;
          b.add(lowCylinder,'metal',C.dark,Math.cos(a)*.26,Math.sin(a)*.26,side*.26,.027,.03,.027,Math.PI/2,0,0);
        }
      }
      return b;
    }
    const bodyEntries=body(true).finish('body'),wheelEntries=wheelParts(true).finish('wheel');
    const far=body(false),smallWheel=wheelParts(false).finish('far_wheel');
    for(const x of [2.58,-.88,-2.72])for(const side of [-1,1])for(const entry of smallWheel){
      // Preserve the pre-baked wheel colours while folding all six stationary
      // wheels into the distant body's existing material batches.
      const g=entry.geometry.clone();g.translate(x,.70,side*1.44);
      far.add(g,entry.material,0xffffff);
      g.dispose();
    }
    const farEntries=far.finish('far');
    for(const entry of smallWheel){entry.geometry.dispose();geometries.delete(entry.geometry);}
    for(const geometry of raw)geometry.dispose();
    function stats(entries, multiplier=1){return {draws:entries.length*multiplier,triangles:entries.reduce((n,row)=>n+row.geometry.attributes.position.count/3,0)*multiplier};}
    const bodyStats=stats(bodyEntries),wheelStats=stats(wheelEntries,6),farStats=stats(farEntries);
    const entry={bodyEntries,wheelEntries,farEntries,geometries,refs:0,partCounts,
      stats:{near:{draws:bodyStats.draws+wheelStats.draws,triangles:bodyStats.triangles+wheelStats.triangles},far:farStats}};
    CACHE.set(T,entry);return entry;
  }

  function createVehicle(T,options={}) {
    if(!T?.Group||!T?.BufferGeometry)throw new Error('Supply truck requires THREE.');
    const cache=CACHE.get(T)||buildCache(T);cache.refs++;
    const material=(name,roughness,metalness,extra={})=>{
      const m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness,metalness,...extra});
      m.name='supply_'+name;return m;
    };
    const materials={
      paint:material('paint',.73,.16),metal:material('metal',.57,.48),rubber:material('rubber',.96,.01),
      canvas:material('canvas',.99,.01,{side:T.DoubleSide}),
      glass:material('glass',.18,.36,{transparent:true,opacity:.67,depthWrite:false,side:T.DoubleSide}),
      light:new T.MeshBasicMaterial({color:0xffffff,vertexColors:true})
    };
    materials.light.name='supply_light';
    const group=new T.Group(),model=new T.Group(),farModel=new T.Group();
    group.name='FIELDLINE_6x6_SupplyTruck';model.name='SupplyTruck_near';farModel.name='SupplyTruck_far';
    group.userData={supplyTruck:true,revision:REVISION,frontAxis:'+X',origin:'ground_plane',units:'metres',wheelCount:6,
      role:'ammunition-and-medical-support',parts:{...cache.partCounts}};
    group.add(model,farModel);farModel.visible=false;
    const meshRecords=[],wheels=[];
    function instantiate(entries,parent){
      for(const entry of entries){
        const node=new T.Mesh(entry.geometry,materials[entry.material]);node.name=entry.name;
        node.castShadow=entry.material!=='glass'&&entry.material!=='light';node.receiveShadow=entry.material!=='light';
        node.userData={supplyTruckPart:entry.name};node.updateMatrix();node.matrixAutoUpdate=false;parent.add(node);
        meshRecords.push({node,material:node.material,shadow:node.castShadow});
      }
    }
    instantiate(cache.bodyEntries,model);instantiate(cache.farEntries,farModel);
    for(const [axle,x] of [2.58,-.88,-2.72].entries())for(const side of [-1,1]){
      const node=new T.Group(),spin=new T.Group();
      node.name='supply_wheel_'+axle+'_'+(side<0?'left':'right');node.position.set(x,.70,side*1.44);
      node.userData={joint:'wheel',front:axle===0,side};spin.name=node.name+'_spin';node.add(spin);model.add(node);
      instantiate(cache.wheelEntries,spin);wheels.push({node,spin,front:axle===0,side,rest:node.rotation.clone()});
    }
    group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(group);
    let disposed=false,dead=false,distant=false,quality='high',distance=0,lastShadow=null,lastFlash=-1;
    function update(state={}){
      if(disposed)return;
      if(state.quality)quality=state.quality;
      if(Number.isFinite(state.distance))distance=state.distance;
      const cutoff=quality==='low'?50:105;
      distant=distance>cutoff+(distant?-8:8);model.visible=!distant;farModel.visible=distant;
      if(!distant){
        const turn=Math.max(-1,Math.min(1,finite(state.steer)))*.42;
        const spin=Number.isFinite(state.wheel)?state.wheel:finite(state.travel)/DEFINITION.wheelRadius;
        for(const wheel of wheels){wheel.node.rotation.y=wheel.front?-turn:0;wheel.spin.rotation.z=-spin;}
      }
      if(typeof state.dead==='boolean'&&state.dead!==dead){
        dead=state.dead;
        for(const item of meshRecords)item.node.material=dead&&options.wreckMaterial?options.wreckMaterial:item.material;
      }
      const flash=Number.isFinite(state.flash)?Math.max(0,Math.min(1,state.flash)):0;
      if(flash!==lastFlash){lastFlash=flash;for(const key of ['paint','metal','canvas'])materials[key].emissive.setRGB(flash*.32,flash*.065,0);}
      const shadow=quality!=='low'&&distance<170;
      if(shadow!==lastShadow){lastShadow=shadow;for(const item of meshRecords)item.node.castShadow=item.shadow&&shadow;}
    }
    function dispose(){
      if(disposed)return;disposed=true;group.removeFromParent();group.clear();model.clear();farModel.clear();
      for(const material of Object.values(materials))material.dispose();
      meshRecords.length=0;wheels.length=0;
      if(--cache.refs===0){for(const geometry of cache.geometries)geometry.dispose();cache.geometries.clear();CACHE.delete(T);}
    }
    return {group,model,farModel,bounds,wheels,definition:DEFINITION,origin:'ground_plane',
      supplyTruckRevision:REVISION,paint:materials.paint,stats:cache.stats,update,dispose,
      get disposed(){return disposed;},get distant(){return distant;}};
  }
  host.HanQSupplyTruck=Object.freeze({version:REVISION,definition:()=>DEFINITION,createVehicle});
})(typeof window!=='undefined'?window:globalThis);
