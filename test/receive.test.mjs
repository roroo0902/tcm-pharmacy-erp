import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveBatch} from '../web/receive-data.mjs';
import {empty,validate,today} from '../web/store.mjs';
const meta={date:today(),actor:'測試',note:'本機測試'};
const line=(code='A001',brand='科達')=>({row:{code,drug:'測試藥品',brand,category:'單方'},qty:3,opening:7,id:brand+code,entryId:'entry'+brand+code});
test('批次進貨保留核對後期初量、不同廠商獨立且不改原資料',()=>{const original=empty();const next=receiveBatch(original,[line(),line('A001','天明')],meta);assert.equal(original.items.length,0);assert.equal(next.entries.length,2);assert.equal(validate(next).balance('科達A001'),10);});
test('既有品項沿用本機庫存；相同批次不能重送',()=>{const a=receiveBatch(empty(),[line()],meta);const second={...line(),opening:99,entryId:'second'};const b=receiveBatch(a,[second],meta);assert.equal(b.items.length,1);assert.equal(validate(b).balance('科達A001'),13);assert.throws(()=>receiveBatch(b,[second],meta),/已登錄/);});
test('重複編號、品名衝突、無效量和日期整批拒絕',()=>{assert.throws(()=>receiveBatch(empty(),[line(),line()],meta),/重複/);const a=receiveBatch(empty(),[line()],meta);const bad={...line(),row:{...line().row,drug:'不同品名'}};assert.throws(()=>receiveBatch(a,[bad],meta),/不一致/);for(const qty of [-1,NaN,1.001])assert.throws(()=>receiveBatch(empty(),[{...line(),qty}],meta));assert.throws(()=>receiveBatch(empty(),[line()],{...meta,date:'2099-01-01'}));assert.equal(a.entries.length,1);});
