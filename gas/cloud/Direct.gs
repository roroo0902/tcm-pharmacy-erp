// API executable entry point. Never expose anonymous writes or put OAuth tokens in Sheets.
function erpDirect(operation,input,token){
 const email=Session.getActiveUser().getEmail();
 const allowed=(PropertiesService.getScriptProperties().getProperty('ERP_ALLOWED_EMAILS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!email||!allowed.includes(email.toLowerCase()))throw Error('此帳號尚未獲准使用藥庫站內同步');
 loss3Actor_();
 if(operation==='readStaff'){
  const sh=SpreadsheetApp.openById(LOSS3.inventory).getSheetByName('員工名冊');
  if(!sh)throw Error('找不到員工名冊工作表');
  const last=sh.getLastRow();if(last>10000)throw Error('員工名冊範圍過大');
  if(String(sh.getRange(1,2).getDisplayValue()).trim()!=='員工姓名')throw Error('員工名冊 B1 應為員工姓名');
  const names=last<2?[]:[...new Set(sh.getRange(2,2,last-1,1).getDisplayValues().map(r=>String(r[0]).trim()).filter(Boolean))];
  if(!names.length)throw Error('員工名冊尚未填寫姓名');
  return {names};
 }
 if(operation==='readOrderCatalog')return erpOrderCatalog_();
 if(operation==='readLossCatalog')return erpLossCatalog_(input);
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

// Read only: raw dates and latest cumulative audit, with no date-column creation.
function erpLossCatalog_(input){
 const date=loss3Date_(input?.date);if(date>Utilities.formatDate(new Date(),'Asia/Taipei','yyyy-MM-dd'))throw Error('不能讀取未來耗損日期');
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他交易處理中，請重新讀取');
 try{
 const data={sources:erpOrderSources_(),sheets:{},weekly:{}},ss=SpreadsheetApp.openById(LOSS3.inventory),log=ss.getSheetByName(LOSS3.log),latest=new Map();
 if(log){if(log.getRange(1,1,1,2).getValues()[0].join('|')!=='版本ID|交易JSON_V3')throw Error('耗損紀錄表頭異常');if(log.getLastRow()>1)for(const r of log.getRange(2,2,log.getLastRow()-1,1).getValues()){const e=JSON.parse(r[0]);if(e.date===date)latest.set(JSON.stringify([e.sheet,e.code]),e);}}
 const loss=[];
 for(const source of data.sources){const range=ss.getSheetByName(source.name).getDataRange(),v=range.getValues(),f=range.getFormulas(),cols=[],codes=new Map();data.sheets[source.name]=range.getDisplayValues();let headerError='';
 for(let c=13;c<(v[0]||[]).length;c++){if(!/^[一二三四五六日]$/.test(String(v[1]?.[c])))continue;try{if(loss3Date_(v[0][c])===date)cols.push(c);}catch{headerError='日期欄格式無法辨識，請核對原表';}}
 for(let i=2;i<v.length;i++){const code=String(v[i][1]||'').trim();if(code)codes.set(code,(codes.get(code)||0)+1);}
 for(let i=2;i<v.length;i++){const r=v[i],code=String(r[1]||'').trim(),name=String(r[3]||'').trim();if(!name)continue;const last=latest.get(JSON.stringify([source.name,code]));let error=headerError,posted=null,stock=r[6];
 if(cols.length>1)error='所選日期欄重複，請核對原表';
 else if(!cols.length){if(last&&(last.total!==0||last.name!==name))error='缺少日期欄但已有未歸零入帳紀錄，請核對原表';else if(!error)posted=0;}
 else {const raw=r[cols[0]];if(f[i]?.[cols[0]])error='每日耗損為公式，請核對原表';else if(raw===''||raw==null)posted=0;else if(Number.isInteger(raw)&&raw>=0&&raw<=1000000)posted=raw;else error='已入帳耗損不是有效整數';if(last&&(last.name!==name||last.total!==posted))error='每日欄與入帳紀錄不一致';}
 if(!code)error='缺少藥品編號，請先完成建帳';else if(codes.get(code)!==1)error='藥品編號重複，請核對原表';
 if(f[i]?.[6]||!Number.isInteger(stock)||stock<0)error=error||'庫存無法核對';
 if(error)posted=null;
 loss.push({sheet:source.name,code,name,row:i+1,stock:Number.isInteger(stock)?stock:null,posted,error});
 }
 }
 return {...data,date,loss,readAt:new Date().toISOString()};
 }finally{lock.releaseLock();}
}
