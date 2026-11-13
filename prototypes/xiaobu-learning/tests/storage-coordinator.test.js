import test from 'node:test';
import assert from 'node:assert/strict';
import {createLearningStorage} from '../dist/storage-coordinator.js';
import {createStore,STORE_KEY,saveStore,getPractice} from '../dist/model.js';
import {persistBackupRestore} from '../dist/backup-ui.js';
function backend(raw=null){return {raw,reads:0,writes:0,readError:false,writeError:false,getItem(key){assert.equal(key,STORE_KEY);this.reads++;if(this.readError)throw Error('read');return this.raw;},setItem(key,value){assert.equal(key,STORE_KEY);if(this.writeError)throw Error('quota');this.writes++;this.raw=value;}};}

test('load always uses the single initial snapshot, not later live data',()=>{
 const a=createStore(),b=createStore();b.current='B';const s=backend(JSON.stringify(a)),c=createLearningStorage({storage:s});s.raw=JSON.stringify(b);
 assert.deepEqual(c.load().store,a);assert.deepEqual(c.load().store,a);assert.equal(s.reads,1);assert.equal(c.check(),false);
});
test('two independent tabs block stale save, preserve newer data, notify once',()=>{
 const s=backend(),events=[],a=createLearningStorage({storage:s}),b=createLearningStorage({storage:s,onBlocked:x=>events.push(x)});
 const first=a.load().store,stale=b.load().store;first.current='B';assert.equal(saveStore(a.storage,first),'');const kept=s.raw;
 getPractice(stale,'math');assert.notEqual(saveStore(b.storage,stale),'');assert.equal(s.raw,kept);assert.equal(b.check(),false);
 s.raw=null;assert.equal(b.check(),false);assert.equal(events.length,1);assert.deepEqual(b.getState(),{mode:'blocked',reason:'changed'});assert.equal(s.writes,1);
});
test('successful writes update exact baseline; failed writes do not',()=>{
 const s=backend(),c=createLearningStorage({storage:s});const store=c.load().store;
 s.writeError=true;assert.notEqual(saveStore(c.storage,store),'');assert.equal(c.check(),true);assert.equal(s.raw,null);
 s.writeError=false;assert.equal(saveStore(c.storage,store),'');store.current='B';assert.equal(saveStore(c.storage,store),'');assert.equal(c.storage.getItem(STORE_KEY),s.raw);
 s.raw=` ${s.raw}`;assert.equal(c.check(),false);
});
test('subsequent read failure is sticky even after backend recovers',()=>{
 const s=backend(),c=createLearningStorage({storage:s});s.readError=true;assert.equal(c.check(),false);s.readError=false;
 assert.throws(()=>c.storage.setItem(STORE_KEY,'{}'),{code:'STORAGE_BLOCKED'});assert.equal(s.writes,0);assert.equal(c.getState().reason,'read-failed');
});
test('initial unavailability permits memory-only work but never recovers writing',()=>{
 const s=backend();s.readError=true;const c=createLearningStorage({storage:s});assert.match(c.load().warning,/无法读取/);assert.equal(c.check(),true);
 s.readError=false;s.raw=JSON.stringify({...createStore(),current:'B'});const kept=s.raw;
 assert.throws(()=>c.storage.getItem(STORE_KEY),{code:'STORAGE_TEMPORARY'});assert.notEqual(saveStore(c.storage,c.load().store),'');assert.equal(s.raw,kept);assert.equal(s.writes,0);
 assert.deepEqual(c.getState(),{mode:'temporary',reason:'initial-read-failed'});assert.equal(createLearningStorage({storage:s}).load().store.current,'B');
});
test('storage events filter native storage and key and re-read live value, not late event',()=>{
 const s=backend(),c=createLearningStorage({storage:s});c.storage.setItem(STORE_KEY,'one');
 for(const e of [{storageArea:backend(),key:STORE_KEY},{storageArea:s,key:'other'},{storageArea:null,key:null}])assert.equal(c.handleStorageEvent(e),true);
 assert.equal(c.handleStorageEvent({storageArea:s,key:STORE_KEY,newValue:'obsolete'}),true);
 s.raw=null;assert.equal(c.handleStorageEvent({storageArea:s,key:null,newValue:'one'}),false);assert.equal(c.getState().reason,'changed');
});
test('queued storage event after own latest save does not report obsolete conflict',async()=>{
 const s=backend(),c=createLearningStorage({storage:s});const event=Promise.resolve().then(()=>c.handleStorageEvent({storageArea:s,key:STORE_KEY,newValue:'old'}));
 c.storage.setItem(STORE_KEY,'new');assert.equal(await event,true);assert.equal(c.getState().mode,'persistent');
});
test('onBlocked reentry and exception cannot allow any write or reset state',()=>{
 const s=backend();let c,count=0;c=createLearningStorage({storage:s,onBlocked:state=>{count++;assert.equal(state.mode,'blocked');assert.equal(c.check(),false);assert.throws(()=>c.storage.setItem(STORE_KEY,'bad'));throw Error('owner');}});
 s.raw='external';assert.notEqual(saveStore(c.storage,createStore()),'');assert.equal(s.raw,'external');assert.equal(s.writes,0);assert.equal(count,1);
});
test('facade supports backup persist-first success and rejects intervening external write',()=>{
 const s=backend(),c=createLearningStorage({storage:s}),current=c.load().store,next=createStore();getPractice(next,'math');
 persistBackupRestore(c.storage,current,next);assert.deepEqual(JSON.parse(s.raw),next);
 s.raw=JSON.stringify({...next,current:'B'});const kept=s.raw;assert.throws(()=>persistBackupRestore(c.storage,next,createStore()));assert.equal(s.raw,kept);assert.equal(c.getState().mode,'blocked');
});
test('unsupported keys and value coercion cannot write unrelated data',()=>{
 const s=backend(),c=createLearningStorage({storage:s});assert.throws(()=>c.storage.setItem('else','x'),{code:'STORAGE_KEY_UNSUPPORTED'});
 assert.throws(()=>c.storage.getItem('else'),{code:'STORAGE_KEY_UNSUPPORTED'});assert.throws(()=>c.storage.setItem(STORE_KEY,{toString(){assert.fail();}}),{code:'STORAGE_VALUE_UNSUPPORTED'});assert.equal(s.writes,0);
});
test('backup quota failure leaves baseline and current object intact for safe retry',()=>{
 const s=backend(),c=createLearningStorage({storage:s}),current=c.load().store,next=createStore();getPractice(next,'math');const before=structuredClone(current);
 s.writeError=true;assert.throws(()=>persistBackupRestore(c.storage,current,next),{code:'BACKUP_SAVE_FAILED'});assert.deepEqual(current,before);assert.equal(s.raw,null);assert.equal(c.check(),true);
 s.writeError=false;persistBackupRestore(c.storage,current,next);assert.deepEqual(JSON.parse(s.raw),next);
});
test('missing storage starts in memory-only mode without notification or leaked data',()=>{
 const c=createLearningStorage({onBlocked:()=>assert.fail()});assert.equal(c.check(),true);assert.equal(c.load().store.current,'A');
 assert.deepEqual(Object.keys(c.getState()).sort(),['mode','reason']);assert.ok(Object.isFrozen(c.getState()));assert.notEqual(saveStore(c.storage,createStore()),'');
});
test('reentrant storage wrapper cannot recursively write through facade',()=>{
 const s=backend(),c=createLearningStorage({storage:s});const native=s.setItem;s.setItem=function(key,value){assert.throws(()=>c.storage.setItem(key,'nested'),{code:'STORAGE_REENTRANT'});native.call(this,key,value);};
 c.storage.setItem(STORE_KEY,'outer');assert.equal(s.raw,'outer');assert.equal(s.writes,1);assert.equal(c.check(),true);
});
