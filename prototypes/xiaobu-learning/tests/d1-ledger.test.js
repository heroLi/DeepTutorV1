import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Worker} from 'node:worker_threads';
import {createD1Ledger,createD1LedgerAdmin,isD1Ledger} from '../server/d1-ledger.js';
import {syntheticDialogue} from '../server/catalogue.js';
import {openSqliteD1} from './helpers/sqlite-d1.js';
const NOW=1800000000000;
const query={questionId:'loop:math:0',intent:'hint'};
const claim=(requestId='one',patch={})=>({key:JSON.stringify(['offline-fixture','fixture-owner',requestId]),fingerprint:JSON.stringify(['A',query.questionId,query.intent]),scope:'offline-fixture',currency:'TEST',limitMicros:1000,reservationMicros:100,...patch});
async function setup(t,patch={}){const dir=mkdtempSync(join(tmpdir(),'xiaobu-ledger-')),path=join(dir,'fixture.sqlite');const handles=[];t.after(()=>{for(const h of handles)try{h.close();}catch{}rmSync(dir,{recursive:true,force:true});});const open=()=>{const h=openSqliteD1(path,{migrate:handles.length===0});handles.push(h);return h;};const h=open();let time=NOW;const now=()=>time;const admin=createD1LedgerAdmin({db:h.db,now});await admin.registerProfile({ownerId:'fixture-owner',profileId:'A'});await admin.registerProfile({ownerId:'fixture-owner',profileId:'B'});await admin.registerProfile({ownerId:'other-owner',profileId:'A'});await admin.createScope({scope:'offline-fixture',ownerId:'fixture-owner',currency:'TEST',limitMicros:1000,expiresAtMs:NOW+86400000,...patch});return {...h,admin,path,open,ledger:createD1Ledger({db:h.db,now}),now,setTime:t=>{time=t;},stats:()=>h.connection.prepare('SELECT spent_micros,reserved_micros,frozen FROM tutor_scopes').get()};}
async function parallel(path,inputs,operation='reserveAndClaim'){
 const barrier=new SharedArrayBuffer(4),workers=inputs.map(input=>new Worker(new URL('./helpers/ledger-worker.js',import.meta.url),{workerData:{path,input,operation,barrier,now:NOW}}));let ready=0;
 return Promise.all(workers.map(worker=>new Promise((resolve,reject)=>{worker.on('message',message=>{if(message.ready){ready++;if(ready===workers.length){Atomics.store(new Int32Array(barrier),0,1);Atomics.notify(new Int32Array(barrier),0);}}else resolve(message);});worker.on('error',reject);worker.on('exit',code=>{if(code)reject(Error('worker exit '+code));});})));
}
test('actual SQLite schema, branded adapter and owner/profile records survive reopening',async t=>{
 const f=await setup(t);assert.equal(isD1Ledger(f.ledger),true);assert.equal(isD1Ledger({kind:'durable-atomic'}),false);assert.equal(await f.ledger.assertReady({scope:'offline-fixture',currency:'TEST',limitMicros:1000}),true);assert.equal(await f.ledger.authorizeProfile({id:'fixture-owner'},'B'),true);assert.equal(await f.ledger.authorizeProfile({id:'absent'},'B'),false);
 const first=await f.ledger.reserveAndClaim(claim());f.close();const reopened=f.open(),ledger=createD1Ledger({db:reopened.db,now:f.now});await assert.rejects(ledger.reserveAndClaim(claim()),{code:'IN_PROGRESS'});await ledger.settle({token:first.token,chargeMicros:100,result:await syntheticDialogue(query),errorCode:null});assert.equal((await ledger.reserveAndClaim(claim())).kind,'cached');assert.equal(reopened.connection.prepare('SELECT spent_micros FROM tutor_scopes').get().spent_micros,100);
});
test('two worker threads contend for the last budget reservation; exactly one succeeds',async t=>{
 const f=await setup(t,{maxInflight:10});const result=await parallel(f.path,[claim('a',{reservationMicros:1000}),claim('b',{reservationMicros:1000})]);assert.equal(result.filter(r=>r.ok).length,1);assert.equal(result.find(r=>!r.ok).code,'BUDGET_EXHAUSTED');assert.equal(f.stats().reserved_micros,1000);assert.equal(f.stats().spent_micros,0);
});
test('concurrent identical request claims exactly once across independent database connections',async t=>{
 const f=await setup(t);const result=await parallel(f.path,[claim(),claim()]);assert.equal(result.filter(r=>r.ok).length,1);assert.equal(result.find(r=>!r.ok).code,'IN_PROGRESS');assert.equal(f.stats().reserved_micros,100);assert.equal(f.connection.prepare('SELECT count(*) AS n FROM tutor_claims').get().n,1);
});
test('settlement is full-charge and idempotent, including cross-thread duplicates',async t=>{
 const f=await setup(t);const a=await f.ledger.reserveAndClaim(claim());const value={token:a.token,chargeMicros:100,result:await syntheticDialogue(query),errorCode:null};await assert.rejects(f.ledger.settle({...value,chargeMicros:0}),{code:'INVALID_REQUEST'});await assert.rejects(f.ledger.settle({...value,chargeMicros:99}),{code:'SETTLEMENT_CONFLICT'});assert.equal(f.stats().reserved_micros,100);
 const results=await parallel(f.path,[value,value],'settle');assert.ok(results.every(r=>r.ok));assert.equal(f.stats().spent_micros,100);assert.equal(f.stats().reserved_micros,0);await assert.rejects(f.ledger.settle({...value,result:null,errorCode:'TIMEOUT'}),{code:'SETTLEMENT_CONFLICT'});
});
test('cached error survives restart, changed fingerprint conflicts, cache consumes no new rate slot',async t=>{
 const f=await setup(t,{maxRequests:1});const a=await f.ledger.reserveAndClaim(claim());await f.ledger.settle({token:a.token,chargeMicros:100,result:null,errorCode:'TIMEOUT'});const second=f.open(),ledger=createD1Ledger({db:second.db,now:f.now});assert.deepEqual(await ledger.reserveAndClaim(claim()),{kind:'cached',errorCode:'TIMEOUT',result:null});await assert.rejects(ledger.reserveAndClaim(claim('one',{fingerprint:JSON.stringify(['B',query.questionId,query.intent])})),{code:'IDEMPOTENCY_CONFLICT'});await assert.rejects(ledger.reserveAndClaim(claim('two')),{code:'RATE_LIMIT'});assert.equal(f.stats().spent_micros,100);
});
test('owner, currency, limit and active profile are checked within the reservation transaction',async t=>{
 const f=await setup(t);for(const input of [claim('x',{key:JSON.stringify(['offline-fixture','other-owner','x'])}),claim('x',{currency:'CNY'}),claim('x',{limitMicros:999})])await assert.rejects(f.ledger.reserveAndClaim(input),e=>['FORBIDDEN','SCOPE_MISMATCH'].includes(e.code));
 f.connection.prepare("UPDATE tutor_profiles SET active=0 WHERE owner_id='fixture-owner' AND profile_id='A'").run();assert.equal(await f.ledger.authorizeProfile({id:'fixture-owner'},'A'),false);await f.admin.registerProfile({ownerId:'fixture-owner',profileId:'A'});assert.equal(await f.ledger.authorizeProfile({id:'fixture-owner'},'A'),false);await assert.rejects(f.ledger.reserveAndClaim(claim()),{code:'FORBIDDEN'});assert.equal(f.stats().reserved_micros,0);
});
test('inflight limits persist through restarts, expiration never refunds and frozen scope stays frozen',async t=>{
 const f=await setup(t,{maxInflight:1});await f.ledger.reserveAndClaim(claim());const second=f.open(),ledger=createD1Ledger({db:second.db,now:f.now});await assert.rejects(ledger.reserveAndClaim(claim('two')),{code:'INFLIGHT_LIMIT'});f.setTime(NOW+86400000);await assert.rejects(ledger.reserveAndClaim(claim('two')),{code:'SCOPE_EXPIRED'});assert.equal(f.stats().reserved_micros,100);f.setTime(NOW);await ledger.freezeScope('offline-fixture');await assert.rejects(ledger.reserveAndClaim(claim()),{code:'SCOPE_FROZEN'});await assert.rejects(f.admin.createScope({scope:'offline-fixture',ownerId:'fixture-owner',currency:'TEST',limitMicros:1000,expiresAtMs:NOW+86400000}));assert.equal(f.stats().frozen,1);assert.equal(f.stats().reserved_micros,100);
});
test('rolling rate window boundary is exact and clock rollback fails closed',async t=>{
 const f=await setup(t,{maxRequests:1,windowMs:1000});const a=await f.ledger.reserveAndClaim(claim());await f.ledger.settle({token:a.token,chargeMicros:100,result:null,errorCode:'CANCELLED'});f.setTime(NOW+999);await assert.rejects(f.ledger.reserveAndClaim(claim('two')),{code:'RATE_LIMIT'});f.setTime(NOW+1000);await f.ledger.reserveAndClaim(claim('two'));f.setTime(NOW+999);await assert.rejects(f.ledger.reserveAndClaim(claim('three')),{code:'CLOCK_INVALID'});
});
test('database guards reject claim rewrites/deletes and scope cap reset; statement batch rolls back',async t=>{
 const f=await setup(t);await f.ledger.reserveAndClaim(claim());for(const sql of ["UPDATE tutor_claims SET token='replacement'","DELETE FROM tutor_claims","UPDATE tutor_scopes SET limit_micros=2000","DELETE FROM tutor_scopes"])assert.throws(()=>f.connection.exec(sql));assert.equal(f.stats().reserved_micros,100);
 await assert.rejects(f.db.batch([f.db.prepare("UPDATE tutor_scopes SET frozen=1").bind(),f.db.prepare("UPDATE tutor_scopes SET limit_micros=2000").bind()]));assert.equal(f.stats().frozen,0);
});
test('invalid objects, canonical answers and unsafe SQL/provider errors are rejected without leaking',async t=>{
 const f=await setup(t);for(const patch of [{key:'not-json'},{key:JSON.stringify(['wrong','fixture-owner','one'])},{fingerprint:JSON.stringify(['C',query.questionId,query.intent])},{reservationMicros:1.5},{reservationMicros:1001},{currency:'EUR'}])await assert.rejects(f.ledger.reserveAndClaim(claim('one',patch)),{code:'INVALID_REQUEST'});const a=await f.ledger.reserveAndClaim(claim());await assert.rejects(f.ledger.settle({token:a.token,chargeMicros:100,result:{...await syntheticDialogue(query),text:'arbitrary unreviewed text'},errorCode:null}),{code:'INVALID_RESPONSE'});assert.equal(f.stats().reserved_micros,100);
 const bad=createD1Ledger({db:{prepare(){return {bind(){return {};}};},async batch(){throw Error('private-query credential=do-not-leak');}}});await assert.rejects(bad.authorizeProfile({id:'fixture-owner'},'A'),e=>e.code==='LEDGER_UNAVAILABLE'&&!e.message.includes('private'));
});
test('provisioning rejects reused scopes, invalid future periods and simulated money confusion',async t=>{
 const f=await setup(t);const config={scope:'approved-period',ownerId:'fixture-owner',currency:'CNY',limitMicros:1000,expiresAtMs:NOW+86400000};await f.admin.createScope(config);await assert.rejects(f.admin.createScope({...config,limitMicros:2000}));for(const patch of [{currency:'TEST'},{scope:'offline-fixture',currency:'CNY'},{expiresAtMs:NOW},{expiresAtMs:NOW+2678400001},{maxInflight:0},{limitMicros:Number.MAX_SAFE_INTEGER}])await assert.rejects(f.admin.createScope({...config,scope:'new-period',...patch}),{code:'INVALID_CONFIG'});
});

test('lost response after committed reservation leaves a durable pending claim, never a retryable free slot',async t=>{
 const f=await setup(t);let lose=true;const db={prepare:sql=>f.db.prepare(sql),async batch(statements){const result=await f.db.batch(statements);if(lose&&statements[0].sql.startsWith('INSERT OR IGNORE INTO tutor_claims')){lose=false;throw Error('connection lost after commit');}return result;}};
 const ledger=createD1Ledger({db,now:f.now});await assert.rejects(ledger.reserveAndClaim(claim()),{code:'LEDGER_UNAVAILABLE'});assert.equal(f.stats().reserved_micros,100);await assert.rejects(f.ledger.reserveAndClaim(claim()),{code:'IN_PROGRESS'});assert.equal(f.connection.prepare('SELECT count(*) AS n FROM tutor_claims').get().n,1);
});
test('lost response after committed settlement preserves exactly-once full charge on retry',async t=>{
 const f=await setup(t),a=await f.ledger.reserveAndClaim(claim());let lose=true;const db={prepare:sql=>f.db.prepare(sql),async batch(statements){const result=await f.db.batch(statements);if(lose&&statements[0].sql.startsWith('UPDATE tutor_claims')){lose=false;throw Error('connection lost after settlement');}return result;}};
 const ledger=createD1Ledger({db,now:f.now}),value={token:a.token,chargeMicros:100,result:null,errorCode:'TIMEOUT'};await assert.rejects(ledger.settle(value),{code:'LEDGER_UNAVAILABLE'});assert.equal(f.stats().spent_micros,100);assert.equal(f.stats().reserved_micros,0);assert.equal(await f.ledger.settle(value),true);assert.equal(f.stats().spent_micros,100);assert.equal((await f.ledger.reserveAndClaim(claim())).errorCode,'TIMEOUT');
});
