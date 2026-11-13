// LOCAL TEST ONLY. Fixed synthetic identity is NOT platform authentication.
import {createTutorRuntime} from './server/runtime.js';
import {createD1Ledger} from './server/d1-ledger.js';
const OWNER='synthetic-d1-owner',ORIGIN='http://d1-fixture.test';
const admitted=new WeakSet();let runtime;
export default {async fetch(incoming,env){
 const url=new URL(incoming.url);if(url.origin!==ORIGIN)return new Response(null,{status:403});
 const headers=new Headers(incoming.headers);
 headers.delete('oai-sites-authorization');headers.delete('oai-authenticated-user-email');headers.set('oai-authenticated-user-id',OWNER);
 const request=new Request(incoming,{headers});admitted.add(request);
 runtime??=createTutorRuntime({mode:'offline-test',origin:ORIGIN,ledger:createD1Ledger({db:env.DB}),boundary:{kind:'sites-dispatch',verifyRequest:r=>admitted.has(r)},reservationMicros:100,credential:'synthetic-local-d1-fixture',fetchImpl:async(url,init)=>{
  // This is an explicit LOCAL service binding, never global/network fetch.
  // Preserve the core's URL/init so its redirect/final-URL protections are tested.
  if(init.redirect!=='manual')throw Error('Unexpected core redirect contract');
  return env.FIXTURE_PROVIDER.fetch(new Request(url,init));
 }});
 return (await runtime).fetch(request);
}};
