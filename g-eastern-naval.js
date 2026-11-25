/* Eastern naval front: deterministic fleet state and geometry, independent of the renderer.
 * Native coordinates: x/y are the sea plane; h is elevation. a=0 faces +x,
 * a=PI/2 faces +y. All lengths are game metres and timers are simulation seconds.
 * Install after the host's indexed world baseline. No RNG, DOM or native save access.
 */
(function (global) {
  'use strict';
  const SCHEMA = 'hanq-eastern-naval', VERSION = 1, TAU = Math.PI * 2, EPS = 1e-9;
  const BOUNDS = Object.freeze({ minX: 3072, maxX: 4800, minY: -600, maxY: 2900 });
  const MIN_SHIP_X = 3180, ACTIVATE_RANGE = 1200, RESPAWN_CLEARANCE = 350;
  // Matched to the main turret pivots/barrels in g-eastern-naval-assets.js.
  // Pivots rotate with the hull; barrel offsets rotate with the aimed turret.
  const GUN_MOUNTS = Object.freeze({
    destroyer: Object.freeze({ forward: 27.5, side: 0, height: 5.25, barrel: 7.35, barrelHeight: 1.8 }),
    patrol: Object.freeze({ forward: 4.6, side: 0, height: 2.25, barrel: 2, barrelHeight: 1.05 })
  });
  const CARRIER_VLS = Object.freeze([-49, -45, -41]);
  // Actual flight-deck outline from the shipped carrier, converted from the
  // asset's +Z bow to native forward/side coordinates. The aft stair already
  // exists in the model; boarding uses its upper landing, not an invented dock.
  const CARRIER_DECK = Object.freeze([[-29,-120],[26,-120],[32,-103],[31,90],[15,120],[-7,120],[-21,102],[-25,47],[-32,13],[-32,-80]].map(([x,z])=>Object.freeze([z,-x])));
  const PROFILES = Object.freeze({
    carrier: Object.freeze({ L: 240, W: 64, deck: 14, height: 50.5, draft: 8.5, hp: 7200,
      ammo: 96, range: 1450, damage: 190, speed: 220, radius: 13, interval: 14,
      salvo: 3, salvoDelay: .42, cruise: 0, turn: 0, rearm: 14, shot: 'missile' }),
    destroyer: Object.freeze({ L: 76, W: 15, deck: 5.2, height: 27.75, draft: 4.6, hp: 2200,
      ammo: 90, range: 900, damage: 108, speed: 180, radius: 9, interval: 5.8,
      salvo: 1, salvoDelay: 0, cruise: 7, turn: .19, rearm: 8, shot: 'shell' }),
    patrol: Object.freeze({ L: 18, W: 5, deck: 2.2, height: 9.4, draft: 1.4, hp: 480,
      ammo: 110, range: 520, damage: 42, speed: 140, radius: 5, interval: 3.7,
      salvo: 1, salvoDelay: 0, cruise: 10, turn: .48, rearm: 5, shot: 'shell' })
  });
  const SPAWNS = Object.freeze([
    ['en-ally-carrier', '청해 항공모함', 'carrier', 'ally', 3650, 2250, -Math.PI / 2],
    ['en-enemy-carrier', '흑조 항공모함', 'carrier', 'enemy', 4200, 100, Math.PI / 2],
    ['en-ally-destroyer-1', '청해 호위함 1', 'destroyer', 'ally', 3440, 1700, -Math.PI / 2],
    ['en-ally-destroyer-2', '청해 호위함 2', 'destroyer', 'ally', 3880, 1260, -Math.PI / 2],
    ['en-enemy-destroyer-1', '흑조 호위함 1', 'destroyer', 'enemy', 4190, 790, Math.PI / 2],
    ['en-enemy-destroyer-2', '흑조 호위함 2', 'destroyer', 'enemy', 4520, 1210, Math.PI / 2],
    ['en-ally-patrol-1', '청해 고속정 1', 'patrol', 'ally', 3670, 1570, -Math.PI / 2],
    ['en-ally-patrol-2', '청해 고속정 2', 'patrol', 'ally', 3420, 1160, -Math.PI / 2],
    ['en-ally-patrol-3', '청해 출항정', 'patrol', 'ally', 3190, 2600, -Math.PI / 2],
    ['en-enemy-patrol-1', '흑조 고속정 1', 'patrol', 'enemy', 4370, 810, Math.PI / 2],
    ['en-enemy-patrol-2', '흑조 고속정 2', 'patrol', 'enemy', 3980, 810, Math.PI / 2],
    ['en-enemy-patrol-3', '흑조 고속정 3', 'patrol', 'enemy', 4580, 540, Math.PI / 2]
  ].map(row => Object.freeze(row)));
  const finite = Number.isFinite;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const number = (v, fallback, lo = -1e9, hi = 1e9) => finite(v) ? clamp(v, lo, hi) : fallback;
  const angle = v => v >= -Math.PI && v <= Math.PI ? v : Math.atan2(Math.sin(v), Math.cos(v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const validPoint = p => !!p && finite(p.x) && finite(p.y) && finite(p.h);
  const validPlayer = p => !!p && p.alive !== false && finite(p.x) && finite(p.y);
  const factionOf = options => options && (options.faction === 'ally' || options.faction === 'enemy') ? options.faction : null;

  // Slab clipping returns the first physical intersection along the complete
  // swept segment. A shot starting inside a box hits at t=0; zero-length probes
  // are useful for solidAt/waterBlocked adapters.
  function segmentBox(a, b, box) {
    let enter = 0, leave = 1, normal = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
      const d = b[axis] - a[axis], lo = box.min[axis], hi = box.max[axis];
      if (!finite(d)) return null;
      if (Math.abs(d) <= EPS) { if (a[axis] < lo - EPS || a[axis] > hi + EPS) return null; continue; }
      let t0 = (lo - a[axis]) / d, t1 = (hi - a[axis]) / d, sign = -1;
      if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; sign = 1; }
      if (t0 > enter) { enter = t0; normal = [0, 0, 0]; normal[axis] = sign; }
      leave = Math.min(leave, t1);
      if (enter > leave + EPS) return null;
    }
    return leave < -EPS || enter > 1 + EPS ? null : { t: clamp(enter, 0, 1), normal };
  }

  function create(options = {}) {
    const sea = number(options.seaLevel, 0, -10000, 10000), bounds = BOUNDS;
    let clock = 0, activeIntervention = false, lastControlledId = null, restored = false;
    const ships = SPAWNS.map((row, index) => {
      const [id, name, kind, faction, x, y, a] = row, p = PROFILES[kind];
      return { id, name, kind, faction, x, y, a, h: sea, L: p.L, W: p.W, deck: p.deck,
        height: p.height, draft: p.draft, hp: p.hp, maxHp: p.hp, dead: false, sinkTime: 0,
        ammo: p.ammo, maxAmmo: p.ammo, cooldown: .25 * index, v: 0, vx: 0, vy: 0,
        home: { x, y, a }, respawnEpoch: 0, targetId: null, aimYaw: null, controlled: false,
        salvoRemaining: 0, quietTime: 0, resupplyTime: 0, thinkTime: 0,
        lastHit: -1e6, index };
    });
    const byId = new Map(ships.map(s => [s.id, s]));
    const profiles = new Map(ships.map(s => [s.id, PROFILES[s.kind]]));
    const teamOf = value => { const s=typeof value==='string'?byId.get(value):value;return s ? s.playerOwned ? 'ally' : s.faction : null; };
    function command(id) {
      const s=byId.get(id);
      if(!s||s.dead||s.hp<=0||s.kind==='carrier')return null;
      if(s.faction==='enemy')s.playerOwned=true;
      s.controlled=true;s.targetId=null;lastControlledId=s.id;
      return s;
    }
    const boxes = new Map(ships.map(s => {
      const L = s.L, W = s.W, d = s.deck;
      const result = [
        { part: 'hull', min: [-L * .43, -W * .43, -s.draft], max: [L * .32, W * .43, d - .35] },
        { part: 'hull', min: [-L * .5, -W * .34, -s.draft * .7], max: [-L * .43, W * .34, d - .35] },
        { part: 'hull', min: [L * .32, -W * .30, -s.draft * .6], max: [L * .49, W * .30, d - .35] },
        { part: 'deck', min: [-L * .5, -W * .5, d - .4], max: [L * .5, W * .5, d + .22] }
      ];
      // The asset faces local +Z and is rotated by PI/2-a in the host. Its
      // local +X therefore maps to NEGATIVE lateral distance here. Keep the
      // starboard carrier island and the tall, narrow masts at their real
      // positions instead of treating the whole airspace above a ship as solid.
      if (s.kind === 'carrier') {
        const iz = s.faction === 'enemy' ? -3 : -13;
        result.push(
          { part: 'island', min: [iz - 17, -28.4, 14], max: [iz + 17, -16.6, 24.8] },
          { part: 'island', min: [iz - 13.4, -29, 24.2], max: [iz + 15.4, -15.2, 29.83] },
          { part: 'island', min: [iz - 15.1, -27.5, 29.7], max: [iz + 1.4, -18.5, 35.8] },
          { part: 'radar', min: [iz + 1.2, -25.4, 29.7], max: [iz + 7.2, -19.6, 44.5] },
          { part: 'radar', min: [iz + 4.04, -29.2, 42.6], max: [iz + 4.36, -15.8, 45] },
          { part: 'mast', min: [iz + 4.04, -22.66, 42.5], max: [iz + 4.36, -22.34, 50.5] }
        );
      } else if (s.kind === 'destroyer') {
        result.push(
          { part: 'bridge', min: [-16, -5.15, 5.2], max: [14, 5.15, 6.85] },
          { part: 'bridge', min: [-3.1, -5.1, 6.6], max: [11.1, 5.1, 11.7] },
          { part: 'bridge', min: [-19.9, -3.5, 5.5], max: [-12.1, 3.5, 10.9] },
          { part: 'funnel', min: [-14.25, -2.7, 7.3], max: [-3.35, 2.7, 12.55] },
          { part: 'radar', min: [-2.3, -3.1, 11.4], max: [5.1, 3.1, 15.8] },
          { part: 'radar', min: [-.6, -2.3, 15.6], max: [3.4, 2.3, 20.4] },
          { part: 'mast', min: [1.27, -.13, 20.25], max: [1.53, .13, 27.75] },
          { part: 'gun', min: [25, -2.5, 5.25], max: [32, 2.5, 8.4] }
        );
      } else {
        result.push(
          { part: 'bridge', min: [-2.65, -1.83, 2.2], max: [2.85, 1.83, 5.18] },
          { part: 'mast', min: [-1.65, -1, 5.18], max: [-.95, 1, 7.9] },
          { part: 'mast', min: [-1.255, .545, 6.4], max: [-1.145, .655, 9.4] }
        );
      }
      return [s.id, result];
    }));
    // Collision shapes are immutable; poses and sinking depth are not. Keep a
    // conservative horizontal radius/height envelope per hull, then test the
    // complete swept segment against its current position before allocating
    // local endpoints or visiting individual deck/mast/bridge volumes.
    const traceBounds = new Map(ships.map(s => {
      let radius = 0, minH = Infinity, maxH = -Infinity;
      for (const box of boxes.get(s.id)) {
        radius = Math.max(radius, Math.hypot(Math.max(Math.abs(box.min[0]), Math.abs(box.max[0])),
          Math.max(Math.abs(box.min[1]), Math.abs(box.max[1]))));
        minH = Math.min(minH, box.min[2]); maxH = Math.max(maxH, box.max[2]);
      }
      return [s.id, { radius, minH, maxH }];
    }));

    function contains(x, y, pad = 0) {
      return finite(x) && finite(y) && finite(pad) && x >= bounds.minX - pad && x <= bounds.maxX + pad && y >= bounds.minY - pad && y <= bounds.maxY + pad;
    }
    function local(s, point) {
      const ca = Math.cos(s.a), sa = Math.sin(s.a), dx = point.x - s.x, dy = point.y - s.y;
      return [dx * ca + dy * sa, -dx * sa + dy * ca, point.h - sea + (s.dead ? Math.min(60, s.sinkTime * .8) : 0)];
    }
    function world(s, forward, side, height) {
      const ca = Math.cos(s.a), sa = Math.sin(s.a);
      return { x: s.x + forward * ca - side * sa, y: s.y + forward * sa + side * ca, h: sea + height };
    }
    function weaponShip(value) {
      const s = typeof value === 'string' ? byId.get(value) : value;
      return s && PROFILES[s.kind] && [s.x, s.y, s.a].every(finite) ? s : null;
    }
    function gunPivot(value) {
      const s = weaponShip(value); if (!s) return null;
      if (s.kind === 'carrier') return world(s, CARRIER_VLS[1], -29, 15.8);
      const mount = GUN_MOUNTS[s.kind];
      return world(s, mount.forward, mount.side, mount.height);
    }
    function muzzlePoint(value, aimYaw, salvoIndex = 0) {
      const s = weaponShip(value); if (!s) return null;
      if (s.kind === 'carrier') return world(s, CARRIER_VLS[Math.floor(number(salvoIndex, 0, 0, 2))], -29, 15.8);
      const mount = GUN_MOUNTS[s.kind], pivot = gunPivot(s), yaw = number(aimYaw, s.a);
      return { x: pivot.x + Math.cos(yaw) * mount.barrel,
        y: pivot.y + Math.sin(yaw) * mount.barrel, h: pivot.h + mount.barrelHeight };
    }
    function eligible(s, opts, damageOnly = false) {
      if (s.id === opts.excludeId || s.id === opts.sourceShipId) return false;
      if (s.dead && (damageOnly || !opts.includeDead || s.sinkTime >= 60)) return false;
      const faction = factionOf(opts);
      return !faction || teamOf(s) !== faction || (!damageOnly && opts.includeAllies === true);
    }
    function trace(from, to, opts = {}) {
      if (!validPoint(from) || !validPoint(to) || ![to.x - from.x, to.y - from.y, to.h - from.h].every(finite)) return null;
      opts = opts || {};
      const minX = Math.min(from.x, to.x), maxX = Math.max(from.x, to.x);
      const minY = Math.min(from.y, to.y), maxY = Math.max(from.y, to.y);
      const minH = Math.min(from.h, to.h), maxH = Math.max(from.h, to.h);
      // Slab clipping permits EPS in segment time as well as coordinates.
      // Scale the broad-phase tolerance so a long grazing ray is never culled
      // when the existing exact intersection would accept its endpoint.
      const margin = EPS * (1 + Math.abs(to.x - from.x) + Math.abs(to.y - from.y) + Math.abs(to.h - from.h));
      let best = null;
      for (const s of ships) {
        if (!eligible(s, opts)) continue;
        const bounds = traceBounds.get(s.id), sink = s.dead ? Math.min(60, s.sinkTime * .8) : 0;
        if (maxX < s.x - bounds.radius - margin || minX > s.x + bounds.radius + margin ||
            maxY < s.y - bounds.radius - margin || minY > s.y + bounds.radius + margin ||
            maxH < sea + bounds.minH - sink - margin || minH > sea + bounds.maxH - sink + margin) continue;
        const a = local(s, from), b = local(s, to);
        for (const box of boxes.get(s.id)) {
          const hit = segmentBox(a, b, box);
          if (!hit || (best && hit.t >= best.t - EPS)) continue;
          const t = hit.t, ca = Math.cos(s.a), sa = Math.sin(s.a), n = hit.normal;
          best = { ship: s, id: s.id, t, x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t, h: from.h + (to.h - from.h) * t,
            part: box.part, normal: { x: n[0] * ca - n[1] * sa, y: n[0] * sa + n[1] * ca, h: n[2] } };
        }
      }
      return best;
    }
    function damage(id, amount, opts = {}) {
      const s = byId.get(typeof id === 'string' ? id : id && id.id);
      opts = opts || {};
      if (!s || !finite(amount) || amount <= 0 || !eligible(s, opts, true)) return { hit: false, damage: 0, id: s?.id || null };
      const applied = Math.min(Math.max(0, s.hp), amount);
      s.hp = Math.max(0, s.hp - applied); s.lastHit = clock; s.quietTime = 0;
      const killed = s.hp <= 0;
      if (killed) { s.hp = 0; s.dead = true; s.sinkTime = 0; s.v = s.vx = s.vy = 0; s.targetId = null; s.aimYaw = null; s.salvoRemaining = 0; }
      if (opts.byPlayer) activeIntervention = true;
      return { hit: true, ship: s, id: s.id, damage: applied, hp: s.hp, dead: s.dead, killed };
    }
    function distanceToShip(s, point) {
      const p = local(s, point);
      let d = Infinity;
      for (const box of boxes.get(s.id)) d = Math.min(d, Math.hypot(...p.map((v, i) => Math.max(box.min[i] - v, 0, v - box.max[i]))));
      return d;
    }
    function deckAt(id, x, y, radius = 0) {
      const s=byId.get(id);if(!s||s.kind!=='carrier'||s.dead||![x,y,radius].every(finite)||radius<0)return null;
      const p=local(s,{x,y,h:sea+s.deck});let inside=false;
      for(let i=0,j=CARRIER_DECK.length-1;i<CARRIER_DECK.length;j=i++){
        const a=CARRIER_DECK[j],b=CARRIER_DECK[i],dx=b[0]-a[0],dy=b[1]-a[1];
        if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
        const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy),0,1);
        if(Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)<radius)return null;
      }
      return inside?{x,y,height:sea+s.deck,shipId:s.id}:null;
    }
    function deckBlocked(id, x, y, height, bodyHeight=1.8, radius=.42) {
      const s=byId.get(id);if(!s||!deckAt(id,x,y,radius))return true;
      const p=local(s,{x,y,h:height});
      for(const box of boxes.get(id)){
        if(box.part==='hull'||box.part==='deck'||p[2]>=box.max[2]-.04||p[2]+bodyHeight<=box.min[2]+.04)continue;
        const dx=Math.max(box.min[0]-p[0],0,p[0]-box.max[0]),dy=Math.max(box.min[1]-p[1],0,p[1]-box.max[1]);
        if(Math.hypot(dx,dy)<radius)return true;
      }
      return false;
    }
    function bodyBlocked(x, y, height, bodyHeight, radius=0) {
      if (![x,y,height,bodyHeight,radius].every(finite) || bodyHeight<=0 || radius<0) return null;
      for (const s of ships) {
        const envelope=traceBounds.get(s.id),sink=s.dead?Math.min(60,s.sinkTime*.8):0;
        if (s.dead&&s.sinkTime>=45 || Math.abs(x-s.x)>envelope.radius+radius || Math.abs(y-s.y)>envelope.radius+radius ||
            height>=sea+envelope.maxH-sink || height+bodyHeight<=sea+envelope.minH-sink) continue;
        const p=local(s,{x,y,h:height});
        for (const box of boxes.get(s.id)) {
          // The rendered carrier deck's upper surface is exactly deck metres.
          // Projectile hitboxes include a small skin above it; bodies resting
          // on the deck must not collide with that projectile-only padding.
          const top=box.part==='deck'?s.deck:box.max[2];
          if (p[2]>=top-.015 || p[2]+bodyHeight<=box.min[2]+.015) continue;
          const dx=Math.max(box.min[0]-p[0],0,p[0]-box.max[0]),dy=Math.max(box.min[1]-p[1],0,p[1]-box.max[1]);
          if (dx*dx+dy*dy<=radius*radius) return {kind:'easternNavalHull',nfShipId:s.id,part:box.part};
        }
      }
      return null;
    }
    function blast(x, y, h, radius, amount, opts = {}) {
      if (![x, y, h, radius, amount].every(finite) || radius <= 0 || amount <= 0) return [];
      opts = opts || {};
      const result = [], point = { x, y, h };
      for (const s of ships) {
        if (!eligible(s, opts, true)) continue;
        const d = distanceToShip(s, point);
        if (d >= radius) continue;
        const hit = damage(s.id, amount * Math.pow(1 - d / radius, .8), opts);
        if (hit.hit) result.push({ ...hit, distance: d });
      }
      return result;
    }

    function clampPosition(s, x, y) {
      const r = Math.hypot(s.L, s.W) * .5 + 8;
      return { x: number(x, s.home.x, MIN_SHIP_X, bounds.maxX - r), y: number(y, s.home.y, bounds.minY + r, bounds.maxY - r) };
    }
    function sanitize(s) {
      const p = profiles.get(s.id), pos = clampPosition(s, s.x, s.y);
      s.x = pos.x; s.y = pos.y; s.a = angle(number(s.a, s.home.a));
      s.hp = number(s.hp, p.hp, 0, p.hp); s.maxHp = p.hp;
      s.ammo = Math.floor(number(s.ammo, 0, 0, p.ammo)); s.maxAmmo = p.ammo;
      s.cooldown = number(s.cooldown, 0, 0, 60); s.sinkTime = number(s.sinkTime, 0, 0, 1e9);
      s.dead = !!s.dead || s.hp <= 0; if (s.dead) s.hp = 0;
      s.v = number(s.v, 0, s.playerOwned?-6:0, s.playerOwned?30:p.cruise * 1.3); s.h = sea;
      s.quietTime = number(s.quietTime, 0, 0, 1e6);
      s.resupplyTime = number(s.resupplyTime, 0, 0, p.rearm);
      s.salvoRemaining = Math.floor(number(s.salvoRemaining, 0, 0, p.salvo));
      s.thinkTime = number(s.thinkTime, 0, 0, 1); s.lastHit = number(s.lastHit, -1e6, -1e6, clock);
    }
    function overlap(a, x, y, b) {
      const ca = Math.cos(a.a), sa = Math.sin(a.a), cb = Math.cos(b.a), sb = Math.sin(b.a);
      const A = [[ca, sa], [-sa, ca]], B = [[cb, sb], [-sb, cb]], dx = b.x - x, dy = b.y - y;
      const ar = [a.L * .5 + 4, a.W * .5 + 4], br = [b.L * .5 + 4, b.W * .5 + 4];
      for (const axis of A.concat(B)) {
        const center = Math.abs(dx * axis[0] + dy * axis[1]);
        const ra = ar[0] * Math.abs(A[0][0] * axis[0] + A[0][1] * axis[1]) + ar[1] * Math.abs(A[1][0] * axis[0] + A[1][1] * axis[1]);
        const rb = br[0] * Math.abs(B[0][0] * axis[0] + B[0][1] * axis[1]) + br[1] * Math.abs(B[1][0] * axis[0] + B[1][1] * axis[1]);
        if (center >= ra + rb) return false;
      }
      return true;
    }
    function move(s, dt, target, blockedMove) {
      const p = profiles.get(s.id);
      if (!p.cruise) { s.v = s.vx = s.vy = 0; return; }
      const previousAngle = s.a;
      const phase = clock / (s.kind === 'destroyer' ? 85 : 57) + s.index * 1.71;
      let goal = { x: s.home.x + Math.cos(phase) * (s.kind === 'destroyer' ? 140 : 175), y: s.home.y + Math.sin(phase) * 100 };
      if (target && distance(s, target) > p.range * .65) {
        const dx = target.x - s.home.x, dy = target.y - s.home.y, d = Math.hypot(dx, dy) || 1;
        goal = { x: s.home.x + dx / d * Math.min(300, d), y: s.home.y + dy / d * Math.min(300, d) };
      }
      goal = clampPosition(s, goal.x, goal.y);
      const wanted = Math.atan2(goal.y - s.y, goal.x - s.x), turn = clamp(angle(wanted - s.a) * 1.3, -p.turn, p.turn);
      s.a = angle(s.a + turn * dt);
      const desired = distance(s, goal) < 12 ? 1.5 : p.cruise;
      s.v += (desired - s.v) * Math.min(1, dt * .5);
      const next = clampPosition(s, s.x + Math.cos(s.a) * s.v * dt, s.y + Math.sin(s.a) * s.v * dt);
      const blocked = ships.some(other => other !== s && (!other.dead || other.sinkTime < 25) && distance(s, other) < (s.L + other.L) * .65 + 50 && overlap(s, next.x, next.y, other));
      // The host owns shoreline/pier geometry. Reject its swept candidate
      // before committing any translation, just as for fleet hull overlap.
      const externalBlocked = typeof blockedMove === 'function' && !!blockedMove(s, next.x, next.y);
      if (blocked || externalBlocked) {
        // Start from the previous heading so steering towards the obstacle
        // cannot cancel out the avoidance turn on every blocked frame.
        s.a = angle(previousAngle + (s.index % 2 ? 1 : -1) * p.turn * dt);
        s.v = externalBlocked ? 0 : s.v * Math.max(0, 1 - dt * 2); s.vx = s.vy = 0; return;
      }
      s.vx = (next.x - s.x) / dt; s.vy = (next.y - s.y) / dt; s.x = next.x; s.y = next.y;
    }
    function targetPoint(s) {
      return { id: s.id, shipId: s.id, faction: teamOf(s), x: s.x, y: s.y,
        h: sea + (s.kind === 'carrier' ? s.deck * .7 : Math.max(1, s.deck * .65)),
        vx: s.vx || 0, vy: s.vy || 0, isPlayer: false };
    }
    function playerTarget(player, controlledId) {
      if (!validPlayer(player)) return null;
      const craft = player.craft;
      if (!(player.ship || player.isShip || player.kind === 'ship' || craft?.kind === 'ship' || controlledId)) return null;
      const faction = player.faction === 'enemy' ? 'enemy' : 'ally';
      return { id: controlledId || 'eastern-naval-player', shipId: controlledId || null, faction,
        x: player.x, y: player.y, h: number(player.h, sea + 2, sea - 2, sea + 40),
        vx: number(player.vx, 0, -80, 80), vy: number(player.vy, 0, -80, 80), isPlayer: true };
    }
    function chooseTarget(s, player, controlledId) {
      if (!validPlayer(player) || distance(s, player) > ACTIVATE_RANGE) return null;
      const p = profiles.get(s.id), human = playerTarget(player, controlledId);
      let chosen = null, best = Infinity;
      for (const other of ships) {
        if (other.dead || other === s || other.id === controlledId || teamOf(other) === teamOf(s)) continue;
        const d = distance(s, other);
        if (d < p.range && d < best) { best = d; chosen = targetPoint(other); }
      }
      if (human && human.faction !== teamOf(s)) {
        const d = distance(s, human);
        if (d < p.range && d * .85 < best) chosen = human;
      }
      return chosen;
    }
    function resolveTarget(s, player, controlledId) {
      if (!s.targetId || !validPlayer(player) || distance(s, player) > ACTIVATE_RANGE) return null;
      const human = playerTarget(player, controlledId);
      let target = human && human.id === s.targetId ? human : null;
      if (!target) { const other = byId.get(s.targetId); if (other && !other.dead) target = targetPoint(other); }
      return target && target.faction !== teamOf(s) && distance(s, target) < profiles.get(s.id).range ? target : null;
    }
    function rearm(s, dt, target) {
      const p = profiles.get(s.id);
      if (s.ammo >= p.ammo) { s.resupplyTime = 0; return; }
      const carrier = ships.find(other => other.kind === 'carrier' && teamOf(other) === teamOf(s) && !other.dead);
      const supplied = carrier && distance(s, carrier) <= 500;
      if (!(s.quietTime >= 20 && clock - s.lastHit >= 20) && !supplied) return;
      // Logistics is slower than fire expenditure; combat ammunition still
      // matters while quiet/offscreen ships eventually become useful again.
      s.resupplyTime += dt * (target ? .5 : 1);
      while (s.resupplyTime >= p.rearm && s.ammo < p.ammo) { s.resupplyTime -= p.rearm; s.ammo++; }
    }
    function fire(s, target, dt, onFire, shots) {
      const p = profiles.get(s.id);
      if (!target) { s.aimYaw = null; return; }
      const salvoIndex = s.salvoRemaining ? p.salvo - s.salvoRemaining : 0;
      const travel = clamp(distance(s, target) / p.speed, 0, 5);
      const phase = s.index * 1.37 + s.ammo * 2.399963;
      const spread = s.kind === 'carrier' ? 4 : s.kind === 'destroyer' ? 5 : 3;
      const to = { x: target.x + target.vx * travel + Math.cos(phase) * spread,
        y: target.y + target.vy * travel + Math.sin(phase) * spread, h: target.h };
      const pivot = gunPivot(s), aimYaw = Math.atan2(to.y - pivot.y, to.x - pivot.x);
      s.aimYaw = aimYaw;
      if (s.cooldown > 0 || s.ammo <= 0) return;
      const from = muzzlePoint(s, aimYaw, salvoIndex);
      const blocking = trace(from, { x: target.x, y: target.y, h: target.h }, { excludeId: s.id, includeAllies: true });
      if (blocking && teamOf(blocking.ship) === teamOf(s)) { s.cooldown = .6; return; }
      if (!s.salvoRemaining) s.salvoRemaining = Math.min(p.salvo, s.ammo);
      s.ammo--; s.salvoRemaining--;
      s.quietTime = 0;
      s.cooldown = s.salvoRemaining > 0 ? p.salvoDelay : p.interval;
      const event = { ship: s, sourceShipId: s.id, faction: teamOf(s), target: { ...target }, kind: p.shot,
        from, to, aimYaw, damage: p.damage, speed: p.speed, radius: p.radius,
        life: Math.min(30, Math.max(8, distance(s, target) / p.speed + 8)), salvoIndex };
      shots.push(event); if (typeof onFire === 'function') onFire(event);
    }
    function respawn(s) {
      const p = profiles.get(s.id), at = clampPosition(s, s.home.x, s.home.y);
      s.x = at.x; s.y = at.y; s.a = s.home.a; s.hp = p.hp; s.dead = false; s.sinkTime = 0;
      s.ammo = p.ammo; s.cooldown = 1 + s.index * .12; s.v = s.vx = s.vy = 0;
      s.targetId = null; s.aimYaw = null; s.salvoRemaining = 0; s.quietTime = s.resupplyTime = s.thinkTime = 0;
      s.lastHit = -1e6; s.respawnEpoch = Math.min(1e9, s.respawnEpoch + 1);
    }
    function tick(dt, context = {}) {
      const result = { shots: [], respawned: [] };
      if (!finite(dt) || dt <= 0) return result;
      context = context || {};
      const controlledId = typeof context.controlledShipId === 'string' ? context.controlledShipId : null;
      const moored = new Set(Array.isArray(context.mooredShipIds) ? context.mooredShipIds : []);
      const player = context.player;
      lastControlledId = controlledId;
      // A tab resumed after a long pause cannot integrate hours in one frame.
      // The host remains responsible for pausing its gameplay simulation.
      let left = Math.min(dt, 60);
      while (left > EPS) {
        const step = Math.min(left, .25); left -= step; clock = Math.min(1e12, clock + step);
        for (const s of ships) {
          s.controlled = s.id === controlledId;
          if (s.controlled) continue;
          sanitize(s);
          if (s.dead) {
            s.sinkTime += step;
            const delay = teamOf(s) === 'ally' ? 180 : 240;
            const clear = !validPlayer(player) || (distance(player, s) > RESPAWN_CLEARANCE && distance(player, s.home) > RESPAWN_CLEARANCE);
            if (s.sinkTime >= delay && clear) { respawn(s); result.respawned.push(s.id); }
            continue;
          }
          // A commandeered hull stays where its driver leaves it. A temporary
          // service berth also holds the return boat while its rider is on deck.
          if(s.playerOwned||moored.has(s.id)){s.v=s.vx=s.vy=0;continue;}
          s.cooldown = Math.max(0, s.cooldown - step); s.thinkTime -= step;
          if (s.thinkTime <= 0) { const t = chooseTarget(s, player, controlledId); s.targetId = t ? t.id : null; s.thinkTime = .45; }
          const target = resolveTarget(s, player, controlledId);
          // Quiet means no actual shot or damage, not merely no target in
          // sight. An empty magazine must not disable offshore ships forever.
          s.quietTime = Math.min(1e6, s.quietTime + step);
          if (!target) { s.targetId = null; s.salvoRemaining = 0; }
          else activeIntervention = true;
          move(s, step, target, context.blockedMove); rearm(s, step, target); fire(s, target, step, context.onFire, result.shots);
        }
      }
      return result;
    }
    function serialize() {
      return { schema: SCHEMA, version: VERSION, clock, activeIntervention,
        ships: ships.map(s => ({ id: s.id, x: s.x, y: s.y, a: s.a, hp: s.hp, dead: s.dead,
          sinkTime: s.sinkTime, ammo: s.ammo, cooldown: s.cooldown, v: s.v,
          home: { ...s.home }, respawnEpoch: s.respawnEpoch, salvoRemaining: s.salvoRemaining,
          quietTime: s.quietTime, resupplyTime: s.resupplyTime, lastHit: s.lastHit,
          aimYaw:finite(s.aimYaw)?s.aimYaw:null,...(s.playerOwned?{playerOwned:true}:{}) })) };
    }
    function restore(saved) {
      if (!saved || typeof saved !== 'object' || saved.version !== VERSION || (saved.schema && saved.schema !== SCHEMA) || !Array.isArray(saved.ships) || saved.ships.length > 64) return false;
      const records = new Map();
      for (const row of saved.ships) if (row && typeof row.id === 'string' && byId.has(row.id) && !records.has(row.id)) records.set(row.id, row);
      clock = number(saved.clock, 0, 0, 1e12); activeIntervention = saved.activeIntervention === true;
      for (const s of ships) {
        const row = records.get(s.id), p = profiles.get(s.id);
        if (!row) continue;
        const stationary = s.kind === 'carrier';
        if(!stationary&&row.playerOwned===true)s.playerOwned=true;else delete s.playerOwned;
        if (!stationary && row.home && finite(row.home.x) && finite(row.home.y)) {
          const home = clampPosition(s, row.home.x, row.home.y);
          s.home = { ...home, a: angle(number(row.home.a, s.home.a)) };
        }
        const pos = clampPosition(s, row.x, row.y);
        s.x = stationary ? s.home.x : pos.x; s.y = stationary ? s.home.y : pos.y;
        s.a = stationary ? s.home.a : angle(number(row.a, s.home.a));
        s.hp = number(row.hp, p.hp, 0, p.hp); s.dead = row.dead === true || s.hp <= 0; if (s.dead) s.hp = 0;
        s.sinkTime = s.dead ? number(row.sinkTime, 0, 0, 1e9) : 0;
        s.ammo = Math.floor(number(row.ammo, p.ammo, 0, p.ammo));
        s.cooldown = number(row.cooldown, 0, 0, 60); s.v = number(row.v, 0, s.playerOwned?-6:0, s.playerOwned?30:p.cruise * 1.3);
        s.respawnEpoch = Math.floor(number(row.respawnEpoch, 0, 0, 1e9));
        s.salvoRemaining = Math.floor(number(row.salvoRemaining, 0, 0, p.salvo));
        s.quietTime = number(row.quietTime, 0, 0, 1e6); s.resupplyTime = number(row.resupplyTime, 0, 0, p.rearm);
        s.lastHit = number(row.lastHit, -1e6, -1e6, clock);
        s.vx = s.vy = 0; s.targetId = null; s.aimYaw = finite(row.aimYaw)?angle(row.aimYaw):null; s.controlled = false; s.thinkTime = 0;
      }
      lastControlledId = null; restored = true; return true;
    }
    if (options.saved) restore(options.saved);
    return { ships, bounds, seaLevel: sea, contains, ship: id => byId.get(id) || null,
      trace, blast, damage, tick, serialize, restore, worldPoint: world, gunPivot, muzzlePoint, distanceToShip,
      teamOf, command, deckAt, deckBlocked, bodyBlocked,
      get clock() { return clock; }, get restored() { return restored; },
      get activeIntervention() { return activeIntervention; }, get controlledShipId() { return lastControlledId; },
      constants: Object.freeze({ activateRange: ACTIVATE_RANGE, respawnClearance: RESPAWN_CLEARANCE, allyRespawn: 180, enemyRespawn: 240 }) };
  }
  global.HanQEasternNaval = Object.freeze({ schema: SCHEMA, version: VERSION, create, bounds: BOUNDS });
})(typeof window !== 'undefined' ? window : globalThis);
