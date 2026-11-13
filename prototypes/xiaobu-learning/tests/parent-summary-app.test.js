import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStore,STORE_KEY,getPractice,practiceAttempt,startTest} from '../dist/model.js';
import {recordWrong,questionById,subjects} from '../dist/model.js';
import {parentSummaryMarkup} from '../dist/parent-summary-ui.js';
import {startLoop,loopAction} from '../dist/loop-model.js';
import {exportProfileBackup} from '../dist/backup-model.js';
let sequence=0;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function withWrong(profile='A'){const s=createStore();s.current=profile;practiceAttempt(s,getPractice(s,'math'),true);return s;}
async function setup({saved=null,initialFailure=false,quota=false}={}){
 const nodes=new Map(),media=[],readers=[],downloads=[],voices=[];let raw=typeof saved==='string'?saved:saved?JSON.stringify(saved):null,writes=0,readFailure=initialFailure,reloads=0,downloadFailure=false,onRead=null;
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
 await import(`../dist/app.js?parent-summary-app-test=${++sequence}`);
 const target=(dataset={},id='')=>({dataset,id,disabled:false,closest(){return this;},hasAttribute(){return false;}});
 const click=(dataset={},id='')=>node('#main').emit('click',{target:target(dataset,id)});
 const profile=id=>node('#profile-controls').emit('click',{target:target({profile:id})});
 const route=hash=>{location.hash=hash;winEvents.emit('hashchange');};
 const external=(next,{emit=true,key=STORE_KEY,area=storage}={})=>{raw=typeof next==='string'?next:next===null?null:JSON.stringify(next);if(emit)winEvents.emit('storage',{storageArea:area,key});};
 const backupEvent=(type,event)=>{node('#main').emit(type,event,true);if(!event.stopped)node('#main').querySelector('#backup-panel').emit(type,event);};
 return {node,click,profile,route,external,backupEvent,media,voices,readers,downloads,storage,winEvents,synthesis:speechSynthesis,get raw(){return raw;},get writes(){return writes;},get reloads(){return reloads;},failRead:x=>readFailure=x,failWrite:x=>quota=x,failDownload:x=>downloadFailure=x,setReadHook:fn=>onRead=fn,cleanup:()=>winEvents.emit('pagehide')};
}
const mainHTML=c=>c.node('#main').innerHTML;
const region=c=>c.node('#main').querySelector('#parent-summary-region');
function fixture(){
 const s=createStore();
 for(const [i,days] of [0,10,40].entries()){
  const d=new Date();d.setDate(d.getDate()-days);
  s.profiles.A.practiceCompleted.push({id:`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`,subject:'math',date:d.toISOString(),records:[0,1].map(()=>({attempts:1,solved:true,firstCorrect:true,hints:0}))});
 }
 recordWrong(s,'practice:math:0',null,'练习');return s;
}
test('parent period defaults to seven days; filters and refresh are read-only and keep all history visible',async()=>{
 const s=fixture(),c=await setup({saved:s});c.route('#parent');
 assert.ok(mainHTML(c).includes(parentSummaryMarkup(s.profiles.A,{range:'7'})));
 assert.match(mainHTML(c),/全部已载入历史/);assert.match(mainHTML(c),/以下明细不随上方时间筛选变化/);
 const whole=mainHTML(c),backup=c.node('#main').querySelector('#backup-panel');
 c.click({parentRange:'30'});assert.equal(region(c).innerHTML,parentSummaryMarkup(s.profiles.A,{range:'30'}));
 c.click({parentRange:'all'});assert.equal(region(c).innerHTML,parentSummaryMarkup(s.profiles.A,{range:'all'}));
 c.click({parentRefresh:''});c.click({parentRefresh:''});assert.equal(region(c).innerHTML,parentSummaryMarkup(s.profiles.A,{range:'all'}));
 assert.equal(c.node('#main').querySelector('#backup-panel'),backup);assert.equal(mainHTML(c),whole);
 assert.equal(document.activeElement,region(c).querySelector('#parent-period-status'));
 assert.equal(c.writes,0);assert.deepEqual(JSON.parse(c.raw),s);c.cleanup();
});
test('period resets after profile switch, leaving parent and confirmed clear; profiles stay isolated',async()=>{
 const s=fixture(),c=await setup({saved:s});c.route('#parent');c.click({parentRange:'all'});
 c.profile('B');assert.ok(mainHTML(c).includes(parentSummaryMarkup(s.profiles.B,{range:'7'})));
 c.click({parentRange:'30'});c.profile('A');assert.ok(mainHTML(c).includes(parentSummaryMarkup(s.profiles.A,{range:'7'})));
 c.click({parentRange:'all'});c.route('#reviews');c.route('#parent');assert.ok(mainHTML(c).includes(parentSummaryMarkup(s.profiles.A,{range:'7'})));
 c.profile('B');c.click({parentRange:'all'});c.node('#confirm-clear').click();c.route('#parent');
 assert.ok(mainHTML(c).includes(parentSummaryMarkup(createStore().profiles.B,{range:'7'})));
 assert.deepEqual(JSON.parse(c.raw).profiles.A,s.profiles.A);c.cleanup();
});
test('wrong-route, unknown and repeated period actions cannot mutate records',async()=>{
 const s=fixture(),c=await setup({saved:s});c.route('#parent');const initial=mainHTML(c);
 for(const range of ['__proto__','constructor','6','',7,'<script>'])c.click({parentRange:range});
 assert.equal(mainHTML(c),initial);assert.equal(region(c).innerHTML,'');
 c.click({parentRange:'7'});const expected=region(c).innerHTML;c.click({parentRange:'7'});assert.equal(region(c).innerHTML,expected);
 c.route('#wrongs');const notebook=mainHTML(c);c.click({parentRange:'30'});c.click({parentRefresh:''});assert.equal(mainHTML(c),notebook);
 assert.equal(c.writes,0);assert.deepEqual(JSON.parse(c.raw),s);c.cleanup();
});
test('detected cross-page conflict blocks period filter and refresh while preserving snapshots',async()=>{
 const c=await setup({saved:fixture()});c.route('#parent');c.click({parentRange:'30'});const before=region(c).innerHTML;
 const external=createStore();c.external(external);c.click({parentRange:'all'});c.click({parentRefresh:''});
 assert.equal(region(c).innerHTML,before);assert.equal(c.writes,0);assert.deepEqual(JSON.parse(c.raw),external);
 assert.equal(c.node('#storage-conflict').open,true);c.cleanup();
});
test('period summary reads recovered memory only without replacing protected original raw',async()=>{
 const s=fixture();s.profiles.A.learningLoop={version:99};const original=JSON.stringify(s),c=await setup({saved:original});c.route('#parent');
 const recovered=structuredClone(s.profiles.A);delete recovered.learningLoop;
 assert.ok(mainHTML(c).includes(parentSummaryMarkup(recovered,{range:'7'})));
 c.click({parentRange:'all'});assert.equal(region(c).innerHTML,parentSummaryMarkup(recovered,{range:'all'}));c.click({parentRefresh:''});
 assert.equal(c.raw,original);assert.equal(c.writes,0);assert.match(c.node('#profile-controls').innerHTML,/仅能在本页临时学习/);c.cleanup();
});
test('changing period or refreshing does not cancel a pending backup read or its confirmed restore',async()=>{
 const saved=createStore(),source=fixture(),c=await setup({saved});c.route('#parent');const panel=c.node('#main').querySelector('#backup-panel');
 const backup=exportProfileBackup(source,'A');c.backupEvent('change',{target:{id:'backup-file',files:[{size:backup.text.length}]}});await tick();
 c.click({parentRange:'30'});c.click({parentRefresh:''});assert.equal(c.readers.length,1);assert.notEqual(c.readers[0].aborted,true);assert.equal(c.node('#main').querySelector('#backup-panel'),panel);
 c.readers[0].finish(backup.text);await tick();c.click({parentRange:'all'});
 c.backupEvent('click',{target:{dataset:{backupAction:'confirm'},closest(){return this;}}});await tick();
 assert.equal(c.writes,1);const restored=JSON.parse(c.raw);assert.deepEqual(restored.profiles.A,source.profiles.A);assert.deepEqual(restored.profiles.B,saved.profiles.B);
 assert.ok(mainHTML(c).includes(parentSummaryMarkup(source.profiles.A,{range:'7'})));c.cleanup();
});
test('reloading creates a fresh default period without storing filter state',async()=>{
 const s=fixture(),c=await setup({saved:s});c.route('#parent');c.click({parentRange:'all'});const raw=c.raw;c.cleanup();
 const fresh=await setup({saved:raw});fresh.route('#parent');assert.ok(mainHTML(fresh).includes(parentSummaryMarkup(s.profiles.A,{range:'7'})));assert.equal(fresh.writes,0);fresh.cleanup();
});
