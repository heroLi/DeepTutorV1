// Read-only support projection for the existing finite-example learning flow.
// No learner diagnosis, storage writes, provider calls or automatic scheduling.
import {loopBank,isLoopSubject} from './loop-model.js';
const freeze=x=>{Object.values(x).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(x);};
export function nextSupport(run){
 if(!run||!isLoopSubject(run.subject)||!['practice','review'].includes(run.kind)||run.phase!=='complete'||!run.completedAt||!Array.isArray(run.answers))return null;
 const first=run.answers.find(x=>x.role==='first'),retry=run.answers.find(x=>x.role==='retry'),transfer=run.answers.find(x=>x.role==='transfer');
 const last=run.kind==='practice'?transfer:retry||first;
 if(!first||!last||typeof last.correct!=='boolean')return null;
 let kind,title,evidence,next;
 if(!last.correct){kind='scaffold';title='先复看示范，再试一小步';evidence=run.kind==='practice'?'本次同类题未答对，先核对解题过程，不直接判断错因。':'本次固定复习题未答对；先检查当前卡点，不用一次结果否定之前的表现。';next='展开下面的两步示范，再由家长决定是否重新练本组。不要连续猜答案。';}
 else if(last.role==='retry'){kind='assisted';title='帮助后正确，还需要无提示核查';evidence='正确发生在两步引导之后，保留为有帮助的原题作答，不算独立掌握。';next='先休息或查看现有复习安排。之后用未看过的同概念题核查；当前固定题库会重复，不能据此证明迁移。';}
 else {kind=run.kind==='practice'?'transfer-check':'review-check';title=run.kind==='practice'?'这次同类题正确，下一步看能否保留':'这次固定复习题正确，继续看过程';evidence=run.kind==='practice'?'本轮另一道同类题在提交前未展示答案；如果曾练过这组，仍可能记得旧答案。':'本次复习首次选择正确；固定复习题可能见过，提前复习也不等于延迟保留已验证。';next='查看现有复习安排，不立即堆叠同题。后续核查要区分有没有提示、题目是否见过，以及能否说明理由。';}
 const q=loopBank[run.subject].items[run.kind==='review'?2:0];
 return freeze({kind,title,evidence,next,subject:run.subject,runId:run.id,steps:q.steps.map(s=>({question:s.question,explanation:s.explanation})),caution:'这是固定规则生成的支持提示，不是模型诊断或教学效果证明；不会改动作答、复习日期或给出掌握分数。'});
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function nextSupportMarkup(run,{actions=true}={}){
 const s=nextSupport(run);if(!s)return '';
 return `<section class="next-support" aria-label="本次证据与下一步支持"><span class="chip">本次证据 → 下一步</span><h3>${esc(s.title)}</h3><p>${esc(s.evidence)}</p><p>${esc(s.next)}</p>${s.kind==='scaffold'?`<details><summary>复看两步示范（将展示思路）</summary>${s.steps.map((x,i)=>`<p><strong>第 ${i+1} 步：${esc(x.question)}</strong><br>${esc(x.explanation)}</p>`).join('')}</details>`:''}${actions?'<p><a class="secondary" href="#reviews">查看已有复习安排</a></p>':''}<p class="muted">${esc(s.caution)}</p></section>`;
}
