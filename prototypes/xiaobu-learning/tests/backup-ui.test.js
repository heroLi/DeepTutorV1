import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStore,STORE_KEY,getPractice,practiceAttempt} from '../dist/model.js';
import {exportProfileBackup,MAX_BACKUP_BYTES} from '../dist/backup-model.js';
import {createBackupController,persistBackupRestore,readBackupFile,downloadBackupFile,mountBackup,backupMarkup} from '../dist/backup-ui.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function backup(profileId='A'){
 const s=createStore();s.current=profileId;practiceAttempt(s,getPractice(s,'math'),true);
 return exportProfileBackup(s,profileId,{createdAt:'2026-11-13T10:00:00.000Z'});
}
function fixture({initial=createStore(),readFile=async f=>f.text,timeoutMs=100,download}={}){
 let store=initial,raw=JSON.stringify(store),fail=false,writes=0;const states=[],downloads=[];
 const storage={getItem:()=>raw,setItem:(_k,value)=>{if(fail)throw Error('quota');raw=value;writes++;}};
 const controller=createBackupController({getStore:()=>store,commitStore:next=>{persistBackupRestore(storage,store,next);store=next;},onState:s=>states.push(s),readFile,timeoutMs,download:download||((b)=>downloads.push(b))});
 return {controller,states,downloads,get store(){return store;},get raw(){return raw;},get writes(){return writes;},fail:value=>{fail=value;},replaceRaw:value=>{raw=value;},switchTo:id=>{store.current=id;}};
}
const file=b=>({size:new TextEncoder().encode(b.text).length,text:b.text});
test('local preview requires explicit confirmation and restores once without changing other profile',async()=>{
 const c=fixture();const beforeB=structuredClone(c.store.profiles.B);
 await c.controller.choose(file(backup()));assert.equal(c.controller.getState().phase,'preview');assert.equal(c.controller.getState().preview.sourceProfileId,'A');assert.equal(c.writes,0);
 assert.equal(c.controller.confirm(),true);assert.equal(c.writes,1);assert.equal(c.store.profiles.A.wrongs.length,1);assert.deepEqual(c.store.profiles.B,beforeB);
 assert.equal(c.controller.confirm(),false);assert.equal(c.writes,1);assert.match(c.controller.getState().message,/已恢复并保存在本浏览器/);
 c.controller.exportCurrent();assert.equal(c.downloads.length,1);assert.match(c.controller.getState().message,/已发起本地下载/);assert.match(c.controller.getState().message,/请在浏览器下载列表确认/);
 c.controller.dispose();
});
test('cancel, disposal, scope switch and storage invalidation reject late file results',async()=>{
 for(const kind of ['cancel','dispose','scope','invalidate']){
  let resolve,signal;const c=fixture({readFile:(_f,args)=>{signal=args.signal;return new Promise(r=>resolve=r);}});
  const pending=c.controller.choose(file(backup()));await tick();
  if(kind==='cancel')c.controller.cancel();if(kind==='dispose')c.controller.dispose();if(kind==='scope')c.switchTo('B');if(kind==='invalidate')c.controller.invalidate();
  resolve(backup().text);await pending;assert.equal(c.controller.confirm(),false);assert.equal(c.writes,0);
  if(kind!=='scope')assert.equal(signal.aborted,true);c.controller.dispose();
 }
});
test('a newer file replaces pending work, including a different source profile',async()=>{
 const waiting=[];const c=fixture({readFile:()=>new Promise(resolve=>waiting.push(resolve))});
 const first=c.controller.choose(file(backup('A')));await tick();const second=c.controller.choose(file(backup('B')));await tick();
 waiting[1](backup('B').text);await second;waiting[0](backup('A').text);await first;
 assert.equal(c.controller.getState().preview.sourceProfileId,'B');assert.equal(c.controller.confirm(),true);assert.equal(c.store.current,'A');assert.equal(c.store.profiles.A.wrongs.length,1);assert.equal(c.store.profiles.B.wrongs.length,0);c.controller.dispose();
});
test('uncooperative reads time out and cannot later become a ready preview',async()=>{
 let finish,signal;const c=fixture({timeoutMs:5,readFile:(_f,args)=>{signal=args.signal;return new Promise(resolve=>finish=resolve);}});
 await c.controller.choose(file(backup()));assert.equal(c.controller.getState().phase,'error');assert.match(c.controller.getState().message,/超时/);assert.equal(signal.aborted,true);
 finish(backup().text);await tick();assert.equal(c.controller.confirm(),false);assert.equal(c.writes,0);c.controller.dispose();
});
test('quota failure leaves stored and in-memory data untouched and can be retried',async()=>{
 const c=fixture();await c.controller.choose(file(backup()));const before=c.raw,original=c.store;c.fail(true);
 assert.equal(c.controller.confirm(),false);assert.equal(c.store,original);assert.equal(c.raw,before);assert.equal(c.writes,0);assert.equal(c.controller.getState().phase,'preview');assert.match(c.controller.getState().message,/未能保存/);
 c.fail(false);assert.equal(c.controller.confirm(),true);assert.equal(c.writes,1);c.controller.dispose();
});
test('other-tab storage changes or clearing cannot be overwritten by a stale restore',async()=>{
 const c=fixture();await c.controller.choose(file(backup()));const other=createStore();other.current='B';practiceAttempt(other,getPractice(other,'math'),true);const raw=JSON.stringify(other);c.replaceRaw(raw);
 assert.equal(c.controller.confirm(),false);assert.equal(c.raw,raw);assert.equal(c.writes,0);assert.equal(c.controller.getState().preview,null);assert.match(c.controller.getState().message,/不一致/);c.controller.dispose();
 const current=createStore();current.current='B';practiceAttempt(current,getPractice(current,'math'),true);current.current='A';
 assert.throws(()=>persistBackupRestore({getItem:()=>null,setItem:()=>assert.fail()},current,createStore()),{code:'BACKUP_STORE_CHANGED'});
});
test('nonempty target, oversized/invalid files and failed downloads cannot change records',async()=>{
 let reads=0;const occupied=createStore();practiceAttempt(occupied,getPractice(occupied,'math'),true);
 const full=fixture({initial:occupied,readFile:async()=>{reads++;return backup().text;}});await full.controller.choose(file(backup()));assert.equal(reads,0);assert.match(full.controller.getState().message,/不是空档案/);full.controller.dispose();
 const c=fixture({readFile:async f=>{reads++;return f.text;},download:()=>{throw Object.assign(Error(),{code:'BACKUP_DOWNLOAD_FAILED'});}});
 await c.controller.choose({size:MAX_BACKUP_BYTES+1,text:''});assert.equal(reads,0);assert.match(c.controller.getState().message,/超过/);
 await c.controller.choose({size:3,text:'bad'});assert.equal(reads,1);assert.equal(c.controller.confirm(),false);assert.equal(c.writes,0);
 assert.equal(c.controller.exportCurrent(),false);assert.match(c.controller.getState().message,/未能发起下载/);assert.equal(c.writes,0);c.controller.dispose();
});
test('FileReader errors, synchronous failures, pre-abort and active abort are bounded',async()=>{
 let reader;class Reader{constructor(){reader=this;}readAsText(){this.started=true;}abort(){this.aborted=true;}}
 const normal=readBackupFile({}, {scope:{FileReader:Reader}});reader.result='{}';reader.onload();assert.equal(await normal,'{}');assert.equal(reader.onerror,null);
 const error=readBackupFile({}, {scope:{FileReader:Reader}});reader.onerror();await assert.rejects(error,{code:'BACKUP_READ_FAILED'});
 const active=new AbortController(),pending=readBackupFile({}, {scope:{FileReader:Reader},signal:active.signal});active.abort();await assert.rejects(pending);assert.equal(reader.aborted,true);
 const pre=new AbortController();pre.abort();await assert.rejects(readBackupFile({}, {scope:{FileReader:class{constructor(){assert.fail();}}},signal:pre.signal}));
 await assert.rejects(readBackupFile({}, {scope:{FileReader:class{readAsText(){throw Error('reader unavailable');}}}}));
});
test('download creates only a local Blob URL, cleans it, and never claims disk confirmation',t=>{
 const seen=[];const anchor={click(){seen.push(['click',this.download,this.href]);},remove(){seen.push(['remove']);}};
 t.mock.method(globalThis,'setTimeout',fn=>{fn();return 1;});
 const scope={Blob:class{constructor(parts,options){seen.push(['blob',parts,options]);}},URL:{createObjectURL:()=>{seen.push(['create']);return 'blob:local-only';},revokeObjectURL:url=>seen.push(['revoke',url])},document:{createElement:tag=>{assert.equal(tag,'a');return anchor;},body:{appendChild:a=>assert.equal(a,anchor)}}};
 downloadBackupFile({text:'{}',filename:'anonymous.json'},{scope});assert.deepEqual(seen.at(-1),['revoke','blob:local-only']);assert.ok(seen.some(x=>x[0]==='click'&&x[1]==='anonymous.json'));assert.ok(seen.some(x=>x[0]==='remove'));
});
test('mounted panel uses accessible confirmation, invalidates on storage, and releases handlers',async()=>{
 const listeners=new Map(),events=new Map();const panel={innerHTML:'',addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 const scope={addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)};let store=createStore(),writes=0;
 const dispose=mountBackup({querySelector:()=>panel},{getStore:()=>store,commitStore:next=>{store=next;writes++;},scope,readFile:async f=>f.text,download:()=>{}});
 assert.match(backupMarkup(),/aria-labelledby/);assert.match(panel.innerHTML,/role="status"/);assert.match(panel.innerHTML,/不是账号或家长锁/);
 listeners.get('change')({target:{id:'backup-file',files:[file(backup())]}});await tick();assert.match(panel.innerHTML,/确认恢复到空档案 A/);assert.equal(writes,0);
 events.get('storage')({key:STORE_KEY});assert.doesNotMatch(panel.innerHTML,/data-backup-action="confirm"/);assert.equal(writes,0);
 dispose();assert.equal(listeners.size,0);assert.equal(events.size,0);
});
test('app owns backup teardown and the feature has no server upload transport',()=>{
 const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),ui=fs.readFileSync(new URL('../dist/backup-ui.js',import.meta.url),'utf8');
 assert.match(app,/function setView[^\n]*disposeBackup\?\./);assert.match(app,/pagehide[^\n]*disposeBackup\?\./);assert.match(app,/persistBackupRestore\(storage,store,next\);store=next/);
 assert.doesNotMatch(ui,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|navigator\.share/);
});

test('legacy or malformed local data does not crash the backup panel or become a restore target',async()=>{
 const store=createStore();store.profiles.B.extra='not allowed';
 let c;assert.doesNotThrow(()=>{c=fixture({initial:store});});
 assert.equal(c.controller.getState().invalid,true);await c.controller.choose(file(backup()));
 assert.equal(c.controller.getState().phase,'error');assert.match(c.controller.getState().message,/本机记录/);
 assert.equal(c.controller.confirm(),false);assert.equal(c.controller.exportCurrent(),false);assert.equal(c.writes,0);c.controller.dispose();
});
