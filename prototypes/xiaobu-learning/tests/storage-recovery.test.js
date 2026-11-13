import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,loadStore,saveStore,STORE_KEY,getPractice,clearProfile,switchProfile,startTest} from '../dist/model.js';
import {startLoop} from '../dist/loop-model.js';
import {createLearningStorage} from '../dist/storage-coordinator.js';
import {persistBackupRestore} from '../dist/backup-ui.js';
import {parseProfileBackup,exportProfileBackup,restoreProfileBackup} from '../dist/backup-model.js';
const createdAt='2026-11-13T12:00:00.000Z';
function backend(raw){return {raw,reads:0,writes:0,fail:false,getItem(){this.reads++;if(this.fail)throw Error('unavailable');return this.raw;},setItem(k,v){assert.equal(k,STORE_KEY);this.writes++;this.raw=v;}};}
const invalids=[['{synthetic-broken-json','invalid-json'],['','invalid-json'],['null','invalid-schema'],['[]','invalid-schema'],['{}','invalid-schema'],[JSON.stringify({...createStore(),version:2}),'unknown-version']];
test('structured status distinguishes empty, valid, unreadable and all malformed inputs',()=>{
 assert.equal(loadStore(backend(null)).status,'empty');assert.equal(loadStore(backend(JSON.stringify(createStore()))).status,'valid');assert.equal(loadStore({getItem(){throw Error();}}).status,'unreadable');
 for(const [raw,status] of invalids){assert.equal(loadStore(backend(raw)).status,status);const s=backend(raw),c=createLearningStorage({storage:s});assert.deepEqual(c.getState(),{mode:'temporary',reason:status});assert.equal(c.check(),true);assert.equal(c.load().status,status);assert.equal(s.reads,1);}
});
test('protected raw refuses direct writes before load or any recovery action',()=>{
 for(const [raw] of invalids){const s=backend(raw),c=createLearningStorage({storage:s});assert.throws(()=>c.storage.setItem(STORE_KEY,JSON.stringify(createStore())),{code:'STORAGE_TEMPORARY'});const {store}=c.load();getPractice(store,'math');assert.notEqual(saveStore(c.storage,store),'');switchProfile(store,'B');clearProfile(store);startLoop(store.profiles.B,'math');assert.notEqual(saveStore(c.storage,store),'');assert.throws(()=>persistBackupRestore(c.storage,store,createStore()));assert.equal(s.raw,raw);assert.equal(s.writes,0);}
});
test('invalid optional loop preserves base and other profile in memory without sanitizing raw',()=>{
 const store=createStore();getPractice(store,'math');store.profiles.A.learningLoop={version:999};switchProfile(store,'B');getPractice(store,'english');const raw=JSON.stringify(store),s=backend(raw),c=createLearningStorage({storage:s});const loaded=c.load();assert.equal(loaded.status,'partial-invalid-loop');assert.ok(loaded.store.profiles.A.practices.math);assert.ok(loaded.store.profiles.B.practices.english);assert.equal(loaded.store.profiles.A.learningLoop,undefined);assert.notEqual(saveStore(c.storage,loaded.store),'');assert.equal(s.raw,raw);assert.equal(s.writes,0);
});
test('invalid one-profile schema recovers independently valid other profile without rewrite',()=>{
 const store=createStore();switchProfile(store,'B');getPractice(store,'chinese');store.profiles.A={bad:true};const raw=JSON.stringify(store),s=backend(raw),c=createLearningStorage({storage:s});const result=c.load();assert.equal(result.status,'invalid-schema');assert.ok(result.store.profiles.B.practices.chinese);assert.deepEqual(result.store.profiles.A,createStore().profiles.A);assert.notEqual(saveStore(c.storage,result.store),'');assert.equal(s.raw,raw);
});
test('normal null/valid/legacy optional cursor saves remain available',()=>{
 for(const raw of [null,JSON.stringify(createStore()),(()=>{const s=createStore();startTest(s,'math');delete s.profiles.A.activeTest.cursor;return JSON.stringify(s);})()]){const s=backend(raw),c=createLearningStorage({storage:s});assert.equal(c.getState().mode,'persistent');assert.equal(saveStore(c.storage,c.load().store),'');assert.equal(s.writes,1);assert.throws(()=>c.exportRecoverySnapshot(),{code:'RECOVERY_UNAVAILABLE'});}
});
test('external repair or read recovery never enables stale temporary writer; reload does',()=>{
 const s=backend('{bad'),c=createLearningStorage({storage:s});s.raw=JSON.stringify(createStore());c.handleStorageEvent({storageArea:s,key:STORE_KEY});assert.equal(c.check(),true);assert.notEqual(saveStore(c.storage,c.load().store),'');assert.equal(JSON.parse(c.exportRecoverySnapshot({createdAt}).text).raw,'{bad');assert.equal(createLearningStorage({storage:s}).getState().mode,'persistent');
 const unavailable=backend(null);unavailable.fail=true;const d=createLearningStorage({storage:unavailable});unavailable.fail=false;unavailable.raw=JSON.stringify(createStore());assert.notEqual(saveStore(d.storage,d.load().store),'');assert.throws(()=>d.exportRecoverySnapshot(),{code:'RECOVERY_UNAVAILABLE'});assert.equal(unavailable.writes,0);
});
test('recovery JSON retains exact captured raw including escapes, scripts, NUL and unpaired surrogate',()=>{
 const raw='{invalid\n"\\</script>\u0000\ud800中文',s=backend(raw),c=createLearningStorage({storage:s});const result=c.exportRecoverySnapshot({createdAt}),parsed=JSON.parse(result.text);assert.deepEqual(parsed,{format:'xiaobu-storage-recovery',version:1,createdAt,reason:'invalid-json',raw});assert.equal(result.filename,'xiaobu-recovery-2026-11-13.json');assert.throws(()=>parseProfileBackup(result.text));assert.equal(s.reads,1);assert.equal(s.writes,0);assert.deepEqual(Object.keys(c.getState()).sort(),['mode','reason']);assert.equal(JSON.stringify(c.getState()).includes(raw),false);
});
test('snapshot rejects invalid dates and oversized raw/wrapper without truncation',()=>{
 const c=createLearningStorage({storage:backend('{bad')});for(const date of ['bad','2026-11-13',null])assert.throws(()=>c.exportRecoverySnapshot({createdAt:date}),{code:'RECOVERY_INVALID_DATE'});
 for(const raw of ['x'.repeat(16*1024*1024+1),'\u0000'.repeat(3*1024*1024)]){const s=backend(raw),d=createLearningStorage({storage:s});assert.throws(()=>d.exportRecoverySnapshot({createdAt}),{code:'RECOVERY_TOO_LARGE'});assert.equal(s.raw,raw);assert.equal(s.writes,0);}
});
test('load returns detached in-memory copies with no additional native reads',()=>{
 const s=backend('{bad'),c=createLearningStorage({storage:s});const a=c.load();a.store.current='B';assert.equal(c.load().store.current,'A');assert.equal(s.reads,1);assert.equal(c.exportRecoverySnapshot({createdAt}).text, c.exportRecoverySnapshot({createdAt}).text);
});
test('malformed nested records cannot throw out of construction or permit writing',()=>{
 const s=createStore();s.profiles.A.practiceCompleted=[{id:'x',subject:'math',date:createdAt,records:[null,null]}];getPractice(s,'english');const raw=JSON.stringify(s),backendState=backend(raw);const c=createLearningStorage({storage:backendState});assert.equal(c.load().status,'invalid-schema');assert.notEqual(saveStore(c.storage,c.load().store),'');assert.equal(backendState.raw,raw);
});
test('usable profiles from protected snapshots round-trip through normal backups into an independent empty store',()=>{
 const original=createStore();getPractice(original,'math');original.profiles.A.learningLoop={version:999};switchProfile(original,'B');getPractice(original,'english');
 for(const damage of ['partial','profile']){
  const source=structuredClone(original);if(damage==='profile')source.profiles.A={bad:true};const raw=JSON.stringify(source),s=backend(raw),c=createLearningStorage({storage:s}),usable=c.load().store;
  for(const key of ['A','B']){
   const backup=parseProfileBackup(exportProfileBackup(usable,key,{createdAt}).text),destination=restoreProfileBackup(createStore(),backup,'A');
   assert.deepEqual(destination.profiles.A,usable.profiles[key]);assert.deepEqual(destination.profiles.B,createStore().profiles.B);
   const target=backend(null),fresh=createLearningStorage({storage:target});persistBackupRestore(fresh.storage,createStore(),destination);assert.equal(loadStore(target).status,'valid');
  }
  assert.equal(s.raw,raw);assert.equal(s.writes,0);assert.equal(c.getState().mode,'temporary');
 }
});
