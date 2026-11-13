import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createStore,getPractice,select,practiceAttempt,hint,advance,finishPractice,startTest,chooseTest,submitTest,retryWrong,loadStore,STORE_KEY} from '../dist/model.js';
import {startLoop,loopAction,loopQuestion,loopBank} from '../dist/loop-model.js';
import {MAX_BACKUP_BYTES,exportProfileBackup,parseProfileBackup,backupPreview,isEmptyBackupTarget,restoreProfileBackup} from '../dist/backup-model.js';
const at='2026-11-13T12:00:00.000Z';
const exported=s=>exportProfileBackup(s,'A',{createdAt:at});
const parsed=s=>parseProfileBackup(exported(s).text);
const invalid=text=>assert.throws(()=>parseProfileBackup(typeof text==='string'?text:JSON.stringify(text)),{code:'INVALID_BACKUP'});
function fixture(){
 const s=createStore(),p=s.profiles.A,t=getPractice(s,'math');
 select(t,'3');practiceAttempt(s,t);hint(t);select(t,'4');practiceAttempt(s,t);advance(t);select(t,'6');practiceAttempt(s,t);advance(t);finishPractice(s,t);
 retryWrong(s,p.wrongs[0].id,'3');retryWrong(s,p.wrongs[0].id,'4');
 const a=startTest(s,'english');['an','an','a','a'].forEach((x,i)=>chooseTest(s,i,x));submitTest(s);
 startTest(s,'chinese');chooseTest(s,0,'暗');
 const r=startLoop(p,'math',{at});act(p,r,'select','3');act(p,r,'submit');act(p,r,'guide',loopBank.math.items[0].steps[0].answer);act(p,r,'next');act(p,r,'guide',loopBank.math.items[0].steps[1].answer);act(p,r,'next');act(p,r,'select','4');act(p,r,'submit');act(p,r,'select','5');act(p,r,'submit');
 return s;
}
function act(p,r,action,value=null){assert.equal(loopAction(p,r.id,r.revision,action,value,at),true);}
test('complete current-profile backup round-trips practice, wrongs, assessment, loop and review without repair',()=>{
 const s=fixture(),before=structuredClone(s),out=exported(s),b=parseProfileBackup(out.text);
 assert.deepEqual(s,before);assert.deepEqual(b.profile,s.profiles.A);assert.equal(out.filename,'xiaobu-profile-A-2026-11-13.json');assert.deepEqual(out.preview,backupPreview(b));
 assert.deepEqual(out.preview.counts,{practices:1,completedPractices:1,wrongs:3,assessments:1,activeTests:1,loopRuns:1,reviews:1});
 assert.ok(Object.isFrozen(b)&&Object.isFrozen(b.profile)&&Object.isFrozen(b.profile.learningLoop.runs));
 const target=createStore(),next=restoreProfileBackup(target,b,'B');assert.equal(next.current,'A');assert.deepEqual(next.profiles.B,s.profiles.A);assert.deepEqual(next.profiles.A,target.profiles.A);assert.notEqual(next.profiles.A,target.profiles.A);assert.deepEqual(target,createStore());
 const loaded=loadStore({getItem:key=>key===STORE_KEY?JSON.stringify(next):null});assert.equal(loaded.warning,'');assert.deepEqual(loaded.store,next);
});
test('only a genuinely empty target can receive a copy; source and other profile are isolated',()=>{
 const source=fixture(),b=parsed(source),target=createStore();getPractice(target,'english');const before=structuredClone(target);
 assert.throws(()=>restoreProfileBackup(target,b,'A'),{code:'TARGET_NOT_EMPTY'});assert.deepEqual(target,before);
 const next=restoreProfileBackup(target,b,'B');assert.deepEqual(next.profiles.A,target.profiles.A);assert.notEqual(next.profiles.B,b.profile);
 assert.throws(()=>restoreProfileBackup(next,b,'B'),{code:'TARGET_NOT_EMPTY'});assert.deepEqual(target,before);
 const emptyLoop=createStore();emptyLoop.profiles.B.learningLoop={version:1,nextId:1,runs:[],reviews:{}};assert.equal(isEmptyBackupTarget(emptyLoop,'B'),true);
});
test('each unfinished practice and paged assessment remains exportable',()=>{
 const s=createStore(),t=getPractice(s,'chinese');parsed(s);select(t,'多');parsed(s);practiceAttempt(s,t);parsed(s);hint(t);parsed(s);select(t,'小');parsed(s);practiceAttempt(s,t);parsed(s);advance(t);parsed(s);
 startTest(s,'math');parsed(s);chooseTest(s,0,'5');parsed(s);s.profiles.A.activeTest.cursor=3;parsed(s);
});
test('all legal guided/review branches and in-flight selections survive validation',()=>{
 for(const subject of ['math','chinese','english'])for(const firstCorrect of [true,false])for(const lastCorrect of [true,false]){
  const s=createStore(),p=s.profiles.A,r=startLoop(p,subject,{at});parsed(s);
  act(p,r,'select',firstCorrect?loopQuestion(r).answer:loopQuestion(r).choices.find(c=>c!==loopQuestion(r).answer));parsed(s);act(p,r,'submit');parsed(s);
  if(!firstCorrect){for(let i=0;i<2;i++){act(p,r,'guide',loopQuestion(r).steps[i].choices[1]);parsed(s);act(p,r,'next');parsed(s);}act(p,r,'skip');parsed(s);}
  act(p,r,'select',lastCorrect?loopQuestion(r).answer:loopQuestion(r).choices.find(c=>c!==loopQuestion(r).answer));parsed(s);act(p,r,'submit');parsed(s);
  const review=startLoop(p,subject,{kind:'review',at});parsed(s);act(p,review,'select',loopQuestion(review).answer);parsed(s);act(p,review,'submit');parsed(s);
 }
});
test('legacy optional assessment cursor and unfinished review are retained',()=>{
 const s=fixture();delete s.profiles.A.activeTest.cursor;const p=s.profiles.A,r=startLoop(p,'math',{kind:'review',at});act(p,r,'skip');act(p,r,'guide',loopQuestion(r).steps[0].answer);
 assert.deepEqual(parsed(s).profile,p);
});
test('unknown fields, sensitive/freeform fields and unsafe prototype spellings are rejected',()=>{
 const good=JSON.parse(exported(fixture()).text);
 for(const patch of [b=>b.name='Child',b=>b.profile.audio='recording',b=>b.profile.wrongs[0].note='private',b=>b.profile.learningLoop.runs[0].prompt='private']){const b=structuredClone(good);patch(b);invalid(b);}
 invalid('{"__proto__":{}}');invalid('{"construc\\u0074or":{}}');invalid('{"prototype":{}}');
 invalid(exported(fixture()).text.replace('"version": 1','"version": 1,"version":1'));
 invalid(exported(fixture()).text.replace('"version": 1','"version": 1,"ver\\u0073ion":1'));
 assert.equal({}.polluted,undefined);
});
test('corrupted wrong/retry, assessment, practice and loop facts never become accepted evidence',()=>{
 const original=JSON.parse(exported(fixture()).text);
 for(const patch of [
  b=>b.profile.wrongs[0].chosen=b.profile.wrongs[0].expected,
  b=>b.profile.wrongs[0].retries[0].correct=true,
  b=>b.profile.wrongs[0].correctedAt=null,
  b=>b.profile.wrongs[0].qid='practice:math:00',
  b=>b.profile.wrongs[0].source='单元测评',
  b=>b.profile.assessments[0].answers[0]=null,
  b=>b.profile.practices.math.records[0].attempts=0,
  b=>b.profile.learningLoop.runs[0].answers[0].correct=true,
  b=>b.profile.learningLoop.runs[0].schedule.days=1,
  b=>b.profile.learningLoop.reviews.math.due='2099-01-01',
  b=>b.profile.wrongs.push(structuredClone(b.profile.wrongs[0])),
  b=>b.profile.assessments.push(structuredClone(b.profile.assessments[0])),
 ]){const b=structuredClone(original);patch(b);invalid(b);}
});
test('invalid versions, profiles, timestamps and structure are rejected',()=>{
 const b=JSON.parse(exported(createStore()).text);
 for(const patch of [{version:2},{format:'another-app'},{sourceProfileId:'C'},{createdAt:'yesterday'},{createdAt:'2026-11-13'},{profile:null}])invalid({...b,...patch});
 for(const text of ['','null','[]','{}','{','true','0','{"x":Infinity}',exported(createStore()).text+' trailing'])invalid(text);
 for(const id of ['C','__proto__',null]){assert.throws(()=>exportProfileBackup(createStore(),id),{code:'INVALID_PROFILE'});assert.throws(()=>restoreProfileBackup(createStore(),parsed(createStore()),id),{code:'INVALID_PROFILE'});}
});
test('input objects with getters, sparse arrays, symbols or exotic prototypes are rejected without invoking getters',()=>{
 for(const mutate of [s=>Object.defineProperty(s.profiles.A,'name',{enumerable:true,get(){throw Error('getter ran');}}),s=>s.profiles.A.wrongs.length=1,s=>s.profiles.A[Symbol('hidden')]='x',s=>Object.setPrototypeOf(s.profiles.A,{})]){const s=createStore();mutate(s);assert.throws(()=>exported(s),{code:'INVALID_BACKUP'});}
 const b=parsed(createStore());const unsafe=Object.create(null);Object.assign(unsafe,b);assert.throws(()=>backupPreview(unsafe),{code:'INVALID_BACKUP'});
});
test('file byte limit is UTF-8-aware and bounded before parsing, with no truncation',()=>{
 assert.equal(MAX_BACKUP_BYTES,2*1024*1024);
 assert.throws(()=>parseProfileBackup(' '.repeat(MAX_BACKUP_BYTES+1)),{code:'BACKUP_TOO_LARGE'});
 assert.throws(()=>parseProfileBackup('字'.repeat(Math.ceil(MAX_BACKUP_BYTES/3))),{code:'BACKUP_TOO_LARGE'});
 const base=exported(createStore()).text,padded=base+' '.repeat(MAX_BACKUP_BYTES-new TextEncoder().encode(base).length);assert.equal(new TextEncoder().encode(padded).length,MAX_BACKUP_BYTES);assert.deepEqual(parseProfileBackup(padded).profile,createStore().profiles.A);
 invalid('['.repeat(20)+']'.repeat(20));
});
test('export has no second-profile records; preview is finite counts, not text or inferred mastery',()=>{
 const s=fixture();s.current='B';const other=getPractice(s,'english');select(other,'an');practiceAttempt(s,other);s.current='A';const out=exported(s);assert.equal(out.text.includes(other.id),false);assert.deepEqual(Object.keys(out.preview).sort(),['counts','createdAt','sourceProfileId']);assert.equal(out.preview.sourceProfileId,'A');
});
test('historical early-review snapshots survive Shanghai/Los Angeles backup restore and load, completed or unfinished',()=>{
 const moduleUrl=new URL('../dist/backup-model.js',import.meta.url).href,modelUrl=new URL('../dist/model.js',import.meta.url).href,loopUrl=new URL('../dist/loop-model.js',import.meta.url).href;
 for(const [sourceTZ,targetTZ] of [['Asia/Shanghai','America/Los_Angeles'],['America/Los_Angeles','Asia/Shanghai']])for(const day of ['12','13','14'])for(const complete of [false,true]){
  const reviewAt=`2026-11-${day}T00:30:00.000Z`;
  const make=`import {createStore} from ${JSON.stringify(modelUrl)};import {startLoop,loopAction,loopQuestion} from ${JSON.stringify(loopUrl)};import {exportProfileBackup} from ${JSON.stringify(moduleUrl)};const s=createStore(),p=s.profiles.A;const r=startLoop(p,'math',{at:'2026-11-10T12:00:00.000Z'});for(const x of [['select','4'],['submit',null],['select','5'],['submit',null]])loopAction(p,r.id,r.revision,...x,'2026-11-10T12:00:00.000Z');const review=startLoop(p,'math',{kind:'review',at:${JSON.stringify(reviewAt)}});if(${complete}){loopAction(p,review.id,review.revision,'select',loopQuestion(review).answer,${JSON.stringify(reviewAt)});loopAction(p,review.id,review.revision,'submit',null,${JSON.stringify(reviewAt)});}console.log(exportProfileBackup(s,'A',{createdAt:'2026-11-15T01:00:00.000Z'}).text);`;
  const text=execFileSync(process.execPath,['--input-type=module','-e',make],{env:{...process.env,TZ:sourceTZ},encoding:'utf8'});
  const check=`import assert from 'node:assert/strict';import {parseProfileBackup,restoreProfileBackup} from ${JSON.stringify(moduleUrl)};import {createStore,loadStore} from ${JSON.stringify(modelUrl)};import {readFileSync} from 'node:fs';const text=readFileSync(0,'utf8'),original=JSON.parse(text),backup=parseProfileBackup(text),next=restoreProfileBackup(createStore(),backup,'B'),loaded=loadStore({getItem:()=>JSON.stringify(next)});assert.equal(loaded.warning,'');assert.deepEqual(loaded.store.profiles.B,original.profile);assert.equal(loaded.store.profiles.B.learningLoop.runs.at(-1).early,original.profile.learningLoop.runs.at(-1).early);`;
  execFileSync(process.execPath,['--input-type=module','-e',check],{input:text,env:{...process.env,TZ:targetTZ},encoding:'utf8'});
 }
});

test('solved practice selection must be the actual answer before advance and after completion',()=>{
 const s=createStore(),t=getPractice(s,'math');select(t,'4');practiceAttempt(s,t);
 assert.deepEqual(parsed(s).profile,s.profiles.A);
 for(const selected of ['3',null]){const b=JSON.parse(exported(s).text);b.profile.practices.math.selected=selected;invalid(b);}
 advance(t);select(t,'6');practiceAttempt(s,t);advance(t);finishPractice(s,t);
 assert.equal(t.complete,true);assert.deepEqual(parsed(s).profile,s.profiles.A);
 for(const selected of ['3',null]){const b=JSON.parse(exported(s).text);b.profile.practices.math.selected=selected;invalid(b);}
});
