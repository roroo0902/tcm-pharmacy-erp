import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('hosted RPC uses existing session; prepares loss in a separate execution and never writes on preview',async t=>{
 const old=globalThis.google,calls=[];t.after(()=>{globalThis.google=old;});
 const runner={withSuccessHandler(fn){this.ok=fn;return this;},withFailureHandler(fn){this.fail=fn;return this;},erpHosted(op,d,token){calls.push([op,d,token]);this.ok({lines:[],token:'review'});}};
 globalThis.google={script:{run:runner}};
 const m=await import('../web/direct-sync.mjs?hosted-test');
 assert.equal(m.hostedEnabled(),true);await m.authorize();
 await m.runDirect('preview',{kind:'tcm-loss-cumulative'});
 assert.deepEqual(calls.map(c=>c[0]),['prepareLoss','preview']);
 await m.runDirect('commit',{kind:'tcm-cloud',id:'ERP-same'},'review');
 assert.equal(calls[2][2],'review');assert.equal(calls[2][1].id,'ERP-same');
});
test('hosted artifact embeds executable app and keeps hash navigation inside the page',()=>{
 const html=fs.readFileSync('gas/cloud/App.html','utf8');
 const js=fs.readFileSync('web/hosted-app.js','utf8');assert.ok(js.includes('加入進貨清單'));assert.ok(js.includes('同步完成・工作表已讀回核對'));
 assert.ok(!html.includes('<base href='));assert.ok(!html.includes('<script type="module" src='));
 assert.ok(html.includes('https://roroo0902.github.io/tcm-pharmacy-erp/web/assets/'));
 new Function(js);assert.ok(html.includes('web/hosted-app.js?v=host20261029a'));
});
