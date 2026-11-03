// Shortage records are append-only revisions. Never modifies inventory cells.
const SHORTAGE_TABLES={records:'缺藥管理',substitutions:'缺藥替代設定',events:'缺藥追蹤紀錄'};
function shortageRows_(ss,title){const sh=ss.getSheetByName(title);if(!sh)return [];if(sh.getRange(1,1,1,3).getDisplayValues()[0].join('|')!=='事件編號|資料JSON|更新時間')throw Error(title+' 表頭不符');if(sh.getLastRow()>10000)throw Error(title+' 超過讀取上限');return sh.getLastRow()<2?[]:sh.getRange(2,1,sh.getLastRow()-1,3).getValues().filter(r=>r.some(v=>v!==''&&v!==null)).map(r=>JSON.parse(r[1]));}
function shortageLatest_(rows){const m=new Map();rows.forEach(r=>m.set(r.id,r));return [...m.values()];}
function shortageLog_(id,title){const ss=SpreadsheetApp.openById(id),sh=ss.getSheetByName(title);if(!sh)return [];if(sh.getRange(1,1).getValue()!=='交易編號'||sh.getLastRow()>10000)throw Error('交易紀錄格式或範圍異常');return sh.getLastRow()<2?[]:sh.getRange(2,1,sh.getLastRow()-1,3).getValues().filter(r=>r.some(v=>v!==''&&v!==null)).map(r=>JSON.parse(r[1]));}
function shortageRead_(){const ss=SpreadsheetApp.openById(ERP.inventory),orders=shortageLog_(ERP.orders,ERP.orderLog),receipts=shortageLog_(ERP.inventory,ERP.log),events=shortageRows_(ss,SHORTAGE_TABLES.events);for(const [kind,list] of [['order',orders],['receipt',receipts]])for(const event of list)for(const a of event.draft.shortageLinks||[])events.push({targetId:a.shortageId,kind:'allocation',actor:event.draft.actor,time:event.time,request:JSON.stringify(event.draft),allocation:{...a,kind,transactionId:event.draft.id}});return {records:shortageLatest_(shortageRows_(ss,SHORTAGE_TABLES.records)),substitutions:shortageLatest_(shortageRows_(ss,SHORTAGE_TABLES.substitutions)),events,orders,receipts};}

function shortageItem_(item){const sources=erpOrderSources_();if(!sources.some(s=>s.name===item.sheet))throw Error('廠商來源未啟用');const v=SpreadsheetApp.openById(ERP.inventory).getSheetByName(item.sheet).getDataRange().getDisplayValues().slice(2);const matches=v.filter(r=>String(r[1]).trim()===item.code);if(matches.length!==1||String(matches[0][3]).trim()!==item.name)throw Error('藥品編號或名稱已變動，請重新讀取');}
function shortageSave_(input){
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他操作處理中，請重試');
 try{
 if(!input||!/^SE-[a-zA-Z0-9-]{8,80}$/.test(input.operationId||''))throw Error('操作編號無效');
 const ss=SpreadsheetApp.openById(ERP.inventory),state=shortageRead_();const oldEvent=state.events.find(e=>e.operationId===input.operationId);if(oldEvent){if(oldEvent.request!==JSON.stringify(input))throw Error('同操作編號內容不同');return {id:oldEvent.targetId,operationId:input.operationId};}
 let value,table;
 if(input.kind==='record'){value=Shortage.normalizeShortage(input.value);shortageItem_(value);table='records';if(!['closed','cancelled'].includes(value.status)&&state.records.some(r=>r.id!==value.id&&r.sheet===value.sheet&&r.code===value.code&&!['closed','cancelled'].includes(r.status)))throw Error('此藥品已有追蹤紀錄，請更新原紀錄');}
 else if(input.kind==='substitution'){value=Shortage.normalizeSubstitution(input.value);shortageItem_(value.from);shortageItem_(value.to);table='substitutions';if(state.substitutions.some(r=>r.id!==value.id&&r.from.sheet===value.from.sheet&&r.from.code===value.from.code&&r.to.sheet===value.to.sheet&&r.to.code===value.to.code))throw Error('此替代關係已存在，請更新原設定');}
 else if(input.kind==='allocation'){
 value=input.value;const record=state.records.find(r=>r.id===value.shortageId);if(!record)throw Error('缺藥紀錄不存在');if(!['order','receipt'].includes(value.kind))throw Error('關聯種類無效');if(value.sheet!==record.sheet||value.code!==record.code)throw Error('關聯品項不符');
 value=Shortage.validateAllocation(value,state.events.filter(e=>e.allocation).map(e=>e.allocation),state.orders,state.receipts);const transaction=(value.kind==='order'?state.orders:state.receipts).find(e=>e.draft.id===value.transactionId);if(transaction.draft.lines.find(l=>l.sheet===value.sheet&&l.code===value.code).name!==record.name)throw Error('交易品項名稱不符');
 if(!input.actor||String(input.actor).length>80)throw Error('經手人必填');
 }else throw Error('不支援的缺藥操作');
 if(table){const prev=state[table].find(r=>r.id===value.id);if(table==='records'&&prev&&(prev.sheet!==value.sheet||prev.code!==value.code||prev.name!==value.name))throw Error('已有紀錄不得變更藥品身分');if(value.revision!==(prev?.revision||0))throw Error('其他人已更新，請重新讀取後修改');value={...value,revision:value.revision+1,updatedAt:new Date().toISOString(),updatedBy:Session.getActiveUser().getEmail()};}
 const event={operationId:input.operationId,targetId:value.id||value.shortageId,kind:input.kind,actor:value.actor||input.actor,request:JSON.stringify(input),time:new Date().toISOString(),...(input.kind==='allocation'?{allocation:value}:{})};
 const requests=[],used=new Set(ss.getSheets().map(s=>s.getSheetId()));
 const append=(name,data)=>{let sh=ss.getSheetByName(name),id=sh?.getSheetId();if(!sh){id=904295000;while(used.has(id))id++;used.add(id);requests.push({addSheet:{properties:{sheetId:id,title:name,gridProperties:{rowCount:2,columnCount:3,frozenRowCount:1}}}});requests.push({updateCells:{start:{sheetId:id,rowIndex:0,columnIndex:0},rows:[{values:['事件編號','資料JSON','更新時間'].map(v=>({userEnteredValue:{stringValue:v}}))}],fields:'userEnteredValue'}});}requests.push({appendCells:{sheetId:id,rows:[{values:[input.operationId,JSON.stringify(data),event.time].map(v=>({userEnteredValue:{stringValue:v}}))}],fields:'userEnteredValue'}});};
 if(table)append(SHORTAGE_TABLES[table],value);append(SHORTAGE_TABLES.events,event);
 Sheets.Spreadsheets.batchUpdate({requests},ERP.inventory);return {id:event.targetId,operationId:input.operationId};
 }finally{lock.releaseLock();}
}

