import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupplierLoader} from '../web/supplier-catalog.mjs';
import {reconcileOrderInputs} from '../web/order-refresh.mjs';
import {orderKey,orderPrice,orderLines} from '../web/order-grid-data.mjs';
import {receiptLines} from '../web/receive-grid-data.mjs';
test('six category refresh shares one pending read, retries failures, and later reads fresh',async()=>{
 let calls=0,resolve;const load=createSupplierLoader(()=>{calls++;return new Promise(r=>resolve=r);});
 const reads=Array.from({length:6},()=>load());await Promise.resolve();assert.equal(calls,1);resolve({fresh:1});assert.deepEqual(await Promise.all(reads),Array(6).fill({fresh:1}));
 const next=load();await Promise.resolve();assert.equal(calls,2);resolve({fresh:2});assert.deepEqual(await next,{fresh:2});
 let n=0;const retry=createSupplierLoader(()=>{if(!n++)throw Error('offline');return 3;});await assert.rejects(retry(),/offline/);assert.equal(await retry(),3);
});
test('both grids keep six quantities, refresh inherited prices/stock, preserve manual zero and blank prices',()=>{
 const previous=['科達','天明','富田'].flatMap(brand=>['單方','複方'].map(category=>({name:brand+category,code:'A1',drug:'品項',bottles:10,unitPriceCents:1000})));
 const q=new Map(previous.map(r=>[orderKey(r),'3'])),p=new Map([[orderKey(previous[0]),'0'],[orderKey(previous[1]),'']]);
 const next=previous.map(r=>({...r,bottles:12,unitPriceCents:1250}));reconcileOrderInputs(previous,next,q,p);
 assert.equal(q.size,6);assert.equal(orderPrice(next[0],p),'0');assert.equal(orderPrice(next[1],p),'');
 for(const r of next.slice(2)){assert.equal(orderPrice(r,p),'12.5');assert.equal(r.bottles+Number(q.get(orderKey(r))),15);}
 for(const lines of [orderLines(next,q,p),receiptLines(next,q,p)]){assert.equal(lines.length,6);assert.equal(lines[0].unitPriceCents,0);assert.equal(lines[1].unitPriceCents,undefined);assert.equal(lines[2].quantity*lines[2].unitPriceCents,3750);}
});
