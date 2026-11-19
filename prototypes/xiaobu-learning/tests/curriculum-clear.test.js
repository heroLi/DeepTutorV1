import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../dist/curriculum-model.js';

// Lightweight adapter; does not claim real-browser focus or layout coverage.
test('clear supports cancellation, removes round/report and rejects stale actions',async()=>{
 const element=()=>({innerHTML:'',listeners:{},focuses:0,addEventListener(k,v){this.listeners[k]=v;},focus(){this.focuses++;}});
 const catalogEl=element(),roundEl=element();
 const oldDocument=globalThis.document,oldConfirm=globalThis.confirm;
 let allow=false,prompt='';
 globalThis.document={querySelector:s=>s==='#catalog'?catalogEl:roundEl};
 globalThis.confirm=message=>{prompt=message;return allow;};
 const click=(el,dataset)=>el.listeners.click({target:{closest:()=>({dataset})}});
 try{
  await import('../dist/curriculum-ui.js?clear-test');
  const subject=catalog.find(s=>s.id==='math');
  for(const phase of ['answer','hint','feedback','complete']){
   click(catalogEl,{subject:subject.id});
   if(phase==='hint')click(roundEl,{action:'hint'});
   if(phase==='feedback')click(roundEl,{choice:subject.questions[0].answer});
   if(phase==='complete')for(const q of subject.questions){click(roundEl,{choice:q.answer});click(roundEl,{action:'next'});}
   assert.match(roundEl.innerHTML,/清空本轮合成记录/);
   const before=roundEl.innerHTML,focusBefore=roundEl.focuses;
   allow=false;click(roundEl,{action:'clear'});
   assert.equal(roundEl.innerHTML,before);assert.equal(roundEl.focuses,focusBefore);
   assert.match(prompt,/已下载或复制的内容不会被删除/);
   allow=true;click(roundEl,{action:'clear'});allow=false;
   assert.match(roundEl.innerHTML,/本轮合成记录已清空/);
   assert.doesNotMatch(roundEl.innerHTML,/textarea|data-choice|data-action/);
   assert.equal(roundEl.focuses,focusBefore+1);
   const cleared=roundEl.innerHTML;
   for(const action of ['download','select-report','next','restart','clear'])click(roundEl,{action});
   click(roundEl,{choice:'72'});assert.equal(roundEl.innerHTML,cleared);
  }
  click(catalogEl,{subject:subject.id});
  assert.match(roundEl.innerHTML,/第 1 \/ 3 题/);
  assert.match(roundEl.innerHTML,/本轮尚未显示提示/);
 }finally{
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  if(oldConfirm===undefined)delete globalThis.confirm;else globalThis.confirm=oldConfirm;
 }
});
