/* HANQ tactical atlas. Canvas-only presentation; world and save data stay owned
 * by the game. All hit testing uses the same projection as the rendered map. */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const NEARBY_RANGE = 850;
  const C = Object.freeze({bg:'#08151d',panel:'#101f29',sea:'#102a35',line:'#2a414b',text:'#edf3ee',muted:'#9bafb6',quiet:'#6e8791',ally:'#7ad7bd',enemy:'#ef947e',gold:'#eed49a',rail:'#dcb875'});
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const inside = (p,r) => !!r && p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h;
  const overlap = (a,b,gap=3) => a.x < b.x+b.w+gap && a.x+a.w+gap > b.x && a.y < b.y+b.h+gap && a.y+a.h+gap > b.y;
  const fits = (a,b) => a.x>=b.x && a.y>=b.y && a.x+a.w<=b.x+b.w && a.y+a.h<=b.y+b.h;
  function rect(c,x,y,w,h,r=8) { c.beginPath(); if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h); }
  function box(c,r,fill,stroke,radius=8) { rect(c,r.x,r.y,r.w,r.h,radius);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();} }
  function text(c,str,x,y,size=14,color=C.text,weight=500,align='left') { c.font=(Math.round(weight/100)*100)+' '+size+'px system-ui, sans-serif';c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(String(str),x,y); }
  function elide(c,str,maxWidth) { str=String(str??'');if(c.measureText(str).width<=maxWidth)return str;while(str.length&&c.measureText(str+'…').width>maxWidth)str=str.slice(0,-1);return str+'…'; }
  function line(c,str,x,y,maxWidth,size=14,color=C.text,weight=500) { c.font=(Math.round(weight/100)*100)+' '+size+'px system-ui, sans-serif';text(c,elide(c,str,maxWidth),x,y,size,color,weight); }
  function wrapped(c,str,x,y,maxWidth,size=13,color=C.muted,maxLines=2) {
    c.font='500 '+size+'px system-ui, sans-serif';let current='',row=0;const chars=Array.from(String(str||''));
    for(let i=0;i<chars.length;i++) { const ch=chars[i];if(c.measureText(current+ch).width>maxWidth&&current){text(c,current,x,y+row*(size+7),size,color);row++;current='';if(row===maxLines-1){line(c,chars.slice(i).join(''),x,y+row*(size+7),maxWidth,size,color);return maxLines*(size+7);}}current+=ch; }
    if(current)text(c,current,x,y+row*(size+7),size,color);return (row+1)*(size+7);
  }
  const teamColor = m => m.team==='enemy'?C.enemy:m.team==='ally'?C.ally:m.type==='station'||m.type==='train'?C.rail:m.color||C.text;
  const hiddenMarker = m => m.team==='enemy'||m.type==='hostile';
  function symbol(c,m,x,y,size=5,selected=false) {
    const col=teamColor(m);c.save();c.translate(x,y);c.lineWidth=1.5;c.strokeStyle='#08151d';c.fillStyle=col;
    if(selected){c.strokeStyle=col;c.lineWidth=1.5;c.beginPath();c.arc(0,0,size+6,0,TAU);c.stroke();c.strokeStyle='#08151d';}
    c.beginPath();
    if(m.kind==='bomber'){
      c.rotate(m.yaw||0);c.moveTo(size+3,0);c.lineTo(size*.15,-size*.35);c.lineTo(-size*.3,-size*1.6);
      c.lineTo(-size*.85,-size*1.6);c.lineTo(-size*.6,-size*.3);c.lineTo(-size*1.2,-size*.6);
      c.lineTo(-size*.95,0);c.lineTo(-size*1.2,size*.6);c.lineTo(-size*.6,size*.3);
      c.lineTo(-size*.85,size*1.6);c.lineTo(-size*.3,size*1.6);c.lineTo(size*.15,size*.35);c.closePath();
    }
    else if(m.type==='station'){c.rect(-size,-size,size*2,size*2);}
    else if(m.type==='train'){c.rotate(m.yaw||0);c.moveTo(size+3,0);c.lineTo(-size,-size*.75);c.lineTo(-size,size*.75);c.closePath();}
    else if(m.type==='landmark'){for(let i=0;i<5;i++){const a=-Math.PI/2+i*TAU/5;i?c.lineTo(Math.cos(a)*size,Math.sin(a)*size):c.moveTo(Math.cos(a)*size,Math.sin(a)*size);}c.closePath();}
    else if(m.type==='port'){c.arc(0,0,size,0,TAU);c.fill();c.beginPath();c.moveTo(-size*.55,1);c.lineTo(0,size*.55);c.lineTo(size*.55,-size*.4);c.strokeStyle=C.bg;c.lineWidth=1.4;c.stroke();c.restore();return;}
    else if(m.type==='support'){
      c.strokeStyle=col;c.lineWidth=1.5;c.arc(0,0,size+3,0,TAU);c.stroke();c.beginPath();
      c.rotate(m.yaw||0);c.moveTo(size+1,0);c.lineTo(-size,-size*.65);c.lineTo(-size*.6,0);c.lineTo(-size,size*.65);c.closePath();c.strokeStyle=C.bg;
    }
    else if(m.type==='vehicle'){c.rotate(m.yaw||0);c.rect(-size,-size*.6,size*2,size*1.2);}
    else if(m.team==='enemy'){c.moveTo(0,-size-1);c.lineTo(size+1,0);c.lineTo(0,size+1);c.lineTo(-size-1,0);c.closePath();}
    else c.arc(0,0,size,0,TAU);
    c.fill();c.stroke();c.restore();
  }
  function player(c,x,y,yaw,size=13) {
    c.save();c.translate(x,y);
    c.fillStyle='rgba(91,232,222,.15)';c.beginPath();c.arc(0,0,size+10,0,TAU);c.fill();
    c.strokeStyle='rgba(172,255,244,.8)';c.lineWidth=1.6;c.beginPath();c.arc(0,0,size+6,0,TAU);c.stroke();
    c.rotate(yaw||0);c.fillStyle='rgba(139,255,239,.13)';c.beginPath();c.moveTo(0,0);c.arc(0,0,size*3.2,-.43,.43);c.closePath();c.fill();
    c.beginPath();c.moveTo(size+2,0);c.lineTo(-size*.75,-size*.7);c.lineTo(-size*.35,0);c.lineTo(-size*.75,size*.7);c.closePath();
    c.strokeStyle=C.bg;c.lineJoin='round';c.lineWidth=6;c.stroke();c.fillStyle='#7dffe8';c.fill();c.strokeStyle='#f4fffb';c.lineWidth=2.3;c.stroke();c.restore();
  }
  function create(host) {
    let data=null,owner=null,lastExternal=null,selectedId=null,selectedMember=null,details=null;
    let filter='all',area='all',zoom=1,center=null,viewport=null,panel=null,content=null,markerArea=null,projection=null,baseK=1,coordinateScale=1;
    let hits=[],labels=[],markerHits=[],rosterPage=0,rosterRows=0,rosterPages=1,width=0,height=0,needFit=false;
    let pointers=new Map(),gesture=null,hover=null,lastLayout='',miniCache=null,playerMarker=null,pendingFocus='player',nearby=null;
    const railChunks = new WeakMap();
    // Include enough screen space for antialiased strokes just inside the clip.
    function worldView(tf,clip) {
      const margin = 6;
      return {minX:(clip.x-margin-tf.ox)/tf.k,minY:(clip.y-margin-tf.oy)/tf.k,
        maxX:(clip.x+clip.w+margin-tf.ox)/tf.k,maxY:(clip.y+clip.h+margin-tf.oy)/tf.k};
    }
    function read(mini=false) {
      const next=host.read({selectedId,mini});if(!next)return null;
      if(owner!==next.owner){owner=next.owner;selectedId=null;selectedMember=null;lastExternal=null;filter='all';area='all';zoom=1;center=null;needFit=false;pendingFocus=pendingFocus==='selection'?'selection':'player';pointers.clear();gesture=null;miniCache=null;}
      data=next;
      if(!mini&&next.selectedId!==undefined&&next.selectedId!==lastExternal){lastExternal=next.selectedId;if(next.selectedId){selectedId=next.selectedId;selectedMember=next.selectedMemberId||null;rosterPage=0;}}
      return data;
    }
    function markerById(id) { return data?.markers?.find(m=>m.id===id)||null; }
    function getDetails() {
      const m=markerById(selectedId);details=m?(host.details?.(m)||m.detail||{title:m.label,team:m.team,lines:[]}):null;
      if(!m){selectedId=null;selectedMember=null;}return details;
    }
    function layout(w,h) {
      const support=markerById(selectedId)?.type==='support',tabRows=w<360?Math.ceil(((data.areas||[]).length+1)/3):1;
      const side=!!details&&(w>=760||(w>=568&&w/h>1.4)||((support||details.capture)&&w>=460&&w/h>1.4)),pad=w<480?12:18,top=(h<430?98:116)+(tabRows-1)*33,bottom=h<330?6:34;
      const panelW=side?(w<760?clamp(w*.31,210,252):clamp(w*.25,252,316)):w-pad*2;
      const minDetailH=details?.capture?Math.min(216,Math.max(116,h-top-bottom)):116;
      const panelH=details?(side?h-top-bottom:Math.min(276,Math.max(minDetailH,h*.35))):(h<330?28:w<480?42:38);
      panel=side?{x:w-pad-panelW,y:top,w:panelW,h:panelH}:{x:pad,y:h-bottom-panelH,w:panelW,h:panelH};
      viewport={x:pad,y:top,w:side?w-panelW-pad*3:w-pad*2,h:side?h-top-bottom:Math.max(90,panel.y-top-(details?12:8))};
      const tight=viewport.h<230;
      markerArea={x:viewport.x+8,y:viewport.y+46,w:viewport.w-(tight?16:68),h:Math.max(1,viewport.h-(tight?94:80))};
      // Fit to the same usable rectangle that admits markers. A minimum map
      // height must never project a truck into the toolbar's clipped region.
      content={x:markerArea.x+8,y:markerArea.y+8,w:Math.max(1,markerArea.w-16),h:Math.max(1,markerArea.h-(tight?16:12))};
      const b=data.bounds; baseK=Math.max(.0001,Math.min(content.w/(b.maxX-b.minX),content.h/(b.maxY-b.minY)));
      const stamp=[w,h,side,!!details].join('|');if(lastLayout!==stamp){lastLayout=stamp;if(!pendingFocus){if(area==='nearby'||area==='selection')pendingFocus=area==='selection'?'selection':'player';else if(area!=='custom')needFit=true;else if(projection)zoom=clamp(projection.k/baseK,1,14);}}
      if(!center)center={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2};
      if(pendingFocus){const focus=pendingFocus,target=focus==='selection'?markerById(selectedId):null;pendingFocus=null;if(focus==='support')fit('support');else locate(target);needFit=false;}
      else if(needFit){fit(area);needFit=false;}project();
    }
    function project() {
      if(!viewport||!center)return;
      const b=data.bounds,k=baseK*zoom,halfW=content.w/(2*k),halfH=content.h/(2*k);
      // Nearby view keeps the player exactly centered, including at the coast.
      // Manual panning can reach world edges while keeping the world in view.
      const bound=(v,min,max,half)=>half>=(max-min)/2?(min+max)/2:clamp(v,min,max);
      if(area!=='nearby'&&area!=='selection'){center.x=bound(center.x,b.minX,b.maxX,halfW);center.y=bound(center.y,b.minY,b.maxY,halfH);}
      projection={ox:content.x+content.w/2-center.x*k,oy:content.y+content.h/2-center.y*k,k};
    }
    function locate(target=null) {
      if(!data||!content)return;
      const p=target||data.player;if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)){fit('all');return;}
      zoom=clamp(Math.max(4,Math.min(content.w,content.h)/(NEARBY_RANGE*baseK)),1,14);
      center={x:p.x,y:p.y};area=target?'selection':'nearby';
      nearby={targetRange:NEARBY_RANGE,range:Math.min(content.w,content.h)/(baseK*zoom),zoom};project();
    }
    function fit(id='all') {
      if(!data||!content)return;let b=(data.areas||[]).find(a=>a.id===id)?.bounds||data.bounds;
      if(id==='support'){
        const all=(data.markers||[]).filter(m=>m.type==='support'),incoming=all.filter(m=>m.incoming);
        const points=[data.player,...(incoming.length?incoming:all)].filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
        if(!all.length){locate();return;}
        b={minX:Math.min(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxX:Math.max(...points.map(p=>p.x)),maxY:Math.max(...points.map(p=>p.y))};
        const marginX=Math.max(90,(b.maxX-b.minX)*.12),marginY=Math.max(90,(b.maxY-b.minY)*.12);
        b={minX:b.minX-marginX,minY:b.minY-marginY,maxX:b.maxX+marginX,maxY:b.maxY+marginY};
      }
      area=id;center={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2};
      zoom=clamp(Math.min(content.w/(b.maxX-b.minX),content.h/(b.maxY-b.minY))/baseK,1,14);project();
    }
    function zoomAt(factor,pt) {
      if(!projection)return;pt=pt&&inside(pt,viewport)?pt:{x:content.x+content.w/2,y:content.y+content.h/2};
      const wx=(pt.x-projection.ox)/projection.k,wy=(pt.y-projection.oy)/projection.k;
      zoom=clamp(zoom*factor,1,14);const k=baseK*zoom;
      center={x:wx-(pt.x-content.x-content.w/2)/k,y:wy-(pt.y-content.y-content.h/2)/k};area='custom';project();
    }
    function control(c,id,label,r,active=false,icon=null) {
      box(c,r,active?'#233b42':'#12252f',active?'#8bada5':C.line,7);
      if(icon){text(c,icon,r.x+r.w/2,r.y+r.h/2,icon==='+'?24:18,active?C.gold:C.text,500,'center');}
      else {c.font='500 12px system-ui, sans-serif';text(c,elide(c,label,r.w-12),r.x+r.w/2,r.y+r.h/2,12,active?C.gold:C.muted,active?650:500,'center');}
      hits.push({...r,kind:'control',id,action:id});
    }
    function header(c,w,h) {
      const small=w<480,short=h<430,px=small?16:22;
      // Stay visible while panning, filtering or inspecting another site.
      // This is the player's location; it never reveals a remote hostile marker.
      const location=data.currentLocation,locationName=location?.name||data.regionName||'중앙 대륙';
      const locationColor=location?.team==='enemy'?C.enemy:location?.kind==='site'?C.ally:C.text;
      line(c,'현재 위치 · '+locationName,px,short?16:21,w-px-(small?76:104)-12,12.5,locationColor,650);
      text(c,'작전 지도',px,short?39:48,small?23:26,C.text,650);
      if(w>620)text(c,'지형 · 거점 · 이동 경로',px+130,short?40:49,13,C.muted);
      control(c,'close',w<480?'닫기':'닫기  M',{x:w-(small?76:104),y:short?12:23,w:small?62:82,h:36});
      const areaNames={west:'서부 도시',central:'중앙 대륙',north:'북부 해역',east:'동부 전선'};
      const tabs=[{id:'all',name:'세계 전체'},...(data.areas||[]).map(a=>({...a,name:areaNames[a.id]||a.name}))];let x=px;const y=short?61:77,gap=5;
      const available=w-px*2,weights=tabs.map(t=>Math.max(3,t.name.length)),total=weights.reduce((a,b)=>a+b,0);
      const shortNames={all:'세계',west:'서부',central:'중앙',north:'북부',east:'전선','eastern-sea':'해전'};
      tabs.forEach((t,i)=>{
        if(w<360){const tw=(available-gap*2)/3;control(c,'area:'+t.id,shortNames[t.id]||t.name,{x:px+(i%3)*(tw+gap),y:y+Math.floor(i/3)*33,w:tw,h:28},area===t.id);}
        else{const tw=Math.min(small?90:116,(available-gap*(tabs.length-1))*weights[i]/total);control(c,'area:'+t.id,tw<62?(shortNames[t.id]||t.name):t.name,{x,y,w:tw,h:30},area===t.id);x+=tw+gap;}
      });
    }
    function grid(c) {
      const r=viewport,k=projection.k;box(c,r,C.sea,null,12);c.save();rect(c,r.x,r.y,r.w,r.h,12);c.clip();
      const gradient=c.createLinearGradient(0,r.y,0,r.y+r.h);gradient.addColorStop(0,'rgba(66,100,111,.09)');gradient.addColorStop(1,'rgba(4,14,21,.18)');c.fillStyle=gradient;c.fillRect(r.x,r.y,r.w,r.h);
      const step=Math.pow(2,Math.ceil(Math.log2(58/k)))*1;const spacing=step*k;
      c.strokeStyle='rgba(155,187,194,.055)';c.lineWidth=1;c.beginPath();
      for(let x=projection.ox%spacing+r.x-Math.floor(r.x/spacing)*spacing;x<r.x+r.w;x+=spacing){if(x>=r.x){c.moveTo(x,r.y);c.lineTo(x,r.y+r.h);}}
      for(let y=projection.oy%spacing+r.y-Math.floor(r.y/spacing)*spacing;y<r.y+r.h;y+=spacing){if(y>=r.y){c.moveTo(r.x,y);c.lineTo(r.x+r.w,y);}}c.stroke();
      const view=worldView(projection,r);
      host.paintTerrain(c,{...projection,mini:false,view});
      drawRoutes(c,projection,false,view);
      c.restore();box(c,r,null,C.line,12);
    }
    function railInView(points,view) {
      let chunks=railChunks.get(points);
      if (!chunks) {
        chunks=[];
        // Include both endpoints of each segment, even when neither is inside the viewport.
        for (let start=0;start<points.length-1;start+=32) {
          const end=Math.min(start+32,points.length-1);
          let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
          for (let i=start;i<=end;i++) {
            const p=points[i];minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);
            maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);
          }
          chunks.push({minX,minY,maxX,maxY});
        }
        railChunks.set(points,chunks);
      }
      return chunks.some(b=>b.minX<=view.maxX && b.maxX>=view.minX && b.minY<=view.maxY && b.maxY>=view.minY);
    }
    function drawRoutes(c,tf,mini,view) {
      for(const route of data.routes||[]) {
        if(!route.points?.length)continue;const kind=route.kind||'road';if(kind==='front'&&mini)continue;
        // Preserve the continuous original stroke, including joins and antialiasing,
        // whenever any segment could be visible.
        if (kind==='rail' && route.points.length>32 && !railInView(route.points,view)) continue;
        c.save();c.lineCap='round';c.lineJoin='round';
        c.strokeStyle=kind==='rail'?C.rail:kind==='ferry'?'#84b8c7':kind==='front'?'rgba(160,184,167,.24)':'rgba(156,174,163,.35)';
        c.lineWidth=kind==='rail'?(mini?1.8:2.3):kind==='ferry'?1:1.2;
        if(kind==='ferry')c.setLineDash([4,5]);if(kind==='front')c.setLineDash([3,5]);
        c.beginPath();
        route.points.forEach((p,i)=>{const x=tf.ox+p.x*tf.k,y=tf.oy+p.y*tf.k;i?c.lineTo(x,y):c.moveTo(x,y);});
        c.stroke();c.restore();
      }
    }
    function visibleMarkers(tf,clip,mini=false) {
      const all=data.markers||[],out=[],vehicleCells=new Map();
      for(const m of all) {
        if(hiddenMarker(m))continue;
        if(!Number.isFinite(m.x)||!Number.isFinite(m.y))continue;
        const x=tf.ox+m.x*tf.k,y=tf.oy+m.y*tf.k;if(x<clip.x+7||y<clip.y+7||x>clip.x+clip.w-7||y>clip.y+clip.h-7)continue;
        if(m.type==='region'&&mini)continue;
        if(!mini&&filter==='support'&&m.type!=='support')continue;
        if(!mini&&filter==='sites'&&['vehicle','train','station','port','support'].includes(m.type))continue;
        if(!mini&&filter==='transport'&&m.type==='site'&&m.id!==selectedId)continue;
        if(m.type==='vehicle') {
          if(!mini&&filter!=='transport')continue;
          const cell=mini?20:32,key=Math.floor(x/cell)+':'+Math.floor(y/cell),bucket=vehicleCells.get(key)||[];
          bucket.push({...m,screenX:x,screenY:y});vehicleCells.set(key,bucket);continue;
        }
        out.push({...m,screenX:x,screenY:y});
      }
      for(const [key,items] of vehicleCells) {
        const closest=items.slice().sort((a,b)=>Math.hypot(a.x-data.player.x,a.y-data.player.y)-Math.hypot(b.x-data.player.x,b.y-data.player.y))[0];
        if(items.length===1||mini)out.push({...closest,count:items.length});
        else out.push({...closest,id:'cluster:'+key,label:'이동수단 '+items.length+'대',count:items.length,cluster:true,members:items,
          x:items.reduce((sum,m)=>sum+m.x,0)/items.length,y:items.reduce((sum,m)=>sum+m.y,0)/items.length,
          screenX:items.reduce((sum,m)=>sum+m.screenX,0)/items.length,screenY:items.reduce((sum,m)=>sum+m.screenY,0)/items.length});
      }
      return out.sort((a,b)=>(b.id===selectedId?10000:b.priority||0)-(a.id===selectedId?10000:a.priority||0)||String(a.id).localeCompare(String(b.id)));
    }
    function mapMarkers(c) {
      markerHits=[];labels=[];const projected=visibleMarkers(projection,viewport),blocked=[];
      const tight=viewport.h<230,usable=markerArea;
      const reserved=[{x:viewport.x+10,y:viewport.y+9,w:Math.min(265,viewport.w-20),h:34},tight?{x:viewport.x+viewport.w-164,y:viewport.y+viewport.h-44,w:156,h:36}:{x:viewport.x+viewport.w-56,y:viewport.y+viewport.h-156,w:48,h:146},
        {x:viewport.x+10,y:viewport.y+viewport.h-36,w:160,h:30}];
      const p=data.player,pp={x:projection.ox+p.x*projection.k,y:projection.oy+p.y*projection.k},onMap=inside(pp,usable);
      const px=onMap?pp.x:clamp(pp.x,usable.x+24,usable.x+usable.w-24),py=onMap?pp.y:clamp(pp.y,usable.y+24,usable.y+usable.h-24);
      c.font='700 13px system-ui, sans-serif';const pw=c.measureText('내 위치').width+20,ph=27;
      const playerCandidates=[{x:px-pw/2,y:py-30-ph},{x:px-pw/2,y:py+30},{x:px+30,y:py-ph/2},{x:px-30-pw,y:py-ph/2}];
      const playerLabel=playerCandidates.map(pos=>({...pos,w:pw,h:ph})).find(r=>fits(r,usable)&&!reserved.some(b=>overlap(r,b)))||
        {x:clamp(px-pw/2,usable.x,usable.x+usable.w-pw),y:clamp(py+30,usable.y,usable.y+usable.h-ph),w:pw,h:ph};
      playerMarker={x:px,y:py,yaw:onMap?p.yaw:Math.atan2(pp.y-py,pp.x-px),size:13,onMap,label:{...playerLabel,text:'내 위치'},world:{x:p.x,y:p.y}};
      blocked.push({x:px-24,y:py-24,w:48,h:48,id:'player'});reserved.push(playerLabel);
      for(const m of projected) {
        const x=m.screenX,y=m.screenY;if(!inside({x,y},usable))continue;
        if(m.type==='region')continue;
        const size=m.cluster?12:m.id===selectedId?6.5:m.type==='support'||m.type==='landmark'?6:4.5;
        if(m.cluster){box(c,{x:x-17,y:y-12,w:34,h:24},'#223e4a','#7396a3',12);text(c,m.count,x,y,12,C.text,650,'center');}
        else symbol(c,m,x,y,size,m.id===selectedId);
        const hit={x:x-14,y:y-14,w:28,h:28,cx:x,cy:y,kind:'marker',id:m.id,marker:m};markerHits.push(hit);
        blocked.push({x:x-size-3,y:y-size-3,w:size*2+6,h:size*2+6,id:m.id});
      }
      // Each label gets the first collision-free candidate in a stable order.
      // Low priority names disappear before icons do, with no frame-order jitter.
      const maxLabels=clamp(Math.floor(usable.w*usable.h/9000),6,65);let count=0;
      for(const m of projected) {
        if(m.cluster||m.type==='vehicle'||m.type==='hostile'||m.type==='ally')continue;
        const selected=m.id===selectedId,priority=m.priority||0;
        if(count>=maxLabels&&!selected)continue;
        if(m.type==='region'&&zoom>4.5)continue;
        if(!selected&&zoom<1.65&&priority<50)continue;
        const font=selected?14:m.type==='region'?13:12.5;
        c.font=(selected?'600 ':'500 ')+font+'px system-ui, sans-serif';
        const name=elide(c,m.label,Math.min(182,usable.w-16)),tw=c.measureText(name).width+14,th=font+12;
        const x=m.screenX,y=m.screenY,gap=11;
        const candidates=m.type==='region'?[{x:x-tw/2,y:y-th/2}]:[{x:x+gap,y:y-th/2},{x:x-gap-tw,y:y-th/2},{x:x-tw/2,y:y-gap-th},{x:x-tw/2,y:y+gap}];
        let best=null;
        for(const pos of candidates){const r={...pos,w:tw,h:th};if(!fits(r,usable)||reserved.some(b=>overlap(r,b))||labels.some(b=>overlap(r,b))||blocked.some(b=>b.id!==m.id&&overlap(r,b,1)))continue;best=r;break;}
        if(!best)continue;
        box(c,best,selected?'#28413f':'rgba(9,24,32,.84)',selected?C.ally:'rgba(122,153,160,.15)',5);
        text(c,name,best.x+7,best.y+th/2,font,selected?C.text:m.type==='region'?'#c3d3c9':teamColor(m),selected?650:500);
        labels.push({...best,id:m.id,text:name});count++;
      }
      hits.push(...markerHits);
      c.save();rect(c,viewport.x,viewport.y,viewport.w,viewport.h,12);c.clip();
      player(c,px,py,playerMarker.yaw,13);
      box(c,playerLabel,'#133e43','#8effe9',6);text(c,'내 위치',playerLabel.x+pw/2,playerLabel.y+ph/2,13,'#f4fffb',700,'center');
      labels.push({...playerLabel,id:'player',text:'내 위치'});
      c.restore();
    }
    function mapControls(c) {
      const r=viewport,compact=r.w<470,tight=r.h<230,filterWidth=Math.min(48,(r.w-24-15)/4);
      let x=r.x+12;for(const [id,label,ww]of [['all','전체',48],['sites','거점',48],['transport',r.w<300?'탈것':'이동수단',76],['support','지원',48]]){
        const tw=r.w<300?filterWidth:ww;control(c,'filter:'+id,label,{x,y:r.y+12,w:tw,h:30},filter===id);x+=tw+5;
      }
      if(r.w>290){text(c,'N',r.x+r.w-26,r.y+22,12,C.text,700,'center');c.strokeStyle=C.muted;c.lineWidth=1;c.beginPath();c.moveTo(r.x+r.w-26,r.y+31);c.lineTo(r.x+r.w-26,r.y+41);c.stroke();}
      const bx=r.x+r.w-(tight?163:48),by=r.y+r.h-(tight?40:146);
      control(c,'zoom:in','',{x:bx,y:by,w:tight?32:36,h:tight?28:34},false,'+');
      control(c,'zoom:out','',{x:bx+(tight?37:0),y:by+(tight?0:36),w:tight?32:36,h:tight?28:34},false,'−');
      control(c,'locate','',{x:bx+(tight?74:0),y:by+(tight?0:75),w:tight?32:36,h:tight?28:30},false,'◎');
      control(c,'fit','전체',{x:bx+(tight?111:0),y:by+(tight?0:107),w:tight?40:36,h:28},zoom===1);
      const k=projection.k,target=(tight?30:70)/k,pow=10**Math.floor(Math.log10(target)),mantissa=target/pow,metres=(mantissa>=5?5:mantissa>=2?2:1)*pow,sw=metres*k;
      const sx=r.x+16,sy=r.y+r.h-16;c.strokeStyle='#b6c9c9';c.lineWidth=1.4;c.beginPath();c.moveTo(sx,sy-4);c.lineTo(sx,sy);c.lineTo(sx+sw,sy);c.lineTo(sx+sw,sy-4);c.stroke();
      text(c,metres>=1000?(metres/1000)+' km':metres+' m',sx,sy-13,10,C.muted,550);
      if(!compact)text(c,zoom.toFixed(1)+'×',r.x+r.w-67,sy-1,10,C.quiet,500,'right');
    }
    function overview(c) {
      const r=panel,pad=14,cy=r.y+r.h/2;box(c,r,C.panel,C.line,8);
      const st=data.stats||{},a=Number(st.allied)||0,total=Number(st.total)||0,right=filter==='support'?'지원 차량 '+(data.markers||[]).filter(m=>m.type==='support').length+'대':total?'아군 거점 '+a+' / '+total:'거점 선택 · 상세 정보';
      c.font='600 12px system-ui, sans-serif';const rightW=c.measureText(right).width;
      line(c,'현재 위치 · '+(data.currentLocation?.name||data.regionName||'중앙 대륙'),r.x+pad,cy,r.w-pad*2-rightW-20,13,C.text,600);
      text(c,right,r.x+r.w-pad,cy,12,total?C.ally:C.muted,600,'right');
      rosterRows=0;
    }
    function detailPanel(c) {
      const d=details,r=panel,pad=16,short=r.h<280;box(c,r,C.panel,C.line,12);
      const col=d.team==='enemy'?C.enemy:d.team==='ally'?C.ally:C.gold;
      const roster=d.roster||[],chosen=roster.find(m=>m.id===selectedMember);
      const capture=!chosen&&d.capture,compactCapture=capture&&r.h<300;
      if(markerById(selectedId)?.type==='support'&&r.h<220){
        rosterRows=0;
        line(c,d.title,r.x+12,r.y+20,r.w-73,15,col,650);
        control(c,'deselect','해제',{x:r.x+r.w-55,y:r.y+7,w:43,h:26});
        line(c,d.subtitle,r.x+12,r.y+45,r.w-24,11.5,C.muted);
        const rows=(d.lines||[]).slice(0,4),step=Math.min(23,(r.h-78)/Math.max(1,rows.length-1));
        rows.forEach((row,i)=>line(c,row,r.x+12,r.y+65+i*step,r.w-24,i===3?10:11.5,i===3?C.quiet:C.text));
        return;
      }
      control(c,'deselect','해제',{x:r.x+r.w-59,y:r.y+8,w:47,h:28});
      const marker=markerById(selectedId),distance=marker?Math.hypot(marker.x-data.player.x,marker.y-data.player.y):0;
      const distanceText=distance>=1000?(distance/1000).toFixed(1)+' km':Math.round(distance)+' m';
      if(compactCapture){
        // A narrow landscape panel still reserves room for both counts and a
        // selectable soldier row. Ownership already colors the site title.
        line(c,d.title||marker?.label,r.x+pad,r.y+22,r.w-pad-70,15,col,650);
      }else{
        text(c,'선택한 위치',r.x+pad,r.y+21,10,C.quiet,650);
        line(c,d.title||marker?.label,r.x+pad,r.y+49,r.w-pad*2,18,col,650);
        line(c,d.subtitle||((d.team==='ally'?'아군 영토':d.team==='enemy'?'적군 영토':'주요 위치')+' · '+distanceText),r.x+pad,r.y+75,r.w-pad*2,12,C.muted);
      }
      let rosterTop=112;
      if(capture){
        let yy=r.y+(compactCapture?48:100);
        yy+=wrapped(c,capture.summary,r.x+pad,yy,r.w-pad*2,14,C.text,2);
        if(compactCapture){line(c,capture.condition,r.x+pad,yy,r.w-pad*2,13,C.gold);yy+=20;}
        else yy+=wrapped(c,capture.condition,r.x+pad,yy,r.w-pad*2,13,C.gold,2);
        // Keep the immediate blocker visible on phones; a taller panel can
        // show every requirement without displacing the actual roster.
        if(r.h>=420)for(const requirement of (capture.lines||[]).slice(0,3)){
          yy+=wrapped(c,requirement,r.x+pad,yy,r.w-pad*2,12,C.muted,2)+3;
        }
        const progress=Number.isFinite(capture.progress)?clamp(capture.progress,0,1):0;
        c.fillStyle=C.line;c.fillRect(r.x+pad,yy+1,r.w-pad*2,3);
        c.fillStyle=C.ally;c.fillRect(r.x+pad,yy+1,(r.w-pad*2)*progress,3);
        rosterTop=yy-r.y+26;
      }
      if(roster.length) {
        const alive=roster.filter(m=>m.alive).length;
        if(chosen&&r.h<250){
          rosterRows=0;
          line(c,(chosen.role||chosen.name||'병사')+' · '+(chosen.weapon||'장비 없음'),r.x+pad,r.y+108,r.w-pad*2,12,C.gold,600);
          line(c,'체력 '+Math.round(chosen.hp||0)+' · '+(chosen.statusLabel||(chosen.alive?'배치 중':'전사 / 교대 대기')),r.x+pad,r.y+130,r.w-pad*2,11,C.muted);
          wrapped(c,(chosen.equipment||[]).join(' · '),r.x+pad,r.y+152,r.w-pad*2,11,C.muted,Math.max(1,Math.min(2,Math.floor((r.h-190)/18))));
          control(c,'member:back','병사 명단',{x:r.x+12,y:r.y+r.h-36,w:r.w-24,h:27});return;
        }
        const detailH=chosen?(short?72:104):short||capture?0:52,top=capture?rosterTop:103,rowH=31,pagerH=32;
        rosterRows=Math.max(capture?0:1,Math.min(9,Math.floor((r.h-top-pagerH-detailH-12)/rowH)));
        if(!rosterRows){rosterPages=1;rosterPage=0;return;}
        rosterPages=Math.max(1,Math.ceil(roster.length/rosterRows));rosterPage=clamp(rosterPage,0,rosterPages-1);
        text(c,'병력  '+alive+' / '+roster.length,r.x+pad,r.y+rosterTop-15,11,C.quiet,650);
        let yy=r.y+rosterTop;
        for(let i=0;i<rosterRows;i++) {
          const m=roster[rosterPage*rosterRows+i];if(!m)break;
          const b={x:r.x+10,y:yy+i*rowH,w:r.w-20,h:rowH-3};
          box(c,b,m.id===selectedMember?'#2c4647':i%2?'#162a34':'#142630',m.id===selectedMember?'#608a80':null,5);
          text(c,m.alive?'●':'×',b.x+12,b.y+b.h/2,9,m.alive?col:C.quiet);
          line(c,m.name||m.role||m.id,b.x+27,b.y+b.h/2,b.w-65,12.5,m.alive?C.text:C.quiet,500);
          if(!m.alive||m.phase==='reinforcing')text(c,m.phase==='reinforcing'?'증원':m.phase==='waiting'?'대기':'전사',b.x+b.w-10,b.y+b.h/2,10,C.quiet,500,'right');
          hits.push({...b,kind:'member',id:m.id});
        }
        const navY=yy+rosterRows*rowH+2;
        control(c,'page:prev','이전',{x:r.x+10,y:navY,w:56,h:27},false);
        text(c,(rosterPage+1)+' / '+rosterPages,r.x+r.w/2,navY+13,11,C.muted,550,'center');
        control(c,'page:next','다음',{x:r.x+r.w-66,y:navY,w:56,h:27},false);
        const detailY=navY+42;
        if(chosen) {
          line(c,(chosen.role||chosen.name||'병사')+' · '+(chosen.weapon||'장비 없음'),r.x+pad,detailY,r.w-pad*2,12,C.gold,650);
          line(c,'체력 '+Math.round(chosen.hp||0)+' · '+(chosen.statusLabel||(chosen.alive?'배치 중':'전사 / 교대 대기')),r.x+pad,detailY+21,r.w-pad*2,11,C.muted);
          if(detailY+43<r.y+r.h-8)wrapped(c,(chosen.equipment||[]).join(' · '),r.x+pad,detailY+42,r.w-pad*2,11,C.muted,short?1:2);
        }else if(!short&&!capture&&detailY<r.y+r.h-28)wrapped(c,d.hint||'병사를 선택하면 현재 장비를 확인할 수 있어요',r.x+pad,detailY,r.w-pad*2,12,C.muted,2);
      }else {
        rosterRows=0;let yy=r.y+(capture?rosterTop:109);
        for(const row of capture?[]:d.lines||[]){if(yy>r.y+r.h-28)break;yy+=wrapped(c,typeof row==='string'?row.text||row:row.label||'',r.x+pad,yy,r.w-pad*2,13,C.muted,2)+10;}
        if(d.hint&&yy<r.y+r.h-25)wrapped(c,d.hint,r.x+pad,yy,r.w-pad*2,12,C.muted,3);
      }
    }
    function draw(c,w,h) {
      if(!read(false))return false;getDetails();coordinateScale=Math.max(1,1/(data.uiScale||1));w/=coordinateScale;h/=coordinateScale;
      width=w;height=h;hits=[];layout(w,h);c.save();c.scale(coordinateScale,coordinateScale);c.globalAlpha=1;c.setLineDash([]);
      c.fillStyle=C.bg;c.fillRect(0,0,w,h);header(c,w,h);grid(c);mapMarkers(c);mapControls(c);details?detailPanel(c):overview(c);
      const tip=w<480?'드래그로 이동 · 두 손가락으로 확대':'드래그 이동   ·   휠 / + − 확대   ·   ◎ 내 위치   ·   M 닫기';
      if(h>=330)line(c,tip,viewport.x,h-15,w-viewport.x*2,11,C.quiet);
      c.restore();return true;
    }
    function drawMini(c,options) {
      if(!read(true))return false;const {x,y,size}=options,p=data.player,range=options.range||300;
      const head=23,foot=21,r={x,y,w:size,h:size},inner={x:x+4,y:y+head,w:size-8,h:size-head-foot};
      const k=inner.w/range,tf={ox:inner.x+inner.w/2-p.x*k,oy:inner.y+inner.h/2-p.y*k,k};
      c.save();box(c,r,'rgba(8,21,29,.95)','#658187',10);rect(c,inner.x,inner.y,inner.w,inner.h,3);c.clip();
      const view=worldView(tf,inner);
      c.fillStyle=C.sea;c.fillRect(inner.x,inner.y,inner.w,inner.h);host.paintTerrain(c,{...tf,mini:true,view});drawRoutes(c,tf,true,view);
      const miniMarkers=visibleMarkers(tf,inner,true).filter(m=>m.type!=='region');
      for(const m of miniMarkers)symbol(c,m,m.screenX,m.screenY,m.type==='support'?4:m.type==='vehicle'?2.8:3.2,false);
      // A single edge cue keeps a distant incoming convoy discoverable without
      // extending the radar range or exposing anything about hostile forces.
      const visible=new Set(miniMarkers.map(m=>m.id)),remote=(data.markers||[]).find(m=>m.type==='support'&&m.incoming&&!visible.has(m.id));
      let supportEdge=null;
      if(remote){
        const dx=remote.x-p.x,dy=remote.y-p.y,sx=dx*tf.k,sy=dy*tf.k;
        const factor=Math.min(1,(inner.w/2-9)/Math.max(.001,Math.abs(sx)),(inner.h/2-9)/Math.max(.001,Math.abs(sy)));
        const ex=inner.x+inner.w/2+sx*factor,ey=inner.y+inner.h/2+sy*factor;
        symbol(c,{...remote,yaw:Math.atan2(dy,dx)},ex,ey,3.4,false);
        supportEdge={id:remote.id,x:ex,y:ey,direction:Math.atan2(dy,dx)};
      }
      player(c,inner.x+inner.w/2,inner.y+inner.h/2,p.yaw,8);c.restore();
      c.save();line(c,data.regionName||'주변 지도',x+9,y+12,size-39,10.5,C.text,650);text(c,'N',x+size-14,y+12,10,C.gold,650,'center');
      const degrees=((p.yaw||0)*180/Math.PI+90+360)%360;
      text(c,Math.round(range)+' m',x+9,y+size-10,9.5,C.muted,550);text(c,Math.round(degrees).toString().padStart(3,'0')+'°',x+size/2,y+size-10,9,C.quiet,500,'center');text(c,'M',x+size-13,y+size-10,10,C.gold,600,'center');c.restore();
      miniCache={viewport:r,transform:tf,range,markers:miniMarkers.map(m=>({id:m.id,type:m.type,team:m.team,screenX:m.screenX,screenY:m.screenY})),supportEdge};return true;
    }
    function unscale(pt) {return{x:pt.x/coordinateScale,y:pt.y/coordinateScale};}
    function select(m) {
      if(m.cluster){center={x:m.x,y:m.y};zoom=clamp(zoom*2.2,1,14);area='custom';project();return;}
      selectedId=m.id;selectedMember=null;rosterPage=0;host.selectSite?.(m.siteId||null);lastExternal=m.siteId?'ef:'+m.siteId:null;
    }
    function clickInternal(pt) {
      const controlHit=[...hits].reverse().find(b=>b.kind!=='marker'&&inside(pt,b));
      if(controlHit) {
        if(controlHit.kind==='member'){selectedMember=controlHit.id;host.selectMember?.(selectedMember);return true;}
        const a=controlHit.action||controlHit.id;
        if(a==='close'){pointers.clear();gesture=null;host.close();}
        else if(a==='deselect'){selectedId=null;selectedMember=null;host.selectSite?.(null);lastExternal=null;}
        else if(a==='member:back'){selectedMember=null;host.selectMember?.(null);}
        else if(a.startsWith('area:'))fit(a.slice(5));
        else if(a.startsWith('filter:')){filter=a.slice(7);if(filter==='support')fit('support');}
        else if(a==='zoom:in')zoomAt(1.5);
        else if(a==='zoom:out')zoomAt(1/1.5);
        else if(a==='fit')fit('all');
        else if(a==='locate')locate();
        else if(a==='page:next')rosterPage=Math.min(rosterPages-1,rosterPage+1);
        else if(a==='page:prev')rosterPage=Math.max(0,rosterPage-1);
        return true;
      }
      if(!inside(pt,viewport))return true;
      const nearest=markerHits.map(b=>({b,d:Math.hypot(pt.x-b.cx,pt.y-b.cy)})).filter(o=>o.d<16).sort((a,b)=>a.d-b.d)[0];
      if(nearest){select(nearest.b.marker);return true;}
      const label=labels.find(b=>inside(pt,b));if(label){const m=markerById(label.id);if(m)select(m);}
      return true;
    }
    function click(pt) {return clickInternal(unscale(pt));}
    function pointerDown(pt,id=0) {
      pt=unscale(pt);if(!projection)return true;
      if(hits.some(b=>b.kind!=='marker'&&inside(pt,b))||!inside(pt,viewport)){clickInternal(pt);return true;}
      pointers.set(id,{start:{...pt},point:{...pt},moved:false});
      if(pointers.size===2){const ps=[...pointers.values()];ps.forEach(p=>p.moved=true);gesture={distance:Math.max(1,Math.hypot(ps[0].point.x-ps[1].point.x,ps[0].point.y-ps[1].point.y)),zoom};}
      return true;
    }
    function pointerMove(pt,id=0) {
      pt=unscale(pt);hover=pt;const p=pointers.get(id);if(!p||!projection)return true;
      const previous=p.point;p.point={...pt};if(Math.hypot(pt.x-p.start.x,pt.y-p.start.y)>4)p.moved=true;
      if(pointers.size>1&&gesture){const ps=[...pointers.values()],dist=Math.max(1,Math.hypot(ps[0].point.x-ps[1].point.x,ps[0].point.y-ps[1].point.y));
        zoomAt((gesture.zoom*dist/gesture.distance)/zoom,{x:(ps[0].point.x+ps[1].point.x)/2,y:(ps[0].point.y+ps[1].point.y)/2});return true;}
      if(p.moved){center.x-=(pt.x-previous.x)/projection.k;center.y-=(pt.y-previous.y)/projection.k;area='custom';project();}return true;
    }
    function pointerUp(pt,id=0,cancel=false) {
      pt=unscale(pt);const p=pointers.get(id);pointers.delete(id);if(pointers.size<2)gesture=null;
      if(p&&!p.moved&&!cancel)clickInternal(pt);return true;
    }
    function wheel(delta,pt) {if(!projection)return false;const p=pt?unscale(pt):null;if(p&&inside(p,panel))return true;zoomAt(Math.exp(clamp(-delta,-180,180)*.0035),p);return true;}
    function key(k) {
      if(k==='escape'||k==='m'){host.close();return true;}
      if(k==='+'||k==='=')zoomAt(1.5);else if(k==='-'||k==='_')zoomAt(1/1.5);else if(k==='0')fit('all');
      else if(k==='arrowleft'||k==='arrowright'||k==='arrowup'||k==='arrowdown'){if(!center||!projection)return true;center.x+=(k==='arrowright'?1:k==='arrowleft'?-1:0)*80/projection.k;center.y+=(k==='arrowdown'?1:k==='arrowup'?-1:0)*80/projection.k;area='custom';project();}
      return true;
    }
    function cancelInput() {pointers.clear();gesture=null;hover=null;}
    function focusSupport() {
      if(!read(false))return false;
      cancelInput();selectedId=null;selectedMember=null;details=null;lastExternal=null;
      host.selectSite?.(null);host.selectMember?.(null);filter='support';area='support';rosterPage=0;needFit=false;pendingFocus='support';return true;
    }
    function open({preserveSelection=false}={}) {
      cancelInput();
      if(!preserveSelection){selectedId=null;selectedMember=null;details=null;lastExternal=null;host.selectSite?.(null);host.selectMember?.(null);}
      rosterPage=0;needFit=false;pendingFocus=preserveSelection?'selection':'player';
    }
    function inspect() {return{viewport,panel,transform:projection,hits:hits.map(b=>({...b})),labels:labels.map(b=>({...b})),selectedId,selectedMember,details,filter,area,zoom,rosterPage,rosterRows,rosterPages,coordinateScale,playerMarker,nearby,mini:miniCache};}
    return {open,draw,drawMini,click,pointerDown,pointerMove,pointerUp,wheel,key,inspect,cancelInput,focusSupport};
  }
  global.HanQTacticalMap=Object.freeze({version:'2026.11.24.2',create});
})(typeof window!=='undefined'?window:globalThis);

