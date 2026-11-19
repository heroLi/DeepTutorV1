// Original, finite synthetic samples. Not copied textbook exercises or a verified unit map.
export const source={url:'https://edu.sh.gov.cn/xxgk2_zdgz_jcjy_04/20260810/339e915d906842caaf98736d562df96a.html',title:'上海市教委 2026 年秋季教学用书目录通知',checked:'2026-11-17'};
export const nationalCatalog='https://edu.sh.gov.cn/cmsres/01/01986684fade49c686fcdda5df80cc19/55ec0fda59666ffb41a32c54c646f01b.pdf';
export const localCatalog='https://edu.sh.gov.cn/cmsres/7a/7aed3909441a4c849d5d78b8d914f4fb/00e155989221056fb74efd6f967939f0.pdf';
// Historical catalogue evidence, not a current school selection or unit map.
export const catalogEvidence={
 year:2024,checked:'2026-11-19',status:'historical-candidate',
 inspectedUrl:nationalCatalog,
 originalUrl:'https://www.moe.gov.cn/srcsite/A26/s8001/202408/W020240805496325238752.pdf',
 originalAccess:'indexed-text-cross-checked',
 verification:'核对上海教委转载 PDF 与教育部原链接的网页索引文本；对应条目一致，未做文件字节比对',
 schoolAdoptionVerified:false,unitOrderVerified:false,
 entries:[
  {id:'chinese-54',subject:'语文',editors:['温儒敏','王立军'],publisher:'人民教育出版社',schoolSystem:'五四学制',volumeRange:'一年级上册至五年级下册',gradeRange:[1,5],printedPage:1,pdfPageIndex:0},
  {id:'math-54',subject:'数学',editors:['李大潜'],publisher:'上海教育出版社',schoolSystem:'五四学制',volumeRange:'一年级上册至五年级下册',gradeRange:[1,5],printedPage:3,pdfPageIndex:2},
  {id:'english-54',subject:'英语',editors:['束定芳'],publisher:'上海教育出版社',schoolSystem:'五四学制',volumeRange:'三年级上册至五年级下册',gradeRange:[3,5],printedPage:6,pdfPageIndex:5},
  {id:'english-36',subject:'英语',editors:['张春柏','施嘉平'],publisher:'上海教育出版社',schoolSystem:'书名未标五四学制',volumeRange:'三年级上册至六年级下册',gradeRange:[3,6],printedPage:5,pdfPageIndex:4}
 ]
};
export const catalog=[
 {id:'chinese',label:'语文',topic:'从原创短文提取信息',book:'2024 候选书系：五四学制语文｜人民教育出版社，主编温儒敏、王立军；目录范围含三年级；学校选用及2026印次待核实',questions:[
 {text:'原创短文：雨停了，林阿姨把阳台上的小花盆搬到窗边，让叶子晒到阳光。她把花盆搬到哪里？',choices:['窗边','楼下','门外'],answer:'窗边',hint:'回到“把……搬到……”这句话，找位置。',reason:'短文明说把花盆搬到窗边；不要用生活猜测替代文字证据。'},
 {text:'原创短文：周叔叔先把书分类，再把故事书放到第二层书架。故事书放在哪一层？',choices:['第一层','第二层','第三层'],answer:'第二层',hint:'找“故事书”和它后面的位置。',reason:'原文给出“第二层书架”，这就是回答依据。'},
 {text:'原创短文：清晨，陈阿姨带着水壶去菜园。浇完菜，她把空水壶放在木门旁。水壶最后放在哪里？',choices:['菜地里','木门旁','厨房里'],answer:'木门旁',hint:'题目问“最后”，要看浇完菜之后的动作，而不是最初去了哪里。',reason:'原文最后一句说明水壶在木门旁；菜园是她去的地方，不是水壶最后放置的位置。'}]},
 {id:'math',label:'数学',topic:'两位数乘一位数（原创样题）',book:'2024 候选书系：五四学制数学｜上海教育出版社，主编李大潜；目录范围含三年级；学校选用及2026印次待核实',questions:[
 {text:'每盒有 24 枚纸书签，3 盒共有多少枚？',choices:['27','62','72'],answer:'72',hint:'把 24 拆成 20 和 4，分别乘 3，再合起来。',reason:'20×3＋4×3＝60＋12＝72（枚）。'},
 {text:'每包有 32 张彩纸，4 包共有多少张？',choices:['36','128','120'],answer:'128',hint:'把 32 拆成 30 和 2，分别乘 4，再合起来。',reason:'30×4＋2×4＝120＋8＝128（张）。'},
 {text:'每排摆 46 个纸杯，共摆了 3 排，一共有多少个纸杯？',choices:['138','49','123'],answer:'138',hint:'先算 40×3，再算 6×3；合并时别漏掉个位相乘得到的十位。',reason:'40×3＋6×3＝120＋18＝138（个）。46＋3＝49 是把排数当成了另加的纸杯数。'}]},
 {id:'english',label:'英语',topic:'从原创句子辨认物品信息',book:'2024 候选书系：五四学制英语｜上海教育出版社，主编束定芳；目录范围含三年级；学校选用及2026印次待核实',questions:[
 {text:'原创句子：This is my bag. It is blue. What colour is the bag?',choices:['Blue.','Red.','Green.'],answer:'Blue.',hint:'第二句的 It 指前一句的 bag；找颜色词。',reason:'blue 表示蓝色。这里依据句子找信息，不按图片猜测。'},
 {text:'原创句子：I have a red pen and a green book. What colour is the book?',choices:['Red.','Green.','Blue.'],answer:'Green.',hint:'分别找 pen 和 book 前面的颜色词。',reason:'green 紧接 book，说明书是绿色；red 描述的是笔。'},
 {text:'原创句子：My pen is blue. My bag is red. What colour is my pen?',choices:['Red.','Green.','Blue.'],answer:'Blue.',hint:'先确定问题问 pen 还是 bag，再找对应句子的颜色。',reason:'第一句说明 pen is blue。第二句的 red 描述 bag，不能把书包的颜色当作笔的颜色。'}]}
];
// Shuffle once per round, never on retry. This changes positions, not question difficulty.
export function shuffledChoices(choices,random=Math.random){
 const copy=[...choices];
 for(let i=copy.length-1;i>0;i--){
  const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw Error('INVALID_RANDOM');
  const j=Math.floor(value*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];
 }
 return copy;
}
export function createRound(subject,random=Math.random){const entry=catalog.find(x=>x.id===subject);if(!entry)throw Error('UNKNOWN_SUBJECT');return {subject,index:0,phase:'answer',answers:[],assisted:false,choiceOrders:entry.questions.map(q=>shuffledChoices(q.choices,random))};}
export function choose(state,choice){const item=catalog.find(x=>x.id===state.subject)?.questions[state.index];if(!item||state.phase!=='answer'||!item.choices.includes(choice))return false;state.answers.push({index:state.index,choice,correct:choice===item.answer,assisted:state.assisted});state.phase=choice===item.answer?'feedback':'hint';state.hintKind=choice===item.answer?null:'incorrect';return true;}
export function requestHint(state){if(state.phase!=='answer'||!catalog.find(x=>x.id===state.subject)?.questions[state.index])return false;state.assisted=true;state.hintKind='requested';state.phase='hint';return true;}
export function retry(state){if(state.phase!=='hint')return false;state.assisted=true;state.phase='answer';return true;}
export function next(state){if(state.phase!=='feedback')return false;if(state.index===catalog.find(x=>x.id===state.subject).questions.length-1)state.phase='complete';else{state.index++;state.assisted=false;state.hintKind=null;state.phase='answer';}return true;}
export function evidence(state){return state.answers.map(x=>({...x}));}

// Review only observed support needs, without inferring mastery or scheduling practice.
export function reviewItems(state){
 if(state.phase!=='complete')return [];
 const subject=catalog.find(item=>item.id===state.subject);
 if(!subject)return [];
 return subject.questions.flatMap((question,index)=>{
  const rows=state.answers.filter(row=>row.index===index);
  const incorrect=rows.some(row=>!row.correct),assisted=rows.some(row=>row.assisted);
  return incorrect||assisted?[{index,text:question.text,hint:question.hint,reason:question.reason,
   support:incorrect?'本轮曾选错，随后借助提示完成':'主动查看提示后完成，未记录错误选择'}]:[];
 });
}

// Shared observed counts for the completion view and report, never an ability score.
export function roundSummary(state){
 if(state.phase!=='complete')return null;
 const subject=catalog.find(item=>item.id===state.subject);if(!subject)return null;
 const rows=evidence(state);
 return {total:subject.questions.length,attempts:rows.length,
  firstCorrect:subject.questions.filter((_,index)=>{const first=rows.find(row=>row.index===index);return first?.correct&&!first.assisted;}).length,
  assistedCorrect:rows.filter(row=>row.correct&&row.assisted).length};
}

// Export only a completed synthetic round. No identities, storage or network access.
export function roundReport(state){
 if(state.phase!=='complete')throw Error('ROUND_NOT_COMPLETE');
 const subject=catalog.find(item=>item.id===state.subject);
 if(!subject)throw Error('UNKNOWN_SUBJECT');
 const rows=evidence(state);
 const {firstCorrect,assistedCorrect}=roundSummary(state);
 return [
  '小步讲题 · 成人合成自测报告',
  '样题版本：2026-11-17-r2；报告格式：4',
  `学科：${subject.label}；原创题数：${subject.questions.length}`,
  '用途：仅记录本轮固定合成示例的操作，不是儿童学习记录或教学效果证明。',
  `首次无提示答对：${firstCorrect} 题；提示后答对：${assistedCorrect} 题。`,
  '提示后正确不等于独立掌握；重复使用本组题目会影响结果，不能据此评定能力。',
  '',
  ...subject.questions.flatMap((question,index)=>[
   `第 ${index+1} 题：${question.text}`,
   `  本轮选项顺序：${state.choiceOrders[index].map((choice,position)=>`${position+1}. ${choice}`).join(" / ")}`,
   ...rows.filter(row=>row.index===index).map((row,attempt)=>`  第 ${attempt+1} 次选择：${row.choice}；${row.correct?'正确':'未正确'}；${row.assisted?'已看提示':'未看提示'}`),
   `  解释：${question.reason}`,
   ''
  ]),
  '本轮回看：仅列出曾选错或借助提示完成的题，不是能力诊断或自动复习计划。',
  ...(reviewItems(state).length?reviewItems(state).flatMap(item=>[
   `回看第 ${item.index+1} 题：${item.support}`,`  思考提示：${item.hint}`,`  解释：${item.reason}`
  ]):['本轮没有记录到需要提示的题；不代表已经掌握。']),
  '',
  '教材核验边界：仅有书系索引；具体 ISBN、印次、学校选用与完整单元目录仍待核实。',
  '本组为原创样题，不是教材原题或已完成教材单元对齐。',
  `书系说明：${subject.book}`,
  `官方目录通知：${source.url}`,
  `书系目录：${nationalCatalog}`,
  `目录证据年份：${catalogEvidence.year}；核验日期：${catalogEvidence.checked}；仅作历史候选书系，不证明 2026 年学校实际选用。`,
  `核验方式：${catalogEvidence.verification}。`,
  `教育部原链接（已核对索引文本）：${catalogEvidence.originalUrl}`,
  ...catalogEvidence.entries.filter(entry=>entry.subject===subject.label).map(entry=>
   `候选书系对照：${entry.subject}｜${entry.schoolSystem}｜主编${entry.editors.join('、')}｜${entry.publisher}｜${entry.volumeRange}；印刷页码 ${entry.printedPage}（PDF 第 ${entry.pdfPageIndex+1} 页）：${catalogEvidence.inspectedUrl}#page=${entry.pdfPageIndex+1}`
  ),
  `上海配套用书附件：${localCatalog}`,
  '本报告由浏览器本机生成，不上传、不自动保存。刷新仍会清空页面内本轮记录。'
 ].join('\n');
}
