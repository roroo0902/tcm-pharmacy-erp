import test from 'node:test';
import assert from 'node:assert/strict';
import {queueShortage,seedShortage,shortageLinks,clearShortage} from '../web/shortage-handoff.mjs';
import {shortageProgress} from '../src/shortage.mjs';
import {receiptKey,receiptLines} from '../web/receive-grid-data.mjs';

const item={sheet:'科達單方',code:'QA-receive',name:'合成品'};
const record={...item,id:'SH-12345678-1234-1234-1234-123456789abc',revision:0,need:10,threshold:2,status:'confirmed',supply:'unknown',priority:'normal',eta:'',note:'',actor:'QA'};
const line={name:item.sheet,drug:item.name,code:item.code,bottles:4};
const tx=(id,action,quantity)=>({draft:{id,action,lines:[{...item,quantity}]}});
const a=(kind,transactionId,quantity)=>({shortageId:record.id,kind,transactionId,sheet:item.sheet,code:item.code,quantity});
const orders=[tx('QA-order','訂貨',6)],receipts=[tx('QA-receipt','進貨',2)],allocations=[a('order','QA-order',6),a('receipt','QA-receipt',2)];
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
function isolated(run){
 const original={sessionStorage:globalThis.sessionStorage,localStorage:globalThis.localStorage};
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,writable:true,value:storage()});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:storage()});
 try{return run();}finally{Object.assign(globalThis,original);}
}
test('linked shortage passes pending 4 as reference only; manual actual receipt 1 leaves pending 3',()=>isolated(()=>{
 const pending=shortageProgress(record,allocations,orders,receipts).outstanding;
 assert.equal(pending,4);
 queueShortage('receive',[{...record,quantity:pending}]);
 const quantities=new Map(), handoff=seedShortage('receive',[line],quantities,receiptKey);
 assert.equal(handoff.records[0].quantity,4);
 assert.equal(quantities.size,0);
 const blank=receiptLines([line],quantities);
 assert.deepEqual(blank,[]);assert.deepEqual(shortageLinks('receive',blank),[]);
 quantities.set(receiptKey(line),'1');seedShortage('receive',[line],quantities,receiptKey);
 const actual=receiptLines([line],quantities);
 assert.equal(actual[0].quantity,1);assert.equal(shortageLinks('receive',actual)[0].quantity,1);
 assert.equal(shortageProgress(record,[...allocations,a('receipt','QA-next',1)],orders,[...receipts,tx('QA-next','進貨',1)]).outstanding,3);
 clearShortage('receive');assert.deepEqual(shortageLinks('receive',actual),[]);
}));
test('pending transaction safety and order handoff quantity seeding are preserved',()=>isolated(()=>{
 queueShortage('receive',[{...record,quantity:4}]);
 localStorage.setItem('tcm-cloud-pending-v1',JSON.stringify({action:'訂貨',verified:false}));
 assert.throws(()=>seedShortage('receive',[line],new Map(),receiptKey),/上一筆交易尚未核對/);
 localStorage.setItem('tcm-cloud-pending-v1',JSON.stringify({verified:true}));
 assert.throws(()=>seedShortage('receive',[{...line,drug:'名稱已改'}],new Map(),receiptKey),/品項已變動/);
 clearShortage('receive');queueShortage('order',[{...record,quantity:4}]);
 const quantities=new Map();seedShortage('order',[line],quantities,receiptKey);
 assert.equal(quantities.get(receiptKey(line)),'4');
 quantities.set(receiptKey(line),'1');seedShortage('order',[line],quantities,receiptKey);
 assert.equal(quantities.get(receiptKey(line)),'1');
}));
