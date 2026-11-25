/* HanQ A melee camera and explicit enemy focus. No rendering or combat dependency.
 * Native convention: actor x/y are ground X/Z; aim/viewYaw 0 faces world +X.
 * The host supplies combat eligibility, floor/room checks, and scenery visibility.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HanQMeleeFocus=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const DEG=Math.PI/180,TAU=Math.PI*2;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const finite=(n,f=0)=>Number.isFinite(n)?n:f;
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const delta=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  // The selected preview uses +.98 in its camera-back yaw convention. Native
  // forward yaw therefore needs -.98: the player stays left of the opponent.
  const PRESET=Object.freeze({id:'A',name:'사선 추적',yawOffset:-.98,elevation:29*DEG,fov:42,distance:5.3});
  const DEFAULTS=Object.freeze({acquireRange:6.5,retainRange:8,maxHeightDifference:2,
    scanInterval:.25,visibilityInterval:.08,maxScan:1024,maxLineChecks:8});

  function basis(yaw,elevation){
    const c=Math.cos(yaw),s=Math.sin(yaw),ce=Math.cos(elevation),se=Math.sin(elevation);
    return {right:[-s,0,c],up:[c*se,ce,s*se],back:[-c*ce,se,-s*ce]};
  }
  function safeRectangle(width,height,insets){
    const a=insets||{},minW=Math.min(40,width),minH=Math.min(40,height);
    let left=clamp(finite(a.left,12),0,width-minW),right=width-clamp(finite(a.right,12),0,width-minW);
    let top=clamp(finite(a.top,18),0,height-minH),bottom=height-clamp(finite(a.bottom,18),0,height-minH);
    if(right-left<minW){left=clamp((left+right-minW)/2,0,width-minW);right=left+minW;}
    if(bottom-top<minH){top=clamp((top+bottom-minH)/2,0,height-minH);bottom=top+minH;}
    return {left,right,top,bottom,width:right-left,height:bottom-top};
  }
  function envelope(actor){
    const x=finite(actor.x),z=finite(actor.y),h=finite(actor.h),yaw=finite(actor.aim);
    const c=Math.cos(yaw),s=Math.sin(yaw),reach=clamp(finite(actor.reach,.95),.65,2.6),points=[];
    const add=(side,height,front)=>points.push([x+c*front-s*side,h+height,z+s*front+c*side]);
    // Stable body/hand/weapon bounds avoid zooming in and out with every strike.
    for(const side of [-.37,.37])for(const height of [-.05,2.04])for(const front of [-.33,.33])add(side,height,front);
    for(const angle of [-1.28,-.64,0,.64,1.28])for(const height of [.72,1.62])
      add(Math.sin(angle)*reach,height,Math.cos(angle)*reach);
    add(0,Math.max(2.04,1.05+reach),.2);
    return points;
  }

  /** Pure camera solve. Actor h is feet height; x/y retain native ground axes.
   * insets are pixels in the same coordinate space as width/height. A regular,
   * symmetric perspective projection is sufficient; no view offset is needed.
   * Optional anchor/viewYaw/distance are used by the smooth runtime rig.
   */
  function solveCamera(options={}){
    const p=options.player||{},t=options.target||null;
    const width=Math.max(1,finite(options.width,800)),height=Math.max(1,finite(options.height,600));
    const safe=safeRectangle(width,height,options.insets),cx=(safe.left+safe.right)/2,cy=(safe.top+safe.bottom)/2;
    const pairYaw=t&&Math.hypot(finite(t.x)-finite(p.x),finite(t.y)-finite(p.y))>.08
      ?Math.atan2(t.y-p.y,t.x-p.x):finite(p.aim);
    const viewYaw=wrap(finite(options.viewYaw,pairYaw+PRESET.yawOffset));
    const elevation=clamp(finite(options.elevation,PRESET.elevation),12*DEG,58*DEG);
    const {right,up,back}=basis(viewYaw,elevation),focal=height/(2*Math.tan(PRESET.fov*DEG/2));
    const ox=cx-width/2,oy=height/2-cy,qx=ox/focal,qy=oy/focal;
    const points=envelope(p).concat(t?envelope(t):[]);
    let anchor=Array.isArray(options.anchor)&&options.anchor.length===3&&options.anchor.every(Number.isFinite)
      ?options.anchor.slice():[(finite(p.x)+(t?finite(t.x):finite(p.x)))/2,
        (finite(p.h)+(t?finite(t.h):finite(p.h)))/2+1,(finite(p.y)+(t?finite(t.y):finite(p.y)))/2];
    if(!options.anchor){
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(const point of points){const v=delta(point,anchor),z=dot(v,back),x=dot(v,right)+qx*z,y=dot(v,up)+qy*z;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
      const x=(minX+maxX)/2,y=(minY+maxY)/2;
      anchor=anchor.map((v,i)=>v+right[i]*x+up[i]*y);
    }
    const margin=Math.min(8,safe.width*.035,safe.height*.035);
    const halfW=Math.max(.1,safe.width/2-margin),halfH=Math.max(.1,safe.height/2-margin);
    let required=.4;
    for(const point of points){const v=delta(point,anchor),z=dot(v,back),x=dot(v,right),y=dot(v,up);
      required=Math.max(required,z+.15,z+Math.abs(focal*x+ox*z)/halfW,z+Math.abs(focal*y+oy*z)/halfH);}
    const distance=Math.max(PRESET.distance,required+.06,finite(options.distance));
    // Translating along the camera plane puts the combat envelope in the HUD's
    // free rectangle while retaining a normal Three.js projection and ray.
    const look=anchor.map((v,i)=>v-right[i]*qx*distance-up[i]*qy*distance);
    const position=look.map((v,i)=>v+back[i]*distance);
    return {x:position[0],y:position[1],z:position[2],dx:-back[0],dy:-back[1],dz:-back[2],
      lx:look[0],ly:look[1],lz:look[2],look,anchor,position,right,up,back,
      viewYaw,elevation,fov:PRESET.fov,distance,fitDistance:required,width,height,focal,safeRect:safe,
      points,scope:false,meleeFocus:true,locked:!!t,targetId:t&&t.id!=null?t.id:null};
  }
  function project(camera,point){
    const p=Array.isArray(point)?point:[point.x,point.y,point.z];
    const v=[p[0]-camera.x,p[1]-camera.y,p[2]-camera.z],depth=-dot(v,camera.back);
    const scale=camera.focal/Math.max(.0001,depth),x=camera.width/2+dot(v,camera.right)*scale,y=camera.height/2-dot(v,camera.up)*scale;
    const r=camera.safeRect;
    return {x,y,depth,visible:depth>.05&&x>=0&&x<=camera.width&&y>=0&&y<=camera.height,
      inSafe:depth>.05&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom};
  }

  /** Host callbacks: canUse(player), isEligible(candidate,player),
   * hasLineOfSight(player,candidate), getBaseY(actor), getFacing(actor),
   * getReach(actor), getViewYaw(). All are read-only; this module never aims,
   * attacks, damages, or changes a native actor or saved game.
   */
  function create(host={}){
    const getPlayer=typeof host.getPlayer==='function'?host.getPlayer:()=>null;
    const getActors=typeof host.getActors==='function'?host.getActors:()=>[];
    const baseY=typeof host.getBaseY==='function'?host.getBaseY:a=>finite(a.h,finite(a.gy));
    const facing=typeof host.getFacing==='function'?host.getFacing:a=>finite(a.aim);
    const config={...DEFAULTS,...host.options};
    config.acquireRange=Math.max(.1,finite(config.acquireRange,DEFAULTS.acquireRange));
    config.retainRange=Math.max(config.acquireRange,finite(config.retainRange,DEFAULTS.retainRange));
    config.scanInterval=Math.max(.05,finite(config.scanInterval,DEFAULTS.scanInterval));
    config.visibilityInterval=Math.max(.02,finite(config.visibilityInterval,DEFAULTS.visibilityInterval));
    config.maxScan=clamp(Math.floor(finite(config.maxScan,DEFAULTS.maxScan)),1,8192);
    config.maxLineChecks=clamp(Math.floor(finite(config.maxLineChecks,DEFAULTS.maxLineChecks)),1,16);
    config.maxHeightDifference=Math.max(0,finite(config.maxHeightDifference,DEFAULTS.maxHeightDifference));
    const defaultEnabled=host.defaultEnabled===true;
    let enabled=defaultEnabled,active=false,hasBeenActive=false,disposed=false,playerRef=null,chosen=null,lastFrame=null;
    let freeYaw=0,initialYaw=null,displayedYaw=null,orbit=0,elevation=PRESET.elevation,clock=0,nextScan=0,nextVisibility=0,nextPresence=0;
    let scanCursor=0,lineCursor=0,candidateCount=0,reason='initial';
    const stats={scans:0,actorChecks:0,lineChecks:0};
    const alive=a=>!!a&&a.alive!==false&&!a.dead&&(!Number.isFinite(a.hp)||a.hp>0)&&Number.isFinite(a.x)&&Number.isFinite(a.y);
    const usable=p=>!disposed&&alive(p)&&(!host.canUse||host.canUse(p)!==false);
    const viewFromHost=p=>finite(typeof host.getViewYaw==='function'?host.getViewYaw():undefined,finite(p&&facing(p)));
    const distanceSquared=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
    function captureView(){if(displayedYaw!==null)freeYaw=displayedYaw;else if(lastFrame)freeYaw=lastFrame.viewYaw;}
    function clearTarget(why){captureView();chosen=null;candidateCount=0;reason=why;}
    function syncPlayer(){
      const p=getPlayer();
      if(p!==playerRef){
        const hadPlayer=!!playerRef;playerRef=p;chosen=null;lastFrame=null;displayedYaw=null;active=false;
        candidateCount=0;nextScan=nextVisibility=nextPresence=clock;scanCursor=lineCursor=0;orbit=0;elevation=PRESET.elevation;
        if(hadPlayer)enabled=false;
        freeYaw=wrap(initialYaw===null?viewFromHost(p)+PRESET.yawOffset:initialYaw);initialYaw=null;
        reason='player-changed';
      }
      const nextActive=usable(p);
      if(!nextActive){
        if(active||chosen){clearTarget('unavailable');lastFrame=null;displayedYaw=null;}
        enabled=false;active=false;return p;
      }
      if(!active){
        if(hasBeenActive)freeYaw=wrap(viewFromHost(p));
        active=true;hasBeenActive=true;nextScan=clock;reason=enabled?'searching':'manual';
      }
      return p;
    }
    function invalidReason(a,p,range){
      if(!alive(a)||a===p)return 'target-lost';
      if(distanceSquared(a,p)>range*range)return 'out-of-range';
      if(a.vehicle||a.craft||a.mortar||a.railPassenger||finite(a.alt)>.3)return 'ineligible';
      if(Math.abs(finite(baseY(a))-finite(baseY(p)))>config.maxHeightDifference)return 'different-floor';
      if(host.isEligible&&host.isEligible(a,p)===false)return 'ineligible';
      return null;
    }
    function visible(p,a){stats.lineChecks++;return !host.hasLineOfSight||host.hasLineOfSight(p,a)!==false;}
    function actorList(){const list=getActors();return Array.isArray(list)?list:Array.from(list||[]);}
    function scan(p,restart=false){
      stats.scans++;nextScan=clock+config.scanInterval;
      const actors=actorList(),count=actors.length,take=Math.min(count,config.maxScan),near=[];
      if(restart)lineCursor=0;
      for(let i=0;i<take;i++){
        const actor=actors[(scanCursor+i)%count];stats.actorChecks++;
        if(!actor||actor===p||!Number.isFinite(actor.x)||!Number.isFinite(actor.y))continue;
        const d2=distanceSquared(actor,p);if(d2>config.acquireRange*config.acquireRange)continue;
        if(invalidReason(actor,p,config.acquireRange))continue;
        near.push({actor,d2});
      }
      scanCursor=count?(scanCursor+take)%count:0;
      // At most maxScan entries are sorted. Rotating the LOS budget through the
      // whole bounded list also finds a visible enemy behind many blocked ones.
      near.sort((a,b)=>a.d2-b.d2);
      const found=[],lineTake=Math.min(near.length,config.maxLineChecks),start=lineCursor%Math.max(1,near.length);
      for(let i=0;i<lineTake;i++){
        const entry=near[(start+i)%near.length];if(visible(p,entry.actor))found.push(entry);
      }
      lineCursor=near.length?(start+lineTake)%near.length:0;
      found.sort((a,b)=>a.d2-b.d2);candidateCount=found.length;
      return found.map(entry=>entry.actor);
    }
    function choose(a){
      chosen=a||null;nextVisibility=clock+config.visibilityInterval;nextPresence=clock+config.scanInterval;
      if(chosen){reason='locked';candidateCount=Math.max(candidateCount,1);}else reason='searching';
      return chosen;
    }
    function update(dt=0){
      if(!Number.isFinite(dt)||dt<0)throw new RangeError('Focus dt must be finite and non-negative');
      if(disposed)return null;
      clock+=dt;const p=syncPlayer();if(!active||!enabled)return null;
      let lost=false;
      if(chosen){
        let why=invalidReason(chosen,p,config.retainRange);
        if(!why&&clock>=nextPresence){nextPresence=clock+config.scanInterval;if(!actorList().includes(chosen))why='target-lost';}
        if(!why&&clock>=nextVisibility){nextVisibility=clock+config.visibilityInterval;if(!visible(p,chosen))why='occluded';}
        if(why){clearTarget(why);lost=true;}
      }
      if(!chosen&&(lost||clock>=nextScan))choose(scan(p,lost)[0]);
      else if(chosen&&clock>=nextScan){
        // Refresh availability for the mobile cycle button without replacing a
        // valid selection. This remains one bounded scan per scanInterval.
        const alternatives=scan(p);candidateCount=alternatives.length+(alternatives.includes(chosen)?0:1);
      }
      return chosen;
    }
    function toggle(){
      const p=syncPlayer();if(!active)return false;
      enabled=!enabled;
      if(!enabled)clearTarget('manual');else choose(scan(p,true)[0]);
      return enabled;
    }
    function cycle(direction=1){
      const p=syncPlayer();if(!active)return null;
      const old=chosen;enabled=true;
      const options=scan(p);
      // A retained target just outside acquisition range remains a valid cycle
      // origin. Do not drop it merely because no alternative is available.
      if(old&&!options.includes(old)&&!invalidReason(old,p,config.retainRange)&&visible(p,old))options.push(old);
      candidateCount=options.length;
      if(!options.length)return choose(null);
      if(!old)return choose(options[0]);
      const angle=a=>(Math.atan2(a.y-p.y,a.x-p.x)+TAU)%TAU;
      options.sort((a,b)=>angle(a)-angle(b)||distanceSquared(a,p)-distanceSquared(b,p));
      const index=options.indexOf(old),step=direction<0?-1:1;
      if(index>=0)return choose(options[(index+step+options.length)%options.length]);
      const oldAngle=angle(old);let picked=options[0],best=Infinity;
      for(const a of options){const diff=(step*(angle(a)-oldAngle)+TAU)%TAU;if(diff<best){best=diff;picked=a;}}
      return choose(picked);
    }
    function look(yawDelta,pitchDelta=0){
      syncPlayer();if(!active)return false;
      const amount=finite(yawDelta);if(enabled&&chosen)orbit=wrap(orbit+amount);else freeYaw=wrap(freeYaw+amount);
      elevation=clamp(elevation+finite(pitchDelta),12*DEG,58*DEG);return true;
    }
    function pack(a){return {id:a.id,x:a.x,y:a.y,h:finite(baseY(a)),aim:finite(facing(a)),
      reach:typeof host.getReach==='function'?finite(host.getReach(a),.95):.95};}
    function camera(options={}){
      const p=syncPlayer();if(!active)return null;
      // Only update/toggle/cycle acquire. Drawing or reading the camera cannot
      // silently re-enable a manually released lock.
      const t=enabled&&chosen&&!invalidReason(chosen,p,config.retainRange)?chosen:null;
      const player=pack(p),target=t?pack(t):null;
      const desiredYaw=target?Math.atan2(target.y-player.y,target.x-player.x)+PRESET.yawOffset+orbit:freeYaw;
      const inputs={player,target,width:options.width,height:options.height,insets:options.insets,viewYaw:desiredYaw,elevation};
      let next=solveCamera(inputs);
      if(lastFrame){
        const dt=clamp(finite(options.dt,1/60),0,.1),turn=1-Math.exp(-dt*5.5),move=1-Math.exp(-dt*7);
        const oldYaw=displayedYaw===null?lastFrame.viewYaw:displayedYaw;
        inputs.viewYaw=wrap(oldYaw+wrap(next.viewYaw-oldYaw)*turn);
        inputs.elevation=lastFrame.elevation+(next.elevation-lastFrame.elevation)*turn;
        inputs.anchor=lastFrame.anchor.map((v,i)=>v+(next.anchor[i]-v)*move);
        next=solveCamera(inputs);
        if(next.distance<lastFrame.distance){
          inputs.distance=lastFrame.distance+(next.distance-lastFrame.distance)*move;
          next=solveCamera(inputs);
        }
      }
      lastFrame=next;displayedYaw=next.viewYaw;return next;
    }
    // Native scenery collision can pull the camera toward the player's torso.
    // Remember the corrected displayed heading, rather than an unseen ideal
    // heading, when focus is released or the following frame eases its orbit.
    function commitCamera(camera){
      if(!active||!camera)return;
      const yaw=finite(camera.viewYaw,Math.atan2(camera.dz,camera.dx));
      if(Number.isFinite(yaw))displayedYaw=wrap(yaw);
    }
    function snapshot(){
      const selected=active&&enabled?chosen:null;
      return {enabled,active,locked:!!selected,target:selected,targetId:selected&&selected.id!=null?selected.id:null,
        distance:selected&&playerRef?Math.sqrt(distanceSquared(selected,playerRef)):null,candidateCount,
        viewYaw:displayedYaw!==null?displayedYaw:lastFrame?lastFrame.viewYaw:freeYaw,reason};
    }
    function reset(options={}){
      captureView();enabled=options.enabled===undefined?defaultEnabled:!!options.enabled;
      initialYaw=Number.isFinite(options.viewYaw)?wrap(options.viewYaw):null;
      active=false;hasBeenActive=false;playerRef=chosen=lastFrame=null;displayedYaw=null;orbit=0;elevation=PRESET.elevation;clock=0;
      nextScan=nextVisibility=nextPresence=0;scanCursor=lineCursor=candidateCount=0;reason='reset';
    }
    function dispose(){reset({enabled:false});disposed=true;}
    return Object.freeze({update,toggle,cycle,look,camera,commitCamera,snapshot,reset,dispose,
      target:()=>active&&enabled?chosen:null,diagnostics:()=>({...stats})});
  }
  return Object.freeze({version:'1.0.0',PRESET,DEFAULTS,create,solveCamera,project,wrap});
});
