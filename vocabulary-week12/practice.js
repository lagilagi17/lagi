
(() => {
"use strict";
const host=document.getElementById("vocabulary-mount");
const root=host?host.attachShadow({mode:"open"}):document;
if(host){root.append(document.getElementById("vocabulary-template").content.cloneNode(true))}
const $=id=>root.getElementById(id), data=JSON.parse($("bank").textContent);
const instructions=["주어진 단어에 가장 적절한 우리말 뜻을 고르시오.","우리말 해석을 참고하여 빈칸에 들어갈 단어를 철자 개수에 맞게 쓰시오.","주어진 우리말 해석에 맞게 빈칸에 들어갈 표현을 어법에 맞게 쓰시오."];
function blanks(rows,task){
  return rows.flatMap(([text,ko],i)=>Array.from(text.matchAll(/\{([^{}]+)\}/g),(m,j)=>{
    const prefix=text.slice(0,m.index).replace(/[{}]/g,""),suffix=text.slice(m.index+m[0].length).replace(/[{}]/g,"");
    const answer=m[1], mask=task===2?answer.replace(/[a-z]+/gi,w=>w[0]+" _".repeat(w.length-1)):answer[0]+"________";
    return {id:task+"."+i+"."+j,task,ko,answer,english:prefix+mask+suffix,full:prefix+answer+suffix};
  }));
}
const banks=[data.terms.map(([english,answer],i)=>({id:"1."+i,task:1,english,answer})),blanks(data.sentences,2),blanks(data.quotes,3)];

const quoteTargetsV2=[
  "I'm not",
  "It's okay",
  "How's everything",
  "I got you",
  "I thought you",
  "What are you",
  "It's not",
  "It doesn't matter",
  "my mind",
  "wouldn't wait",
  "on commission",
  "Have you been",
  "Are you being",
  "I'm being",
  "must have done something right",
  "He is good",
  "those federal marshals",
  "Not too",
  "Are we still",
  "We're on",
  "I'm on",
  "You could be",
  "about two hours",
  "I'm behind you",
  "your back",
  "I'm for",
  "I'm all for",
  "I'm up for",
  "Do you think",
  "I'm against",
  "the rules",
  "I came",
  "Sorry doesn't",
  "cut it",
  "A phone call's not",
  "Standard is not",
  "can do this",
  "in a day",
  "a man can take",
  "you can do",
  "didn’t come from money",
  "You have a chip",
  "You need to",
  "grew up working class"
];
const quoteV1=banks[2];
const quoteV2=quoteV1.map((q,i)=>{
  const answer=quoteTargetsV2[i];
  const position=q.full.indexOf(answer);
  if(position<0) throw new Error("Quote target missing: "+q.id);
  return {...q,id:"3."+i+".1",answer,english:q.full.slice(0,position)+answer[0]+"________"+q.full.slice(position+answer.length)};
});
banks[2]=[...quoteV1,...quoteV2];
function examDeck(){
  const quotes=shuffled(quoteV1.map((q,i)=>Math.random()<0.5?q:quoteV2[i])).slice(0,5);
  return [...shuffled(banks[0]).slice(0,15),...shuffled(banks[1]).slice(0,5),...quotes];
}

const all=banks.flat(), meanings=[...new Set(data.terms.map(row=>row[1]))];
const key="hanq.voca.week12.2026.wrong";
let wrong={};try{wrong=JSON.parse(localStorage.getItem(key))||{}}catch{}
let mode=0,deck=[],index=0,responses=new Map(),completed=false;
function shuffled(items){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function choices(q){
  if(!q.options){
    const senses=s=>s.replace(/\[[^\]]*\]/g,"").split(/[,;·]/).map(x=>x.trim()).filter(Boolean);
    const used=new Set(senses(q.answer)), opts=[q.answer];
    for(const s of shuffled(meanings)){const parts=senses(s);if(parts.some(p=>used.has(p)))continue;opts.push(s);parts.forEach(p=>used.add(p));if(opts.length===5)break}
    q.options=shuffled(opts);
  }return q.options
}
function button(label,act){const b=document.createElement("button");b.textContent=label;b.onclick=act;return b}
function filters(){
  const old=$("range").value, counts=[...new Set(Object.values(wrong))].sort((a,b)=>a-b);
  $("range").replaceChildren(new Option("전체","all"),new Option("오답 전체","wrong"),...counts.map(n=>new Option(n+"번 틀린 문제",String(n))));
  if([...$("range").options].some(o=>o.value===old))$("range").value=old;
}
function matches(q){const f=$("range").value;return f==="all"|| (f==="wrong"?wrong[q.id]>0:wrong[q.id]===Number(f))}
function start(m,shuffle=false){
  mode=m;filters();index=0;responses=new Map();completed=false;
  versionLabel.hidden=m!==2;
  const pool=m===4?all:m===2&&versionSelect.value!=="all"?(versionSelect.value==="1"?quoteV1:quoteV2):banks[m];
  deck=m===3?examDeck():pool.filter(matches);
  if(shuffle&&m<3)deck=shuffled(deck);
  root.querySelectorAll("nav button").forEach((b,i)=>b.setAttribute("aria-pressed",String(i===m)));
  $("rangeLabel").hidden=m===3;$("mix").hidden=m===4;$("mix").textContent=m===3?"새 모의시험":"다시 섞기";$("paper").hidden=m!==4;$("ledger").hidden=m!==4;$("quiz").hidden=m===4;
  if(m===4){
    const list=root.querySelector("#ledger ol");list.replaceChildren();
    for(const q of deck.filter(q=>wrong[q.id]&&(!Number(taskSelect.value)||q.task===Number(taskSelect.value))).sort((a,b)=>wrong[b.id]-wrong[a.id])){const li=document.createElement("li"), sub=document.createElement("small");li.textContent=q.full||q.english;sub.textContent="Task "+q.task+" · "+wrong[q.id]+"회 · "+q.answer+(q.ko?" · "+q.ko:"");li.append(sub);list.append(li)}
    if(!list.children.length)list.textContent="복습할 오답이 없습니다.";return
  }
  render();
}
function render(){
  const q=deck[index],r=q&&responses.get(q.id);
  $("count").textContent=(q?"Task "+q.task+" · "+(index+1):"0")+" / "+deck.length;
  $("instruction").textContent=completed?"모의시험 결과":q?instructions[q.task-1]:"이 범위에 문제가 없습니다.";
  $("ko").textContent=completed?"":q?.ko||"";$("english").textContent=completed?[...responses.values()].filter(r=>r.ok).length+" / 25 정답":q?.english||"";
  $("choices").replaceChildren();$("form").hidden=!q||q.task===1||completed;$("answer").value=r?.typed||"";$("answer").disabled=Boolean(r);$("grade").disabled=Boolean(r);
  $("feedback").textContent=r&&!completed?(r.ok?"정답":"오답 · 정답은 "+q.answer):"";$("feedback").className=r?.ok?"ok":"bad";
  if(q?.task===1&&!completed)choices(q).forEach((s,i)=>{const b=button("①②③④⑤"[i]+" "+s,()=>submit(s));b.disabled=!!r;if(r&&s===q.answer)b.className="ok";if(r&&!r.ok&&s===r.typed)b.className="bad";$("choices").append(b)});
  $("prev").disabled=!index||completed;$("unknown").disabled=!q||!!r||completed;
  $("next").textContent=mode===3&&index===deck.length-1?"결과 보기":"다음";
  $("next").disabled=!q||completed||(mode===3?!r:index>=deck.length-1);
  if(q&&q.task>1&&!r&&!completed)$("answer").focus({preventScroll:true});
}
function norm(s){return s.trim().replace(/[’‘]/g,"'").replace(/\s+/g," ").toLowerCase()}
function submit(typed){
  const q=deck[index];if(!q||responses.has(q.id)||completed)return;
  const ok=typed!==null&&norm(typed)===norm(q.answer);responses.set(q.id,{typed,ok});
  if(!ok){wrong[q.id]=(wrong[q.id]||0)+1;try{localStorage.setItem(key,JSON.stringify(wrong))}catch{}}
  render();if(!$("next").disabled)$("next").focus({preventScroll:true})
}
["Task 1 · 어휘","Task 2 · 교재 예문","Task 3 · Quotes","모의시험","오답"].forEach((s,i)=>root.querySelector("nav").append(button(s,()=>start(i))));
$("range").onchange=()=>start(mode);$("mix").onclick=()=>start(mode,true);$("paper").onclick=()=>window.print();
$("unknown").onclick=()=>submit(null);$("form").onsubmit=e=>{e.preventDefault();if($("answer").value.trim())submit($("answer").value)};
$("prev").onclick=()=>{index--;render()};$("next").onclick=()=>{if(index<deck.length-1)index++;else completed=true;render()};
root.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.repeat&&!e.isComposing&&mode!==4&&responses.has(deck[index]?.id)&&!$("next").disabled&&(e.target===document.body||e.target===$("answer")||e.target===$("next"))){e.preventDefault();$("next").click()}});

const taskSelect=document.createElement("select");
taskSelect.setAttribute("aria-label","오답 유형");
["모든 Task","Task 1 · 어휘","Task 2 · 교재 예문","Task 3 · Quotes"].forEach((name,i)=>taskSelect.add(new Option(name,String(i))));
taskSelect.onchange=()=>start(4);
const controls=document.createElement("div");
controls.className="review-controls";
controls.innerHTML='<button type="button" data-save>전체 오답 서버 저장</button><form><input aria-label="네 자리 복원 코드" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="네 자리 코드" required><button>불러오기</button></form><output aria-live="polite"></output>';
const saveButton=controls.querySelector("[data-save]"),restoreForm=controls.querySelector("form"),codeField=controls.querySelector("input"),status=controls.querySelector("output");
controls.prepend(taskSelect);
$("ledger").querySelector("h2").after(controls);
let busy=false;
const codeKey=key+".lastBackup";
try { const last=localStorage.getItem(codeKey);if(last)status.textContent="최근 저장 코드 "+last; } catch {}
async function backup(action){
  if(busy)return;
  const saving=action==="save";
  if(saving&&!Object.keys(wrong).length){status.textContent="저장할 오답이 없습니다.";return}
  busy=true;saveButton.disabled=true;restoreForm.querySelector("button").disabled=true;
  status.textContent=saving?"저장 중…":"불러오는 중…";
  try{
    const response=await fetch("/api/voca-week12/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(saving?{wrong}:{code:codeField.value})});
    if(!response.ok)throw new Error(response.status===404?"코드를 찾을 수 없습니다. 네 자리 숫자와 유효기간을 확인하세요.":response.status===503?"서버 저장소가 준비되지 않았습니다. 기기의 오답은 보관되어 있습니다.":response.status===429?"요청이 많습니다. 10분 후 다시 시도하세요.":"서버에 연결하지 못했습니다. 다시 시도하세요.");
    const result=await response.json();
    if(saving){
      status.textContent="저장 코드 "+result.code+" · 30일간 유효";
      try{localStorage.setItem(codeKey,result.code)}catch{}
    }else{
      const merged={...wrong};
      for(const q of all){const n=result.wrong[q.id];if(Number.isSafeInteger(n)&&n>0)merged[q.id]=Math.max(merged[q.id]||0,n)}
      localStorage.setItem(key,JSON.stringify(merged));wrong=merged;
      if(mode===4)start(4);
      status.textContent="오답 "+Object.keys(result.wrong).length+"개를 불러왔습니다.";
    }
  }catch(error){status.textContent=error.message||"다시 시도하세요."}
  finally{busy=false;saveButton.disabled=false;restoreForm.querySelector("button").disabled=false}
}
saveButton.onclick=()=>backup("save");
restoreForm.onsubmit=e=>{e.preventDefault();backup("load")};

const versionLabel=document.createElement("label"),versionSelect=document.createElement("select");
versionLabel.append("빈칸 버전 ",versionSelect);
for(const [value,name] of [["1","V1"],["2","V2"],["all","두 버전 모두"]])versionSelect.add(new Option(name,value));
versionSelect.onchange=()=>start(2);
$("rangeLabel").after(versionLabel);
start(0);

})();