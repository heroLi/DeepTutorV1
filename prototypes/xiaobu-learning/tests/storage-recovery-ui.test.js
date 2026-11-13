import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStore,STORE_KEY,getPractice,practiceAttempt,startTest} from '../dist/model.js';
import {createBackupController} from '../dist/backup-ui.js';
import {exportProfileBackup} from '../dist/backup-model.js';
let sequence=0;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function withWrong(profile='A'){const s=createStore();s.current=profile;practiceAttempt(s,getPractice(s,'math'),true);return s;}
async function setup({saved=null,rawValue=undefined,initialFailure=false,quota=false}={}){
 const nodes=new Map(),media=[],readers=[],downloads=[],voices=[];let raw=rawValue!==undefined?rawValue:saved?JSON.stringify(saved):null,writes=0,readFailure=initialFailure,reloads=0,downloadFailure=false,onRead=null;
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
 await import(`../dist/app.js?storage-recovery-test=${++sequence}`);
 const target=(dataset={},id='')=>({dataset,id,disabled:false,closest(){return this;},hasAttribute(){return false;}});
 const click=(dataset={},id='')=>node('#main').emit('click',{target:target(dataset,id)});
 const profile=id=>node('#profile-controls').emit('click',{target:target({profile:id})});
 const route=hash=>{location.hash=hash;winEvents.emit('hashchange');};
 const external=(next,{emit=true,key=STORE_KEY,area=storage}={})=>{raw=typeof next==='string'?next:next===null?null:JSON.stringify(next);if(emit)winEvents.emit('storage',{storageArea:area,key});};
 const backupEvent=(type,event)=>{node('#main').emit(type,event,true);if(!event.stopped)node('#main').querySelector('#backup-panel').emit(type,event);};
 return {node,click,profile,route,external,backupEvent,media,voices,readers,downloads,storage,winEvents,synthesis:speechSynthesis,get raw(){return raw;},get writes(){return writes;},get reloads(){return reloads;},failRead:x=>readFailure=x,failWrite:x=>quota=x,failDownload:x=>downloadFailure=x,setReadHook:fn=>onRead=fn,cleanup:()=>winEvents.emit('pagehide')};
}
for(const [label,raw,expected] of [
 ['broken JSON','{"private":"<script>secret</script>"',/不是有效 JSON/],
 ['unknown version',JSON.stringify({...createStore(),version:999}),/版本不受/],
 ['invalid schema',JSON.stringify({private:'<img src=x>',version:1}),/结构无法验证/],
 ['partial loop',JSON.stringify({...withWrong(),profiles:{...withWrong().profiles,A:{...withWrong().profiles.A,learningLoop:{broken:true}}}}),/小步引导记录有异常/]
])test(label+': original raw stays untouched, explicit recovery download only, standard restore blocked',async()=>{
 const c=await setup({rawValue:raw});assert.match(c.node('#profile-controls').innerHTML,expected);assert.equal(c.downloads.length,0);
 c.route('#parent');assert.match(c.node('#main').innerHTML,/下载原始存储副本（仅排查）/);assert.doesNotMatch(c.node('#main').innerHTML,/<script>secret|<img src=x>/);const panel=c.node('#main').querySelector('#backup-panel');assert.match(panel.innerHTML,/<input[^>]+disabled/);assert.match(panel.innerHTML,/不能选择文件或恢复/);
 c.backupEvent('change',{target:{id:'backup-file',files:[{size:20}]}});await tick();assert.equal(c.readers.length,0);assert.doesNotMatch(panel.innerHTML,/确认恢复到/);
 c.click({recoveryExport:''});assert.equal(c.downloads.length,1);assert.equal(JSON.parse(c.downloads[0].text).raw,raw);assert.match(c.node('#main').querySelector('#recovery-status').textContent,/已发起/);
 c.failDownload(true);c.click({recoveryExport:''});assert.match(c.node('#main').querySelector('#recovery-status').textContent,/未能发起/);c.failDownload(false);
 c.click({subject:'math'});c.click({action:'skip'});c.profile('B');c.node('#profile-controls').emit('click',{target:{dataset:{},id:'clear-profile',closest(){return this;}}});assert.match(c.node('#clear-label').textContent,/仅本页临时/);assert.match(c.node('#clear-scope-note').textContent,/原始存储不会改动/);c.node('#confirm-clear').click();assert.equal(c.raw,raw);assert.equal(c.writes,0);c.cleanup();
});
test('unreadable storage has no recovery export, stays temporary and blocks file chooser after read access returns',async()=>{
 const c=await setup({initialFailure:true});c.route('#parent');assert.doesNotMatch(c.node('#main').innerHTML,/data-recovery-export/);assert.match(c.node('#main').innerHTML,/未能读取原始快照/);c.failRead(false);c.click({recoveryExport:''});assert.equal(c.downloads.length,0);c.backupEvent('change',{target:{id:'backup-file',files:[{size:30}]}});await tick();assert.equal(c.readers.length,0);assert.equal(c.writes,0);c.cleanup();
});
test('temporary foundation completion never claims durable save and can export current usable profile',async()=>{
 const c=await setup({rawValue:'broken'});c.click({subject:'math'});c.click({choice:'4'});c.click({action:'submit'});c.click({action:'next'});c.click({choice:'6'});c.click({action:'submit'});c.click({action:'next'});
 assert.match(c.node('#main').innerHTML,/小结仅保留在本页，请先下载备份/);assert.doesNotMatch(c.node('#main').innerHTML,/小结已保存在/);c.route('#parent');c.backupEvent('click',{target:{dataset:{backupAction:'export'},closest(){return this;}}});assert.equal(c.downloads.length,1);assert.equal(JSON.parse(c.downloads[0].text).format,'xiaobu-profile-backup');assert.equal(c.raw,'broken');assert.equal(c.writes,0);c.cleanup();
});
test('controller denies programmatic choose/confirm and revokes a late read or old preview when restoration becomes blocked',async()=>{
 let s=createStore(),allow=false,reads=0,commits=0,finish;const backup=exportProfileBackup(withWrong(),'A');const file={size:backup.text.length};
 const c=createBackupController({getStore:()=>s,commitStore:next=>{commits++;s=next;},canRestore:()=>allow,readFile:()=>{reads++;return new Promise(r=>finish=r);}});
 await c.choose(file);assert.equal(reads,0);assert.equal(c.confirm(),false);assert.equal(c.getState().preview,null);
 allow=true;const reading=c.choose(file);await tick();allow=false;finish(backup.text);await reading;assert.equal(c.getState().preview,null);assert.equal(commits,0);
 allow=true;const second=c.choose(file);await tick();finish(backup.text);await second;assert.ok(c.getState().preview);allow=false;assert.equal(c.confirm(),false);assert.equal(c.getState().preview,null);assert.equal(commits,0);c.dispose();
});
