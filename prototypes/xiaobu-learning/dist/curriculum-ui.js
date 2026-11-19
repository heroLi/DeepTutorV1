import {shanghaiConnections,checkTopicAnswer} from './curriculum-connections.js';
import {catalog,source,nationalCatalog,localCatalog,createRound,choose,retry,next,evidence,roundReport,requestHint,catalogEvidence,reviewItems,roundSummary} from './curriculum-model.js';
const catalogEl=document.querySelector('#catalog'),roundEl=document.querySelector('#round');let state=null;
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep Chinese guidance in the page language; mark only the English sample itself.
const questionMarkup=(text,subject)=>subject==='english'&&text.startsWith('原创句子：')
 ?`原创句子：<span lang="en">${esc(text.slice('原创句子：'.length))}</span>`:esc(text);
catalogEl.innerHTML=`<h2>版本与来源</h2><p><a href="${source.url}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a> · 核查 ${esc(source.checked)}</p><p><a href="${nationalCatalog}" target="_blank" rel="noopener noreferrer">官方教科书书系目录（2024修订）</a> · <a href="${localCatalog}" target="_blank" rel="noopener noreferrer">2026秋上海配套用书附件</a>。附件里的练习部分不是教科书本体。市级目录不等于学校实际选用。具体 ISBN、印次与学校单元进度尚未核实；公开免费阅读不等于允许复制再分发。</p><details><summary>2024 候选书系核验：不要只凭“沪教版”匹配英语</summary><p>以下为历史目录书系，不是 2026 学校实际选用证明，也不代表单元顺序。核验日期：${esc(catalogEvidence.checked)}。${esc(catalogEvidence.verification)}。<a href="${catalogEvidence.originalUrl}" target="_blank" rel="noopener noreferrer">教育部原目录</a>。</p><ul>${catalogEvidence.entries.map(entry=>`<li>${esc(entry.subject)} · ${esc(entry.schoolSystem)} · 主编 ${esc(entry.editors.join('、'))} · ${esc(entry.publisher)} · ${esc(entry.volumeRange)} · <a href="${nationalCatalog}#page=${entry.printedPage}" target="_blank" rel="noopener noreferrer">目录印刷第 ${entry.printedPage} 页</a></li>`).join('')}</ul><p>同出版社的张春柏、施嘉平英语条目延伸至六年级，不能与束定芳五四制小学书系混用。书系范围包含三年级，不等于核验了三年级具体版本或目录。</p></details>${catalog.map(s=>`<article class="next-support"><h3>${esc(s.label)}</h3><p>${esc(s.book)}</p><p>原创样题主题：${esc(s.topic)}。主题与本册单元映射仍待核对，不宣称完整覆盖三年级。</p><button data-subject="${s.id}">选择${esc(s.label)}，开始 ${s.questions.length} 道原创题自测</button></article>`).join('')}`;
const connections=shanghaiConnections;
catalogEl.innerHTML+=`<section class="shanghai-connections" aria-label="上海教材接入清单"><h2>上海三年级 · 已接入的教材证据</h2><p>下面按证据类型展示，不把“有书系”“有练习册”或“某校使用”冒充你的学校完整教材同步。核验日期：${esc(connections.checked)}。</p><h3>2026 秋季三科配套用书</h3>${connections.supplements.map(row=>`<article><h4>${esc(row.subject)} · ${esc(row.title)}</h4><p>${esc(row.publisher)} · ${esc(row.approval)} · ${esc(row.kind)}</p><a href="${row.source}#page=${row.pdfPage}" target="_blank" rel="noopener noreferrer">官方附件 PDF 第 ${row.pdfPage} 页／印刷第 ${row.printedPage} 页</a></article>`).join('')}<h3>已核实的学校课文与教学主题记录</h3>${connections.lessonObservations.map(row=>`<article><p>${esc(row.school)} · ${esc(row.published)}</p><ul>${row.titles.map(title=>`<li>《${esc(title)}》</li>`).join('')}</ul><p>${esc(row.limitation)}</p><a href="${row.source}" target="_blank" rel="noopener noreferrer">${esc(row.sourceTitle)}</a></article>`).join('')}<h3>${esc(connections.publisherThemeReference.title)}</h3><p>${esc(connections.publisherThemeReference.limitation)}</p><ol>${connections.publisherThemeReference.themes.map(theme=>`<li>${esc(theme)}</li>`).join('')}</ol><a href="${connections.publisherThemeReference.source}#page=2" target="_blank" rel="noopener noreferrer">人教社修订解读 PDF 第2页／印刷第19页</a><h4>出版社解读明确提及的课文对应（仅部分）</h4><ul>${connections.publisherThemeReference.lessonMentions.map(item=>`<li>参照第 ${item.unit} 单元：《${esc(item.title)}》 · <a href="${connections.publisherThemeReference.source}#page=${item.pdfPage}" target="_blank" rel="noopener noreferrer">解读 PDF 第 ${item.pdfPage} 页</a></li>`).join('')}</ul><p>这是解读文提及的部分题名，不是整册课文目录，也不证明上海五四版本完全对应。</p><h4>“留心观察”原创任务</h4><p>${esc(connections.chineseObservationPractice.alignment)}</p>${connections.chineseObservationPractice.items.map(item=>`<article class="topic-practice"><p>${esc(item.text)}</p><h4>${esc(item.question)}</h4>${item.choices.map(choice=>`<button data-topic-id="${esc(item.id)}" data-topic-choice="${esc(choice)}">${esc(choice)}</button>`).join(' ')}<p id="feedback-${esc(item.id)}" role="status" aria-live="polite"></p><details><summary>思考提示</summary><p>${esc(item.hint)}</p></details><details><summary>原创解析</summary><p>${esc(item.answer)}</p></details></article>`).join('')}<article class="topic-practice"><h4>语文：用关键句读懂一段话</h4><p>徐汇教研参考：三年级上册第 ${connections.chineseCityReading.unit} 单元略读《${esc(connections.chineseCityReading.title)}》</p><p>${esc(connections.chineseCityReading.verification)}${esc(connections.chineseCityReading.limitation)}</p><a href="${esc(connections.chineseCityReading.source)}" target="_blank" rel="noopener noreferrer">徐汇教师网（${esc(connections.chineseCityReading.published)}）</a><p>下面是虚构小镇的原创短文，不是教材原文或改写，不计入三题报告。</p><p>${esc(connections.chineseCityReading.practice.passage)}</p><p>${esc(connections.chineseCityReading.practice.task)}</p><details><summary>找关键句的提示</summary><p>${esc(connections.chineseCityReading.practice.hint)}</p></details><details><summary>对照原创解析</summary><p>${esc(connections.chineseCityReading.practice.example)}</p></details></article><h4>“概括主要内容”原创任务</h4><p>${esc(connections.chineseSummaryPractice.alignment)}</p><a href="${connections.chineseSummaryPractice.source}" target="_blank" rel="noopener noreferrer">阅读方法依据：2026年1月官方学校教研报道</a>${connections.chineseSummaryPractice.items.map(item=>`<article class="topic-practice"><p>${esc(item.text)}</p><h4>${esc(item.question)}</h4>${item.choices.map(choice=>`<button data-topic-id="${esc(item.id)}" data-topic-choice="${esc(choice)}">${esc(choice)}</button>`).join(' ')}<p id="feedback-${esc(item.id)}" role="status" aria-live="polite"></p><details><summary>思考提示</summary><p>${esc(item.hint)}</p></details><details><summary>原创解析</summary><p>${esc(item.answer)}</p></details></article>`).join('')}<h4>“预测与猜想”原创任务，非教材原文</h4><p>只参考上述主题，不是已核验上海五四单元同步；不计入上方三题自测报告。允许有依据的不同预测。</p>${connections.publisherThemeReference.originalPractice.map(item=>`<article class="topic-practice"><p>${esc(item.question)}</p><details><summary>查看思考提示</summary><p>${esc(item.hint)}</p></details><details><summary>查看原创参考解析</summary><p>${esc(item.answer)}</p></details></article>`).join('')}<h3>英语：已核实的教研单元主题</h3><article><h4>英语三上册：教研报道提到 10 个单元</h4><p>${esc(connections.englishStructure.summary)}</p><p>${esc(connections.englishStructure.limitation)}</p><a href="${esc(connections.englishStructure.source)}" target="_blank" rel="noopener noreferrer">学校教研原文（${esc(connections.englishStructure.published)}）</a></article>${connections.unitCandidates.map(row=>`<article><p>${esc(row.subject)} · 《${esc(row.bookLabel)}》 · 第 ${row.unit} 单元 <span lang="en">${esc(row.title)}</span></p><p>${esc(row.limitation)}</p><a href="${row.source}" target="_blank" rel="noopener noreferrer">查看教育学院官方正文（${esc(row.published)}）</a></article>`).join('')}<article class="topic-practice"><h4>2026 秋英语新教材：读懂目标，再写一句</h4><p>${esc(connections.englishRollout.summary)}</p><p>${esc(connections.englishRollout.limitation)}</p><p><a href="${esc(connections.englishRollout.source)}" target="_blank" rel="noopener noreferrer">浦东教发院原文（${esc(connections.englishRollout.published)}）</a></p><p>以下是成人合成自测用的原创短文与句型，不是教材原文或必学句型，也不计入三题报告。</p><p lang="en">${esc(connections.englishRollout.practice.passage)}</p><p>${esc(connections.englishRollout.practice.question)}</p><details><summary>查看阅读解析</summary><p>${esc(connections.englishRollout.practice.readingCheck)}</p></details><p>${esc(connections.englishRollout.practice.writingPrompt)}</p><p lang="en">${esc(connections.englishRollout.practice.frame)}</p><details><summary>看例句和自查提示</summary><p lang="en">${esc(connections.englishRollout.practice.example)}</p><p>${esc(connections.englishRollout.practice.writingCheck)}</p></details></article><h4>英语帮助主题原创练习</h4><p>${esc(connections.englishTopicPractice.alignment)}</p>${connections.englishTopicPractice.items.map(item=>`<article class="topic-practice"><p lang="en">${esc(item.englishText)}</p><h4>${esc(item.question)}</h4>${item.choices.map(choice=>`<button lang="en" data-topic-id="${esc(item.id)}" data-topic-choice="${esc(choice)}">${esc(choice)}</button>`).join(' ')}<p id="feedback-${esc(item.id)}" role="status" aria-live="polite"></p><details><summary>思考提示</summary><p>${esc(item.hint)}</p></details><details><summary>原创解析</summary><p>${esc(item.answer)}</p></details></article>`).join('')}<h3>按已核实主题接入的原创练习</h3><p>${esc(connections.originalTopicPractice.topic)}。${esc(connections.originalTopicPractice.alignment)}</p><a href="${connections.originalTopicPractice.source}" target="_blank" rel="noopener noreferrer">主题依据：凤溪小学官方三年级上册教学报道</a>${connections.originalTopicPractice.items.map(item=>`<article class="topic-practice"><h4>${esc(item.question)}</h4><p>可先选择，再对照提示与解析；不生成能力分数。</p>${item.choices.map(choice=>`<button data-topic-id="${esc(item.id)}" data-topic-choice="${esc(choice)}">${esc(choice)}</button>`).join(' ')}<p id="feedback-${esc(item.id)}" role="status" aria-live="polite"></p><details><summary>先看思考提示</summary><p>${esc(item.hint)}</p></details><details><summary>查看原创解析</summary><p>${esc(item.answer)}</p></details></article>`).join('')}<h3>官方阅读入口</h3><p>${connections.readingLinks.map(row=>`<a href="${row.url}" target="_blank" rel="noopener noreferrer">${esc(row.title)}</a>`).join(' · ')}</p><p>入口可能需要学校账号或客户端；这里只提供入口，未验证你的访问权限，也不代下载教材。公开阅读不等于允许复制再分发。</p><p>仍缺：三科具体 ISBN、版次、学校选用，以及可核实的完整单元目录。上方原有三题自测不自动绑定以上课文或单元；新增主题练习的对应范围以各自说明为准。</p></section>`;
catalogEl.addEventListener('click',e=>{
 const topic=e.target.closest('[data-topic-choice]');
 if(topic?.dataset.topicChoice){
  const feedback=checkTopicAnswer(topic.dataset.topicId,topic.dataset.topicChoice);
  if(feedback){const status=catalogEl.querySelector(`#feedback-${topic.dataset.topicId}`);if(status)status.textContent=feedback.text;}
  return;
 }
 const id=e.target.closest('[data-subject]')?.dataset.subject;if(!id)return;if(state&&!confirm(state.phase==='complete'?'切换会替换本页的本轮报告。如需保留，请先下载或复制并检查保存结果。已保存的副本不受影响。是否继续？':'切换会放弃本轮内存中的合成选择，是否继续？'))return;state=createRound(id);render();roundEl.focus();});
function render(){const s=catalog.find(x=>x.id===state.subject),q=s.questions[state.index];roundEl.innerHTML=`<h2>${esc(s.label)} · 原创合成自测</h2><p>本轮选项顺序已随机排列，同题重试保持顺序。仍是原来的固定样题，不是新题或能力测评。</p><button data-action="clear">清空本轮合成记录</button>`;
if(state.phase==='complete'){const summary=roundSummary(state);roundEl.innerHTML+=`<h3>本轮证据</h3><p class="round-summary">共 ${summary.total} 道原创题，记录 ${summary.attempts} 次选择。首次无提示答对：${summary.firstCorrect} 题；提示后答对：${summary.assistedCorrect} 题。这里只汇总本轮操作，不是能力评分。</p><ul>${evidence(state).map(a=>`<li>第 ${a.index+1} 题：${esc(a.choice)} · ${a.correct?'正确':'未正确'} · ${a.assisted?'提示后选择':'首次无提示选择'}</li>`).join('')}</ul><p>提示后正确不算独立掌握，后续题也可能已见过。本轮不形成学习能力评分，不自动安排复习。</p><details class="round-review"><summary>回看本轮借助提示完成的题（${reviewItems(state).length} 道）</summary><p>只根据本轮操作整理，不是能力诊断或自动复习计划。</p>${reviewItems(state).length?reviewItems(state).map(item=>`<article><h4>第 ${item.index+1} 题 · ${esc(item.support)}</h4><p>${questionMarkup(item.text,state.subject)}</p><p>思考提示：${esc(item.hint)}</p><p>解释：${esc(item.reason)}</p></article>`).join(''):'<p>本轮没有记录到需要提示的题；不代表已经掌握。</p>'}</details><button data-action="download">下载本轮合成自测报告（TXT）</button><p id="report-status" role="status"></p><details class="report-text"><summary>无法下载？展开报告全文并手动复制</summary><p>这里只读显示同一份合成报告，不请求剪贴板权限，也不会上传。可选中文字后用系统复制命令保存。</p><textarea id="report-text" aria-label="本轮合成自测报告全文（只读）" readonly rows="12">${esc(roundReport(state))}</textarea><button data-action="select-report">选中报告全文</button><p id="selection-status" role="status"></p></details><button data-action="restart">再用本组合成题测试</button>`;return;}
roundEl.innerHTML+=`<p>第 ${state.index+1} / ${s.questions.length} 题 · ${state.assisted?'已经看过提示':'本轮尚未显示提示'}</p><h3>${questionMarkup(q.text,state.subject)}</h3>`;
if(state.phase==='answer'&&state.assisted)roundEl.innerHTML+=`<aside class="retained-hint" aria-label="本题已看过的提示"><p>作答时可继续参考：${esc(q.hint)}</p><p>本题选择仍会记为提示后选择，不作为独立掌握证明。</p></aside>`;
if(state.phase==='answer')roundEl.innerHTML+=state.choiceOrders[state.index].map(c=>`<button${state.subject==='english'?' lang="en"':''} data-choice="${esc(c)}">${esc(c)}</button>`).join(' ')+'<p><button data-action="hint">先看提示</button>（查看后作答会记为提示后选择）</p>';
if(state.phase==='hint')roundEl.innerHTML+=`<p>${state.hintKind==='requested'?'已主动查看提示，不记为答错。':'本次未正确。'}提示：${esc(q.hint)}</p><button data-action="retry">${state.hintKind==='requested'?'带着提示作答':'带着提示重试'}</button>`;
if(state.phase==='feedback')roundEl.innerHTML+=`<p>${esc(q.reason)}</p><button data-action="next">${state.index<s.questions.length-1?'继续下一道原创题':'查看本轮证据'}</button>`;
}
roundEl.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||!state)return;
 if(b.dataset.action==='clear'){
  if(!confirm('清空后本页无法恢复本轮选择和报告；已下载或复制的内容不会被删除。是否清空？'))return;
  state=null;
  roundEl.innerHTML='<h2>本轮合成记录已清空</h2><p>本页不再保留本轮选择与报告。已下载或复制的内容不受影响；可从上方选择学科重新开始。</p>';
  roundEl.focus();return;
 }
 if(b.dataset.action==='download'){downloadReport();return;}
 if(b.dataset.action==='select-report'){selectReport();return;}
 let changed=false;
 if(b.dataset.choice)changed=choose(state,b.dataset.choice);
 else if(b.dataset.action==='hint')changed=requestHint(state);
 else if(b.dataset.action==='retry')changed=retry(state);
 else if(b.dataset.action==='next')changed=next(state);
 else if(b.dataset.action==='restart'&&state.phase==='complete'){if(!confirm('重新开始会替换本页的本轮报告。如需保留，请先下载或复制并检查保存结果。已保存的副本不受影响。是否继续？'))return;state=createRound(state.subject);changed=true;}
 if(!changed)return;
 render();
 // Redraw removes the activated button. Restore a predictable keyboard starting point
 // in the current question region instead of leaving focus on the document body.
 roundEl.focus();
});

function downloadReport(){
 if(state.phase!=='complete')return;
 const status=roundEl.querySelector('#report-status');let url,link;
 try{
  const report=roundReport(state);
  url=URL.createObjectURL(new Blob(['\ufeff',report],{type:'text/plain;charset=utf-8'}));
  link=document.createElement('a');link.href=url;
  link.download=`xiaobu-synthetic-${state.subject}-report.txt`;
  document.body.append(link);link.click();
  if(status)status.textContent='已请求浏览器下载。请检查下载列表；文件仅含本轮合成示例，不是儿童学习记录。';
 }catch{
  if(status)status.textContent='未能发起下载，请保留此页面后重试；本轮记录没有改变。';
 }finally{
  link?.remove();
  if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
}

function selectReport(){
 if(state.phase!=='complete')return;
 const field=roundEl.querySelector('#report-text'),status=roundEl.querySelector('#selection-status');
 if(!field)return;
 try{
  field.focus();field.select();
  if(status)status.textContent='已选中报告全文。请用系统复制命令保存；尚未自动复制到剪贴板。';
 }catch{
  if(status)status.textContent='未能自动选中，请直接在报告文本框中手动选择并复制。';
 }
}
