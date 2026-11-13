import {validLoopState} from './loop-model.js';
// Original bounded exercises adapted from heroLi/DeepTutorV1 @ aa08554.
// No identity, network calls, or formal mastery inference.
export const subjects = {
  math: {label:'数学',topic:'把糖果平均分',symbol:'÷',tag:'平均分',items:[
    {question:'12 颗糖，平均分给 3 个小朋友，每人分到几颗？',choices:['3','4','6','9'],answer:'4',hints:['“平均分”就是每个小朋友分到的糖一样多。','可以画 3 个圈，把 12 颗糖一颗一颗轮流放进圈里，看看每圈有几颗。','12 ÷ 3 = 4。每人 4 颗，3 个人一共 12 颗。现在自己选一次。'],explanation:'12 ÷ 3 = 4。再检查：4 × 3 = 12，每人一样多。'},
    {question:'18 颗糖，平均分给 3 个小朋友，每人分到几颗？',choices:['3','5','6','9'],answer:'6',hints:['总数变了，但“每个人一样多”没有变。','想一想，哪个数乘 3 等于 18？也可以画 3 个圈来分。','18 ÷ 3 = 6。每人 6 颗，3 个人一共 18 颗。现在自己选一次。'],explanation:'18 ÷ 3 = 6。再检查：6 × 3 = 18。'}]},
  chinese: {label:'语文',topic:'找一找反义词',symbol:'字',tag:'情境反义词',items:[
    {question:'一个大箱子要用两手抱，旁边的箱子一只手就能拿。与“大”相反的是哪个字？',choices:['多','长','小','高'],answer:'小',hints:['反义词是一组意思相反的词。先想一想题目中的两种情况。','比较两个箱子的体积。','把“大”和“小”放在一起比较，它们的意思相反。现在自己选一次。'],explanation:'这里比较的是箱子的大小。“大”和“小”意思相反。'},
    {question:'一根绳子很长，另一根只剩一点。与“长”相反的是哪个字？',choices:['短','低','少','近'],answer:'短',hints:['反义词表示相反的意思。先看题目在比较什么。','比较绳子从头到尾的长度。','把“长”和“短”放在一起比较，它们的意思相反。现在自己选一次。'],explanation:'这里比较的是绳子的长度。“长”和“短”意思相反。'}]},
  english: {label:'英语',topic:'选 a 还是 an',symbol:'Aa',tag:'a / an',items:[
    {question:'表示“一只猫”时，空格里填什么？\n___ cat',choices:['a','an'],answer:'a',hints:['a 和 an 都可放在单数可数名词前。关键看后面单词开头的发音，不只看字母。','cat 在本题的标准读音以辅音音素 /k/ 开头。辅音音素前用 a。','这个词组是 a cat。请回到空格，自己选一次。'],explanation:'cat 的开头是辅音音素 /k/，所以用 a：a cat。'},
    {question:'表示“一个苹果”时，空格里填什么？\n___ apple',choices:['a','an'],answer:'an',hints:['先注意 apple 开头的发音，不只看字母。','apple 在本题的标准读音以元音音素 /æ/ 开头。元音音素前用 an。','这个词组是 an apple。请回到空格，自己选一次。'],explanation:'apple 的开头是元音音素 /æ/，所以用 an：an apple。'}]}
};
export function createSession(subject){if(!subjects[subject])throw Error('Unknown subject');return {subject,stage:0,complete:false,selected:null,feedback:null,records:[record(),record()]};}
function record(){return {attempts:0,hints:0,firstCorrect:null,solved:false};}
export function item(s){return subjects[s.subject].items[s.stage];}
export function select(s,value){if(s.complete||s.records[s.stage].solved||!item(s).choices.includes(value))return false;s.selected=value;s.feedback=null;return true;}
export function attempt(s,skip=false){const r=s.records[s.stage];if(s.complete||r.solved||(!skip&&!item(s).choices.includes(s.selected)))return false;const correct=!skip&&s.selected===item(s).answer;r.attempts++;if(r.firstCorrect===null)r.firstCorrect=correct;r.solved=correct;s.feedback=correct?'correct':'try';return true;}
export function hint(s){const r=s.records[s.stage];if(s.complete||r.solved||!r.attempts||r.hints>=3)return false;r.hints++;return true;}
export function advance(s){if(s.complete||!s.records[s.stage].solved)return false;if(s.stage===0){s.stage=1;s.selected=null;s.feedback=null;}else{s.complete=true;}return true;}

// Original sample units, deliberately bounded and not textbook alignment.
const question=(question,choices,answer,explanation)=>({question,choices,answer,explanation});
export const units={
 math:{title:'平均分',items:[question('15 支铅笔平均分给 3 人，每人几支？',['3','5','6','12'],'5','15 ÷ 3 = 5，每人 5 支。'),question('20 个橘子平均装进 4 个袋子，每袋几个？',['4','5','8','16'],'5','20 ÷ 4 = 5，每袋一样多。'),question('16 块积木平均分成 2 份，每份几块？',['2','4','8','14'],'8','16 ÷ 2 = 8。'),question('24 本书平均放在 6 层书架上，每层几本？',['3','4','6','18'],'4','24 ÷ 6 = 4。')]},
 chinese:{title:'情境反义词',items:[question('白天很明亮，关灯后的房间很暗。与“明”相反的是？',['亮','暗','白','晴'],'暗','这里比较光线，“明”和“暗”意思相反。'),question('汤刚做好很热，放凉后变冷。与“热”相反的是？',['暖','温','冷','香'],'冷','这里比较温度，“热”和“冷”意思相反。'),question('小兔跑得快，小乌龟走得慢。与“快”相反的是？',['早','急','高','慢'],'慢','这里比较速度，“快”和“慢”意思相反。'),question('装满水的桶很重，空桶很轻。与“重”相反的是？',['轻','少','空','低'],'轻','这里比较重量，“重”和“轻”意思相反。')]},
 english:{title:'a / an',items:[question('一只狗：___ dog',['a','an'],'a','dog 以辅音音素 /d/ 开头，用 a。'),question('一个鸡蛋：___ egg',['a','an'],'an','egg 以元音音素 /e/ 开头，用 an。'),question('一把伞：___ umbrella',['a','an'],'an','umbrella 以元音音素 /ʌ/ 开头，用 an。'),question('一本书：___ book',['a','an'],'a','book 以辅音音素 /b/ 开头，用 a。')]}
};
export const STORE_KEY='xiaobu.learning.v1';
export const profileIds=['A','B'];
const blankProfile=()=>({practices:{},practiceCompleted:[],wrongs:[],assessments:[],activeTest:null});
export const createStore=()=>({version:1,current:'A',profiles:{A:blankProfile(),B:blankProfile()}});
const id=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now=()=>new Date().toISOString();
export function currentProfile(store){return store.profiles[store.current];}
export function switchProfile(store,key){if(!profileIds.includes(key))return false;store.current=key;return true;}
export function clearProfile(store){store.profiles[store.current]=blankProfile();}
export function getPractice(store,key,restart=false){const p=currentProfile(store);if(restart||!p.practices[key])p.practices[key]={...createSession(key),id:id()};return p.practices[key];}
export function questionById(qid){const [kind,key,index]=qid.split(':');return (kind==='practice'?subjects[key]:kind==='test'?units[key]:null)?.items[Number(index)]||null;}
export function recordWrong(store,qid,chosen,source){const q=questionById(qid);if(!q||(chosen!==null&&!q.choices.includes(chosen))||chosen===q.answer)return false;currentProfile(store).wrongs.push({id:id(),qid,chosen,expected:q.answer,date:now(),source,correctedAt:null,retries:[]});return true;}
export function practiceAttempt(store,s,skip=false){const qid=`practice:${s.subject}:${s.stage}`;if(!attempt(s,skip))return false;if(s.feedback==='try')recordWrong(store,qid,skip?null:s.selected,'练习');return true;}
export function finishPractice(store,s){if(!s.complete)return false;const p=currentProfile(store);if(p.practiceCompleted.some(r=>r.id===s.id))return false;p.practiceCompleted.push({id:s.id,subject:s.subject,date:now(),records:structuredClone(s.records)});return true;}
export function retryWrong(store,recordId,chosen){const r=currentProfile(store).wrongs.find(r=>r.id===recordId);if(!r)return null;const q=questionById(r.qid);if(!q.choices.includes(chosen))return null;const correct=chosen===q.answer;r.retries.push({chosen,date:now(),correct});if(correct)r.correctedAt=now();return correct;}
export function startTest(store,subject){if(!units[subject])return null;const t={id:id(),subject,startedAt:now(),cursor:0,answers:units[subject].items.map(()=>null),completedAt:null};currentProfile(store).activeTest=t;return t;}
// Cursor is optional on older browser saves; resume at the first unanswered item.
export function testCursor(t){const count=units[t.subject].items.length;if(Number.isInteger(t.cursor)&&t.cursor>=0&&t.cursor<count)return t.cursor;const next=t.answers.findIndex(a=>a===null);return next<0?0:next;}
export function navigateTest(store,index){const t=currentProfile(store).activeTest;if(!t||t.completedAt||!Number.isInteger(index)||index<0||index>=t.answers.length)return false;t.cursor=index;return true;}
export function chooseTest(store,index,value){const t=currentProfile(store).activeTest;if(!t||t.completedAt||!units[t.subject].items[index]?.choices.includes(value))return false;t.answers[index]=value;return true;}
export function testResults(t){if(!t?.completedAt)return null;return units[t.subject].items.map((q,i)=>({...q,chosen:t.answers[i],correct:t.answers[i]===q.answer}));}
export function submitTest(store){const p=currentProfile(store),t=p.activeTest;if(!t||t.completedAt||t.answers.some(a=>a===null)||p.assessments.some(a=>a.id===t.id))return false;t.completedAt=now();p.assessments.push(structuredClone(t));units[t.subject].items.forEach((q,i)=>{if(t.answers[i]!==q.answer)recordWrong(store,`test:${t.subject}:${i}`,t.answers[i],'单元测评');});return true;}
function validStore(s){
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
 if(!plain(s)||s.version!==1||!profileIds.includes(s.current)||!plain(s.profiles))return false;
 const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 const test=t=>t&&typeof t.id==='string'&&units[t.subject]&&date(t.startedAt)&&(t.completedAt===null||date(t.completedAt))&&(t.cursor===undefined||(Number.isInteger(t.cursor)&&t.cursor>=0&&t.cursor<units[t.subject].items.length))&&Array.isArray(t.answers)&&t.answers.length===units[t.subject].items.length&&t.answers.every((a,i)=>(a===null&&!t.completedAt)||units[t.subject].items[i].choices.includes(a));
 return profileIds.every(k=>{const p=s.profiles[k];if(!plain(p)||!plain(p.practices)||!Array.isArray(p.practiceCompleted)||!Array.isArray(p.wrongs)||!Array.isArray(p.assessments))return false;
 return Object.entries(p.practices).every(([key,t])=>subjects[key]&&t.subject===key&&typeof t.id==='string'&&[0,1].includes(t.stage)&&typeof t.complete==='boolean'&&[null,'try','correct'].includes(t.feedback)&&(t.selected===null||item(t).choices.includes(t.selected))&&Array.isArray(t.records)&&t.records.length===2&&t.records.every(r=>r&&Number.isInteger(r.attempts)&&r.attempts>=0&&Number.isInteger(r.hints)&&r.hints>=0&&r.hints<=3&&[true,false,null].includes(r.firstCorrect)&&typeof r.solved==='boolean'))&&
 p.practiceCompleted.every(r=>r&&typeof r.id==='string'&&subjects[r.subject]&&date(r.date)&&Array.isArray(r.records)&&r.records.length===2&&r.records.every(x=>x&&typeof x.solved==='boolean'&&[true,false,null].includes(x.firstCorrect)&&Number.isInteger(x.hints)))&&
 p.wrongs.every(r=>{const q=r&&typeof r.qid==='string'&&questionById(r.qid);return q&&typeof r.id==='string'&&(r.chosen===null||q.choices.includes(r.chosen))&&r.expected===q.answer&&date(r.date)&&['练习','单元测评'].includes(r.source)&&(r.correctedAt===null||date(r.correctedAt))&&Array.isArray(r.retries)&&r.retries.every(a=>a&&q.choices.includes(a.chosen)&&date(a.date)&&typeof a.correct==='boolean');})&&p.assessments.every(t=>test(t)&&t.completedAt)&&(p.activeTest===null||test(p.activeTest));});
}
export function loadStore(storage){
 const warning='无法读取完整本地记录，当前仅使用临时档案；原始数据保持不变，请先导出恢复快照。';
 const accepts=value=>{try{return validStore(value);}catch{return false;}};
 const result=(status,store=createStore())=>({store,status,warning:['empty','valid'].includes(status)?'':status==='unreadable'?'无法读取本地记录，当前仅使用临时档案；请恢复浏览器存储访问后重新加载，当前页面不会重新尝试保存。':status==='partial-invalid-loop'?'小步引导记录格式异常，本次未载入该部分；原练习、测评与错题仍保留。当前仅使用临时档案，原始数据保持不变，请先导出恢复快照。':warning});
 let raw;try{raw=storage.getItem(STORE_KEY);}catch{return result('unreadable');}
 if(raw===null)return result('empty');
 let s;try{s=JSON.parse(raw);}catch{return result('invalid-json');}
 if(s&&typeof s==='object'&&Object.hasOwn(s,'version')&&s.version!==1)return result('unknown-version');
 let status='valid';
 if(!accepts(s)){
  // Recover independently valid profiles for inspection/export in memory only.
  const recovered=createStore();
  if(s?.version===1&&s.profiles&&typeof s.profiles==='object'){
   if(profileIds.includes(s.current))recovered.current=s.current;
   for(const key of profileIds){if(!Object.hasOwn(s.profiles,key))continue;const candidate=createStore();candidate.profiles[key]=s.profiles[key];if(accepts(candidate))recovered.profiles[key]=s.profiles[key];}
  }
  s=recovered;status='invalid-schema';
 }
 for(const key of profileIds){const p=s.profiles[key];if(p.learningLoop!==undefined&&!validLoopState(p.learningLoop)){delete p.learningLoop;if(status==='valid')status='partial-invalid-loop';}}
 return result(status,s);
}
export function saveStore(storage,store){try{storage.setItem(STORE_KEY,JSON.stringify(store));return '';}catch{return '本次更改未能保存（浏览器存储不可用或空间不足），刷新后可能丢失。';}}
