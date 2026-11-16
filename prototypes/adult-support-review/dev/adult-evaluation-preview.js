// Local adult evaluation only. No backend, identity emulation, database or provider.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=new URL('../adult-evaluation/',import.meta.url);
const routes=new Map([['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/model.js','model.js'],['/style.css','style.css'],['/support-app.js','support-app.js'],['/support-model.js','support-model.js']]);
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
export const CSP="default-src 'self'; connect-src 'none'; script-src 'self'; style-src 'self'; img-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export async function startAdultEvaluationPreview({port=0}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('INVALID_PORT');
 let origin;
 const server=http.createServer(async(req,res)=>{
  const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':CSP,'permissions-policy':'microphone=(), camera=(), geolocation=()','connection':'close'};
  const send=(status,text,type='text/plain; charset=utf-8')=>{res.writeHead(status,{...headers,'content-type':type});res.end(req.method==='HEAD'?undefined:text);};
  try{
   const host=new URL(origin).host;
   if(req.headers.host!==host||!req.url?.startsWith('/')||req.url.startsWith('//'))return send(403,'LOCAL_PREVIEW_ONLY');
   if(!['GET','HEAD'].includes(req.method))return send(405,'READ_ONLY_PREVIEW');
   const url=new URL(req.url,origin),file=routes.get(url.pathname);
   if(!file||url.search||url.hash||req.url.includes('%')||req.url.includes('..'))return send(404,'NOT_FOUND');
   const body=await readFile(new URL(file,root));send(200,body,types[file.split('.').at(-1)]);
  }catch{send(503,'PREVIEW_UNAVAILABLE');}
 });
 server.requestTimeout=5000;server.headersTimeout=5000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 origin=`http://127.0.0.1:${server.address().port}`;
 return {origin,close:()=>new Promise((resolve,reject)=>{server.closeAllConnections();server.close(error=>error?reject(error):resolve());})};
}
export function parsePreviewPort(args=[],envPort){
 if(!Array.isArray(args)||args.some(v=>typeof v!=='string'))throw Error('INVALID_ARGUMENT');
 let raw=envPort||'3000';const seen=new Set();
 for(let i=0;i<args.length;i++){
  const key=args[i];if(seen.has(key))throw Error('INVALID_ARGUMENT');seen.add(key);
  if(key==='--strictPort')continue;
  if(key==='--host'){if(args[++i]!=='127.0.0.1')throw Error('LOOPBACK_REQUIRED');continue;}
  if(key==='--port'){raw=args[++i];continue;}
  throw Error('INVALID_ARGUMENT');
 }
 if(typeof raw!=='string'||!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>65535)throw Error('INVALID_PORT');
 return Number(raw);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const port=parsePreviewPort(process.argv.slice(2),process.env.PORT);
 const preview=await startAdultEvaluationPreview({port});console.log(`Adult evaluation local preview: ${preview.origin}`);
 for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>preview.close().finally(()=>process.exit(0)));
}
