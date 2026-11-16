import test from 'node:test';
import assert from 'node:assert/strict';
import {startLoop,loopAction,loopBank,validLoopState} from '../dist/loop-model.js';
import {nextSupport,nextSupportMarkup} from '../dist/support-next-step.js';
const at=new Date('2026-11-16T09:00:00Z');
function complete(subject,{wrongFirst=false,wrongLast=false,review=false}={}){
 const p={};let r=startLoop(p,subject,{at});
 const act=(a,v)=>assert.ok(loopAction(p,r.id,r.revision,a,v,at));
 const answer=(q,wrong)=>{act('select',wrong?q.choices.find(c=>c!==q.answer):q.answer);act('submit');};
 const practice=()=>{const items=loopBank[subject].items;answer(items[0],wrongFirst);if(wrongFirst){for(const s of items[0].steps){act('guide',s.answer);act('next');}answer(items[0],false);}answer(items[1],wrongLast);};practice();
 if(review){r=startLoop(p,subject,{kind:'review',at});const q=loopBank[subject].items[2];answer(q,wrongFirst);if(wrongFirst){for(const s of q.steps){act('guide',s.answer);act('next');}answer(q,wrongLast);}}
 return {p,r};
}
test('all subjects integrate actual completed practice evidence without mutating records or schedules',()=>{
 for(const subject of Object.keys(loopBank))for(const wrongFirst of [true,false])for(const wrongLast of [true,false]){const {p,r}=complete(subject,{wrongFirst,wrongLast}),before=JSON.stringify(p),s=nextSupport(r);assert.equal(s.kind,wrongLast?'scaffold':'transfer-check');assert.equal(s.subject,subject);assert.equal(s.steps.length,2);assert.ok(Object.isFrozen(s));assert.equal(JSON.stringify(p),before);assert.ok(validLoopState(p.learningLoop));assert.match(nextSupportMarkup(r),/本次证据 → 下一步/);if(wrongLast)assert.match(nextSupportMarkup(r),/复看两步示范/);else assert.doesNotMatch(nextSupportMarkup(r),/<details>/);}
});
test('actual review distinguishes assisted retry from first choice and never asserts delayed mastery',()=>{
 for(const subject of Object.keys(loopBank)){const assisted=complete(subject,{review:true,wrongFirst:true});assert.equal(nextSupport(assisted.r).kind,'assisted');assert.match(nextSupport(assisted.r).evidence,/有帮助/);const first=complete(subject,{review:true});assert.equal(nextSupport(first.r).kind,'review-check');assert.match(nextSupport(first.r).evidence,/提前复习也不等于延迟保留/);const wrong=complete(subject,{review:true,wrongFirst:true,wrongLast:true});assert.equal(nextSupport(wrong.r).kind,'scaffold');}
});
test('unfinished and unknown inputs do not invent evidence',()=>{
 for(const r of [null,{}, {subject:'constructor'},{subject:'math',kind:'practice',phase:'complete',completedAt:'now',answers:[]}])assert.equal(nextSupport(r),null);
 const p={},r=startLoop(p,'math',{at});assert.equal(nextSupport(r),null);assert.equal(nextSupportMarkup(r),'');
});
test('markup escapes identifiers indirectly by never emitting them and supports read-only history cards',()=>{
 const {r}=complete('math',{wrongLast:true});r.id='<img src=x onerror=alert(1)>';const html=nextSupportMarkup(r,{actions:false});assert.doesNotMatch(html,/<img|data-loop-restart|href=/);assert.match(html,/不会改动作答/);
});
