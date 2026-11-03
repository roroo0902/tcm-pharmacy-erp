// Append-only daily cumulative ledger. Source inventory date columns are never written.
const LOSS_LEDGER='每日耗損明細';
const LOSS_LEDGER_HEADERS=['日期','廠商／類別','藥品編號','藥品名稱','當日累計瓶數','版本','來源','核對狀態','備註','經手人','更新時間'];
function lossLedgerRead_(ss){
 const sh=ss.getSheetByName(LOSS_LEDGER);if(!sh)throw Error('獨立耗損明細尚未完成移轉，請聯絡維護人員');
 if(sh.getLastRow()>100000)throw Error('耗損明細已達讀取上限，請先封存');
 const v=sh.getDataRange().getValues(),latest=new Map();
 if(v[0].slice(0,11).join('|')!==LOSS_LEDGER_HEADERS.join('|'))throw Error('每日耗損明細表頭已變更');
 for(const r of v.slice(1)){if(r.every(x=>x===''))continue;const date=loss3Date_(r[0]),key=JSON.stringify([date,String(r[1]),String(r[2])]);
 if(!r[1]||!r[2]||!r[3]||!Number.isInteger(r[5])||r[5]<0||!['已核對','待核對'].includes(r[7]))throw Error('每日耗損明細格式待核對');
 if(r[7]==='已核對')LossCumulative.lossUnits(r[4]);
 const old=latest.get(key);if(old&&r[5]<=old.revision)throw Error('每日耗損明細版本重複或倒退');
 latest.set(key,{key,date,sheet:String(r[1]),code:String(r[2]),name:String(r[3]),total:r[4],revision:r[5],error:r[7]==='待核對'?String(r[8]||'歷史資料待核對'):'',origin:r[6]});}
 return {sh,latest};
}
function lossLedgerRows_(changes,actor,time){return changes.map(r=>[r.date,r.sheet,r.code,r.name,r.total,r.revision+1,'耗損入帳','已核對',r.reason||'',actor,time]);}
function lossLedgerAppend_(sh,rows){return {appendCells:{sheetId:sh.getSheetId(),rows:rows.map(r=>({values:r.map(v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v)}}))})),fields:'userEnteredValue'}};}
function lossLedgerSnapshot_(ss,source,dates,ledger){
 const sh=ss.getSheetByName(source.name);if(!sh||sh.getLastRow()>10000)throw Error('來源範圍異常');
 const v=sh.getRange(1,1,Math.max(2,sh.getLastRow()),7).getValues(),counts=new Map();
 for(const r of v.slice(2)){const code=String(r[1]||'').trim();if(code)counts.set(code,(counts.get(code)||0)+1);}
 const rows=v.slice(2).filter(r=>String(r[3]||'').trim()).map(r=>{const code=String(r[1]||'').trim(),name=String(r[3]).trim(),values={},errors={};for(const date of dates){const entry=ledger.latest.get(JSON.stringify([date,source.name,code]));values[date]=entry?.error?null:entry?.total??null;const error=!code||counts.get(code)!==1?'編號缺少或重複':entry?.error|| (entry&&entry.name!==name?'明細藥名與目前品項不符':'');if(error)errors[date]=error;}return {sheet:source.name,code,name,values,errors};});
 const fingerprints={};for(const d of dates)fingerprints[d]=loss3Hash_(['ledger-v1',source.gid,d,rows.map(r=>[r.code,r.name,r.values[d],r.errors[d]||'',ledger.latest.get(JSON.stringify([d,source.name,r.code]))?.revision||0])]);
 return {rows,fingerprints};
}
// Explicit one-time migration, never called by period reads or preview. No inventory writes.
function lossLedgerMigrate(){
 loss3Actor_();const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{const ss=SpreadsheetApp.openById(LOSS3.inventory);if(ss.getSheetByName(LOSS_LEDGER))return {alreadyMigrated:true,entries:lossLedgerRead_(ss).latest.size};
 const sources=erpOrderSources_(),rows=[],issues=[],time=new Date().toISOString(),before=lossLedgerSourceHash_(ss,sources);
 for(const source of sources){const sh=ss.getSheetByName(source.name),v=sh.getDataRange().getValues(),dates=new Set(),bad=[];
 for(let c=13;c<(v[0]||[]).length;c++){if(!/^[一二三四五六日]$/.test(String(v[1]?.[c])))continue;try{dates.add(loss3Date_(v[0][c]));}catch{bad.push(c+1);}}
 const allEvents=periodEvents_(ss,null);for(const e of allEvents.values())if(e.sheet===source.name)dates.add(e.date);
 if(bad.length)issues.push([source.name,'','', '日期標題無法辨識：欄 '+bad.join(','),'原表保留，未移入',time]);
 const snap=periodLegacySnapshot_(ss,source,[...dates],allEvents);
 for(const r of snap.rows){if(!r.code){issues.push([source.name,'',r.name,'缺少編號','原表保留，未移入',time]);continue;}
 for(const date of dates){const e=allEvents.get(JSON.stringify([date,source.name,r.code])),error=r.errors[date]||'',total=r.values[date];
 if(total===null&&!error&&!e)continue;
 rows.push([date,source.name,r.code,r.name,error?'':total??0,e?.revision||0,'歷史移轉',error?'待核對':'已核對',error,'系統移轉',time]);if(error)issues.push([source.name,date,r.code,error,'保留待核對，不計入合計',time]);}}
 }
 // Duplicate source codes cannot produce multiple ledger identities.
 const unique=new Map();for(const r of rows){const key=JSON.stringify(r.slice(0,3));if(unique.has(key)){r[4]='';r[7]='待核對';r[8]='編號重複';}unique.set(key,r);}
 const id=1850311040,issueId=1850311041,requests=[];
 for(const [sheetId,title,headers,body] of [[id,LOSS_LEDGER,LOSS_LEDGER_HEADERS,[...unique.values()]],[issueId,'耗損明細移轉核對',['廠商／類別','日期','編號／藥名','待核對原因','處理狀態','移轉時間'],issues]]){
 requests.push({addSheet:{properties:{sheetId,title,gridProperties:{rowCount:Math.max(1000,body.length+100),columnCount:headers.length,frozenRowCount:1}}}});
 requests.push(lossLedgerAppend_({getSheetId:()=>sheetId},[headers,...body]));
 requests.push({repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:.13,green:.24,blue:.34},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat'}});
 requests.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:0,endIndex:headers.length},properties:{pixelSize:150},fields:'pixelSize'}});
 }
 if(before!==lossLedgerSourceHash_(ss,sources))throw Error('來源在移轉期間變更，請重新執行');
 Sheets.Spreadsheets.batchUpdate({requests},LOSS3.inventory);SpreadsheetApp.flush();
 const after=lossLedgerSourceHash_(ss,sources);if(before!==after)throw Error('原表在移轉期間發生變更，請核對');
 const result={migrated:true,entries:unique.size,issues:issues.length,sourceUnchanged:true,sourceHash:after};console.log(JSON.stringify(result));return result;
 }finally{lock.releaseLock();}
}
function lossLedgerSourceHash_(ss,sources){return loss3Hash_(sources.map(s=>{const sh=ss.getSheetByName(s.name),r=sh.getDataRange();return [s.name,sh.getMaxColumns(),sh.getMaxRows(),r.getValues(),r.getFormulas()];}));}
