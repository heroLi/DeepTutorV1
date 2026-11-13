import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSitesAuthenticator} from '../server/sites-auth.js';
import {createTutorService} from '../server/service.js';
import {readRequestJson} from '../server/request-body.js';
const origin='https://fixture.test';
const input={requestId:'one',profileId:'A',questionId:'loop:math:0',intent:'check'};
const headers={origin,'content-type':'application/json','x-xiaobu-request':'1','oai-authenticated-user-id':'owner'};
const req=(patch={})=>new Request(origin+'/api/tutor/dialogue',{method:'POST',headers,body:JSON.stringify(input),...patch});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Requests must be explicitly attested by this synthetic ingress. Merely copying
// the headers is not enough. Production must supply its own platform boundary.
const admitted=new WeakSet();
const boundary={kind:'sites-dispatch',verifyRequest:request=>admitted.has(request)};
const admit=request=>{admitted.add(request);return request;};

test('Sites stable ID requires trusted ingress; email/name and bypass cannot grant identity',async()=>{
 assert.throws(()=>createSitesAuthenticator(),{code:'TRUST_BOUNDARY_REQUIRED'});
 assert.throws(()=>createSitesAuthenticator({boundary:{kind:'raw-node',verifyRequest:()=>true}}),{code:'TRUST_BOUNDARY_REQUIRED'});
 const auth=createSitesAuthenticator({boundary});assert.equal(await auth(req()),null);
 assert.deepEqual(await auth(admit(req({headers:{...headers,'oai-authenticated-user-email':'ignored@example.test','oai-authenticated-user-full-name':'Ignored'}}))),{id:'owner'});
 for(const h of [{...headers,'oai-authenticated-user-id':''},{...headers,'oai-authenticated-user-id':'bad,id'},{...headers,'oai-sites-authorization':'Bearer synthetic-bypass'}])assert.equal(await auth(admit(req({headers:h}))),null);
});
test('authentication rejects before body read or ledger access',async()=>{
 let reads=0;const service=createTutorService({mode:'mock',origin,authenticate:async()=>null,authorizeProfile:async()=>assert.fail(),ledger:{reserveAndClaim:async()=>assert.fail(),settle:async()=>assert.fail()},reservationMicros:1});
 const stream=new ReadableStream({pull(){reads++;return new Promise(()=>{});}},{highWaterMark:0});
 const response=await service.fetch(req({body:stream,duplex:'half'}));assert.equal(response.status,401);assert.equal(reads,0);
});
test('body timeout bounds hung reads and hung cancellation; late input cannot run ledger',async()=>{
 let calls=0,controller;
 const service=createTutorService({mode:'mock',origin,authenticate:async()=>({id:'owner'}),authorizeProfile:async()=>true,ledger:{reserveAndClaim:async()=>{calls++;assert.fail();},settle:async()=>assert.fail()},reservationMicros:1,bodyTimeoutMs:10});
 const stream=new ReadableStream({start(c){controller=c;},cancel(){return new Promise(()=>{});}});
 const result=await service.fetch(req({body:stream,duplex:'half'}));assert.equal(result.status,408);assert.equal((await result.json()).error.code,'BODY_TIMEOUT');
 try{controller.enqueue(new TextEncoder().encode(JSON.stringify(input)));}catch{}await sleep(15);assert.equal(calls,0);
});
test('body reader enforces byte limits, fatal UTF8, malformed JSON, cancellation and zero timeout rejection',async()=>{
 await assert.rejects(readRequestJson(req(),{timeoutMs:0}),{code:'INVALID_CONFIG'});
 await assert.rejects(readRequestJson(req({body:'x'.repeat(1025)})),{code:'RESPONSE_TOO_LARGE'});
 await assert.rejects(readRequestJson(req({body:new Uint8Array([255])})),{code:'INVALID_REQUEST'});
 await assert.rejects(readRequestJson(req({body:'{'})),{code:'INVALID_REQUEST'});
 await assert.rejects(readRequestJson(req({headers:{...headers,'content-length':'1025'}})),{code:'RESPONSE_TOO_LARGE'});
 const abort=new AbortController();const pending=readRequestJson(req({body:new ReadableStream({}),duplex:'half',signal:abort.signal}));abort.abort();await assert.rejects(pending,{code:'CANCELLED'});
 const already=new AbortController();already.abort();await assert.rejects(readRequestJson(req({signal:already.signal})),{code:'CANCELLED'});
 assert.deepEqual(await readRequestJson(req()),input);
});

test('runtime default is disabled and non-durable ledger cannot enable it',async()=>{
 const {createTutorRuntime}=await import('../server/runtime.js');
 const runtime=await createTutorRuntime();assert.equal((await runtime.fetch(req())).status,503);
 await assert.rejects(createTutorRuntime({mode:'live',ledger:{kind:'durable-atomic'}}),{code:'PERSISTENT_LEDGER_REQUIRED'});
});
test('SQLite-backed composed runtime checks owner/profile, TEST scope, duplicates and fake HTTP protocol',async()=>{
 const {createTutorRuntime}=await import('../server/runtime.js');
 const {createD1Ledger,createD1LedgerAdmin}=await import('../server/d1-ledger.js');
 const {openSqliteD1}=await import('./helpers/sqlite-d1.js');
 const {dialogueFixture}=await import('../server/catalogue.js');
 const directory=await mkdtemp(join(tmpdir(),'xiaobu-runtime-'));let connection;
 try{
  connection=await openSqliteD1(join(directory,'ledger.sqlite'),{migrate:true});
  const now=()=>1800000000000,db=connection.db,ledger=createD1Ledger({db,now}),admin=createD1LedgerAdmin({db,now});
  await admin.registerProfile({ownerId:'owner',profileId:'A'});
  await admin.registerProfile({ownerId:'other',profileId:'A'});
  await admin.createScope({scope:'offline-fixture',ownerId:'owner',currency:'TEST',limitMicros:1000,expiresAtMs:now()+60000});
  let calls=0;const fetchImpl=async()=>{calls++;return new Response(JSON.stringify({model:'deepseek-flash',usage:{prompt_tokens:200,completion_tokens:100},choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(dialogueFixture({questionId:input.questionId,intent:input.intent}))}}]}),{headers:{'content-type':'application/json'}});};
  const options={mode:'offline-test',origin,boundary,ledger,credential:'synthetic-test-key',fetchImpl,reservationMicros:100};
  const runtime=await createTutorRuntime(options);
  assert.equal((await runtime.fetch(req())).status,401);
  for(let i=0;i<2;i++)assert.equal((await runtime.fetch(admit(req()))).status,200);assert.equal(calls,1);
  assert.equal((await runtime.fetch(admit(req({body:JSON.stringify({...input,requestId:'other',profileId:'B'})})))).status,403);
  assert.notEqual((await runtime.fetch(admit(req({headers:{...headers,'oai-authenticated-user-id':'other'}})))).status,200);assert.equal(calls,1);
  await assert.rejects(createTutorRuntime({...options,approval:{reference:'cash'}}),{code:'INVALID_CONFIG'});
  for(const extra of [{message:'private child text'},{audio:'recording'},{mode:'live'}])assert.equal((await runtime.fetch(admit(req({body:JSON.stringify({...input,...extra})})))).status,400);
  // Synthetic approval/config and injected fake HTTP only: no provider network.
  const approval={provider:'deepseek',syntheticOnly:true,reference:'synthetic-paid-scope',currency:'CNY',spendLimitMicros:20000};
  await admin.createScope({scope:approval.reference,ownerId:'owner',currency:'CNY',limitMicros:20000,expiresAtMs:now()+60000});
  const pricing={model:'deepseek-flash',currency:'CNY',inputMicrosPerMillion:2000000,outputMicrosPerMillion:8000000,verifiedAt:new Date(now()-1000).toISOString(),expiresAt:new Date(now()+60000).toISOString()};
  const liveOptions={mode:'live',origin,boundary,ledger,credential:'synthetic-test-key',fetchImpl,reservationMicros:12000,approval,pricing,now};
  const live=await createTutorRuntime(liveOptions);
  const liveResponse=await live.fetch(admit(req()));assert.equal(liveResponse.status,200);assert.equal((await liveResponse.json()).result.mode,'deepseek');assert.equal(calls,2);
  assert.equal((await live.fetch(admit(req({body:JSON.stringify({...input,requestId:'exhausted'})})))).status,429);assert.equal(calls,2);
  await assert.rejects(createTutorRuntime({...liveOptions,credential:undefined}),{code:'INVALID_CONFIG'});
  await assert.rejects(createTutorRuntime({...liveOptions,approval:{...approval,spendLimitMicros:30000}}));
  const mock=await createTutorRuntime({mode:'mock',origin,boundary,ledger,reservationMicros:1});
  const response=await mock.fetch(admit(req({body:JSON.stringify({...input,requestId:'mock'})})));assert.equal(response.status,200);assert.equal((await response.json()).result.mode,'mock');
  for(const path of ['/api/audio','/api/tutor/free-text','/admin/scope'])assert.equal((await runtime.fetch(admit(new Request(origin+path,{method:'POST',headers,body:'{}'})))).status,404);
  await connection.close();connection=await openSqliteD1(join(directory,'ledger.sqlite'));
  const reopened=await createTutorRuntime({...options,ledger:createD1Ledger({db:connection.db,now})});
  assert.equal((await reopened.fetch(admit(req()))).status,200);assert.equal(calls,2); // Persisted cache, no repeat provider call.

 }finally{await connection?.close();await rm(directory,{recursive:true,force:true});}
});

test('live composition with synthetic CNY persists charges/cache across restart and rejects scope/config drift',async()=>{
 const {createTutorRuntime}=await import('../server/runtime.js');
 const {createD1Ledger,createD1LedgerAdmin}=await import('../server/d1-ledger.js');
 const {openSqliteD1}=await import('./helpers/sqlite-d1.js');
 const {dialogueFixture}=await import('../server/catalogue.js');
 const directory=await mkdtemp(join(tmpdir(),'xiaobu-live-fixture-'));let connection;
 const nowMs=1800000000000,now=()=>nowMs;
 try{
  const path=join(directory,'live.sqlite');connection=await openSqliteD1(path,{migrate:true});
  const ledger=createD1Ledger({db:connection.db,now}),admin=createD1LedgerAdmin({db:connection.db,now});
  await admin.registerProfile({ownerId:'owner',profileId:'A'});
  await admin.createScope({scope:'synthetic-cny',ownerId:'owner',currency:'CNY',limitMicros:20000,expiresAtMs:nowMs+60000});
  await admin.createScope({scope:'offline-fixture',ownerId:'owner',currency:'TEST',limitMicros:1000,expiresAtMs:nowMs+60000});
  const approval={provider:'deepseek',syntheticOnly:true,reference:'synthetic-cny',currency:'CNY',spendLimitMicros:20000};
  const pricing={model:'deepseek-flash',currency:'CNY',inputMicrosPerMillion:2000000,outputMicrosPerMillion:8000000,verifiedAt:new Date(nowMs-1000).toISOString(),expiresAt:new Date(nowMs+60000).toISOString()};
  let calls=0;
  // No global fetch, real credential, or network. Live code path uses this stub.
  const fetchImpl=async(url,options)=>{calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(options.headers.authorization,'Bearer synthetic-test-key');return new Response(JSON.stringify({model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:100},choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(dialogueFixture({questionId:input.questionId,intent:input.intent}))}}]}),{headers:{'content-type':'application/json'}});};
  const config={mode:'live',origin,boundary,ledger,approval,pricing,credential:'synthetic-test-key',fetchImpl,now,reservationMicros:12000};
  for(const patch of [{credential:undefined},{fetchImpl:undefined},{approval:undefined},{approval:{...approval,syntheticOnly:false}},{approval:{...approval,spendLimitMicros:30000}},{approval:{...approval,currency:'USD'}},{approval:{...approval,reference:'offline-fixture',spendLimitMicros:1000}}])await assert.rejects(createTutorRuntime({...config,...patch}));
  assert.equal(calls,0);
  const runtime=await createTutorRuntime(config);
  for(let i=0;i<2;i++){const response=await runtime.fetch(admit(req()));assert.equal(response.status,200);assert.equal((await response.json()).result.mode,'deepseek');}assert.equal(calls,1);
  const readBudget=async()=>{const [result]=await connection.db.batch([connection.db.prepare('SELECT currency,spent_micros,reserved_micros FROM tutor_scopes WHERE scope=?').bind('synthetic-cny')]);return {...result.results[0]};};
  assert.deepEqual(await readBudget(),{currency:'CNY',spent_micros:12000,reserved_micros:0});
  const over=()=>admit(req({body:JSON.stringify({...input,requestId:'second'})}));
  const insufficient=await runtime.fetch(over());assert.equal(insufficient.status,429);assert.equal((await insufficient.json()).error.code,'BUDGET_EXHAUSTED');assert.equal(calls,1);
  await connection.close();connection=await openSqliteD1(path);
  const reopenedLedger=createD1Ledger({db:connection.db,now});
  const restarted=await createTutorRuntime({...config,ledger:reopenedLedger});
  assert.equal((await restarted.fetch(admit(req()))).status,200);assert.equal((await restarted.fetch(over())).status,429);assert.equal(calls,1);
  assert.deepEqual(await readBudget(),{currency:'CNY',spent_micros:12000,reserved_micros:0});
  const expired=await createTutorRuntime({...config,ledger:createD1Ledger({db:connection.db,now:()=>nowMs+60000})});assert.equal((await expired.fetch(admit(req()))).status,503);
  assert.equal(calls,1);
 }finally{await connection?.close();await rm(directory,{recursive:true,force:true});}
});
