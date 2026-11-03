import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeShortage,normalizeSubstitution,validateAllocation,shortageProgress} from '../src/shortage.mjs';
const id='SH-12345678-1234-1234-1234-123456789abc',other='SH-22345678-1234-1234-1234-123456789abc';
const row={sheet:'科達單方',code:'A1',name:'測試藥'};
const record={id,revision:0,...row,need:10,threshold:2,priority:'normal',status:'confirmed',supply:'unknown',eta:'',note:'',actor:'測試員'};
const tx=(id,action,quantity=10)=>({draft:{id,action,lines:[{...row,quantity}]}});
const orders=[tx('ERP-order123','訂貨')],receipts=[tx('ERP-receipt123','進貨',4)];
const allocation=(kind,quantity,shortageId=id)=>({shortageId,kind,transactionId:kind==='order'?'ERP-order123':'ERP-receipt123',sheet:row.sheet,code:row.code,quantity});
test('shortage validates identity, integers and real dates and trims actor',()=>{
 assert.equal(normalizeShortage({...record,actor:' 測試員 ',eta:'2028-02-29'}).actor,'測試員');
 for(const patch of [{need:-1},{need:1.5},{need:'3'},{threshold:1000001},{eta:'2026-02-29'},{revision:-1},{priority:'high'},{id:'SH-invalid'},{actor:''},{status:'fake'},{supply:'fake'}])assert.throws(()=>normalizeShortage({...record,...patch}));
});
test('closure cancellation and deferral require reason',()=>{for(const status of ['closed','cancelled','deferred']){assert.throws(()=>normalizeShortage({...record,status}));assert.equal(normalizeShortage({...record,status,note:'需求取消'}).status,status);}});
test('substitution is directional, self forbidden, confirmation needs conditions',()=>{
 const input={id:'SU-12345678-1234-1234-1234-123456789abc',revision:0,from:row,to:{...row,code:'A2'},priority:1,note:'',status:'pending',actor:'測試員'};
 assert.equal(normalizeSubstitution(input).to.code,'A2');assert.throws(()=>normalizeSubstitution({...input,to:{...row,name:'改名'}}));
 assert.throws(()=>normalizeSubstitution({...input,status:'confirmed'}));assert.equal(normalizeSubstitution({...input,status:'confirmed',note:'由藥師核對適用條件'}).status,'confirmed');assert.throws(()=>normalizeSubstitution({...input,priority:0}));
});
test('allocation checks exact confirmed action and item and global allocated quantity',()=>{
 assert.equal(validateAllocation(allocation('order',6),[allocation('order',4,other)],orders,receipts).quantity,6);
 assert.throws(()=>validateAllocation(allocation('order',7),[allocation('order',4,other)],orders,receipts),/超過/);
 for(const patch of [{code:'A2'},{transactionId:'missing'},{kind:'receipt'},{quantity:0}])assert.throws(()=>validateAllocation({...allocation('order',6),...patch},[],orders,receipts));
 assert.throws(()=>validateAllocation(allocation('order',6),[],[...orders,...orders],receipts),/唯一/);
});
test('partial arrival tracks only allocated transactions, never weekly total or stock',()=>{
 const p=shortageProgress({...record,bottles:100,weekly:999},[allocation('order',10),allocation('receipt',4)],orders,receipts);
 assert.deepEqual(p,{ordered:10,received:4,outstanding:6,toOrder:0,progress:'partial',invalidAllocations:0});
 assert.equal(shortageProgress({...record,bottles:100},[],orders,receipts).received,0);
});
test('receipt reversal reopens outstanding and order cancellation excludes canceled quantities',()=>{
 const allocations=[allocation('order',10),allocation('receipt',4)];
 const reversed=[...receipts,{draft:{id:'reverse',action:'沖銷',reverses:'ERP-receipt123'}}];
 assert.equal(shortageProgress(record,allocations,orders,reversed).outstanding,10);
 const cancelled=[...orders,{draft:{id:'cancel',action:'取消訂貨',reverses:'ERP-order123'}}];
 const p=shortageProgress(record,allocations,cancelled,receipts);assert.equal(p.ordered,0);assert.equal(p.received,4);assert.equal(p.toOrder,6);
 assert.throws(()=>validateAllocation(allocation('order',1),[],cancelled,receipts),/取消/);
});
test('full arrivals and malformed allocations do not silently become valid receipts',()=>{
 const full=[tx('ERP-receipt123','進貨',10)];assert.equal(shortageProgress(record,[allocation('order',10),allocation('receipt',10)],orders,full).progress,'arrived');
 const p=shortageProgress(record,[allocation('receipt',4),allocation('receipt',4,other)],orders,receipts);assert.equal(p.received,0);assert.equal(p.invalidAllocations,1);
 const wrongName=[{draft:{...receipts[0].draft,lines:[{...row,name:'另一藥',quantity:4}]}}];assert.equal(shortageProgress(record,[allocation('receipt',4)],orders,wrongName).received,0);
});
