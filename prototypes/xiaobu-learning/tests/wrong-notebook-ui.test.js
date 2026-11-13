import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStore,STORE_KEY,getPractice,practiceAttempt,startTest} from '../dist/model.js';
import {recordWrong,questionById,subjects} from '../dist/model.js';
import {startLoop,loopAction} from '../dist/loop-model.js';
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
 await import(`../dist/app.js?wrong-notebook-test=${++sequence}`);
 const target=(dataset={},id='')=>({dataset,id,disabled:false,closest(){return this;},hasAttribute(){return false;}});
 const click=(dataset={},id='')=>node('#main').emit('click',{target:target(dataset,id)});
 const profile=id=>node('#profile-controls').emit('click',{target:target({profile:id})});
 const route=hash=>{location.hash=hash;winEvents.emit('hashchange');};
 const external=(next,{emit=true,key=STORE_KEY,area=storage}={})=>{raw=typeof next==='string'?next:next===null?null:JSON.stringify(next);if(emit)winEvents.emit('storage',{storageArea:area,key});};
 const backupEvent=(type,event)=>{node('#main').emit(type,event,true);if(!event.stopped)node('#main').querySelector('#backup-panel').emit(type,event);};
 return {node,click,profile,route,external,backupEvent,media,voices,readers,downloads,storage,winEvents,synthesis:speechSynthesis,get raw(){return raw;},get writes(){return writes;},get reloads(){return reloads;},failRead:x=>readFailure=x,failWrite:x=>quota=x,failDownload:x=>downloadFailure=x,setReadHook:fn=>onRead=fn,cleanup:()=>winEvents.emit('pagehide')};
}
const html=c=>c.node('#main').innerHTML;
const cards=c=>(html(c).match(/<article class="question-card wrong-card">/g)||[]).length;
function fixture(n=8){const s=createStore();for(let i=0;i<n;i++){recordWrong(s,'practice:math:0',null,'练习');const r=s.profiles.A.wrongs.at(-1);r.id='wrong-'+i;r.date=new Date(Date.UTC(2026,10,13,0,i)).toISOString();}return s;}
test('paged unified notebook retains repeated errors, newest order, global counts, filter counts and no writes',async()=>{
 const s=fixture();recordWrong(s,'practice:english:0',null,'练习');const p=s.profiles.A,r=startLoop(p,'math');loopAction(p,r.id,r.revision,'skip');
 const c=await setup({saved:s});c.route('#wrongs');assert.equal(cards(c),6);assert.match(html(c),/档案共 10 条/);assert.match(html(c),/第 1 \/ 2 页/);assert.ok(html(c).indexOf('data-retry="wrong-7"')<html(c).indexOf('data-retry="wrong-6"'));
 c.click({wrongPage:'next'});assert.equal(cards(c),4);assert.match(html(c),/第 2 \/ 2 页/);assert.equal(document.activeElement,c.node('#main').querySelector('#wrong-summary'));
 c.click({wrongSubject:'english'});assert.equal(cards(c),1);assert.match(html(c),/当前筛选 1 条/);c.click({wrongKind:'loop'});assert.equal(cards(c),0);assert.match(html(c),/当前筛选下没有记录/);
 c.click({wrongSubject:'all'});assert.equal(cards(c),1);assert.match(html(c),/此处保留原始错误/);assert.doesNotMatch(html(c),/data-retry=/);assert.match(html(c),/href="#reviews"/);assert.doesNotMatch(html(c),/href="#review\//);assert.equal(c.writes,0);assert.deepEqual(JSON.parse(c.raw),s);c.cleanup();
});
test('pending correction returns with filters preserved, page clamped, original evidence retained',async()=>{
 const s=fixture(7),c=await setup({saved:s});c.route('#wrongs');c.click({wrongKind:'pending'});c.click({wrongSubject:'math'});c.click({wrongPage:'next'});assert.equal(cards(c),1);
 c.click({retry:'wrong-0'});c.click({retryChoice:questionById('practice:math:0').answer});c.click({action:'check-retry'});const writes=c.writes;c.click({action:'check-retry'});assert.equal(c.writes,writes);c.click({action:'close-retry'});
 assert.equal(cards(c),6);assert.match(html(c),/第 1 \/ 1 页/);assert.match(html(c),/data-wrong-kind="pending" aria-pressed="true"/);assert.match(html(c),/data-wrong-subject="math" aria-pressed="true"/);assert.equal(document.activeElement,c.node('#main').querySelector('#wrong-summary'));
 const saved=JSON.parse(c.raw);assert.equal(saved.profiles.A.wrongs.length,7);assert.equal(saved.profiles.A.wrongs[0].chosen,null);assert.equal(saved.profiles.A.wrongs[0].retries.length,1);
 c.click({wrongKind:'corrected'});assert.equal(cards(c),1);assert.match(html(c),/原始错误仍保留/);c.cleanup();
});
test('profile switch, clear, and leaving route reset ephemeral filters without cross-profile leakage',async()=>{
 const c=await setup({saved:fixture()});c.route('#wrongs');c.click({wrongKind:'pending'});c.click({wrongPage:'next'});c.profile('B');assert.match(html(c),/这个档案还没有错题记录/);assert.match(html(c),/data-wrong-kind="all" aria-pressed="true"/);c.profile('A');assert.match(html(c),/第 1 \/ 2 页/);
 c.click({wrongKind:'corrected'});c.route('#parent');c.route('#wrongs');assert.equal(cards(c),6);assert.match(html(c),/data-wrong-kind="all" aria-pressed="true"/);
 c.node('#confirm-clear').click();c.route('#wrongs');assert.match(html(c),/这个档案还没有错题记录/);assert.equal(cards(c),0);c.cleanup();
});
test('invalid or wrong-route controls never mutate records and detected storage conflict blocks notebook actions',async()=>{
 const c=await setup({saved:fixture()});c.route('#wrongs');const initial=html(c);
 for(const d of [{wrongSubject:'__proto__'},{wrongKind:'bad'},{wrongPage:'99'},{retry:'missing'},{retryChoice:'bad'},{action:'check-retry'}])c.click(d);
 assert.equal(html(c),initial);assert.equal(c.writes,0);c.route('#parent');c.click({retry:'wrong-0'});c.click({wrongSubject:'math'});assert.match(html(c),/家长小结/);assert.equal(c.writes,0);
 c.route('#wrongs');c.external(createStore());const frozen=html(c);c.click({wrongPage:'next'});c.click({retry:'wrong-0'});assert.equal(html(c),frozen);assert.equal(c.writes,0);assert.equal(c.node('#storage-conflict').open,true);c.cleanup();
});
test('record IDs and question text are escaped, controls have touch targets and readable labels',async()=>{
 const s=fixture(1);s.profiles.A.wrongs[0].id='id"><img src=x onerror=alert(1)>';const original=subjects.math.items[0].question;subjects.math.items[0].question='<script>fixture</script>';
 try{const c=await setup({saved:s});c.route('#wrongs');assert.match(html(c),/&lt;script&gt;fixture&lt;\/script&gt;/);assert.match(html(c),/data-retry="id&quot;&gt;&lt;img/);assert.doesNotMatch(html(c),/<script>|<img/);assert.match(html(c),/aria-live="polite"/);assert.match(html(c),/待订正、已订正只指基础练习和测评/);c.cleanup();}finally{subjects.math.items[0].question=original;}
 const css=fs.readFileSync(new URL('../dist/styles.css',import.meta.url),'utf8');assert.match(css,/wrong-pagination button\{min-height:52px/);assert.match(css,/wrong-summary:focus\{outline:3px solid var\(--green\)/);
});
test('synthetic local restore keeps notebook default filters and another profile unchanged',async()=>{
 const saved=createStore();for(let i=0;i<2;i++)recordWrong(saved,'practice:math:0',null,'练习');saved.current='B';const c=await setup({saved});c.route('#wrongs');c.click({wrongKind:'corrected'});c.route('#parent');const source=createStore();for(let i=0;i<8;i++)recordWrong(source,'practice:math:0',null,'练习');const backup=exportProfileBackup(source,'A');
 c.backupEvent('change',{target:{id:'backup-file',files:[{size:backup.text.length}]}});await tick();c.readers[0].finish(backup.text);await tick();
 c.backupEvent('click',{target:{dataset:{backupAction:'confirm'},closest(){return this;}}});await tick();c.route('#wrongs');
 assert.equal(cards(c),6);assert.match(html(c),/data-wrong-kind="all" aria-pressed="true"/);assert.match(html(c),/第 1 \/ 2 页/);assert.equal(JSON.parse(c.raw).profiles.A.wrongs.length,2);assert.equal(JSON.parse(c.raw).profiles.B.wrongs.length,8);c.cleanup();
});
