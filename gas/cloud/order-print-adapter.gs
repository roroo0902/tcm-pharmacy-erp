// Only the stored confirmed transaction is accepted. No quantities supplied by the browser.
const ORDER_PRINT_ID='1oAF12BHo29MwFSEmprRXITwXAJqPH2tbINCm0dgjib8';
function erpPrintConfirmedOrder(input){
 const id=typeof input==='string'?input:input.id;
 loss3Actor_();
 const email=Session.getActiveUser().getEmail().toLowerCase(),allowed=(PropertiesService.getScriptProperties().getProperty('ERP_ALLOWED_EMAILS')||'').split(',').map(s=>s.trim().toLowerCase());
 if(!email||!allowed.includes(email))throw Error('此帳號尚未獲准使用藥庫站內同步');
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他作業處理中，請稍後重試列印');
 try{
  const log=SpreadsheetApp.openById(ERP.orders).getSheetByName(ERP.orderLog);
  if(!log||log.getRange(1,1).getValue()!=='交易編號'||log.getLastRow()<2||log.getLastRow()>10000)throw Error('訂貨紀錄無法核對');
  const events=log.getRange(2,1,log.getLastRow()-1,2).getValues().filter(r=>r[0]||r[1]).map(r=>{const e=JSON.parse(r[1]);if(e?.draft?.id!==r[0])throw Error('訂貨紀錄編號不一致');return e;});
  const plans=typeof input==='object'&&input.draft?orderDeliveryRevised_(id,input.draft):confirmedPrintPlan_(events,id);for(const p of plans)if(p.edited){p.values[0][0]=(p.merged?'更新版，取代前版，請勿重複下單｜':'')+p.brand+'訂購清單｜'+p.date+'｜'+p.actor+'｜來源：'+(p.sources||[{id:p.id}]).map(x=>x.id).join('、');}const ss=SpreadsheetApp.openById(ORDER_PRINT_ID),requests=[],used=new Set(ss.getSheets().map(s=>s.getSheetId())),stamp=Utilities.formatDate(new Date(),'Asia/Taipei','yyyyMMdd_HHmmss');
  const nextId=()=>{let n=100;while(used.has(n))n++;used.add(n);return n;};
  for(const p of plans){
   let sh=ss.getSheetByName(p.title);p.sheetId=sh?sh.getSheetId():nextId();p.note=JSON.stringify({kind:'erp-confirmed-order-print-v1',id:p.id,count:p.count,...(p.edited?{hash:loss3Hash_(p.values),sources:p.sources||[]}:{} )});
   if(sh&&sh.getRange(1,1).getNote()===p.note&&JSON.stringify(sh.getRange(1,1,24,p.values[0].length).getValues())===JSON.stringify(p.values)){p.unchanged=true;continue;}
   if(sh){const backupId=nextId();p.backup='備份_'+p.brand+'_'+stamp+'_'+backupId;requests.push({duplicateSheet:{sourceSheetId:p.sheetId,newSheetId:backupId,newSheetName:p.backup}},{updateSheetProperties:{properties:{sheetId:backupId,hidden:true},fields:'hidden'}});}
   else requests.push({addSheet:{properties:{sheetId:p.sheetId,title:p.title,gridProperties:{rowCount:30,columnCount:Math.max(2,p.values[0].length)}}}});
   const width=Math.max(sh?sh.getMaxColumns():2,p.values[0].length),height=Math.max(sh?sh.getMaxRows():30,24),range={sheetId:p.sheetId,startRowIndex:0,endRowIndex:height,startColumnIndex:0,endColumnIndex:width};
   if(sh&&(width>sh.getMaxColumns()||height>sh.getMaxRows()))requests.push({updateSheetProperties:{properties:{sheetId:p.sheetId,gridProperties:{rowCount:height,columnCount:width}},fields:'gridProperties.rowCount,gridProperties.columnCount'}});
   requests.push({unmergeCells:{range}},{repeatCell:{range,cell:{},fields:'userEnteredValue,userEnteredFormat,note,dataValidation'}});
   const cells=p.values.map((r,ri)=>({values:r.map((v,ci)=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:v},...(ri===0&&ci===0?{note:p.note}:{})}))}));
   requests.push({updateCells:{start:{sheetId:p.sheetId,rowIndex:0,columnIndex:0},rows:cells,fields:'userEnteredValue,note'}});
   const output={sheetId:p.sheetId,startRowIndex:0,endRowIndex:24,startColumnIndex:0,endColumnIndex:p.values[0].length};
   requests.push({repeatCell:{range:output,cell:{userEnteredFormat:{horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE',wrapStrategy:'WRAP',textFormat:{fontFamily:'Microsoft JhengHei',fontSize:11}}},fields:'userEnteredFormat'}},
    {mergeCells:{range:{...output,endRowIndex:1},mergeType:'MERGE_ALL'}},
    {repeatCell:{range:{...output,endRowIndex:2},cell:{userEnteredFormat:{textFormat:{bold:true,fontSize:12},backgroundColor:{red:0.95,green:0.95,blue:0.95}}},fields:'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor'}},
    {updateBorders:{range:{...output,startRowIndex:1},top:{style:'SOLID'},bottom:{style:'SOLID'},left:{style:'SOLID'},right:{style:'SOLID'},innerHorizontal:{style:'SOLID'},innerVertical:{style:'SOLID'}}},
    {updateDimensionProperties:{range:{sheetId:p.sheetId,dimension:'ROWS',startIndex:0,endIndex:24},properties:{pixelSize:32},fields:'pixelSize'}},
    {updateDimensionProperties:{range:{sheetId:p.sheetId,dimension:'ROWS',startIndex:0,endIndex:1},properties:{pixelSize:p.merged?120:p.values[0].length===2?80:40},fields:'pixelSize'}},
    {updateDimensionProperties:{range:{sheetId:p.sheetId,dimension:'ROWS',startIndex:1,endIndex:2},properties:{pixelSize:44},fields:'pixelSize'}});
   for(let c=0;c<p.values[0].length;c++)requests.push({updateDimensionProperties:{range:{sheetId:p.sheetId,dimension:'COLUMNS',startIndex:c,endIndex:c+1},properties:{pixelSize:c%2?70:150},fields:'pixelSize'}});
  }
  if(requests.length)Sheets.Spreadsheets.batchUpdate({requests},ORDER_PRINT_ID);
  // Independent API readback, including empty trailing rows, avoids SpreadsheetApp caches.
  for(const p of plans){const a1="'"+p.title.replace(/'/g,"''")+"'!A1:"+orderPrintColumn_(p.values[0].length)+'24',got=Sheets.Spreadsheets.Values.get(ORDER_PRINT_ID,a1,{valueRenderOption:'UNFORMATTED_VALUE'}).values||[];
   for(let r=0;r<24;r++)for(let c=0;c<p.values[0].length;c++)if((got[r]?.[c]??'')!==p.values[r][c])throw Error('列印版讀回不一致，請以同一訂單重試列印；勿重送訂貨');
  }
  return {id,count:plans.reduce((n,p)=>n+p.count,0),sheets:plans.map(p=>({title:p.title,count:p.count,url:'https://docs.google.com/spreadsheets/d/'+ORDER_PRINT_ID+'/edit#gid='+p.sheetId,backup:p.backup||'',unchanged:!!p.unchanged})),message:'列印版已產生並讀回核對；訂貨紀錄與庫存未變更。'};
 }finally{lock.releaseLock();}
}
function orderPrintColumn_(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
