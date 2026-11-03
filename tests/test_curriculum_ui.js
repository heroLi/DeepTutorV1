// State checks against the actual page script, not browser or accessibility QA.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
class Element{constructor(){this.children=[];this.value='';this.textContent='';this.disabled=false;this.checked=false;this.src='';this.classList={toggle(){},add(){},remove(){}};}append(...a){this.children.push(...a)}replaceChildren(...a){this.children=a}}
const els=new Map(),get=id=>{if(!els.has(id))els.set(id,new Element());return els.get(id)};
const ctx={document:{querySelector:get,createElement:()=>new Element()},setTimeout:()=>0,clearTimeout(){},console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8').split('<script>')[1].split('</script>')[0].replace('}init();','}'),ctx);
ctx.sample={learner:'sister',revision:2,config:{schema_version:'1.0',region:'Shanghai',school_system:'five_four',grade:null,semester:null,academic_year:'',textbooks:[{subject:'english',title:'Synthetic English',status:'pending',source_refs:[]}]},subjects:{math:{label:'按能力练习 · 教材进度待核对'},english:{label:'待核对'},chinese:{label:'待核对'}}};
get('#learner').value='sister';get('#subject').value='math';
vm.runInContext('curriculumCache=sample;displayBook()',ctx);
assert.equal(get('#bookTitle').value,'');assert.equal(get('#bookStatus').value,'pending');assert(!get('#bookProgress').checked);assert(get('#curriculumStatus').textContent.includes('待核对'));
get('#grade').value='3';get('#semester').value='first';get('#academicYear').value='2026-2027';get('#bookTitle').value='Synthetic math';get('#bookPublisher').value='Synthetic publisher';get('#bookEdition').value='draft';get('#bookSource').value='local:test\n';
ctx.record=[];vm.runInContext("api=async(url,opts)=>{record.push({url,body:JSON.parse(opts.body)});return {...sample,revision:3,config:JSON.parse(opts.body).config}}",ctx);
(async()=>{
 await get('#saveCurriculum').onclick();
 assert.equal(ctx.record.length,1);assert.equal(ctx.record[0].body.expected_revision,2);
 assert.equal(ctx.record[0].body.config.textbooks.length,2);
 assert.equal(ctx.record[0].body.config.textbooks.find(b=>b.subject==='english').title,'Synthetic English');
 assert.equal(ctx.record[0].body.config.grade,3);
 assert(!get('#learner').disabled&&!get('#saveCurriculum').disabled);
 assert(get('#curriculumMessage').textContent.includes('保存'));
 vm.runInContext("api=async()=>{throw Error('配置已经更新，请重新打开后再保存')}",ctx);
 await get('#saveCurriculum').onclick();assert(get('#curriculumMessage').textContent.includes('已经更新'));assert(!get('#saveCurriculum').disabled);
 get('#learner').value='little_sister';await get('#saveCurriculum').onclick();assert.equal(ctx.record.length,1);
 console.log('PASS: curriculum pending defaults, preserve other subject, revisioned save, stale-error recovery, profile mismatch guard.');
})().catch(e=>{console.error(e);process.exitCode=1});
