import test from 'node:test';
import assert from 'node:assert/strict';
import {createTutorClient} from '../client/tutor-client.js';
import {dialogueFixture} from '../server/catalogue.js';
const scope={profileId:'A',questionId:'loop:math:0'},input={requestId:'one',intent:'check'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const good=()=>new Response(JSON.stringify({ok:true,result:{mode:'mock',...dialogueFixture({questionId:scope.questionId,intent:'check'})}}),{headers:{'content-type':'application/json'}});
function makeClient(fetchImpl,timeoutMs=1000){const c=createTutorClient({enabled:true,expectedMode:'mock',fetchImpl,timeoutMs});c.setScope(scope);return c;}
function tracked({headers={'content-type':'application/json'},cancel=()=>{},redirected=false}={}){
 let cancels=0,readers=0;
 const body=new ReadableStream({cancel(){cancels++;return cancel();}});
 const original=body.getReader.bind(body);body.getReader=(...args)=>{readers++;return original(...args);};
 const response=new Response(body,{headers});if(redirected)Object.defineProperty(response,'redirected',{value:true});
 return {response,body,get cancels(){return cancels;},get readers(){return readers;}};
}
for(const action of ['cancel','timeout','dispose','scope'])test('late response after '+action+' is cancelled exactly once without acquiring a reader',async()=>{
 let release;const c=makeClient(()=>new Promise(resolve=>release=resolve),action==='timeout'?10:1000);
 const pending=c.dialogue(input);const rejected=assert.rejects(pending,{code:action==='timeout'?'TIMEOUT':'CANCELLED'});
 if(action==='scope')c.setScope({...scope,profileId:'B'});else if(action!=='timeout')c[action]();
 await rejected;const late=tracked();release(late.response);await tick();assert.equal(late.cancels,1);assert.equal(late.readers,0);assert.equal(late.body.locked,false);c.dispose();
});
for(const [name,options,code] of [
 ['content type',{headers:{'content-type':'text/plain'}},'INVALID_RESPONSE'],
 ['redirect',{redirected:true},'INVALID_RESPONSE'],
 ['oversized length',{headers:{'content-type':'application/json','content-length':'16385'}},'RESPONSE_TOO_LARGE'],
 ['invalid length',{headers:{'content-type':'application/json','content-length':'unknown'}},'RESPONSE_TOO_LARGE']
])test('early '+name+' rejection cancels unread body once',async()=>{
 const response=tracked(options);const c=makeClient(()=>response.response);await assert.rejects(c.dialogue(input),{code});assert.equal(response.readers,0);assert.equal(response.cancels,1);assert.equal(response.body.locked,false);c.dispose();
});
for(const mode of ['never','reject','throw'])test(mode+' cancellation hook cannot delay errors or block next request',async()=>{
 const response=tracked({headers:{'content-type':'text/plain'},cancel:()=>{if(mode==='never')return new Promise(()=>{});if(mode==='reject')return Promise.reject(Error('fixture'));throw Error('fixture');}});
 let calls=0;const c=makeClient(()=>++calls===1?response.response:good());
 await assert.rejects(c.dialogue(input),{code:'INVALID_RESPONSE'});const next=await c.dialogue({...input,requestId:'next'});assert.equal(next.requestId,'next');assert.equal(response.cancels,1);assert.equal(calls,2);c.dispose();await tick();
});
test('hung locked body times out, calls reader cancellation and releases lock despite hanging cancel',async()=>{
 const response=tracked({cancel:()=>new Promise(()=>{})});let calls=0;const c=makeClient(()=>++calls===1?response.response:good(),10);
 await assert.rejects(c.dialogue(input),{code:'TIMEOUT'});assert.equal(response.readers,1);assert.equal(response.cancels,1);assert.equal(response.body.locked,false);
 assert.equal((await c.dialogue({...input,requestId:'next'})).requestId,'next');c.dispose();
});
test('cleanup for an old scope cannot cancel a pending new request or clear its BUSY guard',async()=>{
 let releaseOld,releaseNew,calls=0;const c=makeClient(()=>new Promise(resolve=>{if(++calls===1)releaseOld=resolve;else releaseNew=resolve;}));
 const old=c.dialogue(input);c.setScope({...scope,profileId:'B'});await assert.rejects(old,{code:'CANCELLED'});
 const current=c.dialogue({...input,requestId:'new'}),late=tracked();releaseOld(late.response);await tick();assert.equal(late.cancels,1);
 await assert.rejects(c.dialogue({...input,requestId:'third'}),{code:'BUSY'});releaseNew(good());const value=await current;assert.equal(value.profileId,'B');assert.equal(value.requestId,'new');assert.equal(calls,2);c.dispose();
});
test('success and parser failure both release the body reader lock without altering validation',async()=>{
 for(const [response,error] of [[good(),null],[new Response('{',{headers:{'content-type':'application/json'}}),'INVALID_RESPONSE']]){
  let cancelCalls=0,releaseCalls=0;const getReader=response.body.getReader.bind(response.body);response.body.getReader=()=>{const r=getReader();return {read:()=>r.read(),cancel(){cancelCalls++;return r.cancel();},releaseLock(){releaseCalls++;r.releaseLock();}};};
  const c=makeClient(()=>response);if(error)await assert.rejects(c.dialogue(input),{code:error});else assert.equal((await c.dialogue(input)).result.mode,'mock');
  assert.equal(cancelCalls,1);assert.equal(releaseCalls,1);assert.equal(response.body.locked,false);c.dispose();
 }
});
for(const action of ['cancel','dispose','external'])test('active hung reader releases its lock on '+action,async()=>{
 const response=tracked({cancel:()=>Promise.reject(Error('fixture cancel failure'))});
 const c=makeClient(()=>response.response),signal=new AbortController();
 const pending=c.dialogue(input,{signal:signal.signal});await tick();assert.equal(response.body.locked,true);
 const rejected=assert.rejects(pending,{code:'CANCELLED'});if(action==='external')signal.abort();else c[action]();
 await rejected;assert.equal(response.cancels,1);assert.equal(response.body.locked,false);await tick();c.dispose();
});
