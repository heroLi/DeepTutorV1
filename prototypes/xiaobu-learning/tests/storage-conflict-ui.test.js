import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStore,STORE_KEY,getPractice,practiceAttempt,startTest} from '../dist/model.js';
import {exportProfileBackup} from '../dist/backup-model.js';
let sequence=0;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function withWrong(profile='A'){const s=createStore();s.current=profile;practiceAttempt(s,getPractice(s,'math'),true);return s;}
async function setup({saved=null,initialFailure=false,quota=false}={}){
 const nodes=new Map(),media=[],readers=[],downloads=[],voices=[];let raw=saved?JSON.stringify(saved):null,writes=0,readFailure=initialFailure,reloads=0,downloadFailure=false,onRead=null;
 class Node{
  constructor(key){this.key=key;this.listeners=[];this.children=new Map();this.html='';this.dataset={};this.attributes={};this.open=false;this.shows=0;this.disabled=false;this.inert=false;this.textContent='';this.value='';this.paused=true;this.currentTime=0;this.duration=NaN;this.readyState=0;this.pauseCalls=0;}
  set innerHTML(v){this.html=v;this.children=new Map();}get innerHTML(){return this.html;}
  addEventListener(type,fn,capture=false){this.listeners.push({type,fn,capture:!!capture});}
  removeEventListener(type,fn){this.listeners=this.listeners.filter(l=>l.type!==type||l.fn!==fn);}
  emit(type,event={},capture){event.preventDefault??=()=>{event.prevented=true;};event.stopImmediatePropagation??=()=>{event.stopped=true;};for(const l of [...this.listeners].sort((a,b)=>Number(b.capture)-Number(a.capture))){if(event.stopped)break;if(l.type===type&&(capture===undefined||capture===l.capture))l.fn(event);}return event;}
  querySelector(key){if(!this.children.has(key)){const n=new Node(key);this.children.set(key,n);if(key==='video')media.push(n);}return this.children.get(key);}
  querySelectorAll(){return [];}
  setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k]??null;}hasAttribute(k){return k in this.attributes;}
  focus(){document.activeElement=this;}showModal(){this.open=true;this.shows++;}close(){this.open=false;this.emit('close');}
  play(){this.paused=false;this.emit('play');this.emit('playing');return Promise.resolve();}pause(){this.paused=true;this.pauseCalls++;this.emit('pause');}
  load(){this.readyState=1;this.duration=69.2;this.emit('loadedmetadata');}click(){this.emit('click');}
 }
 const node=key=>{if(!nodes.has(key))nodes.set(key,new Node(key));return nodes.get(key);};
 const docEvents=new Node('document');
 globalThis.document={body:node('body'),querySelector:node,querySelectorAll:()=>[],activeElement:null,hidden:false,visibilityState:'visible',addEventListener:docEvents.addEventListener.bind(docEvents),removeEventListener:docEvents.removeEventListener.bind(docEvents)};
 const storage={getItem(){if(readFailure)throw Error('read unavailable');onRead?.();return raw;},setItem(_k,v){if(quota)throw Error('quota');raw=v;writes++;}};
 const winEvents=new Node('window');
 class Reader{constructor(){readers.push(this);}readAsText(file){this.file=file;}abort(){this.aborted=true;}finish(text){this.result=text;this.onload?.();}}
 let hash='';globalThis.location={get hash(){return hash;},set hash(v){hash=v?(v.startsWith('#')?v:'#'+v):'';},reload(){reloads++;}};
 globalThis.window={localStorage:storage,location,scrollTo(){},addEventListener:winEvents.addEventListener.bind(winEvents),removeEventListener:winEvents.removeEventListener.bind(winEvents),FileReader:Reader,Blob:class{constructor(parts){this.text=parts.join('');}},URL:{createObjectURL(blob){if(downloadFailure)throw Error('download blocked');downloads.push(blob);return 'blob:fixture';},revokeObjectURL(){}},document:{createElement(){return {click(){if(downloadFailure)throw Error('download blocked');},remove(){}};},body:{appendChild(){}}}};
 class Recognition{constructor(){this.processLocally=false;voices.push(this);}static async available(){return 'available';}start(){this.started=true;}abort(){this.aborted=true;}}
 globalThis.SpeechRecognition=Recognition;globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 const synthesisEvents=new Node('synthesis');globalThis.speechSynthesis={getVoices:()=>[{localService:true,lang:'zh-CN'}],spoken:[],cancelled:0,speak(u){this.spoken.push(u);},cancel(){this.cancelled++;},addEventListener:synthesisEvents.addEventListener.bind(synthesisEvents),removeEventListener:synthesisEvents.removeEventListener.bind(synthesisEvents)};
 globalThis.CSS={escape:x=>x};
 await import(`../dist/app.js?storage-conflict-test=${++sequence}`);
 const target=(dataset={},id='')=>({dataset,id,disabled:false,closest(){return this;},hasAttribute(){return false;}});
 const click=(dataset={},id='')=>node('#main').emit('click',{target:target(dataset,id)});
 const profile=id=>node('#profile-controls').emit('click',{target:target({profile:id})});
 const route=hash=>{location.hash=hash;winEvents.emit('hashchange');};
 const external=(next,{emit=true,key=STORE_KEY,area=storage}={})=>{raw=typeof next==='string'?next:next===null?null:JSON.stringify(next);if(emit)winEvents.emit('storage',{storageArea:area,key});};
 const backupEvent=(type,event)=>{node('#main').emit(type,event,true);if(!event.stopped)node('#main').querySelector('#backup-panel').emit(type,event);};
 return {node,click,profile,route,external,backupEvent,media,voices,readers,downloads,storage,winEvents,synthesis:speechSynthesis,get raw(){return raw;},get writes(){return writes;},get reloads(){return reloads;},failRead:x=>readFailure=x,failWrite:x=>quota=x,failDownload:x=>downloadFailure=x,setReadHook:fn=>onRead=fn,cleanup:()=>winEvents.emit('pagehide')};
}
test('old clear confirmation and profile/route actions cannot write after conflict; Esc/close do not unlock',async()=>{
 const c=await setup({saved:withWrong()});c.node('#profile-controls').emit('click',{target:{dataset:{},id:'clear-profile',closest(){return this;}}});assert.equal(c.node('#clear-confirm').open,true);
 const next=withWrong('B');c.external(next);const persisted=c.raw,writes=c.writes;assert.equal(c.node('#storage-conflict').open,true);assert.equal(c.node('#clear-confirm').open,false);
 c.node('#confirm-clear').click();c.profile('B');c.route('#loop/math');c.click({subject:'math'});assert.equal(c.raw,persisted);assert.equal(c.writes,writes);assert.equal(c.reloads,0);
 const escaped=c.node('#storage-conflict').emit('cancel');assert.equal(escaped.prevented,true);c.node('#storage-conflict').close();assert.equal(c.node('#storage-conflict').open,true);
 c.external(withWrong());c.click({action:'skip'});assert.equal(c.writes,writes);assert.equal(c.node('#main').inert,true);
 c.node('#storage-backup-A').click();assert.equal(JSON.parse(c.downloads[0].text).profile.wrongs.length,1);c.cleanup();
});
test('stale replace-test confirmation cannot replace the in-memory active test',async()=>{
 const s=createStore();startTest(s,'math');const c=await setup({saved:s});c.route('#assessments');c.click({test:'english'});assert.equal(c.node('#replace-test').open,true);
 c.external(withWrong('B'));const persisted=c.raw;c.node('#confirm-replace').click();assert.equal(c.raw,persisted);assert.equal(c.writes,0);
 c.node('#storage-backup-A').click();assert.equal(JSON.parse(c.downloads[0].text).profile.activeTest.subject,'math');c.cleanup();
});
test('route check detects a change even without an event and never creates a loop or practice',async()=>{
 const c=await setup();const next=withWrong('B');c.external(next,{emit:false});c.route('#loop/math');assert.equal(c.node('#storage-conflict').open,true);assert.equal(c.writes,0);
 c.node('#storage-backup-A').click();const profile=JSON.parse(c.downloads[0].text).profile;assert.deepEqual(profile.practices,{});assert.equal(profile.learningLoop,undefined);c.cleanup();
});
test('only native area and matching key events block; a later read error is sticky',async()=>{
 const c=await setup();c.winEvents.emit('storage',{storageArea:{},key:STORE_KEY});c.winEvents.emit('storage',{storageArea:c.storage,key:'other'});c.winEvents.emit('storage',{storageArea:c.storage,key:STORE_KEY});assert.equal(c.node('#storage-conflict').open,false);
 c.click({subject:'math'});assert.equal(c.writes,1);c.failRead(true);c.click({choice:'4'});assert.equal(c.node('#storage-conflict').open,true);assert.match(c.node('#storage-conflict-detail').textContent,/无法核对/);c.failRead(false);c.click({choice:'4'});assert.equal(c.writes,1);c.cleanup();
});
test('conflict stops video and prevents disposed controls or route remount from restarting it',async()=>{
 const c=await setup();c.route('#video');const video=c.media.at(-1);video.load();await video.play();c.external(withWrong('B'));assert.equal(video.paused,true);assert.equal(video.pauseCalls,1);assert.equal(video.listeners.length,0);
 c.route('#video');assert.equal(c.media.length,1);assert.equal(video.pauseCalls,1);c.cleanup();
});
test('conflict aborts simulated recognition and local synthesis without any real microphone',async()=>{
 const c=await setup();c.route('#dialogue/math/0');await tick();c.click({dialogueIntent:'hint'});c.click({},'dialogue-mic');const recognition=c.voices.find(v=>v.started);assert.ok(recognition);c.click({},'dialogue-read');assert.equal(recognition.aborted,true);assert.equal(c.synthesis.spoken.length,1);
 c.external(withWrong('B'));assert.equal(c.synthesis.cancelled,1);assert.equal(c.node('#main').querySelector('#dialogue-input').value,'');c.click({},'dialogue-mic');assert.equal(c.voices.filter(v=>v.started).length,1);assert.equal(c.writes,0);c.cleanup();
});
test('conflict cancels pending backup file reading and ignores a late file callback',async()=>{
 const c=await setup();c.route('#parent');const backup=exportProfileBackup(withWrong(),'A');
 c.backupEvent('change',{target:{id:'backup-file',files:[{size:backup.text.length}]}});await tick();const reader=c.readers[0],late=reader.onload;assert.ok(reader);
 c.external(withWrong('B'));assert.equal(reader.aborted,true);reader.result=backup.text;late();await tick();assert.equal(c.writes,0);assert.equal(c.node('#storage-conflict').open,true);assert.doesNotMatch(c.node('#main').querySelector('#backup-panel').innerHTML,/确认恢复到空档案/);c.cleanup();
});
test('backup confirm capture detects stale state before the nested restore handler',async()=>{
 const c=await setup();c.route('#parent');const backup=exportProfileBackup(withWrong(),'A');c.backupEvent('change',{target:{id:'backup-file',files:[{size:backup.text.length}]}});await tick();c.readers[0].finish(backup.text);await tick();assert.match(c.node('#main').querySelector('#backup-panel').innerHTML,/确认恢复/);
 c.external(withWrong('B'),{emit:false});const event={target:{dataset:{backupAction:'confirm'},closest(){return this;}}};c.backupEvent('click',event);assert.equal(event.stopped,true);assert.equal(c.writes,0);assert.equal(c.node('#storage-conflict').open,true);c.cleanup();
});
test('initially inaccessible storage stays temporary even after it becomes readable',async()=>{
 const c=await setup({initialFailure:true});const assertTemporary=()=>{const html=c.node('#profile-controls').innerHTML;assert.match(html,/仅能在本页临时学习/);assert.match(html,/此页不会写回浏览器存储/);assert.match(html,/家长页分别下载/);assert.match(html,/再重新载入页面检查存储/);assert.doesNotMatch(html,/新操作会尝试重新保存|未能保存/);};assertTemporary();c.click({subject:'math'});c.click({action:'skip'});assert.equal(c.writes,0);assert.equal(c.node('#storage-conflict').open,false);assertTemporary();
 c.failRead(false);c.external(withWrong('B'),{emit:false});const persisted=c.raw;c.click({choice:'4'});c.click({action:'submit'});assert.equal(c.raw,persisted);assert.equal(c.writes,0);assert.equal(c.node('#storage-conflict').open,false);assertTemporary();c.cleanup();
});
test('quota-failed memory and a check-to-save conflict remain rescueable without claiming a transaction',async()=>{
 const c=await setup();c.click({subject:'math'});c.failWrite(true);c.click({action:'skip'});assert.equal(c.writes,1);assert.match(c.node('#profile-controls').innerHTML,/未能保存/);c.failWrite(false);
 const next=withWrong('B');c.external(next);c.node('#storage-backup-A').click();assert.equal(JSON.parse(c.downloads[0].text).profile.wrongs.length,1);assert.deepEqual(JSON.parse(c.raw),next);c.cleanup();
 const race=await setup();race.click({subject:'math'});let reads=0;const newer=JSON.stringify(withWrong('B'));race.setReadHook(()=>{if(++reads===2)race.external(newer,{emit:false});});race.click({action:'skip'});assert.equal(race.raw,newer);assert.equal(race.node('#storage-conflict').open,true);race.node('#storage-backup-A').click();assert.equal(JSON.parse(race.downloads[0].text).profile.wrongs.length,1);race.cleanup();
});
test('both rescue downloads are explicit, failures preserve state, and reload requires its own click',async()=>{
 const c=await setup({saved:withWrong()});c.node('#storage-reload').click();assert.equal(c.reloads,0);c.external(withWrong('B'));const raw=c.raw;
 for(let i=0;i<3;i++)c.winEvents.emit('storage',{storageArea:c.storage,key:STORE_KEY});assert.equal(c.node('#storage-conflict').shows,1);assert.equal(c.downloads.length,0);assert.equal(c.reloads,0);
 c.failDownload(true);c.node('#storage-backup-A').click();assert.match(c.node('#storage-conflict-status').textContent,/未能发起/);assert.equal(c.raw,raw);assert.equal(c.reloads,0);
 c.failDownload(false);c.node('#storage-backup-A').click();c.node('#storage-backup-B').click();assert.deepEqual(c.downloads.map(d=>JSON.parse(d.text).sourceProfileId),['A','B']);assert.match(c.node('#storage-conflict-status').textContent,/已发起/);assert.match(c.node('#storage-conflict-status').textContent,/不包含另一页面/);
 c.node('#storage-reload').click();c.node('#storage-reload').click();assert.equal(c.reloads,1);assert.equal(c.raw,raw);c.cleanup();
});
test('conflict dialog is outside route output and states the local non-atomic privacy boundary',()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert.ok(html.indexOf('id="storage-conflict"')>html.indexOf('</main>'));assert.match(html,/aria-labelledby="storage-conflict-title"/);assert.match(html,/本页临时档案 A（不含别页新记录）/);assert.match(html,/本页临时档案 B（不含别页新记录）/);assert.match(html,/不是跨标签页原子锁/);assert.match(html,/重新载入会放弃本页尚未保存的操作/);
});

test('cleanup or modal failures cannot suppress visible conflict fallback or unlock writes',async()=>{
 const c=await setup();c.route('#video');const video=c.media.at(-1);video.pause=()=>{throw Error('media failed');};
 c.node('#storage-conflict').showModal=()=>{throw Error('dialog unsupported');};
 c.external(withWrong('B'));assert.equal(c.node('#storage-conflict').getAttribute('data-fallback'),'true');
 assert.equal(c.node('#storage-conflict').getAttribute('open'),'');assert.match(c.node('#storage-conflict-detail').textContent,/停止继续保存/);
 c.click({subject:'math'});assert.equal(c.writes,0);assert.equal(document.activeElement,c.node('#storage-conflict-title'));c.cleanup();
});
