// DEVELOPMENT ONLY. Loopback fixture identity is NOT production authentication.
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openSqliteD1} from '../tests/helpers/sqlite-d1.js';
import {createD1Ledger,createD1LedgerAdmin} from '../server/d1-ledger.js';
import {createTutorRuntime} from '../server/runtime.js';
import {dialogueFixture} from '../server/catalogue.js';
const OWNER='local-synthetic-owner';
function json(res,status,code){if(!res.destroyed){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',connection:'close'});res.end(JSON.stringify({ok:false,error:{code}}));}}
// Converts Node errors/aborts to a bounded Web stream failure instead of leaving a reader hung.
export function fixtureBody(incoming,signal){
 let cleanup=()=>{};
 return new ReadableStream({start(controller){
  let ended=false,total=0;
  const finish=(error)=>{if(ended)return;ended=true;cleanup();if(error)controller.error(Object.assign(new Error('INVALID_REQUEST'),{code:'INVALID_REQUEST'}));else controller.close();};
  const data=chunk=>{if(ended)return;total+=chunk.length;if(total>1024){ended=true;cleanup();controller.error(Object.assign(new Error('RESPONSE_TOO_LARGE'),{code:'RESPONSE_TOO_LARGE'}));return;}controller.enqueue(new Uint8Array(chunk));};
  const end=()=>finish(),error=()=>finish(true),abort=()=>finish(true);
  cleanup=()=>{incoming.off('data',data);incoming.off('end',end);incoming.off('error',error);incoming.off('aborted',abort);signal.removeEventListener('abort',abort);};
  incoming.on('data',data);incoming.on('end',end);incoming.on('error',error);incoming.on('aborted',abort);signal.addEventListener('abort',abort,{once:true});
 },cancel(){cleanup();}});
}
export async function startHttpDemo(options={}){
 if(Object.keys(options).some(k=>!['port','providerDelayMs','bodyTimeoutMs','holdProvider'].includes(k)))throw Error('Only loopback fixture options are allowed');
 const {port=0,providerDelayMs=0,bodyTimeoutMs=2000,holdProvider=false}=options;
 if(typeof holdProvider!=='boolean'||!Number.isInteger(port)||port<0||port>65535||!Number.isInteger(providerDelayMs)||providerDelayMs<0||providerDelayMs>1000||!Number.isInteger(bodyTimeoutMs)||bodyTimeoutMs<1||bodyTimeoutMs>10000)throw Error('Invalid fixture options');
 const directory=await mkdtemp(join(tmpdir(),'xiaobu-http-demo-'));let sql,runtime,origin,closed=false,providerCalls=0;
 const admitted=new WeakSet();const sockets=new Set(),active=new Set();
 // Deterministic test-only gate. It can only hold/release the internal fake, never replace it.
 let releaseProvider;const providerGate=new Promise(resolve=>{releaseProvider=resolve;});if(!holdProvider)releaseProvider();
 const server=http.createServer(async(incoming,outgoing)=>{
  let complete;const done=new Promise(resolve=>{complete=resolve;});active.add(done);
  const abort=new AbortController();outgoing.on('close',()=>abort.abort());
  incoming.on('error',()=>{}); // Stream errors are handled below; never crash the process.
  try{
   const host=origin&&new URL(origin).host;
   const raw=incoming.rawHeaders.map((v,i)=>i%2===0?v.toLowerCase():null);
   if(!runtime)return json(outgoing,503,'STARTING');
   if(raw.filter(v=>v==='host').length!==1||incoming.headers.host!==host||!incoming.url?.startsWith('/')||incoming.url.startsWith('//'))return json(outgoing,403,'LOOPBACK_ONLY');
   for(const name of ['origin','sec-fetch-site','x-xiaobu-request'])if(raw.filter(v=>v===name).length>1)return json(outgoing,403,'AMBIGUOUS_HEADERS');
   const headers=new Headers();
   for(const key of ['origin','sec-fetch-site','x-xiaobu-request','content-type','content-length'])if(incoming.headers[key]!==undefined)headers.set(key,String(incoming.headers[key]));
   // Ignore every incoming identity/bypass header. This fixture has exactly one synthetic owner.
   headers.set('oai-authenticated-user-id',OWNER);
   const hasBody=!['GET','HEAD'].includes(incoming.method);
   const request=new Request(origin+incoming.url,{method:incoming.method,headers,signal:abort.signal,...(hasBody?{body:fixtureBody(incoming,abort.signal),duplex:'half'}:{})});
   admitted.add(request);const response=await runtime.fetch(request);
   if(outgoing.destroyed)return;
   outgoing.writeHead(response.status,{...Object.fromEntries(response.headers),connection:'close','x-xiaobu-demo':'synthetic-only'});outgoing.end(await response.text());
  }catch{json(outgoing,400,'INVALID_REQUEST');}finally{active.delete(done);complete();}
 });
 server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 server.headersTimeout=5000;server.requestTimeout=10000;server.setTimeout(12000,socket=>socket.destroy());
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  origin=`http://127.0.0.1:${server.address().port}`;
  sql=openSqliteD1(join(directory,'fixture.sqlite'),{migrate:true});const ledger=createD1Ledger({db:sql.db}),admin=createD1LedgerAdmin({db:sql.db});
  await admin.registerProfile({ownerId:OWNER,profileId:'A'});await admin.registerProfile({ownerId:OWNER,profileId:'B'});
  await admin.createScope({scope:'offline-fixture',ownerId:OWNER,currency:'TEST',limitMicros:1000,expiresAtMs:Date.now()+3600000,maxRequests:100,maxInflight:2});
  const fetchImpl=async(_url,init)=>{
   providerCalls++;await providerGate;if(providerDelayMs)await new Promise(resolve=>setTimeout(resolve,providerDelayMs));
   const {messages}=JSON.parse(init.body),{expected}=JSON.parse(messages[1].content);
   const fixture=dialogueFixture({questionId:expected.questionId,intent:expected.intent});
   return new Response(JSON.stringify({model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:100},choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(fixture)}}]}),{headers:{'content-type':'application/json'}});
  };
  runtime=await createTutorRuntime({mode:'offline-test',origin,boundary:{kind:'sites-dispatch',verifyRequest:request=>admitted.has(request)},ledger,credential:'synthetic-fixture-not-a-real-key',fetchImpl,reservationMicros:100,bodyTimeoutMs});
 }catch(error){server.close();for(const socket of sockets)socket.destroy();sql?.close();await rm(directory,{recursive:true,force:true});throw error;}
 return Object.freeze({origin,releaseProvider,get providerCalls(){return providerCalls;},async close(){if(closed)return;closed=true;releaseProvider();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));await Promise.all([...active]);sql.close();await rm(directory,{recursive:true,force:true});}});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length>2)throw Error('No arguments: bind address and data directory cannot be customized');
 const demo=await startHttpDemo();
 console.log(`SYNTHETIC LOCAL DEMO ONLY. Not production authentication or a real model.\n${demo.origin}\nGET /api/tutor/status; POST /api/tutor/dialogue. TEST units, temporary SQLite, Ctrl+C to remove this demo's own database.`);
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{demo.close().then(()=>process.exit(0));});
}
