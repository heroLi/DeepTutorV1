import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {learningMedia,MEDIA_PATH} from '../server/learning-media.js';
const bytes=await readFile(new URL('../dist/media/average-sharing.mp4',import.meta.url));
const request=(headers={},patch={})=>new Request('https://fixture.test'+MEDIA_PATH,{headers,...patch});
const assets={fetch:async r=>{assert.equal(new URL(r.url).pathname,MEDIA_PATH);assert.equal(r.method,'GET');assert.equal(r.headers.has('cookie'),false);assert.equal(r.headers.has('authorization'),false);assert.equal(r.headers.has('range'),false);return new Response(bytes,{headers:{'content-length':String(bytes.length)}});}};
test('fixed file byte identity, HEAD, range and strong If-Range contract',async()=>{
 const whole=await learningMedia(request({cookie:'ignored',authorization:'ignored'}),assets);assert.equal(whole.status,200);assert.equal(whole.headers.get('cache-control'),'private, no-store');const etag=whole.headers.get('etag');assert.match(etag,/^"sha256-/);assert.deepEqual(Buffer.from(await whole.arrayBuffer()),bytes);
 for(const [range,expected] of [['bytes=0-3',bytes.subarray(0,4)],['bytes=-4',bytes.subarray(-4)],['bytes=100-103',bytes.subarray(100,104)]]){const r=await learningMedia(request({range,'if-range':etag}),assets);assert.equal(r.status,206);assert.deepEqual(Buffer.from(await r.arrayBuffer()),expected);}
 for(const ifRange of ['"old-version"','W/'+etag,'Wed, 21 Oct 2015 07:28:00 GMT']){const r=await learningMedia(request({range:'bytes=0-3','if-range':ifRange}),assets);assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);}
 for(const method of ['GET','HEAD']){const cached=await learningMedia(request({'if-none-match':'W/'+etag,range:'bytes=99999999-'},{method}),assets);assert.equal(cached.status,304);assert.equal(cached.headers.has('content-range'),false);assert.equal(cached.headers.has('content-length'),false);assert.equal((await cached.arrayBuffer()).byteLength,0);}
 const head=await learningMedia(request({range:'bytes=0-3'},{method:'HEAD'}),assets);assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(bytes.length));assert.equal((await head.arrayBuffer()).byteLength,0);
});
test('invalid/multipart/unsatisfiable ranges fail without widening paths',async()=>{
 for(const range of ['bytes=-0','bytes=','bytes=4-3','bytes=1663403-','bytes=9999999999999999999999-']){const r=await learningMedia(request({range}),assets);assert.equal(r.status,416);assert.equal(r.headers.get('content-range'),`bytes */${bytes.length}`);assert.equal((await r.arrayBuffer()).byteLength,0);}
 for(const range of ['items=0-3','bytes=0-1,4-5']){const r=await learningMedia(request({range}),assets);assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);}
 assert.equal((await learningMedia(request({range:'BYTES=0-3'}),assets)).status,206);
 let called=false;const forbidden={fetch:()=>{called=true;throw Error('must not fetch');}};
 assert.equal((await learningMedia(new Request('https://fixture.test/other.mp4'),forbidden)).status,404);assert.equal((await learningMedia(request({}, {method:'POST'}),forbidden)).status,405);assert.equal(called,false);for(const name of ['range','if-range','if-none-match'])assert.equal((await learningMedia(request({[name]:'x'.repeat(513)}),forbidden)).status,431);assert.equal(called,false);
});
test('missing, oversized, truncated, corrupted or failed assets return safe no-store 503',async()=>{
 const bad=[undefined,{fetch:async()=>new Response('secret error',{status:500})},{fetch:async()=>new Response(new Uint8Array(bytes.length+1))},{fetch:async()=>new Response(bytes.subarray(0,10))},{fetch:async()=>new Response(new Uint8Array(bytes.length))},{fetch:async()=>{throw Error('private diagnostic');}},{fetch:async()=>new Response(new ReadableStream({start(c){c.error(Error('broken'));}}))}];
 for(const binding of bad){const r=await learningMedia(request(),binding);assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(await r.text(),'');}
});
test('pre-cancel and active cancellation never return success; late/hung asset result is bounded',async()=>{
 const pre=new AbortController();pre.abort();let called=0;assert.equal((await learningMedia(request({}, {signal:pre.signal}),{fetch:async()=>{called++;return new Response(bytes);}})).status,503);assert.equal(called,0);
 const active=new AbortController();let lateCancelled=false,lateReads=0;let release;const gate=new Promise(r=>release=r);const pending=learningMedia(request({}, {signal:active.signal}),{fetch:async()=>{await gate;return new Response(new ReadableStream({pull(){lateReads++;},cancel(){lateCancelled=true;}},{highWaterMark:0}));}});active.abort();assert.equal((await pending).status,503);release();await new Promise(r=>setImmediate(r));assert.equal(lateCancelled,true);assert.equal(lateReads,0);
 const start=Date.now();let timeoutRelease,timeoutCancelled=false,timeoutReads=0;const timeoutGate=new Promise(r=>timeoutRelease=r);const timed=await learningMedia(request(),{fetch:async()=>{await timeoutGate;return new Response(new ReadableStream({pull(){timeoutReads++;},cancel(){timeoutCancelled=true;}},{highWaterMark:0}));}});assert.equal(timed.status,503);assert.ok(Date.now()-start<4000);timeoutRelease();await new Promise(r=>setImmediate(r));assert.equal(timeoutCancelled,true);assert.equal(timeoutReads,0);
});

test('single-byte, open-ended, clamped and large-suffix boundaries return exact slices',async()=>{
 for(const [range,start,end] of [
  ['bytes=0-0',0,0],
  [`bytes=${bytes.length-1}-`,bytes.length-1,bytes.length-1],
  [`bytes=${bytes.length-4}-${bytes.length+99}`,bytes.length-4,bytes.length-1],
  [`bytes=-${bytes.length+99}`,0,bytes.length-1],
 ]){
  const r=await learningMedia(request({range}),assets);assert.equal(r.status,206);
  assert.equal(r.headers.get('content-range'),`bytes ${start}-${end}/${bytes.length}`);
  assert.equal(r.headers.get('content-length'),String(end-start+1));
  assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes.subarray(start,end+1));
 }
});
