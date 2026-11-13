import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTutorRuntime} from '../server/runtime.js';
import {createD1Ledger,createD1LedgerAdmin} from '../server/d1-ledger.js';
import {dialogueFixture} from '../server/catalogue.js';
import {openSqliteD1} from './helpers/sqlite-d1.js';
const origin='https://fixture.test',query={questionId:'loop:math:0',intent:'check'};
async function fixture(run,{maxRequests=20,maxInflight=2,limitMicros=20000}={}){
 const directory=await mkdtemp(join(tmpdir(),'xiaobu-status-'));let connection;
 try{
  connection=await openSqliteD1(join(directory,'status.sqlite'),{migrate:true});let time=1800000000000;const now=()=>time;
  const db=connection.db,ledger=createD1Ledger({db,now}),admin=createD1LedgerAdmin({db,now});
  await admin.registerProfile({ownerId:'owner',profileId:'A'});
  await admin.createScope({scope:'status-fixture',ownerId:'owner',currency:'CNY',limitMicros,expiresAtMs:time+60000,maxRequests,maxInflight});
  const approved=new WeakSet(),boundary={kind:'sites-dispatch',verifyRequest:r=>approved.has(r)};
  const request=(path='/api/tutor/status',{id='owner',trusted=true,method='GET',headers={},body}={})=>{const r=new Request(origin+path,{method,headers:{origin,'x-xiaobu-request':'1','oai-authenticated-user-id':id,...headers},...(body?{body:JSON.stringify(body)}:{})});if(trusted)approved.add(r);return r;};
  let calls=0;
  const fetchImpl=async()=>{calls++;return new Response(JSON.stringify({model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:100},choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(dialogueFixture(query))}}]}),{headers:{'content-type':'application/json'}});};
  const approval={provider:'deepseek',syntheticOnly:true,reference:'status-fixture',currency:'CNY',spendLimitMicros:limitMicros};
  const pricing={model:'deepseek-flash',currency:'CNY',inputMicrosPerMillion:2000000,outputMicrosPerMillion:8000000,verifiedAt:new Date(time-1000).toISOString(),expiresAt:new Date(time+30000).toISOString()};
  const runtime=await createTutorRuntime({mode:'live',origin,boundary,ledger,approval,pricing,credential:'synthetic-test-key',fetchImpl,now,reservationMicros:12000});
  const state=async()=>{const response=await runtime.fetch(request());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');return (await response.json()).status;};
  await run({db,ledger,runtime,request,state,now,config:{mode:'live',origin,boundary,ledger,approval,pricing,credential:'synthetic-test-key',fetchImpl,now,reservationMicros:12000},setTime:n=>{time=n;},calls:()=>calls});
 }finally{await connection?.close();await rm(directory,{recursive:true,force:true});}
}
test('status needs attested identity and owner, correct method, origin/header and exact route',()=>fixture(async({runtime,request,calls})=>{
 for(const [r,status] of [[request(undefined,{trusted:false}),401],[request(undefined,{id:'other'}),403],[request(undefined,{headers:{origin:'https://evil.test'}}),403],[request(undefined,{headers:{'x-xiaobu-request':'0'}}),403],[request(undefined,{headers:{'sec-fetch-site':'cross-site'}}),403],[request(undefined,{method:'POST'}),405],[request('/api/tutor/status?owner=owner'),404]])assert.equal((await runtime.fetch(r)).status,status);
 assert.equal(calls(),0);
}));
test('read-only status projects conservative quota, never identity/secrets/claims and never calls provider',()=>fixture(async({state,db,calls})=>{
 const dump=async()=>JSON.stringify(await db.batch([db.prepare('SELECT * FROM tutor_scopes'),db.prepare('SELECT * FROM tutor_claims')]));
 const before=await dump();const a=await state(),b=await state();assert.deepEqual(a,b);assert.equal(await dump(),before);assert.equal(calls(),0);
 assert.equal(a.configuredMode,'live');assert.equal(a.syntheticOnly,true);assert.equal(a.platformVerified,false);assert.equal(a.profileAuthorizationRequired,true);
 assert.equal(a.quota.availableMicros,20000);assert.equal(a.quota.nextReservationMicros,12000);assert.equal(a.quota.currency,'CNY');assert.equal(a.quota.unit,'CNY-microunits');assert.equal(a.quota.accounting,'conservative-reservations-not-provider-bill');for(const key of ['quotaAllowed','inflightAllowed','rateAllowed'])assert.equal(a.quota[key],true);assert.equal(a.scopeAndConfigurationAllowAttempt,true);
 assert.doesNotMatch(JSON.stringify(a),/synthetic-test-key|status-fixture|owner|claim_key|principal_id/i);
}));
test('POST remains functional; subsequent GET reports actual committed budget stop without new provider calls',()=>fixture(async({runtime,request,state,calls})=>{
 const response=await runtime.fetch(request('/api/tutor/dialogue',{method:'POST',headers:{'content-type':'application/json'},body:{requestId:'one',profileId:'A',...query}}));assert.equal(response.status,200);assert.equal(calls(),1);
 const s=await state();assert.equal(s.quota.spentMicros,12000);assert.equal(s.quota.reservedMicros,0);assert.equal(s.quota.availableMicros,8000);assert.equal(s.scopeAndConfigurationAllowAttempt,false);assert.ok(s.stoppedReasons.includes('BUDGET_EXHAUSTED'));assert.equal(calls(),1);
}));
test('status detects later freeze, expiration and pricing expiration while remaining read-only',()=>fixture(async({state,ledger,now,setTime,calls})=>{
 const start=now();await ledger.freezeScope('status-fixture');assert.ok((await state()).stoppedReasons.includes('SCOPE_FROZEN'));
 setTime(start+30000);assert.ok((await state()).stoppedReasons.includes('PRICING_EXPIRED'));
 setTime(start+60000);const expired=await state();assert.ok(expired.stoppedReasons.includes('SCOPE_EXPIRED'));assert.equal(expired.scopeAndConfigurationAllowAttempt,false);assert.equal(calls(),0);
}));
test('status inflight/rate counters agree with reservation and never claim platform readiness',()=>fixture(async({ledger,state,now,setTime})=>{
 await ledger.reserveAndClaim({key:JSON.stringify(['status-fixture','owner','pending']),fingerprint:JSON.stringify(['A',query.questionId,query.intent]),scope:'status-fixture',currency:'CNY',limitMicros:40000,reservationMicros:12000});
 const pending=await state();assert.equal(pending.quota.pendingCount,1);assert.equal(pending.quota.reservedMicros,12000);assert.equal(pending.quota.recentRequestCount,1);assert.ok(pending.stoppedReasons.includes('INFLIGHT_LIMIT'));assert.ok(pending.stoppedReasons.includes('RATE_LIMIT'));assert.equal(pending.platformVerified,false);
 setTime(now()+1000);assert.equal((await state()).quota.pendingCount,1);
},{maxRequests:1,maxInflight:1,limitMicros:40000}));
test('disabled runtime status remains disabled without touching supplied production-like dependencies',async()=>{
 let touched=false;const runtime=await createTutorRuntime({ledger:new Proxy({},{get(){touched=true;throw Error('must not touch');}})});
 assert.equal((await runtime.fetch(new Request(origin+'/api/tutor/status'))).status,503);assert.equal(touched,false);
});

test('asynchronous readiness rejection becomes a safe stop, not an unhandled success',()=>fixture(async({ledger,request,calls})=>{
 const {createTutorStatusHandler}=await import('../server/status.js');
 const handler=createTutorStatusHandler({mode:'live',origin,authenticate:async()=>({id:'owner'}),ledger,scope:'status-fixture',currency:'CNY',limitMicros:20000,reservationMicros:12000,checkProviderReadiness:async()=>{await Promise.resolve();throw Object.assign(new Error('private diagnostic'),{code:'PRICING_EXPIRED'});}});
 const response=await handler.fetch(request());assert.equal(response.status,200);const body=await response.json();assert.equal(body.status.scopeAndConfigurationAllowAttempt,false);assert.ok(body.status.stoppedReasons.includes('PRICING_EXPIRED'));assert.doesNotMatch(JSON.stringify(body),/private diagnostic/);assert.equal(calls(),0);
}));

test('readiness must return a positive safe cost bound within the reservation',()=>fixture(async({ledger,request,calls})=>{
 const {createTutorStatusHandler}=await import('../server/status.js');
 for(const value of [false,undefined,null,0,-1,NaN,Infinity,1.5,12001,Number.MAX_SAFE_INTEGER+1]){
  const handler=createTutorStatusHandler({mode:'live',origin,authenticate:async()=>({id:'owner'}),ledger,scope:'status-fixture',currency:'CNY',limitMicros:20000,reservationMicros:12000,checkProviderReadiness:async()=>value});
  const response=await handler.fetch(request());assert.equal(response.status,200);const body=await response.json();assert.equal(body.status.scopeAndConfigurationAllowAttempt,false);assert.ok(body.status.stoppedReasons.includes('LIVE_NOT_READY'));
 }
 assert.equal(calls(),0);
}));

test('browser GET without Origin accepts only same-origin Fetch Metadata plus custom header',()=>fixture(async({runtime,request})=>{
 for(const [site,marker,expected] of [['same-origin','1',200],[null,'1',403],['cross-site','1',403],['same-site','1',403],['same-origin','0',403]]){
  const r=request();r.headers.delete('origin');if(site!==null)r.headers.set('sec-fetch-site',site);r.headers.set('x-xiaobu-request',marker);
  assert.equal((await runtime.fetch(r)).status,expected);
 }
 const wrong=request();wrong.headers.set('origin','https://wrong.test');wrong.headers.set('sec-fetch-site','same-origin');assert.equal((await runtime.fetch(wrong)).status,403);
}));
test('cold frozen scope retains diagnostics but cannot call provider or relax configuration',()=>fixture(async({config,db,ledger,request,calls})=>{
 await ledger.freezeScope('status-fixture');const restarted=await createTutorRuntime(config);
 const status=await (await restarted.fetch(request())).json();assert.ok(status.status.stoppedReasons.includes('SCOPE_FROZEN'));assert.ok(status.status.stoppedReasons.includes('RUNTIME_RESTART_REQUIRED'));
 assert.equal((await restarted.fetch(request('/api/tutor/dialogue',{method:'POST'}))).status,503);assert.equal(calls(),0);
 for(const patch of [{credential:undefined},{boundary:undefined},{fetchImpl:undefined},{bodyTimeoutMs:0},{reservationMicros:1},{approval:{...config.approval,spendLimitMicros:30000}}])await assert.rejects(createTutorRuntime({...config,...patch}));

}));
test('cold expired scope plus expired pricing stays read-only and validates required config',()=>fixture(async({config,request,now,setTime,calls})=>{
 setTime(now()+60000);const restarted=await createTutorRuntime(config);
 const status=await (await restarted.fetch(request())).json();assert.ok(status.status.stoppedReasons.includes('SCOPE_EXPIRED'));assert.ok(status.status.stoppedReasons.includes('PRICING_EXPIRED'));assert.equal(status.status.scopeAndConfigurationAllowAttempt,false);
 assert.equal((await restarted.fetch(request('/api/tutor/dialogue',{method:'POST'}))).status,503);assert.equal(calls(),0);
 for(const patch of [{credential:undefined},{fetchImpl:undefined},{approval:{...config.approval,syntheticOnly:false}},{pricing:{...config.pricing,inputMicrosPerMillion:0}},{pricing:{...config.pricing,verifiedAt:'garbage'}},{reservationMicros:1}])await assert.rejects(createTutorRuntime({...config,...patch}));
}));
test('cold invalid ledger clock is diagnosable without authorizing POST',()=>fixture(async({config,db,request,calls})=>{
 const ledger=createD1Ledger({db,now:()=>NaN}),restarted=await createTutorRuntime({...config,ledger});
 const status=await (await restarted.fetch(request())).json();assert.ok(status.status.stoppedReasons.includes('CLOCK_INVALID'));assert.equal(status.status.scopeAndConfigurationAllowAttempt,false);
 assert.equal((await restarted.fetch(request('/api/tutor/dialogue',{method:'POST'}))).status,503);assert.equal(calls(),0);
}));
