// Reproducible local workerd + genuine D1 binding verification. No cloud/API access.
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {mkdtemp,rm,readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2);if(args.length!==4||args[0]!=='--source'||args[2]!=='--toolchain')throw Error('Usage: node verify-recovery.mjs --source <repository-root> --toolchain <official-installed-Vinext-root>');
const SOURCE=resolve(args[1]),TOOLCHAIN=resolve(args[3]),ROOT=fileURLToPath(new URL('.',import.meta.url));
const requireTool=createRequire(join(TOOLCHAIN,'package.json'));
const {Miniflare}=await import(pathToFileURL(requireTool.resolve('miniflare')).href);
const {createD1LedgerAdmin}=await import(pathToFileURL(join(SOURCE,'server/d1-ledger.js')).href);
const {dialogueFixture}=await import(pathToFileURL(join(SOURCE,'server/catalogue.js')).href);
for(const [name,version] of [['miniflare','4.20260515.0'],['wrangler','4.92.0']])assert.equal(JSON.parse(await readFile(join(TOOLCHAIN,'node_modules',name,'package.json'))).version,version);
const ORIGIN='http://d1-fixture.test',OWNER='synthetic-d1-owner';
const rootState=await mkdtemp(join(tmpdir(),'xiaobu-d1-recovery-'));let state,mf,outboundAttempts=0,calls=0,gate=null,faultPoint='';
await mkdir(join(ROOT,'evidence'),{recursive:true});
const report={localOnly:true,identity:'fixed-synthetic-fixture-not-production-auth',mode:'offline-test',currency:'TEST',checks:[],cases:[],boundary:'fault injection at D1 batch boundary plus actual workerd disposal/restart; NOT a hard process crash'};
const check=name=>report.checks.push(name);
const watchdog=setTimeout(()=>{console.error('D1_PROBE_DEADLINE');process.exit(1);},90000);
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
const modules=[{type:'ESModule',path:join(ROOT,'recovery-worker.mjs'),contents:await readFile(join(ROOT,'recovery-worker.mjs'),'utf8')}];for(const path of (await files(join(SOURCE,'server'))).filter(p=>p.endsWith('.js')))modules.push({type:'ESModule',path:join(ROOT,'server',relative(join(SOURCE,'server'),path)),contents:await readFile(path,'utf8')});modules.push({type:'ESModule',path:join(ROOT,'dist/loop-model.js'),contents:await readFile(join(SOURCE,'dist/loop-model.js'),'utf8')});
modules.push({type:'ESModule',path:join(ROOT,'fault-binding.mjs'),contents:await readFile(join(ROOT,'fault-binding.mjs'),'utf8')});
const init=()=>new Miniflare({name:'local-d1-recovery-fixture',bindings:{DEV_FAULT_POINT:faultPoint},modules,modulesRoot:ROOT,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'local-only-xiaobu-d1'},d1Persist:join(state,'v3/d1'),host:'127.0.0.1',port:0,cf:false,outboundService:()=>{outboundAttempts++;throw Error('Outbound denied');},serviceBindings:{FIXTURE_PROVIDER:async request=>{assert.equal(request.url,'https://api.deepseek.com/chat/completions');calls++;if(gate)await gate;const payload=await request.json(),expected=JSON.parse(payload.messages[1].content).expected;return Response.json({model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:100},choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(dialogueFixture({questionId:expected.questionId,intent:expected.intent}))}}]});}}});
const request=(path='/api/tutor/status',body)=>mf.dispatchFetch(ORIGIN+path,{method:body?'POST':'GET',headers:{origin:ORIGIN,'sec-fetch-site':'same-origin','x-xiaobu-request':'1','content-type':'application/json','oai-authenticated-user-id':'untrusted-forged-owner'},...(body?{body:JSON.stringify(body)}:{})});
const payload=(requestId,profileId='A')=>({requestId,profileId,questionId:'loop:math:0',intent:'check'});
const dialogue=async id=>{const r=await request('/api/tutor/dialogue',typeof id==='string'?payload(id):id);return {status:r.status,body:await r.json()};};
const status=async()=>{const r=await request();assert.equal(r.status,200);return (await r.json()).status;};
try{
 for(const point of ['reservation-after','settlement-before','settlement-after']){
  state=join(rootState,point);await mkdir(state);calls=0;faultPoint=point;
  const privateHome=join(state,'home');await mkdir(privateHome,{recursive:true});
  const childEnv={PATH:process.env.PATH||'/usr/bin:/bin',HOME:privateHome,XDG_CONFIG_HOME:join(privateHome,'.config'),XDG_CACHE_HOME:join(privateHome,'.cache'),XDG_DATA_HOME:join(privateHome,'.local/share'),TMPDIR:state,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false',CI:'true',NO_COLOR:'1'};
  const migration=execFileSync(process.execPath,[join(TOOLCHAIN,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','DB','--local','--config',join(ROOT,'wrangler.local.json'),'--persist-to',state,'--file',join(SOURCE,'server/migrations/0001_tutor.sql')],{cwd:ROOT,env:childEnv,encoding:'utf8',timeout:15000});
  assert.match(migration,/12 commands executed successfully/);
  await writeFile(join(ROOT,`evidence/recovery-${point}-migration.log`),migration);
  mf=init();let db=await mf.getD1Database('DB');const admin=createD1LedgerAdmin({db});
  await admin.registerProfile({ownerId:OWNER,profileId:'A'});
  await admin.createScope({scope:'offline-fixture',ownerId:OWNER,currency:'TEST',limitMicros:1000,expiresAtMs:Date.now()+3600000,maxInflight:10,maxRequests:100});
  const dump=async()=>JSON.stringify((await db.batch([db.prepare('SELECT * FROM tutor_scopes'),db.prepare('SELECT * FROM tutor_claims')])).map(r=>r.results));
  const first=await dialogue('uncertain');assert.equal(first.status,503);assert.equal(first.body.error.code,'LEDGER_UNAVAILABLE');
  const settled=point==='settlement-after';assert.equal(calls,point==='reservation-after'?0:1);
  const beforeStatus=await dump(),quota=(await status()).quota;assert.equal(await dump(),beforeStatus);
  assert.equal(quota.reservedMicros,settled?0:100);assert.equal(quota.spentMicros,settled?100:0);assert.equal(quota.pendingCount,settled?0:1);assert.equal(quota.availableMicros,900);
  const claim=(await db.prepare('SELECT * FROM tutor_claims').all()).results;assert.equal(claim.length,1);assert.equal(claim[0].state,settled?'settled':'pending');
  const initialCalls=calls;
  await mf.dispose();mf=null;faultPoint='';mf=init();db=await mf.getD1Database('DB');
  assert.equal(await dump(),beforeStatus);
  const replay=await dialogue('uncertain');assert.equal(replay.status,settled?200:409);if(!settled)assert.equal(replay.body.error.code,'IN_PROGRESS');else assert.equal(replay.body.result.answer,'4');assert.equal(calls,initialCalls);
  const changed=await dialogue({...payload('uncertain'),intent:'hint'});assert.equal(changed.status,409);assert.equal(changed.body.error.code,'IDEMPOTENCY_CONFLICT');assert.equal(calls,initialCalls);
  const beforeRead=await dump();await status();assert.equal(await dump(),beforeRead);
  // Pending retains one of ten inflight slots. Hold nine synthetic provider calls
  // and prove the original uncertain claim is not released to make room.
  if(!settled){
   let release;gate=new Promise(r=>release=r);const pending=Array.from({length:9},(_,i)=>dialogue('fill-'+i));
   try{
    const deadline=Date.now()+5000;while(calls<initialCalls+9&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.equal(calls,initialCalls+9);
    const full=(await status()).quota;assert.equal(full.pendingCount,10);assert.equal(full.reservedMicros,1000);assert.equal(full.inflightAllowed,false);assert.equal(full.availableMicros,0);
    const denied=await dialogue('overflow');assert.equal(denied.status,429);assert.ok(['BUDGET_EXHAUSTED','INFLIGHT_LIMIT'].includes(denied.body.error.code));assert.equal(calls,initialCalls+9);
   }finally{release();gate=null;}
   for(const response of await Promise.all(pending))assert.equal(response.status,200);
  }else{for(let i=0;i<9;i++)assert.equal((await dialogue('fill-'+i)).status,200);}
  assert.equal(calls,initialCalls+9);const final=(await status()).quota;assert.equal(final.spentMicros,settled?1000:900);assert.equal(final.reservedMicros,settled?0:100);assert.equal(final.availableMicros,0);
  const over=await dialogue('over');assert.equal(over.status,429);assert.equal(over.body.error.code,'BUDGET_EXHAUSTED');assert.equal(calls,initialCalls+9);
  report.cases.push({point,firstStatus:first.status,initialProviderCalls:initialCalls,initialQuota:quota,restartReplayStatus:replay.status,changedFingerprintStatus:changed.status,finalQuota:final,finalProviderCalls:calls,statusReadsUnchanged:true});
  check(point+' real D1 persistent state, replay, conflict, bounded quota');
  await mf.dispose();mf=null;
 }
 assert.equal(outboundAttempts,0);report.outboundAttempts=outboundAttempts;report.passed=true;
 report.cliIsolation={privateHome:true,minimalEnvironment:true,metrics:false,cloudMetadataLookup:false};
 report.versions={};for(const pkg of ['miniflare','wrangler'])report.versions[pkg]=JSON.parse(await readFile(join(TOOLCHAIN,'node_modules',pkg,'package.json'),'utf8')).version;
 report.sourceFiles=modules.map(m=>({path:relative(ROOT,m.path),sha256:createHash('sha256').update(m.contents).digest('hex')}));
 for(const path of ['server/migrations/0001_tutor.sql'])report.sourceFiles.push({path,sha256:createHash('sha256').update(await readFile(join(SOURCE,path))).digest('hex')});
 report.harnessSha256=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
 await writeFile(join(ROOT,'evidence/recovery-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{if(mf)await mf.dispose();clearTimeout(watchdog);await rm(rootState,{recursive:true,force:true});}
