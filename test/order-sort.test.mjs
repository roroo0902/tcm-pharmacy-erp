import test from 'node:test';
import assert from 'node:assert/strict';
import {sortOrderRows,orderDateKey,ORDER_COLUMNS} from '../web/order-sort.mjs';
test('numeric values, natural codes, missing values and editable quantities',()=>{
 const rows=[{id:'a',code:'A10',stock:10},{id:'b',code:'A2',stock:2},{id:'c',code:'',stock:null}];
 assert.deepEqual(sortOrderRows(rows).map(r=>r.id),['b','a','c']);
 assert.deepEqual(sortOrderRows(rows,'stock','desc').map(r=>r.id),['a','b','c']);
 assert.deepEqual(sortOrderRows(rows,'quantity','asc',{quantities:{a:'12',b:'2'}}).map(r=>r.id),['b','a','c']);
 assert.deepEqual(rows.map(r=>r.id),['a','b','c']);
});
test('all numeric columns sort by number with blanks last in both directions',()=>{
 for(const key of ['legacy','quantity','suggested','usage','average','stock']){
 const rows=[{id:'a',code:'a',[key]:20},{id:'b',code:'b',[key]:3},{id:'c',code:'c',[key]:null}];
 const opts={quantities:{a:20,b:3},legacy:new Map([['a','20'],['b','3']])};
 assert.deepEqual(sortOrderRows(rows,key,'asc',opts).map(r=>r.id),['b','a','c']);
 assert.deepEqual(sortOrderRows(rows,key,'desc',opts).map(r=>r.id),['a','b','c']);
 }
 assert.equal(ORDER_COLUMNS.length,9);
});
test('dates respect full years and explicit reference year, reject invalid dates',()=>{
 assert.ok(orderDateKey('2025-12-31')<orderDateKey('2026-01-01'));
 assert.equal(orderDateKey('1/9','2026-11-01'),orderDateKey('2026-01-09'));
 assert.equal(orderDateKey('2/30','2026-11-01'),null);
});
test('shortage rates use numeric percentage and marked-only rows have defined rank',()=>{
 const rows=[{shortage:'100%'},{shortage:'9%'},{shortage:'',status:'v'},{shortage:''}];
 assert.deepEqual(sortOrderRows(rows,'shortage','asc'),[rows[1],rows[0],rows[2],rows[3]]);
});
