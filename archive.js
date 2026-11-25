'use strict';
// 아카이브 — semester / subject file archive.
// Files live in the R2 bucket behind /api/archive (see _worker.js). A file's key is
// "<학기>/<과목>/<파일명>", e.g. "2026-2/선형대수학/정리노트.pdf", so files uploaded
// into those folders in the Cloudflare dashboard show up here automatically.
(() => {
  // [이수구분, 일반/전문, 교과, 교과명, 학점] — copied from the school record pages
  const SEMESTERS = [
    { id: '2026-2', year: '2026', term: '2학기', subjects: [
      ['필수', '일반', '국어', '논리적글쓰기', 2], ['필수', '일반', '외국어', '심화영어', 2], ['필수', '일반', '사회', '한국사I', 3],
      ['필수', '일반', '예체능', '체육IV', 1], ['필수', '전문', '수학', '수학IV', 4], ['선택', '일반', '예체능', '음악II', 1],
      ['선택', '전문', '수학', '선형대수학', 3], ['선택', '전문', '과학', '일반물리학', 3], ['선택', '전문', '과학', '일반생명과학', 3],
      ['선택', '전문', '정보과학', '인공지능', 3],
    ] },
    { id: '2026-1', year: '2026', term: '1학기', subjects: [
      ['필수', '일반', '국어', '문학감상과비평', 3], ['필수', '일반', '외국어', '영어회화', 3], ['필수', '일반', '사회', '글로벌경제의이해', 2],
      ['필수', '일반', '예체능', '체육III', 1], ['필수', '전문', '수학', '수학III', 4], ['필수', '전문', '과학', '기초화학및실험III', 2],
      ['필수', '전문', '과학', '기초지구과학및실험III', 2], ['필수', '전문', '과학', '기초물리학및실험III', 2], ['필수', '전문', '과학', '기초생명과학및실험III', 2],
      ['필수', '전문', '정보과학', '컴퓨터프로그래밍', 3], ['선택', '일반', '제2외국어', '일본어', 2],
    ] },
    { id: '2025-2', year: '2025', term: '2학기', subjects: [
      ['필수', '일반', '국어', '국어II', 2], ['필수', '일반', '외국어', '영어II', 3], ['필수', '일반', '사회', '현대사회와법', 2],
      ['필수', '일반', '예체능', '미술I', 2], ['필수', '일반', '예체능', '체육II', 1], ['필수', '전문', '수학', '수학II', 4],
      ['필수', '전문', '과학', '기초생명과학및실험II', 3], ['필수', '전문', '과학', '기초화학및실험II', 3], ['필수', '전문', '과학', '기초지구과학및실험II', 3],
      ['필수', '전문', '과학', '기초물리학및실험II', 3], ['필수', '전문', '정보과학', '정보과학II', 2],
    ] },
    { id: '2025-1', year: '2025', term: '1학기', subjects: [
      ['필수', '일반', '국어', '국어I', 3], ['필수', '일반', '외국어', '영어I', 2], ['필수', '일반', '사회', '사회', 2],
      ['필수', '일반', '예체능', '체육I', 1], ['필수', '일반', '예체능', '음악I', 2], ['필수', '전문', '수학', '수학I', 4],
      ['필수', '전문', '과학', '기초화학및실험I', 3], ['필수', '전문', '과학', '기초생명과학및실험I', 3], ['필수', '전문', '과학', '기초지구과학및실험I', 3],
      ['필수', '전문', '과학', '기초물리학및실험I', 3], ['필수', '전문', '정보과학', '정보과학I', 2],
    ] },
  ];
  const GROUP_CLASS = { 국어: 'g-kor', 외국어: 'g-eng', 사회: 'g-soc', 예체능: 'g-art', 수학: 'g-math', 과학: 'g-sci', 정보과학: 'g-info', 제2외국어: 'g-lang' };
  const OTHER = '기타';
  const FREE_BYTES = 10 * 1024 ** 3;
  const MAX_UPLOAD = 95 * 1024 * 1024;
  const KEY_STORE = 'hanq-archive-key';
  const SEM_STORE = 'hanq-archive-sem';

  const store = {
    get(k, s = sessionStorage) { try { return s.getItem(k); } catch { return null; } },
    set(k, v, s = sessionStorage) { try { s.setItem(k, v); } catch { /* optional */ } },
    del(k, s = sessionStorage) { try { s.removeItem(k); } catch { /* optional */ } },
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const svg = (paths, size = 18) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    for (const d of paths) { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); }
    return s;
  };
  const ICON = {
    download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
    open: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
    trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
    back: ['M15 5l-7 7 7 7'],
    upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M5 20h14'],
    search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
    refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 5v6h-6'],
    key: ['M14 10a4 4 0 1 0-3.5 3.97', 'M12.5 12.5L20 20', 'M17 17l2-2'],
    folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  };

  const fmtSize = n => (n < 1024 ? `${n}B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)}KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)}MB` : `${(n / 1024 ** 3).toFixed(2)}GB`);
  const fmtDate = iso => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
  const extOf = name => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i + 1).toLowerCase() : ''; };
  const KIND = [
    [['pdf'], 'k-pdf'], [['ipynb', 'py', 'c', 'cpp', 'h', 'java', 'js', 'ts', 'r', 'm'], 'k-code'], [['zip', '7z', 'rar', 'gz', 'tar'], 'k-zip'],
    [['csv', 'xlsx', 'xls', 'tsv', 'sqlite', 'db', 'json'], 'k-data'], [['hwp', 'hwpx', 'doc', 'docx', 'txt', 'md'], 'k-doc'],
    [['ppt', 'pptx', 'key'], 'k-slide'], [['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'], 'k-img'], [['mp4', 'mov', 'mp3', 'm4a', 'wav'], 'k-media'], [['html', 'htm'], 'k-web'],
  ];
  const kindOf = ext => { for (const [exts, cls] of KIND) if (exts.includes(ext)) return cls; return 'k-etc'; };
  const viewable = ext => ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  const fileUrl = key => '/api/archive/f/' + key.split('/').map(encodeURIComponent).join('/');
  const cleanName = name => name.replace(/[\u0000-\u001f/\\]/g, '_').replace(/\s+/g, ' ').trim().slice(-180) || 'file';
  const semLabel = sem => `${sem.year}학년도 ${sem.term}`;

  function init() {
    const root = document.getElementById('archive');
    if (!root) return;
    const state = { loaded: false, loading: false, configured: null, uploads: false, files: [], sem: store.get(SEM_STORE, localStorage) || SEMESTERS[0].id, subject: null, query: '', admin: store.get(KEY_STORE), error: null };

    // ---------- static skeleton ----------
    const head = el('div', 'ar-head');
    const titles = el('div', 'ar-titles');
    titles.append(el('p', 'ar-kicker', '학기별 자료실'), el('h2', 'ar-title', '아카이브'));
    const summary = el('p', 'ar-summary', '불러오는 중…');
    const usage = el('div', 'ar-usage'); const usageBar = el('i'); usage.append(usageBar);
    titles.append(summary, usage);
    const tools = el('div', 'ar-tools');
    const searchWrap = el('label', 'ar-search');
    const search = el('input'); search.type = 'search'; search.placeholder = '파일 이름 검색'; search.setAttribute('aria-label', '파일 이름 검색');
    searchWrap.append(svg(ICON.search, 16), search);
    const refreshBtn = el('button', 'ar-icon-btn'); refreshBtn.type = 'button'; refreshBtn.title = '새로고침'; refreshBtn.setAttribute('aria-label', '새로고침'); refreshBtn.append(svg(ICON.refresh, 17));
    const adminBtn = el('button', 'ar-admin-btn'); adminBtn.type = 'button';
    tools.append(searchWrap, refreshBtn, adminBtn);
    head.append(titles, tools);
    const adminBox = el('form', 'ar-login'); adminBox.hidden = true; adminBox.noValidate = true;
    const notice = el('div', 'ar-notice'); notice.hidden = true;
    const semBar = el('div', 'ar-sems'); semBar.setAttribute('role', 'tablist'); semBar.setAttribute('aria-label', '학기');
    const body = el('div', 'ar-body');
    root.append(head, adminBox, notice, semBar, body);

    // ---------- data ----------
    function filesFor(semId, subject) {
      const sem = SEMESTERS.find(s => s.id === semId);
      const known = sem ? new Set(sem.subjects.map(x => x[3])) : new Set();
      return state.files.filter(f => f.sem === semId && (subject === OTHER ? !known.has(f.subject) : f.subject === subject));
    }
    async function load() {
      if (state.loading) return;
      state.loading = true; state.error = null;
      summary.textContent = '불러오는 중…';
      refreshBtn.classList.add('spin');
      try {
        const res = await fetch('/api/archive/list', { cache: 'no-store' });
        const data = await res.json();
        state.configured = !!data.configured;
        state.uploads = !!data.uploads;
        state.files = (data.files || []).map(f => {
          const parts = f.k.split('/');
          return { key: f.k, size: f.s, time: f.t, sem: parts[0], subject: parts.length > 2 ? parts[1] : OTHER, name: parts[parts.length - 1] };
        }).filter(f => f.name);
      } catch {
        state.error = '목록을 불러오지 못했어요. 잠시 후 새로고침해 주세요.';
      }
      state.loaded = true; state.loading = false;
      refreshBtn.classList.remove('spin');
      render();
    }
    async function api(method, key, bodyData, onProgress) {
      if (method === 'PUT') {
        // XHR for upload progress
        return new Promise(resolve => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', fileUrl(key));
          xhr.setRequestHeader('X-Archive-Key', state.admin || '');
          xhr.setRequestHeader('Content-Type', bodyData.type || 'application/octet-stream');
          xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
          xhr.onload = () => resolve(xhr.status);
          xhr.onerror = () => resolve(0);
          xhr.send(bodyData);
        });
      }
      try { const res = await fetch(fileUrl(key), { method, headers: { 'X-Archive-Key': state.admin || '' } }); return res.status; } catch { return 0; }
    }

    // ---------- admin (upload key) ----------
    function renderAdminBtn() {
      adminBtn.textContent = '';
      adminBtn.append(svg(ICON.key, 15), document.createTextNode(state.admin ? '관리 모드 끄기' : '관리자'));
      adminBtn.classList.toggle('on', !!state.admin);
    }
    adminBtn.addEventListener('click', () => {
      if (state.admin) { state.admin = null; store.del(KEY_STORE); renderAdminBtn(); render(); return; }
      adminBox.hidden = !adminBox.hidden;
      if (!adminBox.hidden) adminBox.querySelector('input').focus();
    });
    (() => {
      const label = el('label', 'ar-login-label', '업로드 비밀키');
      const input = el('input'); input.type = 'password'; input.autocomplete = 'off'; input.placeholder = 'Cloudflare에 저장한 ARCHIVE_KEY'; input.id = 'ar-key';
      label.htmlFor = 'ar-key';
      const ok = el('button', 'ar-btn ar-btn-primary', '확인'); ok.type = 'submit';
      const msg = el('p', 'ar-login-msg');
      adminBox.append(label, input, ok, msg);
      adminBox.addEventListener('submit', async e => {
        e.preventDefault();
        const key = input.value.trim();
        if (!key) { msg.textContent = '비밀키를 입력해 주세요.'; return; }
        ok.disabled = true; msg.textContent = '확인 중…';
        let status = 0;
        try { status = (await fetch('/api/archive/login', { method: 'POST', headers: { 'X-Archive-Key': key } })).status; } catch { /* offline */ }
        ok.disabled = false;
        if (status === 200) { state.admin = key; store.set(KEY_STORE, key); input.value = ''; msg.textContent = ''; adminBox.hidden = true; renderAdminBtn(); render(); }
        else msg.textContent = status === 403 ? '비밀키가 맞지 않아요.' : status === 503 ? '서버에 ARCHIVE_KEY가 아직 설정되지 않았어요.' : '확인하지 못했어요. 잠시 후 다시 시도해 주세요.';
      });
    })();
    document.addEventListener('hanq:lock', () => { state.admin = null; store.del(KEY_STORE); renderAdminBtn(); });

    // ---------- rendering ----------
    function renderSems() {
      semBar.textContent = '';
      for (const sem of SEMESTERS) {
        const b = el('button', 'ar-sem'); b.type = 'button'; b.setAttribute('role', 'tab');
        const n = state.files.filter(f => f.sem === sem.id).length;
        const on = sem.id === state.sem && !state.query;
        b.setAttribute('aria-selected', String(on));
        b.classList.toggle('on', on);
        const t = el('span', 'ar-sem-t'); t.append(el('b', '', sem.year), document.createTextNode(` ${sem.term}`));
        b.append(t, el('small', '', n ? `${n}개` : '비어 있음'));
        b.addEventListener('click', () => { state.sem = sem.id; state.subject = null; state.query = ''; search.value = ''; store.set(SEM_STORE, sem.id, localStorage); render(); });
        semBar.append(b);
      }
    }
    function renderSummary() {
      const total = state.files.reduce((a, f) => a + f.size, 0);
      if (state.error) summary.textContent = state.error;
      else if (!state.loaded) summary.textContent = '불러오는 중…';
      else if (!state.configured) summary.textContent = '파일 저장소 연결 대기 중';
      else summary.textContent = `파일 ${state.files.length.toLocaleString('ko-KR')}개 · ${fmtSize(total)} 사용 (무료 10GB)`;
      usage.hidden = !state.configured;
      usageBar.style.width = `${Math.min(100, Math.max(total ? 0.6 : 0, (total / FREE_BYTES) * 100))}%`;
      usage.classList.toggle('warn', total > FREE_BYTES * 0.85);
    }
    function renderNotice() {
      notice.textContent = '';
      notice.hidden = !(state.loaded && !state.error && !state.configured);
      if (notice.hidden) return;
      notice.append(el('b', '', '파일 저장소(Cloudflare R2)가 아직 연결되지 않았어요'));
      const ol = el('ol');
      for (const t of [
        'Cloudflare 대시보드 → R2 → 버킷 만들기 (이름 예: hanq-files)',
        'Workers & Pages → gshanq.com 프로젝트 → 설정 → 바인딩 → R2 버킷 추가: 변수 이름 FILES',
        '같은 설정 → 변수 및 비밀 → 비밀(Secret) 추가: 이름 ARCHIVE_KEY, 값은 길고 어려운 비밀번호 (사이트에서 올릴 때 사용)',
        '저장 후 다시 배포되면 이 화면에 파일이 나타나요',
      ]) ol.append(el('li', '', t));
      notice.append(ol, el('p', '', '대시보드에서 직접 올릴 때는 버킷 안에 "2026-2/선형대수학/" 처럼 학기/과목 폴더를 만들어 넣으면 돼요.'));
    }
    function subjectCard(sem, s) {
      const [req, kind, group, name, credit] = s;
      const files = filesFor(sem.id, name);
      const size = files.reduce((a, f) => a + f.size, 0);
      const card = el('button', `ar-card ${GROUP_CLASS[group] || 'g-etc'}`); card.type = 'button';
      const top = el('span', 'ar-card-top');
      top.append(el('span', 'ar-chip', group), el('span', 'ar-tags', `${req} · ${kind}`));
      const count = el('span', `ar-count${files.length ? '' : ' empty'}`, files.length ? `${files.length}개 · ${fmtSize(size)}` : '비어 있음');
      const foot = el('span', 'ar-card-foot');
      foot.append(el('span', 'ar-credit', credit ? `${credit}학점` : ''), count);
      card.append(top, el('b', 'ar-card-name', name), foot);
      card.addEventListener('click', () => { state.subject = name; render(); window.scrollTo({ top: Math.max(0, root.offsetTop - 70), behavior: 'smooth' }); });
      return card;
    }
    function fileRow(f, showPath) {
      const row = el('li', 'ar-file');
      const ext = extOf(f.name);
      const badge = el('span', `ar-ext ${kindOf(ext)}`, (ext || 'file').slice(0, 5).toUpperCase());
      const info = el('div', 'ar-file-info');
      const nameEl = el('a', 'ar-file-name', f.name); nameEl.href = viewable(ext) ? `${fileUrl(f.key)}?view=1` : fileUrl(f.key);
      if (viewable(ext)) { nameEl.target = '_blank'; nameEl.rel = 'noopener'; }
      const meta = el('span', 'ar-file-meta', [fmtSize(f.size), fmtDate(f.time), showPath ? `${f.sem} · ${f.subject}` : ''].filter(Boolean).join(' · '));
      info.append(nameEl, meta);
      const acts = el('div', 'ar-file-acts');
      if (viewable(ext)) {
        const open = el('a', 'ar-act'); open.href = `${fileUrl(f.key)}?view=1`; open.target = '_blank'; open.rel = 'noopener'; open.title = '열기'; open.setAttribute('aria-label', `${f.name} 열기`);
        open.append(svg(ICON.open, 16)); acts.append(open);
      }
      const dl = el('a', 'ar-act ar-act-main'); dl.href = fileUrl(f.key); dl.setAttribute('download', f.name); dl.title = '다운로드'; dl.setAttribute('aria-label', `${f.name} 다운로드`);
      dl.append(svg(ICON.download, 16), el('span', '', '받기')); acts.append(dl);
      if (state.admin) {
        const del = el('button', 'ar-act ar-act-del'); del.type = 'button'; del.title = '삭제'; del.setAttribute('aria-label', `${f.name} 삭제`);
        del.append(svg(ICON.trash, 16));
        del.addEventListener('click', async () => {
          if (!window.confirm(`"${f.name}" 파일을 삭제할까요? 되돌릴 수 없어요.`)) return;
          del.disabled = true;
          const st = await api('DELETE', f.key);
          if (st === 200) { state.files = state.files.filter(x => x.key !== f.key); render(); }
          else { del.disabled = false; if (st === 403) adminExpired(); else window.alert('삭제하지 못했어요.'); }
        });
        acts.append(del);
      }
      row.append(badge, info, acts);
      return row;
    }
    function adminExpired() { state.admin = null; store.del(KEY_STORE); renderAdminBtn(); render(); window.alert('업로드 비밀키가 맞지 않아요. 관리자 버튼으로 다시 입력해 주세요.'); }
    function uploadZone(sem, subject) {
      const zone = el('div', 'ar-drop');
      const input = el('input'); input.type = 'file'; input.multiple = true; input.hidden = true;
      const pick = el('button', 'ar-btn ar-btn-primary'); pick.type = 'button'; pick.append(svg(ICON.upload, 16), document.createTextNode('파일 올리기'));
      const hint = el('p', 'ar-drop-hint', '여기로 끌어다 놓아도 돼요 · 여러 개 가능 · 파일당 95MB까지');
      const path = el('p', 'ar-drop-path'); path.append(svg(ICON.folder, 14), document.createTextNode(` 대시보드 경로: ${sem}/${subject}/`));
      const list = el('ul', 'ar-queue');
      zone.append(pick, hint, path, list, input);
      pick.addEventListener('click', () => input.click());
      input.addEventListener('change', () => { queue(Array.from(input.files)); input.value = ''; });
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('over'));
      zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); queue(Array.from(e.dataTransfer.files || [])); });
      async function queue(files) {
        let changed = false;
        for (const file of files) {
          const name = cleanName(file.name);
          const key = `${sem}/${subject}/${name}`;
          const item = el('li', 'ar-q'); const bar = el('i'); const label = el('span', '', name); const st = el('em', '', '대기');
          item.append(label, st, bar); list.append(item);
          if (file.size > MAX_UPLOAD) { st.textContent = '95MB 초과 — 대시보드에서 올려 주세요'; item.classList.add('bad'); continue; }
          if (!file.size) { st.textContent = '빈 파일'; item.classList.add('bad'); continue; }
          if (state.files.some(f => f.key === key) && !window.confirm(`"${name}" 파일이 이미 있어요. 덮어쓸까요?`)) { st.textContent = '건너뜀'; item.classList.add('bad'); continue; }
          st.textContent = '0%';
          const code = await api('PUT', key, file, k => { bar.style.width = `${Math.round(k * 100)}%`; st.textContent = `${Math.round(k * 100)}%`; });
          if (code === 201) {
            st.textContent = '완료'; item.classList.add('ok'); bar.style.width = '100%';
            state.files = state.files.filter(f => f.key !== key);
            state.files.push({ key, size: file.size, time: new Date().toISOString(), sem, subject, name });
            changed = true;
          } else {
            item.classList.add('bad');
            st.textContent = code === 403 ? '비밀키 오류' : code === 413 ? '파일이 너무 커요' : '실패';
            if (code === 403) { adminExpired(); return; }
          }
        }
        if (changed) { renderFilesOnly(); renderSems(); renderSummary(); }
      }
      return zone;
    }
    let filesBox = null;
    function renderFilesOnly() {
      if (!filesBox || !state.subject) return;
      const files = filesFor(state.sem, state.subject).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
      filesBox.textContent = '';
      if (!files.length) {
        const empty = el('div', 'ar-empty');
        empty.append(el('b', '', '아직 파일이 없어요'), el('span', '', state.admin ? '위의 "파일 올리기"로 추가해 보세요.' : state.configured ? '관리자 모드에서 올리거나, 대시보드의 학기/과목 폴더에 넣으면 여기에 나타나요.' : '저장소가 연결되면 여기에 파일이 나타나요.'));
        filesBox.append(empty);
        return;
      }
      const ul = el('ul', 'ar-files');
      for (const f of files) ul.append(fileRow(f, false));
      filesBox.append(ul);
      const head = filesBox.parentElement && filesBox.parentElement.querySelector('.ar-detail-count');
      if (head) head.textContent = `${files.length}개 · ${fmtSize(files.reduce((a, f) => a + f.size, 0))}`;
    }
    function renderBody() {
      body.textContent = '';
      filesBox = null;
      const sem = SEMESTERS.find(s => s.id === state.sem) || SEMESTERS[0];
      if (state.query) {
        const q = state.query.toLowerCase();
        const hits = state.files.filter(f => f.name.toLowerCase().includes(q) || f.subject.toLowerCase().includes(q)).sort((a, b) => b.sem.localeCompare(a.sem) || a.name.localeCompare(b.name, 'ko', { numeric: true }));
        const box = el('div', 'ar-panel');
        box.append(el('div', 'ar-detail-head', ''));
        box.firstChild.append(el('b', '', `"${state.query}" 검색 결과`), el('span', 'ar-detail-count', `${hits.length}개`));
        if (!hits.length) { const empty = el('div', 'ar-empty'); empty.append(el('b', '', '찾는 파일이 없어요'), el('span', '', '다른 단어로 검색해 보세요.')); box.append(empty); }
        else { const ul = el('ul', 'ar-files'); for (const f of hits.slice(0, 300)) ul.append(fileRow(f, true)); box.append(ul); }
        body.append(box);
        return;
      }
      if (state.subject) {
        const s = sem.subjects.find(x => x[3] === state.subject) || ['', '', OTHER, state.subject, 0];
        const panel = el('div', `ar-panel ar-detail ${GROUP_CLASS[s[2]] || 'g-etc'}`);
        const top = el('div', 'ar-detail-top');
        const back = el('button', 'ar-back'); back.type = 'button'; back.append(svg(ICON.back, 16), document.createTextNode('과목 목록'));
        back.addEventListener('click', () => { state.subject = null; render(); });
        const crumb = el('span', 'ar-crumb', semLabel(sem));
        top.append(back, crumb);
        const title = el('div', 'ar-detail-head');
        const tl = el('div', 'ar-detail-title');
        tl.append(el('span', 'ar-chip', s[2]), el('h3', '', s[3]));
        title.append(tl, el('span', 'ar-detail-count', ''));
        panel.append(top, title);
        if (s[0]) panel.append(el('p', 'ar-detail-sub', `${s[0]} · ${s[1]} · ${s[4]}학점`));
        if (state.admin && state.configured) panel.append(uploadZone(sem.id, s[3]));
        filesBox = el('div', 'ar-files-box');
        panel.append(filesBox);
        body.append(panel);
        renderFilesOnly();
        if (!panel.querySelector('.ar-detail-count').textContent) panel.querySelector('.ar-detail-count').textContent = '0개';
        return;
      }
      const grid = el('div', 'ar-grid');
      for (const s of sem.subjects) grid.append(subjectCard(sem, s));
      if (filesFor(sem.id, OTHER).length) grid.append(subjectCard(sem, ['', '', OTHER, OTHER, 0]));
      body.append(grid);
    }
    function render() {
      renderAdminBtn();
      renderSummary();
      renderNotice();
      renderSems();
      renderBody();
    }
    let searchT = 0;
    search.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(() => { state.query = search.value.trim(); renderSems(); renderBody(); }, 120); });
    refreshBtn.addEventListener('click', load);
    if (!SEMESTERS.some(s => s.id === state.sem)) state.sem = SEMESTERS[0].id;
    render();
    const maybeLoad = () => { if (!state.loaded && !root.hidden) load(); };
    document.addEventListener('hanq:tab', e => { if (e.detail === 'archive') maybeLoad(); });
    document.addEventListener('hanq:unlock', maybeLoad);
    maybeLoad();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
