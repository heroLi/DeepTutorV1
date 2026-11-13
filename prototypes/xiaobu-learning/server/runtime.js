// Composition only: no listener, environment access, deployment or implicit fetch.
import {fault} from './catalogue.js';
import {createSitesAuthenticator} from './sites-auth.js';
import {createTutorService} from './service.js';
import {createDeepSeekProvider} from './deepseek.js';
import {isD1Ledger} from './d1-ledger.js';
export async function createTutorRuntime({mode='disabled',origin,boundary,ledger,
  approval,pricing,credential,fetchImpl,now,timeoutMs,bodyTimeoutMs,reservationMicros} = {}) {
  if(mode==='disabled')return Object.freeze({mode,async fetch(){return new Response(JSON.stringify({ok:false,error:{code:'LIVE_DISABLED'}}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});}});
  if(!['mock','offline-test','live'].includes(mode))throw fault('INVALID_CONFIG');
  if(!isD1Ledger(ledger))throw fault('PERSISTENT_LEDGER_REQUIRED');
  const authenticate=createSitesAuthenticator({boundary});
  const authorizeProfile=(principal,profileId)=>ledger.authorizeProfile(principal,profileId);
  // Mock/test units cannot consume a CNY/USD authorization scope.
  if(mode!=='live' && (approval!==undefined || pricing!==undefined))throw fault('INVALID_CONFIG');
  if(mode==='mock' && (credential!==undefined || fetchImpl!==undefined))throw fault('INVALID_CONFIG');
  const scope=mode==='live'?approval?.reference:'offline-fixture';
  const currency=mode==='live'?approval?.currency:'TEST';
  const limitMicros=mode==='live'?approval?.spendLimitMicros:1000;
  await ledger.assertReady({scope,currency,limitMicros});
  const provider=mode==='mock'?undefined:createDeepSeekProvider({mode,credential,fetchImpl,
    approval,pricing,now,timeoutMs,integration:{authenticate,authorizeProfile,ledger}});
  return createTutorService({mode,origin,authenticate,authorizeProfile,ledger,provider,
    approval,reservationMicros,bodyTimeoutMs});
}
