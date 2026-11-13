import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,recordWrong,retryWrong} from '../dist/model.js';
import {startLoop,loopAction,loopQuestion} from '../dist/loop-model.js';
import {collectWrongEntries,selectWrongPage,WRONG_PAGE_SIZE} from '../dist/wrong-notebook.js';
const at=new Date('2026-11-13T12:00:00.000Z');
function base(p,subject='math',i=0,corrected=false){const choices={math:'3',chinese:'多',english:'an'};p.wrongs.push({id:`wrong-${i}`,qid:`practice:${subject}:0`,chosen:choices[subject],expected:subject==='math'?'4':subject==='chinese'?'小':'a',source:'练习',date:new Date(at.getTime()+i*1000).toISOString(),correctedAt:corrected?at.toISOString():null,retries:[]});}
function action(p,r,type,value){assert.equal(loopAction(p,r.id,r.revision,type,value,at),true);}
function loop(p,subject='math',{kind='practice',retryCorrect=false,firstCorrect=false,transferCorrect=false}={}){
 const r=startLoop(p,subject,{kind,at,restart:true});
 if(firstCorrect){action(p,r,'select',loopQuestion(r).answer);action(p,r,'submit');}else action(p,r,'skip');
 if(!firstCorrect){for(let i=0;i<2;i++){action(p,r,'guide',loopQuestion(r).steps[i].answer);action(p,r,'next');}if(retryCorrect){action(p,r,'select',loopQuestion(r).answer);action(p,r,'submit');}else action(p,r,'skip');}
 if(kind==='practice'){if(transferCorrect){action(p,r,'select',loopQuestion(r).answer);action(p,r,'submit');}else action(p,r,'skip');}
 return r;
}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
test('empty and missing optional loops project safely with zero pages',()=>{
 for(const p of [undefined,null,{},createStore().profiles.A,{learningLoop:{runs:null}}]){assert.deepEqual(collectWrongEntries(p),[]);const page=selectWrongPage(p);assert.equal(page.page,0);assert.equal(page.pageCount,0);assert.equal(page.total,0);assert.equal(page.filteredTotal,0);assert.equal(page.pageSize,6);}
});
test('foundation and assessment entries preserve choice, correction and original retry ID',()=>{
 const store=createStore(),p=store.profiles.A;recordWrong(store,'practice:math:0','3','练习');recordWrong(store,'test:english:1',null,'单元测评');retryWrong(store,p.wrongs[0].id,'4');
 const entries=collectWrongEntries(p),practice=entries.find(e=>e.source==='基础练习'),assessment=entries.find(e=>e.source==='单元测评');
 assert.equal(practice.retryId,p.wrongs[0].id);assert.equal(practice.chosen,'3');assert.equal(practice.expected,'4');assert.equal(practice.status,'corrected');assert.equal(practice.correctedAt,p.wrongs[0].correctedAt);
 assert.equal(assessment.status,'pending');assert.equal(assessment.chosen,null);assert.equal(assessment.expected,'an');assert.match(assessment.question,/egg/);
});
test('separate profiles do not leak records and repeated errors are not deduplicated',()=>{
 const {profiles:{A,B}}=createStore();for(let i=0;i<3;i++)base(A,'math',i);base(B,'english',50);
 assert.equal(collectWrongEntries(A).length,3);assert.deepEqual(collectWrongEntries(B).map(e=>e.subject),['english']);assert.equal(new Set(collectWrongEntries(A).map(e=>e.id)).size,3);
});
test('loop first/retry/transfer select their actual question and remain separate historical errors',()=>{
 const p=createStore().profiles.A,r=loop(p);const entries=collectWrongEntries(p);assert.equal(entries.length,3);
 for(const e of entries){assert.equal(e.runKind,'practice');assert.equal(e.status,'loop');assert.equal(e.retryId,null);assert.equal(e.correctedAt,null);assert.equal(e.chosen,null);assert.match(e.reason,/还不会/);assert.match(e.id,new RegExp(r.id));}
 assert.match(entries.find(e=>e.role==='first').question,/12 颗糖/);assert.match(entries.find(e=>e.role==='retry').question,/12 颗糖/);assert.match(entries.find(e=>e.role==='transfer').question,/20 块积木/);
 assert.equal(entries.find(e=>e.role==='first').stage,'首次选择');assert.equal(entries.find(e=>e.role==='retry').stage,'引导后原题');assert.equal(entries.find(e=>e.role==='transfer').stage,'同类新题');
});
test('later correct retry and transfer never fabricate correction of loop evidence',()=>{
 const p=createStore().profiles.A;loop(p,'math',{retryCorrect:true,transferCorrect:true});const [e]=collectWrongEntries(p);assert.equal(collectWrongEntries(p).length,1);assert.equal(e.role,'first');assert.equal(e.status,'loop');assert.equal(e.correctedAt,null);
 assert.equal(selectWrongPage(p,{kind:'corrected'}).filteredTotal,0);assert.equal(selectWrongPage(p,{kind:'pending'}).filteredTotal,0);
});
test('review first and assisted retry use fixed review question, not transfer; guides excluded',()=>{
 const p=createStore().profiles.A;loop(p,'math',{firstCorrect:true,transferCorrect:true});const r=loop(p,'math',{kind:'review'});
 const entries=collectWrongEntries(p);assert.equal(entries.length,2);for(const e of entries){assert.equal(e.runKind,'review');assert.equal(e.source,'小步复习');assert.match(e.question,/18 支笔/);assert.equal(e.early,r.early);assert.equal(e.expected,'3');assert.notEqual(e.role,'transfer');}
});
test('selected wrong choices retain authored phase-specific reason for every subject',()=>{
 for(const subject of ['math','chinese','english']){const p=createStore().profiles.A,r=startLoop(p,subject,{at});const q=loopQuestion(r),chosen=q.choices.find(c=>c!==q.answer);action(p,r,'select',chosen);action(p,r,'submit');const [e]=collectWrongEntries(p);assert.equal(e.chosen,chosen);assert.equal(e.reason,q.why[chosen]);assert.equal(e.expected,q.answer);}
});
test('sort is newest timestamp first including offset strings, deterministic identity ties',()=>{
 const p=createStore().profiles.A;for(let i=0;i<3;i++)base(p,'math',i);
 p.wrongs[0].date='2026-11-13T20:00:00+08:00';p.wrongs[1].date='2026-11-13T12:00:00Z';p.wrongs[2].date='2026-11-13T12:00:01Z';
 assert.deepEqual(collectWrongEntries(p).map(e=>e.id),['base:wrong-2','base:wrong-0','base:wrong-1']);p.wrongs.reverse();assert.deepEqual(collectWrongEntries(p).map(e=>e.id),['base:wrong-2','base:wrong-0','base:wrong-1']);
});
test('all subject/status combinations give independent counts and bounded pages',()=>{
 const p=createStore().profiles.A;for(let i=0;i<21;i++)base(p,['math','chinese','english'][i%3],i,i%2===0);for(const s of ['math','chinese','english'])loop(p,s);
 const all=collectWrongEntries(p);for(const subject of ['all','math','chinese','english'])for(const kind of ['all','pending','corrected','loop']){
  const expected=all.filter(e=>(subject==='all'||e.subject===subject)&&(kind==='all'||e.status===kind));const result=selectWrongPage(p,{subject,kind,page:999});assert.equal(result.filteredTotal,expected.length);assert.equal(result.total,30);assert.deepEqual(result.counts,{all:30,pending:10,corrected:11,loop:9});assert.equal(result.pageCount,Math.ceil(expected.length/6));assert.deepEqual(result.entries,expected.slice(result.page*6,(result.page+1)*6));assert.ok(result.entries.length<=WRONG_PAGE_SIZE);
 }
});
test('page clamp after correction and invalid options never escape whitelist',()=>{
 const p=createStore().profiles.A;for(let i=0;i<7;i++)base(p,'math',i);assert.equal(selectWrongPage(p,{kind:'pending',page:1}).entries.length,1);p.wrongs[0].correctedAt=at.toISOString();const result=selectWrongPage(p,{kind:'pending',page:1});assert.equal(result.page,0);assert.equal(result.entries.length,6);
 for(const options of [null,undefined,'math',{subject:'__proto__',kind:'constructor',page:Infinity},{subject:'toString',kind:'prototype',page:-1},Object.create({subject:'math',kind:'loop',page:10}),{page:1.5},{page:'1'}]){const r=selectWrongPage(p,options);assert.equal(r.subject,'all');assert.equal(r.kind,'all');assert.equal(r.page,0);}
});
test('frozen sources stay intact; detached entries and page arrays cannot modify records',()=>{
 const p=createStore().profiles.A;base(p);loop(p);const before=structuredClone(p);freeze(p);const a=collectWrongEntries(p),b=collectWrongEntries(p);assert.deepEqual(a,b);assert.notEqual(a[0],b[0]);assert.ok(Object.isFrozen(a[0]));a.splice(0);const page=selectWrongPage(p);page.counts.all=0;page.entries.pop();assert.deepEqual(p,before);assert.equal(selectWrongPage(p).total,4);
});
test('invalid/inherited question identifiers and unknown loop roles are skipped safely',()=>{
 const p={wrongs:[{id:'evil',qid:'practice:__proto__:0',date:at.toISOString(),chosen:null},{id:'bad',qid:'practice:math:2',date:at.toISOString(),chosen:null}],learningLoop:{runs:[null,{id:'evil',subject:'constructor',kind:'practice',answers:[]},{id:'bad',subject:'math',kind:'practice',answers:[null,{role:'__proto__',correct:false,at:at.toISOString(),choice:null}]}]}};assert.deepEqual(collectWrongEntries(p),[]);
});
