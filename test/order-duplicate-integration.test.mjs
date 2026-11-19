import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

// No network or Google services: execute production commit/planning against an in-memory atomic ledger.
function harness({lostReply=false, reenter=false}={}) {
 const events=[], batches=[], guards=new Set(); let weekly='', locked=false, releases=0, nestedError;
 const line={sheet:'科達單方',code:'QA-DUP',name:'ERP驗收專用非藥品',quantity:1};
 const c=vm.createContext({console,LOSS3:{inventory:'mock-inventory'},loss3Actor_:()=> 'QA',
  loss3Hash_:v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),
  loss3Cell_:(id,row,col,v)=>({updateCells:{start:{sheetId:id,rowIndex:row,columnIndex:col},rows:[{values:[{userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:v}}]}],fields:'userEnteredValue'}}),
  LockService:{getScriptLock:()=>({tryLock(){if(locked)return false;locked=true;return true;},releaseLock(){locked=false;releases++;}})},
  SpreadsheetApp:{flush(){}},Sheets:{Spreadsheets:{batchUpdate(b,id){
   assert.equal(id,'mock-orders');
   if(reenter){reenter=false;try{c.erpCommit(currentDraft,currentToken);}catch(e){nestedError=e;}}
   for(const r of b.requests)if(r.addNamedRange){const key=r.addNamedRange.namedRange.namedRangeId;assert.ok(!guards.has(key));guards.add(key);}
   for(const r of b.requests){if(r.appendCells)events.push(JSON.parse(r.appendCells.rows[0].values[1].userEnteredValue.stringValue));if(r.updateCells?.start.sheetId===12)weekly=r.updateCells.rows[0].values[0].userEnteredValue?.numberValue??'';}
   batches.push(b);if(lostReply){lostReply=false;throw Error('simulated timeout AFTER atomic commit');}
  }}}});
 vm.runInContext(fs.readFileSync('gas/cloud/Cloud.gs','utf8'),c);
 c.erpRegistrationSheets_=()=>[];c.erpFinishRegistration_=()=>[];
 let currentDraft,currentToken;
 const ss={getId:()=> 'mock-orders',getSheetByName:()=>({getSheetId:()=>12,getRange:()=>({getValues:()=>[[line.code,line.name,weekly]]})})};
 c.erpRead_=input=>{
  const draft=vm.runInContext('CloudTransaction',c).cloudDraft(input);
  const plan=vm.runInContext('CloudTransaction',c).cloudPlan(draft,[{...line,stock:0,row:2,sheetId:11}],events);
  const w=plan.duplicate?null:c.erpWeeklyTransition_(draft,draft.lines[0],weekly,events,12);
  if(w)w.row=2;
  const requests=w?[c.loss3Cell_(12,2,3,w.after)]:[];
  if(w?.after==='')requests[0].updateCells.rows[0].values[0]={};
  return {draft,plan,ss,log:{getSheetId:()=>13},title:'mock-log',events,tabs:{},weekly:{changes:w?[w]:[],requests},token:c.loss3Hash_({draft,plan,weekly})};
 };
 const order=(id,quantity=1)=>({kind:'tcm-cloud',version:1,id:'ERP-'+id+'-12345678',action:'訂貨',date:'2026-11-20',actor:'QA',note:'isolated mock only',lines:[{...line,quantity}]});
 const preview=d=>c.erpPreview(d).token;
 const commit=(d,token=preview(d))=>{currentDraft=d;currentToken=token;return c.erpCommit(d,token);};
 const cancel=d=>({...d,id:d.id+'-cancel',action:'取消訂貨',reverses:d.id});
 return {events,batches,order,preview,commit,cancel,get weekly(){return weekly;},get releases(){return releases;},get nestedError(){return nestedError;}};
}

test('same confirmation rapid retry writes one order and weekly quantity once',()=>{
 const h=harness({reenter:true}),d=h.order('double'),token=h.preview(d);
 h.commit(d,token);assert.match(h.nestedError.message,/其他交易/);
 const retry=h.commit(d,token);assert.match(retry.message,/沒有重複/);
 assert.equal(h.events.length,1);assert.equal(h.batches.length,1);assert.equal(h.weekly,1);assert.equal(h.releases,2);
});
test('timeout AFTER atomic write then same-ID retry returns saved order without another batch',()=>{
 const h=harness({lostReply:true}),d=h.order('timeout'),token=h.preview(d);
 assert.throws(()=>h.commit(d,token),/AFTER atomic/);assert.equal(h.events.length,1);assert.equal(h.weekly,1);
 h.commit(d,token);assert.equal(h.events.length,1);assert.equal(h.batches.length,1);assert.equal(h.releases,2);
});
test('different confirmations same item remain separate; latest quantity replaces, not adds',()=>{
 const h=harness(),a=h.order('first',1),b=h.order('second',2),stale=h.preview(b);
 h.commit(a);assert.throws(()=>h.commit(b,stale),/重新預覽/);
 h.commit(b);assert.equal(h.events.length,2);assert.equal(h.weekly,2);
 assert.deepEqual(h.events.map(e=>e.lines[0].after),[0,0]);
});
for(const newestFirst of [false,true])test('cancel '+(newestFirst?'newest':'older')+' same-item confirmation preserves remaining order and blank baseline',()=>{
 const h=harness(),a=h.order('a',1),b=h.order('b',2);h.commit(a);h.commit(b);
 const first=newestFirst?b:a,second=newestFirst?a:b,ca=h.cancel(first);
 h.commit(ca);assert.equal(h.weekly,newestFirst?1:2);
 h.commit(ca);assert.equal(h.events.length,3);
 h.commit(h.cancel(second));assert.equal(h.weekly,'');assert.equal(h.events.length,4);
});
test('distinct IDs with identical quantities are not deduplicated by item; cancel one keeps the other',()=>{
 const h=harness(),a=h.order('same-a'),b=h.order('same-b');h.commit(a);h.commit(b);
 assert.equal(h.events.length,2);assert.equal(h.weekly,1);h.commit(h.cancel(a));assert.equal(h.weekly,1);
 h.commit(h.cancel(b));assert.equal(h.weekly,'');
});
