'use strict';
/* Original HanQ automobile assets. Real material-only GLB models are cached per THREE runtime.
 * Game convention: +X forward, +Y up. Source GLB convention: +Z forward, +Y up, +X driver-left.
 */
(function (global) {
  const VERSION = 'cars-20261118-v1';
  const defs = Object.freeze({
    viper: Object.freeze({ kind: 'viper', name: 'VIPER GT', label: '스포츠카', color: '#c94742',
      maxSpeed: 40, acceleration: 13, braking: 25, reverseSpeed: 10, reverseAcceleration: 8,
      turnRate: 1.55, maxHp: 500, hp: 500, wheelRadius: .355, wheelbase: 2.86,
      collisionRadius: 1.08, collisionOffset: 1.28, length: 4.765, width: 1.95, height: 1.35,
      groundOffset: .005, seatHeight: .68, slopeDrag: 8, spawnWeight: 2, hitHeight: 1.35,
      driverSeat: Object.freeze({forward:-.15,left:.39,height:.68}), cameraHeight: 2.1, cameraDistance: 7.5, mapColor:'#ed7657',
      driverPose: Object.freeze({scale:.80,recline:.55,hipDrop:.10}),
      assetPath: 'vehicles/cars/sports_viper_gt_lod1.glb' }),
    nomad: Object.freeze({ kind: 'nomad', name: 'NOMAD 4X4', label: '정찰 SUV', color: '#436b76',
      maxSpeed: 30, acceleration: 10, braking: 22, reverseSpeed: 9, reverseAcceleration: 7.5,
      turnRate: 1.65, maxHp: 720, hp: 720, wheelRadius: .45, wheelbase: 2.96,
      collisionRadius: 1.18, collisionOffset: 1.38, length: 5.094, width: 2.18, height: 2.62,
      groundOffset: .005, seatHeight: 1.09, slopeDrag: 7, spawnWeight: 4, hitHeight: 2.10,
      driverSeat: Object.freeze({forward:.24,left:.47,height:1.09}), cameraHeight: 2.75, cameraDistance: 8.3, mapColor:'#6cc9ce',
      driverPose: Object.freeze({scale:.92,recline:.15,hipDrop:0}),
      assetPath: 'vehicles/cars/nomad_4x4_lod1.glb' }),
    mule: Object.freeze({ kind: 'mule', name: 'MULE UT', label: '픽업트럭', color: '#b49b6e',
      maxSpeed: 25, acceleration: 8, braking: 21, reverseSpeed: 8, reverseAcceleration: 7,
      turnRate: 1.4, maxHp: 840, hp: 840, wheelRadius: .45, wheelbase: 3.18,
      collisionRadius: 1.18, collisionOffset: 1.52, length: 5.394, width: 2.18, height: 2.28,
      groundOffset: .005, seatHeight: 1.09, slopeDrag: 6.5, spawnWeight: 4, hitHeight: 2.15,
      driverSeat: Object.freeze({forward:.24,left:.47,height:1.09}), cameraHeight: 2.65, cameraDistance: 8.8, mapColor:'#d8bb84',
      driverPose: Object.freeze({scale:.92,recline:.15,hipDrop:0}),
      assetPath: 'vehicles/cars/mule_ut_lod1.glb' })
  });
  const caches = new WeakMap();
  const isCar = kind => typeof kind === 'string' && Object.prototype.hasOwnProperty.call(defs, kind);
  const definition = kind => isCar(kind) ? defs[kind] : null;

  function cacheFor(T) {
    let cache = caches.get(T);
    if (!cache) { cache = new Map(); caches.set(T, cache); }
    return cache;
  }

  function template(T, def, loadGLB) {
    const cache = cacheFor(T);
    if (!cache.has(def.kind)) {
      const promise = Promise.resolve().then(() => loadGLB(def.assetPath)).then(result => {
        const scene = result && result.scene ? result.scene : result;
        if (!scene || !scene.isObject3D) throw new Error('Invalid automobile GLB: ' + def.kind);
        for (const name of ['Vehicle_Root','Steer_FL','Steer_FR','Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR']) {
          if (!scene.getObjectByName(name)) throw new Error('Missing automobile node: ' + name);
        }
        scene.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
            if (mat.isMeshStandardMaterial) mat.envMapIntensity = .85;
            // Opaque body first, followed by windows. Avoid translucent surfaces writing into the depth buffer.
            if (mat.transparent) { mat.depthWrite = false; o.castShadow = false; }
          }
        });
        return scene;
      });
      // One request per car type. On an unavailable asset retain the playable, recognizable fallback.
      // The next page load retries; repeated create() calls must not hammer a failing endpoint.
      cache.set(def.kind, promise);
    }
    return cache.get(def.kind);
  }

  function fallback(T, def) {
    const group = new T.Group(); group.name = 'Car_Fallback_' + def.kind;
    const resources = { geometries: [], materials: [] };
    const painted = new T.MeshLambertMaterial({ vertexColors: true });
    resources.materials.push(painted);
    const color = new T.Color();
    function batch(parts, name) {
      const positions = [], normals = [], colors = [];
      for (const [source, matrix, tint] of parts) {
        const geo = source.index ? source.toNonIndexed() : source.clone();
        geo.applyMatrix4(matrix); color.set(tint);
        const p = geo.attributes.position, n = geo.attributes.normal;
        for (let i = 0; i < p.count; i++) {
          positions.push(p.getX(i), p.getY(i), p.getZ(i));
          normals.push(n.getX(i), n.getY(i), n.getZ(i));
          colors.push(color.r, color.g, color.b);
        }
        geo.dispose(); source.dispose();
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      geo.computeBoundingSphere(); resources.geometries.push(geo);
      const mesh = new T.Mesh(geo, painted); mesh.name = name;
      mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
    }
    function part(parts, dimensions, xyz, tint, yaw = 0) {
      const m = new T.Matrix4().compose(new T.Vector3(...xyz), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), yaw), new T.Vector3(1,1,1));
      parts.push([new T.BoxGeometry(...dimensions), m, tint]);
    }
    const parts = [], sports = def.kind === 'viper', pickup = def.kind === 'mule';
    const h = sports ? .73 : 1.08, width = sports ? 1.83 : 1.96;
    part(parts,[def.length-.27,sports?.38:.67,width],[0,h,0],def.color);
    part(parts,[1.65,sports?.53:.62,width*.84],[sports?-.18:.05,h+(sports?.42:.61),0],'#263c49');
    part(parts,[sports?1.70:2.0,.10,width*.87],[sports?-.18:.05,h+(sports?.72:.96),0],sports?def.color:'#303a40');
    if (pickup) {
      // Keep an open bed rather than rendering a closed van box.
      part(parts,[1.6,.46,.15],[-1.75,1.19,.91],def.color);
      part(parts,[1.6,.46,.15],[-1.75,1.19,-.91],def.color);
      part(parts,[.15,.46,1.82],[-2.51,1.19,0],def.color);
      part(parts,[1.55,.05,1.73],[-1.74,1.0,0],'#30363c');
    }
    if (sports) {
      part(parts,[.37,.08,1.84],[-1.92,1.12,0],def.color);
      for (const z of [-.55,.55]) part(parts,[.10,.28,.10],[-1.92,.98,z],'#242a30');
    } else if (!pickup) {
      part(parts,[1.35,.17,1.20],[-.27,2.17,0],'#39454f');
      part(parts,[.12,.13,1.35],[.92,2.14,0],'#303a40');
      part(parts,[.04,.05,1.18],[.99,2.17,0],'#d8edf2');
    }
    part(parts,[.14,.20,width],[def.length/2-.10,sports?.39:.64,0],'#293039');
    part(parts,[.10,.17,width*.62],[def.length/2-.025,h,0],'#1b252e');
    part(parts,[.12,.18,width],[-def.length/2+.13,sports?.38:.65,0],'#293039');
    for (const z of [-width*.39,width*.39]) {
      part(parts,[.065,.065,width*.22],[def.length/2-.01,h+.10,z],'#e8f5fa');
      part(parts,[.06,.08,width*.16],[-def.length/2+.06,h+.11,z],'#d83935');
    }
    group.add(batch(parts, 'Fallback_Body'));
    const wheels = [];
    for (const [front, left] of [[true,true],[true,false],[false,true],[false,false]]) {
      const pivot = new T.Group(); pivot.position.set(front?def.wheelbase/2:-def.wheelbase/2,def.wheelRadius,left?-.99:.99);
      const spin = new T.Group(); pivot.add(spin); group.add(pivot);
      const wheelParts = [], m = new T.Matrix4().makeRotationX(Math.PI/2);
      wheelParts.push([new T.CylinderGeometry(def.wheelRadius,def.wheelRadius,.30,12),m,'#24272b']);
      for (const z of [-.157,.157]) {
        const rim = new T.Matrix4().compose(new T.Vector3(0,0,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2),new T.Vector3(1,1,1));
        wheelParts.push([new T.CylinderGeometry(def.wheelRadius*.62,def.wheelRadius*.62,.018,8),rim,'#89939c']);
      }
      spin.add(batch(wheelParts, 'Fallback_Wheel')); wheels.push({pivot,spin,front});
    }
    return { group, wheels, dispose() { for (const g of resources.geometries) g.dispose(); for (const m of resources.materials) m.dispose(); } };
  }

  function create(T, kind, options = {}) {
    const def = definition(kind);
    if (!def) throw new Error('Unknown HanQ car kind: ' + kind);
    const group = new T.Group(); group.name = def.name; group.userData.carKind = kind;
    const proxy = fallback(T, def); group.add(proxy.group);
    const rollAxis = new T.Vector3(1,0,0), steerAxis = new T.Vector3(0,1,0), q = new T.Quaternion();
    const originalMaterials = new Map();
    let alive = true, detailed = null, rigs = [], steering = [], deadState = false, lastDead = null;
    let travel = 0, steer = 0, far = false, low = false;
    let ownedWreck = null;
    const wreck = options.wreckMaterial || (ownedWreck = new T.MeshLambertMaterial({color:0x403c38}));
    function setWreck(value) {
      if (lastDead === value) return;
      group.traverse(o => {
        if (!o.isMesh) return;
        if (!originalMaterials.has(o)) originalMaterials.set(o,o.material);
        o.material = value ? wreck : originalMaterials.get(o);
      });
      lastDead = value;
    }
    function animate() {
      for (const w of proxy.wheels) {
        w.spin.rotation.z = -travel / def.wheelRadius;
        if (w.front) w.pivot.rotation.y = -steer*.45;
      }
      q.setFromAxisAngle(rollAxis,travel/def.wheelRadius);
      for (const r of rigs) r.node.quaternion.copy(r.rest).multiply(q);
      q.setFromAxisAngle(steerAxis,-steer*.45);
      for (const r of steering) r.node.quaternion.copy(r.rest).multiply(q);
      if (detailed) detailed.visible = !far;
      proxy.group.visible = !detailed || far;
      setWreck(deadState);
    }
    const api = {
      group, kind, definition:def, wheels:proxy.wheels, status:'loading', ready:null,
      update(travelMeters, steerInput = 0, dead = false, view = {}) {
        if (!alive) return;
        if (Number.isFinite(travelMeters)) travel = travelMeters;
        if (Number.isFinite(steerInput)) steer = Math.max(-1,Math.min(1,steerInput));
        deadState = !!dead; low = view.quality === 'low';
        if (Number.isFinite(view.distance)) {
          const cutoff = low ? 85 : 140;
          // Small hysteresis prevents flickering at the distance threshold.
          far = view.distance > cutoff + (far ? -10 : 10);
        }
        animate();
      },
      getAnchor(name, target = new T.Vector3()) {
        if (!detailed) return null;
        const node = detailed.getObjectByName(name);
        if (!node) return null;
        group.updateWorldMatrix(true,true); return node.getWorldPosition(target);
      },
      dispose() {
        if (!alive) return;
        alive = false; api.status = 'disposed'; group.removeFromParent(); group.clear();
        proxy.dispose(); if (ownedWreck) ownedWreck.dispose(); originalMaterials.clear();
        detailed = null; rigs = []; steering = [];
      }
    };
    const load = options.loadGLB;
    api.ready = (typeof load === 'function' ? template(T,def,load) : Promise.reject(new Error('No GLB loader'))).then(scene => {
      if (!alive) return false;
      const model = scene.clone(true), corrected = new T.Group(); corrected.name = 'Car_Source_Axis';
      corrected.rotation.y = Math.PI/2; corrected.position.y = def.groundOffset;
      corrected.add(model); group.add(corrected); detailed = corrected;
      const named = name => { const node = model.getObjectByName(name); return {node,rest:node.quaternion.clone()}; };
      rigs = ['Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR'].map(named);
      steering = ['Steer_FL','Steer_FR'].map(named);
      // A car may have been wrecked before the asynchronous GLB finished loading.
      lastDead = null; api.status = 'ready'; animate(); return true;
    }).catch(error => {
      if (!alive) return false;
      api.status = 'fallback'; api.error = String(error && error.message || error);
      if (typeof options.onError === 'function') options.onError(error);
      return false;
    });
    return api;
  }
  global.HanQCars = Object.freeze({version:VERSION,defs,definition,isCar,create});
})(typeof window !== 'undefined' ? window : globalThis);
