import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../dist/curriculum-model.js';
test('English samples/options carry language metadata while Chinese guidance stays outside it',async()=>{
 const old={document:globalThis.document,confirm:globalThis.confirm};
 const make=()=>({innerHTML:'',events:{},addEventListener(t,f){this.events[t]=f;},focus(){}});
 const list=make(),round=make();globalThis.document={querySelector:s=>s==='#catalog'?list:round};globalThis.confirm=()=>true;
 const click=(el,dataset)=>el.events.click({target:{closest:()=>({dataset})}});
 try{
  await import('../dist/curriculum-ui.js?language');
  click(list,{subject:'english'});
  assert.match(round.innerHTML,/原创句子：<span lang="en">This is my bag/);
  assert.equal((round.innerHTML.match(/<button lang="en" data-choice=/g)||[]).length,3);
  assert.doesNotMatch(round.innerHTML,/<span lang="en">原创句子/);
  const subject=catalog.find(s=>s.id==='english');
  click(round,{action:'hint'});click(round,{action:'retry'});
  assert.equal((round.innerHTML.match(/<button lang="en" data-choice=/g)||[]).length,3);
  for(const q of subject.questions){click(round,{choice:q.answer});click(round,{action:'next'});}
  assert.match(round.innerHTML,/<article><h4>第 1 题.*?原创句子：<span lang="en">/s);
  for(const id of ['chinese','math']){
   click(list,{subject:id});assert.doesNotMatch(round.innerHTML,/lang="en"/);
  }
 }finally{
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.confirm===undefined)delete globalThis.confirm;else globalThis.confirm=old.confirm;
 }
});
