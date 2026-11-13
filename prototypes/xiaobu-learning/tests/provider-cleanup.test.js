import test from 'node:test';
import assert from 'node:assert/strict';
import {readLimitedJson,createDeepSeekProvider} from '../server/deepseek.js';
const query={questionId:'loop:math:0',intent:'hint'};
const provider=fetchImpl=>createDeepSeekProvider({mode:'offline-test',credential:'synthetic-cleanup-key',fetchImpl,timeoutMs:50});
const next=()=>new Promise(resolve=>setImmediate(resolve));
function streamResponse({chunk,cancelMode='pending',headers={'content-type':'application/json'}}={}){
 let cancels=0,reads=0;
 const body=new ReadableStream({pull(controller){reads++;if(chunk){controller.enqueue(chunk);chunk=null;}},cancel(){cancels++;if(cancelMode==='pending')return new Promise(()=>{});if(cancelMode==='reject')return Promise.reject(Error('synthetic cancellation failure'));throw Error('synthetic synchronous cancellation failure');}},{highWaterMark:0});
 return {response:new Response(body,{headers}),get cancels(){return cancels;},get reads(){return reads;}};
}
test('oversized provider stream rejects immediately without awaiting never-settling cancellation and releases reader',async()=>{
 const f=streamResponse({chunk:new Uint8Array(16385)});
 // Provider deadline is deliberately much longer than this failure, so a
 // TIMEOUT is not allowed to masquerade as the original size rejection.
 await assert.rejects(provider(async()=>f.response).request(query),{code:'RESPONSE_TOO_LARGE'});
 assert.equal(f.cancels,1);assert.equal(f.reads,1);assert.equal(f.response.body.locked,false);
});
test('reader cleanup cannot replace size error when underlying cancellation rejects or throws',async()=>{
 for(const cancelMode of ['reject','throw']){const f=streamResponse({chunk:new Uint8Array(17),cancelMode});await assert.rejects(readLimitedJson(f.response,16),{code:'RESPONSE_TOO_LARGE'});await next();assert.equal(f.cancels,1);assert.equal(f.response.body.locked,false);}
});
test('caller abort cancels a suspended read without waiting for cancellation and releases its lock',async()=>{
 const f=streamResponse(),controller=new AbortController(),pending=readLimitedJson(f.response,16,controller.signal);await next();controller.abort();await assert.rejects(pending,{code:'CANCELLED'});assert.equal(f.cancels,1);assert.equal(f.response.body.locked,false);
});
test('provider timeout aborts a hung read, closes body once and frees lock',async()=>{
 const f=streamResponse();await assert.rejects(provider(async()=>f.response).request(query),{code:'TIMEOUT'});await next();assert.equal(f.cancels,1);assert.equal(f.response.body.locked,false);
});
test('already aborted or oversized declared body never reads and still initiates non-blocking cleanup',async()=>{
 const controller=new AbortController();controller.abort();const aborted=streamResponse();await assert.rejects(readLimitedJson(aborted.response,16,controller.signal),{code:'CANCELLED'});assert.equal(aborted.reads,0);assert.equal(aborted.cancels,1);assert.equal(aborted.response.body.locked,false);
 const large=streamResponse({headers:{'content-length':'17'}});await assert.rejects(readLimitedJson(large.response,16),{code:'RESPONSE_TOO_LARGE'});assert.equal(large.reads,0);assert.equal(large.cancels,1);assert.equal(large.response.body.locked,false);
});
test('successful and malformed closed-body parsing preserve outcomes and leave no reader lock',async()=>{
 for(const text of ['{"ok":true}','{','\u00ff']){const response=new Response(text);if(text.startsWith('{"'))assert.deepEqual(await readLimitedJson(response,64),{ok:true});else await assert.rejects(readLimitedJson(response,64),{code:'INVALID_RESPONSE'});assert.equal(response.body.locked,false);}
});
