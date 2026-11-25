/* HanQ abyss: same-origin, lazy model loader. Three.js is supplied by the game. */
(function(global){'use strict';
  const VERSION='20261124-capsule-clearance1',BASE='abyss/';
  const FILES=['city-dock.js','temple.js','environment.js','submarine.js','navigation.js','world.js'];
  let loading=null;
  function script(file){return new Promise((resolve,reject)=>{
    const node=document.createElement('script');node.src=BASE+file+'?v='+VERSION;node.async=true;
    let done=false;const finish=error=>{if(done)return;done=true;clearTimeout(timer);if(error){node.remove?.();reject(error);}else resolve();};
    const timer=setTimeout(()=>finish(Error('해저 탐사 자료 연결 시간이 초과되었습니다. 다시 시도해 주세요.')),45000);
    node.onload=()=>finish();node.onerror=()=>finish(Error('해저 탐사 자료를 불러오지 못했습니다. 다시 시도해 주세요.'));
    (document.head||document.body).appendChild(node);
  });}
  function ready(){
    if(global.HanQAbyssModel?.create&&global.HanQAbyssNavigation&&global.buildAbyssCityDock&&global.buildAbyssTemple&&global.buildAbyssEnvironment&&global.buildSubmarineExterior)return Promise.resolve();
    if(!loading)loading=Promise.all(FILES.map(script)).catch(error=>{loading=null;throw error;});
    return loading;
  }
  global.HanQAbyssWorld={version:1,async load(options){
    options.onProgress?.({progress:.05,label:'숨겨진 정박지와 신전 자료를 불러오는 중'});
    await ready();options.onProgress?.({progress:.55,label:'실내 구조와 보행 경로를 연결하는 중'});
    const world=global.HanQAbyssModel.create(options);
    options.onProgress?.({progress:1,label:'해양기록관 B1 연결 완료'});return world;
  }};
})(window);
