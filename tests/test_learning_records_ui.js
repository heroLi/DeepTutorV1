// Deterministic shipped-script DOM tests, not browser/layout verification. Synthetic data only.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const script=html.split('<script>')[1].split('</script>')[0].replace('}init();','}');
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.value='';this.textContent='';this.disabled=false;this.src='';this.classList={toggle(){},add(){},remove(){}};}
 append(...children){this.children.push(...children)} replaceChildren(...children){this.children=children}
 pause(){} removeAttribute(name){delete this[name]}
}
function harness(){
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
 get('#learner').value='sister';const calls=[],pending=[],events={},downloads=[],blobs=[];
 class TestURL extends URL{}TestURL.createObjectURL=blob=>{blobs.push(blob);return 'blob:synthetic'};TestURL.revokeObjectURL=()=>{};
 const ctx={document:{querySelector:get,createElement:tag=>{const el=new Element(tag);el.click=()=>downloads.push({href:el.href,download:el.download});return el}},window:{addEventListener:(name,fn)=>events[name]=fn},location:{origin:'http://localhost'},URL:TestURL,Blob,setTimeout:()=>0,clearTimeout(){},console,fetch:(url,options)=>{calls.push({url,options});return new Promise((resolve,reject)=>pending.push({url,resolve:data=>resolve({ok:true,json:async()=>data}),reject}));}};
 vm.createContext(ctx);vm.runInContext(script,ctx);
 return {get,calls,pending,events,downloads,blobs,ctx,run:code=>vm.runInContext(code,ctx)};
}
const data=(learner='sister',records=[])=>({schema_version:'1.0',learner,generated_at:'2026-11-03T00:00:00Z',records,summary:{sessions:records.length,completed:records.filter(r=>r.status==='completed').length,in_progress:records.filter(r=>r.status!=='completed').length,independent_transfer_evidence:1}});
const record=(patch={})=>({session_id:'synthetic-1',lesson_id:'lesson-test',status:'attempting',stage:'initial',question:'合成题目：12颗糖平均分给3人',evidence:[{kind:'initial',first_attempt_correct:null,hints_used:0,attempt_count:0,independent_evidence:false,first_attempt_at:null,last_attempt_at:null}],created_at:null,updated_at:null,continue_url:'/learn?session=synthetic-1&learner=sister',curriculum_label:'按能力练习 · 教材进度待核对',...patch});
const text=node=>[node.textContent,...node.children.map(text)].join('\n');
const links=node=>node.children.flatMap(child=>child.tag==='a'?[child]:links(child));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const h=harness();assert.equal(h.calls.length,0,'Script binding must not mutate or load eagerly when init is omitted');
 let loading=h.run('practiceRecords()');assert(h.get('#refreshPracticeRecords').disabled);h.pending.shift().resolve(data());await loading;
 assert(text(h.get('#practiceRecordsStatus')).includes('还没有'));assert(!h.get('#refreshPracticeRecords').disabled);
 loading=h.get('#refreshPracticeRecords').onclick();assert.equal(h.calls.at(-1).url,'/api/practice-records?learner=sister');assert.equal(h.calls.at(-1).options.method,'GET');assert.equal(h.calls.at(-1).options.cache,'no-store');
 h.pending.shift().resolve(data('sister',[record(),record({session_id:'synthetic-2',status:'completed',stage:'transfer',created_at:'2026-11-03T00:01:00Z',updated_at:'2026-11-03T01:02:00Z',continue_url:'/learn?session=synthetic-2&learner=sister',evidence:[{kind:'transfer',first_attempt_correct:true,hints_used:0,attempt_count:1,independent_evidence:true,first_attempt_at:null,last_attempt_at:'2026-11-03T01:02:00Z'}]})]));await loading;
 const rendered=text(h.get('#practiceRecords'));assert(rendered.includes('日期未记录'));assert(rendered.includes('08:01'));assert(rendered.includes('09:02'));assert(rendered.includes('上海时间'));assert(rendered.includes('可能已看过'));assert(rendered.includes('不代表已经掌握'));assert(rendered.includes('尚无首次作答记录'));
 assert.deepEqual(links(h.get('#practiceRecords')).map(a=>a.textContent),['继续练习','查看本次小记']);
 assert.equal(h.run("practiceDate('2026-11-03T00:00:00')"),'日期未记录');assert.equal(h.run("practiceDate('badZ')"),'日期未记录');
 for(const unsafe of ['https://evil.invalid/learn?session=synthetic-1&learner=sister','//evil.invalid/learn?session=synthetic-1&learner=sister','/learn?session=other&learner=sister','/learn?session=synthetic-1&learner=little_sister','/learn?session=synthetic-1&learner=sister&learner=sister','/learn?session=synthetic-1&learner=sister&redirect=https://evil.invalid','/learn?session=synthetic-1&learner=sister#extra','javascript:alert(1)']){h.ctx.unsafe=unsafe;assert.equal(h.run("safePracticeURL(unsafe,'sister','synthetic-1')"),null)}
 assert.equal(h.run("safePracticeURL('/learn?session=synthetic-1&learner=sister','sister','synthetic-1')"),'/learn?session=synthetic-1&learner=sister');
 // Newer refresh wins even when both responses concern the same profile.
 const old=h.run('practiceRecords()'),oldPending=h.pending.shift(),latest=h.run('practiceRecords()'),latestPending=h.pending.shift();latestPending.resolve(data('sister',[record({question:'最新记录'})]));await latest;oldPending.resolve(data('sister',[record({question:'过时记录'})]));await old;assert(text(h.get('#practiceRecords')).includes('最新记录'));assert(!text(h.get('#practiceRecords')).includes('过时记录'));
 // Profile change clears immediately, including A -> B -> A before old A resolves.
 h.run('history=async()=>{};memory=async()=>{};curriculum=async()=>{}');
 const stale=h.run('practiceRecords()'),stalePending=h.pending.shift();
 h.get('#learner').value='little_sister';const switchB=h.get('#learner').onchange();assert.equal(h.get('#practiceRecords').children.length,0);assert(!text(h.get('#practiceRecordsStatus')).includes('最新记录'));const bPending=h.pending.shift();
 h.get('#learner').value='sister';const switchA=h.get('#learner').onchange();const aPending=h.pending.shift();stalePending.resolve(data('sister',[record({question:'旧姐姐'})]));await stale;assert.equal(h.get('#practiceRecords').children.length,0);bPending.resolve(data('little_sister',[record({question:'妹妹'})]));await switchB;assert.equal(h.get('#practiceRecords').children.length,0);aPending.resolve(data('sister',[record({question:'新姐姐'})]));await switchA;assert(text(h.get('#practiceRecords')).includes('新姐姐'));
 // Visible error, retry, and mismatched response rejection never retain old list data.
 let failing=h.run('practiceRecords()');h.pending.shift().reject(Error('offline'));await failing;assert.equal(h.get('#practiceRecords').children.length,0);assert(text(h.get('#practiceRecordsStatus')).includes('刷新小记'));assert(!h.get('#refreshPracticeRecords').disabled);
 failing=h.run('practiceRecords()');h.pending.shift().resolve(data('little_sister',[record()]));await failing;assert.equal(h.get('#practiceRecords').children.length,0);
 // Export always fetches fresh JSON after the explicit click. Switching invalidates pending download.
 let exporting=h.get('#exportPracticeRecords').onclick();assert.equal(h.calls.at(-1).url,'/api/practice-records/export?learner=sister');assert.equal(h.calls.at(-1).options.method,'GET');assert.equal(h.calls.at(-1).options.cache,'no-store');const exportOld=h.pending.shift();h.get('#learner').value='little_sister';const toB=h.get('#learner').onchange();const listB=h.pending.shift();exportOld.resolve(data('sister',[record()]));await exporting;assert.equal(h.downloads.length,0);listB.resolve(data('little_sister'));await toB;
 exporting=h.get('#exportPracticeRecords').onclick();assert.equal(h.calls.at(-1).url,'/api/practice-records/export?learner=little_sister');h.pending.shift().resolve(data('little_sister',[record({question:'刚刚更新的导出'})]));await exporting;assert.equal(h.downloads.length,1);assert.equal(h.downloads[0].download,'little_sister-practice-records.json');assert((await h.blobs[0].text()).includes('刚刚更新的导出'));assert(!h.get('#exportPracticeRecords').disabled);
 exporting=h.get('#exportPracticeRecords').onclick();h.pending.shift().reject(Error('offline'));await exporting;assert.equal(h.downloads.length,1);assert(h.get('#practiceExportStatus').textContent.includes('导出失败'));
 // Returning from a child page refreshes read-only records, not the lesson or answer.
 const before=h.calls.length;h.events.pageshow({persisted:false});assert.equal(h.calls.length,before);h.events.pageshow({persisted:true});assert.equal(h.calls.length,before+1);assert(h.calls.at(-1).url.startsWith('/api/practice-records?'));assert.equal(h.calls.at(-1).options.method,'GET');h.pending.shift().resolve(data('little_sister'));await flush();
 assert(h.calls.every(call=>call.options.method==='GET'));assert(!h.calls.some(call=>call.url.includes('/api/lessons')));
 // A successful lesson deletion reloads records, so removed sessions cannot linger.
 h.ctx.confirm=()=>true;h.run("current={id:'lesson-test'}");const deleting=h.get('#delete').onclick();assert.equal(h.calls.at(-1).options.method,'DELETE');h.pending.shift().resolve({ok:true});await flush();assert(h.calls.at(-1).url.startsWith('/api/practice-records?'));assert.equal(h.calls.at(-1).options.method,'GET');h.pending.shift().resolve(data('little_sister'));await deleting;
 // Deletion also invalidates an earlier export for this same profile.
 const downloadCount=h.downloads.length;const beforeDeleteExport=h.get('#exportPracticeRecords').onclick(),lateExport=h.pending.shift();assert(h.get('#exportPracticeRecords').disabled);h.run("current={id:'lesson-test'}");const deleteDuringExport=h.get('#delete').onclick();h.pending.shift().resolve({ok:true});await flush();assert(!h.get('#exportPracticeRecords').disabled);assert.equal(h.get('#practiceRecords').children.length,0);lateExport.resolve(data('little_sister',[record({question:'已删除记录'})]));await beforeDeleteExport;assert.equal(h.downloads.length,downloadCount);h.pending.shift().resolve(data('little_sister'));await deleteDuringExport;assert(!h.get('#refreshPracticeRecords').disabled);assert(!h.get('#practiceExportStatus').textContent.includes('下载'));
 assert(html.includes('旧版复习小记')&&html.includes('与孩子练习小记分开保存'));
 console.log('PASS: records empty/completed/in-progress states, Shanghai/null dates, safe continuation, latest-request/profile guards, read-only refresh, fresh scoped exports, failures, and BFCache return.');
})().catch(error=>{console.error(error);process.exitCode=1});
