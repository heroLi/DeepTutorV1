import {subjects,units} from './model.js';
import {loopEvidence,answerQuestion,isLoopSubject} from './loop-model.js';

export const WRONG_PAGE_SIZE=6;
const kinds=['all','pending','corrected','loop'];
const subjectKeys=['math','chinese','english'];
const stages={first:'首次选择',retry:'引导后原题',transfer:'同类新题'};
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const own=(o,k)=>o!==null&&typeof o==='object'&&Object.hasOwn(o,k);
function baseQuestion(qid){
 if(typeof qid!=='string')return null;
 const match=/^(practice|test):(math|chinese|english):([0-3])$/.exec(qid);
 if(!match)return null;
 const [,kind,subject,index]=match;
 const q=(kind==='practice'?subjects:units)[subject].items[Number(index)];
 return q?{q,subject}:null;
}
// A projection only: repeated errors remain separate evidence. A later successful
// loop answer does not turn a different phase/question into a corrected record.
export function collectWrongEntries(profile){
 const entries=[];
 for(const r of Array.isArray(profile?.wrongs)?profile.wrongs:[]){
  if(!r||typeof r.id!=='string'||!validDate(r.date))continue;
  const found=baseQuestion(r.qid);if(!found)continue;
  const {q,subject}=found;
  if(r.chosen!==null&&!q.choices.includes(r.chosen))continue;
  const corrected=validDate(r.correctedAt);
  entries.push(Object.freeze({id:`base:${r.id}`,subject,date:r.date,source:r.source==='单元测评'?'单元测评':'基础练习',chosen:r.chosen,expected:q.answer,question:q.question,explanation:q.explanation,status:corrected?'corrected':'pending',correctedAt:corrected?r.correctedAt:null,retryId:r.id,stage:null,reason:null,runKind:null,role:null,early:false}));
 }
 // loadStore validates optional loop state. Also fail closed for missing or
 // partially malformed projection input, without changing the source profile.
 const runs=Array.isArray(profile?.learningLoop?.runs)?profile.learningLoop.runs:[];
 const safeRuns=runs.filter(r=>r&&typeof r.id==='string'&&isLoopSubject(r.subject)&&['practice','review'].includes(r.kind)&&Array.isArray(r.answers));
 for(const {run,wrongs} of loopEvidence({learningLoop:{runs:safeRuns.map(r=>({...r,answers:r.answers.filter(a=>a&&a.correct===false)}))}})){
  for(const a of wrongs){
   if(!own(stages,a.role)||!validDate(a.at)||(run.kind==='review'&&a.role==='transfer'))continue;
   const q=answerQuestion(run,a);
   if(a.choice!==null&&!q.choices.includes(a.choice))continue;
   entries.push(Object.freeze({id:`loop:${run.id}:${a.role}`,subject:run.subject,date:a.at,source:run.kind==='review'?'小步复习':'小步引导',chosen:a.choice,expected:q.answer,question:q.question,explanation:q.explanation,status:'loop',correctedAt:null,retryId:null,stage:stages[a.role],reason:a.choice===null?'这次选择了“我还不会”。':own(q.why,a.choice)?q.why[a.choice]:'',runKind:run.kind,role:a.role,early:run.early===true}));
  }
 }
 return entries.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||(a.id<b.id?-1:a.id>b.id?1:0));
}
export function selectWrongPage(profile,options={}){
 const opts=options&&typeof options==='object'?options:{};
 const subject=own(opts,'subject')&&subjectKeys.includes(opts.subject)?opts.subject:'all';
 const kind=own(opts,'kind')&&kinds.includes(opts.kind)?opts.kind:'all';
 const all=collectWrongEntries(profile),counts={all:all.length,pending:0,corrected:0,loop:0};
 for(const e of all)counts[e.status]++;
 const filtered=all.filter(e=>(subject==='all'||e.subject===subject)&&(kind==='all'||e.status===kind));
 const pageCount=Math.ceil(filtered.length/WRONG_PAGE_SIZE);
 const requested=own(opts,'page')&&Number.isSafeInteger(opts.page)&&opts.page>=0?opts.page:0;
 const page=Math.min(requested,Math.max(0,pageCount-1));
 return {entries:filtered.slice(page*WRONG_PAGE_SIZE,(page+1)*WRONG_PAGE_SIZE),page,pageSize:WRONG_PAGE_SIZE,pageCount,total:all.length,filteredTotal:filtered.length,subject,kind,counts};
}
