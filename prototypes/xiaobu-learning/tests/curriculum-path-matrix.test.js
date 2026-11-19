import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,createRound,choose,requestHint,retry,next,evidence,reviewItems,roundReport} from '../dist/curriculum-model.js';

// Bounded exhaustive matrix, not random fuzzing and not a browser test.
// 125 answer-path plans × 6 deterministic shuffle schedules × 3 subjects = 2250 rounds.
// Each question sees all 6 possible three-choice permutations across the schedules.
const shufflePairs=[[0,0],[0,0.5],[0.34,0],[0.34,0.5],[0.67,0],[0.67,0.5]];
const paths=['independent','hint','wrong','wrong-twice','hint-then-wrong'];
const combinations=n=>n===0?[[]]:combinations(n-1).flatMap(prefix=>paths.map(p=>[...prefix,p]));
function unchanged(state,operation){
 const before=JSON.stringify(state);assert.equal(operation(),false);assert.equal(JSON.stringify(state),before);
}
for(const subject of catalog){
 test(`${subject.id}: 750 deterministic answer/option-order paths preserve attempt, assistance, report and review invariants`,()=>{
  let checked=0;
  const ordersSeen=subject.questions.map(()=>new Set());
  for(let schedule=0;schedule<shufflePairs.length;schedule++)for(const plan of combinations(subject.questions.length)){
   const values=subject.questions.flatMap((_,index)=>shufflePairs[(schedule+index)%shufflePairs.length]);
   let calls=0;
   const state=createRound(subject.id,()=>{assert.ok(calls<values.length);return values[calls++];}),expected=[];
   assert.equal(calls,6);
   state.choiceOrders.forEach((order,index)=>ordersSeen[index].add(JSON.stringify(order)));
   const originalOrder=JSON.stringify(state.choiceOrders);
   for(const [index,path] of plan.entries()){
    const q=subject.questions[index],wrong=q.choices.find(c=>c!==q.answer);
    assert.equal(state.index,index);assert.equal(state.phase,'answer');assert.equal(state.assisted,false);
    assert.throws(()=>roundReport(state),/ROUND_NOT_COMPLETE/);
    unchanged(state,()=>choose(state,'not an option'));unchanged(state,()=>next(state));unchanged(state,()=>retry(state));
    let assisted=false;
    if(path==='hint'||path==='hint-then-wrong'){
     assert.equal(requestHint(state),true);assisted=true;
     unchanged(state,()=>requestHint(state));unchanged(state,()=>choose(state,q.answer));unchanged(state,()=>next(state));
     assert.equal(retry(state),true);
    }
    const errors=path==='wrong-twice'?2:['wrong','hint-then-wrong'].includes(path)?1:0;
    for(let attempt=0;attempt<errors;attempt++){
     assert.equal(choose(state,wrong),true);expected.push({index,choice:wrong,correct:false,assisted});
     unchanged(state,()=>choose(state,q.answer));unchanged(state,()=>next(state));
     assert.equal(retry(state),true);assisted=true;
    }
    assert.equal(choose(state,q.answer),true);expected.push({index,choice:q.answer,correct:true,assisted});
    unchanged(state,()=>choose(state,q.answer));unchanged(state,()=>retry(state));unchanged(state,()=>requestHint(state));
    assert.equal(next(state),true);
   }
   assert.equal(state.phase,'complete');assert.deepEqual(evidence(state),expected);
   assert.equal(JSON.stringify(state.choiceOrders),originalOrder);
   for(const operation of [()=>next(state),()=>retry(state),()=>requestHint(state),()=>choose(state,subject.questions.at(-1).answer)])unchanged(state,operation);
   const independent=plan.filter(p=>p==='independent').length,report=roundReport(state);
   assert.ok(report.includes(`首次无提示答对：${independent} 题；提示后答对：${plan.length-independent} 题`));
   const reviews=reviewItems(state);
   assert.deepEqual(reviews.map(r=>r.index),plan.flatMap((p,i)=>p==='independent'?[]:[i]));
   for(const item of reviews){
    assert.equal(item.text,subject.questions[item.index].text);
    assert.equal(item.support,plan[item.index]==='hint'?'主动查看提示后完成，未记录错误选择':'本轮曾选错，随后借助提示完成');
   }
   assert.equal((report.match(/次选择：/g)||[]).length,expected.length);
   const copy=evidence(state);copy[0].choice='changed';assert.deepEqual(evidence(state),expected);
   const fresh=createRound(subject.id,()=>0);assert.deepEqual(fresh.answers,[]);assert.deepEqual(evidence(state),expected);
   checked++;
  }
  assert.equal(checked,750);
  for(const permutations of ordersSeen)assert.equal(permutations.size,6);
 });
}
