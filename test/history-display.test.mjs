import test from 'node:test';import assert from 'node:assert/strict';import {historyEntries,renderHistory} from '../web/history-display.mjs';
const s={title:'建檔／進貨',id:'sheet',gid:1};
const row=(id,action,extra={})=>{const d={id,action,date:'2026-11-03',actor:'甲',note:'',lines:[{sheet:'科達單方',code:'A001',name:'藥品',quantity:2}],...extra};return [id,JSON.stringify({draft:d}),d.date,action,d.actor,d.note,'摘要',action==='訂貨'?'待發送・未入庫':action==='取消訂貨'?'已取消・未發送':'已入帳','2026-11-03T01:00:00Z'];};
test('all transaction types use separate readable labels and do not mutate source',()=>{const input=[{s,rows:[row('reg','建檔'),row('in','進貨'),row('order','訂貨'),row('reverse','沖銷',{reverses:'in'}),row('cancel','取消訂貨',{reverses:'order'})]}],before=JSON.stringify(input),e=historyEntries(input);assert.equal(e.find(x=>x.id==='reg').type,'建帳');assert.equal(e.find(x=>x.id==='cancel').label,'訂貨取消');assert.equal(e.find(x=>x.id==='reverse').label,'進貨沖銷');assert.equal(e.find(x=>x.id==='in').status,'這筆進貨已沖銷');assert.equal(e.find(x=>x.id==='in').canReverse,false);assert.equal(e.find(x=>x.id==='order').canReverse,false);assert.equal(JSON.stringify(input),before);});
test('loss uses operator not drug code; distinguishes deduction, correction, zero, invalid',()=>{for(const [v,text] of [[2,'扣除 2 瓶'],[-2,'更正累計，加回 2 瓶'],[0,'累計相同，未增減庫存'],['','耗損差額待核對']]){const e=historyEntries([{s:{...s,title:'耗損'},rows:[['hash','{}','2026-11-03','科達單方','A1','藥品',1,3,v,7,'原因','經手人乙','account','time']]}])[0];assert.equal(e.actor,'經手人乙');assert.equal(e.status,text);}});
test('test marks derive from explicit QA fields and inherit to reversals, never imply restored',()=>{const e=historyEntries([{s,rows:[row('real','進貨'),row('qa','進貨',{lines:[{code:'QA-ALL-20261031',quantity:10}]}),row('rev','沖銷',{reverses:'qa'}),row('note','建檔',{note:'系統測試'})]}]);assert.equal(e.find(x=>x.id==='real').marked,false);assert.equal(e.filter(x=>x.marked).length,3);assert.match(renderHistory(e),/標記本身不代表已還原/);assert.match(renderHistory(e,{test:'測試'}),/顯示 3 筆/);assert.match(renderHistory(e,{type:'建帳'}),/顯示 1 筆/);});
test('identifiers and original references only appear inside closed details',()=>{const h=renderHistory(historyEntries([{s,rows:[row('ERP-secret','沖銷',{reverses:'ERP-original'})]}]));assert.match(h,/<details><summary>查看明細<\/summary>.*ERP-secret.*ERP-original.*<\/details>/);assert.doesNotMatch(h,/<details open/);assert.doesNotMatch(h.replace(/<details>.*?<\/details>/g,''),/ERP-secret|ERP-original/);});
test('malformed records remain visible without action controls and user fields escaped',()=>{const e=historyEntries([{s,rows:[['BAD','invalid','2026-11-03','進貨','<script>','','<img>','已入帳','']]}]);const h=renderHistory(e);assert.match(h,/內容待核對/);assert.doesNotMatch(h,/data-reverse|<script>|<img>/);assert.match(h,/&lt;img&gt;/);});
test('empty, filtering and multiple item summaries remain clear',()=>{assert.match(renderHistory([]),/沒有符合條件/);const lines=Array.from({length:5},(_,i)=>({code:'A'+i,name:'藥品'+i,quantity:1}));const h=renderHistory(historyEntries([{s,rows:[row('multi','訂貨',{lines})]}]));assert.match(h,/另有 2 項/);assert.match(h,/尚未入庫/);});
test('split columns keep each product with its historical supplier and quantity, with one transaction action',()=>{
 const lines=[{sheet:'科達單方',code:'A01',name:'第一品項',quantity:2},{sheet:'其他廠商複方',code:'B02',name:'第二品項',quantity:7},{sheet:'歷史未分類工作表',code:'C03',name:'第三品項',quantity:0}];
 const h=renderHistory(historyEntries([{s,rows:[row('multi','進貨',{lines})]}]));
 const rows=[...h.matchAll(/<tr class="history-item-row">(.*?)<\/tr>/g)].map(m=>m[1]);
 assert.equal(rows.length,3);assert.match(rows[0],/第一品項.*A01.*科達.*單方.*進貨 2 瓶/);assert.match(rows[1],/第二品項.*B02.*其他廠商.*複方.*進貨 7 瓶/);assert.match(rows[2],/第三品項.*歷史未分類工作表.*未記錄.*進貨 0 瓶/);
 assert.equal((h.match(/data-reverse=/g)||[]).length,1);assert.match(h,/rowspan="3"/);assert.match(h,/>藥品／編號<.*>廠牌／類別<.*>數量／本次進貨</);
});
test('loss quantity retains before and after totals and escaped supplier fields',()=>{
 const e=historyEntries([{s:{...s,title:'耗損'},rows:[['loss','{}','2026-11-03','<img>複方','A1','藥品',3,0,-3,7,'更正','甲','','time']]}]);
 const h=renderHistory(e);assert.match(h,/當日累計：3 → 0 瓶/);assert.match(h,/&lt;img&gt;/);assert.doesNotMatch(h,/<img>/);assert.match(h,/加回 3 瓶/);
});
test('receipt history uses transaction snapshots and the same execution explanation as Sheets',async()=>{
 const {receiptExplanation}=await import('../src/receipt-explanation.mjs');
 const r=row('receipt','進貨',{lines:[{sheet:'科達單方',code:'A01',name:'品項甲',quantity:2,unitPriceCents:26000},{sheet:'科達單方',code:'A02',name:'品項乙',quantity:1}]});
 const event=JSON.parse(r[1]);event.lines=[{...event.draft.lines[0],before:8,after:10},{...event.draft.lines[1],before:0,after:1}];r[1]=JSON.stringify(event);
 const h=renderHistory(historyEntries([{s,rows:[r]}]));
 assert.match(h,/>8 瓶<\/td><td>10 瓶<\/td><td>260 元／瓶<\/td><td>520 元/);
 assert.match(h,/單價未提供/);assert.match(h,/小計未計算/);
 assert.ok(h.includes(receiptExplanation(event).text.replaceAll('\n','<br>')));
 assert.match(h,/入庫前後瓶數為本次交易當時的紀錄/);
});
test('legacy receipt history never fabricates before or after stock',()=>{
 const h=renderHistory(historyEntries([{s,rows:[row('old','進貨')]}]));
 assert.match(h,/>未記錄<\/td><td>未記錄<\/td>/);
 assert.match(h,/入庫前庫存：未記錄 → 入庫後庫存：未記錄/);
});
