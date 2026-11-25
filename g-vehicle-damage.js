/* HanQ vehicle component damage v1.0.0
 * Browser: window.HanQVehicleDamage
 * Node: require('./g-vehicle-damage.js')
 *
 * The game keeps hull HP on vehicle.hp. This module adds durable, serializable
 * subsystem state for mobility/control surfaces, engine/propulsion and fuel.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HanQVehicleDamage = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const SCHEMA = 'hanq.vehicle-components.v1';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = Number.isFinite;
  const lower = value => String(value == null ? '' : value).toLowerCase();

  const LABELS = Object.freeze({
    hull: '몸체',
    mobility: '동작부',
    engine: '동력부',
    fuel: '연료부'
  });

  const SOURCE_GROUPS = Object.freeze({
    small: new Set([
      'pistol', 'desert_eagle', 'smg', 'mp5', 'vector', 'p90', 'shotgun',
      'spas12', 'aa12', 'ar', 'ak47', 'famas', 'scar_h', 'm249', 'rpk', 'apc'
    ]),
    precision: new Set(['svd', 'sniper', 'awm', 'msr', 'dmr']),
    heavy: new Set(['minigun', 'plane', 'fighter', 'aircraft_gun', 'naval_gun', 'carrier_ciws', 'ciws', 'aa', 'flak']),
    explosive: new Set([
      'blast', 'rpg', 'm79', 'mortar', 'rocket', 'missile', 'bomb', 'shell',
      'torp', 'lancer_1', 'vehicle', 'grenade', 'tank', 'coast', 'boat'
    ]),
    collision: new Set(['collision', 'crash', 'impact', 'roadkill', 'ground_impact'])
  });

  const PART_TOKENS = Object.freeze({
    fuel: ['fuel', 'petrol', 'gas_tank', 'gastank', 'reservoir', 'fuelcell', 'fuel_cell'],
    engine: ['engine', 'motor', 'turbine', 'nacelle', 'intake', 'exhaust', 'powertrain', 'transmission'],
    mobility: [
      'wheel', 'tire', 'tyre', 'track', 'suspension', 'axle', 'wing', 'aileron',
      'elevator', 'rudder', 'rotor', 'propeller', 'prop', 'landing_gear', 'gear',
      'tailplane', 'stabilizer', 'control_surface'
    ],
    hull: ['hull', 'body', 'fuselage', 'chassis', 'cabin', 'cockpit', 'door', 'armor', 'armour']
  });

  function vehicleKind(vehicle) {
    return lower(vehicle && (vehicle.alliedKind || vehicle.kind || vehicle.type || vehicle.vehicleKind || vehicle.carKind));
  }

  function isAircraft(vehicle) {
    if (!vehicle) return false;
    const kind = vehicleKind(vehicle);
    if (/(plane|fighter|helicopter|heli|aircraft|jet)/.test(kind)) return true;
    return finite(vehicle.h) && finite(vehicle.pitch) && finite(vehicle.roll) && finite(vehicle.v) && !finite(vehicle.gy);
  }

  function isHelicopter(vehicle) {
    return /(helicopter|heli)/.test(vehicleKind(vehicle));
  }

  function isArmored(vehicle) {
    return /(tank|apc|armou?r|ifv|military)/.test(vehicleKind(vehicle));
  }

  function sourceGroup(source) {
    const id = lower(source && (source.type || source.kind || source.weapon || source.id || source));
    if (id === 'fuel_fire') return 'fuel_fire';
    for (const [group, values] of Object.entries(SOURCE_GROUPS)) {
      if (values.has(id)) return group;
    }
    if (/(missile|rocket|bomb|shell|mortar|grenade|blast|explos|torp)/.test(id)) return 'explosive';
    if (/(sniper|dmr|svd|awm|msr)/.test(id)) return 'precision';
    if (/(plane|fighter|aircraft|minigun|cannon|flak|aa)/.test(id)) return 'heavy';
    if (/(rifle|pistol|smg|shotgun|lmg|bullet|gun)/.test(id)) return 'small';
    if (/(collision|crash|impact|ram)/.test(id)) return 'collision';
    return 'generic';
  }

  function normalizePart(value) {
    const text = lower(value).replace(/[\s.-]+/g, '_');
    if (!text) return null;
    for (const part of ['fuel', 'engine', 'mobility', 'hull']) {
      if (text === part || PART_TOKENS[part].some(token => text.includes(token))) return part;
    }
    if (/(wheel|wing|rotor|prop|track|gear|rudder|aileron|elevator|tail)/.test(text)) return 'mobility';
    return null;
  }

  function explicitPart(hit) {
    if (!hit) return null;
    const candidates = [
      hit.vehiclePart, hit.hitboxPart, hit.part, hit.component, hit.zone,
      hit.vehicleHitName, hit.objectName, hit.meshName, hit.nodeName, hit.path
    ];
    for (const candidate of candidates) {
      const part = normalizePart(candidate);
      if (part) return part;
    }
    return null;
  }

  function geometryPart(vehicle, hit) {
    if (!vehicle || !hit || !finite(hit.x) || !finite(hit.y)) return 'hull';
    const aircraft = isAircraft(vehicle);
    const heli = isHelicopter(vehicle);
    const heading = finite(vehicle.heading) ? vehicle.heading : finite(vehicle.yaw) ? vehicle.yaw : 0;
    const dx = hit.x - (finite(vehicle.x) ? vehicle.x : 0);
    const dy = hit.y - (finite(vehicle.y) ? vehicle.y : 0);
    const forward = dx * Math.cos(heading) + dy * Math.sin(heading);
    const side = -dx * Math.sin(heading) + dy * Math.cos(heading);
    const halfLength = aircraft ? (heli ? 4.4 : 4.2) : Math.max(2.4, finite(vehicle.hitLength) ? vehicle.hitLength : finite(vehicle.westportLength) ? vehicle.westportLength * 0.5 : 3.0);
    const halfWidth = aircraft ? (heli ? 2.5 : 3.4) : Math.max(1.15, finite(vehicle.hitWidth) ? vehicle.hitWidth : 1.55);
    const f = forward / halfLength;
    const s = Math.abs(side) / halfWidth;

    let vertical = 0.5;
    if (finite(hit.h)) {
      if (aircraft && finite(vehicle.h)) vertical = (hit.h - (vehicle.h - 1.5)) / 3;
      else {
        const base = (finite(vehicle.gy) ? vehicle.gy : 0) + (finite(vehicle.altitude) ? vehicle.altitude : 0);
        const height = Math.max(1.2, finite(vehicle.hitHeight) ? vehicle.hitHeight : heli ? 3.2 : 1.8);
        vertical = (hit.h - base) / height;
      }
    }

    if (aircraft) {
      if (heli) {
        if (vertical > 0.82 || f < -0.62 || s > 0.82) return 'mobility';
        if (f > 0.42 || vertical > 0.58 && Math.abs(f) < 0.35) return 'engine';
        if (f < 0.18 && f > -0.48 && s < 0.48 && vertical < 0.65) return 'fuel';
        return 'hull';
      }
      if (s > 0.70 || f < -0.68) return 'mobility';
      if (f > 0.62) return 'engine';
      if (f < 0.25 && f > -0.45 && s < 0.43 && vertical < 0.68) return 'fuel';
      return 'hull';
    }

    if ((vertical < 0.58 && s > 0.58) || s > 0.82) return 'mobility';
    if (f > 0.53) return 'engine';
    if (f < -0.52 && vertical < 0.82) return 'fuel';
    return 'hull';
  }

  function classifyHit(vehicle, hit) {
    return explicitPart(hit) || geometryPart(vehicle, hit);
  }

  function capacities(vehicle) {
    const maxHp = Math.max(1, finite(vehicle && vehicle.maxHp) ? vehicle.maxHp : finite(vehicle && vehicle.hp) ? vehicle.hp : 100);
    if (isAircraft(vehicle)) {
      return {
        mobility: Math.max(52, maxHp * 0.28),
        engine: Math.max(42, maxHp * 0.22),
        fuel: Math.max(28, maxHp * 0.14)
      };
    }
    if (isArmored(vehicle)) {
      return {
        mobility: Math.max(80, maxHp * 0.26),
        engine: Math.max(70, maxHp * 0.22),
        fuel: Math.max(45, maxHp * 0.12)
      };
    }
    return {
      mobility: Math.max(42, maxHp * 0.23),
      engine: Math.max(36, maxHp * 0.20),
      fuel: Math.max(24, maxHp * 0.12)
    };
  }

  function ensureState(vehicle) {
    if (!vehicle || typeof vehicle !== 'object') throw new TypeError('vehicle is required');
    const caps = capacities(vehicle);
    let state = vehicle.componentDamage;
    if (!state || state.schema !== SCHEMA || state.version !== VERSION) {
      state = {
        schema: SCHEMA,
        version: VERSION,
        mobility: { hp: caps.mobility, max: caps.mobility },
        engine: { hp: caps.engine, max: caps.engine },
        fuel: { hp: caps.fuel, max: caps.fuel },
        leaking: false,
        burning: false,
        burnTime: 0,
        fireLimit: 0,
        lastPart: 'hull',
        lastSource: 'generic'
      };
      vehicle.componentDamage = state;
      return state;
    }
    for (const part of ['mobility', 'engine', 'fuel']) {
      if (!state[part] || !finite(state[part].hp) || !finite(state[part].max) || !(state[part].max > 0)) {
        state[part] = { hp: caps[part], max: caps[part] };
      } else {
        state[part].max = Math.max(1, state[part].max);
        state[part].hp = clamp(state[part].hp, 0, state[part].max);
      }
    }
    state.leaking = !!state.leaking;
    state.burning = !!state.burning;
    state.burnTime = finite(state.burnTime) ? Math.max(0, state.burnTime) : 0;
    state.fireLimit = finite(state.fireLimit) ? Math.max(0, state.fireLimit) : 0;
    return state;
  }

  function penetration(vehicle, group, part) {
    if (group === 'fuel_fire') return 1;
    if (group === 'generic' || group === 'collision') return 1;
    const aircraft = isAircraft(vehicle), armored = isArmored(vehicle);
    const table = armored ? {
      small: { hull: 0.035, mobility: 0.22, engine: 0.16, fuel: 0.25 },
      precision: { hull: 0.08, mobility: 0.35, engine: 0.25, fuel: 0.38 },
      heavy: { hull: 0.18, mobility: 0.50, engine: 0.38, fuel: 0.55 },
      explosive: { hull: 0.92, mobility: 1.05, engine: 1.00, fuel: 1.15 }
    } : aircraft ? {
      small: { hull: 0.055, mobility: 0.42, engine: 0.34, fuel: 0.62 },
      precision: { hull: 0.16, mobility: 0.62, engine: 0.55, fuel: 0.82 },
      heavy: { hull: 0.34, mobility: 0.82, engine: 0.72, fuel: 1.00 },
      explosive: { hull: 1.00, mobility: 1.15, engine: 1.10, fuel: 1.25 }
    } : {
      small: { hull: 0.15, mobility: 0.52, engine: 0.40, fuel: 0.68 },
      precision: { hull: 0.28, mobility: 0.75, engine: 0.62, fuel: 0.90 },
      heavy: { hull: 0.48, mobility: 0.95, engine: 0.82, fuel: 1.10 },
      explosive: { hull: 1.00, mobility: 1.18, engine: 1.12, fuel: 1.30 }
    };
    return (table[group] || table.heavy)[part] || 1;
  }

  function ignitionChance(group, fuelRatio, rawDamage, maxHp) {
    const severity = clamp(rawDamage / Math.max(30, maxHp * 0.18), 0, 1);
    const critical = clamp((0.45 - fuelRatio) / 0.45, 0, 1);
    if (group === 'small') return fuelRatio <= 0 ? 0.08 + severity * 0.05 : critical * (0.015 + severity * 0.025);
    if (group === 'precision') return fuelRatio <= 0 ? 0.18 + severity * 0.10 : critical * (0.05 + severity * 0.08);
    if (group === 'heavy') return fuelRatio <= 0 ? 0.32 + severity * 0.18 : critical * (0.10 + severity * 0.15);
    if (group === 'explosive') return fuelRatio <= 0 ? 0.72 + severity * 0.18 : 0.18 + critical * 0.45 + severity * 0.18;
    return 0;
  }

  function factors(vehicle) {
    const state = vehicle && vehicle.componentDamage;
    if (!state || state.schema !== SCHEMA || state.version !== VERSION) {
      return { mobility: 1, control: 1, engine: 1, fuel: 1, leaking: false, burning: false };
    }
    const ratio = part => clamp(state[part].hp / state[part].max, 0, 1);
    const mobilityRatio = ratio('mobility');
    const engineRatio = ratio('engine');
    const fuelRatio = ratio('fuel');
    if (isAircraft(vehicle)) {
      const control = 0.24 + 0.76 * Math.pow(mobilityRatio, 0.72);
      const engine = 0.34 + 0.66 * Math.pow(engineRatio, 0.68);
      const mobility = Math.min(engine, 0.46 + 0.54 * Math.pow(mobilityRatio, 0.70));
      return { mobility, control, engine, fuel: fuelRatio, leaking: !!state.leaking, burning: !!state.burning };
    }
    const control = 0.34 + 0.66 * Math.pow(mobilityRatio, 0.82);
    const engine = 0.30 + 0.70 * Math.pow(engineRatio, 0.74);
    const mobility = Math.min(engine, 0.38 + 0.62 * Math.pow(mobilityRatio, 0.85));
    return { mobility, control, engine, fuel: fuelRatio, leaking: !!state.leaking, burning: !!state.burning };
  }

  function applyHit(vehicle, amount, options) {
    options = options || {};
    const rawDamage = finite(amount) ? Math.max(0, amount) : 0;
    if (!vehicle || rawDamage <= 0) {
      return { part: 'hull', label: LABELS.hull, hullDamage: 0, componentDamage: 0, catastrophic: false, factors: factors(vehicle) };
    }
    const state = ensureState(vehicle);
    const group = sourceGroup(options.source);
    const part = normalizePart(options.part) || classifyHit(vehicle, options.hit);
    const before = part === 'hull' ? null : state[part].hp;
    const multiplier = penetration(vehicle, group, part);
    const componentDamage = rawDamage * multiplier;
    let hullDamage;

    if (part === 'hull' || group === 'fuel_fire') {
      hullDamage = componentDamage;
    } else {
      state[part].hp = Math.max(0, state[part].hp - componentDamage);
      const transfer = part === 'mobility' ? 0.09 : part === 'engine' ? 0.16 : 0.20;
      hullDamage = componentDamage * (group === 'explosive' ? transfer * 1.8 : transfer);
    }

    // Blast pressure reaches more than the visually closest component.
    if (group === 'explosive') {
      for (const secondary of ['mobility', 'engine', 'fuel']) {
        if (secondary === part) continue;
        const splash = rawDamage * penetration(vehicle, group, secondary) * (secondary === 'fuel' ? 0.16 : 0.12);
        state[secondary].hp = Math.max(0, state[secondary].hp - splash);
      }
    }

    const previousLeak = !!state.leaking;
    const previousBurn = !!state.burning;
    const fuelRatio = clamp(state.fuel.hp / state.fuel.max, 0, 1);
    if (fuelRatio < 0.55) state.leaking = true;

    let ignitedNow = false;
    let catastrophic = false;
    const random = typeof options.random === 'function' ? options.random : Math.random;
    if (part === 'fuel' || group === 'explosive') {
      const chance = ignitionChance(group, fuelRatio, rawDamage, Math.max(1, vehicle.maxHp || vehicle.hp || 100));
      if (!state.burning && chance > 0 && random() < chance) {
        state.burning = true;
        state.burnTime = 0;
        state.fireLimit = 2.8 + random() * 2.6;
        ignitedNow = true;
      }
      if (state.fuel.hp <= 0 && group === 'explosive' && rawDamage >= Math.max(35, (vehicle.maxHp || 100) * 0.12) && random() < 0.58) {
        catastrophic = true;
      }
    }

    state.lastPart = part;
    state.lastSource = lower(options.source || 'generic');
    const disabledNow = before > 0 && part !== 'hull' && state[part].hp <= 0;
    const result = {
      part,
      label: LABELS[part],
      sourceGroup: group,
      rawDamage,
      multiplier,
      hullDamage: Math.max(0, hullDamage),
      componentDamage: Math.max(0, componentDamage),
      componentHp: part === 'hull' ? null : state[part].hp,
      componentMax: part === 'hull' ? null : state[part].max,
      disabledNow,
      leakStarted: !previousLeak && state.leaking,
      ignitedNow: !previousBurn && state.burning && ignitedNow,
      leaking: state.leaking,
      burning: state.burning,
      catastrophic,
      factors: factors(vehicle)
    };
    return result;
  }

  function tick(vehicle, dt) {
    const state = vehicle && vehicle.componentDamage;
    const step = finite(dt) ? clamp(dt, 0, 0.25) : 0;
    if (!state || state.schema !== SCHEMA || !state.burning || step <= 0 || vehicle.dead) {
      return { damage: 0, catastrophic: false, burning: !!(state && state.burning), leaking: !!(state && state.leaking) };
    }
    state.burnTime += step;
    state.fuel.hp = Math.max(0, state.fuel.hp - state.fuel.max * 0.055 * step);
    const maxHp = Math.max(1, vehicle.maxHp || vehicle.hp || 100);
    const damage = Math.max(4.5, maxHp * (isAircraft(vehicle) ? 0.072 : 0.055)) * step;
    const limit = state.fireLimit > 0 ? state.fireLimit : 4.2;
    const catastrophic = state.burnTime >= limit;
    return { damage, catastrophic, burning: true, leaking: !!state.leaking, intensity: clamp(state.burnTime / limit, 0, 1) };
  }

  function inspect(vehicle) {
    const state = vehicle && vehicle.componentDamage;
    return {
      aircraft: isAircraft(vehicle),
      armored: isArmored(vehicle),
      state: state ? JSON.parse(JSON.stringify(state)) : null,
      factors: factors(vehicle)
    };
  }

  return Object.freeze({
    VERSION,
    SCHEMA,
    LABELS,
    isAircraft,
    isArmored,
    sourceGroup,
    normalizePart,
    classifyHit,
    ensureState,
    applyHit,
    factors,
    tick,
    inspect
  });
});
