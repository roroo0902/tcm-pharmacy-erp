import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('hosted loss commits the exact reviewed serialization and rejects edited or expired drafts',()=>{
 const cached=new Map();let committed='';
 const ctx={loss3Actor_(){},CacheService:{getUserCache:()=>({put:(k,v)=>cached.set(k,v),get:k=>cached.get(k)})},
 lossV3Preview:d=>({token:'fixed',lines:[{delta:committed?0:1}],serialized:d}),
 lossV3Commit(d,t){assert.equal(d,cached.get('hosted-loss-'+t));committed=d;return {count:1};}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('gas/cloud/Hosted.gs','utf8'),ctx);
 const d={kind:'tcm-loss-cumulative',lines:[{total:1,code:'QA'}]};
 ctx.erpHosted('preview',d);assert.throws(()=>ctx.erpHosted('commit',{...d,lines:[{total:2,code:'QA'}]},'fixed'));
 assert.equal(ctx.erpHosted('commit',d,'fixed').count,1);
 cached.clear();assert.throws(()=>ctx.erpHosted('commit',d,'fixed'));
});
test('hosted loss fingerprints ignore RPC object key order but preserve values and array order',()=>{
 const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('gas/cloud/Hosted.gs','utf8'),ctx);
 const a={kind:'tcm-loss-cumulative',lines:[{code:'QA',total:1}],date:'2026-10-29'};
 const b={date:a.date,lines:[{total:1,code:'QA'}],kind:a.kind};
 const key=x=>JSON.stringify(ctx.erpHostedCanonical_(x));
 assert.equal(key(a),key(b));assert.notEqual(key(a),key({...b,lines:[{total:2,code:'QA'}]}));
 assert.notEqual(key([1,2]),key([2,1]));
});
import {cloudDraft,cloudPlan} from '../src/cloud-transaction.mjs';
test('multi-item receipt plans every item together and rejects a bad line before commit',()=>{
 const lines=[{sheet:'科達單方',code:'QA1',name:'測試一',quantity:2},{sheet:'天明單方',code:'QA2',name:'測試二',quantity:3}];
 const draft=cloudDraft({kind:'tcm-cloud',version:1,id:'ERP-batch-test123',action:'進貨',date:'2026-10-29',actor:'QA',note:'',lines});
 const rows=lines.map((l,i)=>({...l,stock:i+1,sheetId:i+1,row:3}));
 assert.deepEqual(cloudPlan(draft,rows).lines.map(l=>l.after),[3,5]);
 assert.throws(()=>cloudPlan(draft,[rows[0],{...rows[1],stock:null}]));
 assert.throws(()=>cloudDraft({...draft,lines:[lines[0],{...lines[1],quantity:1.5}]}));
});
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
 new Function(js);assert.ok(html.includes('web/hosted-app.js?v=staff20261030'));
});
