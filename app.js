'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const list = $('#course-list');
  const confirmDialog = $('#confirm-dialog');
  let serial = 0;
  let rows = [];
  let scale = '4.3';
  let session = null;
  let loadedCode = null;
  let savedSnapshot = null;
  let lastSaved = null;
  let operationBusy = false;
  let busyMessage = '';
  let statusMessage = '';
  let statusError = false;
  let resolveConfirmation = null;
  const empty = () => ({id:++serial,name:'',credits:'',grade:''});
  const number = value => new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(value);
  const currentData = () => ({version:1,scale,semester:$('#semester').value,rows:rows.map(({name,credits,grade})=>({name,credits,grade}))});
  const snapshot = () => JSON.stringify(currentData());
  const hasInput = () => $('#semester').value.trim() || rows.some(r=>r.name.trim() || r.credits!=='' || r.grade);
  const isDirty = () => session ? snapshot()!==savedSnapshot : !!hasInput();
  function announce(message) { $('#app-status').textContent=message; }
  function dateText(value) {
    const date=new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit'}).format(date) : '방금';
  }
  function updateSaveStatus() {
    const target=$('#storage-status');
    let message=statusMessage;
    if(operationBusy) message=busyMessage || '처리 중…';
    else if(!message) {
      if(session && $('#record-code').value===loadedCode) message=isDirty() ? '미저장' : dateText(lastSaved)+' 저장됨';
      else message='';
    }
    target.textContent=message;
    target.classList.toggle('error',!operationBusy && statusError);
    target.classList.toggle('success',!operationBusy && !statusError && !!session && !isDirty());
  }
  function setStatus(message,error=false) {statusMessage=message;statusError=error;updateSaveStatus();announce(message);}
  function edited() {statusMessage='';statusError=false;updateSaveStatus();}
  function ask(title,message,acceptLabel='계속') {
    if(resolveConfirmation) return Promise.resolve(false);
    $('#confirm-title').textContent=title;
    $('#confirm-message').textContent=message;
    $('#confirm-accept').textContent=acceptLabel;
    confirmDialog.showModal();
    $('#confirm-cancel').focus();
    return new Promise(resolve=>{resolveConfirmation=resolve;});
  }
  function completeConfirmation(accepted) {
    const resolve=resolveConfirmation;
    resolveConfirmation=null;
    confirmDialog.close();
    if(resolve) resolve(accepted);
  }
  $('#confirm-cancel').addEventListener('click',()=>completeConfirmation(false));
  $('#confirm-accept').addEventListener('click',()=>completeConfirmation(true));
  confirmDialog.addEventListener('cancel',event=>{event.preventDefault();completeConfirmation(false);});
  function updateScale() {
    for(const button of document.querySelectorAll('[data-scale]')) {
      const selected=button.dataset.scale===scale;
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',String(selected));
    }
    $('#gpa-max').textContent='/ '+scale;
    $('#gpa-meter').max=Number(scale);
  }
  function makeInput(type, field, label, row, index) {
    const input = document.createElement('input');
    input.type = type;
    input.value = row[field];
    input.dataset.field = field;
    input.setAttribute('aria-label', `${index + 1}번 과목 ${label}`);
    input.setAttribute('aria-describedby', 'row-error-' + row.id);
    input.autocomplete = 'off';
    if (field === 'name') { input.placeholder = '과목명 (선택)'; input.maxLength = 60; }
    else { input.placeholder = '3'; input.min = '0.5'; input.max = '100'; input.step = '0.5'; input.inputMode = 'decimal'; }
    input.addEventListener('input', () => { row[field] = input.validity.badInput ? 'invalid' : input.value; edited(); update(); });
    return input;
  }
  function renderRows(focusId) {
    list.replaceChildren();
    rows.forEach((row,index) => {
      const item = document.createElement('div'); item.className = 'course-row'; item.dataset.id = String(row.id);
      const fields = document.createElement('div'); fields.className = 'row-fields';
      const rowNumber = document.createElement('span'); rowNumber.className = 'row-number'; rowNumber.textContent = String(index+1).padStart(2,'0'); rowNumber.setAttribute('aria-hidden','true');
      const name = makeInput('text','name','이름',row,index);
      const credits = makeInput('number','credits','학점',row,index);
      const grades = GPA.scales[scale].grades;
      const grade = document.createElement('div'); grade.className = 'grade-picker'; grade.dataset.field = 'grade';
      grade.setAttribute('role','group'); grade.setAttribute('aria-label',`${index+1}번 과목 성적`);
      grade.setAttribute('aria-describedby','row-error-'+row.id);
      const quickGrades = ['A+','A0','A-'].filter(key=>Object.hasOwn(grades,key));
      for (const key of quickGrades) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'grade-quick';
        button.dataset.value = key; button.textContent = key; button.setAttribute('aria-label',`${index+1}번 과목 ${key}`);
        button.setAttribute('aria-pressed',String(row.grade===key));
        button.addEventListener('click',()=>{
          if(operationBusy)return;
          row.grade = row.grade===key ? '' : key;
          edited(); update();
        });
        grade.append(button);
      }
      const other = document.createElement('select'); other.className = 'grade-other'; other.dataset.field = 'grade';
      other.setAttribute('aria-label',`${index+1}번 과목 기타 성적`); other.setAttribute('aria-describedby','row-error-'+row.id);
      other.add(new Option('기타',''));
      for (const key of Object.keys(grades)) if(!quickGrades.includes(key)) other.add(new Option(key,key));
      if (row.grade && !Object.hasOwn(grades,row.grade)) { const stale = new Option(row.grade+' · 재선택',row.grade); stale.disabled = true; other.add(stale); }
      other.value = quickGrades.includes(row.grade) ? '' : row.grade;
      other.addEventListener('change',()=>{
        if(operationBusy)return;
        row.grade = other.value; edited(); update();
      });
      grade.append(other);
      const points = document.createElement('span'); points.className = 'row-point'; points.setAttribute('aria-label','환산 평점');
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-row'; remove.textContent = '×'; remove.setAttribute('aria-label',`${index+1}번 과목 삭제`);
      remove.addEventListener('click', () => {
        if (operationBusy) return;
        rows = rows.filter(r => r.id !== row.id); if (!rows.length) rows.push(empty());
        edited(); renderRows(rows[Math.min(index,rows.length-1)].id); announce('과목을 삭제했어요.');
      });
      fields.append(rowNumber,name,credits,grade,points,remove);
      const error = document.createElement('p'); error.id = 'row-error-'+row.id; error.className = 'row-error'; error.hidden = true;
      item.append(fields,error); list.append(item);
    });
    $('#row-count').textContent = `${rows.length} / 50 과목`;
    $('#add-course').disabled = rows.length >= 50 || operationBusy;
    update();
    if (focusId) list.querySelector(`[data-id="${focusId}"] input`).focus();
  }
  function update() {
    const result = GPA.calculate(rows,scale);
    const grades = GPA.scales[scale].grades;
    const counts = {A:0,B:0,C:0,D:0,F:0};
    for (const row of rows) {
      const item = list.querySelector(`[data-id="${row.id}"]`);
      const errors = result.errors.filter(e => e.id === row.id);
      const error = item.querySelector('.row-error'); error.hidden = !errors.length; error.textContent = errors.map(e=>e.message).join(' ');
      for (const field of item.querySelectorAll('[data-field]')) {
        const invalid = errors.some(e => e.field === field.dataset.field);
        if (invalid) field.setAttribute('aria-invalid','true'); else field.removeAttribute('aria-invalid');
      }
      const known = Object.hasOwn(grades,row.grade);
      let quickSelected = false;
      for(const button of item.querySelectorAll('.grade-quick')) {
        const selected = button.dataset.value===row.grade;
        button.classList.toggle('selected',selected);
        button.setAttribute('aria-pressed',String(selected));
        if(selected)quickSelected = true;
      }
      const other = item.querySelector('.grade-other');
      other.value = quickSelected ? '' : row.grade;
      other.classList.toggle('filled',!!row.grade && !quickSelected);
      item.querySelector('.row-point').textContent = !known ? '—' : grades[row.grade] === null ? '제외' : grades[row.grade].toFixed(1);
      if (!errors.length && known && Object.hasOwn(counts,row.grade[0]) && row.grade !== 'NP') counts[row.grade[0]]++;
    }
    const invalid = result.hasIncomplete;
    const text = GPA.format(result);
    $('#gpa-value').textContent = text ?? '—';
    $('#gpa-value').classList.toggle('empty', !text);
    $('#gpa-meter').value = result.gpa ?? 0;
    $('#gpa-meter').setAttribute('aria-valuetext', text ? `${text} / ${scale}` : '계산할 평점 없음');
    $('#active-count').textContent = result.activeCount;
    $('#gpa-credits').textContent = invalid ? '—' : number(result.gpaCredits);
    $('#earned-credits').textContent = invalid ? '—' : number(result.earnedCredits);
    $('#included-count').textContent = invalid ? '—' : String(result.includedCount);
    $('#result-badge').textContent = invalid ? '입력 확인' : text ? '계산 완료' : '입력 대기';
    const maxCount = Math.max(1,...Object.values(counts));
    for (const [grade,count] of Object.entries(counts)) {
      const bar = document.querySelector(`[data-grade="${grade}"]`);
      bar.className = 'bar level-'+Math.round(count/maxCount*10);
      document.querySelector(`[data-count="${grade}"]`).textContent = count;
    }
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    $('#distribution-count').textContent = `${total} 과목`;
    $('#distribution-bars').setAttribute('aria-label',Object.entries(counts).map(([g,c])=>`${g} ${c}과목`).join(', '));
    updateSaveStatus();
  }
  function clearWork() {
    scale = '4.3'; $('#semester').value = ''; rows = Array.from({length:6},empty); updateScale(); renderRows();
  }
  function loadData(data) {
    scale = data.scale;
    $('#semester').value = data.semester || '';
    rows = data.rows.map(r=>({id:++serial,name:r.name,credits:r.credits,grade:r.grade}));
    if (!rows.length) rows = Array.from({length:6},empty);
    updateScale(); renderRows();
  }

  function setWorkingBusy(busy,message='') {
    operationBusy=busy;busyMessage=message;
    for(const element of document.querySelectorAll('#calculator input,#calculator select,#calculator button')) element.disabled=busy;
    if(!busy) $('#add-course').disabled=rows.length>=50;
    $('#storage-form').setAttribute('aria-busy',String(busy));
    updateSaveStatus();
  }
  function errorMessage(error) {
    const messages={
      CODE:'비밀번호는 영문·숫자 4글자로 입력해 주세요.',
      NOT_FOUND:'이 비밀번호로 저장한 기록이 없어요. 대소문자를 확인해 주세요.',
      CONFLICT:'다른 탭에서 기록이 바뀌었어요. 현재 입력은 유지돼요. 다시 불러온 뒤 저장해 주세요.',
      SESSION_CLOSED:'저장 기록을 다시 불러온 뒤 저장해 주세요.'
    };
    if(error && messages[error.code]) return messages[error.code];
    if(error && typeof error.message==='string' && /[가-힣]/.test(error.message)) return error.message;
    return '작업을 완료하지 못했어요. 현재 입력은 유지돼요.';
  }
  function validCode() {
    const field=$('#record-code');
    if(/^[A-Za-z0-9]{4}$/.test(field.value)) {field.removeAttribute('aria-invalid');return field.value;}
    field.setAttribute('aria-invalid','true');
    setStatus('비밀번호는 영문·숫자 4글자로 입력해 주세요.',true);
    field.focus();return null;
  }
  function requireVault() {
    if(typeof Vault==='undefined') throw new Error('저장 기능을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.');
  }
  function adoptSession(next,code,updatedAt) {
    if(session && session!==next) Vault.close(session);
    session=next;loadedCode=code;lastSaved=updatedAt;savedSnapshot=snapshot();
  }
  $('#record-code').addEventListener('input',()=>{$('#record-code').removeAttribute('aria-invalid');edited();});
  $('#storage-form').addEventListener('submit',async event=>{
    event.preventDefault();if(operationBusy)return;
    const code=validCode();if(code===null)return;
    const data=currentData();const savingSnapshot=JSON.stringify(data);
    let targetSession=null;
    setWorkingBusy(true,'저장 중…');
    try {
      requireVault();
      if(session && loadedCode===code) {
        const result=await Vault.save(session,data);
        savedSnapshot=savingSnapshot;lastSaved=result.updatedAt;
      } else {
        let result;
        try {
          result=await Vault.createCode(code,data);
          targetSession=result.session;
        } catch(error) {
          if(error.code!=='EXISTS')throw error;
          const existing=await Vault.unlockCode(code);
          targetSession=existing.session;
          if(!await ask('기존 기록을 덮어쓸까요?','이 비밀번호에 저장된 기록을 현재 입력으로 바꿔요. 기존 내용은 되돌릴 수 없어요.','덮어쓰기')) {
            setStatus('저장 취소');return;
          }
          result=await Vault.save(targetSession,data);
        }
        adoptSession(targetSession,code,result.updatedAt);
        savedSnapshot=savingSnapshot;
        targetSession=null;
      }
      setStatus(dateText(lastSaved)+' 저장됨');
    } catch(error) {setStatus(errorMessage(error),true);}
    finally {
      if(targetSession)Vault.close(targetSession);
      setWorkingBusy(false);
    }
  });
  $('#load-record').addEventListener('click',async()=>{
    if(operationBusy)return;
    const code=validCode();if(code===null)return;
    let targetSession=null;
    setWorkingBusy(true,'불러오는 중…');
    try {
      requireVault();
      const result=await Vault.unlockCode(code);targetSession=result.session;
      if(isDirty() && !await ask('현재 입력을 바꿀까요?','저장하지 않은 입력은 지워지고 저장된 기록으로 바뀌어요.','불러오기')) {
        setStatus('불러오기 취소');return;
      }
      loadData(result.data);
      adoptSession(targetSession,code,result.updatedAt);targetSession=null;
      setStatus('불러오기 완료');
    } catch(error) {setStatus(errorMessage(error),true);}
    finally {if(targetSession)Vault.close(targetSession);setWorkingBusy(false);}
  });
  $('#legacy-form').addEventListener('submit',async event=>{
    event.preventDefault();if(operationBusy)return;
    const id=$('#legacy-id').value.trim().toLowerCase();
    let pin=$('#legacy-pin').value;
    if(!/^[a-z0-9_-]{3,24}$/.test(id)) {setStatus('이전 저장 ID를 확인해 주세요.',true);$('#legacy-id').focus();return;}
    if(!/^\d{4}$/.test(pin)) {setStatus('이전 PIN은 숫자 4자리예요.',true);$('#legacy-pin').focus();return;}
    let oldSession=null;
    setWorkingBusy(true,'이전 기록을 가져오는 중…');
    try {
      requireVault();
      const result=await Vault.unlock(id,pin);oldSession=result.session;
      pin='';$('#legacy-pin').value='';
      if(isDirty() && !await ask('현재 입력을 바꿀까요?','저장하지 않은 입력은 지워지고 이전 기록으로 바뀌어요.','가져오기')) {
        setStatus('가져오기 취소');return;
      }
      if(session)Vault.close(session);
      session=null;loadedCode=null;savedSnapshot=null;lastSaved=null;
      $('#record-code').value='';
      loadData(result.data);
      $('#legacy-records').open=false;
      setStatus('이전 기록 불러옴 · 미저장');
    } catch(error) {setStatus(errorMessage(error),true);}
    finally {pin='';$('#legacy-pin').value='';if(oldSession)Vault.close(oldSession);setWorkingBusy(false);}
  });
  $('#legacy-records').addEventListener('toggle',()=>{if(!$('#legacy-records').open)$('#legacy-pin').value='';});
  $('#add-course').addEventListener('click',()=>{
    if(operationBusy||rows.length>=50)return;
    const row=empty();rows.push(row);edited();renderRows(row.id);announce('새 과목을 추가했어요.');
  });
  $('#semester').addEventListener('input',edited);
  for(const button of document.querySelectorAll('[data-scale]')) button.addEventListener('click',()=>{
    if(operationBusy||scale===button.dataset.scale)return;
    scale=button.dataset.scale;edited();updateScale();renderRows();
    announce(GPA.calculate(rows,scale).errors.some(error=>error.field==='grade')?'만점 기준을 바꿨어요. 지원하지 않는 성적을 다시 선택해 주세요.':scale+' 만점으로 계산해요.');
  });
  $('#example').addEventListener('click',async()=>{
    if(operationBusy)return;
    setWorkingBusy(true);
    try {
      if(hasInput() && !await ask('예시 과목으로 바꿀까요?','현재 입력을 수학·영어 예시 2과목으로 바꿔요. 저장한 기록은 저장 버튼을 누르기 전까지 바뀌지 않아요.','예시 입력'))return;
      rows=[{...empty(),name:'수학',credits:'3',grade:'A+'},{...empty(),name:'영어',credits:'2',grade:'B0'},...Array.from({length:4},empty)];
      edited();renderRows();announce('예시 2과목을 입력했어요.');
    } finally {setWorkingBusy(false);}
  });
  $('#reset').addEventListener('click',async()=>{
    if(operationBusy)return;
    setWorkingBusy(true);
    try {
      if(hasInput() && !await ask('현재 입력을 초기화할까요?','과목과 학기 이름이 지워져요. 저장한 기록은 저장 버튼을 누르기 전까지 바뀌지 않아요.','초기화'))return;
      clearWork();edited();announce('입력을 초기화했어요.');
    } finally {setWorkingBusy(false);}
  });
  window.addEventListener('beforeunload',event=>{if(isDirty()){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>{
    if(session && typeof Vault!=='undefined')Vault.close(session);
    session=null;loadedCode=null;savedSnapshot=null;
    $('#record-code').value='';$('#legacy-pin').value='';
  });
  $('#record-code').value='';$('#legacy-pin').value='';
  try {$('#legacy-records').hidden=typeof Vault==='undefined' || !Vault.hasLegacyRecords();}catch(_error){$('#legacy-records').hidden=true;}
  clearWork();
})();
