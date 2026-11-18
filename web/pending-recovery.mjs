import {cloudDraft} from '../src/cloud-transaction.mjs?v=compact20261030';
import {directLog,directReview} from './direct-sync.mjs?v=compact20261030';
import {csvRows} from './sheets-data.mjs?v=compact20261030';

const KEY='tcm-cloud-pending-v1';

export async function lookupPostedTransaction(draft){
 const log=['訂貨','取消訂貨'].includes(draft.action)?'orders':'inventory';
 const [header,...records]=csvRows(await (await directLog(log)).text());
 if(header&&(header[0]!=='交易編號'||header[1]!=='交易JSON'))throw Error('交易紀錄表頭無法核對');
 const found=records.find(row=>row[0]===draft.id);
 if(!found)return null;
 const event=JSON.parse(found[1]);
 if(event.draft?.id!==draft.id||event.draft.action!==draft.action)throw Error('交易紀錄內容無法核對');
 return event;
}

export async function recoverPendingTransaction({action,ask,status,isActive,onChange,onResolved,receiptRows,returnLabel,storageKey=KEY,onContinue,completionLabel,reviewIntro,reviewLabel}){
 const receipt=action==='進貨',resultLabel=receipt?'入帳':'同步';
 status(`正在查詢上一筆${action}的${resultLabel}結果…`);
 let saved,current,draft,event;
 try{
  saved=localStorage.getItem(storageKey);
  current=JSON.parse(saved||'null');
  if(current?.action!==action||current.verified){
   onChange();
   status('上一筆狀態已更新。');
   return;
  }
  draft=cloudDraft(current);
  event=await lookupPostedTransaction(draft);
 }catch(e){
  status(`暫時無法確認${resultLabel}狀態。`+e.message);
  return 'retry';
 }

 if(!isActive())return;
 if(saved!==localStorage.getItem(storageKey)){
  onChange();
  status('上一筆狀態已更新，請查看目前狀態。');
  return;
 }
 const storeResult=completed=>{
  if(saved===localStorage.getItem(storageKey)){
   localStorage.setItem(storageKey,JSON.stringify({...completed.draft,verified:true,...(receipt?{receiptEvent:completed}:{}),...(current.receiptInput?{receiptInput:current.receiptInput}:{})}));
  }
 };
 if(event){
  storeResult(event);
  await onResolved({alreadyPosted:true,posted:event.draft,pending:current});
  return;
 }

 status(`查無${resultLabel}紀錄，正在開啟上一筆${action}預覽…`);
 await directReview(draft,ask,async result=>{
  storeResult({draft,lines:result.lines||[],time:result.time});
  if(isActive())await onResolved({alreadyPosted:false,posted:draft,pending:current});
 },status,{
  requireUnposted:true,receiptRows,returnLabel,onContinue,completionLabel,reviewIntro,reviewLabel,
  beforeCommit:()=>{
   if(saved!==localStorage.getItem(storageKey))throw Error('待核對的交易已變動，請重新查詢。');
  },
  onDraftChange:receipt?next=>{
   Object.assign(draft,next);
   if(saved===localStorage.getItem(storageKey)){
    saved=JSON.stringify({...current,...draft});
    localStorage.setItem(storageKey,saved);
   }
   if(isActive())onChange();
  }:undefined
 });
}
