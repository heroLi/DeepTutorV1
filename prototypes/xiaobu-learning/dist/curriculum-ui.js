import {catalog,source,nationalCatalog,localCatalog,createRound,choose,retry,next,evidence} from './curriculum-model.js';
const catalogEl=document.querySelector('#catalog'),roundEl=document.querySelector('#round');let state=null;
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
catalogEl.innerHTML=`<h2>版本与来源</h2><p><a href="${source.url}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a> · 核查 ${source.checked}</p><p><a href="${nationalCatalog}" target="_blank" rel="noopener noreferrer">官方教科书书系目录（2024修订）</a> · <a href="${localCatalog}" target="_blank" rel="noopener noreferrer">2026秋上海配套用书附件</a>。附件里的练习部分不是教科书本体。市级目录不等于学校实际选用。具体 ISBN、印次与学校单元进度尚未核实；公开免费阅读不等于允许复制再分发。</p>${catalog.map(s=>`<article class="next-support"><h3>${s.label}</h3><p>${esc(s.book)}</p><p>原创样题主题：${esc(s.topic)}。主题与本册单元映射仍待核对，不宣称完整覆盖三年级。</p><button data-subject="${s.id}">选择${s.label}，开始原创两题自测</button></article>`).join('')}`;
catalogEl.addEventListener('click',e=>{const id=e.target.closest('[data-subject]')?.dataset.subject;if(!id)return;if(state&&state.phase!=='complete'&&!confirm('切换会放弃本轮内存中的合成选择，是否继续？'))return;state=createRound(id);render();roundEl.focus();});
function render(){const s=catalog.find(x=>x.id===state.subject),q=s.questions[state.index];roundEl.innerHTML=`<h2>${s.label} · 原创合成自测</h2>`;
if(state.phase==='complete'){roundEl.innerHTML+=`<h3>本轮证据</h3><ul>${evidence(state).map(a=>`<li>第 ${a.index+1} 题：${esc(a.choice)} · ${a.correct?'正确':'未正确'} · ${a.assisted?'提示后选择':'首次无提示选择'}</li>`).join('')}</ul><p>提示后正确不算独立掌握，第二题也可能已见过。本轮不形成学习能力评分，不自动安排复习。</p><button data-action="restart">再用本组合成题测试</button>`;return;}
roundEl.innerHTML+=`<p>第 ${state.index+1} / 2 题 · ${state.assisted?'已经看过提示':'本轮尚未显示提示'}</p><h3>${esc(q.text)}</h3>`;
if(state.phase==='answer')roundEl.innerHTML+=q.choices.map(c=>`<button data-choice="${esc(c)}">${esc(c)}</button>`).join(' ');
if(state.phase==='hint')roundEl.innerHTML+=`<p>本次未正确。提示：${esc(q.hint)}</p><button data-action="retry">带着提示重试</button>`;
if(state.phase==='feedback')roundEl.innerHTML+=`<p>${esc(q.reason)}</p><button data-action="next">${state.index===0?'继续另一道原创题':'查看本轮证据'}</button>`;
}
roundEl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!state)return;if(b.dataset.choice)choose(state,b.dataset.choice);else if(b.dataset.action==='retry')retry(state);else if(b.dataset.action==='next')next(state);else if(b.dataset.action==='restart')state=createRound(state.subject);render();});
