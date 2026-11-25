/* Eastern Front combat intent.
 * Pure, deterministic, bounded perception shared by the native game and playtest.
 * The host owns line of sight, navigation, animation, projectiles and damage.
 * This transient state is deliberately absent from the campaign save schema.
 */
(function(global) {
  'use strict';
  const VERSION = 'gunfire-investigation-20261124-v1';
  const finite = Number.isFinite;
  const point = p => !!p && finite(p.x) && finite(p.y);
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const copyContact = c => c ? { ...c } : null;
  const faction = t => t === 'ally' || t === 'enemy' ? t : null;
  const own = (a,b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);
  const hash = value => {
    const text = String(value);
    let n = 2166136261;
    for (let i=0; i<text.length; i++) n = Math.imul(n ^ text.charCodeAt(i),16777619);
    return n >>> 0;
  };
  function create(options={}) {
    // Native firing still needs direct sight. Optional nearby noise gives only
    // an investigation point; standalone playtests keep their original policy.
    const directSightOnly = options.directSightOnly === true;
    const investigateNoise = directSightOnly && options.investigateNoise === true;
    const hearingEnabled = !directSightOnly || investigateNoise;
    const capacity = clamp(options.capacity|0 || 256,16,1024);
    const eventCapacity = clamp(options.eventCapacity|0 || 32,4,32);
    const units = new Map(), throttles = new Map();
    let events = [], serial = 0, lastPrune = -Infinity, lastStep = -Infinity, disposed = false;
    const counters = { emitted:0, coalesced:0, heard:0 };
    const ttl = kind => kind === 'explosion' ? 3.5 : kind === 'sighting' ? 3 : 2.5;
    function prune(now) {
      if (now-lastPrune < .25 && events.length <= eventCapacity) return;
      lastPrune = now;
      events = events.filter(e => now-e.time <= ttl(e.kind));
      for (const [key,value] of throttles) if (now-value.time > 6) throttles.delete(key);
    }
    function emit(input) {
      if (!hearingEnabled) return false;
      if (disposed || !input || !point(input) || !finite(input.time) || input.time < 0 ||
          !['shot','explosion','sighting'].includes(input.kind)) return false;
      if (investigateNoise && input.kind === 'sighting') return false;
      const radius = input.radius === undefined ? input.kind === 'shot' ? 180 : input.kind === 'explosion' ? 280 : 95 : input.radius;
      if (!finite(radius) || radius < 0) return false;
      const team = faction(input.team), kind = input.kind;
      let target = null;
      if (kind === 'sighting') {
        if (!team || !point(input.target)) return false;
        target = { id: input.target.id === undefined ? null : String(input.target.id),
          x:input.target.x,y:input.target.y,h:finite(input.target.h)?input.target.h:0,
          team:faction(input.target.team) };
        if (target.team === team) return false;
      }
      prune(input.time);
      const sourceId = input.sourceId === undefined || input.sourceId === null ? null : String(input.sourceId);
      const key = kind + ':' + (sourceId === null ? team + ':' + Math.round(input.x/12) + ':' + Math.round(input.y/12) : sourceId);
      const previous = throttles.get(key), period = kind === 'shot' ? .2 : kind === 'sighting' ? .75 : .1;
      const record = { serial:0, x:input.x,y:input.y,h:finite(input.h)?input.h:0,
        team,sourceId,kind,radius,time:input.time,target };
      if (previous && input.time >= previous.time && input.time-previous.time < period-1e-8) {
        // One source's rapid burst remains one bounded packet. A listener that
        // already consumed it receives another packet at the next period.
        const queued = events.find(e => e.serial === previous.serial);
        if (queued) Object.assign(queued,record,{serial:queued.serial});
        counters.coalesced++;
        return false;
      }
      record.serial = ++serial;
      events.push(record);
      if (events.length > eventCapacity) events.splice(0,events.length-eventCapacity);
      throttles.delete(key);
      throttles.set(key,{ time:input.time,serial:record.serial });
      while (throttles.size > 64) throttles.delete(throttles.keys().next().value);
      counters.emitted++;
      return true;
    }
    function makeUnit(id,ctx,now) {
      const index = finite(ctx.index) ? Math.abs(Math.trunc(ctx.index)) : hash(id)%1024;
      const state = {
        id:String(id),index,team:faction(ctx.team),home:point(ctx.home)?{x:ctx.home.x,y:ctx.home.y}:{x:ctx.x,y:ctx.y},
        mode:'guard',contact:null,alertUntil:0,readyAt:0,lastNow:now,nextSense:now,
        seenSerial:0,everAlert:false,trenchGoal:null,heardContact:null,heardReadyAt:0,
        memory:12+(index%7),reaction:.3+(index%7)*.1
      };
      units.set(String(id),state);
      while (units.size > capacity) units.delete(units.keys().next().value);
      return state;
    }
    function alert(state,clue,now) {
      const first = !state.contact || now >= state.alertUntil;
      if (first) {
        state.readyAt = now+state.reaction;
        state.trenchGoal = null;
      }
      state.contact = { ...clue };
      state.alertUntil = Math.max(state.alertUntil,clue.time+state.memory);
      state.everAlert = true;
    }
    function hear(state,ctx,now) {
      if (now+1e-8 < state.nextSense) return;
      state.nextSense = now+.18+(state.index%6)*.02;
      let best = null, bestDistance = 0, bestPriority = 0, bestScore = -Infinity;
      for (const event of events) {
        if (event.serial <= state.seenSerial || event.time > now+1e-8 ||
            now-event.time > ttl(event.kind) || own(event.sourceId,state.id)) continue;
        if (investigateNoise && state.team && event.team === state.team) continue;
        const distance = Math.hypot(ctx.x-event.x,ctx.y-event.y);
        if (distance > event.radius || event.radius === 0) continue;
        let priority;
        if (event.kind === 'sighting') {
          if (event.team !== state.team || !event.target || event.target.team === state.team) continue;
          priority = 3;
        } else {
          const friendly = !!state.team && event.team === state.team;
          priority = friendly ? 1 : event.kind === 'explosion' ? 2.3 : 2;
        }
        // A recent enemy contact takes precedence over friendly muzzle noise.
        const previous = state.contact;
        if (previous && !(investigateNoise && previous.kind === 'seen') && now < state.alertUntil && previous.priority > priority &&
            now-previous.time < 2 && !own(previous.sourceId,event.sourceId)) continue;
        const score = priority*100-distance/Math.max(1,event.radius)*20-(now-event.time)*5;
        if (score > bestScore) { best=event; bestDistance=distance; bestPriority=priority; bestScore=score; }
      }
      for (const event of events) if (event.time <= now+1e-8) state.seenSerial=Math.max(state.seenSerial,event.serial);
      if (best) {
        // Ranking uses only the event's priority, age and distance. Compute
        // hearing error for the selected packet once, instead of hashing and
        // allocating every rejected muzzle report during simultaneous fire.
        let clue;
        if (best.kind === 'sighting') clue = { ...best.target,kind:'sighting',time:best.time,sourceId:best.sourceId,priority:bestPriority };
        else {
          const seed = hash(state.id+':'+best.sourceId+':'+Math.floor(best.time*2));
          const angle = seed/4294967296*Math.PI*2, error = Math.min(9,1.5+bestDistance*.035);
          clue = { id:null,x:best.x+Math.cos(angle)*error,y:best.y+Math.sin(angle)*error,
            h:best.h,team:best.team,kind:best.kind,time:best.time,sourceId:best.sourceId,priority:bestPriority };
        }
        if (investigateNoise) {
          // Store only the sound's fixed, imprecise location. Visual contact may
          // temporarily take precedence without moving or extending this clue.
          if (!state.heardContact || now >= state.heardContact.time+state.memory)
            state.heardReadyAt=now+state.reaction;
          state.heardContact=clue;
        } else alert(state,clue,now);
        counters.heard++;
      }
    }
    function formation(state,contact) {
      let dx=contact.x-state.home.x,dy=contact.y-state.home.y,d=Math.hypot(dx,dy);
      if (d<.001) { const angle=(state.index%12)*Math.PI/6;dx=Math.cos(angle);dy=Math.sin(angle);d=1; }
      const ux=dx/d,uy=dy/d,side=state.index%2?1:-1,lateral=5+(Math.floor(state.index/2)%8);
      return { ux,uy,lx:-uy*side*lateral,ly:ux*side*lateral };
    }
    function output(state,mode,goal,speed,fire) {
      state.mode=mode;
      return { mode,goal:goal?{x:goal.x,y:goal.y}:null,speed,fire:!!fire,
        alertUntil:state.alertUntil,contact:copyContact(state.contact) };
    }
    function guard() { return {mode:'guard',goal:null,speed:0,fire:false,alertUntil:0,contact:null}; }
    function step(id,ctx) {
      if (disposed || id===null || id===undefined || !ctx || !point(ctx) || !finite(ctx.now) || ctx.now<0) return guard();
      const now=ctx.now,key=String(id);
      // Loading another save may rewind simulation time. No old hearing packet
      // or enemy memory crosses that boundary.
      if (now<lastStep-1e-6) {
        units.clear();events=[];throttles.clear();lastPrune=-Infinity;
      }
      lastStep=now;
      if (hearingEnabled) prune(now);
      let state=units.get(key);
      if (!state || state.team!==faction(ctx.team)) state=makeUnit(key,ctx,now);
      state.lastNow=now;
      if (point(ctx.home)) state.home={x:ctx.home.x,y:ctx.home.y};
      if (directSightOnly && ctx.active === false) {
        // Player distance is owned by the host. Crossing that boundary cancels
        // combat immediately, including an unfinished trench exit or chase.
        state.contact=null;state.alertUntil=0;state.readyAt=0;
        state.trenchGoal=null;state.everAlert=false;state.heardContact=null;state.heardReadyAt=0;
        state.nextSense=now;state.seenSerial=serial;
        return output(state,'guard',null,0,false);
      }
      if (hearingEnabled) hear(state,ctx,now);
      if (state.heardContact && now >= state.heardContact.time+state.memory) {
        state.heardContact=null;state.heardReadyAt=0;
      }
      const candidate=ctx.visibleTarget;
      const visible=point(candidate)&&candidate.alive!==false&&!own(candidate.id,key)&&
        (!faction(candidate.team)||faction(candidate.team)!==state.team) ? candidate : null;
      if (directSightOnly && !visible) {
        // Lost sight never supplies a pursuit destination. An independently
        // heard sound can still be investigated until its own memory expires.
        const heard=investigateNoise?state.heardContact:null;
        if (!heard || state.contact?.kind === 'seen') state.trenchGoal=null;
        state.contact=heard;state.alertUntil=heard?heard.time+state.memory:0;
        state.readyAt=heard?state.heardReadyAt:0;
        if (heard) state.everAlert=true;
      }
      if (visible) alert(state,{id:visible.id===undefined?null:String(visible.id),x:visible.x,y:visible.y,
        h:finite(visible.h)?visible.h:0,team:faction(visible.team),kind:'seen',time:now,sourceId:null,priority:4},now);
      const range=finite(ctx.range)?Math.max(0,ctx.range):155;
      const distance=visible?Math.hypot(visible.x-ctx.x,visible.y-ctx.y):Infinity;
      // Preserve the native immediate response to a directly visible opponent;
      // the staggered reaction delay applies to hearing-only clues.
      const ready=!!visible||now+1e-8>=state.readyAt;
      const fire=!!visible&&ready&&range>0&&distance<=range*.98;
      // Regrouping remains in the native escort system. Firing is compatible
      // with moving to the leader, but the combat module issues no competing goal.
      if (ctx.regroup || directSightOnly && ctx.following) {
        if (directSightOnly && !visible) state.everAlert=false;
        return output(state,fire?'fire':'guard',null,0,fire);
      }
      if (!ctx.inTrench) state.trenchGoal=null;
      if (!state.contact || now>=state.alertUntil) {
        state.contact=null;state.alertUntil=0;state.trenchGoal=null;
        const distanceHome=Math.hypot(state.home.x-ctx.x,state.home.y-ctx.y);
        if (state.everAlert&&distanceHome>2.5) return output(state,'return',state.home,3.4,false);
        state.everAlert=false;
        return output(state,'guard',null,0,false);
      }
      if (!ready) return output(state,'respond',null,0,false);
      const contact=state.contact,offset=formation(state,contact);
      if (ctx.inTrench) {
        if (!state.trenchGoal) {
          let dx=contact.x-ctx.x,dy=contact.y-ctx.y,d=Math.hypot(dx,dy);
          const ux=d>.001?dx/d:offset.ux,uy=d>.001?dy/d:offset.uy;
          const forward=12+(state.index%4)*2;
          state.trenchGoal={x:ctx.x+ux*forward+offset.lx,y:ctx.y+uy*forward+offset.ly};
        }
        return output(state,'advance',state.trenchGoal,4.4,fire);
      }
      if (visible) {
        const hold=Math.min(55,Math.max(7,range*.45));
        if (distance>hold+4) {
          // Approach the contact while retaining a different lateral firing
          // point per soldier. The host still checks every physical step.
          const maxHold=Math.min(hold,Math.max(0,distance-5));
          return output(state,'advance',{x:contact.x-offset.ux*maxHold+offset.lx,
            y:contact.y-offset.uy*maxHold+offset.ly},3.8,fire);
        }
        return output(state,fire?'fire':'search',null,0,fire);
      }
      const goal={x:contact.x+offset.lx,y:contact.y+offset.ly};
      const remaining=Math.hypot(goal.x-ctx.x,goal.y-ctx.y);
      if (remaining<=3) return output(state,'search',null,0,false);
      const searching=contact.kind==='seen'||contact.kind==='sighting';
      return output(state,searching?'search':'respond',goal,searching?3.6:4.2,false);
    }
    function reset() {
      units.clear();throttles.clear();events=[];serial=0;lastPrune=-Infinity;lastStep=-Infinity;
      counters.emitted=counters.coalesced=counters.heard=0;
    }
    function state(id) {
      const found=units.get(String(id));
      return found?{...found,home:{...found.home},contact:copyContact(found.contact),heardContact:copyContact(found.heardContact),
        trenchGoal:found.trenchGoal?{...found.trenchGoal}:null}:null;
    }
    return { directSightOnly,investigateNoise,emit,step,state,reset,
      stats:()=>({units:units.size,events:events.length,throttles:throttles.size,...counters}),
      dispose(){reset();disposed=true;} };
  }
  global.HanQEasternCombat=Object.freeze({version:VERSION,create});
})(typeof window!=='undefined'?window:globalThis);

