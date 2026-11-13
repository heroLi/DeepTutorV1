// No environment reads, implicit fetch, logging, SDK, retry, redirects or tools.
import {dialogueFixture, modelInstruction, validateDialogue, fault} from './catalogue.js';
import {maxCostMicros,INPUT_BYTES_LIMIT,INPUT_TOKEN_BOUND,OUTPUT_TOKEN_BOUND} from './pricing.js';
export const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
export const DEEPSEEK_MODEL = 'deepseek-flash';
export const MAX_COMPLETION_TOKENS = OUTPUT_TOKEN_BOUND;
const MAX_RESPONSE_BYTES = 16384;
const liveBindings = new WeakMap();
const safeInt = value => Number.isSafeInteger(value) && value > 0;
// Never wait on cancellation of a rejected or late provider body.
const cancelResponse = response => { try { Promise.resolve(response?.body?.cancel()).catch(() => {}); } catch {} };
export function requireLiveApproval(approval) {
  if (!approval || approval.provider !== 'deepseek' || approval.syntheticOnly !== true || !['CNY','USD'].includes(approval.currency) ||
      !safeInt(approval.spendLimitMicros) || typeof approval.reference !== 'string' || !approval.reference.trim() || approval.reference.length > 100) throw fault('LIVE_NOT_AUTHORIZED');
}
export async function readLimitedJson(response, maxBytes, signal) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw fault('RESPONSE_TOO_LARGE');
  if (!response.body?.getReader) throw fault('INVALID_RESPONSE');
  const reader = response.body.getReader(); let total = 0; const chunks = [];
  try {
    while (true) {
      if (signal?.aborted) throw fault('CANCELLED');
      const {value, done} = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw fault('RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)); }
    catch { throw fault('INVALID_RESPONSE'); }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export function createDeepSeekProvider({mode = 'disabled', fetchImpl, credential, approval,
  model = DEEPSEEK_MODEL, timeoutMs = 15000, integration, pricing, now = () => Date.now()} = {}) {
  if (mode === 'disabled') return Object.freeze({mode, async request() { throw fault('LIVE_DISABLED'); }});
  if (!['offline-test', 'live'].includes(mode) || model !== DEEPSEEK_MODEL || typeof fetchImpl !== 'function' ||
      typeof credential !== 'string' || credential.length < 8 || credential.length > 512 || /[\r\n\s]/.test(credential) ||
      !safeInt(timeoutMs) || timeoutMs > 30000 || typeof now !== 'function') throw fault('INVALID_CONFIG');
  // A trusted deployment must supply approval, not browser-controlled flags.
  if (mode === 'live') {
    requireLiveApproval(approval);
    approval=Object.freeze({...approval}); pricing=pricing&&Object.freeze({...pricing});
    if (pricing?.currency !== approval.currency || maxCostMicros(pricing,now()) > approval.spendLimitMicros) throw fault('PRICING_REQUIRED');
    if (!integration || typeof integration.authenticate !== 'function' || typeof integration.authorizeProfile !== 'function' || integration.ledger?.kind !== 'durable-atomic' || typeof integration.ledger.reserveAndClaim !== 'function' || typeof integration.ledger.settle !== 'function') throw fault('LIVE_NOT_READY');
  }
  const provider = Object.freeze({mode, async request(query, {signal} = {}) {
    dialogueFixture(query);
    if (mode==='live') maxCostMicros(pricing,now());
    if (signal !== undefined && !(signal instanceof AbortSignal)) throw fault('INVALID_REQUEST');
    if (signal?.aborted) throw fault('CANCELLED');
    const reference = modelInstruction(query);
    const payload = JSON.stringify({model, stream:false, thinking:{type:'disabled'}, max_tokens:MAX_COMPLETION_TOKENS,
      response_format:{type:'json_object'}, messages:[
        {role:'system',content:'Return one JSON object with exactly the expected fields and canonical values supplied below. This is a synthetic integration test, not a personal conversation. Do not add tools, links, facts, HTML or other text.'},
        {role:'user',content:JSON.stringify(reference)}
      ]});
    if (new TextEncoder().encode(payload).length > INPUT_BYTES_LIMIT) throw fault('INVALID_REQUEST');
    const controller = new AbortController(); let timer, abortListener;
    const stop = new Promise((_, reject) => {
      abortListener = () => { controller.abort(); reject(fault('CANCELLED')); };
      signal?.addEventListener('abort', abortListener, {once:true});
      timer = setTimeout(() => { controller.abort(); reject(fault('TIMEOUT')); }, timeoutMs);
    });
    const operation = async () => {
      let response;
      try {
      // Workers supports manual, not error. Do not follow any Location response.
      response = await fetchImpl(DEEPSEEK_ENDPOINT, {method:'POST', redirect:'manual', credentials:'omit',
        headers:{'content-type':'application/json','authorization':`Bearer ${credential}`}, body:payload, signal:controller.signal});
      if (controller.signal.aborted) throw fault('CANCELLED');
      if (!response || response.status !== 200 || response.redirected === true ||
          (response.url && response.url !== DEEPSEEK_ENDPOINT)) throw fault('PROVIDER_UNAVAILABLE');
      if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw fault('INVALID_RESPONSE');
      const data = await readLimitedJson(response, MAX_RESPONSE_BYTES, controller.signal);
      if (!data || data.model !== model || !Array.isArray(data.choices) || data.choices.length !== 1) throw fault('INVALID_RESPONSE');
      if (!data.usage || !Number.isSafeInteger(data.usage.prompt_tokens) || data.usage.prompt_tokens<0 || data.usage.prompt_tokens>INPUT_TOKEN_BOUND || !Number.isSafeInteger(data.usage.completion_tokens) || data.usage.completion_tokens<0 || data.usage.completion_tokens>OUTPUT_TOKEN_BOUND) throw fault('COST_BOUND_EXCEEDED');
      const choice = data.choices[0], message = choice?.message;
      if (choice?.finish_reason !== 'stop' || choice.index !== 0 || message?.role !== 'assistant' ||
          (message.tool_calls !== undefined && message.tool_calls !== null) ||
          (message.reasoning_content !== undefined && message.reasoning_content !== null && message.reasoning_content !== '') ||
          typeof message.content !== 'string' || !message.content.trim() || message.content.length > 2048) throw fault('INVALID_RESPONSE');
      let parsed; try { parsed = JSON.parse(message.content); } catch { throw fault('INVALID_RESPONSE'); }
      return Object.freeze({mode: mode === 'live' ? 'deepseek' : 'protocol-test', ...validateDialogue(parsed, query)});
      } finally { cancelResponse(response); }
    };
    try { return await Promise.race([operation(), stop]); }
    catch (error) {
      const allowed = ['CANCELLED','TIMEOUT','INVALID_RESPONSE','RESPONSE_TOO_LARGE','PROVIDER_UNAVAILABLE','COST_BOUND_EXCEEDED','PRICING_EXPIRED'];
      throw fault(allowed.includes(error?.code) ? error.code : 'PROVIDER_UNAVAILABLE');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abortListener); controller.abort(); }
  }});
  if (mode === 'live') liveBindings.set(provider, {approval:{...approval},authenticate:integration.authenticate,authorizeProfile:integration.authorizeProfile,ledger:integration.ledger,pricing:{...pricing},now});
  return provider;
}
export function verifyLiveBinding(provider, {approval,authenticate,authorizeProfile,ledger}) {
  const binding=liveBindings.get(provider);
  if (!binding || binding.approval.currency !== approval.currency || binding.approval.reference !== approval.reference || binding.approval.spendLimitMicros !== approval.spendLimitMicros || binding.authenticate !== authenticate || binding.authorizeProfile !== authorizeProfile || binding.ledger !== ledger) throw fault('LIVE_NOT_READY');
}

export function providerCostBound(provider) { const binding=liveBindings.get(provider);if(!binding)throw fault('LIVE_NOT_READY');return maxCostMicros(binding.pricing,binding.now()); }
