'use strict';
// HanQ Arcade — a small shared engine for the canvas mini games.
// Each game registers itself with HanQArcade.register(def); the engine builds the
// pane/HUD/overlays, runs the loop, routes input, plays sounds, draws effects and
// keeps local records. Games only implement their own rules and drawing.
window.HanQArcade = (() => {
  const section = document.getElementById('game');
  const picker = document.querySelector('.game-picker');
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

  // ---------- audio (shared, synthesised) ----------
  let muted = store.get('hanq-arcade-muted', '0') === '1';
  let actx = null;
  let master = null;
  let noiseBuffer = null;
  const muteListeners = new Set();
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
    if (actx.state === 'suspended' || actx.state === 'interrupted') actx.resume().catch(() => {});
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
  function noise(dur, vol = 0.25, freq = 1200, delay = 0) {
    if (!actx || muted) return;
    if (!noiseBuffer) {
      noiseBuffer = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = actx.currentTime + delay;
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
  function haptic(pattern) { if (navigator.vibrate && !muted) { try { navigator.vibrate(pattern); } catch { /* optional */ } } }
  function setMuted(value) {
    muted = value;
    store.set('hanq-arcade-muted', muted ? '1' : '0');
    if (master) master.gain.value = muted ? 0 : 0.32;
    muteListeners.forEach(fn => fn());
  }

  // ---------- glow sprites ----------
  const glowCache = new Map();
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function glowSprite(color) {
    let sprite = glowCache.get(color);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = 128;
      const g = sprite.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, hexA(color, 0.85));
      grad.addColorStop(0.3, hexA(color, 0.35));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      glowCache.set(color, sprite);
    }
    return sprite;
  }

  // ---------- DOM helpers ----------
  const ICON_SOUND = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="cross" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>';
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(className, label) { const b = el('button', className, label); b.type = 'button'; return b; }

  // Scroll so the whole game card is visible below the sticky top bar.
  function fitToScreen(card) {
    const bar = document.querySelector('.topbar');
    const top = bar ? bar.getBoundingClientRect().bottom + 8 : 8;
    const box = card.getBoundingClientRect();
    const room = window.innerHeight - top;
    let delta = 0;
    if (box.height <= room) { if (box.top < top || box.bottom > window.innerHeight) delta = box.top - top - Math.max(0, (room - box.height) / 2); }
    else delta = box.bottom - window.innerHeight + 4;
    if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  // ---------- registration ----------
  function register(def) {
    // a game can live in the mini game tab (picker card) or own a whole tab (def.section). With a list of tabs
    // (def.section: ['a', 'b']) one game serves them all: its screen moves into whichever of them is opened and
    // the game hears about it (game.section(name)), so it can show what belongs to that tab.
    const sections = def.section ? [].concat(def.section) : null;
    let savedTab = null;
    try { savedTab = localStorage.getItem('hanq-tab'); } catch { /* storage unavailable */ }
    const firstTab = sections ? (sections.includes(savedTab) ? savedTab : sections[0]) : null;
    let host = sections ? document.getElementById(firstTab) : section;
    if (!host || (!def.section && !picker)) return;
    let tabName = firstTab || 'game';
    const id = def.id;
    const portrait = def.aspect === 'portrait';
    const wide = def.aspect === 'wide';
    const W = def.width || (portrait ? 400 : 600);
    const H = def.height || (portrait ? 667 : 600);
    const keyBest = `hanq-${id}-best`;
    const keyPlays = `hanq-${id}-plays`;
    const rec = { best: parseInt(store.get(keyBest, '0'), 10) || 0, plays: parseInt(store.get(keyPlays, '0'), 10) || 0 };

    // picker card
    if (!def.section) {
      const pick = button('game-pick');
      pick.dataset.game = id;
      pick.setAttribute('aria-pressed', 'false');
      const art = el('canvas', 'pick-art pick-canvas');
      art.width = art.height = 88;
      art.setAttribute('aria-hidden', 'true');
      try { def.icon(art.getContext('2d'), 88); } catch { /* decorative */ }
      const pickText = el('span', 'pick-text');
      pickText.append(el('b', '', def.title), el('small', '', def.tagline));
      pick.append(art, pickText);
      if (def.badge) pick.append(el('span', 'pick-badge', def.badge));
      picker.append(pick);
    }

    // pane
    const pane = el('div', 'game-layout game-pane' + (portrait ? ' jelly-layout' : wide ? ' wide-layout' : ''));
    pane.id = 'pane-' + id;
    pane.hidden = !def.section;
    const card = el('div', 'game-card' + (portrait ? ' jelly-card' : wide ? ' wide-card' : ''));
    if (def.theme) { card.style.background = def.theme.card; card.style.borderColor = def.theme.border; }

    const hud = el('div', 'game-hud');
    const hudRefs = {};
    for (const h of def.hud) {
      const box = el('div', 'hud-stat' + (h.wide ? ' hud-wide' : ''));
      const strong = el('strong', '', h.initial ?? '0');
      box.append(el('span', '', h.label), strong);
      hudRefs[h.key] = { node: strong, last: null };
      hud.append(box);
    }
    const actions = el('div', 'hud-actions');
    const muteBtn = button('hud-button');
    muteBtn.innerHTML = ICON_SOUND;
    muteBtn.title = '소리';
    const pauseBtn = button('hud-button');
    pauseBtn.innerHTML = ICON_PAUSE;
    pauseBtn.title = '일시정지 (P)';
    pauseBtn.setAttribute('aria-label', '일시정지');
    pauseBtn.disabled = true;
    actions.append(muteBtn, pauseBtn);
    hud.append(actions);

    const stage = el('div', 'game-stage' + (portrait ? ' jelly-stage' : wide ? ' wide-stage' : ''));
    if (def.theme && def.theme.stage) stage.style.background = def.theme.stage;
    const canvas = el('canvas', 'arcade-canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${def.title} 게임 화면`);
    const overlay = el('div', 'game-overlay');
    if (def.theme && def.theme.overlay) overlay.style.background = def.theme.overlay;

    const startPanel = el('div', 'ov-panel');
    const startBtn = button('button button-primary ov-button', '게임 시작');
    const bestHint = el('p', 'ov-hint');
    const intro = el('p', 'ov-text');
    intro.innerHTML = def.intro; // static, authored copy
    startPanel.append(el('p', 'ov-kicker', 'lagi Arcade'), el('h2', 'ov-title', def.title), intro, startBtn, bestHint);

    const pausePanel = el('div', 'ov-panel');
    pausePanel.hidden = true;
    const resumeBtn = button('button button-primary ov-button', '계속하기');
    const restartBtn = button('button ov-ghost', '처음부터');
    pausePanel.append(el('h2', 'ov-title small', '일시정지'), resumeBtn, restartBtn);

    const overPanel = el('div', 'ov-panel');
    overPanel.hidden = true;
    const reasonEl = el('p', 'ov-kicker');
    const recordEl = el('p', 'ov-record', '새 최고 기록');
    recordEl.hidden = true;
    const scoreEl = el('span', '', '0');
    const scoreP = el('p', 'ov-score');
    scoreP.append(scoreEl, el('small', '', '점'));
    const statsDl = el('dl', 'ov-stats');
    const statRefs = {};
    for (const s of def.overStats) {
      const box = el('div');
      const dd = el('dd', '', '0');
      box.append(el('dt', '', s.label), dd);
      statRefs[s.key] = dd;
      statsDl.append(box);
    }
    const retryBtn = button('button button-primary ov-button', '다시 하기');
    const overTitleEl = el('h2', 'ov-title small', def.overTitle || '게임 오버');
    overPanel.append(reasonEl, overTitleEl, recordEl, scoreP, statsDl, retryBtn);
    overlay.append(startPanel, pausePanel, overPanel);
    stage.append(canvas, overlay);
    card.append(hud, stage);

    const side = el('aside', 'game-side');
    const controlsCard = el('section', 'panel side-card');
    controlsCard.append(el('h3', '', '조작법'));
    const controlsList = el('ul', 'controls');
    for (const [keys, label] of def.controls) {
      const li = el('li');
      for (const k of keys) li.append(el('kbd', '', k));
      li.append(el('span', '', label));
      controlsList.append(li);
    }
    controlsCard.append(controlsList);
    if (def.tip) controlsCard.append(el('p', 'side-note', def.tip));
    side.append(controlsCard);
    if (def.legend) {
      const legendCard = el('section', 'panel side-card');
      legendCard.append(el('h3', '', def.legendTitle || '등장 요소'));
      const ul = el('ul', 'legend');
      for (const item of def.legend) {
        const li = el('li');
        const dot = el('i', 'dot');
        dot.style.background = item.color;
        dot.style.boxShadow = `0 0 0 3px ${item.ring || 'rgba(0,0,0,0.06)'}`;
        if (item.square) dot.style.borderRadius = '4px';
        const text = el('div');
        text.append(el('b', '', item.name), el('span', '', item.desc));
        li.append(dot, text);
        ul.append(li);
      }
      legendCard.append(ul);
      side.append(legendCard);
    }
    const recCard = el('section', 'panel side-card');
    recCard.append(el('h3', '', '내 기록'));
    const recDl = el('dl', 'records');
    const recBest = el('dd', '', '0');
    const recPlays = el('dd', '', '0');
    const r1 = el('div'); r1.append(el('dt', '', '최고 점수'), recBest);
    const r2 = el('div'); r2.append(el('dt', '', '플레이'), recPlays);
    recDl.append(r1, r2);
    recCard.append(recDl);
    side.append(recCard);

    pane.append(card, side);
    host.append(pane);

    // ---------- runtime ----------
    const ctx = canvas.getContext('2d');
    const isHidden = () => host.hidden || pane.hidden;
    let state = 'ready';
    let raf = 0;
    let lastTime = null;
    let simulationDebt = 0;
    let frameNumber = 0;
    let pixelW = W, pixelH = H;
    let deathT = 0;
    let endInfo = null;
    const fx = { particles: [], texts: [], rings: [], shake: 0, flash: 0, flashColor: '#ffffff', banner: null };

    const api = {
      W, H, TAU, rand, clamp, lerp, fmt, ctx, store, reducedMotion,
      stage, canvas, pane, card, panels: { start: startPanel, pause: pausePanel, over: overPanel },
      pause() { pause(); },
      invalidate() { if (state === 'paused') kick(); },
      menu() { toMenu(); },
      get section() { return tabName; },
      keys: new Set(),
      get state() { return state; },
      get frameNumber() { return frameNumber; },
      get best() { return rec.best; },
      tone, noise, haptic,
      // Optional per-game mixer: reuse the gesture-unlocked shared context.
      // Reading this never creates or resumes audio in a hidden/idle tab.
      audioBus() { return actx && master ? { context: actx, output: master } : null; },
      get audioMuted() { return muted; },
      glow(color, x, y, r) { ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2); },
      burst(x, y, color, count, speed, life = 0.6, size = 3, gravity = 0) {
        if (fx.particles.length > 700) fx.particles.splice(0, count);
        for (let i = 0; i < count; i++) {
          const a = rand(0, TAU), s = speed * rand(0.25, 1);
          fx.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.6, 1), max: life, size: size * rand(0.6, 1.3), color, gravity });
        }
      },
      text(x, y, str, color = '#ffffff', size = 18, big = false) { fx.texts.push({ x, y, str, color, size, t: 0, big }); },
      ring(x, y, color, max = 50, width = 3) { fx.rings.push({ x, y, color, r: 4, max, width, t: 0 }); },
      shake(n) { if (!reducedMotion) fx.shake = Math.max(fx.shake, n); },
      flash(alpha = 0.4, color = '#ffffff') { fx.flash = alpha; fx.flashColor = color; },
      banner(text, sub = '') { fx.banner = { text, sub, t: 0 }; },
      clearFx() { fx.particles.length = 0; fx.texts.length = 0; fx.rings.length = 0; fx.banner = null; fx.shake = 0; fx.flash = 0; },
      end(reason, stats) {
        if (state !== 'playing') return;
        state = 'dying';
        deathT = def.dyingTime ?? 1.0;
        endInfo = { reason, stats };
        pauseBtn.disabled = true;
        api.keys.clear();
      },
    };
    const game = def.create(api);

    function resize() {
      // layout size (unaffected by CSS transforms such as the rotated landscape mode)
      const cw = stage.clientWidth, ch = stage.clientHeight;
      if (!cw) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      pixelW = Math.round(cw * dpr);
      pixelH = Math.round(ch * dpr);
      if (canvas.width !== pixelW || canvas.height !== pixelH) { canvas.width = pixelW; canvas.height = pixelH; }
      if (state !== 'playing') render();
    }

    function updateFx(dt) {
      for (let i = fx.particles.length - 1; i >= 0; i--) {
        const q = fx.particles[i];
        q.life -= dt;
        if (q.life <= 0) { fx.particles.splice(i, 1); continue; }
        q.vy += q.gravity * dt;
        const drag = Math.pow(q.gravity ? 0.6 : 0.12, dt);
        q.vx *= drag; q.vy *= q.gravity ? 1 : drag;
        q.x += q.vx * dt; q.y += q.vy * dt;
      }
      for (let i = fx.texts.length - 1; i >= 0; i--) { const t = fx.texts[i]; t.t += dt; t.y -= (t.big ? 24 : 38) * dt; if (t.t > 1) fx.texts.splice(i, 1); }
      for (let i = fx.rings.length - 1; i >= 0; i--) { const r = fx.rings[i]; r.t += dt; r.r += (r.max - r.r) * Math.min(1, dt * 10); if (r.t > 0.45) fx.rings.splice(i, 1); }
      if (fx.banner) { fx.banner.t += dt; if (fx.banner.t > 2.1) fx.banner = null; }
      fx.shake = Math.max(0, fx.shake - dt * 30);
      fx.flash = Math.max(0, fx.flash - dt * 1.6);
    }

    function render() {
      const sx = pixelW / W, sy = pixelH / H;
      let ox = 0, oy = 0;
      if (fx.shake > 0) { ox = rand(-fx.shake, fx.shake); oy = rand(-fx.shake, fx.shake); }
      ctx.setTransform(sx, 0, 0, sy, ox * sx, oy * sy);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      game.draw(ctx);
      ctx.setTransform(sx, 0, 0, sy, ox * sx, oy * sy);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // effects
      for (const r of fx.rings) {
        ctx.globalAlpha = Math.max(0, 1 - r.t / 0.45);
        ctx.strokeStyle = r.color; ctx.lineWidth = r.width;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      }
      ctx.globalCompositeOperation = def.additive === false ? 'source-over' : 'lighter';
      for (const q of fx.particles) {
        const k = q.life / q.max;
        ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
        ctx.fillStyle = q.color;
        const s = q.size * (0.4 + 0.6 * k);
        ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      for (const t of fx.texts) {
        const k = t.t;
        const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : k < 0.2 ? 1.1 - ((k - 0.12) / 0.08) * 0.1 : 1;
        ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.font = `900 ${t.size * pop}px system-ui, sans-serif`;
        ctx.lineWidth = t.big ? 6 : 4;
        ctx.strokeStyle = 'rgba(15,10,40,0.6)';
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
      if (fx.banner && (state === 'playing' || state === 'paused')) {
        const b = fx.banner;
        const inK = Math.min(1, b.t / 0.25);
        const outK = b.t > 1.6 ? 1 - (b.t - 1.6) / 0.5 : 1;
        ctx.globalAlpha = Math.max(0, inK * outK);
        const y = H * 0.3 - (1 - inK) * 14;
        ctx.font = `900 ${Math.round(W * 0.095)}px system-ui, sans-serif`;
        ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(15,10,40,0.55)';
        ctx.strokeText(b.text, W / 2, y);
        const grad = ctx.createLinearGradient(W * 0.25, 0, W * 0.75, 0);
        grad.addColorStop(0, '#c7d2fe'); grad.addColorStop(0.5, '#ffffff'); grad.addColorStop(1, '#f5d0fe');
        ctx.fillStyle = grad;
        ctx.fillText(b.text, W / 2, y);
        if (b.sub) {
          ctx.font = `700 ${Math.round(W * 0.04)}px system-ui, sans-serif`;
          ctx.lineWidth = 5;
          ctx.strokeText(b.sub, W / 2, y + W * 0.075);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(b.sub, W / 2, y + W * 0.075);
        }
        ctx.globalAlpha = 1;
      }
      if (fx.flash > 0) {
        ctx.globalAlpha = Math.min(1, fx.flash);
        ctx.fillStyle = fx.flashColor;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.globalAlpha = 1;
      }
    }

    function updateHud() {
      const values = game.hud ? game.hud() : {};
      for (const [key, value] of Object.entries(values)) {
        const ref = hudRefs[key];
        if (ref && ref.last !== value) {
          ref.last = value;
          ref.node.textContent = value;
          ref.node.classList.toggle('long', value.length >= 6);
          ref.node.classList.toggle('xlong', value.length >= 8);
        }
      }
    }
    function updateRecords() {
      recBest.textContent = fmt(rec.best);
      recPlays.textContent = fmt(rec.plays);
      bestHint.textContent = rec.best ? `최고 기록 ${fmt(rec.best)}점` : '첫 기록에 도전해 보세요!';
    }
    function showPanel(name) {
      overlay.hidden = !name;
      startPanel.hidden = name !== 'start';
      pausePanel.hidden = name !== 'pause';
      overPanel.hidden = name !== 'over';
      const target = name === 'start' ? startBtn : name === 'pause' ? resumeBtn : name === 'over' ? retryBtn : null;
      if (target && !isHidden()) setTimeout(() => target.focus({ preventScroll: true }), 30);
      pauseBtn.disabled = state !== 'playing';
    }

    function start() {
      audio();
      api.keys.clear();
      api.clearFx();
      game.init(true);
      lastTime = null;
      state = 'playing';
      rec.plays++;
      store.set(keyPlays, rec.plays);
      updateRecords();
      showPanel(null);
      if (!game.managesAudio) [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'triangle', 0.13, 1, i * 0.06));
      fitToScreen(card);
      kick();
    }
    function pause() {
      if (state !== 'playing') return;
      state = 'paused';
      lastTime = null;
      api.keys.clear();
      if (game.onPause) game.onPause();
      showPanel('pause');
      kick();
    }
    // back to the start menu without playing (a game shared by several tabs uses this when it changes tab)
    function toMenu() {
      if (state === 'ready') return;
      state = 'ready';
      api.keys.clear();
      api.clearFx();
      game.init(false);
      showPanel('start');
      render();
      kick();
    }
    function resume() {
      if (state !== 'paused') return;
      audio();
      lastTime = null;
      state = 'playing';
      if (game.onResume) game.onResume();
      showPanel(null);
      kick();
    }
    function finish() {
      state = 'over';
      if (game.onSuspend) game.onSuspend();
      const { reason, stats } = endInfo;
      const score = Math.floor(stats.score || 0);
      const isRecord = score > rec.best;
      if (isRecord) { rec.best = score; store.set(keyBest, score); }
      updateRecords();
      reasonEl.textContent = reason;
      overTitleEl.textContent = stats.title || def.overTitle || '게임 오버';
      scoreEl.textContent = fmt(score);
      for (const s of def.overStats) statRefs[s.key].textContent = s.format ? s.format(stats[s.key]) : fmt(stats[s.key] || 0);
      recordEl.hidden = !isRecord || score === 0;
      showPanel('over');
      if (!game.managesAudio && isRecord && score > 0) [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.16, 'triangle', 0.13, 1, 0.1 + i * 0.08));
    }

    // input
    function toLogical(event) {
      const rect = canvas.getBoundingClientRect();
      if (stage.classList.contains('stage-rot')) {
        // stage rotated -90deg to force landscape on a portrait screen
        return { x: ((rect.bottom - event.clientY) / rect.height) * W, y: ((event.clientX - rect.left) / rect.width) * H };
      }
      return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
    }
    canvas.addEventListener('pointerdown', event => {
      audio();
      if (state !== 'playing') return;
      event.preventDefault();
      try { canvas.setPointerCapture(event.pointerId); } catch { /* optional */ }
      const p = toLogical(event);
      if (game.pointerDown) game.pointerDown(p.x, p.y, event);
    });
    canvas.addEventListener('pointermove', event => {
      if (state !== 'playing' || !game.pointerMove) return;
      const p = toLogical(event);
      game.pointerMove(p.x, p.y, event);
    });
    const up = event => {
      if (state !== 'playing' || !game.pointerUp) return;
      const p = toLogical(event);
      game.pointerUp(p.x, p.y, event);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', event => event.preventDefault());

    const GAME_KEYS = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'w', 'a', 's', 'd', 'z', 'x']);
    document.addEventListener('keydown', event => {
      if (isHidden() || !document.documentElement.classList.contains('unlocked')) return;
      if (event.target && /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
      const onButton = event.target && event.target.tagName === 'BUTTON';
      if (key === 'p' || key === 'escape') {
        if (key === 'p' && event.repeat) { event.preventDefault(); return; }
        if (state === 'playing') { event.preventDefault(); pause(); }
        else if (state === 'paused' && key === 'p') { event.preventDefault(); resume(); }
        return;
      }
      if (state === 'playing') {
        if (GAME_KEYS.has(key) || key === 'enter') event.preventDefault();
        if (!api.keys.has(key)) { api.keys.add(key); if (game.keyDown) game.keyDown(key, event); }
        return;
      }
      if ((key === 'enter' || key === ' ') && !onButton) {
        if (state === 'ready' || state === 'over') { event.preventDefault(); start(); }
        else if (state === 'paused') { event.preventDefault(); resume(); }
      }
    });
    document.addEventListener('keyup', event => {
      const key = event.key.toLowerCase();
      if (api.keys.delete(key) && state === 'playing' && game.keyUp) game.keyUp(key, event);
    });

    startBtn.addEventListener('click', start);
    retryBtn.addEventListener('click', start);
    restartBtn.addEventListener('click', start);
    resumeBtn.addEventListener('click', resume);
    pauseBtn.addEventListener('click', () => (state === 'playing' ? pause() : resume()));
    function syncMute() {
      muteBtn.classList.toggle('muted', muted);
      muteBtn.setAttribute('aria-pressed', String(muted));
      muteBtn.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
    }
    muteListeners.add(syncMute);
    muteBtn.addEventListener('click', () => { audio(); setMuted(!muted); });

    document.addEventListener('visibilitychange', () => { lastTime = null; if (document.hidden) { pause(); if (game.onSuspend) game.onSuspend(); } else kick(); });
    window.addEventListener('blur', pause);
    document.addEventListener('hanq:lock', pause);
    document.addEventListener('hanq:tab', event => {
      const name = event.detail;
      if (sections && sections.length > 1 && name !== tabName && sections.includes(name)) {
        const next = document.getElementById(name);
        if (next) {
          pause();
          host = next; tabName = name;
          next.append(pane);
          if (game.section) game.section(name);
        }
      }
      if (name !== tabName) { pause(); if (game.onSuspend) game.onSuspend(); } else { requestAnimationFrame(resize); kick(); }
    });
    if (!def.section) document.addEventListener('hanq:game', event => { if (event.detail !== id) pause(); else { requestAnimationFrame(resize); kick(); } });

    function advance(dt) {
      if (state === 'playing') game.update(dt);
      else if (state === 'dying') {
        if (def.updateWhileDying) game.update(dt);
        else if (game.idle) game.idle(dt);
        deathT -= dt;
        if (deathT <= 0) finish();
      } else if (state !== 'paused' && game.idle) game.idle(dt);
      if (state !== 'paused') updateFx(dt);
    }
    function frame(now) {
      raf = 0;
      if (isHidden() || document.hidden) { if (game.onSuspend) game.onSuspend(); lastTime = null; return; }
      frameNumber++;
      // Keep collision steps small. A slow renderer alone still preserves
      // elapsed play time; an already expensive simulation must not repeat
      // itself four times and make the next frame even slower. Defer excess
      // catch-up work, with a finite backlog, instead of enlarging physics dt.
      if (lastTime === null) simulationDebt = 0;
      const elapsed = lastTime === null ? 0 : Math.min(.16, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      simulationDebt = Math.min(.16, simulationDebt + elapsed);
      const measuredNow = () => typeof performance !== 'undefined' && performance.now ? performance.now() : 0;
      const started = measuredNow();
      let stepCost = 0;
      for (let i = 0; i < 4 && state !== 'paused'; i++) {
        if (i && (simulationDebt < 1e-9 || measuredNow() - started + stepCost > 24)) break;
        const dt = Math.min(.04, simulationDebt), before = measuredNow();
        advance(dt);
        stepCost = Math.max(stepCost, measuredNow() - before);
        simulationDebt = Math.max(0, simulationDebt - dt);
      }
      render();
      updateHud();
      if (state !== 'paused' && !raf) raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (!raf && !isHidden() && !document.hidden) { lastTime = null; raf = requestAnimationFrame(frame); }
    }

    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    window.addEventListener('resize', resize);
    game.init(false);
    syncMute();
    updateRecords();
    updateHud();
    showPanel('start');
    resize();
    kick();
  }

  return Object.freeze({ register, fitToScreen, TAU, rand, clamp, lerp, fmt });
})();

