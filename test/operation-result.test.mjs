import test from 'node:test';import assert from 'node:assert/strict';import {operationResult,checkLossResult} from '../web/operation-result.mjs';
const d={kind:'tcm-loss-cumulative',version:3,date:'2026-11-03',actor:'驗收',lines:[{sheet:'科達單方',code:'A001',name:'藥品',total:2}]};const p={id:'LOSS-TEST',draft:d,verified:false};
for(const action of ['訂貨','建檔','沖銷'])test('receipt hides unrelated completed '+action,()=>{const x={id:'ERP-OTHER',action,verified:true,lines:[]},before=JSON.stringify(x);assert.doesNotMatch(operationResult(x,'receipt'),/ERP-OTHER|receipt-resume/);assert.equal(JSON.stringify(x),before);});
test('unrelated unresolved receipt operation retains lookup but no retry',()=>{const h=operationResult({action:'沖銷',id:'OTHER'},'receipt');assert.match(h,/receipt-check/);assert.doesNotMatch(h,/receipt-resume|receipt-edit|OTHER/);});
test('pending receipt details are collapsed and leave recovery to the form action',()=>{
 const receipt={id:'ERP-TEST',action:'進貨',date:d.date,actor:d.actor,lines:[{...d.lines[0],quantity:2}]};
 const html=operationResult(receipt,'receipt',receipt.id);
 assert.match(html,/<details><summary>查看上一筆進貨明細<\/summary>.*ERP-TEST.*進貨 2 瓶.*<\/details>/);
 assert.doesNotMatch(html,/<button|<details open/);
 assert.doesNotMatch(operationResult({...receipt,verified:true},'receipt',receipt.id),/<details>/);
});
test('loss keeps its retry only while pending and hides identifiers in closed details',()=>{
 const html=operationResult(p,'loss',p.id);
 assert.match(html,/<details><summary>查看交易明細/);
 assert.match(html,/loss-resume/);
 assert.doesNotMatch(html,/<details open|核對完成|核對一致/);
 const verified={...p,verified:true};
 assert.doesNotMatch(operationResult(verified,'loss'),/loss-resume/);
 assert.doesNotMatch(operationResult(verified,'loss',p.id),/<details>/);
});
test('loss requires complete exact date, identity and totals, including zero',()=>{const row={...d.lines[0],posted:2,error:''};assert.equal(checkLossResult(d,{date:d.date,loss:[row]}),true);for(const loss of [[],[row,row],[{...row,posted:1}],[{...row,posted:null}],[{...row,name:'不同'}],[{...row,error:'待核對'}]])assert.throws(()=>checkLossResult(d,{date:d.date,loss}));assert.throws(()=>checkLossResult(d,{date:'2026-11-02',loss:[row]}));assert.equal(checkLossResult({...d,lines:[{...d.lines[0],total:0}]},{date:d.date,loss:[{...row,posted:0}]}),true);});
test('display escapes fields and does not mutate drafts',()=>{const x={...p,draft:{...d,actor:'<script>',reason:'<img>'}},before=JSON.stringify(x);assert.doesNotMatch(operationResult(x,'loss'),/<script>|<img>/);assert.equal(JSON.stringify(x),before);});
