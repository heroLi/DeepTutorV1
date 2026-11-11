import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STORE_KEY} from '../dist/model.js';

// Lightweight DOM/media harness: each HTML replacement gets fresh descendants,
// so old-media cleanup cannot be accidentally satisfied by reusing a fake node.
let run=0;
async function setup(saved){
 const nodes=new Map(),media=[];
 class Node {
  constructor(key){this.key=key;this.html='';this.children=new Map();this.listeners=new Map();this.dataset={};this.attributes={};this.disabled=false;this.hidden=true;this.textContent='';this.focused=false;this.duration=NaN;this.readyState=0;this.paused=true;this.currentTime=0;this.pauseCalls=0;this.playCalls=0;}
  get innerHTML(){return this.html;}
  set innerHTML(value){this.html=value;this.children=new Map();}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type,event={}){for(const fn of [...this.listeners.get(type)||[]])fn(event);}
  setAttribute(key,value){this.attributes[key]=value;}
  querySelector(selector){if(!this.children.has(selector)){const node=new Node(selector);this.children.set(selector,node);if(selector==='video')media.push(node);}return this.children.get(selector);}
  querySelectorAll(){return [];}
  focus(){this.focused=true;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  click(){if(!this.disabled)this.emit('click');}
  play(){this.playCalls++;this.paused=false;this.emit('play');this.emit('playing');return Promise.resolve();}
  pause(){this.pauseCalls++;this.paused=true;this.emit('pause');}
  load(){this.duration=69.27;this.readyState=1;this.emit('loadedmetadata');}
 }
 const node=key=>{if(!nodes.has(key))nodes.set(key,new Node(key));return nodes.get(key);};
 globalThis.document={body:node('body'),querySelector:node,querySelectorAll:()=>[]};
 const map=new Map(saved?[[STORE_KEY,JSON.stringify(saved)]]:[]);
 globalThis.window={localStorage:{getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)},scrollTo(){},addEventListener(type,fn){this[type]=fn;}};
 let hash='';globalThis.location={get hash(){return hash;},set hash(value){hash=value?(value.startsWith('#')?value:'#'+value):'';}};globalThis.CSS={escape:value=>value};
 await import(`../dist/app.js?workspace-test=${++run}`);
 const click=dataset=>node('#main').emit('click',{target:{closest:()=>({dataset,disabled:false})}});
 const route=value=>{location.hash=value;window.hashchange();};
 const profile=value=>node('#profile-controls').emit('click',{target:{closest:()=>({dataset:{profile:value}})}});
 return {node,click,route,profile,media,html:()=>node('#main').innerHTML,state:()=>JSON.parse(map.get(STORE_KEY))};
}

test('practice workspace gates guidance, keeps genuine math video in place, and excludes language video',async()=>{
 const c=await setup();c.click({subject:'math'});
 assert.equal(document.body.dataset.layout,'learning');
 assert.match(c.html(),/workspace-grid/);assert.match(c.html(),/data-guide="video" disabled/);
 c.click({guide:'video'});assert.doesNotMatch(c.html(),/<video /);
 c.click({action:'hint'});assert.doesNotMatch(c.html(),/小提示 1/);
 c.click({action:'skip'});assert.equal(c.state().profiles.A.wrongs.length,1);
 c.click({action:'hint'});assert.match(c.html(),/小提示 1/);
 c.click({guide:'video'});assert.match(c.html(),/<video /);assert.equal(location.hash,'#math');
 c.route('#chinese');assert.doesNotMatch(c.html(),/data-guide="video"|<video /);
 c.route('#english');assert.doesNotMatch(c.html(),/data-guide="video"|<video /);
 c.route('#');assert.equal(document.body.dataset.layout,'reading');
});

test('video tab redraw, tab switch, next question, route and profile changes stop old playback',async()=>{
 const c=await setup();c.click({subject:'math'});c.click({action:'skip'});c.click({guide:'video'});
 let video=c.media.at(-1);video.load();video.play();video.currentTime=17;
 c.click({choice:'3'});
 assert.equal(video.paused,true);assert.equal(video.pauseCalls,1);assert.equal([...video.listeners.values()].reduce((n,set)=>n+set.size,0),0);
 let restored=c.media.at(-1);assert.notEqual(video,restored);restored.load();assert.equal(restored.currentTime,17);assert.equal(restored.playCalls,0);
 restored.play();c.click({guide:'hints'});assert.equal(restored.paused,true);assert.doesNotMatch(c.html(),/<video /);
 c.click({guide:'video'});video=c.media.at(-1);video.load();assert.equal(video.currentTime,17);assert.equal(video.playCalls,0);
 c.click({choice:'4'});c.click({action:'submit'});c.click({action:'next'});assert.match(c.html(),/18 颗糖/);assert.doesNotMatch(c.html(),/<video /);
 c.click({action:'skip'});c.click({guide:'video'});video=c.media.at(-1);video.load();assert.equal(video.currentTime,0);video.play();c.route('#video');assert.equal(video.paused,true);
 video=c.media.at(-1);video.load();video.play();c.profile('B');assert.equal(video.paused,true);assert.equal(c.media.at(-1).playCalls,0);
 video=c.media.at(-1);video.load();video.play();window.pagehide();assert.equal(video.paused,true);
 window.pageshow({persisted:true});const resumed=c.media.at(-1);assert.notEqual(resumed,video);resumed.load();c.node('#main').querySelector('#video-toggle').click();assert.equal(resumed.playCalls,1);
});

test('paged assessment renders one question, persists position and gates all four answers until submit',async()=>{
 const c=await setup();c.route('#assessments');c.click({test:'math'});
 assert.equal((c.html().match(/class="question-title"/g)||[]).length,1);
 assert.match(c.html(),/15 支铅笔/);assert.doesNotMatch(c.html(),/20 个橘子|正确答案|15 ÷ 3/);
 c.click({action:'submit-test'});assert.equal(c.state().profiles.A.activeTest.completedAt,null);
 c.click({testIndex:'0',testChoice:'5'});c.click({testPage:'2'});assert.match(c.html(),/16 块积木/);
 c.route('#assessments');c.click({action:'continue-test'});assert.match(c.html(),/第 3 \/ 4 题/);
 const saved=c.state(),resumed=await setup(saved);resumed.route('#test');assert.match(resumed.html(),/16 块积木/);
 for(const [i,value] of ['5','5','8','4'].entries()){resumed.click({testPage:String(i)});resumed.click({testIndex:String(i),testChoice:value});}
 assert.doesNotMatch(resumed.html(),/正确答案/);resumed.click({action:'submit-test'});assert.match(resumed.html(),/4 \/ 4 题答对/);assert.match(resumed.html(),/正确答案/);
 resumed.click({resultPage:'2'});assert.match(resumed.html(),/16 块积木/);assert.match(resumed.html(),/16 ÷ 2 = 8/);
 assert.equal(resumed.state().profiles.A.assessments.length,1);resumed.click({action:'submit-test'});assert.equal(resumed.state().profiles.A.assessments.length,1);
});

test('practice completion keeps a compact summary and supports a fresh run without losing completed records',async()=>{
 const c=await setup();c.click({subject:'math'});c.click({choice:'4'});c.click({action:'submit'});c.click({action:'next'});c.click({choice:'6'});c.click({action:'submit'});c.click({action:'next'});
 assert.match(c.html(),/completion-workspace/);assert.equal(document.body.dataset.layout,'learning');assert.match(c.html(),/又往前走了一小步/);assert.equal(c.state().profiles.A.practiceCompleted.length,1);
 c.click({action:'restart'});assert.match(c.html(),/12 颗糖/);assert.equal(c.state().profiles.A.practiceCompleted.length,1);assert.equal(c.state().profiles.A.practices.math.records[0].attempts,0);
});

test('responsive layout keeps actions outside scroll panels with readable questions and controls',()=>{
 const css=fs.readFileSync(new URL('../dist/styles.css',import.meta.url),'utf8');
 assert.match(css,/@media\(min-width:760px\)/);assert.match(css,/@media\(max-width:759px\)/);
 assert.match(css,/height:100dvh/);assert.match(css,/\.question-content,\.guide-content\{overflow:auto/);
 assert.match(css,/\.work-question \.question-title\{font-size:24px/);assert.match(css,/\.work-question \.choice\{min-height:60px/);
 assert.match(css,/\.practice-video \.video-control\{min-height:64px/);
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert.match(html,/id="about"/);assert.match(html,/答案可从浏览器代码查看/);
});
