const PERIOD_SETTINGS='訂貨統計設定',PERIOD_STATUS='耗損登錄狀態';
const PERIOD_HEADERS=['日期','廠商／類別','登錄狀態','經手人','更新時間','資料指紋'];
function periodToday_(){return Utilities.formatDate(new Date(),'Asia/Taipei','yyyy-MM-dd');}
function periodSettings_(ss){
 const sh=ss.getSheetByName(PERIOD_SETTINGS);if(!sh)throw Error('請先建立訂貨統計設定工作表');
 const v=sh.getRange(1,1,6,2).getValues();if(v[1][0]!=='擷取天數'||v[2][0]!=='包含今天')throw Error('訂貨統計設定欄位已變更');
 return {days:v[1][1],includeToday:v[2][1]};
}
function periodStatusRows_(ss){const sh=ss.getSheetByName(PERIOD_STATUS);if(!sh)throw Error('請先建立耗損登錄狀態工作表');if(sh.getLastRow()>30000)throw Error('登錄狀態紀錄過多，請先封存');const v=sh.getDataRange().getValues();if(v[0].slice(0,6).join('|')!==PERIOD_HEADERS.join('|'))throw Error('耗損登錄狀態欄位已變更');return {sh,rows:v.slice(1).filter(r=>r.some(x=>x!==''))};}
function periodEvents_(ss,dates){const latest=new Map(),log=ss.getSheetByName(LOSS3.log);if(!log)return latest;if(log.getLastRow()>30000)throw Error('耗損紀錄過多，請先封存');if(log.getRange(1,1,1,2).getValues()[0].join('|')!=='版本ID|交易JSON_V3')throw Error('耗損紀錄欄位異常');if(log.getLastRow()>1)for(const r of log.getRange(2,2,log.getLastRow()-1,1).getValues()){if(!r[0])continue;const e=JSON.parse(r[0]);if(dates.includes(e.date))latest.set(JSON.stringify([e.date,e.sheet,e.code]),e);}return latest;}
// One raw range read per supplier, never aggregate weekly subtotal columns or audit snapshots.
function periodSnapshot_(ss,source,dates,events){
 const sh=ss.getSheetByName(source.name);if(!sh||sh.getLastRow()>10000||sh.getLastColumn()>2000)throw Error('來源範圍異常');
 const range=sh.getDataRange(),v=range.getValues(),f=range.getFormulas(),columns={},badHeaders=[];
 for(let c=13;c<(v[0]||[]).length;c++){if(!/^[一二三四五六日]$/.test(String(v[1]?.[c])))continue;let d;try{d=loss3Date_(v[0][c]);}catch{badHeaders.push(c+1);continue;}if(dates.includes(d))(columns[d]||(columns[d]=[])).push(c);}
 const counts=new Map();for(const r of v.slice(2)){const code=String(r[1]||'').trim();if(code)counts.set(code,(counts.get(code)||0)+1);}
 const rows=v.slice(2).filter(r=>String(r[3]||'').trim()).map(r=>({sheet:source.name,code:String(r[1]||'').trim(),name:String(r[3]).trim(),values:{},errors:{}}));
 let idx=0;for(let i=2;i<v.length;i++){if(!String(v[i][3]||'').trim())continue;const row=rows[idx++];for(const date of dates){const cols=columns[date]||[],event=events.get(JSON.stringify([date,source.name,row.code]));let error='';let value=null;
 if(!row.code||counts.get(row.code)!==1)error='編號缺少或重複';else if(badHeaders.length)error='日期標題格式待核對';else if(cols.length>1)error=date+' 日期欄重複';else if(cols.length===1){const c=cols[0],raw=v[i][c];if(f[i]?.[c])error=date+' 每日欄不可為公式';else if(raw===''||raw==null)value=null;else if(Number.isInteger(raw)&&raw>=0&&raw<=1000000)value=raw;else error=date+' 耗損格式待核對';}
 if(event&&(event.name!==row.name||event.total!==(value??0)))error=date+' 每日欄與入帳紀錄不一致';row.values[date]=value;if(error)row.errors[date]=error;
 }}
 const fingerprints={};for(const d of dates)fingerprints[d]=loss3Hash_([source.gid,d,columns[d]||[],rows.map(r=>[r.code,r.name,r.values[d],r.errors[d]||'',events.get(JSON.stringify([d,source.name,r.code]))?.revision||0])]);
 return {rows,fingerprints};
}
function periodRead_(input){const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他交易處理中，請稍後更新統計');try{return periodReadUnlocked_(input);}finally{lock.releaseLock();}}
function periodReadUnlocked_(input){
 const ss=SpreadsheetApp.openById(LOSS3.inventory),settings=periodSettings_(ss),period=LossPeriod.lossPeriod(input||settings,periodToday_()),sources=erpOrderSources_(),events=periodEvents_(ss,period.dates),status=periodStatusRows_(ss),latest=new Map();
 for(const r of status.rows)latest.set(JSON.stringify([loss3Date_(r[0]),r[1]]),r);
 const rows=[],completion={};for(const source of sources){const snap=periodSnapshot_(ss,source,period.dates,events),completed=[];completion[source.name]=period.dates.map(date=>{const s=latest.get(JSON.stringify([date,source.name])),error=snap.rows.find(r=>r.errors[date])?.errors[date]||'',done=!!s&&s[2]==='已完成'&&s[5]===snap.fingerprints[date]&&!error;if(done)completed.push(date);return {date,complete:done,status:done?'已完成':s?'待重新確認':'尚未完成',error,fingerprint:snap.fingerprints[date]};});rows.push(...LossPeriod.summarizeLossPeriod({dates:period.dates,rows:snap.rows,completedDates:completed}).map(({sheet,code,name,total,complete,error})=>({sheet,code,name,total,complete,error})));}
 return {settings,period,rows,completion,readAt:new Date().toISOString()};
}
function periodSaveSettings_(input){const period=LossPeriod.lossPeriod(input,periodToday_()),lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他操作處理中');try{const ss=SpreadsheetApp.openById(LOSS3.inventory);periodSettings_(ss);const sh=ss.getSheetByName(PERIOD_SETTINGS);sh.getRange('B2:B3').setValues([[period.days],[period.includeToday]]);SpreadsheetApp.flush();const saved=periodSettings_(ss);if(saved.days!==period.days||saved.includeToday!==period.includeToday)throw Error('設定讀回不一致');return saved;}finally{lock.releaseLock();}}
function periodAppend_(sh,values){return {appendCells:{sheetId:sh.getSheetId(),rows:values.map(row=>({values:row.map(v=>({userEnteredValue:{stringValue:String(v)}}))})),fields:'userEnteredValue'}};}
function periodComplete_(input){
 const date=loss3Date_(input?.date),actor=String(input?.actor||'').trim();if(date>periodToday_()||!actor||actor.length>80||input?.confirmBlankZero!==true)throw Error('請確認日期、經手人與空白代表零耗損');
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他交易處理中，請重新核對');try{
 const ss=SpreadsheetApp.openById(LOSS3.inventory),source=erpOrderSources_().find(s=>s.name===input.sheet);if(!source)throw Error('廠商分類不存在');
 const snap=periodSnapshot_(ss,source,[date],periodEvents_(ss,[date]));if(!snap.rows.length||snap.rows.some(r=>r.errors[date]))throw Error('每日資料待核對，不能標記完成');if(input.fingerprint!==snap.fingerprints[date])throw Error('資料已變更，請重新讀取後確認完成');
 const {sh,rows}=periodStatusRows_(ss),prior=rows.filter(r=>loss3Date_(r[0])===date&&r[1]===source.name).pop();if(prior?.[2]==='已完成'&&prior[5]===snap.fingerprints[date])return {complete:true,date,sheet:source.name};
 Sheets.Spreadsheets.batchUpdate({requests:[periodAppend_(sh,[[date,source.name,'已完成',actor,new Date().toISOString(),snap.fingerprints[date]]])]},LOSS3.inventory);
 return {complete:true,date,sheet:source.name};
 }finally{lock.releaseLock();}
}
function periodDay_(input){const date=loss3Date_(input?.date);if(date>periodToday_())throw Error('不能讀取未來日期');const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他交易處理中');try{const ss=SpreadsheetApp.openById(LOSS3.inventory),source=erpOrderSources_().find(s=>s.name===input.sheet);if(!source)throw Error('廠商分類不存在');const snap=periodSnapshot_(ss,source,[date],periodEvents_(ss,[date])),{rows}=periodStatusRows_(ss),prior=rows.filter(r=>loss3Date_(r[0])===date&&r[1]===source.name).pop(),error=!snap.rows.length?'此分類尚無藥品':snap.rows.find(r=>r.errors[date])?.errors[date]||'';return {date,sheet:source.name,fingerprint:snap.fingerprints[date],error,complete:!!prior&&prior[2]==='已完成'&&prior[5]===snap.fingerprints[date]&&!error};}finally{lock.releaseLock();}}
// Called from the existing atomic loss batch. No-op retries do not invalidate completion.
function periodInvalidations_(ss,changes,actor,time){const sh=ss.getSheetByName(PERIOD_STATUS);if(!sh)return [];periodStatusRows_(ss);const seen=new Set(),rows=[];for(const r of changes){const key=JSON.stringify([r.date,r.sheet]);if(seen.has(key))continue;seen.add(key);rows.push([r.date,r.sheet,'待重新確認',actor,time,'']);}return rows.length?[periodAppend_(sh,rows)]:[];}
