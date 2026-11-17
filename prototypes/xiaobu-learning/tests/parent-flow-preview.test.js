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

import {parsePreviewArgs} from '../dev/parent-flow-preview.js';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
test('CLI uses stable origin by default and supports explicit temporary isolation',()=>{
 assert.deepEqual(parsePreviewArgs([]),{port:4040});
 assert.deepEqual(parsePreviewArgs(['--port','0']),{port:0});
 assert.deepEqual(parsePreviewArgs(['--port','4041']),{port:4041});
 assert.deepEqual(parsePreviewArgs(['--help']),{help:true});
 for(const args of [['--host','0.0.0.0'],['--port','-1'],['--port','65536'],['--port','1e3'],['--port'],['--port','4040','extra']])assert.throws(()=>parsePreviewArgs(args));
});
test('same selected port is reused on restart; occupied port rejects without fallback',async()=>{
 const a=await startParentFlowPreview();const origin=a.origin,port=Number(new URL(origin).port);
 try{await assert.rejects(startParentFlowPreview({port}),{code:'EADDRINUSE'});}finally{await a.close();}
 const b=await startParentFlowPreview({port});try{assert.equal(b.origin,origin);assert.match(await (await fetch(b.origin)).text(),/更换端口或浏览器不会自动迁移记录/);}finally{await b.close();}
});
const cli=async args=>await new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,['dev/parent-flow-preview.js',...args],{cwd:new URL('../',import.meta.url)});let output='';
 child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);child.on('error',reject);child.on('close',code=>resolve({code,output}));
});
test('CLI help and invalid argument errors terminate safely',async()=>{
 assert.equal((await cli(['--help'])).code,0);
 const r=await cli(['--host','0.0.0.0']);assert.equal(r.code,1);assert.match(r.output,/启动失败/);
});
test('CLI occupied port is clear and does not create a different origin',async()=>{
 const p=await startParentFlowPreview();try{const r=await cli(['--port',new URL(p.origin).port]);assert.equal(r.code,1);assert.match(r.output,/未自动切换地址/);assert.doesNotMatch(r.output,/http:\/\/127/);}finally{await p.close();}
});
test('default developer entry launches integrated parent flow, existing API entry remains explicit',async()=>{
 const p=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(p.scripts.dev,'node dev/parent-flow-preview.js');assert.equal(p.scripts['demo:api'],'node dev/http-demo.js');
});
