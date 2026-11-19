import {grade1,startGrade1,grade1Step} from './curriculum-grade1-model.js';
const picker=document.getElementById('g1-subjects');
const view=document.getElementById('g1-round');
let state=null;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

picker.innerHTML=grade1.subjects.map(s=>`<article class="g1-card">
 <h2>${esc(s.label)}</h2><p>${esc(s.topic)}</p>
 <button type="button" data-start="${esc(s.id)}">练习${esc(s.label)}</button>
 <details><summary>教材来源</summary><p>${esc(s.book)}</p>
 <ul>${s.evidence.map(e=>`<li><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title)}</a>：${esc(e.scope)}</li>`).join('')}</ul>
 </details></article>`).join('');
function render(focus=true){
 if(!state){view.innerHTML='';return;}
 const s=grade1.subjects.find(x=>x.id===state.id);
 if(state.phase==='complete'){
  view.innerHTML=`<h2 tabindex="-1">${esc(s.label)} · 三题做完了</h2><p>这只是试做，不是能力评价。</p>
   <button type="button" data-action="restart">再练一遍</button>
   <button type="button" data-action="close">返回选科</button>`;
 } else {
  const q=s.questions[state.index], question=`<h2 tabindex="-1">${esc(s.label)} · 第 ${state.index+1} 题 / ${s.questions.length}</h2>
  <p class="g1-face"${s.id==='english'?' lang="en"':''}>${esc(q.face)}</p><p class="g1-question">${esc(q.prompt)}</p>`;
  view.innerHTML=question+(state.phase==='answer'?`
   ${state.hint?`<p tabindex="-1" class="g1-message">提示：${esc(q.hint)}</p>`:''}
   <div class="g1-choices">${q.choices.map((choice,i)=>`<button type="button" data-action="choose" data-choice="${i}">${esc(choice)}</button>`).join('')}</div>
   ${state.hint?'':'<button type="button" data-action="hint">看提示</button>'}`:
   state.phase==='retry'?`<p tabindex="-1" class="g1-message">再想想：${esc(q.hint)}</p><button type="button" data-action="retry">再选一次</button>`:
   `<p tabindex="-1" class="g1-message">答对了！${esc(q.why)}</p><button type="button" data-action="next">${state.index+1===s.questions.length?'完成':'下一题'}</button>`);
 }
 if(focus) (view.querySelector('.g1-message')??view.querySelector('h2')).focus();
}
picker.addEventListener('click',event=>{
 const id=event.target.closest('[data-start]')?.dataset.start;
 if(id){state=startGrade1(id);render();}
});
view.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');
 if(!state||!button)return;
 const action=button.dataset.action;
 if(action==='close'){const prior=state.id;state=null;render();picker.querySelector(`[data-start="${prior}"]`)?.focus();return;}
 if(action==='restart'){state=startGrade1(state.id);render();return;}
 const q=grade1.subjects.find(s=>s.id===state.id).questions[state.index];
 const next=grade1Step(state,action,q?.choices[Number(button.dataset.choice)]);
 if(next!==state){state=next;render();}
});
