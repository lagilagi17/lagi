'use strict';
// 케이크 타워 — tap to drop sliding cake layers; overhangs get sliced off.
HanQArcade.register({
  id: 'cake',
  title: '케이크 타워',
  tagline: '타이밍 맞춰 높이 쌓기',
  aspect: 'portrait',
  additive: false,
  theme: { card: 'linear-gradient(160deg,#7c2d4f,#3b1029 70%)', border: 'rgba(251,182,206,.45)', stage: '#ffe4ec', overlay: 'linear-gradient(180deg,rgba(80,20,50,.35),rgba(60,15,40,.8))' },
  intro: '좌우로 움직이는 케이크 층을 <b class="c-jelly">탭</b>해서 떨어뜨리세요.<br>아래층 밖으로 삐져나온 부분은 잘려 나가요.<br>딱 맞게 쌓으면 <b>PERFECT</b>, 연속 3번이면 케이크가 다시 넓어져요!',
  hud: [
    { key: 'score', label: '점수', wide: true },
    { key: 'floors', label: '층', initial: '0' },
    { key: 'combo', label: '콤보', initial: 'x0' },
  ],
  overStats: [
    { key: 'floors', label: '층수' },
    { key: 'perfects', label: 'PERFECT' },
    { key: 'maxCombo', label: '최대 콤보', format: v => `x${v || 0}` },
    { key: 'width', label: '마지막 폭', format: v => `${Math.round(v || 0)}` },
  ],
  controls: [
    [['탭', '클릭', 'Space'], '케이크 떨어뜨리기'],
    [['P'], '일시정지'],
  ],
  tip: '층이 올라갈수록 케이크가 빨라져요. PERFECT를 3번 연속하면 폭이 넓어지니 콤보를 노려보세요!',
  legend: [
    { name: 'PERFECT', desc: '아래층과 거의 딱 맞으면 잘리지 않아요.', color: '#fbbf24', ring: '#fef3c7' },
    { name: '콤보 보너스', desc: 'PERFECT 3연속마다 케이크 폭이 넓어져요.', color: '#f472b6', ring: '#fce7f3' },
    { name: '맛 바꾸기', desc: '딸기·초코·바닐라·말차·블루베리 순서로 바뀌어요.', color: '#a3e635', ring: '#ecfccb' },
  ],
  icon(c, s) {
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#ffd1dc'); g.addColorStop(1, '#ffeef3');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    const layers = [['#8b5a3c', '#fff7ed'], ['#f9a8c0', '#ffffff'], ['#fde68a', '#fff7ed']];
    layers.forEach(([sp, cr], i) => {
      const w = 54 - i * 10, x = (s - w) / 2 + (i === 2 ? 4 : 0), y = 66 - i * 16;
      c.fillStyle = sp; c.fillRect(x, y, w, 14);
      c.fillStyle = cr; c.fillRect(x, y, w, 4);
    });
    c.fillStyle = '#e11d48'; c.beginPath(); c.arc(46, 28, 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#166534'; c.lineWidth = 2; c.beginPath(); c.moveTo(46, 22); c.quadraticCurveTo(48, 15, 54, 14); c.stroke();
  },
  dyingTime: 2.2,
  updateWhileDying: true,
  create(api) {
    const { W, H, TAU, rand, clamp, lerp } = api;
    const LH = 32;
    const GROUND = H - 92;
    const START_W = 190;
    const FLAVORS = [
      { sponge: '#f9a8c0', dark: '#e07a9a', cream: '#fff5f8' },
      { sponge: '#8b5a3c', dark: '#6b3f27', cream: '#fff1e6' },
      { sponge: '#fde68a', dark: '#e9c46a', cream: '#fffdf5' },
      { sponge: '#a3c97a', dark: '#7da657', cream: '#fbfff5' },
      { sponge: '#a5b4fc', dark: '#7c87e0', cream: '#f7f8ff' },
    ];
    const SPRINKLES = ['#f472b6', '#60a5fa', '#facc15', '#34d399', '#fb923c', '#ffffff'];
    let s;
    let clock = 0;
    const dots = Array.from({ length: 26 }, () => ({ x: rand(0, W), y: rand(0, 1600), r: rand(4, 12) }));

    function reset() {
      s = {
        layers: [{ x: (W - START_W) / 2, w: START_W, f: 0, sq: 0, sprinkles: [] }],
        moving: null, cuts: [], score: 0, shown: 0, combo: 0, maxCombo: 0, perfects: 0,
        cam: 0, zoom: 1, shift: 0, dir: 1, fallen: null, deadT: 0,
      };
      spawnMoving();
    }
    const floors = () => s.layers.length - 1;
    function layerTop(i) { return GROUND - (i + 1) * LH; }
    function spawnMoving() {
      const top = s.layers[s.layers.length - 1];
      const n = s.layers.length;
      s.dir = n % 2 ? 1 : -1;
      const speed = Math.min(430, 150 + n * 7);
      s.moving = { x: s.dir > 0 ? -top.w : W, w: top.w, f: n % FLAVORS.length, v: speed * s.dir, sq: 0, sprinkles: [] };
    }
    function toScreen(x, y) { return { x: W / 2 + (x - W / 2) * s.zoom, y: GROUND + (y - GROUND + s.shift) * s.zoom }; }

    function drop() {
      if (!s.moving) return;
      const m = s.moving;
      const top = s.layers[s.layers.length - 1];
      const i = s.layers.length;
      const left = Math.max(m.x, top.x);
      const right = Math.min(m.x + m.w, top.x + top.w);
      const y = layerTop(i);
      if (right - left <= 0) {
        s.fallen = { ...m, y, vy: 0, vx: m.v * 0.3, rot: 0 };
        s.moving = null;
        api.tone(300, 0.5, 'sawtooth', 0.12, 0.3);
        api.haptic([30, 30, 60]);
        api.end('케이크가 떨어졌어요', stats());
        return;
      }
      const diff = Math.abs(m.x - top.x);
      const perfect = diff <= Math.max(3, top.w * 0.03);
      let layer;
      if (perfect) {
        s.combo++;
        s.perfects++;
        s.maxCombo = Math.max(s.maxCombo, s.combo);
        let w = top.w, x = top.x;
        if (s.combo % 3 === 0 && w < START_W) {
          const grow = Math.min(14, START_W - w);
          w += grow; x -= grow / 2;
          x = clamp(x, 10, W - 10 - w);
          api.text(W / 2, toScreen(0, y).y - 50, '폭 UP!', '#16a34a', 20, true);
        }
        layer = { x, w, f: m.f, sq: 1, sprinkles: makeSprinkles(w) };
        const bonus = 5 * s.combo;
        s.score += 10 + bonus;
        const p = toScreen(x + w / 2, y);
        api.text(p.x, p.y - 26, s.combo > 1 ? `PERFECT x${s.combo}` : 'PERFECT!', '#f59e0b', 22 + Math.min(10, s.combo), true);
        api.burst(p.x, p.y, '#fde047', 18, 240, 0.7, 4, 500);
        api.ring(p.x, p.y + LH / 2, '#fbbf24', w * 0.6 * s.zoom, 3);
        const note = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760][Math.min(9, s.combo - 1)];
        api.tone(note, 0.18, 'triangle', 0.18); api.tone(note * 1.5, 0.22, 'sine', 0.1, 1, 0.06);
        api.haptic(15);
      } else {
        s.combo = 0;
        layer = { x: left, w: right - left, f: m.f, sq: 0.6, sprinkles: [] };
        // sliced-off piece
        const cutX = m.x < top.x ? m.x : right;
        const cutW = m.w - layer.w;
        s.cuts.push({ x: cutX, w: cutW, y, f: m.f, vy: 0, vx: (m.x < top.x ? -1 : 1) * 60, rot: 0, vr: (m.x < top.x ? -1 : 1) * rand(1.5, 3) });
        s.score += 10;
        api.tone(200, 0.12, 'sine', 0.18, 0.6);
        api.noise(0.08, 0.1, 2000);
        const p = toScreen(cutX + cutW / 2, y);
        api.burst(p.x, p.y + 10, FLAVORS[m.f].cream, 8, 120, 0.5, 3, 600);
      }
      s.layers.push(layer);
      spawnMoving();
    }
    function makeSprinkles(w) {
      return Array.from({ length: Math.max(3, Math.floor(w / 14)) }, () => ({ x: rand(4, w - 4), a: rand(0, Math.PI), c: SPRINKLES[Math.floor(Math.random() * SPRINKLES.length)] }));
    }
    function stats() { return { score: s.score, floors: floors(), perfects: s.perfects, maxCombo: s.maxCombo, width: s.layers[s.layers.length - 1].w }; }

    function update(dt) {
      clock += dt;
      if (s.moving) {
        const m = s.moving;
        m.x += m.v * dt;
        const lo = -m.w * 0.35, hi = W - m.w * 0.65;
        if (m.x < lo) { m.x = lo; m.v = Math.abs(m.v); }
        if (m.x > hi) { m.x = hi; m.v = -Math.abs(m.v); }
      }
      for (const l of s.layers) l.sq = Math.max(0, l.sq - dt * 4);
      for (let i = s.cuts.length - 1; i >= 0; i--) {
        const c = s.cuts[i];
        c.vy += 1500 * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.rot += c.vr * dt;
        if (c.y > GROUND + 400 + s.cam) s.cuts.splice(i, 1);
      }
      if (s.fallen) { const f = s.fallen; f.vy += 1500 * dt; f.y += f.vy * dt; f.x += f.vx * dt; f.rot += f.vx * 0.004 * dt * 10; }

      const n = s.layers.length;
      if (api.state === 'dying') {
        // zoom out to show the whole cake
        const towerH = (n + 1) * LH + 60;
        const fit = Math.min(1, (GROUND - 90) / towerH);
        s.zoom = lerp(s.zoom, fit, Math.min(1, dt * 2.5));
        s.shift = lerp(s.shift, 0, Math.min(1, dt * 2.5));
      } else {
        s.cam = Math.max(0, n * LH - (GROUND - H * 0.42));
        s.shift = lerp(s.shift, s.cam, Math.min(1, dt * 6));
      }
    }

    // ---------- drawing ----------
    function drawLayer(c, l, y, alpha = 1) {
      const fl = FLAVORS[l.f];
      const sq = l.sq || 0;
      const h = LH * (1 - sq * 0.12);
      const yy = y + (LH - h);
      const w = l.w * (1 + sq * 0.04);
      const x = l.x - (w - l.w) / 2;
      c.globalAlpha = alpha;
      // sponge
      const g = c.createLinearGradient(0, yy, 0, yy + h);
      g.addColorStop(0, fl.sponge); g.addColorStop(1, fl.dark);
      c.fillStyle = g;
      c.beginPath(); if (c.roundRect) c.roundRect(x, yy, w, h, 4); else c.rect(x, yy, w, h); c.fill();
      // filling line
      c.fillStyle = fl.cream; c.globalAlpha = alpha * 0.8;
      c.fillRect(x, yy + h * 0.55, w, 3);
      c.globalAlpha = alpha;
      // cream top with drips
      c.fillStyle = fl.cream;
      c.beginPath();
      c.moveTo(x, yy + 7);
      const drips = Math.max(2, Math.floor(w / 22));
      for (let i = 0; i <= drips; i++) {
        const px = x + (i / drips) * w;
        const depth = 7 + ((i * 7919 + Math.floor(l.w)) % 5) * 1.6;
        c.quadraticCurveTo(px - w / drips / 2, yy + depth + 4, px, yy + 7);
      }
      c.lineTo(x + w, yy); c.lineTo(x, yy); c.closePath(); c.fill();
      c.fillRect(x, yy - 2, w, 6);
      // sprinkles
      if (l.sprinkles) for (const sp of l.sprinkles) {
        if (sp.x > w) continue;
        c.save(); c.translate(x + sp.x, yy + 1); c.rotate(sp.a);
        c.fillStyle = sp.c; c.fillRect(-3, -1, 6, 2); c.restore();
      }
      c.globalAlpha = 1;
    }

    function draw(c) {
      // pastel sky that darkens as the cake grows
      const n = s ? s.layers.length : 1;
      const k = clamp(n / 60, 0, 1);
      const bg = c.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, `rgb(${Math.round(lerp(255, 46, k))},${Math.round(lerp(209, 32, k))},${Math.round(lerp(222, 92, k))})`);
      bg.addColorStop(1, `rgb(${Math.round(lerp(255, 120, k))},${Math.round(lerp(240, 70, k))},${Math.round(lerp(245, 150, k))})`);
      c.fillStyle = bg; c.fillRect(-20, -20, W + 40, H + 40);
      const shift = s ? s.shift : 0;
      for (const d of dots) {
        const y = ((d.y + shift * 0.3) % 1600 + 1600) % 1600 - 400;
        if (y < -20 || y > H + 20) continue;
        c.globalAlpha = 0.18 + k * 0.4;
        c.fillStyle = k > 0.5 ? '#ffffff' : '#ffffff';
        c.beginPath(); c.arc(d.x, y, k > 0.6 ? d.r * 0.25 : d.r, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
      if (!s) return;

      c.save();
      c.translate(W / 2, GROUND);
      c.scale(s.zoom, s.zoom);
      c.translate(-W / 2, -GROUND + s.shift);
      // table & plate
      c.fillStyle = '#c08457'; c.fillRect(-W, GROUND + 10, W * 3, 600);
      c.fillStyle = '#a16207'; c.fillRect(-W, GROUND + 10, W * 3, 6);
      c.fillStyle = '#ffffff';
      c.beginPath(); c.ellipse(W / 2, GROUND + 6, START_W / 2 + 34, 12, 0, 0, TAU); c.fill();
      c.fillStyle = '#e5e7eb';
      c.beginPath(); c.ellipse(W / 2, GROUND + 9, START_W / 2 + 26, 7, 0, 0, Math.PI); c.fill();

      s.layers.forEach((l, i) => drawLayer(c, l, layerTop(i)));
      // cherry on top
      const top = s.layers[s.layers.length - 1];
      if (api.state === 'dying' || api.state === 'over') {
        const ty = layerTop(s.layers.length - 1);
        c.fillStyle = '#e11d48'; c.beginPath(); c.arc(top.x + top.w / 2, ty - 6, 8, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(top.x + top.w / 2 - 3, ty - 9, 2.5, 0, TAU); c.fill();
        c.strokeStyle = '#166534'; c.lineWidth = 2; c.beginPath(); c.moveTo(top.x + top.w / 2, ty - 13); c.quadraticCurveTo(top.x + top.w / 2 + 3, ty - 22, top.x + top.w / 2 + 10, ty - 24); c.stroke();
      }
      if (s.moving) {
        const y = layerTop(s.layers.length);
        // drop guide
        c.globalAlpha = 0.18; c.fillStyle = '#ffffff';
        c.fillRect(top.x, y, top.w, LH);
        c.globalAlpha = 1;
        drawLayer(c, s.moving, y - 6 + Math.sin(clock * 6) * 2);
      }
      for (const cut of s.cuts) {
        c.save(); c.translate(cut.x + cut.w / 2, cut.y + LH / 2); c.rotate(cut.rot); c.translate(-(cut.x + cut.w / 2), -(cut.y + LH / 2));
        drawLayer(c, cut, cut.y, 0.9); c.restore();
      }
      if (s.fallen) {
        const f = s.fallen;
        c.save(); c.translate(f.x + f.w / 2, f.y + LH / 2); c.rotate(f.rot); c.translate(-(f.x + f.w / 2), -(f.y + LH / 2));
        drawLayer(c, f, f.y); c.restore();
      }
      c.restore();

      // floor counter
      if (api.state !== 'ready') {
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = '900 64px system-ui, sans-serif';
        c.globalAlpha = 0.22; c.fillStyle = '#ffffff';
        c.fillText(String(floors()), W / 2, 90);
        c.globalAlpha = 1;
      }
    }

    return {
      init() { reset(); },
      update,
      idle(dt) {
        clock += dt;
        if (s && s.moving && api.state === 'ready') { const m = s.moving; m.x += m.v * dt * 0.6; if (m.x < -m.w * 0.35) m.v = Math.abs(m.v); if (m.x > W - m.w * 0.65) m.v = -Math.abs(m.v); }
      },
      draw,
      hud() {
        if (!s) return {};
        s.shown += (s.score - s.shown) * 0.25;
        if (Math.abs(s.score - s.shown) < 1) s.shown = s.score;
        return { score: api.fmt(s.shown), floors: String(floors()), combo: `x${s.combo}` };
      },
      pointerDown() { drop(); },
      keyDown(key) { if (key === ' ' || key === 'enter' || key === 'arrowdown' || key === 's') drop(); },
    };
  },
});
