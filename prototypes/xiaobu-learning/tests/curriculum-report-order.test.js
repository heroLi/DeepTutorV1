import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,createRound,choose,next,roundReport} from '../dist/curriculum-model.js';
for(const subject of catalog){
 test(`${subject.id}: exported report preserves displayed option order across identical answers`,()=>{
  const a=createRound(subject.id,()=>0),b=createRound(subject.id,()=>0.99);
  for(const state of [a,b])for(const q of subject.questions){choose(state,q.answer);next(state);}
  assert.deepEqual(a.answers,b.answers);
  const before=JSON.stringify(a),report=roundReport(a),other=roundReport(b);
  assert.notEqual(report,other);
  const lines=report.split('\n').filter(line=>line.includes('本轮选项顺序：'));
  assert.equal(lines.length,subject.questions.length);
  for(const [index,order] of a.choiceOrders.entries()){
   assert.equal(lines[index],`  本轮选项顺序：${order.map((choice,i)=>`${i+1}. ${choice}`).join(' / ')}`);
   assert.ok(other.includes(`  本轮选项顺序：${b.choiceOrders[index].map((choice,i)=>`${i+1}. ${choice}`).join(' / ')}`));
  }
  assert.equal(JSON.stringify(a),before);assert.equal(roundReport(a),report);
  assert.match(report,/报告格式：4/);assert.match(report,/首次无提示答对：3 题/);
 });
}
