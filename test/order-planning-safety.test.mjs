import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as pricing from '../web/receipt-pricing.mjs';
import * as orders from '../src/orders.mjs';
import {cloudDraft} from '../src/cloud-transaction.mjs';
import {lossOrderEntries} from '../web/loss-order-fill.mjs';
import * as sort from '../web/order-sort.mjs';
import {protectDraft} from '../web/page-safety.mjs';

const code='QA20261120A', date='2026-01-19';
const source={name:'科達單方',brand:'科達',category:'單方'};
const options={start:date,end:date,ignore:[],targetDays:7,shippingDays:0,holidayDays:0,blankAsZero:false};
function grid(loss='1'){
 const h=Array(14).fill(''),b=[...h];
 h[1]='編號';h[3]='藥品名稱';h[13]='1/19';b[6]='未拆封';b[13]='一';
 return [h,b,...[[code,'ERP驗收專用・非藥品'],['NORMAL','普通品項'],['KEEP','人工保留']].map(([c,n])=>{
  const r=Array(14).fill('');r[1]=c;r[3]=n;r[6]='0';r[13]=loss;return r;
 })];
}
test('exact QA item is searchable but has no batch suggestion or operational draft; other supplier stays normal',()=>{
 const snapshot=orders.calculateOrderRows(grid(),source,options),[qa,regular]=snapshot.rows;
 assert.deepEqual([qa.code,qa.suggested,regular.suggested],[code,null,7]);
 assert.match(qa.warnings.join(),/驗收專用/);
 assert.throws(()=>orders.makeOrder(snapshot,{[qa.id]:'1',[regular.id]:'1'},'QA',true,'QA','now'),/請清除營運訂量/);
 assert.equal(orders.makeOrder(snapshot,{[qa.id]:'0',[regular.id]:'1'},'QA',true,'QA','now').lines.length,1);
 assert.equal(orders.calculateOrderRows(grid(),{...source,name:'天明單方'},options).rows[0].suggested,7);
});
test('automatic loss fill excludes only exact QA supplier and SKU',()=>{
 const base={...source,drug:'測試',code,periodLoss:4};
 const normal={...base,code:'NORMAL',periodLoss:2};
 const crossSupplier={...base,name:'天明單方',brand:'天明',periodLoss:3};
 assert.deepEqual(lossOrderEntries([base,normal,crossSupplier],'科達','單方').map(x=>x[1]),['2']);
 assert.deepEqual(lossOrderEntries([base,normal,crossSupplier],'天明','單方').map(x=>x[1]),['3']);
});

const codeBody=(await readFile(new URL('../web/orders.mjs',import.meta.url),'utf8')).replace(/^import .+\n/gm,'').replace(/^export /gm,'');
function mountHarness({historical=[], directReview}={}){
 const nodes=new Map(),store=new Map(),modals=[];
 const values={'#order-start':date,'#order-end':date,'#order-days':'7','#order-shipping':'0','#order-holiday':'0','#order-actor':'QA'};
 const $=(selector)=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',value:values[selector]??'',checked:false,showModal(){this.open=true;},close(){this.open=false;},listeners:{},addEventListener(ev,cb){this.listeners[ev]=cb;}});return nodes.get(selector);};
 store.set('tcm-purchase-v2',JSON.stringify({drafts:{},orders:historical}));
 const host=$('#content'),baseGrid=grid();let reply=async()=>({values:baseGrid});
 host.querySelector=$;
 host.querySelectorAll=(selector)=>{
  const datasetKey={'[data-send]':'send','[data-clear-order]':'clearOrder'}[selector];
  if(datasetKey)return JSON.parse(store.get('tcm-purchase-v2')).orders.map(o=>{
   const button=$(datasetKey+':'+o.id);button.dataset={[datasetKey]:o.id};return button;
  });
  if(selector!=='[data-qty]')return [];
  return [...$('#order-table').innerHTML.matchAll(/data-qty="([^"]+)"[^>]*value="([^"]*)"/g)].map(m=>{
   const node=$('qty:'+m[1]);node.dataset={qty:m[1]};node.value=m[2];return node;
  });
 };
 const deps={...pricing,...orders,...sort,protectDraft,document:{querySelector:$},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},navigator:{locks:{request:async(_k,f)=>f()}},planningLayout:'',installPlanningMobile:()=>{},
  SOURCES:[source],ORDER_ENDPOINT:'fixture-disabled',today:()=>date,SHEET_ID:'other',cloudDraft,directReview,directEnabled:()=>Boolean(directReview),
  fetch:async()=>({ok:true,headers:{get:()=> 'text/csv'},text:async()=>''}),csvRows:()=>[['','編號']],
  runDirect:(name)=>{assert.equal(name,'readLossPlanning');return reply();}};
 const mount=new Function(...Object.keys(deps),codeBody+'\nreturn mountOrders;')(...Object.values(deps));
 const unmount=mount({esc:String,fmt:String,ask:(html,run,confirmLabel,cancelLabel)=>modals.push({html,run,confirmLabel,cancelLabel})});
 return {$,modals,store,unmount,reply:f=>{reply=f;}};
}
test('real planning handlers block stale apply/confirmation, retain manual entry and re-enable after success',async()=>{
 const h=mountHarness(),{$}=h;
 const id=c=>orders.calculateOrderRows(grid(),source,options).rows.find(r=>r.code===c).id;
 try{
  assert.equal($('#order-suggest').disabled,true);
  assert.equal($('#order-read-dialog').open,true);
  await new Promise(setImmediate);
  assert.equal($('#order-read-dialog').open,false);
  assert.equal($('#order-suggest').disabled,false);
  assert.equal($('#order-confirm').disabled,false);
  assert.match($('#order-table').innerHTML,/驗收專用・不帶入/);
  const manual=$('qty:'+id('KEEP'));manual.value='3';manual.oninput();
  let reject;h.reply(()=>new Promise((_resolve,fail)=>{reject=fail;}));
  const loading=$('#order-load').onclick();
  assert.equal($('#order-suggest').disabled,true);
  assert.equal($('#order-confirm').disabled,true);
  $('#order-suggest').onclick();
  reject(Error('fixture offline'));await loading;
  assert.match($('#order-state').textContent,/fixture offline/);
  assert.match($('#order-table').innerHTML,/舊值・僅供參考/);
  assert.equal($('#order-suggest').disabled,true);
  assert.equal($('qty:'+id('KEEP')).value,'3');
  assert.equal($('qty:'+id('NORMAL')).value,'');
  $('#order-suggest').onclick();
  assert.equal($('qty:'+id('NORMAL')).value,'');
  assert.equal($('#order-read-title').textContent,'讀取失敗');
  h.reply(async()=>({values:grid('2')}));
  await $('#order-read-retry').onclick();
  assert.equal($('#order-read-dialog').open,false);
  assert.equal($('#order-suggest').disabled,false);
  $('#order-suggest').onclick();
  assert.equal($('qty:'+id('KEEP')).value,'14');
  assert.equal($('qty:'+id('NORMAL')).value,'14');
  $('#order-usage').onclick();
  assert.equal($('qty:'+id('NORMAL')).value,'2');
  assert.equal($('qty:'+id(code)).value,'');
 }finally{h.unmount();}
});

test('existing local QA draft stays in history but cannot reach Google sync',()=>{
 const date='2026-01-19', snapshot=orders.calculateOrderRows(grid(),source,options), qa=snapshot.rows[0];
 const historical=[{kind:'tcm-purchase-order',version:2,id:'PO-old-qa',createdAt:date,actor:'QA',status:'已確認草稿・未送出',options,lines:[{...qa,quantity:1}]}];
 const h=mountHarness({historical});
 try{
  assert.match(h.$('#order-history').innerHTML,/PO-old-qa/);
  h.$('send:PO-old-qa').onclick();
  assert.match(h.$('#order-state').textContent,/歷史草稿含驗收專用品項/);
 }finally{h.unmount();}
});

test('order planning detects unsaved edits including zero and clears them only on successful save',async()=>{
 const h=mountHarness(),{$}=h,normal=orders.calculateOrderRows(grid(),source,options).rows[1];
 try{
  assert.equal(h.unmount.hasUnsavedChanges(),false);
  await new Promise(setImmediate);
  assert.equal(h.unmount.hasUnsavedChanges(),false);
  const input=$('qty:'+normal.id);input.value='0';input.oninput();
  assert.equal(h.unmount.hasUnsavedChanges(),true);
  assert.doesNotMatch($('#content').innerHTML,/order-reviewed|id="order-save"|儲存本機草稿/);
  input.value='2';input.oninput();
  $('#order-confirm').onclick();
  assert.equal(JSON.parse(h.store.get('tcm-purchase-v2')).orders.length,0);
  assert.equal(h.unmount.hasUnsavedChanges(),true);
  await h.modals.at(-1).run();
  assert.equal(JSON.parse(h.store.get('tcm-purchase-v2')).orders[0].lines[0].quantity,2);
  assert.equal(h.unmount.hasUnsavedChanges(),false);
  $('#order-days').value='8';
  assert.equal(h.unmount.hasUnsavedChanges(),true);
 }finally{h.unmount();}
});

test('filled filter intersects search and preserves quantities when switched off',async()=>{
 const h=mountHarness(),{$}=h;
 try{
  await new Promise(setImmediate);
  for(const row of orders.calculateOrderRows(grid(),source,options).rows.filter(r=>r.code!==code)){
   const input=$('qty:'+row.id);input.value=row.code==='KEEP'?'3':'0';input.oninput();
  }
  const filter=$('#order-only-filled');filter.checked=true;filter.onchange();
  const table=$('#order-table');
  assert.match(table.innerHTML,/KEEP/);assert.doesNotMatch(table.innerHTML,/NORMAL|QA20261120A/);
  $('#order-search').value='NORMAL';$('#order-search').oninput();assert.doesNotMatch(table.innerHTML,/data-qty=/);
  filter.checked=false;filter.onchange();assert.match(table.innerHTML,/NORMAL/);assert.match(table.innerHTML,/value="0"/);
 }finally{h.unmount();}
});

test('planning settings show the live coverage and formula after changing holiday days',()=>{
 const h=mountHarness(),{$}=h;
 try{
  $('#order-days').value='3';$('#order-shipping').value='0.5';
  const holiday=$('#order-holiday');
  for(const [value,total] of [['0','3.5'],['1','4.5']]){
   holiday.value=value;holiday.listeners.input();
   const summary=$('#plan-days-summary').textContent;
   assert.ok(summary.includes('合計備貨 '+total+' 天'));
   assert.ok(summary.includes('每日平均耗損 × '+total+' 天'));
  }
 }finally{h.unmount();}
});

test('all-blank loss days can be applied as zero without another read while invalid losses stay blocked',async()=>{
 const h=mountHarness(),{$}=h;
 try{
  await new Promise(setImmediate);
  const values=grid('');
  values[4][13]='待核對';
  h.reply(async()=>({values}));
  await $('#order-load').onclick();
  $('#order-usage').onclick();
  assert.equal($('qty:科達單方:NORMAL:4').value,'0');
  $('#order-suggest').onclick();
  assert.equal($('qty:科達單方:NORMAL:4').value,'0');
  assert.equal($('qty:科達單方:KEEP:5').value,'');
 }finally{h.unmount();}
});

test('planning pager retains quantities and prices across pages and clears the whole category',async()=>{
 const h=mountHarness(),{$}=h;
 try{
  await new Promise(setImmediate);
  const [header,weekday,,sample]=grid();
  const values=[header,weekday,...Array.from({length:33},(_,i)=>{
   const row=[...sample];row[1]='N'+String(i).padStart(2,'0');row[4]='12.50';return row;
  })];
  h.reply(async()=>({values}));await $('#order-load').onclick();
  const enter=(id,n)=>{const input=$('qty:'+id);input.value=n;input.oninput();};
  assert.match($('#order-page').textContent,/1–10/);
  enter('科達單方:N00:3','2');
  $('#order-next').onclick();enter('科達單方:N10:13','4');
  for(const size of [20,30]){
   $('#order-page-size').value=String(size);$('#order-page-size').onchange();
   assert.match($('#order-page').textContent,new RegExp('1–'+size));
   $('#order-next').onclick();assert.match($('#order-page').textContent,/–33/);
  }
  assert.equal($('#order-total').textContent,'已填 2 項（含其他分頁） · 6 瓶 · 訂貨合計：NT$ 75');
  $('#order-confirm').onclick();
  assert.match(h.modals.at(-1).html,/N00.*N10.*NT\$ 75/);
  $('#order-clear').onclick();h.modals.at(-1).run();
  assert.equal($('#order-total').textContent,'已填 0 項（含其他分頁） · 0 瓶 · 訂貨合計：NT$ 0');
 }finally{h.unmount();}
});

test('confirmed draft exposes exactly two actions and approves the original order for review',async()=>{
 const snapshot=orders.calculateOrderRows(grid(),source,options), row=snapshot.rows[1];
 const order=orders.makeOrder(snapshot,{[row.id]:'3'},'QA',true,'PO-planning-0001',date);
 const reviews=[];
 const h=mountHarness({historical:[order],directReview:draft=>reviews.push(draft)});
 try{
  const html=h.$('#order-history').innerHTML;
  assert.deepEqual([...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map(m=>m[1]),['確認並進行訂貨','清除這筆訂單']);
  assert.doesNotMatch(h.$('#content').innerHTML,/開啟 Google 同步確認工具|匯出全部訂貨備份|還原訂貨備份/);
  await h.$('send:'+order.id).onclick();
  assert.equal(reviews.length,1);
  assert.equal(reviews[0].id,'ERP-'+order.id);
  assert.equal(reviews[0].actor,'QA');
  assert.deepEqual(reviews[0].lines.map(l=>[l.sheet,l.code,l.quantity]),[['科達單方','NORMAL',3]]);
 }finally{h.unmount();}
});

test('clearing a confirmed draft shows its counts and removes only that draft on confirmation',async()=>{
 const snapshot=orders.calculateOrderRows(grid(),source,options), row=snapshot.rows[1];
 const create=(id,qty)=>orders.makeOrder(snapshot,{[row.id]:String(qty)},'QA',true,id,date);
 const selected=create('PO-planning-0001',3),other=create('PO-planning-0002',7);
 const h=mountHarness({historical:[selected,other]});
 const savedIds=()=>JSON.parse(h.store.get('tcm-purchase-v2')).orders.map(o=>o.id);
 try{
  h.$('clearOrder:'+selected.id).onclick();
  const dialog=h.modals.at(-1);
  assert.match(dialog.html,/科達/);
  assert.match(dialog.html,/1\s*項/);
  assert.match(dialog.html,/3\s*瓶/);
  assert.equal(dialog.confirmLabel,'確認清除');
  assert.deepEqual(savedIds(),[selected.id,other.id]);
  await dialog.run();
  assert.deepEqual(savedIds(),[other.id]);
  assert.match(h.$('#order-history').innerHTML,/PO-planning-0002/);
  assert.doesNotMatch(h.$('#order-history').innerHTML,/PO-planning-0001/);
 }finally{h.unmount();}
});

test('planning counts blank open days as zero on the first read and still flags missing or invalid data',async()=>{
 const h=mountHarness(),{$}=h;
 try{
  await new Promise(setImmediate);
  assert.doesNotMatch($('#content').innerHTML,/order-confirm-blanks|id="order-blank"/);
  const data=grid('4');
  data[0].push('1/20');data[1].push('二');
  data[2].push('');data[3].push('');data[4].push('待核對');
  $('#order-end').value='2026-01-20';
  let reads=0;
  h.reply(async()=>{reads++;return {values:data};});
  await $('#order-load').onclick();
  $('#order-suggest').onclick();
  assert.equal(reads,1);
  assert.equal($('qty:科達單方:NORMAL:4').value,'14');
  assert.equal($('qty:科達單方:KEEP:5').value,'');
  assert.match($('#order-table').innerHTML,/耗損有非數字或負數/);
  data[0].pop();
  await $('#order-load').onclick();
  assert.match($('#order-table').innerHTML,/缺 1 天日期欄/);
  assert.match($('#order-table').innerHTML,/資料不足/);
 }finally{h.unmount();}
});
