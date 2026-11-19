import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,createRound,choose,retry,next,requestHint,reviewItems,roundReport} from '../dist/curriculum-model.js';
for(const subject of catalog){
 test(`${subject.id}: review separates wrong attempts from requested help without duplicate questions`,()=>{
  const state=createRound(subject.id),[a,b,c]=subject.questions;
  assert.deepEqual(reviewItems(state),[]);
  choose(state,a.choices.find(x=>x!==a.answer));retry(state);
  choose(state,a.choices.find(x=>x!==a.answer));retry(state);choose(state,a.answer);next(state);
  requestHint(state);retry(state);choose(state,b.answer);next(state);
  choose(state,c.answer);next(state);
  const before=JSON.stringify(state),items=reviewItems(state);
  assert.deepEqual(items.map(x=>x.index),[0,1]);
  assert.match(items[0].support,/曾选错/);assert.match(items[1].support,/未记录错误选择/);
  assert.equal(items[0].hint,a.hint);assert.equal(items[1].reason,b.reason);
  const report=roundReport(state);assert.match(report,/回看第 1 题/);assert.match(report,/回看第 2 题/);assert.doesNotMatch(report,/回看第 3 题/);
  items[0].reason='mutated';assert.equal(reviewItems(state)[0].reason,a.reason);
  assert.equal(JSON.stringify(state),before);
 });
 test(`${subject.id}: unassisted review is empty and never claims mastery`,()=>{
  const state=createRound(subject.id);for(const q of subject.questions){choose(state,q.answer);next(state);}
  assert.deepEqual(reviewItems(state),[]);
  assert.match(roundReport(state),/没有记录到需要提示的题；不代表已经掌握/);
 });
}
