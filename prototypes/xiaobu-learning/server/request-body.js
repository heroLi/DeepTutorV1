import {fault} from './catalogue.js';
// Bounded reader for incoming HTTP bodies. No parser work continues into service
// execution after a timeout, even if a broken stream later supplies bytes.
export async function readRequestJson(request, {timeoutMs=2000,maxBytes=1024} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000 || maxBytes !== 1024) throw fault('INVALID_CONFIG');
  if (request.signal.aborted) throw fault('CANCELLED');
  const declared=request.headers.get('content-length');
  if (declared!==null && (!/^\d+$/.test(declared) || Number(declared)>maxBytes)) throw fault('RESPONSE_TOO_LARGE');
  if (!request.body?.getReader) throw fault('INVALID_REQUEST');
  const reader=request.body.getReader();let timer,abort;
  const stop=new Promise((_,reject)=>{
    abort=()=>reject(fault('CANCELLED'));
    request.signal.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>reject(fault('BODY_TIMEOUT')),timeoutMs);
  });
  const read=async()=>{
    let total=0;const chunks=[];
    while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes)throw fault('RESPONSE_TOO_LARGE');chunks.push(value);}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fault('INVALID_REQUEST');}
  };
  try{return await Promise.race([read(),stop]);}
  finally{
    clearTimeout(timer);request.signal.removeEventListener('abort',abort);
    // Cancellation itself may hang: never await a hostile stream's cleanup.
    reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{}
  }
}
