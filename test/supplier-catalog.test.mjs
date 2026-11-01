import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSupplierCatalog,supplierSelection} from '../web/supplier-catalog.mjs';
import {receiptKey,receiptLines} from '../web/receive-grid-data.mjs';
import {orderLines} from '../web/order-grid-data.mjs';
import {cloudDraft,cloudPlan} from '../src/cloud-transaction.mjs';
const grid=(code,price)=>[['','編號','','藥品名稱','價格'],['','','','','','','未拆封'],['',code,'','同名藥',price,'2026-11-01',5]];
test('shared catalog discovers new supplier and preserves separate receipt/order identities and prices',()=>{
 const sources=[{name:'科達單方',brand:'科達',category:'單方',gid:1},{name:'新廠複方',brand:'新廠',category:'複方',gid:2}];
 const {rows}=parseSupplierCatalog({sources,sheets:{科達單方:grid('A1',20),新廠複方:grid('A1',25.5)},weekly:{新廠複方:{A1:3}}});
 const q=new Map(rows.map(r=>[receiptKey(r),'2']));assert.equal(q.size,2);
 assert.deepEqual(receiptLines(rows,q),orderLines(rows,q));assert.equal(rows[1].weekly,3);
 const draft=cloudDraft({kind:'tcm-cloud',version:2,currency:'TWD',id:'ERP-shared-test-123',action:'進貨',date:'2026-11-01',actor:'驗收',note:'非實際',lines:receiptLines(rows,q)});
 const plan=cloudPlan(draft,draft.lines.map((r,i)=>({...r,stock:5,row:2,sheetId:i+1,price:i?25.5:20})));
 assert.deepEqual(plan.lines.map(r=>r.after),[7,7]);assert.deepEqual(plan.lines.map(r=>r.amountCents),[4000,5100]);
});
test('two-level selector keeps available category and falls back only when absent',()=>{
 const sources=[{brand:'甲',category:'單方',gid:1},{brand:'甲',category:'複方',gid:2},{brand:'乙',category:'複方',gid:3}];
 assert.equal(supplierSelection(sources,'甲','複方').source.gid,2);
 const next=supplierSelection(sources,'乙','單方');assert.equal(next.category,'複方');assert.deepEqual(next.categories,['複方']);
 assert.equal(supplierSelection(sources,'已移除','單方').brand,'甲');assert.equal(supplierSelection([],'甲','單方').source,undefined);
});
test('missing sources, schema changes and duplicate supplier/category cannot silently mix rows',()=>{
 const s={name:'甲單方',brand:'甲',category:'單方',gid:1};
 assert.throws(()=>parseSupplierCatalog({sources:[s],sheets:{}}),/來源缺少/);
 assert.throws(()=>parseSupplierCatalog({sources:[s],sheets:{甲單方:[[]]}}),/欄位/);
 assert.throws(()=>parseSupplierCatalog({sources:[s,{...s,gid:2}],sheets:{甲單方:grid('A1',20)}}),/重複/);
});
