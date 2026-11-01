import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {orderKey,orderLines,sortOrderGrid} from '../web/order-grid-data.mjs';
import {cloudDraft,cloudPlan,CLOUD_SHEETS} from '../src/cloud-transaction.mjs';
test('all six order sources retain separate identities, decimal prices and reversible stock-neutral plans',()=>{
 const rows=CLOUD_SHEETS.map((name,i)=>({name,code:'SAME',drug:'測試品',bottles:10,unitPriceCents:125+i}));
 const q=new Map(rows.map((r,i)=>[orderKey(r),String(i+1)]));
 const d=cloudDraft({kind:'tcm-cloud',version:2,currency:'TWD',id:'ERP-test-orders-123',action:'訂貨',date:'2026-11-01',actor:'測試',note:'非實際',lines:orderLines(rows,q,new Map())});
 const inventory=d.lines.map((l,i)=>({...l,stock:10,row:i+2,sheetId:i+1,price:999,priceFormula:'=1'}));
 const plan=cloudPlan(d,inventory);assert.equal(plan.lines.length,6);
 for(const [i,l] of plan.lines.entries()){assert.equal(l.after,10);assert.equal(l.before,10);assert.equal(l.amountCents,(125+i)*(i+1));assert.equal(l.priceAfter,undefined);}
 const cancel=cloudDraft({...d,id:'ERP-cancel-orders-123',action:'取消訂貨',reverses:d.id});assert.deepEqual(cloudPlan(cancel,inventory,[{draft:d,lines:plan.lines}]).lines,plan.lines);
 assert.throws(()=>cloudDraft({...d,lines:[{...d.lines[0],unitPriceCents:1.5}]}));
});
test('order sorting uses number, cents, full dates and missing last; source rows do not change',()=>{
 const a={name:'科達單方',code:'A10',drug:'a',bottles:10,weekly:10,unitPriceCents:101,updated:'2026-01-10'},b={...a,code:'A2',bottles:2,weekly:2,unitPriceCents:202,updated:'2025-12-31'},c={...a,code:'A3',unitPriceCents:undefined,weekly:null,bottles:null,updated:''},rows=[a,b,c],q=new Map([[orderKey(a),'12'],[orderKey(b),'2']]);
 for(const key of ['code','bottles','weekly','quantity','updated'])assert.equal(sortOrderGrid(rows,q,new Map(),key,'asc','2026-11-01')[0],b);
 assert.deepEqual(sortOrderGrid(rows,q,new Map(),'amount','asc').map(r=>r.code),['A2','A10','A3']);
 assert.deepEqual(sortOrderGrid(rows,q,new Map(),'price','desc').map(r=>r.code),['A2','A10','A3']);
 assert.deepEqual(rows,[a,b,c]);assert.equal(q.get(orderKey(a)),'12');
});
test('catalog discovers new standard suppliers, excludes backups, validates schema and pins configured sheet IDs',()=>{
 const sheet=(name,id)=>({getName:()=>name,getSheetId:()=>id,getRange:()=>({getDisplayValues:()=>[['','編號','','藥品名稱','價格','',''],['','','','','','','未拆封']]})});
 const all=[sheet('科達單方',1),sheet('順天堂複方',2),sheet('備份科達單方',3)];let config=null;
 const context={ERP:{inventory:'inventory'},SpreadsheetApp:{openById:()=>({getSheetByName:()=>config,getSheets:()=>all})}};vm.createContext(context);vm.runInContext(fs.readFileSync('gas/cloud/order-catalog.gs','utf8'),context);
 assert.deepEqual(Array.from(context.erpOrderSources_(),s=>s.name),['科達單方','順天堂複方']);
 config={getDataRange:()=>({getValues:()=>[['啟用','廠商','類別','工作表ID','顯示順序'],['是','順天堂','複方',2,1],['否','科達','單方',1,2]]})};assert.equal(context.erpOrderSources_().length,1);
 all[1].getRange=()=>({getDisplayValues:()=>[[],[]]});assert.throws(()=>context.erpOrderSources_(),/欄位格式/);
});
