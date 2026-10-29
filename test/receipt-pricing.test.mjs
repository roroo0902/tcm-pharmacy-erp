import test from 'node:test';
import assert from 'node:assert/strict';
import {priceCents,sheetPrice,pricingTotal} from '../web/receipt-pricing.mjs';
import {receiptKey,receiptPrice,receiptLines} from '../web/receive-grid-data.mjs';
import {cloudDraft,cloudPlan} from '../src/cloud-transaction.mjs';
const line={sheet:'科達單方',code:'QA',name:'測試品',quantity:3,unitPriceCents:18025};
const input={kind:'tcm-cloud',version:2,currency:'TWD',id:'ERP-price-123456',action:'進貨',date:'2026-10-29',actor:'QA',note:'測試',lines:[line]};
const stock={...line,stock:5,row:2,sheetId:1,price:180,priceFormula:''};
test('prices distinguish blank/zero and parse currency without floating point cents',()=>{
 assert.equal(priceCents(''),undefined);assert.equal(priceCents('0'),0);assert.equal(priceCents('180.25'),18025);
 assert.deepEqual(sheetPrice('NT$ 1,280.25'),{unitPriceCents:128025});
 for(const v of ['-1','1.001','NaN','1e3','1,80','1000001'])assert.ok(sheetPrice(v).priceWarning);
 assert.deepEqual(pricingTotal([{quantity:3,unitPriceCents:18025},{quantity:1},{quantity:2,unitPriceCents:0}]),{cents:54075,missing:1});
});
test('source E price defaults refresh, overrides persist, blank suppresses update and malformed source blocks',()=>{
 const r={name:line.sheet,code:'QA',drug:line.name,bottles:5,unitPriceCents:80000},key=receiptKey(r),q=new Map([[key,'3']]),prices=new Map();
 assert.equal(receiptLines([r],q)[0].unitPriceCents,80000);
 assert.equal(receiptPrice({...r,unitPriceCents:90000},prices),'900.00');
 prices.set(key,'180.25');assert.equal(receiptLines([{...r,unitPriceCents:90000}],q,prices)[0].unitPriceCents,18025);
 prices.set(key,'');assert.equal(receiptLines([r],q,prices)[0].unitPriceCents,undefined);
 assert.throws(()=>receiptLines([{...r,priceWarning:'格式錯誤'}],q));
 prices.set(key,'0');assert.equal(receiptLines([{...r,priceWarning:'格式錯誤'}],q,prices)[0].unitPriceCents,0);
});
test('priced receipt computes cents, records E before/after, rejects formulas and keeps reversal master price unchanged',()=>{
 const d=cloudDraft(input),plan=cloudPlan(d,[stock]);
 assert.equal(plan.lines[0].amountCents,54075);assert.equal(plan.lines[0].priceBefore,180);assert.equal(plan.lines[0].priceAfter,180.25);assert.equal(plan.lines[0].after,8);
 assert.throws(()=>cloudPlan(d,[{...stock,priceFormula:'=1'}]),/公式/);
 const event={draft:d,lines:plan.lines},reverse=cloudDraft({...d,id:'ERP-reversal-12345',action:'沖銷',reverses:d.id,note:'取消'});
 const reversed=cloudPlan(reverse,[{...stock,stock:8,price:200}],[event]).lines[0];
 assert.equal(reversed.after,5);assert.equal(reversed.unitPriceCents,18025);assert.equal(reversed.priceAfter,undefined);
 assert.equal(cloudPlan(d,[stock],[event]).duplicate,true);
 assert.throws(()=>cloudPlan(cloudDraft({...input,lines:[{...line,unitPriceCents:100}]}),[stock],[event]),/內容不同/);
});
test('backend rejects malformed price and unsafe totals, recomputes amounts and keeps v1 old draft unchanged',()=>{
 for(const v of [-1,0.1,'180',null,100000001])assert.throws(()=>cloudDraft({...input,lines:[{...line,unitPriceCents:v}]}));
 assert.throws(()=>cloudDraft({...input,version:1}));
 assert.throws(()=>cloudDraft({...input,lines:Array.from({length:100},(_,i)=>({...line,code:'QA'+i,quantity:1000000,unitPriceCents:100000000}))}));
 const d=cloudDraft({...input,lines:[{...line,amountCents:1}]});assert.equal(cloudPlan(d,[stock]).lines[0].amountCents,54075);
 const old={...input,version:1};delete old.currency;delete (old.lines=[{...line}])[0].unitPriceCents;
 assert.deepEqual(cloudDraft(old),old);assert.equal(cloudPlan(cloudDraft(old),[stock]).lines[0].priceAfter,undefined);
});
