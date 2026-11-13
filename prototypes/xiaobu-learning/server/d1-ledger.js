// Trusted server-only D1 binding. No database provisioning, schema writes or HTTP admin routes.
// D1 batch is transactional; each mutation's SQL triggers enforce bounds atomically.
import {exactObject, dialogueFixture, validateDialogue, fault} from './catalogue.js';
const branded = new WeakSet();
const KEY=/^[A-Za-z0-9_-]{1,64}$/, SCOPE=/^[A-Za-z0-9_-]{1,100}$/;
const CURRENCIES=['TEST','CNY','USD'], ERROR_CODES=['CANCELLED','TIMEOUT','INVALID_RESPONSE','RESPONSE_TOO_LARGE','PROVIDER_UNAVAILABLE','COST_BOUND_EXCEEDED','PRICING_EXPIRED'];
const DB_CODES=['FORBIDDEN','SCOPE_MISMATCH','SCOPE_FROZEN','SCOPE_EXPIRED','CLOCK_INVALID','IDEMPOTENCY_CONFLICT','BUDGET_EXHAUSTED','INFLIGHT_LIMIT','RATE_LIMIT','SETTLEMENT_CONFLICT'];
const money=n=>Number.isSafeInteger(n)&&n>0&&n<=1e12;
const text=(s,re)=>typeof s==='string'&&re.test(s);
function checkedDb(db){if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function')throw fault('INVALID_CONFIG');return db;}
function clock(now){const value=now();if(!Number.isSafeInteger(value)||value<0)throw fault('CLOCK_INVALID');return value;}
function safeDbError(error){const code=DB_CODES.find(c=>String(error?.message).includes('TUTOR_'+c));return fault(code||'LEDGER_UNAVAILABLE');}
async function batch(db,statements){try{const result=await db.batch(statements);if(!Array.isArray(result)||result.length!==statements.length||result.some(r=>r.success!==true||!Array.isArray(r.results)))throw Error('invalid database result');return result;}catch(error){throw safeDbError(error);}}
async function rows(db,sql,...args){return (await batch(db,[db.prepare(sql).bind(...args)]))[0].results;}
function parseArray(value,size){if(typeof value!=='string'||value.length>512)throw fault('INVALID_REQUEST');let a;try{a=JSON.parse(value);}catch{throw fault('INVALID_REQUEST');}if(!Array.isArray(a)||a.length!==size||JSON.stringify(a)!==value)throw fault('INVALID_REQUEST');return a;}
function resultValue(value,query){if(!exactObject(value,['mode','questionId','intent','text','followUp','answer'])||!['mock','protocol-test','deepseek'].includes(value.mode))throw fault('INVALID_RESPONSE');const {mode,...rest}=value;return {mode,...validateDialogue(rest,query)};}
function checkScope(row,{currency,limitMicros,ownerId},time){if(!row||row.currency!==currency||row.limit_micros!==limitMicros||(ownerId!==undefined&&row.owner_id!==ownerId))throw fault('SCOPE_MISMATCH');if(row.frozen)throw fault('SCOPE_FROZEN');if(time>=row.expires_ms)throw fault('SCOPE_EXPIRED');if(time<row.last_seen_ms)throw fault('CLOCK_INVALID');}
export function isD1Ledger(value){return branded.has(value);}
export function createD1Ledger({db,now=Date.now}={}){
 checkedDb(db);if(typeof now!=='function')throw fault('INVALID_CONFIG');
 const ledger=Object.freeze({kind:'durable-atomic',
  async assertReady({scope,currency,limitMicros,ownerId}={}){if(!text(scope,SCOPE)||!CURRENCIES.includes(currency)||!money(limitMicros)||(ownerId!==undefined&&!text(ownerId,KEY)))throw fault('INVALID_CONFIG');const [row]=await rows(db,'SELECT * FROM tutor_scopes WHERE scope=?',scope);checkScope(row,{currency,limitMicros,ownerId},clock(now));return true;},
  async authorizeProfile(principal,profileId){if(!text(principal?.id,KEY)||!['A','B'].includes(profileId))return false;const found=await rows(db,'SELECT active FROM tutor_profiles WHERE owner_id=? AND profile_id=?',principal.id,profileId);return found.length===1&&found[0].active===1;},
  async reserveAndClaim({key,fingerprint,scope,currency,limitMicros,reservationMicros}={}){
   if(!text(scope,SCOPE)||!CURRENCIES.includes(currency)||!money(limitMicros)||!money(reservationMicros)||reservationMicros>limitMicros)throw fault('INVALID_REQUEST');
   const [keyScope,principalId,requestId]=parseArray(key,3),[profileId,questionId,intent]=parseArray(fingerprint,3);
   if(keyScope!==scope||!text(principalId,KEY)||!text(requestId,KEY)||!['A','B'].includes(profileId))throw fault('INVALID_REQUEST');dialogueFixture({questionId,intent});
   const time=clock(now),token=crypto.randomUUID();
   const results=await batch(db,[db.prepare(`INSERT OR IGNORE INTO tutor_claims(claim_key,token,scope,principal_id,profile_id,request_id,fingerprint,currency,requested_limit,reservation_micros,created_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(key,token,scope,principalId,profileId,requestId,fingerprint,currency,limitMicros,reservationMicros,time),db.prepare('SELECT * FROM tutor_claims WHERE claim_key=?').bind(key)]);
   const row=results[1].results[0];if(!row||row.fingerprint!==fingerprint)throw fault('LEDGER_UNAVAILABLE');
   if(row.token===token)return {kind:'claimed',token};
   if(row.state!=='settled')throw fault('IN_PROGRESS');
   if(row.error_code){if(!ERROR_CODES.includes(row.error_code))throw fault('LEDGER_UNAVAILABLE');return {kind:'cached',errorCode:row.error_code,result:null};}
   let value;try{value=JSON.parse(row.result_json);}catch{throw fault('LEDGER_UNAVAILABLE');}
   return {kind:'cached',result:resultValue(value,{questionId,intent})};
  },
  async settle({token,chargeMicros,result,errorCode}={}){
   if(typeof token!=='string'||!/^[a-f0-9-]{36}$/.test(token)||!money(chargeMicros)||!((result!==null&&result!==undefined&&errorCode===null)||(result===null&&ERROR_CODES.includes(errorCode))))throw fault('INVALID_REQUEST');
   const [before]=await rows(db,'SELECT * FROM tutor_claims WHERE token=?',token);if(!before)throw fault('LEDGER_UNAVAILABLE');if(chargeMicros!==before.reservation_micros)throw fault('SETTLEMENT_CONFLICT');
   const [,questionId,intent]=parseArray(before.fingerprint,3);const encoded=result===null?null:JSON.stringify(resultValue(result,{questionId,intent}));
   const values=await batch(db,[db.prepare(`UPDATE tutor_claims SET state='settled',charge_micros=?,result_json=?,error_code=? WHERE token=? AND state='pending'`).bind(chargeMicros,encoded,errorCode,token),db.prepare('SELECT state,charge_micros,result_json,error_code FROM tutor_claims WHERE token=?').bind(token)]);
   const row=values[1].results[0];if(!row||row.state!=='settled'||row.charge_micros!==chargeMicros||row.result_json!==encoded||row.error_code!==errorCode)throw fault('SETTLEMENT_CONFLICT');
   return true;
  },
  async freezeScope(scope){if(!text(scope,SCOPE))throw fault('INVALID_REQUEST');const result=await batch(db,[db.prepare('UPDATE tutor_scopes SET frozen=1 WHERE scope=?').bind(scope),db.prepare('SELECT frozen FROM tutor_scopes WHERE scope=?').bind(scope)]);if(result[1].results[0]?.frozen!==1)throw fault('SCOPE_MISMATCH');return true;}
 });branded.add(ledger);return ledger;
}
// Operator-only provisioning. Never mount this object in an HTTP route or client module.
// Existing approval references cannot be reused, reset, extended or increased.
export function createD1LedgerAdmin({db,now=Date.now}={}){
 checkedDb(db);if(typeof now!=='function')throw fault('INVALID_CONFIG');
 return Object.freeze({
  async registerProfile({ownerId,profileId}={}){if(!text(ownerId,KEY)||!['A','B'].includes(profileId))throw fault('INVALID_CONFIG');await batch(db,[db.prepare('INSERT INTO tutor_profiles(owner_id,profile_id) VALUES(?,?) ON CONFLICT(owner_id,profile_id) DO NOTHING').bind(ownerId,profileId)]);return true;},
  async createScope({scope,ownerId,currency,limitMicros,expiresAtMs,maxInflight=2,maxRequests=20,windowMs=60000}={}){
   const time=clock(now);if(!text(scope,SCOPE)||!text(ownerId,KEY)||!CURRENCIES.includes(currency)||!money(limitMicros)||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=time||expiresAtMs-time>2678400000||!Number.isInteger(maxInflight)||maxInflight<1||maxInflight>100||!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>1000||!Number.isInteger(windowMs)||windowMs<1000||windowMs>86400000||(scope==='offline-fixture')!==(currency==='TEST'))throw fault('INVALID_CONFIG');
   // A unique-key failure is deliberately not retried or treated as a fresh approval.
   await batch(db,[db.prepare(`INSERT INTO tutor_scopes(scope,owner_id,currency,limit_micros,created_ms,expires_ms,max_inflight,max_requests,window_ms,last_seen_ms) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(scope,ownerId,currency,limitMicros,time,expiresAtMs,maxInflight,maxRequests,windowMs,time)]);return true;
  }
 });
}
