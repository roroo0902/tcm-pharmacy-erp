import test from 'node:test';import assert from 'node:assert/strict';import {sortSheetRows} from '../web/sheets-sort.mjs';
test('編號依數字排序，空白在兩個方向都置底且不改原陣列',()=>{const r=[{code:'A10'},{code:''},{code:'A2'}];assert.deepEqual(sortSheetRows(r).map(x=>x.code),['A2','A10','']);assert.deepEqual(sortSheetRows(r,'code','desc').map(x=>x.code),['A10','A2','']);assert.equal(r[0].code,'A10');});
test('瓶數包含負數、零及小數，缺值始終在最後',()=>{const r=[null,10,0,-2,1.5].map(bottles=>({bottles}));assert.deepEqual(sortSheetRows(r,'bottles').map(x=>x.bottles),[-2,0,1.5,10,null]);assert.deepEqual(sortSheetRows(r,'bottles','desc').map(x=>x.bottles),[10,1.5,0,-2,null]);});
test('日期按月日而非文字排序，空白與無效日期置底',()=>{const r=['12/30','2/9','','1/25','2/30'].map(updated=>({updated}));assert.deepEqual(sortSheetRows(r,'updated').map(x=>x.updated),['1/25','2/9','12/30','','2/30']);assert.deepEqual(sortSheetRows(r,'updated','desc').map(x=>x.updated),['12/30','2/9','1/25','','2/30']);});
test('all overview columns sort values with missing entries last',()=>{
 for(const [key,field,values,expected] of [['price','unitPriceCents',[1000,0,200,undefined],[0,200,1000,undefined]],['shortage','shortage',['100%','9%','50%','oops',''],['9%','50%','100%','oops','']],['drug','drug',['藥10','藥2',''],['藥2','藥10','']],['warning','warning',['缺編號','','未填庫存'],['未填庫存','缺編號','']]]){
 const rows=values.map(v=>({[field]:v}));assert.deepEqual(sortSheetRows(rows,key).map(r=>r[field]),expected);
 const sorted=sortSheetRows(rows,key,'desc');assert.equal(sorted.at(-1)[field],expected.at(-1));
 }
 const r=[{brand:'B',category:'單方'},{brand:'A',category:'複方'},{brand:'A',category:'單方'}];assert.deepEqual(sortSheetRows(r,'brand').map(x=>x.brand+x.category),['A單方','A複方','B單方']);
 assert.deepEqual(sortSheetRows([{stockout:''},{stockout:'v'}],'stockout','desc').map(x=>x.stockout),['v','']);
});
test('overview full dates respect year and month-only dates use explicit reference year',()=>{const r=['2025/12/31','1/2','2027/1/1','2/29'].map(updated=>({updated}));assert.deepEqual(sortSheetRows(r,'updated','asc',2026).map(x=>x.updated),['2025/12/31','1/2','2027/1/1','2/29']);});
