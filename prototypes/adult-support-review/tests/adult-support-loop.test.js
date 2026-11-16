import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SUPPORT_SCENARIOS, SUPPORT_REHEARSAL, rehearsalLinks, createSupportSession} from '../adult-evaluation/support-model.js';
const clock=()=> '2026-11-16T08:00:00.000Z';
test('all fixed rehearsal outcomes target existing distinct synthetic scenarios',()=>{
 for(const scene of SUPPORT_SCENARIOS){assert.ok(rehearsalLinks(scene.id).length);for(const link of rehearsalLinks(scene.id)){assert.match(link.label,/^模拟：/);assert.ok(SUPPORT_SCENARIOS.some(s=>s.id===link.target));assert.notEqual(link.target,scene.id);}}
});
test('unknown rehearsal keys have no outcomes and returned links cannot mutate catalogue',()=>{
 for(const key of ['__proto__','constructor','missing'])assert.deepEqual(rehearsalLinks(key),[]);
 const list=rehearsalLinks('new-concept');assert.ok(Object.isFrozen(list));assert.throws(()=>list.push({}),TypeError);assert.ok(Object.isFrozen(SUPPORT_REHEARSAL));
});
test('complete adult rehearsal preserves saved plans without fabricating child outcomes',()=>{
 const s=createSupportSession({now:clock});
 for(const [scene,action,next] of [['new-concept','worked-example','prompted-success'],['prompted-success','independent-check','independent-now'],['independent-now','delayed-check','delayed-transfer'],['delayed-transfer','spaced-mix','new-concept']]){
  assert.equal(s.snapshot().scenarioId,scene);assert.ok(s.choose(action,s.snapshot().revision).ok);assert.ok(s.save(s.snapshot().revision).ok);assert.ok(rehearsalLinks(scene).some(l=>l.target===next));assert.ok(s.select(next,s.snapshot().revision).ok);
 }
 const report=s.exportReport();assert.equal(report.records.length,4);assert.equal(report.scope,'adult-review-only');assert.deepEqual(Object.keys(report.records[0]),['scenarioId','actionId','at']);
});
test('rehearsal navigation uses same draft protection and rejects late callbacks',()=>{
 const s=createSupportSession({now:clock});s.choose('worked-example',0);const rev=s.snapshot().revision;
 assert.equal(s.select('prompted-success',rev).code,'UNSAVED_REVIEW');s.save(rev);assert.equal(s.select('prompted-success',rev,{discard:true}).code,'STALE_REVIEW');assert.equal(s.snapshot().scenarioId,'new-concept');assert.equal(s.snapshot().records.length,1);
});
test('UI labels rehearsal as authored and routes through existing guarded select',()=>{
 const html=readFileSync(new URL('../adult-evaluation/index.html',import.meta.url),'utf8'),js=readFileSync(new URL('../adult-evaluation/support-app.js',import.meta.url),'utf8');
 assert.match(html,/不是实际核查结果或系统预测/);assert.match(js,/select\(link.target,s.revision,b\)/);assert.match(html,/id="support-rehearsal"/);
});
