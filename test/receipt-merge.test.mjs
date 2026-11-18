import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudDraft} from '../src/cloud-transaction.mjs';
import {mergeReceipts} from '../src/receipt-merge.mjs';

const product={sheet:'科達單方',code:'A001',name:'藥品甲',unitPriceCents:900,quantity:2};
const link={sheet:product.sheet,code:product.code,shortageId:'SH-00000000-0000-4000-8000-000000000001',quantity:1};
const previous=cloudDraft({kind:'tcm-cloud',version:2,currency:'TWD',id:'ERP-PREVIOUS-01',action:'進貨',date:'2026-11-18',actor:'甲',note:'上一筆備註',lines:[product],shortageLinks:[link]});
const current=cloudDraft({...previous,id:'ERP-CURRENT-01',note:'本次備註',lines:[{...product,quantity:3}],shortageLinks:[{...link,quantity:2}]});

test('merged receipts retain the original transaction id and sum quantities and shortage allocations',()=>{
 const result=mergeReceipts(previous,current);
 assert.equal(result.id,previous.id);
 assert.deepEqual(result.lines,[{...product,quantity:5}]);
 assert.deepEqual(result.shortageLinks,[{...link,quantity:3}]);
 assert.equal(result.note,'上一筆備註\n本次備註');
 assert.equal(previous.lines[0].quantity,2);
 assert.equal(current.lines[0].quantity,3);
});

test('receipts with distinct dates, actors or prices cannot silently merge',()=>{
 assert.throws(()=>mergeReceipts(previous,{...current,date:'2026-11-17'}),/日期不同/);
 assert.throws(()=>mergeReceipts(previous,{...current,actor:'乙'}),/經手人不同/);
 assert.throws(()=>mergeReceipts(previous,{...current,lines:[{...product,unitPriceCents:1000}]}),/單價不同/);
 assert.throws(()=>mergeReceipts(previous,{...current,lines:[{...product,quantity:1000000}]}),/瓶數/);
});
