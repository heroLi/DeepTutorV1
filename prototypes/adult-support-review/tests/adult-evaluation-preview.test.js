import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {startAdultEvaluationPreview,CSP,parsePreviewPort} from '../dev/adult-evaluation-preview.js';
async function fixture(t){const server=await startAdultEvaluationPreview();t.after(()=>server.close());return server;}
test('adult preview serves only its explicit offline assets with isolation headers',async t=>{
 const s=await fixture(t);
 for(const path of ['/','/index.html','/app.js','/model.js','/style.css','/support-app.js','/support-model.js']){
  const r=await fetch(s.origin+path);assert.equal(r.status,200,path);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('content-security-policy'),CSP);assert.equal(r.headers.get('permissions-policy'),'microphone=(), camera=(), geolocation=()');assert.ok((await r.text()).length>0);
 }
 const head=await fetch(s.origin,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
});
test('adult preview cannot serve old learner UI, backend, source secrets or upload endpoints',async t=>{
 const s=await fixture(t);
 for(const path of ['/dist/index.html','/../dist/index.html','/%2e%2e/dist/index.html','/.openai/hosting.json','/server/runtime.js','/package.json','/api/tutor/dialogue','/api/tutor/status','/.env','/index.html?file=../dist/index.html'])assert.equal((await fetch(s.origin+path)).status,404,path);
 for(const method of ['POST','PUT','DELETE'])assert.equal((await fetch(s.origin,{method,body:'synthetic payload'})).status,405);
});
test('adult preview rejects untrusted Host and invalid ports without widening its bind',async t=>{
 const s=await fixture(t),status=await new Promise((resolve,reject)=>{http.get(s.origin,{headers:{host:'attacker.example'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));}).on('error',reject);});assert.equal(status,403);
 for(const port of [-1,65536,1.5,'3000',NaN])await assert.rejects(startAdultEvaluationPreview({port}),/INVALID_PORT/);
});

test('managed preview CLI accepts its exact loopback flags and rejects widening or ambiguity',()=>{
 assert.equal(parsePreviewPort(),3000);
 assert.equal(parsePreviewPort([], '4321'),4321);
 assert.equal(parsePreviewPort(['--host','127.0.0.1','--port','4173','--strictPort'], '3000'),4173);
 for(const args of [['--host','0.0.0.0'],['--host','localhost'],['--port'],['--port','0'],['--port','65536'],['--port','NaN'],['--port','4173','--port','4174'],['--strictPort','--strictPort'],['--https'],['--port=4173']])assert.throws(()=>parsePreviewPort(args));
 for(const value of [null,{},[1]])assert.throws(()=>parsePreviewPort(value));
});
