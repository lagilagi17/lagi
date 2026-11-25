/* HANQ original past arsenal. Geometry and ornament builders adapted from the
 * user's HanQ-Chrono-Armory-64.html (past p01–p32 only). Dimensions, grip markers,
 * combat values and controls are game design; they are not historical claims.
 * Source meshes keep their axes (+X length, +Y up), with an individual metre
 * scale. Exhibition centering and its uniform 5.15 normalization are not used.
 */
(function(root,factory){
  const melee=root.HanQMelee||(typeof module==='object'&&module.exports?require('./g-melee.js'):null);
  const api=factory(melee);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HanQPastArsenal=api;
})(typeof window!=='undefined'?window:globalThis,function(melee){
'use strict';
const SOURCE_CATALOG=[{"sourceId":"p01","name":"환두 · 성루의 검","englishName":"RING OF THE KEEP","type":"도검","category":"도검","role":"균형 잡힌 한손검","description":"고성 성루 수비대의 상징을 새긴 환두검. 열린 고리 장식과 청동 띠가 검의 무게감을 시각적으로 구분한다."},{"sourceId":"p02","name":"흑송 환도","englishName":"BLACK PINE SABER","type":"도검","category":"도검","role":"기동형 곡도","description":"흑송으로 만든 칼자루에 검은 가죽을 감은 곡도. 칼등에서 끝으로 이어지는 유연한 곡선이 숲길 정찰대의 장비를 떠올리게 한다."},{"sourceId":"p03","name":"쌍월 유엽도","englishName":"TWIN WILLOW BLADES","type":"도검","category":"도검","role":"쌍수 근접검","description":"잎 모양의 넓은 칼날 두 자루를 한 쌍으로 구성했다. 짧은 손막이와 비대칭 붉은 매듭으로 두 검의 방향을 쉽게 읽을 수 있다."},{"sourceId":"p04","name":"철조 파수대검","englishName":"RAVEN WATCH GREATSWORD","type":"도검","category":"도검","role":"양손 중검","description":"큰 손막이와 긴 자루를 가진 철조 파수대의 대검. 칼날의 넓은 중앙 능선과 검은 홈이 묵직한 정면 인상을 만든다."},{"sourceId":"p05","name":"적사 장도","englishName":"RED SAND LONGSWORD","type":"도검","category":"도검","role":"긴 양손 곡도","description":"붉은 사막 관문에서 쓰이는 긴 곡도라는 설정이다. 긴 붉은 손잡이와 절제된 원형 손막이가 날의 길이를 강조한다."},{"sourceId":"p06","name":"왕성 문장검","englishName":"CITADEL CREST SWORD","type":"도검","category":"도검","role":"의장 겸 근접검","description":"왕성의 마지막 수문장이 남긴 장검이라는 콘셉트다. 날개 모양 손막이와 중앙 문장판에 장식의 밀도를 집중했다."},{"sourceId":"p07","name":"비취 장식비수","englishName":"JADE COURT DAGGER","type":"도검","category":"도검","role":"짧은 보조검","description":"비취빛 장식색을 쓴 궁정 비수. 넓은 잎 모양 칼날과 작은 금속 구슬이 가까이서 볼 수 있는 세부를 만든다."},{"sourceId":"p08","name":"흑연 쌍구검","englishName":"SHADOW HOOK SWORDS","type":"도검","category":"도검","role":"걸기형 쌍검","description":"끝을 안쪽으로 감은 갈고리검 두 자루. 초승달 모양 손막이와 뒤쪽 짧은 촉이 여러 방향의 실루엣을 만든다."},{"sourceId":"p09","name":"현월 굽이도","englishName":"CRESCENT PASS KNIFE","type":"도검","category":"도검","role":"곡선 단도","description":"굽은 넓은 칼날과 뒤로 꺾인 손잡이를 조합했다. 산길 초소의 실용 장비라는 설정으로 장식을 줄이고 표면의 대비를 강조했다."},{"sourceId":"p10","name":"매화 철선","englishName":"PLUM BLOSSOM WAR FAN","type":"도검","category":"도검","role":"부채형 근접 도구","description":"접힌 부채를 펼친 형태의 철선이다. 철제 살 사이에 어두운 직물과 금빛 매화 문양을 배치해 작은 무기에도 넓은 장식 면을 확보했다."},{"sourceId":"p11","name":"백호 장창","englishName":"WHITE TIGER SPEAR","type":"장병기","category":"장병기","role":"긴 찌르기 무기","description":"백호 초소의 긴 창이라는 설정이다. 은빛 창촉 아래 붉은 술과 여러 겹의 금속 띠를 두어 끝부분을 선명하게 구분했다."},{"sourceId":"p12","name":"청월 언월도","englishName":"AZURE MOON GLAIVE","type":"장병기","category":"장병기","role":"넓은 베기형 장병기","description":"넓은 반달 칼날과 긴 봉을 결합했다. 칼등의 고리와 붉은 술이 정지 상태에서도 방향과 움직임을 상상하게 한다."},{"sourceId":"p13","name":"봉황 삼지극","englishName":"PHOENIX HALBERD","type":"장병기","category":"장병기","role":"복합 날 장병기","description":"창촉과 갈고리 날을 서로 다른 방향으로 배치한 극. 불사조 깃을 연상시키는 층진 장식이 관문 수비대의 표식을 이룬다."},{"sourceId":"p14","name":"해문 삼첨차","englishName":"TIDE GATE TRIDENT","type":"장병기","category":"장병기","role":"세 갈래 창","description":"옛 항구 수문을 지키는 삼지창이라는 디자인이다. 길이가 다른 세 촉과 고리형 연결부가 정면과 측면 모두에서 형태를 구분해 준다."},{"sourceId":"p15","name":"흑조 협도","englishName":"BLACK HERON POLEBLADE","type":"장병기","category":"장병기","role":"날렵한 곡도형 창","description":"좁고 긴 곡선 칼날로 만든 장병기다. 검은 칠의 창대에 밝은 금속 띠를 간격 있게 둘러 까마귀 날개 같은 인상을 냈다."},{"sourceId":"p16","name":"쌍월 철극","englishName":"TWIN MOON POLEAXE","type":"장병기","category":"장병기","role":"대칭 쌍날 장병기","description":"양쪽의 반달 날을 대칭으로 펼친 의장용 극. 긴 중앙 창촉과 두 개의 빈 공간이 큰 무기에서도 복잡한 외곽선을 유지한다."},{"sourceId":"p17","name":"산성 파문도끼","englishName":"MOUNTAIN KEEP AXE","type":"둔기","category":"둔기","role":"한손 도끼","description":"산성의 문양을 새긴 넓은 도끼다. 목재 손잡이와 서로 다른 색의 금속 띠를 통해 오래 사용한 장비의 느낌을 표현했다."},{"sourceId":"p18","name":"철문 팔릉철퇴","englishName":"EIGHT RIDGE MACE","type":"둔기","category":"둔기","role":"철퇴","description":"여덟 개의 날개형 철판을 둘러 묵직한 머리를 만들었다. 단순한 구체 대신 빈 공간이 있는 구조를 사용해 회전하면서 보는 재미를 더했다."},{"sourceId":"p19","name":"운문 유성추","englishName":"CLOUD CHAIN FLAIL","type":"둔기","category":"둔기","role":"사슬 연결 둔기","description":"금속 추와 짧은 자루를 구불거리는 사슬로 연결했다. 각각의 사슬 고리를 실제 입체로 배치해 가까이서도 연결감을 볼 수 있다."},{"sourceId":"p20","name":"뇌문 전투망치","englishName":"THUNDER CREST HAMMER","type":"둔기","category":"둔기","role":"양면 전투망치","description":"평평한 타격면과 가늘게 뻗은 반대쪽 끝을 조합했다. 겹친 판과 작은 리벳으로 머리 부분의 금속 질감을 강조했다."},{"sourceId":"p21","name":"적송 장궁","englishName":"RED PINE LONGBOW","type":"궁시","category":"궁시","role":"장궁","description":"자연스러운 굽은 목재를 길게 사용한 활. 활과 나란히 화살 몇 발과 작은 가죽 화살통을 배치했다."},{"sourceId":"p22","name":"흑각 반궁","englishName":"BLACK HORN RECURVE","type":"궁시","category":"궁시","role":"짧은 반곡궁","description":"양 끝이 다시 바깥으로 굽는 작은 활이다. 짙은 몸체와 상아색 가장자리, 붉은 천 감김을 대비시켰다."},{"sourceId":"p23","name":"성채 목노","englishName":"CITADEL WOOD CROSSBOW","type":"궁시","category":"궁시","role":"석궁","description":"두꺼운 목재 몸체와 단순한 활대를 결합한 석궁이다. 과거 장비에 맞춰 금속 띠와 끈, 목재의 표면을 중심으로 디자인했다."},{"sourceId":"p24","name":"철목 중노","englishName":"IRONWOOD HEAVY CROSSBOW","type":"궁시","category":"궁시","role":"대형 석궁","description":"성벽 전시대에 놓였을 법한 묵직한 석궁이다. 넓은 철테 활대와 여러 겹의 외부 판으로 일반 석궁과 실루엣을 구별했다."},{"sourceId":"p25","name":"흑림 원방패","englishName":"BLACKWOOD ROUND SHIELD","type":"방어","category":"방어","role":"목제 원방패","description":"방사형 목판을 철테로 감싼 원방패. 중앙 보스와 둘레의 리벳, 후면 손잡이를 모두 입체로 만들었다."},{"sourceId":"p26","name":"청동 연방패","englishName":"BRONZE KITE SHIELD","type":"방어","category":"방어","role":"길쭉한 방패","description":"위쪽은 넓고 아래는 뾰족한 방패다. 겹친 청동 테두리와 중앙의 새 문장으로 왕성 장비군과 연결했다."},{"sourceId":"p27","name":"철두 귀면곤봉","englishName":"IRON ONI CLUB","type":"둔기","category":"둔기","role":"긴 곤봉","description":"넓어지는 목재 몸체에 금속 돌기를 규칙적으로 배치했다. 끝의 두꺼운 철테와 붉은 손잡이가 거친 무게 중심을 드러낸다."},{"sourceId":"p28","name":"월영 사슬낫","englishName":"MOONSHADOW CHAIN SICKLE","type":"도검","category":"도검","role":"낫과 사슬추","description":"짧은 낫과 둥근 추를 긴 사슬로 연결한 장비다. 활처럼 굽은 날과 느슨하게 놓인 사슬이 다른 근접 무기와 다른 인상을 준다."},{"sourceId":"p29","name":"흑송 화승총","englishName":"BLACK PINE MATCHLOCK","type":"화승총","category":"화승총","role":"기본형 화승총","description":"검은 목재와 단조철을 조합한 긴 화승총이다. 외부 화승 끈, 금속 띠, 가죽 멜빵이 과거 장비군의 기술 상한을 보여준다."},{"sourceId":"p30","name":"학익 문양화승총","englishName":"CRANE CREST MATCHLOCK","type":"화승총","category":"화승총","role":"장식형 화승총","description":"붉은 칠과 상아색 문장으로 꾸민 화승총이다. 긴 총열의 기본 형태를 유지하면서 궁정 근위대용 외관으로 차별화했다."},{"sourceId":"p31","name":"성문 대형화승총","englishName":"GATEKEEPER HEAVY MATCHLOCK","type":"화승총","category":"화승총","role":"큰 화승총 콘셉트","description":"다른 화승총보다 굵고 무거워 보이는 성문 수비 장비다. 별도 받침대와 넓은 금속 띠로 대형 장비의 외형을 강조했다."},{"sourceId":"p32","name":"적동 단화승총","englishName":"COPPER SHORT MATCHLOCK","type":"화승총","category":"화승총","role":"짧은 화승총 콘셉트","description":"짧은 목재 총상과 청동 장식을 가진 화승총이다. 다른 점화 방식이나 현대식 부품 없이 길이와 장식만으로 휴대형 인상을 만들었다."}];
const freeze=o=>{Object.values(o).forEach(v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v))freeze(v);});return Object.freeze(o);};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mul=(v,s)=>v.map(n=>n*s);
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
// Original-source coordinates. Right grip is also the collision axis origin;
// hitZone/headCollider keep wooden hafts, chains and display props non-damaging.
const modelSettings={
 p01:{bloodEffect:'blade',scale:.29,right:[-1.04,0,0],tip:[2.1,0,0],hands:1,style:'sword',damage:[30,51],zone:[.19,1]},
 p02:{bloodEffect:'blade',scale:.30,right:[-1.09,0,0],tip:[1.96,.52,0],hands:1,style:'saber',damage:[29,49],zone:[.18,1]},
 p03:{bloodEffect:'blade',scale:.30,right:[-.84,0,0],tip:[1.55,.18,0],hands:2,dual:true,dualOffset:.4,dualZ:.12,dualAngle:.07,style:'dual',damage:[29,48],zone:[.21,1]},
 p04:{bloodEffect:'blade',scale:.36,right:[-.86,0,0],left:[-1.43,0,0],tip:[2.10,0,0],hands:2,style:'great',damage:[43,74],zone:[.14,1]},
 p05:{bloodEffect:'blade',scale:.33,right:[-.64,0,0],left:[-1.25,0,0],tip:[2.47,.52,0],hands:2,style:'saber',damage:[36,61],zone:[.14,1]},
 p06:{bloodEffect:'blade',scale:.30,right:[-.98,0,0],tip:[1.9,0,0],hands:1,style:'sword',damage:[33,55],zone:[.2,1]},
 p07:{bloodEffect:'blade',scale:.21,right:[-.69,0,0],tip:[1.18,0,0],hands:1,style:'dagger',damage:[20,34],zone:[.29,1]},
 p08:{bloodEffect:'blade',scale:.32,right:[-1.01,0,0],tip:[1.54,.25,0],hands:2,dual:true,dualOffset:.5,dualZ:.07,dualAngle:.05,style:'dual',damage:[31,52],zone:[.16,1]},
 p09:{bloodEffect:'blade',scale:.26,right:[-.96,.035,0],tip:[1.48,.45,0],hands:1,style:'knife',damage:[27,46],zone:[.26,1]},
 p10:{scale:.22,right:[0,-.75,.01],tip:[0,.95,.01],hands:1,style:'fan',damage:[22,36],zone:[.5,1],head:{base:[-1.4,.12,0],tip:[1.4,.12,0],radius:.22}},
 p11:{scale:.58,right:[-.65,0,0],left:[0,0,0],tip:[1.93,0,0],hands:2,style:'spear',damage:[37,65],zone:[.61,1]},
 p12:{scale:.55,right:[-.6,0,0],left:[.05,0,0],tip:[2.13,.7,0],hands:2,style:'poleaxe',damage:[45,76],zone:[.45,1],head:{base:[1.1,.05,0],tip:[1.97,.4,0],radius:.15}},
 p13:{scale:.56,right:[-.65,0,0],left:[0,0,0],tip:[1.97,0,0],hands:2,style:'poleaxe',damage:[43,74],zone:[.59,1],head:{base:[1.2,-.5,0],tip:[1.2,.62,0],radius:.13}},
 p14:{scale:.56,right:[-.65,0,0],left:[0,0,0],tip:[2.11,0,0],hands:2,style:'spear',damage:[39,67],zone:[.58,1]},
 p15:{scale:.53,right:[-.6,0,0],left:[.02,0,0],tip:[2.18,.58,0],hands:2,style:'poleblade',damage:[39,66],zone:[.41,1]},
 p16:{scale:.57,right:[-.65,0,0],left:[0,0,0],tip:[2.02,0,0],hands:2,style:'poleaxe',damage:[46,79],zone:[.57,1],head:{base:[1.2,-.72,0],tip:[1.2,.72,0],radius:.12}},
 p17:{scale:.33,right:[-.97,0,0],tip:[1.65,.6,0],hands:1,style:'axe',damage:[36,62],zone:[.59,1],head:{base:[1.05,.75,0],tip:[1.6,.54,0],radius:.12}},
 p18:{scale:.34,right:[-.91,0,0],tip:[1.57,0,0],hands:1,style:'mace',damage:[39,67],zone:[.59,1],head:{base:[.72,0,0],tip:[1.3,0,0],radius:.42}},
 p19:{scale:.33,right:[-1.27,0,0],tip:[1.55,-.11,0],hands:1,style:'flail',damage:[37,65],zone:[.9,1],head:{base:[1.52,-.11,0],tip:[1.58,-.11,0],radius:.34}},
 p20:{scale:.35,right:[-.71,0,0],left:[-1.22,0,0],tip:[.87,.18,0],hands:2,style:'hammer',damage:[47,82],zone:[.7,1],head:{base:[.87,-.5,0],tip:[.87,.54,0],radius:.24}},
 p21:{scale:.50,right:[.08,.02,.09],left:[-.51,0,0],muzzle:[1.34,.02,.09],kind:'bow'},
 p22:{scale:.48,right:[.32,0,.11],left:[-.52,0,0],muzzle:[1.34,0,.11],kind:'bow'},
 p23:{scale:.36,right:[-.80,-.20,0],left:[.45,-.1,0],muzzle:[1.59,.19,0],kind:'crossbow'},
 p24:{scale:.38,right:[-1.00,-.25,0],left:[.38,-.16,0],muzzle:[1.56,.29,0],kind:'crossbow'},
 p25:{scale:.42,kind:'shield',maxDurability:240,width:.923,height:.923,shape:'round'},
 p26:{scale:.50,kind:'shield',maxDurability:320,width:.88,height:1.28,shape:'kite'},
 p27:{scale:.40,right:[-.54,0,0],left:[-1.12,0,0],tip:[1.68,0,0],hands:2,style:'club',damage:[44,77],zone:[.22,1],head:{base:[.1,0,0],tip:[1.56,0,0],radius:.28}},
 p28:{bloodEffect:'blade',scale:.30,right:[-1.03,0,0],tip:[.27,.85,0],hands:1,style:'sickle',damage:[32,55],zone:[.5,1],head:{base:[-1.05,.82,0],tip:[.1,.75,0],radius:.09}},
 p29:{scale:.35,right:[-.80,-.22,0],left:[.35,-.1,0],muzzle:[2.056,.16,0],kind:'matchlock'},
 p30:{scale:.35,right:[-.80,-.22,0],left:[.35,-.1,0],muzzle:[2.056,.16,0],kind:'matchlock'},
 p31:{scale:.37,right:[-.80,-.22,0],left:[.40,-.1,0],muzzle:[2.176,.16,0],kind:'matchlock'},
 p32:{scale:.34,right:[-.80,-.22,0],left:[.20,-.1,0],muzzle:[1.336,.16,0],kind:'matchlock'}
};
// damage, cycle, reload, metres/second, maximum metres, hip/aim radians,
// gravity metres/second². Each ranged weapon uses one loaded projectile.
const rangedStats={
 p21:[42,.75,1.15,52,80,.011,.0035,9.8,.032],p22:[36,.65,.95,46,65,.014,.0045,9.8,.026],
 p23:[58,1,1.85,76,105,.008,.0025,9.8,.045],p24:[74,1.2,2.5,86,125,.007,.002,9.8,.065],
 p29:[78,1,3.5,185,150,.023,.009,3,.095],p30:[84,1,3.7,195,165,.018,.007,3,.10],
 p31:[108,1.3,4.5,220,185,.016,.006,3,.15],p32:[65,.85,2.8,160,100,.032,.013,3,.075]
};
const catalog=freeze(SOURCE_CATALOG.map(source=>{
 const s=modelSettings[source.sourceId],kind=s.kind||'melee',initialReserve=kind==='bow'?20:kind==='crossbow'?16:kind==='matchlock'?10:0;
 return {...source,id:'past_'+source.sourceId,kind,scale:s.scale,hands:s.hands||((kind==='shield')?1:2),initialReserve,
   ...(s.bloodEffect?{bloodEffect:s.bloodEffect}:{}),
   ...(kind==='shield'?{maxDurability:s.maxDurability,width:s.width,height:s.height,shieldShape:s.shape}:{}),
   groundRotation:kind==='crossbow'||kind==='matchlock'?[0,0,0]:[Math.PI/2,0,0]};
}));
const byId=freeze(Object.fromEntries(catalog.map(w=>[w.id,w])));
const get=id=>typeof id==='string'&&own(byId,id)?byId[id]:null;
function dualPoint(point,s,side){const a=side*s.dualAngle,c=Math.cos(a),n=Math.sin(a);return [(point[0]*c-point[1]*n)*s.scale,(point[0]*n+point[1]*c+side*s.dualOffset)*s.scale,(point[2]+side*s.dualZ)*s.scale];}
const modelAxes={},meleeDefinitions={};
const styles={
 sword:['slash','thrust',.16,.23,.27,.30,.2,.40,1.92,.14,16,29,.90],
 saber:['diagonal','diagonal',.13,.20,.29,.32,.20,.46,1.95,1.75,17,32,.85],
 dual:['slash','diagonal',.14,.21,.26,.30,.23,.38,2.0,1.8,16,29,.81],
 great:['slash','overhead',.25,.28,.40,.47,.25,.56,2.15,.5,24,42,.93],
 dagger:['thrust','thrust',.09,.14,.18,.23,.16,.28,.3,.12,10,21,.69],
 knife:['slash','diagonal',.13,.19,.24,.28,.21,.35,1.9,1.5,14,26,.78],
 fan:['slash','diagonal',.11,.18,.23,.25,.2,.33,1.6,1.6,12,23,.79],
 spear:['thrust','thrust',.20,.20,.35,.40,.23,.48,.10,.12,21,36,.84],
 poleaxe:['diagonal','overhead',.29,.25,.43,.5,.27,.58,1.65,.35,28,44,.89],
 poleblade:['slash','diagonal',.23,.25,.37,.42,.24,.50,1.9,1.65,24,39,.86],
 axe:['diagonal','overhead',.24,.23,.35,.41,.25,.48,1.6,.35,22,37,.79],
 mace:['diagonal','overhead',.26,.22,.40,.46,.24,.53,1.6,.35,24,40,.85],
 flail:['diagonal','overhead',.30,.25,.42,.49,.26,.56,1.7,.35,25,41,.64],
 hammer:['diagonal','overhead',.32,.23,.46,.55,.26,.65,1.6,.3,27,45,.90],
 club:['slash','overhead',.30,.28,.44,.52,.28,.61,1.9,.35,27,43,.87],
 sickle:['slash','diagonal',.19,.22,.30,.34,.23,.42,1.9,1.6,18,31,.70]
};
// Only explicitly authored sword/knife/sickle profiles get the blade HP buff.
// The metal war fan (p10), polearms, blunt weapons and ranged weapons keep their
// existing balance; guard/poise calculations still use the original damage.
function attack(shape,damage,stamina,windup,active,recovery,arc,heavy,impact,bloodEffect){return {shape,damage:bloodEffect==='blade'?Math.round(damage*1.5):damage,stamina,windup,active,recovery,arc,guardDamage:Math.round(damage*(impact?1.02:.74)),poiseDamage:damage*(impact?.9:.52),maxTargets:shape==='thrust'?1:heavy?2:3,hitstop:impact?.075:.045};}
for(const w of catalog){
 const s=modelSettings[w.sourceId];if(w.kind!=='melee')continue;
 const base=s.dual?dualPoint(s.right,s,-1):mul(s.right,s.scale),tip=s.dual?dualPoint(s.tip,s,-1):mul(s.tip,s.scale);
 const left=s.left?mul(s.left,s.scale):null,bladeLength=distance(base,tip),v=styles[s.style],impact=['axe','mace','flail','hammer','club'].includes(s.style);
 modelAxes[w.id]={bladeBase:base,bladeTip:tip,rightGrip:base,leftGrip:left,twist:0,twoHanded:s.hands===2,dualWield:!!s.dual,
   ...(s.dual?{secondary:{bladeBase:dualPoint(s.right,s,1),bladeTip:dualPoint(s.tip,s,1)}}:{})};
 meleeDefinitions[w.id]={id:w.id,name:w.name,englishName:w.englishName,hands:s.hands,dualWield:!!s.dual,
   ...(s.bloodEffect?{bloodEffect:s.bloodEffect}:{}),
   bladeLength,armReach:.52,reach:bladeLength+.52,bladeRadius:impact?.085:s.style==='fan'?.075:.045,
   gripOffset:0,supportSpacing:left?-left.map((n,i)=>n-base[i]).reduce((total,n,i)=>total+n*(tip[i]-base[i]),0)/bladeLength:0,
   hitZone:s.zone,block:v[12],blockArc:s.hands===2?145:125,parryWindow:impact?.12:s.style==='dagger'?.14:.16,poise:impact?48:s.hands===2?35:23,
   comboMultipliers:[1,1.06,1.25],cleaveDecay:impact?.8:.86,tier:s.hands===2?3:2,color:'#c3ae83',moveMult:s.hands===2&&!s.dual?.95:1,
   light:attack(v[0],s.damage[0],v[10],v[2],v[3],v[4],v[8],false,impact,s.bloodEffect),heavy:attack(v[1],s.damage[1],v[11],v[5],v[6],v[7],v[9],true,impact,s.bloodEffect),
   ...(s.head?{headCollider:{base:mul(s.head.base,s.scale),tip:mul(s.head.tip,s.scale),radius:s.head.radius*s.scale}}:{})};
}
freeze(modelAxes);freeze(meleeDefinitions);
if(!melee||typeof melee.registerWeapons!=='function')throw new Error('Load g-melee.js before g-past-arsenal.js');
melee.registerWeapons(meleeDefinitions,modelAxes);
const nativeWeaponDefinitions=freeze(Object.fromEntries(catalog.map(w=>{
 const common={name:w.name,pastKind:w.kind,initialReserve:w.initialReserve,color:'#c3ae83',tier:w.kind==='shield'?2:3};
 if(w.kind==='melee')return [w.id,{...melee.nativeWeaponDefinitions[w.id],...common}];
 if(w.kind==='shield')return [w.id,{...common,dmg:0,damage:0,rate:0,mag:0,spread:0,ads:0,speed:0,range:0,reload:0,kick:0,len:w.height,zoom:1,melee:false,equipment:true,shield:true,maxDurability:w.maxDurability,width:w.width,height:w.height}];
 const [damage,rate,reload,speed,range,spread,aimSpread,projectileGravity,recoil]=rangedStats[w.sourceId];
 return [w.id,{...common,dmg:damage,damage,rate,reload,speed,range,spread,ads:aimSpread,aimSpread,kick:recoil,recoil,projectileGravity,
   mag:1,pellets:1,melee:false,pastRanged:true,len:w.kind==='bow'?.65:1.1,zoom:w.kind==='matchlock'?1.6:1.35,
   moveMult:w.sourceId==='p31'?.88:w.sourceId==='p24'?.92:1,ammoLabel:w.kind==='bow'?'화살':w.kind==='crossbow'?'쇠뇌살':'화승탄'}];
})));
function rangedLayout(id){
 const w=get(id);if(!w||!['bow','crossbow','matchlock'].includes(w.kind))return null;
 const s=modelSettings[w.sourceId],rightGrip=mul(s.right,s.scale),leftGrip=mul(s.left,s.scale),muzzle=mul(s.muzzle,s.scale);
 if(w.kind==='bow'){
  // On the original display the string is ahead of the handle. Turn only the
  // held bow body so the supporting hand is ahead of the drawing hand. Keep
  // the separately authored arrow pointing along the game's +X forward axis.
  rightGrip[0]*=-1;leftGrip[0]*=-1;
  const arrowTail=(w.sourceId==='p21'?-.5:-.65)*s.scale;
  muzzle[0]+=rightGrip[0]-arrowTail;
 }
 return {rightGrip,leftGrip,muzzle};
}

function originalMaterials(T){
  'use strict';
  const H = {catalog: []};
  H.materials = Object.create(null);
  const M = H.materials;
  const clamp = (v, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, v));
  function hash(x, y, seed) {
    let n = Math.imul(x + 37, 374761393) ^ Math.imul(y + 19, 668265263) ^ Math.imul(seed, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  function canvasPixels(size, fn) {
    const data = new Uint8Array(size * size * 4);
    for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const rgb=fn(x,y,size),i=(y*size+x)*4;
      data[i]=clamp(rgb[0]);data[i+1]=clamp(rgb[1]);data[i+2]=clamp(rgb[2]);data[i+3]=255;
    }
    return {data,width:size,height:size};
  }
  function tex(canvas,color){
    const t=new T.DataTexture(canvas.data,canvas.width,canvas.height,T.RGBAFormat);
    t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;t.flipY=true;
    t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;
    if(color)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;
  }
  function mono(size, fn) { return canvasPixels(size, (x, y, s) => { const n = fn(x, y, s); return [n, n, n]; }); }
  const metalHeightCanvas = mono(256, (x, y) => {
    const grain = (hash(x, y, 17) - .5) * 12;
    const stroke = Math.sin(y * 1.67) * 4 + Math.sin(y * .41 + Math.sin(x * .028) * .55) * 3;
    return 146 + grain + stroke;
  });
  const metalHeight = tex(metalHeightCanvas, false);
  const metalRoughness = tex(mono(256, (x, y) => 168 + (hash(x, y, 8) - .5) * 18 + Math.sin(y * .69) * 4), false);
  const brushedColor = tex(canvasPixels(256, (x, y) => {
    const n = (hash(x, y, 29) - .5) * 7 + Math.sin(y * 1.67) * 2;
    return [237 + n, 239 + n, 241 + n];
  }), true);

  function woodCanvas(dark) {
    return canvasPixels(512, (x, y, s) => {
      const yy = y / s, xx = x / s;
      const warp = Math.sin(xx * Math.PI * 2) * 6 + Math.sin(xx * Math.PI * 4 + .8) * 2.7;
      const grain = Math.sin(yy * Math.PI * 72 + warp) * .55 + Math.sin(yy * Math.PI * 166 + warp * 1.7) * .25;
      const knot = Math.sin(Math.hypot((xx - .73) * .46, (yy - .38) * 2.1) * 115) * Math.exp(-Math.pow((xx - .73) / .18, 2) - Math.pow((yy - .38) / .13, 2)) * .8;
      const fine = (hash(x, y, 53) - .5) * 4;
      const v = grain * 12 + knot * 9 + fine;
      const broad = Math.sin(yy * Math.PI * 8 + warp * .2) * 5;
      return dark ? [58 + v * .55 + broad, 35 + v * .38 + broad * .6, 24 + v * .25 + broad * .3] : [111 + v + broad, 67 + v * .65 + broad * .7, 37 + v * .36 + broad * .4];
    });
  }
  const woodColor = tex(woodCanvas(false), true), woodDarkColor = tex(woodCanvas(true), true);
  const woodHeight = tex(mono(512, (x, y, s) => {
    const warp = Math.sin(x / s * Math.PI * 2) * 6 + Math.sin(x / s * Math.PI * 4 + .8) * 2.7;
    return 130 + Math.sin(y / s * Math.PI * 72 + warp) * 14 + Math.sin(y / s * Math.PI * 166 + warp * 1.7) * 5 + (hash(x, y, 53) - .5) * 9;
  }), false);
  const leatherHeight = tex(mono(256, (x, y) => {
    const a = hash(x, y, 89), b = hash(x >> 1, y >> 1, 67);
    const pore = a > .963 ? -55 : 0;
    return 148 + (a - .5) * 28 + (b - .5) * 18 + pore;
  }), false);
  const leatherRoughness = tex(mono(256, (x, y) => 189 + (hash(x, y, 43) - .5) * 24), false);
  const weaveHeight = tex(mono(256, (x, y) => {
    const horizontal = (y % 8 < 4), vertical = (x % 8 < 4);
    return 135 + (horizontal !== vertical ? 25 : -19) + (hash(x, y, 73) - .5) * 8;
  }), false);
  const carbonColor = tex(canvasPixels(256, (x, y) => {
    const xx = x % 16, yy = y % 16;
    const over = ((Math.floor(x / 16) + Math.floor(y / 16)) & 1) === 0;
    const line = over ? Math.sin(xx / 15 * Math.PI) : Math.sin(yy / 15 * Math.PI);
    const v = 39 + line * 18 + (hash(x, y, 101) - .5) * 3;
    return [v, v + 3, v + 7];
  }), true);
  const ceramicHeight = tex(mono(256, (x, y) => 129 + (hash(x, y, 107) - .5) * 9), false);

  function standard(name, props) {
    const mat = new T.MeshStandardMaterial(Object.assign({ roughness: .45, metalness: .1, envMapIntensity: 1.1 }, props));
    mat.name = 'HanQ_' + name; M[name] = mat; return mat;
  }
  function metal(name, color, roughness, metalness = .9) {
    return standard(name, { color, metalness, roughness, map: brushedColor, bumpMap: metalHeight, bumpScale: .0026, roughnessMap: metalRoughness });
  }
  metal('steel', '#9ca9b5', .48, .88);
  metal('bright', '#d0dce4', .3, .96);
  metal('darksteel', '#46525d', .57, .88);
  metal('edge', '#e2e7eb', .23, .96);
  metal('gold', '#bf9a4d', .36, .86);
  metal('brass', '#a7874f', .47, .87);
  metal('copper', '#b57654', .42, .86);
  standard('wood', { color: '#ffffff', map: woodColor, bumpMap: woodHeight, bumpScale: .009, roughness: .54, metalness: .02 });
  standard('woodDark', { color: '#ffffff', map: woodDarkColor, bumpMap: woodHeight, bumpScale: .008, roughness: .57, metalness: .025 });
  M.lacquer = new T.MeshPhysicalMaterial({ name: 'HanQ_lacquer', color: '#671e25', metalness: .15, roughness: .28, clearcoat: .62, clearcoatRoughness: .25, bumpMap: woodHeight, bumpScale: .0015, envMapIntensity: 1.1 });
  standard('leather', { color: '#75503a', roughness: .89, roughnessMap: leatherRoughness, bumpMap: leatherHeight, bumpScale: .008, metalness: .015 });
  standard('leatherDark', { color: '#292b2a', roughness: .85, roughnessMap: leatherRoughness, bumpMap: leatherHeight, bumpScale: .008, metalness: .01 });
  standard('cloth', { color: '#a99c77', roughness: .95, bumpMap: weaveHeight, bumpScale: .005, metalness: 0 });
  standard('ivory', { color: '#d8cbb1', roughness: .45, bumpMap: ceramicHeight, bumpScale: .002, metalness: .02 });
  standard('black', { color: '#182129', roughness: .56, bumpMap: ceramicHeight, bumpScale: .002, metalness: .4 });
  standard('panel', { color: '#465365', roughness: .44, bumpMap: ceramicHeight, bumpScale: .002, metalness: .55 });
  standard('white', { color: '#cbd3d4', roughness: .34, bumpMap: ceramicHeight, bumpScale: .0012, metalness: .18 });
  standard('carbon', { color: '#ffffff', map: carbonColor, roughness: .38, bumpMap: weaveHeight, bumpScale: .004, metalness: .35 });
  standard('glass', { color: '#8cdddf', roughness: .2, metalness: 0, opacity: .32, transparent: true, depthWrite: false, side: T.DoubleSide });
  const glows = new Map();
  H.glow = function (hex) {
    const c = new T.Color(hex), key = c.getHexString();
    if (glows.has(key)) return glows.get(key);
    const mat = new T.MeshStandardMaterial({ name: 'HanQ_glow_' + key, color: c.clone().multiplyScalar(.24), emissive: c, emissiveIntensity: 1.4, roughness: .29, metalness: .15, toneMapped: false });
    glows.set(key, mat); return mat;
  };
  M.amber = H.glow('#ffc56a');
  M.cyan = H.glow('#72e9f2');
  M.purple = H.glow('#b09aff');
  M.redglow = H.glow('#ff705b');
  H.mat = function (nameOrMaterial) {
    if (nameOrMaterial && nameOrMaterial.isMaterial) return nameOrMaterial;
    if (typeof nameOrMaterial === 'string' && Object.prototype.hasOwnProperty.call(M, nameOrMaterial)) return M[nameOrMaterial];
    throw new Error('Unknown Armory material: ' + String(nameOrMaterial));
  };
  H.surfaceTextures = { metalHeight, metalRoughness, brushedColor, woodColor, woodDarkColor, woodHeight, leatherHeight, leatherRoughness, weaveHeight, carbonColor, ceramicHeight };

return H;
}

function originalGeometry(T,H){
const material=m=>H.mat(m||'steel');
function put(g,geo,m,x=0,y=0,z=0){const o=new T.Mesh(geo,material(m));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
H.box=function(g,w,h,d,x=0,y=0,z=0,m='steel',b=.025){
 b=Math.max(0,Math.min(b,w*.2,h*.2,d*.2));
 if(b<.002)return put(g,new T.BoxGeometry(w,h,d),m,x,y,z);
 const sh=new T.Shape(),a=w/2-b,c=h/2-b;
 sh.moveTo(-a,-c);sh.lineTo(a,-c);sh.lineTo(a,c);sh.lineTo(-a,c);sh.closePath();
 const geo=new T.ExtrudeGeometry(sh,{depth:d-2*b,steps:1,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:1});
 geo.translate(0,0,-(d-2*b)/2);return put(g,geo,m,x,y,z);
};
H.cyl=function(g,rt,rb,len,x=0,y=0,z=0,m='steel',axis='y',seg=24){const o=put(g,new T.CylinderGeometry(rt,rb,len,Math.min(seg,24),1,false),m,x,y,z);if(axis==='x')o.rotation.z=-Math.PI/2;else if(axis==='z')o.rotation.x=Math.PI/2;return o;};
H.ball=function(g,r,x=0,y=0,z=0,m='steel',sx=1,sy=1,sz=1){const o=put(g,new T.SphereGeometry(r,16,10),m,x,y,z);o.scale.set(sx,sy,sz);return o;};
H.torus=function(g,r,t,x=0,y=0,z=0,m='steel',axis='z',arc=Math.PI*2){const o=put(g,new T.TorusGeometry(r,t,6,32,arc),m,x,y,z);if(axis==='x')o.rotation.y=Math.PI/2;else if(axis==='y')o.rotation.x=Math.PI/2;return o;};
H.rod=function(g,a,b,r,m='steel',segments=12){const av=new T.Vector3(...a),bv=new T.Vector3(...b),dv=bv.clone().sub(av);const len=dv.length();if(len<1e-6)return H.ball(g,r,...a,m);const o=put(g,new T.CylinderGeometry(r,r,len,segments,1),m);o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dv.normalize());return o;};
H.tube=function(g,pts,r,m='steel',segments=48,radial=8){const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));return put(g,new T.TubeGeometry(curve,Math.min(segments,96),r,Math.min(radial,7),false),m);};
H.plate=function(g,pts,d,m='steel',z=0,b=.012){const sh=new T.Shape();pts.forEach((p,i)=>i?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]));sh.closePath();b=Math.max(0,Math.min(b,d*.24));const geo=new T.ExtrudeGeometry(sh,{depth:d-2*b,steps:1,bevelEnabled:b>.001,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:2});geo.translate(0,0,z-(d-2*b)/2);return put(g,geo,m);};
H.lathe=function(g,pts,m='steel',x=0,y=0,z=0){return put(g,new T.LatheGeometry(pts.map(p=>new T.Vector2(...p)),32),m,x,y,z);};
H.part=function(g,name){const p=new T.Group();p.name=name||'part';g.add(p);return p;};

}

function originalPastBuilders(T,H){
const TAU=Math.PI*2;
const P=(g,p,d,m='steel',z=0,b=.012)=>H.plate(g,p,d,m,z,b);
function spec(id,name,en,type,role,desc,features,palette,build){H.catalog.push({id,era:'past',name,en,type,role,desc,features,palette,build});}
function line(g,pts,m='gold',r=.008){return H.tube(g,pts,r,m,Math.max(24,pts.length*8),6);}
function studs(g,positions,r=.023,m='brass'){positions.forEach(p=>H.ball(g,r,p[0],p[1],p[2],m,1,1,.52));}
function blade(g,sections,thick=.085){
 const rings=sections.map(([x,y,w])=>[[x,y+w,0],[x,y,thick/2],[x,y-w,0],[x,y,-thick/2]]),faces=[[],[]];
 const tri=(bucket,a,b,c)=>faces[bucket].push(...a,...b,...c);
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<4;j++){
  const a=rings[i][j],b=rings[i][(j+1)%4],c=rings[i+1][j],d=rings[i+1][(j+1)%4];
  tri(j%2,a,b,c);tri(j%2,b,d,c);
 }
 const first=rings[0],last=rings[rings.length-1];
 tri(1,first[0],first[3],first[2]);tri(1,first[0],first[2],first[1]);
 tri(1,last[0],last[1],last[2]);tri(1,last[0],last[2],last[3]);
 const out=new T.Group();g.add(out);
 faces.forEach((verts,i)=>{const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.computeVertexNormals();const mesh=new T.Mesh(geo,H.mat(i?'steel':'bright'));mesh.castShadow=true;mesh.receiveShadow=true;out.add(mesh);});
 return out;
}
function grip(g,a,b,r=.10,material='leather',n=11){
 H.cyl(g,r*.96,r*.96,b-a,(a+b)/2,0,0,'woodDark','x');
 const pts=[];for(let i=0;i<=n*14;i++){const t=i/(n*14),ang=t*n*TAU;pts.push([a+(b-a)*t,Math.sin(ang)*r,Math.cos(ang)*r]);}H.tube(g,pts,r*.17,material,n*18,7);
 for(const x of [a,b]){H.cyl(g,r*1.14,r*1.14,.065,x,0,0,'brass','x');H.torus(g,r*1.13,.012,x,0,0,'gold','x');}
}
function haft(g,a,b,r=.055,material='wood',bands=7){
 H.cyl(g,r,r,b-a,(a+b)/2,0,0,material,'x');
 for(let i=0;i<=bands;i++){const x=a+(b-a)*i/bands;H.cyl(g,r*1.16,r*1.16,.055,x,0,0,i===0||i===bands?'brass':'darksteel','x');}
 for(let i=0;i<3;i++)H.cyl(g,r*1.09,r*1.09,.10,a+.25+i*.12,0,0,'leatherDark','x');
}
function tassel(g,x,y,z,color='lacquer',len=.5){
 line(g,[[x,y,z],[x+.03,y-.10,z+.015],[x-.025,y-.16,z+.015]],'cloth',.012);
 H.ball(g,.045,x-.025,y-.18,z+.015,'brass');
 for(let i=0;i<10;i++){const u=(i-4.5)*.011;line(g,[[x+u,y-.2,z],[x+u+.04,y-.2-len*.55,z+.01],[x+u+.01+Math.sin(i)*.022,y-.2-len,z+(i%3)*.012]],color,.011);}
}
function guard(g,x,w=.55,style='gold'){
 H.box(g,.12,w,.18,x,0,0,style,.025);
 H.ball(g,.07,x,w/2,0,style,1.25,1,.95);H.ball(g,.07,x,-w/2,0,style,1.25,1,.95);
 H.cyl(g,.13,.13,.09,x+.10,0,0,'darksteel','x');
}
function ringPommel(g,x,r=.18){H.torus(g,r,.045,x,0,0,'brass');H.torus(g,r*.71,.012,x,0,.046,'gold');}
function fuller(g,s,z=.047,mat='gold'){line(g,s.map(p=>[p[0],p[1],z]),mat,.010);}
function collar(g,x,r=.09){H.cyl(g,r,r,.16,x,0,0,'brass','x');for(let i=-1;i<=1;i++)H.torus(g,r,.009,x+i*.045,0,0,'gold','x');}
function arrow(g,x,y,z,len=1.6){g=H.part(g,'화살');H.rod(g,[x,y,z],[x+len,y,z],.016,'woodDark');const q=H.part(g,'촉');q.position.set(x+len,y,z);blade(q,[[0,0,.07],[.19,0,0]],.035);for(let s of [-1,1])P(g,[[x+.08,y],[x+.28,y+s*.09],[x+.42,y+s*.09],[x+.36,y]],.012,'cloth',z);}
function bowLimb(g,points,r=.055){line(g,points,'woodDark',r);line(g,points.map(p=>[p[0]+.012,p[1],p[2]+r*.64]),'ivory',r*.18);}
function coin(g,x,y,z,r=.07){H.cyl(g,r,r,.018,x,y,z,'brass','z',16);H.torus(g,r*.8,.007,x,y,z+.012,'gold');}
function scroll(g,x,y,z,s=.15){line(g,[[x-s,y-s*.3,z],[x-s*.4,y+s*.5,z],[x+s*.4,y+s*.5,z],[x+s*.7,y,z],[x+s*.2,y-s*.25,z],[x,y,z]],'gold',.006);}
// Blades of the fortress.
spec('p01','환두 · 성루의 검','RING OF THE KEEP','도검','균형 잡힌 한손검','고성 성루 수비대의 상징을 새긴 환두검. 열린 고리 장식과 청동 띠가 검의 무게감을 시각적으로 구분한다.',['마름모 단면 칼날','동심원 환두','붉은 매듭 장식'],['단조강','청동','적색 끈'],()=>{
 const g=new T.Group();blade(g,[[-.45,0,.15],[.35,0,.14],[1.65,0,.095],[2.1,0,0]],.105);grip(g,-1.45,-.63,.11);guard(g,-.54,.54,'brass');ringPommel(g,-1.69,.19);fuller(g,[[-.25,0],[1.52,0]],.058);for(let x=-.12;x<1.5;x+=.28)scroll(g,x,0,.06,.06);tassel(g,-1.7,-.17,0);return g;
});
spec('p02','흑송 환도','BLACK PINE SABER','도검','기동형 곡도','흑송으로 만든 칼자루에 검은 가죽을 감은 곡도. 칼등에서 끝으로 이어지는 유연한 곡선이 숲길 정찰대의 장비를 떠올리게 한다.',['완만한 곡선 칼날','타원형 손막이','가죽 칼집 동봉'],['흑강','흑송','황동'],()=>{
 const g=new T.Group();blade(g,[[-.55,0,.12],[.1,.015,.13],[.8,.10,.14],[1.45,.26,.12],[1.96,.52,0]],.08);grip(g,-1.47,-.71,.095,'leatherDark',13);const t=H.torus(g,.22,.038,-.61,0,0,'darksteel','x');t.scale.y=.73;collar(g,-.50,.10);H.ball(g,.12,-1.56,0,0,'brass',.65,1,1);fuller(g,[[-.3,.04],[.5,.09],[1.2,.22],[1.65,.4]],.044,'darksteel');const s=H.part(g,'칼집');s.position.set(.02,-.49,-.15);s.rotation.z=-.04;line(s,[[-1.52,0,0],[-.4,.02,0],[.8,.1,0],[1.65,.32,0]],'woodDark',.105);for(const x of [-1.32,-.65,.72])H.cyl(s,.119,.119,.075,x,x>.5?.09:0,0,'brass','x');tassel(g,-1.5,-.08,.06,'cloth',.4);return g;
});
spec('p03','쌍월 유엽도','TWIN WILLOW BLADES','도검','쌍수 근접검','잎 모양의 넓은 칼날 두 자루를 한 쌍으로 구성했다. 짧은 손막이와 비대칭 붉은 매듭으로 두 검의 방향을 쉽게 읽을 수 있다.',['쌍수 전시','유엽형 칼날','각기 다른 매듭'],['강철','붉은 가죽','황동'],()=>{
 const g=new T.Group();for(let s of [-1,1]){const q=H.part(g,'유엽도');q.position.set(0,s*.40,s*.12);q.rotation.z=s*.07;blade(q,[[-.35,0,.12],[.25,.015,.23],[.9,.07,.24],[1.55,.18,0]],.08);grip(q,-1.18,-.5,.095,s<0?'leather':'lacquer',10);guard(q,-.42,.36,'brass');H.ball(q,.115,-1.27,0,0,'brass',1.2,.8,.8);fuller(q,[[-.2,.02],[.45,.065],[1.05,.12]],.045);tassel(q,-1.3,-.04,0,s<0?'lacquer':'cloth',.26);}return g;
});
spec('p04','철조 파수대검','RAVEN WATCH GREATSWORD','도검','양손 중검','큰 손막이와 긴 자루를 가진 철조 파수대의 대검. 칼날의 넓은 중앙 능선과 검은 홈이 묵직한 정면 인상을 만든다.',['긴 양손 자루','갈고리형 손막이','넓은 능선'],['먹빛 강철','은빛 날','암갈색 가죽'],()=>{
 const g=new T.Group();blade(g,[[-.45,0,.2],[.1,0,.2],[1.45,0,.16],[2.10,0,0]],.12);grip(g,-1.7,-.66,.11,'leatherDark',17);P(g,[[-.65,-.09],[-.62,-.56],[-.45,-.66],[-.47,-.37],[-.36,-.15],[-.36,.15],[-.47,.37],[-.45,.66],[-.62,.56],[-.65,.09]],.17,'darksteel');for(let s of [-1,1])H.ball(g,.065,-.49,s*.56,.05,'brass');H.ball(g,.19,-1.90,0,0,'darksteel',.75,1,1);coin(g,-1.91,0,.18,.1);fuller(g,[[-.27,0],[1.5,0]],.065,'darksteel');for(let x=-.2;x<1.2;x+=.23)line(g,[[x,-.04,.066],[x+.07,0,.067],[x,.04,.066]],'gold',.006);return g;
});
spec('p05','적사 장도','RED SAND LONGSWORD','도검','긴 양손 곡도','붉은 사막 관문에서 쓰이는 긴 곡도라는 설정이다. 긴 붉은 손잡이와 절제된 원형 손막이가 날의 길이를 강조한다.',['긴 곡선 실루엣','적색 감김 자루','청동 끝장식'],['철','적색 가죽','청동'],()=>{
 const g=new T.Group();blade(g,[[-.20,0,.11],[.55,.03,.12],[1.30,.14,.12],[2.0,.31,.09],[2.47,.52,0]],.09);grip(g,-1.65,-.41,.10,'lacquer',18);H.cyl(g,.25,.25,.07,-.31,0,0,'darksteel','x',40);H.torus(g,.22,.017,-.355,0,0,'brass','x');collar(g,-.17,.11);for(let x=-1.45;x<-.45;x+=.22)H.box(g,.07,.10,.015,x,0,.105,'ivory',.009);H.ball(g,.12,-1.77,0,0,'brass',.75,1,1);fuller(g,[[.1,.02],[.85,.09],[1.7,.27],[2.15,.42]],.049,'darksteel');tassel(g,-1.77,-.06,-.04,'lacquer',.32);return g;
});
spec('p06','왕성 문장검','CITADEL CREST SWORD','도검','의장 겸 근접검','왕성의 마지막 수문장이 남긴 장검이라는 콘셉트다. 날개 모양 손막이와 중앙 문장판에 장식의 밀도를 집중했다.',['날개형 손막이','겹친 문장판','상아색 손잡이'],['담금질강','황동','상아색 장식'],()=>{
 const g=new T.Group();blade(g,[[-.42,0,.17],[.25,0,.16],[1.4,0,.14],[1.9,0,0]],.1);grip(g,-1.36,-.61,.10,'ivory',12);for(let s of [-1,1])P(g,[[-.58,s*.03],[-.73,s*.32],[-.66,s*.6],[-.43,s*.48],[-.30,s*.18]],.14,'brass');P(g,[[-.73,0],[-.51,.22],[-.27,0],[-.51,-.22]],.16,'darksteel',.05);coin(g,-.51,0,.15,.10);H.ball(g,.08,-.51,0,.18,'copper',1,1,.45);H.ball(g,.15,-1.50,0,0,'brass');ringPommel(g,-1.67,.10);fuller(g,[[-.05,0],[1.35,0]],.055);for(let x=0;x<1.3;x+=.24)scroll(g,x,0,.058,.09);tassel(g,-1.73,-.07,0,'cloth',.25);return g;
});
// Compact weapons: varied silhouette, not scaled swords.
spec('p07','비취 장식비수','JADE COURT DAGGER','도검','짧은 보조검','비취빛 장식색을 쓴 궁정 비수. 넓은 잎 모양 칼날과 작은 금속 구슬이 가까이서 볼 수 있는 세부를 만든다.',['잎 모양 단검','세 겹 손막이','장식 칼집'],['강철','녹색 장식','황동'],()=>{
 const g=new T.Group();blade(g,[[-.15,0,.18],[.45,0,.27],[1.18,0,0]],.12);grip(g,-1.02,-.36,.125,'leather',9);guard(g,-.25,.58,'brass');H.torus(g,.16,.028,-.33,0,0,'copper','x');H.ball(g,.16,-1.19,0,0,'brass');H.ball(g,.11,-1.22,0,.11,'glass',1,1,.5);fuller(g,[[0,0],[.82,0]],.066);for(let x=.1;x<.7;x+=.18)scroll(g,x,0,.068,.08);const accessory=H.part(g,'전시 부속품');P(accessory,[[-1.25,-.55],[-1.16,-.41],[.7,-.42],[1,-.64],[.65,-.81],[-1.15,-.73]],.18,'woodDark',-.08);for(let x=-1.03;x<.7;x+=.4){coin(accessory,x,-.59,.02,.05);line(accessory,[[x,-.46,.025],[x+.15,-.59,.025],[x,-.72,.025]],'gold',.008);}return g;
});
spec('p08','흑연 쌍구검','SHADOW HOOK SWORDS','도검','걸기형 쌍검','끝을 안쪽으로 감은 갈고리검 두 자루. 초승달 모양 손막이와 뒤쪽 짧은 촉이 여러 방향의 실루엣을 만든다.',['쌍 갈고리 끝','반월 손막이','후미 보조 촉'],['흑철','은빛 날','검은 가죽'],()=>{
 const g=new T.Group();for(let s of [-1,1]){const q=H.part(g,'갈고리검');q.position.set(0,s*.5,s*.07);q.rotation.z=s*.05;blade(q,[[-.6,0,.065],[.75,0,.065],[1.3,.05,.09],[1.54,.25,.10],[1.42,.47,.09],[1.15,.46,0]],.07);grip(q,-1.30,-.72,.08,'leatherDark',9);P(q,[[-1.46,-.10],[-1.34,-.38],[-.92,-.52],[-.51,-.32],[-.43,-.1],[-.7,-.29],[-1.16,-.31]],.07,'steel');H.rod(q,[-1.32,-.06,0],[-1.34,-.25,0],.04,'brass');H.rod(q,[-.73,-.06,0],[-.64,-.22,0],.04,'brass');blade(q,[[-1.36,0,.09],[-1.73,0,0]],.07);for(let x=-1.2;x<-.7;x+=.15)H.cyl(q,.09,.09,.025,x,0,0,'brass','x');}return g;
});
spec('p09','현월 굽이도','CRESCENT PASS KNIFE','도검','곡선 단도','굽은 넓은 칼날과 뒤로 꺾인 손잡이를 조합했다. 산길 초소의 실용 장비라는 설정으로 장식을 줄이고 표면의 대비를 강조했다.',['안으로 굽은 날','각진 목재 자루','리벳과 가죽끈'],['탄소강','호두색 목재','암색 가죽'],()=>{
 const g=new T.Group();blade(g,[[-.35,.03,.15],[.15,-.11,.24],[.75,-.16,.31],[1.25,.1,.20],[1.48,.45,0]],.10);P(g,[[-1.48,.16],[-1.38,-.13],[-.49,-.13],[-.34,.16],[-.62,.22]],.18,'wood');P(g,[[-1.46,.16],[-1.43,.04],[-.55,.01],[-.39,.15]],.20,'brass');for(let x=-1.24;x<-.5;x+=.22){studs(g,[[x,.035,.112]],.034,'brass');H.box(g,.07,.27,.02,x,0,-.10,'leather',.01);}fuller(g,[[-.12,.03],[.44,-.02],[.94,.1],[1.25,.32]],.057,'darksteel');tassel(g,-1.45,-.08,0,'leatherDark',.35);return g;
});
spec('p10','매화 철선','PLUM BLOSSOM WAR FAN','도검','부채형 근접 도구','접힌 부채를 펼친 형태의 철선이다. 철제 살 사이에 어두운 직물과 금빛 매화 문양을 배치해 작은 무기에도 넓은 장식 면을 확보했다.',['부채형 전개','철제 방사형 살','금빛 매화 문양'],['철','먹색 직물','금색 문양'],()=>{
 const g=new T.Group();const n=13,r=1.7,cy=-.75,angles=[];for(let i=0;i<n;i++)angles.push(.12+Math.PI*.92*i/(n-1));for(let i=0;i<n-1;i++){const a=angles[i],b=angles[i+1];P(g,[[0,cy],[Math.cos(a)*r,cy+Math.sin(a)*r],[Math.cos(b)*r,cy+Math.sin(b)*r]],.018,'cloth',-.025);}for(let a of angles){H.rod(g,[0,cy,.01],[Math.cos(a)*r,cy+Math.sin(a)*r,.01],.025,'darksteel');H.ball(g,.033,Math.cos(a)*r,cy+Math.sin(a)*r,.01,'brass');}coin(g,0,cy,.07,.14);ringPommel(g,0,.10);for(let i=0;i<7;i++){let a=.4+i*.38,x=Math.cos(a)*1.15,y=cy+Math.sin(a)*1.15;for(let j=0;j<5;j++)H.ball(g,.037,x+Math.cos(j*TAU/5)*.06,y+Math.sin(j*TAU/5)*.06,.027,'gold',1,1,.35);coin(g,x,y,.04,.025);}tassel(g,0,cy-.12,0,'lacquer',.35);return g;
});
// Polearms.
spec('p11','백호 장창','WHITE TIGER SPEAR','장병기','긴 찌르기 무기','백호 초소의 긴 창이라는 설정이다. 은빛 창촉 아래 붉은 술과 여러 겹의 금속 띠를 두어 끝부분을 선명하게 구분했다.',['잎 모양 창촉','붉은 창술','긴 목재 창대'],['흑송','강철','붉은 섬유'],()=>{
 const g=new T.Group();haft(g,-2.2,1.02,.055,'woodDark',10);blade(g,[[.93,0,.06],[1.24,0,.17],[1.93,0,0]],.095);collar(g,.94,.085);for(let i=0;i<10;i++){const a=i*TAU/10;line(g,[[.90,Math.sin(a)*.07,Math.cos(a)*.07],[.64,Math.sin(a)*.16,Math.cos(a)*.16],[.45,Math.sin(a)*.23,Math.cos(a)*.23]],'lacquer',.015);}blade(g,[[-2.2,0,.07],[-2.49,0,0]],.06);fuller(g,[[1.12,0],[1.64,0]],.05);return g;
});
spec('p12','청월 언월도','AZURE MOON GLAIVE','장병기','넓은 베기형 장병기','넓은 반달 칼날과 긴 봉을 결합했다. 칼등의 고리와 붉은 술이 정지 상태에서도 방향과 움직임을 상상하게 한다.',['큰 반달 날','칼등의 세 고리','청동 용문 띠'],['강철','적갈색 목재','청동'],()=>{
 const g=new T.Group();haft(g,-2.15,.73,.065,'wood',9);P(g,[[.64,-.07],[.95,-.10],[1.20,-.31],[1.65,-.22],[2,.10],[2.13,.7],[1.80,.52],[1.34,.48],[1.01,.26],[.72,.15]],.11,'steel');P(g,[[1.01,-.08],[1.25,-.25],[1.62,-.17],[1.98,.12],[2.07,.59],[1.87,.33],[1.64,.16],[1.3,.04]],.018,'bright',.061);for(let i=0;i<3;i++)H.torus(g,.075,.015,1.15+i*.24,.43+i*.055,0,'brass');scroll(g,1.37,.2,.072,.22);collar(g,.68,.10);tassel(g,.77,-.06,.07,'lacquer',.55);H.ball(g,.095,-2.2,0,0,'brass');return g;
});
spec('p13','봉황 삼지극','PHOENIX HALBERD','장병기','복합 날 장병기','창촉과 갈고리 날을 서로 다른 방향으로 배치한 극. 불사조 깃을 연상시키는 층진 장식이 관문 수비대의 표식을 이룬다.',['중앙 창촉','한쪽 넓은 날','반대쪽 갈고리'],['단조철','청동','검은 목재'],()=>{
 const g=new T.Group();haft(g,-2.1,.95,.061,'woodDark',9);blade(g,[[.9,0,.11],[1.45,0,.12],[1.97,0,0]],.10);P(g,[[.9,.06],[.97,.39],[1.22,.77],[1.53,.58],[1.32,.29],[1.16,.07]],.10,'steel');P(g,[[.91,-.04],[.95,-.35],[1.2,-.61],[1.42,-.63],[1.21,-.4],[1.19,-.11]],.10,'darksteel');P(g,[[1.02,.19],[1.19,.63],[1.38,.54],[1.21,.31]],.014,'bright',.058);collar(g,.85,.10);for(let s of [-1,1]){coin(g,1.08,s*.13,.08,.065);scroll(g,1.17,s*.27,.058,.09);}tassel(g,.68,-.04,-.04,'cloth',.5);blade(g,[[-2.1,0,.07],[-2.42,0,0]],.06);return g;
});
spec('p14','해문 삼첨차','TIDE GATE TRIDENT','장병기','세 갈래 창','옛 항구 수문을 지키는 삼지창이라는 디자인이다. 길이가 다른 세 촉과 고리형 연결부가 정면과 측면 모두에서 형태를 구분해 준다.',['세 개의 서로 다른 촉','갈라지는 철제 목','밧줄 감김'],['흑철','해풍색 목재','밧줄'],()=>{
 const g=new T.Group();haft(g,-2.15,.60,.065,'wood',8);for(let s of [-1,1]){line(g,[[.47,0,0],[.82,s*.16,0],[1.04,s*.46,0],[1.51,s*.46,0]],'darksteel',.048);const q=H.part(g,'측면 촉');q.position.y=s*.46;blade(q,[[1.36,0,.09],[1.83,0,0]],.07);H.torus(g,.075,.016,1.12,s*.46,0,'brass','x');}blade(g,[[.5,0,.07],[1.25,0,.11],[2.11,0,0]],.09);collar(g,.48,.105);const w=H.part(g,'밧줄');w.position.x=-.65;grip(w,-.45,.45,.072,'cloth',15);tassel(g,-1.9,-.03,.04,'cloth',.33);for(let x=.72;x<1.35;x+=.19)coin(g,x,0,.052,.035);return g;
});
spec('p15','흑조 협도','BLACK HERON POLEBLADE','장병기','날렵한 곡도형 창','좁고 긴 곡선 칼날로 만든 장병기다. 검은 칠의 창대에 밝은 금속 띠를 간격 있게 둘러 까마귀 날개 같은 인상을 냈다.',['긴 곡선 날','검은 칠 창대','얇은 금속 띠'],['흑칠','은빛 강철','황동'],()=>{
 const g=new T.Group();haft(g,-2.18,.63,.06,'woodDark',10);blade(g,[[.52,0,.11],[.93,.04,.14],[1.36,.15,.15],[1.83,.33,.11],[2.18,.58,0]],.095);H.cyl(g,.095,.095,.29,.53,0,0,'brass','x');for(let i=0;i<4;i++)H.torus(g,.096,.009,.42+i*.075,0,0,'gold','x');fuller(g,[[.75,.04],[1.2,.13],[1.63,.3],[1.94,.46]],.053,'darksteel');P(g,[[-2.25,-.06],[-2.27,.06],[-2.45,.13],[-2.59,0],[-2.45,-.13]],.09,'steel');tassel(g,.50,-.07,0,'cloth',.45);return g;
});
spec('p16','쌍월 철극','TWIN MOON POLEAXE','장병기','대칭 쌍날 장병기','양쪽의 반달 날을 대칭으로 펼친 의장용 극. 긴 중앙 창촉과 두 개의 빈 공간이 큰 무기에서도 복잡한 외곽선을 유지한다.',['대칭 반달 날','노출된 연결대','긴 중앙 창촉'],['청동','강철','적갈색 목재'],()=>{
 const g=new T.Group();haft(g,-2.1,.95,.064,'wood',9);blade(g,[[.86,0,.10],[1.45,0,.11],[2.02,0,0]],.09);for(let s of [-1,1]){P(g,[[.93,s*.19],[.81,s*.47],[.98,s*.79],[1.29,s*.88],[1.60,s*.73],[1.42,s*.50],[1.28,s*.31],[1.15,s*.14],[1.23,s*.45],[1.22,s*.62],[1.03,s*.60]],.095,'steel');H.rod(g,[1.0,s*.03,0],[1.07,s*.50,0],.04,'brass');line(g,[[.97,s*.75,.056],[1.28,s*.82,.056],[1.54,s*.71,.056]],'bright',.022);coin(g,1.02,s*.14,.072,.05);}collar(g,.83,.10);tassel(g,.68,-.08,-.04,'lacquer',.5);return g;
});
// Impact and axes.
spec('p17','산성 파문도끼','MOUNTAIN KEEP AXE','둔기','한손 도끼','산성의 문양을 새긴 넓은 도끼다. 목재 손잡이와 서로 다른 색의 금속 띠를 통해 오래 사용한 장비의 느낌을 표현했다.',['넓은 비대칭 도끼날','층진 도끼목','리벳 고정판'],['강철','붉은 목재','가죽'],()=>{
 const g=new T.Group();haft(g,-1.55,1.1,.09,'wood',6);P(g,[[.58,.1],[.63,.49],[1.01,.92],[1.42,.91],[1.76,.58],[1.43,.32],[1.20,.12],[1.11,-.22],[.81,-.21]],.16,'darksteel');P(g,[[1.04,.88],[1.40,.86],[1.70,.57],[1.44,.40],[1.25,.53]],.018,'bright',.088);for(let z of [-.1,.1])P(g,[[.65,-.16],[.63,.27],[.86,.40],[1.1,.25],[1.1,-.17]],.025,'brass',z);studs(g,[[.75,.05,.124],[.98,.05,.124],[.87,.25,.124]],.037);scroll(g,1.19,.55,.105,.19);grip(g,-1.4,-.54,.102,'leatherDark',12);tassel(g,-1.55,-.06,.05,'leather',.4);return g;
});
spec('p18','철문 팔릉철퇴','EIGHT RIDGE MACE','둔기','철퇴','여덟 개의 날개형 철판을 둘러 묵직한 머리를 만들었다. 단순한 구체 대신 빈 공간이 있는 구조를 사용해 회전하면서 보는 재미를 더했다.',['여덟 방사형 철판','청동 목 장식','두꺼운 가죽 자루'],['흑철','밝은 모서리','청동'],()=>{
 const g=new T.Group();haft(g,-1.55,.62,.075,'woodDark',6);grip(g,-1.4,-.43,.09,'leather',13);H.cyl(g,.15,.15,.86,.98,0,0,'darksteel','x');for(let i=0;i<8;i++){const q=H.part(g,'철퇴 날개');q.rotation.x=i*TAU/8;P(q,[[.55,.12],[.65,.32],[.87,.47],[1.17,.47],[1.44,.23],[1.43,.12]],.065,'steel');line(q,[[.67,.31,.036],[.87,.44,.036],[1.16,.44,.036],[1.38,.22,.036]],'bright',.013);}collar(g,.51,.14);H.ball(g,.15,1.47,0,0,'brass',1.1,.9,.9);ringPommel(g,-1.66,.12);tassel(g,-1.74,-.1,.04,'cloth',.3);return g;
});
spec('p19','운문 유성추','CLOUD CHAIN FLAIL','둔기','사슬 연결 둔기','금속 추와 짧은 자루를 구불거리는 사슬로 연결했다. 각각의 사슬 고리를 실제 입체로 배치해 가까이서도 연결감을 볼 수 있다.',['입체 사슬 고리','비늘형 추','짧은 감김 자루'],['단조철','황동','가죽'],()=>{
 const g=new T.Group();grip(g,-1.8,-.75,.11,'leatherDark',14);H.cyl(g,.10,.10,.36,-.55,0,0,'darksteel','x');H.torus(g,.105,.027,-.32,0,0,'brass');for(let i=0;i<13;i++){let x=-.14+i*.115,y=-.08-.28*Math.sin(i/12*Math.PI);const t=H.torus(g,.085,.018,x,y,0,'steel',i%2?'y':'z');t.scale.x=1.23;}H.ball(g,.32,1.55,-.11,0,'darksteel');for(let i=0;i<12;i++){const a=i*TAU/12;H.ball(g,.095,1.55+Math.cos(a)*.265,-.11+Math.sin(a)*.265,0,'steel',1,1,.7);}for(let z of [-1,1]){coin(g,1.55,-.11,z*.3,.15);for(let i=0;i<8;i++){let a=i*TAU/8;H.ball(g,.055,1.55+Math.cos(a)*.19,-.11+Math.sin(a)*.19,z*.22,'brass');}}tassel(g,-1.88,-.03,.05,'lacquer',.33);return g;
});
spec('p20','뇌문 전투망치','THUNDER CREST HAMMER','둔기','양면 전투망치','평평한 타격면과 가늘게 뻗은 반대쪽 끝을 조합했다. 겹친 판과 작은 리벳으로 머리 부분의 금속 질감을 강조했다.',['네모난 타격면','반대쪽 갈고리','적층 금속 장식'],['먹빛 철','강철','황동'],()=>{
 const g=new T.Group();haft(g,-1.6,.85,.085,'wood',7);grip(g,-1.5,-.5,.1,'leatherDark',13);H.box(g,.52,.69,.34,.87,.11,0,'darksteel',.055);for(let y of [.47,.53])H.box(g,.61,.08,.43,.87,y,0,'steel',.025);for(let x of [.68,.87,1.06])for(let z of [-.14,0,.14])H.ball(g,.037,x,.59,z,'bright');P(g,[[.64,-.18],[.69,-.47],[.99,-.75],[1.23,-.82],[1.06,-.59],[.96,-.29]],.20,'steel');for(let z of [-.19,.19]){H.box(g,.39,.28,.025,.87,.11,z,'brass');studs(g,[[.73,.01,z+.023],[1.01,.01,z+.023],[.73,.21,z+.023],[1.01,.21,z+.023]],.027);}collar(g,.57,.12);ringPommel(g,-1.7,.12);return g;
});
// Bow and crossbow: no modern optics or compound limbs.
spec('p21','적송 장궁','RED PINE LONGBOW','궁시','장궁','자연스러운 굽은 목재를 길게 사용한 활. 활과 나란히 화살 몇 발과 작은 가죽 화살통을 배치했다.',['긴 목재 활대','시위와 손잡이','화살통 동봉'],['적송','삼끈','가죽'],()=>{
 const g=new T.Group();bowLimb(g,[[.08,-1.65,0],[-.22,-1.25,0],[-.45,-.65,0],[-.51,0,0],[-.45,.65,0],[-.22,1.25,0],[.08,1.65,0]],.063);const bowstring=H.part(g,'시위');H.rod(bowstring,[.08,-1.65,0],[.08,1.65,0],.009,'cloth');const q=H.part(g,'가죽 손잡이');q.position.x=-.51;q.rotation.z=Math.PI/2;grip(q,-.24,.24,.075,'leather',8);for(let y of [-1.45,1.45])H.torus(g,.069,.012,-.035,y,0,'brass','y');arrow(g,-.5,.02,.09,1.65);const accessory=H.part(g,'전시 부속품');H.cyl(accessory,.18,.14,1.5,.75,-.35,-.13,'leather','y');H.cyl(accessory,.20,.20,.1,.75,.39,-.13,'brass','y');for(let i=0;i<3;i++){const a=H.part(accessory,'예비 화살');a.position.set(.70+i*.06,-.65,-.13+i*.04);a.rotation.z=Math.PI/2;arrow(a,0,0,0,1.5);}for(let y=-.9;y<.3;y+=.24)H.torus(accessory,.17,.012,.75,y,-.13,'cloth','y');return g;
});
spec('p22','흑각 반궁','BLACK HORN RECURVE','궁시','짧은 반곡궁','양 끝이 다시 바깥으로 굽는 작은 활이다. 짙은 몸체와 상아색 가장자리, 붉은 천 감김을 대비시켰다.',['반곡형 양 끝','뿔색 겹층','붉은 손잡이'],['검은 뿔색','상아색','붉은 직물'],()=>{
 const g=new T.Group();const pts=[[.32,-1.35,0],[.07,-1.33,0],[-.22,-1.06,0],[-.32,-.60,0],[-.49,-.22,0],[-.52,0,0],[-.49,.22,0],[-.32,.60,0],[-.22,1.06,0],[.07,1.33,0],[.32,1.35,0]];bowLimb(g,pts,.078);line(g,pts.map(p=>[p[0],p[1],-.05]),'brass',.013);const bowstring=H.part(g,'시위');H.rod(bowstring,[.32,-1.35,0],[.32,1.35,0],.009,'cloth');let q=H.part(g,'감김');q.position.x=-.52;q.rotation.z=Math.PI/2;grip(q,-.23,.23,.085,'lacquer',9);for(let s of [-1,1]){tassel(g,.05,s*1.27,0,'lacquer',.20);coin(g,-.28,s*.77,.074,.045);for(let i=0;i<3;i++)coin(g,-.29+i*.025,s*(.88+i*.09),.075,.025);}arrow(g,-.65,0,.11,1.8);return g;
});
spec('p23','성채 목노','CITADEL WOOD CROSSBOW','궁시','석궁','두꺼운 목재 몸체와 단순한 활대를 결합한 석궁이다. 과거 장비에 맞춰 금속 띠와 끈, 목재의 표면을 중심으로 디자인했다.',['목재 받침대','철테 활대','짧은 화살'],['짙은 목재','단조철','삼끈'],()=>{
 const g=new T.Group();P(g,[[-1.55,-.17],[-1.55,.13],[-.85,.18],[-.34,.12],[1.2,.08],[1.23,-.12],[-.7,-.17],[-.98,-.35],[-1.29,-.39]],.22,'wood');H.box(g,2.12,.026,.07,.13,.14,0,'darksteel',.01);line(g,[[.83,0,-1.0],[1.03,0,-.66],[1.14,0,0],[1.03,0,.66],[.83,0,1.0]],'darksteel',.065);for(let s of [-1,1]){H.rod(g,[.83,0,s*1.0],[.06,.16,0],.013,'cloth');H.cyl(g,.075,.075,.10,.90,0,s*.85,'brass','z');}arrow(g,-.25,.19,0,1.65);for(let x of [-1.38,-.70,.49,.95]){H.box(g,.07,.30,.25,x,-.01,0,'brass',.012);studs(g,[[x,.02,.14]],.025);}H.torus(g,.17,.022,-.8,-.30,0,'darksteel');H.box(g,.08,.21,.07,-.66,-.17,0,'steel');H.torus(g,.23,.034,1.40,0,0,'darksteel','x');const accessory=H.part(g,'예비 화살');for(let i=0;i<3;i++)arrow(accessory,-.75,-.52-i*.14,-.13,1.0);return g;
});
spec('p24','철목 중노','IRONWOOD HEAVY CROSSBOW','궁시','대형 석궁','성벽 전시대에 놓였을 법한 묵직한 석궁이다. 넓은 철테 활대와 여러 겹의 외부 판으로 일반 석궁과 실루엣을 구별했다.',['넓은 활대','철제 덧댐','후미 장식 손잡이'],['철목','흑철','청동'],()=>{
 const g=new T.Group();P(g,[[-1.62,.17],[1.24,.17],[1.4,.02],[1.22,-.18],[-.62,-.18],[-.84,-.5],[-1.35,-.5],[-1.55,-.22]],.31,'woodDark');H.box(g,2.25,.06,.13,.1,.22,0,'steel',.015);line(g,[[.68,0,-1.22],[1.05,0,-.88],[1.20,0,0],[1.05,0,.88],[.68,0,1.22]],'darksteel',.10);line(g,[[.68,.04,-1.22],[1.05,.06,-.88],[1.20,.06,0],[1.05,.06,.88],[.68,.04,1.22]],'steel',.037);for(let s of [-1,1]){H.rod(g,[.68,.04,s*1.2],[-.1,.24,0],.019,'cloth');H.box(g,.27,.22,.16,.98,0,s*.65,'brass',.02);H.torus(g,.09,.018,.83,0,s*1.07,'brass','z');}arrow(g,-.48,.29,0,1.85);for(let x of [-1.35,-.84,-.25,.35,.95]){H.box(g,.08,.42,.35,x,-.03,0,'darksteel',.02);for(let s of [-1,1])studs(g,[[x,.09,s*.19],[x,-.14,s*.19]],.029,'brass');}H.rod(g,[-1.12,.18,-.26],[-1.12,.18,.40],.045,'steel');H.rod(g,[-1.12,.18,.4],[-1.4,.18,.4],.035,'steel');H.cyl(g,.07,.07,.20,-1.43,.18,.4,'wood','y');H.torus(g,.25,.042,1.56,0,0,'darksteel','x');return g;
});
// Defensive and unconventional side arms.
spec('p25','흑림 원방패','BLACKWOOD ROUND SHIELD','방어','목제 원방패','방사형 목판을 철테로 감싼 원방패. 중앙 보스와 둘레의 리벳, 후면 손잡이를 모두 입체로 만들었다.',['방사형 목판','철테와 리벳','후면 가죽 손잡이'],['흑송','철','청동'],()=>{
 const g=new T.Group();H.cyl(g,1.04,1.04,.13,0,0,0,'woodDark','z',64);for(let i=-4;i<=4;i++){const y=i*.21,w=Math.sqrt(Math.max(.01,.96*.96-y*y))*2;H.box(g,w,.185,.025,0,y,.08,i%2?'wood':'woodDark',.012);}H.torus(g,1.04,.058,0,0,.03,'darksteel');H.torus(g,.93,.016,0,0,.102,'brass');H.ball(g,.35,0,0,.09,'steel',1,1,.50);H.torus(g,.35,.035,0,0,.12,'darksteel');for(let i=0;i<20;i++){let a=i*TAU/20;studs(g,[[Math.cos(a)*.97,Math.sin(a)*.97,.10]],.034);}for(let i=0;i<8;i++){let a=i*TAU/8;studs(g,[[Math.cos(a)*.40,Math.sin(a)*.40,.11]],.031);}for(let s of [-1,1]){line(g,[[s*.32,-.30,-.08],[s*.32,-.24,-.28],[s*.32,.24,-.28],[s*.32,.30,-.08]],'leather',.045);H.box(g,.18,.12,.04,s*.32,-.3,-.09,'brass');H.box(g,.18,.12,.04,s*.32,.3,-.09,'brass');}return g;
});
spec('p26','청동 연방패','BRONZE KITE SHIELD','방어','길쭉한 방패','위쪽은 넓고 아래는 뾰족한 방패다. 겹친 청동 테두리와 중앙의 새 문장으로 왕성 장비군과 연결했다.',['연 모양 외곽','입체 문장','겹 테두리'],['청동','검은 가죽','붉은 칠'],()=>{
 const g=new T.Group();const shape=[[-.83,.77],[-.59,1.11],[.59,1.11],[.83,.77],[.72,-.34],[0,-1.35],[-.72,-.34]];P(g,shape,.15,'leatherDark');P(g,shape.map(p=>[p[0]*.93,p[1]*.93]),.02,'lacquer',.087);line(g,[...shape,shape[0]].map(p=>[p[0],p[1],.10]),'brass',.045);H.box(g,.06,1.8,.035,0,.05,.115,'brass');for(let s of [-1,1])P(g,[[0,.35],[s*.18,.72],[s*.58,.74],[s*.4,.41],[s*.14,.22],[s*.37,-.08],[s*.15,-.02],[0,-.32]],.055,'brass',.15);coin(g,0,.35,.20,.13);for(let i=0;i<shape.length;i++){let a=shape[i],b=shape[(i+1)%shape.length];for(let j=0;j<3;j++){let t=(j+.5)/3;studs(g,[[(a[0]*(1-t)+b[0]*t)*.94,(a[1]*(1-t)+b[1]*t)*.94,.13]],.027);}}for(let s of [-1,1])line(g,[[s*.28,-.30,-.08],[s*.28,-.17,-.29],[s*.28,.35,-.29],[s*.28,.45,-.08]],'leather',.05);return g;
});
spec('p27','철두 귀면곤봉','IRON ONI CLUB','둔기','긴 곤봉','넓어지는 목재 몸체에 금속 돌기를 규칙적으로 배치했다. 끝의 두꺼운 철테와 붉은 손잡이가 거친 무게 중심을 드러낸다.',['굵어지는 팔각 몸체','입체 철제 돌기','굵은 후미 고리'],['흑목','단조철','붉은 가죽'],()=>{
 const g=new T.Group();H.cyl(g,.28,.12,1.75,.65,0,0,'woodDark','x',8);grip(g,-1.40,-.34,.1,'lacquer',14);collar(g,-.25,.13);for(let i=0;i<7;i++){let x=-.06+i*.24,r=.16+i*.017;H.cyl(g,r*1.07,r*1.07,.065,x,0,0,'darksteel','x',8);for(let j=0;j<8;j++){let a=j*TAU/8;H.ball(g,.046,x,Math.sin(a)*r,Math.cos(a)*r,'steel',1.2,1,1);}}H.cyl(g,.29,.29,.13,1.55,0,0,'steel','x',8);H.cyl(g,.24,.24,.07,1.64,0,0,'darksteel','x',8);ringPommel(g,-1.57,.14);tassel(g,-1.65,-.10,0,'cloth',.36);return g;
});
spec('p28','월영 사슬낫','MOONSHADOW CHAIN SICKLE','도검','낫과 사슬추','짧은 낫과 둥근 추를 긴 사슬로 연결한 장비다. 활처럼 굽은 날과 느슨하게 놓인 사슬이 다른 근접 무기와 다른 인상을 준다.',['반월 낫날','연결 사슬','청동 사슬추'],['강철','어두운 목재','청동'],()=>{
 const g=new T.Group();haft(g,-1.55,.38,.075,'woodDark',5);grip(g,-1.46,-.6,.088,'leather',12);P(g,[[.27,-.08],[.26,.55],[.01,.89],[-.41,1.04],[-.99,.95],[-1.36,.69],[-.92,.78],[-.40,.75],[-.04,.51],[.10,.02]],.085,'steel');P(g,[[-1.29,.70],[-.92,.84],[-.40,.85],[.04,.63],[-.10,.47],[-.41,.74],[-.93,.77]],.014,'bright',.05);collar(g,.27,.105);for(let i=0;i<18;i++){let t=i/17,x=-1.56+3.02*t,y=-.13-.52*Math.sin(t*Math.PI);const o=H.torus(g,.065,.015,x,y,0,'darksteel',i%2?'y':'z');o.scale.x=1.3;}H.ball(g,.24,1.65,-.09,0,'brass');for(let i=0;i<6;i++){const t=H.torus(g,.24,.016,1.65,-.09,0,'darksteel');t.rotation.y=i*Math.PI/6;}coin(g,.28,.1,.075,.07);return g;
});
// Matchlocks are the technology ceiling. Exterior visual props only.
function matchlock(style){
 const g=new T.Group(),heavy=style===2,short=style===3,ornate=style===1;
 const tip=short?1.28:heavy?2.12:2.0,back=short?-1.45:-1.85,r=heavy?.115:short?.083:.075;
 const wood=ornate?'lacquer':style===0?'woodDark':'wood';
 const stock=[[back,-.26],[back+.10,.10],[back+.55,.13],[-.82,.02],[-.49,.08],[tip-.22,.06],[tip-.20,-.10],[-.54,-.17],[-.88,-.35],[back+.32,-.54],[back,-.47]];
 P(g,stock,.22,wood,0,.025);
 H.cyl(g,r,r,tip+.63,(tip-.63)/2,.16,0,'darksteel','x',heavy?12:16);
 H.cyl(g,r*1.06,r*1.06,.12,tip-.02,.16,0,'steel','x',heavy?12:16);
 H.cyl(g,r*.70,r*.70,.012,tip+.048,.16,0,'black','x',24);
 H.torus(g,r*.86,r*.16,tip+.056,.16,0,'steel','x');
 H.cyl(g,.016,.016,tip+1.05,(tip-1.05)/2,-.13,.025,'woodDark','x');
 for(let x=-.31;x<tip-.12;x+=(heavy?.43:.52)){H.box(g,.07,.37,.26,x,.06,0,'brass',.018);studs(g,[[x,.03,.145]],.024);}
 P(g,[[-1.04,-.18],[-.99,-.02],[-.40,.02],[-.25,-.12],[-.4,-.24]],.04,'brass',.133,.014);
 // Small external match-holder silhouette and cord; deliberately no internal mechanism.
 line(g,[[-.76,-.05,.18],[-.70,.03,.18],[-.82,.17,.18],[-.71,.30,.18],[-.55,.30,.18]],'darksteel',.022);
 line(g,[[-.57,.31,.18],[-.45,.32,.18],[-.35,.18,.18],[-.41,-.01,.19],[-.35,-.30,.19],[-.54,-.45,.17]],'cloth',.010);
 H.cyl(g,.045,.045,.02,-.76,-.06,.18,'steel','z',18);
 H.torus(g,.16,.022,-.9,-.31,0,'darksteel');H.box(g,.035,.13,.07,-.8,-.26,0,'steel');
 P(g,[[back+.01,-.27],[back+.02,-.47],[back+.12,-.5],[back+.13,-.3]],.24,'brass');
 H.box(g,.06,.10,.06,tip-.27,.26,0,'darksteel',.008);
 for(let x of [back+.31,-1.17,-.46])studs(g,[[x,-.15,.128]],.026,'brass');
 line(g,[[back+.31,-.35,-.07],[back+.66,-.68,-.07],[.29,-.65,-.07],[tip-.46,-.19,-.07]],'leather',.027);
 for(let x of [back+.32,tip-.45])H.torus(g,.055,.012,x,x<0?-.32:-.18,-.05,'brass');
 if(ornate){for(let x=back+.4;x<tip-.3;x+=.27)scroll(g,x,x<-.8?-.18:-.04,.124,.08);P(g,[[back+.2,-.27],[back+.4,-.18],[back+.61,-.3],[back+.4,-.41]],.018,'ivory',.132);tassel(g,back+.2,-.40,.05,'lacquer',.38);}
 if(heavy){H.box(g,.23,.22,.30,-.55,.12,0,'brass',.025);for(let x=-.2;x<tip-.2;x+=.43)for(let s of [-1,1])H.ball(g,.027,x,.06,s*.15,'steel');let support=H.part(g,'지지 받침대');H.rod(support,[.66,-.15,0],[.66,-1.03,0],.045,'woodDark');H.rod(support,[.66,-1.03,0],[.45,-1.2,-.19],.036,'darksteel');H.rod(support,[.66,-1.03,0],[.87,-1.2,.19],.036,'darksteel');H.torus(g,.11,.023,.66,-.07,0,'brass','x');}
 if(short){P(g,[[back+.18,-.31],[back+.35,-.19],[back+.5,-.25],[back+.43,-.43],[back+.29,-.46]],.018,'brass',.133);coin(g,back+.36,-.31,.15,.065);tassel(g,back+.18,-.45,.08,'cloth',.28);}
 for(let i=0;i<5;i++){let x=back+.25+i*.12;if(x<-.9)H.box(g,.027,.22,.012,x,-.31,.123,'leather',.005);}
 return g;
}
spec('p29','흑송 화승총','BLACK PINE MATCHLOCK','화승총','기본형 화승총','검은 목재와 단조철을 조합한 긴 화승총이다. 외부 화승 끈, 금속 띠, 가죽 멜빵이 과거 장비군의 기술 상한을 보여준다.',['화승 끈의 외형','긴 목재 총상','열린 총구 표현'],['흑송','단조철','삼끈'],()=>matchlock(0));
spec('p30','학익 문양화승총','CRANE CREST MATCHLOCK','화승총','장식형 화승총','붉은 칠과 상아색 문장으로 꾸민 화승총이다. 긴 총열의 기본 형태를 유지하면서 궁정 근위대용 외관으로 차별화했다.',['붉은 칠 장식','상아색 문장','금색 덩굴무늬'],['적색 칠','황동','철'],()=>matchlock(1));
spec('p31','성문 대형화승총','GATEKEEPER HEAVY MATCHLOCK','화승총','큰 화승총 콘셉트','다른 화승총보다 굵고 무거워 보이는 성문 수비 장비다. 별도 받침대와 넓은 금속 띠로 대형 장비의 외형을 강조했다.',['굵은 외형','단순 받침대','넓은 금속 띠'],['철','목재','청동'],()=>matchlock(2));
spec('p32','적동 단화승총','COPPER SHORT MATCHLOCK','화승총','짧은 화승총 콘셉트','짧은 목재 총상과 청동 장식을 가진 화승총이다. 다른 점화 방식이나 현대식 부품 없이 길이와 장식만으로 휴대형 인상을 만들었다.',['짧은 전체 길이','청동 문장판','직물 매듭'],['목재','청동','단조철'],()=>matchlock(3));

}

// Geometry/materials are shared while any ground or hand instance holds a lease.
// Returning the final instance releases the template, materials and grain maps.
const contexts=new WeakMap(),instances=new WeakMap();
function contextFor(T){
 let context=contexts.get(T);if(context)return context;
 const H=originalMaterials(T);originalGeometry(T,H);originalPastBuilders(T,H);
 context={H,builders:new Map(H.catalog.map(w=>[w.id,w.build])),records:new Map(),references:0};
 contexts.set(T,context);return context;
}
function releaseMaterials(context){
 const materials=new Set(Object.values(context.H.materials)),textures=new Set(Object.values(context.H.surfaceTextures||{}));
 for(const m of materials){for(const value of Object.values(m))if(value&&value.isTexture)textures.add(value);m.dispose();}
 for(const t of textures)t.dispose();
 if(context.stringGeometry)context.stringGeometry.dispose();
}
function semanticPart(mesh,source,setting,kind){
 let o=mesh,loaded=false,string=false,dualIndex=-1;
 while(o&&o!==source){
  if(/칼집|전시 부속품|예비 화살|받침대/.test(o.name||''))return 'display';
  if(o.name==='화살')loaded=true;
  if(o.name==='시위')string=true;
  if(setting.dual&&o.parent===source)dualIndex=source.children.indexOf(o);
  o=o.parent;
 }
 if(setting.dual&&dualIndex>=0)return 'dual'+dualIndex;
 if(string&&kind==='bow')return 'string';
 if(loaded&&['bow','crossbow'].includes(kind))return 'loaded';
 return 'main';
}
function bakeSource(T,source,item){
 const setting=modelSettings[item.sourceId],buckets=new Map(),originalGeometries=new Set(),output=new T.Group();
 source.scale.setScalar(setting.scale);source.updateMatrixWorld(true);let sourceParts=0,triangles=0;
 try{
  source.traverse(o=>{
   if(!o.isMesh)return;sourceParts++;originalGeometries.add(o.geometry);
   if(Array.isArray(o.material))throw new TypeError('Unexpected multi-material original part: '+item.id);
   const part=semanticPart(o,source,setting,item.kind),key=part+'|'+o.material.uuid;
   const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
   geometry.applyMatrix4(o.matrixWorld);if(!geometry.attributes.normal)geometry.computeVertexNormals();
   if(!geometry.attributes.uv)geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
   if(!buckets.has(key))buckets.set(key,{part,material:o.material,geometries:[]});
   buckets.get(key).geometries.push(geometry);
  });
  const groups=new Map();
  for(const bucket of buckets.values()){
   let group=groups.get(bucket.part);
   if(!group){group=new T.Group();group.name='past_'+bucket.part;group.userData.component=bucket.part;group.userData.hideWhenHeld=bucket.part==='display';groups.set(bucket.part,group);output.add(group);}
   const geometry=new T.BufferGeometry();
   for(const attribute of ['position','normal','uv']){
    const stride=attribute==='uv'?2:3,count=bucket.geometries.reduce((sum,g)=>sum+g.attributes[attribute].array.length,0),array=new Float32Array(count);let offset=0;
    for(const g of bucket.geometries){array.set(g.attributes[attribute].array,offset);offset+=g.attributes[attribute].array.length;}
    geometry.setAttribute(attribute,new T.BufferAttribute(array,stride));
   }
   geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const mesh=new T.Mesh(geometry,bucket.material);mesh.castShadow=!bucket.material.transparent;mesh.receiveShadow=true;group.add(mesh);triangles+=geometry.attributes.position.count/3;
  }
  const bounds=new T.Box3().setFromObject(output),size=bounds.getSize(new T.Vector3());
  output.userData={sourceParts,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},width:size.x,height:size.y,depth:size.z};
  return output;
 }catch(error){output.traverse(o=>{if(o.isMesh)o.geometry.dispose();});throw error;}
 finally{for(const g of originalGeometries)g.dispose();for(const b of buckets.values())for(const g of b.geometries)g.dispose();}
}
function createModel(T,id){
 const item=get(id);if(!item)throw new RangeError('Unknown past weapon: '+id);
 if(!T||typeof T.Group!=='function')throw new TypeError('THREE is required for a past weapon model');
 const context=contextFor(T);let record=context.records.get(id);
 if(!record){
  try{record={id,template:bakeSource(T,context.builders.get(item.sourceId)(),item),references:0};context.records.set(id,record);}
  catch(error){if(context.references===0){releaseMaterials(context);contexts.delete(T);}throw error;}
 }
 const model=record.template.clone(true);
 model.name='HanQ_'+item.sourceId+'_'+item.englishName;
 model.userData={...record.template.userData,weaponId:id,pastWeaponId:id,sourceId:item.sourceId,pastArsenal:true,released:false,groundRotation:[...item.groundRotation]};
 record.references++;context.references++;instances.set(model,{T,context,record});
 model.dispose=()=>disposeModel(T,model);return model;
}
function disposeModel(T,model){
 const lease=model&&instances.get(model);if(!lease||lease.T!==T||model.userData.released)return false;
 model.userData.released=true;model.removeFromParent();instances.delete(model);
 if(--lease.record.references===0){
  const geometries=new Set();lease.record.template.traverse(o=>{if(o.isMesh)geometries.add(o.geometry);});
  for(const geometry of geometries)geometry.dispose();lease.context.records.delete(lease.record.id);
 }
 if(--lease.context.references===0){releaseMaterials(lease.context);contexts.delete(T);}
 return true;
}
function resourceStats(T){const c=contexts.get(T);return {instances:c?c.references:0,templates:c?c.records.size:0};}
function setHeld(model,held=true,loaded=true,draw=0){
 if(!model||model.userData.released)return;
 const item=get(model.userData.weaponId),bow=item&&item.kind==='bow',lease=instances.get(model);
 draw=Number.isFinite(draw)?clamp(draw,0,1):0;
 const layout=bow?rangedLayout(item.id):null,setting=bow?modelSettings[item.sourceId]:null;
 const arrowTail=bow?(item.sourceId==='p21'?-.5:-.65)*setting.scale:0;
 for(const group of model.children){
  const part=group.userData.component;
  if(part==='display')group.visible=!held;
  else if(part==='loaded'){group.visible=!!loaded;if(bow)group.position.x=held?layout.rightGrip[0]-arrowTail-.16*draw:0;}
  else if(bow&&part==='main')group.rotation.y=held?Math.PI:0;
  else if(bow&&part==='string')group.visible=!held;
 }
 if(bow&&lease){
  const T=lease.T;
  if(held&&!lease.drawString){
   const group=new T.Group();group.name='past_draw_string';group.userData.component='drawString';model.add(group);
   if(!lease.context.stringGeometry)lease.context.stringGeometry=new T.CylinderGeometry(1,1,1,6,1,false);
   for(let i=0;i<2;i++)group.add(new T.Mesh(lease.context.stringGeometry,lease.context.H.materials.cloth));
   lease.drawString=group;
  }
  if(lease.drawString){
   lease.drawString.visible=!!held;
   const half=(item.sourceId==='p21'?1.65:1.35)*setting.scale,nock=new T.Vector3(...layout.rightGrip);nock.x-=.16*draw;
   for(let i=0;i<2;i++){
    const endpoint=new T.Vector3(layout.rightGrip[0],(i?-1:1)*half,0),axis=nock.clone().sub(endpoint),length=axis.length(),mesh=lease.drawString.children[i];
    mesh.position.copy(endpoint).add(nock).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize());mesh.scale.set(.009*setting.scale,length,.009*setting.scale);
   }
  }
 }
}
function poseMelee(T,ch,frame,id,options={}){
 const item=get(id),blade=frame&&frame.blade||frame,core=options.core||melee.Core;
 if(!ch||!ch.group)return null;
 if(!item||item.kind!=='melee'||!blade||!blade.base||!blade.tip||options.visible===false){if(ch.pastMelee)ch.pastMelee.visible=false;return null;}
 if(!ch.pastMelee||ch.pastMelee.userData.weaponId!==id||ch.pastMelee.userData.released){
  if(ch.pastMelee)disposeModel(T,ch.pastMelee);ch.pastMelee=createModel(T,id);ch.group.add(ch.pastMelee);
 }
 const model=ch.pastMelee,axes=modelAxes[id];setHeld(model,true);
 for(const gun of Object.values(ch.guns||{}))gun.visible=false;
 if(ch.prem&&ch.prem.guns)for(const gun of Object.values(ch.prem.guns))gun.visible=false;
 if(ch.hkWeapon)ch.hkWeapon.visible=false;
 // Share the sampler's shoulder rotation through preparation and recovery;
 // the weapon transform remains anchored to its physical blade and grip markers.
 if(ch.torso){
  if(Number.isFinite(blade.torsoYaw))ch.torso.rotation.y=blade.torsoYaw;
  else if(blade.active)ch.torso.rotation.y=clamp((blade.angle||0)*.18,-.22,.22);
 }
 ch.group.updateMatrixWorld(true);
 function matrixFor(b,a){const tr=core.modelTransform(b,a,Number.isFinite(options.yaw)?options.yaw:0);return new T.Matrix4().compose(new T.Vector3(tr.position.x,tr.position.y,tr.position.z),new T.Quaternion(tr.quaternion.x,tr.quaternion.y,tr.quaternion.z,tr.quaternion.w),new T.Vector3(tr.scale,tr.scale,tr.scale));}
 const matrix=matrixFor(blade,axes).premultiply(new T.Matrix4().copy(ch.group.matrixWorld).invert());
 matrix.decompose(model.position,model.quaternion,model.scale);model.visible=true;model.updateMatrixWorld(true);
 const right=model.localToWorld(new T.Vector3(...axes.rightGrip));let left;
 if(axes.dualWield){
  // The second original blade follows its own hand. It is not an extra invisible
  // hit sweep: the combat profile's single active blade remains authoritative.
  const secondary=model.children.find(o=>o.userData.component==='dual1');
  if(secondary){
   const guard=!!frame.guarding,base=new T.Vector3(guard?.30:.25,guard?1.33:1.15,-.27),direction=new T.Vector3(guard?.38:.55,.80,-.05).normalize();
   const tip=base.clone().addScaledVector(direction,distance(axes.secondary.bladeBase,axes.secondary.bladeTip));
   ch.group.localToWorld(base);ch.group.localToWorld(tip);
   const secondaryMatrix=matrixFor({base,tip},{...axes.secondary,twist:0}).premultiply(new T.Matrix4().copy(model.matrixWorld).invert());
   secondaryMatrix.decompose(secondary.position,secondary.quaternion,secondary.scale);secondary.updateMatrixWorld(true);
   left=secondary.localToWorld(new T.Vector3(...axes.secondary.bladeBase));
  }
 }else if(axes.leftGrip)left=model.localToWorld(new T.Vector3(...axes.leftGrip));
 if(!left)left=ch.group.localToWorld(new T.Vector3(.18,1.37,-.25));
 const rightLocal=ch.group.worldToLocal(right.clone()),leftLocal=ch.group.worldToLocal(left.clone());
 if(options.reachArm){const ra=(ch.arms||[]).find(a=>a.side>0),la=(ch.arms||[]).find(a=>a.side<0);if(ra)options.reachArm(ch,ra,rightLocal.x,rightLocal.y,rightLocal.z,.7);if(la)options.reachArm(ch,la,leftLocal.x,leftLocal.y,leftLocal.z,.65);}
 ch.group.updateMatrixWorld(true);return {right,left,rightLocal,leftLocal,weapon:model};
}
const shieldPolygon=[[-.83,.77],[-.59,1.11],[.59,1.11],[.83,.77],[.72,-.34],[0,-1.35],[-.72,-.34]];
function polygonContains(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
class HistoricalShieldState{
 constructor(weaponId='past_p25',options={}){
  if(weaponId&&typeof weaponId==='object'){options=weaponId;weaponId=options.weaponId||'past_p25';}
  const item=get(weaponId);if(!item||item.kind!=='shield')throw new RangeError('Unknown historical shield: '+weaponId);
  this.weaponId=weaponId;this.maxDurability=item.maxDurability;this.width=item.width;this.height=item.height;
  this.durability=Number.isFinite(options.durability)?clamp(options.durability,0,this.maxDurability):this.maxDurability;
  this.raised=!!options.raised&&this.durability>0;
 }
 setRaised(value){this.raised=!!value&&this.durability>0;return this.raised;}
 getMovement(){const active=this.raised&&this.durability>0;return {speedMultiplier:active?(this.weaponId==='past_p25'?.83:.76):1,canSprint:!active,canAimDownSights:!active};}
 getFirePermission(weapon,options={}){
  if(!this.raised||this.durability<=0)return {ok:true,reason:'일반 공격',exposesRightEdge:false};
  const id=typeof weapon==='string'?weapon:weapon&&(weapon.type||weapon.id),past=get(id),definition=id&&melee.Core.WEAPONS[id];
  const oneHand=(past&&past.kind==='melee'&&past.hands===1)||(definition&&definition.hands<=1)||id==='fist'||id==='fists';
  if(options.ads||!oneHand)return {ok:false,reason:'방패를 내리면 양손 무기와 원거리 무기를 사용할 수 있습니다.',exposesRightEdge:false};
  return {ok:true,reason:'방패와 한손 근접 무기',exposesRightEdge:false};
 }
 resolveHit(hit={}){
  const damage=Number.isFinite(hit.damage)?Math.max(0,hit.damage):0,p=hit.localPoint,d=hit.fromDirection;
  const vector=v=>v&&['x','y','z'].every(k=>Number.isFinite(v[k]));
  const length=vector(d)?Math.hypot(d.x,d.y,d.z):0,front=length>1e-8&&d.z/length>=Math.cos(55*Math.PI/180)-1e-10;
  let within=false;
  if(vector(p)&&Math.abs(p.z)<=.18){if(this.weaponId==='past_p25')within=(p.x/(this.width/2))**2+(p.y/(this.height/2))**2<=1+1e-10;else within=polygonContains(p.x/.5,p.y/.5,shieldPolygon);}
  const covered=!!(this.raised&&this.durability>0&&front&&within),kind=hit.kind||'melee';
  const reduction=kind==='explosive'?.1:['bullet','matchlock'].includes(kind)?.25:kind==='bolt'?.88:['melee','arrow','projectile'].includes(kind)?1:0;
  const cost=['bullet','matchlock','explosive'].includes(kind)?2:1;
  const blockedDamage=covered?Math.min(damage*reduction,this.durability/cost):0;
  this.durability=Math.max(0,this.durability-blockedDamage*cost);const broke=blockedDamage>0&&this.durability<=1e-8;
  if(broke){this.durability=0;this.raised=false;}
  return {playerDamage:damage-blockedDamage,blockedDamage,durability:this.durability,broke,covered,exposed:false};
 }
 serialize(){return {schema:'hanq-past-shield-v1',weaponId:this.weaponId,durability:this.durability,raised:this.raised};}
 static restore(data){if(!data||data.schema!=='hanq-past-shield-v1'||!Number.isFinite(data.durability))throw new TypeError('Invalid historical shield save');return new HistoricalShieldState(data);}
}
function drawIcon(ctx,id,x,y,w,h,color='#d6c8a3'){
 const item=get(id);if(!item||!ctx)return false;
 ctx.save();ctx.translate(x+w/2,y+h/2);ctx.scale(w/34,h/26);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.8;ctx.lineCap='round';ctx.lineJoin='round';
 const path=points=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();};
 if(item.kind==='shield'){ctx.beginPath();if(item.sourceId==='p25')ctx.arc(0,0,9,0,Math.PI*2);else{ctx.moveTo(-8,-9);ctx.lineTo(8,-9);ctx.lineTo(7,3);ctx.lineTo(0,11);ctx.lineTo(-7,3);ctx.closePath();}ctx.stroke();path([[0,-6],[0,7]]);}
 else if(item.kind==='bow'){ctx.beginPath();ctx.moveTo(-4,-11);ctx.quadraticCurveTo(12,0,-4,11);ctx.lineTo(-4,-11);ctx.stroke();path([[-12,0],[12,0],[8,-3]]);}
 else if(item.kind==='crossbow'){path([[-14,1],[12,1]]);path([[7,-10],[11,0],[7,10],[-2,0],[7,-10]]);path([[-8,1],[-8,6]]);}
 else if(item.kind==='matchlock'){path([[-14,4],[-7,3],[-4,-1],[14,-1]]);path([[-4,2],[13,2]]);path([[-6,1],[-7,6]]);}
 else if(item.sourceId==='p10'){ctx.beginPath();ctx.moveTo(0,9);ctx.arc(0,9,18,-Math.PI*.92,-Math.PI*.08);ctx.closePath();ctx.stroke();for(let a=-2.6;a<-.4;a+=.55)path([[0,9],[Math.cos(a)*18,9+Math.sin(a)*18]]);}
 else {const pole=item.type==='장병기',impact=item.type==='둔기';path([[-14,6],[12,-6]]);if(impact){path([[6,-9],[13,-5],[9,2],[3,-2],[6,-9]]);}else{path([[-1,0],[11,-9],[14,-7],[4,0]]);path([[-5,-3],[-1,6]]);}if(pole)path([[-14,6],[-8,3]]);if(modelSettings[item.sourceId].dual){path([[-13,10],[12,-2]]);}}
 ctx.restore();return true;
}
return Object.freeze({version:'1.0.0',catalog,byId,get,nativeWeaponDefinitions,meleeDefinitions,modelAxes,rangedLayout,
 createModel,disposeModel,setHeld,poseMelee,HistoricalShieldState,drawIcon,resourceStats});
});
