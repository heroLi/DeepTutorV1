import test from 'node:test';
import assert from 'node:assert/strict';
import {shanghaiConnections as data,checkTopicAnswer} from '../dist/curriculum-connections.js';
test('original perimeter choices distinguish length from area and never mutate content',()=>{
 const before=JSON.stringify(data);
 for(const item of [...data.originalTopicPractice.items,...data.englishTopicPractice.items,...data.chineseObservationPractice.items,...data.chineseSummaryPractice.items]){
  for(const choice of item.choices){const result=checkTopicAnswer(item.id,choice);assert.equal(result.correct,choice===item.correctChoice);assert.ok(result.text.includes(result.correct?item.answer:(item.feedbackByChoice?.[choice]??item.hint)));}
  assert.equal(checkTopicAnswer(item.id,'invented'),null);
 }
 assert.equal(checkTopicAnswer('__proto__','22厘米'),null);
 assert.equal(JSON.stringify(data),before);
});
test('topic feedback supports wrong/correct/repeated choices and stays separate from the three-question round',async()=>{
 const old={document:globalThis.document,confirm:globalThis.confirm};
 const statuses=Object.fromEntries([...data.originalTopicPractice.items,...data.englishTopicPractice.items,...data.chineseObservationPractice.items,...data.chineseSummaryPractice.items].map(item=>['#feedback-'+item.id,{textContent:''}]));
 const make=()=>({innerHTML:'',events:{},addEventListener(t,f){this.events[t]=f;},focus(){},querySelector:s=>statuses[s]});
 const list=make(),round=make();globalThis.document={querySelector:s=>s==='#catalog'?list:round};globalThis.confirm=()=>true;
 const click=(el,dataset)=>el.events.click({target:{closest:()=>({dataset})}});
 try{
  await import('../dist/curriculum-ui.js?topic-feedback');click(list,{subject:'math'});
  const before=round.innerHTML;
  for(const item of [...data.originalTopicPractice.items,...data.englishTopicPractice.items,...data.chineseObservationPractice.items,...data.chineseSummaryPractice.items]){
   const status=statuses['#feedback-'+item.id];
   click(list,{topicId:item.id,topicChoice:item.choices.find(c=>c!==item.correctChoice)});assert.match(status.textContent,/不正确/);
   click(list,{topicId:item.id,topicChoice:item.correctChoice});assert.match(status.textContent,/这次选择正确/);
   assert.match(status.textContent,/不计入三题报告/);
   const saved=status.textContent;click(list,{topicId:item.id,topicChoice:'invalid'});assert.equal(status.textContent,saved);
   click(list,{topicId:item.id,topicChoice:item.correctChoice});assert.equal(status.textContent,saved);
  }
  assert.equal(round.innerHTML,before);
 }finally{
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.confirm===undefined)delete globalThis.confirm;else globalThis.confirm=old.confirm;
 }
});


test('perimeter distractors receive specific feedback without guessing learner ability',()=>{
 for(const item of data.originalTopicPractice.items){
  const wrong=item.choices.filter(c=>c!==item.correctChoice);
  assert.deepEqual(Object.keys(item.feedbackByChoice).sort(),[...wrong].sort());
  assert.equal(new Set(wrong.map(c=>checkTopicAnswer(item.id,c).text)).size,wrong.length);
  for(const c of wrong){assert.match(checkTopicAnswer(item.id,c).text,/重新选择/);assert.doesNotMatch(checkTopicAnswer(item.id,c).text,/能力不足|你不懂/);}
 }
 assert.match(checkTopicAnswer('perimeter-original-1','28平方厘米').text,/面积/);
 assert.match(checkTopicAnswer('perimeter-original-3','8厘米').text,/两条宽的总长/);
});


test('Chinese reading feedback distinguishes unsupported inference, quantity and main event',()=>{
 for(const item of [...data.chineseObservationPractice.items,...data.chineseSummaryPractice.items]){
  const wrong=item.choices.filter(c=>c!==item.correctChoice);
  assert.deepEqual(Object.keys(item.feedbackByChoice).sort(),[...wrong].sort());
  assert.equal(new Set(wrong.map(c=>checkTopicAnswer(item.id,c).text)).size,2);
  for(const c of wrong)assert.ok(checkTopicAnswer(item.id,c).text.includes(item.feedbackByChoice[c]));
 }
 assert.match(checkTopicAnswer('observe-original-1','今天一定会下雨').text,/不能直接证明/);
 assert.match(checkTopicAnswer('observe-original-1','叶片上的水珠全部消失了').text,/数量差别/);
 assert.match(checkTopicAnswer('summary-original-1','书脊上都有标签').text,/细节/);
});


test('English helping distractors explain action, negation and participant mismatches',()=>{
 for(const item of data.englishTopicPractice.items){
  const wrong=item.choices.filter(c=>c!==item.correctChoice);
  assert.deepEqual(Object.keys(item.feedbackByChoice).sort(),[...wrong].sort());
  assert.equal(new Set(wrong.map(c=>checkTopicAnswer(item.id,c).text)).size,2);
  for(const c of wrong)assert.ok(checkTopicAnswer(item.id,c).text.includes(item.feedbackByChoice[c]));
 }
 assert.match(checkTopicAnswer('help-original-3','Carry the box.').text,/cannot/);
 assert.match(checkTopicAnswer('help-original-3','Wash the box.').text,/物品相同不等于动作相同/);
 assert.match(checkTopicAnswer('help-original-4','Ann helps Ben.').text,/调换/);
});
test('all interactive theme items have unique ids and complete, wrong-only feedback maps',()=>{
 const items=[...data.originalTopicPractice.items,...data.englishTopicPractice.items,...data.chineseObservationPractice.items,...data.chineseSummaryPractice.items];
 assert.equal(items.length,12);assert.equal(new Set(items.map(x=>x.id)).size,items.length);
 for(const item of items){
  assert.equal(item.choices.length,3);assert.equal(new Set(item.choices).size,3);
  assert.ok(item.choices.includes(item.correctChoice));
  assert.deepEqual(Object.keys(item.feedbackByChoice).sort(),item.choices.filter(c=>c!==item.correctChoice).sort());
  assert.equal(Object.hasOwn(item.feedbackByChoice,item.correctChoice),false);
 }
});
