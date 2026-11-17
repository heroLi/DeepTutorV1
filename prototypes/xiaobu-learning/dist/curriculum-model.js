// Original, finite synthetic samples. Not copied textbook exercises or a verified unit map.
export const source={url:'https://edu.sh.gov.cn/xxgk2_zdgz_jcjy_04/20260810/339e915d906842caaf98736d562df96a.html',title:'上海市教委 2026 年秋季教学用书目录通知',checked:'2026-11-17'};
export const nationalCatalog='https://edu.sh.gov.cn/cmsres/01/01986684fade49c686fcdda5df80cc19/55ec0fda59666ffb41a32c54c646f01b.pdf';
export const localCatalog='https://edu.sh.gov.cn/cmsres/7a/7aed3909441a4c849d5d78b8d914f4fb/00e155989221056fb74efd6f967939f0.pdf';
export const catalog=[
 {id:'chinese',label:'语文',topic:'从原创短文提取信息',book:'五四学制语文·三年级上册｜人民教育出版社；官方书系目录已核验（2024目录/2022课标修订），学校选用及2026印次待核实',questions:[
 {text:'原创短文：雨停了，林阿姨把阳台上的小花盆搬到窗边，让叶子晒到阳光。她把花盆搬到哪里？',choices:['窗边','楼下','门外'],answer:'窗边',hint:'回到“把……搬到……”这句话，找位置。',reason:'短文明说把花盆搬到窗边；不要用生活猜测替代文字证据。'},
 {text:'原创短文：周叔叔先把书分类，再把故事书放到第二层书架。故事书放在哪一层？',choices:['第一层','第二层','第三层'],answer:'第二层',hint:'找“故事书”和它后面的位置。',reason:'原文给出“第二层书架”，这就是回答依据。'}]},
 {id:'math',label:'数学',topic:'两位数乘一位数（原创样题）',book:'五四学制数学·三年级上册｜上海教育出版社；官方书系目录已核验（2024目录/2022课标修订），学校选用及2026印次待核实',questions:[
 {text:'每盒有 24 枚纸书签，3 盒共有多少枚？',choices:['27','62','72'],answer:'72',hint:'把 24 拆成 20 和 4，分别乘 3，再合起来。',reason:'20×3＋4×3＝60＋12＝72（枚）。'},
 {text:'每包有 32 张彩纸，4 包共有多少张？',choices:['36','128','120'],answer:'128',hint:'把 32 拆成 30 和 2，分别乘 4，再合起来。',reason:'30×4＋2×4＝120＋8＝128（张）。'}]},
 {id:'english',label:'英语',topic:'从原创句子辨认物品信息',book:'五四学制英语·三年级上册｜上海教育出版社；官方书系目录已核验（2024目录/2022课标修订），学校选用及2026印次待核实',questions:[
 {text:'原创句子：This is my bag. It is blue. What colour is the bag?',choices:['Blue.','Red.','Green.'],answer:'Blue.',hint:'第二句的 It 指前一句的 bag；找颜色词。',reason:'blue 表示蓝色。这里依据句子找信息，不按图片猜测。'},
 {text:'原创句子：I have a red pen and a green book. What colour is the book?',choices:['Red.','Green.','Blue.'],answer:'Green.',hint:'分别找 pen 和 book 前面的颜色词。',reason:'green 紧接 book，说明书是绿色；red 描述的是笔。'}]}
];
export function createRound(subject){if(!catalog.some(x=>x.id===subject))throw Error('UNKNOWN_SUBJECT');return {subject,index:0,phase:'answer',answers:[],assisted:false};}
export function choose(state,choice){const item=catalog.find(x=>x.id===state.subject)?.questions[state.index];if(!item||state.phase!=='answer'||!item.choices.includes(choice))return false;state.answers.push({index:state.index,choice,correct:choice===item.answer,assisted:state.assisted});state.phase=choice===item.answer?'feedback':'hint';return true;}
export function retry(state){if(state.phase!=='hint')return false;state.assisted=true;state.phase='answer';return true;}
export function next(state){if(state.phase!=='feedback')return false;if(state.index===1)state.phase='complete';else{state.index++;state.assisted=false;state.phase='answer';}return true;}
export function evidence(state){return state.answers.map(x=>({...x}));}
