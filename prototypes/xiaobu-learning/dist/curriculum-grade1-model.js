// Grade 1 Shanghai upper-term evidence and finite original adult-preview exercises.
import {nationalCatalog,localCatalog} from './curriculum-model.js';

export const grade1 = {
 grade:1, term:'上册', checked:'2026-11-19', completeContentsVerified:false, schoolMatchVerified:false,
 subjects:[
  {id:'chinese',label:'语文',topic:'认一认：天、地、人',book:'统编语文（五四学制）｜人民教育出版社',
   evidence:[
    {title:'教育部国家课程用书目录（上海教委转载，2024）',url:nationalCatalog+'#page=1',scope:'五四学制语文书系覆盖一年级上册；不证明学校印次。'},
    {title:'人民教育出版社：统编语文修订解读',url:'https://www.pep.com.cn/bks/xxyw/jzjd/202510/W020251016523033877268.pdf',scope:'出版社解读确认小学启蒙识字主题“天地人”；只据此做三字练习，不推断整册目录。'}],
   questions:[
    {face:'☁️',prompt:'白云在什么地方？选一个字。',choices:['天','地','人'],answer:'天',hint:'想一想，你要抬头还是低头看？',why:'抬头看见白云，白云在天上。'},
    {face:'👣',prompt:'脚踩着什么？选一个字。',choices:['人','地','天'],answer:'地',hint:'低头看脚下。',why:'脚踩在地上。'},
    {face:'🚶',prompt:'谁在走路？选一个字。',choices:['地','天','人'],answer:'人',hint:'想一想，谁能迈开两条腿走路？',why:'画面是一个人在走路。'}]},
  {id:'math',label:'数学',topic:'算一算：10 以内加减法',book:'五四学制数学｜上海教育出版社',
   evidence:[
    {title:'上海市教委 2026 秋用书附件',url:localCatalog+'#page=3',scope:'列有五四学制数学一年级上册教学参考资料，并非学生书目录。'},
    {title:'徐汇教师网：一年级数学课堂案例',url:'https://tpd.xhedu.sh.cn/cms/app/info/doc/index.php/94757',scope:'教研案例明确提到沪教版一年级 10 以内加减法；未据此填写单元号。'},
    {title:'嘉定区金鹤小学：2026 秋季作业公示',url:'https://jhxx.jdjy.sh.cn/tongzhigonggao/zuoyegongshi/221767.htm',scope:'2026 年 10 月 16 日的一年级口算作业佐证上学期练习 10 以内加法；不是目录，也不证明减法的位置。'}],
   questions:[
    {face:'4 ＋ 3',prompt:'有 4 颗星，又添 3 颗。一共几颗？',choices:['6','7','8'],answer:'7',hint:'从 4 往后数 3 步。',why:'4 加 3 等于 7。'},
    {face:'8 − 2',prompt:'有 8 张贴纸，拿走 2 张。还剩几张？',choices:['5','7','6'],answer:'6',hint:'从 8 往前数 2 步。',why:'8 减 2 等于 6。'},
    {face:'6 ＋ ？ ＝ 10',prompt:'已有 6 片叶子，还差几片才是 10？',choices:['4','3','5'],answer:'4',hint:'从 6 往后数，数到 10 走了几步？',why:'7、8、9、10，一共走 4 步，所以还差 4 片。'}]},
  {id:'english',label:'英语',topic:'说一说：家庭称呼',book:'英语（上海版）一年级上册｜上海教育出版社',
   evidence:[
    {title:'上海市教委 2026 秋用书附件',url:localCatalog+'#page=1',scope:'列有沪教育《英语（一年级上册）》，目录准用号 SD－XS－2024001，不是 ISBN。'},
    {title:'徐汇区东二小学：上海版英语新教材研修',url:'https://d2xx.xhedu.sh.cn/cms/app/info/doc/index.php/32396',scope:'2025 年实录明确定位上海版一年级第一学期 Unit 6 My family；未做整册或当前学校印次核验。'}],
   questions:[
    {face:'mum',prompt:'家长可读一遍。这个词是什么意思？',choices:['爸爸','妈妈','姐姐或妹妹'],answer:'妈妈',hint:'试试把它与“妈妈”的开头声音联系起来。',why:'mum 是妈妈。'},
    {face:'dad',prompt:'家长可读一遍。这个词是什么意思？',choices:['哥哥或弟弟','妈妈','爸爸'],answer:'爸爸',hint:'它不是 mum。想想英语里怎么称呼爸爸。',why:'dad 是爸爸。'},
    {face:'This is my sister.',prompt:'家长可读一遍。米米在介绍谁？',choices:['姐姐或妹妹','哥哥或弟弟','爸爸'],answer:'姐姐或妹妹',hint:'英语里这个词不区分姐姐和妹妹。',why:'sister 是姐姐或妹妹。'}]}
 ]
};

// Optional math extension runs separately from the three within-10 warm-up questions.
export const makeTen = {
 id:'math-make-ten',label:'数学拓展 · 凑十',topic:'20 以内进位加法：8 ＋ 5',
 evidence:{title:'徐汇区位育小学：2026 秋季一年级家长会',url:'https://wyxx.xhedu.sh.cn/cms/app/info/doc/index.php/32470',scope:'学校说明其沪教版一年级上册学习 20 以内进位加法。只核实该校该学期的主题，未核实教材单元编号或其他学校用书。'},
 questions:[
  {face:'8 ＋ 5',frame:{base:8,moved:0,remaining:5},prompt:'十格框已有 8 颗。要填满，还要从这 5 颗里拿几颗？',choices:['2','3','5'],answer:'2',hint:'数一数十格框里有几个空格。',why:'有 2 个空格，拿 2 颗就能凑满 10。'},
  {face:'5 ＝ 2 ＋ ？',frame:{base:8,moved:2,remaining:3},prompt:'把 2 颗移进框里凑成 10。原来的 5 颗还剩几颗在框外？',choices:['2','3','5'],answer:'3',hint:'数一数框外留下来的圆点。',why:'5 拆成 2 和 3。2 颗进了框，框外还剩 3 颗。'},
  {face:'10 ＋ 3',frame:{base:8,moved:2,remaining:3},prompt:'框里 10 颗，框外还有 3 颗。合起来一共几颗？',choices:['10','12','13'],answer:'13',hint:'从 10 接着数 3 步。',why:'8 ＋ 5 就是 8 ＋ 2 ＋ 3，先凑成 10，再加 3，等于 13。'}
 ]
};
export function grade1Pack(id) {
 return id===makeTen.id?makeTen:grade1.subjects.find(s=>s.id===id);
}

export function startGrade1(id) {
 if(!grade1Pack(id)) return null;
 return {id,index:0,phase:'answer',hint:false};
}
export function grade1Step(state,action,value) {
 const pack=grade1Pack(state?.id);
 if(!pack||state.phase==='complete') return state;
 const question=pack.questions[state.index];
 if(!question) return state;
 if(action==='hint'&&state.phase==='answer') return {...state,hint:true};
 if(action==='choose'&&state.phase==='answer'&&question.choices.includes(value))
  return value===question.answer?{...state,phase:'feedback'}:{...state,phase:'retry',hint:true};
 if(action==='retry'&&state.phase==='retry') return {...state,phase:'answer'};
 if(action==='next'&&state.phase==='feedback') return state.index+1===pack.questions.length?
  {...state,phase:'complete'}:{...state,index:state.index+1,phase:'answer',hint:false};
 return state;
}
