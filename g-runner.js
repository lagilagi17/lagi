'use strict';
// 달려라 냥이 — endless rooftop runner (tap/hold to jump, swipe down to slide).
HanQArcade.register({
  id: 'runner',
  title: '달려라 냥이',
  tagline: '점프·슬라이드 러너',
  theme: { card: 'linear-gradient(160deg,#3b1d5e,#140a2a 70%)', border: 'rgba(251,146,60,.4)', stage: '#1e1038' },
  intro: '밤의 지붕 위를 달리는 고양이!<br><b class="c-jelly">탭</b>하면 점프(길게 누르면 높이, 공중에서 한 번 더!)<br><b class="c-rock">아래로 스와이프</b>하면 슬라이드. 생선을 모으세요!',
  hud: [
    { key: 'score', label: '점수', wide: true },
    { key: 'dist', label: '거리', initial: '0m' },
    { key: 'fish', label: '생선', initial: '0' },
  ],
  overStats: [
    { key: 'dist', label: '거리', format: v => `${Math.floor(v || 0)}m` },
    { key: 'fish', label: '생선' },
    { key: 'jumps', label: '점프' },
    { key: 'stars', label: '무적 별' },
  ],
  controls: [
    [['탭', 'Space', '↑'], '점프 (길게 = 높이)'],
    [['공중에서 탭'], '2단 점프'],
    [['↓ 스와이프', '↓'], '슬라이드 / 빠른 착지'],
    [['P'], '일시정지'],
  ],
  tip: '낮게 나는 까마귀는 점프로, 가운데 높이의 까마귀는 슬라이드로 피하세요. 지붕 사이 틈에 빠지면 끝!',
  legend: [
    { name: '상자 · 콘', desc: '점프로 넘어가요.', color: '#b45309', ring: '#fef3c7', square: true },
    { name: '까마귀', desc: '높이를 보고 점프 또는 슬라이드.', color: '#334155', ring: '#e2e8f0' },
    { name: '생선', desc: '+10점.', color: '#38bdf8', ring: '#e0f2fe' },
    { name: '무적 별', desc: '5초 동안 장애물을 부수고 달려요.', color: '#facc15', ring: '#fef9c3' },
  ],
  icon(c, s) {
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#3b1d5e'); g.addColorStop(1, '#f472b6');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    c.fillStyle = '#fef3c7'; c.beginPath(); c.arc(66, 20, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1e1038'; c.fillRect(0, 64, s, 24);
    c.fillStyle = '#fb923c';
    c.beginPath(); c.ellipse(38, 52, 16, 9, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(54, 44, 9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(48, 38); c.lineTo(50, 28); c.lineTo(55, 36); c.fill();
    c.beginPath(); c.moveTo(56, 36); c.lineTo(61, 28); c.lineTo(62, 39); c.fill();
    c.strokeStyle = '#fb923c'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(23, 50); c.quadraticCurveTo(12, 40, 18, 30); c.stroke();
    c.fillStyle = '#1e1038'; c.beginPath(); c.arc(57, 43, 1.8, 0, Math.PI * 2); c.fill();
  },
  dyingTime: 1.2,
  updateWhileDying: true,
  create(api) {
    const { W, H, TAU, rand, clamp } = api;
    const GROUND = 470;
    const CAT_X = 130;
    const G_UP = 1500;
    const G_DOWN = 2500;
    const JUMP_V = 760;
    const DJUMP_V = 660;
    let s;
    let clock = 0;
    const starsBg = Array.from({ length: 60 }, () => ({ x: rand(0, W), y: rand(0, 300), r: rand(0.6, 1.8), tw: rand(0, TAU) }));
    function skyline(seed, count, minH, maxH) {
      let x = 0;
      const out = [];
      for (let i = 0; i < count; i++) {
        const w = 40 + ((seed * (i + 3) * 37) % 70);
        const h = minH + ((seed * (i + 7) * 53) % (maxH - minH));
        const wins = [];
        for (let wy = 10; wy < h - 10; wy += 16) for (let wx = 8; wx < w - 8; wx += 12) if (((seed + i * 31 + wx * 7 + wy * 13) % 9) < 3) wins.push([wx, wy]);
        out.push({ x, w, h, wins });
        x += w + 6;
      }
      return { list: out, width: x };
    }
    const far = skyline(7, 24, 80, 220);
    const near = skyline(13, 20, 60, 160);

    function reset() {
      s = {
        t: 0, dist: 0, speed: 310, score: 0, shown: 0, fish: 0, jumps: 0, starsGot: 0,
        cat: { y: GROUND, vy: 0, onGround: true, coyote: 0, buffer: 0, holding: false, holdT: 0, double: true, duck: false, duckKey: false, run: 0, jumpedAt: -1, inv: 0, squash: 0 },
        obs: [], fishes: [], powers: [], gaps: [], nextObs: 700, nextFish: 400, nextPower: 2600, touch: null, deathT: 0,
      };
    }
    const speedNow = () => s.speed;
    const groundAt = x => !s.gaps.some(g => x > g.x + 6 && x < g.x + g.w - 6);

    // ----- spawning (positions are in world-distance units, converted to screen x) -----
    function spawnObstacle() {
      const sp = s.speed;
      const roll = Math.random();
      const x = W + 40;
      const d = s.dist;
      if (d > 300 && roll < 0.18) {
        const w = rand(80, 110 + Math.min(60, d / 60));
        s.gaps.push({ x, w });
        s.nextObs = w + rand(260, 420) * (sp / 310);
        return;
      }
      if (d > 150 && roll < 0.42) {
        const kind = Math.random() < 0.5 ? 'low' : 'mid';
        s.obs.push({ type: 'bird', x, y: kind === 'low' ? GROUND - 20 : GROUND - 40, w: 34, h: 18, flap: rand(0, TAU) });
      } else if (roll < 0.7) {
        const stack = d > 400 && Math.random() < 0.35 ? 2 : 1;
        const w = Math.random() < 0.4 ? 62 : 34;
        s.obs.push({ type: 'box', x, y: GROUND - 34 * stack, w, h: 34 * stack });
      } else {
        s.obs.push({ type: 'cone', x, y: GROUND - 30, w: 24, h: 30 });
        if (d > 250 && Math.random() < 0.4) s.obs.push({ type: 'cone', x: x + 28, y: GROUND - 30, w: 24, h: 30 });
      }
      s.nextObs = rand(300, 520) * Math.sqrt(sp / 310);
      // fish arc over the obstacle
      if (Math.random() < 0.5) for (let i = 0; i < 5; i++) s.fishes.push({ x: x - 60 + i * 34, y: GROUND - 90 - Math.sin((i / 4) * Math.PI) * 60, got: false, t: rand(0, TAU) });
    }

    function jumpPress() {
      const c = s.cat;
      c.holding = true;
      c.buffer = 0.12;
      tryJump();
    }
    function tryJump() {
      const c = s.cat;
      if (c.onGround || c.coyote > 0) {
        c.vy = -JUMP_V; c.onGround = false; c.coyote = 0; c.buffer = 0; c.holdT = 0.22; c.double = true; c.duck = false;
        c.jumpedAt = s.t; c.squash = -0.3;
        s.jumps++;
        api.tone(520, 0.12, 'sine', 0.14, 1.8);
        api.burst(CAT_X, GROUND, '#c4b5fd', 6, 90, 0.4, 3, 300);
      } else if (c.double && c.buffer > 0 && c.buffer >= 0.119) {
        c.vy = -DJUMP_V; c.double = false; c.buffer = 0; c.holdT = 0.14; c.squash = -0.3;
        s.jumps++;
        api.tone(760, 0.12, 'sine', 0.13, 1.8);
        api.ring(CAT_X, c.y - 18, '#f5d0fe', 34, 2);
      }
    }
    function jumpRelease() { s.cat.holding = false; }
    function duckStart() {
      const c = s.cat;
      // a swipe that began with a tap: cancel the tiny jump it caused
      if (!c.onGround && c.jumpedAt >= 0 && s.t - c.jumpedAt < 0.16 && c.double) { c.y = GROUND; c.vy = 0; c.onGround = true; s.jumps--; }
      c.duck = true;
      if (!c.onGround) { c.vy = Math.max(c.vy, 900); }
      api.tone(220, 0.08, 'sine', 0.08, 0.7);
    }

    function catBox() {
      const c = s.cat;
      const h = c.duck && c.onGround ? 20 : 34;
      return { x: CAT_X - 20, y: c.y - h, w: 40, h };
    }
    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    function update(dt) {
      clock += dt;
      if (api.state === 'dying') {
        const c = s.cat;
        c.vy += G_DOWN * dt; c.y += c.vy * dt;
        return;
      }
      s.t += dt;
      s.speed = Math.min(780, s.speed + 7 * dt);
      const sp = speedNow();
      const dx = sp * dt;
      s.dist += dx / 30;
      s.score = Math.floor(s.dist) + s.fish * 10;

      // world scroll
      for (const o of s.obs) o.x -= dx;
      for (const f of s.fishes) f.x -= dx;
      for (const p of s.powers) p.x -= dx;
      for (const g of s.gaps) g.x -= dx;
      s.obs = s.obs.filter(o => o.x > -100 && !o.dead);
      s.fishes = s.fishes.filter(f => f.x > -40 && !f.got);
      s.powers = s.powers.filter(p => p.x > -40 && !p.got);
      s.gaps = s.gaps.filter(g => g.x + g.w > -20);
      s.nextObs -= dx;
      if (s.nextObs <= 0) spawnObstacle();
      s.nextFish -= dx;
      if (s.nextFish <= 0) {
        const n = 4 + Math.floor(Math.random() * 4);
        const high = Math.random() < 0.4;
        for (let i = 0; i < n; i++) s.fishes.push({ x: W + 30 + i * 32, y: high ? GROUND - 110 : GROUND - 26, got: false, t: rand(0, TAU) });
        s.nextFish = rand(500, 900);
      }
      s.nextPower -= dx;
      if (s.nextPower <= 0) { s.powers.push({ x: W + 30, y: GROUND - 120, got: false, t: 0 }); s.nextPower = rand(3500, 5500); }

      // cat physics
      const c = s.cat;
      c.inv = Math.max(0, c.inv - dt);
      c.buffer = Math.max(0, c.buffer - dt);
      c.coyote = Math.max(0, c.coyote - dt);
      c.squash *= Math.pow(0.001, dt);
      if (!c.onGround) {
        let g = c.vy > 0 ? G_DOWN : G_UP;
        if (c.holding && c.holdT > 0 && c.vy < 0) { g *= 0.45; c.holdT -= dt; }
        else if (!c.holding && c.vy < 0) g *= 1.6;
        c.vy += g * dt;
        const prevY = c.y;
        c.y += c.vy * dt;
        if (prevY <= GROUND + 2 && c.y >= GROUND && c.vy > 0 && groundAt(CAT_X)) {
          c.y = GROUND; c.vy = 0; c.onGround = true; c.double = true; c.squash = 0.35;
          api.burst(CAT_X, GROUND, '#a78bfa', 5, 80, 0.35, 3, 300);
          api.tone(140, 0.06, 'sine', 0.1);
          if (c.buffer > 0) tryJump();
          if (c.duckKey) c.duck = true;
        }
      } else if (!groundAt(CAT_X)) {
        c.onGround = false; c.coyote = 0.08;
      }
      if (c.onGround && !c.duckKey && !s.touchDuck) c.duck = false;
      c.run += dt * sp / 28;
      if (c.onGround && Math.random() < dt * 12) api.burst(CAT_X - 18, GROUND - 2, '#c4b5fd', 1, 60, 0.3, 2, 0);

      if (c.y > GROUND + 70) { die('지붕 사이로 떨어졌어요'); return; }

      const box = catBox();
      for (const o of s.obs) {
        if (o.dead) continue;
        const ob = o.type === 'bird' ? { x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h } : { x: o.x + 3, y: o.y + 3, w: o.w - 6, h: o.h - 3 };
        if (overlap(box, ob)) {
          if (c.inv > 0) {
            o.dead = true;
            s.score += 20;
            api.burst(o.x, o.y + 10, '#fde047', 16, 260, 0.6, 3, 400);
            api.text(o.x, o.y - 20, 'SMASH!', '#fde047', 18, true);
            api.tone(300, 0.12, 'square', 0.08, 0.5);
            api.shake(4);
          } else { die('장애물에 부딪혔어요'); return; }
        }
        if (o.type === 'bird') o.flap += dt * 14;
      }
      for (const f of s.fishes) {
        f.t += dt;
        if (!f.got && Math.abs(f.x - CAT_X) < 26 && Math.abs(f.y - (c.y - 18)) < 30) {
          f.got = true; s.fish++;
          api.burst(f.x, f.y, '#7dd3fc', 6, 120, 0.4, 2.5);
          api.tone(1046 + (s.fish % 5) * 90, 0.07, 'sine', 0.1);
        }
      }
      for (const p of s.powers) {
        p.t += dt;
        if (!p.got && Math.abs(p.x - CAT_X) < 30 && Math.abs(p.y - (c.y - 18)) < 34) {
          p.got = true; c.inv = 5; s.starsGot++;
          api.text(CAT_X, c.y - 60, '무적!', '#fde047', 22, true);
          api.ring(CAT_X, c.y - 18, '#fde047', 60, 3);
          [784, 988, 1175, 1568].forEach((f, i) => api.tone(f, 0.1, 'triangle', 0.13, 1, i * 0.05));
        }
      }
      if (Math.floor(s.dist / 100) > Math.floor((s.dist - dx / 30) / 100)) {
        api.text(W / 2, 120, `${Math.floor(s.dist / 100) * 100}m!`, '#fbcfe8', 26, true);
        api.tone(880, 0.1, 'triangle', 0.1); api.tone(1320, 0.14, 'triangle', 0.1, 1, 0.08);
      }
    }
    function die(reason) {
      const c = s.cat;
      c.vy = -500; c.onGround = false;
      api.burst(CAT_X, c.y - 18, '#fb923c', 24, 260, 0.7, 3.5, 600);
      api.shake(10);
      api.haptic([40, 30, 60]);
      api.tone(400, 0.15, 'square', 0.1, 0.5); api.tone(200, 0.4, 'triangle', 0.15, 0.5, 0.12);
      api.end(reason, { score: s.score, dist: s.dist, fish: s.fish, jumps: s.jumps, stars: s.starsGot });
    }

    // ---------- drawing ----------
    function draw(c) {
      const sky = c.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#1b0f3a'); sky.addColorStop(0.65, '#5b2a7a'); sky.addColorStop(1, '#f472b6');
      c.fillStyle = sky; c.fillRect(-20, -20, W + 40, H + 40);
      for (const st of starsBg) { c.globalAlpha = 0.4 + 0.5 * Math.sin(clock * 2 + st.tw); c.fillStyle = '#fff'; c.fillRect(st.x, st.y, st.r, st.r); }
      c.globalAlpha = 1;
      api.glow('#fde68a', 470, 100, 80);
      c.fillStyle = '#fef3c7'; c.beginPath(); c.arc(470, 100, 30, 0, TAU); c.fill();
      c.fillStyle = 'rgba(253,230,138,0.6)'; c.beginPath(); c.arc(460, 92, 5, 0, TAU); c.arc(480, 110, 3.5, 0, TAU); c.fill();
      const dist = s ? s.dist * 30 : clock * 120;
      drawSkyline(c, far, dist * 0.15, GROUND - 40, '#341a5a', 'rgba(253,224,71,0.35)');
      drawSkyline(c, near, dist * 0.35, GROUND - 10, '#24123f', 'rgba(253,224,71,0.55)');
      // rooftop ground with gaps
      const gaps = s ? s.gaps : [];
      c.fillStyle = '#140a26';
      c.fillRect(-20, GROUND, W + 40, H - GROUND + 20);
      c.fillStyle = '#6d28d9'; c.fillRect(-20, GROUND, W + 40, 4);
      c.fillStyle = 'rgba(167,139,250,0.25)';
      const off = (dist % 60);
      for (let x = -off; x < W + 60; x += 60) c.fillRect(x, GROUND + 14, 30, 3);
      for (const g of gaps) {
        const sg = c.createLinearGradient(0, GROUND, 0, H);
        sg.addColorStop(0, '#2a1250'); sg.addColorStop(1, '#05020c');
        c.fillStyle = sg; c.fillRect(g.x, GROUND, g.w, H - GROUND + 20);
        c.fillStyle = '#a78bfa'; c.fillRect(g.x - 3, GROUND, 3, 30); c.fillRect(g.x + g.w, GROUND, 3, 30);
      }
      if (!s) return;
      // fish
      for (const f of s.fishes) {
        const y = f.y + Math.sin(f.t * 5) * 3;
        c.save(); c.translate(f.x, y);
        c.fillStyle = '#7dd3fc';
        c.beginPath(); c.ellipse(0, 0, 10, 6, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(8, 0); c.lineTo(15, -6); c.lineTo(15, 6); c.closePath(); c.fill();
        c.fillStyle = '#0c4a6e'; c.beginPath(); c.arc(-5, -1.5, 1.4, 0, TAU); c.fill();
        c.restore();
      }
      for (const p of s.powers) {
        const y = p.y + Math.sin(p.t * 4) * 6;
        c.globalCompositeOperation = 'lighter'; api.glow('#facc15', p.x, y, 34); c.globalCompositeOperation = 'source-over';
        c.save(); c.translate(p.x, y); c.rotate(p.t * 2);
        c.fillStyle = '#fde047'; c.strokeStyle = '#f59e0b'; c.lineWidth = 2;
        c.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = -Math.PI / 2 + (i / 10) * TAU; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        c.closePath(); c.fill(); c.stroke(); c.restore();
      }
      for (const o of s.obs) drawObstacle(c, o);
      drawCat(c);
      if (s.cat.inv > 0 && api.state === 'playing') {
        c.fillStyle = 'rgba(250,204,21,0.9)'; c.font = '800 12px system-ui'; c.textAlign = 'left'; c.textBaseline = 'top';
        c.fillText(`무적 ${s.cat.inv.toFixed(1)}s`, 14, 14);
      }
    }
    function drawSkyline(c, sk, offset, base, color, winColor) {
      const shift = offset % sk.width;
      c.fillStyle = color;
      for (let rep = 0; rep < 2; rep++) {
        for (const b of sk.list) {
          const x = b.x - shift + rep * sk.width;
          if (x > W || x + b.w < 0) continue;
          c.fillStyle = color; c.fillRect(x, base - b.h, b.w, b.h + 60);
          c.fillStyle = winColor;
          for (const [wx, wy] of b.wins) c.fillRect(x + wx, base - b.h + wy, 5, 7);
        }
      }
    }
    function drawObstacle(c, o) {
      if (o.type === 'box') {
        for (let k = 0; k < o.h / 34; k++) {
          const y = o.y + k * 34;
          c.fillStyle = '#b45309'; c.fillRect(o.x, y, o.w, 34);
          c.strokeStyle = '#78350f'; c.lineWidth = 2; c.strokeRect(o.x + 1, y + 1, o.w - 2, 32);
          c.beginPath(); c.moveTo(o.x + 3, y + 3); c.lineTo(o.x + o.w - 3, y + 31); c.moveTo(o.x + o.w - 3, y + 3); c.lineTo(o.x + 3, y + 31); c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(o.x + 2, y + 2, o.w - 4, 3);
        }
      } else if (o.type === 'cone') {
        c.fillStyle = '#f97316';
        c.beginPath(); c.moveTo(o.x + o.w / 2, o.y); c.lineTo(o.x + o.w, o.y + o.h - 4); c.lineTo(o.x, o.y + o.h - 4); c.closePath(); c.fill();
        c.fillStyle = '#fff'; c.fillRect(o.x + o.w * 0.28, o.y + o.h * 0.45, o.w * 0.44, 4);
        c.fillStyle = '#7c2d12'; c.fillRect(o.x - 3, o.y + o.h - 5, o.w + 6, 5);
      } else {
        c.save(); c.translate(o.x, o.y);
        c.fillStyle = '#1e293b';
        c.beginPath(); c.ellipse(0, 0, 13, 8, 0, 0, TAU); c.fill();
        c.beginPath(); c.arc(-11, -3, 6, 0, TAU); c.fill();
        c.fillStyle = '#f59e0b'; c.beginPath(); c.moveTo(-16, -3); c.lineTo(-23, -1); c.lineTo(-16, 0); c.fill();
        c.fillStyle = '#f8fafc'; c.beginPath(); c.arc(-12, -4, 1.6, 0, TAU); c.fill();
        const wing = Math.sin(o.flap) * 10;
        c.fillStyle = '#334155';
        c.beginPath(); c.moveTo(-4, -2); c.lineTo(8, -2 - wing - 8); c.lineTo(12, -2); c.closePath(); c.fill();
        c.restore();
      }
    }
    function drawCat(c) {
      const k = s.cat;
      const ducking = k.duck && k.onGround;
      c.save();
      c.translate(CAT_X, k.y);
      if (k.inv > 0) { c.globalCompositeOperation = 'lighter'; api.glow('#facc15', 0, -18, 50); c.globalCompositeOperation = 'source-over'; }
      const sq = ducking ? 0.45 : k.squash;
      c.scale(1 + sq * 0.3, 1 - sq * 0.4);
      const body = k.inv > 0 && Math.floor(clock * 20) % 2 ? '#fde047' : '#fb923c';
      const stripe = '#c2410c';
      const run = k.onGround ? Math.sin(k.run) : 0.6;
      // tail
      c.strokeStyle = body; c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-18, -18); c.quadraticCurveTo(-34, -24 + Math.sin(clock * 8) * 6, -30, -40 + Math.sin(clock * 8) * 4); c.stroke();
      // legs
      c.lineWidth = 6;
      for (const [lx, ph] of [[-10, 0], [12, Math.PI]]) {
        const a = k.onGround ? Math.sin(k.run + ph) * 0.7 : 0.9 * (ph ? -1 : 1);
        c.beginPath(); c.moveTo(lx, -10); c.lineTo(lx + Math.sin(a) * 10, -10 + Math.cos(a) * 10); c.stroke();
      }
      // body
      c.fillStyle = body;
      c.beginPath(); c.ellipse(0, -20 - run * 1.5, 22, 13, 0, 0, TAU); c.fill();
      c.fillStyle = stripe;
      for (const sx of [-8, 0, 8]) { c.beginPath(); c.ellipse(sx, -30 - run * 1.5, 2.2, 5, 0, 0, TAU); c.fill(); }
      // head
      const hx = 20, hy = -30 - run * 2;
      c.fillStyle = body;
      c.beginPath(); c.arc(hx, hy, 12, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(hx - 9, hy - 6); c.lineTo(hx - 7, hy - 19); c.lineTo(hx - 1, hy - 10); c.fill();
      c.beginPath(); c.moveTo(hx + 2, hy - 10); c.lineTo(hx + 9, hy - 19); c.lineTo(hx + 11, hy - 5); c.fill();
      c.fillStyle = '#fecdd3';
      c.beginPath(); c.moveTo(hx - 7, hy - 9); c.lineTo(hx - 6.5, hy - 15); c.lineTo(hx - 3.5, hy - 10); c.fill();
      c.fillStyle = '#1e1038';
      if (api.state === 'dying' || api.state === 'over') {
        c.lineWidth = 1.8; c.strokeStyle = '#1e1038';
        c.beginPath(); c.moveTo(hx + 1, hy - 3); c.lineTo(hx + 5, hy + 1); c.moveTo(hx + 5, hy - 3); c.lineTo(hx + 1, hy + 1); c.stroke();
      } else {
        c.beginPath(); c.ellipse(hx + 4, hy - 1, 2, 3, 0, 0, TAU); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + 4.6, hy - 2, 0.8, 0, TAU); c.fill();
      }
      c.fillStyle = '#fb7185'; c.beginPath(); c.arc(hx + 11, hy + 2, 1.8, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(hx + 9, hy + 4); c.lineTo(hx + 18, hy + 3); c.moveTo(hx + 9, hy + 5); c.lineTo(hx + 18, hy + 7); c.stroke();
      c.restore();
    }

    return {
      init() { reset(); },
      update,
      idle(dt) { clock += dt; },
      draw,
      hud() {
        if (!s) return {};
        return { score: api.fmt(s.score), dist: `${Math.floor(s.dist)}m`, fish: String(s.fish) };
      },
      pointerDown(x, y, e) { s.touch = { id: e.pointerId, y, ducked: false }; jumpPress(); },
      pointerMove(x, y, e) {
        const t = s.touch;
        if (!t || t.id !== e.pointerId || t.ducked) return;
        if (y - t.y > 28) { t.ducked = true; s.touchDuck = true; s.cat.holding = false; duckStart(); }
      },
      pointerUp(x, y, e) {
        if (s.touch && s.touch.id === e.pointerId) { s.touch = null; s.touchDuck = false; }
        jumpRelease();
      },
      keyDown(key) {
        if (key === ' ' || key === 'arrowup' || key === 'w') jumpPress();
        if (key === 'arrowdown' || key === 's') { s.cat.duckKey = true; duckStart(); }
      },
      keyUp(key) {
        if (key === ' ' || key === 'arrowup' || key === 'w') jumpRelease();
        if (key === 'arrowdown' || key === 's') s.cat.duckKey = false;
      },
    };
  },
});
