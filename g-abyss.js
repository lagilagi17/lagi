/* HANQ — Maritime Archive / HAEMU-07 / Forgotten Sanctuary.
 * Native actor adapter; model geometry loads only at the museum's B1 entrance.
 * Coordinates: scene XYZ -> native {x:X, y:Z, absolute feet:Y}.
 * Saved state is additive and never participates in the seeded world index.
 */
(function (host) {
  'use strict';
  const VERSION=1, JOURNEY_SECONDS=32, RELEASE_AFTER=30;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite3=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const point=a=>Array.isArray(a)?a:[a.x,a.y,a.z];
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const KNOWN=new Set(['basement-arrival','basement-lift','dock-lift','city-berth','temple-berth','temple-entry','temple-gate','temple-archive','temple-crypt']);
  const locationOf=value=>({buildingId:typeof value?.buildingId==='string'&&value.buildingId.length<160?value.buildingId:null,
    floor:clamp(Number.isInteger(value?.floor)?value.floor:0,0,200)});
  const sameLocation=(a,b)=>a?.buildingId===b?.buildingId&&a?.floor===b?.floor;
  const emptyFuture=()=>({visited:false,location:locationOf(null),position:null,checkpoint:'future-arrival',returnPosition:null,exteriorPosition:null,transport:null});

  function create(options) {
    const getState=options.getState, getThree=options.getThree;
    const getT=()=>options.getTHREE?.()||options.THREE, api=()=>options.getApi?.();
    const player=()=>getState()?.ents?.[0], say=(text,color='#a7e4dc')=>options.say?.(text,color);
    let model=null,navState=null,active=false,disposed=false,loading=false,loadPromise=null,loadToken=0;
    let loadProgress=0,loadError=null,pendingRestore=null,entry={buildingId:null,returnFloor:1};
    let savedPosition=null,checkpoint='basement-arrival',discovered=false,gateActive=false,visited=new Set();
    let region='abyss',future=emptyFuture();
    const worlds={abyss:null,future:null};
    let time=0,lastActive=0,frame=0,stepped=-1,jumpPending=false,restoreFrame=null,renderStyle=null;
    const transit={progress:0,target:0,riding:false,moving:false,dwell:0};

    const inside=(e=player())=>!!(active&&e&&e===player()&&e.abyss);
    const local=()=>navState?navState.position.toArray():savedPosition?.slice()||null;
    const base=e=>inside(e)?navState?.position.y??savedPosition?.[1]??0:undefined;
    function bounds(world=model){return world?.bounds||{minX:-76,maxX:100,minY:-52,maxY:50,minZ:-44,maxZ:64};}
    function contains(x,z){const b=bounds();return active&&x>=b.minX-3&&x<=b.maxX+3&&z>=b.minZ-3&&z<=b.maxZ+3;}
    function volume(x,z,y){const b=bounds();return contains(x,z)&&Number.isFinite(y)&&y>=b.minY-12&&y<=b.maxY+12;}
    function validPosition(a,world=model){const b=bounds(world);return finite3(a)&&a[0]>=b.minX&&a[0]<=b.maxX&&a[2]>=b.minZ&&a[2]<=b.maxZ&&a[1]>=b.minY-4&&a[1]<=b.maxY+4;}
    function clearProjectiles(){const s=getState();for(const k of ['bullets','sbullets','projs','equipmentProjectiles','pastProjectiles'])if(Array.isArray(s?.[k]))s[k].length=0;}
    function clearMotion(p=player()){
      if(!p)return;
      Object.assign(p,{alt:0,floor:0,jz:0,vz:0,vx:0,vy:0,air:false,plat:null,climb:null,vault:null,roll:null});
      const s=getState();if(!s)return;
      s.camBase=s.camState=s.moveDir=s.aimNade=null;s.pickPrompt=s.vehPrompt=s.ladderPrompt=s.vaultPrompt=s.craftPrompt=null;
      if(s.input){s.input.fire=false;s.input.ads=false;s.input.adsToggle=false;s.input.move=null;}
      options.clearInput?.();jumpPending=false;
    }
    function detachCity(p){
      for(const k of ['westportBuildingId','westportFloor','westportBaseY','indoorPenta','indoorFloor','deepFloor','pentaFloor','piHeight','piLast','ncLayer','railPassenger'])delete p[k];
    }
    function syncPlayer(){
      const p=player();if(!active||!p||!navState)return;
      savedPosition=local();p.abyss=true;p.abyssHeight=savedPosition[1];p.abyssRegion=region;p.x=savedPosition[0];p.y=savedPosition[2];
      p.alt=0;p.floor=0;p.jz=0;p.vz=navState.velocity.y||0;p.vx=navState.velocity.x||0;p.vy=navState.velocity.z||0;
      p.air=transit.riding||futureRiding()?false:!navState.grounded;
    }
    function sanitize(saved){
      if(saved?.version!==VERSION)return null;
      const nextRegion=saved.region==='future'?'future':'abyss',fs=saved.future||{};
      const nextFuture={visited:!!fs.visited||nextRegion==='future',location:locationOf(fs.location),
        position:finite3(fs.position)?fs.position.slice():null,
        checkpoint:typeof fs.checkpoint==='string'&&fs.checkpoint.length<200?fs.checkpoint:'future-arrival',
        returnPosition:finite3(fs.returnPosition)?fs.returnPosition.slice():null,
        exteriorPosition:finite3(fs.exteriorPosition)?fs.exteriorPosition.slice():null,transport:fs.transport?.version===1?clone(fs.transport):null};
      const tr=saved.transit||{},riding=nextRegion==='abyss'&&!!tr.riding,target=tr.target===1?1:0;
      let progress=clamp(Number.isFinite(tr.progress)?tr.progress:0,0,1);
      if(!riding&&progress>0&&progress<1)progress=String(saved.checkpoint||'').startsWith('temple-')?1:0;
      return {version:VERSION,inside:!!saved.inside,region:nextRegion,future:nextFuture,
        entry:{buildingId:typeof saved.entry?.buildingId==='string'?saved.entry.buildingId:null,returnFloor:1},
        position:finite3(saved.position)?saved.position.slice():nextRegion==='future'?nextFuture.position:null,
        checkpoint:nextRegion==='future'?(typeof saved.checkpoint==='string'&&saved.checkpoint.length<200?saved.checkpoint:nextFuture.checkpoint):KNOWN.has(saved.checkpoint)?saved.checkpoint:'basement-arrival',
        discovered:!!saved.discovered,gateActive:!!saved.gateActive,
        visited:(Array.isArray(saved.visited)?saved.visited:[]).filter(id=>KNOWN.has(id)),
        transit:{progress,target,
          riding,moving:riding&&Math.abs(progress-target)>1e-6,dwell:clamp(Number.isFinite(tr.dwell)?tr.dwell:0,0,2.5)}};
    }
    function serialize(){
      // A failed asynchronous restore must not overwrite the user's destination.
      if(pendingRestore)return clone(pendingRestore);
      if(region==='future'&&model&&navState){future.location=locationOf(model.getLocation?.());future.position=local();future.checkpoint=checkpoint;future.transport=model.transport?.serialize?.()||future.transport;}
      return {version:VERSION,inside:inside(),region,future:clone(future),entry:{...entry},position:local(),checkpoint,
        discovered,gateActive,visited:[...visited].filter(id=>KNOWN.has(id)),transit:{...transit}};
    }
    function applyRecord(record){
      entry={...record.entry};checkpoint=record.checkpoint;discovered=record.discovered;gateActive=record.gateActive;
      visited=new Set(record.visited);savedPosition=record.position?.slice()||null;Object.assign(transit,record.transit);
      region=record.region||'abyss';future=record.future?clone(record.future):emptyFuture();
    }
    function returnToCity(){
      afterRender();const p=player();if(!p)return false;
      active=false;delete p.abyss;delete p.abyssHeight;delete p.abyssRegion;clearMotion(p);
      for(const world of Object.values(worlds))if(world)world.root.visible=false;
      const returned=options.returnToCity?.({...entry});
      if(returned===false){
        // A removed building or an interrupted renderer must still yield a dry,
        // native-world position. This fallback is supplied by the native host.
        const b=options.getEntryBuilding?.();
        if(b&&Number.isFinite(b.x)&&Number.isFinite(b.z)){
          p.x=b.x;p.y=b.z+(b.depth||48)*(b.scale||1)/2+5;
          p.floor=0;p.alt=0;p.jz=0;
        }
      }
      clearProjectiles();lastActive=time;return returned!==false;
    }
    function install(saved){
      if(disposed||!player()||getState()?.mode!=='open')return false;
      ++loadToken;loading=false;loadPromise=null;loadError=null;loadProgress=0;pendingRestore=null;active=false;navState=null;
      afterRender();for(const world of Object.values(worlds))if(world)world.root.visible=false;
      delete player().abyss;delete player().abyssHeight;delete player().abyssRegion;
      const record=sanitize(saved);
      if(!record){region='abyss';future=emptyFuture();checkpoint='basement-arrival';savedPosition=null;discovered=false;gateActive=false;visited.clear();Object.assign(transit,{progress:0,target:0,riding:false,moving:false,dwell:0});return true;}
      applyRecord(record);
      if(record.inside){pendingRestore=record;returnToCity();tryRestore();}
      return true;
    }
    function newNav(world,record){
      const T=getT(),id=record?.checkpoint||world.arrival?.id||'basement-arrival';
      const cp=world.nav.getCheckpoint(id)||world.arrival||world.nav.getCheckpoint('basement-arrival')||world.checkpoints?.[0];
      if(!cp||!finite3(cp.position))throw Error('Sanctuary arrival missing');
      const state={position:new T.Vector3(),velocity:new T.Vector3(),grounded:true};world.nav.teleport(state,cp);
      const position=record?.position;
      if(validPosition(position,world)&&!record?.transit?.riding){
        const floor=world.nav.groundAt(position[0],position[2],position[1],.6);
        const feet=Number.isFinite(floor)?Math.max(floor,position[1]):position[1];
        const clear=world.nav.bodyClear?.(position[0],feet,position[2])!==false;
        if(Number.isFinite(floor)&&position[1]-floor>=-.5&&position[1]-floor<=2.2&&clear){
          state.position.set(position[0],feet,position[2]);
          state.safePosition=state.position.clone();state.grounded=Math.abs(state.position.y-floor)<.2;
        }
      }
      return {state,checkpoint:cp.id};
    }
    const futureRiding=()=>region==='future'&&!model?.getLocation?.()?.buildingId&&!!model?.transport?.riding;
    function syncFuturePassenger(){const pose=model?.transport?.pose?.();if(!pose||!navState)return;navState.position.fromArray(pose.position);navState.velocity.set(0,0,0);navState.grounded=true;syncPlayer();}
    function syncPassenger(){
      if(!model||!navState)return;
      model.setJourney(transit.progress);const pose=model.passengerPose();
      if(!pose?.feetPosition)throw Error('Submarine passenger pose missing');
      navState.position.copy(pose.feetPosition);navState.velocity.set(0,0,0);navState.grounded=true;syncPlayer();
    }
    function validateWorld(world){
      if(!world?.root||!world.nav||!['setJourney','setPortal','passengerPose','dispose'].every(k=>typeof world[k]==='function')||!['getCheckpoint','teleport','groundAt','step','pointSolid','cameraDistance'].every(k=>typeof world.nav[k]==='function'))throw Error('Incomplete portal destination');
    }
    function transition(info,commit){
      if(typeof options.transitionInterior==='function')return Promise.resolve(options.transitionInterior(info,commit));
      if(typeof options.transitionAction!=='function')return Promise.resolve(commit());
      return new Promise((resolve,reject)=>{
        let applied=false;
        const apply=()=>{applied=commit()===true;return applied;};
        try{
          const result=options.transitionAction(info,apply,resolve);
          if(result&&typeof result.then==='function')result.then(resolve,reject);
          else if(result===false||applied)resolve(applied);
        }catch(error){reject(error);}
      });
    }
    function beginLoad(request={},record=null){
      if(disposed)return Promise.resolve(false);
      if(loading)return loadPromise||Promise.resolve(false);
      const T=getT(),scene=getThree()?.scene,p=player(),s=getState(),nextRegion=record?.region==='future'?'future':'abyss';
      const loader=nextRegion==='future'?host.HanQFutureWorld:host.HanQAbyssWorld;
      if(!T||!scene||!loader?.load||!p?.alive||s?.mode!=='open')return Promise.resolve(false);
      const token=++loadToken,owner=p,ownerState=s,restore=record?clone(record):null;
      let candidate=null,prepared=null,committed=false;
      const nextEntry={buildingId:request.buildingId||restore?.entry?.buildingId||options.getEntryBuilding?.()?.id||null,returnFloor:1};
      loading=true;loadProgress=0;loadError=null;
      const cache=worlds[nextRegion]?.root?.parent===scene?worlds[nextRegion]:null;
      say(nextRegion==='future'?'미래의 하연 · 탐험 위치를 복원하는 중':restore?'해양기록관 · 탐험 위치를 복원하는 중':'해양기록관 B1 · 정박지 연결 중');
      const current=()=>token===loadToken&&!disposed&&player()===owner&&getState()===ownerState&&getThree()?.scene===scene&&owner.alive&&(!request.isCurrent||request.isCurrent());
      const discard=()=>{
        if(prepared)candidate?.discardLocation?.(prepared);prepared=null;
        if(!committed&&candidate&&candidate!==model&&candidate!==worlds[nextRegion])candidate.dispose?.();
        candidate=null;
        if(!committed&&token===loadToken){loading=false;loadProgress=0;}
      };
      loadPromise=Promise.resolve().then(()=>{
        if(!current())return null;
        return cache||loader.load({THREE:T,scene,onProgress:value=>{if(token===loadToken){const n=typeof value==='number'?value:value?.progress;if(Number.isFinite(n))loadProgress=clamp(n,0,1);}}});
      }).then(async world=>{
        candidate=world;
        if(!current()){discard();return false;}
        validateWorld(world);world.root.visible=false;
        if(nextRegion==='future'){
          if(typeof world.prepareLocation!=='function'||typeof world.commitLocation!=='function')throw Error('Future interior adapter missing');
          world.transport?.restore?.(restore?.future?.transport);
          prepared=await world.prepareLocation(locationOf(restore?.future?.location));
          if(!current()){discard();return false;}
          world.commitLocation(prepared);prepared=null;validateWorld(world);
        }
        const restored=newNav(world,restore);
        if(![restored.state.position.x,restored.state.position.y,restored.state.position.z].every(Number.isFinite))throw Error('Invalid portal arrival pose');
        world.setPortal(restore?.gateActive??gateActive);world.setJourney(restore?.transit?.progress||0);
        if(nextRegion==='abyss'&&restore?.transit?.riding){
          const pose=world.passengerPose();if(!pose?.feetPosition||![pose.feetPosition.x,pose.feetPosition.y,pose.feetPosition.z].every(Number.isFinite))throw Error('Invalid submarine passenger pose');
          restored.state.position.copy(pose.feetPosition);restored.state.velocity.set(0,0,0);restored.state.grounded=true;
        }
        if(nextRegion==='future'&&world.transport?.riding&&!world.getLocation?.()?.buildingId){const pose=world.transport.pose();if(pose){restored.state.position.fromArray(pose.position);restored.state.velocity.set(0,0,0);restored.state.grounded=true;}}
        const commit=()=>{
          if(committed)return true;
          if(!current())return false;
          afterRender();for(const item of Object.values(worlds))if(item)item.root.visible=false;
          const previous=worlds[nextRegion];model=world;worlds[nextRegion]=world;
          if(restore)applyRecord(restore);else{
            region='abyss';checkpoint='basement-arrival';savedPosition=null;Object.assign(transit,{progress:0,target:0,riding:false,moving:false,dwell:0});
          }
          region=nextRegion;entry=nextEntry;navState=restored.state;checkpoint=restored.checkpoint;
          active=true;discovered=true;visited.add(checkpoint);detachCity(owner);owner.abyss=true;
          if(region==='future'){future.visited=true;future.location=locationOf(world.getLocation?.());future.position=restored.state.position.toArray();future.checkpoint=checkpoint;}
          pendingRestore=null;loading=false;loadProgress=1;loadError=null;clearMotion(owner);
          syncPlayer();stepped=frame;clearProjectiles();s.yaw=Number.isFinite(world.arrival?.yaw)?world.arrival.yaw:transit.riding?0:Math.PI;s.pitch=.13;s.mapOpen=false;
          committed=true;lastActive=time;
          if(previous&&previous!==world)previous.dispose?.();
          say(nextRegion==='future'?'미래의 하연 · 탐험 위치 복원 완료':restore?'잊힌 신전 · 탐험 위치 복원 완료':'해양기록관 B1 · 승강기를 찾아 정박장으로 내려가세요');
          return true;
        };
        if(restore||typeof options.transitionInterior!=='function'){
          const ok=commit();if(!ok)discard();return ok;
        }
        await transition({kind:'basement',label:'해양기록관 · B1',isCurrent:current},commit);
        if(!committed)discard();return committed;
      }).catch(()=>{
        discard();
        if(committed)return true;
        if(token!==loadToken||disposed)return false;
        loading=false;loadProgress=0;loadError='load-failed';
        say(nextRegion==='future'?'미래 지도 복원에 실패했어요. B1을 선택하면 다시 시도합니다.':'정박지 연결을 완료하지 못했어요. B1을 선택하면 다시 시도합니다.','#eccda0');
        return false;
      });
      return loadPromise;
    }
    function tryRestore(){if(pendingRestore&&!loading&&!loadError&&getT()&&getThree()?.scene)beginLoad(pendingRestore.entry,pendingRestore);}
    function enter(request={}){
      const p=player();if(active||disposed||!p?.alive||p.vehicle||p.craft||p.mortar||p.railPassenger||p.hollow)return Promise.resolve(false);
      if(pendingRestore){loadError=null;return beginLoad({...pendingRestore.entry,...request},pendingRestore);}
      return beginLoad(request);
    }
    function leave(){
      if(!inside()||region!=='abyss'||transit.riding)return false;
      ++loadToken;loading=false;pendingRestore=null;loadError=null;Object.assign(transit,{progress:0,target:0,riding:false,moving:false,dwell:0});
      checkpoint='basement-arrival';savedPosition=model?.nav.getCheckpoint(checkpoint)?.position.slice()||null;
      returnToCity();say('WESTPORT · 해양 현대미술관 1층으로 복귀');return true;
    }
    function setCheckpoint(id){
      if(!model||!navState)return false;const cp=model.nav.getCheckpoint(id);if(!cp)return false;
      model.nav.teleport(navState,cp);checkpoint=id;visited.add(id);clearMotion();stepped=frame;syncPlayer();return true;
    }
    function nearAction(){
      const pos=local();if(!pos||!model)return null;let best=null,bestD=Infinity;
      for(const item of model.interactions||[]){const d=distance(pos,item.position);if(d<=(item.radius||2.5)&&d<bestD){best=item;bestD=d;}}
      return best;
    }
    function prompt(){
      if(!inside())return null;
      if(loading)return (region==='future'?'이동할 장소':'미래의 하연')+' 연결 중 · '+Math.round(loadProgress*100)+'%';
      if(region==='future'&&!model?.getLocation?.()?.buildingId){const text=model?.transport?.prompt?.(local());if(text)return text;}
      if(transit.riding)return transit.moving||transit.dwell>0?'HAEMU-07 자동 항해 · 도착 후 하선':'HAEMU-07 하선 · '+(transit.progress>.5?'잊힌 신전':'해양기록관 정박장');
      const action=nearAction();if(!action)return null;
      if(action.kind==='gate')return gateActive?'미래의 문 · 미래의 하연으로 이동':'미래의 문 · 봉인 공명 활성화';
      if(action.kind==='future-return')return '귀환 포탈 · 해저 신전으로 돌아가기';
      if(action.kind==='board')return 'HAEMU-07 탑승 · '+(action.endpoint===1?'해양기록관으로 귀환':'해저 신전으로 잠항');
      return action.label;
    }
    function board(endpoint){
      if(!inside()||region!=='abyss'||!model||Math.abs(transit.progress-endpoint)>.01)return false;
      transit.target=endpoint===0?1:0;transit.riding=true;transit.moving=true;transit.dwell=2;
      clearMotion();clearProjectiles();syncPassenger();getState().yaw=endpoint===0?0:Math.PI;getState().pitch=.16;
      options.onStoryEvent?.({kind:'event',id:'haemu-boarded'});
      say(endpoint===0?'HAEMU-07 · 해저 신전으로 자동 잠항 / 도착 후 E·F 하선':'HAEMU-07 · 도시 정박장으로 귀환 / 도착 후 E·F 하선');return true;
    }
    function disembark(){
      if(!transit.riding||transit.moving||transit.dwell>0)return false;
      const id=transit.progress>.5?'temple-berth':'city-berth';
      transit.riding=false;setCheckpoint(id);getState().yaw=transit.progress>.5?-Math.PI/2:Math.PI;
      clearProjectiles();say(transit.progress>.5?'잊힌 신전 · 밀폐 통로를 따라 성소로 들어가세요':'해양기록관 정박장 · 승강기로 B1에 올라가세요');return true;
    }
    function actionTransition(action,commit){
      const owner=player(),ownerState=getState(),ownerModel=model,token=loadToken;
      const current=()=>!disposed&&token===loadToken&&player()===owner&&getState()===ownerState&&model===ownerModel&&owner?.alive&&inside(owner)&&!transit.riding&&nearAction()===action;
      const apply=()=>current()?commit():false;
      if(typeof options.transitionAction!=='function')return apply();
      return options.transitionAction({kind:action.kind==='exit'?'basement-exit':'lift',
        label:action.kind==='exit'?'해양 현대미술관 · 1F':action.targetCheckpoint==='dock-lift'?'잠수함 정박장 · B2':'해양기록관 · B1',isCurrent:current},apply);
    }
    function futureMove(nextRegion,location,action=null,label='미래의 하연'){
      if(!inside()||loading||disposed||transit.riding||futureRiding()||!player()?.alive||options.isStoryOpen?.()||api()?.state!=='playing'||getState()?.mapOpen)return Promise.resolve(false);
      const T=getT(),scene=getThree()?.scene,owner=player(),ownerState=getState(),source=model,from=region;
      const changesEra=from!==nextRegion,sourceLocation=from==='future'?locationOf(source.getLocation?.()):null;
      if(!T||!scene||!source||!['abyss','future'].includes(nextRegion)||(!changesEra&&nextRegion!=='future'))return Promise.resolve(false);
      const loader=nextRegion==='future'?host.HanQFutureWorld:host.HanQAbyssWorld;
      if(!loader?.load){say('이동 자료를 찾을 수 없어요. 잠시 후 다시 시도해 주세요.','#eccda0');return Promise.resolve(false);}
      const destinationLocation=locationOf(location),token=++loadToken;
      const cache=worlds[nextRegion]?.root?.parent===scene?worlds[nextRegion]:null;
      const departure=local();let candidate=null,prepared=null,committed=false;
      loading=true;loadProgress=0;loadError=null;
      const current=()=>token===loadToken&&!disposed&&player()===owner&&getState()===ownerState&&getThree()?.scene===scene&&owner.alive&&inside(owner)&&model===source&&region===from&&api()?.state==='playing'&&!ownerState.mapOpen&&!options.isStoryOpen?.()&&(!action||nearAction()===action)&&(!sourceLocation||sameLocation(sourceLocation,locationOf(source.getLocation?.())));
      const discard=()=>{
        if(prepared)candidate?.discardLocation?.(prepared);prepared=null;
        if(!committed&&candidate&&candidate!==model&&candidate!==worlds[nextRegion])candidate.dispose?.();
        candidate=null;
        if(!committed&&token===loadToken){loading=false;loadProgress=0;}
      };
      say(label+' · 이동할 장소를 준비하는 중');
      loadPromise=Promise.resolve().then(()=>{
        if(!current())return null;
        return cache||loader.load({THREE:T,scene,onProgress:value=>{if(token===loadToken){const n=typeof value==='number'?value:value?.progress;if(Number.isFinite(n))loadProgress=clamp(n,0,1);}}});
      }).then(async world=>{
        candidate=world;
        if(!current()){discard();return false;}
        validateWorld(world);
        if(world!==source)world.root.visible=false;
        let view=world,record;
        if(nextRegion==='future'){
          if(typeof world.prepareLocation!=='function'||typeof world.commitLocation!=='function')throw Error('Future interior adapter missing');
          if(changesEra)world.transport?.restore?.(future.transport);
          prepared=await world.prepareLocation(destinationLocation);
          if(!current()){discard();return false;}
          if(!prepared?.nav||!prepared.bounds||!finite3(prepared.arrival?.position))throw Error('Future arrival is not ready');
          view={nav:prepared.nav,bounds:prepared.bounds,arrival:prepared.arrival,checkpoints:prepared.checkpoints};
          record={checkpoint:prepared.arrival.id,position:!changesEra&&sourceLocation?.buildingId&&!destinationLocation.buildingId?future.exteriorPosition:null};
        }else record={checkpoint:'temple-gate',position:future.returnPosition};
        const restored=newNav(view,record);
        if(![restored.state.position.x,restored.state.position.y,restored.state.position.z].every(Number.isFinite))throw Error('Invalid portal arrival pose');
        const arrival=view.arrival||view.nav.getCheckpoint(restored.checkpoint);
        loadProgress=1;
        const commit=()=>{
          if(committed)return true;
          if(!current())return false;
          if(prepared){world.commitLocation(prepared);validateWorld(world);prepared=null;}
          afterRender();source.root.visible=false;
          if(from==='future'){
            future.location=sourceLocation;future.position=departure?.slice()||null;future.checkpoint=checkpoint;future.transport=source.transport?.serialize?.()||future.transport;
            if(!changesEra&&!sourceLocation?.buildingId&&destinationLocation.buildingId)future.exteriorPosition=departure?.slice()||null;
          }
          if(changesEra&&nextRegion==='future')future.returnPosition=departure?.slice()||null;
          const previous=worlds[nextRegion];worlds[nextRegion]=world;model=world;region=nextRegion;
          navState=restored.state;checkpoint=restored.checkpoint;
          if(nextRegion==='future'){
            future.visited=true;future.location=locationOf(world.getLocation?.());future.position=navState.position.toArray();future.checkpoint=checkpoint;
          }else visited.add('temple-gate');
          Object.assign(transit,{progress:1,target:1,riding:false,moving:false,dwell:0});
          clearMotion(owner);detachCity(owner);syncPlayer();stepped=frame;clearProjectiles();
          ownerState.yaw=Number.isFinite(arrival?.yaw)?arrival.yaw:Math.PI/2;ownerState.pitch=.1;ownerState.mapOpen=false;
          loading=false;loadProgress=1;loadError=null;pendingRestore=null;committed=true;lastActive=time;
          if(previous&&previous!==world&&previous!==source)previous.dispose?.();
          if(changesEra)options.onEraChange?.({from:from==='future'?'future':'present',to:nextRegion==='future'?'future':'present'});
          say(nextRegion==='abyss'?'해저 신전 · 미래의 문으로 귀환':world.getLocationInfo?.().label||'미래의 하연 · 시공 터미널에 도착');
          return true;
        };
        await transition({kind:changesEra?'time-gate':destinationLocation.buildingId?'future-interior':'future-exit',label,isCurrent:current},commit);
        if(!committed)discard();return committed;
      }).catch(()=>{
        discard();if(committed)return true;
        if(token!==loadToken||disposed)return false;
        loading=false;loadProgress=0;loadError='load-failed';
        say('이동할 장소를 불러오지 못했어요. 현재 위치에서 다시 시도할 수 있어요.','#eccda0');return false;
      });
      return loadPromise;
    }
    function futureFloor(direction){
      if(region!=='future'||!inside()||loading)return Promise.resolve(false);
      const info=model?.getLocationInfo?.(),location=locationOf(model?.getLocation?.());
      if(!location.buildingId||!Number.isInteger(info?.floorCount))return Promise.resolve(false);
      const next=location.floor+(direction<0?-1:direction>0?1:0);
      if(next===location.floor||next<0||next>=info.floorCount)return Promise.resolve(false);
      return futureMove('future',{buildingId:location.buildingId,floor:next},null,(info.label||'건물 내부')+' · '+(next+1)+'F');
    }
    function futureExit(){
      if(region!=='future'||!inside()||!model?.getLocation?.()?.buildingId)return Promise.resolve(false);
      return futureMove('future',locationOf(null),null,'미래의 하연 · 건물 밖으로 이동');
    }
    function interact(){
      if(!inside())return false;
      if(loading||options.isStoryOpen?.())return true;
      if(transit.riding){if(!disembark())say('잠항 중입니다. 정박이 끝나면 하선할 수 있어요.');return true;}
      const action=nearAction();
      if(region==='future'){
        if(!model?.getLocation?.()?.buildingId){const result=model?.transport?.interact?.(local());if(result?.handled){if(result.position)model.nav.teleport(navState,{position:result.position});clearMotion();if(result.boarded)player().crouch=false;syncPlayer();if(result.message)say(result.message);return true;}}
        if(action?.kind==='future-transport'){
          const travel=futureMove('future',locationOf(null),action,action.label);loadPromise=Promise.resolve(travel).then(ok=>{if(!ok)return false;const result=model?.transport?.boardFromInterior?.(action.vehicleId);if(!result)return true;model.nav.teleport(navState,{position:result.position});clearMotion();player().crouch=false;syncPlayer();say('구조기 탑승 · WASD 이동 · Space 상승 · C 착륙');return true;});
        }
        else if(action?.kind==='future-return')futureMove('abyss',null,action,'해저 신전 · 미래의 문');
        else if(['future-enter','future-floor','future-exit'].includes(action?.kind))futureMove('future',action.kind==='future-exit'?locationOf(null):action.location,action,action.label||'미래의 하연 · 건물 내부');
        return true;
      }
      if(action?.kind==='exit')actionTransition(action,leave);
      else if(action?.kind==='lift')actionTransition(action,()=>{if(!setCheckpoint(action.targetCheckpoint))return false;say(action.label);return true;});
      else if(action?.kind==='board'){if(!board(action.endpoint===1?1:0))say('잠수함이 이 정박장에 정박해 있지 않습니다.','#eccda0');}
      else if(action?.kind==='gate'){
        if(gateActive){futureMove('future',locationOf(null),action,'미래의 하연 · 시공 터미널');return true;}
        gateActive=true;model.setPortal(true);visited.add('temple-gate');checkpoint='temple-gate';
        const result=options.onStoryEvent?.({kind:'event',id:'future-gate-active'});
        if(!result?.handled||result.silent)say('미래의 문이 열렸습니다. E / F 또는 손 버튼을 다시 누르면 미래의 하연으로 이동합니다.','#ead7ac');
      }else if(action?.kind==='lore'){
        const result=options.onStoryEvent?.({kind:'record',id:action.id});
        if(!result?.handled)say(action.detail||action.label,'#d9cfb4');
      }
      // Always consume E/F in this region; no interaction with a surface actor.
      return true;
    }
    function rememberCheckpoint(){
      if(!navState?.grounded||transit.riding||futureRiding())return;
      let nearest=3.5;for(const cp of model?.checkpoints||[]){const d=distance(local(),cp.position);if(d<nearest){nearest=d;checkpoint=cp.id;if(region==='abyss')visited.add(cp.id);}}
    }
    function move(e,mx,my,speed,dt){
      if(!inside(e))return false;
      if(!model||!navState)return true;
      if(options.isStoryOpen?.()){navState.velocity.set(0,0,0);stepped=frame;syncPlayer();return true;}
      if(transit.riding){syncPassenger();stepped=frame;return true;}
      if(futureRiding()){model.transport.move(Number.isFinite(mx)?mx:0,Number.isFinite(my)?my:0,dt,{land:!!e.crouch});syncFuturePassenger();stepped=frame;return true;}
      model.nav.step(navState,{move:{x:Number.isFinite(mx)?mx:0,z:Number.isFinite(my)?my:0},speed:Math.max(0,Number.isFinite(speed)?speed:0),jump:jumpPending},clamp(Number.isFinite(dt)?dt:0,0,.12));
      jumpPending=false;stepped=frame;
      e.step=(e.step||0)+Math.max(0,dt||0)*Math.hypot(navState.velocity.x,navState.velocity.z)*1.6;
      if(navState.needsRespawn||navState.fallDistance>12||!validPosition(local())){
        setCheckpoint(checkpoint);say('가까운 안전 발판으로 복귀했어요.','#eccda0');
      }
      syncPlayer();rememberCheckpoint();return true;
    }
    function vertical(e,dt){if(!inside(e))return false;if(api()?.state==='playing'&&!getState()?.mapOpen&&e.alive&&stepped!==frame)move(e,0,0,0,dt);if(e.rollCd>0)e.rollCd=Math.max(0,e.rollCd-dt);return true;}
    function resolve(e){if(!inside(e))return false;syncPlayer();return true;}
    function jump(e){if(!inside(e))return false;if(futureRiding()){model.transport.jump?.();return true;}if(!loading&&!options.isStoryOpen?.()&&!transit.riding&&navState?.grounded)jumpPending=true;return true;}
    function respawn(e=player()){
      if(!active||e!==player()||!model)return false;
      if(transit.riding){const endpoint=transit.progress>=.5?1:0;Object.assign(transit,{progress:endpoint,target:endpoint,riding:false,moving:false,dwell:0});model.setJourney(endpoint);checkpoint=endpoint?'temple-berth':'city-berth';}
      model?.transport?.abandon?.();e.abyss=true;clearMotion();setCheckpoint(checkpoint);return true;
    }
    function tick(dt){
      if(disposed)return;frame++;const seconds=clamp(Number.isFinite(dt)?dt:0,0,.12);time+=seconds;
      tryRestore();
      if(!active){if(model&&!loading&&!pendingRestore&&time-lastActive>RELEASE_AFTER)disposeModel();return;}
      lastActive=time;
      if(model?.root.parent!==getThree()?.scene){
        const record=serialize();pendingRestore=record;returnToCity();disposeModel();loadError=null;tryRestore();return;
      }
      if(api()?.state!=='playing'||getState()?.mapOpen||!player()?.alive)return;
      if(region==='future'&&!model?.getLocation?.()?.buildingId){model?.transport?.tick?.(seconds);if(futureRiding()){options.clearCombatInput?.();syncFuturePassenger();}}
      if(transit.riding){
        options.clearCombatInput?.();
        if(transit.dwell>0)transit.dwell=Math.max(0,transit.dwell-seconds);
        else if(transit.moving){
          const next=transit.progress+Math.sign(transit.target-transit.progress)*seconds/JOURNEY_SECONDS;
          transit.progress=transit.target===1?Math.min(1,next):Math.max(0,next);
          if(Math.abs(transit.target-transit.progress)<1e-6){transit.progress=transit.target;transit.moving=false;checkpoint=transit.target?'temple-berth':'city-berth';visited.add(checkpoint);say('정박 완료 · E / F 또는 손 버튼으로 하선');}
        }
        syncPassenger();
      }
    }
    function ground(x,z,y){if(!volume(x,z,y)||!model)return undefined;const h=model.nav.groundAt(x,z,y,.06);return h===null?-1e4:h;}
    function solid(x,z,y){
      if(!volume(x,z,y)||!model)return undefined;
      const hit=model.nav.pointSolid(x,y,z,0);if(!hit)return null;
      const top=hit.heightAt?.(x,z)??hit.maxY??y;
      return {kind:'abyssStone',hgt:top,floorTop:top,abyss:true};
    }
    function camera(view={}){
      if(!inside()||!model)return null;
      const p=player(),s=getState(),T=getT(),yaw=Number.isFinite(view.yaw)?view.yaw:s.yaw,pitch=Number.isFinite(view.pitch)?view.pitch:s.pitch;
      const dx=Math.cos(pitch)*Math.cos(yaw),dy=-Math.sin(pitch),dz=Math.cos(pitch)*Math.sin(yaw),feet=base(p);
      if(futureRiding()){const dist=model.transport.pose()?.kind==='train'?15:12,ty=feet+4,direction=new T.Vector3(dx,dy-.12,dz).normalize();return{x:p.x-dx*dist,y:ty-dy*dist,z:p.y-dz*dist,dx:direction.x,dy:direction.y,dz:direction.z,scope:false};}
      if(transit.riding){
        // Exterior follow view shows the actual moving hull, not an exposed avatar.
        const dist=23,ty=feet+7.5,aim=new T.Vector3(dx*dist,dy*dist-7,dz*dist).normalize();
        return{x:p.x-dx*dist,y:ty-dy*dist,z:p.y-dz*dist,dx:aim.x,dy:aim.y,dz:aim.z,scope:false};
      }
      const crouch=view.crouch??p.crouch,ads=clamp(Number.isFinite(view.ads)?view.ads:s.adsK||0,0,1);
      if(view.scope)return{x:p.x+Math.cos(yaw)*.1,y:feet+(crouch?1.15:1.6),z:p.y+Math.sin(yaw)*.1,dx,dy,dz,scope:true};
      const shoulder=.5-.2*ads,dist=3.1-1.7*ads,tx=p.x-Math.sin(yaw)*shoulder,tz=p.y+Math.cos(yaw)*shoulder,ty=feet+(crouch?1.12:1.65);
      const a=new T.Vector3(tx,ty,tz),b=new T.Vector3(tx-dx*dist,ty-dy*dist,tz-dz*dist);
      const safe=Math.max(.1,Math.min(dist,model.nav.cameraDistance(a,b,.18)));
      return{x:tx-dx*safe,y:ty-dy*safe,z:tz-dz*safe,dx,dy,dz,scope:false};
    }
    function afterRender(){
      if(!restoreFrame)return;const saved=restoreFrame;restoreFrame=null;
      for(const [node,visible]of saved.nodes)node.visible=visible;
      saved.scene.background=saved.background;saved.scene.fog=saved.fog;saved.scene.environment=saved.environment;
    }
    function render(dt){
      afterRender();if(disposed)return;
      const t3=getThree(),T=getT(),p=player();if(!t3?.scene||!T||!p)return;
      for(const world of Object.values(worlds))if(world&&world!==model)world.root.visible=false;
      if(!inside()||!model){if(model)model.root.visible=false;return;}
      model.setJourney(transit.progress);model.setPortal(gateActive);
      model.animate?.(time,api()?.state==='playing'&&!getState()?.mapOpen?dt:0,{position:navState.position,quality:options.getQuality?.()||'medium',riding:transit.riding});
      model.root.visible=true;
      const scene=t3.scene,keep=new Set([model.root]),nodes=[];
      const char=t3.chars?.get(p.id)?.group;
      const keepRoot=node=>{if(!node)return;while(node.parent&&node.parent!==scene)node=node.parent;if(node.parent===scene)keep.add(node);};
      if(char){keepRoot(char);if(transit.riding||futureRiding()){nodes.push([char,char.visible]);char.visible=false;}}
      keepRoot(t3.points);keepRoot(t3.boomLight);keepRoot(t3.tracerMesh);
      for(const key of ['tracerMeshes','flashSprites','fireSprites','scorchMeshes','nadeMeshes','rocketMeshes','rocketGlows','smokeSprites'])for(const node of t3[key]||[])keepRoot(node.group||node);
      for(const node of scene.children){if(keep.has(node)||node.isCamera)continue;nodes.push([node,node.visible]);node.visible=false;}
      restoreFrame={scene,nodes,background:scene.background,fog:scene.fog,environment:scene.environment};
      if(!renderStyle)renderStyle={background:new T.Color(0x03181f),fog:new T.Fog(0x031c25,42,175)};
      const style=region==='future'?model.renderStyle||renderStyle:renderStyle;
      scene.background=style.background;scene.fog=style.fog;scene.environment=style.environment||null;
    }
    function status(){
      const pos=local(),location=transit.riding?'HAEMU-07 · '+(transit.moving?'해저 항해':'정박 완료'):pos&&pos[0]>8?'해저 · 잊힌 신전':pos&&pos[1]<17?'B2 · 비밀 잠수함 정박장':'B1 · 해양기록관';
      const info=region==='future'?model?.getLocationInfo?.():null;
      const floorNavigation=info?.buildingId?{floor:info.floor,floorCount:info.floorCount,label:info.label,
        canPrevious:info.floor>0,canNext:info.floor<info.floorCount-1,busy:loading}:null;
      return {inside:inside(),era:region,position:pos,checkpoint,label:futureRiding()?model.transport.pose()?.label:region==='future'?(info?.label||'미래의 하연 · 시공 터미널'):location,
        detail:futureRiding()?model.transport.prompt(local()):region==='future'?(info?.buildingId?'◀ / ▶ 층 이동 · 출구로 건물 밖 · M 실내 지도':'M 미래 지도 · E / F 건물 입장 · 시공 터미널에서 신전 귀환'):transit.riding?(transit.moving?'잠항 경로 '+Math.round(transit.progress*100)+'% · 도착 후 하선':'E / F 또는 손 버튼으로 하선'):'M 지역 지도 · E / F 상호작용 · 잠수함으로 도시 귀환',
        depth:pos?Math.max(0,25-pos[1]):0,discovered,gateActive,visited:[...visited],riding:transit.riding||futureRiding(),transport:futureRiding()?model.transport.pose():null,transit:{...transit},
        futureVisited:future.visited,futureLocation:region==='future'?locationOf(model?.getLocation?.()):null,floorNavigation,
        modelReady:!!model,loading,loadProgress,loadError,pendingRestore:!!pendingRestore,geometry:model?.stats||null,prompt:prompt()};
    }
    function drawMap(c,rect={}){
      if(!inside()||!model)return false;
      if(region==='future'){
        if(typeof model.drawMap==='function')return model.drawMap(c,rect,{position:local(),yaw:getState().yaw,location:model.getLocation?.(),checkpoint})!==false;
        return drawFutureMap(c,rect);
      }
      const x=rect.x||0,y=rect.y||0,w=rect.w||rect.width||200,h=rect.h||rect.height||200,mini=!!rect.mini,pos=local();
      const pad=mini?10:28,top=mini?24:66,b=bounds(),scale=Math.min((w-pad*2)/(b.maxX-b.minX),(h-top-pad)/(b.maxZ-b.minZ));
      const mx=X=>x+w/2+(X-(b.minX+b.maxX)/2)*scale,mz=Z=>y+top+(h-top-pad)/2+(Z-(b.minZ+b.maxZ)/2)*scale;
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.fillStyle='#061b24';c.fillRect(x,y,w,h);
      c.fillStyle='#29434a';c.fillRect(mx(-63),mz(-10),42*scale,20*scale);c.fillStyle='#345051';c.fillRect(mx(28),mz(-27),52*scale,55*scale);
      c.strokeStyle='#73948d';c.lineWidth=mini?1:2;c.strokeRect(mx(-63),mz(-10),42*scale,20*scale);c.strokeRect(mx(28),mz(-27),52*scale,55*scale);
      const curve=model.routeCurve;if(curve){c.beginPath();for(let i=0;i<=60;i++){const p=curve.getPointAt(i/60);if(i)c.lineTo(mx(p.x),mz(p.z));else c.moveTo(mx(p.x),mz(p.z));}c.strokeStyle='#56baad';c.lineWidth=mini?1.5:2.5;c.stroke();}
      c.font=(mini?'8':'11')+'px sans-serif';c.textBaseline='middle';c.textAlign='left';
      const labels=new Set(['basement-arrival','city-berth','temple-berth','temple-gate']);
      for(const cp of model.checkpoints||[]){
        if(!labels.has(cp.id))continue;const [px,,pz]=cp.position;c.fillStyle=cp.id==='temple-gate'?'#eed19c':'#9bdfcf';c.beginPath();c.arc(mx(px),mz(pz),mini?2.5:4,0,Math.PI*2);c.fill();
        if(!mini)c.fillText(cp.label,mx(px)+7,mz(pz)-9,180);
      }
      for(const marker of options.getStory?.()?.markers?.('abyss')||[]){
        if(marker.kind!=='record'&&!marker.active)continue;
        const [px,,pz]=marker.position;
        c.fillStyle=marker.active?'#ffe092':marker.read?'#80cdb4':'#d6a96f';c.strokeStyle='#08232b';c.lineWidth=2;
        c.beginPath();c.arc(mx(px),mz(pz),marker.active?(mini?4:7):(mini?2.5:4),0,Math.PI*2);c.fill();c.stroke();
        if(!mini)c.fillText((marker.active?'조사 목표 · ':'')+(marker.id==='museum-register'?'B1 소장기록':marker.id==='temple-testimony'?'신전 인계 기록':marker.label),mx(px)+9,mz(pz)+11,205);
      }
      c.fillStyle='#fff2c9';c.beginPath();c.arc(mx(pos[0]),mz(pos[2]),mini?3.5:5,0,Math.PI*2);c.fill();
      c.strokeStyle='#fff2c9';c.beginPath();c.moveTo(mx(pos[0]),mz(pos[2]));c.lineTo(mx(pos[0])+Math.cos(getState().yaw)*13,mz(pos[2])+Math.sin(getState().yaw)*13);c.stroke();
      c.fillStyle='#061b24';c.fillRect(x,y,w,top-6);c.textAlign='left';c.textBaseline='top';c.fillStyle='#e1d2ac';c.font='bold '+(mini?10:18)+'px sans-serif';c.fillText(mini?'해양기록관 · 신전':'해양기록관  /  잊힌 신전',x+pad,y+(mini?6:16));
      if(!mini){c.fillStyle='#a2c7c1';c.font='12px sans-serif';c.fillText('B1 ↔ B2 승강기 · 청록선: 잠수함 항로 · 황금빛: 미래의 문 · M 닫기',x+pad,y+43,w-pad*2);}
      c.restore();return true;
    }
    function drawFutureMap(c,rect={}){
      const x=rect.x||0,y=rect.y||0,w=rect.w||rect.width||200,h=rect.h||rect.height||200,mini=!!rect.mini,pos=local(),b=bounds();
      const pad=mini?10:26,top=mini?26:58,scale=Math.min((w-2*pad)/Math.max(1,b.maxX-b.minX),(h-top-pad)/Math.max(1,b.maxZ-b.minZ));
      const mx=v=>x+w/2+(v-(b.minX+b.maxX)/2)*scale,mz=v=>y+top+(h-top-pad)/2+(v-(b.minZ+b.maxZ)/2)*scale;
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.fillStyle='#102b32';c.fillRect(x,y,w,h);
      c.strokeStyle='#5a9797';c.lineWidth=1;c.strokeRect(mx(b.minX),mz(b.minZ),(b.maxX-b.minX)*scale,(b.maxZ-b.minZ)*scale);
      for(const item of model.interactions||[]){if(!finite3(item.position))continue;const p=item.position;c.fillStyle=item.kind==='future-return'?'#f5d491':'#72d4c7';c.beginPath();c.arc(mx(p[0]),mz(p[2]),mini?2:4,0,Math.PI*2);c.fill();}
      c.fillStyle='#fff0bd';c.beginPath();c.arc(mx(pos[0]),mz(pos[2]),mini?3:5,0,Math.PI*2);c.fill();
      c.strokeStyle='#fff0bd';c.beginPath();c.moveTo(mx(pos[0]),mz(pos[2]));c.lineTo(mx(pos[0])+Math.cos(getState().yaw)*12,mz(pos[2])+Math.sin(getState().yaw)*12);c.stroke();
      c.fillStyle='#102b32';c.fillRect(x,y,w,top-5);c.textAlign='left';c.textBaseline='top';c.fillStyle='#dcf0e3';c.font='bold '+(mini?10:17)+'px sans-serif';c.fillText(model.getLocationInfo?.().label||'미래의 하연',x+pad,y+8,w-pad*2);
      if(!mini){c.font='11px sans-serif';c.fillStyle='#9dcac8';c.fillText('황금빛: 해저 신전 귀환 포탈 · 청록빛: 건물과 층 이동 · M 닫기',x+pad,y+34,w-pad*2);}
      c.restore();return true;
    }
    function disposeModel(){
      afterRender();if(navState)savedPosition=local();
      for(const item of new Set([model,...Object.values(worlds)]))item?.dispose?.();
      model=null;worlds.abyss=worlds.future=null;navState=null;renderStyle=null;
    }
    function dispose(){if(disposed)return;++loadToken;loading=false;loadPromise=null;pendingRestore=null;disposeModel();disposed=true;active=false;}
    return {install,enter,leave,dispose,disposeModel,inside,base,move,vertical,resolve,jump,interact,prompt,tick,render,afterRender,serialize,camera,solid,volume,ground,contains,status,respawn,drawMap,futureFloor,futureExit,
      inspectionActive:()=>inside()&&!!options.isStoryOpen?.(),blocksCombat:()=>inside()&&(loading||transit.riding||futureRiding()||!!options.isStoryOpen?.()),whenReady:()=>loadPromise||Promise.resolve(!!model)};
  }
  host.HanQAbyss=Object.freeze({version:VERSION,create});
})(typeof window!=='undefined'?window:globalThis);
