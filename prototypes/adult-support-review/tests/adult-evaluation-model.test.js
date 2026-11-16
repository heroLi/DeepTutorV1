import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CASES,RUBRIC,createEvaluationSession} from '../adult-evaluation/model.js';
const timestamp='2026-11-13T12:00:00.000Z';
const session=()=>createEvaluationSession({now:()=>timestamp});
function rateAll(s,value='pass'){for(const r of RUBRIC)assert.equal(s.rate(r.id,value,s.snapshot().revision).ok,true);}
test('four original cases contain twelve clearly authored candidates and separate reference evidence',()=>{
 assert.equal(CASES.length,4);assert.equal(new Set(CASES.map(x=>x.id)).size,4);
 for(const c of CASES){assert.deepEqual(c.candidates.map(x=>x.id),['A','B','C']);assert.equal(c.reference.checks.length,3);assert.ok(c.prompt&&c.reference.reasoning&&c.reference.answer);for(const x of c.candidates)assert.ok(x.text&&x.fixtureNote);assert.match(c.candidates[1].fixtureNote,/预置缺陷/);}
 assert.equal(CASES[0].reference.answer,'每盒 4 块。');assert.equal(12/3,4);
 assert.equal(CASES[1].reference.answer,'每盒 4 块，还剩 2 块。');assert.equal(3*4+2,14);assert.ok(2<3);assert.match(CASES[1].prompt,/不可拆分/);
 assert.equal(CASES[2].reference.answer,'an hour');assert.match(CASES[2].reference.reasoning,/h 不发音/);
 assert.equal(CASES[3].reference.answer,'窄');assert.match(CASES[3].reference.reasoning,/宽度/);
});
test('fixtures and independent sessions cannot be mutated or share review state',()=>{
 assert.throws(()=>{CASES[0].reference.checks.push('changed');},TypeError);assert.throws(()=>{RUBRIC[0].id='changed';},TypeError);
 const a=session(),b=session(),before=a.snapshot();assert.deepEqual(before.ratings,{});assert.deepEqual(before.records,[]);assert.equal(before.dirty,false);
 assert.throws(()=>{before.ratings.correctness='pass';},TypeError);a.rate('correctness','pass',0);assert.deepEqual(b.snapshot().ratings,{});assert.deepEqual(before.ratings,{});
 assert.notEqual(a.snapshot(),a.snapshot());assert.notEqual(a.snapshot().ratings,a.snapshot().ratings);
});
test('all twelve cases require human ratings; fixture labels never auto-score',()=>{
 const s=session();for(const c of CASES)for(const candidate of c.candidates){assert.equal(s.select(c.id,candidate.id,s.snapshot().revision).ok,true);assert.equal(s.save(s.snapshot().revision).code,'INCOMPLETE_REVIEW');assert.deepEqual(s.snapshot().ratings,{});rateAll(s);assert.equal(s.save(s.snapshot().revision).ok,true);}
 assert.equal(s.snapshot().records.length,12);assert.ok(s.snapshot().records.every(x=>x.derivedDecision==='acceptable'));
});
test('derived decisions reflect manual ratings, with failure above uncertainty',()=>{
 for(const [ratings,expected] of [[['pass','pass','pass'],'acceptable'],[['pass','uncertain','pass'],'needs-review'],[['uncertain','fail','pass'],'revise']]){const s=session();RUBRIC.forEach((r,i)=>s.rate(r.id,ratings[i],s.snapshot().revision));assert.equal(s.save(s.snapshot().revision).ok,true);assert.equal(s.snapshot().records[0].derivedDecision,expected);}
});
test('dirty selection is atomic; explicit discard and same-choice no-op are distinct',()=>{
 const s=session();s.rate('reasoning','fail',0);const before=s.snapshot();assert.equal(s.select(CASES[1].id,'B',before.revision).code,'UNSAVED_REVIEW');assert.deepEqual(s.snapshot(),before);
 assert.equal(s.select(before.caseId,before.candidateId,before.revision).ok,true);assert.deepEqual(s.snapshot(),before);
 assert.equal(s.select(CASES[1].id,'B',before.revision,{discard:true}).ok,true);assert.deepEqual(s.snapshot().ratings,{});assert.equal(s.snapshot().dirty,false);assert.equal(s.snapshot().revision,before.revision+1);
});
test('stale callbacks cannot rate, discard, save or clear a newer review',()=>{
 const s=session();const rev=s.snapshot().revision;s.rate('correctness','pass',rev);const before=s.snapshot();
 for(const result of [s.rate('reasoning','fail',rev),s.select(CASES[1].id,'B',rev,{discard:true}),s.save(rev),s.clear(rev)])assert.equal(result.code,'STALE_REVIEW');assert.deepEqual(s.snapshot(),before);
 for(const value of [undefined,null,'1',-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])assert.equal(s.clear(value).code,'INVALID_REVISION');assert.deepEqual(s.snapshot(),before);
});
test('saving twice never double-counts; revising replaces only its own record',()=>{
 const s=session();rateAll(s);s.save(s.snapshot().revision);const previous=s.snapshot(),first=previous.records[0];assert.equal(s.save(s.snapshot().revision).code,'NO_CHANGES');assert.deepEqual(s.snapshot(),previous);
 s.select(CASES[1].id,'B',s.snapshot().revision);rateAll(s,'fail');s.save(s.snapshot().revision);s.select(CASES[0].id,'A',s.snapshot().revision);rateAll(s,'uncertain');s.save(s.snapshot().revision);
 assert.equal(s.snapshot().records.length,2);assert.equal(s.snapshot().records[0].derivedDecision,'needs-review');assert.equal(s.snapshot().records[1].derivedDecision,'revise');assert.equal(first.derivedDecision,'acceptable');assert.equal(first.at,timestamp);
});
test('export contains saved evidence only, is detached, and does not imply live model output',()=>{
 const s=session();rateAll(s);s.save(s.snapshot().revision);const exported=s.exportReport();s.rate('reasoning','fail',s.snapshot().revision);
 assert.deepEqual(Object.keys(exported),['schema','version','scope','provider','catalogueVersion','records','fixtures']);assert.equal(exported.schema,'adult-synthetic-evaluation');assert.equal(exported.version,1);assert.equal(exported.scope,'adult-review-only');assert.equal(exported.provider,'offline-authored-fixtures');assert.equal(s.exportReport().records[0].ratings.reasoning,'pass');assert.equal(exported.records.length,1);
 assert.throws(()=>{exported.records[0].ratings.reasoning='fail';},TypeError);s.clear(s.snapshot().revision);assert.equal(exported.records.length,1);assert.equal(s.exportReport().records.length,0);
});
test('export is self-contained and includes exactly saved fixture references, never draft candidates',()=>{
 const s=session();assert.deepEqual(s.exportReport().fixtures,[]);rateAll(s);s.save(s.snapshot().revision);
 s.select(CASES[0].id,'C',s.snapshot().revision);rateAll(s,'uncertain');s.save(s.snapshot().revision);
 s.select(CASES[2].id,'B',s.snapshot().revision);rateAll(s,'fail');s.save(s.snapshot().revision);
 s.select(CASES[1].id,'A',s.snapshot().revision);rateAll(s);
 const exported=s.exportReport();assert.equal(exported.catalogueVersion,'adult-fixed-v1');assert.equal(exported.records.length,3);
 assert.deepEqual(exported.fixtures.map(item=>[item.id,item.candidates.map(candidate=>candidate.id)]),[[CASES[0].id,['A','C']],[CASES[2].id,['B']]]);
 for(const record of exported.records){const item=exported.fixtures.find(item=>item.id===record.caseId),original=CASES.find(item=>item.id===record.caseId);assert.equal(item.prompt,original.prompt);assert.deepEqual(item.reference,original.reference);assert.notEqual(item.reference,original.reference);assert.deepEqual(item.candidates.find(candidate=>candidate.id===record.candidateId),original.candidates.find(candidate=>candidate.id===record.candidateId));}
 assert.throws(()=>{exported.fixtures[0].reference.checks.push('mutated');},TypeError);assert.throws(()=>{exported.fixtures[0].candidates[0].text='mutated';},TypeError);
 const fresh=s.exportReport();assert.notEqual(fresh.fixtures,exported.fixtures);assert.notEqual(fresh.fixtures[0].candidates[0],exported.fixtures[0].candidates[0]);
 s.clear(s.snapshot().revision);assert.deepEqual(s.exportReport().fixtures,[]);assert.equal(exported.fixtures.length,2);
});
test('clear removes drafts and saved reviews while retaining only current selection',()=>{
 const s=session();s.select(CASES[2].id,'C',0);rateAll(s);s.save(s.snapshot().revision);s.rate('correctness','fail',s.snapshot().revision);const before=s.snapshot();assert.equal(s.clear(before.revision).ok,true);
 assert.deepEqual(s.snapshot(),{caseId:CASES[2].id,candidateId:'C',ratings:{},records:[],revision:before.revision+1,dirty:false});
});
test('malformed selections, ratings and options fail without invoking getters or mutating state',()=>{
 const s=session(),before=s.snapshot();let got=false;const getter={get discard(){got=true;return true;}};
 for(const id of ['__proto__','constructor','unknown',{},null,1])assert.equal(s.select(id,'A',0).code,'INVALID_SELECTION');
 for(const value of ['__proto__','constructor','D',{},null,1])assert.equal(s.select(CASES[0].id,value,0).code,'INVALID_SELECTION');
 for(const options of [null,[],Object.create({discard:true}),{discard:1},{unexpected:true},getter])assert.equal(s.select(CASES[1].id,'A',0,options).code,'INVALID_SELECTION');
 for(const [id,value] of [['__proto__','pass'],['constructor','pass'],['correctness','unknown'],['correctness',{}],[{},'pass']])assert.equal(s.rate(id,value,0).code,'INVALID_RATING');assert.equal(got,false);assert.deepEqual(s.snapshot(),before);
});
test('invalid clocks and constructor options fail closed without losing a completed draft',()=>{
 for(const options of [null,[],Object.create({now:()=>timestamp}),{now:null},{other:true},{get now(){throw Error('must not execute');}}])assert.throws(()=>createEvaluationSession(options),/INVALID_CONFIG/);
 for(const now of [()=>'',()=>null,()=>new Date(),()=> '2026-11-13',()=>{throw Error('private clock');}]){const s=createEvaluationSession({now});rateAll(s);const before=s.snapshot();assert.equal(s.save(before.revision).code,'INVALID_TIME');assert.deepEqual(s.snapshot(),before);}
});
test('model source has no transport, persistence, microphone, or learner-workflow dependency',()=>{
 const source=readFileSync(new URL('../adult-evaluation/model.js',import.meta.url),'utf8');assert.doesNotMatch(source,/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|getUserMedia)\s*[.(]/);assert.doesNotMatch(source,/^import\s/m);
});
