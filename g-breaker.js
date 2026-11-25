'use strict';
// 프리즘 브레이커 — brick breaker with power-ups and hand-made levels.
HanQArcade.register({
  id: 'breaker',
  title: '프리즘 브레이커',
  tagline: '벽돌 깨기 · 아이템 6종',
  aspect: 'portrait',
  theme: { card: 'linear-gradient(160deg,#1e1b4b,#0b0a22 70%)', border: 'rgba(129,140,248,.35)', stage: '#0b0a22' },
  intro: '패들을 움직여 공을 튕기고 벽돌을 모두 깨세요.<br>공이 패들 <b class="c-rock">가장자리</b>에 맞을수록 비스듬히 날아가요.<br>떨어지는 <b class="c-jelly">아이템 캡슐</b>을 받으면 강해져요!',
  hud: [
    { key: 'score', label: '점수', wide: true },
    { key: 'level', label: '레벨', initial: '1' },
    { key: 'combo', label: '콤보', initial: 'x0' },
    { key: 'lives', label: '목숨', initial: '♥3' },
  ],
  overStats: [
    { key: 'level', label: '레벨' },
    { key: 'bricks', label: '깬 벽돌' },
    { key: 'maxCombo', label: '최대 콤보', format: v => `x${v || 0}` },
    { key: 'items', label: '아이템' },
  ],
  controls: [
    [['드래그', '마우스'], '패들 이동'],
    [['탭', '클릭', 'Space'], '공 발사'],
    [['←', '→'], '패들 이동 (키보드)'],
    [['P'], '일시정지'],
  ],
  tip: '공이 패들에 닿지 않고 벽돌을 연속으로 깰수록 콤보 점수가 커져요.',
  legend: [
    { name: 'W 와이드', desc: '패들이 넓어져요.', color: '#22d3ee', ring: '#cffafe', square: true },
    { name: 'M 멀티볼', desc: '공이 3개로!', color: '#a78bfa', ring: '#ede9fe', square: true },
    { name: 'L 레이저', desc: '패들에서 레이저가 자동 발사.', color: '#f472b6', ring: '#fce7f3', square: true },
    { name: 'F 파이어볼', desc: '벽돌을 뚫고 지나가요.', color: '#fb923c', ring: '#ffedd5', square: true },
    { name: 'S 슬로우 · ♥ 목숨', desc: '공이 느려져요 · 목숨 +1.', color: '#4ade80', ring: '#dcfce7', square: true },
  ],
  icon(c, s) {
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#0b0a22');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    const cols = ['#22d3ee', '#818cf8', '#f472b6'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
      if (r === 2 && i === 1) continue;
      c.fillStyle = cols[r]; c.fillRect(10 + i * 18, 12 + r * 11, 15, 8);
    }
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(40, 58, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#a5b4fc'; c.fillRect(24, 72, 40, 7);
  },
  dyingTime: 1.0,
  create(api) {
    const { W, H, TAU, rand, clamp } = api;
    const COLS = 8;
    const PAD = 14;
    const GAP = 4;
    const BW = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;
    const BH = 18;
    const TOP = 70;
    const PY = H - 64;
    const R = 6.5;
    const HP_COL = { 1: ['#67e8f9', '#0891b2'], 2: ['#a5b4fc', '#6366f1'], 3: ['#f9a8d4', '#db2777'], 9: ['#cbd5e1', '#64748b'], 5: ['#fde68a', '#f59e0b'] };
    const POWER = {
      W: { col: '#22d3ee', name: '와이드!' }, M: { col: '#a78bfa', name: '멀티볼!' }, L: { col: '#f472b6', name: '레이저!' },
      F: { col: '#fb923c', name: '파이어볼!' }, S: { col: '#4ade80', name: '슬로우' }, '+': { col: '#fb7185', name: '목숨 +1' },
    };
    let s;
    const beams = Array.from({ length: 5 }, (_, i) => ({ x: rand(0, W), w: rand(40, 120), hue: i * 70, sp: rand(0.1, 0.3) }));
    let clock = 0;

    // ----- levels: strings of rows, one char per column -----
    // . empty  1-3 hits  # steel  * bonus
    const LEVELS = [
      ['11111111', '11111111', '11111111', '11111111', '11111111'],
      ['...11...', '..1221..', '.122221.', '12233221', '11111111'],
      ['2.2.2.2.', '.1.1.1.1', '2.2.2.2.', '.1.1.1.1', '2*2.2*2.', '.1.1.1.1'],
      ['.33..33.', '32233223', '32222223', '.322223.', '..3223..', '...33...'],
      ['########', '#2*22*2#', '#222222#', '#.1111.#', '#......#', '###..###'],
      ['3.3.3.3.', '.2.2.2.2', '11111111', '#.#..#.#', '22222222', '1*1111*1'],
      ['...##...', '..#33#..', '.#3223#.', '#322223#', '.#3223#.', '..#33#..', '...11...'],
    ];
    function buildLevel(n) {
      let rows;
      if (n <= LEVELS.length) rows = LEVELS[n - 1];
      else {
        // procedural, mirrored for symmetry
        const height = Math.min(9, 5 + Math.floor(n / 3));
        rows = [];
        for (let r = 0; r < height; r++) {
          let half = '';
          for (let c = 0; c < COLS / 2; c++) {
            const roll = Math.random();
            half += roll < 0.12 ? '.' : roll < 0.16 + Math.min(0.1, n * 0.006) ? '#' : roll < 0.19 ? '*' : String(1 + Math.floor(Math.random() * Math.min(3, 1 + n / 4)));
          }
          rows.push(half + half.split('').reverse().join(''));
        }
      }
      const bricks = [];
      rows.forEach((row, r) => {
        for (let c = 0; c < COLS; c++) {
          const ch = row[c] || '.';
          if (ch === '.') continue;
          const hp = ch === '#' ? 9 : ch === '*' ? 1 : Number(ch);
          bricks.push({ x: PAD + c * (BW + GAP), y: TOP + r * (BH + GAP), hp, max: hp, steel: ch === '#', bonus: ch === '*', hit: 0, appear: (r * COLS + c) * 0.015 });
        }
      });
      return bricks;
    }

    function newBall(stuck = true) { return { x: s.pad.x, y: PY - R - 1, vx: 0, vy: 0, stuck, trail: [] }; }
    function reset() {
      s = {
        t: 0, score: 0, shown: 0, level: 1, lives: 3, combo: 0, maxCombo: 0, bricksBroken: 0, items: 0,
        pad: { x: W / 2, tx: W / 2, w: 84, wide: 0, laser: 0, laserT: 0 },
        balls: [], bricks: buildLevel(1), caps: [], lasers: [], slow: 0, fire: 0, clearT: 0,
      };
      s.balls.push(newBall());
    }
    const baseSpeed = () => Math.min(600, 370 + s.level * 16);
    function launch() {
      for (const b of s.balls) {
        if (!b.stuck) continue;
        b.stuck = false;
        const a = rand(-0.35, 0.35);
        const sp = baseSpeed();
        b.vx = Math.sin(a) * sp; b.vy = -Math.cos(a) * sp;
        api.tone(660, 0.08, 'triangle', 0.12, 1.5);
      }
    }

    function pts(n) { s.score += n; return n; }
    function hitBrick(br, b) {
      if (br.steel) { br.hit = 0.15; api.tone(1600, 0.05, 'square', 0.04, 0.8); return; }
      br.hp--;
      br.hit = 0.12;
      if (br.hp > 0) { api.tone(520 + br.hp * 80, 0.05, 'triangle', 0.1); return; }
      s.combo++;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      s.bricksBroken++;
      const gained = pts(50 * br.max + 10 * s.combo);
      const [light, dark] = HP_COL[br.bonus ? 5 : br.max];
      const cx = br.x + BW / 2, cy = br.y + BH / 2;
      api.burst(cx, cy, light, 14, 200, 0.6, 4, 500);
      api.burst(cx, cy, dark, 8, 140, 0.5, 3, 500);
      if (s.combo >= 3) api.text(cx, cy - 8, `+${gained}`, s.combo >= 8 ? '#fde047' : '#e0e7ff', 13 + Math.min(8, s.combo * 0.6));
      const note = [523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319][Math.min(9, s.combo - 1)];
      api.tone(note, 0.09, 'triangle', 0.14);
      if (br.bonus || Math.random() < 0.11) {
        const pool = ['W', 'M', 'L', 'F', 'S', 'W', 'M'];
        if (s.lives < 5 && Math.random() < 0.25) pool.push('+');
        s.caps.push({ x: cx, y: cy, kind: pool[Math.floor(Math.random() * pool.length)], t: 0 });
      }
      if (b) b.lastBrick = br;
    }

    function collideBricks(b) {
      for (const br of s.bricks) {
        if (br.hp <= 0) continue;
        const nx = clamp(b.x, br.x, br.x + BW);
        const ny = clamp(b.y, br.y, br.y + BH);
        const dx = b.x - nx, dy = b.y - ny;
        if (dx * dx + dy * dy > R * R) continue;
        const pierce = s.fire > 0 && !br.steel;
        hitBrick(br, b);
        if (pierce) { if (br.hp > 0) { br.hp = 0; hitBrick(br, b); } continue; }
        // reflect along the axis of least penetration
        const overlapX = b.x < br.x + BW / 2 ? b.x + R - br.x : br.x + BW - (b.x - R);
        const overlapY = b.y < br.y + BH / 2 ? b.y + R - br.y : br.y + BH - (b.y - R);
        if (overlapX < overlapY) { b.vx = b.x < br.x + BW / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); }
        else { b.vy = b.y < br.y + BH / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); }
        return true;
      }
      return false;
    }

    function stepBall(b, dt) {
      const speedMul = s.slow > 0 ? 0.68 : 1;
      const dist = Math.hypot(b.vx, b.vy) * speedMul * dt;
      const steps = Math.max(1, Math.ceil(dist / 3));
      for (let i = 0; i < steps; i++) {
        b.x += (b.vx * speedMul * dt) / steps;
        b.y += (b.vy * speedMul * dt) / steps;
        if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); api.tone(300, 0.03, 'sine', 0.05); }
        if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); api.tone(300, 0.03, 'sine', 0.05); }
        if (b.y < R + 40) { b.y = R + 40; b.vy = Math.abs(b.vy); api.tone(300, 0.03, 'sine', 0.05); }
        const pw = s.pad.w;
        if (b.vy > 0 && b.y + R >= PY && b.y - R <= PY + 12 && b.x > s.pad.x - pw / 2 - R && b.x < s.pad.x + pw / 2 + R) {
          const k = clamp((b.x - s.pad.x) / (pw / 2), -1, 1);
          const a = k * 1.05;
          const sp = Math.min(640, Math.hypot(b.vx, b.vy) + 5);
          b.vx = Math.sin(a) * sp; b.vy = -Math.cos(a) * sp;
          b.y = PY - R;
          if (s.combo >= 5) api.text(b.x, PY - 26, `${s.combo} COMBO`, '#fde047', 16, true);
          s.combo = 0;
          api.tone(220 + Math.abs(k) * 120, 0.08, 'sine', 0.16, 1.4);
          api.burst(b.x, PY, '#a5b4fc', 5, 90, 0.3, 2);
        }
        if (collideBricks(b)) {
          // keep a minimum vertical speed so balls never get stuck sliding sideways
          const sp = Math.hypot(b.vx, b.vy);
          if (Math.abs(b.vy) < sp * 0.25) { b.vy = Math.sign(b.vy || -1) * sp * 0.25; b.vx = Math.sign(b.vx) * Math.sqrt(sp * sp - b.vy * b.vy); }
        }
      }
    }

    function update(dt) {
      s.t += dt; clock += dt;
      const pad = s.pad;
      if (api.keys.has('arrowleft') || api.keys.has('a')) pad.tx -= 560 * dt;
      if (api.keys.has('arrowright') || api.keys.has('d')) pad.tx += 560 * dt;
      pad.wide = Math.max(0, pad.wide - dt);
      pad.laser = Math.max(0, pad.laser - dt);
      s.slow = Math.max(0, s.slow - dt);
      s.fire = Math.max(0, s.fire - dt);
      const targetW = pad.wide > 0 ? 130 : 84;
      pad.w += (targetW - pad.w) * Math.min(1, dt * 8);
      pad.tx = clamp(pad.tx, pad.w / 2, W - pad.w / 2);
      pad.x += (pad.tx - pad.x) * Math.min(1, dt * 25);

      for (const br of s.bricks) { br.hit = Math.max(0, br.hit - dt); br.appear = Math.max(0, br.appear - dt); }

      if (s.clearT > 0) {
        s.clearT -= dt;
        if (s.clearT <= 0) {
          s.level++;
          s.bricks = buildLevel(s.level);
          s.balls = [newBall()];
          s.caps = []; s.lasers = [];
          s.fire = 0; s.slow = 0;
          api.banner(`LEVEL ${s.level}`, '탭해서 발사!');
        }
        return;
      }

      for (const b of s.balls) {
        if (b.stuck) { b.x = pad.x; b.y = PY - R - 1; continue; }
        stepBall(b, dt);
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 9) b.trail.shift();
      }
      // lost balls
      const before = s.balls.length;
      s.balls = s.balls.filter(b => b.y < H + 20);
      if (s.balls.length < before && !s.balls.length) {
        s.lives--;
        s.combo = 0;
        api.tone(200, 0.4, 'sawtooth', 0.15, 0.4);
        api.haptic(60);
        api.shake(8);
        api.flash(0.3, '#ff3d7f');
        if (s.lives <= 0) { api.end('공을 모두 놓쳤어요', stats()); return; }
        s.balls = [newBall()];
        pad.wide = 0; pad.laser = 0; s.fire = 0;
        api.text(W / 2, H / 2, `남은 목숨 ${s.lives}`, '#fda4af', 22, true);
      }

      // lasers
      if (pad.laser > 0) {
        pad.laserT -= dt;
        if (pad.laserT <= 0) {
          pad.laserT = 0.32;
          s.lasers.push({ x: pad.x - pad.w / 2 + 8, y: PY }, { x: pad.x + pad.w / 2 - 8, y: PY });
          api.tone(1800, 0.04, 'square', 0.03, 0.5);
        }
      }
      for (let i = s.lasers.length - 1; i >= 0; i--) {
        const l = s.lasers[i];
        l.y -= 700 * dt;
        let hit = false;
        for (const br of s.bricks) {
          if (br.hp > 0 && l.x > br.x && l.x < br.x + BW && l.y > br.y && l.y < br.y + BH) { hitBrick(br); hit = true; break; }
        }
        if (hit || l.y < 40) s.lasers.splice(i, 1);
      }

      // capsules
      for (let i = s.caps.length - 1; i >= 0; i--) {
        const c = s.caps[i];
        c.t += dt; c.y += 150 * dt;
        if (c.y > PY - 8 && c.y < PY + 16 && Math.abs(c.x - pad.x) < pad.w / 2 + 14) {
          s.caps.splice(i, 1);
          s.items++;
          applyPower(c.kind);
          continue;
        }
        if (c.y > H + 20) s.caps.splice(i, 1);
      }

      s.bricks = s.bricks.filter(br => br.hp > 0);
      if (!s.bricks.some(br => !br.steel)) {
        const bonus = pts(1000 * s.level);
        s.clearT = 1.8;
        api.banner('CLEAR!', `보너스 +${api.fmt(bonus)}`);
        [523, 659, 784, 1047, 1319].forEach((f, i) => api.tone(f, 0.15, 'triangle', 0.14, 1, i * 0.07));
        api.flash(0.35);
        for (const b of s.balls) api.burst(b.x, b.y, '#ffffff', 20, 260, 0.8, 3);
        s.balls = [];
      }
    }

    function applyPower(kind) {
      const pad = s.pad;
      const p = POWER[kind];
      api.text(pad.x, PY - 34, p.name, p.col, 18, true);
      api.ring(pad.x, PY, p.col, 70, 3);
      [784, 1047, 1319].forEach((f, i) => api.tone(f, 0.09, 'triangle', 0.13, 1, i * 0.05));
      if (kind === 'W') pad.wide = 15;
      if (kind === 'L') { pad.laser = 12; pad.laserT = 0; }
      if (kind === 'F') s.fire = 8;
      if (kind === 'S') s.slow = 10;
      if (kind === '+') s.lives = Math.min(5, s.lives + 1);
      if (kind === 'M') {
        const src = s.balls.find(b => !b.stuck) || s.balls[0];
        if (!src) return;
        if (src.stuck) launch();
        const sp = Math.max(300, Math.hypot(src.vx, src.vy));
        for (const d of [-0.5, 0.5]) {
          const a = Math.atan2(src.vy, src.vx) + d;
          s.balls.push({ x: src.x, y: src.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, stuck: false, trail: [] });
        }
      }
    }
    function stats() { return { score: s.score, level: s.level, bricks: s.bricksBroken, maxCombo: s.maxCombo, items: s.items }; }

    // ---------- draw ----------
    function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
    function draw(c) {
      const bg = c.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#15123d'); bg.addColorStop(1, '#07061a');
      c.fillStyle = bg; c.fillRect(-20, -20, W + 40, H + 40);
      c.globalCompositeOperation = 'lighter';
      for (const b of beams) {
        const x = (b.x + clock * b.sp * 40) % (W + 200) - 100;
        const g = c.createLinearGradient(x, 0, x + b.w, H);
        g.addColorStop(0, `hsla(${b.hue + clock * 20},90%,60%,0)`);
        g.addColorStop(0.5, `hsla(${b.hue + clock * 20},90%,60%,0.05)`);
        g.addColorStop(1, `hsla(${b.hue + clock * 20},90%,60%,0)`);
        c.fillStyle = g;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + b.w, 0); c.lineTo(x + b.w * 2.2, H); c.lineTo(x + b.w * 1.2, H); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(0, 38, W, 2);
      if (!s) return;

      // bricks
      for (const br of s.bricks) {
        const k = br.appear > 0 ? Math.max(0, 1 - br.appear * 6) : 1;
        if (k <= 0) continue;
        const key = br.steel ? 9 : br.bonus ? 5 : br.hp;
        const [light, dark] = HP_COL[key];
        c.save();
        c.globalAlpha = k;
        const g = c.createLinearGradient(0, br.y, 0, br.y + BH);
        g.addColorStop(0, br.hit > 0 ? '#ffffff' : light); g.addColorStop(1, dark);
        c.fillStyle = g;
        rr(c, br.x, br.y + (1 - k) * -10, BW, BH, 5); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)';
        rr(c, br.x + 3, br.y + 2, BW - 6, 4, 2); c.fill();
        if (br.max > 1 && br.hp < br.max && !br.steel) {
          c.strokeStyle = 'rgba(20,10,40,0.55)'; c.lineWidth = 1.4;
          c.beginPath(); c.moveTo(br.x + BW * 0.3, br.y + 2); c.lineTo(br.x + BW * 0.45, br.y + 10); c.lineTo(br.x + BW * 0.38, br.y + BH - 2);
          if (br.hp === 1) { c.moveTo(br.x + BW * 0.7, br.y + 3); c.lineTo(br.x + BW * 0.6, br.y + 11); c.lineTo(br.x + BW * 0.68, br.y + BH - 2); }
          c.stroke();
        }
        if (br.steel) { c.fillStyle = 'rgba(30,41,59,0.6)'; for (const dx of [5, BW - 7]) { c.beginPath(); c.arc(br.x + dx + 1, br.y + BH / 2, 1.6, 0, TAU); c.fill(); } }
        if (br.bonus) { c.fillStyle = '#ffffff'; c.globalAlpha = k * (0.5 + 0.5 * Math.sin(clock * 6 + br.x)); c.font = '900 11px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', br.x + BW / 2, br.y + BH / 2 + 1); }
        c.restore();
      }
      // capsules
      for (const cp of s.caps) {
        const p = POWER[cp.kind];
        c.globalCompositeOperation = 'lighter'; api.glow(p.col, cp.x, cp.y, 26); c.globalCompositeOperation = 'source-over';
        c.fillStyle = p.col; rr(c, cp.x - 15, cp.y - 8, 30, 16, 8); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.4)'; rr(c, cp.x - 11, cp.y - 6, 22, 4, 2); c.fill();
        c.fillStyle = '#0b0a22'; c.font = '900 11px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(cp.kind === '+' ? '♥' : cp.kind, cp.x, cp.y + 1);
      }
      // lasers
      c.globalCompositeOperation = 'lighter';
      for (const l of s.lasers) { c.fillStyle = '#f472b6'; c.fillRect(l.x - 2, l.y - 12, 4, 14); c.fillStyle = '#fff'; c.fillRect(l.x - 1, l.y - 10, 2, 10); }
      // balls
      for (const b of s.balls) {
        const col = s.fire > 0 ? '#fb923c' : '#a5b4fc';
        for (let i = 0; i < b.trail.length; i++) {
          const k = i / b.trail.length;
          c.globalAlpha = k * 0.4; c.fillStyle = col;
          c.beginPath(); c.arc(b.trail[i].x, b.trail[i].y, R * k, 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
        api.glow(col, b.x, b.y, 26);
      }
      c.globalCompositeOperation = 'source-over';
      for (const b of s.balls) {
        c.fillStyle = s.fire > 0 ? '#fff7ed' : '#ffffff';
        c.beginPath(); c.arc(b.x, b.y, R, 0, TAU); c.fill();
      }
      // paddle
      const pad = s.pad;
      c.globalCompositeOperation = 'lighter'; api.glow('#818cf8', pad.x, PY + 6, pad.w * 0.7); c.globalCompositeOperation = 'source-over';
      const pg = c.createLinearGradient(pad.x - pad.w / 2, 0, pad.x + pad.w / 2, 0);
      pg.addColorStop(0, '#22d3ee'); pg.addColorStop(0.5, '#a78bfa'); pg.addColorStop(1, '#f472b6');
      c.fillStyle = pg; rr(c, pad.x - pad.w / 2, PY, pad.w, 12, 6); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)'; rr(c, pad.x - pad.w / 2 + 6, PY + 2, pad.w - 12, 3, 2); c.fill();
      if (pad.laser > 0) { c.fillStyle = '#f472b6'; c.fillRect(pad.x - pad.w / 2 + 5, PY - 6, 6, 8); c.fillRect(pad.x + pad.w / 2 - 11, PY - 6, 6, 8); }
      if (s.balls.some(b => b.stuck) && api.state === 'playing') {
        c.globalAlpha = 0.6 + 0.4 * Math.sin(clock * 5);
        c.fillStyle = '#e0e7ff'; c.font = '700 13px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('탭 / Space 로 발사', W / 2, PY + 36);
        c.globalAlpha = 1;
      }
      // timers
      const chips = [];
      if (pad.wide > 0) chips.push(['W', pad.wide / 15, '#22d3ee']);
      if (pad.laser > 0) chips.push(['L', pad.laser / 12, '#f472b6']);
      if (s.fire > 0) chips.push(['F', s.fire / 8, '#fb923c']);
      if (s.slow > 0) chips.push(['S', s.slow / 10, '#4ade80']);
      chips.forEach(([label, k, col], i) => {
        const x = 18 + i * 32, y = 20;
        c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, 11, 0, TAU); c.stroke();
        c.strokeStyle = col; c.beginPath(); c.arc(x, y, 11, -Math.PI / 2, -Math.PI / 2 + TAU * k); c.stroke();
        c.fillStyle = col; c.font = '900 10px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x, y + 1);
      });
    }

    return {
      init() { reset(); },
      update,
      idle(dt) { clock += dt; },
      draw,
      hud() {
        if (!s) return {};
        s.shown += (s.score - s.shown) * 0.2;
        if (Math.abs(s.score - s.shown) < 1) s.shown = s.score;
        return { score: api.fmt(s.shown), level: String(s.level), combo: `x${s.combo}`, lives: `♥${Math.max(0, s.lives)}` };
      },
      pointerDown(x) { s.pad.tx = x; s.downAt = s.t; },
      pointerMove(x, y, e) { if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) s.pad.tx = x; },
      pointerUp() { if (s.balls.some(b => b.stuck) && s.clearT <= 0) launch(); },
      keyDown(key) { if ((key === ' ' || key === 'arrowup' || key === 'w') && s.clearT <= 0) launch(); },
    };
  },
});
