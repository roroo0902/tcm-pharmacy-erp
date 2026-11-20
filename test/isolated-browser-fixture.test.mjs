import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {shortageProgress} from '../src/shortage.mjs';
import {revisedReceipt} from '../web/direct-sync.mjs';
import {historyEntries,renderHistory} from '../web/history-display.mjs';

const fixtureSource=await readFile(new URL('../qa/fixture.js',import.meta.url),'utf8');
const item={sheet:'科達單方',code:'QA20261120A',name:'ERP驗收專用・非藥品'};
const base={kind:'tcm-cloud',version:1,date:'2026-11-20',actor:'QA 操作員',note:'',action:'進貨',id:'ERP-fake-receipt',lines:[{...item,quantity:1}],
 shortageLinks:[{shortageId:'SH-12345678-1234-1234-1234-123456789abc',sheet:item.sheet,code:item.code,quantity:1}]};
function harness(){
 const element=()=>({append(){},prepend(){},setAttribute(){}});
 const window={}, document={createElement:element,querySelector:element,addEventListener(){}};
 vm.runInNewContext(fixtureSource,{document,window,structuredClone,setTimeout:fn=>queueMicrotask(fn)});
 window.__qa.controls.shortageMode='linked';
 const rpc=(op,draft,token)=>new Promise((ok,fail)=>window.google.script.run.withSuccessHandler(ok).withFailureHandler(e=>fail(Error(e.message))).erpHosted(op,draft,token));
 const progress=async()=>{
  const s=await rpc('readShortage'),x=shortageProgress(s.records[0],s.events.map(e=>e.allocation),s.orders,s.receipts);
  return [x.ordered,x.received,x.outstanding];
 };
 const log=async()=>(await rpc('readLog',{log:'inventory'})).values.slice(1).map(r=>JSON.parse(r[1]));
 const history=async()=>historyEntries([{s:{title:'建檔／進貨',id:'fixture',gid:1},rows:(await rpc('readLog',{log:'inventory'})).values.slice(1)}]);
 return {rpc,progress,log,history,stock:()=>window.__qa.stock.get(item.code)};
}
test('loopback fixture reads linked receipt 1→2, dispatches one event, and safely deduplicates same ID',async()=>{
 const h=harness();
 assert.deepEqual(await h.progress(),[6,2,4]);
 assert.equal(h.stock(),4);
 const first=await h.rpc('preview',base);
 const amended=revisedReceipt(base,first.lines,['2']);
 const second=await h.rpc('preview',amended);
 assert.equal(amended.lines[0].quantity,2);
 assert.equal(amended.shortageLinks[0].quantity,2);
 assert.equal(second.lines[0].after,6);assert.equal(h.stock(),4);
 await assert.rejects(h.rpc('commit',amended,first.token),/token mismatch/);
 await h.rpc('commit',amended,second.token);
 assert.equal(h.stock(),6);assert.deepEqual(await h.progress(),[6,4,2]);
 const log=await h.log();assert.equal(log.length,1);assert.equal(log[0].draft.shortageLinks[0].quantity,2);
 const repeated=await h.rpc('preview',amended);
 assert.equal(repeated.duplicate,true);assert.equal(repeated.lines[0].after,6);
 const retry=await h.rpc('commit',amended,repeated.token);
 assert.equal(retry.duplicate,true);
 assert.equal(h.stock(),6);assert.deepEqual(await h.progress(),[6,4,2]);assert.equal((await h.log()).length,1);
 await assert.rejects(h.rpc('preview',base),/same ID with different payload/);
});
test('fixture reverses only a confirmed synthetic receipt and tracks write/readback independently',async()=>{
 const h=harness(),pending=await h.rpc('preview',base),amended=revisedReceipt(base,pending.lines,['2']);
 const receipt=await h.rpc('preview',amended);
 await h.rpc('commit',amended,receipt.token);
 const initialHistory=await h.history();assert.equal(initialHistory[0].marked,true);assert.match(renderHistory(initialHistory),/沖銷這筆進貨/);
 const reversal={...amended,id:'ERP-fake-reversal',action:'沖銷',reverses:amended.id,note:'隔離沖銷'};
 delete reversal.shortageLinks;
 const checked=await h.rpc('preview',reversal);
 assert.deepEqual([checked.lines[0].before,checked.lines[0].after],[6,4]);assert.equal(h.stock(),6);
 await h.rpc('commit',reversal,checked.token);
 assert.equal(h.stock(),4);assert.deepEqual(await h.progress(),[6,2,4]);
 const log=await h.log();assert.equal(log.length,2);assert.equal(log[1].draft.reverses,amended.id);
 const history=await h.history();assert.equal(history.find(e=>e.id===amended.id).reversed,true);assert.doesNotMatch(renderHistory(history),/沖銷這筆進貨/);
 await assert.rejects(h.rpc('preview',{...reversal,id:'ERP-fake-reversal-again'}),/no valid original/);
 const repeated=await h.rpc('commit',reversal,checked.token);
 assert.equal(repeated.duplicate,true);assert.equal(h.stock(),4);
 await assert.rejects(h.rpc('preview',{...base,id:'ERP-fake-unrelated',lines:[{...base.lines[0],code:'NOT-WHITELISTED'}]}),/only allows the synthetic QA receipt/);
});
