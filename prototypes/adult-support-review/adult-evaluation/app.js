import {CASES,RUBRIC,createEvaluationSession} from './model.js';
const RATING_LABELS={pass:'通过',fail:'不通过',uncertain:'待核查'};
const DECISION_LABELS={acceptable:'本次评审可接受',revise:'需修订','needs-review':'待复核'};
export function restoreDialogFocus(doc,trigger){
 const target=trigger?.isConnected?trigger:(trigger?.id?doc.getElementById(trigger.id):null);
 if(target&&!target.disabled)target.focus({preventScroll:true});
 else doc.getElementById('case-list').querySelector('button')?.focus({preventScroll:true});
}
export function mountEvaluation(doc=globalThis.document,win=globalThis.window){
 const session=createEvaluationSession(),get=id=>doc.getElementById(id),dialog=get('confirm-dialog');
 let pending=null,returnFocus=null;
 const make=(tag,text,className)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
 const notify=text=>{get('notice').textContent=text;};
 function resultMessage(result){return result?.code==='STALE_REVISION'?'页面状态已变化，请重新操作。':'未完成操作，请检查当前评审状态。';}
 function closeConfirm(){pending=null;if(dialog.open)dialog.close();}
 function ask({title,description,label,revision,action},trigger){
  if(dialog.open)return;
  pending={revision,action};returnFocus=trigger;
  get('confirm-title').textContent=title;get('confirm-description').textContent=description;get('confirm-accept').textContent=label;
  dialog.showModal();get('confirm-cancel').focus();
 }
 function select(caseId,candidateId,revision,trigger){
  const outcome=session.select(caseId,candidateId,revision);
  if(outcome.ok){render();notify('已载入合成用例。请独立评审当前候选。');return;}
  if(outcome.code==='UNSAVED_REVIEW')ask({title:'放弃未保存的评审草稿？',description:'切换用例或候选会清空当前未保存的判断。已保存的评审记录不受影响。',label:'放弃草稿并切换',revision,action:()=>session.select(caseId,candidateId,revision,{discard:true})},trigger);
  else notify(resultMessage(outcome));
 }
 function render(){
  const focusId=doc.activeElement?.id,s=session.snapshot(),current=CASES.find(c=>c.id===s.caseId),candidate=current.candidates.find(c=>c.id===s.candidateId);
  const cases=get('case-list');cases.replaceChildren();
  for(const c of CASES){const b=make('button',undefined,'case-button');b.type='button';b.id='case-'+c.id;b.setAttribute('aria-pressed',String(c.id===s.caseId));b.append(make('span',c.title),make('small',c.subject));b.addEventListener('click',()=>select(c.id,'A',s.revision,b));cases.append(b);}
  const variants=get('candidate-list');variants.replaceChildren();
  for(const c of current.candidates){const b=make('button','候选 '+c.id);b.type='button';b.id='candidate-'+c.id;b.title=c.label;b.setAttribute('aria-pressed',String(c.id===s.candidateId));b.addEventListener('click',()=>select(current.id,c.id,s.revision,b));variants.append(b);}
  get('case-title').textContent=current.title;get('case-prompt').textContent=current.prompt;get('reference-answer').textContent='参考结论：'+current.reference.answer;get('reference-reasoning').textContent=current.reference.reasoning;
  get('reference-checks').replaceChildren(...current.reference.checks.map(x=>make('li',x)));
  get('candidate-title').textContent='候选 '+candidate.id+' · '+candidate.label;get('candidate-text').textContent=candidate.text;get('fixture-note').textContent=candidate.fixtureNote;
  const rubric=get('rubric-list');rubric.replaceChildren();
  for(const criterion of RUBRIC){const field=make('fieldset'),legend=make('legend',criterion.label),description=make('p',criterion.description,'criterion-description'),choices=make('div',undefined,'rating-options');description.id='description-'+criterion.id;field.setAttribute('aria-describedby',description.id);field.append(legend,description,choices);
   for(const [value,label] of Object.entries(RATING_LABELS)){const wrap=make('label',undefined,'rating-option'),radio=make('input');radio.type='radio';radio.name='rating-'+criterion.id;radio.id='rating-'+criterion.id+'-'+value;radio.value=value;radio.checked=s.ratings[criterion.id]===value;wrap.htmlFor=radio.id;wrap.append(radio,make('span',label));radio.addEventListener('change',()=>{if(!radio.checked)return;const outcome=session.rate(criterion.id,value,s.revision);if(outcome.ok){render();notify('判断已记入本次草稿，尚未保存。');}else notify(resultMessage(outcome));});choices.append(wrap);}
   rubric.append(field);
  }
  const count=RUBRIC.filter(c=>Object.hasOwn(s.ratings,c.id)).length;get('draft-state').textContent=count+' / '+RUBRIC.length+' 项已判断 · '+(s.dirty?'未保存草稿':'无未保存变更');get('save-review').disabled=count!==RUBRIC.length||!s.dirty;
  get('save-review').onclick=()=>{const outcome=session.save(s.revision);if(outcome.ok){render();notify('评审已保存至本次页面会话。需要保留时请下载报告。');}else notify(resultMessage(outcome));};
  const total=CASES.reduce((n,c)=>n+c.candidates.length,0);get('review-count').textContent=s.records.length+' / '+total;
  get('results-summary').textContent=Object.entries(DECISION_LABELS).map(([k,v])=>v+' '+s.records.filter(r=>r.derivedDecision===k).length).join(' · ');
  const matrix=get('review-matrix');matrix.replaceChildren();
  for(const c of CASES)for(const v of c.candidates){const row=make('tr'),record=s.records.find(r=>r.caseId===c.id&&r.candidateId===v.id);row.append(make('td',c.title),make('td',v.id));for(const criterion of RUBRIC)row.append(make('td',record?RATING_LABELS[record.ratings[criterion.id]]:'未评审'));row.append(make('td',record?DECISION_LABELS[record.derivedDecision]:'未评审',record?'decision decision-'+record.derivedDecision:''));const cell=make('td'),button=make('button',record?'再次评审':'评审');button.type='button';button.id='matrix-'+c.id+'-'+v.id;button.setAttribute('aria-label',(record?'再次评审':'评审')+' '+c.title+' 候选 '+v.id);button.addEventListener('click',()=>select(c.id,v.id,s.revision,button));cell.append(button);row.append(cell);matrix.append(row);}
  get('export-report').disabled=s.records.length===0;get('clear-reviews').disabled=s.records.length===0&&!s.dirty;
  get('clear-reviews').onclick=()=>ask({title:'清空本次评审？',description:'这会清空当前页面中的已保存评审与未保存草稿。已下载的报告、原学习作品及其他浏览器记录不会被修改。',label:'确认清空本次评审',revision:s.revision,action:()=>session.clear(s.revision)},get('clear-reviews'));
  if(focusId)get(focusId)?.focus({preventScroll:true});
 }
 get('confirm-cancel').addEventListener('click',closeConfirm);
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeConfirm();});
 dialog.addEventListener('close',()=>{pending=null;restoreDialogFocus(doc,returnFocus);returnFocus=null;});
 get('confirm-accept').addEventListener('click',()=>{const action=pending;if(!action)return;if(session.snapshot().revision!==action.revision){closeConfirm();notify('评审状态已变化，没有放弃或清空任何内容。');return;}const outcome=action.action();closeConfirm();if(outcome.ok){render();notify('已完成确认操作。已下载报告不受影响。');}else notify(resultMessage(outcome));});
 get('export-report').addEventListener('click',()=>{if(!session.snapshot().records.length)return;let url;try{const report=session.exportReport(),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'});url=win.URL.createObjectURL(blob);const a=make('a');a.href=url;a.download='adult-synthetic-evaluation.json';doc.body.append(a);a.click();a.remove();notify('已生成本地报告下载，仅含已保存评审。请在浏览器下载列表确认。');}catch{notify('报告下载未能启动；当前页面内的评审仍然保留。');}finally{if(url)win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);}});
 win.addEventListener('beforeunload',event=>{if(session.snapshot().dirty){event.preventDefault();event.returnValue='';}});
 render();return Object.freeze({snapshot:()=>session.snapshot()});
}
if(typeof document!=='undefined'&&typeof window!=='undefined')mountEvaluation(document,window);
