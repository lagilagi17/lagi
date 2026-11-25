/* HanQ — readable native-game documents and a reusable investigation journal.
 * Text-only DOM. Does not own game state, pointer lock, actors or save data.
 */
(function (host) {
  'use strict';
  const VERSION = 1;
  const text = value => typeof value === 'string' ? value : '';
  function create(options = {}) {
    let disposed = false, opened = false, nodes = null, mountedRoot = null;
    let openStory = null, currentView = null, previousFocus = null, lastSignature = '', launcherNarrow = null;
    let focusable = [];
    const listeners = [], closingKeys = new Set();
    const doc = host.document || (typeof document !== 'undefined' ? document : null);
    const keysTarget = typeof host.addEventListener === 'function' ? host : doc;
    function safe(fn, fallback = null) {
      if (typeof fn !== 'function') return fallback;
      try { return fn(); } catch (_) { return fallback; }
    }
    function story() { return safe(options.getStory); }
    function available() { return !disposed && !!safe(options.isAvailable, false); }
    function listen(target,type,handler,capture=false) {
      if (!target?.addEventListener) return;
      target.addEventListener(type,handler,capture);listeners.push([target,type,handler,capture]);
    }
    function stop(event,prevent=false) {
      if (prevent && event.cancelable !== false) event.preventDefault?.();
      event.stopPropagation?.();
    }
    function keyName(event) {
      const key=String(event.key||event.code||'').toLowerCase();
      return key==='keye'?'e':key==='keyf'?'f':key==='esc'?'escape':key;
    }
    function keyboard(event) {
      const key=keyName(event),closing=closingKeys.has(key);
      if (!opened && !closing) return;
      event.stopImmediatePropagation?.();stop(event);
      if (closing) {
        event.preventDefault?.();
        if (event.type==='keyup') closingKeys.delete(key);
        return;
      }
      if (event.type==='keydown' && (key==='e'||key==='f'||key==='escape')) {
        event.preventDefault?.();closingKeys.add(key);close();return;
      }
      if (event.type==='keydown' && key==='tab') {
        event.preventDefault?.();
        const items=focusable.filter(item=>!item.hidden&&!item.disabled);
        if (items.length) {
          const at=items.indexOf(doc?.activeElement),next=event.shiftKey?(at<=0?items.length-1:at-1):(at+1)%items.length;
          items[next].focus?.({preventScroll:true});
        }
      }
      // Preserve native text selection, copying, button activation and scrolling.
      // Capture + stopImmediatePropagation keeps every game key handler out.
    }
    listen(keysTarget,'keydown',keyboard,true);
    listen(keysTarget,'keyup',keyboard,true);
    listen(keysTarget,'keypress',keyboard,true);
    listen(host,'blur',()=>closingKeys.clear());
    function node(tag,className,content) {
      const element=doc.createElement(tag);if(className)element.className=className;
      if(content!==undefined)element.textContent=text(content);return element;
    }
    function button(label,action,kind='secondary') {
      const element=node('button','hcj-button hcj-'+kind,label);element.type='button';
      element.style.cssText='min-height:42px;border:1px solid #7e8061;border-radius:9px;background:#263d34;color:#f3e6c0;padding:9px 14px;font:600 13px system-ui,sans-serif;line-height:1.3;cursor:pointer;touch-action:manipulation';
      listen(element,'click',event=>{stop(event,true);action();});return element;
    }
    function hidden(element,value,display='block') {
      if(!element)return;element.hidden=!!value;element.style.display=value?'none':display;
    }
    function placeLauncher(root) {
      const width=Number(root?.clientWidth),narrow=width>0&&width<600;
      if(!nodes||launcherNarrow===narrow)return;
      launcherNarrow=narrow;
      nodes.launcher.style.top=narrow?'118px':'54px';
      nodes.launcher.style.left=narrow?'50%':'14px';
      nodes.launcher.style.transform=narrow?'translateX(-50%)':'none';
    }
    function ensure() {
      const root=safe(options.getRoot);
      if(!doc || !root?.appendChild || disposed)return false;
      if(!nodes) {
        const container=node('div','hanq-citadel-journal');container.id='hanq-citadel-journal';
        container.style.cssText='position:absolute;inset:0;z-index:180;pointer-events:none;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:#f2e9d1';
        const launcher=button('조사 수첩',openJournal);launcher.id='hanq-citadel-journal-button';
        launcher.setAttribute('aria-label','사라진 대피 명령 조사 수첩 열기');launcher.setAttribute('aria-haspopup','dialog');
        // The minimap occupies the upper-right corner. Wide layouts use the
        // space below left stats; narrow layouts sit below the center status.
        launcher.style.cssText+=';position:absolute;top:54px;left:14px;min-height:38px;padding:8px 12px;border-color:#b4a16b;background:rgba(16,35,28,.94);box-shadow:0 3px 12px #0006;pointer-events:auto';
        const backdrop=node('div','hcj-backdrop');backdrop.style.cssText='position:absolute;inset:0;box-sizing:border-box;padding:12px;display:flex;align-items:center;justify-content:center;background:rgba(3,12,9,.68);pointer-events:auto';
        const panel=node('section','hcj-panel');panel.id='hanq-citadel-journal-panel';
        panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','hanq-citadel-journal-title');
        panel.style.cssText='display:flex;flex-direction:column;box-sizing:border-box;width:680px;max-width:100%;max-height:100%;min-height:0;border:1px solid #b39b60;border-radius:16px;background:linear-gradient(155deg,#20392e,#10271f 72%);box-shadow:0 18px 70px #000a;overflow:hidden;pointer-events:auto';
        const head=node('header','hcj-head');head.style.cssText='display:flex;align-items:flex-start;gap:14px;flex-shrink:0;padding:15px 17px 12px;border-bottom:1px solid #8d80534d';
        const heading=node('div','hcj-heading');heading.style.cssText='flex:1;min-width:0';
        const eyebrow=node('div','hcj-eyebrow','백월 대왕성 · 사라진 대피 명령');eyebrow.style.cssText='font-size:10px;letter-spacing:1.1px;color:#c8b67b;line-height:1.5;margin-bottom:6px';
        const title=node('h2','hcj-title');title.id='hanq-citadel-journal-title';title.style.cssText='margin:0;font-size:20px;line-height:1.35;letter-spacing:-.4px;font-weight:750;color:#fff0c9;overflow-wrap:anywhere';
        const location=node('p','hcj-location');location.style.cssText='margin:6px 0 0;color:#abd0bb;font-size:11px;line-height:1.5';
        const closeButton=button('닫기',close);closeButton.id='hanq-citadel-journal-close';closeButton.setAttribute('aria-label','조사 기록 닫기');
        closeButton.style.cssText+=';flex-shrink:0;min-height:42px;padding:9px 12px;background:#294137';
        heading.appendChild(eyebrow);heading.appendChild(title);heading.appendChild(location);head.appendChild(heading);head.appendChild(closeButton);
        const body=node('div','hcj-body');body.tabIndex=0;body.setAttribute('aria-label','기록 본문');
        body.style.cssText='flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:7px 19px 13px;font-size:14px;line-height:1.85;word-break:keep-all;overflow-wrap:anywhere;user-select:text';
        const footer=node('footer','hcj-footer');footer.style.cssText='flex-shrink:0;padding:12px 17px 13px;border-top:1px solid #8d80534d;background:#0b211a80';
        const objectiveLabel=node('div','hcj-objective-label','현재 목표');objectiveLabel.style.cssText='font-size:10px;letter-spacing:.7px;font-weight:700;color:#c8b67b;margin-bottom:3px';
        const objective=node('div','hcj-objective');objective.style.cssText='font-size:12px;line-height:1.6;color:#ece4c7;overflow-wrap:anywhere';
        const actions=node('div','hcj-actions');actions.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:9px';
        const toJournal=button('조사 수첩 · 모은 기록',openJournal);toJournal.dataset.action='journal';
        const hint=node('span','hcj-hint','E · F · Esc 닫기');hint.style.cssText='font-size:10px;line-height:1.5;color:#a9bdb0;text-align:right';
        actions.appendChild(toJournal);actions.appendChild(hint);footer.appendChild(objectiveLabel);footer.appendChild(objective);footer.appendChild(actions);
        panel.appendChild(head);panel.appendChild(body);panel.appendChild(footer);backdrop.appendChild(panel);container.appendChild(launcher);container.appendChild(backdrop);
        for(const type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','mousemove','touchstart','touchend','touchmove','wheel','click','dblclick'])listen(container,type,event=>stop(event));
        listen(container,'contextmenu',event=>stop(event));
        listen(backdrop,'click',event=>{if(event.target===backdrop){stop(event,true);close();}});
        nodes={container,launcher,backdrop,panel,body,title,location,objectiveLabel,objective,toJournal,closeButton};
        hidden(backdrop,true,'flex');hidden(launcher,true,'inline-flex');
      }
      if(mountedRoot!==root||nodes.container.parentElement!==root) {root.appendChild(nodes.container);mountedRoot=root;}
      placeLauncher(root);
      return true;
    }
    function clearBody() {
      // Drop handlers from replaced journal rows as well as their DOM nodes.
      // Reopening the notebook must not retain every previous button closure.
      for(let i=listeners.length-1;i>=0;i--) {
        const [target,type,handler,capture]=listeners[i];let parent=target?.parentElement,inside=false;
        while(parent){if(parent===nodes.body){inside=true;break;}parent=parent.parentElement;}
        if(inside){target.removeEventListener?.(type,handler,capture);listeners.splice(i,1);}
      }
      while(nodes.body.firstChild)nodes.body.removeChild(nodes.body.firstChild);
      nodes.body.scrollTop=0;focusable=[nodes.closeButton,nodes.body];
    }
    function paragraph(content,muted=false) {
      const p=node('p','hcj-paragraph',content);p.style.cssText='margin:12px 0;color:'+(muted?'#a9c4b4':'#f0e9d5');nodes.body.appendChild(p);return p;
    }
    function status() {return safe(()=>story()?.status?.(),{});}
    function updateObjective(current=status()) {
      if(!nodes)return;
      nodes.objectiveLabel.textContent=current.completed?'조사 결과':'현재 목표';
      nodes.objective.textContent=text(current.objective)||text(currentView?.result?.objective);
    }
    function begin() {
      if(!available()||!ensure())return false;
      hidden(nodes.backdrop,false,'flex');hidden(nodes.launcher,true,'inline-flex');
      if(!opened) {
        opened=true;openStory=story();previousFocus=doc?.activeElement||null;
        safe(options.onOpen);nodes.closeButton.focus?.({preventScroll:true});
      }
      return true;
    }
    function show(result) {
      if(!result||typeof result!=='object'||result.handled===false||result.silent===true||!begin())return false;
      const paragraphs=Array.isArray(result.paragraphs)?result.paragraphs.filter(value=>typeof value==='string').slice(0,32):text(result.text).split(/\n\n+/).filter(Boolean);
      currentView={kind:'record',result:{id:text(result.id),title:text(result.title),location:text(result.location),paragraphs:paragraphs.slice(),objective:text(result.objective)}};
      clearBody();nodes.title.textContent=text(result.title)||'조사 기록';nodes.location.textContent=text(result.location);
      for(const content of paragraphs)paragraph(content);
      if(!paragraphs.length)paragraph('이 기록에는 추가 본문이 없습니다.',true);
      hidden(nodes.toJournal,false,'inline-flex');focusable.push(nodes.toJournal);updateObjective();
      return true;
    }
    function renderJournal(journal) {
      clearBody();nodes.title.textContent='조사 수첩';nodes.location.textContent=text(journal.title)||'사라진 대피 명령';
      const summary=node('p','hcj-summary','궁성 기록 '+(Number(journal.palaceCount)||0)+' / 4 · 전체 기록 '+(Number(journal.recordCount)||0)+' / 6');
      summary.style.cssText='margin:13px 0 9px;color:#c8b67b;font-size:12px';nodes.body.appendChild(summary);
      if(journal.conclusion)paragraph(text(journal.conclusion));
      const entries=Array.isArray(journal.entries)?journal.entries.slice(0,16):[];
      if(!entries.length)paragraph('아직 읽은 문서가 없습니다. 왕실 기록관이 알려 준 장소에서 기록을 찾으면 이 수첩에 전문을 보관합니다.',true);
      for(const record of entries) {
        const entry=button('',()=>show({...record,objective:status().objective}),'entry');entry.dataset.recordId=text(record.id);
        entry.style.cssText='display:block;width:100%;box-sizing:border-box;margin:9px 0;border:1px solid #8d80534d;border-radius:10px;background:#29413780;color:#f0e8d1;text-align:left;padding:12px 13px;font:inherit;cursor:pointer;touch-action:manipulation';
        const heading=node('span','hcj-entry-title',text(record.title));heading.style.cssText='display:block;font-size:14px;line-height:1.5;font-weight:700;color:#f3e4b9';
        const location=node('span','hcj-entry-location',text(record.location));location.style.cssText='display:block;margin-top:4px;font-size:10px;line-height:1.5;color:#9cc7b2';
        const excerpt=node('span','hcj-entry-excerpt',text(record.excerpt));excerpt.style.cssText='display:block;margin-top:7px;font-size:12px;line-height:1.7;color:#d3dccb';
        entry.appendChild(heading);entry.appendChild(location);entry.appendChild(excerpt);nodes.body.appendChild(entry);focusable.push(entry);
      }
      if(Array.isArray(journal.events)&&journal.events.length)paragraph('확인한 이동·공명: '+journal.events.slice(0,8).map(event=>text(event.title)).filter(Boolean).join(' · '),true);
      hidden(nodes.toJournal,true,'inline-flex');updateObjective(journal);
    }
    function openJournal() {
      const owner=story(),journal=safe(()=>owner?.journal?.());
      if(!journal?.started||!begin())return false;
      currentView={kind:'journal'};lastSignature=signature(owner,journal);renderJournal(journal);return true;
    }
    function signature(owner,current) {return JSON.stringify(safe(()=>owner?.serialize?.(),current)||{});}
    function close() {
      if(!opened)return false;
      opened=false;openStory=null;currentView=null;lastSignature='';
      if(nodes) {
        hidden(nodes.backdrop,true,'flex');hidden(nodes.launcher,!(available()&&status().started),'inline-flex');
      }
      safe(options.onClose);
      if(previousFocus && previousFocus!==doc?.body && previousFocus.parentElement)previousFocus.focus?.({preventScroll:true});
      else if(nodes&&!nodes.launcher.hidden)nodes.launcher.focus?.({preventScroll:true});
      previousFocus=null;focusable=[];return true;
    }
    function update() {
      if(disposed)return false;
      if(!available()) {close();if(nodes)hidden(nodes.launcher,true,'inline-flex');return false;}
      const owner=story(),current=safe(()=>owner?.status?.(),{});
      if(opened&&(owner!==openStory||!current.started))close();
      if(!current.started&&!opened) {if(nodes)hidden(nodes.launcher,true,'inline-flex');return false;}
      if(!ensure()){close();if(nodes)hidden(nodes.launcher,true,'inline-flex');return false;}
      hidden(nodes.launcher,opened||!current.started,'inline-flex');
      if(opened) {
        updateObjective(current);
        if(currentView?.kind==='journal') {
          const next=signature(owner,current);
          if(next!==lastSignature){lastSignature=next;renderJournal(safe(()=>owner.journal(),{}));}
        }
      }
      return true;
    }
    function dispose() {
      if(disposed)return;
      close();disposed=true;closingKeys.clear();
      for(const [target,type,handler,capture]of listeners)target.removeEventListener?.(type,handler,capture);
      listeners.length=0;
      if(nodes?.container.parentElement)nodes.container.parentElement.removeChild(nodes.container);
      nodes=null;mountedRoot=null;openStory=null;previousFocus=null;focusable=[];
    }
    return {show,openJournal,close,update,isOpen:()=>opened,dispose};
  }
  host.HanQCitadelJournal=Object.freeze({version:VERSION,create});
})(typeof window!=='undefined'?window:globalThis);
