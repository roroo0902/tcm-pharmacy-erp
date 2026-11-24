import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as pricing from '../web/receipt-pricing.mjs';
import * as orders from '../src/orders.mjs';
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
function mountHarness({historical=[]}={}){
 const nodes=new Map(),store=new Map(),modals=[];
 const values={'#order-start':date,'#order-end':date,'#order-days':'7','#order-shipping':'0','#order-holiday':'0','#order-actor':'QA'};
 const $=(selector)=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',value:values[selector]??'',checked:false,showModal(){this.open=true;},close(){this.open=false;},listeners:{},addEventListener(ev,cb){this.listeners[ev]=cb;}});return nodes.get(selector);};
 store.set('tcm-purchase-v2',JSON.stringify({drafts:{},orders:historical}));
 const host=$('#content'),baseGrid=grid();let reply=async()=>({values:baseGrid});
 host.querySelector=$;
 host.querySelectorAll=(selector)=>{
  if(selector==='[data-send]')return historical.map(o=>{const b=$('send:'+o.id);b.dataset={send:o.id};return b;});
  if(selector!=='[data-qty]')return [];
  return [...$('#order-table').innerHTML.matchAll(/data-qty="([^"]+)"[^>]*value="([^"]*)"/g)].map(m=>{
   const node=$('qty:'+m[1]);node.dataset={qty:m[1]};node.value=m[2];return node;
  });
 };
 const deps={...pricing,...orders,...sort,protectDraft,document:{querySelector:$},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},navigator:{locks:{request:async(_k,f)=>f()}},planningLayout:'',installPlanningMobile:()=>{},
  SOURCES:[source],ORDER_ENDPOINT:'fixture-disabled',today:()=>date,SHEET_ID:'other',directEnabled:()=>false,
  fetch:async()=>({ok:true,headers:{get:()=> 'text/csv'},text:async()=>''}),csvRows:()=>[['','編號']],
  runDirect:(name)=>{assert.equal(name,'readLossPlanning');return reply();}};
 const mount=new Function(...Object.keys(deps),codeBody+'\nreturn mountOrders;')(...Object.values(deps));
 const unmount=mount({esc:String,fmt:String,ask:(html,run)=>modals.push({html,run})});
 return {$,modals,unmount,reply:f=>{reply=f;}};
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
  $('#order-reviewed').checked=true;
  let reject;h.reply(()=>new Promise((_resolve,fail)=>{reject=fail;}));
  const loading=$('#order-load').onclick();
  assert.equal($('#order-suggest').disabled,true);
  assert.equal($('#order-confirm').disabled,true);
  assert.equal($('#order-reviewed').checked,false);
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
  await $('#order-save').onclick();
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

test('confirmed blanks recalculate and apply while invalid losses stay blocked',async()=>{
 const h=mountHarness(),{$}=h;
 try{
  await new Promise(setImmediate);
  const values=grid('');
  values[4][13]='待核對';
  h.reply(async()=>({values}));
  await $('#order-load').onclick();
  assert.equal($('#order-confirm-blanks').hidden,false);
  $('#order-usage').onclick();
  assert.equal($('qty:科達單方:NORMAL:4').value,'');
  $('#order-suggest').onclick();
  assert.match($('#order-state').textContent,/沒有可帶入/);
  await $('#order-confirm-blanks').onclick();
  assert.equal($('#order-confirm-blanks').hidden,true);
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
  $('#order-reviewed').checked=true;$('#order-confirm').onclick();
  assert.match(h.modals.at(-1).html,/N00.*N10.*NT\$ 75/);
  $('#order-clear').onclick();h.modals.at(-1).run();
  assert.equal($('#order-total').textContent,'已填 0 項（含其他分頁） · 0 瓶 · 訂貨合計：NT$ 0');
 }finally{h.unmount();}
});
