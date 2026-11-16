import {SUPPORT_SCENARIOS,SUPPORT_ACTIONS,createSupportSession,rehearsalLinks} from './support-model.js';
// Adult-only synthetic plan review; no personal input, transport or persistence.
export function mountSupport(doc=globalThis.document,win=globalThis.window){
 const session=createSupportSession(),get=id=>doc.getElementById(id),dialog=get('support-confirm');
 const make=(tag,text,className)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
 const notify=text=>{get('support-notice').textContent=text;};
 let pending=null,returnFocusId=null;
 const failure=r=>r.code==='STALE_REVIEW'?'页面状态已变化，未改动较新的方案。':'操作没有完成，请检查当前方案。';
 function close(){pending=null;if(dialog.open)dialog.close();}
 function ask(title,description,label,revision,action,trigger){
  if(dialog.open)return;pending={revision,action};returnFocusId=trigger.id;
  get('support-confirm-title').textContent=title;get('support-confirm-description').textContent=description;get('support-confirm-accept').textContent=label;
  dialog.showModal();get('support-confirm-cancel').focus();
 }
 function select(id,revision,trigger){
  const r=session.select(id,revision);
  if(r.ok){render();notify('已载入合成情境，没有改变已保存方案。');}
  else if(r.code==='UNSAVED_REVIEW')ask('放弃未保存的支持方案？','只会放弃当前支持方案草稿，已保存方案和讲解审校不受影响。','放弃草稿并切换',revision,()=>session.select(id,revision,{discard:true}),trigger);
  else notify(failure(r));
 }
 function render(){
  const focus=doc.activeElement?.id,s=session.snapshot(),scene=SUPPORT_SCENARIOS.find(x=>x.id===s.scenarioId);
  get('support-scenario-list').replaceChildren(...SUPPORT_SCENARIOS.map(x=>{const b=make('button',x.title,'case-button');b.type='button';b.id='support-scene-'+x.id;b.setAttribute('aria-pressed',String(x.id===scene.id));b.onclick=()=>select(x.id,s.revision,b);return b;}));
  get('support-scenario-title').textContent=scene.title;get('support-scenario-summary').textContent=scene.summary;
  get('support-timeline').replaceChildren(...scene.timeline.map(x=>{const li=make('li');li.append(make('strong',x.label),make('p','任务：'+x.prompt),make('p','合成表现：'+x.response),make('p','支持条件：'+x.assistance,'muted'));return li;}));
  get('support-evidence').textContent=scene.evidence;get('support-limit').textContent=scene.limit;
  get('support-action-list').replaceChildren(...SUPPORT_ACTIONS.map(x=>{const label=make('label',undefined,'support-action'),input=make('input');input.type='radio';input.name='support-action';input.id='support-action-'+x.id;input.value=x.id;input.checked=s.actionId===x.id;const body=make('span');body.append(make('strong',x.label),make('small',x.description));label.htmlFor=input.id;label.append(input,body);input.onchange=()=>{if(!input.checked)return;const r=session.choose(x.id,s.revision);if(r.ok){render();notify('已记录支持方案草稿，尚未保存。');}else notify(failure(r));};return label;}));
  const chosen=SUPPORT_ACTIONS.find(x=>x.id===s.actionId),recommended=SUPPORT_ACTIONS.find(x=>x.id===scene.recommendedActionId);
  get('support-rehearsal').replaceChildren(...rehearsalLinks(scene.id).map((link,index)=>{const b=make('button',link.label);b.type='button';b.id='support-rehearsal-'+index;b.onclick=()=>select(link.target,s.revision,b);return b;}));
  get('support-choice').textContent=chosen?'当前拟定：'+chosen.label+'。请对照证据与限制，再决定是否保存。':'尚未选择下一步支持，不会自动代选。';
  get('support-recommended').textContent='本例参考：'+recommended.label;get('support-rationale').textContent=scene.rationale;get('support-next-check').textContent=scene.nextCheck;get('support-fallback').textContent=scene.fallback;
  get('support-draft-state').textContent=s.dirty?'未保存的支持方案草稿':'无未保存的支持方案变更';
  get('support-save').disabled=!s.actionId||!s.dirty;get('support-save').onclick=()=>{const r=session.save(s.revision);if(r.ok){render();notify('支持方案已保存在本页内存。要保留请下载报告。');}else notify(failure(r));};
  get('support-record-count').textContent=s.records.length+' / '+SUPPORT_SCENARIOS.length;
  get('support-records').replaceChildren(...s.records.map(r=>{const scene=SUPPORT_SCENARIOS.find(x=>x.id===r.scenarioId),action=SUPPORT_ACTIONS.find(x=>x.id===r.actionId),li=make('li'),text=make('div');text.append(make('strong',scene.title),make('p','拟定支持：'+action.label));const b=make('button','再次审查');b.type='button';b.id='support-reopen-'+scene.id;b.setAttribute('aria-label','再次审查 '+scene.title);b.onclick=()=>select(scene.id,s.revision,b);li.append(text,b);return li;}));
  if(!s.records.length)get('support-records').append(make('li','还没有已保存方案。'));
  get('support-export').disabled=!s.records.length;get('support-clear').disabled=!s.records.length&&!s.dirty;
  get('support-clear').onclick=()=>ask('清空本次支持方案？','清空本页支持方案记录和草稿。讲解审校、已下载文件和原学习作品不受影响。','确认清空支持方案',s.revision,()=>session.clear(s.revision),get('support-clear'));
  if(focus)get(focus)?.focus({preventScroll:true});
 }
 get('support-confirm-cancel').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{pending=null;const target=get(returnFocusId);(target&&!target.disabled?target:get('support-scenario-list').querySelector('button'))?.focus({preventScroll:true});returnFocusId=null;});
 get('support-confirm-accept').onclick=()=>{const current=pending;if(!current)return;if(session.snapshot().revision!==current.revision){close();notify('页面状态已变化，没有清空或放弃内容。');return;}const r=current.action();close();if(r.ok){render();notify('已完成确认操作，讲解审校不受影响。');}else notify(failure(r));};
 get('support-export').onclick=()=>{if(!session.snapshot().records.length)return;let url;try{const blob=new Blob([JSON.stringify(session.exportReport(),null,2)],{type:'application/json;charset=utf-8'});url=win.URL.createObjectURL(blob);const a=make('a');a.href=url;a.download='adult-synthetic-support-review.json';doc.body.append(a);a.click();a.remove();notify('已生成支持方案报告下载。请在浏览器下载列表确认，草稿未包含在内。');}catch{notify('下载未能启动，当前支持方案仍保留在页面内。');}finally{if(url)win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);}};
 win.addEventListener('beforeunload',e=>{if(session.snapshot().dirty){e.preventDefault();e.returnValue='';}});
 for(const name of ['explanation','support'])get('show-'+name).onclick=()=>{for(const kind of ['explanation','support']){get(kind+'-workspace').hidden=name!==kind;get('show-'+kind).setAttribute('aria-pressed',String(name===kind));}get('workflow-skip').setAttribute('href',name==='support'?'#support-heading':'#workspace');get('show-'+name).focus({preventScroll:true});};
 render();return Object.freeze({snapshot:()=>session.snapshot()});
}
if(typeof document!=='undefined'&&typeof window!=='undefined')mountSupport(document,window);
