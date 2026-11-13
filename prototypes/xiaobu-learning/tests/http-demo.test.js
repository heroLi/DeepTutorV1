import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {PassThrough} from 'node:stream';
import {startHttpDemo,fixtureBody} from '../dev/http-demo.js';
const input={requestId:'one',profileId:'A',questionId:'loop:math:0',intent:'check'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function withDemo(run,options){const demo=await startHttpDemo(options);try{await run(demo);}finally{await demo.close();}}
const get=demo=>fetch(demo.origin+'/api/tutor/status',{headers:{'sec-fetch-site':'same-origin','x-xiaobu-request':'1'}});
const post=(demo,body=input,patch={})=>fetch(demo.origin+'/api/tutor/dialogue',{method:'POST',headers:{origin:demo.origin,'x-xiaobu-request':'1','content-type':'application/json',...patch},body:JSON.stringify(body)});
async function until(check){const deadline=Date.now()+2000;while(!check()){if(Date.now()>deadline)throw Error('fixture condition did not arrive');await sleep(2);}}
test('real HTTP overlapping requests preserve duplicate and inflight limits',()=>withDemo(async demo=>{
 const first=post(demo,{...input,requestId:'parallel-one'});
 await until(()=>demo.providerCalls===1);
 const duplicate=await post(demo,{...input,requestId:'parallel-one'});
 assert.equal(duplicate.status,409);assert.equal((await duplicate.json()).error.code,'IN_PROGRESS');
 const second=post(demo,{...input,requestId:'parallel-two'});
 await until(()=>demo.providerCalls===2);
 const third=await post(demo,{...input,requestId:'parallel-three'});
 assert.equal(third.status,429);assert.equal((await third.json()).error.code,'INFLIGHT_LIMIT');
 const pending=(await (await get(demo)).json()).status.quota;
 assert.equal(pending.pendingCount,2);assert.equal(pending.reservedMicros,200);
 demo.releaseProvider();
 assert.equal((await first).status,200);assert.equal((await second).status,200);
 const final=(await (await get(demo)).json()).status.quota;
 assert.equal(final.pendingCount,0);assert.equal(final.spentMicros,200);assert.equal(final.reservedMicros,0);assert.equal(demo.providerCalls,2);
},{holdProvider:true}));
test('real loopback HTTP composes runtime, SQLite and fake provider with idempotency and quota exhaustion',()=>withDemo(async demo=>{
 let response=await get(demo);assert.equal(response.status,200);let status=(await response.json()).status;assert.equal(status.configuredMode,'offline-test');assert.equal(status.quota.currency,'TEST');assert.equal(status.quota.availableMicros,1000);
 for(let i=0;i<2;i++){response=await post(demo);assert.equal(response.status,200);assert.equal((await response.json()).result.mode,'protocol-test');}assert.equal(demo.providerCalls,1);
 for(let i=1;i<10;i++)assert.equal((await post(demo,{...input,requestId:'request'+i})).status,200);
 assert.equal((await post(demo,{...input,requestId:'eleven'})).status,429);status=(await (await get(demo)).json()).status;assert.equal(status.quota.spentMicros,1000);assert.equal(status.quota.availableMicros,0);assert.equal(demo.providerCalls,10);
}));
test('loopback denies host/origin attacks, arbitrary bind options and private-data request payloads',async()=>{
 await assert.rejects(startHttpDemo({host:'0.0.0.0'}));await assert.rejects(startHttpDemo({mode:'live'}));await assert.rejects(startHttpDemo({directory:'/tmp'}));await assert.rejects(startHttpDemo({holdProvider:()=>{}}));
 await withDemo(async demo=>{
  assert.equal(await new Promise((resolve,reject)=>{const r=http.get(demo.origin+'/api/tutor/status',{headers:{host:'evil.example','sec-fetch-site':'same-origin','x-xiaobu-request':'1'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});r.on('error',reject);}),403);
  assert.equal((await fetch(demo.origin+'/api/tutor/status',{headers:{origin:'https://evil.example','sec-fetch-site':'same-origin','x-xiaobu-request':'1'}})).status,403);
  assert.equal((await fetch(demo.origin+'/api/tutor/status')).status,403);
  for(const extra of [{text:'private text'},{audio:'recording'},{history:[]},{mode:'live'}])assert.equal((await post(demo,{...input,...extra})).status,400);
  assert.equal((await post(demo,{...input,text:'x'.repeat(2000)})).status,400);assert.equal(demo.providerCalls,0);
  assert.equal((await post(demo,input,{'oai-authenticated-user-id':'attacker','oai-sites-authorization':'Bearer forged','oai-authenticated-user-email':'ignored@example.test'})).status,200);
  assert.equal((await get(demo)).status,200);assert.equal(demo.providerCalls,1); // Always the fixed fixture owner.
 });
});
test('slow or late HTTP body returns bounded timeout and never calls the provider',()=>withDemo(async demo=>{
 const response=await new Promise((resolve,reject)=>{
  const request=http.request(demo.origin+'/api/tutor/dialogue',{method:'POST',headers:{origin:demo.origin,'x-xiaobu-request':'1','content-type':'application/json','transfer-encoding':'chunked'}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text}));});
  request.on('error',()=>{});request.write('{');setTimeout(()=>{request.end(JSON.stringify(input));},60);setTimeout(()=>reject(Error('response hung')),2000).unref();
 });
 assert.equal(response.status,408);assert.match(response.text,/BODY_TIMEOUT/);await sleep(80);assert.equal(demo.providerCalls,0);assert.equal((await get(demo)).status,200);
},{bodyTimeoutMs:15}));
test('client cancellation with delayed provider conservatively consumes one reservation, never retries',()=>withDemo(async demo=>{
 const abort=new AbortController();const pending=fetch(demo.origin+'/api/tutor/dialogue',{method:'POST',headers:{origin:demo.origin,'x-xiaobu-request':'1','content-type':'application/json'},body:JSON.stringify(input),signal:abort.signal}).catch(()=>null);
 for(let i=0;i<100&&demo.providerCalls===0;i++)await sleep(2);assert.equal(demo.providerCalls,1);abort.abort();await pending;await sleep(100);
 const status=(await (await get(demo)).json()).status;assert.equal(status.quota.spentMicros,100);assert.equal(status.quota.reservedMicros,0);assert.equal(demo.providerCalls,1);
},{providerDelayMs:60}));
test('body stream error rejects promptly and malformed real HTTP gets a response rather than hanging',()=>withDemo(async demo=>{
 const nodeStream=new PassThrough(),body=fixtureBody(nodeStream,new AbortController().signal),reader=body.getReader(),pending=reader.read();nodeStream.emit('error',Error('synthetic stream fault'));await assert.rejects(pending,{code:'INVALID_REQUEST'});
 const port=Number(new URL(demo.origin).port);
 const response=await new Promise((resolve,reject)=>{let text='';const socket=net.connect(port,'127.0.0.1',()=>socket.write(`POST /api/tutor/dialogue HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: ${demo.origin}\r\nX-Xiaobu-Request: 1\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\nINVALID\r\n`));socket.setTimeout(2000,()=>{socket.destroy();reject(Error('socket hung'));});socket.on('data',c=>text+=c);socket.on('end',()=>resolve(text));socket.on('error',reject);});
 assert.match(response,/HTTP\/1\.1 400/);assert.equal(demo.providerCalls,0);assert.equal((await get(demo)).status,200);
}));

test('real tutor client crosses loopback HTTP into SQLite and fake provider without setting browser-owned headers',()=>withDemo(async demo=>{
 const {createTutorClient}=await import('../client/tutor-client.js');let networkCalls=0;
 const client=createTutorClient({enabled:true,expectedMode:'offline-test',fetchImpl:async(path,init)=>{
  assert.ok(['/api/tutor/status','/api/tutor/dialogue'].includes(path));
  const headers=new Headers(init.headers);assert.equal(headers.has('origin'),false);assert.equal(headers.has('sec-fetch-site'),false);
  assert.equal(init.mode,'same-origin');assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');
  // Node has no browser origin context. Emulate only the UA-owned metadata;
  // destination is hard-bound to this test's own loopback server.
  headers.set('sec-fetch-site','same-origin');if(init.method==='POST')headers.set('origin',demo.origin);
  networkCalls++;return fetch(demo.origin+path,{...init,headers});
 }});
 try{
  client.setScope({profileId:'A',questionId:'loop:math:0'});
  const before=await client.getStatus();assert.equal(before.status.quota.spentMicros,0);assert.equal(before.status.quota.currency,'TEST');assert.equal(before.status.configuredMode,'offline-test');
  const answer=await client.dialogue({requestId:'client-request',intent:'check'});assert.equal(answer.result.mode,'protocol-test');assert.equal(answer.result.answer,'4');
  assert.deepEqual(await client.dialogue({requestId:'client-request',intent:'check'}),answer);
  const after=await client.getStatus();assert.equal(after.status.quota.spentMicros,100);assert.equal(after.status.quota.availableMicros,900);assert.equal(after.status.quota.reservedMicros,0);assert.equal(demo.providerCalls,1);assert.equal(networkCalls,4);
 }finally{client.dispose();}
}));
