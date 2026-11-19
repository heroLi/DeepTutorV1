import test from 'node:test';import assert from 'node:assert/strict';
import {catalog,catalogEvidence,nationalCatalog} from '../dist/curriculum-model.js';
test('2024 historical candidate evidence separates school systems and precise PDF pages',()=>{
 assert.equal(catalogEvidence.year,2024);assert.equal(catalogEvidence.status,'historical-candidate');
 assert.equal(catalogEvidence.schoolAdoptionVerified,false);assert.equal(catalogEvidence.unitOrderVerified,false);
 assert.equal(catalogEvidence.inspectedUrl,nationalCatalog);assert.equal(catalogEvidence.originalAccess,'indexed-text-cross-checked');
 assert.match(catalogEvidence.originalUrl,/^https:\/\/www.moe.gov.cn\//);
 const math=catalogEvidence.entries.find(e=>e.id==='math-54'),fiveFour=catalogEvidence.entries.find(e=>e.id==='english-54'),other=catalogEvidence.entries.find(e=>e.id==='english-36');
 assert.deepEqual(math.editors,['李大潜']);assert.equal(math.printedPage,3);
 assert.deepEqual(fiveFour.editors,['束定芳']);assert.equal(fiveFour.printedPage,6);assert.deepEqual(fiveFour.gradeRange,[3,5]);
 assert.deepEqual(other.editors,['张春柏','施嘉平']);assert.equal(other.printedPage,5);assert.deepEqual(other.gradeRange,[3,6]);
 assert.notEqual(other.schoolSystem,fiveFour.schoolSystem);
 for(const row of catalogEvidence.entries){assert.equal(row.pdfPageIndex,row.printedPage-1);assert.equal(row.publisher,row.subject==='语文'?'人民教育出版社':'上海教育出版社');assert.ok(row.gradeRange[0]<=3&&row.gradeRange[1]>=3);}
 for(const subject of catalog){assert.match(subject.book,/2024 候选书系/);assert.match(subject.book,/2026印次待核实/);}
});
test('rendered catalogue labels history, access limits and separate English editors',async()=>{
 const old=globalThis.document;
 const element={innerHTML:'',addEventListener(){}};globalThis.document={querySelector:()=>element};
 try{
  await import('../dist/curriculum-ui.js');
  assert.match(element.innerHTML,/不是 2026 学校实际选用证明/);assert.match(element.innerHTML,/教育部原链接的网页索引文本/);assert.match(element.innerHTML,/未做文件字节比对/);assert.ok(element.innerHTML.includes(catalogEvidence.originalUrl));
  for(const name of ['温儒敏','王立军','李大潜','束定芳','张春柏','施嘉平'])assert.ok(element.innerHTML.includes(name));
  for(const page of [1,3,5,6])assert.ok(element.innerHTML.includes(`#page=${page}`));
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('Chinese candidate records the primary five-four row, not the secondary volumes',()=>{
 const row=catalogEvidence.entries.find(e=>e.id==='chinese-54');
 assert.deepEqual(row.editors,['温儒敏','王立军']);assert.equal(row.printedPage,1);assert.equal(row.pdfPageIndex,0);
 assert.equal(row.volumeRange,'一年级上册至五年级下册');assert.deepEqual(row.gradeRange,[1,5]);
 assert.equal(row.schoolSystem,'五四学制');assert.equal(row.publisher,'人民教育出版社');
});
