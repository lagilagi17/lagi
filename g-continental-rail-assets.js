/* Continental Railway — original procedural assets, metres, Three r160.
 * Game x/y are the horizontal plane; h is absolute rail-top height.
 * Shared geometry + spatial instance batches keep the whole line inexpensive.
 * The service/terrain module owns every position; no random map edits occur here.
 */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2, FLOOR = 1.12, HALF_WIDTH = 1.65;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
  const rampSegments = st => {
    const ramp = st.ramp;
    return (ramp?.segments?.length ? ramp.segments : ramp ? [ramp] : [])
      .filter(q => q.start && q.end && Math.hypot(q.end.x - q.start.x, q.end.y - q.start.y) > 1e-6)
      .map(q => ({ ...q, width: q.width || ramp.width || 4 }));
  };

  // Render-independent dimensions: native movement and bullets can use these
  // before Three.js is initialized. Every h below is a box CENTRE height.
  function collisionSpecs(rt) {
    if (!rt?.route || typeof rt.sample !== 'function') return [];
    const out = [], length = rt.route.length, ramps = rt.route.stations.flatMap(rampSegments);
    const groundAt = q => typeof rt.getGround === 'function' ? rt.getGround(q.x, q.y) : finite(q.ground, q.h - .7);
    // Keep all structural supports outside the complete pedestrian path,
    // including bent approaches and the platform connection at either end.
    const rampClear = (x, y, radius) => ramps.every(r => {
      const a = r.start, b = r.end, dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(x - a.x - dx * t, y - a.y - dy * t) > r.width / 2 + radius + .35;
    });
    for (let start = 0; start < length; start += 128) {
      const end = Math.min(length, start + 128);
      for (let s = start; s < end - .01; s += 4) {
        const a = rt.sample(s), b = rt.sample(Math.min(end, s + 4)), q = rt.sample((s + Math.min(end, s + 4)) / 2);
        if (q.h - groundAt(q) <= 3) continue;
        const horizontal = Math.hypot(b.x - a.x, b.y - a.y);
        out.push({ kind: 'deck', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, h: (a.h + b.h) / 2 - .87,
          width: 5.2, length: Math.hypot(horizontal, b.h - a.h) + .04, height: .5,
          yaw: Math.atan2(b.y - a.y, b.x - a.x), pitch: Math.atan2(b.h - a.h, horizontal) });
      }
    }
    for (let s = 18; s < length; s += 24) {
      const q = rt.sample(s), ground = groundAt(q);
      if (!(q.h - ground > 3) || !rampClear(q.x, q.y, 2.5) || typeof rt.roadClear === 'function' && !rt.roadClear(q.x, q.y, 2.5)) continue;
      const base = Math.max(finite(ground, -2), -2) - .1, top = q.h - 1.12;
      out.push({ kind: 'pier', s, x: q.x, y: q.y, h: (top + base) / 2, width: 2.4, length: 1.4, height: Math.max(.3, top - base), yaw: q.yaw });
    }
    for (const [index, st] of rt.route.stations.entries()) {
      const side = st.platformSide || 1, offset = side * (st.platformOffset || 6), c = Math.cos(st.yaw), s = Math.sin(st.yaw), P = st.platform;
      out.push({ kind: 'platform', stationId: st.id, x: P?.x ?? st.x - s * offset, y: P?.y ?? st.y + c * offset,
        h: finite(P?.h, st.h + FLOOR) - .23, width: st.platformWidth || 7.5, length: st.platformLength || 148, height: .46, yaw: st.yaw, pitch: 0 });
      const width = st.platformWidth || 7.5, platformLength = st.platformLength || 148;
      for (let along = -platformLength / 2 + 8; along <= platformLength / 2 - 7; along += 22) for (const lateral of [offset - 2.35, offset + 2.35]) {
        const x = st.x + c * along - s * lateral, y = st.y + s * along + c * lateral;
        const native = typeof rt.getGround === 'function' ? rt.getGround(x, y) : st.h - 1;
        const bottom = Math.max(finite(native, st.h - 1), -2), top = finite(P?.h, st.h + FLOOR) - .46;
        if (top - bottom <= .5 || !rampClear(x, y, 1) || typeof rt.roadClear === 'function' && !rt.roadClear(x, y, 1)) continue;
        out.push({ kind: 'pier', stationId: st.id, x, y, h: (top + bottom) / 2, width: 1, length: 1.2, height: top - bottom, yaw: st.yaw });
      }
      // Match the visible furniture instead of leaving the whole platform empty
      // in physics. Separate seat/back/legs retain the real open space beneath.
      const top=finite(P?.h,st.h+FLOOR),canopy=index===1?104:index===2?78:92;
      const furniture=(role,along,dh,lateral,length,height,width,standable=false)=>out.push({
        kind:'station-furniture',role,stationId:st.id,x:st.x+c*along-s*lateral,y:st.y+s*along+c*lateral,
        h:top+dh,length,height,width,yaw:st.yaw,pitch:0,standable});
      for(let x=-canopy/2+4;x<=canopy/2-3;x+=14)for(const z of[offset-side*.3,offset+side*2.7]){
        furniture('canopy-post',x,2.14,z,.18,4.28,.18);
        furniture('post-foot',x,.08,z,.46,.16,.46,true);
      }
      furniture('canopy',0,4.33,offset+side*.9,canopy,.18,6.5,true);
      furniture('canopy-top',0,4.47,offset+side*.9,canopy-.8,.1,5.8,true);
      for(const x of[-48,-22,24,50]){
        furniture('bench-seat',x,.52,offset+side*1.6,4.8,.14,.57,true);
        furniture('bench-back',x,.94,offset+side*1.82,4.8,.7,.1,true);
        for(const dx of[-1.7,1.7])furniture('bench-leg',x+dx,.23,offset+side*1.6,.12,.46,.46);
      }
      for(const x of[-60,60])furniture('kiosk',x,.95,offset+side*2.4,1.08,1.9,.66,true);
      for(let x=-platformLength/2+8;x<=platformLength/2-7;x+=22)furniture('lamp-post',x,2.5,offset+side*3.3,.14,5,.14);
      for (const [segmentIndex, ramp] of rampSegments(st).entries()) out.push({ kind: 'ramp', stationId: st.id, segmentIndex, start: { ...ramp.start }, end: { ...ramp.end }, width: ramp.width, thickness: .24 });
    }
    return out;
  }

  function build(T, options = {}) {
    const rt = options.runtime;
    if (!T || !rt || !rt.route || typeof rt.sample !== 'function') throw new Error('Continental railway assets require THREE and a rail runtime.');
    const root = new T.Group(); root.name = 'continental-railway'; root.userData.continentalRailway = true;
    const geometry = new Set(), materials = new Set(), textures = new Set(), batches = [], chunks = [], stations = [], cars = [], colliders = collisionSpecs(rt);
    const owned = g => { geometry.add(g); g.userData.railOwned = true; return g; };
    const mat = props => { const m = new T.MeshStandardMaterial(props); m.userData.railOwned = true; materials.add(m); return m; };
    const opaque = mat({ color: 0xffffff, roughness: .78, metalness: .18, vertexColors: true });
    const instanceMaterial = mat({ color: 0xffffff, roughness: .76, metalness: .22 });
    const glass = mat({ color: 0x416b7c, roughness: .18, metalness: .16, transparent: true, opacity: .37, depthWrite: false, side: T.DoubleSide });
    const lampWhite = mat({ color: 0xffedbd, emissive: 0xffdda1, emissiveIntensity: 1.6, roughness: .35 });
    const lampRed = mat({ color: 0xe32836, emissive: 0xe32836, emissiveIntensity: 1.2, roughness: .45 });
    const unitBox = owned(new T.BoxGeometry(1, 1, 1));
    const unitCylinder = owned(new T.CylinderGeometry(.5, .5, 1, 12));
    const unitPlane = owned(new T.PlaneGeometry(1, 1));
    const v = new T.Vector3(), color = new T.Color();
    const stats = { version: 1, cars: 5, stations: rt.route.stations.length, staticChunks: 0, staticInstances: 0, drawObjects: 0, triangles: 0, disposed: false };
    let disposed = false;

    function pose(x, h, y, yaw = 0, pitch = 0) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      return new T.Matrix4().makeBasis(new T.Vector3(cy * cp, sp, sy * cp), new T.Vector3(-cy * sp, cp, -sy * sp), new T.Vector3(-sy, 0, cy)).setPosition(x, h, y);
    }
    function localMatrix(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
      return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
    }
    function segmentMatrix(a, b, width, depth, heightOffset = 0) {
      const dx = b.x - a.x, dy = b.y - a.y, dh = b.h - a.h;
      const horizontal = Math.hypot(dx, dy), length = Math.hypot(horizontal, dh);
      const m = pose((a.x + b.x) / 2, (a.h + b.h) / 2 + heightOffset, (a.y + b.y) / 2, Math.atan2(dy, dx), Math.atan2(dh, horizontal));
      return m.scale(new T.Vector3(length + .04, depth, width));
    }
    function worldOffset(q, along, side, dh = 0) {
      const c = Math.cos(q.yaw), s = Math.sin(q.yaw);
      return { x: q.x + c * along - s * side, y: q.y + s * along + c * side, h: q.h + dh };
    }
    function batchBuilder() {
      const items = [];
      return {
        box(matrix, hex) { items.push({ shape: 'box', matrix, hex }); },
        cylinder(matrix, hex) { items.push({ shape: 'cylinder', matrix, hex }); },
        finish(parent, prefix) {
          for (const shape of ['box', 'cylinder']) {
            const list = items.filter(p => p.shape === shape); if (!list.length) continue;
            const m = new T.InstancedMesh(shape === 'box' ? unitBox : unitCylinder, instanceMaterial, list.length);
            m.name = prefix + '-' + shape; m.userData.railBatch = true; m.castShadow = false; m.receiveShadow = true;
            list.forEach((p, i) => { m.setMatrixAt(i, p.matrix); m.setColorAt(i, color.set(p.hex)); });
            m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
            m.computeBoundingBox(); m.computeBoundingSphere(); parent.add(m); batches.push(m);
            stats.staticInstances += list.length;
          }
        }
      };
    }
    function localBox(B, x, h, y, w, height, depth, hex, rx = 0, ry = 0, rz = 0) {
      B.box(localMatrix(x, h, y, w, height, depth, rx, ry, rz), hex);
    }
    function addLabel(parent, label, subtitle, x, h, y, width, yaw = 0, style = '#213d4c') {
      const document = global.document;
      if (!document || !document.createElement) return;
      const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 192;
      const c = canvas.getContext && canvas.getContext('2d'); if (!c) return;
      c.fillStyle = style; c.fillRect(0, 0, 768, 192); c.fillStyle = '#f4c953'; c.fillRect(0, 0, 12, 192);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f4f2e8'; c.font = '700 54px system-ui, sans-serif'; c.fillText(label, 391, 78, 708);
      c.fillStyle = '#bed2da'; c.font = '500 25px system-ui, sans-serif'; c.fillText(subtitle, 391, 143, 700);
      const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 2; textures.add(texture);
      const material = new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide, toneMapped: false }); material.userData.railOwned = true; materials.add(material);
      const mesh = new T.Mesh(unitPlane, material); mesh.name = 'rail-sign-' + label; mesh.position.set(x, h, y); mesh.rotation.y = yaw; mesh.scale.set(width, width / 4, 1); parent.add(mesh);
    }

    // Spatially bounded batches: sleepers and rails do not create one draw call
    // per element and distant sections can be omitted as whole branches.
    const routeLength = rt.route.length, chunkLength = 128;
    for (let start = 0, i = 0; start < routeLength; start += chunkLength, i++) {
      const end = Math.min(routeLength, start + chunkLength), center = rt.sample((start + end) / 2);
      const group = new T.Group(); group.name = 'rail-track-chunk-' + i;
      group.userData = { railChunk: i, center: { x: center.x, y: center.h, z: center.y }, radius: 86 };
      const B = batchBuilder();
      for (let s = start; s < end - .01; s += 4) {
        const a = rt.sample(s), b = rt.sample(Math.min(end, s + 4)), q = rt.sample((s + Math.min(end, s + 4)) / 2);
        B.box(segmentMatrix(a, b, 3.8, .3, -.47), 0x74716b);
        for (const side of [-.7175, .7175]) {
          const aa = worldOffset(a, 0, side, -.09), bb = worldOffset(b, 0, side, -.09);
          B.box(segmentMatrix(aa, bb, .105, .18), 0xa4adb2);
        }
        const ground = typeof rt.getGround === 'function' ? rt.getGround(q.x, q.y) : finite(q.ground, q.h - .7);
        if (q.h - ground > 3) {
          B.box(segmentMatrix(a, b, 5.2, .5, -.87), 0x7f8a8d);
          for (const side of [-2.42, 2.42]) {
            const aa = worldOffset(a, 0, side, -.35), bb = worldOffset(b, 0, side, -.35);
            B.box(segmentMatrix(aa, bb, .16, .62), 0x465862);
          }
        }
      }
      for (let s = Math.ceil(start / 1.2) * 1.2; s < end; s += 1.2) {
        const q = rt.sample(s);
        B.box(pose(q.x, q.h - .24, q.y, q.yaw, q.pitch).scale(new T.Vector3(.22, .16, 2.82)), 0x786c5a);
      }
      for (const q of colliders.filter(q => q.kind === 'pier' && !q.stationId && q.s >= start && q.s < end)) {
        const base = q.h - q.height / 2, top = q.h + q.height / 2;
        B.box(pose(q.x, q.h, q.y, q.yaw).scale(new T.Vector3(q.length, q.height, q.width)), 0x949a95);
        B.box(pose(q.x, top - .18, q.y, q.yaw).scale(new T.Vector3(2, .36, 4.3)), 0x9fa4a0);
        B.box(pose(q.x, base + .14, q.y, q.yaw).scale(new T.Vector3(2.3, .28, 3.3)), 0x78847c);
      }
      B.finish(group, group.name); root.add(group); chunks.push(group);
    }
    stats.staticChunks = chunks.length;
    // Physical buffers remain outside the train stopping envelope.
    for (const s of [1, routeLength - 1]) {
      const q = rt.sample(s), group = new T.Group(); group.name = 'rail-buffer-' + Math.round(s); group.matrixAutoUpdate = false; group.matrix.copy(pose(q.x, q.h, q.y, q.yaw));
      const B = batchBuilder();
      localBox(B, 0, .7, 0, .28, .22, 2.9, 0xb1443b);
      for (const z of [-.82, .82]) { localBox(B, -.4, .34, z, 1.8, .22, .24, 0x4e5559, 0, 0, .32); localBox(B, 0, .77, z, .14, .31, .44, 0xf4d991); }
      B.finish(group, group.name); root.add(group);
    }

    const palettes = [
      { wall: 0xb1a38c, roof: 0x375260, trim: 0xd2c5aa, accent: 0xd09d44, sign: '#273d49', subtitle: 'WESTPORT LINK  /  01' },
      { wall: 0xc4cbd0, roof: 0x2e4d5b, trim: 0xe3e8e8, accent: 0x42a4b6, sign: '#193d50', subtitle: 'CENTRAL CITY  /  02' },
      { wall: 0xc5a775, roof: 0xa36c42, trim: 0xe6ca98, accent: 0xce633c, sign: '#664433', subtitle: 'RED SANDS  /  03' },
      { wall: 0xc5cecc, roof: 0x356c7c, trim: 0xe0e3d3, accent: 0x5db0b7, sign: '#24515e', subtitle: 'EAST COAST  /  04' }
    ];
    for (const [index, st] of rt.route.stations.entries()) {
      const P = st.platform, pal = palettes[index % palettes.length], side = st.platformSide || 1;
      const group = new T.Group(); group.name = 'rail-station-' + st.id; group.userData.stationId = st.id;
      group.matrixAutoUpdate = false; group.matrix.copy(pose(st.x, st.h, st.y, st.yaw));
      const B = batchBuilder(), width = st.platformWidth || 7.5, length = st.platformLength || 148, offset = side * (st.platformOffset || 6), platformH = finite(P?.h, st.h + FLOOR) - st.h;
      localBox(B, 0, platformH - .23, offset, length, .46, width, pal.wall);
      localBox(B, 0, platformH + .018, offset - side * (width / 2 - .25), length - .4, .036, .42, 0xe9c44a);
      localBox(B, 0, platformH + .022, offset - side * (width / 2 - .85), length - .4, .024, .08, 0xf4efe0);
      for (let x = -length / 2 + 2; x < length / 2; x += 4) localBox(B, x, platformH + .022, offset, .025, .012, width - 1.8, 0x8b8e86);
      // A broad canopy + clear central entrance: no solid building blocks the ramp.
      const canopy = index === 1 ? 104 : index === 2 ? 78 : 92;
      for (let x = -canopy / 2 + 4; x <= canopy / 2 - 3; x += 14) {
        for (const z of [offset - side * .3, offset + side * 2.7]) {
          localBox(B, x, platformH + 2.14, z, .18, 4.28, .18, pal.roof);
          localBox(B, x, platformH + .08, z, .46, .16, .46, pal.trim);
        }
        localBox(B, x, platformH + 4.1, offset + side * 1.1, .17, .24, 5.65, pal.roof);
      }
      localBox(B, 0, platformH + 4.33, offset + side * .9, canopy, .18, 6.5, pal.roof);
      localBox(B, 0, platformH + 4.47, offset + side * .9, canopy - .8, .10, 5.8, index === 2 ? pal.trim : 0x7396a0);
      localBox(B, 0, platformH + 4.22, offset - side * 2.35, canopy, .16, .12, pal.accent);
      // Open shelters, benches and self-service kiosks, kept off the platform throat.
      for (const x of [-48, -22, 24, 50]) {
        localBox(B, x, platformH + .52, offset + side * 1.6, 4.8, .14, .57, 0x625d50);
        localBox(B, x, platformH + .94, offset + side * 1.82, 4.8, .7, .10, pal.roof);
        for (const dx of [-1.7, 1.7]) localBox(B, x + dx, platformH + .23, offset + side * 1.6, .12, .46, .46, pal.roof);
      }
      for (const x of [-60, 60]) {
        localBox(B, x, platformH + .95, offset + side * 2.4, 1.08, 1.9, .66, pal.roof);
        localBox(B, x, platformH + 1.3, offset + side * 2.035, .77, .53, .04, 0x88c3ce);
        localBox(B, x, platformH + .8, offset + side * 2.015, .5, .07, .03, 0xe1c485);
      }
      for (let x = -length / 2 + 8; x <= length / 2 - 7; x += 22) {
        const z = offset + side * 3.3;
        localBox(B, x, platformH + 2.5, z, .14, 5, .14, pal.roof);
        localBox(B, x, platformH + 5.05, z - side * .45, 1.3, .16, 1.2, 0xe0d7bb);
      }
      // Narrow paired supports leave open space below the platform. Physics
      // consumes these exact same records, including native-road exclusions.
      for (const support of colliders.filter(q => q.kind === 'pier' && q.stationId === st.id)) {
        const dx = support.x - st.x, dy = support.y - st.y, cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
        localBox(B, dx * cy + dy * sy, support.h - st.h, -dx * sy + dy * cy, support.length, support.height, support.width, 0x929992);
      }
      B.finish(group, 'rail-platform-' + index);
      for (const x of [-34, 35]) addLabel(group, st.name, pal.subtitle, x, platformH + 3.25, offset + side * 1.05, 9.2, side > 0 ? Math.PI : 0, pal.sign);
      root.add(group); stations.push(group);
      const ramps = colliders.filter(q => q.kind === 'ramp' && q.stationId === st.id);
      if (ramps.length) {
        const access = new T.Group(); access.name = 'rail-ramp-' + st.id; access.userData.stationId = st.id;
        access.userData.rampSegments = ramps.length;
        const A = batchBuilder();
        for (const [rampIndex, ramp] of ramps.entries()) {
          const a = ramp.start, b = ramp.end, w = ramp.width;
          A.box(segmentMatrix(a, b, w, ramp.thickness, -ramp.thickness / 2), pal.wall);
          const dx = b.x - a.x, dy = b.y - a.y, yaw = Math.atan2(dy, dx), length = Math.hypot(dx, dy), nx = -Math.sin(yaw), ny = Math.cos(yaw);
          // End rails are open where paths join: a perpendicular rail must not
          // span the neighbouring segment's walking width at a bend.
          const bend = other => other && (Math.abs(dx * (other.end.y - other.start.y) - dy * (other.end.x - other.start.x)) > 1e-6 || dx * (other.end.x - other.start.x) + dy * (other.end.y - other.start.y) < 0);
          const previous = ramps[rampIndex - 1], next = ramps[rampIndex + 1];
          const from = bend(previous) ? Math.min(length / 2, previous.width / 2 + .16) : 0;
          const to = length - (bend(next) ? Math.min(length / 2, next.width / 2 + .16) : 0);
          if (to <= from + .02) continue;
          for (const side of [-1, 1]) {
            const point = d => ({ x: a.x + dx * d / length + nx * side * (w / 2 + .08), y: a.y + dy * d / length + ny * side * (w / 2 + .08), h: a.h + (b.h - a.h) * d / length });
            const aa = point(from), bb = point(to);
            A.box(segmentMatrix({ ...aa, h: aa.h + 1.05 }, { ...bb, h: bb.h + 1.05 }, .075, .075), pal.roof);
            const steps = Math.max(1, Math.ceil((to - from) / 3));
            for (let i = 0; i <= steps; i++) {
              const p = point(from + (to - from) * i / steps);
              A.box(pose(p.x, p.h + .53, p.y, yaw).scale(new T.Vector3(.08, 1.06, .08)), pal.roof);
            }
          }
        }
        A.finish(access, access.name); root.add(access); stations.push(access);
      }
    }

    // Material-coloured merged meshes for vehicle panels; the windows remain
    // real openings, so the native first-person passenger camera can see out.
    function mergedBuilder() {
      const pieces = [];
      return {
        add(g, m, hex) { pieces.push({ g, m, hex }); },
        box(x, h, z, sx, sy, sz, hex, rx = 0, ry = 0, rz = 0) { pieces.push({ g: unitBox, m: localMatrix(x, h, z, sx, sy, sz, rx, ry, rz), hex }); },
        cylinder(x, h, z, radius, length, hex, axis = 'y') { pieces.push({ g: unitCylinder, m: localMatrix(x, h, z, radius * 2, length, radius * 2, axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0), hex }); },
        mesh(name) {
          const pos = [], norm = [], col = [], uv = [], n = new T.Vector3(), normalMatrix = new T.Matrix3();
          for (const piece of pieces) {
            const g = piece.g, p = g.attributes.position, normal = g.attributes.normal, tex = g.attributes.uv, index = g.index, c = new T.Color(piece.hex);
            normalMatrix.getNormalMatrix(piece.m);
            const count = index ? index.count : p.count;
            for (let i = 0; i < count; i++) {
              const at = index ? index.getX(i) : i;
              v.fromBufferAttribute(p, at).applyMatrix4(piece.m); pos.push(v.x, v.y, v.z);
              if (normal) n.fromBufferAttribute(normal, at).applyMatrix3(normalMatrix).normalize(); else n.set(0, 1, 0);
              norm.push(n.x, n.y, n.z); col.push(c.r, c.g, c.b); uv.push(tex ? tex.getX(at) : 0, tex ? tex.getY(at) : 0);
            }
          }
          const g = owned(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(norm, 3));
          g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeBoundingBox(); g.computeBoundingSphere();
          const m = new T.Mesh(g, opaque); m.name = name; m.castShadow = true; m.receiveShadow = true; return m;
        }
      };
    }
    function taperedNose(sign) {
      const a = [[1.05, -1.62], [3.28, -1.62], [3.68, -1.4], [3.98, -.95], [3.98, .95], [3.68, 1.4], [3.28, 1.62], [1.05, 1.62]];
      const b = [[1.11, -.94], [2.7, -1.15], [3.3, -1.02], [3.57, -.7], [3.57, .7], [3.3, 1.02], [2.7, 1.15], [1.11, .94]];
      const points = a.map(q => [sign * 9.4, q[0], q[1]]).concat(b.map(q => [sign * 12.6, q[0], q[1]])), p = [];
      const tri = (i, j, k) => { if (sign < 0) { const t = j; j = k; k = t; } p.push(...points[i], ...points[j], ...points[k]); };
      for (let i = 1; i < 7; i++) tri(8, 8 + i, 8 + i + 1);
      for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; tri(i, j, 8 + j); tri(i, 8 + j, 8 + i); }
      const g = owned(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
    }
    function makeCar(index) {
      const cab = index === 0 || index === 4, noseSign = index === 0 ? -1 : index === 4 ? 1 : 0;
      const group = new T.Group(); group.name = 'rail-car-' + index; group.matrixAutoUpdate = false; group.userData = { carIndex: index, noseSign };
      const B = mergedBuilder(), D = mergedBuilder(), interior = mergedBuilder(), L = cab ? 25.2 : 24.4, half = L / 2;
      // All cars share door offsets with the native shell/boarding contract.
      const rear = noseSign === -1 ? -9.4 : -half, front = noseSign === 1 ? 9.4 : half, doors = [-8.5, 8.5];
      B.box((front + rear) / 2, FLOOR - .10, 0, front - rear, .2, 3.24, 0xb6bdbb);
      B.box(0, .84, 0, L - 1.4, .34, 2.72, 0x2b343b);
      for (const side of [-1, 1]) {
        const cuts = [rear, doors[0] - .7, doors[0] + .7, doors[1] - .7, doors[1] + .7, front];
        for (let i = 0; i < cuts.length; i += 2) {
          if (cuts[i + 1] <= cuts[i]) continue;
          const length = cuts[i + 1] - cuts[i], mid = (cuts[i] + cuts[i + 1]) / 2;
          B.box(mid, 1.64, side * 1.57, length, 1.04, .15, 0xc4cdd0);
          B.box(mid, 1.98, side * 1.66, length, .16, .035, 0xbd3b43);
          B.box(mid, 1.23, side * 1.65, length, .22, .04, 0x465660);
        }
        B.box((rear + front) / 2, 3.51, side * 1.57, front - rear, .39, .16, 0xc6cfd0);
        B.box((rear + front) / 2, 3.27, side * 1.65, front - rear, .08, .055, 0x344b59);
        for (const x of doors) {
          for (const dx of [-.73, .73]) B.box(x + dx, 2.22, side * 1.63, .06, 2.2, .15, 0x3c4a52);
          B.box(x, 3.29, side * 1.62, 1.5, .09, .17, 0x3c4a52);
          B.box(x, FLOOR + .015, side * 1.67, 1.48, .04, .28, 0xe4c66d);
        }
        // An uninterrupted middle window, with narrow columns between bays.
        for (let x = Math.ceil((rear + .3) / 2.1) * 2.1; x < front - .25; x += 2.1) {
          if (doors.some(d => Math.abs(x - d) < 1.05)) continue;
          B.box(x, 2.72, side * 1.61, .10, 1.14, .16, 0x47606b);
        }
      }
      B.box((rear + front) / 2, 3.92, 0, front - rear + .04, .2, 2.10, 0x9daeb3);
      for (const side of [-1, 1]) B.box((rear + front) / 2, 3.76, side * 1.21, front - rear, .16, .75, 0xaab8ba, side * .35, 0, 0);
      for (const x of [-5.5, 4.5]) {
        B.box(x, 4.11, 0, 2.55, .22, 1.25, 0x657981);
        for (let i = -3; i <= 3; i++) B.box(x + i * .28, 4.24, 0, .09, .05, .97, 0x354650);
      }
      for (const x of [-7.7, 7.7]) {
        B.box(x, .54, 0, 3.24, .32, 2.16, 0x253037);
        for (const dx of [-.82, .82]) {
          B.cylinder(x + dx, .46, 0, .13, 2.9, 0x6d777b, 'z');
          for (const z of [-.8, .8]) { B.cylinder(x + dx, .46, z, .46, .17, 0x21292d, 'z'); B.cylinder(x + dx, .46, z * 1.14, .25, .05, 0x616d72, 'z'); }
        }
      }
      for (const x of [-half, half]) B.box(x + Math.sign(x) * .25, .79, 0, .6, .24, .30, 0x26343b);
      if (cab) {
        B.add(taperedNose(noseSign), new T.Matrix4(), 0xc7d0d2);
        B.box(noseSign * 12.64, 2.91, 0, .04, .8, 1.56, 0x234557);
        B.box(noseSign * 12.66, 1.2, 0, .15, .25, 1.42, 0x344a56);
        B.box(noseSign * 12.63, 3.48, 0, .05, .19, .9, 0x355267);
      } else {
        for (const x of [-half, half]) {
          B.box(x, 2.37, -.99, .15, 2.48, 1.1, 0x9eadb1); B.box(x, 2.37, .99, .15, 2.48, 1.1, 0x9eadb1);
          B.box(x, 3.5, 0, .15, .25, 1.0, 0x637781);
          B.box(x, 2.2, 0, .07, 2.14, .82, 0x3d535c);
        }
      }
      const body = B.mesh('rail-body-' + index); group.add(body);
      // Seats stop well before the central vestibule; the gameplay passenger
      // stands at along=0, lateral=.7 and is never embedded in furniture.
      for (const x of [-6.4, -4.7, 4.7, 6.4]) for (const z of [-1.02, 1.02]) {
        interior.box(x, 1.51, z, 1.16, .18, .84, 0x31556a);
        interior.box(x - .4, 1.94, z, .17, .8, .85, 0x365e74);
        interior.box(x, 1.29, z, .16, .33, .4, 0x869593);
        for (const zz of [-.45, .45]) interior.box(x, 1.7, z + zz, .77, .07, .055, 0x9ba9aa);
      }
      for (const x of [-7, 7]) { interior.cylinder(x, 2.43, 0, .033, 2.55, 0xb7c3bd); interior.box(x, 3.57, 0, 1.0, .07, 2.9, 0xb7c3bd); }
      const inside = interior.mesh('rail-interior-' + index); inside.castShadow = false; group.add(inside);
      const windows = [[rear + .1, doors[0] - .77], [doors[0] + .77, doors[1] - .77], [doors[1] + .77, front - .1]].filter(a => a[1] > a[0]);
      const panes = new T.InstancedMesh(unitPlane, glass, windows.length * 2); panes.name = 'rail-windows-' + index;
      let paneIndex = 0;
      for (const side of [-1, 1]) for (const [a, b] of windows) panes.setMatrixAt(paneIndex++, localMatrix((a + b) / 2, 2.72, side * 1.635, b - a, 1.06, 1));
      panes.computeBoundingBox(); panes.computeBoundingSphere(); group.add(panes);
      D.box(0, 2.19, 0, .65, 2.12, .07, 0xaebdc0);
      D.box(0, 2.76, -.045, .43, .69, .015, 0x3c6171);
      D.box(0, 1.44, -.045, .57, .12, .014, 0xc14346);
      D.box(.22, 2.0, -.06, .045, .23, .035, 0x3f5058);
      const doorTemplate = D.mesh('rail-door-template-' + index), doorMesh = new T.InstancedMesh(doorTemplate.geometry, opaque, doors.length * 4);
      doorMesh.name = 'rail-doors-' + index; doorMesh.userData.carIndex = index; doorMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); group.add(doorMesh);
      let headlights, taillights;
      if (cab) {
        headlights = new T.InstancedMesh(unitCylinder, lampWhite, 2); headlights.name = 'rail-headlights-' + index;
        taillights = new T.InstancedMesh(unitCylinder, lampRed, 2); taillights.name = 'rail-taillights-' + index;
        for (let i = 0; i < 2; i++) { const z = i ? .58 : -.58;
          headlights.setMatrixAt(i, localMatrix(noseSign * 12.68, 1.87, z, .31, .08, .31, 0, 0, Math.PI / 2));
          taillights.setMatrixAt(i, localMatrix(noseSign * 12.69, 1.55, z, .18, .08, .18, 0, 0, Math.PI / 2));
        }
        headlights.computeBoundingBox(); headlights.computeBoundingSphere(); taillights.computeBoundingBox(); taillights.computeBoundingSphere();
        group.add(headlights, taillights);
      }
      root.add(group); const car = { group, doors, doorMesh, headlights, taillights, noseSign, index, inside, panes };
      cars.push(car); return car;
    }
    for (let i = 0; i < 5; i++) makeCar(i);

    function update(args = {}) {
      if (disposed) return;
      root.visible = args.visible !== false; if (!root.visible) return;
      const train = rt.train(), poses = rt.carPoses(), station = train.state === 'dwell' ? rt.route.stations[train.stationIndex] : null;
      const platformSide = station?.platformSide || 1, open = clamp(finite(train.doorOpen), 0, 1);
      const quality = args.quality || options.quality || 'high', camera = args.camera;
      const viewDistance = quality === 'low' ? 520 : quality === 'medium' ? 760 : 1050;
      if (camera?.position) {
        const cp = camera.position;
        for (const chunk of chunks) { const c = chunk.userData.center; chunk.visible = Math.hypot(cp.x - c.x, cp.z - c.z) < viewDistance + chunk.userData.radius; }
        for (const group of stations) { const st = rt.route.stations.find(s => s.id === group.userData.stationId); group.visible = !st || Math.hypot(cp.x - st.x, cp.z - st.y) < viewDistance + 120; }
      }
      cars.forEach((car, i) => {
        const q = poses[i]; if (!q) return;
        car.group.matrix.copy(pose(q.x, q.h, q.y, q.yaw, q.pitch)); car.group.matrixWorldNeedsUpdate = true;
        if (car.lastDoorOpen !== open || car.lastPlatformSide !== platformSide) {
          let n = 0;
          for (const side of [-1, 1]) for (const x of car.doors) for (const leaf of [-1, 1]) {
            const spread = side === platformSide ? open * .62 : 0;
            car.doorMesh.setMatrixAt(n++, localMatrix(x + leaf * (.34 + spread), 0, side * (1.68 + spread * .06), 1, 1, 1, 0, side > 0 ? Math.PI : 0, 0));
          }
          car.doorMesh.instanceMatrix.needsUpdate = true; car.doorMesh.computeBoundingBox(); car.doorMesh.computeBoundingSphere();
          car.lastDoorOpen = open; car.lastPlatformSide = platformSide;
        }
        car.doorMesh.userData.doorOpen = open; car.doorMesh.userData.platformSide = platformSide;
        if (car.headlights) { car.headlights.visible = train.direction === car.noseSign; car.taillights.visible = train.direction !== car.noseSign; }
        car.inside.visible = !!args.boarded || !camera?.position || Math.hypot(camera.position.x - q.x, camera.position.z - q.y) < 130;
      });
      root.userData.direction = train.direction; root.userData.speed = train.speed; root.userData.doorOpen = open;
    }
    function dispose() {
      if (disposed) return;
      disposed = true; root.removeFromParent();
      root.traverse(o => { if (o.isInstancedMesh && typeof o.dispose === 'function') o.dispose(); });
      for (const g of geometry) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose();
      root.clear(); stats.disposed = true;
    }
    update({ quality: options.quality });
    root.traverse(o => { if (!o.isMesh) return; stats.drawObjects++; const n = o.geometry.index?.count || o.geometry.attributes.position?.count || 0; stats.triangles += n / 3 * (o.isInstancedMesh ? o.count : 1); });
    return { root, update, dispose, stats, colliders };
  }
  global.HanQContinentalRailAssets = Object.freeze({ version: 1, floorHeight: FLOOR, trainHalfWidth: HALF_WIDTH, collisionSpecs, build });
})(typeof window !== 'undefined' ? window : globalThis);
