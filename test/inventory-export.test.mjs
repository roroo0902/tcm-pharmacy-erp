import test from 'node:test';
import assert from 'node:assert/strict';
import {exportInventory,selectInventory} from '../web/inventory-export.mjs';
const rows=Array.from({length:65},(_,i)=>({drug:'藥'+i,code:'A'+i,brand:i<60?'科達':'天明',category:i%2?'單方':'複方',bottles:i%3,stockRaw:String(i%3),unitPriceCents:12345,warning:i%5===0?'缺編號':'',updated:'1/24'}));
test('inventory export applies combined filters and all three views without truncation or mutation',()=>{
 const before=JSON.stringify(rows);assert.equal(exportInventory(rows,{status:'all'}).count,65);
 for(const status of ['all','zero','warning']){const f={brand:'科達',category:'單方',q:'A',status,sortKey:'bottles',sortDirection:'desc'};const selected=selectInventory(rows,f);assert.ok(selected.every(r=>r.brand==='科達'&&r.category==='單方'&&(status==='zero'?r.bottles===0:status==='warning'?!!r.warning:true)));assert.equal(exportInventory(rows,f).count,selected.length);assert.ok(selected.every((r,i)=>!i||selected[i-1].bottles>=r.bottles));}
 assert.equal(JSON.stringify(rows),before);assert.throws(()=>exportInventory(rows,{q:'不存在'}),/沒有符合/);
});
test('inventory workbook keeps missing values and price precision with real XLSX packaging',()=>{
 const f=exportInventory([{...rows[0],code:'00123',drug:'=1+1',bottles:null,stockRaw:'未盤點',unitPriceCents:undefined,priceRaw:'待報價',priceWarning:'格式待核對'}],{status:'warning'});const text=new TextDecoder().decode(f.bytes);assert.equal(text.slice(0,2),'PK');assert.ok(text.includes('00123')&&text.includes('未盤點')&&text.includes('待報價'));assert.ok(!text.includes('<f>'));assert.ok(text.includes('匯出條件'));const priced=new TextDecoder().decode(exportInventory(rows.slice(0,1)).bytes);assert.ok(priced.includes('<v>123.45</v>'));
});
