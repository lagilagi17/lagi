/* HanQ — 백월 대왕성 / 사라진 대피 명령.
 * A bounded, versioned story journal. This module owns no actor, geometry,
 * inventory, portal or travel permission. Native adapters deliver interactions.
 * All positions are authored castle XYZ, Y-up, at the player's feet.
 */
(function (host) {
  'use strict';
  const VERSION = 1;
  const QUEST_ID = 'baegwol-missing-evacuation-order';
  const TITLE = '사라진 대피 명령';
  const MAX_INPUT_IDS = 128;
  const clone = value => JSON.parse(JSON.stringify(value));
  function freeze(value) {
    if (value && typeof value === 'object') {
      for (const entry of Object.values(value)) freeze(entry);
      Object.freeze(value);
    }
    return value;
  }

  const RECORDS = freeze([
    {
      id: 'evacuation-order', region: 'citadel', title: '제칠 대피 명령 · 공개본',
      location: '백월 대왕성 1F · 왕실 기록보관소', floor: 1,
      excerpt: '서문 폐쇄를 명한 공개본에는 발송 원본을 대조한 서명이 없다.',
      paragraphs: [
        '왕실 기록보관소에 남은 공개본이다. “세 번째 종이 울리면 서문을 닫고, 대피 인원은 성 안에서 다음 명령을 기다릴 것.” 종이 끝에는 백월의 인장과 ‘제칠’이라는 문서 번호가 찍혀 있다.',
        '그런데 발송 원본과 대조하는 서명 칸은 비어 있다. 모서리에 다른 서기관의 작은 메모가 남아 있다. “서문을 닫으라는 문장은 최초 초안에 없었음. 해안 경로도와 함께 다시 확인할 것.”',
        '이 기록만으로 누가 명령을 바꿨는지는 알 수 없다. 우선 2층 지도 제작실에서 서쪽 수로가 실제로 대피에 쓰일 수 있었는지 살펴보자.'
      ]
    },
    {
      id: 'tidal-chart', region: 'citadel', title: '서쪽 수로의 야간 항로도',
      location: '백월 대왕성 2F · 지도 제작실', floor: 2,
      excerpt: '지도에는 서문 바깥 수로의 대피 항로와 같은 ‘제칠’ 식별 문양이 남아 있다.',
      paragraphs: [
        '지도의 붉은 선은 성 안의 대기 구역이 아니라 서문 밖 수로를 향한다. 조수 높이와 야간 등화 위치 옆에 “인원 먼저, 기록은 다음 배”라는 배차 지시가 적혀 있다.',
        '항로 끝의 옛 해안 보관소에는 초승달을 가로지르는 일곱 줄의 표식이 있다. 기록보관소 문서의 ‘제칠’ 인장과 같은 문양이다. 후대의 WESTPORT 해안과 이어지는 지형을 대조할 수 있다.',
        '서문 폐쇄 명령과 이 항로도는 같은 대피 계획으로 보기 어렵다. 3층 왕실 개인 도서관의 비공개 기록에 발송 전 명령이 남아 있을지 확인하자.'
      ]
    },
    {
      id: 'royal-note', region: 'citadel', title: '발송되지 않은 왕실 부본',
      location: '백월 대왕성 3F · 왕실 개인 도서관', floor: 3,
      excerpt: '왕실 부본은 시민과 기록의 수로 대피를 명한다. 공개본의 서문 폐쇄 지시와 다르다.',
      paragraphs: [
        '끈으로 묶은 왕실 부본에는 “세 번째 종 이전에 시민과 기록을 서쪽 수로로 보낼 것. 문은 마지막 대피자가 지난 뒤 닫을 것”이라고 쓰여 있다.',
        '여백에는 전령에게 남긴 짧은 지시가 있다. “공개본과 한 글자라도 다르면 배차 장부를 보존하라. 명령의 진위는 무엇이 실제로 실렸는지와 함께 판단해야 한다.” 수신 확인란에는 아무도 서명하지 않았다.',
        '두 명령이 다르다는 사실은 확인했지만, 어느 쪽이 현장에 전달됐는지는 아직 모른다. 지하 서고·장부실에서 실제로 반출된 물자와 배차 기록을 찾아보자.'
      ]
    },
    {
      id: 'cargo-ledger', region: 'citadel', title: '제칠 반출 장부 · 마지막 장',
      location: '백월 대왕성 B1 · 서고·장부실', floor: 0,
      excerpt: '왕실 기록함은 해안 보관소로 반출됐다. 인원 인수란은 비어 있고 장부의 마지막 장이 뜯겨 있다.',
      paragraphs: [
        '야간 반출 목록에는 식량, 등화 기름, 왕실 기록함이 적혀 있다. 기록함 옆에는 항로도의 일곱 줄 초승달 문양과 “해안 보관소 인계”라는 목적지가 남아 있다.',
        '물자 인수에는 서명이 있지만, 대피 인원의 인수 칸은 비어 있다. 마지막 장은 뜯겨 있고, 남은 종이에는 “제칠 / 수로 / 보관본”이라는 접수 번호만 읽힌다. 빈 칸만으로 대피자들의 운명을 단정할 수는 없다.',
        '현재의 WESTPORT 해양 현대미술관 B1 해양기록관이 이 해안에서 회수한 유물을 보관하고 있다. 하연의 귀환 시간문으로 현재에 돌아가, 같은 문양과 접수 번호가 있는 소장기록을 대조하자.'
      ]
    },
    {
      id: 'museum-register', region: 'abyss', title: '해양기록관 소장기록 · 제칠 기록함',
      location: '현재 WESTPORT · 해양 현대미술관 B1 해양기록관',
      excerpt: '회수된 기록함의 문양과 접수 번호가 백월 장부와 일치한다. 후속 조사는 HAEMU-07의 신전 항로로 이어진다.',
      paragraphs: [
        '전시 표찰에는 “옛 해안 보관소 인근에서 회수한 왕실 기록함”이라고 적혀 있다. 훼손된 봉인에는 일곱 줄 초승달이, 보존 처리 사진에는 ‘제칠 / 수로 / 보관본’이라는 접수 번호가 남아 있다.',
        '분리 보관된 인계 기록은 해저 신전 서쪽 기록실에서 추가로 발견되었다고 한다. 과거 백월의 문서와 대조하면 같은 반출 기록의 후속 자료인지 확인할 수 있다.',
        '서가 뒤 승강기를 이용해 B2 정박장으로 내려가자. 잠수함 HAEMU-07이 해양기록관과 잊힌 신전 사이를 왕복한다. 신전에서는 서쪽 기록실의 인계 기록을 읽을 수 있다.'
      ]
    },
    {
      id: 'temple-testimony', region: 'abyss', title: '신전 인계 기록 · 도착하지 않은 명령',
      location: '잊힌 해저 신전 · 서쪽 기록실',
      excerpt: '신전은 서로 다른 두 명령을 보관했다. 기록함의 도착은 확인되지만 대피 인원과 명령 변경자의 행방은 남아 있다.',
      paragraphs: [
        '바닷물에 굳은 기록판에 ‘제칠 기록함 인수’라는 문장이 남아 있다. 그 아래에는 서문을 닫으라는 공개본과, 마지막 대피자까지 문을 열어 두라는 왕실 부본이 나란히 옮겨 적혀 있다.',
        '기록 담당자는 두 문서를 하나의 명령으로 정리하지 않았다. “기록함은 도착했다. 사람들의 인계와 최종 명령은 확인되지 않았다. 서로 다른 원본을 함께 보존한다.” 문서의 차이는 확인되지만, 이것만으로 범인이나 대피자들의 최후를 알 수는 없다.',
        '마지막 줄에는 신전 안쪽 원형 관문과 같은 공명 문양이 있다. 미래의 문에서 신호를 확인하면 이번 대조를 마칠 수 있다. 공명을 활성화한 뒤 관문을 다시 사용하면 미래의 하연으로 이동한다.'
      ]
    }
  ]);
  const CASTLE_IDS = freeze(RECORDS.filter(record => record.region === 'citadel').map(record => record.id));
  const RECORD_IDS = freeze(RECORDS.map(record => record.id));
  const EVENT_IDS = freeze(['haemu-boarded', 'future-gate-active']);
  const recordById = new Map(RECORDS.map(record => [record.id, record]));
  const eventSet = new Set(EVENT_IDS);

  const ANCHORS = freeze([
    {id:'chronicler',kind:'npc',region:'citadel',roomId:'F1-south-1',floor:1,position:[-67,42,-145],radius:3.8,label:'왕실 기록관 · 대피 명령 조사'},
    {id:'evacuation-order',kind:'record',region:'citadel',roomId:'F1-west-north',floor:1,position:[-106,42,-270],displayPosition:[-107.5,42,-270],radius:3.8,label:'제칠 대피 명령 · 공개본'},
    {id:'tidal-chart',kind:'record',region:'citadel',roomId:'F2-west-south',floor:2,position:[-106,64,-208],displayPosition:[-107.5,64,-208],radius:3.8,label:'서쪽 수로의 야간 항로도'},
    {id:'royal-note',kind:'record',region:'citadel',roomId:'F3-north-0',floor:3,position:[-88,84,-317],displayPosition:[-89.5,84,-317],radius:3.8,label:'발송되지 않은 왕실 부본'},
    {id:'cargo-ledger',kind:'record',region:'citadel',roomId:'F0-north-1',floor:0,position:[0,22,-316],displayPosition:[-1.5,22,-316],radius:3.8,label:'제칠 반출 장부 · 마지막 장'}
  ]);
  const ACTORS = freeze([
    {id:'chronicler',anchorId:'chronicler',name:'왕실 기록관',role:'백월 대왕성의 기록을 대조하는 서기관',
      roomId:'F1-south-1',floor:1,position:[-65,42,-145],facing:-Math.PI/2,
      appearance:{robe:0x334d55,trim:0xc8b884,sash:0x908257},hostile:false}
  ]);
  const EXTERNAL_ANCHORS = freeze([
    {id:'museum-register',sourceId:'museum-register',kind:'record',region:'abyss',position:[-46.1,19.5,-5.25],radius:2.1,label:'해양기록관 소장기록 · 제칠 기록함'},
    {id:'haemu-boarded',sourceId:'board-city',kind:'event',region:'abyss',position:[-38.94,14.58,5],radius:2.1,label:'HAEMU-07 · 제칠 기록함의 항로'},
    {id:'temple-testimony',sourceId:'drowned-archive',kind:'record',region:'abyss',position:[36.5,-29.15,8.2],radius:2.1,label:'신전 인계 기록 · 제칠 기록함'},
    {id:'future-gate-active',sourceId:'future-gate',kind:'event',region:'abyss',position:[54,-25.72,-14.75],radius:2.3,label:'미래의 문 · 공명 확인'}
  ]);
  // Aliases are identifiers from the adapters, never user-visible location names.
  const ALIASES = freeze({'drowned-archive':'temple-testimony','future-gate':'future-gate-active',
    'temple-gate':'future-gate-active','board-city':'haemu-boarded','board-temple':'haemu-boarded'});
  function normalizeId(value) {
    const id = typeof value === 'string' ? value : value && typeof value.id === 'string' ? value.id : '';
    return Object.prototype.hasOwnProperty.call(ALIASES, id) ? ALIASES[id] : id;
  }
  function knownIds(value, allowed) {
    const present = new Set();
    if (Array.isArray(value)) {
      for (let i = 0; i < Math.min(MAX_INPUT_IDS, value.length); i++) {
        if (typeof value[i] === 'string' && allowed.includes(value[i])) present.add(value[i]);
      }
    }
    return new Set(allowed.filter(id => present.has(id)));
  }

  function create(options = {}) {
    let started = false, records = new Set(), events = new Set();
    function serialize() {
      return {version:VERSION,started,records:RECORD_IDS.filter(id => records.has(id)),events:EVENT_IDS.filter(id => events.has(id))};
    }
    function install(saved) {
      // A new/older save must not inherit the previous character's story journal.
      started = false; records = new Set(); events = new Set();
      if (!saved || typeof saved !== 'object' || saved.version !== VERSION) return false;
      records = knownIds(saved.records, RECORD_IDS); events = knownIds(saved.events, EVENT_IDS);
      started = saved.started === true || records.size > 0;
      return true;
    }
    function stageInfo() {
      const count = CASTLE_IDS.reduce((sum, id) => sum + Number(records.has(id)), 0);
      if (!started) return {stage:'unstarted',nextId:'chronicler',region:'citadel',location:'백월 대왕성 1F · 알현 대기실',objective:'왕실 기록관에게 대피 명령에 관해 묻기',count};
      const missing = CASTLE_IDS.find(id => !records.has(id));
      if (missing) {
        const record = recordById.get(missing);
        return {stage:'palace',nextId:missing,region:'citadel',location:record.location,objective:record.location+'에서 기록 읽기 ('+count+'/4)',count};
      }
      if (!records.has('museum-register')) return {stage:'museum',nextId:'museum-register',region:'abyss',location:'현재 WESTPORT · 해양 현대미술관 B1',objective:'현재로 돌아가 해양기록관의 제칠 기록함 소장기록 읽기',count};
      if (!events.has('haemu-boarded')) return {stage:'voyage',nextId:'haemu-boarded',region:'abyss',location:'해양기록관 B2 · 잠수함 정박장',objective:'HAEMU-07에 탑승해 해저 신전으로 이동하기',count};
      if (!records.has('temple-testimony')) return {stage:'temple',nextId:'temple-testimony',region:'abyss',location:'잊힌 해저 신전 · 서쪽 기록실',objective:'신전 서쪽 기록실에서 제칠 기록함 인계 기록 읽기',count};
      if (!events.has('future-gate-active')) return {stage:'resonance',nextId:'future-gate-active',region:'abyss',location:'잊힌 해저 신전 · 미래의 문',objective:'신전 안쪽 미래의 문에서 공명 확인하기',count};
      return {stage:'complete',nextId:null,region:null,location:'백월 대왕성 ↔ 해양기록관 ↔ 잊힌 신전',objective:'첫 조사 완료 · 두 명령과 제칠 기록함의 항로를 대조했다',count};
    }
    function status() {
      const info = stageInfo();
      return {version:VERSION,id:QUEST_ID,title:TITLE,started,stage:info.stage,completed:info.stage==='complete',
        palaceCount:info.count,palaceTotal:CASTLE_IDS.length,recordCount:records.size,recordTotal:RECORD_IDS.length,
        objective:info.objective,nextId:info.nextId,region:info.region,location:info.location};
    }
    function notify() {
      // Journal/UI observers cannot cancel a native travel action after it succeeds.
      if (typeof options.onChange === 'function') {
        try { options.onChange(serialize(), status()); } catch (_) {}
      }
    }
    function result(id, data, changed, silent = false) {
      const current = status();
      const paragraphs = data.paragraphs ? data.paragraphs.slice() : [];
      return {handled:true,id,changed,silent,title:data.title,location:data.location||current.location,
        speaker:data.speaker||null,paragraphs,text:paragraphs.join('\n\n'),
        excerpt:data.excerpt||paragraphs[0]||'',objective:current.objective,stage:current.stage,completed:current.completed};
    }
    function chroniclerDialogue(wasStarted) {
      const current = status();
      if (!wasStarted) return {
        title:'왕실 기록관 · 서로 다른 두 명령',speaker:'왕실 기록관',location:'백월 대왕성 1F · 알현 대기실',
        paragraphs:[
          '“하연성에 온 것을 환영하오. 이곳은 도성의 왕궁, 백월 대왕성이오. 붕괴의 밤에 내려졌다는 대피 명령을 찾고 있소? 공개본에는 서문을 닫으라 적혀 있지만, 내게 남은 발송 메모는 다른 이야기를 하고 있소.”',
          '“1층 기록보관소의 명령서, 2층 지도 제작실의 항로도, 3층 개인 도서관의 왕실 부본, 지하 장부실의 반출 목록을 대조해 보시오. 어느 기록부터 찾아도 괜찮소. 눈으로 확인한 내용만 수첩에 남기는 게 좋겠소.”',
          '“빈 인수란이 곧 누군가의 죽음을 뜻하지는 않소. 명령을 바꾼 사람도 아직 알 수 없고. 물건이 어디로 갔는지부터 차근차근 따라가 봅시다.”'
        ]
      };
      if (current.stage === 'palace') return {
        title:'왕실 기록관 · 기록 대조 중',speaker:'왕실 기록관',
        paragraphs:[
          '“지금까지 궁성의 기록 '+current.palaceCount+'개를 확인했구려. 서로 다른 종이가 같은 사건을 말한다고 해서, 빠진 내용을 짐작으로 채워 넣어서는 안 되오.”',
          '“다음으로는 '+current.location+'을 살펴보시오. 기록을 다시 읽어도 수첩의 진행은 사라지지 않소.”',
          '이미 읽은 문서의 전문은 조사 수첩에서 다시 볼 수 있다.'
        ]
      };
      if (current.completed) return {
        title:'왕실 기록관 · 이어진 기록, 남은 의문',speaker:'왕실 기록관',
        paragraphs:[
          '“공개본과 왕실 부본이 달랐다는 것, 제칠 기록함이 수로를 따라 옮겨졌다는 것까지 확인했구려. 사라진 장부를 억지로 채우지 않고 두 기록을 함께 남겨 주어 고맙소.”',
          '“명령을 바꾼 자와 대피자들의 행방은 여전히 남아 있소. 미래의 하연으로 길이 이어졌어도, 아직 확인하지 않은 일까지 증거로 삼을 수는 없소. 이번에 확인한 기록을 잘 보관하시오.”',
          '첫 조사를 마쳤다. 궁성과 해양기록관, 해저 신전과 미래의 하연을 계속 자유롭게 오갈 수 있다. 미래 시공 터미널의 귀환 포탈은 해저 신전으로 이어진다.'
        ]
      };
      return {
        title:'왕실 기록관 · 수로 너머의 기록',speaker:'왕실 기록관',
        paragraphs:[
          '“궁성에 남은 네 기록의 대조를 마쳤구려. 공개본과 왕실 부본은 다르고, 장부에는 실제로 반출한 기록함의 표식이 남아 있소.”',
          '“기록함이 도착한 곳의 자료까지 확인하면 이 궁성 밖에서 무슨 일이 이어졌는지 알 수 있겠지. 다음 행선지는 '+current.location+'이오.”',
          '현재 목표: '+current.objective
        ]
      };
    }
    function interact(value) {
      const id = normalizeId(value);
      if (id === 'chronicler') {
        const wasStarted = started; started = true;
        if (!wasStarted) notify();
        return result(id, chroniclerDialogue(wasStarted), !wasStarted);
      }
      const record = recordById.get(id);
      if (!record) return {handled:false,changed:false,id};
      const changed = !started || !records.has(id);
      records.add(id); started = true;
      if (changed) notify();
      return result(id, record, changed);
    }
    function observe(value) {
      const id = normalizeId(value);
      if (!eventSet.has(id)) return {handled:false,changed:false,id};
      const changed = !events.has(id); events.add(id);
      if (changed) notify();
      const data = id === 'haemu-boarded' ? {
        title:'제칠 기록함의 항로 · HAEMU-07',location:'해양기록관 ↔ 잊힌 해저 신전',
        paragraphs:['HAEMU-07의 항로가 해양기록관과 잊힌 신전을 잇는다. 도착 후 서쪽 기록실에서 제칠 기록함의 인계 기록을 대조할 수 있다.']
      } : {
        title:'미래의 문 · 응답한 공명',location:'잊힌 해저 신전 · 미래의 문',
        paragraphs:[
          '원형 관문의 공명 문양이 제칠 기록함의 표식에 응답한다. “끝나지 않은 전쟁… 아직 도착하지 않은 시대의 신호.”',
          '미래의 하연으로 향하는 길이 열렸다. 이 기록을 닫고 관문 앞에서 E / F 또는 손 버튼을 다시 누르면 이동한다. 미래 시공 터미널의 귀환 포탈로 신전에 돌아온 뒤, HAEMU-07을 타고 해양기록관으로 복귀할 수 있다.'
        ]
      };
      return result(id, data, changed, !started);
    }
    function syncAbyss(snapshot) {
      if (!snapshot || typeof snapshot !== 'object' || snapshot.version !== 1) return false;
      let changed = false;
      const remember = id => {if (!events.has(id)) {events.add(id);changed=true;}};
      if (snapshot.gateActive === true) remember('future-gate-active');
      const visited = Array.isArray(snapshot.visited) ? snapshot.visited.slice(0,MAX_INPUT_IDS) : [];
      const templeCheckpoints = ['temple-berth','temple-entry','temple-gate','temple-archive','temple-crypt'];
      const transit = snapshot.transit && typeof snapshot.transit === 'object' ? snapshot.transit : {};
      if (transit.riding === true || (Number.isFinite(transit.progress) && transit.progress > 0 && transit.progress <= 1) || visited.some(id => templeCheckpoints.includes(id))) remember('haemu-boarded');
      // Visited checkpoints are not proof that either document was actually read.
      if (changed) notify();
      return changed;
    }
    function journal() {
      const current = status();
      return {...current,entries:RECORDS.filter(record => records.has(record.id)).map(record => clone(record)),
        events:EVENT_IDS.filter(id => events.has(id)).map(id => ({id,title:id==='haemu-boarded'?'HAEMU-07 항로 확인':'미래의 문 공명 확인'})),
        conclusion:current.completed ? '서로 다른 두 대피 명령과 제칠 기록함의 항로를 대조했다. 명령 변경자와 대피 인원의 행방은 아직 밝혀지지 않았다.' : null};
    }
    function markers(region = 'citadel') {
      const current = status();
      return ANCHORS.concat(EXTERNAL_ANCHORS).filter(anchor => anchor.region === region).map(anchor => {
        const read = anchor.kind === 'npc' ? started : anchor.kind === 'event' ? events.has(anchor.id) : records.has(anchor.id);
        return {...clone(anchor),read,active:anchor.id===current.nextId,
          state:anchor.id===current.nextId?'objective':read?(anchor.kind==='npc'?'visited':'read'):'available'};
      });
    }
    install(options.saved);
    return {install,serialize,interact,observe,syncAbyss,status,journal,markers};
  }
  host.HanQCitadelStory = Object.freeze({version:VERSION,id:QUEST_ID,title:TITLE,anchors:ANCHORS,actors:ACTORS,externalAnchors:EXTERNAL_ANCHORS,
    records:RECORDS,recordIds:RECORD_IDS,castleRecordIds:CASTLE_IDS,eventIds:EVENT_IDS,aliases:ALIASES,create});
})(typeof window !== 'undefined' ? window : globalThis);
