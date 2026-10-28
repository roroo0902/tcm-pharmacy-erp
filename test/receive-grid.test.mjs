import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptKey,receiptLines,sortReceiptRows} from '../web/receive-grid-data.mjs';
const a={id:'1:3',name:'科達單方',code:'A2',drug:'甲',bottles:2},b={id:'2:3',name:'天明複方',code:'A10',drug:'乙',bottles:9};
test('receipt quantities survive filtering, brand switching and row movement; receipt is an addition',()=>{
 const q=new Map([[receiptKey(a),'3'],[receiptKey(b),'4']]);
 assert.deepEqual(receiptLines([{...a,id:'1:9'},b],q),[{sheet:'科達單方',code:'A2',name:'甲',quantity:3},{sheet:'天明複方',code:'A10',name:'乙',quantity:4}]);
 assert.deepEqual(sortReceiptRows([b,a],q,'code','asc').map(r=>r.code),['A2','A10']);
 assert.deepEqual(sortReceiptRows([a,b],q,'quantity','desc').map(r=>r.bottles),[9,2]);
 assert.equal(q.size,2);
});
test('empty rows are omitted, invalid quantities and changed identities stop the batch',()=>{
 assert.deepEqual(receiptLines([a,b],new Map([[receiptKey(a),''],[receiptKey(b),'1']])),[{sheet:'天明複方',code:'A10',name:'乙',quantity:1}]);
 for(const v of ['0','-1','1.5','1000001'])assert.throws(()=>receiptLines([a],new Map([[receiptKey(a),v]])),/正整數/);
 assert.throws(()=>receiptLines([{...a,drug:'被更名'}],new Map([[receiptKey(a),'1']])),/變更/);
 assert.throws(()=>receiptLines([a,a],new Map([[receiptKey(a),'1']])),/變更/);
 assert.throws(()=>receiptLines([{...a,bottles:null}],new Map([[receiptKey(a),'1']])),/待核對/);
});
test('blank quantities stay last in both sort directions',()=>{
 const q=new Map([[receiptKey(a),'2']]);
 for(const dir of ['asc','desc'])assert.deepEqual(sortReceiptRows([b,a],q,'quantity',dir).map(r=>r.code),['A2','A10']);
});
