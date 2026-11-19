import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../dist/curriculum-model.js';

test('report download is local, repeatable, cleaned up and failure leaves round intact',async()=>{
 const old={document:globalThis.document,confirm:globalThis.confirm,create:URL.createObjectURL,revoke:URL.revokeObjectURL,timer:globalThis.setTimeout};
 const status={textContent:''},callbacks=[],blobs=[],revoked=[],links=[];
 let clicks=0,removed=0,fail=false;
 const make=()=>({innerHTML:'',listeners:{},addEventListener(t,fn){this.listeners[t]=fn;},focus(){},querySelector(){return status;}});
 const catalogEl=make(),roundEl=make();
 globalThis.document={querySelector:s=>s==='#catalog'?catalogEl:roundEl,body:{append(link){links.push(link);}},createElement(tag){assert.equal(tag,'a');return {click(){if(fail)throw Error('DENIED');clicks++;},remove(){removed++;}};}};
 globalThis.confirm=()=>true;
 URL.createObjectURL=blob=>{blobs.push(blob);return `blob:test-${blobs.length}`;};
 URL.revokeObjectURL=url=>revoked.push(url);
 globalThis.setTimeout=fn=>{callbacks.push(fn);return callbacks.length;};
 const click=(el,dataset)=>el.listeners.click({target:{closest:()=>({dataset})}});
 try{
  await import('../dist/curriculum-ui.js');
  click(catalogEl,{subject:'math'});
  click(roundEl,{action:'download'});assert.equal(blobs.length,0);
  for(const q of catalog.find(s=>s.id==='math').questions){click(roundEl,{choice:q.answer});click(roundEl,{action:'next'});}
  assert.match(roundEl.innerHTML,/下载本轮合成自测报告/);
  const before=roundEl.innerHTML;
  click(roundEl,{action:'download'});click(roundEl,{action:'download'});
  assert.equal(clicks,2);assert.equal(removed,2);assert.equal(links.length,2);
  assert.equal(links[0].download,'xiaobu-synthetic-math-report.txt');
  assert.match(blobs[0].type,/text\/plain/);assert.match(await blobs[0].text(),/成人合成自测报告/);
  assert.equal(await blobs[0].text(),await blobs[1].text());
  assert.match(status.textContent,/已请求浏览器下载/);assert.equal(roundEl.innerHTML,before);
  fail=true;click(roundEl,{action:'download'});assert.match(status.textContent,/未能发起下载/);
  assert.equal(roundEl.innerHTML,before);assert.equal(removed,3);
  for(const fn of callbacks)fn();assert.deepEqual(revoked,['blob:test-1','blob:test-2','blob:test-3']);
  fail=false;click(roundEl,{action:'restart'});assert.match(roundEl.innerHTML,/第 1 \/ 3 题/);
 }finally{
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.confirm===undefined)delete globalThis.confirm;else globalThis.confirm=old.confirm;
  URL.createObjectURL=old.create;URL.revokeObjectURL=old.revoke;globalThis.setTimeout=old.timer;
 }
});
