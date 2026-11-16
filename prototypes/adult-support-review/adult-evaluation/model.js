// Adult evaluator workbench. Authored synthetic fixtures, not live model output.
// No learner data, network transport, browser storage, microphone or draft imports.
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const copy = value => freeze(JSON.parse(JSON.stringify(value)));
const candidate = (id, label, text, fixtureNote) => ({id, label, text, fixtureNote});
export const CASES = freeze([
  {
    id:'math-share', subject:'数学', title:'整除平均分 · 结论与逆向检查',
    prompt:'12 块材料平均放入 3 个盒子，每盒多少块？',
    reference:{answer:'每盒 4 块。', reasoning:'12 ÷ 3 = 4；4 × 3 = 12，三份数量相等且无剩余。', checks:['区分盒子数与每盒数量','用乘法核对总数','追问应检查平均分依据，而非重复答案']},
    candidates:[
      candidate('A','完整说明样本','每盒 4 块。12 ÷ 3 = 4；检查 4 × 3 = 12。建议后续追问：为什么三盒都放 4 块才能称为平均分？','人工编写的完整候选，不代表模型能力或教学效果。'),
      candidate('B','故意缺陷样本','每盒 3 块，因为有 3 个盒子。建议后续追问：盒子一共有几个？','预置缺陷：将盒子数量误作每盒数量；3 × 3 不等于 12。'),
      candidate('C','仅结论样本','每盒 4 块。','预置不完整：无推导、核对或后续追问。')]
  },
  {
    id:'math-remainder', subject:'数学', title:'带余数分配 · 不足整除的处理',
    prompt:'14 块不可拆分的材料，尽量多且同样多地放入 3 个盒子。每盒几块，还剩几块？',
    reference:{answer:'每盒 4 块，还剩 2 块。', reasoning:'14 = 3 × 4 + 2；余数 2 小于盒子数 3，无法再给每盒各添 1 块。', checks:['材料不可拆分，不给小数块数','同时交代商与余数','追问检查余数为何必须小于 3']},
    candidates:[
      candidate('A','完整说明样本','每盒 4 块，剩 2 块。14 = 3 × 4 + 2，余下 2 块不够给三盒各添 1 块。建议后续追问：如果余下的材料还有 3 块，为什么原分配还不是尽量多？','人工编写的完整候选，不是实际模型回答。'),
      candidate('B','故意缺陷样本','每盒 5 块，没有剩余，因为 14 ÷ 3 可以四舍五入成 5。建议后续追问：5 × 3 是多少？','预置缺陷：需要 15 块才能每盒放 5 块；四舍五入违反总量与不可拆分条件。'),
      candidate('C','仅结论样本','每盒 4 块，还剩 2 块。','预置不完整：无余数依据或后续追问。')]
  },
  {
    id:'english-hour', subject:'英语', title:'不定冠词 · 音素而非首字母',
    prompt:'填写不定冠词：___ hour。',
    reference:{answer:'an hour', reasoning:'hour 的 h 不发音，单词以元音音素开头，因此用 an，而不是按首字母 h 选 a。', checks:['答案为 an','依据是开头音素而非字母','追问可验证 a university 等相反字母/发音情况']},
    candidates:[
      candidate('A','完整说明样本','应为 an hour。hour 的 h 不发音，开头是元音音素。建议后续追问：university 虽以字母 u 开头，为什么通常写 a university？','人工编写的完整候选；追问基于 university 开头的辅音音素 /j/。'),
      candidate('B','故意缺陷样本','应为 a hour，因为首字母 h 是辅音字母。建议后续追问：h 是第几个英文字母？','预置缺陷：把字母类别当成音素依据，后续追问也偏离规则。'),
      candidate('C','仅结论样本','an hour。','预置不完整：无发音依据或后续追问。')]
  },
  {
    id:'chinese-width', subject:'语文', title:'情境反义词 · 保持比较维度',
    prompt:'甲通道很宽，乙通道只能容一人通过。与这里的“宽”相反的词是什么？',
    reference:{answer:'窄', reasoning:'情境比较通道的横向宽度，“宽”与“窄”对应；不能用表示长度的“短”替代。', checks:['答案为窄','解释保持宽度这一维度','追问核查宽窄与长短能否同时存在']},
    candidates:[
      candidate('A','完整说明样本','相反的词是“窄”。情境比较的是宽度而非长度。建议后续追问：一条通道能否既长又窄，为什么这与“宽”的反义词不冲突？','人工编写的完整候选，不是儿童作答记录。'),
      candidate('B','故意缺陷样本','相反的词是“短”，因为只能容一人通过的通道较短。建议后续追问：短的反义词是什么？','预置缺陷：从容纳人数错误推断长度，混淆宽度与长度。'),
      candidate('C','仅结论样本','窄。','预置不完整：无比较维度依据或后续追问。')]
  }
]);
export const RUBRIC = freeze([
  {id:'correctness',label:'结论正确性',description:'对照题意与基准，核对结论、单位和必要的条件。'},
  {id:'reasoning',label:'推导与依据',description:'检查步骤是否足够、依据是否有效，是否包含可核验的检查。'},
  {id:'followup',label:'后续追问质量',description:'检查追问是否针对概念与推理，不能仅重复答案或转向无关事实。'}
]);
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
function allowedObject(value, keys) {
  if (!plain(value)) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(descriptors).every(key => keys.includes(key) && Object.hasOwn(descriptors[key],'value'));
}
const failure = code => freeze({ok:false,code});
const success = () => freeze({ok:true});
const criterionIds = RUBRIC.map(item => item.id);
const values = ['pass','fail','uncertain'];
const decision = ratings => Object.values(ratings).includes('fail') ? 'revise' : Object.values(ratings).includes('uncertain') ? 'needs-review' : 'acceptable';
export function createEvaluationSession(options = {}) {
  if (!allowedObject(options,['now']) || (Object.hasOwn(options,'now') && typeof options.now !== 'function')) throw new Error('INVALID_CONFIG');
  const now = options.now || (() => new Date().toISOString());
  let caseId = CASES[0].id, candidateId = 'A', ratings = {}, records = [], revision = 0, dirty = false;
  const guard = expected => !Number.isSafeInteger(expected) || expected < 0 ? failure('INVALID_REVISION') : expected !== revision ? failure('STALE_REVIEW') : null;
  const snapshot = () => copy({caseId,candidateId,ratings,records,revision,dirty});
  return Object.freeze({
    snapshot,
    select(nextCase, nextCandidate, expectedRevision, selectOptions = {}) {
      const error = guard(expectedRevision); if (error) return error;
      if (!allowedObject(selectOptions,['discard']) || (Object.hasOwn(selectOptions,'discard') && typeof selectOptions.discard !== 'boolean')) return failure('INVALID_SELECTION');
      const item = typeof nextCase === 'string' && CASES.find(item => item.id === nextCase);
      if (!item || typeof nextCandidate !== 'string' || !item.candidates.some(candidate => candidate.id === nextCandidate)) return failure('INVALID_SELECTION');
      if (nextCase === caseId && nextCandidate === candidateId) return success();
      if (dirty && selectOptions.discard !== true) return failure('UNSAVED_REVIEW');
      caseId = nextCase; candidateId = nextCandidate; ratings = {}; dirty = false; revision++;
      return success();
    },
    rate(criterionId, value, expectedRevision) {
      const error = guard(expectedRevision); if (error) return error;
      if (!criterionIds.includes(criterionId) || !values.includes(value)) return failure('INVALID_RATING');
      if (ratings[criterionId] === value) return success();
      ratings = {...ratings,[criterionId]:value}; dirty = true; revision++;
      return success();
    },
    save(expectedRevision) {
      const error = guard(expectedRevision); if (error) return error;
      if (!criterionIds.every(id => Object.hasOwn(ratings,id))) return failure('INCOMPLETE_REVIEW');
      if (!dirty) return failure('NO_CHANGES');
      let at; try { at = now(); if (typeof at !== 'string' || new Date(at).toISOString() !== at) return failure('INVALID_TIME'); } catch { return failure('INVALID_TIME'); }
      const id = `${caseId}/${candidateId}`;
      const record = copy({id,caseId,candidateId,at,ratings,derivedDecision:decision(ratings)});
      const index = records.findIndex(item => item.id === id);
      records = index < 0 ? [...records,record] : records.map((item,i) => i === index ? record : item);
      dirty = false; revision++;
      return success();
    },
    clear(expectedRevision) {
      const error = guard(expectedRevision); if (error) return error;
      records = []; ratings = {}; dirty = false; revision++;
      return success();
    },
    exportReport() {
      const fixtures = CASES.filter(item => records.some(record => record.caseId === item.id)).map(item => ({
        ...item, candidates:item.candidates.filter(candidate => records.some(record => record.caseId === item.id && record.candidateId === candidate.id))
      }));
      return copy({schema:'adult-synthetic-evaluation',version:1,scope:'adult-review-only',provider:'offline-authored-fixtures',catalogueVersion:'adult-fixed-v1',records,fixtures});
    }
  });
}
