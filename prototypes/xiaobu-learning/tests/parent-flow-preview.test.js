import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {startParentFlowPreview} from '../dev/parent-flow-preview.js';
test('parent test harness serves actual app and support projection with no outbound/media/upload access',async()=>{
 const p=await startParentFlowPreview();try{let r=await fetch(p.origin);assert.equal(r.status,200);const html=await r.text();assert.match(html,/仅供家长合成自测/);assert.doesNotMatch(html,/此站点目前仅对你的账号开放/);assert.match(r.headers.get('content-security-policy'),/connect-src 'none'/);assert.match(r.headers.get('permissions-policy'),/microphone=\(\)/);
 for(const name of ['app.js','support-next-step.js','loop-ui.js'])assert.equal((await fetch(p.origin+'/'+name)).status,200);
 for(const path of ['/server/runtime.js','/media/a.mp4','/index.html','/app.js?x=1','/support-next-step.js/'])assert.equal((await fetch(p.origin+path)).status,404);
 assert.equal((await fetch(p.origin,{method:'POST',body:'synthetic'})).status,405);
 const code=await new Promise((resolve,reject)=>{http.get(p.origin,{headers:{host:'evil.invalid'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});assert.equal(code,403);
 }finally{await p.close();}
});
