import test from 'node:test';
import assert from 'node:assert/strict';
import {createTutorClient} from '../client/tutor-client.js';
import {dialogueFixture} from '../server/catalogue.js';
import {localDialogueTransport} from '../dist/dialogue-model.js';
const scope={profileId:'A',questionId:'loop:math:0'},input={requestId:'one',intent:'check'};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
const reply=(mode='mock',q={questionId:scope.questionId,intent:input.intent})=>json({ok:true,result:{mode,...dialogueFixture(q)}});
const client=(fetchImpl,more={})=>{const c=createTutorClient({enabled:true,expectedMode:'mock',fetchImpl,...more});c.setScope(scope);return c;};
test('disabled default, explicit fetch/mode only, immutable configuration and strict scopes',async()=>{
 const c=createTutorClient();c.setScope(scope);await assert.rejects(c.getStatus(),{code:'CLIENT_DISABLED'});await assert.rejects(c.dialogue(input),{code:'CLIENT_DISABLED'});
 for(const config of [{enabled:true},{enabled:true,expectedMode:'live'},{enabled:true,fetchImpl:()=>{}},{expectedMode:'deepseek'},{timeoutMs:0},{timeoutMs:30001},{apiKey:'secret'},{get enabled(){assert.fail();}}])assert.throws(()=>createTutorClient(config),{code:'INVALID_CONFIG'});
 for(const s of [{...scope,history:[]},{...scope,profileId:'child'},{...scope,questionId:'loop:math:9'},{get profileId(){assert.fail();},questionId:scope.questionId}])assert.throws(()=>c.setScope(s),{code:'INVALID_REQUEST'});
 c.dispose();assert.throws(()=>c.setScope(scope),{code:'DISPOSED'});
});
test('36 canonical frontend/server answers agree and client checks exact content/mode',async()=>{
 for(const subject of ['math','chinese','english'])for(let i=0;i<3;i++)for(const intent of ['understand','hint','next','check']){
  const query={questionId:`loop:${subject}:${i}`,intent};const {mode,...local}=localDialogueTransport(query);assert.deepEqual(local,dialogueFixture(query));
  const c=client(async()=>reply('protocol-test',query),{expectedMode:'offline-test'});c.setScope({...scope,questionId:query.questionId});const result=await c.dialogue({...input,intent});assert.equal(result.result.mode,'protocol-test');assert.equal(result.requestId,'one');assert.ok(Object.isFrozen(result.result));
 }
 for(const patch of [{mode:'deepseek'},{answer:'99'},{text:'wrong explanation'},{questionId:'loop:math:1'},{intent:'hint'},{followUp:'wrong'},{extra:'secret'}]){
  const c=client(async()=>json({ok:true,result:{mode:'mock',...dialogueFixture({questionId:scope.questionId,intent:'check'}),...patch}}));await assert.rejects(c.dialogue(input),{code:'INVALID_RESPONSE'});
 }
});
test('only fixed relative endpoints, no private text, credentials or browser identity headers',async()=>{
 let calls=0;const c=client(async(path,init)=>{calls++;assert.equal(path,'/api/tutor/dialogue');assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.mode,'same-origin');assert.equal(init.cache,'no-store');assert.deepEqual(Object.keys(init.headers).sort(),['content-type','x-xiaobu-request']);assert.deepEqual(JSON.parse(init.body),{...scope,...input});return reply();});
 for(const value of [{...input,text:'child private text'},{...input,audio:'recording'},{...input,history:[]},{...input,requestId:3},{...input,intent:'free'},{get requestId(){assert.fail();},intent:'check'}])await assert.rejects(c.dialogue(value),{code:'INVALID_REQUEST'});
 assert.equal(calls,0);await c.dialogue(input);assert.equal(calls,1);
});
test('BUSY does not cancel or duplicate; explicit scope change discards late result',async()=>{
 let resolve,calls=0,signal;const c=client(async(_,init)=>{calls++;signal=init.signal;return new Promise(r=>{resolve=r;});});
 const pending=c.dialogue(input);await assert.rejects(c.dialogue({...input,requestId:'two'}),{code:'BUSY'});await assert.rejects(c.getStatus(),{code:'BUSY'});assert.equal(signal.aborted,false);assert.equal(calls,1);
 c.setScope({...scope,profileId:'B'});await assert.rejects(pending,{code:'CANCELLED'});assert.equal(signal.aborted,true);resolve(reply());await new Promise(r=>setTimeout(r,1));assert.equal(calls,1);
});
test('total timeout covers ignored fetch abort and hung body; explicit cancel/external signal/dispose',async()=>{
 for(const fetch of [()=>new Promise(()=>{}),()=>new Response(new ReadableStream({cancel(){return new Promise(()=>{});}}),{headers:{'content-type':'application/json'}})]){const c=client(fetch,{timeoutMs:10});await assert.rejects(c.dialogue(input),{code:'TIMEOUT'});}
 for(const operation of ['cancel','dispose','external']){const c=client(()=>new Promise(()=>{}));const controller=new AbortController();const p=c.dialogue(input,{signal:controller.signal});if(operation==='external')controller.abort();else c[operation]();await assert.rejects(p,{code:'CANCELLED'});}
});
test('bounded parser rejects oversized, malformed, wrong envelopes, redirects and unknown errors without retry',async()=>{
 const candidates=[()=>new Response('x'.repeat(16385),{headers:{'content-type':'application/json'}}),()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'17000'}}),()=>new Response(new Uint8Array([255]),{headers:{'content-type':'application/json'}}),()=>json({ok:true,result:{}}),()=>json({ok:false,error:{code:'secret error'}},503),()=>new Response('{}'),()=>new Response('{',{headers:{'content-type':'application/json'}}),()=>{const r=reply();Object.defineProperty(r,'redirected',{value:true});return r;}];
 for(const make of candidates){let calls=0;const c=client(()=>{calls++;return make();});await assert.rejects(c.dialogue(input));assert.equal(calls,1);}
 const c=client(()=>json({ok:false,error:{code:'BUDGET_EXHAUSTED'}},429));await assert.rejects(c.dialogue(input),{code:'BUDGET_EXHAUSTED'});
});
test('unknown option fields/accessors rejected and late old result cannot overwrite a new scope',async()=>{
 let release,call=0;const c=client(async()=>{call++;if(call===1)return new Promise(r=>release=r);return reply();});
 await assert.rejects(c.getStatus({text:'private'}),{code:'INVALID_REQUEST'});await assert.rejects(c.dialogue(input,{get signal(){assert.fail();}}),{code:'INVALID_REQUEST'});
 const old=c.dialogue(input);c.cancel();await assert.rejects(old,{code:'CANCELLED'});const current=await c.dialogue({...input,requestId:'current'});release(reply('deepseek'));await new Promise(r=>setTimeout(r,1));assert.equal(current.requestId,'current');assert.equal(current.result.mode,'mock');assert.equal(call,2);
});
test('inflight caller mutation cannot alter request ID, intent, or response association',async()=>{
 let release,body;const c=client(async(_,init)=>{body=JSON.parse(init.body);return new Promise(r=>release=r);});
 const mutable={...input};const pending=c.dialogue(mutable);mutable.requestId='different-request';mutable.intent='hint';mutable.text='never sent';release(reply());
 const result=await pending;assert.equal(result.requestId,'one');assert.equal(result.result.intent,'check');assert.deepEqual(body,{...scope,...input});
});
