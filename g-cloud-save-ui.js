'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HanQCloudSaveUI = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const STATUS = {
    idle: '기기에 저장', initializing: '서버 기록 확인 중', syncing: '서버에 저장 중',
    offline: '기기 저장됨 · 연결되면 재시도', unconfigured: '기기 저장됨 · 서버 연결 준비 중',
    conflict: '다른 기기의 기록과 충돌', switching: '다른 기기 기록 연결 중', error: '기기 기록 유지 · 동기화 확인 필요',
  };
  const ERROR = {
    invalid_code: '저장 코드를 다시 확인해 주세요.', profile_not_found: '해당 코드의 서버 기록을 찾지 못했어요.',
    local_storage_full: '기기 저장 공간이 부족해요. 공간을 확보한 뒤 다시 동기화해 주세요.', local_storage_unavailable: '기기 저장 공간에 접근할 수 없어요.',
    timeout: '서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.', offline: '서버에 연결하지 못했어요. 기기 기록은 유지돼요.',
    save_too_large: '이 기록은 서버 저장 크기를 넘었어요. 기기 기록은 유지돼요.',
    too_large: '이 기록은 서버 저장 크기를 넘었어요. 기기 기록은 유지돼요.', compressed_too_large: '이 기록은 서버 저장 크기를 넘었어요. 기기 기록은 유지돼요.',
    unconfigured: '서버 저장소 연결이 준비되면 다시 동기화해 주세요.', invalid_save: '이 저장 형식을 읽지 못했어요. 기기 기록은 유지돼요.',
    not_ready: '서버 기록 확인이 끝나면 다시 시도해 주세요.', network_error: '서버에 연결하지 못했어요. 기기 기록은 유지돼요.',
    server_error: '서버가 응답하지 못했어요. 잠시 후 다시 동기화해 주세요.',
    profile_changed: '다른 탭에서 게임을 열었어요. 이어 하려면 이 탭을 새로고침해 주세요.',
    authentication_failed: '저장 코드로 연결하지 못했어요. 코드를 다시 확인해 주세요.',
    CODE: '저장 코드를 다시 확인해 주세요.', NOT_FOUND: '해당 코드의 서버 기록을 찾지 못했어요.',
    PROFILE_NOT_FOUND: '해당 코드의 서버 기록을 찾지 못했어요.', STORAGE: '기기 저장 공간이 부족해 연결을 바꾸지 않았어요.',
    OFFLINE: '서버에 연결하지 못했어요. 기기 기록은 유지돼요.', TIMEOUT: '서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.',
    UNCONFIGURED: '서버 저장소 연결이 준비되면 다시 동기화해 주세요.', TOO_LARGE: '이 기록은 서버 저장 크기를 넘었어요. 기기 기록은 유지돼요.',
  };
  function install(options) {
    const doc = options.document || (typeof document !== 'undefined' ? document : null);
    if (!doc || !options.client) return null;
    const client = options.client, views = [];
    let busy = false, message = '', reveal = false;
    const el = (tag, cls, text) => { const e = doc.createElement(tag); e.className = cls || ''; if (text !== undefined) e.textContent = text; return e; };
    const button = (text, cls = '') => { const e = el('button', 'button ov-ghost ' + cls, text); e.type = 'button'; return e; };
    const date = value => value ? new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    const title = key => options.slotName ? options.slotName(key) : key;
    const summary = (m, deleted) => deleted ? '삭제한 기록' : m ? [m.text || m.mode || '저장된 게임', date(m.at)].filter(Boolean).join(' · ') : '저장 없음';
    const protection = () => options.getProtection?.() || {};
    function closeAll() {
      for (const view of views) { view.box.hidden = true; view.panel.classList.remove('ov-cloud-open'); }
    }
    function open(panel) {
      options.onOpen?.();
      closeAll();
      const view = views.find(v => v.panel === panel) || views.find(v => !v.panel.hidden) || views[0];
      if (!view) return;
      view.box.hidden = false; view.panel.classList.add('ov-cloud-open'); render();
      view.heading.focus?.({ preventScroll: true });
    }
    async function run(action, success) {
      if (busy) return;
      busy = true; message = ''; render();
      try {
        const result = await action();
        const state = client.getState();
        if (state.status === 'offline' || state.status === 'error' || state.status === 'unconfigured') message = ERROR[state.error] || STATUS[state.status];
        else if (success) message = success;
        return result;
      } catch (error) { message = ERROR[error?.code] || '처리하지 못했어요. 기존 기록은 유지돼요.'; }
      finally { busy = false; render(); }
    }
    function render() {
      const state = client.getState(), guard = protection(), changedProfile = guard.reason === 'profile_changed';
      let stateText = STATUS[state.status] || '기기에 저장';
      if (state.status === 'connected') stateText = state.pending ? '기기 저장됨 · 서버 전송 대기' : state.lastSynced ? '서버 저장 완료 · ' + date(state.lastSynced) : '서버 연결됨';
      for (const v of views) {
        v.status.textContent = stateText; v.status.dataset.state = state.status;
        v.short.textContent = changedProfile ? '다른 탭에서 열림 · 새로고침 필요' : guard.reason ? '불러올 기록을 선택해 주세요' : stateText;
        v.code.value = state.code || ''; v.code.hidden = !reveal;
        v.copy.disabled = busy || !state.code; v.sync.disabled = busy || changedProfile || state.status === 'initializing' || state.status === 'switching';
        v.connect.disabled = busy || changedProfile; v.enter.disabled = busy || changedProfile; v.codeInput.disabled = busy || changedProfile;
        v.note.textContent = message || ERROR[state.error] || (state.status === 'unconfigured' ? '게임은 계속할 수 있어요. 서버 연결 전에는 이 기기에만 저장돼요.' : '같은 저장 코드를 연결한 기기에서 이어서 할 수 있어요.');
        v.protection.hidden = !guard.reason && !guard.canRecover;
        v.guardText.textContent = !guard.reason ? '보관한 이 기기 진행: ' + summary(guard.recoverySummary) : changedProfile ? '다른 탭에서 게임을 열었어요. 이 탭의 진행을 보관하고 새로고침해 주세요.' : guard.reason === 'restore' ? '저장을 읽지 못해 자동 저장을 멈췄어요. 다른 저장을 불러오거나 새 게임을 선택해 주세요.' : guard.reason === 'switch' ? '기록 연결을 바꿨어요. 이어서 할 서버 저장을 불러와 주세요.' : '다른 기기의 기록이 도착했어요. 이어서 할 진행을 선택해 주세요.';
        v.load.hidden = !guard.reason || !guard.canLoad; v.recover.hidden = !guard.canRecover;
        v.newGame.hidden = !guard.reason || changedProfile || (guard.reason !== 'restore' && (guard.canLoad || guard.reason === 'remote'));
        v.reload.hidden = !changedProfile; v.reload.disabled = busy;
        v.load.disabled = v.recover.disabled = v.newGame.disabled = busy;
        v.conflicts.textContent = '';
        for (const conflict of state.conflicts || []) {
          const row = el('section', 'ov-cloud-conflict');
          row.append(el('b', '', title(conflict.key)), el('p', '', '이 기기: ' + summary(conflict.localSummary, conflict.localDeleted)), el('p', '', '서버: ' + summary(conflict.remoteSummary, conflict.remoteDeleted ?? conflict.deleted)));
          const choices = el('div', 'ov-cloud-row');
          const local = button('이 기기 기록 사용'), remote = button('서버 기록 사용');
          local.disabled = remote.disabled = busy || changedProfile;
          local.addEventListener('click', () => run(() => options.onResolve(conflict.key, 'local')));
          remote.addEventListener('click', () => run(() => options.onResolve(conflict.key, 'remote')));
          choices.append(local, remote); row.append(choices); v.conflicts.append(row);
        }
        v.conflicts.hidden = !(state.conflicts || []).length;
      }
    }
    for (const panel of options.panels || []) {
      const launch = button('서버 저장 · 기기 연결', 'ov-cloud-launch');
      const short = el('small', 'ov-cloud-short'); short.setAttribute('aria-live', 'polite');
      const trigger = el('div', 'ov-cloud-trigger'); trigger.append(launch, short); panel.append(trigger);
      const box = el('section', 'ov-cloud-box'); box.hidden = true; box.setAttribute('aria-label', '게임 서버 저장');
      const heading = el('h3', 'ov-cloud-heading', '서버 저장'); heading.tabIndex = -1;
      const status = el('p', 'ov-cloud-status'); status.setAttribute('role', 'status');
      const sync = button('지금 동기화'), copy = button('저장 코드 복사');
      const top = el('div', 'ov-cloud-row'); top.append(sync, copy);
      const code = el('input', 'ov-cloud-code'); code.readOnly = true; code.hidden = true; code.setAttribute('aria-label', '이 게임의 저장 코드'); code.autocomplete = 'off'; code.spellcheck = false;
      const note = el('p', 'ov-cloud-note'); note.setAttribute('aria-live', 'polite');
      const codeNote = el('p', 'ov-cloud-note', '이 코드를 가진 기기는 저장을 불러오고 바꿀 수 있어요. 본인만 보관해 주세요.');
      const connect = button('다른 기기 기록 연결');
      const connection = el('div', 'ov-cloud-connection'); connection.hidden = true;
      const label = el('label', '', '다른 기기의 저장 코드');
      const codeInput = el('input', 'ov-cloud-code-input'); codeInput.type = 'text'; codeInput.autocomplete = 'off'; codeInput.autocapitalize = 'off'; codeInput.spellcheck = false; codeInput.placeholder = 'hq1_…'; codeInput.maxLength = 100; codeInput.setAttribute('aria-label', '다른 기기의 저장 코드'); label.append(codeInput);
      const enter = button('이 코드로 연결'), cancel = button('취소'); const connectRow = el('div', 'ov-cloud-row'); connectRow.append(enter, cancel); connection.append(label, connectRow);
      const conflicts = el('div', 'ov-cloud-conflicts');
      const guardBox = el('div', 'ov-cloud-protection'); guardBox.hidden = true;
      const guardText = el('p', 'ov-cloud-note');
      const load = button('서버 기록 불러오기'), recover = button('보관한 이 기기 진행 불러오기'), newGame = button('새 게임 시작');
      const reload = button('진행 보관 후 새로고침');
      guardBox.append(guardText, load, recover, newGame, reload);
      const close = button('닫기');
      box.append(heading, status, top, code, note, codeNote, connect, connection, conflicts, guardBox, close); panel.append(box);
      const view = { panel, box, launch, short, heading, status, sync, copy, code, note, connect, connection, codeInput, enter, conflicts, protection: guardBox, guardText, load, recover, newGame, reload };
      views.push(view);
      launch.addEventListener('click', () => open(panel)); close.addEventListener('click', () => { closeAll(); launch.focus?.({ preventScroll: true }); });
      sync.addEventListener('click', () => run(() => options.onSync()));
      copy.addEventListener('click', async () => {
        const token = client.getState().code; if (!token) return;
        try { if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('clipboard'); await navigator.clipboard.writeText(token); message = '복사했어요. 다른 기기의 이 메뉴에서 연결해 주세요.'; }
        catch { reveal = true; message = '아래 저장 코드를 선택해서 복사해 주세요.'; }
        render(); if (reveal) { code.focus?.(); code.select?.(); }
      });
      connect.addEventListener('click', () => { connection.hidden = !connection.hidden; if (!connection.hidden) codeInput.focus?.({ preventScroll: true }); });
      cancel.addEventListener('click', () => { connection.hidden = true; codeInput.value = ''; });
      enter.addEventListener('click', () => run(async () => { await options.onConnect(codeInput.value.trim()); connection.hidden = true; codeInput.value = ''; }, '연결했어요. 서버 기록을 불러와 이어서 할 수 있어요.'));
      codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); enter.click(); } });
      load.addEventListener('click', () => { if (options.onLoad()) closeAll(); else { message = '이 모드에서 불러올 기록이 없어요. 불러오기 목록을 확인해 주세요.'; render(); } });
      recover.addEventListener('click', () => { if (options.onRecover()) closeAll(); else { message = '보관된 진행을 불러오지 못했어요.'; render(); } });
      newGame.addEventListener('click', () => { if (options.onNewGame()) closeAll(); });
      reload.addEventListener('click', () => options.onReload?.());
      box.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeAll(); } });
    }
    render();
    return { open, closeAll, render, setMessage(text) { message = String(text || ''); render(); } };
  }
  return Object.freeze({ install });
});
