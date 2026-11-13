import {MAX_BACKUP_BYTES,exportProfileBackup,parseProfileBackup,backupPreview,isEmptyBackupTarget,restoreProfileBackup} from './backup-model.js';
import {STORE_KEY} from './model.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const problem=code=>Object.assign(new Error(code),{code});
const messages={BACKUP_TOO_LARGE:'备份超过 2 MiB 或记录数量上限，操作未完成。不会截断或更改原记录。',INVALID_BACKUP:'文件格式或记录不符合当前备份版本，未恢复任何记录。',INVALID_PROFILE:'当前档案或备份记录无效，未作更改。',TARGET_NOT_EMPTY:'当前档案不是空档案，不能恢复。请切换到空档案；不会覆盖或合并现有记录。',BACKUP_READ_FAILED:'文件未能读取，请重新选择。原记录没有更改。',BACKUP_READ_TIMEOUT:'读取文件超时，请重新选择。原记录没有更改。',BACKUP_SAVE_FAILED:'恢复未能保存，原记录没有更改。请检查浏览器存储空间或权限后重试。',BACKUP_STORE_CHANGED:'本机记录与此页已不一致，已取消恢复。请先核对并保管已有记录，再刷新后重新选择备份。',BACKUP_DOWNLOAD_FAILED:'未能发起下载。原记录仍保留，请换用支持文件下载的浏览器。'};
const message=error=>messages[error?.code]||'操作未完成，原记录没有更改。请重试。';
export function readBackupFile(file,{signal,scope=globalThis}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(problem('BACKUP_READ_FAILED'));return;}
  if(typeof scope.FileReader!=='function'){reject(problem('BACKUP_READ_FAILED'));return;}
  const reader=new scope.FileReader();let done=false;
  const finish=(error,value)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);reader.onload=reader.onerror=reader.onabort=null;error?reject(error):resolve(value);};
  const abort=()=>{finish(problem('BACKUP_READ_FAILED'));try{reader.abort();}catch{}};
  reader.onload=()=>typeof reader.result==='string'?finish(null,reader.result):finish(problem('BACKUP_READ_FAILED'));
  reader.onerror=reader.onabort=()=>finish(problem('BACKUP_READ_FAILED'));
  signal?.addEventListener('abort',abort,{once:true});
  try{reader.readAsText(file,'UTF-8');}catch{finish(problem('BACKUP_READ_FAILED'));}
 });
}
export function downloadBackupFile({text,filename},{scope=globalThis}={}){
 let url,anchor;
 try{
  url=scope.URL.createObjectURL(new scope.Blob([text],{type:'application/json;charset=utf-8'}));
  anchor=scope.document.createElement('a');anchor.href=url;anchor.download=filename;anchor.hidden=true;
  scope.document.body.appendChild(anchor);anchor.click();
 }catch{throw problem('BACKUP_DOWNLOAD_FAILED');}
 finally{anchor?.remove();if(url)setTimeout(()=>scope.URL.revokeObjectURL(url),1000);}
}
// Compare immediately before the single storage write. This is conflict detection,
// not a cross-tab transaction or synchronization protocol.
export function persistBackupRestore(storage,current,next){
 try{
  const raw=storage.getItem(STORE_KEY);
  const matches=raw===null?isEmptyBackupTarget(current,'A')&&isEmptyBackupTarget(current,'B'):JSON.stringify(JSON.parse(raw))===JSON.stringify(current);
  if(!matches)throw problem('BACKUP_STORE_CHANGED');
  storage.setItem(STORE_KEY,JSON.stringify(next));
 }catch(error){if(error?.code==='BACKUP_STORE_CHANGED')throw error;throw problem('BACKUP_SAVE_FAILED');}
}
export function createBackupController({getStore,commitStore,onState=()=>{},onRestored=()=>{},readFile=readBackupFile,download=downloadBackupFile,timeoutMs=5000,notice=''}={}){
 const profileId=getStore().current;let disposed=false,epoch=0,pending=null,aborter=null,timer=null;
 const target=()=>{try{return {empty:isEmptyBackupTarget(getStore(),profileId),invalid:false};}catch{return {empty:false,invalid:true};}};
 let state={phase:'idle',message:notice,preview:null,targetProfileId:profileId,...target()};
 if(state.invalid){state.phase='error';state.message='本机记录不符合当前备份规则，备份与恢复暂不可用；原记录未改动。';}
 const active=()=>!disposed&&getStore().current===profileId;
 const emit=patch=>{if(!active())return;state={...state,...patch,...target()};if(state.invalid){state.phase='error';state.preview=null;state.message='本机记录不符合当前备份规则，备份与恢复暂不可用；原记录未改动。';}onState(Object.freeze({...state}));};
 const stop=()=>{epoch++;if(timer!==null)clearTimeout(timer);timer=null;aborter?.abort();aborter=null;pending=null;};
 return Object.freeze({
  getState:()=>Object.freeze({...state}),
  async choose(file){
   if(!active())return;stop();const token=epoch;
   if(!file){emit({phase:'idle',preview:null,message:''});return;}
   if(!target().empty){emit({phase:'error',preview:null,message:messages.TARGET_NOT_EMPTY});return;}
   if(!Number.isSafeInteger(file.size)||file.size<1){emit({phase:'error',preview:null,message:messages.INVALID_BACKUP});return;}
   if(file.size>MAX_BACKUP_BYTES){emit({phase:'error',preview:null,message:messages.BACKUP_TOO_LARGE});return;}
   aborter=new AbortController();const signal=aborter.signal;emit({phase:'reading',preview:null,message:'正在本机读取文件，不会上传…'});
   try{
    const text=await Promise.race([Promise.resolve().then(()=>readFile(file,{signal})),new Promise((_,reject)=>{signal.addEventListener('abort',()=>reject(problem('BACKUP_READ_FAILED')),{once:true});timer=setTimeout(()=>{reject(problem('BACKUP_READ_TIMEOUT'));aborter?.abort();},timeoutMs);})]);
    if(!active()||token!==epoch)return;
    const backup=parseProfileBackup(text);pending=backup;emit({phase:'preview',preview:backupPreview(backup),message:'文件已检查，尚未恢复。请核对下面的档案和记录数量。'});
   }catch(error){if(active()&&token===epoch)emit({phase:'error',preview:null,message:message(error)});}
   finally{if(token===epoch){clearTimeout(timer);timer=null;aborter=null;}}
  },
  cancel(){if(!active())return;stop();emit({phase:'idle',preview:null,message:'已取消，原记录没有更改。'});},
  invalidate(){if(!active())return;stop();emit({phase:'error',preview:null,message:messages.BACKUP_STORE_CHANGED});},
  confirm(){
   if(!active()||state.phase!=='preview'||!pending)return false;
   const backup=pending;let next;
   try{next=restoreProfileBackup(getStore(),backup,profileId);commitStore(next);}
   catch(error){if(error?.code==='BACKUP_STORE_CHANGED'||error?.code==='TARGET_NOT_EMPTY'){stop();emit({phase:'error',preview:null,message:message(error)});}else emit({phase:'preview',message:message(error)});return false;}
   stop();const text=`已恢复并保存在本浏览器的档案 ${profileId}。另一档案未改动，没有云同步。`;
   emit({phase:'success',preview:null,message:text});onRestored(text);return true;
  },
  exportCurrent(){
   if(!active()||state.phase==='reading')return false;
   try{download(exportProfileBackup(getStore(),profileId));emit({message:'已发起本地下载。请在浏览器下载列表确认文件已保存，并由家长妥善保管。'});return true;}
   catch(error){emit({message:message(error)});return false;}
  },
  dispose(){if(disposed)return;stop();disposed=true;}
 });
}
export function backupMarkup(){return '<section id="backup-panel" class="backup-panel" aria-labelledby="backup-title"></section>';}
export function mountBackup(main,{getStore,commitStore,onRestored,notice='',scope=globalThis,...options}){
 const panel=main.querySelector('#backup-panel');let renderedPhase=null;
 function render(s){
  const focusedAction=scope.document?.activeElement?.dataset?.backupAction;
  const p=s.preview,c=p?.counts;
  panel.innerHTML=`<h2 id="backup-title">家长保管 · 本地备份</h2><p>只导出当前匿名档案，文件含学习记录，请由家长保管。文件选择、检查和恢复都在此浏览器完成，不会上传，也不自动跨设备同步。只检查格式与题目规则，不核验记录的来源或真实性。</p><div class="backup-actions"><button type="button" class="secondary" data-backup-action="export" ${s.phase==='reading'||s.invalid?'disabled':''}>下载档案 ${s.targetProfileId} 的备份</button></div><label class="backup-file-label" for="backup-file">选择本机备份文件（JSON，最多 2 MiB）</label><input id="backup-file" type="file" accept=".json,application/json" aria-describedby="backup-target-note" ${!s.empty?'disabled':''}><p id="backup-target-note" class="muted">恢复目标：本机档案 ${s.targetProfileId}。${s.empty?'当前为空，可以先选择文件并核对。':'当前已有记录，不能恢复到这里。请切换到空档案；不覆盖、不合并。'}</p>${p?`<div class="backup-preview"><h3 id="backup-preview-title" tabindex="-1">恢复前请核对</h3><dl><div><dt>备份来源</dt><dd>匿名档案 ${esc(p.sourceProfileId)}</dd></div><div><dt>文件生成时间</dt><dd>${esc(new Date(p.createdAt).toLocaleString('zh-CN'))}（按本机时区显示，依赖来源设备时钟）</dd></div><div><dt>恢复目标</dt><dd>本机空档案 ${s.targetProfileId}</dd></div><div><dt>当前练习 / 完成小结</dt><dd>${c.practices} / ${c.completedPractices}</dd></div><div><dt>基础错题 / 已交测评</dt><dd>${c.wrongs} / ${c.assessments}</dd></div><div><dt>未交测评</dt><dd>${c.activeTests}</dd></div><div><dt>小步引导 / 复习安排</dt><dd>${c.loopRuns} / ${c.reviews}</dd></div></dl><p>这会复制备份中的进度到空档案 ${s.targetProfileId}，不改另一档案，也不删除原文件。无论来源与目标字母是否相同，请确认是你要保管的那份记录。</p><button type="button" class="primary" data-backup-action="confirm">确认恢复到空档案 ${s.targetProfileId}</button></div>`:''}${s.phase==='reading'||p?'<button type="button" class="text-button" data-backup-action="cancel">取消本次恢复</button>':''}<p id="backup-status" class="backup-status" tabindex="-1" role="status" aria-live="polite" aria-atomic="true">${esc(s.message)}</p><p class="backup-boundary">匿名档案不是账号或家长锁。同一浏览器的使用者都可查看、下载记录。恢复前会检查其他页面的已保存更改，但检查不能锁住其他页面，也不是同步；操作时请关闭其他学习页面。</p>`;
  if(s.phase==='preview'&&renderedPhase!=='preview')panel.querySelector?.('#backup-preview-title')?.focus({preventScroll:false});
  else if(['export','confirm','cancel'].includes(focusedAction))panel.querySelector?.(`[data-backup-action="${focusedAction}"]`)?.focus({preventScroll:true});
  renderedPhase=s.phase;
 }
 const controller=createBackupController({getStore,commitStore,onRestored,notice,readFile:(file,params)=>readBackupFile(file,{...params,scope}),download:backup=>downloadBackupFile(backup,{scope}),...options,onState:render});
 const click=event=>{const b=event.target.closest('button');if(!b||b.disabled)return;const a=b.dataset.backupAction;if(a==='export')controller.exportCurrent();if(a==='cancel')controller.cancel();if(a==='confirm')controller.confirm();};
 const change=event=>{if(event.target.id==='backup-file')controller.choose(event.target.files?.[0]||null);};
 const storage=event=>{if(event.key===STORE_KEY||event.key===null)controller.invalidate();};
 panel.addEventListener('click',click);panel.addEventListener('change',change);scope.addEventListener?.('storage',storage);render(controller.getState());
 return ()=>{controller.dispose();panel.removeEventListener('click',click);panel.removeEventListener('change',change);scope.removeEventListener?.('storage',storage);};
}
