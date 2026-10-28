import test from 'node:test';
import assert from 'node:assert/strict';
import {lossBatch} from '../web/loss-data.mjs';
import {empty,validate,today} from '../web/store.mjs';

const meta={date:today(),actor:'測試人員',note:'每日使用'};
const line=(brand='科達',code='A001',qty=2)=>({row:{brand,category:'單方',code,drug:'測試藥品',bottles:999},qty,opening:5,id:brand+code,entryId:'loss-'+brand+code});
test('批次耗損扣除核對的期初量，不採原表瓶數；不同廠牌各自入帳',()=>{
 const original=empty(), next=lossBatch(original,[line(),line('天明')],meta);
 assert.equal(original.items.length,0);assert.equal(original.entries.length,0);
 assert.equal(next.entries.length,2);assert.equal(next.entries[0].type,'耗損');
 assert.equal(validate(next).balance('科達A001'),3);
 assert.equal(validate(next).balance('天明A001'),3);
});
test('既有品項沿用本機庫存；重送拒絕且錯帳可循原流水沖銷',()=>{
 const first=lossBatch(empty(),[line()],meta);
 const next=lossBatch(first,[{...line(),opening:999,entryId:'second',qty:0.5}],meta);
 assert.equal(next.items.length,1);assert.equal(validate(next).balance('科達A001'),2.5);
 assert.throws(()=>lossBatch(first,[line()],meta),/已登錄/);
});
test('任一筆不足則整批不修改，缺期初或無效數量不能登錄',()=>{
 const original=empty();
 assert.throws(()=>lossBatch(original,[line(),{...line('天明'),opening:1}],meta),/庫存不足/);
 assert.deepEqual(original,empty());
 for(const opening of ['',undefined,null])assert.throws(()=>lossBatch(original,[{...line(),opening}],meta),/實際瓶數/);
 for(const qty of [-1,0,NaN,Infinity,1.001])assert.throws(()=>lossBatch(original,[{...line(),qty}],meta));
});
test('拒絕編號／藥名衝突、重複品項、缺經手人與未來日期',()=>{
 const first=lossBatch(empty(),[line()],meta);
 assert.throws(()=>lossBatch(first,[{...line(),row:{...line().row,drug:'其他藥品'}}],meta),/不一致/);
 assert.throws(()=>lossBatch(empty(),[line(),line()],meta),/重複/);
 assert.throws(()=>lossBatch(empty(),[line()],{...meta,actor:''}));
 assert.throws(()=>lossBatch(empty(),[line()],{...meta,date:'2099-01-01'}));
});
