import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setImmediate as tick} from 'node:timers/promises';
import {lossDraft,lossCorrectionReason} from '../web/loss-cloud.mjs';
import {lossSheets,lossSlips} from '../web/loss-pending-list.mjs';
import {lossPage} from '../web/loss-pagination.mjs';
import {lossReasons} from '../web/loss-reasons.mjs';
import {supplierSelection} from '../web/supplier-catalog.mjs';
import {protectDraft} from '../web/page-safety.mjs';

const today='2026-11-26', date='2026-11-25', actor='驗收員';
const rows=['科達','天明','富田'].map((brand,index)=>({
 id:'id-'+index, name:brand+'單方', gid:index+1, brand, category:'單方',
 code:'QA', drug:'測試藥', bottles:10, posted:0,
}));
const prior={id:'another-slip',phase:'submitted',verified:false,
 draft:{date:'2026-11-23',actor,lines:[{sheet:'科達單方',code:'QA',name:'測試藥',total:4}]}};

async function mountForm({direct=true}={}){
 const storage=Object.create({
  getItem(key){return this[key]??null;},
  setItem(key,value){this[key]=value;},
  removeItem(key){delete this[key];}
 });
 const slips=lossSlips(storage,'tcm-loss-result-v1');
 slips.save(prior);
 const nodes=new Map(), previews=[], posted=[], messages=[];
 const quantities=rows.map(row=>({dataset:{id:row.id},value:''}));
 function node(selector){
  if(!nodes.has(selector))nodes.set(selector,{
   value:'',textContent:'',innerHTML:'',validity:{valid:true},
   querySelectorAll(){return [];},prepend(){},insertAdjacentHTML(){},focus(){},
  });
  return nodes.get(selector);
 }
 const $=node;
 $('#loss-submit-complete').parentElement={parentElement:{querySelectorAll:()=>[{},{}]}};
 const document={querySelector:$,querySelectorAll:sel=>sel==='.loss-qty'?quantities:[],createElement:()=>({})};
 const noop=()=>{};
 const deps={
  document,localStorage:storage,window:{addEventListener:noop,removeEventListener:noop},
  navigator:{locks:{request:(_key,fn)=>fn()}},
  lossDraft,lossCorrectionReason,lossSheets,lossSlips,lossPage,lossReasons,supplierSelection,protectDraft,
  today:()=>today,lossLayout:'',lossCompletionMarkup:'',LOSS_SHEET:'#',sheetUrl:()=>'#',
  alignOrderWord:()=>noop,watchSupplierCatalog:()=>noop,quantitySteppers:noop,sortSheetRows:list=>list,
  mountLossCompletion:()=>({show:noop,dispose:noop}),createLossResultCheck:()=>noop,showLossCheckResult:noop,
  beginProcessing:()=>({close:noop}),isProcessing:()=>false,createRefreshStatus:()=>({start:noop,finish:noop}),
  createLossLoader:read=>read,readLossWithTimeout:read=>read(),verifiedLossCatalog:data=>data,
  runDirect:async(method)=>{assert.equal(method,'readDailyLossGrid');return {sources:rows,rows,completion:{}};},
  directEnabled:()=>direct,operationResult:()=>'',showLossSlips:()=>({close:noop}),
  directReview:(draft,_ask,onSuccess,_message,options)=>previews.push({
   draft,back:options.onReturn,receiveReply:()=>onSuccess({message:'ok'}),
   async post({loseReply=false}={}){
    await options.beforeCommit(draft);
    posted.push(structuredClone(draft));
    if(!loseReply)await onSuccess({message:'ok'});
   }
  }),
 };
 const source=readFileSync(new URL('../web/loss.mjs',import.meta.url),'utf8')
  .replace(/^import [^\n]+;\r?\n/gm,'').replace(/^export /gm,'');
 const mount=new Function(...Object.keys(deps),source+'\nreturn mountLoss;')(...Object.values(deps));
 const ask=(_html,_confirm,label,_backLabel,back)=>{
  assert.equal(direct,false,'unexpected extra dialog');
  assert.equal(label,'開啟 Google 核對頁');
  previews.push({back});
 };
 mount({esc:String,fmt:String,ask,message:m=>messages.push(m)});
 await tick();
 $('#loss-date').value=date;$('#loss-date').onchange();await tick();
 $('#loss-actor').value=actor;
 function choose(brand){$('#loss-brands').onclick({target:{closest:()=>({dataset:{brand}})}});}
 function fill(index,value){choose(rows[index].brand);quantities[index].value=value;quantities[index].oninput();}
 function visible(index,value){
  choose(rows[index].brand);
  assert.match($('#loss-table tbody').innerHTML,new RegExp('data-id="'+rows[index].id+'"[^>]*value="'+value+'"'));
 }
 const submit=async()=>{$('#loss-submit-complete').onclick();await tick();};
 fill(0,'2');fill(1,'0');
 await submit();
 assert.equal(previews.length,1,messages.join('\n'));
 return {$,slips,previews,posted,fill,visible,submit};
}

test('return restores the original day, actor and quantities across brands including explicit zero',async()=>{
 const f=await mountForm();
 await f.previews[0].back();
 assert.equal(f.$('#loss-date').value,date);
 assert.equal(f.$('#loss-actor').value,actor);
 assert.match(f.$('#loss-summary').textContent,/已填 2 項/);
 f.visible(0,'2');f.visible(1,'0');
 assert.deepEqual(f.slips.list(),[prior]);
 assert.equal(f.posted.length,0);
 await assert.rejects(()=>f.previews[0].post(),/耗損單已變更或移除/);
 f.fill(0,'3');f.fill(2,'1');
 await f.submit();
 assert.equal(f.previews.length,2);
 const next=f.previews[1];
 assert.deepEqual(next.draft.lines.map(line=>[line.sheet,line.total]).sort(),[
  ['科達單方',3],['天明單方',0],['富田單方',1],
 ].sort());
 assert.equal(next.draft.date,date);
 assert.equal(next.draft.actor,actor);
 await next.post();
 assert.equal(f.posted.length,1);
 assert.deepEqual(f.posted[0],next.draft);
 assert.deepEqual(f.slips.list().filter(rec=>!rec.verified),[prior]);
});

test('stale preview cannot return or repost a slip after submission or an unknown outcome',async()=>{
 const f=await mountForm();
 const preview=f.previews[0];
 await preview.post({loseReply:true});
 const pending=f.slips.list().find(r=>r.id!==prior.id);
 assert.equal(pending.phase,'submitted');
 await preview.back();
 assert.deepEqual(f.slips.get(pending.id),pending);
 assert.deepEqual(f.slips.get(prior.id),prior);
 await assert.rejects(()=>preview.post(),/耗損單已變更或移除/);
 assert.match(f.$('#loss-summary').textContent,/已填 0 項/);
 await f.submit();
 assert.equal(f.previews.length,1);
 assert.equal(f.posted.length,1);
});

test('return does not overwrite or remove a draft edited in a different tab',async()=>{
 const f=await mountForm();
 const local=f.slips.list().find(r=>r.id!==prior.id);
 const changed={...local,draft:{...local.draft,actor:'其他經手人'}};
 f.slips.save(changed);
 await f.previews[0].back();
 assert.deepEqual(f.slips.get(local.id),changed);
 assert.match(f.$('#loss-summary').textContent,/已填 0 項/);
 assert.equal(f.posted.length,0);
});

test('a late posting reply does not recreate the removed slip or clear new input',async()=>{
 const f=await mountForm(),preview=f.previews[0];
 await preview.post({loseReply:true});
 const submitted=f.slips.list().find(r=>r.id!==prior.id);
 assert.equal(submitted.phase,'submitted');
 f.slips.remove(submitted.id); // Removed by the other tab while the reply is in flight.
 f.fill(0,'2');
 f.fill(2,'5');
 await preview.receiveReply();
 assert.deepEqual(f.slips.list(),[prior]);
 assert.equal(f.posted.length,1);
 f.visible(0,'2');
 f.visible(2,'5');
});

test('an unconfirmed submission can be removed inline on the first click in the same tab',async()=>{
 const f=await mountForm();
 await f.previews[0].post({loseReply:true});
 await f.$('#loss-cancel').onclick();
 assert.deepEqual(f.slips.list(),[prior]);
 assert.equal(f.posted.length,1);
});

test('inline removal uses the displayed snapshot, preserves adjacent slips and independent inputs',async()=>{
 const f=await mountForm();
 const local=f.slips.list().find(r=>r.id!==prior.id);
 const staleClick=f.$('#loss-cancel').onclick;
 const edited={...local,draft:{...local.draft,actor:'另一位經手人'}};
 f.slips.save(edited);
 f.fill(2,'3');
 await staleClick();
 assert.deepEqual(f.slips.get(local.id),edited);
 assert.match(f.$('#loss-remove-status').textContent,/已變更或移除/);
 await f.$('#loss-cancel').onclick();
 assert.deepEqual(f.slips.list(),[prior]);
 await staleClick();
 assert.deepEqual(f.slips.list(),[prior]);
 assert.equal(f.posted.length,0);
 f.visible(2,'3');
});

test('return from the external Google review prompt also preserves both quantities',async()=>{
 const f=await mountForm({direct:false});
 await f.previews[0].back();
 f.visible(0,'2');f.visible(1,'0');
 assert.deepEqual(f.slips.list(),[prior]);
 assert.equal(f.posted.length,0);
});
