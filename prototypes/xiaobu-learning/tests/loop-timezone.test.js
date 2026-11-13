import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {validLoopState} from '../dist/loop-model.js';

const model=new URL('../dist/model.js',import.meta.url).href;
const loop=new URL('../dist/loop-model.js',import.meta.url).href;
function run(tz,code,input='') {
 return execFileSync(process.execPath,['--input-type=module','-e',code],{
  input,encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH||'',TZ:tz}
 });
}
function fixture(tz,complete) {
 const base=tz==='Asia/Shanghai'?'2026-11-11T04:00:00.000Z':'2026-11-11T20:00:00.000Z';
 const review=tz==='Asia/Shanghai'?'2026-11-13T20:00:00.000Z':'2026-11-14T04:00:00.000Z';
 return run(tz,`
  import {createStore,currentProfile} from ${JSON.stringify(model)};
  import {startLoop,loopAction,loopQuestion,validLoopState} from ${JSON.stringify(loop)};
  const s=createStore(),p=currentProfile(s),at=new Date(${JSON.stringify(base)});
  const answer=(r,when)=>{loopAction(p,r.id,r.revision,'select',loopQuestion(r).answer,when);loopAction(p,r.id,r.revision,'submit',null,when);};
  const first=startLoop(p,'math',{at});answer(first,at);answer(first,at);
  const when=new Date(${JSON.stringify(review)}),r=startLoop(p,'math',{kind:'review',at:when});
  if(${complete})answer(r,when);
  if(!validLoopState(p.learningLoop))throw Error('invalid source fixture');
  process.stdout.write(JSON.stringify(s));
 `);
}
for(const [origin,target,early] of [['Asia/Shanghai','America/Los_Angeles',false],['America/Los_Angeles','Asia/Shanghai',true]]) {
 for(const complete of [false,true])test(`historical early=${early}, complete=${complete} survives ${origin} → ${target}`,()=>{
  const source=fixture(origin,complete),before=JSON.parse(source);
  assert.equal(before.profiles.A.learningLoop.runs.at(-1).early,early);
  const restored=run(target,`
   import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
   import {loadStore} from ${JSON.stringify(model)};
   import {validLoopState,localDay} from ${JSON.stringify(loop)};
   const raw=readFileSync(0,'utf8'),before=JSON.parse(raw),r=before.profiles.A.learningLoop.runs.at(-1);
   // Prove this is the formerly failing timezone boundary, not just a happy path.
   assert.notEqual(r.early,localDay(r.startedAt)<r.reviewDue);
   const loaded=loadStore({getItem:()=>raw});assert.equal(loaded.warning,'');
   assert.ok(validLoopState(loaded.store.profiles.A.learningLoop));
   assert.deepEqual(loaded.store,before);process.stdout.write(JSON.stringify(loaded.store));
  `,source);
  assert.deepEqual(JSON.parse(restored),before);
 });
}
test('timezone fix retains early type, practice and date constraints',()=>{
 const source=JSON.parse(fixture('Asia/Shanghai',false)).profiles.A.learningLoop;
 for(const value of ['true',null,0,{},[]]){const state=structuredClone(source);state.runs.at(-1).early=value;assert.equal(validLoopState(state),false);}
 const practice=structuredClone(source);practice.runs[0].early=true;assert.equal(validLoopState(practice),false);
 const badDate=structuredClone(source);badDate.runs.at(-1).reviewDue='2026-02-30';assert.equal(validLoopState(badDate),false);
});
