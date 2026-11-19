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
 if(operation==='readLossPlanning')return lossLedgerPlanning_(input);
 if(operation==='readLossPeriod')return periodRead_(input);
 if(operation==='saveLossPeriodSettings')return periodSaveSettings_(input);
 if(operation==='readLossDay')return periodDay_(input);
 if(operation==='completeLossDay')return periodComplete_(input);
 if(operation==='readShortage')return shortageRead_();
 if(operation==='saveShortage')return shortageSave_(input);
 if(operation==='readOrderCatalog')return (input?.receipt===true||input?.orderGrid===true)?erpSupplierInventoryCatalog_():erpOrderCatalog_();
 if(operation==='readLossCatalog')return erpLossCatalog_(input);
 if(operation==='recognizeReceipt')return erpRecognizeReceipt_(input);
 if(operation==='readAll'){
  const ss=SpreadsheetApp.openById(LOSS3.inventory),sheets={};
  for(const name of LOSS3.names)sheets[name]=erpDirectValues_(ss.getSheetByName(name),input?.overview===true?13:undefined);
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
function erpDirectValues_(sheet,maxColumns){
 if(!sheet)throw Error('找不到來源工作表');
 if(maxColumns){
  const lastRow=sheet.getLastRow();
  if(lastRow>10000)throw Error('來源範圍過大，請聯絡維護人員調整讀取方式');
  return sheet.getRange(1,1,Math.max(lastRow,1),Math.max(1,Math.min(sheet.getLastColumn(),maxColumns))).getDisplayValues();
 }
 if(sheet.getLastRow()>10000||sheet.getLastColumn()>2000)throw Error('來源範圍過大，請聯絡維護人員調整讀取方式');
 return sheet.getDataRange().getDisplayValues();
}

// Read only: current inventory and the requested day's cumulative audit and status.
function erpLossCatalog_(input){
 const date=loss3Date_(input?.date);if(date>Utilities.formatDate(new Date(),'Asia/Taipei','yyyy-MM-dd'))throw Error('不能讀取未來耗損日期');
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他交易處理中，請重新讀取');
 try{
  const ss=SpreadsheetApp.openById(LOSS3.inventory),sources=erpOrderSources_(ss,false),sheets={},loss=[],completion={};
  if(!sources.length)return {sources,sheets,date,loss,completion,readAt:new Date().toISOString()};
  const ranges=sources.flatMap(({name})=>{
   const title="'"+name.replace(/'/g,"''")+"'";
   return ['B:B','D:D','E1','F:G'].map(range=>title+'!'+range);
  });
  const inventory=Sheets.Spreadsheets.get(LOSS3.inventory,{ranges,fields:'sheets(properties(sheetId),data(startRow,startColumn,rowData(values(formattedValue,effectiveValue,userEnteredValue(formulaValue),effectiveFormat(numberFormat(type)))))'});
  const grids=new Map((inventory.sheets||[]).map(sh=>[sh.properties.sheetId,sh.data]));
  const ledger=lossLedgerRead_(ss,date),latestStatus=new Map();
  let completionError='';
  try{for(const r of periodStatusRows_(ss).rows)if(loss3Date_(r[0])===date)latestStatus.set(r[1],r);}
  catch(e){completionError=e.message;}
  for(const source of sources){
   const grid=grids.get(source.gid),byColumn=new Map((grid||[]).filter(g=>!g.startRow).map(g=>[g.startColumn,g.rowData||[]]));
   if([1,3,4,5].some(c=>!byColumn.has(c)))throw Error(source.name+' 庫存品項來源未完整讀取');
   const count=Math.max(...[...byColumn.values()].map(rows=>rows.length));
   if(count>10000)throw Error('來源範圍異常');
   const cell=(row,col,offset=0)=>byColumn.get(col)[row]?.values?.[offset];
   const display=c=>c?.formattedValue??'';
   const raw=c=>c?.effectiveValue?.stringValue??c?.effectiveValue?.numberValue??c?.effectiveValue?.boolValue??display(c);
   const stock=c=>['DATE','TIME','DATE_TIME'].includes(c?.effectiveFormat?.numberFormat?.type)?null:c?.effectiveValue?.numberValue;
   const values=Array.from({length:count},(_,i)=>['',raw(cell(i,1)),'',raw(cell(i,3))]);
   const rows=Array.from({length:count},(_,i)=>['',display(cell(i,1)),'',display(cell(i,3)),display(cell(i,4)),'',display(cell(i,5,1))]);
   erpSupplierHeaders_(source.name,rows);
   const snap=lossLedgerSnapshotRows_(values,source,[date],ledger);
   completion[source.name]={date,sheet:source.name,...(completionError?{error:completionError}:periodCompletionState_(snap,date,latestStatus.get(source.name)))};
   sheets[source.name]=rows;
   let ri=0;
   for(let i=2;i<count;i++){
    if(!String(values[i][3]||'').trim())continue;
    const row=snap.rows[ri++],stockCell=cell(i,5,1),bottles=stock(stockCell);
    let error=row.errors[date]||'';
    if(stockCell?.userEnteredValue?.formulaValue||cell(i,5)?.userEnteredValue?.formulaValue||!Number.isInteger(bottles)||bottles<0)error=error||'庫存或更新日期無法核對';
    loss.push({sheet:source.name,code:row.code,name:row.name,row:i+1,stock:Number.isInteger(bottles)?bottles:null,posted:error?null:row.values[date]??0,error});
   }
  }
  return {sources,sheets,date,loss,completion,readAt:new Date().toISOString()};
 }finally{lock.releaseLock();}
}

// In-memory compatibility grid for the planning calculator, never written to Sheets.
function lossLedgerPlanning_(input){
 const start=loss3Date_(input?.start),end=loss3Date_(input?.end),days=(Date.parse(end)-Date.parse(start))/86400000+1;
 if(!Number.isInteger(days)||days<1||days>63||end>periodToday_())throw Error('請選擇不超過今天的 1 至 63 天期間');
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他交易處理中');
 try{const ss=SpreadsheetApp.openById(LOSS3.inventory),source=erpOrderSources_().find(s=>s.name===input.sheet);if(!source)throw Error('廠商分類不存在');
 const dates=Array.from({length:days},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10)),ledger=lossLedgerRead_(ss),snap=lossLedgerSnapshot_(ss,source,dates,ledger),sh=ss.getSheetByName(source.name),grid=sh.getRange(1,1,Math.max(2,sh.getLastRow()),13).getDisplayValues();
 grid[0].push(...dates);grid[1].push(...dates.map(d=>'日一二三四五六'[new Date(d).getUTCDay()]));let i=0;
 for(const row of grid.slice(2)){if(!String(row[3]||'').trim()){row.push(...dates.map(()=>''));continue;}const r=snap.rows[i++];row.push(...dates.map(d=>r.errors[d]?'待核對':r.values[d]??''));}
 return {values:grid,source:'每日耗損明細'};
 }finally{lock.releaseLock();}
}
