// Composition only: no listener, environment access, deployment or implicit fetch.
import {createSitesAuthenticator} from './sites-auth.js';
import {createTutorService} from './service.js';
import {createTutorStatusHandler} from './status.js';
import {createDeepSeekProvider,providerCostBound} from './deepseek.js';
import {maxCostMicros} from './pricing.js';
import {fault} from './catalogue.js';
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
  let startupStop;
  try{await ledger.assertReady({scope,currency,limitMicros});}
  catch(error){if(!['SCOPE_FROZEN','SCOPE_EXPIRED','CLOCK_INVALID'].includes(error?.code))throw error;startupStop=error.code;}
  let provider;
  try{provider=mode==='mock'?undefined:createDeepSeekProvider({mode,credential,fetchImpl,
    approval,pricing,now,timeoutMs,integration:{authenticate,authorizeProfile,ledger}});}
  catch(error){
    if(mode!=='live'||error?.code!=='PRICING_EXPIRED')throw error;
    // Read-only diagnostic exception for genuinely expired, otherwise valid prices.
    // No provider exists on this path; checking historic arithmetic does not authorize a call.
    const expires=Date.parse(pricing?.expiresAt),current=(now||Date.now)();
    if(!Number.isFinite(expires)||!Number.isFinite(current)||current<expires)throw error;
    const bound=maxCostMicros(pricing,expires-1);
    if(bound>approval.spendLimitMicros||!Number.isSafeInteger(reservationMicros)||reservationMicros<bound)throw fault('LIVE_NOT_READY');
    startupStop=startupStop||'PRICING_EXPIRED';
  }
  if(bodyTimeoutMs!==undefined&&(!Number.isSafeInteger(bodyTimeoutMs)||bodyTimeoutMs<1||bodyTimeoutMs>10000))throw fault('INVALID_CONFIG');
  if(!Number.isSafeInteger(reservationMicros)||reservationMicros<1||reservationMicros>limitMicros)throw fault('INVALID_CONFIG');
  const dialogue=(!provider&&mode==='live')?null:createTutorService({mode,origin,authenticate,authorizeProfile,ledger,provider,
    approval,reservationMicros,bodyTimeoutMs});
  const status=createTutorStatusHandler({mode,origin,authenticate,ledger,scope,currency,limitMicros,reservationMicros,
    diagnosticOnly:Boolean(startupStop),checkProviderReadiness:mode==='live'?()=>{if(!provider)throw fault('PRICING_EXPIRED');return providerCostBound(provider);}:undefined});
  return Object.freeze({mode,async fetch(request){
    if(new URL(request.url).pathname==='/api/tutor/status')return status.fetch(request);
    if(startupStop)return new Response(JSON.stringify({ok:false,error:{code:'SERVICE_STOPPED'}}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
    return dialogue.fetch(request);
  }});
}
