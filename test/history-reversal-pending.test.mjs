import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cloudDraft} from '../src/cloud-transaction.mjs';
const source=await readFile(new URL('../web/cloud-entry.mjs',import.meta.url),'utf8');
const src=source.slice(source.indexOf(' function beginHistoryReversal('),source.indexOf(' const readFilters=()=>'));
assert.ok(src.startsWith(' function beginHistoryReversal('));
const original={draft:{kind:'tcm-cloud',version:1,id:'ERP-original-synth',action:'進貨',date:'2026-11-20',actor:'QA',note:'',lines:[{sheet:'科達單方',code:'QA-SYNTH',name:'合成品',quantity:2}]}};
const pending=JSON.stringify({id:'ERP-existing-synth',verified:false}),verified=JSON.stringify({id:'ERP-existing-synth',verified:true});
function make(raw=null,direct=true){
 const KEY='tcm-cloud-pending-v1',dialog=[],previews=[],writes=[],submissions=[],actionStatus={textContent:''};let loads=0;
 const localStorage={getItem:k=>{assert.equal(k,KEY);return raw;},setItem:(k,v)=>{assert.equal(k,KEY);writes.push(v);raw=v;}};
 const doc={querySelector:k=>({value:k.includes('actor')?'QA 操作員':'合成沖銷原因'}),body:{append(){}},createElement:tag=>tag==='form'?{append(i){this.field=i;},submit(){submissions.push(this.field.value);},remove(){}}:{}};
 const start=new Function('alive','actionStatus','localStorage','KEY','ask','directEnabled','directReview','cloudDraft','document','load','LOSS_ENDPOINT',src+'\nreturn beginHistoryReversal;')(
  true,actionStatus,localStorage,KEY,(html,confirm,label)=>dialog.push({html,confirm,label}),()=>direct,
  (d,unused,onSuccess,status,options)=>{previews.push({d,onSuccess,status,options});},
  cloudDraft,doc,async()=>{loads++;},'https://fixture.invalid/fallback');
 return {start:()=>start(original),dialog,previews,writes,submissions,actionStatus,replace:x=>raw=x,raw:()=>raw,loads:()=>loads};
}
test('unresolved or corrupt shared key blocks history reversal before opening a dialog',()=>{
 for(const old of [pending,'{bad','null','17','[]','']){
  const h=make(old);h.start();
  assert.match(h.actionStatus.textContent,/尚未核對|無法讀取/);
  assert.equal(h.dialog.length,0);assert.equal(h.previews.length,0);assert.equal(h.raw(),old);assert.deepEqual(h.writes,[]);
 }
});
test('opening and cancelling a clean direct reversal preview leaves the shared key untouched',async()=>{
 for(const old of [null,verified]){
  const h=make(old);h.start();assert.equal(h.dialog.length,1);assert.equal(h.raw(),old);
  await h.dialog[0].confirm();assert.equal(h.previews.length,1);assert.equal(h.raw(),old);assert.deepEqual(h.writes,[]);
  assert.equal(h.previews[0].d.action,'沖銷');assert.equal(h.previews[0].d.reverses,original.draft.id); // Close/cancel: do not call beforeCommit.
 }
});
test('new pending transaction after opening the form blocks before preview and preserves it',async()=>{
 const h=make();h.start();h.replace(pending);
 await h.dialog[0].confirm();
 assert.match(h.actionStatus.textContent,/狀態已變更/);assert.equal(h.previews.length,0);assert.equal(h.raw(),pending);assert.deepEqual(h.writes,[]);
});
test('new key during preview blocks before submit and preserves the newer pending item',async()=>{
 const h=make();h.start();await h.dialog[0].confirm();const p=h.previews[0];
 h.replace(pending);
 assert.throws(()=>p.options.beforeCommit(p.d),/狀態已變更/);
 assert.equal(h.raw(),pending);assert.deepEqual(h.writes,[]);
});
test('final confirmed direct action writes only its reviewed draft and verified readback retains identity',async()=>{
 const h=make(verified);h.start();await h.dialog[0].confirm();const p=h.previews[0];assert.deepEqual(h.writes,[]);
 p.options.beforeCommit(p.d);assert.deepEqual(JSON.parse(h.raw()),p.d);assert.equal(h.writes.length,1);
 await p.onSuccess();assert.deepEqual(JSON.parse(h.raw()),{...p.d,verified:true});assert.equal(h.loads(),1);
});
test('completion of an in-flight action never overwrites another pending record',async()=>{
 const h=make();h.start();await h.dialog[0].confirm();const p=h.previews[0];p.options.beforeCommit(p.d);h.replace(pending);
 await p.onSuccess();assert.equal(h.raw(),pending);assert.equal(h.writes.length,1);assert.equal(h.loads(),1);
});
test('legacy external handoff retains resumable ID only after confirmation; unresolved and raced keys block',async()=>{
 const current=make(null,false);current.start();assert.equal(current.raw(),null);assert.equal(current.submissions.length,0);
 await current.dialog[0].confirm();assert.equal(current.submissions.length,1);assert.equal(current.raw(),current.submissions[0]);assert.equal(JSON.parse(current.raw()).reverses,original.draft.id);
 const blocked=make(pending,false);blocked.start();assert.equal(blocked.dialog.length,0);assert.equal(blocked.raw(),pending);
 const raced=make(verified,false);raced.start();raced.replace(pending);await raced.dialog[0].confirm();assert.equal(raced.submissions.length,0);assert.equal(raced.raw(),pending);assert.equal(raced.writes.length,0);
});

test('actual app positive button plus direct-review path checks pending immediately before RPC commit',async()=>{
 const app=await readFile(new URL('../web/app.mjs',import.meta.url),'utf8');
 const sync=(await readFile(new URL('../web/direct-sync.mjs',import.meta.url),'utf8')).replace(/^import .+\n/gm,'').replace(/^export /gm,'');
 const ui=app.slice(app.indexOf('function showAsk('),app.indexOf("window.addEventListener('hashchange'"));
 assert.match(ui,/\$\('#commit'\)\.onclick/);
 for(const raced of [false,true]){
  const KEY='tcm-cloud-pending-v1',calls=[],writes=[],nodes=new Map(),actionStatus={textContent:''};
  let raw=null;const $=id=>{
   if(id==='#confirm form')return null;
   if(!nodes.has(id))nodes.set(id,{value:id.includes('actor')?'QA 操作員':'合成原因',showModal(){},close(){}});
   return nodes.get(id);
  };
  const doc={querySelector:$,querySelectorAll:()=>[]};
  const localStorage={getItem:k=>{assert.equal(k,KEY);return raw;},setItem:(k,v)=>{assert.equal(k,KEY);writes.push(v);raw=v;}};
  const showAsk=new Function('$','let pending=null;\n'+ui+'\nreturn showAsk;')($);
  const google={script:{run:{withSuccessHandler(ok){return {withFailureHandler(){return {erpHosted(op,draft,token){
   calls.push({op,draft,token});
   const lines=draft.lines.map(l=>({...l,before:6,after:4}));
   if(op==='commit'){assert.deepEqual(JSON.parse(raw),draft);assert.equal(token,'fixture-token');}
   ok(op==='preview'?{token:'fixture-token',lines}:{message:'mock readback',id:draft.id,lines});
  }};}};}}}};
  const direct=new Function('globalThis','google','document','window','DIRECT','markCatalogWrite','beginProcessing','isProcessing','lossCompletionPreview',
   sync+'\nreturn directReview;')({google},google,doc,{dispatchEvent(){}},{},()=>{},
    ()=>({close(){},readback(){}}),()=>false,()=>'');
  const start=new Function('alive','actionStatus','localStorage','KEY','ask','directEnabled','directReview','cloudDraft','document','load','LOSS_ENDPOINT',
   src+'\nreturn beginHistoryReversal;')(true,actionStatus,localStorage,KEY,showAsk,()=>true,direct,cloudDraft,doc,async()=>{},'https://fixture.invalid/fallback');
  start(original);
  assert.equal($('#commit').textContent,'預覽雲端異動');
  await $('#commit').onclick();assert.deepEqual(calls.map(x=>x.op),['preview']);assert.equal(raw,null);
  assert.equal($('#commit').textContent,'確認入帳');
  if(raced)raw=pending;
  await $('#commit').onclick();
  if(raced){
   assert.deepEqual(calls.map(x=>x.op),['preview']);assert.equal(raw,pending);assert.equal(writes.length,0);
   assert.match(actionStatus.textContent,/狀態已變更/);
   assert.match($('#confirm-detail').innerHTML,/結果尚待核對/);
  }else{
   assert.deepEqual(calls.map(x=>x.op),['preview','commit']);assert.equal(writes.length,2);
   assert.deepEqual(JSON.parse(raw),{...calls[1].draft,verified:true});
   assert.match($('#confirm-detail').innerHTML,/同步完成/);
  }
 }
});
