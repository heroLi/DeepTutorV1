import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../dist/curriculum-model.js';

test('retry keeps the current hint alongside choices without leaking it to a fresh question',async()=>{
 const old={document:globalThis.document,confirm:globalThis.confirm};
 const make=()=>({innerHTML:'',events:{},addEventListener(t,f){this.events[t]=f;},focus(){}});
 const list=make(),round=make();
 globalThis.document={querySelector:s=>s==='#catalog'?list:round};globalThis.confirm=()=>true;
 const click=(el,dataset)=>el.events.click({target:{closest:()=>({dataset})}});
 try{
  await import('../dist/curriculum-ui.js?retained-hint');
  for(const subject of catalog){
   click(list,{subject:subject.id});
   const [a,b]=subject.questions;
   assert.doesNotMatch(round.innerHTML,/retained-hint/);
   assert.ok(!round.innerHTML.includes(a.hint));
   click(round,{action:'hint'});click(round,{action:'retry'});
   assert.match(round.innerHTML,/aria-label="本题已看过的提示"/);
   assert.ok(round.innerHTML.includes(a.hint));assert.match(round.innerHTML,/data-choice=/);
   assert.match(round.innerHTML,/仍会记为提示后选择/);
   click(round,{choice:a.choices.find(c=>c!==a.answer)});click(round,{action:'retry'});
   assert.equal((round.innerHTML.match(/class="retained-hint"/g)||[]).length,1);
   assert.ok(round.innerHTML.includes(a.hint));
   click(round,{choice:a.answer});click(round,{action:'next'});
   assert.doesNotMatch(round.innerHTML,/retained-hint/);assert.ok(!round.innerHTML.includes(a.hint));
   click(round,{choice:b.choices.find(c=>c!==b.answer)});click(round,{action:'retry'});
   assert.ok(round.innerHTML.includes(b.hint));assert.ok(!round.innerHTML.includes(a.hint));
   click(round,{action:'clear'});assert.doesNotMatch(round.innerHTML,/retained-hint/);
  }
 }finally{
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.confirm===undefined)delete globalThis.confirm;else globalThis.confirm=old.confirm;
 }
});
