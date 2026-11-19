import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,createRound,choose,retry,requestHint,next,shuffledChoices,roundReport} from '../dist/curriculum-model.js';
test('three-choice shuffle reaches all six permutations without mutating source',()=>{
 const original=['a','b','c'],seen=new Set();
 for(const x of [0,0.34,0.67])for(const y of [0,0.5]){
  const values=[x,y];const result=shuffledChoices(original,()=>values.shift());
  assert.deepEqual([...result].sort(),original);seen.add(result.join(''));
 }
 assert.equal(seen.size,6);assert.deepEqual(original,['a','b','c']);
 for(const invalid of [-1,1,NaN,Infinity])assert.throws(()=>shuffledChoices(original,()=>invalid),/INVALID_RANDOM/);
});
for(const subject of catalog){
 test(`${subject.id}: option order is round-local, retry-stable and grading remains content-based`,()=>{
  const original=JSON.stringify(subject.questions),a=createRound(subject.id,()=>0),b=createRound(subject.id,()=>0.99);
  assert.notDeepEqual(a.choiceOrders,b.choiceOrders);
  const orders=JSON.stringify(a.choiceOrders);
  for(const [index,q] of subject.questions.entries()){
   assert.deepEqual([...a.choiceOrders[index]].sort(),[...q.choices].sort());
   requestHint(a);retry(a);choose(a,q.choices.find(c=>c!==q.answer));retry(a);
   assert.equal(JSON.stringify(a.choiceOrders),orders);
   choose(a,q.answer);next(a);
  }
  assert.match(roundReport(a),/首次无提示答对：0 题；提示后答对：3 题/);
  a.choiceOrders[0][0]='mutated';assert.equal(JSON.stringify(subject.questions),original);
  assert.deepEqual(b.choiceOrders[0],subject.questions[0].choices);
 });
}
test('UI renders shuffled order and preserves it after hint retry',async()=>{
 const old={document:globalThis.document,confirm:globalThis.confirm,random:Math.random};
 const make=()=>({innerHTML:'',events:{},addEventListener(t,f){this.events[t]=f;},focus(){}});
 const list=make(),round=make();globalThis.document={querySelector:s=>s==='#catalog'?list:round};globalThis.confirm=()=>true;Math.random=()=>0;
 const click=(el,dataset)=>el.events.click({target:{closest:()=>({dataset})}});
 const choices=()=>[...round.innerHTML.matchAll(/data-choice="([^"]+)"/g)].map(m=>m[1]);
 try{
  await import('../dist/curriculum-ui.js?choice-order');click(list,{subject:'math'});
  const q=catalog.find(s=>s.id==='math').questions[0],expected=shuffledChoices(q.choices,()=>0);
  assert.deepEqual(choices(),expected);assert.notDeepEqual(choices(),q.choices);
  assert.match(round.innerHTML,/不是新题或能力测评/);
  click(round,{action:'hint'});click(round,{action:'retry'});assert.deepEqual(choices(),expected);
 }finally{
  Math.random=old.random;
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.confirm===undefined)delete globalThis.confirm;else globalThis.confirm=old.confirm;
 }
});
