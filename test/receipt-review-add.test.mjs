import test from 'node:test';
import assert from 'node:assert/strict';
import {appendReceiptItem} from '../web/receipt-review-add.mjs';
import {receiptKey} from '../web/receive-grid-data.mjs';
const row={name:'富田單方',code:'A083',drug:'大黃',bottles:136};
const draft={kind:'tcm-cloud',version:1,id:'ERP-test-add-1234',action:'進貨',date:'2026-11-17',actor:'測試',note:'',lines:[{sheet:'科達單方',code:'A1004',name:'大黃',quantity:4}]};
test('addition preserves transaction identity and prior edits; priced additions upgrade draft',()=>{
 const next=appendReceiptItem(draft,[row],receiptKey(row),'2','200');
 assert.equal(next.id,draft.id);assert.deepEqual(next.lines[0],draft.lines[0]);
 assert.equal(next.lines[1].quantity,2);assert.equal(next.lines[1].unitPriceCents,20000);
 assert.equal(next.version,2);assert.equal(next.currency,'TWD');assert.equal(draft.lines.length,1);
 assert.throws(()=>appendReceiptItem(next,[row],receiptKey(row),'1','200'),/已在清單/);
});
test('addition rejects invalid quantities, ambiguous catalog and unknown stock',()=>{
 for(const q of ['',0,-1,1.5,1000001])assert.throws(()=>appendReceiptItem(draft,[row],receiptKey(row),q,''));
 assert.throws(()=>appendReceiptItem(draft,[row,row],receiptKey(row),1,''),/資料已變更/);
 assert.throws(()=>appendReceiptItem(draft,[{...row,bottles:null}],receiptKey(row),1,''),/庫存待核對/);
 assert.throws(()=>appendReceiptItem(draft,[row],receiptKey(row),1,'12.345'),/兩位/);
});
test('blank price stays unknown and zero remains an explicit price',()=>{
 assert.equal(appendReceiptItem(draft,[row],receiptKey(row),1,'').version,1);
 assert.equal(appendReceiptItem(draft,[row],receiptKey(row),1,'0').lines[1].unitPriceCents,0);
});
