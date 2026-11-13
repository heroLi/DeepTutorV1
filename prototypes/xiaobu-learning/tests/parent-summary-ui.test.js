import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parentSummaryMarkup} from '../dist/parent-summary-ui.js';
import {createStore,currentProfile,startTest,chooseTest,submitTest,units,recordWrong,retryWrong} from '../dist/model.js';
import {startLoop,loopAction,loopQuestion} from '../dist/loop-model.js';
const at=new Date(2026,10,13,12);
test('empty actual records show zero and accessible period controls, never fabricated examples',()=>{
 const html=parentSummaryMarkup(currentProfile(createStore()),{at});
 assert.match(html,/<section class="parent-period-summary" aria-labelledby="parent-period-title">/);
 for(const range of ['7','30','all'])assert.match(html,new RegExp('data-parent-range="'+range+'"'));
 assert.match(html,/data-parent-range="7" aria-pressed="true"/);assert.match(html,/data-parent-refresh/);
 assert.match(html,/id="parent-period-status" role="status" aria-live="polite" aria-atomic="true" tabindex="-1"/);
 assert.match(html,/2026-11-07 至 2026-11-13/);assert.match(html,/没有记录时显示 0，不填示例/);
 assert.equal((html.match(/<strong>0 \/ 0<\/strong>/g)||[]).length,7);
 assert.match(html,/未打开时不会自动更新/);assert.match(html,/仅暂存在本页/);assert.match(html,/下方历史明细不受此日期筛选影响/);
});
test('ranges use local calendar labels and invalid attributes never enter markup',()=>{
 const p=currentProfile(createStore());assert.match(parentSummaryMarkup(p,{range:'30',at}),/2026-10-15 至 2026-11-13/);
 const all=parentSummaryMarkup(p,{range:'all',at});assert.match(all,/全部已记录日期，截至 2026-11-13/);assert.doesNotMatch(all,/null/);
 const invalid=parentSummaryMarkup(p,{range:'"><script>alert(1)</script>',at});assert.match(invalid,/data-parent-range="7" aria-pressed="true"/);assert.doesNotMatch(invalid,/<script>|alert\(1\)/);
});
test('real synthetic assessments, wrong corrections and loop stages retain distinct displayed meanings',()=>{
 const s=createStore(),p=currentProfile(s),t=startTest(s,'math');units.math.items.forEach((q,i)=>chooseTest(s,i,q.answer));submitTest(s);p.assessments[0].completedAt=at.toISOString();t.completedAt=at.toISOString();
 recordWrong(s,'practice:math:0','3','练习');const wrong=p.wrongs.at(-1);wrong.date=at.toISOString();retryWrong(s,wrong.id,'4');wrong.retries[0].date=at.toISOString();wrong.correctedAt=at.toISOString();
 const r=startLoop(p,'math',{at});const act=(action,value=null)=>loopAction(p,r.id,r.revision,action,value,at);
 act('skip');for(let i=0;i<2;i++){act('guide',loopQuestion(r).steps[i].answer);act('next');}act('select',loopQuestion(r).answer);act('submit');act('select',loopQuestion(r).answer);act('submit');
 const before=JSON.stringify(p),html=parentSummaryMarkup(p,{at});assert.equal(JSON.stringify(p),before);
 assert.match(html,/<strong>1<\/strong><span>已交卷测评/);assert.match(html,/<strong>1<\/strong><span>小步练习完成轮/);
 assert.match(html,/本期已交卷测评：<strong>4 \/ 4<\/strong>/);
 assert.match(html,/小步练习 · 首次独立选择<\/span><strong>0 \/ 1/);assert.match(html,/小步练习 · 引导后原题再试<\/span><strong>1 \/ 1/);
 assert.match(html,/引导步骤 · 选择（练习与复习合计）<\/span><strong>2 \/ 2/);assert.match(html,/原错题记录<\/span><strong>1 条/);
 assert.match(html,/引导后再试与引导步骤不是独立作答/);assert.match(html,/没有完整时间记录/);assert.match(html,/不计算学习时长/);
});
test('future or invalid event dates produce safe notices without reflecting original content',()=>{
 const p=currentProfile(createStore());p.practiceCompleted.push({id:'<img src=x>',date:'2027-01-01T12:00:00.000Z',subject:'math',records:[]},{id:'bad',date:'<script>private</script>',subject:'math',records:[]});
 const html=parentSummaryMarkup(p,{at});assert.match(html,/时间晚于今天/);assert.match(html,/记录无法用于统计/);assert.doesNotMatch(html,/<img|<script>|private/);
});
test('summary UI contains no network, download or persistent state operations',()=>{
 const source=fs.readFileSync(new URL('../dist/parent-summary-ui.js',import.meta.url),'utf8');assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|downloadBackup|XMLHttpRequest/);
});
