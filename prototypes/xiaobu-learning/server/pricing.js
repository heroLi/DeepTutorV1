// Trusted deployment configuration, never browser input or a quote from this prototype.
import {fault} from './catalogue.js';
export const INPUT_BYTES_LIMIT = 4096;
export const INPUT_TOKEN_BOUND = INPUT_BYTES_LIMIT + 256; // byte-token bound + two-message framing allowance
export const OUTPUT_TOKEN_BOUND = 384;
const positive = n => Number.isSafeInteger(n) && n > 0;
export function maxCostMicros(pricing, now = Date.now()) {
  if (!pricing || pricing.model !== 'deepseek-flash' || !['CNY','USD'].includes(pricing.currency) ||
      !positive(pricing.inputMicrosPerMillion) || !positive(pricing.outputMicrosPerMillion) ||
      typeof pricing.verifiedAt !== 'string' || typeof pricing.expiresAt !== 'string') throw fault('PRICING_REQUIRED');
  const verified=Date.parse(pricing.verifiedAt), expires=Date.parse(pricing.expiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(verified) || !Number.isFinite(expires) || verified>now || expires<=now || expires<=verified || expires-verified>86400000) throw fault('PRICING_EXPIRED');
  const million=1000000n;
  const numerator=BigInt(INPUT_TOKEN_BOUND)*BigInt(pricing.inputMicrosPerMillion)+BigInt(OUTPUT_TOKEN_BOUND)*BigInt(pricing.outputMicrosPerMillion);
  const result=(numerator+million-1n)/million;
  if (result>BigInt(Number.MAX_SAFE_INTEGER)) throw fault('INVALID_CONFIG');
  return Number(result);
}
