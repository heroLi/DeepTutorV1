import test from 'node:test';import assert from 'node:assert/strict';
import {catalog,createRound,choose,retry,next,evidence,source} from '../dist/curriculum-model.js';
import {startParentFlowPreview} from '../dev/parent-flow-preview.js';
for(const s of catalog){test(`${s.id}: original round preserves wrong and assisted evidence`,()=>{const r=createRound(s.id);assert.equal(choose(r,'invalid'),false);assert.equal(next(r),false);const q=s.questions[0];choose(r,q.choices.find(x=>x!==q.answer));assert.equal(r.phase,'hint');assert.equal(choose(r,q.answer),false);retry(r);choose(r,q.answer);next(r);for(const following of s.questions.slice(1)){assert.equal(r.phase,'answer');choose(r,following.answer);next(r);}assert.equal(r.phase,'complete');assert.deepEqual(evidence(r).map(x=>[x.correct,x.assisted]),[[false,false],[true,true],...s.questions.slice(1).map(()=>[true,false])]);assert.equal(next(r),false);});}
test('catalog has three subjects, valid originals, and official source',()=>{assert.equal(catalog.length,3);assert.match(source.url,/^https:\/\/edu.sh.gov.cn\//);assert.throws(()=>createRound('__proto__'));for(const s of catalog){assert.equal(s.questions.length,3);for(const q of s.questions){assert.equal(new Set(q.choices).size,q.choices.length);assert.ok(q.choices.includes(q.answer));assert.ok(q.hint&&q.reason);}}});
test('local-only curriculum route serves without altering original app',async()=>{const p=await startParentFlowPreview();try{for(const path of ['curriculum.html','curriculum.css','curriculum-model.js','curriculum-ui.js'])assert.equal((await fetch(p.origin+'/'+path)).status,200);assert.match(await(await fetch(p.origin)).text(),/curriculum.html/);assert.match((await fetch(p.origin+'/curriculum.html')).headers.get('content-security-policy'),/connect-src 'none'/);}finally{await p.close();}});

for(const subject of catalog){test(`${subject.id}: last-item hint, restart and immutable evidence`,()=>{
 const r=createRound(subject.id);
 for(const q of subject.questions.slice(0,-1)){assert.equal(choose(r,q.answer),true);assert.equal(choose(r,q.answer),false);assert.equal(retry(r),false);next(r);}
 assert.equal(r.index,subject.questions.length-1);
 const q=subject.questions.at(-1);
 choose(r,q.choices.find(x=>x!==q.answer)); assert.equal(next(r),false); retry(r);
 choose(r,q.choices.find(x=>x!==q.answer)); retry(r); choose(r,q.answer); next(r);
 assert.equal(r.phase,'complete'); assert.equal(choose(r,q.answer),false); assert.equal(retry(r),false);
 const snapshot=evidence(r); snapshot[0].correct=false; snapshot.push({index:999});
 assert.equal(evidence(r)[0].correct,true); assert.equal(evidence(r).length,subject.questions.length+2);
 assert.equal(evidence(r).at(-1).assisted,true);
 const restarted=createRound(subject.id); assert.deepEqual(restarted.answers,[]); assert.equal(restarted.assisted,false); assert.equal(restarted.index,0);
});}
test('subject changes cannot mutate another round',()=>{
 const first=createRound('math');choose(first,catalog.find(s=>s.id==='math').questions[0].answer);
 const second=createRound('english');assert.deepEqual(second.answers,[]);assert.equal(first.phase,'feedback');
});
