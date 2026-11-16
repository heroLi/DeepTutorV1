// Adult review of authored synthetic evidence, never an assessment of a real learner.
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const copy = value => freeze(JSON.parse(JSON.stringify(value)));
export const SUPPORT_SOURCE = freeze({
  title:'IES / WWC：Organizing Instruction and Study to Improve Student Learning',
  url:'https://ies.ed.gov/ncee/WWC/PracticeGuide/1',
  limits:'指南支持示范与独立练习交替、间隔复习、主动回忆和解释性追问；以下题目、情境与动作匹配是人工设计的产品审查假设，不是经验证的个体诊断算法，也不是教材安排。没有统一掌握分数或固定复习天数。'
});
export const SUPPORT_ACTIONS = freeze([
  {id:'worked-example',label:'简短示范／共同做一步',description:'先展示一个小步骤并说明依据，再邀请共同完成一步；不让新手反复猜。'},
  {id:'single-hint',label:'一条提示／过程追问',description:'针对当前卡点给一条不直接报答案的提示，或先追问计算过程；证据不足时先核查，仍不会就转简短示范。'},
  {id:'independent-check',label:'无提示新题核查',description:'换一个同概念的小题，不先给答案或提示；记录是否独立及解释依据，不用重复原题代替。'},
  {id:'delayed-check',label:'延后换题核查',description:'在合适的后续时段用一道不同题目主动回忆；间隔随内容与反馈调整，不设置统一天数。'},
  {id:'contrast-explanation',label:'对照分组／概念讲解',description:'比较不同分组数与每份数量，用具体分配和算式解释差异，再核查一个新例子。'},
  {id:'spaced-mix',label:'少量间隔混合练习',description:'在后续复习中少量混合相关概念，继续观察解释和迁移；不因一次成功宣告永久掌握。'}
]);
export const SUPPORT_SCENARIOS = freeze([
  {id:'new-concept',title:'新概念：还不知道怎样开始',summary:'固定情境尚无独立作答证据。成人审查是否先提供足够的示范。',
   timeline:[{label:'首次接触',prompt:'12 块材料平均放入 3 个盒子，每盒多少块？',response:'不知道“平均放”该怎么做。',assistance:'尚未示范；没有独立答案。'}],
   evidence:'这段记录只显示尚不能开始，不能据此区分概念陌生、语言理解或其他原因。',limit:'不能认定能力差、粗心或不努力，也没有独立掌握的证据。',recommendedActionId:'worked-example',
   rationale:'概念尚未建立时，先示范每盒逐一放入同样数量，并共同完成一轮，比要求连续猜答案更合适。',
   nextCheck:'示范后换成 8 块材料平均放入 2 个盒子，邀请说明为何每盒 4 块；明确记录是否仍需帮助。',fallback:'若仍表示不会，缩小到一次分配动作并再示范，不强迫反复猜。'},
  {id:'prompted-success',title:'提示后正确：帮助尚未撤除',summary:'答案正确发生在提示之后，尚不能当成独立完成。',
   timeline:[{label:'首次回答',prompt:'12 块材料平均放入 3 个盒子，每盒多少块？',response:'每盒 3 块，因为有 3 个盒子。',assistance:'未给提示。'},{label:'提示后回答',prompt:'仍是同一道题。',response:'每盒 4 块。',assistance:'提示：把 12 分成 3 份，试着算 12 ÷ 3。'}],
   evidence:'提示后能给出正确答案，说明这次支持有帮助。',limit:'不能把提示后的正确计为无提示成功，也不能证明换题仍会。',recommendedActionId:'independent-check',
   rationale:'先用不同数字的小题检查是否能脱离提示；不把支持条件隐藏在正确率里。',
   nextCheck:'用 15 块材料平均放入 3 个盒子核查，每盒 5 块；先不提示，再听其说明 5 × 3 = 15。',fallback:'若无法开始，提供一条针对提示；仍不会则转简短示范，并将本次记为有帮助。'},
  {id:'same-item-repeat',title:'重复原题：可能记住了答案',summary:'同一道题紧接着重复正确，并不是新题或延迟证据。',
   timeline:[{label:'刚看过说明',prompt:'12 块材料平均放入 3 个盒子，每盒多少块？',response:'说明中给出每盒 4 块，4 × 3 = 12。',assistance:'完整答案已展示。'},{label:'立即重复',prompt:'再次呈现完全相同的题目。',response:'每盒 4 块。',assistance:'此轮未再提示，但刚看过答案。'}],
   evidence:'能在刚看过答案后复述这道题的结论。',limit:'不能排除答案记忆；不能推断新题独立完成或长期保留。',recommendedActionId:'independent-check',
   rationale:'换数字或情境并要求解释，才能提供不同于原题复述的证据。',
   nextCheck:'将 20 块材料平均放入 4 个盒子，每盒 5 块；再问总数与盒子数在算式中各表示什么。',fallback:'若只报数而说不清，先给一条概念提示；必要时示范分配，不连续刷原题。'},
  {id:'independent-now',title:'当场独立：还缺延迟核查',summary:'一个未见过的小题当场无提示完成，但尚无后续时段证据。',
   timeline:[{label:'新题独立作答',prompt:'15 块材料平均放入 3 个盒子，每盒多少块？',response:'每盒 5 块，15 ÷ 3 = 5；5 × 3 = 15。',assistance:'没有提示或展示答案；该题此前未出现。'}],
   evidence:'本次新题能独立计算并核对总量。',limit:'单次当场成功不能证明过一段时间仍会，也不能推广到所有平均分题。',recommendedActionId:'delayed-check',
   rationale:'不必立刻堆叠同样题目；在后续时段用新题主动回忆，补充保留证据。',
   nextCheck:'在合适的后续复习时段检查 18 块材料平均放入 3 个盒子，每盒 6 块；记录是否无提示及能否说明依据。',fallback:'延后核查不会时，可先给一条提示再示范；保留“独立／有帮助”的区别，调整后续支持。'},
  {id:'delayed-transfer',title:'延后新情境：继续小量观察',summary:'固定材料包含延后和新情境中的独立回答，但范围仍有限。',
   timeline:[{label:'前一次独立作答',prompt:'15 块材料平均放入 3 个盒子，每盒多少块？',response:'每盒 5 块，5 × 3 = 15。',assistance:'未提示。'},{label:'之后另一时段',prompt:'18 张卡片平均装入 3 个袋子，每袋多少张？',response:'每袋 6 张，18 ÷ 3 = 6；6 × 3 = 18。',assistance:'新情境，未提示或展示答案。'}],
   evidence:'这两次固定观察提供了延后、换情境且无提示成功的证据。',limit:'只有少量观察，不能宣告永久掌握，也没有覆盖所有分组数或带余数情况。',recommendedActionId:'spaced-mix',
   rationale:'保留少量间隔练习并混合相关题型，继续检查概念解释；不要仅追求同题次数。',
   nextCheck:'后续少量混合中加入 20 张卡片平均装入 4 个袋子，每袋 5 张；比较盒子数改变后每份数量怎样确定。',fallback:'若新题出现困难，回到具体分配或对照说明，不用一次失败否定之前的成功。'},
  {id:'transfer-gap',title:'换了分组数：需要对照概念',summary:'原题正确，分组数改变后回答与总量不符。',
   timeline:[{label:'原题回答',prompt:'12 块材料平均放入 3 个盒子，每盒多少块？',response:'每盒 4 块，4 × 3 = 12。',assistance:'未提示。'},{label:'改变分组数',prompt:'同样 12 块材料平均放入 4 个盒子，每盒多少块？',response:'每盒 4 块，因为有 4 个盒子。',assistance:'未提示。'}],
   evidence:'固定回答把“有 4 个盒子”作为每盒 4 块的理由；第二题 4 × 4 不等于 12，需要进一步核查过程。',limit:'一次错误不能确定错因。需先追问过程，再用对照分组核查；不能贴个人能力标签，也不能凭原题正确认定迁移已建立。',recommendedActionId:'contrast-explanation',
   rationale:'先追问 4 是怎样得出的，避免把一次错误直接诊断为概念混淆；再并列比较 12 ÷ 3 = 4 与 12 ÷ 4 = 3，用具体分配核查总量，而非只报答案。',
   nextCheck:'说明后用 18 块材料平均放入 6 个盒子核查，每盒 3 块；邀请区分 6 和 3 各指什么。',fallback:'若仍困惑，示范逐轮给每盒各放 1 块并共同做一步，再逐渐撤去帮助。'}
]);
// Authored rehearsal links, never predictions about a learner or automatic assignment.
export const SUPPORT_REHEARSAL = freeze({
  'new-concept': [{label:'模拟：示范后仍需提示',target:'prompted-success'}],
  'prompted-success': [{label:'模拟：新题当场独立完成',target:'independent-now'},{label:'模拟：换分组数出现困难',target:'transfer-gap'}],
  'same-item-repeat': [{label:'模拟：换题后独立完成',target:'independent-now'},{label:'模拟：换题出现困难',target:'transfer-gap'}],
  'independent-now': [{label:'模拟：延后新情境独立完成',target:'delayed-transfer'},{label:'模拟：换分组数出现困难',target:'transfer-gap'}],
  'delayed-transfer': [{label:'模拟：新范围需要重新示范',target:'new-concept'}],
  'transfer-gap': [{label:'模拟：对照讲解后仍需提示',target:'prompted-success'},{label:'模拟：对照后新题独立完成',target:'independent-now'}]
});
export function rehearsalLinks(scenarioId) {
  return copy(Object.hasOwn(SUPPORT_REHEARSAL,scenarioId)?SUPPORT_REHEARSAL[scenarioId]:[]);
}
function allowedObject(value, keys) {
  try {
    if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value)!==Object.prototype) return false;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    return Reflect.ownKeys(descriptors).every(key=>keys.includes(key)&&Object.hasOwn(descriptors[key],'value'));
  } catch { return false; }
}
const failure = code => freeze({ok:false,code});
const success = () => freeze({ok:true});
export function createSupportSession(options={}) {
  if(!allowedObject(options,['now'])||(Object.hasOwn(options,'now')&&typeof options.now!=='function'))throw Error('INVALID_CONFIG');
  const now=options.now||(()=>new Date().toISOString());
  let scenarioId=SUPPORT_SCENARIOS[0].id,actionId=null,records=[],revision=0,dirty=false;
  const guard=expected=>!Number.isSafeInteger(expected)||expected<0?failure('INVALID_REVISION'):expected!==revision?failure('STALE_REVIEW'):null;
  return Object.freeze({
    snapshot:()=>copy({scenarioId,actionId,records,revision,dirty}),
    select(next,expected,selection={}) {
      const error=guard(expected);if(error)return error;
      if(!allowedObject(selection,['discard'])||(Object.hasOwn(selection,'discard')&&typeof selection.discard!=='boolean')||typeof next!=='string'||!SUPPORT_SCENARIOS.some(s=>s.id===next))return failure('INVALID_SELECTION');
      if(next===scenarioId)return success();
      if(dirty&&selection.discard!==true)return failure('UNSAVED_REVIEW');
      scenarioId=next;actionId=null;dirty=false;revision++;return success();
    },
    choose(next,expected) {
      const error=guard(expected);if(error)return error;
      if(typeof next!=='string'||!SUPPORT_ACTIONS.some(a=>a.id===next))return failure('INVALID_ACTION');
      if(next===actionId)return success();
      actionId=next;dirty=true;revision++;return success();
    },
    save(expected) {
      const error=guard(expected);if(error)return error;
      if(actionId===null)return failure('INCOMPLETE_REVIEW');
      if(!dirty)return failure('NO_CHANGES');
      let at;try{at=now();if(typeof at!=='string'||new Date(at).toISOString()!==at)return failure('INVALID_TIME');}catch{return failure('INVALID_TIME');}
      // A custom clock must not make a stale save overwrite a newer session state.
      if(expected!==revision)return failure('STALE_REVIEW');
      const record=copy({scenarioId,actionId,at}),index=records.findIndex(r=>r.scenarioId===scenarioId);
      records=index<0?[...records,record]:records.map((r,i)=>i===index?record:r);
      dirty=false;revision++;return success();
    },
    clear(expected) {
      const error=guard(expected);if(error)return error;
      actionId=null;records=[];dirty=false;revision++;return success();
    },
    exportReport() {
      const fixtures=SUPPORT_SCENARIOS.filter(s=>records.some(r=>r.scenarioId===s.id)).map(s=>({
        ...s,actions:SUPPORT_ACTIONS.filter(a=>a.id===s.recommendedActionId||records.some(r=>r.scenarioId===s.id&&r.actionId===a.id))
      }));
      return copy({schema:'adult-synthetic-support-review',version:1,catalogueVersion:'support-fixed-v1',scope:'adult-review-only',provider:'offline-authored-fixtures',records,fixtures,source:SUPPORT_SOURCE});
    }
  });
}
