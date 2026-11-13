import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqliteD1} from './helpers/sqlite-d1.js';
import {createD1Ledger,createD1LedgerAdmin} from '../server/d1-ledger.js';
const NOW=1800000000000;
const options={scope:'offline-fixture',principalId:'fixture-owner',currency:'TEST',limitMicros:1000,reservationMicros:100};
const claim=(id,reservationMicros=100)=>({scope:'offline-fixture',currency:'TEST',limitMicros:1000,reservationMicros,key:JSON.stringify(['offline-fixture','fixture-owner',id]),fingerprint:JSON.stringify(['A','loop:math:0','hint'])});
async function setup(t,config={}){const dir=mkdtempSync(join(tmpdir(),'xiaobu-status-')),h=openSqliteD1(join(dir,'fixture.sqlite'),{migrate:true});t.after(()=>{h.close();rmSync(dir,{recursive:true,force:true});});let time=NOW;const now=()=>time,admin=createD1LedgerAdmin({db:h.db,now});await admin.registerProfile({ownerId:'fixture-owner',profileId:'A'});await admin.createScope({scope:'offline-fixture',ownerId:'fixture-owner',currency:'TEST',limitMicros:1000,expiresAtMs:NOW+60000,...config});return {...h,admin,ledger:createD1Ledger({db:h.db,now}),now,setTime:v=>{time=v;}};}
const state=f=>JSON.stringify(['tutor_scopes','tutor_profiles','tutor_claims'].map(table=>f.connection.prepare('SELECT * FROM '+table).all()));
test('status is bounded, owner-scoped and explicitly conservative accounting, not a provider bill',async t=>{
 const f=await setup(t),s=await f.ledger.getScopeStatus(options);assert.deepEqual(s,{currency:'TEST',unit:'TEST-microunits',accounting:'conservative-reservations-not-provider-bill',capMicros:1000,spentMicros:0,reservedMicros:0,availableMicros:1000,nextReservationMicros:100,pendingCount:0,inflightLimit:2,recentRequestCount:0,requestLimit:20,windowMs:60000,frozen:false,expired:false,clockValid:true,quotaAllowed:true,inflightAllowed:true,rateAllowed:true,canRequest:true,reasons:[],observedAtMs:NOW,expiresAtMs:NOW+60000});assert.equal(Object.isFrozen(s),true);assert.equal(Object.isFrozen(s.reasons),true);assert.doesNotMatch(JSON.stringify(s),/fixture-owner|offline-fixture|claim_key|fingerprint|token/);
});
test('one SELECT transaction snapshot returns counts and balances without changing any record',async t=>{
 const f=await setup(t);const a=await f.ledger.reserveAndClaim(claim('one'));await f.ledger.settle({token:a.token,chargeMicros:100,result:null,errorCode:'TIMEOUT'});const b=await f.ledger.reserveAndClaim(claim('two'));f.setTime(NOW+1000);const before=state(f);let calls=0;
 const db={prepare:sql=>f.db.prepare(sql),async batch(statements){calls++;assert.equal(statements.length,1);assert.match(statements[0].sql,/^SELECT /);assert.match(statements[0].sql,/s\.scope=\? AND s\.owner_id=\?/);return f.db.batch(statements);}};
 const ledger=createD1Ledger({db,now:f.now}),s=await ledger.getScopeStatus(options);assert.equal(calls,1);assert.equal(s.spentMicros,100);assert.equal(s.reservedMicros,100);assert.equal(s.availableMicros,800);assert.equal(s.pendingCount,1);assert.equal(s.recentRequestCount,2);assert.equal(state(f),before);assert.ok(!JSON.stringify(s).includes(b.token));
});
test('wrong owner and unknown scope are indistinguishable, without amounts or configuration leakage',async t=>{
 const f=await setup(t);for(const patch of [{principalId:'someone-else'},{scope:'unknown-scope'},{principalId:'someone-else',currency:'USD',limitMicros:999}])await assert.rejects(f.ledger.getScopeStatus({...options,...patch}),e=>e.code==='FORBIDDEN'&&e.message==='FORBIDDEN');
 for(const patch of [{currency:'CNY'},{limitMicros:2000}])await assert.rejects(f.ledger.getScopeStatus({...options,...patch}),{code:'SCOPE_MISMATCH'});assert.equal((await f.ledger.getScopeStatus(options)).capMicros,1000);
});
test('frozen, expired and quota/rate/inflight stopped states remain inspectable without unfreezing',async t=>{
 const f=await setup(t,{maxInflight:1,maxRequests:1});await f.ledger.reserveAndClaim(claim('one',1000));let s=await f.ledger.getScopeStatus(options);assert.deepEqual(s.reasons,['BUDGET_EXHAUSTED','INFLIGHT_LIMIT','RATE_LIMIT']);assert.equal(s.canRequest,false);assert.equal(s.quotaAllowed,false);assert.equal(s.inflightAllowed,false);assert.equal(s.rateAllowed,false);
 await f.ledger.freezeScope('offline-fixture');f.setTime(NOW+60000);const before=state(f);s=await f.ledger.getScopeStatus(options);assert.deepEqual(s.reasons,['SCOPE_FROZEN','SCOPE_EXPIRED','BUDGET_EXHAUSTED','INFLIGHT_LIMIT']);assert.equal(s.expired,true);assert.equal(s.frozen,true);assert.equal(s.reservedMicros,1000);assert.equal(state(f),before);
});
test('invalid or rolled-back clocks are represented honestly and never grant request readiness',async t=>{
 const f=await setup(t);for(const invalid of [NaN,-1,1.5,Infinity,undefined]){const ledger=createD1Ledger({db:f.db,now:()=>invalid}),s=await ledger.getScopeStatus(options);assert.equal(s.clockValid,false);assert.equal(s.canRequest,false);assert.equal(s.observedAtMs,null);assert.equal(s.expired,null);assert.equal(s.recentRequestCount,null);assert.equal(s.rateAllowed,false);assert.deepEqual(s.reasons,['CLOCK_INVALID']);}
 const throwing=createD1Ledger({db:f.db,now:()=>{throw Error('opaque');}});assert.equal((await throwing.getScopeStatus(options)).observedAtMs,null);f.setTime(NOW+100);await f.ledger.reserveAndClaim(claim('one'));f.setTime(NOW);const s=await f.ledger.getScopeStatus(options);assert.equal(s.clockValid,false);assert.equal(s.observedAtMs,NOW);assert.equal(s.canRequest,false);assert.deepEqual(s.reasons,['CLOCK_INVALID']);
});
test('rolling window boundary matches reservation guard and no pending expiry is implied',async t=>{
 const f=await setup(t,{maxRequests:1,windowMs:1000});const a=await f.ledger.reserveAndClaim(claim('one'));await f.ledger.settle({token:a.token,chargeMicros:100,result:null,errorCode:'CANCELLED'});f.setTime(NOW+999);assert.equal((await f.ledger.getScopeStatus(options)).rateAllowed,false);f.setTime(NOW+1000);const s=await f.ledger.getScopeStatus(options);assert.equal(s.recentRequestCount,0);assert.equal(s.rateAllowed,true);assert.equal(s.canRequest,true);assert.equal(s.windowResetsAtMs,undefined);
});
test('next reservation is evaluated against persisted remaining quota, including oversized requests',async t=>{
 const f=await setup(t);const a=await f.ledger.reserveAndClaim(claim('one',900));await f.ledger.settle({token:a.token,chargeMicros:900,result:null,errorCode:'TIMEOUT'});assert.equal((await f.ledger.getScopeStatus(options)).quotaAllowed,true);const s=await f.ledger.getScopeStatus({...options,reservationMicros:101});assert.equal(s.availableMicros,100);assert.equal(s.quotaAllowed,false);assert.deepEqual(s.reasons,['BUDGET_EXHAUSTED']);assert.equal((await f.ledger.getScopeStatus({...options,reservationMicros:1001})).canRequest,false);
});
test('status rejects extra fields/getters and sanitizes database failures',async t=>{
 const f=await setup(t);for(const patch of [{principalId:''},{scope:'../scope'},{currency:'EUR'},{reservationMicros:0},{limitMicros:1.5},{freeText:'not part of this API'}])await assert.rejects(f.ledger.getScopeStatus({...options,...patch}),{code:'INVALID_REQUEST'});const getter={...options};Object.defineProperty(getter,'scope',{get(){assert.fail('must not execute getter');}});await assert.rejects(f.ledger.getScopeStatus(getter),{code:'INVALID_REQUEST'});
 const bad=createD1Ledger({db:{prepare(){return {bind(){return {};}};},async batch(){throw Error('private SQL: owner=fixture-owner');}}});await assert.rejects(bad.getScopeStatus(options),e=>e.code==='LEDGER_UNAVAILABLE'&&e.message==='LEDGER_UNAVAILABLE');
});
test('CNY scopes retain currency while declaring conservative rather than actual charged amounts',async t=>{
 const f=await setup(t);await f.admin.createScope({scope:'synthetic-cny-period',ownerId:'fixture-owner',currency:'CNY',limitMicros:2000,expiresAtMs:NOW+60000});const s=await f.ledger.getScopeStatus({...options,scope:'synthetic-cny-period',currency:'CNY',limitMicros:2000});assert.equal(s.unit,'CNY-microunits');assert.equal(s.capMicros,2000);assert.equal(s.accounting,'conservative-reservations-not-provider-bill');assert.equal(s.spentMicros,0);
});
