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

async function fixture({initial}={}){
 const storage=new Map(initial?[[KEY,JSON.stringify(initial)]]:[]);
 const dom=new Map(),dialogs=[],warnings=[],writes=[],links=[];
 const $=sel=>{
  if(!dom.has(sel))dom.set(sel,{innerHTML:'',textContent:'',dataset:{},value:({'#receipt-date':'2026-01-19','#receipt-actor':'QA'})[sel]||'',
   events:new Map(),addEventListener(type,fn){this.events.set(type,fn);},insertAdjacentHTML(){},querySelector(){return {insertAdjacentHTML(){}}}});
  return dom.get(sel);
 };
 const qty=$('qty'),price=$('price'),key=receiptKey(row);
 qty.dataset.key=key;qty.parentElement={querySelector:()=>({insertAdjacentHTML(){}})};
 price.dataset.priceKey=key;price.closest=()=>({querySelector:()=>({textContent:''})});
 const host={querySelector:$,querySelectorAll:sel=>sel==='.receipt-qty'?[qty]:sel==='.receipt-price'?[price]:[]};
 const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 let ledger=[],stock=4,afterWrite;
 const directLog=async()=>({text:async()=>JSON.stringify([ledgerHeader,...ledger.map(d=>[d.id,JSON.stringify({draft:d})])])});
 const directReview=async(d,ask,verified,status,opts)=>{
  dialogs.push({initial:d,discard:opts.onDiscard,post:async(next,{confirm=true,fail=false}={})=>{
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
  document:{querySelector:()=>host},window:{addEventListener(){},removeEventListener(){}},crypto:{randomUUID:()=>normalId.slice(4)},
  createSupplierLoader:()=>async()=>({sources:[source],rows:[{...row,bottles:stock}]}),loadReceiptCatalog:()=>{},watchSupplierCatalog:()=>()=>{},
  supplierSelection:()=>({source,brand:source.brand,category:source.category,brands:[source.brand],categories:[source.category]}),
  beginProcessing:()=>({close(){}}),isProcessing:()=>false,showReceiptReviewWarning:x=>warnings.push(x),createRefreshStatus:()=>({start(){},finish(){}}),
  supplyLayout:'',protectDraft:(fn,dirty)=>Object.assign(fn,{hasUnsavedChanges:dirty}),operationResult:()=>'',quantitySteppers(){},sheetUrl:()=> '#',
  seedShortage:()=>null,shortageLinks:()=>links.slice(),clearShortage:()=>links.splice(0),reconcileOrderInputs(){},today:()=> '2026-01-19',directEnabled:()=>true};
 const mount=new Function(...Object.keys(mountDeps),sourceOf('receive-grid.mjs')+'\nreturn mountReceiptGrid;')(...Object.values(mountDeps));
 const prompts=[];const close=mount({esc:String,fmt:String,ask:(...args)=>prompts.push(args)});await closeTick();
 return {storage,dialogs,prompts,close,warnings,writes,$,qty:v=>{qty.value=v;qty.oninput();},price:v=>{price.value=v;price.oninput();},links,
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
