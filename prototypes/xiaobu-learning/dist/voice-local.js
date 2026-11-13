// Never use cloud speech recognition or remote synthesis as a fallback.
export function createLocalVoice({scope=globalThis,onState=()=>{},onTranscript=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let disposed=false,epoch=0,recognition=null,utterance=null,timer=null,probeEpoch=0;
 let state={recognition:'checking',recognitionReason:'正在检查本机中文识别能力…',reading:false,listening:false,canRead:false,readReason:'正在检查本机中文声音…',notice:''};
 const emit=patch=>{if(disposed)return;state={...state,...patch};onState({...state});};
 const voice=()=>{try{return scope.speechSynthesis?.getVoices?.().find(v=>v.localService===true&&/^zh(?:-|_)/i.test(v.lang));}catch{return null;}};
 function refreshVoices(){const v=voice();emit({canRead:!!v&&typeof scope.SpeechSynthesisUtterance==='function',readReason:v?'朗读使用设备本地中文声音。':'此浏览器没有可确认的本地中文声音，可直接阅读文字。'});}
 function detachRecognition(){if(timer!==null){clearTimer(timer);timer=null;}if(recognition){recognition.onresult=recognition.onerror=recognition.onend=null;try{recognition.abort();}catch{}recognition=null;}}
 function stop(){epoch++;detachRecognition();if(utterance){utterance.onend=utterance.onerror=null;utterance=null;try{scope.speechSynthesis.cancel();}catch{}}emit({listening:false,reading:false,notice:'语音已停止。未发送录音或转录。'});}
 async function probe(){const ticket=++probeEpoch;refreshVoices();const R=scope.SpeechRecognition;
  if(typeof R!=='function'||typeof R.available!=='function'){emit({recognition:'unavailable',recognitionReason:'此浏览器未提供可确认的设备本地中文识别。请打字或点快捷问题。'});return;}
  try{const check=new R();if(!('processLocally' in check))throw Error('unsupported');check.processLocally=true;if(check.processLocally!==true)throw Error('unsupported');const result=await R.available({langs:['zh-CN'],processLocally:true});if(disposed||ticket!==probeEpoch)return;emit({recognition:result==='available'?'available':'unavailable',recognitionReason:result==='available'?'本机中文识别可用。点击后才申请麦克风许可，最多 20 秒。':'本机中文识别或语言包不可用；不会下载语言包或改用云识别。请打字。'});}catch{if(!disposed&&ticket===probeEpoch)emit({recognition:'unavailable',recognitionReason:'无法确认本机中文识别能力，已关闭语音输入。请打字。'});}
 }
 function startRecognition(){if(disposed||state.recognition!=='available'||state.listening)return false;stop();const current=++epoch;try{const R=scope.SpeechRecognition,r=new R();if(!('processLocally' in r))throw Error('unsupported');r.processLocally=true;if(r.processLocally!==true)throw Error('unsupported');r.lang='zh-CN';r.continuous=false;r.interimResults=false;r.maxAlternatives=1;recognition=r;
   r.onresult=event=>{if(disposed||epoch!==current)return;let text='';for(let i=0;i<(event.results?.length||0);i++){if(event.results[i].isFinal)text+=event.results[i][0]?.transcript||'';}if(text){onTranscript(text.slice(0,160));emit({notice:text.length>160?'转录已截到 160 字，请检查后再点“发送到本地示例”。':'转录仅放入输入框，请检查或修改，再点“发送到本地示例”。'});}};
   r.onerror=event=>{if(disposed||epoch!==current)return;const reason=event.error==='not-allowed'||event.error==='service-not-allowed'?'麦克风未获许可，仍可打字。':event.error==='no-speech'?'没有识别到语音，可以重试或打字。':'本机识别未完成，已停止；不会切换到云识别。';epoch++;detachRecognition();emit({listening:false,notice:reason});};
   r.onend=()=>{if(disposed||epoch!==current)return;epoch++;detachRecognition();emit({listening:false});};
   r.start();if(disposed||epoch!==current)return false;emit({listening:true,notice:'正在本机识别。不会保存录音，也不会自动发送转录。'});timer=setTimer(()=>{if(disposed||epoch!==current)return;epoch++;detachRecognition();emit({listening:false,notice:'已到 20 秒，语音输入停止。请检查输入框，或重新开始。'});},20000);return true;
  }catch{epoch++;detachRecognition();emit({recognition:'unavailable',listening:false,recognitionReason:'本机识别无法启动，已关闭语音输入。请打字。',notice:'未改用云识别。'});return false;}
 }
 function read(text){if(disposed||typeof text!=='string'||!text.trim()||text.length>1000)return false;const v=voice();if(!v||typeof scope.SpeechSynthesisUtterance!=='function'){refreshVoices();return false;}stop();const current=++epoch;try{const u=new scope.SpeechSynthesisUtterance(text);u.voice=v;u.lang=v.lang;u.rate=0.85;utterance=u;u.onend=()=>{if(disposed||epoch!==current)return;utterance=null;emit({reading:false,notice:'朗读结束。'});};u.onerror=()=>{if(disposed||epoch!==current)return;utterance=null;emit({reading:false,notice:'本地朗读未完成。可以直接阅读文字。'});};emit({reading:true,notice:'正在用设备本地中文声音朗读。'});scope.speechSynthesis.speak(u);return true;}catch{utterance=null;emit({reading:false,notice:'本地朗读无法启动。'});return false;}}
 scope.speechSynthesis?.addEventListener?.('voiceschanged',refreshVoices);
 return {probe,startRecognition,read,stop,getState:()=>({...state}),dispose(){stop();disposed=true;probeEpoch++;scope.speechSynthesis?.removeEventListener?.('voiceschanged',refreshVoices);}};
}
