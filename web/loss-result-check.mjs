import {checkLossResult} from './operation-result.mjs';

// Queries never submit a transaction. Compare the entire snapshot, including edits
// that reuse an operation ID, before persisting any reconciliation result.
export function createLossResultCheck({readRecord,writeRecord,readCloud,begin,blocked,disposed,report,changed,timeoutMs=60000}){
 let checking=false;
 return async()=>{
  if(checking||blocked()||disposed())return;
  checking=true;
  let screen,timer,outcome;
  try{
   const record=readRecord(),snapshot=JSON.stringify(record);
   if(!record)throw Error('找不到待核對操作，請重新整理本頁。');
   screen=begin();
   let data;
   try{
    data=await Promise.race([readCloud(record.draft),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('查詢逾時，請稍後再試；此次查詢沒有送出或扣除庫存。')),timeoutMs);})]);
   }finally{clearTimeout(timer);}
   if(disposed())return;
   if(JSON.stringify(readRecord())!==snapshot)throw Error('待核對內容已變更，這次結果未套用，請重新查詢。');
   let verified=true;
   try{checkLossResult(record.draft,data);}catch(e){
    if(e.code!=='LOSS_NOT_SYNCED')throw e;
    verified=false;
    outcome={state:'pending',title:'尚未同步一致',detail:e.message};
   }
   writeRecord({...record,verified});
   changed();
   if(verified)outcome={state:'success',title:'耗損累計核對成功',detail:'雲端當日累計與這筆填寫內容一致。這代表目前累計相符，不代表這筆操作另行扣庫。未送出的數量仍保留。'};
  }catch(e){outcome={state:'error',title:'查詢失敗／尚無法核對',detail:e.message||'請稍後重新查詢。'};}
  finally{clearTimeout(timer);screen?.close();checking=false;}
  if(!disposed()&&outcome)report(outcome);
 };
}

export function showLossCheckResult({state,title,detail}){
 const previous=document.activeElement,dialog=document.createElement('dialog');
 dialog.dataset.state=state;
 dialog.setAttribute('aria-labelledby','loss-check-heading');
 dialog.setAttribute('aria-describedby','loss-check-detail');
 const heading=document.createElement('h2');heading.id='loss-check-heading';heading.textContent=title;
 const body=document.createElement('p');body.id='loss-check-detail';body.textContent=detail;
 const note=document.createElement('p');note.textContent='本次僅查詢，沒有寫入 Google Sheets 或變更庫存。尚未一致時，請沿用原操作重新核對，避免重複送出。';
 const close=document.createElement('button');close.type='button';close.textContent='關閉';close.autofocus=true;
 close.onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();},{once:true});
 dialog.append(heading,body,note,close);document.body.append(dialog);dialog.showModal();
}
