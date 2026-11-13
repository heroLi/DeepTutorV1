// Integration candidate only: a bounded single-file adapter, not a file proxy.
// Not served by the current static Site. See docs/WORKER_MIGRATION.md for binding requirements.
export const MEDIA_PATH='/media/average-sharing.mp4';
const SIZE=1663403;
const HASH='f7ad7412302d604309b0e00adb35d5689eda0a8f548f292263f76c56e2232acf';
const cancelBody=body=>{try{Promise.resolve(body?.cancel()).catch(()=>{});}catch{}};
async function readAsset(assets,request){
 const controller=new AbortController();let timer,abort,reader,closed=false;
 const check=()=>{if(closed||request.signal.aborted||controller.signal.aborted)throw Error('CANCELLED');};
 const stop=new Promise((_,reject)=>{abort=()=>{closed=true;controller.abort();reject(Error('CANCELLED'));};request.signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>{closed=true;controller.abort();reject(Error('TIMEOUT'));},2000);});
 try{
  check();
  return await Promise.race([(async()=>{
   const source=await assets.fetch(new Request(new URL(MEDIA_PATH,request.url),{method:'GET',signal:controller.signal}));
   try{check();}catch(error){cancelBody(source?.body);throw error;}
   const length=source.headers.get('content-length');
   if(source.status!==200||!source.body||(length!==null&&(!/^\d+$/.test(length)||Number(length)!==SIZE))){cancelBody(source.body);throw Error('ASSET_UNAVAILABLE');}
   reader=source.body.getReader();const bytes=new Uint8Array(SIZE);let offset=0;
   while(true){check();const {value,done}=await reader.read();check();if(done)break;if(offset+value.byteLength>SIZE)throw Error('ASSET_SIZE');bytes.set(value,offset);offset+=value.byteLength;}
   if(offset!==SIZE)throw Error('ASSET_SIZE');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');check();if(hash!==HASH)throw Error('ASSET_HASH');
   return bytes.buffer;
  })(),stop]);
 }finally{closed=true;clearTimeout(timer);request.signal.removeEventListener('abort',abort);controller.abort();if(reader){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}try{reader.releaseLock();}catch{}}}
}
export async function learningMedia(request,assets){
 if(new URL(request.url).pathname!==MEDIA_PATH)return new Response(null,{status:404});
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{allow:'GET, HEAD','cache-control':'no-store'}});
 for(const name of ['range','if-range','if-none-match'])if((request.headers.get(name)||'').length>512)return new Response(null,{status:431,headers:{'cache-control':'no-store'}});
 if(!assets?.fetch)return new Response(null,{status:503,headers:{'cache-control':'no-store'}});
 // Fetch only the packaged, fixed asset. Never forward user auth, cookies or ranges.
 let bytes;try{bytes=await readAsset(assets,request);}catch{return new Response(null,{status:503,headers:{'cache-control':'no-store'}});}
 const headers=new Headers({'content-type':'video/mp4','content-length':String(SIZE),'accept-ranges':'bytes','cache-control':'private, no-store','x-content-type-options':'nosniff'});
 const etag=`"sha256-${HASH}"`;headers.set('etag',etag);
 const noneMatch=request.headers.get('if-none-match');
 if(noneMatch&&(noneMatch.trim()==='*'||noneMatch.split(',').some(value=>value.trim().replace(/^W\//,'')===etag))){headers.delete('content-length');return new Response(null,{status:304,headers});}
 if(request.method==='HEAD')return new Response(null,{headers});
 const range=request.headers.get('range'),ifRange=request.headers.get('if-range');
 if(!range||(ifRange&&ifRange!==etag))return new Response(bytes,{headers});
 if(!/^bytes=/i.test(range)||range.includes(','))return new Response(bytes,{headers});
 const match=/^bytes=(\d*)-(\d*)$/i.exec(range);let start,end;
 if(match&&(match[1]||match[2])){
  if(!match[1]){const suffix=Number(match[2]);if(Number.isSafeInteger(suffix)&&suffix>0){start=Math.max(0,SIZE-suffix);end=SIZE-1;}}
  else{start=Number(match[1]);end=match[2]?Number(match[2]):SIZE-1;}
 }
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=SIZE||end<start){headers.set('content-range',`bytes */${SIZE}`);headers.set('content-length','0');return new Response(null,{status:416,headers});}
 end=Math.min(end,SIZE-1);headers.set('content-range',`bytes ${start}-${end}/${SIZE}`);headers.set('content-length',String(end-start+1));
 return new Response(bytes.slice(start,end+1),{status:206,headers});
}
