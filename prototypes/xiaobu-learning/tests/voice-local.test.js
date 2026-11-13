import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalVoice} from '../dist/voice-local.js';
function fixture({available='available',voices=[{lang:'zh-CN',localService:true}],localProperty=true,onState}={}){const instances=[],checks=[],spoken=[],timers=new Map(),listeners=new Map(),voiceListeners=new Set();let next=0,cancels=0;class R{constructor(){if(localProperty)this.processLocally=false;instances.push(this);}static async available(opts){checks.push(opts);return available;}start(){this.started=true;}abort(){this.aborted=true;}}
 const synthesis={getVoices:()=>voices,speak:u=>spoken.push(u),cancel(){cancels++;},addEventListener(type,fn){if(type==='voiceschanged')voiceListeners.add(fn);},removeEventListener(type,fn){if(type==='voiceschanged')voiceListeners.delete(fn);}};
 const document={hidden:false,visibilityState:'visible',addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);}};
 const scope={document,SpeechRecognition:R,speechSynthesis:synthesis,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}};const transcripts=[],states=[];const ctl=createLocalVoice({scope,onTranscript:t=>transcripts.push(t),onState:s=>{states.push(s);onState?.(s);},setTimer:(f,ms)=>{timers.set(++next,{f,ms});return next;},clearTimer:id=>timers.delete(id)});
 return {scope,ctl,instances,checks,spoken,timers,transcripts,states,listeners,voiceListeners,cancels:()=>cancels,visibility(hidden,dispatch=true){document.hidden=hidden;document.visibilityState=hidden?'hidden':'visible';if(dispatch)for(const fn of listeners.get('visibilitychange')||[])fn();}};}
test('only available on-device zh-CN can start, with explicit local flags and 20 second cap',async()=>{const f=fixture();await f.ctl.probe();assert.deepEqual(f.checks,[{langs:['zh-CN'],processLocally:true}]);assert.equal(f.ctl.startRecognition(),true);const r=f.instances.at(-1);assert.equal(r.processLocally,true);assert.equal(r.lang,'zh-CN');assert.equal(r.continuous,false);assert.equal(r.interimResults,false);assert.equal(f.ctl.startRecognition(),false);assert.equal([...f.timers.values()][0].ms,20000);r.onresult({results:[{isFinal:true,0:{transcript:'给我一个提示'}}]});assert.deepEqual(f.transcripts,['给我一个提示']);assert.match(f.ctl.getState().notice,/检查或修改/);r.onend();assert.equal(f.ctl.getState().listening,false);assert.equal(f.timers.size,0);});
test('missing APIs, absent local property or language pack never starts or falls back',async()=>{for(const opts of [{available:'downloadable'},{available:'downloading'},{available:'unavailable'},{localProperty:false}]){const f=fixture(opts);await f.ctl.probe();assert.equal(f.ctl.startRecognition(),false);assert.ok(f.instances.every(r=>!r.started));}let legacy=0;const ctl=createLocalVoice({scope:{webkitSpeechRecognition:class{constructor(){legacy++;}}}});await ctl.probe();assert.equal(ctl.startRecognition(),false);assert.equal(legacy,0);});
test('cancel and disposal reject late results, timers and speech callbacks',async()=>{const f=fixture();await f.ctl.probe();f.ctl.startRecognition();const r=f.instances.at(-1),result=r.onresult,end=r.onend,timeout=[...f.timers.values()][0].f;f.ctl.stop();result({results:[{isFinal:true,0:{transcript:'late'}}]});end();timeout();assert.deepEqual(f.transcripts,[]);assert.equal(f.ctl.getState().listening,false);assert.equal(f.timers.size,0);f.ctl.read('固定示例回答');const u=f.spoken[0],done=u.onend;f.ctl.dispose();done();assert.equal(f.ctl.startRecognition(),false);assert.equal(f.ctl.read('late'),false);});
test('timeout aborts capture, errors are safe and neither opens another recognizer',async()=>{const f=fixture();await f.ctl.probe();f.ctl.startRecognition();const r=f.instances.at(-1);[...f.timers.values()][0].f();assert.equal(r.aborted,true);assert.equal(f.ctl.getState().listening,false);assert.match(f.ctl.getState().notice,/20 秒/);f.ctl.startRecognition();f.instances.at(-1).onerror({error:'not-allowed'});assert.match(f.ctl.getState().notice,/未获许可/);assert.equal(f.ctl.getState().listening,false);});
test('only explicitly local Chinese voices can speak; no autoplay and no remote fallback',async()=>{for(const voices of [[{lang:'zh-CN',localService:false}],[{lang:'en-US',localService:true}],[]]){const f=fixture({voices});await f.ctl.probe();assert.equal(f.ctl.read('你好'),false);assert.equal(f.spoken.length,0);}const f=fixture();await f.ctl.probe();assert.equal(f.spoken.length,0);assert.equal(f.ctl.read('检查每份数量'),true);assert.equal(f.spoken[0].voice.localService,true);assert.equal(f.spoken[0].lang,'zh-CN');assert.equal(f.spoken[0].rate,.85);f.spoken[0].onend();assert.equal(f.ctl.getState().reading,false);});
test('pending availability result after disposal cannot update state or enable microphone',async()=>{let release;const f=fixture();f.scope.SpeechRecognition.available=()=>new Promise(r=>release=r);const checking=f.ctl.probe();f.ctl.dispose();const count=f.states.length;release('available');await checking;assert.equal(f.states.length,count);assert.equal(f.ctl.startRecognition(),false);});
test('speech start failure closes recognition and final transcripts are bounded',async()=>{const f=fixture();await f.ctl.probe();f.scope.SpeechRecognition.prototype.start=function(){throw Error('opaque backend detail');};assert.equal(f.ctl.startRecognition(),false);assert.equal(f.ctl.getState().recognition,'unavailable');assert.doesNotMatch(f.ctl.getState().notice,/opaque/);const good=fixture();await good.ctl.probe();good.ctl.startRecognition();good.instances.at(-1).onresult({results:[{isFinal:true,0:{transcript:'字'.repeat(200)}}]});assert.equal(good.transcripts[0].length,160);good.ctl.dispose();});

const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('hung capability probe stops at five seconds, clears its timer and ignores a late available result',async()=>{
 const f=fixture();let release;f.scope.SpeechRecognition.available=()=>new Promise(resolve=>{release=resolve;});
 const pending=f.ctl.probe();assert.equal(f.ctl.getState().recognition,'checking');assert.equal(f.timers.size,1);
 const timer=[...f.timers.values()][0];assert.equal(timer.ms,5000);timer.f();await pending;
 assert.equal(f.ctl.getState().recognition,'unavailable');assert.match(f.ctl.getState().recognitionReason,/5 秒/);assert.equal(f.timers.size,0);assert.equal(f.ctl.startRecognition(),false);
 const count=f.states.length;release('available');await tick();timer.f();await tick();assert.equal(f.states.length,count);assert.equal(f.timers.size,0);assert.ok(f.instances.every(r=>!r.started));f.ctl.dispose();
});
test('reprobe cancels the previous wait immediately and only the latest result can set availability',async()=>{
 const f=fixture(),pending=[];f.scope.SpeechRecognition.available=()=>new Promise((resolve,reject)=>pending.push({resolve,reject}));
 const first=f.ctl.probe(),oldTimer=[...f.timers.values()][0].f;const second=f.ctl.probe();await first;
 assert.equal(f.timers.size,1);oldTimer();pending[0].resolve('available');await tick();assert.equal(f.ctl.getState().recognition,'checking');
 pending[1].resolve('unavailable');await second;assert.equal(f.ctl.getState().recognition,'unavailable');assert.equal(f.timers.size,0);
 const third=f.ctl.probe(),fourth=f.ctl.probe();await third;pending[2].reject(Error('late opaque failure'));pending[3].resolve('available');await fourth;await tick();
 assert.equal(f.ctl.getState().recognition,'available');assert.equal(f.timers.size,0);assert.ok(f.instances.every(r=>!r.started));f.ctl.dispose();
});
test('dispose resolves hung probe without waiting for native availability and removes all listeners',async()=>{
 const f=fixture();let reject;f.scope.SpeechRecognition.available=()=>new Promise((_resolve,r)=>{reject=r;});
 const pending=f.ctl.probe(),oldTimer=[...f.timers.values()][0].f;assert.equal(f.listeners.get('visibilitychange').size,1);assert.equal(f.voiceListeners.size,1);
 f.ctl.dispose();await pending;assert.equal(f.timers.size,0);assert.equal(f.listeners.get('visibilitychange').size,0);assert.equal(f.voiceListeners.size,0);
 const count=f.states.length,instances=f.instances.length;f.ctl.dispose();await f.ctl.probe();oldTimer();reject(Error('late'));await tick();assert.equal(f.states.length,count);assert.equal(f.instances.length,instances);
});
test('probe synchronous error or rejected capability result leaves no timer or microphone start',async()=>{
 for(const asyncFailure of [false,true]){const f=fixture();f.scope.SpeechRecognition.available=()=>{if(asyncFailure)return Promise.reject(Error('private detail'));throw Error('private detail');};await f.ctl.probe();assert.equal(f.timers.size,0);assert.equal(f.ctl.getState().recognition,'unavailable');assert.doesNotMatch(f.ctl.getState().recognitionReason,/private detail/);assert.ok(f.instances.every(r=>!r.started));f.ctl.dispose();}
});
test('background interruption aborts recognition and drops retained results, errors, ends and timeout callbacks',async()=>{
 const f=fixture();await f.ctl.probe();f.ctl.startRecognition();const r=f.instances.at(-1),result=r.onresult,error=r.onerror,end=r.onend,timeout=[...f.timers.values()][0].f;
 f.visibility(true);assert.equal(r.aborted,true);assert.equal(r.onresult,null);assert.equal(f.timers.size,0);assert.equal(f.ctl.getState().listening,false);assert.match(f.ctl.getState().notice,/后台/);
 result({results:[{isFinal:true,0:{transcript:'late hidden'}}]});error({error:'not-allowed'});end();timeout();assert.deepEqual(f.transcripts,[]);assert.equal(f.ctl.startRecognition(),false);assert.equal(f.ctl.read('不应朗读'),false);
 const count=f.instances.length;f.visibility(false);assert.equal(f.instances.length,count);assert.equal(f.ctl.getState().listening,false);assert.equal(f.spoken.length,0);assert.equal(f.ctl.startRecognition(),true);f.ctl.dispose();
});
test('background stops local synthesis, rejects stale callbacks and never resumes speech automatically',async()=>{
 const f=fixture();await f.ctl.probe();assert.equal(f.ctl.read('本机回答'),true);const u=f.spoken[0],end=u.onend,error=u.onerror;
 f.visibility(true);assert.equal(f.cancels(),1);assert.equal(u.onend,null);assert.equal(u.onerror,null);assert.equal(f.ctl.getState().reading,false);
 const count=f.states.length;end();error();assert.equal(f.states.length,count);assert.equal(f.ctl.read('后台禁止'),false);
 f.visibility(false);assert.equal(f.spoken.length,1);assert.equal(f.ctl.getState().reading,false);assert.equal(f.ctl.read('用户再次点击'),true);f.ctl.dispose();
});
test('hidden page blocks fresh capability checks and cancels pending probe; foreground does not restart it',async()=>{
 const f=fixture();f.visibility(true);await f.ctl.probe();assert.equal(f.checks.length,0);assert.equal(f.instances.length,0);assert.equal(f.timers.size,0);assert.equal(f.ctl.read('后台禁止'),false);
 f.visibility(false);let release,calls=0;f.scope.SpeechRecognition.available=()=>{calls++;return new Promise(r=>{release=r;});};const pending=f.ctl.probe();f.visibility(true);await pending;assert.equal(f.timers.size,0);assert.equal(f.ctl.getState().recognition,'unavailable');release('available');await tick();
 f.visibility(false);assert.equal(calls,1);assert.equal(f.ctl.startRecognition(),false);f.scope.SpeechRecognition.available=async()=>{calls++;return 'available';};await f.ctl.probe();assert.equal(f.ctl.getState().recognition,'available');assert.equal(calls,2);f.ctl.dispose();
});
test('visibility guards also refuse new speech without an event, and the twenty-second cap still aborts',async()=>{
 const f=fixture();await f.ctl.probe();f.ctl.startRecognition();const r=f.instances.at(-1),result=r.onresult,timeout=[...f.timers.values()][0].f;
 f.visibility(true,false);result({results:[{isFinal:true,0:{transcript:'hidden'}}]});assert.deepEqual(f.transcripts,[]);assert.equal(f.ctl.read('hidden'),false);assert.equal(f.ctl.startRecognition(),false);timeout();assert.equal(r.aborted,true);assert.equal(f.timers.size,0);f.ctl.dispose();
});
test('reprobe stops active local work and does not start it again',async()=>{
 const f=fixture();await f.ctl.probe();f.ctl.startRecognition();const r=f.instances.at(-1);await f.ctl.probe();assert.equal(r.aborted,true);assert.equal(f.ctl.getState().listening,false);assert.equal(f.timers.size,0);assert.equal(f.ctl.read('旧回答'),true);await f.ctl.probe();assert.equal(f.cancels(),1);assert.equal(f.ctl.getState().reading,false);assert.equal(f.spoken.length,1);f.ctl.dispose();
});

test('stop notification disposing or hiding the page prevents any subsequent recognizer start',async()=>{
 for(const action of ['dispose','hidden']){
  let f,armed=false;f=fixture({onState:s=>{if(armed&&s.notice.startsWith('语音已停止')){armed=false;if(action==='dispose')f.ctl.dispose();else f.visibility(true,false);}}});
  await f.ctl.probe();const instances=f.instances.length;armed=true;
  assert.equal(f.ctl.startRecognition(),false);assert.equal(f.instances.length,instances);assert.ok(f.instances.every(r=>!r.started));assert.equal(f.ctl.getState().listening,false);assert.equal(f.ctl.getState().reading,false);assert.equal(f.timers.size,0);f.ctl.dispose();
 }
});
test('stop notification disposing or hiding blocks synthesis before speak and reprobe before availability',async()=>{
 for(const action of ['dispose','hidden'])for(const operation of ['read','probe']){
  let f,armed=false;f=fixture({onState:s=>{if(armed&&s.notice.startsWith('语音已停止')){armed=false;if(action==='dispose')f.ctl.dispose();else f.visibility(true,false);}}});
  await f.ctl.probe();if(operation==='probe')assert.equal(f.ctl.startRecognition(),true);
  const checks=f.checks.length,instances=f.instances.length;armed=true;
  if(operation==='read')assert.equal(f.ctl.read('不得朗读'),false);else await f.ctl.probe();
  assert.equal(f.spoken.length,0);assert.equal(f.checks.length,checks);assert.equal(f.instances.length,instances);assert.equal(f.ctl.getState().reading,false);assert.equal(f.ctl.getState().listening,false);assert.equal(f.timers.size,0);f.ctl.dispose();
 }
});
test('dispose marks the controller terminal before teardown and does not notify a restart callback',async()=>{
 let f,armed=false,restarts=0;f=fixture({onState:()=>{if(armed){restarts++;f.ctl.startRecognition();f.ctl.read('cannot restart');f.ctl.probe();}}});
 await f.ctl.probe();f.ctl.startRecognition();const r=f.instances.at(-1),instances=f.instances.length;armed=true;f.ctl.dispose();
 assert.equal(restarts,0);assert.equal(r.aborted,true);assert.equal(f.instances.length,instances);assert.equal(f.spoken.length,0);assert.equal(f.timers.size,0);assert.equal(f.ctl.getState().listening,false);assert.equal(f.ctl.getState().reading,false);assert.equal(f.listeners.get('visibilitychange').size,0);
});
test('state notifications cannot reenter new recognition, reading or capability work',async()=>{
 let f,armed=false;const outcomes=[];f=fixture({onState:()=>{if(!armed)return;armed=false;outcomes.push(f.ctl.startRecognition(),f.ctl.read('no auto speech'),f.ctl.probe());}});
 await f.ctl.probe();armed=true;assert.equal(f.ctl.startRecognition(),true);assert.deepEqual(outcomes.slice(0,2),[false,false]);await outcomes[2];assert.equal(f.instances.filter(r=>r.started).length,1);assert.equal(f.checks.length,1);assert.equal(f.spoken.length,0);assert.equal(f.timers.size,1);f.ctl.stop();
 armed=true;await f.ctl.probe();await outcomes.at(-1);assert.equal(f.checks.length,2);assert.equal(f.spoken.length,0);assert.equal(f.timers.size,0);f.ctl.dispose();
});
test('checking or reading notification can dispose safely with no native start or orphan timer',async()=>{
 for(const operation of ['probe','read']){
  let f,armed=false;f=fixture({onState:s=>{if(armed&&((operation==='probe'&&s.recognition==='checking')||(operation==='read'&&s.reading))){armed=false;f.ctl.dispose();}}});
  if(operation==='read')await f.ctl.probe();armed=true;const checks=f.checks.length;
  if(operation==='probe')await f.ctl.probe();else assert.equal(f.ctl.read('不会播放'),false);
  assert.equal(f.checks.length,checks);assert.equal(f.spoken.length,0);assert.ok(f.instances.every(r=>!r.started));assert.equal(f.timers.size,0);assert.equal(f.ctl.getState().listening,false);assert.equal(f.ctl.getState().reading,false);
 }
});
