/* WESTPORT v2 — native G Royale adapter.
 * Shares the host player, camera, weapons, damage, save and Three scene.
 * The authoring assets contain geometry/data only; CityGame is deliberately
 * not loaded. Runtime vectors use Three's {x,y,z}, where y is absolute height.
 */
(function (root) {
'use strict';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const clone = o => JSON.parse(JSON.stringify(o));

function create(host) {
  const T = host.THREE || root.THREE, W = host.world;
  if (!T || !W || !root.CityInteriors || !root.CitySimulation) throw new Error('WESTPORT assets or THREE are missing');
  const state = {buildingId: null, floor: 0, baseY: null, ride: 0, rideTarget: 0, uiOpen: false, extraFloorPending: false, disposed: false};
  const sim = root.CitySimulation.create(W, {population: 240, responders: 8, seed: 885202612, isHitBlocked: person => hitBlocked(person)});
  const brokenWindows = new Set(), instanceRecords = new Map(), windowRecords = new Map(), roomCache = new Map();
  const buildingRecords = new Map(), collisionGrid = new Map(), chunks = new Map();
  const outsideProps=[],propGrid=new Map();let propQuery=0;
  // Surface owners are lazy and shared with the native world. Stable IDs survive
  // floor/chunk eviction without adding render objects to the saved world graph.
  const surfaceParts = new WeakMap(), surfaceRecords = new Map(), damagedBuildings = new Set(), damagedFloors = new Map(), floorDataCache = new Map();
  const surfaceBody = new T.Box3(), surfacePoint = new T.Vector3();
  let surfaceEpoch=1;
  let collisionQuery = 0;
  const hqBuildings = root.HanQHQ50Buildings?.createAdapter({THREE:T}), hqFacades = new Map(), hqActiveBuildings = new Set();
  const hqBuildingTypes = new Set(['restaurant','warehouse','market','shop_row','fire_station','station','museum','ferry_terminal','police']);
  const hqParkedSpecs=root.HanQHQ50Vehicles?(W.parkedCars||[]).filter(s=>s.decorativeRetained):[],hqParkedVisuals=new Map();
  const hqParkedParts=new Set(hqParkedSpecs.flatMap(s=>s.originalParts||[]));
  const gridSize = 80, chunkSize = 256, geometries = new Map(), materials = new Map();
  const civilianVisuals = new Map(), civilianVisualCache = new Map(), swatVisuals = new Map(), swatVisualCache = new Map(), civilianSphere = new T.Sphere(new T.Vector3(), 1.4); let civilianVisualTime = 0, swatVisualTime = 0;
  const container = new T.Group(), staticRoot = new T.Group(), actorsRoot = new T.Group(), effectsRoot = new T.Group();
  container.name = 'WESTPORT native city'; staticRoot.name = 'WESTPORT spatial chunks';
  actorsRoot.name = 'WESTPORT citizens and responders'; container.add(staticRoot, actorsRoot, effectsRoot);
  const dummy = new T.Object3D(), pose = new T.Object3D(), partObject = new T.Object3D();
  const matrix = new T.Matrix4(), zero = new T.Matrix4().makeScale(0, 0, 0), color = new T.Color();
  const ray = new T.Ray(), hitPoint = new T.Vector3(), frustum = new T.Frustum(), projection = new T.Matrix4();
  const actorEye = new T.Vector3(); let actorCamera = null, actorFovScale = 1;
  const collisionWall = {kind: 'westport', westport: true, hgt: 300, height: 300};
  const effects = [], warnings = [], floorRefs = [];
  let floorModel = null, floorGroup = null, currentBuilding = null, currentBoxes = [], walkBoxes = [];
  const neighborFloors=new Map();
  let activeFloorPeople=[];
  const fallingPeople=new Set(),relocatedPeople=new Set();
  let mountedScene = null, lastHud = -1, lastUiEnabled = null, frame = 0, clockOffset = 0, ui = null, extraFloorToken = 0;
  let pools = null, lastNativeAlive = true, responseGeneration = 0;
  let distantCivilianDebt = 0;
  // Render caches follow camera interest, independently of durable city state.
  // A little distance/time hysteresis avoids rebuilding when turning around or
  // crossing a chunk edge. This clock advances only during active simulation.
  const renderCacheGrace = 12, detailKeepDistance = 320;
  let renderCacheClock = 0, chunkEvictions = 0, detailEvictions = 0, swatCreations = 0, swatReuses = 0, civilianCreations = 0, civilianReuses = 0;
  let hitReactions = null, hitScenes = new WeakMap();
  // g-royale embeds the shared controller after these authoring assets load.
  // Keep transient reactions out of city saves and share one clock with AI.
  function getHitReactions() {
    if (!hitReactions && root.HanQHitFeedback?.createReactions) hitReactions = root.HanQHitFeedback.createReactions();
    return hitReactions;
  }
  function hitScene(person) {return person.indoor ? 'westport:' + person.buildingId + ':' + (person.floor || 1) : 'world';}
  function hitPose(person) {
    const reactions = getHitReactions(); if (!reactions || !person) return null;
    const previous = hitScenes.get(person);
    if (previous && previous !== hitScene(person)) {reactions.clear(person); hitScenes.delete(person);}
    return reactions.sample(person, sim.time);
  }
  function hitBlocked(person) {return !!person?.surfaceFalling || !!hitPose(person)?.blocked;}
  function resetHitReactions() {hitReactions?.reset(); hitScenes = new WeakMap();}
  function copyPoint(p) {return p && [p.x, p.y, p.z].every(Number.isFinite) ? {x: p.x, y: p.y, z: p.z} : null;}
  function actorRegion(person, at, reaction = hitPose(person)) {
    if (!at) return 'torso';
    const dx = at.x - person.x, dz = at.z - person.z, heading = finite(person.heading);
    const local = {forward: dx * Math.sin(heading) + dz * Math.cos(heading), up: at.y - person.y, right: dx * Math.cos(heading) - dz * Math.sin(heading)};
    if (reaction?.proneK > 0 && root.HanQHitFeedback?.regionAt) return root.HanQHitFeedback.regionAt(local, reaction);
    const headAt = person.officeStaff ? finite(person.officeHeadAt, 1.42) : (person.height || 1.78) * .79;
    return local.up > headAt ? 'head' : local.up < .80 ? 'leg' : 'torso';
  }
  function setHitRoot(object, person, reaction) {
    const heading = finite(person.heading), offset = finite(reaction?.forwardOffset);
    object.position.set(person.x + Math.sin(heading) * offset, person.y + finite(reaction?.rootOffsetY, -finite(reaction?.rootDrop)), person.z + Math.cos(heading) * offset);
    object.rotation.set(finite(reaction?.tilt), heading, 0, 'YXZ'); object.scale.set(1, 1, 1);
  }
  const say = message => { if (host.say) host.say(message); };
  const glassKey = (buildingId, pane) => buildingId + '|' + pane;
  const nativeState = () => host.getState ? host.getState() : null;
  const active = () => !state.disposed && !host.isSuspended?.() && (!host.getState || nativeState()?.mode === 'open');
  function player() {
    const p = host.getPlayer ? host.getPlayer() : null;
    const e = p?.entity || nativeState()?.ents?.[0] || null;
    return {entity: e, x: finite(p?.x, e?.x || 0), y: finite(p?.h, finite(p?.y, state.baseY || 0)), z: finite(p?.z, e?.y || 0),
      hp: finite(e?.hp, 100), alive: e ? e.alive !== false : p?.alive !== false,
      interior: !!state.buildingId, buildingId: state.buildingId, floor: state.floor};
  }
  function syncPlayer() {
    const p = player();
    Object.assign(sim.player, {x: p.x, y: p.y, z: p.z, hp: Math.max(0, p.hp), maxHp: finite(p.entity?.maxHp, 100), dead: !p.alive,
      interior: p.interior, buildingId: p.buildingId, floor: p.floor});
    return p;
  }
  // Native armor, vehicles, invulnerability and death remain authoritative.
  // Emit the complete incoming damage: stock simulation clips lethal damage to
  // its own HP, which would incorrectly weaken a bomb before native armor.
  sim.damagePlayer = function (amount, source = 'unknown', details = {}) {
    if (!Number.isFinite(amount) || amount <= 0 || sim.player.dead) return 0;
    sim.events.push({type: 'player-hit', amount, source, time: sim.time, nativeDamage: true, from: details.from, to: details.to, eqExplosion: details.eqExplosion === true});
    return amount;
  };
  // Unseen damage is directional evidence, never a new sighting. Store only
  // a noisy impact-time bearing; subsequent shots cannot follow the player.
  function swatSameSpace(a, b) {
    const ai = !!(a.indoor || a.interior), bi = !!(b.indoor || b.interior);
    return ai === bi && (!ai || a.buildingId === b.buildingId && a.floor === b.floor);
  }
  function swatSeesPlayer(p) {
    const target = sim.player;
    if (!p || p.dead || p.embarked || p.active === false || target.dead || !swatSameSpace(p, target)) return false;
    const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
    if (d > 68 || Math.abs(target.y - p.y) > 5) return false;
    if (d > .01 && (dx * Math.sin(p.heading) + dz * Math.cos(p.heading)) / d < Math.cos(58 * Math.PI / 180)) return false;
    return lineOfSight({x:p.x,y:p.y+1.45,z:p.z}, {x:target.x,y:target.y+1.35,z:target.z});
  }
  function swatAttackCue(victim) {
    const target = sim.player, distance = Math.hypot(target.x - victim.x, target.z - victim.z);
    const angle = Math.atan2(target.x - victim.x, target.z - victim.z) + (Math.random() - .5) * .7;
    const range = clamp(distance * (.65 + Math.random() * .5), 18, 100);
    return {x:victim.x+Math.sin(angle)*range, z:victim.z+Math.cos(angle)*range};
  }
  function swatStartSuppression(p, cue, reason) {
    if (!p || p.dead || p.active === false || p.embarked || !swatSameSpace(p, sim.player) || swatSeesPlayer(p)) return false;
    // Repeated injuries in one volley do not refill a burst or extend its life.
    if ((p.suppression && sim.time < p.suppression.expiresAt) || sim.time < finite(p.suppressionRestUntil, -1)) return false;
    // The fresh check above outranks a still-valid perception sample. An
    // unseen hit cannot retain sight or cancel the suppression it just began.
    p.hasVisualContact = false;
    const angle = Math.atan2(cue.x - p.x, cue.z - p.z) + (Math.random() - .5) * .3;
    p.suppression = {angle, pitch:(Math.random()-.5)*.12, reason, startedAt:sim.time,
      expiresAt:sim.time+4.5, rounds:18, burst:0};
    p.fireCooldown = Math.max(finite(p.fireCooldown), .3 + Math.random() * .35);
    return true;
  }
  function swatDamageSuppression(victim, killed, source) {
    if (source !== 'player' || !victim || !active() || sim.player.dead || !swatSameSpace(victim, sim.player)) return;
    const cue = swatAttackCue(victim);
    if (!killed) swatStartSuppression(victim, cue, 'hit');
    else for (const p of sim.swat) {
      if (p === victim || p.dead || p.embarked || p.active === false || !swatSameSpace(p, victim)) continue;
      if (Math.hypot(p.x-victim.x,p.y-victim.y,p.z-victim.z) > 28) continue;
      if (!lineOfSight({x:p.x,y:p.y+1.45,z:p.z}, {x:victim.x,y:victim.y+1.1,z:victim.z})) continue;
      swatStartSuppression(p, cue, 'ally-down');
    }
  }
  const cityDamageSwat = sim.damageSwat;
  sim.damageSwat = function (id, amount, source = 'player') {
    const victim = typeof id === 'object' ? id : sim.swat.find(p => p.id === id);
    const result = cityDamageSwat.call(sim, id, amount, source);
    if (result.hit) swatDamageSuppression(victim, result.killed, source);
    return result;
  };
  function swatUpdateSuppression() {
    if (!sim.defcon || sim.player.dead || host.isPaused?.()) return;
    for (const p of sim.swat) {
      const q = p.suppression; if (!q) continue;
      if (p.dead || p.embarked || p.active === false || !swatSameSpace(p, sim.player) || p.hasVisualContact || sim.time >= q.expiresAt || q.rounds <= 0) {
        p.suppression = null; p.suppressionRestUntil = sim.time + 1.5; continue;
      }
      // This burst runs after CitySimulation.step, so honor the same injury
      // lock before turning or firing. The original volley deadline still runs.
      if (hitBlocked(p)) continue;
      p.responseState = 'suppressing';
      p.heading = q.angle;
      if (p.fireCooldown > 0 || typeof host.spawnSuppressionBullet !== 'function') continue;
      if (q.burst <= 0) q.burst = Math.min(q.rounds, 2 + Math.floor(Math.random() * 4));
      const angle = q.angle + (Math.random() - .5) * .56, pitch = q.pitch + (Math.random() - .5) * .18;
      const cp = Math.cos(pitch), direction = {x:Math.sin(angle)*cp,y:Math.sin(pitch),z:Math.cos(angle)*cp};
      const from = {x:p.x,y:p.y+1.35,z:p.z};
      // The host uses its normal moving-bullet collision path. A guessed ray
      // itself never generates player-hit or a guaranteed damage event.
      const fired = host.spawnSuppressionBullet({actor:p,from,direction,damage:4,speed:180,life:1.2,source:'swat',suppression:true});
      if (fired === false) {p.fireCooldown = .3; continue;}
      q.rounds--; q.burst--; sim.stats.shotsByResponders++;
      p.suppressionShotAt = sim.time;
      p.fireCooldown = q.burst > 0 ? .12 + Math.random() * .08 : .45 + Math.random() * .45;
      host.onEvent?.({type:'suppression-shot',swatId:p.id,from,direction,time:sim.time});
    }
  }
  function point(b, p, base = 0) {
    const scale = b.scale || 1, c = Math.cos(b.rotation || 0), s = Math.sin(b.rotation || 0);
    return {x: b.x + (p.x * c + p.z * s) * scale, y: b.y + (base + finite(p.y)) * scale, z: b.z + (-p.x * s + p.z * c) * scale};
  }
  function localPoint(b, p, base = 0) {
    const scale = b.scale || 1, c = Math.cos(b.rotation || 0), s = Math.sin(b.rotation || 0), x = (p.x - b.x) / scale, z = (p.z - b.z) / scale;
    return {x: x * c - z * s, y: (p.y - b.y) / scale - base, z: x * s + z * c};
  }
  function partBox(p) {
    dummy.position.set(finite(p.x), finite(p.y), finite(p.z)); dummy.rotation.set(finite(p.rx), finite(p.ry), finite(p.rz));
    dummy.scale.set(finite(p.sx, 1), finite(p.sy, 1), finite(p.sz, 1)); dummy.updateMatrix();
    return new T.Box3(new T.Vector3(-.5, -.5, -.5), new T.Vector3(.5, .5, .5)).applyMatrix4(dummy.matrix);
  }
  function localBox(b, c, base = 0) {
    const box = new T.Box3();
    for (const x of [c.min[0], c.max[0]]) for (const y of [c.min[1], c.max[1]]) for (const z of [c.min[2], c.max[2]]) {
      const p = point(b, {x, y, z}, base); box.expandByPoint(new T.Vector3(p.x, p.y, p.z));
    }
    return box;
  }
  function regionContains(x, z) {
    if (host.contains) return !!host.contains(x, z);
    return root.CityWorld.inside(x, z, W.coastline) || x >= W.bridge.x0 && x <= W.bridge.x1 && Math.abs(z - W.bridge.z) < 19;
  }
  function outsideGround(x, z) {
    const value = host.groundAt?.(x, z);
    if (Number.isFinite(value)) return value;
    const b = W.bridge;
    if (x >= b.x0 && x <= b.x1 && Math.abs(z - b.z) <= 12 && b.roadSamples?.length > 1) {
      const u = clamp((x - b.x0) / (b.x1 - b.x0), 0, 1) * (b.roadSamples.length - 1), i = Math.min(b.roadSamples.length - 2, Math.floor(u));
      return b.roadSamples[i].y + (b.roadSamples[i + 1].y - b.roadSamples[i].y) * (u - i);
    }
    return root.CityWorld.inside(x, z, W.coastline) ? W.ground + .36 : .1;
  }
  for (const b of W.buildings) {
    const profile = root.CityInteriors.profile(b.type, 1), scale = b.scale || 1;
    const groundBox = localBox(b, {min: [-profile.width / 2, -.5, -profile.depth / 2], max: [profile.width / 2, 1, profile.depth / 2]});
    const rec = {building: b, profile, door: point(b, {x: 0, y: .15, z: profile.depth / 2 + 2}),
      box: new T.Box3(new T.Vector3(groundBox.min.x - 2, b.y - .5, groundBox.min.z - 2), new T.Vector3(groundBox.max.x + 2, b.y + b.height + 4, groundBox.max.z + 2)),
      sourceParts: [], parts: null, floorBounds: null};
    buildingRecords.set(b.id, rec);
    for (let x = Math.floor((groundBox.min.x - 1) / gridSize); x <= Math.floor((groundBox.max.x + 1) / gridSize); x++)
      for (let z = Math.floor((groundBox.min.z - 1) / gridSize); z <= Math.floor((groundBox.max.z + 1) / gridSize); z++) {
        const key = x + ',' + z; if (!collisionGrid.has(key)) collisionGrid.set(key, []); collisionGrid.get(key).push(rec);
      }
  }
  const geometryParts = W.parts.filter(p => p.group !== 'original' && p.role !== 'original-terrain' && p.role !== 'reference-building' && p.group !== 'boats' && !hqParkedParts.has(p));
  for (const p of geometryParts) {
    if (p.buildingId && p.shape === 'box' && p.sy >= .055) buildingRecords.get(p.buildingId)?.sourceParts.push(p);
    const key = Math.floor((p.x || 0) / chunkSize) + ',' + Math.floor((p.z || 0) / chunkSize);
    if (!chunks.has(key)) chunks.set(key, {key, parts: [], group: null, box: new T.Box3()});
    const chunk = chunks.get(key); chunk.parts.push(p);
    if (p.shape === 'mesh' && p.vertices) {
      for (let i = 0; i < p.vertices.length; i += 3) chunk.box.expandByPoint(new T.Vector3(p.vertices[i] + finite(p.x), p.vertices[i + 1] + finite(p.y), p.vertices[i + 2] + finite(p.z)));
    } else chunk.box.union(partBox(p));
  }
  // One facade owner per centre chunk. Authoritative sourceParts above remain
  // complete for every floor, window, movement collision and ballistics query.
  if (hqBuildings) for (const rec of buildingRecords.values()) if (hqBuildingTypes.has(rec.building.type)) {
    const b=rec.building,key=Math.floor(b.x/chunkSize)+','+Math.floor(b.z/chunkSize);
    if(!chunks.has(key))chunks.set(key,{key,parts:[],group:null,box:new T.Box3()});
    const chunk=chunks.get(key);(chunk.hqBuildings||(chunk.hqBuildings=[])).push(rec);
    chunk.box.union(rec.box.clone().expandByScalar(8));
  }
  for(const spec of hqParkedSpecs){const key=Math.floor(spec.x/chunkSize)+','+Math.floor(spec.z/chunkSize);if(!chunks.has(key))chunks.set(key,{key,parts:[],group:null,box:new T.Box3()});const chunk=chunks.get(key);(chunk.hqParked||(chunk.hqParked=[])).push(spec);chunk.box.union(new T.Box3(new T.Vector3(spec.x-12,W.ground-1,spec.z-12),new T.Vector3(spec.x+12,W.ground+7,spec.z+12)));}
  function surfaceKind(p) {
    if(p.windowId)return 'glass';
    if(/^(floor|terrace)$/.test(p.role||''))return 'floor';
    if(/^(ceiling|roof|canopy)$/.test(p.role||''))return 'ceiling';
    return 'wall';
  }
  function recordParts(rec) {
    if (!rec.parts) rec.parts = rec.sourceParts.map((p, i) => {
      const c={box:partBox(p),kind:surfaceKind(p),id:p.windowId||p.role||'structure',buildingId:p.buildingId,floor:p.floor||0,part:p};
      if(surfaceEligible(p)){c.surfaceKey='westport:'+encodeURIComponent(rec.building.id)+':facade:'+i;surfaceParts.set(p,c);}
      return c;
    });
    return rec.parts;
  }
  // Fixed visible solids share one static spatial index. Explicit authoring
  // roles also cover benches, cargo and the actual bridge rail tubes.
  // Leaves, paving, lighting arms and decorative thin details are not
  // turned into invisible boxes, and no movement query traverses the scene.
  for(const p of geometryParts){
    const selected=p.role==='tree'&&p.material==='wood'&&p.shape==='cylinder'||
      /^(streetlight|dock-lamp)$/.test(p.role||'')&&p.material==='metal'&&p.sy>1||
      /^(fountain|colonnade|bench|cargo-container|crane-solid|court-screen|bridge-rail|bridge-pole)$/.test(p.role||'');
    const tilted=Math.abs(finite(p.rx))>1e-9||Math.abs(finite(p.rz))>1e-9;
    if(!selected||!['box','cylinder'].includes(p.shape)||tilted&&!(p.shape==='cylinder'&&p.role==='bridge-rail'))continue;
    const rec=p.buildingId?recordParts(buildingRecords.get(p.buildingId)).find(c=>c.part===p):null;
    const c=rec||{box:partBox(p),part:p,kind:'wall',id:'outside-prop-'+outsideProps.length};
    c.outsideProp=true;c.propCos=Math.cos(finite(p.ry));c.propSin=Math.sin(finite(p.ry));c.propTilt=tilted;
    const rotation=new T.Quaternion().setFromEuler(new T.Euler(finite(p.rx),finite(p.ry),finite(p.rz)));
    c.propAxes=[new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)].map(v=>v.applyQuaternion(rotation));
    outsideProps.push(c);
    for(let x=Math.floor(c.box.min.x/gridSize);x<=Math.floor(c.box.max.x/gridSize);x++)for(let z=Math.floor(c.box.min.z/gridSize);z<=Math.floor(c.box.max.z/gridSize);z++){
      const key=x+','+z;if(!propGrid.has(key))propGrid.set(key,[]);propGrid.get(key).push(c);
    }
  }
  function queryProps(x,z,radius,visit){
    if(!outsideProps.length||![x,z,radius].every(Number.isFinite)||radius<0)return null;
    if(radius>gridSize){for(const c of outsideProps)if(visit(c))return c;return null;}
    const query=++propQuery,x0=Math.floor((x-radius)/gridSize),x1=Math.floor((x+radius)/gridSize),z0=Math.floor((z-radius)/gridSize),z1=Math.floor((z+radius)/gridSize);
    for(let ix=0;ix<=x1-x0;ix++)for(let iz=0;iz<=z1-z0;iz++)for(const c of propGrid.get((x0+ix)+','+(z0+iz))||[]){
      if(c.propQuery===query)continue;c.propQuery=query;if(visit(c))return c;
    }
    return null;
  }
  function propTouches(c,x,z,feet,height,radius){
      if(c.buildingId===state.buildingId||feet+.06>=c.box.max.y||feet+height-.01<=c.box.min.y)return false;
      const p=c.part;
      if(p.shape==='cylinder'){
        if(c.propTilt){
          // Closest distance between the real inclined tube axis and the
          // actor's vertical body segment. A long rail's AABB would create a
          // floating wall on an approach slope.
          const axis=c.propAxes[1],half=Math.abs(p.sy)/2,a={x:p.x-axis.x*half,y:p.y-axis.y*half,z:p.z-axis.z*half};
          const vx=axis.x*half*2,vy=axis.y*half*2,vz=axis.z*half*2,dx=a.x-x,dz=a.z-z;
          const bottom=feet+.06,top=feet+height-.01,horizontal=vx*vx+vz*vz,total=horizontal+vy*vy;
          const samples=[0,1];if(horizontal>1e-12)samples.push(-(dx*vx+dz*vz)/horizontal);
          if(Math.abs(vy)>1e-12)samples.push((bottom-a.y)/vy,(top-a.y)/vy);
          if(total>1e-12)for(const level of[bottom,top])samples.push(-(dx*vx+dz*vz+(a.y-level)*vy)/total);
          let distance2=Infinity;for(const value of samples){const t=clamp(value,0,1),yy=a.y+vy*t,dy=yy-clamp(yy,bottom,top);distance2=Math.min(distance2,(dx+vx*t)**2+(dz+vz*t)**2+dy*dy);}
          return distance2<(Math.max(Math.abs(p.sx),Math.abs(p.sz))/2+radius)**2;
        }
        const reach=Math.max(Math.abs(p.sx),Math.abs(p.sz))/2+radius;
        if((x-p.x)**2+(z-p.z)**2>=reach*reach)return false;
        return surfaceBodySolid(c,x,z,feet,height,radius);
      }
      return recordBodyBlocked(c,x,z,feet,height,radius);
  }
  function propBodyAt(x,z,feet,height,radius,ignored){
    return queryProps(x,z,radius,c=>!ignored?.has(c)&&propTouches(c,x,z,feet,height,radius));
  }
  function propContainsPoint(c,point){
    if(c.buildingId===state.buildingId||!c.box.containsPoint(point))return false;
    const p=c.part,dx=point.x-p.x,dy=point.y-p.y,dz=point.z-p.z;
    if(c.propTilt){const q=c.propAxes.map(a=>dx*a.x+dy*a.y+dz*a.z),r=Math.max(Math.abs(p.sx),Math.abs(p.sz))/2;return Math.abs(q[1])<=Math.abs(p.sy)/2&&q[0]*q[0]+q[2]*q[2]<=r*r;}
    if(p.shape==='cylinder'){
      const r=Math.max(Math.abs(p.sx),Math.abs(p.sz))/2;if(dx*dx+dz*dz>r*r)return false;
    }else if(Math.abs(dx*c.propCos-dz*c.propSin)>Math.abs(p.sx)/2||Math.abs(dx*c.propSin+dz*c.propCos)>Math.abs(p.sz)/2)return false;
    return surfacePointSolid(c,point);
  }
  function outsideSupportAt(x,z,maxY){
    if(currentBuilding||!Number.isFinite(maxY))return undefined;
    let best;const point=new T.Vector3(x,0,z);
    queryProps(x,z,0,c=>{
      const owner=surfaceHasCuts(c),rayHit=c.propTilt?propRayHit(c,{origin:{x,y:maxY,z},direction:{x:0,y:-1,z:0}},Math.max(0,maxY-c.box.min.y)+1):null;
      const top=owner?surfaceRuntime().supportAt(owner,x,z,maxY):c.propTilt?(rayHit?maxY-rayHit.distance:undefined):c.box.max.y;
      if(!Number.isFinite(top)||top>maxY+.001||best!==undefined&&top<=best)return false;
      point.y=top-.001;if(propContainsPoint(c,point))best=top;return false;
    });
    return best;
  }
  function recoverOutside(x,z,radius=.35,entity){
    if(currentBuilding||!regionContains(x,z)||!Number.isFinite(radius)||radius<0)return null;
    const ground=outsideGround(x,z),feet=ground+finite(entity?.floor)+finite(entity?.jz)+finite(entity?.altitude,finite(entity?.alt)),height=entity?.roll?1:entity?.crouch?1.15:1.8;
    if(!propBodyAt(x,z,feet,height,radius))return null;
    const overlapping=new Set();queryProps(x,z,radius,c=>{if(propTouches(c,x,z,feet,height,radius))overlapping.add(c);return false;});
    if(!overlapping.size)return null;
    let best=null,bestDistance=16;
    function consider(nx,nz){
      const distance=Math.hypot(nx-x,nz-z);if(distance>=bestDistance)return;
      const ng=outsideGround(nx,nz);if(Math.abs(ng-ground)>.55||!regionContains(nx,nz)||!outsideLegal(nx,nz,radius,feet+ng-ground,height))return;
      // Escape only the solids already containing this legacy pose. Every
      // unrelated wall/prop along the short recovery segment still blocks it.
      const n=Math.max(1,Math.ceil(distance/.25));
      for(let i=1;i<n;i++){const xx=x+(nx-x)*i/n,zz=z+(nz-z)*i/n,gg=outsideGround(xx,zz);if(Math.abs(gg-ground)>.55||!outsideLegal(xx,zz,radius,feet+gg-ground,height,overlapping))return;}
      best={x:nx,z:nz};bestDistance=distance;
    }
    for(const c of overlapping){const p=c.part,co=c.propCos,sn=c.propSin,r=radius+.005;
      if(p.shape==='cylinder'){
        if(c.propTilt){
          const axis=c.propAxes[1],length=Math.abs(p.sy),ax=p.x-axis.x*length/2,az=p.z-axis.z*length/2,dx=axis.x*length,dz=axis.z*length,ll=dx*dx+dz*dz;
          const t=ll?clamp(((x-ax)*dx+(z-az)*dz)/ll,0,1):.5,cx=ax+dx*t,cz=az+dz*t,edge=Math.max(Math.abs(p.sx),Math.abs(p.sz))/2+r;
          const a=Math.atan2(z-cz,x-cx);consider(cx+Math.cos(a)*edge,cz+Math.sin(a)*edge);
          const n=Math.hypot(dx,dz)||1;consider(cx-dz/n*edge,cz+dx/n*edge);consider(cx+dz/n*edge,cz-dx/n*edge);continue;
        }
        const edge=Math.max(Math.abs(p.sx),Math.abs(p.sz))/2+r,a=Math.atan2(z-p.z,x-p.x);
        consider(p.x+Math.cos(a)*edge,p.z+Math.sin(a)*edge);
        for(let n=0;n<16;n++)consider(p.x+Math.cos(n*Math.PI/8)*edge,p.z+Math.sin(n*Math.PI/8)*edge);
      }else{
        const dx=x-p.x,dz=z-p.z,lx=dx*co-dz*sn,lz=dx*sn+dz*co,hx=Math.abs(p.sx)/2,hz=Math.abs(p.sz)/2;
        const at=(xx,zz)=>consider(p.x+xx*co+zz*sn,p.z-xx*sn+zz*co);
        at(-hx-r,clamp(lz,-hz,hz));at(hx+r,clamp(lz,-hz,hz));at(clamp(lx,-hx,hx),-hz-r);at(clamp(lx,-hx,hx),hz+r);
      }
    }
    return best;
  }
  function propRayHit(c,r,range){
    const p=c.part,dx=r.origin.x-p.x,dy=r.origin.y-p.y,dz=r.origin.z-p.z;
    const o=c.propAxes.map(a=>dx*a.x+dy*a.y+dz*a.z),d=c.propAxes.map(a=>r.direction.x*a.x+r.direction.y*a.y+r.direction.z*a.z);
    const half=[Math.abs(p.sx)/2,Math.abs(p.sy)/2,Math.abs(p.sz)/2];let near=-Infinity,far=Infinity;
    if(p.shape==='cylinder'){
      const radius=Math.max(half[0],half[2]),a=d[0]*d[0]+d[2]*d[2],b=o[0]*d[0]+o[2]*d[2],cc=o[0]*o[0]+o[2]*o[2]-radius*radius;
      if(a<1e-12){if(cc>0)return null;}else{const det=b*b-a*cc;if(det<0)return null;const q=Math.sqrt(det);near=(-b-q)/a;far=(-b+q)/a;}
    }
    for(const i of p.shape==='cylinder'?[1]:[0,1,2]){
      if(Math.abs(d[i])<1e-12){if(Math.abs(o[i])>half[i])return null;continue;}
      const a=(-half[i]-o[i])/d[i],b=(half[i]-o[i])/d[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return null;
    }
    const distance=near>=0?near:far;if(!(distance>=0&&distance<=range))return null;
    const q=o.map((v,i)=>v+d[i]*distance);let nx=0,ny=0,nz=0;
    if(p.shape==='cylinder'&&Math.abs(Math.abs(q[1])-half[1])>1e-5){const l=Math.hypot(q[0],q[2])||1;nx=q[0]/l;nz=q[2]/l;}
    else{const faces=half.map((v,i)=>Math.abs(Math.abs(q[i])-v)),axis=p.shape==='cylinder'?1:faces.indexOf(Math.min(...faces));if(axis===0)nx=Math.sign(q[0]);else if(axis===1)ny=Math.sign(q[1]);else nz=Math.sign(q[2]);}
    const [a,b,cross]=c.propAxes;return{distance,normal:new T.Vector3(a.x*nx+b.x*ny+cross.x*nz,a.y*nx+b.y*ny+cross.y*nz,a.z*nx+b.z*ny+cross.z*nz)};
  }
  function traceProps(origin,direction,range,visit){
    // DDA visits only cells crossed by the ray, with a bounded fallback for
    // extreme public ranges. Each record is tested once per ray.
    if(!outsideProps.length)return false;
    const endX=origin.x+direction.x*range,endZ=origin.z+direction.z*range;
    let x=Math.floor(origin.x/gridSize),z=Math.floor(origin.z/gridSize);const ex=Math.floor(endX/gridSize),ez=Math.floor(endZ/gridSize),query=++propQuery;
    if(![x,z,ex,ez].every(Number.isFinite)||Math.abs(ex-x)+Math.abs(ez-z)>1024){for(const c of outsideProps)if(visit(c))return true;return false;}
    const sx=Math.sign(direction.x),sz=Math.sign(direction.z),dx=sx?gridSize/Math.abs(direction.x):Infinity,dz=sz?gridSize/Math.abs(direction.z):Infinity;
    let tx=sx?((sx>0?x+1:x)*gridSize-origin.x)/direction.x:Infinity,tz=sz?((sz>0?z+1:z)*gridSize-origin.z)/direction.z:Infinity;
    for(let i=0;i<1026;i++){
      for(const c of propGrid.get(x+','+z)||[]){if(c.propQuery===query)continue;c.propQuery=query;if(visit(c))return true;}
      if(x===ex&&z===ez)return false;
      if(tx<tz){x+=sx;tx+=dx;}else if(tz<tx){z+=sz;tz+=dz;}else{x+=sx;z+=sz;tx+=dx;tz+=dz;}
    }
    return false;
  }
  function surfaceRuntime() {return host.getSurfaceDestruction?.() || host.surfaceDestruction || null;}
  function surfaceEligible(p) {return p?.shape==='box'&&!p.windowId&&/^(floor|ceiling|wall|roof|door-frame|canopy|terrace|colonnade)$/.test(p.role||'');}
  function floorKey(b,n){return b.id+':'+n;}
  function boundsKey(b){return[b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z].map(v=>Math.round(v*10000)).join(',');}
  function floorData(b,n){
    const key=floorKey(b,n);if(floorDataCache.has(key))return floorDataCache.get(key);
    const model=root.CityInteriors.buildFloor(b.type,b.seed,n),parts=root.CityWorld.transform(model.parts,b.x,b.y+model.baseY*b.scale,b.z,b.scale,b.rotation,'active-floor').map(p=>({...p,buildingId:b.id}));
    const records=parts.filter(p=>p.shape==='box'&&p.sy>.055).map(p=>({box:partBox(p),kind:surfaceKind(p),id:p.windowId||p.role||'room',buildingId:b.id,floor:n,part:p}));
    const byPart=new Map(records.map(c=>[c.part,c]));let slab=null,ceiling=null;
    parts.forEach((p,i)=>{const c=byPart.get(p);if(c&&surfaceEligible(p)){c.surfaceKey='westport:'+encodeURIComponent(b.id)+':floor:'+n+':part:'+i;surfaceParts.set(p,c);if(p.role==='floor')slab=c;if(p.role==='ceiling')ceiling=c;}});
    // Thin finishes share the slab's cut rather than concealing an opening.
    if(slab)for(const p of parts)if(/^(corridor|lobby-floor)$/.test(p.role||''))surfaceParts.set(p,slab);
    const byBounds=new Map(records.filter(c=>c.surfaceKey).map(c=>[boundsKey(c.box),c]));
    const walks=model.colliders.map(c=>{const box=localBox(b,c,model.baseY),source=byBounds.get(boundsKey(box));return{box,kind:c.kind||'wall',buildingId:b.id,floor:n,...(source?{part:source.part,surfaceKey:source.surfaceKey}: {})};});
    const data={model,parts,records,walks,slab,ceiling};floorDataCache.set(key,data);
    // Only the active floor and a small working set retain full furniture data.
    if(floorDataCache.size>12)for(const old of floorDataCache.keys())if(old!==key&&old!==floorKey(currentBuilding||{id:''},state.floor)){floorDataCache.delete(old);break;}
    return data;
  }
  function surfaceRefs(c){return[...(instanceRecords.get(c.buildingId)||[]),...floorRefs].filter(ref=>surfaceParts.get(ref.part)?.surfaceKey===c.surfaceKey);}
  function facadeProtectedHeights(c) {
    if(!c?.surfaceKey?.includes(':facade:')||!hqBuildingTypes.has(buildingRecords.get(c.buildingId)?.building.type))return null;
    const rec=buildingRecords.get(c.buildingId);
    if(!c.hqProtectedHeightBands)c.hqProtectedHeightBands=recordParts(rec).filter(p=>/^(floor|floor-ring|ceiling|roof|terrace|canopy)$/.test(p.part?.role||'')&&p.box.max.x>=c.box.min.x-.02&&p.box.min.x<=c.box.max.x+.02&&p.box.max.z>=c.box.min.z-.02&&p.box.min.z<=c.box.max.z+.02).map(p=>({min:p.box.min.y-.015,max:p.box.max.y+.015}));
    return c.hqProtectedHeightBands;
  }
  function facadeSurfaceRefs(facade) {
    if(!facade)return [];
    if(!facade.surfaceRefs){const refs=[],protectedRoots=new Set(facade.roofRoots||[]);
      const visit=obj=>{if(protectedRoots.has(obj)||obj.userData?.surfaceDestruction)return;if(obj.isMesh&&!obj.isInstancedMesh)refs.push(obj);for(const child of obj.children||[])visit(child);};
      visit(facade.root);facade.surfaceRefs=refs;
    }
    return facade.surfaceRefs;
  }
  function surfaceOwnerVisible(c) {
    return c.surfaceKey.includes(':facade:')?c.buildingId!==state.buildingId:c.buildingId===state.buildingId&&(c.floor===state.floor||neighborFloors.has(c.floor));
  }
  function bindFacadeSurface(c,owner=ownerFor(c)) {
    if(!owner||!c.surfaceKey.includes(':facade:'))return;
    const facade=hqFacades.get(c.buildingId),rt=surfaceRuntime();if(!facade||!rt)return;
    rt.bindVisuals(owner,facadeSurfaceRefs(facade));
    rt.setVisualsVisible?.(facadeSurfaceRefs(facade),hqActiveBuildings.has(c.buildingId)&&c.buildingId!==state.buildingId);
    rt.setVisible(owner,surfaceOwnerVisible(c));
  }
  function bindBuildingFacade(id) {
    const rt=surfaceRuntime();if(!rt)return;
    rt.batch(()=>{for(const c of surfaceRecords.values())if(c.buildingId===id&&c.surfaceKey.includes(':facade:'))bindFacadeSurface(c);});
  }
  function releaseFacade(id) {
    const facade=hqFacades.get(id);if(!facade)return;
    const rt=surfaceRuntime();if(rt)rt.batch(()=>{for(const c of surfaceRecords.values())if(c.buildingId===id&&c.surfaceKey.includes(':facade:')){const owner=rt.getOwner(c.surfaceKey);if(owner)rt.unbindVisuals(owner,facadeSurfaceRefs(facade));}});
    facade.dispose();hqFacades.delete(id);
  }
  function ownerFor(c,create=false){
    const rt=surfaceRuntime();if(!rt||!c?.surfaceKey)return null;
    let owner=rt.getOwner(c.surfaceKey);
    // Older saves labelled terraces and canopies as walls. The authored part
    // now decides the policy; retire that stale mask before it can bind again.
    if(owner&&owner.kind!==c.kind){rt.resetOwner(owner);rt.unregisterEmpty?.(owner);owner=null;}
    if(!owner&&create)owner=rt.register({id:c.surfaceKey,region:'westport',kind:c.kind,bounds:c.box,solidVolume:true,visuals:surfaceRefs(c)});
    const visualProtectedHeightBands=facadeProtectedHeights(c);
    if(owner&&visualProtectedHeightBands&&owner.westportFloorPolicy!==visualProtectedHeightBands){
      // The approved facade batches floor finishes with walls. Protect those
      // triangles without changing the established breach/step-up collision.
      rt.setVisualProtectedHeightBands(owner,visualProtectedHeightBands);
      owner.westportFloorPolicy=visualProtectedHeightBands;
    }
    if(owner){surfaceRecords.set(c.surfaceKey,c);if(c.kind==='floor'&&c.surfaceKey.includes(':floor:'))damagedFloors.set(floorKey(buildingRecords.get(c.buildingId).building,c.floor),c);}
    return owner;
  }
  function surfaceHasCuts(c){const o=ownerFor(c);return o&&o.cuts.length?o:null;}
  function surfaceHost(c){const owner=ownerFor(c);return c?.surfaceKey?{westportSurface:true,id:c.surfaceKey,revision:owner?.revision||0,generation:surfaceEpoch}:null;}
  function isSurfaceCurrent(token){if(!token?.westportSurface||token.generation!==surfaceEpoch||state.disposed)return false;return(surfaceRuntime()?.getOwner(token.id)?.revision||0)===token.revision;}
  function bindSurfaceRef(ref){
    if(!surfaceParts.has(ref.part)&&ref.part.buildingId)recordParts(buildingRecords.get(ref.part.buildingId));
    const c=surfaceParts.get(ref.part),owner=ownerFor(c);if(owner)surfaceRuntime().bindVisuals(owner,[ref]);
  }
  function unbindSurfaceRefs(refs){const rt=surfaceRuntime();if(!rt)return;for(const ref of refs){const c=surfaceParts.get(ref.part),owner=ownerFor(c);if(owner){rt.setVisible(owner,false);rt.unbindVisuals(owner,[ref]);}}}
  function markBuildingDamaged(id){
    damagedBuildings.add(id);
    // Damage changes only intersected triangles of the approved facade. Keep
    // its roof, materials, proportions and normal distance/detail lifecycle.
    bindBuildingFacade(id);showBuilding(id,id!==state.buildingId);
  }
  function surfacePointSolid(c,point){const owner=surfaceHasCuts(c);return!owner||surfaceRuntime().isPointSolid(owner,point);}
  function surfaceBodySolid(c,x,z,feet,height,radius){
    const owner=surfaceHasCuts(c);if(!owner)return true;
    surfaceBody.min.set(x-radius,feet+.06,z-radius);surfaceBody.max.set(x+radius,feet+height-.01,z+radius);
    // Zero-radius callers still need a non-degenerate body volume.
    if(radius===0){surfaceBody.min.x-=1e-6;surfaceBody.min.z-=1e-6;surfaceBody.max.x+=1e-6;surfaceBody.max.z+=1e-6;}
    return surfaceRuntime().bodyBlocked(owner,surfaceBody);
  }
  function recordBodyBlocked(c,x,z,feet,height,radius,glass=false){
    if(c.kind==='glass'&&(!glass||brokenWindows.has(glassKey(c.buildingId,c.id))))return false;
    // The exterior can be a few centimetres below an authored room slab.
    // Match native pedestrian step clearance instead of sealing a valid breach
    // with the intact threshold; larger vehicle bodies retain their full test.
    if(c.kind==='floor'&&radius<=.65&&c.box.max.y<=feet+.19)return false;
    const box=c.box,bottom=feet+.06,top=feet+height-.01;if(bottom>=box.max.y||top<=box.min.y)return false;
    const dx=x-clamp(x,box.min.x,box.max.x),dz=z-clamp(z,box.min.z,box.max.z);if(radius>0?dx*dx+dz*dz>=radius*radius:dx!==0||dz!==0)return false;
    const part=c.part;
    if(part&&Math.abs(finite(part.rx))<1e-9&&Math.abs(finite(part.rz))<1e-9){
      const co=Math.cos(finite(part.ry)),sn=Math.sin(finite(part.ry)),px=x-part.x,pz=z-part.z,lx=px*co-pz*sn,lz=px*sn+pz*co;
      const qx=lx-clamp(lx,-Math.abs(part.sx)/2,Math.abs(part.sx)/2),qz=lz-clamp(lz,-Math.abs(part.sz)/2,Math.abs(part.sz)/2);
      if(radius>0?qx*qx+qz*qz>=radius*radius:qx!==0||qz!==0)return false;
    }
    return surfaceBodySolid(c,x,z,feet,height,radius);
  }
  function breachLegal(rec,x,z,radius,feet){
    if(!damagedBuildings.has(rec.building.id)||radius>.65)return false;
    const h=Number.isFinite(feet)?feet:rec.building.y+.13*rec.building.scale;
    if(recordParts(rec).some(c=>recordBodyBlocked(c,x,z,h,1.8,radius,true)))return false;
    const n=state.buildingId===rec.building.id?state.floor:1;
    return!floorData(rec.building,n).walks.some(c=>recordBodyBlocked(c,x,z,h,1.8,radius));
  }
  function breachAt(rec,x,z,feet,radius=.35){
    surfacePoint.set(x,feet+.9,z);
    for(const c of surfaceRecords.values())if(c.buildingId===rec.building.id&&c.kind==='wall'){
      const owner=surfaceHasCuts(c),pad=radius+.08;if(!owner||!owner.cuts.some(cut=>surfacePoint.x>=cut.min.x-pad&&surfacePoint.x<=cut.max.x+pad&&surfacePoint.y>=cut.min.y&&surfacePoint.y<=cut.max.y&&surfacePoint.z>=cut.min.z-pad&&surfacePoint.z<=cut.max.z+pad))continue;
      if(!surfaceBodySolid(c,x,z,feet,1.8,radius))return true;
    }
    return false;
  }
  function damageSurfaces(center,radius,amount){
    const rt=surfaceRuntime();if(!rt||!copyPoint(center)||!(amount>0))return{owners:0,cuts:0};
    const at=new T.Vector3(center.x,center.y,center.z),reach=Math.min(3.2,Math.max(.65,radius*.43)),candidates=[],seen=new Set();
    for(const rec of buildingRecords.values()){
      if(rec.box.distanceToPoint(at)>reach)continue;
      const b=rec.building;
      // Include both sides of a storey boundary: the next floor and the lower
      // ceiling otherwise leave an invisible second slab inside the same hole.
      for(let n=1;n<=b.floors;n++){
        const profile=root.CityInteriors.profile(b.type,n),lo=b.y+profile.baseY*b.scale,hi=lo+profile.storyH*b.scale;
        if(at.y<lo-reach-.4||at.y>hi+reach+.4)continue;
        for(const c of floorData(b,n).records)if(c.surfaceKey&&c.box.distanceToPoint(at)<=reach)candidates.push(c);
      }
      for(const c of recordParts(rec)){
        if(c.box.distanceToPoint(at)>reach)continue;
        if(c.kind==='glass')breakWindow(c.buildingId,c.floor,c.id);else if(c.surfaceKey)candidates.push(c);
      }
    }
    // A dense junction can include many trim pieces. Process nearest actual
    // surfaces first, with paired floor slabs ahead of coplanar trim, and keep
    // one blast's geometry rebuild work bounded as well as the global budget.
    candidates.sort((a,b)=>a.box.distanceToPoint(at)-b.box.distanceToPoint(at)||Number(!/^(floor|ceiling)$/.test(a.kind))-Number(!/^(floor|ceiling)$/.test(b.kind)));
    let cuts=0;const changedBuildings=new Set();
    rt.batch(()=>{for(const c of candidates){if(seen.has(c.surfaceKey))continue;if(seen.size>=24)break;seen.add(c.surfaceKey);const owner=ownerFor(c,true);if(!owner)continue;
      // Every ref carries its original authored matrix, even while HQ LOD has
      // hidden the source instance with a zero matrix.
      rt.bindVisuals(owner,surfaceRefs(c));bindFacadeSurface(c,owner);
      const before=owner.cuts.length;rt.damage(owner,at,reach);if(owner.cuts.length>before){cuts++;changedBuildings.add(c.buildingId);}
      rt.setVisible?.(owner,surfaceOwnerVisible(c));
    }for(const id of changedBuildings)markBuildingDamaged(id);});
    refreshNeighborFloors();updateSurfacePeople(0);return{owners:seen.size,cuts};
  }
  function restoreSurfaceDamage(records){
    const rt=surfaceRuntime();if(!rt)return 0;let count=0;const changedBuildings=new Set();
    rt.batch(()=>{for(const saved of records||[]){if(saved.region!=='westport'||typeof saved.id!=='string')continue;
      const match=/^westport:([^:]+):(facade):(\d+)$/.exec(saved.id)||/^westport:([^:]+):(floor):(\d+):part:(\d+)$/.exec(saved.id);if(!match)continue;
      let id;try{id=decodeURIComponent(match[1]);}catch(_){continue;}const rec=buildingRecords.get(id);if(!rec)continue;
      if(match[2]==='floor'&&(Number(match[3])<1||Number(match[3])>rec.building.floors))continue;
      const c=match[2]==='facade'?recordParts(rec)[Number(match[3])]:floorData(rec.building,Number(match[3])).records.find(c=>c.surfaceKey===saved.id);
      if(!c||!rt.getOwner(saved.id))continue;const owner=ownerFor(c);if(!owner?.cuts.length)continue;changedBuildings.add(id);rt.bindVisuals(owner,surfaceRefs(c));
      rt.setVisible?.(owner,match[2]==='facade'?id!==state.buildingId:id===state.buildingId&&(c.floor===state.floor||neighborFloors.has(c.floor)));count++;
    }for(const id of changedBuildings)markBuildingDamaged(id);});
    refreshNeighborFloors();return count;
  }
  function resetSurfaceDamage(){surfaceEpoch++;surfaceRuntime()?.resetRegion('westport');surfaceRecords.clear();damagedBuildings.clear();damagedFloors.clear();floorDataCache.clear();activeFloorPeople=[];fallingPeople.clear();relocatedPeople.clear();}
  function primitive(shape) {
    if (geometries.has(shape)) return geometries.get(shape);
    const g = shape === 'box' ? new T.BoxGeometry(1, 1, 1) : shape === 'cylinder' ? new T.CylinderGeometry(.5, .5, 1, 10) :
      shape === 'cone' ? new T.ConeGeometry(.5, 1, 10) : shape === 'person-hair' ? new T.SphereGeometry(.5, 12, 7, 0, Math.PI * 2, 0, Math.PI * .63) :
      ['person-soft', 'person-shirt', 'person-head'].includes(shape) ? new T.SphereGeometry(.5, 12, 8) : new T.SphereGeometry(.5, 10, 6);
    if (shape === 'person-shirt' || shape === 'person-head' || shape === 'person-hair') {
      const a = g.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let x = a.getX(i), y = a.getY(i), z = a.getZ(i);
        if (shape === 'person-shirt') {
          // Rounded shoulders taper down to a tucked waist; a flatter front
          // gives lapels, buttons and the badge a coherent garment surface.
          const soft = v => Math.sign(v) * Math.pow(Math.abs(v * 2), .57) * .5;
          x = soft(x) * (.80 + .20 * Math.min(1, (y + .5) * 1.65));
          z = soft(z) * (.86 + .14 * (y + .5)); y = soft(y);
        } else {
          // Narrow jaw, full temples and a gently flattened face. The original
          // oversized sphere is deliberately not used for the office head.
          x *= y < -.05 ? .73 + .27 * (y + .5) / .45 : 1;
          if (z > 0) z = Math.min(z * 1.06, .43);
          if (shape === 'person-hair') z -= .018;
        }
        a.setXYZ(i, x, y, z);
      }
      g.computeVertexNormals();
    }
    if (shape === 'person-soft') {
      const a = g.attributes.position, soften = v => Math.sign(v) * Math.pow(Math.min(1, Math.abs(v * 2)), .42) * .5;
      for (let i = 0; i < a.count; i++) a.setXYZ(i, soften(a.getX(i)), soften(a.getY(i)), soften(a.getZ(i)));
      g.computeVertexNormals();
    }
    geometries.set(shape, g); return g;
  }
  function material(kind = 'concrete') {
    if (materials.has(kind)) return materials.get(kind);
    const m = new T.MeshStandardMaterial({color: 0xffffff, roughness: kind === 'glass' ? .25 : kind === 'metal' ? .46 : .86,
      metalness: kind === 'glass' ? .12 : kind === 'metal' ? .3 : 0, side: T.DoubleSide,
      transparent: kind === 'glass', opacity: kind === 'glass' ? .32 : 1, depthWrite: kind !== 'glass'});
    if (kind === 'lit') {m.emissive.set('#e8c58a'); m.emissiveIntensity = .23;}
    materials.set(kind, m); return m;
  }
  function setRef(ref, visible) {
    const c=surfaceParts.get(ref.part),owner=surfaceHasCuts(c),rt=surfaceRuntime();
    // An owner can drive both native and high-detail meshes. Hide this source's
    // proxy for LOD without suppressing the same hole in the chosen facade.
    rt?.setVisualsVisible?.([ref],visible);
    ref.mesh.setMatrixAt(ref.index,visible&&!owner?ref.matrix:zero);ref.mesh.instanceMatrix.needsUpdate=true;
    if(owner)rt.setVisible(owner,surfaceOwnerVisible(c));
  }
  function registerRef(ref, interior) {
    const id = ref.part.buildingId;
    if (interior) floorRefs.push(ref);
    else if (id) {
      if (!instanceRecords.has(id)) instanceRecords.set(id, []); instanceRecords.get(id).push(ref);
      if (ref.part.windowId) {const key = glassKey(id, ref.part.windowId); if (!windowRecords.has(key)) windowRecords.set(key, []); windowRecords.get(key).push(ref);}
    }
    bindSurfaceRef(ref);
    if (id) setRef(ref,!(!interior&&(id===state.buildingId||hqActiveBuildings.has(id))||ref.part.windowId&&brokenWindows.has(glassKey(id,ref.part.windowId))));
  }
  function buildParts(parts, into, interior = false, keepRecords = true) {
    const buckets = new Map();
    for (const p of parts) {
      if (p.shape === 'mesh') {
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p.vertices, 3)); g.setIndex(p.indices); g.computeVertexNormals();
        const m = material(p.material).clone(); m.color.set(p.color || '#ffffff');
        const mesh = new T.Mesh(g, m); mesh.position.set(finite(p.x), finite(p.y), finite(p.z)); mesh.rotation.set(finite(p.rx), finite(p.ry), finite(p.rz));
        mesh.scale.set(finite(p.sx, 1), finite(p.sy, 1), finite(p.sz, 1)); mesh.receiveShadow = true; mesh.userData.westportPrivate = true;
        mesh.updateMatrix(); mesh.matrixAutoUpdate = false; into.add(mesh); continue;
      }
      const key = p.shape + '|' + (p.material || 'concrete'); if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(p);
    }
    for (const parts of buckets.values()) {
      const mesh = new T.InstancedMesh(primitive(parts[0].shape), material(parts[0].material), parts.length);
      mesh.receiveShadow = true; mesh.castShadow = false; mesh.frustumCulled = false; mesh.name = 'WESTPORT ' + parts[0].shape + ' ' + (parts[0].material || 'concrete');
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]; dummy.position.set(finite(p.x), finite(p.y), finite(p.z)); dummy.rotation.set(finite(p.rx), finite(p.ry), finite(p.rz));
        dummy.scale.set(finite(p.sx, 1), finite(p.sy, 1), finite(p.sz, 1)); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(p.color || '#ffffff'));
        if (keepRecords && p.buildingId) registerRef({mesh, index: i, part: p, matrix: dummy.matrix.clone()}, interior);
      }
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere?.(); mesh.updateMatrix(); mesh.matrixAutoUpdate = false; into.add(mesh);
    }
    return into;
  }
  function releaseGroup(group) {
    if (!group) return; group.removeFromParent();
    group.traverse(o => {if (o.isInstancedMesh) o.dispose?.(); if (o.userData.westportPrivate) {if (!o.isSprite) o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose();}});
    group.clear();
  }
  function showBuilding(id, visible) {
    for (const ref of instanceRecords.get(id) || []) setRef(ref, visible && !hqActiveBuildings.has(id) && (!ref.part.windowId || !brokenWindows.has(glassKey(id, ref.part.windowId))));
    const facade=hqFacades.get(id),show=visible&&hqActiveBuildings.has(id);
    if(facade){facade.setVisible(show);surfaceRuntime()?.setVisualsVisible?.(facadeSurfaceRefs(facade),show);}
  }
  function mount() {
    if (state.disposed) return false;
    const scene = host.getThree?.()?.scene || host.scene;
    if (!scene) return false;
    if (mountedScene !== scene) {container.removeFromParent(); scene.add(container); mountedScene = scene;}
    return true;
  }
  function releaseChunk(chunk) {
    if (!chunk.group) return;
    // A building may cross several chunks. Remove only references owned by
    // these meshes; glass/collision state and other chunks remain authoritative.
    const meshes = new Set(); chunk.group.traverse(o => {if (o.isInstancedMesh) meshes.add(o);});
    unbindSurfaceRefs([...instanceRecords.values()].flat().filter(ref=>meshes.has(ref.mesh)));
    const ids = new Set(), windows = new Set();
    for (const part of chunk.parts) if (part.buildingId) {
      ids.add(part.buildingId);
      if (part.windowId) windows.add(glassKey(part.buildingId, part.windowId));
    }
    for (const [map, keys] of [[instanceRecords, ids], [windowRecords, windows]]) for (const key of keys) {
      const refs = (map.get(key) || []).filter(ref => !meshes.has(ref.mesh));
      if (refs.length) map.set(key, refs); else map.delete(key);
    }
    for (const rec of chunk.hqBuildings || []) {
      const id = rec.building.id;
      releaseFacade(id); hqActiveBuildings.delete(id);
      showBuilding(id, id !== state.buildingId);
    }
    for (const spec of chunk.hqParked || []) {
      hqParkedVisuals.get(spec.id)?.visual?.dispose(); hqParkedVisuals.delete(spec.id);
    }
    releaseGroup(chunk.group); chunk.group = null; chunkEvictions++;
  }
  function ensureChunks(camera, force = false) {
    if (state.disposed) return;
    const p = player(), eye = camera?.position || new T.Vector3(p.x, p.y + 1.7, p.z);
    const scene = host.getThree?.()?.scene || host.scene;
    const hostRange = Math.max(1, finite(host.viewDistance, 1800));
    // Geometry beyond the scene's linear fog cannot contribute pixels. Keep a
    // small visibility margin and the existing host cap, including scoped views.
    const range = Math.min(hostRange, Math.max(320, finite(scene?.fog?.far, hostRange) + 64));
    actorCamera = camera || null; actorEye.copy(eye);
    actorFovScale = Math.max(.001, Math.tan(finite(camera?.fov, 72) * Math.PI / 360) / Math.tan(Math.PI / 5));
    if (camera?.projectionMatrix && camera?.matrixWorldInverse) {projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projection);}
    for (const chunk of chunks.values()) {
      const distance = chunk.box.distanceToPoint(eye), nearby = distance < range;
      const inView = !camera?.projectionMatrix || frustum.intersectsBox(chunk.box);
      const pinned = !!state.buildingId && (chunk.parts.some(part => part.buildingId === state.buildingId) || (chunk.hqBuildings || []).some(rec => rec.building.id === state.buildingId));
      if (force || pinned || distance < range + chunkSize) chunk.cacheSeenAt = renderCacheClock;
      if (chunk.group && !force && !pinned && distance >= range + chunkSize && renderCacheClock - finite(chunk.cacheSeenAt) >= renderCacheGrace) {
        releaseChunk(chunk); continue;
      }
      if ((force || nearby && inView) && !chunk.group) {chunk.group = new T.Group(); chunk.group.name = 'WESTPORT chunk ' + chunk.key; buildParts(chunk.parts, chunk.group); staticRoot.add(chunk.group);
        chunk.cacheSeenAt = renderCacheClock;
        for (const b of W.buildings) if (Math.floor(b.x / chunkSize) + ',' + Math.floor(b.z / chunkSize) === chunk.key) {
          if (b.type === 'fbi_hq') {
            const profile = root.CityInteriors.profile(b.type, 1), sign = label('FBI / WESTPORT', point(b, {x: 0, y: 6.7, z: profile.depth / 2 + .22}), 13 * b.scale); if (sign) chunk.group.add(sign);
          }
          if (b.type === 'museum' && archiveFloor(b, 1)) {
            const profile = root.CityInteriors.profile(b.type, 1), sign = label('B1 해양기록관 · 잠수함 정박지', point(b, {x: 0, y: 4.35, z: profile.depth / 2 + .38}), 11.4 * b.scale);
            if (sign) {sign.name = 'WESTPORT archive entrance sign'; chunk.group.add(sign);}
          }
        }}
      if (chunk.group) chunk.group.visible = force || nearby && inView;
      if(chunk.group)for(const spec of chunk.hqParked||[]){
        let item=hqParkedVisuals.get(spec.id);
        if(!item){const wrapper=new T.Group(),far=new T.Group(),gy=outsideGround(spec.x,spec.z);
          wrapper.name='WESTPORT approved decorative '+spec.id;wrapper.position.set(spec.x,gy,spec.z);far.position.set(-spec.x,-gy,-spec.z);buildParts(spec.originalParts,far,false,false);wrapper.add(far);chunk.group.add(wrapper);item={visual:null,far,root:wrapper,spec,cacheSeenAt:renderCacheClock};hqParkedVisuals.set(spec.id,item);
        }
        const distance=Math.hypot(spec.x-eye.x,spec.z-eye.z),close=force||distance<220;
        if(close&&!item.visual){item.visual=root.HanQHQ50Vehicles.create(T,spec.large?'bus':'sedan',{forward:'+X'});item.visual.group.rotation.y=-spec.heading;item.root.add(item.visual.group);}
        if(force||distance<detailKeepDistance)item.cacheSeenAt=renderCacheClock;
        else if(item.visual&&renderCacheClock-item.cacheSeenAt>=renderCacheGrace){item.visual.dispose();item.visual=null;detailEvictions++;}
        if(item.visual)item.visual.group.visible=close;item.far.visible=!close;
      }
      for (const rec of chunk.hqBuildings || []) {
        const b=rec.building,near=force || nearby && inView && rec.box.distanceToPoint(eye)<220;
        let facade=hqFacades.get(b.id);
        if(near&&!facade){
          const shell=root.CityInteriors.buildShell(b.type,b.seed),profiles=Array.from({length:b.floors},(_,i)=>root.CityInteriors.profile(b.type,i+1));
          facade=hqBuildings.createWest({building:b,shell,profiles,brokenWindowIds:brokenWindows});
          facade.root.position.set(b.x,b.y,b.z);facade.root.rotation.y=b.rotation||0;facade.root.scale.setScalar(b.scale||1);
          chunk.group.add(facade.root);hqFacades.set(b.id,facade);bindBuildingFacade(b.id);
        }
        if(force||b.id===state.buildingId||rec.box.distanceToPoint(eye)<detailKeepDistance)rec.cacheSeenAt=renderCacheClock;
        else if(facade&&renderCacheClock-finite(rec.cacheSeenAt)>=renderCacheGrace){releaseFacade(b.id);facade=null;detailEvictions++;}
        if(near!==hqActiveBuildings.has(b.id)){
          if(near)hqActiveBuildings.add(b.id);else hqActiveBuildings.delete(b.id);
          showBuilding(b.id,b.id!==state.buildingId);
        }
        if(facade){const show=near&&b.id!==state.buildingId;facade.setVisible(show);surfaceRuntime()?.setVisualsVisible?.(facadeSurfaceRefs(facade),show);}
      }
    }
  }
  function disposeFloor() {
    resetHitReactions();
    unbindSurfaceRefs(floorRefs);
    releaseGroup(floorGroup); floorGroup = null; floorModel = null; currentBoxes = []; walkBoxes = []; floorRefs.length = 0;neighborFloors.clear();activeFloorPeople=[];
    if (state.buildingId) showBuilding(state.buildingId, true); sim.activateInterior(null);
  }
  function containsFloor(x, z, padding = 0) {
    if (!currentBuilding || !floorModel) return false;
    const q = localPoint(currentBuilding, {x, y: state.baseY, z});
    return Math.abs(q.x) <= floorModel.width / 2 + padding && Math.abs(q.z) <= floorModel.depth / 2 + padding;
  }
  function refreshNeighborFloors(){
    if(!currentBuilding||!floorGroup)return;
    const b=currentBuilding,data=floorData(b,state.floor);
    for(const [n,boundary] of [[state.floor-1,data.slab],[state.floor+1,data.ceiling]]){
      if(n<1||n>b.floors||neighborFloors.has(n)||!surfaceHasCuts(boundary))continue;
      const next=floorData(b,n),group=new T.Group();group.name='WESTPORT exposed adjacent floor '+n;floorGroup.add(group);
      buildParts(next.parts,group,true);neighborFloors.set(n,{data:next,group});
    }
  }
  function visibleFloorRecords(){return neighborFloors.size?[...currentBoxes,...[...neighborFloors.values()].flatMap(v=>v.data.records)]:currentBoxes;}
  function floorSupport(b,n,x,z,maxY){
    const profile=root.CityInteriors.profile(b.type,n),base=b.y+profile.baseY*b.scale,foot=base+.13*b.scale;
    if(foot>maxY+.001)return undefined;
    const c=damagedFloors.get(floorKey(b,n)),owner=c&&surfaceHasCuts(c);
    if(!owner)return foot;
    const support=surfaceRuntime().supportAt(owner,x,z,maxY-.13*b.scale);
    return support===undefined?undefined:support+.13*b.scale;
  }
  function surfaceActorVisible(person){return!person.indoor||person.buildingId===state.buildingId&&(person.floor===state.floor||neighborFloors.has(person.floor));}
  function npcInteriorWalkable(x,z,person,radius=.27){
    if(person?.surfaceFalling||person&&person.floor!==state.floor||!containsFloor(x,z,-.3)||!interiorLegal(x,z,radius,person?.y??state.baseY))return false;
    if(!damagedFloors.has(floorKey(currentBuilding,state.floor)))return true;
    for(const[dx,dz]of[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]){
      const y=floorSupport(currentBuilding,state.floor,x+dx,z+dz,state.baseY+.04);
      if(!Number.isFinite(y)||y<state.baseY-.04)return false;
    }
    return true;
  }
  function actorFloorSupport(person){
    const b=buildingRecords.get(person.buildingId)?.building;if(!b)return null;
    const profile=root.CityInteriors.profile(b.type,person.floor||1),origin=b.y+profile.baseY*b.scale;
    // Seated employees are authored at slab height, while walking citizens
    // have a small foot clearance. Preserve that existing offset rather than
    // interpreting every seated employee as being below an intact floor.
    const offset=finite(person.surfaceFootOffset,clamp(person.y-origin,0,.2*b.scale)),adjust=offset-.13*b.scale;
    const radius=Math.max(.1,Math.min(.4,finite(person.radius,.27))),samples=[];
    for(const[dx,dz]of[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]){
      let support;
      for(let n=Math.min(b.floors,person.floor||1);n>=1;n--){const y=floorSupport(b,n,person.x+dx,person.z+dz,person.y+.04-adjust);if(Number.isFinite(y)){support={y:y+adjust,floor:n,offset};break;}}
      samples.push(support||{y:outsideGround(person.x+dx,person.z+dz),floor:1,offset});
    }
    samples.sort((a,b)=>b.y-a.y);
    return samples.find(a=>samples.filter(b=>Math.abs(a.y-b.y)<.02).length>=3)||samples[samples.length-1];
  }
  function updateSurfacePeople(dt){
    if(!currentBuilding||!damagedBuildings.has(currentBuilding.id))return;
    // Only the loaded room's people, its small response squad, and actors
    // already falling are considered. No city-wide civilian scan is added.
    const candidates=new Set(activeFloorPeople);
    for(const p of sim.swat)if(p.active!==false&&p.indoor&&p.buildingId===state.buildingId&&p.floor===state.floor)candidates.add(p);
    for(const p of fallingPeople)if(p.buildingId===state.buildingId)candidates.add(p);
    const step=clamp(finite(dt),0,.1);
    for(const p of candidates){
      if(!p.indoor||p.buildingId!==state.buildingId||!Number.isFinite(p.y)||!p.surfaceFalling&&!damagedFloors.has(floorKey(currentBuilding,p.floor)))continue;
      const support=actorFloorSupport(p);if(!support)continue;
      if(p.y>support.y+.035){
        if(!p.surfaceFalling){p.surfaceOriginFloor=p.surfaceOriginFloor||p.floor;p.surfaceFootOffset=support.offset;p.surfaceFalling=true;p.surfaceVY=0;fallingPeople.add(p);relocatedPeople.add(p);if(p.officeStaff){p.officeWorking=false;p.officeMoving=false;officeCityBody(p);}}
        p.surfaceVY=finite(p.surfaceVY)-15*step;p.y=Math.max(support.y,p.y+p.surfaceVY*step);
      }
      if(p.surfaceFalling&&p.y<=support.y+.001){
        p.y=support.y;p.floor=support.floor;p.surfaceFalling=false;p.surfaceVY=0;fallingPeople.delete(p);
        if(p.officeSeat){
          p.officeSeat.y=p.y;for(const stand of p.officeSeat.stands||[])stand.y=p.y;if(p.officeStand)p.officeStand.y=p.y;
          p.officeState='startled';p.officeWorking=false;p.officeReaction=.3;p.officeThreatUntil=Math.max(finite(p.officeThreatUntil),sim.time+3);
        }
        p.active=surfaceActorVisible(p);
      }
    }
  }
  function groundAt(x,z,maxY){
    if(!containsFloor(x,z,.1))return undefined;
    // Do not call host.getPlayer here: native baseOf/G can call this resolver
    // while entering a floor, before the host has assigned westportBaseY.
    maxY=Number.isFinite(maxY)?maxY:state.baseY+finite(nativeState()?.ents?.[0]?.jz)+.25;
    for(let n=state.floor;n>=1;n--){const y=floorSupport(currentBuilding,n,x,z,maxY);if(y!==undefined)return y;}
    const outside=outsideGround(x,z);return outside<=maxY+.001?outside:undefined;
  }
  function ceilingAt(x,z,minY){
    if(!containsFloor(x,z,.1))return undefined;
    const b=currentBuilding;minY=Number.isFinite(minY)?minY:state.baseY+finite(nativeState()?.ents?.[0]?.jz)+1;
    let best=Infinity;
    for(let n=state.floor;n<=Math.min(b.floors,state.floor+2);n++){
      const data=floorData(b,n);
      for(const c of [data.ceiling,n>state.floor?data.slab:null])if(c&&c.box.max.y>=minY){
        const owner=surfaceHasCuts(c),y=owner?surfaceRuntime().ceilingAt(owner,x,z,minY):c.box.min.y;
        if(y!==undefined&&y>=minY-.001)best=Math.min(best,y);
      }
    }
    return Number.isFinite(best)?best:undefined;
  }
  function interiorLegal(x, z, radius = .35, feetY = state.baseY) {
    if (!containsFloor(x, z, -.3)) {
      const rec=currentBuilding&&buildingRecords.get(currentBuilding.id);
      return!!rec&&breachAt(rec,x,z,feetY,radius)&&breachLegal(rec,x,z,radius,feetY);
    }
    for (const c of walkBoxes) {
      const b = c.box; if (b.max.y <= feetY + .19 || b.min.y >= feetY + 1.72) continue;
      if (x > b.min.x - radius && x < b.max.x + radius && z > b.min.z - radius && z < b.max.z + radius&&surfaceBodySolid(c,x,z,feetY,1.72,radius)) return false;
    }
    return true;
  }
  function outsideLegal(x, z, radius = .35, feet = outsideGround(x,z), height = 1.8, ignoredProps) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius)) return false;
    if (!regionContains(x, z)) return host.isWalkable ? !!host.isWalkable(x, z) : false;
    if(propBodyAt(x,z,feet,height,radius,ignoredProps))return false;
    function buildingBlocks(rec){
      const p=localPoint(rec.building,{x,y:rec.building.y,z}),r=radius/(rec.building.scale||1),hw=rec.profile.width/2,hd=rec.profile.depth/2;
      // Geometry-less callers retain their declared footprint. The live city
      // supplies authored shell parts, which distinguish an entrance opening.
      if(!rec.sourceParts.length)return Math.abs(p.x)<hw+r&&Math.abs(p.z)<hd+r;
      const dx=Math.max(0,Math.abs(p.x)-hw),dz=Math.max(0,Math.abs(p.z)-hd);
      if(radius>0?dx*dx+dz*dz>=r*r:dx>0||dz>0)return false;
      // The exterior capsule can touch a footprint while its centre is still
      // outside. At open entrance bays there is no wall there: inspect the
      // visible facade instead of extending a solid rectangle into the street.
      // Entry into the actual building still belongs to the native doorway.
      if(Math.abs(p.x)>=hw||Math.abs(p.z)>=hd){
        // Ground pedestrians need only the facade at their own elevation,
        // not every upper storey on each blocked movement attempt.
        if(!rec.bodyBands){rec.bodyBands=new Map();for(const c of recordParts(rec))for(let n=Math.floor(c.box.min.y/4);n<=Math.floor(c.box.max.y/4);n++){if(!rec.bodyBands.has(n))rec.bodyBands.set(n,[]);rec.bodyBands.get(n).push(c);}}
        const low=Math.floor((feet+.06)/4),high=Math.floor((feet+height-.01)/4);
        if(high-low>32)return recordParts(rec).some(c=>recordBodyBlocked(c,x,z,feet,height,radius,true));
        for(let n=low;n<=high;n++)for(const c of rec.bodyBands.get(n)||[])if(recordBodyBlocked(c,x,z,feet,height,radius,true))return true;
        return false;
      }
      const edge=Math.abs(p.x)>hw-r*2||Math.abs(p.z)>hd-r*2;
      return !breachLegal(rec,x,z,radius,feet)||edge&&!breachAt(rec,x,z,feet,radius);
    }
    // Cells already include a 1m world-space margin. Larger capsules (notably
    // response vans) may reach a building from a neighboring cell; rotation
    // expands the local-axis radius by at most sqrt(2) in either world axis.
    const reach = Math.max(0, radius * Math.SQRT2 - 1), query = ++collisionQuery;
    if (reach > gridSize) {
      for (const rec of buildingRecords.values()) if(buildingBlocks(rec))return false;
      return true;
    }
    const minX = Math.floor((x - reach) / gridSize), maxX = Math.floor((x + reach) / gridSize);
    const minZ = Math.floor((z - reach) / gridSize), maxZ = Math.floor((z + reach) / gridSize);
    for (let ix = 0; ix <= maxX - minX; ix++)
      for (let iz = 0; iz <= maxZ - minZ; iz++)
        for (const rec of collisionGrid.get((minX + ix) + ',' + (minZ + iz)) || []) {
          if (rec.collisionQuery === query) continue; rec.collisionQuery = query;
          if(buildingBlocks(rec))return false;
        }
    return true;
  }
  function moveAllowed(x, z, radius = .35, entity) {
    if (currentBuilding && (!entity || entity === player().entity || entity.westportBuildingId === state.buildingId)) return interiorLegal(x,z,radius,entity===player().entity?player().y:state.baseY);
    const feet=outsideGround(x,z)+finite(entity?.floor)+finite(entity?.jz)+finite(entity?.altitude,finite(entity?.alt)),height=entity?.roll?1:entity?.crouch?1.15:1.8;
    return outsideLegal(x, z, radius,feet,height) && !responseVehicleAt(x, z, radius);
  }
  function responseVehicleAt(x, z, radius = 0, height = null) {
    for (const v of sim.responseVehicles || []) {
      if (v.active === false || Number.isFinite(height) && (height < v.y + .2 || height > v.y + 2.9)) continue;
      const dx = x - v.x, dz = z - v.z, s = Math.sin(v.heading || 0), c = Math.cos(v.heading || 0);
      if (Math.abs(dx * c - dz * s) < 1.38 + radius && Math.abs(dx * s + dz * c) < 3.15 + radius) return v;
    }
    return null;
  }
  function pointBlocked(x, z) {
    if (containsFloor(x, z, 1)) return interiorLegal(x, z, 0) ? null : collisionWall;
    if (!regionContains(x, z)) return undefined;
    if (responseVehicleAt(x, z)) return collisionWall;
    return outsideLegal(x, z, 0) ? null : collisionWall;
  }
  function solidAt(x, z, height) {
    const pos = new T.Vector3(x, height, z);
    const prop=queryProps(x,z,0,c=>propContainsPoint(c,pos));if(prop)return{...collisionWall,record:prop};
    const responseVehicle = responseVehicleAt(x, z, 0, height);
    if (responseVehicle) return {...collisionWall, responseVehicleId: responseVehicle.id};
    if (containsFloor(x, z, 1)) {
      for (const c of visibleFloorRecords()) if (c.kind !== 'glass' && c.box.containsPoint(pos)&&surfacePointSolid(c,pos)) return {...collisionWall, record: c};
      return null;
    }
    if (!regionContains(x, z)) return undefined;
    for (const rec of collisionGrid.get(Math.floor(x / gridSize) + ',' + Math.floor(z / gridSize)) || []) {
      if (!rec.box.containsPoint(pos)) continue;
      for (const c of recordParts(rec)) if (c.kind !== 'glass' && c.box.containsPoint(pos)&&surfacePointSolid(c,pos)) return {...collisionWall, record: c};
    }
    return null;
  }
  // A full vertical body interval is needed for vehicles: a probe at the
  // bonnet misses low cover, thin ceilings and overhangs between sample heights.
  // Reuse cached part bounds and the building grid; never scan the rendered scene.
  function bodyBlocked(x, z, feet, height = 1.8, radius = .35) {
    if (![x, z, feet, height, radius].every(Number.isFinite) || height <= 0 || radius < 0) return null;
    const bottom = feet + .06, top = feet + height - .01;
    if (top <= bottom) return null;
    const prop=propBodyAt(x,z,feet,height,radius);if(prop)return{...collisionWall,record:prop};
    function circleBox(box) {
      if (bottom >= box.max.y || top <= box.min.y) return false;
      const dx = x - clamp(x, box.min.x, box.max.x), dz = z - clamp(z, box.min.z, box.max.z);
      return radius > 0 ? dx * dx + dz * dz < radius * radius : dx === 0 && dz === 0;
    }
    function touches(c) {
      if (c.kind === 'glass' || !circleBox(c.box)) return false;
      const part = c.part;
      if (!part || Math.abs(finite(part.rx)) > 1e-9 || Math.abs(finite(part.rz)) > 1e-9) return surfaceBodySolid(c,x,z,feet,height,radius);
      // Upright facade parts are OBBs. Their cached AABB is only a broad phase,
      // otherwise a rotated corner creates an invisible triangular wall.
      const shape = c.bodyFootprint || (c.bodyFootprint = {
        x: finite(part.x), z: finite(part.z), hx: Math.abs(finite(part.sx, 1)) / 2,
        hz: Math.abs(finite(part.sz, 1)) / 2, cos: Math.cos(finite(part.ry)), sin: Math.sin(finite(part.ry))
      });
      const dx = x - shape.x, dz = z - shape.z;
      const lx = dx * shape.cos - dz * shape.sin, lz = dx * shape.sin + dz * shape.cos;
      const qx = lx - clamp(lx, -shape.hx, shape.hx), qz = lz - clamp(lz, -shape.hz, shape.hz);
      return (radius > 0 ? qx * qx + qz * qz < radius * radius : qx === 0 && qz === 0)&&surfaceBodySolid(c,x,z,feet,height,radius);
    }
    for (const v of sim.responseVehicles || []) {
      if (v.active === false || bottom >= v.y + 2.9 || top <= v.y + .2) continue;
      const dx = x - v.x, dz = z - v.z, sn = Math.sin(v.heading || 0), co = Math.cos(v.heading || 0);
      const lx = dx * co - dz * sn, lz = dx * sn + dz * co;
      const qx = lx - clamp(lx, -1.38, 1.38), qz = lz - clamp(lz, -3.15, 3.15);
      if (radius > 0 ? qx * qx + qz * qz < radius * radius : qx === 0 && qz === 0)
        return {...collisionWall, responseVehicleId: v.id};
    }
    for (const c of visibleFloorRecords()) if (touches(c)) return {...collisionWall, record: c};
    // Walkable-centre ownership does not exclude a body that reaches a facade
    // across the shoreline. The radius-expanded grid and exact parts below
    // provide the bounded broad phase for these body queries.
    if (!radius && !regionContains(x, z)) return undefined;
    const query = ++collisionQuery;
    function check(rec) {
      if(rec.building.id===state.buildingId)return null;
      if (rec.collisionQuery === query) return null; rec.collisionQuery = query;
      if (!circleBox(rec.box)) return null;
      for (const c of recordParts(rec)) if (touches(c)) return {...collisionWall, record: c};
      return null;
    }
    if (radius > gridSize) {
      for (const rec of buildingRecords.values()) {const hit = check(rec); if (hit) return hit;}
      return null;
    }
    const minX = Math.floor((x - radius) / gridSize), maxX = Math.floor((x + radius) / gridSize);
    const minZ = Math.floor((z - radius) / gridSize), maxZ = Math.floor((z + radius) / gridSize);
    for (let ix = 0; ix <= maxX - minX; ix++) for (let iz = 0; iz <= maxZ - minZ; iz++)
      for (const rec of collisionGrid.get((minX + ix) + ',' + (minZ + iz)) || []) {const hit = check(rec); if (hit) return hit;}
    return null;
  }
  function cacheFloor(b, floor) {
    const key = b.id + ':' + floor;
    if (roomCache.has(key)) return roomCache.get(key);
    const data=floorData(b,floor);
    const records=data.walks.map(c=>({...c,id:c.kind||'interior-wall'}));
    if(data.slab)records.push(data.slab);if(data.ceiling)records.push(data.ceiling);
    roomCache.set(key, records); if (roomCache.size > 90) roomCache.delete(roomCache.keys().next().value);
    return records;
  }
  function floorBounds(rec) {
    // Building transforms and authored floors are fixed for this runtime.
    // Share the coarse boxes across shots instead of rebuilding eight world
    // corners per floor for every ray. Region resets clear this alongside the
    // detailed room records; a new world always creates new building records.
    if (!rec.floorBounds) {
      const b = rec.building;
      rec.floorBounds = Array.from({length: b.floors}, (_, i) => {
        const p = root.CityInteriors.profile(b.type, i + 1);
        return localBox(b, {min: [-p.width / 2, 0, -p.depth / 2], max: [p.width / 2, p.storyH, p.depth / 2]}, p.baseY);
      });
    }
    return rec.floorBounds;
  }
  function intersectBox(r, box, maxDistance) {
    if (!r.intersectBox(box, hitPoint)) return null;
    const distance = hitPoint.distanceTo(r.origin); return distance <= maxDistance ? distance : null;
  }
  function environmentHits(origin, direction, range, includeRooms = true, occlusionOnly = false) {
    ray.set(new T.Vector3(origin.x, origin.y, origin.z), new T.Vector3(direction.x, direction.y, direction.z).normalize());
    const hits = occlusionOnly ? null : [];
    function add(c) {
      if (occlusionOnly && c.kind === 'glass') return false;
      if (c.kind === 'glass' && brokenWindows.has(glassKey(c.buildingId, c.id))) return;
      const owner=surfaceHasCuts(c),surfaceHit=owner?surfaceRuntime().raycast(owner,ray.origin,ray.direction,range):null;
      const propHit=!owner&&c.outsideProp?propRayHit(c,ray,range):null;
      const distance=owner?(surfaceHit?.distance??null):c.outsideProp?(propHit?.distance??null):intersectBox(ray,c.box,range);
      if (distance !== null && distance > .015) {
        if (occlusionOnly) return true;
        let normal=surfaceHit?.normal||propHit?.normal;
        if(!normal){
          const p=ray.at(distance,new T.Vector3()),b=c.box,faces=[Math.abs(p.x-b.min.x),Math.abs(p.x-b.max.x),Math.abs(p.y-b.min.y),Math.abs(p.y-b.max.y),Math.abs(p.z-b.min.z),Math.abs(p.z-b.max.z)];
          const index=faces.indexOf(Math.min(...faces));normal=new T.Vector3().setComponent(Math.floor(index/2),index%2?1:-1);
        }
        hits.push({...c,distance,normal,record:c,surfaceRecord:c,surfaceOwner:owner||null,surfaceHost:surfaceHost(c)});
      }
      return false;
    }
    if(traceProps(origin,direction,range,add))return true;
    for (const rec of buildingRecords.values()) {
      if (rec.building.id === state.buildingId) continue;
      if (intersectBox(ray, rec.box, range) === null && !rec.box.containsPoint(ray.origin)) continue;
      for (const c of recordParts(rec)) if (!c.outsideProp && add(c)) return true;
      if (includeRooms) {
        const b = rec.building, bounds = floorBounds(rec);
        for (let n = 1; n <= b.floors; n++) {
          const floorBox = bounds[n - 1];
          if (intersectBox(ray, floorBox, range) !== null || floorBox.containsPoint(ray.origin)) for (const c of cacheFloor(b, n)) if (add(c)) return true;
        }
      }
    }
    for (const c of visibleFloorRecords()) if (add(c)) return true;
    return occlusionOnly ? false : hits;
  }
  function trace(origin, direction, range = 5000, options = {}) {
    const result = {hit: null, distance: range, crossedGlass: []};
    if (!active() || !origin || !direction || ![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, range].every(Number.isFinite) || range <= 0) return result;
    const d = new T.Vector3(direction.x, direction.y, direction.z); if (d.lengthSq() < 1e-10) return result; d.normalize();
    const hits = environmentHits(origin, d, range, options.rooms !== false);
    ray.set(new T.Vector3(origin.x, origin.y, origin.z), d);
    if (options.actors !== false) for (const person of [...sim.civilians, ...sim.swat]) {
      if (person.active === false || person.dead || !surfaceActorVisible(person)) continue;
      const r = person.radius || .33, reaction = hitPose(person);
      let distance;
      if (reaction?.proneK > 0) {
        // Transform the ray into the same tilted body used by every city LOD.
        // A standing-height ray must pass over an actor lying on the ground.
        setHitRoot(dummy, person, reaction); dummy.updateMatrix();
        const localRay = ray.clone().applyMatrix4(new T.Matrix4().copy(dummy.matrix).invert());
        const body = new T.Box3(new T.Vector3(-r, 0, -.25), new T.Vector3(r, person.height || 1.78, .25));
        distance = intersectBox(localRay, body, range);
      } else {
        const body = new T.Box3(new T.Vector3(person.x - r, person.y, person.z - r), new T.Vector3(person.x + r, person.y + (person.height || 1.78), person.z + r));
        distance = intersectBox(ray, body, range);
      }
      if (distance !== null) hits.push({kind: person.kind, id: person.id, person, distance});
    }
    if (options.vehicles !== false) for (const vehicle of sim.responseVehicles || []) {
      if (vehicle.active === false) continue;
      dummy.position.set(vehicle.x, vehicle.y, vehicle.z); dummy.rotation.set(0, vehicle.heading || 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      const inverse = new T.Matrix4().copy(dummy.matrix).invert();
      const localRay = ray.clone().applyMatrix4(inverse), body = new T.Box3(new T.Vector3(-1.38, .25, -3.15), new T.Vector3(1.38, 2.9, 3.15));
      const distance = intersectBox(localRay, body, range);
      if (distance !== null) hits.push({kind: 'response-vehicle', id: vehicle.id, vehicle, distance});
    }
    hits.sort((a, b) => a.distance - b.distance); const seen = new Set();
    for (const h of hits) {
      if (h.kind === 'glass') {const key = glassKey(h.buildingId, h.id); if (!seen.has(key)) {seen.add(key); result.crossedGlass.push(h);} continue;}
      const q = {x: origin.x + d.x * h.distance, y: origin.y + d.y * h.distance, z: origin.z + d.z * h.distance};
      const region = h.person ? actorRegion(h.person, q) : null, head = region === 'head';
      // x,h,y aliases match native G Royale shot records; point is Three Y-up.
      result.hit = {...h, westport: true, point: q, from: copyPoint(origin), direction: copyPoint(d), cause: options.cause || 'bullet', region,
        t: h.distance, x: q.x, h: q.y, y: q.z, z: q.z, part: h.person ? region : h.part, head};
      result.distance = h.distance; break;
    }
    return result;
  }
  function lineOfSight(a, b) {
    const dir = new T.Vector3(b.x - a.x, b.y - a.y, b.z - a.z), distance = dir.length();
    if (distance < .1) return true;
    if (host.lineOfSight && !host.lineOfSight(a, b)) return false;
    const range = distance - .15;
    if (!active() || ![a.x, a.y, a.z, dir.x, dir.y, dir.z, range].every(Number.isFinite) || range <= 0) return true;
    // Visibility only needs one opaque blocker. Keep the same ray, distance
    // tolerances and current-floor records as trace(), while avoiding hit
    // objects, sorting and distant intersections after the answer is known.
    // trace() normalizes its public input again before environmentHits().
    // Retain that rounding sequence at grazing wall/window boundaries.
    return !environmentHits(a, dir.normalize().normalize(), range, false, true);
  }
  function addEffect(kind, position, scale = 1, velocity) {
    if (!mount()) return;
    if (effects.length >= 80) removeEffect(effects.shift());
    const geometry = kind === 'shard' ? new T.ConeGeometry(.08, .24, 3) : kind === 'blast' ? new T.SphereGeometry(1, 12, 8) : new T.SphereGeometry(.055, 5, 4);
    const mat = new T.MeshBasicMaterial({color: kind === 'shard' ? '#b7e0e4' : kind === 'blast' ? '#edb273' : '#f1d39b', transparent: true, opacity: .8, depthWrite: false});
    const mesh = new T.Mesh(geometry, mat); mesh.position.set(position.x, position.y, position.z); mesh.scale.setScalar(scale); effectsRoot.add(mesh);
    effects.push({mesh, kind, life: kind === 'blast' ? 1.2 : 1.4, total: kind === 'blast' ? 1.2 : 1.4, velocity: velocity || {x: 0, y: 0, z: 0}, scale});
  }
  function addTracer(a, b) {
    if (!mount()) return;
    if (effects.length >= 80) removeEffect(effects.shift());
    const geometry = new T.BufferGeometry().setFromPoints([new T.Vector3(a.x, a.y, a.z), new T.Vector3(b.x, b.y, b.z)]);
    const mesh = new T.Line(geometry, new T.LineBasicMaterial({color: '#f2ba84', transparent: true, opacity: .9, depthWrite: false})); effectsRoot.add(mesh);
    effects.push({mesh, kind: 'tracer', life: .12, total: .12, velocity: {x: 0, y: 0, z: 0}, scale: 1});
  }
  function removeEffect(effect) {if (!effect) return; effect.mesh.removeFromParent(); effect.mesh.geometry.dispose(); effect.mesh.material.dispose();}
  function breakWindow(buildingId, floor, pane) {
    const id = typeof pane === 'object' ? pane.id : pane;
    if (typeof id !== 'string' || !buildingRecords.has(buildingId)) return false;
    const key = glassKey(buildingId, id); if (brokenWindows.has(key)) return false;
    const rec = buildingRecords.get(buildingId), part = rec.sourceParts.find(p => p.windowId === id) || floorRefs.find(r => r.part.buildingId === buildingId && r.part.windowId === id)?.part;
    if (!part) return false;
    brokenWindows.add(key);
    hqFacades.get(buildingId)?.breakWindow(id);
    for (const ref of windowRecords.get(key) || []) setRef(ref, false);
    for (const ref of floorRefs) if (ref.part.buildingId === buildingId && ref.part.windowId === id) setRef(ref, false);
    for (let i = 0; i < 6; i++) addEffect('shard', part, 1, {x: Math.sin(i * 2.3) * 1.5, y: 1 + i % 3 * .6, z: Math.cos(i * 2.3) * 1.5});
    host.onGlassBroken?.({buildingId, floor, pane: id, position:{x:part.x,y:part.y,z:part.z}}); return true;
  }
  function commitGlass(crossedGlass, maxDistance = Infinity) {
    let count = 0; for (const h of crossedGlass || []) if (h.distance <= maxDistance + .001 && breakWindow(h.buildingId, h.floor, h.id)) count++;
    return count;
  }
  function breakAlongRay(origin, direction, maxDistance) {
    const result = trace(origin, direction, maxDistance, {actors: false});
    return commitGlass(result.crossedGlass, Math.min(maxDistance, result.distance));
  }
  function applyHit(hit, amount, source = 'player') {
    if (!active() || !hit || !Number.isFinite(amount) || amount <= 0) return {hit: false, killed: false};
    syncPlayer(); let result = {hit: false, killed: false};
    const actor = hit.kind === 'civilian' ? sim.getCivilian(hit.id) : hit.kind === 'swat' ? sim.swat.find(p => p.id === hit.id) : null;
    if (actor && (actor.dead || !Number.isFinite(actor.hp) || actor.hp <= 0 || actor.active === false || !surfaceActorVisible(actor))) {processEvents(); return result;}
    const beforeHp = actor?.hp;
    if (hit.kind === 'civilian') result = sim.damageCivilian(hit.id, amount, source);
    else if (hit.kind === 'swat') result = sim.damageSwat(hit.id, amount, source);
    else if (hit.kind === 'response-vehicle') result = sim.damageResponseVehicle?.(hit.id, amount, source) || result;
    else if (hit.kind === 'glass') result = {hit: breakWindow(hit.buildingId, hit.floor, hit.id), killed: false};
    if(result.hit && (hit.kind === 'civilian' || hit.kind === 'swat')) {
      const dealt = Number.isFinite(beforeHp) ? Math.max(0, beforeHp - actor.hp) : 0;
      const point = copyPoint(hit.point), from = copyPoint(hit.from), direction = copyPoint(hit.direction);
      const cause = typeof hit.cause === 'string' ? hit.cause : 'unknown';
      // Low explosion/runover contact points are not anatomical bullet hits.
      const region = point && cause === 'bullet' ? actorRegion(actor, point) : 'torso';
      const reactions = getHitReactions(), sceneKey = hitScene(actor);
      if (dealt > 0 && reactions) {
        if (hitScenes.has(actor) && hitScenes.get(actor) !== sceneKey) reactions.clear(actor);
        hitScenes.set(actor, sceneKey);
        if (result.killed) reactions.death?.(actor, {time: sim.time, sceneKey});
        else reactions.hit(actor, {time: sim.time, region, damage: dealt, dead: false, sceneKey});
      }
      // Visual-only metadata survives the city authority; rejected/zero-loss
      // hits above cannot trigger blood. Directions remain world X/Y/Z.
      const meleeFeedback=cause==='melee'?{weapon:hit.weapon,bloodEffect:hit.bloodEffect,attackShape:hit.attackShape,sweepDirection:copyPoint(hit.sweepDirection),charge:Number.isFinite(hit.charge)?Math.max(0,Math.min(1,hit.charge)):0,meleeResult:hit.meleeResult}:null;
      if (dealt > 0) host.onActorHit?.({actor,amount,dealt,killed:result.killed,source,point,from,direction,region,cause,sceneKey,...meleeFeedback});
    } else if(result.hit && hit.kind === 'response-vehicle') {
      const vehicle=hit.vehicle || sim.responseVehicles?.find(v=>v.id===hit.id);
      host.onVehicleHit?.({vehicle,amount,killed:result.killed,source});
    }
    processEvents(); return result;
  }
  function damageRadius(center, radius, amount, source = 'player') {
    if (!active() || !copyPoint(center) || ![radius, amount].every(Number.isFinite) || radius <= 0 || amount <= 0) return 0;
    let count = damageResponseVehicles(center, radius, amount, source);
    for (const p of [...sim.civilians, ...sim.swat]) {
      if (p.dead || p.active === false || !surfaceActorVisible(p)) continue;
      const height = finite(hitPose(p)?.hitHeight, 1.8), target = {x: p.x, y: p.y + Math.min(.8, height * .62), z: p.z};
      const d = Math.hypot(target.x - center.x, target.y - center.y, target.z - center.z);
      if (d > radius || !lineOfSight(center, target)) continue;
      const direction = new T.Vector3(target.x - center.x, target.y - center.y, target.z - center.z).normalize();
      const dealt = amount * Math.max(.08, 1 - d / radius); applyHit({kind: p.kind, id: p.id, point: target, from: copyPoint(center), direction: copyPoint(direction), cause: 'explosion'}, dealt, source); count++;
    }
    damageSurfaces(center,radius,amount);
    return count;
  }
  function responseVehicleBlastPoint(vehicle, from) {
    const s = Math.sin(vehicle.heading || 0), c = Math.cos(vehicle.heading || 0), dx = from.x - vehicle.x, dz = from.z - vehicle.z;
    const x = clamp(dx * c - dz * s, -1.38, 1.38), z = clamp(dx * s + dz * c, -3.15, 3.15);
    const p = {x: vehicle.x + x * c + z * s, y: clamp(from.y, vehicle.y + .25, vehicle.y + 2.9), z: vehicle.z - x * s + z * c};
    const distance = Math.hypot(p.x - from.x, p.y - from.y, p.z - from.z);
    // End just outside the hull so the target never occludes its own blast.
    if (distance > .18) {const k = (distance - .18) / distance; p.x = from.x + (p.x - from.x) * k; p.y = from.y + (p.y - from.y) * k; p.z = from.z + (p.z - from.z) * k;}
    return p;
  }
  function damageResponseVehicles(center, radius, amount, source = 'player', excludeId = null) {
    if (!active() || !copyPoint(center) || ![radius, amount].every(Number.isFinite) || radius <= 0 || amount <= 0) return 0;
    let count = 0;
    for (const vehicle of sim.responseVehicles || []) {
      if (vehicle.dead || vehicle.active === false || vehicle.id === excludeId) continue;
      const target = responseVehicleBlastPoint(vehicle, center), d = Math.hypot(target.x - center.x, target.y - center.y, target.z - center.z);
      if (d >= radius || d > .2 && !lineOfSight(center, target)) continue;
      if (applyHit({kind: 'response-vehicle', id: vehicle.id, vehicle}, amount * Math.max(.08, 1 - d / radius), source).hit) count++;
    }
    return count;
  }
  function label(text, position, width) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
    let ctx; try {ctx = canvas.getContext('2d');} catch (_) {return null;} if (!ctx) return null;
    ctx.fillStyle = '#143039'; ctx.fillRect(0, 0, 768, 128); ctx.strokeStyle = '#cbb887'; ctx.lineWidth = 5; ctx.strokeRect(4, 4, 760, 120);
    ctx.fillStyle = '#f0e8ce'; ctx.font = '500 48px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const measured = ctx.measureText(text).width; if (measured > 700) ctx.font = '500 ' + Math.max(22, Math.floor(48 * 700 / measured)) + 'px sans-serif';
    ctx.fillText(text, 384, 65, 700);
    const texture = new T.CanvasTexture(canvas), mat = new T.SpriteMaterial({map: texture, transparent: false, depthWrite: false});
    const sprite = new T.Sprite(mat); sprite.position.set(position.x, position.y, position.z); sprite.scale.set(width, width / 6, 1); sprite.userData.westportPrivate = true; sprite.userData.label = text; return sprite;
  }
  function placeNative(position, floor, preservePosition = false, absoluteFeet) {
    const meta = {buildingId: currentBuilding?.id || null, floor, baseY: currentBuilding ? state.baseY : null, rotation: finite(currentBuilding?.rotation), interior: !!currentBuilding, preservePosition,...(Number.isFinite(absoluteFeet)?{absoluteFeet}:{})};
    if (host.setPlayer) host.setPlayer(position, meta);
    else {
      const p = player().entity; if (!p) return;
      if (!preservePosition) {p.x = position.x; p.y = position.z; p.jz = 0; p.alt = 0; p.floor = 0;}
      p.westportBuildingId = meta.buildingId; p.westportFloor = meta.floor; p.westportBaseY = meta.baseY;
      if(Number.isFinite(absoluteFeet))p.jz=absoluteFeet-(Number.isFinite(meta.baseY)?meta.baseY:outsideGround(p.x,p.y));
    }
    syncPlayer();
  }
  // OFFICE_STAFF_WESTPORT_START
  const officeCityStates = new Set(['working', 'startled', 'defending', 'returning']);
  function officeCitySeat(b, model, seat) {
    const scale = b.scale || 1, floor = point(b, {x: seat.x, y: 0, z: seat.z}, model.baseY);
    const room = model.rooms.find(r => r.id === seat.roomId);
    const stands = (seat.stands || []).filter(p => !room || Math.abs(p.x - room.x) < room.w / 2 - .35 && Math.abs(p.z - room.z) < room.d / 2 - .35)
      .map(p => point(b, {x: p.x, y: 0, z: p.z}, model.baseY)).filter(p => interiorLegal(p.x, p.z, .28, p.y));
    if (!stands.length) return null;
    return {...floor, id: seat.id, roomId: seat.roomId, roomKind: seat.roomKind, heading: finite(seat.heading) + finite(b.rotation),
      seatHeight: finite(seat.seatHeight, .55) * scale, deskHeight: finite(seat.deskHeight, .86) * scale,
      handForward: .53 * scale, workOffset: .18 * scale, stands, scale};
  }
  function officeCityPeople(b, model, originalPeople) {
    // Retain the old legal-point list and its indices before any office override.
    const people = originalPeople.map(p => ({...p})), available = (model.officeSeats || []).map(seat => officeCitySeat(b, model, seat)).filter(Boolean), used = new Set();
    const apply = (person, seat) => Object.assign(person, {x: seat.x, y: seat.y, z: seat.z, heading: seat.heading,
      name: person.name || '사무 직원', roomId: seat.roomId, roomKind: seat.roomKind, officeStaff: true, officeSeat: seat, officeState: 'working', officeWorking: true});
    for (const person of people) {
      const seat = available.find(q => q.roomId === person.roomId && !used.has(q.id));
      if (seat) {apply(person, seat); used.add(seat.id);}
    }
    // Newly furnished office positions append after all legacy IDs.
    for (const seat of available) {
      if (used.has(seat.id) || people.length >= 24) continue;
      const room = model.rooms.find(r => r.id === seat.roomId);
      people.push(apply({name: (room?.name || '사무실') + ' 직원', waypoints: []}, seat)); used.add(seat.id);
    }
    return people;
  }
  function officeCityBody(person) {
    person.height = person.officeWorking ? finite(person.officeSeat?.seatHeight, .52) + 1.04 : 1.84;
    person.officeHeadAt = person.officeWorking ? finite(person.officeSeat?.seatHeight, .52) + .69 : 1.42;
  }
  function officePrepareCity(people, specs) {
    for (let i = 0; i < people.length; i++) {
      const p = people[i], spec = specs[i]; if (p.surfaceOriginFloor || !spec?.officeStaff || !spec.officeSeat) continue;
      const migrate = !p.officeStaff || p.officeRoleVersion !== 1 || !officeCityStates.has(p.officeState);
      Object.assign(p, {officeStaff: true, officeRoleVersion: 1, officeSeat: clone(spec.officeSeat), roomId: spec.roomId, roomKind: spec.roomKind,
        name: spec.name, armor: 0, armorHp: 0, officeWeapon: 'pistol'});
      p.officeMagazine = clamp(Math.round(finite(p.officeMagazine, 12)), 0, 12);
      p.officeAmmo = clamp(Math.round(finite(p.officeAmmo, 36)), 0, 36);
      p.officeReload = clamp(finite(p.officeReload), 0, 1.1); p.officeFireCooldown = clamp(finite(p.officeFireCooldown), 0, .85);
      p.officeAimTime = clamp(finite(p.officeAimTime), 0, .6); p.officeReaction = clamp(finite(p.officeReaction), 0, .7);
      if (p.dead) {p.officeWorking = false; p.officeWeaponDrawn = false; officeCityBody(p); continue;}
      if (migrate) {
        Object.assign(p, {x: spec.x, y: spec.y, z: spec.z, heading: spec.heading, officeState: 'working', officeWorking: true,
          officeWeaponDrawn: false, officeThreatUntil: 0, officeThreatByPlayer: false, officeAimTime: 0, officeReaction: 0, officeReload: 0});
      } else if (p.officeState === 'working') {
        Object.assign(p, {x: spec.x, y: spec.y, z: spec.z, heading: spec.heading, officeWorking: true, officeWeaponDrawn: false});
      } else {
        if (finite(p.officeThreatUntil) <= sim.time) p.officeState = 'returning';
        p.y = spec.y; p.officeWorking = false; p.officeWeaponDrawn = p.officeState === 'defending';
        if (!interiorLegal(p.x, p.z, .26, p.y)) {const stand = p.officeSeat.stands[0]; p.x = stand.x; p.z = stand.z;}
      }
      p.pause = 0; p.panicUntil = 0; officeCityBody(p);
    }
    return people;
  }
  function officeCitySameSpace(person, other = player()) {
    return !!(person.indoor && other.interior && person.buildingId === other.buildingId && person.floor === other.floor);
  }
  function officeCityChest(person) {return {x: person.x, y: person.y + (person.officeWorking ? finite(person.officeSeat?.seatHeight, .52) + .45 : 1.22), z: person.z};}
  function officeCityThreat(person, reason, source = 'player') {
    if (!person?.officeStaff || person.dead) return false;
    person.officeThreatUntil = Math.max(finite(person.officeThreatUntil), sim.time + 6);
    person.officeThreatByPlayer = source === 'player' || source?.isPlayer === true;
    person.officeReason = reason;
    if (person.officeState === 'working' || person.officeState === 'returning') {
      person.officeState = 'startled'; person.officeReaction = .55; person.officeWorking = false; person.officeWeaponDrawn = false;
      const stands = person.officeSeat?.stands || []; person.officeStand = stands.reduce((best, p) => !best || Math.hypot(p.x - person.x, p.z - person.z) < Math.hypot(best.x - person.x, best.z - person.z) ? p : best, null);
    }
    person.officeAimTime = 0; officeCityBody(person); return true;
  }
  function officeCityAudible(person, origin, target) {
    if (!currentBuilding || !floorModel) return false;
    const q = localPoint(currentBuilding, origin, floorModel.baseY);
    const room = floorModel.rooms.find(r => Math.abs(q.x - r.x) < r.w / 2 && Math.abs(q.z - r.z) < r.d / 2);
    // A neighbouring office is a separate acoustic space. From a corridor,
    // only an actually open sight line through its doorway can carry the alert.
    if (!room) return lineOfSight(origin, target);
    if (room.id !== person.roomId) return false;
    const direction = new T.Vector3(target.x - origin.x, target.y - origin.y, target.z - origin.z), distance = direction.length();
    if (distance < .1) return true;
    ray.set(new T.Vector3(origin.x, origin.y, origin.z), direction.normalize());
    // A desk or monitor does not acoustically isolate coworkers in one room.
    for (const c of currentBoxes) {
      if (c.kind === 'glass' || c.part?.role === 'furniture') continue;
      const at = intersectBox(ray, c.box, distance - .05);
      if (at !== null && at > .015) return false;
    }
    return true;
  }
  function officeShot(origin, meta = {}) {
    if (!active() || !origin || ![origin.x, origin.y, origin.z].every(Number.isFinite) || meta.source !== 'player') return 0;
    const p = player(); if (!p.alive || !p.interior || !meta.buildingId || meta.buildingId !== p.buildingId || meta.floor !== p.floor) return 0;
    let affected = 0; const range = meta.kind === 'explosion' ? 16 : 22;
    for (const person of sim.civilians) {
      if (!person.officeStaff || person.dead || person.active === false || !officeCitySameSpace(person, p)) continue;
      const target = officeCityChest(person);
      if (Math.hypot(target.x - origin.x, target.y - origin.y, target.z - origin.z) > range || !officeCityAudible(person, origin, target)) continue;
      if (officeCityThreat(person, meta.kind === 'explosion' ? 'near-explosion' : 'near-shot', 'player')) affected++;
    }
    return affected;
  }
  function officeCityAimed(person, p) {
    const native = nativeState(), e = p.entity, slot = e?.weapons?.[e.cur || 0];
    if (!native || !e || !slot || ['fist', 'mortar'].includes(slot.type) || e.reloadT > 0 || e.healT > 0 || !p.alive || !officeCitySameSpace(person, p)) return false;
    if (!(native.input?.ads || native.input?.adsToggle || finite(native.adsK) > .5)) return false;
    const origin = {x: p.x, y: p.y + (e.crouch ? 1.08 : 1.55), z: p.z}, target = officeCityChest(person);
    const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z, distance = Math.hypot(dx, dy, dz);
    if (distance > 32 || distance < .2) return false;
    const yaw = finite(native.yaw, finite(e.aim)), pitch = finite(native.pitch), cp = Math.cos(pitch);
    const dot = dx * Math.cos(yaw) * cp - dy * Math.sin(pitch) + dz * Math.sin(yaw) * cp;
    if (dot <= 0 || Math.sqrt(Math.max(0, distance * distance - dot * dot)) > .40 + distance * .012) return false;
    return lineOfSight(origin, target);
  }
  function officeCityWalk(person, target, dt) {
    if (!target || hitBlocked(person)) {person.officeMoving = false; return false;}
    const dx = target.x - person.x, dz = target.z - person.z, distance = Math.hypot(dx, dz);
    if (distance < .035) {person.x = target.x; person.z = target.z; person.officeMoving = false; return true;}
    const step = Math.min(distance, dt * 1.55), sx = dx / distance * step, sz = dz / distance * step;
    let moved = false;
    if (npcInteriorWalkable(person.x + sx, person.z,person,.24)) {person.x += sx; moved = true;}
    if (npcInteriorWalkable(person.x, person.z + sz,person,.24)) {person.z += sz; moved = true;}
    if (moved) {person.heading = Math.atan2(dx, dz); person.phase += step * 8;}
    person.officeMoving = moved; return Math.hypot(target.x - person.x, target.z - person.z) < .06;
  }
  function officeCityFire(person, target) {
    if (person.dead || hitBlocked(person)) return false;
    const from = {x: person.x + Math.sin(person.heading) * .62, y: person.y + 1.20, z: person.z + Math.cos(person.heading) * .62};
    const to = {x: target.x, y: target.y + (target.entity?.crouch ? .76 : 1.12), z: target.z};
    if (!lineOfSight(from, to)) return false;
    person.officeShots = Math.max(0, Math.trunc(finite(person.officeShots))) + 1;
    const seed = [...String(person.id)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7), distance = Math.hypot(to.x - from.x, to.z - from.z);
    let hit = (seed + person.officeShots * 37) % 100 < (distance < 10 ? 48 : distance < 20 ? 34 : 22);
    if (!hit) {to.x += (person.officeShots % 2 ? 1 : -1) * (.8 + distance * .025); to.y += .20;}
    const d = new T.Vector3(to.x - from.x, to.y - from.y, to.z - from.z), length = d.length();
    if (length > .01) {const barrier = trace(from, d.normalize(), length, {actors: false}).hit; if (barrier) {Object.assign(to, barrier.point); hit = false;}}
    person.officeMagazine--; person.officeFireCooldown = .80; person.officeRecoil = 1;
    sim.events.push({type: 'office-shot', employeeId: person.id, from, to, hit, time: sim.time});
    if (hit) sim.events.push({type: 'player-hit', amount: 22, source: 'office-staff', employeeId: person.id, from, time: sim.time, nativeDamage: true});
    return true;
  }
  function officeCityUpdate(dt) {
    if (!active() || host.isPaused?.()) return;
    dt = clamp(finite(dt), 0, .25); const p = syncPlayer(); if (!p.alive || dt <= 0) return;
    for (const person of sim.civilians) {
      if (!person.officeStaff || person.active === false || person.dead || !person.officeSeat || person.floor!==state.floor) continue;
      if (hitBlocked(person)) {person.officeMoving = false; person.officeAimTime = 0; continue;}
      person.officeRecoil = Math.max(0, finite(person.officeRecoil) - dt * 5);
      person.officeFireCooldown = Math.max(0, finite(person.officeFireCooldown) - dt);
      if (person.officeReload > 0) {
        person.officeReload = Math.max(0, person.officeReload - dt);
        if (!person.officeReload) {const take = Math.min(12 - person.officeMagazine, person.officeAmmo); person.officeMagazine += take; person.officeAmmo -= take;}
      }
      const aimed = officeCityAimed(person, p);
      person.officeAimTime = aimed ? Math.min(.6, finite(person.officeAimTime) + dt) : 0;
      if (person.officeAimTime >= .6 - 1e-6) officeCityThreat(person, 'direct-aim', 'player');
      if (person.officeState === 'working') {
        Object.assign(person, {x: person.officeSeat.x, y: person.officeSeat.y, z: person.officeSeat.z, heading: person.officeSeat.heading, officeWorking: true, officeWeaponDrawn: false, officeMoving: false});
        officeCityBody(person); continue;
      }
      person.officeWorking = false;
      if (sim.time >= finite(person.officeThreatUntil)) {person.officeState = 'returning'; person.officeWeaponDrawn = false; person.officeReaction = 0;}
      if (person.officeState === 'startled') {
        officeCityWalk(person, person.officeStand || person.officeSeat.stands[0], dt);
        person.officeReaction = Math.max(0, finite(person.officeReaction) - dt);
        if (!person.officeReaction) {person.officeState = 'defending'; person.officeWeaponDrawn = true; person.officeFireCooldown = Math.max(.25, person.officeFireCooldown);}
      } else if (person.officeState === 'defending') {
        person.officeMoving = false; person.officeWeaponDrawn = true;
        if (person.officeThreatByPlayer && officeCitySameSpace(person, p)) {
          const distance = Math.hypot(person.x - p.x, person.z - p.z); person.heading = Math.atan2(p.x - person.x, p.z - person.z);
          if (distance <= 32 && lineOfSight(officeCityChest(person), {x: p.x, y: p.y + 1.1, z: p.z})) {
            if (person.officeMagazine <= 0 && person.officeAmmo > 0 && person.officeReload <= 0) person.officeReload = 1.1;
            else if (person.officeMagazine > 0 && person.officeReload <= 0 && person.officeFireCooldown <= 0) officeCityFire(person, p);
          }
        }
      } else if (person.officeState === 'returning') {
        person.officeWeaponDrawn = false;
        if (officeCityWalk(person, person.officeSeat, dt)) Object.assign(person, {x: person.officeSeat.x, y: person.officeSeat.y, z: person.officeSeat.z, heading: person.officeSeat.heading, officeState: 'working', officeWorking: true, officeMoving: false});
      }
      officeCityBody(person);
    }
  }
  function officeCitySavePerson(person, time) {
    const saved = clone(person);
    if (saved.officeStaff) {saved.officeTimers = {threat: clamp(finite(person.officeThreatUntil) - time, 0, 30)}; delete saved.officeThreatUntil;}
    return saved;
  }
  function officeCityRestorePerson(person, oldTime) {
    if (person.officeStaff) {
      person.officeThreatUntil = sim.time + (person.officeTimers ? clamp(finite(person.officeTimers.threat), 0, 30) : clamp(finite(person.officeThreatUntil) - oldTime, 0, 30));
      delete person.officeTimers;
      person.officeAimTime = clamp(finite(person.officeAimTime), 0, .6);
      person.officeReload = clamp(finite(person.officeReload), 0, 1.1); person.officeReaction = clamp(finite(person.officeReaction), 0, .7);
    }
    return person;
  }
  // OFFICE_STAFF_WESTPORT_END
  function interiorPeople(b, model) {
    const people = [];
    for (const room of model.rooms) {
      let found = null;
      for (const dz of [0, -1.8, 1.8]) {
        for (const dx of [0, -2, 2]) {const p = point(b, {x: room.x + dx, y: .15, z: room.z + dz}, model.baseY); if (interiorLegal(p.x, p.z, .36)) {found = p; break;}}
        if (found) break;
      }
      if (!found) continue;
      const waypoints = [{x: found.x, z: found.z}], alt = {x: found.x + 1.4, z: found.z}; if (interiorLegal(alt.x, alt.z, .36)) waypoints.push(alt);
      people.push({...found, name: room.name + ' 직원', roomId: room.id, roomKind: room.kind, waypoints});
    }
    return officeCityPeople(b, model, people.slice(0, 12));
  }
  function addArchiveWayfinding(b, model, elevatorSpot) {
    if (!archiveFloor(b, state.floor)) return;
    const group = new T.Group(); group.name = 'WESTPORT archive wayfinding'; group.userData.wayfinding = 'abyss-basement'; floorGroup.add(group);
    const signs = [
      {text: 'B1 해양기록관 →', x: model.spawn.x, y: 2.75, z: model.spawn.z - 2.5, width: 4.4},
      {text: 'B1 해양기록관 · 엘리베이터', x: elevatorSpot.x, y: 2.65, z: elevatorSpot.z, width: 6.4}
    ];
    for (const spec of signs) {
      const sign = label(spec.text, point(b, spec, model.baseY), spec.width * b.scale);
      if (sign) {sign.name = 'WESTPORT archive direction sign'; group.add(sign);}
    }
    // The existing transverse lobby is clear from the front entrance to the
    // lift. Floor markings follow that aisle without adding collision boxes.
    const parts = [], start = model.spawn.x + 2.5, end = elevatorSpot.x - 1.4, z = elevatorSpot.z;
    parts.push({shape: 'box', x: (start + end) / 2, y: .086, z, sx: Math.max(.2, end - start), sy: .02, sz: .1, color: '#42c1c8', material: 'lit', role: 'archive-guide'});
    for (let x = start + 2.5; x < end; x += 5) for (const side of [-1, 1]) {
      parts.push({shape: 'box', x, y: .104, z: z + side * .43, sx: 1.25, sy: .025, sz: .18, ry: side * Math.PI / 4, color: '#7be5de', material: 'lit', role: 'archive-arrow'});
    }
    const worldParts = root.CityWorld.transform(parts, b.x, b.y + model.baseY * b.scale, b.z, b.scale, b.rotation, 'archive-wayfinding');
    buildParts(worldParts, group, false, false);
  }
  function activateFloor(b, n, elevator = false, preservePosition = false, absoluteFeet) {
    disposeFloor(); currentBuilding = b; state.buildingId = b.id; state.floor = n;
    const data=floorData(b,n);floorModel=data.model;state.baseY=b.y+floorModel.baseY*b.scale+.13*b.scale;
    const all=data.parts;
    floorGroup = new T.Group(); floorGroup.name = 'WESTPORT ' + b.id + ' floor ' + n; container.add(floorGroup); buildParts(all, floorGroup, true); showBuilding(b.id, false);
    currentBoxes=data.records;walkBoxes=data.walks;
    const elevatorSpot = floorModel.elevator.interact || {x: floorModel.elevator.x - 3, z: floorModel.elevator.z};
    const spawn = elevator ? elevatorSpot : floorModel.spawn, position = point(b, {x: spawn.x, y: .13, z: spawn.z}, floorModel.baseY);
    placeNative(preservePosition ? player() : position,n,preservePosition,absoluteFeet);
    const officeSpecs = interiorPeople(b, floorModel);
    const authoredPeople=sim.activateInterior({buildingId:b.id,floor:n,people:officeSpecs});
    officePrepareCity(authoredPeople,officeSpecs);activeFloorPeople=[];
    for(const p of authoredPeople){p.active=p.floor===n;if(p.active)activeFloorPeople.push(p);}
    for(const p of relocatedPeople)if(p.buildingId===b.id&&p.floor===n){p.active=true;if(!activeFloorPeople.includes(p))activeFloorPeople.push(p);}
    const extensions = extraFloors(), extensionLabel = extensions.length ? ' / ' + extensions.map(f => f.number).join(' · ') : '';
    if (!archiveFloor(b, n)) {const sign = label('ELEVATOR  ' + n + 'F' + extensionLabel, point(b, {x: elevatorSpot.x, y: 2.45, z: elevatorSpot.z}, floorModel.baseY), 4.2 * b.scale); if (sign) floorGroup.add(sign);}
    addArchiveWayfinding(b, floorModel, elevatorSpot);
    for (const room of floorModel.rooms) {const sign = label(room.name, point(b, {x: room.x, y: Math.min(floorModel.height - .5, 2.7), z: room.z}, floorModel.baseY), Math.min(6, room.w * .8) * b.scale); if (sign) floorGroup.add(sign);}
    refreshNeighborFloors();for(const p of fallingPeople)if(p.buildingId===b.id)p.active=surfaceActorVisible(p);closeElevator(); mount(); updateHud(true); return floorModel;
  }
  function enterBuilding(id, floor = 1) {
    const b = typeof id === 'object' ? id : W.buildings.find(b => b.id === id || b.type === id);
    if (!active() || !b || !player().alive || player().entity?.craft || player().entity?.vehicle) return false;
    activateFloor(b, clamp(Math.round(floor), 1, b.floors), floor > 1); say(b.name + ' · ' + state.floor + '층 ' + floorModel.floorName + (archiveFloor(b, state.floor) ? ' · 지하 B1은 로비 오른쪽 엘리베이터' : '')); return true;
  }
  function changeFloor(floor) {
    if (!currentBuilding || !player().alive || !Number.isInteger(floor) || floor < 1 || floor > currentBuilding.floors) return false;
    activateFloor(currentBuilding, floor, true); say(currentBuilding.name + ' · ' + floor + '층 ' + floorModel.floorName); return true;
  }
  function exitBuilding() {
    if (!currentBuilding) return false;
    const b = currentBuilding, profile = root.CityInteriors.profile(b.type, 1), position = point(b, {x: 0, y: 0, z: profile.depth / 2 + 2.5});
    disposeFloor(); currentBuilding = null; state.buildingId = null; state.floor = 0; state.baseY = null; state.ride = 0;
    position.y = outsideGround(position.x, position.z); placeNative(position, 0); closeElevator(); updateHud(true); return true;
  }
  function syncBreachTransition(){
    if(!active()||state.ride>0||host.isTransitioning?.())return false;
    const p=player(),e=p.entity;if(!e||!p.alive||e.vehicle||e.craft)return false;
    const radius=.35;
    if(currentBuilding){
      const b=currentBuilding,rec=buildingRecords.get(b.id),q=localPoint(b,p),r=radius/b.scale;
      const fullyOutside=Math.abs(q.x)>floorModel.width/2+r||Math.abs(q.z)>floorModel.depth/2+r;
      if(!fullyOutside||!breachAt(rec,p.x,p.z,p.y,radius)||!breachLegal(rec,p.x,p.z,radius,p.y))return false;
      const feet=p.y,vz=e.vz,air=e.air;
      disposeFloor();currentBuilding=null;state.buildingId=null;state.floor=0;state.baseY=null;state.ride=0;
      placeNative(p,0,true,feet);e.jz=feet-outsideGround(p.x,p.z);e.vz=vz;e.air=air;closeElevator();updateHud(true);return true;
    }
    for(const id of damagedBuildings){
      const rec=buildingRecords.get(id),b=rec.building,q=localPoint(b,p),r=radius/b.scale;
      if(Math.abs(q.x)>rec.profile.width/2-r||Math.abs(q.z)>rec.profile.depth/2-r||Math.abs(p.y-(b.y+.13*b.scale))>1.1)continue;
      // The retained entrance slab is a small step above the street. Test the
      // full body at its supported height, without ignoring slab collision or
      // moving an airborne actor upward through an intact floor.
      const floorFeet=b.y+.13*b.scale,rise=floorFeet-p.y;
      const stepUp=!e.air&&finite(e.vz)<=.05&&rise>0&&rise<=.35,feet=stepUp?floorFeet:p.y;
      if(!breachAt(rec,p.x,p.z,feet,radius)||!breachLegal(rec,p.x,p.z,radius,feet))continue;
      const vz=e.vz,air=e.air;activateFloor(b,1,false,true,feet);e.jz=feet-state.baseY;e.vz=stepUp?0:vz;e.air=air;return true;
    }
    return false;
  }
  function vertical(e,dt,options={}){
    if(!currentBuilding||e!==player().entity||!e?.alive||e.vehicle||e.craft||e.alt>0||e.climb||e.vault||state.ride>0||!Number.isFinite(dt)||dt<=0)return false;
    if(!containsFloor(e.x,e.y,.1)){syncBreachTransition();return false;}
    const radius=finite(options.radius,.35),height=finite(options.bodyHeight,1.8),gravity=finite(options.gravity,15),from=state.baseY+finite(e.jz),samples=[];
    for(const [dx,dz]of[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]){const y=groundAt(e.x+dx,e.y+dz,from+.04);if(Number.isFinite(y))samples.push(y);}
    samples.sort((a,b)=>b-a);let support;
    for(const y of samples)if(samples.filter(q=>Math.abs(q-y)<.02).length>=3){support=y;break;}
    if(!Number.isFinite(support))support=outsideGround(e.x,e.y);
    let velocity=finite(e.vz),to=from;
    if(velocity>0||from>support+.01){
      velocity-=gravity*Math.min(dt,.1);to=from+velocity*Math.min(dt,.1);e.air=true;
      if(to>from){
        let ceiling=Infinity;for(const [dx,dz]of[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]){const y=ceilingAt(e.x+dx,e.y+dz,from+height-.02);if(Number.isFinite(y))ceiling=Math.min(ceiling,y);}
        if(to+height>ceiling){to=Math.max(from,ceiling-height);velocity=0;}
      }
      if(to<=support){to=support;velocity=0;e.air=false;}
    }else{to=support;velocity=0;e.air=false;}
    e.jz=to-state.baseY;e.vz=velocity;
    if(state.floor>1&&to<state.baseY-.36*currentBuilding.scale){
      const b=currentBuilding,next=state.floor-1;activateFloor(b,next,true,true,to);e.jz=to-state.baseY;e.vz=velocity;e.air=to>support+.01;
    }
    return true;
  }
  function prompt() {
    if (!active() || host.isTransitioning?.()) return null;
    const p = player(); if (!p.alive || p.entity?.craft || p.entity?.vehicle || state.ride > 0) return null;
    if (currentBuilding && floorModel) {
      const q = localPoint(currentBuilding, p, floorModel.baseY), e = floorModel.elevator.interact || floorModel.elevator;
      if (Math.hypot(q.x - e.x, q.z - e.z) < 5.2) return {kind: 'elevator', text: extraFloors().length ? '엘리베이터 · B1 해양기록관 / 층 선택' : '엘리베이터 · 층 선택', key: 'E'};
      if (state.floor === 1 && Math.hypot(q.x - floorModel.exit.x, q.z - floorModel.exit.z) < 5) return {kind: 'exit', text: '도시로 나가기', key: 'E'};
      return null;
    }
    let found = null, nearest = 7;
    for (const rec of buildingRecords.values()) {const d = Math.hypot(p.x - rec.door.x, p.z - rec.door.z); if (d < nearest && Math.abs(p.y - rec.door.y) < 3.5) {nearest = d; found = {kind: 'building', building: rec.building, text: rec.building.name + ' 들어가기' + (archiveFloor(rec.building, 1) ? ' · 지하 B1 해양기록관' : ''), key: 'E'};}}
    return found;
  }
  function interact() {
    if (host.isTransitioning?.()) return false;
    if (state.uiOpen) {closeElevator(); return true;}
    const p = prompt(); if (!p) return false;
    if (p.kind === 'building') {
      const b = p.building, door = buildingRecords.get(b.id).door, commit = () => enterBuilding(b.id);
      const isCurrent = () => {const q = player(); return active() && !currentBuilding && q.alive && !q.entity?.vehicle && !q.entity?.craft && Math.hypot(q.x - door.x, q.z - door.z) < 7 && Math.abs(q.y - door.y) < 3.5;};
      return host.transitionInterior ? host.transitionInterior({kind: 'enter', buildingId: b.id, floor: 1, label: b.name + ' · 1층', isCurrent}, commit) : commit();
    }
    if (p.kind === 'exit') {
      const b = currentBuilding, floor = state.floor, commit = () => exitBuilding();
      return host.transitionInterior ? host.transitionInterior({kind: 'exit', buildingId: b.id, floor, label: 'WESTPORT · 도시로 나가기', isCurrent: () => active() && currentBuilding === b && state.floor === floor && player().alive}, commit) : commit();
    }
    if (p.kind === 'elevator') {openElevator(); return true;} return false;
  }
  function rideTo(floor) {
    if (!currentBuilding || state.ride > 0 || !Number.isInteger(floor) || floor < 1 || floor > currentBuilding.floors || floor === state.floor) return false;
    state.rideTarget = floor; state.ride = .65 + Math.min(1.1, Math.abs(floor - state.floor) * .06); closeElevator();
    say('엘리베이터 ' + state.floor + 'F → ' + floor + 'F'); return true;
  }
  function ensureUi() {
    if (ui || typeof document === 'undefined' || !document.createElement || !document.body) return;
    const wrapper = document.createElement('div'); wrapper.id = 'westport-native-ui'; wrapper.innerHTML = '<button type="button" class="wpt-location" hidden aria-expanded="false" aria-controls="wpt-location-details"></button><div id="wpt-location-details" class="wpt-location-details" hidden></div><div class="wpt-alert" hidden></div><button type="button" class="wpt-use" hidden></button><div class="wpt-modal" hidden role="dialog" aria-modal="true" aria-label="엘리베이터 층 선택"><section class="wpt-panel"><button type="button" class="wpt-close">닫기 · Esc</button><h2></h2><p>이동할 층을 선택하세요</p><div class="wpt-floors"></div></section></div>';
    (host.controlsRoot || document.body).appendChild(wrapper);
    ui = {wrapper, location: wrapper.querySelector('.wpt-location'), details: wrapper.querySelector('.wpt-location-details'), locationOpen: false, locationKey: null, alert: wrapper.querySelector('.wpt-alert'), use: wrapper.querySelector('.wpt-use'), modal: wrapper.querySelector('.wpt-modal'), list: wrapper.querySelector('.wpt-floors'), title: wrapper.querySelector('h2'), hint: wrapper.querySelector('.wpt-panel p')};
    ui.location.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      const wasOpen = !ui.details.hidden; ui.locationOpen = !wasOpen;
      // The host's Details button and this location chip share one disclosure.
      // Closing it should also close a disclosure opened through the host.
      if (wasOpen && nativeState()?.hudExpanded) nativeState().hudExpanded = false;
      updateHud(true);
    };
    ui.use.onclick = e => {e.preventDefault(); e.stopPropagation(); interact();}; wrapper.querySelector('.wpt-close').onclick = closeElevator;
    for (const name of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend']) {
      for (const element of [ui.modal, ui.use, ui.location, ui.details]) element.addEventListener(name, e => e.stopPropagation());
    }
    ui.outside = e => {
      if (ui.locationOpen && !ui.location.contains(e.target) && !ui.details.contains(e.target)) {ui.locationOpen = false; updateHud(true);}
    };
    ui.escape = e => {
      if (e.key !== 'Escape') return;
      if (state.uiOpen) {e.preventDefault(); e.stopImmediatePropagation(); closeElevator();}
      else if (!ui.details.hidden) {e.preventDefault(); e.stopImmediatePropagation(); ui.locationOpen = false; if (nativeState()) nativeState().hudExpanded = false; updateHud(true);}
    };
    document.addEventListener('pointerdown', ui.outside, true);
    document.addEventListener('keydown', ui.escape, true);
  }
  function extraFloorsFor(building, floor) {
    if (!building || typeof host.extraFloors !== 'function') return [];
    const items = host.extraFloors(building, floor);
    return Array.isArray(items) ? items.filter(f => f && typeof f.id === 'string' && typeof f.number === 'string' && typeof f.name === 'string') : [];
  }
  function extraFloors() {return extraFloorsFor(currentBuilding, state.floor);}
  function archiveFloor(building, floor) {return building?.type === 'museum' ? extraFloorsFor(building, floor).find(f => f.id === 'abyss-basement') : null;}
  // External destinations own their geometry and saves. Their preparation must
  // complete before mutating the native player; asynchronous hosts check the
  // supplied lease immediately before committing a transfer.
  function selectExtraFloor(id, expectedBuildingId = currentBuilding?.id) {
    const p = player(), b = currentBuilding;
    if (!active() || !b || b.id !== expectedBuildingId || !state.uiOpen || state.extraFloorPending || state.ride > 0 || !p.alive || p.entity?.vehicle || p.entity?.craft || typeof host.enterExtraFloor !== 'function') return false;
    const choice = extraFloors().find(f => f.id === id); if (!choice) return false;
    const token = ++extraFloorToken, floor = state.floor;
    const request = {buildingId: b.id, floor, isCurrent: () => token === extraFloorToken && active() && state.uiOpen && currentBuilding === b && state.floor === floor && player().alive && !player().entity?.vehicle && !player().entity?.craft};
    state.extraFloorPending = true;
    if (ui) {for (const button of ui.list.children) button.disabled = true; ui.hint.textContent = '지하 통로를 연결하고 있습니다…';}
    const settle = result => {
      if (token !== extraFloorToken) return result === true;
      state.extraFloorPending = false;
      // A successful transfer may already have suspended this city. Close the
      // old modal using the request token, not the destination's active state.
      if (result === true) {closeElevator(); updateHud(true); return true;}
      if (request.isCurrent()) {openElevator(); say('지하 통로를 열지 못했습니다. 다시 시도해 주세요.');}
      return false;
    };
    try {
      const result = host.enterExtraFloor(choice.id, b, request);
      return result && typeof result.then === 'function' ? Promise.resolve(result).then(settle, () => settle(false)) : settle(result);
    } catch (_) {return settle(false);}
  }
  function openElevator() {
    ensureUi(); if (!ui || !currentBuilding || !active() || !player().alive || state.extraFloorPending) return false;
    const extensions = extraFloors();
    ui.title.textContent = currentBuilding.name; ui.list.replaceChildren(); ui.hint.textContent = archiveFloor(currentBuilding, state.floor) ? 'B1 해양기록관에서 잠수함 정박지로 연결됩니다.' : '이동할 층을 선택하세요';
    // Underground destinations stay visible at the top on small phone screens.
    for (const floor of extensions) {
      const buildingId = currentBuilding.id, button = document.createElement('button'), number = document.createElement('span');
      number.className = 'wpt-floor-number'; number.textContent = floor.number; button.appendChild(number); button.appendChild(document.createTextNode(floor.name));
      button.dataset.extraFloor = floor.id; button.onclick = () => selectExtraFloor(floor.id, buildingId); ui.list.appendChild(button);
    }
    for (const floor of root.CityInteriors.describeFloors(currentBuilding.type, currentBuilding.seed)) {
      const button = document.createElement('button'), number = document.createElement('span'); number.className = 'wpt-floor-number'; number.textContent = floor.floor + 'F'; button.appendChild(number); button.appendChild(document.createTextNode(floor.name));
      button.disabled = floor.floor === state.floor; button.onclick = () => rideTo(floor.floor); ui.list.appendChild(button);
    }
    state.uiOpen = true; ui.locationOpen = false; ui.modal.hidden = false; updateHud(true); host.releaseControls?.(); host.onElevatorOpen?.();
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); return true;
  }
  function closeElevator() {extraFloorToken++; state.extraFloorPending = false; state.uiOpen = false; if (ui) ui.modal.hidden = true;}
  function updateHud(force = false) {
    const enabled = active() && !host.isPaused?.();
    if (!force && enabled === lastUiEnabled && frame - lastHud < 6) return; lastHud = frame; lastUiEnabled = enabled;
    ensureUi(); if (!ui) return; const p = player(), nearby = enabled ? prompt() : null;
    const inCity = regionContains(p.x, p.z) || !!currentBuilding;
    const locationKey = currentBuilding ? currentBuilding.id + ':' + state.floor : inCity ? 'city' : '';
    if (locationKey !== ui.locationKey || !enabled || !p.alive || state.uiOpen) ui.locationOpen = false;
    ui.locationKey = locationKey;
    const locationVisible = inCity && p.alive && !state.uiOpen;
    const expanded = locationVisible && enabled && (ui.locationOpen || !!nativeState()?.hudExpanded);
    const setText = (element, text) => {if (element.textContent !== text) element.textContent = text;};
    ui.wrapper.hidden = !enabled; ui.location.hidden = !locationVisible; ui.details.hidden = !expanded;
    ui.location.setAttribute('aria-expanded', String(expanded));
    const summary = currentBuilding ? currentBuilding.name + ' · ' + state.floor + 'F' : 'WESTPORT';
    setText(ui.location, summary + (expanded ? ' ▴' : ' ▾'));
    ui.location.setAttribute('aria-label', summary + ' · 위치 상세 ' + (expanded ? '접기' : '보기'));
    let details = currentBuilding ? state.floor + 'F / ' + currentBuilding.floors + 'F · ' + (floorModel?.floorName || '') : '서쪽 도시 · 시민 ' + sim.stats.activeCivilians + '명';
    if (archiveFloor(currentBuilding, state.floor)) details += '\nB1 해양기록관 · 로비 오른쪽 엘리베이터';
    const status = sim.responseStatus?.() || 'searching';
    const responseText = {preparing: 'FBI 본부 · 출동 준비', enroute: '특공대 차량 · 신고 현장으로 이동 중', searching: sim.lastKnown ? '마지막 목격 지점 수색' : '신고 지점 수색', contact: '용의자 발견 · 추격 중'};
    const shortResponse = {preparing:'출동 준비', enroute:'지원 차량 접근', searching:'수색 중', contact:'추격 중'};
    ui.alert.hidden = !sim.defcon || !p.alive || state.uiOpen; ui.alert.dataset.state = status;
    setText(ui.alert, 'DEFCON 1 · ' + (shortResponse[status] || shortResponse.searching));
    if (sim.defcon) details += '\n' + (responseText[status] || responseText.searching) + ' · 특공대 ' + sim.swat.filter(p => !p.dead).length + '명';
    setText(ui.details, details);
    ui.wrapper.classList.toggle('wpt-info-open', expanded);
    // Native canvas already provides the same hand button / E key prompt.
    // Keep the DOM action as a fallback for standalone city previews.
    ui.use.hidden = !nearby || state.uiOpen || host.nativeHudActions === true; setText(ui.use, nearby ? 'E · ' + nearby.text : '');
  }
  const colors = ['#d9a25f', '#617b92', '#87966b', '#b46c60', '#9699a7', '#c7b89c', '#5b8e8c', '#a97d93', '#6e8096', '#bd9273', '#7e918b', '#b2a777'];
  const skins = ['#bf8c6b', '#dfb992', '#825d47', '#c79b7a', '#e5c5a7'];
  // OFFICE_STAFF_CITY_VISUALS_START
  // Articulated people share a compact joint rig; office work/defense stays independent of street walking.
  const officeCityShirts = ['#b3c8d8', '#e4e1d7', '#a9b6ad', '#7e91ab', '#c5bbb0', '#424f62'];
  const officeCityPants = ['#343d49', '#464a4f', '#3d4249', '#45423f'];
  const officeCityPartMatrices = new WeakMap();
  function civilianCityBaseModel() {
    const parts = [];
    const add = (shape, joint, x, y, z, sx, sy, sz, color, role, colorRole = null, rotation = {}) => parts.push({shape, joint, x, y, z, sx, sy, sz, color, role, colorRole, material: role.startsWith('pistol') ? 'metal' : 'cloth', ...rotation});
    const B = (...args) => add('box', ...args), S = (...args) => add('sphere', ...args), C = (...args) => add('cylinder', ...args);
    B('root', 0, .875, 0, .39, .18, .27, '#343d49', 'pelvis', 'pants');
    B('torso', 0, .265, 0, .43, .53, .27, '#b3c8d8', 'office-shirt', 'shirt');
    S('torso', 0, .49, 0, .30, .10, .25, '#b3c8d8', 'shirt-shoulder', 'shirt');
    for (const side of [-1, 1]) B('torso', side * .065, .458, .148, .075, .095, .025, '#e5e7e4', 'shirt-collar', null, {rz: side * .18});
    B('torso', 0, .25, .143, .018, .38, .012, '#89959e', 'shirt-buttons');
    B('torso', -.125, .255, .153, .07, .10, .018, '#243d4c', 'badge-holder');
    B('torso', -.125, .25, .165, .053, .07, .009, '#e9ece5', 'staff-badge');
    B('torso', -.125, .265, .172, .035, .018, .006, '#7fa6b6', 'badge-stripe');
    C('head', 0, -.055, 0, .11, .13, .11, '#d5b08b', 'neck', 'skin');
    S('head', 0, .075, .006, .31, .37, .30, '#d5b08b', 'head', 'skin');
    S('head', 0, .207, -.023, .32, .16, .29, '#413a34', 'hair', 'hair');
    S('head', 0, .076, .155, .065, .10, .06, '#d5b08b', 'nose', 'skin');
    for (const side of [-1, 1]) {
      S('head', side * .064, .127, .147, .052, .025, .022, '#efede8', 'eye-white');
      S('head', side * .064, .127, .159, .019, .021, .010, '#242527', 'iris');
      S('head', side * .154, .074, -.003, .045, .09, .06, '#d5b08b', 'ear', 'skin');
      const suffix = side < 0 ? 'left' : 'right';
      C('hip-' + suffix, 0, -.20, 0, .16, .40, .17, '#343d49', 'thigh-' + suffix, 'pants');
      S('knee-' + suffix, 0, -.005, 0, .15, .14, .16, '#343d49', 'knee-' + suffix, 'pants');
      C('knee-' + suffix, 0, -.19, 0, .13, .38, .14, '#343d49', 'shin-' + suffix, 'pants');
      B('knee-' + suffix, 0, -.407, .066, .17, .12, .31, '#272b30', 'shoe-' + suffix);
      C('shoulder-' + suffix, 0, -.14, 0, .13, .28, .15, '#b3c8d8', 'sleeve-' + suffix, 'shirt');
      C('elbow-' + suffix, 0, -.13, 0, .105, .26, .125, '#b3c8d8', 'forearm-' + suffix, 'shirt');
      C('elbow-' + suffix, 0, -.25, 0, .112, .03, .13, '#e8e9e3', 'cuff-' + suffix);
      S('elbow-' + suffix, 0, -.31, .005, .125, .15, .12, '#d5b08b', 'hand-' + suffix, 'skin');
    }
    B('pistol', 0, 0, .035, .055, .065, .21, '#263039', 'pistol-slide');
    B('pistol', 0, -.072, -.022, .05, .12, .06, '#303234', 'pistol-grip', null, {rx: -.17});
    C('pistol', 0, -.006, .164, .026, .095, .026, '#191e23', 'pistol-barrel', null, {rx: Math.PI / 2});
    return {parts, width: .80, depth: .86, height: 1.8};
  }
  // Tailored office silhouettes retain the existing joint rig and shared
  // instancing. Authored shapes change the visible person, never the hitbox or
  // identity. Street civilians keep their separately tuned fallback below.
  function officeCityModel() {
    const parts = [];
    const add = (shape, joint, x, y, z, sx, sy, sz, color, role, colorRole = null, extra = {}) => parts.push({shape, joint, x, y, z, sx, sy, sz, color, role, colorRole, material: role.startsWith('pistol') ? 'metal' : 'cloth', ...extra});
    const B = (...a) => add('box', ...a), S = (...a) => add('sphere', ...a), R = (...a) => add('person-soft', ...a), C = (...a) => add('cylinder', ...a);
    R('root', 0, .875, 0, .365, .18, .245, '#343d49', 'pelvis', 'pants');
    R('root', 0, .944, .006, .372, .038, .25, '#25292e', 'belt');
    B('root', 0, .945, .139, .047, .033, .014, '#9c9d94', 'belt-buckle');
    add('person-shirt', 'torso', 0, .256, -.003, .435, .525, .267, '#c8d5df', 'office-shirt', 'shirt');
    // A dark tailored jacket is one variant; its front opens onto a light shirt.
    R('torso', 0, .252, .143, .18, .432, .026, '#dfe5e4', 'jacket-shirt-front', null, {variantMode: 'jacket'});
    for (const side of [-1, 1]) {
      R('torso', side * .068, .454, .142, .093, .104, .028, '#e8ece8', 'shirt-collar', null, {rz: side * .37});
      R('torso', side * .111, .327, .155, .073, .22, .024, '#4b5665', 'jacket-lapel', 'shirt', {rz: -side * .27, variantMode: 'jacket'});
    }
    R('torso', 0, .252, .143, .016, .36, .014, '#e8ece8', 'shirt-placket');
    for (const y of [.382, .303, .225, .146]) S('torso', 0, y, .153, .012, .012, .007, '#49535a', 'shirt-buttons');
    R('torso', 0, .407, .167, .044, .044, .02, '#53667c', 'tie-knot', null, {variantMode: 'tie'});
    R('torso', 0, .273, .164, .046, .245, .022, '#53667c', 'tie-blade', null, {variantMode: 'tie'});
    B('torso', -.126, .293, .153, .083, .095, .013, '#243d4c', 'badge-holder');
    B('torso', -.126, .290, .162, .067, .075, .007, '#eef0e9', 'staff-badge');
    B('torso', -.143, .301, .167, .021, .025, .004, '#7991a0', 'badge-photo');
    B('torso', -.114, .282, .167, .035, .007, .004, '#607581', 'badge-stripe');
    C('head', 0, -.06, -.009, .105, .14, .105, '#d5b08b', 'neck', 'skin');
    add('person-head', 'head', 0, .074, .002, .268, .326, .267, '#d5b08b', 'head', 'skin');
    // Hair follows the skull and temples; a swept fringe or low bun changes
    // silhouette instead of merely recolouring the old hemispherical cap.
    add('person-hair', 'head', 0, .095, -.013, .281, .325, .275, '#413a34', 'hair', 'hair');
    S('head', -.035, .207, .062, .215, .09, .17, '#413a34', 'hair-sweep', 'hair', {rz: -.18, ry: -.15, variantMode: 'sweep'});
    S('head', 0, .091, -.168, .13, .14, .12, '#413a34', 'hair-bun', 'hair', {variantMode: 'bun'});
    R('head', 0, .073, .130, .039, .083, .043, '#d5b08b', 'nose', 'skin');
    R('head', 0, .014, .124, .061, .010, .009, '#956759', 'mouth');
    for (const side of [-1, 1]) {
      S('head', side * .057, .112, .126, .039, .017, .010, '#dddcd3', 'eye-white');
      S('head', side * .057, .112, .132, .015, .017, .007, '#263037', 'iris');
      R('head', side * .057, .138, .127, .051, .012, .010, '#413a34', 'eyebrow', 'hair', {rz: side * .07});
      S('head', side * .135, .066, -.006, .035, .072, .048, '#d5b08b', 'ear', 'skin');
      S('head', side * .122, .14, -.028, .025, .11, .098, '#413a34', 'hair-temple', 'hair');
      const suffix = side < 0 ? 'left' : 'right';
      R('hip-' + suffix, 0, -.19, -.002, .178, .415, .188, '#343d49', 'thigh-' + suffix, 'pants');
      S('knee-' + suffix, 0, -.005, 0, .153, .126, .16, '#343d49', 'knee-' + suffix, 'pants');
      R('knee-' + suffix, 0, -.184, -.007, .139, .38, .148, '#343d49', 'shin-' + suffix, 'pants');
      R('knee-' + suffix, 0, -.409, .056, .16, .113, .293, '#292e34', 'shoe-' + suffix);
      R('knee-' + suffix, 0, -.459, .06, .165, .025, .30, '#161c23', 'shoe-sole-' + suffix);
      S('shoulder-' + suffix, 0, -.024, -.005, .15, .14, .16, '#c8d5df', 'sleeve-cap-' + suffix, 'shirt');
      R('shoulder-' + suffix, 0, -.145, -.003, .143, .29, .158, '#c8d5df', 'sleeve-' + suffix, 'shirt');
      R('elbow-' + suffix, 0, -.118, -.003, .118, .264, .135, '#c8d5df', 'forearm-' + suffix, 'shirt');
      R('elbow-' + suffix, 0, -.25, 0, .121, .044, .136, '#e8ece8', 'cuff-' + suffix);
      R('elbow-' + suffix, 0, -.308, .006, .089, .114, .071, '#d5b08b', 'hand-' + suffix, 'skin');
      R('elbow-' + suffix, -side * .047, -.300, .024, .033, .065, .033, '#d5b08b', 'thumb-' + suffix, 'skin', {rz: side * .32});
      R('elbow-' + suffix, 0, -.365, .014, .079, .040, .054, '#d5b08b', 'fingers-' + suffix, 'skin');
    }
    B('pistol', 0, 0, .035, .055, .065, .21, '#263039', 'pistol-slide');
    B('pistol', 0, -.072, -.022, .05, .12, .06, '#303234', 'pistol-grip', null, {rx: -.17});
    C('pistol', 0, -.006, .164, .026, .095, .026, '#191e23', 'pistol-barrel', null, {rx: Math.PI / 2});
    return {parts, width: .80, depth: .86, height: 1.8};
  }
  function officeCityPartVisible(part, variant, defending) {
    if (part.role.startsWith('pistol')) return defending;
    if (part.variantMode === 'bun') return variant % 3 === 0;
    if (part.variantMode === 'sweep') return variant % 3 === 1;
    if (part.variantMode === 'jacket') return variant % 6 === 5;
    if (part.variantMode === 'tie') return variant % 3 === 2;
    return true;
  }
  function officeCityRig(detailed = false) {
    const rootNode = new T.Group(), joints = {root: rootNode};
    const joint = (name, parent, x, y, z) => {const node = new T.Group(); node.position.set(x, y, z); joints[parent].add(node); joints[name] = node; return node;};
    joint('torso', 'root', 0, .95, 0); joint('head', 'torso', 0, .56, 0);
    for (const side of [-1, 1]) {
      const name = side < 0 ? 'left' : 'right';
      joint('hip-' + name, 'root', side * .105, .88, 0);
      joint('knee-' + name, 'hip-' + name, 0, -.4, 0);
      joint('shoulder-' + name, 'torso', side * (detailed ? .225 : .26), detailed ? .425 : .44, 0);
      joint('elbow-' + name, 'shoulder-' + name, 0, -.28, 0);
    }
    joint('pistol', 'root', .16, 1.20, .59);
    return {root: rootNode, joints, down: new T.Vector3(0, -1, 0), d: new T.Vector3(), pole: new T.Vector3(), elbow: new T.Vector3(), target: new T.Vector3(), unit: new T.Vector3(), inverse: new T.Quaternion()};
  }
  function officeCityReach(rig, side, x, y, z) {
    const name = side < 0 ? 'left' : 'right', shoulder = rig.joints['shoulder-' + name], elbowJoint = rig.joints['elbow-' + name];
    const start = shoulder.position, a = .28, b = .32;
    rig.target.set(x, y, z); rig.d.subVectors(rig.target, start);
    const distance = clamp(rig.d.length(), Math.abs(a - b) + .025, a + b - .004); rig.d.normalize();
    rig.pole.set(side * .55, -1, -.12).addScaledVector(rig.d, -rig.pole.dot(rig.d));
    if (rig.pole.lengthSq() < 1e-6) rig.pole.set(side, 0, 0); rig.pole.normalize();
    const c = clamp((a * a + distance * distance - b * b) / (2 * a * distance), -1, 1), s = Math.sqrt(1 - c * c);
    rig.elbow.copy(start).addScaledVector(rig.d, a * c).addScaledVector(rig.pole, a * s);
    rig.unit.subVectors(rig.elbow, start).normalize(); shoulder.quaternion.setFromUnitVectors(rig.down, rig.unit);
    rig.target.copy(start).addScaledVector(rig.d, distance);
    rig.unit.subVectors(rig.target, rig.elbow).normalize().applyQuaternion(rig.inverse.copy(shoulder.quaternion).invert());
    elbowJoint.quaternion.setFromUnitVectors(rig.down, rig.unit);
  }
  function officeCityPose(rig, person, civilian = false) {
    const reaction = hitPose(person), reacting = !!(reaction?.active || reaction?.proneK > 0), down = !!reaction?.blocked;
    const seat = person.officeSeat || {}, working = !!(!person.dead && !down && person.officeStaff && person.officeSeat &&
      (person.officeWorking === true || (person.officeWorking !== false && ['working', 'work'].includes(person.officeState))));
    const defending = !person.dead && !down && !working && person.officeWeaponDrawn !== false && ['defending', 'defend'].includes(person.officeState);
    const heading = working && Number.isFinite(seat.heading) ? seat.heading : finite(person.heading);
    const height = clamp(finite(seat.seatHeight, .52), .25, .85), drop = working ? height + .085 - .88 : 0;
    const offset = working ? clamp(finite(seat.workOffset), -.08, .32) : 0;
    rig.root.position.set(person.x + Math.sin(heading) * offset, person.y + drop + (person.dead ? .24 : 0), person.z + Math.cos(heading) * offset);
    rig.root.rotation.set(0, heading, person.dead ? Math.PI / 2 : 0, 'XYZ');
    if (civilian && person.dead) rig.root.rotation.set(-Math.PI / 2, heading, 0, 'YXZ'); rig.root.scale.set(1, 1, 1);
    if (reacting && (!working || down || reaction.proneK > 0)) setHitRoot(rig.root, person, reaction);
    const phase = sim.time * 5.6 + finite(person.variant) * .63;
    const moving = !person.dead && !down && (civilian ? !(person.pause > 0) : person.officeMoving || ['return', 'returning', 'fleeing'].includes(person.officeState));
    const walk = moving ? Math.sin(finite(person.phase)) * .34 : 0;
    const hip = working ? Math.acos(clamp((height + .085 - .485) / .4, -.35, .90)) : 0;
    for (const side of [-1, 1]) {
      const name = side < 0 ? 'left' : 'right';
      rig.joints['hip-' + name].rotation.set(working ? -hip : walk * side, 0, side * .02);
      rig.joints['knee-' + name].rotation.set(working ? hip : Math.max(0, walk * side) * .85, 0, 0);
      rig.joints['shoulder-' + name].rotation.set(-walk * side * .7, 0, side * .06);
      rig.joints['elbow-' + name].rotation.set(-.12, 0, 0);
    }
    rig.joints.torso.rotation.set(working ? .035 + Math.sin(phase * .12) * .006 : 0, 0, 0);
    rig.joints.head.rotation.set(working ? .06 + Math.sin(phase * .14) * .016 : 0, working ? Math.sin(phase * .045) * .055 : 0, 0);
    const recoil = clamp(finite(person.officeRecoil, finite(person.recoil)), 0, 1);
    rig.joints.pistol.position.set(.16, 1.20, .59 - recoil * .035); rig.joints.pistol.rotation.set(-recoil * .035, 0, 0);
    if (working) {
      const handY = finite(seat.deskHeight, .82) + .025 - drop - .95, forward = clamp(finite(seat.handForward, .53), .28, .72);
      for (const side of [-1, 1]) {const tap = Math.sin(phase + (side < 0 ? 0 : Math.PI * .7)); officeCityReach(rig, side, side * .117, handY + Math.max(0, tap) * .008, forward + tap * .009 + (side > 0 ? .018 : 0));}
    } else if (defending) {
      officeCityReach(rig, 1, .16, .22, .56 - recoil * .035);
      officeCityReach(rig, -1, .10, .20, .53 - recoil * .035);
    }
    if (civilian && !person.dead && !down) {
      const panic = sim.time < finite(person.panicUntil);
      rig.root.position.y += moving ? (Math.cos(finite(person.phase) * 2) - 1) * .012 : 0;
      rig.joints.torso.rotation.x = panic ? .10 : moving ? .025 : Math.sin(phase * .16) * .005;
      rig.joints.head.rotation.y = moving ? Math.sin(phase * .09) * .04 : Math.sin(phase * .06) * .09;
    }
    if (reacting) {
      const prone = clamp(finite(reaction.proneK), 0, 1), bend = finite(reaction.kneeBend);
      for (const side of [-1, 1]) {
        const name = side < 0 ? 'left' : 'right';
        rig.joints['hip-' + name].rotation.x *= 1 - prone;
        rig.joints['knee-' + name].rotation.x = Math.max(rig.joints['knee-' + name].rotation.x * (1 - prone), bend);
        // +Z becomes down when the root falls face-first. Brace close to the
        // chest, so extended hands cannot pass below the floor at full prone.
        if (down || prone > 0) officeCityReach(rig, side, side * (.28 + prone * .04), -.10 + prone * .42, .04 + prone * .13);
      }
      rig.joints.torso.rotation.x = finite(reaction.recoilK) * .16;
      rig.joints.head.rotation.set(-prone * .10, 0, 0);
    }
    rig.root.updateMatrixWorld(true);
    return {working, defending, height: reacting ? reaction.hitHeight : working ? height + 1.04 : 1.84, hitReaction: reacting, proneK: reaction?.proneK || 0};
  }
  function makeOfficeCityPool(capacity = 272) {
    const pool = makePool(officeCityModel(), capacity, 'office');
    pool.officeRig = officeCityRig(true); pool.officeMatrices = []; pool.officePoses = []; pool.officeStates = []; pool.officeJoints = Object.entries(pool.officeRig.joints);
    for (const {mesh, parts} of pool.groups) {mesh.name = 'WESTPORT office staff ' + parts[0].shape; mesh.userData.officeStaff = true;}
    return pool;
  }
  // These checks affect visual proxies only. The full population remains in
  // sim.civilians for collisions, scoped rays, damage, reports and saved games.
  function actorVisible(person) {
    if (!actorCamera?.projectionMatrix) return true;
    const dx = person.x - actorEye.x, dy = person.y + .9 - actorEye.y, dz = person.z - actorEye.z;
    if (dx * dx + dy * dy + dz * dz < 144) return true;
    civilianSphere.center.set(person.x, person.y + .9, person.z); civilianSphere.radius = 2.4;
    return frustum.intersectsSphere(civilianSphere);
  }
  function uploadInstances(attribute, count) {
    if (!attribute || count <= 0) return;
    // r160 supports update ranges: upload live entries, not the pool's unused
    // capacity. A full live prefix also coalesces multiple updates before draw.
    attribute.clearUpdateRanges?.(); attribute.addUpdateRange?.(0, count); attribute.needsUpdate = true;
  }
  function updateOfficeCityPool(pool, people, civilian = false) {
    const visible = people.filter(e => (civilian ? !e.officeStaff : e.officeStaff) && e.active !== false && surfaceActorVisible(e) && actorVisible(e)).slice(0, pool.capacity);
    pool.entities = visible; pool.officePoses.length = visible.length;
    for (let i = 0; i < visible.length; i++) {
      const person = visible[i], old = pool.officeStates[i], fresh = !old || old.person !== person;
      const reaction = hitPose(person), reactionK = reaction?.proneK || 0, reactionPhase = reaction?.phase || '';
      const item = fresh ? {} : old, range = Math.hypot(person.x - actorEye.x, person.y - actorEye.y, person.z - actorEye.z) * actorFovScale;
      const interval = range > 160 ? .1 : range > 60 ? .05 : 0;
      const variant = Math.abs(Math.trunc(finite(person.variant))), skin = Math.abs(Math.trunc(finite(person.skin)));
      const poseChanged = fresh || item.interval !== interval || item.variant !== variant || item.heading !== person.heading || item.dead !== person.dead || item.seat !== person.officeSeat ||
        item.reactionK !== reactionK || item.reactionPhase !== reactionPhase || item.hitRecoil !== reaction?.recoilK ||
        item.working !== person.officeWorking || item.officeState !== person.officeState || item.drawn !== person.officeWeaponDrawn ||
        item.moving !== person.officeMoving || item.paused !== (person.pause > 0) || item.recoil !== person.officeRecoil || item.nativeRecoil !== person.recoil ||
        sim.time < item.time || !person.dead && (interval ? sim.time + 1e-9 >= item.nextPose : sim.time !== item.time || item.phase !== person.phase);
      item.dx = fresh ? 0 : person.x - item.x; item.dy = fresh ? 0 : person.y - item.y; item.dz = fresh ? 0 : person.z - item.z;
      item.dirty = poseChanged ? 2 : item.dx || item.dy || item.dz ? 1 : 0;
      item.colorDirty = fresh || item.variant !== variant || item.skin !== skin;
      let transforms = pool.officeMatrices[i]; if (!transforms) pool.officeMatrices[i] = transforms = {};
      if (poseChanged) {
        item.pose = officeCityPose(pool.officeRig, person, civilian); item.time = sim.time; item.phase = person.phase;
        // Stagger the sampled animation across actors instead of rebuilding the
        // entire far crowd on the same tenth-of-a-second frame.
        const offset = (i * .61803398875 + variant * .137) % 1;
        item.nextPose = interval ? (Math.floor(sim.time / interval - offset) + 1 + offset) * interval : sim.time;
        for (const [name, joint] of pool.officeJoints) {
          if (!transforms[name]) transforms[name] = new T.Matrix4(); transforms[name].copy(joint.matrixWorld);
        }
      } else if (item.dirty) {
        // Keep the body root moving at the simulation rate while distant joint
        // animation samples at 10/20 Hz. Near and scoped bodies use every frame.
        for (const [name] of pool.officeJoints) {const a = transforms[name].elements; a[12] += item.dx; a[13] += item.dy; a[14] += item.dz;}
      }
      pool.officePoses[i] = item.pose;
      Object.assign(item, {person, x: person.x, y: person.y, z: person.z, heading: person.heading, dead: person.dead, seat: person.officeSeat,
        working: person.officeWorking, officeState: person.officeState, drawn: person.officeWeaponDrawn, moving: person.officeMoving,
        paused: person.pause > 0, recoil: person.officeRecoil, nativeRecoil: person.recoil, variant, skin, interval,
        reactionK, reactionPhase, hitRecoil: reaction?.recoilK});
      pool.officeStates[i] = item;
    }
    for (const {mesh, parts} of pool.groups) {
      mesh.count = visible.length * parts.length; mesh.visible = mesh.count > 0; let matrixDirty = false, colorDirty = false;
      for (let i = 0; i < visible.length; i++) {
        const item = pool.officeStates[i], variant = item.variant, skin = item.skin;
        if (!item.dirty && !item.colorDirty) continue;
        for (let j = 0; j < parts.length; j++) {
          const p = parts[j], index = i * parts.length + j;
          if (item.dirty === 2) {
            if (!officeCityPartVisible(p, variant, item.pose.defending)) mesh.setMatrixAt(index, zero);
            else {
              let local = officeCityPartMatrices.get(p);
              if (!local) {
                partObject.position.set(p.x, p.y, p.z); partObject.rotation.set(finite(p.rx), finite(p.ry), finite(p.rz)); partObject.scale.set(p.sx, p.sy, p.sz); partObject.updateMatrix();
                local = partObject.matrix.clone(); officeCityPartMatrices.set(p, local);
              }
              matrix.multiplyMatrices(pool.officeMatrices[i][p.joint || 'root'], local); mesh.setMatrixAt(index, matrix);
            }
            matrixDirty = true;
          } else if (item.dirty === 1) {
            const a = mesh.instanceMatrix.array, offset = index * 16;
            a[offset + 12] += item.dx; a[offset + 13] += item.dy; a[offset + 14] += item.dz; matrixDirty = true;
          }
          if (item.colorDirty) {
            const tint = p.colorRole === 'shirt' ? (civilian ? colors[variant % colors.length] : officeCityShirts[variant % officeCityShirts.length]) : p.colorRole === 'pants' ? officeCityPants[variant % officeCityPants.length] :
              p.colorRole === 'skin' ? skins[skin % skins.length] : p.colorRole === 'hair' ? ['#413a34', '#252528', '#6a5140', '#726458'][variant % 4] : p.color;
            mesh.setColorAt(index, color.set(tint)); colorDirty = true;
          }
        }
      }
      if (matrixDirty) uploadInstances(mesh.instanceMatrix, mesh.count * 16);
      if (colorDirty) uploadInstances(mesh.instanceColor, mesh.count * 3);
    }
    pool.officeStates.length = visible.length;
  }
  function civilianCityModel() {
    const model = civilianCityBaseModel();
    model.parts = model.parts.filter(p => !p.role.startsWith('pistol') && !/badge|shirt-buttons/.test(p.role));
    for (const p of model.parts) {
      if (p.role === 'office-shirt') {p.role = 'civilian-shirt'; p.shape = 'person-soft';}
      if (p.role === 'pelvis') p.shape = 'person-soft';
      if (p.role.startsWith('forearm') || p.role.startsWith('cuff')) {p.colorRole = 'skin'; p.material = 'skin';}
      if (p.role.startsWith('sleeve')) {p.y = -.08; p.sy = .19;}
      if (p.role === 'hair') {p.x = -.012; p.z = -.025; p.ry = .18;}
      if (p.role.startsWith('shoe')) p.shape = 'person-soft';
      if (p.colorRole === 'skin') p.material = 'skin';
    }
    const extra = (shape, joint, x, y, z, sx, sy, sz, color, role, more = {}) => model.parts.push({shape, joint, x, y, z, sx, sy, sz, color, role, material: 'cloth', ...more});
    for (const side of [-1, 1]) {
      extra('cylinder', 'shoulder-' + (side < 0 ? 'left' : 'right'), 0, -.225, 0, .11, .15, .12, '#d5b08b', 'upper-arm-skin', {colorRole: 'skin', material: 'skin'});
      extra('box', 'head', side * .065, .151, .145, .058, .012, .018, '#413a34', 'eyebrow', {colorRole: 'hair', rz: side * .06});
      extra('box', 'knee-' + (side < 0 ? 'left' : 'right'), 0, -.46, .068, .172, .024, .31, '#dedbd4', 'sneaker-sole');
      extra('box', 'torso', side * .13, .275, .143, .075, .10, .018, '#ffffff', 'shirt-pocket', {colorRole: 'shirt'});
    }
    extra('box', 'head', 0, .019, .147, .062, .009, .012, '#8d6152', 'mouth');
    extra('sphere', 'head', 0, .137, -.179, .13, .13, .12, '#413a34', 'hair-bun', {colorRole: 'hair', variantMode: 'bun'});
    return model;
  }
  function makeCivilianCityPool(capacity = 272) {
    const pool = makePool(civilianCityModel(), capacity, 'civilian');
    pool.officeRig = officeCityRig(); pool.officeMatrices = []; pool.officePoses = []; pool.officeStates = []; pool.officeJoints = Object.entries(pool.officeRig.joints);
    for (const {mesh, parts} of pool.groups) {mesh.name = 'WESTPORT articulated civilian ' + parts[0].shape; mesh.userData.cityCivilian = true;}
    return pool;
  }
  // OFFICE_STAFF_CITY_VISUALS_END
  function makePool(model, capacity, kind) {
    const buckets = new Map(), pool = {kind, capacity, groups: [], entities: []};
    for (const p of model.parts) {const key = p.shape + '|' + p.material; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(p);}
    for (const parts of buckets.values()) {
      const mesh = new T.InstancedMesh(primitive(parts[0].shape), material(parts[0].material), capacity * parts.length); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.count = 0;
      actorsRoot.add(mesh); pool.groups.push({mesh, parts});
    }
    return pool;
  }
  function responseVanModel() {
    const parts = [];
    const add = (shape, x, y, z, sx, sy, sz, color, role, extra = {}) => parts.push({shape, x, y, z, sx, sy, sz, color, role, material: 'metal', ...extra});
    const B = (...a) => add('box', ...a), C = (...a) => add('cylinder', ...a);
    B(0, .58, 0, 2.55, .38, 5.85, '#111b24', 'chassis');
    B(0, 1.42, -.42, 2.64, 1.75, 4.95, '#243744', 'armored-body');
    B(0, 2.38, -.48, 2.48, .26, 4.7, '#304754', 'roof');
    B(0, 1.12, 2.36, 2.55, .64, 1.4, '#243744', 'engine-bay');
    B(0, 1.99, 1.84, 2.28, .73, .095, '#54798b', 'windshield', {material: 'glass', rx: -.20});
    B(0, 1.97, 1.90, .075, .77, .075, '#16252f', 'windshield-divider', {rx: -.20});
    B(0, 1.23, 3.11, 2.43, .47, .16, '#14202a', 'grille');
    for (let i = -4; i <= 4; i++) B(i * .18, 1.23, 3.205, .055, .30, .02, '#7c8d96', 'grille-slat');
    B(0, .76, 3.18, 2.8, .22, .24, '#0e1820', 'bull-bar');
    for (const side of [-1, 1]) {
      B(side * 1.02, 1.44, 3.14, .34, .24, .07, '#e2e6d3', 'headlight', {material: 'lit'});
      B(side * 1.04, 1.17, -2.94, .26, .47, .085, '#b34e43', 'rear-light');
      B(side * 1.337, 2.01, .94, .035, .58, .96, '#3f6172', 'side-window', {material: 'glass'});
      B(side * 1.35, 1.29, .90, .04, .81, 1.18, '#1c2d38', 'cab-door');
      B(side * 1.37, 1.49, .52, .055, .055, .23, '#a2b0b5', 'door-handle');
      B(side * 1.38, .59, .56, .24, .13, 1.69, '#78858a', 'side-step');
      B(side * 1.48, 2.04, 1.64, .20, .25, .33, '#14232d', 'mirror');
      B(side * 1.34, 1.73, -1.05, .045, .51, 1.7, '#15242e', 'armor-panel');
      B(side * 1.37, 1.76, -1.04, .05, .12, .90, '#d4dfe3', 'agency-stripe');
      for (const z of [-2.04, 1.98]) {
        C(side * 1.32, .56, z, 1.02, .31, 1.02, '#11161b', 'van-wheel', {rz: Math.PI / 2});
        C(side * 1.50, .56, z, .55, .035, .55, '#647985', 'van-wheel-hub', {rz: Math.PI / 2});
        C(side * 1.53, .56, z, .18, .045, .18, '#b0bdc2', 'van-wheel-hub', {rz: Math.PI / 2});
        B(side * 1.31, 1.14, z, .16, .16, 1.35, '#0d1820', 'wheel-arch');
      }
      B(side * .66, 1.73, -2.95, 1.22, 1.38, .07, '#1c2c37', 'rear-door');
      B(side * .16, 1.51, -3.01, .075, .23, .08, '#9aa9b0', 'rear-handle');
      B(side * .84, 2.61, 1.00, .67, .16, .29, side < 0 ? '#ed4b54' : '#4ca7ee', side < 0 ? 'siren-red' : 'siren-blue', {material: 'lit'});
    }
    B(0, 2.55, 1.0, 2.11, .08, .40, '#15222b', 'lightbar-base');
    C(-.9, 2.93, -1.95, .024, .86, .024, '#768d98', 'radio-antenna');
    B(0, 2.57, -.65, 1.63, .11, 2.39, '#14232b', 'roof-rack');
    return {parts};
  }
  function initActors() {
    if (pools) return;
    const models = root.CitySimulation.createModels();
    pools = {civilian: makeCivilianCityPool(272), office: makeOfficeCityPool(272), swat: makePool(models.swat, 16, 'swat'), responseVehicle: makePool(responseVanModel(), 2, 'response-vehicle'), bomber: root.HanQHQ50Vehicles?.createPool(T,'bomber',2,actorsRoot,{forward:'+Z'}) || makePool(models.bomber, 2, 'bomber'), bomb: makePool(models.bomb, 12, 'bomb')};
    pools.swat.nativeVisuals = swatVisuals;
    for (let i = 0; i < 12; i++) {
      const mesh = new T.Mesh(new T.RingGeometry(.92, 1, 48), new T.MeshBasicMaterial({color: '#e3754f', side: T.DoubleSide, transparent: true, opacity: .7, depthWrite: false}));
      mesh.rotation.x = -Math.PI / 2; mesh.visible = false; mesh.userData.westportPrivate = true; actorsRoot.add(mesh); warnings.push(mesh);
    }
  }
  // Vehicle hulls, aircraft wings and ground warnings need their own bounds.
  // Rendering interest never changes a response route, target, hitbox or save.
  function responseVisible(entity, radius, height = 0) {
    if (!actorCamera?.projectionMatrix) return true;
    civilianSphere.center.set(entity.x, entity.y + height, entity.z); civilianSphere.radius = radius;
    return frustum.intersectsSphere(civilianSphere);
  }
  function updatePool(pool, entities) {
    const person = pool.kind === 'swat' || pool.kind === 'civilian', van = pool.kind === 'response-vehicle';
    const radius = van ? 4 : pool.kind === 'bomber' ? 22 : 2;
    const visible = entities.filter(e => e.active !== false && surfaceActorVisible(e) &&
      (person || responseVisible(e, radius, van ? 1.5 : 0))).slice(0, pool.capacity);
    pool.entities = visible;
    const states = pool.renderStates || (pool.renderStates = []);
    for (let i = 0; i < visible.length; i++) {
      const e = visible[i], old = states[i], fresh = !old || old.entity !== e, item = old || {matrix: new T.Matrix4()};
      const reaction = person ? hitPose(e) : null, reacting = !!(reaction?.active || reaction?.proneK > 0);
      const walk = !e.dead && !reaction?.blocked && person ? Math.sin(e.phase || 0) * .035 : 0;
      const tilt = reacting ? finite(reaction.tilt) : 0, rootY = reacting ? finite(reaction.rootOffsetY, -finite(reaction.rootDrop)) : 0;
      const forward = reacting ? finite(reaction.forwardOffset) : 0, prone = reacting && reaction.proneK > 0;
      const wheel = van && !e.dead ? sim.time * finite(e.speed) / .51 : 0, siren = van && !e.dead ? Math.floor(sim.time * 7) % 2 : -1;
      item.matrixDirty = fresh || item.x !== e.x || item.y !== e.y || item.z !== e.z || item.heading !== e.heading || item.dead !== e.dead ||
        item.walk !== walk || item.reacting !== reacting || item.tilt !== tilt || item.rootY !== rootY || item.forward !== forward || item.prone !== prone || item.wheel !== wheel || item.siren !== siren;
      item.colorDirty = fresh || item.dead !== e.dead || item.variant !== e.variant || item.skin !== e.skin;
      Object.assign(item, {entity:e, x:e.x, y:e.y, z:e.z, heading:e.heading, dead:e.dead, variant:e.variant, skin:e.skin,
        walk, reacting, tilt, rootY, forward, prone, wheel, siren});
      if (item.matrixDirty) {
        const fallen = e.dead && !van;
        pose.position.set(e.x, e.y + (fallen ? .24 : 0), e.z); pose.rotation.set(0, e.heading || 0, fallen ? Math.PI / 2 : 0, 'XYZ'); pose.scale.set(1, 1, 1);
        if (reacting) setHitRoot(pose, e, reaction); pose.updateMatrix(); item.matrix.copy(pose.matrix);
      }
      states[i] = item;
    }
    states.length = visible.length;
    for (const {mesh, parts} of pool.groups) {
      mesh.count = visible.length * parts.length; mesh.visible = mesh.count > 0;
      let matrixDirty = false, colorDirty = false;
      for (let i = 0; i < visible.length; i++) {
        const e = visible[i], item = states[i];
        if (!item.matrixDirty && !item.colorDirty) continue;
        for (let j = 0; j < parts.length; j++) {
          const p = parts[j], index = i * parts.length + j;
          if (item.matrixDirty) {
            const leg = p.role?.startsWith('leg') || p.role?.startsWith('foot'), arm = p.role?.startsWith('arm') || p.role?.startsWith('hand'), sign = (p.role || '').includes('left') ? 1 : -1;
            partObject.position.set(p.x, p.y + (leg ? Math.max(0, item.walk * sign) : 0), p.z + (leg || arm ? item.walk * sign : 0));
            partObject.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0); partObject.scale.set(p.sx, p.sy, p.sz);
            if (person && item.prone && p.role === 'weapon') {
              // Keep the fallen officer's rifle parallel to the ground.
              const c = Math.cos(item.tilt), s = Math.sin(item.tilt), dy = p.y - .98, dz = p.z - .20;
              partObject.position.y = .98 + dy * c + dz * s; partObject.position.z = .20 - dy * s + dz * c;
              partObject.rotation.x = finite(p.rx) - item.tilt;
            }
            if (van) {
              if (p.role?.startsWith('van-wheel') && !e.dead) partObject.rotation.x = item.wheel;
              if ((p.role === 'siren-red' || p.role === 'siren-blue') && item.siren !== (p.role === 'siren-red' ? 0 : 1)) partObject.scale.multiplyScalar(.12);
            }
            partObject.updateMatrix(); matrix.multiplyMatrices(item.matrix, partObject.matrix); mesh.setMatrixAt(index, matrix); matrixDirty = true;
          }
          if (item.colorDirty) {
            let c = van && e.dead ? '#34383b' : p.color;
            if (pool.kind === 'civilian' && ['torso', 'arm-left', 'arm-right'].includes(p.role)) c = colors[(e.variant || 0) % colors.length];
            if (pool.kind === 'civilian' && ['head', 'hand-left', 'hand-right'].includes(p.role)) c = skins[(e.skin || 0) % skins.length];
            mesh.setColorAt(index, color.set(c)); colorDirty = true;
          }
        }
      }
      if (matrixDirty) uploadInstances(mesh.instanceMatrix, mesh.count * 16);
      if (colorDirty) uploadInstances(mesh.instanceColor, mesh.count * 3);
    }
  }
  function clearCivilianVisuals() {
    for (const visual of civilianVisuals.values()) {visual.group.removeFromParent(); visual.dispose?.();}
    for (const {visual} of civilianVisualCache.values()) {visual.group.removeFromParent(); visual.dispose?.();}
    civilianVisualCache.clear();
    civilianVisuals.clear(); civilianVisualTime = sim.time;
  }
  function clearSwatVisuals() {
    for (const visual of swatVisuals.values()) {visual.group.removeFromParent(); visual.dispose?.();}
    for (const {visual} of swatVisualCache.values()) {visual.group.removeFromParent(); visual.dispose?.();}
    swatVisualCache.clear();
    swatVisuals.clear(); swatVisualTime = sim.time;
  }
  function syncSwatVisuals() {
    const camera = host.getThree?.()?.camera || host.camera, eye = camera?.position || player();
    const budget = host.swatVisualBudget?.() || {capacity:8, range:110, creations:2};
    const cap = clamp(Math.trunc(finite(budget.capacity, 8)), 0, 16), range = Math.max(1, finite(budget.range, 110));
    const creationLimit = clamp(Math.trunc(finite(budget.creations, 2)), 1, 2);
    const people = sim.swat.filter(p => p.active !== false && !p.embarked && surfaceActorVisible(p) && actorVisible(p));
    const candidates = [];
    if (cap && host.createSwatVisual) for (const p of people) {
      const d = Math.hypot(p.x - eye.x, p.y + .9 - eye.y, p.z - eye.z) * actorFovScale, existing = swatVisuals.has(p.id) || swatVisualCache.has(p.id);
      if (d < range + (existing ? 12 : 0)) candidates.push({p, score:d - (existing ? 6 : 0)});
    }
    candidates.sort((a, b) => a.score - b.score);
    const nearby = candidates.slice(0, cap), ids = new Set(nearby.map(({p}) => p.id));
    const dt = clamp(sim.time - swatVisualTime, 0, .1); swatVisualTime = sim.time;
    // Turning the camera must not destroy and reconstruct eight textured rigs.
    // Detached cached rigs do no scene traversal or draw work.
    for (const [id, visual] of swatVisuals) if (!ids.has(id)) {
      visual.group.removeFromParent(); swatVisualCache.set(id, {visual, cachedAt:renderCacheClock}); swatVisuals.delete(id);
    }
    let created = 0;
    for (const {p} of nearby) {
      let visual = swatVisuals.get(p.id);
      if (!visual && swatVisualCache.has(p.id)) {visual = swatVisualCache.get(p.id).visual; swatVisualCache.delete(p.id); swatReuses++;}
      if (!visual && created < creationLimit) {visual = host.createSwatVisual(p); if (visual?.group) {created++; swatCreations++;}}
      if (visual?.group && !swatVisuals.has(p.id)) {swatVisuals.set(p.id, visual); actorsRoot.add(visual.group);}
      visual?.update?.(p, dt, sim.time);
    }
    const roster = new Set(sim.swat.map(p => p.id));
    for (const [id, item] of swatVisualCache) if (!roster.has(id) || renderCacheClock - item.cachedAt >= renderCacheGrace || swatVisualCache.size > 16) {
      item.visual.dispose?.(); swatVisualCache.delete(id);
    }
    // Officers awaiting their detailed rig remain visible and targetable.
    updatePool(pools.swat, people.filter(p => !swatVisuals.has(p.id)));
  }
  function syncCivilianVisuals() {
    const camera = host.getThree?.()?.camera || host.camera, eye = camera?.position || player();
    const budget = host.civilianVisualBudget?.() || {capacity: 0, range: 42};
    const cap = Math.min(24, Math.max(0, Math.trunc(finite(budget.capacity))));
    const creationLimit = clamp(Math.trunc(finite(budget.creations, cap > 10 ? 2 : 1)), 1, 2);
    const fov = Math.max(.025, finite(camera?.fov, 72) / 72), range = finite(budget.range, 42);
    const people = sim.civilians.filter(e => !e.officeStaff && e.active !== false && surfaceActorVisible(e) && actorVisible(e));
    const candidates = [];
    if (cap && host.createCivilianVisual) for (const p of people) {
      const d = Math.hypot(p.x - eye.x, p.y + .9 - eye.y, p.z - eye.z) * fov, existing = civilianVisuals.has(p.id) || civilianVisualCache.has(p.id);
      if (d > range + (existing ? 5 : 0)) continue;
      civilianSphere.center.set(p.x, p.y + .9, p.z); civilianSphere.radius = 1.4;
      if (camera?.projectionMatrix && !frustum.intersectsSphere(civilianSphere)) continue;
      candidates.push({p, score: d - (existing ? 4 : 0)});
    }
    candidates.sort((a, b) => a.score - b.score);
    const nearby = candidates.slice(0, cap), selected = new Set(nearby.map(c => c.p.id));
    // A camera turn should detach native rigs, not destroy/rebuild an entire
    // crowd in one frame. The articulated instance pool covers new arrivals
    // until their original-quality native visuals have been constructed.
    for (const [id, visual] of civilianVisuals) if (!selected.has(id)) {
      visual.group.removeFromParent(); civilianVisualCache.set(id, {visual, cachedAt:renderCacheClock}); civilianVisuals.delete(id);
    }
    const dt = clamp(sim.time - civilianVisualTime, 0, .1); civilianVisualTime = sim.time;
    let created = 0;
    for (const {p} of nearby) {
      let visual = civilianVisuals.get(p.id);
      if (!visual && civilianVisualCache.has(p.id)) {visual = civilianVisualCache.get(p.id).visual; civilianVisualCache.delete(p.id); civilianReuses++;}
      if (!visual && created < creationLimit) {
        const variant = Math.abs(Math.trunc(finite(p.variant))), skin = Math.abs(Math.trunc(finite(p.skin)));
        visual = host.createCivilianVisual(p, {shirt: colors[variant % colors.length], pants: officeCityPants[variant % officeCityPants.length],
          skin: skins[skin % skins.length], hair: ['#413a34', '#252528', '#6a5140', '#726458'][variant % 4], hairStyle: variant % 3 === 0 ? 'bun' : 'short', boots: '#272b30'});
        if (visual?.group) {created++; civilianCreations++;}}
      if (visual?.group && !civilianVisuals.has(p.id)) {civilianVisuals.set(p.id, visual); actorsRoot.add(visual.group);}
      if (visual?.group) visual.update?.(p, dt, sim.time);
    }
    for (const [id, item] of civilianVisualCache) if (!cap || !sim.getCivilian(id) || renderCacheClock - item.cachedAt >= renderCacheGrace || civilianVisualCache.size > cap) {
      item.visual.dispose?.(); civilianVisualCache.delete(id);
    }
    pools.civilian.nativeVisuals = civilianVisuals;
    updateOfficeCityPool(pools.civilian, people.filter(p => !civilianVisuals.has(p.id)), true);
  }
  function syncActors() {
    initActors(); syncCivilianVisuals(); updateOfficeCityPool(pools.office, sim.civilians); syncSwatVisuals(); updatePool(pools.responseVehicle, sim.responseVehicles || []); updatePool(pools.bomber, sim.bombers); updatePool(pools.bomb, sim.bombs.filter(b => b.active));
    const bombs = sim.bombs.filter(b => b.active);
    for (let i = 0; i < warnings.length; i++) {const mesh = warnings[i], bomb = bombs[i];
      mesh.visible = !!bomb && responseVisible({x:bomb.x, y:bomb.targetY + .14, z:bomb.z}, bomb.warningRadius || 31);
      if (mesh.visible) {mesh.position.set(bomb.x, bomb.targetY + .14, bomb.z); mesh.scale.setScalar(bomb.warningRadius || 31); mesh.material.opacity = .35 + Math.sin(sim.time * 18) * .25;}}
  }
  function buildBoatModel(craft) {
    if (!craft?.westportBoat || !root.CityMaritime) return null;
    if(root.HanQHQ50Vehicles){const visual=root.HanQHQ50Vehicles.create(T,craft.westportType||'ferry',{forward:'+X'});visual.group.name=craft.westportName||'WESTPORT vessel';visual.westportBoat=craft.westportBoat;return visual;}
    const group = new T.Group(), model = root.CityMaritime.buildBoat(craft.westportType || 'ferry'); group.rotation.order = 'YZX'; group.name = craft.westportName || 'WESTPORT vessel';
    buildParts(model.parts, group, false, false); const turret = new T.Group(), barrel = new T.Group(); turret.add(barrel); group.add(turret);
    // The authored ferry/speedboat/workboat is already the final visual. The
    // host's generic premium ship substitution must not replace its silhouette.
    return {group, turret, barrel, westportBoat: craft.westportBoat, premTried: true};
  }
  function buildResponseVehicleModel() {
    // Reuse the dispatched van's exact parts in the native +X convention.
    // Four instanced batches retain its silhouette without one draw per part.
    const group=new T.Group(),body=new T.Group(),buckets=new Map(),groups=[];
    const ownedGeometry=new Map(),ownedMaterial=new Map(),partPose=new T.Object3D(),tint=new T.Color();
    group.name='WESTPORT FBI response van';group.userData.westportResponseVan=true;
    body.rotation.y=Math.PI/2;group.add(body);
    for(const p of responseVanModel().parts){const key=p.shape+'|'+p.material;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);}
    for(const parts of buckets.values()){
      const p=parts[0];
      if(!ownedGeometry.has(p.shape))ownedGeometry.set(p.shape,primitive(p.shape).clone());
      if(!ownedMaterial.has(p.material))ownedMaterial.set(p.material,material(p.material).clone());
      const mesh=new T.InstancedMesh(ownedGeometry.get(p.shape),ownedMaterial.get(p.material),parts.length);
      mesh.name='WESTPORT captured van '+p.shape+' '+p.material;mesh.frustumCulled=false;mesh.receiveShadow=true;
      body.add(mesh);groups.push({mesh,parts});
    }
    let lastTravel,lastSteer,lastDead,lastSiren,disposed=false;
    function update(travel=0,steer=0,dead=false){
      const siren=dead?-1:Math.floor(sim.time*7)%2;
      if(travel===lastTravel&&steer===lastSteer&&dead===lastDead&&siren===lastSiren)return;
      const colorsChanged=lastDead!==dead;
      for(const {mesh,parts}of groups){
        for(let i=0;i<parts.length;i++){
          const p=parts[i];partPose.position.set(p.x,p.y,p.z);partPose.rotation.set(p.rx||0,p.ry||0,p.rz||0);partPose.scale.set(p.sx,p.sy,p.sz);
          if(p.role?.startsWith('van-wheel')&&!dead){partPose.rotation.x=travel/.51;if(p.z>0)partPose.rotation.y=-steer*.45;}
          if((p.role==='siren-red'||p.role==='siren-blue')&&siren!==(p.role==='siren-red'?0:1))partPose.scale.multiplyScalar(.12);
          partPose.updateMatrix();mesh.setMatrixAt(i,partPose.matrix);
          if(colorsChanged)mesh.setColorAt(i,tint.set(dead?'#34383b':p.color));
        }
        uploadInstances(mesh.instanceMatrix,mesh.count*16);if(colorsChanged)uploadInstances(mesh.instanceColor,mesh.count*3);
      }
      lastTravel=travel;lastSteer=steer;lastDead=dead;lastSiren=siren;
    }
    update();
    return {group,wheels:[],update,dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const {mesh}of groups)mesh.dispose?.();for(const g of ownedGeometry.values())g.dispose();for(const m of ownedMaterial.values())m.dispose();}};
  }
  function isResponseEvent(event) {
    return ['defcon', 'response-shot', 'swat-breach', 'swat-defeated', 'bomber-spawn', 'bomb-warning', 'bomb-drop', 'explosion', 'dispatch-departed', 'dispatch-arrived', 'suspect-spotted', 'contact-lost', 'incident-reported', 'response-vehicle-disabled'].includes(event.type) ||
      event.type === 'player-hit' && (event.source === 'swat' || event.source === 'bomber');
  }
  // A new life ends the active pursuit, not the persistent city. Keep civilian
  // casualties, glass, interiors, elapsed time and cumulative statistics intact.
  // The native respawn hook also covers death/respawn between city update ticks.
  function onPlayerRespawn() {
    if (state.disposed || !syncPlayer().alive) return false;
    resetHitReactions();
    lastNativeAlive = true;
    const hadResponse = !!sim.defcon || sim.swat.length > 0 || sim.bombers.length > 0 || sim.bombs.length > 0 || !!sim.responseVehicles?.length;
    responseGeneration++;
    sim.defcon = 0; sim.responseStartedAt = null;
    sim.swat.length = 0; sim.bombers.length = 0; sim.bombs.length = 0;
    sim.clearResponse?.(); clearSwatVisuals();
    for (let i = sim.events.length - 1; i >= 0; i--) if (isResponseEvent(sim.events[i])) sim.events.splice(i, 1);
    for (const warning of warnings) warning.visible = false;
    if (pools) for (const kind of ['swat', 'responseVehicle', 'bomber', 'bomb']) {
      pools[kind].entities = []; if (pools[kind].renderStates) pools[kind].renderStates.length = 0;
      for (const {mesh} of pools[kind].groups) mesh.count = 0;
    }
    for (const effect of effects) removeEffect(effect); effects.length = 0;
    closeElevator(); state.ride = 0; updateHud(true);
    return hadResponse;
  }
  function processEvents() {
    const generation = responseGeneration;
    for (const event of sim.drainEvents()) {
      if (generation !== responseGeneration && isResponseEvent(event)) continue;
      if (event.type === 'response-shot' || event.type === 'office-shot') {
        const direction = new T.Vector3(event.to.x - event.from.x, event.to.y - event.from.y, event.to.z - event.from.z), distance = direction.length();
        if (distance > 0) breakAlongRay(event.from, direction.normalize(), distance); addTracer(event.from, event.to);
      } else if (event.type === 'player-hit') {
        const before = player(); if (!before.alive) continue;
        host.damagePlayer?.(event.amount, event.source, event); const after = syncPlayer();
        sim.stats.damageTaken += Math.max(0, before.hp - after.hp);
        if (!after.alive) {lastNativeAlive = false; closeElevator(); state.ride = 0;}
      } else if (event.type === 'civilian-injured') officeCityThreat(sim.getCivilian(event.civilianId), 'damage', event.source);
      else if (event.type === 'defcon') say('DEFCON 1 · 민간인 사망 신고 · FBI 본부 출동 준비');
      else if (event.type === 'dispatch-departed') say('FBI 특공대 차량 · 신고 현장으로 출발');
      else if (event.type === 'dispatch-arrived') say('특공대 도착 · 신고 지점 수색 시작');
      else if (event.type === 'suspect-spotted') say('특공대에 발각되었습니다');
      else if (event.type === 'contact-lost') say('시야에서 벗어남 · 특공대가 마지막 목격 지점을 수색합니다');
      else if (event.type === 'bomb-warning') say('폭격 경보 · 2초 안에 표시된 원 밖으로 이동하세요');
      else if (event.type === 'explosion') addEffect('blast', {x: event.x, y: event.y + 2, z: event.z}, 3);
      else if (event.type === 'swat-breach' && event.swatId === 'swat-1') say('경찰특공대가 현재 층에 진입했습니다');
      host.onEvent?.(event);
    }
  }
  function distantQuietCity(p) {
    const b=W.bounds,camera=host.getThree?.()?.camera||host.camera;
    if(!b||currentBuilding||state.uiOpen||state.ride>0||sim.defcon||sim.swat.length||sim.bombs.length||sim.events.length||effects.length||fallingPeople.size||camera?.fov<35)return false;
    const dx=Math.max(b.xMin-p.x,0,p.x-b.xMax),dz=Math.max(b.zMin-p.z,0,p.z-b.zMax);
    if(dx*dx+dz*dz<=640*640)return false;
    // An observation or bullet camera can visit the city while its player
    // remains on another continent. Visible local crowds keep full cadence.
    const view=camera?.position;
    if(view&&Number.isFinite(view.x)&&Number.isFinite(view.z)){
      const cx=Math.max(b.xMin-view.x,0,view.x-b.xMax),cz=Math.max(b.zMin-view.z,0,view.z-b.zMax);
      if(cx*cx+cz*cz<=640*640)return false;
    }
    return true;
  }
  const simulationContext={player:sim.player,isWalkable:(x,z)=>outsideLegal(x,z,.32),isInteriorWalkable:npcInteriorWalkable,
    isVehicleWalkable:(x,z,radius=1.45,vehicle)=>outsideLegal(x,z,radius)&&(!host.isResponseRouteClear||host.isResponseRouteClear(x,z,radius,vehicle)),
    lineOfSight,observationInterval:.1,floorY:outsideGround,isHitBlocked:hitBlocked,paused:false,civilianDelta:0};
  function update(dt) {
    if (state.disposed) return; frame++;
    if (!active()) {distantCivilianDebt=0;resetHitReactions(); container.visible = false; closeElevator(); updateHud(true); return;}
    syncBreachTransition();let p = syncPlayer(); container.visible = true;
    if (p.alive && !host.isPaused?.()) renderCacheClock += clamp(finite(dt), 0, .25);
    if (currentBuilding && floorModel && p.entity) {
      const ceiling = ceilingAt(p.x, p.z,p.y+(p.entity.crouch?1.15:1.8)-.02), bodyHeight = p.entity.crouch ? 1.15 : 1.8;
      const maxJump = Math.max(0, ceiling - state.baseY - bodyHeight);
      if (Number.isFinite(ceiling) && finite(p.entity.jz) > maxJump) {p.entity.jz = maxJump; p.entity.vz = Math.min(0, finite(p.entity.vz)); p = syncPlayer();}
    }
    if (!lastNativeAlive && p.alive) onPlayerRespawn();
    if (lastNativeAlive && !p.alive) {closeElevator(); state.ride = 0;}
    lastNativeAlive = p.alive;
    if (state.ride > 0 && p.alive) {state.ride -= dt; if (state.ride <= 0) changeFloor(state.rideTarget);}
    const previousSimTime = sim.time, paused=!p.alive||!!host.isPaused?.(),step=Math.max(0,Math.min(finite(dt),.25)),remote=!paused&&distantQuietCity(p);
    let civilianDelta=step;
    if(paused)distantCivilianDebt=0;
    else if(remote){distantCivilianDebt+=step;civilianDelta=distantCivilianDebt>=.25-1e-9?distantCivilianDebt:0;if(civilianDelta)distantCivilianDebt=0;}
    else if(distantCivilianDebt){civilianDelta+=distantCivilianDebt;distantCivilianDebt=0;}
    if(!paused&&!remote)updateSurfacePeople(dt);
    simulationContext.paused=paused;simulationContext.civilianDelta=civilianDelta;
    sim.step(step,simulationContext);
    if (sim.time > previousSimTime) swatUpdateSuppression();
    if(!remote)officeCityUpdate(dt); processEvents(); sim.stats.elapsed = clockOffset + sim.time;
    for (let i = effects.length - 1; i >= 0; i--) {const effect = effects[i]; effect.life -= dt; if (effect.life <= 0) {removeEffect(effect); effects.splice(i, 1); continue;}
      effect.mesh.material.opacity = effect.life / effect.total * .7;
      if (effect.kind === 'blast') effect.mesh.scale.setScalar(effect.scale + (1 - effect.life / effect.total) * 21);
      else if (effect.kind !== 'tracer') {effect.velocity.y -= dt * 7; effect.mesh.position.x += effect.velocity.x * dt; effect.mesh.position.y += effect.velocity.y * dt; effect.mesh.position.z += effect.velocity.z * dt; effect.mesh.rotation.x += dt * 2;}
    }
    updateHud();
  }
  function render() {
    if (!active() || !mount()) {container.visible = false; return false;} container.visible = true;
    const three = host.getThree?.(), camera = three?.camera || host.camera; ensureChunks(camera); syncActors(); updateHud(); return true;
  }
  function serialize() {
    const time = sim.time;
    return {version: 4, buildingId: state.buildingId, floor: state.floor, brokenWindows: [...brokenWindows], defcon: sim.defcon, time: time + clockOffset,
      simulationTime: time, responseAge: sim.defcon ? Math.max(0, time - finite(sim.responseStartedAt)) : 0, stats: clone(sim.stats),
      civilians: sim.civilians.map(p => officeCitySavePerson(p, time)), swat: clone(sim.swat), bombers: clone(sim.bombers), bombs: clone(sim.bombs), response: sim.serializeResponse?.() || null};
  }
  function restore(data) {
    if (state.disposed || !data || ![1, 2, 3, 4].includes(data.version)) return false;
    distantCivilianDebt=0;
    clearCivilianVisuals(); clearSwatVisuals(); disposeFloor();resetSurfaceDamage(); currentBuilding = null; state.buildingId = null; state.floor = 0; state.baseY = null; state.ride = 0; closeElevator();
    sim.reset(); sim.events.length = 0; clockOffset = finite(data.time); const oldTime = finite(data.simulationTime, finite(data.time));
    for (const refs of windowRecords.values()) for (const ref of refs) setRef(ref, true); brokenWindows.clear();
    for (const key of data.brokenWindows || []) {
      if (typeof key !== 'string') continue;
      const split = key.indexOf('|'), id = key.slice(0, split), pane = key.slice(split + 1), rec = buildingRecords.get(id);
      if (split > 0 && rec?.sourceParts.some(p => p.windowId === pane)) brokenWindows.add(key);
    }
    for (const [id] of instanceRecords) showBuilding(id, true);
    for(const facade of hqFacades.values())facade.setWindowStates(brokenWindows);
    const indoorGroups = new Map();
    for (const p of data.civilians || []) if (p.indoor && buildingRecords.has(p.buildingId) && Number.isInteger(p.floor)) {const key = p.buildingId + '|' + (p.surfaceOriginFloor||p.floor); if (!indoorGroups.has(key)) indoorGroups.set(key, []); indoorGroups.get(key).push(p);}
    for (const people of indoorGroups.values()) {
      people.sort((a, b) => Number(a.id.split('-').pop()) - Number(b.id.split('-').pop()));
      sim.activateInterior({buildingId:people[0].buildingId,floor:people[0].surfaceOriginFloor||people[0].floor,people});
    }
    const restorePerson = p => {
      const saved = clone(p); if (Number.isFinite(saved.panicUntil)) saved.panicUntil -= oldTime; if (Number.isFinite(saved.deathTime)) saved.deathTime -= oldTime;
      if (Number.isFinite(saved.suppressionRestUntil)) saved.suppressionRestUntil -= oldTime;
      if (Number.isFinite(saved.suppressionShotAt)) saved.suppressionShotAt -= oldTime;
      if (saved.suppression) {
        const q = saved.suppression;
        if (![q.angle,q.pitch,q.startedAt,q.expiresAt,q.rounds,q.burst].every(Number.isFinite) || q.expiresAt <= oldTime || q.rounds <= 0) saved.suppression = null;
        else {q.startedAt -= oldTime; q.expiresAt = Math.min(q.expiresAt-oldTime,4.5); q.rounds = clamp(Math.floor(q.rounds),0,18); q.burst = clamp(Math.floor(q.burst),0,5);}
      }
      if (Number.isFinite(saved.repathAt)) saved.repathAt -= oldTime; return officeCityRestorePerson(saved, oldTime);
    };
    for (const p of data.civilians || []) {const target = sim.getCivilian(p.id); if (target){Object.assign(target, restorePerson(p));if(target.surfaceOriginFloor)relocatedPeople.add(target);if(target.surfaceFalling)fallingPeople.add(target);}}
    sim.activateInterior(null); sim.swat.splice(0, sim.swat.length, ...(data.swat || []).map(restorePerson));
    for(const p of sim.swat)if(p.surfaceFalling)fallingPeople.add(p);
    sim.bombers.splice(0, sim.bombers.length, ...clone(data.bombers || []));
    sim.bombs.splice(0, sim.bombs.length, ...clone(data.bombs || []).map((b, i) => ({...b, id: 'restored-' + i + '-' + b.id})));
    sim.defcon = data.defcon ? 1 : 0; sim.responseStartedAt = sim.defcon ? -finite(data.responseAge) : null; if (data.stats) Object.assign(sim.stats, data.stats);
    sim.restoreResponse?.(data.response, oldTime);
    const b = buildingRecords.get(data.buildingId)?.building;
    if (b && Number.isInteger(data.floor) && data.floor >= 1 && data.floor <= b.floors) activateFloor(b, data.floor, true, true);
    else placeNative(player(), 0, true);
    lastNativeAlive = syncPlayer().alive; sim.events.length = 0; updateHud(true); return true;
  }
  function reset() {
    distantCivilianDebt=0;
    clearCivilianVisuals(); clearSwatVisuals(); disposeFloor();resetSurfaceDamage(); currentBuilding = null; state.buildingId = null; state.floor = 0; state.baseY = null; state.ride = 0; closeElevator();
    brokenWindows.clear(); for (const [id] of instanceRecords) showBuilding(id, true); roomCache.clear(); for (const rec of buildingRecords.values()) rec.floorBounds = null; sim.reset(); sim.events.length = 0; clockOffset = 0;
    for(const facade of hqFacades.values())facade.setWindowStates(brokenWindows);
    placeNative(player(), 0, true); lastNativeAlive = syncPlayer().alive; for (const effect of effects) removeEffect(effect); effects.length = 0; updateHud(true);
  }
  // Called only by the host's distant-region scheduler. Unlike a new-game
  // reset, this preserves cumulative history and never writes the native
  // player, inventory or vehicles. Occupied interiors cannot be reset.
  function resetRegion() {
    if (!active() || currentBuilding || state.buildingId) return false;
    const elapsed = clockOffset + sim.time, stats = clone(sim.stats);resetSurfaceDamage();
    responseGeneration++;
    clearCivilianVisuals(); clearSwatVisuals(); resetHitReactions();
    closeElevator(); state.ride = 0; state.rideTarget = 0;
    for (const effect of effects) removeEffect(effect); effects.length = 0;
    for (const warning of warnings) warning.visible = false;
    if (pools) for (const pool of Object.values(pools)) {
      pool.entities = [];
      if (pool.officeStates) pool.officeStates.length = 0;
      if (pool.officePoses) pool.officePoses.length = 0;
      if (pool.renderStates) pool.renderStates.length = 0;
      for (const {mesh} of pool.groups) mesh.count = 0;
    }
    brokenWindows.clear();
    for (const chunk of chunks.values()) releaseChunk(chunk);
    roomCache.clear(); for (const rec of buildingRecords.values()) {rec.parts = null; rec.floorBounds = null;}
    sim.reset(); sim.events.length = 0; clockOffset = elapsed;
    Object.assign(sim.stats, stats, {elapsed, activeCivilians: sim.civilians.filter(p => p.active).length});
    civilianVisualTime = swatVisualTime = sim.time;
    lastNativeAlive = syncPlayer().alive; updateHud(true);
    return true;
  }
  function dispose() {
    if (state.disposed) return; state.disposed = true; closeElevator(); clearCivilianVisuals(); clearSwatVisuals(); disposeFloor();resetSurfaceDamage();
    for (const effect of effects) removeEffect(effect); effects.length = 0;
    hqBuildings?.dispose();hqFacades.clear();hqActiveBuildings.clear();
    for(const item of hqParkedVisuals.values())item.visual?.dispose();hqParkedVisuals.clear();
    releaseGroup(container); for (const g of geometries.values()) g.dispose(); for (const m of materials.values()) m.dispose();
    geometries.clear(); materials.clear(); instanceRecords.clear(); windowRecords.clear(); roomCache.clear();
    if (ui) {document.removeEventListener('keydown', ui.escape, true); document.removeEventListener('pointerdown', ui.outside, true); ui.wrapper.remove(); ui = null;} mountedScene = null;
  }
  const api = {state, sim, brokenWindows, update, render, dispose, reset, resetRegion, onPlayerRespawn, serialize, restore, interact, prompt, enterBuilding, exitBuilding, changeFloor, rideTo,
    officeShot, officeCityUpdate, officePrepareCity, openElevator, closeElevator, selectExtraFloor, extraFloors, refreshUi: () => updateHud(true), groundAt, ceilingAt, pointBlocked, solidAt, bodyBlocked, moveAllowed, recoverOutside, outsideSupportAt, trace, lineOfSight, applyHit, damageRadius, damageSurfaces, restoreSurfaceDamage, isSurfaceCurrent, vertical, syncBreachTransition, damageResponseVehicles, responseVehicleBlastPoint, splash: damageRadius, applyExplosion: damageRadius, commitGlass, breakAlongRay, breakWindow, buildBoatModel, buildResponseVehicleModel,
    get surfaceStats(){return{damagedBuildings:damagedBuildings.size,owners:[...surfaceRecords.values()].filter(c=>surfaceHasCuts(c)).length,workingFloors:floorDataCache.size,neighborFloors:[...neighborFloors.keys()]};},
    get currentBuilding() {return currentBuilding;}, get currentInterior() {return floorModel;}, get isUiOpen() {return state.uiOpen || state.ride > 0;},
    get isInfoOpen() {return !!ui && !ui.wrapper.hidden && !ui.details.hidden;}, get isLocationVisible() {return !!ui && !ui.wrapper.hidden && !ui.location.hidden;},
    get hitReactions() {return getHitReactions();},
    get renderPools() {return pools;}, get windowCount() {return [...buildingRecords.values()].reduce((n, b) => n + b.sourceParts.filter(p => p.windowId).length, 0);},
    debug: {geometryParts, outsideProps, propGrid, buildingRecords, roomCache, chunks, container, hqFacades, hqActiveBuildings, hqParkedVisuals, point, localPoint, interiorLegal, officeCityPeople, officeCitySeat, officeCityAimed, officeCityThreat, officeCityChest, get currentBoxes() {return currentBoxes;}, get walkBoxes() {return walkBoxes;},
      get renderCache() {return {clock:renderCacheClock,grace:renderCacheGrace,chunkEvictions,detailEvictions,residentChunks:[...chunks.values()].filter(c=>c.group).length,facades:hqFacades.size,parkedDetails:[...hqParkedVisuals.values()].filter(item=>item.visual).length,swatActive:swatVisuals.size,swatCached:swatVisualCache.size,swatCreations,swatReuses,civilianActive:civilianVisuals.size,civilianCached:civilianVisualCache.size,civilianCreations,civilianReuses};},
      instanceRecords, windowRecords, ensureChunks}};
  lastNativeAlive = syncPlayer().alive; return api;
}
root.WestportRuntime = {create, version: '4.3.0-region-lifecycle'};
})(typeof window !== 'undefined' ? window : globalThis);

