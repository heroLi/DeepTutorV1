import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createStore,startTest,chooseTest,submitTest,units} from '../dist/model.js';
import {summarizeParent} from '../dist/parent-summary.js';
const at=new Date(2026,10,13,12),stamp=(y,m,d)=>new Date(y,m-1,d,12).toISOString(),today=stamp(2026,11,13);
const p=()=>createStore().profiles.A;
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
const stage=(s,key)=>s.stages.find(x=>x.key===key);
test('empty summary is frozen, has six separated stages and no inferred outcomes',()=>{
 const s=summarizeParent(p(),{at});assert.equal(s.fromDay,'2026-11-07');assert.equal(s.toDay,'2026-11-13');assert.deepEqual(s.completion,{practice:0,assessment:0,loopPractice:0,loopReview:0});assert.equal(s.stages.length,6);assert.ok(Object.isFrozen(s));assert.ok(Object.isFrozen(s.stages[0]));assert.ok(Object.isFrozen(s.wrongs));assert.equal(s.futureEvents,0);assert.equal(s.invalidEvents,0);
});
test('completion sources and assessment score ignore activeTest double copy',()=>{
 const store=createStore();const t=startTest(store,'math');units.math.items.forEach((q,i)=>chooseTest(store,i,i===0?'3':q.answer));submitTest(store);store.profiles.A.assessments[0].completedAt=t.completedAt=today;store.profiles.A.practiceCompleted=[{date:today},{date:stamp(2026,11,6)}];
 const s=summarizeParent(store.profiles.A,{at});assert.equal(s.completion.practice,1);assert.equal(s.completion.assessment,1);assert.deepEqual(s.assessment,{correct:3,total:4});assert.equal(s.stages.every(x=>x.attempts===0),true);
});
test('window counts dated loop stages, completion independently and never turns guided retry into first',()=>{
 const profile=p();profile.learningLoop={runs:[{kind:'practice',completedAt:today,answers:[{role:'first',at:today,correct:false},{role:'retry',at:today,correct:true},{role:'transfer',at:today,correct:false}],guides:[{at:today,correct:false},{at:today,correct:true}]},{kind:'review',completedAt:null,answers:[{role:'first',at:today,correct:false},{role:'retry',at:today,correct:true}],guides:[{at:today,correct:true}]}]};
 const s=summarizeParent(profile,{at});assert.equal(s.completion.loopPractice,1);assert.equal(s.completion.loopReview,0);for(const key of ['practiceFirst','practiceRetry','transfer','reviewFirst','reviewRetry'])assert.equal(stage(s,key).attempts,1);assert.equal(stage(s,'practiceRetry').correct,1);assert.equal(stage(s,'reviewRetry').correct,1);assert.equal(stage(s,'practiceFirst').correct,0);assert.equal(stage(s,'guide').attempts,3);assert.equal(stage(s,'guide').correct,2);assert.equal(s.wrongs.loop,3);
});
test('corrected records use dated successful retries once, not correctedAt or rewritten original error date',()=>{
 const profile=p();profile.wrongs=[{date:stamp(2026,10,1),correctedAt:today,retries:[{date:today,correct:true},{date:today,correct:true}]},{date:today,correctedAt:today,retries:[]},{date:today,correctedAt:today,retries:[{date:stamp(2026,11,6),correct:true},{date:today,correct:false}]}];
 const s=summarizeParent(profile,{at});assert.deepEqual(s.wrongs,{base:2,loop:0,correctedRecords:1});assert.equal(summarizeParent(profile,{at,range:'all'}).wrongs.correctedRecords,2);
});
test('future and invalid source events counted once, including errors contributing both stage and wrong totals',()=>{
 const future=stamp(2026,11,14),profile=p();profile.practiceCompleted=[{date:future},{date:''}];profile.assessments=[{completedAt:future}];profile.wrongs=[{date:future,retries:[{date:future,correct:true},{date:null,correct:true}]}];profile.learningLoop={runs:[{kind:'practice',completedAt:future,answers:[{role:'first',at:future,correct:false},{role:'retry',at:undefined,correct:false}],guides:[{at:'invalid',correct:true}]}]};
 const s=summarizeParent(profile,{at,range:'all'});assert.equal(s.futureEvents,6);assert.equal(s.invalidEvents,4);assert.equal(s.wrongs.loop,0);assert.equal(s.completion.loopPractice,0);
});
test('local calendar boundaries across year, month and leap day are inclusive',()=>{
 for(const [date,range,from] of [[new Date(2027,0,3,12),'7','2026-12-28'],[new Date(2024,2,1,12),'7','2024-02-24'],[new Date(2024,2,1,12),'30','2024-02-01']]){const profile=p();const lower=new Date(`${from}T12:00:00`),before=new Date(lower);before.setDate(before.getDate()-1);profile.practiceCompleted=[{date:lower.toISOString()},{date:before.toISOString()},{date:date.toISOString()}];const s=summarizeParent(profile,{at:date,range});assert.equal(s.fromDay,from);assert.equal(s.completion.practice,2);}
});
test('DST uses local calendar days for spring and fall, not elapsed 24 hour blocks',()=>{
 const script=`import {summarizeParent} from './dist/parent-summary.js'; console.log(JSON.stringify([new Date(2026,2,9,0,30),new Date(2026,10,2,23,30)].map(at=>summarizeParent({}, {at}).fromDay)));`;
 const result=execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),env:{...process.env,TZ:'America/Los_Angeles'},encoding:'utf8'});assert.deepEqual(JSON.parse(result),['2026-03-03','2026-10-27']);
});
test('same-day later timestamps count; tomorrow does not; all has null lower bound',()=>{
 const profile=p();profile.practiceCompleted=[{date:new Date(2026,10,13,23,59).toISOString()},{date:stamp(2026,11,14)},{date:stamp(2020,1,1)}];const s=summarizeParent(profile,{at,range:'all'});assert.equal(s.fromDay,null);assert.equal(s.completion.practice,2);assert.equal(s.futureEvents,1);
});
test('profile isolation, frozen source and stable detached output',()=>{
 const store=createStore();store.profiles.A.practiceCompleted=[{date:today}];store.profiles.B.practiceCompleted=[{date:today},{date:today}];const original=structuredClone(store);freeze(store);const a=summarizeParent(store.profiles.A,{at}),b=summarizeParent(store.profiles.A,{at});assert.deepEqual(a,b);assert.notEqual(a,b);assert.equal(a.completion.practice,1);assert.equal(summarizeParent(store.profiles.B,{at}).completion.practice,2);assert.deepEqual(store,original);
});
test('invalid and inherited range options default to seven, invalid at fails explicitly',()=>{
 for(const range of ['__proto__','constructor',7,'365',null])assert.equal(summarizeParent(p(),{at,range}).range,'7');assert.equal(summarizeParent(p(),Object.assign(Object.create({range:'all'}),{at})).range,'7');assert.throws(()=>summarizeParent(p(),{at:'invalid'}),RangeError);assert.equal(summarizeParent(p(),null).range,'7');
});
test('undated base answers, active assessment and correctedAt never fabricate stage or completion facts',()=>{
 const profile=p();profile.practices.math={records:[{attempts:5,solved:true,firstCorrect:true}]};profile.activeTest={completedAt:today,subject:'math',answers:['5','5','8','4']};profile.wrongs=[{date:today,correctedAt:today,retries:[]}];const s=summarizeParent(profile,{at});assert.equal(s.completion.practice,0);assert.equal(s.completion.assessment,0);assert.equal(s.stages.reduce((n,x)=>n+x.attempts,0),0);assert.equal(s.wrongs.correctedRecords,0);
});
