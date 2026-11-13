// Reproducible local workerd + genuine D1 binding verification. No cloud/API access.
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {mkdtemp,rm,readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2);if(args.length!==4||args[0]!=='--source'||args[2]!=='--toolchain')throw Error('Usage: node verify.mjs --source <repository-root> --toolchain <official-installed-Vinext-root>');
const SOURCE=resolve(args[1]),TOOLCHAIN=resolve(args[3]),ROOT=fileURLToPath(new URL('.',import.meta.url));
const requireTool=createRequire(join(TOOLCHAIN,'package.json'));
const {Miniflare}=await import(pathToFileURL(requireTool.resolve('miniflare')).href);
const {createD1Ledger,createD1LedgerAdmin}=await import(pathToFileURL(join(SOURCE,'server/d1-ledger.js')).href);
const {dialogueFixture}=await import(pathToFileURL(join(SOURCE,'server/catalogue.js')).href);
for(const [name,version] of [['miniflare','4.20260515.0'],['wrangler','4.92.0']])assert.equal(JSON.parse(await readFile(join(TOOLCHAIN,'node_modules',name,'package.json'))).version,version);
const ORIGIN='http://d1-fixture.test',OWNER='synthetic-d1-owner';
const state=await mkdtemp(join(tmpdir(),'xiaobu-d1-workerd-'));let mf,outboundAttempts=0,calls=0,gate=null,nextStatus=200;
await mkdir(join(ROOT,'evidence'),{recursive:true});
const report={localOnly:true,identity:'fixed-synthetic-fixture-not-production-auth',mode:'offline-test',currency:'TEST',checks:[]};
const check=name=>report.checks.push(name);
const watchdog=setTimeout(()=>{console.error('D1_PROBE_DEADLINE');process.exit(1);},30000);
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
const modules=[{type:'ESModule',path:join(ROOT,'worker.mjs'),contents:await readFile(join(ROOT,'worker.mjs'),'utf8')}];for(const path of (await files(join(SOURCE,'server'))).filter(p=>p.endsWith('.js')))modules.push({type:'ESModule',path:join(ROOT,'server',relative(join(SOURCE,'server'),path)),contents:await readFile(path,'utf8')});modules.push({type:'ESModule',path:join(ROOT,'dist/loop-model.js'),contents:await readFile(join(SOURCE,'dist/loop-model.js'),'utf8')});
const init=()=>new Miniflare({name:'local-d1-fixture',modules,modulesRoot:ROOT,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'local-only-xiaobu-d1'},d1Persist:join(state,'v3/d1'),host:'127.0.0.1',port:0,cf:false,outboundService:()=>{outboundAttempts++;throw Error('Outbound denied');},serviceBindings:{FIXTURE_PROVIDER:async request=>{assert.equal(request.url,'https://api.deepseek.com/chat/completions');calls++;if(gate)await gate;if(nextStatus!==200)return new Response(null,{status:nextStatus,headers:{location:'https://must-not-be-contacted.invalid/'}});const payload=await request.json(),expected=JSON.parse(payload.messages[1].content).expected;return Response.json({model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:100},choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(dialogueFixture({questionId:expected.questionId,intent:expected.intent}))}}]});}}});
const request=(path='/api/tutor/status',body)=>mf.dispatchFetch(ORIGIN+path,{method:body?'POST':'GET',headers:{origin:ORIGIN,'sec-fetch-site':'same-origin','x-xiaobu-request':'1','content-type':'application/json','oai-authenticated-user-id':'untrusted-forged-owner'},...(body?{body:JSON.stringify(body)}:{})});
const payload=(requestId,profileId='A')=>({requestId,profileId,questionId:'loop:math:0',intent:'check'});
const dialogue=async id=>{const r=await request('/api/tutor/dialogue',typeof id==='string'?payload(id):id);return {status:r.status,body:await r.json()};};
const status=async()=>{const r=await request();assert.equal(r.status,200);return (await r.json()).status;};
try{
 const privateHome=join(state,'home');await mkdir(privateHome,{recursive:true});
 const childEnv={PATH:process.env.PATH||'/usr/bin:/bin',HOME:privateHome,XDG_CONFIG_HOME:join(privateHome,'.config'),XDG_CACHE_HOME:join(privateHome,'.cache'),XDG_DATA_HOME:join(privateHome,'.local/share'),TMPDIR:state,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false',CI:'true',NO_COLOR:'1'};
 const migration=execFileSync(process.execPath,[join(TOOLCHAIN,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','DB','--local','--config',join(ROOT,'wrangler.local.json'),'--persist-to',state,'--file',join(SOURCE,'server/migrations/0001_tutor.sql')],{cwd:ROOT,env:childEnv,encoding:'utf8',timeout:15000});
 await writeFile(join(ROOT,'evidence/migration.log'),migration);assert.match(migration,/12 commands executed successfully/);report.migration='official wrangler d1 execute --local: 12 statements';check('schema-only migration applied by official local CLI');
 mf=init();let db=await mf.getD1Database('DB');const admin=createD1LedgerAdmin({db}),ledger=createD1Ledger({db});
 const objects=await db.prepare("SELECT name,type FROM sqlite_master WHERE name LIKE 'tutor_%' ORDER BY name").all();assert.equal(objects.results.filter(r=>r.type==='table').length,3);assert.ok(objects.results.some(r=>r.type==='trigger'));report.schemaObjects=objects.results;
 await admin.registerProfile({ownerId:OWNER,profileId:'A'});await admin.registerProfile({ownerId:OWNER,profileId:'B'});await admin.createScope({scope:'offline-fixture',ownerId:OWNER,currency:'TEST',limitMicros:1000,expiresAtMs:Date.now()+3600000,maxInflight:2,maxRequests:100});check('operator-only initialization using actual D1 binding');
 const dump=async()=>JSON.stringify((await db.batch([db.prepare('SELECT * FROM tutor_scopes'),db.prepare('SELECT * FROM tutor_claims')])).map(r=>r.results));
 const before=await dump();const initial=await status();assert.equal(initial.quota.availableMicros,1000);assert.equal(initial.configuredMode,'offline-test');assert.equal(initial.platformVerified,false);assert.equal(await dump(),before);assert.equal(calls,0);check('status reads actual D1 without mutating domain tables');
 await assert.rejects(ledger.getScopeStatus({scope:'offline-fixture',principalId:'other',currency:'TEST',limitMicros:1000,reservationMicros:100}),{code:'FORBIDDEN'});check('D1 scope owner isolation');
 nextStatus=302;const redirected=await dialogue('redirect-fixture');assert.equal(redirected.status,502);assert.equal(redirected.body.error.code,'PROVIDER_UNAVAILABLE');assert.equal(calls,1);assert.equal((await dialogue('redirect-fixture')).status,502);assert.equal(calls,1);nextStatus=200;check('workerd manual redirect rejected without following; failure replay does not retry');
 for(let i=0;i<2;i++){const r=await dialogue('one');assert.equal(r.status,200);assert.equal(r.body.result.mode,'protocol-test');assert.equal(r.body.result.answer,'4');}assert.equal(calls,2);assert.equal((await status()).quota.spentMicros,200);check('dialogue and idempotent replay with persisted 100 TEST charge');
 assert.equal((await dialogue(payload('profile-B','B'))).status,200);assert.equal(calls,3);check('synthetic profiles A/B authorized independently');
 let release;gate=new Promise(r=>release=r);const first=dialogue('parallel-1'),second=dialogue('parallel-2');
 const deadline=Date.now()+3000;while(calls<5&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.equal(calls,5);
 const pending=await status();assert.equal(pending.quota.pendingCount,2);assert.equal(pending.quota.reservedMicros,200);
 const third=await dialogue('parallel-3');assert.equal(third.status,429);assert.equal(third.body.error.code,'INFLIGHT_LIMIT');
 const duplicate=await dialogue('parallel-1');assert.equal(duplicate.status,409);assert.equal(duplicate.body.error.code,'IN_PROGRESS');assert.equal(calls,5);release();gate=null;assert.equal((await first).status,200);assert.equal((await second).status,200);check('real D1 atomic concurrent reservations and duplicate pending guard');
 const settled=await status();assert.equal(settled.quota.spentMicros,500);assert.equal(settled.quota.reservedMicros,0);
 await assert.rejects(db.batch([db.prepare("INSERT INTO tutor_profiles(owner_id,profile_id) VALUES('rollback-owner','A')"),db.prepare("UPDATE tutor_scopes SET limit_micros=2000 WHERE scope='offline-fixture'")]));
 assert.equal((await db.prepare("SELECT * FROM tutor_profiles WHERE owner_id='rollback-owner'").all()).results.length,0);assert.equal((await status()).quota.capMicros,1000);check('D1 batch rolls back earlier insert when immutable-scope trigger aborts');
 await mf.dispose();mf=init();db=await mf.getD1Database('DB');assert.equal((await dialogue('one')).status,200);assert.equal(calls,5);assert.equal((await status()).quota.spentMicros,500);check('workerd restart retains D1 charge and cached response');
 for(let i=0;i<5;i++)assert.equal((await dialogue('fill-'+i)).status,200);assert.equal(calls,10);const exhausted=await dialogue('over');assert.equal(exhausted.status,429);assert.equal(exhausted.body.error.code,'BUDGET_EXHAUSTED');assert.equal((await status()).quota.spentMicros,1000);check('D1 total budget cap and HTTP status agree');
 await createD1Ledger({db}).freezeScope('offline-fixture');assert.ok((await status()).stoppedReasons.includes('SCOPE_FROZEN'));assert.equal((await dialogue('frozen')).status,503);assert.equal(calls,10);check('freeze stops requests without provider call');
 await mf.dispose();mf=init();assert.ok((await status()).stoppedReasons.includes('SCOPE_FROZEN'));assert.equal((await dialogue('cold-frozen')).status,503);check('cold frozen runtime retains read-only diagnostics');
 assert.equal(outboundAttempts,0);report.outboundAttempts=0;report.providerCalls=calls;report.passed=true;
 report.transportCompatibility='revised core uses redirect:manual and rejects redirects/final URL changes; probe preserves URL/init into explicit local service binding';report.cliIsolation={privateHome:true,minimalEnvironment:true,metrics:false,cloudMetadataLookup:false};report.sourceInput='explicit repository source path; exact file content hashes below';report.coreRevision={path:'server/deepseek.js',state:'exact-source-bytes-used-by-this-local-run',sha256:createHash('sha256').update(await readFile(join(SOURCE,'server/deepseek.js'))).digest('hex')};report.versions={};for(const pkg of ['miniflare','wrangler'])report.versions[pkg]=JSON.parse(await readFile(join(TOOLCHAIN,'node_modules',pkg,'package.json'),'utf8')).version;
 report.sourceFiles=[];for(const module of modules){report.sourceFiles.push({path:relative(ROOT,module.path),sha256:createHash('sha256').update(module.contents).digest('hex')});}
 console.log(JSON.stringify(report,null,2));await writeFile(join(ROOT,'evidence/results.json'),JSON.stringify(report,null,2)+'\n');
}finally{if(mf)await mf.dispose();clearTimeout(watchdog);await rm(state,{recursive:true,force:true});}
