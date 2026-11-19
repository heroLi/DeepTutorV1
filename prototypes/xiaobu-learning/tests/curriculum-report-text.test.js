import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,createRound,choose,next,roundReport} from '../dist/curriculum-model.js';

test('read-only report fallback exposes the same report without clipboard permissions or downloads',async()=>{
 const old={document:globalThis.document,confirm:globalThis.confirm,random:Math.random};
 const status={textContent:''};let focused=0,selected=0,fail=false;
 const field={focus(){focused++;},select(){if(fail)throw Error('unsupported');selected++;}};
 const make=()=>({innerHTML:'',events:{},addEventListener(t,fn){this.events[t]=fn;},focus(){},querySelector:s=>s==='#report-text'?field:status});
 const catalogEl=make(),roundEl=make();
 globalThis.document={querySelector:s=>s==='#catalog'?catalogEl:roundEl};globalThis.confirm=()=>true;
 const click=(el,dataset)=>el.events.click({target:{closest:()=>({dataset})}});
 const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 Math.random=()=>0;
 try{
  await import('../dist/curriculum-ui.js');click(catalogEl,{subject:'english'});
  click(roundEl,{action:'select-report'});assert.equal(selected,0);
  const model=createRound('english');
  for(const q of catalog.find(s=>s.id==='english').questions){click(roundEl,{choice:q.answer});click(roundEl,{action:'next'});choose(model,q.answer);next(model);}
  assert.match(roundEl.innerHTML,/<details class="report-text">/);
  assert.match(roundEl.innerHTML,/<textarea[^>]*readonly rows="12">/);
  assert.ok(roundEl.innerHTML.includes(escape(roundReport(model))));
  const before=roundEl.innerHTML;
  click(roundEl,{action:'select-report'});assert.equal(selected,1);assert.equal(focused,1);
  assert.match(status.textContent,/尚未自动复制到剪贴板/);assert.equal(roundEl.innerHTML,before);
  click(roundEl,{action:'select-report'});assert.equal(selected,2);assert.equal(roundEl.innerHTML,before);
  fail=true;click(roundEl,{action:'select-report'});assert.match(status.textContent,/手动选择并复制/);
  assert.equal(roundEl.innerHTML,before);
  click(roundEl,{action:'restart'});assert.doesNotMatch(roundEl.innerHTML,/id="report-text"/);
  click(roundEl,{action:'select-report'});assert.equal(selected,2);
 }finally{
  Math.random=old.random;
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.confirm===undefined)delete globalThis.confirm;else globalThis.confirm=old.confirm;
 }
});
