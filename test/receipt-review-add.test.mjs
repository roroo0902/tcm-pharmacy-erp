import test from 'node:test';
import assert from 'node:assert/strict';
import {appendReceiptItem,receiptNameMatch,appendReceiptSelection} from '../web/receipt-review-add.mjs';
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

test('name selection is scoped to vendor and category and rejects ambiguous or unknown names',()=>{
 const rows=[{...row,brand:'富田',category:'單方'},{...row,brand:'天明',category:'單方',code:'A004'}];
 assert.equal(receiptNameMatch(rows,'天明','單方','大黃').code,'A004');
 assert.equal(receiptNameMatch(rows,'富田','單方','大黃（A083）').code,'A083');
 assert.throws(()=>receiptNameMatch(rows,'富田','複方','大黃'),/找不到/);
 assert.throws(()=>receiptNameMatch([...rows,rows[0]],'富田','單方','大黃'),/不只一筆/);
});

test('new receipt item supports supplied or generated code and never renames an existing item',()=>{
 const rows=[{...row,brand:'富田',category:'單方'}];
 const created=appendReceiptSelection(draft,rows,'富田','單方','新品甲','','2','100',()=> 'AUTO-test');
 assert.equal(created.lines.at(-1).code,'AUTO-test');assert.equal(created.lines.at(-1).create,true);
 assert.equal(appendReceiptSelection(draft,rows,'富田','單方','新品乙','NEW1',2,'').lines.at(-1).code,'NEW1');
 assert.throws(()=>appendReceiptSelection(draft,rows,'富田','單方','新品乙','A083',2,''),/已存在/);
 assert.throws(()=>appendReceiptSelection(draft,rows,'富田','單方','大黃','wrong',2,''),/不一致/);
});
