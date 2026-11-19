import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../dist/curriculum-model.js';

// Small DOM adapter: checks rendered text and event wiring, not browser layout.
test('curriculum UI shows all three items, preserves cancel, retry and restart', async()=>{
 const element=()=>({innerHTML:'',listeners:{},focused:false,addEventListener(type,handler){this.listeners[type]=handler;},focus(){this.focused=true;}});
 const catalogEl=element(),roundEl=element();
 const oldDocument=globalThis.document,oldConfirm=globalThis.confirm;
 let confirmations=0,allowSwitch=false;
 globalThis.document={querySelector:selector=>selector==='#catalog'?catalogEl:roundEl};
 globalThis.confirm=()=>{confirmations++;return allowSwitch;};
 const click=(el,dataset)=>el.listeners.click({target:{closest:()=>({dataset})}});
 try{
  await import('../dist/curriculum-ui.js');
  assert.equal((catalogEl.innerHTML.match(/3 道原创题自测/g)||[]).length,3);
  for(const s of catalog){
   allowSwitch=true;click(catalogEl,{subject:s.id});allowSwitch=false;assert.equal(roundEl.focused,true);
   assert.match(roundEl.innerHTML,/第 1 \/ 3 题/);
   const beforeCancel=roundEl.innerHTML;
   click(catalogEl,{subject:catalog.find(other=>other.id!==s.id).id});
   assert.equal(roundEl.innerHTML,beforeCancel);
   for(let i=0;i<s.questions.length;i++){
    const q=s.questions[i];assert.match(roundEl.innerHTML,new RegExp(`第 ${i+1} / 3 题`));
    if(i===2){
     click(roundEl,{choice:q.choices.find(c=>c!==q.answer)});assert.match(roundEl.innerHTML,/本次未正确/);
     click(roundEl,{action:'retry'});assert.match(roundEl.innerHTML,/已经看过提示/);
    }
    click(roundEl,{choice:q.answer});
    assert.match(roundEl.innerHTML,i<2?/继续下一道原创题/:/查看本轮证据/);
    click(roundEl,{action:'next'});
   }
   assert.match(roundEl.innerHTML,/回看本轮借助提示完成的题（1 道）/);assert.match(roundEl.innerHTML,/第 3 题 · 本轮曾选错/);assert.match(roundEl.innerHTML,/本轮证据/);assert.match(roundEl.innerHTML,/第 3 题/);
   assert.equal((roundEl.innerHTML.match(/<li>/g)||[]).length,4);
   assert.match(roundEl.innerHTML,/提示后选择/);
   allowSwitch=true;click(roundEl,{action:'restart'});allowSwitch=false;assert.match(roundEl.innerHTML,/第 1 \/ 3 题/);
   assert.doesNotMatch(roundEl.innerHTML,/<li>/);
   // Explicitly accepting a switch starts a clean independent round.
   allowSwitch=true;click(catalogEl,{subject:s.id});allowSwitch=false;
   for(const q of s.questions){click(roundEl,{choice:q.answer});click(roundEl,{action:'next'});}
  }
  assert.equal(confirmations,11);
 }finally{
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  if(oldConfirm===undefined)delete globalThis.confirm;else globalThis.confirm=oldConfirm;
 }
});
