/* HanQ · Heukryeon estate gameplay. Native entities, inventory and projectiles
 * are supplied by the game host. This module owns only the new encounter and
 * its authored collision/height data; it does not regenerate the saved world. */
(function (root, factory) {
  const value = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.HanQHeukryeon = value;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const VERSION = '1.0.0', EPS = 1e-7, BODY_R = .32;
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const INVENTORY_KEYS = ['weapons', 'cur', 'ammo', 'rockets', 'grenades', 'equipment', 'meleeWeapon', 'meleeOwned', 'sidearmLoadoutVersion', 'mainWeaponSlot'];
  const REACH = {fists:.65, dagger:.98, arming_sword:1.40, longsword:1.78, katana:1.56, machete:1.19, war_hammer:1.56};
  const WEAPON_NAMES = {fists:'맨손', dagger:'단검', arming_sword:'장검', longsword:'롱소드', katana:'일본도', machete:'마체테', war_hammer:'워해머', pistol:'권총'};
  const normSide = side => side === 'left' || side === 'L' ? 'left' : 'right';
  function slab(from, to, box) {
    let lo = 0, hi = 1;
    for (const axis of ['x','y','z']) {
      const d = to[axis] - from[axis], v = from[axis];
      if (Math.abs(d) < EPS) { if (v < box.min[axis] || v > box.max[axis]) return null; }
      else { let a = (box.min[axis] - v) / d, b = (box.max[axis] - v) / d; if (a > b) [a,b] = [b,a]; lo = Math.max(lo,a); hi = Math.min(hi,b); if (lo > hi) return null; }
    }
    if(box.shape==='cylinder'){
      const dx=to.x-from.x,dz=to.z-from.z,ox=from.x-box.cx,oz=from.z-box.cz,a=dx*dx+dz*dz,b=ox*dx+oz*dz,c=ox*ox+oz*oz-box.radius*box.radius;
      if(a<EPS){if(c>0)return null;}else{const disc=b*b-a*c;if(disc<0)return null;const root=Math.sqrt(disc);lo=Math.max(lo,(-b-root)/a);hi=Math.min(hi,(-b+root)/a);if(lo>hi)return null;}
    }
    return lo;
  }
  function gateBox(gate) {
    const angle = finite(gate.rotationY), c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
    const w = gate.width / 2, d = .10, p = gate.position;
    return {id:gate.id, type:'gate', min:{x:p[0]-c*w-s*d,y:p[1],z:p[2]-s*w-c*d}, max:{x:p[0]+c*w+s*d,y:p[1]+gate.height,z:p[2]+s*w+c*d}};
  }
  function create(options = {}) {
    const assets = options.assets || root.HanQHeukryeonAssets;
    const layout = options.layout || assets?.layout;
    const physics = options.physics || assets?.physics;
    if (!layout || !physics || !Array.isArray(physics.collision)) throw Error('Heukryeon authored layout and collision are required');
    const placement = options.placement || {origin:{x:0,y:0,z:0},yaw:0};
    const origin = placement.origin || {x:0,y:0,z:0}, yaw = finite(placement.yaw), cs = Math.cos(yaw), sn = Math.sin(yaw);
    const localBounds = layout.site.bounds, surfaceList = physics.walkableSurfaces || [];
    const specs = new Map(layout.enemies.map((e,i) => [e.id, {...e, index:i}]));
    const gateDefs = new Map(layout.gates.map(g => [g.id,g]));
    const staticBoxes = physics.collision.filter(c => c.type !== 'gate' && c.min && c.max).map(clone);
    const gateBoxes = layout.gates.map(gateBox), allBoxes = staticBoxes.concat(gateBoxes);
    const buckets = new Map(), cellSize = 8;
    for (const b of allBoxes) {
      for (let x = Math.floor(b.min.x/cellSize); x <= Math.floor(b.max.x/cellSize); x++) for (let z = Math.floor(b.min.z/cellSize); z <= Math.floor(b.max.z/cellSize); z++) {
        const key = x+':'+z; if (!buckets.has(key)) buckets.set(key,[]); buckets.get(key).push(b);
      }
    }
    let game = null, state = null, defeated = new Set(), collected = new Set(), lastNotice = '';
    const notify = text => { if (text) options.notify?.(text); };
    function toLocal(x, y, h = origin.y) { const dx=x-origin.x, dz=y-origin.z; return {x:cs*dx-sn*dz,z:sn*dx+cs*dz,y:h-origin.y}; }
    function toWorld(x, z, h = 0) { return {x:origin.x+cs*x+sn*z,y:origin.z-sn*x+cs*z,h:origin.y+h}; }
    function contains(x,y,pad=0) { const p=toLocal(x,y); return p.x>=localBounds.min[0]-pad && p.x<=localBounds.max[0]+pad && p.z>=localBounds.min[2]-pad && p.z<=localBounds.max[2]+pad; }
    function roomAt(x,y) {
      if (!contains(x,y)) return null;
      const p=toLocal(x,y);
      return layout.rooms.find(r => p.x>=r.bounds.min.x && p.x<=r.bounds.max.x && p.z>=r.bounds.min.z && p.z<=r.bounds.max.z) || null;
    }
    function localHeight(x,z) {
      if (assets?.localSurfaceHeight) return assets.localSurfaceHeight(x,z);
      let result = 0;
      for (const s of surfaceList) if (x>=s.bounds.min.x-EPS && x<=s.bounds.max.x+EPS && z>=s.bounds.min.z-EPS && z<=s.bounds.max.z+EPS) result=Math.max(result,s.topY);
      if (Math.abs(z)<=1.9 && x>=-121 && x<=-93) {
        const u=(x+121)/1.75, a=Math.min(15,Math.floor(u)), t=clamp(u-a,0,1);
        const ya=.10+1.15*Math.sin(Math.PI*a/16), yb=.10+1.15*Math.sin(Math.PI*(a+1)/16);
        result=ya+(yb-ya)*t+.08;
      }
      return result;
    }
    function approachHeight(x,y) {
      const path=placement.approach || [];
      for(let i=1;i<path.length;i++) {
        const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;
        if(!l2)continue;
        const t=clamp(((x-a.x)*dx+(y-a.z)*dz)/l2,0,1), d=Math.hypot(x-a.x-dx*t,y-a.z-dz*t);
        if(d<=(b.width||a.width||8)/2) return finite(a.y,origin.y)+(finite(b.y,origin.y)-finite(a.y,origin.y))*t;
      }
      return undefined;
    }
    function groundAt(x,y) {
      if (assets?.groundAt) { const height=assets.groundAt(x,y,placement);return height===null?undefined:height; }
      if(!contains(x,y)) return approachHeight(x,y);
      const p=toLocal(x,y); return origin.y+localHeight(p.x,p.z);
    }
    function gateOpen(id) {
      const g=gateDefs.get(id); if(!g)return false;
      // The checkpoint remains locked until the loadout has actually entered escrow.
      if(id==='entry_check' && !state?.inside)return false;
      return g.unlockAfter.every(e=>defeated.has(e));
    }
    function activeBox(b) { return b.type!=='gate' || !gateOpen(b.id); }
    function candidates(x,z,r=0) {
      const found=new Set();
      for(let a=Math.floor((x-r)/cellSize);a<=Math.floor((x+r)/cellSize);a++)for(let b=Math.floor((z-r)/cellSize);b<=Math.floor((z+r)/cellSize);b++)for(const box of buckets.get(a+':'+b)||[])if(activeBox(box))found.add(box);
      return found;
    }
    function pondBlocked(x,z,r=0) {
      if(Math.abs(z)<=1.9-r && x>=-130 && x<=-84)return false;
      return ((x+107)/(22+r))**2+(z/(16+r))**2<1;
    }
    function touchesBox(b,x,z,foot,r=BODY_R){
      if(b.max.y<=foot+.12||b.min.y>=foot+1.75)return false;
      if(b.shape==='cylinder')return Math.hypot(x-b.cx,z-b.cz)<r+b.radius+EPS;
      const nx=clamp(x,b.min.x,b.max.x),nz=clamp(z,b.min.z,b.max.z);
      return Math.hypot(x-nx,z-nz)<r+EPS;
    }
    function blockedLocal(x,z,foot=localHeight(x,z),r=BODY_R,ignored) {
      if(pondBlocked(x,z,r))return true;
      for(const b of candidates(x,z,r)) {
        if(!ignored?.has(b)&&touchesBox(b,x,z,foot,r))return true;
      }
      return false;
    }
    // Only an already-overlapping furniture/prop pose is corrected. Ordinary
    // contact is blocked, and recovery never crosses a wall, gate or pond.
    function recoverLocal(x,z){
      const foot=localHeight(x,z),overlap=new Set([...candidates(x,z,BODY_R)].filter(b=>touchesBox(b,x,z,foot)));
      if(!overlap.size||pondBlocked(x,z,BODY_R)||[...overlap].some(b=>!['furniture','garden-prop'].includes(b.type)))return null;
      let best=null,bestDistance=1.5;
      function consider(nx,nz){
        const d=Math.hypot(nx-x,nz-z);if(d>=bestDistance||d<1e-8||nx<localBounds.min[0]||nx>localBounds.max[0]||nz<localBounds.min[2]||nz>localBounds.max[2])return;
        const h=localHeight(nx,nz);if(Math.abs(h-foot)>.46||blockedLocal(nx,nz,h))return;
        const steps=Math.max(1,Math.ceil(d/.08));
        for(let i=1;i<steps;i++){const xx=x+(nx-x)*i/steps,zz=z+(nz-z)*i/steps,hh=localHeight(xx,zz);if(Math.abs(hh-foot)>.46||blockedLocal(xx,zz,hh,BODY_R,overlap))return;}
        best={x:nx,z:nz};bestDistance=d;
      }
      for(const b of overlap){const r=BODY_R+.005;
        if(b.shape==='cylinder'){const a=Math.atan2(z-b.cz,x-b.cx),reach=b.radius+r;consider(b.cx+Math.cos(a)*reach,b.cz+Math.sin(a)*reach);}
        else{consider(b.min.x-r,clamp(z,b.min.z,b.max.z));consider(b.max.x+r,clamp(z,b.min.z,b.max.z));consider(clamp(x,b.min.x,b.max.x),b.min.z-r);consider(clamp(x,b.min.x,b.max.x),b.max.z+r);}
      }
      for(const radius of[.025,.05,.1,.2,.4,.8,1.2])for(let n=0;n<16;n++)consider(x+Math.cos(n*Math.PI/8)*radius,z+Math.sin(n*Math.PI/8)*radius);
      return best;
    }
    function repairActor(actor,at){
      if(!actor||!contains(at.x,at.y)||actor.vehicle||actor.craft||actor.air||actor.alt>.3)return false;
      const local=toLocal(at.x,at.y),fixed=recoverLocal(local.x,local.z);if(!fixed)return false;
      const q=toWorld(fixed.x,fixed.z,localHeight(fixed.x,fixed.z));actor.x=q.x;actor.y=q.y;actor.hkHeight=q.h;actor.floor=q.h-(options.getNativeGround?.(q.x,q.y)??q.h);actor.vx=actor.vy=0;actor.plat=null;return true;
    }
    function pointBlocked(x,y,actor=null,r=BODY_R) {
      if(!contains(x,y))return undefined;
      const p=toLocal(x,y),foot=actor&&Number.isFinite(actor.hkHeight)?actor.hkHeight-origin.y:localHeight(p.x,p.z);
      return blockedLocal(p.x,p.z,foot,r);
    }
    function solidAt(x,y,h) {
      if(!contains(x,y))return undefined;
      const p=toLocal(x,y,h);
      for(const b of candidates(p.x,p.z))if(p.x>=b.min.x&&p.x<=b.max.x&&p.z>=b.min.z&&p.z<=b.max.z&&p.y>=b.min.y&&p.y<=b.max.y&&(b.shape!=='cylinder'||Math.hypot(p.x-b.cx,p.z-b.cz)<=b.radius))return {kind:'heukryeon',hkSolid:true,id:b.id,material:b.type==='tree'?'wood':'stone'};
      return null;
    }
    function trace(from,to) {
      const a=toLocal(from.x,from.y,from.h),b=toLocal(to.x,to.y,to.h);
      if(Math.max(a.x,b.x)<localBounds.min[0]||Math.min(a.x,b.x)>localBounds.max[0]||Math.max(a.z,b.z)<localBounds.min[2]||Math.min(a.z,b.z)>localBounds.max[2])return null;
      let hit=null,t=Infinity;
      for(const box of allBoxes)if(activeBox(box)){const n=slab(a,b,box);if(n!==null&&n<t){hit=box;t=n;}}
      return hit?{kind:'heukryeon',hkSolid:true,id:hit.id,t,x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,h:from.h+(to.h-from.h)*t}:null;
    }
    function lineClear(a,b) {
      const ah=options.baseOf?.(a)??groundAt(a.x,a.y)??0,bh=options.baseOf?.(b)??groundAt(b.x,b.y)??0;
      return !trace({x:a.x,y:a.y,h:ah+1.15},{x:b.x,y:b.y,h:bh+1.15}) && (options.canSee?.(a,b)??true);
    }
    function resolve(actor,previous) {
      if(!contains(actor.x,actor.y) && !(previous&&contains(previous.x,previous.y))) { delete actor.hkHeight; return false; }
      const old=previous||{x:actor.x,y:actor.y},a=toLocal(old.x,old.y),wanted=toLocal(actor.x,actor.y);
      if(repairActor(actor,old))return true;
      let x=a.x,z=a.z,stepCount=Math.max(1,Math.ceil(Math.hypot(wanted.x-x,wanted.z-z)/.16));
      const dx=(wanted.x-x)/stepCount,dz=(wanted.z-z)/stepCount;
      const canStep=(nx,nz)=>!blockedLocal(nx,nz,localHeight(nx,nz),BODY_R)&&Math.abs(localHeight(nx,nz)-localHeight(x,z))<=.46;
      for(let i=0;i<stepCount;i++) {
        if(canStep(x+dx,z+dz)){x+=dx;z+=dz;}
        else if(canStep(x+dx,z)){x+=dx;actor.vy=0;}
        else if(canStep(x,z+dz)){z+=dz;actor.vx=0;}
        else actor.vx=actor.vy=0;
      }
      const q=toWorld(x,z,localHeight(x,z));actor.x=q.x;actor.y=q.y;
      actor.hkHeight=q.h; actor.floor=q.h-(options.getNativeGround?.(q.x,q.y)??q.h); actor.plat=null;
      return true;
    }
    function obstacleWorld(box) {
      const points=[];for(const x of[box.min.x,box.max.x])for(const z of[box.min.z,box.max.z])points.push(toWorld(x,z));
      return {id:'hk:'+box.id,enabled:true,min:{x:Math.min(...points.map(p=>p.x)),y:origin.y+box.min.y,z:Math.min(...points.map(p=>p.y))},max:{x:Math.max(...points.map(p=>p.x)),y:origin.y+box.max.y,z:Math.max(...points.map(p=>p.y))}};
    }
    function obstaclesFor(actor) { if(!actor||!contains(actor.x,actor.y,6))return [];const p=toLocal(actor.x,actor.y);return [...candidates(p.x,p.z,4)].map(obstacleWorld); }
    function eligible(spec) {
      if(!state?.inside || !spec || defeated.has(spec.id))return false;
      if(spec.requiresGate&&!gateOpen(spec.requiresGate))return false;
      return layout.enemies.every((prior,i)=>!(prior.stage<spec.stage || spec.index<6&&i<spec.index)||defeated.has(prior.id));
    }
    function newState() { return {schema:'hanq.heukryeon.v1',inside:false,escrow:null,defeated:[],collected:[],earned:[],drops:[],cleared:false,pendingRespawn:false,respawnInventory:null,visits:0}; }
    function attach(nextGame) {
      game=nextGame;
      if(!game||game.mode!=='open')return false;
      state=game.heukryeon;
      if(!state || state.schema!=='hanq.heukryeon.v1')state=game.heukryeon=newState();
      for(const key of['defeated','collected','earned','drops'])if(!Array.isArray(state[key]))state[key]=[];
      defeated=new Set(state.defeated.filter(id=>specs.has(id))); collected=new Set(state.collected);
      state.defeated=[...defeated];state.cleared=defeated.size===layout.enemies.length;
      if(state.inside&&!state.escrow) {state.inside=false;state.pendingRespawn=true;notify('아지트 보관 상태를 확인해 입구로 복귀합니다.');}
      const byId=new Map(game.ents.filter(e=>e.hkUnit).map(e=>[e.hkUnit,e]));
      for(const spec of specs.values()) {
        let e=byId.get(spec.id);
        if(e&&!e.alive){markDefeated(e);continue;}
        if(defeated.has(spec.id)){if(e){e.alive=false;e.hp=0;}continue;}
        if(e)continue;
        const p=toWorld(spec.position[0],spec.position[2],localHeight(spec.position[0],spec.position[2]));
        const native={id:940000+spec.index,x:p.x,y:p.y,h:p.h,hp:spec.health,name:spec.name,weaponId:spec.weaponId,profileId:spec.profileId,hkUnit:spec.id,yaw:Math.PI/2-finite(spec.yaw)-yaw};
        e=options.spawnEnemy?.(native);
        if(!e)throw Error('Heukryeon spawnEnemy must return a native entity');
        Object.assign(e,{id:native.id,hkUnit:spec.id,hkProfile:spec.profileId,hkWeapon:spec.weaponId,hkHeight:p.h,hkHome:{x:p.x,y:p.y,h:p.h},hkAttackIndex:0,hkAttackCooldown:1.1+spec.index%3*.18,hkGuardT:0,x:p.x,y:p.y,aim:native.yaw,name:spec.name,hp:spec.health,maxHp:spec.health,armor:0,armorHp:0,grenades:0,rockets:0,meds:0,alt:0,air:false,jz:0,vz:0,patrol:false,site:null,officeStaff:false,elite:false});
        e.weapons=spec.weaponId==='pistol'?[{type:'pistol',mag:6},null]:[null,null];e.cur=0;e.ammo=spec.weaponId==='pistol'?6:0;
        e.ai=e.ai||{};e.ai.mode='guard';e.ai.target=null;e.ai.home={x:p.x,y:p.y};e.ai.patrol=false;e.ai.nadeCd=1e9;e.ai.perchCd=1e9;
        if(!game.ents.includes(e))game.ents.push(e);
      }
      if(state.inside&&game.ents[0])repairActor(game.ents[0],game.ents[0]);
      return true;
    }
    function stash(player) {
      const result={};for(const key of INVENTORY_KEYS)if(Object.prototype.hasOwnProperty.call(player,key))result[key]=clone(player[key]);
      return result;
    }
    function restoreInventory(player,previous) {
      for(const key of INVENTORY_KEYS){if(Object.prototype.hasOwnProperty.call(previous,key))player[key]=clone(previous[key]);else delete player[key];}
      if(!Array.isArray(player.weapons))player.weapons=[null,null,null,null];
    }
    function resetPlayerCombat(player) {
      player.fireT=player.reloadT=player.healT=0;player.roll=null;player.vault=null;player.climb=null;player.mortar=null;player.recoil=0;
      if(game){game.aimNade=null;game.pickPrompt=null;game.vehPrompt=null;game.ladderPrompt=null;game.craftPrompt=null;game.camBase=null;if(game.input){game.input.fire=false;game.input.ads=false;game.input.adsToggle=false;}}
      options.resetCombat?.(player);
    }
    function enter(player,forced=false) {
      if(!state || state.inside)return {handled:false,reason:'already_inside'};
      if(!player?.alive || player.vehicle || player.craft || player.railPassenger)return {handled:false,reason:'on_foot_only'};
      state.escrow=stash(player);state.inside=true;state.visits++;state.pendingRespawn=false;state.respawnInventory=null;
      player.weapons=[null,null,null,null];player.cur=0;player.mainWeaponSlot=0;player.ammo=player.rockets=player.grenades=0;player.equipment={scopes:[],shield:null};player.meleeWeapon='fists';player.meleeOwned=[];
      resetPlayerCombat(player);
      if(forced){const p=toWorld(49,0,localHeight(49,0));player.x=p.x;player.y=p.y;player.hkHeight=p.h;player.alt=player.jz=player.vz=0;player.air=false;player.vx=player.vy=0;player.floor=p.h-(options.getNativeGround?.(p.x,p.y)??p.h);}
      game.mapDirty=true;notify('흑련파 · 무기를 보관했습니다. 맨손으로 시작합니다.');
      return {handled:true,kind:'enter',message:'무기 전량 보관 · 맨손 시작'};
    }
    function exit(player,reason='exit') {
      if(!state?.inside || !state.escrow)return {handled:false,reason:'already_outside'};
      const previous=state.escrow;
      restoreInventory(player,previous);
      // Native open-world resurrection grants reserve ammunition. Reapply the
      // escrow after that hook so death cannot multiply a stored loadout.
      state.respawnInventory=reason==='death'?clone(previous):null;
      state.escrow=null;state.inside=false;state.pendingRespawn=reason==='death';
      resetPlayerCombat(player);game.mapDirty=true;
      notify(reason==='death'?'보관한 무기는 반환됩니다. 입구에서 다시 일어납니다.':'보관한 무기를 돌려받았습니다. 획득품은 입구 보관함에서 회수하세요.');
      return {handled:true,kind:'exit',reason};
    }
    function markDefeated(e) {
      const spec=specs.get(e?.hkUnit);if(!spec||defeated.has(spec.id))return false;
      defeated.add(spec.id);state.defeated.push(spec.id);
      if(spec.dropsWeapon){const q=toLocal(e.x,e.y,finite(e.hkHeight,origin.y));state.drops.push({id:'drop:'+spec.id,enemyId:spec.id,weaponId:spec.weaponId,position:[q.x,q.y,q.z],rounds:spec.weaponId==='pistol'?Math.max(0,finite(e.weapons?.[0]?.mag)):undefined});}
      state.cleared=defeated.size===layout.enemies.length;game.mapDirty=true;
      if(state.cleared)notify('흑련파 아지트 제압 완료 · 본당의 보검을 회수하세요.');
      return true;
    }
    function onDeath(e) {
      if(e?.isPlayer && state?.inside){exit(e,'death');return true;}
      if(e?.hkUnit){options.setGuard?.(e,false,'left');markDefeated(e);return true;}
      return false;
    }
    function onPlayerRespawn(player) {
      if(!state?.pendingRespawn)return false;
      if(state.respawnInventory)restoreInventory(player,state.respawnInventory);
      state.respawnInventory=null;
      const q=toWorld(layout.entrance.exitPosition[0],layout.entrance.exitPosition[2],0);
      player.x=q.x;player.y=q.y;player.hkHeight=q.h;player.floor=q.h-(options.getNativeGround?.(q.x,q.y)??q.h);player.alt=player.jz=player.vz=0;player.air=false;player.vx=player.vy=0;
      state.pendingRespawn=false;game.camBase=null;game.yaw=-yaw-Math.PI;
      if(game.open){game.open.lastX=player.x;game.open.lastY=player.y;game.open.travel=0;game.open.deathAt=null;}
      return true;
    }
    function canDamage(target,source) {
      if(target?.hkUnit)return !!(state?.inside&&source?.isPlayer&&contains(source.x,source.y)&&eligible(specs.get(target.hkUnit)));
      if(source?.hkUnit)return !!(state?.inside&&target?.isPlayer&&contains(target.x,target.y)&&eligible(specs.get(source.hkUnit)));
      return true;
    }
    function availableLoot() {
      if(!state?.inside)return [];
      const items=[];
      for(const it of layout.loot)if(!collected.has(it.id)&&it.unlockAfter.every(id=>defeated.has(id)))items.push(it);
      for(const it of state.drops)if(!collected.has(it.id))items.push(it);
      return items;
    }
    function nearbyAction(player,flags={}) {
      if(!state || !player?.alive || player.vehicle || player.craft || player.climb || player.railPassenger || player.alt>.2 || player.air)return null;
      const p=toLocal(player.x,player.y),nearEntry=p.x>=44&&p.x<=65&&Math.abs(p.z)<12;
      if(!state.inside && nearEntry) {
        const reward=state.earned.find(it=>!it.withdrawn);
        if(flags.withdraw && reward)return {kind:'withdraw',id:reward.id,label:'획득품 회수 · '+(WEAPON_NAMES[reward.weaponId]||reward.weaponId),weaponId:reward.weaponId};
        return {kind:'enter',label:state.cleared?'흑련파 다시 둘러보기 · 무기 보관':'흑련파 입장 · 무기 전량 보관',secondary:reward?'Shift+E · 획득품 '+state.earned.filter(it=>!it.withdrawn).length+'개 회수':null};
      }
      if(!state.inside)return null;
      let nearest=null,d=2.8;
      for(const it of availableLoot()){
        const q=toWorld(it.position[0],it.position[2],it.position[1]),n=distance(q,player),foot=options.baseOf?.(player)??groundAt(player.x,player.y)??0;
        if(n<d&&Math.abs(foot-q.h)<1.9&&!trace({x:player.x,y:player.y,h:foot+1.35},{x:q.x,y:q.y,h:q.h+.18})){nearest=it;d=n;}
      }
      if(nearest)return {kind:'collect',id:nearest.id,weaponId:nearest.weaponId,label:'획득 · '+(nearest.name||WEAPON_NAMES[nearest.weaponId])};
      if(nearEntry)return {kind:'exit',label:'아지트 나가기 · 보관 무기 반환'};
      return null;
    }
    function performAction(player,action) {
      if(!action||!state)return {handled:false};
      const live=nearbyAction(player,{withdraw:action.kind==='withdraw'});
      if(!live||live.kind!==action.kind||live.id!==action.id)return {handled:false,reason:'out_of_reach'};
      if(action.kind==='enter')return enter(player);
      if(action.kind==='exit'){const result=exit(player);if(result.handled){const q=toWorld(60,0,0);player.x=q.x;player.y=q.y;player.hkHeight=q.h;}return result;}
      if(action.kind==='collect'){
        const it=availableLoot().find(i=>i.id===action.id);if(!it)return {handled:false};
        const id='hk:'+it.id,rounds=it.weaponId==='pistol'?Math.max(0,finite(it.rounds,6)):0;
        if(!options.grantWeapon || options.grantWeapon(player,it.weaponId,id,rounds,{temporary:true})===false)return {handled:false,reason:'inventory_rejected'};
        collected.add(it.id);state.collected.push(it.id);
        if(!state.earned.some(e=>e.id===id))state.earned.push({id,weaponId:it.weaponId,rounds,withdrawn:false});
        delete player.meleeWeapon;game.mapDirty=true;notify((WEAPON_NAMES[it.weaponId]||it.weaponId)+' 획득');
        return {handled:true,kind:'collect',weaponId:it.weaponId,id};
      }
      if(action.kind==='withdraw'){
        const it=state.earned.find(i=>i.id===action.id&&!i.withdrawn);if(!it)return {handled:false};
        if(!options.grantWeapon || options.grantWeapon(player,it.weaponId,it.id,it.rounds,{temporary:false})===false)return {handled:false,reason:'inventory_rejected'};
        it.withdrawn=true;notify((WEAPON_NAMES[it.weaponId]||it.weaponId)+' 회수');return {handled:true,kind:'withdraw',id:it.id,weaponId:it.weaponId};
      }
      return {handled:false};
    }
    function follow(actor,target,speed,dt) {
      const from=toLocal(actor.x,actor.y),to=toLocal(target.x,target.y),d=Math.hypot(to.x-from.x,to.z-from.z);
      if(d<.15){actor.vx=actor.vy=0;return;}
      const angle=Math.atan2(to.z-from.z,to.x-from.x),probe=.85;
      let direction=null;
      for(const delta of[0,.35,-.35,.7,-.7,1.1,-1.1,1.5,-1.5]){
        const a=angle+delta,nx=from.x+Math.cos(a)*probe,nz=from.z+Math.sin(a)*probe;
        if(!blockedLocal(nx,nz,localHeight(nx,nz),BODY_R+.03)&&Math.abs(localHeight(nx,nz)-localHeight(from.x,from.z))<=.46){direction=toWorld(Math.cos(a),Math.sin(a));break;}
      }
      if(!direction){actor.vx=actor.vy=0;return;}
      const mx=direction.x-origin.x,my=direction.y-origin.z,old={x:actor.x,y:actor.y};
      if(options.move)options.move(actor,mx,my,speed,dt);
      else {actor.vx=mx*speed;actor.vy=my*speed;actor.x+=actor.vx*dt;actor.y+=actor.vy*dt;resolve(actor,old);}
    }
    function updateEnemy(e,dt) {
      if(!e?.hkUnit)return false;
      const spec=specs.get(e.hkUnit),p=game?.ents?.[0];
      if(!spec || !e.alive)return true;
      const active=eligible(spec)&&p?.alive&&contains(p.x,p.y)&&!p.vehicle&&!p.craft;
      if(!active){e.ai.target=null;e.ai.mode='guard';e.vx=e.vy=0;options.setGuard?.(e,false,'left');return true;}
      e.hkAttackCooldown=Math.max(0,finite(e.hkAttackCooldown)-dt);e.hkGuardT=Math.max(0,finite(e.hkGuardT)-dt);
      const d=distance(e,p),sees=d<(spec.weaponId==='pistol'?24:17)&&lineClear(e,p);
      if(sees){e.hkLastSeen={x:p.x,y:p.y,time:finite(game.t)};e.ai.target=p;e.ai.mode='fight';}
      else {e.ai.target=null;e.ai.mode='guard';}
      if(!sees){options.setGuard?.(e,false,'left');if(e.hkLastSeen&&finite(game.t)-e.hkLastSeen.time<3&&distance(e,e.hkHome)<27)follow(e,e.hkLastSeen,2.2,dt);else e.vx=e.vy=0;return true;}
      const targetAngle=Math.atan2(p.y-e.y,p.x-e.x),diff=Math.atan2(Math.sin(targetAngle-e.aim),Math.cos(targetAngle-e.aim));e.aim+=diff*Math.min(1,dt*7);
      if(e.hkWeapon==='pistol') {
        if(!(e.weapons?.[0]?.mag>0)&&!(e.ammo>0)){e.hkWeapon='fists';e.weapons=[null,null];e.reloadT=0;}
        else {
          if(d>14)follow(e,p,2,dt);else e.vx=e.vy=0;
          if(d<20&&Math.abs(diff)<.15)options.botFire?.(e);
          return true;
        }
      }
      const reach=REACH[e.hkWeapon]||.65,desired=reach+.12;
      if(d>desired)follow(e,p,spec.index<6?2.3:spec.profileId==='boss'?3.2:2.8,dt);else e.vx=e.vy=0;
      const own=options.meleeFrame?.(e),pf=options.meleeFrame?.(p),busy=own&&(own.phase==='windup'||own.phase==='active'||own.phase==='recovery');
      if(e.hkGuardT>0){options.setGuard?.(e,true,e.hkGuardSide||'left');return true;}
      options.setGuard?.(e,false,'left');
      if(!busy&&d<reach+.65&&pf&&(pf.phase==='windup'||pf.phase==='active')&&spec.index>=6&&(e.hkAttackIndex+spec.index)%3===0&&e.hkAttackCooldown>.1){e.hkGuardSide=normSide(pf.side)==='left'?'right':'left';e.hkGuardT=.34;options.setGuard?.(e,true,e.hkGuardSide);return true;}
      if(!busy&&e.hkAttackCooldown<=0&&d<=reach+.29&&Math.abs(diff)<.35) {
        const side=e.hkAttackIndex%2?'left':'right',charge=spec.index>=20&&e.hkAttackIndex%3===2?(spec.profileId==='boss'?.75:.45):0;
        if(options.meleeAttack && options.meleeAttack(e,side,charge)!==false){e.hkAttackIndex++;e.hkAttackCooldown=(spec.index<6?.85:.62)+(e.hkWeapon==='war_hammer'?.4:0);}
      }
      return true;
    }
    function tick(dt) {
      if(!game||!state)return;
      const p=game.ents[0];
      for(const e of game.ents)if(e.hkUnit&&!e.alive&&!defeated.has(e.hkUnit))markDefeated(e);
      if(!p?.alive)return;
      if(state.pendingRespawn)onPlayerRespawn(p);
      const q=toLocal(p.x,p.y),restricted=contains(p.x,p.y)&&q.x<54.5;
      if(!state.inside&&restricted&&!p.vehicle&&!p.craft&&!p.railPassenger&&!(p.alt>.2)&&!p.air)enter(p,true);
      if(state.inside&&!contains(p.x,p.y,2))exit(p,'exit');
      if(state.inside){const room=roomAt(p.x,p.y),label=room?.id||'';if(label&&label!==lastNotice){lastNotice=label;notify('흑련파 · '+room.name);}}
    }
    function status() { return {inside:!!state?.inside,cleared:!!state?.cleared,defeated:defeated.size,total:layout.enemies.length,lootCollected:collected.size,storedRewards:state?.earned.filter(i=>!i.withdrawn).length||0,room:game?.ents?.[0]?roomAt(game.ents[0].x,game.ents[0].y):null}; }
    function serialize(){return state?clone(state):null;}
    function gateStates(){return Object.fromEntries(layout.gates.map(g=>[g.id,gateOpen(g.id)]));}
    function visibleLoot(){return state?layout.loot.concat(state.drops).filter(it=>!collected.has(it.id)).map(it=>({...it,world:toWorld(it.position[0],it.position[2],it.position[1]),available:state.inside&&(!it.unlockAfter||it.unlockAfter.every(id=>defeated.has(id)))})):[];}
    return {version:VERSION,layout,placement,attach,tick,updateEnemy,canDamage,onDeath,onPlayerRespawn,nearbyAction,performAction,enter,exit,contains,groundAt,roomAt,pointBlocked,solidAt,resolve,trace,obstaclesFor,gateStates,status,serialize,toLocal,toWorld,availableLoot,visibleLoot,get state(){return state;},get inside(){return !!state?.inside;}};
  }
  return Object.freeze({VERSION,create,WEAPON_NAMES,INVENTORY_KEYS});
});

