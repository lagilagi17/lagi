'use strict';
// 궤도 수호자 (Orbit Guardian) — an original canvas arcade game for HanQ.
(() => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const section = $('game');
  const pane = $('pane-orbit');
  const view = { get hidden() { return section.hidden || pane.hidden; } };
  const stage = $('game-stage');

  // ---------- constants (logical units: the play field is 600×600, centered at 0,0) ----------
  const FIELD = 600;
  const HALF = FIELD / 2;
  const RING = 150;
  const CORE = 34;
  const PLAYER_R = 12;
  const SPAWN_R = 450; // beyond the corners, so things never pop in on screen
  const TAU = Math.PI * 2;
  const LEVEL_TIME = 18;
  // Physics: everything moves under the core's gravity (a = -MU/r², toward the centre). Meteors fall
  // and speed up on the way in; a sideways launch bends the fall instead of a curve out of nowhere.
  // Free objects on the ring (orbs, power-ups) orbit at the circular speed. Nothing changes speed or
  // direction without a force, and nothing passes through anything else.
  const MU = 450000;
  const ORBIT_W = Math.sqrt(MU / (RING * RING * RING)); // rad/s of a circular orbit at the ring
  const BRAKE = 0.5;        // the braking field's drag (1/s): a = -BRAKE·v while it is on
  const REVERSE_T = 0.12;   // seconds the guardian's thrusters need to stop and fly the other way

  const COLORS = {
    rock: '#5cc8ff', rockDeep: '#2563eb', spike: '#ff4d6d', orb: '#ffd166',
    player: '#e9e7ff', playerGlow: '#8b7bff', core: '#a78bfa', ring: '#7c6cff',
    slow: '#5eead4', heal: '#4ade80', double: '#fbbf24', guard: '#e0e7ff',
  };
  const POWERS = {
    slow: { label: 'S', color: COLORS.slow, name: '감속장' },
    heal: { label: '+', color: COLORS.heal, name: '코어 회복' },
    double: { label: '×2', color: COLORS.double, name: '점수 2배' },
    guard: { label: '◇', color: COLORS.guard, name: '보호막' },
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const fmt = n => Math.floor(n).toLocaleString('ko-KR');

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* optional */ } },
  };
  const stats = {
    best: parseInt(store.get('hanq-orbit-best', '0'), 10) || 0,
    plays: parseInt(store.get('hanq-orbit-plays', '0'), 10) || 0,
    blocked: parseInt(store.get('hanq-orbit-blocked', '0'), 10) || 0,
  };
  let muted = store.get('hanq-orbit-muted', '0') === '1';
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- audio (synthesised; no files needed) ----------
  let actx = null;
  let master = null;
  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        actx = new AC();
        master = actx.createGain();
        master.gain.value = muted ? 0 : 0.32;
        master.connect(actx.destination);
      } catch { actx = null; return null; }
    }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.25, slide = 1, delay = 0) {
    if (!actx || muted) return;
    const t = actx.currentTime + delay;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + dur + 0.03);
  }
  let noiseBuffer = null;
  function noise(dur, vol = 0.3, freq = 900) {
    if (!actx || muted) return;
    if (!noiseBuffer) {
      noiseBuffer = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = actx.currentTime;
    const src = actx.createBufferSource();
    const filter = actx.createBiquadFilter();
    const gain = actx.createGain();
    src.buffer = noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t); src.stop(t + dur);
  }
  const sfx = {
    block(combo) { const f = 440 * Math.pow(2, Math.min(combo, 16) / 12); tone(f, 0.14, 'triangle', 0.22, 1.5); noise(0.08, 0.08, 3000); },
    orb() { tone(988, 0.09, 'sine', 0.18); tone(1480, 0.16, 'sine', 0.15, 1, 0.06); },
    flip() { tone(260, 0.06, 'square', 0.04, 1.8); },
    coreHit() { noise(0.4, 0.45, 600); tone(130, 0.45, 'sawtooth', 0.18, 0.45); },
    absorb() { tone(200, 0.18, 'sine', 0.1, 0.55); },
    power() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.13, 'triangle', 0.15, 1, i * 0.055)); },
    level() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, 'square', 0.06, 1, i * 0.08)); },
    guardBreak() { tone(1200, 0.25, 'triangle', 0.15, 0.4); noise(0.2, 0.15, 2500); },
    over() { noise(1.1, 0.5, 400); tone(196, 1.1, 'sawtooth', 0.18, 0.3); },
    start() { [330, 494, 659].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, 1, i * 0.07)); },
  };

  // ---------- canvas sizing ----------
  let dpr = 1;
  let pixelSize = 600;
  function resize() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    pixelSize = Math.round(rect.width * dpr);
    if (canvas.width !== pixelSize) { canvas.width = pixelSize; canvas.height = pixelSize; }
    if (state !== 'playing') draw(0);
  }

  // Cached glow sprites (radial gradients are expensive to rebuild every frame).
  const glowCache = new Map();
  function glow(color) {
    const key = color;
    let sprite = glowCache.get(key);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = 128;
      const g = sprite.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, hexA(color, 0.9));
      grad.addColorStop(0.25, hexA(color, 0.45));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      glowCache.set(key, sprite);
    }
    return sprite;
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function drawGlow(color, x, y, radius) {
    ctx.drawImage(glow(color), x - radius, y - radius, radius * 2, radius * 2);
  }

  // ---------- background stars ----------
  const stars = [];
  for (let layer = 0; layer < 3; layer++) {
    const count = [70, 45, 22][layer];
    for (let i = 0; i < count; i++) {
      stars.push({ layer, a: rand(0, TAU), r: Math.sqrt(Math.random()) * 440, s: [0.8, 1.3, 2][layer], tw: rand(0, TAU), tws: rand(1, 3) });
    }
  }

  // ---------- game state ----------
  let state = 'ready'; // ready | playing | paused | dying | over
  let g = null;
  let ambientT = 0;

  function newGame() {
    g = {
      t: 0, score: 0, shown: 0, combo: 1, maxCombo: 1, level: 1, levelT: 0,
      hp: 3, maxHp: 5, angle: -Math.PI / 2, dir: 1, w: 2.05, blocked: 0,
      spawnT: 1.6, orbT: 3, powerT: rand(11, 15),
      meteors: [], orbs: [], powers: [], particles: [], texts: [], waves: [], trail: [],
      slow: 0, double: 0, guard: false, shake: 0, flash: 0, flashColor: '#ff4d6d',
      banner: { text: 'LEVEL 1', sub: '코어를 지켜라!', t: 0 }, dying: 0, reason: '',
    };
  }

  const playerSpeed = () => Math.min(3.35, 2.05 + (g.level - 1) * 0.11);
  const playerPos = () => ({ x: Math.cos(g.angle) * RING, y: Math.sin(g.angle) * RING });

  function rockShape() {
    const n = 7 + Math.floor(Math.random() * 3);
    return Array.from({ length: n }, (_, i) => ({ a: (i / n) * TAU + rand(-0.2, 0.2), r: rand(0.72, 1.08) }));
  }
  function spawnMeteor(angle, back = 0) {
    const lv = g.level;
    const spikeChance = Math.min(0.42, 0.1 + lv * 0.034);
    const kind = lv >= 2 && Math.random() < spikeChance ? 'spike' : 'rock';
    const size = kind === 'spike' ? 13 : rand(10, 15);
    const r0 = SPAWN_R + back;
    let a = angle ?? rand(0, TAU);
    // never appears inside another meteor
    for (let k = 0; k < 8 && g.meteors.some(o => Math.hypot(Math.cos(a) * r0 - o.x, Math.sin(a) * r0 - o.y) < o.size + size + 14); k++) a += 0.33;
    const v0 = Math.min(212, (rand(70, 96) + lv * 11) * 0.9) * (kind === 'spike' ? 1.08 : 1);
    // from level 4 some come in at an angle: their angular momentum makes gravity swing them round,
    // but never so much that they miss the core (closest approach inside it)
    let vt = 0;
    if (lv >= 4 && Math.random() < Math.min(0.6, 0.15 + (lv - 4) * 0.08)) {
      const rp = CORE * 0.85, E = v0 * v0 / 2 - MU / r0, Lmax = Math.sqrt(2 * rp * rp * (E + MU / rp));
      vt = (Lmax / r0) * rand(0.55, 0.95) * (Math.random() < 0.5 ? -1 : 1);
    }
    const vr = -Math.sqrt(Math.max(0, v0 * v0 - vt * vt)), ca = Math.cos(a), sa = Math.sin(a);
    g.meteors.push({
      kind, x: ca * r0, y: sa * r0, vx: ca * vr - sa * vt, vy: sa * vr + ca * vt, a, r: r0, size,
      rot: rand(0, TAU), spin: rand(-2.5, 2.5), shape: kind === 'rock' ? rockShape() : null,
    });
  }
  // gravity (+ the braking field's drag), semi-implicit Euler
  function moveMeteor(m, h, brake) {
    const r2 = m.x * m.x + m.y * m.y, k = MU / (r2 * Math.sqrt(r2));
    m.vx -= m.x * k * h; m.vy -= m.y * k * h;
    if (brake) { const f = Math.exp(-BRAKE * h); m.vx *= f; m.vy *= f; }
    m.x += m.vx * h; m.y += m.vy * h;
    m.r = Math.hypot(m.x, m.y); m.a = Math.atan2(m.y, m.x);
    m.rot += m.spin * h;
  }
  // where (and in how long) a meteor will cross the guardian's ring, following the same physics
  function ringCrossing(m) {
    const q = { x: m.x, y: m.y, vx: m.vx, vy: m.vy, spin: 0, rot: 0 };
    let t = 0, slow = g.slow;
    for (let i = 0; i < 360; i++) {
      if (Math.hypot(q.x, q.y) <= RING) return { a: Math.atan2(q.y, q.x), eta: t };
      moveMeteor(q, 1 / 60, slow > 0);
      slow -= 1 / 60; t += 1 / 60;
    }
    return null;
  }
  function spawnWave() {
    const lv = g.level;
    const roll = Math.random();
    if (lv >= 3 && roll < Math.min(0.32, 0.08 + lv * 0.025)) {
      // a fan of meteors from one side
      const base = rand(0, TAU);
      const n = lv >= 6 ? 3 : 2;
      for (let i = 0; i < n; i++) spawnMeteor(base + (i - (n - 1) / 2) * 0.42, i * 48);
    } else {
      spawnMeteor();
    }
  }
  function spawnOrb() {
    let a;
    for (let i = 0; i < 8; i++) { a = rand(0, TAU); if (Math.abs(angDiff(a, g.angle)) > 1) break; }
    g.orbs.push({ a, life: 7, max: 7, t: 0 });
  }
  function spawnPower() {
    const kinds = ['slow', 'double', 'guard'];
    if (g.hp < g.maxHp) kinds.push('heal', 'heal');
    const type = kinds[Math.floor(Math.random() * kinds.length)];
    let a;
    for (let i = 0; i < 8; i++) { a = rand(0, TAU); if (Math.abs(angDiff(a, g.angle)) > 1.4) break; }
    g.powers.push({ type, a, life: 8, max: 8, t: 0 });
  }

  // ---------- effects ----------
  function burst(x, y, color, count, speed, life = 0.7, size = 3) {
    if (g.particles.length > 600) g.particles.splice(0, count);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = speed * 0.5 * rand(0.25, 1);
      g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.6, 1), max: life, size: size * rand(0.6, 1.3), color });
    }
  }
  function floatText(x, y, text, color, size = 18) { g.texts.push({ x, y, text, color, size, t: 0 }); }
  function shockwave(x, y, color, max = 60, width = 3) { g.waves.push({ x, y, color, r: 4, max, width, t: 0 }); }
  function shake(amount) { if (!reducedMotion) g.shake = Math.max(g.shake, amount); }
  function addScore(points) { g.score += points * (g.double > 0 ? 2 : 1); }

  // ---------- update ----------
  function update(dt) {
    ambientT += dt;
    if (state !== 'playing' && state !== 'dying') { if (g) updateEffects(dt); return; }

    if (state === 'dying') {
      g.dying -= dt;
      updateEffects(dt * 0.6);
      // the last moments replay in slow motion: the same motion on a slower clock
      for (const m of g.meteors) moveMeteor(m, dt * 0.15, false);
      if (g.dying <= 0) finishGame();
      return;
    }

    g.t += dt;
    g.slow = Math.max(0, g.slow - dt);
    g.double = Math.max(0, g.double - dt);

    // level progression
    g.levelT += dt;
    if (g.levelT >= LEVEL_TIME) {
      g.levelT = 0;
      g.level++;
      addScore(50 * g.level);
      const subs = ['빨간 가시 등장!', '운석이 빨라져요', '비스듬히 날아드는 운석!', '집중하세요', '한계를 넘어서!'];
      g.banner = { text: `LEVEL ${g.level}`, sub: subs[Math.min(g.level - 2, subs.length - 1)], t: 0 };
      sfx.level();
      shockwave(0, 0, COLORS.ring, RING + 40, 4);
    }

    // spawning (fewer arrivals while the braking field is up)
    g.spawnT -= dt * (g.slow > 0 ? 0.45 : 1);
    if (g.spawnT <= 0) {
      spawnWave();
      const interval = Math.max(0.36, 1.45 - (g.level - 1) * 0.1);
      g.spawnT = interval * rand(0.75, 1.25);
    }
    g.orbT -= dt;
    if (g.orbT <= 0) { spawnOrb(); g.orbT = rand(3.2, 5.5); }
    g.powerT -= dt;
    if (g.powerT <= 0) { spawnPower(); g.powerT = rand(13, 19); }

    // physics in short steps: nothing moves more than ~5 units between collision checks, so the
    // guardian can't skip over a meteor or an orb on a slow frame
    let fastest = 0;
    for (const m of g.meteors) fastest = Math.max(fastest, Math.hypot(m.vx, m.vy));
    const steps = Math.min(24, Math.max(1, Math.ceil(((fastest + playerSpeed() * RING) * dt) / 5)));
    for (let k = 0; k < steps; k++) if (step(dt / steps)) return;
    const p = playerPos();
    g.trail.push({ x: p.x, y: p.y });
    if (g.trail.length > 16) g.trail.shift();

    updateEffects(dt);
  }

  // one physics step of h seconds; true when the game ended
  function step(h) {
    // the guardian: its thrusters turn it round at a finite rate (a flip takes REVERSE_T)
    const ps = playerSpeed(), acc = (2 * ps) / REVERSE_T;
    g.w += clamp(g.dir * ps - g.w, -acc * h, acc * h);
    g.angle = (g.angle + g.w * h) % TAU;
    const p = playerPos();

    // meteors
    for (let i = g.meteors.length - 1; i >= 0; i--) {
      const m = g.meteors[i];
      moveMeteor(m, h, g.slow > 0);
      const mx = m.x, my = m.y;

      if (Math.hypot(mx - p.x, my - p.y) < m.size + PLAYER_R) {
        g.meteors.splice(i, 1);
        if (m.kind === 'rock') {
          const gained = 10 * g.combo;
          addScore(gained);
          g.blocked++;
          sfx.block(g.combo);
          g.combo = Math.min(99, g.combo + 1);
          g.maxCombo = Math.max(g.maxCombo, g.combo);
          burst(mx, my, COLORS.rock, 22, 260, 0.6, 3.2);
          burst(mx, my, '#ffffff', 8, 140, 0.4, 2);
          shockwave(mx, my, COLORS.rock, 46, 3);
          floatText(mx, my - 14, `+${gained * (g.double > 0 ? 2 : 1)}`, g.double > 0 ? COLORS.double : '#cfe9ff', 17 + Math.min(g.combo, 20) * 0.4);
          shake(3);
        } else if (g.guard) {
          g.guard = false;
          sfx.guardBreak();
          burst(mx, my, COLORS.spike, 26, 280, 0.6, 3);
          burst(p.x, p.y, COLORS.guard, 20, 200, 0.5, 2.5);
          shockwave(p.x, p.y, COLORS.guard, 70, 4);
          floatText(p.x, p.y - 22, '보호막!', COLORS.guard, 18);
          shake(6);
        } else {
          die(mx, my, '빨간 가시에 부딪혔어요');
          return true;
        }
        continue;
      }

      if (m.r <= CORE + m.size * 0.6) {
        g.meteors.splice(i, 1);
        if (m.kind === 'rock') {
          g.hp--;
          g.combo = 1;
          g.flash = 0.35; g.flashColor = COLORS.spike;
          sfx.coreHit();
          burst(mx, my, COLORS.spike, 30, 300, 0.8, 3.5);
          burst(mx, my, COLORS.rock, 16, 200, 0.6, 3);
          shockwave(0, 0, COLORS.spike, 120, 5);
          floatText(0, -CORE - 28, '코어 손상!', '#ff8fa3', 18);
          shake(12);
          if (g.hp <= 0) { die(0, 0, '코어가 파괴됐어요'); return true; }
        } else {
          sfx.absorb();
          burst(mx, my, '#c4b5fd', 10, 120, 0.5, 2.5);
          shockwave(0, 0, '#c4b5fd', CORE + 18, 2);
        }
      }
    }

    // two meteors that meet break each other up instead of passing through
    collideMeteors();

    // orbs and power-ups orbit the core at the ring's circular speed
    for (let i = g.orbs.length - 1; i >= 0; i--) {
      const o = g.orbs[i];
      o.a += ORBIT_W * h; o.life -= h; o.t += h;
      const ox = Math.cos(o.a) * RING, oy = Math.sin(o.a) * RING;
      if (Math.hypot(ox - p.x, oy - p.y) < PLAYER_R + 11) {
        g.orbs.splice(i, 1);
        const gained = 25 * g.combo;
        addScore(gained);
        g.combo = Math.min(99, g.combo + 1);
        g.maxCombo = Math.max(g.maxCombo, g.combo);
        sfx.orb();
        burst(ox, oy, COLORS.orb, 18, 200, 0.6, 2.8);
        shockwave(ox, oy, COLORS.orb, 40, 2);
        floatText(ox, oy - 16, `+${gained * (g.double > 0 ? 2 : 1)}`, COLORS.orb, 18);
      } else if (o.life <= 0) {
        g.orbs.splice(i, 1);
        burst(ox, oy, COLORS.orb, 6, 60, 0.4, 2);
      }
    }

    // power-ups
    for (let i = g.powers.length - 1; i >= 0; i--) {
      const pw = g.powers[i];
      pw.a += ORBIT_W * h; pw.life -= h; pw.t += h;
      const x = Math.cos(pw.a) * RING, y = Math.sin(pw.a) * RING;
      if (Math.hypot(x - p.x, y - p.y) < PLAYER_R + 14) {
        g.powers.splice(i, 1);
        const def = POWERS[pw.type];
        if (pw.type === 'slow') g.slow = 5;
        if (pw.type === 'double') g.double = 8;
        if (pw.type === 'guard') g.guard = true;
        if (pw.type === 'heal') { g.hp = Math.min(g.maxHp, g.hp + 1); shockwave(0, 0, COLORS.heal, CORE + 30, 3); }
        sfx.power();
        burst(x, y, def.color, 26, 230, 0.7, 3);
        shockwave(x, y, def.color, 60, 3);
        floatText(x, y - 20, def.name, def.color, 18);
      } else if (pw.life <= 0) {
        g.powers.splice(i, 1);
      }
    }

    return false;
  }

  function collideMeteors() {
    const ms = g.meteors;
    for (let i = ms.length - 1; i > 0; i--) {
      for (let j = i - 1; j >= 0; j--) {
        const a = ms[i], b = ms[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) >= (a.size + b.size) * 0.85) continue;
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        burst(x, y, a.kind === 'rock' ? COLORS.rock : COLORS.spike, 14, 220, 0.55, 2.8);
        burst(x, y, b.kind === 'rock' ? COLORS.rock : COLORS.spike, 14, 220, 0.55, 2.8);
        shockwave(x, y, '#ffffff', 34, 2);
        noise(0.12, 0.12, 1800);
        ms.splice(i, 1); ms.splice(j, 1);
        i--;
        break;
      }
    }
  }

  function updateEffects(dt) {
    for (let i = g.particles.length - 1; i >= 0; i--) {
      const q = g.particles[i];
      q.life -= dt;
      if (q.life <= 0) { g.particles.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    for (let i = g.texts.length - 1; i >= 0; i--) { const t = g.texts[i]; t.t += dt; t.y -= 34 * dt; if (t.t > 0.9) g.texts.splice(i, 1); }
    for (let i = g.waves.length - 1; i >= 0; i--) { const w = g.waves[i]; w.t += dt; w.r += (w.max - w.r) * Math.min(1, dt * 9); if (w.t > 0.5) g.waves.splice(i, 1); }
    if (g.banner) { g.banner.t += dt; if (g.banner.t > 2.2) g.banner = null; }
    g.shake = Math.max(0, g.shake - dt * 30);
    g.flash = Math.max(0, g.flash - dt);
  }

  // ---------- drawing ----------
  function draw(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const scale = pixelSize / FIELD;
    let sx = 0, sy = 0;
    if (g && g.shake > 0) { sx = rand(-g.shake, g.shake); sy = rand(-g.shake, g.shake); }
    ctx.setTransform(scale, 0, 0, scale, (HALF + sx) * scale, (HALF + sy) * scale);

    drawBackground();
    const t = ambientT;

    // orbit ring
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(124,108,255,0.28)';
    ctx.beginPath(); ctx.arc(0, 0, RING, 0, TAU); ctx.stroke();
    ctx.setLineDash([3, 10]);
    ctx.lineDashOffset = -t * 12;
    ctx.strokeStyle = 'rgba(167,139,250,0.18)';
    ctx.beginPath(); ctx.arc(0, 0, RING + 22, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, RING - 22, 0, TAU); ctx.stroke();
    ctx.restore();

    if (g) {
      ctx.globalCompositeOperation = 'lighter';
      // crossing markers: where each incoming rock will cut the ring
      for (const m of g.meteors) {
        if (m.r <= RING) continue;
        const cross = ringCrossing(m);
        if (!cross) continue;
        const eta = cross.eta, ca = cross.a;
        const urgency = clamp(1 - eta / 3, 0, 1);
        const color = m.kind === 'rock' ? COLORS.rock : COLORS.spike;
        ctx.globalAlpha = 0.15 + urgency * 0.6;
        ctx.strokeStyle = color;
        ctx.lineWidth = m.kind === 'rock' ? 4 : 2;
        ctx.lineCap = 'round';
        const span = (m.size / RING) * (m.kind === 'rock' ? 1.6 : 1.1);
        ctx.beginPath(); ctx.arc(0, 0, RING, ca - span, ca + span); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // shockwaves
      for (const w of g.waves) {
        ctx.globalAlpha = Math.max(0, 1 - w.t / 0.5);
        ctx.strokeStyle = w.color;
        ctx.lineWidth = w.width;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    drawCore(t);

    if (g) {
      // orbs
      for (const o of g.orbs) {
        const x = Math.cos(o.a) * RING, y = Math.sin(o.a) * RING;
        const blink = o.life < 1.6 ? (Math.sin(o.t * 22) > 0 ? 1 : 0.35) : 1;
        const pop = Math.min(1, o.t * 5);
        ctx.globalAlpha = blink;
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(COLORS.orb, x, y, 30 * pop);
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.translate(x, y); ctx.rotate(o.t * 2.4); ctx.scale(pop, pop);
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const rr = i % 2 ? 3.6 : 9;
          const aa = (i / 8) * TAU;
          ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // power-ups
      for (const pw of g.powers) {
        const def = POWERS[pw.type];
        const x = Math.cos(pw.a) * RING, y = Math.sin(pw.a) * RING;
        const blink = pw.life < 2 ? (Math.sin(pw.t * 20) > 0 ? 1 : 0.35) : 1;
        const bob = 1 + Math.sin(pw.t * 5) * 0.08;
        const pop = Math.min(1, pw.t * 4) * bob;
        ctx.globalAlpha = blink;
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(def.color, x, y, 36 * pop);
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.translate(x, y); ctx.scale(pop, pop);
        ctx.fillStyle = 'rgba(12,10,36,0.9)';
        ctx.strokeStyle = def.color; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.rotate(pw.t * 1.5);
        ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.rotate(-pw.t * 1.5);
        ctx.fillStyle = def.color;
        ctx.font = `800 ${def.label.length > 1 ? 11 : 15}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(def.label, 0, 1);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // meteors
      for (const m of g.meteors) drawMeteor(m);

      // player
      if (state !== 'dying' && state !== 'over') drawPlayer(t);

      // particles
      ctx.globalCompositeOperation = 'lighter';
      for (const q of g.particles) {
        const k = q.life / q.max;
        ctx.globalAlpha = k;
        ctx.fillStyle = q.color;
        const s = q.size * (0.4 + k * 0.6);
        ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // floating text
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const tx of g.texts) {
        const k = tx.t / 0.9;
        ctx.globalAlpha = 1 - k * k;
        const s = tx.size * (k < 0.15 ? 0.7 + k * 2 : 1);
        ctx.font = `800 ${s}px system-ui, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(8,6,28,0.65)';
        ctx.strokeText(tx.text, tx.x, tx.y);
        ctx.fillStyle = tx.color;
        ctx.fillText(tx.text, tx.x, tx.y);
      }
      ctx.globalAlpha = 1;

      if (state === 'playing' || state === 'paused') drawActiveEffects();
      if (g.banner && (state === 'playing' || state === 'paused')) drawBanner();

      if (g.slow > 0 && (state === 'playing' || state === 'paused')) {
        ctx.globalAlpha = Math.min(1, g.slow) * 0.16;
        ctx.strokeStyle = COLORS.slow; ctx.lineWidth = 26;
        ctx.strokeRect(-HALF, -HALF, FIELD, FIELD);
        ctx.globalAlpha = 1;
      }
      if (g.flash > 0) {
        ctx.globalAlpha = g.flash * 0.6;
        ctx.fillStyle = g.flashColor;
        ctx.fillRect(-HALF - 20, -HALF - 20, FIELD + 40, FIELD + 40);
        ctx.globalAlpha = 1;
      }
    }
  }

  let bgGradient = null;
  function drawBackground() {
    if (!bgGradient) {
      bgGradient = ctx.createRadialGradient(0, 0, 20, 0, 0, 430);
      bgGradient.addColorStop(0, '#1b1446');
      bgGradient.addColorStop(0.45, '#0f0c2c');
      bgGradient.addColorStop(1, '#06061a');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(-HALF - 20, -HALF - 20, FIELD + 40, FIELD + 40);

    // drifting nebulae
    ctx.globalCompositeOperation = 'lighter';
    const t = ambientT;
    ctx.globalAlpha = 0.35;
    drawGlow('#7c3aed', Math.cos(t * 0.05) * 160 - 60, Math.sin(t * 0.04) * 120 - 90, 260);
    drawGlow('#0ea5e9', Math.cos(t * 0.04 + 2) * 170 + 80, Math.sin(t * 0.05 + 1) * 130 + 110, 230);
    ctx.globalAlpha = 1;

    // stars (each layer rotates at its own speed for parallax)
    for (const s of stars) {
      const a = s.a + t * (0.006 + s.layer * 0.006);
      const x = Math.cos(a) * s.r, y = Math.sin(a) * s.r;
      if (Math.abs(x) > HALF + 4 || Math.abs(y) > HALF + 4) continue;
      ctx.globalAlpha = (0.35 + s.layer * 0.2) * (0.6 + 0.4 * Math.sin(t * s.tws + s.tw));
      ctx.fillStyle = s.layer === 2 ? '#e0e7ff' : '#a5b4fc';
      ctx.fillRect(x, y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawCore(t) {
    const hp = g ? g.hp : 3;
    const maxHp = g ? g.maxHp : 5;
    const danger = g && hp === 1 && (state === 'playing' || state === 'paused');
    const pulse = 1 + Math.sin(t * (danger ? 9 : 2.4)) * 0.05;
    const color = danger ? COLORS.spike : COLORS.core;

    ctx.globalCompositeOperation = 'lighter';
    drawGlow(color, 0, 0, 92 * pulse);
    ctx.globalCompositeOperation = 'source-over';

    const grad = ctx.createRadialGradient(-8, -10, 2, 0, 0, CORE);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, danger ? '#ffb3c1' : '#ddd6fe');
    grad.addColorStop(1, danger ? '#be123c' : '#6d28d9');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, CORE * pulse, 0, TAU); ctx.fill();

    // rotating inner rings
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.rotate(t * 0.8);
    ctx.beginPath(); ctx.ellipse(0, 0, CORE * 0.62, CORE * 0.24, 0, 0, TAU); ctx.stroke();
    ctx.rotate(t * -1.7);
    ctx.beginPath(); ctx.ellipse(0, 0, CORE * 0.62, CORE * 0.24, 1.1, 0, TAU); ctx.stroke();
    ctx.restore();

    // HP segments
    const gap = 0.12;
    const seg = TAU / maxHp;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < maxHp; i++) {
      const start = -Math.PI / 2 + i * seg + gap / 2;
      ctx.strokeStyle = i < hp ? (danger ? COLORS.spike : '#c4b5fd') : 'rgba(196,181,253,0.14)';
      ctx.beginPath(); ctx.arc(0, 0, CORE + 13, start, start + seg - gap); ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  function drawMeteor(m) {
    const x = Math.cos(m.a) * m.r, y = Math.sin(m.a) * m.r;
    const visible = Math.abs(x) < HALF + m.size && Math.abs(y) < HALF + m.size;
    if (!visible) {
      // edge indicator
      const ex = clamp(x, -HALF + 12, HALF - 12), ey = clamp(y, -HALF + 12, HALF - 12);
      const dist = Math.hypot(x - ex, y - ey);
      const alpha = clamp(1 - dist / 150, 0.15, 1);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(Math.atan2(m.vy, m.vx));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = m.kind === 'rock' ? COLORS.rock : COLORS.spike;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -7); ctx.lineTo(-3, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    const color = m.kind === 'rock' ? COLORS.rock : COLORS.spike;
    // tail pointing away from the core
    ctx.globalCompositeOperation = 'lighter';
    const sp = Math.hypot(m.vx, m.vy) || 1, tx = -m.vx / sp, ty = -m.vy / sp;
    const tail = ctx.createLinearGradient(x, y, x + tx * m.size * 5, y + ty * m.size * 5);
    tail.addColorStop(0, hexA(color, 0.5));
    tail.addColorStop(1, hexA(color, 0));
    ctx.strokeStyle = tail;
    ctx.lineWidth = m.size * 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + tx * m.size * 5, y + ty * m.size * 5); ctx.stroke();
    ctx.lineCap = 'butt';
    drawGlow(color, x, y, m.size * 3.2);
    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(m.rot);
    if (m.kind === 'rock') {
      ctx.fillStyle = '#1e3a8a';
      ctx.strokeStyle = '#93e1ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      m.shape.forEach((v, i) => {
        const px = Math.cos(v.a) * v.r * m.size, py = Math.sin(v.a) * v.r * m.size;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(147,225,255,0.35)';
      ctx.beginPath(); ctx.arc(-m.size * 0.25, -m.size * 0.2, m.size * 0.28, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#3b0a18';
      ctx.strokeStyle = '#ff8fa3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const spikes = 7;
      for (let i = 0; i < spikes * 2; i++) {
        const rr = i % 2 ? m.size * 0.5 : m.size * 1.15;
        const aa = (i / (spikes * 2)) * TAU;
        ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.arc(0, 0, m.size * 0.28, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(t) {
    const p = playerPos();
    ctx.globalCompositeOperation = 'lighter';
    // trail
    for (let i = 0; i < g.trail.length; i++) {
      const k = i / g.trail.length;
      ctx.globalAlpha = k * 0.5;
      ctx.fillStyle = g.double > 0 ? COLORS.double : COLORS.playerGlow;
      ctx.beginPath(); ctx.arc(g.trail[i].x, g.trail[i].y, PLAYER_R * (0.3 + k * 0.6), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawGlow(g.double > 0 ? COLORS.double : COLORS.playerGlow, p.x, p.y, 42);
    ctx.globalCompositeOperation = 'source-over';

    // body
    ctx.fillStyle = COLORS.player;
    ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R, 0, TAU); ctx.fill();
    ctx.fillStyle = g.double > 0 ? COLORS.double : '#8b7bff';
    ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R * 0.48, 0, TAU); ctx.fill();

    // direction chevron
    const ahead = g.angle + g.dir * 0.17;
    const hx = Math.cos(ahead) * RING, hy = Math.sin(ahead) * RING;
    const heading = g.angle + g.dir * Math.PI / 2;
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(heading);
    ctx.fillStyle = 'rgba(233,231,255,0.85)';
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-3, -5); ctx.lineTo(-1, 0); ctx.lineTo(-3, 5); ctx.closePath(); ctx.fill();
    ctx.restore();

    if (g.guard) {
      ctx.strokeStyle = 'rgba(224,231,255,0.85)';
      ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(t * 2);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const aa = (i / 6) * TAU; ctx.lineTo(Math.cos(aa) * 21, Math.sin(aa) * 21); }
      ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
  }

  function drawActiveEffects() {
    const items = [];
    if (g.slow > 0) items.push({ ...POWERS.slow, left: g.slow, max: 5 });
    if (g.double > 0) items.push({ ...POWERS.double, left: g.double, max: 8 });
    if (g.guard) items.push({ ...POWERS.guard, left: 1, max: 1 });
    items.forEach((it, i) => {
      const x = -HALF + 26 + i * 40, y = HALF - 26;
      ctx.fillStyle = 'rgba(12,10,36,0.75)';
      ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
      ctx.strokeStyle = it.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 15, -Math.PI / 2, -Math.PI / 2 + TAU * (it.left / it.max)); ctx.stroke();
      ctx.fillStyle = it.color;
      ctx.font = `800 ${it.label.length > 1 ? 10 : 13}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(it.label, x, y + 1);
    });
  }

  function drawBanner() {
    const b = g.banner;
    const inK = Math.min(1, b.t / 0.3);
    const outK = b.t > 1.7 ? 1 - (b.t - 1.7) / 0.5 : 1;
    const alpha = Math.max(0, inK * outK);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const y = -HALF + 92 - (1 - inK) * 16;
    ctx.font = '900 40px system-ui, sans-serif';
    const grad = ctx.createLinearGradient(-110, 0, 110, 0);
    grad.addColorStop(0, '#a5b4fc'); grad.addColorStop(0.5, '#ffffff'); grad.addColorStop(1, '#f0abfc');
    ctx.fillStyle = grad;
    ctx.fillText(b.text, 0, y);
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(224,231,255,0.8)';
    ctx.fillText(b.sub, 0, y + 32);
    ctx.globalAlpha = 1;
  }

  // ---------- HUD ----------
  const hud = { score: $('g-score'), combo: $('g-combo'), level: $('g-level'), best: $('g-best') };
  const last = {};
  function setText(el, key, value) { if (last[key] !== value) { last[key] = value; el.textContent = value; } }
  function updateHud(dt) {
    if (g) {
      g.shown += (g.score - g.shown) * Math.min(1, dt * 12);
      if (Math.abs(g.score - g.shown) < 1) g.shown = g.score;
      setText(hud.score, 'score', fmt(g.shown));
      setText(hud.combo, 'combo', `x${g.combo}`);
      setText(hud.level, 'level', String(g.level));
    }
    setText(hud.best, 'best', fmt(Math.max(stats.best, g && state !== 'over' ? g.score : 0)));
    hud.combo.classList.toggle('hot', !!g && g.combo >= 8);
  }
  function updateRecords() {
    $('rec-best').textContent = fmt(stats.best);
    $('rec-plays').textContent = fmt(stats.plays);
    $('rec-blocked').textContent = fmt(stats.blocked);
  }

  // ---------- overlays & flow ----------
  const overlay = $('game-overlay');
  const panels = { start: $('ov-start'), pause: $('ov-pause'), over: $('ov-over') };
  function showPanel(name) {
    overlay.hidden = !name;
    for (const [key, el] of Object.entries(panels)) el.hidden = key !== name;
    const button = name && panels[name].querySelector('.button-primary');
    if (button && !view.hidden) setTimeout(() => button.focus({ preventScroll: true }), 30);
    $('g-pause').disabled = state !== 'playing';
  }

  function start() {
    audio();
    newGame();
    state = 'playing';
    stats.plays++;
    store.set('hanq-orbit-plays', stats.plays);
    showPanel(null);
    sfx.start();
    canvas.focus({ preventScroll: true });
    kick();
  }
  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    showPanel('pause');
  }
  function resume() {
    if (state !== 'paused') return;
    audio();
    state = 'playing';
    showPanel(null);
    canvas.focus({ preventScroll: true });
    kick();
  }
  function die(x, y, reason) {
    state = 'dying';
    g.dying = 1.3;
    g.reason = reason;
    g.flash = 0.5; g.flashColor = '#ffffff';
    sfx.over();
    const p = playerPos();
    burst(p.x, p.y, COLORS.playerGlow, 50, 380, 1.2, 4);
    burst(x, y, COLORS.spike, 40, 340, 1.2, 4);
    if (reason.startsWith('코어')) burst(0, 0, COLORS.core, 80, 420, 1.4, 4.5);
    shockwave(x, y, '#ffffff', 200, 6);
    shake(18);
    $('g-pause').disabled = true;
  }
  function finishGame() {
    state = 'over';
    const score = Math.floor(g.score);
    const isRecord = score > stats.best;
    if (isRecord) { stats.best = score; store.set('hanq-orbit-best', score); }
    stats.blocked += g.blocked;
    store.set('hanq-orbit-blocked', stats.blocked);
    updateRecords();
    $('ov-reason').textContent = g.reason;
    $('ov-score').textContent = fmt(score);
    $('ov-level').textContent = String(g.level);
    $('ov-combo').textContent = `x${g.maxCombo}`;
    $('ov-blocked').textContent = fmt(g.blocked);
    $('ov-time').textContent = `${Math.floor(g.t)}초`;
    $('ov-record').hidden = !isRecord || score === 0;
    showPanel('over');
  }

  function flip(dir) {
    if (state !== 'playing') return;
    const next = dir ?? -g.dir;
    if (next === g.dir) return;
    g.dir = next;
    sfx.flip();
    const p = playerPos();
    burst(p.x, p.y, '#c7d2fe', 6, 120, 0.3, 2);
  }

  // ---------- input ----------
  canvas.tabIndex = 0;
  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    audio();
    if (state === 'playing') flip();
  });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  document.addEventListener('keydown', event => {
    if (view.hidden || !document.documentElement.classList.contains('unlocked')) return;
    if (event.target && /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    const onButton = event.target && event.target.tagName === 'BUTTON' && event.target !== canvas;
    if (key === ' ' || key === 'Spacebar') {
      if (onButton && state !== 'playing') return; // let Space activate the focused button
      event.preventDefault();
      if (state === 'playing') flip();
      else if (state === 'paused') resume();
      else if (state === 'ready' || state === 'over') start();
    } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      if (state === 'playing') { event.preventDefault(); flip(-1); }
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      if (state === 'playing') { event.preventDefault(); flip(1); }
    } else if (key === 'p' || key === 'P' || key === 'Escape') {
      if (state === 'playing') { event.preventDefault(); pause(); }
      else if (state === 'paused' && key !== 'Escape') { event.preventDefault(); resume(); }
    } else if (key === 'Enter' && !onButton) {
      if (state === 'ready' || state === 'over') { event.preventDefault(); start(); }
    }
  });

  $('game-start').addEventListener('click', start);
  $('game-retry').addEventListener('click', start);
  $('game-resume').addEventListener('click', resume);
  $('game-restart').addEventListener('click', start);
  $('g-pause').addEventListener('click', () => (state === 'playing' ? pause() : resume()));

  const muteButton = $('g-mute');
  function syncMute() {
    muteButton.setAttribute('aria-pressed', String(muted));
    muteButton.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
    muteButton.classList.toggle('muted', muted);
    if (master) master.gain.value = muted ? 0 : 0.32;
  }
  muteButton.addEventListener('click', () => {
    muted = !muted;
    store.set('hanq-orbit-muted', muted ? '1' : '0');
    audio();
    syncMute();
  });

  // Pause automatically whenever the game is not visible.
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  document.addEventListener('hanq:lock', pause);
  document.addEventListener('hanq:tab', event => {
    if (event.detail !== 'game') pause();
    else { requestAnimationFrame(resize); kick(); }
  });
  document.addEventListener('hanq:game', event => {
    if (event.detail !== 'orbit') pause();
    else { requestAnimationFrame(resize); kick(); }
  });

  // ---------- main loop ----------
  let raf = 0;
  let lastTime = 0;
  function frame(now) {
    raf = 0;
    if (view.hidden || document.hidden) { lastTime = 0; return; }
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
    lastTime = now;
    if (state !== 'paused') update(dt);
    draw(dt);
    updateHud(dt);
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !view.hidden) { lastTime = 0; raf = requestAnimationFrame(frame); } }

  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  syncMute();
  updateRecords();
  updateHud(0);
  showPanel('start');
  resize();
  kick();
})();
