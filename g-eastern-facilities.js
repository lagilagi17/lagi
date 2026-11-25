/* Physical eastern-front service buildings. Native coordinates: x/y are
 * horizontal and h is height. Planning never changes terrain or host RNG. */
(function (global) {
  'use strict';
  const KINDS = Object.freeze(['armory', 'ammo', 'medical']);
  const TITLES = Object.freeze({armory:'무기고', ammo:'탄약고', medical:'의무실'});
  const DIMENSIONS = Object.freeze({armory:[8.4,7.2], ammo:[7.6,6.8], medical:[8.8,7.8]});
  const PI = Math.PI, TAU = PI * 2, CELL = 24, MAX_DISTANCE = 170;
  const finite = Number.isFinite;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  // Verified with all 620 garrison homes and every authored/base fleet home.
  const BAKED = Object.freeze({
    "N_HQ:armory":[2232,-804,50.0368,-1.5707963267948966],
    "N_HQ:ammo":[2164,-804,50.0368,3.141592653589793],
    "N_HQ:medical":[2198,-848,50.0368,1.5707963267948966],
    "N_RIDGE:armory":[2356.0294372515227,-610.9705627484772,223.8612292480469,1.5707963267948966],
    "N_RIDGE:ammo":[2389.9705627484773,-610.9705627484772,223.8612292480469,-1.5707963267948966],
    "N_RIDGE:medical":[2356,-564.555136271329,223.8612292480469,1.0471975511965983],
    "N_PASS:armory":[2476.0294372515227,-235.97056274847714,17.738882846832276,1.5707963267948966],
    "N_PASS:ammo":[2509.9705627484773,-235.97056274847714,17.738882846832276,-1.5707963267948966],
    "N_PASS:medical":[2531.1051177665154,-197,17.738882846832276,-0.5235987755982983],
    "N_RADAR:armory":[2706.182219830938,-657.7883429175395,257.02389999999997,-1.5707963267948966],
    "N_RADAR:ammo":[2659.817780169062,-670.2116570824605,257.02389999999997,2.879793265790644],
    "N_RADAR:medical":[2671,-684.7846096908265,257.02389999999997,0.5235987755982988],
    "N_ARTY:armory":[2758.7846096908265,-276,177.3628924560547,-1.5707963267948966],
    "N_ARTY:ammo":[2726,-243.21539030917347,177.3628924560547,3.141592653589793],
    "N_ARTY:medical":[2717.2153903091735,-276,177.3628924560547,-0.5235987755982987],
    "N_DEPOT:armory":[2857.2153903091735,44,38.780499999999996,1.5707963267948966],
    "N_DEPOT:ammo":[2857.2153903091735,68,38.780499999999996,1.5707963267948966],
    "N_DEPOT:medical":[2902,55.99999999999999,38.780499999999996,-1.5707963267948966],
    "C_RUINS:armory":[2341,456.5551362713291,82.0075,0],
    "C_RUINS:ammo":[2390.8414780938283,494.79984753348566,82.16749999999999,-1.5707963267948966],
    "C_RUINS:medical":[2325.1585219061717,494.7998475334858,82.16749999999999,3.403392041388945],
    "C_GATE:armory":[2207.444863728671,1013,30.5691,-0.5235987755982983],
    "C_GATE:ammo":[2178,1030,30.5691,3.141592653589793],
    "C_GATE:medical":[2178,952,30.5691,1.5707963267948966],
    "C_IRON:armory":[2434.2061733486967,832.6048783712534,29.554432710905544,2.199114857512856],
    "C_IRON:ammo":[2452.6048783712536,823.2302699245199,30.6387322136667,-1.2566370614359184],
    "C_IRON:medical":[2437.5887410203154,816.5014911133073,30.54269480019573,2.042035224833365],
    "C_WEST:armory":[2380,1495.444863728671,95.34920532226563,-3.141592653589793],
    "C_WEST:ammo":[2380,1436.555136271329,95.34920532226563,-2.094395102393195],
    "C_WEST:medical":[2324.8948822334846,1444,95.34920532226563,2.617993877991495],
    "C_FOUNDRY:armory":[2773.7846096908265,479,27.4237,-1.5707963267948966],
    "C_FOUNDRY:ammo":[2736.0294372515227,507.97056274847716,27.4237,3.9269908169872383],
    "C_FOUNDRY:medical":[2784.112698372208,522.1126983722081,27.4237,-3.141592653589793],
    "C_GRAND:armory":[2608,1152,157.86234313964843,1.5707963267948966],
    "C_GRAND:ammo":[2591,1146.555136271329,157.86234313964846,2.094395102393195],
    "C_GRAND:medical":[2625,1205.444863728671,157.86234313964843,-3.141592653589793],
    "C_RAIL:armory":[2772.2153903091735,1014,52.9313,1.5707963267948966],
    "C_RAIL:ammo":[2817,1026,52.9313,-1.5707963267948966],
    "C_RAIL:medical":[2768.9583694396574,1001.9583694396574,52.9313,1.5707963267948966],
    "C_AIR:armory":[2931.182219830938,1539.7883429175395,31.572400000000002,-1.5707963267948966],
    "C_AIR:ammo":[2931.182219830938,1552.2116570824605,31.572400000000002,-1.5707963267948966],
    "C_AIR:medical":[2942,1546,31.572400000000002,0],
    "S_HARBOR:armory":[2177.2153903091735,1999,19.39,1.5707963267948966],
    "S_HARBOR:ammo":[2191.7883429175395,1987.8177801690624,19.39,0],
    "S_HARBOR:medical":[2218.7846096908265,1999,19.39,-1.5707963267948966],
    "S_CANAL:armory":[2403,1937.7653718043598,23.07,3.141592653589793],
    "S_CANAL:ammo":[2391.8162338159264,1929.1837661840736,23.07,3.141592653589793],
    "S_CANAL:medical":[2403,1844.2346281956404,23.07,0],
    "S_FARM:armory":[2437.2153903091735,2334,25.0923,1.5707963267948966],
    "S_FARM:ammo":[2474.9705627484773,2329.0294372515227,25.1723,0],
    "S_FARM:medical":[2433.9583694396574,2321.9583694396574,25.0923,1.5707963267948966],
    "S_HQ:armory":[2223,2870,25.1921,3.141592653589793],
    "S_HQ:ammo":[2267,2836,25.1921,-3.141592653589793],
    "S_HQ:medical":[2223,2792,25.1921,-1.5707963267948966],
    "S_REFINERY:armory":[2790.8414780938283,1887.2001524665143,26.2213,-1.5707963267948966],
    "S_REFINERY:ammo":[2734.817780169062,1902.2116570824605,26.2213,0.26179938779914913],
    "S_REFINERY:medical":[2796.1051177665154,1918,26.2213,-0.5235987755982983],
    "S_DELTA:armory":[2623,2242,70.55236465454101,0],
    "S_DELTA:ammo":[2640,2295.444863728671,70.55236465454101,-3.141592653589793],
    "S_DELTA:medical":[2645,2227.8948822334846,70.55236465454101,0],
    "S_AIRFIELD:armory":[2844.817780169062,2497.2116570824605,23.4824,1.5707963267948966],
    "S_AIRFIELD:ammo":[2884.9705627484773,2474.0294372515227,23.4824,0],
    "S_AIRFIELD:medical":[2892,2491,23.4824,-1.5707963267948966],
    "S_ENEMY_HQ:armory":[2947,2846,158.654,-1.5707963267948966],
    "S_ENEMY_HQ:ammo":[2939.9705627484773,2829.0294372515227,158.654,-2.356194490192345],
    "S_ENEMY_HQ:medical":[2961.1051177665154,2824,158.654,-1.5707963267948966],
    "N_COAST_POST:armory":[2217.7883429175395,-279.18221983093764,26.2112,0],
    "N_COAST_POST:ammo":[2232.7998475334857,-223.15852190617167,25.893059682799617,-4.4505895925855405],
    "N_COAST_POST:medical":[2191.1585219061717,-247.2001524665143,25.976880273216572,3.4033920413889422],
    "N_WEST_POST:armory":[2234,120,37.059000000000005,0],
    "N_WEST_POST:ammo":[2242.7998475334857,176.84147809382833,36.99310983879658,-4.4505895925855405],
    "N_WEST_POST:medical":[2225.2001524665143,176.84147809382833,37.09306361752482,4.4505895925855405],
    "N_RELAY_POST:armory":[2557.7883429175395,200.81778016906236,37.8536,0],
    "N_RELAY_POST:ammo":[2555.2001524665143,256.8414780938283,37.67302868319065,4.45058959258554],
    "N_RELAY_POST:medical":[2534.555136271329,207,37.8536,2.617993877991495],
    "C_EAST_POST:armory":[2927.7883429175395,650.8177801690624,22.2818,0],
    "C_EAST_POST:ammo":[2909.9583694396574,649.9583694396574,22.2818,1.5707963267948966],
    "C_EAST_POST:medical":[2934,640,21.977625325743652,1.5707963267948966],
    "C_MID_POST:armory":[2554,670,38.083999999999996,0],
    "C_MID_POST:ammo":[2554,660,37.94113230567142,1.5707963267948966],
    "C_MID_POST:medical":[2578.0416305603426,669.9583694396574,38.083999999999996,0.7853981633974483],
    "C_FRONT_POST:armory":[2204,1245,39.6426,0],
    "C_FRONT_POST:ammo":[2212.7998475334857,1301.8414780938283,39.51850196383115,-4.45058959258554],
    "C_FRONT_POST:medical":[2195.2001524665143,1301.8414780938283,39.56274752659919,4.45058959258554],
    "C_COAST_POST:armory":[2214,1700,26.4936,0],
    "C_COAST_POST:ammo":[2222.7998475334857,1756.8414780938283,26.173557586669922,-4.45058959258554],
    "C_COAST_POST:medical":[2205.2001524665143,1756.8414780938283,26.173557586669922,4.45058959258554],
    "S_EAST_POST:armory":[2879,2110,20.2108,0],
    "S_EAST_POST:ammo":[2911.8414780938283,2125.2001524665143,19.890849418640137,0.26179938779915],
    "S_EAST_POST:medical":[2911.8414780938283,2142.7998475334857,19.890849418640137,-0.26179938779915024],
    "S_WEST_POST:armory":[2259,2480,17.39,0],
    "S_WEST_POST:ammo":[2283.0416305603426,2479.9583694396574,17.39,0.7853981633974483],
    "S_WEST_POST:medical":[2267.7998475334857,2536.8414780938283,17.07,-4.45058959258554],
    "S_REAR_POST:armory":[2644,2810,34.251,0],
    "S_REAR_POST:ammo":[2678,2834,34.09124024497461,-1.5707963267948966],
    "S_REAR_POST:medical":[2611.1585219061717,2842.7998475334857,33.93100387573242,0.26179938779915024]
  });
  const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();

  function point(record,x,z,h=record.h) {
    const c=Math.cos(record.heading),s=Math.sin(record.heading);
    return {x:record.x+c*x+s*z,y:record.y-s*x+c*z,h};
  }
  function box(x,y,hx,hz,ry=0,extra={}) {
    const c=Math.cos(ry),s=Math.sin(ry),ex=Math.abs(c)*hx+Math.abs(s)*hz,ey=Math.abs(s)*hx+Math.abs(c)*hz;
    return {x,y,hx,hz,ry,c,s,minX:x-ex,maxX:x+ex,minY:y-ey,maxY:y+ey,...extra};
  }
  function overlaps(a,b,pad=0) {
    if(a.maxX+pad<b.minX||a.minX-pad>b.maxX||a.maxY+pad<b.minY||a.minY-pad>b.maxY)return false;
    const dx=b.x-a.x,dy=b.y-a.y;
    for(const [ux,uy] of [[a.c,-a.s],[a.s,a.c],[b.c,-b.s],[b.s,b.c]]) {
      const ar=Math.abs(ux*a.c-uy*a.s)*a.hx+Math.abs(ux*a.s+uy*a.c)*a.hz;
      const br=Math.abs(ux*b.c-uy*b.s)*b.hx+Math.abs(ux*b.s+uy*b.c)*b.hz;
      if(Math.abs(dx*ux+dy*uy)>ar+br+pad)return false;
    }
    return true;
  }
  function index(items=[]) {
    const bins=new Map();
    function add(o) {
      for(let x=Math.floor(o.minX/CELL);x<=Math.floor(o.maxX/CELL);x++)for(let y=Math.floor(o.minY/CELL);y<=Math.floor(o.maxY/CELL);y++) {
        const key=x+','+y;let list=bins.get(key);if(!list)bins.set(key,list=[]);list.push(o);
      }
    }
    for(const o of items)add(o);
    return {add,near(b) {
      const found=new Set();
      for(let x=Math.floor(b.minX/CELL);x<=Math.floor(b.maxX/CELL);x++)for(let y=Math.floor(b.minY/CELL);y<=Math.floor(b.maxY/CELL);y++)for(const o of bins.get(x+','+y)||[])found.add(o);
      return found;
    }};
  }
  function footprint(record,clearance=.65,approach=4.7) {
    const p=point(record,0,approach/2);
    return box(p.x,p.y,record.width/2+clearance,record.depth/2+clearance+approach/2,record.heading);
  }
  function canonical(site,kind,source) {
    const scale=site.type==='outpost'?.85:1,d=DIMENSIONS[kind];
    return {id:site.id+':'+kind,siteId:site.id,kind,x:source.x,y:source.y,h:source.h,heading:source.heading,
      width:d[0]*scale,depth:d[1]*scale,scale,doorWidth:2.4};
  }
  function makeReservations(runtime,vehicles,includeCurrent,player) {
    const result=[],offset=runtime.nativeOffsets||{x:1024,z:1024,h:10};
    // Facilities are installed after the baked infantry corridors. Reserve
    // their complete segments, not just the garrison home points: otherwise
    // a perfectly valid building can close a replacement soldier's only path.
    // Heights keep an unrelated bridge/underpass layer available.
    const routes=runtime.walkingRoutes||global.HanQEasternFrontRoutes;
    // Keep the published corridor occupied after a walking-route repair as
    // well. Otherwise a later load could put a moved facility back across an
    // old saved formation while the current route follows its new detour.
    const walkingEdges=[...(routes?.edges||[]),...(routes?.walkingRepair?.legacyEdges||[])];
    for(const edge of walkingEdges)for(let i=1;i<edge.points.length;i++) {
      const a=edge.points[i-1],b=edge.points[i],dx=b.x-a.x,dy=b.y-a.y;
      if(![a.x,a.y,a.h,b.x,b.y,b.h].every(finite))continue;
      result.push(box((a.x+b.x)/2,(a.y+b.y)/2,Math.hypot(dx,dy)/2+.6,1.15,-Math.atan2(dy,dx),
        {minH:Math.min(a.h,b.h)-.7,maxH:Math.max(a.h,b.h)+2.4,walkingRoute:true}));
    }
    for(const road of runtime.assetData?.roadSegments||[]) {
      const dx=road.x2-road.x1,dy=road.z2-road.z1;
      result.push(box((road.x1+road.x2)/2+offset.x,(road.z1+road.z2)/2+offset.z,Math.hypot(dx,dy)/2+1,(road.width||10)/2+2,-Math.atan2(dy,dx),{road:true}));
    }
    for(const road of runtime.connection?.segments||[]) {
      const dx=road.x2-road.x1,dy=road.y2-road.y1;
      result.push(box((road.x1+road.x2)/2,(road.y1+road.y2)/2,Math.hypot(dx,dy)/2+1,(road.width||14)/2+2,-Math.atan2(dy,dx),{road:true}));
    }
    for(const member of runtime.roster||[]) {
      const home=member.home||member;
      if(finite(home.x)&&finite(home.y))result.push(box(home.x,home.y,1.8,1.8,0,{minH:(home.h??member.h)-.2,maxH:(home.h??member.h)+2.5,home:true}));
      if(includeCurrent&&!member.dead&&finite(member.x)&&finite(member.y)&&(member.x!==home.x||member.y!==home.y))result.push(box(member.x,member.y,1.5,1.5,0,{minH:member.h-.2,maxH:member.h+2.5}));
    }
    if(includeCurrent&&player&&finite(player.x)&&finite(player.y))result.push(box(player.x,player.y,2,2,0,{minH:(player.h??runtime.getTerrain(player.x,player.y))-.2,maxH:(player.h??runtime.getTerrain(player.x,player.y))+2.5}));
    function reserveVehicle(v,x,y,h,heading,home) {
      if(!finite(x)||!finite(y)||!runtime.owns(x,y))return;
      const kind=v.efType||v.alliedKind||v.kind||'truck';
      const definition=global.HanQNorthCoastAssets?.definition?.(kind);
      const fallback={tank:[2.16,2.04,3.6],apc:[1.75,2.17,3.65],mlrs:[1.9,2.7,4.35],truck:[2.01,2.61,3.55],fighter:[2,4.7,5.5],helicopter:[4,4,6],howitzer:[2.15,1.05,3.2]};
      const d=fallback[kind]||fallback.truck;
      const r=kind==='mlrs'?1.9:definition?.collisionRadius||d[0],o=kind==='mlrs'?2.7:definition?.collisionOffset||d[1];
      result.push(box(x,y,r+o+(home?10:1),r+1.7,-(heading||0),{minH:(h||0)-.3,maxH:(h||0)+(definition?.hitHeight||d[2]),vehicle:true}));
    }
    for(const v of vehicles||[]) {
      const spec=(runtime.vehicleSpawns||[]).find(q=>q.id===v.efPlacement);
      const em=(runtime.emplacements||[]).find(q=>q.id===v.efVehicle);
      const stableHome=finite(v.efHomeX)&&finite(v.efHomeY)||!!spec||!!em;
      const hx=v.efHomeX??spec?.x??em?.x??v.x,hy=v.efHomeY??spec?.y??em?.y??v.y,hh=v.efHomeH??spec?.h??em?.h??v.gy;
      const heading=v.efHomeHeading??spec?.heading??(em?Math.atan2(em.target.y-em.y,em.target.x-em.x):v.heading);
      if(stableHome)reserveVehicle(v,hx,hy,hh,heading,true);
      if(includeCurrent&&(!stableHome||v.x!==hx||v.y!==hy))reserveVehicle(v,v.x,v.y,v.gy,v.heading,false);
    }
    // Direct planners may omit the host fleet; authored parking remains reserved.
    for(const v of runtime.vehicleSpawns||[]) {
      reserveVehicle(v,v.x,v.y,v.h,v.heading,true);
      if(v.kind==='fighter') {
        // Keep the authored takeoff leg clear even when parked actors force
        // a fresh search: full wings plus a buffer, tail -12 m to nose +110 m.
        const heading=v.heading||0,c=Math.cos(heading),s=Math.sin(heading);
        result.push(box(v.x+c*49,v.y+s*49,61,9,-heading,{runway:true}));
      }
    }
    for(const v of runtime.emplacements||[])if(v.kind==='rocket')reserveVehicle({...v,kind:'mlrs'},v.x,v.y,v.h,Math.atan2(v.target.y-v.y,v.target.x-v.x),true);
    return index(result);
  }
  function createValidator(runtime,vehicles,includeCurrent,player) {
    const staticIndex=index((runtime.collisionBoxes||[]).map(o=>box(o.x,o.y,o.hx,o.hz,o.ry||0,{minH:o.base??o.h-o.hy,maxH:(o.base??o.h-o.hy)+(o.hgt??o.hy*2),roof:!!o.roof,static:true})));
    const paving=index((runtime.surfaceBoxes||[]).filter(o=>!o.roof&&(o.hgt??o.hy*2)<=.75&&o.hx>=2&&o.hz>=2)
      .map(o=>box(o.x,o.y,o.hx,o.hz,o.ry||0,{height:o.height??o.h+o.hy})));
    const reservations=makeReservations(runtime,vehicles,includeCurrent,player),placed=index(),bounds=runtime.bounds;
    function ground(x,y) {
      const terrain=runtime.getTerrain(x,y);if(!finite(terrain))return terrain;
      let h=terrain;const sample=box(x,y,0,0);
      // The fortress courtyard is a thin authored paving slab. Reuse its
      // support face, never a roof, room, crate, or previously installed facility.
      for(const p of paving.near(sample))if(p.height>h&&p.height<=terrain+1.2&&overlaps(sample,p))h=p.height;
      return h;
    }
    function valid(record) {
      if(![record.x,record.y,record.heading].every(finite))return null;
      const site=runtime.getSite(record.siteId);
      if(!site||Math.hypot(record.x-site.x,record.y-site.y)>MAX_DISTANCE)return null;
      const area=footprint(record);
      if(area.minX<bounds.minX+1||area.maxX>bounds.maxX-1||area.minY<bounds.minY+1||area.maxY>bounds.maxY-1)return null;
      for(const other of placed.near(area))if(overlaps(area,other,1.1))return null;
      const terrain=ground(record.x,record.y);
      if(!finite(terrain)||terrain<(runtime.seaLevel||0)+.4)return null;
      // Reject cheap broad obstacles before dense terrain/whole-hull samples.
      for(const other of reservations.near(area))if(overlaps(area,other)&&
        (other.minH===undefined||other.maxH>terrain-.8&&other.minH<terrain+5))return null;
      let low=Infinity,high=-Infinity;
      const nx=Math.ceil(record.width/1.4),nz=Math.ceil(record.depth/1.4);
      for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++) {
        const p=point(record,(ix/nx-.5)*record.width,(iz/nz-.5)*record.depth),h=ground(p.x,p.y);
        if(!finite(h)||h<(runtime.seaLevel||0)+.3)return null;
        low=Math.min(low,h);high=Math.max(high,h);if(high-low>.95)return null;
      }
      const floor=high+.07;
      // Every point in the floor and approach envelope must be clear of real
      // walls, pillars, roofs and furniture. Low existing paving is harmless.
      for(const other of staticIndex.near(area))if(other.maxH>floor+.025&&(other.roof||other.minH<floor+4.2)&&overlaps(area,other))return null;
      const steps=[];
      let previous=floor;
      for(let step=-1;step<6;step++) {
        const z=record.depth/2+(step<0?.48:1.15+step*.62),depth=step<0?.96:.62;
        let min=Infinity,max=-Infinity;
        for(const side of [-1,0,1])for(const fore of [-.5,0,.5]) {
          const p=point(record,side*1.3,z+fore*depth),h=ground(p.x,p.y);
          if(!finite(h)||h<(runtime.seaLevel||0)+.3)return null;
          min=Math.min(min,h);max=Math.max(max,h);
        }
        if(max-min>.38||max>previous+.02)return null;
        const h=step<0?floor:Math.max(max+.045,floor-(step+1)*.22);
        if(h>previous+.03||previous-h>.3||h-min>1.3)return null;
        if(step===5&&h-min>.28)return null;
        steps.push({z,depth,width:2.6,h});previous=h;
      }
      const outside=point(record,0,record.depth/2+5.15),outsideH=ground(outside.x,outside.y);
      if(!finite(outsideH)||Math.abs(previous-outsideH)>.45||runtime.bodyBlocked(outside.x,outside.y,outsideH,1.9,.48))return null;
      if(finite(record.h)&&Math.abs(record.h-floor)>.035)return null;
      record.h=floor;record.foundationDepth=Math.max(.24,floor-low+.16);record.steps=steps;
      record.door=point(record,0,record.depth/2+.4,floor);
      record.approach=point(record,0,record.depth/2+5.15,outsideH);
      return record;
    }
    return {valid,accept(record){placed.add(footprint(record));}};
  }
  function plan({runtime,vehicles=[],placements=null,player=null}={}) {
    const started=now(),stats={source:'generated',attempts:0,ms:0,missing:[]};plan.lastStats=stats;
    if(!runtime?.sites?.length||typeof runtime.getTerrain!=='function'||typeof runtime.bodyBlocked!=='function')return null;
    const expected=runtime.sites.flatMap(site=>KINDS.map(kind=>({site,kind,id:site.id+':'+kind})));
    function restore(saved,source,includeCurrent=false) {
      if(!Array.isArray(saved)||saved.length!==expected.length)return null;
      const map=new Map(saved.map(p=>[p?.id,p]));if(map.size!==expected.length)return null;
      const validator=createValidator(runtime,vehicles,includeCurrent,player),records=[];
      for(const {site,kind,id} of expected) {
        const savedRecord=map.get(id);if(!savedRecord||![savedRecord.x,savedRecord.y,savedRecord.h,savedRecord.heading].every(finite))return null;
        const record=validator.valid(canonical(site,kind,savedRecord));if(!record)return null;
        validator.accept(record);records.push(record);
      }
      stats.source=source;stats.ms=now()-started;return records;
    }
    const restored=restore(placements,'saved');if(restored)return restored;
    const baked=expected.map(({id})=>BAKED[id]?{id,x:BAKED[id][0],y:BAKED[id][1],h:BAKED[id][2],heading:BAKED[id][3]}:null);
    // A first installation also avoids transient parked hulls. Saved buildings
    // retain their location after cars or troops move through their interiors.
    if(baked.every(Boolean)){const records=restore(baked,'baked',true);if(records)return records;}
    stats.source='generated';
    const validator=createValidator(runtime,vehicles,true,player),records=[],retained=new Map();
    // Repair only the placements made invalid by a new corridor/solid. A
    // single blocked infirmary must not relocate every healthy facility or
    // discard a saved building merely because someone is standing inside it.
    const preferred=Array.isArray(placements)&&placements.length===expected.length?placements:baked;
    if(preferred.every(Boolean)) {
      const candidates=new Map(preferred.map(p=>[p.id,p])),stable=createValidator(runtime,vehicles,false,null);
      if(candidates.size===expected.length)for(const {site,kind,id} of expected) {
        const source=candidates.get(id);if(!source)continue;
        const record=stable.valid(canonical(site,kind,source));if(!record)continue;
        stable.accept(record);validator.accept(record);retained.set(id,record);
      }
    }
    stats.retained=retained.size;
    for(const {site,kind,id} of expected) {
      if(retained.has(id)){records.push(retained.get(id));continue;}
      let found=null;
      const seed=[...site.id].reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),7),start=(seed%24)*TAU/24;
      search:for(const radius of [24,34,44,54,66,78,90,102,114,126,138,150,162,168]) {
        const count=radius<60?24:40;
        for(let n=0;n<count;n++) {
          const a=start+n*TAU/count,x=site.x+Math.cos(a)*radius,y=site.y+Math.sin(a)*radius,toward=Math.atan2(site.x-x,site.y-y);
          for(const heading of [Math.round(toward/(PI/2))*PI/2,toward,toward+PI/2,toward-PI/2]) {
            stats.attempts++;
            const record=validator.valid(canonical(site,kind,{x,y,heading}));
            if(record){found=record;break search;}
          }
        }
      }
      if(!found){stats.missing.push(id);stats.ms=now()-started;return null;}
      validator.accept(found);records.push(found);
    }
    stats.ms=now()-started;return records;
  }

  function geometry(records) {
    const colliders=[],surfaces=[];
    for(const record of records||[]) {
      const w=record.width,d=record.depth,door=record.doorWidth||2.4,wall=.18,medical=record.kind==='medical',height=medical?2.65:3.05;
      function add(name,x,z,y,sx,sy,sz,walkable=false,roof=false) {
        const p=point(record,x,z,record.h+y),b={id:'ef-facility:'+record.id+':'+name,siteId:record.siteId,facilityId:record.id,
          kind:walkable?'floor':'wall',x:p.x,y:p.y,h:p.h,hx:sx/2,hy:sy/2,hz:sz/2,ry:record.heading,roof};
        colliders.push(b);if(walkable)surfaces.push({...b,kind:'surface',height:b.h+b.hy});return b;
      }
      const base=Math.max(.24,record.foundationDepth||1.2);
      add('floor',0,0,-base/2,w,base,d,true);
      for(let i=0;i<(record.steps||[]).length;i++) {
        const step=record.steps[i],thick=1.35;
        add('entry-'+i,0,step.z,step.h-record.h-thick/2,step.width,thick,step.depth,true);
      }
      add('back',0,-d/2,height/2,w,height,wall);
      add('left',-w/2,0,height/2,wall,height,d);
      add('right',w/2,0,height/2,wall,height,d);
      const side=(w-door)/2;
      add('front-left',-(door+side)/2,d/2,height/2,side,height,wall);
      add('front-right',(door+side)/2,d/2,height/2,side,height,wall);
      add('lintel',0,d/2,(height+2.42)/2,door,height-2.42,wall);
      // A tent's closed triangular roof volume is represented in narrow
      // horizontal slices, matching the pitched skin without sealing its door.
      if(medical)for(let i=0;i<8;i++) {
        const y=height+i/8,sw=(w+.45)*(1-i/8),overlap=i?.05:0;
        add('roof-'+i,0,0,y+.0625-overlap/2,sw,.125+overlap,d+.5,true,true);
      } else add('roof',0,0,height+.12,w+.45,.24,d+.5,true,true);
      if(record.kind==='armory') {
        add('rack-left',-w/2+.7,-.8,1.1,.85,2.2,d-2.2);
        add('rack-right',w/2-.7,-1,1.1,.85,2.2,d-2.5);
        add('secure-case',0,-d/2+.65,.78,2.5,1.56,.8);
      } else if(record.kind==='ammo') {
        add('crate-left',-w/2+1,-d/2+1.3,.8,1.5,1.6,2.0);
        add('crate-back',.4,-d/2+.75,.64,2.0,1.28,1.05);
        add('shelves',w/2-.68,-.6,1.15,.9,2.3,d-2.5);
      } else {
        add('bed-left',-w/2+1.1,-.8,.54,1.25,1.08,2.35);
        add('bed-right',w/2-1.1,-.8,.54,1.25,1.08,2.35);
        add('cabinet',0,-d/2+.65,1.05,1.6,2.1,.85);
      }
    }
    return {colliders,surfaces};
  }

  function build(THREE,{records=[],runtime=null,quality='high'}={}) {
    if(!THREE?.BufferGeometry||!THREE?.Group)throw new Error('Eastern facilities require Three.js.');
    const root=new THREE.Group();root.name='Eastern front armories, ammunition stores and medical tents';
    const geometries=new Set(),materials=new Set(),textures=new Set(),templates=new Map(),chunks=[],owners=new Map(),facilitiesById=new Map();
    let disposed=false,clock=.25,lastX=Infinity,lastZ=Infinity;
    const ownGeometry=g=>(geometries.add(g),g),ownMaterial=m=>(materials.add(m),m);
    const solid=ownMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:.12}));
    const teams={ally:ownMaterial(new THREE.MeshStandardMaterial({color:0x4caaa2,roughness:.8})),enemy:ownMaterial(new THREE.MeshStandardMaterial({color:0xb6624e,roughness:.8})),neutral:ownMaterial(new THREE.MeshStandardMaterial({color:0xb3a376,roughness:.8}))};
    const cubeSource=new THREE.BoxGeometry(1,1,1),cube=cubeSource.toNonIndexed();cubeSource.dispose();
    const tubeSource=new THREE.CylinderGeometry(1,1,1,8),tube=tubeSource.toNonIndexed();tubeSource.dispose();
    const tipSource=new THREE.ConeGeometry(1,1,8),tip=tipSource.toNonIndexed();tipSource.dispose();
    const v=new THREE.Vector3(),normal=new THREE.Vector3(),matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),color=new THREE.Color();
    function batch() {
      const positions=[],normals=[],colors=[];
      function append(source,x,y,z,sx,sy,sz,tint,rx=0,ry=0,rz=0) {
        quaternion.setFromEuler(new THREE.Euler(rx,ry,rz));matrix.compose(v.set(x,y,z),quaternion,scale.set(sx,sy,sz));color.set(tint);
        const p=source.attributes.position,n=source.attributes.normal,nm=new THREE.Matrix3().getNormalMatrix(matrix);
        for(let i=0;i<p.count;i++) {
          v.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();
          positions.push(v.x,v.y,v.z);normals.push(normal.x,normal.y,normal.z);
          // Stable material character is baked into the three shared facility
          // templates. Bounds, labels, ownership and physical entrances stay exact.
          const timber=tint===0x93805b,cloth=tint===0xd1d5be||tint===0xbec7ac;
          const grain=.5+.5*Math.sin(v.x*(timber?23:9)+v.z*13+Math.sin(v.y*7));
          const wear=.91+.065*grain+.045*Math.max(0,normal.y)-.035*(.5-p.getY(i));
          colors.push(color.r*wear*(timber?1.03:1),color.g*wear,color.b*wear*(timber?.93:cloth?.97:1));
        }
      }
      return {box:(x,y,z,sx,sy,sz,tint,rx=0,ry=0,rz=0)=>append(cube,x,y,z,sx,sy,sz,tint,rx,ry,rz),
        tube:(x,y,z,r,length,tint,rx=0,ry=0,rz=0)=>append(tube,x,y,z,r,length,r,tint,rx,ry,rz),
        tip:(x,y,z,r,length,tint,rx=0,ry=0,rz=0)=>append(tip,x,y,z,r,length,r,tint,rx,ry,rz),finish(name) {
        const g=ownGeometry(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingSphere();g.name=name;return g;
      }};
    }
    function template(record) {
      const key=record.kind+':'+record.scale;if(templates.has(key))return templates.get(key);
      const body=batch(),roof=batch(),w=record.width,d=record.depth,door=2.4,med=record.kind==='medical',h=med?2.65:3.05;
      const wall=med?0xd1d5be:record.kind==='armory'?0x617164:0x6e7355,frame=0x363f3b,steel=0x394446,wood=0x93805b,light=0xe7e6cc;
      body.box(0,h/2,-d/2,w,h,.18,wall);body.box(-w/2,h/2,0,.18,h,d,wall);body.box(w/2,h/2,0,.18,h,d,wall);
      const side=(w-door)/2;body.box(-(door+side)/2,h/2,d/2,side,h,.18,wall);body.box((door+side)/2,h/2,d/2,side,h,.18,wall);body.box(0,(h+2.42)/2,d/2,door,h-2.42,.18,wall);
      for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])body.box(x,h/2,z,.16,h+.12,.16,frame);
      for(const x of [-door/2,door/2])body.box(x,1.23,d/2+.1,.12,2.46,.14,frame);
      body.box(0,2.45,d/2+.1,door+.12,.12,.14,frame);
      for(const x of [-w/2-.012,w/2+.012])for(let j=0;j<5;j++)body.box(x,.35+j*.5,0,.06,.055,d,med?0x9aab8b:0x829080);
      body.box(0,.18,-d/2-.02,w,.28,.05,frame);
      // Roofs are separately batched so the third-person camera can reveal an
      // interior without changing any physical wall or ceiling collision.
      if(med) {
        const slope=Math.atan2(1,(w+.45)/2),length=Math.hypot((w+.45)/2,1);
        for(const sign of [-1,1])roof.box(sign*(w+.45)/4,h+.5,0,length,.12,d+.5,0xbec7ac,0,0,sign*-slope);
        roof.box(0,h+1,0,.12,.14,d+.55,frame);
        for(const z of [-d/2,d/2])for(let i=0;i<8;i++)roof.box(0,h+(i+.5)/8,z,(w+.45)*(1-(i+.5)/8),.125,.13,wall);
      } else {
        roof.box(0,h+.12,0,w+.45,.24,d+.5,0x424e4a);
        for(let x=-w/2;x<=w/2;x+=.55)roof.box(x,h+.27,0,.06,.055,d+.4,0x66736b);
      }
      const stripe=record.kind==='armory'?0x8ca9ac:record.kind==='ammo'?0xd7bf67:0x83aa91;
      body.box(0,2.85,d/2+.12,Math.min(w-1,4.8),.34,.08,stripe);
      if(record.kind==='armory') {
        // The issued six-weapon catalogue is visible on the racks. Profiles face
        // the central aisle; all small parts stay in the shared body batch.
        function displayWeapon(type,x,z,sign) {
          const black=0x20292b,metal=0x68787a,olive=0x72805a,brass=0xc5a85f,cy=1.12;
          const b=(u,v,length,height,thickness,tint,rx=0)=>body.box(x,cy+u,z-v,thickness,length,height,tint,rx);
          const barrel=(u,v,length,radius,tint=black)=>body.tube(x,cy+u,z-v,radius,length,tint);
          // Recessed backplate, stock rest and a bright issue-point stripe make
          // the stocked rack readable even under the low-quality lighting.
          body.box(x+sign*.18,1.13,z,.055,1.79,.72,0x46524b);
          body.box(x,.28,z,.5,.09,.72,steel);
          body.box(x-sign*.27,.43,z,.035,.08,.56,0xb4c9bd);
          if(type==='pistol') {
            body.box(x,1.42,z-.02,.15,.14,.48,black);
            body.box(x-sign*.08,1.44,z-.03,.022,.07,.36,metal);
            body.tube(x,1.4,z-.29,.033,.15,black,PI/2);
            body.box(x,1.19,z+.12,.13,.34,.17,0x5e6753,.24);
            body.box(x,1.29,z-.01,.09,.05,.19,black);
            body.box(x,1.32,z-.1,.09,.13,.04,black);
            body.box(x,1.52,z+.13,.07,.04,.045,metal);
            body.box(x,1.52,z-.2,.06,.04,.035,metal);
            for(const offset of [-.16,.07])body.box(x-sign*.09,.79,z+offset,.1,.29,.11,black);
            return;
          }
          if(type==='rpg') {
            barrel(-.04,0,1.46,.105,olive);
            barrel(-.72,0,.16,.145,black);barrel(.58,0,.14,.135,metal);
            barrel(.74,0,.27,.13,olive);body.tip(x,cy+.965,z,.13,.18,0xa9ad77);
            for(const u of [-.46,.28])barrel(u,0,.075,.116,brass);
            b(-.26,-.19,.22,.12,.13,black,.2);b(.17,-.18,.2,.105,.12,black);
            b(.28,.16,.28,.045,.055,black);b(.33,.205,.1,.04,.08,metal);
            return;
          }
          const sniper=type==='sniper',machine=type==='m249',shotgun=type==='shotgun';
          const stock=shotgun?wood:machine?olive:0x3e4c43;
          b(sniper?-.62:-.53,.015,sniper?.45:.36,.16,.17,stock);
          b(sniper?-.86:-.73,.005,.07,.23,.2,black);
          b(-.27,.01,.21,.105,.12,black);b(-.08,.025,.33,machine?.23:.17,machine?.22:.16,machine?olive:black);
          b(.22,.035,shotgun?.36:.32,shotgun?.15:.13,.15,shotgun?wood:machine?olive:0x4f5a54);
          barrel(sniper?.61:.49,.035,sniper?.57:.29,sniper?.031:.026);
          barrel(sniper?.91:.66,.035,.075,sniper?.043:.038,metal);
          b(-.18,-.17,.21,.12,.12,black,.2);
          if(machine) {
            b(-.02,-.24,.29,.3,.27,olive);b(-.08,.175,.25,.055,.24,black);
            for(const side of [-1,1])body.box(x+side*.12,cy+.32,z+.16,.035,.42,.035,black,side*.08);
            b(.24,.2,.3,.045,.05,black);
          } else if(shotgun) {
            barrel(.32,-.055,.54,.027,metal);
            for(let j=0;j<4;j++)body.tube(x-sign*.1,cy-.15+j*.065,z+.085,.026,.1,0xad5d42,PI/2);
          } else {
            b(.02,-.2,sniper?.19:.29,.12,.12,black,-.12);
          }
          if(sniper) {
            barrel(-.03,.23,.4,.058,black);barrel(.18,.23,.065,.078,metal);barrel(-.25,.23,.065,.068,metal);
            for(const u of [-.17,.1])b(u,.145,.045,.1,.075,black);
            body.box(x-sign*.075,cy+.03,z-.23,.055,.07,.075,metal);
          } else {
            b(-.12,.155,.13,.035,.06,metal);b(.46,.135,.045,.1,.045,black);
          }
        }
        const displayTypes=[['ar','shotgun','m249'],['sniper','rpg','pistol']];
        for(const sign of [-1,1]) {
          const x=sign*(w/2-.7);
          body.box(x,.2,-.9,.85,.16,d-2.2,steel);
          // A solid shelf top hides the entire gun row from an elevated third-
          // person view. Keep only the rear retaining rail above the stocks.
          body.box(x+sign*.29,2.05,-.9,.12,.12,d-2.2,steel);
          for(const z of [-d/2+.45,d/2-1.6])body.box(x,1.1,z,.1,2.2,.12,steel);
          displayTypes[sign<0?0:1].forEach((type,j)=>displayWeapon(type,x-sign*.08,-d/2+1.03+j*.98,sign));
        }
        body.box(0,.78,-d/2+.65,2.5,1.56,.8,0x454f49);
        for(let j=0;j<10;j++)body.box(-1.15+j*.255,1.15,-d/2+1.08,.035,1.9,.035,0xa4ada5);
        body.box(0,2.1,-d/2+1.08,2.5,.065,.065,steel);body.box(.9,.84,-d/2+1.12,.12,.22,.07,0xd0be79);
      } else if(record.kind==='ammo') {
        function crate(x,y,z,sx=1.35,sy=.65,sz=.9,open=false) {
          if(open) {
            body.box(x,y-sy/2+.045,z,sx,.09,sz,wood);
            for(const side of [-1,1]) {
              body.box(x+side*(sx/2-.035),y,z,.07,sy,sz,wood);
              body.box(x,y,z+side*(sz/2-.035),sx,sy,.07,wood);
            }
            body.box(x,y+sy/2+.12,z-sz*.34,sx,.06,sz*.58,wood,-.52);
            body.box(x,y-sy/2+.1,z,sx-.16,.025,sz-.16,0x333f35);
          } else body.box(x,y,z,sx,sy,sz,wood);
          for(const xx of [-sx*.34,sx*.34])for(const side of [-1,1])body.box(x+xx,y,z+side*(sz/2+.013),.07,sy+.035,.035,0x4d5748);
          body.box(x,y+.02,z+sz/2+.02,sx*.5,sy*.34,.025,0xb5af7e);
        }
        function cartridge(x,y,z) {
          body.tube(x,y,z,.036,.22,0xd8b85e);body.tube(x,y-.11,z,.043,.025,0xb89542);
          body.tip(x,y+.15,z,.036,.08,0xafa98d);
        }
        function grenade(x,y,z) {
          body.tube(x,y,z,.085,.14,0x63783e);body.tip(x,y+.09,z,.085,.08,0x63783e);
          body.tube(x,y+.155,z,.034,.06,0xb1a568);
          body.box(x+.07,y+.12,z,.035,.2,.045,0x9aa49a,0,0,.22);
        }
        for(let col=0;col<2;col++) {
          const x=-w/2+1,z=-d/2+.8+col*.95;
          crate(x,.34,z,1.35,.62,.9);crate(x,.96,z,1.35,.6,.9,true);
          if(col===0)for(let row=0;row<2;row++)for(let j=0;j<5;j++)cartridge(x-.4+j*.2,1.23,z-.1+row*.24);
          else for(let row=0;row<2;row++)for(let j=0;j<3;j++)grenade(x-.32+j*.32,1.2,z-.1+row*.26);
        }
        crate(.35,.34,-d/2+.72,2,.65,1);crate(.35,.85,-d/2+.72,1.5,.42,.9,true);
        for(const z of [-d/2+.58,-d/2+.9]) {
          body.tube(.23,1.11,z,.072,.73,0x6e834c,0,0,-PI/2);
          body.tip(.69,1.11,z,.092,.2,0xaaa875,0,0,-PI/2);
          body.tube(.53,1.11,z,.081,.055,0xc5aa5d,0,0,-PI/2);
          body.box(-.12,1.11,z,.15,.2,.025,steel);body.box(-.12,1.11,z,.15,.025,.2,steel);
        }
        const x=w/2-.68;
        for(const z of [-d/2+.5,d/2-1.5])body.box(x,1.15,z,.075,2.3,.075,steel);
        for(const y of [.25,1.05,1.95]) {
          body.box(x,y,-.6,.9,.08,d-2.5,steel);
          for(let j=0;j<3;j++)crate(x,y+.22,-d/2+.9+j*.8,.65,.38,.62);
        }
        body.box(x-.35,1.26,-d/2+1.47,.055,.055,1.94,0x4c5746);
        for(let j=0;j<12;j++)cartridge(x-.35,1.32,-d/2+.59+j*.16);
        for(const side of [-1,1])for(let j=0;j<3;j++)body.box(side*(door/2+.25),.5+j*.4,d/2+.105,.25,.13,.035,j%2?0x303830:0xe3bd52,0,0,-.5);
      } else {
        const crossX=-(w+door)/4;
        body.box(crossX,1.55,d/2+.125,1.05,.25,.065,0x377f63);
        body.box(crossX,1.55,d/2+.13,.25,1.05,.07,0x377f63);
        for(const sign of [-1,1]) {
          const x=sign*(w/2-1.1),z=-.8;
          for(const dx of [-.5,.5])for(const dz of [-1,1])body.box(x+dx,.32,z+dz,.09,.64,.09,steel);
          body.box(x,.55,z,1.25,.13,2.35,steel);body.box(x,.7,z,1.16,.2,2.2,0xe3e1cb);
          body.box(x,.84,z-.75,.85,.12,.55,0xf0eee0);body.box(x,.83,z+.4,1.18,.1,1.2,0x7e9d87);
          body.box(x,.85,z-1.13,1.26,.48,.06,steel);
        }
        body.box(0,1.05,-d/2+.65,1.6,2.1,.85,0xaab8a6);
        body.box(0,1.1,-d/2+1.085,.035,1.85,.025,steel);
        for(const x of [-.1,.1])body.box(x,1,-d/2+1.11,.035,.22,.04,steel);
        body.box(0,1.55,-d/2+1.105,.64,.18,.035,0x377f63);body.box(0,1.55,-d/2+1.11,.18,.64,.04,0x377f63);
        body.box(w/2-.35,1.4,d/2-1,.04,2.5,.04,steel);body.box(w/2-.35,2.6,d/2-1,.6,.08,.3,light);
      }
      const result={body:body.finish(key+' walls and equipment'),roof:roof.finish(key+' roof')};templates.set(key,result);return result;
    }
    const labelMaterials=new Map();
    function labelMaterial(kind) {
      if(labelMaterials.has(kind))return labelMaterials.get(kind);
      let material;
      try {
        const canvas=global.document?.createElement('canvas');if(!canvas)throw new Error('no canvas');canvas.width=512;canvas.height=128;
        const ctx=canvas.getContext('2d');if(!ctx)throw new Error('no 2d context');
        ctx.fillStyle=kind==='medical'?'#e1e9da':kind==='ammo'?'#caba79':'#adc6bd';ctx.fillRect(0,0,512,128);
        ctx.strokeStyle='#283b32';ctx.lineWidth=7;ctx.strokeRect(5,5,502,118);ctx.fillStyle='#24372e';ctx.font='900 70px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(TITLES[kind],256,64,480);
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;textures.add(texture);
        material=ownMaterial(new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));
      } catch (_) {material=ownMaterial(new THREE.MeshBasicMaterial({color:kind==='medical'?0xd9e6d1:kind==='ammo'?0xd1bd76:0xb4cec1}));}
      labelMaterials.set(kind,material);return material;
    }
    const signGeometry=ownGeometry(new THREE.PlaneGeometry(2.8,.7)),bandGeometry=ownGeometry(new THREE.BoxGeometry(.16,1.8,.16));
    function mesh(geometry,material,parent,name) {const m=new THREE.Mesh(geometry,material);m.name=name;m.receiveShadow=true;parent.add(m);return m;}
    for(const record of records) {
      const t=template(record),group=new THREE.Group();group.name=TITLES[record.kind]+' '+record.siteId;group.userData={facilityId:record.id,siteId:record.siteId,kind:record.kind,
        displayContents:record.kind==='armory'?['ar','shotgun','m249','sniper','rpg','pistol']:record.kind==='ammo'?['cartridges','ammunition-belt','rockets','grenades']:['beds','medical-cabinet']};
      group.position.set(record.x,record.h,record.y);group.rotation.y=record.heading;root.add(group);
      const body=mesh(t.body,solid,group,'Walls and '+TITLES[record.kind]+' equipment'),roof=mesh(t.roof,solid,group,'Removable view roof');
      const base=batch();base.box(0,-record.foundationDepth/2,0,record.width,record.foundationDepth,record.depth,0x777a6b);
      for(const step of record.steps||[])base.box(0,step.h-record.h-.675,step.z,step.width,1.35,step.depth,0x8a8d7d);
      const foundation=mesh(base.finish(record.id+' foundation and entry steps'),solid,group,'Walkable foundation and steps');
      const sign=mesh(signGeometry,labelMaterial(record.kind),group,TITLES[record.kind]+' sign');sign.position.set(0,record.kind==='medical'?3:2.94,record.depth/2+.22);
      const team=runtime?.getSite(record.siteId)?.owner||'neutral',marker=mesh(bandGeometry,teams[team]||teams.neutral,group,'Ownership marker');marker.position.set(-record.width/2+.25,1.15,record.depth/2+.18);
      const chunk={record,group,body,roof,meshes:[body,roof,foundation,sign,marker],marker,distance:Infinity};chunks.push(chunk);facilitiesById.set(record.id,chunk);
      let list=owners.get(record.siteId);if(!list)owners.set(record.siteId,list=[]);list.push(chunk);
    }
    cube.dispose();tube.dispose();tip.dispose();
    function querySurfaceVisuals(worldBox,collider) {
      if(disposed||!worldBox?.min||!worldBox?.max||!collider?.facilityId)return [];
      const chunk=facilitiesById.get(collider.facilityId),prefix='ef-facility:'+collider.facilityId+':';
      if(!chunk||typeof collider.id!=='string'||!collider.id.startsWith(prefix))return [];
      const part=collider.id.slice(prefix.length),roof=/^roof(?:-\d+)?$/.test(part);
      if(!roof&&!['back','left','right','front-left','front-right','lintel'].includes(part))return [];
      const mesh=roof?chunk.roof:chunk.body,vector=p=>Array.isArray(p)?new THREE.Vector3(...p):new THREE.Vector3(p.x,p.y,p.z);
      const box=new THREE.Box3(vector(worldBox.min),vector(worldBox.max));
      if(![...box.min.toArray(),...box.max.toArray()].every(finite)||box.isEmpty())return [];
      // One direct facility lookup, no traversal of the battlefield or stock.
      mesh.updateWorldMatrix(true,false);if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld).intersectsBox(box.expandByScalar(.25))?[mesh]:[];
    }
    function setOwnership(siteId,team) {const list=owners.get(siteId);if(!list||disposed)return false;for(const chunk of list)chunk.marker.material=teams[team]||teams.neutral;return true;}
    function update({camera,player,dt=0,visible=true,quality:nextQuality}={}) {
      if(disposed)return;const wasVisible=root.visible;root.visible=!!visible;if(!visible){if(wasVisible)for(const chunk of chunks)runtime?.setFacilitySurfaceVisible?.(chunk.record.id,false,false);return;}
      if(nextQuality&&nextQuality!==quality){quality=nextQuality;clock=.25;}
      const position=camera?.position||camera;if(!position||!finite(position.x)||!finite(position.z))return;
      clock+=Math.max(0,dt);
      if(clock<.15&&Math.hypot(position.x-lastX,position.z-lastZ)<4)return;
      clock=0;lastX=position.x;lastZ=position.z;
      const range=quality==='low'?360:quality==='medium'?500:650,limit=quality==='low'?15:quality==='medium'?21:30;
      for(const chunk of chunks)chunk.distance=Math.hypot(position.x-chunk.record.x,position.z-chunk.record.y);
      const order=[...chunks].sort((a,b)=>a.distance-b.distance);let shown=0;
      for(const chunk of order) {
        const show=chunk.distance<range&&shown<limit;chunk.group.visible=show;if(!show){runtime?.setFacilitySurfaceVisible?.(chunk.record.id,false,false);continue;}shown++;
        const r=chunk.record,c=Math.cos(r.heading),s=Math.sin(r.heading),dx=position.x-r.x,dz=position.z-r.y;
        const cameraInside=Math.abs(c*dx-s*dz)<r.width/2+.5&&Math.abs(s*dx+c*dz)<r.depth/2+.5&&position.y<r.h+7;
        // A shoulder camera can remain outside while the player is inside.
        // Use native horizontal x/y plus feet h, not the camera's x/y/z axes.
        const px=player?.x-r.x,pz=player?.y-r.y;
        const playerInside=finite(px)&&finite(pz)&&finite(player?.h)&&Math.abs(player.h-r.h)<1.45&&
          Math.abs(c*px-s*pz)<r.width/2-.12&&Math.abs(s*px+c*pz)<r.depth/2-.12;
        chunk.roof.visible=!(cameraInside||playerInside);chunk.roof.userData.surfaceDestructionVisible=chunk.roof.visible;
        runtime?.setFacilitySurfaceVisible?.(r.id,true,chunk.roof.visible);
        for(const part of chunk.meshes)part.castShadow=quality!=='low'&&chunk.distance<150&&part!==chunk.marker;
      }
    }
    function dispose() {
      if(disposed)return;runtime?.unbindFacilitySurfaceVisuals?.();disposed=true;root.removeFromParent();root.clear();
      for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
      geometries.clear();materials.clear();textures.clear();templates.clear();owners.clear();facilitiesById.clear();chunks.length=0;
    }
    return {root,update,setOwnership,querySurfaceVisuals,dispose,stats:{facilities:records.length,templates:templates.size,geometries:geometries.size,materials:materials.size,textures:textures.size,maxVisibleDrawCalls:(quality==='low'?15:quality==='medium'?21:30)*5}};
  }
  global.HanQEasternFacilities=Object.freeze({version:1,visualRevision:'facility-stock-20261123-v4',kinds:KINDS,titles:TITLES,plan,geometry,build});
})(typeof window!=='undefined'?window:globalThis);



