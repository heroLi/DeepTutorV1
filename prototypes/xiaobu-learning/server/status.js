// Read-only, authenticated operational status. Not proof of a deployed/verified platform.
import {fault} from './catalogue.js';
import {isD1Ledger} from './d1-ledger.js';
const FIELDS=['currency','unit','accounting','capMicros','spentMicros','reservedMicros','availableMicros','nextReservationMicros','pendingCount','inflightLimit','recentRequestCount','requestLimit','windowMs','frozen','expired','clockValid','canRequest','quotaAllowed','inflightAllowed','rateAllowed','reasons','observedAtMs','expiresAtMs'];
const safeJson=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export function createTutorStatusHandler({mode,origin,authenticate,ledger,scope,currency,limitMicros,reservationMicros,checkProviderReadiness,diagnosticOnly=false}={}){
 if(typeof diagnosticOnly!=='boolean')throw fault('INVALID_CONFIG');
 if(!['mock','offline-test','live'].includes(mode)||typeof authenticate!=='function'||!isD1Ledger(ledger)||typeof ledger.getScopeStatus!=='function')throw fault('INVALID_CONFIG');
 let url;try{url=new URL(origin);}catch{throw fault('INVALID_CONFIG');}
 if(url.origin!==origin||!['https:','http:'].includes(url.protocol)|| (mode==='live'&&(url.protocol!=='https:'||typeof checkProviderReadiness!=='function')))throw fault('INVALID_CONFIG');
 if(typeof scope!=='string'||!Number.isSafeInteger(limitMicros)||limitMicros<1||!Number.isSafeInteger(reservationMicros)||reservationMicros<1||(mode==='live'&&!['CNY','USD'].includes(currency)))throw fault('INVALID_CONFIG');
 if(mode!=='live'&&(scope!=='offline-fixture'||currency!=='TEST'||limitMicros!==1000))throw fault('INVALID_CONFIG');
 return Object.freeze({async fetch(request){
  try{
   const target=new URL(request.url);
   if(target.origin!==origin||target.pathname!=='/api/tutor/status'||target.search)throw fault('NOT_FOUND');
   if(request.method!=='GET')throw fault('METHOD_NOT_ALLOWED');
   const suppliedOrigin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
   if(request.headers.get('x-xiaobu-request')!=='1'||(suppliedOrigin!==null?suppliedOrigin!==origin:site!=='same-origin')||(site!==null&&site!=='same-origin'))throw fault('CSRF_REJECTED');
   const principal=await authenticate(request);
   if(typeof principal?.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(principal.id))throw fault('UNAUTHENTICATED');
   if(request.signal.aborted)throw fault('CANCELLED');
   const snapshot=await ledger.getScopeStatus({scope,principalId:principal.id,currency,limitMicros,reservationMicros});
   const quota={};for(const field of FIELDS)quota[field]=snapshot[field];
   const stoppedReasons=[...snapshot.reasons];
   if(diagnosticOnly)stoppedReasons.push('RUNTIME_RESTART_REQUIRED');
   if(mode==='live'){
    try{const bound=await checkProviderReadiness();if(!Number.isSafeInteger(bound)||bound<=0||bound>reservationMicros)throw fault('LIVE_NOT_READY');}catch(error){stoppedReasons.push(error?.code==='PRICING_EXPIRED'?'PRICING_EXPIRED':'LIVE_NOT_READY');}
   }
   return safeJson({ok:true,status:{configuredMode:mode,syntheticOnly:true,platformVerified:false,
    upstreamConnectivity:'not-verified',accounting:'conservative-not-provider-invoice',
    profileAuthorizationRequired:true,scopeAndConfigurationAllowAttempt:snapshot.canRequest&&stoppedReasons.length===0,stoppedReasons:[...new Set(stoppedReasons)],quota}});
  }catch(error){
   const statuses={NOT_FOUND:404,METHOD_NOT_ALLOWED:405,CSRF_REJECTED:403,UNAUTHENTICATED:401,FORBIDDEN:403,CANCELLED:409,SCOPE_MISMATCH:503,LEDGER_UNAVAILABLE:503};
   const code=Object.hasOwn(statuses,error?.code)?error.code:'SERVICE_UNAVAILABLE';return safeJson({ok:false,error:{code}},statuses[code]||503);
  }
 }});
}
