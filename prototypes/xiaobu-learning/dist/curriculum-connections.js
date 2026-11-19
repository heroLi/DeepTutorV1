// Source metadata only: no textbook pages, student records or external requests.
import {localCatalog} from './curriculum-model.js';
export const shanghaiConnections={
 checked:'2026-11-19',grade:3,term:'第一学期',schoolMatchVerified:false,completeContentsVerified:false,
 supplements:[
  {subject:'语文',title:'五四学制语文练习部分（三/一）',publisher:'人教社',approval:'待审（该目录发布时）',kind:'练习部分，非教科书本体'},
  {subject:'数学',title:'五四学制数学练习部分（三年级上册）',publisher:'沪教育',approval:'SD－XX－2026002',kind:'练习部分，非教科书本体'},
  {subject:'英语',title:'五四学制英语练习部分（三年级上册）',publisher:'沪教育',approval:'SD－XX－2025005',kind:'练习部分，非教科书本体'}
 ].map(row=>({...row,source:localCatalog,year:2026,printedPage:4,pdfPage:1,status:'official-pdf-text-verified'})),
 chineseCityReading:{
  unit:6,subject:'语文',grade:3,term:'上册',title:'香港，璀璨的明珠',lessonType:'略读课文',
  source:'https://xhteacher.sh.cn/cms/app/info/doc/index.php/95535',published:'2026-10-26',
  verification:'徐汇教师网教研报道的网页索引文本；原页打开超时。人教社修订解读也提及该课与单元。',
  limitation:'该报道是上海教师参加的全国示范课记录，不等于本市各校教材统一版本。未确认五四学制、具体印次或用户学校用书。',
  practice:{
   passage:'海栖镇的旧码头成了大家认识海洋的地方。废弃仓库改成了小展馆，来访者可以观察贝壳标本。码头旁还立着潮汐牌，散步的人可以查到涨潮和落潮的时间。',
   task:'先找一句最能概括整段的话，再找两处细节，说说它们怎样支持这句话。',
   hint:'不要只选其中一处设施。找一句能把展馆和潮汐牌都概括进去的话。',
   example:'第一句概括了整段。展馆提供观察海洋生物的机会，潮汐牌介绍海水涨落，两个细节都说明旧码头能帮助大家认识海洋。自己的解释只要对应文中证据即可。'
  }
 },
 lessonObservations:[{
  subject:'语文',school:'青浦实验小学教育集团（御澜湾学校教研）',published:'2026-01-08',activityDate:'2026-01-06',schoolYear:'2025学年第一学期',grade:3,term:'上册',unit:8,
  source:'https://sxjyjt.qpedu.cn/xwzx/twxw/kcjhb/508626.htm',status:'official-school-report-verified',
  sourceTitle:'目标导向，保持教、学、评一致——区小学语文三年级教研活动在御澜湾学校顺利举行',
  titles:['手术台就是阵地'],
  limitation:'原页明确三年级上册第八单元。活动发生在2026年1月，属2025学年第一学期，不能推断2026年秋季版本或用户学校选用；不是完整目录。未核实ISBN、印次或五四学制标注。'
 },{
  subject:'数学',school:'上海市青浦区凤溪小学',published:'2026-09-13',
  source:'https://fxxx.qpedu.cn/bgbs/mzab/521532.htm',status:'official-school-schedule-verified',
  sourceTitle:'第三周工作安排（9月14日—9月20日）',
  titles:['三角形与四边形的初步认识'],
  limitation:'官方工作安排列出9月17日在三4班开展该课例研修。仅核实排期与主题，不证明授课已完成、教材单元号、ISBN或用户学校选用。'
 },{
  subject:'数学',school:'上海市青浦区凤溪小学',published:'2026-11-18',
  source:'https://fxxx.qpedu.cn/hszp/526814.htm',status:'official-school-report-verified',
  sourceTitle:'坐井观天、周长、小雨点——三节课里，学习真实发生',
  titles:['长方形和正方形的周长'],
  limitation:'原校报道明确2026年11月13日执教三年级上册该主题；未注明出版社、教材单元号或ISBN，不能推定用户学校同步进度。'
 },{
  subject:'语文',school:'上海市青浦区绿舟学校',published:'2026-10-02',
  source:'https://lzxx.qpedu.cn/sx/zygq/523091.htm',status:'official-school-page-verified',
  sourceTitle:'2026学年度第一学期三年级各班第六周作业公示',
  titles:['总也倒不了的老屋','犟龟','小狗学叫'],
  limitation:'仅证明该校当期作业出现这些课文；不确定教材 ISBN、印次、单元号或用户学校选用。不是完整目录。'
 }],
 unitCandidates:[{
  subject:'英语',bookLabel:'英语（上海版）',unit:5,title:'I can help',
  source:'https://jxxy.qpedu.cn/xxdt/xxdt/524965.htm',published:'2026-10-28',
  status:'official-institute-page-verified',livePageRetrieved:true,
  originalGovSource:'https://www.shqp.gov.cn/shqp/ggfw/ztfwk/jyu/yx/20261028/1407419.html',originalGovPageRetrieved:false,
  limitation:'青浦区教育学院原页明确三年级第一学期第五单元 I can help。已核实该教研报道中的单元信息；未核实ISBN、主编、完整目录或用户学校选用。报道中的课时设计不冒充教材原始目录。'
 }],
 englishStructure:{
  grade:3,term:'上册',unitCount:10,
  source:'https://xhsyxx.fudan.edu.cn/info/1141/13475.htm',published:'2026-10-12',activity:'2026-09-23',
  summary:'复旦大学附属徐汇实验学校的区级教研报道提到，讲座对照了三年级英语上册的 10 个单元，区分理解性与表达性技能。',
  limitation:'这是教研报道记载的单元总数，不是官方单元目录；不提供十个单元的标题、顺序或学校实际印次。另有八单元资料，未确认与本册相同，不混用。'
 },
 englishRollout:{
  source:'https://jfy.pudong-edu.sh.cn/web/pdjfy/4560004-4560000018624.htm?Page=68',
  published:'2026-09-11',unit:1,keyword:'goal',
  summary:'浦东教发院教研记录称，上海小学三至五年级于 2026 年秋首次全面启用新英语教材；三年级起正式练习写作，并区分理解和表达所需词汇。',
  limitation:'该报道提到三年级第 1 单元核心词 goal，但不提供该单元的正式名称或完整目录，也不证明用户学校的具体版次。',
  practice:{
   passage:'I like art. My goal is to draw a bird. I have a red pencil.',
   question:'先读：找出说目标的句子，区分目标、爱好和已有的东西。',
   readingCheck:'目标是画一只鸟。I like art 说的是爱好；I have a red pencil 说的是已有的东西。',
   writingPrompt:'再写：在纸上替虚构角色写一句目标。可以选 read a book 或 draw a cat，也可以想一个别的动作。',
   frame:'My goal is to ____.',
   example:'My goal is to read a book.',
   writingCheck:'检查 to 后有没有一个清楚的动作，比如 read 或 draw；句首大写，句末有句号。示例不是唯一答案。纸上练习不上传、不自动评分。'
  }
 },
 englishTopicPractice:{
  subject:'英语',topic:'I can help',unit:5,source:'https://jxxy.qpedu.cn/xxdt/xxdt/524965.htm',
  alignment:'按已核实的教研单元主题编写，非教材原题；不证明用户学校同步，不计入三题自测报告。',
  items:[
   {id:'help-original-1',feedbackByChoice:{"Open the book.":"Open the book 表示打开书。短文出现的是 cups（杯子）和 wash（洗），没有打开书的动作。","Draw a cat.":"Draw a cat 表示画一只猫。请回到 I can 后面找实际写出的动作，而不是另选一件能做的事。"},englishText:'Mum has three cups. I can wash the cups.',question:'原创任务：句子中的“我”可以怎样帮忙？',choices:['Wash the cups.','Open the book.','Draw a cat.'],correctChoice:'Wash the cups.',hint:'找 I can 后面的动作，以及动作针对什么物品。',answer:'Wash the cups. 表示洗杯子。依据第二句定位动作，不按常识猜另外的家务。'},
   {id:'help-original-2',feedbackByChoice:{"Close the door.":"Close the door 表示关门。文中掉落的是 pencils，帮助的动作针对铅笔，不是门。","Wash the cups.":"Wash the cups 表示洗杯子，这是另一种家务，但不是这段文字中的帮助。请找 pick up 后面的物品。"},englishText:'Mr Lee drops his pencils. I can pick up the pencils.',question:'原创任务：哪一个行动与句子里的帮助相符？',choices:['Close the door.','Pick up the pencils.','Wash the cups.'],correctChoice:'Pick up the pencils.',hint:'关注 pencils，并找到帮助者对这些物品做的动作。',answer:'Pick up the pencils. 表示把铅笔捡起来。关门和洗杯子都没有在这段文字中出现。'},
   {id:'help-original-3',feedbackByChoice:{"Carry the box.":"能搬箱子的是 Dad。I cannot carry it 的 cannot 表示“不能”，不能把爸爸能做的事当成“我”能做的事。","Wash the box.":"短文有 box，但没有 wash。选项里的物品相同不等于动作相同，请完整核对 I can 后的动作。"},englishText:'Dad can carry the box. I cannot carry it, but I can open the door.',question:'原创进阶任务：句子中的“我”能做哪件事？',choices:['Carry the box.','Open the door.','Wash the box.'],correctChoice:'Open the door.',hint:'分清 Dad 和 I；注意 cannot 表示不能做，不要漏看否定。',answer:'Open the door. 是“我”能做的事。能搬箱子的是 Dad；I cannot carry it 明确说明“我”不能搬它。'},
   {id:'help-original-4',feedbackByChoice:{"Ann helps Ben.":"这个选项把帮助者和受助者调换了。前一句是 Ben 拿袋子，后一句 He 延续指 Ben。","Ann helps Dad.":"短文没有 Dad，也不是 Ann 在帮忙。请先找 takes one bag 的人物，再找 helps 后的人名。"},englishText:'Ann has two bags. Ben takes one bag. He helps Ann carry it.',question:'原创进阶任务：最后一句是谁在帮谁？',choices:['Ann helps Ben.','Ben helps Ann.','Ann helps Dad.'],correctChoice:'Ben helps Ann.',hint:'按前后句寻找 He 指的是谁，再看 helps 后面的人名。',answer:'Ben helps Ann. 前一句的 Ben 拿了一只袋子，后一句 He 接着指 Ben，受到帮助的人是 Ann。'}
  ]
 },
 originalTopicPractice:{
  subject:'数学',topic:'长方形和正方形的周长',source:'https://fxxx.qpedu.cn/hszp/526814.htm',
  alignment:'参考官方学校报道已核实的三年级上册教学主题，不是教材原题或已核验单元同步；不计入上方三题自测报告。',
  items:[
   {id:'perimeter-original-1',feedbackByChoice:{'11厘米':'11厘米只包含一条长与一条宽。沿边走一圈，还要算对面的长边和宽边。','28平方厘米':'平方厘米表示面积。题目求纸带沿边缘一圈的长度，要把四条边相加，单位用厘米。'},choices:['11厘米','22厘米','28平方厘米'],correctChoice:'22厘米',question:'原创任务：一张长方形卡片长7厘米、宽4厘米。沿卡片边缘贴一圈纸带，接头不重叠，需要多长的纸带？',hint:'一圈包括两条长边和两条短边；不要只把一条长与一条宽相加。',answer:'7＋4＋7＋4＝22厘米，也可算（7＋4）×2＝22厘米。这里求边界一圈的长度，不是面积。'},
   {id:'perimeter-original-2',feedbackByChoice:{'12厘米，小林对':'12厘米只算了两条6厘米的边。正方形一圈有四条边，请把剩下两条也算进去。','36平方厘米':'6×6得到的是面积，不是边框一圈的长度。周长需要把四条6厘米的边相加。'},choices:['12厘米，小林对','24厘米，小周对','36平方厘米'],correctChoice:'24厘米，小周对',question:'原创任务：一个正方形纸框每条边长6厘米。小林说周长是12厘米，小周说是24厘米。谁的结果对？请说明数了哪几条边。',hint:'正方形共有四条等长的边，沿边界走一圈要把四条边都算进去。',answer:'小周正确。6×4＝24厘米；12厘米只算了两条边，少算另外两条。'},
   {id:'perimeter-original-3',feedbackByChoice:{'8厘米':'减去两条长后，8厘米是两条宽的总长。两条宽一样长，还需要平均分成两份。','16厘米':'求宽之前先确认一圈有两条长、两条宽。请先从20厘米中减去两条6厘米的长，再计算一条宽。'},choices:['4厘米','8厘米','16厘米'],correctChoice:'4厘米',question:'原创进阶任务：陈阿姨用20厘米纸带围成一个长方形，纸带没有重叠，也没有剩余。长方形长6厘米，宽是多少？',hint:'一圈里有两条6厘米的长边。先减去这两条边，剩下的是两条宽，不是一条宽。',answer:'20－6×2＝8厘米是两条宽的总长；8÷2＝4厘米。检验：6＋4＋6＋4＝20厘米。'},
   {id:'perimeter-original-4',feedbackByChoice:{'第一张周长更长':'第一张的长边更长，但短边更短。只比较一条边不能判断周长，请分别相加四条边。','第二张周长更长':'第二张的宽边更长，但长边更短。请分别计算两张卡片的一圈长度，不比较面积。'},choices:['周长相等，都是20厘米','第一张周长更长','第二张周长更长'],correctChoice:'周长相等，都是20厘米',question:'原创进阶任务：两张长方形卡片，第一张长7厘米、宽3厘米，第二张长6厘米、宽4厘米。只比较边缘一圈的长度，哪种说法正确？',hint:'分别把每张卡片的四条边加起来。不能只比较长边；也不要把长乘宽的结果当周长。',answer:'第一张（7＋3）×2＝20厘米，第二张（6＋4）×2＝20厘米，周长相等。长宽不同的长方形可以有相同的周长；这里不比较面积。'}
  ]
 },
 publisherThemeReference:{
  subject:'语文',title:'2025修订统编三年级上册人文主题参照',
  source:'https://www.pep.com.cn/bks/xxyw/jzjd/202510/W020251016516675066625.pdf',
  article:'学段衔接 能力进阶——三年级上册统编小学语文教材修订要点',author:'柳美彤',publication:'小学语文2025年第9期',
  pdfPage:2,printedPage:19,status:'publisher-pdf-text-and-image-verified',
  fiveFourMatchVerified:false,schoolMatchVerified:false,
  lessonMentions:[{unit:3,title:'犟龟',pdfPage:2},{unit:4,title:'宝葫芦的秘密（节选）',pdfPage:2},{unit:6,title:'香港，璀璨的明珠',pdfPage:2},{unit:8,title:'一定要争气',pdfPage:3}],
  themes:['学校生活','金秋时节','预测与猜想','童话世界','留心观察','祖国山河','珍爱自然','美好品质'],
  limitation:'出版社解读文的人文主题索引，非逐篇课文目录；文章未明确五四学制，不能直接认定与上海五四版本或用户学校完全一致。',
  originalPractice:[
   {question:'原创预测任务：陈阿姨看见窗外乌云越来越低，又听见远处的雷声。她走到门边，拿起一把伞。接下来可能发生什么？请指出一句依据。',hint:'先找天气线索，再把预测与行动联系起来；预测可以不止一种。',answer:'例如：她可能带伞出门，也可能先把伞准备好等雨停。“乌云”“雷声”和“拿起一把伞”是依据。不能断言下一句一定下雨，应继续阅读并修正预测。'},
   {question:'原创预测任务：林叔叔搬来一个纸箱，箱上写着“易碎”。他清空了桌面，又取来一块软布。你预测他会怎样放置箱里的物品？哪条线索支持你？',hint:'把“易碎”与“软布”联系起来，区分文中已说的事实和你推测的行动。',answer:'他可能把物品轻放在软布上。“易碎”和准备软布支持这个预测，但故事没有说明箱里具体是什么，不能把猜测当成事实。'}
  ]
 },
 chineseObservationPractice:{
  subject:'语文',topic:'留心观察',referenceUnit:5,
  source:'https://www.pep.com.cn/bks/xxyw/jzjd/202510/W020251016516675066625.pdf#page=2',
  alignment:'参考出版社三上第5单元人文主题；五四学制对应及用户学校选用未核实。题目完全原创，不计入原三题报告。',
  items:[
   {id:'observe-original-1',feedbackByChoice:{"今天一定会下雨":"乌云、天气预报等信息没有出现在短文中。叶片上的水珠不能直接证明今天一定下雨，请找文字明确写出的变化。","叶片上的水珠全部消失了":"短文写一颗落下，另外两颗还在。请留意“一颗”和“全部”的数量差别。"},text:'原创短文：清晨，赵阿姨看见窗台上的叶片边缘挂着三颗水珠。微风吹来，一颗水珠落进花盆，另外两颗还留在叶片上。',question:'哪一项是短文直接写出的观察结果？',choices:['有一颗水珠落进花盆','今天一定会下雨','叶片上的水珠全部消失了'],correctChoice:'有一颗水珠落进花盆',hint:'把选项逐一和原文比对，注意“一颗”与“全部”的区别；没有天气结论。',answer:'原文明确写一颗水珠落进花盆。今天会不会下雨没有说明，另外两颗水珠仍在叶片上。'},
   {id:'observe-original-2',feedbackByChoice:{"叶子很好看，所以一定很香":"这条记录增加了气味判断。原文只写可看到的颜色和边缘，没有闻气味的记录。","所有叶子的正反面都一样":"短文只观察了一片叶子，而且背面颜色更浅，不能推广成所有叶子的正反面一样。"},text:'原创短文：林叔叔在白纸上放了一片叶子。他发现叶面是深绿色，边缘有细小的锯齿；把叶子翻过来，背面颜色更浅。',question:'哪条记录最具体，而且全部有原文依据？',choices:['叶子很好看，所以一定很香','叶面深绿、边缘有细齿，背面颜色更浅','所有叶子的正反面都一样'],correctChoice:'叶面深绿、边缘有细齿，背面颜色更浅',hint:'优先找颜色、边缘、正反面这些具体可见的细节；不要添加没有观察到的气味或普遍结论。',answer:'第二项准确保留这片叶子的三个观察细节。原文没有说气味，也没有对所有叶子下结论。'}
  ]
 },
 chineseSummaryPractice:{
  subject:'语文',topic:'概括主要内容',source:'https://sxjyjt.qpedu.cn/xwzx/twxw/kcjhb/508626.htm',
  alignment:'只参考2026年1月学校教研记录中的阅读方法，非教材课文改写或原题；不证明2026秋教材同步，不计入原三题报告。',
  items:[
   {id:'summary-original-1',feedbackByChoice:{"陈阿姨准备买一排新书":"原文写的是整理已有的书，并没有买书的计划。概括时不能补入新的事件。","书脊上都有标签":"标签是分类时用到的细节，未概括陈阿姨把乱书整理归位这件主要事情。"},text:'原创短文：周六上午，社区阅览室的一排书被放乱了。管理员陈阿姨先按书脊标签分类，再把书放回对应的书架。半小时后，这排书又整齐了。',question:'哪一项最完整地概括了这段文字的主要内容？',choices:['周六上午，陈阿姨在社区阅览室把放乱的书分类归位','陈阿姨准备买一排新书','书脊上都有标签'],correctChoice:'周六上午，陈阿姨在社区阅览室把放乱的书分类归位',hint:'找出人物、地点和主要事情；一个细节不能代替整件事，也不能补进原文没有的行动。',answer:'第一项概括了谁、在哪里、做了什么。买书没有发生；书脊标签只是整理时使用的细节。'},
   {id:'summary-original-2',feedbackByChoice:{"推车坏了—买一辆新车—新车到了":"后两个环节没有在短文出现。周叔叔做的是取下细绳，结果是原来的推车恢复移动。","门打不开—找来钥匙—门打开了":"门前只是事件发生的位置，不是“门打不开”的问题。请围绕推车、细绳和轮子梳理事件。"},text:'原创短文：傍晚，社区活动室门前的推车轮子卡住了。周叔叔发现一根细绳缠在轮轴上。他取下细绳，试推了两次，推车又能正常移动了。',question:'哪一种“遇到的问题—解决行动—结果”梳理符合短文？',choices:['推车坏了—买一辆新车—新车到了','轮子卡住—取下缠住轮轴的细绳—推车恢复移动','门打不开—找来钥匙—门打开了'],correctChoice:'轮子卡住—取下缠住轮轴的细绳—推车恢复移动',hint:'先找开头的困难，再找人物实际做的动作，最后核对结果。',answer:'第二项保留了事情发展的三个关键点。短文没有买新车，也没有开门的事件。'}
  ]
 },
 readingLinks:[
  {title:'国家中小学智慧教育平台',url:'https://basic.smartedu.cn/'},
  {title:'上海智慧教育平台',url:'https://www.sh.smartedu.cn/'},
  {title:'上海数字教材标准版',url:'https://www.sh-genius.cn/'}
 ]
};

// Fixed synthetic choices only; feedback is not recorded as a score or persisted.
export function checkTopicAnswer(id,choice){
 const item=[...shanghaiConnections.originalTopicPractice.items,...shanghaiConnections.englishTopicPractice.items,...shanghaiConnections.chineseObservationPractice.items,...shanghaiConnections.chineseSummaryPractice.items].find(row=>row.id===id);
 if(!item||!item.choices.includes(choice))return null;
 return {correct:choice===item.correctChoice,text:choice===item.correctChoice
  ?`这次选择正确。${item.answer} 本区仅供成人合成自测，不计入三题报告。`
  :`这次选择不正确。先想一想：${item.feedbackByChoice?.[choice]??item.hint} 可重新选择，或展开原创解析。`};
}
