/* Continental shuttle: deterministic route planning and an analytical timetable.
 * No Three.js dependency, random draws, world edits, or wall-clock timers.
 * x/y are native map coordinates; h is absolute rail-top height. yaw points
 * along increasing route distance. Only station platforms/ramps are walkable
 * terrain extensions: the elevated line never raises roads underneath it.
 */
(() => {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 1;
  const CAR_OFFSETS = Object.freeze([-52, -26, 0, 26, 52]);
  const C = Object.freeze({
    maxSpeed: 22, acceleration: .9, braking: 1.1, intermediateDwell: 18,
    terminalDwell: 24, halfTrain: 65.21, platformLength: 148,
    platformWidth: 7.5, platformOffset: 6, floorHeight: 1.12,
    flatHalf: 80, railClearance: 7, maxGrade: .05, rampWidth: 4,
  });
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const finite = (x, fallback = 0) => Number.isFinite(x) ? x : fallback;
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const segmentDistance = (x, y, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
  };
  function segmentHitsBox(a, b, box, pad = 0) {
    let lo = 0, hi = 1;
    for (const [p, d, min, max] of [[a.x, b.x - a.x, box.x0 - pad, box.x1 + pad], [a.y, b.y - a.y, box.y0 - pad, box.y1 + pad]]) {
      if (Math.abs(d) < 1e-10) { if (p < min || p > max) return false; }
      else {
        const x = (min - p) / d, y = (max - p) / d;
        lo = Math.max(lo, Math.min(x, y)); hi = Math.min(hi, Math.max(x, y));
        if (lo > hi) return false;
      }
    }
    return true;
  }

  function create({ getGround, world = {}, bridge = null, mapSize = 2048, _choices = [0, 0, 0, 0] } = {}) {
    if (typeof getGround !== 'function') throw new TypeError('Continental rail requires native getGround(x,y).');
    const ground = (x, y) => finite(getGround(x, y), -26);
    const cellSize = 48, cells = new Map(), obstacles = [];
    const addObstacle = o => {
      obstacles.push(o);
      for (let iy = Math.floor(o.y0 / cellSize); iy <= Math.floor(o.y1 / cellSize); iy++)
        for (let ix = Math.floor(o.x0 / cellSize); ix <= Math.floor(o.x1 / cellSize); ix++) {
          const key = ix + ':' + iy; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(o);
        }
    };
    // Retain destroyed geometry in the planning input so reloading a damaged
    // world cannot move its railway. Nothing is written to the source objects.
    for (const r of world.rects || []) {
      if (![r.x, r.y, r.w, r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0) continue;
      const top = finite(r.gy, ground(r.x + r.w / 2, r.y + r.h / 2)) + Math.max(finite(r.hgt, 2), finite(r.floorTop) + 1);
      addObstacle({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h, top });
    }
    const seenTrees = new Set();
    for (const o of [...(world.circles || []), ...(world.trees || [])]) {
      if (![o.x, o.y].every(Number.isFinite)) continue;
      if (o.kind === 'tree' || o.canopy) {
        const key = o.x + ':' + o.y; if (seenTrees.has(key)) continue; seenTrees.add(key);
      }
      const r = Math.max(finite(o.r, .3), finite(o.canopy) + (o.canopy ? .45 : 0));
      const top = finite(o.gy, ground(o.x, o.y)) + Math.max(finite(o.height), finite(o.hgt, 2));
      addObstacle({ x0: o.x - r, x1: o.x + r, y0: o.y - r, y1: o.y + r, x: o.x, y: o.y, r, top });
    }
    const query = box => {
      const found = new Set();
      for (let iy = Math.floor(box.y0 / cellSize); iy <= Math.floor(box.y1 / cellSize); iy++)
        for (let ix = Math.floor(box.x0 / cellSize); ix <= Math.floor(box.x1 / cellSize); ix++)
          for (const o of cells.get(ix + ':' + iy) || []) found.add(o);
      return found;
    };
    const overlap = (o, box, pad = 0) => {
      if (o.r) return Math.hypot(o.x - clamp(o.x, box.x0 - pad, box.x1 + pad), o.y - clamp(o.y, box.y0 - pad, box.y1 + pad)) <= o.r;
      return o.x1 >= box.x0 - pad && o.x0 <= box.x1 + pad && o.y1 >= box.y0 - pad && o.y0 <= box.y1 + pad;
    };
    const clearBox = (box, pad = .7) => {
      const expanded = { x0: box.x0 - pad, x1: box.x1 + pad, y0: box.y0 - pad, y1: box.y1 + pad };
      for (const o of query(expanded)) if (overlap(o, box, pad)) return false;
      return true;
    };
    const roads = (world.roads || []).filter(r => [r.x1, r.y1, r.x2, r.y2].every(Number.isFinite))
      .map(r => ({ a: { x: r.x1, y: r.y1 }, b: { x: r.x2, y: r.y2 }, radius: Math.max(3.5, finite(r.width) / 2) }));
    if (bridge && Number.isFinite(bridge.x1) && Number.isFinite(bridge.z)) {
      const nodes = [{ x: bridge.x1, y: bridge.z }, { x: Math.max(bridge.x1 + 120, 400), y: bridge.z }, { x: 610, y: 1165 }, { x: 736, y: 1176 }];
      for (let i = 1; i < nodes.length; i++) roads.push({ a: nodes[i - 1], b: nodes[i], radius: 12.5 });
    }
    const roadsClear = box => roads.every(r => !segmentHitsBox(r.a, r.b, box, r.radius + 1));
    const roadClear = (x, y, radius = 1.4) => roads.every(r => segmentDistance(x, y, r.a, r.b) > r.radius + radius + 1)
      && clearBox({ x0: x - radius, x1: x + radius, y0: y - radius, y1: y + radius }, .15);
    const dryBox = (box, margin = 1.5) => {
      for (let x = box.x0; x <= box.x1 + .01; x += Math.min(8, box.x1 - box.x0 || 1))
        for (const y of [box.y0, (box.y0 + box.y1) / 2, box.y1]) if (ground(x, y) < margin) return false;
      return ground(box.x1, box.y0) >= margin && ground(box.x1, box.y1) >= margin;
    };
    const nearestRegion = (id, fallback) => (world.regions || []).find(r => r.id === id) || fallback;
    const city = nearestRegion('city', { x: 864, y: 1016, bounds: { x: 704, y: 856, w: 320, h: 320 } });
    const desert = nearestRegion('desert', { x: 1320, y: 1270 });
    const citySouth = city.bounds ? city.bounds.y + city.bounds.h : city.y + 160;
    const westY = finite(bridge?.z, 1150) + 34, eastY = desert.y + 38;
    let westShore = 180;
    for (let x = 70; x < 650; x += 4) {
      if (dryBox({ x0: x, x1: x + 24, y0: westY - 16, y1: westY + 16 })) { westShore = x; break; }
    }
    let eastShore = mapSize - 280;
    for (let x = mapSize - 50; x > desert.x + 220; x -= 4) {
      if (dryBox({ x0: x - 24, x1: x, y0: eastY - 16, y1: eastY + 16 })) { eastShore = x; break; }
    }
    const targets = [
      { id: 'west-bridge', name: '서부 연결교역', x: Math.max(finite(bridge?.x1, westShore - 30) + 118, westShore + 88), y: westY, preferredSide: 1 },
      { id: 'central-city', name: '센트럴 시티역', x: city.x, y: citySouth + 22, preferredSide: 1 },
      { id: 'red-sand', name: '붉은모래역', x: desert.x, y: desert.y - 6, preferredSide: -1 },
      { id: 'east-terminal', name: '동부 종착역', x: eastShore - 88, y: eastY, preferredSide: -1 },
    ];
    const offsets = [0]; for (let n = 12; n <= 144; n += 12) offsets.push(n, -n);
    const candidateLists = targets.map((t, index) => {
      const candidates = [];
      const lateralOptions = index === 0 ? [0, 8, -8, 16, -16, 24, -24, 32, -32, 40, -40, 56, -56, 72, -72] : [0, 8, -8, 16, -16, 24, -24];
      function collect(lateral) {
        for (const dy of lateral) for (const dx of offsets) for (const side of [t.preferredSide, -t.preferredSide]) {
          const x = t.x + dx, y = t.y + dy;
          if (index === 0 && (x - 86 < westShore || x > t.x + 132)) continue;
          if (index === 3 && (x + 86 > eastShore || x < t.x - 72)) continue;
          if (index === 1 && y < citySouth + 16) continue;
          const py = y + side * C.platformOffset;
          const box = { x0: x - C.platformLength / 2, x1: x + C.platformLength / 2, y0: py - C.platformWidth / 2, y1: py + C.platformWidth / 2 };
          if (!clearBox(box) || !roadsClear(box) || !dryBox({ x0: x - 86, x1: x + 86, y0: y - 12, y1: y + 12 })) continue;
          candidates.push({ ...t, x, y, platformSide: side, box, score: dx * dx + dy * dy * 4 + (side === t.preferredSide ? 0 : 16), index });
        }
      }
      collect(lateralOptions);
      // Preserve every established candidate and its sorting/choice indices.
      // Some native seeds put roads or trees across the entire narrow search
      // band. Only a previously impossible station may search farther inland
      // along Y; all coast, dry-land, road and obstacle checks still apply.
      if (!candidates.length) {
        const extended = [];
        for (let dy = 32; dy <= 144; dy += 8) for (const value of [dy, -dy]) if (!lateralOptions.includes(value)) extended.push(value);
        collect(extended);
      }
      candidates.sort((a, b) => a.score - b.score || a.x - b.x || a.y - b.y || b.platformSide - a.platformSide);
      if (!candidates.length) throw new Error('No unobstructed mainland platform location for ' + t.name);
      return candidates;
    });
    const stationSeeds = candidateLists.map((list, i) => list[_choices[i]] || list[0]);
    // Local obstacle elevations and road clearance produce a bounded-gradient
    // viaduct without flattening terrain, consuming RNG, or deleting buildings.
    function pathY(x) {
      if (x <= stationSeeds[0].x + C.flatHalf) return stationSeeds[0].y;
      for (let i = 1; i < stationSeeds.length; i++) {
        const a = stationSeeds[i - 1], b = stationSeeds[i], x0 = a.x + C.flatHalf, x1 = b.x - C.flatHalf;
        if (x < x1) return mix(a.y, b.y, ease(clamp((x - x0) / (x1 - x0), 0, 1)));
        if (x <= b.x + C.flatHalf) return b.y;
      }
      return stationSeeds[3].y;
    }
    const firstX = stationSeeds[0].x - 86, lastX = stationSeeds[3].x + 86;
    const xs = new Set([firstX, lastX]);
    for (let x = firstX; x < lastX; x += 2) xs.add(x);
    for (const st of stationSeeds) for (const dx of [-C.flatHalf, 0, C.flatHalf]) xs.add(st.x + dx);
    const points = [...xs].sort((a, b) => a - b).map(x => {
      const y = pathY(x), native = ground(x, y), box = { x0: x - 3, x1: x + 3, y0: y - 3.2, y1: y + 3.2 };
      let required = Math.max(native, ground(x, y - 3.2), ground(x, y + 3.2)) + C.railClearance;
      for (const o of query(box)) if (overlap(o, box, .4)) required = Math.max(required, o.top + 1.7);
      return { s: 0, x, y, h: required, required, ground: native, nativeH: native };
    });
    const flats = stationSeeds.map(st => points.map((p, i) => Math.abs(p.x - st.x) <= C.flatHalf + 1e-6 ? i : -1).filter(i => i >= 0));
    // The plateau constraint and the Lipschitz envelope converge by monotonic
    // max propagation; no height ever falls below its original clearance.
    for (let pass = 0; pass < 12; pass++) {
      let changed = false;
      for (const group of flats) {
        let level = Math.max(...group.map(i => points[i].h));
        const st = stationSeeds[flats.indexOf(group)];
        for (let x = st.box.x0; x <= st.box.x1; x += 5) for (const y of [st.box.y0, st.box.y1]) level = Math.max(level, ground(x, y) + C.railClearance);
        for (const i of group) if (points[i].h < level - 1e-9) { points[i].h = level; changed = true; }
      }
      for (let i = 1; i < points.length; i++) {
        const needed = points[i - 1].h - C.maxGrade * distance(points[i - 1], points[i]);
        if (points[i].h < needed - 1e-9) { points[i].h = needed; changed = true; }
      }
      for (let i = points.length - 2; i >= 0; i--) {
        const needed = points[i + 1].h - C.maxGrade * distance(points[i + 1], points[i]);
        if (points[i].h < needed - 1e-9) { points[i].h = needed; changed = true; }
      }
      if (!changed) break;
    }
    for (let i = 1; i < points.length; i++) points[i].s = points[i - 1].s + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y, points[i].h - points[i - 1].h);
    const length = points[points.length - 1].s;
    function sample(s) {
      s = clamp(finite(s), 0, length);
      let lo = 0, hi = points.length - 1;
      while (lo + 1 < hi) { const m = (lo + hi) >> 1; if (points[m].s <= s) lo = m; else hi = m; }
      const a = points[lo], b = points[hi], k = (s - a.s) / (b.s - a.s || 1), dx = b.x - a.x, dy = b.y - a.y;
      return { s, x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), h: mix(a.h, b.h, k), yaw: Math.atan2(dy, dx), pitch: Math.atan2(b.h - a.h, Math.hypot(dx, dy)), ground: mix(a.ground, b.ground, k) };
    }
    function makeRamp(st) {
      const candidates = [];
      const starts = [0, 28, -28, 50, -50].map(along => ({
        x: st.x + along, y: st.y + st.platformSide * (C.platformOffset + C.platformWidth / 2 - .3),
        ux: 0, uy: st.platformSide, along,
      }));
      for (const direction of [1, -1]) starts.push({ x: st.x + direction * (C.platformLength / 2 - .3), y: st.y + st.platformSide * C.platformOffset, ux: direction, uy: 0, along: direction * C.platformLength / 2 });
      for (const option of starts) {
        const { ux, uy, along } = option, nx = -uy, ny = ux;
        const start = { x: option.x, y: option.y, h: st.h + C.floorHeight };
        for (let L = 24; L <= 192; L += 8) {
          const end = { x: start.x + ux * L, y: start.y + uy * L, h: 0 };
          end.h = Math.max(ground(end.x, end.y), ground(end.x - nx * C.rampWidth / 2, end.y - ny * C.rampWidth / 2), ground(end.x + nx * C.rampWidth / 2, end.y + ny * C.rampWidth / 2)) + .025;
          const rise = start.h - end.h;
          if (rise < .2 || rise / L > .23 || end.h < 1.5 || end.h - ground(end.x, end.y) > .32) continue;
          const box = { x0: Math.min(start.x, end.x) - Math.abs(nx) * C.rampWidth / 2, x1: Math.max(start.x, end.x) + Math.abs(nx) * C.rampWidth / 2, y0: Math.min(start.y, end.y) - Math.abs(ny) * C.rampWidth / 2, y1: Math.max(start.y, end.y) + Math.abs(ny) * C.rampWidth / 2 };
          if (!clearBox(box, .6) || !roadsClear(box)) continue;
          let good = true;
          for (let d = 0; d <= L; d += 2) {
            const t = d / L, x = mix(start.x, end.x, t), y = mix(start.y, end.y, t), h = mix(start.h, end.h, t);
            for (const offset of [-C.rampWidth / 2, 0, C.rampWidth / 2]) if (ground(x + nx * offset, y + ny * offset) > h + .08 || ground(x + nx * offset, y + ny * offset) < .8) { good = false; break; }
            if (!good) break;
          }
          if (good) { candidates.push({ start, end, width: C.rampWidth, length: L, along, score: L + Math.abs(along) * .18 }); break; }
        }
      }
      candidates.sort((a, b) => a.score - b.score);
      if (candidates.length) return candidates[0];
      // A bounded, deterministic pedestrian ramp search handles vegetation and
      // road approaches that make a single straight ramp impossible. Cardinal
      // four-metre spans meet with overlapping full-width landings. The path
      // stays on the platform's side of the railway, including at its ends.
      const queue = [], visited = new Set(), step = 4, half = C.rampWidth / 2;
      const key = (x, y) => x + ':' + y;
      const floorAt = (x, y) => Math.max(ground(x, y), ground(x - half, y), ground(x + half, y), ground(x, y - half), ground(x, y + half)) + .025;
      const safeEdge = (a, b) => {
        const box = { x0: Math.min(a.x, b.x) - half, x1: Math.max(a.x, b.x) + half, y0: Math.min(a.y, b.y) - half, y1: Math.max(a.y, b.y) + half };
        if (!clearBox(box, .6) || !roadsClear(box)) return false;
        for (const k of [0, .5, 1]) {
          const x = mix(a.x, b.x, k), y = mix(a.y, b.y, k);
          if (st.platformSide * (y - pathY(clamp(x, firstX, lastX))) < 5.5) return false;
          if (ground(x, y) < 1.5) return false;
        }
        return true;
      };
      for (const option of starts) {
        const start = { x: option.x, y: option.y, h: st.h + C.floorHeight };
        const x = Math.round((start.x + option.ux * step) / step) * step, y = Math.round((start.y + option.uy * step) / step) * step;
        const end = { x, y, h: 0 }, L = distance(start, end);
        end.h = Math.max(floorAt(x, y), start.h - .22 * L);
        if (!L || Math.abs(end.h - start.h) > .23 * L || !safeEdge(start, end)) continue;
        const id = key(x, y); if (visited.has(id)) continue; visited.add(id);
        queue.push({ ...end, parent: null, origin: start, travelled: L });
      }
      for (let head = 0; head < queue.length && head < 6000; head++) {
        const q = queue[head], native = ground(q.x, q.y);
        if (q.travelled > 20 && q.h - native <= .28 && q.h - floorAt(q.x, q.y) < .035) {
          const chain = []; for (let p = q; p; p = p.parent) chain.push({ x: p.x, y: p.y, h: p.h }); chain.reverse(); chain.unshift(q.origin);
          const segments = [];
          for (let i = 1; i < chain.length; i++) {
            const a = chain[i - 1], b = chain[i], previous = segments[segments.length - 1];
            const slope = (b.h - a.h) / distance(a, b);
            if (previous) {
              const ax = previous.end.x - previous.start.x, ay = previous.end.y - previous.start.y, bx = b.x - a.x, by = b.y - a.y;
              const oldSlope = (previous.end.h - previous.start.h) / distance(previous.start, previous.end);
              if (Math.abs(ax * by - ay * bx) < 1e-7 && ax * bx + ay * by > 0 && Math.abs(oldSlope - slope) < 1e-6) { previous.end = b; continue; }
            }
            segments.push({ start: a, end: b, width: C.rampWidth });
          }
          return { start: chain[0], end: chain[chain.length - 1], width: C.rampWidth, length: q.travelled, segments };
        }
        // The station's outward direction is tried first, then east/west,
        // with inward detours last. No loop can be added merely to lose height.
        const dirs = [[0, st.platformSide], [1, 0], [-1, 0], [0, -st.platformSide]];
        for (const [dx, dy] of dirs) {
          const x = q.x + dx * step, y = q.y + dy * step, id = key(x, y);
          if (visited.has(id) || Math.abs(x - st.x) > 196 || Math.abs(y - st.y) > 196) continue;
          if (x < 4 || y < 4 || x > mapSize - 4 || y > mapSize - 4) continue;
          const next = { x, y, h: Math.max(floorAt(x, y), q.h - .22 * step) };
          if (Math.abs(next.h - q.h) > .23 * step + 1e-9 || !safeEdge(q, next)) continue;
          // Exact midspan clearance matters on uneven terrain, not just nodes.
          const middleH = (q.h + next.h) / 2;
          if (floorAt((q.x + x) / 2, (q.y + y) / 2) > middleH + .03) continue;
          visited.add(id); queue.push({ ...next, parent: q, origin: q.origin, travelled: q.travelled + step });
        }
      }
      return null;
    }
    let missingRamp = -1;
    const stations = stationSeeds.map((st, index) => {
      const p = points.find(p => p.x === st.x), station = {
        id: st.id, name: st.name, index, s: p.s, x: st.x, y: st.y, h: p.h, yaw: 0, pitch: 0,
        platformSide: st.platformSide, platformLength: C.platformLength, platformWidth: C.platformWidth,
        platformOffset: C.platformOffset, platformHeight: C.floorHeight,
        dwellSeconds: index === 0 || index === 3 ? C.terminalDwell : C.intermediateDwell,
        platform: { x: st.x, y: st.y + st.platformSide * C.platformOffset, h: p.h + C.floorHeight, length: C.platformLength, width: C.platformWidth, yaw: 0 },
      };
      station.ramp = makeRamp(station);
      if (!station.ramp && missingRamp < 0) missingRamp = index;
      station.entry = station.ramp ? { ...station.ramp.end } : null;
      station.boarding = { x: st.x + 8.5, y: st.y + st.platformSide * 3.2, h: station.platform.h };
      station.exit = { x: st.x + 8.5, y: st.y + st.platformSide * 4, h: station.platform.h };
      return station;
    });
    if (missingRamp >= 0) {
      const choices = _choices.slice(); choices[missingRamp]++;
      if (choices[missingRamp] >= Math.min(candidateLists[missingRamp].length, 24)) throw new Error('No unobstructed station access ramp for ' + targets[missingRamp].name);
      return create({ getGround, world, bridge, mapSize, _choices: choices });
    }
    const route = { points, length, stations, name: '대륙 횡단선', version: VERSION, units: 'metres', axis: 'native-x-y-height', trainLength: C.halfTrain * 2 };

    function motion(distance) {
      const peak = Math.min(C.maxSpeed, Math.sqrt(2 * distance / (1 / C.acceleration + 1 / C.braking)));
      const accelerate = peak / C.acceleration, brake = peak / C.braking;
      const accelDistance = peak * peak / (2 * C.acceleration), brakeDistance = peak * peak / (2 * C.braking);
      const cruise = Math.max(0, (distance - accelDistance - brakeDistance) / peak);
      return { peak, accelerate, brake, cruise, accelDistance, brakeDistance, duration: accelerate + cruise + brake, distance };
    }
    const timetable = [], visits = [0, 1, 2, 3, 2, 1]; let cursor = 0;
    for (let v = 0; v < visits.length; v++) {
      const index = visits[v], next = visits[(v + 1) % visits.length], direction = next > index ? 1 : -1, dwell = stations[index].dwellSeconds;
      timetable.push({ type: 'dwell', start: cursor, end: cursor + dwell, stationIndex: index, nextStationIndex: next, direction }); cursor += dwell;
      const run = motion(Math.abs(stations[next].s - stations[index].s));
      timetable.push({ type: 'travel', start: cursor, end: cursor + run.duration, stationIndex: index, nextStationIndex: next, direction, ...run }); cursor += run.duration;
    }
    const cycleSeconds = cursor;
    let state = { version: VERSION, elapsed: 0, boarded: false };
    function attach(s) {
      if (!s || typeof s !== 'object') throw new TypeError('attach requires native game state.');
      const previous = s.railway && typeof s.railway === 'object' ? s.railway : {};
      const clean = {};
      for (const [key, value] of Object.entries(previous)) if (value === null || ['string', 'boolean'].includes(typeof value) || typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
      clean.version = VERSION; clean.elapsed = Math.max(0, finite(previous.elapsed)); clean.boarded = previous.boarded === true;
      s.railway = clean; state = clean; return runtime;
    }
    const phaseTime = () => { const t = finite(state.elapsed) % cycleSeconds; return t < 0 ? t + cycleSeconds : t; };
    function train() {
      const at = phaseTime(), leg = timetable.find(q => at < q.end) || timetable[timetable.length - 1], t = at - leg.start;
      let s = stations[leg.stationIndex].s, speed = 0, doorOpen = 0;
      if (leg.type === 'dwell') {
        doorOpen = Math.min(smooth((t - .6) / .85), 1 - smooth((t - (leg.end - leg.start - 2)) / .9));
      } else {
        let travelled;
        if (t < leg.accelerate) { speed = C.acceleration * t; travelled = C.acceleration * t * t / 2; }
        else if (t < leg.accelerate + leg.cruise) { speed = leg.peak; travelled = leg.accelDistance + leg.peak * (t - leg.accelerate); }
        else { const remaining = Math.max(0, leg.end - at); speed = C.braking * remaining; travelled = leg.distance - C.braking * remaining * remaining / 2; }
        s += leg.direction * clamp(travelled, 0, leg.distance);
      }
      return { ...sample(s), direction: leg.direction, speed, state: leg.type, stationIndex: leg.stationIndex, nextStationIndex: leg.nextStationIndex, doorOpen, remaining: Math.max(0, leg.end - at), phaseElapsed: t, cycleSeconds };
    }
    function tick(dt) { if (Number.isFinite(dt) && dt > 0) state.elapsed += dt; return train(); }
    function carPoses() {
      const tr = train();
      return CAR_OFFSETS.map((offset, index) => {
        const p = sample(tr.s + offset), a = sample(p.s - 7.4), b = sample(p.s + 7.4);
        return { ...p, index, offset, yaw: Math.atan2(b.y - a.y, b.x - a.x), pitch: Math.atan2(b.h - a.h, distance(a, b)), noseSign: index === 0 ? -1 : index === 4 ? 1 : 0, direction: tr.direction };
      });
    }
    function platformAt(x, y) {
      for (const st of stations) {
        const p = st.platform;
        if (Math.abs(x - p.x) <= p.length / 2 && Math.abs(y - p.y) <= p.width / 2) return p.h;
      }
      return undefined;
    }
    function surfaceAt(x, y) {
      const platform = platformAt(x, y); if (platform !== undefined) return platform;
      let height;
      for (const st of stations) {
        for (const r of st.ramp.segments || [st.ramp]) {
          const a = r.start, b = r.end;
          // Every ramp rectangle fits inside its segment bounds expanded by
          // half its width. Read live endpoints rather than caching public,
          // mutable route objects; keep a tiny conservative boundary margin.
          const half = r.width / 2, pad = half + 1e-7;
          if ((x < a.x - pad && x < b.x - pad) || (x > +a.x + pad && x > +b.x + pad) ||
              (y < a.y - pad && y < b.y - pad) || (y > +a.y + pad && y > +b.y + pad)) continue;
          const dx = b.x - a.x, dy = b.y - a.y, squared = dx * dx + dy * dy, t = ((x - a.x) * dx + (y - a.y) * dy) / squared;
          if (!(t >= 0 && t <= 1)) continue;
          const offset = Math.abs((x - a.x) * dy - (y - a.y) * dx) / Math.sqrt(squared);
          if (offset <= half) height = Math.max(height ?? -Infinity, mix(a.h, b.h, t));
        }
      }
      return height;
    }
    const stationFor = i => stations[clamp(Math.trunc(finite(i)), 0, stations.length - 1)];
    function nextArrival(i) {
      const st = stationFor(i), at = phaseTime();
      const active = timetable.find(q => at < q.end);
      if (active?.type === 'dwell' && active.stationIndex === st.index) return 0;
      return Math.min(...timetable.filter(q => q.type === 'dwell' && q.stationIndex === st.index).map(q => (q.start - at + cycleSeconds) % cycleSeconds));
    }
    // Waiting and onboard travel use the same forward-only timetable. Arrive
    // two seconds into a real stop so the doors are fully open, including at
    // terminals and after a reversal. A closing stop is never wound backwards.
    // Planning is read-only; applying a plan changes only the train's clock.
    function planArrival(i) {
      if (!Number.isInteger(i) || i < 0 || i >= stations.length || !Number.isFinite(state.elapsed) || state.elapsed < 0) return null;
      const current = train();
      if (current.state === 'dwell' && current.stationIndex === i && current.doorOpen > .8)
        return { stationIndex: i, direction: current.direction, elapsed: state.elapsed, waitSeconds: 0 };
      const at = phaseTime();
      let best = null;
      for (const leg of timetable) {
        if (leg.type !== 'dwell' || leg.stationIndex !== i) continue;
        const waitSeconds = (leg.start + 2 - at + cycleSeconds) % cycleSeconds;
        if (!best || waitSeconds < best.waitSeconds)
          best = { stationIndex: i, direction: leg.direction, elapsed: state.elapsed + waitSeconds, waitSeconds };
      }
      return best;
    }
    function skipToStation(i) {
      const plan = planArrival(i);
      if (!plan) return null;
      state.elapsed = plan.elapsed;
      return plan;
    }
    function nearestStation(x, y) {
      let best, nearest = Infinity;
      for (const st of stations) { const d = Math.hypot(x - st.x, y - st.y); if (d < nearest) { best = st; nearest = d; } }
      return { ...best, distance: nearest };
    }
    const runtime = { version: VERSION, route, cycleSeconds, timetable, constants: C, getGround: ground, roadClear, attach, tick, train, sample, carPoses, platformAt, surfaceAt, nearestStation, nextArrival, planArrival, skipToStation,
      safeExit: i => ({ ...stationFor(i).exit }), boardingPoint: i => ({ ...stationFor(i).boarding }),
      get state() { return state; },
    };
    return runtime;
  }
  root.HanQContinentalRail = Object.freeze({ version: VERSION, create });
})();
