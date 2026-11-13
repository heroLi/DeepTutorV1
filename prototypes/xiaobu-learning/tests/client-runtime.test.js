import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTutorClient} from '../client/tutor-client.js';
import {createTutorRuntime} from '../server/runtime.js';
import {createD1Ledger,createD1LedgerAdmin} from '../server/d1-ledger.js';
import {openSqliteD1} from './helpers/sqlite-d1.js';
import {dialogueFixture} from '../server/catalogue.js';
const origin='https://fixture.test',query={questionId:'loop:math:0',intent:'check'},scope={profileId:'A',questionId:query.questionId},input={requestId:'one',intent:'check'};
async function fixture(run){
 const directory=await mkdtemp(join(tmpdir(),'xiaobu-client-'));let connection;
 try{
  connection=await openSqliteD1(join(directory,'ledger.sqlite'),{migrate:true});let time=1800000000000;const now=()=>time,db=connection.db,ledger=createD1Ledger({db,now}),admin=createD1LedgerAdmin({db,now});
  await admin.registerProfile({ownerId:'owner',profileId:'A'});await admin.createScope({scope:'offline-fixture',ownerId:'owner',currency:'TEST',limitMicros:1000,expiresAtMs:time+60000});
  const admitted=new WeakSet(),boundary={kind:'sites-dispatch',verifyRequest:r=>admitted.has(r)};let calls=0,transportCalls=0;
  const runtime=await createTutorRuntime({mode:'offline-test',origin,boundary,ledger,now,reservationMicros:600,credential:'synthetic-test-key',fetchImpl:async()=>{calls++;return new Response(JSON.stringify({model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:100},choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(dialogueFixture(query))}}]}),{headers:{'content-type':'application/json'}});}});
  // A synthetic browser/ingress bridge, NOT a production identity verifier.
  const transport=async(path,init)=>{transportCalls++;assert.ok(['/api/tutor/status','/api/tutor/dialogue'].includes(path));assert.equal(init.headers.origin,undefined);assert.equal(init.headers['sec-fetch-site'],undefined);assert.equal(init.headers['oai-authenticated-user-id'],undefined);
   const headers={...init.headers,'sec-fetch-site':'same-origin','oai-authenticated-user-id':'owner'};if(init.method==='POST')headers.origin=origin;
   const r=new Request(origin+path,{...init,headers});admitted.add(r);return runtime.fetch(r);
  };
  const client=createTutorClient({enabled:true,expectedMode:'offline-test',fetchImpl:transport});client.setScope(scope);
  await run({client,transport,db,ledger,admin,calls:()=>calls,transportCalls:()=>transportCalls,setTime:v=>{time=v;},time});
 }finally{await connection?.close();await rm(directory,{recursive:true,force:true});}
}
test('client through fake browser/ingress and real SQLite: status read-only, protocol, cache, quota and ownership',()=>fixture(async({client,db,calls,transportCalls})=>{
 const dump=async()=>JSON.stringify(await db.batch([db.prepare('SELECT * FROM tutor_scopes'),db.prepare('SELECT * FROM tutor_claims')]));const before=await dump();
 const s=await client.getStatus();assert.equal(s.status.platformVerified,false);assert.equal(s.status.upstreamConnectivity,'not-verified');assert.equal(s.status.configuredMode,'offline-test');assert.equal(s.status.quota.availableMicros,1000);assert.equal(await dump(),before);assert.equal(calls(),0);
 const answer=await client.dialogue(input);assert.equal(answer.result.answer,'4');assert.equal(answer.result.mode,'protocol-test');assert.equal(calls(),1);
 await client.dialogue(input);assert.equal(calls(),1);const after=await client.getStatus();assert.equal(after.status.quota.spentMicros,600);assert.equal(after.status.quota.availableMicros,400);assert.deepEqual(after.status.stoppedReasons,['BUDGET_EXHAUSTED']);
 await assert.rejects(client.dialogue({...input,requestId:'two'}),{code:'BUDGET_EXHAUSTED'});client.setScope({...scope,profileId:'B'});await assert.rejects(client.dialogue({...input,requestId:'three'}),{code:'FORBIDDEN'});assert.equal(calls(),1);assert.equal(transportCalls(),6);
}));
test('client rejects mode mismatch and forged readiness, math or quota fields',()=>fixture(async({transport})=>{
 const wrong=createTutorClient({enabled:true,expectedMode:'live',fetchImpl:transport});wrong.setScope(scope);await assert.rejects(wrong.getStatus(),{code:'INVALID_RESPONSE'});
 const mutations=[s=>s.platformVerified=true,s=>s.upstreamConnectivity='connected',s=>s.extra='untrusted',s=>s.quota.availableMicros++,s=>s.quota.currency='CNY',s=>s.quota.canRequest=false,s=>s.stoppedReasons=['SECRET'],s=>s.quota.rateAllowed=false,s=>s.scopeAndConfigurationAllowAttempt=false,s=>s.quota.observedAtMs=null,s=>{s.quota.capMicros=1e12+1;s.quota.availableMicros=1e12+1;},s=>{s.quota.nextReservationMicros=1e12+1;s.quota.quotaAllowed=false;s.quota.canRequest=false;s.quota.reasons=['BUDGET_EXHAUSTED'];s.stoppedReasons=['BUDGET_EXHAUSTED'];s.scopeAndConfigurationAllowAttempt=false;},s=>{s.quota.pendingCount=1e12+1;s.quota.inflightAllowed=false;s.quota.canRequest=false;s.quota.reasons=['INFLIGHT_LIMIT'];s.stoppedReasons=['INFLIGHT_LIMIT'];s.scopeAndConfigurationAllowAttempt=false;},s=>{s.quota.recentRequestCount=1e12+1;s.quota.rateAllowed=false;s.quota.canRequest=false;s.quota.reasons=['RATE_LIMIT'];s.stoppedReasons=['RATE_LIMIT'];s.scopeAndConfigurationAllowAttempt=false;}];
 for(const mutate of mutations){const c=createTutorClient({enabled:true,expectedMode:'offline-test',fetchImpl:async(...args)=>{const body=await(await transport(...args)).json();mutate(body.status);return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});}});c.setScope(scope);await assert.rejects(c.getStatus(),{code:'INVALID_RESPONSE'});}
}));
test('cold-start diagnostics remain visible without implying connection or enabling POST',()=>fixture(async({db,ledger,time})=>{
 await ledger.freezeScope('offline-fixture');const admitted=new WeakSet();
 const runtime=await createTutorRuntime({mode:'mock',origin,boundary:{kind:'sites-dispatch',verifyRequest:r=>admitted.has(r)},ledger,reservationMicros:1});
 const c=createTutorClient({enabled:true,expectedMode:'mock',fetchImpl:async(path,init)=>{const request=new Request(origin+path,{...init,headers:{...init.headers,'sec-fetch-site':'same-origin','oai-authenticated-user-id':'owner',...(init.method==='POST'?{origin}:{})}});admitted.add(request);return runtime.fetch(request);}});c.setScope(scope);
 const status=await c.getStatus();assert.equal(status.status.scopeAndConfigurationAllowAttempt,false);assert.equal(status.status.platformVerified,false);assert.ok(status.status.stoppedReasons.includes('RUNTIME_RESTART_REQUIRED'));assert.ok(status.status.stoppedReasons.includes('SCOPE_FROZEN'));
 await assert.rejects(c.dialogue(input),{code:'SERVICE_STOPPED'});const [claims]=await db.batch([db.prepare('SELECT count(*) AS n FROM tutor_claims')]);assert.equal(claims.results[0].n,0);
}));
test('cancelled local delivery is not a server rollback or refund; no automatic retry',()=>fixture(async({transport,calls,client})=>{
 let delivered,release;const ready=new Promise(r=>delivered=r);
 const c=createTutorClient({enabled:true,expectedMode:'offline-test',fetchImpl:async(...args)=>{const response=await transport(...args);delivered();await new Promise(r=>release=r);return response;}});c.setScope(scope);
 const pending=c.dialogue(input);await ready;c.cancel();await assert.rejects(pending,{code:'CANCELLED'});release();
 const status=await client.getStatus();assert.equal(status.status.quota.spentMicros,600);assert.equal(calls(),1);assert.equal(status.status.platformVerified,false);
}));
