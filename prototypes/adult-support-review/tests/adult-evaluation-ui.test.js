// Source/markup safeguards only. Browser layout and interactions are separately verified.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../adult-evaluation/',import.meta.url),read=name=>readFileSync(new URL(name,root),'utf8');
const html=read('index.html'),js=read('app.js'),css=read('style.css');
test('adult evaluation has an independent review workflow, not a student practice interface',()=>{for(const s of ['讲解质量评测台','选择合成用例','审校基准','记录你的判断','评审矩阵','不是 DeepSeek 输出','刷新或关闭后全部清除'])assert.ok(html.includes(s));assert.doesNotMatch(html,/<iframe|type=["']file|<textarea|contenteditable/i);assert.doesNotMatch(js,/\.\.\/dist|localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|WebSocket|getUserMedia|SpeechRecognition|speechSynthesis/);});
test('content security policy prevents connections, media and embedded content',()=>{for(const s of ["connect-src 'none'","script-src 'self'","style-src 'self'","media-src 'none'","object-src 'none'","form-action 'none'"])assert.ok(html.includes(s));assert.doesNotMatch(html,/<script(?![^>]*src=)[^>]*>/);});
test('all dynamic content uses text nodes rather than markup parsing',()=>{assert.doesNotMatch(js,/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\s*\(/);assert.match(js,/textContent/);});
test('review controls use fixed rubric values and revision-bound model operations',()=>{assert.match(js,/pass:'通过',fail:'不通过',uncertain:'待核查'/);assert.match(js,/session\.rate\(criterion\.id,value,s\.revision\)/);assert.match(js,/session\.save\(s\.revision\)/);assert.match(js,/count!==RUBRIC\.length\|\|!s\.dirty/);});
test('unsaved switches and destructive clear require accessible confirmation',()=>{assert.match(js,/UNSAVED_REVIEW/);assert.match(js,/session\.snapshot\(\)\.revision!==action\.revision/);assert.match(js,/dialog\.addEventListener\('cancel'/);assert.match(js,/restoreDialogFocus\(doc,returnFocus\)/);assert.match(html,/<dialog[^>]*aria-labelledby="confirm-title"[^>]*aria-describedby="confirm-description"/);});
test('report export is explicit local JSON and excludes unsaved draft by model contract',()=>{assert.match(js,/get\('export-report'\)\.addEventListener\('click'/);assert.match(js,/session\.exportReport\(\)/);assert.match(js,/createObjectURL/);assert.match(js,/revokeObjectURL/);assert.match(html,/未保存的评审草稿不会进入报告/);});
test('refresh warning is conditional on unsaved changes and no persistence is introduced',()=>{assert.match(js,/beforeunload[^]*if\(session\.snapshot\(\)\.dirty\)/);assert.doesNotMatch(js,/setItem|removeItem|clear\(\).*Storage/);assert.match(html,/无跨设备保存/);});
test('responsive and keyboard foundations are present without claiming visual QA',()=>{assert.match(html,/class="skip-link"/);assert.match(html,/role="status" aria-live="polite"/);assert.match(html,/scope="col"/);assert.match(css,/min-height:44px/);assert.match(css,/@media\(max-width:760px\)/);assert.match(css,/focus-visible/);assert.match(css,/overflow-x:auto/);});

// Executable focus helper checks; layout still requires browser inspection.
import {restoreDialogFocus} from '../adult-evaluation/app.js';
test('dialog restores focus to rebuilt trigger by ID, or safe fallback',()=>{
 const calls=[],button=id=>({id,focus:options=>calls.push([id,options])});
 const rebuilt=button('candidate-B'),fallback=button('first-case');
 const doc={getElementById:id=>id==='candidate-B'?rebuilt:id==='case-list'?{querySelector:()=>fallback}:null};
 restoreDialogFocus(doc,{id:'candidate-B',isConnected:false});
 assert.deepEqual(calls.pop(),['candidate-B',{preventScroll:true}]);
 const connected={...button('original'),isConnected:true};restoreDialogFocus(doc,connected);
 assert.equal(calls.pop()[0],'original');
 restoreDialogFocus(doc,{id:'missing',isConnected:false});assert.equal(calls.pop()[0],'first-case');
 rebuilt.disabled=true;restoreDialogFocus(doc,{id:'candidate-B',isConnected:false});assert.equal(calls.pop()[0],'first-case');
});
test('candidate labels remain whole while their buttons wrap',()=>{
 assert.match(css,/#candidate-list\{[^}]*flex-wrap:wrap/);
 assert.match(css,/#candidate-list button\{[^}]*flex:1 0 88px;min-width:88px;white-space:nowrap/);
});
