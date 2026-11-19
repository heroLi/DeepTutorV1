import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../dist/curriculum-model.js';

test('completed report survives cancelled restart or subject switch, including repeated clicks',async()=>{
 const old={document:globalThis.document,confirm:globalThis.confirm};
 const make=()=>({innerHTML:'',events:{},focuses:0,addEventListener(t,f){this.events[t]=f;},focus(){this.focuses++;}});
 const list=make(),round=make();let allow=false,prompt='';
 globalThis.document={querySelector:s=>s==='#catalog'?list:round};
 globalThis.confirm=s=>{prompt=s;return allow;};
 const click=(el,dataset)=>el.events.click({target:{closest:()=>({dataset})}});
 const finish=id=>{for(const q of catalog.find(s=>s.id===id).questions){click(round,{choice:q.answer});click(round,{action:'next'});}};
 try{
  await import('../dist/curriculum-ui.js?preservation');
  click(list,{subject:'math'});finish('math');
  const before=round.innerHTML,focus=round.focuses;
  for(let i=0;i<2;i++){
   click(round,{action:'restart'});assert.equal(round.innerHTML,before);
   assert.match(prompt,/先下载或复制并检查保存结果/);
   click(list,{subject:'english'});assert.equal(round.innerHTML,before);
   assert.match(prompt,/已保存的副本不受影响/);
  }
  assert.equal(round.focuses,focus);
  allow=true;click(list,{subject:'english'});
  assert.match(round.innerHTML,/英语 · 原创合成自测/);assert.doesNotMatch(round.innerHTML,/report-text/);
  finish('english');allow=false;
  const englishReport=round.innerHTML;click(round,{action:'restart'});assert.equal(round.innerHTML,englishReport);
  allow=true;click(round,{action:'restart'});
  assert.match(round.innerHTML,/第 1 \/ 3 题/);assert.doesNotMatch(round.innerHTML,/report-text/);
 }finally{
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.confirm===undefined)delete globalThis.confirm;else globalThis.confirm=old.confirm;
 }
});
