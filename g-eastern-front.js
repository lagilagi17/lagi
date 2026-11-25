/* Eastern front: deterministic, additive campaign state and native collision.
 * Coordinates: x/y are the host game's horizontal axes; h is height.
 * No host RNG, clock, indexed save object, DOM, or THREE dependency is touched.
 */
(function (global) {
  'use strict';
  const SCHEMA = 'hanq.eastern-front.v1';
  const CAPTURE_SECONDS = 18, RECLAIM_GRACE = 180, RECLAIM_SECONDS = 60;
  const REINFORCE_SECONDS = 120, REPLACEMENT_DELAY = 20, CELL = 32;
  const MARCH_SPEED = 5, AMBIENT_DAMAGE = 0, FRONT_SIZE = 6;
  const ENEMY_REPLACEMENT_DELAY = 180, ENEMY_REPLACEMENT_INTERVAL = 30,
    ENEMY_REPLACEMENT_CAP = 6, ENEMY_REPLACEMENT_EXCLUSION = 520, ENEMY_MARCH_SPEED = 2.6;
  const PATROL_SPEED = 1.65, PATROL_RADIUS = 6;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const mix = (a, b, t) => a + (b - a) * t;
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const EMPTY_BUCKET = Object.freeze([]);
  function project(x, y, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return { t, distance: Math.hypot(x - mix(a.x, b.x, t), y - mix(a.y, b.y, t)) };
  }
  function decodeHeights(encoded) {
    if (encoded instanceof Float32Array) return encoded;
    if (Array.isArray(encoded)) return new Float32Array(encoded);
    const binary = (typeof atob === 'function' ? atob : global.atob)(encoded), bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Float32Array(bytes.buffer);
  }
  function decodeHistoryValues(encoded, Type) {
    if (encoded instanceof Type) return encoded;
    if (Array.isArray(encoded)) return new Type(encoded);
    const binary = (typeof atob === 'function' ? atob : global.atob)(encoded), bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Type(bytes.buffer);
  }
  function gridHeight(grid, x, z) {
    if (z < grid.rows[0] || z > grid.rows[grid.nz]) return undefined;
    let lo = 0, hi = grid.nz;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (grid.rows[mid] <= z) lo = mid; else hi = mid; }
    const v = (z - grid.rows[lo]) / (grid.rows[hi] - grid.rows[lo] || 1);
    const left = mix(grid.left[lo], grid.left[hi], v), right = mix(grid.right[lo], grid.right[hi], v);
    if (x < left - .001 || x > right + .001 || right - left < .0001) return undefined;
    const i = clamp(Math.floor((x - left) / (right - left) * grid.nx), 0, grid.nx - 1);
    const ix = (row, col) => Math.fround(mix(grid.left[row], grid.right[row], col / grid.nx));
    const ax = ix(lo, i), bx = ix(lo, i + 1), cx = ix(hi, i), dx = ix(hi, i + 1);
    const az = grid.rows[lo], cz = grid.rows[hi], a = lo * (grid.nx + 1) + i, b = a + 1, c = a + grid.nx + 1, d = c + 1;
    function triangle(x0, z0, h0, x1, z1, h1, x2, z2, h2) {
      const den = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
      if (Math.abs(den) < 1e-10) return undefined;
      const w0 = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / den;
      const w1 = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / den;
      if (w0 < -.001 || w1 < -.001 || w0 + w1 > 1.001) return undefined;
      return w0 * h0 + w1 * h1 + (1 - w0 - w1) * h2;
    }
    const first = triangle(ax, az, grid.heights[a], cx, cz, grid.heights[c], bx, az, grid.heights[b]);
    const height = first === undefined ? triangle(bx, az, grid.heights[b], cx, cz, grid.heights[c], dx, cz, grid.heights[d]) : first;
    return height === undefined ? undefined : { height, cellX: (ax + dx) * .5, cellZ: (az + cz) * .5 };
  }
  function spatialIndex(objects, getBounds) {
    const bins = new Map();
    let minCellX = Infinity, maxCellX = -Infinity, minCellY = Infinity, maxCellY = -Infinity;
    for (const o of objects) {
      const b = getBounds(o);
      minCellX = Math.min(minCellX, Math.floor(b.minX / CELL)); maxCellX = Math.max(maxCellX, Math.floor(b.maxX / CELL));
      minCellY = Math.min(minCellY, Math.floor(b.minY / CELL)); maxCellY = Math.max(maxCellY, Math.floor(b.maxY / CELL));
      for (let ix = Math.floor(b.minX / CELL); ix <= Math.floor(b.maxX / CELL); ix++) {
        for (let iy = Math.floor(b.minY / CELL); iy <= Math.floor(b.maxY / CELL); iy++) {
          const key = ix + ',' + iy; let bin = bins.get(key); if (!bin) bins.set(key, bin = []); bin.push(o);
        }
      }
    }
    return {
      at(x, y, r = 0) {
        if (!r) return bins.get(Math.floor(x / CELL) + ',' + Math.floor(y / CELL)) || EMPTY_BUCKET;
        // Most body/point samples lie inside one cell. Return its read-only
        // bucket directly; none of the collision consumers mutate the result.
        const minX = Math.floor((x - r) / CELL), maxX = Math.floor((x + r) / CELL);
        const minY = Math.floor((y - r) / CELL), maxY = Math.floor((y + r) / CELL);
        if (minX === maxX && minY === maxY) return bins.get(minX + ',' + minY) || EMPTY_BUCKET;
        const seen = new Set(), answer = [];
        for (let ix = minX; ix <= maxX; ix++) {
          for (let iy = minY; iy <= maxY; iy++) {
            for (const o of bins.get(ix + ',' + iy) || EMPTY_BUCKET) if (!seen.has(o)) { seen.add(o); answer.push(o); }
          }
        }
        return answer;
      },
      along(a, b) {
        if (!bins.size) return EMPTY_BUCKET;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (![a.x, a.y, b.x, b.y, dx, dy].every(finite)) return EMPTY_BUCKET;
        // Clip to the indexed region first, so even a very long sight ray
        // visits only the finite battlefield grid. Fixed-distance samples can
        // skip a short cell-corner crossing and let shots pass through walls.
        let enter = 0, leave = 1;
        for (const [origin, delta, lo, hi] of [[a.x, dx, minCellX * CELL, (maxCellX + 1) * CELL],
          [a.y, dy, minCellY * CELL, (maxCellY + 1) * CELL]]) {
          if (!delta) { if (origin < lo || origin > hi) return EMPTY_BUCKET; continue; }
          const t0 = (lo - origin) / delta, t1 = (hi - origin) / delta;
          enter = Math.max(enter, Math.min(t0, t1)); leave = Math.min(leave, Math.max(t0, t1));
          if (enter > leave) return EMPTY_BUCKET;
        }
        const x0 = mix(a.x, b.x, enter), y0 = mix(a.y, b.y, enter);
        const x1 = mix(a.x, b.x, leave), y1 = mix(a.y, b.y, leave);
        let ix = Math.floor(x0 / CELL), iy = Math.floor(y0 / CELL);
        const endX = Math.floor(x1 / CELL), endY = Math.floor(y1 / CELL);
        const walkX = x1 - x0, walkY = y1 - y0;
        const stepX = Math.sign(walkX), stepY = Math.sign(walkY), seen = new Set(), answer = [];
        const deltaX = walkX ? CELL / Math.abs(walkX) : Infinity, deltaY = walkY ? CELL / Math.abs(walkY) : Infinity;
        let nextX = walkX ? (((stepX > 0 ? ix + 1 : ix) * CELL - x0) / walkX) : Infinity;
        let nextY = walkY ? (((stepY > 0 ? iy + 1 : iy) * CELL - y0) / walkY) : Infinity;
        const visit = (x, y) => {
          for (const o of bins.get(x + ',' + y) || EMPTY_BUCKET) if (!seen.has(o)) { seen.add(o); answer.push(o); }
        };
        visit(ix, iy);
        // A supercover visits both side cells at a corner: a tangent collision
        // on either side is still an exact hit, not an empty diagonal shortcut.
        const maxSteps = Math.abs(endX - ix) + Math.abs(endY - iy) + 2;
        for (let i = 0; (ix !== endX || iy !== endY) && i < maxSteps; i++) {
          if (Math.abs(nextX - nextY) <= 1e-12) {
            visit(ix + stepX, iy); visit(ix, iy + stepY);
            ix += stepX; iy += stepY; nextX += deltaX; nextY += deltaY;
          } else if (nextX < nextY) { ix += stepX; nextX += deltaX; }
          else { iy += stepY; nextY += deltaY; }
          visit(ix, iy);
        }
        return answer;
      }
    };
  }
  function create(options = {}) {
    const data = options.data || (global.HanQEasternFrontAssets && global.HanQEasternFrontAssets.data);
    if (!data || !data.viewerLayout || !Array.isArray(data.terrainGrids) || !data.terrainGrids.length) throw new Error('Eastern front geometry data is unavailable.');
    const mapSize = finite(options.mapSize) ? options.mapSize : 2048;
    if (mapSize !== 2048) throw new Error('Eastern front requires the approved 2048m mainland.');
    const seaLevel = finite(options.seaLevel) ? options.seaLevel : 0;
    const offsets = { x: 1024, z: 1024, h: seaLevel + 10 };
    const bounds = { minX: 2048, maxX: 3072, minY: -1024, maxY: 3072, width: 1024, height: 4096 };
    const mainGrid = data.terrainGrids.find(g => g.kind === 'main');
    const grids = data.terrainGrids.map(g => ({ ...g, heights: decodeHeights(g.heightsBase64 || g.heights) }));
    const roadGradeRepair = data.roadGradeRepair || null;
    const roadGradeRevision = typeof roadGradeRepair?.revision === 'string' ? roadGradeRepair.revision : null;
    // An untagged save predates the first central-road repair. A tagged
    // central-road save needs its own complete old terrain, not the sparse
    // edits of that earlier repair applied to today's network earthwork.
    const roadGradeSources = new Map(), roadGradeHistories = new Map();
    let roadGradeSharedTerrain, roadGradeSharedRoads;
    if (roadGradeRepair) roadGradeSources.set(null, roadGradeRepair);
    for (const record of roadGradeRepair?.history || []) if (typeof record.revision === 'string' && record.revision !== roadGradeRevision)
      roadGradeSources.set(record.revision, record);
    const bridgeSurfaces = (data.bridgeSurfaces || []).map(g => ({ ...g, heights: decodeHeights(g.heightsBase64 || g.heights),
      legacyHeights: g.legacyHeightsBase64 ? decodeHeights(g.legacyHeightsBase64) : null }));
    const main = grids.find(g => g.kind === 'main'), patches = grids.filter(g => g.kind === 'patch');
    if (!main || !mainGrid) throw new Error('Eastern front main terrain is unavailable.');
    const nativeGround = typeof options.getNativeGround === 'function' ? options.getNativeGround : null;
    const nativeBlocked = typeof options.getNativeBlocked === 'function' ? options.getNativeBlocked : null;
    const inBounds = (x, y) => x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
    // Terrain is immutable within a runtime. The native solid query asks for
    // terrain and then surface at the same exact point; reuse just that sample,
    // without quantizing coordinates or accumulating a world-size cache.
    let terrainX, terrainY, terrainHeight;
    function baseTerrain(x, y) {
      if (x === terrainX && y === terrainY) return terrainHeight;
      terrainX = x; terrainY = y;
      return terrainHeight = sampleBaseTerrain(x, y);
    }
    function sampleBaseTerrain(x, y) {
      return sampleGridTerrain(main, patches, x, y);
    }
    function sampleGridTerrain(main, patches, x, y) {
      if (!inBounds(x, y)) return undefined;
      const vx = x - offsets.x, vz = y - offsets.z;
      const m = gridHeight(main, vx, vz); let height;
      if (m && !patches.some(p => Math.abs(m.cellX - p.x) < p.r - 7 && Math.abs(m.cellZ - p.z) < p.r - 7)) height = m.height;
      for (const p of patches) {
        if (Math.abs(vx - p.x) > p.r || Math.abs(vz - p.z) > p.r) continue;
        const sample = gridHeight(p, vx, vz); if (sample) height = height === undefined ? sample.height : Math.max(height, sample.height);
      }
      return height === undefined ? seaLevel - 25 : height + offsets.h;
    }
    const layout = { ...data.viewerLayout, mode: 'campaign', structureOnly: false, bounds, points: data.viewerLayout.points.map(p => ({
      ...p, viewerX: p.x, viewerZ: p.z, x: p.x + offsets.x, y: p.z + offsets.z,
      h: data.pointY[p.id] + offsets.h, z: p.z + offsets.z,
      global: { x: p.x + offsets.x, y: p.z + offsets.z }
    })) };
    // Territory revisions are independent of the v1 combat-save schema. An
    // unversioned snapshot belongs to the original west/east deployment.
    const layoutRevision = typeof layout.territorySplit?.id === 'string' ? layout.territorySplit.id : null;
    // Tag each roster generation so a missing appended tail cannot be mistaken
    // for a complete historical save.
    const outpostRevision = 'field-outposts-v1';
    const rosterRevision = 'garrison-growth-v1';
    const combatRevision = 'frontline-logistics-v1';
    const patrolRevision = 'player-led-patrol-20261123-v1';
    let patrolMigrationApplied = false;
    const routeData = options.routes || global.HanQEasternFrontRoutes || null;
    const combatEnabled = !!routeData && routeData.schema === 'hanq.eastern-front.routes.v1' && !!routeData.anchors && Array.isArray(routeData.edges);
    const routeGeometryRevision = combatEnabled && routeData.geometryRevision === 'iron-bridge-20261123-v1' ? routeData.geometryRevision : null;
    const routeObstacleRevision = combatEnabled && routeData.obstacleRevision === 'natural-rocks-20261123-v1' ? routeData.obstacleRevision : null;
    const routeWalkingRevision = combatEnabled && routeData.walkingRevision === 'walkable-slopes-20261124-v1' ? routeData.walkingRevision : null;
    let routeGeometryMigrationApplied = false, roadGradeMigrationApplied = false, routeRepairs = [];
    // Index passages once for posture queries and save recovery. Keep the
    // old/new floor interval, rather than lifting every person below the
    // surface (which could move an intentional lower-level actor).
    const trenchCuts = (data.trenchCuts || []).filter(c =>
      c.profileRevision === 'trench-cover-20261123-v1' && Array.isArray(c.points) &&
      [c.y, c.floorOffset, c.coverOffset, c.legacyDepth, c.legacyFloorOffset, c.halfWidth].every(finite)).map(c => ({
        floorHeight: c.y + offsets.h + c.floorOffset,
        coverHeight: c.y + offsets.h + c.coverOffset,
        legacyFloorHeight: c.y + offsets.h + c.legacyFloorOffset,
        legacyBottom: c.y + offsets.h - c.legacyDepth,
        profileRevision: c.profileRevision, siteId: c.site,
        halfWidth: c.halfWidth,
        points: c.points.map(p => ({ x: p.x + offsets.x, y: p.z + offsets.z }))
      }));
    const trenchRevision = trenchCuts.length ? 'trench-cover-20261123-v1' : null;
    const trenchSegments = trenchCuts.flatMap(cut => cut.points.slice(1).map((b, i) => ({ cut, a: cut.points[i], b })));
    // A network may contain several authored cuts. Compute connectivity once
    // from their body-width walking corridors, not merely the shared site ID.
    // The same site can have separate trenches or another floor far below it.
    // IDs are derived runtime data; no asset or saved object gains new fields.
    (function connectTrenchCuts() {
      const parent=trenchCuts.map((_,i)=>i);
      const segments=trenchCuts.map(cut=>cut.points.slice(1).map((b,i)=>({a:cut.points[i],b})));
      function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
      function segmentDistance(a,b,c,d){
        const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
        if(Math.abs(den)>1e-10){
          const dx=c.x-a.x,dy=c.y-a.y,t=(dx*sy-dy*sx)/den,u=(dx*ry-dy*rx)/den;
          if(t>=0&&t<=1&&u>=0&&u<=1)return 0;
        }
        return Math.min(project(a.x,a.y,c,d).distance,project(b.x,b.y,c,d).distance,
          project(c.x,c.y,a,b).distance,project(d.x,d.y,a,b).distance);
      }
      for(let i=0;i<trenchCuts.length;i++)for(let j=i+1;j<trenchCuts.length;j++){
        const a=trenchCuts[i],b=trenchCuts[j],ra=a.halfWidth-.42,rb=b.halfWidth-.42;
        if(a.siteId!==b.siteId||Math.abs(a.floorHeight-b.floorHeight)>1e-4||ra<=0||rb<=0)continue;
        const ai=root(i),bi=root(j);if(ai===bi)continue;
        const overlaps=segments[i].some(p=>segments[j].some(q=>segmentDistance(p.a,p.b,q.a,q.b)<ra+rb-1e-4));
        if(overlaps)parent[Math.max(ai,bi)]=Math.min(ai,bi);
      }
      for(let i=0;i<trenchCuts.length;i++)trenchCuts[i].networkId=root(i);
    })();
    const trenchIndex = spatialIndex(trenchSegments, ({ cut, a, b }) => ({
      minX: Math.min(a.x, b.x) - cut.halfWidth, maxX: Math.max(a.x, b.x) + cut.halfWidth,
      minY: Math.min(a.y, b.y) - cut.halfWidth, maxY: Math.max(a.y, b.y) + cut.halfWidth
    }));
    function trenchAt(x, y) {
      if (!finite(x) || !finite(y)) return null;
      for (const { cut, a, b } of trenchIndex.at(x, y))
        if (project(x, y, a, b).distance <= cut.halfWidth - .42) return cut;
      return null;
    }
    const siteMap = new Map(), memberMap = new Map(), membersBySite = new Map(), neighbours = new Map();
    const externalDefenders = new Map(), externalVehicles = new Map();
    let clock = 0, events = [], battlePulse = 0, layoutMigrationApplied = false, rosterMigrationApplied = false, combatMigrationApplied = false;
    let enemyReplacementAt = 0, enemyReplacementScanAt = 0;
    let enemyMarchQueueDirty = true, enemyMarchPermits = new Set(), enemyMarchingCount = 0;
    const sites = layout.points.map(p => {
      const site = { ...p, owner: p.initialOwner, initialOwner: p.initialOwner, capture: 0, pressure: 0,
        absent: 0, changedAt: 0, graceUntil: 0, garrisonEpoch: 0, playerImpact: false,
        everCaptured: false, rewardClaimed: false, warningIssued: false, defeatedInfantry: 0, count: 0 };
      siteMap.set(site.id, site); membersBySite.set(site.id, []); neighbours.set(site.id, []); return site;
    });
    for (const edge of layout.edges) { neighbours.get(edge.a).push(edge.b); neighbours.get(edge.b).push(edge.a); }
    const weaponByRole = { rifle: 'ar', machinegun: 'm249', sniper: 'sniper', antitank: 'rpg', medic: 'ar', mortar: 'pistol', rocket: 'ar', officer: 'pistol', engineer: 'ar', radio: 'ar' };
    const roster = data.roster.map((r, index) => {
      const member = { ...r, weaponName: r.weapon, weapon: weaponByRole[r.role] || 'ar', x: r.x + offsets.x, y: r.z + offsets.z,
        h: r.y + offsets.h, z: r.z + offsets.z, initialTeam: r.team, index, hp: 100, dead: false,
        life: 0, availableAt: 0, diedAt: 0, byPlayer: false };
      memberMap.set(member.id, member); membersBySite.get(member.siteId).push(member); siteMap.get(member.siteId).count++; return member;
    });
    // Historical IDs and native actor indices remain a stable prefix. New
    // guards are appended only after the original poses have been validated.
    const authoredRoster = [...roster];
    const emplacements = (data.emplacements || []).map(e => ({ ...e, x: e.x + offsets.x, y: e.z + offsets.z, h: e.y + offsets.h,
      get team() { return siteMap.get(e.siteId)?.owner || e.team; },
      muzzle: { x: e.muzzle.x + offsets.x, y: e.muzzle.z + offsets.z, h: e.muzzle.y + offsets.h },
      target: { x: e.target.x + offsets.x, y: e.target.z + offsets.z, h: e.target.y + offsets.h } }));
    const vehicleSpawns = (data.vehicleSpawns || []).map(v => ({ ...v,
      x: v.x + offsets.x, y: v.z + offsets.z, h: v.y + offsets.h,
      heading: -v.rotation - Math.PI / 2,
      boardingPath: (v.boardingPath||[]).map(p=>({x:p.x+offsets.x,y:p.z+offsets.z,h:p.y+offsets.h})),
      get team() { return siteMap.get(v.siteId)?.owner || v.team; } }));
    function convertBox(b) {
      const c = Math.cos(b.ry || 0), s = Math.sin(b.ry || 0);
      return { ...b, x: b.x + offsets.x, y: b.z + offsets.z, h: b.y + offsets.h,
        ...(finite(b.surfaceFloor) ? { surfaceFloor: b.surfaceFloor + offsets.h } : {}),
        ...(finite(b.surfaceCeiling) ? { surfaceCeiling: b.surfaceCeiling + offsets.h } : {}),
        height: finite(b.height) ? b.height + offsets.h : b.y + b.hy + offsets.h,
        cos: c, sin: s, minX: b.x + offsets.x - Math.abs(c * b.hx) - Math.abs(s * b.hz),
        maxX: b.x + offsets.x + Math.abs(c * b.hx) + Math.abs(s * b.hz),
        minY: b.z + offsets.z - Math.abs(s * b.hx) - Math.abs(c * b.hz),
        maxY: b.z + offsets.z + Math.abs(s * b.hx) + Math.abs(c * b.hz),
        base: b.y + offsets.h - b.hy, hgt: b.hy * 2 };
    }
    const collisionBoxes = [...(data.collisionBoxes || []).filter(b => !b.mobileLauncher && !b.disabled), ...(data.movementBarriers || [])].map(convertBox);
    const surfaceBoxes = (data.surfaceBoxes || []).filter(b => !b.mobileLauncher && !b.disabled).map(convertBox);
    let collisionIndex = spatialIndex(collisionBoxes, b => b), surfaceIndex = spatialIndex(surfaceBoxes, b => b);
    let facilityColliders = [], facilitySurfaces = [], facilityColliderGroups = new Map(), surfaceGeometryRevision = 0;
    // Surface masks are external to the deterministic campaign/save graph.
    // Native OBBs remain the first collision test; a restored mask is looked up
    // by stable authored ID, so reloading never requires replaying an impact.
    const surfaceIds = new WeakMap(), surfaceSpecs = new WeakMap(), configuredSurfaceOwners = new WeakSet();
    const getDestruction = typeof options.getSurfaceDestruction === 'function' ? options.getSurfaceDestruction : () => null;
    function facilitySurfaceKind(b) {
      if (!b || typeof b.facilityId !== 'string' || typeof b.id !== 'string') return null;
      const prefix = 'ef-facility:' + b.facilityId + ':';
      if (!b.id.startsWith(prefix)) return null;
      const part = b.id.slice(prefix.length);
      if (/^roof(?:-\d+)?$/.test(part)) return 'roof';
      return ['back', 'left', 'right', 'front-left', 'front-right', 'lintel'].includes(part) ? 'wall' : null;
    }
    function eligibleSurface(b) {
      if (!b || typeof b.id !== 'string' || (b.shape && b.shape !== 'box') || b.mobileLauncher || b.bodyOnly || b.disabled) return false;
      // Service buildings have their own render batches and stable IDs. Keep
      // their foundations, steps and stocked equipment available after a hit.
      if (facilitySurfaceKind(b)) return true;
      // The complete trench label also contains walking boards, exit stairs
      // and a dugout roof. Admit only cover explicitly tagged by the unchanged
      // authored builder; enabling that label wholesale would cut its floor.
      if (trenchSurface(b)) return true;
      return b.id.startsWith('efc-') &&
        (siteMap.get(b.siteId)?.type !== 'bridge' || b.label === 'Reinforced concrete bunker') &&
        !/bridge|boarding|pier|launcher|tank|rock|tree|trunk|recessed zigzag trench/i.test(b.label || '');
    }
    function trenchSurface(b) {
      return !!b && b.id?.startsWith('efc-') && !b.roof && finite(b.surfaceFloor) &&
        (b.surfaceRole === 'trench-wall' || b.surfaceRole === 'trench-sandbag');
    }
    function surfaceId(b) {
      if (!b || typeof b !== 'object') return null;
      if (surfaceIds.has(b)) return surfaceIds.get(b);
      const id = eligibleSurface(b) ? 'eastern:' + b.id : null; surfaceIds.set(b, id); return id;
    }
    function surfaceDescriptor(b) {
      const id = surfaceId(b); if (!id) return null;
      if (surfaceSpecs.has(b)) return surfaceSpecs.get(b);
      const floor = b.hy <= Math.min(b.hx, b.hz) * .6 && (b.walkable || b.kind === 'surface');
      const trench = trenchSurface(b), facilityKind = facilitySurfaceKind(b), kind = trench ? 'wall' : facilityKind || (b.roof ? 'roof' : floor ? 'floor' : 'wall');
      // Existing upgraded roof skins sit up to 0.65m above their old baked
      // support collider. Only their vertical visual shell gets 0.8m allowance;
      // horizontal bounds and physical support remain the authored OBB.
      // All baked batches use Float32 vertices. A millimetre tolerance keeps
      // rounded faces from surviving as opaque sheets over a physical hole.
      // Upgraded outpost side walls have metal cladding 0.225m outside their
      // original shell. Include it only along the thin wall normal, keeping
      // the wall ends, roof and neighboring support out of that allowance.
      const visualPadding = trench ? .18 : .001;
      const outpostCladding = kind === 'wall' && siteMap.get(b.siteId)?.type === 'outpost' && b.label === b.siteId && b.hgt > 3 && Math.min(b.hx, b.hz) < .5;
      // Observation-screen badges sit 0.06m in front of the wooden backing.
      // Their territory material stays shared so capture colors still update.
      const towerBadge = kind === 'wall' && b.label === 'Braced observation tower' && b.hgt < 2 && b.hx >= 3 && b.hz < .2;
      const skinPadding = outpostCladding ? .226 : towerBadge ? .061 : visualPadding;
      const visualHalfX = b.hx + (b.hx < b.hz ? skinPadding : visualPadding);
      const visualHalfZ = b.hz + (b.hz <= b.hx ? skinPadding : visualPadding);
      const verticalVisualHalf = b.hy + (kind === 'floor' || kind === 'roof' ? .8 : 0) + visualPadding;
      const visualClipPlanes = [];
      for (const [normal, half] of [[{ x: b.cos, y: 0, z: -b.sin }, visualHalfX], [{ x: 0, y: 1, z: 0 }, verticalVisualHalf], [{ x: b.sin, y: 0, z: b.cos }, visualHalfZ]]) {
        const d = normal.x * b.x + normal.y * b.h + normal.z * b.y;
        visualClipPlanes.push({ normal, constant: d + half }, { normal: { x: -normal.x, y: -normal.y, z: -normal.z }, constant: -d + half });
      }
      const spec = { id, region: 'eastern', kind, visualClipPlanes,
        ...(trench ? { protectedHeightBands: [{ min: b.base - 1, max: b.surfaceFloor + .025 },
          ...(finite(b.surfaceCeiling) ? [{ min: b.surfaceCeiling, max: b.base + b.hgt + .3 }] : [])] } : {}),
        // A rotated OBB has no AABB-shaped interior: its authored triangles
        // supply edge thickness; generated box caps are only valid at 90deg.
        solidVolume: Math.min(Math.abs(b.sin), Math.abs(b.cos)) < 1e-6,
        bounds: { min: { x: b.minX, y: b.base, z: b.minY }, max: { x: b.maxX, y: b.base + b.hgt, z: b.maxY } } };
      surfaceSpecs.set(b, spec); return spec;
    }
    function getSurfaceOwner(b, create = false) {
      const id = surfaceId(b); if (!id) return null;
      const shared = getDestruction(); if (!shared) return null;
      let owner = shared.getOwner(id);
      if (owner && !configuredSurfaceOwners.has(owner)) {
        const descriptor = surfaceDescriptor(b);
        // Canonical protection is reapplied to restored masks before either
        // collision or render binding sees them; save records are not policy.
        if ((!descriptor.protectedHeightBands || shared.setProtectedHeightBands?.(owner, descriptor.protectedHeightBands)) &&
          shared.setVisualClipPlanes?.(owner, descriptor.visualClipPlanes)) configuredSurfaceOwners.add(owner);
      }
      if (!owner && create) { owner = shared.register(surfaceDescriptor(b)); if (owner) configuredSurfaceOwners.add(owner); }
      return owner;
    }
    function surfacePointSolid(b, x, y, h, radius = 0) {
      const owner = getSurfaceOwner(b); if (!owner?.cuts.length) return true;
      const shared = getDestruction();
      if (!radius) return shared.isPointSolid(owner, { x, y: h, z: y });
      return shared.bodyBlocked(owner, { min: { x: x - radius, y: h - .001, z: y - radius },
        max: { x: x + radius, y: h + .001, z: y + radius } });
    }
    function surfaceBodySolid(b, x, y, bottom, top, radius) {
      const owner = getSurfaceOwner(b); if (!owner?.cuts.length) return true;
      const epsilon = radius ? 0 : 1e-6;
      return getDestruction().bodyBlocked(owner, { min: { x: x - radius - epsilon, y: bottom, z: y - radius - epsilon },
        max: { x: x + radius + epsilon, y: top, z: y + radius + epsilon } });
    }
    function survivingSurfaceHeight(b, x, y, radius, height) {
      const owner = getSurfaceOwner(b); if (!owner?.cuts.length) return height;
      const shared = getDestruction();
      const sample = (sx, sy) => insideBox(b, sx, sy, 0) ? shared.supportAt(owner, sx, sy, height + .01) : undefined;
      const center = sample(x, y); if (finite(center)) return Math.min(height, center);
      if (!radius) return undefined;
      if (!insideBox(b, x, y, 0)) {
        // Preserve the existing leading-edge step onto an intact low riser.
        const dx = x - b.x, dz = y - b.y;
        const lx = clamp(b.cos * dx - b.sin * dz, -b.hx + 1e-6, b.hx - 1e-6);
        const lz = clamp(b.sin * dx + b.cos * dz, -b.hz + 1e-6, b.hz - 1e-6);
        return sample(b.x + b.cos * lx + b.sin * lz, b.y - b.sin * lx + b.cos * lz);
      }
      // A body centred over a hole needs three supporting edge samples. This
      // cannot bridge a metre-wide opening with a normal 0.42m capsule.
      const r = radius * .8, heights = [sample(x + r, y), sample(x - r, y), sample(x, y + r), sample(x, y - r)].filter(finite);
      if (heights.length < 3) return undefined;
      heights.sort((a, b) => b - a); return Math.min(height, heights[2]);
    }
    function closestSurfacePoint(b, point) {
      const dx = point.x - b.x, dz = point.z - b.y;
      const lx = clamp(b.cos * dx - b.sin * dz, -b.hx, b.hx);
      const lz = clamp(b.sin * dx + b.cos * dz, -b.hz, b.hz);
      return { x: b.x + b.cos * lx + b.sin * lz, y: clamp(point.y, b.base, b.base + b.hgt), z: b.y - b.sin * lx + b.cos * lz };
    }
    function surfaceIntersectsCut(b, point, radius) {
      // Four separating axes give the exact horizontal OBB/AABB overlap. The
      // same cube is used for visual subtraction and every admitted collider.
      const dx = point.x - b.x, dz = point.z - b.y, c = Math.abs(b.cos), s = Math.abs(b.sin);
      return Math.abs(point.y - b.h) <= radius + b.hy && Math.abs(dx) <= radius + c * b.hx + s * b.hz &&
        Math.abs(dz) <= radius + s * b.hx + c * b.hz &&
        Math.abs(b.cos * dx - b.sin * dz) <= b.hx + radius * (c + s) &&
        Math.abs(b.sin * dx + b.cos * dz) <= b.hz + radius * (c + s);
    }
    function damageSurfaces(point, radius = 6, amount = 100) {
      const report = { changed: false, broken: 0, walls: 0, floors: 0, refused: 0, ids: [] };
      if (!point || ![point.x, point.y, point.z, radius, amount].every(finite) || radius <= 0 || amount <= 0) return report;
      const shared = getDestruction(); if (!shared || typeof options.bindSurfaceVisuals !== 'function') return report;
      const localRadius = clamp(radius * .31, 1.05, 2.1), seen = new Set(), candidates = [];
      for (const b of collisionIndex.at(point.x, point.z, localRadius + .1)) {
        if (!surfaceIntersectsCut(b, point, localRadius)) continue;
        const id = surfaceId(b);
        if (!id) continue;
        if (seen.has(id)) continue; seen.add(id);
        const q = closestSurfacePoint(b, point), distance = Math.hypot(q.x - point.x, q.y - point.y, q.z - point.z);
        candidates.push({ b, distance });
      }
      candidates.sort((a, b) => a.distance - b.distance);
      // Each visual void is also clipped to this owner's six OBB planes.
      // Budgeted neighbors stay visible and solid, even in one merged batch.
      const commit = () => {
        for (const { b } of candidates.slice(0, 16)) {
          const existing = getSurfaceOwner(b), owner = existing || getSurfaceOwner(b, true);
          if (!owner) { report.refused++; continue; }
          let bound = false;
          try { bound = options.bindSurfaceVisuals(owner, b) === true; } catch (_) { bound = false; }
          if (!bound || owner.visualUnsupported) {
            if (!existing) shared.unregisterEmpty?.(owner);
            report.refused++; continue;
          }
          shared.setOwnerVisible?.(owner, true);
          // Local world boxes penetrate normal thickness without cutting a
          // rotated long wall through its entire enclosing AABB.
          const hit = shared.damage(owner, point, localRadius, null, { local: true });
          if (!hit.changed) { if (!existing && !owner.cuts.length) shared.unregisterEmpty?.(owner); continue; }
          report.changed = true; report.broken++; report.ids.push(owner.id);
          if (owner.kind === 'floor' || owner.kind === 'roof') report.floors++; else report.walls++;
        }
      };
      if (typeof shared.batch === 'function') shared.batch(commit); else commit();
      // Parked vehicles cache the exact reachable support query. A successful
      // cut changes that support even when their position and prior height do not.
      if (report.changed) surfaceGeometryRevision++;
      return report;
    }
    function restoreSurfaceDamage() {
      const shared = getDestruction(); if (!shared || typeof options.bindSurfaceVisuals !== 'function') return 0;
      let bound = 0;
      for (const b of [...collisionBoxes, ...facilityColliders]) {
        const owner = getSurfaceOwner(b); if (!owner?.cuts.length) continue;
        try { if (options.bindSurfaceVisuals(owner, b) === true) { shared.setOwnerVisible?.(owner, true); bound++; } } catch (_) {}
      }
      // Restoration can also remove all cuts. Invalidate even when no damaged
      // owner remains to bind, so an old hole/floor result cannot survive repair.
      surfaceGeometryRevision++;
      return bound;
    }
    function unbindSurfaceVisuals() {
      const shared = getDestruction(); if (!shared) return 0;
      let released = 0;
      // A reset owner has no exported cuts but may still retain a bound mesh.
      // This lifecycle-only scan must release those refs as well as live holes.
      for (const b of [...collisionBoxes, ...facilityColliders]) {
        const id = surfaceId(b), owner = id && shared.getOwner(id); if (!owner) continue;
        shared.unbindVisuals(owner); shared.setOwnerVisible?.(owner, false); released++;
      }
      return released;
    }
    function unbindFacilitySurfaceVisuals() {
      const shared = getDestruction(); if (!shared) return 0;
      let released = 0;
      for (const b of facilityColliders) {
        const id = surfaceId(b), owner = id && shared.getOwner(id); if (!owner) continue;
        shared.unbindVisuals(owner); shared.setOwnerVisible?.(owner, false); released++;
      }
      return released;
    }
    function setFacilitySurfaceVisible(id, visible, roofVisible = visible) {
      const boxes = facilityColliderGroups.get(id); if (!boxes) return;
      const shared = getDestruction(); if (!shared) return;
      for (const b of boxes) {
        const surface = surfaceId(b), owner = surface && shared.getOwner(surface);
        if (owner) shared.setOwnerVisible?.(owner, !!visible && (owner.kind !== 'roof' || !!roofVisible));
      }
    }
    function setFacilityGeometry(geometry) {
      if (!geometry || !Array.isArray(geometry.colliders) || !Array.isArray(geometry.surfaces) ||
          geometry.colliders.length > 4096 || geometry.surfaces.length > 4096) return false;
      function convertNativeBoxes(input) {
        const boxes = [], ids = new Set();
        for (const b of input) {
          if (!b || !['x', 'y', 'h', 'hx', 'hy', 'hz'].every(k => finite(b[k])) ||
              (b.ry !== undefined && !finite(b.ry)) || (b.roof !== undefined && typeof b.roof !== 'boolean') ||
              b.hx <= 0 || b.hy <= 0 || b.hz <= 0 || b.hx > 80 || b.hz > 80 || b.hy > 40 ||
              b.h - b.hy < seaLevel - 30 || b.h + b.hy > 600 ||
              (b.id !== undefined && (typeof b.id !== 'string' || !b.id || b.id.length > 160 || ids.has(b.id))) ||
              ['facilityId', 'siteId'].some(k => b[k] !== undefined && (typeof b[k] !== 'string' || !b[k] || b[k].length > 160))) return null;
          const ry = b.ry || 0, cos = Math.cos(ry), sin = Math.sin(ry);
          const dx = Math.abs(cos * b.hx) + Math.abs(sin * b.hz), dy = Math.abs(sin * b.hx) + Math.abs(cos * b.hz);
          if (b.x - dx < bounds.minX || b.x + dx > bounds.maxX || b.y - dy < bounds.minY || b.y + dy > bounds.maxY) return null;
          if (b.id !== undefined) ids.add(b.id);
          boxes.push({ id: b.id, ...(b.facilityId !== undefined ? { facilityId: b.facilityId } : {}),
            ...(b.siteId !== undefined ? { siteId: b.siteId } : {}), x: b.x, y: b.y, h: b.h, hx: b.hx, hy: b.hy, hz: b.hz, ry,
            roof: !!b.roof, height: b.h + b.hy, cos, sin,
            minX: b.x - dx, maxX: b.x + dx, minY: b.y - dy, maxY: b.y + dy,
            base: b.h - b.hy, hgt: b.hy * 2 });
        }
        return boxes;
      }
      const nextColliders = convertNativeBoxes(geometry.colliders), nextSurfaces = convertNativeBoxes(geometry.surfaces);
      if (!nextColliders || !nextSurfaces) return false;
      // Build both indexes before committing; replacing facilities must not
      // append duplicate walls or mutate the immutable authored geometry.
      const nextCollisionIndex = spatialIndex([...collisionBoxes, ...nextColliders], b => b);
      const nextSurfaceIndex = spatialIndex([...surfaceBoxes, ...nextSurfaces], b => b);
      const nextGroups = new Map();
      for (const b of nextColliders) if (facilitySurfaceKind(b)) {
        let group = nextGroups.get(b.facilityId); if (!group) nextGroups.set(b.facilityId, group = []); group.push(b);
      }
      // A repaired/relocated service placement must not inherit a world-space
      // void from the old location merely because its stable service ID matches.
      if (facilityColliders.length) {
        const shared = getDestruction(), nextById = new Map(nextColliders.map(b => [b.id, b]));
        if (shared) for (const b of facilityColliders) {
          const id = surfaceId(b), owner = id && shared.getOwner(id); if (!owner) continue;
          const next = nextById.get(b.id);
          if (!next || ['x', 'y', 'h', 'hx', 'hy', 'hz', 'ry'].some(k => Math.abs(next[k] - b[k]) > 1e-7)) {
            shared.resetOwner(owner); shared.unregisterEmpty?.(owner);
          }
        }
      }
      facilityColliders = nextColliders; facilitySurfaces = nextSurfaces;
      facilityColliderGroups = nextGroups;
      collisionIndex = nextCollisionIndex; surfaceIndex = nextSurfaceIndex;
      surfaceGeometryRevision++;
      return true;
    }
    const roads = (data.roadSegments || []).map((r, i) => ({ ...r, id: 'ef-road-' + i,
      a: { x: r.x1 + offsets.x, y: r.z1 + offsets.z }, b: { x: r.x2 + offsets.x, y: r.z2 + offsets.z },
      h1: r.y1 + offsets.h, h2: r.y2 + offsets.h }));
    // Add verified service access without changing any authored road, world
    // generation order, native indexed object, or saved route cursor.
    const accessRoads = options.accessRoads || (data === global.HanQEasternFrontAssets?.data ?
      global.HanQEasternFrontAssets.accessRoads : null) || [];
    for (const road of accessRoads) {
      if (!Array.isArray(road.samples) || !finite(road.width) || !finite(road.shoulder) || road.width <= 0) continue;
      if (road.samples.length < 2) continue;
      const first = road.samples[0], second = road.samples[1], last = road.samples.at(-1), previous = road.samples.at(-2);
      const caps = { start: { x: first.x + offsets.x, y: first.z + offsets.z, dx: second.x - first.x, dy: second.z - first.z },
        end: { x: last.x + offsets.x, y: last.z + offsets.z, dx: last.x - previous.x, dy: last.z - previous.z } };
      for (let i = 1; i < road.samples.length; i++) {
        const a = road.samples[i - 1], b = road.samples[i];
        if (![a.x, a.z, b.x, b.z].every(finite)) continue;
        roads.push({ id: 'ef-access-' + road.id + '-' + i, access: true, caps,
          width: road.width + road.shoulder * 2, offset: road.offset || 0,
          a: { x: a.x + offsets.x, y: a.z + offsets.z }, b: { x: b.x + offsets.x, y: b.z + offsets.z } });
      }
    }
    const roadIndex = spatialIndex(roads, r => ({ minX: Math.min(r.a.x, r.b.x) - r.width / 2, maxX: Math.max(r.a.x, r.b.x) + r.width / 2,
      minY: Math.min(r.a.y, r.b.y) - r.width / 2, maxY: Math.max(r.a.y, r.b.y) + r.width / 2 }));
    // Road support is baked from the actual ribbon vertices. Reconstruct X/Z
    // with the same Float32 rounding, then index short station pairs once.
    // Neither a crater-fill correction nor a cross slope is represented by a
    // centreline approximation; a query only visits its local spatial bucket.
    function buildRoadSupportSegments(supportGrids) {
      const segments = [];
      for (const grid of supportGrids || []) {
        if (!Array.isArray(grid.frames) || grid.frames.length < 2 || !Array.isArray(grid.bands)) continue;
        const bands = [];
        for (const band of grid.bands) {
          if (!Number.isInteger(band.columns) || band.columns < 2 || !finite(band.left) || !finite(band.right)) continue;
          const heights = decodeHeights(band.heightsBase64 || band.heights);
          if (heights.length !== grid.frames.length * band.columns) continue;
          const positions = new Float32Array(heights.length * 3);
          for (let row = 0; row < grid.frames.length; row++) {
            const f = grid.frames[row];
            for (let col = 0; col < band.columns; col++) {
              const lateral = mix(band.left, band.right, col / (band.columns - 1)), at = row * band.columns + col;
              positions[at * 3] = Math.fround(f.x + f.nx * lateral);
              positions[at * 3 + 1] = heights[at];
              positions[at * 3 + 2] = Math.fround(f.z + f.nz * lateral);
            }
          }
          bands.push({ columns: band.columns, positions });
        }
        if (!bands.length) continue;
        for (let row = 0; row + 1 < grid.frames.length; row++) {
          if (grid.allowed && !grid.allowed[row]) continue;
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const band of bands) for (const station of [row, row + 1]) for (const col of [0, band.columns - 1]) {
            const at = (station * band.columns + col) * 3, x = band.positions[at] + offsets.x, y = band.positions[at + 2] + offsets.z;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
          segments.push({ id: (String(grid.id).includes('S_HARBOR_ACCESS') ? 'ef-access-' : 'ef-road-') + grid.id + '-' + row,
            row, bands, minX, maxX, minY, maxY });
        }
      }
      return segments;
    }
    const roadSupportSegments = buildRoadSupportSegments(data.roadSupportGrids);
    const roadSupportIndex = spatialIndex(roadSupportSegments, r => r);
    function applyGradeTerrainEdits(base, records) {
      const edits = new Map((records || []).map(g => [g.index, g]));
      return base.map((g, index) => {
        const edit = edits.get(index); if (!edit) return g;
        const old = decodeHeights(edit.heightsBase64 || edit.heights);
        const indices = edit.vertexIndices || (edit.vertexIndicesBase64 && decodeHistoryValues(edit.vertexIndicesBase64, Uint32Array));
        if (edit.vertexMaskBase64) {
          const mask = decodeHistoryValues(edit.vertexMaskBase64, Uint8Array), heights = g.heights.slice(); let at = 0;
          for (let i = 0; i < heights.length; i++) if (mask[i >> 3] & (1 << (i & 7))) heights[i] = old[at++];
          return { ...g, heights };
        }
        if (!indices) return { ...g, heights: old };
        const heights = g.heights.slice();
        for (let i = 0; i < indices.length; i++) heights[indices[i]] = old[i];
        return { ...g, heights };
      });
    }
    function decodeGradeRoad(grid) {
      let frames = grid.frames;
      if (!frames && grid.framesBase64) {
        const values = decodeHistoryValues(grid.framesBase64, Float64Array); frames = [];
        for (let i = 0; i < values.length; i += 4) frames.push({ x: values[i], z: values[i + 1], nx: values[i + 2], nz: values[i + 3] });
      }
      let allowed = grid.allowed;
      if (!allowed && grid.allowedBase64) {
        const bits = decodeHistoryValues(grid.allowedBase64, Uint8Array);
        allowed = Array.from({ length: frames.length - 1 }, (_, i) => !!(bits[i >> 3] & (1 << (i & 7))));
      }
      return { ...grid, frames, allowed, bands: grid.bands.map(b => ({ ...b, heights: decodeHeights(b.heightsBase64 || b.heights) })) };
    }
    function applyGradeRoadEdits(base, records) {
      const roads = new Map(base.map(g => [g.id, g]));
      for (const record of records || []) {
        const edit = decodeGradeRoad(record), prior = roads.get(edit.id), start = edit.startFrame;
        if (!prior || !Number.isInteger(start)) { roads.set(edit.id, edit); continue; }
        // Central history stores only the changed station ranges of roads 0
        // and 2. Overlay those exact rows, retaining every unaffected station.
        const bands = prior.bands.map((band, index) => {
          const heights = band.heights.slice(); heights.set(edit.bands[index].heights, start * band.columns);
          return { ...band, heights, heightsBase64: undefined };
        });
        const allowed = [...prior.allowed];
        for (let i = 0; i < edit.allowed.length; i++) allowed[start + i] = edit.allowed[i];
        roads.set(edit.id, { ...prior, bands, allowed });
      }
      return [...roads.values()];
    }
    function roadGradeHistory(sourceRevision) {
      const revision = sourceRevision ?? null;
      if (!roadGradeRevision || revision === roadGradeRevision || !roadGradeSources.has(revision)) return null;
      if (roadGradeHistories.has(revision)) return roadGradeHistories.get(revision);
      const source = roadGradeSources.get(revision), record = { ...roadGradeRepair, ...source };
      if (!roadGradeSharedTerrain) roadGradeSharedTerrain = applyGradeTerrainEdits(grids, roadGradeRepair.legacyTerrainBase);
      if (!roadGradeSharedRoads) roadGradeSharedRoads = (roadGradeRepair.legacyRoadSupportBase || []).map(decodeGradeRoad);
      const oldGrids = applyGradeTerrainEdits(roadGradeSharedTerrain, record.legacyTerrainGrids);
      const beds = [];
      for (const corridor of record.corridors || []) {
        let points = corridor.points;
        if (!points && corridor.pointsBase64) {
          const values = decodeHistoryValues(corridor.pointsBase64, Float64Array); points = [];
          for (let i = 0; i < values.length; i += 2) points.push([values[i], values[i + 1]]);
        }
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1], b = points[i], radius = corridor.halfWidth;
          beds.push({ a, b, radius, minX: Math.min(a[0], b[0]) - radius, maxX: Math.max(a[0], b[0]) + radius,
            minY: Math.min(a[1], b[1]) - radius, maxY: Math.max(a[1], b[1]) + radius });
        }
      }
      const roads = applyGradeRoadEdits(roadGradeSharedRoads, record.legacyRoadSupportGrids), history = { record, beds: spatialIndex(beds, r => r),
        main: oldGrids.find(g => g.kind === 'main'), patches: oldGrids.filter(g => g.kind === 'patch'),
        roads: spatialIndex(buildRoadSupportSegments(roads), r => r),
        profiles: roads.map(g => ({ prefix: (String(g.id).includes('S_HARBOR_ACCESS') ? 'ef-access-' : 'ef-road-') + g.id + '-', offset: g.offset || 0 })) };
      roadGradeHistories.set(revision, history); return history;
    }
    function onGradedRoadBed(history, x, y) {
      const vx = x - offsets.x, vz = y - offsets.z;
      for (const { a, b, radius } of history.beds.at(vx, vz)) {
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const k = clamp(((vx - a[0]) * dx + (vz - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
        if (Math.hypot(vx - a[0] - dx * k, vz - a[1] - dz * k) <= radius) return true;
      }
      return false;
    }
    function roadTriangleHeight(x, y, positions, a, b, c) {
      a *= 3; b *= 3; c *= 3;
      const ax = positions[a], ay = positions[a + 2], bx = positions[b], by = positions[b + 2], cx = positions[c], cy = positions[c + 2];
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(den) < 1e-10) return undefined;
      const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / den;
      const v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / den;
      if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7) return undefined;
      return u * positions[a + 1] + v * positions[b + 1] + (1 - u - v) * positions[c + 1] + offsets.h;
    }
    function roadSupportAt(index, x, y, ceiling = Infinity) {
      const vx = x - offsets.x, vy = y - offsets.z;
      let bestHeight = -Infinity, bestId;
      for (const segment of index.at(x, y)) {
        if (x < segment.minX - 1e-6 || x > segment.maxX + 1e-6 || y < segment.minY - 1e-6 || y > segment.maxY + 1e-6) continue;
        for (const band of segment.bands) {
          const first = segment.row * band.columns;
          for (let col = 0; col + 1 < band.columns; col++) {
            const a = first + col, b = a + 1, c = a + band.columns, d = c + 1;
            let height = roadTriangleHeight(vx, vy, band.positions, a, c, b);
            if (height === undefined) height = roadTriangleHeight(vx, vy, band.positions, b, c, d);
            if (height !== undefined && height <= ceiling && height > bestHeight) { bestHeight = height; bestId = segment.id; }
          }
        }
      }
      return bestId === undefined ? null : { height: bestHeight, kind: 'road', id: bestId };
    }
    function roadSurfaceAt(x, y, ceiling = Infinity) {
      return roadSupportAt(roadSupportIndex, x, y, ceiling);
    }
    function roadBodyAt(x,y,bottom,top,radius=0){
      if(!roadSupportSegments.length||elevatedBridgeAt(x,y,radius)||trenchAt(x,y))return null;
      const ground=getTerrain(x,y);if(!finite(ground)||ground<seaLevel+.2||bottom>ground+4.2||top<ground+.025)return null;
      const road=roadSurfaceAt(x,y,ground+4.2);
      if(!road||road.height-ground<=.025||bottom>=road.height-.015)return null;
      // Ground-connected asphalt/ballast is a solid wearing course. It must
      // not admit a body beneath its rendered top; high bridges and trench
      // underpasses retain their separate finite slabs and lower layers.
      return {id:road.id,kind:'easternFrontRoad',shape:'road-fill',x,y,base:ground,height:road.height,hgt:road.height-ground};
    }
    function circleEllipse(x, z, a, b, r = 0) {
      x=Math.abs(x);z=Math.abs(z);
      if(a<1e-8||b<1e-8)return x*x+z*z<r*r;
      const a2=a*a,b2=b*b;
      if(x*x/a2+z*z/b2<=1)return true;
      if(!r||x>a+r||z>b+r)return false;
      // Closest point on an ellipse, not an expanded rectangle at its corners.
      let lo=0,hi=Math.hypot(a*x,b*z);
      for(let i=0;i<20;i++){const t=(lo+hi)/2;if(a2*x*x/(t+a2)**2+b2*z*z/(t+b2)**2>1)lo=t;else hi=t;}
      const dx=x-a2*x/(hi+a2),dz=z-b2*z/(hi+b2);
      return dx*dx+dz*dz<r*r;
    }
    function insideBox(b, x, y, r = 0) {
      const dx = x - b.x, dy = y - b.y, lx = b.cos * dx - b.sin * dy, lz = b.sin * dx + b.cos * dy;
      if(b.shape==='ellipsoid')return circleEllipse(lx,lz,b.hx,b.hz,r);
      return b.shape === 'cylinder' ? lx * lx + lz * lz <= ((b.r || Math.max(b.hx, b.hz)) + r) ** 2 : Math.abs(lx) <= b.hx + r && Math.abs(lz) <= b.hz + r;
    }
    function bodyHitsBox(b,x,y,bottom,top,r){
      const dx=x-b.x,dy=y-b.y,lx=b.cos*dx-b.sin*dy,lz=b.sin*dx+b.cos*dy;
      if(b.shape==='ellipsoid'){
        if(Math.abs(lx)>b.hx+r||Math.abs(lz)>b.hz+r)return false;
        const vertical=(clamp(b.h,bottom,top)-b.h)/b.hy;
        if(Math.abs(vertical)>=1)return false;
        const k=Math.sqrt(1-vertical*vertical);
        return circleEllipse(lx,lz,b.hx*k,b.hz*k,r);
      }
      if(b.shape==='cylinder')return lx*lx+lz*lz<((b.r||Math.max(b.hx,b.hz))+r)**2;
      const qx=Math.max(0,Math.abs(lx)-b.hx),qz=Math.max(0,Math.abs(lz)-b.hz);
      return r>0?qx*qx+qz*qz<r*r:Math.abs(lx)<=b.hx&&Math.abs(lz)<=b.hz;
    }
    function rockSurface(b,x,y,r=0){
      const dx=x-b.x,dy=y-b.y;let lx=Math.abs(b.cos*dx-b.sin*dy),lz=Math.abs(b.sin*dx+b.cos*dy);
      const a2=b.hx*b.hx,b2=b.hz*b.hz;
      // The support is the highest point under the whole circular footprint.
      // This prevents the uphill edge of a standing body sinking into a rock.
      if(r>0){
        const d=Math.hypot(lx,lz);if(d<=r)return b.h+b.hy;
        let lo=0,hi=(d/r-1)/Math.min(a2,b2);
        for(let i=0;i<20;i++){const t=(lo+hi)/2;if((lx/(1+t*a2))**2+(lz/(1+t*b2))**2>r*r)lo=t;else hi=t;}
        lx*=hi*a2/(1+hi*a2);lz*=hi*b2/(1+hi*b2);
      }
      const q=lx*lx/a2+lz*lz/b2;
      return q<=1?b.h+b.hy*Math.sqrt(Math.max(0,1-q)):undefined;
    }
    // A real bridge meets the irregular generated mainland coast, then enters
    // the southern HQ gate. Its route avoids the command building and guns.
    function buildConnection() {
      const gate = siteMap.get('C_GATE'), width = 14; let best = null;
      if (nativeGround) {
        for (const dy of [80, 64, 48, 32, 16, 0, -16, -32, -48, -64, -80]) {
          const y = gate.y + dy;
          for (let x = 2040; x >= 1400; x -= 8) {
            const samples = [nativeGround(x, y), nativeGround(x - 8, y), nativeGround(x, y - width / 2), nativeGround(x, y + width / 2)];
            const landingClear = !nativeBlocked || [[x - 8, y], [x - 16, y], [x - 8, y - width / 2], [x - 8, y + width / 2]].every(p => !nativeBlocked(p[0], p[1]));
            if (samples.every(h => finite(h) && h > seaLevel + 2) && landingClear) {
              const score = x - Math.abs(dy - 80) * .35;
              if (!best || score > best.score) best = { x: x - 8, y, h: nativeGround(x - 8, y) + .12, score };
              break;
            }
          }
        }
      }
      // Tests and tooling may omit a mainland sampler; live installs provide it.
      if (!best) best = { x: 1792, y: gate.y + 80, h: seaLevel + 12, fallback: true };
      const end = { x: gate.x, y: gate.y + 52, h: gate.h + .34 };
      const waypoints = [{ x: best.x, y: best.y, h: best.h }, { x: 2110, y: gate.y + 110 }, { x: gate.x, y: gate.y + 110 }, end];
      const distance = waypoints.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - waypoints[i].x, p.y - waypoints[i].y), 0);
      const path = []; let walked = 0;
      for (let i = 1; i < waypoints.length; i++) {
        const a = waypoints[i - 1], b = waypoints[i], length = Math.hypot(b.x - a.x, b.y - a.y), count = Math.max(1, Math.ceil(length / 18));
        for (let j = i === 1 ? 0 : 1; j <= count; j++) {
          const t = j / count, x = mix(a.x, b.x, t), y = mix(a.y, b.y, t);
          let ground = inBounds(x, y) ? baseTerrain(x, y) : nativeGround ? nativeGround(x, y) : seaLevel - 25;
          if (!finite(ground)) ground = seaLevel - 25;
          const h = Math.max(mix(best.h, end.h, (walked + t * length) / distance), ground + .12);
          path.push({ x, y, h });
        }
        walked += length;
      }
      path[0].h = best.h; path[path.length - 1].h = end.h;
      // The deck is sampled every 18 m, but the battlefield's west coast is a
      // bank that rises about ten metres between two samples. The straight
      // chord then climbed it at 53-90% and ran up to five metres inside the
      // ground, so no hull could follow it. Carry the last spans over the
      // bank instead: a chord with a free end clears the ground under its
      // whole width, and no span after the mainland landing exceeds 15%,
      // well inside what a hull section's reachable 1.1 m step can follow.
      // Spans that already rest on the ground at both ends are not changed.
      const legacyHeights = path.map(p => p.h), RAMP = .15, groundAt = (x, y) => {
        const g = inBounds(x, y) ? baseTerrain(x, y) : nativeGround ? nativeGround(x, y) : undefined; return finite(g) ? g : undefined; };
      const clearance = path.map(p => { const g = groundAt(p.x, p.y); return g === undefined ? Infinity : p.h - g; });
      for (let pass = 0; pass < 4; pass++) {
        let changed = false;
        for (let i = path.length - 2; i >= 1; i--) {
          const a = path[i], b = path[i + 1], length = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
          // Only an end that stands clear of the ground is free to rise.
          if (a.h - legacyHeights[i] + clearance[i] > 1) for (let d = 1; d < length * .8; d += 1.5) {
            const t = d / length, x = mix(a.x, b.x, t), y = mix(a.y, b.y, t);
            for (const side of [-width / 2, -width / 4, 0, width / 4, width / 2]) {
              const g = groundAt(x + nx * side, y + ny * side); if (g === undefined) continue;
              const need = g + .12 - mix(a.h, b.h, t);
              if (need > 1e-6) { a.h += need / (1 - t); changed = true; }
            }
          }
          const floor = b.h - RAMP * length;
          if (a.h < floor - 1e-9) { a.h = floor; changed = true; }
        }
        for (let i = 1; i < path.length - 2; i++) {
          const a = path[i], b = path[i + 1], floor = a.h - RAMP * Math.hypot(b.x - a.x, b.y - a.y);
          if (b.h < floor - 1e-9) { b.h = floor; changed = true; }
        }
        if (!changed) break;
      }
      const regraded = path.some((p, i) => p.h !== legacyHeights[i]);
      const segments = path.slice(1).map((b, i) => ({ x1: path[i].x, y1: path[i].y, h1: path[i].h, x2: b.x, y2: b.y, h2: b.h, width }));
      return { id: 'EF_MAINLAND_BRIDGE', x0: path[0].x, y0: path[0].y, h0: path[0].h,
        x1: end.x, y1: end.y, h1: end.h, width, path, segments, fallback: !!best.fallback,
        ...(regraded ? { legacyHeights } : {}) };
    }
    const connection = buildConnection();
    const halfBridge = connection.width / 2;
    const connectionMinX = Math.min(...connection.path.map(p => p.x)) - halfBridge;
    const connectionMaxX = Math.max(...connection.path.map(p => p.x)) + halfBridge;
    const connectionMinY = Math.min(...connection.path.map(p => p.y)) - halfBridge;
    const connectionMaxY = Math.max(...connection.path.map(p => p.y)) + halfBridge;
    function connectionAt(x, y, radius = 0) {
      if (x < connectionMinX-radius || x > connectionMaxX+radius || y < connectionMinY-radius || y > connectionMaxY+radius) return null;
      let result = null;
      for (const s of connection.segments) {
        const dx=s.x2-s.x1,dy=s.y2-s.y1,length=Math.hypot(dx,dy);
        const along=((x-s.x1)*dx+(y-s.y1)*dy)/length,side=((x-s.x1)*-dy+(y-s.y1)*dx)/length;
        const perpendicular=Math.max(0,Math.abs(side)-s.width/2);if(perpendicular>radius)continue;
        const reach=Math.sqrt(Math.max(0,radius*radius-perpendicular*perpendicular));
        const lo=Math.max(0,along-reach),hi=Math.min(length,along+reach);if(lo>hi)continue;
        // A walking cylinder is supported by the highest visible top under
        // its footprint. The centre height alone leaves its leading edge
        // inside a slope or the adjacent prism at a bend in this bridge.
        const height=Math.max(mix(s.h1,s.h2,lo/length),mix(s.h1,s.h2,hi/length)),distance=Math.abs(side);
        if(!result||height>result.height)result={height,distance,kind:'bridge',id:connection.id};
      }
      return result;
    }
    // Spans whose height changed when the approach was carried over the bank.
    // A pose saved on this former deck is now in the air below the present one.
    const legacyConnectionSegments = connection.legacyHeights ? connection.segments.map((s, i) => ({ ...s,
      h1: connection.legacyHeights[i], h2: connection.legacyHeights[i + 1] })).filter((s, i) =>
      s.h1 !== connection.segments[i].h1 || s.h2 !== connection.segments[i].h2) : [];
    function legacyConnectionAt(x, y, radius = 0) {
      let result = null;
      for (const s of legacyConnectionSegments) {
        const dx=s.x2-s.x1,dy=s.y2-s.y1,length=Math.hypot(dx,dy);
        const along=((x-s.x1)*dx+(y-s.y1)*dy)/length,side=((x-s.x1)*-dy+(y-s.y1)*dx)/length;
        const perpendicular=Math.max(0,Math.abs(side)-s.width/2);if(perpendicular>radius)continue;
        const reach=Math.sqrt(Math.max(0,radius*radius-perpendicular*perpendicular));
        const lo=Math.max(0,along-reach),hi=Math.min(length,along+reach);if(lo>hi)continue;
        const height=Math.max(mix(s.h1,s.h2,lo/length),mix(s.h1,s.h2,hi/length));
        if(!result||height>result.height)result={height,kind:'bridge',id:connection.id};
      }
      return result;
    }
    function recoverConnectionPoint(point, options = {}) {
      if (!legacyConnectionSegments.length || !point || ![point.x, point.y, point.h].every(finite)) return null;
      const radius = finite(options.radius) ? options.radius : .42, height = finite(options.height) ? options.height : 1.8;
      if (radius < 0 || height <= 0) return null;
      const former = legacyConnectionAt(point.x, point.y, radius), centre = legacyConnectionAt(point.x, point.y, 0);
      // The highest top under the footprint is the support a body receives.
      const deck = former && connectionAt(point.x, point.y, radius);
      // A pose already on the present deck needs no repair on later loads.
      if (!deck || deck.height - former.height < .05 || deck.height - point.h < .05 ||
          Math.min(Math.abs(point.h - former.height), centre ? Math.abs(point.h - centre.height) : Infinity) > .6) return null;
      // Ground within a step of the saved feet is a real layer under the
      // raised span. Only a pose left in the air by the former deck moves.
      const ground = getTerrain(point.x, point.y);
      if (finite(ground) && point.h - ground < 1.2) return null;
      if (bodyBlocked(point.x, point.y, deck.height, height, radius)) return null;
      return { x: point.x, y: point.y, h: deck.height };
    }
    // Include a walking footprint at the seam, but support is queried against
    // the flat-ended visible deck, never the old circular endpoint extension.
    const owns = (x, y) => inBounds(x, y) || !!connectionAt(x, y, .5);
    function getTerrain(x, y) {
      const h = baseTerrain(x, y);
      if (h !== undefined) return h;
      if (connectionAt(x, y, .5)) return nativeGround ? nativeGround(x, y) : seaLevel - 25;
      return undefined;
    }
    function connectionBodyAt(x,y,bottom,top,radius=0){
      if(x+radius<connectionMinX||x-radius>connectionMaxX||y+radius<connectionMinY||y-radius>connectionMaxY)return null;
      for(const s of connection.segments){
        const dx=s.x2-s.x1,dy=s.y2-s.y1,length=Math.hypot(dx,dy);
        const along=((x-s.x1)*dx+(y-s.y1)*dy)/length,side=((x-s.x1)*-dy+(y-s.y1)*dx)/length;
        const perpendicular=Math.max(0,Math.abs(side)-s.width/2);if(perpendicular>radius)continue;
        const reach=Math.sqrt(Math.max(0,radius*radius-perpendicular*perpendicular));
        const lo=Math.max(0,along-reach),hi=Math.min(length,along+reach);if(lo>hi)continue;
        const h0=mix(s.h1,s.h2,lo/length),h1=mix(s.h1,s.h2,hi/length),base=Math.min(h0,h1)-1.3,height=Math.max(h0,h1);
        if(bottom<height-.015&&top>base+.025)return {id:connection.id,kind:'easternFrontBridge',shape:'bridge-slab',x,y,base,height,hgt:height-base};
      }
      return null;
    }
    // Authored crossings use the exact Float32 triangles drawn by the world
    // builder. A road centreline/circular endpoint approximation is not a
    // physical surface on a steep ramp or near the edge of a bridge.
    function elevatedBridgeAt(x, y, radius = 0, legacy = false) {
      const vx = x - offsets.x, vz = y - offsets.z;
      for (const grid of bridgeSurfaces) {
        if (Math.abs(vx - grid.x) > grid.halfWidth + radius || Math.abs(vz - grid.z) > grid.halfLength + radius) continue;
        const qx = clamp(vx, grid.x - grid.halfWidth, grid.x + grid.halfWidth), qz = clamp(vz, grid.z - grid.halfLength, grid.z + grid.halfLength);
        if ((qx - vx) ** 2 + (qz - vz) ** 2 > radius * radius + 1e-10) continue;
        const sample = gridHeight(legacy && grid.legacyHeights ? { ...grid, heights: grid.legacyHeights } : grid, qx, qz);
        if (sample) return { height: sample.height + offsets.h, kind: 'bridge', id: grid.id };
      }
      return null;
    }
    function elevatedBridgeSlab(x, y, radius = 0) {
      const support = elevatedBridgeAt(x, y, radius);
      if (!support) return null;
      return { ...support, kind: 'easternFrontBridge', shape: 'bridge-slab',
        x, y, base: support.height - .7, hgt: .7, hx: 10, hz: 170 };
    }
    function getSurface(x, y, previousHeight, maxStep = .5, radius = 0, includeRocks = true) {
      const terrain = getTerrain(x, y); if (terrain === undefined) return undefined;
      let result = { height: terrain, kind: 'terrain', id: 'eastern-front' };
      const ceiling = finite(previousHeight) ? previousHeight + Math.max(0, maxStep) : terrain + 1.2;
      const bridge = connectionAt(x, y, radius);
      if (bridge && (!finite(previousHeight) || bridge.height <= ceiling + .001) && bridge.height > result.height) result = bridge;
      const crossing = elevatedBridgeAt(x, y, radius);
      // A walking capsule reaches the 0.7m road skin with its leading edge
      // before its centre arrives. Include that short slope rise while the
      // host retains its existing 1.05m maximum body step. Airborne probes
      // (small maxStep) and point/vehicle queries retain the narrow allowance.
      const crossingAllowance = radius > 0 && maxStep >= .45 ? .5 : .25;
      if (crossing && crossing.height > result.height && crossing.height <= ceiling + crossingAllowance) result = crossing;
      // A paved ramp is a solid ground skin, not an upper floor: its 0.9m
      // thickness previously exceeded the 0.8m road query allowance, leaving
      // a walker supported by the dirt underneath. Match the body's existing
      // walking step allowance and repair feet already inside a low skin.
      // Keep that penetration repair below 1.1m above dry terrain; a bridge,
      // trench, elevated carriageway or unrelated lower floor stays separate.
      const normalPavementCeiling = finite(previousHeight) ? ceiling + crossingAllowance : Infinity;
      let pavementCeiling = normalPavementCeiling;
      if (!crossing && finite(previousHeight) && terrain >= seaLevel + .2 &&
          previousHeight >= terrain - .1 && previousHeight < terrain + 1.1) {
        pavementCeiling = Math.max(pavementCeiling, terrain + 1.1);
      }
      if (!crossing && roadSupportSegments.length) {
        let paved = roadSurfaceAt(x, y, pavementCeiling);
        // Most queries touch no road, or already stand on it. Only a newly
        // reachable low layer needs the extra trench exclusion query.
        if (paved && paved.height > normalPavementCeiling && trenchAt(x, y)) paved = roadSurfaceAt(x, y, normalPavementCeiling);
        if (paved && paved.height > result.height) result = paved;
      }
      // Old asset bundles remain readable. The current bundle's full-width
      // triangles are authoritative, including flat ends and omitted cuts.
      for (const r of crossing || roadSupportSegments.length ? EMPTY_BUCKET : roadIndex.at(x, y)) {
        const p = project(x, y, r.a, r.b); if (p.distance > r.width / 2) continue;
        // Ribbons terminate on a transverse plane, not a circular road cap.
        // Apply both ends across nearby segments so short samples cannot
        // create an invisible raised semicircle beyond the loading-yard lane.
        if (r.caps && ((x - r.caps.start.x) * r.caps.start.dx + (y - r.caps.start.y) * r.caps.start.dy < -1e-6 ||
          (x - r.caps.end.x) * r.caps.end.dx + (y - r.caps.end.y) * r.caps.end.dy > 1e-6)) continue;
        // Ordinary road skins follow each width sample of the terrain. Using
        // only the centre height would make people hover on a cross slope.
        const vx = x - offsets.x, vz = y - offsets.z;
        const riverZ = -138 + 45 * Math.sin((vx - 1449) / 240);
        const bridgeRoad = (!bridgeSurfaces.length && Math.abs(vx - 1449) < 26 && Math.abs(vz + 138) < 135) ||
          (Math.abs(vx - 1405) < 35 && Math.abs(vz - 867) < 145) ||
          (vx > 1770 && vx < 1890 && Math.abs(vz - riverZ) < 85);
        let height = bridgeRoad ? mix(r.h1, r.h2, p.t) : terrain + .6 + (r.offset || 0);
        if (r.access) {
          // Same per-width rendered-triangle support as the access ribbon.
          // Its verified junction lies south of the raised canal approach.
          height = terrain + .6 + (r.offset || 0);
        }
        if (finite(height) && height > result.height && height <= (bridgeRoad ? ceiling + .25 : pavementCeiling) &&
            (bridgeRoad || height <= normalPavementCeiling || !trenchAt(x, y))) result = { height, kind: 'road', id: r.id };
      }
      // A walking body starts climbing a low riser when its leading edge
      // reaches it, before its centre crosses the surface boundary.
      for (const b of surfaceIndex.at(x, y, radius)) {
        if(!includeRocks&&b.shape==='ellipsoid')continue;
        // A 32m bucket contains many rocks that do not touch this footprint.
        // Reject those before the twenty-step ellipsoid support solve. The
        // exact circle/ellipsoid support below still decides every contact.
        if(b.shape==='ellipsoid'&&(b.h+b.hy<=result.height||x+radius<b.minX||x-radius>b.maxX||y+radius<b.minY||y-radius>b.maxY))continue;
        let height=b.shape==='ellipsoid'?rockSurface(b,x,y,radius):b.height;
        if (height > result.height && height <= ceiling + .001 && insideBox(b, x, y, radius)) {
          height = survivingSurfaceHeight(b, x, y, radius, height);
          if (finite(height) && height > result.height) result = { height, kind: b.shape==='ellipsoid'?'rock':b.roof ? 'roof' : 'platform', id: b.id, object: b };
        }
      }
      return result;
    }
    function pointBlocked(x, y, h, r = .35) {
      if (!owns(x, y)) return null;
      if (!finite(h)) { const surface = getSurface(x, y); h = (surface ? surface.height : seaLevel) + .9; }
      for (const b of collisionIndex.at(x, y, r)) {
        if(b.bodyOnly)continue;
        if (h > b.base + .025 && h < b.base + b.hgt - .015 &&
            (b.shape==='ellipsoid'?bodyHitsBox(b,x,y,h,h,r):insideBox(b,x,y,r)) && surfacePointSolid(b, x, y, h, r)) return b;
      }
      const slab = elevatedBridgeSlab(x, y, r);
      if (slab && h > slab.base + .025 && h < slab.height - .015) return slab;
      return connectionBodyAt(x,y,h,h,r)||roadBodyAt(x,y,h,h,r);
    }
    // A horizontal body footprint plus its complete vertical interval. Feet on
    // a support face are clear; ceilings, window lintels and pillars are not.
    // Native footprint tests remain authoritative before external cut masks.
    function bodyBlocked(x, y, feet, height = 1.8, r = .42, ignoreBridgeSlab = false, ignoreRoadFill = false) {
      if (![x, y, feet, height, r].every(finite) || height <= 0 || r < 0) return null;
      // A body can reach across an ownership seam before its centre does.
      // These expanded bounds only select the spatial index; exact collider
      // tests below still decide whether the circular footprint touches it.
      if ((x + r < bounds.minX || x - r > bounds.maxX || y + r < bounds.minY || y - r > bounds.maxY) &&
          (x + r < connectionMinX || x - r > connectionMaxX || y + r < connectionMinY || y - r > connectionMaxY)) return null;
      const bottom = feet + .025, top = feet + height - .015;
      for (const b of collisionIndex.at(x, y, r)) {
        if (bottom < b.base + b.hgt - .015 && top > b.base + .025 &&
            (b.shape==='cylinder'||!(x+r<b.minX||x-r>b.maxX||y+r<b.minY||y-r>b.maxY)) &&
            bodyHitsBox(b,x,y,bottom,top,r) && surfaceBodySolid(b, x, y, bottom, top, r)) return b;
      }
      const slab = ignoreBridgeSlab ? null : elevatedBridgeSlab(x, y, r);
      if (slab && bottom < slab.height - .015 && top > slab.base + .025) return slab;
      return (!ignoreBridgeSlab&&connectionBodyAt(x,y,bottom,top,r))||(!ignoreRoadFill&&roadBodyAt(x,y,bottom,top,r))||null;
    }
    function recoverTrenchPoint(point) {
      if (!point || ![point.x, point.y, point.h].every(finite)) return null;
      const cut = trenchAt(point.x, point.y);
      // Airborne, current-floor, roof and unrelated underground poses are
      // intentionally outside this narrow legacy floor repair.
      if (!cut || point.h < cut.legacyBottom - .1 || point.h >= cut.floorHeight - .15) return null;
      const surface = getSurface(point.x, point.y, cut.floorHeight, .18, .42);
      if (!surface || Math.abs(surface.height - cut.floorHeight) > .2 ||
          bodyBlocked(point.x, point.y, surface.height, 1.8, .42)) return null;
      return { x: point.x, y: point.y, h: surface.height };
    }
    // Older support snapshots can already be inside an ellipsoid rock. A
    // walker cannot leave that pose through ordinary collision checks. Only
    // this invalid overlap is repaired, once, onto nearby connected ground;
    // valid survivors, casualties and other kinds of solid stay untouched.
    function recoverSupportPoint(point, options = {}) {
      if (!point || ![point.x, point.y, point.h].every(finite) || !inBounds(point.x, point.y) ||
          point.dead === true || point.alive === false || point.phase && point.phase !== 'active' ||
          point.air === true || point.airborne === true || point.alt > 0) return null;
      const radius = .42, height = 1.8, maxDistance = 16;
      const externalBlocked = typeof options.blocked === 'function' ? options.blocked : null;
      const overlaps = (b, x, y, feet) => feet + .025 < b.base + b.hgt - .015 &&
        feet + height - .015 > b.base + .025 && bodyHitsBox(b, x, y, feet + .025, feet + height - .015, radius) &&
        surfaceBodySolid(b, x, y, feet + .025, feet + height - .015, radius);
      const initial = collisionIndex.at(point.x, point.y, radius).filter(b => overlaps(b, point.x, point.y, point.h));
      if (!initial.length || initial.some(b => b.kind !== 'rock' || b.shape !== 'ellipsoid')) return null;
      const initialSet = new Set(initial);
      const ground = getSurface(point.x, point.y, point.h, .55, radius, false);
      if (!ground || ground.height <= seaLevel + .2 || point.h < ground.height - .12 || point.h - ground.height > 6) return null;
      const lift = point.h - ground.height;
      const ellipseDistance = (b, x, y) => {
        const dx = x - b.x, dy = y - b.y;
        return ((b.cos * dx - b.sin * dy) / b.hx) ** 2 + ((b.sin * dx + b.cos * dy) / b.hz) ** 2;
      };
      function support(x, y, previous) {
        if (!inBounds(x, y)) return null;
        const sf = getSurface(x, y, previous, .55, radius, false);
        return sf && sf.height > seaLevel + .2 && sf.height - previous <= 1.05 && previous - sf.height <= 1.1 ? sf : null;
      }
      function clear(x, y, h) {
        return !bodyBlocked(x, y, h, height, radius) && !(externalBlocked && externalBlocked(x, y, h, height));
      }
      function continuation(p) {
        for (let direction = 0; direction < 16; direction++) {
          const angle = direction * Math.PI / 8;
          let previous = p.h, okay = true;
          for (let step = 1; step <= 6; step++) {
            const x = p.x + Math.cos(angle) * step * .2, y = p.y + Math.sin(angle) * step * .2;
            const sf = support(x, y, previous);
            if (!sf || !clear(x, y, sf.height)) { okay = false; break; }
            previous = sf.height;
          }
          if (okay) return true;
        }
        return false;
      }
      function candidate(x, y) {
        const distance = Math.hypot(x - point.x, y - point.y);
        const steps = Math.max(1, Math.ceil(distance / .2), Math.ceil(Math.abs(lift) / .25));
        const escaped = new Set(), radial = new Map(initial.map(b => [b, ellipseDistance(b, point.x, point.y)]));
        let previous = ground.height, final = null;
        for (let step = 1; step <= steps; step++) {
          const t = step / steps, px = mix(point.x, x, t), py = mix(point.y, y, t);
          const sf = support(px, py, previous); if (!sf) return null;
          const feet = sf.height + lift * (1 - t), bottom = feet + .025, top = feet + height - .015;
          // Leave each original rock outward. Once clear of it, the same
          // rock becomes solid again; no recovery can cross its far side.
          for (const b of initial) {
            const d = ellipseDistance(b, px, py);
            if (d < radial.get(b) - 1e-7) return null;
            radial.set(b, d);
            if (!overlaps(b, px, py, feet)) escaped.add(b);
          }
          for (const b of collisionIndex.at(px, py, radius))
            if (overlaps(b, px, py, feet) && (!initialSet.has(b) || escaped.has(b))) return null;
          const bridge = elevatedBridgeSlab(px, py, radius);
          if (bridge && bottom < bridge.height - .015 && top > bridge.base + .025 ||
              connectionBodyAt(px, py, bottom, top, radius) || roadBodyAt(px, py, bottom, top, radius) ||
              externalBlocked && externalBlocked(px, py, feet, height)) return null;
          previous = sf.height; final = { x: px, y: py, h: sf.height };
        }
        return final && Math.abs(final.h - point.h) <= 6 && clear(final.x, final.y, final.h) && continuation(final) ? final : null;
      }
      const centre = initial.reduce((sum, b) => ({ x: sum.x + b.x, y: sum.y + b.y }), { x: 0, y: 0 });
      const outward = Math.atan2(point.y - centre.y / initial.length, point.x - centre.x / initial.length);
      for (let distance = .5; distance <= maxDistance; distance += .5) {
        for (let turn = 0; turn < 48; turn++) {
          const offset = (turn % 2 ? 1 : -1) * Math.ceil(turn / 2) * Math.PI / 24;
          const angle = outward + offset, repaired = candidate(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance);
          if (repaired) return repaired;
        }
      }
      return null;
    }
    // A sandbag top is a valid saved standing surface. It must be left by
    // ordinary movement, not a load-time relocation. Allow its short drop
    // onto the trench floor only after checking the complete fall volume.
    function canSupportDrop(from, to) {
      if (!from || !to || ![from.x, from.y, from.h, to.x, to.y, to.h].every(finite) ||
          !inBounds(from.x, from.y) || !inBounds(to.x, to.y)) return false;
      const drop = from.h - to.h, distance = Math.hypot(to.x - from.x, to.y - from.y);
      if (drop <= 1.1 || drop > 1.35 || distance > .6 || to.h <= seaLevel + .2) return false;
      const source = getSurface(from.x, from.y, from.h, .02, .42);
      if (!source || source.object?.surfaceRole !== 'trench-sandbag' || Math.abs(source.height - from.h) > .04) return false;
      const destination = getSurface(to.x, to.y, to.h, .02, .42);
      if (!destination || Math.abs(destination.height - to.h) > .04 ||
          bodyBlocked(to.x, to.y, to.h, 1.8 + drop, .42)) return false;
      for (let step = 0; step <= 3; step++)
        if (bodyBlocked(mix(from.x, to.x, step / 3), mix(from.y, to.y, step / 3), from.h, 1.8, .42)) return false;
      return true;
    }
    function recoverRoadPoint(point, options = {}) {
      const span = recoverConnectionPoint(point, options); if (span) return span;
      if (!roadSupportSegments.length || !point || ![point.x, point.y, point.h].every(finite) ||
          !inBounds(point.x, point.y) || trenchAt(point.x, point.y)) return null;
      const crossing = elevatedBridgeAt(point.x, point.y), legacyCrossing = crossing && elevatedBridgeAt(point.x, point.y, 0, true);
      if (crossing && crossing.height - legacyCrossing.height <= .8) return null;
      const terrain = getTerrain(point.x, point.y), paved = crossing || roadSurfaceAt(point.x, point.y);
      if (!paved || !finite(terrain)) return null;
      const radius = finite(options.radius) ? options.radius : .42, height = finite(options.height) ? options.height : 1.8;
      if (radius < 0 || height <= 0) return null;
      // Loading a current-format save must also leave its feet above a thin
      // road skin before the first physics tick. This only repairs an invalid
      // pose inside dry, ground-connected pavement, never a raised deck.
      if (!crossing && terrain >= seaLevel + .2 && paved.height - terrain <= 1.1 &&
          point.h >= terrain - .1 && paved.height - point.h > .025 &&
          !bodyBlocked(point.x, point.y, point.h, paved.height - point.h + height, radius, false, true)) {
        return { x: point.x, y: point.y, h: paved.height };
      }
      // A current ground/underpass save can share an old road's historical
      // altitude. A valid physical layer is not a request to move onto an
      // overhead road on every reload. Real fill/slab burials still proceed.
      const standing = getSurface(point.x, point.y, point.h, .55, radius);
      if (standing && point.h >= standing.height - .015 && point.h <= standing.height + .12 &&
          !bodyBlocked(point.x, point.y, point.h, height, radius)) return null;
      // Higher repaired roadbeds keep their narrow legacy-layer match.
      if ((!crossing && terrain < seaLevel + .2) || paved.height - point.h <= .8 || paved.height - point.h > 32) return null;
      // Old grounded snapshots used the unchanged terrain and the former
      // road skin. Match that layer narrowly; never lift a roof, an airborne
      // actor or an unrelated underground save to an overhead carriageway.
      let legacyHeight = crossing ? Math.max(terrain, legacyCrossing.height) : terrain;
      const vx = point.x - offsets.x, vz = point.y - offsets.z;
      const riverZ = -138 + 45 * Math.sin((vx - 1449) / 240);
      for (const r of crossing ? EMPTY_BUCKET : roadIndex.at(point.x, point.y)) {
        const p = project(point.x, point.y, r.a, r.b); if (p.distance > r.width / 2) continue;
        if (r.caps && ((point.x - r.caps.start.x) * r.caps.start.dx + (point.y - r.caps.start.y) * r.caps.start.dy < -1e-6 ||
          (point.x - r.caps.end.x) * r.caps.end.dx + (point.y - r.caps.end.y) * r.caps.end.dy > 1e-6)) continue;
        const bridgeRoad = !r.access && ((!bridgeSurfaces.length && Math.abs(vx - 1449) < 26 && Math.abs(vz + 138) < 135) ||
          (Math.abs(vx - 1405) < 35 && Math.abs(vz - 867) < 145) || (vx > 1770 && vx < 1890 && Math.abs(vz - riverZ) < 85));
        const h1 = finite(r.legacyY1) ? r.legacyY1 + offsets.h : r.h1;
        const h2 = finite(r.legacyY2) ? r.legacyY2 + offsets.h : r.h2;
        const height = bridgeRoad ? mix(h1, h2, p.t) : terrain + .6 + (r.offset || 0);
        if (finite(height)) legacyHeight = Math.max(legacyHeight, height);
      }
      if (crossing) {
        if (Math.abs(point.h - legacyCrossing.height) > .15 && Math.abs(point.h - legacyHeight) > .15) return null;
      } else if (point.h < terrain - .15 || (Math.abs(point.h - legacyHeight) > .4 && Math.abs(point.h - terrain) > .2)) return null;
      if (bodyBlocked(point.x, point.y, point.h, paved.height - point.h + height, radius, !!crossing, true)) return null;
      return { x: point.x, y: point.y, h: paved.height };
    }
    function recoverGradedRoadPoint(point, options = {}) {
      const history = roadGradeHistory(options.sourceRevision), bounds = history?.record.bounds;
      if (!history?.main || !bounds || !point ||
          ![point.x, point.y, point.h].every(finite) || point.grounded === false || point.air === true ||
          point.airborne === true || point.alt > 0 || (finite(point.vz) && Math.abs(point.vz) > .05)) return null;
      const x = point.x, y = point.y, vx = x - offsets.x, vz = y - offsets.z;
      const bridge = elevatedBridgeAt(x, y), newBridge = !!(bridge && history.record.newBridgeIds?.includes(bridge.id));
      const routeBridge = !!(options.routePoint && newBridge);
      if (vx < bounds.minX || vx > bounds.maxX || vz < bounds.minZ || vz > bounds.maxZ ||
          trenchAt(x, y) || bridge && !newBridge || connectionAt(x, y)) return null;
      // Network topology is deliberately not a world-wide relocation license.
      // Even old road poses must lie inside the explicitly surveyed earthwork.
      if (history.record.corridors?.length && !onGradedRoadBed(history, x, y)) return null;
      const terrain = getTerrain(x, y), legacyTerrain = sampleGridTerrain(history.main, history.patches, x, y);
      if (!finite(terrain) || !finite(legacyTerrain) || legacyTerrain < seaLevel + .2) return null;
      // A lowered rail/deck can happen to coincide with the former earth
      // height. Recognize its valid current standing layer before attempting
      // another interpretation as old ground on a repeated migration call.
      const standing = getSurface(x, y, point.h, .55, options.radius ?? .42);
      if (standing && point.h >= standing.height - .015 && point.h <= standing.height + .12 &&
          !bodyBlocked(x, y, point.h, options.height ?? 1.8, options.radius ?? .42)) return null;
      const road = roadSurfaceAt(x, y), legacySample = roadSupportAt(history.roads, x, y);
      const oldFeet = options.relativeToTerrain ? legacyTerrain + point.h - terrain : point.h;
      const oldGround = Math.abs(oldFeet - legacyTerrain) <= .2;
      const changedGround = oldGround && Math.abs(terrain - legacyTerrain) >= .025 && onGradedRoadBed(history, x, y);
      // A new elevated crossing does not promote an old ground save onto its
      // upper deck. Only a verified old ground layer may follow earthwork below
      // that crossing; historical deck saves keep their separate bridge repair.
      if (newBridge && !routeBridge && !changedGround) return null;
      if (history.record.roadOnly && !road && !legacySample) {
        // A surveyed roadbed includes its cut/fill shoulders. Exact old ground
        // there must follow the changed terrain instead of remaining buried.
        // Unchanged ordinary ground and unrelated layers remain untouched.
        if (!changedGround && !options.routePoint && !options.guardHome) return null;
        if (!onGradedRoadBed(history, x, y)) return null;
      }
      // A newly widened shoulder has no historical road triangle. Falling
      // back to that new triangle would falsely call the changed fill an
      // unchanged surface and skip recovery. Only unaffected road grids can
      // serve as their own legacy support outside the compact repair spans.
      const changedRoad = road && history.profiles.some(profile => road.id.startsWith(profile.prefix));
      const legacyRoad = legacySample || (changedRoad ? null : road);
      const lowSupport = oldGround && !options.routePoint ? getSurface(x, y, terrain, .55, options.radius ?? .42) : null;
      const currentSurface = lowSupport
        ? (lowSupport.height - terrain <= 1.1 ? lowSupport.height : terrain)
        : Math.max(terrain, road?.height ?? -Infinity, routeBridge ? bridge.height : -Infinity);
      const oldSurface = Math.max(legacyTerrain, legacyRoad?.height ?? -Infinity);
      // Only altered earthwork participates. Already-supported current poses
      // are checked before reconstructing relative native floor offsets, so
      // a restored save or repeated caller can never apply the cut twice.
      if (Math.abs(currentSurface - oldSurface) < .025 ||
          (point.h >= currentSurface - .015 && point.h <= currentSurface + .12)) return null;
      let oldLayer;
      if (legacyRoad && Math.abs(oldFeet - legacyRoad.height) <= .2) oldLayer = legacyRoad.height;
      else if (Math.abs(oldFeet - legacyTerrain) <= .2) oldLayer = legacyTerrain;
      else if (options.routePoint) {
        // Historical navigation stations used terrain + skin thickness before
        // the exact road triangles were exported. Only immutable authored
        // route targets may use that older convention; saved actors still
        // require the strict physical-layer match above.
        const profile = legacySample && history.profiles.find(p => legacySample.id.startsWith(p.prefix));
        // Some original stations used the old centreline road-height query
        // beyond today's exact ribbon edge. They still carry its precise
        // .6m skin + authored offset convention. This exception applies only
        // to immutable navigation targets inside the approved roadbed.
        const profiles = profile ? [profile] : history.profiles;
        const nominal = profiles.map(p => legacyTerrain + .6 + p.offset).find(h => Math.abs(oldFeet - h) <= .12);
        if (!finite(nominal)) return null;
        oldLayer = nominal;
      }
      else return null;
      const radius = finite(options.radius) ? options.radius : .42, height = finite(options.height) ? options.height : 1.8;
      if (radius < 0 || height <= 0) return null;
      // A coincident roof/platform is a separate authored layer, even if its
      // top happens to lie close to the former earth or asphalt height.
      for (const b of surfaceIndex.at(x, y, radius)) {
        if (b.shape !== 'ellipsoid' && Math.abs(b.height - oldFeet) <= .2 && insideBox(b, x, y, radius)) return null;
      }
      const clearance = clamp(oldFeet - oldLayer, 0, .12);
      let target = currentSurface + clearance;
      // A retained approach may now contain a solid earthwork wearing course
      // above the sampled terrain. Its exact ground-connected fill collider,
      // unlike an overhead bridge/deck, is part of this approved ground move.
      // Use that collider's own top rather than an unbounded upper surface.
      const fill = changedGround && !routeBridge && roadBodyAt(x, y, target + .025, target + height - .015, radius);
      if (fill?.shape === 'road-fill') target = Math.max(target, fill.height + clearance);
      if (routeBridge) {
        // This is an immutable target, never a saved/live body relocation.
        // The surveyed replacement bridge owns the road target's layer; the
        // complete approach still has to pass sequential native walk checks.
        if (bodyBlocked(x, y, target, height, radius)) return null;
        return { x, y, h: target };
      }
      // Terrain itself is deliberately absent from bodyBlocked: the purpose
      // of this one-time migration is to follow changed cut/fill earthwork.
      // Existing walls, roofs, rocks and bridge slabs still block the entire
      // vertical relocation, including downward moves off an obsolete road.
      const bottom = Math.min(oldFeet, target), span = Math.abs(target - oldFeet) + height;
      if (bodyBlocked(x, y, target, height, radius) || bodyBlocked(x, y, bottom, span, radius, false, true)) return null;
      return { x, y, h: target };
    }
    function recoverKnownGradedHome(member, sourceRevision) {
      const history = roadGradeHistory(sourceRevision);
      if (!history || member.dead || member.phase !== 'garrison') return null;
      const old = history.record.legacyGroundHomes?.find(p => p.id === member.id && p.placement === member.placement);
      if (!old || ['x', 'y', 'h'].some(key => Math.abs(member[key] - old[key]) > .00002) ||
          !onGradedRoadBed(history, member.x, member.y)) return null;
      const terrain = getTerrain(member.x, member.y), prior = sampleGridTerrain(history.main, history.patches, member.x, member.y);
      if (!finite(terrain) || !finite(prior) || Math.abs(terrain - prior) < .025) return null;
      // These few original unloaded ground homes used analytical source
      // heights that did not equal their baked floor. Their exact published
      // ID/XYZ/H is recorded separately; generic save tolerance remains .2m.
      const floor = getSurface(member.x, member.y, terrain, .55, .42);
      if (floor && floor.height >= seaLevel + .2 && floor.height - terrain <= 1.1) {
        const target = { x: member.x, y: member.y, h: floor.height + .02 };
        const bottom = Math.min(member.h, target.h), span = Math.abs(member.h - target.h) + 1.8;
        if (!bodyBlocked(target.x, target.y, bottom, span, .42, false, true)) return target;
      }
      // One recorded expanded CANAL home is occupied by a newly built girder.
      // Only that exact old pose may use its own already validated current
      // home within six metres; players and travelling units never use this.
      const home = member.home;
      if (!(old.maxHomeShift > 0) || !home || Math.hypot(home.x - old.x, home.y - old.y) > old.maxHomeShift ||
          !onGradedRoadBed(history, home.x, home.y)) return null;
      const support = getSurface(home.x, home.y, home.h, .55, .42);
      if (!support || support.height <= seaLevel + .2 || Math.abs(home.h - support.height) > .12 ||
          bodyBlocked(home.x, home.y, home.h, 1.8, .42)) return null;
      return { x: home.x, y: home.y, h: home.h };
    }
    function vaultPlan(x, y, feet, ux, uy, options = {}) {
      const radius = options.radius ?? .42, bodyHeight = options.bodyHeight ?? 1.8;
      if (![x, y, feet, ux, uy, radius, bodyHeight].every(finite) || radius < 0 || bodyHeight <= 0 || !owns(x, y)) return null;
      const length = Math.hypot(ux, uy);
      if (length < .001) return null;
      ux /= length; uy /= length;
      if (bodyBlocked(x, y, feet, bodyHeight, radius)) return null;
      // Probe the shins for the first nearby sill. High walls, deep blocks and
      // round props are not windows, even if there is empty space above them.
      let sill = null;
      for (let d = radius + .1; d <= radius + 1.25 + .001; d += .1) {
        sill = pointBlocked(x + ux * d, y + uy * d, feet + .3, 0);
        if (sill) break;
      }
      if (!sill || sill.shape === 'cylinder' || Math.min(sill.hx, sill.hz) * 2 > 1.4 + .001) return null;
      const peak = sill.base + sill.hgt + .08, rise = peak - .08 - feet;
      if (rise < .45 || rise > 1.7) return null;
      // Exact line/OBB entry and exit stop diagonal approaches from cutting
      // through an arbitrarily long section of a thin wall.
      const dx = x - sill.x, dy = y - sill.y;
      const origins = [sill.cos * dx - sill.sin * dy, sill.sin * dx + sill.cos * dy];
      const directions = [sill.cos * ux - sill.sin * uy, sill.sin * ux + sill.cos * uy];
      const halves = [sill.hx, sill.hz];
      let entry = -Infinity, exit = Infinity;
      for (let axis = 0; axis < 2; axis++) {
        if (Math.abs(directions[axis]) < 1e-9) {
          if (Math.abs(origins[axis]) > halves[axis]) return null;
          continue;
        }
        let a = (-halves[axis] - origins[axis]) / directions[axis], b = (halves[axis] - origins[axis]) / directions[axis];
        if (a > b) [a, b] = [b, a];
        entry = Math.max(entry, a); exit = Math.min(exit, b);
      }
      if (!finite(exit) || entry < 0 || exit < entry || exit - entry > 1.4 + .001 || entry > radius + 1.25) return null;
      const distance = exit + radius + .2, x1 = x + ux * distance, y1 = y + uy * distance;
      if (!owns(x1, y1)) return null;
      // The host animates the same two segments: lift in place, then cross at
      // sill height. Checking the whole body prevents passing a pillar/lintel
      // or another wall behind the opening. No ground is required at the far
      // end: an upper-storey exit continues as a gravity-driven fall.
      const liftSteps = Math.max(1, Math.ceil((peak - feet) / .12));
      for (let i = 0; i <= liftSteps; i++) {
        if (bodyBlocked(x, y, mix(feet, peak, i / liftSteps), bodyHeight, radius)) return null;
      }
      const crossSteps = Math.max(1, Math.ceil(distance / .12));
      for (let i = 1; i <= crossSteps; i++) {
        const qx = mix(x, x1, i / crossSteps), qy = mix(y, y1, i / crossSteps);
        if (!owns(qx, qy) || bodyBlocked(qx, qy, peak, bodyHeight, radius)) return null;
      }
      return { kind: 'window', x1, y1, feet0: feet, peak };
    }
    function hitBox(a, b, box) {
      const dx = a.x - box.x, dy = a.y - box.y, vx = b.x - a.x, vy = b.y - a.y;
      const origin = [box.cos * dx - box.sin * dy, a.h - box.h, box.sin * dx + box.cos * dy];
      const delta = [box.cos * vx - box.sin * vy, b.h - a.h, box.sin * vx + box.cos * vy];
      const half = [box.hx, box.hy, box.hz]; let t0 = 0, t1 = 1;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(delta[i]) < 1e-9) { if (Math.abs(origin[i]) > half[i]) return null; }
        else { let ta = (-half[i] - origin[i]) / delta[i], tb = (half[i] - origin[i]) / delta[i]; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return null; }
      }
      if(box.shape==='ellipsoid'){
        let qa=0,qb=0,qc=-1;
        for(let i=0;i<3;i++){const u=origin[i]/half[i],v=delta[i]/half[i];qa+=v*v;qb+=2*u*v;qc+=u*u;}
        if(qa<=1e-12){if(qc>0)return null;}
        else{const disc=qb*qb-4*qa*qc;if(disc<0)return null;const root=Math.sqrt(disc);t0=Math.max(t0,(-qb-root)/(2*qa));t1=Math.min(t1,(-qb+root)/(2*qa));if(t0>t1)return null;}
      }
      if (box.shape === 'cylinder') {
        const r = box.r || Math.max(box.hx, box.hz), qa = delta[0] ** 2 + delta[2] ** 2;
        if (qa > 1e-10) {
          const qb = 2 * (origin[0] * delta[0] + origin[2] * delta[2]), qc = origin[0] ** 2 + origin[2] ** 2 - r * r, disc = qb * qb - 4 * qa * qc;
          if (disc < 0) return null;
          const root = Math.sqrt(disc); t0 = Math.max(t0, (-qb - root) / (2 * qa)); t1 = Math.min(t1, (-qb + root) / (2 * qa)); if (t0 > t1) return null;
        } else if (origin[0] ** 2 + origin[2] ** 2 > r * r) return null;
      }
      return t0 >= 0 && t0 <= 1 ? t0 : null;
    }
    function boxFaceNormal(a, b, box, t) {
      const dx = mix(a.x, b.x, t) - box.x, dz = mix(a.y, b.y, t) - box.y;
      const p = [box.cos * dx - box.sin * dz, mix(a.h, b.h, t) - box.h, box.sin * dx + box.cos * dz];
      const half = [box.hx, box.hy, box.hz];
      let axis = 0; for (let i = 1; i < 3; i++) if (Math.abs(Math.abs(p[i]) - half[i]) < Math.abs(Math.abs(p[axis]) - half[axis])) axis = i;
      const sign = p[axis] < 0 ? -1 : 1;
      return axis === 0 ? { x: box.cos * sign, y: 0, z: -box.sin * sign } :
        axis === 1 ? { x: 0, y: sign, z: 0 } : { x: box.sin * sign, y: 0, z: box.cos * sign };
    }
    function segmentBoxInterval(origin, delta, min, max) {
      let enter = 0, exit = 1, farAxis = -1, farSign = 0;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(delta[i]) < 1e-12) { if (origin[i] < min[i] || origin[i] > max[i]) return null; continue; }
        let lo = (min[i] - origin[i]) / delta[i], hi = (max[i] - origin[i]) / delta[i], sign = 1;
        if (lo > hi) { [lo, hi] = [hi, lo]; sign = -1; }
        enter = Math.max(enter, lo); if (hi < exit) { exit = hi; farAxis = i; farSign = sign; }
        if (enter > exit) return null;
      }
      return { enter, exit, farAxis, farSign };
    }
    function maskedBoxHit(a, b, box, originalT, owner) {
      const dx = a.x - box.x, dz = a.y - box.y, vx = b.x - a.x, vz = b.y - a.y, vh = b.h - a.h;
      const whole = segmentBoxInterval([box.cos * dx - box.sin * dz, a.h - box.h, box.sin * dx + box.cos * dz],
        [box.cos * vx - box.sin * vz, vh, box.sin * vx + box.cos * vz], [-box.hx, -box.hy, -box.hz], [box.hx, box.hy, box.hz]);
      if (!whole) return null;
      const intervals = [], origin = [a.x, a.h, a.y], delta = [vx, vh, vz];
      for (const cut of owner.cuts) {
        const interval = segmentBoxInterval(origin, delta, [cut.min.x, cut.min.y, cut.min.z], [cut.max.x, cut.max.y, cut.max.z]);
        if (interval && interval.exit >= whole.enter && interval.enter <= whole.exit) intervals.push(interval);
      }
      intervals.sort((a, b) => a.enter - b.enter);
      let t = originalT, normal = boxFaceNormal(a, b, box, t);
      const epsilon = 1e-7 / Math.max(1, Math.hypot(vx, vh, vz));
      for (const interval of intervals) {
        if (interval.enter > t + epsilon) break;
        if (interval.exit >= t) {
          t = interval.exit + epsilon;
          normal = { x: 0, y: 0, z: 0 };
          if (interval.farAxis >= 0) normal[['x', 'y', 'z'][interval.farAxis]] = -interval.farSign;
        }
        if (t > whole.exit - epsilon) return null;
      }
      return t <= whole.exit && t <= 1 ? { t, normal, surfaceOwner: owner, surfaceHost: getDestruction().surfaceToken(owner) } : null;
    }
    function projectSurfaceImpact(box, point, direction, maxBack = .65) {
      // Recover the face of an already selected step-hit collider. This is one
      // analytic OBB interval, not another world/scene collision query.
      if (!box || box.shape && box.shape !== 'box' || !point || !direction ||
          ![point.x, point.y, point.z, direction.x, direction.y, direction.z].every(finite)) return null;
      const length = Math.hypot(direction.x, direction.y, direction.z); if (length < 1e-9) return null;
      const back = clamp(finite(maxBack) ? maxBack : .65, .05, 2), dx = direction.x / length, dy = direction.y / length, dz = direction.z / length;
      const a = { x: point.x - dx * back, y: point.z - dz * back, h: point.y - dy * back };
      const b = { x: point.x + dx * .005, y: point.z + dz * .005, h: point.y + dy * .005 };
      const t = hitBox(a, b, box); if (t === null) return null;
      const owner = getSurfaceOwner(box), detail = owner?.cuts.length ? maskedBoxHit(a, b, box, t, owner) : { t, normal: boxFaceNormal(a, b, box, t) };
      if (!detail) return null;
      return { ...detail, point: { x: mix(a.x, b.x, detail.t), y: mix(a.h, b.h, detail.t), z: mix(a.y, b.y, detail.t) } };
    }
    function trace(a, b, { terrain = true } = {}) {
      if (![a.x, a.y, a.h, b.x, b.y, b.h, b.x - a.x, b.y - a.y, b.h - a.h].every(finite)) return null;
      let best = null;
      const accept = (t, kind, object, detail) => { if (!best || t < best.t) best = { t, u: t, x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), h: mix(a.h, b.h, t), kind, object,
        ...(detail ? { point: { x: mix(a.x, b.x, t), y: mix(a.h, b.h, t), z: mix(a.y, b.y, t) }, ...detail } : {}) }; };
      for (const box of collisionIndex.along(a, b)) {
        if(box.bodyOnly)continue;
        const t = hitBox(a, b, box); if (t === null || best && t >= best.t) continue;
        const owner = getSurfaceOwner(box);
        if (owner?.cuts.length) {
          const hit = maskedBoxHit(a, b, box, t, owner); if (hit) accept(hit.t, 'easternFrontWall', box, hit);
        } else accept(t, 'easternFrontWall', box, !box.shape || box.shape === 'box' ? { normal: boxFaceNormal(a, b, box, t) } : undefined);
      }
      // Clip the ray to each crossing, then walk only the grid rows/columns
      // it actually visits. Each cell diagonal splits two exact planes; no
      // whole-mesh scan or fixed-distance ray sampling can miss a thin deck.
      for (const grid of bridgeSurfaces) {
        const xmin = grid.x - grid.halfWidth + offsets.x, xmax = grid.x + grid.halfWidth + offsets.x;
        const ymin = grid.z - grid.halfLength + offsets.z, ymax = grid.z + grid.halfLength + offsets.z;
        const dx = b.x - a.x, dy = b.y - a.y, dh = b.h - a.h;
        let enter = 0, leave = best ? best.t : 1;
        for (const [origin, delta, lo, hi] of [[a.x, dx, xmin, xmax], [a.y, dy, ymin, ymax]]) {
          if (!delta) { if (origin < lo || origin > hi) { enter = 1; leave = 0; break; } }
          else { const t0 = (lo - origin) / delta, t1 = (hi - origin) / delta; enter = Math.max(enter, Math.min(t0, t1)); leave = Math.min(leave, Math.max(t0, t1)); }
        }
        if (enter > leave) continue;
        const times = [enter, leave];
        if (dy) for (const row of grid.rows) { const t = (row + offsets.z - a.y) / dy; if (t > enter && t < leave) times.push(t); }
        if (dx) for (let i = 1; i < grid.nx; i++) { const t = (mix(xmin, xmax, i / grid.nx) - a.x) / dx; if (t > enter && t < leave) times.push(t); }
        times.sort((u, v) => u - v);
        const heightAt = t => gridHeight(grid, clamp(a.x + dx * t - offsets.x, grid.x - grid.halfWidth, grid.x + grid.halfWidth),
          clamp(a.y + dy * t - offsets.z, grid.z - grid.halfLength, grid.z + grid.halfLength)).height + offsets.h;
        function planeInterval(lo, hi) {
          const f0 = a.h + dh * lo - heightAt(lo), f1 = a.h + dh * hi - heightAt(hi);
          if (f0 <= 1e-8 && f0 >= -.7 - 1e-8) { accept(lo, 'easternFrontBridge', { id: grid.id }); return; }
          if (Math.abs(f1 - f0) < 1e-12) return;
          for (const level of [0, -.7]) { const u = (level - f0) / (f1 - f0); if (u >= 0 && u <= 1) accept(mix(lo, hi, u), 'easternFrontBridge', { id: grid.id }); }
        }
        if (times[0] === times.at(-1)) planeInterval(enter, leave);
        for (let n = 1; n < times.length; n++) {
          const lo = times[n - 1], hi = times[n]; if (hi - lo < 1e-12 || best && lo > best.t) continue;
          const mid = (lo + hi) / 2, mx = a.x + dx * mid - offsets.x, my = a.y + dy * mid - offsets.z;
          let low = 0, high = grid.nz; while (high - low > 1) { const j = (low + high) >> 1; if (grid.rows[j] <= my) low = j; else high = j; }
          const width = (grid.right[low] - grid.left[low]) / grid.nx, i = clamp(Math.floor((mx - grid.left[low]) / width), 0, grid.nx - 1);
          const x0 = grid.left[low] + width * i + offsets.x, y0 = grid.rows[low] + offsets.z, depth = grid.rows[high] - grid.rows[low];
          const diagonal = t => (a.x + dx * t - x0) / width + (a.y + dy * t - y0) / depth - 1;
          const d0 = diagonal(lo), d1 = diagonal(hi), split = d0 * d1 < 0 ? mix(lo, hi, d0 / (d0 - d1)) : null;
          if (split !== null) { planeInterval(lo, split); planeInterval(split, hi); } else planeInterval(lo, hi);
        }
      }
      // Test the bridge deck as a sloping 1.3m slab. The air below the span is
      // not solid, so bullets and swimming actors can pass beneath it.
      const crossesConnection = Math.max(a.x, b.x) >= connectionMinX && Math.min(a.x, b.x) <= connectionMaxX &&
        Math.max(a.y, b.y) >= connectionMinY && Math.min(a.y, b.y) <= connectionMaxY;
      for (const segment of crossesConnection ? connection.segments : EMPTY_BUCKET) {
        const sx = segment.x2 - segment.x1, sy = segment.y2 - segment.y1, length2 = sx * sx + sy * sy || 1;
        const ua = ((a.x - segment.x1) * sx + (a.y - segment.y1) * sy) / length2;
        const ub = ((b.x - segment.x1) * sx + (b.y - segment.y1) * sy) / length2;
        const fa = a.h - mix(segment.h1, segment.h2, ua), fb = b.h - mix(segment.h1, segment.h2, ub);
        const va=((a.x-segment.x1)*-sy+(a.y-segment.y1)*sx)/Math.sqrt(length2);
        const vb=((b.x-segment.x1)*-sy+(b.y-segment.y1)*sx)/Math.sqrt(length2);
        let enter=0,leave=best?best.t:1;
        for(const [origin,delta,lo,hi] of [[ua,ub-ua,0,1],[va,vb-va,-segment.width/2,segment.width/2],[fa,fb-fa,-1.3,0]]){
          if(Math.abs(delta)<1e-12){if(origin<lo||origin>hi){enter=1;leave=0;break;}}
          else{const t0=(lo-origin)/delta,t1=(hi-origin)/delta;enter=Math.max(enter,Math.min(t0,t1));leave=Math.min(leave,Math.max(t0,t1));}
        }
        if(enter<=leave)accept(enter,'easternFrontBridge',{id:connection.id});
      }
      // This trace is also called for mainland, city and northern-coast shots.
      // Those rays can miss both terrain domains entirely. Wall candidates
      // above remain authoritative, including authored boxes beyond the land.
      // Skip only the terrain sampling that is guaranteed to return undefined.
      const crossesTerrain = Math.max(a.x, b.x) >= bounds.minX && Math.min(a.x, b.x) <= bounds.maxX &&
        Math.max(a.y, b.y) >= bounds.minY && Math.min(a.y, b.y) <= bounds.maxY;
      if (!terrain || !crossesTerrain && !crossesConnection) return best;
      const length = Math.hypot(b.x - a.x, b.y - a.y, b.h - a.h), steps = Math.max(1, Math.min(4096, Math.ceil(length / 2)));
      let prior = 0;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps; if (best && t > best.t) break;
        const x = mix(a.x, b.x, t), y = mix(a.y, b.y, t), h = mix(a.h, b.h, t), surface = getTerrain(x, y);
        if (surface !== undefined && h <= surface + .02) {
          let lo = prior, hi = t;
          for (let j = 0; j < 8; j++) { const mid = (lo + hi) * .5, mx = mix(a.x, b.x, mid), my = mix(a.y, b.y, mid), mh = mix(a.h, b.h, mid), ms = getTerrain(mx, my); if (ms !== undefined && mh <= ms + .02) hi = mid; else lo = mid; }
          accept(hi, 'easternFrontTerrain', null); break;
        }
        prior = t;
      }
      return best;
    }
    // The structure viewer's figures have no body collision. Native people do:
    // a few authored trench-corner poses intersect the ends of timber walls.
    // Move only those poses to nearby clear floor, retaining identity, role,
    // height layer, faction and the complete authored deployment.
    const assignedSlots = [];
    function clearBody(x, y, h) {
      return !pointBlocked(x, y, h + .35, .45) && !pointBlocked(x, y, h + .65, .45) && !pointBlocked(x, y, h + .95, .45) && !pointBlocked(x, y, h + 1.65, .45);
    }
    function gradedGroundHome(member) {
      if (member.placement !== 'ground' || trenchAt(member.x, member.y) ||
          elevatedBridgeAt(member.x, member.y) || connectionAt(member.x, member.y)) return null;
      const history = roadGradeHistory(null);
      if (!history?.record.corridors?.length || !onGradedRoadBed(history, member.x, member.y)) return null;
      const terrain = getTerrain(member.x, member.y), old = sampleGridTerrain(history.main, history.patches, member.x, member.y);
      if (!finite(terrain) || !finite(old) || terrain < seaLevel + .2 || Math.abs(terrain - old) < .025) return null;
      // This is a fresh authored ground home, not a restored actor. Reconcile
      // analytical authoring heights with the baked triangles at the same X/Z
      // before the older collision-recovery search can shift that home.
      const road = roadSurfaceAt(member.x, member.y), h = Math.max(terrain, road?.height ?? -Infinity) + .02;
      if (bodyBlocked(member.x, member.y, h, 1.8, .42)) return null;
      return { x: member.x, y: member.y, h };
    }
    for (const member of roster) {
      const paved = gradedGroundHome(member) || recoverGradedRoadPoint(member) || recoverRoadPoint(member);
      if (paved) Object.assign(member, paved);
      let floor = getSurface(member.x, member.y, member.h, .15);
      if (!floor || floor.height < seaLevel || Math.abs(floor.height - member.h) > 1 || !clearBody(member.x, member.y, member.h)) {
        let candidate = null;
        for (let radius = .8; radius <= 12.01 && !candidate; radius += .8) {
          for (let direction = 0; direction < 24; direction++) {
            const angle = direction * Math.PI / 12, x = member.x + Math.cos(angle) * radius, y = member.y + Math.sin(angle) * radius;
            const sf = getSurface(x, y, member.h, .35);
            if (!sf || sf.height < seaLevel || Math.abs(sf.height - member.h) > 1 || !clearBody(x, y, sf.height + .02)) continue;
            if (assignedSlots.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < 2.25 && Math.abs(p.h - sf.height) < 2)) continue;
            candidate = { x, y, h: sf.height + .02 }; break;
          }
        }
        if (candidate) {
          member.authoredPosition = { x: member.x, y: member.y, h: member.h };
          Object.assign(member, candidate, { spawnAdjusted: true });
        }
      }
      // This local earthwork changed the bridge guards' standing height, not
      // their identities or positions. Use the baked triangles/road skin,
      // rather than keeping the analytical authoring height above/below them.
      if (bridgeSurfaces.length && member.siteId === 'C_IRON') {
        const corrected = getSurface(member.x, member.y, member.h + .75, 1.05, .42);
        if (corrected && Math.abs(corrected.height - member.h) <= 2 && clearBody(member.x, member.y, corrected.height + .02)) member.h = corrected.height + .02;
      }
      assignedSlots.push(member);
    }
    // A modest, symmetric expansion uses its own fixed IDs. Search beside an
    // existing ground guard and validate the complete walking leg, so a clear
    // point inside a disconnected wall pocket is never accepted as a home.
    const reservedGarrison = (Array.isArray(options.garrisonReserved) ? options.garrisonReserved : [])
      .filter(p => p && ['x', 'y', 'h', 'radius'].every(k => finite(p[k])) && p.radius > 0)
      .map(p => ({ x: p.x, y: p.y, h: p.h, radius: p.radius }));
    for (const v of vehicleSpawns) if (v.kind !== 'boat') reservedGarrison.push({ x: v.x, y: v.y, h: v.h, radius: 9 });
    for (const e of emplacements) reservedGarrison.push({ x: e.x, y: e.y, h: e.h, radius: 4.5 });
    for (const a of Object.values(routeData?.anchors || {})) {
      for (const p of a.stagingSlots || []) reservedGarrison.push({ x: p.x, y: p.y, h: p.h, radius: 1.6 });
    }
    function guardFloor(x, y, previous) {
      if (x < bounds.minX + 1 || x > bounds.maxX - 1 || y < bounds.minY + 1 || y > bounds.maxY - 1) return null;
      const floor = getSurface(x, y, previous, .45), terrain = getTerrain(x, y);
      if (!floor || !finite(terrain) || floor.height <= seaLevel + .2 || floor.height - terrain > 1.2 ||
          (finite(previous) && Math.abs(floor.height - previous) > .65) || bodyBlocked(x, y, floor.height + .02, 1.8, .5)) return null;
      for (const [dx, dy] of [[.5, 0], [-.5, 0], [0, .5], [0, -.5]]) {
        const edge = getSurface(x + dx, y + dy, floor.height, .45);
        if (!edge || edge.height <= seaLevel + .2 || Math.abs(edge.height - floor.height) > .38) return null;
      }
      return { x, y, h: floor.height + .02 };
    }
    function guardHome(site, ordinal) {
      const candidates = membersBySite.get(site.id).filter(m => !m.introducedIn && m.placement !== 'emplacement-crew')
        .sort((a, b) => (a.role === 'rifle' ? 0 : 1) - (b.role === 'rifle' ? 0 : 1) || a.index - b.index);
      const start = ordinal * 3;
      for (let n = 0; n < candidates.length; n++) {
        const seed = candidates[(n + start) % candidates.length], origin = guardFloor(seed.x, seed.y, seed.h);
        if (!origin) continue;
        for (let radius = 2.4; radius <= 14.41; radius += 1.2) {
          for (let direction = 0; direction < 24; direction++) {
            const angle = (direction + ordinal * 5) * Math.PI / 12;
            const x = seed.x + Math.cos(angle) * radius, y = seed.y + Math.sin(angle) * radius;
            if (Math.hypot(x - site.x, y - site.y) > Math.max(90, site.captureRadius + 35)) continue;
            const point = guardFloor(x, y, seed.h);
            if (!point || assignedSlots.some(p => dist2(p, point) < 3.24 && Math.abs(p.h - point.h) < 2) ||
                reservedGarrison.some(p => dist2(p, point) < p.radius * p.radius && Math.abs(p.h - point.h) < 8)) continue;
            let previous = origin.h, clear = true;
            const steps = Math.max(1, Math.ceil(radius / .5));
            for (let i = 1; i <= steps; i++) {
              const step = guardFloor(mix(seed.x, x, i / steps), mix(seed.y, y, i / steps), previous);
              if (!step) { clear = false; break; }
              previous = step.h;
            }
            if (clear) return point;
          }
        }
      }
      throw new Error('No walkable expanded garrison slot at ' + site.id + ' #' + (ordinal + 1));
    }
    for (const site of sites) {
      const count = site.type === 'outpost' ? 2 : 4, originalCount = site.count;
      for (let ordinal = 0; ordinal < count; ordinal++) {
        const position = guardHome(site, ordinal), number = String(originalCount + ordinal + 1).padStart(2, '0');
        const member = { id: 'ef-garrison-' + site.id + '-' + (ordinal + 1), index: roster.length,
          name: '소총수 ' + number, callsign: (site.initialOwner === 'ally' ? '청솔' : '적운') + '-' + site.index + '-G' + (ordinal + 1),
          team: site.initialOwner, initialTeam: site.initialOwner, siteId: site.id, siteName: site.name,
          role: 'rifle', roleName: '소총수', weapon: 'ar', weaponName: '돌격소총', secondary: '없음',
          equipment: ['돌격소총', '예비 탄창 3개', '방탄 조끼', '전투 헬멧'], duty: '거점 경계와 접근로 방어',
          placement: 'field-reinforcement', introducedIn: rosterRevision, rotation: site.initialOwner === 'ally' ? Math.PI : 0,
          ...position, z: position.y, hp: 100, dead: false, life: 0, availableAt: 0, diedAt: 0, byPlayer: false };
        roster.push(member); memberMap.set(member.id, member); membersBySite.get(site.id).push(member); assignedSlots.push(member); site.count++;
      }
      site.garrison = site.count;
      layout.points.find(p => p.id === site.id).garrison = site.count;
    }
    const initialAlly = roster.filter(r => r.initialTeam === 'ally').length;
    const initialEnemy = roster.filter(r => r.initialTeam === 'enemy').length;
    const initialAllySites = sites.filter(s => s.initialOwner === 'ally').length;
    const initialEnemySites = sites.filter(s => s.initialOwner === 'enemy').length;
    if (!initialAlly || initialAlly !== initialEnemy || initialAlly + initialEnemy !== roster.length ||
      memberMap.size !== roster.length || siteMap.size !== sites.length || sites.some(s => !s.count) ||
      roster.some(m => m.initialTeam !== siteMap.get(m.siteId).initialOwner)) throw new Error('Eastern front requires unique, populated sites and balanced initial factions.');
    // Navigation is baked from the same collision geometry as the native host.
    // These paths contain walkable body-clear waypoints, never straight-line
    // shortcuts through a building or a river. A missing optional route module
    // retains the original static deployment instead of inventing a route.
    const routeEdges = new Map(), travelCache = new Map(), gradedRoutePoints = new WeakMap(), gradedAnchors = new WeakMap();
    function gradedRoutePoint(point) {
      if (!roadGradeRevision || !point) return point;
      if (gradedRoutePoints.has(point)) return gradedRoutePoints.get(point);
      const repaired = recoverGradedRoadPoint(point, { routePoint: true }), result = repaired ? { ...point, h: repaired.h } : point;
      gradedRoutePoints.set(point, result); return result;
    }
    function gradedAnchor(point) {
      if (!roadGradeRevision || !point) return point;
      if (gradedAnchors.has(point)) return gradedAnchors.get(point);
      const result = { ...gradedRoutePoint(point), ...(Array.isArray(point.stagingSlots)
        ? { stagingSlots: point.stagingSlots.map(gradedRoutePoint) } : {}) };
      gradedAnchors.set(point, result); return result;
    }
    if (combatEnabled) for (const edge of routeData.edges) {
      if (!siteMap.has(edge.a) || !siteMap.has(edge.b) || !Array.isArray(edge.points) || edge.points.length < 2) continue;
      routeEdges.set(edge.a + '>' + edge.b, { ...edge, points: edge.points });
      routeEdges.set(edge.b + '>' + edge.a, { ...edge, points: [...edge.points].reverse(), reversed: true });
    }
    // The second repair keeps a bridge-era table as well as the original
    // pre-bridge table. A saved cursor is interpreted against its own geometry
    // before the corresponding waypoint fraction is moved to the current leg.
    const obstacleRouteEdges = new Map(routeEdges);
    if (routeWalkingRevision) for (const edge of routeData.walkingRepair?.legacyEdges || []) {
      obstacleRouteEdges.set(edge.a + '>' + edge.b, { ...edge, points: edge.points });
      obstacleRouteEdges.set(edge.b + '>' + edge.a, { ...edge, points: [...edge.points].reverse(), reversed: true });
    }
    const bridgeRouteEdges = new Map(obstacleRouteEdges);
    if (routeObstacleRevision) for (const edge of routeData.obstacleRepair?.legacyEdges || []) {
      bridgeRouteEdges.set(edge.a + '>' + edge.b, { ...edge, points: edge.points });
      bridgeRouteEdges.set(edge.b + '>' + edge.a, { ...edge, points: [...edge.points].reverse(), reversed: true });
    }
    const legacyRouteEdges = new Map(bridgeRouteEdges);
    if (routeGeometryRevision) for (const edge of routeData.geometryRepair?.legacyEdges || []) {
      legacyRouteEdges.set(edge.a + '>' + edge.b, { ...edge, points: edge.points });
      legacyRouteEdges.set(edge.b + '>' + edge.a, { ...edge, points: [...edge.points].reverse(), reversed: true });
    }
    const edgesFor = legacy => legacy === true ? legacyRouteEdges : legacy === 'bridge' ? bridgeRouteEdges : legacy === 'obstacle' ? obstacleRouteEdges : routeEdges;
    const rearBases = { ally: ['N_HQ', 'N_DEPOT', 'C_RUINS', 'C_FOUNDRY'], enemy: ['C_AIR', 'S_HQ', 'S_AIRFIELD', 'S_ENEMY_HQ'] };
    const positionOf = m => ({ x: m.x, y: m.y, h: m.h });
    for (const m of roster) {
      m.home = positionOf(m); m.mobile = false; m.phase = m.dead ? 'waiting' : 'garrison';
      m.sourceId = null; m.destinationId = m.siteId; m.dispatchAt = 0;
      m.routeSites = []; m.routeIndex = 0; m.frontSiteId = null;
    }
    function anchor(id, legacy = false) {
      if (!combatEnabled) return null;
      const point = legacy === true && id === 'C_IRON' && routeData.geometryRepair?.legacyAnchor || routeData.anchors[id];
      return legacy ? point : gradedAnchor(point);
    }
    function slot(id, index, legacy = false) {
      const a = anchor(id, legacy), slots = a?.stagingSlots;
      return Array.isArray(slots) && slots.length ? slots[index % slots.length] : a;
    }
    function edgePart(edge, distance) {
      const points = [edge.points[0]]; let left = Math.max(0, distance);
      for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1], b = edge.points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
        if (left >= length - 1e-8) { points.push(b); left -= length; }
        else {
          if (left > 1e-8) { const t = left / (length || 1); points.push({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), h: mix(a.h, b.h, t) }); }
          break;
        }
      }
      return points;
    }
    function travelRoute(m, legacy = false) {
      if (!combatEnabled || !m.routeSites.length) return [];
      const kind = m.phase === 'reinforcing' ? 'reinforce' : 'advance';
      const key = (legacy === true ? 'legacy:' : legacy === 'bridge' ? 'bridge:' : legacy === 'obstacle' ? 'obstacle:' : '') + kind + ':' + m.routeSites.join('>') + ':' + m.index;
      const cached = travelCache.get(m.index);
      if (cached && cached.key === key) return cached.points;
      let points = [];
      if (m.routeSites.length === 1) { const a = anchor(m.routeSites[0], legacy); if (a) points.push(a); }
      for (let i = 1; i < m.routeSites.length; i++) {
        const edge = edgesFor(legacy).get(m.routeSites[i - 1] + '>' + m.routeSites[i]);
        if (!edge) return [];
        let part = edge.points;
        if (kind === 'advance' && i === m.routeSites.length - 1) {
          const engagement = edge.engagement;
          let distance = engagement && finite(engagement.aDistance) && finite(engagement.bDistance)
            ? (edge.reversed ? edge.length - engagement.bDistance : engagement.aDistance)
            : Math.max(0, edge.length / 2 - 30);
          // A short column along the verified path gives each squad member a
          // distinct firing position without unverified lateral offsets.
          distance = Math.max(0, distance - (m.index % FRONT_SIZE) * 2.4);
          part = edgePart(edge, distance);
        }
        points.push(...(points.length ? part.slice(1) : part));
      }
      if (kind === 'reinforce') {
        const berth = slot(m.siteId, m.index, legacy);
        if (berth && (!points.length || dist2(berth, points[points.length - 1]) > .01)) points.push(berth);
      }
      // Historical generations retain their own coordinates for save repair.
      // The current physical route retains the edge ID and waypoint count;
      // its standing layer follows any later approved road-grade repair.
      if (!legacy && roadGradeRevision) points = points.map(gradedRoutePoint);
      // Retain only each member's current path. The key includes its geometry
      // generation, so original/bridge/current save migrations never share a
      // path while captures and slot reloads cannot retain historical routes.
      travelCache.set(m.index, { key, points }); return points;
    }
    function migrateRoutePose(member, legacy) {
      if (member.dead) return;
      let target = null, cursor = member.routeIndex;
      const changed = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) > .01 || Math.abs(a.h - b.h) > .01;
      if (member.routeSites.length && ['advancing', 'reinforcing', 'front'].includes(member.phase)) {
        const before = travelRoute(member, legacy), after = travelRoute(member);
        if (!before.length || !after.length) return;
        if (member.phase === 'front') {
          if (before.length === after.length && !changed(before.at(-1), after.at(-1))) return;
          target = after.at(-1); cursor = after.length;
        }
        else {
          const oldIndex = Math.min(member.routeIndex, before.length - 1);
          cursor = Math.min(member.routeIndex, after.length - 1);
          const oldStart = oldIndex ? before[oldIndex - 1] : slot(member.routeSites[0], member.index, legacy) || before[0];
          const newStart = cursor ? after[cursor - 1] : slot(member.routeSites[0], member.index) || after[0];
          const oldEnd = before[oldIndex], newEnd = after[cursor];
          if (cursor === member.routeIndex && !changed(oldStart, newStart) && !changed(oldEnd, newEnd)) return;
          const p = project(member.x, member.y, oldStart, oldEnd);
          // Active actors can be a little off their centreline while avoiding
          // one another. Distant, unrelated displacement is not relocated.
          if (p.distance > 8) return;
          target = { x: mix(newStart.x, newEnd.x, p.t), y: mix(newStart.y, newEnd.y, p.t), h: mix(newStart.h, newEnd.h, p.t) };
        }
      } else if (legacy === true && member.phase === 'garrison' && member.siteId === 'C_IRON' &&
          Math.abs(member.x - 2473) < 52 && Math.abs(member.y - 886) < 182) {
        target = { x: member.x, y: member.y, h: getSurface(member.x, member.y, 10000, .55, .42)?.height };
      }
      if (!target || !finite(target.h)) return;
      const support = getSurface(target.x, target.y, target.h + .5, 1.05, .42);
      if (!support || bodyBlocked(target.x, target.y, support.height, 1.8, .42)) {
        if (member.phase !== 'garrison') return;
        target = member.home;
      } else target = { x: target.x, y: target.y, h: support.height };
      if (cursor === member.routeIndex && Math.hypot(target.x - member.x, target.y - member.y) < 1e-7 && Math.abs(target.h - member.h) < .04) return;
      Object.assign(member, target, { routeIndex: cursor });
      routeRepairs.push({ id: member.id, x: member.x, y: member.y, h: member.h });
    }
    // Garrisons retain their authored posts. Hostile neighbours no longer
    // stage columns for an autonomous battle when the player is elsewhere.
    function canPatrol(m) {
      return m.placement !== 'emplacement-crew' && m.placement !== 'authored-walkway' &&
        !['mortar', 'rocket'].includes(m.role) && m.home.h - getTerrain(m.home.x, m.home.y) <= 1.2;
    }
    for (const m of roster) m.mobile = canPatrol(m);
    const patrols = new Map(), patrolArrivals = new Set();
    let patrolBudgetBucket = -1, patrolBudget = 0, distantPatrolCursor = 0;
    function patrolBudgetAvailable() {
      const bucket = Math.floor(clock * 4 + 1e-8);
      if (bucket !== patrolBudgetBucket) { patrolBudgetBucket = bucket; patrolBudget = 2; }
      if (patrolBudget <= 0) return false;
      patrolBudget--; return true;
    }
    function patrolLeg(start, target, limit = PATROL_RADIUS) {
      const distance = Math.hypot(start.x - target.x, start.y - target.y);
      if (distance > limit + 1e-6) return null;
      const points = [], steps = Math.max(1, Math.ceil(distance / .3));
      let h = start.h;
      for (let i = 0; i <= steps; i++) {
        const x = mix(start.x, target.x, i / steps), y = mix(start.y, target.y, i / steps);
        const point = guardFloor(x, y, h), footprint = getSurface(x, y, h, .55, .42);
        if (!point || !footprint || Math.abs(footprint.height - point.h) > .2 ||
            reservedGarrison.some(p => dist2(point, p) < p.radius * p.radius && Math.abs(point.h - p.h) < 8)) return null;
        h = point.h; points.push(point);
      }
      return points;
    }
    function patrolFor(m, allowPlan = true) {
      if (!m.mobile || m.dead || m.availableAt > clock || m.phase !== 'garrison') return null;
      const found = patrols.get(m.id);
      if (found && found.revision === surfaceGeometryRevision) return found;
      if (!allowPlan || !patrolBudgetAvailable()) return null;
      const home = { ...m.home }, radius = 3 + m.index % 4;
      let points = null;
      // At most two short, locally checked directions per planning slot. No
      // broad path search or enemy scan runs for a distant garrison.
      for (let direction = 0; direction < 2 && !points; direction++) {
        const angle = (m.index * 2.399963229728653) + direction * Math.PI / 2;
        points = patrolLeg(home, { x: home.x + Math.cos(angle) * radius, y: home.y + Math.sin(angle) * radius });
      }
      const memo = { points, revision: surfaceGeometryRevision, rejoin: null };
      patrols.set(m.id, memo); return memo;
    }
    function patrolDestination(m, memo) {
      const points = memo?.points;
      if (!points?.length) return m.home;
      if (dist2(m, m.home) > (PATROL_RADIUS + .5) ** 2) return m.home;
      const duration = Math.hypot(points.at(-1).x - m.home.x, points.at(-1).y - m.home.y) / PATROL_SPEED + 2;
      return Math.floor((clock + m.index * .73) / duration) % 2 ? m.home : points.at(-1);
    }
    function patrolOrder(m) {
      if (dist2(m, m.home) <= (PATROL_RADIUS + .5) ** 2) patrolArrivals.delete(m.id);
      if (!m.mobile) return null;
      const memo = patrolFor(m);
      // Native movement still checks collisions. While planning is spread
      // over frames, a displaced guard can already return toward its own post.
      const target = patrolDestination(m, memo);
      return { ...target, speed: PATROL_SPEED, kind: 'patrol', stopRadius: .3 };
    }
    function moveDistantPatrol(m, dt) {
      const memo = patrolFor(m, false), points = memo?.points;
      if (!points?.length) return;
      const start = points[0], end = points.at(-1), projection = project(m.x, m.y, start, end);
      let path = points;
      // A native battle may hand off a guard away from its short patrol lane.
      // Rejoin only by a checked connector; never teleport it through a wall.
      if (projection.distance > .06 || dist2(m, m.home) > (PATROL_RADIUS + .5) ** 2) {
        if (!memo.rejoin) {
          if (!patrolBudgetAvailable()) return;
          memo.rejoin = patrolLeg(positionOf(m), m.home, 24) || [];
        }
        path = memo.rejoin;
        if (!path.length) return;
      }
      const target = path === points ? patrolDestination(m, memo) : m.home;
      const distance = Math.hypot(target.x - m.x, target.y - m.y);
      if (distance <= .08) { if (path !== points) memo.rejoin = null; return; }
      const step = Math.min(distance, PATROL_SPEED * dt), ratio = step / distance;
      const x = mix(m.x, target.x, ratio), y = mix(m.y, target.y, ratio);
      // Read only the matching prechecked short segment's standing height.
      let h = m.h, best = Infinity;
      for (let i = 1; i < path.length; i++) {
        const q = project(x, y, path[i - 1], path[i]);
        if (q.distance < best) { best = q.distance; h = mix(path[i - 1].h, path[i].h, q.t); }
      }
      if (best > .06) return;
      m.x = x; m.y = y; m.h = h;
    }
    function placeUnloadedArrival(m) {
      if (!patrolArrivals.has(m.id) || m.dead || m.phase !== 'garrison') return false;
      const site = siteMap.get(m.siteId), source = siteMap.get(m.sourceId), berth = slot(m.siteId, m.index);
      if (!source || source.owner !== site.owner || !berth ||
          dist2(m, site) > Math.max(160, site.captureRadius * 2) ** 2) return false;
      const home = getSurface(m.home.x, m.home.y, m.home.h + .35, .55, .42);
      const arrival = getSurface(berth.x, berth.y, berth.h + .35, .55, .42);
      if (!home || !arrival || Math.abs(home.height - m.home.h) > 1 || Math.abs(arrival.height - berth.h) > 1 ||
          bodyBlocked(m.home.x, m.home.y, home.height + .02, 1.8, .42) ||
          bodyBlocked(berth.x, berth.y, arrival.height + .02, 1.8, .42)) return false;
      // Only the unloaded update path calls this local arrival handoff. The
      // column has already walked its complete friendly supply route to the
      // base; assign its existing soldier to the prevalidated guard post once.
      // Loaded/native replacements keep collision-driven walking to that post.
      Object.assign(m, { x: m.home.x, y: m.home.y, h: home.height + .02 });
      patrolArrivals.delete(m.id); patrols.delete(m.id); return true;
    }
    const combatDefaults = new Map(roster.map(m => [m.id, { x: m.x, y: m.y, h: m.h, mobile: m.mobile,
      phase: m.phase, frontSiteId: m.frontSiteId, routeSites: [...m.routeSites] }]));
    function epochOf(member) { return siteMap.get(member.siteId).garrisonEpoch * 100000 + member.life; }
    function getMember(id) {
      const m = memberMap.get(id); if (!m) return null; const team = siteMap.get(m.siteId).owner;
      const path = m.phase === 'reinforcing' ? travelRoute(m) : [];
      const reinforcementProgress = m.phase === 'reinforcing' ? clamp(m.routeIndex / Math.max(1, path.length - 1), 0, 1) : (m.sourceId && !m.dead ? 1 : 0);
      return { ...m, home: { ...m.home }, routeSites: [...m.routeSites], team, epoch: epochOf(m),
        alive: !m.dead && m.availableAt <= clock, available: !m.dead && m.availableAt <= clock, reinforcementProgress };
    }
    // Native AI only needs these scalar fields. Allow its caller to reuse a
    // scratch record instead of copying home, routes and every authored field
    // several times per soldier per frame. Public roster snapshots stay copies.
    function getMemberState(id, out = {}) {
      const m = memberMap.get(id); if (!m) return null;
      out.epoch = epochOf(m); out.alive = !m.dead && m.availableAt <= clock;
      out.dead = m.dead; out.index = m.index; out.hp = m.hp;
      return out;
    }
    function getRoster() { return roster.map(m => getMember(m.id)); }
    function activeRoster(player, radius = 420, max = 96) {
      if (!player || player.alive === false || !finite(player.x) || !finite(player.y)) return [];
      return roster.filter(m => !m.dead && m.availableAt <= clock && dist2(m, player) <= radius * radius)
        .sort((a, b) => dist2(a, player) - dist2(b, player) || a.index - b.index).slice(0, Math.max(0, max | 0)).map(m => getMember(m.id));
    }
    function markPlayerImpact(id) {
      const site = siteMap.get(id); if (!site) return false; site.playerImpact = true; return true;
    }
    function reportDeath(id, info = {}) {
      const m = memberMap.get(id); if (!m || m.dead || (finite(info.epoch) && info.epoch !== epochOf(m))) return false;
      const site = siteMap.get(m.siteId);
      if (site.owner === 'enemy') site.defeatedInfantry = Math.min(Number.MAX_SAFE_INTEGER, site.defeatedInfantry + 1);
      m.dead = true; m.hp = 0; m.diedAt = clock; m.byPlayer = !!info.byPlayer;
      enemyMarchQueueDirty = true;
      patrolArrivals.delete(m.id);
      m.phase = 'waiting'; m.dispatchAt = clock + (siteMap.get(m.siteId).owner === 'enemy'
        ? ENEMY_REPLACEMENT_DELAY : REPLACEMENT_DELAY) + (m.index % FRONT_SIZE) * 2;
      m.routeSites = []; m.routeIndex = 0; m.frontSiteId = null; m.sourceId = null;
      if (info.byPlayer) markPlayerImpact(m.siteId);
      events.push({ type: 'casualty', memberId: id, siteId: m.siteId, team: siteMap.get(m.siteId).owner, byPlayer: m.byPlayer, at: clock }); return true;
    }
    // The native host calls this only after the separate response roster has
    // accepted a death (its epoch/dead guards reject duplicate notifications).
    // Match the response defender zones; leaving a zone or retiring is no kill.
    function reportExternalDeath(position, info = {}) {
      if (!position || !finite(position.x) || !finite(position.y)) return false;
      let counted = false;
      for (const site of sites) if (site.owner === 'enemy' && dist2(position, site) <= Math.max(160, site.captureRadius * 2) ** 2) {
        site.defeatedInfantry = Math.min(Number.MAX_SAFE_INTEGER, site.defeatedInfantry + 1);
        if (info.byPlayer) site.playerImpact = true;
        counted = true;
      }
      return counted;
    }
    function setMemberHealth(id, hp, info = {}) {
      if (finite(info)) info = { epoch: info };
      const m = memberMap.get(id); if (!m || m.dead || !finite(hp) || (finite(info.epoch) && info.epoch !== epochOf(m))) return false;
      if (hp <= 0) return reportDeath(id, info); m.hp = clamp(hp, 0, 100); return true;
    }
    function setMemberPosition(id, p, epoch) {
      const m = memberMap.get(id);
      if (!m || m.dead || (finite(epoch) && epoch !== epochOf(m)) || !p || ![p.x, p.y, p.h].every(finite) ||
          !inBounds(p.x, p.y) || p.h < seaLevel - 30 || p.h > 600) return false;
      m.x = p.x; m.y = p.y; m.h = p.h; return true;
    }
    function refreshEnemyMarchQueue() {
      if (!enemyMarchQueueDirty) return;
      const queued = roster.filter(m => !m.dead && m.phase === 'reinforcing' && siteMap.get(m.siteId).owner === 'enemy');
      queued.sort((a, b) => a.availableAt - b.availableAt || a.index - b.index);
      enemyMarchingCount = queued.length;
      enemyMarchPermits = new Set(queued.slice(0, ENEMY_REPLACEMENT_CAP).map(m => m.id));
      enemyMarchQueueDirty = false;
    }
    function getOrder(id) {
      const m = memberMap.get(id);
      if (!m || m.dead || m.availableAt > clock) return null;
      if (m.phase === 'garrison') return patrolOrder(m);
      if (!combatEnabled || m.phase !== 'reinforcing') return null;
      // Historical saves can already contain more than six incoming soldiers.
      // Keep every survivor exactly where they are; queue excess movement at
      // those actual positions instead of deleting bodies or teleporting them.
      // Membership changes only on lifecycle events, never via a per-actor scan.
      refreshEnemyMarchQueue();
      if (siteMap.get(m.siteId).owner === 'enemy' && !enemyMarchPermits.has(m.id))
        return { ...positionOf(m), speed: 0, kind: 'reinforce', hold: true, stopRadius: .08 };
      const points = travelRoute(m); if (!points.length) return null;
      // Reinforcement logistics still use the verified friendly supply route.
      // Arrival ends at the assigned garrison and never starts a new assault.
      // Native movement must use this route's explicit 0.08m stopping radius.
      // Its generic 0.65m combat stop left replacements short of every 0.12m
      // waypoint acknowledgement, stacking the column at its first turn.
      while (m.routeIndex < points.length && dist2(m, points[m.routeIndex]) <= .0144 && Math.abs(m.h - points[m.routeIndex].h) < 2) m.routeIndex++;
      if (m.routeIndex >= points.length) {
        m.phase = 'garrison'; m.routeSites = []; m.routeIndex = 0; patrolArrivals.add(m.id);
        enemyMarchQueueDirty = true;
        events.push({ type: 'reinforcement-arrived', memberId: m.id, siteId: m.siteId, sourceId: m.sourceId, team: siteMap.get(m.siteId).owner, at: clock });
        return patrolOrder(m);
      }
      return { ...points[m.routeIndex], speed: siteMap.get(m.siteId).owner === 'enemy' ? ENEMY_MARCH_SPEED : MARCH_SPEED,
        kind: 'reinforce', stopRadius: .08 };
    }
    function rearPath(siteId, team, player = null) {
      const distances = new Map([[siteId, 0]]), previous = new Map(), remaining = new Set([siteId]), done = new Set();
      while (remaining.size) {
        let current = null;
        for (const id of remaining) if (current === null || distances.get(id) < distances.get(current)) current = id;
        remaining.delete(current); done.add(current);
        if (rearBases[team].includes(current) && siteMap.get(current).owner === team &&
            (team !== 'enemy' || current !== siteId && !present(player, siteMap.get(current), ENEMY_REPLACEMENT_EXCLUSION))) {
          const route = [current]; while (previous.has(route[route.length - 1])) route.push(previous.get(route[route.length - 1]));
          return route;
        }
        for (const next of neighbours.get(current)) {
          const edge = routeEdges.get(current + '>' + next);
          if (!edge || done.has(next) || siteMap.get(next).owner !== team) continue;
          const distance = distances.get(current) + edge.length;
          if (!distances.has(next) || distance < distances.get(next)) { distances.set(next, distance); previous.set(next, current); remaining.add(next); }
        }
      }
      return null;
    }
    function dispatchReplacement(m, context = {}, budget = null) {
      if (!combatEnabled || !m.dead || clock + 1e-8 < m.dispatchAt || m.life >= 99999) return false;
      const site = siteMap.get(m.siteId), team = site.owner;
      if (team === 'enemy' && (!budget?.scan || budget.marching >= ENEMY_REPLACEMENT_CAP ||
          clock + 1e-8 < enemyReplacementAt || clock - m.diedAt + 1e-8 < ENEMY_REPLACEMENT_DELAY ||
          context.player?.alive === false || present(context.player, site, ENEMY_REPLACEMENT_EXCLUSION) ||
          present(context.player, m, ENEMY_REPLACEMENT_EXCLUSION))) return false;
      const route = rearPath(m.siteId, team, context.player), start = route && slot(route[0], m.index);
      if (!route || !start) return false;
      if (team === 'enemy' && present(context.player, start, ENEMY_REPLACEMENT_EXCLUSION)) return false;
      m.life++; m.dead = false; m.hp = 100; m.byPlayer = false; m.availableAt = clock;
      m.mobile = canPatrol(m);
      m.phase = 'reinforcing'; m.sourceId = route[0]; m.routeSites = route; m.routeIndex = 0; m.frontSiteId = null;
      Object.assign(m, positionOf(start));
      if (team === 'enemy') { enemyReplacementAt = clock + ENEMY_REPLACEMENT_INTERVAL; budget.marching++; }
      enemyMarchQueueDirty = true;
      events.push({ type: 'reinforcement-dispatched', memberId: m.id, siteId: m.siteId, sourceId: m.sourceId, team, epoch: epochOf(m), at: clock });
      return true;
    }
    function moveOffscreen(m, dt) {
      let distance = (siteMap.get(m.siteId).owner === 'enemy' ? ENEMY_MARCH_SPEED : MARCH_SPEED) * dt, guard = 0;
      while (distance > 1e-6 && guard++ < 32) {
        const order = getOrder(m.id);
        if (m.phase !== 'reinforcing') { placeUnloadedArrival(m); break; }
        if (!order || order.hold === true || order.speed === 0) break;
        const length = Math.hypot(order.x - m.x, order.y - m.y);
        if (length < 1e-8) break;
        const step = Math.min(length, distance), ratio = step / length;
        const x = mix(m.x, order.x, ratio), y = mix(m.y, order.y, ratio);
        // Waypoints are on terrain/bridge support. Sample that same surface
        // between vertices; a height interpolation alone could cut a stair.
        const expectedHeight = mix(m.h, order.h, ratio);
        const surface = getSurface(x, y, expectedHeight, 1.05, .42);
        m.x = x; m.y = y; m.h = surface ? surface.height : expectedHeight; distance -= step;
        if (m.phase !== 'reinforcing') break;
      }
    }
    function repairMissions() {
      for (const m of roster) {
        if (m.dead || !m.routeSites.length) continue;
        const team = siteMap.get(m.siteId).owner;
        const valid = m.phase === 'reinforcing'
          ? m.routeSites.every(id => siteMap.get(id).owner === team)
          : m.frontSiteId && siteMap.get(m.frontSiteId).owner !== team;
        if (!valid) {
          // A severed supply column holds its actual position. It never jumps
          // across newly hostile territory or silently converts a site.
          m.phase = 'garrison'; m.routeSites = []; m.routeIndex = 0; m.frontSiteId = null;
          enemyMarchQueueDirty = true;
        }
      }
    }
    function connected(team) {
      const roots = layoutRevision
        ? (team === 'ally' ? ['N_HQ', 'C_GATE'] : ['C_AIR', 'S_HQ', 'S_ENEMY_HQ'])
        : (team === 'ally' ? ['N_HQ', 'C_GATE', 'S_HQ'] : ['N_RADAR', 'C_AIR', 'S_ENEMY_HQ']);
      const reached = new Set(), todo = roots.filter(id => siteMap.get(id).owner === team);
      while (todo.length) { const id = todo.pop(); if (reached.has(id)) continue; reached.add(id); for (const next of neighbours.get(id)) if (!reached.has(next) && siteMap.get(next).owner === team) todo.push(next); }
      return reached;
    }
    function frontier(site, team, supply) { return neighbours.get(site.id).some(id => siteMap.get(id).owner === team && supply.has(id)); }
    function present(player, site, radius) {
      return !!player && player.alive !== false && finite(player.x) && finite(player.y) && dist2(player, site) <= radius * radius;
    }
    function grounded(player, site) {
      if (!present(player, site, site.captureRadius) || player.grounded === false || player.vehicle || (finite(player.alt) && player.alt > 1.5)) return false;
      if (!finite(player.h)) return player.grounded === true;
      const surface = getSurface(player.x, player.y, player.h, .5);
      return !!surface && Math.abs(player.h - surface.height) < 4;
    }
    function defenders(site) {
      return membersBySite.get(site.id).reduce((n, m) => n + (!m.dead &&
        (!combatEnabled || dist2(m, site) <= Math.max(160, site.captureRadius * 2) ** 2) ? 1 : 0), 0);
    }
    function captureStatus(id, player) {
      const site = siteMap.get(id); if (!site) return null;
      const remaining = defenders(site) + (externalDefenders.get(id) || 0), supplied = frontier(site, 'ally', connected('ally'));
      const vehicles = externalVehicles.get(id) || 0;
      return { id, owner: site.owner, progress: site.capture, pressure: site.pressure, remainingDefenders: remaining,
        remainingInfantry: remaining - vehicles, remainingVehicles: vehicles, defeatedInfantry: site.defeatedInfantry,
        captureSeconds: CAPTURE_SECONDS, secondsRemaining: (1 - site.capture) * CAPTURE_SECONDS,
        inRange: present(player, site, site.captureRadius), grounded: grounded(player, site), connected: supplied,
        engaged: site.playerImpact, canCapture: site.owner === 'enemy' && site.playerImpact && remaining === 0 && supplied && grounded(player, site),
        warning: site.warningIssued, secondsToReclaim: Math.max(0, RECLAIM_GRACE - site.absent) + (1 - site.pressure) * RECLAIM_SECONDS };
    }
    function changeOwner(site, owner) {
      enemyMarchQueueDirty = true;
      if (owner === 'enemy') site.defeatedInfantry = 0;
      site.owner = owner; site.garrisonEpoch++; site.changedAt = clock; site.capture = 0; site.pressure = 0;
      site.absent = 0; site.warningIssued = false; site.playerImpact = false; site.graceUntil = clock + RECLAIM_GRACE;
      if (owner === 'ally') site.everCaptured = true;
      membersBySite.get(site.id).forEach((m, i) => {
        patrolArrivals.delete(m.id);
        m.team = owner; m.dead = combatEnabled; m.hp = combatEnabled ? 0 : 100; m.life = 0; m.byPlayer = false; m.diedAt = clock;
        m.availableAt = clock + REPLACEMENT_DELAY + (m.index % FRONT_SIZE) * 2;
        m.phase = combatEnabled ? 'waiting' : 'garrison'; m.dispatchAt = m.availableAt; m.sourceId = null;
        m.routeSites = []; m.routeIndex = 0; m.frontSiteId = null; m.mobile = canPatrol(m);
      });
      repairMissions();
      events.push({ type: owner === 'ally' ? 'captured' : 'reclaimed', siteId: site.id, owner, epoch: site.garrisonEpoch, at: clock, rewardAvailable: owner === 'ally' && !site.rewardClaimed });
    }
    function observeDefenders(reported, vehicles) {
      // Native reinforcement occupants are transient observations, not authored
      // garrison records. Capture simulation and UI share the same sanitized
      // snapshot; omitting the next report clears it and saves never retain it.
      externalDefenders.clear(); externalVehicles.clear();
      if (reported && typeof reported === 'object') for (const site of sites) {
        const count = reported[site.id];
        if (!finite(count) || count <= 0) continue;
        const total = Math.min(1024, Math.ceil(count));
        externalDefenders.set(site.id, total);
        const hulls = vehicles && vehicles[site.id];
        if (finite(hulls) && hulls > 0) externalVehicles.set(site.id, Math.min(total, Math.ceil(hulls)));
      }
    }
    function update(dt, context = {}) {
      if (!finite(dt) || dt <= 0) return;
      observeDefenders(context.liveEnemiesBySite, context.liveEnemyVehiclesBySite);
      // Offline wall time is never advanced; the host supplies simulation dt.
      const active = new Set(Array.isArray(context.activeMemberIds) || context.activeMemberIds instanceof Set ? context.activeMemberIds : []);
      let left = Math.min(dt, 60);
      while (left > 0) {
        const step = Math.min(left, 1), previousTick = Math.floor(clock + 1e-8); left -= step; clock += step; battlePulse = (battlePulse + step) % 16;
        const player = context.player, allySupply = connected('ally');
        for (const site of sites) {
          if (site.owner === 'enemy') {
            const clear = defenders(site) === 0 && !(externalDefenders.get(site.id) > 0);
            if (site.playerImpact && clear && grounded(player, site) && frontier(site, 'ally', allySupply) && context.captureHeld !== false) {
              site.capture = Math.min(1, site.capture + step / CAPTURE_SECONDS);
              if (site.capture >= 1 - 1e-9) changeOwner(site, 'ally');
            } else site.capture = Math.max(0, site.capture - step / (CAPTURE_SECONDS * 2));
          } else if (site.initialOwner === 'enemy' && site.everCaptured) {
            // Absence is not a simulated defeat. A captured site holds until
            // actual player-led campaign rules change its owner.
            site.absent = 0; site.warningIssued = false; site.pressure = 0;
          }
          // Compatibility fallback when navigation assets are unavailable.
          if (!combatEnabled && site.owner !== 'enemy' && !present(player, site, 520) && clock - site.changedAt >= REPLACEMENT_DELAY) {
            for (const m of membersBySite.get(site.id)) if (m.dead && clock - m.diedAt >= REINFORCE_SECONDS) {
              m.dead = false; m.hp = 100; m.life++; m.byPlayer = false; m.availableAt = clock + 8 + m.index % 12; m.phase = 'garrison';
              Object.assign(m, positionOf(m.home));
            }
          }
        }
        if (combatEnabled) {
          repairMissions();
          // Replacements are logistics, not an independent combat spawn path.
          // One bounded scan per second prevents a destroyed distant garrison
          // from running the supply graph again on every simulation frame.
          refreshEnemyMarchQueue();
          const replacementBudget = { scan: clock + 1e-8 >= enemyReplacementScanAt, marching: enemyMarchingCount };
          if (replacementBudget.scan) enemyReplacementScanAt = clock + 1;
          for (const m of roster) {
            if (dispatchReplacement(m, context, replacementBudget)) continue;
            if (!m.dead && m.availableAt <= clock && !active.has(m.id) && m.phase === 'reinforcing') moveOffscreen(m, step);
          }
        }
        if (Math.floor(clock + 1e-8) > previousTick) {
          // Unloaded patrols take one cheap step per simulation second.
          // Plan at most one extra remote lane; nearby native getOrder calls
          // have the other budget slots and take priority over distant guards.
          for (let tried = 0; tried < roster.length; tried++) {
            const m = roster[distantPatrolCursor++ % roster.length];
            if (m.mobile && !m.dead && m.phase === 'garrison' && !active.has(m.id) &&
                patrols.get(m.id)?.revision !== surfaceGeometryRevision) { patrolFor(m); break; }
          }
          for (const m of roster) if (!m.dead && m.availableAt <= clock && m.phase === 'garrison' && !active.has(m.id)) {
            placeUnloadedArrival(m); moveDistantPatrol(m, 1);
          }
        }
      }
    }
    function claimReward(id) {
      const site = siteMap.get(id); if (!site || !site.everCaptured || site.rewardClaimed) return null;
      site.rewardClaimed = true; return { id: 'ef-first-capture-' + id, siteId: id, xp: 100 + site.value * 20, firstCapture: true };
    }
    function serialize() {
      return { schema: SCHEMA, version: 1, ...(layoutRevision ? { layoutRevision } : {}), rosterRevision, ...(combatEnabled ? { combatRevision } : {}), patrolRevision, ...(routeGeometryRevision ? { routeGeometryRevision } : {}), ...(routeObstacleRevision ? { routeObstacleRevision } : {}), ...(routeWalkingRevision ? { routeWalkingRevision } : {}), ...(trenchRevision ? { trenchRevision } : {}), ...(roadGradeRevision ? { roadGradeRevision } : {}), clock,
        enemyReplacement: { version: 1, nextDispatchAt: enemyReplacementAt },
        sites: sites.map(s => ({ id: s.id, owner: s.owner, capture: s.capture, pressure: s.pressure, absent: s.absent,
          changedAt: s.changedAt, graceUntil: s.graceUntil, garrisonEpoch: s.garrisonEpoch, playerImpact: s.playerImpact,
          everCaptured: s.everCaptured, rewardClaimed: s.rewardClaimed, warningIssued: s.warningIssued, defeatedInfantry: s.defeatedInfantry })),
        members: roster.map(m => ({ id: m.id, hp: m.hp, dead: m.dead, life: m.life, availableAt: m.availableAt, diedAt: m.diedAt, byPlayer: m.byPlayer,
          ...(combatEnabled ? { combat: { phase: m.phase, x: m.x, y: m.y, h: m.h, mobile: m.mobile, sourceId: m.sourceId, destinationId: m.siteId,
            dispatchAt: m.dispatchAt, routeSites: [...m.routeSites], routeIndex: m.routeIndex, frontSiteId: m.frontSiteId } } : {}) })) };
    }
    function restore(saved) {
      if (!saved || saved.schema !== SCHEMA || saved.version !== 1 || !finite(saved.clock) || saved.clock < 0 || !Array.isArray(saved.sites) || !Array.isArray(saved.members)) return false;
      if (saved.enemyReplacement !== undefined && (!saved.enemyReplacement || saved.enemyReplacement.version !== 1 ||
          !finite(saved.enemyReplacement.nextDispatchAt) || saved.enemyReplacement.nextDispatchAt < 0 ||
          saved.enemyReplacement.nextDispatchAt > saved.clock + ENEMY_REPLACEMENT_INTERVAL + 1e-6)) return false;
      // Accept only complete known generations. The growth tag requires every
      // fixed new slot; a truncated current save is never a migration request.
      if (saved.rosterRevision !== undefined && ![outpostRevision, rosterRevision].includes(saved.rosterRevision)) return false;
      if (saved.combatRevision !== undefined && saved.combatRevision !== combatRevision) return false;
      if (saved.patrolRevision !== undefined && saved.patrolRevision !== patrolRevision) return false;
      if (saved.trenchRevision !== undefined && saved.trenchRevision !== trenchRevision) return false;
      const savedGradeRevision = saved.roadGradeRevision ?? null;
      if (savedGradeRevision !== null && savedGradeRevision !== roadGradeRevision && !roadGradeSources.has(savedGradeRevision)) return false;
      const migrateRoadGrade = !!roadGradeRevision && savedGradeRevision !== roadGradeRevision;
      if (saved.routeGeometryRevision !== undefined && saved.routeGeometryRevision !== 'iron-bridge-20261123-v1') return false;
      const migrateRouteGeometry = !!routeGeometryRevision && saved.routeGeometryRevision === undefined;
      if (saved.routeObstacleRevision !== undefined && (saved.routeObstacleRevision !== routeObstacleRevision || saved.routeGeometryRevision !== routeGeometryRevision)) return false;
      const migrateRouteObstacles = !!routeObstacleRevision && saved.routeObstacleRevision === undefined;
      if (saved.routeWalkingRevision !== undefined && (saved.routeWalkingRevision !== routeWalkingRevision || saved.routeObstacleRevision !== routeObstacleRevision || saved.routeGeometryRevision !== routeGeometryRevision)) return false;
      const migrateRouteWalking = !!routeWalkingRevision && saved.routeWalkingRevision === undefined;
      const legacyRoutes = migrateRouteGeometry ? true : migrateRouteObstacles ? 'bridge' : migrateRouteWalking ? 'obstacle' : false;
      if (saved.combatRevision !== undefined && (![outpostRevision, rosterRevision].includes(saved.rosterRevision) || (layoutRevision && saved.layoutRevision !== layoutRevision))) return false;
      const migrateCombat = saved.combatRevision === undefined;
      if (migrateCombat && saved.members.some(m => m && m.combat !== undefined)) return false;
      const addedSiteIds = new Set(sites.filter(s => s.introducedIn === outpostRevision).map(s => s.id));
      const previousSites = sites.filter(s => !addedSiteIds.has(s.id));
      const previousMembers = authoredRoster.filter(m => !addedSiteIds.has(m.siteId));
      const migrateOutposts = saved.rosterRevision === undefined && addedSiteIds.size > 0 && saved.sites.length === previousSites.length && saved.members.length === previousMembers.length;
      const migrateGrowth = saved.rosterRevision !== rosterRevision && !migrateOutposts &&
        saved.sites.length === sites.length && saved.members.length === authoredRoster.length;
      const migrateRoster = migrateOutposts || migrateGrowth;
      if (!migrateRoster && (saved.rosterRevision !== rosterRevision || saved.sites.length !== sites.length || saved.members.length !== roster.length)) return false;
      const expectedSites = new Set((migrateOutposts ? previousSites : sites).map(s => s.id));
      const expectedMembers = new Set((migrateOutposts ? previousMembers : migrateGrowth ? authoredRoster : roster).map(m => m.id));
      const migrateLayout = !!layoutRevision && saved.layoutRevision === undefined;
      // Do not silently downgrade a future/unknown territory revision.
      if (saved.layoutRevision !== undefined && saved.layoutRevision !== layoutRevision) return false;
      const checkedSites = new Map(), checkedMembers = new Map();
      for (const s of saved.sites) {
        if (!s || !expectedSites.has(s.id) || checkedSites.has(s.id) || !['ally', 'enemy'].includes(s.owner)) return false;
        const original = siteMap.get(s.id);
        const initialOwner = migrateLayout ? (original.legacyInitialOwner || original.initialOwner) : original.initialOwner;
        if (initialOwner === 'ally' && s.owner !== 'ally') return false;
        if (['capture', 'pressure', 'absent', 'changedAt', 'graceUntil', 'garrisonEpoch'].some(k => !finite(s[k]) || s[k] < 0)) return false;
        // The native adapter derives entity IDs from epoch * 1000; keep both
        // the authoritative epoch and those IDs inside exact JS integers.
        if (s.capture > 1 || s.pressure > 1 || !Number.isInteger(s.garrisonEpoch) || s.garrisonEpoch > 1000000) return false;
        if (s.defeatedInfantry !== undefined && (!Number.isSafeInteger(s.defeatedInfantry) || s.defeatedInfantry < 0)) return false;
        if (initialOwner === 'enemy' && s.owner === 'ally' && !s.everCaptured) return false;
        if (s.rewardClaimed && !s.everCaptured) return false;
        checkedSites.set(s.id, s);
      }
      for (const m of saved.members) {
        if (!m || !expectedMembers.has(m.id) || checkedMembers.has(m.id)) return false;
        if (['hp', 'life', 'availableAt', 'diedAt'].some(k => !finite(m[k]) || m[k] < 0) || m.hp > 100 || !Number.isInteger(m.life) || m.life >= 100000 || typeof m.dead !== 'boolean' || (m.dead && m.hp !== 0)) return false;
        if (!migrateCombat) {
          const c = m.combat, original = memberMap.get(m.id);
          if (!c || !['garrison', 'advancing', 'front', 'waiting', 'reinforcing'].includes(c.phase) ||
              !['x', 'y', 'h', 'dispatchAt', 'routeIndex'].every(k => finite(c[k])) || c.dispatchAt < 0 ||
              c.x < bounds.minX || c.x > bounds.maxX || c.y < bounds.minY || c.y > bounds.maxY || c.h < seaLevel - 30 || c.h > 600 ||
              typeof c.mobile !== 'boolean' || c.destinationId !== original.siteId ||
              !Number.isInteger(c.routeIndex) || c.routeIndex < 0 || c.routeIndex > 100000 ||
              !Array.isArray(c.routeSites) || c.routeSites.length > sites.length ||
              c.routeSites.some(id => !siteMap.has(id)) || new Set(c.routeSites).size !== c.routeSites.length ||
              (c.sourceId !== null && !siteMap.has(c.sourceId)) || (c.frontSiteId !== null && !siteMap.has(c.frontSiteId)) ||
              (m.dead !== (c.phase === 'waiting'))) return false;
          const owner = checkedSites.get(original.siteId).owner;
          for (let i = 1; i < c.routeSites.length; i++) if (!neighbours.get(c.routeSites[i - 1]).includes(c.routeSites[i])) return false;
          if (c.phase === 'waiting' || c.phase === 'garrison') {
            if (c.routeSites.length || c.routeIndex || c.frontSiteId !== null) return false;
            if (c.phase === 'waiting' && (c.sourceId !== null || c.dispatchAt < m.diedAt)) return false;
          } else if (c.phase === 'reinforcing') {
            if (!c.sourceId || !rearBases[owner].includes(c.sourceId) || c.frontSiteId !== null || !c.routeSites.length ||
                c.routeSites[0] !== c.sourceId || c.routeSites[c.routeSites.length - 1] !== original.siteId ||
                c.routeSites.some(id => checkedSites.get(id)?.owner !== owner)) return false;
          } else if (!c.mobile || !c.frontSiteId || c.routeSites.length !== 2 || c.routeSites[0] !== original.siteId ||
              c.routeSites[1] !== c.frontSiteId || checkedSites.get(c.frontSiteId)?.owner === owner) return false;
          if (combatEnabled && c.routeSites.length) {
            let count = 1, end = anchor(c.routeSites[0], legacyRoutes);
            for (let i = 1; i < c.routeSites.length; i++) {
              const edge = edgesFor(legacyRoutes).get(c.routeSites[i - 1] + '>' + c.routeSites[i]);
              if (!edge) return false;
              if (c.phase === 'advancing' || c.phase === 'front') {
                const engagement = edge.engagement;
                let remaining = engagement && finite(engagement.aDistance) && finite(engagement.bDistance)
                  ? (edge.reversed ? edge.length - engagement.bDistance : engagement.aDistance)
                  : Math.max(0, edge.length / 2 - 30);
                remaining = Math.max(0, remaining - (original.index % 6) * 2.4);
                for (let j = 1; j < edge.points.length; j++) {
                  const a = edge.points[j - 1], b = edge.points[j], length = Math.hypot(b.x - a.x, b.y - a.y);
                  if (remaining >= length - 1e-8) { count++; remaining -= length; }
                  else { if (remaining > 1e-8) count++; break; }
                }
              } else { count += edge.points.length - 1; end = edge.points[edge.points.length - 1]; }
            }
            if (c.phase === 'reinforcing') {
              const a = anchor(original.siteId, legacyRoutes), slots = a?.stagingSlots;
              const berth = Array.isArray(slots) && slots.length ? slots[original.index % slots.length] : a;
              if (berth && (!end || (berth.x - end.x) ** 2 + (berth.y - end.y) ** 2 > .01)) count++;
            }
            if (c.phase === 'front' ? c.routeIndex !== count : c.routeIndex >= count) return false;
          }
        }
        checkedMembers.set(m.id, m);
      }
      // Validate the complete snapshot before mutating any live object.
      for (const site of sites) {
        const s = checkedSites.get(site.id);
        if (!s) {
          Object.assign(site, { owner: site.initialOwner, capture: 0, pressure: 0, absent: 0,
            changedAt: saved.clock, graceUntil: 0, garrisonEpoch: 0, playerImpact: false,
            everCaptured: false, rewardClaimed: false, warningIssued: false, defeatedInfantry: 0 });
          continue;
        }
        if (migrateLayout) {
          // Apply the requested deployment once. Other host regions/player
          // progress are outside this module and are never touched. Keep
          // earned first-capture rewards consumed across the redeployment.
          Object.assign(site, { owner: site.initialOwner, capture: 0, pressure: 0, absent: 0,
            changedAt: saved.clock, graceUntil: 0,
            garrisonEpoch: s.garrisonEpoch < 1000000 ? s.garrisonEpoch + 1 : 0,
            playerImpact: false, everCaptured: !!s.everCaptured, rewardClaimed: !!s.rewardClaimed,
            warningIssued: false, defeatedInfantry: 0 });
          continue;
        }
        for (const key of ['owner', 'capture', 'pressure', 'absent', 'changedAt', 'graceUntil', 'garrisonEpoch']) site[key] = s[key];
        for (const key of ['playerImpact', 'everCaptured', 'rewardClaimed', 'warningIssued']) site[key] = !!s[key];
        // Older saves retain each garrison slot's life/death history. A real
        // ownership change can add a synthetic life; layout migration alone
        // also changed epochs but did not kill anybody. Keep confirmed deaths
        // even when an old captured-layout history leaves that life ambiguous.
        // Retired response casualties cannot be reconstructed from old saves.
        site.defeatedInfantry = s.defeatedInfantry ?? (s.owner === 'enemy'
          ? membersBySite.get(site.id).reduce((total, member) => {
              const m = checkedMembers.get(member.id);
              const synthetic = !migrateCombat && s.everCaptured && s.garrisonEpoch > 0 ? 1 : 0;
              return total + (m ? Math.max(m.dead && m.diedAt > s.changedAt ? 1 : 0, m.life + (m.dead ? 1 : 0) - synthetic) : 0);
            }, 0) : 0);
      }
      for (const member of roster) {
        if (migrateLayout || !checkedMembers.has(member.id)) Object.assign(member, { hp: 100, dead: false, life: 0, availableAt: saved.clock, diedAt: 0, byPlayer: false });
        else {
          const m = checkedMembers.get(member.id);
          for (const key of ['hp', 'dead', 'life', 'availableAt', 'diedAt']) member[key] = m[key];
          member.byPlayer = !!m.byPlayer;
        }
        member.team = siteMap.get(member.siteId).owner;
        const record = checkedMembers.get(member.id);
        if (!migrateLayout && !migrateCombat && record) {
          const c = record.combat;
          for (const key of ['phase', 'x', 'y', 'h', 'mobile', 'sourceId', 'destinationId', 'dispatchAt', 'routeIndex', 'frontSiteId']) member[key] = c[key];
          member.routeSites = [...c.routeSites];
        } else {
          const defaults = combatDefaults.get(member.id);
          member.x = defaults.x; member.y = defaults.y; member.h = defaults.h; member.mobile = defaults.mobile;
          member.phase = member.dead ? 'waiting' : defaults.phase;
          member.sourceId = null; member.destinationId = member.siteId; member.routeIndex = 0;
          member.dispatchAt = member.dead ? Math.max(saved.clock, member.diedAt +
            (member.team === 'enemy' ? ENEMY_REPLACEMENT_DELAY : REPLACEMENT_DELAY) + (member.index % FRONT_SIZE) * 2) : 0;
          member.frontSiteId = !member.dead ? defaults.frontSiteId : null;
          member.routeSites = !member.dead ? [...defaults.routeSites] : [];
          if (member.frontSiteId && siteMap.get(member.frontSiteId).owner === member.team) {
            member.phase = 'garrison'; member.frontSiteId = null; member.routeSites = [];
          }
        }
        if (member.dead && member.team === 'enemy')
          member.dispatchAt = Math.max(member.dispatchAt, member.diedAt + ENEMY_REPLACEMENT_DELAY);
      }
      routeRepairs = [];
      routeGeometryMigrationApplied = (migrateRouteGeometry || migrateRouteObstacles || migrateRouteWalking) && !migrateLayout && !migrateCombat;
      roadGradeMigrationApplied = migrateRoadGrade && !migrateLayout && !migrateCombat;
      if (routeGeometryMigrationApplied) for (const member of roster) if (checkedMembers.has(member.id)) migrateRoutePose(member, legacyRoutes);
      if (!migrateLayout && !migrateCombat) for (const member of roster) {
        if (member.dead || !checkedMembers.has(member.id)) continue;
        const repaired = (roadGradeMigrationApplied && (recoverGradedRoadPoint(member, { sourceRevision: savedGradeRevision }) ||
          recoverKnownGradedHome(member, savedGradeRevision))) || recoverTrenchPoint(member) || recoverRoadPoint(member);
        if (!repaired) continue;
        Object.assign(member, repaired);
        // The host consumes this before loaded native actors can write their
        // old absolute heights back into the restored campaign.
        const queued = routeRepairs.find(r => r.id === member.id);
        if (queued) Object.assign(queued, repaired);
        else routeRepairs.push({ id: member.id, ...repaired });
      }
      // Old automatic battle lines are no longer valid orders. Redeploy those
      // living actors once to their original, already body-checked home slots;
      // preserve casualties, health, epochs, supply columns, owners and rewards.
      patrolMigrationApplied = saved.patrolRevision === undefined;
      for (const member of roster) {
        member.mobile = canPatrol(member);
        if (member.dead || !['advancing', 'front'].includes(member.phase)) continue;
        Object.assign(member, positionOf(member.home), { phase: 'garrison', routeSites: [], routeIndex: 0, frontSiteId: null, sourceId: null });
        const repair = { id: member.id, ...positionOf(member) }, prior = routeRepairs.findIndex(r => r.id === member.id);
        if (prior >= 0) routeRepairs[prior] = repair; else routeRepairs.push(repair);
      }
      patrolArrivals.clear();
      for (const m of roster) if (!m.dead && m.phase === 'garrison' && m.sourceId && dist2(m, m.home) > (PATROL_RADIUS + .5) ** 2) patrolArrivals.add(m.id);
      patrols.clear(); patrolBudgetBucket = -1; patrolBudget = 0; distantPatrolCursor = 0;
      clock = saved.clock; events = []; battlePulse = clock % 16; externalDefenders.clear(); externalVehicles.clear();
      enemyReplacementAt = saved.enemyReplacement?.nextDispatchAt ?? clock + ENEMY_REPLACEMENT_INTERVAL;
      enemyReplacementScanAt = clock;
      enemyMarchQueueDirty = true;
      layoutMigrationApplied = migrateLayout; rosterMigrationApplied = migrateRoster;
      combatMigrationApplied = combatEnabled && migrateCombat; return true;
    }
    function interactions(player) {
      if (!player) return [];
      const result = [];
      for (const s of sites) if (present(player, s, s.captureRadius + 30)) result.push({ kind: 'site', id: s.id, name: s.name, ...captureStatus(s.id, player) });
      for (const e of emplacements) if (dist2(e, player) < 12 * 12) result.push({ kind: e.kind, id: e.id, name: e.name, siteId: e.siteId, owner: siteMap.get(e.siteId).owner, x: e.x, y: e.y, h: e.h });
      return result;
    }
    function stats() {
      let ally = 0, enemy = 0, allySites = 0, enemySites = 0;
      for (const site of sites) { if (site.owner === 'ally') allySites++; else enemySites++; }
      for (const m of roster) if (!m.dead) { if (siteMap.get(m.siteId).owner === 'ally') ally++; else enemy++; }
      return { ally, enemy, total: ally + enemy, roster: roster.length, allySites, enemySites,
        initialAlly, initialEnemy, initialAllySites, initialEnemySites,
        initialSitesPerSide: initialAllySites === initialEnemySites ? initialAllySites : null };
    }
    return {
      schema: SCHEMA, version: 1, layoutRevision, rosterRevision, combatRevision, combatEnabled, patrolRevision, routeGeometryRevision, routeObstacleRevision, routeWalkingRevision, trenchRevision, roadGradeRevision,
      get patrolMigrationApplied() { return patrolMigrationApplied; },
      get routeGeometryMigrationApplied() { return routeGeometryMigrationApplied; },
      get roadGradeMigrationApplied() { return roadGradeMigrationApplied; },
      consumeRouteRepairs() { const result = routeRepairs; routeRepairs = []; return result; },
      get combatMigrationApplied() { return combatMigrationApplied; }, get layoutMigrationApplied() { return layoutMigrationApplied; },
      get rosterMigrationApplied() { return rosterMigrationApplied; },
      nativeOffsets: offsets, bounds, layout, sites, roster, assetData: data, walkingRoutes: combatEnabled ? routeData : null, emplacements, vehicleSpawns, accessRoads,
      connection, collisionBoxes, surfaceBoxes, seaLevel, get clock() { return clock; }, get battlePulse() { return battlePulse; },
      get surfaceGeometryRevision() { return surfaceGeometryRevision; },
      setFacilityGeometry, get facilityGeometry() { return { colliders: facilityColliders.map(b => ({ ...b })), surfaces: facilitySurfaces.map(b => ({ ...b })) }; },
      surfaceDescriptor, getSurfaceOwner, projectSurfaceImpact, damageSurfaces, restoreSurfaceDamage, unbindSurfaceVisuals,
      unbindFacilitySurfaceVisuals, setFacilitySurfaceVisible,
      constants: { CAPTURE_SECONDS, RECLAIM_GRACE, RECLAIM_SECONDS, REINFORCE_SECONDS, REPLACEMENT_DELAY, MARCH_SPEED, AMBIENT_DAMAGE, FRONT_SIZE, PATROL_SPEED, PATROL_RADIUS,
        ENEMY_REPLACEMENT_DELAY, ENEMY_REPLACEMENT_INTERVAL, ENEMY_REPLACEMENT_CAP, ENEMY_REPLACEMENT_EXCLUSION, ENEMY_MARCH_SPEED },
      owns, contains: owns, getTerrain, terrainHeight: getTerrain, getSurface, groundAt: getSurface, bridgeAt: connectionAt, legacyBridgeAt: legacyConnectionAt, elevatedBridgeAt, roadSurfaceAt, pointBlocked, bodyBlocked, trenchAt, recoverTrenchPoint, recoverRoadPoint, recoverGradedRoadPoint, recoverSupportPoint, canSupportDrop, vaultPlan,
      solidAt: (x, y, h) => pointBlocked(x, y, h, 0), trace,
      lineOfSight(a, b) { const hit = trace(a, b); return !hit || hit.t >= 1 - 1e-7; },
      getSite: id => siteMap.get(id) || null, getRoster, getMember, getMemberState, activeRoster, getOrder, setMemberPosition, markPlayerImpact, reportDeath, setMemberHealth,
      update, serialize, restore, claimReward, captureStatus, observeDefenders, reportExternalDeath, interactions, stats, connected,
      drainEvents() { const answer = events; events = []; return answer; }
    };
  }
  global.HanQEasternFront = Object.freeze({ schema: SCHEMA, version: 1, create });
})(typeof window !== 'undefined' ? window : globalThis);

/* Requested support is deliberately separate from the authored garrison.
 * A transport owns its passengers until the host confirms a clear exit point;
 * only disembarked soldiers enter the normal bounded native actor roster.
 * Enemy requests use their own identity/save namespace and only follow a
 * contact pose supplied by the host, never an implicit player position.
 */
(function (global) {
  'use strict';
  const SCHEMA = 'hanq.eastern-support.v1';
  const CAPACITY = 300, REQUEST_SIZE = 30, INFANTRY_BATCH = 30, COOLDOWN = 60;
  const LEGACY_COOLDOWN = 90;
  const RETIRE_SECONDS = 600, RETIRE_DISTANCE = 650, MAX_MISSION = 1000000;
  const FOLLOW_INTERVAL = .25, FOLLOW_WALK = 5.4, FOLLOW_RUN = 8.2, FOLLOW_REGROUP = 26;
  const ENEMY_MARCH_SPEED = 2.6, ENEMY_LEGACY_CAPACITY = 24, ENEMY_LEGACY_BATCH = 12;
  const FOLLOW_TRAIL_LIMIT = 96, FOLLOW_PROBES = 1800, RECALL_NEAR = 14;
  const FOLLOW_FRAME_PROBES = 240, FOLLOW_FRAME_ROUTES = 4;
  const FORMATION_SPACING = 2.6, FORMATION_GAP = 5;
  const ALLY_ROLES = Object.freeze({
    shield: { role: 'shield', roleName: '지원 방패병', weapon: 'pistol' },
    rifle: { role: 'rifle', roleName: '지원 소총병', weapon: 'ar' },
    antitank: { role: 'antitank', roleName: '지원 로켓병', weapon: 'rpg' },
    sniper: { role: 'sniper', roleName: '지원 저격수', weapon: 'sniper' },
    supply: { role: 'supply', roleName: '지원 보급병', weapon: 'ar' },
    machinegun: { role: 'machinegun', roleName: '지원 기관총병', weapon: 'm249' },
    medic: { role: 'medic', roleName: '지원 의무병', weapon: 'ar' }
  });
  const DETOUR_GRID = 3, DETOUR_NODES = 1024, DETOUR_SLICE = 72, SPAWN_PROBES = 3200;
  // A failed detour is retried on a finer lattice: a trench gate or wall gap
  // narrower than, or not aligned with, the 3 m lattice is otherwise never found.
  const DETOUR_GRIDS = [DETOUR_GRID, 2, 1.5];
  const COMPACT_NEAR = 6;
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const copyPoint = p => ({ x: p.x, y: p.y, h: p.h });

  function create(options = {}) {
    const enemy = options.team === 'enemy', team = enemy ? 'enemy' : 'ally';
    const schema = enemy ? 'hanq.eastern-enemy-support.v1' : SCHEMA;
    const idPrefix = enemy ? 'ef-enemy-support-' : 'ef-support-', siteId = enemy ? 'EF_ENEMY_SUPPORT' : 'EF_SUPPORT';
    const capacity = enemy ? 12 : CAPACITY, infantryBatch = enemy ? 6 : INFANTRY_BATCH;
    const walkSpeed = enemy ? ENEMY_MARCH_SPEED : FOLLOW_WALK, runSpeed = enemy ? ENEMY_MARCH_SPEED : FOLLOW_RUN;
    const bounds = options.bounds || { minX: 2048, maxX: 3072, minY: -1024, maxY: 3072 };
    const getSurface = typeof options.getSurface === 'function' ? options.getSurface : null;
    const bodyBlocked = typeof options.bodyBlocked === 'function' ? options.bodyBlocked : null;
    const spawnBlocked = typeof options.spawnBlocked === 'function' ? options.spawnBlocked : null;
    const recoverTrenchPoint = typeof options.recoverTrenchPoint === 'function' ? options.recoverTrenchPoint : null;
    const recoverRoadPoint = typeof options.recoverRoadPoint === 'function' ? options.recoverRoadPoint : null;
    const recoverSupportPoint = typeof options.recoverSupportPoint === 'function' ? options.recoverSupportPoint : null;
    const canSupportDrop = typeof options.canSupportDrop === 'function' ? options.canSupportDrop : null;
    const movementBlocked = typeof options.movementBlocked === 'function' ? options.movementBlocked : null;
    const steepTerrain = typeof options.steepTerrain === 'function' ? options.steepTerrain : null;
    let surfaceKind = null;
    let clock = 0, cooldownUntil = 0, nextMissionId = 1, members = new Map();
    let trenchRepairs = [];
    // These are navigation caches, not save data. Old v1 reinforcements acquire
    // the same escort orders when the host supplies its first valid player pose.
    let followKnown = false, followAllowed = false, leader = null, followElapsed = 0, enemyMarchEnabled = false;
    let trail = [], trailSerial = 0, navigation = new Map(), navigationTurn = 0, probes = 0, routeDeferred = false;
    let regrouping = new Set();
    let formationYaw = null;

    // Reuse the authored walking corridors for long recalls. A local 96 m
    // search cannot discover a bridge hundreds of metres away, especially
    // after loading has discarded the player's transient breadcrumbs.
    // This topology is shared by the entire squad; every actual stride still
    // passes the ordinary surface/body sweep and the existing probe budget.
    const corridors = buildCorridors(options.walkingRoutes);
    let corridorField = null, corridorGeneration = 0;

    function buildCorridors(data) {
      if (!data || !Array.isArray(data.edges)) return null;
      const nodes = [], byPoint = new Map(), cells = new Map();
      function nodeFor(p) {
        if (!validPoint(p)) return null;
        const key = Math.round(p.x * 100) + ',' + Math.round(p.y * 100);
        const bucket = byPoint.get(key) || [];
        // Endpoint heights from independently authored lanes can differ by
        // one ordinary step. Keep separate floors distinct; the runtime
        // sweep still resolves the real surface before crossing any link.
        let node = bucket.find(n => Math.abs(n.h - p.h) <= 1.05);
        if (!node) {
          node = { ...copyPoint(p), id: nodes.length, links: [] };
          nodes.push(node); bucket.push(node); byPoint.set(key, bucket);
          const cell = Math.floor(p.x / 64) + ',' + Math.floor(p.y / 64);
          if (!cells.has(cell)) cells.set(cell, []);
          cells.get(cell).push(node);
        }
        return node;
      }
      for (const edge of data.edges) {
        if (!Array.isArray(edge.points)) continue;
        let prior = null;
        for (const point of edge.points) {
          const node = nodeFor(point);
          if (prior && node && prior !== node) {
            const cost = Math.hypot(node.x - prior.x, node.y - prior.y, node.h - prior.h);
            // Disconnected/corrupt records are not new walkable shortcuts.
            if (cost > 0 && cost <= 32) {
              if (!prior.links.some(link => link.id === node.id)) prior.links.push({ id: node.id, cost });
              if (!node.links.some(link => link.id === prior.id)) node.links.push({ id: prior.id, cost });
            }
          }
          prior = node;
        }
      }
      return nodes.length ? { nodes, cells } : null;
    }
    function corridorCandidates(point, limit = 24) {
      if (!corridors) return [];
      const candidates = [], cx = Math.floor(point.x / 64), cy = Math.floor(point.y / 64);
      for (let x = cx - 4; x <= cx + 4; x++) for (let y = cy - 4; y <= cy + 4; y++) {
        for (const node of corridors.cells.get(x + ',' + y) || []) {
          const distance = Math.hypot(node.x - point.x, node.y - point.y);
          if (distance <= 256) candidates.push({ node, score: distance + Math.abs(node.h - point.h) * 2 });
        }
      }
      candidates.sort((a, b) => a.score - b.score || a.node.id - b.node.id);
      const selected = [];
      for (const item of candidates) {
        if (selected.some(n => distance2(n, item.node) < 8 * 8 && Math.abs(n.h - item.node.h) < 3)) continue;
        selected.push(item.node);
        if (selected.length >= limit) break;
      }
      return selected;
    }
    function heapPush(heap, item) {
      let i = heap.length; heap.push(item);
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heap[parent].cost <= item.cost) break;
        heap[i] = heap[parent]; i = parent;
      }
      heap[i] = item;
    }
    function heapPop(heap) {
      const first = heap[0], last = heap.pop();
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let child = i * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].cost < heap[child].cost) child++;
          if (heap[child].cost >= last.cost) break;
          heap[i] = heap[child]; i = child;
        }
        heap[i] = last;
      }
      return first;
    }
    function updateCorridorField() {
      if (!corridors || !leader) return;
      if (!corridorField || corridorField.ready && distance2(corridorField.target, leader) > 48 * 48) {
        const node = corridorCandidates(leader, 1)[0];
        if (!node) { corridorField = null; return; }
        const costs = new Float64Array(corridors.nodes.length); costs.fill(Infinity);
        const next = new Int32Array(corridors.nodes.length); next.fill(-1);
        costs[node.id] = 0;
        corridorField = { generation: ++corridorGeneration, target: copyPoint(leader), node: node.id,
          costs, next, heap: [{ id: node.id, cost: 0 }], ready: false };
      }
      // Only scalar topology work here. Geometry remains in the existing
      // bounded per-member jobs. A large graph is never rebuilt per soldier.
      const field = corridorField;
      for (let work = 0; field && !field.ready && work < 256; work++) {
        const item = heapPop(field.heap);
        if (!item) { field.ready = true; break; }
        if (item.cost !== field.costs[item.id]) continue;
        for (const link of corridors.nodes[item.id].links) {
          const cost = item.cost + link.cost;
          if (cost >= field.costs[link.id]) continue;
          field.costs[link.id] = cost; field.next[link.id] = item.id;
          heapPush(field.heap, { id: link.id, cost });
        }
      }
    }
    function corridorGoal(m, nav) {
      const field = corridorField;
      if (!corridors) return null;
      // A moving caller may need a new shared distance field. Keep each
      // survivor's checked entrance while that field is built; repeatedly
      // discarding a long join search would make a driving leader unreachable.
      if (!field?.ready) return nav.corridor?.goal || null;
      if (distance2(m, leader) < 64 * 64) { nav.corridor = null; return null; }
      let route = nav.corridor;
      if (route && route.generation !== field.generation && finite(field.costs[route.node]))
        route.generation = field.generation;
      if (!route || route.generation !== field.generation) {
        const candidates = corridorCandidates(m).filter(n => finite(field.costs[n.id]));
        if (!candidates.length) return null;
        route = nav.corridor = { generation: field.generation, candidates, candidate: 0,
          node: candidates[0].id, joining: true, goal: copyPoint(candidates[0]),
          probing: true, probePoint: copyPoint(m), probePoints: [copyPoint(m)] };
        nav.detour = null; nav.detourRoute = null; nav.detourFailure = null;
      }
      if (route.probing) {
        // The closest corridor in XY can be across a cliff or on the bridge
        // overhead. Test several entrances from the actual saved foot layer.
        // Long connectors resume in 12 m pieces; no all-or-nothing ray can
        // exceed the per-frame budget and starve this soldier indefinitely.
        const floor = Math.max(0, probes - DETOUR_SLICE);
        while (probes > floor && route.candidate < route.candidates.length) {
          const node = route.candidates[route.candidate], from = route.probePoint;
          const length = Math.hypot(node.x - from.x, node.y - from.y);
          if (length < .04 && Math.abs(from.h - node.h) <= 1.5) {
            route.node = node.id; route.goal = copyPoint(node); route.probing = false;
            nav.detourRoute = { target: copyPoint(node), points: route.probePoints, index: 1 };
            route.probePoints = null; break;
          }
          const scale = Math.min(1, 12 / Math.max(.001, length));
          const point = terrainWalk(from, from.x + (node.x - from.x) * scale, from.y + (node.y - from.y) * scale);
          if (routeDeferred) break;
          if (!point || length <= 12 && Math.abs(point.h - node.h) > 1.5) {
            route.candidate++; route.probePoint = copyPoint(m); route.probePoints = [copyPoint(m)];
          } else { route.probePoint = point; route.probePoints.push(point); }
        }
        if (route.candidate >= route.candidates.length) {
          route.candidate = 0; route.node = route.candidates[0].id;
          route.goal = copyPoint(route.candidates[0]); route.probing = false; route.probePoints = null;
        }
        if (route.probing) return route.goal;
      }
      if (route.joining && nav.detourFailure && distance2(nav.detourFailure.target, route.goal) < 1) {
        // Try a different nearby entrance when a rock, embankment or floor
        // separates the closest point from this soldier's walking layer.
        route.candidate++;
        if (route.candidate >= route.candidates.length) {
          route.candidate = 0;
          nav.nextRouteAt = clock + 4;
        }
        route.node = route.candidates[route.candidate].id;
        nav.detour = null; nav.detourRoute = null; nav.detourFailure = null;
      }
      let node = corridors.nodes[route.node];
      if (distance2(m, node) < .08 * .08 && Math.abs(m.h - node.h) < 1.5) {
        route.joining = false;
        const next = field.next[node.id];
        if (next < 0) { nav.corridor = null; return null; }
        node = corridors.nodes[route.node = next];
        nav.detour = null; nav.detourRoute = null; nav.detourFailure = null;
      }
      // A parked or newly arrived hull can occupy a surveyed lane sample.
      // Route around it to the next clear sample, never A* toward a point
      // inside its body. Only the target advances here; every real segment
      // still goes through the ordinary collision-checked local search.
      if (!route.joining) for (let skipped = 0; ; skipped++) {
        if (safePoint(node, true, true)) break;
        if (routeDeferred) return route.goal;
        const next = field.next[node.id];
        if (next < 0) { nav.corridor = null; return null; }
        node = corridors.nodes[route.node = next];
        route.goal = copyPoint(node);
        nav.detour = null; nav.detourRoute = null; nav.detourFailure = null;
        if (skipped >= 63) { routeDeferred = true; return route.goal; }
      }
      route.goal = copyPoint(node);
      return route.goal;
    }

    function validPoint(p) {
      return p && [p.x, p.y, p.h].every(finite) && p.x >= bounds.minX && p.x <= bounds.maxX &&
        p.y >= bounds.minY && p.y <= bounds.maxY && p.h >= -30 && p.h <= 600;
    }
    function safePoint(p, limited = false, walking = false) {
      if (!validPoint(p)) return null;
      if (limited) {
        if (probes <= 0) { routeDeferred = true; return null; }
        probes--;
      }
      try {
        const surface = getSurface ? getSurface(p.x, p.y, p.h + .4, 1.1, .42) : { height: p.h };
        if (!surface || !finite(surface.height) || surface.height <= .2 || Math.abs(surface.height - p.h) > 1.5) return null;
        surfaceKind = surface.kind || null;
        if (bodyBlocked && bodyBlocked(p.x, p.y, surface.height, 1.8, .42)) return null;
        // Live hulls participate in route segments and formation slots. The
        // caller's anchor stays valid when they are riding a grounded vehicle.
        if (walking && movementBlocked && movementBlocked(p.x, p.y, surface.height, 1.8, .42)) return null;
        return { x: p.x, y: p.y, h: surface.height };
      } catch (_) { return null; }
    }
    function walkPoint(x, y, h, limited = false, previous = null, avoidVehicles = true) {
      const p = safePoint({ x, y, h }, limited, avoidVehicles);
      if (!p || p.h - h > 1.05 || !(h - p.h <= 1.1 || previous && canSupportDrop?.(previous, p))) return null;
      // Each stride above is within a single step, but a native soldier can
      // neither climb a sustained bank beyond the host's slope limit nor keep
      // its footing going down one. A route across such a face never
      // completes on the way up and slides the squad into a gorge on the way
      // down (the C_IRON canyon beside the bridge).
      if (steepTerrain && surfaceKind === 'terrain' && Math.abs(p.h - h) > .02 && steepTerrain(p.x, p.y, p.h)) return null;
      return p;
    }
    function clearWalk(a, b, limit = 96) {
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length > limit || Math.abs(a.h - b.h) > length + 1.1) return false;
      const steps = Math.max(1, Math.ceil(length / .55));
      if (probes < steps) { routeDeferred = true; return false; }
      let previous = a;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, p = walkPoint(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, previous.h, true, previous);
        if (!p) return false;
        previous = p;
      }
      return Math.abs(previous.h - b.h) <= 1.1;
    }
    // Sample a route from the preceding foot height, not the leader's height.
    // A valid slope can change by many metres across a 20 m deployment area.
    // Reversible edges are used by the outward spawn search, whose troops must
    // subsequently be able to walk the same edge back toward the player.
    function terrainWalk(a, x, y, reversible = false, avoidVehicles = true) {
      const length = Math.hypot(x - a.x, y - a.y), steps = Math.max(1, Math.ceil(length / .5));
      if (probes < steps) { routeDeferred = true; return null; }
      let previous = a;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, p = walkPoint(a.x + (x - a.x) * t, a.y + (y - a.y) * t, previous.h, true, previous, avoidVehicles);
        if (!p || reversible && Math.abs(p.h - previous.h) > 1.05) return null;
        previous = p;
      }
      return previous;
    }
    const walkDirections = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
    function routePoints(node) {
      const points = [];
      for (let at = node; at; at = at.parent) points.push(copyPoint(at));
      return points.reverse();
    }
    function detourWaypoint(m, nav) {
      const route = nav.detourRoute;
      if (!route) return null;
      // Reach checked corners before turning. A 0.8m shortcut can clip the
      // very obstacle this detour avoids, then send the unit back to its old
      // breadcrumb. Native and dormant waypoint movement both stop at 0.02m.
      while (route.index < route.points.length && distance2(m, route.points[route.index]) < .04 * .04 &&
        Math.abs(m.h - route.points[route.index].h) < 1.1) route.index++;
      if (route.index >= route.points.length) { nav.detourRoute = null; nav.nextRouteAt = 0; return null; }
      return route.points[route.index];
    }
    function finishDetour(nav, search, node, appendTarget) {
      const points = routePoints(node);
      if (appendTarget && distance2(points[points.length - 1], search.target) > .01) points.push(copyPoint(search.target));
      nav.detourRoute = { target: copyPoint(search.target), points, index: 1 };
      nav.detour = null; nav.detourFailure = null;
      return points[1] || points[0];
    }
    function detourGoal(m, nav, target = leader) {
      const failed = nav.detourFailure;
      if (failed && clock < failed.retryAt && distance2(m, failed.origin) < 4 && distance2(target, failed.target) < 16) return null;
      let search = nav.detour;
      if (!search || distance2(search.target, target) > 36 || Math.abs(search.target.h - target.h) > 1.5 ||
        distance2(search.origin, m) > 16) {
        const start = { ...copyPoint(m), gx: 0, gy: 0, g: 0, parent: null };
        start.score = Math.hypot(target.x - m.x, target.y - m.y);
        const attempt = failed && distance2(m, failed.origin) < 4 ? failed.attempt || 0 : 0;
        search = nav.detour = { origin: copyPoint(m), target: copyPoint(target), distance: start.score,
          attempt, grid: DETOUR_GRIDS[attempt % DETOUR_GRIDS.length],
          open: [start], nodes: new Map([['0,0,' + Math.round(m.h * 2), start]]), current: null, direction: 0, expanded: 0 };
      }
      const floor = Math.max(0, probes - DETOUR_SLICE);
      while (probes > floor && search.expanded < DETOUR_NODES) {
        if (!search.current) {
          if (!search.open.length) break;
          let best = 0;
          for (let i = 1; i < search.open.length; i++) if (search.open[i].score < search.open[best].score) best = i;
          const node = search.current = search.open.splice(best, 1)[0];
          node.closed = true; search.direction = 0; search.expanded++;
          const remaining = Math.hypot(node.x - search.target.x, node.y - search.target.y);
          if (remaining <= search.grid * 1.5) {
            if (clearWalk(node, search.target, search.grid * 1.5)) return finishDetour(nav, search, node, true);
            if (routeDeferred) { node.closed = false; search.open.push(node); search.current = null; search.expanded--; return null; }
          }
          // Distant survivors close a large gap through checked local routes;
          // no unbounded global graph or teleport is needed for a recall.
          if (search.distance > 96 && node.g >= 12 && remaining < search.distance - 12)
            return finishDetour(nav, search, node, false);
        }
        const node = search.current;
        if (search.direction >= walkDirections.length) { search.current = null; continue; }
        const [dx, dy] = walkDirections[search.direction], gx = node.gx + dx, gy = node.gy + dy;
        if (Math.abs(gx) > 32 || Math.abs(gy) > 32) { search.direction++; continue; }
        const cost = node.g + Math.hypot(dx, dy) * search.grid;
        const x = search.origin.x + gx * search.grid, y = search.origin.y + gy * search.grid;
        const p = terrainWalk(node, x, y);
        if (routeDeferred) return null;
        search.direction++;
        if (!p) continue;
        const key = gx + ',' + gy + ',' + Math.round(p.h * 2), old = search.nodes.get(key);
        if (old && (old.closed || old.g <= cost)) continue;
        const next = old || { ...p, gx, gy };
        next.g = cost; next.parent = node; next.score = cost + Math.hypot(search.target.x - x, search.target.y - y);
        if (!old) { search.nodes.set(key, next); search.open.push(next); }
      }
      if (search.expanded >= DETOUR_NODES || !search.current && !search.open.length) {
        nav.detourFailure = { origin: copyPoint(m), target: copyPoint(target), retryAt: clock + 4, attempt: search.attempt + 1 };
        nav.detour = null;
      } else routeDeferred = true;
      return null;
    }
    function formationRadius(index, recalling = false) {
      // Keep the original spacing for small squads; larger armies expand
      // their perimeter instead of squeezing every soldier into the same ring.
      return (recalling ? 4 : 6) + (recalling ? 6 : 10) * Math.sqrt(index / Math.max(1, Math.min(capacity, 60) - 1));
    }
    function formationTier(role) {
      return role === 'shield' ? 0 : role === 'rifle' || role === 'machinegun' ? 1 :
        role === 'antitank' ? 2 : role === 'sniper' ? 4 : 3;
    }
    function assignFormation(living) {
      if (enemy) return;
      const bands = [[], [], [], [], []];
      for (const m of living) if (m.phase === 'active') {
        const role = roleFor(m.slot).role;
        bands[formationTier(role)].push(m);
      }
      const count = bands.reduce((sum, band) => sum + band.length, 0);
      const columns = Math.max(4, Math.ceil(Math.sqrt(count * 1.6)));
      const rows = bands.map(band => Math.ceil(band.length / columns));
      // Forward is the caller's facing. Distinct bands leave room between
      // front-line guns, rockets, support and rear snipers at every army size.
      const front = 4, rockets = -3;
      const shield = front + Math.max(0, rows[1] - 1) * FORMATION_SPACING + FORMATION_GAP;
      const support = rockets - Math.max(0, rows[2] - 1) * FORMATION_SPACING - FORMATION_GAP;
      const sniper = support - Math.max(0, rows[3] - 1) * FORMATION_SPACING - FORMATION_GAP;
      const starts = [shield, front, rockets, support, sniper];
      for (let tier = 0; tier < bands.length; tier++) {
        const band = bands[tier];
        for (let index = 0; index < band.length; index++) {
          const m = band[index], nav = navigation.get(m.id), row = Math.floor(index / columns);
          const width = Math.min(columns, band.length - row * columns);
          const lateral = (index % columns - (width - 1) / 2) * FORMATION_SPACING;
          const depth = starts[tier] + (tier <= 1 ? row : -row) * FORMATION_SPACING;
          if (!nav.formation) nav.formation = {};
          if (nav.formation.depth !== depth || nav.formation.lateral !== lateral) nav.formation.safeRadius = null;
          nav.formation.role = roleFor(m.slot).role; nav.formation.depth = depth;
          nav.formation.lateral = lateral; nav.formation.radius = Math.hypot(depth, lateral);
          nav.formation.column = index % columns; nav.formation.width = width;
        }
      }
    }
    function formationDistance(nav, recalling = false) {
      return !enemy && nav?.formation ? Math.max(nav.formation.radius, nav.formation.safeRadius || 0) : formationRadius(nav?.rank || 0, recalling);
    }
    function idealFormationPoint(nav) {
      if (!leader || !nav?.formation) return leader && copyPoint(leader);
      const { depth, lateral } = nav.formation, yaw = formationYaw || 0;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      return { x: leader.x + c * depth - s * lateral, y: leader.y + s * depth + c * lateral, h: leader.h };
    }
    // The caller's own position is an anchor, never a place to stand. A unit
    // routed there (last breadcrumb, end of a detour, no clear slot) keeps a
    // small rank-dependent distance instead of walking into the player's
    // body and stacking the squad on one coordinate.
    function leaderStandOff(m) { return 2.2 + (m.slot % 3) * .7; }
    function atLeader(p) { return !!leader && !!p && distance2(p, leader) < .36; }
    function followStop(m, nav, recalling) {
      return atLeader(nav.goal) ? leaderStandOff(m) : nav.waypoint ? .02 : recalling || !enemy ? 1.2 : 2;
    }
    function formationPoint(index, recalling = false, nav = null) {
      if (!enemy && nav?.formation) {
        const f = nav.formation, yaw = formationYaw || 0, edge = (f.width - 1) / 2;
        const right = (edge + f.width - f.column) * FORMATION_SPACING;
        const left = -(edge + f.column + 1) * FORMATION_SPACING;
        const sides = Math.abs(left) < right ? [left, right] : [right, left];
        // Search sideways within the same band. An obstacle never rotates a
        // sniper's slot into the front line. Each member owns unique fallback
        // columns beyond its row, so a blocked slot cannot select a neighbour's
        // ordinary target (or another member's reserved alternative).
        for (const lateral of [f.lateral, ...sides]) {
          const p = safePoint({ x: leader.x + Math.cos(yaw) * f.depth - Math.sin(yaw) * lateral,
            y: leader.y + Math.sin(yaw) * f.depth + Math.cos(yaw) * lateral, h: leader.h }, true, true);
          if (p) { f.safeRadius = Math.hypot(f.depth, lateral); return p; }
          if (routeDeferred) break;
        }
        // A fully obstructed band still uses the established safe corridor and
        // leader fallback; it reforms after exiting the narrow passage.
        // The caller's own position is never a slot: the follower keeps the
        // leader as its route anchor and stops beside them (followStop).
        f.safeRadius = null;
        return null;
      }
      const angle = index * 2.399963229728653;
      const radius = formationRadius(index, recalling);
      for (const turn of [0, .4, -.4, .8, -.8]) {
        const p = safePoint({ x: leader.x + Math.cos(angle + turn) * radius,
          y: leader.y + Math.sin(angle + turn) * radius, h: leader.h }, true, true);
        if (p) return p;
        // An exhausted frame budget is not evidence of a blocked slot.
        if (routeDeferred) return null;
      }
      return null;
    }
    // A unit that reached the caller but whose ordinary slot is walled off
    // takes a compact, individually checked position beside them. Bearings
    // stay distinct per rank and positions held or targeted by others are
    // skipped, so the fallback cannot stack several soldiers either.
    function compactPoint(m, index) {
      const angle = index * 2.399963229728653;
      for (const radius of [3.4, 2.5, 4.6]) for (const turn of [0, .7, -.7, 1.4, -1.4, 2.1, -2.1, Math.PI]) {
        const p = safePoint({ x: leader.x + Math.cos(angle + turn) * radius,
          y: leader.y + Math.sin(angle + turn) * radius, h: leader.h }, true, true);
        if (routeDeferred) return null;
        if (!p) continue;
        let taken = false;
        for (const other of members.values()) {
          if (other === m || other.dead || other.phase !== 'active' || Math.abs(other.h - p.h) >= 2) continue;
          // A follower stops anywhere within its stop radius of an ordinary
          // slot, so the whole of that disc counts as taken.
          const route = navigation.get(other.id), goal = route?.goal, reach = .9 + (route?.waypoint ? 0 : enemy ? 2 : 1.2);
          if (distance2(other, p) < .81 || goal && distance2(goal, p) < reach * reach) { taken = true; break; }
        }
        if (taken) continue;
        if (clearWalk(m, p, 12)) return p;
        if (routeDeferred) return null;
      }
      return null;
    }
    function trailGoal(m, nav) {
      let at = nav.trailId ? trail.findIndex(p => p.id === nav.trailId) : -1;
      let checked = -1;
      if (at < 0) {
        // A short scalar scan of a shared bounded trail replaces per-unit A*.
        // Only the four nearest entries receive collision queries.
        const near = [];
        for (let i = 0; i < trail.length; i++) {
          const d = distance2(m, trail[i]); if (d > 96 * 96) continue;
          let j = 0; while (j < near.length && near[j].d <= d) j++;
          if (j < 4) { near.splice(j, 0, { i, d }); if (near.length > 4) near.pop(); }
        }
        // If the frame budget ends between candidates, start at the next
        // unchecked entry on a later frame instead of starving that entry.
        const start = (nav.searchTurn || 0) % Math.max(1, near.length);
        for (let j = 0; j < near.length; j++) {
          const turn = (start + j) % near.length, n = near[turn];
          if (clearWalk(m, trail[n.i])) { at = checked = n.i; nav.searchTurn = 0; break; }
          if (routeDeferred) { nav.searchTurn = turn; break; }
          nav.searchTurn = (turn + 1) % near.length;
        }
        if (at < 0) return null;
      }
      while (at + 1 < trail.length && trail[at + 1].linked && distance2(m, trail[at]) < .64) at++;
      // Skip only nearby, checked corners. A break in the player's route (for
      // example teleporting or flying) never becomes a traversable segment.
      let next = at;
      for (let i = at + 1; i < Math.min(trail.length, at + 7); i++) {
        if (!trail[i].linked) break;
        if (clearWalk(m, trail[i], 24)) { next = i; checked = i; }
        if (routeDeferred) break;
      }
      // A reached breadcrumb before a jump, flight or other broken link is
      // not a new movement goal. Returning it suppressed the bounded detour
      // search and stacked the whole squad at the break indefinitely. Retain
      // the break, but let the existing checked search find a ground way round.
      if (distance2(m, trail[next]) < .8 * .8 && Math.abs(m.h - trail[next].h) < 1.1) {
        nav.trailId = 0;
        return null;
      }
      // Reuse a successful check above. An unchanged existing waypoint still
      // needs its segment checked, but no segment is sampled twice per search.
      if (checked !== next && !clearWalk(m, trail[next])) return null;
      nav.trailId = trail[next].id;
      return copyPoint(trail[next]);
    }
    function refreshLeader(player) {
      const nextLeader = safePoint(player);
      if (!nextLeader) { followAllowed = false; followElapsed = 0; return false; }
      if (!enemy) {
        const desired = finite(player.yaw) ? Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw)) :
          leader && distance2(leader, nextLeader) >= .25 ? Math.atan2(nextLeader.y - leader.y, nextLeader.x - leader.x) : formationYaw;
        if (formationYaw === null) formationYaw = desired === null ? 0 : desired;
        else if (desired !== null) {
          const turn = Math.atan2(Math.sin(desired - formationYaw), Math.cos(desired - formationYaw));
          // Aiming jitter should not make three hundred soldiers shuffle;
          // larger turns update bounded route jobs and retain real walking.
          if (Math.abs(turn) > .12) formationYaw = Math.atan2(Math.sin(formationYaw + clamp(turn, -.45, .45)),
            Math.cos(formationYaw + clamp(turn, -.45, .45)));
        }
      }
      leader = nextLeader;
      const last = trail[trail.length - 1];
      if (!last || distance2(last, leader) >= 4 || Math.abs(last.h - leader.h) > .5) {
        const linked = !!last && clearWalk(last, leader, 24);
        trail.push({ ...leader, id: ++trailSerial, linked });
        if (trail.length > FOLLOW_TRAIL_LIMIT) trail.shift();
      }
      return true;
    }
    function advanceFollow(dt, activeIds, force = false, activeOnly = enemy) {
      const living = [];
      // Enemy movement defaults to native actors. The host may explicitly
      // authorize a dispatched column's collision-checked offscreen march;
      // loaded IDs always retain exclusive ownership of their own movement.
      for (const m of members.values()) if (!m.dead && (!activeOnly || activeIds.has(m.id))) living.push(m);
      updateCorridorField();
      for (let rank = 0; rank < living.length; rank++) {
        const m = living[rank]; if (m.phase !== 'active') continue;
        if (!navigation.has(m.id)) navigation.set(m.id, { goal: copyPoint(m), trailId: 0, nextRouteAt: 0, waypoint: true });
        navigation.get(m.id).rank = rank;
      }
      assignFormation(living);
      for (const m of living) {
        const nav = navigation.get(m.id);
        const route = nav?.corridor;
        // Surveyed lanes include sub-metre samples. Advance a reached sample
        // immediately instead of waiting another 0.7 s routing interval at
        // each point. The ordinary per-frame movement sweep still prevents
        // crossing a newly blocked segment, and expensive replans stay capped.
        if (route && !route.joining && !route.probing && corridorField?.ready &&
            route.generation === corridorField.generation && !nav.detour && !nav.detourRoute) {
          const node = corridors.nodes[route.node];
          if (distance2(m, node) < .08 * .08 && Math.abs(m.h - node.h) < 1.5) {
            const next = corridorField.next[node.id];
            if (next >= 0) {
              route.node = next; route.goal = copyPoint(corridors.nodes[next]);
              nav.goal = copyPoint(route.goal); nav.waypoint = true;
            } else nav.corridor = null;
            nav.nextRouteAt = 0;
          }
        }
        if (!nav?.detourRoute) continue;
        const target = nav.corridor?.goal || nav.approachTarget || leader;
        if (distance2(nav.detourRoute.target, target) > 36 || Math.abs(nav.detourRoute.target.h - target.h) > 1.5) {
          nav.detourRoute = null; nav.nextRouteAt = 0; continue;
        }
        const goal = detourWaypoint(m, nav);
        if (goal && (goal.x !== nav.goal.x || goal.y !== nav.goal.y)) {
          nav.goal = copyPoint(goal); nav.waypoint = true; nav.nextRouteAt = 0;
        }
      }
      // Spread route searches over simulation frames. The former 250 ms
      // batch could issue over 2,000 terrain/body probes in one moving frame.
      // Stable roster ranks preserve formation slots; only work order rotates.
      let jobs = 0;
      const start = navigationTurn;
      for (let n = 0; n < living.length; n++) {
        const rank = (n + start) % living.length, m = living[rank];
        if (m.phase !== 'active') continue;
        const nav = navigation.get(m.id);
        if (force || clock >= nav.nextRouteAt) {
          if (!force && (jobs >= FOLLOW_FRAME_ROUTES || probes <= 0)) break;
          jobs++; navigationTurn = (rank + 1) % living.length; routeDeferred = false;
          nav.nextRouteAt = clock + .65 + (rank % 5) * .035;
          // A survivor can reach the caller through the fallback detour even
          // when its exact formation slot is obstructed. Release that manual
          // order only after a short, physically clear final approach; mere
          // proximity through a wall, on another floor or inside a hull fails.
          if (!enemy && dt > 0 && regrouping.has(m.id) && distance2(m, leader) <= RECALL_NEAR * RECALL_NEAR &&
              clearWalk(m, leader, RECALL_NEAR)) regrouping.delete(m.id);
          if (routeDeferred) { nav.nextRouteAt = clock; continue; }
          const corridor = corridorGoal(m, nav);
          // A seated caller is a valid anchor, but the inside of their hull
          // cannot be the destination of a walking detour. Use the same clear
          // formation slot for both direct approach and the fallback search.
          const occupiedAnchor = !corridor && movementBlocked && !safePoint(leader, true, true);
          nav.approachTarget = occupiedAnchor && !routeDeferred ? formationPoint(rank, regrouping.has(m.id), nav) : null;
          const routeTarget = corridor || nav.approachTarget || leader;
          if (nav.corridor?.probing || routeDeferred) {
            nav.goal = copyPoint(m); nav.waypoint = true; nav.nextRouteAt = clock; continue;
          }
          // A compact position is valid only while the caller stays put; a
          // moved caller returns the unit to the ordinary formation search.
          if (nav.compact && (corridor || nav.approachTarget || distance2(nav.compact.leader, leader) >= 1 ||
              Math.abs(nav.compact.leader.h - leader.h) >= 1)) nav.compact = null;
          if (nav.detourRoute) {
            const goal = detourWaypoint(m, nav);
            // The final detour sample is the caller. Standing off from it
            // completes the detour; the slot search below takes over.
            const beside = goal && atLeader(goal) && distance2(m, goal) <= (leaderStandOff(m) + .3) ** 2;
            if (goal && !beside && clearWalk(m, goal)) { nav.goal = copyPoint(goal); nav.waypoint = true; continue; }
            if (routeDeferred) { nav.nextRouteAt = clock; continue; }
            nav.detourRoute = null;
          }
          // Resume unfinished work before repeating the failed direct ray.
          // This is a cached search, not a new graph per soldier per frame.
          if (nav.detour) {
            const goal = detourGoal(m, nav, routeTarget);
            if (goal) { nav.goal = copyPoint(goal); nav.waypoint = true; }
            if (routeDeferred) nav.nextRouteAt = clock;
            continue;
          }
          const slot = corridor || nav.approachTarget ? null : formationPoint(rank, regrouping.has(m.id), nav);
          if (routeDeferred) { nav.nextRouteAt = clock; continue; }
          // No ordinary slot is clear at all (a small yard, a room, a narrow
          // deck) and this unit is already beside the caller: it must not
          // simply stay wherever it stopped, which can be on the caller.
          if (!slot && !corridor && !nav.approachTarget && Math.abs(m.h - leader.h) < 2 &&
              distance2(m, leader) <= COMPACT_NEAR * COMPACT_NEAR) {
            if (!nav.compact) {
              const compact = compactPoint(m, rank);
              if (routeDeferred) { nav.nextRouteAt = clock; continue; }
              if (compact) nav.compact = { point: copyPoint(compact), leader: copyPoint(leader) };
            }
            if (nav.compact) {
              nav.goal = copyPoint(nav.compact.point); nav.waypoint = true; nav.trailId = 0;
              nav.detour = null; nav.detourRoute = null; nav.detourFailure = null; nav.blockedDirect = null;
              continue;
            }
          }
          const target = corridor || nav.approachTarget || slot || leader, length = Math.hypot(target.x - m.x, target.y - m.y);
          // Long gaps are closed by checked local strides; neither dormant
          // actors nor a distant leader can cause an instantaneous relocation.
          const direct = length > 80 ? walkPoint(m.x + (target.x - m.x) * 24 / length,
            m.y + (target.y - m.y) * 24 / length, m.h, true) : target;
          const failed = nav.blockedDirect;
          const alreadyBlocked = direct && failed && failed.x === m.x && failed.y === m.y && failed.h === m.h &&
            failed.tx === direct.x && failed.ty === direct.y && failed.th === direct.h;
          const clear = direct && !alreadyBlocked && clearWalk(m, direct);
          if (clear) {
            nav.goal = direct; nav.trailId = 0; nav.waypoint = !!corridor || length > 80; nav.detourFailure = null;
            nav.compact = null;
          } else if (nav.compact) {
            // Hold the checked compact position until the ordinary slot
            // becomes directly walkable again (for example a hull drove off).
            nav.goal = copyPoint(nav.compact.point); nav.waypoint = true;
          } else {
            // A long failed direct segment plus a long valid breadcrumb can
            // exceed a frame budget. Resume that pending search without paying
            // for the same known-blocked segment again. Changed poses invalidate
            // this exact key, and completing the search discards it entirely.
            if (direct && !alreadyBlocked && !routeDeferred)
              nav.blockedDirect = { x: m.x, y: m.y, h: m.h, tx: direct.x, ty: direct.y, th: direct.h };
            const compact = !corridor && !nav.approachTarget && !routeDeferred && Math.abs(m.h - leader.h) < 2 &&
              distance2(m, leader) <= COMPACT_NEAR * COMPACT_NEAR ? compactPoint(m, rank) : null;
            const goal = compact || corridor ? null : trailGoal(m, nav);
            if (compact) {
              nav.compact = { point: copyPoint(compact), leader: copyPoint(leader) };
              nav.goal = copyPoint(compact); nav.waypoint = true; nav.trailId = 0;
              nav.detour = null; nav.detourRoute = null; nav.detourFailure = null;
            } else if (goal) { nav.goal = goal; nav.waypoint = true; }
            else if (!routeDeferred) {
              let detour = null;
              if (nav.spawnRoute && distance2(nav.spawnRoute.target, leader) <= 36) {
                nav.detourRoute = nav.spawnRoute; nav.spawnRoute = null;
                detour = detourWaypoint(m, nav);
              }
              if (!detour) detour = detourGoal(m, nav, routeTarget);
              nav.goal = detour ? copyPoint(detour) : copyPoint(m); nav.waypoint = true;
            }
          }
          if (routeDeferred) nav.nextRouteAt = clock;
          else nav.blockedDirect = null;
        }
      }
      // Dormant soldiers use the actual frame duration, not a quarter-second
      // lump. Keep native actors in the host's custody and retain sweep checks.
      for (const m of living) {
        if (m.phase !== 'active') continue;
        const nav = navigation.get(m.id);
        // A checked formation slot also completes a recall, including a
        // caller seated in a hull that the direct approach cannot enter.
        const recallRadius = Math.max(RECALL_NEAR, formationDistance(nav, true) + 2);
        if (regrouping.has(m.id) && !nav.waypoint && distance2(m, nav.goal) <= 1.5 * 1.5 &&
          distance2(m, leader) <= recallRadius * recallRadius) regrouping.delete(m.id);
        if (!activeIds.has(m.id) && dt > 0) {
          const length = Math.hypot(nav.goal.x - m.x, nav.goal.y - m.y);
          const recalling = regrouping.has(m.id), stop = followStop(m, nav, recalling);
          const regroupRadius = Math.max(FOLLOW_REGROUP, formationDistance(nav) + 2);
          const speed = recalling || distance2(m, leader) > regroupRadius * regroupRadius ? runSpeed : walkSpeed;
          const distance = Math.min(Math.max(0, length - stop), speed * Math.min(.5, dt));
          if (distance > 0) {
            const ox = m.x, oy = m.y, steps = Math.min(18, Math.ceil(distance / .24));
            for (let i = 1; i <= steps; i++) {
              const t = distance / length * i / steps;
              const p = walkPoint(ox + (nav.goal.x - ox) * t, oy + (nav.goal.y - oy) * t, m.h, false, m);
              if (!p) { nav.nextRouteAt = 0; nav.trailId = 0; nav.detourRoute = null; nav.detour = null; break; }
              Object.assign(m, p);
            }
          }
        }
      }
    }
    function roleFor(slot) {
      if (enemy) {
        const n = slot % 6;
        return n === 4 ? { role: 'machinegun', roleName: '지원 기관총병', weapon: 'm249' } :
          n === 5 ? { role: 'antitank', roleName: '지원 대전차병', weapon: 'rpg' } :
            { role: 'rifle', roleName: '지원 소총병', weapon: 'ar' };
      }
      const n = slot % 10;
      // Preserve ten shields and the thirty-person manifest. Each truck also
      // brings one real RPG and sniper, replacing two ordinary rifle slots.
      return ALLY_ROLES[n < 3 || slot === 3 ? 'shield' : n === 5 ? 'antitank' : n === 6 ? 'sniper' :
        n === 7 ? 'supply' : n === 8 ? 'machinegun' : n === 9 ? 'medic' : 'rifle'];
    }
    function decorate(m) {
      return {
        ...m, ...roleFor(m.slot), index: (m.missionId - 1) * REQUEST_SIZE + m.slot,
        epoch: m.missionId, life: 0, team, initialTeam: team, siteId,
        alive: !m.dead && m.phase === 'active', available: !m.dead && m.phase === 'active',
        embarked: !m.dead && m.phase === 'embarked', mobile: true, placement: 'reinforcement',
        sourceId: m.sourceId || siteId, home: copyPoint(m.home), rally: copyPoint(m.rally), routeSites: [],
        marching: !!(enemy && enemyMarchEnabled && followAllowed && !m.dead && leader && distance2(m, leader) > RECALL_NEAR * RECALL_NEAR),
        reinforcementProgress: m.phase === 'active' ? 1 : 0
      };
    }
    function status() {
      let live = 0, embarked = 0, active = 0;
      for (const m of members.values()) if (!m.dead) {
        live++; if (m.phase === 'embarked') embarked++; else if (m.phase === 'active') active++;
      }
      const cooldown = Math.max(0, cooldownUntil - clock);
      return { cooldown, available: !enemy && cooldown === 0 && live + REQUEST_SIZE <= capacity && nextMissionId <= MAX_MISSION,
        infantryAvailable: (enemy || cooldown === 0) && live + infantryBatch <= capacity && nextMissionId <= MAX_MISSION,
        infantryBatch, live, embarked, active, canRecall: live > 0, recalling: regrouping.size,
        capacity, requestSize: REQUEST_SIZE, nextMissionId };
    }
    function rallySlot(rally, slot) {
      const angle = slot * 2.399963229728653;
      for (const radius of [7 + Math.floor(slot / 10) * 4, 4, 12, 18, 24, 0]) {
        for (let turn = 0; turn < (radius ? 8 : 1); turn++) {
          const a = angle + turn * Math.PI / 4;
          const p = safePoint({ x: rally.x + Math.cos(a) * radius, y: rally.y + Math.sin(a) * radius, h: rally.h });
          if (p) return p;
        }
      }
      return null;
    }
    function recall(player) {
      if (!player || player.alive === false || player.followAllowed === false) return { ok: false, reason: 'invalid' };
      const target = safePoint(player);
      if (!target) return { ok: false, reason: 'invalid' };
      const living = [...members.values()].filter(m => !m.dead);
      if (!living.length) return { ok: false, reason: 'empty' };
      // Retain survivor identity, health, transport ownership and pose. A
      // command never creates troops, changes cooldowns or bypasses movement.
      regrouping = new Set(living.map(m => m.id));
      for (const m of living) {
        m.rally = copyPoint(target);
        const nav = navigation.get(m.id);
        if (nav) {
          nav.goal = copyPoint(m); nav.trailId = 0; nav.nextRouteAt = 0; nav.waypoint = true;
          nav.blockedDirect = null; nav.searchTurn = 0;
        }
      }
      followKnown = followAllowed = true; followElapsed = 0;
      // Start only the same bounded work as an ordinary moving frame. Calling
      // the zero-time restore path here would force the whole roster at once.
      probes = FOLLOW_FRAME_PROBES;
      if (refreshLeader({ ...target, ...(finite(player.yaw) ? { yaw: player.yaw } : {}) })) advanceFollow(0, new Set());
      return { ok: true, count: living.length, embarked: living.filter(m => m.phase === 'embarked').length };
    }
    function requestTransports(spec, count, legacy = false) {
      // Only allied requests use physical passenger trucks.
      if (enemy) return { ok: false, reason: 'unsupported' };
      const current = status();
      if (current.cooldown > 0) return { ok: false, reason: 'cooldown' };
      if (current.live + count > capacity) return { ok: false, reason: 'capacity' };
      if (nextMissionId > MAX_MISSION) return { ok: false, reason: 'limit' };
      if (!spec || !validPoint(spec.rally) || !Array.isArray(spec.groups) || spec.groups.length !== count / 10)
        return { ok: false, reason: 'invalid' };
      const rally = legacy ? spec.rally : safePoint(spec.rally);
      if (!rally) return { ok: false, reason: 'terrain' };
      const ids = new Set();
      for (const group of spec.groups) {
        if (!group || !validPoint(group) || group.count !== 10 || typeof group.vehicleId !== 'string' ||
          !group.vehicleId.length || group.vehicleId.length > 180 || ids.has(group.vehicleId)) return { ok: false, reason: 'invalid' };
        ids.add(group.vehicleId);
        // New convoy trucks belong to one wave. Reusing a still-recorded truck
        // would mix its delivered survivors with the next passenger manifest.
        for (const m of members.values()) if (m.vehicleId === group.vehicleId && (!legacy || !m.dead && m.phase === 'embarked'))
          return { ok: false, reason: 'transport-busy' };
      }
      // Build the whole wave before committing any state, including the cooldown.
      const missionId = nextMissionId, added = [];
      for (let gi = 0; gi < spec.groups.length; gi++) {
        const group = spec.groups[gi];
        for (let j = 0; j < 10; j++) {
          const slot = gi * 10 + j;
          added.push({ id: idPrefix + missionId + '-' + slot, missionId, slot,
            vehicleId: group.vehicleId, createdAt: clock, x: group.x, y: group.y, h: group.h,
            hp: 100, dead: false, phase: 'embarked', home: rallySlot(rally, slot) || copyPoint(rally),
            rally: copyPoint(rally), diedAt: 0, byPlayer: false });
        }
      }
      for (const [id, m] of members) if (m.dead) { members.delete(id); navigation.delete(id); regrouping.delete(id); }
      for (const m of added) members.set(m.id, m);
      nextMissionId++;
      cooldownUntil = clock + COOLDOWN;
      return { ok: true, missionId, count: added.length, members: added.map(decorate) };
    }
    // Legacy three-vehicle callers share the current infantry cooldown.
    function request(spec) { return requestTransports(spec, REQUEST_SIZE, true); }
    // Three supply trucks carry ten soldiers each. Embarked troops reserve
    // the same 300-person budget and become actors only after disembark.
    function requestConvoy(spec) { return requestTransports(spec, INFANTRY_BATCH); }
    // Immediate foot infantry uses native collision and the existing bounded
    // follow scheduler; old three-transport convoy saves remain compatible.
    function requestInfantry(spec) {
      const current = status();
      if (!enemy && current.cooldown > 0) return { ok: false, reason: 'cooldown' };
      if (current.live + infantryBatch > capacity) return { ok: false, reason: 'capacity' };
      if (nextMissionId > MAX_MISSION) return { ok: false, reason: 'limit' };
      if (!spec || !validPoint(spec.rally) || spec.sourceId !== undefined &&
          (typeof spec.sourceId !== 'string' || !spec.sourceId.length || spec.sourceId.length > 180)) return { ok: false, reason: 'invalid' };
      const rally = safePoint(spec.rally);
      if (!rally) return { ok: false, reason: 'terrain' };
      const missionId = nextMissionId, added = [], occupied = [], spawnRoutes = new Map();
      for (const m of members.values()) if (!m.dead && m.phase === 'active') occupied.push(m);
      function addSpawn(node, minimumRadius = 6) {
        const candidate = copyPoint(node);
        if (distance2(candidate, rally) < minimumRadius * minimumRadius || occupied.some(m => Math.abs(m.h - candidate.h) < 2 &&
          distance2(m, candidate) < 2.1 * 2.1) || added.some(m => distance2(m, candidate) < 2.1 * 2.1)) return;
        try { if (spawnBlocked && spawnBlocked(candidate.x, candidate.y, candidate.h, 1.8, .42)) return; }
        catch (_) { return; }
        const slot = added.length, id = idPrefix + missionId + '-' + slot;
        added.push({ id, missionId, slot, vehicleId: 'infantry-' + missionId + '-' + Math.floor(slot / 10),
          ...(spec.sourceId !== undefined ? { sourceId: spec.sourceId } : {}),
          createdAt: clock, ...candidate, hp: 100, dead: false, phase: 'active',
          home: copyPoint(candidate), rally: copyPoint(rally), diedAt: 0, byPlayer: false });
        spawnRoutes.set(id, { target: copyPoint(rally), points: routePoints(node).reverse(), index: 1 });
      }
      // A small connected flood replaces unrelated ring samples. Every chosen
      // point has an actually walkable return route, including on sloping land.
      // The whole wave is still transactional and search has a hard input cap.
      const savedProbes = probes, savedDeferred = routeDeferred;
      probes = SPAWN_PROBES; routeDeferred = false;
      try {
        // A coarse lattice can miss a real gate or waste room in a small
        // courtyard. Refine only after it runs out, sharing the same budget.
        for (const gridStep of [2.6, 1.8, 1.3]) {
          const root = { ...rally, gx: 0, gy: 0, parent: null }, queue = [root], seen = new Set(['0,0']);
          added.length = 0; spawnRoutes.clear();
          for (let cursor = 0; cursor < queue.length && probes > 0 && added.length < infantryBatch; cursor++) {
            const node = queue[cursor];
            for (let turn = 0; turn < walkDirections.length && added.length < infantryBatch; turn++) {
              const [dx, dy] = walkDirections[(turn + missionId - 1) % walkDirections.length];
              const gx = node.gx + dx, gy = node.gy + dy, key = gx + ',' + gy;
              if (seen.has(key) || (gx * gx + gy * gy) * gridStep * gridStep > 31.2 * 31.2) continue;
              // The caller may be seated inside a grounded tank. Survey
              // connected terrain outward from that anchor, then require
              // every actual spawn to clear live hulls in addSpawn(). Follow
              // movement rechecks the cached return route against vehicles.
              const candidate = terrainWalk(node, rally.x + gx * gridStep, rally.y + gy * gridStep, true, false);
              if (routeDeferred) break;
              if (!candidate) continue;
              // A failed edge does not poison a cell: another side may reach it.
              seen.add(key);
              const next = { ...candidate, gx, gy, parent: node }; queue.push(next);
              addSpawn(next);
            }
            if (routeDeferred) break;
          }
          // A compact courtyard can already contain enough verified space.
          // Reuse its inner cells before paying for another lattice search;
          // unit spacing, hull exclusions and the clear player centre remain.
          if (gridStep === 2.6 && added.length < infantryBatch) {
            for (const node of queue) {
              addSpawn(node, 4);
              if (added.length === infantryBatch) break;
            }
          }
          if (added.length === infantryBatch || routeDeferred) break;
        }
      } finally { probes = savedProbes; routeDeferred = savedDeferred; }
      if (added.length !== infantryBatch) return { ok: false, reason: 'terrain' };
      for (const [id, m] of members) if (m.dead) {
        members.delete(id); navigation.delete(id); regrouping.delete(id);
      }
      for (const m of added) {
        members.set(m.id, m);
        navigation.set(m.id, { goal: copyPoint(m), trailId: 0, nextRouteAt: 0, waypoint: true, spawnRoute: spawnRoutes.get(m.id) });
      }
      nextMissionId++;
      if (!enemy) cooldownUntil = clock + COOLDOWN;
      return { ok: true, missionId, count: added.length, members: added.map(decorate) };
    }
    function update(dt, context = {}) {
      if (!finite(dt) || dt < 0) return;
      clock += dt;
      const player = context.player;
      enemyMarchEnabled = enemy && context.allowEnemyMarch === true;
      if (!player || !finite(player.x) || !finite(player.y)) {
        if (enemy || player && (player.followAllowed !== undefined || player.h !== undefined)) {
          followKnown = true; followAllowed = false; followElapsed = 0;
        }
        return;
      }
      // Never retire embarked troops: only the host knows whether their vehicle
      // is occupied. Native actors are removed by the next normal roster sync.
      for (const [id, m] of members) if (dt > 0 && !(enemyMarchEnabled && !m.dead && player.alive !== false && player.followAllowed !== false) &&
        m.phase !== 'embarked' && !regrouping.has(id) && clock - m.createdAt > RETIRE_SECONDS &&
        distance2(m, player) > RETIRE_DISTANCE * RETIRE_DISTANCE) { members.delete(id); navigation.delete(id); }
      if (!members.size) { navigation.clear(); regrouping.clear(); trail = []; leader = null; followAllowed = false; followElapsed = 0; return; }
      // Legacy callers that supply only x/y keep their clock/cleanup behavior.
      // A normalized invalid pose, however, immediately suppresses stale orders.
      if (!finite(player.h) && player.followAllowed === undefined) return;
      const wasAllowed = followAllowed;
      followKnown = true;
      followAllowed = player.alive !== false && player.followAllowed !== false && validPoint(player);
      if (!followAllowed) { followElapsed = 0; return; }
      probes = dt === 0 ? FOLLOW_PROBES : FOLLOW_FRAME_PROBES;
      followElapsed += Math.min(dt, .5);
      if (!wasAllowed || !leader || followElapsed >= FOLLOW_INTERVAL || dt === 0) {
        followElapsed = 0;
        if (!refreshLeader(player)) return;
      }
      const activeIds = context.activeMemberIds instanceof Set ? context.activeMemberIds : new Set(context.activeMemberIds || []);
      advanceFollow(Math.min(.5, dt), activeIds, dt === 0, enemy ? !enemyMarchEnabled : context.activeOnly === true);
    }
    function getMember(id) { const m = members.get(id); return m ? decorate(m) : null; }
    function getMemberState(id, out = {}) {
      const m = members.get(id); if (!m) return null;
      out.id = m.id; out.index = (m.missionId - 1) * REQUEST_SIZE + m.slot; out.epoch = m.missionId;
      out.hp = m.hp; out.dead = m.dead; out.alive = !m.dead && m.phase === 'active';
      out.available = out.alive; out.embarked = !m.dead && m.phase === 'embarked';
      out.team = team; out.siteId = siteId; out.phase = m.phase;
      return out;
    }
    function activeRoster(player, radius = 420, max = capacity) {
      if (!player || player.alive === false || !finite(player.x) || !finite(player.y) || !finite(radius) || radius < 0) return [];
      const limit = Math.max(0, Math.min(capacity, max | 0));
      const candidates = [...members.values()].filter(m => !m.dead && m.phase === 'active' && distance2(m, player) <= radius * radius)
        .sort((a, b) => distance2(a, player) - distance2(b, player) || a.missionId - b.missionId || a.slot - b.slot);
      if (enemy || candidates.length <= limit || !limit) return candidates.slice(0, limit).map(decorate);
      const roles = new Map();
      for (const m of candidates) {
        const role = roleFor(m.slot).role;
        if (!roles.has(role)) roles.set(role, []);
        roles.get(role).push(m);
      }
      if (limit < roles.size) return candidates.slice(0, limit).map(decorate);
      // Native combat has a fixed actor budget. Nearest-only selection would
      // permanently exclude every rear sniper once the army fills that cap.
      // Reserve a proportional share (at least one) per present role, then
      // fill remaining slots by proximity. Identity breaks exact ties.
      const selected = new Set();
      for (const group of roles.values()) {
        const share = Math.max(1, Math.floor(limit * group.length / candidates.length));
        for (let i = 0; i < share; i++) selected.add(group[i].id);
      }
      // For small caps, rounding several rare roles up can over-allocate.
      // Keep one representative of each role and use the same nearest order.
      if (selected.size > limit) {
        selected.clear();
        for (const group of roles.values()) selected.add(group[0].id);
      }
      for (const m of candidates) { if (selected.size >= limit) break; selected.add(m.id); }
      return candidates.filter(m => selected.has(m.id)).slice(0, limit).map(decorate);
    }
    function supplyMembers(out = []) {
      out.length = 0;
      if (enemy) return out;
      for (const m of members.values()) if (!m.dead && m.hp > 0 && m.phase === 'active' && m.slot % 10 === 7)
        out.push({ id: m.id, x: m.x, y: m.y, h: m.h });
      return out;
    }
    function transportMembers(vehicleId) {
      return [...members.values()].filter(m => !m.dead && m.phase === 'embarked' && m.vehicleId === vehicleId).map(decorate);
    }
    function transportCount(vehicleId) {
      let count = 0;
      for (const m of members.values()) if (!m.dead && m.phase === 'embarked' && m.vehicleId === vehicleId) count++;
      return count;
    }
    function setTransportPosition(vehicleId, p) {
      if (!validPoint(p)) return false;
      let changed = false;
      for (const m of members.values()) if (!m.dead && m.phase === 'embarked' && m.vehicleId === vehicleId) {
        m.x = p.x; m.y = p.y; m.h = p.h; changed = true;
      }
      return changed;
    }
    function disembark(vehicleId, positions) {
      if (!Array.isArray(positions) || !positions.length) return [];
      const aboard = [...members.values()].filter(m => !m.dead && m.phase === 'embarked' && m.vehicleId === vehicleId);
      const deployed = []; let next = 0;
      for (const candidate of positions.slice(0, 10)) {
        if (next >= aboard.length) break;
        const p = safePoint(candidate); if (!p) continue;
        let overlap = false;
        for (const m of members.values()) if (!m.dead && m.phase === 'active' && Math.abs(m.h - p.h) < 2 && distance2(m, p) < .8 * .8) { overlap = true; break; }
        if (overlap) continue;
        const m = aboard[next++];
        Object.assign(m, p, { phase: 'active' });
        // If no clear rally slot exists, hold the validated exit position.
        // A geometrically invalid fallback must not become an unreachable order.
        m.home = safePoint(m.home) || copyPoint(p);
        deployed.push(m.id);
      }
      return deployed;
    }
    function validEpoch(m, info) {
      const epoch = finite(info) ? info : info && info.epoch;
      return !finite(epoch) || epoch === m.missionId;
    }
    function reportDeath(id, info = {}) {
      const m = members.get(id); if (!m || m.dead || !validEpoch(m, info)) return false;
      m.dead = true; m.hp = 0; m.phase = 'dead'; m.diedAt = clock; m.byPlayer = !!info?.byPlayer;
      navigation.delete(id); regrouping.delete(id);
      return true;
    }
    function setMemberHealth(id, hp, info = {}) {
      const m = members.get(id); if (!m || m.dead || !finite(hp) || !validEpoch(m, info)) return false;
      if (hp <= 0) return reportDeath(id, info);
      m.hp = clamp(hp, 0, 100); return true;
    }
    function setMemberPosition(id, p, epoch) {
      const m = members.get(id);
      if (!m || m.dead || m.phase !== 'active' || !validEpoch(m, epoch) || !validPoint(p)) return false;
      Object.assign(m, copyPoint(p)); return true;
    }
    function getOrder(id) {
      const m = members.get(id); if (!m || m.dead || m.phase !== 'active') return null;
      if (followKnown) {
        const playerDistance = leader ? Math.hypot(leader.x - m.x, leader.y - m.y) : 0;
        const nav = navigation.get(id), following = !!(followAllowed && nav), recalling = following && regrouping.has(id);
        const regroupRadius = Math.max(FOLLOW_REGROUP, formationDistance(nav) + 2);
        return { ...(following ? nav.goal : copyPoint(m)), kind: 'follow', following, playerDistance, recalling,
          ...(!enemy && nav?.formation ? { formationRole: nav.formation.role, formationDepth: nav.formation.depth,
            formationRadius: formationDistance(nav), formationHeading: formationYaw || 0, formationPoint: idealFormationPoint(nav), waypoint: !!nav.waypoint } : {}),
          regroup: following && (recalling || playerDistance > regroupRadius),
          speed: following ? (recalling || playerDistance > regroupRadius ? runSpeed : walkSpeed) : 0,
          stopRadius: following && nav ? followStop(m, nav, recalling) : recalling || !enemy ? 1.2 : 2 };
      }
      return { ...m.home, kind: 'front', speed: enemy ? ENEMY_MARCH_SPEED : 4.5 };
    }
    function destroyTransport(vehicleId) {
      let killed = 0;
      for (const m of members.values()) if (!m.dead && m.phase === 'embarked' && m.vehicleId === vehicleId) {
        if (reportDeath(m.id)) killed++;
      }
      return killed;
    }
    function retireDistant(observer, minimumAge = 120, minimumDistance = 240) {
      if (!enemy || !observer || !finite(observer.x) || !finite(observer.y) ||
        !finite(minimumAge) || minimumAge < 0 || !finite(minimumDistance) || minimumDistance < 0) return [];
      // Contact navigation intentionally knows only a reported location. The
      // host separately supplies the real player's location for cheap cleanup;
      // it must never become a new enemy movement destination. Keep the active
      // 200m battle area intact even if a caller asks for more eager retirement.
      const distance = Math.max(200, minimumDistance), removed = [];
      for (const [id, m] of members) {
        if (!['active', 'dead'].includes(m.phase) || clock - m.createdAt < minimumAge ||
          distance2(m, observer) <= distance * distance || !m.dead && enemyMarchEnabled && followAllowed &&
          leader && distance2(m, leader) > RECALL_NEAR * RECALL_NEAR) continue;
        members.delete(id); navigation.delete(id); regrouping.delete(id); removed.push(id);
      }
      if (removed.length) {
        const retired = new Set(removed);
        trenchRepairs = trenchRepairs.filter(m => !retired.has(m.id));
        if (!members.size) {
          navigation.clear(); regrouping.clear(); trail = []; leader = null;
          followAllowed = false; followElapsed = 0; navigationTurn = 0;
        }
      }
      return removed;
    }
    function serialize() {
      return { schema, version: 1, clock, cooldownUntil, nextMissionId,
        ...(!enemy && formationYaw !== null ? { formationYaw } : {}),
        ...(regrouping.size ? { regrouping: [...regrouping] } : {}),
        members: [...members.values()].map(m => ({ ...m, home: copyPoint(m.home), rally: copyPoint(m.rally) })) };
    }
    function restore(saved) {
      if (!saved || saved.schema !== schema || saved.version !== 1 || !finite(saved.clock) || saved.clock < 0 || saved.clock > 1e9 ||
        !finite(saved.cooldownUntil) || saved.cooldownUntil < 0 || saved.cooldownUntil > saved.clock + LEGACY_COOLDOWN + 1e-6 ||
        !Number.isSafeInteger(saved.nextMissionId) || saved.nextMissionId < 1 || saved.nextMissionId > MAX_MISSION + 1 ||
        !Array.isArray(saved.members) || saved.members.length > (enemy ? ENEMY_LEGACY_CAPACITY : capacity) ||
        !enemy && saved.formationYaw !== undefined && (!finite(saved.formationYaw) || Math.abs(saved.formationYaw) > Math.PI + 1e-8)) return false;
      const restored = new Map(), perMission = new Map(), vehicleMission = new Map();
      for (const m of saved.members) {
        if (!m || !Number.isInteger(m.missionId) || m.missionId < 1 || m.missionId >= saved.nextMissionId ||
          !Number.isInteger(m.slot) || m.slot < 0 || m.slot >= (enemy ? ENEMY_LEGACY_BATCH : REQUEST_SIZE) || m.id !== idPrefix + m.missionId + '-' + m.slot || restored.has(m.id) ||
          typeof m.vehicleId !== 'string' || !m.vehicleId.length || m.vehicleId.length > 180 ||
          m.sourceId !== undefined && (typeof m.sourceId !== 'string' || !m.sourceId.length || m.sourceId.length > 180) ||
          !validPoint(m) || !validPoint(m.home) || !validPoint(m.rally) || !finite(m.createdAt) || m.createdAt < 0 || m.createdAt > saved.clock ||
          !finite(m.hp) || m.hp < 0 || m.hp > 100 || typeof m.dead !== 'boolean' ||
          !['embarked', 'active', 'dead'].includes(m.phase) || (enemy && m.phase === 'embarked') || m.dead !== (m.phase === 'dead') || m.dead !== (m.hp === 0) ||
          !finite(m.diedAt) || m.diedAt < 0 || m.diedAt > saved.clock || typeof m.byPlayer !== 'boolean') return false;
        const mission = perMission.get(m.missionId) || { count: 0, groups: new Map() };
        const group = Math.floor(m.slot / 10), expected = mission.groups.get(group);
        if (expected && expected !== m.vehicleId) return false;
        if ([...mission.groups].some(([other, id]) => other !== group && id === m.vehicleId)) return false;
        mission.count++; mission.groups.set(group, m.vehicleId); perMission.set(m.missionId, mission);
        if (mission.count > (enemy ? ENEMY_LEGACY_BATCH : REQUEST_SIZE)) return false;
        if (!m.dead && m.phase === 'embarked') {
          const owningMission = vehicleMission.get(m.vehicleId);
          if (owningMission && owningMission !== m.missionId) return false;
          vehicleMission.set(m.vehicleId, m.missionId);
        }
        restored.set(m.id, { id: m.id, missionId: m.missionId, slot: m.slot, vehicleId: m.vehicleId, createdAt: m.createdAt,
          ...(m.sourceId !== undefined ? { sourceId: m.sourceId } : {}),
          x: m.x, y: m.y, h: m.h, hp: m.hp, dead: m.dead, phase: m.phase, home: copyPoint(m.home), rally: copyPoint(m.rally),
          diedAt: m.diedAt, byPlayer: m.byPlayer });
      }
      // Optional additive v1 metadata leaves existing saves valid and retains
      // pending recall orders without reviving casualties or adding members.
      const recalled = saved.regrouping === undefined ? [] : saved.regrouping;
      if (!Array.isArray(recalled) || recalled.length > (enemy ? ENEMY_LEGACY_CAPACITY : capacity) || new Set(recalled).size !== recalled.length ||
        recalled.some(id => typeof id !== 'string' || !restored.has(id) || restored.get(id).dead)) return false;
      // Old enemy saves may contain two twelve-person waves. Keep stable
      // survivor identities and health up to the new cap; retiring excess
      // records is not a kill and emits no casualty, reward or loot event.
      if (enemy && restored.size > capacity) {
        const keep = new Set([...restored.values()].filter(m => !m.dead).slice(0, capacity).map(m => m.id));
        for (const m of restored.values()) if (keep.size < capacity && m.dead) keep.add(m.id);
        for (const id of restored.keys()) if (!keep.has(id)) restored.delete(id);
      }
      trenchRepairs = [];
      if (recoverTrenchPoint || recoverRoadPoint || recoverSupportPoint) for (const m of restored.values()) {
        if (m.dead || m.phase !== 'active') continue;
        const repaired = recoverTrenchPoint?.(m) || recoverRoadPoint?.(m) || recoverSupportPoint?.(m);
        if (repaired) { Object.assign(m, repaired); trenchRepairs.push({ id: m.id, ...repaired }); }
        for (const key of ['home', 'rally']) {
          const target = recoverTrenchPoint?.(m[key]) || recoverRoadPoint?.(m[key]);
          if (target) m[key] = target;
        }
      }
      regrouping = new Set(recalled.filter(id => restored.has(id)));
      members = restored; clock = saved.clock;
      // Older allied v1 saves used a 90-second timer. Keep a shorter remainder,
      // but apply the current one-minute limit without resetting enemy state.
      cooldownUntil = Math.min(saved.cooldownUntil, clock + COOLDOWN); nextMissionId = saved.nextMissionId;
      followKnown = followAllowed = false; leader = null; followElapsed = 0; enemyMarchEnabled = false;
      formationYaw = !enemy && saved.formationYaw !== undefined ? saved.formationYaw : null;
      trail = []; trailSerial = 0; navigation = new Map(); navigationTurn = 0;
      corridorField = null;
      return true;
    }
    return {
      schema, version: 1, get clock() { return clock; }, get roster() { return [...members.values()].map(decorate); },
      consumeTrenchRepairs() { const result = trenchRepairs; trenchRepairs = []; return result; },
      request, requestConvoy, requestInfantry, recall, status, update, getMember, getMemberState, activeRoster, supplyMembers, getRoster: () => [...members.values()].map(decorate),
      transportMembers, transportCount, setTransportPosition, disembark, getOrder, setMemberHealth, setMemberPosition, reportDeath, destroyTransport, retireDistant,
      serialize, restore, constants: Object.freeze({ CAPACITY: capacity, REQUEST_SIZE, INFANTRY_BATCH: infantryBatch, COOLDOWN, RETIRE_SECONDS, RETIRE_DISTANCE,
        FOLLOW_INTERVAL, FOLLOW_WALK: walkSpeed, FOLLOW_RUN: runSpeed, ENEMY_MARCH_SPEED, FOLLOW_REGROUP, FOLLOW_TRAIL_LIMIT, FOLLOW_FRAME_PROBES, FOLLOW_FRAME_ROUTES, RECALL_NEAR })
    };
  }
  global.HanQEasternSupport = Object.freeze({ schema: SCHEMA, version: 1, create });
})(typeof window !== 'undefined' ? window : globalThis);




