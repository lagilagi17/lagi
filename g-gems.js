'use strict';
// 젬 스왑 — 60-second match-3 time attack with line and rainbow gems.
HanQArcade.register({
  id: 'gems',
  title: '젬 스왑',
  tagline: '보석 3개 맞추기 · 60초',
  theme: { card: 'linear-gradient(160deg,#134e4a,#05201e 70%)', border: 'rgba(45,212,191,.4)', stage: '#06201f' },
  intro: '보석을 <b class="c-rock">밀어서(스와이프)</b> 옆 보석과 바꾸세요.<br>같은 보석 3개 이상이 나란히 되면 터져요.<br>4개는 <b>줄 폭탄</b>, 5개는 <b class="c-jelly">무지개 보석</b>! 60초 안에 최고 점수를!',
  hud: [
    { key: 'score', label: '점수', wide: true },
    { key: 'time', label: '시간', initial: '60' },
    { key: 'combo', label: '연쇄', initial: 'x0' },
  ],
  overTitle: '타임 업!',
  overStats: [
    { key: 'gems', label: '터뜨린 보석' },
    { key: 'maxCascade', label: '최대 연쇄', format: v => `x${v || 0}` },
    { key: 'specials', label: '특수 보석' },
    { key: 'moves', label: '이동 횟수' },
  ],
  controls: [
    [['스와이프', '드래그'], '보석 바꾸기'],
    [['클릭', '클릭'], '두 보석을 차례로 눌러 바꾸기'],
    [['방향키', 'Space'], '커서 이동 · 선택'],
    [['P'], '일시정지'],
  ],
  tip: '연쇄(콤보)가 일어날수록 점수 배율이 커지고 시간이 조금씩 늘어나요. 가만히 있으면 힌트가 반짝여요.',
  legend: [
    { name: '줄 폭탄', desc: '4개를 맞추면 생겨요. 터지면 한 줄을 통째로!', color: '#e2e8f0', ring: '#f8fafc' },
    { name: '무지개 보석', desc: '5개를 맞추면 생겨요. 아무 보석과 바꾸면 그 색이 전부 사라져요.', color: '#c084fc', ring: '#f3e8ff' },
  ],
  icon(c, s) {
    c.fillStyle = '#06201f'; c.fillRect(0, 0, s, s);
    const cols = ['#f43f5e', '#3b82f6', '#22c55e', '#facc15'];
    for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
      const col = cols[(r * 2 + q * 3) % 4];
      c.fillStyle = col;
      c.beginPath(); c.arc(18 + q * 26, 18 + r * 26, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.arc(15 + q * 26, 14 + r * 26, 3.5, 0, Math.PI * 2); c.fill();
    }
  },
  dyingTime: 0.8,
  create(api) {
    const { W, TAU, rand } = api;
    const N = 8;
    const CELL = 66;
    const BX = (W - N * CELL) / 2;
    const BY = 54;
    const TYPES = [
      { col: '#f43f5e', dark: '#9f1239' },
      { col: '#3b82f6', dark: '#1e3a8a' },
      { col: '#22c55e', dark: '#14532d' },
      { col: '#facc15', dark: '#a16207' },
      { col: '#a855f7', dark: '#581c87' },
      { col: '#fb923c', dark: '#9a3412' },
    ];
    const TIME = 60;
    let s;
    let clock = 0;

    function gem(type, r, c, fromY) { return { type, special: null, r, c, x: c, y: fromY ?? r, vy: 0, clear: 0, born: 0 }; }
    function at(r, c) { return r >= 0 && r < N && c >= 0 && c < N ? s.grid[r][c] : null; }

    function reset() {
      s = {
        grid: [], phase: 'falling', sel: null, cursor: { r: 3, c: 3 }, drag: null, swapA: null, swapB: null,
        score: 0, shown: 0, time: TIME, cascade: 0, maxCascade: 0, gemsCleared: 0, specials: 0, moves: 0,
        idleT: 0, hint: null, beams: [], clearT: 0, ending: false, lastMove: null,
      };
      for (let r = 0; r < N; r++) {
        s.grid.push([]);
        for (let c = 0; c < N; c++) {
          let t;
          do { t = Math.floor(Math.random() * TYPES.length); }
          while ((c >= 2 && s.grid[r][c - 1].type === t && s.grid[r][c - 2].type === t) || (r >= 2 && s.grid[r - 1][c].type === t && s.grid[r - 2][c].type === t));
          s.grid[r].push(gem(t, r, c, r - N - 1 - Math.random()));
        }
      }
      if (!findMove()) reset();
    }

    // ---------- matching ----------
    function runs() {
      const out = [];
      for (let r = 0; r < N; r++) {
        let start = 0;
        for (let c = 1; c <= N; c++) {
          const same = c < N && s.grid[r][c].type >= 0 && s.grid[r][c].type === s.grid[r][start].type;
          if (!same) { if (c - start >= 3 && s.grid[r][start].type >= 0) out.push({ dir: 'h', cells: Array.from({ length: c - start }, (_, i) => [r, start + i]) }); start = c; }
        }
      }
      for (let c = 0; c < N; c++) {
        let start = 0;
        for (let r = 1; r <= N; r++) {
          const same = r < N && s.grid[r][c].type >= 0 && s.grid[r][c].type === s.grid[start][c].type;
          if (!same) { if (r - start >= 3 && s.grid[start][c].type >= 0) out.push({ dir: 'v', cells: Array.from({ length: r - start }, (_, i) => [start + i, c]) }); start = r; }
        }
      }
      return out;
    }
    function findMove() {
      const trySwap = (r1, c1, r2, c2) => {
        const a = s.grid[r1][c1], b = s.grid[r2][c2];
        if (a.type < 0 || b.type < 0) return true; // rainbow gems always have a move
        [a.type, b.type] = [b.type, a.type];
        const ok = runs().length > 0;
        [a.type, b.type] = [b.type, a.type];
        return ok;
      };
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (c + 1 < N && trySwap(r, c, r, c + 1)) return [[r, c], [r, c + 1]];
        if (r + 1 < N && trySwap(r, c, r + 1, c)) return [[r, c], [r + 1, c]];
      }
      return null;
    }

    // ---------- moves ----------
    function attemptSwap(a, b) {
      if (s.phase !== 'idle' || !a || !b) return;
      if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return;
      s.sel = null; s.hint = null; s.idleT = 0;
      const ga = s.grid[a.r][a.c], gb = s.grid[b.r][b.c];
      swapCells(ga, gb);
      s.moves++;
      s.lastMove = [{ r: ga.r, c: ga.c }, { r: gb.r, c: gb.c }];
      api.tone(500, 0.06, 'sine', 0.1, 1.3);
      // rainbow combos
      if (ga.type < 0 || gb.type < 0) {
        const rb = ga.type < 0 ? ga : gb, other = rb === ga ? gb : ga;
        s.phase = 'swapping';
        s.after = () => rainbowBlast(rb, other);
        return;
      }
      const ok = runs().length > 0;
      s.phase = 'swapping';
      s.after = ok ? () => startClear() : () => { swapCells(ga, gb); s.phase = 'swapback'; api.tone(200, 0.12, 'triangle', 0.1, 0.7); };
    }
    function swapCells(ga, gb) {
      [ga.r, gb.r] = [gb.r, ga.r];
      [ga.c, gb.c] = [gb.c, ga.c];
      s.grid[ga.r][ga.c] = ga;
      s.grid[gb.r][gb.c] = gb;
    }
    function rainbowBlast(rb, other) {
      const marks = new Set();
      marks.add(rb.r * N + rb.c);
      if (other.type < 0) { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) marks.add(r * N + c); }
      else for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (s.grid[r][c].type === other.type) marks.add(r * N + c);
      rb.special = null;
      api.flash(0.4, '#f5d0fe');
      api.shake(6);
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => api.tone(f, 0.12, 'triangle', 0.13, 1, i * 0.04));
      for (const k of marks) { const g = s.grid[Math.floor(k / N)][k % N]; const p = center(g.r, g.c); s.beams.push({ x1: center(rb.r, rb.c).x, y1: center(rb.r, rb.c).y, x2: p.x, y2: p.y, t: 0, col: '#f0abfc' }); }
      s.cascade = 1;
      clearSet(marks, null);
    }

    function startClear() {
      s.cascade++;
      s.maxCascade = Math.max(s.maxCascade, s.cascade);
      const found = runs();
      const marks = new Set();
      const create = [];
      for (const run of found) {
        for (const [r, c] of run.cells) marks.add(r * N + c);
        if (run.cells.length >= 4) {
          // put the special where the player moved, if it's in this run
          let spot = run.cells[Math.floor(run.cells.length / 2)];
          if (s.lastMove) for (const m of s.lastMove) if (run.cells.some(([r, c]) => r === m.r && c === m.c)) spot = [m.r, m.c];
          create.push({ r: spot[0], c: spot[1], kind: run.cells.length >= 5 ? 'rainbow' : run.dir, type: s.grid[spot[0]][spot[1]].type });
        }
      }
      s.lastMove = null;
      clearSet(marks, create);
    }

    function clearSet(marks, create) {
      // chain specials
      const queue = [...marks];
      const seen = new Set(marks);
      while (queue.length) {
        const k = queue.pop();
        const g = s.grid[Math.floor(k / N)][k % N];
        if (g.special === 'h' || g.special === 'v') {
          const p = center(g.r, g.c);
          if (g.special === 'h') s.beams.push({ x1: BX, y1: p.y, x2: BX + N * CELL, y2: p.y, t: 0, col: TYPES[g.type].col, line: true });
          else s.beams.push({ x1: p.x, y1: BY, x2: p.x, y2: BY + N * CELL, t: 0, col: TYPES[g.type].col, line: true });
          api.noise(0.25, 0.18, 3000);
          for (let i = 0; i < N; i++) {
            const kk = g.special === 'h' ? g.r * N + i : i * N + g.c;
            if (!seen.has(kk)) { seen.add(kk); queue.push(kk); }
          }
          g.special = null;
        }
      }
      const keep = new Set((create || []).map(cr => cr.r * N + cr.c));
      let count = 0;
      for (const k of seen) {
        const g = s.grid[Math.floor(k / N)][k % N];
        if (keep.has(k)) continue;
        g.clear = 0.001;
        count++;
        const p = center(g.r, g.c);
        const col = g.type >= 0 ? TYPES[g.type].col : '#f0abfc';
        api.burst(p.x, p.y, col, 7, 200, 0.55, 4, 300);
      }
      for (const cr of create || []) {
        const g = s.grid[cr.r][cr.c];
        g.special = cr.kind === 'rainbow' ? 'rainbow' : cr.kind;
        if (cr.kind === 'rainbow') g.type = -1;
        g.born = 1;
        s.specials++;
        const p = center(cr.r, cr.c);
        api.ring(p.x, p.y, '#ffffff', 50, 3);
        api.text(p.x, p.y - 30, cr.kind === 'rainbow' ? '무지개!' : '줄 폭탄!', '#ffffff', 18, true);
        s.time = Math.min(99, s.time + 2);
      }
      const mult = s.cascade;
      const gained = count * 30 * mult;
      s.score += gained;
      s.gemsCleared += count;
      if (s.cascade >= 2) {
        s.time = Math.min(99, s.time + 1);
        api.text(W / 2, BY + N * CELL / 2, `${s.cascade} 연쇄! +${gained}`, '#fde047', 22 + Math.min(10, s.cascade * 2), true);
      }
      const note = [523, 587, 659, 784, 880, 1047, 1175, 1319][Math.min(7, s.cascade - 1)];
      api.tone(note, 0.12, 'triangle', 0.16); api.tone(note * 1.26, 0.14, 'sine', 0.1, 1, 0.05);
      if (count >= 10) api.shake(5);
      s.phase = 'clearing';
      s.clearT = 0.22;
    }

    function collapse() {
      for (let c = 0; c < N; c++) {
        const col = [];
        for (let r = N - 1; r >= 0; r--) if (!s.grid[r][c].clear) col.push(s.grid[r][c]);
        let missing = N - col.length;
        for (let i = 0; i < missing; i++) col.push(gem(Math.floor(Math.random() * TYPES.length), 0, c, -1 - i));
        for (let i = 0; i < N; i++) {
          const g = col[i];
          const r = N - 1 - i;
          g.r = r; g.c = c;
          s.grid[r][c] = g;
        }
        missing = 0;
      }
      s.phase = 'falling';
    }

    function settled() {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const g = s.grid[r][c];
        if (Math.abs(g.x - g.c) > 0.01 || Math.abs(g.y - g.r) > 0.01) return false;
      }
      return true;
    }

    function update(dt) {
      clock += dt;
      if (s.phase === 'idle') {
        s.time -= dt;
        s.idleT += dt;
        if (s.idleT > 5 && !s.hint) s.hint = findMove();
      } else s.time -= dt * 0.5; // the clock slows while gems are resolving
      if (s.time <= 0) { s.time = 0; s.ending = true; }

      // animate gems toward their cells
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const g = s.grid[r][c];
        g.born = Math.max(0, g.born - dt * 2);
        const dx = g.c - g.x;
        g.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 8);
        if (g.y < g.r) { g.vy += 70 * dt; g.y = Math.min(g.r, g.y + g.vy * dt); if (g.y === g.r) { g.vy = 0; } }
        else if (g.y > g.r) g.y = Math.max(g.r, g.y - dt * 8);
        if (g.clear) g.clear += dt;
      }
      for (let i = s.beams.length - 1; i >= 0; i--) { s.beams[i].t += dt; if (s.beams[i].t > 0.35) s.beams.splice(i, 1); }

      if (s.phase === 'swapping' && settled()) { const fn = s.after; s.after = null; fn(); }
      else if (s.phase === 'swapback' && settled()) s.phase = 'idle';
      else if (s.phase === 'clearing') { s.clearT -= dt; if (s.clearT <= 0) collapse(); }
      else if (s.phase === 'falling' && settled()) {
        if (runs().length) startClear();
        else {
          s.phase = 'idle'; s.cascade = 0; s.idleT = 0;
          if (!findMove()) shuffle();
        }
      }
      if (s.ending && s.phase === 'idle') {
        api.tone(880, 0.12, 'square', 0.08); api.tone(660, 0.12, 'square', 0.08, 1, 0.14); api.tone(440, 0.3, 'square', 0.08, 1, 0.28);
        api.end('시간이 끝났어요', { score: s.score, gems: s.gemsCleared, maxCascade: s.maxCascade, specials: s.specials, moves: s.moves });
      }
      // final countdown ticks
      if (s.phase === 'idle' && s.time < 10 && Math.floor(s.time) !== Math.floor(s.time + dt)) api.tone(1200, 0.05, 'square', 0.05);
    }
    function shuffle() {
      api.text(W / 2, BY + N * CELL / 2, '섞는 중…', '#ffffff', 22, true);
      do {
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const g = s.grid[r][c]; if (g.type >= 0) g.type = Math.floor(Math.random() * TYPES.length); }
      } while (runs().length || !findMove());
    }

    const center = (r, c) => ({ x: BX + c * CELL + CELL / 2, y: BY + r * CELL + CELL / 2 });
    function cellAt(x, y) {
      const c = Math.floor((x - BX) / CELL), r = Math.floor((y - BY) / CELL);
      return r >= 0 && r < N && c >= 0 && c < N ? { r, c } : null;
    }

    // ---------- drawing ----------
    function shapePath(c, type, R) {
      c.beginPath();
      if (type === 0) c.arc(0, 0, R, 0, TAU);
      else if (type === 1) { c.moveTo(0, -R * 1.1); c.lineTo(R * 0.9, 0); c.lineTo(0, R * 1.1); c.lineTo(-R * 0.9, 0); c.closePath(); }
      else if (type === 2) { if (c.roundRect) c.roundRect(-R * 0.85, -R * 0.85, R * 1.7, R * 1.7, R * 0.3); else c.rect(-R * 0.85, -R * 0.85, R * 1.7, R * 1.7); }
      else if (type === 3) { c.moveTo(0, -R * 1.05); c.lineTo(R * 1.0, R * 0.8); c.lineTo(-R * 1.0, R * 0.8); c.closePath(); }
      else if (type === 4) { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; c.lineTo(Math.cos(a) * R, Math.sin(a) * R); } c.closePath(); }
      else { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? R * 0.5 : R * 1.08; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); }
    }
    function drawGem(c, g, highlight) {
      const p = { x: BX + g.x * CELL + CELL / 2, y: BY + g.y * CELL + CELL / 2 };
      if (p.y < BY - CELL / 2) return;
      let scale = 1;
      if (g.clear) scale = Math.max(0, 1 - g.clear / 0.22);
      if (g.born) scale *= 1 + Math.sin(g.born * Math.PI) * 0.3;
      if (highlight) scale *= 1 + Math.sin(clock * 10) * 0.08;
      if (scale <= 0) return;
      const R = CELL * 0.33;
      c.save();
      c.translate(p.x, p.y);
      c.scale(scale, scale);
      if (g.type < 0) {
        c.rotate(clock * 1.5);
        for (let i = 0; i < 6; i++) {
          c.fillStyle = TYPES[i].col;
          c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R * 1.05, (i / 6) * TAU, ((i + 1) / 6) * TAU); c.closePath(); c.fill();
        }
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, R * 0.42, 0, TAU); c.fill();
        c.restore();
        return;
      }
      const t = TYPES[g.type];
      const grad = c.createLinearGradient(-R, -R, R, R);
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.25, t.col); grad.addColorStop(1, t.dark);
      c.fillStyle = grad;
      shapePath(c, g.type, R);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath(); c.ellipse(-R * 0.3, -R * 0.4, R * 0.28, R * 0.14, -0.6, 0, TAU); c.fill();
      if (g.special === 'h' || g.special === 'v') {
        c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.globalAlpha = 0.85 + Math.sin(clock * 8) * 0.15;
        c.beginPath();
        if (g.special === 'h') { c.moveTo(-R, -4); c.lineTo(R, -4); c.moveTo(-R, 4); c.lineTo(R, 4); }
        else { c.moveTo(-4, -R); c.lineTo(-4, R); c.moveTo(4, -R); c.lineTo(4, R); }
        c.stroke();
        c.globalAlpha = 1;
      }
      c.restore();
    }
    function draw(c) {
      const bg = c.createRadialGradient(W / 2, 300, 50, W / 2, 300, 520);
      bg.addColorStop(0, '#0f3d3a'); bg.addColorStop(1, '#03110f');
      c.fillStyle = bg; c.fillRect(-20, -20, W + 40, 640);
      if (!s) return;
      // timer bar
      const k = Math.max(0, s.time / TIME);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.beginPath(); if (c.roundRect) c.roundRect(BX, 18, N * CELL, 14, 7); else c.rect(BX, 18, N * CELL, 14); c.fill();
      const tg = c.createLinearGradient(BX, 0, BX + N * CELL, 0);
      tg.addColorStop(0, s.time < 10 ? '#f43f5e' : '#2dd4bf'); tg.addColorStop(1, s.time < 10 ? '#fb923c' : '#a3e635');
      c.fillStyle = tg;
      c.beginPath(); if (c.roundRect) c.roundRect(BX, 18, N * CELL * Math.min(1, k), 14, 7); else c.rect(BX, 18, N * CELL * Math.min(1, k), 14); c.fill();
      // board
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); if (c.roundRect) c.roundRect(BX - 6, BY - 6, N * CELL + 12, N * CELL + 12, 16); else c.rect(BX - 6, BY - 6, N * CELL + 12, N * CELL + 12); c.fill();
      for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
        c.fillStyle = (r + q) % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.07)';
        c.fillRect(BX + q * CELL, BY + r * CELL, CELL, CELL);
      }
      // selection / cursor
      const mark = (cell, col, w) => { if (!cell) return; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); if (c.roundRect) c.roundRect(BX + cell.c * CELL + 3, BY + cell.r * CELL + 3, CELL - 6, CELL - 6, 12); else c.rect(BX + cell.c * CELL + 3, BY + cell.r * CELL + 3, CELL - 6, CELL - 6); c.stroke(); };
      if (s.keyboard) mark(s.cursor, 'rgba(255,255,255,0.4)', 2);
      if (s.sel) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(BX + s.sel.c * CELL, BY + s.sel.r * CELL, CELL, CELL); mark(s.sel, '#ffffff', 3); }
      c.save();
      c.beginPath(); c.rect(BX - 6, BY - 6, N * CELL + 12, N * CELL + 12); c.clip();
      const hinted = new Set(s.hint ? s.hint.map(([r, q]) => r * N + q) : []);
      for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) drawGem(c, s.grid[r][q], hinted.has(r * N + q));
      c.restore();
      // beams
      c.globalCompositeOperation = 'lighter';
      for (const b of s.beams) {
        c.globalAlpha = 1 - b.t / 0.35;
        c.strokeStyle = b.col; c.lineWidth = b.line ? 18 * (1 - b.t / 0.35) + 4 : 3;
        c.beginPath(); c.moveTo(b.x1, b.y1); c.lineTo(b.x2, b.y2); c.stroke();
        c.strokeStyle = '#ffffff'; c.lineWidth = b.line ? 4 : 1;
        c.beginPath(); c.moveTo(b.x1, b.y1); c.lineTo(b.x2, b.y2); c.stroke();
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      if (s.time < 10 && api.state === 'playing') {
        c.globalAlpha = 0.25 + 0.15 * Math.sin(clock * 10);
        c.fillStyle = '#ffffff'; c.font = '900 120px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(Math.ceil(s.time)), W / 2, BY + N * CELL / 2);
        c.globalAlpha = 1;
      }
    }

    return {
      init() { reset(); },
      update,
      idle(dt) {
        clock += dt;
        if (!s) return;
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const g = s.grid[r][c];
          if (g.y < g.r) { g.vy += 70 * dt; g.y = Math.min(g.r, g.y + g.vy * dt); }
        }
      },
      draw,
      hud() {
        if (!s) return {};
        s.shown += (s.score - s.shown) * 0.2;
        if (Math.abs(s.score - s.shown) < 1) s.shown = s.score;
        return { score: api.fmt(s.shown), time: String(Math.ceil(s.time)), combo: `x${s.cascade}` };
      },
      pointerDown(x, y, e) {
        s.keyboard = false;
        const cell = cellAt(x, y);
        if (!cell || s.phase !== 'idle') return;
        s.drag = { id: e.pointerId, x, y, cell, moved: false };
      },
      pointerMove(x, y, e) {
        const d = s.drag;
        if (!d || d.id !== e.pointerId || d.moved) return;
        const dx = x - d.x, dy = y - d.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.35) return;
        d.moved = true;
        const to = Math.abs(dx) > Math.abs(dy) ? { r: d.cell.r, c: d.cell.c + Math.sign(dx) } : { r: d.cell.r + Math.sign(dy), c: d.cell.c };
        if (to.r >= 0 && to.r < N && to.c >= 0 && to.c < N) attemptSwap(d.cell, to);
      },
      pointerUp(x, y, e) {
        const d = s.drag;
        if (!d || d.id !== e.pointerId) return;
        s.drag = null;
        if (d.moved) return;
        const cell = d.cell;
        if (s.sel && Math.abs(s.sel.r - cell.r) + Math.abs(s.sel.c - cell.c) === 1) attemptSwap(s.sel, cell);
        else if (s.sel && s.sel.r === cell.r && s.sel.c === cell.c) s.sel = null;
        else { s.sel = cell; api.tone(700, 0.04, 'sine', 0.08); }
      },
      keyDown(key) {
        s.keyboard = true;
        const cur = s.cursor;
        const moves = { arrowleft: [0, -1], arrowright: [0, 1], arrowup: [-1, 0], arrowdown: [1, 0], a: [0, -1], d: [0, 1], w: [-1, 0], s: [1, 0] };
        if (moves[key]) {
          const [dr, dc] = moves[key];
          const next = { r: Math.max(0, Math.min(N - 1, cur.r + dr)), c: Math.max(0, Math.min(N - 1, cur.c + dc)) };
          if (s.sel && s.sel.r === cur.r && s.sel.c === cur.c && (next.r !== cur.r || next.c !== cur.c)) { attemptSwap(s.sel, next); }
          s.cursor = next;
        } else if (key === ' ' || key === 'enter') {
          if (s.sel && s.sel.r === cur.r && s.sel.c === cur.c) s.sel = null;
          else if (s.sel && Math.abs(s.sel.r - cur.r) + Math.abs(s.sel.c - cur.c) === 1) attemptSwap(s.sel, cur);
          else s.sel = { ...cur };
        }
      },
    };
  },
});
