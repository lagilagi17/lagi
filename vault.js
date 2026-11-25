// Browser-local convenience storage, not an online identity or strong PIN security system.
// Short PINs/codes can be guessed offline; PBKDF2 only makes each attempt more expensive.
const Vault = (() => {
  'use strict';
  const PREFIX = 'hanq-vault-v1-';
  const CODE_PREFIX = 'hanq-vault-v2-';
  const CODE_INDEX_SALT = 'HanQ browser vault v2: case-sensitive code index';
  const ITERATIONS = 600000;
  const MAX_DATA_BYTES = 24576;
  const MAX_RECORD_CHARS = 40000;
  const sessions = new WeakMap();
  const queues = new Map();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });

  function fail(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }
  function requireCrypto() {
    if (typeof crypto === 'undefined' || !crypto.subtle || !crypto.getRandomValues) {
      throw fail('이 브라우저에서는 암호화 저장을 사용할 수 없어요. 최신 브라우저에서 HTTPS 주소로 열어 주세요.', 'UNAVAILABLE');
    }
  }
  function normalizeId(id) {
    if (typeof id !== 'string') throw fail('저장 ID를 입력해 주세요.', 'ID');
    const value = id.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,24}$/.test(value)) {
      throw fail('저장 ID는 영문, 숫자, 밑줄, 하이픈으로 3~24자 입력해 주세요.', 'ID');
    }
    return value;
  }
  function validatePin(pin) {
    if (typeof pin !== 'string' || !/^[0-9]{4}$/.test(pin)) {
      throw fail('PIN은 숫자 4자리로 입력해 주세요.', 'PIN');
    }
    return pin;
  }
  function validateCode(code) {
    if (typeof code !== 'string' || !/^[A-Za-z0-9]{4}$/.test(code)) {
      throw fail('비밀번호는 영문·숫자 4자리로 입력해 주세요. 대소문자를 구분해요.', 'CODE');
    }
    return code;
  }
  function textField(value, maximum) {
    if (typeof value !== 'string' || value.length > maximum) {
      throw fail('저장할 입력 내용의 형식이나 길이를 확인해 주세요.', 'DATA');
    }
    return value;
  }
  function cleanData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.version !== 1 ||
      !['4.3', '4.5'].includes(data.scale) || !Array.isArray(data.rows) || data.rows.length > 50) {
      throw fail('저장할 과목 목록과 성적 기준을 확인해 주세요.', 'DATA');
    }
    return {
      version: 1,
      scale: data.scale,
      semester: textField(data.semester, 40),
      rows: Array.from(data.rows, row => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
          throw fail('저장할 과목 목록을 확인해 주세요.', 'DATA');
        }
        // Incomplete drafts are allowed. Only these fields are ever persisted.
        return {
          name: textField(row.name, 60),
          credits: textField(row.credits, 16),
          grade: textField(row.grade, 16),
        };
      }),
    };
  }
  function dataBytes(data) {
    const bytes = encoder.encode(JSON.stringify(cleanData(data)));
    if (bytes.length > MAX_DATA_BYTES) throw fail('저장할 내용이 너무 커요. 과목 입력을 줄여 주세요.', 'DATA');
    return bytes;
  }
  function base64(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  function unbase64(value, expectedLength) {
    if (typeof value !== 'string' || value.length > MAX_RECORD_CHARS ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('Invalid encoding');
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    if (base64(bytes) !== value || (expectedLength !== undefined && bytes.length !== expectedLength)) throw new Error('Invalid length');
    return bytes;
  }
  function parseRecord(raw, expectedVersion = 1) {
    try {
      if (typeof raw !== 'string' || raw.length > MAX_RECORD_CHARS) throw new Error('Invalid size');
      const record = JSON.parse(raw);
      if (!record || typeof record !== 'object' || Array.isArray(record) || record.version !== expectedVersion ||
        Object.keys(record).sort().join(',') !== 'cipher,iv,revision,salt,updatedAt,version' ||
        !Number.isSafeInteger(record.revision) || record.revision < 1 || record.revision >= Number.MAX_SAFE_INTEGER ||
        typeof record.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.updatedAt) ||
        !Number.isFinite(Date.parse(record.updatedAt))) throw new Error('Invalid record');
      unbase64(record.salt, 16);
      unbase64(record.iv, 12);
      const cipher = unbase64(record.cipher);
      if (cipher.length < 16 || cipher.length > MAX_DATA_BYTES + 16) throw new Error('Invalid ciphertext');
      return record;
    } catch {
      throw fail('저장 데이터가 손상되었거나 지원하지 않는 형식이에요. 기존 데이터는 변경하지 않았어요.', 'CORRUPT');
    }
  }
  function read(key) {
    try { return localStorage.getItem(key); }
    catch { throw fail('브라우저 저장 공간에 접근할 수 없어요. 사이트 데이터 저장 허용 여부를 확인해 주세요.', 'STORAGE'); }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); }
    catch {
      throw fail('브라우저 저장 공간이 부족하거나 저장이 차단됐어요. 입력 내용은 화면에 남아 있어요.', 'STORAGE');
    }
  }
  async function storageKey(id) {
    requireCrypto();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(normalizeId(id))));
    return PREFIX + Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function codeStorageKey(code) {
    validateCode(code);
    requireCrypto();
    const codeBytes = encoder.encode(code);
    try {
      // A fast hash would expose a cheap code-guessing oracle in the storage key.
      // This separate, deliberately slow KDF does not replace the random-salt KDF
      // used for encryption, and a four-character code is still a convenience lock.
      const material = await crypto.subtle.importKey('raw', codeBytes, 'PBKDF2', false, ['deriveBits']);
      const bits = new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: encoder.encode(CODE_INDEX_SALT) },
        material, 256,
      ));
      return CODE_PREFIX + Array.from(bits, byte => byte.toString(16).padStart(2, '0')).join('');
    } finally { codeBytes.fill(0); }
  }
  async function deriveKey(pin, salt) {
    const pinBytes = encoder.encode(pin);
    try {
      const material = await crypto.subtle.importKey('raw', pinBytes, 'PBKDF2', false, ['deriveKey']);
      return await crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt },
        material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
      );
    } finally { pinBytes.fill(0); }
  }
  function additionalData(key, record) {
    return encoder.encode(JSON.stringify(['hanq-vault', record.version, key, record.salt, record.revision, record.updatedAt]));
  }
  async function encryptedRecord(key, cryptoKey, salt, revision, bytes, version = 1) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const record = { version, salt, iv: base64(iv), cipher: '', revision, updatedAt: new Date().toISOString() };
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: additionalData(key, record), tagLength: 128 }, cryptoKey, bytes,
    );
    record.cipher = base64(new Uint8Array(cipher));
    return record;
  }
  function withLock(key, action) {
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
      return navigator.locks.request(key, { mode: 'exclusive' }, action);
    }
    // Serialize this page when Web Locks are unavailable. The compare-before-write
    // check below detects ordinary stale tabs, but cannot guarantee cross-tab atomicity.
    const previous = queues.get(key) || Promise.resolve();
    const operation = previous.catch(() => {}).then(action);
    queues.set(key, operation);
    return operation.finally(() => { if (queues.get(key) === operation) queues.delete(key); });
  }
  function openSession(key, cryptoKey, raw, version = 1) {
    const session = Object.freeze(Object.create(null));
    sessions.set(session, { key, cryptoKey, raw, version, closed: false });
    return session;
  }
  function sessionState(session) {
    const state = session && typeof session === 'object' ? sessions.get(session) : null;
    if (!state || state.closed || !state.cryptoKey) throw fail('저장함이 잠겼어요. 비밀번호를 입력해 다시 불러와 주세요.', 'LOCKED');
    return state;
  }
  function conflict() {
    return fail('다른 탭에서 저장한 내용이 있거나 저장 데이터가 바뀌었어요. 현재 입력을 확인한 뒤 저장함을 다시 불러와 주세요.', 'CONFLICT');
  }

  async function create(id, pin, data) {
    validatePin(pin);
    const bytes = dataBytes(data);
    try {
      const key = await storageKey(id);
      return await withLock(key, async () => {
        if (read(key) !== null) throw fail('이미 사용 중인 저장 ID예요. 불러오기를 선택하거나 다른 ID를 사용해 주세요.', 'EXISTS');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const cryptoKey = await deriveKey(pin, salt);
        const record = await encryptedRecord(key, cryptoKey, base64(salt), 1, bytes);
        if (read(key) !== null) throw fail('이미 사용 중인 저장 ID예요. 다른 ID를 사용해 주세요.', 'EXISTS');
        const raw = JSON.stringify(record);
        write(key, raw);
        return { session: openSession(key, cryptoKey, raw), updatedAt: record.updatedAt };
      });
    } finally { bytes.fill(0); }
  }
  async function unlock(id, pin) {
    validatePin(pin);
    const key = await storageKey(id);
    return unlockRecord(key, pin, 1, '이 브라우저에 해당 ID로 저장한 내용이 없어요. ID를 확인해 주세요.');
  }
  async function unlockRecord(key, secret, version, notFoundMessage) {
    return withLock(key, async () => {
      const raw = read(key);
      if (raw === null) throw fail(notFoundMessage, 'NOT_FOUND');
      const record = parseRecord(raw, version);
      const cryptoKey = await deriveKey(secret, unbase64(record.salt, 16));
      let plaintext;
      try {
        plaintext = new Uint8Array(await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: unbase64(record.iv, 12), additionalData: additionalData(key, record), tagLength: 128 },
          cryptoKey, unbase64(record.cipher),
        ));
      } catch {
        throw fail('비밀번호가 맞지 않거나 저장 데이터가 손상됐어요. 기존 데이터는 변경하지 않았어요.', 'UNLOCK');
      }
      try {
        let data;
        try { data = cleanData(JSON.parse(decoder.decode(plaintext))); }
        catch { throw fail('저장 데이터의 내용을 읽을 수 없어요. 기존 데이터는 변경하지 않았어요.', 'CORRUPT'); }
        if (read(key) !== raw) throw conflict();
        return { session: openSession(key, cryptoKey, raw, version), data, updatedAt: record.updatedAt };
      } finally { plaintext.fill(0); }
    });
  }
  async function createCode(code, data) {
    validateCode(code);
    const bytes = dataBytes(data);
    try {
      const key = await codeStorageKey(code);
      return await withLock(key, async () => {
        if (read(key) !== null) throw fail('이 비밀번호로 저장된 내용이 있어요. 먼저 불러오거나 다른 비밀번호를 사용해 주세요.', 'EXISTS');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const cryptoKey = await deriveKey(code, salt);
        const record = await encryptedRecord(key, cryptoKey, base64(salt), 1, bytes, 2);
        if (read(key) !== null) throw fail('이 비밀번호로 저장된 내용이 있어요. 먼저 불러와 주세요.', 'EXISTS');
        const raw = JSON.stringify(record);
        write(key, raw);
        return { session: openSession(key, cryptoKey, raw, 2), updatedAt: record.updatedAt };
      });
    } finally { bytes.fill(0); }
  }
  async function unlockCode(code) {
    const key = await codeStorageKey(code);
    return unlockRecord(key, code, 2, '이 브라우저에 이 비밀번호로 저장한 내용이 없어요. 대소문자를 포함해 확인해 주세요.');
  }
  async function save(session, data) {
    const state = sessionState(session);
    const bytes = dataBytes(data);
    try {
      return await withLock(state.key, async () => {
        sessionState(session);
        if (read(state.key) !== state.raw) throw conflict();
        const previous = parseRecord(state.raw, state.version);
        const record = await encryptedRecord(state.key, state.cryptoKey, previous.salt, previous.revision + 1, bytes, state.version);
        sessionState(session);
        if (read(state.key) !== state.raw) throw conflict();
        const raw = JSON.stringify(record);
        write(state.key, raw);
        state.raw = raw;
        return { updatedAt: record.updatedAt };
      });
    } finally { bytes.fill(0); }
  }
  function close(session) {
    if (!session || typeof session !== 'object') return;
    const state = sessions.get(session);
    if (state) { state.closed = true; state.cryptoKey = null; state.raw = ''; sessions.delete(session); }
  }
  async function exists(id) { return read(await storageKey(id)) !== null; }
  function hasLegacyRecords() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        if (/^hanq-vault-v1-[a-f0-9]{64}$/.test(localStorage.key(i) || '')) return true;
      }
    } catch { /* The recovery link is optional; actual unlock reports storage errors. */ }
    return false;
  }

  function safe(action) {
    return async (...args) => {
      try { return await action(...args); }
      catch (error) {
        if (error && ['UNAVAILABLE', 'ID', 'PIN', 'CODE', 'DATA', 'CORRUPT', 'STORAGE', 'LOCKED', 'CONFLICT', 'EXISTS', 'NOT_FOUND', 'UNLOCK'].includes(error.code)) throw error;
        throw fail('암호화 저장을 처리하지 못했어요. 입력 내용은 유지한 채 다시 시도해 주세요.', 'CRYPTO');
      }
    };
  }

  return Object.freeze({ create: safe(create), unlock: safe(unlock), createCode: safe(createCode), unlockCode: safe(unlockCode), save: safe(save), close, exists: safe(exists), hasLegacyRecords });
})();
