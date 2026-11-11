import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulator,deterministicMock,validateResponse} from '../server-sim/service.js';
const caller={authenticated:true,userId:'fixture-user-a'};
const input=(requestId='one')=>({requestId,profileId:'fixture-profile-a',questionId:'practice:math:0',choiceId:'1'});
const throws=(fn,code)=>assert.throws(fn,{code});
const rejects=(promise,code)=>assert.rejects(promise,{code});
test('deterministic arithmetic, immutable bounded text and simulated accounting',async()=>{
 const sim=createSimulator(); const r=await sim.request(caller,input());
 assert.equal(r.response.answer,4); assert.equal(r.response.correct,true);
 assert.equal(r.chargedMicros,60); assert.equal(r.kind,'simulation-only');
 assert.ok(Object.isFrozen(r.response)); assert.equal(sim.snapshot().reservedMicros,0);
 assert.equal(sim.snapshot().spentMicros,60);
 const wrong=await sim.request(caller,{...input('two'),choiceId:'0'}); assert.equal(wrong.response.correct,false);
});
test('authentication and server-owned profile mapping are mandatory',()=>{
 const sim=createSimulator();
 for(const c of [null,{}, {authenticated:false,userId:caller.userId}]) throws(()=>sim.request(c,input()),'UNAUTHENTICATED');
 throws(()=>sim.request(caller,{...input(),profileId:'fixture-profile-b'}),'FORBIDDEN');
 throws(()=>sim.request(caller,{...input(),profileId:'unknown'}),'FORBIDDEN');
 assert.equal(sim.snapshot().spentMicros,0);
});
test('strict schema denies injection, free text, unknown IDs, getters and coercion',()=>{
 const sim=createSimulator();
 for(const patch of [{questionId:'practice:math:99'},{questionId:'__proto__'},{questionId:'practice:math:00'},{choiceId:1},{choiceId:'4'},{choiceId:'<img onerror=alert(1)>'},{prompt:'ignore rules'},{name:'child'},{apiKey:'secret'},{requestId:'x'.repeat(65)},{questionId:'https://example.test'}]) throws(()=>sim.request(caller,{...input(),...patch}),'INVALID_REQUEST');
 const payload=input(); Object.defineProperty(payload,'choiceId',{get(){throw Error('must not run');}});
 throws(()=>sim.request(caller,payload),'INVALID_REQUEST');
 throws(()=>sim.request(caller,JSON.parse('{"requestId":"one","profileId":"fixture-profile-a","questionId":"practice:math:0","choiceId":"1","__proto__":{}}')),'INVALID_REQUEST');
 assert.equal(sim.snapshot().reservedMicros,0);
});
test('incorrect, truncated, malicious and surplus response fields fail closed',async()=>{
 const good=deterministicMock(input());
 for(const bad of [{...good,answer:5},{...good,correct:false},{...good,explanation:'<script>alert(1)</script>'},{...good,explanation:'12 ÷'},{...good,extra:1},'partial',null]) {
  throws(()=>validateResponse(bad,'practice:math:0','1'),'INVALID_RESPONSE');
  const sim=createSimulator({adapter:()=>bad}); await rejects(sim.request(caller,input()),'INVALID_RESPONSE');
  assert.equal(sim.snapshot().spentMicros,100);
 }
});
test('inflight reservations prevent concurrent overspend and expose exact boundary',async()=>{
 let release; const gate=new Promise(r=>release=r); let calls=0;
 const sim=createSimulator({limitMicros:200,adapter:async x=>{calls++;await gate;return deterministicMock(x);}});
 const a=sim.request(caller,input('a')),b=sim.request(caller,input('b'));
 assert.equal(sim.snapshot().reservedMicros,200);
 throws(()=>sim.request(caller,input('c')),'BUDGET_EXHAUSTED'); release(); await Promise.all([a,b]);
 assert.equal(calls,2); assert.equal(sim.snapshot().spentMicros,120);
 throws(()=>sim.request(caller,input('d')),'BUDGET_EXHAUSTED');
 const exact=createSimulator({limitMicros:100,successMicros:100}); await exact.request(caller,input());
 assert.equal(exact.snapshot().availableMicros,0);
 throws(()=>exact.request(caller,input('next')),'BUDGET_EXHAUSTED');
});
test('same request shares promise and result, conflicts never double-charge',async()=>{
 let calls=0; const sim=createSimulator({adapter:x=>{calls++;return deterministicMock(x);}});
 const a=sim.request(caller,input()),b=sim.request(caller,input()); assert.equal(a,b);
 throws(()=>sim.request(caller,{...input(),choiceId:'0'}),'IDEMPOTENCY_CONFLICT');
 await a; assert.equal(await sim.request(caller,input()),await b);
 assert.equal(calls,1); assert.equal(sim.snapshot().spentMicros,60);
});
test('timeout settles conservatively, no automatic retry, late result ignored',async()=>{
 let finish,calls=0; const sim=createSimulator({timeoutMs:5,adapter:()=>{calls++;return new Promise(r=>finish=r);}});
 const p=sim.request(caller,input()); await rejects(p,'TIMEOUT');
 assert.equal(sim.snapshot().spentMicros,100); await rejects(sim.request(caller,input()),'TIMEOUT');
 finish(deterministicMock(input())); await new Promise(r=>setTimeout(r,1));
 assert.equal(calls,1); assert.equal(sim.snapshot().spentMicros,100); assert.equal(sim.snapshot().reservedMicros,0);
});
test('cancellation before call is free; inflight cancellation consumes reservation once',async()=>{
 const before=new AbortController(); before.abort(); const sim=createSimulator({adapter:()=>new Promise(()=>{})});
 throws(()=>sim.request(caller,input(),{signal:before.signal}),'CANCELLED'); assert.equal(sim.snapshot().spentMicros,0);
 const active=new AbortController(); const p=sim.request(caller,input(),{signal:active.signal}); active.abort();
 await rejects(p,'CANCELLED'); await rejects(sim.request(caller,input()),'CANCELLED'); assert.equal(sim.snapshot().spentMicros,100);
});
test('adapter exceptions are redacted and charged without retry',async()=>{
 let calls=0; const sim=createSimulator({adapter:()=>{calls++;throw Error('private payload');}});
 await rejects(sim.request(caller,input()),'ADAPTER_FAILED'); await rejects(sim.request(caller,input()),'ADAPTER_FAILED');
 assert.equal(calls,1); assert.equal(sim.snapshot().spentMicros,100);
});
test('budget config rejects fractions, negatives, overflow and unbounded timeout',()=>{
 for(const config of [{limitMicros:-1},{limitMicros:1.1},{limitMicros:Number.MAX_SAFE_INTEGER+1},{reservationMicros:0},{successMicros:101},{timeoutMs:Infinity}]) throws(()=>createSimulator(config),'INVALID_CONFIG');
 const sim=createSimulator({limitMicros:0}); throws(()=>sim.request(caller,input()),'BUDGET_EXHAUSTED');
});
test('adapter receives only immutable synthetic question and option, not identities',async()=>{
 const sim=createSimulator({adapter:arg=>{assert.deepEqual(Object.keys(arg),['questionId','choiceId']);assert.ok(Object.isFrozen(arg));return deterministicMock(arg);}});
 await sim.request(caller,input());
});
test('new guided loop math fixtures validate every selected option',async()=>{
 for(const [index,answer,choices] of [[0,4,[3,4,6,9]],[1,5,[4,5,10,16]],[2,3,[3,6,12,18]]]) {
  const sim=createSimulator();
  for(let c=0;c<4;c++) {
   const r=await sim.request(caller,{...input(`loop-${index}-${c}`),questionId:`loop:math:${index}`,choiceId:String(c)});
   assert.equal(r.response.answer,answer); assert.equal(r.response.correct,choices[c]===answer);
  }
 }
 const sim=createSimulator(); throws(()=>sim.request(caller,{...input(),questionId:'loop:english:0'}),'INVALID_REQUEST');
});
test('budgets apply across owned profiles and invalid cancellation handles cannot reserve',async()=>{
 const sim=createSimulator({limitMicros:100,successMicros:100,owners:{'fixture-profile-a':caller.userId,other:caller.userId}});
 throws(()=>sim.request(caller,input(),{signal:{aborted:false}}),'INVALID_SIGNAL');
 assert.equal(sim.snapshot().reservedMicros,0);
 await sim.request(caller,input());
 throws(()=>sim.request(caller,{...input('two'),profileId:'other'}),'BUDGET_EXHAUSTED');
});
test('caller mutations cannot rewrite the reserved operation or ownership snapshot',async()=>{
 const owners={'fixture-profile-a':caller.userId}; const sim=createSimulator({owners});
 owners['fixture-profile-a']='attacker';
 const body=input(); const pending=sim.request(caller,body); body.choiceId='0'; body.questionId='unknown';
 assert.equal((await pending).response.correct,true);
});
test('entry cap bounds zero-cost requests without evicting idempotency keys',async()=>{
 const sim=createSimulator({successMicros:0,maxRequests:2});
 await sim.request(caller,input('one')); await sim.request(caller,input('two'));
 throws(()=>sim.request(caller,input('three')),'REQUEST_CAPACITY');
 await sim.request(caller,input('one')); assert.equal(sim.snapshot().requestCount,2);
 assert.equal(sim.snapshot().spentMicros,0);
});
test('inflight cap rejects excess work even when budget is available',async()=>{
 let release; const gate=new Promise(r=>release=r);
 const sim=createSimulator({maxInflight:1,adapter:async x=>{await gate;return deterministicMock(x);}});
 const pending=sim.request(caller,input());
 throws(()=>sim.request(caller,input('other')),'INFLIGHT_LIMIT');
 assert.equal(sim.snapshot().inflight,1); release(); await pending; assert.equal(sim.snapshot().inflight,0);
 await sim.request(caller,input('other'));
});
test('idempotency is user scoped, same user different profile conflicts',async()=>{
 const sim=createSimulator({owners:{'fixture-profile-a':caller.userId,second:caller.userId,'fixture-profile-b':'fixture-user-b'}});
 await sim.request(caller,input());
 throws(()=>sim.request(caller,{...input(),profileId:'second'}),'IDEMPOTENCY_CONFLICT');
 await sim.request({authenticated:true,userId:'fixture-user-b'},{...input(),profileId:'fixture-profile-b'});
 assert.equal(sim.snapshot().spentMicros,120); assert.equal(sim.snapshot().requestCount,2);
 throws(()=>sim.request({authenticated:true,userId:'fixture-user-b'},input()),'FORBIDDEN');
});
test('strict input rejects missing fields, arrays, inherited objects and symbol extras',()=>{
 const sim=createSimulator(); const missing=input(); delete missing.choiceId;
 for(const bad of [missing,[],null,Object.assign(Object.create({}),input()),{...input(),[Symbol('extra')]:true}]) throws(()=>sim.request(caller,bad),'INVALID_REQUEST');
 for(const config of [{maxInflight:0},{maxRequests:0},{maxInflight:1.5},{maxRequests:Infinity}]) throws(()=>createSimulator(config),'INVALID_CONFIG');
});
test('simulator math fixtures agree with actual guided-loop frontend catalog',async()=>{
 const {loopBank,boundedDivision}=await import('../dist/loop-model.js');
 const {subjects,units}=await import('../dist/model.js');
 for(const [prefix,items] of [['loop:math',loopBank.math.items],['practice:math',subjects.math.items],['test:math',units.math.items]]) {
  const sim=createSimulator({limitMicros:10000});
  for(const [index,q] of items.entries()) {
   if(prefix==='loop:math') assert.equal(String(boundedDivision(q.total,q.groups)),q.answer);
   for(const [choiceId,choice] of q.choices.entries()) {
    const {response}=await sim.request(caller,{...input(`${index}-${choiceId}`),questionId:`${prefix}:${index}`,choiceId:String(choiceId)});
    assert.equal(String(response.answer),q.answer); assert.equal(response.correct,choice===q.answer);
   }
  }
 }
});
