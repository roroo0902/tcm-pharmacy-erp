import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cloudDraft} from '../src/cloud-transaction.mjs';
import {orderKey,orderLines} from '../web/order-grid-data.mjs';
import {mergeUnpostedOrders} from '../web/order-merge-draft.mjs';

const source=readFileSync(new URL('../web/order-grid.mjs',import.meta.url),'utf8');
function section(start,end){
 const first=source.indexOf(start),last=source.indexOf(end,first);
 assert.ok(first>=0&&last>first);
 return source.slice(first,last);
}
const date='2026-11-26',actor='測試員';
const previous=cloudDraft({kind:'tcm-cloud',version:2,currency:'TWD',id:'ERP-previous-order',action:'訂貨',date,actor,note:'',
 lines:[{sheet:'科達單方',code:'P',name:'上一筆',quantity:2,unitPriceCents:12000}]});
const manual={sheet:'其他廠商複方',code:'',name:'手動品項',quantity:3,manual:true,unitPriceCents:0};

function orderForm(initial=null){
 let raw=initial===null?null:JSON.stringify(initial),uuid=0,resubmitting;
 const rows=['科達單方','天明複方','富田單方'].map((name,i)=>({name,code:'A1',drug:'測試藥'+i,bottles:10,unitPriceCents:20000}));
 const quantities=new Map([[orderKey(rows[0]),'2'],[orderKey(rows[1]),'3']]);
 // Include a price-only edit on a third sheet. It must survive returning even though it has no order line.
 const prices=new Map([[orderKey(rows[0]),'12.75'],[orderKey(rows[1]),'0'],[orderKey(rows[2]),'98.10']]);
 const nodes=new Map(),writes=[],posted=[],previews=[],events=new Map(),recoveries=[];
 const $=id=>{
  if(!nodes.has(id))nodes.set(id,{value:id==='#og-date'?date:id==='#og-actor'?actor:'',focus(){},requestSubmit(){resubmitting=this.onsubmit({preventDefault(){}});}});
  return nodes.get(id);
 };
 const noop=()=>{};
 const deps={
  $,rows,quantities,prices,manualLines:[],alive:true,busy:false,loadFailed:false,recoveringPrevious:false,
  orderKey,orderLines,cloudDraft,mergeUnpostedOrders,shortageLinks:()=>[],clearShortage:noop,
  directReview:(draft,ask,success,status,options)=>previews.push({draft,options,back:options.onReturn,
   post:async(loseReply=false)=>{await options.beforeCommit(draft);posted.push(draft);events.set(draft.id,{draft});if(!loseReply)await success();}}),
  KEY:'pending',localStorage:{getItem:()=>raw,setItem:(_,value)=>{raw=value;writes.push(value);}},
  directLog:()=>assert.fail(),openExistingOrderMail:noop,orderPrintControl:()=>'',bindOrderPrint:noop,orderRpc:async()=>({state:'unsent'}),
  esc:String,ask:noop,status:noop,draw:noop,summary:noop,load:async()=>{},isProcessing:()=>false,beginProcessing:()=>({close:noop}),
  chooseOrderFollowup:async()=> 'merge',lookupPostedTransaction:async d=>events.get(d.id)||null,orderMergeTable:()=>'',
  recoverPendingTransaction:async o=>{const current=JSON.parse(raw),event=events.get(current.id);recoveries.push(current.id);
   if(event){raw=JSON.stringify({...event.draft,verified:true});await o.onResolved({alreadyPosted:true,posted:event.draft});}},
  crypto:{randomUUID:()=> 'test-order-'+(++uuid)}
 };
 const src=section(' function allLines()',' function manualList()')+
  section(' const recoveryStatus=',' $(\'#order-brands\').onclick')+
  section(" $('#order-grid-form').onsubmit=",' const stopWordAxis=');
 const api=new Function(...Object.keys(deps),src+'\nreturn {allLines};')(...Object.values(deps));
 return {api,$,rows,quantities,prices,previews,writes,posted,recoveries,storage:()=>raw,
  swap:v=>{raw=JSON.stringify(v);},
  submit:async()=>{await $('#order-grid-form').onsubmit({preventDefault(){}});if(resubmitting)await resubmitting;}};
}

test('return preserves date, employee, cross-sheet prices and quantities including manual preview additions',async()=>{
 for(const initial of [null,{...previous,verified:true}]){
  const f=orderForm(initial),baseline=f.storage();
  await f.submit();const first=f.previews[0];
  first.options.onOrderAdd(manual);
  first.options.onOrderDraft({...first.draft,lines:[...first.draft.lines,manual]});
  assert.throws(()=>first.options.beforeCommit(first.draft),/內容已變更/);
  first.back();
  assert.equal(f.$('#og-date').value,date);assert.equal(f.$('#og-actor').value,actor);
  assert.deepEqual([...f.prices.values()],['12.75','0','98.10']);
  assert.deepEqual(f.api.allLines().map(l=>[l.sheet,l.quantity,l.unitPriceCents]),[
   ['科達單方',2,1275],['天明複方',3,0],['其他廠商複方',3,0]]);
  assert.equal(f.storage(),baseline);assert.equal(f.writes.length,0);
  await assert.rejects(()=>first.post(),/狀態已變更/);
  assert.throws(()=>first.options.onOrderAdd(manual),/狀態已變更/);
  f.quantities.set(orderKey(f.rows[0]),'4');await f.submit();
  const next=f.previews[1];assert.equal(next.draft.lines[0].quantity,4);
  assert.equal(next.draft.actor,actor);assert.equal(next.draft.date,date);
  await next.post();await assert.rejects(()=>next.post(),/狀態已變更/);
  assert.equal(f.posted.length,1);assert.equal(f.posted[0].lines.length,3);
  assert.deepEqual(f.rows.map(r=>r.bottles),[10,10,10]);
 }
});

test('return from a merged preview preserves the pending original and edits only the current input',async()=>{
 const f=orderForm(previous),baseline=f.storage();
 await f.submit();const combined=f.previews[0];
 assert.equal(combined.draft.id,previous.id);assert.equal(combined.draft.lines.length,3);
 combined.back();
 assert.equal(f.storage(),baseline);assert.equal(f.api.allLines().length,2);
 assert.equal(f.prices.get(orderKey(f.rows[2])),'98.10');
 await assert.rejects(()=>combined.post(),/狀態已變更/);
 f.quantities.set(orderKey(f.rows[0]),'6');await f.submit();await f.previews[1].post();
 assert.equal(f.posted.length,1);assert.equal(f.posted[0].id,previous.id);
 assert.deepEqual(f.posted[0].lines.map(l=>l.quantity),[2,6,3]);
});

test('a changed pending transaction stays intact, and uncertain input rechecks the same submitted order',async()=>{
 const f=orderForm();await f.submit();const old=f.previews[0];
 f.swap(previous);old.back();await assert.rejects(()=>old.post(),/狀態已變更/);
 assert.deepEqual(JSON.parse(f.storage()),previous);assert.equal(f.writes.length,0);
 const uncertain=orderForm();await uncertain.submit();const live=uncertain.previews[0];
 await live.post(true);live.back();await assert.rejects(()=>live.post(),/狀態已變更/);
 await uncertain.submit();
 assert.deepEqual(uncertain.recoveries,[live.draft.id]);assert.equal(uncertain.posted.length,1);
 assert.equal(uncertain.previews.length,1);assert.equal(JSON.parse(uncertain.storage()).verified,true);
 assert.equal(uncertain.api.allLines().length,0);
});

test('after an uncertain submit, changing quantity or price never merges the same form into its pending order',async()=>{
 for(const initial of [null,previous]){
  const f=orderForm(initial);await f.submit();const preview=f.previews[0];
  await preview.post(true);
  f.quantities.set(orderKey(f.rows[0]),'9');f.prices.set(orderKey(f.rows[0]),'0.50');
  await f.submit();
  assert.equal(f.previews.length,1);assert.equal(f.posted.length,1);
  assert.deepEqual(f.recoveries,[preview.draft.id]);assert.equal(JSON.parse(f.storage()).verified,true);
  assert.deepEqual(f.api.allLines().map(l=>[l.quantity,l.unitPriceCents]),[[9,50],[3,0]]);
  assert.match(f.$('#og-recovery-status').textContent,/已讀回原交易.*修改已保留/);
 }
});
