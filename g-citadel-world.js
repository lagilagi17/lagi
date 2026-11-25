/* Small lazy entry point for the native Baegwol palace district. */
(function(global){'use strict';
  const VERSION='20261124-global-transport1';let pending=null;
  function script(path){return new Promise((resolve,reject)=>{
    const e=document.createElement('script');e.src=path+'?v='+VERSION;e.async=true;let finished=false;
    const timer=setTimeout(()=>{if(finished)return;finished=true;e.remove?.();reject(Error('왕궁 모듈 연결 시간이 초과되었습니다. 다시 입장해 주세요.'));},45000);
    e.onload=()=>{if(finished)return;finished=true;clearTimeout(timer);resolve();};
    e.onerror=()=>{if(finished)return;finished=true;clearTimeout(timer);e.remove?.();reject(Error('왕궁 모듈을 불러오지 못했습니다. 다시 입장해 주세요.'));};
    (document.head||document.body).appendChild(e);
  });}
  function ready(){
    if(global.HanQCitadelAuthored&&global.HanQCitadelRuntime&&global.HanQPastNavigation)return Promise.resolve();
    if(!pending)pending=Promise.all([
      global.HanQCitadelAuthored?null:script('citadel/authored.js'),
      global.HanQCitadelRuntime?null:script('citadel/runtime.js'),
      global.HanQPastNavigation?null:script('past/navigation.js')
    ]).catch(e=>{pending=null;throw e;});
    return pending;
  }
  global.HanQCitadelWorld={version:VERSION,load:async function(options={}){
    if(!options.modulesReady)await ready();
    if(!options.THREE)throw Error('게임의 3D 엔진을 찾을 수 없습니다.');
    return global.HanQCitadelRuntime.create(options);
  }};
})(window);
