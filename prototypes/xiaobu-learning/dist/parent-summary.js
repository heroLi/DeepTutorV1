import {units} from './model.js';

const stageDefinitions=[
 ['practiceFirst','小步练习 · 首次作答'],
 ['practiceRetry','小步练习 · 引导后原题（非独立）'],
 ['transfer','小步练习 · 同类新题'],
 ['reviewFirst','小步复习 · 首次作答'],
 ['reviewRetry','小步复习 · 引导后原题（非独立）'],
 ['guide','引导步骤选择（练习与复习合计）']
];
const array=value=>Array.isArray(value)?value:[];
const day=date=>`${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const freeze=value=>{Object.values(value).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(value);};
// Read-only dated evidence, not inferred mastery, duration or daily streaks.
export function summarizeParent(profile,options={}){
 const opts=options&&typeof options==='object'?options:{};
 const range=Object.hasOwn(opts,'range')&&['7','30','all'].includes(opts.range)?opts.range:'7';
 const at=Object.hasOwn(opts,'at')?new Date(opts.at):new Date();
 if(!Number.isFinite(at.getTime()))throw new RangeError('Invalid summary date');
 const toDay=day(at),start=new Date(at);start.setHours(12,0,0,0);
 if(range!=='all')start.setDate(start.getDate()-(Number(range)-1));
 const fromDay=range==='all'?null:day(start);
 const summary={range,fromDay,toDay,completion:{practice:0,assessment:0,loopPractice:0,loopReview:0},assessment:{correct:0,total:0},stages:stageDefinitions.map(([key,label])=>({key,label,attempts:0,correct:0})),wrongs:{base:0,loop:0,correctedRecords:0},futureEvents:0,invalidEvents:0};
 // Call exactly once per source event, even when it contributes to two totals.
 const included=value=>{
  if(typeof value!=='string'||!value.trim()||!Number.isFinite(Date.parse(value))){summary.invalidEvents++;return false;}
  const eventDay=day(new Date(value));
  if(eventDay>toDay){summary.futureEvents++;return false;}
  return fromDay===null||eventDay>=fromDay;
 };
 for(const record of array(profile?.practiceCompleted))if(included(record?.date))summary.completion.practice++;
 // activeTest is intentionally ignored: submitted tests also live in assessments.
 for(const test of array(profile?.assessments)){
  if(!included(test?.completedAt))continue;
  summary.completion.assessment++;
  const questions=typeof test?.subject==='string'&&Object.hasOwn(units,test.subject)?units[test.subject].items:[];
  for(const [i,q] of questions.entries())if(array(test.answers)[i]!==undefined&&q.choices.includes(test.answers[i])){summary.assessment.total++;if(test.answers[i]===q.answer)summary.assessment.correct++;}
 }
 for(const record of array(profile?.wrongs)){
  if(included(record?.date))summary.wrongs.base++;
  let corrected=false;
  for(const retry of array(record?.retries)){const inRange=included(retry?.date);if(inRange&&retry?.correct===true)corrected=true;}
  if(corrected)summary.wrongs.correctedRecords++;
 }
 for(const run of array(profile?.learningLoop?.runs)){
  if(!run||!['practice','review'].includes(run.kind))continue;
  if(run.completedAt!==null&&run.completedAt!==undefined&&included(run.completedAt))summary.completion[run.kind==='practice'?'loopPractice':'loopReview']++;
  for(const answer of array(run.answers)){
   const inRange=included(answer?.at);
   const key=answer?.role==='first'?(run.kind==='practice'?'practiceFirst':'reviewFirst'):answer?.role==='retry'?(run.kind==='practice'?'practiceRetry':'reviewRetry'):answer?.role==='transfer'&&run.kind==='practice'?'transfer':null;
   if(!inRange||!key||typeof answer.correct!=='boolean')continue;
   const stage=summary.stages.find(s=>s.key===key);stage.attempts++;if(answer.correct)stage.correct++;else summary.wrongs.loop++;
  }
  for(const guide of array(run.guides)){
   if(!included(guide?.at)||typeof guide.correct!=='boolean')continue;
   const stage=summary.stages[5];stage.attempts++;if(guide.correct)stage.correct++;
  }
 }
 return freeze(summary);
}
