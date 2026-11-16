// Loopback-only parent synthetic test harness. No provider, uploads or cloud resources.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=new URL('../dist/',import.meta.url);
const names=['app.js','backup-model.js','backup-ui.js','dialogue-model.js','dialogue-page.js','loop-model.js','loop-ui.js','model.js','parent-summary-ui.js','parent-summary.js','storage-coordinator.js','styles.css','support-next-step.js','video-controls.js','voice-local.js','wrong-notebook.js'];
export async function startParentFlowPreview({port=0}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('INVALID_PORT');let origin;
 const server=http.createServer(async(req,res)=>{
  const headers={'cache-control':'no-store','content-security-policy':"default-src 'self'; connect-src 'none'; script-src 'self'; style-src 'self'; img-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'x-content-type-options':'nosniff','permissions-policy':'microphone=(), camera=(), geolocation=()','referrer-policy':'no-referrer'};
  const send=(code,body,type='text/plain; charset=utf-8')=>{res.writeHead(code,{...headers,'content-type':type});res.end(req.method==='HEAD'?undefined:body);};
  if(req.headers.host!==new URL(origin).host)return send(403,'LOCAL_ONLY');
  if(!['GET','HEAD'].includes(req.method))return send(405,'READ_ONLY');
  if(req.url!=='/'&&!names.map(n=>'/'+n).includes(req.url))return send(404,'NOT_FOUND');
  try{const name=req.url==='/'?'index.html':req.url.slice(1);let data=await readFile(new URL(name,root),'utf8');if(name==='index.html')data=data.replace('<body>','<body><section class="next-support"><strong>仅供家长合成自测，不给儿童使用</strong><p>这里只选择固定示例答案，不输入真实儿童资料。不调用模型、不录音。视频与网络在本测试入口禁用。记录仅保存在此临时地址的浏览器中，不是云备份。</p></section>').replace('此站点目前仅对你的账号开放。电脑和手机需登录同一账号。','此测试服务只绑定本机回环地址，不提供登录或远程访问。');send(200,data,name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');}catch{send(503,'UNAVAILABLE');}
 });
 await new Promise((res,rej)=>{server.once('error',rej);server.listen(port,'127.0.0.1',res);});origin=`http://127.0.0.1:${server.address().port}`;
 return {origin,close:()=>new Promise(res=>{server.closeAllConnections();server.close(res);})};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){const p=await startParentFlowPreview();console.log(p.origin);for(const s of ['SIGINT','SIGTERM'])process.once(s,()=>p.close().finally(()=>process.exit()));}
