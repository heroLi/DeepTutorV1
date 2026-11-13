// Real temporary SQLite persistence + synthetic D1 daily-limit exceptions.
// NOT a real D1 quota exhaustion or provider/network integration test.
// Error wording: https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/
// Prefix and extended suffix: https://developers.cloudflare.com/d1/observability/debug-d1/
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqliteD1} from './helpers/sqlite-d1.js';
import {createD1Ledger,createD1LedgerAdmin} from '../server/d1-ledger.js';
import {createTutorRuntime} from '../server/runtime.js';
import {createTutorClient} from '../client/tutor-client.js';
import {dialogueFixture} from '../server/catalogue.js';
const now=()=>1800000000000,origin='https://fixture.test';
const input=Object.freeze({requestId:'one',profileId:'A',questionId:'loop:math:0',intent:'check'});
const targets={
 cold:sql=>sql==='SELECT * FROM tutor_scopes WHERE scope=?',
 profile:sql=>sql==='SELECT active FROM tutor_profiles WHERE owner_id=? AND profile_id=?',
 reserve:sql=>sql.startsWith('INSERT OR IGNORE INTO tutor_claims('),
 'settle-read':sql=>sql==='SELECT * FROM tutor_claims WHERE token=?',
 'settle-write':sql=>sql.startsWith("UPDATE tutor_claims SET state='settled'"),
 status:sql=>sql.startsWith('SELECT s.currency,s.limit_micros')
};
async function setup(t,message){
 const dir=mkdtempSync(join(tmpdir(),'xiaobu-daily-limit-')),h=openSqliteD1(join(dir,'fixture.sqlite'),{migrate:true});t.after(()=>{h.close();rmSync(dir,{recursive:true,force:true});});
 const admin=createD1LedgerAdmin({db:h.db,now});await admin.registerProfile({ownerId:'owner',profileId:'A'});await admin.createScope({scope:'offline-fixture',ownerId:'owner',currency:'TEST',limitMicros:1000,expiresAtMs:now()+60000});
 let point=null,hits=0,calls=0,successfulProviderResponses=0,transportCalls=0;
 const db={prepare:sql=>h.db.prepare(sql),async batch(statements){if(point&&targets[point](statements[0].sql)){hits++;throw Error(message);}return h.db.batch(statements);}};
 const ledger=createD1Ledger({db,now}),admitted=new WeakSet();
 const options={mode:'offline-test',origin,boundary:{kind:'sites-dispatch',verifyRequest:r=>admitted.has(r)},ledger,now,reservationMicros:100,credential:'synthetic-only',fetchImpl:async()=>{calls++;const response=Response.json({model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:100},choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(dialogueFixture({questionId:input.questionId,intent:input.intent}))}}]});successfulProviderResponses++;return response;}};
 const request=(path,init={})=>{const r=new Request(origin+path,{...init,headers:{...init.headers,origin,'content-type':'application/json','sec-fetch-site':'same-origin','x-xiaobu-request':'1','oai-authenticated-user-id':'owner'}});admitted.add(r);return r;};
 const send=(runtime,status=false)=>runtime.fetch(request(status?'/api/tutor/status':'/api/tutor/dialogue',status?{}:{method:'POST',body:JSON.stringify(input)}));
 return {options,send,arm(value){point=value;},get hits(){return hits;},get calls(){return calls;},get successfulProviderResponses(){return successfulProviderResponses;},get transportCalls(){return transportCalls;},stats:()=>({...h.connection.prepare('SELECT spent_micros,reserved_micros FROM tutor_scopes').get()}),claims:()=>h.connection.prepare('SELECT state FROM tutor_claims').all().map(x=>({...x})),dump:()=>JSON.stringify([h.connection.prepare('SELECT * FROM tutor_scopes').all(),h.connection.prepare('SELECT * FROM tutor_claims').all()]),client(runtime){const c=createTutorClient({enabled:true,expectedMode:'offline-test',fetchImpl:async(path,init)=>{transportCalls++;return runtime.fetch(request(path,init));}});c.setScope({profileId:'A',questionId:input.questionId});return c;}};
}
async function unavailable(response){assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{ok:false,error:{code:'LEDGER_UNAVAILABLE'}});}
for(const row of ['read','write'])for(const prefix of [false,true]){
 const message=(prefix?'D1_ERROR: ':'')+`Your account has exceeded D1's free tier daily row ${row} limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue.`+(prefix?' See https://developers.cloudflare.com/d1/platform/limits/ for more details.':'');
 const label=`${row} ${prefix?'prefixed extended':'changelog bare'}`;
 for(const point of Object.keys(targets))test(`D1 daily ${label}: ${point} fails closed without retry or raw error disclosure`,async t=>{
  const f=await setup(t,message);if(point==='cold'){f.arm(point);const before=f.dump();await assert.rejects(createTutorRuntime(f.options),e=>e.code==='LEDGER_UNAVAILABLE'&&e.message==='LEDGER_UNAVAILABLE');assert.equal(f.hits,1);assert.equal(f.calls,0);assert.equal(f.dump(),before);return;}
  const runtime=await createTutorRuntime(f.options),before=f.dump();f.arm(point);await unavailable(await f.send(runtime,point==='status'));assert.equal(f.hits,1);
  const settlement=point.startsWith('settle-');assert.equal(f.calls,settlement?1:0);assert.equal(f.successfulProviderResponses,settlement?1:0);assert.deepEqual(f.stats(),{spent_micros:0,reserved_micros:settlement?100:0});
  if(settlement){assert.deepEqual(f.claims(),[{state:'pending'}]);f.arm(null);const replay=await f.send(await createTutorRuntime(f.options));assert.equal(replay.status,409);assert.deepEqual(await replay.json(),{ok:false,error:{code:'IN_PROGRESS'}});assert.equal(f.calls,1);assert.deepEqual(f.stats(),{spent_micros:0,reserved_micros:100});}
  else assert.equal(f.dump(),before);
 });
 test(`D1 daily ${label}: status failure after settlement cannot erase cached response or double charge`,async t=>{
  const f=await setup(t,message),runtime=await createTutorRuntime(f.options);const success=await f.send(runtime);assert.equal(success.status,200);assert.equal((await success.json()).result.answer,'4');assert.equal(f.calls,1);assert.equal(f.successfulProviderResponses,1);const before=f.dump();f.arm('status');await unavailable(await f.send(runtime,true));assert.equal(f.hits,1);assert.equal(f.dump(),before);f.arm(null);assert.equal((await f.send(await createTutorRuntime(f.options))).status,200);assert.equal(f.calls,1);assert.deepEqual(f.stats(),{spent_micros:100,reserved_micros:0});assert.equal(f.claims().length,1);
 });
 test(`D1 daily ${label}: opt-in client makes one call, preserves input, never caches a false success`,async t=>{
  const f=await setup(t,message),runtime=await createTutorRuntime(f.options),client=f.client(runtime),query=Object.freeze({requestId:'one',intent:'check'}),before=JSON.stringify(query);t.after(()=>client.dispose());
  f.arm('settle-write');await assert.rejects(client.dialogue(query),e=>e.code==='LEDGER_UNAVAILABLE'&&e.message==='LEDGER_UNAVAILABLE');assert.equal(f.transportCalls,1);assert.equal(f.calls,1);assert.equal(f.successfulProviderResponses,1);assert.equal(f.hits,1);assert.equal(JSON.stringify(query),before);assert.deepEqual(f.stats(),{spent_micros:0,reserved_micros:100});
  f.arm(null);await assert.rejects(client.dialogue(query),{code:'IN_PROGRESS'});assert.equal(f.transportCalls,2);assert.equal(f.calls,1);assert.equal(JSON.stringify(query),before);
  f.arm('status');await assert.rejects(client.getStatus(),{code:'LEDGER_UNAVAILABLE'});assert.equal(f.transportCalls,3);assert.equal(f.hits,2);f.arm(null);const status=await client.getStatus();assert.equal(status.status.quota.reservedMicros,100);assert.equal(f.transportCalls,4);
 });
}
