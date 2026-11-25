'use strict';
// 젤리 점프 (Jelly Jump) — an original one-thumb slingshot climber for HanQ.
(() => {
  const canvas = document.getElementById('jelly-canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const section = $('game');
  const pane = $('pane-jelly');
  const stage = $('jelly-stage');
  const isHidden = () => section.hidden || pane.hidden;

  // ---------- world constants (logical 400 × 667, y grows downward) ----------
  const W = 400;
  const H = 667;
  const G = 1900;
  const R = 17;
  const MAX_PULL = 165;
  const MIN_V = 330;
  const MAX_V = 1230;
  const SPRING_V = 1480;
  const PX_PER_M = 20;
  const START_Y = 560;
  const TAU = Math.PI * 2;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = n => Math.floor(n).toLocaleString('ko-KR');
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* optional */ } },
  };
  const rec = {
    best: parseInt(store.get('hanq-jelly-best', '0'), 10) || 0,
    height: parseInt(store.get('hanq-jelly-height', '0'), 10) || 0,
    plays: parseInt(store.get('hanq-jelly-plays', '0'), 10) || 0,
  };
  let muted = store.get('hanq-jelly-muted', '0') === '1';

  // ---------- audio ----------
  let actx = null;
  let master = null;
  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        actx = new AC();
        master = actx.createGain();
        master.gain.value = muted ? 0 : 0.35;
        master.connect(actx.destination);
      } catch { actx = null; return null; }
    }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.2, slide = 1, delay = 0) {
    if (!actx || muted) return;
    const t = actx.currentTime + delay;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + dur + 0.03);
  }
  const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
  const sfx = {
    stretch(power) { tone(180 + power * 260, 0.05, 'sine', 0.05); },
    jump(power) { tone(260 + power * 200, 0.22, 'sine', 0.2, 2.4); },
    land() { tone(150, 0.12, 'sine', 0.22, 0.6); tone(90, 0.08, 'triangle', 0.12, 0.8); },
    perfect(combo) { const f = NOTES[Math.min(combo - 1, NOTES.length - 1)]; tone(f, 0.16, 'triangle', 0.2); tone(f * 1.5, 0.22, 'sine', 0.12, 1, 0.07); },
    star() { tone(1318, 0.08, 'sine', 0.16); tone(1976, 0.18, 'sine', 0.13, 1, 0.06); },
    spring() { tone(220, 0.35, 'square', 0.08, 4); tone(440, 0.3, 'sine', 0.15, 3); },
    wall() { tone(320, 0.06, 'triangle', 0.1, 0.8); },
    crumble() { tone(140, 0.25, 'sawtooth', 0.07, 0.5); },
    over() { tone(392, 0.18, 'triangle', 0.18); tone(311, 0.2, 'triangle', 0.18, 1, 0.16); tone(196, 0.6, 'triangle', 0.2, 0.7, 0.34); },
    start() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, 1, i * 0.06)); },
  };
  function haptic(ms) { if (navigator.vibrate && !muted) { try { navigator.vibrate(ms); } catch { /* optional */ } } }

  // ---------- sizing ----------
  let pixelW = 400;
  let pixelH = 667;
  let cssScale = 1; // CSS px per logical unit
  function resize() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    pixelW = Math.round(rect.width * dpr);
    pixelH = Math.round(rect.height * dpr);
    cssScale = rect.width / W;
    if (canvas.width !== pixelW || canvas.height !== pixelH) { canvas.width = pixelW; canvas.height = pixelH; }
    if (state !== 'playing') draw();
  }

  // ---------- scenery ----------
  const SKY = [ // [height in m, top colour, bottom colour]
    [0, [126, 200, 255], [222, 241, 255]],
    [120, [255, 154, 139], [255, 214, 165]],
    [260, [92, 63, 160], [214, 112, 172]],
    [420, [18, 14, 52], [58, 34, 112]],
    [700, [4, 4, 18], [24, 12, 60]],
  ];
  function skyAt(m) {
    let i = 0;
    while (i < SKY.length - 2 && m > SKY[i + 1][0]) i++;
    const a = SKY[i], b = SKY[i + 1];
    const t = clamp((m - a[0]) / (b[0] - a[0]), 0, 1);
    const mix = (c1, c2) => `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;
    return { top: mix(a[1], b[1]), bottom: mix(a[2], b[2]), night: clamp((m - 200) / 250, 0, 1) };
  }
  const clouds = Array.from({ length: 9 }, () => ({ x: rand(-60, W + 60), y: rand(0, 1400), s: rand(0.6, 1.4), v: rand(4, 14), depth: rand(0.15, 0.45) }));
  const starsBg = Array.from({ length: 80 }, () => ({ x: rand(0, W), y: rand(0, 2000), s: rand(0.8, 2), tw: rand(0, TAU) }));

  // ---------- state ----------
  let state = 'ready'; // ready | playing | paused | dying | over
  let g = null;
  let clock = 0;
  let aim = null;

  function newGame() {
    g = {
      t: 0, score: 0, shown: 0, combo: 0, maxCombo: 0, perfects: 0, stars: 0,
      camY: 0, slimeY: H + 160, topIdx: 0, nextIdx: 0, maxHeight: 0,
      platforms: [], starItems: [], particles: [], texts: [], rings: [],
      shake: 0, flash: 0, dying: 0, reason: '',
      jelly: { x: W / 2, y: START_Y - R, vx: 0, vy: 0, on: null, sq: 0, sqv: 0, blink: 2, look: 0, lookY: 0, spin: 0, trail: [] },
    };
    addPlatform({ x: W / 2, y: START_Y, w: 170, type: 'normal' });
    g.jelly.on = g.platforms[0];
    while (g.platforms[g.platforms.length - 1].y > -H) generate();
  }

  function addPlatform(p) {
    const plat = { idx: g.nextIdx++, h: 16, vx: 0, crumble: -1, broken: false, fvy: 0, bounce: 0, wobble: 0, ...p };
    plat.minX = plat.w / 2 + 8;
    plat.maxX = W - plat.w / 2 - 8;
    g.platforms.push(plat);
    return plat;
  }
  function generate() {
    const last = g.platforms[g.platforms.length - 1];
    const i = g.nextIdx;
    const gap = rand(100, 140) + Math.min(55, i * 0.7);
    const w = clamp((128 - i * 1.15) * rand(0.85, 1.12), 56, 150);
    let type = 'normal';
    const roll = Math.random();
    const pMove = i > 4 ? Math.min(0.34, 0.1 + i * 0.006) : 0;
    const pCrumble = i > 10 ? Math.min(0.2, 0.05 + i * 0.003) : 0;
    const pSpring = i > 7 ? 0.075 : 0;
    if (roll < pSpring) type = 'spring';
    else if (roll < pSpring + pCrumble) type = 'crumble';
    else if (roll < pSpring + pCrumble + pMove) type = 'move';
    if (last.type === 'crumble' && type === 'crumble') type = 'normal';
    let x;
    for (let k = 0; k < 6; k++) { x = rand(w / 2 + 10, W - w / 2 - 10); if (Math.abs(x - last.x) > 50 && Math.abs(x - last.x) < 250) break; }
    const plat = addPlatform({ x, y: last.y - gap, w: type === 'spring' ? Math.min(w, 74) : w, type });
    if (type === 'move') plat.vx = rand(45, 70 + Math.min(70, i * 1.2)) * (Math.random() < 0.5 ? -1 : 1);
    if (Math.random() < 0.38 && i > 1) {
      g.starItems.push({ x: clamp(lerp(last.x, plat.x, rand(0.3, 0.7)) + rand(-50, 50), 30, W - 30), y: lerp(last.y, plat.y, rand(0.35, 0.65)) - 30, t: rand(0, TAU), got: false });
    }
  }

  // ---------- effects ----------
  function burst(x, y, color, count, speed, life = 0.6, size = 4, gravity = 600) {
    if (g.particles.length > 500) g.particles.splice(0, count);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), s = speed * rand(0.3, 1);
      g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, life: life * rand(0.6, 1), max: life, size: size * rand(0.6, 1.2), color, gravity });
    }
  }
  function splat(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = rand(Math.PI * 1.05, Math.PI * 1.95), s = speed * rand(0.4, 1);
      g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.6), max: 0.6, size: rand(3, 6), color, gravity: 1400 });
    }
  }
  function text(x, y, str, color, size = 20, big = false) { g.texts.push({ x, y, str, color, size, t: 0, big }); }
  function ring(x, y, color, max = 50) { g.rings.push({ x, y, color, r: 6, max, t: 0 }); }
  function shake(n) { if (!reducedMotion) g.shake = Math.max(g.shake, n); }

  // ---------- update ----------
  function update(dt) {
    clock += dt;
    for (const c of clouds) { c.x += c.v * dt; if (c.x > W + 90) c.x = -90; }
    if (!g) return;
    if (state === 'dying') {
      g.dying -= dt;
      updateEffects(dt);
      g.slimeY -= 40 * dt;
      if (g.dying <= 0) finish();
      return;
    }
    if (state !== 'playing') { updateEffects(dt); return; }

    g.t += dt;
    const j = g.jelly;
    // two sub-steps keep fast jumps from tunnelling through platforms
    const steps = 2;
    for (let s = 0; s < steps; s++) step(dt / steps);

    // platforms housekeeping
    for (const p of g.platforms) {
      p.bounce = Math.max(0, p.bounce - dt * 3);
      p.wobble *= Math.pow(0.02, dt);
      if (p.broken) { p.fvy += G * 0.7 * dt; p.y += p.fvy * dt; }
    }
    while (g.platforms[g.platforms.length - 1].y > g.camY - H * 0.6) generate();
    g.platforms = g.platforms.filter(p => p.y < g.camY + H + 260);
    g.starItems = g.starItems.filter(st => !st.got && st.y < g.camY + H + 200);

    // stars
    for (const st of g.starItems) {
      st.t += dt;
      const sy = st.y + Math.sin(st.t * 2.5) * 6;
      if (Math.hypot(st.x - j.x, sy - j.y) < R + 14) {
        st.got = true;
        g.stars++;
        g.score += 25;
        sfx.star();
        burst(st.x, sy, '#ffd54a', 18, 260, 0.6, 4, 300);
        ring(st.x, sy, '#ffe58a', 44);
        text(st.x, sy - 22, '+25', '#ffb800', 20);
      }
    }

    // camera follows upward only
    const target = j.y - H * 0.58;
    if (target < g.camY) g.camY += (target - g.camY) * Math.min(1, dt * 5);

    // rising slime
    const climbed = START_Y - g.camY - H + 100;
    const slimeSpeed = g.t < 2.5 ? 0 : Math.min(92, 24 + Math.max(0, climbed) / 95);
    g.slimeY -= slimeSpeed * dt;
    g.slimeY = Math.min(g.slimeY, g.camY + H + 150); // never fall too far behind

    const height = Math.max(0, Math.floor((START_Y - R - j.y) / PX_PER_M));
    if (height > g.maxHeight) g.maxHeight = height;

    if (j.y + R * 0.4 > g.slimeY) { die('슬라임에 빠졌어요'); return; }
    if (j.y - R > g.camY + H + 60) { die('아래로 떨어졌어요'); return; }

    // jelly animation
    j.sqv += (-j.sq * 260 - j.sqv * 14) * dt; // damped spring for squash & stretch
    j.sq += j.sqv * dt;
    j.blink -= dt;
    if (j.blink < -0.12) j.blink = rand(1.8, 4);
    if (!j.on) {
      j.trail.push({ x: j.x, y: j.y });
      if (j.trail.length > 10) j.trail.shift();
    } else if (j.trail.length) j.trail.shift();

    updateEffects(dt);
  }

  function step(dt) {
    const j = g.jelly;
    if (j.on) {
      const p = j.on;
      if (p.type === 'move') {
        p.x += p.vx * dt;
        if (p.x < p.minX || p.x > p.maxX) { p.vx *= -1; p.x = clamp(p.x, p.minX, p.maxX); }
        j.x += p.vx * dt;
      }
      if (p.type === 'crumble' && p.crumble > 0) {
        p.crumble -= dt;
        p.wobble = 2;
        if (p.crumble <= 0) {
          p.broken = true;
          j.on = null;
          j.vy = 0;
          sfx.crumble();
          burst(p.x, p.y + 6, '#c8a27a', 16, 180, 0.6, 5, 900);
        }
      }
      if (j.on) { j.y = p.y - R; j.vx = 0; j.vy = 0; }
      if (j.x < p.x - p.w / 2 - R * 0.6 || j.x > p.x + p.w / 2 + R * 0.6) j.on = null; // slid off a moving edge
    }

    for (const p of g.platforms) {
      if (p.type !== 'move' || p === j.on || p.broken) continue;
      p.x += p.vx * dt;
      if (p.x < p.minX || p.x > p.maxX) { p.vx *= -1; p.x = clamp(p.x, p.minX, p.maxX); }
    }

    if (j.on) return;
    const prevBottom = j.y + R;
    j.vy += G * dt;
    j.x += j.vx * dt;
    j.y += j.vy * dt;
    j.spin += j.vx * dt * 0.02;

    if (j.x < R) { j.x = R; j.vx = Math.abs(j.vx) * 0.72; wallHit(0); }
    if (j.x > W - R) { j.x = W - R; j.vx = -Math.abs(j.vx) * 0.72; wallHit(W); }

    if (j.vy > 0) {
      const bottom = j.y + R;
      for (const p of g.platforms) {
        if (p.broken) continue;
        if (prevBottom <= p.y + 3 && bottom >= p.y && j.x > p.x - p.w / 2 - R * 0.55 && j.x < p.x + p.w / 2 + R * 0.55) {
          land(p, j.vy);
          break;
        }
      }
    }
  }

  function wallHit(x) {
    const j = g.jelly;
    sfx.wall();
    j.sq = -0.25; j.sqv = 0;
    splat(x, j.y, '#ff7ab8', 6, 140);
  }

  function land(p, impact) {
    const j = g.jelly;
    j.y = p.y - R;
    const offset = Math.abs(j.x - p.x) / (p.w / 2);
    const isNew = p.idx > g.topIdx;
    p.bounce = 1;

    if (p.type === 'spring') {
      j.vy = -SPRING_V;
      j.vx *= 0.5;
      j.sq = -0.45; j.sqv = 0;
      sfx.spring();
      haptic(25);
      burst(p.x, p.y, '#ff8fc7', 20, 300, 0.6, 4, 400);
      ring(p.x, p.y, '#ffc1e0', 70);
      text(p.x, p.y - 34, 'BOING!', '#ff4fa3', 24, true);
      if (isNew) { g.score += 10; g.topIdx = p.idx; }
      return;
    }

    j.on = p;
    j.vx = 0; j.vy = 0;
    j.sq = Math.min(0.55, impact / 2400); j.sqv = 0;
    splat(j.x, p.y, '#ff86c0', 7, 160);
    if (p.type === 'crumble' && p.crumble < 0) p.crumble = 0.85;

    if (isNew) {
      const skipped = p.idx - g.topIdx - 1;
      g.topIdx = p.idx;
      g.score += 10;
      if (skipped > 0) {
        const bonus = 20 * skipped;
        g.score += bonus;
        text(p.x, p.y - 70, `SKIP +${bonus}`, '#7c4dff', 18);
      }
      if (offset < 0.22) {
        g.combo++;
        g.perfects++;
        g.maxCombo = Math.max(g.maxCombo, g.combo);
        const bonus = 15 * g.combo;
        g.score += bonus;
        sfx.perfect(g.combo);
        haptic(15);
        burst(j.x, p.y - 4, '#ffffff', 10, 220, 0.5, 3, 200);
        burst(j.x, p.y - 4, '#ffd54a', 16, 260, 0.7, 4, 300);
        ring(j.x, p.y, '#fff3b0', 60);
        text(j.x, p.y - 46, g.combo > 1 ? `PERFECT x${g.combo}` : 'PERFECT!', '#ffb800', 22 + Math.min(10, g.combo), true);
        text(j.x, p.y - 22, `+${bonus + 10}`, '#ffffff', 16);
        if (g.combo >= 5 && g.combo % 5 === 0) { g.flash = 0.25; shake(5); }
      } else {
        if (g.combo >= 3) text(j.x, p.y - 46, '콤보 끝', '#9aa0c0', 16);
        g.combo = 0;
        sfx.land();
        text(j.x, p.y - 26, '+10', '#ffffff', 16);
      }
    } else {
      sfx.land();
    }
  }

  function updateEffects(dt) {
    for (let i = g.particles.length - 1; i >= 0; i--) {
      const q = g.particles[i];
      q.life -= dt;
      if (q.life <= 0) { g.particles.splice(i, 1); continue; }
      q.vy += q.gravity * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    for (let i = g.texts.length - 1; i >= 0; i--) { const t = g.texts[i]; t.t += dt; t.y -= (t.big ? 26 : 40) * dt; if (t.t > 1) g.texts.splice(i, 1); }
    for (let i = g.rings.length - 1; i >= 0; i--) { const r = g.rings[i]; r.t += dt; r.r += (r.max - r.r) * Math.min(1, dt * 10); if (r.t > 0.45) g.rings.splice(i, 1); }
    g.shake = Math.max(0, g.shake - dt * 28);
    g.flash = Math.max(0, g.flash - dt);
  }

  // ---------- launching ----------
  function launchVelocity() {
    if (!aim) return null;
    const dx = (aim.sx - aim.cx) / cssScale;
    const dy = (aim.sy - aim.cy) / cssScale;
    const len = Math.hypot(dx, dy);
    if (len < 14) return null;
    const power = Math.min(len, MAX_PULL) / MAX_PULL;
    const speed = MIN_V + (MAX_V - MIN_V) * power;
    return { vx: (dx / len) * speed, vy: (dy / len) * speed, power };
  }
  function launch() {
    const j = g.jelly;
    const v = launchVelocity();
    aim = null;
    if (!v || !j.on) return;
    j.on = null;
    j.vx = v.vx; j.vy = v.vy;
    j.sq = -0.35 * (0.5 + v.power); j.sqv = 0;
    sfx.jump(v.power);
    splat(j.x, j.y + R, '#ff9fcd', 5, 120);
  }

  // ---------- drawing ----------
  function draw() {
    const sx = pixelW / W;
    const sy = pixelH / H;
    let ox = 0, oy = 0;
    if (g && g.shake > 0) { ox = rand(-g.shake, g.shake); oy = rand(-g.shake, g.shake); }
    ctx.setTransform(sx, 0, 0, sy, ox * sx, oy * sy);

    const camY = g ? g.camY : 0;
    const meters = g ? Math.max(0, (START_Y - H - camY) / PX_PER_M) : 0;
    const sky = skyAt(meters);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // stars appear as the sky darkens
    if (sky.night > 0) {
      for (const s of starsBg) {
        const y = ((s.y - camY * 0.1) % 2000 + 2000) % 2000 - 600;
        if (y < -5 || y > H + 5) continue;
        ctx.globalAlpha = sky.night * (0.5 + 0.5 * Math.sin(clock * 2 + s.tw));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s.x, y, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }
    // parallax clouds
    for (const c of clouds) {
      const y = ((c.y - camY * c.depth) % 1400 + 1400) % 1400 - 300;
      if (y < -80 || y > H + 80) continue;
      ctx.globalAlpha = (1 - sky.night * 0.75) * 0.75;
      drawCloud(c.x, y, c.s);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(0, -camY);

    if (g) {
      drawMarkers(camY);
      for (const p of g.platforms) if (p.y > camY - 40 && p.y < camY + H + 60) drawPlatform(p);
      for (const st of g.starItems) if (!st.got) drawStar(st);
      if (aim && g.jelly.on && state === 'playing') drawAim();
      if (state !== 'over' && state !== 'dying') drawJelly();
      else if (state === 'dying') drawJelly(true);

      // rings & particles
      for (const r of g.rings) {
        ctx.globalAlpha = Math.max(0, 1 - r.t / 0.45);
        ctx.strokeStyle = r.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      }
      for (const q of g.particles) {
        ctx.globalAlpha = Math.max(0, q.life / q.max);
        ctx.fillStyle = q.color;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + 0.5 * q.life / q.max), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawSlime();
      // floating text
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const t of g.texts) {
        const k = t.t;
        const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.5 : k < 0.2 ? 1.1 - (k - 0.12) / 0.08 * 0.1 : 1;
        ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.font = `900 ${t.size * pop}px system-ui, sans-serif`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = t.big ? 6 : 4;
        ctx.strokeStyle = 'rgba(40,20,70,0.55)';
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    } else {
      drawSlime();
    }
    ctx.restore();

    if (g) {
      // danger vignette when the slime gets close
      const gapToSlime = g.slimeY - g.jelly.y;
      if (state === 'playing' && gapToSlime < 230) {
        const k = 1 - gapToSlime / 230;
        const v = ctx.createLinearGradient(0, H, 0, H - 200);
        v.addColorStop(0, `rgba(120,255,120,${0.35 * k})`);
        v.addColorStop(1, 'rgba(120,255,120,0)');
        ctx.fillStyle = v;
        ctx.fillRect(0, H - 200, W, 200);
      }
      if (g.flash > 0) {
        ctx.globalAlpha = g.flash * 1.6;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawCloud(x, y, s) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, TAU);
    ctx.arc(x + 24 * s, y - 10 * s, 26 * s, 0, TAU);
    ctx.arc(x + 52 * s, y, 20 * s, 0, TAU);
    ctx.arc(x + 26 * s, y + 8 * s, 22 * s, 0, TAU);
    ctx.fill();
  }

  function drawMarkers(camY) {
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    const top = camY, bottom = camY + H;
    const m0 = Math.floor((START_Y - R - bottom) / PX_PER_M / 25) * 25;
    for (let m = Math.max(25, m0); ; m += 25) {
      const y = START_Y - R - m * PX_PER_M;
      if (y < top) break;
      if (y > bottom) continue;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, y, 14, 2);
      ctx.fillText(`${m}m`, 4, y - 2);
    }
    if (rec.height > 0) {
      const y = START_Y - R - rec.height * PX_PER_M;
      if (y > top && y < bottom) {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#ffd54a';
        ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffd54a';
        ctx.textAlign = 'right';
        ctx.fillText(`BEST ${rec.height}m`, W - 6, y - 3);
      }
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  const PLAT = {
    normal: { top: '#5ee39a', side: '#21a86a', deep: '#167a4c' },
    move: { top: '#6cc7ff', side: '#2a86d8', deep: '#1c5fa0' },
    crumble: { top: '#e7c39b', side: '#b98a5e', deep: '#8a6340' },
    spring: { top: '#ff8fc7', side: '#e0559b', deep: '#a83371' },
  };
  function drawPlatform(p) {
    const c = PLAT[p.type];
    const squish = p.bounce * 4;
    const wob = p.wobble ? Math.sin(clock * 60) * p.wobble : 0;
    const x = p.x - p.w / 2 + wob;
    const y = p.y + squish * 0.5;
    ctx.save();
    if (p.broken) { ctx.globalAlpha = 0.85; ctx.translate(p.x, p.y); ctx.rotate(p.fvy * 0.0006); ctx.translate(-p.x, -p.y); }
    // shadow
    ctx.fillStyle = 'rgba(30,20,60,0.16)';
    roundRect(x + 3, y + 8, p.w, p.h, 8); ctx.fill();
    ctx.fillStyle = c.deep;
    roundRect(x, y + 4, p.w, p.h, 8); ctx.fill();
    ctx.fillStyle = c.side;
    roundRect(x, y, p.w, p.h - 3, 8); ctx.fill();
    ctx.fillStyle = c.top;
    roundRect(x, y, p.w, 7, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    roundRect(x + 6, y + 2, p.w * 0.35, 2.5, 2); ctx.fill();

    // perfect zone hint
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(p.x + wob - 1, y + 9, 2, 3);

    if (p.type === 'move') {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const dir = Math.sign(p.vx) || 1;
      for (const k of [-1, 1]) {
        const ax = p.x + wob + k * (p.w / 2 - 12);
        ctx.beginPath();
        ctx.moveTo(ax + dir * 4, y + 9.5); ctx.lineTo(ax - dir * 2, y + 6.5); ctx.lineTo(ax - dir * 2, y + 12.5);
        ctx.closePath(); ctx.fill();
      }
    } else if (p.type === 'crumble') {
      ctx.strokeStyle = 'rgba(90,55,25,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + p.w * 0.3, y + 1); ctx.lineTo(x + p.w * 0.36, y + 7); ctx.lineTo(x + p.w * 0.31, y + 13);
      ctx.moveTo(x + p.w * 0.7, y + 2); ctx.lineTo(x + p.w * 0.64, y + 8); ctx.lineTo(x + p.w * 0.7, y + 13);
      ctx.stroke();
    } else if (p.type === 'spring') {
      const ext = 10 + p.bounce * 14;
      ctx.strokeStyle = '#ffd1e8'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath();
      const cx = p.x + wob;
      ctx.moveTo(cx - 9, y);
      for (let k = 1; k <= 4; k++) ctx.lineTo(cx + (k % 2 ? 9 : -9), y - (ext * k) / 4);
      ctx.stroke();
      ctx.fillStyle = '#ff4fa3';
      roundRect(cx - 15, y - ext - 5, 30, 6, 3); ctx.fill();
    }
    ctx.restore();
  }

  function drawStar(st) {
    const y = st.y + Math.sin(st.t * 2.5) * 6;
    ctx.save();
    ctx.translate(st.x, y);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.arc(0, 0, 20 + Math.sin(st.t * 4) * 2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.rotate(Math.sin(st.t * 1.6) * 0.3);
    ctx.fillStyle = '#ffd54a';
    ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 5.5 : 13;
      const a = -Math.PI / 2 + (i / 10) * TAU;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(-3, -4, 2.5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawAim() {
    const v = launchVelocity();
    const j = g.jelly;
    if (!v) return;
    // dotted trajectory preview (short, so aiming still takes skill)
    let x = j.x, y = j.y, vx = v.vx, vy = v.vy;
    const dt = 1 / 30;
    for (let i = 0; i < 14; i++) {
      for (let k = 0; k < 2; k++) {
        vy += G * dt / 2; x += vx * dt / 2; y += vy * dt / 2;
        if (x < R) { x = R; vx = Math.abs(vx) * 0.72; }
        if (x > W - R) { x = W - R; vx = -Math.abs(vx) * 0.72; }
      }
      ctx.globalAlpha = (1 - i / 14) * 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, 4.2 - i * 0.18, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // power ring around the jelly
    ctx.strokeStyle = v.power > 0.98 ? '#ff4fa3' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(j.x, j.y, R + 10, -Math.PI / 2, -Math.PI / 2 + TAU * v.power); ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function drawJelly(dead = false) {
    const j = g.jelly;
    const v = aim && j.on ? launchVelocity() : null;
    // trail
    for (let i = 0; i < j.trail.length; i++) {
      const k = i / j.trail.length;
      ctx.globalAlpha = k * 0.3;
      ctx.fillStyle = '#ff7ab8';
      ctx.beginPath(); ctx.arc(j.trail[i].x, j.trail[i].y, R * (0.4 + k * 0.5), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(j.x, j.y);
    let scaleX = 1 + j.sq, scaleY = 1 - j.sq;
    let angle = 0;
    if (v) { // squash down while charging
      scaleX = 1 + v.power * 0.28; scaleY = 1 - v.power * 0.22;
    } else if (!j.on) {
      const speed = Math.hypot(j.vx, j.vy);
      const stretch = Math.min(0.28, speed / 4500);
      angle = Math.atan2(j.vy, j.vx) + Math.PI / 2;
      scaleX = (1 - stretch) * (1 + j.sq); scaleY = (1 + stretch) * (1 - j.sq);
    }
    if (dead) { scaleX = 1.25; scaleY = 0.7; }
    // keep the jelly sitting on its platform while squashed
    const baseShift = j.on ? R * (1 - scaleY) : 0;
    ctx.translate(0, baseShift);
    ctx.rotate(angle);
    ctx.scale(scaleX, scaleY);
    ctx.rotate(-angle);

    // body
    const body = ctx.createRadialGradient(-6, -8, 2, 0, 0, R * 1.2);
    body.addColorStop(0, '#ffc2df');
    body.addColorStop(0.5, '#ff6fb1');
    body.addColorStop(1, '#e8458f');
    ctx.fillStyle = body;
    ctx.beginPath();
    // slightly flat-bottomed blob
    ctx.moveTo(-R, 2);
    ctx.bezierCurveTo(-R, -R * 1.25, R, -R * 1.25, R, 2);
    ctx.bezierCurveTo(R, R * 1.02, -R, R * 1.02, -R, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath(); ctx.ellipse(-6, -9, 5, 3, -0.5, 0, TAU); ctx.fill();

    // face
    let lx = 0, ly = 0;
    if (v) { const n = Math.hypot(v.vx, v.vy) || 1; lx = v.vx / n; ly = v.vy / n; }
    else if (!j.on) { const n = Math.hypot(j.vx, j.vy) || 1; lx = j.vx / n; ly = j.vy / n; }
    const ex = lx * 2.5, ey = ly * 2.5;
    if (dead) {
      ctx.strokeStyle = '#3b1d3a'; ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 6 - 3, -5); ctx.lineTo(s * 6 + 3, 1);
        ctx.moveTo(s * 6 + 3, -5); ctx.lineTo(s * 6 - 3, 1);
        ctx.stroke();
      }
    } else if (j.blink < 0) {
      ctx.strokeStyle = '#3b1d3a'; ctx.lineWidth = 2;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 6 - 3.5, -2); ctx.lineTo(s * 6 + 3.5, -2); ctx.stroke(); }
    } else {
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(s * 6, -3, 4.6, 5.4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2b1230';
        ctx.beginPath(); ctx.arc(s * 6 + ex, -2.5 + ey, 2.6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(s * 6 + ex + 0.9, -3.6 + ey, 0.9, 0, TAU); ctx.fill();
      }
    }
    // cheeks + mouth
    ctx.fillStyle = 'rgba(255,90,140,0.55)';
    ctx.beginPath(); ctx.ellipse(-11, 4, 3.2, 2, 0, 0, TAU); ctx.ellipse(11, 4, 3.2, 2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3b1d3a'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath();
    if (dead) { ctx.arc(0, 8, 3, Math.PI * 1.1, Math.PI * 1.9); }
    else if (!j.on || v) { ctx.ellipse(0, 5.5, 2.4, 2.8, 0, 0, TAU); }
    else { ctx.arc(0, 3, 3, Math.PI * 0.15, Math.PI * 0.85); }
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  function drawSlime() {
    const top = g ? g.slimeY : H + 160;
    const camY = g ? g.camY : 0;
    if (top > camY + H + 40) return;
    const bottom = camY + H + 40;
    const t = clock;
    const sg = ctx.createLinearGradient(0, top - 10, 0, top + 140);
    sg.addColorStop(0, '#9dff6b');
    sg.addColorStop(0.15, '#4ccf5a');
    sg.addColorStop(1, '#1f7a3d');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(-10, bottom);
    for (let x = -10; x <= W + 10; x += 10) {
      const y = top + Math.sin(x * 0.045 + t * 3) * 6 + Math.sin(x * 0.11 - t * 2.1) * 3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 10, bottom);
    ctx.closePath();
    ctx.fill();
    // bubbles
    ctx.fillStyle = 'rgba(220,255,200,0.55)';
    for (let i = 0; i < 9; i++) {
      const bx = ((i * 53 + t * 18 * (i % 3 + 1)) % (W + 20)) - 10;
      const by = top + 18 + ((i * 37 + t * 30) % 90);
      ctx.beginPath(); ctx.arc(bx, by, 2 + (i % 3) * 1.5, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(230,255,210,0.8)'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 10) {
      const y = top + Math.sin(x * 0.045 + t * 3) * 6 + Math.sin(x * 0.11 - t * 2.1) * 3;
      if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // ---------- HUD & overlays ----------
  const hud = { score: $('j-score'), height: $('j-height'), combo: $('j-combo') };
  const last = {};
  const setText = (el, key, value) => { if (last[key] !== value) { last[key] = value; el.textContent = value; } };
  function updateHud(dt) {
    if (!g) return;
    g.shown += (g.score - g.shown) * Math.min(1, dt * 12);
    if (Math.abs(g.score - g.shown) < 1) g.shown = g.score;
    setText(hud.score, 'score', fmt(g.shown));
    setText(hud.height, 'height', `${g.maxHeight}m`);
    setText(hud.combo, 'combo', `x${g.combo}`);
    hud.combo.classList.toggle('hot', g.combo >= 3);
  }
  function updateRecords() {
    $('jrec-best').textContent = fmt(rec.best);
    $('jrec-height').textContent = `${fmt(rec.height)}m`;
    $('jrec-plays').textContent = fmt(rec.plays);
    $('jov-best').textContent = rec.best ? `최고 기록 ${fmt(rec.best)}점 · ${fmt(rec.height)}m` : '첫 기록에 도전해 보세요!';
  }
  const overlay = $('jelly-overlay');
  const panels = { start: $('jov-start'), pause: $('jov-pause'), over: $('jov-over') };
  function showPanel(name) {
    overlay.hidden = !name;
    for (const [key, el] of Object.entries(panels)) el.hidden = key !== name;
    const button = name && panels[name].querySelector('.button-primary');
    if (button && !isHidden()) setTimeout(() => button.focus({ preventScroll: true }), 30);
    $('j-pause').disabled = state !== 'playing';
  }

  function start() {
    audio();
    newGame();
    aim = null;
    state = 'playing';
    rec.plays++;
    store.set('hanq-jelly-plays', rec.plays);
    updateRecords();
    showPanel(null);
    sfx.start();
    if (window.HanQArcade) window.HanQArcade.fitToScreen(pane.querySelector('.jelly-card'));
    kick();
  }
  function pause() {
    if (state !== 'playing') return;
    aim = null;
    state = 'paused';
    showPanel('pause');
  }
  function resume() {
    if (state !== 'paused') return;
    audio();
    state = 'playing';
    showPanel(null);
    kick();
  }
  function die(reason) {
    state = 'dying';
    aim = null;
    g.dying = 1.1;
    g.reason = reason;
    sfx.over();
    haptic([40, 40, 80]);
    const j = g.jelly;
    splat(j.x, j.y, '#ff6fb1', 24, 320);
    burst(j.x, j.y, '#b6ff8f', 18, 260, 0.8, 5, 900);
    shake(10);
    $('j-pause').disabled = true;
  }
  function finish() {
    state = 'over';
    const score = Math.floor(g.score);
    const isRecord = score > rec.best;
    if (isRecord) { rec.best = score; store.set('hanq-jelly-best', score); }
    if (g.maxHeight > rec.height) { rec.height = g.maxHeight; store.set('hanq-jelly-height', g.maxHeight); }
    updateRecords();
    $('jov-reason').textContent = g.reason;
    $('jov-score').textContent = fmt(score);
    $('jov-height').textContent = `${g.maxHeight}m`;
    $('jov-perfect').textContent = fmt(g.perfects);
    $('jov-combo').textContent = `x${g.maxCombo}`;
    $('jov-stars').textContent = fmt(g.stars);
    $('jov-record').hidden = !isRecord || score === 0;
    showPanel('over');
  }

  // ---------- input ----------
  let pointerId = null;
  let lastStretchTick = 0;
  canvas.addEventListener('pointerdown', event => {
    if (state !== 'playing' || pointerId !== null) return;
    event.preventDefault();
    audio();
    pointerId = event.pointerId;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* optional */ }
    aim = { sx: event.clientX, sy: event.clientY, cx: event.clientX, cy: event.clientY };
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId || !aim) return;
    event.preventDefault();
    aim.cx = event.clientX; aim.cy = event.clientY;
    const v = launchVelocity();
    if (v && g.jelly.on) {
      const tick = Math.floor(v.power * 8);
      if (tick !== lastStretchTick) { lastStretchTick = tick; sfx.stretch(v.power); }
    }
  });
  function release(event) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    lastStretchTick = 0;
    if (state === 'playing' && aim) launch();
    aim = null;
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', event => { if (event.pointerId === pointerId) { pointerId = null; aim = null; } });
  canvas.addEventListener('contextmenu', event => event.preventDefault());

  document.addEventListener('keydown', event => {
    if (isHidden() || !document.documentElement.classList.contains('unlocked')) return;
    if (event.target && /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
    const onButton = event.target && event.target.tagName === 'BUTTON';
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
      if (state === 'playing') { event.preventDefault(); pause(); }
      else if (state === 'paused' && event.key !== 'Escape') { event.preventDefault(); resume(); }
    } else if ((event.key === 'Enter' || event.key === ' ') && !onButton) {
      if (state === 'ready' || state === 'over') { event.preventDefault(); start(); }
      else if (state === 'paused') { event.preventDefault(); resume(); }
    }
  });

  $('jelly-start').addEventListener('click', start);
  $('jelly-retry').addEventListener('click', start);
  $('jelly-restart').addEventListener('click', start);
  $('jelly-resume').addEventListener('click', resume);
  $('j-pause').addEventListener('click', () => (state === 'playing' ? pause() : resume()));
  const muteButton = $('j-mute');
  function syncMute() {
    muteButton.setAttribute('aria-pressed', String(muted));
    muteButton.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
    muteButton.classList.toggle('muted', muted);
    if (master) master.gain.value = muted ? 0 : 0.35;
  }
  muteButton.addEventListener('click', () => { muted = !muted; store.set('hanq-jelly-muted', muted ? '1' : '0'); audio(); syncMute(); });

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else kick(); });
  window.addEventListener('blur', pause);
  document.addEventListener('hanq:lock', pause);
  document.addEventListener('hanq:tab', event => { if (event.detail !== 'game') pause(); else { requestAnimationFrame(resize); kick(); } });
  document.addEventListener('hanq:game', event => { if (event.detail !== 'jelly') pause(); else { requestAnimationFrame(resize); kick(); } });

  // ---------- loop ----------
  let raf = 0;
  let lastTime = 0;
  function frame(now) {
    raf = 0;
    if (isHidden() || document.hidden) { lastTime = 0; return; }
    const dt = lastTime ? Math.min(0.04, (now - lastTime) / 1000) : 0;
    lastTime = now;
    if (state !== 'paused') update(dt);
    draw();
    updateHud(dt);
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !isHidden()) { lastTime = 0; raf = requestAnimationFrame(frame); } }

  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);

  // Idle scene behind the start screen.
  newGame();
  g.slimeY = H + 400;
  syncMute();
  updateRecords();
  showPanel('start');
  resize();
  kick();
})();
