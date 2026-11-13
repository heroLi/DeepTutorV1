// Not wired to the Site. Opt-in same-origin transport for finite synthetic examples.
// Cancellation discards local results; it does NOT promise server rollback or a refund.
import {localDialogueTransport} from '../dist/dialogue-model.js';
const MODES={mock:'mock','offline-test':'protocol-test',live:'deepseek'};
const INTENTS=['understand','hint','next','check'];
const KEY=/^[A-Za-z0-9_-]{1,64}$/;
const fail=code=>Object.assign(new Error(code),{code});
const exact=(v,keys)=>{if(!v||Object.getPrototypeOf(v)!==Object.prototype)return false;const d=Object.getOwnPropertyDescriptors(v);return Reflect.ownKeys(d).length===keys.length&&keys.every(k=>Object.hasOwn(d,k)&&Object.hasOwn(d[k],'value'));};
const question=id=>typeof id==='string'&&/^loop:(math|chinese|english):[0-2]$/.test(id);
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const reasons=['SCOPE_FROZEN','SCOPE_EXPIRED','CLOCK_INVALID','BUDGET_EXHAUSTED','INFLIGHT_LIMIT','RATE_LIMIT'];
const stops=[...reasons,'LIVE_NOT_READY','PRICING_EXPIRED','RUNTIME_RESTART_REQUIRED'];
const errors=['LIVE_DISABLED','NOT_FOUND','METHOD_NOT_ALLOWED','CSRF_REJECTED','INVALID_REQUEST','UNAUTHENTICATED','FORBIDDEN','BODY_TIMEOUT','CANCELLED','TIMEOUT','INVALID_RESPONSE','RESPONSE_TOO_LARGE','PROVIDER_UNAVAILABLE','BUDGET_EXHAUSTED','INFLIGHT_LIMIT','IDEMPOTENCY_CONFLICT','IN_PROGRESS','RATE_LIMIT','SCOPE_FROZEN','SCOPE_EXPIRED','SCOPE_MISMATCH','CLOCK_INVALID','SETTLEMENT_CONFLICT','LEDGER_UNAVAILABLE','LIVE_NOT_READY','PRICING_EXPIRED','COST_BOUND_EXCEEDED','SERVICE_UNAVAILABLE','SERVICE_STOPPED'];
const list=(v,allow)=>Array.isArray(v)&&v.length<=allow.length&&new Set(v).size===v.length&&v.every(x=>allow.includes(x));
function statusValid(s,mode){
 if(!exact(s,['configuredMode','syntheticOnly','platformVerified','upstreamConnectivity','accounting','profileAuthorizationRequired','scopeAndConfigurationAllowAttempt','stoppedReasons','quota'])||s.configuredMode!==mode||s.syntheticOnly!==true||s.platformVerified!==false||s.upstreamConnectivity!=='not-verified'||s.accounting!=='conservative-not-provider-invoice'||s.profileAuthorizationRequired!==true||typeof s.scopeAndConfigurationAllowAttempt!=='boolean'||!list(s.stoppedReasons,stops))return false;
 const q=s.quota,nums=['capMicros','spentMicros','reservedMicros','availableMicros','nextReservationMicros','pendingCount','inflightLimit','requestLimit','windowMs','expiresAtMs'],bools=['frozen','clockValid','canRequest','quotaAllowed','inflightAllowed','rateAllowed'];
 if(!exact(q,['currency','unit','accounting',...nums,...bools,'recentRequestCount','observedAtMs','expired','reasons'])||!(mode==='live'?['USD','CNY']:['TEST']).includes(q.currency)||q.unit!==q.currency+'-microunits'||q.accounting!=='conservative-reservations-not-provider-bill'||!nums.every(k=>integer(q[k]))||!bools.every(k=>typeof q[k]==='boolean')||!list(q.reasons,reasons))return false;
 if(![q.recentRequestCount,q.observedAtMs].every(v=>v===null||integer(v))||!(q.expired===null||typeof q.expired==='boolean')||q.capMicros<1||q.nextReservationMicros<1||q.inflightLimit<1||q.inflightLimit>100||q.requestLimit<1||q.requestLimit>1000||q.windowMs<1000||q.windowMs>86400000)return false;
 if(['capMicros','spentMicros','reservedMicros','availableMicros','nextReservationMicros','pendingCount'].some(k=>q[k]>1e12)||(q.recentRequestCount!==null&&q.recentRequestCount>1e12))return false;
 if(q.spentMicros+q.reservedMicros+q.availableMicros!==q.capMicros||!Number.isSafeInteger(q.spentMicros+q.reservedMicros+q.availableMicros)||q.quotaAllowed!==(q.nextReservationMicros<=q.availableMicros)||q.inflightAllowed!==(q.pendingCount<q.inflightLimit)||q.rateAllowed!==(q.clockValid&&q.recentRequestCount!==null&&q.recentRequestCount<q.requestLimit))return false;
 if((q.observedAtMs===null)!==(q.expired===null)||(q.observedAtMs===null)!==(q.recentRequestCount===null)||(q.clockValid&&q.observedAtMs===null)||(q.observedAtMs!==null&&q.expired!==(q.observedAtMs>=q.expiresAtMs)))return false;
 const expected=[];if(q.frozen)expected.push('SCOPE_FROZEN');if(q.expired)expected.push('SCOPE_EXPIRED');if(!q.clockValid)expected.push('CLOCK_INVALID');if(!q.quotaAllowed)expected.push('BUDGET_EXHAUSTED');if(!q.inflightAllowed)expected.push('INFLIGHT_LIMIT');if(q.clockValid&&!q.rateAllowed)expected.push('RATE_LIMIT');
 return expected.length===q.reasons.length&&expected.every(r=>q.reasons.includes(r))&&q.canRequest===(expected.length===0)&&q.reasons.every(r=>s.stoppedReasons.includes(r))&&s.stoppedReasons.every(r=>q.reasons.includes(r)||!reasons.includes(r))&&s.scopeAndConfigurationAllowAttempt===(q.canRequest&&s.stoppedReasons.length===0);
}
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export function createTutorClient(options={}){
 if(!options||Object.getPrototypeOf(options)!==Object.prototype||Reflect.ownKeys(options).some(k=>!['enabled','expectedMode','fetchImpl','timeoutMs'].includes(k))||Object.values(Object.getOwnPropertyDescriptors(options)).some(d=>!Object.hasOwn(d,'value')))throw fail('INVALID_CONFIG');
 const {enabled=false,expectedMode,fetchImpl,timeoutMs=10000}=options;
 if(typeof enabled!=='boolean'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000||(expectedMode!==undefined&&!Object.hasOwn(MODES,expectedMode))||(enabled&&(typeof fetchImpl!=='function'||!Object.hasOwn(MODES,expectedMode))))throw fail('INVALID_CONFIG');
 let scope=null,epoch=0,active=null,disposed=false;
 function cancel(){epoch++;if(active){active.reason='CANCELLED';active.controller.abort();active.reject(fail('CANCELLED'));active=null;}}
 async function run(kind,input,signal){
  if(disposed)throw fail('DISPOSED');if(!enabled)throw fail('CLIENT_DISABLED');if(active)throw fail('BUSY');if(!scope)throw fail('SCOPE_REQUIRED');
  if(signal!==undefined&&!(signal instanceof AbortSignal))throw fail('INVALID_REQUEST');if(signal?.aborted)throw fail('CANCELLED');
  if(kind==='dialogue'&&(!exact(input,['requestId','intent'])||typeof input.requestId!=='string'||!KEY.test(input.requestId)||!INTENTS.includes(input.intent)))throw fail('INVALID_REQUEST');
  const action=kind==='dialogue'?Object.freeze({requestId:input.requestId,intent:input.intent}):null;
  const captured={...scope},generation=epoch,controller=new AbortController();let reject,timer,reader;
  const interrupted=new Promise((_,r)=>{reject=r;});const op={controller,reject,reason:null};active=op;
  const abort=()=>{op.reason='CANCELLED';controller.abort();reject(fail('CANCELLED'));};signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{op.reason='TIMEOUT';controller.abort();reject(fail('TIMEOUT'));},timeoutMs);
  const check=()=>{if(op.reason||epoch!==generation||disposed||controller.signal.aborted)throw fail(op.reason||'CANCELLED');};
  try{
   const work=(async()=>{
    const init={method:kind==='status'?'GET':'POST',credentials:'same-origin',redirect:'error',mode:'same-origin',cache:'no-store',headers:{'x-xiaobu-request':'1'},signal:controller.signal};
    if(kind==='dialogue'){init.headers['content-type']='application/json';init.body=JSON.stringify({requestId:action.requestId,...captured,intent:action.intent});}
    const response=await fetchImpl('/api/tutor/'+kind,init);check();
    if(!(response instanceof Response)||response.redirected||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw fail('INVALID_RESPONSE');
    const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>16384))throw fail('RESPONSE_TOO_LARGE');
    if(!response.body)throw fail('INVALID_RESPONSE');reader=response.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let size=0,text='';
    while(true){const chunk=await reader.read();check();if(chunk.done)break;size+=chunk.value.byteLength;if(size>16384)throw fail('RESPONSE_TOO_LARGE');try{text+=decoder.decode(chunk.value,{stream:true});}catch{throw fail('INVALID_RESPONSE');}}try{text+=decoder.decode();}catch{throw fail('INVALID_RESPONSE');}check();
    let body;try{body=JSON.parse(text);}catch{throw fail('INVALID_RESPONSE');}
    if(exact(body,['ok','error'])&&body.ok===false&&exact(body.error,['code'])&&errors.includes(body.error.code)&&!response.ok)throw fail(body.error.code);
    if(response.status!==200||!exact(body,['ok',kind==='status'?'status':'result'])||body.ok!==true)throw fail('INVALID_RESPONSE');
    const value=kind==='status'?body.status:body.result;
    if(kind==='status'){if(!statusValid(value,expectedMode))throw fail('INVALID_RESPONSE');}
    else {const expected={...localDialogueTransport({questionId:captured.questionId,intent:action.intent}),mode:MODES[expectedMode]};if(!exact(value,Object.keys(expected))||Object.keys(expected).some(k=>expected[k]!==value[k]))throw fail('INVALID_RESPONSE');}
    check();return freeze(kind==='status'?{status:value,scope:captured}:{requestId:action.requestId,profileId:captured.profileId,result:value});
   })();
   return await Promise.race([work,interrupted]);
  }catch(error){if(op.reason)throw fail(op.reason);if(errors.includes(error?.code)||['INVALID_RESPONSE','RESPONSE_TOO_LARGE'].includes(error?.code))throw fail(error.code);throw fail('TRANSPORT_UNAVAILABLE');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort();if(reader){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}if(active===op)active=null;}
 }
 function optionsSignal(value){if(!exact(value,[])&&!exact(value,['signal']))throw fail('INVALID_REQUEST');return value.signal;}
 return Object.freeze({setScope(value){if(disposed)throw fail('DISPOSED');if(!exact(value,['profileId','questionId'])||!['A','B'].includes(value.profileId)||!question(value.questionId))throw fail('INVALID_REQUEST');if(!scope||scope.profileId!==value.profileId||scope.questionId!==value.questionId){cancel();scope={...value};}},async getStatus(options={}){return run('status',undefined,optionsSignal(options));},async dialogue(input,options={}){return run('dialogue',input,optionsSignal(options));},cancel,dispose(){cancel();scope=null;disposed=true;}});
}
