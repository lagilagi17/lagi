'use strict';
/* HanQ Battle Audio — original, locally synthesised score, foley and vocal reactions.
 * Uses the arcade's already-unlocked AudioContext. No downloads, timers, speech
 * synthesis, global randomness or simulation state mutations are used here.
 */
(function (root) {
  const VERSION = '1.0.4';
  const TAU = Math.PI * 2;
  const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, finite(v, lo)));
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function hash(value) {
    let h = 2166136261;
    for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function random(seed) {
    let n = seed >>> 0 || 885;
    return () => { n += 0x6d2b79f5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const GUN_KIND = {
    pistol: 'pistol', desert_eagle: 'heavyPistol', smg: 'smg', mp5: 'smg', vector: 'smg', p90: 'smg',
    ar: 'rifle', ak47: 'rifle', famas: 'rifle', scar_h: 'rifle', m249: 'rifle', rpk: 'rifle',
    shotgun: 'shotgun', spas12: 'shotgun', aa12: 'shotgun', sniper: 'sniper', msr: 'sniper', svd: 'sniper', awm: 'sniper',
    rpg: 'rocket', lancer_1: 'rocket', m79: 'mortar', mortar: 'mortar', minigun: 'minigun'
  };
  const LIMITS = Object.freeze({ events: 32, music: 20, loops: 5, total: 64, voices: 3 });
  function create(options = {}) {
    const rng = random(finite(options.seed, 0x885a2026));
    let requested = false, disposed = false, graph = null, ctx = null, lastError = '', roomError = '';
    let listener = { x: 0, y: 0, h: 0, yaw: 0, indoor: false };
    let levels = { music: .46, effects: .9, voices: .78, ambience: .55 };
    let frame = { threat: 0, danger: false, environment: 'forest', vehicle: null, alive: true };
    let threat = 0, musicState = 'explore', downTime = 0, stateAge = 0, nextBeat = 0, beat = 0, scoreNeedsPad = true;
    let clock = 0, mixClock = 0, detailClock = 0, duckUntil = 0, ambientNext = 3, lastNPCVoice = -100;
    let wasMuted = false, wasHidden = false, vehicleKind = '', vehicleId = null;
    let peakSources = 0, triggered = 0, dropped = 0, renderedBuffers = 0, coalescedShots = 0;
    const sounds = new Set(), clips = new Map(), voiceTimes = new Map(), loops = new Map();
    const parameterTargets = new WeakMap();
    // Finite weapon kinds × eight directions × occlusion state. Only redundant
    // presentation events share a voice; every physical projectile still runs.
    const nearbyGunshots = new Map();
    const feedbackTimes = { hurt: { at: -100, fatal: false }, hitConfirm: { at: -100, fatal: false } };
    const now = () => ctx ? finite(ctx.currentTime) : 0;
    const muted = () => { try { return !!options.isMuted?.(); } catch { return false; } };
    const hidden = () => !!(root.document && root.document.hidden);
    const running = () => !!ctx && (!ctx.state || ctx.state === 'running');
    const groupLevel = group => levels[group] || 0;
    function setParam(param, value, time = now(), smoothing = .06, force = false) {
      if (!param) return;
      value = finite(value); time = Math.max(0, finite(time));
      const constant = typeof param.setTargetAtTime === 'function' && smoothing > 0 ? smoothing : 0;
      const previous = parameterTargets.get(param);
      // Restarting the same exponential target with the same time constant
      // produces the same curve. Keep one event until its target changes,
      // rather than appending identical automation on every game frame.
      // A source's initial scheduled gain ramp is handled separately below.
      if (!force && previous && previous.value === value && previous.constant === constant && time >= previous.time) return;
      try {
        if (constant) param.setTargetAtTime(value, time, constant); else param.setValueAtTime(value, time);
        parameterTargets.set(param, { value, constant, time });
      } catch {
        parameterTargets.delete(param);
        try { param.value = value; } catch { /* optional audio implementation */ }
      }
    }
    function detach(record, stop = true) {
      if (!record || record.ended) return;
      record.ended = true;
      if (record.source) {
        record.source.onended = null;
        if (stop) { try { record.source.stop(now()); } catch { /* already ended */ } }
      }
      for (const node of record.nodes) { try { node.disconnect(); } catch { /* already disconnected */ } }
      sounds.delete(record);
      for (const [key, value] of loops) if (value === record) loops.delete(key);
    }
    function stopAll() {
      for (const record of Array.from(sounds)) detach(record);
      loops.clear(); nearbyGunshots.clear(); vehicleKind = ''; vehicleId = null; nextBeat = 0; scoreNeedsPad = true;
    }
    function disposeGraph() {
      stopAll();
      if (graph) for (const node of graph.nodes) { try { node.disconnect(); } catch { /* owned node only */ } }
      graph = null; ctx = null; clips.clear();
    }
    function ensure() {
      if (disposed) return false;
      let audio;
      try { audio = options.getAudio?.(); } catch (error) { lastError = String(error?.message || error); return false; }
      if (!audio?.context || !audio.output) return false;
      if (ctx && ctx !== audio.context) disposeGraph();
      if (graph) return true;
      const c = audio.context;
      if (!c.createGain || !c.createBuffer || !c.createBufferSource || !c.createBiquadFilter) return false;
      const owned = [];
      try {
        ctx = c;
        const make = name => { const node = c[name](); owned.push(node); return node; };
        const out = make('createGain');
        let limiter = out;
        if (c.createDynamicsCompressor) {
          limiter = make('createDynamicsCompressor');
          setParam(limiter.threshold, -12, now(), 0); setParam(limiter.knee, 16, now(), 0);
          setParam(limiter.ratio, 4, now(), 0); setParam(limiter.attack, .004, now(), 0); setParam(limiter.release, .22, now(), 0);
          out.connect(limiter);
        }
        limiter.connect(audio.output);
        const buses = {};
        for (const group of Object.keys(levels)) buses[group] = make('createGain');
        const musicDuck = make('createGain');
        buses.music.connect(musicDuck); musicDuck.connect(out);
        for (const group of ['effects', 'voices', 'ambience']) buses[group].connect(out);
        // Reverb is optional: an unsupported room effect must never mute the dry mix.
        let roomSend = null;
        roomError = '';
        if (c.createConvolver) {
          const roomNodes = [];
          let send = null;
          try {
            const makeRoom = name => { const node = c[name](); roomNodes.push(node); return node; };
            send = makeRoom('createGain');
            const room = makeRoom('createConvolver'), wet = makeRoom('createGain');
            // Unlike BufferSource playback, convolution requires the context's exact sample rate.
            room.buffer = makePCM('room-impulse', .23, (t, i, r) => (r() * 2 - 1) * Math.exp(-t * 27), 2, c.sampleRate);
            setParam(send.gain, listener.indoor ? .11 : .018, now(), 0); setParam(wet.gain, .32, now(), 0);
            send.connect(room); room.connect(wet); wet.connect(out);
            buses.effects.connect(send); buses.voices.connect(send);
            roomSend = send;
            owned.push(...roomNodes);
          } catch (error) {
            roomError = String(error?.message || error);
            if (send) for (const group of ['effects', 'voices']) { try { buses[group].disconnect(send); } catch { /* not connected */ } }
            for (const node of roomNodes) { try { node.disconnect(); } catch { /* optional effect only */ } }
            clips.delete('room-impulse');
          }
        }
        graph = { nodes: owned, out, buses, musicDuck, roomSend };
        applyLevels(true);
        lastError = '';
        return true;
      } catch (error) {
        lastError = String(error?.message || error);
        for (const node of owned) { try { node.disconnect(); } catch { /* partial construction */ } }
        graph = null; ctx = null; clips.clear(); return false;
      }
    }
    function applyLevels(immediate = false) {
      if (!graph) return;
      for (const key of Object.keys(levels)) setParam(graph.buses[key].gain, levels[key], now(), immediate ? 0 : .035);
    }
    function canPlay(group) {
      return requested && !disposed && !hidden() && !muted() && groupLevel(group) > .0001 && ensure() && running();
    }
    function makePCM(key, duration, render, channels = 1, rate = 22050) {
      if (clips.has(key)) return clips.get(key);
      const length = Math.max(64, Math.ceil(duration * rate));
      const buffer = ctx.createBuffer(channels, length, rate);
      for (let ch = 0; ch < channels; ch++) {
        const data = buffer.getChannelData(ch), r = random(hash(key + ':' + ch));
        let lp = 0, slow = 0;
        const memory = { lp: 0, slow: 0, phase: 0 };
        for (let i = 0; i < length; i++) {
          const t = i / rate, white = r() * 2 - 1;
          lp += .14 * (white - lp); slow += .018 * (white - slow);
          const sample = render(t, i, r, white, lp, slow, ch, memory, rate);
          const edge = key.startsWith('loop:') ? Math.min(1, t / .012, (duration - t) / .012) : 1;
          data[i] = Math.max(-.98, Math.min(.98, finite(sample))) * Math.max(0, edge);
        }
      }
      clips.set(key, buffer); renderedBuffers++;
      return buffer;
    }
    function spatial(o = {}, range = 100) {
      const local = o.local || !Number.isFinite(o.x) || !Number.isFinite(o.y);
      const dx = local ? 0 : o.x - listener.x, dy = local ? 0 : o.y - listener.y;
      const dh = local ? 0 : finite(o.h, listener.h) - listener.h;
      const distance = local ? 0 : Math.max(0, finite(o.distance, Math.hypot(dx, dy, dh * .6)));
      const max = Math.max(1, finite(o.maxDistance, range));
      const fade = local ? 1 : Math.pow(Math.max(0, 1 - distance / max), 1.55) / (1 + distance * .013);
      const pan = local || distance < .05 ? 0 : clamp(Math.sin(Math.atan2(dy, dx) - listener.yaw) * .92, -.92, .92);
      return { volume: fade * (o.occluded ? .34 : 1) * clamp(finite(o.volume, 1), 0, 1.4), pan, filter: o.occluded ? 850 : Math.max(1900, 16000 - distance * 65) };
    }
    function spawn(buffer, config = {}) {
      const group = config.group || 'effects';
      if (!canPlay(group) || !buffer) return false;
      const category = config.category || 'event';
      let count = 0;
      for (const sound of sounds) if (sound.category === category) count++;
      const limit = category === 'music' ? LIMITS.music : category === 'loop' ? LIMITS.loops : LIMITS.events;
      if (sounds.size >= LIMITS.total || count >= limit) {
        // Local injury and hit confirmation must survive a gunfire burst. Keep
        // the same hard cap, replacing the quietest priority class first.
        // An NPC/event can never steal a currently playing local vocal reaction.
        const essential = config.local === true && config.priority >= 3;
        let expendable = null;
        if (category === 'event' && config.priority > 1) for (const candidate of sounds) {
          if (candidate.category !== 'event' || (candidate.tag === 'voice' && candidate.local)) continue;
          if (!(candidate.priority < (essential ? config.priority : 1))) continue;
          if (!expendable || candidate.priority < expendable.priority) expendable = candidate;
        }
        if (expendable) detach(expendable); else { dropped++; return false; }
      }
      const gainValue = clamp(config.gain === undefined ? 1 : config.gain, 0, 1.4);
      if (gainValue < .002) return false;
      // Cold PCM synthesis can be much more expensive than source admission.
      // Resolve lazy clips only after the mixer has accepted the event.
      if (typeof buffer === 'function') buffer = buffer();
      if (!buffer) return false;
      const t = Math.max(now(), finite(config.time, now())), rate = clamp(finite(config.rate, 1), .125, 8);
      const duration = Math.max(.018, finite(config.duration, buffer.duration / rate || .25));
      const nodes = [];
      let source;
      try {
        source = ctx.createBufferSource(); nodes.push(source); source.buffer = buffer;
        source.loop = !!config.loop;
        setParam(source.playbackRate, rate, t, 0);
        const gain = ctx.createGain(); nodes.push(gain);
        let tail = source;
        if (config.filter && config.filter < 18000) {
          const filter = ctx.createBiquadFilter(); nodes.push(filter); filter.type = 'lowpass';
          setParam(filter.frequency, clamp(config.filter, 80, 18000), t, 0); setParam(filter.Q, .7, t, 0);
          tail.connect(filter); tail = filter;
        }
        tail.connect(gain); tail = gain;
        let panner = null;
        if (ctx.createStereoPanner && Math.abs(finite(config.pan)) > .005) {
          panner = ctx.createStereoPanner(); nodes.push(panner); setParam(panner.pan, clamp(config.pan, -1, 1), t, 0);
          tail.connect(panner); tail = panner;
        }
        tail.connect(graph.buses[group]);
        const attack = Math.min(duration / 3, Math.max(.003, finite(config.attack, .003)));
        const release = Math.min(duration / 2, Math.max(.008, finite(config.release, .016)));
        gain.gain.setValueAtTime(.0001, t);
        gain.gain.linearRampToValueAtTime(gainValue, t + attack);
        const permanent = category === 'loop';
        if (!permanent) {
          gain.gain.setValueAtTime(gainValue, Math.max(t + attack, t + duration - release));
          gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
        }
        const record = { source, gain, panner, nodes, group, category, tag: config.tag || '', actor: config.actor ?? null,
          local: config.local === true, priority: finite(config.priority, 1), attackEnd: t + attack, end: permanent ? Infinity : t + duration + .03, ended: false };
        sounds.add(record); peakSources = Math.max(peakSources, sounds.size);
        source.onended = () => detach(record, false);
        source.start(t);
        if (!permanent) source.stop(record.end);
        triggered++;
        return record;
      } catch (error) {
        lastError = String(error?.message || error);
        if (source) { try { source.stop(); } catch { /* source not started */ } }
        for (const node of nodes) { try { node.disconnect(); } catch { /* optional */ } }
        for (const record of sounds) if (record.source === source) { record.ended = true; sounds.delete(record); }
        return false;
      }
    }
    const envelope = (t, at, decay, attack = .002) => t < at ? 0 : (1 - Math.exp(-(t - at) / attack)) * Math.exp(-(t - at) / decay);
    function clip(name, kind = '', variation = 0) {
      const key = name + ':' + kind + ':' + variation;
      if (clips.has(key)) return clips.get(key);
      const pitch = .92 + variation * .055;
      let duration = ({ explosion: 1.85, reload: .46, reloadEnd: .2, empty: .1, melee: .22, impact: .28, hurt: .26, hitConfirm: .105, step: .26,
        jump: .22, land: .42, swim: .65, equip: .32, pickup: .35, heal: .65, shield: .48, grenade: .28,
        warning: .8, victory: 2.8, defeat: 2.4, enterVehicle: .55, exitVehicle: .38, door: .65, breath: .65 })[name] || .25;
      if (name === 'gun') duration = ({ sniper: .85, shotgun: .62, rocket: .75, mortar: .72, heavyPistol: .42, minigun: .16, smg: .22 })[kind] || .36;
      if (name === 'hitConfirm' && kind === 'kill') duration = .18;
      return makePCM(key, duration, (t, i, r, n, lp, slow) => {
        const high = n - lp, end = Math.min(1, (duration - t) / .018);
        let value = 0;
        if (name === 'gun') {
          const power = ({ pistol: .7, heavyPistol: .95, smg: .58, rifle: .82, shotgun: 1, sniper: 1, minigun: .55, mortar: 1, rocket: .9 })[kind] || .8;
          if (kind === 'rocket') value = .7 * lp * envelope(t, 0, .38, .018) + .4 * Math.sin(TAU * (96 * t - 35 * t * t)) * envelope(t, 0, .18) + .3 * high * envelope(t, .04, .15, .025);
          else {
            const low = kind === 'sniper' || kind === 'shotgun' || kind === 'mortar', f = (low ? 78 : kind === 'smg' ? 185 : 128) * pitch;
            value = power * (high * 1.05 * envelope(t, 0, .007, .0004) + lp * 1.6 * envelope(t, .003, low ? .13 : .041));
            value += .34 * power * Math.sin(TAU * (f * t + 2.2 * (1 - Math.exp(-t * 28)))) * envelope(t, 0, low ? .12 : .05);
            value += .34 * lp * envelope(t, .017, low ? .24 : .09);
            value += .13 * (Math.sin(TAU * 1420 * pitch * t) + high) * envelope(t, low ? .09 : .027, .012);
          }
        } else if (name === 'explosion') {
          value = .72 * Math.sin(TAU * (44 * t + 3 * (1 - Math.exp(-t * 13)))) * envelope(t, 0, .34, .006);
          value += 1.65 * lp * envelope(t, .006, .45, .012) + .72 * high * envelope(t, 0, .023, .001);
          value += .85 * slow * envelope(t, .08, .67, .03);
          for (const at of [.12, .24, .47, .73]) value += .17 * high * envelope(t, at + variation * .009, .028);
        } else if (name === 'step' || name === 'land') {
          const weight = name === 'land' ? 1.2 : .65, e = envelope(t, .002, name === 'land' ? .095 : .035);
          value = weight * (2.2 * lp + .27 * Math.sin(TAU * 73 * pitch * t)) * e;
          if (kind === 'grass' || kind === 'sand') value += (kind === 'sand' ? .52 : .32) * high * envelope(t, .015, .065, .009);
          else if (kind === 'metal') value += (.23 * Math.sin(TAU * 390 * pitch * t) + .13 * Math.sin(TAU * 987 * pitch * t)) * envelope(t, 0, .085);
          else if (kind === 'wood') value += .32 * Math.sin(TAU * 168 * pitch * t) * envelope(t, 0, .05);
          else if (kind === 'water') value += 1.5 * lp * envelope(t, .012, .075, .017) + .1 * Math.sin(TAU * (920 * t - 700 * t * t)) * envelope(t, .04, .045);
          else value += .43 * high * envelope(t, 0, .015) + .18 * lp * envelope(t, .047, .03);
        } else if (name === 'hurt') {
          // A close body/vest thump with a brief mid-band attack, distinguishable
          // from muzzle blast even when a small damage value caused the hit.
          value = .95 * lp * envelope(t, 0, .068) + .52 * high * envelope(t, 0, .016, .0007);
          value += .5 * Math.sin(TAU * 170 * pitch * t) * envelope(t, .001, .048);
          value += .27 * Math.sin(TAU * 740 * pitch * t) * envelope(t, .002, .035);
          if (kind === 'metal') value += (.31 * Math.sin(TAU * 970 * pitch * t) + .16 * Math.sin(TAU * 1810 * pitch * t)) * envelope(t, 0, .052);
        } else if (name === 'hitConfirm') {
          // Brief UI feedback for a confirmed hit; the distant impact and voice
          // retain their independent physical attenuation.
          const bright = kind === 'metal';
          value = .42 * high * envelope(t, 0, .012, .0006) + .36 * lp * envelope(t, 0, .024);
          value += (.32 * Math.sin(TAU * (bright ? 1840 : 1320) * t) + .19 * Math.sin(TAU * (bright ? 2760 : 2140) * t)) * envelope(t, .001, .024, .001);
          if (kind === 'kill') value += (.34 * Math.sin(TAU * 1760 * t) + .2 * Math.sin(TAU * 2640 * t)) * envelope(t, .047, .034, .002);
        } else if (name === 'impact' || name === 'shield') {
          value = .72 * high * envelope(t, 0, .009, .0008) + 1.05 * lp * envelope(t, 0, .035);
          if (kind === 'metal' || name === 'shield') value += (.4 * Math.sin(TAU * 760 * pitch * t) + .2 * Math.sin(TAU * 1531 * pitch * t)) * envelope(t, .001, .095);
          else if (kind === 'glass') for (let j = 0; j < 4; j++) value += .24 * Math.sin(TAU * (1850 + j * 727) * pitch * t) * envelope(t, j * .032, .045);
          else if (kind === 'wood') value += .35 * Math.sin(TAU * 210 * pitch * t) * envelope(t, 0, .045);
          else if (kind === 'flesh') value = .9 * lp * envelope(t, 0, .048) + .35 * Math.sin(TAU * 87 * t) * envelope(t, 0, .026)
            + .22 * high * envelope(t, .001, .012) + .16 * Math.sin(TAU * 640 * pitch * t) * envelope(t, .002, .027);
        } else if (name === 'reload' || name === 'reloadEnd' || name === 'empty' || name === 'grenade' || name === 'equip') {
          const taps = name === 'reload' ? [0, .09, .25, .34] : name === 'reloadEnd' ? [0, .065] : name === 'equip' ? [.025, .13] : [0];
          for (const at of taps) value += (.58 * high + .17 * Math.sin(TAU * (name === 'empty' ? 520 : 1750) * pitch * t)) * envelope(t, at, .012);
          if (name !== 'empty') value += .55 * lp * envelope(t, .02, .12, .015);
        } else if (name === 'melee' || name === 'jump' || name === 'breath') {
          const e = Math.sin(Math.PI * Math.min(1, t / duration));
          value = (name === 'breath' ? 1.5 * lp + .17 * high : .65 * lp + .27 * high) * e * e;
        } else if (name === 'swim') {
          value = 1.5 * lp * envelope(t, 0, .19, .025) + .6 * high * envelope(t, .03, .095, .018);
          value += .15 * Math.sin(TAU * (550 * t - 250 * t * t)) * envelope(t, .13, .07, .02);
        } else if (name === 'door' || name === 'enterVehicle' || name === 'exitVehicle') {
          value = .9 * lp * envelope(t, 0, .06) + .3 * Math.sin(TAU * 92 * pitch * t) * envelope(t, 0, .08);
          value += .26 * high * envelope(t, name === 'exitVehicle' ? .16 : .27, .027);
          value += .1 * Math.sin(TAU * (650 * t + 55 * t * t)) * envelope(t, .03, .13, .04);
        } else if (name === 'pickup' || name === 'heal') {
          const freqs = name === 'heal' ? [392, 523.25, 659.25] : [784, 1046.5];
          for (let j = 0; j < freqs.length; j++) value += .19 * Math.sin(TAU * freqs[j] * t) * envelope(t, j * .09, .13, .008);
          if (name === 'heal') value += .25 * high * envelope(t, 0, .05);
        } else if (name === 'warning') {
          value = .25 * Math.sin(TAU * (t < .23 ? 493.9 : 659.25) * t) * (envelope(t, 0, .1, .01) + envelope(t, .26, .12, .01));
        } else if (name === 'victory' || name === 'defeat') {
          const notes = name === 'victory' ? [62, 65, 69, 74] : [62, 60, 57, 50];
          for (let j = 0; j < notes.length; j++) value += .18 * (Math.sin(TAU * midi(notes[j]) * t) + .28 * Math.sin(TAU * midi(notes[j]) * 2 * t)) * envelope(t, j * .2, .65, .03);
        } else value = .25 * lp * envelope(t, 0, .05);
        return Math.tanh(value * 1.2) * Math.max(0, end);
      });
    }
    function duck(amount = .6, duration = .35) {
      if (!graph) return;
      duckUntil = Math.max(duckUntil, clock + duration);
      setParam(graph.musicDuck.gain, amount, now(), .025);
    }
    function play(name, o = {}) {
      if (!canPlay('effects')) return false;
      let kind = String(o.kind || ''), range = 85, volume = .7, priority = 1;
      const feedback = name === 'hurt' || name === 'hitConfirm';
      const fatal = name === 'hitConfirm' && kind === 'kill' || !!o.death || !!o.fatal;
      let upgrade = false;
      if (feedback) {
        const previous = feedbackTimes[name], elapsed = clock - previous.at;
        upgrade = fatal && !previous.fatal && elapsed < .2;
        if (elapsed < (name === 'hurt' ? .08 : .06) && !upgrade) { dropped++; return false; }
        kind = name === 'hitConfirm' && fatal ? 'kill' : kind === 'metal' ? 'metal' : 'flesh';
        // These are personal feedback cues, never inaudible world emitters.
        o = { ...o, local: true, occluded: false, distance: 0 };
        volume = name === 'hurt' ? .94 : .66;
        priority = name === 'hurt' ? 4 : 3;
      } else if (name === 'gun') { kind = GUN_KIND[o.type] || (['pistol', 'heavyPistol', 'smg', 'rifle', 'shotgun', 'sniper', 'rocket', 'mortar', 'minigun'].includes(kind) ? kind : 'rifle'); range = kind === 'sniper' ? 230 : 180; volume = .91; priority = 2; }
      else if (name === 'explosion') { range = 280; volume = 1.05; priority = 3; }
      else if (name === 'step') { kind = ['grass', 'sand', 'concrete', 'metal', 'wood', 'water'].includes(kind) ? kind : 'concrete'; range = 24; volume = .34; priority = 0; }
      else if (name === 'land') { range = 45; volume = .65; }
      else if (name === 'impact') { range = 70; volume = .65; }
      else if (name === 'melee') { range = 22; volume = .55; }
      else if (name === 'victory' || name === 'defeat') { volume = .67; priority = 3; }
      else if (name === 'breath') { range = 15; volume = .22; priority = 0; }
      const position = spatial(o, range);
      if (name === 'gun' && position.volume < .25) priority = 0;
      const intensity = clamp(finite(o.intensity, 1), feedback ? name === 'hurt' ? .72 : .8 : .2, feedback ? 1.15 : 1.4);
      if (position.volume < .005) return false;
      let gunshotKey = null;
      const gain = position.volume * volume * intensity;
      if (name === 'gun' && !o.local && Number.isFinite(o.x) && Number.isFinite(o.y) && kind !== 'rocket' && kind !== 'mortar') {
        const angle = Math.atan2(o.y - listener.y, o.x - listener.x) - listener.yaw;
        const sector = ((Math.floor((angle + Math.PI / 8) / (Math.PI / 4)) % 8) + 8) % 8;
        gunshotKey = kind + ':' + sector + ':' + !!o.occluded;
        const recent = nearbyGunshots.get(gunshotKey);
        // Never let a distant quiet shot suppress a nearby loud one, or mix
        // opposite directions. Forty milliseconds is shorter than a burst beat.
        if (recent && now() - recent.at < .04 && gain >= recent.gain * .8 && gain <= recent.gain * 1.25) {
          coalescedShots++; return false;
        }
      }
      const variation = Math.floor(rng() * 3);
      if (upgrade) for (const record of Array.from(sounds)) if (record.tag === name && record.local) detach(record);
      const accepted = spawn(() => clip(name, kind, variation), { gain, pan: position.pan, filter: position.filter,
        rate: .97 + rng() * .06, tag: name, priority, local: !!o.local, release: .015 });
      if (accepted && gunshotKey) nearbyGunshots.set(gunshotKey, { at: now(), gain });
      if (accepted && feedback) {
        feedbackTimes[name] = { at: clock, fatal };
        if (name === 'hurt') duck(.48, .3);
      }
      if (accepted && (name === 'explosion' || name === 'victory' || name === 'defeat' || (name === 'gun' && position.volume > .4))) duck(name === 'explosion' ? .42 : .67, name === 'explosion' ? .75 : .18);
      return !!accepted;
    }
    function voiceBuffer(timbre, death, variant) {
      const key = 'voice:' + timbre + ':' + (death ? 'fall' : 'pain') + ':' + variant;
      if (clips.has(key)) return clips.get(key);
      const duration = death ? .73 + variant * .045 : .31 + variant * .045;
      const base = [118, 145, 174, 207][timbre];
      const formants = [[570, 1120, 2460], [650, 1300, 2700], [720, 1210, 2850], [830, 1450, 3100]][timbre];
      const states = formants.map(f => {
        const w = TAU * f / 22050, alpha = Math.sin(w) / 7, a0 = 1 + alpha;
        return { b0: alpha / a0, b2: -alpha / a0, a1: -2 * Math.cos(w) / a0, a2: (1 - alpha) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
      });
      let phase = 0;
      return makePCM(key, duration, (t, i, r, n, lp) => {
        const q = t / duration;
        const f0 = base * (death ? 1.6 - .8 * q : 1.17 + .55 * Math.sin(q * Math.PI) - .4 * q) * (1 + .025 * Math.sin(TAU * 7.2 * t));
        phase = (phase + f0 / 22050) % 1;
        // Short, breathy glottal excitation through three vowel resonances.
        const pulse = phase < .35 ? Math.sin(Math.PI * phase / .35) : -.28 * Math.sin(Math.PI * (phase - .35) / .65);
        const raw = pulse + n * (.16 + .22 * q);
        let vowel = 0;
        states.forEach((s, j) => {
          const y = s.b0 * raw + s.b2 * s.x2 - s.a1 * s.y1 - s.a2 * s.y2;
          s.x2 = s.x1; s.x1 = raw; s.y2 = s.y1; s.y1 = y;
          vowel += y * [2.7, 1.9, .95][j];
        });
        const e = Math.pow(Math.sin(Math.PI * q), death ? .65 : .55) * Math.min(1, t / .024);
        const flutter = death ? .78 + .22 * Math.sin(TAU * (8 * t + 2 * t * t)) : 1;
        return Math.tanh(vowel * 1.55 + pulse * .12 + lp * .22) * e * flutter * .86;
      });
    }
    function voice(o = {}) {
      if (!canPlay('voices')) return false;
      const id = o.id === undefined ? 'anonymous' : String(o.id), death = !!o.death, local = o.local === true;
      const last = voiceTimes.get(id);
      const finishing = death && last && !last.death;
      const actorCooldown = death ? 1.8 : last?.death ? 1.2 : local ? .28 : .66;
      if ((last && clock - last.at < actorCooldown && !finishing) || (!local && clock - lastNPCVoice < .13 && !finishing)) { dropped++; return false; }
      const p = spatial(o, death ? 115 : 82);
      if (p.volume < .009) return false;
      // Keep one reaction per actor. A player reaction may replace a distant NPC
      // at the three-voice cap, while NPC reactions never interrupt the player.
      if (finishing || local) for (const record of Array.from(sounds)) if (record.tag === 'voice' && record.actor === id) detach(record);
      const currentVoices = Array.from(sounds).filter(s => s.tag === 'voice');
      if (currentVoices.length >= LIMITS.voices) {
        const replace = local && currentVoices.find(record => !record.local);
        if (replace) detach(replace); else { dropped++; return false; }
      }
      const timbre = hash(o.seed === undefined ? id : o.seed) % 4, variant = Math.floor(rng() * 3);
      const accepted = spawn(() => voiceBuffer(timbre, death, variant), { group: 'voices', gain: p.volume * (death ? .88 : local ? .85 : .73) * clamp(finite(o.intensity, 1), local ? .7 : .5, 1.2), pan: p.pan, filter: p.filter, tag: 'voice', actor: id, local, priority: local ? 4 : 2, attack: .009, release: .025 });
      if (accepted) {
        if (!local) lastNPCVoice = clock;
        voiceTimes.set(id, { at: clock, death });
        if (voiceTimes.size > 256) voiceTimes.delete(voiceTimes.keys().next().value);
        duck(.6, death ? .65 : .34);
      }
      return !!accepted;
    }
    function tone(freq, duration, type = 'sine', volume = .2, slide = 1, delay = 0) {
      if (!canPlay('effects') || finite(volume) <= 0) return false;
      freq = clamp(freq, 25, 14000); duration = clamp(duration, .025, 4); slide = clamp(slide, .05, 8); delay = clamp(delay, 0, 8);
      // Compatibility UI cues use a bounded cache; quantised keys prevent growth.
      const f = Math.round(freq / 5) * 5, d = Math.round(duration * 40) / 40;
      const key = 'tone:' + f + ':' + d + ':' + type + ':' + Math.round(slide * 20);
      const render = t => {
        const k = Math.log(slide), phase = Math.abs(k) < .001 ? TAU * f * t : TAU * f * duration / k * (Math.exp(k * t / duration) - 1);
        let wave = Math.sin(phase);
        if (type === 'triangle') wave = Math.asin(wave) * 2 / Math.PI;
        else if (type === 'square') wave = .78 * (Math.sin(phase) + Math.sin(3 * phase) / 3 + Math.sin(5 * phase) / 5);
        else if (type === 'sawtooth') wave = .6 * (Math.sin(phase) - .5 * Math.sin(2 * phase) + Math.sin(3 * phase) / 3 - Math.sin(4 * phase) / 4);
        return wave * Math.exp(-t * 3.4 / duration);
      };
      // Legacy frequency sweeps can have arbitrary values; retain at most 48.
      // Rejected effects never synthesize or disturb the admitted cue cache.
      // Bound newly generated PCM even if the device later rejects the source.
      const resolveTone = () => {
        const cached = clips.has(key), buffer = makePCM(key, duration, render);
        if (!cached) {
          const toneKeys = Array.from(clips.keys()).filter(k => k.startsWith('tone:'));
          while (toneKeys.length > 48) clips.delete(toneKeys.shift());
        }
        return buffer;
      };
      const result = spawn(resolveTone, { gain: clamp(volume, 0, .75), time: now() + delay, tag: 'legacy-tone', priority: 0, attack: .009 });
      return !!result;
    }
    function noise(duration, volume = .25, frequency = 1200, delay = 0) {
      if (!canPlay('effects') || finite(volume) <= 0) return false;
      duration = clamp(duration, .025, 3); delay = clamp(delay, 0, 8);
      return !!spawn(() => makePCM('legacy-noise', 3, (t, i, r, n) => n * .82), { gain: clamp(volume, 0, .8), duration, time: now() + delay, filter: clamp(frequency, 90, 15000), tag: 'legacy-noise', priority: 0, release: duration * .8 });
    }
    function instrument(kind) {
      if (kind === 'pad') return makePCM('instrument-pad', 2, (t, i, r, n, lp, slow, ch) => {
        const f = 110 + (ch ? .5 : -.5);
        return (Math.sin(TAU * f * t) * .32 + Math.sin(TAU * 110 * t) * .31 + Math.sin(TAU * (220 + (ch ? -1 : 1)) * t) * .11 + Math.sin(TAU * 330 * t) * .045) * .72;
      }, 2);
      if (kind === 'pluck') return makePCM('instrument-pluck', 2, (t) => (Math.sin(TAU * 220 * t) + .27 * Math.sin(TAU * 440 * t) + .12 * Math.sin(TAU * 660 * t)) * Math.exp(-t * 4.5) * .55);
      if (kind === 'string') return makePCM('instrument-string', 1, (t) => (Math.sin(TAU * 110 * t) + .32 * Math.sin(TAU * 220 * t) + .19 * Math.sin(TAU * 330 * t) + .07 * Math.sin(TAU * 550 * t)) * .45);
      if (kind === 'bass') return makePCM('instrument-bass', 1, t => (Math.sin(TAU * 55 * t) + .16 * Math.sin(TAU * 110 * t)) * .7);
      if (kind === 'kick') return makePCM('instrument-kick', .38, (t, i, r, n, lp) => .75 * Math.sin(TAU * (45 * t + 2.5 * (1 - Math.exp(-t * 24)))) * envelope(t, 0, .1) + .12 * lp * envelope(t, 0, .012));
      if (kind === 'snare') return makePCM('instrument-snare', .21, (t, i, r, n, lp) => (.44 * (n - lp) + .25 * Math.sin(TAU * 180 * t)) * envelope(t, 0, .055));
      return makePCM('instrument-tick', .1, (t, i, r, n, lp) => .45 * (n - lp) * envelope(t, 0, .016));
    }
    function note(kind, n, time, duration, gain, pan = 0) {
      const base = kind === 'pad' || kind === 'string' ? 110 : kind === 'bass' ? 55 : 220;
      return spawn(() => instrument(kind), { group: 'music', category: 'music', tag: kind, time, duration, rate: midi(n) / base,
        loop: kind !== 'pluck', gain, pan, filter: kind === 'pad' ? 1700 : kind === 'string' ? 2300 : 8000,
        attack: kind === 'pad' ? .65 : kind === 'string' ? .04 : .012, release: kind === 'pad' ? .9 : kind === 'string' ? .12 : .08 });
    }
    function drum(kind, time, gain, pan = 0) {
      return spawn(() => instrument(kind), { group: 'music', category: 'music', tag: 'percussion', time, gain, pan });
    }
    function score() {
      if (!graph || !running()) return;
      const seconds = 60 / 88;
      if (!nextBeat || nextBeat < now() - .25) nextBeat = now() + .045;
      const lookahead = .22;
      let scheduled = 0;
      while (nextBeat < now() + lookahead && scheduled++ < 4) {
        const at = nextBeat, tick = beat % 64, chordIndex = Math.floor(tick / 16), rootNote = [38, 34, 41, 36][chordIndex];
        const chord = chordIndex === 0 ? [0, 7, 15, 22] : chordIndex === 1 ? [0, 7, 16, 23] : chordIndex === 2 ? [0, 7, 16, 21] : [0, 7, 14, 19];
        const energy = musicState === 'danger' ? 1 : musicState === 'combat' ? .8 : musicState === 'suspense' ? .38 : .12;
        if (levels.music > .001 && !muted()) {
          // One chord lasts four bars; sustained voices crossfade naturally.
          if (tick % 16 === 0 || scoreNeedsPad) {
            for (let j = 0; j < 3; j++) note('pad', rootNote + chord[j] + 12, at, seconds * (16 - tick % 16) + .75, .16 - energy * .035, (j - 1) * .42);
            scoreNeedsPad = false;
          }
          if (beat % 4 === 0) note('bass', rootNote, at, seconds * (energy > .5 ? 1.45 : 3), .16 + energy * .09);
          if (musicState === 'explore' && beat % 4 === 2) {
            const motif = [0, 2, 1, 3, 2, 1, 0, 2], degree = chord[motif[Math.floor(beat / 4) % motif.length]];
            note('pluck', rootNote + degree + 24, at, 1.3, .11, beat % 8 < 4 ? -.35 : .35);
          }
          if (energy >= .35 && beat % 2 === 0) {
            const pattern = [0, 7, 12, 7, 15, 7, 12, 19];
            note('string', rootNote + pattern[Math.floor(beat / 2) % 8] + 12, at, seconds * .78, .1 + energy * .09, beat % 4 ? .27 : -.27);
          }
          if (energy > .5) {
            if (beat % 4 === 0 || beat % 8 === 6) drum('kick', at, .27 + energy * .08);
            if (beat % 4 === 2) drum('snare', at, .17 + energy * .07, .12);
            drum('tick', at + seconds * .5, .08 + energy * .05, beat % 2 ? -.3 : .3);
          }
          if (musicState === 'danger') {
            note('string', rootNote + [24, 26, 27, 31][beat % 4], at + seconds * .5, seconds * .38, .075, beat % 2 ? -.45 : .45);
            if (beat % 8 === 7) drum('snare', at + seconds * .5, .15, -.2);
          }
        }
        beat++; nextBeat += seconds;
      }
    }
    function loopPCM(kind) {
      const key = 'loop:' + kind;
      if (kind === 'wind') return makePCM(key, 4, (t, i, r, n, lp, slow) => (lp * .16 + slow * .9) * (.66 + .22 * Math.sin(TAU * t / 4)) * Math.sin(Math.PI * t / 4) ** 2);
      if (kind === 'room') return makePCM(key, 4, (t, i, r, n, lp) => .16 * Math.sin(TAU * 60 * t) + .06 * Math.sin(TAU * 120 * t) + lp * .19);
      if (kind === 'sea') return makePCM(key, 4, (t, i, r, n, lp, slow) => (lp * .7 + slow * 1.1) * (.56 + .42 * Math.cos(TAU * t / 4)));
      if (kind === 'helicopter') return makePCM(key, 2, (t, i, r, n, lp) => (.25 * Math.sin(TAU * 58 * t) + .2 * Math.sin(TAU * 116 * t) + lp * .8) * (.25 + .75 * Math.pow(.5 + .5 * Math.sin(TAU * 14 * t), 5)));
      if (kind === 'plane') return makePCM(key, 2, (t, i, r, n, lp, slow) => lp * .8 + .12 * Math.sin(TAU * 420 * t) + slow * .6 + .07 * Math.sin(TAU * 840 * t));
      if (kind === 'boat') return makePCM(key, 2, (t, i, r, n, lp) => .28 * Math.sin(TAU * 48 * t) + .13 * Math.sin(TAU * 96 * t) + lp * .6 * (.6 + .3 * Math.sin(TAU * 6 * t)));
      if (kind === 'tank') return makePCM(key, 2, (t, i, r, n, lp) => .32 * Math.sin(TAU * 42 * t) + .16 * Math.sin(TAU * 84 * t) + lp * .4 * (.6 + .4 * Math.pow(Math.sin(TAU * 22 * t), 4)));
      return makePCM(key, 2, (t, i, r, n, lp) => .26 * Math.sin(TAU * 54 * t) + .14 * Math.sin(TAU * 108 * t) + .07 * Math.sin(TAU * 162 * t) + lp * .15);
    }
    function setLoop(key, kind, group, gain, rate = 1) {
      if (gain < .002 || groupLevel(group) < .001) {
        const old = loops.get(key); if (old) detach(old); return;
      }
      let record = loops.get(key);
      if (record && record.tag !== kind) { detach(record); record = null; }
      if (!record) {
        record = spawn(() => loopPCM(kind), { group, category: 'loop', loop: true, tag: kind, gain, rate, attack: .35, filter: kind === 'plane' ? 3500 : 5000 });
        if (record) loops.set(key, record);
      } else {
        // Until the source's authored attack ramp has finished, preserve all
        // original control events that may interleave with that future ramp.
        const time = now();
        setParam(record.gain.gain, gain, time, .25, time < record.attackEnd);
        setParam(record.source.playbackRate, rate, time, .17);
      }
    }
    function ambient() {
      const environment = frame.environment || 'forest', indoor = listener.indoor || environment === 'interior';
      setLoop('ambient-wind', indoor ? 'room' : 'wind', 'ambience', indoor ? .12 : environment === 'air' ? .2 : .19);
      setLoop('ambient-sea', 'sea', 'ambience', environment === 'coast' ? .28 : 0);
      const v = frame.vehicle;
      if (v && frame.alive !== false) {
        const kind = ['car', 'tank', 'helicopter', 'plane', 'boat'].includes(v.kind) ? v.kind : 'car';
        const speed = Math.abs(finite(v.speed)), throttle = clamp(Math.abs(finite(v.throttle)), 0, 1);
        const moving = clamp(speed / (kind === 'plane' ? 85 : kind === 'helicopter' ? 30 : kind === 'boat' ? 22 : 35));
        const rate = kind === 'helicopter' ? .92 + throttle * .22 + moving * .09 : kind === 'plane' ? .8 + throttle * .42 + moving * .18 : .75 + moving * .85 + throttle * .23;
        setLoop('vehicle', kind, 'ambience', (kind === 'plane' ? .33 : kind === 'helicopter' ? .38 : .24) + moving * .19 + throttle * .07, rate);
        vehicleKind = kind; vehicleId = v.id ?? null;
      } else { setLoop('vehicle', 'car', 'ambience', 0); vehicleKind = ''; vehicleId = null; }
      if (clock > ambientNext && levels.ambience > .001 && frame.alive !== false && !indoor) {
        ambientNext = clock + 6 + rng() * 8;
        if (environment === 'forest' || environment === 'coast') {
          const bird = () => makePCM(environment === 'coast' ? 'distant-gull' : 'distant-bird', environment === 'coast' ? .8 : .48, t => {
            const sea = environment === 'coast', frequency = sea ? 820 : 2200;
            return Math.sin(TAU * (frequency * t + (sea ? 120 : 340) * Math.sin(t * (sea ? 7 : 15)) / (sea ? 7 : 15))) * Math.sin(Math.PI * t / (sea ? .8 : .48)) ** 2 * .2;
          });
          spawn(bird, { group: 'ambience', gain: .18, pan: rng() * 1.4 - .7, filter: 4500, tag: 'nature', priority: 0 });
        }
      }
      if (frame.breath && clock > detailClock && frame.alive !== false) {
        detailClock = clock + 1.2;
        spawn(() => clip('breath'), { group: 'voices', gain: .15, tag: 'breathing', priority: 0 });
      }
    }
    function updateThreat(dt) {
      const target = frame.alive === false ? 0 : clamp(frame.threat);
      threat += (target - threat) * (1 - Math.exp(-dt / (target > threat ? .55 : 3.5)));
      stateAge += dt;
      const state = frame.danger && target > .15 ? 'danger' : threat >= .62 ? 'combat' : threat >= .22 ? 'suspense' : 'explore';
      const rank = { explore: 0, suspense: 1, combat: 2, danger: 3 };
      if (rank[state] > rank[musicState]) { musicState = state; stateAge = 0; downTime = 0; }
      else if (rank[state] < rank[musicState]) {
        // Never chatter between cues when one enemy moves in and out of cover.
        const threshold = musicState === 'danger' ? !frame.danger : musicState === 'combat' ? threat < .46 : threat < .12;
        downTime = threshold ? downTime + dt : 0;
        if (downTime >= (musicState === 'danger' ? 2 : 4)) { musicState = state; stateAge = 0; downTime = 0; }
      } else downTime = 0;
    }
    function update(dt, state = {}) {
      if (disposed) return;
      dt = clamp(dt, 0, .25);
      frame = { ...frame, ...state }; clock += requested ? dt : 0;
      if (!requested) return;
      const quiet = muted(), concealed = hidden();
      if (quiet || concealed) {
        if (!wasMuted && !wasHidden) stopAll();
        if (graph) setParam(graph.out.gain, 0, now(), 0);
        wasMuted = quiet; wasHidden = concealed; return;
      }
      const recovering = wasMuted || wasHidden;
      wasMuted = false; wasHidden = false;
      if (!ensure() || !running()) { if (sounds.size) stopAll(); return; }
      if (recovering) setParam(graph.out.gain, 1, now(), .008);
      for (const record of Array.from(sounds)) if (record.end <= now()) detach(record, false);
      updateThreat(dt);
      mixClock += dt;
      if (mixClock >= .08) {
        mixClock = 0;
        if (clock >= duckUntil) setParam(graph.musicDuck.gain, 1, now(), .32);
        setParam(graph.roomSend?.gain, listener.indoor ? .11 : .018, now(), .2);
        ambient();
      }
      score();
    }
    function start() {
      if (disposed) return false;
      requested = true;
      const ready = !hidden() && !muted() && ensure() && running();
      if (ready) setParam(graph.out.gain, 1, now(), .008);
      return ready;
    }
    function pause() { requested = false; stopAll(); if (graph) setParam(graph.out.gain, 0, now(), 0); return true; }
    function reset() {
      pause(); threat = 0; musicState = 'explore'; downTime = 0; stateAge = 0; beat = 0;
      clock = 0; mixClock = 0; duckUntil = 0; detailClock = 0; ambientNext = 3; lastNPCVoice = -100;
      for (const name of Object.keys(feedbackTimes)) feedbackTimes[name] = { at: -100, fatal: false };
      voiceTimes.clear(); frame = { threat: 0, danger: false, environment: 'forest', vehicle: null, alive: true };
      if (graph) setParam(graph.musicDuck.gain, 1, now(), 0);
      return true;
    }
    function setLevels(next = {}) {
      const oldMusic = levels.music;
      for (const key of Object.keys(levels)) if (Number.isFinite(Number(next[key]))) levels[key] = clamp(next[key]);
      if (oldMusic <= .001 && levels.music > .001) scoreNeedsPad = true;
      applyLevels();
      for (const record of Array.from(sounds)) if (levels[record.group] <= .001) detach(record);
      return { ...levels };
    }
    function setListener(next = {}) {
      for (const key of ['x', 'y', 'h', 'yaw']) if (Number.isFinite(next[key])) listener[key] = next[key];
      if (typeof next.indoor === 'boolean') listener.indoor = next.indoor;
    }
    function dispose() { if (disposed) return; pause(); disposeGraph(); disposed = true; voiceTimes.clear(); }
    function diagnostics() {
      const records = Array.from(sounds);
      return { version: VERSION, started: requested, active: requested && !!graph && running() && !muted() && !hidden(), paused: !requested,
        disposed, connected: !!graph, musicState, threat, levels: { ...levels }, activeEvents: records.filter(s => s.category === 'event').length,
        activeMusic: records.filter(s => s.category === 'music').length, activeLoops: records.filter(s => s.category === 'loop').length,
        sources: records.length, nodes: (graph?.nodes.length || 0) + records.reduce((n, s) => n + s.nodes.length, 0), peakSources,
        triggered, dropped, coalescedShots, renderedBuffers, cachedBuffers: clips.size, environment: frame.environment, vehicleKind, vehicleId,
        contextState: ctx?.state || 'unavailable', sampleRate: ctx?.sampleRate || 0, roomEnabled: !!graph?.roomSend,
        roomError, lastError, limits: { ...LIMITS } };
    }
    // Audio remains optional: a lost device/context must never interrupt gameplay.
    const safe = (fn, fallback) => (...args) => {
      try { return fn(...args); }
      catch (error) { lastError = String(error?.message || error); return fallback; }
    };
    return { start: safe(start, false), pause, reset, dispose, setLevels, setListener, update: safe(update),
      play: safe(play, false), voice: safe(voice, false), tone: safe(tone, false), noise: safe(noise, false), diagnostics };
  }
  root.HanQBattleAudio = { version: VERSION, create };
})(typeof window !== 'undefined' ? window : globalThis);
