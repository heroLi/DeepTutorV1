import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(dir,entry.name)):[join(dir,entry.name)]);}
test('shipped static assets contain no backend, provider credential or runtime database',()=>{
 const output=files(join(root,'dist'));
 for(const path of output){
  const name=relative(join(root,'dist'),path);
  assert.doesNotMatch(name,/(^|\/)(server|server-sim|client|tests|node_modules)(\/|$)|(^|\/)\.env(?:\.|$)|\.sqlite(?:-|$)|\.db(?:-|$)|\.dev\.vars/,name);
  if(!/\.(?:html|css|js|json)$/.test(name))continue;
  const source=readFileSync(path,'utf8');
  assert.doesNotMatch(source,/api\.deepseek\.com|DEEPSEEK_API_KEY|process\.env|(?:from\s*|import\s*)['"][^'"]*server\//,name);
  assert.doesNotMatch(source,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{24,}/,name);
 }
});
test('server source has no obvious private-key patterns and migrations do not seed data',()=>{
 for(const path of files(join(root,'server')).filter(p=>/\.(?:js|sql)$/.test(p))){
  const source=readFileSync(path,'utf8');
  assert.doesNotMatch(source,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{24,}/,relative(root,path));
 }
 const migration=readFileSync(join(root,'server/migrations/0001_tutor.sql'),'utf8');
 assert.doesNotMatch(migration,/^\s*INSERT\s+INTO/im,'schema migration must not seed identities, approvals or learner data');
});
test('local secret and database patterns remain ignored without hiding hosting source',()=>{
 const ignore=readFileSync(join(root,'.gitignore'),'utf8').split(/\r?\n/);
 for(const pattern of ['.env','.env.*','.dev.vars','.dev.vars.*','*.sqlite','*.sqlite-*','*.db','*.db-*','runtime-data/','node_modules/'])assert.ok(ignore.includes(pattern),pattern);
 assert.equal(ignore.includes('.openai/'),false);
});
