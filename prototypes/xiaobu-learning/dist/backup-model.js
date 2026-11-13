// Local, anonymous single-profile backups. No storage, network, DOM or silent repair.
import {subjects,units,questionById,profileIds} from './model.js';
import {validLoopState} from './loop-model.js';
export const MAX_BACKUP_BYTES=2*1024*1024;
export const BACKUP_MAX_BYTES=MAX_BACKUP_BYTES;
const FORMAT='xiaobu-profile-backup',MAX_NODES=50000,MAX_ARRAY=10000;
const fail=(code='INVALID_BACKUP')=>{throw Object.assign(new Error(code),{code});};
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
const own=(o,k)=>Object.hasOwn(o,k);
const forbidden=k=>['__proto__','prototype','constructor'].includes(k);
const exact=(o,required,optional=[])=>plain(o)&&Reflect.ownKeys(o).every(k=>{const d=Object.getOwnPropertyDescriptor(o,k);return typeof k==='string'&&[...required,...optional].includes(k)&&d&&own(d,'value')&&d.enumerable;})&&required.every(k=>own(o,k));
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const date=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const recordId=s=>typeof s==='string'&&(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)||/^\d{8,16}-[a-z0-9]{1,32}$/.test(s));
const subject=s=>typeof s==='string'&&own(subjects,s);
const unique=rows=>new Set(rows.map(r=>r.id)).size===rows.length;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function safeTree(value){
 let nodes=0,bytes=0;
 function walk(v,depth){
  if(++nodes>MAX_NODES)fail('BACKUP_TOO_LARGE');if(depth>16)fail();
  if(typeof v==='string'){if(v.length>4096)fail();bytes+=new TextEncoder().encode(v).length;if(bytes>MAX_BACKUP_BYTES)fail('BACKUP_TOO_LARGE');return;}
  if(v===null||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)))return;
  if(typeof v!=='object')fail();
  if(Array.isArray(v)){
   if(Object.getPrototypeOf(v)!==Array.prototype)fail();
   if(v.length>MAX_ARRAY)fail('BACKUP_TOO_LARGE');
   if(Reflect.ownKeys(v).length!==v.length+1)fail();
   for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!own(d,'value')||!d.enumerable)fail();walk(d.value,depth+1);}return;
  }
  if(!plain(v))fail();
  for(const k of Reflect.ownKeys(v)){if(typeof k!=='string'||forbidden(k))fail();const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!own(d,'value')||!d.enumerable)fail();bytes+=k.length+4;walk(d.value,depth+1);}
 }
 walk(value,0);
}
// JSON.parse alone silently accepts duplicate keys. This bounded parser rejects them,
// including escaped spellings, before constructing any application object.
function parseJson(text){
 let i=0,nodes=0;const number=/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
 const ws=()=>{while(/[\t\n\r ]/.test(text[i]||'!'))i++;};
 function string(){const start=i++;let escaped=false;for(;i<text.length;i++){const c=text[i];if(c==='"'&&!escaped){i++;return JSON.parse(text.slice(start,i));}if(c==='\\'&&!escaped)escaped=true;else escaped=false;}fail();}
 function value(depth){
  if(++nodes>MAX_NODES)fail('BACKUP_TOO_LARGE');if(depth>16)fail();ws();const c=text[i];
  if(c==='"')return string();
  if(c==='{'){i++;const o={},keys=new Set();ws();if(text[i]==='}'){i++;return o;}while(true){ws();if(text[i]!=='"')fail();const k=string();if(forbidden(k)||keys.has(k))fail();keys.add(k);ws();if(text[i++]!==':')fail();o[k]=value(depth+1);ws();if(text[i]==='}'){i++;return o;}if(text[i++]!==',')fail();}}
  if(c==='['){i++;const a=[];ws();if(text[i]===']'){i++;return a;}while(true){if(a.length>=MAX_ARRAY)fail('BACKUP_TOO_LARGE');a.push(value(depth+1));ws();if(text[i]===']'){i++;return a;}if(text[i++]!==',')fail();}}
  for(const [word,v] of [['true',true],['false',false],['null',null]])if(text.startsWith(word,i)){i+=word.length;return v;}
  number.lastIndex=i;const match=number.exec(text);if(!match)fail();i=number.lastIndex;const n=Number(match[0]);if(!Number.isFinite(n))fail();return n;
 }
 const result=value(0);ws();if(i!==text.length)fail();return result;
}
function validRecord(r){
 return exact(r,['attempts','hints','firstCorrect','solved'])&&integer(r.attempts)&&integer(r.hints)&&r.hints<=3&&[null,true,false].includes(r.firstCorrect)&&typeof r.solved==='boolean'&&
  (r.attempts===0?r.firstCorrect===null&&!r.solved&&r.hints===0:r.firstCorrect!==null)&&
  (r.firstCorrect!==true||(r.attempts===1&&r.solved&&r.hints===0))&&(!r.solved||r.attempts>=(r.firstCorrect?1:2));
}
function validPractice(t,key){
 if(!exact(t,['subject','stage','complete','selected','feedback','records','id'])||!recordId(t.id)||t.subject!==key||![0,1].includes(t.stage)||typeof t.complete!=='boolean'||![null,'try','correct'].includes(t.feedback)||!Array.isArray(t.records)||t.records.length!==2||!t.records.every(validRecord))return false;
 const r=t.records[t.stage],q=subjects[key].items[t.stage];
 return (t.selected===null||q.choices.includes(t.selected))&&(t.stage===0?t.records[1].attempts===0:t.records[0].solved)&&(!t.complete||(t.stage===1&&t.records.every(r=>r.solved)))&&
  (t.feedback!=='try'||(!r.solved&&r.attempts>0))&&(t.feedback!=='correct'||r.solved)&&(!r.solved||(t.feedback==='correct'&&t.selected===q.answer));
}
function validTest(t){
 return exact(t,['id','subject','startedAt','answers','completedAt'],['cursor'])&&recordId(t.id)&&subject(t.subject)&&date(t.startedAt)&&(t.completedAt===null||date(t.completedAt))&&
  (!own(t,'cursor')||(integer(t.cursor)&&t.cursor<4))&&Array.isArray(t.answers)&&t.answers.length===4&&t.answers.every((a,i)=>(a===null&&t.completedAt===null)||units[t.subject].items[i].choices.includes(a));
}
function validWrong(r){
 if(!exact(r,['id','qid','chosen','expected','date','source','correctedAt','retries'])||!recordId(r.id)||typeof r.qid!=='string'||!/^(?:practice:(?:math|chinese|english):[01]|test:(?:math|chinese|english):[0-3])$/.test(r.qid))return false;
 const q=questionById(r.qid);if(!q||r.expected!==q.answer||r.chosen===q.answer||(r.chosen!==null&&!q.choices.includes(r.chosen))||!date(r.date)||r.source!==(r.qid.startsWith('practice:')?'练习':'单元测评')||!Array.isArray(r.retries))return false;
 return r.retries.every(a=>exact(a,['chosen','date','correct'])&&q.choices.includes(a.chosen)&&date(a.date)&&a.correct===(a.chosen===q.answer))&&
  (r.correctedAt===null?!r.retries.some(a=>a.correct):date(r.correctedAt)&&r.retries.some(a=>a.correct));
}
function strictLoop(s){
 if(!exact(s,['version','nextId','runs','reviews'])||!Array.isArray(s.runs)||!plain(s.reviews))return false;
 for(const r of s.runs){
  if(!exact(r,['id','subject','kind','phase','selected','revision','answers','guides','startedAt','completedAt','reviewDue','early','schedule'])||!Array.isArray(r.answers)||!Array.isArray(r.guides))return false;
  if(!r.answers.every(a=>exact(a,['role','choice','correct','at','assisted']))||!r.guides.every(g=>exact(g,['choice','correct','at'])))return false;
  if(r.schedule!==null&&!exact(r.schedule,['due','days','keptDue']))return false;
  if(r.schedule){const last=r.answers.at(-1);if(!last||r.schedule.days!==((last.role!=='retry'&&last.correct)?3:1))return false;}
 }
 if(!Object.values(s.reviews).every(t=>exact(t,['due','sourceId'])))return false;
 if(!validLoopState(s))return false;
 // Review entries must point to that run's actual saved schedule, never invented dates.
 return Object.entries(s.reviews).every(([key,t])=>s.runs.some(r=>r.id===t.sourceId&&r.subject===key&&r.schedule?.due===t.due));
}
function validProfile(p){
 if(!exact(p,['practices','practiceCompleted','wrongs','assessments','activeTest'],['learningLoop'])||!plain(p.practices)||!Array.isArray(p.practiceCompleted)||!Array.isArray(p.wrongs)||!Array.isArray(p.assessments))return false;
 if(!Object.entries(p.practices).every(([key,t])=>subject(key)&&validPractice(t,key)))return false;
 if(!p.practiceCompleted.every(r=>exact(r,['id','subject','date','records'])&&recordId(r.id)&&subject(r.subject)&&date(r.date)&&Array.isArray(r.records)&&r.records.length===2&&r.records.every(x=>validRecord(x)&&x.solved))||!unique(p.practiceCompleted))return false;
 if(!p.wrongs.every(validWrong)||!unique(p.wrongs)||!p.assessments.every(t=>validTest(t)&&t.completedAt!==null)||!unique(p.assessments))return false;
 if(p.activeTest!==null&&(!validTest(p.activeTest)||(p.activeTest.completedAt!==null&&!p.assessments.some(t=>equal(t,p.activeTest)))))return false;
 if(p.activeTest?.completedAt===null&&p.assessments.some(t=>t.id===p.activeTest.id))return false;
 return !own(p,'learningLoop')||strictLoop(p.learningLoop);
}
function checkedStore(store){
 if(!exact(store,['version','current','profiles'])||store.version!==1||!profileIds.includes(store.current)||!exact(store.profiles,['A','B']))fail();for(const key of profileIds){safeTree(store.profiles[key]);if(!validProfile(store.profiles[key]))fail();}return store;
}
const checkedId=id=>{if(!profileIds.includes(id))fail('INVALID_PROFILE');return id;};
function checkedBackup(backup){safeTree(backup);if(!exact(backup,['format','version','sourceProfileId','createdAt','profile'])||backup.format!==FORMAT||backup.version!==1||!profileIds.includes(backup.sourceProfileId)||!date(backup.createdAt)||!validProfile(backup.profile))fail();return backup;}
const freeze=o=>{if(o&&typeof o==='object'){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;};
const clone=o=>JSON.parse(JSON.stringify(o));
export function backupPreview(backup){checkedBackup(backup);const p=backup.profile;return freeze({sourceProfileId:backup.sourceProfileId,createdAt:backup.createdAt,counts:{practices:Object.keys(p.practices).length,completedPractices:p.practiceCompleted.length,wrongs:p.wrongs.length,assessments:p.assessments.length,activeTests:p.activeTest&&!p.activeTest.completedAt?1:0,loopRuns:p.learningLoop?.runs.length||0,reviews:Object.keys(p.learningLoop?.reviews||{}).length}});}
export function exportProfileBackup(store,profileId,{createdAt=new Date().toISOString()}={}){
 checkedId(profileId);checkedStore(store);const backup={format:FORMAT,version:1,sourceProfileId:profileId,createdAt,profile:clone(store.profiles[profileId])};checkedBackup(backup);const text=JSON.stringify(backup,null,2);if(new TextEncoder().encode(text).length>MAX_BACKUP_BYTES)fail('BACKUP_TOO_LARGE');return {text,filename:`xiaobu-profile-${profileId}-${createdAt.slice(0,10)}.json`,preview:backupPreview(backup)};
}
export function parseProfileBackup(text){
 if(typeof text!=='string')fail();if(text.length>MAX_BACKUP_BYTES||new TextEncoder().encode(text).length>MAX_BACKUP_BYTES)fail('BACKUP_TOO_LARGE');
 try{return freeze(checkedBackup(parseJson(text)));}catch(error){if(error?.code)throw error;fail();}
}
export function isEmptyBackupTarget(store,targetId){checkedId(targetId);checkedStore(store);const p=store.profiles[targetId];return !Object.keys(p.practices).length&&!p.practiceCompleted.length&&!p.wrongs.length&&!p.assessments.length&&p.activeTest===null&&(!p.learningLoop||(!p.learningLoop.runs.length&&!Object.keys(p.learningLoop.reviews).length));}
export function restoreProfileBackup(store,backup,targetId){checkedId(targetId);checkedBackup(backup);if(!isEmptyBackupTarget(store,targetId))fail('TARGET_NOT_EMPTY');const next=clone(store);next.profiles[targetId]=clone(backup.profile);return next;}
