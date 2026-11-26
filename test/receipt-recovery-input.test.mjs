import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cloudDraft} from '../src/cloud-transaction.mjs';
import {receiptKey,receiptLines,sortReceiptRows,receiptPrice} from '../web/receive-grid-data.mjs';
import {priceCents,money,pricingTotal} from '../web/receipt-pricing.mjs';

const source={name:'科達單方',brand:'科達',category:'單方',gid:1};
const row={...source,code:'SYNTH-1',drug:'合成進貨品項',bottles:4};
const KEY='tcm-cloud-pending-v1';
const sourceOf=name=>readFileSync(new URL('../web/'+name,import.meta.url),'utf8')
 .replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const ledgerHeader=['交易編號','交易JSON'];
const oldId='ERP-22345678-1234-1234-1234-123456789abc';
const normalId='ERP-12345678-1234-1234-1234-123456789abc';
const draft=(id,quantity)=>cloudDraft({kind:'tcm-cloud',version:1,id,action:'進貨',date:'2026-01-19',actor:'QA',note:'',lines:[
 {sheet:row.name,code:row.code,name:row.drug,quantity}
]});
const closeTick=()=>new Promise(setImmediate);

async function fixture({initial,catalog=[row],direct=true}={}){
 const storage=new Map(initial?[[KEY,JSON.stringify(initial)]]:[]);
 const dom=new Map(),dialogs=[],warnings=[],writes=[],links=[],external=[];
 const $=sel=>{
  if(!dom.has(sel))dom.set(sel,{innerHTML:'',textContent:'',dataset:{},value:({'#receipt-date':'2026-01-19','#receipt-actor':'QA'})[sel]||'',
   events:new Map(),addEventListener(type,fn){this.events.set(type,fn);},insertAdjacentHTML(){},querySelector(){return {insertAdjacentHTML(){}}}});
  return dom.get(sel);
 };
 const inputs=catalog.map(r=>{
  const key=receiptKey(r),qty=$('qty-'+key),price=$('price-'+key);
  qty.dataset.key=key;qty.parentElement={querySelector:()=>({insertAdjacentHTML(){}})};
  price.dataset.priceKey=key;price.closest=()=>({querySelector:()=>({textContent:''})});
  return {qty,price};
 });
 const host={querySelector:$,querySelectorAll:sel=>sel==='.receipt-qty'?inputs.map(i=>i.qty):sel==='.receipt-price'?inputs.map(i=>i.price):[]};
 const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 let ledger=[],stock=4,afterWrite,issued=0;
 const directLog=async()=>({text:async()=>JSON.stringify([ledgerHeader,...ledger.map(d=>[d.id,JSON.stringify({draft:d})])])});
 const directReview=async(d,ask,verified,status,opts)=>{
  dialogs.push({initial:d,discard:opts.onDiscard,back:opts.onReturn,post:async(next,{confirm=true,fail=false}={})=>{
   if(next)opts.onDraftChange?.(next);
   if(!confirm)return;
   opts.beforeCommit?.(d);
   if(fail)return;
   writes.push(structuredClone(d));ledger.push(structuredClone(d));stock+=d.lines[0].quantity;afterWrite?.();
   await verified({lines:[{...d.lines[0],after:stock}],time:'fixture'});
   // The actual direct review writes its generic result after the onSuccess callback.
   status('隔離後端已確認同步');
  }});
 };
 const deps={cloudDraft,localStorage,directLog,directReview,csvRows:JSON.parse};
 const recover=new Function(...Object.keys(deps),sourceOf('pending-recovery.mjs')+'\nreturn {lookupPostedTransaction,recoverPendingTransaction}')( ...Object.values(deps));
 const mountDeps={receiptEntryDialog:()=>()=>{},...deps,...recover,receiptKey,receiptLines,sortReceiptRows,receiptPrice,priceCents,money,pricingTotal,
  document:{querySelector:()=>host,body:{append(){}},createElement:()=>({append(input){this.input=input;},submit(){external.push(JSON.parse(this.input.value));},remove(){}})},
  navigator:{locks:{request:async(_key,fn)=>fn()}},LOSS_ENDPOINT:'https://example.invalid',window:{addEventListener(){},removeEventListener(){}},crypto:{randomUUID:()=>issued++?oldId.slice(4):normalId.slice(4)},
  loadReceiptCatalog:async()=>({sources:catalog,rows:catalog.map(r=>({...r,bottles:stock}))}),watchSupplierCatalog:()=>()=>{},
  supplierSelection:(_sources,brand)=>{const selected=catalog.find(r=>r.brand===brand)||catalog[0];return {source:selected,brand:selected.brand,category:selected.category,brands:catalog.map(r=>r.brand),categories:[selected.category]};},
  beginProcessing:()=>({close(){}}),isProcessing:()=>false,showReceiptReviewWarning:x=>warnings.push(x),createRefreshStatus:()=>({start(){},finish(){}}),
  supplyLayout:'',protectDraft:(fn,dirty)=>Object.assign(fn,{hasUnsavedChanges:dirty}),operationResult:()=>'',quantitySteppers(){},sheetUrl:()=> '#',
  seedShortage:()=>null,shortageLinks:()=>links.slice(),clearShortage:()=>links.splice(0),reconcileOrderInputs(){},today:()=> '2026-01-19',directEnabled:()=>direct};
 const mount=new Function(...Object.keys(mountDeps),sourceOf('receive-grid.mjs')+'\nreturn mountReceiptGrid;')(...Object.values(mountDeps));
 const prompts=[];const close=mount({esc:String,fmt:String,ask:(...args)=>prompts.push(args)});await closeTick();
 return {storage,dialogs,prompts,close,warnings,writes,$,external,
  qty:(v,i=0)=>{const {qty}=inputs[i];qty.value=v;qty.oninput();},price:(v,i=0)=>{const {price}=inputs[i];price.value=v;price.oninput();},links,
  submit:()=>$('#receipt-form').onsubmit({preventDefault(){}}),recover:()=>$('#receipt-process').onclick(),ledger:d=>ledger.push(d),stock:()=>stock,race:f=>{afterWrite=f}};
}

test('return from preview keeps revised quantities without creating pending; next confirmation posts once',async()=>{
 const f=await fixture();f.qty('5');await f.submit();
 await f.dialogs[0].post(draft(normalId,3),{confirm:false});
 assert.equal(f.storage.has(KEY),false);
 assert.equal(f.$('#receipt-process').hidden,true);
 assert.equal(f.stock(),4);
 await f.submit();assert.equal(f.dialogs[1].initial.lines[0].quantity,3);
 await f.dialogs[1].post();assert.equal(f.stock(),7);
 assert.equal(f.writes.length,1);assert.equal(JSON.parse(f.storage.get(KEY)).verified,true);
});

test('new edits to quantity, price or date are kept when a previous receipt is recovered',async()=>{
 for(const edit of [f=>f.qty('3'),f=>f.price('2.5'),f=>{f.$('#receipt-date').value='2026-01-20';},f=>{f.$('#receipt-actor').value='QA changed';},f=>{f.links.push({shortageId:'SH-12345678-1234-1234-1234-123456789abc',sheet:row.name,code:row.code,quantity:1});}]){
  const f=await fixture();f.qty('1');await f.submit();await f.dialogs[0].post(null,{fail:true});edit(f);
  await f.recover();await f.dialogs[1].post(draft(normalId,2));
  assert.equal(f.stock(),6);assert.equal(f.writes.length,1);
  assert.match(f.$('#receipt-pending-status').textContent,/目前輸入已保留/);
  assert.equal(f.close.hasUnsavedChanges(),true);assert.equal(f.$('#receipt-submit').disabled,false);
 }
});

test('pending loaded from another form never clears current input, even when the quantities match',async()=>{
 const f=await fixture({initial:draft(oldId,1)});f.qty('1');await f.recover();
 await f.dialogs[0].post(draft(oldId,2));
 assert.match(f.$('#receipt-summary').textContent,/已填 1 項.*1 瓶/);
 assert.match(f.$('#receipt-pending-status').textContent,/避免重複入帳/);
});

test('existing ledger result clears only with exact canonical owned payload, never on a mismatched same ID',async()=>{
 for(const [quantity,cleared] of [[1,true],[2,false]]){
  const f=await fixture();f.qty('1');await f.submit();await f.dialogs[0].post(null,{fail:true});f.ledger(draft(normalId,quantity));
  await f.recover();
  assert.equal(f.writes.length,0);assert.equal(f.close.hasUnsavedChanges(),!cleared);
  assert.match(f.$('#receipt-pending-status').textContent,cleared?/已查到/:/目前輸入已保留/);
 }
});

test('verified backend success cannot clear input if a newer pending record prevents local readback',async()=>{
 const f=await fixture();f.qty('1');await f.submit();await f.dialogs[0].post(null,{fail:true});await f.recover();
 f.race(()=>f.storage.set(KEY,JSON.stringify(draft(oldId,3))));
 await f.dialogs[1].post(draft(normalId,2));
 assert.equal(f.writes.length,1);
 assert.equal(JSON.parse(f.storage.get(KEY)).id,oldId);
 assert.equal(f.close.hasUnsavedChanges(),true);
 assert.match(f.$('#receipt-pending-status').textContent,/目前輸入已保留/);
});

test('same ID altered by another context before opening recovery preserves the input',async()=>{
 const f=await fixture();f.qty('1');await f.submit();await f.dialogs[0].post(null,{fail:true});
 f.storage.set(KEY,JSON.stringify(draft(normalId,3)));
 await f.recover();await f.dialogs[1].post(draft(normalId,3));
 assert.equal(f.close.hasUnsavedChanges(),true);
 assert.match(f.$('#receipt-pending-status').textContent,/目前輸入已保留/);
});

test('normal-preview edit tracks its authorized backfill; failed recovery does not clear it',async()=>{
 const f=await fixture();f.qty('1');await f.submit();
 await f.dialogs[0].post(draft(normalId,2),{fail:true});
 assert.match(f.$('#receipt-summary').textContent,/已填 1 項.*2 瓶/);
 await f.recover();await f.dialogs[1].post(null,{fail:true});assert.equal(f.close.hasUnsavedChanges(),true);
 await f.recover();await f.dialogs[2].post(draft(normalId,3));
 assert.equal(f.stock(),7);assert.equal(f.close.hasUnsavedChanges(),false);
});

test('manual clear and identical re-entry keep the newer receipt when recovering the old one',async()=>{
 for(const [label,edit] of [
  ['row clear',f=>{f.qty('');f.qty('1');}],
  ['clear all',f=>{f.$('#receipt-clear').onclick();f.qty('1');}],
  ['same-value user input',f=>f.qty('1')],
  ['price restored',f=>{f.price('4.5');f.price('3');}],
  ['date restored',f=>{
   const field=f.$('#receipt-date');field.value='2026-01-20';field.events.get('input')?.();
   field.value='2026-01-19';field.events.get('change')?.();
  }],
  ['actor restored',f=>{
   const field=f.$('#receipt-actor');field.value='Other QA';field.events.get('input')?.();
   field.value='QA';field.events.get('change')?.();
  }]
 ]){
  const f=await fixture();f.qty('1');if(label==='price restored')f.price('3');
  await f.submit();await f.dialogs[0].post(null,{fail:true});const pending=JSON.parse(f.storage.get(KEY));edit(f);
  assert.deepEqual(JSON.parse(f.storage.get(KEY)),pending,label);
  await f.recover();
  const next=structuredClone(f.dialogs[1].initial);next.lines[0].quantity=2;
  await f.dialogs[1].post(cloudDraft(next));
  assert.equal(f.writes.length,1,label);assert.equal(f.stock(),6,label);
  assert.equal(JSON.parse(f.storage.get(KEY)).lines[0].quantity,2,label);
  assert.match(f.$('#receipt-summary').textContent,/已填 1 項.*1 瓶/,label);
  assert.equal(f.$('#receipt-submit').disabled,false,label);
  assert.equal(f.close.hasUnsavedChanges(),true,label);
  assert.match(f.$('#receipt-pending-status').textContent,/目前輸入已保留.*避免重複入帳/,label);
 }
});

test('discard clears the current receipt only after confirmation',async()=>{
 const previous={...draft(oldId,2),verified:true};
 const f=await fixture({initial:previous});f.qty('3');await f.submit();
 f.dialogs[0].discard();assert.equal(f.close.hasUnsavedChanges(),true);
 assert.match(f.prompts[0][0],/確定放棄/);
 f.prompts[0][1]();assert.equal(f.close.hasUnsavedChanges(),false);
 assert.deepEqual(JSON.parse(f.storage.get(KEY)),previous);
 assert.equal(f.stock(),4);assert.equal(f.writes.length,0);
});

test('return keeps date, actor, cross-brand manual and blank prices, catalog price sources and preview quantities',async()=>{
 const catalog=['科達','天明','富田','自訂'].map((brand,i)=>({...row,name:brand+'單方',brand,code:'QA-'+i,unitPriceCents:9900}));
 const previous={...draft(oldId,1),verified:true};
 const f=await fixture({catalog,initial:previous});
 f.$('#receipt-date').value='2026-01-18';
 f.$('#receipt-actor').value='驗收員';
 catalog.forEach((_,i)=>f.qty('2',i));
 f.price('12.50',0);f.price('0',1);f.price('',2);
 await f.submit();
 const preview=f.dialogs[0],changes=structuredClone(preview.initial);
 changes.lines[2].quantity=5;
 await preview.post(changes,{confirm:false});await preview.back();
 assert.equal(f.$('#receipt-date').value,'2026-01-18');
 assert.equal(f.$('#receipt-actor').value,'驗收員');
 for(const [i,brandRow] of catalog.entries()){
  f.$('#receipt-brands').onclick({target:{closest:()=>({dataset:{brand:brandRow.brand}})}});
  const html=f.$('#receipt-grid tbody').innerHTML;
  assert.match(html,new RegExp('class="receipt-qty"[^>]*value="'+(i===2?'5':'2')+'"'));
  assert.match(html,new RegExp('class="receipt-price"[^>]*value="'+['12.50','0','','99'][i]+'"'));
  assert.equal(html.includes('本次輸入'),i!==3);
 }
 assert.deepEqual(JSON.parse(f.storage.get(KEY)),previous);
 await assert.rejects(()=>preview.post(),/預覽或待核對狀態已變動/);
 assert.equal(f.writes.length,0);
 f.qty('3');await f.submit();const edited=f.dialogs[1];
 assert.deepEqual(edited.initial.lines.map(l=>[l.quantity,l.unitPriceCents]),[[3,1250],[2,0],[5,undefined],[2,9900]]);
 await edited.post();await assert.rejects(()=>edited.post(),/預覽或待核對狀態已變動/);
 assert.equal(f.writes.length,1);
 assert.equal(f.close.hasUnsavedChanges(),false);
});

test('return keeps another tab’s pending record and invalidates the old confirm callback',async()=>{
 const f=await fixture();f.qty('2');await f.submit();
 const other=draft(oldId,7);f.storage.set(KEY,JSON.stringify(other));
 await f.dialogs[0].back();
 assert.deepEqual(JSON.parse(f.storage.get(KEY)),other);
 assert.match(f.$('#receipt-pending-status').textContent,/狀態已變動/);
 assert.match(f.$('#receipt-summary').textContent,/已填 1 項.*2 瓶/);
 await assert.rejects(()=>f.dialogs[0].post(),/預覽或待核對狀態已變動/);
 assert.equal(f.writes.length,0);
});

test('resubmitting a sent form reads back its original receipt instead of starting a second receipt',async()=>{
 for(const otherTabVerified of [true,false]){
  const f=await fixture();f.qty('2');await f.submit();const preview=f.dialogs[0];
  await preview.post(null,{fail:true});
  const posted=draft(normalId,2);
  if(otherTabVerified)f.storage.set(KEY,JSON.stringify({...posted,verified:true}));
  else f.ledger(posted);
  await preview.back();await f.submit();
  assert.equal(f.writes.length,0);
  assert.equal(f.dialogs.length,1);
  assert.equal(JSON.parse(f.storage.get(KEY)).verified,true);
  assert.equal(f.close.hasUnsavedChanges(),false);
 }
});

test('external Google review allows a direct return without opening a tab or reserving a transaction',async()=>{
 const f=await fixture({direct:false});f.qty('2');f.price('0');
 await f.submit();const [html,expired,label,backLabel,back]=f.prompts[0];
 assert.equal(label,'開啟 Google 核對頁');assert.equal(backLabel,'返回修改');
 assert.match(html,/科達單方.*合成進貨品項.*2 瓶/);
 await back();await expired();
 assert.equal(f.external.length,0);assert.equal(f.storage.has(KEY),false);
 f.qty('3');await f.submit();await f.prompts[1][1]();await f.prompts[1][1]();
 assert.equal(f.external.length,1);assert.equal(f.external[0].lines[0].quantity,3);
 assert.equal(f.external[0].lines[0].unitPriceCents,0);
 assert.equal(JSON.parse(f.storage.get(KEY)).id,f.external[0].id);
});

test('a late edit or discard from a closed preview cannot change the returned form',async()=>{
 const f=await fixture();f.qty('4');await f.submit();const preview=f.dialogs[0];
 preview.discard();const discard=f.prompts[0];
 await discard[4]();
 await preview.post(draft(normalId,9),{confirm:false});discard[1]();
 assert.match(f.$('#receipt-summary').textContent,/1 項.*4 瓶/);
 await assert.rejects(()=>preview.post(),/預覽或待核對狀態已變動/);
 assert.equal(f.writes.length,0);
});

test('a displaced receipt checks its own ID on the next preview while preserving the other tab’s transaction',async()=>{
 const f=await fixture();f.qty('2');await f.submit();
 const other=draft(oldId,8);
 f.race(()=>f.storage.set(KEY,JSON.stringify(other)));
 await f.dialogs[0].post();
 assert.equal(f.writes.length,1);assert.equal(f.close.hasUnsavedChanges(),true);
 await f.submit();
 assert.equal(f.dialogs.length,1);assert.equal(f.writes.length,1);
 assert.equal(f.close.hasUnsavedChanges(),false);
 assert.deepEqual(JSON.parse(f.storage.get(KEY)),other);
 assert.match(f.$('#receipt-pending-status').textContent,/本筆進貨已入帳/);
});

test('an unverified displaced receipt keeps its original ID on a safe retry',async()=>{
 const f=await fixture();f.qty('2');await f.submit();
 await f.dialogs[0].post(null,{fail:true});
 const other=draft(oldId,8);
 f.storage.set(KEY,JSON.stringify(other));await f.submit();
 assert.equal(f.dialogs.length,1);assert.deepEqual(JSON.parse(f.storage.get(KEY)),other);
 f.storage.set(KEY,JSON.stringify({...other,verified:true}));await f.submit();
 assert.equal(f.dialogs[1].initial.id,normalId);await f.dialogs[1].post();
 assert.equal(f.writes.length,1);assert.equal(f.stock(),6);
});
