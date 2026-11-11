import test from 'node:test';
import assert from 'node:assert/strict';
test('UI route/event smoke: practice, assessment, wrong retry, history and profile clearing',async()=>{
 const nodes=new Map();
 function node(key){if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',hidden:true,events:{},dataset:{},focus(){},showModal(){this.open=true;},close(){this.open=false;},addEventListener(k,fn){this.events[k]=fn;},querySelector(selector){return node(`${key} ${selector}`);},removeEventListener(k){delete this.events[k];},pause(){},setAttribute(){}});return nodes.get(key);}
 globalThis.document={body:{dataset:{}},querySelector:node,querySelectorAll:()=>[]};
 const map=new Map();globalThis.window={localStorage:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},scrollTo(){},addEventListener(k,fn){this[k]=fn;}};
 let hash='';globalThis.location={get hash(){return hash;},set hash(v){hash=v?(v.startsWith('#')?v:'#'+v):'';}};globalThis.CSS={escape:x=>x};
 await import('../dist/app.js?ui-test');
 const click=(dataset)=>node('#main').events.click({target:{closest:()=>({dataset,disabled:false})}});
 const route=hash=>{location.hash=hash;window.hashchange();};
 assert.match(node('#main').innerHTML,/视频讲解/);
 click({subject:'math'});assert.match(node('#main').innerHTML,/12 颗糖/);
 click({choice:'3'});click({action:'submit'});assert.match(node('#main').innerHTML,/没关系/);
 route('#wrongs');assert.match(node('#main').innerHTML,/原来选择/);
 const state=JSON.parse([...map.values()][0]);click({retry:state.profiles.A.wrongs[0].id});click({retryChoice:'4'});click({action:'check-retry'});assert.match(node('#main').innerHTML,/已订正/);
 route('#assessments');click({test:'math'});assert.doesNotMatch(node('#main').innerHTML,/正确答案/);
 for(let i=0;i<4;i++)click({testIndex:String(i),testChoice:['5','5','8','4'][i]});
 click({action:'submit-test'});assert.match(node('#main').innerHTML,/4 \/ 4 题答对/);
 route('#parent');assert.match(node('#main').innerHTML,/历次测评/);
 node('#profile-controls').events.click({target:{closest:()=>({dataset:{profile:'B'}})}});assert.match(node('#main').innerHTML,/还没有已交卷的测评/);
 route('#video');assert.match(node('#main').innerHTML,/controls playsinline/);
 node('#profile-controls').events.click({target:{closest:()=>({dataset:{},id:'clear-profile'})}});assert.equal(node('#clear-confirm').open,true);
 node('#confirm-clear').events.click();assert.equal(node('#clear-confirm').open,false);
 const finalState=JSON.parse([...map.values()][0]);assert.equal(finalState.profiles.A.assessments.length,1);assert.equal(finalState.profiles.B.assessments.length,0);
});
