// Shares the existing loss deployment, authentication, and ScriptLock.
const ERP={inventory:LOSS3.inventory,orders:'1YcO7XRhN4T8wrL6wn-jD45lqif--rYQF4HCuBE-Nju8',log:'藥庫_同步紀錄',logId:904291001,orderLog:'藥庫_訂貨紀錄',orderLogId:904291002};
function erpRead_(input){
 loss3Actor_();const draft=CloudTransaction.cloudDraft(input);
 if(draft.date>Utilities.formatDate(new Date(),'Asia/Taipei','yyyy-MM-dd'))throw Error('不可登錄未來日期');
 const ss=SpreadsheetApp.openById(['訂貨','取消訂貨'].includes(draft.action)?ERP.orders:ERP.inventory),title=['訂貨','取消訂貨'].includes(draft.action)?ERP.orderLog:ERP.log,log=ss.getSheetByName(title);
 if(log&&log.getRange(1,1).getValue()!=='交易編號')throw Error('紀錄表頭異常');
 const events=log&&log.getLastRow()>1?log.getRange(2,2,log.getLastRow()-1,1).getValues().map(r=>JSON.parse(r[0])):[];
 const inv=SpreadsheetApp.openById(ERP.inventory),tabs={},rows=[];
 for(const name of [...new Set(draft.lines.map(l=>l.sheet))]){
  const sh=inv.getSheetByName(name);if(!sh)throw Error('缺少庫存分頁');
  const v=sh.getDataRange().getValues(),f=sh.getDataRange().getFormulas();if(v[0][1]!=='編號'||v[0][3]!=='藥品名稱'||v[1][6]!=='未拆封')throw Error('庫存欄位異常');
  if(draft.version===2&&v[0][4]!=='價格')throw Error('E欄價格表頭異常，尚未入帳');
  tabs[name]={sh,v,f};for(let r=2;r<v.length;r++)if(v[r][1]||v[r][3])rows.push({sheet:name,code:String(v[r][1]).trim(),name:String(v[r][3]).trim(),stock:v[r][6],formula:f[r][6],price:v[r][4],priceFormula:f[r][4],row:r,sheetId:sh.getSheetId()});
 }
 const plan=CloudTransaction.cloudPlan(draft,rows,events);
 const weekly=erpWeeklyRead_(draft,ss,tabs,events,plan);
 return {draft,ss,title,log,events,tabs,plan,weekly,token:loss3Hash_({draft,plan,rows,weekly})};
}
function erpPreview(input){const s=erpRead_(input);return {token:s.token,...s.plan};}
function erpCommit(input,token){
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他交易處理中，請重新預覽');
 try{
  const s=erpRead_(input);if(s.plan.duplicate)return {message:'此交易已入帳，沒有重複寫入。',id:s.draft.id,lines:s.plan.lines};
  if(!token||token!==s.token)throw Error('雲端資料已變動，請重新預覽');
  const requests=[],id=s.log?s.log.getSheetId():['訂貨','取消訂貨'].includes(s.draft.action)?ERP.orderLogId:ERP.logId;
  if(!s.log){requests.push({addSheet:{properties:{sheetId:id,title:s.title,gridProperties:{rowCount:1000,columnCount:9,frozenRowCount:1}}}});['交易編號','交易JSON','日期','操作','經手人','備註','品項摘要','狀態','時間'].forEach((v,c)=>requests.push(loss3Cell_(id,0,c,v)));requests.push({repeatCell:{range:{sheetId:id,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:0.13,green:0.24,blue:0.34},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat'}});}
  const guard='erp_'+loss3Hash_(s.draft.id);requests.push({addNamedRange:{namedRange:{namedRangeId:guard,name:guard,range:{sheetId:id,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:1}}}});
  const nextRows={};
  for(const l of s.plan.lines){
   if(['訂貨','取消訂貨'].includes(s.draft.action))continue;
   const t=s.tabs[l.sheet];
   if(s.draft.action==='建檔'){
    // Append beyond every existing value/formula; never overwrite a formatted/spilled row.
    const row=nextRows[l.sheet]===undefined?t.sh.getMaxRows():nextRows[l.sheet];nextRows[l.sheet]=row+1;l.row=row;l.sheetId=t.sh.getSheetId();
    requests.push({appendDimension:{sheetId:l.sheetId,dimension:'ROWS',length:1}},loss3Cell_(l.sheetId,row,1,l.code),loss3Cell_(l.sheetId,row,3,l.name));
   }
   requests.push(loss3Cell_(l.sheetId,l.row,6,l.after),loss3Cell_(l.sheetId,l.row,5,s.draft.date));
   if(s.draft.action==='進貨'&&l.unitPriceCents!==undefined)requests.push(loss3Cell_(l.sheetId,l.row,4,l.unitPriceCents/100));
  }
  if(s.draft.action==='取消訂貨'){const originalRow=s.events.findIndex(e=>e.draft.id===s.draft.reverses)+1;requests.push(loss3Cell_(id,originalRow,7,'已取消・未發送'));}
  requests.push(...(s.weekly?.requests||[]));
  const event={draft:s.draft,lines:s.plan.lines,weekly:s.weekly?.changes||[],time:new Date().toISOString()};
  const priced=['進貨','沖銷'].includes(s.draft.action),missing=s.draft.lines.filter(l=>l.unitPriceCents===undefined).length,total=s.draft.lines.reduce((n,l)=>n+(l.unitPriceCents||0)*l.quantity,0);
  const summary=s.draft.lines.map(l=>l.sheet+' '+l.code+' '+l.name+' '+l.quantity+'瓶'+(priced?(l.unitPriceCents===undefined?'（單價未提供）':' × NT$'+(l.unitPriceCents/100).toFixed(2)+' = NT$'+(l.unitPriceCents*l.quantity/100).toFixed(2)):'')).join('；')+(priced?'；'+(missing?'已填單價小計':'進貨金額合計')+' NT$'+(total/100).toFixed(2)+(missing?'（'+missing+'項未提供單價）':''):'');
  const values=[s.draft.id,JSON.stringify(event),s.draft.date,s.draft.action,s.draft.actor,s.draft.note,summary,s.draft.action==='訂貨'?'待發送・未入庫':s.draft.action==='取消訂貨'?'已取消・未發送':'已入帳',event.time];
  requests.push({appendCells:{sheetId:id,rows:[{values:values.map(v=>({userEnteredValue:{stringValue:v}}))}],fields:'userEnteredValue'}});
  Sheets.Spreadsheets.batchUpdate({requests},s.ss.getId());
  SpreadsheetApp.flush();
  const check=erpRead_(s.draft);if(!check.plan.duplicate)throw Error('寫入結果待核對，請用同一交易編號重新預覽');
  for(const l of s.plan.lines)if(s.draft.action==='進貨'&&l.unitPriceCents!==undefined){const v=check.tabs[l.sheet].v[l.row];if(v[4]!==l.unitPriceCents/100||v[6]!==l.after)throw Error('入帳後價格或庫存讀回不一致，請用同一交易編號核對，勿另建交易');}
  erpWeeklyVerify_(s.ss,s.weekly?.changes||[]);
  return {id:s.draft.id,lines:s.plan.lines,message:'Google 工作表已寫入並讀回核對。'+(s.draft.action==='訂貨'?'本周訂貨量已同步；訂單待發送，尚未入庫。':s.draft.action==='取消訂貨'?'訂單已取消，本周訂貨量已還原，沒有庫存異動。':'')};
 }finally{lock.releaseLock();}
}
function erpHtml_(payload){return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;background:#f7f5ea;color:#172c43;margin:20px;max-width:900px}button{min-height:44px;font:inherit;padding:10px;margin:6px;background:#203e58;color:white;border:0;border-radius:8px}textarea{width:95%;min-height:120px;font-size:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:16px}a{color:#174d77}</style></head><body><h1>Google 藥庫同步確認</h1><p>建檔與進貨寫入庫存總表；訂貨寫入訂藥工作表。只有下方確認按鈕會正式入帳。</p><label id="label">交易清單<textarea id="draft"></textarea></label><button id="preview">讀取雲端並預覽</button><pre id="result">請先預覽。</pre><button id="commit" disabled>確認同步到 Google Sheet</button><p><a target="_blank" href="https://docs.google.com/spreadsheets/d/'+ERP.inventory+'/edit">開啟庫存工作表</a> · <a target="_blank" href="https://docs.google.com/spreadsheets/d/'+ERP.orders+'/edit">開啟訂貨工作表</a> · <a target="_blank" href="https://roroo0902.github.io/tcm-pharmacy-erp/#overview">回庫存總覽並按立即同步</a></p><script>const draft=document.querySelector("#draft"),out=document.querySelector("#result"),p=document.querySelector("#preview"),b=document.querySelector("#commit");draft.value='+JSON.stringify(payload).replace(/</g,'\\u003c')+';document.querySelector("#label").hidden=!!draft.value;let token,reviewed;draft.oninput=()=>b.disabled=true;p.onclick=()=>{b.disabled=true;p.disabled=true;reviewed=draft.value;out.textContent="正在讀取Google…";google.script.run.withSuccessHandler(r=>{token=r.token;out.textContent=(r.duplicate?"已入帳，重送不會重複寫入。\\n":"")+r.lines.map(x=>x.sheet+" "+x.code+" "+x.name+"：數量 "+x.quantity+"；庫存 "+x.before+" → "+x.after+(x.unitPriceCents===undefined?"":"；單價 NT$"+(x.unitPriceCents/100).toFixed(2)+"；小計 NT$"+(x.amountCents/100).toFixed(2))+(x.priceAfter===undefined?"":"；E欄價格 "+x.priceBefore+" → "+x.priceAfter)).join("\\n");b.disabled=false;p.disabled=false;}).withFailureHandler(e=>{out.textContent=e.message;p.disabled=false;}).erpPreview(reviewed);};b.onclick=()=>{b.disabled=true;p.disabled=true;out.textContent="正在寫入並讀回…";google.script.run.withSuccessHandler(r=>{out.textContent=r.message+"\\n交易編號："+r.id+"\\n"+r.lines.map(x=>x.code+" 庫存 "+x.after).join("\\n");p.disabled=false;}).withFailureHandler(e=>{out.textContent=e.message+"\\n若結果不明，請重新預覽本交易；勿另建交易重送。";p.disabled=false;}).erpCommit(reviewed,token);};</script></body></html>';}
