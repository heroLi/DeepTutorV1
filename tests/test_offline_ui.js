// Focused DOM-state tests, not a browser/layout substitute. Run: node tests/test_offline_ui.js
const fs=require('fs'),vm=require('vm'),assert=require('assert');
class Element {
  constructor(){this.children=[];this.value='';this.textContent='';this.disabled=false;this.src='';this.classes=new Set();this.classList={toggle:(c,on)=>on?this.classes.add(c):this.classes.delete(c),add:c=>this.classes.add(c),remove:c=>this.classes.delete(c),contains:c=>this.classes.has(c)};}
  append(...e){this.children.push(...e)}
  replaceChildren(...e){this.children=e}
}
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
const context={document:{querySelector:get,createElement:()=>new Element()},setTimeout:()=>0,clearTimeout:()=>{},console};
vm.createContext(context);
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const script=html.split('<script>')[1].split('</script>')[0].replace('}init();','}');
vm.runInContext(script,context);
const item={id:'test',learner:'sister',state:'offline_ready',source:'demo',message:'离线',output:{},plan:{title:'平均分',question:'12颗糖',quiz:{question:'15颗糖',answer:'5'},scenes:Array.from({length:4},(_,i)=>({title:`步骤${i+1}`,narration:'想一想',board:['12 ÷ 3 = 4']}))}};
context.item=item;vm.runInContext('show(item)',context);
assert(get('#source').textContent.includes('非 AI'));
assert(get('#previousStep').disabled);
assert(get('#quiz').classList.contains('hidden'));
assert.equal(get('#storyboard').children.filter(x=>!x.classList.contains('hidden')).length,1);
for(let i=0;i<4;i++)get('#nextStep').onclick();
assert(!get('#quiz').classList.contains('hidden'));
assert(get('#nextStep').disabled);
get('#nextStep').onclick(); // Repeated navigation remains clamped.
assert(!get('#quiz').classList.contains('hidden'));
get('#previousStep').onclick();assert(get('#quiz').classList.contains('hidden'));
for(let i=0;i<8;i++)get('#previousStep').onclick();assert(get('#previousStep').disabled);
get('#answer').value='old';get('#feedback').textContent='old';
context.item={...item,id:'another'};vm.runInContext('show(item)',context);
assert.equal(get('#answer').value,'');assert.equal(get('#feedback').textContent,'');
assert(get('#player').classList.contains('hidden'));
assert(get('#reviewControls').classList.contains('hidden'));
context.item={...item,state:'draft'};vm.runInContext('show(item)',context);
assert(get('#studySteps').classList.contains('hidden'));
assert(!get('#reviewControls').classList.contains('hidden'));
assert.equal(get('#storyboard').children.filter(x=>!x.classList.contains('hidden')).length,4);
context.item={...item,state:'ready',output:{has_audio:false}};vm.runInContext('show(item)',context);
assert(!get('#player').classList.contains('hidden'));
assert(!get('#quiz').classList.contains('hidden'));
assert.equal(get('#downloads').children.length,3);
console.log('PASS: offline step navigation and bounds, practice reveal/back, new lesson reset, source label, draft controls, existing video/player/download state.');
