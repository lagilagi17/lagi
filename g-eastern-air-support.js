/* Eastern Front air support. The host owns models, targets, shells and damage.
 * At most one bomber per faction follows a finite base-to-area-to-base mission.
 * All flight state is serializable; cached arc lengths contain no gameplay state.
 */
(function(global){
  'use strict';
  const VERSION='eastern-air-support-20261124-v2';
  const RULES=Object.freeze({limit:1,cooldown:60,enemyCooldown:120,orbitRadius:88,speed:65,loiter:45,
    shells:12,shotInterval:3.5,areaRadius:32,hp:600,takeoff:5,landing:5});
  const PHASES=['takeoff','approach','orbit','return','landing'];
  const NUMBERS=['x','y','h','yaw','pitch','roll','hp','maxHp','phaseTime','phaseDuration','age','cruiseH',
    'entryAngle','direction','returnYaw','ammo','shotsFired','slot','nextShot','orbitRemaining'];
  const TAU=Math.PI*2,finite=Number.isFinite,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const copy=p=>({x:p.x,y:p.y,h:p.h}),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function create(options={}){
    const b=options.bounds||{minX:0,maxX:4096,minY:0,maxY:4096};
    if(!['minX','maxX','minY','maxY'].every(k=>finite(b[k]))||b.minX>=b.maxX||b.minY>=b.maxY)
      throw new TypeError('Air support requires finite world bounds');
    const bounds={...b},missions=[],cache=new Map();
    let clock=0,nextId=1,readyAt={ally:0,enemy:0},events=[];
    const teamOK=t=>t==='ally'||t==='enemy';
    const pointOK=(p,pad=0)=>!!p&&[p.x,p.y,p.h].every(finite)&&
      p.x>=bounds.minX-pad&&p.x<=bounds.maxX+pad&&p.y>=bounds.minY-pad&&p.y<=bounds.maxY+pad&&p.h>=-30&&p.h<=1000;
    const sourceOK=p=>pointOK(p)&&p.h<=988&&typeof p.id==='string'&&p.id.length>0&&p.id.length<=128&&
      typeof p.name==='string'&&p.name.length<=160;
    function snapshot(m){return {id:m.id,team:m.team,phase:m.phase,withdrawal:m.withdrawal===true,...Object.fromEntries(NUMBERS.map(k=>[k,m[k]])),
      source:{id:m.source.id,name:m.source.name,...copy(m.source)},target:copy(m.target),path:m.path?.map(copy)||null};}
    function emit(type,m,extra={}){
      events.push({type,missionId:m.id,team:m.team,sourceId:m.source.id,sourceName:m.source.name,...extra});
      if(events.length>64)events.splice(0,events.length-64);
    }
    function curve(points,t){
      const a=1-t,w=[a*a*a,3*a*a*t,3*a*t*t,t*t*t];
      return {x:points.reduce((n,p,i)=>n+p.x*w[i],0),y:points.reduce((n,p,i)=>n+p.y*w[i],0),
        h:points.reduce((n,p,i)=>n+p.h*w[i],0)};
    }
    function derivative(points,t){
      const a=1-t,w=[a*a,2*a*t,t*t];
      return {x:3*w.reduce((n,v,i)=>n+(points[i+1].x-points[i].x)*v,0),
        y:3*w.reduce((n,v,i)=>n+(points[i+1].y-points[i].y)*v,0),
        h:3*w.reduce((n,v,i)=>n+(points[i+1].h-points[i].h)*v,0)};
    }
    function arcTable(points){
      const lengths=[0];let prev=curve(points,0),total=0;
      for(let i=1;i<=48;i++){
        const p=curve(points,i/48);total+=Math.hypot(p.x-prev.x,p.y-prev.y,p.h-prev.h);lengths.push(total);prev=p;
      }
      return {path:points,lengths,total};
    }
    function table(m){
      let result=cache.get(m.id);if(result?.path===m.path)return result;
      result=arcTable(m.path);cache.set(m.id,result);return result;
    }
    function pathTime(arc,progress){
      const distance=clamp(progress,0,1)*arc.total;
      let i=1;while(i<48&&arc.lengths[i]<distance)i++;
      return clamp((i-1+(distance-arc.lengths[i-1])/Math.max(1e-9,arc.lengths[i]-arc.lengths[i-1]))/48,0,1);
    }
    function positionOnPath(m){
      const t=pathTime(table(m),m.phaseTime/m.phaseDuration),p=curve(m.path,t),d=derivative(m.path,t);
      m.x=p.x;m.y=p.y;m.h=p.h;
      if(Math.hypot(d.x,d.y)>.00001)m.yaw=Math.atan2(d.y,d.x);
      m.pitch=Math.atan2(d.h,Math.hypot(d.x,d.y));m.roll=0;
    }
    function setPath(m,phase,points,duration){
      m.phase=phase;m.phaseTime=0;m.path=points.map(copy);cache.delete(m.id);
      m.phaseDuration=duration||Math.max(.2,table(m).total/RULES.speed);
      positionOnPath(m);
    }
    function straight(a,d){return [copy(a),{x:a.x+(d.x-a.x)/3,y:a.y+(d.y-a.y)/3,h:a.h+(d.h-a.h)/3},
      {x:a.x+(d.x-a.x)*2/3,y:a.y+(d.y-a.y)*2/3,h:a.h+(d.h-a.h)*2/3},copy(d)];}
    function endpoint(m){return {x:m.target.x+Math.cos(m.entryAngle)*RULES.orbitRadius,
      y:m.target.y+Math.sin(m.entryAngle)*RULES.orbitRadius,h:m.cruiseH};}
    function startApproach(m){
      const a=copy(m),end=endpoint(m),distance=Math.hypot(end.x-a.x,end.y-a.y),lead=clamp(distance*.3,24,150);
      const tangent=m.entryAngle+m.direction*Math.PI/2;
      setPath(m,'approach',[a,{x:a.x+Math.cos(m.yaw)*lead,y:a.y+Math.sin(m.yaw)*lead,h:m.cruiseH},
        {x:end.x-Math.cos(tangent)*lead,y:end.y-Math.sin(tangent)*lead,h:m.cruiseH},end]);
    }
    function startOrbit(m){
      m.phase='orbit';m.phaseTime=0;m.phaseDuration=RULES.loiter;m.path=null;cache.delete(m.id);
      m.orbitRemaining=RULES.loiter;m.nextShot=RULES.shotInterval;m.slot=0;
      m.yaw=wrap(m.entryAngle+m.direction*Math.PI/2);m.pitch=0;m.roll=-m.direction*.28;
      emit('orbit',m,{target:copy(m.target)});
    }
    function startReturn(m,reason='complete'){
      if(m.phase==='return'||m.phase==='landing')return false;
      const a=copy(m),direction=Math.atan2(m.source.y-a.y,m.source.x-a.x);
      const length=Math.hypot(m.source.x-a.x,m.source.y-a.y),inset=Math.min(60,length*.4);
      const end={x:m.source.x-Math.cos(direction)*inset,y:m.source.y-Math.sin(direction)*inset,h:m.cruiseH};
      const lead=clamp(length*.25,15,130);
      m.returnYaw=direction;
      setPath(m,'return',[a,{x:a.x+Math.cos(m.yaw)*lead,y:a.y+Math.sin(m.yaw)*lead,h:Math.max(a.h,m.cruiseH)},
        {x:end.x-Math.cos(direction)*lead,y:end.y-Math.sin(direction)*lead,h:m.cruiseH},end]);
      emit('return',m,{reason});return true;
    }
    function startLanding(m){
      setPath(m,'landing',straight(m,{x:m.source.x,y:m.source.y,h:m.source.h+12}),RULES.landing);
    }
    function terrain(x,y,fallback){
      const value=options.getGround?.(x,y);return finite(value)&&value>=-30&&value<=900?value:fallback;
    }
    function cruiseHeight(source,target){
      let top=Math.max(source.h,target.h);
      for(let i=0;i<=16;i++)top=Math.max(top,terrain(source.x+(target.x-source.x)*i/16,source.y+(target.y-source.y)*i/16,top));
      for(let i=0;i<16;i++)top=Math.max(top,terrain(target.x+Math.cos(i*TAU/16)*RULES.orbitRadius,
        target.y+Math.sin(i*TAU/16)*RULES.orbitRadius,top));
      return Math.min(1000,top+100);
    }
    function request(input){
      if(!input||!teamOK(input.team)||!sourceOK(input.source)||!pointOK(input.target))return {ok:false,reason:'invalid'};
      const team=input.team;
      if(missions.some(m=>m.team===team))return {ok:false,reason:'limit'};
      if(readyAt[team]>clock+.00001)return {ok:false,reason:'cooldown',cooldown:readyAt[team]-clock};
      if(nextId>1000000)return {ok:false,reason:'limit'};
      const source={id:input.source.id,name:input.source.name,...copy(input.source)},target=copy(input.target);
      const angle=Math.atan2(source.y-target.y,source.x-target.x),direction=team==='ally'?1:-1;
      const cruiseH=cruiseHeight(source,target),entry={x:target.x+Math.cos(angle)*RULES.orbitRadius,y:target.y+Math.sin(angle)*RULES.orbitRadius};
      const yaw=Math.atan2(entry.y-source.y,entry.x-source.x);
      const m={id:'ef-air-'+team+'-'+nextId++,team,source,target,x:source.x,y:source.y,h:source.h+12,
        yaw,pitch:0,roll:0,hp:RULES.hp,maxHp:RULES.hp,phase:'takeoff',phaseTime:0,phaseDuration:0,
        path:null,withdrawal:false,age:0,cruiseH,entryAngle:angle,direction,returnYaw:0,ammo:RULES.shells,shotsFired:0,
        slot:0,nextShot:RULES.shotInterval,orbitRemaining:RULES.loiter};
      const distance=Math.min(60,Math.max(25,Math.hypot(entry.x-source.x,entry.y-source.y)*.2));
      const end={x:source.x+Math.cos(yaw)*distance,y:source.y+Math.sin(yaw)*distance,h:cruiseH};
      setPath(m,'takeoff',straight(m,end),RULES.takeoff);
      missions.push(m);readyAt[team]=clock+(team==='enemy'?RULES.enemyCooldown:RULES.cooldown);emit('departed',m,{target:copy(target)});
      return {ok:true,mission:snapshot(m)};
    }
    function fire(m,context){
      // Each opportunity is consumed even when combat is suspended. Coming
      // back into range cannot release a backlog of delayed shots.
      const slot=m.slot++;
      if(m.ammo<=0||typeof context.canAttack!=='function'||!context.canAttack(snapshot(m)))return;
      const angle=slot*2.399963229728653,radius=slot===0?0:RULES.areaRadius*Math.sqrt(((slot*7)%11+1)/12);
      const x=clamp(m.target.x+Math.cos(angle)*radius,bounds.minX,bounds.maxX),
        y=clamp(m.target.y+Math.sin(angle)*radius,bounds.minY,bounds.maxY);
      const target={x,y,h:terrain(x,y,m.target.h)};
      m.ammo--;m.shotsFired++;
      emit('shot',m,{shot:m.shotsFired,from:copy(m),target});
    }
    function step(dt,context){
      clock+=dt;
      for(let i=missions.length-1;i>=0;i--){
        const m=missions[i];m.age+=dt;m.phaseTime+=dt;
        if(m.phase==='orbit'){
          const angle=m.entryAngle+m.direction*RULES.speed/RULES.orbitRadius*Math.min(m.phaseTime,RULES.loiter);
          m.x=m.target.x+Math.cos(angle)*RULES.orbitRadius;m.y=m.target.y+Math.sin(angle)*RULES.orbitRadius;
          m.h=m.cruiseH;m.yaw=wrap(angle+m.direction*Math.PI/2);m.pitch=0;m.roll=-m.direction*.28;
          m.orbitRemaining=Math.max(0,RULES.loiter-m.phaseTime);
          if(m.phaseTime+.000001>=m.nextShot&&m.slot<RULES.shells){fire(m,context);m.nextShot+=RULES.shotInterval;}
          if(m.phaseTime+.000001>=RULES.loiter)startReturn(m);
        }else{
          positionOnPath(m);
          if(m.phaseTime+.000001>=m.phaseDuration){
            if(m.phase==='takeoff')startApproach(m);
            else if(m.phase==='approach')startOrbit(m);
            else if(m.phase==='return'&&!m.withdrawal)startLanding(m);
            else if(m.withdrawal){emit('withdrawn',m);missions.splice(i,1);cache.delete(m.id);}
            else {emit('landed',m);missions.splice(i,1);cache.delete(m.id);}
          }
        }
      }
    }
    function update(dt,context={}){
      if(!finite(dt)||dt<=0||dt>60||clock+dt>1e9)return false;
      for(let left=dt;left>.00000001;){const tick=Math.min(.1,left);step(tick,context);left-=tick;}
      return true;
    }
    function status(team){return {count:missions.filter(m=>m.team===team).length,
      cooldown:teamOK(team)?Math.max(0,readyAt[team]-clock):0,limit:RULES.limit};}
    function recall(id){const m=missions.find(m=>m.id===id);return !!m&&startReturn(m,'recalled');}
    function returnTo(id,source){
      const m=missions.find(m=>m.id===id);if(!m||!sourceOK(source))return false;
      m.source={id:source.id,name:source.name,...copy(source)};
      m.cruiseH=Math.max(m.cruiseH,cruiseHeight(source,{...copy(m),h:terrain(m.x,m.y,m.cruiseH-100)}));m.withdrawal=false;
      // A captured home may change while already returning. Rebuild from the
      // current pose, never from either base's position.
      if(m.phase==='return'||m.phase==='landing')m.phase='approach';
      return startReturn(m,'base-changed');
    }
    function withdraw(id){
      const m=missions.find(m=>m.id===id);if(!m||m.withdrawal)return false;
      const a=copy(m),x=clamp(m.x,bounds.minX,bounds.maxX),y=clamp(m.y,bounds.minY,bounds.maxY);
      const ends=[{x:bounds.minX-240,y},{x:bounds.maxX+240,y},{x,y:bounds.minY-240},{x,y:bounds.maxY+240}];
      ends.sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y));
      const end=ends[0],direction=Math.atan2(end.y-a.y,end.x-a.x),distance=Math.hypot(end.x-a.x,end.y-a.y);
      // Withdrawal samples only its new leg. It preserves the old home record
      // for reporting, but never descends onto a base owned by the other team.
      m.cruiseH=Math.max(m.cruiseH,cruiseHeight({...a,h:terrain(a.x,a.y,m.cruiseH-100)},
        {...end,h:terrain(end.x,end.y,m.cruiseH-100)}));
      end.h=m.cruiseH;m.returnYaw=direction;m.withdrawal=true;
      const lead=clamp(distance*.25,15,130);
      setPath(m,'return',[a,{x:a.x+Math.cos(m.yaw)*lead,y:a.y+Math.sin(m.yaw)*lead,h:m.cruiseH},
        {x:end.x-Math.cos(direction)*lead,y:end.y-Math.sin(direction)*lead,h:m.cruiseH},end]);
      emit('return',m,{reason:'withdrawal'});return true;
    }
    function damage(id,amount){
      const i=missions.findIndex(m=>m.id===id);
      if(i<0||!finite(amount)||amount<=0)return {hit:false,destroyed:false};
      const m=missions[i];m.hp=Math.max(0,m.hp-amount);
      if(!m.hp){emit('destroyed',m,{from:copy(m)});missions.splice(i,1);cache.delete(m.id);}
      return {hit:true,destroyed:!m.hp,hp:m.hp};
    }
    function serialize(){return {version:1,clock,nextId,readyAt:{...readyAt},missions:missions.map(snapshot)};}
    function validMission(m,ids,teams,save){
      if(!m||!teamOK(m.team)||teams.has(m.team)||typeof m.id!=='string'||ids.has(m.id)||
        !new RegExp('^ef-air-'+m.team+'-[1-9][0-9]{0,6}$').test(m.id)||Number(m.id.split('-').at(-1))>=save.nextId||
        !sourceOK(m.source)||!pointOK(m.target)||!pointOK(m,512)||!PHASES.includes(m.phase)||
        (m.withdrawal!==undefined&&typeof m.withdrawal!=='boolean')||(m.withdrawal&&m.phase!=='return'))return false;
      if(!NUMBERS.every(k=>finite(m[k]))||Math.abs(m.yaw)>TAU||Math.abs(m.pitch)>Math.PI||Math.abs(m.roll)>Math.PI||
        m.hp<=0||m.hp>RULES.hp||m.maxHp!==RULES.hp||m.age<0||m.age>600||m.phaseTime<0||m.phaseTime>m.phaseDuration+.101||m.age+.001<m.phaseTime||
        m.phaseDuration<=0||m.phaseDuration>300||m.cruiseH<0||m.cruiseH>1000||Math.abs(m.entryAngle)>Math.PI||
        Math.abs(m.returnYaw)>Math.PI||![1,-1].includes(m.direction)||m.direction!==(m.team==='ally'?1:-1)||
        ![m.ammo,m.shotsFired,m.slot].every(Number.isInteger)||m.ammo<0||m.ammo>RULES.shells||
        m.shotsFired<0||m.shotsFired>RULES.shells||m.ammo+m.shotsFired!==RULES.shells||m.slot<m.shotsFired||m.slot>RULES.shells||
        m.nextShot< RULES.shotInterval||m.nextShot>(RULES.shells+1)*RULES.shotInterval||
        m.nextShot!==(m.slot+1)*RULES.shotInterval||m.orbitRemaining<0||m.orbitRemaining>RULES.loiter)return false;
      if(m.phase==='orbit'){
        const angle=m.entryAngle+m.direction*RULES.speed/RULES.orbitRadius*m.phaseTime;
        if(m.path!==null||m.phaseDuration!==RULES.loiter||Math.abs(m.orbitRemaining-(RULES.loiter-m.phaseTime))>.101||
          Math.abs(m.x-m.target.x-Math.cos(angle)*RULES.orbitRadius)>.02||
          Math.abs(m.y-m.target.y-Math.sin(angle)*RULES.orbitRadius)>.02||Math.abs(m.h-m.cruiseH)>.02||
          m.slot!==Math.min(RULES.shells,Math.floor((m.phaseTime+.000001)/RULES.shotInterval)))return false;
      }else{
        if(!Array.isArray(m.path)||m.path.length!==4||!m.path.every(p=>pointOK(p,512)))return false;
        const arc=arcTable(m.path),expected=curve(m.path,pathTime(arc,m.phaseTime/m.phaseDuration));
        if(Math.hypot(m.x-expected.x,m.y-expected.y,m.h-expected.h)>.02)return false;
        if((m.phase==='takeoff'||m.phase==='landing')&&m.phaseDuration!==RULES[m.phase])return false;
        if((m.phase==='approach'||m.phase==='return')&&Math.abs(m.phaseDuration-Math.max(.2,arc.total/RULES.speed))>.000001)return false;
        if((m.phase==='takeoff'||m.phase==='approach')&&(m.slot!==0||m.shotsFired!==0||m.orbitRemaining!==RULES.loiter))return false;
      }
      ids.add(m.id);teams.add(m.team);return true;
    }
    function restore(saved){
      if(!saved||saved.version!==1||!finite(saved.clock)||saved.clock<0||saved.clock>1e9||
        !Number.isSafeInteger(saved.nextId)||saved.nextId<1||saved.nextId>1000001||!saved.readyAt||
        !['ally','enemy'].every(t=>finite(saved.readyAt[t])&&saved.readyAt[t]>=0&&saved.readyAt[t]<=saved.clock+RULES.enemyCooldown+.001)||
        !Array.isArray(saved.missions)||saved.missions.length>2)return false;
      const ids=new Set(),teams=new Set();
      if(!saved.missions.every(m=>validMission(m,ids,teams,saved)))return false;
      // Validation is transactional. A malformed save leaves current sorties,
      // cooldowns and outstanding events intact.
      const records=saved.missions.map(snapshot);
      clock=saved.clock;nextId=saved.nextId;
      // Existing saves used a two-minute allied timer; retain their sorties
      // and cap the remaining allied wait to the current one-minute rule.
      readyAt={ally:Math.min(saved.readyAt.ally,clock+RULES.cooldown),enemy:saved.readyAt.enemy};
      missions.splice(0,missions.length,...records);
      cache.clear();events=[];return true;
    }
    return {request,update,status,recall,returnTo,withdraw,damage,serialize,restore,
      getMissions:()=>missions.map(snapshot),drainEvents(){const out=events;events=[];return out;}};
  }
  global.HanQEasternAirSupport=Object.freeze({version:VERSION,rules:RULES,create});
})(typeof window!=='undefined'?window:globalThis);
