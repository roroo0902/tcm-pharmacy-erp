import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../web/order-grid.mjs',import.meta.url),'utf8');
const stem=(a,b)=>code.slice(code.indexOf(a),code.indexOf(b,code.indexOf(a)));
const KEY='tcm-cloud-pending-v1',old={id:'QA-old',action:'訂貨',verified:true},newer={id:'QA-receipt',action:'進貨',verified:false};
const incoming={id:'QA-order',action:'訂貨',lines:[{sheet:'SYNTH',code:'A',quantity:2}]};

function fixture(initial=old){
 let raw=JSON.stringify(initial),request,reader=async()=>[],lookup=async()=>null,followup=async()=>null,recover;
 let loads=0,handoffs=0,submissions=0,byId=0,mail=0,last='',rendered=0;
 const nodes=new Map(),writes=[],qty=new Map([['SYNTH','2']]),prices=new Map([['SYNTH','3']]),manualLines=[{name:'SYNTH manual'}];
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='#og-date'?'2026-11-20':id==='#og-actor'?'QA':'',requestSubmit(){submissions++;}});return nodes.get(id);};
 const cloudDraft=({verified,receiptEvent,mergeOriginal,mergeInputLines,...d})=>d;
 const deps={KEY,localStorage:{getItem:()=>raw,setItem:(_k,value)=>{raw=value;writes.push(JSON.parse(value));}},$,quantities:qty,prices,manualLines,
  ask:(...args)=>{request.prompt=args;},draw(){},esc:String,orderPrintControl:()=>'',bindOrderPrint(){rendered++;},status:m=>{last=m;},load:async()=>{loads++;},busy:false,loadFailed:false,alive:true,
  isProcessing:()=>false,checkingPending:false,recoveringPrevious:false,rows:[],clearShortage:()=>{handoffs++;},
  directReview:(d,ask,success,status,opts)=>{request={d,ask,success,status,opts};},
  recoverPendingTransaction:async args=>recover?.(args),allLines:()=>({length:qty.size,map:f=>[...qty].map(([k,v])=>f({code:k,quantity:Number(v)}))}),
  cloudDraft,findPostedTransaction:(rows,draft)=>rows.find(r=>r[0]===draft.id),directLog:async()=>{byId++;return {text:async()=>JSON.stringify([['交易編號','交易JSON'],...await reader()])};},
  csvRows:JSON.parse,summary(){},beginProcessing:()=>({close(){}}),orderRpc:async()=>({state:'unsent'}),lookupPostedTransaction:d=>lookup(d),
  chooseOrderFollowup:(...a)=>followup(...a),openExistingOrderMail:()=>{mail++;},orderMergeTable:()=>'',shortageLinks:()=>[],orderLines:()=>[],crypto:{randomUUID:()=> 'qa-id'}
 };
 const src=stem(' const recoveryStatus=', ' function currentDraft(')+stem(' function reviewCombined(', ' function send(d,outputMergeIds')+
  stem(' function send(d,outputMergeIds',' $(\'#order-brands\').onclick')+stem(" $('#order-grid-form').onsubmit=", ' const stopWordAxis=');
 const api=new Function(...Object.keys(deps),src+'\nreturn {showPending,send,reviewCombined,recoverPrevious};')(...Object.values(deps));
 return {api,$,writes,qty,prices,request:()=>request,swap:x=>{raw=JSON.stringify(x);},raw:()=>JSON.parse(raw),statistics:()=>({loads,handoffs,submissions,byId,mail,last,rendered}),
  read:f=>{reader=f;},lookup:f=>{lookup=f;},choose:f=>{followup=f;},recover:f=>{recover=f;},click:()=>$('#order-grid-form').onsubmit({preventDefault(){}})};
}
const record=d=>[d.id,JSON.stringify({draft:d})];
const tick=()=>new Promise(setImmediate);

test('rendered recheck ignores stale-before-click and stale-response records, but ordinarily verifies',async()=>{
 for(const mode of ['before-click','after-click','same-id-change','unchanged']){
  const f=fixture();f.api.showPending();let finish;f.read(()=>new Promise(res=>{finish=res;}));
  const next=mode==='same-id-change'?{...old,note:'changed signoff'}:newer;
  if(mode==='before-click')f.swap(next);
  const check=f.$('#og-check').onclick();await tick();
  if(mode!=='before-click'&&mode!=='unchanged')f.swap(next);
  finish?.([record(old)]);
  await check;
  if(mode==='unchanged'){assert.equal(f.raw().verified,true);assert.equal(f.writes.length,1);assert.match(f.statistics().last,/已確認/);}
  else{
   assert.deepEqual(f.raw(),next);assert.equal(f.writes.length,0);assert.match(f.statistics().last,/待核對的交易已變更/);
   assert.equal(f.statistics().byId,mode==='before-click'?0:1);
  }
 }
});

test('both normal and combined orders apply verified success only to the exact raw draft they submitted',async()=>{
 for(const mode of ['normal','merge']){
  for(const scenario of ['owned','before','after','same-id']){
   const f=fixture();
   if(mode==='normal')f.api.send(incoming);
   else f.api.reviewCombined(incoming,JSON.stringify(old),old,'[]');
   const req=f.request();
   if(scenario==='before'){
    f.swap(newer);assert.throws(()=>req.opts.beforeCommit(),/狀態已變更/);assert.equal(f.writes.length,0);continue;
   }
   req.opts.beforeCommit();
   const next=scenario==='same-id'?{...incoming,note:'new submit under same identity'}:newer;
   if(scenario!=='owned')f.swap(next);
   await req.success();
   req.status('已同步（替身）');
   if(scenario==='owned'){
    assert.equal(f.raw().id,incoming.id);assert.equal(f.raw().verified,true);
    assert.equal(f.writes.length,2);assert.equal(f.statistics().handoffs,1);assert.equal(f.qty.size,0);
    assert.equal(req.opts.autoMail(),true);continue;
   }
   assert.deepEqual(f.raw(),next);assert.equal(f.writes.length,1);assert.equal(f.statistics().handoffs,0);
   assert.equal(f.qty.size,1);assert.equal(f.prices.size,1);assert.equal(req.opts.autoMail(),false);
   assert.match(f.$('#og-recovery-status').textContent+' '+f.statistics().last,/已同步（替身）.*勿重複送出/);
   await f.click();assert.equal(f.request(),req);assert.equal(f.writes.length,1);
   assert.match(f.$('#og-recovery-status').textContent,/剛完成的訂貨／|剛完成的訂貨，請核對/);
  }
 }
});

test('fallback checks changed raw after reading a different operation and neither writes nor starts a new order',async()=>{
 const prev={id:'QA-cancel',action:'取消訂貨',verified:false},f=fixture(prev);let finish;
 f.read(()=>new Promise(res=>{finish=res;}));const clicked=f.click();await tick();
 f.swap(newer);finish([record(prev)]);await clicked;
 assert.deepEqual(f.raw(),newer);assert.equal(f.writes.length,0);assert.equal(f.request(),undefined);
 assert.match(f.$('#og-recovery-status').textContent,/待核對的交易已變更/);
});

test('old-order completion can continue only while the same verified raw still owns the slot',async()=>{
 for(const scenario of ['unchanged','lost','late-change']){
  const prev={id:'QA-prev',action:'訂貨',verified:false,lines:[]}, posted={...prev,verified:true},f=fixture(prev);
  let continuation;
  f.recover(async o=>{
   f.swap(scenario==='lost'?newer:posted);
   await o.onResolved({alreadyPosted:false,posted:prev});
   continuation=o.onContinue;
  });
  await f.api.recoverPrevious('訂貨',true);
  if(scenario==='late-change')f.swap(newer);
  continuation();
  assert.equal(f.statistics().submissions,scenario==='unchanged'?1:0);
  if(scenario!=='unchanged')assert.deepEqual(f.raw(),newer);
 }
});

test('stale or impossible current-only selection after a pending lookup miss does not start a write or recovery',async()=>{
 const prev={id:'QA-prev',action:'訂貨',verified:false,lines:[]},f=fixture(prev);
 f.choose(async()=> 'current');let recovering=0;f.recover(async()=>{recovering++;});
 await f.click();
 assert.equal(recovering,0);assert.equal(f.writes.length,0);assert.equal(f.request(),undefined);
 assert.match(f.$('#og-recovery-status').textContent,/尚未核對入帳/);
});

test('discarding a batch order requires confirmation and preserves previous records',()=>{
 const f=fixture();f.api.send(incoming);
 const review=f.request();assert.equal(review.opts.reviewLabel,'確認入帳');
 review.opts.onDiscard();assert.equal(f.qty.size,1);
 review.prompt[1]();assert.equal(f.qty.size,0);assert.equal(f.prices.size,0);
 assert.deepEqual(f.raw(),old);assert.equal(f.writes.length,0);assert.equal(f.statistics().mail,0);
});
