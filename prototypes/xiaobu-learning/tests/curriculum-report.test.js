import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,createRound,choose,retry,next,roundReport} from '../dist/curriculum-model.js';
for(const subject of catalog){
 test(`${subject.id}: report distinguishes original wrong choices from assisted success`,()=>{
  const round=createRound(subject.id);
  assert.throws(()=>roundReport(round),/ROUND_NOT_COMPLETE/);
  const first=subject.questions[0];choose(round,first.choices.find(c=>c!==first.answer));
  assert.throws(()=>roundReport(round),/ROUND_NOT_COMPLETE/);retry(round);
  choose(round,first.choices.find(c=>c!==first.answer));retry(round);choose(round,first.answer);next(round);
  for(const q of subject.questions.slice(1)){choose(round,q.answer);next(round);}
  const before=JSON.stringify(round),report=roundReport(round);
  assert.equal(JSON.stringify(round),before);
  assert.match(report,/首次无提示答对：2 题；提示后答对：1 题/);
  assert.match(report,/第 3 次选择/);assert.match(report,/未正确；未看提示/);
  assert.match(report,/未正确；已看提示/);assert.match(report,/正确；已看提示/);
  assert.match(report,/成人合成自测报告/);assert.match(report,/完整单元目录仍待核实/);
  assert.match(report,/https:\/\/edu.sh.gov.cn\//);assert.match(report,/不上传、不自动保存/);
  for(const q of subject.questions)assert.ok(report.includes(q.text)&&report.includes(q.reason));
  assert.equal(roundReport(round),report);
 });
 test(`${subject.id}: report counts every first correct answer without a mastery score`,()=>{
  const round=createRound(subject.id);for(const q of subject.questions){choose(round,q.answer);next(round);}
  const report=roundReport(round);assert.match(report,/首次无提示答对：3 题；提示后答对：0 题/);
  assert.doesNotMatch(report,/%|掌握率|能力分/);
 });
}

for(const subject of catalog){
 test(`${subject.id}: standalone report retains historical source access limits`,()=>{
  const round=createRound(subject.id);
  for(const q of subject.questions){choose(round,q.answer);next(round);}
  const report=roundReport(round);
  assert.match(report,/报告格式：4/);
  assert.match(report,/目录证据年份：2024/);
  assert.match(report,/不证明 2026 年学校实际选用/);
  assert.match(report,/对应条目一致，未做文件字节比对/);
  assert.match(report,/教育部原链接（已核对索引文本）：https:\/\/www.moe.gov.cn\//);
  if(subject.id==='math'){
   assert.match(report,/主编李大潜.*印刷页码 3（PDF 第 3 页）/);
   assert.match(report,/#page=3/);
   assert.doesNotMatch(report,/主编束定芳|主编张春柏/);
  }else if(subject.id==='english'){
   assert.match(report,/五四学制｜主编束定芳.*印刷页码 6（PDF 第 6 页）/);
   assert.match(report,/书名未标五四学制｜主编张春柏、施嘉平.*印刷页码 5（PDF 第 5 页）/);
   assert.match(report,/#page=6/);assert.match(report,/#page=5/);
  }else{
   assert.match(report,/候选书系对照：语文.*主编温儒敏、王立军.*印刷页码 1（PDF 第 1 页）/);
   assert.match(report,/#page=1/);
  }
 });
}
