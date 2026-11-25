/* HAYEON / AFTERTIME 04. Lazy, same-origin native-game destination. */
(function(global){'use strict';
  const VERSION='20261124-global-transport1',BASE='future/';
  const FILES=['kit.js','surface-detail.js','geometry-utils.js','interior-view.js','buildings.js','landmarks.js','civic.js','industry.js','terrain.js','detail-layer.js','world.js','navigation.js','adapter.js'];
  let pending=null;
  function script(file){return new Promise((resolve,reject)=>{
    const node=document.createElement('script');node.src=BASE+file+'?v='+VERSION;node.async=true;
    let finished=false;const done=error=>{if(finished)return;finished=true;clearTimeout(timer);if(error){node.remove?.();reject(error);}else resolve();};
    const timer=setTimeout(()=>done(Error('미래 도시 자료 연결 시간이 초과되었습니다. 다시 시도해 주세요.')),45000);
    node.onload=()=>done();node.onerror=()=>done(Error('미래 도시 자료를 불러오지 못했습니다. 다시 시도해 주세요.'));
    (document.head||document.body).appendChild(node);
  });}
  async function data(){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=setTimeout(()=>controller?.abort(),45000);
    try{const response=await fetch(BASE+'worldData.json?v='+VERSION,{signal:controller?.signal,credentials:'same-origin'});if(!response.ok)throw Error('미래 지형 자료를 불러오지 못했습니다.');const value=await response.json();if(!value?.plots?.length||!value?.meshes?.length||!value?.bounds)throw Error('미래 지형 자료가 불완전합니다.');return value;}
    finally{clearTimeout(timer);}
  }
  function ready(){
    if(!pending)pending=Promise.all([Promise.all(FILES.map(script)),data()]).then(([,value])=>value).catch(error=>{pending=null;throw error;});
    return pending;
  }
  global.HanQFutureWorld={version:4,async load(options){
    if(!options?.THREE)throw Error('미래 도시에 필요한 3D 엔진이 없습니다.');
    options.onProgress?.({progress:.04,label:'하연 2186 · 미래 도시 자료를 불러오는 중'});
    const worldData=await ready();
    options.onProgress?.({progress:.35,label:'미래 거리와 귀환 관문을 연결하는 중'});
    await new Promise(resolve=>setTimeout(resolve,0));
    const world=global.HanQFutureModel.create({...options,data:worldData});
    options.onProgress?.({progress:1,label:'하연 2186 · 해저 관문 연결 완료'});return world;
  }};
})(window);
