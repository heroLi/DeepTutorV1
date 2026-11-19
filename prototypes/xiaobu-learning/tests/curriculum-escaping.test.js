import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,source} from '../dist/curriculum-model.js';
test('synthetic markup stays text in subject labels, question, hint, options, review and report',async()=>{
 const old={document:globalThis.document,confirm:globalThis.confirm,checked:source.checked};
 const subject=catalog.find(s=>s.id==='english'),snapshot=structuredClone(subject);
 const payload='</textarea><img src=x onerror="alert(1)">&\'example';
 const make=()=>({innerHTML:'',events:{},addEventListener(t,f){this.events[t]=f;},focus(){}});
 const list=make(),round=make();globalThis.document={querySelector:s=>s==='#catalog'?list:round};globalThis.confirm=()=>true;
 const click=(el,dataset)=>el.events.click({target:{closest:()=>({dataset})}});
 const safe=html=>{assert.ok(!html.includes(payload));assert.doesNotMatch(html,/<img\b/);assert.ok(html.includes('&lt;img'));};
 try{
  subject.label=payload;source.checked=payload;
  const q=subject.questions[0];q.text='原创句子：'+payload;q.hint=payload;q.reason=payload;q.choices[0]=payload;q.answer=payload;
  await import('../dist/curriculum-ui.js?escaping');safe(list.innerHTML);
  click(list,{subject:'english'});safe(round.innerHTML);
  assert.match(round.innerHTML,/lang="en">&lt;\/textarea&gt;/);
  click(round,{action:'hint'});safe(round.innerHTML);
  click(round,{action:'retry'});safe(round.innerHTML);
  for(const item of subject.questions){click(round,{choice:item.answer});click(round,{action:'next'});}
  safe(round.innerHTML);assert.equal((round.innerHTML.match(/<textarea\b/g)||[]).length,1);
  assert.equal((round.innerHTML.match(/<\/textarea>/g)||[]).length,1);
  assert.match(round.innerHTML,/round-review/);
 }finally{
  Object.assign(subject,snapshot);source.checked=old.checked;
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.confirm===undefined)delete globalThis.confirm;else globalThis.confirm=old.confirm;
 }
});
