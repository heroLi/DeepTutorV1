import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dialogueFixture, modelInstruction, syntheticDialogue, fault, validateDialogue} from '../server/catalogue.js';
import {createDeepSeekProvider, DEEPSEEK_ENDPOINT, MAX_COMPLETION_TOKENS} from '../server/deepseek.js';
import {createTutorService, validateRequest} from '../server/service.js';
const query={questionId:'loop:math:0',intent:'check'};
const payload=(id='one',patch={})=>({requestId:id,profileId:'A',...query,...patch});
const wire=(value=dialogueFixture(query),patch={})=>({model:'deepseek-flash',usage:{prompt_tokens:200,completion_tokens:100},choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(value)}}],...patch});
const reply=(value=wire(),status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json',...headers}});
const provider=(fetchImpl=async()=>reply(),patch={})=>createDeepSeekProvider({mode:'offline-test',credential:'synthetic-test-key',fetchImpl,timeoutMs:100,...patch});
const request=(body=payload(),headers={},method='POST')=>new Request('https://fixture.test/api/tutor/dialogue',{method,headers:{origin:'https://fixture.test','x-xiaobu-request':'1','content-type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
const authenticate=async()=>({id:'fixture-user'});
const authorizeProfile=async(_,profile)=>profile==='A';
// TEST-ONLY atomic-in-one-process ledger. Never exported as production durability.
function fakeLedger(limit=200) {
 let spent=0,reserved=0,next=1; const entries=new Map(),tokens=new Map();
 return {kind:'test-memory',get stats(){return {spent,reserved,count:entries.size};},
  async reserveAndClaim({key,fingerprint,reservationMicros,limitMicros}) {
   const old=entries.get(key);
   if(old){if(old.fingerprint!==fingerprint)throw fault('IDEMPOTENCY_CONFLICT');if(!old.done)throw fault('IN_PROGRESS');if(old.errorCode)throw fault(old.errorCode);return {kind:'cached',result:old.result};}
   if(reservationMicros>Math.min(limit,limitMicros)-spent-reserved)throw fault('BUDGET_EXHAUSTED');
   const token=String(next++),entry={token,fingerprint,reservationMicros,done:false};entries.set(key,entry);tokens.set(token,entry);reserved+=reservationMicros;return {kind:'claimed',token};
  },async settle({token,chargeMicros,result,errorCode}) {const e=tokens.get(token);assert.ok(e&&!e.done);assert.ok(chargeMicros<=e.reservationMicros);e.done=true;e.result=result;e.errorCode=errorCode;reserved-=e.reservationMicros;spent+=chargeMicros;}
 };
}
const service=(patch={})=>createTutorService({mode:'offline-test',origin:'https://fixture.test',authenticate,authorizeProfile,ledger:fakeLedger(),reservationMicros:100,provider:provider(),...patch});
test('disabled is the default and performs no implicit network or environment read',async()=>{
 const disabled=createDeepSeekProvider();await assert.rejects(disabled.request(query),{code:'LIVE_DISABLED'});
 for(const name of ['catalogue.js','deepseek.js','service.js']){
  const src=readFileSync(new URL('../server/'+name,import.meta.url),'utf8');assert.doesNotMatch(src,/process\.env|globalThis\.fetch|console\.|setInterval\(/);
 }
});
test('nine authored questions and four intents are bounded; arithmetic answers recomputed',()=>{
 for(const subject of ['math','chinese','english'])for(let index=0;index<3;index++)for(const intent of ['understand','hint','next','check']){
  const q={questionId:`loop:${subject}:${index}`,intent},f=dialogueFixture(q);assert.ok(Object.isFrozen(f));assert.equal(f.answer===null,intent!=='check');assert.deepEqual(validateDialogue(f,q),f);
 }
 assert.equal(dialogueFixture(query).answer,'4');assert.equal(dialogueFixture({questionId:'loop:math:1',intent:'check'}).answer,'5');
 assert.throws(()=>dialogueFixture({questionId:'loop:math:99',intent:'check'}),{code:'INVALID_REQUEST'});
});
test('fixed endpoint and explicit HTTP parameters; no identity or free text reaches provider',async()=>{
 let calls=0;const p=provider(async(url,options)=>{calls++;assert.equal(url,DEEPSEEK_ENDPOINT);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.headers.authorization,'Bearer synthetic-test-key');const b=JSON.parse(options.body);assert.deepEqual(b.thinking,{type:'disabled'});assert.equal(b.max_tokens,MAX_COMPLETION_TOKENS);assert.equal(b.stream,false);assert.deepEqual(b.response_format,{type:'json_object'});assert.equal(b.tools,undefined);assert.equal(b.messages.length,2);assert.deepEqual(JSON.parse(b.messages[1].content),modelInstruction(query));return reply();});
 const result=await p.request(query);assert.equal(result.mode,'protocol-test');assert.equal(result.answer,'4');assert.equal(calls,1);
});
test('live construction requires explicit approval, credential and trusted integration dependencies',()=>{
 const approval={provider:'deepseek',syntheticOnly:true,reference:'approved-synthetic-fixture',spendLimitMicros:20000,currency:'CNY'};
 assert.throws(()=>provider(async()=>reply(),{mode:'live'}),{code:'LIVE_NOT_AUTHORIZED'});
 assert.throws(()=>provider(async()=>reply(),{mode:'live',approval}),{code:'PRICING_REQUIRED'});
 for(const patch of [{credential:'bad\nkeyxxxxxxxx'},{model:'arbitrary-model'},{timeoutMs:0},{fetchImpl:undefined}])assert.throws(()=>provider(async()=>reply(),patch),{code:'INVALID_CONFIG'});
 const ledger=fakeLedger();ledger.kind='durable-atomic'; // Test declaration only, explicitly NOT a real durable implementation.
 ledger.freezeScope=async()=>{};const integration={authenticate,authorizeProfile,ledger};
 const pricing={currency:'CNY',model:'deepseek-flash',inputMicrosPerMillion:2000000,outputMicrosPerMillion:8000000,verifiedAt:'2026-11-13T00:00:00.000Z',expiresAt:'2026-11-14T00:00:00.000Z'};const now=()=>Date.parse('2026-11-13T12:00:00.000Z');
 const live=provider(async()=>{throw Error('must not invoke');},{mode:'live',approval,integration,pricing,now});
 assert.doesNotThrow(()=>createTutorService({mode:'live',origin:'https://fixture.test',...integration,provider:live,reservationMicros:12000,approval}));
 assert.throws(()=>createTutorService({mode:'live',origin:'https://fixture.test',...integration,provider:live,reservationMicros:12000,approval:{...approval,spendLimitMicros:30000}}),{code:'LIVE_NOT_READY'});
 assert.throws(()=>createTutorService({mode:'live',origin:'http://fixture.test',...integration,provider:live,reservationMicros:12000,approval}),{code:'LIVE_NOT_READY'});
});
test('HTTP auth, throttling, server errors and redirects never retry or expose body',async()=>{
 for(const status of [301,401,403,429,500,503]){let calls=0;const p=provider(async()=>{calls++;return reply({error:'private-key-or-prompt'},status);});await assert.rejects(p.request(query),e=>e.code==='PROVIDER_UNAVAILABLE'&&!e.message.includes('private'));assert.equal(calls,1);}
});
test('invalid JSON, blank output, truncation, wrong answers, tools and extra fields fail closed',async()=>{
 const base=wire();const cases=[null,{},wire({...dialogueFixture(query),answer:'5'}),wire({...dialogueFixture(query),text:'<script>bad</script>'}),wire({...dialogueFixture(query),extra:'field'}),wire(undefined,{model:'other'}),{...base,choices:[]},wire(undefined,{choices:[{index:0,finish_reason:'length',message:{role:'assistant',content:'{}'}}]}),wire(undefined,{choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'   '}}]}),wire(undefined,{choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'{bad'}}]}),wire(undefined,{choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(dialogueFixture(query)),tool_calls:[]}}]})];
 for(const data of cases)await assert.rejects(provider(async()=>reply(data)).request(query),{code:'INVALID_RESPONSE'});
 await assert.rejects(provider(async()=>new Response('{bad',{headers:{'content-type':'application/json'}})).request(query),{code:'INVALID_RESPONSE'});
 await assert.rejects(provider(async()=>reply(wire(),200,{'content-type':'text/html'})).request(query),{code:'INVALID_RESPONSE'});
});
test('size limits apply with and without declared content length',async()=>{
 await assert.rejects(provider(async()=>reply(wire(),200,{'content-length':'17000'})).request(query),{code:'RESPONSE_TOO_LARGE'});
 await assert.rejects(provider(async()=>new Response(' '.repeat(17000),{headers:{'content-type':'application/json'}})).request(query),{code:'RESPONSE_TOO_LARGE'});
});
test('timeouts cover response body and caller cancellation; late responses cannot become success',async()=>{
 let finish;const p=provider(()=>new Promise(resolve=>finish=resolve),{timeoutMs:5});await assert.rejects(p.request(query),{code:'TIMEOUT'});finish(reply());
 const before=new AbortController();before.abort();let calls=0;await assert.rejects(provider(async()=>{calls++;return reply();}).request(query,{signal:before.signal}),{code:'CANCELLED'});assert.equal(calls,0);
 const active=new AbortController();const pending=provider(()=>new Promise(()=>{})).request(query,{signal:active.signal});active.abort();await assert.rejects(pending,{code:'CANCELLED'});
 const body=new ReadableStream({start(){}});await assert.rejects(provider(async()=>new Response(body,{headers:{'content-type':'application/json'}}),{timeoutMs:5}).request(query),{code:'TIMEOUT'});
});
test('strict request rejects extra fields, free text/audio, special names, getters and arbitrary ids',()=>{
 for(const patch of [{message:'child question'},{audio:'bytes'},{history:[]},{questionId:'__proto__'},{questionId:'loop:math:01'},{intent:'browse'},{profileId:'../B'},{requestId:1}])assert.throws(()=>validateRequest(payload('one',patch)),{code:'INVALID_REQUEST'});
 const obj=payload();Object.defineProperty(obj,'intent',{get(){throw Error('must not run');}});assert.throws(()=>validateRequest(obj),{code:'INVALID_REQUEST'});
});
test('same-origin custom header, method, size and path required before service effects',async()=>{
 const ledger=fakeLedger(),s=service({ledger});
 for(const req of [request(payload(),{origin:'https://evil.test'}),request(payload(),{'x-xiaobu-request':'0'}),request(payload(),{'sec-fetch-site':'cross-site'}),request(payload(),{'content-type':'text/plain'}),request(null,{},'GET'),new Request('https://fixture.test/api/tutor/dialogue?key=x',{method:'POST'}),request(payload('one',{message:'x'.repeat(2000)}))])assert.notEqual((await s.fetch(req)).status,200);
 assert.deepEqual(ledger.stats,{spent:0,reserved:0,count:0});
});
test('authentication and profile ownership checked before reservation and cache hits',async()=>{
 let signedIn=true,authorized=true;const ledger=fakeLedger(),s=service({ledger,authenticate:async()=>signedIn?{id:'fixture-user'}:null,authorizeProfile:async()=>authorized});
 assert.equal((await s.fetch(request())).status,200);signedIn=false;assert.equal((await s.fetch(request())).status,401);signedIn=true;authorized=false;assert.equal((await s.fetch(request())).status,403);assert.equal(ledger.stats.spent,100);
});
test('exact repeat returns cached validated response; changed request conflicts; budget cannot exceed bound',async()=>{
 let calls=0;const ledger=fakeLedger(),s=service({ledger,provider:provider(async()=>{calls++;return reply();})});
 assert.equal((await s.fetch(request())).status,200);assert.equal((await s.fetch(request())).status,200);assert.equal(calls,1);
 assert.equal((await s.fetch(request(payload('one',{intent:'hint'})))).status,409);
 assert.equal((await s.fetch(request(payload('two')))).status,200);assert.equal((await s.fetch(request(payload('three')))).status,429);assert.equal(calls,2);assert.equal(ledger.stats.spent,200);
});
test('parallel reservations and inflight duplicate cannot double-call or overspend',async()=>{
 let release;const gate=new Promise(r=>release=r);let calls=0;const ledger=fakeLedger(100),s=service({ledger,provider:provider(async()=>{calls++;await gate;return reply();})});
 const first=s.fetch(request());await new Promise(r=>setImmediate(r));assert.equal((await s.fetch(request())).status,409);assert.equal((await s.fetch(request(payload('other')))).status,429);release();assert.equal((await first).status,200);assert.equal(calls,1);assert.equal(ledger.stats.spent,100);
});
test('provider failure consumes full reservation once; uncertain settled outcome remains sticky',async()=>{
 let calls=0;const ledger=fakeLedger(),s=service({ledger,provider:provider(async()=>{calls++;throw Error('secret synthetic-test-key');})});
 let response=await s.fetch(request());assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/synthetic-test-key|secret/);response=await s.fetch(request());assert.equal(response.status,502);assert.equal(calls,1);assert.equal(ledger.stats.spent,100);
});
test('settlement failure leaves the claim reserved; no silent retry or refund',async()=>{
 const ledger=fakeLedger();ledger.settle=async()=>{throw Error('database unavailable');};let calls=0;const s=service({ledger,provider:provider(async()=>{calls++;return reply();})});
 assert.equal((await s.fetch(request())).status,500);assert.equal((await s.fetch(request())).status,409);assert.equal(calls,1);assert.equal(ledger.stats.reserved,100);
});
test('mock service uses same contract without provider and returns no-store text-only payload',async()=>{
 const s=service({mode:'mock',provider:undefined}),response=await s.fetch(request());const result=await response.json();assert.equal(result.result.mode,'mock');assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(result.result,await syntheticDialogue(query));
});

test('all nine questions × four intents match the frontend local transport exactly',async()=>{
 const {localDialogueTransport}=await import('../dist/dialogue-model.js');
 for(const subject of ['math','chinese','english'])for(let i=0;i<3;i++)for(const intent of ['understand','hint','next','check']){
  const q={questionId:`loop:${subject}:${i}`,intent};assert.deepEqual(await syntheticDialogue(q),localDialogueTransport(q));assert.notEqual(localDialogueTransport(q).text,localDialogueTransport(q).followUp);
 }
});
test('cost bound is currency-explicit, rounded up and expires; low reservations fail closed',async()=>{
 const {maxCostMicros}=await import('../server/pricing.js');
 const pricing={model:'deepseek-flash',currency:'CNY',inputMicrosPerMillion:2000000,outputMicrosPerMillion:8000000,verifiedAt:'2026-11-13T00:00:00Z',expiresAt:'2026-11-14T00:00:00Z'},now=()=>Date.parse('2026-11-13T12:00:00Z');
 assert.equal(maxCostMicros(pricing,now()),11776);assert.equal(maxCostMicros({...pricing,inputMicrosPerMillion:1,outputMicrosPerMillion:1},now()),1);
 assert.throws(()=>maxCostMicros({...pricing,currency:undefined},now()),{code:'PRICING_REQUIRED'});
 assert.throws(()=>maxCostMicros(pricing,Date.parse(pricing.expiresAt)),{code:'PRICING_EXPIRED'});
 const approval={provider:'deepseek',syntheticOnly:true,reference:'scope-one',spendLimitMicros:20000,currency:'CNY'};
 const ledger={...fakeLedger(20000),kind:'durable-atomic',freezeScope:async()=>{}},integration={authenticate,authorizeProfile,ledger};
 const live=provider(async()=>reply(),{mode:'live',approval,integration,pricing,now});
 assert.throws(()=>createTutorService({mode:'live',origin:'https://fixture.test',...integration,provider:live,reservationMicros:1,approval}),{code:'LIVE_NOT_READY'});
 pricing.outputMicrosPerMillion=1;assert.equal((await import('../server/deepseek.js')).providerCostBound(live),11776);
});
test('cached errors replay as errors; corrupt cache and injected provider output never escape validation',async()=>{
 for(const claim of [{kind:'cached',errorCode:'TIMEOUT',result:null},{kind:'cached',result:{mode:'protocol-test',...dialogueFixture(query),answer:'99'}}]){
  const svc=service({ledger:{reserveAndClaim:async()=>claim,settle:async()=>assert.fail('cache cannot settle')}});const response=await svc.fetch(request());assert.equal(response.status,claim.errorCode?504:502);
 }
 const svc=service({provider:{mode:'offline-test',request:async()=>({mode:'protocol-test',...dialogueFixture(query),text:'untrusted'})}});assert.equal((await svc.fetch(request())).status,502);
});
test('usage beyond conservative token bound freezes live approval scope and keeps charge',async()=>{
 let frozen,seenKey;const base=fakeLedger(20000),ledger={...base,kind:'durable-atomic',freezeScope:async scope=>{frozen=scope;},reserveAndClaim:async input=>{seenKey=input.key;return base.reserveAndClaim(input);}};
 const approval={provider:'deepseek',syntheticOnly:true,reference:'budget-period-two',spendLimitMicros:20000,currency:'CNY'},integration={authenticate,authorizeProfile,ledger};
 const pricing={model:'deepseek-flash',currency:'CNY',inputMicrosPerMillion:2000000,outputMicrosPerMillion:8000000,verifiedAt:'2026-11-13T00:00:00Z',expiresAt:'2026-11-14T00:00:00Z'};
 const live=provider(async()=>reply(wire(undefined,{usage:{prompt_tokens:99999,completion_tokens:1}})),{mode:'live',approval,integration,pricing,now:()=>Date.parse('2026-11-13T12:00:00Z')});
 const svc=createTutorService({mode:'live',origin:'https://fixture.test',...integration,provider:live,reservationMicros:12000,approval});
 assert.equal((await svc.fetch(request())).status,502);assert.equal(frozen,approval.reference);assert.deepEqual(JSON.parse(seenKey),[approval.reference,'fixture-user','one']);assert.equal(base.stats.spent,12000);
});
