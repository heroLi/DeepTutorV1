// Deployment-neutral handler. Not wired to the static Site or a listening server.
// Authentication and a real atomic persistent ledger MUST come from trusted server code.
import {exactObject, dialogueFixture, syntheticDialogue, validateDialogue, fault} from './catalogue.js';
import {requireLiveApproval, verifyLiveBinding, providerCostBound} from './deepseek.js';
import {readRequestJson} from './request-body.js';
const KEY = /^[A-Za-z0-9_-]{1,64}$/;
export function validateRequest(input) {
  if (!exactObject(input, ['requestId','profileId','questionId','intent']) || !KEY.test(input.requestId) ||
      typeof input.requestId !== 'string' || typeof input.profileId !== 'string' || !KEY.test(input.profileId)) throw fault('INVALID_REQUEST');
  dialogueFixture({questionId:input.questionId,intent:input.intent});
  return Object.freeze({...input});
}
function safePrincipal(principal) { return principal && typeof principal.id === 'string' && KEY.test(principal.id); }
export function createTutorService({mode = 'mock', provider, authenticate, authorizeProfile, ledger,
  approval, reservationMicros, origin, bodyTimeoutMs=2000} = {}) {
  if ((!Number.isSafeInteger(bodyTimeoutMs) || bodyTimeoutMs<1 || bodyTimeoutMs>10000) || !['mock','offline-test','live'].includes(mode) || typeof authenticate !== 'function' || typeof authorizeProfile !== 'function' ||
      !ledger || typeof ledger.reserveAndClaim !== 'function' || typeof ledger.settle !== 'function' ||
      !Number.isSafeInteger(reservationMicros) || reservationMicros <= 0 || typeof origin !== 'string') throw fault('INVALID_CONFIG');
  let normalized; try { normalized = new URL(origin); } catch { throw fault('INVALID_CONFIG'); }
  if (normalized.origin !== origin || !['https:','http:'].includes(normalized.protocol)) throw fault('INVALID_CONFIG');
  if (mode === 'live') {
    requireLiveApproval(approval);
    if (normalized.protocol !== 'https:' || ledger.kind !== 'durable-atomic' || provider?.mode !== 'live' || reservationMicros > approval.spendLimitMicros) throw fault('LIVE_NOT_READY');
    verifyLiveBinding(provider, {approval,authenticate,authorizeProfile,ledger});
    if (reservationMicros < providerCostBound(provider) || typeof ledger.freezeScope !== 'function') throw fault('LIVE_NOT_READY');
  }
  if (mode === 'offline-test' && (provider?.mode !== 'offline-test' || typeof provider.request !== 'function')) throw fault('INVALID_CONFIG');
  if (mode === 'mock' && provider !== undefined) throw fault('INVALID_CONFIG');
  const limits = Object.freeze({scope:mode==='live'?approval.reference:'offline-fixture',
    currency:mode==='live'?approval.currency:'TEST',limitMicros:mode==='live'?approval.spendLimitMicros:1000,reservationMicros});
  async function execute(request, input, principal) {
    const body = validateRequest(input);
    if (await authorizeProfile(principal, body.profileId) !== true) throw fault('FORBIDDEN');
    if (request.signal.aborted) throw fault('CANCELLED');
    if(mode==='live' && reservationMicros < providerCostBound(provider)) throw fault('LIVE_NOT_READY');
    const query = Object.freeze({questionId:body.questionId,intent:body.intent});
    // Ledger MUST atomically check fingerprint, idempotency, total cap and inflight claims.
    const claim = await ledger.reserveAndClaim({key:JSON.stringify([limits.scope,principal.id,body.requestId]),
      fingerprint:JSON.stringify([body.profileId,body.questionId,body.intent]),...limits});
    if (claim?.kind === 'cached') {
      if(claim.errorCode) throw fault(['CANCELLED','TIMEOUT','INVALID_RESPONSE','RESPONSE_TOO_LARGE','PROVIDER_UNAVAILABLE','COST_BOUND_EXCEEDED','PRICING_EXPIRED'].includes(claim.errorCode)?claim.errorCode:'LEDGER_UNAVAILABLE');
      return validateResult(claim.result,query,mode);
    }
    if (claim?.kind !== 'claimed' || typeof claim.token !== 'string') throw fault('LEDGER_UNAVAILABLE');
    let result, errorCode;
    try {
      result = mode === 'mock' ? await syntheticDialogue(query) : await provider.request(query,{signal:request.signal});
      result = validateResult(result,query,mode);
    } catch (error) {
      const codes = ['CANCELLED','TIMEOUT','INVALID_RESPONSE','RESPONSE_TOO_LARGE','PROVIDER_UNAVAILABLE','COST_BOUND_EXCEEDED','PRICING_EXPIRED'];
      errorCode = codes.includes(error?.code) ? error.code : 'PROVIDER_UNAVAILABLE';
    }
    // Conservatively account the FULL approved bound even on uncertain provider outcomes.
    // Never refund on timeout, release a stuck claim, or retry a provider request here.
    if(errorCode==='COST_BOUND_EXCEEDED' && mode==='live') await ledger.freezeScope(limits.scope);
    await ledger.settle({token:claim.token,chargeMicros:reservationMicros,result:result||null,errorCode:errorCode||null});
    if (errorCode) throw fault(errorCode);
    return result;
  }
  return Object.freeze({mode, async fetch(request) {
    let status = 500, code = 'SERVICE_UNAVAILABLE';
    try {
      const url = new URL(request.url);
      if (url.origin !== origin || url.pathname !== '/api/tutor/dialogue' || url.search) throw fault('NOT_FOUND');
      if (request.method !== 'POST') throw fault('METHOD_NOT_ALLOWED');
      if (request.headers.get('origin') !== origin || request.headers.get('x-xiaobu-request') !== '1' ||
          (request.headers.get('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')) throw fault('CSRF_REJECTED');
      const principal = await authenticate(request);
      if (!safePrincipal(principal)) throw fault('UNAUTHENTICATED');
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw fault('INVALID_REQUEST');
      let input;
      try { input = await readRequestJson(request, {timeoutMs:bodyTimeoutMs}); }
      catch(error) { throw fault(error?.code==='INVALID_RESPONSE'?'INVALID_REQUEST':error?.code||'INVALID_REQUEST'); }
      const result = await execute(request,input,principal);
      return json({ok:true,result},200);
    } catch (error) {
      const statuses = {NOT_FOUND:404,METHOD_NOT_ALLOWED:405,CSRF_REJECTED:403,INVALID_REQUEST:400,
        UNAUTHENTICATED:401,FORBIDDEN:403,BODY_TIMEOUT:408,CANCELLED:409,TIMEOUT:504,INVALID_RESPONSE:502,RESPONSE_TOO_LARGE:400,
        PROVIDER_UNAVAILABLE:502,BUDGET_EXHAUSTED:429,INFLIGHT_LIMIT:429,IDEMPOTENCY_CONFLICT:409,
        IN_PROGRESS:409,RATE_LIMIT:429,SCOPE_FROZEN:503,SCOPE_EXPIRED:503,SCOPE_MISMATCH:503,CLOCK_INVALID:503,SETTLEMENT_CONFLICT:503,LEDGER_UNAVAILABLE:503,LIVE_NOT_READY:503,PRICING_EXPIRED:503,COST_BOUND_EXCEEDED:502};
      if (Object.hasOwn(statuses,error?.code)) { code=error.code;status=statuses[code]; }
      return json({ok:false,error:{code}},status);
    }
  }});
}
function json(body,status) { return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}}); }

function validateResult(result,query,mode) {
  const expectedMode=mode==='live'?'deepseek':mode==='offline-test'?'protocol-test':'mock';
  if (!exactObject(result,['mode','questionId','intent','text','followUp','answer']) || result.mode!==expectedMode) throw fault('INVALID_RESPONSE');
  const {mode:ignored,...dialogue}=result;
  return Object.freeze({mode:expectedMode,...validateDialogue(dialogue,query)});
}
