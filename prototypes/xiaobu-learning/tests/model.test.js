import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {subjects,createSession,item,select,attempt,hint,advance} from '../dist/model.js';
for(const key of Object.keys(subjects)){
 test(`${key}: two fresh exercises complete without duplicate submissions`,()=>{const s=createSession(key);assert.notEqual(subjects[key].items[0].question,subjects[key].items[1].question);assert.equal(advance(s),false);assert.equal(attempt(s),false);assert.equal(hint(s),false);assert.equal(select(s,'<script>'),false);
 for(let i=0;i<2;i++){const q=item(s);assert.equal(q.choices.filter(c=>c===q.answer).length,1);assert.equal(select(s,q.answer),true);assert.equal(attempt(s),true);assert.equal(attempt(s),false);assert.equal(hint(s),false);assert.equal(s.records[i].attempts,1);assert.equal(s.records[i].firstCorrect,true);assert.equal(advance(s),true);}
 assert.equal(s.complete,true);assert.equal(advance(s),false);assert.equal(select(s,item(s).answer),false);});
 test(`${key}: incorrect first answer and hints are not rewritten by success`,()=>{const s=createSession(key);select(s,item(s).choices.find(c=>c!==item(s).answer));attempt(s);assert.equal(s.feedback,'try');assert.equal(s.records[0].firstCorrect,false);for(let i=0;i<3;i++)assert.equal(hint(s),true);assert.equal(hint(s),false);select(s,item(s).answer);attempt(s);assert.equal(s.records[0].firstCorrect,false);assert.equal(s.records[0].attempts,2);assert.equal(s.records[0].hints,3);advance(s);assert.equal(s.records[1].hints,0);assert.equal(s.selected,null);});
 test(`${key}: skip unlocks hints and does not count as correct`,()=>{const s=createSession(key);assert.equal(attempt(s,true),true);assert.equal(s.records[0].firstCorrect,false);assert.equal(hint(s),true);assert.equal(advance(s),false);});
}
test('unknown subject rejected',()=>assert.throws(()=>createSession('private-profile')));
test('runtime contains no network, personal data fields or model config',()=>{const source=['app.js','model.js','index.html'].map(f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8')).join('\n');for(const forbidden of [/\bfetch\s*\(/,/XMLHttpRequest/,/sessionStorage/,/sendBeacon/,/WebSocket/,/TUTOR_LLM/,/<input/i,/<iframe/i,/<script[^>]+https?:/i])assert.equal(forbidden.test(source),false,String(forbidden));});
