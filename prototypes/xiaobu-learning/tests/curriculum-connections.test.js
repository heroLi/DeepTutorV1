import test from 'node:test';
import assert from 'node:assert/strict';
import {shanghaiConnections as data} from '../dist/curriculum-connections.js';
import {startParentFlowPreview} from '../dev/parent-flow-preview.js';
test('2026 supplement metadata distinguishes PDF position, printed page and pending approval',()=>{
 assert.equal(data.schoolMatchVerified,false);assert.equal(data.completeContentsVerified,false);
 assert.deepEqual(data.supplements.map(r=>r.subject),['语文','数学','英语']);
 for(const row of data.supplements){assert.equal(row.pdfPage,1);assert.equal(row.printedPage,4);assert.match(row.kind,/非教科书本体/);assert.equal(row.year,2026);}
 assert.match(data.supplements[0].approval,/待审/);
 assert.equal(data.supplements[1].approval,'SD－XX－2026002');assert.equal(data.supplements[2].approval,'SD－XX－2025005');
});
test('observed school lessons and verified institute unit themes remain distinct from full contents',()=>{
 const observation=data.lessonObservations.find(row=>row.subject==='语文'&&row.status==='official-school-page-verified'),candidate=data.unitCandidates[0];
 assert.deepEqual(observation.titles,['总也倒不了的老屋','犟龟','小狗学叫']);
 assert.equal(observation.status,'official-school-page-verified');assert.match(observation.limitation,/不是完整目录/);
 assert.equal(candidate.livePageRetrieved,true);assert.equal(candidate.status,'official-institute-page-verified');assert.equal(candidate.originalGovPageRetrieved,false);
 assert.equal(candidate.unit,5);assert.equal(candidate.title,'I can help');
});
test('connection UI exposes concrete records and access limitations',async()=>{
 const old=globalThis.document,element={innerHTML:'',addEventListener(){}};
 globalThis.document={querySelector:()=>element};
 try{
  await import('../dist/curriculum-ui.js?connections');
  for(const text of ['SD－XX－2026002','SD－XX－2025005','犟龟','I can help','未核实ISBN','不自动绑定','概括主要内容','summary-original-1','summary-original-2','不能推断2026年秋季版本'])assert.ok(element.innerHTML.includes(text));
  assert.match(element.innerHTML,/PDF 第 1 页／印刷第 4 页/);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
test('local server allowlists the new metadata module',async()=>{
 const server=await startParentFlowPreview();try{
  const res=await fetch(server.origin+'/curriculum-connections.js');assert.equal(res.status,200);
  assert.match(res.headers.get('content-type'),/javascript/);assert.match(res.headers.get('content-security-policy'),/connect-src 'none'/);
 }finally{await server.close();}
});

test('math topic observations preserve schedule limits and original exercises are not textbook copies',()=>{
 const row=data.lessonObservations.find(row=>row.subject==='数学');
 assert.equal(row.status,'official-school-schedule-verified');assert.match(row.limitation,/不证明授课已完成/);
 assert.deepEqual(row.titles,['三角形与四边形的初步认识']);
 const practice=data.originalTopicPractice;assert.equal(practice.source,'https://fxxx.qpedu.cn/hszp/526814.htm');
 assert.equal(practice.items.length,4);assert.match(practice.alignment,/不是教材原题或已核验单元同步/);
 assert.match(practice.items[0].answer,/22厘米/);assert.equal((7+4)*2,22);assert.match(practice.items[1].answer,/24厘米/);assert.equal(6*4,24);
 const report=data.lessonObservations.find(row=>row.subject==='数学'&&row.status==='official-school-report-verified');assert.deepEqual(report.titles,['长方形和正方形的周长']);assert.match(report.limitation,/未注明出版社/);
});

test('publisher theme reference is explicit about the unverified five-four match',()=>{
 const row=data.publisherThemeReference;
 assert.equal(row.pdfPage,2);assert.equal(row.printedPage,19);
 assert.equal(row.fiveFourMatchVerified,false);assert.equal(row.schoolMatchVerified,false);
 assert.equal(row.themes.length,8);assert.equal(row.themes[2],'预测与猜想');
 assert.match(row.limitation,/文章未明确五四学制/);assert.equal(row.originalPractice.length,2);
 assert.match(row.originalPractice[0].answer,/继续阅读并修正预测/);
});

test('English original theme tasks link only to the verified institute report',()=>{
 const practice=data.englishTopicPractice;
 assert.equal(practice.source,data.unitCandidates[0].source);assert.equal(practice.unit,5);
 assert.equal(practice.items.length,4);assert.match(practice.alignment,/非教材原题/);
 for(const item of practice.items){assert.ok(item.choices.includes(item.correctChoice));assert.equal(new Set(item.choices).size,3);assert.ok(item.englishText&&item.hint&&item.answer);}
});

test('partial publisher lesson mentions retain their page/unit scope, not a full Shanghai contents claim',()=>{
 const row=data.publisherThemeReference;
 assert.deepEqual(row.lessonMentions.map(x=>[x.unit,x.title,x.pdfPage]),[[3,'犟龟',2],[4,'宝葫芦的秘密（节选）',2],[6,'香港，璀璨的明珠',2],[8,'一定要争气',3]]);
 assert.equal(row.fiveFourMatchVerified,false);
});
test('observation tasks are original, source-scoped and distinguish observation from inference',()=>{
 const row=data.chineseObservationPractice;assert.equal(row.referenceUnit,5);
 assert.match(row.alignment,/五四学制对应及用户学校选用未核实/);assert.equal(row.items.length,2);
 for(const item of row.items){assert.match(item.text,/原创短文/);assert.ok(item.choices.includes(item.correctChoice));assert.equal(new Set(item.choices).size,3);}
 assert.match(row.items[0].answer,/今天会不会下雨没有说明/);
 assert.match(row.items[1].answer,/没有对所有叶子下结论/);
});


test('original extension tasks verify missing width and equal perimeter without area confusion',()=>{
 const [inverse,comparison]=data.originalTopicPractice.items.slice(2);
 assert.equal(inverse.correctChoice,`${(20-6*2)/2}厘米`);
 assert.match(inverse.answer,/两条宽的总长/);assert.equal((6+4)*2,20);
 assert.equal((7+3)*2,(6+4)*2);assert.notEqual(7*3,6*4);
 assert.equal(comparison.correctChoice,'周长相等，都是20厘米');assert.match(comparison.answer,/不比较面积/);
 for(const item of [inverse,comparison]){assert.equal(new Set(item.choices).size,3);assert.ok(item.choices.includes(item.correctChoice));}
});


test('January school report is a dated grade/unit observation, not proof of autumn adoption',()=>{
 const row=data.lessonObservations.find(row=>row.activityDate==='2026-01-06');
 assert.equal(row.unit,8);assert.equal(row.grade,3);assert.equal(row.schoolYear,'2025学年第一学期');
 assert.deepEqual(row.titles,['手术台就是阵地']);assert.match(row.limitation,/不能推断2026年秋季版本/);
 assert.equal(data.completeContentsVerified,false);assert.equal(data.schoolMatchVerified,false);
});
test('original main-event tasks preserve provenance and reject invented events',()=>{
 const p=data.chineseSummaryPractice;assert.equal(p.items.length,2);assert.match(p.alignment,/非教材课文改写或原题/);
 assert.equal(p.source,data.lessonObservations.find(r=>r.activityDate==='2026-01-06').source);
 for(const row of p.items){assert.match(row.text,/原创短文/);assert.equal(new Set(row.choices).size,3);assert.ok(row.choices.includes(row.correctChoice));}
 assert.match(p.items[0].answer,/买书没有发生/);assert.match(p.items[1].answer,/没有买新车/);
});


test('English helping extensions require tracking negation and helper roles',()=>{
 const [negation,roles]=data.englishTopicPractice.items.slice(2);
 assert.match(negation.englishText,/I cannot carry it/);assert.equal(negation.correctChoice,'Open the door.');assert.match(negation.hint,/否定/);
 assert.equal(roles.correctChoice,'Ben helps Ann.');assert.match(roles.answer,/He 接着指 Ben/);
 for(const item of [negation,roles]){assert.equal(new Set(item.choices).size,3);assert.ok(item.choices.includes(item.correctChoice));}
});

test('Pudong grade 3 rollout supports a word-level reference and offline original writing',()=>{
 const row=data.englishRollout;
 assert.equal(row.unit,1);assert.equal(row.keyword,'goal');assert.equal(row.published,'2026-09-11');
 assert.ok(row.source.startsWith('https://jfy.pudong-edu.sh.cn/'));
 assert.match(row.limitation,/不提供该单元的正式名称或完整目录/);
 assert.equal(data.schoolMatchVerified,false);assert.equal(data.completeContentsVerified,false);
 assert.match(row.practice.passage,/My goal is to draw a bird/);
 assert.match(row.practice.writingPrompt,/在纸上替虚构角色写一句/);
 assert.equal(row.practice.example,'My goal is to read a book.');
 assert.match(row.practice.writingCheck,/不上传、不自动评分/);
});

test('Xuhui report supports a bounded lesson reference and a distinct key-sentence practice',()=>{
 const row=data.chineseCityReading;
 assert.equal(row.grade,3);assert.equal(row.term,'上册');assert.equal(row.unit,6);assert.equal(row.lessonType,'略读课文');
 assert.equal(row.title,data.publisherThemeReference.lessonMentions.find(r=>r.unit===6).title);
 assert.match(row.verification,/网页索引文本/);assert.match(row.limitation,/未确认五四学制/);
 assert.equal(data.schoolMatchVerified,false);assert.equal(data.completeContentsVerified,false);
 assert.match(row.practice.task,/两处细节/);
 for(const key of ['展馆','潮汐牌']){assert.ok(row.practice.passage.includes(key));assert.ok(row.practice.example.includes(key));}
});
