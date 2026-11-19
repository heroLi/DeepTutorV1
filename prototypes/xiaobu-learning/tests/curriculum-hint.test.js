import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,createRound,choose,requestHint,retry,next,evidence,roundReport} from '../dist/curriculum-model.js';
for(const subject of catalog){test(`${subject.id}: help before answering is not an error or independent success`,()=>{
 const state=createRound(subject.id);
 assert.equal(requestHint(state),true);assert.equal(state.hintKind,'requested');assert.equal(state.phase,'hint');
 assert.deepEqual(evidence(state),[]);assert.equal(requestHint(state),false);assert.equal(choose(state,subject.questions[0].answer),false);
 assert.equal(next(state),false);retry(state);
 assert.equal(requestHint(state),true);retry(state); // Repeat help remains assisted, no invented error.
 choose(state,subject.questions[0].answer);assert.equal(requestHint(state),false);
 assert.deepEqual(evidence(state).map(row=>[row.correct,row.assisted]),[[true,true]]);next(state);
 assert.equal(state.assisted,false);assert.equal(state.hintKind,null);
 for(const q of subject.questions.slice(1)){choose(state,q.answer);next(state);}
 assert.match(roundReport(state),/首次无提示答对：2 题；提示后答对：1 题/);
 assert.equal(evidence(state).length,3);assert.equal(requestHint(state),false);
});}
test('requested hint followed by wrong answer preserves real error and correct assistance',()=>{
 const state=createRound('math'),q=catalog.find(s=>s.id==='math').questions[0];
 requestHint(state);retry(state);choose(state,q.choices.find(c=>c!==q.answer));
 assert.equal(state.hintKind,'incorrect');retry(state);choose(state,q.answer);
 assert.deepEqual(evidence(state).map(row=>[row.correct,row.assisted]),[[false,true],[true,true]]);
});
test('on-demand hint UI uses neutral feedback and retains assisted evidence',async()=>{
 const old={document:globalThis.document,confirm:globalThis.confirm};
 const element=()=>({innerHTML:'',events:{},addEventListener(t,f){this.events[t]=f;},focus(){}});
 const catalogEl=element(),roundEl=element();globalThis.document={querySelector:s=>s==='#catalog'?catalogEl:roundEl};globalThis.confirm=()=>true;
 const click=(el,dataset)=>el.events.click({target:{closest:()=>({dataset})}});
 try{
  await import('../dist/curriculum-ui.js');click(catalogEl,{subject:'math'});
  assert.match(roundEl.innerHTML,/先看提示/);click(roundEl,{action:'hint'});
  assert.match(roundEl.innerHTML,/已主动查看提示，不记为答错/);assert.doesNotMatch(roundEl.innerHTML,/本次未正确/);
  assert.match(roundEl.innerHTML,/带着提示作答/);click(roundEl,{action:'retry'});
  assert.match(roundEl.innerHTML,/已经看过提示/);click(roundEl,{choice:'72'});click(roundEl,{action:'next'});
  assert.match(roundEl.innerHTML,/本轮尚未显示提示/);click(roundEl,{choice:'128'});click(roundEl,{action:'next'});
  click(roundEl,{choice:'138'});click(roundEl,{action:'next'});
  assert.match(roundEl.innerHTML,/正确 · 提示后选择/);assert.doesNotMatch(roundEl.innerHTML,/未正确/);
 }finally{
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.confirm===undefined)delete globalThis.confirm;else globalThis.confirm=old.confirm;
 }
});
