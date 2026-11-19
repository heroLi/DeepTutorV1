import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,createRound,choose,retry,next,requestHint,roundSummary,roundReport} from '../dist/curriculum-model.js';
for(const subject of catalog){
 test(`${subject.id}: summary counts choices without counting hint requests as mistakes`,()=>{
  const state=createRound(subject.id),[a,b,c]=subject.questions;
  assert.equal(roundSummary(state),null);
  choose(state,a.answer);next(state);
  requestHint(state);retry(state);choose(state,b.answer);next(state);
  choose(state,c.choices.find(x=>x!==c.answer));retry(state);choose(state,c.answer);next(state);
  const before=JSON.stringify(state),summary=roundSummary(state);
  assert.deepEqual(summary,{total:3,attempts:4,firstCorrect:1,assistedCorrect:2});
  assert.match(roundReport(state),/首次无提示答对：1 题；提示后答对：2 题/);
  summary.firstCorrect=99;assert.equal(roundSummary(state).firstCorrect,1);assert.equal(JSON.stringify(state),before);
 });
}
test('completion view shows the observed counts and non-score limitation',async()=>{
 const old={document:globalThis.document,confirm:globalThis.confirm};
 const make=()=>({innerHTML:'',events:{},addEventListener(t,f){this.events[t]=f;},focus(){}});
 const list=make(),round=make();globalThis.document={querySelector:s=>s==='#catalog'?list:round};globalThis.confirm=()=>true;
 const click=(el,dataset)=>el.events.click({target:{closest:()=>({dataset})}});
 try{
  await import('../dist/curriculum-ui.js?summary');click(list,{subject:'math'});
  assert.doesNotMatch(round.innerHTML,/class="round-summary"/);
  for(const q of catalog.find(s=>s.id==='math').questions){click(round,{action:'hint'});click(round,{action:'retry'});click(round,{choice:q.answer});click(round,{action:'next'});}
  assert.match(round.innerHTML,/共 3 道原创题，记录 3 次选择/);
  assert.match(round.innerHTML,/首次无提示答对：0 题；提示后答对：3 题/);
  assert.match(round.innerHTML,/这里只汇总本轮操作，不是能力评分/);
  click(round,{action:'restart'});assert.doesNotMatch(round.innerHTML,/class="round-summary"/);
 }finally{
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.confirm===undefined)delete globalThis.confirm;else globalThis.confirm=old.confirm;
 }
});
