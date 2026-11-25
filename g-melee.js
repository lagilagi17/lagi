/* HanQ directional melee integration. Authored model-axis swept hits, native actor adapter.
 * Approved combat/input kernels are embedded below; no external runtime requests.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.HanQMelee=api;root.HanqMeleeCore=api.Core;root.HanqMeleeInput=api.Input;}
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION='1.1.0';
  const Core=(function(){const module={exports:{}};
/* HANQ Melee Combat Core — no runtime dependencies.
 * World convention: metres, +Y up, yaw 0 faces +Z.
 * Copyright: generated for the HANQ game project; all combat values are game balance.
 * UMD: window.HanqMeleeCore / require('./melee-core.js').
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HanqMeleeCore = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EPS = 1e-9;
  const TAU = Math.PI * 2;
  const CHARGE = Object.freeze({ maxSeconds: 1.5, maxDamageMultiplier: 2 });
  const validSide = side => side === 'left' || side === 'right' ? side : null;
  const chargeAmount = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
  const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
  const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
  const mul = (a, n) => v(a.x * n, a.y * n, a.z * n);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const lengthSq = a => dot(a, a);
  const length = a => Math.sqrt(lengthSq(a));
  const mix = (a, b, t) => v(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
  const unit = a => mul(a, 1 / Math.max(EPS, length(a)));
  const smooth = t => t * t * (3 - 2 * t);
  const angleDelta = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;

  // The packaged meshes use these authored blade markers. Tests compare them to
  // models/melee-meshes.json; neither the renderer nor hit detection guesses axes.
  let MODEL_AXES = {
    dagger: { bladeBase: [0, 0.14, 0], bladeTip: [0, 0.5, 0] },
    arming_sword: { bladeBase: [0, 0.145, 0], bladeTip: [0, 0.97, 0] },
    longsword: { bladeBase: [0, 0.145, 0], bladeTip: [0, 1.2, 0] },
    katana: { bladeBase: [0, 0.147, 0], bladeTip: [0.068, 1.05, 0] },
    machete: { bladeBase: [0, 0.14, 0], bladeTip: [0.015, 0.74, 0] },
    war_hammer: { bladeBase: [0, 0.12, 0], bladeTip: [0, 0.87, 0] }
  };

  function deepFreeze(o) {
    Object.keys(o).forEach(k => { if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]); });
    return Object.freeze(o);
  }
  deepFreeze(MODEL_AXES);
  function quatMultiply(a, b) {
    return { x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z };
  }
  function rotateVector(p, q) {
    const u = v(q.x, q.y, q.z), uv = cross(u, p), uuv = cross(u, uv);
    return add(p, add(mul(uv, 2 * q.w), mul(uuv, 2)));
  }
  function quatFromUnitVectors(from, to) {
    const r = 1 + dot(from, to);
    let q;
    if (r < Number.EPSILON) q = Math.abs(from.x) > Math.abs(from.z)
      ? { x: -from.y, y: from.x, z: 0, w: 0 } : { x: 0, y: -from.z, z: from.y, w: 0 };
    else { const axis = cross(from, to); q = { x: axis.x, y: axis.y, z: axis.z, w: r }; }
    const n = Math.hypot(q.x, q.y, q.z, q.w);
    return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
  }
  /** Shared exact model transform; renderer and shaped colliders call this helper. */
  function modelTransform(blade, definition, yaw) {
    const baseArray = definition.bladeBase, tipArray = definition.bladeTip;
    const base = v(...baseArray), modelAxis = sub(v(...tipArray), base), modelLength = length(modelAxis);
    const worldAxis = sub(blade.tip, blade.base), worldLength = length(worldAxis), axis = unit(modelAxis);
    yaw = yaw || 0;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const localDirection = unit(v(worldAxis.x * cs - worldAxis.z * sn, worldAxis.y, worldAxis.x * sn + worldAxis.z * cs));
    const halfTwist = (Number.isFinite(definition.twist) ? definition.twist : Math.PI * 0.5) * 0.5;
    const align = quatFromUnitVectors(axis, localDirection), sine = Math.sin(halfTwist);
    const twist = { x: axis.x * sine, y: axis.y * sine, z: axis.z * sine, w: Math.cos(halfTwist) };
    const facing = { x: 0, y: Math.sin(yaw * 0.5), z: 0, w: Math.cos(yaw * 0.5) };
    const quaternion = quatMultiply(facing, quatMultiply(align, twist)), scale = worldLength / modelLength;
    const position = sub(blade.base, rotateVector(mul(base, scale), quaternion));
    return { position, quaternion, scale };
  }
  function transformModelPoint(point, transform) {
    const p = Array.isArray(point) ? v(...point) : point;
    return add(transform.position, rotateVector(mul(p, transform.scale), transform.quaternion));
  }

  function profile(shape, damage, stamina, windup, active, recovery, arc, extra) {
    return Object.assign({ shape, damage, stamina, windup, active, recovery, arc,
      guardDamage: Math.round(damage * 0.72), poiseDamage: damage * 0.5, maxTargets: 2,
      hitstop: 0.045 }, extra || {});
  }

  // The blade balance change raises HP damage only. Construct the original
  // attack first so its guard/poise damage, stamina and timing stay unchanged.
  function bladeProfile(...args) {
    const attack = profile(...args);
    attack.damage = Math.round(attack.damage * 1.5);
    return attack;
  }

  let WEAPONS = deepFreeze({
    fists: {
      id: 'fists', name: '맨손', englishName: 'Bare Hands', unarmed: true, hands: 0,
      // A short capsule around the actual knuckles, never an invisible sword.
      bladeLength: 0.11, armReach: 0.54, reach: 0.65, bladeRadius: 0.075,
      block: 0.55, blockArc: 100, parryWindow: 0.13, poise: 10,
      comboMultipliers: [1, 1, 1.2], cleaveDecay: 1,
      light: profile('punch', 12, 7, 0.11, 0.14, 0.19, 0.12, { maxTargets: 1, guardDamage: 8, poiseDamage: 8, hitstop: 0.025 }),
      heavy: profile('punch', 24, 16, 0.28, 0.18, 0.29, 0.16, { maxTargets: 1, guardDamage: 18, poiseDamage: 19, hitstop: 0.04 })
    },
    dagger: {
      id: 'dagger', name: '단검', englishName: 'Tactical Dagger', hands: 1, bloodEffect: 'blade',
      bladeLength: 0.46, armReach: 0.52, reach: 0.98, bladeRadius: 0.045,
      gripOffset: 0.178889, supportSpacing: 0,
      block: 0.72, blockArc: 100, parryWindow: 0.14, poise: 12,
      comboMultipliers: [1, 0.96, 1.22], cleaveDecay: 0.78,
      light: bladeProfile('thrust', 19, 10, 0.09, 0.14, 0.17, 0.3, { maxTargets: 1, hitstop: 0.025 }),
      heavy: bladeProfile('thrust', 34, 21, 0.23, 0.16, 0.28, 0.12, { maxTargets: 1, guardDamage: 26 })
    },
    arming_sword: {
      id: 'arming_sword', name: '장검', englishName: 'Arming Sword', hands: 1, bloodEffect: 'blade',
      bladeLength: 0.88, armReach: 0.52, reach: 1.40, bladeRadius: 0.055,
      gripOffset: 0.154667, supportSpacing: 0,
      block: 0.9, blockArc: 140, parryWindow: 0.17, poise: 25,
      comboMultipliers: [1, 1.05, 1.25], cleaveDecay: 0.84,
      light: bladeProfile('slash', 30, 16, 0.16, 0.23, 0.27, 1.92),
      heavy: bladeProfile('thrust', 51, 29, 0.29, 0.2, 0.4, 0.14, { maxTargets: 1, guardDamage: 43 })
    },
    longsword: {
      id: 'longsword', name: '롱소드', englishName: 'Two-handed Longsword', hands: 2, bloodEffect: 'blade',
      bladeLength: 1.23, armReach: 0.55, reach: 1.78, bladeRadius: 0.06,
      gripOffset: 0.169052, supportSpacing: 0.198199,
      block: 0.93, blockArc: 150, parryWindow: 0.15, poise: 43,
      comboMultipliers: [1, 1.08, 1.3], cleaveDecay: 0.9,
      light: bladeProfile('slash', 42, 23, 0.25, 0.28, 0.4, 2.15, { maxTargets: 3, hitstop: 0.06 }),
      heavy: bladeProfile('overhead', 72, 41, 0.47, 0.25, 0.56, 0.5, { maxTargets: 2, guardDamage: 64, poiseDamage: 60, hitstop: 0.08 })
    },
    katana: {
      id: 'katana', name: '일본도', englishName: 'Katana', hands: 2, bloodEffect: 'blade',
      bladeLength: 1.02, armReach: 0.54, reach: 1.56, bladeRadius: 0.05,
      gripOffset: 0.165111, supportSpacing: 0.146017,
      block: 0.85, blockArc: 125, parryWindow: 0.18, poise: 22,
      comboMultipliers: [1, 1.02, 1.35], cleaveDecay: 0.85,
      light: bladeProfile('diagonal', 32, 17, 0.12, 0.2, 0.29, 1.95),
      heavy: bladeProfile('diagonal', 55, 32, 0.31, 0.18, 0.47, 1.75, { guardDamage: 44, hitstop: 0.065 })
    },
    machete: {
      id: 'machete', name: '마체테', englishName: 'Field Machete', hands: 1, bloodEffect: 'blade',
      bladeLength: 0.67, armReach: 0.52, reach: 1.19, bladeRadius: 0.07,
      gripOffset: 0.156236, supportSpacing: 0,
      block: 0.8, blockArc: 115, parryWindow: 0.15, poise: 23,
      comboMultipliers: [1, 1.08, 1.25], cleaveDecay: 0.8,
      light: bladeProfile('slash', 28, 14, 0.15, 0.22, 0.25, 2.0),
      heavy: bladeProfile('overhead', 47, 27, 0.3, 0.23, 0.37, 0.4, { guardDamage: 41, poiseDamage: 37 })
    },
    war_hammer: {
      id: 'war_hammer', name: '전투망치', englishName: 'War Hammer', hands: 2,
      bladeLength: 1.04, armReach: 0.52, reach: 1.56, bladeRadius: 0.14,
      gripOffset: 0.1664, supportSpacing: 0.110933,
      headCollider: { base: [-0.16, 0.8, 0], tip: [0.20, 0.8, 0], radius: 0.065 },
      hitZone: [0.78, 1], block: 0.91, blockArc: 135, parryWindow: 0.12, poise: 60,
      comboMultipliers: [1, 1.12, 1.3], cleaveDecay: 0.78,
      light: profile('diagonal', 47, 27, 0.3, 0.23, 0.48, 1.6, { guardDamage: 50, poiseDamage: 49, hitstop: 0.08 }),
      heavy: profile('overhead', 82, 45, 0.55, 0.26, 0.65, 0.3, { maxTargets: 1, guardDamage: 91, poiseDamage: 85, hitstop: 0.1 })
    }
  });

  /** Install an authored set atomically; existing definitions remain immutable.
   * Modules register before the native game copies its weapon table. Live getters
   * also let independent tools inspect additions without stale table references.
   */
  function registerWeapons(definitions, axes) {
    if (!definitions || typeof definitions !== 'object' || !axes || typeof axes !== 'object')
      throw new TypeError('Melee definitions and model axes are required');
    const nextWeapons = {}, nextAxes = {};
    const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
    const shapes = new Set(['punch', 'thrust', 'slash', 'diagonal', 'overhead']);
    for (const [id, source] of Object.entries(definitions)) {
      if (!/^[a-z][a-z0-9_]*$/.test(id) || !source || source.id !== id || !axes[id])
        throw new TypeError('Invalid melee registration: ' + id);
      const w = JSON.parse(JSON.stringify(source)), a = JSON.parse(JSON.stringify(axes[id]));
      const positive = ['bladeLength', 'reach', 'bladeRadius', 'blockArc'];
      if (typeof w.name !== 'string' || ![1, 2].includes(w.hands) ||
          positive.some(key => !Number.isFinite(w[key]) || w[key] <= 0) ||
          !Number.isFinite(w.armReach) || w.armReach < 0 || !Number.isFinite(w.block) || w.block < 0 || w.block > 1 ||
          !Number.isFinite(w.parryWindow) || w.parryWindow < 0 || !Number.isFinite(w.poise) || w.poise < 0 ||
          !Array.isArray(w.comboMultipliers) || !w.comboMultipliers.length || w.comboMultipliers.some(n => !Number.isFinite(n) || n <= 0) ||
          !Number.isFinite(w.cleaveDecay) || w.cleaveDecay <= 0 || w.cleaveDecay > 1 ||
          !vector(a.bladeBase) || !vector(a.bladeTip) || Math.hypot(...a.bladeTip.map((n, i) => n - a.bladeBase[i])) < 1e-6)
        throw new TypeError('Invalid melee geometry or defense: ' + id);
      for (const key of ['gripOffset', 'supportSpacing']) if (w[key] != null && !Number.isFinite(w[key]))
        throw new TypeError('Invalid melee grip: ' + id);
      if (a.twist != null && !Number.isFinite(a.twist)) throw new TypeError('Invalid melee twist: ' + id);
      if (w.hitZone && (!Array.isArray(w.hitZone) || w.hitZone.length !== 2 || w.hitZone.some(n => !Number.isFinite(n)) || w.hitZone[0] < 0 || w.hitZone[1] > 1 || w.hitZone[1] <= w.hitZone[0]))
        throw new TypeError('Invalid melee hit zone: ' + id);
      if (w.headCollider && (!vector(w.headCollider.base) || !vector(w.headCollider.tip) || !Number.isFinite(w.headCollider.radius) || w.headCollider.radius <= 0))
        throw new TypeError('Invalid melee head: ' + id);
      for (const key of ['light', 'heavy']) {
        const p = w[key];
        if (!p || !shapes.has(p.shape) || ['damage', 'stamina', 'windup', 'active', 'recovery', 'arc', 'guardDamage', 'poiseDamage', 'hitstop'].some(k => !Number.isFinite(p[k]) || p[k] < 0) ||
            p.active <= 0 || !Number.isInteger(p.maxTargets) || p.maxTargets < 1)
          throw new TypeError('Invalid melee attack: ' + id + ':' + key);
      }
      if (Object.prototype.hasOwnProperty.call(WEAPONS, id)) {
        if (JSON.stringify(WEAPONS[id]) === JSON.stringify(w) && JSON.stringify(MODEL_AXES[id]) === JSON.stringify(a)) continue;
        throw new RangeError('Melee weapon already registered: ' + id);
      }
      nextWeapons[id] = deepFreeze(w); nextAxes[id] = deepFreeze(a);
    }
    if (Object.keys(nextWeapons).length) {
      WEAPONS = Object.freeze(Object.assign({}, WEAPONS, nextWeapons));
      MODEL_AXES = Object.freeze(Object.assign({}, MODEL_AXES, nextAxes));
    }
    return WEAPONS;
  }

  /** Convert the attacker's anatomical starting side into the defender's frame.
   * Both yaw values use the core convention (+Z forward). A perpendicular side
   * has no left/right projection; callers can show no directional cue then.
   */
  function incomingSideForAttack(side, attackerYaw, defenderYaw) {
    if (!validSide(side) || !Number.isFinite(attackerYaw) || !Number.isFinite(defenderYaw)) return null;
    const projection = (side === 'right' ? -1 : 1) * Math.cos(attackerYaw - defenderYaw);
    return Math.abs(projection) <= 1e-6 ? null : projection < 0 ? 'right' : 'left';
  }

  function getWeapon(weapon) {
    if (weapon == null || weapon === '') return WEAPONS.fists;
    if (typeof weapon === 'object' && weapon && weapon.id) return weapon;
    if (!Object.prototype.hasOwnProperty.call(WEAPONS, weapon)) throw new RangeError('Unknown melee weapon: ' + weapon);
    return WEAPONS[weapon];
  }
  function totalDuration(profile) { return profile.windup + profile.active + profile.recovery; }
  const isOneHandCombo = weapon => weapon.hands === 1 && (weapon.light.shape === 'slash' || weapon.light.shape === 'diagonal');
  function comboLength(weapon) { return isOneHandCombo(weapon) ? 4 : weapon.unarmed ? 2 : weapon.comboMultipliers.length; }
  // An accepted input reserves exactly one follow-up. The boundary remains on
  // the current strike while the native focus adapter temporarily owns its queue.
  function comboTransitionTime(state, queued) {
    if (!state || !state.profile) return 0;
    if (Number.isFinite(state.chainEnd)) return state.chainEnd;
    const p = state.profile;
    return state.autoCombo && !state.finisher && queued && queued.autoCombo
      ? Math.min(totalDuration(p), Math.max(p.windup + p.active + p.recovery * 0.32, state.elapsed + 0.012)) : totalDuration(p);
  }
  function comboProfile(weapon, index) {
    const p = weapon.light;
    if (!isOneHandCombo(weapon) || index !== 3) return p;
    // This is HANQ balance, not a claimed damage multiplier from Zelda.
    return Object.assign({}, p, { shape: 'slash', damage: p.damage * 1.35,
      stamina: Math.ceil(p.stamina * 1.25), windup: p.windup * 1.15,
      active: p.active * 1.1, recovery: p.recovery * 1.35, arc: Math.min(2.65, p.arc * 1.22),
      guardDamage: p.guardDamage * 1.4, poiseDamage: Math.max(50, p.poiseDamage * 2.1),
      hitstop: Math.max(0.07, p.hitstop) });
  }
  function attackProfile(weapon, kind, amount) {
    amount = chargeAmount(amount);
    if (!amount) return weapon[kind === 'heavy' ? 'heavy' : 'light'];
    const low = weapon.light, high = weapon.heavy;
    return Object.assign({}, high, {
      damage: lerp(low.damage, low.damage * CHARGE.maxDamageMultiplier, amount),
      stamina: lerp(low.stamina, high.stamina, amount),
      guardDamage: lerp(low.guardDamage, high.guardDamage, amount),
      poiseDamage: lerp(low.poiseDamage, high.poiseDamage, amount)
    });
  }
  function clonePose(pose) {
    const p = pose && (pose.position || pose);
    return { position: v(p && +p.x || 0, p && +p.y || 0, p && +p.z || 0), yaw: pose && +pose.yaw || 0 };
  }
  function lerpPose(a, b, t) {
    return { position: mix(a.position, b.position, t), yaw: a.yaw + angleDelta(a.yaw, b.yaw) * t };
  }
  function localToWorld(p, pose) {
    const s = Math.sin(pose.yaw), c = Math.cos(pose.yaw);
    return v(pose.position.x + p.x * c + p.z * s, pose.position.y + p.y, pose.position.z - p.x * s + p.z * c);
  }
  function worldToLocal(p, pose) {
    const q = sub(p, pose.position), s = Math.sin(pose.yaw), c = Math.cos(pose.yaw);
    return v(q.x * c - q.z * s, q.y, q.x * s + q.z * c);
  }
  // Original HANQ rig: +X forward, +Z right, two arm bones totaling .59 m.
  // In this core's +Z-facing convention its right shoulder is at X=-.2.
  // Constrain the shared physical hilt, rather than stretching arms or scaling weapons.
  // The .54 m radius leaves room for the source rig's torso bob and curved-blade offsets.
  function torsoYawForBlade(extra) {
    if (!extra) return 0;
    if (Number.isFinite(extra.torsoYaw)) return extra.torsoYaw;
    if (extra.autoCombo) return clamp((extra.angle || 0) * (extra.finisher ? 0.27 : 0.18),
      extra.finisher ? -0.34 : -0.22, extra.finisher ? 0.34 : 0.22);
    return extra.active ? clamp((extra.angle || 0) * 0.18, -0.22, 0.22) : 0;
  }
  function reachableBase(base, direction, weapon, extra) {
    const torsoYaw = torsoYawForBlade(extra);
    const cs = Math.cos(torsoYaw), sn = Math.sin(torsoYaw), radius = 0.54;
    const right = add(v(-0.2 * cs, 1.405, 0.2 * sn), mul(direction, weapon.gripOffset ?? 0.16));
    const centers = [right];
    if (weapon.hands === 2 && !weapon.dualWield) centers.push(add(v(0.2 * cs, 1.405, -0.2 * sn),
      mul(direction, (weapon.gripOffset ?? 0.16) + (weapon.supportSpacing ?? 0.15))));
    let result = v(base.x, base.y, base.z);
    for (let pass = 0; pass < 16; pass++) {
      let changed = false;
      for (const center of centers) {
        const delta = sub(result, center), distance = length(delta);
        if (distance > radius + 1e-7) { result = add(center, mul(delta, radius / distance)); changed = true; }
      }
      if (!changed) break;
    }
    return result;
  }
  function makeBlade(base, tip, weapon, pose, extra) {
    const direction = unit(sub(tip, base));
    base = reachableBase(base, direction, weapon, extra);
    tip = add(base, mul(direction, weapon.bladeLength));
    const worldBase = localToWorld(base, pose), worldTip = localToWorld(tip, pose);
    const zone = weapon.hitZone || [0, 1];
    const blade = Object.assign({ base: worldBase, tip: worldTip,
      collisionBase: mix(worldBase, worldTip, zone[0]), collisionTip: mix(worldBase, worldTip, zone[1]),
      localBase: base, localTip: tip, radius: weapon.bladeRadius,
      length: weapon.bladeLength, torsoYaw: torsoYawForBlade(extra) }, extra || {});
    if (weapon.headCollider) {
      const transform = modelTransform(blade, MODEL_AXES[weapon.id], pose.yaw);
      blade.collisionBase = transformModelPoint(weapon.headCollider.base, transform);
      blade.collisionTip = transformModelPoint(weapon.headCollider.tip, transform);
      blade.radius = weapon.headCollider.radius * transform.scale;
    }
    return blade;
  }
  function reachableHand(hand, side) {
    const shoulder = v(side === 'right' ? -0.2 : 0.2, 1.405, 0), delta = sub(hand, shoulder), d = length(delta);
    return d > 0.54 ? add(shoulder, mul(delta, 0.54 / d)) : hand;
  }
  /** Bare-hand visual/physical contract. Targets are palm positions in world
   * and actor-local coordinates; only the selected hand's knuckles hit.
   * No weapon mesh or authored blade marker exists for this combat mode. */
  function makeFists(right, left, weapon, pose, side, extra) {
    side = validSide(side) || 'right';
    right = reachableHand(right, 'right'); left = reachableHand(left, 'left');
    const hand = side === 'right' ? right : left;
    const base = add(hand, v(0, 0, -0.045)), tip = add(hand, v(0, 0, 0.065));
    const worldBase = localToWorld(base, pose), worldTip = localToWorld(tip, pose);
    return Object.assign({ base: worldBase, tip: worldTip, collisionBase: worldBase, collisionTip: worldTip,
      localBase: base, localTip: tip, length: weapon.bladeLength, radius: weapon.bladeRadius,
      unarmed: true, side, angle: 0, torsoYaw: 0, handTargets: { right: localToWorld(right, pose), left: localToWorld(left, pose) },
      localHandTargets: { right, left } }, extra || {});
  }
  function idleBlade(weapon, pose, guarding, side) {
    if (weapon.unarmed) {
      const right = v(-0.23, 1.38, 0.27), left = v(0.23, 1.44, 0.28);
      if (guarding) {
        const lead = side === 'left' ? left : right, rear = side === 'left' ? right : left;
        lead.y = 1.54; lead.z = 0.34; rear.y = 1.42; rear.z = 0.20;
      }
      return makeFists(right, left, weapon, pose, side,
        { phase: guarding ? 'guard' : 'idle', progress: 0, active: false });
    }
    const directional = guarding && validSide(side), sign = side === 'left' ? 1 : -1;
    const base = directional ? v(sign * 0.18, 1.36, 0.38) : guarding ? v(-0.06, 1.36, 0.38) : weapon.hands === 2 ? v(-0.08, 1.32, 0.30) : v(-0.22, 1.22, 0.30);
    const dir = unit(directional ? v(sign * 0.72, 0.64, 0.12) : guarding ? v(-0.72, 0.64, 0.12) : v(-0.30, 0.80, 0.40));
    return makeBlade(base, add(base, mul(dir, weapon.bladeLength)), weapon, pose,
      { phase: guarding ? 'guard' : 'idle', progress: 0, active: false, angle: 0, side: directional || null });
  }

  /** The renderer and collision system share this exact sampler.
   * sampleBlade(weaponId, 'light'|'heavy', secondsSinceAttack, actorPose, zeroBasedCombo, {side,charge}?)
   * Right/left name the actor's anatomical starting side; explicit sides override
   * the default alternating combo. +X local is the actor's left, +Z is forward.
   */
  function sampleBlade(weaponId, kind, elapsed, actorPose, combo, options) {
    const weapon = getWeapon(weaponId), pose = clonePose(actorPose);
    options = options || {};
    const side = validSide(options.side), charge = chargeAmount(options.charge);
    kind = charge > 0 || kind === 'heavy' ? 'heavy' : 'light';
    const attack = options.profile || attackProfile(weapon, kind, charge);
    const duration = totalDuration(attack), t = clamp(elapsed, 0, duration);
    const activeProgress = clamp((t - attack.windup) / attack.active, 0, 1);
    const windupProgress = clamp(t / attack.windup, 0, 1);
    const recoverProgress = clamp((t - attack.windup - attack.active) / attack.recovery, 0, 1);
    const phase = t < attack.windup ? 'windup' : t < attack.windup + attack.active ? 'active' : 'recovery';
    const reverse = side ? side === 'right' ? 1 : -1 : (combo || 0) % 2 ? -1 : 1;
    if (weapon.unarmed) {
      const punchSide = side || (reverse > 0 ? 'right' : 'left'), sign = punchSide === 'right' ? -1 : 1;
      const ready = v(sign * 0.23, 1.40, 0.27), drawn = v(sign * 0.27, 1.34, kind === 'heavy' ? 0.11 : 0.16);
      const extended = v(sign * 0.13, 1.40, 0.54);
      const lead = phase === 'windup' ? mix(ready, drawn, smooth(windupProgress))
        : phase === 'active' ? mix(drawn, extended, smooth(Math.min(1, activeProgress * 1.7)))
          : mix(extended, ready, smooth(recoverProgress));
      const rear = v(-sign * 0.23, 1.48, 0.22);
      const blade = makeFists(punchSide === 'right' ? lead : rear, punchSide === 'left' ? lead : rear,
        weapon, pose, punchSide, { phase, progress: t / duration, activeProgress, active: phase === 'active', charge,
          autoCombo: !!options.autoCombo, finisher: !!options.finisher });
      return finishComboPose(blendComboEntry(blade, options.entryPose, windupProgress, weapon, pose), recoverProgress, weapon, pose);
    }
    let base, dir, angle = 0;
    if (attack.shape === 'thrust') {
      const extension = phase === 'windup' ? -0.17 * smooth(windupProgress)
        : phase === 'active' ? -0.17 + 0.17 * Math.sin(Math.PI * activeProgress)
          : -0.17 * (1 - smooth(recoverProgress));
      base = v((side ? -0.13 : 0.08) * reverse, 1.12, weapon.armReach + extension);
      dir = unit(v((side ? -0.09 : -0.035) * reverse, kind === 'heavy' ? 0.035 : 0, 1));
    } else if (attack.shape === 'overhead') {
      const elevation = phase === 'windup' ? lerp(0.6, 1.28, smooth(windupProgress))
        : phase === 'active' ? lerp(1.28, -0.72, smooth(activeProgress))
          : lerp(-0.72, 0.6, smooth(recoverProgress));
      angle = elevation;
      base = v((side ? -0.12 : 0.06) * reverse, 1.15 + 0.08 * Math.sin(elevation), weapon.armReach);
      dir = unit(v((side ? -0.16 : 0.035) * reverse, Math.sin(elevation), Math.cos(elevation)));
    } else {
      const halfArc = attack.arc / 2;
      angle = (phase === 'windup' ? lerp(-0.42, -halfArc, smooth(windupProgress))
        : phase === 'active' ? lerp(-halfArc, halfArc, smooth(activeProgress))
          : lerp(halfArc, 0.1, smooth(recoverProgress))) * reverse;
      let elevation = 0.06;
      if (attack.shape === 'diagonal') {
        elevation = phase === 'windup' ? lerp(0.15, 0.55, smooth(windupProgress))
          : phase === 'active' ? lerp(0.55, -0.35, smooth(activeProgress))
            : lerp(-0.35, 0.15, smooth(recoverProgress));
        if (reverse < 0 && kind !== 'heavy') elevation = -elevation * 0.7;
      } else if ((combo || 0) === 2) elevation = 0.22 * (1 - 2 * activeProgress);
      base = v(Math.sin(angle) * weapon.armReach, 1.12, Math.cos(angle) * weapon.armReach);
      dir = v(Math.sin(angle) * Math.cos(elevation), Math.sin(elevation), Math.cos(angle) * Math.cos(elevation));
    }
    const blade = makeBlade(base, add(base, mul(dir, weapon.bladeLength)), weapon, pose,
      { phase, progress: t / duration, activeProgress, active: phase === 'active', angle, side: side || (reverse > 0 ? 'right' : 'left'), charge,
        autoCombo: !!options.autoCombo, finisher: !!options.finisher });
    return finishComboPose(blendComboEntry(blade, options.entryPose, windupProgress, weapon, pose), recoverProgress, weapon, pose);
  }

  function comboEntryPose(blade) {
    return { base: blade.localBase, tip: blade.localTip, hands: blade.localHandTargets, angle: blade.angle || 0,
      torsoYaw: blade.torsoYaw || 0, side: blade.side };
  }
  function blendComboEntry(blade, entry, progress, weapon, pose) {
    if (!entry || blade.phase !== 'windup' || progress >= 1) return blade;
    const t = smooth(progress), extra = { phase: blade.phase, progress: blade.progress,
      activeProgress: blade.activeProgress, active: false, angle: lerp(entry.angle, blade.angle || 0, t), side: blade.side, charge: blade.charge,
      autoCombo: blade.autoCombo, finisher: blade.finisher, torsoYaw: lerp(entry.torsoYaw || 0, blade.torsoYaw || 0, t) };
    if (weapon.unarmed && entry.hands) return makeFists(mix(entry.hands.right, blade.localHandTargets.right, t),
      mix(entry.hands.left, blade.localHandTargets.left, t), weapon, pose, blade.side, extra);
    const base = mix(entry.base, blade.localBase, t);
    let direction = mix(unit(sub(entry.tip, entry.base)), unit(sub(blade.localTip, blade.localBase)), t);
    if (lengthSq(direction) < EPS) direction = sub(blade.localTip, blade.localBase);
    return makeBlade(base, add(base, mul(unit(direction), weapon.bladeLength)), weapon, pose, extra);
  }
  function finishComboPose(blade, progress, weapon, pose) {
    if (!blade.autoCombo || blade.phase !== 'recovery') return blade;
    // A completed swing returns to the real idle grip. Early chaining leaves
    // this easing near its start, then blends from that exact pose next windup.
    const t = smooth(progress * progress), rest = idleBlade(weapon, pose, false), result = blendBlades(blade, rest, t, weapon, pose);
    return Object.assign(result, { phase: blade.phase, progress: blade.progress, activeProgress: blade.activeProgress,
      active: false, side: blade.side, charge: blade.charge, autoCombo: true, finisher: blade.finisher,
      angle: lerp(blade.angle || 0, 0, t) });
  }

  /** Robust closest points for finite segments, including zero-length segments. */
  function closestSegmentPoints(p1, q1, p2, q2) {
    const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
    const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
    let s, t;
    if (a <= EPS && e <= EPS) { s = 0; t = 0; }
    else if (a <= EPS) { s = 0; t = clamp(f / e, 0, 1); }
    else {
      const c = dot(d1, r);
      if (e <= EPS) { t = 0; s = clamp(-c / a, 0, 1); }
      else {
        const b = dot(d1, d2), denominator = a * e - b * b;
        s = denominator > EPS ? clamp((b * f - c * e) / denominator, 0, 1) : 0;
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
        else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
      }
    }
    const point1 = add(p1, mul(d1, s)), point2 = add(p2, mul(d2, t));
    return { distanceSq: lengthSq(sub(point1, point2)), point1, point2, s, t };
  }
  function segmentSegmentDistanceSq(p1, q1, p2, q2) { return closestSegmentPoints(p1, q1, p2, q2).distanceSq; }
  function pointTriangleDistanceSq(p, a, b, c) {
    const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
    if (lengthSq(cross(ab, ac)) < EPS) return Math.min(
      segmentSegmentDistanceSq(p, p, a, b), segmentSegmentDistanceSq(p, p, b, c), segmentSegmentDistanceSq(p, p, c, a));
    const d1 = dot(ab, ap), d2 = dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return lengthSq(ap);
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) return lengthSq(bp);
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) return lengthSq(sub(p, add(a, mul(ab, d1 / (d1 - d3)))));
    const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) return lengthSq(cp);
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) return lengthSq(sub(p, add(a, mul(ac, d2 / (d2 - d6)))));
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      const t = (d4 - d3) / ((d4 - d3) + (d5 - d6));
      return lengthSq(sub(p, add(b, mul(sub(c, b), t))));
    }
    const denominator = 1 / (va + vb + vc), u = vb * denominator, w = vc * denominator;
    return lengthSq(sub(p, add(a, add(mul(ab, u), mul(ac, w)))));
  }
  function segmentIntersectsTriangle(p, q, a, b, c) {
    const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < EPS) return false;
    const inv = 1 / det, s = sub(p, a), u = dot(s, h) * inv;
    if (u < -EPS || u > 1 + EPS) return false;
    const r = cross(s, e1), w = dot(d, r) * inv;
    if (w < -EPS || u + w > 1 + EPS) return false;
    const t = dot(e2, r) * inv;
    return t >= -EPS && t <= 1 + EPS;
  }
  function segmentTriangleDistanceSq(p, q, a, b, c) {
    if (segmentIntersectsTriangle(p, q, a, b, c)) return 0;
    return Math.min(pointTriangleDistanceSq(p, a, b, c), pointTriangleDistanceSq(q, a, b, c),
      segmentSegmentDistanceSq(p, q, a, b), segmentSegmentDistanceSq(p, q, b, c), segmentSegmentDistanceSq(p, q, c, a));
  }
  function capsuleForTarget(target) {
    const p = target.position || target, radius = Math.max(0.01, target.radius == null ? 0.3 : target.radius);
    const height = Math.max(radius * 2, target.height == null ? 1.8 : target.height);
    return { bottom: v(p.x, (p.y || 0) + radius, p.z), top: v(p.x, (p.y || 0) + height - radius, p.z), radius };
  }
  function sweptBladeCapsule(previous, current, capsule) {
    const a = previous.collisionBase || previous.base, b = previous.collisionTip || previous.tip;
    const c = current.collisionTip || current.tip, d = current.collisionBase || current.base;
    const distanceSq = Math.min(
      segmentTriangleDistanceSq(capsule.bottom, capsule.top, a, b, c),
      segmentTriangleDistanceSq(capsule.bottom, capsule.top, a, c, d));
    return distanceSq <= Math.pow(capsule.radius + (current.radius || 0), 2) + EPS;
  }

  /** Slab intersection with finite segment. Returns null or {tEnter,tExit,point,normal}. */
  function segmentAABB(a, b, box, padding) {
    padding = padding || 0;
    let enter = 0, exit = 1, normal = v();
    const d = sub(b, a);
    for (const axis of ['x', 'y', 'z']) {
      const lo = box.min[axis] - padding, hi = box.max[axis] + padding;
      if (Math.abs(d[axis]) < EPS) { if (a[axis] < lo || a[axis] > hi) return null; }
      else {
        let t1 = (lo - a[axis]) / d[axis], t2 = (hi - a[axis]) / d[axis], sign = -1;
        if (t1 > t2) { const temp = t1; t1 = t2; t2 = temp; sign = 1; }
        if (t1 > enter) { enter = t1; normal = v(); normal[axis] = sign; }
        exit = Math.min(exit, t2);
        if (enter > exit + EPS) return null;
      }
    }
    return { tEnter: enter, tExit: exit, point: mix(a, b, enter), normal };
  }
  function isOccluded(start, end, obstacles, padding) {
    for (let i = 0; i < obstacles.length; i++) {
      const obstacle = obstacles[i];
      if (obstacle.enabled === false) continue;
      const hit = segmentAABB(start, end, obstacle, padding || 0);
      if (hit && hit.tEnter < 1 - 1e-5) return { obstacle, hit };
    }
    return null;
  }
  function firstWall(previous, current, obstacles, actor) {
    let result = null;
    const pairs = [[current.collisionBase, current.collisionTip], [previous.collisionBase, previous.collisionTip],
      [previous.collisionBase, current.collisionBase], [previous.collisionTip, current.collisionTip]];
    for (const obstacle of obstacles) {
      if (obstacle.enabled === false) continue;
      for (const pair of pairs) {
        const hit = segmentAABB(pair[0], pair[1], obstacle, current.radius);
        if (!hit) continue;
        const distance = Math.hypot(hit.point.x - actor.position.x, hit.point.z - actor.position.z);
        if (!result || distance < result.distance) result = { obstacle, hit, distance };
      }
    }
    return result;
  }
  function blendBlades(a, b, t, weapon, pose) {
    if (weapon.unarmed) {
      const fallback = idleBlade(weapon, pose, false), ah = a.handTargets || fallback.handTargets, bh = b.handTargets;
      return makeFists(worldToLocal(mix(ah.right, bh.right, t), pose), worldToLocal(mix(ah.left, bh.left, t), pose),
        weapon, pose, a.side, { phase: 'recoil', progress: t, active: false });
    }
    const base = mix(a.base, b.base, t);
    let direction = mix(unit(sub(a.tip, a.base)), unit(sub(b.tip, b.base)), t);
    if (lengthSq(direction) < EPS) direction = sub(b.tip, b.base);
    const tip = add(base, mul(unit(direction), weapon.bladeLength));
    return makeBlade(worldToLocal(base, pose), worldToLocal(tip, pose), weapon, pose,
      { phase: 'recoil', progress: t, active: false, angle: 0,
        torsoYaw: lerp(a.torsoYaw || 0, b.torsoYaw || 0, t) });
  }

  class Controller {
    constructor(options) {
      options = options || {};
      this.weapon = getWeapon(options.weapon);
      this.maxStamina = options.maxStamina || 100;
      this.stamina = options.stamina == null ? this.maxStamina : clamp(options.stamina, 0, this.maxStamina);
      // Combat timestamps share the host simulation's time origin. Animation
      // durations remain local, so a newly nearby actor need not start at zero.
      this.clock = Number.isFinite(options.clock) ? options.clock : 0;
      this.guardSince = -Infinity;
      this.parryReadyAt = this.clock;
      this.guarding = false;
      this.guardSide = null;
      this.charging = false; this.chargeLevel = 0; this.chargeSide = null;
      this.attackState = null;
      this.recoil = null;
      this.previousPose = null;
      this.currentPose = clonePose(options.pose);
      this.queued = null;
      this.lastSpentAt = -Infinity;
      this.lastFinishedAt = -Infinity;
      this.lastCombo = -1;
      this.lastAutoCombo = false; this.lastSide = null; this.lastExitPose = null;
      this.swingCounter = 0;
      this.lastAction = { ok: true, reason: 'ready' };
      this.pendingEvents = [];
    }
    get weaponId() { return this.weapon.id; }
    get isBusy() { return !!(this.attackState || this.recoil); }
    get phase() { return this.recoil ? 'recoil' : this.attackState ? sampleBlade(this.weapon, this.attackState.kind, this.attackState.elapsed, this.currentPose, this.attackState.combo, this.attackState).phase : this.charging ? 'charge' : this.guarding ? 'guard' : 'idle'; }
    setWeapon(id, options) {
      if (this.isBusy && !(options && options.force)) return this._deny('busy');
      this.weapon = getWeapon(id);
      this.attackState = null; this.recoil = null; this.queued = null; this.guarding = false; this.guardSide = null; this.cancelCharge();
      this.lastCombo = -1; this.lastFinishedAt = -Infinity;
      this.lastAutoCombo = false; this.lastSide = null; this.lastExitPose = null;
      this.lastAction = { ok: true, reason: 'equipped', weapon: this.weapon.id };
      return true;
    }
    _deny(reason) { this.lastAction = { ok: false, reason }; return false; }
    attack(kind, options) {
      options = options || {};
      let side = validSide(options.side);
      const charge = chargeAmount(options.charge), autoCombo = !!options.autoCombo || options.side === 'auto';
      kind = charge > 0 || kind === 'heavy' ? 'heavy' : 'light';
      this.cancelCharge();
      if (this.recoil) return this._deny('recoil');
      if (this.attackState) {
        const state = this.attackState, p = state.profile;
        const bufferOpens = autoCombo ? Math.min(0.045, p.windup * 0.5) : p.windup + p.active * 0.45;
        if (kind === 'light' && !charge && state.kind === 'light' && state.elapsed + EPS >= bufferOpens && !this.queued) {
          this.queued = { kind: 'light', side, charge: 0, autoCombo };
          state.chainEnd = comboTransitionTime(state, this.queued);
          this.lastAction = { ok: true, reason: 'queued' };
          return true;
        }
        return this._deny('busy');
      }
      const chaining = kind === 'light' && this.clock - this.lastFinishedAt <= 0.42 && this.lastCombo >= 0 && this.lastAutoCombo === autoCombo;
      const length = autoCombo ? comboLength(this.weapon) : this.weapon.comboMultipliers.length;
      const combo = chaining ? (this.lastCombo + 1) % length : 0;
      const finisher = autoCombo && kind === 'light' && isOneHandCombo(this.weapon) && combo === 3;
      if (autoCombo) side = chaining && this.lastSide ? this.lastSide === 'right' ? 'left' : 'right' : 'right';
      const p = autoCombo && kind === 'light' ? comboProfile(this.weapon, combo) : attackProfile(this.weapon, kind, charge);
      if (this.stamina + EPS < p.stamina) return this._deny('stamina');
      this.stamina -= p.stamina;
      this.lastSpentAt = this.clock;
      this.guarding = false; this.guardSide = null;
      // A charged release has already held the weapon at the end of windup.
      // Begin the active interval from that exact ready pose; ordinary attacks
      // still play their complete windup.
      const entryPose = autoCombo && !charge ? chaining && this.lastExitPose && this.clock - this.lastFinishedAt < 0.08
        ? this.lastExitPose : comboEntryPose(this.getBlade(this.currentPose)) : null;
      this.attackState = { id: ++this.swingCounter, kind, side, charge, profile: p, combo, autoCombo, comboLength: length, finisher,
        entryPose, elapsed: charge > 0 ? p.windup : 0, hits: new Set(), hitCount: 0 };
      this.lastAction = { ok: true, reason: 'started', swingId: this.swingCounter };
      this.pendingEvents.push({ type: 'attack', weapon: this.weapon.id, kind, side, charge, combo, autoCombo, comboLength: length, finisher,
        duration: totalDuration(p), swingId: this.swingCounter });
      return true;
    }
    setGuard(on, side) {
      if (!on) { this.guarding = false; this.guardSide = null; return true; }
      if (this.isBusy) return this._deny('busy');
      if (this.stamina < 5) {
        this.guarding = false; this.guardSide = null;
        return this._deny('stamina');
      }
      const nextSide = validSide(side);
      if (!this.guarding || this.guardSide !== nextSide) this.guardSince = this.clock;
      this.cancelCharge();
      this.guarding = true; this.guardSide = nextSide;
      this.lastCombo = -1; this.lastFinishedAt = -Infinity; this.lastAutoCombo = false; this.lastExitPose = null;
      this.lastAction = { ok: true, reason: 'guard' };
      return true;
    }
    setCharge(level, side) {
      if (this.isBusy) return this._deny('busy');
      const charge = chargeAmount(level);
      if (this.stamina + EPS < attackProfile(this.weapon, charge > 0 ? 'heavy' : 'light', charge).stamina) return this._deny('stamina');
      this.guarding = false; this.guardSide = null;
      this.charging = true; this.chargeLevel = charge; this.chargeSide = validSide(side) || 'right';
      this.lastCombo = -1; this.lastFinishedAt = -Infinity; this.lastAutoCombo = false; this.lastExitPose = null;
      this.lastAction = { ok: true, reason: 'charge' };
      return true;
    }
    cancelCharge() {
      this.charging = false; this.chargeLevel = 0; this.chargeSide = null;
      return true;
    }
    reset(options) {
      options = options || {};
      this.attackState = null; this.recoil = null; this.queued = null; this.guarding = false; this.guardSide = null; this.cancelCharge();
      this.stamina = options.stamina == null ? this.maxStamina : clamp(options.stamina, 0, this.maxStamina);
      this.lastCombo = -1; this.lastFinishedAt = -Infinity; this.lastSpentAt = -Infinity;
      this.lastAutoCombo = false; this.lastSide = null; this.lastExitPose = null;
      this.parryReadyAt = this.clock; this.guardSince = -Infinity; this.pendingEvents.length = 0;
      if (options.pose) this.syncPose(options.pose);
      return this;
    }
    syncPose(pose) { this.currentPose = clonePose(pose); this.previousPose = clonePose(pose); return this; }
    _interrupt(seconds, reason, pose, blade) {
      this.recoil = { remaining: seconds, duration: seconds, reason,
        blade: blade || this.getBlade(pose || this.currentPose) };
      this.attackState = null; this.queued = null; this.guarding = false; this.guardSide = null; this.cancelCharge();
      this.lastCombo = -1; this.lastFinishedAt = -Infinity;
      this.lastAutoCombo = false; this.lastSide = null; this.lastExitPose = null;
    }
    /** HP remains external. hit.now and this controller's timestamps must use
     * the same simulation time origin; the native adapter keeps them aligned. */
    receiveHit(hit, actorPose) {
      const pose = clonePose(actorPose || this.currentPose), attacker = hit.attackerPosition || v();
      const toward = v(attacker.x - pose.position.x, 0, attacker.z - pose.position.z);
      const facing = v(Math.sin(pose.yaw), 0, Math.cos(pose.yaw));
      const front = lengthSq(toward) < EPS || dot(unit(toward), facing) >= Math.cos(this.weapon.blockArc * Math.PI / 360);
      const now = hit.now == null ? this.clock : hit.now;
      const rawDamage = Math.max(0, hit.damage || 0);
      // incomingSide is in the defender's anatomical frame. Otherwise transform
      // the attacker's authored starting side into world space, then into ours.
      // At head-on headings an attacker-right strike reaches defender-left.
      let incomingSide = validSide(hit.incomingSide);
      if (!incomingSide) incomingSide = incomingSideForAttack(hit.side, hit.attackerYaw, pose.yaw);
      if (!incomingSide) {
        const projection = toward.x * Math.cos(pose.yaw) - toward.z * Math.sin(pose.yaw);
        if (Math.abs(projection) > 1e-6) incomingSide = projection < 0 ? 'right' : 'left';
      }
      const sideMatches = !this.guardSide || this.guardSide === incomingSide;
      const result = { type: 'hit', damage: rawDamage, rawDamage, incomingSide, staminaDamage: 0, staminaLeft: this.stamina };
      if (!this.guarding || !front || !sideMatches || hit.unblockable) {
        if (rawDamage > 0 && (this.charging || (hit.poiseDamage || 0) >= this.weapon.poise)) this._interrupt(0.18, 'flinch', pose);
        return result;
      }
      const parryCost = 8;
      if (now >= this.guardSince && now - this.guardSince <= this.weapon.parryWindow + EPS && now >= this.parryReadyAt && this.stamina >= parryCost) {
        this.stamina -= parryCost; this.lastSpentAt = now; this.parryReadyAt = now + 0.65;
        if (this.stamina < 5) { this.guarding = false; this.guardSide = null; }
        return { type: 'parry', damage: 0, rawDamage, incomingSide, staminaDamage: parryCost, staminaLeft: this.stamina, recoil: 0.58 };
      }
      const guardCost = Math.max(5, hit.guardDamage == null ? rawDamage * 0.72 : hit.guardDamage);
      const spent = Math.min(this.stamina, guardCost);
      this.stamina -= spent; this.lastSpentAt = now;
      if (spent + EPS < guardCost) {
        this._interrupt(0.75, 'guardbreak', pose);
        return { type: 'guardbreak', damage: Math.round(rawDamage * 0.7), rawDamage, incomingSide, staminaDamage: spent, staminaLeft: 0 };
      }
      if (this.stamina < 5) { this.guarding = false; this.guardSide = null; }
      return { type: 'block', damage: Math.round(rawDamage * (1 - this.weapon.block)), rawDamage, incomingSide,
        staminaDamage: guardCost, staminaLeft: this.stamina, recoil: 0.16 };
    }
    getBlade(actorPose) {
      const pose = clonePose(actorPose || this.currentPose);
      if (this.attackState) return sampleBlade(this.weapon, this.attackState.kind, this.attackState.elapsed, pose, this.attackState.combo, this.attackState);
      if (this.recoil) {
        const blade = blendBlades(this.recoil.blade, idleBlade(this.weapon, pose, false), smooth(1 - this.recoil.remaining / this.recoil.duration), this.weapon, pose);
        blade.phase = 'recoil'; blade.progress = 1 - this.recoil.remaining / this.recoil.duration; blade.active = false;
        return blade;
      }
      if (this.charging) {
        const blade = sampleBlade(this.weapon, 'heavy', this.weapon.heavy.windup, pose, 0, { side: this.chargeSide, charge: this.chargeLevel });
        blade.phase = 'charge'; blade.progress = this.chargeLevel; blade.active = false;
        return blade;
      }
      return idleBlade(this.weapon, pose, this.guarding, this.guardSide);
    }
    _regenerate(dt) {
      if (this.attackState || this.recoil || this.charging) return;
      const eligible = Math.max(0, this.clock + dt - Math.max(this.clock, this.lastSpentAt + 0.6));
      this.stamina = clamp(this.stamina + eligible * (this.guarding ? 4 : 22), 0, this.maxStamina);
    }
    _sweep(from, to, state, poseAt, clockAt, targets, obstacles, events) {
      const p = state.profile;
      const begin = Math.max(from, p.windup), end = Math.min(to, p.windup + p.active);
      if (end < begin + EPS) return null;
      const firstPose = poseAt(begin), lastPose = poseAt(end);
      const move = length(sub(lastPose.position, firstPose.position));
      const turn = Math.abs(angleDelta(firstPose.yaw, lastPose.yaw));
      const duration = end - begin;
      const steps = Math.max(1, Math.ceil(duration * 150), Math.ceil((p.arc * duration / p.active + turn) / 0.045),
        Math.ceil(move / Math.max(0.025, this.weapon.bladeRadius * 0.6)));
      let previous = sampleBlade(this.weapon, state.kind, begin, firstPose, state.combo, state);
      for (let n = 1; n <= steps; n++) {
        const elapsed = lerp(begin, end, n / steps), pose = poseAt(elapsed);
        const blade = sampleBlade(this.weapon, state.kind, elapsed, pose, state.combo, state);
        const wall = firstWall(previous, blade, obstacles, pose), candidates = [];
        for (let i = 0; i < targets.length && state.hitCount < p.maxTargets; i++) {
          const target = targets[i], key = target.id == null ? target : target.id;
          if (target.alive === false || target.enabled === false || target.health != null && target.health <= 0 || state.hits.has(key)) continue;
          const capsule = capsuleForTarget(target);
          if (!sweptBladeCapsule(previous, blade, capsule)) continue;
          const center = mix(capsule.bottom, capsule.top, 0.55), chest = add(pose.position, v(0, 1.1, 0));
          if (isOccluded(chest, center, obstacles, 0.015)) continue;
          const horizontalDistance = Math.hypot(center.x - pose.position.x, center.z - pose.position.z);
          if (wall && horizontalDistance - capsule.radius > wall.distance + this.weapon.bladeRadius) continue;
          const closest = closestSegmentPoints(blade.collisionBase, blade.collisionTip, capsule.bottom, capsule.top);
          // Use the same point along the swept collision segment in both
          // samples. This preserves the actual cut/thrust direction, including
          // actor translation and turning, rather than guessing from facing.
          const sweepDelta = sub(closest.point1, mix(previous.collisionBase, previous.collisionTip, closest.s));
          candidates.push({ target, key, distance: horizontalDistance, point: closest.point2,
            sweepDirection: lengthSq(sweepDelta) > EPS ? unit(sweepDelta) : null });
        }
        candidates.sort((a, b) => a.distance - b.distance);
        for (const candidate of candidates) {
          if (state.hitCount >= p.maxTargets) break;
          const target = candidate.target;
          state.hits.add(candidate.key);
          const multiplier = state.kind !== 'light' || state.finisher ? 1
            : state.autoCombo && this.weapon.unarmed ? 1 : this.weapon.comboMultipliers[Math.min(state.combo, this.weapon.comboMultipliers.length - 1)];
          const damage = Math.round(p.damage * multiplier * Math.pow(this.weapon.cleaveDecay, state.hitCount));
          const incoming = { damage, guardDamage: p.guardDamage, poiseDamage: p.poiseDamage,
            attackerPosition: pose.position, attackerYaw: pose.yaw, side: state.side || (state.combo % 2 ? 'left' : 'right'), charge: state.charge, kind: state.kind, weapon: this.weapon.id, now: clockAt(elapsed) };
          const defense = target.controller && typeof target.controller.receiveHit === 'function'
            ? target.controller.receiveHit(incoming, { position: target.position || target, yaw: target.yaw || 0 })
            : { type: 'hit', damage, rawDamage: damage };
          state.hitCount++;
          events.push(Object.assign({ targetId: target.id, target, point: candidate.point,
            weapon: this.weapon.id, kind: state.kind, side: incoming.side, charge: state.charge, combo: state.combo,
            autoCombo: state.autoCombo, finisher: state.finisher, knockback: state.finisher && defense.type === 'hit' ? 0.72 : 0, swingId: state.id,
            attackShape: p.shape, bloodEffect: this.weapon.bloodEffect || null, sweepDirection: candidate.sweepDirection,
            time: clockAt(elapsed), hitstop: p.hitstop }, defense));
          if (defense.type === 'parry' || defense.type === 'block') {
            if (defense.type === 'parry') { this.stamina = Math.max(0, this.stamina - 10); this.lastSpentAt = clockAt(elapsed); }
            this._interrupt(defense.recoil, defense.type, pose, blade);
            return elapsed;
          }
        }
        if (wall) {
          events.push({ type: 'wall', obstacleId: wall.obstacle.id, point: wall.hit.point, normal: wall.hit.normal,
            weapon: this.weapon.id, kind: state.kind, swingId: state.id, time: clockAt(elapsed), damage: 0, hitstop: 0.055 });
          this._interrupt(0.24, 'wall', pose, blade);
          return elapsed;
        }
        previous = blade;
      }
      return null;
    }
    /** update(dt, {position,yaw,targets,obstacles,teleport?}) -> render frame + immutable hit events.
     * Targets: {id,position:{x,y,z},radius:0.3,height:1.8,health?,yaw?,controller?}.
     * Obstacles: {id,min:{x,y,z},max:{x,y,z},enabled?}. Target HP is never modified.
     */
    update(dt, input) {
      if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be a finite non-negative number');
      input = input || {};
      const pose = clonePose(input), previous = input.teleport || !this.previousPose ? pose : this.previousPose;
      const frameClock = this.clock, targets = input.targets || [], obstacles = input.obstacles || [];
      this.currentPose = pose;
      const events = this.pendingEvents.splice(0);
      let remaining = dt, iterations = 0;
      while (remaining > EPS && iterations++ < 16) {
        if (this.recoil) {
          const step = Math.min(remaining, this.recoil.remaining);
          this.recoil.remaining -= step; this.clock += step; remaining -= step;
          if (this.recoil.remaining <= EPS) this.recoil = null;
          continue;
        }
        if (this.attackState) {
          const state = this.attackState, p = state.profile, from = state.elapsed;
          const endAt = comboTransitionTime(state, this.queued);
          const step = Math.min(remaining, Math.max(0, endAt - from)), segmentClock = this.clock;
          const poseAt = elapsed => lerpPose(previous, pose, dt > EPS ? clamp((segmentClock - frameClock + elapsed - from) / dt, 0, 1) : 1);
          const clockAt = elapsed => segmentClock + elapsed - from;
          const interruptedAt = this._sweep(from, from + step, state, poseAt, clockAt, targets, obstacles, events);
          const used = interruptedAt == null ? step : Math.max(EPS, interruptedAt - from);
          this.clock += used; remaining -= used;
          if (interruptedAt != null) continue;
          state.elapsed += step;
          if (state.elapsed + EPS >= endAt) {
            const queue = this.queued;
            this.lastExitPose = comboEntryPose(this.getBlade(poseAt(state.elapsed)));
            this.attackState = null; this.queued = null;
            this.lastCombo = state.kind === 'light' ? state.combo : -1;
            this.lastAutoCombo = state.autoCombo; this.lastSide = state.side;
            this.lastFinishedAt = this.clock;
            events.push({ type: 'attackend', swingId: state.id, kind: state.kind, weapon: this.weapon.id, combo: state.combo, autoCombo: state.autoCombo, finisher: state.finisher });
            if (queue) { this.attack(queue.kind, queue); events.push.apply(events, this.pendingEvents.splice(0)); }
          }
          continue;
        }
        this._regenerate(remaining);
        this.clock += remaining; remaining = 0;
      }
      if (remaining > EPS) { this._regenerate(remaining); this.clock += remaining; }
      this.previousPose = pose;
      const blade = this.getBlade(pose), state = this.attackState;
      return { events, blade, phase: blade.phase, progress: blade.progress,
        stamina: this.stamina, maxStamina: this.maxStamina, guarding: this.guarding, guardSide: this.guardSide, charging: this.charging,
        side: state ? state.side : this.charging ? this.chargeSide : this.guardSide, charge: state ? state.charge : this.chargeLevel,
        combo: state ? state.combo + 1 : 0, kind: state ? state.kind : null,
        autoCombo: !!state?.autoCombo, comboLength: state ? state.comboLength : comboLength(this.weapon), finisher: !!state?.finisher,
        swingId: state ? state.id : null, weapon: this.weapon.id, clock: this.clock,
        queued: !!this.queued, recoilReason: this.recoil && this.recoil.reason };
    }
    snapshot() {
      return { weapon: this.weapon.id, stamina: this.stamina, maxStamina: this.maxStamina,
        clock: this.clock, phase: this.phase, guarding: this.guarding, guardSide: this.guardSide, charging: this.charging,
        side: this.attackState ? this.attackState.side : this.charging ? this.chargeSide : this.guardSide, charge: this.attackState ? this.attackState.charge : this.chargeLevel,
        combo: this.attackState ? this.attackState.combo + 1 : 0,
        autoCombo: !!this.attackState?.autoCombo, comboLength: this.attackState ? this.attackState.comboLength : comboLength(this.weapon), finisher: !!this.attackState?.finisher,
        attackElapsed: this.attackState ? this.attackState.elapsed : 0,
        swingId: this.attackState ? this.attackState.id : null, queued: !!this.queued };
    }
  }

  return Object.freeze({ version: '1.3.0', CHARGE, get WEAPONS() { return WEAPONS; }, get MODEL_AXES() { return MODEL_AXES; }, registerWeapons, Controller, getWeapon, incomingSideForAttack, sampleBlade, modelTransform, transformModelPoint,
    idleBlade: (weapon, pose, guard, side) => idleBlade(getWeapon(weapon), clonePose(pose), !!guard, side),
    totalDuration, comboTransitionTime, comboLength, closestSegmentPoints, segmentSegmentDistanceSq, segmentTriangleDistanceSq,
    segmentAABB, sweptBladeCapsule, capsuleForTarget, isOccluded });
}));

return module.exports;})();
  const Input=(function(){const module={exports:{}};
/* HANQ directional melee gestures. DOM-free; time is supplied by the game loop.
 * A tap commits on release. A hold never also commits a tap.
 * An upward drag arms charging; only time held at/above that offset adds power.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HanqMeleeInput = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULTS = Object.freeze({ holdSeconds: 0.18, dragPixels: 18, maxChargeSeconds: 1.5 });
  const noop = function () {};
  const finite = (n, fallback) => Number.isFinite(n) ? n : fallback;
  const positive = (n, fallback) => Number.isFinite(n) && n > 0 ? n : fallback;

  class DirectionalInput {
    constructor(options) {
      options = options || {};
      this.holdSeconds = positive(options.holdSeconds, DEFAULTS.holdSeconds);
      this.dragPixels = positive(options.dragPixels, DEFAULTS.dragPixels);
      this.maxChargeSeconds = positive(options.maxChargeSeconds, DEFAULTS.maxChargeSeconds);
      this.onAttack = typeof options.onAttack === 'function' ? options.onAttack : noop;
      this.onGuard = typeof options.onGuard === 'function' ? options.onGuard : noop;
      this.onCharge = typeof options.onCharge === 'function' ? options.onCharge : noop;
      this.onState = typeof options.onState === 'function' ? options.onState : noop;
      this._session = null;
    }
    get state() {
      const s = this._session;
      return s ? { phase: s.phase, side: s.side, charge: s.chargeSeconds / this.maxChargeSeconds,
        pointerId: s.pointerId, elapsed: s.elapsed, chargingForward: s.forward }
        : { phase: 'idle', side: null, charge: 0, pointerId: null, elapsed: 0, chargingForward: false };
    }
    _emit() { this.onState(this.state); }
    press(side, pointerId, x, y) {
      if (this._session || (side !== 'right' && side !== 'left') || pointerId == null) return false;
      this._session = { phase: 'pending', side, pointerId, originX: finite(x, 0), originY: finite(y, 0),
        x: finite(x, 0), y: finite(y, 0), elapsed: 0, chargeSeconds: 0, forward: false };
      this._emit();
      return true;
    }
    move(pointerId, x, y) {
      const s = this._session;
      if (!s || s.pointerId !== pointerId) return false;
      s.x = finite(x, s.x); s.y = finite(y, s.y);
      s.forward = s.originY - s.y >= this.dragPixels;
      if (s.forward && s.phase !== 'charge') {
        if (s.phase === 'guard') this.onGuard(false, s.side);
        s.phase = 'charge';
        this.onCharge(0, s.side);
      }
      this._emit();
      return true;
    }
    update(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be finite and non-negative');
      const s = this._session;
      if (!s || dt === 0) return false;
      s.elapsed += dt;
      if (s.phase === 'pending' && s.elapsed + 1e-9 >= this.holdSeconds) {
        s.phase = 'guard';
        this.onGuard(true, s.side);
      }
      if (s.phase === 'charge' && s.forward) {
        const before = s.chargeSeconds;
        s.chargeSeconds = Math.min(this.maxChargeSeconds, s.chargeSeconds + dt);
        if (s.chargeSeconds !== before) this.onCharge(s.chargeSeconds / this.maxChargeSeconds, s.side);
      }
      this._emit();
      return true;
    }
    _finish(attack) {
      const s = this._session;
      if (!s) return false;
      const commit = attack && (s.phase === 'pending' || s.phase === 'charge');
      const charge = s.phase === 'charge' ? s.chargeSeconds / this.maxChargeSeconds : 0;
      this._session = null;
      if (s.phase === 'guard') this.onGuard(false, s.side);
      if (s.phase === 'charge') this.onCharge(null, s.side);
      this._emit();
      if (commit) this.onAttack(s.side, charge);
      return true;
    }
    release(pointerId) {
      if (!this._session || this._session.pointerId !== pointerId) return false;
      return this._finish(true);
    }
    cancel(pointerId) {
      if (!this._session || pointerId != null && this._session.pointerId !== pointerId) return false;
      return this._finish(false);
    }
    cancelAll() { return this.cancel(); }
  }
  return { DirectionalInput, DEFAULTS };
}));

return module.exports;})();
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const sideOf = value => value === 'left' || value === 'L' ? 'left' : value === 'right' || value === 'R' ? 'right' : null;
  const normalizeId = id => id === 'fist' ? 'fists' : typeof id === 'string' && own(Core.WEAPONS, id) ? id : null;
  const colors = {fists:'#e5e7eb',dagger:'#b9c1c9',arming_sword:'#d5bb7a',longsword:'#d4b279',katana:'#e1c993',machete:'#9baf92',war_hammer:'#b7a79a'};
  let nativeSource = null, nativeDefinitions = null;
  function getNativeDefinitions() {
  if (nativeSource === Core.WEAPONS) return nativeDefinitions;
  const nativeWeaponDefinitions = Object.fromEntries(Object.entries(Core.WEAPONS).map(([id, w]) => [id, Object.freeze({
    name: w.name, dmg: w.light.damage, rate: Core.totalDuration(w.light), mag: 0, spread: 0,
    ads: 0, speed: 0, range: w.reach, reload: 0, tier: w.tier ?? (id === 'fists' ? 0 : id === 'dagger' ? 1 : id === 'longsword' || id === 'war_hammer' ? 3 : 2),
    color: w.color || colors[id] || '#c3ae83', melee: true, len: w.bladeLength, kick: 0, zoom: 1,
    moveMult: w.moveMult ?? (id === 'longsword' || id === 'war_hammer' ? .95 : 1), meleeId: id,
    ...(w.bloodEffect ? {bloodEffect:w.bloodEffect} : {})
  })]));
  nativeWeaponDefinitions.fist = nativeWeaponDefinitions.fists;
  nativeSource = Core.WEAPONS; nativeDefinitions = Object.freeze(nativeWeaponDefinitions);
  return nativeDefinitions;
  }

  /** Native game: x/e.y are ground X/Z, e.aim=0 faces +X. */
  function defaultWeaponId(actor) {
    if (!actor) return null;
    if (actor.meleeWeapon != null) return normalizeId(actor.meleeWeapon);
    if (actor.hkWeapon != null) return normalizeId(actor.hkWeapon);
    const slot = actor.weapons && actor.weapons[actor.cur || 0];
    return slot ? normalizeId(slot.type) : 'fists';
  }

  function create(host = {}) {
    const getPlayer = typeof host.getPlayer === 'function' ? host.getPlayer : () => null;
    const getActors = typeof host.getActors === 'function' ? host.getActors : () => [getPlayer()].filter(Boolean);
    const baseY = typeof host.getBaseY === 'function' ? host.getBaseY : e => finite(e.h, finite(e.gy));
    const weaponId = e => normalizeId(typeof host.getWeaponId === 'function' ? host.getWeaponId(e) : defaultWeaponId(e));
    const records = new Map();
    let inputActor = null, inputAuto = false, disposed = false, serial = 0;
    // Every actor uses this time axis, including new/re-entering actors and
    // actors resuming after a movement or hit-reaction restriction.
    let simulationClock = 0, ticking = false;
    const stats = {attacks:0,hits:0,blocks:0,parries:0,wallHits:0,cancelledInputs:0};
    const poseOf = e => ({position:{x:finite(e.x),y:finite(baseY(e)),z:finite(e.y)},yaw:Math.PI / 2 - finite(e.aim)});
    function allowed(e) {
      return !disposed && !!e && e.alive !== false && !e.vehicle && !e.craft && !e.mortar && !e.railPassenger
        && !(e.alt > 0) && !e.climb && !e.vault && !e.roll && (!host.canAct || host.canAct(e) !== false);
    }
    function isMelee(e) { return !!e && !!weaponId(e) && !e.vehicle && !e.craft && !e.mortar && !e.railPassenger; }
    function record(e) {
      const id = weaponId(e);
      if (!e || !id || disposed) return null;
      let r = records.get(e);
      if (!r) {
        r = {key:e.id == null ? 'melee:' + (++serial) : e.id,controller:new Core.Controller({weapon:id,pose:poseOf(e),clock:simulationClock}),frame:null,weapon:id};
        records.set(e,r);
      } else if (r.weapon !== id) {
        if (inputActor === e) cancelInput();
        r.controller.setWeapon(id,{force:true});r.controller.syncPose(poseOf(e));r.weapon=id;r.frame=null;
      }
      // Do not rewind a target already advanced in this tick. Its defensive
      // timers still use the same axis as the attacker's exact swept hit time.
      if (r.controller.clock < simulationClock) r.controller.clock = simulationClock;
      return r;
    }
    function cancelActor(e, resetStamina = false) {
      const r = records.get(e);
      if (!r) return false;
      r.controller.reset({stamina:resetStamina ? r.controller.maxStamina : r.controller.stamina,pose:poseOf(e)});
      r.frame = null;
      return true;
    }
    function notifyAttack(e, r, event, profile) {
      if (r.notifiedSwing === event.swingId) return;
      r.notifiedSwing = event.swingId;
      e.safeT=0;e.healT=0;e.reloadT=0;e.recoil=1;
      e.fireT=Math.max(finite(e.fireT),event.duration || Core.totalDuration(profile || (event.kind==='heavy'?r.controller.weapon.heavy:r.controller.weapon.light)));
      stats.attacks++;
      if (typeof host.onAttack === 'function') host.onAttack(e,{side:event.side,charge:event.charge,weapon:r.weapon,
        combo:event.combo+1,autoCombo:!!event.autoCombo,finisher:!!event.finisher,swingId:event.swingId});
    }
    function attack(e, side = 'right', charge = 0) {
      const autoCombo = side === 'auto' || side === 'attack';
      side = sideOf(side);
      if ((!side && !autoCombo) || !allowed(e) || !isMelee(e)) return false;
      const r = record(e), controller = r.controller;
      controller.syncPose(poseOf(e));
      const accepted = controller.attack(charge > 0 ? 'heavy' : 'light',{side,autoCombo,charge:clamp(finite(charge),0,1)});
      if (accepted && controller.lastAction.reason === 'started') {
        const state=controller.attackState;
        notifyAttack(e,r,{...state,swingId:state.id},state.profile);
      }
      return accepted;
    }
    function setGuard(e, on, side = 'right') {
      const r = on && allowed(e) && isMelee(e) ? record(e) : records.get(e);
      if (!r) return false;
      if (on && (!allowed(e) || !isMelee(e))) return false;
      return r.controller.setGuard(!!on,sideOf(side));
    }
    function setCharge(e, amount, side = 'right') {
      if(amount==null)return records.get(e)?.controller.cancelCharge() || false;
      if (!allowed(e) || !isMelee(e)) return false;
      const r=record(e);
      return r.controller.setCharge(clamp(finite(amount),0,1),sideOf(side));
    }
    const input = new Input.DirectionalInput({
      onAttack:(side,charge)=>{const e=inputActor,auto=inputAuto;inputActor=null;inputAuto=false;if(e)attack(e,auto&&!(charge>0)?'auto':side,charge);},
      onGuard:(on,side)=>{if(inputActor)setGuard(inputActor,on,inputAuto?null:side);},
      onCharge:(amount,side)=>{if(inputActor)setCharge(inputActor,amount,side);},
      onState:state=>{if(typeof host.onInputState==='function')host.onInputState(state);}
    });
    function pointerDown(side,id,x,y) {
      const e=getPlayer();
      if(!allowed(e)||!isMelee(e)||input.state.pointerId!=null)return false;
      const r=record(e),c=r.controller;inputActor=e;inputAuto=side==='attack'||side==='auto';
      if(inputAuto) {
        const state=c.attackState;
        const previous=state?.autoCombo&&state.kind==='light'?state.side
          :c.lastAutoCombo&&c.lastCombo>=0&&c.clock-c.lastFinishedAt<=0.42?c.lastSide:null;
        side=previous==='right'?'left':'right';
      }
      const ok=input.press(sideOf(side),id,x,y);
      if(!ok){inputActor=null;inputAuto=false;}
      return ok;
    }
    function pointerMove(id,x,y) { return input.move(id,x,y); }
    function pointerUp(id) {
      const ok=input.release(id);
      if(ok){inputActor=null;inputAuto=false;}
      return ok;
    }
    function cancelInput(id) {
      if(input.state.pointerId==null)return false;
      const cancelled=input.cancel(id);
      if(cancelled){inputActor=null;inputAuto=false;stats.cancelledInputs++;}
      return cancelled;
    }
    function inputState() { return input.state; }
    function nativeTarget(e, attacker) {
      if (!e || e === attacker || e.alive === false || e.hp != null && e.hp <= 0) return null;
      const pose=poseOf(e),aPose=poseOf(attacker);
      // Native solidAt/trace hooks receive torso-height endpoints, never the floor.
      const from={...aPose.position,y:aPose.position.y+(attacker.crouch?.85:1.1)};
      const to={...pose.position,y:pose.position.y+(e.crouch?.85:1.1)};
      if(host.isLineBlocked && host.isLineBlocked(from,to,attacker,e))return null;
      const r=isMelee(e)?record(e):null;
      return {id:e.id == null ? (r ? r.key : e) : e.id,position:pose.position,yaw:pose.yaw,
        radius:typeof host.getRadius==='function'?host.getRadius(e):finite(e.meleeRadius,.32),
        height:typeof host.getHeight==='function'?host.getHeight(e):e.crouch?1.35:1.8,
        health:e.hp,alive:e.alive,controller:r&&allowed(e)?r.controller:null,entity:e};
    }
    function processEvents(actor, frame) {
      for(const event of frame.events) {
        if(event.type==='attack') {
          const r=records.get(actor);
          if(r)notifyAttack(actor,r,event,r.controller.attackState?.id===event.swingId?r.controller.attackState.profile:null);
        }
        const target=event.target?.entity || null;
        const nativeEvent={...event,attacker:actor,target,point:event.point?{...event.point}:null,
          sweepDirection:event.sweepDirection?{...event.sweepDirection}:null};
        if(event.type==='wall')stats.wallHits++;
        if(event.type==='block'||event.type==='guardbreak')stats.blocks++;
        if(event.type==='parry')stats.parries++;
        if(target&&event.damage>0) {
          stats.hits++;
          if(typeof host.applyDamage==='function')host.applyDamage(target,event.damage,actor,event.weapon,nativeEvent);
        }
        if(typeof host.onEvent==='function')host.onEvent(nativeEvent,actor);
      }
    }
    function stepActor(e,dt,options={}) {
      if(!Number.isFinite(dt)||dt<0)throw new RangeError('Melee dt must be finite and non-negative');
      const r=record(e);if(!r)return null;
      if(!allowed(e)){cancelActor(e);return null;}
      const targets=(options.targets || (host.getTargets?host.getTargets(e):getActors().filter(t=>t!==e)))
        .map(t=>nativeTarget(t,e)).filter(Boolean);
      const obstacles=options.obstacles || (host.getObstacles?host.getObstacles(e):[]) || [];
      r.frame=r.controller.update(dt,{...poseOf(e),targets,obstacles,teleport:!!options.teleport});
      processEvents(e,r.frame);
      // Standalone steps advance the host clock once; tick() advances it only
      // after all actors have simulated the same interval.
      if(!ticking)simulationClock=Math.max(simulationClock,r.controller.clock);
      return r.frame;
    }
    function tick(dt) {
      if(disposed)return;
      if(!Number.isFinite(dt)||dt<0)throw new RangeError('Melee dt must be finite and non-negative');
      const player=getPlayer();
      if(inputActor && (inputActor!==player || !allowed(inputActor) || !isMelee(inputActor)))cancelInput();
      // Weapon changes are resolved before the gesture callback can release a strike.
      const actors=Array.from(new Set(getActors().filter(Boolean)));
      for(const e of actors){if(isMelee(e)&&allowed(e))record(e);else if(records.has(e))cancelActor(e);}
      if(inputActor){
        input.update(dt);
        const intent=input.state;
        if(intent.phase==='guard')setGuard(inputActor,true,inputAuto?null:intent.side);
        else if(intent.phase==='charge')setCharge(inputActor,intent.charge,intent.side);
      }
      ticking=true;
      try { for(const e of actors)if(isMelee(e)&&allowed(e))stepActor(e,dt); }
      finally { ticking=false; }
      simulationClock+=dt;
      const present=new Set(actors);
      for(const [e]of records)if(!present.has(e)||e.alive===false){if(inputActor===e)cancelInput();records.delete(e);}
    }
    function frame(e) {
      if(!isMelee(e)||!allowed(e))return null;
      const r=record(e), c=r.controller;
      const blade=c.getBlade(poseOf(e));
      return {...(r.frame||{}),...c.snapshot(),blade,phase:blade.phase,progress:blade.progress,
        stamina:c.stamina,maxStamina:c.maxStamina,guarding:c.guarding,guardSide:c.guardSide,
        charging:c.charging,weapon:r.weapon,recoilReason:c.recoil?.reason||null,lastAction:c.lastAction};
    }
    function controller(e) { return record(e)?.controller || null; }
    function reset() { cancelInput();records.clear();simulationClock=0; }
    function dispose() { reset();disposed=true; }
    function layoutControls(layout,width,height) {
      const player=getPlayer();
      layout.meleeAttack=layout.meleeLeft=layout.meleeRight=null;
      if(!isMelee(player))return false;
      // Temporary movement restrictions hide attack without exposing gun controls.
      layout.fire=layout.fire2=layout.ads=layout.reload=layout.roll=layout.nade=null;
      if(player.climb||player.alt>0)return false;
      const fx=finite(width)-96,fy=finite(height)-120;
      layout.meleeAttack={x:fx,y:fy,r:42,action:'attack'};
      return true;
    }
    function hitControl(layout,pt) {
      if(!isMelee(getPlayer()))return null;
      const b=layout.meleeAttack;
      if(b&&Math.hypot(pt.x-b.x,pt.y-b.y)<b.r+6)return 'attack';
      return null;
    }
    function drawControls(c,layout) {
      if(!c||!layout||!isMelee(getPlayer()))return;
      const f=frame(getPlayer()), state=input.state;
      const b=layout.meleeAttack;if(!b)return;
      c.save();c.textAlign='center';c.textBaseline='middle';
      {
        const selected=state.pointerId!=null,guarding=!!f?.guarding;
        const charging=!!f?.charging;
        const waiting=selected&&(state.phase==='guard'||state.phase==='charge')&&!guarding&&!charging;
        const blocked=waiting&&(f?.phase==='recoil'||f?.stamina<5||f?.lastAction?.reason==='stamina');
        const label=guarding?'방어':charging?'차징':'공격';
        const feedback=waiting?(f?.recoilReason==='guardbreak'?'방어 붕괴':f?.phase==='recoil'?'경직':blocked?'기력 부족':f?.phase!=='idle'?'공격 중':'대기')
          :charging?'놓으면 강공격':guarding?'놓으면 해제':f?.finisher?'마무리':f?.combo?f.combo+'연타':'눌러서 방어';
        const active=guarding||charging||!blocked&&(selected||f?.phase!=='idle');
        c.fillStyle=blocked?'rgba(105,42,38,.65)':active?'rgba(154,117,61,.54)':'rgba(24,38,34,.32)';
        // The quieter visible ring does not reduce the original touch target.
        c.beginPath();c.arc(b.x,b.y,b.r-5,0,Math.PI*2);c.fill();
        c.strokeStyle=blocked?'#df8a7a':active?'#e4bf72':'rgba(232,222,193,.4)';c.lineWidth=active?2.5:1.2;c.stroke();
        c.fillStyle='#fff';c.font='800 18px system-ui';c.strokeStyle='rgba(0,0,0,.48)';c.lineWidth=3;c.strokeText?.(label,b.x,b.y-5);c.fillText(label,b.x,b.y-5);
        c.font='700 10px system-ui';c.fillStyle='rgba(255,255,255,.88)';
        c.fillText(feedback,b.x,b.y+19);
        if(!guarding&&!charging)for(let i=0;i<(f?.comboLength||4);i++){
          c.fillStyle=i<(f?.combo||0)?f?.finisher?'#ffe2a0':'#e4bf72':'rgba(255,255,255,.25)';
          c.beginPath();c.arc(b.x+(i-((f?.comboLength||4)-1)/2)*11,b.y-23,2.4,0,Math.PI*2);c.fill();
        }
        if(charging){
          c.strokeStyle='#f2d488';c.lineWidth=4;c.beginPath();c.arc(b.x,b.y,b.r-4,-Math.PI/2,-Math.PI/2+Math.PI*2*f.charge);c.stroke();
          c.fillStyle='#fce6ad';c.font='700 12px system-ui';c.fillText('×'+(1+f.charge).toFixed(2),b.x,b.y-b.r-16);
        }
      }
      c.restore();
    }
    function drawStatus(c,x,y,width=190) {
      const e=getPlayer(),f=frame(e);if(!c||!f)return;
      c.save();c.textAlign='left';c.textBaseline='alphabetic';
      c.fillStyle='rgba(7,15,20,.65)';c.fillRect(x,y,width,38);
      c.fillStyle='#e9ddb9';c.font='700 10px system-ui';
      const phase=f.recoilReason==='guardbreak'?'방어 붕괴':f.phase==='recoil'?'경직':f.charging?'차징 '+Math.round(f.charge*100)+'%':f.guarding?'방어':f.stamina<5?'기력 부족':f.phase==='idle'?'대기':f.finisher?'4타 마무리':f.autoCombo?f.combo+'연타':'공격 중';
      c.fillText(Core.WEAPONS[f.weapon].name+' · '+phase,x+8,y+12,width-16);
      c.fillStyle=f.stamina<20?'#efa08d':'#d5dece';c.font='700 9px system-ui';
      c.fillText('스태미나 '+Math.floor(f.stamina+1e-9)+' / '+f.maxStamina,x+8,y+25,width-16);
      c.fillStyle='rgba(255,255,255,.18)';c.fillRect(x+8,y+30,width-16,4);
      c.fillStyle=f.stamina<20?'#db7765':'#c9ae6e';c.fillRect(x+8,y+30,(width-16)*clamp(f.stamina/f.maxStamina,0,1),4);
      c.restore();
    }
    function keyDown(key) {
      if(key==='j'||key==='k')return pointerDown('attack','key:'+key,0,0);
      if(key==='shift'&&input.state.pointerId!=null&&String(input.state.pointerId).startsWith('key:'))return pointerMove(input.state.pointerId,0,-24);
      return false;
    }
    function keyUp(key) {
      if(key==='j'||key==='k')return pointerUp('key:'+key);
      if(key==='shift'&&input.state.pointerId!=null&&String(input.state.pointerId).startsWith('key:'))return pointerMove(input.state.pointerId,0,0);
      return false;
    }
    return Object.freeze({tick,stepActor,attack,setGuard,setCharge,isMelee,weaponId,poseOf,controller,frame,
      pointerDown,pointerMove,pointerUp,cancelInput,inputState,keyDown,keyUp,cancelActor,reset,dispose,
      layoutControls,hitControl,drawControls,drawStatus,
      diagnostics:()=>({version:VERSION,actors:records.size,input:input.state,...stats})});
  }
  return Object.freeze({version:VERSION,Core,Input,get WEAPONS(){return Core.WEAPONS;},get nativeWeaponDefinitions(){return getNativeDefinitions();},registerWeapons:Core.registerWeapons,normalizeId,defaultWeaponId,create});

});
