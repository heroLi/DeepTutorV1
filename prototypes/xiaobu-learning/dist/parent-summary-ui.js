import {summarizeParent} from './parent-summary.js';

const ranges=[['7','近 7 天'],['30','近 30 天'],['all','全部已记录日期']];
const stageLabels={
 practiceFirst:'小步练习 · 首次独立选择',
 practiceRetry:'小步练习 · 引导后原题再试',
 transfer:'小步练习 · 同类新题独立选择',
 reviewFirst:'小步复习 · 首次独立选择',
 reviewRetry:'小步复习 · 引导后原题再试',
 guide:'引导步骤 · 选择（练习与复习合计）'
};
const count=value=>Number.isSafeInteger(value)&&value>=0?String(value):'0';
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:'未提供日期';
export function parentSummaryMarkup(profile,{range='7',at}={}){
 const selected=ranges.some(([key])=>key===range)?range:'7';
 const summary=summarizeParent(profile,{range:selected,...(at===undefined?{}:{at})});
 const period=selected==='all'?`全部已记录日期，截至 ${day(summary.toDay)}`:`${day(summary.fromDay)} 至 ${day(summary.toDay)}（含首尾日期）`;
 const completions=[['practice','基础两题练习完成组'],['assessment','已交卷测评'],['loopPractice','小步练习完成轮'],['loopReview','小步复习完成轮']];
 const stages=Object.entries(stageLabels).map(([key,label])=>{
  const stage=summary.stages?.find(row=>row.key===key);
  return `<div class="summary-row"><span>${label}</span><strong>${count(stage?.correct)} / ${count(stage?.attempts)}</strong></div>`;
 }).join('');
 return `<section class="parent-period-summary" aria-labelledby="parent-period-title">
 <h2 id="parent-period-title">按日期看看最近的记录</h2>
 <div class="parent-period-filters" role="group" aria-label="家长小结日期范围">${ranges.map(([key,label])=>`<button type="button" class="secondary" data-parent-range="${key}" aria-pressed="${selected===key}">${label}</button>`).join('')}<button type="button" class="secondary" data-parent-refresh>刷新日期小结</button></div>
 <p id="parent-period-status" role="status" aria-live="polite" aria-atomic="true" tabindex="-1">${period}。以下数字来自当前档案本机可用记录；没有记录时显示 0，不填示例。</p>
 <p class="muted">按此设备的本地日期统计，包含今天。页面未打开时不会自动更新，日期变化后可点“刷新日期小结”。当前记录也可能仅暂存在本页，请留意存储提示；不是云同步。</p>
 <h3>本期完成的小结</h3>
 <div class="stats-grid">${completions.map(([key,label])=>`<div><strong>${count(summary.completion?.[key])}</strong><span>${label}</span></div>`).join('')}</div>
 <p>按完成时间计数；未完成的练习和未交卷的测评不算完成。</p>
 <p>本期已交卷测评：<strong>${count(summary.assessment?.correct)} / ${count(summary.assessment?.total)}</strong> 题答对（正确题 / 已交卷题）。不把未交卷答案重复计入。</p>
 <h3>小步引导的不同环节</h3><p>以下分别显示“正确选择 / 作答次数”，按每次作答时间统计。</p>
 <div class="summary">${stages}</div>
 <p class="muted">引导后再试与引导步骤不是独立作答，不能和首次选择合并判断掌握程度。基础练习中间作答没有完整时间记录，不据此推算到某一天。</p>
 <h3>原始错误与订正</h3>
 <div class="summary"><div class="summary-row"><span>本期新增基础练习 / 测评原始错误</span><strong>${count(summary.wrongs?.base)} 条</strong></div><div class="summary-row"><span>本期新增小步引导 / 复习原始错误</span><strong>${count(summary.wrongs?.loop)} 条</strong></div><div class="summary-row"><span>本期有正确重试的基础 / 测评原错题记录</span><strong>${count(summary.wrongs?.correctedRecords)} 条</strong></div></div>
 <p class="muted">新增错误按原错误发生时间统计；订正按本期正确重试时间统计，同一原错题记录本期只计一次，可能来自更早的题目，不等于本期新增错误已全部解决。不同原错误记录不会合并；小步引导原始错误不标记为基础题已订正。</p>
 ${summary.futureEvents>0?`<p class="storage-warning">有 ${count(summary.futureEvents)} 项事件时间晚于今天，未计入本期。请检查设备日期；本页不会自动改写原记录。</p>`:''}
 ${summary.invalidEvents>0?`<p class="storage-warning">有 ${count(summary.invalidEvents)} 项事件时间或记录无法用于统计，未计入。本页不会猜测时间或修复原记录。</p>`:''}
 <p class="privacy-note">下方历史明细不受此日期筛选影响。这里只读已有记录，不计算学习时长，也不推断年级、能力或掌握程度。</p>
 </section>`;
}
