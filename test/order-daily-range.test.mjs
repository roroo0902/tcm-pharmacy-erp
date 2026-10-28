import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyExportUrl,SOURCES,csvRows} from '../web/sheets-data.mjs';
import {calculateOrderRows} from '../src/orders.mjs';

test('訂貨匯出涵蓋 BC 之後新加的每日欄，缺欄與真實零耗損分開',()=>{
 const url=new URL(dailyExportUrl(SOURCES[0]));
 assert.equal(url.searchParams.get('gid'),String(SOURCES[0].gid));
 const range=url.searchParams.get('range');
 const end=range.match(/:([A-Z]+)\d+$/)[1].split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
 const options={start:'2026-10-28',end:'2026-10-28',ignore:[],targetDays:7,shippingDays:0,holidayDays:0,blankAsZero:false};
 for(const col of [55,56,100]){
  const grid=Array.from({length:3},()=>Array(col+1).fill(''));
  grid[0][1]='編號';grid[0][3]='藥品名稱';grid[1][6]='未拆封';
  grid[0][col]='2026/10/28';grid[1][col]='三';
  grid[2][1]='QA';grid[2][3]='合成測試';grid[2][6]='2';grid[2][col]='1';
  const csv=grid.map(r=>r.slice(0,end).join(',')).join('\n');
  const actual=calculateOrderRows(csvRows(csv),SOURCES[0],options);
  assert.deepEqual(actual.missing,[]);
  assert.equal(actual.rows[0].usage,1);
  assert.equal(actual.rows[0].suggested,5);
  const old=calculateOrderRows(grid.map(r=>r.slice(0,55)),SOURCES[0],options);
  assert.deepEqual(old.missing,['2026-10-28']);
  assert.equal(old.rows[0].suggested,null);
 }
});
