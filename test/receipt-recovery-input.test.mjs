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
   addEventListener(){},insertAdjacentHTML(){},querySelector(){return {insertAdjacentHTML(){}}}});
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
  dialogs.push({initial:d,post:async(next,{confirm=true,fail=false}={})=>{
   if(next)opts.onDraftChange?.(next);
   if(!confirm)return;
   opts.beforeCommit?.(d);
   if(fail)return;
   writes.push(structuredClone(d));ledger.push(structuredClone(d));stock+=d.lines[0].quantity;afterWrite?.();
   await verified({lines:[{...d.lines[0],after:stock}],time:'fixture'});
  }});
 };
 const deps={cloudDraft,localStorage,directLog,directReview,csvRows:JSON.parse};
 const recover=new Function(...Object.keys(deps),sourceOf('pending-recovery.mjs')+'\nreturn {lookupPostedTransaction,recoverPendingTransaction}')( ...Object.values(deps));
 const mountDeps={...deps,...recover,receiptKey,receiptLines,sortReceiptRows,receiptPrice,priceCents,money,pricingTotal,
  document:{querySelector:()=>host},window:{addEventListener(){},removeEventListener(){}},crypto:{randomUUID:()=>normalId.slice(4)},
  createSupplierLoader:()=>async()=>({sources:[source],rows:[{...row,bottles:stock}]}),loadReceiptCatalog:()=>{},watchSupplierCatalog:()=>()=>{},
  supplierSelection:()=>({source,brand:source.brand,category:source.category,brands:[source.brand],categories:[source.category]}),
  beginProcessing:()=>({close(){}}),isProcessing:()=>false,showReceiptReviewWarning:x=>warnings.push(x),createRefreshStatus:()=>({start(){},finish(){}}),
  supplyLayout:'',protectDraft:(fn,dirty)=>Object.assign(fn,{hasUnsavedChanges:dirty}),operationResult:()=>'',quantitySteppers(){},sheetUrl:()=> '#',
  seedShortage:()=>null,shortageLinks:()=>links.slice(),clearShortage:()=>links.splice(0),reconcileOrderInputs(){},today:()=> '2026-01-19',directEnabled:()=>true};
 const mount=new Function(...Object.keys(mountDeps),sourceOf('receive-grid.mjs')+'\nreturn mountReceiptGrid;')(...Object.values(mountDeps));
 const close=mount({esc:String,fmt:String,ask(){}});await closeTick();
 return {storage,dialogs,close,warnings,writes,$,qty:v=>{qty.value=v;qty.oninput();},price:v=>{price.value=v;price.oninput();},links,
  submit:()=>$('#receipt-form').onsubmit({preventDefault(){}}),recover:()=>$('#receipt-process').onclick(),ledger:d=>ledger.push(d),stock:()=>stock,race:f=>{afterWrite=f}};
}

test('normal preview returning then recovering revised 1→2 clears only its old input after verify',async()=>{
 const f=await fixture();f.qty('1');await f.submit();
 assert.equal(f.dialogs[0].initial.lines[0].quantity,1);
 await f.dialogs[0].post(null,{confirm:false});
 assert.equal(f.close.hasUnsavedChanges(),true);assert.equal(f.writes.length,0);
 await f.recover();assert.equal(f.dialogs[1].initial.lines[0].quantity,1);
 await f.dialogs[1].post(draft(normalId,2));
 assert.equal(f.stock(),6);assert.equal(f.writes.length,1);
 assert.equal(JSON.parse(f.storage.get(KEY)).verified,true);
 assert.equal(JSON.parse(f.storage.get(KEY)).lines[0].quantity,2);
 assert.match(f.$('#receipt-summary').textContent,/已填 0 項/);
 assert.equal(f.$('#receipt-submit').disabled,true);assert.equal(f.close.hasUnsavedChanges(),false);
});

test('new edits to quantity, price or date are kept when a previous receipt is recovered',async()=>{
 for(const edit of [f=>f.qty('3'),f=>f.price('2.5'),f=>{f.$('#receipt-date').value='2026-01-20';},f=>{f.$('#receipt-actor').value='QA changed';},f=>{f.links.push({shortageId:'SH-12345678-1234-1234-1234-123456789abc',sheet:row.name,code:row.code,quantity:1});}]){
  const f=await fixture();f.qty('1');await f.submit();edit(f);
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
  const f=await fixture();f.qty('1');await f.submit();f.ledger(draft(normalId,quantity));
  await f.recover();
  assert.equal(f.writes.length,0);assert.equal(f.close.hasUnsavedChanges(),!cleared);
  assert.match(f.$('#receipt-pending-status').textContent,cleared?/已查到/:/目前輸入已保留/);
 }
});

test('verified backend success cannot clear input if a newer pending record prevents local readback',async()=>{
 const f=await fixture();f.qty('1');await f.submit();await f.recover();
 f.race(()=>f.storage.set(KEY,JSON.stringify(draft(oldId,3))));
 await f.dialogs[1].post(draft(normalId,2));
 assert.equal(f.writes.length,1);
 assert.equal(JSON.parse(f.storage.get(KEY)).id,oldId);
 assert.equal(f.close.hasUnsavedChanges(),true);
 assert.match(f.$('#receipt-pending-status').textContent,/目前輸入已保留/);
});

test('same ID altered by another context before opening recovery preserves the input',async()=>{
 const f=await fixture();f.qty('1');await f.submit();
 f.storage.set(KEY,JSON.stringify(draft(normalId,3)));
 await f.recover();await f.dialogs[1].post(draft(normalId,3));
 assert.equal(f.close.hasUnsavedChanges(),true);
 assert.match(f.$('#receipt-pending-status').textContent,/目前輸入已保留/);
});

test('normal-preview edit tracks its authorized backfill; failed recovery does not clear it',async()=>{
 const f=await fixture();f.qty('1');await f.submit();
 await f.dialogs[0].post(draft(normalId,2),{confirm:false});
 assert.match(f.$('#receipt-summary').textContent,/已填 1 項.*2 瓶/);
 await f.recover();await f.dialogs[1].post(null,{fail:true});assert.equal(f.close.hasUnsavedChanges(),true);
 await f.recover();await f.dialogs[2].post(draft(normalId,3));
 assert.equal(f.stock(),7);assert.equal(f.close.hasUnsavedChanges(),false);
});
