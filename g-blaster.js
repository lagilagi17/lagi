'use strict';
// 네온 블래스터 — vertical neon shooter (auto-fire, drag / mouse / keyboard).
HanQArcade.register({
  id: 'blaster',
  title: '네온 블래스터',
  tagline: '자동 사격 슈팅 · 보스전',
  aspect: 'portrait',
  theme: { card: 'linear-gradient(160deg,#0f1d4a,#070b22 70%)', border: 'rgba(56,189,248,.35)', stage: '#050818' },
  intro: '드래그(폰) 또는 마우스·방향키(PC)로 움직이세요.<br>사격은 <b class="c-rock">자동</b>! 아이템을 모아 무기를 강화하고<br>5웨이브마다 나오는 <b class="c-spike">보스</b>를 쓰러뜨리세요.',
  hud: [
    { key: 'score', label: '점수', wide: true },
    { key: 'wave', label: '웨이브', initial: '1' },
    { key: 'mult', label: '배율', initial: 'x1' },
    { key: 'hp', label: '체력', initial: '♥3' },
  ],
  overStats: [
    { key: 'wave', label: '웨이브' },
    { key: 'kills', label: '격추' },
    { key: 'bosses', label: '보스 처치' },
    { key: 'maxMult', label: '최대 배율', format: v => `x${v || 1}` },
  ],
  controls: [
    [['드래그'], '이동 (폰)'],
    [['마우스'], '이동 (PC)'],
    [['←', '→', '↑', '↓'], '이동 (키보드)'],
    [['P'], '일시정지'],
  ],
  tip: '폰에서는 화면 아무 곳이나 잡고 끌면 손가락에 가리지 않게 기체가 따라와요. 피격 판정은 기체 가운데의 작은 점이에요.',
  legend: [
    { name: 'P 무기 강화', desc: '탄이 늘어나요 (최대 5단계).', color: '#38bdf8', ring: '#e0f2fe' },
    { name: 'S 실드', desc: '8초 동안 한 번 막아줘요.', color: '#a78bfa', ring: '#ede9fe' },
    { name: '♥ 회복', desc: '체력 +1.', color: '#fb7185', ring: '#ffe4e6' },
    { name: 'B 폭탄', desc: '화면의 적과 탄을 쓸어버려요.', color: '#fbbf24', ring: '#fef3c7' },
  ],
  icon(c, s) {
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#0f1d4a'); g.addColorStop(1, '#050818');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    c.fillStyle = '#ff4fd8';
    for (const [x, y] of [[22, 20], [62, 26]]) { c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 7, y); c.lineTo(x, y + 7); c.lineTo(x - 7, y); c.fill(); }
    c.fillStyle = '#7dd3fc';
    c.fillRect(42, 30, 4, 14); c.fillRect(30, 40, 4, 10); c.fillRect(54, 40, 4, 10);
    c.fillStyle = '#e0f2fe';
    c.beginPath(); c.moveTo(44, 50); c.lineTo(60, 74); c.lineTo(44, 68); c.lineTo(28, 74); c.closePath(); c.fill();
    c.fillStyle = '#38bdf8'; c.beginPath(); c.arc(44, 62, 4, 0, Math.PI * 2); c.fill();
  },
  dyingTime: 1.4,
  create(api) {
    const { W, H, TAU, rand, clamp } = api;
    let s;
    const stars = Array.from({ length: 90 }, () => ({ x: rand(0, W), y: rand(0, H), z: rand(0.3, 1) }));
    let gridY = 0;

    const sfx = {
      shot() { api.tone(1400, 0.04, 'square', 0.025, 0.5); },
      hit() { api.tone(600, 0.04, 'square', 0.03, 0.7); },
      boom(big) { api.noise(big ? 0.7 : 0.28, big ? 0.45 : 0.22, big ? 900 : 1800); if (big) api.tone(90, 0.6, 'sawtooth', 0.15, 0.4); },
      item() { [880, 1175, 1568].forEach((f, i) => api.tone(f, 0.08, 'triangle', 0.13, 1, i * 0.05)); },
      hurt() { api.noise(0.4, 0.4, 700); api.tone(180, 0.35, 'sawtooth', 0.15, 0.4); },
      bomb() { api.noise(1.0, 0.5, 2400); api.tone(60, 1, 'sine', 0.3, 0.5); },
      warn() { [0, 0.25, 0.5].forEach(d => api.tone(440, 0.18, 'square', 0.06, 1, d)); },
    };

    function reset() {
      s = {
        t: 0, score: 0, shown: 0, wave: 0, kills: 0, bosses: 0, chain: 0, mult: 1, maxMult: 1,
        p: { x: W / 2, y: H - 110, tx: W / 2, ty: H - 110, hp: 3, maxHp: 5, level: 1, inv: 0, shield: 0, fire: 0, tilt: 0 },
        bullets: [], enemies: [], shots: [], items: [],
        toSpawn: 0, spawnT: 0, waveDelay: 1.2, bossAlive: false, drag: null, mouse: false,
      };
    }

    function nextWave() {
      s.wave++;
      if (s.wave % 5 === 0) {
        s.toSpawn = 0;
        spawnBoss();
        api.banner(`WAVE ${s.wave}`, '⚠ 보스 출현 ⚠');
        sfx.warn();
      } else {
        s.toSpawn = 8 + s.wave * 3;
        s.spawnT = 0.6;
        api.banner(`WAVE ${s.wave}`, s.wave === 1 ? '적을 모두 격추하라!' : '');
      }
    }

    function addEnemy(type, x, y, extra = {}) {
      const w = s.wave;
      const base = {
        drone: { r: 13, hp: 1 + Math.floor(w / 4), pts: 100, color: '#ff4fd8' },
        dart: { r: 11, hp: 1 + Math.floor(w / 6), pts: 150, color: '#fb923c' },
        tank: { r: 21, hp: 6 + w, pts: 400, color: '#a78bfa' },
        orbiter: { r: 16, hp: 4 + Math.floor(w / 2), pts: 300, color: '#facc15' },
      }[type];
      s.enemies.push({ type, x, y, vx: 0, vy: 0, t: 0, hit: 0, fire: rand(0.8, 2), maxHp: base.hp, ...base, ...extra });
    }
    function spawnOne() {
      const w = s.wave;
      const roll = Math.random();
      if (w >= 2 && roll < 0.13) {
        // formation of drones sweeping in
        const n = 5, side = Math.random() < 0.5 ? -1 : 1;
        for (let i = 0; i < n; i++) addEnemy('drone', W / 2 + side * (i - 2) * 46, -30 - i * 34, { phase: i * 0.6, vy: 110 });
        s.toSpawn -= n - 1;
        return;
      }
      const pool = ['drone', 'drone', 'drone'];
      if (w >= 2) pool.push('dart', 'dart');
      if (w >= 3) pool.push('tank');
      if (w >= 4) pool.push('orbiter');
      if (w >= 7) pool.push('tank', 'orbiter', 'dart');
      const type = pool[Math.floor(Math.random() * pool.length)];
      const x = rand(30, W - 30);
      if (type === 'drone') addEnemy('drone', x, -20, { phase: rand(0, TAU), vy: rand(90, 130) });
      if (type === 'dart') addEnemy('dart', x, -20, { vy: 260, mode: 0, stop: rand(140, 300) });
      if (type === 'tank') addEnemy('tank', x, -30, { vy: 48 });
      if (type === 'orbiter') addEnemy('orbiter', x, -24, { tx: rand(60, W - 60), ty: rand(90, 260), life: 7 });
    }
    function spawnBoss() {
      const tier = s.wave / 5;
      const hp = 90 + tier * 70;
      s.enemies.push({ type: 'boss', x: W / 2, y: -80, r: 46, hp, maxHp: hp, pts: 5000 * tier, color: '#ff3d7f', t: 0, hit: 0, fire: 2, pattern: 0, patT: 0, spin: 0, tier });
      s.bossAlive = true;
    }

    function enemyShot(x, y, angle, speed, color = '#ff5fa0', r = 5) {
      if (s.bullets.length > 340) return;
      s.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, color });
    }
    const aimAt = e => Math.atan2(s.p.y - e.y, s.p.x - e.x);

    function fire() {
      const p = s.p;
      const lv = p.level;
      const make = (dx, ang, dmg = 1) => s.shots.push({ x: p.x + dx, y: p.y - 18, vx: Math.sin(ang) * 760, vy: -Math.cos(ang) * 760, dmg });
      if (lv === 1) make(0, 0);
      if (lv === 2) { make(-7, 0); make(7, 0); }
      if (lv >= 3) { make(0, 0, lv >= 5 ? 1.4 : 1); make(-6, -0.11); make(6, 0.11); }
      if (lv >= 4) { make(-16, 0); make(16, 0); }
      if (lv >= 5) { make(-10, -0.24); make(10, 0.24); }
      sfx.shot();
    }

    function hurtPlayer() {
      const p = s.p;
      if (p.inv > 0) return;
      if (p.shield > 0) {
        p.shield = 0; p.inv = 1;
        api.ring(p.x, p.y, '#c4b5fd', 70, 4);
        api.burst(p.x, p.y, '#c4b5fd', 24, 280, 0.6, 3);
        api.tone(1200, 0.25, 'triangle', 0.15, 0.4);
        clearBulletsNear(p.x, p.y, 110);
        return;
      }
      p.hp--;
      p.level = Math.max(1, p.level - 1);
      p.inv = 1.8;
      s.chain = 0; s.mult = 1;
      sfx.hurt();
      api.haptic(60);
      api.shake(12);
      api.flash(0.35, '#ff3d7f');
      api.burst(p.x, p.y, '#7dd3fc', 30, 320, 0.7, 3.5);
      clearBulletsNear(p.x, p.y, 130);
      if (p.hp <= 0) {
        api.burst(p.x, p.y, '#ffffff', 60, 420, 1.2, 4);
        api.burst(p.x, p.y, '#38bdf8', 60, 360, 1.2, 4);
        api.ring(p.x, p.y, '#ffffff', 160, 6);
        sfx.boom(true);
        api.end('기체가 파괴됐어요', stats());
      }
    }
    function clearBulletsNear(x, y, r) {
      s.bullets = s.bullets.filter(b => {
        if (Math.hypot(b.x - x, b.y - y) < r) { api.burst(b.x, b.y, b.color, 2, 60, 0.3, 2); return false; }
        return true;
      });
    }
    function stats() { return { score: s.score, wave: s.wave, kills: s.kills, bosses: s.bosses, maxMult: s.maxMult }; }

    function killEnemy(e) {
      s.kills++;
      s.chain++;
      s.mult = Math.min(8, 1 + Math.floor(s.chain / 12));
      s.maxMult = Math.max(s.maxMult, s.mult);
      const pts = e.pts * s.mult;
      s.score += pts;
      const big = e.type === 'boss' || e.type === 'tank';
      sfx.boom(e.type === 'boss');
      api.burst(e.x, e.y, e.color, big ? 40 : 18, big ? 320 : 220, big ? 0.9 : 0.6, big ? 4 : 3);
      api.burst(e.x, e.y, '#ffffff', big ? 16 : 6, 160, 0.4, 2);
      api.ring(e.x, e.y, e.color, e.r * 2.6, big ? 5 : 3);
      api.text(e.x, e.y - 10, `+${api.fmt(pts)}`, s.mult > 1 ? '#fde047' : '#e0f2fe', e.type === 'boss' ? 26 : 15, e.type === 'boss');
      if (e.type === 'boss') {
        s.bossAlive = false;
        s.bosses++;
        api.shake(16);
        api.flash(0.6);
        s.bullets.length = 0;
        drop(e.x - 30, e.y, 'P'); drop(e.x + 30, e.y, 'P'); drop(e.x, e.y + 10, 'H');
        api.banner('BOSS DOWN!', `+${api.fmt(pts)}`);
        return;
      }
      if (big) api.shake(4);
      const r = Math.random();
      if (r < (e.type === 'tank' ? 0.3 : 0.06)) drop(e.x, e.y, 'P');
      else if (r < 0.085 && s.p.hp < s.p.maxHp) drop(e.x, e.y, 'H');
      else if (r < 0.105) drop(e.x, e.y, 'S');
      else if (r < 0.12) drop(e.x, e.y, 'B');
    }
    function drop(x, y, kind) { s.items.push({ x, y, kind, t: 0 }); }

    function bomb() {
      sfx.bomb();
      api.flash(0.8);
      api.shake(14);
      api.ring(s.p.x, s.p.y, '#fde047', 520, 10);
      for (const b of s.bullets) api.burst(b.x, b.y, b.color, 2, 80, 0.4, 2);
      s.bullets.length = 0;
      for (const e of s.enemies) { e.hp -= e.type === 'boss' ? 25 : 30; e.hit = 0.15; }
      s.enemies = s.enemies.filter(e => { if (e.hp <= 0) { killEnemy(e); return false; } return true; });
    }

    function updateEnemy(e, dt) {
      e.t += dt;
      e.hit = Math.max(0, e.hit - dt);
      const w = s.wave;
      if (e.type === 'drone') {
        e.y += e.vy * dt;
        e.x += Math.cos(e.t * 2.2 + (e.phase || 0)) * 70 * dt;
        e.fire -= dt;
        if (w >= 2 && e.fire <= 0 && e.y > 30 && e.y < H * 0.6) { e.fire = rand(2.2, 3.6) - Math.min(1.2, w * 0.08); enemyShot(e.x, e.y, aimAt(e), 170 + w * 6); }
      } else if (e.type === 'dart') {
        if (e.mode === 0) {
          e.y += e.vy * dt;
          if (e.y > e.stop) { e.mode = 1; e.t = 0; }
        } else if (e.mode === 1) {
          e.y += 20 * dt;
          if (e.t > 0.45) { e.mode = 2; const a = aimAt(e); e.vx = Math.cos(a) * 380; e.vy = Math.sin(a) * 380; }
        } else { e.x += e.vx * dt; e.y += e.vy * dt; }
      } else if (e.type === 'tank') {
        e.y += e.vy * dt;
        e.fire -= dt;
        if (e.fire <= 0 && e.y > 20) {
          e.fire = Math.max(0.9, 1.8 - w * 0.05);
          const a = aimAt(e);
          for (const d of [-0.28, 0, 0.28]) enemyShot(e.x, e.y + 14, a + d, 160 + w * 5, '#c084fc', 6);
        }
      } else if (e.type === 'orbiter') {
        e.life -= dt;
        if (e.life > 0) { e.x += (e.tx - e.x) * Math.min(1, dt * 1.8); e.y += (e.ty - e.y) * Math.min(1, dt * 1.8); }
        else { e.y -= 160 * dt; }
        e.fire -= dt;
        if (e.fire <= 0 && e.life > 0 && e.t > 1) {
          e.fire = Math.max(1.3, 2.4 - w * 0.06);
          const n = 8 + Math.min(6, Math.floor(w / 3));
          const off = rand(0, TAU);
          for (let i = 0; i < n; i++) enemyShot(e.x, e.y, off + (i / n) * TAU, 140 + w * 4, '#fde047', 5);
        }
      } else if (e.type === 'boss') {
        updateBoss(e, dt);
      }
    }

    function updateBoss(e, dt) {
      const rage = e.hp < e.maxHp * 0.5;
      if (e.y < 130) { e.y += 70 * dt; return; }
      e.x = W / 2 + Math.sin(e.t * 0.6) * (W / 2 - 70);
      e.spin += dt * (rage ? 2.4 : 1.4);
      e.patT -= dt;
      if (e.patT <= 0) { e.pattern = (e.pattern + 1) % 3; e.patT = rage ? 3.2 : 4; e.fire = 0.3; }
      e.fire -= dt;
      if (e.fire > 0) return;
      const speedUp = 1 + e.tier * 0.08 + (rage ? 0.2 : 0);
      if (e.pattern === 0) {
        e.fire = rage ? 0.7 : 1;
        const n = 18 + e.tier * 2;
        for (let i = 0; i < n; i++) enemyShot(e.x, e.y + 10, e.spin + (i / n) * TAU, 150 * speedUp, '#ff5fa0', 5);
      } else if (e.pattern === 1) {
        e.fire = rage ? 0.45 : 0.65;
        const a = aimAt(e);
        for (let i = -3; i <= 3; i++) enemyShot(e.x, e.y + 30, a + i * 0.12, 220 * speedUp, '#fb923c', 5);
      } else {
        e.fire = 0.07;
        for (const k of [0, Math.PI]) enemyShot(e.x, e.y, e.spin * 2.2 + k, 170 * speedUp, '#c084fc', 4.5);
      }
    }

    function update(dt) {
      s.t += dt;
      const p = s.p;
      // movement
      let kx = 0, ky = 0;
      const k = api.keys;
      if (k.has('arrowleft') || k.has('a')) kx -= 1;
      if (k.has('arrowright') || k.has('d')) kx += 1;
      if (k.has('arrowup') || k.has('w')) ky -= 1;
      if (k.has('arrowdown') || k.has('s')) ky += 1;
      const prevX = p.x;
      if (kx || ky) {
        const n = Math.hypot(kx, ky);
        p.tx = p.x + (kx / n) * 340 * dt; p.ty = p.y + (ky / n) * 340 * dt;
        p.x = p.tx; p.y = p.ty;
      } else {
        p.x += (p.tx - p.x) * Math.min(1, dt * 22);
        p.y += (p.ty - p.y) * Math.min(1, dt * 22);
      }
      p.x = clamp(p.x, 16, W - 16); p.y = clamp(p.y, 40, H - 24);
      p.tx = clamp(p.tx, 16, W - 16); p.ty = clamp(p.ty, 40, H - 24);
      p.tilt += (clamp((p.x - prevX) / Math.max(dt, 0.001) / 600, -1, 1) - p.tilt) * Math.min(1, dt * 10);
      p.inv = Math.max(0, p.inv - dt);
      p.shield = Math.max(0, p.shield - dt);

      // firing
      p.fire -= dt;
      if (p.fire <= 0) { fire(); p.fire = 0.11; }

      // waves
      if (s.wave === 0 || (s.toSpawn <= 0 && !s.enemies.length)) {
        s.waveDelay -= dt;
        if (s.waveDelay <= 0) { nextWave(); s.waveDelay = 1.6; }
      }
      if (s.toSpawn > 0) {
        s.spawnT -= dt;
        if (s.spawnT <= 0) { spawnOne(); s.toSpawn--; s.spawnT = Math.max(0.28, 0.95 - s.wave * 0.05) * rand(0.7, 1.3); }
      }

      // player shots
      for (let i = s.shots.length - 1; i >= 0; i--) {
        const b = s.shots[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y < -20 || b.x < -20 || b.x > W + 20) { s.shots.splice(i, 1); continue; }
        for (const e of s.enemies) {
          if (e.y < -10) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 4) {
            e.hp -= b.dmg; e.hit = 0.06;
            api.burst(b.x, b.y, '#bae6fd', 3, 120, 0.25, 2);
            if (e.type === 'boss') sfx.hit();
            s.shots.splice(i, 1);
            break;
          }
        }
      }
      // enemies
      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const e = s.enemies[i];
        if (e.hp <= 0) { s.enemies.splice(i, 1); killEnemy(e); continue; }
        updateEnemy(e, dt);
        if (e.type !== 'boss' && (e.y > H + 40 || e.y < -120 || e.x < -60 || e.x > W + 60)) { s.enemies.splice(i, 1); continue; }
        if (api.state !== 'playing') return;
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 8) {
          if (e.type !== 'boss') { e.hp = 0; }
          hurtPlayer();
          if (api.state !== 'playing') return;
        }
      }
      // enemy bullets
      for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y > H + 20 || b.y < -40 || b.x < -20 || b.x > W + 20) { s.bullets.splice(i, 1); continue; }
        if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + 4) {
          s.bullets.splice(i, 1);
          hurtPlayer();
          if (api.state !== 'playing') return;
        }
      }
      // items
      for (let i = s.items.length - 1; i >= 0; i--) {
        const it = s.items[i];
        it.t += dt;
        const d = Math.hypot(it.x - p.x, it.y - p.y);
        if (d < 90) { it.x += (p.x - it.x) * Math.min(1, dt * 6); it.y += (p.y - it.y) * Math.min(1, dt * 6); }
        else it.y += 95 * dt;
        if (d < 24) {
          s.items.splice(i, 1);
          sfx.item();
          api.ring(it.x, it.y, '#ffffff', 40);
          if (it.kind === 'P') {
            if (p.level < 5) { p.level++; api.text(p.x, p.y - 40, `무기 Lv.${p.level}`, '#7dd3fc', 18, true); }
            else { s.score += 500; api.text(p.x, p.y - 40, '+500', '#7dd3fc', 18, true); }
          } else if (it.kind === 'H') { p.hp = Math.min(p.maxHp, p.hp + 1); api.text(p.x, p.y - 40, '체력 +1', '#fb7185', 18, true); }
          else if (it.kind === 'S') { p.shield = 8; api.text(p.x, p.y - 40, '실드!', '#c4b5fd', 18, true); }
          else if (it.kind === 'B') { api.text(p.x, p.y - 40, '폭탄!', '#fde047', 20, true); bomb(); }
          continue;
        }
        if (it.y > H + 30) s.items.splice(i, 1);
      }
      scenery(dt);
    }

    function scenery(dt) {
      for (const st of stars) { st.y += (40 + st.z * 160) * dt; if (st.y > H) { st.y = 0; st.x = rand(0, W); } }
      gridY = (gridY + dt * 60) % 40;
    }

    // ---------- drawing ----------
    const ITEM = { P: ['#38bdf8', 'P'], S: ['#a78bfa', 'S'], H: ['#fb7185', '♥'], B: ['#fbbf24', 'B'] };
    function draw(c) {
      const bg = c.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#060a24'); bg.addColorStop(1, '#120a2e');
      c.fillStyle = bg; c.fillRect(-20, -20, W + 40, H + 40);
      c.strokeStyle = 'rgba(56,189,248,0.07)'; c.lineWidth = 1;
      c.beginPath();
      for (let x = 0; x <= W; x += 40) { c.moveTo(x, 0); c.lineTo(x, H); }
      for (let y = gridY - 40; y <= H; y += 40) { c.moveTo(0, y); c.lineTo(W, y); }
      c.stroke();
      for (const st of stars) { c.globalAlpha = 0.3 + st.z * 0.6; c.fillStyle = st.z > 0.8 ? '#e0f2fe' : '#93c5fd'; c.fillRect(st.x, st.y, st.z * 2, st.z * 2 + (st.z > 0.7 ? 3 : 0)); }
      c.globalAlpha = 1;
      if (!s) return;

      // items
      for (const it of s.items) {
        const [col, label] = ITEM[it.kind];
        const bob = Math.sin(it.t * 6) * 2;
        c.globalCompositeOperation = 'lighter'; api.glow(col, it.x, it.y + bob, 28); c.globalCompositeOperation = 'source-over';
        c.fillStyle = 'rgba(8,10,30,0.9)'; c.strokeStyle = col; c.lineWidth = 2;
        c.beginPath(); c.roundRect ? c.roundRect(it.x - 12, it.y - 12 + bob, 24, 24, 7) : c.rect(it.x - 12, it.y - 12 + bob, 24, 24); c.fill(); c.stroke();
        c.fillStyle = col; c.font = '900 14px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(label, it.x, it.y + 1 + bob);
      }
      // enemies
      for (const e of s.enemies) drawEnemy(c, e);
      // player shots
      c.globalCompositeOperation = 'lighter';
      for (const b of s.shots) {
        c.fillStyle = '#7dd3fc'; c.fillRect(b.x - 2, b.y - 9, 4, 18);
        c.fillStyle = '#ffffff'; c.fillRect(b.x - 1, b.y - 7, 2, 14);
      }
      // enemy bullets
      for (const b of s.bullets) api.glow(b.color, b.x, b.y, b.r * 3.2);
      c.globalCompositeOperation = 'source-over';
      for (const b of s.bullets) {
        c.fillStyle = b.color; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(b.x, b.y, b.r * 0.5, 0, TAU); c.fill();
      }
      if (api.state !== 'dying' && api.state !== 'over') drawPlayer(c);
      // boss bar
      const boss = s.enemies.find(e => e.type === 'boss');
      if (boss) {
        const k = Math.max(0, boss.hp / boss.maxHp);
        c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(20, 14, W - 40, 8);
        const g = c.createLinearGradient(20, 0, W - 20, 0);
        g.addColorStop(0, '#ff3d7f'); g.addColorStop(1, '#fbbf24');
        c.fillStyle = g; c.fillRect(20, 14, (W - 40) * k, 8);
        c.fillStyle = '#ffffff'; c.font = '800 10px system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top';
        c.fillText('BOSS', 20, 26);
      }
      // status chips
      const chips = [];
      chips.push([`Lv.${s.p.level}`, '#38bdf8']);
      if (s.p.shield > 0) chips.push([`S ${Math.ceil(s.p.shield)}`, '#a78bfa']);
      c.font = '800 11px system-ui, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center';
      chips.forEach(([label, col], i) => {
        const x = 12 + i * 52, y = H - 22;
        c.fillStyle = 'rgba(8,10,30,0.75)'; c.strokeStyle = col; c.lineWidth = 1.5;
        c.beginPath(); c.roundRect ? c.roundRect(x, y - 10, 46, 20, 10) : c.rect(x, y - 10, 46, 20); c.fill(); c.stroke();
        c.fillStyle = col; c.fillText(label, x + 23, y + 1);
      });
    }

    function drawPlayer(c) {
      const p = s.p;
      if (p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0) return;
      c.save();
      c.translate(p.x, p.y);
      c.globalCompositeOperation = 'lighter';
      api.glow('#38bdf8', 0, 4, 46);
      // engine flame
      const fl = 10 + Math.random() * 8;
      api.glow('#f472b6', 0, 20 + fl * 0.4, 16);
      c.fillStyle = '#fbcfe8'; c.beginPath(); c.moveTo(-5, 14); c.lineTo(0, 16 + fl); c.lineTo(5, 14); c.fill();
      c.globalCompositeOperation = 'source-over';
      c.scale(1 - Math.abs(p.tilt) * 0.25, 1);
      c.fillStyle = '#0c4a6e';
      c.beginPath(); c.moveTo(0, -20); c.lineTo(18, 14); c.lineTo(6, 9); c.lineTo(0, 15); c.lineTo(-6, 9); c.lineTo(-18, 14); c.closePath(); c.fill();
      c.strokeStyle = '#7dd3fc'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#e0f2fe';
      c.beginPath(); c.moveTo(0, -14); c.lineTo(5, 2); c.lineTo(0, 6); c.lineTo(-5, 2); c.closePath(); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 2, 2.6, 0, TAU); c.fill(); // hitbox
      c.restore();
      if (p.shield > 0) {
        c.strokeStyle = `rgba(196,181,253,${0.5 + Math.sin(s.t * 10) * 0.25})`; c.lineWidth = 2.5;
        c.beginPath(); c.arc(p.x, p.y, 28, 0, TAU); c.stroke();
      }
    }

    function drawEnemy(c, e) {
      const flash = e.hit > 0;
      c.save();
      c.translate(e.x, e.y);
      c.globalCompositeOperation = 'lighter';
      api.glow(e.color, 0, 0, e.r * 2.6);
      c.globalCompositeOperation = 'source-over';
      const fill = flash ? '#ffffff' : '#140b2e';
      c.fillStyle = fill; c.strokeStyle = flash ? '#ffffff' : e.color; c.lineWidth = 2.2;
      if (e.type === 'drone') {
        c.rotate(e.t * 2);
        c.beginPath(); c.moveTo(0, -e.r); c.lineTo(e.r, 0); c.lineTo(0, e.r); c.lineTo(-e.r, 0); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = e.color; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill();
      } else if (e.type === 'dart') {
        const a = e.mode === 2 ? Math.atan2(e.vy, e.vx) : Math.PI / 2;
        c.rotate(a - Math.PI / 2);
        c.beginPath(); c.moveTo(0, e.r + 4); c.lineTo(e.r, -e.r); c.lineTo(0, -e.r * 0.4); c.lineTo(-e.r, -e.r); c.closePath(); c.fill(); c.stroke();
      } else if (e.type === 'tank') {
        c.beginPath();
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; c.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r); }
        c.closePath(); c.fill(); c.stroke();
        c.fillStyle = e.color; c.fillRect(-4, 4, 8, 16);
        c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill();
      } else if (e.type === 'orbiter') {
        c.rotate(e.t * 3);
        c.beginPath(); c.arc(0, 0, e.r, 0, TAU); c.fill(); c.stroke();
        for (let i = 0; i < 4; i++) { c.rotate(TAU / 4); c.fillStyle = e.color; c.fillRect(e.r - 2, -3, 8, 6); }
        c.fillStyle = e.color; c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fill();
      } else if (e.type === 'boss') {
        c.save(); c.rotate(e.spin);
        c.strokeStyle = flash ? '#ffffff' : '#fbbf24'; c.lineWidth = 3;
        c.setLineDash([10, 8]); c.beginPath(); c.arc(0, 0, e.r + 14, 0, TAU); c.stroke(); c.setLineDash([]);
        c.restore();
        c.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, rr = i % 2 ? e.r * 0.78 : e.r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        c.closePath(); c.fill(); c.lineWidth = 3; c.stroke();
        const core = c.createRadialGradient(0, 0, 2, 0, 0, 20);
        core.addColorStop(0, '#ffffff'); core.addColorStop(1, e.hp < e.maxHp * 0.5 ? '#ff1f5a' : '#ff6fa8');
        c.fillStyle = flash ? '#ffffff' : core;
        c.beginPath(); c.arc(0, 0, 18 + Math.sin(e.t * 6) * 2, 0, TAU); c.fill();
        c.fillStyle = '#140b2e'; c.fillRect(-26, 26, 12, 14); c.fillRect(14, 26, 12, 14);
      }
      c.restore();
      if (e.type !== 'boss' && e.maxHp > 2 && e.hp < e.maxHp) {
        c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(e.x - 14, e.y - e.r - 9, 28, 3);
        c.fillStyle = e.color; c.fillRect(e.x - 14, e.y - e.r - 9, 28 * (e.hp / e.maxHp), 3);
      }
    }

    return {
      init() { reset(); },
      update,
      idle(dt) { scenery(dt); },
      draw,
      hud() {
        if (!s) return {};
        s.shown += (s.score - s.shown) * 0.2;
        if (Math.abs(s.score - s.shown) < 1) s.shown = s.score;
        return { score: api.fmt(s.shown), wave: String(Math.max(1, s.wave)), mult: `x${s.mult}`, hp: `♥${Math.max(0, s.p.hp)}` };
      },
      pointerDown(x, y, e) {
        if (e.pointerType === 'mouse') { s.mouse = true; s.p.tx = x; s.p.ty = y; return; }
        s.drag = { id: e.pointerId, ox: s.p.x - x, oy: s.p.y - y };
      },
      pointerMove(x, y, e) {
        if (e.pointerType === 'mouse') { s.p.tx = x; s.p.ty = y; return; }
        if (s.drag && s.drag.id === e.pointerId) { s.p.tx = x + s.drag.ox; s.p.ty = y + s.drag.oy; }
      },
      pointerUp(x, y, e) { if (s.drag && s.drag.id === e.pointerId) s.drag = null; },
    };
  },
});
