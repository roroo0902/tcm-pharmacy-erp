import {createReadCache} from '../web/recent-read.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupplierLoader} from '../web/supplier-catalog.mjs';
import {reconcileOrderInputs} from '../web/order-refresh.mjs';
import {orderKey,orderPrice,orderLines} from '../web/order-grid-data.mjs';
import {receiptLines} from '../web/receive-grid-data.mjs';

test('stalled catalog read times out, permits retry and ignores late response',async()=>{
 let calls=0,late;
 const load=createSupplierLoader(()=>++calls===1?new Promise(resolve=>{late=resolve;}):{fresh:2},10);
 const first=load();assert.equal(load(),first);
 await assert.rejects(first,/讀取逾時/);
 assert.deepEqual(await load(),{fresh:2});
 late({fresh:1});await Promise.resolve();
 assert.deepEqual(await load(),{fresh:2});assert.equal(calls,3);
});
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


test('a fresh read ignores the saved value; a concurrent pre-write response cannot replace newer data',async()=>{
 let clock=0,calls=0,finishOld;
 const cache=createReadCache(60,()=>clock);
 const fetchValue=()=>++calls;
 assert.equal(await cache.read(fetchValue),1);
 assert.equal(await cache.read(fetchValue),1);
 assert.equal(await cache.read(fetchValue,{fresh:true}),2);
 clock=61;
 const old=cache.read(()=>new Promise(resolve=>{finishOld=resolve;}));
 await Promise.resolve();
 cache.clear();
 assert.equal(await cache.read(fetchValue),3);
 finishOld(0);
 assert.equal(await old,3);
 assert.equal(await cache.read(fetchValue),3);
});

test('hung shared read expires, retries after failure, and ignores its late result',async()=>{
 const cache=createReadCache(100,Date.now,10);
 let finish;
 await assert.rejects(cache.read(()=>new Promise(resolve=>{finish=resolve;})),/逾時/);
 assert.equal(await cache.read(()=>2),2);
 finish(1);
 assert.equal(await cache.read(()=>3),2);
});
