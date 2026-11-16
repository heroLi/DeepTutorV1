import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SUPPORT_SCENARIOS as cases,SUPPORT_ACTIONS as actions,SUPPORT_SOURCE as source,createSupportSession as create} from '../adult-evaluation/support-model.js';
const time='2026-11-16T00:00:00.000Z',session=()=>create({now:()=>time});
const rev=s=>s.snapshot().revision,choose=(s,id)=>s.choose(id,rev(s)),save=s=>s.save(rev(s));
function deepFrozen(x){assert.ok(Object.isFrozen(x));for(const v of Object.values(x))if(v&&typeof v==='object')deepFrozen(v);}
test('six distinct synthetic evidence scenarios and six valid support actions are complete',()=>{
 assert.deepEqual(cases.map(s=>s.id),['new-concept','prompted-success','same-item-repeat','independent-now','delayed-transfer','transfer-gap']);
 assert.equal(new Set(actions.map(a=>a.id)).size,6);
 for(const c of cases){for(const k of ['id','title','summary','evidence','limit','rationale','nextCheck','fallback'])assert.ok(typeof c[k]==='string'&&c[k].length>0,k);assert.ok(actions.some(a=>a.id===c.recommendedActionId));assert.ok(c.timeline.length>0);for(const t of c.timeline)assert.deepEqual(Object.keys(t),['label','prompt','response','assistance']);}
 deepFrozen(cases);deepFrozen(actions);deepFrozen(source);
});
test('authored next checks use correct average division without hiding assistance',()=>{
 const expected=[['8',2,4],['15',3,5],['20',4,5],['18',3,6],['20',4,5],['18',6,3]];
 for(let i=0;i<expected.length;i++){const [total,groups,result]=expected[i];assert.equal(Number(total)/groups,result);assert.ok(cases[i].nextCheck.includes(total));assert.ok(cases[i].nextCheck.includes(`${groups} 个`));assert.ok(cases[i].nextCheck.includes(`${result} 块`)||cases[i].nextCheck.includes(`${result} 张`));}
 assert.notEqual(expected[2][2],4,'repeated-item check must change the memorized answer');assert.match(cases[2].nextCheck,/20 块.*4 个.*5 块/);assert.match(cases[5].summary,/回答与总量不符/);
 assert.match(cases[1].evidence,/提示后/);assert.match(cases[1].limit,/不能.*无提示/);assert.match(cases[2].limit,/答案记忆/);assert.match(cases[3].limit,/单次/);assert.match(cases[4].limit,/不能宣告永久掌握/);assert.match(cases[5].evidence,/4 × 4 不等于 12/);assert.match(cases[5].limit,/一次错误不能确定错因/);assert.match(cases[5].rationale,/先追问/);
});
test('references and next actions are explanatory product hypotheses, not mastery scoring',()=>{
 assert.equal(source.url,'https://ies.ed.gov/ncee/WWC/PracticeGuide/1');assert.match(source.limits,/产品审查假设/);assert.match(source.limits,/没有统一掌握分数或固定复习天数/);
 assert.equal(cases[0].recommendedActionId,'worked-example');assert.equal(cases[1].recommendedActionId,'independent-check');assert.equal(cases[3].recommendedActionId,'delayed-check');assert.equal(cases[5].recommendedActionId,'contrast-explanation');
 for(const c of cases)assert.match(c.fallback,/示范|帮助|提示|说明/);
});
test('sessions and returned snapshots are detached and deeply frozen',()=>{
 const a=session(),b=session(),old=a.snapshot();choose(a,'worked-example');assert.equal(old.actionId,null);assert.equal(b.snapshot().actionId,null);deepFrozen(a.snapshot());assert.throws(()=>{a.snapshot().records.push({});},TypeError);assert.ok(Object.isFrozen(a));
});
test('all actions remain human choices and no automatic learner score is saved',()=>{
 for(const c of cases)for(const action of actions){const s=session();assert.ok(s.select(c.id,rev(s)).ok);assert.ok(choose(s,action.id).ok);assert.ok(save(s).ok);const r=s.snapshot().records[0];assert.deepEqual(Object.keys(r),['scenarioId','actionId','at']);assert.equal(r.actionId,action.id);assert.equal(r.scenarioId,c.id);}
});
test('empty save is rejected and duplicate save does not count twice',()=>{
 const s=session();assert.equal(save(s).code,'INCOMPLETE_REVIEW');choose(s,'worked-example');save(s);assert.equal(save(s).code,'NO_CHANGES');assert.equal(s.snapshot().records.length,1);const before=s.snapshot();assert.ok(choose(s,'worked-example').ok);assert.deepEqual(s.snapshot(),before);
});
test('same scenario revision replaces only that record and preserves others',()=>{
 const s=session();choose(s,'worked-example');save(s);s.select('prompted-success',rev(s));choose(s,'independent-check');save(s);s.select('new-concept',rev(s));assert.equal(s.snapshot().actionId,null);choose(s,'single-hint');save(s);assert.deepEqual(s.snapshot().records.map(r=>r.actionId),['single-hint','independent-check']);
});
test('dirty switching is atomic and discard must be explicit boolean',()=>{
 const s=session();choose(s,'worked-example');const before=s.snapshot();assert.equal(s.select('prompted-success',rev(s)).code,'UNSAVED_REVIEW');assert.deepEqual(s.snapshot(),before);assert.equal(s.select('prompted-success',rev(s),{discard:'yes'}).code,'INVALID_SELECTION');assert.deepEqual(s.snapshot(),before);assert.ok(s.select('new-concept',rev(s)).ok);assert.deepEqual(s.snapshot(),before);assert.ok(s.select('prompted-success',rev(s),{discard:true}).ok);assert.equal(s.snapshot().actionId,null);assert.equal(s.snapshot().dirty,false);
});
test('stale callbacks cannot choose, save, discard or clear newer state',()=>{
 const s=session(),old=rev(s);choose(s,'worked-example');const before=s.snapshot();for(const result of [s.choose('single-hint',old),s.save(old),s.select('prompted-success',old,{discard:true}),s.clear(old)])assert.equal(result.code,'STALE_REVIEW');assert.deepEqual(s.snapshot(),before);
});
test('invalid IDs, revisions and selection objects fail without side effects',()=>{
 const s=session(),before=s.snapshot();for(const value of [null,{},[],1,'__proto__','constructor',Symbol('x')]){assert.equal(s.choose(value,rev(s)).code,'INVALID_ACTION');assert.equal(s.select(value,rev(s)).code,'INVALID_SELECTION');}
 for(const n of [-1,NaN,Infinity,1.5,'0',null])assert.equal(s.clear(n).code,'INVALID_REVISION');
 let called=false;const getter={get discard(){called=true;return true;}};
 for(const options of [null,[],Object.create({discard:true}),getter,{unknown:true},{[Symbol()]:true}])assert.equal(s.select('prompted-success',rev(s),options).code,'INVALID_SELECTION');assert.equal(called,false);assert.deepEqual(s.snapshot(),before);
});
test('invalid constructor clocks and getter options are rejected without invoking accessors',()=>{
 let called=false;for(const options of [null,[],{now:0},{extra:1},Object.create({now:()=>time}),{get now(){called=true;return ()=>time;}}])assert.throws(()=>create(options),/INVALID_CONFIG/);assert.equal(called,false);
});
test('bad clock leaves completed choice available for retry',()=>{
 for(const clock of [()=>'',()=>null,()=>new Date(),()=>Promise.resolve(time),()=>{throw Error('clock');}]){const s=create({now:clock});choose(s,'worked-example');const before=s.snapshot();assert.equal(save(s).code,'INVALID_TIME');assert.deepEqual(s.snapshot(),before);}
});
test('reentrant custom clock cannot overwrite a newer selection',()=>{
 let s;s=create({now:()=>{s.select('prompted-success',rev(s),{discard:true});return time;}});choose(s,'worked-example');assert.equal(save(s).code,'STALE_REVIEW');assert.equal(s.snapshot().scenarioId,'prompted-success');assert.equal(s.snapshot().records.length,0);
});
test('export contains saved evidence, selected and reference actions only, never draft',()=>{
 const s=session();assert.equal(s.exportReport().fixtures.length,0);choose(s,'single-hint');save(s);s.select('prompted-success',rev(s));choose(s,'delayed-check');const report=s.exportReport();assert.equal(report.schema,'adult-synthetic-support-review');assert.equal(report.version,1);assert.equal(report.catalogueVersion,'support-fixed-v1');assert.equal(report.scope,'adult-review-only');assert.equal(report.provider,'offline-authored-fixtures');assert.equal(report.records.length,1);assert.equal(report.fixtures.length,1);assert.equal(report.fixtures[0].id,'new-concept');assert.deepEqual(report.fixtures[0].actions.map(a=>a.id),['worked-example','single-hint']);assert.deepEqual(report.source,source);deepFrozen(report);save(s);assert.equal(report.records.length,1);assert.equal(s.exportReport().records.length,2);
});
test('clear removes only this session reviews and draft while keeping selection',()=>{
 const s=session();choose(s,'worked-example');save(s);s.select('prompted-success',rev(s));choose(s,'single-hint');const report=s.exportReport();assert.ok(s.clear(rev(s)).ok);assert.equal(s.snapshot().scenarioId,'prompted-success');assert.equal(s.snapshot().actionId,null);assert.equal(s.snapshot().dirty,false);assert.equal(s.snapshot().records.length,0);assert.equal(report.records.length,1);
});
test('module has no transport, persistence, media or automatic learner assessment dependency',()=>{
 const code=readFileSync(new URL('../adult-evaluation/support-model.js',import.meta.url),'utf8');assert.doesNotMatch(code,/fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|getUserMedia|SpeechRecognition|speechSynthesis|derivedDecision|masteryScore/);
});
