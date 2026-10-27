import test from 'node:test';import assert from 'node:assert/strict';import {csvRows,parseSheet,SOURCES} from '../web/sheets-data.mjs';
const header='屯藥,編號,點藥,藥品名稱,價格,備貨量,備貨量\n,編號,時間,,,時間,未拆封\n';
test('CSV支援引號逗號換行與BOM',()=>assert.deepEqual(csvRows('\uFEFF"a,b","x""y"\r\n"a\nb",z'),[['a,b','x"y'],['a\nb','z']]));
test('雲端瓶數以G欄為準，空白不轉0，不採H欄',()=>{const r=parseSheet(header+',A1,,測試,100,1/25,0,99\n,A2,,測試2,100,1/25,,88\n,A3,,測試3,100,1/25,0無',SOURCES[0]);assert.equal(r[0].bottles,0);assert.equal(r[1].bottles,null);assert.equal(r[2].bottles,null);assert.equal(r[0].updated,'1/25');});
test('不合併重複代碼，保留來源列並標記',()=>{const r=parseSheet(header+',A1,,測試,,,2\n,A1,,測試2,,,3',SOURCES[0]);assert.equal(r.length,2);assert.equal(r[1].row,4);assert.match(r[1].warning,/重複/);});
test('欄位變動、登入HTML或截斷CSV拒絕讀入',()=>{assert.throws(()=>parseSheet('<html>登入</html>',SOURCES[0]),/欄位/);assert.throws(()=>csvRows('"unfinished'),/不完整/);});
