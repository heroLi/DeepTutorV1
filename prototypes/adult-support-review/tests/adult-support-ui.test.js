import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../adult-evaluation/'+name,import.meta.url),'utf8');
const html=read('index.html'),js=read('support-app.js'),css=read('style.css');
test('adult support workflow is explicit synthetic evidence review, with no child-data entry',()=>{
 for(const s of ['成人方案审查','不收集真实作答','不是模型建议','合成观察，不是真实记录','尚未验证','参考选择不是唯一正确答案'])assert.ok(html.includes(s),s);
 assert.doesNotMatch(html,/<textarea|type=["']file|contenteditable|<iframe/i);
 assert.doesNotMatch(js,/fetch\s*\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket|getUserMedia|SpeechRecognition|speechSynthesis/);
});
test('two visible workflow selectors preserve independent page sessions instead of navigating or clearing',()=>{
 for(const id of ['explanation-workspace','support-workspace','show-support','show-explanation'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(js,/\.hidden=name!==kind/);assert.match(js,/get\('workflow-skip'\)\.setAttribute/);assert.doesNotMatch(js,/location\.|history\.|session\.clear\(\).*show-/);
 assert.match(html,/切换工作流不会清空/);assert.match(css,/\[hidden\]\{display:none!important\}/);
});
test('support selection and destructive clear guard drafts and stale callbacks',()=>{
 assert.match(js,/session\.select\(id,revision\)/);assert.match(js,/UNSAVED_REVIEW/);assert.match(js,/session\.snapshot\(\)\.revision!==current\.revision/);
 assert.match(js,/session\.choose\(x\.id,s\.revision\)/);assert.match(js,/session\.save\(s\.revision\)/);assert.match(js,/session\.clear\(s\.revision\)/);
 assert.match(html,/aria-labelledby="support-confirm-title" aria-describedby="support-confirm-description"/);assert.match(js,/dialog\.addEventListener\('cancel'/);assert.match(js,/returnFocusId=trigger\.id/);
});
test('local report download uses a distinct filename, only saved session data, and revokes its URL',()=>{
 assert.match(js,/JSON\.stringify\(session\.exportReport\(\),null,2\)/);assert.match(js,/adult-synthetic-support-review\.json/);assert.match(js,/revokeObjectURL/);
 assert.match(js,/if\(!session\.snapshot\(\)\.records\.length\)return/);assert.match(html,/草稿不导出/);
});
test('support UI uses text nodes, authored advice, no automatic learner score or prescription schedule',()=>{
 assert.doesNotMatch(js,/innerHTML|outerHTML|insertAdjacentHTML|eval\s*\(|setTimeout\([^]*session\.save/);
 for(const key of ['scene.evidence','scene.limit','scene.rationale','scene.nextCheck','scene.fallback'])assert.ok(js.includes(key));
 assert.match(html,/没有统一/);assert.match(html,/不是该指南验证的自动决策算法/);assert.match(html,/不会向孩子下发练习或建立日程/);
});
test('support narrow-screen and accessible control foundations are present',()=>{
 assert.match(css,/@media\(max-width:760px\)\{\.support-layout\{display:block\}/);
 assert.match(css,/\.support-action\{[^}]*min-height:72px/);assert.match(html,/id="support-notice"[^>]*aria-live="polite"/);
 assert.match(html,/id="support-heading" tabindex="-1"/);assert.match(html,/rel="noopener noreferrer"/);
});
