/* Durable, account-scoped game saves. Existing game snapshots stay unchanged.
 * Only the nine game slots are read; calculator/archive storage is never copied.
 * Credentials travel in Authorization, never in a URL or a save payload. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HanQCloudSave = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const VERSION = 'cloud-save-20261119-v1';
  const SLOTS = Object.freeze(['1', '2', '3', '4', '5', 'auto', 'auto-prev', 'auto-royale', 'auto-assassin']);
  const SLOT_SET = new Set(SLOTS), MODES = new Set(['open', 'royale', 'assassin']);
  const INDEX = 'hanq-royale-saves', IDENTITY = 'hanq-cloud-save-identity-v1';
  const SWITCH = 'hanq-cloud-save-switch-v1', PREFIX = 'hanq-cloud-save-v1:';
  const CODE_RE = /^hq1_[A-Za-z0-9_-]{43}$/, LIMIT = 4 * 1024 * 1024;
  const slotKey = key => 'hanq-royale-save-' + key;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const parse = (raw, fallback = null) => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const etag = value => !value ? null : String(value).startsWith('"') ? String(value) : '"' + String(value) + '"';
  const fail = code => Object.assign(new Error(code), { code });
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  // This non-security fingerprint only detects local changes. Server concurrency
  // uses ETags; uncertain requests are reconciled with SHA-256 payload digests.
  function fingerprint(text) {
    let a = 2166136261, b = 2246822519;
    for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 3266489917); }
    return text.length + ':' + (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16);
  }
  function create(options = {}) {
    const storage = options.storage || root.localStorage, cryptoAPI = options.crypto || root.crypto;
    const fetcher = options.fetch || root.fetch?.bind(root), now = options.now || Date.now;
    const later = options.setTimeout || root.setTimeout.bind(root), cancelLater = options.clearTimeout || root.clearTimeout.bind(root);
    const timeoutMs = options.requestTimeoutMs ?? 8000, debounceMs = options.debounceMs ?? 700;
    const listeners = new Set(options.onChange ? [options.onChange] : []), changes = new Set();
    let code = null, id = null, meta = null, configured = null, maxSlotBytes = LIMIT;
    let status = 'idle', error = null, timer = null, boot = null, running = null, switching = false, profileReady = false;
    let requestGeneration = 0, operationEpoch = 0, writer = null, halted = false, transitionOwner = null;
    const encoder = new TextEncoder();
    const metaKey = account => PREFIX + account + ':meta';
    const cacheKey = (account, key) => PREFIX + account + ':cache:' + key;
    const recoveryKey = key => PREFIX + id + ':recovery:' + key;
    const random = count => {
      if (!cryptoAPI?.getRandomValues) throw fail('secure_random_unavailable');
      const bytes = cryptoAPI.getRandomValues(new Uint8Array(count)), alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      let out = '', bits = 0, value = 0;
      for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 6) { bits -= 6; out += alphabet[(value >>> bits) & 63]; } }
      if (bits) out += alphabet[(value << (6 - bits)) & 63];
      return out;
    };
    const mutationId = () => random(18);
    const digest = async text => {
      if (!cryptoAPI?.subtle) throw fail('secure_crypto_unavailable');
      const bytes = new Uint8Array(await cryptoAPI.subtle.digest('SHA-256', encoder.encode(text)));
      return [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
    };
    function getState() {
      const entries = meta?.entries || {};
      return {
        status, code, configured, maxSlotBytes,
        pending: Object.values(entries).filter(e => e.pending).length,
        conflicts: SLOTS.filter(key => entries[key]?.conflict).map(key => {
          const e = entries[key], r = e.conflict;
          return { key, localSummary: clone(e.summary), remoteSummary: clone(r.summary), localDeleted: !!e.deleted, deleted: !!r.deleted, remoteUpdatedAt: r.updatedAt || null };
        }),
        lastSynced: meta?.lastSynced || null, error, remoteChanges: [...changes],
      };
    }
    function notify() {
      const state = getState();
      for (const fn of listeners) { try { fn(state); } catch { /* A UI callback cannot break a save transaction. */ } }
    }
    function put(key, value) {
      if (key === INDEX || key.startsWith('hanq-royale-save-') || (id && key === metaKey(id))) assertOwner();
      try { storage.setItem(key, value); } catch { throw fail('local_storage_full'); }
    }
    function remove(key) { if (key === INDEX || key.startsWith('hanq-royale-save-')) assertOwner(); try { storage.removeItem(key); } catch { throw fail('local_storage_unavailable'); } }
    function read(key) { if (key === INDEX || key.startsWith('hanq-royale-save-')) assertOwner(); try { return storage.getItem(key); } catch { throw fail('local_storage_unavailable'); } }
    function changedProfile() {
      if (!halted) {
        halted = true; error = 'profile_changed'; status = 'error';
        for (const key of SLOTS) changes.add(key);
        if (timer !== null) { cancelLater(timer); timer = null; }
        notify();
      }
      return fail('profile_changed');
    }
    function assertOwner() {
      if (halted) throw fail('profile_changed');
      if (!code || !id || !writer) throw fail('not_ready');
      const identity = parse(read(IDENTITY)), journal = parse(read(SWITCH));
      if (transitionOwner) {
        if (!journal || journal.owner !== transitionOwner || identity?.writer !== writer ||
            (identity.code !== code && identity.code !== journal.target?.code)) throw changedProfile();
        return;
      }
      if (journal || identity?.code !== code || identity?.id !== id || identity?.writer !== writer) throw changedProfile();
    }
    function canWriteLocal() {
      if (switching || !id || !meta || !writer) return false;
      try { assertOwner(); return true; } catch (err) { if (err.code !== 'profile_changed') setFailure(err); return false; }
    }
    function newMeta() { return { v: 1, entries: {}, lastSynced: null }; }
    function loadMeta(account) {
      const saved = parse(read(metaKey(account))), result = newMeta();
      if (saved?.v !== 1 || !saved.entries || typeof saved.entries !== 'object') return result;
      result.lastSynced = Number(saved.lastSynced) || null;
      for (const key of SLOTS) if (own(saved.entries, key) && saved.entries[key] && typeof saved.entries[key] === 'object') result.entries[key] = saved.entries[key];
      return result;
    }
    function persist() { if (!id || !meta) throw fail('not_ready'); put(metaKey(id), JSON.stringify(meta)); }
    function index() {
      const result = parse(read(INDEX), {});
      return result && typeof result === 'object' && !Array.isArray(result) ? result : {};
    }
    function summaryOf(summary, data) {
      const mode = data?.cfg?.mode || summary?.mode;
      if (!MODES.has(mode)) throw fail('invalid_save');
      return { mode, text: String(summary?.text || (mode === 'open' ? '오픈월드 저장' : mode === 'royale' ? '배틀로얄 저장' : '암살 저장')).slice(0, 200),
        t: Math.max(0, Math.round(Number(summary?.t) || 0)), at: Math.max(0, Number(summary?.at) || now()) };
    }
    function validateData(raw) {
      if (typeof raw !== 'string' || encoder.encode(raw).byteLength > Math.max(1024, maxSlotBytes - 2048)) throw fail('save_too_large');
      const data = parse(raw);
      if (!data || data.v !== 1 || !Number.isFinite(data.seed) || !data.cfg || !MODES.has(data.cfg.mode) || typeof data.fp !== 'string' || !Array.isArray(data.diff)) throw fail('invalid_save');
      return data;
    }
    function entryFor(key) {
      assertOwner();
      if (!SLOT_SET.has(key)) throw fail('invalid_slot');
      return meta.entries[key] || (meta.entries[key] = { etag: null, known: false, deleted: false, summary: null, lastHash: null, pending: null, attempt: null, conflict: null });
    }
    function setFailure(err) {
      if (err?.code === 'operation_superseded') return;
      if (halted || err?.code === 'profile_changed') { changedProfile(); return; }
      error = err?.code || 'network_error';
      status = error === 'unconfigured' ? 'unconfigured' : ['network_error', 'timeout', 'server_error'].includes(error) ? 'offline' : 'error';
      notify();
    }
    function schedule() {
      if (switching || !id) return;
      if (timer !== null) cancelLater(timer);
      timer = later(() => { timer = null; void sync({ pull: false }); }, debounceMs);
    }
    function stage(key, raw, summary) {
      if (switching) return { ok: false, error: 'switching' };
      if (!id || !meta) return { ok: false, error: 'not_ready' };
      try {
        assertOwner();
        const data = validateData(raw), e = entryFor(key), info = summaryOf(summary, data), fp = fingerprint(raw);
        // The native writer normally wrote this value already. Keeping this
        // idempotent also makes the storage adapter usable without that writer.
        if (read(slotKey(key)) !== raw) put(slotKey(key), raw);
        const idx = index(); idx[key] = { ...info, size: raw.length }; put(INDEX, JSON.stringify(idx));
        if (e.pending?.kind === 'put' && e.localHash === fp && JSON.stringify(e.summary) === JSON.stringify(info)) return { ok: true };
        e.summary = info; e.deleted = false; e.localHash = fp;
        e.pending = { id: mutationId(), kind: 'put' };
        persist(); error = null; if (e.conflict) status = 'conflict';
        notify(); schedule(); return { ok: true };
      } catch (err) { setFailure(err); return { ok: false, error: err.code || 'storage_error' }; }
    }
    function stageDelete(key) {
      if (switching) return { ok: false, error: 'switching' };
      if (!id || !meta) return { ok: false, error: 'not_ready' };
      try {
        const e = entryFor(key), idx = index();
        e.deleted = true; e.pending = { id: mutationId(), kind: 'delete' }; e.localHash = null;
        // Persist intent before removing a local value when called directly.
        persist(); remove(slotKey(key)); delete idx[key]; put(INDEX, JSON.stringify(idx));
        error = null; notify(); schedule(); return { ok: true };
      } catch (err) { setFailure(err); return { ok: false, error: err.code || 'storage_error' }; }
    }
    async function request(path, { method = 'GET', body, match, credential = code } = {}) {
      if (!fetcher) throw fail('network_error');
      const epoch = operationEpoch;
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const headers = { Accept: 'application/json' };
      if (credential) headers.Authorization = 'Bearer ' + credential;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (match !== undefined) headers[match ? 'If-Match' : 'If-None-Match'] = match ? etag(match) : '*';
      let timeout;
      const timed = new Promise((_, reject) => { timeout = later(() => { controller?.abort(); reject(fail('timeout')); }, timeoutMs); });
      try {
        const result = await Promise.race([timed, (async () => {
          const response = await fetcher('/api/game-saves/' + path, { method, headers, cache: 'no-store', credentials: 'same-origin', ...(controller ? { signal: controller.signal } : {}), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
          let value; try { value = await response.json(); } catch { throw fail(response.status >= 500 ? 'server_error' : 'invalid_server_response'); }
          return { status: response.status, ok: response.ok, value };
        })()]);
        if (epoch !== operationEpoch) throw fail('operation_superseded');
        assertOwner();
        return result;
      } catch (err) { throw err?.code ? err : fail('network_error'); }
      finally { cancelLater(timeout); }
    }
    function checked(response) {
      if (response.ok) return response.value;
      const serverCode = response.value?.error;
      if (response.status === 503 && (response.value?.configured === false || serverCode === 'not_configured')) { configured = false; throw fail('unconfigured'); }
      if (response.status >= 500) throw fail('server_error');
      if (response.status === 401 || response.status === 403) throw fail('authentication_failed');
      throw fail(serverCode || ('http_' + response.status));
    }
    async function setup(credential = code, createProfile = true) {
      const health = checked(await request('status', { credential: null }));
      configured = health.configured === true;
      if (Number.isFinite(health.maxSlotBytes)) maxSlotBytes = Math.min(LIMIT, Math.max(1024, health.maxSlotBytes));
      if (!configured) throw fail('unconfigured');
      if (createProfile) checked(await request('profile', { method: 'POST', body: {}, credential }));
      return checked(await request('slots', { credential }));
    }
    async function getRemote(key, credential = code) {
      const response = await request('slots/' + encodeURIComponent(key), { credential });
      if (response.status === 404 && response.value?.error !== 'profile_not_found') return null;
      const value = checked(response);
      if (!value || value.key !== key || !value.etag) throw fail('invalid_server_response');
      value.etag = etag(value.etag);
      if (!value.deleted) validateData(JSON.stringify(value.data));
      return value;
    }
    function descriptor(value) {
      return value ? { etag: etag(value.etag), updatedAt: value.updatedAt || null, summary: clone(value.summary), deleted: !!value.deleted } : { etag: null, updatedAt: null, summary: null, deleted: false, missing: true };
    }
    function conflict(key, remote) {
      const e = entryFor(key); e.conflict = descriptor(remote); e.attempt = null;
      persist(); status = 'conflict'; notify();
    }
    function acceptAcknowledgement(key, remote, operation) {
      const e = entryFor(key), raw = read(slotKey(key));
      let unchanged = e.pending?.id === operation.id;
      if (unchanged && operation.kind === 'put' && operation.localHash && raw !== null && fingerprint(raw) !== operation.localHash) {
        e.pending = { id: mutationId(), kind: 'put' }; e.localHash = fingerprint(raw);
        e.summary = summaryOf(index()[key], validateData(raw)); unchanged = false;
      }
      e.etag = etag(remote.etag); e.known = true; e.attempt = null; e.conflict = null;
      if (unchanged) {
        e.pending = null; e.deleted = !!remote.deleted; e.summary = clone(remote.summary) || e.summary;
        if (remote.deleted) { const idx = index(); remove(slotKey(key)); delete idx[key]; put(INDEX, JSON.stringify(idx)); }
        e.lastHash = remote.deleted || raw === null ? null : fingerprint(raw);
      }
      persist();
    }
    async function reconcileAttempt(key) {
      const attempt = clone(entryFor(key).attempt);
      if (!attempt) return;
      const remote = await getRemote(key), e = entryFor(key);
      if (e.attempt?.id !== attempt.id) return;
      const sameBase = etag(remote?.etag) === etag(attempt.baseEtag);
      if (sameBase) { e.attempt = null; persist(); return; }
      const accepted = remote && (attempt.kind === 'delete' ? remote.deleted : !remote.deleted && await digest(JSON.stringify(remote.data)) === attempt.dataHash);
      if (accepted) { acceptAcknowledgement(key, remote, attempt); return; }
      conflict(key, remote);
    }
    function announceChange(key) { changes.add(key); notify(); }
    function applyRemote(key, remote) {
      const e = entryFor(key), before = read(slotKey(key)), idx = index(), beforeMutation = e.pending?.id || null;
      const raw = remote && !remote.deleted ? JSON.stringify(remote.data) : null;
      if (raw !== null) validateData(raw);
      // Subscribers can hold/pause an active game BEFORE its disk mirror changes.
      if (before !== raw) announceChange(key);
      // A subscriber may synchronously stage one last save while pausing.
      // That save has the same protection as a stage made during the GET.
      if ((entryFor(key).pending?.id || null) !== beforeMutation || read(slotKey(key)) !== before) { conflict(key, remote); return false; }
      if (raw === null) { remove(slotKey(key)); delete idx[key]; }
      else {
        const info = summaryOf(remote.summary, remote.data);
        put(slotKey(key), raw); idx[key] = { ...info, size: raw.length };
      }
      put(INDEX, JSON.stringify(idx));
      Object.assign(e, { etag: etag(remote?.etag), known: true, deleted: !!remote?.deleted, summary: clone(remote?.summary) || null, lastHash: raw === null ? null : fingerprint(raw), localHash: raw === null ? null : fingerprint(raw), pending: null, attempt: null, conflict: null });
      persist(); notify();
    }
    function reconcileDownloaded(key, remote) {
      const e = entryFor(key), raw = read(slotKey(key));
      if (raw !== null && !e.pending && (!e.known || e.lastHash !== fingerprint(raw))) {
        e.pending = { id: mutationId(), kind: 'put' }; e.summary = summaryOf(index()[key], validateData(raw));
        e.localHash = fingerprint(raw); e.deleted = false; persist();
      }
      if (e.conflict) { e.conflict = descriptor(remote); persist(); return; }
      if (e.pending) {
        if (etag(e.etag) === etag(remote?.etag)) return;
        const same = remote && (e.pending.kind === 'delete' ? remote.deleted : !remote.deleted && raw !== null && JSON.stringify(remote.data) === raw);
        if (same) acceptAcknowledgement(key, remote, e.pending); else conflict(key, remote);
        return;
      }
      applyRemote(key, remote);
    }
    function importNative() {
      const idx = index(); let repairedIndex = false;
      for (const key of SLOTS) {
        const raw = read(slotKey(key)); if (raw === null) continue;
        let data; try { data = validateData(raw); } catch { continue; }
        const e = entryFor(key), fp = fingerprint(raw);
        if (!idx[key] || idx[key].mode !== data.cfg.mode) {
          idx[key] = { ...summaryOf(e.summary, data), size: raw.length }; repairedIndex = true;
        }
        if ((!e.pending && (!e.known || e.lastHash !== fp)) || (e.pending?.kind === 'put' && e.localHash !== fp)) {
          e.pending = { id: mutationId(), kind: 'put' }; e.summary = summaryOf(idx[key], data); e.deleted = false; e.localHash = fp;
        }
      }
      if (repairedIndex) put(INDEX, JSON.stringify(idx));
      persist();
    }
    async function pull(manifest) {
      if (!manifest || !Array.isArray(manifest.slots)) throw fail('invalid_server_response');
      const remoteMap = new Map(manifest.slots.filter(x => x && SLOT_SET.has(x.key)).map(x => [x.key, x]));
      for (const key of SLOTS) {
        const e = meta.entries[key], item = remoteMap.get(key), base = etag(item?.etag);
        if (e?.conflict) {
          if (etag(e.conflict.etag) !== base) { e.conflict = descriptor(item || null); persist(); }
          continue;
        }
        if (e?.pending) {
          if (etag(e.etag) === base) { e.known = true; persist(); continue; }
          const remote = item ? await getRemote(key) : null;
          reconcileDownloaded(key, remote);
          continue;
        }
        if (!item) {
          if (e?.etag && read(slotKey(key)) !== null) conflict(key, null);
          continue;
        }
        if (e?.known && etag(e.etag) === base && (item.deleted || read(slotKey(key)) !== null)) continue;
        const remote = await getRemote(key);
        if (remote) reconcileDownloaded(key, remote);
      }
    }
    async function upload(key) {
      for (let round = 0; round < 4; round++) {
        const e = entryFor(key);
        if (!e.pending || e.conflict) return;
        if (e.attempt) { await reconcileAttempt(key); if (e.conflict || !e.pending) return; }
        const operation = clone(e.pending), raw = operation.kind === 'put' ? read(slotKey(key)) : null;
        const data = operation.kind === 'put' ? validateData(raw) : null;
        const attempt = { ...operation, baseEtag: etag(e.etag), summary: clone(e.summary), localHash: raw === null ? null : fingerprint(raw), dataHash: raw === null ? null : await digest(raw) };
        // A newer native save may have appeared while SHA-256 was pending.
        const current = entryFor(key);
        if (current.pending?.id !== operation.id) continue;
        current.attempt = attempt; persist();
        const body = operation.kind === 'put' ? { data, summary: attempt.summary, mutationId: operation.id } : { mutationId: operation.id };
        const response = await request('slots/' + encodeURIComponent(key), { method: operation.kind === 'put' ? 'PUT' : 'DELETE', body, match: attempt.baseEtag });
        if (response.status === 409) {
          const remote = own(response.value || {}, 'current') ? response.value.current : await getRemote(key);
          conflict(key, remote); return;
        }
        const remote = checked(response);
        if (!remote?.etag || remote.key !== key) throw fail('invalid_server_response');
        acceptAcknowledgement(key, remote, attempt);
      }
    }
    async function run(pullRemote, manifest = null) {
      try {
        assertOwner(); status = 'syncing'; error = null; notify();
        if (!profileReady || configured !== true) { manifest = await setup(); profileReady = true; }
        for (const key of SLOTS) if (meta.entries[key]?.attempt) await reconcileAttempt(key);
        // Detect saves written by an older cached game which did not stage an outbox entry.
        importNative();
        if (pullRemote) await pull(manifest || checked(await request('slots')));
        for (const key of SLOTS) if (meta.entries[key]?.pending && !meta.entries[key]?.conflict) await upload(key);
        if (!Object.values(meta.entries).some(e => e.pending || e.conflict)) { meta.lastSynced = now(); persist(); }
        status = Object.values(meta.entries).some(e => e.conflict) ? 'conflict' : 'connected'; error = null;
      } catch (err) { setFailure(err); }
      notify(); return getState();
    }
    function restoreAccountCache(journal) {
      const idx = index();
      for (const key of SLOTS) {
        const raw = read(cacheKey(id, key)), e = meta.entries[key];
        if (raw === null) continue;
        if (!e?.pending && !e?.conflict) { remove(cacheKey(id, key)); continue; }
        const data = validateData(raw); put(slotKey(key), raw);
        idx[key] = { ...summaryOf(e?.summary, data), size: raw.length };
        put(INDEX, JSON.stringify(idx));
        if (journal) {
          journal.restored ||= [];
          if (!journal.restored.includes(key)) journal.restored.push(key);
          put(SWITCH, JSON.stringify(journal)); remove(cacheKey(id, key));
        }
      }
      put(INDEX, JSON.stringify(idx));
    }
    function clearMirror(keep = []) {
      const idx = index();
      for (const key of SLOTS) if (!keep.includes(key)) { remove(slotKey(key)); delete idx[key]; }
      put(INDEX, JSON.stringify(idx));
    }
    function cleanAccountCache() { for (const key of SLOTS) remove(cacheKey(id, key)); }
    async function initialize() {
      status = 'initializing'; notify();
      try {
        const journal = parse(read(SWITCH)), saved = journal?.target || parse(read(IDENTITY));
        code = CODE_RE.test(saved?.code || '') ? saved.code : 'hq1_' + random(32);
        writer = random(18);
        // Only the newest initialized tab owns this browser's slot mirror. A
        // separate device has separate storage and is unaffected by this token.
        put(IDENTITY, JSON.stringify({ v: 1, code, id: saved?.id || null, writer }));
        if (journal?.target) {
          journal.owner = writer; journal.target = { ...journal.target, writer };
          put(SWITCH, JSON.stringify(journal)); transitionOwner = writer;
        }
        const accountId = await digest(code), identity = parse(read(IDENTITY));
        if (identity?.writer !== writer || identity.code !== code) throw changedProfile();
        id = accountId; meta = loadMeta(id);
        put(IDENTITY, JSON.stringify({ v: 1, code, id, writer }));
        if (journal?.target) {
          clearMirror(journal.restored || []); restoreAccountCache(journal);
          remove(SWITCH); transitionOwner = null; cleanAccountCache();
        }
        importNative(); notify();
        return await run(true);
      } catch (err) { setFailure(err); return getState(); }
    }
    function ready() { if (!boot) boot = initialize(); return boot; }
    async function sync({ pull: pullRemote = true } = {}) {
      await ready();
      if (switching || !id || !meta) return getState();
      if (timer !== null) { cancelLater(timer); timer = null; }
      if (running) {
        const epoch = operationEpoch;
        await running;
        // A save can be staged in a slot the active upload loop has already
        // visited. If its debounce fired meanwhile, this waiting caller owns
        // the follow-up flush. Never turn a failed request into a retry loop
        // or continue an operation across an account/ownership change.
        if (epoch !== operationEpoch || switching || halted) return getState();
        const pending = !error && Object.values(meta.entries).some(e => e.pending && !e.conflict);
        return pullRemote || pending ? sync({ pull: pullRemote }) : getState();
      }
      const generation = ++requestGeneration;
      const task = run(pullRemote); running = task;
      try { return await task; } finally { if (generation === requestGeneration) running = null; }
    }
    async function connect(nextCode) {
      nextCode = String(nextCode || '').trim();
      if (!CODE_RE.test(nextCode)) throw fail('invalid_code');
      await ready();
      if (nextCode === code) return sync({ pull: true });
      if (switching) throw fail('switching');
      switching = true; operationEpoch++; status = 'switching'; error = null; notify();
      let identityCommitted = false, switchJournalWritten = false, targetIdentity = null, archivedKeys = [];
      if (timer !== null) { cancelLater(timer); timer = null; }
      try {
        if (running) await running;
        assertOwner();
        const manifest = await setup(nextCode, false), nextId = await digest(nextCode);
        // Validate/download before touching this account's local progress.
        const downloaded = new Map();
        for (const item of manifest.slots || []) if (SLOT_SET.has(item.key)) downloaded.set(item.key, await getRemote(item.key, nextCode));
        importNative();
        const archived = [];
        try {
          for (const key of SLOTS) {
            const e = meta.entries[key], raw = read(slotKey(key));
            if (raw !== null && (e?.pending || e?.conflict || !e?.known)) { const keyName = cacheKey(id, key); put(keyName, raw); archived.push(keyName); }
          }
          persist();
        } catch (err) { for (const keyName of archived) { try { remove(keyName); } catch { /* Original mirror remains intact. */ } } throw err; }
        const removed = SLOTS.filter(key => read(slotKey(key)) !== null);
        const target = { v: 1, code: nextCode, id: nextId, writer }; targetIdentity = target; archivedKeys = archived;
        const journal = { v: 1, target, restored: [], owner: writer };
        put(SWITCH, JSON.stringify(journal)); switchJournalWritten = true; transitionOwner = writer;
        put(IDENTITY, JSON.stringify(target)); identityCommitted = true;
        clearMirror(); code = nextCode; id = nextId; meta = loadMeta(id); profileReady = true;
        restoreAccountCache(journal); importNative();
        // Reuse the already validated responses; applyRemote notifies before
        // changing the mirror so an active game can hold its former session.
        for (const key of removed) changes.add(key);
        notify();
        for (const [key, remote] of downloaded) {
          const e = meta.entries[key];
          if (e?.pending || e?.conflict) {
            if (etag(e.etag) !== etag(remote?.etag)) {
              const raw = read(slotKey(key));
              if (e.pending && remote && (e.pending.kind === 'delete' ? remote.deleted : !remote.deleted && raw === JSON.stringify(remote.data))) acceptAcknowledgement(key, remote, e.pending);
              else conflict(key, remote);
            }
          } else if (remote) applyRemote(key, remote);
        }
        persist(); remove(SWITCH); transitionOwner = null; switchJournalWritten = false; cleanAccountCache();
        const result = await run(false); notify(); return result;
      } catch (err) {
        if (switchJournalWritten && !identityCommitted) {
          const journal = parse(read(SWITCH));
          if (journal?.owner === writer) remove(SWITCH);
          transitionOwner = null;
          for (const key of archivedKeys) { try { remove(key); } catch { /* The original mirror was never touched. */ } }
        } else if (switchJournalWritten && identityCommitted) {
          // The durable journal now owns recovery. Stop this runtime; a reload
          // finishes the interrupted transfer before allowing any native save.
          code = targetIdentity.code; id = targetIdentity.id; meta = loadMeta(id);
          transitionOwner = null; changedProfile();
        }
        setFailure(err); throw err;
      }
      finally { switching = false; notify(); }
    }
    async function resolve(key, choice) {
      await ready();
      if (!SLOT_SET.has(key) || !['local', 'remote'].includes(choice)) { setFailure(fail('invalid_resolution')); return getState(); }
      if (switching) return getState();
      if (running) await running;
      const e = meta.entries[key]; if (!e?.conflict) return getState();
      status = 'syncing'; error = null; notify();
      try {
        if (choice === 'local') {
          e.etag = etag(e.conflict.etag); e.known = true; e.attempt = null; e.conflict = null;
          e.pending = { id: mutationId(), kind: e.deleted ? 'delete' : 'put' }; persist();
          return await sync({ pull: false });
        }
        const before = { pending: e.pending?.id || null, raw: read(slotKey(key)) };
        const remote = await getRemote(key), current = entryFor(key), raw = read(slotKey(key));
        if ((current.pending?.id || null) !== before.pending || raw !== before.raw) { conflict(key, remote); return getState(); }
        // Explicitly choosing the remote copy still keeps one local recovery copy.
        if (raw !== null) put(recoveryKey(key), JSON.stringify({ savedAt: now(), summary: e.summary, dataJSON: raw }));
        applyRemote(key, remote); status = getState().conflicts.length ? 'conflict' : 'connected';
        meta.lastSynced = now(); persist();
      } catch (err) { setFailure(err); }
      notify(); return getState();
    }
    function acknowledgeRemoteChanges(keys) {
      if (halted) return getState();
      if (keys === undefined) changes.clear();
      else for (const key of Array.isArray(keys) ? keys : [keys]) changes.delete(key);
      notify(); return getState();
    }
    function subscribe(fn) { listeners.add(fn); fn(getState()); return () => listeners.delete(fn); }
    root.addEventListener?.('storage', event => {
      if (id && writer && (event.key === IDENTITY || event.key === SWITCH || event.key === null)) canWriteLocal();
    });
    return Object.freeze({ ready, initialize: ready, getState, stage, stageDelete, sync, connect, resolve, subscribe, acknowledgeRemoteChanges, canWriteLocal, ownsMirror: canWriteLocal });
  }
  return Object.freeze({ version: VERSION, slots: SLOTS, create, validCode: code => CODE_RE.test(String(code || '').trim()) });
});
