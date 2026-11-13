// Server-side finite synthetic catalogue. No user text or learning history.
import {loopBank, boundedDivision} from '../dist/loop-model.js';
export const INTENTS = Object.freeze(['understand', 'hint', 'next', 'check']);
export function fault(code) { const error = new Error(code); error.code = code; return error; }
export function exactObject(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(descriptors).length === keys.length && keys.every(key =>
    Object.hasOwn(descriptors, key) && Object.hasOwn(descriptors[key], 'value'));
}
const catalogue = new Map();
for (const [subject, data] of Object.entries(loopBank)) {
  for (const [index, item] of data.items.entries()) {
    if (subject === 'math' && String(boundedDivision(item.total, item.groups)) !== item.answer) throw fault('INVALID_CATALOGUE');
    catalogue.set(`loop:${subject}:${index}`, Object.freeze({
      question: item.question, answer: item.answer,
      understand: item.steps[0].explanation,
      hint: item.steps[0].question,
      next: item.steps[1].explanation,
      check: item.explanation,
      followUp: item.steps[0].question
    }));
  }
}
export function dialogueFixture(query) {
  if (!exactObject(query, ['questionId', 'intent']) || !catalogue.has(query.questionId) || !INTENTS.includes(query.intent)) throw fault('INVALID_REQUEST');
  const item = catalogue.get(query.questionId);
  return Object.freeze({questionId: query.questionId, intent: query.intent,
    text: item[query.intent], followUp: query.intent === 'check' ? '再试一道同类题，看看能否独立完成。' : query.intent === 'hint' ? '先想一想；需要时再点“再解释一步”。' : query.intent === 'next' ? '试着用自己的话说说这一步，再点“怎样检查答案”。' : item.followUp,
    answer: query.intent === 'check' ? item.answer : null});
}
export function modelInstruction(query) {
  const fixture = dialogueFixture(query);
  return {question: catalogue.get(query.questionId).question, expected: fixture};
}
export function validateDialogue(value, query) {
  const fixture = dialogueFixture(query);
  if (!exactObject(value, Object.keys(fixture)) || Object.keys(fixture).some(key => value[key] !== fixture[key])) throw fault('INVALID_RESPONSE');
  return fixture;
}
export async function syntheticDialogue(query) { return Object.freeze({mode: 'mock', ...dialogueFixture(query)}); }
