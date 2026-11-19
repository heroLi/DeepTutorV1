import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../dist/curriculum-model.js';

test('accepted transitions restore region focus; rejected/stale actions do not redraw or move it',async()=>{
 const old={document:globalThis.document,confirm:globalThis.confirm};
 const make=()=>({html:'',renders:0,focuses:0,events:{},get innerHTML(){return this.html;},set innerHTML(value){this.html=value;this.renders++;},addEventListener(t,fn){this.events[t]=fn;},focus(){this.focuses++;}});
 const catalogEl=make(),roundEl=make();let allowSwitch=false;
 globalThis.document={querySelector:s=>s==='#catalog'?catalogEl:roundEl};globalThis.confirm=()=>allowSwitch;
 const click=(el,dataset)=>el.events.click({target:{closest:()=>({dataset})}});
 const accepted=dataset=>{const count=roundEl.focuses;click(roundEl,dataset);assert.equal(roundEl.focuses,count+1);};
 const ignored=dataset=>{const before=[roundEl.innerHTML,roundEl.renders,roundEl.focuses];click(roundEl,dataset);assert.deepEqual([roundEl.innerHTML,roundEl.renders,roundEl.focuses],before);};
 try{
  await import('../dist/curriculum-ui.js');click(catalogEl,{subject:'math'});assert.equal(roundEl.focuses,1);
  ignored({action:'next'});ignored({choice:'not-a-choice'});ignored({action:'restart'});ignored({action:'unknown'});
  accepted({action:'hint'});ignored({action:'hint'});accepted({action:'retry'});
  accepted({choice:'72'});ignored({choice:'72'});ignored({action:'hint'});accepted({action:'next'});
  assert.match(roundEl.innerHTML,/第 2 \/ 3 题/);ignored({action:'next'});
  accepted({choice:'36'});accepted({action:'retry'});accepted({choice:'128'});accepted({action:'next'});
  accepted({choice:'138'});accepted({action:'next'});assert.match(roundEl.innerHTML,/本轮证据/);
  ignored({action:'next'});ignored({action:'restart'});allowSwitch=true;accepted({action:'restart'});allowSwitch=false;assert.match(roundEl.innerHTML,/第 1 \/ 3 题/);
  const before=[roundEl.innerHTML,roundEl.focuses];click(catalogEl,{subject:'english'});assert.deepEqual([roundEl.innerHTML,roundEl.focuses],before);
  allowSwitch=true;click(catalogEl,{subject:'english'});assert.equal(roundEl.focuses,before[1]+1);
  for(const q of catalog.find(s=>s.id==='english').questions){accepted({choice:q.answer});accepted({action:'next'});}
 }finally{
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.confirm===undefined)delete globalThis.confirm;else globalThis.confirm=old.confirm;
 }
});
