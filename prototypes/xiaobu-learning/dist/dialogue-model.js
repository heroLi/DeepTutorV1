// Local, finite demonstration. No network, storage, credentials or generated content.
import {loopBank} from './loop-model.js';
export const dialogueIntents=Object.freeze({understand:'我不懂题意',hint:'给我一个提示',check:'怎样检查答案',next:'再解释一步'});
export const MAX_QUESTION_LENGTH=160;
export function dialogueQuestion(id){const m=typeof id==='string'&&/^loop:(math|chinese|english):([0-2])$/.exec(id);return m?{id,subject:m[1],index:Number(m[2]),...loopBank[m[1]].items[Number(m[2])]}:null;}
export function localDialogueTransport({questionId,intent}){
 const q=dialogueQuestion(questionId);if(!q||!Object.hasOwn(dialogueIntents,intent))throw Error('Unsupported example');
 const text=intent==='understand'?q.steps[0].explanation:intent==='hint'?q.steps[0].question:intent==='next'?q.steps[1].explanation:q.explanation;
 const followUp=intent==='check'?'再试一道同类题，看看能否独立完成。':intent==='hint'?'先想一想；需要时再点“再解释一步”。':intent==='next'?'试着用自己的话说说这一步，再点“怎样检查答案”。':q.steps[0].question;
 return {mode:'mock',questionId,intent,text,followUp,answer:intent==='check'?q.answer:null};
}
const aliases={understand:['我不懂题意','这道题什么意思','题目是什么意思','看不懂','不懂题意'],hint:['给我一个提示','提示','给我提示','提示一下'],check:['怎样检查答案','怎么检查','检查答案','检查我的思路','怎样检查我的思路'],next:['再解释一步','下一步','再说一步','继续解释']};
export function classifyDialogueText(value){if(typeof value!=='string'||value.length>MAX_QUESTION_LENGTH)return null;const normalized=value.trim().replace(/[，。！？?!\s]/g,'');return Object.keys(aliases).find(k=>aliases[k].some(s=>s===normalized))||null;}
export function createDialogue(questionId){if(!dialogueQuestion(questionId))throw Error('Unsupported example');return {questionId,messages:[],lastAnswer:'',revision:0};}
export function submitDialogue(state,{text,intent,revision=state.revision}={}){
 if(revision!==state.revision)return {ok:false,reason:'stale'};
 if(typeof text!=='string'||!text.trim()||text.length>MAX_QUESTION_LENGTH)return {ok:false,reason:'length'};
 const resolved=intent===undefined?classifyDialogueText(text):intent;
 if(resolved!==null&&!Object.hasOwn(dialogueIntents,resolved))return {ok:false,reason:'intent'};
 const reply=resolved?localDialogueTransport({questionId:state.questionId,intent:resolved}):{mode:'mock',questionId:state.questionId,intent:null,text:'这个本地示例还不能理解任意提问或判断你的自由解题过程。请点上面的快捷问题，围绕当前题目试一试。',followUp:'DeepSeek 尚未接通；刚才的文字没有发送给服务商。',answer:null};
 state.messages.push({role:'user',text:text.trim()},{role:'assistant',text:reply.text+'\n'+reply.followUp});state.messages=state.messages.slice(-12);state.lastAnswer=reply.text+' '+reply.followUp;state.revision++;return {ok:true,reply};
}
