// API executable entry point. Never expose anonymous writes or put OAuth tokens in Sheets.
function erpDirect(operation,input,token){
 const email=Session.getActiveUser().getEmail();
 const allowed=(PropertiesService.getScriptProperties().getProperty('ERP_ALLOWED_EMAILS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!email||!allowed.includes(email.toLowerCase()))throw Error('此帳號尚未獲准使用藥庫站內同步');
 loss3Actor_();
 if(operation==='recognizeReceipt')return erpRecognizeReceipt_(input);
 if(operation==='readAll'){
  const ss=SpreadsheetApp.openById(LOSS3.inventory),sheets={};
  for(const name of LOSS3.names)sheets[name]=erpDirectValues_(ss.getSheetByName(name));
  return {sheets};
 }
 if(operation==='readLog'){
  const logs={inventory:[ERP.inventory,ERP.log],orders:[ERP.orders,ERP.orderLog],loss:[LOSS3.inventory,LOSS3.log]};
  if(!input||!Object.prototype.hasOwnProperty.call(logs,input.log))throw Error('紀錄種類無效');
  const [id,name]=logs[input.log],sheet=SpreadsheetApp.openById(id).getSheetByName(name);
  return {values:sheet?erpDirectValues_(sheet):[]};
 }
 if(!input||!['prepareLoss','preview','commit'].includes(operation))throw Error('不支援的操作');
 // API object key order is not guaranteed; preserve semantic snapshot comparison.
 input=erpDirectCanonical_(input);
 if(input.kind==='tcm-loss-cumulative'){
  const serialized=JSON.stringify(input);
  if(operation==='prepareLoss')return lossV3PrepareDate(serialized);
  if(operation==='preview')return lossV3Preview(serialized);
  // Read back in a separate API execution to avoid stale SpreadsheetApp caches.
  return lossV3Commit(serialized,token);
 }
 if(input.kind==='tcm-cloud'&&operation!=='prepareLoss')return operation==='preview'?erpPreview(input):erpCommit(input,token);
 throw Error('交易種類無效');
}
function erpDirectCanonical_(value){
 if(Array.isArray(value))return value.map(erpDirectCanonical_);
 if(value&&typeof value==='object')return Object.keys(value).sort().reduce((out,key)=>{out[key]=erpDirectCanonical_(value[key]);return out;},{});
 return value;
}
function erpDirectValues_(sheet){
 if(!sheet)throw Error('找不到來源工作表');
 if(sheet.getLastRow()>10000||sheet.getLastColumn()>2000)throw Error('來源範圍過大，請聯絡維護人員調整讀取方式');
 return sheet.getDataRange().getDisplayValues();
}
