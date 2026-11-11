// Offline contract simulator, NOT a deployed server or authentication implementation.
// No networking, credentials, provider SDK, or real billing.
const fixtures = Object.freeze({
  'loop:math:0': Object.freeze({total:12, groups:3, choices:Object.freeze([3,4,6,9])}),
  'loop:math:1': Object.freeze({total:20, groups:4, choices:Object.freeze([4,5,10,16])}),
  'loop:math:2': Object.freeze({total:18, groups:6, choices:Object.freeze([3,6,12,18])}),
  'practice:math:0': Object.freeze({total:12, groups:3, choices:Object.freeze([3,4,6,9])}),
  'practice:math:1': Object.freeze({total:18, groups:3, choices:Object.freeze([3,5,6,9])}),
  'test:math:0': Object.freeze({total:15, groups:3, choices:Object.freeze([3,5,6,12])}),
  'test:math:1': Object.freeze({total:20, groups:4, choices:Object.freeze([4,5,8,16])}),
  'test:math:2': Object.freeze({total:16, groups:2, choices:Object.freeze([2,4,8,14])}),
  'test:math:3': Object.freeze({total:24, groups:6, choices:Object.freeze([3,4,6,18])})
});
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const plain = x => x !== null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype;
function exact(value, keys) {
  if (!plain(value)) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(descriptors).length === keys.length && keys.every(k =>
    Object.hasOwn(descriptors,k) && Object.hasOwn(descriptors[k],'value'));
}
const integer = x => Number.isSafeInteger(x) && x >= 0;
function expected(questionId, choiceId) {
  const q = fixtures[questionId];
  const answer = q.total / q.groups;
  return Object.freeze({questionId, answer, correct:q.choices[Number(choiceId)] === answer,
    explanation:`${q.total} ÷ ${q.groups} = ${answer}。检查：${answer} × ${q.groups} = ${q.total}。`});
}
// Only a finite catalog of canonical text is accepted. No HTML or arbitrary prose.
export function validateResponse(value, questionId, choiceId) {
  if (!Object.hasOwn(fixtures, questionId) || !/^[0-3]$/.test(choiceId)) fail('INVALID_RESPONSE');
  const reference = expected(questionId,choiceId);
  if (!exact(value,['questionId','answer','correct','explanation']) ||
      Object.keys(reference).some(k => value[k] !== reference[k])) fail('INVALID_RESPONSE');
  return reference;
}
export function deterministicMock({questionId,choiceId}) {
  return expected(questionId,choiceId);
}
export function createSimulator({
  owners = {'fixture-profile-a':'fixture-user-a','fixture-profile-b':'fixture-user-b'},
  limitMicros = 1000, reservationMicros = 100, successMicros = 60,
  timeoutMs = 100, maxInflight = 10, maxRequests = 1000, adapter = deterministicMock
} = {}) {
  if (![limitMicros,reservationMicros,successMicros].every(integer) || reservationMicros === 0 ||
      successMicros > reservationMicros || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 ||
      timeoutMs > 60000 || !Number.isSafeInteger(maxInflight) || maxInflight < 1 ||
      !Number.isSafeInteger(maxRequests) || maxRequests < 1 || typeof adapter !== 'function' || !plain(owners) ||
      Object.values(owners).some(x => typeof x !== 'string' || !x)) fail('INVALID_CONFIG');
  // This process-wide allowance is deliberately shared across profiles and users.
  const ownership = new Map(Object.entries(owners));
  const requests = new Map();
  let spentMicros = 0, reservedMicros = 0, inflight = 0;
  const snapshot = () => Object.freeze({kind:'simulation-only',limitMicros,spentMicros,reservedMicros,
    inflight, requestCount:requests.size, maxInflight, maxRequests, availableMicros:limitMicros-spentMicros-reservedMicros});
  function request(context, input, {signal} = {}) {
    // Context is trusted test injection, NEVER client-supplied JSON authentication.
    if (!plain(context) || context.authenticated !== true || typeof context.userId !== 'string' || !context.userId) fail('UNAUTHENTICATED');
    if (!exact(input,['requestId','profileId','questionId','choiceId'])) fail('INVALID_REQUEST');
    const {requestId,profileId,questionId,choiceId} = input;
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(requestId) ||
        typeof profileId !== 'string' || profileId.length > 64 ||
        typeof questionId !== 'string' || !Object.hasOwn(fixtures,questionId) ||
        typeof choiceId !== 'string' || !/^[0-3]$/.test(choiceId)) fail('INVALID_REQUEST');
    if (ownership.get(profileId) !== context.userId) fail('FORBIDDEN');
    const key = JSON.stringify([context.userId, requestId]);
    const fingerprint = JSON.stringify([profileId,questionId,choiceId]);
    const previous = requests.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT');
      return previous.promise;
    }
    if (signal !== undefined && !(signal instanceof AbortSignal)) fail('INVALID_SIGNAL');
    if (signal?.aborted) fail('CANCELLED');
    // Synchronous reservation before the first asynchronous operation prevents races
    // ONLY inside this single JS process. It is not a cross-process atomic ledger.
    if (reservationMicros > limitMicros-spentMicros-reservedMicros) fail('BUDGET_EXHAUSTED');
    if (requests.size >= maxRequests) fail('REQUEST_CAPACITY');
    if (inflight >= maxInflight) fail('INFLIGHT_LIMIT');
    reservedMicros += reservationMicros;
    inflight++;
    const safeInput = Object.freeze({questionId,choiceId});
    const controller = new AbortController();
    let timer, onAbort;
    const stop = new Promise((_,reject) => {
      onAbort = () => { controller.abort(); const e = new Error('CANCELLED'); e.code='CANCELLED'; reject(e); };
      signal?.addEventListener('abort',onAbort,{once:true});
      timer = setTimeout(() => { controller.abort(); const e = new Error('TIMEOUT'); e.code='TIMEOUT'; reject(e); },timeoutMs);
    });
    const promise = (async () => {
      let charge = reservationMicros;
      try {
        const result = await Promise.race([Promise.resolve().then(() => adapter(safeInput,{signal:controller.signal})),stop]);
        // Caller mutation or late adapter mutation cannot change the validated result.
        const response = validateResponse(result,questionId,choiceId);
        charge = successMicros;
        return Object.freeze({kind:'simulation-only',response,chargedMicros:charge});
      } catch (error) {
        // Never expose adapter errors, which may contain prompts or other data.
        if (['CANCELLED','TIMEOUT','INVALID_RESPONSE'].includes(error?.code)) fail(error.code);
        fail('ADAPTER_FAILED');
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort',onAbort);
        reservedMicros -= reservationMicros;
        inflight--;
        spentMicros += charge; // Conservative full reservation on uncertain outcome.
      }
    })();
    requests.set(key,{fingerprint,promise});
    return promise;
  }
  return Object.freeze({request,snapshot});
}
