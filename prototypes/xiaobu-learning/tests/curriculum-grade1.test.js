import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {grade1,makeTen,startGrade1,grade1Step} from '../dist/curriculum-grade1-model.js';
import {catalog,createRound} from '../dist/curriculum-model.js';
import {startParentFlowPreview} from '../dev/parent-flow-preview.js';

test('Shanghai G1 books keep evidence scoped and three original tap choices per topic',()=>{
 assert.equal(grade1.grade,1);
 assert.equal(grade1.term,'上册');
 assert.equal(grade1.completeContentsVerified,false);
 assert.equal(grade1.schoolMatchVerified,false);
 assert.deepEqual(grade1.subjects.map(s=>s.label),['语文','数学','英语']);
 for(const s of grade1.subjects){
  assert.equal(s.questions.length,3);
  assert.ok(s.evidence.length>=2);
  for(const e of s.evidence){
   assert.equal(new URL(e.url).protocol,'https:');
   assert.ok(e.scope);
  }
  for(const q of s.questions){
   assert.equal(new Set(q.choices).size,3);
   assert.ok(q.choices.includes(q.answer)&&q.hint&&q.why);
  }
 }
 assert.match(grade1.subjects[2].evidence[1].scope,/Unit 6 My family/);
});

test('every G1 topic supports hint, retry, feedback, completion, and explicit fresh state; G3 is independent',()=>{
 assert.equal(startGrade1('bad'),null);
 for(const s of grade1.subjects){
  const g3=createRound(s.id,()=>0.1);
  const original=JSON.stringify(g3);
  let g1=startGrade1(s.id);
  assert.equal(grade1Step(g1,'next'),g1);
  assert.equal(grade1Step(g1,'choose','x'),g1);
  g1=grade1Step(g1,'hint');assert.equal(g1.hint,true);
  g1=grade1Step(g1,'choose',s.questions[0].choices.find(c=>c!==s.questions[0].answer));
  assert.equal(g1.phase,'retry');
  assert.equal(grade1Step(g1,'next'),g1);
  g1=grade1Step(g1,'retry');assert.equal(g1.phase,'answer');
  for(const q of s.questions){
   g1=grade1Step(g1,'choose',q.answer);assert.equal(g1.phase,'feedback');
   g1=grade1Step(g1,'next');
  }
  assert.equal(g1.phase,'complete');
  assert.equal(grade1Step(g1,'hint'),g1);
  assert.deepEqual(startGrade1(s.id),{id:s.id,index:0,phase:'answer',hint:false});
  assert.equal(JSON.stringify(g3),original);
 }
 assert.equal(catalog.length,3);
});

test('preview serves G1 and G3 via distinct linked pages and blocks active connections and capture',async(t)=>{
 const preview=await startParentFlowPreview();
 t.after(()=>preview.close());
 const home=await fetch(preview.origin);
 assert.match(await home.text(),/curriculum-grade1\.html[\s\S]+curriculum\.html/);
 for(const [page,title,cross] of [['curriculum-grade1.html','上海一年级上册','切换到三年级'],['curriculum.html','上海三年级','切换到一年级']]){
  const r=await fetch(preview.origin+'/'+page);
  assert.equal(r.status,200);
  assert.match(r.headers.get('content-security-policy'),/connect-src 'none'/);
  assert.match(r.headers.get('permissions-policy'),/microphone=\(\)/);
  const html=await r.text();
  assert.match(html,new RegExp(title));
  assert.match(html,new RegExp(cross));
  if(page.includes('grade1')) assert.doesNotMatch(html,/<(?:input|textarea|form)\b/);
 }
 for(const asset of ['curriculum-grade1-ui.js','curriculum-grade1-model.js','curriculum-grade1.css']){
  const r=await fetch(preview.origin+'/'+asset);
  assert.equal(r.status,200);
  assert.match(r.headers.get('content-type'),asset.endsWith('.js')?/javascript/:/css/);
  await r.text();
 }
 for(const js of ['curriculum-grade1-ui.js','curriculum-grade1-model.js']){
  const body=await readFile(new URL('../dist/'+js,import.meta.url),'utf8');
  assert.doesNotMatch(body,/localStorage|sessionStorage|indexedDB|getUserMedia|\bfetch\(/);
 }
});

test('G1 controls run the rendered first-question flow and return focus to the subject picker',async()=>{
 const originalDocument=globalThis.document;
 const el=()=>({innerHTML:'',events:{},focusCount:0,addEventListener(name,fn){this.events[name]=fn;},querySelector(){return {focus:()=>{this.focusCount++;}};}});
 const picker=el(),view=el();
 globalThis.document={getElementById:id=>id==='g1-subjects'?picker:view};
 try{
  await import('../dist/curriculum-grade1-ui.js');
  assert.match(picker.innerHTML,/练习语文[\s\S]+练习数学[\s\S]+练习英语/);
  const press=(target,dataset)=>target.events.click({target:{closest:()=>({dataset})}});
  press(picker,{start:'chinese'});
  assert.match(view.innerHTML,/第 1 题/);
  press(view,{action:'hint'});
  assert.match(view.innerHTML,/提示：/);
  press(view,{action:'choose',choice:'1'});
  assert.match(view.innerHTML,/再选一次/);
  press(view,{action:'retry'});
  press(view,{action:'choose',choice:'0'});
  assert.match(view.innerHTML,/答对了/);
  press(view,{action:'next'});
  assert.match(view.innerHTML,/第 2 题/);
  press(view,{action:'choose',choice:'1'});press(view,{action:'next'});
  press(view,{action:'choose',choice:'2'});press(view,{action:'next'});
  assert.match(view.innerHTML,/3 题完成/);
  press(view,{action:'restart'});
  assert.match(view.innerHTML,/第 1 题/);
  for(const choice of ['0','1','2']){press(view,{action:'choose',choice});press(view,{action:'next'});}
  press(view,{action:'close'});
  assert.equal(view.innerHTML,'');
  assert.equal(picker.focusCount,1);
  assert.ok(view.focusCount>0);
 } finally {
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
 }
});

test('optional make-ten round preserves 8 + 5 as 8 + 2 + 3 across visual stages',()=>{
 const [fill,split,total]=makeTen.questions;
 assert.deepEqual(makeTen.questions.map(q=>q.answer),['2','3','13']);
 assert.deepEqual(makeTen.questions.map(q=>Object.values(q.frame)),[[8,0,5],[8,2,3],[8,2,3]]);
 assert.ok(makeTen.questions.every(({frame:{base,moved,remaining}})=>moved+remaining===5&&base+moved<=10));
 assert.match(split.why,/5 拆成 2 和 3/);
 assert.match(total.why,/先凑成 10，再加 3，等于 13/);
 assert.equal(startGrade1('math').id,'math');
 assert.equal(grade1.subjects.find(s=>s.id==='math').questions.length,3);
 assert.equal(fill.frame.moved,0);
 let extension=startGrade1(makeTen.id);
 for(const q of makeTen.questions){
  const wrong=q.choices.find(c=>c!==q.answer);
  extension=grade1Step(extension,'choose',wrong);assert.equal(extension.phase,'retry');
  extension=grade1Step(extension,'retry');
  extension=grade1Step(extension,'choose',q.answer);assert.equal(extension.phase,'feedback');
  extension=grade1Step(extension,'next');
 }
 assert.equal(extension.phase,'complete');
});

test('visual math extension links scoped source, represents ten grid cells and gives a screen-reader description at each stage',async()=>{
 const originalDocument=globalThis.document;
 const el=()=>({innerHTML:'',events:{},addEventListener(name,fn){this.events[name]=fn;},querySelector(){return {focus(){}};}});
 const picker=el(),view=el();
 globalThis.document={getElementById:id=>id==='g1-subjects'?picker:view};
 try{
  await import('../dist/curriculum-grade1-ui.js?ten-frame-test');
  assert.match(picker.innerHTML,/试做凑十拓展/);
  assert.match(picker.innerHTML,/32470/);
  const press=(target,dataset)=>target.events.click({target:{closest:()=>({dataset})}});
  press(picker,{start:'math'});
  assert.doesNotMatch(view.innerHTML,/g1-ten-frame/);
  press(picker,{start:makeTen.id});
  assert.match(view.innerHTML,/第 1 题 \/ 3/);
  assert.match(view.innerHTML,/role="img" aria-label="十格框里原有 8 颗，还有 2 个空格，框外有 5 颗"/);
  assert.equal((view.innerHTML.match(/g1-dot g1-empty/g)||[]).length,2);
  assert.equal((view.innerHTML.match(/g1-dot /g)||[]).length,15);
  press(view,{action:'choose',choice:'0'});press(view,{action:'next'});
  assert.match(view.innerHTML,/role="img" aria-label="十格框里原有 8 颗，移入 2 颗，十格框已经填满，框外有 3 颗"/);
  assert.doesNotMatch(view.innerHTML,/g1-dot g1-empty/);
  assert.equal((view.innerHTML.match(/g1-dot /g)||[]).length,13);
  press(view,{action:'choose',choice:'1'});press(view,{action:'next'});
  assert.match(view.innerHTML,/第 3 题 \/ 3/);
  press(view,{action:'choose',choice:'2'});
  assert.match(view.innerHTML,/先凑成 10，再加 3，等于 13/);
  press(view,{action:'next'});
  assert.match(view.innerHTML,/3 题完成/);
 } finally {
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
 }
});
