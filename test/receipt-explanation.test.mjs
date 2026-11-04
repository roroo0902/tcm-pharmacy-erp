import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptExplanation} from '../src/receipt-explanation.mjs';
import {operationResult} from '../web/operation-result.mjs';
const l={sheet:'科達單方',code:'A151',name:'桔實（實）',quantity:2,unitPriceCents:26000};
const draft={action:'進貨',id:'ERP-example-123',date:'2026-11-04',actor:'測試',note:'',lines:[l]};
const event={draft,lines:[{...l,before:8,after:10}],time:'2026-11-04T02:00:00Z'};
test('receipt statement uses recorded transaction balances and exact money',()=>{
 const before=JSON.stringify(event),r=receiptExplanation(event);
 assert.match(r.text,/本次進貨：2 瓶/);assert.match(r.text,/8 瓶 → 入庫後庫存：10 瓶/);
 assert.match(r.text,/260 元／瓶/);assert.match(r.text,/520 元/);assert.equal(JSON.stringify(event),before);
});
test('missing price is distinct from free and historical missing balance stays unknown',()=>{
 const r=receiptExplanation({draft:{...draft,lines:[{...l,unitPriceCents:0},{...l,code:'A2',unitPriceCents:undefined}]},lines:[]});
 assert.equal(r.lines[0].priceText,'0 元／瓶');assert.equal(r.lines[1].amountText,'小計未計算');assert.match(r.totalText,/已提供單價品項合計 0 元（1 項未計價）/);assert.equal(r.lines[0].beforeText,'未記錄');
 assert.equal(receiptExplanation(draft).lines[0].afterText,'未記錄');
});
test('mismatched saved item does not supply historical stock',()=>{
 const r=receiptExplanation({...event,lines:[{...event.lines[0],name:'別的藥品'}]});assert.equal(r.lines[0].beforeText,'未記錄');
});
test('verified receipt shows readable detail, timestamp and escaped fields',()=>{
 const h=operationResult({...draft,verified:true,receiptEvent:event},'receipt');
 for(const text of ['本次進貨已入庫，並完成核對','查看本次進貨紀錄','8 瓶','10 瓶','520 元','備註：無','紀錄位置：藥庫_同步紀錄','入帳時間：'])assert.ok(h.includes(text),text);
 assert.doesNotMatch(operationResult({...draft,actor:'<script>',verified:true},'receipt'),/<script>/);
});
